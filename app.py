import os
import json
import sqlite3
import difflib
from datetime import datetime

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pdfplumber
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)

# Allow DATA_DIR override so cloud persistent-disk mounts work
_DATA_DIR    = os.environ.get('DATA_DIR', os.path.dirname(os.path.abspath(__file__)))
UPLOAD_FOLDER = os.path.join(_DATA_DIR, 'uploads')
DB_PATH       = os.path.join(_DATA_DIR, 'pdf_compare.db')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

MAX_UPLOAD_MB = 50
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_MB * 1024 * 1024


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            filename TEXT NOT NULL,
            upload_time TEXT NOT NULL,
            tables_data TEXT NOT NULL,
            text_data TEXT NOT NULL,
            notes TEXT DEFAULT ''
        )
    ''')
    # Single-latest-PDF boards (教育價活動 / 貨號表). Only one file per category;
    # uploading a new file overwrites the old one.
    conn.execute('''
        CREATE TABLE IF NOT EXISTS single_docs (
            category    TEXT PRIMARY KEY,
            orig_name   TEXT NOT NULL,
            stored_name TEXT NOT NULL,
            upload_time TEXT NOT NULL
        )
    ''')
    conn.commit()
    conn.close()


# Categories that each keep a single most-recent PDF
DOC_CATEGORIES = {'edu', 'sku'}


def extract_pdf_data(filepath):
    tables = []
    full_text = []
    with pdfplumber.open(filepath) as pdf:
        for page_num, page in enumerate(pdf.pages):
            page_tables = page.extract_tables()
            if page_tables:
                for t in page_tables:
                    # Filter out completely empty rows
                    rows = [row for row in t if any(cell for cell in row)]
                    if rows:
                        tables.append({'page': page_num + 1, 'rows': rows})
            text = page.extract_text()
            if text:
                full_text.append(text)
    return tables, '\n'.join(full_text)


def compare_tables(tables1, tables2):
    result = []
    max_tables = max(len(tables1), len(tables2)) if (tables1 or tables2) else 0

    for i in range(max_tables):
        if i >= len(tables1):
            result.append({'table_index': i, 'status': 'added', 'rows': tables2[i]['rows']})
        elif i >= len(tables2):
            result.append({'table_index': i, 'status': 'removed', 'rows': tables1[i]['rows']})
        else:
            t1_rows = [json.dumps(row, ensure_ascii=False) for row in tables1[i]['rows']]
            t2_rows = [json.dumps(row, ensure_ascii=False) for row in tables2[i]['rows']]

            sm = difflib.SequenceMatcher(None, t1_rows, t2_rows)
            row_diffs = []
            has_changes = False

            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == 'equal':
                    for k in range(i2 - i1):
                        row_diffs.append({'status': 'equal', 'row': tables1[i]['rows'][i1 + k]})
                elif tag == 'replace':
                    has_changes = True
                    for k in range(i2 - i1):
                        row_diffs.append({'status': 'removed', 'row': tables1[i]['rows'][i1 + k]})
                    for k in range(j2 - j1):
                        row_diffs.append({'status': 'added', 'row': tables2[i]['rows'][j1 + k]})
                elif tag == 'delete':
                    has_changes = True
                    for k in range(i2 - i1):
                        row_diffs.append({'status': 'removed', 'row': tables1[i]['rows'][i1 + k]})
                elif tag == 'insert':
                    has_changes = True
                    for k in range(j2 - j1):
                        row_diffs.append({'status': 'added', 'row': tables2[i]['rows'][j1 + k]})

            result.append({
                'table_index': i,
                'status': 'changed' if has_changes else 'equal',
                'row_diffs': row_diffs,
            })
    return result


@app.route('/')
def index():
    return send_from_directory('static', 'index.html')


@app.route('/api/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        return jsonify({'error': '未選擇文件'}), 400

    file = request.files['file']
    name = request.form.get('name', '').strip() or file.filename
    notes = request.form.get('notes', '').strip()

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': '只支援 PDF 文件'}), 400

    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    saved_filename = f"{timestamp}_{filename}"
    filepath = os.path.join(UPLOAD_FOLDER, saved_filename)
    file.save(filepath)

    try:
        tables, text = extract_pdf_data(filepath)
    except Exception as e:
        os.remove(filepath)
        return jsonify({'error': f'PDF 解析失敗: {str(e)}'}), 500

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.execute(
        'INSERT INTO records (name, filename, upload_time, tables_data, text_data, notes) VALUES (?, ?, ?, ?, ?, ?)',
        (name, saved_filename, datetime.now().isoformat(),
         json.dumps(tables, ensure_ascii=False), text, notes)
    )
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return jsonify({'id': record_id, 'name': name, 'tables_count': len(tables), 'message': '上傳成功'})


@app.route('/api/records', methods=['GET'])
def get_records():
    search = request.args.get('q', '').strip()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    if search:
        records = conn.execute(
            'SELECT id, name, filename, upload_time, notes, tables_data FROM records '
            'WHERE name LIKE ? OR notes LIKE ? ORDER BY upload_time DESC',
            (f'%{search}%', f'%{search}%')
        ).fetchall()
    else:
        records = conn.execute(
            'SELECT id, name, filename, upload_time, notes, tables_data FROM records ORDER BY upload_time DESC'
        ).fetchall()
    conn.close()
    result = []
    for r in records:
        d = dict(r)
        try:
            d['tables_count'] = len(json.loads(d.pop('tables_data', '[]') or '[]'))
        except Exception:
            d['tables_count'] = 0
            d.pop('tables_data', None)
        result.append(d)
    return jsonify(result)


@app.route('/api/records/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    conn = sqlite3.connect(DB_PATH)
    record = conn.execute('SELECT filename FROM records WHERE id = ?', (record_id,)).fetchone()
    if not record:
        conn.close()
        return jsonify({'error': '記錄不存在'}), 404

    filepath = os.path.join(UPLOAD_FOLDER, record[0])
    if os.path.exists(filepath):
        os.remove(filepath)

    conn.execute('DELETE FROM records WHERE id = ?', (record_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': '刪除成功'})


@app.route('/api/compare', methods=['POST'])
def compare():
    data = request.get_json()
    id1 = data.get('id1')
    id2 = data.get('id2')

    if not id1 or not id2:
        return jsonify({'error': '需要提供兩個記錄 ID'}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    r1 = conn.execute('SELECT * FROM records WHERE id = ?', (id1,)).fetchone()
    r2 = conn.execute('SELECT * FROM records WHERE id = ?', (id2,)).fetchone()
    conn.close()

    if not r1 or not r2:
        return jsonify({'error': '記錄不存在'}), 404

    tables1 = json.loads(r1['tables_data'])
    tables2 = json.loads(r2['tables_data'])
    table_diff = compare_tables(tables1, tables2)

    text1_lines = r1['text_data'].splitlines()
    text2_lines = r2['text_data'].splitlines()
    text_diff = list(difflib.unified_diff(text1_lines, text2_lines, lineterm='', n=2))

    has_table_changes = any(t.get('status') != 'equal' for t in table_diff)
    has_text_changes  = any(line.startswith(('+', '-')) and not line.startswith(('+++', '---'))
                            for line in text_diff)
    has_changes = has_table_changes or has_text_changes

    return jsonify({
        'record1': {'id': r1['id'], 'name': r1['name'], 'upload_time': r1['upload_time']},
        'record2': {'id': r2['id'], 'name': r2['name'], 'upload_time': r2['upload_time']},
        'table_diff': table_diff,
        'text_diff': text_diff,
        'has_changes': has_changes,
        'debug': {
            'tables1_count': len(tables1),
            'tables2_count': len(tables2),
            'has_table_changes': has_table_changes,
            'has_text_changes': has_text_changes,
            'text_diff_lines': len(text_diff),
        },
    })


@app.route('/api/records/<int:record_id>/debug', methods=['GET'])
def debug_record(record_id):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    r = conn.execute('SELECT id, name, tables_data, text_data FROM records WHERE id = ?', (record_id,)).fetchone()
    conn.close()
    if not r:
        return jsonify({'error': '記錄不存在'}), 404
    tables = json.loads(r['tables_data'])
    text_preview = r['text_data'][:500] if r['text_data'] else ''
    table_summary = [{'page': t.get('page'), 'row_count': len(t.get('rows', [])),
                      'first_row': t.get('rows', [[]])[0]} for t in tables[:5]]
    return jsonify({
        'id': r['id'], 'name': r['name'],
        'tables_count': len(tables),
        'table_summary': table_summary,
        'text_preview': text_preview,
    })


@app.route('/api/suggestions', methods=['POST'])
def get_suggestions():
    import re

    data        = request.get_json() or {}
    table_diff  = data.get('table_diff', [])
    r1_name     = data.get('record1_name', '文件A')
    r2_name     = data.get('record2_name', '文件B')
    has_changes = data.get('has_changes', False)

    # ── Category detection ──────────────────────────────────────────────────
    ACCESSORY_KW = [
        'AirPods', 'AirTag', 'Beats', 'MagSafe',
        '保護殼', '保護貼', '保護膜', '防護邊框',
        '鍵盤', 'Keyboard', '雙面夾',
        '卡套', '卡夾', '掛繩', '斜背',
        '線材', '傳輸線', '充電線', '編織線', '對Lightning', '對USB',
        'Apple Pencil', '耳機', '音箱', '喇叭',
    ]
    CAT_KEYS = [
        ('iPhone', ['iPhone']),
        ('iPad',   ['iPad']),
        ('Mac',    ['Mac', 'MacBook', 'iMac', 'MBA', 'MBP']),
        ('Watch',  ['Watch', 'Apple Watch']),
        ('配件',   ACCESSORY_KW),
    ]

    def detect_cat(row):
        text = ' '.join(str(c or '') for c in (row or []))
        for cat, kws in CAT_KEYS:
            if any(k in text for k in kws):
                # accessory keywords override device keywords
                if cat != '配件' and any(k in text for k in ACCESSORY_KW):
                    return '配件'
                return cat
        return '其他'

    # ── Per-category marketing copy ─────────────────────────────────────────
    CAT_COPY = {
        'iPhone': {
            'icon': '📱', 'color': 'blue', 'label': 'iPhone',
            'cheaper': '換機好時機！{name} 本次活動價 ${new:,}，比上次省 ${save:,}，現在入手最划算！',
            'new':     '📱 iPhone 新優惠上架：{name}，促銷價 ${price:,}{disc_str}，升級體驗不手軟！',
            'stable':  '📱 iPhone 系列活動條件維持不變，優惠穩定，可直接向客戶推薦。',
            'summary': '📱 iPhone 本波活動：{detail}，換機首選，把握機會！',
        },
        'iPad': {
            'icon': '📲', 'color': 'purple', 'label': 'iPad',
            'cheaper': '學習工作利器降價！{name} 活動價 ${new:,}（省 ${save:,}），搭配 Apple Pencil 更超值！',
            'new':     '📲 iPad 新品優惠：{name}，促銷價 ${price:,}{disc_str}，學習、工作、創作一台搞定！',
            'stable':  '📲 iPad 系列活動條件維持不變，生產力工具優惠持續，歡迎推薦。',
            'summary': '📲 iPad 本波活動：{detail}，生產力再升級！',
        },
        'Mac': {
            'icon': '💻', 'color': 'green', 'label': 'Mac',
            'cheaper': 'M 系列晶片降價來了！{name} 活動價 ${new:,}（省 ${save:,}），效能強大、工作更有力！',
            'new':     '💻 Mac 新優惠：{name}，促銷價 ${price:,}{disc_str}，M 晶片強悍效能現在更划算！',
            'stable':  '💻 Mac 系列活動條件不變，M 系列優惠持續，適合有換機需求的客戶。',
            'summary': '💻 Mac 本波活動：{detail}，創作工作首選！',
        },
        'Watch': {
            'icon': '⌚', 'color': 'pink', 'label': 'Apple Watch',
            'cheaper': '健康管理更親民！{name} 活動價 ${new:,}（省 ${save:,}），運動健康一手掌握！',
            'new':     '⌚ Apple Watch 新優惠：{name}，促銷價 ${price:,}{disc_str}，健康監測、運動追蹤全方位！',
            'stable':  '⌚ Apple Watch 活動條件不變，健康管理優惠持續，是送禮自用的好選擇。',
            'summary': '⌚ Apple Watch 本波活動：{detail}，健康生活從手腕開始！',
        },
        '配件': {
            'icon': '🔌', 'color': 'orange', 'label': '配件',
            'cheaper': '配件降價！{name} 活動價 ${new:,}（省 ${save:,}），搭機購買保護裝置更划算！',
            'new':     '🔌 配件新優惠：{name}，促銷價 ${price:,}{disc_str}，搭配主機一起買CP值最高！',
            'stable':  '🔌 配件系列活動條件不變，搭配手機平板一起推薦給客戶。',
            'summary': '🔌 配件本波活動：{detail}，搭機必買、保護升值！',
        },
        '其他': {
            'icon': '🎁', 'color': 'blue', 'label': '其他',
            'cheaper': '🔻 {name} 本次促銷價 ${new:,}（較上次省 ${save:,}），現在購買更划算！',
            'new':     '🆕 本次新增：{name}，促銷價 ${price:,}{disc_str}',
            'stable':  '活動條件維持不變。',
            'summary': '本波活動：{detail}',
        },
    }

    # ── Helper functions ────────────────────────────────────────────────────
    def row_name(row):
        cells = [str(c).strip() for c in (row or []) if c and str(c).strip()]
        return cells[0] if cells else ''

    def row_preview(row, max_chars=30):
        txt = '、'.join(str(c).strip() for c in (row or []) if c and str(c).strip())
        return txt[:max_chars] + ('…' if len(txt) > max_chars else '')

    def extract_prices(row):
        text = ' '.join(str(c or '') for c in (row or []))
        nums = [int(m.replace(',', '')) for m in re.findall(r'[\d,]{4,}', text)]
        return [n for n in nums if 1000 <= n <= 500000]

    def extract_discount(row):
        text = ' '.join(str(c or '') for c in (row or []))
        discs = [int(m.replace(',', '')) for m in re.findall(r'-\s*[\d,]+', text)]
        return max(discs) if discs else 0

    def lowest(row):
        p = extract_prices(row)
        return min(p) if p else None

    # ── Collect added / removed / cheaper by category ───────────────────────
    from collections import defaultdict
    added_by_cat   = defaultdict(list)
    removed_by_cat = defaultdict(list)
    cheaper_by_cat = defaultdict(list)

    for t in table_diff:
        for rd in t.get('row_diffs', []):
            cat = detect_cat(rd['row'])
            if rd['status'] == 'added':
                added_by_cat[cat].append(rd['row'])
            elif rd['status'] == 'removed':
                removed_by_cat[cat].append(rd['row'])
        if t.get('status') == 'added':
            for row in t.get('rows', [])[1:]:
                added_by_cat[detect_cat(row)].append(row)
        elif t.get('status') == 'removed':
            for row in t.get('rows', [])[1:]:
                removed_by_cat[detect_cat(row)].append(row)

        # Cheaper pairs
        rds = t.get('row_diffs', [])
        i = 0
        while i < len(rds):
            if rds[i]['status'] == 'removed':
                rem_block = []
                while i < len(rds) and rds[i]['status'] == 'removed':
                    rem_block.append(rds[i]['row']); i += 1
                add_block = []
                while i < len(rds) and rds[i]['status'] == 'added':
                    add_block.append(rds[i]['row']); i += 1
                for ra, rb in zip(rem_block, add_block):
                    pa, pb = lowest(ra), lowest(rb)
                    if pa and pb and pb < pa:
                        cat = detect_cat(rb)
                        cheaper_by_cat[cat].append({
                            'name': row_name(rb) or row_preview(rb),
                            'old': pa, 'new': pb, 'save': pa - pb,
                        })
            else:
                i += 1

    # ── Build cards ─────────────────────────────────────────────────────────
    cards = []
    CAT_ORDER = ['iPhone', 'iPad', 'Mac', 'Watch', '配件', '其他']

    if not has_changes:
        cards.append({'tag': '活動維持', 'color': 'blue',
            'text': f'📋 本次《{r2_name}》活動條件與《{r1_name}》完全相同，所有品項優惠不變，可直接沿用上次說明。'})
        # Show stable card per category that has data
        all_added = [r for rows in added_by_cat.values() for r in rows]
        for cat in CAT_ORDER:
            rows = added_by_cat.get(cat, [])
            if not rows:
                continue
            cp = CAT_COPY[cat]
            cards.append({'tag': f'{cp["label"]} 活動', 'color': cp['color'],
                'text': cp['stable']})
    else:
        for cat in CAT_ORDER:
            cp = CAT_COPY[cat]
            cheaper = cheaper_by_cat.get(cat, [])
            added   = added_by_cat.get(cat, [])
            removed = removed_by_cat.get(cat, [])

            if not cheaper and not added and not removed:
                continue

            # Cheaper cards (top 2 per category)
            for c in sorted(cheaper, key=lambda x: -x['save'])[:2]:
                cards.append({'tag': f'{cp["label"]} 降價', 'color': 'green',
                    'text': '🔻 ' + cp['cheaper'].format(**c)})

            # New items (top 2 per category)
            shown = 0
            for row in added:
                if shown >= 2: break
                p = extract_prices(row)
                d = extract_discount(row)
                name = row_name(row) or row_preview(row)
                if not name or not p: continue
                disc_str = f'，折讓 ${d:,}' if d else ''
                cards.append({'tag': f'{cp["label"]} 新優惠', 'color': cp['color'],
                    'text': cp['new'].format(name=name, price=min(p), disc_str=disc_str)})
                shown += 1

            # Removed warning
            if removed:
                names = '、'.join(filter(None, (row_name(r) or row_preview(r) for r in removed[:2])))
                if names:
                    cards.append({'tag': f'{cp["label"]} 注意', 'color': 'orange',
                        'text': f'⚠️ {cp["label"]} 本次已移除：{names}，請勿向客戶推薦已下架優惠。'})

            # Per-category summary
            parts = []
            if cheaper: parts.append(f'{len(cheaper)} 個降價')
            if added:   parts.append(f'{len(added)} 個新優惠')
            if removed: parts.append(f'{len(removed)} 個調整')
            cards.append({'tag': f'{cp["label"]} 總覽', 'color': cp['color'],
                'text': cp['summary'].format(detail='、'.join(parts))})

        # Overall summary
        total_cheaper = sum(len(v) for v in cheaper_by_cat.values())
        total_added   = sum(len(v) for v in added_by_cat.values())
        total_removed = sum(len(v) for v in removed_by_cat.values())
        summary_parts = []
        if total_cheaper: summary_parts.append(f'{total_cheaper} 個品項降價')
        if total_added:   summary_parts.append(f'{total_added} 個新增優惠')
        if total_removed: summary_parts.append(f'{total_removed} 個品項調整')
        if summary_parts:
            cards.append({'tag': '活動總覽', 'color': 'blue',
                'text': f'📊 《{r2_name}》整體活動重點：' + '、'.join(summary_parts) +
                        f'。相比《{r1_name}》優惠更豐富，歡迎把握機會！'})

    return jsonify({'suggestions': cards})


# ═══════════════════════════════════════════════════════════════════════════
#  SINGLE-LATEST-PDF BOARDS  (教育價活動 / 貨號表)
#  Each category keeps exactly one PDF; a new upload replaces the old one.
# ═══════════════════════════════════════════════════════════════════════════
@app.route('/api/docs/<category>', methods=['GET'])
def get_doc(category):
    if category not in DOC_CATEGORIES:
        return jsonify({'error': '類別不存在'}), 404
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute('SELECT orig_name, upload_time FROM single_docs WHERE category = ?',
                       (category,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'exists': False})
    return jsonify({'exists': True, 'name': row['orig_name'], 'upload_time': row['upload_time']})


@app.route('/api/docs/<category>', methods=['POST'])
def upload_doc(category):
    if category not in DOC_CATEGORIES:
        return jsonify({'error': '類別不存在'}), 404
    if 'file' not in request.files:
        return jsonify({'error': '未選擇文件'}), 400

    file = request.files['file']
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': '只支援 PDF 文件'}), 400

    # Fixed stored name per category → new upload always overwrites the old file
    stored_name = f'single_{category}.pdf'
    filepath = os.path.join(UPLOAD_FOLDER, stored_name)
    file.save(filepath)

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        'INSERT INTO single_docs (category, orig_name, stored_name, upload_time) '
        'VALUES (?, ?, ?, ?) '
        'ON CONFLICT(category) DO UPDATE SET '
        'orig_name = excluded.orig_name, stored_name = excluded.stored_name, '
        'upload_time = excluded.upload_time',
        (category, file.filename, stored_name, datetime.now().isoformat())
    )
    conn.commit()
    conn.close()
    return jsonify({'message': '上傳成功', 'name': file.filename})


@app.route('/api/docs/<category>/file', methods=['GET'])
def get_doc_file(category):
    if category not in DOC_CATEGORIES:
        return jsonify({'error': '類別不存在'}), 404
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute('SELECT stored_name FROM single_docs WHERE category = ?',
                       (category,)).fetchone()
    conn.close()
    if not row or not os.path.exists(os.path.join(UPLOAD_FOLDER, row[0])):
        return jsonify({'error': '檔案不存在'}), 404
    resp = send_from_directory(UPLOAD_FOLDER, row[0], mimetype='application/pdf')
    resp.headers['Cache-Control'] = 'no-store'
    return resp


init_db()

if __name__ == '__main__':
    init_db()
    print('🚀 伺服器啟動中... 請在瀏覽器開啟 http://localhost:5001')
    app.run(debug=True, port=5001)

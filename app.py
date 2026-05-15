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
_DATA_DIR    = os.environ.get('DATA_DIR', '.')
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
    conn.commit()
    conn.close()


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
            'SELECT id, name, filename, upload_time, notes FROM records '
            'WHERE name LIKE ? OR notes LIKE ? ORDER BY upload_time DESC',
            (f'%{search}%', f'%{search}%')
        ).fetchall()
    else:
        records = conn.execute(
            'SELECT id, name, filename, upload_time, notes FROM records ORDER BY upload_time DESC'
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in records])


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

    has_changes = any(t.get('status') != 'equal' for t in table_diff)

    return jsonify({
        'record1': {'id': r1['id'], 'name': r1['name'], 'upload_time': r1['upload_time']},
        'record2': {'id': r2['id'], 'name': r2['name'], 'upload_time': r2['upload_time']},
        'table_diff': table_diff,
        'text_diff': text_diff,
        'has_changes': has_changes,
    })


@app.route('/api/suggestions', methods=['POST'])
def get_suggestions():
    import re

    data        = request.get_json() or {}
    table_diff  = data.get('table_diff', [])
    r1_name     = data.get('record1_name', '文件A')
    r2_name     = data.get('record2_name', '文件B')
    has_changes = data.get('has_changes', False)

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

    # Collect added / removed / changed pairs
    added, removed, cheaper = [], [], []
    for t in table_diff:
        for rd in t.get('row_diffs', []):
            if rd['status'] == 'added':
                added.append(rd['row'])
            elif rd['status'] == 'removed':
                removed.append(rd['row'])
        if t.get('status') == 'added':
            added.extend(t.get('rows', [])[1:])
        elif t.get('status') == 'removed':
            removed.extend(t.get('rows', [])[1:])
        # Detect cheaper rows: match removed→added pairs by index within each table
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
                        cheaper.append({'name': row_name(rb) or row_preview(rb),
                                        'old': pa, 'new': pb, 'save': pa - pb})
            else:
                i += 1

    cards = []

    if not has_changes:
        cards.append({'tag': '活動維持', 'color': 'blue',
            'text': f'📋 本次《{r2_name}》活動條件與《{r1_name}》完全相同，所有品項優惠不變，可直接沿用上次說明。'})
        if added:
            p = extract_prices(added[0])
            price_str = f'，促銷價 ${min(p):,}' if p else ''
            cards.append({'tag': '活動亮點', 'color': 'green',
                'text': f'✅ 活動穩定：{row_preview(added[0])}{price_str}，條件優惠不變，歡迎推薦給客戶。'})
    else:
        # 降價品項
        for c in sorted(cheaper, key=lambda x: -x['save'])[:3]:
            cards.append({'tag': '降價優惠', 'color': 'green',
                'text': f'🔻 {c["name"]} 本次促銷價 ${c["new"]:,}（較上次活動降 ${c["save"]:,}），現在購買更划算！'})

        # 新增品項
        for row in added[:3]:
            p = extract_prices(row)
            d = extract_discount(row)
            name = row_preview(row)
            if not name:
                continue
            parts = [f'🆕 本次新增：{name}']
            if p:
                parts.append(f'促銷價 ${min(p):,}')
            if d:
                parts.append(f'折讓 ${d:,}')
            cards.append({'tag': 'B 新增品項', 'color': 'purple', 'text':', '.join(parts)})

        # 最大折讓品項
        all_rows_b = added + [rd['row'] for t in table_diff
                               for rd in t.get('row_diffs', []) if rd['status'] == 'added']
        best_disc = sorted(all_rows_b, key=extract_discount, reverse=True)[:1]
        for row in best_disc:
            d = extract_discount(row)
            p = extract_prices(row)
            if d > 0:
                cards.append({'tag': '最大折讓', 'color': 'pink',
                    'text': f'💸 本次折讓最高品項：{row_preview(row)}，折讓 ${d:,}' +
                            (f'，促銷價 ${min(p):,}' if p else '') + '，CP值最高！'})

        # 移除提醒
        if removed:
            names = '、'.join(row_name(r) or row_preview(r) for r in removed[:2] if r)
            if names:
                cards.append({'tag': '注意下架', 'color': 'orange',
                    'text': f'⚠️ 本次活動已移除：{names} 等品項，請勿向客戶推薦已下架優惠。'})

        # 整體賣點總結
        n_add, n_rem, n_chp = len(added), len(removed), len(cheaper)
        summary_parts = []
        if n_chp:  summary_parts.append(f'{n_chp} 個品項降價')
        if n_add:  summary_parts.append(f'{n_add} 個新增優惠')
        if n_rem:  summary_parts.append(f'{n_rem} 個品項調整')
        cards.append({'tag': '活動總覽', 'color': 'blue',
            'text': f'📊 《{r2_name}》活動重點：' + '、'.join(summary_parts) +
                    f'。相比《{r1_name}》整體優惠更完整，歡迎把握機會！'})

    return jsonify({'suggestions': cards})


if __name__ == '__main__':
    init_db()
    print('🚀 伺服器啟動中... 請在瀏覽器開啟 http://localhost:5001')
    app.run(debug=True, port=5001)

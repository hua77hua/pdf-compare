"""延長保固價目表 PDF → 快速比較用的資料。

一份 PDF 可以同時含 JC（區間費率表）與 AppleCare+（機型專案費用表），
兩種表都各自偵測，沒有的就不回傳（呼叫端保留舊資料）。
回傳格式與 static/warranty.js 內建的 WC_APPLECARE / WC_JC 相同。"""
import re
import unicodedata

import pdfplumber


def _nfkc(s):
    return unicodedata.normalize('NFKC', str(s)) if s is not None else ''


def _flat(s):
    return re.sub(r'\s+', '', _nfkc(s))


def _money(s):
    """'$1,250' / '＄2,290' / '$1000' → 1250；'X' 或空 → None"""
    m = re.search(r'\d[\d,]*', _nfkc(s))
    return int(m.group(0).replace(',', '')) if m and 'X' not in _nfkc(s).upper() else None


def _clean_name(s):
    s = _nfkc(s).replace('”', '"').replace('“', '"')
    s = re.sub(r'\s+', ' ', s).strip()
    s = re.sub(r'(?<=\S)\(', ' (', s)        # 14"(PROLED XDR) → 14" (PROLED XDR)
    return re.sub(r'\s+', ' ', s)


def _clean_repair(s):
    lines = [re.sub(r'\$\s+', '$', re.sub(r'\s+', ' ', _nfkc(l))).strip()
             for l in str(s or '').split('\n')]
    out = '；'.join(l for l in lines if l)
    return re.sub(r'(\$[\d,]+) ~ \1', r'\1', out)      # 每只 $2,290 ~ $2,290 → $2,290


def _ded(s):
    """意外損害自負額文字 → [[說明, 金額]]（金額小到大）"""
    text = re.sub(r'\s+', ' ', _nfkc(s))
    out, pos = [], 0
    for m in re.finditer(r'\$\s*([\d,]+)', text):
        label = text[pos:m.start()].strip(' :：')
        pos = m.end()
        out.append([label or '意外損害', int(m.group(1).replace(',', ''))])
    return sorted(out, key=lambda x: x[1])


def _col(header, *words):
    for i, h in enumerate(header):
        if all(w in h for w in words):
            return i
    return -1


def _parse_ac(rows):
    hi = next(i for i, r in enumerate(rows) if '機型' in [_flat(c) for c in r])
    h = [_flat(c) for c in rows[hi]]
    ci_name, ci_fee, ci_yrs = _col(h, '機型'), _col(h, '專案費用'), _col(h, '保固')
    ci_ded, ci_bat, ci_oth = _col(h, '自負額'), _col(h, '電池'), _col(h, '其他損壞')
    out, cat = [], ''
    fee = yrs = bat = None
    ded, rep = [], ''
    for r in rows[hi + 1:]:
        g = lambda k: r[k] if 0 <= k < len(r) else None
        if '機型' in _flat(g(ci_name)):
            continue                                # 每個分類會重複表頭
        c0 = _nfkc(g(0) or '').strip()
        if c0:
            cat = 'AirPods' if 'Music' in c0 else c0.split('\n')[0].strip()
            fee = yrs = bat = None
            ded, rep = [], ''
        name = _clean_name(g(ci_name) or '')
        if not name:
            continue
        if _money(g(ci_fee)) is not None:
            fee = _money(g(ci_fee))
        if g(ci_yrs):
            m = re.search(r'\d+', _nfkc(g(ci_yrs)))
            yrs = int(m.group(0)) if m else yrs
        if g(ci_ded):
            ded = _ded(g(ci_ded))
        music = cat == 'AirPods'
        cell_bat = g(ci_bat)
        if music:                                   # Music 區塊：原廠維修價寫在「電池」那一欄
            bat = None
            if cell_bat:
                rep = _clean_repair(cell_bat)
        else:
            if cell_bat:
                bat = _money(cell_bat)
            if g(ci_oth):
                rep = _clean_repair(g(ci_oth))
        if fee is None or yrs is None:
            continue
        item = {'cat': cat, 'name': name, 'fee': fee, 'yrs': yrs,
                'ded': ded or [['意外損害', 0]], 'battery': bat, 'repair': rep or '依原廠報價'}
        if name.startswith('AirPods'):
            item['jc'] = 'airpods'
        elif music or 'Studio Display' in name:
            item['noJc'] = True
        out.append(item)
    return out


_JC_KEYS = [('iPhone', 'iphone'), ('iPad', 'ipad'), ('Mac', 'mac'), ('Watch', 'watch'), ('AirPods', 'airpods')]


def _parse_jc(rows, out):
    hi = next(i for i, r in enumerate(rows) if '區間' in [_flat(c) for c in r])
    h = [_flat(c) for c in rows[hi]]
    ci = dict(rng=_col(h, '區間'), m=_col(h, '月繳'), y1=_col(h, '一年保'), y2=_col(h, '二年保'),
              y3=_col(h, '三年保'), rep=_col(h, '置換'), repair=_col(h, '維修自負'))
    key, rep = None, None
    for r in rows[hi + 1:]:
        g = lambda k: r[k] if 0 <= k < len(r) else None
        c0 = _nfkc(g(0) or '')
        if c0.strip():
            key = next((v for k, v in _JC_KEYS if k in c0), None)
        rng = re.fullmatch(r'\s*([\d,]+)\s*[-~–]\s*([\d,]+)\s*', _nfkc(g(ci['rng']) or ''))
        if not key or not rng:
            continue
        if _money(g(ci['rep'])) is not None:
            rep = _money(g(ci['rep']))
        band = {'lo': int(rng.group(1).replace(',', '')), 'hi': int(rng.group(2).replace(',', '')),
                'm': _money(g(ci['m'])), 'y1': _money(g(ci['y1'])), 'y2': _money(g(ci['y2'])),
                'y3': _money(g(ci['y3'])), 'rep': rep}
        rp = g(ci['repair'])
        if key == 'mac' and rp and re.fullmatch(r'\s*[$＄]?\s*[\d,]+\s*', _nfkc(rp)):
            band['repair'] = _money(rp)         # 只有 Mac 有維修自負額金額
        if band['m'] is None or band['y1'] is None:
            continue
        out.setdefault(key, []).append(band)


def parse_warranty_pdf(path):
    """→ {'ac': {'data': [...], 'version': '2026.11'}, 'jc': {...}}（偵測不到的不放）"""
    ac, jc, versions = [], {}, {'ac': '', 'jc': ''}
    with pdfplumber.open(path) as pdf:
        for pg in pdf.pages:
            text = _nfkc(pg.extract_text() or '')
            ver = re.search(r'(\d{4})\.(\d{1,2})\s*版', text)
            for t in (pg.extract_tables() or []):
                flat = [[_flat(c) for c in r] for r in t]
                if any('機型' in r and '專案費用' in r for r in flat):
                    ac += _parse_ac(t)
                    if ver:
                        versions['ac'] = f'{ver.group(1)}.{int(ver.group(2)):02d}'
                elif any('區間' in r and any('月繳' in c for c in r) for r in flat):
                    _parse_jc(t, jc)
                    if ver:
                        versions['jc'] = f'{ver.group(1)}.{int(ver.group(2)):02d}'
    out = {}
    if len(ac) >= 15:
        out['ac'] = {'data': ac, 'version': versions['ac']}
    if len(jc) >= 3 and sum(len(v) for v in jc.values()) >= 12:
        out['jc'] = {'data': jc, 'version': versions['jc']}
    return out

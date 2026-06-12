const API = '/api';

// ── State ──────────────────────────────────────
let fileA = null, fileB = null;
let histPickIds = [];
let allRecords  = [];
let sugTexts    = [];
let lastCompData     = null;
let lastCompRecNames = ['文件A', '文件B'];
let activeDeviceTab  = 'all';
let activeModelFilter = 'all';

const DEVICE_TABS = [
  { key: 'all',    label: '全部產品',   icon: '📋', color: '#374151', bg: '#f9fafb', border: '#d1d5db', keys: [] },
  { key: 'iPhone', label: 'iPhone',      icon: '📱', color: '#007AFF', bg: '#eff6ff', border: '#bfdbfe', keys: ['iPhone'] },
  { key: 'iPad',   label: 'iPad',        icon: '📲', color: '#5856D6', bg: '#f5f3ff', border: '#ddd6fe', keys: ['iPad'] },
  { key: 'Mac',    label: 'Mac',         icon: '💻', color: '#34C759', bg: '#f0fdf4', border: '#bbf7d0', keys: ['Mac', 'MacBook', 'iMac', 'MBA', 'MBP'] },
  { key: 'Watch',  label: 'Apple Watch', icon: '⌚', color: '#FF3B30', bg: '#fff1f2', border: '#fecdd3', keys: ['Watch', 'Apple Watch', 'AW '] },
  { key: '配件',   label: '配件',         icon: '🔌', color: '#8B5CF6', bg: '#faf5ff', border: '#e9d5ff', keys: [] },
];

// Accessory-type keywords: rows matching any of these are always 配件,
// even if they also contain a device name (e.g. "iPad Pro 巧控鍵盤", "iPhone 16 保護殼")
const ACCESSORY_KWORDS = [
  '保護殼', '保護貼', '保護膜',            // cases / screen protectors
  '鍵盤', 'Keyboard', 'keyboard',          // keyboards (巧控鍵盤, Magic Keyboard)
  '雙面夾',                                 // Smart Folio / Smart Case (聰穎雙面夾)
  '卡套', '卡夾',                           // card cases
  '掛繩', '斜背',                           // crossbody / wrist straps
  '線材', '傳輸線', '充電線', '編織線',     // cables
  '對Lightning', '對USB',                   // cable connectors
  '防護邊框',                               // bumper cases
  'Apple Pencil',                           // stylus + accessories
  'AirPods', 'AirTag',                      // audio / tracking
  'Beats',                                  // Beats headphones
  'MagSafe',                                // MagSafe accessories
  '耳機', '音箱', '喇叭',                   // headphones / speakers
];

const PROMO_KEYS  = ['優惠', '折扣', '特價', '贈品', '限時', '促銷', '免費', '贈送', '禮'];
const COLOR_WORDS = [
  '黑色','白色','粉色','藍色','紫色','綠色','紅色','金色','銀色','灰色','橙色','黃色',
  '深空黑','星光色','午夜色','原色','沙漠色','鈦金屬','天藍色','湖水綠','珊瑚色',
  'Black','White','Pink','Blue','Purple','Green','Red','Gold','Silver','Gray',
  'Natural','Midnight','Starlight','Titanium','Desert',
];

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSlot('A');
  setupSlot('B');
  loadRecords();
  showDefaultSuggestions();
  document.getElementById('histSearch')
    .addEventListener('input', debounce(e => loadRecords(e.target.value), 280));
});

// ═══════════════════════════════════════════════
//  BLOCK 1 — UPLOAD SLOTS
// ═══════════════════════════════════════════════
function setupSlot(w) {
  const slotEl = document.getElementById('slot' + w);
  const fi     = document.getElementById('file' + w);
  fi.addEventListener('click', e => e.stopPropagation());
  slotEl.addEventListener('click', e => { if (e.target === fi) return; fi.click(); });
  slotEl.addEventListener('dragover', e => { e.preventDefault(); slotEl.classList.add('drag-over'); });
  slotEl.addEventListener('dragleave', e => {
    if (!slotEl.contains(e.relatedTarget)) slotEl.classList.remove('drag-over');
  });
  slotEl.addEventListener('drop', e => {
    e.preventDefault(); slotEl.classList.remove('drag-over');
    setSlotFile(w, e.dataTransfer.files[0]);
  });
  fi.addEventListener('change', () => { if (fi.files[0]) setSlotFile(w, fi.files[0]); });
}

function slotClick(w) { document.getElementById('file' + w).click(); }

function setSlotFile(w, file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    toast('請選擇 PDF 格式的文件', 'error'); return;
  }
  if (w === 'A') fileA = file; else fileB = file;
  const slot = document.getElementById('slot' + w);
  slot.classList.add('has-file');
  document.getElementById('slot' + w + 'Idle').style.display = 'none';
  document.getElementById('slot' + w + 'Fill').style.display = 'flex';
  document.getElementById('slot' + w + 'Fn').textContent = file.name;
  const nameEl = document.getElementById('name' + w);
  if (!nameEl.value) nameEl.value = file.name.replace(/\.pdf$/i, '');
  refreshGoBtn();
}

function clearSlot(w) {
  if (w === 'A') fileA = null; else fileB = null;
  const slot = document.getElementById('slot' + w);
  slot.classList.remove('has-file');
  document.getElementById('slot' + w + 'Idle').style.display = 'flex';
  document.getElementById('slot' + w + 'Fill').style.display = 'none';
  document.getElementById('file' + w).value = '';
  refreshGoBtn();
}

function refreshGoBtn() {
  document.getElementById('goBtn').disabled = !(fileA && fileB);
}

async function doUploadCompare() {
  if (!fileA || !fileB) return;
  const nameA = document.getElementById('nameA').value.trim() || fileA.name;
  const nameB = document.getElementById('nameB').value.trim() || fileB.name;
  const btn = document.getElementById('goBtn');
  btn.disabled = true;
  setStatus('正在上傳並解析文件…', 'uploading');
  setCompLoading();
  try {
    const idA = await uploadFile(fileA, nameA);
    setStatus('✓ 文件 A 完成，正在上傳文件 B…', 'uploading');
    const idB = await uploadFile(fileB, nameB);
    setStatus('✓ 兩份文件上傳完成，正在比較…', 'uploading');
    await loadRecords();
    await runCompare(idA, idB);
    setStatus('✓ 比較完成！', 'success');
    setTimeout(() => { document.getElementById('uploadStatus').style.display = 'none'; }, 2500);
    clearSlot('A'); clearSlot('B');
    document.getElementById('nameA').value = '';
    document.getElementById('nameB').value = '';
    toast('上傳比較完成！結果已更新', 'success');
  } catch (e) {
    setStatus('✕ ' + e.message, 'error');
    setCompError(e.message);
  } finally {
    refreshGoBtn();
  }
}

async function uploadFile(file, name) {
  const fd = new FormData();
  fd.append('file', file); fd.append('name', name);
  const res  = await fetch(`${API}/upload`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '上傳失敗');
  return data.id;
}

function setStatus(msg, type) {
  const el = document.getElementById('uploadStatus');
  el.textContent = msg; el.className = `upload-status ${type}`; el.style.display = 'block';
}

// ═══════════════════════════════════════════════
//  BLOCK 2 — COMPARISON ENGINE
// ═══════════════════════════════════════════════
function setCompLoading() {
  document.getElementById('compareBody').innerHTML =
    `<div class="loading-box"><div class="spin"></div><div>比較中，請稍候…</div></div>`;
  document.getElementById('compBadge').style.display = 'none';
}

function setCompError(msg) {
  document.getElementById('compareBody').innerHTML =
    `<div class="placeholder"><div class="ph-ico">⚠️</div><div class="ph-title">比較失敗</div><div class="ph-desc">${esc(msg)}</div></div>`;
}

async function runCompare(id1, id2) {
  const res  = await fetch(`${API}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id1, id2 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '比較失敗');
  lastCompData     = data;
  lastCompRecNames = [data.record1.name, data.record2.name];
  activeDeviceTab  = 'all';
  activeModelFilter = 'all';
  renderCompResult(data);
  await fetchSuggestions(data);
}

// ── Device tab detection ────────────────────────
function detectDeviceTab(row) {
  const text = (row || []).map(c => c || '').join(' ');
  // Accessory-type keywords take priority — "iPad Pro 巧控鍵盤" → 配件, not iPad
  if (ACCESSORY_KWORDS.some(k => text.includes(k))) return '配件';
  // Then check named device tabs
  for (const tab of DEVICE_TABS.filter(t => t.keys.length > 0)) {
    if (tab.keys.some(k => text.includes(k))) return tab.key;
  }
  return null; // no keyword match → row belongs to dominant table tab
}

function rowMatchesTab(row, tabKey) {
  const det = detectDeviceTab(row);
  return tabKey === '配件' ? (det === '配件' || det === null) : det === tabKey;
}

// ── Extract pairs from table_diff ───────────────
function extractTablePairs(tableDiff) {
  const tables = [];
  for (const t of tableDiff) {
    const header = [];
    const pairs  = [];

    if (t.status === 'removed') {
      const rows = t.rows || [];
      if (rows.length) {
        header.push(...(rows[0] || []));
        for (const row of rows.slice(1))
          pairs.push({ rowA: row, rowB: null, status: 'only-a' });
      }
    } else if (t.status === 'added') {
      const rows = t.rows || [];
      if (rows.length) {
        header.push(...(rows[0] || []));
        for (const row of rows.slice(1))
          pairs.push({ rowA: null, rowB: row, status: 'only-b' });
      }
    } else {
      const rowDiffs = t.row_diffs || [];
      let start = 0;
      if (rowDiffs.length && rowDiffs[0].status === 'equal') {
        header.push(...(rowDiffs[0].row || []));
        start = 1;
      }
      let i = start;
      while (i < rowDiffs.length) {
        if (rowDiffs[i].status === 'equal') {
          pairs.push({ rowA: rowDiffs[i].row, rowB: rowDiffs[i].row, status: 'same' });
          i++;
        } else {
          const removed = [];
          while (i < rowDiffs.length && rowDiffs[i].status === 'removed') { removed.push(rowDiffs[i].row); i++; }
          const added   = [];
          while (i < rowDiffs.length && rowDiffs[i].status === 'added')   { added.push(rowDiffs[i].row);   i++; }
          const n = Math.max(removed.length, added.length);
          for (let j = 0; j < n; j++) {
            const rowA = removed[j] || null, rowB = added[j] || null;
            if (rowA && rowB) pairs.push({ rowA, rowB, status: 'changed' });
            else if (rowA)    pairs.push({ rowA, rowB: null, status: 'only-a' });
            else              pairs.push({ rowA: null, rowB, status: 'only-b' });
          }
        }
      }
    }
    if (pairs.length) tables.push({ header, pairs });
  }
  return tables;
}

function getPairsForTab(tableData, tabKey) {
  // 'all' tab: return every pair from every table
  if (tabKey === 'all') return tableData.map(({ header, pairs }) => ({ header, pairs }));

  const result = [];
  for (const { header, pairs } of tableData) {
    // Detect dominant device: check header first, then any explicitly detected row wins over 配件
    const headerDet = detectDeviceTab(header);
    const explicitCounts = {};
    for (const p of pairs) {
      const det = detectDeviceTab(p.rowA || p.rowB);
      if (det) explicitCounts[det] = (explicitCounts[det] || 0) + 1;
    }
    const dominantDetected = Object.entries(explicitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const dominantTab = headerDet || dominantDetected || '配件';

    const filtered = pairs.filter(p => {
      const det = detectDeviceTab(p.rowA || p.rowB);
      if (det) return det === tabKey;
      return tabKey === '配件' ? dominantTab === '配件' : dominantTab === tabKey;
    });
    if (filtered.length) result.push({ header, pairs: filtered });
  }
  return result;
}

function countTabPairs(tableData, tabKey) {
  if (tabKey === 'all') return tableData.reduce((s, { pairs }) => s + pairs.length, 0);
  return tableData.reduce((sum, { header, pairs }) => {
    const headerDet = detectDeviceTab(header);
    const explicitCounts = {};
    for (const p of pairs) {
      const det = detectDeviceTab(p.rowA || p.rowB);
      if (det) explicitCounts[det] = (explicitCounts[det] || 0) + 1;
    }
    const dominantDetected = Object.entries(explicitCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const dominantTab = headerDet || dominantDetected || '配件';
    return sum + pairs.filter(p => {
      const det = detectDeviceTab(p.rowA || p.rowB);
      if (det) return det === tabKey;
      return tabKey === '配件' ? dominantTab === '配件' : dominantTab === tabKey;
    }).length;
  }, 0);
}

// ── Column detection from header row ───────────
function detectColMap(headerRow) {
  const map = { name: -1, capacity: -1, originalPrice: -1, memberPrice: -1, discount: -1, promoPrice: -1, gift: -1 };
  (headerRow || []).forEach((cell, i) => {
    const c = String(cell || '').toLowerCase();
    if (/品名|機型|型號|model|product/.test(c)               && map.name < 0)            map.name          = i;
    if (/容量|尺寸|大小|儲存|storage|size|規格/.test(c)      && map.capacity < 0)        map.capacity      = i;
    if (/促銷|最終|特惠|final|promo|活動價格|活動最終/.test(c) && map.promoPrice < 0)     map.promoPrice    = i;
    if (/折讓|折扣|discount/.test(c)                         && map.discount < 0)        map.discount      = i;
    if (/原價|原始價|定價|建議售/.test(c)                       && map.originalPrice < 0 && i !== map.promoPrice)  map.originalPrice = i;
    if (/活動.*價|會員.*價|售價/.test(c)                      && map.memberPrice < 0 && i !== map.promoPrice && i !== map.originalPrice) map.memberPrice = i;
    if (/贈品|贈送|附贈|加贈|gift|bonus|備品|附件|活動附加/.test(c) && map.gift < 0)            map.gift          = i;
  });
  return map;
}

// Infer column layout from actual data row when no header is available.
// Detects the two known column structures used in these PDFs:
//   8-col: [category/empty, 6-digit-code, 品名, 商品型號, 會員價, 折讓額, 促銷價, 活動?]
//   6-col: [6-digit-code, 品名, 商品型號, 會員價, 折讓額, 促銷價]
function inferColMapFromRow(row) {
  if (!row) return null;
  const cells = (row || []).map(c => String(c ?? '').trim());
  const n = cells.length;
  const base = { name: -1, capacity: -1, originalPrice: -1, memberPrice: -1, discount: -1, promoPrice: -1, gift: -1 };
  // 8-col: col1 is a 5–6 digit product code, col2 is the 品名
  if (n >= 7 && /^\d{5,6}$/.test(cells[1])) {
    return { ...base, name: 2, memberPrice: 4, discount: 5, promoPrice: 6 };
  }
  // 6-col: col0 is a 5–6 digit product code, col1 is the 品名
  if (n >= 5 && n < 7 && /^\d{5,6}$/.test(cells[0])) {
    return { ...base, name: 1, memberPrice: 3, discount: 4, promoPrice: 5 };
  }
  return null;
}

// ── Product key for name-based row matching ──────

// Strip color/band suffix: "AW SE GPS 40/星光鋁/錶帶-S/M" → "AW SE GPS 40"
// Rule: strip from the first "/" whose next character is Chinese (color description)
function stripColorSuffix(name) {
  const m = name.match(/^(.*?)\/[一-鿿]/);
  return m ? m[1].trim() : name;
}

// Fill empty name cells from the previous row (PDF merged-cell propagation)
// header: optional table header row, used to seed the initial product name
function fillMergedNames(pairs, colMap, header) {
  // Infer a stable nameIdx for this table from the first available data row
  const firstRow = pairs.find(p => p.rowA || p.rowB);
  const sampleRow = firstRow?.rowA || firstRow?.rowB;
  const effMap = colMap.name >= 0 ? colMap : (inferColMapFromRow(sampleRow) || colMap);
  const nameIdx = effMap.name >= 0 ? effMap.name : 0;

  // Seed from header if it looks like a product name (not a column label)
  const headerCell = header && String((header || [])[nameIdx] ?? '').trim();
  const isColLabel = headerCell && /品名|機型|型號|容量|尺寸|售價|活動|折讓|促銷|model|product|size|price/i.test(headerCell);
  const seed = (headerCell && !isColLabel) ? headerCell : '';
  let lastNameA = seed, lastNameB = seed;

  return pairs.map(p => {
    let { rowA, rowB } = p;
    if (rowA) {
      const ni = colMap.name >= 0 ? nameIdx : ((inferColMapFromRow(rowA) || effMap).name >= 0 ? (inferColMapFromRow(rowA) || effMap).name : nameIdx);
      const name = String(rowA[ni] ?? '').trim();
      const isSize = /^\d+\s*(mm|GB|TB)$/i.test(name);
      if (name && !isSize) lastNameA = name;
      else if (lastNameA) { rowA = [...rowA]; rowA[ni] = lastNameA; }
    }
    if (rowB) {
      const ni = colMap.name >= 0 ? nameIdx : ((inferColMapFromRow(rowB) || effMap).name >= 0 ? (inferColMapFromRow(rowB) || effMap).name : nameIdx);
      const name = String(rowB[ni] ?? '').trim();
      const isSize = /^\d+\s*(mm|GB|TB)$/i.test(name);
      if (name && !isSize) lastNameB = name;
      else if (lastNameB) { rowB = [...rowB]; rowB[ni] = lastNameB; }
    }
    return { ...p, rowA, rowB };
  });
}

function productKey(row, colMap) {
  if (!row) return '';
  const cells = row.map(c => String(c ?? '').trim());
  // Always prefer row-structure inference so 6-col rows use the right name column
  const eff = inferColMapFromRow(row) || colMap;
  const nameIdx = (eff && eff.name >= 0) ? eff.name : 0;
  const capIdx  = (eff && eff.capacity >= 0) ? eff.capacity : -1;
  let name = cells[nameIdx] || '';

  // Normalize: strip color/band suffix so all variants of same model share a key
  name = stripColorSuffix(name);

  let cap = (capIdx >= 0 && capIdx !== nameIdx) ? (cells[capIdx] || '') : '';
  // Fallback: scan other cells for explicit size patterns (40mm, 128GB, etc.)
  if (!cap) {
    for (let i = 0; i < cells.length; i++) {
      if (i === nameIdx) continue;
      if (/^\d+\s*(mm|GB|TB)$/i.test(cells[i])) { cap = cells[i]; break; }
    }
  }
  // Size embedded in name itself (e.g. "Apple Watch SE 40mm")
  if (!cap) {
    const m = name.match(/\b(\d+\s*(?:mm|GB|TB))\b/i);
    if (m) cap = m[1];
  }

  const key = (cap && cap !== name) ? `${name}__${cap}` : name;
  return (!key || /^[\d,]+$/.test(key)) ? '' : key;
}


// Normalize key for loose matching (handle minor formatting differences between docs)
function normKey(k) {
  return k.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Re-match row pairs by product name to fix positional mismatch from difflib
function rematchPairsByName(pairs, colMap) {
  const aMap = new Map(), bMap = new Map();
  const keyOrder = [], seen = new Set();

  const addKey = k => { const nk = normKey(k); if (k && !seen.has(nk)) { keyOrder.push(k); seen.add(nk); } };

  for (const p of pairs) {
    if (p.rowA) { const k = productKey(p.rowA, colMap); addKey(k); if (k && !aMap.has(normKey(k))) aMap.set(normKey(k), p.rowA); }
    if (p.rowB) { const k = productKey(p.rowB, colMap); addKey(k); if (k && !bMap.has(normKey(k))) bMap.set(normKey(k), p.rowB); }
  }

  return keyOrder.map(k => {
    const nk = normKey(k);
    const rowA = aMap.get(nk) ?? null, rowB = bMap.get(nk) ?? null;
    const status = !rowA ? 'only-b' : !rowB ? 'only-a'
      : JSON.stringify(rowA) === JSON.stringify(rowB) ? 'same' : 'changed';
    return { rowA, rowB, status };
  });
}

// ── Parse a row into structured fields ──────────
function parseRowData(row, colMap) {
  if (!row) return null;
  const cells = row.map(c => String(c ?? '').trim());
  // Always prefer row-structure inference so 6-col accessory rows use the right name column
  const effectiveColMap = inferColMapFromRow(row) || colMap;
  const useMap = effectiveColMap.originalPrice >= 0 || effectiveColMap.memberPrice >= 0 || effectiveColMap.promoPrice >= 0 || effectiveColMap.discount >= 0;

  if (useMap) {
    // Only keep a cell value as a price if it looks like a numeric amount:
    // - No Chinese characters (rejects gift descriptions like "配件金$3,000")
    // - Has 3+ consecutive digits
    // - At least 50% of meaningful characters are digits (rejects product codes like MXTF3ZP/A)
    const toPrice = s => {
      const str = String(s || '').trim();
      if (!str) return '';
      if (/[一-鿿]/.test(str)) return '';                          // Chinese text → not a price
      if (!/\d{3,}/.test(str.replace(/,/g, ''))) return '';               // No 3+ digit run → not a price
      const core = str.replace(/[\s,.$＄NT元\-＋+]/g, '');
      if (core.length > 0 && core.replace(/[^0-9]/g, '').length / core.length < 0.5) return ''; // < 50% digits → product code
      return str;
    };

    // Gift: use dedicated column if found; otherwise scan remaining cells for gift keywords
    const GIFT_KW = ['保護貼', '保護殼', '配件金', '抵用金', '禮券', '加碼', '折抵', '插頭', '轉接線', '傳輸線', '充電線', '贈品', '附贈', '加贈', '免費', '贈送', '禮'];
    let giftVal = '';
    if (effectiveColMap.gift >= 0) {
      giftVal = cells[effectiveColMap.gift] || '';
    } else {
      const usedIdx = new Set(
        [effectiveColMap.name, effectiveColMap.capacity, effectiveColMap.originalPrice, effectiveColMap.memberPrice, effectiveColMap.discount, effectiveColMap.promoPrice]
          .filter(i => i >= 0)
      );
      cells.forEach((c, i) => {
        if (!usedIdx.has(i) && c && GIFT_KW.some(k => c.includes(k)))
          giftVal += (giftVal ? ' ' : '') + c;
      });
    }

    return {
      name:          effectiveColMap.name          >= 0 ? (cells[effectiveColMap.name]          || '') : (cells[0] || ''),
      capacity:      (() => {
        if (effectiveColMap.capacity >= 0) return cells[effectiveColMap.capacity] || '';
        // Fallback: scan cells for size pattern
        for (let i = 0; i < cells.length; i++) {
          if (i === (effectiveColMap.name >= 0 ? effectiveColMap.name : 0)) continue;
          if (/^\d+\s*(mm|GB|TB)$/i.test(cells[i])) return cells[i];
        }
        return '';
      })(),
      originalPrice: toPrice(effectiveColMap.originalPrice >= 0 ? cells[effectiveColMap.originalPrice] : ''),
      memberPrice:   toPrice(effectiveColMap.memberPrice   >= 0 ? cells[effectiveColMap.memberPrice]   : ''),
      discount:      effectiveColMap.discount      >= 0 ? (cells[effectiveColMap.discount]      || '') : '',
      promoPrice:    toPrice(effectiveColMap.promoPrice    >= 0 ? cells[effectiveColMap.promoPrice]    : ''),
      gift:          giftVal,
    };
  }

  // Heuristic extraction
  const GIFT_KWORDS = ['保護貼', '保護殼', '配件金', '抵用金', '禮券', '加碼', '折抵', '插頭', '轉接線', '傳輸線', '充電線', '贈品', '附贈', '加贈', '免費', '贈送', '禮'];
  const prices = [], discounts = [], nameParts = [], giftParts = [];
  cells.forEach(c => {
    if (!c) return;
    if (/^[-－][\d,]+$/.test(c)) { discounts.push(c); return; }
    // Cells with Chinese characters are never prices (avoids "現折1627起 再送市價790保護殼" → 16277090)
    if (!/[一-鿿]/.test(c)) {
      const numVal = parseInt(c.replace(/[^0-9]/g, '') || '0');
      if (numVal >= 5000) { prices.push({ raw: c, val: numVal }); return; }
    }
    if (GIFT_KWORDS.some(k => c.includes(k))) { giftParts.push(c); return; }
    nameParts.push(c);
  });
  prices.sort((a, b) => b.val - a.val);
  // Remove outlier prices: product codes like "262292" are >> 10× the actual price
  if (prices.length >= 2) {
    const minVal = prices[prices.length - 1].val;
    while (prices.length >= 2 && prices[0].val > minVal * 10) prices.shift();
  }

  const capIdx = nameParts.findIndex(c => /\d+\s*[GT]B/i.test(c) || /^\d+\s*mm$/i.test(c));
  const cap    = capIdx >= 0 ? nameParts.splice(capIdx, 1)[0] : '';

  return {
    name:          nameParts[0] || '',
    capacity:      cap,
    originalPrice: prices[0]?.raw || '',
    memberPrice:   prices.length > 2 ? (prices[1]?.raw || '') : '',
    discount:      discounts[0] || '',
    promoPrice:    prices[prices.length - 1]?.raw || prices[0]?.raw || '',
    gift:          giftParts.join(' ') || '',
  };
}

function getProductName(row, colMap) {
  const d = parseRowData(row, colMap);
  return d?.name || '';
}

// ── Main compare renderer ───────────────────────
function renderCompResult(d) {
  const { record1, record2, table_diff, has_changes } = d;

  let nAdd = 0, nRem = 0, nEq = 0;
  table_diff.forEach(t => {
    (t.row_diffs || []).forEach(r => {
      if      (r.status === 'added')   nAdd++;
      else if (r.status === 'removed') nRem++;
      else                             nEq++;
    });
    if (t.status === 'added')   nAdd += (t.rows || []).length;
    if (t.status === 'removed') nRem += (t.rows || []).length;
  });

  const badge = document.getElementById('compBadge');
  badge.style.display = 'inline';
  badge.textContent   = has_changes ? `${nAdd + nRem} 處差異` : '✓ 無差異';

  const tableData = extractTablePairs(table_diff);

  let html = `<div class="comp-wrap">
    <div class="comp-files">
      <div class="comp-chip">
        <div class="chip-lbl">文件 A</div>
        <div class="chip-name">${esc(record1.name)}</div>
      </div>
      <div class="comp-arr">→</div>
      <div class="comp-chip">
        <div class="chip-lbl">文件 B</div>
        <div class="chip-name">${esc(record2.name)}</div>
      </div>
    </div>
    <div class="comp-tags">
      <span class="ctag ctag-add">＋ ${nAdd} 新增</span>
      <span class="ctag ctag-rem">－ ${nRem} 移除</span>
      <span class="ctag ctag-eq">＝ ${nEq} 相同</span>
      ${!has_changes ? '<span class="ctag ctag-ok">✓ 完全相同</span>' : ''}
    </div>`;

  // 5 device tabs
  html += `<div class="dev-tabs">` +
    DEVICE_TABS.map(tab => {
      const cnt     = countTabPairs(tableData, tab.key);
      const isActive = activeDeviceTab === tab.key;
      return `<button class="dev-tab-btn${isActive ? ' active' : ''}"
        style="${isActive ? `background:${tab.bg};border-color:${tab.color};color:${tab.color}` : ''}"
        onclick="switchTab('${tab.key}')">
        <span class="tab-icon">${tab.icon}</span>
        <span class="tab-label">${tab.label}</span>
        ${cnt ? `<span class="tab-cnt">${cnt}</span>` : ''}
      </button>`;
    }).join('') + `</div>`;

  html += renderDeviceTabContent(activeDeviceTab, tableData);
  html += `</div>`;

  document.getElementById('compareBody').innerHTML = html;
}

function renderDeviceTabContent(tabKey, tableData) {
  const tab      = DEVICE_TABS.find(t => t.key === tabKey);
  const tabTables = getPairsForTab(tableData, tabKey);

  if (!tabTables.length) {
    return `<div class="tab-empty">
      <div style="font-size:38px;opacity:.4">${tab?.icon || '📋'}</div>
      <div class="ph-desc" style="margin-top:8px">此類別無資料</div>
    </div>`;
  }

  // Use first header that actually has column labels; fall back to any table in full dataset
  const headerForMap =
    tabTables.find(t => detectColMap(t.header || []).memberPrice >= 0 || detectColMap(t.header || []).promoPrice >= 0)?.header ||
    tableData.find(t => detectColMap(t.header || []).memberPrice >= 0 || detectColMap(t.header || []).promoPrice >= 0)?.header ||
    tabTables[0]?.header || [];
  const colMap   = detectColMap(headerForMap);
  const tabColor = tab?.color || '#6b7280';

  // Each table processed separately so its header seeds the product-name propagation
  const filled    = tabTables.flatMap(t => fillMergedNames(t.pairs, colMap, t.header));
  const allRematched = rematchPairsByName(filled, colMap);

  // Remove cross-table pairing artifacts: rows dragged into the wrong tab by positional diff
  // (e.g. an AirPods rowA paired with a Watch rowB shows up in Watch tab via dominant-tab logic)
  const rematched = (tabKey === 'all') ? allRematched : allRematched.filter(p => {
    const detA = detectDeviceTab(p.rowA);
    const detB = detectDeviceTab(p.rowB);
    if (tabKey === '配件') {
      // Accept rows tagged as 配件 or with no keyword match (pure-accessory tables)
      const okA = detA === '配件' || detA === null;
      const okB = detB === '配件' || detB === null;
      return okA && okB;
    }
    return detA === tabKey || detB === tabKey;     // named tab: at least one side matches
  });

  // Collect unique model names for dropdown (skip pure category-header rows, normalize color suffix)
  const models = new Set();
  for (const p of rematched) {
    const d = parseRowData(p.rowA || p.rowB, colMap);
    const hasPrice = d?.originalPrice || d?.memberPrice || d?.promoPrice || d?.discount;
    if (d?.name && hasPrice) models.add(stripColorSuffix(d.name));
  }

  let html = `<div class="tab-content" style="border-color:${tab?.border || '#e5e7eb'}">
    <div class="model-filter-bar">
      <span class="model-filter-icon" style="color:${tabColor}">${tab?.icon}</span>
      <span class="model-filter-title" style="color:${tabColor}">${tab?.label} — 篩選機型</span>
      <select class="model-sel" onchange="filterModel(this.value)">
        <option value="all">全部機型</option>
        ${[...models].map(m =>
          `<option value="${esc(m)}"${activeModelFilter === m ? ' selected' : ''}>${esc(m)}</option>`
        ).join('')}
      </select>
    </div>`;

  html += `<div class="tscroll">
    <table class="struct-tbl">
      <thead>
        <tr>
          <th class="sc-name" rowspan="2">品名 / 容量</th>
          <th colspan="5" class="sc-doc-hd sc-a-hd">📄 ${esc(lastCompRecNames[0])}</th>
          <th colspan="5" class="sc-doc-hd sc-b-hd">📄 ${esc(lastCompRecNames[1])}</th>
          <th class="sc-rec" rowspan="2">推薦</th>
        </tr>
        <tr>
          <th class="sc-sub sc-a-sub">原始價格</th>
          <th class="sc-sub sc-a-sub">活動價格</th>
          <th class="sc-sub sc-a-sub">折讓</th>
          <th class="sc-sub sc-a-sub">促銷價</th>
          <th class="sc-sub sc-a-sub gift-hd">活動贈品</th>
          <th class="sc-sub sc-b-sub">原始價格</th>
          <th class="sc-sub sc-b-sub">活動價格</th>
          <th class="sc-sub sc-b-sub">折讓</th>
          <th class="sc-sub sc-b-sub">促銷價</th>
          <th class="sc-sub sc-b-sub gift-hd">活動贈品</th>
        </tr>
      </thead>
      <tbody>`;

  let winsA = 0, winsB = 0, sameCnt = 0, totalCmp = 0;

  for (const p of rematched) {
      // Skip color-only changes
      if (p.status === 'changed' && isColorOnlyDiff(p.rowA, p.rowB)) continue;

      const dA = parseRowData(p.rowA, colMap);
      const dB = parseRowData(p.rowB, colMap);
      const displayName    = (dA?.name || dB?.name || '').trim();
      const displayNameKey = stripColorSuffix(displayName);
      const displayCap     = (dA?.capacity || dB?.capacity || '').trim();

      // Skip pure category-header rows (name only, no price data at all)
      const hasAnyPrice = dA?.originalPrice || dA?.memberPrice || dA?.promoPrice ||
                          dB?.originalPrice || dB?.memberPrice || dB?.promoPrice;
      if (!hasAnyPrice && !dA?.discount && !dB?.discount) continue;

      if (activeModelFilter !== 'all' && displayNameKey !== activeModelFilter) continue;

      // Recommendation
      let recHtml = '', recCls = '';
      if (p.rowA && p.rowB) {
        totalCmp++;
        const an = compareRowPair(dA, dB);
        if (an.winner === 'A') {
          winsA++;
          recHtml = `<div class="rec-badge rec-a">💡 推薦 A</div>`;
          if (an.reason) recHtml += `<div class="rec-reason">${esc(an.reason)}</div>`;
          recCls = 'sc-rec-a';
        } else if (an.winner === 'B') {
          winsB++;
          recHtml = `<div class="rec-badge rec-b">💡 推薦 B</div>`;
          if (an.reason) recHtml += `<div class="rec-reason">${esc(an.reason)}</div>`;
          recCls = 'sc-rec-b';
        } else {
          sameCnt++;
          recHtml = `<div class="rec-same">✓ 相同</div>`;
        }
      } else if (!p.rowA) {
        recHtml = `<div class="rec-only-b">B 新增</div>`;
        recCls  = 'sc-rec-b';
      } else {
        recHtml = `<div class="rec-only-a">A 移除</div>`;
        recCls  = 'sc-rec-a';
      }

      // Highlight which side has the better promo price
      const toNum = s => { const n = parseInt(String(s || '').replace(/[^0-9]/g, '') || '0'); return n >= 100 ? n : null; };
      const pA = toNum(dA?.promoPrice) || toNum(dA?.memberPrice);
      const pB = toNum(dB?.promoPrice) || toNum(dB?.memberPrice);
      const aIsBest = pA && pB && pA < pB;
      const bIsBest = pA && pB && pB < pA;

      const trCls = p.status === 'same'   ? 'row-eq'
                  : p.status === 'only-a' ? 'row-rem'
                  : p.status === 'only-b' ? 'row-add'
                  : 'row-chg';

      const nameCell = displayCap
        ? `${esc(displayName)}<div class="cap-tag">${esc(displayCap)}</div>`
        : esc(displayName);

      const aPromoStr = dA?.promoPrice || '';
      const bPromoStr = dB?.promoPrice || '';
      const giftA     = dA?.gift || '';
      const giftB     = dB?.gift || '';
      const giftDiff  = p.rowA && p.rowB && giftA !== giftB;

      const cv = v => v ? esc(v) : '<span class="cv-none">—</span>';

      html += `<tr class="${trCls}">
        <td class="sc-name-cell">${nameCell || '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-a-cell orig-cell">${dA ? cv(dA.originalPrice) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-a-cell">${dA ? cv(dA.memberPrice) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-a-cell disc-cell">${dA ? cv(dA.discount) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-a-cell promo-cell${aIsBest ? ' best-price' : ''}">${dA ? cv(aPromoStr) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-a-cell gift-cell${giftDiff && giftA ? ' gift-diff' : ''}">${dA ? cv(giftA) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-b-cell orig-cell">${dB ? cv(dB.originalPrice) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-b-cell">${dB ? cv(dB.memberPrice) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-b-cell disc-cell">${dB ? cv(dB.discount) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-b-cell promo-cell${bIsBest ? ' best-price' : ''}">${dB ? cv(bPromoStr) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-cell sc-b-cell gift-cell${giftDiff && giftB ? ' gift-diff' : ''}">${dB ? cv(giftB) : '<span class="cv-none">—</span>'}</td>
        <td class="sc-rec-cell ${recCls}">${recHtml}</td>
      </tr>`;
  }

  html += `</tbody></table></div>`;

  // Bottom recommendation summary
  if (totalCmp > 0) {
    let sumText, sumColor;
    if (winsA > winsB) {
      sumText  = `🏆 整體推薦「${esc(lastCompRecNames[0])}」— ${winsA}/${totalCmp} 個${tab?.label}項目具價格優勢`;
      sumColor = '#dc2626';
    } else if (winsB > winsA) {
      sumText  = `🏆 整體推薦「${esc(lastCompRecNames[1])}」— ${winsB}/${totalCmp} 個${tab?.label}項目具價格優勢`;
      sumColor = '#2563eb';
    } else if (sameCnt === totalCmp) {
      sumText  = `✓ 兩份文件的 ${tab?.label} 活動條件完全相同`;
      sumColor = '#16a34a';
    } else {
      sumText  = `A 勝 ${winsA} 項 · B 勝 ${winsB} 項 · ${sameCnt} 項相同`;
      sumColor = '#6b7280';
    }
    html += `<div class="rec-summary" style="border-left:4px solid ${sumColor};background:${sumColor}14">
      <span style="color:${sumColor};font-weight:700;font-size:13px">${sumText}</span>
    </div>`;
  }

  html += `</div>`; // .tab-content
  return html;
}

function switchTab(tabKey) {
  activeDeviceTab   = tabKey;
  activeModelFilter = 'all';
  if (lastCompData) renderCompResult(lastCompData);
}

function filterModel(val) {
  activeModelFilter = val;
  if (lastCompData) renderCompResult(lastCompData);
}

// ── Price analysis helpers ──────────────────────
function extractNums(row) {
  const text = (row || []).map(c => c || '').join(' ');
  return (text.match(/-?[\d,]+/g) || [])
    .map(s => parseInt(s.replace(/,/g, ''), 10))
    .filter(n => !isNaN(n) && n !== 0);
}

function lowestPrice(nums) {
  const prices = nums.filter(n => n >= 1000);
  return prices.length ? Math.min(...prices) : null;
}

function isPromo(row) {
  const text = (row || []).map(c => c || '').join(' ');
  return PROMO_KEYS.some(k => text.includes(k));
}

function stripColorWords(text) {
  let s = String(text || '');
  for (const c of COLOR_WORDS) s = s.replace(new RegExp(c, 'g'), '');
  return s.replace(/\s+/g, ' ').trim();
}

function isColorOnlyDiff(rowA, rowB) {
  const normalize = row => (row || []).map(c => stripColorWords(String(c || ''))).join('|');
  return normalize(rowA) === normalize(rowB);
}

// Extract numeric credit value from gift text (配件金/抵用金/折抵 only)
function extractCreditValue(giftStr) {
  const s = String(giftStr || '');
  if (!/配件金|抵用金|折抵/.test(s)) return 0;
  const nums = s.match(/[\d,]{3,}/g);
  if (!nums) return 0;
  const val = Math.max(...nums.map(n => parseInt(n.replace(/,/g, ''), 10)));
  return val >= 100 ? val : 0;
}

function compareRowPair(dA, dB) {
  const toNum = s => {
    const n = parseInt(String(s || '').replace(/[^0-9]/g, '') || '0');
    return n >= 100 ? n : null;
  };

  const pA = toNum(dA?.promoPrice) || toNum(dA?.memberPrice) || toNum(dA?.originalPrice);
  const pB = toNum(dB?.promoPrice) || toNum(dB?.memberPrice) || toNum(dB?.originalPrice);

  const gA = (dA?.gift || '').trim();
  const gB = (dB?.gift || '').trim();

  const creditA = extractCreditValue(gA);
  const creditB = extractCreditValue(gB);

  let reason = '', winner = null;

  // Step 1: compare actual prices (no credit subtraction)
  if (pA != null && pB != null && pA !== pB) {
    const diff = `$${Math.abs(pA - pB).toLocaleString()}`;
    if (pA < pB) { winner = 'A'; reason = `A 省 ${diff}`; }
    else          { winner = 'B'; reason = `B 省 ${diff}`; }
  } else if (pA || pB) {
    reason = '售價相同';
  }

  // Step 2: 配件金 tiebreaker — more credit = better deal
  if (creditA !== creditB) {
    const more = creditA > creditB ? 'A' : 'B';
    const hi   = Math.max(creditA, creditB);
    const lo   = Math.min(creditA, creditB);
    reason += (reason ? '，' : '') +
      `${more} 配件金較多（$${hi.toLocaleString()} > $${lo.toLocaleString()}），較為划算`;
    if (!winner) winner = more;
  }

  // Step 3: physical gift tiebreaker (保護貼/保護殼 etc.)
  const physicalA = gA && creditA === 0;
  const physicalB = gB && creditB === 0;
  if (physicalA && !physicalB) { reason += (reason ? '，' : '') + `A 附贈 ${gA}`; if (!winner) winner = 'A'; }
  if (physicalB && !physicalA) { reason += (reason ? '，' : '') + `B 附贈 ${gB}`; if (!winner) winner = 'B'; }

  return { reason, winner };
}

// ═══════════════════════════════════════════════
//  BLOCK 4 — SUGGESTIONS
// ═══════════════════════════════════════════════
function generateProductSuggestions(compData) {
  const { table_diff } = compData;
  const tableData = extractTablePairs(table_diff);

  const priceWins = [];    // { name, winner, reason }
  const newItems  = [];    // { name, priceStr }
  const removedItems = []; // { name }

  for (const { header, pairs } of tableData) {
    const colMap   = detectColMap(header);
    const rematched = rematchPairsByName(fillMergedNames(pairs, colMap, header), colMap);

    for (const p of rematched) {
      const dA = parseRowData(p.rowA, colMap);
      const dB = parseRowData(p.rowB, colMap);
      const name = (dA?.name || dB?.name || '').trim();
      if (!name || /^[\d,]+$/.test(name)) continue;

      if (p.status === 'only-b') {
        const pr = dB?.promoPrice || dB?.memberPrice || '';
        newItems.push({ name, priceStr: pr ? `促銷價 $${pr}` : '' });
      } else if (p.status === 'only-a') {
        removedItems.push({ name });
      } else if (p.status === 'changed') {
        const an = compareRowPair(dA, dB);
        if (an.winner) priceWins.push({ name, winner: an.winner, reason: an.reason });
      }
    }
  }

  const cards = [];

  for (const c of priceWins.slice(0, 5)) {
    const icon  = c.winner === 'A' ? '🔴' : '🔵';
    const label = c.winner === 'A' ? 'A 活動' : 'B 活動';
    cards.push({
      tag:   '品相推薦',
      color: c.winner === 'A' ? 'orange' : 'blue',
      text:  `${icon} ${c.name}：${c.reason}，建議選 ${label}`,
    });
  }

  for (const item of newItems.slice(0, 3)) {
    cards.push({
      tag:   '新增品項',
      color: 'purple',
      text:  `🆕 ${item.name}${item.priceStr ? '，' + item.priceStr : ''}（B 活動新增，可向客戶推薦）`,
    });
  }

  if (removedItems.length) {
    const names = removedItems.slice(0, 3).map(r => r.name).join('、');
    cards.push({
      tag:   '下架提醒',
      color: 'orange',
      text:  `⚠️ 下架品項請勿推薦：${names}${removedItems.length > 3 ? ' 等' : ''}`,
    });
  }

  if (cards.length === 0) {
    cards.push({
      tag:   '活動相同',
      color: 'blue',
      text:  `✓ 兩份活動條件完全相同，所有品項優惠不變`,
    });
  }

  return cards;
}

// ── Per-category sales talking points ─────────────────────────────────────
const SALES_TIPS = {
  iPhone: [
    { tag: '📱 iPhone 換機話術', text: '「請問您現在用的是哪款 iPhone？如果超過 3 年了，這次換新機效能和相機都大升級，加上活動折讓，現在換是最划算的時機！」' },
    { tag: '📱 iPhone 搭售提示', text: '記得搭配保護殼和保護貼一起推薦，新機保護好才不用擔心維修費，這次配件也有活動優惠，一起帶走！' },
  ],
  iPad: [
    { tag: '📲 iPad 情境話術', text: '「您平常需要帶電腦出門嗎？iPad 搭配巧控鍵盤，開會上課超方便，比筆電輕很多，而且這次活動搭配購買還有優惠！」' },
    { tag: '📲 iPad 搭售提示', text: '有 Apple Pencil 優惠時，強調手寫筆記、簽文件、繪圖的使用情境；學生族群和創作者特別有共鳴，可以主動詢問。' },
  ],
  Mac: [
    { tag: '💻 Mac 效能話術', text: '「您現在用的電腦會不會開程式很慢？M 系列 Mac 效能大幅提升，開多個應用程式也很流暢，電池還可以用一整天，非常適合長時間工作的人！」' },
    { tag: '💻 Mac 學生方案', text: '可以詢問客戶是否為學生或教師身份，搭配 Apple 教育商店折扣，優惠幅度更大，可以幫客戶試算看看。' },
  ],
  Watch: [
    { tag: '⌚ Watch 健康話術', text: '「您有在注意自己的健康狀況嗎？Apple Watch 可以偵測心率、血氧、睡眠品質，還有跌倒偵測功能，非常適合推薦給家中長輩！」' },
    { tag: '⌚ Watch 送禮推薦', text: 'Apple Watch 是很受歡迎的生日、節慶禮物首選，可以主動詢問客戶最近是否有送禮需求，並強調健康管理和時尚兼具的特點。' },
  ],
  配件: [
    { tag: '🔌 配件搭售話術', text: '「新機一定要配保護殼和保護貼，這次配件也有活動優惠，一起買最划算！不然摔了或螢幕刮傷，維修費比保護殼貴多了！」' },
    { tag: '🎧 AirPods 推薦', text: '「您有無線耳機嗎？AirPods 搭配 iPhone 連線超流暢，還有主動降噪功能，這次有活動價，一起帶走是最好的搭配！」' },
  ],
};

function detectActiveCats(compData) {
  const { table_diff } = compData;
  const found = new Set();
  const CAT_MAP = [
    ['iPhone', ['iPhone']],
    ['iPad',   ['iPad']],
    ['Mac',    ['Mac', 'MacBook', 'iMac', 'MBA', 'MBP']],
    ['Watch',  ['Watch', 'Apple Watch']],
    ['配件',   ['AirPods', 'Beats', 'MagSafe', '保護殼', '保護貼', '鍵盤', 'Keyboard',
                '線材', '傳輸線', '充電線', 'Apple Pencil', '雙面夾', '卡套', '掛繩', '耳機']],
  ];
  for (const t of (table_diff || [])) {
    const allRows = [
      ...(t.row_diffs || []).map(rd => rd.row),
      ...(t.rows || []),
    ];
    for (const row of allRows) {
      const text = (row || []).map(c => c || '').join(' ');
      for (const [cat, kws] of CAT_MAP) {
        if (kws.some(k => text.includes(k))) { found.add(cat); break; }
      }
    }
  }
  return ['iPhone', 'iPad', 'Mac', 'Watch', '配件'].filter(c => found.has(c));
}

async function fetchSuggestions(compData) {
  try {
    const activityCards = generateProductSuggestions(compData);
    const activeCats    = detectActiveCats(compData);
    const tipCards      = activeCats.flatMap(cat => SALES_TIPS[cat] || [])
                           .map(t => ({ ...t, color: 'tip' }));
    renderSuggestions(activityCards, tipCards);
  } catch { showDefaultSuggestions(); }
}

function renderSuggestions(cards, tipCards = []) {
  sugTexts = [...cards, ...tipCards].map(c => c.text);
  const copyIdx = (i) => i; // index into sugTexts

  const renderCard = (c, i) => `
    <div class="sug-card c-${c.color || 'orange'}">
      <div class="sug-tag">${esc(c.tag)}</div>
      <div class="sug-text">${esc(c.text)}</div>
      <button class="sug-copy" onclick="copySug(this,${i})">複製</button>
    </div>`;

  const tipSection = tipCards.length ? `
    <div class="sug-section-hd">💬 銷售話術參考</div>
    ${tipCards.map((c, i) => renderCard(c, cards.length + i)).join('')}` : '';

  document.getElementById('suggestBody').innerHTML =
    `<div class="sug-list">` +
    cards.map(renderCard).join('') +
    tipSection +
    `</div>`;
}

function showDefaultSuggestions() {
  const defaults = [
    { tag: '使用說明', color: 'blue',   text: '📌 上傳兩份活動 PDF 後，系統將自動分析價格差異並產生本次活動賣點，方便直接分享給客戶。' },
    { tag: '分享提醒', color: 'green',  text: '✅ 比較完成後，此處會顯示：降價品項、新增優惠、最大折讓品項等重點，點擊「複製」可直接傳送。' },
    { tag: '操作步驟', color: 'purple', text: '① 上傳文件A（舊活動）與文件B（新活動）→ ② 點擊「上傳並開始比較」→ ③ 查看賣點分析並複製分享。' },
  ];
  renderSuggestions(defaults);
}

function copySug(btn, idx) {
  const text = sugTexts[idx] || '';
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ 已複製';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = '複製'; btn.classList.remove('copied'); }, 2200);
  }).catch(() => toast('請手動長按選取複製', 'error'));
}

// ═══════════════════════════════════════════════
//  BLOCK 3 — HISTORY
// ═══════════════════════════════════════════════
async function loadRecords(search = '') {
  try {
    const url = search ? `${API}/records?q=${encodeURIComponent(search)}` : `${API}/records`;
    const res = await fetch(url);
    allRecords = await res.json();
    renderHistory();
    document.getElementById('totalRec').textContent = allRecords.length;
  } catch { toast('載入記錄失敗', 'error'); }
}

function renderHistory() {
  const list = document.getElementById('histList');
  if (!allRecords.length) {
    list.innerHTML = `<div class="placeholder" style="min-height:120px">
      <div class="ph-ico">📂</div><div class="ph-title">尚無記錄</div>
      <div class="ph-desc">請先上傳 PDF 文件</div></div>`;
    return;
  }
  list.innerHTML = allRecords.map(r => {
    const isA = histPickIds[0] === r.id, isB = histPickIds[1] === r.id;
    const cls = isA ? ' sel-a' : isB ? ' sel-b' : '';
    return `
      <div class="hist-card${cls}" onclick="toggleHistPick(${r.id})">
        <input type="checkbox" class="hist-cb" ${(isA || isB) ? 'checked' : ''}
               onclick="event.stopPropagation(); toggleHistPick(${r.id})">
        <div class="hist-info">
          <div class="hist-name">${esc(r.name)}${r.tables_count === 0 ? ' <span class="no-data-badge">⚠ 無資料</span>' : ''}</div>
          <div class="hist-date">🕐 ${fmtDate(r.upload_time)}${r.tables_count > 0 ? ` &nbsp;·&nbsp; ${r.tables_count} 張表格` : ''}</div>
          ${r.notes ? `<div class="hist-note">📌 ${esc(r.notes)}</div>` : ''}
        </div>
        ${isA ? '<span class="sel-badge sel-badge-a">A</span>' : ''}
        ${isB ? '<span class="sel-badge sel-badge-b">B</span>' : ''}
        <button class="hist-del" onclick="delRecord(event,${r.id})">🗑</button>
      </div>`;
  }).join('');
}

function toggleHistPick(id) {
  if (histPickIds.includes(id)) { histPickIds = histPickIds.filter(x => x !== id); }
  else { if (histPickIds.length >= 2) histPickIds.shift(); histPickIds.push(id); }
  renderHistory(); refreshHistUI();
}

function refreshHistUI() {
  const btn = document.getElementById('histCmpBtn');
  const sub = document.getElementById('histSub');
  if (histPickIds.length === 2) {
    btn.style.display = 'inline-block'; sub.textContent = '已選取 2 筆，點擊比較 →';
  } else if (histPickIds.length === 1) {
    btn.style.display = 'none'; sub.textContent = '已選 1 筆，再選 1 筆即可比較';
  } else {
    btn.style.display = 'none'; sub.textContent = '查詢過去上傳的所有文件';
  }
}

async function doHistCompare() {
  if (histPickIds.length !== 2) return;
  setCompLoading();
  try {
    await runCompare(histPickIds[0], histPickIds[1]);
    toast('比較完成！', 'success');
  } catch (e) {
    setCompError(e.message); toast('比較失敗：' + e.message, 'error');
  }
}

async function delRecord(e, id) {
  e.stopPropagation();
  if (!confirm('確定刪除此記錄？此操作無法復原。')) return;
  try {
    await fetch(`${API}/records/${id}`, { method: 'DELETE' });
    histPickIds = histPickIds.filter(x => x !== id);
    refreshHistUI(); await loadRecords(); toast('記錄已刪除', 'success');
  } catch { toast('刪除失敗', 'error'); }
}

// ── Utilities ──────────────────────────────────
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('zh-TW', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit',
  });
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

let toastTimer;
function toast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ═══════════════════════════════════════════════
//  MAIN TABS + PDF BOARDS  (教育價活動 / 貨號表)
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  ['edu', 'sku'].forEach(setupDoc);
  const q = document.getElementById('eduQuery');
  if (q) {
    q.addEventListener('input', debounce(() => {
      document.getElementById('eduClear').style.display = q.value ? 'block' : 'none';
      loadEduProducts(q.value.trim());
    }, 220));
    // 點/聚焦搜尋框 → 若上一筆還在，清空回到初始查詢畫面，可立即重新搜尋
    const resetOnTap = () => {
      if (q.value) {
        q.value = '';
        document.getElementById('eduClear').style.display = 'none';
        loadEduProducts('');
      }
    };
    q.addEventListener('focus', resetOnTap);
    q.addEventListener('click', resetOnTap);
  }
});

function switchView(view) {
  document.querySelectorAll('.mtab')
    .forEach(b => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view')
    .forEach(s => s.classList.toggle('active', s.id === 'view-' + view));
  if (view === 'edu') { loadDoc('edu'); loadEduProducts(document.getElementById('eduQuery').value.trim()); }
  if (view === 'sku') { loadDoc('sku'); }
}

function setupDoc(cat) {
  const input = document.getElementById(cat + 'File');
  input.addEventListener('change', () => {
    if (input.files[0]) uploadDoc(cat, input.files[0]);
    input.value = '';
  });
}

async function loadDoc(cat) {
  const body = document.getElementById(cat + 'Body');
  try {
    const res  = await fetch(`${API}/docs/${cat}`);
    const meta = await res.json();
    renderDoc(cat, meta);
  } catch {
    body.innerHTML = `<div class="placeholder"><div class="ph-ico">⚠️</div>
      <div class="ph-title">載入失敗</div><div class="ph-desc">請重新整理頁面再試</div></div>`;
  }
}

function renderDoc(cat, meta) {
  const sub  = document.getElementById(cat + 'Sub');
  const body = document.getElementById(cat + 'Body');
  if (meta && meta.exists) {
    sub.textContent = `目前檔案：${meta.name} · ${fmtDate(meta.upload_time)}`;
    const src = `${API}/docs/${cat}/file?t=${encodeURIComponent(meta.upload_time)}`;
    body.innerHTML = `
      <div class="pdf-toolbar">
        <span class="pdf-fname">${esc(meta.name)}</span>
        <div class="pdf-actions">
          <a class="pdf-btn" href="${src}" target="_blank" rel="noopener">🔍 全螢幕開啟</a>
          <a class="pdf-btn" href="${src}" download="${esc(meta.name)}">⬇ 下載</a>
        </div>
      </div>
      <div class="pdf-scroll" id="${cat}Scroll">
        <div class="doc-uploading"><div class="spin"></div><div>載入 PDF 中…</div></div>
      </div>`;
    renderPdf(cat, src).catch(() => {
      // Fallback if PDF.js unavailable: native iframe (best-effort) + clear hint
      const sc = document.getElementById(cat + 'Scroll');
      if (sc) sc.innerHTML =
        `<iframe class="doc-frame" src="${src}" title="${esc(meta.name)}"></iframe>`;
    });
  } else {
    sub.textContent = '尚未上傳檔案';
    body.innerHTML = `
      <div class="doc-drop" id="${cat}Drop">
        <div class="doc-drop-ico">📄</div>
        <div class="doc-drop-title">尚未上傳 PDF</div>
        <div class="doc-drop-desc">點擊下方按鈕，或將 PDF 拖曳到這裡<br>上傳後銷售人員即可直接瀏覽，舊檔會自動被取代</div>
        <button class="doc-drop-btn" onclick="document.getElementById('${cat}File').click()">⬆ 上傳 PDF</button>
      </div>`;
    wireDrop(cat);
  }
}

// PDF.js scrollable, lazy-rendered viewer — works on phones, tablets and desktop
async function renderPdf(cat, url) {
  const scroll = document.getElementById(cat + 'Scroll');
  if (!scroll || !window.pdfjsLib) throw new Error('pdfjs unavailable');

  const pdf = await pdfjsLib.getDocument({ url }).promise;
  scroll.innerHTML = '';

  const dpr     = Math.min(window.devicePixelRatio || 1, 2);
  const pad     = 24;
  const renderW = Math.min((scroll.clientWidth || 360) - pad, 900);

  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (e.isIntersecting) { obs.unobserve(e.target); drawPdfPage(e.target); }
    }
  }, { root: scroll, rootMargin: '400px 0px' });

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp1  = page.getViewport({ scale: 1 });
    const scale = renderW / vp1.width;
    const vp   = page.getViewport({ scale });
    const holder = document.createElement('div');
    holder.className = 'pdf-page';
    holder.style.width  = renderW + 'px';
    holder.style.height = vp.height + 'px';
    holder._page = page; holder._scale = scale; holder._dpr = dpr;
    scroll.appendChild(holder);
    io.observe(holder);
  }
}

async function drawPdfPage(holder) {
  const { _page: page, _scale: scale, _dpr: dpr } = holder;
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = document.createElement('canvas');
  canvas.width = vp.width; canvas.height = vp.height;
  holder.appendChild(canvas);
  try {
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  } catch { /* page render failure shouldn't break the rest */ }
}

function wireDrop(cat) {
  const zone = document.getElementById(cat + 'Drop');
  if (!zone) return;
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over'); });
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) uploadDoc(cat, e.dataTransfer.files[0]);
  });
}

async function uploadDoc(cat, file) {
  if (!file.name.toLowerCase().endsWith('.pdf')) { toast('請選擇 PDF 格式的文件', 'error'); return; }
  const body = document.getElementById(cat + 'Body');
  body.innerHTML = `<div class="doc-uploading"><div class="spin"></div><div>上傳中，請稍候…</div></div>`;
  try {
    const fd = new FormData(); fd.append('file', file);
    const res  = await fetch(`${API}/docs/${cat}`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '上傳失敗');
    if (cat === 'edu' && typeof data.parsed === 'number') {
      toast(`上傳成功！已自動建立 ${data.parsed} 筆查詢資料`, 'success');
      loadEduProducts(document.getElementById('eduQuery').value.trim());
    } else {
      toast('上傳成功！已更新為最新檔案', 'success');
    }
  } catch (e) {
    toast('上傳失敗：' + e.message, 'error');
  }
  loadDoc(cat);
}

// ── 教育價查詢 ──────────────────────────────────
async function loadEduProducts(q = '') {
  const box   = document.getElementById('eduResults');
  const count = document.getElementById('eduCount');

  // 還沒搜尋：只留搜尋框，下面不顯示任何清單
  if (!q) {
    try {
      const rows = await (await fetch(`${API}/edu-products`)).json();
      if (!rows.length) {
        count.textContent = '尚無資料';
        box.innerHTML = `<div class="edu-empty"><div class="edu-empty-ico">📄</div>
          <div class="edu-empty-title">目前沒有查詢資料</div>
          <div class="edu-empty-desc">已上傳 PDF 的話，點下方按鈕用它建立查詢清單；<br>或在下方上傳新的教育價 PDF（會自動建立）</div>
          <button class="doc-drop-btn" onclick="rebuildEdu()">🔄 從目前 PDF 建立清單</button></div>`;
      } else {
        count.textContent = '輸入品名或貨號開始查詢';
        box.innerHTML = '';
      }
    } catch {
      count.textContent = '輸入品名或貨號開始查詢';
      box.innerHTML = '';
    }
    return;
  }

  try {
    const rows = await (await fetch(`${API}/edu-products?q=${encodeURIComponent(q)}`)).json();
    renderEduProducts(rows, q);
  } catch {
    box.innerHTML = `<div class="edu-empty"><div class="edu-empty-ico">⚠️</div>
      <div class="edu-empty-title">載入失敗</div><div class="edu-empty-desc">請重新整理頁面再試</div></div>`;
  }
}

function renderEduProducts(rows, q) {
  const box   = document.getElementById('eduResults');
  const count = document.getElementById('eduCount');

  if (!rows.length) {
    count.textContent = '查無資料';
    box.innerHTML = `<div class="edu-empty"><div class="edu-empty-ico">🔍</div>
      <div class="edu-empty-title">查無「${esc(q)}」的資料</div>
      <div class="edu-empty-desc">換個品名或貨號關鍵字試試</div>
      <button class="edu-reset-btn" onclick="clearEduQuery()">🔄 重新查詢</button></div>`;
    return;
  }

  const CAP   = 300;
  const shown = rows.slice(0, CAP);
  count.textContent = `找到 ${rows.length} 筆`;

  const amt = v => { v = String(v || '').trim(); return v ? '$' + v : '—'; };
  const hl  = v => esc(String(v || '')).replace(
    new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
    '<mark class="edu-hit">$1</mark>');

  box.innerHTML = `
    <div class="edu-tbl-wrap">
      <table class="edu-tbl">
        <thead><tr>
          <th>品名</th><th>貨號</th><th>折抵金額</th><th>全額貨號</th>
        </tr></thead>
        <tbody>
          ${shown.map(r => `<tr>
            <td class="edu-name">${hl(r.name) || '—'}</td>
            <td class="edu-code">${hl(r.code) || '—'}</td>
            <td class="edu-disc">${amt(r.discount)}</td>
            <td class="edu-full">${hl(r.full_code) || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${rows.length > CAP ? `<div class="edu-note">符合 ${rows.length} 筆，顯示前 ${CAP} 筆，請縮小關鍵字</div>` : ''}
    <div class="edu-reset-row"><button class="edu-reset-btn" onclick="clearEduQuery()">🔄 重新查詢</button></div>`;
}

function clearEduQuery() {
  const q = document.getElementById('eduQuery');
  q.value = '';
  document.getElementById('eduClear').style.display = 'none';
  loadEduProducts('');
  q.focus();
}

async function rebuildEdu() {
  const box = document.getElementById('eduResults');
  box.innerHTML = `<div class="doc-uploading"><div class="spin"></div><div>解析 PDF 中，請稍候…</div></div>`;
  try {
    const res = await fetch(`${API}/edu-products/rebuild`, { method: 'POST' });
    const d   = await res.json();
    if (!res.ok) throw new Error(d.error || '建立失敗');
    toast(`已建立 ${d.count} 筆查詢資料`, 'success');
  } catch (e) {
    toast('建立失敗：' + e.message, 'error');
  }
  loadEduProducts('');
}

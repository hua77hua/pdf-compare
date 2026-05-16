const API = '/api';

// ── State ──────────────────────────────────────
let fileA = null, fileB = null;
let histPickIds = [];
let allRecords  = [];
let sugTexts    = [];
let lastCompData     = null;
let lastCompRecNames = ['文件A', '文件B'];
let activeDeviceTab  = 'iPhone';
let activeModelFilter = 'all';

const DEVICE_TABS = [
  { key: 'iPhone', label: 'iPhone',      icon: '📱', color: '#007AFF', bg: '#eff6ff', border: '#bfdbfe', keys: ['iPhone'] },
  { key: 'iPad',   label: 'iPad',        icon: '📲', color: '#5856D6', bg: '#f5f3ff', border: '#ddd6fe', keys: ['iPad'] },
  { key: 'Mac',    label: 'Mac',         icon: '💻', color: '#34C759', bg: '#f0fdf4', border: '#bbf7d0', keys: ['Mac', 'MacBook', 'iMac'] },
  { key: 'Watch',  label: 'Apple Watch', icon: '⌚', color: '#FF3B30', bg: '#fff1f2', border: '#fecdd3', keys: ['Watch', 'Apple Watch'] },
  { key: '配件',   label: '配件',         icon: '🔌', color: '#8B5CF6', bg: '#faf5ff', border: '#e9d5ff', keys: [] },
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
  activeDeviceTab  = 'iPhone';
  activeModelFilter = 'all';
  renderCompResult(data);
  await fetchSuggestions(data);
}

// ── Device tab detection ────────────────────────
function detectDeviceTab(row) {
  const text = (row || []).map(c => c || '').join(' ');
  for (const tab of DEVICE_TABS.slice(0, 4)) {
    if (tab.keys.some(k => text.includes(k))) return tab.key;
  }
  return null; // falls into 配件
}

function rowMatchesTab(row, tabKey) {
  const det = detectDeviceTab(row);
  return tabKey === '配件' ? !det : det === tabKey;
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
  const result = [];
  for (const { header, pairs } of tableData) {
    const filtered = pairs.filter(p => rowMatchesTab(p.rowA || p.rowB, tabKey));
    if (filtered.length) result.push({ header, pairs: filtered });
  }
  return result;
}

function countTabPairs(tableData, tabKey) {
  return tableData.reduce((sum, { pairs }) =>
    sum + pairs.filter(p => rowMatchesTab(p.rowA || p.rowB, tabKey)).length, 0);
}

// ── Column detection from header row ───────────
function detectColMap(headerRow) {
  const map = { name: -1, capacity: -1, originalPrice: -1, memberPrice: -1, discount: -1, promoPrice: -1, gift: -1 };
  (headerRow || []).forEach((cell, i) => {
    const c = String(cell || '').toLowerCase();
    if (/品名|機型|型號|model|product/.test(c)               && map.name < 0)            map.name          = i;
    if (/容量|儲存|storage|規格/.test(c)                     && map.capacity < 0)        map.capacity      = i;
    if (/促銷|最終|特惠|final|promo|活動價格|活動最終/.test(c) && map.promoPrice < 0)     map.promoPrice    = i;
    if (/折讓|折扣|discount/.test(c)                         && map.discount < 0)        map.discount      = i;
    if (/原價|定價|建議售/.test(c)                            && map.originalPrice < 0 && i !== map.promoPrice)  map.originalPrice = i;
    if (/活動.*價|會員.*價|售價/.test(c)                      && map.memberPrice < 0 && i !== map.promoPrice && i !== map.originalPrice) map.memberPrice = i;
    if (/贈品|贈送|附贈|加贈|gift|bonus|備品|附件|活動附加/.test(c) && map.gift < 0)            map.gift          = i;
  });
  return map;
}

// ── Product key for name-based row matching ──────
function productKey(row, colMap) {
  if (!row) return '';
  const cells = row.map(c => String(c ?? '').trim());
  const nameIdx = (colMap && colMap.name >= 0) ? colMap.name : 0;
  const capIdx  = (colMap && colMap.capacity >= 0) ? colMap.capacity : -1;
  const name = cells[nameIdx] || '';
  const cap  = (capIdx >= 0 && capIdx !== nameIdx) ? (cells[capIdx] || '') : '';
  const key  = (cap && cap !== name) ? `${name}__${cap}` : name;
  return (!key || /^[\d,]+$/.test(key)) ? '' : key;
}

// Re-match row pairs by product name to fix positional mismatch from difflib
function rematchPairsByName(pairs, colMap) {
  const aMap = new Map(), bMap = new Map();
  const keyOrder = [], seen = new Set();

  const addKey = k => { if (k && !seen.has(k)) { keyOrder.push(k); seen.add(k); } };

  for (const p of pairs) {
    if (p.rowA) { const k = productKey(p.rowA, colMap); addKey(k); if (k) aMap.set(k, p.rowA); }
    if (p.rowB) { const k = productKey(p.rowB, colMap); addKey(k); if (k) bMap.set(k, p.rowB); }
  }

  return keyOrder.map(k => {
    const rowA = aMap.get(k) ?? null, rowB = bMap.get(k) ?? null;
    const status = !rowA ? 'only-b' : !rowB ? 'only-a'
      : JSON.stringify(rowA) === JSON.stringify(rowB) ? 'same' : 'changed';
    return { rowA, rowB, status };
  });
}

// ── Parse a row into structured fields ──────────
function parseRowData(row, colMap) {
  if (!row) return null;
  const cells = row.map(c => String(c ?? '').trim());
  const hasMap = colMap.originalPrice >= 0 || colMap.memberPrice >= 0 || colMap.promoPrice >= 0 || colMap.discount >= 0;

  if (hasMap) {
    // Only keep a cell value as a price if it actually contains a numeric amount (3+ consecutive digits)
    const toPrice = s => /\d{3,}/.test(String(s || '').replace(/,/g, '')) ? (s || '') : '';

    // Gift: use dedicated column if found; otherwise scan remaining cells for gift keywords
    const GIFT_KW = ['保護貼', '保護殼', '插頭', '轉接線', '傳輸線', '充電線', '贈品', '附贈', '加贈', '免費', '贈送', '禮'];
    let giftVal = '';
    if (colMap.gift >= 0) {
      giftVal = cells[colMap.gift] || '';
    } else {
      const usedIdx = new Set(
        [colMap.name, colMap.capacity, colMap.originalPrice, colMap.memberPrice, colMap.discount, colMap.promoPrice]
          .filter(i => i >= 0)
      );
      cells.forEach((c, i) => {
        if (!usedIdx.has(i) && c && GIFT_KW.some(k => c.includes(k)))
          giftVal += (giftVal ? ' ' : '') + c;
      });
    }

    return {
      name:          colMap.name          >= 0 ? (cells[colMap.name]          || '') : (cells[0] || ''),
      capacity:      colMap.capacity      >= 0 ? (cells[colMap.capacity]      || '') : '',
      originalPrice: toPrice(colMap.originalPrice >= 0 ? cells[colMap.originalPrice] : ''),
      memberPrice:   toPrice(colMap.memberPrice   >= 0 ? cells[colMap.memberPrice]   : ''),
      discount:      colMap.discount      >= 0 ? (cells[colMap.discount]      || '') : '',
      promoPrice:    toPrice(colMap.promoPrice    >= 0 ? cells[colMap.promoPrice]    : ''),
      gift:          giftVal,
    };
  }

  // Heuristic extraction
  const GIFT_KWORDS = ['保護貼', '保護殼', '插頭', '轉接線', '傳輸線', '充電線', '贈品', '附贈', '加贈', '免費', '贈送', '禮'];
  const prices = [], discounts = [], nameParts = [], giftParts = [];
  cells.forEach(c => {
    if (!c) return;
    if (/^[-－][\d,]+$/.test(c)) { discounts.push(c); return; }
    const numVal = parseInt(c.replace(/[^0-9]/g, '') || '0');
    if (numVal >= 5000) { prices.push({ raw: c, val: numVal }); return; }
    if (GIFT_KWORDS.some(k => c.includes(k))) { giftParts.push(c); return; }
    nameParts.push(c);
  });
  prices.sort((a, b) => b.val - a.val);

  const capIdx = nameParts.findIndex(c => /\d+\s*[GT]B/i.test(c));
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

  const colMap   = detectColMap(tabTables[0]?.header || []);
  const tabColor = tab?.color || '#6b7280';

  // Re-match all pairs by product name to fix positional mismatch from difflib
  const rematched = rematchPairsByName(tabTables.flatMap(t => t.pairs), colMap);

  // Collect unique model names for dropdown
  const models = new Set();
  for (const p of rematched) {
    const name = getProductName(p.rowA || p.rowB, colMap);
    if (name) models.add(name);
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
      const displayName = (dA?.name || dB?.name || '').trim();
      const displayCap  = (dA?.capacity || dB?.capacity || '').trim();

      if (activeModelFilter !== 'all' && displayName !== activeModelFilter) continue;

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

function compareRowPair(dA, dB) {
  const toNum = s => {
    const n = parseInt(String(s || '').replace(/[^0-9]/g, '') || '0');
    return n >= 100 ? n : null;
  };

  // Use the final promotional price; fall back to member price then original price
  const pA = toNum(dA?.promoPrice) || toNum(dA?.memberPrice) || toNum(dA?.originalPrice);
  const pB = toNum(dB?.promoPrice) || toNum(dB?.memberPrice) || toNum(dB?.originalPrice);

  let reason = '', winner = null;

  if (pA && pB && pA !== pB) {
    const diff = `$${Math.abs(pA - pB).toLocaleString()}`;
    if (pA < pB) { reason = `A 省 ${diff}`; winner = 'A'; }
    else          { reason = `B 省 ${diff}`; winner = 'B'; }
  } else if (pA || pB) {
    reason = '售價相同';
  }

  // Gift as tiebreaker
  const gA = (dA?.gift || '').trim();
  const gB = (dB?.gift || '').trim();
  if (gA && !gB) { reason += (reason ? '，' : '') + `A 附贈 ${gA}`; if (!winner) winner = 'A'; }
  if (gB && !gA) { reason += (reason ? '，' : '') + `B 附贈 ${gB}`; if (!winner) winner = 'B'; }

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
    const rematched = rematchPairsByName(pairs, colMap);

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

async function fetchSuggestions(compData) {
  try {
    renderSuggestions(generateProductSuggestions(compData));
  } catch { showDefaultSuggestions(); }
}

function renderSuggestions(cards) {
  sugTexts = cards.map(c => c.text);
  document.getElementById('suggestBody').innerHTML =
    `<div class="sug-list">` +
    cards.map((c, i) => `
      <div class="sug-card c-${c.color || 'orange'}">
        <div class="sug-tag">${esc(c.tag)}</div>
        <div class="sug-text">${esc(c.text)}</div>
        <button class="sug-copy" onclick="copySug(this,${i})">複製</button>
      </div>`).join('') +
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
          <div class="hist-name">${esc(r.name)}</div>
          <div class="hist-date">🕐 ${fmtDate(r.upload_time)}</div>
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

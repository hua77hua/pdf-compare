// ═══════════════════════════════════════════════
//  延長保固 · 快速比較（AppleCare+ vs JC安達產物）
//  資料來源：兩份價目表 PDF（2026.09 版）。價目更新時改下面的 WC_APPLECARE / WC_JC 即可。
// ═══════════════════════════════════════════════

// AppleCare+：fee 專案費、yrs 保固年限、ded 意外損害自負額 [[說明, 金額]]、battery 電池原廠維修價、repair 其他損壞原廠維修價
const WC_IPHONE_DED = [['螢幕或背面玻璃', 900], ['其他損害', 3200]];
const WC_IPAD_DED   = [['僅螢幕', 900], ['iPad 其他損害', 3200], ['Apple Pencil 與鍵盤', 900]];
const WC_MAC_DED    = [['螢幕單獨損壞', 3200], ['其他損害', 9600]];
const WC_APPLECARE = [
  // iPhone（2 年）
  { cat: 'iPhone', name: 'iPhone 18 Pro Max', fee: 6990, yrs: 2, ded: WC_IPHONE_DED, battery: 4490, repair: '$12,290 ~ $32,690' },
  { cat: 'iPhone', name: 'iPhone 18 Pro',     fee: 6990, yrs: 2, ded: WC_IPHONE_DED, battery: 4490, repair: '$10,790 ~ $31,190' },
  { cat: 'iPhone', name: 'iPhone Air',        fee: 6990, yrs: 2, ded: WC_IPHONE_DED, battery: 4150, repair: '$10,790 ~ $26,390' },
  { cat: 'iPhone', name: 'iPhone 17 / 16',    fee: 5490, yrs: 2, ded: WC_IPHONE_DED, battery: 3350, repair: '$8,990 ~ $22,490' },
  { cat: 'iPhone', name: 'iPhone 17e',        fee: 4490, yrs: 2, ded: WC_IPHONE_DED, battery: 3350, repair: '$7,890 ~ $18,190' },
  // iPad（2 年）
  { cat: 'iPad', name: 'iPad Pro 11" (M5)', fee: 5190, yrs: 2, ded: WC_IPAD_DED, battery: 5950, repair: '$33,890 ~ $35,890' },
  { cat: 'iPad', name: 'iPad Pro 13" (M5)', fee: 5890, yrs: 2, ded: WC_IPAD_DED, battery: 6790, repair: '$38,890 ~ $40,890' },
  { cat: 'iPad', name: 'iPad Air 11" (M4)', fee: 2890, yrs: 2, ded: WC_IPAD_DED, battery: 4290, repair: '$18,290 ~ $20,490' },
  { cat: 'iPad', name: 'iPad Air 13" (M4)', fee: 3590, yrs: 2, ded: WC_IPAD_DED, battery: 4990, repair: '$23,790 ~ $25,290' },
  { cat: 'iPad', name: 'iPad mini 7th',     fee: 2490, yrs: 2, ded: WC_IPAD_DED, battery: 3990, repair: '$14,590 ~ $16,090' },
  { cat: 'iPad', name: 'iPad (A16)',        fee: 2490, yrs: 2, ded: WC_IPAD_DED, battery: 3990, repair: '$12,890 ~ $14,590' },
  // Mac（3 年）
  { cat: 'Mac', name: 'MacBook Neo 13" (A18 Pro)', fee: 4990,  yrs: 3, ded: [['螢幕單獨損壞', 1590], ['其他損害', 4990]], battery: 4890, repair: '主機、螢幕、硬碟等依原廠報價' },
  { cat: 'Mac', name: 'MacBook Pro 14"',   fee: 9490,  yrs: 3, ded: WC_MAC_DED, battery: 7410, repair: '主機、螢幕、硬碟等依原廠報價' },
  { cat: 'Mac', name: 'MacBook Pro 16"',   fee: 13490, yrs: 3, ded: WC_MAC_DED, battery: 8090, repair: '主機、螢幕、硬碟等依原廠報價' },
  { cat: 'Mac', name: 'MacBook Air 13" (M5)', fee: 6790, yrs: 3, ded: WC_MAC_DED, battery: 5790, repair: '主機、螢幕、硬碟等依原廠報價' },
  { cat: 'Mac', name: 'MacBook Air 15" (M5)', fee: 7790, yrs: 3, ded: WC_MAC_DED, battery: 6390, repair: '主機、螢幕、硬碟等依原廠報價' },
  { cat: 'Mac', name: 'iMac 24" (M4)',     fee: 5790,  yrs: 3, ded: WC_MAC_DED, battery: null, repair: '依原廠報價' },
  { cat: 'Mac', name: 'Mac mini',          fee: 3490,  yrs: 3, ded: WC_MAC_DED, battery: null, repair: '依原廠報價' },
  { cat: 'Mac', name: 'Mac Studio',        fee: 5790,  yrs: 3, ded: WC_MAC_DED, battery: null, repair: '依原廠報價' },
  { cat: 'Mac', name: 'Studio Display (2026)', fee: 4990, yrs: 3, ded: WC_MAC_DED, battery: null, repair: '依原廠報價', noJc: true },
  { cat: 'Mac', name: 'Studio Display XDR',    fee: 9990, yrs: 3, ded: WC_MAC_DED, battery: null, repair: '依原廠報價', noJc: true },
  // Watch（2 年）
  { cat: 'Watch', name: 'Apple Watch SE 3',    fee: 1690, yrs: 2, ded: [['意外損害', 2200]], battery: 3350, repair: '$6,390 ~ $7,190' },
  { cat: 'Watch', name: 'Apple Watch S12',     fee: 2590, yrs: 2, ded: [['意外損害', 2200]], battery: 3350, repair: '$9,890 ~ $20,190' },
  { cat: 'Watch', name: 'Apple Watch Ultra 4', fee: 3190, yrs: 2, ded: [['意外損害', 2500]], battery: 3350, repair: '$18,490' },
  // 音樂 / 家居（2 年；Apple TV 3 年）
  { cat: 'AirPods', name: 'AirPods 5th',   fee: 990,  yrs: 2, ded: [['意外損害', 900]], battery: null, repair: '每只 $2,290；有線充電盒 $2,290；無線充電盒 $2,690', jc: 'airpods' },
  { cat: 'AirPods', name: 'AirPods Pro 3', fee: 1290, yrs: 2, ded: [['意外損害', 900]], battery: null, repair: '每只 $2,690；充電盒 $2,990', jc: 'airpods' },
  { cat: 'AirPods', name: 'AirPods Max 2', fee: 1990, yrs: 2, ded: [['意外損害', 900]], battery: null, repair: '依原廠報價', jc: 'airpods' },
  { cat: 'AirPods', name: 'Beats',         fee: 990,  yrs: 2, ded: [['意外損害', 900]], battery: null, repair: '$2,690 ~ $3,390', noJc: true },
  { cat: 'AirPods', name: 'HomePod',       fee: 1400, yrs: 2, ded: [['意外損害', 1300]], battery: null, repair: '$8,799', noJc: true },
  { cat: 'AirPods', name: 'HomePod mini',  fee: 500,  yrs: 2, ded: [['意外損害', 500]],  battery: null, repair: '$3,189', noJc: true },
  { cat: 'AirPods', name: 'Apple TV',      fee: 720,  yrs: 3, ded: [['意外損害', 490]],  battery: null, repair: '$5,869 ~ $6,799', noJc: true },
];
const WC_CATS = [['iPhone', '📱 iPhone'], ['iPad', '📲 iPad'], ['Mac', '💻 Mac'], ['Watch', '⌚ Watch'], ['AirPods', '🎧 AirPods / 音樂']];

// JC：區間為「機器售價」；m 月繳(3年保)、y1/y2/y3 一次繳、rep 置換自負額、repair 維修自負額(僅 Mac 有金額)
const WC_JC_SMALL = [   // iPad / Watch / AirPods 共用同一張費率
  { lo: 0,     hi: 8000,  m: 69,  y1: 700,  y2: 1300, y3: 1890, rep: 1000 },
  { lo: 8001,  hi: 20000, m: 119, y1: 1200, y2: 2200, y3: 3240, rep: 2000 },
  { lo: 20001, hi: 40000, m: 189, y1: 1900, y2: 3400, y3: 5130, rep: 3000 },
  { lo: 40001, hi: 75000, m: 239, y1: 2400, y2: 4300, y3: 6480, rep: 4000 },
  { lo: 75001, hi: 95000, m: 349, y1: 3500, y2: 6500, y3: 9300, rep: 5500 },
];
const WC_JC = {
  iphone: [
    { lo: 0,     hi: 10000, m: 98,  y1: 1250, y2: 2250,  y3: 3370,  rep: 1000 },
    { lo: 10001, hi: 20000, m: 198, y1: 2480, y2: 4580,  y3: 6690,  rep: 2000 },
    { lo: 20001, hi: 35000, m: 288, y1: 3450, y2: 6220,  y3: 9310,  rep: 3000 },
    { lo: 35001, hi: 55000, m: 358, y1: 4290, y2: 7720,  y3: 11580, rep: 4500 },
    { lo: 55001, hi: 70000, m: 458, y1: 5490, y2: 9880,  y3: 14820, rep: 5500 },
    { lo: 70001, hi: 95000, m: 548, y1: 5900, y2: 11800, y3: 17600, rep: 7000 },
  ],
  ipad: WC_JC_SMALL,
  watch: WC_JC_SMALL,
  airpods: WC_JC_SMALL,
  mac: [
    { lo: 0,      hi: 50000,  m: 255, y1: 2780, y2: 4990, y3: 6990,  repair: 3000, rep: 5000 },
    { lo: 50001,  hi: 109900, m: 520, y1: 5680, y2: 9990, y3: 12490, repair: 4000, rep: 9000 },
    { lo: 109901, hi: 119900, m: 520, y1: 5680, y2: 9900, y3: null,  repair: 4000, rep: 9000, note: '限 MBP 16"' },
  ],
};

const wcState = { cat: 'iPhone', model: null, band: null };
const wcMoney = n => '$' + Number(n).toLocaleString();
const wcEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wcNorm = s => String(s).toLowerCase().replace(/[\s"”“'\-()（）\/]+/g, '');

function wcJcGroup(m) {
  if (!m || m.noJc) return null;
  if (m.jc) return m.jc;
  return { iPhone: 'iphone', iPad: 'ipad', Mac: 'mac', Watch: 'watch' }[m.cat] || null;
}
function wcBandLabel(b) {
  return `${b.lo.toLocaleString()} – ${b.hi.toLocaleString()}` + (b.note ? `（${b.note}）` : '');
}

function wcInit() {
  const root = document.getElementById('wcCats');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  document.getElementById('wcSearch').addEventListener('input', wcRenderModels);
  document.getElementById('wcPrice').addEventListener('input', wcPriceChanged);
  wcRenderCats(); wcRenderModels(); wcRenderBands(); wcRenderResult();
}

function wcRenderCats() {
  document.getElementById('wcCats').innerHTML = WC_CATS.map(([k, label]) =>
    `<button class="cur-chip${wcState.cat === k ? ' active' : ''}" onclick="wcPickCat('${k}')">${label}</button>`).join('');
}
function wcPickCat(k) {
  wcState.cat = k; wcState.model = null; wcState.band = null;
  document.getElementById('wcSearch').value = '';
  document.getElementById('wcPrice').value = '';
  wcRenderCats(); wcRenderModels(); wcRenderBands(); wcRenderResult();
}

function wcRenderModels() {
  const q = document.getElementById('wcSearch').value.trim();
  const tokens = q.split(/\s+/).map(wcNorm).filter(Boolean);
  const list = WC_APPLECARE.filter(m => tokens.length
    ? tokens.every(t => wcNorm(m.name).includes(t))     // 有搜尋就跨類別找
    : m.cat === wcState.cat);
  document.getElementById('wcModels').innerHTML = list.length
    ? list.map(m => `<button class="cur-chip${wcState.model === m ? ' active' : ''}" onclick="wcPickModel('${WC_APPLECARE.indexOf(m)}')">${wcEsc(m.name)}</button>`).join('')
    : '<span class="wc-hint">找不到這個機型</span>';
}
function wcPickModel(i) {
  wcState.model = WC_APPLECARE[+i];
  wcState.cat = wcState.model.cat;
  wcState.band = null;
  document.getElementById('wcPrice').value = '';
  wcRenderCats(); wcRenderModels(); wcRenderBands(); wcRenderResult();
}

function wcBands() {
  const g = wcJcGroup(wcState.model);
  return g ? WC_JC[g] : null;
}
function wcRenderBands() {
  const box = document.getElementById('wcBands');
  const bands = wcBands();
  if (!wcState.model) { box.innerHTML = '<span class="wc-hint">先選上面的機型</span>'; return; }
  if (!bands) { box.innerHTML = '<span class="wc-hint">JC 價目表沒有這個品項</span>'; return; }
  box.innerHTML = bands.map((b, i) =>
    `<button class="cur-chip${wcState.band === b ? ' active' : ''}" onclick="wcPickBand(${i})">${wcBandLabel(b)}</button>`).join('');
}
function wcPickBand(i) {
  wcState.band = wcBands()[i];
  wcRenderBands(); wcRenderResult();
}
function wcPriceChanged() {
  const bands = wcBands();
  const v = Number(document.getElementById('wcPrice').value);
  if (!bands || !v) return;
  const m = wcState.model;
  // 109,901 以上的區間限 MBP 16"
  wcState.band = bands.find(b => v >= b.lo && v <= b.hi && (!b.note || /16"/.test(m.name))) || null;
  wcRenderBands(); wcRenderResult();
}

function wcRenderResult() {
  const box = document.getElementById('wcResult');
  const m = wcState.model;
  if (!m) { box.innerHTML = ''; return; }
  const bands = wcBands(), b = wcState.band;
  const dedLine = m.ded.map(([l, a]) => `${wcEsc(l)} ${wcMoney(a)}`).join('<br>');
  const acRows = `
    <tr><th>保固年限</th><td>${m.yrs} 年</td><td>${bands ? '月繳 / 1 年 / 2 年 / 3 年 可選' : '—'}</td></tr>
    <tr><th>費用</th><td><b>${wcMoney(m.fee)}</b>（${m.yrs} 年）</td><td>${b ? wcJcPriceHtml(b) : '<span class="wc-hint">選售價區間後顯示</span>'}</td></tr>
    <tr><th>每年均攤</th><td>${wcMoney(Math.round(m.fee / m.yrs))} /年</td><td>${b && b['y' + m.yrs] ? wcMoney(Math.round(b['y' + m.yrs] / m.yrs)) + ' /年（' + m.yrs + ' 年保）' : '—'}</td></tr>
    <tr><th>意外損害自負額</th><td>${dedLine}</td><td>${b ? wcJcDedHtml(b, m) : '—'}</td></tr>
    <tr><th>電池</th><td>${m.battery ? '原廠電池維修價 ' + wcMoney(m.battery) : '—'}</td><td>${bands && m.cat !== 'Mac' ? '檢測低於 80%（不含）可置換電池（Apple 品牌）' : '—'}</td></tr>
    <tr><th>理賠次數</th><td>—</td><td>${bands ? '每年最多 3 次（3 年最高 9 次）' : '—'}</td></tr>
    <tr><th>竊盜損失</th><td>—</td><td>${bands ? '含竊盜損失（置換全新單機）' : '—'}</td></tr>
    <tr><th>沒投保的原廠維修費</th><td colspan="2">${wcEsc(m.repair)}</td></tr>`;

  box.innerHTML = `
    <div class="wc-bubble">
      <div class="wc-title">${wcEsc(m.name)}${b ? ' ・ JC 售價區間 ' + wcBandLabel(b) : ''}</div>
      <table class="wc-tbl"><thead><tr><th></th><th>🍎 AppleCare+</th><th>🛡️ JC安達產物</th></tr></thead><tbody>${acRows}</tbody></table>
    </div>
    <div class="wc-bubble wc-say"><div class="wc-say-hd">💬 給客人的重點</div>${wcSummary(m, b, bands)}</div>`;
}

function wcJcPriceHtml(b) {
  const parts = [`月繳 <b>${wcMoney(b.m)}</b>（3 年保）`, `1 年 ${wcMoney(b.y1)}`, `2 年 ${wcMoney(b.y2)}`,
                 b.y3 ? `3 年 ${wcMoney(b.y3)}` : '3 年 無'];
  return parts.join('<br>');
}
function wcJcDedHtml(b, m) {
  const lines = [];
  if (b.repair) lines.push(`維修自負額 ${wcMoney(b.repair)}`);
  else lines.push('原機維修：免自負額（依注意事項「免費原機維修」）');
  lines.push(`置換自負額 <b>${wcMoney(b.rep)}</b>`);
  return lines.join('<br>');
}

function wcSummary(m, b, bands) {
  if (!bands) return '<ul><li>JC 價目表沒有這個品項，這項只有 AppleCare+ 可選。</li>' +
    `<li>AppleCare+ ${wcMoney(m.fee)}（${m.yrs} 年），意外損害自負額 ${m.ded.map(d => wcEsc(d[0]) + ' ' + wcMoney(d[1])).join('、')}。</li></ul>`;
  if (!b) return '<ul><li>請先選上面的「機器售價區間」，我就能算出兩家的差異。</li></ul>';

  const out = [];
  const jcAt = b['y' + m.yrs];
  if (jcAt) {
    const d = jcAt - m.fee;
    out.push(d > 0 ? `同樣保 ${m.yrs} 年：<b>AppleCare+ 比較便宜 ${wcMoney(d)}</b>（${wcMoney(m.fee)} vs JC ${wcMoney(jcAt)}）。`
           : d < 0 ? `同樣保 ${m.yrs} 年：<b>JC 比較便宜 ${wcMoney(-d)}</b>（JC ${wcMoney(jcAt)} vs ${wcMoney(m.fee)}）。`
           : `同樣保 ${m.yrs} 年：兩家費用相同（${wcMoney(m.fee)}）。`);
  } else {
    out.push(`這個區間 JC 沒有 ${m.yrs} 年保；AppleCare+ ${wcMoney(m.fee)}（${m.yrs} 年）。`);
  }
  const ys = [`1 年 ${wcMoney(b.y1)}`, `2 年 ${wcMoney(b.y2)}`, b.y3 ? `3 年 ${wcMoney(b.y3)}` : null].filter(Boolean).join('、');
  out.push(`年限：AppleCare+ 固定 ${m.yrs} 年；JC 可選 ${ys}，或月繳 ${wcMoney(b.m)}（3 年保）。`);

  const acMax = Math.max(...m.ded.map(d => d[1]));
  const acMin = Math.min(...m.ded.map(d => d[1]));
  const jcDed = b.rep;
  const dd = jcDed - acMax;
  out.push(`置換／自負額：AppleCare+ ${m.ded.map(d => wcEsc(d[0]) + ' ' + wcMoney(d[1])).join('、')}；` +
    `JC 置換自負額 ${wcMoney(jcDed)}${b.repair ? '、維修自負額 ' + wcMoney(b.repair) : ''}。` +
    (dd > 0 ? ` 以最高自負額比，<b>JC 比 AppleCare+ 高 ${wcMoney(dd)}</b>。`
     : dd < 0 ? ` 以最高自負額比，<b>JC 比 AppleCare+ 低 ${wcMoney(-dd)}</b>。`
     : ' 最高自負額兩家相同。') +
    (acMin < jcDed ? ` 若只是${wcEsc(m.ded[0][0])}，AppleCare+ 僅 ${wcMoney(acMin)}。` : ''));
  out.push('JC 額外有：含竊盜損失、每年最多 3 次理賠' + (m.cat === 'Mac' ? '。' : '、電池檢測低於 80% 可置換。'));

  // 一句建議
  const acCheaper = jcAt ? jcAt - m.fee > 0 : null;
  let tip;
  if (acCheaper && dd >= 0) tip = '預算有限、重視出險自負額低 → <b>AppleCare+</b> 保費與自負額都划算；客人在意竊盜或想彈性選年限 → 推 <b>JC</b>。';
  else if (acCheaper) tip = '<b>AppleCare+</b> 保費較低，但最高自負額較高；<b>JC</b> 保費較高、出險自負額較低，且含竊盜。';
  else if (acCheaper === false && dd <= 0) tip = '<b>JC</b> 保費與自負額都較有優勢，且含竊盜與彈性年限，可優先推薦。';
  else tip = '依客人需求：想保費低選便宜的一家；在意竊盜、彈性年限選 JC；想官方直營服務選 AppleCare+。';
  out.push(`<span class="wc-tip">建議：${tip}</span>`);
  return '<ul>' + out.map(x => `<li>${x}</li>`).join('') + '</ul>' +
    '<div class="wc-foot">價格依 2026.09 版價目表；原廠維修價僅供參考，以實際報價為主。</div>';
}

document.addEventListener('DOMContentLoaded', wcInit);

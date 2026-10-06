const LIFTS = { squat: 'Squat', bench: 'Bench Press', deadlift: 'Deadlift', press: 'Strict Shoulder Press' };
const ORDER = ['press', 'deadlift', 'bench', 'squat']; // Day 1-4 per the manual
const MUSCLE = { press: 'Shoulders', deadlift: 'Back & Hamstrings', bench: 'Chest & Triceps', squat: 'Legs' };
const LOWER = { squat: true, deadlift: true };

// Deload week (week 4) is intentionally skipped; the app runs 3-week cycles.
const OPTIONS = {
  1: [
    [[65, 5], [75, 5], [85, 5]],
    [[70, 3], [80, 3], [90, 3]],
    [[75, 5], [85, 3], [95, 1]],
  ],
  2: [
    [[75, 5], [80, 5], [85, 5]],
    [[80, 3], [85, 3], [90, 3]],
    [[75, 5], [85, 3], [95, 1]],
  ],
};
const WARMUP = [[40, 5], [50, 5], [60, 3]];
const WEEK_NAMES = ['5s', '3s', '5/3/1'];
const WEEKS = WEEK_NAMES.length;

const KEY = 'wendler531';
const defaults = () => ({
  unit: 'lb', option: 1, cycle: 0, week: 1, rest: 120, phase: 'idle', pending: {},
  lifts: Object.fromEntries(Object.keys(LIFTS).map(k => [k, { tm: 0 }])),
  done: {}, sets: {}, notes: {},
});
const stored = JSON.parse(localStorage.getItem(KEY) || '{}');
let S = Object.assign(defaults(), stored);
if (stored.cycle && !stored.phase) S.phase = 'active'; // data saved before cycles were started manually
if (S.week > WEEKS) S.week = 1;
let view = 'workout';
let pick = null;
let viewWeek = S.week;
const save = () => localStorage.setItem(KEY, JSON.stringify(S));

const step = () => (S.unit === 'lb' ? 5 : 2.5);
const round = w => Math.round(w / step()) * step();
const e1rm = (w, r) => w * r * 0.0333 + w; // formula from the manual
const num = v => Math.max(0, Number(v) || 0);
const configured = () => Object.values(S.lifts).every(l => l.tm > 0);
const incFor = k => (LOWER[k] ? 2 * step() : step());

// Best estimated 1RM from the last (max-rep) set of any week in the cycle; null if none logged.
function cycleBest(k, cycle) {
  let best = null;
  for (let w = 1; w <= WEEKS; w++) {
    const v = S.sets[`${cycle}-${w}-${k}-2`];
    if (v && v.r) best = Math.max(best || 0, e1rm(v.w, v.r));
  }
  return best;
}

function nextTM(k) {
  const best = cycleBest(k, S.cycle);
  return best ? round(best * 0.9) : S.lifts[k].tm + incFor(k);
}

function estHTML(k, week = viewWeek) {
  const v = S.sets[`${S.cycle}-${week}-${k}-2`];
  if (!v || !v.r) return '';
  const est = Math.round(e1rm(v.w, v.r));
  return `Estimated 1RM: <b>${est} ${S.unit}</b> (${v.w} × ${v.r}) · next cycle training max: <b>${nextTM(k)} ${S.unit}</b>`;
}

function render() {
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const title = S.phase === 'active' ? `Cycle ${S.cycle} · Week ${S.week}` : S.cycle ? `Cycle ${S.cycle} complete` : 'No active cycle';
  document.getElementById('title').textContent = `5/3/1 · ${title}`;
  const app = document.getElementById('app');
  if (view === 'setup' || !configured()) { view = 'setup'; app.innerHTML = setupHTML(); }
  else if (view === 'history') app.innerHTML = historyHTML();
  else app.innerHTML = workoutHTML();
}

function setupHTML() {
  const rows = Object.entries(LIFTS).map(([k, name]) => `
    <div class="card">
      <h2>${name}</h2>
      <div class="row">
        <label><small>Estimated 1RM (${S.unit})</small><input type="number" inputmode="decimal" id="orm-${k}" value="${S.lifts[k].tm ? round(S.lifts[k].tm / 0.9) : ''}"></label>
        <label><small>Training max (90%)</small><input type="number" inputmode="decimal" id="tm-${k}" value="${S.lifts[k].tm || ''}"></label>
      </div>
      <div class="row">
        <label><small>Or rep max: weight</small><input type="number" inputmode="decimal" id="rw-${k}"></label>
        <label><small>reps</small><input type="number" inputmode="numeric" id="rr-${k}"></label>
        <button class="btn sec" style="width:auto;margin:0;align-self:flex-end" data-calc="${k}">Calc</button>
      </div>
    </div>`).join('');
  return `
    <p class="sub">Enter a max you could hit <b>right now</b>. The program starts from 90% of it. A rep max (80-85% for as many reps as possible) can be converted to an estimate.</p>
    <div class="card">
      <div class="row">
        <label><small>Rest timer (seconds)</small><select id="rest">${[0, 60, 90, 120, 180, 300].map(s => `<option value="${s}" ${S.rest === s ? 'selected' : ''}>${s ? s + 's' : 'Off'}</option>`).join('')}</select></label>
      </div>
      <div class="row">
        <label><small>Units</small><select id="unit"><option value="lb" ${S.unit === 'lb' ? 'selected' : ''}>lb</option><option value="kg" ${S.unit === 'kg' ? 'selected' : ''}>kg</option></select></label>
        <label><small>Percentages</small><select id="option">
          <option value="1" ${S.option == 1 ? 'selected' : ''}>Option 1 (recommended)</option>
          <option value="2" ${S.option == 2 ? 'selected' : ''}>Option 2 (harder)</option></select></label>
      </div>
    </div>
    ${rows}
    <button class="btn" id="save">Save &amp; build program</button>
    <button class="btn sec" id="reset">Reset all data</button>`;
}

function setsFor(lift, week) {
  const tm = S.lifts[lift].tm;
  return OPTIONS[S.option][week - 1].map(([p, r]) => ({ pct: p, reps: r, weight: round(tm * p / 100) }));
}

function idleHTML() {
  const rows = Object.keys(LIFTS).map(k => {
    const next = S.cycle ? (S.pending[k] || S.lifts[k].tm) : S.lifts[k].tm;
    const change = S.cycle ? `${S.lifts[k].tm} → <b>${next}</b>` : `<b>${next}</b>`;
    return `<div class="hist"><span>${LIFTS[k]}</span><span>${change} ${S.unit}</span></div>`;
  }).join('');
  const head = S.cycle ? `Cycle ${S.cycle} complete` : 'Ready to begin';
  const note = S.cycle ? 'Training maxes for the next cycle, from your estimated 1RMs:' : 'Starting training maxes:';
  return `<div class="card"><h2>${head}</h2><div class="sub">${note}</div>${rows}
    <button class="btn" id="startCycle">Start Cycle ${S.cycle + 1}</button></div>`;
}

function startCycle() {
  if (S.cycle) for (const k of Object.keys(S.lifts)) S.lifts[k].tm = S.pending[k] || S.lifts[k].tm;
  S.cycle++; S.week = 1; S.phase = 'active'; S.pending = {};
  viewWeek = 1; pick = null; save(); render(); scrollTo(0, 0);
}

let toastTimer = null;
function toast(html) {
  const el = document.getElementById('toast');
  el.innerHTML = html; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 8000);
}

function workoutHTML() {
  if (S.phase !== 'active') return idleHTML();
  const weeks = WEEK_NAMES.map((n, i) => `<button data-week="${i + 1}" class="${viewWeek === i + 1 ? 'active' : ''} ${S.week === i + 1 ? 'cur' : ''}">W${i + 1}<br><small>${n}</small></button>`).join('');
  const cards = pick
    ? `<button class="btn sec" data-pick="">← All muscles</button>${liftCard(pick, ORDER.indexOf(pick) + 1)}`
    : `<div class="picker">${ORDER.map(pickerBtn).join('')}</div>`;
  const finish = !pick && viewWeek === S.week
    ? `<button class="btn" id="finish">${S.week === WEEKS ? 'Finish cycle (raise training maxes)' : 'Finish week ' + S.week}</button>` : '';
  return `<div class="weeks">${weeks}</div>${cards}${finish}`;
}

function pickerBtn(k) {
  const sets = setsFor(k, viewWeek);
  const n = sets.filter((_, i) => S.done[`${S.cycle}-${viewWeek}-${k}-s${i}`]).length;
  return `<button data-pick="${k}"><b>${MUSCLE[k]}</b><span>${LIFTS[k]} · ${sets[2].weight} ${S.unit} top set</span><small>${n}/3 sets done</small></button>`;
}

function liftCard(k, day) {
  const sets = setsFor(k, viewWeek);
  const pre = `${S.cycle}-${viewWeek}-${k}`;
  const id = (t, i) => `${pre}-${t}${i}`;
  const warm = WARMUP.map(([p, r], i) => `
    <div class="set warm ${S.done[id('w', i)] ? 'done' : ''}" data-id="${id('w', i)}">
      <span>Warm-up ${r} × ${round(S.lifts[k].tm * p / 100)} ${S.unit}</span><button class="chk">✓</button></div>`).join('');
  const work = sets.map((s, i) => {
    const key = `${pre}-${i}`, v = S.sets[key] || {};
    const plus = i === 2 ? '+' : '';
    return `<div class="set ${S.done[id('s', i)] ? 'done' : ''}" data-id="${id('s', i)}">
      <div><div class="pct">${s.pct}% · target ${s.reps}${plus}</div>
        <div class="entry" data-key="${key}" data-rec="${s.weight}">
          <input type="number" inputmode="decimal" class="sw" value="${v.w ?? s.weight}"> ${S.unit} ×
          <input type="number" inputmode="numeric" class="sr" value="${v.r || ''}" placeholder="${s.reps}${plus}"></div></div>
      <button class="chk">✓</button></div>`;
  }).join('');
  return `<div class="card"><h2>Day ${day}: ${LIFTS[k]}</h2>
    <div class="sub">Training max ${S.lifts[k].tm} ${S.unit}</div>${warm}${work}
    <div class="est" id="est-${k}">${estHTML(k)}</div>
    <textarea data-note="${pre}" placeholder="Notes">${esc(S.notes[pre] || '')}</textarea>
    <button class="btn sec" data-reset="${k}">Reset training max from new rep max</button></div>`;
}

let timerEnd = 0, timerInt = null;
function startTimer(sec) {
  if (!sec) return;
  timerEnd = Date.now() + sec * 1000;
  const el = document.getElementById('timer');
  el.hidden = false;
  el.innerHTML = '<span class="t" id="tv"></span><button data-t="30">+30s</button><button data-t="stop">Stop</button>';
  clearInterval(timerInt);
  const tick = () => {
    const left = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    document.getElementById('tv').textContent = `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (!left) { clearInterval(timerInt); if (navigator.vibrate) navigator.vibrate(300); setTimeout(() => { el.hidden = true; }, 3000); }
  };
  tick(); timerInt = setInterval(tick, 500);
}

// Groups logged sets and notes by "cycle-week-lift", sorted oldest first.
function historyGroups() {
  const g = {};
  const grp = key => (g[key] = g[key] || { sets: [], note: '' });
  for (const [key, v] of Object.entries(S.sets)) {
    if (!v.r) continue;
    const [c, w, k, i] = key.split('-');
    grp(`${c}-${w}-${k}`).sets[+i] = v;
  }
  for (const [key, n] of Object.entries(S.notes)) if (n) grp(key).note = n;
  return Object.entries(g).map(([key, v]) => {
    const [c, w, k] = key.split('-');
    return { c: +c, w: +w, k, ...v };
  }).sort((a, b) => a.c - b.c || a.w - b.w);
}

function chartHTML(k, groups) {
  const pts = groups.filter(g => g.k === k && g.sets[2]).map(g => Math.round(e1rm(g.sets[2].w, g.sets[2].r)));
  if (pts.length < 2) return `<div class="hist"><span>${LIFTS[k]}</span><span>${pts.length ? 'est. ' + pts[0] : 'not enough data'}</span></div>`;
  const W = 300, H = 120, P = 24;
  const lo = Math.min(...pts), hi = Math.max(...pts), rng = hi - lo || 1;
  const xy = pts.map((p, i) => [P + i * (W - 2 * P) / (pts.length - 1), H - P - (p - lo) / rng * (H - 2 * P)]);
  return `<div class="sub" style="margin-top:10px">${LIFTS[k]} — est. 1RM from last set (${S.unit})</div>
    <svg class="chart" viewBox="0 0 ${W} ${H}"><polyline fill="none" stroke="#ff9f0a" stroke-width="2" points="${xy.map(p => p.join(',')).join(' ')}"/>
    ${xy.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#ff9f0a"/>`).join('')}
    <text x="4" y="${P}" fill="#8e8e93" font-size="10">${hi}</text><text x="4" y="${H - P + 10}" fill="#8e8e93" font-size="10">${lo}</text></svg>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function historyHTML() {
  const groups = historyGroups();
  if (!groups.length) return '<p class="sub">Nothing logged yet.</p>';
  const rows = [...groups].reverse().map(g => `<div class="hist" style="display:block">
    <b>C${g.c} W${g.w} · ${LIFTS[g.k]}</b><br>
    ${g.sets.map(s => s && `${s.w}×${s.r}`).filter(Boolean).join(' · ')}
    ${g.note ? `<br><small>${esc(g.note)}</small>` : ''}</div>`).join('');
  return `<div class="card"><h2>Progress</h2>${Object.keys(LIFTS).map(k => chartHTML(k, groups)).join('')}</div>
    <div class="card"><h2>Log</h2>${rows}</div>`;
}

function finishWeek() {
  if (S.week < WEEKS) S.week++;
  else {
    S.pending = Object.fromEntries(Object.keys(S.lifts).map(k => [k, nextTM(k)]));
    S.phase = 'idle'; S.week = 1;
  }
  viewWeek = S.week; pick = null; save(); render(); scrollTo(0, 0);
}

function resetLift(k) {
  const w = num(prompt(`${LIFTS[k]}: weight of your new rep max (${S.unit})`));
  const r = w && num(prompt('Reps completed at that weight'));
  if (!w || !r) return;
  const est = e1rm(w, r), tm = round(est * 0.9);
  if (confirm(`Estimated 1RM ${Math.round(est)} ${S.unit}. Set training max to ${tm} ${S.unit}?`)) {
    S.lifts[k].tm = tm; save(); render();
  }
}

document.addEventListener('click', e => {
  const t = e.target;
  if (t.dataset.view) { view = t.dataset.view; pick = null; render(); return; }
  if (t.dataset.week) { viewWeek = +t.dataset.week; pick = null; render(); return; }
  if (t.closest('[data-pick]')) { pick = t.closest('[data-pick]').dataset.pick || null; render(); scrollTo(0, 0); return; }
  if (t.dataset.reset) { resetLift(t.dataset.reset); return; }
  if (t.classList.contains('chk')) {
    const id = t.closest('.set').dataset.id; S.done[id] = !S.done[id]; save(); render();
    if (S.done[id] && !t.closest('.warm')) startTimer(S.rest);
    return;
  }
  if (t.dataset.t) {
    if (t.dataset.t === 'stop') { timerEnd = 0; clearInterval(timerInt); document.getElementById('timer').hidden = true; }
    else { timerEnd += 30000; }
    return;
  }
  if (t.dataset.calc) {
    const k = t.dataset.calc, w = num(document.getElementById('rw-' + k).value), r = num(document.getElementById('rr-' + k).value);
    if (w && r) {
      const est = Math.round(e1rm(w, r));
      document.getElementById('orm-' + k).value = est;
      document.getElementById('tm-' + k).value = round(est * 0.9);
    }
    return;
  }
  if (t.id === 'save') {
    S.unit = document.getElementById('unit').value;
    S.option = +document.getElementById('option').value;
    S.rest = +document.getElementById('rest').value;
    for (const k of Object.keys(LIFTS)) {
      const tm = num(document.getElementById('tm-' + k).value);
      if (tm) S.lifts[k].tm = tm;
    }
    if (!configured()) { alert('Enter a 1RM or training max for all four lifts.'); return; }
    view = 'workout'; save(); render(); return;
  }
  if (t.id === 'reset') {
    if (confirm('Erase all settings and history?')) { S = defaults(); viewWeek = 1; save(); render(); }
    return;
  }
  if (t.id === 'startCycle') { startCycle(); return; }
  if (t.id === 'finish') {
    if (confirm(S.week === WEEKS ? `Finish Cycle ${S.cycle}?` : `Finish week ${S.week}?`)) finishWeek();
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id && t.id.startsWith('orm-')) {
    document.getElementById('tm-' + t.id.slice(4)).value = t.value ? round(num(t.value) * 0.9) : '';
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.note) { S.notes[t.dataset.note] = t.value.trim(); save(); return; }
  const entry = t.closest('.entry');
  if (!entry) return;
  const w = num(entry.querySelector('.sw').value) || +entry.dataset.rec;
  const r = num(entry.querySelector('.sr').value);
  S.sets[entry.dataset.key] = { w, r, d: new Date().toLocaleDateString() };
  save();
  const [, wk, lift] = entry.dataset.key.split('-');
  const est = document.getElementById('est-' + lift);
  if (est) est.innerHTML = estHTML(lift, +wk);
  if (r && entry.dataset.key.endsWith('-2')) {
    toast(`<b>${LIFTS[lift]}: ${w} × ${r}</b><br>New estimated max: <b>${Math.round(e1rm(w, r))} ${S.unit}</b><br>Next cycle training max: <b>${nextTM(lift)} ${S.unit}</b>`);
  }
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

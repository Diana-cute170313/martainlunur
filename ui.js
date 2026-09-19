/* OUTPOST — user interface. All rules live in engine.js; this file only draws and dispatches. */
(function () {
  'use strict';
  const E = Engine;
  const $ = s => document.querySelector(s);
  const SAVE_KEY = 'outpost.save.v1';
  const SPEEDS = [0, 1600, 800, 320];

  let S = null, A = null, timer = null;
  const ui = { tab: 'build', placing: null, sel: null, hover: null, speed: 0, prevSpeed: 1, resume: 0, express: false, seenLog: 0, planet: 'moon', diff: 'hardened' };

  /* ---------------------------------------------------------------- icons (32x32, stroke = currentColor) */
  const ICONS = {
    hub: '<path d="M4 24a12 12 0 0 1 24 0z"/><path d="M13 24v-6h6v6"/><path d="M16 12V6"/>',
    hab: '<rect x="4" y="9" width="24" height="15" rx="5"/><circle cx="11" cy="16.5" r="1.4" fill="currentColor"/><circle cx="16" cy="16.5" r="1.4" fill="currentColor"/><circle cx="21" cy="16.5" r="1.4" fill="currentColor"/>',
    solar: '<path d="M6 21l4-12h16l-4 12z"/><path d="M8 15h16M13.5 9l-2 12M19 9l-1 12"/><path d="M16 21v6M11 27h10"/>',
    battery: '<rect x="4" y="10" width="21" height="13" rx="2"/><path d="M25 14h3v5h-3"/><path d="M15 12l-3 5h5l-3 4"/>',
    reactor: '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="2.5" fill="currentColor"/><path d="M16 13.5V6M18.2 17.2l6.5 3.7M13.8 17.2L7.3 20.9"/>',
    o2: '<circle cx="16" cy="16" r="11"/><text x="16" y="20.5" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor" stroke="none" font-family="Segoe UI,Arial">O₂</text>',
    ice: '<path d="M16 4l8 9-8 15-8-15z"/><path d="M8 13h16M13 13l3 15 3-15"/>',
    rec: '<path d="M16 5c5 6 8 9 8 13a8 8 0 0 1-16 0c0-4 3-7 8-13z"/><path d="M12.5 19a3.5 3.5 0 0 0 6 1.5"/>',
    gh: '<path d="M4 25a12 11 0 0 1 24 0z"/><path d="M16 25V14"/><path d="M16 18c-4 0-6-2-6-5 4 0 6 2 6 5zM16 16c4 0 6-2 6-5-4 0-6 2-6 5z"/>',
    mine: '<path d="M10 5h12l-3 11h-6z"/><path d="M16 16v11"/><path d="M12.5 22.5L16 27l3.5-4.5"/>',
    ws: '<circle cx="16" cy="16" r="10" stroke-width="3.2" stroke-dasharray="4 4.2"/><circle cx="16" cy="16" r="7.4"/><circle cx="16" cy="16" r="2.6"/>',
    med: '<rect x="5" y="5" width="22" height="22" rx="5"/><path d="M16 10v12M10 16h12"/>',
    recd: '<circle cx="16" cy="16" r="11"/><path d="M11 19c3 3.5 7 3.5 10 0"/><circle cx="12" cy="13" r="1.3" fill="currentColor"/><circle cx="20" cy="13" r="1.3" fill="currentColor"/>',
    comm: '<path d="M6 10a13 13 0 0 0 13 13z"/><path d="M12 17l9-9"/><circle cx="22" cy="7" r="1.6" fill="currentColor"/><path d="M11 27h9"/>',
    depot: '<rect x="5" y="15" width="10" height="10"/><rect x="17" y="15" width="10" height="10"/><rect x="11" y="6" width="10" height="9"/>'
  };
  const icon = (type, cls) => `<svg viewBox="0 0 32 32"${cls ? ` class="${cls}"` : ''}>${ICONS[type]}</svg>`;

  const TERRAIN_SVG = {
    ridge: '<svg class="ter" viewBox="0 0 32 32"><path d="M1 27L11 8l6 11 4-6 10 14z" fill="#0000004d"/><path d="M11 8l-3 5 3 2 3-2z" fill="#ffffff2e"/></svg>',
    ice: '<svg class="ter" viewBox="0 0 32 32"><path d="M6 24l5-11 5 11zM15 26l6-14 6 14z" fill="#c5e9ff" fill-opacity=".92"/><path d="M11 13l2 6M21 12l2 7" stroke="#fff" stroke-opacity=".7" stroke-width="1"/></svg>',
    ore: '<svg class="ter" viewBox="0 0 32 32"><g fill="#f0a94a"><circle cx="9" cy="20" r="3.4"/><circle cx="19" cy="12" r="3"/><circle cx="23" cy="22" r="3.6"/><circle cx="14" cy="26" r="2"/></g><g fill="#fff" fill-opacity=".45"><circle cx="8" cy="19" r="1"/><circle cx="18" cy="11" r="1"/><circle cx="22" cy="21" r="1.1"/></g></svg>'
  };
  const TERRAIN_NAME = { plain: 'Flat regolith', crater: 'Crater floor (materials +40%)', ridge: 'Rocky ridge (unbuildable)', ice: 'Ice deposit', ore: 'Ore deposit' };

  /* ---------------------------------------------------------------- small helpers */
  const fmt = n => Math.abs(n) < 10 ? n.toFixed(1) : String(Math.round(n));
  const sgn = n => (n >= 0 ? '+' : '−') + fmt(Math.abs(n));
  const pct = (v, m) => Math.max(0, Math.min(100, m > 0 ? v / m * 100 : 0));
  const setHTML = (el, html) => { if (el._h !== html) { el.innerHTML = html; el._h = html; } };
  const B = t => E.BUILDINGS[t];
  const bAt = (x, y) => E.buildingAt(S, x, y);

  function richLabel(r) { return r >= 1.3 ? 'rich' : r >= 0.95 ? 'average' : 'poor'; }
  function tileDesc(t, x, y) {
    let s = `<b>${TERRAIN_NAME[t.t]}</b>`;
    if (t.t === 'ice' || t.t === 'ore') s += ` — ${richLabel(t.r)} (×${t.r.toFixed(2)} yield)`;
    return s;
  }

  /* ---------------------------------------------------------------- save / load */
  function save() {
    try { if (S && (S.status === 'playing' || S.status === 'landing')) localStorage.setItem(SAVE_KEY, JSON.stringify(S)); else localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
  }
  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null;
      const s = JSON.parse(raw);
      return s && s.v === 1 && (s.status === 'playing' || s.status === 'landing') ? s : null;
    } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------- start screen */
  function initStart() {
    $('#diffChoices').innerHTML = Object.keys(E.DIFFS).map(k => {
      const d = E.DIFFS[k];
      return `<button class="pick" data-diff="${k}"><b>${d.name}</b><span>${d.blurb}</span></button>`;
    }).join('');
    const mark = () => {
      document.querySelectorAll('[data-planet]').forEach(b => b.classList.toggle('on', b.dataset.planet === ui.planet));
      document.querySelectorAll('[data-diff]').forEach(b => b.classList.toggle('on', b.dataset.diff === ui.diff));
      document.body.className = ui.planet;
    };
    $('#start').addEventListener('click', e => {
      const p = e.target.closest('[data-planet]'), d = e.target.closest('[data-diff]');
      if (p) ui.planet = p.dataset.planet;
      if (d) ui.diff = d.dataset.diff;
      if (p || d) mark();
    });
    $('#startBtn').onclick = () => {
      const raw = $('#seedInput').value.trim();
      let seed = 0;
      if (raw) { for (let i = 0; i < raw.length; i++) seed = (Math.imul(seed, 31) + raw.charCodeAt(i)) | 0; }
      begin(E.newGame({ planet: ui.planet, diff: ui.diff, seed }));
    };
    const sv = loadSave();
    if (sv) {
      $('#continueBtn').hidden = false;
      $('#continueBtn').textContent = `Continue: ${E.PLANETS[sv.planet].name}, day ${sv.day}`;
      $('#continueBtn').onclick = () => begin(sv);
    }
    mark();
  }

  function begin(state) {
    S = state; ui.seenLog = S.logN; ui.sel = null; ui.hover = null;
    ui.placing = S.status === 'landing' ? 'hub' : null;
    ui.tab = 'build';
    document.body.className = S.planet;
    $('#start').hidden = true; $('#app').hidden = false; $('#modal').hidden = true;
    $('#siteName').textContent = `${E.PLANETS[S.planet].name} · ${E.DIFFS[S.diff].name} · seed ${S.seed}`;
    buildMap();
    setSpeed(0);
    refresh();
    if (S.pending) showEvent();
  }

  function toStart() {
    setSpeed(0);
    $('#modal').hidden = true; $('#app').hidden = true; $('#start').hidden = false;
    const sv = loadSave();
    $('#continueBtn').hidden = !sv;
    if (sv) { $('#continueBtn').textContent = `Continue: ${E.PLANETS[sv.planet].name}, day ${sv.day}`; $('#continueBtn').onclick = () => begin(sv); }
  }

  /* ---------------------------------------------------------------- clock */
  function setSpeed(n) {
    ui.speed = n;
    if (timer) { clearInterval(timer); timer = null; }
    if (n > 0 && S && S.status === 'playing' && !S.pending) timer = setInterval(tick, SPEEDS[n]);
    document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('on', +b.dataset.speed === n));
    if (n > 0) ui.prevSpeed = n;
  }
  function advance() {
    E.step(S);
    afterStep();
  }
  function tick() { advance(); }
  function afterStep() {
    A = E.analyze(S);
    toastNew();
    if (S.pending) { ui.resume = ui.speed; setSpeed(0); showEvent(); }
    else if (S.status !== 'playing') { setSpeed(0); showEnd(); }
    save();
    render();
  }
  function refresh() { A = E.analyze(S); render(); }

  /* ---------------------------------------------------------------- map */
  function buildMap() {
    const m = $('#map'); m.innerHTML = '';
    for (let i = 0; i < E.W * E.H; i++) {
      const d = document.createElement('div');
      d.className = 'tile'; d.dataset.i = i;
      d.style.setProperty('--n', S.map[i].n);
      m.appendChild(d);
    }
  }

  function bldHTML(b, st, ghost) {
    const d = B(b.type), hp = Math.round(b.hp);
    let cls = 'bld', badge = '', label = '';
    if (ghost) cls += ' ghost';
    else if (st.status === 'building') { cls += ' building'; label = `<span class="bt">${b.ready - S.day}d</span>`; }
    else if (st.status === 'off') cls += ' off';
    else if (st.status === 'nocrew') badge = '<span class="badge">NO CREW</span>';
    else if (st.status === 'nopower') { cls += ' nopower'; badge = '<span class="badge">NO POWER</span>'; }
    if (!ghost && hp < 60) cls += hp < 25 ? ' crit' : ' hurt';
    const hpbar = ghost || st.status === 'building' ? '' : `<span class="hp"><i style="width:${hp}%"></i></span>`;
    return `<div class="${cls}" style="--c:${d.color}">${st.status === 'building' ? '' : icon(b.type)}${label}${badge}${hpbar}</div>`;
  }

  function renderMap() {
    const tiles = $('#map').children;
    const placing = ui.placing;
    for (let y = 0; y < E.H; y++) for (let x = 0; x < E.W; x++) {
      const i = y * E.W + x, el = tiles[i], t = S.map[i], b = bAt(x, y);
      let cls = `tile t-${t.t}`, inner = TERRAIN_SVG[t.t] || '';
      if (t.t === 'ice' || t.t === 'ore') inner += `<span class="rich">×${t.r.toFixed(1)}</span>`;
      const isHover = ui.hover && ui.hover.x === x && ui.hover.y === y;
      if (b) inner += bldHTML(b, A.b[b.id], false);
      if (placing && !b) {
        const c = E.canPlace(S, placing, x, y);
        if (isHover) { cls += c.ok ? ' ok' : ' bad'; inner += bldHTML({ type: placing, hp: 100, ready: 0 }, { status: 'ok' }, true); }
        else if (c.ok) cls += ' valid';
      } else if (isHover) cls += ' hov';
      if (ui.sel && ui.sel.x === x && ui.sel.y === y && !placing) cls += ' sel';
      if (el.className !== cls) el.className = cls;
      if (el._h !== inner) { el.innerHTML = inner; el._h = inner; }
    }
    const w = $('#mapwrap');
    w.classList.toggle('night', S.planet === 'moon' && !E.moonPhase(S.day).lit);
    w.classList.toggle('storm', !!E.effect(S, 'storm'));
    w.classList.toggle('halt', !!E.effect(S, 'halt'));
  }

  function renderHint() {
    const hv = ui.hover, t = hv && E.tileAt(S, hv.x, hv.y);
    let h;
    if (S.status === 'landing') {
      h = '<b>Choose your landing site.</b> Land on flat ground. Modules can only be built within 2 tiles of an existing one, so land near <b>ice</b> (blue) and <b>ore</b> (amber) deposits.';
      if (t) h += `<br>${tileDesc(t)}${t.t === 'plain' ? ' — <span class="yes">good landing zone</span>' : ' — <span class="no">cannot land here</span>'}`;
    } else if (ui.placing) {
      const d = B(ui.placing);
      h = `Placing <b>${d.name}</b>`;
      if (t) {
        const c = E.canPlace(S, ui.placing, hv.x, hv.y);
        h += c.ok ? ` — <span class="yes">click to build (${c.cost.m} mat, ${c.cost.c} cr, ${d.build} days)</span>` : ` — <span class="no">${c.reason}</span>`;
      }
      h += '<br><span class="muted">Dashed tiles are valid. Right-click or Esc cancels; Shift+click keeps placing.</span>';
    } else if (t) {
      const b = bAt(hv.x, hv.y);
      h = b ? `<b>${B(b.type).name}</b> — click to inspect` : tileDesc(t);
    } else {
      h = 'Click a module to inspect it, or choose one in the <b>Build</b> tab. Time is paused until you press ▶.';
    }
    setHTML($('#hint'), h);
  }

  /* ---------------------------------------------------------------- HUD & alerts */
  function chip(label, val, cap, net, cls, tip, frac) {
    const n = net === null ? '' : `<em class="${net >= 0 ? 'pos' : 'neg'}">${sgn(net)}/d</em>`;
    return `<div class="chip ${cls}" title="${tip}"><div class="cl"><span>${label}</span>${n}</div>` +
      `<div class="cv">${val}${cap ? `<small> / ${cap}</small>` : ''}</div>` +
      `<div class="bar"><i style="width:${frac}%"></i></div></div>`;
  }
  function stockCls(k) {
    const net = A.rates[k].net, st = S.res[k];
    if (st <= 0.05 && net < 0) return 'bad';
    if (net < 0) { const d = st / -net; return d < 5 ? 'bad' : d < 12 ? 'warn' : ''; }
    return '';
  }
  function renderHud() {
    const r = A.rates, res = S.res, P = A.power;
    const days = k => r[k].net < 0 ? ` About ${Math.floor(res[k] / -r[k].net)} days left.` : '';
    const stock = (k, label, tip) => chip(label, Math.floor(res[k]), A.cap, r[k].net, stockCls(k),
      `${tip} Production ${fmt(r[k].p)}, use ${fmt(r[k].c)} per day.${days(k)}`, pct(res[k], A.cap));
    const powCls = P.blackout ? 'bad' : (P.net < 0 && res.power / -P.net < 5) ? 'warn' : '';
    const html = [
      chip('Power', Math.floor(res.power), A.batCap, P.net, powCls, `Generation ${fmt(P.gen)} vs demand ${fmt(P.used)} (${fmt(P.want)} wanted). Battery holds ${A.batCap}.`, pct(res.power, A.batCap)),
      stock('o2', 'Oxygen', 'Breathable air.'),
      stock('water', 'Water', 'Drinking, hygiene and greenhouses.'),
      stock('food', 'Food', 'Rations for the crew.'),
      chip('Materials', Math.floor(res.mat), A.cap, r.mat.net, '', 'Building and repair materials.', pct(res.mat, A.cap)),
      chip('Credits', Math.floor(res.cred), '', r.cred.net, res.cred < 30 ? 'warn' : '', `Earth funding scales with confidence. Income ${fmt(r.cred.p)}/day, upkeep ${fmt(r.cred.c)}/day.`, 100),
      chip('Crew', S.pop, A.housing, null, S.pop > A.housing ? 'warn' : '', `${A.crewUsed} on duty, ${A.crewIdle} idle. Each crewed module needs a colonist.`, pct(S.pop, A.housing)),
      chip('Morale', Math.round(S.morale), '', null, S.morale < 20 ? 'bad' : S.morale < 40 ? 'warn' : '', 'Below 60 the crew works slower.', S.morale),
      chip('Health', Math.round(S.health), '', null, S.health < 25 ? 'bad' : S.health < 50 ? 'warn' : '', 'Radiation and hardship wear crew down. Medical Bays restore it.', S.health),
      chip('Earth trust', Math.round(S.confidence), '', null, S.confidence < 15 ? 'bad' : S.confidence < 30 ? 'warn' : '', 'Deaths burn it, milestones build it. At zero the program is cancelled.', S.confidence)
    ].join('');
    setHTML($('#hud'), html);

    const list = S.status === 'landing' ? [] : E.alerts(S, A);
    setHTML($('#alerts'), list.slice(0, 5).map(a => `<div class="alert ${a.lvl}">${a.msg}</div>`).join(''));
  }

  function renderTop() {
    $('#dayLabel').textContent = `Day ${S.day}`;
    let sky;
    if (S.planet === 'moon') {
      const ph = E.moonPhase(S.day);
      sky = ph.lit ? `☀ Sunlit · night falls in ${ph.toChange} d` : `☾ Lunar night · dawn in ${ph.toChange} d`;
    } else {
      const st = E.effect(S, 'storm');
      sky = st ? `Dust storm · ${st.until - S.day + 1} d left · solar ${Math.round((1 - st.sev) * 100)}%` : 'Clear skies';
    }
    if (E.effect(S, 'halt')) sky += ' · CREW SHELTERING';
    $('#skyLabel').textContent = S.status === 'landing' ? 'Awaiting landing' : sky;
    $('#stepBtn').disabled = S.status !== 'playing' || !!S.pending;
  }

  /* ---------------------------------------------------------------- side panel */
  function renderTabs() {
    const tabs = [['build', 'Build'], ['cargo', 'Cargo'], ['colony', 'Colony'], ['log', 'Log']];
    setHTML($('#tabs'), tabs.map(([k, n]) => `<button data-tab="${k}" class="${ui.tab === k ? 'on' : ''}">${n}</button>`).join(''));
  }

  function panelBuild() {
    const cards = E.BUILD_ORDER.map(k => {
      const d = B(k), locked = d.minPop && S.pop < d.minPop;
      const shortM = S.res.mat < d.cost.m, shortC = S.res.cred < d.cost.c;
      return `<button class="card ${ui.placing === k ? 'active' : ''} ${locked ? 'locked' : ''}" data-build="${k}">` +
        `<span class="ico" style="color:${d.color}">${icon(k)}</span>` +
        `<span><b>${d.name}</b><small>${E.describe(k, S.planet).join(' · ')}${locked ? ` · needs crew of ${d.minPop}` : ''}</small></span>` +
        `<span class="cost"><span class="${shortM ? 'short' : ''}">${d.cost.m} mat</span><br><span class="${shortC ? 'short' : ''}">${d.cost.c} cr</span><br><small class="muted">${d.build}d build</small></span></button>`;
    }).join('');
    return `<div class="sect">Modules — build within 2 tiles of an existing module</div>${cards}`;
  }

  function panelCargo() {
    const P = E.PLANETS[S.planet], D = E.DIFFS[S.diff];
    const risk = Math.round(P.lossChance * D.ev * (ui.express ? 1.3 : 1) * 100);
    const sym = { supplies: '▣', o2: 'O₂', pallet: '▤', crew: '☻', med: '✚' };
    const cards = Object.keys(E.CARGO).map(k => {
      const c = E.CARGO[k], price = E.cargoPrice(S, k, ui.express);
      return `<button class="card" data-order="${k}"><span class="ico" style="font-weight:800">${sym[k]}</span>` +
        `<span><b>${c.name}</b><small>${c.desc}</small></span>` +
        `<span class="cost"><span class="${S.res.cred < price ? 'short' : ''}">${price} cr</span><br><small class="muted">${E.cargoDelay(S, ui.express)}d</small></span></button>`;
    }).join('');
    const q = S.queue.slice().sort((a, b) => a.arrive - b.arrive).map(x =>
      `<div class="kv"><span>${E.CARGO[x.key].name}${x.express ? ' (express)' : ''}</span><b>day ${x.arrive} (${x.arrive - S.day}d)</b></div>`).join('') || '<div class="kv"><span>Nothing in transit</span></div>';
    return `<div class="sect">Order from Earth</div>` +
      `<label class="opt"><input type="checkbox" id="expressBox" ${ui.express ? 'checked' : ''}> Express shipping (2× price, half the transit)</label>` +
      cards +
      `<div class="kv"><span>Launch failure risk</span><b>~${risk}%</b></div>` +
      `<div class="sect">In transit</div>${q}`;
  }

  function panelColony() {
    const W = E.WIN;
    const goal = (label, v, max, note) => `<div class="goal ${v >= max ? 'done' : ''}"><div class="gl"><span>${label}</span><b>${Math.min(Math.floor(v), max)} / ${max}</b></div><div class="gb"><i style="width:${pct(v, max)}%"></i></div>${note ? `<small>${note}</small>` : ''}</div>`;
    const ms = E.MILESTONES.map(m => `<div class="ms ${S.milestones[m.id] ? 'done' : ''}">${S.milestones[m.id] ? '✓' : '○'} ${m.label} <small>(+${m.c} cr)</small></div>`).join('');
    const nb = S.buildings.length;
    return `<div class="sect">Independence — all three, at once</div>` +
      goal('Days on the surface', S.day, W.day) +
      goal('Colonists alive', S.pop, W.pop, 'Needs housing and Earth crew transports.') +
      goal('Self-sufficient streak (days)', S.ss, W.ss, 'O₂, water and food all in surplus with no life-support blackout, without relying on cargo.') +
      `<div class="sect">Milestones</div>${ms}` +
      `<div class="sect">Record</div>` +
      `<div class="kv"><span>Modules standing</span><b>${nb}</b></div>` +
      `<div class="kv"><span>Colonists lost</span><b>${S.stats.deaths}</b></div>` +
      `<div class="kv"><span>Cargo lost in launch</span><b>${S.stats.cargoLost}</b></div>` +
      `<div class="kv"><span>Difficulty</span><b>${E.DIFFS[S.diff].name}</b></div>`;
  }

  function panelLog() {
    return S.log.slice(0, 80).map(l => `<div class="logline ${l.lvl}"><i>d${l.day}</i>${l.msg}</div>`).join('');
  }

  function renderPanel() {
    let h = '';
    if (S.status === 'landing') h = '<div class="sect">Preparing landing</div><div class="ms">Pick a site on the map. Look for flat ground close to blue ice and amber ore.</div>';
    else h = { build: panelBuild, cargo: panelCargo, colony: panelColony, log: panelLog }[ui.tab]();
    const panel = $('#panel');
    const top = panel.scrollTop;
    setHTML(panel, h);
    panel.scrollTop = top;
  }

  /* ---------------------------------------------------------------- inspector */
  function renderInspector() {
    let h = '';
    const s = ui.sel;
    if (s && S.status === 'playing') {
      const b = bAt(s.x, s.y), t = E.tileAt(S, s.x, s.y);
      if (b) {
        const d = B(b.type), st = A.b[b.id];
        const label = { ok: 'Operating', building: `Under construction — ${b.ready - S.day} day(s) left`, off: 'Switched off', nocrew: 'Idle: no free crew member', nopower: 'Idle: not enough power' }[st.status];
        const cls = st.status === 'ok' ? 'ok' : st.status === 'building' || st.status === 'off' ? '' : 'bad';
        const hp = Math.round(b.hp), hpc = hp < 25 ? 'var(--bad)' : hp < 60 ? 'var(--warn)' : 'var(--good)';
        const rc = E.repairCost(b), refund = Math.floor(b.paid.m * 0.4);
        const tile = t.t === 'ice' || t.t === 'ore' ? `<div class="muted">Sitting on ${TERRAIN_NAME[t.t].toLowerCase()} (×${t.r.toFixed(2)})</div>` : '';
        h = `<div class="insp"><button class="close" data-act="deselect" title="Close">×</button>` +
          `<h4 style="color:${d.color}">${icon(b.type)}${d.name}</h4><div class="st ${cls}">${label}</div>` +
          `<div class="muted">Integrity ${hp}%${hp < 60 ? ' — output reduced' : ''}</div><div class="hpbar"><i style="width:${hp}%;background:${hpc}"></i></div>` +
          `<p>${d.desc}</p><div class="muted">${E.describe(b.type, S.planet).join(' · ')}</div>${tile}` +
          `<div class="row2">` +
          (st.status !== 'building' && b.type !== 'hub' ? `<button class="mini" data-act="toggle" data-id="${b.id}">${b.on ? 'Switch off' : 'Switch on'}</button>` : '') +
          (hp < 100 && st.status !== 'building' ? `<button class="mini" data-act="repair" data-id="${b.id}" ${S.res.mat < rc ? 'disabled' : ''}>Repair (${rc} mat)</button>` : '') +
          (b.type !== 'hub' ? `<button class="mini danger" data-act="demolish" data-id="${b.id}">Demolish (+${refund} mat)</button>` : '') +
          `</div></div>`;
      } else {
        h = `<div class="insp"><button class="close" data-act="deselect" title="Close">×</button><h4>Empty ground</h4><p>${tileDesc(t)}</p>` +
          (t.t === 'ice' ? '<p>Build an <b>Ice Extractor</b> here for water.</p>' : t.t === 'ore' ? '<p>Build a <b>Regolith Mine</b> here for materials.</p>' : '') + `</div>`;
      }
    }
    setHTML($('#inspector'), h);
  }

  function render() {
    renderTop(); renderHud(); renderMap(); renderHint(); renderTabs(); renderInspector(); renderPanel();
  }

  /* ---------------------------------------------------------------- toasts */
  function toastNew() {
    const fresh = S.log.filter(l => l.n > ui.seenLog && l.lvl !== 'info').slice(0, 3).reverse();
    ui.seenLog = S.logN;
    const box = $('#toasts');
    fresh.forEach(l => {
      const t = document.createElement('div');
      t.className = `toast ${l.lvl}`; t.textContent = l.msg;
      box.appendChild(t);
      setTimeout(() => t.remove(), l.lvl === 'bad' ? 7000 : 4500);
    });
    while (box.children.length > 5) box.firstChild.remove();
  }
  function toast(msg, lvl) {
    const t = document.createElement('div'); t.className = `toast ${lvl || ''}`; t.textContent = msg;
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3500);
  }

  /* ---------------------------------------------------------------- modals */
  function modal(html) { const m = $('#modal'); m.innerHTML = html; m.hidden = false; }
  function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

  function showEvent() {
    const p = S.pending;
    const btns = p.choices.map(c => {
      const bad = c.cost && (S.res.mat < (c.cost.m || 0) || S.res.cred < (c.cost.c || 0));
      return `<button class="choicebtn" data-choice="${c.key}" ${bad ? 'disabled' : ''}><b>${c.label}</b><span>${c.detail}${bad ? ' (cannot afford)' : ''}</span></button>`;
    }).join('');
    modal(`<div class="sheet event"><h2>${p.title}</h2><p>${p.text}</p>${btns}</div>`);
  }

  function showEnd() {
    const won = S.status === 'won';
    modal(`<div class="sheet ${won ? 'win' : 'lose'}"><h2>${won ? 'Mission success' : 'Mission failed'}</h2><p>${S.endReason}</p>` +
      `<div class="stats"><div class="kv"><span>Days</span><b>${S.day}</b></div><div class="kv"><span>Colonists alive</span><b>${S.pop}</b></div>` +
      `<div class="kv"><span>Colonists lost</span><b>${S.stats.deaths}</b></div><div class="kv"><span>Earth trust</span><b>${Math.round(S.confidence)}</b></div>` +
      `<div class="kv"><span>Difficulty</span><b>${E.DIFFS[S.diff].name}</b></div><div class="kv"><span>Score</span><b>${S.score}</b></div></div>` +
      `<div class="row buttons"><button class="big" data-act="newgame">New mission</button><button class="big alt" data-act="viewbase">Look at the base</button></div></div>`);
  }

  function showHelp() {
    setSpeed(0);
    modal(`<div class="sheet"><h2>How to play</h2><ul>` +
      `<li><b>Goal:</b> reach day ${E.WIN.day} with at least ${E.WIN.pop} colonists and ${E.WIN.ss} consecutive days of <b>self-sufficiency</b> (oxygen, water and food all in surplus, life support never blacked out).</li>` +
      `<li><b>Time</b> only passes when you press ▶. Emergencies pause the game and ask for a decision.</li>` +
      `<li><b>Building:</b> pick a module, then a tile within 2 tiles of an existing module. Ice Extractors need <b>ice</b>, Mines need <b>ore</b>; richer deposits (×) yield more. Construction takes days.</li>` +
      `<li><b>Power</b> is your master resource. When it runs short, life support is served first, then production, then comforts. Click any module to switch it off and save power.</li>` +
      `<li><b>Moon:</b> 15 days of sunlight, then 15 days of darkness. Batteries or a reactor must carry you through. <b>Mars:</b> weak sun and dust storms that can collapse solar output for weeks.</li>` +
      `<li><b>Crew:</b> many modules need a colonist on duty. Bring more crew from Earth (needs free housing) and keep them alive, healthy and sane.</li>` +
      `<li><b>Cargo</b> takes days to arrive and can be lost in launch failures. Order early. Express costs double.</li>` +
      `<li><b>Wear:</b> everything decays and disasters hit. Repair damaged modules; a Workshop does it automatically.</li>` +
      `<li><b>Earth trust</b> drifts down over time and collapses when colonists die. At zero, funding ends and so does the mission.</li>` +
      `<li>Keys: <b>Space</b> pause · <b>1 2 3</b> speed · <b>N</b> next day · <b>Esc</b> cancel.</li></ul>` +
      `<div class="row buttons"><button class="big" data-act="closemodal">Got it</button></div></div>`);
  }

  /* ---------------------------------------------------------------- input */
  function tileFromEvent(e) {
    const el = e.target.closest('.tile'); if (!el) return null;
    const i = +el.dataset.i; return { x: i % E.W, y: Math.floor(i / E.W) };
  }

  function clickTile(p, shift) {
    if (S.status === 'landing') {
      const r = E.placeHub(S, p.x, p.y);
      if (!r.ok) return toast(r.reason, 'warn');
      ui.placing = null; ui.sel = { x: p.x, y: p.y };
      save(); refresh(); return;
    }
    if (S.status !== 'playing') return;
    if (ui.placing) {
      const r = E.place(S, ui.placing, p.x, p.y);
      if (!r.ok) return toast(r.reason, 'warn');
      if (!shift) ui.placing = null;
      save(); refresh(); return;
    }
    ui.sel = { x: p.x, y: p.y }; refresh();
  }

  function act(name, id) {
    if (name === 'deselect') { ui.sel = null; }
    else if (name === 'toggle') E.toggle(S, id);
    else if (name === 'repair') { const r = E.repair(S, id); if (!r.ok && r.reason) toast(r.reason, 'warn'); }
    else if (name === 'demolish') {
      ask('Demolish this module?', 'You recover 40% of the materials spent on it.', 'Demolish', () => { E.demolish(S, id); ui.sel = null; save(); refresh(); });
      return;
    }
    save(); refresh();
  }

  // In-page confirmation (browser confirm() can be blocked in embedded pages).
  function ask(title, text, yesLabel, onYes) {
    const wasRunning = ui.speed;
    setSpeed(0);
    ui.askYes = () => { closeModal(); onYes(); };
    ui.askNo = () => { closeModal(); setSpeed(wasRunning); };
    modal(`<div class="sheet"><h2>${title}</h2><p>${text}</p><div class="row buttons"><button class="big" data-act="askyes">${yesLabel}</button><button class="big alt" data-act="askno">Cancel</button></div></div>`);
  }

  function wire() {
    $('.controls').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || !S) return;
      if (b.dataset.speed !== undefined) { if (S.status === 'playing' && !S.pending) setSpeed(+b.dataset.speed); }
      else if (b.id === 'stepBtn') { if (S.status === 'playing' && !S.pending) { setSpeed(0); advance(); } }
      else if (b.id === 'helpBtn') showHelp();
      else if (b.id === 'menuBtn') ask('Leave this mission?', 'Progress is saved in this browser and you can continue later.', 'Leave', () => { save(); toStart(); });
    });

    const map = $('#map');
    map.addEventListener('mousemove', e => { const p = tileFromEvent(e); if (p && (!ui.hover || ui.hover.x !== p.x || ui.hover.y !== p.y)) { ui.hover = p; renderMap(); renderHint(); } });
    map.addEventListener('mouseleave', () => { ui.hover = null; renderMap(); renderHint(); });
    map.addEventListener('click', e => { const p = tileFromEvent(e); if (p) clickTile(p, e.shiftKey); });
    map.addEventListener('contextmenu', e => { e.preventDefault(); if (ui.placing && S.status === 'playing') { ui.placing = null; refresh(); } });

    $('#tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ui.tab = b.dataset.tab; render(); } });
    $('#inspector').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act, +b.dataset.id); });

    $('#panel').addEventListener('click', e => {
      const b = e.target.closest('[data-build]'), o = e.target.closest('[data-order]');
      if (b && S.status === 'playing') { ui.placing = ui.placing === b.dataset.build ? null : b.dataset.build; ui.sel = null; render(); }
      if (o && S.status === 'playing') {
        const r = E.orderCargo(S, o.dataset.order, ui.express);
        if (!r.ok) toast(r.reason || 'Cannot order that', 'warn'); else toast(`${E.CARGO[o.dataset.order].name} ordered`, 'good');
        save(); refresh();
      }
    });
    $('#panel').addEventListener('change', e => { if (e.target.id === 'expressBox') { ui.express = e.target.checked; render(); } });

    $('#modal').addEventListener('click', e => {
      const c = e.target.closest('[data-choice]'), a = e.target.closest('[data-act]');
      if (c && S.pending) {
        const r = E.resolve(S, c.dataset.choice);
        if (!r.ok) return toast(r.reason || 'Not possible', 'warn');
        closeModal(); toastNew(); save(); refresh(); setSpeed(ui.resume || 0);
      } else if (a) {
        if (a.dataset.act === 'newgame') { closeModal(); toStart(); }
        else if (a.dataset.act === 'viewbase') closeModal();
        else if (a.dataset.act === 'closemodal') closeModal();
        else if (a.dataset.act === 'askyes') ui.askYes();
        else if (a.dataset.act === 'askno') ui.askNo();
      }
    });

    document.addEventListener('keydown', e => {
      if (!S || $('#app').hidden || e.target.tagName === 'INPUT' || !$('#modal').hidden) return;
      if (e.key === 'Escape') { ui.placing = S.status === 'landing' ? 'hub' : null; ui.sel = null; refresh(); }
      else if (e.key === ' ') { e.preventDefault(); if (S.status === 'playing' && !S.pending) setSpeed(ui.speed ? 0 : ui.prevSpeed); }
      else if (e.key >= '1' && e.key <= '3') { if (S.status === 'playing' && !S.pending) setSpeed(+e.key); }
      else if (e.key === 'n' || e.key === 'N') { if (S.status === 'playing' && !S.pending) { setSpeed(0); advance(); } }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && S && ui.speed) setSpeed(0); });
  }

  wire();
  initStart();
})();

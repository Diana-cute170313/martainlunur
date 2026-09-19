/* OUTPOST — simulation engine (no DOM). Works in the browser (window.Engine) and Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Engine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const W = 14, H = 9;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ------------------------------------------------------------------ data */

  const PLANETS = {
    moon: {
      key: 'moon', name: 'The Moon', solar: 8, o2Out: 7, foodMult: 0.85, funding: 18, costMult: 1,
      delay: 4, lossChance: 0.03, isolation: 5, wear: 0.10, ice: 5, ore: 9,
      blurb: 'Close to home: cargo lands in 4 days and Earth pays well. But a lunar night lasts 15 days with zero sunlight, ice is scarce, and dust chews through hardware.'
    },
    mars: {
      key: 'mars', name: 'Mars', solar: 4.5, o2Out: 9, foodMult: 1.0, funding: 14, costMult: 1.5,
      delay: 16, lossChance: 0.08, isolation: 10, wear: 0.08, ice: 10, ore: 8,
      blurb: 'Far from home: cargo takes 16 days, costs 50% more and sometimes never arrives. Ice and CO₂ are plentiful, but sunlight is weak and global dust storms can black out your arrays for weeks.'
    }
  };

  const DIFFS = {
    frontier: { name: 'Frontier', ev: 0.7, cred: 800, start: 120, mat: 200, cost: 1.0, dmg: 0.8, wear: 0.8, blurb: 'Forgiving. Fewer disasters, bigger budget.' },
    hardened: { name: 'Hardened', ev: 1.2, cred: 600, start: 100, mat: 160, cost: 1.15, dmg: 1.15, wear: 1.0, blurb: 'The intended experience. Mistakes get people killed.' },
    brutal:   { name: 'Brutal',   ev: 1.5, cred: 450, start: 80,  mat: 130, cost: 1.35, dmg: 1.3, wear: 1.2, blurb: 'Constant emergencies and a thin budget. Good luck.' }
  };

  // prio: 0 = life support (powered/staffed first), 1 = production, 2 = luxury
  const BUILDINGS = {
    hub:    { name: 'Landing Hub', color: '#8fd3ff', cost: { m: 0, c: 0 }, build: 0, power: 2, prio: 0, housing: 4, storage: 200, battery: 40, unique: true,
              desc: 'Your lander, converted into the heart of the base. Cramped but habitable.' },
    hab:    { name: 'Habitat Module', color: '#9ec5ff', cost: { m: 60, c: 40 }, build: 4, power: 1, prio: 0, housing: 6,
              desc: 'Pressurized quarters for 6 crew. Damaged modules leak precious air.' },
    solar:  { name: 'Solar Array', color: '#ffd166', cost: { m: 25, c: 20 }, build: 2, gen: 1, solar: true, prio: 0,
              desc: 'Free power while the sun shines. Useless at night or under dust.' },
    battery:{ name: 'Battery Bank', color: '#c4f1a4', cost: { m: 30, c: 30 }, build: 2, battery: 70, prio: 0,
              desc: 'Stores surplus power to carry you through darkness and storms.' },
    reactor:{ name: 'Fission Reactor', color: '#ff8a5c', cost: { m: 120, c: 200 }, build: 8, gen: 15, crew: 1, safe: true, prio: 0, minPop: 6, upkeep: 3,
              desc: 'Steady 15 power regardless of sun or storm. Needs an engineer, fuel rods (3 cr/day) and a crew of at least 6.' },
    o2:     { name: 'Oxygen Generator', color: '#7fe0ff', cost: { m: 45, c: 40 }, build: 3, power: 4, prio: 0, o2: true,
              desc: 'Cracks oxygen out of regolith (Moon) or the CO₂ atmosphere (Mars).' },
    ice:    { name: 'Ice Extractor', color: '#b9e6ff', cost: { m: 40, c: 30 }, build: 3, power: 3, crew: 1, prio: 1, water: 7, tile: 'ice',
              desc: 'Melts subsurface ice. Must sit on an ice deposit; richer deposits yield more.' },
    rec:    { name: 'Water Recycler', color: '#6fb7ff', cost: { m: 35, c: 35 }, build: 3, power: 2, prio: 0, recycle: 3,
              desc: 'Reclaims 3 water/day, but total recycling can never exceed 60% of crew demand.' },
    gh:     { name: 'Greenhouse', color: '#7fe08a', cost: { m: 50, c: 45 }, build: 4, power: 3, crew: 1, prio: 1, food: 6, o2Bonus: 1.5, waterUse: 2,
              desc: 'Grows food and a little oxygen. Consumes 2 water/day; starved of water it fails.' },
    mine:   { name: 'Regolith Mine', color: '#ffb35c', cost: { m: 40, c: 30 }, build: 3, power: 3, crew: 1, prio: 1, mat: 4, tile: 'ore',
              desc: 'Digs construction materials. Must sit on an ore deposit.' },
    ws:     { name: 'Workshop', color: '#d0c2ff', cost: { m: 55, c: 50 }, build: 4, power: 3, crew: 1, prio: 2, repair: 5,
              desc: 'Automatically repairs your most damaged module (5 integrity/day, 0.15 materials per point).' },
    med:    { name: 'Medical Bay', color: '#ff8fa3', cost: { m: 60, c: 70 }, build: 4, power: 2, crew: 1, prio: 1, heal: 1.2,
              desc: 'Heals crew health and halves radiation and illness damage. Two are useful.' },
    recd:   { name: 'Recreation Dome', color: '#ffd9a0', cost: { m: 55, c: 60 }, build: 4, power: 2, prio: 2, morale: 12,
              desc: 'A garden, a view, a place to be human. +12 morale target (two stack).' },
    comm:   { name: 'Comm Array', color: '#a8b4ff', cost: { m: 40, c: 90 }, build: 3, power: 2, prio: 2, income: 8,
              desc: '+8 credits/day from broadcast deals and halves Earth’s fading interest.' },
    depot:  { name: 'Storage Depot', color: '#c9c9d4', cost: { m: 30, c: 20 }, build: 2, storage: 150,
              desc: '+150 storage for every consumable and for materials.' }
  };
  const BUILD_ORDER = ['hab', 'solar', 'battery', 'reactor', 'o2', 'ice', 'rec', 'gh', 'mine', 'ws', 'med', 'recd', 'comm', 'depot'];

  const CARGO = {
    supplies: { name: 'Life-support crate', desc: '+30 O₂, +30 water, +30 food', give: { o2: 30, water: 30, food: 30 }, price: 60 },
    o2:       { name: 'Oxygen tanks',       desc: '+60 O₂',                       give: { o2: 60 },                         price: 50 },
    pallet:   { name: 'Construction pallet',desc: '+50 materials',                    give: { mat: 50 },                        price: 60 },
    crew:     { name: 'Crew transport',     desc: '+2 colonists (needs free housing)', give: { pop: 2 },                         price: 100 },
    med:      { name: 'Medical kit',        desc: '+20 crew health',                  give: { health: 20 },                     price: 70 }
  };

  const WIN = { day: 120, pop: 16, ss: 20 };

  const MILESTONES = [
    { id: 'ls',    label: 'Closed-loop life support (O₂, water, food all in surplus)', c: 80,  conf: 5, check: (s, A) => A.rates.o2.net >= 0 && A.rates.water.net >= 0 && A.rates.food.net >= 0 && s.day > 2 },
    { id: 'd30',   label: 'Survive 30 days',                                                c: 100, conf: 4, check: s => s.day >= 30 },
    { id: 'crew8', label: 'Grow the crew to 8',                                             c: 120, conf: 6, check: s => s.pop >= 8 },
    { id: 'reac',  label: 'Bring a fission reactor online',                                 c: 60,  conf: 4, check: (s, A) => A.b && Object.values(A.b).some(x => x.b.type === 'reactor' && x.status === 'ok') },
    { id: 'd60',   label: 'Survive 60 days',                                                c: 120, conf: 6, check: s => s.day >= 60 },
    { id: 'crew12',label: 'Grow the crew to 12',                                            c: 150, conf: 6, check: s => s.pop >= 12 },
    { id: 'ss10',  label: 'Ten days fully self-sufficient',                                 c: 200, conf: 8, check: s => s.ss >= 10 }
  ];

  /* ------------------------------------------------------------------ rng & log */

  function rand(s) {
    s.rng = (s.rng + 0x6D2B79F5) | 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const randInt = (s, n) => Math.floor(rand(s) * n);
  const randRound = (s, x) => { const f = Math.floor(x); return f + (rand(s) < x - f ? 1 : 0); };

  function log(s, msg, lvl) {
    s.logN++;
    s.log.unshift({ n: s.logN, day: s.day, msg, lvl: lvl || 'info' });
    if (s.log.length > 250) s.log.length = 250;
  }

  /* ------------------------------------------------------------------ setup */

  function newGame(opts) {
    const planet = opts.planet in PLANETS ? opts.planet : 'moon';
    const diff = opts.diff in DIFFS ? opts.diff : 'hardened';
    const seed = (opts.seed | 0) || ((Math.random() * 2 ** 31) | 0) || 1;
    const D = DIFFS[diff];
    const s = {
      v: 1, seed, rng: seed, planet, diff, day: 1, status: 'landing',
      map: [], buildings: [], nextId: 1,
      // A Mars expedition launches with a heavier manifest to offset the long resupply gap.
      res: { power: 40, o2: D.start, water: D.start, food: D.start, mat: D.mat + (planet === 'mars' ? 50 : 0), cred: D.cred },
      pop: 4, morale: 70, health: 100, confidence: 60,
      queue: [], effects: [], log: [], logN: 0,
      dep: { water: 0, food: 0 }, ss: 0, milestones: {}, stats: { deaths: 0, built: 0, cargoLost: 0 },
      pending: null, endReason: '', score: 0
    };
    genMap(s);
    log(s, `Your lander touches down on ${PLANETS[planet].name}. Choose a landing site for the base.`, 'info');
    return s;
  }

  function genMap(s) {
    const P = PLANETS[s.planet];
    const map = [];
    for (let i = 0; i < W * H; i++) map.push({ t: 'plain', r: 1, n: +(0.9 + rand(s) * 0.2).toFixed(3) });
    const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
    // ridges: short random walks
    const walks = 3 + randInt(s, 3);
    for (let i = 0; i < walks; i++) {
      let x = randInt(s, W), y = randInt(s, H), dx = rand(s) < 0.5 ? 1 : -1, dy = 0;
      const len = 4 + randInt(s, 5);
      for (let k = 0; k < len; k++) {
        if (inb(x, y)) map[y * W + x].t = 'ridge';
        if (rand(s) < 0.4) { if (dx) { dx = 0; dy = rand(s) < 0.5 ? 1 : -1; } else { dy = 0; dx = rand(s) < 0.5 ? 1 : -1; } }
        x += dx; y += dy;
      }
    }
    // craters
    const craters = 3 + randInt(s, 3);
    for (let i = 0; i < craters; i++) {
      const cx = randInt(s, W), cy = randInt(s, H);
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy], j) => {
        const x = cx + ox, y = cy + oy;
        if (inb(x, y) && map[y * W + x].t === 'plain' && (j === 0 || rand(s) < 0.7)) map[y * W + x].t = 'crater';
      });
    }
    const blob = (kind, count) => {
      let placed = 0, guard = 0, x = 0, y = 0;
      while (placed < count && guard++ < 600) {
        if (placed === 0 || rand(s) < 0.22) { x = randInt(s, W); y = randInt(s, H); }
        else { x += randInt(s, 3) - 1; y += randInt(s, 3) - 1; }
        if (!inb(x, y)) { x = randInt(s, W); y = randInt(s, H); continue; }
        const t = map[y * W + x];
        if (t.t === 'plain' || t.t === 'crater') { t.t = kind; t.r = +(0.7 + rand(s) * 0.9).toFixed(2); placed++; }
      }
    };
    const iceN = P.ice + randInt(s, 3) - 1, oreN = P.ore + randInt(s, 3) - 1;
    if (s.planet === 'moon') { blob('ice', Math.ceil(iceN / 2)); blob('ice', Math.floor(iceN / 2)); }
    else { blob('ice', Math.ceil(iceN / 2)); blob('ice', Math.floor(iceN / 2)); }
    blob('ore', Math.ceil(oreN / 2)); blob('ore', Math.floor(oreN / 2));
    s.map = map;
  }

  /* ------------------------------------------------------------------ helpers */

  const tileAt = (s, x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? null : s.map[y * W + x];
  const buildingAt = (s, x, y) => s.buildings.find(b => b.x === x && b.y === y);
  const hpEff = b => b.hp < 25 ? 0.5 : b.hp < 60 ? 0.8 : 1;
  const laborEff = s => s.morale >= 60 ? 1 : 0.5 + s.morale / 120;
  const effect = (s, type) => s.effects.find(e => e.type === type);
  const done = (s, b) => s.day >= b.ready;

  function moonPhase(day) {
    const d = (day - 1) % 30;
    return { lit: d < 15, toChange: d < 15 ? 15 - d : 30 - d };
  }
  function lightLevel(s) {
    if (s.planet === 'moon') return moonPhase(s.day).lit ? 1 : 0;
    const st = effect(s, 'storm');
    return st ? 1 - st.sev : 1;
  }

  /* ------------------------------------------------------------------ analysis (pure) */

  function analyze(s) {
    const P = PLANETS[s.planet];
    const A = { housing: 0, cap: 0, batCap: 0, light: lightLevel(s), b: {}, crewUsed: 0, crewIdle: 0, unstaffed: 0 };
    const list = [];
    for (const b of s.buildings) {
      const d = BUILDINGS[b.type];
      const st = { b, d, status: 'ok', eff: 0 };
      A.b[b.id] = st;
      if (!done(s, b)) { st.status = 'building'; continue; }
      A.housing += d.housing || 0; A.cap += d.storage || 0; A.batCap += d.battery || 0;
      if (!b.on) { st.status = 'off'; continue; }
      list.push(st);
    }
    list.sort((a, b) => a.d.prio - b.d.prio || a.b.id - b.b.id);

    // staffing
    const halt = !!effect(s, 'halt');
    let crew = s.pop;
    for (const st of list) {
      const need = st.d.crew || 0;
      if (!need) continue;
      if ((halt && !st.d.safe) || crew < need) { st.status = 'nocrew'; A.unstaffed++; continue; }
      crew -= need;
    }
    A.crewUsed = s.pop - crew; A.crewIdle = crew;

    // generation
    let gen = 0, constGen = 0;
    for (const st of list) {
      if (st.status !== 'ok' || !st.d.gen) continue;
      const e = hpEff(st.b); st.eff = e;
      if (st.d.solar) gen += P.solar * A.light * e;
      else { gen += st.d.gen * e; constGen += st.d.gen * e; }
    }
    // demand (priority order)
    let want = 0;
    for (const st of list) if (st.status === 'ok' && st.d.power) want += st.d.power;
    const avail = gen + s.res.power;
    let used = 0, blackout = false;
    for (const st of list) {
      if (st.status !== 'ok' || !st.d.power) continue;
      if (used + st.d.power <= avail + 1e-9) used += st.d.power;
      else { st.status = 'nopower'; if (st.d.prio === 0) blackout = true; }
    }
    A.power = { gen, constGen, want, used, net: gen - used, stock: s.res.power, blackout };

    // production
    const lab = laborEff(s);
    const R = { o2: { p: 0, c: 0 }, water: { p: 0, c: 0 }, food: { p: 0, c: 0 }, mat: { p: 0, c: 0 }, cred: { p: 0, c: 0 } };
    let recSum = 0, ghWater = 0, ghFood = 0, ghO2 = 0, heal = 0, recdN = 0, repair = 0, commIncome = 0;
    for (const st of list) {
      if (st.status !== 'ok') continue;
      const d = st.d;
      let e = hpEff(st.b); if (d.crew) e *= lab; st.eff = e;
      const tile = tileAt(s, st.b.x, st.b.y);
      if (d.o2) R.o2.p += P.o2Out * e;
      if (d.water) R.water.p += d.water * (tile.t === 'ice' ? tile.r : 0) * e;
      if (d.mat) R.mat.p += d.mat * (tile.t === 'ore' ? tile.r : 0) * e;
      if (d.recycle) recSum += d.recycle * e;
      if (d.food) { ghFood += d.food * P.foodMult * e; ghO2 += d.o2Bonus * e; ghWater += d.waterUse * e; }
      if (d.heal) heal += d.heal * e;
      if (d.morale) recdN++;
      if (d.repair) repair += d.repair * e;
      if (d.income) commIncome += d.income * e;
    }
    let leak = 0;
    for (const b of s.buildings) if (done(s, b) && BUILDINGS[b.type].housing && b.hp < 50) leak += (50 - b.hp) / 50 * 2;
    R.water.p += Math.min(recSum, 0.6 * s.pop);
    R.food.p += ghFood; R.o2.p += ghO2;
    R.o2.c = s.pop + leak; R.water.c = s.pop + ghWater; R.food.c = s.pop;
    const bud = effect(s, 'budget') ? 0.5 : 1;
    R.cred.p = P.funding * (0.5 + s.confidence / 100) * bud + commIncome;
    for (const st of list) if (st.status === 'ok' || st.status === 'nopower') R.cred.c += st.d.upkeep || 0;
    for (const k in R) R[k].net = R[k].p - R[k].c;
    A.rates = R; A.leak = leak; A.ghWater = ghWater; A.ghFood = ghFood; A.ghO2 = ghO2;
    A.heal = Math.min(heal, 2.4); A.recd = Math.min(recdN, 2); A.repair = repair; A.comm = commIncome > 0;
    A.selfSufficient = R.o2.net >= 0 && R.water.net >= 0 && R.food.net >= 0 && !blackout && s.res.power > 0.5;
    return A;
  }

  /* ------------------------------------------------------------------ build actions */

  function costOf(s, type, x, y) {
    const d = BUILDINGS[type], t = tileAt(s, x, y);
    return { m: Math.ceil(d.cost.m * (t && t.t === 'crater' ? 1.4 : 1)), c: d.cost.c };
  }

  function canPlace(s, type, x, y) {
    const d = BUILDINGS[type], t = tileAt(s, x, y);
    if (!t) return { ok: false, reason: 'Out of bounds' };
    if (buildingAt(s, x, y)) return { ok: false, reason: 'Tile is occupied' };
    if (t.t === 'ridge') return { ok: false, reason: 'Rocky ridge: unbuildable' };
    if (type === 'hub') {
      if (t.t !== 'plain') return { ok: false, reason: 'Land on flat, plain ground' };
      return { ok: true, cost: { m: 0, c: 0 } };
    }
    const cost = costOf(s, type, x, y);
    if (d.tile && t.t !== d.tile) return { ok: false, reason: `Needs ${d.tile === 'ice' ? 'an ice' : 'an ore'} deposit`, cost };
    let adj = false;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && buildingAt(s, x + dx, y + dy)) adj = true;
    if (!adj) return { ok: false, reason: 'Must be within 2 tiles of an existing module (tunnel & cable reach)', cost };
    if (d.minPop && s.pop < d.minPop) return { ok: false, reason: `Requires a crew of ${d.minPop}`, cost };
    if (s.res.mat < cost.m) return { ok: false, reason: `Need ${cost.m} materials`, cost };
    if (s.res.cred < cost.c) return { ok: false, reason: `Need ${cost.c} credits`, cost };
    return { ok: true, cost };
  }

  function placeHub(s, x, y) {
    if (s.status !== 'landing') return { ok: false, reason: 'Already landed' };
    const c = canPlace(s, 'hub', x, y);
    if (!c.ok) return c;
    s.buildings.push({ id: s.nextId++, type: 'hub', x, y, hp: 100, on: true, ready: 0, paid: { m: 0, c: 0 } });
    s.status = 'playing';
    log(s, 'Landing hub established. Time only moves when you press play.', 'good');
    return { ok: true };
  }

  function place(s, type, x, y) {
    if (s.status !== 'playing') return { ok: false, reason: 'Game is not running' };
    const c = canPlace(s, type, x, y);
    if (!c.ok) return c;
    const d = BUILDINGS[type];
    s.res.mat -= c.cost.m; s.res.cred -= c.cost.c;
    s.buildings.push({ id: s.nextId++, type, x, y, hp: 100, on: true, ready: s.day + d.build, paid: c.cost });
    s.stats.built++;
    log(s, `Construction started: ${d.name} (${d.build} days).`, 'info');
    return { ok: true };
  }

  function demolish(s, id) {
    const i = s.buildings.findIndex(b => b.id === id);
    if (i < 0) return { ok: false };
    const b = s.buildings[i], d = BUILDINGS[b.type];
    if (d.unique) return { ok: false, reason: 'The hub cannot be demolished' };
    const refund = Math.floor(b.paid.m * 0.4);
    s.res.mat += refund;
    s.buildings.splice(i, 1);
    log(s, `${d.name} demolished. Recovered ${refund} materials.`, 'info');
    return { ok: true, refund };
  }

  const repairCost = b => Math.ceil((100 - b.hp) / 4);
  function repair(s, id) {
    const b = s.buildings.find(x => x.id === id);
    if (!b || b.hp >= 100) return { ok: false };
    const cost = repairCost(b);
    if (s.res.mat < cost) return { ok: false, reason: `Need ${cost} materials` };
    s.res.mat -= cost; b.hp = 100;
    log(s, `${BUILDINGS[b.type].name} repaired (${cost} materials).`, 'info');
    return { ok: true };
  }
  function toggle(s, id) {
    const b = s.buildings.find(x => x.id === id);
    if (b) b.on = !b.on;
    return { ok: !!b };
  }

  /* ------------------------------------------------------------------ cargo */

  const cargoPrice = (s, key, express) =>
    Math.round(CARGO[key].price * PLANETS[s.planet].costMult * DIFFS[s.diff].cost * (express ? 2 : 1));
  const cargoDelay = (s, express) => express ? Math.ceil(PLANETS[s.planet].delay / 2) : PLANETS[s.planet].delay;

  function orderCargo(s, key, express) {
    if (s.status !== 'playing') return { ok: false };
    const price = cargoPrice(s, key, express);
    if (s.res.cred < price) return { ok: false, reason: `Need ${price} credits` };
    if (CARGO[key].give.pop) {
      const A = analyze(s);
      const incoming = s.queue.reduce((n, q) => n + (CARGO[q.key].give.pop || 0), 0);
      if (s.pop + incoming + CARGO[key].give.pop > A.housing) return { ok: false, reason: 'Not enough free housing' };
    }
    s.res.cred -= price;
    s.queue.push({ id: s.nextId++, key, express: !!express, arrive: s.day + cargoDelay(s, express) });
    log(s, `Ordered ${CARGO[key].name}${express ? ' (express)' : ''}. ETA day ${s.day + cargoDelay(s, express)}.`, 'info');
    return { ok: true };
  }

  function deliver(s, q) {
    const P = PLANETS[s.planet], D = DIFFS[s.diff], c = CARGO[q.key];
    if (rand(s) < P.lossChance * D.ev * (q.express ? 1.3 : 1)) {
      s.stats.cargoLost++;
      log(s, `Launch anomaly: the ${c.name} was lost. No refund.`, 'bad');
      return;
    }
    const A = analyze(s), g = c.give;
    if (g.o2) s.res.o2 = Math.min(A.cap, s.res.o2 + g.o2);
    if (g.water) s.res.water = Math.min(A.cap, s.res.water + g.water);
    if (g.food) s.res.food = Math.min(A.cap, s.res.food + g.food);
    if (g.mat) s.res.mat = Math.min(A.cap, s.res.mat + g.mat);
    if (g.health) s.health = clamp(s.health + g.health, 0, 100);
    if (g.pop) { s.pop += g.pop; s.morale = clamp(s.morale + 4, 0, 100); s.confidence = clamp(s.confidence + 1.5, 0, 100); }
    log(s, `${c.name} arrived: ${c.desc}.`, 'good');
  }

  /* ------------------------------------------------------------------ events */

  function kill(s, n, cause) {
    n = Math.min(n, s.pop);
    if (n <= 0) return;
    s.pop -= n; s.stats.deaths += n;
    s.morale = clamp(s.morale - 6 * n, 0, 100);
    s.confidence = clamp(s.confidence - 8 * n, 0, 100);
    log(s, `${n} crew member${n > 1 ? 's' : ''} died: ${cause}.`, 'bad');
  }

  const medCount = s => s.buildings.filter(b => b.type === 'med' && done(s, b) && b.on).length;
  function pickBuilding(s) {
    const l = s.buildings.filter(b => done(s, b));
    return l.length ? l[randInt(s, l.length)] : null;
  }

  const EVENTS = [
    { id: 'meteor', w: s => s.planet === 'moon' ? 0.035 : 0.02, run(s, D) {
        const b = pickBuilding(s); if (!b) return;
        const d = BUILDINGS[b.type], dmg = Math.round((15 + rand(s) * 30) * D.dmg);
        b.hp = Math.max(b.type === 'hub' ? 1 : 0, b.hp - dmg);
        log(s, `Micrometeorite strike on the ${d.name}: -${dmg} integrity.`, 'warn');
        if (d.housing && b.hp <= 15 && b.hp > 0 && rand(s) < 0.35) kill(s, 1, 'explosive decompression');
      } },
    { id: 'flare', w: () => 0.02, run(s) {
        s.pending = { id: 'flare', title: 'Solar flare warning',
          text: 'Sensors show a coronal mass ejection heading your way. You have hours to decide how to protect the crew.',
          choices: [
            { key: 'shelter', label: 'Shelter in the storm cellar', detail: 'All crewed work stops for 2 days. Batteries are disconnected and safe.' },
            { key: 'work', label: 'Keep working', detail: 'Crew takes heavy radiation (medical bays halve it). Batteries lose ~30% to the surge.' }
          ] };
      } },
    { id: 'storm', w: s => s.planet === 'mars' && !effect(s, 'storm') ? 0.03 : 0, run(s) {
        const dur = 6 + randInt(s, 9), sev = +(0.6 + rand(s) * 0.3).toFixed(2);
        s.pending = { id: 'storm', data: { dur, sev }, title: 'Global dust storm forecast',
          text: `A dust storm is building and will last about ${dur} days. Solar output will collapse to roughly ${Math.round((1 - sev) * 100)}%.`,
          choices: [
            { key: 'secure', label: 'Secure the arrays', detail: 'Costs 15 materials. Panels take far less abrasion damage.', cost: { m: 15 } },
            { key: 'ride', label: 'Ride it out', detail: 'Free, but grit will scour your solar arrays every day.' }
          ] };
      } },
    { id: 'fault', w: () => 0.03, run(s) {
        const b = pickBuilding(s); if (!b) return;
        const d = BUILDINGS[b.type];
        s.pending = { id: 'fault', data: { bid: b.id }, title: 'Critical fault',
          text: `The ${d.name} reports a cascading failure. Engineers can attempt a rush repair or patch it later.`,
          choices: [
            { key: 'rush', label: 'Rush repair', detail: 'Costs 15 materials. Damage limited to 10 integrity.', cost: { m: 15 } },
            { key: 'patch', label: 'Patch it later', detail: 'Free, but the module loses 35 integrity.' }
          ] };
      } },
    { id: 'delay', w: s => s.queue.length ? 0.015 : 0, run(s) {
        const q = s.queue.slice().sort((a, b) => a.arrive - b.arrive)[0];
        q.arrive += 6;
        log(s, `Launch delay: your ${CARGO[q.key].name} slips by 6 days.`, 'warn');
      } },
    { id: 'budget', w: s => effect(s, 'budget') ? 0 : 0.008, run(s) {
        s.effects.push({ type: 'budget', until: s.day + 11 });
        log(s, 'Budget crisis on Earth: funding halved for 12 days.', 'warn');
      } },
    { id: 'conflict', w: () => 0.012, run(s) {
        const hit = s.buildings.some(b => b.type === 'recd' && done(s, b)) ? 6 : 12;
        s.morale = clamp(s.morale - hit, 0, 100);
        log(s, `Crew conflict over rationing and shifts: morale -${hit}.`, 'warn');
      } },
    { id: 'illness', w: () => 0.012, run(s, D) {
        const hit = Math.round((medCount(s) ? 4 : 12) * D.dmg);
        s.health = clamp(s.health - hit, 0, 100);
        log(s, `A respiratory illness spreads through the base: health -${hit}.`, 'warn');
      } },
    { id: 'find', w: () => 0.015, run(s) {
        const A = analyze(s), r = randInt(s, 3);
        if (r === 0) { s.res.water = Math.min(A.cap, s.res.water + 45); log(s, 'Survey drones map a buried ice pocket: +45 water.', 'good'); }
        else if (r === 1) { s.res.mat = Math.min(A.cap, s.res.mat + 60); log(s, 'A rich ore vein is exposed by erosion: +60 materials.', 'good'); }
        else { s.res.cred += 120; log(s, 'A private foundation donates to the mission: +120 credits.', 'good'); }
      } },
    { id: 'pr', w: () => 0.01, run(s) {
        s.confidence = clamp(s.confidence + 8, 0, 100); s.res.cred += 40;
        log(s, 'A live broadcast from the surface captivates Earth: confidence +8, +40 credits.', 'good');
      } }
  ];

  function rollEvent(s) {
    if (s.day < 6 || s.pending) return;
    const D = DIFFS[s.diff], scale = D.ev * (1 + Math.min(0.5, s.day / 200));
    for (const ev of EVENTS) {
      const p = ev.w(s) * scale;
      if (p > 0 && rand(s) < p) { ev.run(s, D); return; }
    }
  }

  function resolve(s, key) {
    const p = s.pending; if (!p) return { ok: false };
    const ch = p.choices.find(c => c.key === key); if (!ch) return { ok: false };
    if (ch.cost && (s.res.mat < (ch.cost.m || 0) || s.res.cred < (ch.cost.c || 0))) return { ok: false, reason: 'Cannot afford that' };
    if (ch.cost) { s.res.mat -= ch.cost.m || 0; s.res.cred -= ch.cost.c || 0; }
    const D = DIFFS[s.diff];
    s.pending = null;
    if (p.id === 'flare') {
      if (key === 'shelter') {
        s.effects.push({ type: 'halt', until: s.day + 1 });
        s.health = clamp(s.health - 2, 0, 100);
        log(s, 'Crew shelters through the flare. Work resumes in 2 days.', 'info');
      } else {
        const hit = Math.round((12 + rand(s) * 10) * (medCount(s) ? 0.5 : 1) * D.dmg);
        s.health = clamp(s.health - hit, 0, 100);
        s.res.power *= 0.7;
        log(s, `Crew works through the flare: health -${hit}, batteries lose 30%.`, 'warn');
      }
    } else if (p.id === 'storm') {
      s.effects.push({ type: 'storm', until: s.day + p.data.dur - 1, sev: p.data.sev, secured: key === 'secure' });
      log(s, `Dust storm begins (${p.data.dur} days). Solar output is down to ${Math.round((1 - p.data.sev) * 100)}%.`, 'warn');
    } else if (p.id === 'fault') {
      const b = s.buildings.find(x => x.id === p.data.bid);
      if (b) {
        const dmg = key === 'rush' ? 10 : Math.round(35 * D.dmg);
        b.hp = Math.max(b.type === 'hub' ? 1 : 0, b.hp - dmg);
        log(s, `${BUILDINGS[b.type].name} fault ${key === 'rush' ? 'contained' : 'patched over'}: -${dmg} integrity.`, 'warn');
      }
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------ the daily tick */

  function step(s) {
    if (s.status !== 'playing' || s.pending) return;
    s.day++;
    const P = PLANETS[s.planet], D = DIFFS[s.diff];

    // deliveries and effect expiry
    const arriving = s.queue.filter(q => q.arrive <= s.day);
    s.queue = s.queue.filter(q => q.arrive > s.day);
    arriving.forEach(q => deliver(s, q));
    s.effects = s.effects.filter(e => e.until >= s.day);

    // scheduled: lunar terminator thermal shock
    if (s.planet === 'moon') {
      const ph = (s.day - 1) % 30;
      if (ph === 15 || (ph === 0 && s.day > 1)) {
        let n = 0;
        for (const b of s.buildings) if (done(s, b)) { b.hp = Math.max(b.type === 'hub' ? 1 : 0, b.hp - (3 + rand(s) * 4) * D.dmg); n++; }
        if (n) log(s, ph === 15 ? 'Sunset: temperatures plunge and thermal stress cracks seals across the base.' : 'Sunrise: rapid heating stresses every module.', 'warn');
      }
    }

    rollEvent(s);

    const A = analyze(s);
    const cap = A.cap;
    const R = A.rates;

    // power
    s.res.power = clamp(s.res.power + A.power.net, 0, A.batCap);

    // materials, credits
    s.res.mat = clamp(s.res.mat + R.mat.p, 0, cap);
    s.res.cred = Math.max(0, s.res.cred + R.cred.net);

    // water (crew first, then greenhouses)
    const pop = s.pop;
    let wv = s.res.water + R.water.p - 0;
    const crewWater = Math.min(wv, pop);
    const waterUnmet = pop - crewWater;
    wv -= crewWater;
    const ghSat = A.ghWater > 0 ? Math.min(1, wv / A.ghWater) : 1;
    wv -= A.ghWater * ghSat;
    // note: R.water.p already excludes greenhouse draw; cap after all draws
    s.res.water = clamp(wv, 0, cap);

    // food and oxygen (greenhouse output scales with its water)
    const foodProd = A.ghFood * ghSat;
    const o2Prod = R.o2.p - A.ghO2 * (1 - ghSat);
    const fv = s.res.food + foodProd, foodUnmet = Math.max(0, pop - fv);
    s.res.food = clamp(fv - pop, 0, cap);
    const o2v = s.res.o2 + o2Prod, o2need = pop + A.leak, o2Unmet = Math.max(0, o2need - o2v);
    s.res.o2 = clamp(o2v - o2need, 0, cap);

    // deprivation
    s.dep.water = waterUnmet > 0.01 ? s.dep.water + 1 : 0;
    s.dep.food = foodUnmet > 0.01 ? s.dep.food + 1 : 0;
    if (o2Unmet > 0.01) kill(s, randRound(s, (o2Unmet / Math.max(1, o2need)) * pop * 0.6), 'suffocation');
    if (s.dep.water >= 2) kill(s, randRound(s, s.pop * 0.15), 'dehydration');
    if (s.dep.food >= 5) kill(s, randRound(s, s.pop * 0.08), 'starvation');

    // health
    let dh = -0.25 + A.heal;
    if (foodUnmet > 0.01) dh -= 2;
    if (waterUnmet > 0.01) dh -= 3;
    if (o2Unmet > 0.01) dh -= 5;
    if (A.power.blackout) dh -= 0.5;
    s.health = clamp(s.health + dh, 0, 100);
    if (s.health < 25) kill(s, randRound(s, s.pop * 0.04), 'medical complications');

    // morale
    let target = 65 - P.isolation + 12 * A.recd + (A.ghFood > 0 ? 4 : 0);
    if (foodUnmet > 0.01) target -= 25;
    if (waterUnmet > 0.01) target -= 30;
    if (o2Unmet > 0.01) target -= 30;
    if (A.power.blackout) target -= 15;
    if (s.health < 50) target -= 10;
    if (s.pop > A.housing) target -= 15;
    if (effect(s, 'halt')) target -= 5;
    s.morale = clamp(s.morale + (target - s.morale) * 0.12, 0, 100);
    if (s.morale < 20 && rand(s) < 0.1) {
      const b = pickBuilding(s);
      if (b) { b.hp = Math.max(b.type === 'hub' ? 1 : 0, b.hp - 20); log(s, `Demoralized crew botch maintenance: ${BUILDINGS[b.type].name} -20 integrity.`, 'warn'); }
    }

    // wear, storm scouring, workshop repair
    const wear = (0.25 + P.wear) * D.wear;
    const storm = effect(s, 'storm');
    for (const b of s.buildings) {
      if (!done(s, b)) continue;
      let loss = wear;
      if (storm && BUILDINGS[b.type].solar) loss += storm.secured ? 0.4 : 1.6;
      b.hp = Math.max(b.type === 'hub' ? 1 : 0, b.hp - loss);
    }
    if (A.repair > 0) {
      let pts = Math.min(A.repair, s.res.mat / 0.15);
      const dmg = s.buildings.filter(b => done(s, b) && b.hp < 100 && b.hp > 0).sort((a, b) => a.hp - b.hp);
      for (const b of dmg) {
        if (pts <= 0) break;
        const r = Math.min(pts, 100 - b.hp); b.hp += r; pts -= r; s.res.mat -= r * 0.15;
      }
      s.res.mat = Math.max(0, s.res.mat);
    }
    const lost = s.buildings.filter(b => b.hp <= 0);
    if (lost.length) {
      s.buildings = s.buildings.filter(b => b.hp > 0);
      lost.forEach(b => log(s, `The ${BUILDINGS[b.type].name} has been destroyed.`, 'bad'));
    }

    // Earth's confidence and milestones
    s.confidence = clamp(s.confidence - 0.15 * (A.comm ? 0.5 : 1), 0, 100);
    const A2 = analyze(s);
    s.ss = A2.selfSufficient && s.pop > 0 ? s.ss + 1 : 0;
    for (const m of MILESTONES) {
      if (!s.milestones[m.id] && m.check(s, A2)) {
        s.milestones[m.id] = s.day;
        s.res.cred += m.c; s.confidence = clamp(s.confidence + m.conf, 0, 100);
        log(s, `Milestone: ${m.label}. Earth sends +${m.c} credits.`, 'good');
      }
    }

    // end conditions
    if (s.pop <= 0) end(s, 'lost', 'Every colonist has died. The outpost falls silent.');
    else if (s.confidence <= 0) end(s, 'lost', 'Earth’s confidence collapsed. The program has been cancelled and the survivors are left to their fate.');
    else if (s.day >= WIN.day && s.pop >= WIN.pop && s.ss >= WIN.ss) end(s, 'won', 'The outpost is self-sustaining. Earth declares your colony independent.');
  }

  function end(s, status, reason) {
    s.status = status; s.endReason = reason; s.pending = null;
    const mult = { frontier: 0.8, hardened: 1, brutal: 1.4 }[s.diff];
    s.score = Math.max(0, Math.round((s.day * 4 + s.pop * 60 - s.stats.deaths * 25 + s.confidence * 3 + s.ss * 5 + (status === 'won' ? 800 : 0)) * mult));
    log(s, status === 'won' ? 'MISSION SUCCESS.' : 'MISSION FAILED.', status === 'won' ? 'good' : 'bad');
  }

  /* ------------------------------------------------------------------ advisory text */

  function alerts(s, A) {
    const out = [];
    const nm = { o2: 'Oxygen', water: 'Water', food: 'Food' };
    for (const k of ['o2', 'water', 'food']) {
      const net = A.rates[k].net, stock = s.res[k];
      if (stock <= 0.05 && net < 0) out.push({ lvl: 'bad', msg: `${nm[k]} depleted: crew is suffering` });
      else if (net < 0) {
        const d = stock / -net;
        if (d < 12) out.push({ lvl: d < 5 ? 'bad' : 'warn', msg: `${nm[k]}: about ${Math.floor(d)} day${Math.floor(d) === 1 ? '' : 's'} left at the current rate` });
      }
    }
    if (A.power.blackout) out.push({ lvl: 'bad', msg: 'Life support is underpowered. Shed load or add generation now' });
    else if (A.power.net < 0) {
      const d = s.res.power / -A.power.net;
      if (d < 10) out.push({ lvl: d < 3 ? 'bad' : 'warn', msg: `Battery drains in about ${Math.floor(d)} day${Math.floor(d) === 1 ? '' : 's'}` });
    }
    if (s.planet === 'moon') {
      const ph = moonPhase(s.day), drain = Math.max(0, A.power.want - A.power.constGen);
      const days = drain > 0 ? Math.floor(s.res.power / drain) : 99;
      if (ph.lit && ph.toChange <= 8) out.push({ lvl: days < 15 ? 'warn' : 'info', msg: `Lunar night in ${ph.toChange} day${ph.toChange === 1 ? '' : 's'}: 15 days without sun. Stored power covers ~${days} of them at full load` });
      else if (!ph.lit) out.push({ lvl: 'info', msg: `Lunar night: sunrise in ${ph.toChange} day${ph.toChange === 1 ? '' : 's'}` });
    } else {
      const st = effect(s, 'storm');
      if (st) out.push({ lvl: 'warn', msg: `Dust storm: solar at ${Math.round((1 - st.sev) * 100)}% for ${st.until - s.day + 1} more day${st.until === s.day ? '' : 's'}` });
    }
    if (s.pop > A.housing) out.push({ lvl: 'warn', msg: 'Overcrowded: more crew than beds' });
    if (A.unstaffed) out.push({ lvl: 'info', msg: `${A.unstaffed} module${A.unstaffed > 1 ? 's' : ''} idle for lack of crew` });
    const hurt = s.buildings.filter(b => done(s, b) && b.hp < 40).length;
    if (hurt) out.push({ lvl: 'warn', msg: `${hurt} module${hurt > 1 ? 's' : ''} badly damaged (below 40% integrity)` });
    if (s.morale < 35) out.push({ lvl: 'warn', msg: 'Morale is low: crew efficiency is dropping' });
    if (s.health < 50) out.push({ lvl: 'warn', msg: 'Crew health is poor: build a Medical Bay or ship a medical kit' });
    if (effect(s, 'budget')) out.push({ lvl: 'warn', msg: 'Budget crisis: Earth funding is halved' });
    return out;
  }

  function describe(type, pk) {
    const d = BUILDINGS[type], P = PLANETS[pk], o = [];
    if (d.housing) o.push(`Houses ${d.housing}`);
    if (d.solar) o.push(`+${P.solar} power (sun)`);
    else if (d.gen) o.push(`+${d.gen} power`);
    if (d.battery) o.push(`Stores ${d.battery} power`);
    if (d.storage && type !== 'hub') o.push(`+${d.storage} storage`);
    if (d.o2) o.push(`+${P.o2Out} O₂`);
    if (d.water) o.push(`+${d.water}× water`);
    if (d.recycle) o.push(`+${d.recycle} water`);
    if (d.food) o.push(`+${+(d.food * P.foodMult).toFixed(1)} food, uses ${d.waterUse} water`);
    if (d.mat) o.push(`+${d.mat}× materials`);
    if (d.repair) o.push(`Repairs ${d.repair}/day`);
    if (d.heal) o.push('Heals crew');
    if (d.morale) o.push('+morale');
    if (d.income) o.push(`+${d.income} cr/day`);
    if (d.power) o.push(`−${d.power} power`);
    if (d.crew) o.push(`${d.crew} crew`);
    return o;
  }

  return {
    W, H, PLANETS, DIFFS, BUILDINGS, BUILD_ORDER, CARGO, WIN, MILESTONES,
    newGame, analyze, step, place, placeHub, canPlace, costOf, demolish, repair, repairCost, toggle,
    orderCargo, cargoPrice, cargoDelay, resolve, alerts, describe, tileAt, buildingAt, moonPhase, effect, done, hpEff
  };
});

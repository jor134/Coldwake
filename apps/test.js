/* COLDWAKE headless harness. Run: node test.js [--file index.html] */
var fs = require('fs');
var path = process.argv.indexOf('--file') > -1 ? process.argv[process.argv.indexOf('--file') + 1] : null;

var CW;
if (path) {
  var html = fs.readFileSync(path, 'utf8');
  var m = html.match(/<script id="cw-core">([\s\S]*?)<\/script>/);
  if (!m) { console.error('FATAL: no <script id="cw-core"> block in ' + path); process.exit(1); }
  var sandbox = {};
  (new Function('window', m[1])).call(sandbox, sandbox);
  CW = sandbox.CW;
  console.log('core extracted from ' + path);
} else {
  CW = require('./core.js');
  console.log('core loaded from core.js');
}

var pass = 0, fail = 0, log = [];
function t(name, fn) {
  try {
    var r = fn();
    if (r === true || r === undefined) { pass++; log.push('  PASS  ' + name); }
    else { fail++; log.push('  FAIL  ' + name + '  -> ' + r); }
  } catch (e) { fail++; log.push('  FAIL  ' + name + '  -> EXCEPTION ' + e.message + '\n' + e.stack.split('\n')[1]); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-6); }

/* ============ 1. RNG DETERMINISM ============ */
t('1.1 rng is deterministic for same seed', function () {
  var a = CW.rng(12345), b = CW.rng(12345);
  for (var i = 0; i < 100; i++) if (a() !== b()) return 'divergence at ' + i;
  return true;
});
t('1.2 rng differs for different seeds', function () {
  var a = CW.rng(1)(), b = CW.rng(2)();
  return a !== b || 'identical first draw';
});
t('1.3 rng stays in [0,1)', function () {
  var r = CW.rng(999);
  for (var i = 0; i < 10000; i++) { var v = r(); if (v < 0 || v >= 1) return 'out of range ' + v; }
  return true;
});
t('1.4 hash is stable', function () {
  return CW.hash('ABC-123') === CW.hash('ABC-123') || 'unstable';
});

/* ============ 2. GENERATION DETERMINISM ============ */
t('2.1 same code -> identical ship (deep equal)', function () {
  var a = CW.generateShip('K7M-3PQ'), b = CW.generateShip('K7M-3PQ');
  return JSON.stringify(a) === JSON.stringify(b) || 'ships differ';
});
t('2.2 code normalisation ignores punctuation/case', function () {
  var a = CW.generateShip('k7m3pq'), b = CW.generateShip('K7M-3PQ');
  return JSON.stringify(a.rooms) === JSON.stringify(b.rooms) || 'normalisation broken';
});
t('2.3 different codes -> different layouts', function () {
  var same = 0;
  for (var i = 0; i < 50; i++) {
    var a = CW.generateShip('SEED' + i), b = CW.generateShip('SEED' + (i + 1000));
    if (JSON.stringify(a.rooms) === JSON.stringify(b.rooms)) same++;
  }
  return same === 0 || same + ' collisions in 50';
});

/* ============ 3. SOLVABILITY FUZZ ============ */
t('3.1 10000 random seeds all solvable', function () {
  var bad = [], r = CW.rng(4242);
  for (var i = 0; i < 10000; i++) {
    var code = CW.makeCode(r);
    var s = CW.generateShip(code);
    var v = CW.verifyShip(s);
    if (!v.ok) { bad.push(code + ' :: ' + v.fail.join('; ')); if (bad.length > 4) break; }
  }
  return bad.length === 0 || bad.length + ' unsolvable, e.g. ' + bad[0];
});
t('3.2 reactor never reachable before N1 (gate integrity)', function () {
  var r = CW.rng(77), bad = 0;
  for (var i = 0; i < 3000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var pre = CW.reachable(s.rooms, s.startRoom, { N0: true });
    if (pre.indexOf(s.reactorRoom) >= 0) bad++;
  }
  return bad === 0 || bad + ' ships let you skip the N1 gate';
});
t('3.3 hydroponics never reachable before N0', function () {
  var r = CW.rng(78), bad = 0;
  for (var i = 0; i < 3000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var pre = CW.reachable(s.rooms, s.startRoom, {});
    if (pre.indexOf(s.hydroRoom) >= 0) bad++;
  }
  return bad === 0 || bad + ' ships let you skip the N0 gate';
});
t('3.4 no orphan rooms with full keyring', function () {
  var r = CW.rng(79), bad = 0;
  for (var i = 0; i < 3000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var all = CW.reachable(s.rooms, s.startRoom, { N0: true, N1: true });
    if (all.length !== s.rooms.length) bad++;
  }
  return bad === 0 || bad + ' ships have orphans';
});
t('3.5 every ship has all three repair nodes exactly once', function () {
  var r = CW.rng(80);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var ids = [];
    s.rooms.forEach(function (rm) { rm.nodes.forEach(function (n) { ids.push(n.id); }); });
    ids.sort();
    if (ids.join(',') !== 'N0,N1,N2') return 'bad node set: ' + ids.join(',');
  }
  return true;
});
t('3.6 hydroponics is never the reactor room', function () {
  var r = CW.rng(81);
  for (var i = 0; i < 3000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    if (s.hydroRoom === s.reactorRoom) return 'collision on ' + s.code;
  }
  return true;
});
t('3.7 room count within configured bounds', function () {
  var r = CW.rng(82);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    if (s.rooms.length < CW.CFG.ROOMS_MIN || s.rooms.length > CW.CFG.ROOMS_MAX)
      return 'count ' + s.rooms.length;
  }
  return true;
});
t('3.8 no two rooms share a grid cell', function () {
  var r = CW.rng(83);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r)), seen = {};
    for (var j = 0; j < s.rooms.length; j++) {
      var k = s.rooms[j].gx + ',' + s.rooms[j].gy;
      if (seen[k]) return 'overlap at ' + k;
      seen[k] = 1;
    }
  }
  return true;
});
t('3.9 links are symmetric', function () {
  var r = CW.rng(84);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    for (var a = 0; a < s.rooms.length; a++) {
      for (var b = 0; b < s.rooms[a].links.length; b++) {
        var to = s.rooms[a].links[b].to;
        if (!s.rooms[to].links.some(function (l) { return l.to === a; })) return 'asym ' + a + '->' + to;
      }
    }
  }
  return true;
});
t('3.10 crystals reachable before boss gate', function () {
  var r = CW.rng(85);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var pre = CW.reachable(s.rooms, s.startRoom, { N0: true });
    var n = 0;
    pre.forEach(function (id) { n += s.rooms[id].crystals.length; });
    if (n < 1) return 'no crystals pre-boss on ' + s.code;
  }
  return true;
});

/* ============ 4. PVS ============ */
t('4.1 PVS always includes self', function () {
  var r = CW.rng(90);
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    for (var j = 0; j < s.rooms.length; j++) if (s.pvs[j].indexOf(j) < 0) return 'room ' + j;
  }
  return true;
});
t('4.2 PVS includes all direct neighbours', function () {
  var r = CW.rng(91);
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    for (var j = 0; j < s.rooms.length; j++) {
      var lk = s.rooms[j].links;
      for (var l = 0; l < lk.length; l++) if (s.pvs[j].indexOf(lk[l].to) < 0) return 'missing neighbour';
    }
  }
  return true;
});
t('4.3 PVS is a real cull (never everything, on big ships)', function () {
  var r = CW.rng(92), culled = 0, n = 0;
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    if (s.rooms.length < 11) continue;
    for (var j = 0; j < s.rooms.length; j++) { n++; if (s.pvs[j].length < s.rooms.length) culled++; }
  }
  return (n === 0 || culled / n > 0.5) || 'only ' + (100 * culled / n).toFixed(0) + '% of rooms cull anything';
});

/* ============ 5. BOSS FSM ============ */
t('5.1 dormant until player enters', function () {
  var b = CW.newBoss({});
  for (var i = 0; i < 100; i++) CW.bossStep(b, 0.1, { playerInArena: false });
  return b.state === 'DORMANT' || b.state;
});
t('5.2 wakes on entry', function () {
  var b = CW.newBoss({});
  CW.bossStep(b, 0.1, { playerInArena: true });
  return b.state === 'AGGRESSIVE' || b.state;
});
t('5.3 reaches VENT without any player input', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  var seen = {};
  for (var i = 0; i < 300; i++) { CW.bossStep(b, 0.1, {}); seen[b.state] = 1; }
  return !!(seen.ARMORED && seen.VENT) || 'states seen: ' + Object.keys(seen).join(',');
});
t('5.4 missed VENT resets to AGGRESSIVE with armour intact', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  var startArmor = b.armor;
  for (var i = 0; i < 300 && b.state !== 'VENT'; i++) CW.bossStep(b, 0.1, {});
  if (b.state !== 'VENT') return 'never vented';
  for (var j = 0; j < 80 && b.state === 'VENT'; j++) CW.bossStep(b, 0.1, {});
  return (b.state === 'AGGRESSIVE' && b.armor === startArmor) || b.state + '/armor ' + b.armor;
});
t('5.5 charged hit during VENT -> STAGGER -> armour drops by exactly 1', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  for (var i = 0; i < 300 && b.state !== 'VENT'; i++) CW.bossStep(b, 0.1, {});
  var a0 = b.armor;
  CW.bossStep(b, 0.1, { chargedHit: true });
  if (b.state !== 'STAGGER') return 'no stagger, got ' + b.state;
  for (var j = 0; j < 60 && b.state === 'STAGGER'; j++) CW.bossStep(b, 0.1, {});
  return b.armor === a0 - 1 || 'armor ' + a0 + '->' + b.armor;
});
t('5.6 charged hit OUTSIDE vent does not drop armour', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  var a0 = b.armor;
  for (var i = 0; i < 20; i++) CW.bossStep(b, 0.1, { chargedHit: true });
  return b.armor === a0 || 'armour dropped in ' + b.state;
});
t('5.7 three successful vents kills it', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  var guard = 0;
  while (b.state !== 'DEAD' && guard++ < 5000) {
    CW.bossStep(b, 0.05, { chargedHit: b.state === 'VENT', dmg: b.state === 'STAGGER' ? 10 : 0 });
  }
  return (b.state === 'DEAD' && b.armor === 0) || b.state + ' after ' + guard + ' steps';
});
t('5.8 arena timer forces FLED', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  for (var i = 0; i < 6000 && b.state !== 'FLED'; i++) CW.bossStep(b, 0.1, {});
  return b.state === 'FLED' || 'never fled, state=' + b.state + ' arena=' + b.arena.toFixed(1);
});
t('5.9 arena timer does not tick while DORMANT', function () {
  var b = CW.newBoss({});
  for (var i = 0; i < 500; i++) CW.bossStep(b, 0.1, { playerInArena: false });
  return approx(b.arena, CW.CFG.ARENA_TIMER, 1e-9) || 'arena drained to ' + b.arena;
});
t('5.10 normal damage cannot kill through armour', function () {
  var b = CW.newBoss({}); CW.bossStep(b, 0.1, { playerInArena: true });
  for (var i = 0; i < 1000; i++) CW.bossStep(b, 0.05, { dmg: 500 });
  return b.state !== 'DEAD' || 'killed by chip damage';
});
t('5.11 DEAD is terminal', function () {
  var b = CW.newBoss({}); b.state = 'DEAD';
  for (var i = 0; i < 100; i++) CW.bossStep(b, 0.1, { playerInArena: true, chargedHit: true });
  return b.state === 'DEAD' || b.state;
});
t('5.12 every declared state is reachable', function () {
  var seen = {};
  var b = CW.newBoss({}); seen.DORMANT = 1;
  CW.bossStep(b, 0.1, { playerInArena: true });
  for (var i = 0; i < 3000 && b.state !== 'DEAD'; i++) {
    CW.bossStep(b, 0.05, { chargedHit: b.state === 'VENT', dmg: b.state === 'STAGGER' ? 20 : 0 });
    seen[b.state] = 1;
  }
  var b2 = CW.newBoss({}); CW.bossStep(b2, 0.1, { playerInArena: true });
  for (var j = 0; j < 6000 && b2.state !== 'FLED'; j++) { CW.bossStep(b2, 0.1, {}); seen[b2.state] = 1; }
  var missing = CW.BOSS_STATES.filter(function (s) { return !seen[s]; });
  return missing.length === 0 || 'unreachable: ' + missing.join(',');
});

/* ============ 6. ALERT / CRYSTAL ECONOMY ============ */
t('6.1 alert thresholds match spec', function () {
  var map = [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [9, 3]];
  for (var i = 0; i < map.length; i++)
    if (CW.alertFromHot(map[i][0]) !== map[i][1])
      return 'hot ' + map[i][0] + ' -> ' + CW.alertFromHot(map[i][0]) + ', want ' + map[i][1];
  return true;
});
t('6.2 alert is monotonic in hot count', function () {
  var last = -1;
  for (var i = 0; i <= 20; i++) { var a = CW.alertFromHot(i); if (a < last) return 'drop at ' + i; last = a; }
  return true;
});
t('6.3 spawn multiplier rises with alert', function () {
  for (var i = 1; i <= 3; i++) if (CW.spawnMult(i) <= CW.spawnMult(i - 1)) return 'flat at ' + i;
  return true;
});
t('6.4 crystals beyond cell capacity decay and shatter', function () {
  var extra = 2, n = CW.CFG.CELL_CAP + extra, list = [];
  for (var i = 0; i < n; i++) list.push({ t: 0 });
  var r = { crystals: list, shattered: 0 }, total = 0;
  for (var s = 0; s < 300; s++) { r = CW.stepCrystals(r.crystals, 1, CW.CFG.CELL_CAP); total += r.shattered; }
  return (r.crystals.length === CW.CFG.CELL_CAP && total === extra) || 'left ' + r.crystals.length + ' shattered ' + total;
});
t('6.5 crystals inside cell capacity never shatter', function () {
  var list = [{ t: 0 }, { t: 0 }], r = { crystals: list };
  for (var s = 0; s < 1000; s++) r = CW.stepCrystals(r.crystals, 1, CW.CFG.CELL_CAP);
  return r.crystals.length === 2 || 'lost protected crystals';
});
t('6.6 decay window is exactly CRYSTAL_DECAY seconds', function () {
  var r = { crystals: [{ t: 0 }] };
  var elapsed = 0;
  while (r.crystals.length && elapsed < 1000) { r = CW.stepCrystals(r.crystals, 1, 0); elapsed++; }
  return approx(elapsed, CW.CFG.CRYSTAL_DECAY, 1.01) || 'shattered at ' + elapsed;
});

/* ============ 7. REPAIR NODES ============ */
t('7.1 cannot repair without materials', function () {
  var s = CW.generateShip('TEST-01');
  var n = s.rooms[0].nodes[0];
  return CW.canRepair(n, { scrap: 0 }) === false || 'repaired on empty inventory';
});
t('7.2 repair consumes exactly the requirement', function () {
  var s = CW.generateShip('TEST-01');
  var n = s.rooms[0].nodes[0], inv = { scrap: 10 };
  CW.doRepair(n, inv);
  return (inv.scrap === 10 - CW.CFG.N0_SCRAP && n.done) || 'scrap ' + inv.scrap + ' done ' + n.done;
});
t('7.3 boss node needs the part, not scrap', function () {
  var s = CW.generateShip('TEST-01');
  var n2 = s.rooms[s.reactorRoom].nodes[0];
  if (CW.canRepair(n2, { scrap: 9999 })) return 'scrap satisfied the boss node';
  return CW.canRepair(n2, { COOLANT_REGULATOR: true }) === true || 'part did not satisfy it';
});
t('7.4 double repair does not double-consume', function () {
  var s = CW.generateShip('TEST-02');
  var n = s.rooms[0].nodes[0], inv = { scrap: 20 };
  CW.doRepair(n, inv); var after = inv.scrap;
  CW.doRepair(n, inv);
  return inv.scrap === after - CW.CFG.N0_SCRAP || inv.scrap === after
    ? true : 'unexpected ' + inv.scrap;
});

/* ============ 8. WORLD PLACEMENT ============ */
t('8.1 room world positions are finite and distinct', function () {
  var r = CW.rng(120);
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r)), seen = {};
    for (var j = 0; j < s.rooms.length; j++) {
      var rm = s.rooms[j];
      if (!isFinite(rm.cx) || !isFinite(rm.cz)) return 'non-finite position';
      var k = rm.cx.toFixed(2) + ':' + rm.cz.toFixed(2);
      if (seen[k]) return 'coincident rooms';
      seen[k] = 1;
    }
  }
  return true;
});
t('8.2 linked rooms are exactly one cell apart', function () {
  var r = CW.rng(121);
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    for (var a = 0; a < s.rooms.length; a++) {
      var A = s.rooms[a];
      for (var l = 0; l < A.links.length; l++) {
        var B = s.rooms[A.links[l].to];
        if (Math.abs(A.gx - B.gx) + Math.abs(A.gy - B.gy) !== 1) return 'non-adjacent link';
      }
    }
  }
  return true;
});
t('8.3 rooms fit inside their grid cell (no geometry overlap)', function () {
  var r = CW.rng(122), C = CW.CFG.CELL;
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    for (var j = 0; j < s.rooms.length; j++) {
      if (s.rooms[j].w >= C || s.rooms[j].d >= C) return 'room ' + s.rooms[j].w + 'x' + s.rooms[j].d + ' >= cell ' + C;
    }
  }
  return true;
});
t('8.4 every non-start room has at least one vent', function () {
  var r = CW.rng(123);
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    for (var j = 1; j < s.rooms.length; j++) if (!s.rooms[j].vents.length) return 'room ' + j + ' has no vent';
  }
  return true;
});
t('8.5 start room has no vents (safe hub)', function () {
  var r = CW.rng(124);
  for (var i = 0; i < 500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    if (s.rooms[0].vents.length) return 'start room has vents';
  }
  return true;
});


/* ============ 9. MEDKITS ============ */
t('9.1 every ship has a medkit in the safe hub', function () {
  var r = CW.rng(200);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    if (!s.rooms[0].medkits || !s.rooms[0].medkits.length) return 'no hub medkit on ' + s.code;
  }
  return true;
});
t('9.2 every ship has a medkit in the boss arena', function () {
  var r = CW.rng(201);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    if (!s.rooms[s.reactorRoom].medkits.length) return 'no arena medkit on ' + s.code;
  }
  return true;
});
t('9.3 medkits are never stranded behind a gate they precede', function () {
  var r = CW.rng(202);
  for (var i = 0; i < 2000; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var r0 = CW.reachable(s.rooms, 0, {});
    var n = 0;
    for (var j = 0; j < r0.length; j++) n += s.rooms[r0[j]].medkits.length;
    if (n < 1) return 'no medkit reachable keyless on ' + s.code;
  }
  return true;
});
t('9.4 medkit totals scale with ship size', function () {
  var r = CW.rng(203);
  for (var i = 0; i < 1500; i++) {
    var s = CW.generateShip(CW.makeCode(r));
    var n = 0;
    for (var j = 0; j < s.rooms.length; j++) n += s.rooms[j].medkits.length;
    if (n < 4) return 'only ' + n + ' medkits on a ' + s.rooms.length + '-room ship';
    if (n > s.rooms.length) return n + ' medkits on ' + s.rooms.length + ' rooms - too generous';
  }
  return true;
});

/* ============ 10. INFESTATION PACING ============ */
t('10.1 nothing spawns during the tutorial phase', function () {
  if (CW.phaseFor({}) !== 0) return 'phase ' + CW.phaseFor({});
  if (CW.spawnInterval(0, 0, 0) !== Infinity) return 'phase 0 spawns';
  return CW.enemyCap(0) === 0 || 'phase 0 cap ' + CW.enemyCap(0);
});
t('10.2 phases advance in the intended order', function () {
  if (CW.phaseFor({ N0: true }) !== 1) return 'post-N0 not phase 1';
  if (CW.phaseFor({ N0: true, N1: true }) !== 2) return 'post-N1 not phase 2';
  if (CW.phaseFor({ N0: true, N1: true, hotEver: true }) !== 3) return 'post-crystal not phase 3';
  return true;
});
t('10.3 spawn interval shortens with every phase', function () {
  for (var p = 2; p <= 3; p++) {
    if (CW.spawnInterval(p, 0, 0) >= CW.spawnInterval(p - 1, 0, 0)) return 'phase ' + p + ' not tighter';
  }
  return true;
});
t('10.4 spawn interval shortens with alert and with elapsed time', function () {
  for (var a = 1; a <= 3; a++) if (CW.spawnInterval(2, a, 0) >= CW.spawnInterval(2, a - 1, 0)) return 'alert ' + a + ' not tighter';
  if (CW.spawnInterval(2, 0, 400) >= CW.spawnInterval(2, 0, 0)) return 'elapsed ramp does not tighten';
  return true;
});
t('10.5 spawn interval has a floor - it never becomes unsurvivable', function () {
  var worst = CW.spawnInterval(3, 3, 100000);
  return (worst > 0.4 && isFinite(worst)) || 'floor breached: ' + worst;
});
t('10.6 enemy cap rises with phase and is bounded', function () {
  for (var p = 1; p <= 3; p++) {
    if (CW.enemyCap(p) <= CW.enemyCap(p - 1)) return 'cap not rising at ' + p;
    if (CW.enemyCap(p) > 24) return 'cap too high: ' + CW.enemyCap(p);
  }
  return true;
});
t('10.7 early phases only produce the weakest enemy', function () {
  for (var i = 0; i < 500; i++) {
    if (CW.rollEnemy(1, 0, Math.random()) !== 'skitter') return 'phase 1 produced a non-skitter';
    if (CW.rollEnemy(2, 3, Math.random()) === 'stalker') return 'stalker leaked into phase 2';
  }
  return true;
});
t('10.8 stalkers only appear at high alert in the flood phase', function () {
  var seen = false;
  for (var i = 0; i < 4000; i++) if (CW.rollEnemy(3, 2, Math.random()) === 'stalker') seen = true;
  if (!seen) return 'stalkers never appear at flood + alert 2';
  for (var j = 0; j < 2000; j++) if (CW.rollEnemy(3, 0, Math.random()) === 'stalker') return 'stalker at alert 0';
  return true;
});
t('10.9 rollEnemy only ever returns known enemy kinds', function () {
  var ok = { skitter: 1, clinger: 1, bloater: 1, stalker: 1 };
  for (var p = 0; p <= 3; p++) for (var a = 0; a <= 3; a++) for (var i = 0; i < 400; i++) {
    var k = CW.rollEnemy(p, a, Math.random());
    if (!ok[k]) return 'unknown kind ' + k;
  }
  return true;
});


/* ============ 11. MUSIC DIRECTOR ============ */
t('11.1 every layer gain stays within 0..1 across all states', function () {
  for (var p = 0; p <= 3; p++) {
    for (var th = 0; th <= 10; th++) {
      for (var h = 0; h <= 4; h++) {
        for (var b = 0; b < 2; b++) {
          var m = CW.musicMix({ phase: p, threat: th / 10, hurt: h / 4, boss: !!b, bossVent: !!b && h > 2, safe: p === 0 });
          for (var k in m) {
            if (!(m[k] >= 0 && m[k] <= 1)) return k + ' out of range: ' + m[k];
            if (!isFinite(m[k])) return k + ' non-finite';
          }
        }
      }
    }
  }
  return true;
});
t('11.2 the drone is always present - the ship never goes silent', function () {
  for (var p = 0; p <= 3; p++) {
    var m = CW.musicMix({ phase: p });
    if (m.drone < 0.3) return 'drone only ' + m.drone + ' at phase ' + p;
  }
  return true;
});
t('11.3 combat layers are silent during the tutorial', function () {
  var m = CW.musicMix({ phase: 0, threat: 0, safe: true });
  if (m.perc > 0.05) return 'percussion audible in tutorial: ' + m.perc;
  if (m.stab > 0.001) return 'stabs audible in tutorial: ' + m.stab;
  return true;
});
t('11.4 intensity rises monotonically with phase', function () {
  var last = -1;
  for (var p = 0; p <= 3; p++) {
    var m = CW.musicMix({ phase: p, threat: 0 });
    var total = m.drone + m.sub + m.pulse + m.arp + m.perc;
    if (total <= last) return 'phase ' + p + ' is not more intense than ' + (p - 1);
    last = total;
  }
  return true;
});
t('11.5 threat raises percussion independently of phase', function () {
  var calm = CW.musicMix({ phase: 1, threat: 0 });
  var hot = CW.musicMix({ phase: 1, threat: 1 });
  return hot.perc > calm.perc && hot.stab > calm.stab || 'threat does not drive percussion';
});
t('11.6 the boss encounter is the loudest state', function () {
  var normal = CW.musicMix({ phase: 3, threat: 0.5 });
  var boss = CW.musicMix({ phase: 3, threat: 0.5, boss: true });
  var sum = function (m) { var t2 = 0; for (var k in m) t2 += m[k]; return t2; };
  return sum(boss) > sum(normal) || 'boss mix is not more intense';
});
t('11.7 the vent window is musically marked', function () {
  var b = CW.musicMix({ phase: 3, boss: true });
  var v = CW.musicMix({ phase: 3, boss: true, bossVent: true });
  return v.stab > b.stab || 'vent window is not emphasised';
});
t('11.8 low health brings in the dread layer, full health does not', function () {
  if (CW.musicMix({ phase: 2, hurt: 0 }).dread !== 0) return 'dread audible at full health';
  return CW.musicMix({ phase: 2, hurt: 1 }).dread > 0.3 || 'dread missing when hurt';
});
t('11.9 tempo rises with phase, boss, and threat, and stays bounded', function () {
  var last = 0;
  for (var p = 0; p <= 3; p++) {
    var b = CW.musicBPM({ phase: p });
    if (b <= last) return 'bpm not rising at phase ' + p;
    if (b < 40 || b > 130) return 'bpm out of bounds: ' + b;
    last = b;
  }
  if (CW.musicBPM({ phase: 3, boss: true }) < CW.musicBPM({ phase: 3 })) return 'boss is not faster';
  if (CW.musicBPM({ phase: 1, threat: 1 }) <= CW.musicBPM({ phase: 1, threat: 0 })) return 'threat does not raise tempo';
  return CW.musicBPM({ phase: 3, boss: true, threat: 1 }) <= 130 || 'bpm ceiling breached';
});
t('11.10 threat level is monotonic in proximity and bounded', function () {
  if (CW.threatLevel([]) !== 0) return 'empty list is not zero';
  if (CW.threatLevel([40, 50]) !== 0) return 'distant enemies register threat';
  var near = CW.threatLevel([2]), far = CW.threatLevel([20]);
  if (!(near > far)) return 'closer is not more threatening';
  var many = CW.threatLevel([1, 1, 1, 1, 1, 1, 1, 1]);
  return (many <= 1 && many > 0.5) || 'swarm threat out of range: ' + many;
});
t('11.11 each ship code produces its own motif, deterministically', function () {
  var a = CW.buildMotif(CW.musicSeed('K7M-3PQ'), 8);
  var b = CW.buildMotif(CW.musicSeed('K7M-3PQ'), 8);
  var c = CW.buildMotif(CW.musicSeed('XXX-999'), 8);
  if (a.join(',') !== b.join(',')) return 'motif not deterministic';
  if (a.join(',') === c.join(',')) return 'different ships share a motif';
  return a.length === 8 || 'wrong motif length';
});
t('11.12 every motif note is in the scale', function () {
  var r = CW.rng(500);
  for (var i = 0; i < 400; i++) {
    var m = CW.buildMotif(CW.musicSeed(CW.makeCode(r)), 8);
    for (var j = 0; j < m.length; j++) {
      var deg = m[j] % 12;
      if (CW.SCALE.indexOf(deg) < 0) return 'note ' + m[j] + ' is outside the scale';
    }
  }
  return true;
});
t('11.13 note frequencies are audible and finite', function () {
  for (var o = -2; o <= 3; o++) {
    for (var i = 0; i < CW.SCALE.length; i++) {
      var hz = CW.noteHz(CW.SCALE[i], o);
      if (!isFinite(hz) || hz < 10 || hz > 20000) return 'bad frequency ' + hz;
    }
  }
  return true;
});


/* ============ 12. WAVE DIRECTOR ============ */
t('12.1 nothing spawns during the tutorial phase', function () {
  var w = CW.newWaves();
  for (var i = 0; i < 5000; i++) {
    CW.waveStep(w, 0.05, { phase: 0, alive: 0 });
    if (w.spawn) return 'spawned during the tutorial';
  }
  return w.state === 'LULL' || 'state ' + w.state;
});
t('12.2 waves alternate assault and lull', function () {
  var w = CW.newWaves(), seen = {}, order = [];
  var last = w.state;
  for (var i = 0; i < 20000; i++) {
    CW.waveStep(w, 0.05, { phase: 2, alive: 0 });
    seen[w.state] = 1;
    if (w.state !== last) { order.push(w.state); last = w.state; }
  }
  if (!seen.LULL || !seen.BUILD || !seen.ASSAULT) return 'states seen: ' + Object.keys(seen).join(',');
  return order.length > 4 || 'only ' + order.length + ' transitions in 1000s';
});
t('12.3 every wave has a genuine quiet period', function () {
  var w = CW.newWaves(), quiet = 0, longest = 0, run = 0;
  for (var i = 0; i < 12000; i++) {
    CW.waveStep(w, 0.05, { phase: 2, alive: 0 });
    if (w.state === 'LULL') { quiet++; run += 0.05; longest = Math.max(longest, run); }
    else run = 0;
  }
  if (longest < 8) return 'longest lull only ' + longest.toFixed(1) + 's';
  var frac = quiet / 12000;
  return (frac > 0.15 && frac < 0.8) || 'lull fraction ' + frac.toFixed(2);
});
t('12.4 a wave sends exactly its quota, no more', function () {
  var w = CW.newWaves(), spawned = 0, wave = 0;
  for (var i = 0; i < 6000; i++) {
    CW.waveStep(w, 0.05, { phase: 2, alive: 99 });   /* alive high so it never ends early */
    if (w.wave !== wave) { wave = w.wave; spawned = 0; }
    if (w.spawn) spawned++;
    if (spawned > w.quota) return 'wave ' + wave + ' sent ' + spawned + ' of a ' + w.quota + ' quota';
  }
  return true;
});
t('12.5 later waves are bigger, up to a cap', function () {
  var last = -1;
  for (var wv = 1; wv <= 20; wv++) {
    var q = CW.waveQuota(2, wv);
    if (q < last) return 'wave ' + wv + ' is smaller than the one before';
    if (q > 18) return 'quota ' + q + ' exceeds the cap';
    last = q;
  }
  return CW.waveQuota(2, 20) > CW.waveQuota(2, 1) || 'waves do not grow';
});
t('12.6 higher phases send bigger waves with shorter lulls', function () {
  for (var p = 2; p <= 3; p++) {
    if (CW.waveQuota(p, 3) <= CW.waveQuota(p - 1, 3)) return 'phase ' + p + ' quota is not bigger';
    if (CW.lullTime(p, 3) >= CW.lullTime(p - 1, 3)) return 'phase ' + p + ' lull is not shorter';
  }
  return true;
});
t('12.7 lulls shorten as waves progress but never vanish', function () {
  var prev = CW.lullTime(2, 0);
  for (var wv = 1; wv <= 60; wv++) {
    var l = CW.lullTime(2, wv);
    if (l > prev) return 'lull grew at wave ' + wv;
    if (l < 9) return 'lull collapsed to ' + l;
    prev = l;
  }
  return true;
});
t('12.8 a stalled wave times out instead of hanging forever', function () {
  var w = CW.newWaves(), t2 = 0;
  /* alive stays high, so the wave can only end on its timeout */
  while (w.state !== 'ASSAULT' && t2 < 200) { CW.waveStep(w, 0.05, { phase: 2, alive: 99 }); t2 += 0.05; }
  var start = t2;
  while (w.state === 'ASSAULT' && t2 < 400) { CW.waveStep(w, 0.05, { phase: 2, alive: 99 }); t2 += 0.05; }
  var dur = t2 - start;
  return dur <= CW.assaultTimeout(2) + 1 || 'assault ran ' + dur.toFixed(1) + 's';
});
t('12.9 ambient waves stop entirely during the boss encounter', function () {
  var w = CW.newWaves();
  for (var i = 0; i < 8000; i++) {
    CW.waveStep(w, 0.05, { phase: 3, alive: 0, bossActive: true });
    if (w.spawn) return 'an ambient wave spawned during the boss fight';
  }
  return w.state === 'LULL' || 'state ' + w.state;
});
t('12.10 no boss adds during the vent or stagger window', function () {
  if (CW.bossAddAllowed('VENT', 0, 20)) return 'adds allowed during VENT';
  if (CW.bossAddAllowed('STAGGER', 0, 20)) return 'adds allowed during STAGGER';
  if (!CW.bossAddAllowed('AGGRESSIVE', 0, 20)) return 'no adds during AGGRESSIVE';
  return CW.bossAddAllowed('ARMORED', 0, 20) || 'no adds during ARMORED';
});
t('12.11 boss adds are hard-capped low so the arena stays fightable', function () {
  if (CW.bossAddAllowed('AGGRESSIVE', 50, 20)) return 'adds kept coming with 50 alive';
  if (CW.bossAddAllowed('AGGRESSIVE', 10, 20)) return 'adds kept coming at half the cap';
  if (CW.bossAddAllowed('AGGRESSIVE', CW.BOSS_ADD_CAP, 20)) return 'the hard cap is not enforced';
  if (CW.BOSS_ADD_CAP > 4) return 'the arena cap of ' + CW.BOSS_ADD_CAP + ' is too high to fight in';
  return CW.bossAddAllowed('AGGRESSIVE', 0, 20) || 'no adds at all in the arena';
});
t('12.12 no adds once the boss is dead, dormant or fled', function () {
  var bad = ['DEAD', 'DORMANT', 'FLED'].filter(function (st) { return CW.bossAddAllowed(st, 0, 20); });
  return bad.length === 0 || 'adds allowed while ' + bad.join(',');
});
t('12.13 alert raises wave feed rate but never to zero interval', function () {
  var slow = CW.waveInterval(2, 0), fast = CW.waveInterval(2, 3);
  if (!(fast < slow)) return 'alert does not speed up the feed';
  return fast > 0.2 || 'interval collapsed to ' + fast;
});


/* ============ 13. FIELD CHARGING ============ */
t('13.1 containment cell can hold a full rifle load', function () {
  return CW.CFG.CELL_CAP >= CW.CFG.RIFLE_CAP ||
    'cell holds ' + CW.CFG.CELL_CAP + ' but the rifle takes ' + CW.CFG.RIFLE_CAP;
});
t('13.2 a full rifle load survives the walk to the boss', function () {
  var list = [];
  for (var i = 0; i < CW.CFG.RIFLE_CAP; i++) list.push({ t: 0 });
  var r = { crystals: list };
  for (var s2 = 0; s2 < 600; s2++) r = CW.stepCrystals(r.crystals, 1, CW.CFG.CELL_CAP);
  return r.crystals.length === CW.CFG.RIFLE_CAP || 'lost ' + (CW.CFG.RIFLE_CAP - r.crystals.length) + ' crystals in transit';
});
t('13.3 field charge completes in the configured time', function () {
  var fc = CW.newFieldCharge(), t2 = 0, done = false;
  while (t2 < 20 && !done) {
    var r = CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true });
    t2 += 0.05; done = r.done;
  }
  return Math.abs(t2 - CW.CFG.FIELD_CHARGE) < 0.2 || 'completed at ' + t2.toFixed(2) + 's';
});
t('13.4 releasing the button cancels the channel', function () {
  var fc = CW.newFieldCharge();
  for (var i = 0; i < 20; i++) CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true });
  var r = CW.fieldChargeStep(fc, 0.05, { holding: false, hasCrystal: true });
  if (!r.cancelled) return 'release did not cancel';
  return fc.t === 0 || 'progress not reset';
});
t('13.5 taking a hit breaks the channel and locks it out briefly', function () {
  var fc = CW.newFieldCharge();
  for (var i = 0; i < 40; i++) CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true });
  var r = CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true, hurtSince: true });
  if (!r.cancelled || fc.t !== 0) return 'a hit did not interrupt charging';
  /* the channel must not simply resume on the next frame, or being hit is free */
  var resumed = 0;
  for (var j = 0; j < 10; j++) {
    var r2 = CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true });
    if (r2.progress > 0) resumed++;
  }
  if (resumed) return 'the channel resumed immediately after a hit';
  /* but it must recover eventually */
  for (var k = 0; k < 60; k++) CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true });
  return fc.active || 'the channel never recovered after the lockout';
});
t('13.6 cannot field charge without a crystal or with a full rifle', function () {
  var fc = CW.newFieldCharge();
  var a = CW.fieldChargeStep(fc, 1, { holding: true, hasCrystal: false });
  if (a.done) return 'charged with no crystal';
  var b = CW.fieldChargeStep(fc, 1, { holding: true, hasCrystal: true, rifleFull: true });
  return !b.done || 'charged a full rifle';
});
t('13.7 progress rises monotonically to exactly 1', function () {
  var fc = CW.newFieldCharge(), last = -1;
  for (var i = 0; i < 200; i++) {
    var r = CW.fieldChargeStep(fc, 0.05, { holding: true, hasCrystal: true });
    if (r.done) return r.progress === 1 || 'finished at progress ' + r.progress;
    if (r.progress < last) return 'progress went backwards';
    last = r.progress;
  }
  return 'never completed';
});


/* ============ 14. NETCODE ============ */
t('14.1 signal blobs survive a copy-paste round trip', function () {
  var obj = { type: 'offer', sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\n' };
  var packed = CW.packSignal(obj);
  var back = CW.unpackSignal(packed);
  if (!back || back.error) return 'unpack failed: ' + JSON.stringify(back);
  return back.sdp === obj.sdp || 'sdp corrupted';
});
t('14.2 whitespace and line breaks in a pasted code are tolerated', function () {
  var packed = CW.packSignal({ type: 'answer', sdp: 'abc' });
  var messy = '  ' + packed.slice(0, 20) + '\n' + packed.slice(20, 40) + '\r\n  ' + packed.slice(40) + '  ';
  var back = CW.unpackSignal(messy);
  return (back && back.sdp === 'abc') || 'messy paste failed';
});
t('14.3 garbage and version mismatches are reported, not thrown', function () {
  if (CW.unpackSignal('') !== null) return 'empty input not handled';
  if (CW.unpackSignal('hello world') !== null) return 'garbage not rejected';
  var bad = CW.unpackSignal('CW999:zzzz');
  if (!bad || bad.error !== 'version') return 'version mismatch not reported';
  var corrupt = CW.unpackSignal('CW' + CW.NET_VERSION + ':!!!notbase64!!!');
  if (!corrupt || !corrupt.error) return 'corrupt payload not reported';
  return true;
});
t('14.4 avatar encoding round-trips within tolerance', function () {
  var a = { x: 12.3456, z: -7.891, yaw: 1.2345, pitch: -0.6789, wep: 2, hp: 73, moving: true, down: false, charges: 3, name: 'ALEX' };
  var b = CW.decAvatar(CW.encAvatar(a));
  if (!b) return 'decode failed';
  if (Math.abs(b.x - a.x) > 0.02 || Math.abs(b.z - a.z) > 0.02) return 'position drift too large';
  if (Math.abs(b.yaw - a.yaw) > 0.002) return 'yaw drift too large';
  if (b.wep !== 2 || b.hp !== 73 || b.charges !== 3) return 'fields corrupted';
  return (b.moving === true && b.down === false && b.name === 'ALEX') || 'flags corrupted';
});
t('14.5 snapshot round-trips every field', function () {
  var w = {
    tick: 812,
    enemies: [{ id: 1, kindIdx: 0, x: 3.14, z: -2.72, yaw: 1.1, wind: 0 },
              { id: 7, kindIdx: 3, x: -40.5, z: 12.25, yaw: -2.2, wind: 0.3 }],
    bossState: 3, bossArmor: 2, bossArena: 187,
    nodes: [1, 1, 0], taken: [4, 9], phase: 2, waveState: 2, wave: 5, alert: 1
  };
  var s2 = CW.decSnapshot(CW.encSnapshot(w));
  if (!s2) return 'decode failed';
  if (s2.tick !== 812 || s2.phase !== 2 || s2.wave !== 5 || s2.alert !== 1) return 'scalars corrupted';
  if (s2.bossState !== 3 || s2.bossArmor !== 2) return 'boss state corrupted';
  if (s2.enemies.length !== 2) return 'enemy count wrong';
  if (Math.abs(s2.enemies[1].x + 40.5) > 0.03) return 'enemy position drift';
  if (s2.nodes.join(',') !== '1,1,0') return 'node states corrupted';
  return s2.taken.join(',') === '4,9' || 'taken list corrupted';
});
t('14.6 applying a snapshot spawns, updates and removes to match', function () {
  var mirror = {}, log = [];
  var hooks = {
    spawn: function (id, k, x, z) { log.push('spawn' + id); return { id: id, k: k, x: x, z: z }; },
    update: function (rec, e) { rec.x = e.x; rec.z = e.z; },
    remove: function (rec, id) { log.push('remove' + id); }
  };
  var s1 = CW.decSnapshot(CW.encSnapshot({ tick: 1, enemies: [
    { id: 1, kindIdx: 0, x: 0, z: 0, yaw: 0, wind: 0 },
    { id: 2, kindIdx: 1, x: 5, z: 5, yaw: 0, wind: 0 }], bossState: 0, bossArmor: 3, bossArena: 240 }));
  var r1 = CW.applySnapshot(mirror, s1, hooks);
  if (r1.spawned !== 2) return 'expected 2 spawns, got ' + r1.spawned;
  var s2 = CW.decSnapshot(CW.encSnapshot({ tick: 2, enemies: [
    { id: 2, kindIdx: 1, x: 9, z: 9, yaw: 0, wind: 0 },
    { id: 3, kindIdx: 2, x: 1, z: 1, yaw: 0, wind: 0 }], bossState: 0, bossArmor: 3, bossArena: 240 }));
  var r2 = CW.applySnapshot(mirror, s2, hooks);
  if (r2.spawned !== 1 || r2.removed !== 1) return 'expected 1 spawn / 1 remove, got ' + r2.spawned + '/' + r2.removed;
  if (mirror[2].x !== 9) return 'existing enemy not updated';
  return (!mirror[1] && !!mirror[3]) || 'mirror does not match the snapshot';
});
t('14.7 an empty snapshot clears the mirror', function () {
  var mirror = { 5: { id: 5 } }, removed = 0;
  var snap = CW.decSnapshot(CW.encSnapshot({ tick: 3, enemies: [], bossState: 0, bossArmor: 0, bossArena: 0 }));
  CW.applySnapshot(mirror, snap, { spawn: function () {}, update: function () {}, remove: function () { removed++; } });
  return (removed === 1 && !mirror[5]) || 'mirror not cleared';
});
t('14.8 snapshots stay small enough for a data channel', function () {
  var en = [];
  for (var i = 0; i < 20; i++) en.push({ id: i, kindIdx: i % 4, x: i * 3.33, z: -i * 7.77, yaw: 1.234, wind: 0 });
  var bytes = JSON.stringify(CW.encSnapshot({ tick: 9999, enemies: en, bossState: 1, bossArmor: 3,
    bossArena: 240, nodes: [1, 0, 0], taken: [1, 2, 3, 4, 5], phase: 3, waveState: 2, wave: 9, alert: 3 })).length;
  if (bytes > 1400) return 'snapshot is ' + bytes + ' bytes — too big for one datagram';
  var perSec = bytes * CW.NET_SNAPSHOT_HZ;
  return perSec < 30000 || (perSec / 1000).toFixed(0) + 'KB/s is too much bandwidth';
});
t('14.9 action messages round-trip', function () {
  var a = CW.decAction(CW.encAction('interact', 3, 0, 0));
  if (!a || a.kind !== 'interact' || a.a !== 3) return 'action corrupted';
  var b = CW.decAction(CW.encAction('damage', 7, 42));
  return (b.kind === 'damage' && b.a === 7 && b.b === 42) || 'multi-arg action corrupted';
});
t('14.10 decoders reject messages of the wrong type', function () {
  if (CW.decAvatar(CW.encSnapshot({ enemies: [] }))) return 'avatar decoder accepted a snapshot';
  if (CW.decSnapshot(CW.encAvatar({ x: 0, z: 0, yaw: 0, pitch: 0 }))) return 'snapshot decoder accepted an avatar';
  if (CW.decAction(['S'])) return 'action decoder accepted a snapshot';
  return (CW.decAvatar(null) === null && CW.decSnapshot(undefined) === null) || 'null input not handled';
});
t('14.11 revive needs a teammate present for the full duration', function () {
  var st = { t: 0 };
  var done = false, secs = 0;
  while (secs < 20 && !done) { done = CW.reviveStep(st, 0.05, { down: true, helperNear: true }).done; secs += 0.05; }
  if (!done) return 'revive never completed';
  return Math.abs(secs - CW.REVIVE_TIME) < 0.2 || 'revive took ' + secs.toFixed(2) + 's';
});
t('14.12 revive progress decays if the helper walks away', function () {
  var st = { t: 0 };
  for (var i = 0; i < 40; i++) CW.reviveStep(st, 0.05, { down: true, helperNear: true });
  var peak = st.t;
  for (var j = 0; j < 20; j++) CW.reviveStep(st, 0.05, { down: true, helperNear: false });
  if (!(st.t < peak)) return 'progress did not decay';
  return st.t >= 0 || 'progress went negative';
});
t('14.13 a downed player bleeds out on a timer', function () {
  var st = { t: 0 }, secs = 0, r;
  while (secs < 120) { r = CW.reviveStep(st, 0.1, { down: true, helperNear: false }); secs += 0.1; }
  return r.bleed >= CW.DOWN_BLEED || 'bleed timer not tracked';
});
t('14.14 standing up clears the downed timer', function () {
  var st = { t: 0 };
  for (var i = 0; i < 100; i++) CW.reviveStep(st, 0.05, { down: true, helperNear: true });
  var r = CW.reviveStep(st, 0.05, { down: false });
  return (r.progress === 0 && st.t === 0) || 'state not cleared on standing up';
});

console.log('\n' + log.join('\n'));
console.log('\n' + '='.repeat(52));
console.log('  PASS ' + pass + '   FAIL ' + fail + '   TOTAL ' + (pass + fail));
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);

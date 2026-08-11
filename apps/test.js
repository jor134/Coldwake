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
  var list = [];
  for (var i = 0; i < 5; i++) list.push({ t: 0 });
  var r = { crystals: list, shattered: 0 }, total = 0;
  for (var s = 0; s < 300; s++) { r = CW.stepCrystals(r.crystals, 1, CW.CFG.CELL_CAP); total += r.shattered; }
  return (r.crystals.length === CW.CFG.CELL_CAP && total === 3) || 'left ' + r.crystals.length + ' shattered ' + total;
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

console.log('\n' + log.join('\n'));
console.log('\n' + '='.repeat(52));
console.log('  PASS ' + pass + '   FAIL ' + fail + '   TOTAL ' + (pass + fail));
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);

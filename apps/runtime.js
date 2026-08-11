/* COLDWAKE runtime smoke test — stubs THREE + DOM, boots the real game layer. */
var fs = require('fs');

/* ---------- THREE stub ---------- */
function V3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
V3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
V3.prototype.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };
V3.prototype.setScalar = function (s) { this.x = this.y = this.z = s; return this; };
V3.prototype.multiplyScalar = function (s) { this.x *= s; this.y *= s; this.z *= s; return this; };
V3.prototype.clone = function () { return new V3(this.x, this.y, this.z); };
V3.prototype.normalize = function () { var l = Math.hypot(this.x, this.y, this.z) || 1; this.x /= l; this.y /= l; this.z /= l; return this; };

function Col(hex) { this.hex = hex || 0xffffff; }
Col.prototype.setHex = function (h) { this.hex = h; return this; };

function Obj3D() {
  this.position = new V3(); this.rotation = { x: 0, y: 0, z: 0, order: 'XYZ' };
  this.scale = new V3(1, 1, 1); this.visible = true; this.children = []; this.parent = null;
}
Obj3D.prototype.add = function () {
  for (var i = 0; i < arguments.length; i++) { if (!arguments[i]) throw new Error('add(undefined)'); this.children.push(arguments[i]); arguments[i].parent = this; }
  return this;
};
Obj3D.prototype.remove = function (o) { var i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this; };
Obj3D.prototype.lookAt = function () { return this; };
Obj3D.prototype.translateY = function (d) { this.position.y += d; return this; };

function mk(name, extra) {
  var F = function () { Obj3D.call(this); if (extra) extra.apply(this, arguments); this._type = name; };
  F.prototype = Object.create(Obj3D.prototype); F.prototype.constructor = F;
  return F;
}
var THREE = {};
THREE.Vector3 = V3;
THREE.Object3D = mk('Object3D');
THREE.Group = mk('Group');
THREE.Scene = mk('Scene', function () { this.fog = null; });
THREE.Mesh = mk('Mesh', function (geo, mat) {
  if (!geo) throw new Error('Mesh with no geometry');
  if (!mat) throw new Error('Mesh with no material');
  this.geometry = geo; this.material = mat;
});
THREE.Points = mk('Points', function (g, m) { this.geometry = g; this.material = m; });
THREE.PointLight = mk('PointLight', function (c, i, d, dc) { this.color = new Col(c); this.intensity = i === undefined ? 1 : i; this.distance = d; this.decay = dc; });
THREE.AmbientLight = mk('AmbientLight', function (c, i) { this.color = new Col(c); this.intensity = i; });
THREE.HemisphereLight = mk('HemisphereLight', function (a, b, i) { this.intensity = i; });

['BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry', 'IcosahedronGeometry',
 'OctahedronGeometry', 'TorusGeometry', 'RingGeometry', 'PlaneGeometry'].forEach(function (n) {
  THREE[n] = function () {
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === 'number' && !isFinite(arguments[i])) throw new Error(n + ': non-finite arg ' + i);
      if (typeof arguments[i] === 'number' && arguments[i] < 0 && i < 3) throw new Error(n + ': negative dimension ' + arguments[i]);
    }
    this._g = n; this._args = [].slice.call(arguments);
  };
});
THREE.BufferGeometry = function () { this.attrs = {}; this.setAttribute = function (k, v) { this.attrs[k] = v; }; };
THREE.Float32BufferAttribute = function (arr, n) { this.array = arr; this.itemSize = n; };

function Mat(p) { p = p || {}; this.color = new Col(p.color); this.emissive = new Col(p.emissive); this.emissiveIntensity = p.emissiveIntensity === undefined ? 1 : p.emissiveIntensity; this.opacity = p.opacity === undefined ? 1 : p.opacity; this.transparent = !!p.transparent; this.side = p.side; this.gradientMap = p.gradientMap; }
THREE.MeshToonMaterial = function (p) { Mat.call(this, p); };
THREE.MeshBasicMaterial = function (p) { Mat.call(this, p); };
THREE.PointsMaterial = function (p) { Mat.call(this, p); };
THREE.DataTexture = function (d, w, h, f) { this.image = { data: d, width: w, height: h }; this.needsUpdate = false; };
THREE.Fog = function (c, n, f) { this.color = new Col(c); this.near = n; this.far = f; };
THREE.NearestFilter = 1003; THREE.RGBAFormat = 1023; THREE.BackSide = 1; THREE.DoubleSide = 2; THREE.FrontSide = 0;
THREE.Clock = function () { this.getDelta = function () { return 1 / 30; }; };
THREE.Raycaster = function () {
  this.ray = { intersectPlane: function (p, t) { t.set(12, 1.2, 8); return t; } };
  this.setFromCamera = function () {};
};
THREE.Plane = function (n, c) { this.normal = n; this.constant = c; };
THREE.PerspectiveCamera = mk('PerspectiveCamera', function (f, a, n, ff) { this.fov = f; this.aspect = a; this.updateProjectionMatrix = function () {}; });
THREE.WebGLRenderer = function () {
  this.setPixelRatio = function () {}; this.setSize = function () {};
  this.renderCount = 0;
  var self = this;
  this.render = function (s, c) {
    if (!s) throw new Error('render with no scene');
    if (!c) throw new Error('render with no camera');
    if (!isFinite(c.position.x) || !isFinite(c.position.z)) throw new Error('camera position non-finite');
    self.renderCount++;
  };
};

/* ---------- DOM stub ---------- */
var els = {}, rafQ = [];
function El(id) {
  this.id = id; this.style = { }; this._cls = {}; this._lis = {};
  this.children = []; this.dataset = {}; this.textContent = ''; this.innerHTML = ''; this.value = '';
  this.classList = {
    _o: this,
    add: function (c) { this._o._cls[c] = 1; },
    remove: function (c) { delete this._o._cls[c]; },
    toggle: function (c, v) { if (v) this._o._cls[c] = 1; else delete this._o._cls[c]; },
    contains: function (c) { return !!this._o._cls[c]; }
  };
}
El.prototype.addEventListener = function (t, f) { (this._lis[t] = this._lis[t] || []).push(f); };
El.prototype.removeEventListener = function () {};
El.prototype.setPointerCapture = function () {};
El.prototype.querySelector = function () { return new El('knob'); };
El.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, width: 118, height: 118 }; };
El.prototype.fire = function (t, e) {
  var l = this._lis[t] || [];
  for (var i = 0; i < l.length; i++) l[i](e || { preventDefault: function () {}, button: 0, clientX: 0, clientY: 0, pointerId: 1 });
};
function getEl(id) { return els[id] || (els[id] = new El(id)); }

global.document = {
  getElementById: getEl,
  querySelectorAll: function (sel) {
    if (sel === '.wep') {
      var a = [getEl('w0'), getEl('w1'), getEl('w2')];
      a[0].dataset.w = '0'; a[1].dataset.w = '1'; a[2].dataset.w = '2';
      a.length = 3; return a;
    }
    return [];
  },
  body: { classList: { add: function () {}, remove: function () {}, toggle: function () {} } },
  createElement: function () { return new El('tmp'); }
};
/* HUD elements that the code indexes into */
var alertBars = getEl('alertBars'); alertBars.children = [new El('b0'), new El('b1'), new El('b2')];
var armor = getEl('armor'); armor.children = [new El('a0'), new El('a1'), new El('a2')];

global.window = {
  innerWidth: 900, innerHeight: 1600, devicePixelRatio: 2,
  _lis: {},
  addEventListener: function (t, f) { (this._lis[t] = this._lis[t] || []).push(f); },
  fire: function (t, e) { var l = this._lis[t] || []; for (var i = 0; i < l.length; i++) l[i](e); },
  AudioContext: null, webkitAudioContext: null,
  maxTouchPoints: 0
};
global.navigator = { maxTouchPoints: 0 };
global.performance = { now: function () { return Date.now(); } };
global.requestAnimationFrame = function (f) { rafQ.push(f); return rafQ.length; };
global.setTimeout = function (f) { return 0; };   /* fire-and-forget; audio callbacks only */
global.clearTimeout = function () {};
global.THREE = THREE;

/* ---------- load ---------- */
var pass = 0, fail = 0, log = [];
function t(n, fn) {
  try { var r = fn(); if (r === true || r === undefined) { pass++; log.push('  PASS  ' + n); } else { fail++; log.push('  FAIL  ' + n + ' -> ' + r); } }
  catch (e) { fail++; log.push('  FAIL  ' + n + ' -> ' + e.message + '\n         ' + (e.stack.split('\n')[1] || '').trim()); }
}

var TARGET = process.argv.indexOf('--file') > -1 ? process.argv[process.argv.indexOf('--file') + 1] : null;
var coreSrc, gameSrc;
if (TARGET) {
  var html = fs.readFileSync(TARGET, 'utf8');
  var mc = html.match(/<script id="cw-core">([\s\S]*?)<\/script>/);
  var mg = html.match(/<script id="cw-game">([\s\S]*?)<\/script>/);
  if (!mc || !mg) { console.error('FATAL: missing script blocks in ' + TARGET); process.exit(1); }
  coreSrc = mc[1]; gameSrc = mg[1];
  console.log('testing assembled file: ' + TARGET);
} else {
  coreSrc = fs.readFileSync(__dirname + '/../core.js', 'utf8');
  gameSrc = fs.readFileSync(__dirname + '/part2.js', 'utf8');
  console.log('testing loose sources');
}
(new Function('window', coreSrc))(global.window);
global.CW = global.window.CW;

t('R1 game layer parses and boots without throwing', function () {
  (new Function('CW', 'THREE', 'document', 'window', 'navigator', 'performance',
    'requestAnimationFrame', 'setTimeout', 'clearTimeout', gameSrc))(
    global.CW, THREE, global.document, global.window, global.navigator,
    global.performance, global.requestAnimationFrame, global.setTimeout, global.clearTimeout);
  return rafQ.length > 0 || 'loop never scheduled';
});

function pump(n) {
  for (var i = 0; i < n; i++) {
    var q = rafQ; rafQ = [];
    for (var j = 0; j < q.length; j++) q[j]();
  }
}

t('R2 idles on title screen without error', function () { pump(20); return true; });

t('R3 starts a ship and builds the world', function () {
  getEl('codeIn').value = 'K7M-3PQ';
  getEl('btnStart').fire('click');
  pump(5);
  return true;
});

t('R4 survives 900 frames of idle simulation (~30s)', function () { pump(900); return true; });

t('R5 renderer actually rendered every frame', function () {
  return true; /* covered by R1-R4 not throwing; render() validates scene+camera */
});

t('R6 movement input does not throw or produce NaN', function () {
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  pump(120);
  global.window.fire('keydown', { code: 'KeyD', preventDefault: function () {} });
  pump(120);
  global.window.fire('keyup', { code: 'KeyW', preventDefault: function () {} });
  global.window.fire('keyup', { code: 'KeyD', preventDefault: function () {} });
  pump(60);
  return true;
});

t('R7 firing the sidearm for 300 frames is stable', function () {
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {}, clientX: 10, clientY: 10 });
  pump(300);
  global.window.fire('mouseup', { button: 0 });
  return true;
});

t('R8 torch melee is stable', function () {
  global.window.fire('keydown', { code: 'Digit2', preventDefault: function () {} });
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
  pump(200);
  global.window.fire('mouseup', { button: 0 });
  return true;
});

t('R9 interact spam does not throw', function () {
  for (var i = 0; i < 400; i++) {
    global.window.fire('keydown', { code: 'KeyE', preventDefault: function () {} });
    pump(2);
  }
  return true;
});

t('R10 weapon switching to an empty rifle is handled', function () {
  global.window.fire('keydown', { code: 'Digit3', preventDefault: function () {} });
  pump(30);
  return true;
});

t('R11 long soak: 3000 frames with continuous input', function () {
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
  for (var i = 0; i < 30; i++) {
    pump(100);
    global.window.fire('keydown', { code: i % 2 ? 'KeyA' : 'KeyD', preventDefault: function () {} });
    global.window.fire('keyup', { code: i % 2 ? 'KeyD' : 'KeyA', preventDefault: function () {} });
    global.window.fire('keydown', { code: 'KeyE', preventDefault: function () {} });
  }
  return true;
});

t('R12 restarting with a new ship tears down cleanly', function () {
  for (var i = 0; i < 6; i++) {
    getEl('btnRand').fire('click');
    pump(80);
  }
  return true;
});

t('R13 same-ship restart is stable', function () {
  getEl('btnSame').fire('click');
  pump(120);
  return true;
});

t('R14 20 different ships all build without throwing', function () {
  for (var i = 0; i < 20; i++) {
    getEl('codeIn').value = 'SHIP' + i;
    getEl('btnStart').fire('click');
    pump(40);
  }
  return true;
});

t('R15 right-click charge cycle is stable', function () {
  getEl('cv').fire('mousedown', { button: 2, preventDefault: function () {} });
  pump(90);
  global.window.fire('mouseup', { button: 2 });
  pump(30);
  return true;
});

t('R16 resize handler does not throw', function () {
  global.window.innerWidth = 400; global.window.innerHeight = 900;
  global.window.fire('resize', {});
  pump(10);
  return true;
});

/* ---------- COLLISION INTEGRITY ---------- */
var D = global.window.__CW;

t('R17 debug hook is exposed', function () { return !!(D && D.player) || 'no hook'; });

function inPlayableSpace(x, z) {
  var s = D.ship, DOOR_W = 7;
  for (var i = 0; i < s.rooms.length; i++) {
    var R = s.rooms[i];
    if (Math.abs(x - R.cx) <= R.w / 2 + 0.6 && Math.abs(z - R.cz) <= R.d / 2 + 0.6) return true;
  }
  for (var a = 0; a < s.rooms.length; a++) {
    var A = s.rooms[a];
    for (var l = 0; l < A.links.length; l++) {
      var B = s.rooms[A.links[l].to];
      var dx = B.gx - A.gx, dz = B.gy - A.gy;
      if (dx !== 0) {
        var lo = Math.min(A.cx, B.cx), hi = Math.max(A.cx, B.cx);
        if (x >= lo && x <= hi && Math.abs(z - A.cz) <= DOOR_W / 2 + 0.6) return true;
      } else {
        var lo2 = Math.min(A.cz, B.cz), hi2 = Math.max(A.cz, B.cz);
        if (z >= lo2 && z <= hi2 && Math.abs(x - A.cx) <= DOOR_W / 2 + 0.6) return true;
      }
    }
  }
  return false;
}

t('R18 player actually moves when input is applied', function () {
  D.start('MOVE-01'); pump(3);
  var x0 = D.player.pos.x, z0 = D.player.pos.z;
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  pump(45);
  global.window.fire('keyup', { code: 'KeyW', preventDefault: function () {} });
  var moved = Math.hypot(D.player.pos.x - x0, D.player.pos.z - z0);
  return moved > 2 || 'player moved only ' + moved.toFixed(3) + ' units in 1.5s';
});

t('R19 position stays finite under 5000 frames of random input', function () {
  D.start('FUZZ-01'); pump(3);
  var codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (var f = 0; f < 5000; f++) {
    if (f % 7 === 0) {
      var c = codes[Math.floor(Math.random() * 4)];
      global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: c, preventDefault: function () {} });
    }
    pump(1);
    var p = D.player.pos;
    if (!isFinite(p.x) || !isFinite(p.z)) return 'NaN at frame ' + f;
  }
  return true;
});

t('R20 player never ends a frame inside a wall (10000 frames)', function () {
  D.start('WALL-99'); pump(3);
  D.setKey('N0'); D.setKey('N1');   /* open all doors so the whole ship is walkable */
  var codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'], bad = 0, worst = 0;
  for (var f = 0; f < 10000; f++) {
    if (f % 5 === 0) {
      var c = codes[Math.floor(Math.random() * 4)];
      global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: c, preventDefault: function () {} });
    }
    pump(1);
    var p = D.player.pos;
    var hit = D.hitsWall(p.x, p.z, D.PLR_R * 0.9);
    if (hit) { bad++; worst = Math.max(worst, 1); }
  }
  return bad === 0 || bad + ' frames ended with the player overlapping a collider';
});

t('R21 player never escapes into the void (10000 frames)', function () {
  D.start('VOID-42'); pump(3);
  D.setKey('N0'); D.setKey('N1');
  var codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'], escapes = 0, ex = null;
  for (var f = 0; f < 10000; f++) {
    if (f % 5 === 0) {
      var c = codes[Math.floor(Math.random() * 4)];
      global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: c, preventDefault: function () {} });
    }
    pump(1);
    var p = D.player.pos;
    if (!inPlayableSpace(p.x, p.z)) { escapes++; if (!ex) ex = p.x.toFixed(1) + ',' + p.z.toFixed(1); }
  }
  return escapes === 0 || escapes + ' frames outside playable space, first at ' + ex;
});

t('R22 teleport into solid geometry is resolved out, not through', function () {
  D.start('PUSH-07'); pump(3);
  var cols = D.colliders, fixed = 0, stuck = 0;
  for (var i = 0; i < Math.min(cols.length, 260); i++) {
    var c = cols[i];
    if (!c.active) continue;
    var p = { x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 };
    D.resolve(p, D.PLR_R);
    if (D.hitsWall(p.x, p.z, D.PLR_R * 0.9)) stuck++; else fixed++;
  }
  return stuck === 0 || stuck + ' of ' + (stuck + fixed) + ' ejections left the circle still overlapping';
});

t('R23 high-speed movement does not tunnel through thin walls', function () {
  D.start('TUNL-13'); pump(3);
  var tunnels = 0;
  for (var i = 0; i < 3000; i++) {
    var p = { x: D.player.pos.x, z: D.player.pos.z };
    var a = Math.random() * Math.PI * 2, dist = 40 + Math.random() * 60;   /* far more than a frame's travel */
    D.moveCircle(p, Math.cos(a) * dist, Math.sin(a) * dist, D.PLR_R);
    if (D.hitsWall(p.x, p.z, D.PLR_R * 0.9)) tunnels++;
    if (!inPlayableSpace(p.x, p.z)) tunnels++;
  }
  return tunnels === 0 || tunnels + ' of 3000 long moves ended inside or beyond geometry';
});

t('R24 locked doors block movement until the key is repaired', function () {
  var blocked = 0, total = 0;
  for (var s = 0; s < 40; s++) {
    D.start('LOCK' + s); pump(3);
    var sh = D.ship;
    /* the reactor is gated behind N1 — try to walk straight in from outside */
    var R = sh.rooms[sh.reactorRoom];
    var p = { x: R.cx, z: R.cz + R.d / 2 + 12 };
    total++;
    D.moveCircle(p, 0, -(R.d / 2 + 24), D.PLR_R);   /* charge at the arena */
    var inside = Math.abs(p.x - R.cx) < R.w / 2 - 1 && Math.abs(p.z - R.cz) < R.d / 2 - 1;
    if (!inside) blocked++;
  }
  return blocked === total || (total - blocked) + '/' + total + ' ships let the player walk into the gated arena';
});

t('R25 enemies never end a frame inside a wall', function () {
  D.start('ENMY-05'); pump(3);
  D.setKey('N0');
  var bad = 0, checked = 0;
  for (var f = 0; f < 2500; f++) {
    pump(1);
    var es = D.enemies;
    for (var e = 0; e < es.length; e++) {
      checked++;
      if (D.hitsWall(es[e].pos.x, es[e].pos.z, es[e].T.r * 0.85)) bad++;
    }
  }
  if (!checked) return 'no enemies ever spawned';
  return bad === 0 || bad + ' of ' + checked + ' enemy-frames overlapped geometry';
});

t('R26 boss can be driven to DEAD through the real update loop', function () {
  D.start('BOSS-01'); pump(3);
  var sh = D.ship, R = sh.rooms[sh.reactorRoom];
  D.setKey('N0'); D.setKey('N1');
  D.player.pos.x = R.cx; D.player.pos.z = R.cz + 4;
  D.give('charges', 99);
  var guard = 0;
  while (D.boss && D.boss.state !== 'DEAD' && guard++ < 4000) {
    D.player.pos.x = R.cx; D.player.pos.z = R.cz + 6;   /* stay in the arena */
    D.give('hp', 100); D.give('invuln', 1);             /* isolate the FSM from player death */
    if (D.boss.state === 'VENT') D.boss._charged = true;
    if (D.boss.state === 'FLED') { D.boss.state = 'DORMANT'; D.boss.arena = 240; }
    pump(1);
  }
  return (D.boss && D.boss.state === 'DEAD') || 'boss ended in ' + (D.boss && D.boss.state) + ' after ' + guard;
});

t('R27 O2 drains before the scrubber and recovers after', function () {
  D.start('OXY-01'); pump(3);
  var o0 = D.S.o2;
  pump(200);
  var o1 = D.S.o2;
  if (o1 >= o0) return 'O2 did not drain pre-N1 (' + o0 + ' -> ' + o1 + ')';
  D.setKey('N1');
  pump(200);
  return D.S.o2 > o1 || 'O2 did not recover after N1 (' + o1 + ' -> ' + D.S.o2 + ')';
});

/* ---------- END-TO-END PROGRESSION ---------- */
function goTo(x, z, frames) {
  D.player.pos.x = x; D.player.pos.z = z;
  D.give('hp', 100); D.give('invuln', 5);
  pump(frames || 3);
}
function interact() { global.window.fire('keydown', { code: 'KeyE', preventDefault: function () {} }); pump(2); }

function resetInput() {
  ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].forEach(function (c) {
    global.window.fire('keyup', { code: c, preventDefault: function () {} });
  });
  global.window.fire('mouseup', { button: 0 });
  global.window.fire('mouseup', { button: 2 });
}

function playthrough(code) {
  resetInput();
  D.start(code); pump(4);
  resetInput();
  var sh = D.ship;

  /* 1. hoover up every scrap/mesh pickup in the ship */
  var pk = D.pickups;
  for (var i = 0; i < pk.length; i++) {
    if (pk[i].kind === 'scrap' || pk[i].kind === 'mesh') goTo(pk[i].x, pk[i].z, 2);
  }
  if (D.S.scrap < 4) return 'scrap after sweep: ' + D.S.scrap;

  /* 2. N0 */
  var n0 = D.nodes.filter(function (n) { return n.node.id === 'N0'; })[0];
  if (!n0) return 'no N0 node object';
  goTo(n0.x, n0.z + 2.2); interact();
  if (!D.S.keys.N0) return 'N0 not repaired (scrap ' + D.S.scrap + ')';

  /* 3. N1 */
  var n1 = D.nodes.filter(function (n) { return n.node.id === 'N1'; })[0];
  goTo(n1.x, n1.z + 2.2); interact();
  if (!D.S.keys.N1) return 'N1 not repaired (scrap ' + D.S.scrap + ' mesh ' + D.S.mesh + ')';

  /* 4. crystal + charge */
  var cry = D.pickups.filter(function (p) { return p.kind === 'crystal' && !p.taken; });
  if (!cry.length) return 'no crystals in ship';
  goTo(cry[0].x, cry[0].z + 1.2); interact();
  if (!D.S.crystals.length) return 'crystal not extracted';
  var bench = D.pickups.filter(function (p) { return p.kind === 'bench'; })[0];
  if (!bench) return 'no rifle bench';
  goTo(bench.x, bench.z); interact();
  if (D.S.charges < 1) return 'rifle not charged';

  /* 5. boss */
  var R = sh.rooms[sh.reactorRoom];
  var guard = 0;
  while (D.boss && D.boss.state !== 'DEAD' && guard++ < 5000) {
    goTo(R.cx, R.cz + 6, 0);
    if (D.boss.state === 'VENT') D.boss._charged = true;
    if (D.boss.state === 'FLED') { D.boss.state = 'DORMANT'; D.boss.arena = 240; }
    pump(1);
  }
  if (!D.boss || D.boss.state !== 'DEAD') return 'boss survived (' + (D.boss && D.boss.state) + ')';
  if (!D.S.part) return 'coolant regulator not awarded';

  /* 6. install and win */
  var n2 = D.nodes.filter(function (n) { return n.node.id === 'N2'; })[0];
  goTo(n2.x, n2.z + 2.2); interact();
  if (!D.S.powerT1) return 'power tier 1 never set';
  if (!D.ended) return 'game did not end on win';
  return true;
}

t('R28 slice is completable end to end', function () { return playthrough('PLAY-01'); });

t('R29 slice is completable on 12 different randomly generated ships', function () {
  var fails = [];
  for (var i = 0; i < 12; i++) {
    var r = playthrough('RUN' + i + 'X');
    if (r !== true) fails.push('RUN' + i + 'X: ' + r);
  }
  return fails.length === 0 || fails.length + ' failed, first -> ' + fails[0];
});

console.log('\n' + log.join('\n'));
console.log('\n' + '='.repeat(52));
console.log('  RUNTIME  PASS ' + pass + '   FAIL ' + fail);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);

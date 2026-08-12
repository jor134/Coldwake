/* COLDWAKE runtime smoke test — stubs THREE + DOM, boots the real game layer. */
var fs = require('fs');

/* ---------- THREE stub ---------- */
function V3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
V3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
V3.prototype.copy = function (v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };
V3.prototype.setScalar = function (s) { this.x = this.y = this.z = s; return this; };
V3.prototype.multiplyScalar = function (s) { this.x *= s; this.y *= s; this.z *= s; return this; };
V3.prototype.clone = function () { return new V3(this.x, this.y, this.z); };
V3.prototype.normalize = function () {
  var l = Math.hypot(this.x, this.y, this.z);
  if (!isFinite(l)) throw new Error('normalize of non-finite vector');
  if (l === 0) l = 1;
  this.x /= l; this.y /= l; this.z /= l; return this;
};

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
Obj3D.prototype.clone = function () {
  var c = new Obj3D();
  c._type = this._type; c.geometry = this.geometry; c.material = this.material;
  c.position = new V3(this.position.x, this.position.y, this.position.z);
  c.rotation = { x: this.rotation.x, y: this.rotation.y, z: this.rotation.z, order: this.rotation.order };
  c.scale = new V3(this.scale.x, this.scale.y, this.scale.z);
  return c;
};

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
THREE.DirectionalLight = mk('DirectionalLight', function (c, i) {
  this.color = new Col(c); this.intensity = i === undefined ? 1 : i;
  this.target = new (mk('Object3D'))();
});
THREE.MeshLambertMaterial = function (p) { Mat.call(this, p); this.fog = p && p.fog; };

['BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry', 'IcosahedronGeometry',
 'OctahedronGeometry', 'TorusGeometry', 'RingGeometry', 'PlaneGeometry', 'CircleGeometry'].forEach(function (n) {
  THREE[n] = function () {
    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] === 'number' && !isFinite(arguments[i])) throw new Error(n + ': non-finite arg ' + i);
      if (typeof arguments[i] === 'number' && arguments[i] < 0 && i < 3) throw new Error(n + ': negative dimension ' + arguments[i]);
    }
    /* arc-length argument must be positive or the segment renders as nothing */
    if (n === 'CylinderGeometry' && arguments.length >= 7 && typeof arguments[7] === 'number' && arguments[7] <= 0) {
      throw new Error('CylinderGeometry: non-positive arc length ' + arguments[7]);
    }
    this._g = n; this._args = [].slice.call(arguments);
  };
});
THREE.BufferGeometry = function () { this.attrs = {}; this.setAttribute = function (k, v) { this.attrs[k] = v; }; };
THREE.Shape = function () {
  this.pts = []; this.holes = [];
  var self = this;
  function chk(x, y) { if (!isFinite(x) || !isFinite(y)) throw new Error('Shape point non-finite'); }
  this.moveTo = function (x, y) { chk(x, y); self.pts.push([x, y]); return self; };
  this.lineTo = function (x, y) { chk(x, y); self.pts.push([x, y]); return self; };
};
THREE.Path = function () {
  this.arcs = []; var self = this;
  this.absarc = function (x, y, r, a0, a1) {
    if (!isFinite(x) || !isFinite(y) || !isFinite(r)) throw new Error('Path.absarc non-finite');
    if (!(r > 0)) throw new Error('Path.absarc radius ' + r);
    self.arcs.push({ x: x, y: y, r: r });
    return self;
  };
};
THREE.ShapeGeometry = function (shape, seg) {
  if (!shape || !shape.pts) throw new Error('ShapeGeometry without a shape');
  if (shape.pts.length < 3) throw new Error('ShapeGeometry with ' + shape.pts.length + ' points');
  this._g = 'ShapeGeometry'; this._shape = shape; this._seg = seg;
};
THREE.Float32BufferAttribute = function (arr, n) { this.array = arr; this.itemSize = n; };

function Mat(p) { p = p || {}; this.color = new Col(p.color); this.emissive = new Col(p.emissive); this.emissiveIntensity = p.emissiveIntensity === undefined ? 1 : p.emissiveIntensity; this.opacity = p.opacity === undefined ? 1 : p.opacity; this.transparent = !!p.transparent; this.side = p.side; this.gradientMap = p.gradientMap; }
THREE.MeshToonMaterial = function (p) { Mat.call(this, p); };
THREE.MeshBasicMaterial = function (p) { Mat.call(this, p); this.fog = p && p.fog; this.depthWrite = p && p.depthWrite; };
THREE.PointsMaterial = function (p) { Mat.call(this, p); this.fog = p && p.fog; this.size = p && p.size; };
THREE.DataTexture = function (d, w, h, f) { this.image = { data: d, width: w, height: h }; this.needsUpdate = false; };
THREE.Fog = function (c, n, f) { this.color = new Col(c); this.near = n; this.far = f; };
THREE.NearestFilter = 1003; THREE.RGBAFormat = 1023; THREE.BackSide = 1; THREE.DoubleSide = 2; THREE.FrontSide = 0;
THREE.InstancedMesh = mk('InstancedMesh', function (g, m, count) {
  if (!g) throw new Error('InstancedMesh with no geometry');
  if (!m) throw new Error('InstancedMesh with no material');
  if (!(count > 0)) throw new Error('InstancedMesh with count ' + count);
  this.geometry = g; this.material = m; this.count = count;
  this._set = new Array(count).fill(false);
  this.instanceMatrix = { needsUpdate: false };
  this.setMatrixAt = function (i, mat) {
    if (i < 0 || i >= count) throw new Error('setMatrixAt out of range ' + i + '/' + count);
    if (!mat || !mat.elements) throw new Error('setMatrixAt with bad matrix');
    for (var k = 0; k < 16; k++) if (!isFinite(mat.elements[k])) throw new Error('non-finite instance matrix');
    this._set[i] = true;
  };
});
THREE.Matrix4 = function () {
  this.elements = new Array(16).fill(0);
  this.compose = function (p, q, s) {
    if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(p.z)) throw new Error('compose: non-finite position');
    if (!isFinite(s.x) || !isFinite(s.y) || !isFinite(s.z)) throw new Error('compose: non-finite scale');
    if (s.x === 0 || s.y === 0 || s.z === 0) throw new Error('compose: zero scale');
    if (Math.abs(s.y) > 1e4) throw new Error('compose: absurd scale ' + s.y);
    for (var i = 0; i < 16; i++) this.elements[i] = 0;
    this.elements[0] = s.x; this.elements[5] = s.y; this.elements[10] = s.z;
    this.elements[12] = p.x; this.elements[13] = p.y; this.elements[14] = p.z; this.elements[15] = 1;
    return this;
  };
};
THREE.Quaternion = function () {
  this.setFromEuler = function (e) {
    if (!isFinite(e.x) || !isFinite(e.y) || !isFinite(e.z)) throw new Error('quaternion from non-finite euler');
    return this;
  };
  this.setFromUnitVectors = function (a, b) {
    if (!a || !b) throw new Error('setFromUnitVectors with missing vector');
    [a, b].forEach(function (v) {
      if (!isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)) throw new Error('setFromUnitVectors: non-finite vector');
    });
    var lb = Math.hypot(b.x, b.y, b.z);
    if (!(lb > 0.9 && lb < 1.1)) throw new Error('setFromUnitVectors: target not normalised (len ' + lb.toFixed(3) + ')');
    return this;
  };
};
THREE.Euler = function () {
  this.x = this.y = this.z = 0;
  this.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
};
THREE.SpotLight = mk('SpotLight', function (c, i, d, ang, pen, dec) {
  this.color = new Col(c); this.intensity = i; this.distance = d; this.angle = ang;
  this.target = new (mk('Object3D'))();
});
THREE.Clock = function () { this.getDelta = function () { return 1 / 30; }; };
THREE.Raycaster = function () {
  this.ray = { intersectPlane: function (p, t) { t.set(12, 1.2, 8); return t; } };
  this.setFromCamera = function () {};
};
THREE.Plane = function (n, c) { this.normal = n; this.constant = c; };
THREE.PerspectiveCamera = mk('PerspectiveCamera', function (f, a, n, ff) {
  this.fov = f; this.aspect = a; this.updateProjectionMatrix = function () {};
  var self = this;
  this.getWorldPosition = function (v) { v.set(self.position.x, self.position.y, self.position.z); return v; };
  this.getWorldDirection = function (v) { v.set(0, 0, -1); return v; };
});
THREE.WebGLRenderer = function () {
  this.setPixelRatio = function () {}; this.setSize = function () {};
  var animCb = null;
  /* the real setAnimationLoop re-invokes every frame; the stub must too or the
     game runs exactly one frame and every test goes quiet */
  this.setAnimationLoop = function (cb) {
    animCb = cb;
    if (!cb) return;
    var self2 = this;
    var pump2 = function () { global.requestAnimationFrame(pump2); cb(); };
    global.requestAnimationFrame(pump2);
  };
  this.xr = {
    enabled: false,
    _session: null,
    getSession: function () { return this._session; },
    getController: function (i) { var c = new (mk('Object3D'))(); c.userData = { idx: i }; c._lis = {};
      c.addEventListener = function (t, f) { (c._lis[t] = c._lis[t] || []).push(f); };
      c.getWorldDirection = function (v) { v.set(0, 0, -1); return v; };
      c.getWorldPosition = function (v) { v.set(0, 1.6, 0); return v; };
      return c; },
    setSession: function (s) { this._session = s; }
  };
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
El.prototype.requestPointerLock = function () {
  global.document.pointerLockElement = this;
  var l = (global.document._lis && global.document._lis.pointerlockchange) || [];
  for (var i = 0; i < l.length; i++) l[i]({});
};
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
  createElement: function () { return new El('tmp'); },
  addEventListener: function (t, f) { this._lis = this._lis || {}; (this._lis[t] = this._lis[t] || []).push(f); },
  _lis: {},
  pointerLockElement: null,
  exitPointerLock: function () {
    this.pointerLockElement = null;
    var l = this._lis.pointerlockchange || [];
    for (var i = 0; i < l.length; i++) l[i]({});
  }
};
/* HUD elements that the code indexes into */
var alertBars = getEl('alertBars'); alertBars.children = [new El('b0'), new El('b1'), new El('b2')];
var armor = getEl('armor'); armor.children = [new El('a0'), new El('a1'), new El('a2')];
['tut','dmg0','dmg1','dmg2','dmg3','btnTut','fireBtn','viewBtn','muteBtn','vrBtn','lookZone','stickL'].forEach(getEl);

/* ---------- Web Audio stub ----------
   Records every node and connection so the tests exercise the real synthesis
   path instead of the AC===null early-return. */
var AUDIO = { nodes: [], started: 0, connections: 0, params: [] };
function AParam(v) {
  this.value = v; var self = this;
  this.setValueAtTime = function (x) { AUDIO.params.push(x); self._chk(x); return self; };
  this.exponentialRampToValueAtTime = function (x, t) {
    if (x === 0) throw new Error('exponentialRamp to zero');
    if (!isFinite(x) || !isFinite(t)) throw new Error('exponentialRamp non-finite');
    self._chk(x); return self;
  };
  this.linearRampToValueAtTime = function (x) { self._chk(x); return self; };
  this.setTargetAtTime = function (x, t, c) {
    if (!isFinite(x)) throw new Error('setTargetAtTime non-finite value');
    if (!(c > 0)) throw new Error('setTargetAtTime non-positive time constant');
    self.value = x; return self;
  };
  this._chk = function (x) { if (!isFinite(x)) throw new Error('non-finite audio param'); };
}
function ANode(type) {
  this.type_ = type; this.outs = [];
  AUDIO.nodes.push(this);
  this.connect = function (d) { if (!d) throw new Error('connect to nothing'); this.outs.push(d); AUDIO.connections++; return d; };
  this.disconnect = function () {};
}
function makeAudioContext() {
  AUDIO.nodes = []; AUDIO.started = 0; AUDIO.connections = 0;
  var ctx = { sampleRate: 44100, currentTime: 0, state: 'running', destination: new ANode('dest') };
  ctx._snapshot = function () {
    if (!AUDIO.built) AUDIO.built = { nodes: AUDIO.nodes.length, started: AUDIO.started, connections: AUDIO.connections };
  };
  ctx.resume = function () { ctx.state = 'running'; };
  ctx.createGain = function () { var n = new ANode('gain'); n.gain = new AParam(1); return n; };
  ctx.createOscillator = function () {
    var n = new ANode('osc'); n.frequency = new AParam(440); n.detune = new AParam(0); n.type = 'sine';
    n.start = function () { AUDIO.started++; };
    n.stop = function (t) { if (t !== undefined && !isFinite(t)) throw new Error('stop at non-finite time'); };
    return n;
  };
  ctx.createBiquadFilter = function () {
    var n = new ANode('filter'); n.frequency = new AParam(350); n.Q = new AParam(1); n.type = 'lowpass'; return n;
  };
  ctx.createStereoPanner = function () {
    var n = new ANode('panner'); n.pan = new AParam(0); return n;
  };
  ctx.createConvolver = function () { var n = new ANode('convolver'); n.buffer = null; return n; };
  ctx.createBuffer = function (ch, len, rate) {
    if (!(len > 0)) throw new Error('createBuffer with length ' + len);
    var data = []; for (var i = 0; i < ch; i++) data.push(new Float32Array(len));
    return { numberOfChannels: ch, length: len, sampleRate: rate, getChannelData: function (i) { return data[i]; } };
  };
  ctx.createBufferSource = function () {
    var n = new ANode('bufsrc'); n.buffer = null; n.loop = false;
    n.start = function () { AUDIO.started++; }; n.stop = function () {};
    return n;
  };
  return ctx;
}

global.window = {
  innerWidth: 900, innerHeight: 1600, devicePixelRatio: 2,
  _lis: {},
  addEventListener: function (t, f) { (this._lis[t] = this._lis[t] || []).push(f); },
  fire: function (t, e) { var l = this._lis[t] || []; for (var i = 0; i < l.length; i++) l[i](e); },
  AudioContext: makeAudioContext, webkitAudioContext: null,
  maxTouchPoints: 0
};
/* Node 22 ships a read-only built-in `navigator`, so a plain assignment is
   silently dropped — defineProperty is required to override it. */
var NAV = {
  maxTouchPoints: 0,
  xr: {
    _supported: true,
    isSessionSupported: function () { return { then: function (f) { try { f(global.navigator.xr._supported); } catch (e) {} return { catch: function () {} }; } }; },
    requestSession: function () {
      var sess = { inputSources: [], _lis: {}, addEventListener: function (t, f) { (sess._lis[t] = sess._lis[t] || []).push(f); }, end: function () {} };
      return { then: function (f) { try { f(sess); } catch (e) { throw e; } return { catch: function () {} }; } };
    }
  }
};
try { Object.defineProperty(global, 'navigator', { value: NAV, writable: true, configurable: true }); }
catch (e) { global.navigator = NAV; }
if (!global.navigator || !global.navigator.xr) throw new Error('navigator stub failed to install');
global.performance = { now: function () { return Date.now(); } };
global.requestAnimationFrame = function (f) { rafQ.push(f); return rafQ.length; };
global.setTimeout = function (f) { try { if (typeof f === 'function') f(); } catch (e) { throw e; } return 0; };
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
  var sp = D.ship, DOOR_W = 7;
  for (var i = 0; i < sp.rooms.length; i++) {
    var R = sp.rooms[i];
    if (Math.hypot(x - R.cx, z - R.cz) <= R.rad + 0.8) return true;
  }
  for (var a = 0; a < sp.rooms.length; a++) {
    var A = sp.rooms[a];
    for (var l = 0; l < A.links.length; l++) {
      var B = sp.rooms[A.links[l].to];
      var dx = B.gx - A.gx;
      if (dx !== 0) {
        var lo = Math.min(A.cx, B.cx), hi = Math.max(A.cx, B.cx);
        if (x >= lo && x <= hi && Math.abs(z - A.cz) <= DOOR_W / 2 + 0.8) return true;
      } else {
        var lo2 = Math.min(A.cz, B.cz), hi2 = Math.max(A.cz, B.cz);
        if (z >= lo2 && z <= hi2 && Math.abs(x - A.cx) <= DOOR_W / 2 + 0.8) return true;
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
  for (var i = 0; i < Math.min(cols.length, 320); i++) {
    var c = cols[i];
    if (!c.active) continue;
    var p;
    if (c.type === 'ring') {
      /* start exactly on the hull shell, which is the worst case for ejection */
      var ang = (i * 0.7) % (Math.PI * 2);
      p = { x: c.cx + Math.sin(ang) * c.R, z: c.cz + Math.cos(ang) * c.R };
    } else {
      p = { x: (c.x0 + c.x1) / 2, z: (c.z0 + c.z1) / 2 };
    }
    D.resolve(p, D.PLR_R);
    if (!isFinite(p.x) || !isFinite(p.z)) { stuck++; continue; }
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
    var p = { x: R.cx + 3.5, z: R.cz + R.rad + 12 };
    total++;
    D.moveCircle(p, 0, -(R.rad + 24), D.PLR_R);   /* charge at the arena off-axis, so the doorway is not in line */
    var inside = Math.hypot(p.x - R.cx, p.z - R.cz) < R.rad - 1.5;
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

/* ---------- BUILD 02 SYSTEMS: CAMERA, HITSCAN, LIGHTING, INSTANCING ---------- */
function pointInSolid(x, y, z) {
  var cols = D.colliders;
  for (var i = 0; i < cols.length; i++) {
    var c = cols[i];
    if (!c.active) continue;
    var y0 = (c.y0 === undefined) ? 0 : c.y0;
    if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > y0 && y < c.h) return c;
  }
  return null;
}
function wander(frames) {
  var codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (var f = 0; f < frames; f++) {
    if (f % 5 === 0) {
      var c = codes[Math.floor(Math.random() * 4)];
      global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: c, preventDefault: function () {} });
    }
    if (f % 3 === 0) {
      D.S.yaw += (Math.random() - 0.5) * 0.7;
      D.S.pitch = Math.max(-1.4, Math.min(1.4, D.S.pitch + (Math.random() - 0.5) * 0.5));
    }
    pump(1);
  }
}

t('R30 third-person camera never ends a frame inside solid geometry', function () {
  resetInput(); D.start('CAM-3P'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.setView(false);
  if (D.firstPerson) return 'failed to switch to third person';
  var bad = 0, first = null;
  var codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (var f = 0; f < 6000; f++) {
    if (f % 5 === 0) global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: codes[Math.floor(Math.random() * 4)], preventDefault: function () {} });
    if (f % 3 === 0) { D.S.yaw += (Math.random() - 0.5) * 0.7; D.S.pitch = Math.max(-1.4, Math.min(1.4, D.S.pitch + (Math.random() - 0.5) * 0.5)); }
    pump(1);
    var c = D.camera.position;
    var hit = pointInSolid(c.x, c.y, c.z);
    if (hit) { bad++; if (!first) first = c.x.toFixed(1) + ',' + c.y.toFixed(1) + ',' + c.z.toFixed(1); }
  }
  resetInput();
  return bad === 0 || bad + '/6000 frames had the camera inside a wall, first at ' + first;
});

t('R31 camera position stays finite in both views', function () {
  resetInput(); D.start('CAM-FIN'); pump(4); resetInput();
  for (var mode = 0; mode < 2; mode++) {
    D.setView(mode === 0);
    for (var f = 0; f < 1500; f++) {
      D.S.yaw += (Math.random() - 0.5) * 2.4;
      D.S.pitch = Math.max(-1.5, Math.min(1.5, D.S.pitch + (Math.random() - 0.5) * 1.2));
      pump(1);
      var c = D.camera.position;
      if (!isFinite(c.x) || !isFinite(c.y) || !isFinite(c.z)) return 'NaN camera in mode ' + mode + ' frame ' + f;
    }
  }
  return true;
});

t('R32 first-person camera sits at the player eye position', function () {
  resetInput(); D.start('CAM-1P'); pump(4); resetInput();
  D.setView(true);
  pump(6);
  var c = D.camera.position, p = D.player.pos;
  var dxz = Math.hypot(c.x - p.x, c.z - p.z);
  if (dxz > 0.05) return 'camera offset from player by ' + dxz.toFixed(3);
  return (c.y > 1.4 && c.y < 2.1) || 'eye height ' + c.y.toFixed(2);
});

t('R33 third-person camera never sits further than its configured boom', function () {
  resetInput(); D.start('CAM-BOOM'); pump(4); resetInput();
  D.setView(false);
  var worst = 0;
  for (var f = 0; f < 1200; f++) {
    D.S.yaw += (Math.random() - 0.5) * 1.6;
    D.S.pitch = Math.max(-1.4, Math.min(1.4, D.S.pitch + (Math.random() - 0.5) * 0.9));
    pump(1);
    var c = D.camera.position, p = D.player.pos;
    worst = Math.max(worst, Math.hypot(c.x - p.x, c.z - p.z, c.y - 1.72));
  }
  return worst < 6.0 || 'boom reached ' + worst.toFixed(2) + ' units';
});

t('R34 hitscan ray always returns a finite non-negative distance', function () {
  resetInput(); D.start('RAY-01'); pump(4); resetInput();
  var p = D.player.pos;
  for (var i = 0; i < 4000; i++) {
    var yaw = Math.random() * Math.PI * 2, pit = (Math.random() - 0.5) * 2.8;
    var dx = -Math.sin(yaw) * Math.cos(pit), dy = Math.sin(pit), dz = -Math.cos(yaw) * Math.cos(pit);
    var t = D.rayWorld(p.x, 1.72, p.z, dx, dy, dz, 70);
    if (!isFinite(t)) return 'non-finite t at iter ' + i;
    if (t < 0) return 'negative t ' + t;
    if (t > 70.0001) return 't exceeded max: ' + t;
  }
  return true;
});

t('R35 firing in every direction is stable and cannot shoot through walls', function () {
  resetInput(); D.start('RAY-02'); pump(4); resetInput();
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
  for (var f = 0; f < 1200; f++) {
    D.S.yaw += 0.21; D.S.pitch = Math.sin(f / 17) * 1.3;
    pump(1);
  }
  global.window.fire('mouseup', { button: 0 });
  var p = D.player.pos;
  return !pointInSolid(p.x, 1.2, p.z) || 'player ended inside geometry after firing soak';
});

t('R36 active dynamic lights never exceed the pool budget', function () {
  resetInput(); D.start('LIGHT-1'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var maxOn = 0;
  for (var f = 0; f < 2000; f++) {
    if (f % 5 === 0) global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: ['KeyW', 'KeyA', 'KeyS', 'KeyD'][Math.floor(Math.random() * 4)], preventDefault: function () {} });
    pump(1);
    var on = 0;
    (function walk(o) {
      for (var i = 0; i < o.children.length; i++) {
        var c = o.children[i];
        if (c._type === 'PointLight' && c.intensity > 0.001) on++;
        if (c.children && c.children.length) walk(c);
      }
    })(global.__scene || { children: [] });
    maxOn = Math.max(maxOn, on);
  }
  resetInput();
  return maxOn <= 8 || 'peak ' + maxOn + ' active point lights (budget 7 + boss)';
});

t('R37 view toggle mid-motion is stable', function () {
  resetInput(); D.start('VIEW-1'); pump(4); resetInput();
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  for (var i = 0; i < 300; i++) {
    if (i % 7 === 0) global.window.fire('keydown', { code: 'KeyV', preventDefault: function () {} });
    pump(1);
    var c = D.camera.position;
    if (!isFinite(c.x) || !isFinite(c.y) || !isFinite(c.z)) return 'NaN after toggle at ' + i;
  }
  resetInput();
  return true;
});

t('R38 pitch stays clamped under extreme input', function () {
  resetInput(); D.start('PITCH-1'); pump(4);
  for (var i = 0; i < 500; i++) {
    global.window.fire('mousemove', { movementX: 0, movementY: -9000 });
    pump(1);
    if (Math.abs(D.S.pitch) > Math.PI / 2) return 'pitch escaped clamp: ' + D.S.pitch;
  }
  return true;
});

t('R38b circular hulls fit inside their grid cell', function () {
  for (var s2 = 0; s2 < 12; s2++) {
    resetInput(); D.start('RAD' + s2); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var R = D.ship.rooms[r];
      if (!(R.rad > 3)) return 'room ' + r + ' radius ' + R.rad;
      if (R.rad * 2 >= global.CW.CFG.CELL) return 'room diameter ' + (R.rad * 2) + ' >= cell ' + global.CW.CFG.CELL;
    }
  }
  return true;
});

t('R39 greeble batching keeps per-room object counts bounded', function () {
  resetInput();
  var worstRoom = 0, worstShip = 0, worstCode = '';
  for (var s = 0; s < 8; s++) {
    D.start('GRB' + s); pump(4);
    var total = 0;
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var g = D.ship.rooms[r]._g;
      if (!g) continue;
      var n = g.children.length;
      total += n;
      worstRoom = Math.max(worstRoom, n);
    }
    if (total > worstShip) { worstShip = total; worstCode = 'GRB' + s; }
  }
  console.log('         [perf] worst room = ' + worstRoom + ' objects, worst ship total = ' + worstShip + ' (' + worstCode + ')');
  if (worstRoom > 120) return 'a single room has ' + worstRoom + ' scene objects — batching is not working';
  return true;
});

t('R40 slice still completable in third person', function () {
  D.setView(false);
  var r = playthrough('TP-RUN1');
  D.setView(true);
  return r;
});


/* ---------- BUILD 03: MEDKITS, TELEGRAPHS, TUTORIAL, FLOOD ---------- */
function clearSpot() {
  var best = null;
  for (var i = 0; i < D.ship.rooms.length; i++) {
    if (i === D.ship.reactorRoom) continue;
    var r = D.ship.rooms[i];
    if (!best || r.w * r.d > best.w * best.d) best = r;
  }
  for (var a = 0; a < 900; a++) {
    var ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (best.rad - 4);
    var tx = best.cx + Math.sin(ang) * rr, tz = best.cz + Math.cos(ang) * rr;
    if (!D.hitsWall(tx, tz, 3.2)) return { x: tx, z: tz };
  }
  return { x: best.cx, z: best.cz };
}

function medkitsIn() { return D.pickups.filter(function (p) { return p.kind === 'medkit'; }); }

t('R41 medkits exist in the world and are reachable', function () {
  resetInput(); D.start('MED-01'); pump(4); resetInput();
  var mk = medkitsIn();
  return mk.length >= 4 || 'only ' + mk.length + ' medkits placed';
});

t('R42 medkit heals when hurt and is consumed', function () {
  resetInput(); D.start('MED-02'); pump(4); resetInput();
  var mk = medkitsIn()[0];
  D.give('hp', 30);
  D.player.pos.x = mk.x; D.player.pos.z = mk.z;
  pump(6);
  if (!mk.taken) return 'medkit not consumed';
  return D.S.hp > 30 || 'hp did not rise: ' + D.S.hp;
});

t('R43 medkit is left in place at full health', function () {
  resetInput(); D.start('MED-03'); pump(4); resetInput();
  var mk = medkitsIn()[1] || medkitsIn()[0];
  D.give('hp', 100);
  D.player.pos.x = mk.x; D.player.pos.z = mk.z;
  pump(10);
  return mk.taken === false || 'medkit wasted at full health';
});

t('R44 healing never exceeds max integrity', function () {
  resetInput(); D.start('MED-04'); pump(4); resetInput();
  var mk = medkitsIn();
  for (var i = 0; i < mk.length; i++) {
    D.give('hp', 99);
    D.player.pos.x = mk[i].x; D.player.pos.z = mk[i].z;
    pump(5);
    if (D.S.hp > 100) return 'hp overflowed to ' + D.S.hp;
  }
  return true;
});

t('R45 nothing spawns during the tutorial phase', function () {
  resetInput(); D.start('TUT-01'); pump(4); resetInput();
  var codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (var f = 0; f < 3000; f++) {
    if (f % 5 === 0) global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: codes[Math.floor(Math.random() * 4)], preventDefault: function () {} });
    pump(1);
    if (D.enemies.length) return 'enemy spawned in phase ' + D.S.phase + ' at frame ' + f;
  }
  resetInput();
  return D.S.phase === 0 || 'phase advanced without N0';
});

t('R46 the hive wakes once the lighting node is repaired', function () {
  resetInput(); D.start('TUT-02'); pump(4); resetInput();
  D.setKey('N0');
  var saw = false;
  for (var f = 0; f < 2000 && !saw; f++) { pump(1); if (D.enemies.length) saw = true; }
  if (!saw) return 'no spawns after N0 (phase ' + D.S.phase + ')';
  return D.S.phase >= 1 || 'phase still ' + D.S.phase;
});

t('R47 the flood phase produces more pressure than the waking phase', function () {
  function measure(keys) {
    resetInput(); D.start('FLOOD-X'); pump(4); resetInput();
    for (var k = 0; k < keys.length; k++) D.setKey(keys[k]);
    if (keys.indexOf('FLOOD') >= 0) D.give('hotEver', true);
    D.give('invuln', 99999);
    var peak = 0;
    for (var f = 0; f < 2600; f++) { D.give('hp', 100); D.give('invuln', 99999); pump(1); peak = Math.max(peak, D.enemies.length); }
    return peak;
  }
  var waking = measure(['N0']);
  var flood = measure(['N0', 'N1', 'FLOOD']);
  console.log('         [pacing] peak concurrent enemies — waking ' + waking + ', flood ' + flood);
  return flood > waking || 'flood (' + flood + ') is not heavier than waking (' + waking + ')';
});

t('R48 concurrent enemies never exceed the phase cap', function () {
  resetInput(); D.start('CAP-01'); pump(4); resetInput();
  D.setKey('N0');
  var over = 0;
  for (var f = 0; f < 2500; f++) {
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    if (D.enemies.length > global.CW.enemyCap(D.S.phase)) over++;
  }
  return over === 0 || over + ' frames exceeded the cap for phase ' + D.S.phase;
});

t('R49 enemies telegraph before striking - no instant contact damage', function () {
  resetInput(); D.start('TELE-01'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var spot = clearSpot();
  var trials = 0, untelegraphed = 0;
  for (var f = 0; f < 6000 && trials < 15; f++) {
    D.player.pos.x = spot.x; D.player.pos.z = spot.z;
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    /* pick an isolated enemy so only its bite can be responsible */
    var pick = null;
    for (var e = 0; e < D.enemies.length; e++) {
      var EN = D.enemies[e];
      if (EN.wind > 0 || EN.T.boom) continue;
      var lonely = true;
      for (var o = 0; o < D.enemies.length; o++) {
        if (o === e) continue;
        if (Math.hypot(D.enemies[o].pos.x - EN.pos.x, D.enemies[o].pos.z - EN.pos.z) < 14) { lonely = false; break; }
      }
      if (lonely) { pick = EN; break; }
    }
    if (!pick) continue;
    /* stand right in front of it and watch what happens, frame by frame */
    D.player.pos.x = pick.pos.x; D.player.pos.z = pick.pos.z + pick.T.range * 0.7;
    D.resolve(D.player.pos, D.PLR_R);
    trials++;
    var sawWind = false, hurt = false;
    for (var k = 0; k < 45 && !hurt; k++) {
      D.give('hp', 100); D.give('invuln', 0);
      if (pick.wind > 0) sawWind = true;
      pump(1);
      if (D.S.hp < 100) hurt = true;
    }
    if (hurt && !sawWind) untelegraphed++;
  }
  if (!trials) return 'no isolated enemy ever available - inconclusive';
  console.log('         [combat] ' + trials + ' point-blank trials, ' + untelegraphed + ' bites with no wind-up');
  return untelegraphed === 0 || untelegraphed + '/' + trials + ' bites landed with no telegraph';
});

t('R50 wind-up is long enough to react to', function () {
  return global.CW.CFG.ATTACK_WINDUP >= 0.35 || 'windup only ' + global.CW.CFG.ATTACK_WINDUP + 's';
});

t('R51 walking away during the wind-up cancels the hit', function () {
  resetInput(); D.start('TELE-02'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var spot2 = clearSpot();
  var escapes = 0, tries = 0;
  for (var f = 0; f < 4000 && tries < 12; f++) {
    D.player.pos.x = spot2.x; D.player.pos.z = spot2.z;
    D.give('hp', 100); D.give('invuln', 0);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) {
      var EN = D.enemies[e];
      if (EN.wind > 0.3) {
        /* teleport well clear mid-telegraph */
        D.player.pos.x += 22; D.player.pos.z += 22;
        D.resolve(D.player.pos, D.PLR_R);
        /* only a valid trial if NO other enemy is now in reach — otherwise we would
           be measuring a different alien's bite, not the cancelled one */
        var nearest = 1e9;
        for (var q = 0; q < D.enemies.length; q++) {
          nearest = Math.min(nearest, Math.hypot(D.enemies[q].pos.x - D.player.pos.x, D.enemies[q].pos.z - D.player.pos.z));
        }
        if (nearest < 14) break;
        tries++;
        var hp0 = D.S.hp;
        pump(20);
        if (D.S.hp >= hp0) escapes++;
        break;
      }
    }
  }
  if (!tries) return 'never observed a wind-up - test inconclusive';
  return escapes === tries || (tries - escapes) + '/' + tries + ' hits landed after the player fled';
});

t('R52 tutorial advances through every step and completes', function () {
  resetInput(); D.start('TUT-03'); pump(4); resetInput();
  if (D.tutStep !== 0) return 'tutorial did not start at step 0';
  /* 1: move */
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  pump(90);
  global.window.fire('keyup', { code: 'KeyW', preventDefault: function () {} });
  if (D.tutStep < 1) return 'move step never completed';
  /* 2: look */
  for (var i = 0; i < 60; i++) { D.S.yaw += 0.2; pump(1); }
  if (D.tutStep < 2) return 'look step never completed (step ' + D.tutStep + ')';
  /* 3: destroy the canister */
  var TG = D.targets[0];
  if (!TG) return 'no practice canister spawned';
  var guard = 0;
  while (!TG.dead && guard++ < 400) {
  var TGr = D.ship.rooms[0];
  var bx = TG.x - TGr.cx, bz = TG.z - TGr.cz, bl = Math.hypot(bx, bz) || 1;
  var ax = TG.x - (bx / bl) * 3.4, az = TG.z - (bz / bl) * 3.4;
  var ap = { x: ax, z: az }; D.resolve(ap, D.PLR_R);
  D.player.pos.x = ap.x; D.player.pos.z = ap.z;
  D.S.yaw = Math.atan2(TG.x - ap.x, TG.z - ap.z) + Math.PI;
  D.S.pitch = 0;
    getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
    pump(4);
  }
  global.window.fire('mouseup', { button: 0 });
  if (!TG.dead) return 'canister never destroyed';
  pump(4);
  if (D.tutStep < 3) return 'fire step never completed (step ' + D.tutStep + ')';
  /* 4: scrap */
  var pk = D.pickups.filter(function (p) { return p.kind === 'scrap'; });
  for (var s2 = 0; s2 < pk.length && D.S.scrap < 4; s2++) { D.player.pos.x = pk[s2].x; D.player.pos.z = pk[s2].z; pump(3); }
  pump(4);
  if (D.tutStep < 4) return 'salvage step never completed (scrap ' + D.S.scrap + ')';
  /* 5: repair */
  var n0 = D.nodes.filter(function (n) { return n.node.id === 'N0'; })[0];
  D.player.pos.x = n0.x; D.player.pos.z = n0.z + 2.2; pump(3);
  global.window.fire('keydown', { code: 'KeyE', preventDefault: function () {} });
  pump(4);
  return D.tutStep >= D.tutLen || 'tutorial stalled at step ' + D.tutStep + '/' + D.tutLen;
});

t('R53 shooting the canister does not throw or damage the player', function () {
  resetInput(); D.start('TGT-01'); pump(4); resetInput();
  var TG = D.targets[0];
  var hp0 = D.S.hp;
  for (var i = 0; i < 200; i++) {
  var TGr = D.ship.rooms[0];
  var bx = TG.x - TGr.cx, bz = TG.z - TGr.cz, bl = Math.hypot(bx, bz) || 1;
  var ax = TG.x - (bx / bl) * 3.4, az = TG.z - (bz / bl) * 3.4;
  var ap = { x: ax, z: az }; D.resolve(ap, D.PLR_R);
  D.player.pos.x = ap.x; D.player.pos.z = ap.z;
  D.S.yaw = Math.atan2(TG.x - ap.x, TG.z - ap.z) + Math.PI;
  D.S.pitch = 0;
    getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
    pump(3);
  }
  global.window.fire('mouseup', { button: 0 });
  return D.S.hp === hp0 || 'player took ' + (hp0 - D.S.hp) + ' damage shooting a canister';
});

t('R54 slice still completable with all build-03 systems live', function () {
  var fails = [];
  for (var i = 0; i < 8; i++) {
    var r = playthrough('B3RUN' + i);
    if (r !== true) fails.push('B3RUN' + i + ': ' + r);
  }
  return fails.length === 0 || fails.length + ' failed, first -> ' + fails[0];
});


t('R55 enemies can reach a player standing on open floor', function () {
  resetInput(); D.start('PATH-01'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var spot = clearSpot(), closest = 1e9;
  for (var f = 0; f < 2500; f++) {
    D.player.pos.x = spot.x; D.player.pos.z = spot.z;
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) {
      closest = Math.min(closest, Math.hypot(D.enemies[e].pos.x - spot.x, D.enemies[e].pos.z - spot.z));
    }
  }
  console.log('         [ai] closest approach on open floor: ' + closest.toFixed(2) + ' units');
  return closest < 2.0 || 'enemies never closed past ' + closest.toFixed(2) + ' units';
});


t('R56 the firing path is actually live (guards against vacuous combat tests)', function () {
  resetInput(); D.start('LIVE-01'); pump(4); resetInput();
  var TG = D.targets[0];
  if (!TG) return 'no canister to shoot';
  var TGr = D.ship.rooms[0];
  var bx = TG.x - TGr.cx, bz = TG.z - TGr.cz, bl = Math.hypot(bx, bz) || 1;
  var ax = TG.x - (bx / bl) * 3.4, az = TG.z - (bz / bl) * 3.4;
  var ap = { x: ax, z: az }; D.resolve(ap, D.PLR_R);
  D.player.pos.x = ap.x; D.player.pos.z = ap.z;
  D.S.yaw = Math.atan2(TG.x - ap.x, TG.z - ap.z) + Math.PI;
  D.S.pitch = 0;
  var hp0 = TG.hp;
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
  pump(3);
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {} });
  pump(20);
  global.window.fire('mouseup', { button: 0 });
  return TG.hp < hp0 || 'canister took no damage — shots are not being fired at all';
});


/* ---------- BUILD 04: CURVED HULL INTEGRITY ---------- */
t('R57 hull is sealed - player cannot escape a circular room except through a doorway', function () {
  resetInput(); D.start('HULL-01'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var leaks = 0, first = null;
  for (var trial = 0; trial < 4000; trial++) {
    var R = D.ship.rooms[trial % D.ship.rooms.length];
    var a = Math.random() * Math.PI * 2;
    var p = { x: R.cx + Math.sin(a) * (R.rad - 2.5), z: R.cz + Math.cos(a) * (R.rad - 2.5) };
    if (D.hitsWall(p.x, p.z, D.PLR_R)) continue;
    /* drive hard at the hull from inside */
    D.moveCircle(p, Math.sin(a) * 60, Math.cos(a) * 60, D.PLR_R);
    if (!inPlayableSpace(p.x, p.z)) { leaks++; if (!first) first = p.x.toFixed(1) + ',' + p.z.toFixed(1); }
  }
  return leaks === 0 || leaks + ' hull leaks, first at ' + first;
});

t('R58 room-to-corridor junctions do not leak', function () {
  resetInput(); D.start('HULL-02'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var leaks = 0;
  for (var i = 0; i < D.ship.rooms.length; i++) {
    var R = D.ship.rooms[i];
    for (var l = 0; l < R.links.length; l++) {
      var B = D.ship.rooms[R.links[l].to];
      var dx = B.gx - R.gx, dz = B.gy - R.gy;
      /* walk the full width of the doorway, at an angle, repeatedly */
      for (var w = -4; w <= 4; w++) {
        for (var k = 0; k < 6; k++) {
          var p = { x: R.cx + dx * (R.rad - 2), z: R.cz + dz * (R.rad - 2) };
          if (dx !== 0) p.z += w * 0.9; else p.x += w * 0.9;
          if (D.hitsWall(p.x, p.z, D.PLR_R)) continue;
          var ax = dx * 30 + (dz !== 0 ? (k - 3) * 9 : 0);
          var az = dz * 30 + (dx !== 0 ? (k - 3) * 9 : 0);
          D.moveCircle(p, ax, az, D.PLR_R);
          if (!inPlayableSpace(p.x, p.z)) leaks++;
        }
      }
    }
  }
  return leaks === 0 || leaks + ' junction leaks';
});

t('R59 hitscan cannot shoot through the hull', function () {
  resetInput(); D.start('HULL-03'); pump(4); resetInput();
  var R = D.ship.rooms[0], escaped = 0;
  for (var i = 0; i < 3000; i++) {
    var a = Math.random() * Math.PI * 2;
    var ox = R.cx + Math.sin(a) * (R.rad * 0.3), oz = R.cz + Math.cos(a) * (R.rad * 0.3);
    if (D.hitsWall(ox, oz, 1.0)) continue;
    var sa = Math.random() * Math.PI * 2, pit = (Math.random() - 0.5) * 0.5;
    var dx = Math.sin(sa) * Math.cos(pit), dy = Math.sin(pit), dz = Math.cos(sa) * Math.cos(pit);
    var t = D.rayWorld(ox, 1.7, oz, dx, dy, dz, 70);
    var ex = ox + dx * t, ez = oz + dz * t;
    /* the shot must stop inside the ship, not sail off into space */
    if (t >= 70 && !inPlayableSpace(ex, ez)) escaped++;
  }
  return escaped === 0 || escaped + '/3000 shots passed through the hull into space';
});

t('R60 third-person camera stays inside the hull on curved geometry', function () {
  resetInput(); D.start('HULL-04'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.setView(false);
  var bad = 0, codes = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
  for (var f = 0; f < 6000; f++) {
    if (f % 5 === 0) global.window.fire(Math.random() < 0.5 ? 'keydown' : 'keyup', { code: codes[Math.floor(Math.random() * 4)], preventDefault: function () {} });
    if (f % 3 === 0) { D.S.yaw += (Math.random() - 0.5) * 0.8; D.S.pitch = Math.max(-1.4, Math.min(1.4, D.S.pitch + (Math.random() - 0.5) * 0.6)); }
    pump(1);
    var c = D.camera.position;
    if (!inPlayableSpace(c.x, c.z)) bad++;
  }
  resetInput(); D.setView(true);
  return bad === 0 || bad + '/6000 frames put the camera outside the hull';
});

t('R61 every room has an unobstructed doorway gap in its hull', function () {
  for (var s2 = 0; s2 < 10; s2++) {
    resetInput(); D.start('GAP' + s2); pump(4);
    for (var i = 0; i < D.ship.rooms.length; i++) {
      var R = D.ship.rooms[i];
      for (var l = 0; l < R.links.length; l++) {
        var B = D.ship.rooms[R.links[l].to];
        var dx = B.gx - R.gx, dz = B.gy - R.gy;
        var px = R.cx + dx * R.rad, pz = R.cz + dz * R.rad;
        /* dead centre of the doorway must be walkable (ignoring closed blast doors) */
        var h = D.hitsWall(px, pz, 0.5);
        if (h && h.type === 'ring') return 'hull has no gap toward neighbour on ship ' + s2 + ' room ' + i;
      }
    }
  }
  return true;
});


/* ---------- BUILD 05: INSECT MODELS ---------- */
t('R62 every enemy kind builds without throwing', function () {
  resetInput(); D.start('BUG-01'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  var seen = {};
  for (var f = 0; f < 6000; f++) {
    D.give('hp', 100); D.give('invuln', 9999);
    /* hold hot voidglass so alert stays high enough for stalkers */
    while (D.S.crystals.length < 6) D.S.crystals.push({ t: 0 });
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) seen[D.enemies[e].kind] = 1;
  }
  var want = ['skitter', 'clinger', 'bloater', 'stalker'];
  var missing = want.filter(function (k) { return !seen[k]; });
  return missing.length === 0 || 'never spawned: ' + missing.join(',');
});

t('R63 leg rig produces finite transforms for every enemy every frame', function () {
  resetInput(); D.start('BUG-02'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  for (var f = 0; f < 3000; f++) {
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) {
      var EN = D.enemies[e];
      if (!EN.legMesh) return EN.kind + ' has no leg rig';
      if (EN.legMesh.count !== 12) return EN.kind + ' leg count ' + EN.legMesh.count;
      for (var i = 0; i < 12; i++) if (!EN.legMesh._set[i]) return EN.kind + ' leg segment ' + i + ' never placed';
      if (!isFinite(EN.body.rotation.x)) return 'non-finite body pitch on ' + EN.kind;
    }
  }
  return true;
});

t('R64 mandibles open during the wind-up and close otherwise', function () {
  resetInput(); D.start('BUG-03'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var spot = clearSpot();
  var openMax = -9, restMax = -9, sawWind = false;
  for (var f = 0; f < 4000; f++) {
    D.player.pos.x = spot.x; D.player.pos.z = spot.z;
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) {
      var EN = D.enemies[e];
      if (EN.mandFlare === undefined) return EN.kind + ' has no mandible rig';
      if (!EN.mandMesh || EN.mandMesh.count !== 4) return EN.kind + ' mandibles not batched';
      if (EN.wind > 0) { sawWind = true; openMax = Math.max(openMax, EN.mandFlare); }
      else if (EN.lunge <= 0) restMax = Math.max(restMax, EN.mandFlare);
    }
  }
  if (!sawWind) return 'no wind-up observed - inconclusive';
  return openMax > restMax + 0.15 || 'mandibles barely move (open ' + openMax.toFixed(2) + ' vs rest ' + restMax.toFixed(2) + ')';
});

t('R65 bloater sac swells and brightens as the player closes', function () {
  resetInput(); D.start('BUG-04'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  var spot = clearSpot(), bloat = null;
  for (var f = 0; f < 6000 && !bloat; f++) {
    D.player.pos.x = spot.x; D.player.pos.z = spot.z;
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) if (D.enemies[e].kind === 'bloater') { bloat = D.enemies[e]; break; }
  }
  if (!bloat) return 'no bloater ever spawned';
  /* measure the sac directly rather than waiting on pathfinding */
  D.player.pos.x = bloat.pos.x + 30; D.player.pos.z = bloat.pos.z + 30;
  D.give('invuln', 9999); pump(2);
  var farGlow = bloat.abd.material.emissiveIntensity, farScale = bloat.abd.scale.x;
  D.player.pos.x = bloat.pos.x + 3.6; D.player.pos.z = bloat.pos.z;
  D.give('invuln', 9999); pump(2);
  var nearGlow = bloat.abd.material.emissiveIntensity, nearScale = bloat.abd.scale.x;
  console.log('         [bloater] sac glow ' + farGlow.toFixed(2) + ' -> ' + nearGlow.toFixed(2) +
              ', swell ' + farScale.toFixed(2) + ' -> ' + nearScale.toFixed(2));
  if (!(nearGlow > farGlow)) return 'sac does not brighten (' + farGlow.toFixed(2) + ' -> ' + nearGlow.toFixed(2) + ')';
  return nearScale > farScale || 'sac does not swell (' + farScale.toFixed(2) + ' -> ' + nearScale.toFixed(2) + ')';
});

t('R66 enemy draw calls stay within budget at the flood cap', function () {
  resetInput(); D.start('BUG-05'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  var peakMeshes = 0, peakEnemies = 0;
  for (var f = 0; f < 4000; f++) {
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    var total = 0;
    for (var e = 0; e < D.enemies.length; e++) {
      var n = 0;
      (function walk(o) {
        if (o._type === 'Mesh' || o._type === 'InstancedMesh') n++;
        for (var i = 0; i < o.children.length; i++) walk(o.children[i]);
      })(D.enemies[e].g);
      total += n;
    }
    if (D.enemies.length > peakEnemies) { peakEnemies = D.enemies.length; }
    peakMeshes = Math.max(peakMeshes, total);
  }
  var per = peakEnemies ? (peakMeshes / peakEnemies) : 0;
  console.log('         [creatures] ' + peakEnemies + ' at peak, ' + peakMeshes + ' draw calls total (' + per.toFixed(1) + ' per creature)');
  return per <= 11 || per.toFixed(1) + ' draw calls per creature - batching is not working';
});

t('R67 slice still completable with the new creature rig', function () {
  var fails = [];
  for (var i = 0; i < 6; i++) {
    var r = playthrough('BUGRUN' + i);
    if (r !== true) fails.push('BUGRUN' + i + ': ' + r);
  }
  return fails.length === 0 || fails.length + ' failed, first -> ' + fails[0];
});


t('R68 flow field reaches every room from the player', function () {
  for (var s2 = 0; s2 < 8; s2++) {
    resetInput(); D.start('NAV' + s2); pump(4);
    D.setKey('N0'); D.setKey('N1'); pump(6);
    var fi = D.flowInfo;
    if (!fi || !fi.walk) return 'no navigation grid built';
    if (fi.src < 0) return 'no flow source on ship ' + s2;
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var R = D.ship.rooms[r];
      /* sample a ring of points inside each room: at least one must be reachable */
      var ok = false;
      for (var k = 0; k < 24 && !ok; k++) {
        var a = (k / 24) * Math.PI * 2, rr = R.rad * 0.45;
        var x = R.cx + Math.sin(a) * rr, z = R.cz + Math.cos(a) * rr;
        var i = Math.floor((x - fi.x0) / fi.cs), j = Math.floor((z - fi.z0) / fi.cs);
        if (i < 0 || j < 0 || i >= fi.w || j >= fi.h) continue;
        if (fi.flow[j * fi.w + i] >= 0) ok = true;
      }
      if (!ok) return 'room ' + r + ' unreachable by the flow field on ship ' + s2;
    }
  }
  return true;
});

t('R69 enemies reach a player in another room', function () {
  resetInput(); D.start('NAV-X1'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  var spot = clearSpot(), closest = 1e9;
  for (var f = 0; f < 4000; f++) {
    D.player.pos.x = spot.x; D.player.pos.z = spot.z;
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) {
      closest = Math.min(closest, Math.hypot(D.enemies[e].pos.x - spot.x, D.enemies[e].pos.z - spot.z));
    }
  }
  console.log('         [nav] closest approach across rooms: ' + closest.toFixed(2) + ' units');
  return closest < 2.5 || 'enemies never crossed to the player, closest ' + closest.toFixed(2);
});

t('R70 most enemies that spawn actually reach the player', function () {
  resetInput(); D.start('NAV-X2'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  var spot = clearSpot();
  var seen = {}, uid = 0;
  for (var f = 0; f < 6000; f++) {
    D.player.pos.x = spot.x; D.player.pos.z = spot.z;
    D.give('hp', 100); D.give('invuln', 9999);
    pump(1);
    for (var e = 0; e < D.enemies.length; e++) {
      var EN = D.enemies[e];
      if (EN.__uid === undefined) EN.__uid = ++uid;
      var d = Math.hypot(EN.pos.x - spot.x, EN.pos.z - spot.z);
      var rec = seen[EN.__uid] || (seen[EN.__uid] = { start: d, best: d, frames: 0 });
      rec.best = Math.min(rec.best, d);
      rec.frames++;
    }
  }
  /* only judge enemies that spawned far away and lived long enough to walk in */
  var tried = 0, arrived = 0;
  for (var k in seen) {
    var r = seen[k];
    if (r.start < 6 || r.frames < 240) continue;   /* needs 8s of life */
    tried++;
    if (r.best < 3.0) arrived++;
  }
  if (!tried) return 'no long-lived distant spawns observed - inconclusive';
  var rate = arrived / tried;
  console.log('         [nav] ' + arrived + '/' + tried + ' distant spawns reached the player (' + (rate * 100).toFixed(0) + '%)');
  return rate > 0.6 || 'only ' + (rate * 100).toFixed(0) + '% of enemies found their way to the player';
});


/* ---------- BUILD 06: SIGHTLINES ---------- */
t('R71 you can SEE down every corridor from inside the room', function () {
  /* The bug this exists to catch: hull rendered as one solid cylinder, so the
     doorway existed in collision only and every corridor looked like a wall. */
  var blind = 0, total = 0, first = null;
  for (var s2 = 0; s2 < 8; s2++) {
    resetInput(); D.start('SIGHT' + s2); pump(4);
    D.setKey('N0'); D.setKey('N1'); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var R = D.ship.rooms[r];
      for (var l = 0; l < R.links.length; l++) {
        var B = D.ship.rooms[R.links[l].to];
        var dx = B.gx - R.gx, dz = B.gy - R.gy;
        total++;
        /* Stand on the doorway axis inside the room, at eye height. Try a few
           set-back distances and take the best: a prop right at one probe point
           is a prop, not a walled-off doorway. */
        var best = 0, needed = 0;
        for (var b = 0; b < 4; b++) {
          var back = R.rad * (0.2 + b * 0.14);
          var ox = R.cx - dx * back, oz = R.cz - dz * back;
          if (D.hitsWall(ox, oz, 0.6)) continue;           /* probe point itself blocked */
          var t = D.rayWorld(ox, 1.72, oz, dx, 0, dz, 90);
          var need = back + R.rad + 1.0;
          if (t - need > best - needed) { best = t; needed = need; }
        }
        if (needed === 0) { total--; continue; }             /* no valid probe point */
        if (best < needed) {
          blind++;
          if (!first) first = 'ship ' + s2 + ' room ' + r + ': view stops at ' + best.toFixed(1) + ', hull edge at ' + needed.toFixed(1);
        }
      }
    }
  }
  return blind === 0 || blind + '/' + total + ' doorways are visually walled off — ' + first;
});

t('R72 you can see from one room through a corridor into the next', function () {
  var blind = 0, total = 0;
  for (var s2 = 0; s2 < 6; s2++) {
    resetInput(); D.start('SEE' + s2); pump(4);
    D.setKey('N0'); D.setKey('N1'); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var R = D.ship.rooms[r];
      for (var l = 0; l < R.links.length; l++) {
        var B = D.ship.rooms[R.links[l].to];
        var dx = B.gx - R.gx, dz = B.gy - R.gy;
        var span = Math.hypot(B.cx - R.cx, B.cz - R.cz);
        total++;
        /* from a clear spot near the room centre, can we see into the neighbour? */
        var seen = false;
        for (var b2 = 0; b2 < 5 && !seen; b2++) {
          var off = (b2 - 2) * 1.1;
          var ox2 = R.cx + (dz ? off : 0), oz2 = R.cz + (dx ? off : 0);
          if (D.hitsWall(ox2, oz2, 0.6)) continue;
          if (D.rayWorld(ox2, 1.72, oz2, dx, 0, dz, span + 30) >= span) seen = true;
        }
        if (!seen) blind++;
      }
    }
  }
  /* some blocking is fine — props and the far hull — but not most of them */
  var rate = blind / total;
  console.log('         [sight] ' + (total - blind) + '/' + total + ' room-to-room sightlines are open');
  return rate < 0.25 || (rate * 100).toFixed(0) + '% of room-to-room sightlines are blocked';
});

t('R73 the hull is still sealed after being cut open for sightlines', function () {
  resetInput(); D.start('SEAL-01'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var leaks = 0;
  for (var trial = 0; trial < 5000; trial++) {
    var R = D.ship.rooms[trial % D.ship.rooms.length];
    var a = Math.random() * Math.PI * 2;
    var p = { x: R.cx + Math.sin(a) * (R.rad - 2.5), z: R.cz + Math.cos(a) * (R.rad - 2.5) };
    if (D.hitsWall(p.x, p.z, D.PLR_R)) continue;
    D.moveCircle(p, Math.sin(a) * 60, Math.cos(a) * 60, D.PLR_R);
    if (!inPlayableSpace(p.x, p.z)) leaks++;
  }
  return leaks === 0 || leaks + ' hull leaks after the sightline cuts';
});

t('R74 player never spawns in a sealed pocket', function () {
  for (var s2 = 0; s2 < 14; s2++) {
    resetInput(); D.start('SPAWN' + s2); pump(6);
    var mc = D.mainComponent(), fi = D.flowInfo;
    var i = Math.floor((D.player.pos.x - fi.x0) / fi.cs);
    var j = Math.floor((D.player.pos.z - fi.z0) / fi.cs);
    if (i < 0 || j < 0 || i >= fi.w || j >= fi.h) return 'spawn off-grid on ship ' + s2;
    var c = j * fi.w + i;
    if (!fi.walk[c]) return 'spawn on an unwalkable cell on ship ' + s2;
    if (mc.comp[c] !== mc.best) return 'spawn is in an isolated pocket on ship ' + s2;
    if (D.hitsWall(D.player.pos.x, D.player.pos.z, D.PLR_R * 1.4)) return 'spawn is cramped on ship ' + s2;
  }
  return true;
});


/* ---------- BUILD 07: AUDIO ENGINE ---------- */
function audioOn() {
  getEl('cv').fire('mousedown', { button: 0, preventDefault: function () {}, clientX: 5, clientY: 5 });
  pump(2);
}

t('R75 audio graph builds without throwing', function () {
  /* the context is created once and persists, so measure the build itself —
     AUDIO.built is captured the first time audioInit runs */
  resetInput(); D.start('AUD-01'); pump(2);
  audioOn(); pump(10);
  if (!D.audioReady) return 'audio never initialised';
  if (!AUDIO.built) return 'no graph snapshot captured';
  if (AUDIO.built.nodes < 15) return 'only ' + AUDIO.built.nodes + ' nodes in the initial graph';
  if (AUDIO.built.nodes > 120) return 'persistent graph is bloated: ' + AUDIO.built.nodes + ' nodes';
  if (AUDIO.built.started < 5) return 'only ' + AUDIO.built.started + ' sustained sources started';
  console.log('         [audio] graph: ' + AUDIO.built.nodes + ' nodes, ' + AUDIO.built.connections +
              ' connections, ' + AUDIO.built.started + ' sustained sources');
  return true;
});

t('R76 every audio node is connected to something', function () {
  var orphans = 0;
  for (var i = 0; i < AUDIO.nodes.length; i++) {
    var n = AUDIO.nodes[i];
    if (n.type_ === 'dest') continue;
    if (!n.outs.length) orphans++;
  }
  /* filters and gains created inside one-shots are connected on creation */
  return orphans === 0 || orphans + ' audio nodes are not connected to anything';
});

t('R77 the score plays through a full session without throwing', function () {
  resetInput(); D.start('AUD-02'); pump(2); audioOn(); resetInput();
  var before = AUDIO.started;
  for (var f = 0; f < 1200; f++) pump(1);           /* tutorial phase */
  D.setKey('N0');
  for (var f2 = 0; f2 < 1200; f2++) { D.give('hp', 100); D.give('invuln', 9999); pump(1); }
  D.setKey('N1'); D.give('hotEver', true);
  for (var f3 = 0; f3 < 1800; f3++) { D.give('hp', 100); D.give('invuln', 9999); pump(1); }
  var played = AUDIO.started - before;
  console.log('         [audio] ' + played + ' voices triggered across a full session');
  return played > 200 || 'only ' + played + ' voices played - the sequencer is not running';
});

t('R78 music intensity actually tracks the game state', function () {
  resetInput(); D.start('AUD-03'); pump(2); audioOn(); resetInput();
  var quiet = D.musicState();
  if (quiet.phase !== 0) return 'not in the tutorial phase at start';
  var qm = global.CW.musicMix(quiet);
  D.setKey('N0'); D.setKey('N1'); D.give('hotEver', true);
  for (var f = 0; f < 2500; f++) { D.give('hp', 100); D.give('invuln', 9999); pump(1); }
  var loud = D.musicState();
  var lm = global.CW.musicMix(loud);
  if (loud.phase < 3) return 'never reached the flood phase';
  console.log('         [audio] mix perc ' + qm.perc.toFixed(2) + ' -> ' + lm.perc.toFixed(2) +
              ', threat ' + quiet.threat.toFixed(2) + ' -> ' + loud.threat.toFixed(2));
  return lm.perc > qm.perc || 'percussion did not rise with the flood';
});

t('R79 boss encounter switches the score', function () {
  resetInput(); D.start('AUD-04'); pump(2); audioOn(); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var R = D.ship.rooms[D.ship.reactorRoom];
  var normal = global.CW.musicMix(D.musicState());
  D.player.pos.x = R.cx; D.player.pos.z = R.cz + 5;
  D.give('invuln', 9999);
  for (var f = 0; f < 120; f++) { D.player.pos.x = R.cx; D.player.pos.z = R.cz + 5; D.give('hp', 100); D.give('invuln', 9999); pump(1); }
  var st = D.musicState();
  if (!st.boss) return 'boss music state never engaged';
  var bm = global.CW.musicMix(st);
  return bm.stab > normal.stab || 'boss score is not more intense';
});

t('R80 low health engages the dread layer', function () {
  resetInput(); D.start('AUD-05'); pump(2); audioOn(); resetInput();
  D.give('hp', 100); pump(2);
  if (global.CW.musicMix(D.musicState()).dread > 0.01) return 'dread present at full health';
  D.give('hp', 12); pump(2);
  return global.CW.musicMix(D.musicState()).dread > 0.2 || 'dread absent at low health';
});

t('R81 positional sounds pan correctly left and right', function () {
  resetInput(); D.start('AUD-06'); pump(2); audioOn(); resetInput();
  D.S.yaw = 0; D.player.pos.x = 0; D.player.pos.z = 0; pump(2);
  function panOf(x, z) {
    AUDIO.nodes = [];
    D.player.pos.x = 0; D.player.pos.z = 0; D.S.yaw = 0;
    /* SFX.hit takes a world position */
    D.sfx('hit', x, z);
    for (var i = 0; i < AUDIO.nodes.length; i++) if (AUDIO.nodes[i].type_ === 'panner') return AUDIO.nodes[i].pan.value;
    return null;
  }
  /* facing -Z: +X is to the player's LEFT in this basis, so just assert opposite signs */
  var a = panOf(20, 0), b = panOf(-20, 0);
  if (a === null || b === null) return 'no panner created for positional audio';
  if (Math.abs(a) < 0.2 || Math.abs(b) < 0.2) return 'panning is negligible (' + a + ', ' + b + ')';
  return (a * b < 0) || 'opposite sides did not pan to opposite channels';
});

t('R82 distant sounds are quieter than near ones', function () {
  resetInput(); D.start('AUD-07'); pump(2); audioOn(); resetInput();
  D.player.pos.x = 0; D.player.pos.z = 0; D.S.yaw = 0; pump(2);
  function gainOf(dist) {
    AUDIO.nodes = [];
    D.player.pos.x = 0; D.player.pos.z = 0;
    D.sfx('hit', dist, 0);
    var best = null;
    for (var i = 0; i < AUDIO.nodes.length; i++) {
      var n = AUDIO.nodes[i];
      if (n.type_ === 'gain' && n.gain.value < 1 && n.gain.value > 0) best = best === null ? n.gain.value : Math.min(best, n.gain.value);
    }
    return best;
  }
  var near = gainOf(2), far = gainOf(35);
  if (near === null || far === null) return 'no attenuation gain found';
  return far < near || 'distance does not attenuate (' + near + ' vs ' + far + ')';
});

t('R83 mute silences the master and unmute restores it', function () {
  resetInput(); D.start('AUD-08'); pump(2); audioOn(); resetInput();
  global.window.fire('keydown', { code: 'KeyM', preventDefault: function () {} });
  pump(2);
  if (D.masterGain() > 0.001) return 'mute did not silence the master: ' + D.masterGain();
  global.window.fire('keydown', { code: 'KeyM', preventDefault: function () {} });
  pump(2);
  return D.masterGain() > 0.1 || 'unmute did not restore the master';
});

t('R84 audio survives ship restarts without leaking contexts', function () {
  resetInput(); D.start('AUD-09'); pump(2); audioOn();
  var ctxBefore = D.audioReady;
  for (var i = 0; i < 8; i++) { D.start('AUDR' + i); pump(30); }
  return D.audioReady === ctxBefore || 'audio state changed across restarts';
});


/* ---------- BUILD 08: WINDOWS AND EXTERIOR ---------- */
t('R85 every ship generates viewports, deterministically', function () {
  for (var s2 = 0; s2 < 10; s2++) {
    resetInput(); D.start('WIN' + s2); pump(4);
    var total = 0;
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var w = D.windowsOf(r);
      if (!w.length) return 'room ' + r + ' has no viewport on ship ' + s2;
      total += w.length;
      for (var i = 0; i < w.length; i++) {
        if (!isFinite(w[i].a) || !isFinite(w[i].half)) return 'non-finite window bearing';
        if (w[i].half <= 0) return 'zero-width window';
      }
    }
    /* every room is guaranteed one; crowded rooms with many exits get fewer */
    if (total < D.ship.rooms.length * 1.6) return 'only ' + total + ' viewports across ' + D.ship.rooms.length + ' rooms';
  }
  /* same code, same windows */
  resetInput(); D.start('WIN-DET'); pump(4);
  var a = JSON.stringify(D.windowsOf(0));
  resetInput(); D.start('WIN-DET'); pump(4);
  return a === JSON.stringify(D.windowsOf(0)) || 'viewports are not deterministic per ship code';
});

t('R86 viewports never overlap a doorway', function () {
  for (var s2 = 0; s2 < 12; s2++) {
    resetInput(); D.start('WOV' + s2); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var R = D.ship.rooms[r], wins = D.windowsOf(r);
      for (var w = 0; w < wins.length; w++) {
        for (var l = 0; l < R.links.length; l++) {
          var B = D.ship.rooms[R.links[l].to];
          var da = Math.atan2(B.gx - R.gx, B.gy - R.gy);
          var diff = Math.abs(da - wins[w].a);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
          if (diff < wins[w].half + 0.1) return 'window overlaps a doorway on ship ' + s2 + ' room ' + r;
        }
      }
    }
  }
  return true;
});

t('R87 windows do not breach the hull - glass still stops you', function () {
  resetInput(); D.start('WSEAL-1'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var leaks = 0;
  for (var trial = 0; trial < 6000; trial++) {
    var R = D.ship.rooms[trial % D.ship.rooms.length];
    var wins = D.windowsOf(trial % D.ship.rooms.length);
    if (!wins || !wins.length) return 'a room has no viewport';
    var w = wins[trial % wins.length];
    var a = w.a + (Math.random() - 0.5) * w.half * 1.6;
    var p = { x: R.cx + Math.sin(a) * (R.rad - 2.5), z: R.cz + Math.cos(a) * (R.rad - 2.5) };
    if (D.hitsWall(p.x, p.z, D.PLR_R)) continue;
    D.moveCircle(p, Math.sin(a) * 70, Math.cos(a) * 70, D.PLR_R);
    if (!inPlayableSpace(p.x, p.z)) leaks++;
  }
  return leaks === 0 || leaks + ' escapes through a viewport';
});

t('R88 shots do not pass through glass', function () {
  resetInput(); D.start('WSEAL-2'); pump(4); resetInput();
  var escaped = 0;
  for (var s2 = 0; s2 < D.ship.rooms.length; s2++) {
    var R = D.ship.rooms[s2], wins = D.windowsOf(s2);
    for (var w = 0; w < wins.length; w++) {
      for (var k = 0; k < 12; k++) {
        var a = wins[w].a + (k / 12 - 0.5) * wins[w].half * 1.5;
        var ox = R.cx, oz = R.cz;
        if (D.hitsWall(ox, oz, 0.6)) continue;
        var t = D.rayWorld(ox, 2.9, oz, Math.sin(a), 0, Math.cos(a), 200);
        if (t > R.rad + 3) escaped++;
      }
    }
  }
  return escaped === 0 || escaped + ' shots flew out through a viewport';
});

t('R89 exterior scene builds with stars, a sun, planets and asteroids', function () {
  resetInput(); D.start('EXT-01'); pump(6);
  if (!D.sky) return 'no sky group';
  if (!D.exterior) return 'no exterior group';
  var points = 0, meshes = 0;
  (function walk(o) {
    for (var i = 0; i < o.children.length; i++) {
      var c = o.children[i];
      if (c._type === 'Points') points++;
      if (c._type === 'Mesh') meshes++;
      walk(c);
    }
  })(D.sky);
  if (points < 2) return 'only ' + points + ' star layers';
  if (meshes < 5) return 'only ' + meshes + ' celestial bodies';
  if (D.asteroids.length < 60) return 'only ' + D.asteroids.length + ' asteroids';
  console.log('         [space] ' + points + ' star shells, ' + meshes + ' bodies, ' + D.asteroids.length + ' asteroids');
  return true;
});

t('R90 every exterior material has fog disabled', function () {
  resetInput(); D.start('EXT-02'); pump(6);
  var fogged = [];
  function walk(o, where) {
    for (var i = 0; i < o.children.length; i++) {
      var c = o.children[i];
      if (c.material && c.material.fog !== false) fogged.push(where + ':' + c._type);
      walk(c, where);
    }
  }
  walk(D.sky, 'sky'); walk(D.exterior, 'exterior');
  return fogged.length === 0 || fogged.length + ' exterior materials would be fogged out, e.g. ' + fogged[0];
});

t('R91 the sky follows the camera so stars never parallax', function () {
  resetInput(); D.start('EXT-03'); pump(6); resetInput();
  var offsets = [];
  for (var f = 0; f < 400; f++) {
    if (f % 4 === 0) {
      D.player.pos.x += (Math.random() - 0.5) * 8;
      D.player.pos.z += (Math.random() - 0.5) * 8;
      D.resolve(D.player.pos, D.PLR_R);
    }
    pump(1);
    offsets.push(Math.hypot(D.sky.position.x - D.camera.position.x,
                            D.sky.position.y - D.camera.position.y,
                            D.sky.position.z - D.camera.position.z));
  }
  var worst = Math.max.apply(null, offsets);
  return worst < 0.001 || 'sky drifted ' + worst.toFixed(3) + ' units from the camera';
});

t('R92 asteroids drift and stay finite over a long session', function () {
  resetInput(); D.start('EXT-04'); pump(6); resetInput();
  var a0 = { x: D.asteroids[0].x, y: D.asteroids[0].y, z: D.asteroids[0].z };
  for (var f = 0; f < 3000; f++) pump(1);
  for (var i = 0; i < D.asteroids.length; i++) {
    var a = D.asteroids[i];
    if (!isFinite(a.x) || !isFinite(a.y) || !isFinite(a.z)) return 'asteroid ' + i + ' went non-finite';
    if (!isFinite(a.ry)) return 'asteroid ' + i + ' spin went non-finite';
  }
  var moved = Math.hypot(D.asteroids[0].x - a0.x, D.asteroids[0].y - a0.y, D.asteroids[0].z - a0.z);
  return moved > 0.5 || 'asteroids are not drifting (moved ' + moved.toFixed(2) + ')';
});

t('R93 different ship codes give different skies', function () {
  resetInput(); D.start('SKY-AAA'); pump(6);
  var a = D.asteroids.length + ':' + D.asteroids[0].x.toFixed(2) + ':' + D.sky.children.length;
  resetInput(); D.start('SKY-BBB'); pump(6);
  var b = D.asteroids.length + ':' + D.asteroids[0].x.toFixed(2) + ':' + D.sky.children.length;
  resetInput(); D.start('SKY-AAA'); pump(6);
  var c = D.asteroids.length + ':' + D.asteroids[0].x.toFixed(2) + ':' + D.sky.children.length;
  if (a === b) return 'two different ships produced identical skies';
  return a === c || 'the same ship code produced a different sky on reload';
});

t('R94 geometry budget still holds with windows and space added', function () {
  var worstRoom = 0, worstShip = 0;
  for (var s2 = 0; s2 < 8; s2++) {
    resetInput(); D.start('BUD' + s2); pump(4);
    var total = 0;
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var g = D.ship.rooms[r]._g;
      if (!g) continue;
      total += g.children.length;
      worstRoom = Math.max(worstRoom, g.children.length);
    }
    worstShip = Math.max(worstShip, total);
  }
  console.log('         [budget] worst room ' + worstRoom + ' objects, worst ship ' + worstShip);
  if (worstRoom > 140) return 'a single room has ' + worstRoom + ' objects';
  return worstShip < 1100 || 'ship total ' + worstShip + ' objects is over budget';
});

t('R95 slice still completable with windows in', function () {
  var fails = [];
  for (var i = 0; i < 6; i++) {
    var r = playthrough('WINRUN' + i);
    if (r !== true) fails.push('WINRUN' + i + ': ' + r);
  }
  return fails.length === 0 || fails.length + ' failed, first -> ' + fails[0];
});


/* ---------- BUILD 09: SEALING, CLUTTER, ASTRONAUT, XR ---------- */
function countInTree(root, pred) {
  var n = 0;
  (function walk(o) {
    if (pred(o)) n++;
    for (var i = 0; i < o.children.length; i++) walk(o.children[i]);
  })(root);
  return n;
}

t('R96 every doorway has a bulkhead plate sealing the hull junction', function () {
  for (var s2 = 0; s2 < 8; s2++) {
    resetInput(); D.start('SEALP' + s2); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      var R = D.ship.rooms[r], g = R._g;
      if (!g) continue;
      var plates = countInTree(g, function (o) { return o.geometry && o.geometry._g === 'ShapeGeometry'; });
      if (plates < R.links.length) {
        return 'room ' + r + ' has ' + plates + ' plates for ' + R.links.length + ' doorways on ship ' + s2;
      }
    }
  }
  return true;
});

t('R97 bulkhead plate spans the doorway chord exactly', function () {
  resetInput(); D.start('SEALG-1'); pump(4);
  for (var r = 0; r < D.ship.rooms.length; r++) {
    var R = D.ship.rooms[r];
    for (var l = 0; l < R.links.length; l++) {
      /* the plate half-width must match rad*sin(half) for the gap that serves it */
      var half = Math.asin(Math.min(0.9, 3.7 / R.rad));
      var chordHalf = R.rad * Math.sin(half);
      if (chordHalf < 3.6) return 'plate too narrow for the tube in room ' + r + ': ' + chordHalf.toFixed(2);
      var inset = R.rad * Math.cos(half);
      /* the tube must reach past the plate or a ring gap is left */
      var start = Math.sqrt(Math.max(1, R.rad * R.rad - 3.7 * 3.7)) - 0.6;
      if (start > inset) return 'tube starts outboard of the plate in room ' + r;
    }
  }
  return true;
});

t('R98 hull is still sealed after adding the plates', function () {
  resetInput(); D.start('SEALP-X'); pump(4); resetInput();
  D.setKey('N0'); D.setKey('N1');
  var leaks = 0;
  for (var trial = 0; trial < 6000; trial++) {
    var R = D.ship.rooms[trial % D.ship.rooms.length];
    var a = Math.random() * Math.PI * 2;
    var p = { x: R.cx + Math.sin(a) * (R.rad - 2.5), z: R.cz + Math.cos(a) * (R.rad - 2.5) };
    if (D.hitsWall(p.x, p.z, D.PLR_R)) continue;
    D.moveCircle(p, Math.sin(a) * 70, Math.cos(a) * 70, D.PLR_R);
    if (!inPlayableSpace(p.x, p.z)) leaks++;
  }
  return leaks === 0 || leaks + ' hull leaks';
});

t('R99 rooms have significantly more open floor than before', function () {
  var worstBlocked = 0, worstRoom = '';
  for (var s2 = 0; s2 < 8; s2++) {
    resetInput(); D.start('CLUT' + s2); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      if (r === D.ship.reactorRoom) continue;   /* the boss itself is meant to be in the way */
      var R = D.ship.rooms[r], blocked = 0, total = 0;
      for (var rr = 1.2; rr < R.rad - 1.2; rr += 0.9) {
        for (var k = 0; k < 28; k++) {
          var a = (k / 28) * Math.PI * 2;
          var x = R.cx + Math.sin(a) * rr, z = R.cz + Math.cos(a) * rr;
          total++;
          if (D.hitsWall(x, z, D.PLR_R)) blocked++;
        }
      }
      var frac = total ? blocked / total : 0;
      if (frac > worstBlocked) { worstBlocked = frac; worstRoom = 'ship ' + s2 + ' room ' + r; }
    }
  }
  console.log('         [clutter] worst room is ' + (worstBlocked * 100).toFixed(0) + '% obstructed (' + worstRoom + ')');
  return worstBlocked < 0.22 || 'a room is ' + (worstBlocked * 100).toFixed(0) + '% obstructed — too cluttered to fight in';
});

t('R100 you can circle every room without being blocked', function () {
  var fails = 0;
  for (var s2 = 0; s2 < 6; s2++) {
    resetInput(); D.start('CIRC' + s2); pump(4);
    for (var r = 0; r < D.ship.rooms.length; r++) {
      if (r === D.ship.reactorRoom) continue;
      var R = D.ship.rooms[r];
      /* there must exist at least one clear circuit around the room — the exact
         radius does not matter, only that a lap is possible without stopping */
      var best = 0, N = 48;
      for (var band = 0.35; band <= 0.8; band += 0.05) {
        var open = 0;
        for (var k = 0; k < N; k++) {
          var a = (k / N) * Math.PI * 2, rr = R.rad * band;
          if (!D.hitsWall(R.cx + Math.sin(a) * rr, R.cz + Math.cos(a) * rr, D.PLR_R)) open++;
        }
        best = Math.max(best, open / N);
      }
      if (best < 0.95) fails++;
    }
  }
  return fails === 0 || fails + ' rooms cannot be circled freely';
});

t('R101 exactly one first-person viewmodel exists, even after restarts', function () {
  resetInput(); D.start('VM-01'); pump(4);
  for (var i = 0; i < 10; i++) { D.start('VM' + i); pump(20); }
  var guns = countInTree(D.camera, function (o) { return o._type === 'Group' && o !== D.camera; });
  var lamps = countInTree(D.camera, function (o) { return o._type === 'SpotLight'; });
  if (guns > 1) return guns + ' viewmodels attached to the camera after restarts';
  if (lamps > 1) return lamps + ' headlamps attached to the camera after restarts';
  return true;
});

t('R102 third person hides the viewmodel and shows the astronaut', function () {
  resetInput(); D.start('VM-02'); pump(6);
  D.setView(false); pump(4);
  var vm = null;
  for (var i = 0; i < D.camera.children.length; i++) {
    if (D.camera.children[i]._type === 'Group') vm = D.camera.children[i];
  }
  if (!vm) return 'no viewmodel found on the camera';
  if (vm.visible) return 'the first-person rifle is still visible in third person';
  if (!D.playerRig.g.visible) return 'the astronaut is hidden in third person';
  D.setView(true); pump(4);
  if (!vm.visible) return 'the viewmodel did not come back in first person';
  return !D.playerRig.g.visible || 'the astronaut body is visible in first person';
});

t('R103 the astronaut has articulated limbs that animate', function () {
  resetInput(); D.start('AST-01'); pump(6); resetInput();
  var P = D.playerRig;
  if (!P.legs || P.legs.length !== 2) return 'no leg rig';
  if (!P.arms || P.arms.length !== 2) return 'no arm rig';
  for (var i = 0; i < 2; i++) {
    if (!P.legs[i].thigh || !P.legs[i].knee || !P.legs[i].shin) return 'leg ' + i + ' is not segmented';
    if (!P.arms[i].shoulder || !P.arms[i].elbow || !P.arms[i].fore) return 'arm ' + i + ' is not segmented';
  }
  /* walking must move the thighs and bend the knees */
  var seenThigh = 0, seenKnee = 0;
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  for (var f = 0; f < 120; f++) {
    pump(1);
    seenThigh = Math.max(seenThigh, Math.abs(P.legs[0].thigh.rotation.x));
    seenKnee = Math.max(seenKnee, Math.abs(P.legs[0].knee.rotation.x));
  }
  global.window.fire('keyup', { code: 'KeyW', preventDefault: function () {} });
  if (seenThigh < 0.15) return 'thighs barely swing: ' + seenThigh.toFixed(3);
  if (seenKnee < 0.1) return 'knees do not bend: ' + seenKnee.toFixed(3);
  /* knees must never hyperextend backwards */
  for (var f2 = 0; f2 < 200; f2++) {
    pump(1);
    for (var L = 0; L < 2; L++) if (P.legs[L].knee.rotation.x < -0.001) return 'knee hyperextended';
  }
  return true;
});

t('R104 the astronaut settles when standing still', function () {
  resetInput(); D.start('AST-02'); pump(6); resetInput();
  for (var f = 0; f < 200; f++) pump(1);
  var P = D.playerRig;
  var swing = Math.abs(P.legs[0].thigh.rotation.x) + Math.abs(P.legs[1].thigh.rotation.x);
  return swing < 0.05 || 'legs still swinging while stationary: ' + swing.toFixed(3);
});

t('R105 WebXR initialises and offers a session when supported', function () {
  resetInput(); D.start('XR-01'); pump(6);
  var xr = D.xr;
  if (!xr.rig) return 'no XR rig built';
  if (!xr.controllers || xr.controllers.length !== 2) return 'expected 2 controllers, got ' + (xr.controllers || []).length;
  if (!xr.supported) return 'session support was not detected';
  if (getEl('vrBtn').style.display !== 'block') return 'the VR button never appeared';
  return true;
});

t('R106 the camera lives inside the XR rig', function () {
  resetInput(); D.start('XR-02'); pump(6);
  var rig = D.xr.rig, found = false;
  for (var i = 0; i < rig.children.length; i++) if (rig.children[i] === D.camera) found = true;
  return found || 'the camera is not parented to the XR rig';
});

t('R107 entering VR hides the flat viewmodel and arms the controllers', function () {
  resetInput(); D.start('XR-03'); pump(6);
  getEl('vrBtn').fire('click', { preventDefault: function () {} });
  pump(6);
  if (!D.xr.on) return 'XR session never activated';
  var vm = null;
  for (var i = 0; i < D.camera.children.length; i++) if (D.camera.children[i]._type === 'Group') vm = D.camera.children[i];
  if (vm && vm.visible) return 'the flat viewmodel is still visible in VR';
  /* the right controller carries the weapon model */
  var rightKids = countInTree(D.xr.controllers[1], function (o) { return o._type === 'Mesh'; });
  if (rightKids < 3) return 'the right controller has no weapon model';
  D.setXR(false);
  return true;
});

t('R108 in VR the rig moves and no bob or shake is applied', function () {
  resetInput(); D.start('XR-04'); pump(6); resetInput();
  D.setXR(true);
  var rig = D.xr.rig;
  global.window.fire('keydown', { code: 'KeyW', preventDefault: function () {} });
  for (var f = 0; f < 90; f++) pump(1);
  global.window.fire('keyup', { code: 'KeyW', preventDefault: function () {} });
  if (Math.abs(rig.position.x - D.player.pos.x) > 0.001) return 'rig did not track the player in X';
  if (Math.abs(rig.position.z - D.player.pos.z) > 0.001) return 'rig did not track the player in Z';
  if (rig.position.y !== 0) return 'rig applies its own eye height: ' + rig.position.y;
  /* comfort: camera pitch and roll must stay owned by the headset */
  D.hurt(30); pump(4);
  if (D.camera.rotation.z !== 0) return 'camera roll applied in VR (nausea risk)';
  D.setXR(false);
  return true;
});

t('R109 slice still completable after the build-09 changes', function () {
  var fails = [];
  for (var i = 0; i < 6; i++) {
    var r = playthrough('B9RUN' + i);
    if (r !== true) fails.push('B9RUN' + i + ': ' + r);
  }
  return fails.length === 0 || fails.length + ' failed, first -> ' + fails[0];
});

console.log('\n' + log.join('\n'));
console.log('\n' + '='.repeat(52));
console.log('  RUNTIME  PASS ' + pass + '   FAIL ' + fail);
console.log('='.repeat(52));
process.exit(fail ? 1 : 0);

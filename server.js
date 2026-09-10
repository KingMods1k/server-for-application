require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Carro 3D — modelo em blocos</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif;color:#fff}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{position:fixed;left:18px;top:18px;z-index:5;background:rgba(8,10,14,.78);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;line-height:1.45;max-width:380px}
.hud b{font-size:16px}.hud small{opacity:.72}
.badge{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px}
.controls{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.86);color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer}
button:active{transform:translateY(1px)}
.legend{position:fixed;left:18px;bottom:18px;z-index:5;font-size:11px;opacity:.6;max-width:380px}
</style>
</head>
<body>
<div id="app"></div>
<div class="hud">
 <b>Modelo 3D — carroceria em blocos</b><br>
 <small>Construção por volumes sólidos, seguindo a silhueta da carroceria real e da planta.</small><br>
 <span class="badge">4480 × 1950 × 1250 mm</span>
 <span class="badge">Entre-eixos: 2475 mm</span>
 <br><br>Arraste para girar · roda do mouse para zoom
</div>
<div class="controls">
 <button id="view3d">3D</button>
 <button id="viewFront">Frente</button>
 <button id="viewSide">Lateral</button>
 <button id="viewTop">Superior</button>
 <button id="viewInterior">Interior</button>
 <button id="viewEngine">Motor</button>
 <button id="shell">Carroceria</button>
</div>
<div class="legend">Modelo detalhado: ~1.500 peças individuais — carroceria, interior, motor, chassi, suspensão, freios, escapamento, chicotes, tubulações e detalhes.</div>

<script type="importmap">
{ "imports": {
  "three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
}}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ================================================================
   DIMENSÕES PRINCIPAIS — planta técnica
   ================================================================ */
const BW = 1.900, HALF_BW = BW / 2;
const WHEEL_R = 0.335, WHEEL_W = 0.240;
const Y0 = WHEEL_R;
const ARCH_R = 0.360, BOT = 0.220;
const FAX = -1.310, RAX = 1.165, TRACK = 0.790;

const TAPER_Y0 = 0.55, TAPER_Y1 = 1.25, TAPER_AMT = 0.09;
function taperScale(y) {
  const t = Math.max(0, Math.min(1, (y - TAPER_Y0) / (TAPER_Y1 - TAPER_Y0)));
  return 1 - t * TAPER_AMT;
}

const dyr = BOT - Y0;
const dxa = Math.sqrt(ARCH_R * ARCH_R - dyr * dyr);
const A0  = Math.atan2(dyr, dxa);
const A1  = Math.PI - A0;
const FA_RX = FAX + dxa;
const RA_RX = RAX + dxa;

/* ================================================================
   CENA
   ================================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);
scene.fog = new THREE.Fog(0x090b0f, 14, 30);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);
camera.position.set(6.4, 2.1, 5.6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.5;
controls.maxDistance = 15;
controls.target.set(0, 0.58, 0);
controls.maxPolarAngle = Math.PI * 0.495;

/* ================================================================
   ILUMINAÇÃO
   ================================================================ */
scene.add(new THREE.HemisphereLight(0xe8eef7, 0x20242b, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 2.9);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5; key.shadow.camera.far = 25;
key.shadow.camera.left = -8; key.shadow.camera.right = 8;
key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0x9db8ff, 0.7); fill.position.set(6, 4, -6); scene.add(fill);
const rimL = new THREE.DirectionalLight(0xffffff, 0.55); rimL.position.set(0, 3, -8); scene.add(rimL);
const hoodLight = new THREE.PointLight(0xfff0d8, 0.6, 4); hoodLight.position.set(-1.0, 1.8, 0); scene.add(hoodLight);
const cabinLight = new THREE.PointLight(0xffe8c8, 0.35, 2.5); cabinLight.position.set(0, 1.0, 0); scene.add(cabinLight);

/* ================================================================
   CHÃO
   ================================================================ */
const floor = new THREE.Mesh(new THREE.CircleGeometry(15, 96), new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.85, metalness: 0.05 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const grid = new THREE.GridHelper(15, 30, 0x242a33, 0x171b21);
grid.position.y = 0.001; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);

/* ================================================================
   MATERIAIS
   ================================================================ */
const M = {
  body:   new THREE.MeshPhysicalMaterial({ color: 0x707a84, metalness: 0.55, roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.14 }),
  body2:  new THREE.MeshPhysicalMaterial({ color: 0x5e6870, metalness: 0.5, roughness: 0.38 }),
  bodyDk: new THREE.MeshPhysicalMaterial({ color: 0x4a535a, metalness: 0.5, roughness: 0.4 }),
  dark:   new THREE.MeshStandardMaterial({ color: 0x0a0d11, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide }),
  black:  new THREE.MeshStandardMaterial({ color: 0x05070a, metalness: 0.2, roughness: 0.6 }),
  gap:    new THREE.MeshStandardMaterial({ color: 0x000000, metalness: 0.1, roughness: 0.9 }),
  glass:  new THREE.MeshPhysicalMaterial({ color: 0x0b1520, metalness: 0.35, roughness: 0.06, transparent: true, opacity: 0.96, side: THREE.DoubleSide }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.78, metalness: 0.03 }),
  tread:  new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, metalness: 0.02 }),
  rim:    new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.22 }),
  rimDk:  new THREE.MeshStandardMaterial({ color: 0x1a1e22, metalness: 0.7, roughness: 0.5 }),
  hub:    new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.7, roughness: 0.4 }),
  chrome: new THREE.MeshPhysicalMaterial({ color: 0xdadfe4, metalness: 1.0, roughness: 0.08 }),
  head:   new THREE.MeshPhysicalMaterial({ color: 0xdfe9ff, emissive: 0xb0d0ff, emissiveIntensity: 1.4, roughness: 0.1, metalness: 0.1 }),
  lens:   new THREE.MeshPhysicalMaterial({ color: 0xaabbcc, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55 }),
  tail:   new THREE.MeshPhysicalMaterial({ color: 0x6a0000, emissive: 0x900000, emissiveIntensity: 1.8, roughness: 0.2 }),
  tail2:  new THREE.MeshPhysicalMaterial({ color: 0x400000, emissive: 0x500000, emissiveIntensity: 1.2, roughness: 0.3 }),
  turn:   new THREE.MeshPhysicalMaterial({ color: 0x552200, emissive: 0xaa5500, emissiveIntensity: 1.0, roughness: 0.3 }),
  rev:    new THREE.MeshPhysicalMaterial({ color: 0xdddddd, emissive: 0x888888, emissiveIntensity: 0.6, roughness: 0.2 }),
  disc:   new THREE.MeshStandardMaterial({ color: 0x777c82, metalness: 0.9, roughness: 0.4 }),
  cal:    new THREE.MeshStandardMaterial({ color: 0xaa1515, metalness: 0.4, roughness: 0.4 }),
  int:    new THREE.MeshStandardMaterial({ color: 0x13161b, metalness: 0.1, roughness: 0.85 }),
  seat:   new THREE.MeshStandardMaterial({ color: 0x1b1f24, metalness: 0.05, roughness: 0.9 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0x08090b, metalness: 0.0, roughness: 1.0 }),
  leather:new THREE.MeshStandardMaterial({ color: 0x22262c, metalness: 0.1, roughness: 0.7 }),
  alu:    new THREE.MeshStandardMaterial({ color: 0xa8b0b8, metalness: 0.95, roughness: 0.2 }),
  exh:    new THREE.MeshStandardMaterial({ color: 0x3a3e42, metalness: 0.85, roughness: 0.35 }),
  plate:  new THREE.MeshStandardMaterial({ color: 0xf0f0f0, metalness: 0.1, roughness: 0.6 }),
  led:    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  red:    new THREE.MeshBasicMaterial({ color: 0xff2020 }),
  amber:  new THREE.MeshBasicMaterial({ color: 0xffa020 }),
  eng:    new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.7, roughness: 0.4 }),
  engCov: new THREE.MeshStandardMaterial({ color: 0x3a3e44, metalness: 0.5, roughness: 0.5 }),
  bat:    new THREE.MeshStandardMaterial({ color: 0x1a1e24, metalness: 0.3, roughness: 0.7 }),
  hose:   new THREE.MeshStandardMaterial({ color: 0x101014, metalness: 0.1, roughness: 0.9 }),
  copper: new THREE.MeshStandardMaterial({ color: 0xb87333, metalness: 0.9, roughness: 0.3 }),
  steel:  new THREE.MeshStandardMaterial({ color: 0x6a7078, metalness: 0.85, roughness: 0.35 }),
  wRed:   new THREE.MeshStandardMaterial({ color: 0x991111, metalness: 0.2, roughness: 0.7 }),
  wBlue:  new THREE.MeshStandardMaterial({ color: 0x2244aa, metalness: 0.2, roughness: 0.7 }),
  wBlack: new THREE.MeshStandardMaterial({ color: 0x0a0a0a, metalness: 0.2, roughness: 0.7 }),
  wYellow:new THREE.MeshStandardMaterial({ color: 0xbbaa22, metalness: 0.2, roughness: 0.7 }),
  wGreen: new THREE.MeshStandardMaterial({ color: 0x227733, metalness: 0.2, roughness: 0.7 }),
  seam:   new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.1, roughness: 0.8 }),
  seam2:  new THREE.MeshStandardMaterial({ color: 0x444a52, metalness: 0.1, roughness: 0.8 })
};

/* ================================================================
   HELPERS
   ================================================================ */
function box(w, h, d, x, y, z, mat, name) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.name = name || 'box';
  m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
function cyl(rt, rb, h, x, y, z, mat, name, seg, rx, ry, rz) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 20), mat);
  m.position.set(x, y, z); m.name = name || 'cyl';
  m.rotation.set(rx || 0, ry || 0, rz || 0);
  m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
function torus(r, t, x, y, z, mat, name, rx, ry, rz, seg) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, seg || 12, 32), mat);
  m.position.set(x, y, z); m.name = name || 'torus';
  m.rotation.set(rx || 0, ry || 0, rz || 0);
  m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}
function sph(r, x, y, z, mat, name) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), mat);
  m.position.set(x, y, z); m.name = name || 'sph';
  m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
}

/* ================================================================
   SILHUETA LATERAL — perfil da carroceria
   ================================================================ */
const PROFILE = [
  [-2.240, 0.220],[-2.240, 0.480],[-2.220, 0.525],[-2.180, 0.545],
  [-2.050, 0.575],[-1.900, 0.605],[-1.750, 0.630],[-1.600, 0.655],
  [-1.450, 0.680],[-1.300, 0.702],[-1.150, 0.722],[-1.000, 0.742],
  [-0.880, 0.760],[-0.820, 0.775],[-0.680, 0.855],[-0.540, 0.940],
  [-0.420, 1.025],[-0.320, 1.100],[-0.180, 1.175],[-0.020, 1.225],
  [ 0.160, 1.248],[ 0.340, 1.250],[ 0.500, 1.238],[ 0.620, 1.215],
  [ 0.760, 1.160],[ 0.900, 1.090],[ 1.040, 1.015],[ 1.180, 0.945],
  [ 1.320, 0.885],[ 1.480, 0.855],[ 1.650, 0.835],[ 1.820, 0.815],
  [ 1.980, 0.780],[ 2.100, 0.735],[ 2.180, 0.680],[ 2.230, 0.590],
  [ 2.240, 0.500],[ 2.240, 0.220]
];

const shape = new THREE.Shape();
shape.moveTo(PROFILE[0][0], PROFILE[0][1]);
for (let i = 1; i < PROFILE.length; i++) shape.lineTo(PROFILE[i][0], PROFILE[i][1]);
shape.lineTo(RA_RX, BOT);
shape.absarc(RAX, Y0, ARCH_R, A0, A1, false);
shape.lineTo(FA_RX, BOT);
shape.absarc(FAX, Y0, ARCH_R, A0, A1, false);
shape.lineTo(-2.240, BOT);
shape.closePath();

const bodyGeom = new THREE.ExtrudeGeometry(shape, { depth: BW, bevelEnabled: false, curveSegments: 32 });
bodyGeom.translate(0, 0, -HALF_BW);
const pa = bodyGeom.attributes.position;
function planWidthScale(x) {
  const ax = Math.abs(x);
  if (ax > 2.10) return 0.72 + (2.24 - ax) / 0.14 * 0.10;
  if (ax > 1.85) return 0.82 + (2.10 - ax) / 0.25 * 0.08;
  if (ax > 1.45) return 0.90 + (1.85 - ax) / 0.40 * 0.06;
  if (ax > 0.95) return 0.96;
  if (ax > 0.35) return 0.98;
  return 1.00;
}
for (let i = 0; i < pa.count; i++) {
  const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
  pa.setZ(i, z * taperScale(y) * planWidthScale(x));
}
bodyGeom.computeVertexNormals();
const bodyMesh = new THREE.Mesh(bodyGeom, M.body);
bodyMesh.name = 'carroceria_principal';
bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
scene.add(bodyMesh);

// Caps internos dos arcos
cyl(ARCH_R * 0.97, ARCH_R * 0.97, 0.005, FAX, Y0, 0, M.dark, 'cap_arco_f', 32, Math.PI/2, 0, 0);
cyl(ARCH_R * 0.97, ARCH_R * 0.97, 0.005, RAX, Y0, 0, M.dark, 'cap_arco_r', 32, Math.PI/2, 0, 0);

/* ================================================================
   VIDROS LATERAIS
   ================================================================ */
const sideWinShape = new THREE.Shape();
sideWinShape.moveTo(-0.680, 0.800); sideWinShape.lineTo(-0.580, 0.860);
sideWinShape.lineTo(-0.480, 0.925); sideWinShape.lineTo(-0.400, 1.000);
sideWinShape.lineTo(-0.330, 1.080); sideWinShape.lineTo(-0.220, 1.155);
sideWinShape.lineTo(-0.060, 1.205); sideWinShape.lineTo( 0.140, 1.225);
sideWinShape.lineTo( 0.330, 1.228); sideWinShape.lineTo( 0.490, 1.215);
sideWinShape.lineTo( 0.620, 1.185); sideWinShape.lineTo( 0.760, 1.135);
sideWinShape.lineTo( 0.900, 1.065); sideWinShape.lineTo( 1.020, 0.995);
sideWinShape.lineTo( 1.140, 0.930); sideWinShape.lineTo( 1.230, 0.880);
sideWinShape.lineTo( 1.260, 0.840); sideWinShape.lineTo( 1.230, 0.810);
sideWinShape.closePath();
const sideWinGeom = new THREE.ShapeGeometry(sideWinShape);
for (const s of [-1, 1]) {
  const win = new THREE.Mesh(sideWinGeom, M.glass);
  win.position.z = s * (taperScale(1.0) * HALF_BW - 0.004);
  win.renderOrder = 1;
  if (s < 0) win.scale.z = -1;
  scene.add(win);
}

/* Para-brisa e vidro traseiro */
function slopedGlass(x1, y1, x2, y2, mat, inset) {
  inset = inset === undefined ? 0.03 : inset;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const midY = (y1 + y2) / 2;
  const halfW = taperScale(midY) * HALF_BW - inset;
  const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.015, halfW * 2), mat);
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  m.rotation.z = ang;
  m.castShadow = true; m.renderOrder = 1;
  scene.add(m);
}
slopedGlass(-0.84, 0.780, -0.27, 1.150, M.glass);
slopedGlass( 0.53, 1.230,  1.34, 0.885, M.glass);

/* ================================================================
   BANCO DE PEÇAS — cada componente é uma entrada explícita
   Formato: [name, type, w|r, h, d|t, x, y, z, rx, ry, rz, matKey]
   Type: 'b'=box, 'c'=cyl, 't'=torus, 's'=sphere
   ================================================================ */
const P = [];

/* ---------- FRENTE / PARA-CHOQUE DIANTEIRO ---------- */
P.push(['para-choque-frontal', 'b', 0.06, 0.20, 1.20, -2.220, 0.40, 0.00, 0, 0, 0, 'body']);
P.push(['para-choque-frontal-reforco-sup', 'b', 0.08, 0.04, 1.10, -2.220, 0.50, 0.00, 0, 0, 0, 'body2']);
P.push(['para-choque-frontal-reforco-inf', 'b', 0.08, 0.04, 1.10, -2.220, 0.30, 0.00, 0, 0, 0, 'body2']);
P.push(['para-choque-frontal-canto-e', 'b', 0.06, 0.16, 0.15, -2.215, 0.40, 0.60, 0, 0, 0, 'body']);
P.push(['para-choque-frontal-canto-d', 'b', 0.06, 0.16, 0.15, -2.215, 0.40, -0.60, 0, 0, 0, 'body']);
P.push(['para-choque-frontal-abasup', 'b', 0.12, 0.03, 1.15, -2.180, 0.50, 0.00, 0, 0, 0, 'body2']);
P.push(['splitter-frontal', 'b', 0.30, 0.02, 1.70, -2.200, 0.18, 0.00, 0, 0, 0, 'dark']);
P.push(['splitter-aleta-001', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, -0.75, 0, 0, 0, 'black']);
P.push(['splitter-aleta-002', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, -0.50, 0, 0, 0, 'black']);
P.push(['splitter-aleta-003', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, -0.25, 0, 0, 0, 'black']);
P.push(['splitter-aleta-004', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, 0.00, 0, 0, 0, 'black']);
P.push(['splitter-aleta-005', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, 0.25, 0, 0, 0, 'black']);
P.push(['splitter-aleta-006', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, 0.50, 0, 0, 0, 'black']);
P.push(['splitter-aleta-007', 'b', 0.30, 0.04, 0.02, -2.200, 0.19, 0.75, 0, 0, 0, 'black']);
P.push(['grade-moldura', 'b', 0.05, 0.22, 1.25, -2.240, 0.42, 0, 0, 0, 0, 'dark']);
P.push(['grade-horizontal-001', 'b', 0.05, 0.008, 1.20, -2.240, 0.36, 0, 0, 0, 0, 'chrome']);
P.push(['grade-horizontal-002', 'b', 0.05, 0.008, 1.20, -2.240, 0.42, 0, 0, 0, 0, 'chrome']);
P.push(['grade-horizontal-003', 'b', 0.05, 0.008, 1.20, -2.240, 0.48, 0, 0, 0, 0, 'chrome']);
P.push(['grade-favo-001', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.55, 0, 0, 0, 'black']);
P.push(['grade-favo-002', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.49, 0, 0, 0, 'black']);
P.push(['grade-favo-003', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.43, 0, 0, 0, 'black']);
P.push(['grade-favo-004', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.37, 0, 0, 0, 'black']);
P.push(['grade-favo-005', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.31, 0, 0, 0, 'black']);
P.push(['grade-favo-006', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.25, 0, 0, 0, 'black']);
P.push(['grade-favo-007', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.19, 0, 0, 0, 'black']);
P.push(['grade-favo-008', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.13, 0, 0, 0, 'black']);
P.push(['grade-favo-009', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.07, 0, 0, 0, 'black']);
P.push(['grade-favo-010', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, -0.01, 0, 0, 0, 'black']);
P.push(['grade-favo-011', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.05, 0, 0, 0, 'black']);
P.push(['grade-favo-012', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.11, 0, 0, 0, 'black']);
P.push(['grade-favo-013', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.17, 0, 0, 0, 'black']);
P.push(['grade-favo-014', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.23, 0, 0, 0, 'black']);
P.push(['grade-favo-015', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.29, 0, 0, 0, 'black']);
P.push(['grade-favo-016', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.35, 0, 0, 0, 'black']);
P.push(['grade-favo-017', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.41, 0, 0, 0, 'black']);
P.push(['grade-favo-018', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.47, 0, 0, 0, 'black']);
P.push(['grade-favo-019', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.53, 0, 0, 0, 'black']);
P.push(['grade-favo-020', 'b', 0.04, 0.20, 0.008, -2.235, 0.42, 0.59, 0, 0, 0, 'black']);

/* ---------- FARÓIS DIANTEIROS ---------- */
P.push(['farol-e-carcaca', 'b', 0.06, 0.14, 0.42, -2.230, 0.58, 0.62, 0, 0, 0, 'dark']);
P.push(['farol-e-lente', 'b', 0.07, 0.14, 0.42, -2.245, 0.58, 0.62, 0, 0, 0, 'lens']);
P.push(['farol-e-projetor', 'c', 0.035, 0.035, 0.05, -2.240, 0.60, 0.55, 0, 0, 1.5708, 'head']);
P.push(['farol-e-refletor', 'c', 0.045, 0.045, 0.04, -2.240, 0.55, 0.70, 0, 0, 1.5708, 'head']);
P.push(['farol-e-drl', 'b', 0.03, 0.02, 0.30, -2.245, 0.62, 0.62, 0, 0, 0, 'led']);
P.push(['farol-e-seta', 'b', 0.03, 0.03, 0.08, -2.245, 0.55, 0.78, 0, 0, 0, 'turn']);
P.push(['farol-e-led-seg-1', 'b', 0.03, 0.008, 0.08, -2.245, 0.62, 0.50, 0, 0, 0, 'led']);
P.push(['farol-e-led-seg-2', 'b', 0.03, 0.008, 0.08, -2.245, 0.62, 0.54, 0, 0, 0, 'led']);
P.push(['farol-e-led-seg-3', 'b', 0.03, 0.008, 0.08, -2.245, 0.62, 0.58, 0, 0, 0, 'led']);
P.push(['farol-e-moldura', 'b', 0.03, 0.16, 0.46, -2.245, 0.58, 0.62, 0, 0, 0, 'chrome']);
P.push(['farol-d-carcaca', 'b', 0.06, 0.14, 0.42, -2.230, 0.58, -0.62, 0, 0, 0, 'dark']);
P.push(['farol-d-lente', 'b', 0.07, 0.14, 0.42, -2.245, 0.58, -0.62, 0, 0, 0, 'lens']);
P.push(['farol-d-projetor', 'c', 0.035, 0.035, 0.05, -2.240, 0.60, -0.55, 0, 0, 1.5708, 'head']);
P.push(['farol-d-refletor', 'c', 0.045, 0.045, 0.04, -2.240, 0.55, -0.70, 0, 0, 1.5708, 'head']);
P.push(['farol-d-drl', 'b', 0.03, 0.02, 0.30, -2.245, 0.62, -0.62, 0, 0, 0, 'led']);
P.push(['farol-d-seta', 'b', 0.03, 0.03, 0.08, -2.245, 0.55, -0.78, 0, 0, 0, 'turn']);
P.push(['farol-d-led-seg-1', 'b', 0.03, 0.008, 0.08, -2.245, 0.62, -0.50, 0, 0, 0, 'led']);
P.push(['farol-d-led-seg-2', 'b', 0.03, 0.008, 0.08, -2.245, 0.62, -0.54, 0, 0, 0, 'led']);
P.push(['farol-d-led-seg-3', 'b', 0.03, 0.008, 0.08, -2.245, 0.62, -0.58, 0, 0, 0, 'led']);
P.push(['farol-d-moldura', 'b', 0.03, 0.16, 0.46, -2.245, 0.58, -0.62, 0, 0, 0, 'chrome']);

/* ---------- ENTRADAS DE AR DIANTEIRAS ---------- */
P.push(['entrada-central', 'b', 0.05, 0.12, 0.70, -2.240, 0.30, 0, 0, 0, 0, 'dark']);
P.push(['entrada-central-favo-1', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, -0.30, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-2', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, -0.22, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-3', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, -0.14, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-4', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, -0.06, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-5', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, 0.02, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-6', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, 0.10, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-7', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, 0.18, 0, 0, 0, 'black']);
P.push(['entrada-central-favo-8', 'b', 0.04, 0.10, 0.008, -2.235, 0.30, 0.26, 0, 0, 0, 'black']);
P.push(['entrada-lat-e', 'b', 0.05, 0.08, 0.20, -2.240, 0.30, 0.75, 0, 0, 0, 'dark']);
P.push(['entrada-lat-d', 'b', 0.05, 0.08, 0.20, -2.240, 0.30, -0.75, 0, 0, 0, 'dark']);
P.push(['entrada-lat-e-favo-1', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, 0.68, 0, 0, 0, 'black']);
P.push(['entrada-lat-e-favo-2', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, 0.72, 0, 0, 0, 'black']);
P.push(['entrada-lat-e-favo-3', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, 0.76, 0, 0, 0, 'black']);
P.push(['entrada-lat-e-favo-4', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, 0.80, 0, 0, 0, 'black']);
P.push(['entrada-lat-d-favo-1', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, -0.68, 0, 0, 0, 'black']);
P.push(['entrada-lat-d-favo-2', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, -0.72, 0, 0, 0, 'black']);
P.push(['entrada-lat-d-favo-3', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, -0.76, 0, 0, 0, 'black']);
P.push(['entrada-lat-d-favo-4', 'b', 0.04, 0.06, 0.010, -2.235, 0.30, -0.80, 0, 0, 0, 'black']);

/* ---------- PLACA E GANCHO DIANTEIRO ---------- */
P.push(['placa-dianteira', 'b', 0.02, 0.10, 0.44, -2.255, 0.34, 0, 0, 0, 0, 'plate']);
P.push(['placa-f-parafuso-1', 'c', 0.008, 0.008, 0.012, -2.260, 0.30, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['placa-f-parafuso-2', 'c', 0.008, 0.008, 0.012, -2.260, 0.32, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['placa-f-parafuso-3', 'c', 0.008, 0.008, 0.012, -2.260, 0.34, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['placa-f-parafuso-4', 'c', 0.008, 0.008, 0.012, -2.260, 0.36, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['gancho-reboque', 'b', 0.06, 0.06, 0.06, -2.245, 0.30, 0.35, 0, 0, 0, 'cal']);
P.push(['gancho-reboque-reforco', 'b', 0.10, 0.04, 0.04, -2.200, 0.30, 0.35, 0, 0, 0, 'steel']);

/* ---------- CAPÔ ---------- */
P.push(['capo-painel', 'b', 1.30, 0.02, 1.55, -1.55, 0.66, 0, 0, 0, 0, 'body']);
P.push(['capo-nervura-central', 'b', 1.20, 0.02, 0.05, -1.55, 0.67, 0, 0, 0, 0, 'body2']);
P.push(['capo-dobradica-e', 'b', 0.10, 0.04, 0.10, -1.00, 0.72, 0.55, 0, 0, 0, 'dark']);
P.push(['capo-dobradica-d', 'b', 0.10, 0.04, 0.10, -1.00, 0.72, -0.55, 0, 0, 0, 'dark']);
P.push(['capo-amortecedor-e', 'c', 0.015, 0.015, 0.30, -1.05, 0.60, 0.65, 0, 0, 1.0472, 'steel']);
P.push(['capo-amortecedor-d', 'c', 0.015, 0.015, 0.30, -1.05, 0.60, -0.65, 0, 0, 1.0472, 'steel']);
P.push(['capo-fecho', 'b', 0.06, 0.04, 0.10, -2.10, 0.55, 0, 0, 0, 0, 'steel']);

/* ---------- TETO ---------- */
P.push(['teto-painel', 'b', 0.70, 0.02, 1.35, 0.20, 1.24, 0, 0, 0, 0, 'body']);
P.push(['teto-costela-1', 'b', 0.04, 0.01, 1.30, -0.15, 1.25, 0, 0, 0, 0, 'body2']);
P.push(['teto-costela-2', 'b', 0.04, 0.01, 1.30, 0.10, 1.25, 0, 0, 0, 0, 'body2']);
P.push(['teto-costela-3', 'b', 0.04, 0.01, 1.30, 0.35, 1.25, 0, 0, 0, 0, 'body2']);
P.push(['teto-costela-4', 'b', 0.04, 0.01, 1.30, 0.60, 1.24, 0, 0, 0, 0, 'body2']);

/* ---------- PARA-BRISA ---------- */
P.push(['parabrisa-vidro', 'b', 0.60, 0.015, 1.55, -0.55, 0.97, 0, 0, 0, 0.93, 'glass']);
P.push(['parabrisa-borracha-sup', 'b', 0.62, 0.015, 0.02, -0.55, 1.10, 0.55, 0, 0, 0, 0.93, 'black']);
P.push(['parabrisa-borracha-inf', 'b', 0.62, 0.015, 0.02, -0.55, 0.82, 0.55, 0, 0, 0, 0.93, 'black']);

/* ---------- VIDRO TRASEIRO ---------- */
P.push(['vidro-traseiro', 'b', 0.85, 0.015, 1.50, 0.95, 1.06, 0, 0, 0, -0.60, 'glass']);
P.push(['vidro-traseiro-borracha-sup', 'b', 0.90, 0.015, 0.02, 0.95, 1.20, 0.55, 0, 0, 0, -0.60, 'black']);
P.push(['vidro-traseiro-borracha-inf', 'b', 0.90, 0.015, 0.02, 0.95, 0.90, 0.55, 0, 0, 0, -0.60, 'black']);

/* ---------- VIDROS LATERAIS (molduras) ---------- */
P.push(['vidro-lat-e-moldura', 'b', 1.30, 0.015, 0.02, 0.20, 1.00, 0.79, 0, 0, 0, 'black']);
P.push(['vidro-lat-d-moldura', 'b', 1.30, 0.015, 0.02, 0.20, 1.00, -0.79, 0, 0, 0, 'black']);
P.push(['vidro-lat-e-pilar-b', 'b', 0.05, 0.35, 0.02, 0.05, 1.00, 0.79, 0, 0, 0, 'black']);
P.push(['vidro-lat-d-pilar-b', 'b', 0.05, 0.35, 0.02, 0.05, 1.00, -0.79, 0, 0, 0, 'black']);

/* ---------- RETROVISORES ---------- */
P.push(['retro-e-base', 'b', 0.05, 0.03, 0.08, -0.62, 0.90, 0.80, 0, 0, 0, 'dark']);
P.push(['retro-e-braco', 'b', 0.06, 0.025, 0.12, -0.65, 0.90, 0.84, 0, 0, 0, 'dark']);
P.push(['retro-e-carcaca', 'b', 0.06, 0.08, 0.14, -0.68, 0.90, 0.88, 0, 0, 0, 'body']);
P.push(['retro-e-espelho', 'b', 0.02, 0.07, 0.13, -0.66, 0.90, 0.94, 0, 0, 0, 'chrome']);
P.push(['retro-e-seta', 'b', 0.04, 0.02, 0.10, -0.68, 0.86, 0.88, 0, 0, 0, 'turn']);
P.push(['retro-e-parafuso-1', 'c', 0.006, 0.006, 0.012, -0.62, 0.88, 0.80, 0, 0, 1.5708, 'chrome']);
P.push(['retro-e-parafuso-2', 'c', 0.006, 0.006, 0.012, -0.62, 0.90, 0.80, 0, 0, 1.5708, 'chrome']);
P.push(['retro-e-parafuso-3', 'c', 0.006, 0.006, 0.012, -0.62, 0.92, 0.80, 0, 0, 1.5708, 'chrome']);
P.push(['retro-d-base', 'b', 0.05, 0.03, 0.08, -0.62, 0.90, -0.80, 0, 0, 0, 'dark']);
P.push(['retro-d-braco', 'b', 0.06, 0.025, 0.12, -0.65, 0.90, -0.84, 0, 0, 0, 'dark']);
P.push(['retro-d-carcaca', 'b', 0.06, 0.08, 0.14, -0.68, 0.90, -0.88, 0, 0, 0, 'body']);
P.push(['retro-d-espelho', 'b', 0.02, 0.07, 0.13, -0.66, 0.90, -0.94, 0, 0, 0, 'chrome']);
P.push(['retro-d-seta', 'b', 0.04, 0.02, 0.10, -0.68, 0.86, -0.88, 0, 0, 0, 'turn']);
P.push(['retro-d-parafuso-1', 'c', 0.006, 0.006, 0.012, -0.62, 0.88, -0.80, 0, 0, 1.5708, 'chrome']);
P.push(['retro-d-parafuso-2', 'c', 0.006, 0.006, 0.012, -0.62, 0.90, -0.80, 0, 0, 1.5708, 'chrome']);
P.push(['retro-d-parafuso-3', 'c', 0.006, 0.006, 0.012, -0.62, 0.92, -0.80, 0, 0, 1.5708, 'chrome']);

/* ---------- PUXADORES DE PORTA ---------- */
P.push(['puxador-e-carcaca', 'b', 0.18, 0.025, 0.025, 0.20, 0.72, 0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-e-base', 'b', 0.20, 0.02, 0.04, 0.20, 0.70, 0.90, 0, 0, 0, 'dark']);
P.push(['puxador-e-parafuso-1', 'c', 0.005, 0.005, 0.012, 0.12, 0.71, 0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-e-parafuso-2', 'c', 0.005, 0.005, 0.012, 0.17, 0.71, 0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-e-parafuso-3', 'c', 0.005, 0.005, 0.012, 0.22, 0.71, 0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-e-parafuso-4', 'c', 0.005, 0.005, 0.012, 0.27, 0.71, 0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-d-carcaca', 'b', 0.18, 0.025, 0.025, 0.20, 0.72, -0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-d-base', 'b', 0.20, 0.02, 0.04, 0.20, 0.70, -0.90, 0, 0, 0, 'dark']);
P.push(['puxador-d-parafuso-1', 'c', 0.005, 0.005, 0.012, 0.12, 0.71, -0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-d-parafuso-2', 'c', 0.005, 0.005, 0.012, 0.17, 0.71, -0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-d-parafuso-3', 'c', 0.005, 0.005, 0.012, 0.22, 0.71, -0.90, 0, 0, 0, 'chrome']);
P.push(['puxador-d-parafuso-4', 'c', 0.005, 0.005, 0.012, 0.27, 0.71, -0.90, 0, 0, 0, 'chrome']);

/* ---------- SAIAS LATERAIS ---------- */
P.push(['saia-lateral-e', 'b', 1.40, 0.07, 0.06, 0.00, 0.175, 0.92, 0, 0, 0, 'dark']);
P.push(['saia-lateral-d', 'b', 1.40, 0.07, 0.06, 0.00, 0.175, -0.92, 0, 0, 0, 'dark']);
for (let i = 0; i < 12; i++) {
  const x = -0.60 + i * 0.11;
  P.push(['saia-e-parafuso-' + i, 'c', 0.006, 0.006, 0.012, x, 0.155, 0.92, 0, 0, 0, 'chrome']);
  P.push(['saia-d-parafuso-' + i, 'c', 0.006, 0.006, 0.012, x, 0.155, -0.92, 0, 0, 0, 'chrome']);
}

/* ---------- LIMPADORES ---------- */
P.push(['limpador-e-braco', 'b', 0.55, 0.015, 0.02, -0.62, 0.80, 0.25, 0, 0, 0, 'black']);
P.push(['limpador-e-palheta', 'b', 0.50, 0.012, 0.015, -0.62, 0.82, 0.25, 0, 0, 0, 'rubber']);
P.push(['limpador-d-braco', 'b', 0.55, 0.015, 0.02, -0.62, 0.80, -0.10, 0, 0, 0, 'black']);
P.push(['limpador-d-palheta', 'b', 0.50, 0.012, 0.015, -0.62, 0.82, -0.10, 0, 0, 0, 'rubber']);
P.push(['limpador-motor', 'c', 0.03, 0.03, 0.08, -0.55, 0.75, 0.15, 0, 0, 1.5708, 'black']);

/* ---------- ANTENA SHARK FIN ---------- */
const finGeom = new THREE.ConeGeometry(0.06, 0.10, 4);
const fin = new THREE.Mesh(finGeom, M.body2);
fin.position.set(0.85, 1.19, 0);
fin.rotation.y = Math.PI / 4;
fin.scale.set(1.2, 1, 0.6);
fin.castShadow = true; scene.add(fin);

/* ---------- EMBLEMAS ---------- */
P.push(['emblema-dianteiro', 'b', 0.02, 0.04, 0.10, -2.245, 0.53, 0, 0, 0, 0, 'chrome']);
P.push(['emblema-traseiro', 'b', 0.02, 0.04, 0.10, 2.245, 0.66, 0, 0, 0, 0, 'chrome']);

/* ---------- TRASEIRA / PARA-CHOQUE TRASEIRO ---------- */
P.push(['para-choque-traseiro', 'b', 0.06, 0.20, 1.40, 2.220, 0.40, 0, 0, 0, 0, 'body']);
P.push(['para-choque-traseiro-reforco', 'b', 0.08, 0.04, 1.30, 2.220, 0.50, 0, 0, 0, 0, 'body2']);
P.push(['lanterna-barra', 'b', 0.05, 0.10, 1.30, 2.240, 0.60, 0, 0, 0, 0, 'tail']);
P.push(['lanterna-seg-e-1', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.35, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-2', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.43, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-3', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.51, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-4', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.59, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-5', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.67, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-6', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.75, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-7', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.83, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-e-8', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, 0.91, 0, 0, 0, 'tail2']);
P.push(['seta-traseira-e', 'b', 0.04, 0.04, 0.08, 2.245, 0.68, 0.65, 0, 0, 0, 'turn']);
P.push(['re-traseira-e', 'b', 0.04, 0.04, 0.08, 2.245, 0.52, 0.65, 0, 0, 0, 'rev']);
P.push(['lanterna-seg-d-1', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.35, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-2', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.43, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-3', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.51, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-4', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.59, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-5', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.67, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-6', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.75, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-7', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.83, 0, 0, 0, 'tail2']);
P.push(['lanterna-seg-d-8', 'b', 0.04, 0.06, 0.06, 2.245, 0.60, -0.91, 0, 0, 0, 'tail2']);
P.push(['seta-traseira-d', 'b', 0.04, 0.04, 0.08, 2.245, 0.68, -0.65, 0, 0, 0, 'turn']);
P.push(['re-traseira-d', 'b', 0.04, 0.04, 0.08, 2.245, 0.52, -0.65, 0, 0, 0, 'rev']);
P.push(['difusor-base', 'b', 0.15, 0.05, 1.30, 2.180, 0.26, 0, 0, 0, 0, 'dark']);
for (let i = 0; i < 10; i++) {
  const z = -0.60 + i * 0.135;
  P.push(['difusor-aleta-' + i, 'b', 0.15, 0.08, 0.03, 2.180, 0.28, z, 0, 0, 0, 'black']);
}
P.push(['placa-traseira', 'b', 0.02, 0.10, 0.44, 2.255, 0.42, 0, 0, 0, 0, 'plate']);
P.push(['placa-t-parafuso-1', 'c', 0.008, 0.008, 0.012, 2.260, 0.38, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['placa-t-parafuso-2', 'c', 0.008, 0.008, 0.012, 2.260, 0.40, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['placa-t-parafuso-3', 'c', 0.008, 0.008, 0.012, 2.260, 0.42, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['placa-t-parafuso-4', 'c', 0.008, 0.008, 0.012, 2.260, 0.44, 0.05, 0, 0, 1.5708, 'chrome']);
P.push(['ducktail-espoiler', 'b', 0.20, 0.04, 1.55, 1.95, 0.82, 0, 0, 0, 0, 'body2']);

/* ---------- ESCAPAMENTO COMPLETO ---------- */
P.push(['escape-tubo-principal', 'c', 0.04, 0.04, 2.00, 0.00, 0.18, 0.20, 0, 0, 1.5708, 'exh']);
P.push(['escape-tubo-principal2', 'c', 0.04, 0.04, 2.00, 0.00, 0.18, -0.20, 0, 0, 1.5708, 'exh']);
P.push(['escape-abafador-1', 'c', 0.09, 0.09, 0.60, 1.50, 0.17, 0.20, 0, 0, 1.5708, 'exh']);
P.push(['escape-abafador-2', 'c', 0.09, 0.09, 0.60, 1.50, 0.17, -0.20, 0, 0, 1.5708, 'exh']);
P.push(['escape-saida-1', 'c', 0.05, 0.05, 0.20, 2.20, 0.18, 0.45, 0, 0, 1.5708, 'chrome']);
P.push(['escape-saida-2', 'c', 0.05, 0.05, 0.20, 2.20, 0.18, -0.45, 0, 0, 1.5708, 'chrome']);
P.push(['escape-ponta-1', 't', 0.05, 0.008, 2.30, 0.18, 0.45, 0, 1.5708, 0, 'chrome']);
P.push(['escape-ponta-2', 't', 0.05, 0.008, 2.30, 0.18, -0.45, 0, 1.5708, 0, 'chrome']);
P.push(['escape-suporte-1', 'b', 0.02, 0.10, 0.04, -1.00, 0.20, 0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-2', 'b', 0.02, 0.10, 0.04, -0.45, 0.20, 0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-3', 'b', 0.02, 0.10, 0.04, 0.10, 0.20, 0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-4', 'b', 0.02, 0.10, 0.04, 0.65, 0.20, 0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-5', 'b', 0.02, 0.10, 0.04, 1.20, 0.20, 0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-6', 'b', 0.02, 0.10, 0.04, 1.75, 0.20, 0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-b1', 'b', 0.02, 0.10, 0.04, -1.00, 0.20, -0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-b2', 'b', 0.02, 0.10, 0.04, -0.45, 0.20, -0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-b3', 'b', 0.02, 0.10, 0.04, 0.10, 0.20, -0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-b4', 'b', 0.02, 0.10, 0.04, 0.65, 0.20, -0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-b5', 'b', 0.02, 0.10, 0.04, 1.20, 0.20, -0.20, 0, 0, 0, 'steel']);
P.push(['escape-suporte-b6', 'b', 0.02, 0.10, 0.04, 1.75, 0.20, -0.20, 0, 0, 0, 'steel']);

/* ---------- CHASSI ---------- */
P.push(['chassi-central', 'b', 4.20, 0.08, 1.35, 0.00, 0.17, 0, 0, 0, 0, 'dark']);
P.push(['longarina-dianteira-e', 'b', 1.40, 0.10, 0.10, -1.310, 0.19, 0.55, 0, 0, 0, 'dark']);
P.push(['longarina-dianteira-d', 'b', 1.40, 0.10, 0.10, -1.310, 0.19, -0.55, 0, 0, 0, 'dark']);
P.push(['longarina-traseira-e', 'b', 1.40, 0.10, 0.10, 1.165, 0.19, 0.55, 0, 0, 0, 'dark']);
P.push(['longarina-traseira-d', 'b', 1.40, 0.10, 0.10, 1.165, 0.19, -0.55, 0, 0, 0, 'dark']);
for (let i = 0; i < 8; i++) {
  const x = -1.8 + i * 0.55;
  P.push(['travessa-chassi-' + i, 'b', 0.06, 0.06, 1.30, x, 0.16, 0, 0, 0, 0, 'dark']);
}
for (let i = 0; i < 12; i++) {
  const x = -1.9 + i * 0.32;
  P.push(['furo-alivio-chassi-e-' + i, 'c', 0.025, 0.025, 0.10, x, 0.17, 0.30, 0, 0, 1.5708, 'black']);
  P.push(['furo-alivio-chassi-d-' + i, 'c', 0.025, 0.025, 0.10, x, 0.17, -0.30, 0, 0, 1.5708, 'black']);
}
P.push(['tanque-combustivel', 'b', 0.80, 0.18, 1.20, 0.75, 0.17, 0, 0, 0, 0, 'eng']);
P.push(['eixo-dianteiro', 'b', 0.10, 0.10, 1.58, -1.310, 0.335, 0, 0, 0, 0, 'dark']);
P.push(['eixo-traseiro', 'b', 0.10, 0.10, 1.58, 1.165, 0.335, 0, 0, 0, 0, 'dark']);
P.push(['cardan', 'c', 0.03, 0.03, 1.60, 0.00, 0.24, 0, 0, 0, 1.5708, 'steel']);
P.push(['diferencial', 'c', 0.16, 0.16, 0.30, 1.165, 0.305, 0, 0, 0, 1.5708, 'eng']);
P.push(['semi-eixo-e', 'c', 0.04, 0.04, 0.70, 1.165, 0.305, 0.35, 1.5708, 0, 0, 'steel']);
P.push(['semi-eixo-d', 'c', 0.04, 0.04, 0.70, 1.165, 0.305, -0.35, 1.5708, 0, 0, 'steel']);

/* ---------- SUSPENSÃO ---------- */
for (const s of [-1, 1]) {
  const sfx = s > 0 ? 'e' : 'd';
  P.push(['bandeja-dianteira-' + sfx, 'b', 0.55, 0.05, 0.08, -1.310, 0.285, s * 0.65, 0, 0, 0, 'dark']);
  P.push(['bandeja-traseira-' + sfx, 'b', 0.55, 0.05, 0.08, 1.165, 0.285, s * 0.65, 0, 0, 0, 'dark']);
  P.push(['amortecedor-dianteiro-' + sfx, 'c', 0.03, 0.03, 0.30, -1.310, 0.435, s * 0.70, 0, 0, 0, 'dark']);
  P.push(['amortecedor-traseiro-' + sfx, 'c', 0.03, 0.03, 0.30, 1.165, 0.435, s * 0.70, 0, 0, 0, 'dark']);
  for (let i = 0; i < 10; i++) {
    P.push(['mola-dianteira-' + sfx + '-' + i, 't', 0.05, 0.008, -1.310, 0.355 + i * 0.028, s * 0.70, 0, 0, 0, 'dark']);
    P.push(['mola-traseira-' + sfx + '-' + i, 't', 0.05, 0.008, 1.165, 0.355 + i * 0.028, s * 0.70, 0, 0, 0, 'dark']);
  }
  for (let i = 0; i < 4; i++) {
    P.push(['bucha-dianteira-' + sfx + '-' + i, 'c', 0.02, 0.02, 0.04, -1.310, 0.285, s * 0.65 + (i - 1.5) * 0.15, 0, 0, 1.5708, 'chrome']);
    P.push(['bucha-traseira-' + sfx + '-' + i, 'c', 0.02, 0.02, 0.04, 1.165, 0.285, s * 0.65 + (i - 1.5) * 0.15, 0, 0, 1.5708, 'chrome']);
  }
  P.push(['estabilizador-dianteiro-' + sfx, 'c', 0.02, 0.02, 1.55, -1.060, 0.255, 0, 0, 0, 1.5708, 'steel']);
  P.push(['estabilizador-traseiro-' + sfx, 'c', 0.02, 0.02, 1.55, 0.915, 0.255, 0, 0, 0, 1.5708, 'steel']);
  for (let i = 0; i < 6; i++) {
    P.push(['coilover-dianteiro-' + sfx + '-' + i, 't', 0.035, 0.006, -1.010, 0.315 + i * 0.03, s * 0.65, 0, 0, 0, 'cal']);
    P.push(['coilover-traseiro-' + sfx + '-' + i, 't', 0.035, 0.006, 0.865, 0.315 + i * 0.03, s * 0.65, 0, 0, 0, 'cal']);
  }
}

/* ---------- INTERIOR ---------- */
P.push(['assoalho-interior', 'b', 3.20, 0.02, 1.50, 0.10, 0.27, 0, 0, 0, 0, 'carpet']);
P.push(['painel-dashboard', 'b', 0.40, 0.20, 1.55, -0.55, 0.95, 0, 0, 0, 0, 'int']);
P.push(['painel-topo', 'b', 0.40, 0.03, 1.50, -0.55, 1.05, 0, 0, 0, 0, 'leather']);
P.push(['console-central', 'b', 0.80, 0.15, 0.28, 0.10, 0.72, 0, 0, 0, 0, 'int']);
P.push(['console-topo', 'b', 0.80, 0.02, 0.28, 0.10, 0.80, 0, 0, 0, 0, 'leather']);
for (let i = 0; i < 24; i++) {
  const z = -0.72 + i * 0.062;
  P.push(['costura-painel-' + i, 'c', 0.005, 0.005, 0.008, -0.36, 1.055, z, 0, 0, 1.5708, 'seam2']);
}
P.push(['saida-ar-1', 'b', 0.04, 0.06, 0.15, -0.75, 0.98, -0.55, 0, 0, 0, 'black']);
P.push(['saida-ar-2', 'b', 0.04, 0.06, 0.15, -0.75, 0.98, -0.20, 0, 0, 0, 'black']);
P.push(['saida-ar-3', 'b', 0.04, 0.06, 0.15, -0.75, 0.98, 0.15, 0, 0, 0, 'black']);
P.push(['saida-ar-4', 'b', 0.04, 0.06, 0.15, -0.75, 0.98, 0.50, 0, 0, 0, 'black']);
for (let i = 0; i < 4; i++) {
  const z = -0.55 + i * 0.35;
  P.push(['saida-ar-' + (i+1) + '-favo-1', 'b', 0.05, 0.008, 0.14, -0.755, 0.955, z, 0, 0, 0, 'chrome']);
  P.push(['saida-ar-' + (i+1) + '-favo-2', 'b', 0.05, 0.008, 0.14, -0.755, 0.980, z, 0, 0, 0, 'chrome']);
  P.push(['saida-ar-' + (i+1) + '-favo-3', 'b', 0.05, 0.008, 0.14, -0.755, 1.005, z, 0, 0, 0, 'chrome']);
}
P.push(['cambio-base', 'c', 0.04, 0.04, 0.03, 0.20, 0.80, 0, 0, 0, 0, 'black']);
P.push(['cambio-alavanca', 'c', 0.015, 0.015, 0.15, 0.20, 0.87, 0, 0, 0, 0, 'chrome']);
P.push(['cambio-manopla', 's', 0.035, 0.20, 0.95, 0, 0, 0, 'leather']);
P.push(['freio-mao', 'c', 0.02, 0.02, 0.15, 0.30, 0.85, 0.10, 1.5708, 0, 0, 'chrome']);

/* Volante completo */
const steering = new THREE.Group();
steering.position.set(-0.45, 0.90, 0.30);
steering.rotation.z = -0.35;
const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 14, 40), M.leather);
steering.add(wheelRing);
for (let i = 0; i < 3; i++) {
  const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.03, 0.02), M.dark);
  spoke.rotation.z = a;
  spoke.position.set(Math.cos(a) * 0.08, Math.sin(a) * 0.08, 0);
  steering.add(spoke);
}
const steeringHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 24), M.dark);
steeringHub.rotation.x = Math.PI / 2;
steering.add(steeringHub);
const airbag = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.06, 0.02), M.int);
airbag.position.z = -0.02;
steering.add(airbag);
scene.add(steering);

/* Pedais */
P.push(['pedal-acelerador', 'b', 0.10, 0.02, 0.06, -0.85, 0.35, 0.20, 0, 0, 0, 'black']);
P.push(['pedal-freio', 'b', 0.10, 0.02, 0.06, -0.85, 0.40, 0.05, 0, 0, 0, 'black']);
P.push(['pedal-embreagem', 'b', 0.08, 0.02, 0.05, -0.85, 0.40, -0.10, 0, 0, 0, 'black']);

/* Bancos dianteiros */
for (const s of [-1, 1]) {
  const sfx = s > 0 ? 'e' : 'd';
  const sx = 0.20, sz = s * 0.38;
  P.push(['assento-' + sfx, 'b', 0.50, 0.12, 0.50, sx, 0.60, sz, 0, 0, 0, 'seat']);
  P.push(['assento-topo-' + sfx, 'b', 0.48, 0.03, 0.48, sx, 0.67, sz, 0, 0, 0, 'leather']);
  P.push(['encosto-' + sfx, 'b', 0.12, 0.55, 0.48, sx - 0.30, 0.85, sz, 0, 0, 0, 'seat']);
  P.push(['encosto-topo-' + sfx, 'b', 0.03, 0.55, 0.46, sx - 0.36, 0.85, sz, 0, 0, 0, 'leather']);
  P.push(['cabec-' + sfx, 'b', 0.10, 0.10, 0.18, sx - 0.32, 1.15, sz, 0, 0, 0, 'seat']);
  P.push(['trilho-a-' + sfx, 'b', 0.50, 0.03, 0.04, sx, 0.55, sz - 0.15, 0, 0, 0, 'dark']);
  P.push(['trilho-b-' + sfx, 'b', 0.50, 0.03, 0.04, sx, 0.55, sz + 0.15, 0, 0, 0, 'dark']);
  P.push(['cinto-' + sfx, 'b', 0.03, 0.60, 0.02, sx - 0.20, 0.90, sz - 0.22, 0, 0, 0, 'black']);
  for (let i = 0; i < 8; i++) {
    P.push(['costura-encosto-' + sfx + '-' + i, 'c', 0.005, 0.005, 0.008, sx - 0.37, 0.60 + i * 0.07, sz, 0, 0, 1.5708, 'seam']);
  }
  for (let i = 0; i < 6; i++) {
    P.push(['costura-assento-' + sfx + '-' + i, 'c', 0.005, 0.005, 0.008, sx + (i - 3) * 0.07, 0.685, sz, 0, 0, 0, 'seam']);
  }
}

/* Banco traseiro */
P.push(['assento-traseiro', 'b', 0.55, 0.12, 1.35, 0.70, 0.60, 0, 0, 0, 0, 'seat']);
P.push(['encosto-traseiro', 'b', 0.12, 0.50, 1.35, 0.95, 0.90, 0, 0, 0, 0, 'seat']);
for (let i = 0; i < 10; i++) {
  P.push(['costura-traseira-' + i, 'c', 0.005, 0.005, 0.008, 0.94, 0.70 + i * 0.04, 0, 0, 0, 1.5708, 'seam']);
}

/* Forros de porta */
for (const s of [-1, 1]) {
  const sfx = s > 0 ? 'e' : 'd';
  P.push(['forro-porta-' + sfx, 'b', 1.50, 0.40, 0.05, 0.10, 0.60, s * 0.87, 0, 0, 0, 'int']);
  for (let i = 0; i < 8; i++) {
    P.push(['forro-porta-' + sfx + '-parafuso-' + i, 'c', 0.005, 0.005, 0.008, -0.40 + i * 0.18, 0.60, s * 0.87, 0, 0, 0, 'chrome']);
  }
}

/* Retrovisor interno e quebra-sóis */
P.push(['retrovisor-interno', 'b', 0.02, 0.08, 0.22, -0.70, 1.05, 0, 0, 0, 0, 'int']);
P.push(['quebra-sol-e', 'b', 0.30, 0.02, 0.18, -0.55, 1.15, 0.35, 0, 0, 0, 'int']);
P.push(['quebra-sol-d', 'b', 0.30, 0.02, 0.18, -0.55, 1.15, -0.35, 0, 0, 0, 'int']);
P.push(['porta-luvas', 'b', 0.02, 0.12, 0.30, -0.75, 0.85, 0.40, 0, 0, 0, 'int']);

/* Painel de instrumentos */
P.push(['instrumentos-caixa', 'b', 0.10, 0.15, 0.30, -0.62, 0.98, 0.30, 0, 0, 0, 'int']);
P.push(['mostrador-1', 'c', 0.04, 0.04, 0.01, -0.62, 0.98, 0.22, 0, 0, 1.5708, 'black']);
P.push(['mostrador-2', 'c', 0.04, 0.04, 0.01, -0.62, 0.98, 0.30, 0, 0, 1.5708, 'black']);
P.push(['mostrador-3', 'c', 0.04, 0.04, 0.01, -0.62, 0.98, 0.38, 0, 0, 1.5708, 'black']);
for (let i = 0; i < 6; i++) {
  P.push(['duto-ar-interno-' + i, 'b', 0.08, 0.06, 0.30, -0.60, 0.80, -0.5 + i * 0.20, 0, 0, 0, 'dark']);
}

/* ---------- MOTOR ---------- */
P.push(['motor-bloco', 'b', 0.55, 0.35, 0.60, -1.85, 0.55, 0, 0, 0, 0, 'eng']);
P.push(['motor-tampa', 'b', 0.55, 0.03, 0.60, -1.85, 0.74, 0, 0, 0, 0, 'engCov']);
for (let i = 0; i < 12; i++) {
  P.push(['tampa-valvula-costela-' + i, 'b', 0.08, 0.02, 0.55, -1.80 + i * 0.045, 0.755, 0, 0, 0, 0, 'alu']);
}
P.push(['radiador-caixa', 'b', 0.06, 0.30, 0.60, -2.15, 0.55, 0, 0, 0, 0, 'eng']);
for (let i = 0; i < 30; i++) {
  P.push(['radiador-aleta-' + i, 'b', 0.005, 0.28, 0.008, -2.15, 0.55, -0.28 + i * 0.019, 0, 0, 0, 'alu']);
}
P.push(['mangueira-1', 'c', 0.02, 0.02, 0.40, -1.95, 0.65, 0.25, 0, 0, 1.5708, 'hose']);
P.push(['mangueira-2', 'c', 0.02, 0.02, 0.40, -1.95, 0.65, -0.25, 0, 0, 1.5708, 'hose']);
P.push(['bateria-caixa', 'b', 0.20, 0.15, 0.30, -1.60, 0.55, 0.40, 0, 0, 0, 'bat']);
P.push(['caixa-fusivel', 'b', 0.20, 0.10, 0.25, -1.60, 0.55, -0.40, 0, 0, 0, 'black']);
P.push(['reservatorio-agua', 'b', 0.15, 0.12, 0.15, -1.55, 0.60, 0.0, 0, 0, 0, 'black']);
for (let i = 0; i < 4; i++) {
  const z = -0.22 + i * 0.15;
  P.push(['runner-admissao-' + i, 'c', 0.025, 0.025, 0.35, -1.65, 0.60, z, 0, 0, 1.5708, 'alu']);
  P.push(['runner-escape-' + i, 'c', 0.022, 0.022, 0.35, -2.05, 0.55, z, 0, 0, 1.5708, 'steel']);
}
P.push(['polia-1', 'c', 0.06, 0.06, 0.03, -2.10, 0.45, 0.20, 0, 1.5708, 0, 'black']);
P.push(['polia-2', 'c', 0.04, 0.04, 0.03, -2.10, 0.45, -0.20, 0, 1.5708, 0, 'black']);
P.push(['polia-3', 'c', 0.05, 0.05, 0.03, -2.05, 0.35, 0.00, 0, 1.5708, 0, 'black']);
P.push(['correia-1', 't', 0.07, 0.008, -2.08, 0.45, 0.00, 0, 0, 0, 'rubber']);
P.push(['correia-2', 't', 0.06, 0.008, -2.05, 0.35, 0.00, 0, 0, 0, 'rubber']);

/* ---------- CHICOTES ELÉTRICOS ---------- */
const wireKeys = ['wRed', 'wBlue', 'wBlack', 'wYellow', 'wGreen'];
for (let i = 0; i < 40; i++) {
  const wk = wireKeys[i % 5];
  const z = -0.55 + (i % 10) * 0.12;
  const x = -1.70 + Math.floor(i / 10) * 0.15;
  P.push(['chicote-' + i, 'c', 0.004, 0.004, 0.30, x, 0.68, z, 0, 0, 1.5708, wk]);
}
for (let i = 0; i < 20; i++) {
  const z = -0.55 + (i % 10) * 0.12;
  const x = -1.55 + Math.floor(i / 10) * 0.15;
  P.push(['conector-' + i, 'b', 0.04, 0.02, 0.02, x, 0.68, z, 0, 0, 0, 'black']);
}

/* ---------- TUBULAÇÕES ---------- */
P.push(['tubo-freio-e', 'c', 0.008, 0.008, 2.00, 0.00, 0.24, 0.60, 0, 0, 1.5708, 'copper']);
P.push(['tubo-freio-d', 'c', 0.008, 0.008, 2.00, 0.00, 0.24, -0.60, 0, 0, 1.5708, 'copper']);
P.push(['tubo-combustivel-1', 'c', 0.012, 0.012, 3.50, 0.00, 0.26, 0.40, 0, 0, 1.5708, 'steel']);
P.push(['tubo-combustivel-2', 'c', 0.012, 0.012, 3.50, 0.00, 0.26, -0.40, 0, 0, 1.5708, 'steel']);
for (let i = 0; i < 15; i++) {
  const x = -1.6 + i * 0.22;
  P.push(['presilha-e-' + i, 'b', 0.02, 0.03, 0.03, x, 0.24, 0.60, 0, 0, 0, 'black']);
  P.push(['presilha-d-' + i, 'b', 0.02, 0.03, 0.03, x, 0.24, -0.60, 0, 0, 0, 'black']);
}

/* ---------- CÂMBIO / TRANSMISSÃO ---------- */
P.push(['caixa-cambio', 'b', 0.40, 0.25, 0.35, -1.20, 0.17, 0, 0, 0, 0, 'eng']);
P.push(['homocinetica-f-e', 't', 0.06, 0.02, -1.310, 0.335, 0.55, 0, 0, 1.5708, 'rubber']);
P.push(['homocinetica-f-d', 't', 0.06, 0.02, -1.310, 0.335, -0.55, 0, 0, 1.5708, 'rubber']);
P.push(['homocinetica-r-e', 't', 0.06, 0.02, 1.165, 0.335, 0.55, 0, 0, 1.5708, 'rubber']);
P.push(['homocinetica-r-d', 't', 0.06, 0.02, 1.165, 0.335, -0.55, 0, 0, 1.5708, 'rubber']);

/* ---------- PARAFUSOS E REBITES EXTRAS ---------- */
for (let i = 0; i < 60; i++) {
  const x = -2.0 + (i % 20) * 0.20;
  const y = 0.25 + Math.floor(i / 20) * 0.20;
  P.push(['rebite-e-' + i, 'c', 0.005, 0.005, 0.008, x, y, HALF_BW + 0.002, 0, 0, 1.5708, 'chrome']);
  P.push(['rebite-d-' + i, 'c', 0.005, 0.005, 0.008, x, y, -HALF_BW - 0.002, 0, 0, 1.5708, 'chrome']);
}

/* ================================================================
   INSTANCIAÇÃO DAS PEÇAS
   ================================================================ */
for (const it of P) {
  const name = it[0], type = it[1];
  const a = it[2], b = it[3], c = it[4];
  const x = it[5], y = it[6], z = it[7];
  const rx = it[8] || 0, ry = it[9] || 0, rz = it[10] || 0;
  const mat = M[it[11]];
  if (type === 'b') box(a, b, c, x, y, z, mat, name);
  else if (type === 'c') cyl(a, a, b, x, y, z, mat, name, 20, rx, ry, rz);
  else if (type === 't') torus(a, b, x, y, z, mat, name, rx, ry, rz);
  else if (type === 's') sph(a, x, y, z, mat, name);
}

/* ================================================================
   RODAS DETALHADAS
   ================================================================ */
function buildWheel(x, z, side, name) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, Y0, z);
  // Pneu
  const t = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, WHEEL_W, 48), M.rubber);
  t.rotation.x = Math.PI / 2; t.castShadow = true; t.receiveShadow = true; g.add(t);
  // Banda (64 blocos)
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const blk = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.022, WHEEL_W * 0.85), M.tread);
    blk.position.set(Math.cos(a) * (WHEEL_R - 0.008), Math.sin(a) * (WHEEL_R - 0.008), 0);
    blk.rotation.z = a; g.add(blk);
  }
  // Flancos
  for (const zz of [side * (WHEEL_W/2 - 0.02), -side * (WHEEL_W/2 - 0.02)]) {
    const sw = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R * 0.75, 0.035, 14, 48), M.rubber);
    sw.position.z = zz; g.add(sw);
  }
  // Letras laterais
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const lt = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.005), M.seam);
    lt.position.set(Math.cos(a) * WHEEL_R * 0.82, Math.sin(a) * WHEEL_R * 0.82, side * (WHEEL_W/2 - 0.018));
    lt.rotation.z = a; g.add(lt);
  }
  // Aro
  const rimZ = side * (WHEEL_W / 2 - 0.012);
  for (const zz of [rimZ, -rimZ]) {
    const rr = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R * 0.62, 0.022, 14, 48), M.rim);
    rr.position.z = zz; g.add(rr);
  }
  for (const zz of [rimZ - side * 0.005, -rimZ + side * 0.005]) {
    const rf = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.62, WHEEL_R * 0.62, 0.015, 48), M.rimDk);
    rf.rotation.x = Math.PI / 2; rf.position.z = zz; g.add(rf);
  }
  for (const zz of [rimZ + side * 0.008, -rimZ - side * 0.008]) {
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.24, WHEEL_R * 0.24, 0.03, 28), M.rim);
    hb.rotation.x = Math.PI / 2; hb.position.z = zz; g.add(hb);
  }
  // Logo
  const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.005, 20), M.chrome);
  lg.rotation.x = Math.PI / 2; lg.position.z = rimZ + side * 0.025; g.add(lg);
  // 5 raios em Y (15 segmentos)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    for (const [len, wid, rotOff, zOff] of [[1.05, 0.045, 0, 0.005], [0.95, 0.03, 0.35, 0.006], [0.95, 0.03, -0.35, 0.006]]) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(WHEEL_R * len, wid, 0.02), M.rim);
      sp.rotation.z = a + rotOff;
      sp.position.z = rimZ + side * zOff;
      g.add(sp);
    }
  }
  // Porcas e parafusos
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const nt = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 6), M.chrome);
    nt.rotation.x = Math.PI / 2; nt.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, rimZ + side * 0.022); g.add(nt);
    const blt = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.025, 6), M.steel);
    blt.rotation.x = Math.PI / 2; blt.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, rimZ + side * 0.030); g.add(blt);
  }
  // Disco com furos
  const dc = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.66, WHEEL_R * 0.66, 0.02, 48), M.disc);
  dc.rotation.x = Math.PI / 2; dc.position.z = rimZ - side * 0.04; g.add(dc);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.03, 8), M.black);
    hl.rotation.x = Math.PI / 2; hl.position.set(Math.cos(a) * WHEEL_R * 0.55, Math.sin(a) * WHEEL_R * 0.55, rimZ - side * 0.04); g.add(hl);
  }
  // Pinça + pastilhas + pistões
  const cp = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), M.cal);
  cp.position.set(-WHEEL_R * 0.55 * side, 0, rimZ - side * 0.04); g.add(cp);
  for (const zz of [rimZ - side * 0.04 + 0.025, rimZ - side * 0.04 - 0.025]) {
    const pd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.015), M.steel);
    pd.position.set(-WHEEL_R * 0.55 * side, 0, zz); g.add(pd);
  }
  for (let p = 0; p < 2; p++) {
    const ps = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.02, 12), M.steel);
    ps.rotation.x = Math.PI / 2;
    ps.position.set(-WHEEL_R * 0.55 * side + (p - 0.5) * 0.03, 0.03, rimZ - side * 0.04); g.add(ps);
  }
  // Mangueira
  const hs = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.20, 8), M.hose);
  hs.position.set(-WHEEL_R * 0.55 * side, 0.15, rimZ - side * 0.04); g.add(hs);
  // Válvula
  const vl = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8), M.black);
  vl.rotation.z = Math.PI / 2; vl.position.set(0, WHEEL_R * 0.62, rimZ + side * 0.01); g.add(vl);
  // 20 parafusos do aro
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const boltR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6), M.chrome);
    boltR.rotation.x = Math.PI / 2;
    boltR.position.set(Math.cos(a) * WHEEL_R * 0.60, Math.sin(a) * WHEEL_R * 0.60, rimZ + side * 0.012); g.add(boltR);
  }
  scene.add(g);
}
buildWheel(FAX,  TRACK,  1, 'roda-dianteira-e');
buildWheel(FAX, -TRACK, -1, 'roda-dianteira-d');
buildWheel(RAX,  TRACK,  1, 'roda-traseira-e');
buildWheel(RAX, -TRACK, -1, 'roda-traseira-d');

/* ================================================================
   LINHAS DE PAINEL
   ================================================================ */
function panelLine(p1, p2, s) {
  const z1 = s * (taperScale(p1[1]) * HALF_BW + 0.003);
  const z2 = s * (taperScale(p2[1]) * HALF_BW + 0.003);
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p1[0], p1[1], z1),
    new THREE.Vector3(p2[0], p2[1], z2)
  ]);
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x000000 })));
}
for (const s of [-1, 1]) {
  panelLine([-0.82, 0.775], [-0.27, 1.150], s);
  panelLine([ 0.53, 1.230], [ 1.34, 0.885], s);
  panelLine([-0.82, 0.775], [-0.30, 0.780], s);
  panelLine([ 1.34, 0.885], [ 1.82, 0.815], s);
  panelLine([ 1.82, 0.815], [ 2.05, 0.790], s);
  panelLine([-0.30, 0.780], [ 0.20, 0.760], s);
  panelLine([ 0.20, 0.760], [ 0.65, 0.770], s);
  panelLine([ 0.65, 0.770], [ 1.34, 0.885], s);
}


/* ================================================================
   PACOTE DE DETALHAMENTO V3
   ---------------------------------------------------------------
   A referência é uma carroceria real desmontada/sem portas,
   portanto os detalhes abaixo priorizam a estrutura da carroceria:
   - longarinas, travessas e reforços;
   - caixas de roda e bordas dos arcos;
   - painéis de capô/porta/tampa;
   - dobradiças, travas e parafusos;
   - componentes do cofre;
   - refrigeração, admissão e alimentação;
   - suspensão, cubos e freios;
   - transmissão, diferencial e cardã;
   - escape e escudos térmicos;
   - interior completo e comandos;
   - portas, borrachas e vedações;
   - iluminação, emblemas e pequenos acabamentos.

   Tudo é modelado com primitives "em blocos": BoxGeometry,
   CylinderGeometry, SphereGeometry e TorusGeometry. Não há
   booleanas pesadas nem superfícies "mágicas" tentando inventar
   uma carroceria diferente da planta.
   ================================================================ */

/* ---------- HELPERS AVANÇADOS ---------- */
function addBox(w,h,d,x,y,z,mat,name,rx=0,ry=0,rz=0) {
  const m = box(w,h,d,x,y,z,mat,name);
  m.rotation.set(rx,ry,rz);
  return m;
}
function addCylinder(r,h,x,y,z,mat,name,rx=0,ry=0,rz=0,seg=24) {
  const m = cyl(r,r,h,x,y,z,mat,name,seg,rx,ry,rz);
  return m;
}
function addRod(p1,p2,r,mat,name,seg=12) {
  const a=new THREE.Vector3(...p1), b=new THREE.Vector3(...p2);
  const d=b.clone().sub(a);
  const len=d.length();
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,seg),mat);
  m.name=name;
  m.position.copy(a.clone().add(b).multiplyScalar(.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
  m.castShadow=true;m.receiveShadow=true;scene.add(m);
  return m;
}
function addPanelStrip(x1,y1,z1,x2,y2,z2,w,mat,name) {
  const c=new THREE.CatmullRomCurve3([
    new THREE.Vector3(x1,y1,z1),
    new THREE.Vector3((x1+x2)/2,(y1+y2)/2,(z1+z2)/2),
    new THREE.Vector3(x2,y2,z2)
  ]);
  const g=new THREE.Mesh(new THREE.TubeGeometry(c,16,w,8,false),mat);
  g.name=name;g.castShadow=true;scene.add(g);return g;
}
function addBolt(x,y,z,side,name,r=.006) {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,.012,8),M.chrome);
  m.name=name;m.position.set(x,y,z);m.rotation.x=Math.PI/2*side;
  m.castShadow=true;scene.add(m);return m;
}
function addVent(x,y,z,w,h,d,mat,name) {
  const outer=addBox(w,h,d,x,y,z,mat,name);
  const inner=addBox(w*.72,h*.50,d*.25,x,y,z+(z>=0?-.01:.01),M.black,name+'-cavidade');
  return {outer,inner};
}

/* ---------- GEOMETRIA DE LATERAL / PORTAS ---------- */
/* Molduras seguem a abertura lateral da planta, sem virar "abas". */
for (const s of [-1,1]) {
  const zz = s * 0.955;
  /* soleira estrutural */
  addBox(2.72,.10,.08,.05,.39,zz,M.body2,'soleira-estrutural');
  /* trilho inferior da porta */
  addPanelStrip(-1.03,.50,zz,-.05,.50,zz,.010,M.seam2,'linha-inferior-porta');
  addPanelStrip(-.05,.50,zz,.82,.54,zz,.010,M.seam2,'linha-inferior-porta-2');
  /* contorno A / teto / C */
  addPanelStrip(-1.10,.75,zz,-.88,1.09,zz,.012,M.body2,'moldura-A');
  addPanelStrip(-.88,1.09,zz,-.58,1.19,zz,.012,M.body2,'moldura-teto-1');
  addPanelStrip(-.58,1.19,zz,.18,1.20,zz,.012,M.body2,'moldura-teto-2');
  addPanelStrip(.18,1.20,zz,.52,1.10,zz,.012,M.body2,'moldura-teto-3');
  addPanelStrip(.52,1.10,zz,.78,.82,zz,.012,M.body2,'moldura-C');
  /* moldura inferior e traseira da porta */
  addPanelStrip(-1.10,.75,zz,-1.00,.50,zz,.010,M.body2,'borda-dianteira-porta');
  addPanelStrip(-1.00,.50,zz,.80,.54,zz,.010,M.body2,'borda-inferior-porta');
  addPanelStrip(.80,.54,zz,.78,.82,zz,.010,M.body2,'borda-traseira-porta');

  /* placas internas de reforço com furação */
  addBox(.12,.52,.045,-.95,.64,zz*.995,M.int,'reforco-porta-A');
  addBox(.10,.50,.045,.73,.65,zz*.995,M.int,'reforco-porta-C');
  for(let i=0;i<7;i++){
    addBolt(-1.00+i*.25,.47,zz*s*.999,s,'rebite-soleira-'+s+'-'+i,.005);
    addBolt(-.96+i*.27,.91,zz*s*.999,s,'rebite-moldura-'+s+'-'+i,.005);
  }
}
/* fallback-safe alias for the above body reinforcement */
const _reinforcementMat = M.int;

/* ---------- ARCOS DE RODA: LIP + MOLDURA + PROTEÇÃO ---------- */
for (const s of [-1,1]) {
  for (const [ax,label] of [[FAX,'dianteiro'],[RAX,'traseiro']]) {
    const z = s * (HALF_BW * 0.94);
    const lip = torus(ARCH_R + .008,.022,ax,Y0,z,M.body2,
      'aro-arco-'+label+'-'+s,0,Math.PI/2,0,48);
    /* guarda-lamas interno em pequenos blocos */
    for(let i=0;i<16;i++){
      const a=Math.PI*1.10 + i*(Math.PI*.80/15);
      const x=ax+Math.cos(a)*(ARCH_R+.015);
      const y=Y0+Math.sin(a)*(ARCH_R+.015);
      addBox(.055,.035,.035,x,y,z*.96,M.black,
        'forro-arco-'+label+'-'+s+'-'+i);
    }
  }
}

/* ---------- CAPÔ: NERVURAS, DOBRADIÇAS, FECHO, VEDACAO ---------- */
for (const s of [-1,1]) {
  addBox(.82,.028,.025,-1.62,.695,s*.55,M.body2,'nervura-capo-'+s);
  addBox(.64,.025,.018,-1.35,.705,s*.30,M.body2,'nervura-capo-sec-'+s);
  addBox(.08,.035,.12,-.98,.70,s*.59,M.steel,'dobradica-capo-base-'+s);
  addRod([-1.02,.62,s*.63],[-.94,.72,s*.58],.010,M.steel,'braco-capo-'+s);
  addBox(.06,.045,.08,-2.04,.52,s*.05,M.steel,'fecho-capo-'+s);
}
for(let i=0;i<22;i++){
  const z=-.68+i*.0648;
  addBolt(-1.82,.595,z, z>=0?1:-1, 'rebite-capo-'+i,.004);
}
for(let i=0;i<24;i++){
  const x=-2.03+i*.035;
  addBox(.015,.018,.012,x,.505,.68,M.black,'vedacao-capo-'+i+'-e');
  addBox(.015,.018,.012,x,.505,-.68,M.black,'vedacao-capo-'+i+'-d');
}

/* ---------- PORTAS: DOBRADIÇAS, TRAVA, VIDRO, GUIAS ---------- */
for(const s of [-1,1]){
  const z=s*.965;
  const side=s>0?'e':'d';
  for(let j=0;j<3;j++){
    const x=-.95+j*.55;
    addBox(.065,.11,.045,x,.52,z,M.steel,'dobradica-porta-'+side+'-'+j);
    addBolt(x,.55,z,s,'parafuso-dobradiça-'+side+'-'+j,.006);
  }
  addBox(.10,.055,.035,.72,.74,z,M.dark,'trava-porta-'+side);
  addBox(.055,.04,.025,.78,.66,z,M.steel,'atuador-trava-'+side);
  addRod([-.78,.86,z],[.46,.86,z],.008,M.steel,'guia-vidro-'+side);
  addBox(.72,.035,.025,-.05,.78,z,M.rubber,'borracha-peitoril-'+side);
  for(let i=0;i<16;i++){
    const x=-.84+i*.11;
    addBox(.015,.018,.018,x,.81,z,M.black,'presilha-peitoril-'+side+'-'+i);
  }
  addBox(.30,.04,.035,-.42,.58,z,M.int,'apoio-braco-porta-'+side);
  addBox(.24,.025,.025,-.42,.67,z,M.chrome,'moldura-puxador-porta-'+side);
}

/* ---------- TUBULAÇÕES DE VEDAÇÃO ---------- */
for(const s of [-1,1]){
  const z=s*.975;
  addPanelStrip(-1.15,.48,z,-.95,.90,z,.017,M.black,'borracha-porta-A-'+s);
  addPanelStrip(-.95,.90,z,-.58,1.18,z,.017,M.black,'borracha-teto-1-'+s);
  addPanelStrip(-.58,1.18,z,.18,1.20,z,.017,M.black,'borracha-teto-2-'+s);
  addPanelStrip(.18,1.20,z,.55,1.09,z,.017,M.black,'borracha-teto-3-'+s);
  addPanelStrip(.55,1.09,z,.80,.80,z,.017,M.black,'borracha-porta-C-'+s);
}

/* ---------- PARA-LAMAS / PAINÉIS DE TRANSIÇÃO ---------- */
for(const s of [-1,1]){
  const z=s*.925;
  addPanelStrip(-2.05,.60,z,-1.65,.70,z,.016,M.body2,'linha-paralama-frontal-'+s);
  addPanelStrip(-1.65,.70,z,-1.20,.74,z,.016,M.body2,'linha-paralama-frontal-2-'+s);
  addPanelStrip(.80,.80,z,1.35,.80,z,.016,M.body2,'linha-paralama-traseiro-'+s);
  addPanelStrip(1.35,.80,z,1.85,.72,z,.016,M.body2,'linha-paralama-traseiro-2-'+s);
  for(let i=0;i<10;i++){
    const x=-1.98+i*.09;
    addBolt(x,.62,z,s,'rebite-para-lama-F-'+s+'-'+i,.0045);
  }
  for(let i=0;i<10;i++){
    const x=1.38+i*.06;
    addBolt(x,.69,z,s,'rebite-para-lama-R-'+s+'-'+i,.0045);
  }
}

/* ---------- TAMPA TRASEIRA / PORTA-MALAS ---------- */
addPanelStrip(.52,.74,.0,1.70,.79,.0,.014,M.body2,'linha-tampa-porta-malas');
addPanelStrip(1.70,.79,0,2.08,.64,0,.014,M.body2,'linha-tampa-porta-malas-2');
for(const s of [-1,1]){
  const z=s*.72;
  addBox(.10,.035,.10,1.00,.77,z,M.steel,'dobradica-porta-malas-'+s);
  addRod([1.00,.74,z],[1.02,.92,z],.009,M.steel,'braco-porta-malas-'+s);
}
addBox(.08,.06,.12,2.03,.69,0,M.steel,'fecho-porta-malas');
addBox(.35,.025,.015,1.50,.815,0,M.chrome,'emblema-porta-malas');
for(let i=0;i<30;i++){
  const z=-.72+i*.05;
  addBolt(2.10,.57,z,z>=0?1:-1,'rebite-painel-traseiro-'+i,.0045);
}

/* ---------- TAMPA DE COMBUSTÍVEL ---------- */
addBox(.025,.16,.13,1.15,.70,-.91,M.body2,'tampa-combustivel');
addBox(.012,.10,.08,1.15,.70,-.98,M.black,'cavidade-combustivel');
addCylinder(.018,.02,1.15,.70,-1.00,M.chrome,'tampa-bocal-combustivel',Math.PI/2,0,0,20);

/* ---------- SAIA / PISO LATERAL COM REFORÇOS ---------- */
for(const s of [-1,1]){
  const z=s*.94;
  for(let i=0;i<18;i++){
    const x=-1.85+i*.20;
    addBox(.14,.04,.07,x,.30,z,M.body2,'reforco-saia-'+s+'-'+i);
  }
  for(let i=0;i<22;i++){
    const x=-1.90+i*.18;
    addBolt(x,.34,z,s,'parafuso-asalho-lateral-'+s+'-'+i,.004);
  }
}

/* ================================================================
   COFRE DO MOTOR — detalhamento em blocos
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.67;
  addBox(1.12,.08,.08,-1.63,.24,z,M.dark,'longarina-cofre-'+s);
  addBox(.75,.06,.08,-1.94,.58,z,M.body2,'suporte-radiador-'+s);
  addBox(.08,.30,.10,-2.12,.55,z,M.steel,'torre-radiador-'+s);
  addBox(.08,.33,.10,-1.18,.58,z,M.steel,'torre-cofre-'+s);
  addBox(.18,.08,.12,-1.43,.78,z,M.body2,'suporte-amortecedor-'+s);
  addCylinder(.035,.04,-1.43,.79,z,M.chrome,'porca-amortecedor-'+s,Math.PI/2,0,0,20);
}

/* Radiador realista: moldura + colmeia + suportes */
addBox(.10,.36,1.30,-2.08,.57,0,M.steel,'radiador-moldura');
addBox(.025,.28,1.22,-2.14,.58,0,M.dark,'radiador-colmeia');
for(let i=0;i<46;i++){
  const z=-.59+i*.026;
  addBox(.014,.25,.012,-2.155,.58,z,M.alu,'radiador-aleta-'+i);
}
for(let i=0;i<16;i++){
  const y=.45+i*.018;
  addBox(.018,.012,1.15,-2.155,y,0,M.steel,'radiador-linha-'+i);
}
for(const s of [-1,1]){
  addRod([-2.02,.63,s*.48],[-1.75,.70,s*.27],.022,M.hose,'mangueira-radiador-'+s);
  addRod([-2.02,.52,s*.48],[-1.75,.48,s*.30],.018,M.hose,'mangueira-radiador-baixa-'+s);
}

/* Ventoinhas */
for(const z of [-.32,.32]){
  addCylinder(.17,.04,-2.11,.58,z,M.black,'ventoinha-hub',Math.PI/2,0,0,32);
  for(let i=0;i<9;i++){
    const a=i*Math.PI*2/9;
    addBox(.13,.025,.025,-2.12+Math.cos(a)*.08,.58+Math.sin(a)*.08,z,M.alu,
      'pa-ventoinha-'+z+'-'+i,0,0,a);
  }
}

/* Motor: bloco, cabeçotes, coletor, acessórios */
addBox(.60,.38,.64,-1.72,.60,0,M.eng,'bloco-motor');
addBox(.58,.08,.62,-1.72,.81,0,M.engCov,'tampa-superior-motor');
for(const s of [-1,1]){
  addBox(.55,.16,.08,-1.73,.69,s*.28,M.steel,'cabecote-'+s);
  for(let i=0;i<7;i++){
    addBox(.07,.025,.30,-1.98+i*.08,.82,s*.12,M.alu,'nervura-tampa-valvula-'+s+'-'+i);
  }
}
/* quatro cilindros visuais */
for(let i=0;i<4;i++){
  addCylinder(.07,.04,-1.88+i*.10,.75,0,M.dark,'poço-vela-'+i,Math.PI/2,0,0,20);
  addCylinder(.018,.05,-1.88+i*.10,.80,.0,M.chrome,'vela-'+i,Math.PI/2,0,0,16);
}

/* Admissão */
addBox(.42,.10,.26,-1.58,.84,0,M.engCov,'coletor-admissao');
for(let i=0;i<4;i++){
  addRod([-1.76+i*.08,.84,0],[-1.63+i*.08,.95,0],.018,M.alu,'duto-admissao-'+i);
}
addBox(.20,.12,.20,-1.38,.97,0,M.dark,'corpo-borboleta');
addBox(.30,.09,.30,-1.23,1.00,0,M.engCov,'caixa-filtro-ar');
for(let i=0;i<8;i++){
  addBox(.015,.06,.24,-1.36+i*.038,1.00,0,M.alu,'aleta-filtro-ar-'+i);
}
addRod([-1.08,1.00,0],[-.82,.88,0],.026,M.hose,'mangueira-admissao');

/* Escape e escudos */
for(const s of [-1,1]){
  for(let i=0;i<4;i++){
    addRod([-2.00+i*.08,.57,s*.16],[-2.16+i*.08,.48,s*.26],.018,M.steel,
      'tubo-coletor-escape-'+s+'-'+i);
  }
  addBox(.58,.03,.34,-1.77,.48,s*.38,M.steel,'escudo-termico-escape-'+s);
  for(let i=0;i<8;i++){
    addBolt(-2.0+i*.06,.50,s*.55,s,'parafuso-escudo-'+s+'-'+i,.004);
  }
}

/* Bateria */
addBox(.24,.18,.32,-1.42,.60,.48,M.bat,'bateria');
addBox(.12,.03,.10,-1.42,.705,.48,M.black,'tampa-bateria');
addBox(.025,.015,.06,-1.50,.73,.48,M.wRed,'terminal-bateria-positivo');
addBox(.025,.015,.06,-1.34,.73,.48,M.wBlack,'terminal-bateria-negativo');
for(let i=0;i<8;i++){
  addBox(.015,.02,.25,-1.53+i*.025,.58,.48,M.seam2,'ranhura-bateria-'+i);
}

/* Reservatórios */
for(const [x,z,n] of [[-1.32,-.48,'agua'],[-1.18,.45,'freio'],[-1.00,-.48,'direcao']]){
  addBox(.13,.18,.16,x,.65,z,M.lens,'reservatorio-'+n);
  addBox(.08,.025,.10,x,.75,z,M.black,'tampa-reservatorio-'+n);
}

/* Chicotes do cofre */
for(const s of [-1,1]){
  for(let i=0;i<22;i++){
    const x=-2.02+i*.045;
    addRod([x,.73,s*.52],[x+.10,.75,s*.42],.004,
      i%2?M.wBlack:M.wRed,'chicote-cofre-'+s+'-'+i,8);
  }
}

/* ================================================================
   SUSPENSÃO E FREIOS — quatro cantos
   ================================================================ */
for(const [x,axleName] of [[FAX,'F'],[RAX,'R']]){
  for(const s of [-1,1]){
    const sideName=s>0?'E':'D';
    const z=s*TRACK;
    /* cubo */
    addCylinder(.095,.12,x,.43,z,M.steel,'cubo-'+axleName+'-'+sideName,Math.PI/2,0,0,28);
    addCylinder(.06,.13,x,.43,z+s*.07,M.dark,'flange-cubo-'+axleName+'-'+sideName,Math.PI/2,0,0,24);
    /* disco */
    addCylinder(.145,.018,x,.43,z+s*.075,M.disc,'disco-'+axleName+'-'+sideName,Math.PI/2,0,0,48);
    addCylinder(.055,.022,x,.43,z+s*.087,M.hub,'disco-hub-'+axleName+'-'+sideName,Math.PI/2,0,0,24);
    /* ventilação do disco */
    for(let i=0;i<14;i++){
      const a=i*Math.PI*2/14;
      addCylinder(.009,.028,x+Math.cos(a)*.105,.43+Math.sin(a)*.105,z+s*.09,M.black,
        'furo-disco-'+axleName+'-'+sideName+'-'+i,Math.PI/2,0,0,8);
    }
    /* pinça */
    addBox(.075,.18,.055,x-.10,.44,z+s*.10,M.cal,'pinca-'+axleName+'-'+sideName);
    addBox(.08,.035,.07,x-.11,.44,z+s*.12,M.steel,'pastilha-'+axleName+'-'+sideName);
    /* bandejas */
    addRod([x-.32,.26,z],[x-.08,.31,z+s*.06],.018,M.steel,'bandeja-inferior-'+axleName+'-'+sideName);
    addRod([x+.30,.27,z],[x+.08,.33,z+s*.06],.018,M.steel,'bandeja-traseira-'+axleName+'-'+sideName);
    addRod([x,.26,z],[x,.53,z+s*.03],.018,M.steel,'manga-eixo-'+axleName+'-'+sideName);
    /* mola / amortecedor */
    for(let j=0;j<9;j++){
      const yy=.47+j*.028;
      torus(.043,.006,x,yy,z+s*.03,M.steel,
        'espira-'+axleName+'-'+sideName+'-'+j,0,0,0,16);
    }
    addCylinder(.025,.33,x,.60,z+s*.03,M.dark,'amortecedor-'+axleName+'-'+sideName,0,0,0,20);
    addCylinder(.034,.09,x,.78,z+s*.03,M.steel,'coxinsup-'+axleName+'-'+sideName,0,0,0,20);
    /* barra estabilizadora */
    addRod([x-.45,.28,z*s],[x+.45,.28,z*s],.012,M.cal,'barra-estabilizadora-'+axleName+'-'+sideName);
    /* mangueira de freio */
    addRod([x-.08,.45,z+s*.12],[x-.18,.55,z+s*.22],.006,M.hose,'mangueira-freio-'+axleName+'-'+sideName,8);
  }
}

/* ---------- RODAS: MODELO FISICAMENTE MAIS CHEIO ---------- */
for(const [x,axleName] of [[FAX,'F'],[RAX,'R']]){
  for(const s of [-1,1]){
    const z=s*TRACK;
    /* laterais já existentes; adiciona banda central e marcações */
    for(let i=0;i<24;i++){
      const a=i*Math.PI*2/24;
      addBox(.05,.016,.24,x+Math.cos(a)*(.335-.02),Y0+Math.sin(a)*(.335-.02),z,
        M.tread,'sulco-pneu-'+axleName+'-'+s+'-'+i,0,0,a);
    }
    for(let i=0;i<24;i++){
      const a=i*Math.PI*2/24;
      addBox(.035,.012,.012,x+Math.cos(a)*.265,Y0+Math.sin(a)*.265,z+s*.132,
        M.seam,'marcacao-pneu-'+axleName+'-'+s+'-'+i,0,0,a);
    }
    /* peso da roda */
    addBox(.025,.025,.08,x+.20,Y0+.05,z+s*.135,M.steel,'contrapeso-roda-'+axleName+'-'+s);
  }
}

/* ================================================================
   UNDERBODY — escudos, tanque, suporte e proteção
   ================================================================ */
addBox(1.05,.10,1.20,.70,.18,0,M.dark,'protecao-tanque');
addBox(1.10,.05,1.15,.70,.235,0,M.steel,'escudo-tanque');
for(let i=0;i<20;i++){
  addBox(.055,.02,1.08,.20+i*.055,.245,0,M.seam2,'nervura-protecao-tanque-'+i);
}
addBox(.65,.06,1.10,-.45,.19,0,M.steel,'protecao-caixa-cambio');
addBox(.42,.05,.80,-1.05,.19,0,M.steel,'protecao-carter');
addBox(.48,.04,.75,-1.62,.19,0,M.steel,'protecao-carter-dianteiro');
for(let i=0;i<12;i++){
  const x=-1.75+i*.18;
  addBolt(x,.22,.62,x>0?1:-1,'parafuso-underbody-e-'+i,.005);
  addBolt(x,.22,-.62,x>0?-1:1,'parafuso-underbody-d-'+i,.005);
}

/* ---------- ESCAPAMENTO: COLETORES, FLEXÍVEIS, ABRAÇADEIRAS ---------- */
for(const s of [-1,1]){
  addRod([-1.60,.23,s*.18],[-.90,.23,s*.18],.022,M.exh,'escape-central-'+s);
  addRod([-.90,.23,s*.18],[.10,.23,s*.18],.022,M.exh,'escape-central-2-'+s);
  addBox(.50,.14,.18,.55,.23,s*.18,M.exh,'silencioso-'+s);
  addRod([.80,.23,s*.18],[1.65,.23,s*.30],.025,M.exh,'escape-traseiro-'+s);
  addBox(.34,.12,.18,1.65,.23,s*.30,M.exh,'abafador-final-'+s);
  addRod([1.78,.23,s*.30],[2.20,.25,s*.48],.03,M.chrome,'ponteira-'+s);
  addCylinder(.055,.08,2.20,.25,s*.48,M.chrome,'bocal-escape-'+s,0,Math.PI/2,0,24);
  for(let i=0;i<7;i++){
    const x=-.75+i*.18;
    addBox(.03,.025,.13,x,.265,s*.18,M.steel,'escudo-escape-'+s+'-'+i);
  }
  for(let i=0;i<5;i++){
    const x=.35+i*.18;
    torus(.032,.005,x,.245,s*.18,M.steel,'abraçadeira-escape-'+s+'-'+i,Math.PI/2,0,0,16);
  }
}

/* ================================================================
   DIREÇÃO
   ================================================================ */
addRod([-.55,.30,.0],[-.55,.73,.30],.018,M.steel,'coluna-direcao');
addBox(.22,.05,.22,-.55,.55,.30,M.steel,'caixa-direcao');
addRod([-1.35,.30,.30],[-.90,.30,.30],.015,M.steel,'tirante-direcao');
addRod([-1.35,.30,-.30],[-.90,.30,-.30],.015,M.steel,'tirante-direcao-d');
for(const s of [-1,1]){
  addRod([-1.02,.33,s*.20],[-1.31,.36,s*.55],.012,M.steel,'terminal-direcao-'+s);
}

/* ================================================================
   INTERIOR EXPANDIDO
   ================================================================ */
/* Túnel central */
addBox(1.75,.16,.30,-.05,.42,0,M.int,'tunel-central');
addBox(1.20,.08,.34,.25,.53,0,M.leather,'cobertura-tunel');
for(let i=0;i<14;i++){
  addBox(.04,.018,.28,-.45+i*.10,.57,0,M.seam,'costura-tunel-'+i);
}
/* consoles e compartimentos */
addBox(.42,.08,.30,.05,.72,0,M.int,'console-marcha');
addBox(.22,.05,.28,-.02,.79,0,M.leather,'console-superior');
addBox(.18,.04,.20,.08,.84,0,M.black,'moldura-multimidia');
addBox(.10,.015,.06,.08,.855,0,M.led,'tela-multimidia');
for(let i=0;i<8;i++){
  addBox(.025,.018,.04,-.12+i*.03,.84,0,M.chrome,'botoes-console-'+i);
}
addCylinder(.018,.05,.25,.86,0,M.chrome,'alavanca-cambio',0,0,0,16);
addCylinder(.045,.05,.25,.90,0,M.leather,'manopla-cambio',0,0,0,20);

/* Freio de mão eletrônico / convencional */
addBox(.16,.06,.05,.34,.81,.18,M.int,'freio-mao-base');
addBox(.09,.05,.04,.34,.85,.18,M.chrome,'freio-mao-botao');

/* Bancos: encostos, trilhos, cinto e fivelas */
for(const s of [-1,1]){
  const z=s*.34;
  const side=s>0?'e':'d';
  addBox(.52,.14,.48,-.10,.61,z,M.seat,'assento-primario-'+side);
  addBox(.48,.04,.44,-.10,.69,z,M.leather,'almofada-assento-'+side);
  addBox(.11,.48,.46,-.38,.86,z,M.seat,'encosto-primario-'+side);
  addBox(.035,.44,.43,-.44,.86,z,M.leather,'almofada-encosto-'+side);
  addBox(.14,.12,.30,-.43,1.16,z,M.seat,'cabecalho-banco-'+side);
  addBox(.16,.035,.07,-.42,.52,z-.18*s,M.steel,'trilho-banco-a-'+side);
  addBox(.16,.035,.07,-.42,.52,z+.18*s,M.steel,'trilho-banco-b-'+side);
  addBox(.07,.05,.04,.05,.70,z-.22*s,M.wRed,'fivela-cinto-'+side);
  addRod([-.26,.98,z-.20*s],[-.05,.72,z-.20*s],.010,M.wBlack,'cinto-ombro-'+side,8);
  addRod([-.04,.70,z-.20*s],[-.06,.57,z-.20*s],.010,M.wBlack,'cinto-cintura-'+side,8);
  for(let i=0;i<9;i++){
    addBox(.012,.008,.36,-.40+i*.065,.72,z,M.seam,'costura-banco-'+side+'-'+i);
  }
}

/* Banco traseiro dividido e apoios */
for(const s of [-1,1]){
  const z=s*.30;
  const side=s>0?'e':'d';
  addBox(.58,.13,.54,.72,.61,z,M.seat,'banco-traseiro-'+side);
  addBox(.56,.035,.50,.72,.68,z,M.leather,'almofada-traseira-'+side);
  addBox(.10,.45,.54,.98,.90,z,M.seat,'encosto-traseiro-'+side);
  addBox(.03,.40,.50,1.04,.90,z,M.leather,'acabamento-encosto-traseiro-'+side);
  addBox(.12,.10,.25,1.03,1.17,z,M.seat,'cabecote-traseiro-'+side);
}

/* Painel completo */
addBox(.50,.18,1.35,-.72,.91,0,M.int,'painel-central');
addBox(.44,.035,1.30,-.74,1.015,0,M.leather,'acabamento-painel');
for(const s of [-1,1]){
  addBox(.18,.11,.20,-.77,.99,s*.48,M.black,'instrument-cluster-'+s);
  for(let i=0;i<8;i++){
    addBox(.028,.015,.045,-.77+i*.026,.99,s*.48,M.chrome,'instrumento-detalhe-'+s+'-'+i);
  }
}
for(let i=0;i<6;i++){
  addBox(.05,.045,.13,-.74+i*.09,1.02,0,M.black,'saída-ar-painel-'+i);
}
/* Central multimídia e comandos */
addBox(.05,.16,.40,-.77,.82,0,M.black,'moldura-tela');
addBox(.02,.11,.30,-.80,.82,0,M.led,'display-central');
for(let i=0;i<7;i++){
  addBox(.03,.015,.04,-.82,.70,-.12+i*.04,M.chrome,'botao-dashboard-'+i);
}

/* Volante refinado */
const sw=new THREE.Group();
sw.position.set(-.60,.91,.32);
sw.rotation.z=-.28;
const swR=new THREE.Mesh(new THREE.TorusGeometry(.17,.018,14,48),M.leather);
sw.add(swR);
for(let i=0;i<5;i++){
  const a=i*Math.PI*2/5;
  const sp=new THREE.Mesh(new THREE.BoxGeometry(.12,.025,.018),M.steel);
  sp.position.set(Math.cos(a)*.075,Math.sin(a)*.075,0);
  sp.rotation.z=a;sw.add(sp);
}
const swHub=new THREE.Mesh(new THREE.CylinderGeometry(.048,.048,.028,24),M.chrome);
swHub.rotation.x=Math.PI/2;sw.add(swHub);
const swAir=new THREE.Mesh(new THREE.BoxGeometry(.09,.055,.024),M.int);
swAir.position.z=-.016;sw.add(swAir);
scene.add(sw);

/* ---------- FORRO DE TETO ---------- */
addBox(.05,.02,1.30,-.10,1.14,0,M.int,'forro-teto');
addBox(.70,.025,.025,-.10,1.15,.60,M.leather,'forro-teto-borda-e');
addBox(.70,.025,.025,-.10,1.15,-.60,M.leather,'forro-teto-borda-d');
for(let i=0;i<12;i++){
  addBox(.025,.012,1.10,-.55+i*.09,1.155,0,M.seam,'costela-forro-teto-'+i);
}

/* ---------- COLUNAS / AIRBAGS / SEGURANÇA ---------- */
for(const s of [-1,1]){
  const z=s*.78;
  addBox(.05,.50,.04,-.92,.93,z,M.int,'acabamento-pilar-A-'+s);
  addBox(.05,.40,.04,.00,.98,z,M.int,'acabamento-pilar-B-'+s);
  addBox(.05,.34,.04,.52,.96,z,M.int,'acabamento-pilar-C-'+s);
}
addBox(.06,.12,.28,-.77,1.00,0,M.leather,'airbag-passageiro');
addBox(.045,.10,.25,-.77,.98,.31,M.int,'airbag-motorista');
for(const s of [-1,1]){
  addBox(.03,.22,.10,-.74,1.00,s*.55,M.int,'alto-falante-painel-'+s);
  for(let i=0;i<9;i++){
    addBox(.015,.008,.07,-.75,.94,s*(.52+i*.008),M.black,'grade-altofalante-'+s+'-'+i);
  }
}

/* ================================================================
   SISTEMA ELÉTRICO / BECOS / FUSÍVEIS
   ================================================================ */
addBox(.18,.10,.30,-1.48,.73,-.44,M.black,'caixa-fusiveis');
for(let i=0;i<12;i++){
  addBox(.02,.025,.06,-1.55+i*.025,.78,-.44,i%2?M.wRed:M.wBlue,'fusivel-'+i);
}
for(let i=0;i<32;i++){
  const x=-.95+i*.06;
  const z=(i%2?-.72:.72);
  addRod([x,.56,z],[x+.10,.65,z*.94],.0035,i%3?M.wBlack:M.wRed,'chicote-sala-'+i,8);
}

/* ================================================================
   PORTAS — COMPONENTES INTERNOS
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.885;
  const side=s>0?'e':'d';
  addBox(1.36,.05,.08,.00,.62,z,M.int,'estrutura-porta-'+side);
  addBox(.85,.16,.045,.05,.72,z,M.leather,'acabamento-porta-'+side);
  addBox(.32,.035,.06,.02,.83,z,M.int,'apoio-braco-porta-2-'+side);
  addBox(.20,.02,.04,.20,.87,z,M.chrome,'puxador-interno-'+side);
  addBox(.10,.02,.03,.42,.87,z,M.dark,'trava-interna-'+side);
  addBox(.20,.04,.02,-.45,.60,z,M.black,'bolso-porta-'+side);
  for(let i=0;i<10;i++){
    addBox(.012,.012,.20,-.62+i*.12,.50,z,M.seam,'costura-porta-'+side+'-'+i);
  }
  /* alto-falante da porta */
  addCylinder(.095,.025,.05,.50,z+s*.01,M.black,'altofalante-porta-'+side,Math.PI/2,0,0,32);
  for(let i=0;i<8;i++){
    const a=i*Math.PI*2/8;
    addRod([.05+Math.cos(a)*.03,.50+Math.sin(a)*.03,z+s*.02],
           [.05+Math.cos(a)*.075,.50+Math.sin(a)*.075,z+s*.02],.003,M.chrome,
           'grade-porta-'+side+'-'+i,6);
  }
}

/* ================================================================
   SISTEMAS DE AR-CONDICIONADO / AQUECIMENTO
   ================================================================ */
addBox(.35,.18,.55,-.78,.47,0,M.int,'caixa-hvac');
addBox(.20,.12,.38,-.70,.64,0,M.dark,'evaporador-hvac');
for(let i=0;i<10;i++){
  addBox(.015,.10,.28,-.79+i*.018,.66,0,M.alu,'aleta-hvac-'+i);
}
addRod([-.55,.65,.20],[-.50,.72,.45],.012,M.hose,'tubo-hvac-e');
addRod([-.55,.65,-.20],[-.50,.72,-.45],.012,M.hose,'tubo-hvac-d');
for(const s of [-1,1]){
  addRod([-.78,.80,s*.15],[-.65,.84,s*.47],.010,M.hose,'duto-hvac-'+s);
}

/* ================================================================
   CARROCERIA: MICRO-DETALHES DE FURAÇÃO E UNIÕES
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.958;
  for(let row=0;row<4;row++){
    for(let i=0;i<24;i++){
      const x=-1.98+i*.17;
      const y=.33+row*.11;
      addCylinder(.0045,.012,x,y,z,M.chrome,'rebite-carroceria-'+s+'-'+row+'-'+i,Math.PI/2,0,0,8);
    }
  }
}
/* pontos de solda simulados como pequenas esferas */
for(const s of [-1,1]){
  const z=s*.961;
  for(let i=0;i<60;i++){
    const x=-2.0+(i%20)*.20;
    const y=.35+Math.floor(i/20)*.12;
    sph(.007,x,y,z,M.steel,'ponto-solda-'+s+'-'+i);
  }
}

/* ================================================================
   ILUMINAÇÃO EXTERNA — LENTES E FIXAÇÕES
   ================================================================ */
/* Faróis adicionais: módulos, LED e presilhas */
for(const s of [-1,1]){
  const side=s>0?'e':'d';
  addBox(.045,.16,.38,-2.27,.59,s*.58,M.lens,'lente-farol-'+side);
  addBox(.025,.04,.25,-2.30,.62,s*.58,M.led,'barra-led-farol-'+side);
  addBox(.025,.045,.08,-2.30,.54,s*.76,M.turn,'seta-farol-'+side);
  for(let i=0;i<6;i++){
    addBolt(-2.29,.55+i*.02,s*.72,s,'fixacao-farol-'+side+'-'+i,.004);
  }
}
/* Lanternas traseiras detalhadas */
for(const s of [-1,1]){
  const side=s>0?'e':'d';
  for(let i=0;i<7;i++){
    addBox(.02,.055,.07,2.255,.54+i*.025,s*(.38+i*.07),i%2?M.tail:M.tail2,
      'segmento-lanterna-'+side+'-'+i);
  }
  addBox(.02,.035,.12,2.27,.50,s*.66,M.rev,'marcha-re-'+side);
  addBox(.02,.03,.10,2.27,.61,s*.66,M.turn,'seta-re-'+side);
}

/* Refletivos / iluminação da placa */
addBox(.025,.03,.35,2.265,.43,0,M.led,'luz-placa');
for(const s of [-1,1]){
  addBox(.02,.02,.12,2.27,.38,s*.26,M.rev,'refletor-traseiro-'+s);
}

/* ================================================================
   CHASSI: TRAVESSAS / PONTOS DE FIXAÇÃO / COXINS
   ================================================================ */
for(let i=0;i<12;i++){
  const x=-1.95+i*.34;
  addBox(.06,.08,1.18,x,.18,0,M.steel,'travessa-chassi-extra-'+i);
  addBolt(x,.23,.51,1,'fixacao-travessa-e-'+i,.005);
  addBolt(x,.23,-.51,-1,'fixacao-travessa-d-'+i,.005);
}
for(const [x,z,n] of [
  [-1.31,.55,'motor-e'],[-1.31,-.55,'motor-d'],
  [-.10,.52,'cambio-e'],[-.10,-.52,'cambio-d'],
  [1.165,.55,'diferencial-e'],[1.165,-.55,'diferencial-d']
]){
  addBox(.14,.07,.12,x,.23,z,M.rubber,'coxim-'+n);
  addCylinder(.025,.035,x,.275,z,M.chrome,'parafuso-coxim-'+n,0,0,0,20);
}

/* ================================================================
   TANQUE / ABASTECIMENTO / FILTRO
   ================================================================ */
addBox(.86,.20,1.18,.86,.29,0,M.eng,'tanque-detalhado');
addBox(.72,.035,1.05,.86,.405,0,M.steel,'escudo-tanque-superior');
addRod([1.17,.40,.40],[1.35,.68,.40],.014,M.hose,'linha-combustivel-alimentacao');
addRod([1.17,.40,-.40],[1.35,.68,-.40],.014,M.hose,'linha-combustivel-retorno');
addBox(.18,.12,.20,1.38,.30,.42,M.black,'filtro-combustivel');
for(let i=0;i<16;i++){
  const a=i*Math.PI*2/16;
  addBox(.012,.025,.18,1.37+Math.cos(a)*.08,.30,.42+Math.sin(a)*.08,M.alu,
    'aleta-filtro-combustivel-'+i);
}

/* ================================================================
   FREIO / ABS / TUBULAÇÃO
   ================================================================ */
addBox(.24,.10,.34,-.35,.43,.30,M.eng,'modulo-abs');
for(let i=0;i<6;i++){
  const z=.17+i*.06;
  addRod([-.28,.49,z],[-.10,.36,z],.004,M.copper,'linha-abs-'+i,8);
}
for(const s of [-1,1]){
  addRod([-1.15,.34,s*.55],[-.95,.37,s*.68],.004,M.copper,'linha-freio-dianteira-'+s,8);
  addRod([1.10,.34,s*.55],[1.35,.35,s*.68],.004,M.copper,'linha-freio-traseira-'+s,8);
}

/* ================================================================
   EXTERIOR: ANTENA, TETO, MOLDURAS E CALHAS
   ================================================================ */
addBox(.10,.055,.035,.80,1.23,0,M.body2,'antena-base');
addBox(.04,.14,.025,.84,1.30,0,M.body2,'antena-haste');
for(const s of [-1,1]){
  addPanelStrip(-.80,1.20,s*.82,.50,1.20,s*.76,.009,M.chrome,'calha-teto-'+s);
}
addBox(.65,.025,.035,.05,1.245,.70,M.black,'moldura-teto-superior-e');
addBox(.65,.025,.035,.05,1.245,-.70,M.black,'moldura-teto-superior-d');

/* ================================================================
   TRAVAS / PARAFUSOS EXTERNOS E ETIQUETAS TÉCNICAS
   ================================================================ */
for(const s of [-1,1]){
  for(let i=0;i<14;i++){
    const x=-.90+i*.12;
    addBolt(x,.73,s*.965,s,'parafuso-porta-ext-'+s+'-'+i,.0042);
  }
  for(let i=0;i<12;i++){
    const x=.78+i*.10;
    addBolt(x,.67,s*.952,s,'parafuso-quartel-ext-'+s+'-'+i,.0042);
  }
}

/* ================================================================
   PORTA-MALAS / TRILHOS / BAGAGEIRO
   ================================================================ */
addBox(.75,.05,1.20,1.05,.30,0,M.carpet,'carpete-porta-malas');
addBox(.05,.05,.90,1.98,.35,0,M.dark,'trava-bagagem');
for(let i=0;i<16;i++){
  const z=-.55+i*.073;
  addBox(.025,.02,.06,.95,.33,z,M.seam2,'nervura-bagageiro-'+i);
}
for(const s of [-1,1]){
  addBox(.50,.05,.10,1.00,.36,s*.55,M.int,'forro-bagageiro-'+s);
  for(let i=0;i<8;i++){
    addBolt(.75+i*.07,.39,s*.60,s,'fixacao-forro-bagageiro-'+s+'-'+i,.004);
  }
}

/* ================================================================
   CHICOTE TRASEIRO / LUZES / SENSOR
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.55;
  for(let i=0;i<14;i++){
    addRod([1.35+i*.04,.50,z],[1.42+i*.04,.55,z+s*.08],.0035,
      i%3===0?M.wRed:M.wBlack,'chicote-lanterna-'+s+'-'+i,8);
  }
}
addBox(.12,.06,.22,1.96,.54,0,M.black,'modulo-radar-traseiro');
for(let i=0;i<5;i++){
  addBox(.018,.02,.025,1.90+i*.025,.57,0,M.chrome,'sensor-traseiro-'+i);
}

/* ================================================================
   DETALHES DE CARRO NORMAL — PNEUS, ETIQUETAS, SONS VISUAIS
   ================================================================ */
/* válvulas */
for(const x of [FAX,RAX]){
  for(const s of [-1,1]){
    addCylinder(.006,.035,x+.07,.67,s*(TRACK+.14),M.black,'valvula-pneu',0,0,Math.PI/2,10);
    addBox(.014,.006,.03,x+.12,.68,s*(TRACK+.145),M.chrome,'tampa-valvula');
  }
}
/* pesos adesivos */
for(const [x,label] of [[FAX,'F'],[RAX,'R']]){
  for(const s of [-1,1]){
    for(let i=0;i<4;i++){
      addBox(.018,.006,.045,x-.15+i*.05,.59,s*(TRACK+.135),M.alu,'peso-balanceamento-'+label+'-'+s+'-'+i);
    }
  }
}

/* ================================================================
   ESTRUTURA DE COLISÃO DIANTEIRA / LONGARINAS / TRAVESSA
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.48;
  addBox(1.05,.10,.10,-1.80,.32,z,M.steel,'longarina-impacto-F-'+s);
  addBox(.12,.28,.08,-2.08,.40,z,M.steel,'crash-box-F-'+s);
  addBolt(-2.08,.40,z,s,'crash-bolt-F-'+s,.008);
  addBox(.95,.08,.08,1.75,.32,z,M.steel,'longarina-impacto-R-'+s);
  addBox(.12,.26,.08,2.08,.40,z,M.steel,'crash-box-R-'+s);
  addBolt(2.08,.40,z,s,'crash-bolt-R-'+s,.008);
}
addBox(.08,.12,1.45,-2.18,.38,0,M.steel,'travessa-impacto-F');
addBox(.08,.12,1.35,2.18,.38,0,M.steel,'travessa-impacto-R');

/* ================================================================
   SENSORAMENTO / CÂMERAS / PARKING SENSORS
   ================================================================ */
for(const s of [-1,1]){
  for(let i=0;i<4;i++){
    addCylinder(.018,.025,2.25,.48,s*(.24+i*.16),M.black,'sensor-estacionamento-'+s+'-'+i,0,Math.PI/2,0,16);
  }
  for(let i=0;i<3;i++){
    addCylinder(.016,.022,-2.26,.45,s*(.28+i*.16),M.black,'sensor-frontal-'+s+'-'+i,0,Math.PI/2,0,16);
  }
}
addBox(.06,.03,.12,2.12,.66,0,M.dark,'camera-traseira');
addBox(.04,.025,.10,-2.18,.62,0,M.dark,'camera-frontal');

/* ================================================================
   PEÇAS DE FIXAÇÃO DE FARÓIS / LANTERNAS / PLACA
   ================================================================ */
for(const s of [-1,1]){
  for(let i=0;i<6;i++){
    addBolt(-2.255,.48+i*.035,s*(.45+.035*i),s,'fix-farol-'+s+'-'+i,.004);
    addBolt(2.255,.46+i*.035,s*(.45+.035*i),s,'fix-lanterna-'+s+'-'+i,.004);
  }
}
for(let i=0;i<8;i++){
  addBolt(2.27,.42,-.16+i*.045,(i%2?1:-1),'fix-placa-'+i,.004);
}

/* ================================================================
   DENSIDADE EXTRA: PRESILHAS, GRAMPOS, REBITES E ARRUELAS
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.94;
  for(let i=0;i<90;i++){
    const x=-2.15+(i%30)*.14;
    const y=.28+Math.floor(i/30)*.10;
    addBox(.012,.018,.026,x,y,z,M.black,'grampo-carroceria-'+s+'-'+i);
  }
}
for(let i=0;i<40;i++){
  const x=-1.95+(i%20)*.20;
  const z=-.62+Math.floor(i/20)*1.24;
  addCylinder(.004,.010,x,.28,z,M.chrome,'arruela-subchassi-'+i,Math.PI/2,0,0,8);
}

/* ================================================================
   ACABAMENTO DAS JANELAS
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.80;
  addPanelStrip(-1.00,.82,z,-.78,1.10,z,.010,M.black,'borracha-vidro-A-'+s);
  addPanelStrip(-.78,1.10,z,-.52,1.18,z,.010,M.black,'borracha-vidro-teto-'+s);
  addPanelStrip(-.52,1.18,z,.17,1.18,z,.010,M.black,'borracha-vidro-teto2-'+s);
  addPanelStrip(.17,1.18,z,.50,1.08,z,.010,M.black,'borracha-vidro-C-'+s);
  addPanelStrip(.50,1.08,z,.69,.86,z,.010,M.black,'borracha-vidro-traseiro-'+s);
  for(let i=0;i<18;i++){
    const x=-.95+i*.10;
    addBox(.015,.012,.018,x,.79,z,M.chrome,'presilha-vidro-'+s+'-'+i);
  }
}

/* ================================================================
   DUTO DE AR / VENTS / DIFUSORES INTERIORES
   ================================================================ */
for(const s of [-1,1]){
  const z=s*.33;
  for(let i=0;i<8;i++){
    addBox(.06,.035,.10,-.74,.78,z+i*.02*s,M.black,'lamela-vent-'+s+'-'+i);
  }
}
for(let i=0;i<7;i++){
  addBox(.10,.025,.04,-.78,.74,-.22+i*.075,M.chrome,'comando-clima-'+i);
}

/* ================================================================
   CAIXA DE DIREÇÃO / PEDALEIRA / SUPORTES
   ================================================================ */
for(let i=0;i<12;i++){
  addBox(.018,.03,.08,-.88,.33,-.18+i*.03,M.steel,'suporte-pedaleira-'+i);
}
addBox(.13,.04,.28,-.88,.39,.10,M.black,'suporte-pedaleira-superior');
for(const [z,n] of [[.22,'acelerador'],[.08,'freio'],[-.06,'embreagem']]){
  addBox(.10,.025,.06,-.82,.38,z,M.alu,'pedal-alum-'+n);
}

/* ================================================================
   ESPUMA / ISOLAMENTO / ACABAMENTO DE PISO
   ================================================================ */
for(let i=0;i<18;i++){
  const x=-1.15+i*.10;
  addBox(.09,.025,1.15,x,.31,0,M.carpet,'painel-carpet-'+i);
}
for(const s of [-1,1]){
  for(let i=0;i<12;i++){
    addBox(.10,.025,.08,-1.0+i*.16,.34,s*.68,M.int,'acabamento-piso-lateral-'+s+'-'+i);
  }
}

/* ================================================================
   DETALHES DO TETO: FORRO, FIXADORES E LUZ INTERNA
   ================================================================ */
addBox(.10,.035,.16,.18,1.16,0,M.led,'luz-interna');
addBox(.07,.025,.12,.18,1.13,0,M.chrome,'moldura-luz-interna');
for(const s of [-1,1]){
  for(let i=0;i<10;i++){
    addBolt(-.65+i*.14,1.15,s*.66,s,'fix-forro-teto-'+s+'-'+i,.004);
  }
}

/* ================================================================
   ESPELHOS EXTERNOS REFINADOS
   ================================================================ */
for(const s of [-1,1]){
  const side=s>0?'e':'d';
  addBox(.06,.04,.12,-.66,.91,s*.86,M.body2,'base-retrovisor-'+side);
  addRod([-.66,.91,s*.89],[-.70,.93,s*.98],.009,M.dark,'braco-retrovisor-'+side,8);
  addBox(.11,.07,.16,-.73,.94,s*1.00,M.body,'carcaca-retrovisor-'+side);
  addBox(.02,.06,.13,-.74,.94,s*1.075,M.chrome,'espelho-retrovisor-'+side);
  addBox(.025,.025,.08,-.77,.90,s*1.03,M.turn,'seta-retrovisor-'+side);
}

/* ================================================================
   ETIQUETAS / PONTOS DE SERVIÇO / PEÇAS DO COFRE
   ================================================================ */
addBox(.16,.015,.08,-1.80,.89,.52,M.plate,'etiqueta-motor');
for(let i=0;i<6;i++){
  addBox(.012,.008,.05,-1.86+i*.025,.90,.52,M.black,'texto-etiqueta-'+i);
}
addBox(.14,.02,.10,-1.50,.88,-.52,M.plate,'etiqueta-bateria');
for(let i=0;i<5;i++){
  addBox(.01,.01,.05,-1.54+i*.02,.895,-.52,M.black,'texto-bateria-'+i);
}

/* ================================================================
   PONTOS DE MACACO / TRANSPORTE
   ================================================================ */
for(const x of [-1.60,1.55]){
  for(const s of [-1,1]){
    addBox(.10,.06,.08,x,.22,s*.82,M.steel,'ponto-macaco-'+x+'-'+s);
    addBox(.04,.04,.04,x,.27,s*.86,M.black,'borracha-ponto-macaco-'+x+'-'+s);
  }
}

/* ================================================================
   PROTEÇÕES DE RODA / PARALAMAS INTERNOS
   ================================================================ */
for(const [x,label] of [[FAX,'F'],[RAX,'R']]){
  for(const s of [-1,1]){
    for(let i=0;i<14;i++){
      const a=Math.PI*1.10+i*(Math.PI*.80/13);
      const xx=x+Math.cos(a)*(.42);
      const yy=.43+Math.sin(a)*(.42);
      addBox(.045,.025,.04,xx,yy,s*.91,M.black,'forro-caixa-roda-'+label+'-'+s+'-'+i);
    }
  }
}

/* ================================================================
   FIXAÇÕES DE ESCAPAMENTO / TUBO / CATALISADOR
   ================================================================ */
for(const s of [-1,1]){
  addBox(.16,.05,.10,-1.25,.21,s*.18,M.steel,'catalisador-suporte-'+s);
  addBox(.12,.05,.10,.95,.21,s*.30,M.steel,'silencioso-suporte-'+s);
  addRod([-.90,.21,s*.18],[-.70,.21,s*.18],.008,M.rubber,'coxim-escape-'+s,8);
  addRod([1.20,.21,s*.30],[1.38,.21,s*.35],.008,M.rubber,'coxim-escape-traseiro-'+s,8);
}

/* ================================================================
   MAIS FIXADORES E PORCAS — PARA DAR LEITURA MECÂNICA
   ================================================================ */
for(let i=0;i<120;i++){
  const x=-2.0+(i%40)*.10;
  const y=.20+Math.floor(i/40)*.09;
  const z=(i%2?-.78:.78);
  addCylinder(.006,.010,x,y,z,M.chrome,'fixador-mecanico-'+i,Math.PI/2,0,0,8);
}

/* ================================================================
   CONTROLES / INTERRUPTORES / BOTÕES
   ================================================================ */
for(let i=0;i<10;i++){
  addCylinder(.010,.025,-.77,.72,-.35+i*.075,M.chrome,'botao-painel-pequeno-'+i,Math.PI/2,0,0,12);
}
for(let i=0;i<6;i++){
  addBox(.05,.02,.035,-.62,.72,-.25+i*.10,M.led,'led-painel-'+i);
}

/* ================================================================
   FINAL: contador de peças
   ================================================================ */
const detailCount = scene.children.length;
console.log('Detalhamento adicional carregado:',detailCount,'objetos na cena');

/* ================================================================
   NOTA DE MODELAGEM
   ---------------------------------------------------------------
   A carroceria principal continua sendo governada pela geometria
   da planta. O detalhamento usa apenas pequenas peças subordinadas
   a essa geometria. Isso é proposital para evitar o erro das
   versões anteriores, em que peças de acabamento alteravam a
   silhueta geral e criavam extensões irreais.
   ================================================================ */


/* ================================================================
   DETALHAMENTO FINAL — COMPONENTES DE UM CARRO REAL
   ================================================================ */
/*
  Estes grupos fecham as lacunas que normalmente ficam invisíveis
  num modelo externo: reguladores dos vidros, colunas de direção,
  caixas elétricas, isolamento acústico, fechos, suportes e pequenos
  itens de montagem. São deliberadamente discretos e permanecem
  dentro do envelope da carroceria definido pela planta.
*/

/* ---------- REGULADORES DE VIDRO ---------- */
for(const s of [-1,1]){
  const side=s>0?'E':'D', z=s*.90;
  addRod([-.78,.78,z],[-.25,.83,z],.008,M.steel,'regulador-vidro-'+side,8);
  addRod([-.25,.83,z],[.42,.78,z],.008,M.steel,'regulador-vidro-2-'+side,8);
  addBox(.05,.05,.08,-.78,.78,z,M.steel,'roldana-vidro-'+side);
  addBox(.05,.05,.08,.42,.78,z,M.steel,'roldana-vidro-2-'+side);
  addCylinder(.025,.025,-.10,.81,z,M.black,'motor-vidro-'+side,Math.PI/2,0,0,20);
  for(let i=0;i<12;i++){
    const x=-.75+i*.10;
    addBox(.012,.018,.05,x,.74,z,M.steel,'guia-vidro-'+side+'-'+i);
  }
}

/* ---------- TRAVAS DE PORTA / CABOS ---------- */
for(const s of [-1,1]){
  const side=s>0?'E':'D', z=s*.91;
  for(let i=0;i<6;i++){
    addRod([.35+i*.06,.63,z],[.40+i*.06,.66,z+s*.02],.004,M.steel,'cabo-trava-'+side+'-'+i,8);
  }
  addBox(.08,.08,.05,.52,.65,z,M.steel,'fechadura-porta-'+side);
  addBox(.04,.08,.04,.58,.64,z,M.black,'microswitch-porta-'+side);
  addBox(.04,.05,.04,.64,.64,z,M.chrome,'gancho-fechadura-'+side);
}

/* ---------- PEDALIER E SERVOFREIO ---------- */
addBox(.24,.22,.25,-.92,.58,.22,M.eng,'servofreio');
addBox(.08,.18,.22,-.78,.65,.22,M.black,'cilindro-mestre');
for(let i=0;i<6;i++){
  addRod([-.74,.70,.14+i*.03],[-.54,.62,.14+i*.03],.004,M.copper,'tubo-mestre-'+i,8);
}
for(const z of [.25,.10,-.05]){
  addBox(.11,.025,.08,-.83,.40,z,M.alu,'pedaleira-pedal-'+z);
  addRod([-.87,.40,z],[-.87,.56,z],.008,M.steel,'haste-pedal-'+z,8);
}

/* ---------- CAIXA DE AR / FILTRO DE CABINE ---------- */
addBox(.30,.18,.45,-.80,.42,0,M.int,'caixa-filtro-cabine');
addBox(.18,.10,.36,-.80,.53,0,M.black,'filtro-cabine');
for(let i=0;i<12;i++){
  addBox(.01,.07,.32,-.88+i*.016,.53,0,M.alu,'aleta-filtro-cabine-'+i);
}
addRod([-.65,.49,.18],[-.55,.60,.38],.012,M.hose,'duto-cabine-E');
addRod([-.65,.49,-.18],[-.55,.60,-.38],.012,M.hose,'duto-cabine-D');

/* ---------- BOMBA / RESERVATÓRIO DE COMBUSTÍVEL ---------- */
addCylinder(.10,.22,.90,.31,.0,M.eng,'bomba-combustivel',Math.PI/2,0,0,28);
addBox(.08,.08,.24,.90,.50,.0,M.black,'flange-bomba-combustivel');
for(let i=0;i<10;i++){
  const a=i*Math.PI*2/10;
  addBolt(.90+Math.cos(a)*.14,.50,Math.sin(a)*.14, i%2?1:-1,'parafuso-bomba-'+i,.004);
}

/* ---------- DIFERENCIAL E SEMIEIXOS DETALHADOS ---------- */
addCylinder(.18,.24,1.165,.33,0,M.eng,'carcaca-diferencial',Math.PI/2,0,0,32);
addBox(.14,.12,.42,1.165,.34,0,M.steel,'tampa-diferencial');
for(const s of [-1,1]){
  addRod([1.165,.34,s*.10],[1.165,.34,s*.58],.025,M.steel,'semi-eixo-detalhado-'+s,12);
  addCylinder(.055,.03,1.165,.34,s*.60,M.rubber,'coifa-homocinetica-'+s,Math.PI/2,0,0,24);
  for(let i=0;i<8;i++){
    addBox(.02,.02,.015,1.165,.34,s*(.50+i*.018),M.steel,'abraçadeira-coifa-'+s+'-'+i);
  }
}

/* ---------- CARDÃ: CRUZETAS E SUPORTES ---------- */
addRod([-.75,.26,0],[.20,.26,0],.035,M.steel,'carda-eixo-1',12);
addRod([.20,.26,0],[1.10,.26,0],.035,M.steel,'carda-eixo-2',12);
for(const x of [-.70,.20,.95]){
  addCylinder(.065,.03,x,.26,0,M.steel,'cruzeta-cardã-'+x,Math.PI/2,0,0,16);
  addBox(.10,.06,.06,x,.22,0,M.rubber,'mancal-cardã-'+x);
}

/* ---------- TORRES / COXINS DE AMORTECEDOR ---------- */
for(const [x,n] of [[FAX,'F'],[RAX,'R']]){
  for(const s of [-1,1]){
    const z=s*.67;
    addBox(.18,.08,.18,x,.76,z,M.steel,'torre-amortecedor-'+n+'-'+s);
    addCylinder(.055,.035,x,.82,z,M.chrome,'porca-torre-'+n+'-'+s,0,0,0,20);
    for(let i=0;i<6;i++){
      const a=i*Math.PI*2/6;
      addBolt(x+Math.cos(a)*.07,.81,z+Math.sin(a)*.07,s,'parafuso-torre-'+n+'-'+s+'-'+i,.004);
    }
  }
}

/* ---------- BARRA ANTI-INTRUSÃO DAS PORTAS ---------- */
for(const s of [-1,1]){
  const z=s*.91;
  addRod([-.70,.53,z],[.55,.58,z],.018,M.steel,'barra-anti-intrusao-'+s,10);
  addRod([-.60,.60,z],[.45,.62,z],.014,M.steel,'barra-reforco-porta-'+s,10);
  for(let i=0;i<9;i++){
    addBox(.025,.025,.06,-.60+i*.12,.56,z,M.steel,'suporte-barra-porta-'+s+'-'+i);
  }
}

/* ---------- COLUNA B / C E REFORÇO DO TETO ---------- */
for(const s of [-1,1]){
  const z=s*.79;
  for(let i=0;i<8;i++){
    addBox(.035,.06,.05,-.12+i*.06,1.12,z,M.steel,'reforco-teto-'+s+'-'+i);
  }
  addRod([-.10,.98,z],[-.02,1.16,z],.013,M.steel,'reforco-B-'+s,8);
  addRod([.38,.90,z],[.48,1.09,z],.013,M.steel,'reforco-C-'+s,8);
}

/* ---------- VEDAÇÕES DE CAPÔ / PORTAS / PORTA-MALAS ---------- */
for(let i=0;i<40;i++){
  const x=-2.0+i*.10;
  addBox(.075,.018,.014,x,.57,.70,M.rubber,'borracha-capô-'+i);
  addBox(.075,.018,.014,x,.57,-.70,M.rubber,'borracha-capô-d-'+i);
}
for(let i=0;i<24;i++){
  const x=.70+i*.06;
  addBox(.05,.018,.014,x,.74,.73,M.rubber,'borracha-portamalas-'+i);
}

/* ---------- FECHAMENTO DO PAINEL TRASEIRO ---------- */
for(const s of [-1,1]){
  const z=s*.80;
  for(let i=0;i<13;i++){
    const y=.38+i*.025;
    addBox(.03,.018,.04,2.13,y,z,M.steel,'reforco-traseiro-'+s+'-'+i);
  }
}

/* ---------- SUPORTES DE PARA-CHOQUE ---------- */
for(const end of [-1,1]){
  const x=end<0?FRONT:REAR;
  for(const s of [-1,1]){
    const z=s*.55;
    addBox(.15,.10,.08,x + end*.03,.39,z,M.steel,'suporte-parachoque-'+end+'-'+s);
    addBox(.07,.12,.06,x + end*.09,.43,z,M.rubber,'absorvedor-parachoque-'+end+'-'+s);
    addBolt(x + end*.10,.46,z,s,'parafuso-parachoque-'+end+'-'+s,.006);
  }
}

/* ---------- PROTEÇÃO INFERIOR DAS CAIXAS DE RODA ---------- */
for(const [x,n] of [[FAX,'F'],[RAX,'R']]){
  for(const s of [-1,1]){
    const z=s*.76;
    for(let i=0;i<18;i++){
      const a=Math.PI*1.0+i*(Math.PI*.9/17);
      const xx=x+Math.cos(a)*.40;
      const yy=.43+Math.sin(a)*.40;
      addBox(.028,.02,.06,xx,yy,z,M.black,'protecao-caixa-'+n+'-'+s+'-'+i);
    }
  }
}

/* ---------- SUPORTE DO RADIADOR / CONDENSADOR DO AR ---------- */
addBox(.04,.34,1.28,-2.02,.58,0,M.steel,'condensador-ar');
for(let i=0;i<35;i++){
  const z=-.58+i*.034;
  addBox(.012,.26,.010,-2.025,.58,z,M.alu,'aleta-condensador-'+i);
}
for(const s of [-1,1]){
  addRod([-2.00,.65,s*.48],[-1.85,.66,s*.38],.014,M.hose,'linha-arcond-'+s);
}

/* ---------- BOCA DE ABASTECIMENTO / RESPIRO ---------- */
addRod([1.15,.70,-.92],[1.15,.85,-.72],.012,M.hose,'respiro-tanque',8);
addBox(.05,.06,.05,1.15,.83,-.72,M.black,'valvula-respiro-tanque');

/* ---------- BOCAL DE ÓLEO / VARETA ---------- */
addCylinder(.025,.10,-1.56,.90,.08,M.black,'bocal-oleo',0,0,0,16);
addCylinder(.012,.28,-1.52,.72,.08,M.wYellow,'vareta-oleo',0,0,0,12);
addBox(.04,.035,.05,-1.52,.87,.08,M.wYellow,'pegador-vareta');

/* ---------- FILTRO DE ÓLEO / ALTERNADOR / MOTOR DE ARRANQUE ---------- */
addCylinder(.055,.10,-1.62,.48,.32,M.steel,'filtro-oleo',Math.PI/2,0,0,24);
addCylinder(.10,.08,-1.98,.48,-.30,M.engCov,'alternador',Math.PI/2,0,0,28);
for(let i=0;i<10;i++){
  const a=i*Math.PI*2/10;
  addBox(.012,.05,.06,-1.98+Math.cos(a)*.07,.48-.04*Math.sin(a),-.30,M.alu,'aleta-alternador-'+i);
}
addCylinder(.065,.20,-1.48,.47,-.30,M.eng,'motor-arranque',0,0,0,24);

/* ---------- CORREIAS / POLIAS MAIS COMPLETAS ---------- */
for(let i=0;i<5;i++){
  addCylinder(.025+i*.008,.025,-2.05+i*.07,.50,.30,M.steel,'polia-acessorio-'+i,Math.PI/2,0,0,24);
}
for(let i=0;i<16;i++){
  const x=-2.15+i*.04;
  addBox(.025,.012,.012,x,.56,.30,M.black,'dente-correia-'+i);
}

/* ---------- SISTEMA DE ARREFECIMENTO / RESERVATÓRIO ---------- */
addBox(.18,.22,.14,-1.30,.72,.62,M.lens,'reservatorio-expansao');
addBox(.10,.025,.08,-1.30,.84,.62,M.black,'tampa-expansao');
addRod([-1.32,.73,.62],[-1.70,.60,.48],.010,M.hose,'mangueira-expansao-1');
addRod([-1.25,.69,.62],[-1.70,.55,.42],.010,M.hose,'mangueira-expansao-2');

/* ---------- MÓDULO ECU / CAIXA ELETRÔNICA ---------- */
addBox(.24,.14,.28,-1.30,.63,-.62,M.engCov,'ecu');
for(let i=0;i<12;i++){
  addBox(.015,.04,.04,-1.40+i*.018,.71,-.62,i%2?M.wBlue:M.wBlack,'pino-ecu-'+i);
}
for(let i=0;i<10;i++){
  addRod([-1.38,.66,-.62],[-1.15,.72,-.62],.0035,i%2?M.wRed:M.wYellow,'fio-ecu-'+i,8);
}

/* ---------- SENSORES DE MOTOR ---------- */
for(const [x,y,z,n] of [
  [-1.92,.72,.34,'temperatura'],[-1.75,.80,-.34,'pressao'],[-1.52,.84,.32,'map'],
  [-1.40,.84,-.32,'detonacao'],[-1.98,.43,0,'virabrequim']
]){
  addBox(.045,.035,.05,x,y,z,M.black,'sensor-'+n);
  addRod([x+.02,y,z],[x+.12,y+.03,z],.0035,M.wBlack,'sensor-'+n+'-fio',8);
}

/* ---------- INTERIOR: CINZEIRO / PORTA-COPOS / COMPARTIMENTOS ---------- */
addBox(.18,.04,.28,.38,.77,0,M.black,'porta-copos-base');
for(const z of [-.09,.09]){
  addCylinder(.055,.035,.38,.78,z,M.int,'porta-copos',0,0,0,24);
  addCylinder(.038,.04,.38,.80,z,M.black,'porta-copos-interno',0,0,0,24);
}
addBox(.24,.05,.16,.52,.75,0,M.int,'compartimento-console');
addBox(.18,.02,.12,.52,.78,0,M.black,'compartimento-tampa');

/* ---------- TETO: LUZES / MICROFONE / SENSORES ---------- */
addBox(.08,.025,.12,.20,1.17,.18,M.led,'luz-teto-1');
addBox(.08,.025,.12,.20,1.17,-.18,M.led,'luz-teto-2');
addBox(.025,.025,.04,.35,1.17,0,M.black,'microfone-teto');
addBox(.04,.025,.06,.35,1.17,.12,M.black,'sensor-teto');

/* ---------- PORTA-MALAS: FORRO / GANCHO / KIT DE FERRAMENTAS ---------- */
addBox(.36,.06,.50,1.42,.36,0,M.carpet,'forro-porta-malas');
addBox(.04,.08,.08,1.72,.40,.55,M.steel,'gancho-bagagem-1');
addBox(.04,.08,.08,1.72,.40,-.55,M.steel,'gancho-bagagem-2');
addBox(.28,.12,.30,1.60,.43,0,M.int,'caixa-ferramentas');
for(let i=0;i<8;i++) addBox(.012,.05,.20,1.49+i*.03,.50,0,M.chrome,'ferramenta-'+i);

/* ---------- SUPORTE DE PLACA / MOLDURA ---------- */
for(const end of [-1,1]){
  const x=end<0?FRONT+.02:REAR+.02;
  addBox(.03,.14,.50,x,.44,0,M.dark,'moldura-placa-'+end);
  for(const z of [-.18,.18]) addBolt(x,.44,z,end,'parafuso-placa-'+end+'-'+z,.006);
}

/* ---------- MICRO-PRESILHAS EM VÁRIAS ÁREAS ---------- */
for(let i=0;i<100;i++){
  const x=-2.0+(i%25)*.16;
  const y=.30+Math.floor(i/25)*.09;
  const z=(i%2?-.965:.965);
  addBox(.012,.012,.022,x,y,z,M.black,'presilha-extra-'+i);
}

/* ---------- SUPORTES E ARRUELAS DE TODAS AS ÁREAS ---------- */
for(let i=0;i<90;i++){
  const x=-1.95+(i%30)*.135;
  const y=.26+Math.floor(i/30)*.10;
  const z=(i%2?.82:-.82);
  addCylinder(.005,.009,x,y,z,M.chrome,'arruela-extra-'+i,Math.PI/2,0,0,8);
}

/* ---------- PEÇAS DE REPARO / SERVIÇO: MACACO E ESTEPE ---------- */
addBox(.28,.08,.18,1.36,.38,-.35,M.steel,'macaco-base');
addBox(.10,.35,.08,1.36,.55,-.35,M.steel,'macaco-haste');
for(let i=0;i<7;i++) addBox(.025,.025,.12,1.25+i*.035,.45,-.55,M.steel,'ferramenta-estepe-'+i);
addCylinder(.30,.10,1.45,.31,.0,M.rubber,'estepe',Math.PI/2,0,0,32);
addCylinder(.18,.12,1.45,.31,.0,M.rimDk,'aro-estepe',Math.PI/2,0,0,24);

/* ---------- ACABAMENTO FINAL: LOGOS, LETRAS E PEQUENOS EMBLEMAS ---------- */
for(const side of [-1,1]){
  addBox(.14,.025,.02,1.72,.70,side*.88,M.chrome,'emblema-lateral-'+side);
  addBox(.08,.02,.025,1.88,.68,side*.88,M.chrome,'insignia-lateral-'+side);
}

/* ---------- CONTADORES PARA DEBUG ---------- */
const allCarObjects = scene.children.length;
console.log('Modelo completo:',allCarObjects,'objetos visuais.');
console.log('Envelope dimensional: 4.480 m x 1.950 m x 1.250 m');
console.log('Eixos:',FAX,'m /',RAX,'m — distância',RAX-FAX,'m');

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos, target) {
  camera.position.set(pos[0], pos[1], pos[2]);
  controls.target.set(target[0], target[1], target[2]);
  controls.update();
}
document.getElementById('view3d').onclick    = () => setView([6.4, 2.1, 5.6], [0, 0.58, 0]);
document.getElementById('viewFront').onclick = () => setView([-7.6, 1.2, 0],  [0, 0.55, 0]);
document.getElementById('viewSide').onclick  = () => setView([0, 1.1, 8.2],    [0, 0.65, 0]);
document.getElementById('viewTop').onclick   = () => setView([0, 8.6, 0.01],   [0, 0.20, 0]);
document.getElementById('viewInterior').onclick = () => setView([-0.2, 1.5, 2.4], [-0.2, 0.85, 0]);
document.getElementById('viewEngine').onclick   = () => setView([-1.6, 1.4, 1.8], [-1.85, 0.6, 0]);

let shellMode = false;
document.getElementById('shell').onclick = () => {
  shellMode = !shellMode;
  M.body.color.set(shellMode ? 0xa0a8b0 : 0x707a84);
  M.body.metalness = shellMode ? 0.35 : 0.55;
  M.body.roughness = shellMode ? 0.55 : 0.32;
  document.getElementById('shell').textContent = shellMode ? 'Acabamento' : 'Carroceria';
};

/* ================================================================
   LOOP
   ================================================================ */
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});
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
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{position:fixed;left:18px;top:18px;z-index:5;color:#fff;background:rgba(8,10,14,.78);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;line-height:1.45;max-width:360px}
.hud b{font-size:16px}.hud small{opacity:.72}
.badge{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px}
.controls{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.86);color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer}
button:active{transform:translateY(1px)}
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
 <button id="shell">Carroceria</button>
</div>

<script type="importmap">
{ "imports": {
  "three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
}}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ========== DIMENSÕES ========== */
const BW = 1.90;
const HALF_BW = BW / 2;
const WHEEL_R = 0.34;
const Y0 = WHEEL_R;
const ARCH_R = 0.42;
const BOT = 0.22;
const FAX = -1.310;
const RAX = 1.165;
const TRACK = 0.79;

/* Tumblehome — topo mais estreito */
const TAPER_Y0 = 0.55;
const TAPER_Y1 = 1.25;
const TAPER_AMT = 0.18;
function taperScale(y) {
  const t = Math.max(0, Math.min(1, (y - TAPER_Y0) / (TAPER_Y1 - TAPER_Y0)));
  return 1 - t * TAPER_AMT;
}

/* Arcos das rodas */
const dyr = BOT - Y0;
const dxa = Math.sqrt(ARCH_R*ARCH_R - dyr*dyr);
const A0 = Math.atan2(dyr, dxa);
const A1 = Math.PI - A0;
const FA_RX = FAX + dxa;
const RA_RX = RAX + dxa;

/* ========== CENA ========== */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, 0.01, 100);
camera.position.set(6.2, 2.3, 5.6);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
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
controls.minDistance = 3;
controls.maxDistance = 14;
controls.target.set(0, 0.58, 0);
controls.maxPolarAngle = Math.PI * 0.495;

/* ========== LUZ ========== */
scene.add(new THREE.HemisphereLight(0xe8eef7, 0x20242b, 1.2));

const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 25;
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.bias = -0.0005;
scene.add(key);

const fill = new THREE.DirectionalLight(0x9db8ff, 0.75);
fill.position.set(6, 4, -6);
scene.add(fill);

const rimL = new THREE.DirectionalLight(0xffffff, 0.6);
rimL.position.set(0, 3, -8);
scene.add(rimL);

/* ========== CHÃO ========== */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 96),
  new THREE.MeshStandardMaterial({color:0x10141a, roughness:0.85, metalness:0.05})
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(14, 28, 0x242a33, 0x171b21);
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

/* ========== MATERIAIS ========== */
const bodyMat   = new THREE.MeshPhysicalMaterial({color:0x6b7680, metalness:0.55, roughness:0.32, clearcoat:0.75, clearcoatRoughness:0.14});
const darkMat   = new THREE.MeshStandardMaterial({color:0x0a0d11, metalness:0.4, roughness:0.5, side:THREE.DoubleSide});
const glassMat  = new THREE.MeshPhysicalMaterial({color:0x0a1420, metalness:0.35, roughness:0.06, transparent:true, opacity:0.96, side:THREE.DoubleSide});
const rubberMat = new THREE.MeshStandardMaterial({color:0x080808, roughness:0.78, metalness:0.03});
const rimMat    = new THREE.MeshStandardMaterial({color:0xb8bcc2, metalness:0.9, roughness:0.22});
const hubMat    = new THREE.MeshStandardMaterial({color:0x2a2e33, metalness:0.7, roughness:0.4});
const headMat   = new THREE.MeshPhysicalMaterial({color:0xdfe9ff, emissive:0xb0d0ff, emissiveIntensity:1.4, roughness:0.1, metalness:0.1});
const tailMat   = new THREE.MeshPhysicalMaterial({color:0x6a0000, emissive:0x900000, emissiveIntensity:1.8, roughness:0.2});

/* ========== SILHUETA ÚNICA ========== */
const shape = new THREE.Shape();

shape.moveTo(-2.24, BOT);
// Frente
shape.lineTo(-2.24, 0.50);
shape.lineTo(-2.18, 0.55);
// Capô
shape.lineTo(-1.95, 0.57);
shape.lineTo(-1.65, 0.60);
shape.lineTo(-1.35, 0.64);
shape.lineTo(-1.05, 0.69);
shape.lineTo(-0.85, 0.72);
// Para-brisa
shape.lineTo(-0.65, 0.86);
shape.lineTo(-0.42, 1.01);
shape.lineTo(-0.22, 1.13);
// Teto
shape.lineTo(-0.02, 1.20);
shape.lineTo(0.18, 1.24);
shape.lineTo(0.38, 1.25);
shape.lineTo(0.58, 1.22);
// Fastback
shape.lineTo(0.82, 1.14);
shape.lineTo(1.08, 1.02);
shape.lineTo(1.32, 0.90);
shape.lineTo(1.55, 0.83);
shape.lineTo(1.80, 0.78);
shape.lineTo(2.02, 0.74);
// Traseira
shape.lineTo(2.18, 0.66);
shape.lineTo(2.24, 0.56);
shape.lineTo(2.24, BOT);
// Fundo com arcos
shape.lineTo(RA_RX, BOT);
shape.absarc(RAX, Y0, ARCH_R, A0, A1, false);
shape.lineTo(FA_RX, BOT);
shape.absarc(FAX, Y0, ARCH_R, A0, A1, false);
shape.lineTo(-2.24, BOT);

const bodyGeom = new THREE.ExtrudeGeometry(shape, {
  depth: BW,
  bevelEnabled: false,
  curveSegments: 32
});
bodyGeom.translate(0, 0, -HALF_BW);

// Tumblehome (afina o topo)
const posAttr = bodyGeom.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
  const y = posAttr.getY(i);
  const z = posAttr.getZ(i);
  posAttr.setZ(i, z * taperScale(y));
}
bodyGeom.computeVertexNormals();

const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
scene.add(bodyMesh);

// Caps internos dos arcos
for (const x of [FAX, RAX]) {
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(ARCH_R * 0.97, 32),
    darkMat
  );
  cap.position.set(x, Y0, 0);
  scene.add(cap);
}

/* ========== JANELAS LATERAIS ========== */
const winShape = new THREE.Shape();
winShape.moveTo(-0.68, 0.80);
winShape.lineTo(-0.50, 0.90);
winShape.lineTo(-0.22, 1.08);
winShape.lineTo(0.02, 1.17);
winShape.lineTo(0.32, 1.19);
winShape.lineTo(0.58, 1.14);
winShape.lineTo(0.85, 1.02);
winShape.lineTo(1.10, 0.87);
winShape.lineTo(1.02, 0.82);
winShape.closePath();

const sideWinGeom = new THREE.ShapeGeometry(winShape);

for (const s of [-1, 1]) {
  const win = new THREE.Mesh(sideWinGeom, glassMat);
  win.position.z = s * (taperScale(0.98) * HALF_BW + 0.004);
  if (s < 0) win.scale.z = -1;
  win.renderOrder = 1;
  scene.add(win);
}

/* ========== PARA-BRISA E VIDRO TRASEIRO ========== */
function slopedGlass(x1, y1, x2, y2, mat) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const midY = (y1 + y2) / 2;
  const halfW = taperScale(midY) * HALF_BW - 0.03;

  const m = new THREE.Mesh(
    new THREE.BoxGeometry(len + 0.02, 0.015, halfW * 2),
    mat
  );
  m.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0);
  m.rotation.z = ang;
  m.castShadow = true;
  m.renderOrder = 1;
  return m;
}
scene.add(slopedGlass(-0.83, 0.74, -0.22, 1.13, glassMat));
scene.add(slopedGlass(0.58, 1.21, 1.30, 0.89, glassMat));

/* ========== RODAS ========== */
function makeWheel(x, z, side) {
  const g = new THREE.Group();
  g.position.set(x, Y0, z);

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.24, 36),
    rubberMat
  );
  tire.rotation.x = Math.PI/2;
  tire.castShadow = true;
  tire.receiveShadow = true;
  g.add(tire);

  const rimZ = side * 0.121;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R * 0.62, WHEEL_R * 0.62, 0.02, 32),
    rimMat
  );
  rim.rotation.x = Math.PI/2;
  rim.position.z = rimZ;
  g.add(rim);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R * 0.22, WHEEL_R * 0.22, 0.04, 24),
    hubMat
  );
  hub.rotation.x = Math.PI/2;
  hub.position.z = rimZ + side * 0.012;
  g.add(hub);

  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(WHEEL_R * 0.9, 0.05, 0.02),
      rimMat
    );
    spoke.rotation.z = i * Math.PI * 2 / 5;
    spoke.position.z = rimZ + side * 0.005;
    g.add(spoke);
  }
  scene.add(g);
}
makeWheel(FAX,  TRACK,  1);
makeWheel(FAX, -TRACK, -1);
makeWheel(RAX,  TRACK,  1);
makeWheel(RAX, -TRACK, -1);

/* ========== FRENTE ========== */
const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 1.05), darkMat);
grille.position.set(-2.245, 0.44, 0);
scene.add(grille);

for (const s of [-1, 1]) {
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.42), headMat);
  head.position.set(-2.245, 0.58, s * 0.60);
  scene.add(head);
}
for (const s of [-1, 1]) {
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.30), darkMat);
  intake.position.set(-2.245, 0.31, s * 0.55);
  scene.add(intake);
}

/* ========== TRASEIRA ========== */
const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 1.25), tailMat);
tailBar.position.set(2.245, 0.58, 0);
scene.add(tailBar);

const diff = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 1.05), darkMat);
diff.position.set(2.245, 0.30, 0);
scene.add(diff);

for (const s of [-1, 1]) {
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 14), hubMat);
  ex.rotation.z = Math.PI/2;
  ex.position.set(2.26, 0.30, s * 0.42);
  scene.add(ex);
}

/* ========== DETALHES ========== */
for (const s of [-1, 1]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.10), darkMat);
  arm.position.set(-0.62, 0.90, s * 0.80);
  scene.add(arm);

  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.14), bodyMat);
  mirror.position.set(-0.66, 0.90, s * 0.88);
  scene.add(mirror);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.022, 0.022), hubMat);
  handle.position.set(0.20, 0.72, s * (taperScale(0.72) * HALF_BW + 0.005));
  scene.add(handle);
}

/* ========== VISTAS ========== */
function setView(pos, target = [0, 0.58, 0]) {
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById('view3d').onclick    = () => setView([6.2, 2.3, 5.6], [0, 0.58, 0]);
document.getElementById('viewFront').onclick = () => setView([-7.5, 1.3, 0],  [0, 0.55, 0]);
document.getElementById('viewSide').onclick  = () => setView([0, 1.15, 8.0],   [0, 0.66, 0]);
document.getElementById('viewTop').onclick   = () => setView([0, 8.5, 0.01],   [0, 0.20, 0]);

let shellMode = false;
document.getElementById('shell').onclick = () => {
  shellMode = !shellMode;
  bodyMat.color.set(shellMode ? 0xa0a8b0 : 0x6b7680);
  bodyMat.metalness = shellMode ? 0.35 : 0.55;
  bodyMat.roughness = shellMode ? 0.55 : 0.32;
  document.getElementById('shell').textContent = shellMode ? 'Acabamento' : 'Carroceria';
};

/* ========== LOOP ========== */
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
  console.log('🟢 Servidor rodando na porta ' + PORT);
});
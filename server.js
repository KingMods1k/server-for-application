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
.hud{
 position:fixed;left:18px;top:18px;z-index:5;color:#fff;
 background:rgba(8,10,14,.78);border:1px solid rgba(255,255,255,.12);
 backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;
 line-height:1.45;max-width:360px
}
.hud b{font-size:16px}.hud small{opacity:.72}
.badge{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;
 background:rgba(255,255,255,.08);font-size:11px}
.controls{
 position:fixed;right:18px;bottom:18px;z-index:5;
 display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end
}
button{
 border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.86);
 color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer
}
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
 <br><br>
 Arraste para girar · roda do mouse para zoom
</div>

<div class="controls">
 <button id="view3d">3D</button>
 <button id="viewFront">Frente</button>
 <button id="viewSide">Lateral</button>
 <button id="viewTop">Superior</button>
 <button id="shell">Carroceria</button>
</div>

<script type="importmap">
{
 "imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
 }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ================================================================
   DIMENSÕES — baseadas na planta
   ================================================================
   comprimento: 4480 mm
   largura:     1950 mm
   altura:      1250 mm
   entre-eixos: 2475 mm
   balanço F:    930 mm
   balanço T:   1075 mm
*/
const W = 1.950;
const H = 1.250;

const FRONT_AXLE_X = -1.310;
const REAR_AXLE_X  =  1.165;
const TRACK_HALF   =  0.790;   // bitola 1580 mm

const WHEEL_R  = 0.365;
const WHEEL_Y  = 0.365;
const ARCH_R   = 0.440;
const ARCH_Y   = 0.365;
const BOTTOM_Y = 0.180;

// Pontos onde os arcos das rodas cruzam a base inferior
const dx = Math.sqrt(ARCH_R * ARCH_R - (BOTTOM_Y - ARCH_Y) ** 2);
const FA_RX = FRONT_AXLE_X + dx;
const FA_LX = FRONT_AXLE_X - dx;
const RA_RX = REAR_AXLE_X  + dx;
const RA_LX = REAR_AXLE_X  - dx;
const ARCH_ANG = Math.atan2(BOTTOM_Y - ARCH_Y, dx); // ângulo negativo

/* ================================================================
   CENA
   ================================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);
camera.position.set(5.8, 2.4, 5.8);

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
controls.dampingFactor = 0.07;
controls.minDistance = 3.0;
controls.maxDistance = 14;
controls.target.set(0, 0.62, 0);
controls.maxPolarAngle = Math.PI * 0.49;

/* ================================================================
   LUZ
   ================================================================ */
scene.add(new THREE.HemisphereLight(0xe8eef7, 0x20242b, 1.5));

const key = new THREE.DirectionalLight(0xffffff, 2.8);
key.position.set(-5, 8, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 25;
key.shadow.camera.left = -8;
key.shadow.camera.right = 8;
key.shadow.camera.top = 8;
key.shadow.camera.bottom = -8;
key.shadow.bias = -0.0005;
scene.add(key);

const fill = new THREE.DirectionalLight(0x9db8ff, 0.9);
fill.position.set(6, 4, -6);
scene.add(fill);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
rimLight.position.set(0, 3, -8);
scene.add(rimLight);

/* ================================================================
   CHÃO
   ================================================================ */
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 96),
  new THREE.MeshStandardMaterial({ color: 0x10141a, roughness: 0.85, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(14, 28, 0x242a33, 0x171b21);
grid.position.y = 0.001;
grid.material.transparent = true;
grid.material.opacity = 0.55;
scene.add(grid);

/* ================================================================
   MATERIAIS
   ================================================================ */
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0x6b7680, metalness: 0.6, roughness: 0.3,
  clearcoat: 0.8, clearcoatRoughness: 0.12
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x0a0d11, metalness: 0.4, roughness: 0.5, side: THREE.DoubleSide
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0a1420, metalness: 0.3, roughness: 0.08,
  transparent: true, opacity: 0.92, side: THREE.DoubleSide
});
const rubberMat = new THREE.MeshStandardMaterial({
  color: 0x080808, roughness: 0.75, metalness: 0.03
});
const rimMat = new THREE.MeshStandardMaterial({
  color: 0xb8bcc2, metalness: 0.9, roughness: 0.22
});
const hubMat = new THREE.MeshStandardMaterial({
  color: 0x2a2e33, metalness: 0.7, roughness: 0.4
});
const headMat = new THREE.MeshPhysicalMaterial({
  color: 0xd8e8ff, emissive: 0xa8c8ff, emissiveIntensity: 1.2,
  roughness: 0.1, metalness: 0.1
});
const tailMat = new THREE.MeshPhysicalMaterial({
  color: 0x6a0000, emissive: 0x8a0000, emissiveIntensity: 1.5, roughness: 0.2
});

/* ================================================================
   PERFIL LATERAL — corpo único com arcos de roda já embutidos
   ================================================================ */
function buildBodyShape() {
  const s = new THREE.Shape();

  // Base inferior, frente
  s.moveTo(-2.240, BOTTOM_Y);
  // Frente
  s.lineTo(-2.240, 0.460);
  s.lineTo(-2.150, 0.550);
  s.lineTo(-2.020, 0.590);
  // Capô
  s.lineTo(-1.650, 0.650);
  s.lineTo(-1.220, 0.700);
  s.lineTo(-0.900, 0.740);
  // Cowl
  s.lineTo(-0.780, 0.770);
  // Para-brisa
  s.lineTo(-0.480, 0.970);
  s.lineTo(-0.200, 1.140);
  // Teto
  s.lineTo(0.050, 1.225);
  s.lineTo(0.480, 1.250);
  s.lineTo(0.700, 1.220);
  // Vidro traseiro (fastback)
  s.lineTo(1.000, 1.060);
  s.lineTo(1.280, 0.900);
  // Tampa traseira
  s.lineTo(1.650, 0.800);
  s.lineTo(1.980, 0.720);
  s.lineTo(2.150, 0.640);
  s.lineTo(2.240, 0.500);
  s.lineTo(2.240, 0.220);
  // Base inferior, traseira -> frente
  s.lineTo(RA_RX, BOTTOM_Y);
  s.absarc(REAR_AXLE_X, ARCH_Y, ARCH_R, ARCH_ANG, Math.PI - ARCH_ANG, false);
  s.lineTo(FA_RX, BOTTOM_Y);
  s.absarc(FRONT_AXLE_X, ARCH_Y, ARCH_R, ARCH_ANG, Math.PI - ARCH_ANG, false);
  s.lineTo(-2.240, BOTTOM_Y);

  return s;
}

const bodyShape = buildBodyShape();
const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
  depth: W,
  bevelEnabled: false,
  curveSegments: 36
});
bodyGeom.translate(0, 0, -W / 2);
bodyGeom.computeVertexNormals();

const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
bodyMesh.name = 'carroceria';
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
scene.add(bodyMesh);

/* ================================================================
   PAREDES INTERNAS DOS ARCOS (para não ver através da carroceria)
   ================================================================ */
for (const x of [FRONT_AXLE_X, REAR_AXLE_X]) {
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(ARCH_R * 0.98, 28),
    darkMat
  );
  cap.position.set(x, ARCH_Y, 0);
  scene.add(cap);
}

/* ================================================================
   RODAS
   ================================================================ */
function makeWheel(x, z, side) {
  const g = new THREE.Group();
  g.position.set(x, WHEEL_Y, z);

  // Pneu
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.25, 36),
    rubberMat
  );
  tire.rotation.x = Math.PI / 2;
  tire.castShadow = true;
  tire.receiveShadow = true;
  g.add(tire);

  // Aro (face visível, voltada para fora)
  const rimZ = side * 0.127;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R * 0.62, WHEEL_R * 0.62, 0.02, 32),
    rimMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.z = rimZ;
  g.add(rim);

  // Cubo central
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R * 0.22, WHEEL_R * 0.22, 0.05, 24),
    hubMat
  );
  hub.rotation.x = Math.PI / 2;
  hub.position.z = rimZ + side * 0.012;
  g.add(hub);

  // 5 raios
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(WHEEL_R * 0.85, 0.05, 0.025),
      rimMat
    );
    spoke.rotation.z = a;
    spoke.position.z = rimZ + side * 0.006;
    g.add(spoke);
  }

  scene.add(g);
}

makeWheel(FRONT_AXLE_X,  TRACK_HALF,  1);
makeWheel(FRONT_AXLE_X, -TRACK_HALF, -1);
makeWheel(REAR_AXLE_X,   TRACK_HALF,  1);
makeWheel(REAR_AXLE_X,  -TRACK_HALF, -1);

/* ================================================================
   JANELAS LATERAIS
   ================================================================ */
const sideWinShape = new THREE.Shape();
sideWinShape.moveTo(-0.72, 0.82);
sideWinShape.lineTo(-0.17, 1.11);
sideWinShape.lineTo(0.06, 1.19);
sideWinShape.lineTo(0.54, 1.21);
sideWinShape.lineTo(0.66, 1.17);
sideWinShape.lineTo(0.94, 0.99);
sideWinShape.lineTo(1.06, 0.86);
sideWinShape.lineTo(1.03, 0.82);
sideWinShape.closePath();

const sideWinGeom = new THREE.ShapeGeometry(sideWinShape);

for (const s of [-1, 1]) {
  const win = new THREE.Mesh(sideWinGeom, glassMat);
  win.position.z = s * (W / 2 - 0.002);
  if (s < 0) win.scale.z = -1; // espelha
  scene.add(win);
}

/* ================================================================
   PARA-BRISA E VIDRO TRASEIRO — painéis inclinados
   ================================================================ */
function makeSlopedPanel(p1, p2, width, offset) {
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const len = Math.hypot(dx, dy);
  const tx = dx / len, ty = dy / len;
  const nx = -ty, ny = tx; // normal no plano XY

  const hw = width / 2;
  const positions = [
    p1[0] + nx * offset, p1[1] + ny * offset, -hw,
    p1[0] + nx * offset, p1[1] + ny * offset,  hw,
    p2[0] + nx * offset, p2[1] + ny * offset,  hw,
    p2[0] + nx * offset, p2[1] + ny * offset, -hw,
  ];

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

// Para-brisa (do cowl até o teto)
const wsGeom = makeSlopedPanel([-0.74, 0.79], [-0.17, 1.13], W - 0.06, 0.005);
scene.add(new THREE.Mesh(wsGeom, glassMat));

// Vidro traseiro (do teto até a tampa)
const rwGeom = makeSlopedPanel([0.72, 1.20], [1.24, 0.92], W - 0.06, 0.005);
scene.add(new THREE.Mesh(rwGeom, glassMat));

/* ================================================================
   FRENTE / TRASEIRA
   ================================================================ */
// Faróis
for (const s of [-1, 1]) {
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.13, 0.42), headMat);
  h.position.set(-2.20, 0.56, s * 0.62);
  scene.add(h);
}

// Lanternas
for (const s of [-1, 1]) {
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.15, 0.42), tailMat);
  t.position.set(2.20, 0.55, s * 0.62);
  scene.add(t);
}

// Grade frontal
const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 1.10), darkMat);
grille.position.set(-2.235, 0.42, 0);
scene.add(grille);

// Entradas de ar inferiores
for (const s of [-1, 1]) {
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.30), darkMat);
  intake.position.set(-2.230, 0.30, s * 0.55);
  scene.add(intake);
}

// Difusor traseiro
const diff = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 1.00), darkMat);
diff.position.set(2.230, 0.28, 0);
scene.add(diff);

// Escapamentos
for (const s of [-1, 1]) {
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 14), hubMat);
  ex.rotation.z = Math.PI / 2;
  ex.position.set(2.25, 0.28, s * 0.45);
  scene.add(ex);
}

/* ================================================================
   ESPELHOS RETROVISORES
   ================================================================ */
for (const s of [-1, 1]) {
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.03, 0.10), darkMat);
  arm.position.set(-0.68, 0.90, s * 0.98);
  scene.add(arm);

  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.18), bodyMat);
  mirror.position.set(-0.72, 0.90, s * 1.08);
  scene.add(mirror);
}

/* ================================================================
   PUXADORES DE PORTA
   ================================================================ */
for (const s of [-1, 1]) {
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), hubMat);
  handle.position.set(0.10, 0.68, s * (W / 2 + 0.005));
  scene.add(handle);
}

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos, target = [0, 0.62, 0]) {
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}

document.getElementById('view3d').onclick    = () => setView([5.8, 2.4, 5.8], [0, 0.62, 0]);
document.getElementById('viewFront').onclick = () => setView([-7.0, 1.4, 0],  [0, 0.55, 0]);
document.getElementById('viewSide').onclick  = () => setView([0, 1.3, 7.8],    [0, 0.70, 0]);
document.getElementById('viewTop').onclick   = () => setView([0, 8.5, 0.01],   [0, 0.20, 0]);

let shellMode = false;
document.getElementById('shell').onclick = () => {
  shellMode = !shellMode;
  bodyMat.color.set(shellMode ? 0x9aa1a8 : 0x6b7680);
  bodyMat.metalness = shellMode ? 0.45 : 0.6;
  bodyMat.roughness = shellMode ? 0.45 : 0.3;
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
  console.log('🟢 Servidor rodando na porta ' + PORT);
});
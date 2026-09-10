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

/* ================================================================
   DIMENSÕES (planta)
   ================================================================ */
const BW = 1.90;        // largura do corpo inferior
const CW = 1.58;        // largura da cabine (tumblehome)
const WR = 0.34;        // raio do pneu
const Y0 = WR;          // altura do eixo
const AR = 0.40;        // raio do arco da roda
const BOT = 0.14;       // fundo da carroceria

const FAX = -1.310;     // eixo dianteiro
const RAX =  1.165;     // eixo traseiro
const TRACK = 0.80;     // semi-bitola

// Interseção dos arcos com a linha inferior
const dyr = BOT - Y0;
const dxa = Math.sqrt(AR*AR - dyr*dyr);
const A0 = Math.atan2(dyr, dxa);
const A1 = Math.PI - A0;
const RAr = RAX + dxa, FAr = FAX + dxa;

/* ================================================================
   CENA
   ================================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, 0.01, 100);
camera.position.set(6.0, 2.2, 5.4);

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
controls.minDistance = 3.0;
controls.maxDistance = 14;
controls.target.set(0, 0.58, 0);
controls.maxPolarAngle = Math.PI * 0.495;

/* ================================================================
   LUZ
   ================================================================ */
scene.add(new THREE.HemisphereLight(0xe8eef7, 0x20242b, 1.15));

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

const rim = new THREE.DirectionalLight(0xffffff, 0.6);
rim.position.set(0, 3, -8);
scene.add(rim);

/* ================================================================
   CHÃO
   ================================================================ */
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

/* ================================================================
   MATERIAIS
   ================================================================ */
const bodyMat = new THREE.MeshPhysicalMaterial({
  color: 0x6b7680, metalness: 0.55, roughness: 0.32,
  clearcoat: 0.75, clearcoatRoughness: 0.14
});
const darkMat   = new THREE.MeshStandardMaterial({color:0x0a0d11, metalness:0.4, roughness:0.5, side:THREE.DoubleSide});
const glassMat  = new THREE.MeshPhysicalMaterial({color:0x0a1420, metalness:0.35, roughness:0.06, transparent:true, opacity:0.95, side:THREE.DoubleSide});
const rubberMat = new THREE.MeshStandardMaterial({color:0x080808, roughness:0.78, metalness:0.03});
const rimMat    = new THREE.MeshStandardMaterial({color:0xb8bcc2, metalness:0.9, roughness:0.22});
const hubMat    = new THREE.MeshStandardMaterial({color:0x2a2e33, metalness:0.7, roughness:0.4});
const headMat   = new THREE.MeshPhysicalMaterial({color:0xdfe9ff, emissive:0xb0d0ff, emissiveIntensity:1.4, roughness:0.1, metalness:0.1});
const tailMat   = new THREE.MeshPhysicalMaterial({color:0x6a0000, emissive:0x900000, emissiveIntensity:1.8, roughness:0.2});

/* ================================================================
   CORPO INFERIOR
   ================================================================ */
const bodyShape = new THREE.Shape();
bodyShape.moveTo(-2.24, BOT);
bodyShape.lineTo(-2.24, 0.42);          // frente
bodyShape.lineTo(-2.02, 0.50);          // topo do para-choque
bodyShape.lineTo(-1.70, 0.58);          // capô
bodyShape.lineTo(-1.25, 0.66);
bodyShape.lineTo(-0.88, 0.73);          // base do para-brisa
bodyShape.lineTo( 0.60, 0.78);          // linha de cintura
bodyShape.lineTo( 1.30, 0.82);
bodyShape.lineTo( 1.85, 0.86);          // ducktail
bodyShape.lineTo( 2.10, 0.82);
bodyShape.lineTo( 2.24, 0.62);          // traseira
bodyShape.lineTo( 2.24, BOT);
bodyShape.lineTo(RAr, BOT);
bodyShape.absarc(RAX, Y0, AR, A0, A1, false);
bodyShape.lineTo(FAr, BOT);
bodyShape.absarc(FAX, Y0, AR, A0, A1, false);
bodyShape.closePath();

const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
  depth: BW - 0.10,
  bevelEnabled: true,
  bevelSize: 0.05,
  bevelThickness: 0.05,
  bevelSegments: 3,
  curveSegments: 32
});
// normaliza largura e centraliza em Z
bodyGeom.computeBoundingBox();
const bbb = bodyGeom.boundingBox;
bodyGeom.scale(1, 1, BW / (bbb.max.z - bbb.min.z));
bodyGeom.computeBoundingBox();
const bb2 = bodyGeom.boundingBox;
bodyGeom.translate(0, 0, -(bb2.min.z + bb2.max.z)/2);

const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
scene.add(bodyMesh);

/* ================================================================
   CABINE — mais estreita, gera o tumblehome
   ================================================================ */
const cabinShape = new THREE.Shape();
cabinShape.moveTo(-0.88, 0.71);         // base do para-brisa (levemente abaixo da cintura)
cabinShape.lineTo(-0.60, 0.94);         // para-brisa
cabinShape.lineTo(-0.28, 1.16);
cabinShape.lineTo( 0.05, 1.24);         // pico do teto
cabinShape.lineTo( 0.38, 1.22);
cabinShape.lineTo( 0.78, 1.08);         // fastback
cabinShape.lineTo( 1.15, 0.92);
cabinShape.lineTo( 1.36, 0.83);         // base do vidro traseiro
cabinShape.lineTo( 1.28, 0.79);         // cintura traseira
cabinShape.closePath();

const cabinGeom = new THREE.ExtrudeGeometry(cabinShape, {
  depth: CW - 0.08,
  bevelEnabled: true,
  bevelSize: 0.04,
  bevelThickness: 0.04,
  bevelSegments: 3,
  curveSegments: 32
});
cabinGeom.computeBoundingBox();
const cbb = cabinGeom.boundingBox;
cabinGeom.scale(1, 1, CW / (cbb.max.z - cbb.min.z));
cabinGeom.computeBoundingBox();
const cb2 = cabinGeom.boundingBox;
cabinGeom.translate(0, 0, -(cb2.min.z + cb2.max.z)/2);

const cabinMesh = new THREE.Mesh(cabinGeom, bodyMat);
cabinMesh.castShadow = true;
cabinMesh.receiveShadow = true;
scene.add(cabinMesh);

/* ================================================================
   PAINÉIS INTERNOS DOS ARCOS (não ver oco)
   ================================================================ */
for (const x of [FAX, RAX]) {
  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(AR * 0.97, 32),
    darkMat
  );
  cap.position.set(x, Y0, 0);
  scene.add(cap);
}

/* ================================================================
   JANELAS LATERAIS
   ================================================================ */
const sw = new THREE.Shape();
sw.moveTo(-0.62, 0.82);
sw.lineTo(-0.48, 0.99);
sw.lineTo(-0.18, 1.13);
sw.lineTo( 0.15, 1.17);
sw.lineTo( 0.48, 1.12);
sw.lineTo( 0.82, 0.98);
sw.lineTo( 1.06, 0.86);
sw.lineTo( 0.98, 0.83);
sw.closePath();
const sideWinGeom = new THREE.ShapeGeometry(sw);

for (const s of [-1, 1]) {
  const win = new THREE.Mesh(sideWinGeom, glassMat);
  win.position.z = s * (CW/2 - 0.005);
  scene.add(win);
}

/* ================================================================
   PARA-BRISA E VIDRO TRASEIRO (painéis inclinados)
   ================================================================ */
function slopedPanel(x1, y1, x2, y2, width, mat) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.018, width),
    mat
  );
  m.position.set((x1 + x2)/2, (y1 + y2)/2, 0);
  m.rotation.z = ang;
  m.castShadow = true;
  return m;
}
scene.add(slopedPanel(-0.82, 0.76, -0.24, 1.14, CW - 0.12, glassMat));
scene.add(slopedPanel( 0.50, 1.19,  1.28, 0.87, CW - 0.12, glassMat));

/* ================================================================
   RODAS
   ================================================================ */
function makeWheel(x, z, side) {
  const g = new THREE.Group();
  g.position.set(x, Y0, z);

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(WR, WR, 0.24, 36),
    rubberMat
  );
  tire.rotation.x = Math.PI/2;
  tire.castShadow = true;
  tire.receiveShadow = true;
  g.add(tire);

  const rimZ = side * 0.121;
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(WR * 0.62, WR * 0.62, 0.02, 32),
    rimMat
  );
  rim.rotation.x = Math.PI/2;
  rim.position.z = rimZ;
  g.add(rim);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(WR * 0.22, WR * 0.22, 0.04, 24),
    hubMat
  );
  hub.rotation.x = Math.PI/2;
  hub.position.z = rimZ + side * 0.012;
  g.add(hub);

  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(WR * 0.9, 0.05, 0.02),
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

/* ================================================================
   FRENTE
   ================================================================ */
// Grade frontal escura
const grille = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 1.05), darkMat);
grille.position.set(-2.245, 0.45, 0);
scene.add(grille);

// Faróis angulares
for (const s of [-1, 1]) {
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.44), headMat);
  head.position.set(-2.235, 0.60, s * 0.62);
  scene.add(head);
}

// Entradas de ar inferiores
for (const s of [-1, 1]) {
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.32), darkMat);
  intake.position.set(-2.235, 0.32, s * 0.55);
  scene.add(intake);
}

/* ================================================================
   TRASEIRA
   ================================================================ */
// Barra de lanternas
const tailBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 1.20), tailMat);
tailBar.position.set(2.245, 0.60, 0);
scene.add(tailBar);

// Difusor
const diff = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 1.05), darkMat);
diff.position.set(2.245, 0.30, 0);
scene.add(diff);

// Escapamentos
for (const s of [-1, 1]) {
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 14), hubMat);
  ex.rotation.z = Math.PI/2;
  ex.position.set(2.26, 0.30, s * 0.45);
  scene.add(ex);
}

/* ================================================================
   DETALHES
   ================================================================ */
for (const s of [-1, 1]) {
  // retrovisor
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.10), darkMat);
  arm.position.set(-0.66, 0.90, s * 0.82);
  scene.add(arm);

  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.16), bodyMat);
  mirror.position.set(-0.70, 0.90, s * 0.90);
  scene.add(mirror);

  // puxador
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), hubMat);
  handle.position.set(0.20, 0.72, s * (BW/2 - 0.001));
  scene.add(handle);

  // saia lateral
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.06), darkMat);
  skirt.position.set(0.0, 0.17, s * (BW/2 - 0.02));
  scene.add(skirt);
}

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos, target = [0, 0.58, 0]) {
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById('view3d').onclick    = () => setView([6.0, 2.2, 5.4], [0, 0.58, 0]);
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
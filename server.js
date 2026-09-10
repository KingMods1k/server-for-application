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
const W = 1.950;
const WHEEL_R  = 0.340;
const WHEEL_Y  = WHEEL_R;
const ARCH_R   = 0.400;
const ARCH_Y   = WHEEL_Y;
const BOTTOM_Y = 0.200;

const FRONT_AXLE_X = -1.310;
const REAR_AXLE_X  =  1.165;
const TRACK_HALF   =  0.790;
const HALF_W = W / 2;

const dx = Math.sqrt(ARCH_R*ARCH_R - (BOTTOM_Y-ARCH_Y)**2);
const A_START = Math.atan2(BOTTOM_Y - ARCH_Y, dx);
const A_END   = Math.PI - A_START;

const FA_RX = FRONT_AXLE_X + dx;
const FA_LX = FRONT_AXLE_X - dx;
const RA_RX = REAR_AXLE_X  + dx;
const RA_LX = REAR_AXLE_X  - dx;

/* ================================================================
   CENA
   ================================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, 0.01, 100);
camera.position.set(6.2, 2.4, 5.6);

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
controls.target.set(0, 0.60, 0);
controls.maxPolarAngle = Math.PI * 0.495;

/* ================================================================
   LUZ
   ================================================================ */
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

const fill = new THREE.DirectionalLight(0x9db8ff, 0.7);
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
  clearcoat: 0.7, clearcoatRoughness: 0.15
});
const darkMat = new THREE.MeshStandardMaterial({
  color: 0x0a0d11, metalness: 0.4, roughness: 0.5
});
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0c1420, metalness: 0.3, roughness: 0.08,
  transparent: true, opacity: 0.94, side: THREE.DoubleSide
});
const rubberMat = new THREE.MeshStandardMaterial({color:0x080808, roughness:0.78, metalness:0.03});
const rimMat    = new THREE.MeshStandardMaterial({color:0xb8bcc2, metalness:0.9, roughness:0.22});
const hubMat    = new THREE.MeshStandardMaterial({color:0x2a2e33, metalness:0.7, roughness:0.4});
const headMat   = new THREE.MeshPhysicalMaterial({color:0xdfe9ff, emissive:0xb0d0ff, emissiveIntensity:1.5, roughness:0.1, metalness:0.1});
const tailMat   = new THREE.MeshPhysicalMaterial({color:0x6a0000, emissive:0x900000, emissiveIntensity:1.8, roughness:0.2});

/* ================================================================
   PERFIL LATERAL (silhueta real da carroceria)
   ================================================================ */
const bodyShape = new THREE.Shape();

bodyShape.moveTo(-2.240, BOTTOM_Y);      // frente inferior
bodyShape.lineTo(-2.240, 0.520);         // face frontal (quase reta)
bodyShape.lineTo(-2.180, 0.590);
bodyShape.lineTo(-1.900, 0.680);         // capô começa
bodyShape.lineTo(-1.500, 0.780);
bodyShape.lineTo(-1.150, 0.880);         // capô alto (cobre arco da roda)
bodyShape.lineTo(-0.850, 0.920);         // base do para-brisa
bodyShape.lineTo(-0.500, 1.050);         // para-brisa
bodyShape.lineTo(-0.150, 1.160);
bodyShape.lineTo( 0.100, 1.220);         // teto - frente
bodyShape.lineTo( 0.400, 1.250);         // teto - pico (altura total)
bodyShape.lineTo( 0.700, 1.200);         // teto - traseira
bodyShape.lineTo( 1.000, 1.080);         // vidro traseiro (fastback)
bodyShape.lineTo( 1.300, 0.920);
bodyShape.lineTo( 1.500, 0.870);         // tampa do porta-malas
bodyShape.lineTo( 1.850, 0.800);
bodyShape.lineTo( 2.050, 0.730);
bodyShape.lineTo( 2.180, 0.630);         // traseira
bodyShape.lineTo( 2.240, 0.520);
bodyShape.lineTo( 2.240, BOTTOM_Y);      // base traseira
bodyShape.lineTo(RA_RX, BOTTOM_Y);
bodyShape.absarc(REAR_AXLE_X, ARCH_Y, ARCH_R, A_START, A_END, false);
bodyShape.lineTo(FA_RX, BOTTOM_Y);
bodyShape.absarc(FRONT_AXLE_X, ARCH_Y, ARCH_R, A_START, A_END, false);
bodyShape.lineTo(-2.240, BOTTOM_Y);

const bodyGeom = new THREE.ExtrudeGeometry(bodyShape, {
  depth: W, bevelEnabled: false, curveSegments: 32
});
bodyGeom.translate(0, 0, -HALF_W);
bodyGeom.computeVertexNormals();

const body = new THREE.Mesh(bodyGeom, bodyMat);
body.castShadow = true;
body.receiveShadow = true;
scene.add(body);

/* ================================================================
   JANELAS LATERAIS
   ================================================================ */
const winShape = new THREE.Shape();
winShape.moveTo(-0.72, 0.90);
winShape.lineTo(-0.55, 0.96);
winShape.lineTo(-0.10, 1.14);
winShape.lineTo( 0.30, 1.19);
winShape.lineTo( 0.62, 1.14);
winShape.lineTo( 0.88, 0.98);
winShape.lineTo( 0.92, 0.90);
winShape.closePath();

const winGeom = new THREE.ShapeGeometry(winShape);

for (const s of [-1, 1]) {
  const win = new THREE.Mesh(winGeom, glassMat);
  win.position.z = s * (HALF_W + 0.002);
  win.renderOrder = 1;
  scene.add(win);
}

/* ================================================================
   PARA-BRISA + VIDRO TRASEIRO
   ================================================================ */
function tiltedPanel(x1,y1,x2,y2,width,mat){
  const dx = x2-x1, dy = y2-y1;
  const len = Math.hypot(dx,dy);
  const ang = Math.atan2(dy,dx);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(len, 0.018, width),
    mat
  );
  m.position.set((x1+x2)/2, (y1+y2)/2, 0);
  m.rotation.z = ang;
  m.castShadow = true;
  return m;
}

scene.add(tiltedPanel(-0.82, 0.930, -0.13, 1.155, W*0.86, glassMat));
scene.add(tiltedPanel( 0.66, 1.195,  1.34, 0.925, W*0.86, glassMat));

/* ================================================================
   RODAS
   ================================================================ */
function makeWheel(x, z, side){
  const g = new THREE.Group();
  g.position.set(x, WHEEL_Y, z);

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
    new THREE.CylinderGeometry(WHEEL_R*0.62, WHEEL_R*0.62, 0.02, 32),
    rimMat
  );
  rim.rotation.x = Math.PI/2;
  rim.position.z = rimZ;
  g.add(rim);

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL_R*0.22, WHEEL_R*0.22, 0.04, 24),
    hubMat
  );
  hub.rotation.x = Math.PI/2;
  hub.position.z = rimZ + side*0.012;
  g.add(hub);

  for (let i=0;i<5;i++){
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(WHEEL_R*0.9, 0.05, 0.02),
      rimMat
    );
    spoke.rotation.z = i * Math.PI*2/5;
    spoke.position.z = rimZ + side*0.005;
    g.add(spoke);
  }
  scene.add(g);
}
makeWheel(FRONT_AXLE_X,  TRACK_HALF,  1);
makeWheel(FRONT_AXLE_X, -TRACK_HALF, -1);
makeWheel(REAR_AXLE_X,   TRACK_HALF,  1);
makeWheel(REAR_AXLE_X,  -TRACK_HALF, -1);

/* ================================================================
   FRENTE / TRASEIRA
   ================================================================ */
// Grade frontal
const grille = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 1.05), darkMat);
grille.position.set(-2.245, 0.44, 0);
scene.add(grille);

// Faróis
for (const s of [-1,1]){
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.42), headMat);
  h.position.set(-2.245, 0.62, s*0.62);
  scene.add(h);
}

// Entradas inferiores
for (const s of [-1,1]){
  const intake = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 0.32), darkMat);
  intake.position.set(-2.245, 0.32, s*0.55);
  scene.add(intake);
}

// Lanternas traseiras
for (const s of [-1,1]){
  const t = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.42), tailMat);
  t.position.set(2.245, 0.57, s*0.62);
  scene.add(t);
}

// Difusor + escapamentos
const diff = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 1.00), darkMat);
diff.position.set(2.245, 0.30, 0);
scene.add(diff);

for (const s of [-1,1]){
  const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.10, 14), hubMat);
  ex.rotation.z = Math.PI/2;
  ex.position.set(2.260, 0.30, s*0.45);
  scene.add(ex);
}

/* ================================================================
   DETALHES
   ================================================================ */
for (const s of [-1,1]){
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.10), darkMat);
  arm.position.set(-0.70, 0.94, s*0.98);
  scene.add(arm);

  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.10, 0.16), bodyMat);
  mirror.position.set(-0.73, 0.94, s*1.06);
  scene.add(mirror);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.025), hubMat);
  handle.position.set(0.20, 0.78, s*(HALF_W+0.01));
  scene.add(handle);
}

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos, target=[0,0.60,0]){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById('view3d').onclick    = ()=>setView([6.2, 2.4, 5.6],[0,0.60,0]);
document.getElementById('viewFront').onclick = ()=>setView([-7.5, 1.3, 0],[0,0.55,0]);
document.getElementById('viewSide').onclick  = ()=>setView([0, 1.2, 8.0],[0,0.68,0]);
document.getElementById('viewTop').onclick   = ()=>setView([0, 8.5, 0.01],[0,0.20,0]);

let shellMode = false;
document.getElementById('shell').onclick = ()=>{
  shellMode = !shellMode;
  bodyMat.color.set(shellMode?0xa0a8b0:0x6b7680);
  bodyMat.metalness = shellMode?0.35:0.55;
  bodyMat.roughness = shellMode?0.55:0.32;
  document.getElementById('shell').textContent = shellMode?'Acabamento':'Carroceria';
};

/* ================================================================
   LOOP
   ================================================================ */
function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', ()=>{
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
</script>
</body>
</html>`);
});

app.listen(PORT, ()=>{
  console.log('🟢 Servidor rodando na porta '+PORT);
});
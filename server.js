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
<title>Carro 3D</title>
<style>
* { box-sizing: border-box; }
html, body {
    margin: 0; width: 100%; height: 100%; overflow: hidden;
    background: #090b0f; font-family: Arial, sans-serif;
}
#app { position: fixed; inset: 0; }
canvas { display: block; }
.hud {
    position: fixed; left: 18px; top: 18px; z-index: 5; color: white;
    background: rgba(8,10,14,.72); border: 1px solid rgba(255,255,255,.12);
    backdrop-filter: blur(12px); border-radius: 14px; padding: 14px 16px;
    line-height: 1.45; max-width: 330px;
}
.hud b { font-size: 16px; }
.hud small { opacity: .7; }
.controls {
    position: fixed; right: 18px; bottom: 18px; z-index: 5;
    display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end;
}
button {
    border: 1px solid rgba(255,255,255,.14); background: rgba(15,18,24,.82);
    color: white; border-radius: 10px; padding: 10px 12px; cursor: pointer;
}
.badge {
    display: inline-block; margin-top: 8px; padding: 4px 7px; border-radius: 6px;
    background: rgba(255,255,255,.08); font-size: 11px;
}
</style>
</head>
<body>

<div id="app"></div>

<div class="hud">
    <b>Modelo 3D — carroceria</b><br>
    <small>Perfil completo extraído do desenho técnico</small><br>
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
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
    }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
   PERFIL DO BLUEPRINT — pontos lidos direto do desenho técnico
   (4480 x 1950 x 1250mm, entre-eixos 2475mm, balanço dianteiro
   930mm, balanço traseiro 1075mm, bitola 1580mm). Cada linha
   abaixo corresponde a um ponto real do contorno: nariz, capô,
   base do pilar-A, subida do pilar-A, topo do para-brisa, teto,
   queda do vidro traseiro, porta-malas, para-choque traseiro.
   X em metros, centralizado no meio geométrico do carro.
   ============================================================ */

// x (m)         nariz   pchoq   capô1   capô2   eixoD   baseA   subeA   topoPB  teto1   teto2   fimTeto quedaVT baseVT  tampa   traseD  eixoT   pchoqT  pchoq2  ponta
const XS  = [-2.24, -2.09, -1.89, -1.54, -1.31, -1.19, -1.09, -0.96, -0.79, -0.34,  0.11,  0.31,  0.51,  0.66,  0.86, 1.165,  1.46,  1.96,  2.24];
const TOP = [ 0.52,  0.58,  0.68,  0.72,  0.73,  0.76,  0.98,  1.23,  1.25, 1.245,  1.20,  1.00,  0.79,  0.80,  0.74,  0.70,  0.65,  0.58,  0.53];
const HW  = [ 0.64,  0.70,  0.78,  0.85,  0.89,  0.90,  0.87,  0.83, 0.825, 0.825,  0.85,  0.90,  0.94,  0.95,  0.96, 0.975,  0.94,  0.78,  0.62];
const BOT = [ 0.32,  0.22,  0.17,  0.15,  0.15,  0.15,  0.15,  0.15,  0.15,  0.15,  0.15,  0.15,  0.15,  0.15,  0.16,  0.16,  0.18,  0.24,  0.32];

function interp(xs, vals, x) {
    if (x <= xs[0]) return vals[0];
    if (x >= xs[xs.length - 1]) return vals[vals.length - 1];
    for (let i = 0; i < xs.length - 1; i++) {
        if (x >= xs[i] && x <= xs[i + 1]) {
            const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
            return vals[i] + t * (vals[i + 1] - vals[i]);
        }
    }
    return vals[vals.length - 1];
}
const halfWidthAt = x => interp(XS, HW, x);
const topYAt      = x => interp(XS, TOP, x);

const NOSE_X = XS[0];
const TAIL_X = XS[XS.length - 1];
const FRONT_AXLE_X = NOSE_X + 0.93;
const REAR_AXLE_X  = FRONT_AXLE_X + 2.475;
const TRACK_HALF = 0.94; // levemente maior que a meia-largura do casco nos eixos, pra roda ficar exposta em vez de atrás da lataria
const MAX_HALF_WIDTH = Math.max(...HW);

/* CENA */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

/* CÂMERA */
const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);
camera.position.set(6.4, 3.0, 6.6);

/* RENDERER */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

/* CONTROLES */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 3.2;
controls.maxDistance = 12;
controls.target.set(0, 0.75, 0);

/* ILUMINAÇÃO */
scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x20242c, 2));
const key = new THREE.DirectionalLight(0xffffff, 3);
key.position.set(-4, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9db8ff, 1.2);
fill.position.set(5, 3, -5);
scene.add(fill);

/* CHÃO */
const floor = new THREE.Mesh(
    new THREE.CircleGeometry(12, 96),
    new THREE.MeshStandardMaterial({ color: 0x11151b, roughness: 0.82, metalness: 0.05 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 0.02;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(12, 24, 0x242a33, 0x171b21);
grid.position.y = 0.025;
scene.add(grid);

/* MATERIAIS */
const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x7c8791, metalness: 0.78, roughness: 0.24,
    clearcoat: 0.65, clearcoatRoughness: 0.16
});
const darkMat = new THREE.MeshStandardMaterial({ color: 0x090b0e, metalness: 0.25, roughness: 0.38 });
const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x101821, metalness: 0.15, roughness: 0.08,
    transmission: 0.08, transparent: true, opacity: 0.86, side: THREE.DoubleSide
});
const rubberMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.72, metalness: 0.05 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x9da4ad, metalness: 0.92, roughness: 0.18 });
const lampMat = new THREE.MeshPhysicalMaterial({
    color: 0xe9f5ff, emissive: 0xbad8ff, emissiveIntensity: 2.2, roughness: 0.12, metalness: 0.05
});
const redLampMat = new THREE.MeshPhysicalMaterial({
    color: 0x6b0000, emissive: 0x610000, emissiveIntensity: 2, roughness: 0.18
});

const car = new THREE.Group();
scene.add(car);

/* ============================================================
   CASCO — extrusão do contorno lateral real (XS/TOP/BOT), depois
   afunilado por vértice usando halfWidthAt(x). Uma superfície só,
   contínua, seguindo exatamente a curva do desenho técnico.
   ============================================================ */
const shape = new THREE.Shape();
shape.moveTo(XS[0], BOT[0]);
for (let i = 1; i < XS.length; i++) shape.lineTo(XS[i], BOT[i]);
shape.lineTo(XS[XS.length - 1], TOP[TOP.length - 1]);
for (let i = XS.length - 2; i >= 0; i--) shape.lineTo(XS[i], TOP[i]);
shape.lineTo(XS[0], BOT[0]);

const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: MAX_HALF_WIDTH * 2,
    bevelEnabled: false,
    curveSegments: 1
});
bodyGeo.translate(0, 0, -MAX_HALF_WIDTH);

const bp = bodyGeo.attributes.position;
for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i);
    const z = bp.getZ(i);
    bp.setZ(i, z * (halfWidthAt(x) / MAX_HALF_WIDTH));
}
bp.needsUpdate = true;
bodyGeo.computeVertexNormals();

const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
car.add(bodyMesh);

/* VIDROS — dois segmentos cada, seguindo a curva real do
   pilar-A (base -> subida -> topo) e do pilar-C (teto -> queda -> tampa) */
function slopedPanel(p1, p2, thickness, width, mat) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, thickness, width), mat);
    m.position.set((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, 0);
    m.rotation.z = angle;
    m.castShadow = true;
    car.add(m);
}

// para-brisa: base do pilar-A -> subida -> topo
slopedPanel([-1.19, 0.76], [-1.09, 0.98], 0.03, 1.50, glassMat);
slopedPanel([-1.09, 0.98], [-0.96, 1.23], 0.03, 1.48, glassMat);

// vidro traseiro: fim do teto -> queda -> base/tampa
slopedPanel([0.11, 1.20], [0.31, 1.00], 0.03, 1.45, glassMat);
slopedPanel([0.31, 1.00], [0.51, 0.79], 0.03, 1.42, glassMat);

// vidros laterais (entre pilar-A e pilar-C)
for (const z of [1, -1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.32, 0.02), glassMat);
    m.position.set(-0.35, 0.98, z * (halfWidthAt(-0.35) - 0.02));
    car.add(m);
}

/* RODAS */
const wheels = [];
function makeWheel(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0.37, z);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.26, 48), rubberMat);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    g.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.275, 32), rimMat);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.285, 20), darkMat);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);

    for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.20, 0.035), rimMat);
        spoke.position.z = 0.145;
        spoke.rotation.z = i * Math.PI * 2 / 5;
        g.add(spoke);
    }

    car.add(g);
    wheels.push(g);
}
makeWheel(FRONT_AXLE_X, TRACK_HALF);
makeWheel(FRONT_AXLE_X, -TRACK_HALF);
makeWheel(REAR_AXLE_X, TRACK_HALF);
makeWheel(REAR_AXLE_X, -TRACK_HALF);
// (arco de roda removido: na proporção do blueprint a folga entre pneu
// e carroceria é pequena demais e o arco furava o corpo)

/* GRADE, FARÓIS, LANTERNAS — posicionados com base na altura/largura
   real do casco naquele X, então ficam sempre dentro da superfície */
function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    car.add(m);
    return m;
}

// grade — saliente bem na ponta do nariz, grande o bastante pra sempre aparecer
box(0.12, 0.22, 0.55, darkMat, NOSE_X - 0.03, 0.42, 0);

// faróis — bloco grande, saliente na ponta do nariz (não mais colado na curva)
for (const s of [1, -1]) {
    box(0.10, 0.26, 0.40, lampMat, NOSE_X - 0.02, 0.60, s * 0.48);
}

// lanternas — mesma lógica, salientes na ponta da traseira
for (const s of [1, -1]) {
    box(0.10, 0.24, 0.36, redLampMat, TAIL_X + 0.02, 0.60, s * 0.46);
}

for (const z of [-0.42, 0.42]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 20), darkMat);
    ex.rotation.z = Math.PI / 2;
    ex.position.set(TAIL_X + 0.03, 0.32, z);
    car.add(ex);
}

for (const z of [-0.90, 0.90]) box(0.22, 0.03, 0.02, darkMat, -0.15, 0.80, z);

/* VISTAS */
function setView(pos, target) {
    camera.position.set(...pos);
    controls.target.set(...target);
    controls.update();
}
document.getElementById('view3d').onclick = () => setView([6.4, 3, 6.6], [0, .8, 0]);
document.getElementById('viewFront').onclick = () => setView([-6.3, 1.25, 0], [0, .75, 0]);
document.getElementById('viewSide').onclick = () => setView([0, 1.45, 7.2], [0, .8, 0]);
document.getElementById('viewTop').onclick = () => setView([0, 7.5, .01], [0, 0, 0]);

/* MODO CARROCERIA */
let shellMode = false;
document.getElementById('shell').onclick = () => {
    shellMode = !shellMode;
    bodyMat.color.set(shellMode ? 0x9aa1a8 : 0x7c8791);
    bodyMat.metalness = shellMode ? .48 : .78;
    bodyMat.roughness = shellMode ? .48 : .24;
    document.getElementById('shell').textContent = shellMode ? 'Acabamento' : 'Carroceria';
};

/* ANIMAÇÃO */
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

/* RESIZE */
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
    console.log(`🟢 Servidor rodando na porta ${PORT}`);
});

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
    <small>Perfil esculpido a partir do desenho técnico</small><br>
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
   PERFIL REAL DO BLUEPRINT (4480 x 1950 x 1250mm, entre-eixos
   2475mm). X em metros, centralizado no meio geométrico do carro
   (nariz = -2.24, traseira = +2.24). Esses pontos foram lidos
   direto do desenho técnico: altura do teto/capô/porta-malas e
   meia-largura em cada posição X.
   ============================================================ */

const NOSE_X = -2.24;
const TAIL_X =  2.24;
const FRONT_AXLE_X = NOSE_X + 0.93;
const REAR_AXLE_X  = FRONT_AXLE_X + 2.475;
const TRACK_HALF = 0.79;
const MAX_HALF_WIDTH = 0.975;

// meia-largura da carroceria em cada X (para-lamas mais largos,
// cabine mais estreita, afunilando no nariz/traseira)
const HW_XS  = [-2.24,-2.09,-1.89,-1.54,-1.31,-1.19,-1.09,-0.96,-0.79,-0.34, 0.11, 0.31, 0.51, 0.66, 0.86, 1.165, 1.46, 1.96, 2.24];
const HW_VAL = [ 0.64, 0.70, 0.78, 0.85, 0.89, 0.90, 0.87, 0.83, 0.825,0.825,0.85, 0.90, 0.94, 0.95, 0.96, 0.975, 0.94, 0.78, 0.62];

function halfWidthAt(x) {
    if (x <= HW_XS[0]) return HW_VAL[0];
    if (x >= HW_XS[HW_XS.length - 1]) return HW_VAL[HW_VAL.length - 1];
    for (let i = 0; i < HW_XS.length - 1; i++) {
        if (x >= HW_XS[i] && x <= HW_XS[i + 1]) {
            const t = (x - HW_XS[i]) / (HW_XS[i + 1] - HW_XS[i]);
            return HW_VAL[i] + t * (HW_VAL[i + 1] - HW_VAL[i]);
        }
    }
    return HW_VAL[HW_VAL.length - 1];
}

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
   CASCO ESCULPIDO — extrusão do perfil lateral (2D) seguida de
   um "afunilamento" por vértice, usando halfWidthAt(x). Isso dá
   uma superfície única e contínua (sem colagem de caixas soltas),
   com os para-lamas mais largos e a cabine mais estreita, exatamente
   como no desenho técnico.
   ============================================================ */
function buildLoftedBody(xs, topYs, bottomYs, material) {

    const shape = new THREE.Shape();
    shape.moveTo(xs[0], bottomYs[0]);
    for (let i = 1; i < xs.length; i++) shape.lineTo(xs[i], bottomYs[i]);
    shape.lineTo(xs[xs.length - 1], topYs[topYs.length - 1]);
    for (let i = xs.length - 2; i >= 0; i--) shape.lineTo(xs[i], topYs[i]);
    shape.lineTo(xs[0], bottomYs[0]);

    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: MAX_HALF_WIDTH * 2,
        bevelEnabled: false,
        curveSegments: 1
    });
    geometry.translate(0, 0, -MAX_HALF_WIDTH);

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const scale = halfWidthAt(x) / MAX_HALF_WIDTH;
        pos.setZ(i, z * scale);
    }
    pos.needsUpdate = true;
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    car.add(mesh);
    return mesh;
}

// carroceria inferior: para-choque a para-choque, teto "raso"
// (a cabine sobe de verdade só na peça separada abaixo)
const LOWER_XS  = [-2.24,-2.09,-1.89,-1.54,-1.31,-1.19,-1.09,-0.96,-0.79,-0.34, 0.11, 0.31, 0.51, 0.66, 0.86, 1.165, 1.46, 1.96, 2.24];
const LOWER_TOP = [ 0.52, 0.58, 0.68, 0.72, 0.73, 0.76, 0.78, 0.79, 0.79, 0.79, 0.78, 0.78, 0.79, 0.80, 0.74, 0.70,  0.65, 0.58, 0.53];
const LOWER_BOT = [ 0.32, 0.22, 0.17, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.16, 0.16,  0.18, 0.24, 0.32];
buildLoftedBody(LOWER_XS, LOWER_TOP, LOWER_BOT, bodyMat);

// cabine/teto: peça mais estreita, só entre o pilar-A e o pilar-C,
// pousada em cima da carroceria inferior
const CABIN_XS  = [-1.09, -0.96, -0.79, -0.34, 0.11, 0.31];
const CABIN_TOP = [ 0.98,  1.23,  1.24,  1.245,1.20, 1.00];
const CABIN_BOT = [ 0.77,  0.77,  0.77,  0.77, 0.77, 0.77];
buildLoftedBody(CABIN_XS, CABIN_TOP, CABIN_BOT, bodyMat);

/* pontos-chave para os vidros inclinados (encaixam no casco real) */
const P_COWL       = [-1.19, 0.76];
const P_ROOF_FRONT = [-0.79, 1.24];
const P_ROOF_REAR  = [ 0.11, 1.20];
const P_DECK       = [ 0.51, 0.79];

function slopedPanel(p1, p2, thickness, width, mat) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, thickness, width), mat);
    m.position.set(midX, midY, 0);
    m.rotation.z = angle;
    m.castShadow = true;
    car.add(m);
    return m;
}

slopedPanel(P_COWL, P_ROOF_FRONT, 0.03, 1.50, glassMat);  // para-brisa
slopedPanel(P_ROOF_REAR, P_DECK, 0.03, 1.45, glassMat);   // vidro traseiro

// vidros laterais, entre pilar-A e pilar-C
for (const z of [0.80, -0.80]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.10, 0.32, 0.02), glassMat);
    m.position.set(-0.35, 0.98, z);
    car.add(m);
}

/* RODAS */
const wheels = [];
function makeWheel(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0.34, z);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.22, 48), rubberMat);
    tire.rotation.x = Math.PI / 2;
    tire.castShadow = true;
    g.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.235, 32), rimMat);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.245, 20), darkMat);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);

    for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.18, 0.03), rimMat);
        spoke.position.z = 0.125;
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

/* ARCOS DE RODA */
function wheelArch(x, z) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.045, 12, 40, Math.PI), darkMat);
    torus.position.set(x, 0.50, z);
    torus.rotation.set(0, Math.PI / 2, 0);
    car.add(torus);
}
wheelArch(FRONT_AXLE_X, TRACK_HALF + 0.015);
wheelArch(FRONT_AXLE_X, -TRACK_HALF - 0.015);
wheelArch(REAR_AXLE_X, TRACK_HALF + 0.015);
wheelArch(REAR_AXLE_X, -TRACK_HALF - 0.015);

/* GRADE, FARÓIS, LANTERNAS, ESCAPAMENTOS, MAÇANETAS */
function box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    car.add(m);
    return m;
}
box(0.035, 0.20, 0.80, darkMat, NOSE_X + 0.06, 0.55, 0);
for (const z of [-0.53, 0.53]) box(0.035, 0.18, 0.34, lampMat, NOSE_X + 0.08, 0.68, z);
for (const z of [-0.56, 0.56]) box(0.04, 0.17, 0.30, redLampMat, TAIL_X - 0.06, 0.68, z);
for (const z of [-0.42, 0.42]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 20), darkMat);
    ex.rotation.z = Math.PI / 2;
    ex.position.set(TAIL_X - 0.05, 0.34, z);
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

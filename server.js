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
    <small>Proporções do desenho técnico de referência</small><br>
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

const NOSE_X   = -2.24;
const TAIL_X   =  2.24;
const FRONT_AXLE_X = NOSE_X + 0.93;
const REAR_AXLE_X  = FRONT_AXLE_X + 2.475;
const TRACK_HALF = 0.79;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);
camera.position.set(6.4, 3.0, 6.6);

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
controls.minDistance = 3.2;
controls.maxDistance = 12;
controls.target.set(0, 0.75, 0);

scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x20242c, 2));
const key = new THREE.DirectionalLight(0xffffff, 3);
key.position.set(-4, 7, 5);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9db8ff, 1.2);
fill.position.set(5, 3, -5);
scene.add(fill);

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

function box(w, h, d, mat, x, y, z, rz = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rz) m.rotation.z = rz;
    m.castShadow = true;
    m.receiveShadow = true;
    car.add(m);
    return m;
}

function slopedPanel(p1, p2, thickness, width, mat) {
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const midX = (p1[0] + p2[0]) / 2;
    const midY = (p1[1] + p2[1]) / 2;
    return box(len, thickness, width, mat, midX, midY, 0, angle);
}

box(3.80, 0.25, 1.86, bodyMat, 0.00, 0.425, 0);
box(0.35, 0.30, 1.55, bodyMat, -2.065, 0.45, 0);
box(0.35, 0.28, 1.48, bodyMat, 2.065, 0.46, 0);
box(1.00, 0.18, 1.82, bodyMat, -1.55, 0.64, 0);
box(1.10, 0.18, 1.78, bodyMat, 1.30, 0.64, 0);
box(1.25, 0.10, 1.62, bodyMat, -0.075, 1.19, 0);
box(1.20, 0.32, 0.02, glassMat, -0.08, 0.95, 0.815);
box(1.20, 0.32, 0.02, glassMat, -0.08, 0.95, -0.815);

const P_COWL       = [-1.05, 0.75];
const P_ROOF_FRONT = [-0.70, 1.19];
const P_ROOF_REAR  = [ 0.55, 1.19];
const P_DECK       = [ 0.75, 0.73];

slopedPanel(P_COWL, P_ROOF_FRONT, 0.03, 1.50, glassMat);
slopedPanel(P_ROOF_REAR, P_DECK, 0.03, 1.45, glassMat);

for (const z of [0.94, -0.94]) {
    box(1.55, 0.02, 0.015, darkMat, -0.10, 0.78, z);
}

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

box(0.035, 0.20, 0.80, darkMat, NOSE_X + 0.06, 0.55, 0);

for (const z of [-0.53, 0.53]) box(0.035, 0.18, 0.34, lampMat, NOSE_X + 0.08, 0.68, z);
for (const z of [-0.56, 0.56]) box(0.04, 0.17, 0.30, redLampMat, TAIL_X - 0.06, 0.68, z);

for (const z of [-0.42, 0.42]) {
    const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.16, 20), darkMat);
    ex.rotation.z = Math.PI / 2;
    ex.position.set(TAIL_X - 0.05, 0.34, z);
    car.add(ex);
}

for (const z of [-0.90, 0.90]) box(0.22, 0.03, 0.02, darkMat, -0.10, 0.80, z);

function setView(pos, target) {
    camera.position.set(...pos);
    controls.target.set(...target);
    controls.update();
}
document.getElementById('view3d').onclick = () => setView([6.4, 3, 6.6], [0, .8, 0]);
document.getElementById('viewFront').onclick = () => setView([-6.3, 1.25, 0], [0, .75, 0]);
document.getElementById('viewSide').onclick = () => setView([0, 1.45, 7.2], [0, .8, 0]);
document.getElementById('viewTop').onclick = () => setView([0, 7.5, .01], [0, 0, 0]);

let shellMode = false;
document.getElementById('shell').onclick = () => {
    shellMode = !shellMode;
    bodyMat.color.set(shellMode ? 0x9aa1a8 : 0x7c8791);
    bodyMat.metalness = shellMode ? .48 : .78;
    bodyMat.roughness = shellMode ? .48 : .24;
    document.getElementById('shell').textContent = shellMode ? 'Acabamento' : 'Carroceria';
};

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
    console.log(`🟢 Servidor rodando na porta ${PORT}`);
});

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = path.join(__dirname, 'carro_planta_3d.glb');

// Entrega o modelo 3D
app.get('/carro.planta.glb', (req, res) => {
    res.sendFile(MODEL, err => {
        if (err && !res.headersSent) res.status(err.statusCode || 404).send('Modelo 3D não encontrado.');
    });
});

// Visualizador 3D
app.get('/', (req, res) => {
    res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Carro 3D</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif}
#app{position:fixed;inset:0}
canvas{display:block;width:100%;height:100%}
.hud{position:fixed;left:18px;top:18px;z-index:5;color:#fff;background:rgba(8,10,14,.72);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;line-height:1.45;max-width:350px}
.hud b{font-size:16px}.hud small{opacity:.72}.badge{display:inline-block;margin-top:8px;margin-right:4px;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px}
.controls{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.84);color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer;font-size:13px}
button:active{transform:scale(.97)}
#loading{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;z-index:4;pointer-events:none}
#error{display:none;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10;color:#fff;background:#171a20;border:1px solid #333;border-radius:14px;padding:20px;max-width:90%;text-align:center}
</style>
</head>
<body>
<div id="app"></div>
<div id="loading">Carregando carro 3D...</div>
<div id="error"></div>
<div class="hud">
  <b>Modelo 3D — carroceria</b><br>
  <small>Modelo reconstruído a partir da planta técnica.</small><br>
  <span class="badge">4480 × 1950 × 1250 mm</span>
  <span class="badge">Entre-eixos: 2475 mm</span>
  <br><br>
  <small>Arraste para girar · pinça/scroll para zoom</small>
</div>
<div class="controls">
  <button id="view3d">3D</button>
  <button id="viewFront">Frente</button>
  <button id="viewRear">Traseira</button>
  <button id="viewSide">Lateral</button>
  <button id="viewTop">Superior</button>
  <button id="reset">Centralizar</button>
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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(35, innerWidth/innerHeight, 0.01, 100);
camera.position.set(6, 3.1, 6.2);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.minDistance = 2.2;
controls.maxDistance = 15;
controls.target.set(0, .65, 0);
controls.screenSpacePanning = true;

scene.add(new THREE.HemisphereLight(0xe8efff, 0x20242c, 2.2));

const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(-5, 7, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
scene.add(key);

const fill = new THREE.DirectionalLight(0xb9ceff, 1.3);
fill.position.set(5, 3, -5);
scene.add(fill);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(12, 96),
  new THREE.MeshStandardMaterial({color:0x11151b, roughness:.82, metalness:.05})
);
floor.rotation.x = -Math.PI/2;
floor.position.y = 0;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(12,24,0x242a33,0x171b21);
grid.position.y = .01;
scene.add(grid);

let car = null;
let defaultDistance = 6.2;

function frameCar(object){
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x,size.y,size.z);
  const distance = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov/2))) * 1.35;
  defaultDistance = Math.max(4.5, Math.min(distance, 9));
  controls.target.set(center.x, center.y, center.z);
  camera.position.set(center.x + defaultDistance, center.y + defaultDistance*.48, center.z + defaultDistance);
  camera.lookAt(center);
  controls.update();
}

const loader = new GLTFLoader();
loader.load(
  '/carro.planta.glb',
  gltf => {
    car = gltf.scene;
    car.traverse(obj => {
      if(obj.isMesh){
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
    scene.add(car);
    frameCar(car);
    document.getElementById('loading').style.display='none';
  },
  undefined,
  err => {
    console.error(err);
    document.getElementById('loading').style.display='none';
    const e=document.getElementById('error');
    e.style.display='block';
    e.innerHTML='<b>Não foi possível carregar o carro 3D.</b><br><br>Verifique se <code>carro_planta_3d.glb</code> está na mesma pasta do server.js.';
  }
);

function setView(position, target=[0,.65,0]){
  camera.position.set(...position);
  controls.target.set(...target);
  controls.update();
}

document.getElementById('view3d').onclick=()=>setView([6,3.1,6.2]);
document.getElementById('viewFront').onclick=()=>setView([-6.5,1.25,0]);
document.getElementById('viewRear').onclick=()=>setView([6.5,1.25,0]);
document.getElementById('viewSide').onclick=()=>setView([0,1.45,7]);
document.getElementById('viewTop').onclick=()=>setView([0,7.5,.01],[0,0,0]);
document.getElementById('reset').onclick=()=>{ if(car) frameCar(car); };

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log('🟢 Servidor rodando na porta ' + PORT);
  console.log('🚗 Modelo: /carro.planta.glb');
});

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
</style>
</head>
<body>
<div id="app"></div>
<div id="status" style="position:fixed;left:18px;top:145px;z-index:10;padding:10px 12px;border-radius:9px;background:rgba(0,0,0,.78);color:#fff;font:12px Arial">Inicializando 3D…</div>
<div class="hud">
 <b>Modelo 3D — carroceria em blocos</b><br>
 <small>Construção por volumes sólidos (blocos), seguindo as medidas exatas da planta técnica.</small><br>
 <span class="badge">4480 × 1950 × 1250 mm</span>
 <span class="badge">Entre-eixos: 2475 mm</span>
 <span class="badge">Bitola: 1580 mm</span>
 <br><br>Arraste para girar · roda do mouse para zoom
</div>
<div class="controls">
 <button id="view3d">3D</button>
 <button id="viewFront">Frente</button>
 <button id="viewSide">Lateral</button>
 <button id="viewTop">Superior</button>
 <button id="viewRear">Traseira</button>
</div>

<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"}}</script>
<script>window.addEventListener("error",e=>{const st=document.getElementById("status"); if(st) {st.style.background="#5b1515"; st.textContent="Erro 3D: "+(e.message||"falha");}}); window.addEventListener("unhandledrejection",e=>{const st=document.getElementById("status"); if(st) {st.style.background="#5b1515"; st.textContent="Erro 3D: "+String(e.reason||"falha");}});</script>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ================================================================
   MEDIDAS EXATAS DA PLANTA
   Comprimento: 4480mm | Largura: 1950mm | Altura: 1250mm
   Entre-eixos: 2475mm | Balanço dianteiro: 930mm | Balanço traseiro: 1075mm
   Bitola (eixo a eixo das rodas): 1580mm
   ================================================================ */
const LENGTH = 4.480;
const WIDTH = 1.950;
const HALF_W = WIDTH / 2;
const HEIGHT = 1.250;
const TRACK = 1.580;
const HALF_TRACK = TRACK / 2;
const WHEEL_R = 0.335;
const WHEEL_W = 0.235;

/* Origem X = centro do entre-eixos.
   Frente da carroceria em -2.240 (LENGTH/2), traseira em +2.240.
   Balanço dianteiro 930mm -> eixo dianteiro em -2.240+0.930 = -1.310
   Entre-eixos 2475mm -> eixo traseiro em -1.310+2.475 = 1.165
   Balanço traseiro 1075mm -> confere: 1.165+1.075 = 2.240 */
const FRONT_AXLE = -1.310;
const REAR_AXLE = 1.165;
const GROUND = WHEEL_R;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);
scene.fog = new THREE.Fog(0x090b0f, 12, 25);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);
camera.position.set(5.8, 2.35, 5.4);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.8;
controls.maxDistance = 12;
controls.target.set(0, 0.60, 0);
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xe8eef7, 0x20242b, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-4, 7, 5);
sun.castShadow = true;
scene.add(sun);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.65);
fillLight.position.set(4,3,-5);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14, 96),
  new THREE.MeshStandardMaterial({color:0x10141a, roughness:.86, metalness:.04})
);
floor.rotation.x = -Math.PI/2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(14, 28, 0x242a33, 0x171b21);
grid.material.transparent = true;
grid.material.opacity = .45;
scene.add(grid);

const M = {
  body: new THREE.MeshPhysicalMaterial({color:0x69747e, metalness:.58, roughness:.28, clearcoat:.8, clearcoatRoughness:.12}),
  body2: new THREE.MeshPhysicalMaterial({color:0x505a63, metalness:.52, roughness:.34}),
  glass: new THREE.MeshPhysicalMaterial({color:0x101923, metalness:.05, roughness:.16, transmission:.08, transparent:true, opacity:.92}),
  rubber: new THREE.MeshStandardMaterial({color:0x080a0d, roughness:.72, metalness:.05}),
  rim: new THREE.MeshStandardMaterial({color:0x8b949c, roughness:.22, metalness:.88}),
  lamp: new THREE.MeshStandardMaterial({color:0xdce8f2, roughness:.16, metalness:.3}),
  red: new THREE.MeshStandardMaterial({color:0x8e1116, roughness:.28, metalness:.15}),
  black: new THREE.MeshStandardMaterial({color:0x07090c, roughness:.55, metalness:.2})
};

const car = new THREE.Group();
car.name = 'CARRO_COMPLETO';
scene.add(car);
const shell = new THREE.Group();
shell.name = 'CARROCERIA_BLOCOS';
car.add(shell);
const wheels = new THREE.Group();
wheels.name = 'RODAS';
car.add(wheels);

function box(w,h,d,x,y,z,mat,name,parent=shell){
  const o = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  o.position.set(x,y,z);
  parent.add(o);
  return o;
}

/* ================================================================
   CARROCERIA EM BLOCOS — seguindo a silhueta da planta (vista lateral):
   capô baixo e longo, para-brisa inclinado, teto de coupé, vidro
   traseiro inclinado, traseira curta. Tudo construído com caixas
   empilhadas em degraus (estilo "em blocos"), sem curvas.
   ================================================================ */

/* Plataforma / soleira - base que une as rodas, rente ao chão */
box(4.10,.14,WIDTH-.10, 0.02,.18,0,M.body2,'plataforma');

/* Para-choque dianteiro e traseiro */
box(.18,.26,1.86,-2.16,.30,0,M.body2,'parachoque-dianteiro');
box(.18,.24,1.86, 2.16,.30,0,M.body2,'parachoque-traseiro');

/* Capô — bloco baixo e comprido na dianteira, degrau único */
box(1.55,.10,1.72,-1.44,.575,0,M.body,'capo');

/* Bloco de transição capô -> para-brisa (degrau) */
box(.22,.16,1.66,-.62,.665,0,M.body,'degrau-parabrisa');

/* Cabine — bloco central, mais alto, do para-brisa ao vidro traseiro */
box(2.10,.62,1.74,.30,.93,0,M.body,'cabine');

/* Teto — bloco estreito no topo da cabine */
box(1.30,.10,1.56,.22,1.29,0,M.body,'teto');

/* Bloco de transição cabine -> tampa traseira (degrau, vidro inclinado) */
box(.55,.36,1.68,1.42,1.00,0,M.body,'degrau-traseiro');

/* Tampa traseira — bloco baixo */
box(.85,.14,1.72,2.00,.69,0,M.body,'tampa-traseira');

/* Para-brisa — encaixado no degrau frontal da cabine, inclinado */
const wf = box(.05,.62,1.55,-.86,.96,0,M.glass,'para-brisa');
wf.rotation.z = -0.42;

/* Vidro traseiro — inclinado no degrau traseiro */
const rg = box(.05,.50,1.58,1.28,1.05,0,M.glass,'vidro-traseiro');
rg.rotation.z = 0.55;

/* Vidros laterais — nas duas laterais da cabine, entre capô e traseira */
for(const z of [-HALF_W+0.03, HALF_W-0.03]){
  box(1.55,.34,.04,.28,1.05,z,M.glass,'vidro-lateral');
}

/* Colunas (montantes) da cabine, nos quatro cantos do teto */
for(const z of [-HALF_W+0.05, HALF_W-0.05]){
  box(.09,.62,.09,-.62,.93,z,M.body2,'coluna-A');
  box(.09,.62,.09,1.22,.93,z,M.body2,'coluna-C');
}

/* Portas — linhas em relevo na lateral da cabine */
for(const z of [-HALF_W-0.005, HALF_W+0.005]){
  box(1.65,.02,.02,.22,.66,z,M.body2,'contorno-porta');
  box(.16,.05,.03,.35,.78,z,M.black,'macaneta');
}

/* Faróis dianteiros — blocos retangulares embutidos no para-choque */
for(const z of [-.66,.66]){
  box(.06,.16,.36,-2.24,.44,z,M.lamp,'farol');
}
/* Lanternas traseiras — blocos vermelhos */
for(const z of [-.66,.66]){
  box(.06,.16,.36,2.24,.44,z,M.red,'lanterna');
}

/* Caixas de roda — blocos vazados visuais (arcos simples em caixa) */
function wheelArchBlock(x,z){
  box(.72,.10,.10,x,.50,z,M.body2,'arco-roda');
}
wheelArchBlock(FRONT_AXLE,-HALF_W-.01); wheelArchBlock(FRONT_AXLE,HALF_W+.01);
wheelArchBlock(REAR_AXLE,-HALF_W-.01); wheelArchBlock(REAR_AXLE,HALF_W+.01);

/* Rodas — posicionadas na bitola real de 1580mm (eixo a eixo = 1.580,
   ou seja, ±HALF_TRACK a partir do centro) */
function wheel(x,z,side){
  const g = new THREE.Group();
  g.name = \`roda-\${side}-\${x<0?'dianteira':'traseira'}\`;
  g.position.set(x,GROUND,z);
  wheels.add(g);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R,WHEEL_R,WHEEL_W,24,1),M.rubber);
  tire.rotation.x = Math.PI/2;
  tire.castShadow=true; tire.receiveShadow=true; g.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.20,.20,.245,8,1),M.rim);
  rim.rotation.x = Math.PI/2; g.add(rim);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(.10,.10,.26),M.black);
  g.add(hub);
}
for(const z of [-HALF_TRACK,HALF_TRACK]){
  wheel(FRONT_AXLE,z,z<0?'esq':'dir');
  wheel(REAR_AXLE,z,z<0?'esq':'dir');
}

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos,target=[0,.60,0]){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById('view3d').onclick=()=>setView([5.8,2.35,5.4]);
document.getElementById('viewFront').onclick=()=>setView([-6.8,1.15,0],[0,.65,0]);
document.getElementById('viewSide').onclick=()=>setView([0,1.15,6.8],[0,.65,0]);
document.getElementById('viewTop').onclick=()=>setView([0,7.2,.01],[0,.45,0]);
document.getElementById('viewRear').onclick=()=>setView([6.8,1.15,0],[0,.65,0]);

document.getElementById('status').textContent='Modelo 3D carregado';

document.getElementById('view3d').click();
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene,camera);
}
animate();
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});

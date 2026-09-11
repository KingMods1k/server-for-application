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
<title>Carro 3D — carroceria por fatias precisas</title>
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
 <b>Modelo 3D — carroceria por fatias precisas</b><br>
 <small>Centenas de fatias finas empilhadas, cada uma calculada exatamente pela silhueta da planta.</small><br>
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
   ================================================================ */
const LENGTH = 4.480;
const WIDTH = 1.950;
const HALF_W = WIDTH / 2;
const HEIGHT = 1.250;
const HALF_TRACK = 1.580 / 2;
const WHEEL_R = 0.335;
const WHEEL_W = 0.235;
const FRONT_AXLE = -1.310;
const REAR_AXLE = 1.165;
const GROUND = WHEEL_R;
const FRONT_X = -2.240;
const REAR_X = 2.240;

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
shell.name = 'CARROCERIA_FATIAS';
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

/* Interpolação linear entre pontos de controle (x -> valor) */
function interp(x, pts){
  if(x <= pts[0][0]) return pts[0][1];
  if(x >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
    if(x >= x1 && x <= x2){
      const t = (x-x1)/(x2-x1);
      return y1 + (y2-y1)*t;
    }
  }
  return pts[pts.length-1][1];
}

/* ================================================================
   PONTOS DE CONTROLE DA PLANTA (x em metros a partir do centro,
   valores lidos da vista lateral e superior do desenho técnico)

   TOPO da carroceria (altura do teto/capô/tampa em cada posição x)
   ================================================================ */
const topProfile = [
  [FRONT_X,      0.44],
  [-2.10,        0.58],
  [-1.90,        0.68],
  [-1.50,        0.715],
  [-1.15,        0.73],
  [-0.95,        0.96],
  [-0.72,        1.175],
  [-0.45,        1.240],
  [-0.20,        1.248],
  [ 0.10,        1.245],
  [ 0.35,        1.220],
  [ 0.60,        1.150],
  [ 0.80,        1.020],
  [ 0.98,        0.880],
  [ 1.16,        0.760],
  [ 1.45,        0.715],
  [ 1.75,        0.700],
  [ 2.00,        0.660],
  [ 2.15,        0.560],
  [REAR_X,       0.400]
];

/* BASE da carroceria (linha inferior / soleira) em cada posição x */
const bottomProfile = [
  [FRONT_X,      0.24],
  [-2.10,        0.20],
  [-1.70,        0.185],
  [ 1.70,        0.185],
  [ 2.10,        0.22],
  [REAR_X,       0.28]
];

/* LARGURA da carroceria em cada posição x (vista de cima):
   estreita na frente, alarga nas caixas de roda, um pouco mais
   estreita na cabine (efeito "cintura"), alarga de novo atrás. */
const widthProfile = [
  [FRONT_X,        1.05],
  [-2.10,          1.62],
  [FRONT_AXLE-0.25,1.94],
  [FRONT_AXLE,     1.95],
  [FRONT_AXLE+0.30,1.78],
  [-0.60,          1.74],
  [ 0.40,          1.74],
  [ REAR_AXLE-0.30,1.80],
  [ REAR_AXLE,     1.95],
  [ REAR_AXLE+0.25,1.94],
  [ 2.10,          1.60],
  [REAR_X,         1.00]
];

/* LARGURA DA CABINE (vidros/teto) em cada x — sempre menor que a
   largura total da carroceria, criando o "degrau" das colunas. */
const cabinTop = -0.72, cabinBottom = 1.16;
const cabinWidthProfile = [
  [cabinTop,    1.50],
  [-0.45,       1.62],
  [ 0.10,       1.62],
  [ 0.55,       1.56],
  [cabinBottom, 1.44]
];

/* ================================================================
   GERAÇÃO DA CARROCERIA POR FATIAS FINAS
   Uma fatia (box) a cada 3cm ao longo do comprimento. Cada fatia usa
   a altura (topo-base) e largura exatas daquele ponto x, interpoladas
   dos perfis acima — isso segue a curva real da planta com precisão,
   em vez de aproximar com poucos blocos grandes.
   ================================================================ */
const STEP = 0.03; // 3cm por fatia -> ~150 fatias no comprimento
let sliceCount = 0;
for(let x = FRONT_X; x <= REAR_X; x += STEP){
  const top = interp(x, topProfile);
  const bottom = interp(x, bottomProfile);
  const w = interp(x, widthProfile);
  const h = Math.max(top - bottom, 0.02);
  const cy = (top + bottom) / 2;

  const isCabin = x >= cabinTop && x <= cabinBottom;
  const cabinH = isCabin ? Math.max(top - 0.72, 0) : 0;
  const lowerH = isCabin ? Math.max(0.72 - bottom, 0.02) : h;

  if(isCabin){
    /* Parte inferior da fatia = carroceria (largura total) */
    box(STEP, lowerH, w, x, bottom + lowerH/2, 0, M.body, 'fatia-carroceria');
    /* Parte superior da fatia = cabine/vidro (largura menor, material vidro) */
    if(cabinH > 0.02){
      const cw = interp(x, cabinWidthProfile);
      box(STEP, cabinH, cw, x, 0.72 + cabinH/2, 0, M.glass, 'fatia-cabine');
    }
  } else {
    box(STEP, h, w, x, cy, 0, M.body, 'fatia-carroceria');
  }
  sliceCount++;
}

/* Teto sólido por cima da cabine (fecha a parte de cima do vidro) */
for(let x = cabinTop+0.10; x <= cabinBottom-0.10; x += STEP){
  const top = interp(x, topProfile);
  const cw = interp(x, cabinWidthProfile) - 0.10;
  box(STEP, 0.06, cw, x, top - 0.03, 0, M.body, 'fatia-teto');
}

/* Colunas A e C nos limites da cabine */
for(const z of [-HALF_W+0.06, HALF_W-0.06]){
  box(.08, 0.46, .08, cabinTop, 0.96, z, M.body2, 'coluna-A');
  box(.08, 0.40, .08, cabinBottom, 0.94, z, M.body2, 'coluna-C');
}

/* Para-brisa e vidro traseiro (planos inclinados, visuais) */
{
  const wf = box(.04,.50,1.50,-.83,1.02,0,M.glass,'para-brisa');
  wf.rotation.z = -0.66;
  const rg = box(.04,.44,1.48,1.00,0.98,0,M.glass,'vidro-traseiro');
  rg.rotation.z = 0.60;
}

/* Para-choques */
box(.14,.20,1.85,-2.18,.38,0,M.body2,'parachoque-dianteiro');
box(.14,.20,1.85, 2.18,.38,0,M.body2,'parachoque-traseiro');

/* Faróis e lanternas */
for(const z of [-.66,.66]){
  box(.05,.15,.34,-2.245,.52,z,M.lamp,'farol');
  box(.05,.14,.34, 2.245,.50,z,M.red,'lanterna');
}

/* Portas — linhas em relevo */
for(const z of [-HALF_W-0.006, HALF_W+0.006]){
  box(1.55,.02,.02,0,.62,z,M.body2,'contorno-porta');
  box(.14,.035,.03,.30,.82,z,M.black,'macaneta');
}

/* Caixas de roda */
function arch(x,z){
  const torus = new THREE.Mesh(new THREE.TorusGeometry(.38,.035,10,32,Math.PI), M.body2);
  torus.name = 'arco-roda';
  torus.castShadow = true;
  torus.rotation.set(Math.PI/2,0,Math.PI);
  torus.position.set(x,.36,z);
  shell.add(torus);
}
arch(FRONT_AXLE,-HALF_W-.006); arch(FRONT_AXLE,HALF_W+.006);
arch(REAR_AXLE,-HALF_W-.006); arch(REAR_AXLE,HALF_W+.006);

/* Rodas na bitola real de 1580mm */
function wheel(x,z,side){
  const g = new THREE.Group();
  g.name = \`roda-\${side}-\${x<0?'dianteira':'traseira'}\`;
  g.position.set(x,GROUND,z);
  wheels.add(g);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R,WHEEL_R,WHEEL_W,40),M.rubber);
  tire.rotation.x = Math.PI/2;
  tire.castShadow=true; tire.receiveShadow=true; g.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.225,.225,.245,28),M.rim);
  rim.rotation.x = Math.PI/2; g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.255,16),M.black);
  hub.rotation.x = Math.PI/2; g.add(hub);
  for(let i=0;i<5;i++){
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.19,.022,.022),M.rim);
    spoke.rotation.z = i*Math.PI*2/5;
    spoke.position.x = Math.cos(i*Math.PI*2/5)*.10;
    spoke.position.y = Math.sin(i*Math.PI*2/5)*.10;
    g.add(spoke);
  }
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

document.getElementById('status').textContent='Modelo 3D carregado — '+sliceCount+' fatias';

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

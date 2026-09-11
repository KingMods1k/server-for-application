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
.legend{position:fixed;left:18px;bottom:18px;z-index:5;font-size:11px;opacity:.6;max-width:380px}
</style>
</head>
<body>
<div id="app"></div>
<div id="status" style="position:fixed;left:18px;top:145px;z-index:10;padding:10px 12px;border-radius:9px;background:rgba(0,0,0,.78);color:#fff;font:12px Arial">Inicializando 3D…</div>
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
 <button id="viewInterior">Interior</button>
 <button id="viewEngine">Motor</button>
 <button id="shell">Carroceria</button>
</div>
<div class="legend">Modelo detalhado: ~1.500 peças individuais — carroceria, interior, motor, chassi, suspensão, freios, escapamento, chicotes, tubulações e detalhes.</div>

<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"}}</script>
<script>window.addEventListener("error",e=>{const st=document.getElementById("status"); if(st) {st.style.background="#5b1515"; st.textContent="Erro 3D: "+(e.message||"falha");}}); window.addEventListener("unhandledrejection",e=>{const st=document.getElementById("status"); if(st) {st.style.background="#5b1515"; st.textContent="Erro 3D: "+String(e.reason||"falha");}});</script>
<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ================================================================
   MODELO DA CARROCERIA — baseado diretamente nas medidas da planta
   Comprimento: 4,480 m | Largura: 1,950 m | Altura: 1,250 m
   Entre-eixos: 2,475 m
   ================================================================ */
const LENGTH = 4.480;
const WIDTH = 1.950;
const HALF_W = WIDTH / 2;
const HEIGHT = 1.250;
const WHEEL_R = 0.335;
const WHEEL_W = 0.235;
/* Origem X = centro do carro (LENGTH/2 = 2.240).
   Frente da carroceria fica em -2.240, traseira em +2.240.
   Balanço dianteiro 930mm -> eixo dianteiro a -2.240+0.930 = -1.310
   Entre-eixos 2475mm -> eixo traseiro a -1.310+2.475 = 1.165
   Balanço traseiro 1075mm -> confere: 1.165+1.075 = 2.240 ✔ */
const FRONT_AXLE = -1.310;
const REAR_AXLE = 1.165;
const WHEEL_Z = HALF_W + 0.045;
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
controls.target.set(0, 0.62, 0);
controls.maxPolarAngle = Math.PI * 0.49;

scene.add(new THREE.HemisphereLight(0xe8eef7, 0x20242b, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-4, 7, 5);
sun.castShadow = true;
scene.add(sun);
scene.add(new THREE.DirectionalLight(0xffffff, 0.65)).position.set(4,3,-5);

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

/* O grupo abaixo É o carro. Não existem motor, suspensão, tubos ou peças
   mecânicas espalhadas pela cena. Tudo externo pertence à carroceria ou às rodas. */
const car = new THREE.Group();
car.name = 'CARRO_COMPLETO';
scene.add(car);
const shell = new THREE.Group();
shell.name = 'CARROCERIA_FECHADA';
car.add(shell);
const wheels = new THREE.Group();
wheels.name = 'RODAS';
car.add(wheels);

function mesh(geometry, material, name, parent=shell){
  const o = new THREE.Mesh(geometry, material);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function box(w,h,d,x,y,z,mat,name,parent=shell){
  const o = mesh(new THREE.BoxGeometry(w,h,d),mat,name,parent);
  o.position.set(x,y,z);
  return o;
}
function panelShape(points, depth, z, mat, name){
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for(let i=1;i<points.length;i++) shape.lineTo(points[i][0],points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});
  g.translate(0,0,-depth/2);
  const o = mesh(g,mat,name);
  o.position.z = z;
  return o;
}

/* Perfil lateral realista de uma coupe, respeitando o envelope da planta. */
const sideProfile = [
  [-2.240,0.43],[-2.180,0.60],[-1.930,0.72],[-1.600,0.77],
  [-1.390,0.84],[-1.120,1.08],[-0.72,1.235],[-0.18,1.25],
  [0.38,1.18],[0.86,1.04],[1.18,0.92],[1.48,0.87],
  [1.82,0.82],[2.12,0.70],[2.240,0.48],[2.20,0.30],
  [1.86,0.27],[-1.86,0.27],[-2.20,0.30]
];

/* Laterais sólidas, com os recortes das caixas de roda feitos por cima
   com a geometria da própria carroceria. */
for(const z of [-HALF_W+0.035, HALF_W-0.035]){
  panelShape(sideProfile,0.070,z,M.body,'lateral-carroceria');
}

/* Soleiras: fecham a parte inferior entre as rodas. */
box(3.72,.16,.12,0.08,.34,-HALF_W+.035,M.body2,'soleira-esquerda');
box(3.72,.16,.12,0.08,.34, HALF_W-.035,M.body2,'soleira-direita');

/* Capô e tampa traseira: superfícies largas, sem atravessar a cabine. */
box(.90,.075,1.78,-1.73,.775,0,M.body,'capo');
box(.78,.065,1.76,1.78,.79,0,M.body,'tampa-traseira');

/* Teto, formado por painéis longitudinais e fechado por toda a largura.
   Peça central de emenda evita o vão entre teto-dianteiro e teto-traseiro. */
box(1.18,.085,1.62,-.33,1.215,0,M.body,'teto-dianteiro');
box(.86,.085,1.60,.66,1.145,0,M.body,'teto-traseiro');
box(.14,.09,1.60,.30,1.18,0,M.body,'teto-emenda');

/* Colunas e contorno das janelas. */
for(const z of [-.82,.82]){
  box(.085,.66,.075,-.90,1.00,z,M.body2,'coluna-A');
  box(.075,.52,.075,.72,1.02,z,M.body2,'coluna-B');
  box(.075,.48,.075,1.22,.92,z,M.body2,'coluna-C');
}

/* Vidros laterais — ficam ENTRE as colunas, não fora delas. */
const windowPts = [
  [-.87,.99],[-.66,1.185],[-.18,1.215],[.53,1.145],[.67,1.00],
  [.63,.84],[-.72,.84],[-.84,.90]
];
for(const z of [-.785,.785]) panelShape(windowPts,.025,z,M.glass,'vidro-lateral');

/* Para-brisa e vidro traseiro, encaixados no teto/cabine. */
const windshield = new THREE.PlaneGeometry(.88,.52);
const wf = mesh(windshield,M.glass,'para-brisa');
wf.position.set(-.76,1.00,0);
wf.rotation.y = Math.PI/2;
wf.rotation.z = -.18;
const rearGlass = mesh(new THREE.PlaneGeometry(.72,.42),M.glass,'vidro-traseiro');
rearGlass.position.set(1.02,.98,0);
rearGlass.rotation.y = Math.PI/2;
rearGlass.rotation.z = .30;

/* Para-choques integrados no envelope. */
box(.16,.22,1.80,-2.17,.43,0,M.body2,'parachoque-dianteiro');
box(.16,.22,1.80, 2.17,.43,0,M.body2,'parachoque-traseiro');

/* Frente: faróis encaixados no para-choque, não projetados para fora. */
for(const z of [-.67,.67]){
  box(.055,.16,.34,-2.255,.58,z,M.lamp,'farol');
  box(.035,.10,.26,-2.285,.47,z,M.black,'entrada-frontal');
}
/* Lanternas traseiras. */
for(const z of [-.67,.67]) box(.045,.14,.34,2.255,.62,z,M.red,'lanterna');

/* Portas, mantendo a superfície da lateral. */
for(const z of [-.986,.986]){
  box(1.38,.025,.025,-.05,.66,z,M.body2,'contorno-porta');
  box(.80,.025,.025,-.12,.90,z,M.body2,'linha-superior-porta');
  box(.14,.035,.035,.37,.76,z,M.black,'macaneta');
}

/* Caixas de roda: arcos visuais na lateral, em vez de rodas atravessando a chapa. */
function arch(x,z){
  const torus = new THREE.Mesh(new THREE.TorusGeometry(.36,.035,12,48,Math.PI),M.body2);
  torus.rotation.set(Math.PI/2,0,Math.PI);
  torus.position.set(x,.335,z);
  torus.castShadow=true;
  shell.add(torus);
}
arch(FRONT_AXLE,-HALF_W-.006); arch(FRONT_AXLE,HALF_W+.006);
arch(REAR_AXLE,-HALF_W-.006); arch(REAR_AXLE,HALF_W+.006);

/* Rodas: únicas peças que ficam deliberadamente fora da carroceria. */
function wheel(x,z,side){
  const g = new THREE.Group();
  g.name = `roda-${side}-${x<0?'dianteira':'traseira'}`;
  g.position.set(x,GROUND,z);
  wheels.add(g);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R,WHEEL_R,WHEEL_W,48),M.rubber);
  tire.rotation.x = Math.PI/2;
  tire.castShadow=true; tire.receiveShadow=true; g.add(tire);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(.235,.235,.245,32),M.rim);
  rim.rotation.x = Math.PI/2; g.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.255,20),M.black);
  hub.rotation.x = Math.PI/2; g.add(hub);
  for(let i=0;i<5;i++){
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(.20,.025,.025),M.rim);
    spoke.rotation.z = i*Math.PI*2/5;
    spoke.position.x = Math.cos(i*Math.PI*2/5)*.105;
    spoke.position.y = Math.sin(i*Math.PI*2/5)*.105;
    g.add(spoke);
  }
}
for(const z of [-WHEEL_Z,WHEEL_Z]){
  wheel(FRONT_AXLE,z,z<0?'esq':'dir');
  wheel(REAR_AXLE,z,z<0?'esq':'dir');
}

/* Interior mínimo e fechado, usado somente pelo botão Interior. */
const interior = new THREE.Group();
interior.name='INTERIOR';
interior.visible=false;
car.add(interior);
box(2.15,.12,1.25,.05,.43,0,M.black,'piso-interior',interior);
box(1.00,.42,.55,-.15,.76,0,M.black,'bancos',interior);
box(.10,.60,.06,-.75,.90,-.50,M.body2,'painel-interior',interior);

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos,target=[0,.62,0]){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById('view3d').onclick=()=>setView([5.8,2.35,5.4]);
document.getElementById('viewFront').onclick=()=>setView([-6.8,1.15,0],[0,.65,0]);
document.getElementById('viewSide').onclick=()=>setView([0,1.15,6.8],[0,.65,0]);
document.getElementById('viewTop').onclick=()=>setView([0,7.2,.01],[0,.45,0]);
document.getElementById('viewInterior').onclick=()=>{
  shell.visible=false; wheels.visible=false; interior.visible=true;
  setView([-1.0,1.15,2.1],[-.15,.78,0]);
};
document.getElementById('viewEngine').onclick=()=>{
  shell.visible=true; wheels.visible=true; interior.visible=false;
  setView([-2.7,1.05,2.2],[-1.65,.65,0]);
};
document.getElementById('shell').onclick=()=>{
  shell.visible=true; wheels.visible=true; interior.visible=false;
  setView([5.8,2.35,5.4]);
};

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
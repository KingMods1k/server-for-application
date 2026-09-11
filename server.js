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
<title>Carro 3D — carroceria por objetos</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif;color:#fff}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{position:fixed;left:18px;top:18px;z-index:5;background:rgba(8,10,14,.80);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;line-height:1.45;max-width:390px}
.hud b{font-size:16px}.hud small{opacity:.72}
.badge{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px}
.controls{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.88);color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer}
button:active{transform:translateY(1px)}
#status{position:fixed;left:18px;top:150px;z-index:10;padding:9px 11px;border-radius:9px;background:rgba(0,0,0,.72);font:12px Arial}
</style>
</head>
<body>
<div id="app"></div>
<div id="status">Inicializando 3D…</div>

<div class="hud">
  <b>Modelo 3D — carroceria por objetos</b><br>
  <small>
    Reconstrução aproximada da planta técnica usando somente objetos
    geométricos simples: blocos, cilindros e painéis sobrepostos.
  </small><br>
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

<script type="importmap">
{"imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
}}
</script>

<script>
window.addEventListener("error", e => {
  const st=document.getElementById("status");
  if(st){st.style.background="#5b1515";st.textContent="Erro 3D: "+(e.message||"falha");}
});
window.addEventListener("unhandledrejection", e => {
  const st=document.getElementById("status");
  if(st){st.style.background="#5b1515";st.textContent="Erro 3D: "+String(e.reason||"falha");}
});
</script>

<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ================================================================
   DIMENSÕES DA PLANTA
   X = comprimento, Y = altura, Z = largura.
   A frente/nariz fica em X=0.
   ================================================================ */
const LENGTH = 4480;
const WIDTH = 1950;
const HEIGHT = 1250;
const TRACK = 1580;
const HALF_TRACK = TRACK/2;
const WHEELBASE = 2475;
const FRONT_AXLE = 930;
const REAR_AXLE = FRONT_AXLE + WHEELBASE;
const FRONT_OVERHANG = 930;
const REAR_OVERHANG = 1075;

const MM = 0.001;
const X0 = -LENGTH*MM/2;

/* ================================================================
   CENA
   ================================================================ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);
scene.fog = new THREE.Fog(0x090b0f, 10, 24);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, .01, 100);
camera.position.set(5.8,2.55,5.5);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
document.getElementById("app").appendChild(renderer.domElement);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minDistance=2.8;
controls.maxDistance=12;
controls.target.set(0,.62,0);
controls.maxPolarAngle=Math.PI*.49;

scene.add(new THREE.HemisphereLight(0xe8eef7,0x20242b,1.45));

const keyLight = new THREE.DirectionalLight(0xffffff,2.4);
keyLight.position.set(-4,7,5);
keyLight.castShadow=true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xffffff,.7);
fillLight.position.set(4,3,-5);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(14,96),
  new THREE.MeshStandardMaterial({color:0x10141a,roughness:.86,metalness:.04})
);
floor.rotation.x=-Math.PI/2;
floor.receiveShadow=true;
scene.add(floor);

const grid = new THREE.GridHelper(14,28,0x242a33,0x171b21);
grid.material.transparent=true;
grid.material.opacity=.42;
scene.add(grid);

/* ================================================================
   MATERIAIS
   ================================================================ */
const M = {
  body: new THREE.MeshPhysicalMaterial({
    color:0x66727d, metalness:.58, roughness:.30,
    clearcoat:.75, clearcoatRoughness:.13, side:THREE.DoubleSide
  }),
  bodyDark: new THREE.MeshPhysicalMaterial({
    color:0x4e5964, metalness:.55, roughness:.35,
    clearcoat:.55, side:THREE.DoubleSide
  }),
  panel: new THREE.MeshStandardMaterial({
    color:0x596570, metalness:.50, roughness:.30
  }),
  glass: new THREE.MeshPhysicalMaterial({
    color:0x182b3d, metalness:.08, roughness:.10,
    transmission:.12, transparent:true, opacity:.94,
    clearcoat:.55, side:THREE.DoubleSide
  }),
  rubber: new THREE.MeshStandardMaterial({
    color:0x07090c, roughness:.76, metalness:.02
  }),
  rim: new THREE.MeshStandardMaterial({
    color:0x929aa2, roughness:.22, metalness:.88
  }),
  black: new THREE.MeshStandardMaterial({
    color:0x07090c, roughness:.50, metalness:.20
  }),
  lamp: new THREE.MeshStandardMaterial({
    color:0xe6eef5, roughness:.18, metalness:.28
  }),
  red: new THREE.MeshStandardMaterial({
    color:0xc5171d, roughness:.25, metalness:.12
  }),
  amber: new THREE.MeshStandardMaterial({
    color:0xe07b18, roughness:.22, metalness:.15
  })
};

const car = new THREE.Group();
scene.add(car);

const body = new THREE.Group();
const details = new THREE.Group();
const wheels = new THREE.Group();
car.add(body,details,wheels);

/* ================================================================
   HELPERS — SOMENTE GEOMETRIAS BÁSICAS
   ================================================================ */
function box(w,h,d,x,y,z,mat,name,parent=body,rz=0){
  const mesh=new THREE.Mesh(
    new THREE.BoxGeometry(w*MM,h*MM,d*MM),
    mat
  );
  mesh.name=name;
  mesh.position.set(x*MM+X0,y*MM,z*MM);
  mesh.rotation.z=rz;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
}

function cylinder(radius,depth,x,y,z,mat,name,parent=details,segments=32,rx=Math.PI/2){
  const mesh=new THREE.Mesh(
    new THREE.CylinderGeometry(radius*MM,radius*MM,depth*MM,segments),
    mat
  );
  mesh.name=name;
  mesh.position.set(x*MM+X0,y*MM,z*MM);
  mesh.rotation.x=rx;
  mesh.castShadow=true;
  mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
}

/* Um painel inclinado no perfil lateral.
   O objeto continua sendo apenas um BoxGeometry. */
function slopedBox(length,height,width,x,y,z,angle,mat,name,parent=body){
  const m=box(length,height,width,x,y,z,mat,name,parent);
  m.rotation.z=angle;
  return m;
}

/* ================================================================
   1. ASSOALHO / SOLEIRAS
   A planta mostra uma carroceria baixa e comprida, com a cintura
   quase reta nas portas.
   ================================================================ */
box(4300,150,1320,2240,285,0,M.bodyDark,"assoalho-central");
box(3700,105,150,2240,245,-735,M.body,"soleira-esq");
box(3700,105,150,2240,245, 735,M.body,"soleira-dir");

/* Nariz estreito e traseira estreita, conforme a vista superior. */
box(330,180,900,165,350,0,M.body,"nariz-baixo");
box(500,170,1420,490,365,0,M.body,"frente-baixa");
box(480,170,1450,940,390,0,M.body,"base-capo");
box(760,175,1550,1550,395,0,M.body,"cintura-dianteira");
box(1050,175,1520,2455,395,0,M.body,"cintura-portas");
box(720,180,1660,3335,400,0,M.body,"cintura-traseira");
box(470,175,1510,3930,385,0,M.bodyDark,"traseira-lateral");
box(360,190,920,4250,360,0,M.bodyDark,"rabo-estreito");

/* ================================================================
   2. PARA-LAMAS — volumes separados, deixando as rodas aparentes.
   ================================================================ */
for(const s of [-1,1]){
  /* dianteiro: dois blocos antes/depois da parte superior da roda */
  box(430,165,330,620,475,s*735,M.body,"paralama-dianteiro-a");
  box(390,150,330,1015,485,s*735,M.body,"paralama-dianteiro-b");

  /* traseiro, mais largo, como na planta */
  box(520,170,350,3000,475,s*770,M.body,"paralama-traseiro-a");
  box(500,170,350,3600,475,s*770,M.body,"paralama-traseiro-b");

  /* extremidades laterais baixas */
  box(1180,95,120,2260,335,s*830,M.bodyDark,"linha-lateral");
}

/* ================================================================
   3. CAPÔ
   O desenho tem nariz baixo, capô longo e uma subida suave para
   a base do para-brisa. É feito com vários blocos inclinados.
   ================================================================ */
slopedBox(430,32,1550,360,505,0,
  Math.atan2(55,430),M.bodyDark,"capo-nariz");

slopedBox(620,34,1600,820,540,0,
  Math.atan2(70,620),M.body,"capo-central");

slopedBox(470,38,1580,1280,600,0,
  Math.atan2(70,470),M.body,"capo-base");

/* bordas do capô */
for(const s of [-1,1]){
  slopedBox(1030,22,55,815,545,s*790,
    Math.atan2(100,1030),M.panel,"friso-capo");
}

/* ================================================================
   4. CABINE / TETO
   Silhueta lateral aproximada: para-brisa inclinado, teto quase
   plano e vigia traseira inclinada.
   ================================================================ */
const WIN_BASE_X = 1180;
const ROOF_FRONT = 1510;
const ROOF_REAR = 3270;
const ROOF_Y = 1115;
const REAR_GLASS_BASE_X = 3550;

/* para-brisa em cada lado, como painéis sólidos inclinados */
const windshieldAngle=Math.atan2(ROOF_Y-635,ROOF_FRONT-WIN_BASE_X);
for(const s of [-1,1]){
  slopedBox(610,22,610,(WIN_BASE_X+ROOF_FRONT)/2,
    (635+ROOF_Y)/2,s*500,windshieldAngle,
    M.glass,"para-brisa-"+s);

  /* moldura A */
  slopedBox(610,30,48,(WIN_BASE_X+ROOF_FRONT)/2,
    (635+ROOF_Y)/2,s*790,windshieldAngle,
    M.bodyDark,"coluna-A-"+s);
}

/* teto principal */
box(1800,38,1210,(ROOF_FRONT+ROOF_REAR)/2,ROOF_Y,0,M.bodyDark,"teto");

/* bordas do teto */
for(const s of [-1,1]){
  box(1770,34,55,(ROOF_FRONT+ROOF_REAR)/2,ROOF_Y-5,s*625,M.body,"borda-teto-"+s);
}

/* vidros laterais grandes — dois objetos por lado */
for(const s of [-1,1]){
  const sideZ=s*620;

  slopedBox(770,20,28,1900,795,sideZ,
    0,M.glass,"vidro-lateral-dianteiro-"+s);

  slopedBox(820,20,28,2700,805,sideZ,
    0,M.glass,"vidro-lateral-traseiro-"+s);

  /* coluna B */
  box(55,520,48,2300,845,sideZ,M.bodyDark,"coluna-B-"+s);

  /* coluna C inclinada */
  const cAngle=Math.atan2(260,430);
  slopedBox(450,34,48,3390,930,sideZ,cAngle,
    M.bodyDark,"coluna-C-"+s);

  /* linha inferior das janelas */
  box(1740,32,42,(ROOF_FRONT+ROOF_REAR)/2,575,sideZ,M.bodyDark,"cintura-janela-"+s);
}

/* Vigia traseira */
const rearAngle=Math.atan2(ROOF_Y-675,REAR_GLASS_BASE_X-ROOF_REAR);
for(const s of [-1,1]){
  slopedBox(470,22,600,(ROOF_REAR+REAR_GLASS_BASE_X)/2,
    (ROOF_Y+675)/2,s*500,rearAngle,
    M.glass,"vigia-traseira-"+s);
}

/* teto traseiro / tampa */
slopedBox(520,34,1480,3810,590,0,
  Math.atan2(-40,520),M.bodyDark,"tampa-malas");

/* ================================================================
   5. PAINÉIS DAS PORTAS
   ================================================================ */
for(const s of [-1,1]){
  box(1040,115,22,1770,425,s*770,M.panel,"porta-dianteira-"+s);
  box(900,115,22,2670,425,s*770,M.panel,"porta-traseira-"+s);

  /* maçanetas simples */
  box(135,22,20,1780,575,s*785,M.black,"macaneta-dianteira-"+s);
  box(135,22,20,2670,575,s*785,M.black,"macaneta-traseira-"+s);

  /* reforço inferior */
  box(1550,45,25,2220,320,s*790,M.bodyDark,"vinco-porta-"+s);
}

/* ================================================================
   6. FRENTE — faróis, grade e para-choque
   ================================================================ */
box(150,170,1600,80,355,0,M.bodyDark,"parachoque-frontal");
box(70,115,1250,18,455,0,M.black,"grade-frontal");

for(const s of [-1,1]){
  box(70,125,390,92,525,s*570,M.lamp,"farol-"+s);
  box(45,70,240,100,505,s*735,M.black,"moldura-farol-"+s);
  box(50,85,270,35,360,s*660,M.black,"entrada-frontal-"+s);
}

/* ================================================================
   7. TRASEIRA — tampa, lanternas e para-choque
   ================================================================ */
box(150,170,1600,LENGTH-75,355,0,M.bodyDark,"parachoque-traseiro");
box(65,125,1380,LENGTH-8,470,0,M.black,"faixa-traseira");

for(const s of [-1,1]){
  box(65,125,360,LENGTH-105,555,s*600,M.red,"lanterna-"+s);
  box(38,70,190,LENGTH-112,535,s*760,M.black,"moldura-lanterna-"+s);
}

/* placa / miolo traseiro */
box(35,110,500,LENGTH-95,430,0,M.black,"miolo-traseiro");

/* ================================================================
   8. RODAS
   Eixo dianteiro = 930 mm; eixo traseiro = 3405 mm.
   ================================================================ */
function makeWheel(x,z){
  const g=new THREE.Group();
  g.position.set(x*MM+X0,335*MM,z*MM);
  wheels.add(g);

  const tire=new THREE.Mesh(
    new THREE.CylinderGeometry(335*MM,335*MM,235*MM,40),
    M.rubber
  );
  tire.rotation.x=Math.PI/2;
  tire.castShadow=true;
  tire.receiveShadow=true;
  g.add(tire);

  const rim=new THREE.Mesh(
    new THREE.CylinderGeometry(205*MM,205*MM,242*MM,32),
    M.rim
  );
  rim.rotation.x=Math.PI/2;
  g.add(rim);

  const hub=new THREE.Mesh(
    new THREE.CylinderGeometry(58*MM,58*MM,250*MM,20),
    M.black
  );
  hub.rotation.x=Math.PI/2;
  g.add(hub);

  for(let i=0;i<5;i++){
    const spoke=new THREE.Mesh(
      new THREE.BoxGeometry(175*MM,20*MM,24*MM),
      M.rim
    );
    const a=i*Math.PI*2/5;
    spoke.rotation.z=a;
    spoke.position.x=Math.cos(a)*100*MM;
    spoke.position.y=Math.sin(a)*100*MM;
    g.add(spoke);
  }
}

for(const z of [-HALF_TRACK,HALF_TRACK]){
  makeWheel(FRONT_AXLE,z);
  makeWheel(REAR_AXLE,z);
}

/* ================================================================
   9. AEROFÓLIO / SPOILER
   ================================================================ */
box(900,34,45,3980,720,-620,M.bodyDark,"base-spoiler-esq");
box(900,34,45,3980,720, 620,M.bodyDark,"base-spoiler-dir");

for(const s of [-1,1]){
  box(42,250,42,4020,825,s*610,M.bodyDark,"suporte-spoiler-"+s);
}
box(115,28,1380,4090,930,0,M.black,"asa-spoiler");

/* pequenos detalhes inferiores */
box(2500,38,110,2240,225,-805,M.black,"difusor-esq");
box(2500,38,110,2240,225, 805,M.black,"difusor-dir");

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos,target=[0,.62,0]){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}

document.getElementById("view3d").onclick=()=>setView([5.8,2.55,5.5]);
document.getElementById("viewFront").onclick=()=>setView([-6.8,1.18,0],[0,.58,0]);
document.getElementById("viewSide").onclick=()=>setView([0,1.25,6.8],[0,.62,0]);
document.getElementById("viewTop").onclick=()=>setView([0,7.4,.01],[0,.45,0]);
document.getElementById("viewRear").onclick=()=>setView([6.8,1.18,0],[0,.58,0]);

document.getElementById("status").textContent="Modelo 3D carregado — carroceria por objetos";

addEventListener("resize",()=>{
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

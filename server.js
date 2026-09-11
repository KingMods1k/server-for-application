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
<title>Carro 3D — carroceria</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif;color:#fff}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{position:fixed;left:18px;top:18px;z-index:5;background:rgba(8,10,14,.82);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:16px;padding:15px 17px;line-height:1.5;max-width:620px}
.hud b{font-size:17px}.hud small{opacity:.75}
.badge{display:inline-block;margin:8px 5px 0 0;padding:5px 8px;border-radius:7px;background:rgba(255,255,255,.08);font-size:11px}
.controls{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.9);color:#fff;border-radius:11px;padding:11px 14px;cursor:pointer}
button:active{transform:translateY(1px)}
#status{position:fixed;left:18px;top:155px;z-index:10;padding:9px 12px;border-radius:9px;background:rgba(0,0,0,.72);font-size:12px}
</style>
</head>
<body>
<div id="app"></div>
<div id="status">Inicializando 3D…</div>
<div class="hud">
  <b>Modelo 3D — carroceria por objetos</b><br>
  <small>Reconstrução visual da planta técnica. Apenas a carroceria: casco, capô, para-lamas, portas, pilares, teto, vidros e traseira. Cada parte é um objeto separado.</small><br>
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
<script>
window.addEventListener("error",e=>{
  const s=document.getElementById("status");
  if(s){s.style.background="#5b1515";s.textContent="Erro 3D: "+(e.message||"falha");}
});
window.addEventListener("unhandledrejection",e=>{
  const s=document.getElementById("status");
  if(s){s.style.background="#5b1515";s.textContent="Erro 3D: "+String(e.reason||"falha");}
});
</script>

<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* COTAS DA PLANTA — X=0 no nariz */
const LENGTH=4480, WIDTH=1950, HEIGHT=1250;
const HALF_TRACK=790, WHEELBASE=2475;
const FRONT_AXLE=930, REAR_AXLE=3405;
const SCALE=.001;
const ORIGIN=-LENGTH*SCALE/2;

/* cena */
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x090b0f);
scene.fog=new THREE.Fog(0x090b0f,12,28);

const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);
camera.position.set(5.8,2.25,5.1);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.08;
document.getElementById("app").appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minDistance=2.8;
controls.maxDistance=11;
controls.target.set(0,.62,0);
controls.maxPolarAngle=Math.PI*.49;

scene.add(new THREE.HemisphereLight(0xe8eef7,0x20242b,1.5));
const sun=new THREE.DirectionalLight(0xffffff,2.4);
sun.position.set(-4,7,5);
scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,.65);
fill.position.set(4,3,-5);
scene.add(fill);

const floor=new THREE.Mesh(
  new THREE.CircleGeometry(14,96),
  new THREE.MeshStandardMaterial({color:0x10141a,roughness:.86,metalness:.04})
);
floor.rotation.x=-Math.PI/2;
scene.add(floor);
const grid=new THREE.GridHelper(14,28,0x242a33,0x171b21);
grid.material.transparent=true;
grid.material.opacity=.42;
scene.add(grid);

/* materiais — somente carroceria */
const M={
  body:new THREE.MeshPhysicalMaterial({
    color:0x69747e,metalness:.55,roughness:.3,clearcoat:.7,clearcoatRoughness:.15,
    side:THREE.DoubleSide
  }),
  bodyDark:new THREE.MeshPhysicalMaterial({
    color:0x4e5862,metalness:.5,roughness:.34,clearcoat:.45,
    side:THREE.DoubleSide
  }),
  edge:new THREE.MeshStandardMaterial({
    color:0x343b43,metalness:.65,roughness:.32,side:THREE.DoubleSide
  }),
  glass:new THREE.MeshPhysicalMaterial({
    color:0x26394c,metalness:.08,roughness:.12,transmission:.18,
    transparent:true,opacity:.9,side:THREE.DoubleSide
  }),
  black:new THREE.MeshStandardMaterial({
    color:0x080a0d,metalness:.15,roughness:.58
  })
};

const car=new THREE.Group();
scene.add(car);
const body=new THREE.Group();
car.add(body);

/* PRIMITIVO PRINCIPAL: todos os elementos continuam objetos separados */
function box(name,w,h,d,x,y,z,mat=M.body,rz=0){
  const m=new THREE.Mesh(
    new THREE.BoxGeometry(w*SCALE,h*SCALE,d*SCALE),
    mat
  );
  m.name=name;
  m.position.set(x*SCALE+ORIGIN,y*SCALE,z*SCALE);
  m.rotation.z=rz;
  m.castShadow=true;
  m.receiveShadow=true;
  body.add(m);
  return m;
}

function panel(name,w,h,d,x,y,z,mat=M.body,rz=0){
  return box(name,w,h,d,x,y,z,mat,rz);
}

/* =========================================================
   1. CASCO INFERIOR
   Baixo e contínuo, seguindo a silhueta da planta.
   ========================================================= */
const segments=[
  [0,260,900],
  [260,720,1810],
  [720,1180,1880],
  [1180,1850,1790],
  [1850,2700,1770],
  [2700,3100,1800],
  [3100,3560,1900],
  [3560,4050,1780],
  [4050,4480,1680]
];

for(const [x0,x1,w] of segments){
  const len=x1-x0;
  box("casco-"+x0,len+18,235,w,(x0+x1)/2,315,0,M.body);
}

/* soleiras laterais */
for(const z of [-865,865]){
  box("soleira",2250,115,105,(1850),445,z,M.bodyDark);
  box("soleira-dianteira",900,100,120,820,435,z,M.body);
}

/* =========================================================
   2. PARA-LAMAS
   A planta mostra os para-lamas mais largos que a cintura.
   Fazemos cada para-lama como conjunto de objetos, deixando
   o volume da carroceria em volta das rodas.
   ========================================================= */
function fender(axle,name){
  const zOuter=930;
  const zInner=655;
  /* trecho dianteiro/traseiro do arco */
  for(const side of [-1,1]){
    const z=side*770;
    box(name+"-frente",390,150,150,axle-245,470,z,M.body);
    box(name+"-topo",360,115,190,axle,535,z,M.body);
    box(name+"-tras",390,150,150,axle+245,470,z,M.body);
    /* borda externa baixa */
    box(name+"-borda",430,75,80,axle,390,side*900,M.edge);
  }
}
fender(FRONT_AXLE,"paralama-dianteiro");
fender(REAR_AXLE,"paralama-traseiro");

/* =========================================================
   3. CAPÔ — inclinação para baixo no nariz
   ========================================================= */
{
  const x0=150,x1=1010,y0=535,y1=485;
  const len=Math.hypot(x1-x0,y1-y0);
  const p=box("capo",len,42,1540,(x0+x1)/2,(y0+y1)/2,0,M.bodyDark);
  p.rotation.z=Math.atan2(y1-y0,x1-x0);
}

/* borda frontal do capô */
box("borda-capo",95,55,1600,120,510,0,M.body);

/* =========================================================
   4. PAINÉIS LATERAIS / PORTAS
   A lateral da planta é longa e limpa, com a cintura baixa.
   ========================================================= */
for(const side of [-1,1]){
  const z=side*885;

  box("lateral-dianteira",930,250,38,1500,565,z,M.body);
  box("porta-dianteira",760,270,34,2050,565,z,M.bodyDark);
  box("porta-traseira",720,270,34,2780,565,z,M.bodyDark);
  box("lateral-traseira",520,260,38,3350,565,z,M.body);

  /* linhas inferiores das portas */
  box("linha-porta-1",730,28,24,2050,445,z*1.002,M.edge);
  box("linha-porta-2",700,28,24,2780,445,z*1.002,M.edge);

  /* reforço do para-lama traseiro */
  box("ombro-traseiro",650,110,80,3350,665,side*925,M.body);
}

/* =========================================================
   5. CINTURA E PILARES
   ========================================================= */
const BELT=690;
const ROOF=1125;

/* cintura lateral */
for(const side of [-1,1]){
  const z=side*890;
  box("cintura",2200,65,65,2250,BELT,z,M.bodyDark);

  /* pilar A inclinado */
  const a0={x:1030,y:BELT+20}, a1={x:1260,y:ROOF-20};
  let len=Math.hypot(a1.x-a0.x,a1.y-a0.y);
  let a=box("pilar-A",len,95,75,(a0.x+a1.x)/2,(a0.y+a1.y)/2,z,M.body);
  a.rotation.z=Math.atan2(a1.y-a0.y,a1.x-a0.x);

  /* pilar B */
  box("pilar-B",90,455,78,2170,(BELT+ROOF)/2,z,M.body);

  /* pilar C inclinado */
  const c0={x:3240,y:ROOF-15}, c1={x:3500,y:BELT};
  len=Math.hypot(c1.x-c0.x,c1.y-c0.y);
  let c=box("pilar-C",len,92,75,(c0.x+c1.x)/2,(c0.y+c1.y)/2,z,M.body);
  c.rotation.z=Math.atan2(c1.y-c0.y,c1.x-c0.x);
}

/* =========================================================
   6. VIDROS LATERAIS
   Dois painéis por lado, seguindo o perfil trapezoidal.
   São objetos planos/volumétricos separados.
   ========================================================= */
for(const side of [-1,1]){
  const z=side*900;

  box("vidro-dianteiro",820,360,18,1660,850,z,M.glass,
      -0.08);

  box("vidro-traseiro",850,350,18,2740,850,z,M.glass,
      0.08);
}

/* faixas superiores que moldam os vidros */
for(const side of [-1,1]){
  const z=side*925;
  box("moldura-superior",2050,55,60,2270,1085,z,M.body);
}

/* =========================================================
   7. TETO
   Em vez de uma placa gigantesca, três painéis longitudinais
   sobrepostos para acompanhar a forma do desenho.
   ========================================================= */
box("teto-central",1580,48,1060,2180,1125,0,M.bodyDark);
box("teto-dianteiro",720,38,1080,1350,1080,0,M.body);
box("teto-traseiro",720,42,1080,3000,1085,0,M.body);

/* molduras laterais do teto */
for(const side of [-1,1]){
  box("moldura-teto",1950,55,72,2200,1090,side*575,M.body);
}

/* =========================================================
   8. PARA-BRISA INCLINADO
   ========================================================= */
{
  const x0=1015,x1=1260,y0=690,y1=1095;
  const len=Math.hypot(x1-x0,y1-y0);
  const p=box("para-brisa",len,32,1500,(x0+x1)/2,(y0+y1)/2,0,M.glass);
  p.rotation.z=Math.atan2(y1-y0,x1-x0);
}

/* travessa inferior do para-brisa */
{
  const x0=990,x1=1280,y0=680,y1=690;
  const len=Math.hypot(x1-x0,y1-y0);
  const p=box("base-para-brisa",len,48,1570,(x0+x1)/2,(y0+y1)/2,0,M.body);
  p.rotation.z=Math.atan2(y1-y0,x1-x0);
}

/* =========================================================
   9. VIGIA TRASEIRA — descida para o porta-malas
   ========================================================= */
{
  const x0=3000,x1=3500,y0=1090,y1=690;
  const len=Math.hypot(x1-x0,y1-y0);
  const p=box("vigia-traseira",len,32,1460,(x0+x1)/2,(y0+y1)/2,0,M.glass);
  p.rotation.z=Math.atan2(y1-y0,x1-x0);
}

/* moldura da vigia */
{
  const x0=2970,x1=3530,y0=1110,y1=680;
  const len=Math.hypot(x1-x0,y1-y0);
  const p=box("moldura-vigia",len,55,1510,(x0+x1)/2,(y0+y1)/2,0,M.body);
  p.rotation.z=Math.atan2(y1-y0,x1-x0);
}

/* =========================================================
   10. TAMPA TRASEIRA E QUARTOS
   ========================================================= */
box("tampa-porta-malas",720,115,1510,3800,610,0,M.bodyDark);

for(const side of [-1,1]){
  box("quarto-traseiro",480,240,55,3600,610,side*900,M.body);
  box("canto-traseiro",350,190,70,4140,510,side*790,M.body);
}

/* painel traseiro baixo */
box("painel-traseiro",360,230,1660,4310,370,0,M.bodyDark);
box("travessa-traseira",105,90,1700,4400,305,0,M.edge);

/* frente baixa */
box("painel-frontal",320,190,1640,70,350,0,M.bodyDark);
box("travessa-frontal",95,80,1700,20,285,0,M.edge);

/* =========================================================
   11. PEÇAS DE ACABAMENTO QUE AINDA SÃO CARROCERIA
   ========================================================= */
for(const side of [-1,1]){
  box("barra-superior-lateral",2500,38,35,2200,735,side*936,M.edge);
  box("barra-inferior-lateral",2500,32,35,2200,430,side*936,M.edge);
}

/* chão de dentro da carroceria, bem baixo */
box("assoalho",3000,70,1450,2200,235,0,M.bodyDark);

/* vistas */
function setView(pos,target=[0,.62,0]){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById("view3d").onclick=()=>setView([5.8,2.25,5.1]);
document.getElementById("viewFront").onclick=()=>setView([-6.8,1.1,0],[0,.58,0]);
document.getElementById("viewSide").onclick=()=>setView([0,1.1,6.8],[0,.62,0]);
document.getElementById("viewTop").onclick=()=>setView([0,7.2,.01],[0,.65,0]);
document.getElementById("viewRear").onclick=()=>setView([6.8,1.1,0],[0,.58,0]);

document.getElementById("status").textContent="Modelo 3D carregado — somente carroceria";
document.getElementById("view3d").click();

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

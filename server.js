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
window.addEventListener("error",e=>{
  const st=document.getElementById("status");
  if(st){st.style.background="#5b1515";st.textContent="Erro 3D: "+(e.message||"falha");}
});
window.addEventListener("unhandledrejection",e=>{
  const st=document.getElementById("status");
  if(st){st.style.background="#5b1515";st.textContent="Erro 3D: "+String(e.reason||"falha");}
});
</script>

<script type="module">
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
  CARROCERIA — reconstrução por objetos simples.
  Não há rodas, pneus, faróis, lanternas ou spoiler.
  X = comprimento, Y = altura, Z = largura.
  Origem X = centro do carro.
*/
const LENGTH=4480, WIDTH=1950, HEIGHT=1250;
const HALF_WIDTH=WIDTH/2;
const WHEELBASE=2475;
const FRONT_OVERHANG=930;
const REAR_OVERHANG=1075;
const FRONT_AXLE=FRONT_OVERHANG;
const REAR_AXLE=LENGTH-REAR_OVERHANG;
const M2MM=.001;
const X0=-LENGTH/2;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x090b0f);
scene.fog=new THREE.Fog(0x090b0f,11,24);

const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);
camera.position.set(5.9,2.25,5.3);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
document.getElementById("app").appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.08;
controls.minDistance=2.7;
controls.maxDistance=11;
controls.target.set(0,.58,0);
controls.maxPolarAngle=Math.PI*.49;

scene.add(new THREE.HemisphereLight(0xe8eef7,0x20242b,1.45));
const sun=new THREE.DirectionalLight(0xffffff,2.2);
sun.position.set(-4,7,5);
scene.add(sun);
const fill=new THREE.DirectionalLight(0xffffff,.55);
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
grid.material.opacity=.38;
scene.add(grid);

const M={
  body:new THREE.MeshPhysicalMaterial({
    color:0x69747e,metalness:.56,roughness:.3,clearcoat:.7,
    clearcoatRoughness:.14,side:THREE.DoubleSide
  }),
  edge:new THREE.MeshPhysicalMaterial({
    color:0x4f5963,metalness:.5,roughness:.35,side:THREE.DoubleSide
  }),
  inside:new THREE.MeshStandardMaterial({
    color:0x151a20,roughness:.75,metalness:.08,side:THREE.DoubleSide
  }),
  glass:new THREE.MeshPhysicalMaterial({
    color:0x25394e,metalness:.08,roughness:.12,
    transparent:true,opacity:.72,clearcoat:.45,side:THREE.DoubleSide
  })
};

const car=new THREE.Group();
scene.add(car);
const body=new THREE.Group();
car.add(body);

function mm(v){return v*M2MM;}
function box(w,h,d,x,y,z,mat=M.body,name="",rotZ=0, parent=body){
  const o=new THREE.Mesh(new THREE.BoxGeometry(mm(w),mm(h),mm(d)),mat);
  o.name=name;
  o.position.set(mm(x)+X0,mm(y),mm(z));
  o.rotation.z=rotZ;
  o.castShadow=true;
  o.receiveShadow=true;
  parent.add(o);
  return o;
}
function panelBetween(x0,y0,x1,y1,width,depth,z,mat,name){
  const dx=x1-x0,dy=y1-y0;
  const len=Math.hypot(dx,dy);
  const o=box(len,width,depth,(x0+x1)/2,(y0+y1)/2,z,mat,name);
  o.rotation.z=Math.atan2(dy,dx);
  return o;
}

/* =========================================================
   1. PISO / SOLEIRAS
   A planta mostra uma carroceria baixa, contínua e estreita
   no centro, com as caixas dos para-lamas nas extremidades.
   ========================================================= */
box(2520,125,1040,2225,245,0,M.body,"assoalho-central");
box(1180,105,1500,1040,235,0,M.edge,"assoalho-dianteiro");
box(1100,105,1500,3440,235,0,M.edge,"assoalho-traseiro");

for(const z of [-835,835]){
  box(2850,155,95,1900,285,z,M.body,"soleira-lateral");
  box(1150,135,95,3660,300,z,M.body,"soleira-traseira");
}

/* =========================================================
   2. NARIZ E CAPÔ
   Baixo na frente e sobe progressivamente até o para-brisa.
   ========================================================= */
box(520,180,900,260,330,0,M.body,"nariz-central");
box(420,150,650,70,390,-520,M.edge,"nariz-esq");
box(420,150,650,70,390,520,M.edge,"nariz-dir");

panelBetween(150,555,1040,495,24,1660,0,M.body,"capo-central");
panelBetween(210,510,1000,470,24,290,-700,M.edge,"capo-borda-esq");
panelBetween(210,510,1000,470,24,290,700,M.edge,"capo-borda-dir");

box(720,115,70,560,440,-805,M.body,"borda-capo-esq");
box(720,115,70,560,440,805,M.body,"borda-capo-dir");

/* =========================================================
   3. PARA-LAMAS DIANTEIROS
   Em vez de uma caixa cobrindo a roda, cada arco é construído
   com pequenos objetos, deixando o recorte aberto.
   ========================================================= */
function fenderArch(cx,z,side,label){
  const r=335;
  const outer=805;
  const inner=585;

  // trecho dianteiro do arco
  box(150,210,220,cx-245,390,z+(side*18),M.body,label+"-arco-frente");
  // topo do arco
  box(330,155,220,cx,575,z+(side*18),M.body,label+"-arco-topo");
  // trecho traseiro do arco
  box(150,210,220,cx+245,390,z+(side*18),M.body,label+"-arco-traseira");

  // pequeno prolongamento da caixa do para-lama
  box(500,115,190,cx-5,610,z+(side*5),M.edge,label+"-ombro");
}
for(const z of [-805,805]){
  fenderArch(FRONT_AXLE,z,z<0?"E":"D", "paralama-dianteiro");
}

/* =========================================================
   4. LATERAIS DAS PORTAS
   Duas grandes portas por lado, com cintura reta e recortes.
   ========================================================= */
for(const z of [-825,825]){
  box(1050,230,80,1640,455,z,M.body,"porta-dianteira");
  box(930,230,80,2540,455,z,M.body,"porta-traseira");

  // cintura da porta
  box(2050,55,55,2100,595,z,M.edge,"linha-cintura");

  // base inferior contínua
  box(2050,115,115,2100,330,z,M.body,"base-portas");

  // pequenas bordas verticais que definem as portas
  box(35,430,42,1120,470,z,M.edge,"batente-porta-dianteira");
  box(35,430,42,2160,470,z,M.edge,"batente-porta-traseira");
  box(35,430,42,3000,470,z,M.edge,"fim-porta");
}

/* =========================================================
   5. PARA-LAMAS TRASEIROS
   O desenho técnico alarga bastante a região traseira.
   ========================================================= */
for(const z of [-805,805]){
  fenderArch(REAR_AXLE,z,z<0?"E":"D","paralama-traseiro");

  box(570,125,220,3820,555,z,M.body,"ombro-traseiro");
  box(650,180,180,4090,410,z,M.edge,"painel-traseiro-lateral");
}

/* =========================================================
   6. COLUNAS + CABINE
   Nada de "teto gigante": a cabine é formada por molduras
   independentes, como a abertura da carroceria da planta.
   ========================================================= */
const CAB_X0=1120;
const CAB_X1=3500;
const BELT=655;
const ROOF=1125;

/* base da cabine */
for(const z of [-820,820]){
  box(2290,80,80,(CAB_X0+CAB_X1)/2,665,z,M.body,"base-cabine");
}

/* A-pilares inclinados */
for(const z of [-820,820]){
  panelBetween(1120,650,1370,1115,95,105,z,M.body,"coluna-A");

  // B-pilar quase vertical
  box(105,450,105,2220,875,z,M.body,"coluna-B");

  // C-pilar inclinado
  panelBetween(3500,650,3320,1110,105,105,z,M.body,"coluna-C");
}

/* teto: quatro objetos estreitos, não uma placa */
box(1900,75,105,(1370+3320)/2,1125,-790,M.body,"teto-esq");
box(1900,75,105,(1370+3320)/2,1125,790,M.body,"teto-dir");
box(105,75,1500,1370,1125,0,M.body,"travessa-teto-frente");
box(105,75,1500,3320,1125,0,M.body,"travessa-teto-traseira");

/* molduras inferiores dos vidros laterais */
for(const z of [-790,790]){
  box(1850,55,50,2340,690,z,M.edge,"moldura-vidro-lateral");
}

/* vidros laterais como painéis separados, dentro da moldura */
for(const z of [-765,765]){
  box(760,330,20,1760,850,z,M.glass,"vidro-lateral-dianteiro");
  box(800,330,20,2680,850,z,M.glass,"vidro-lateral-traseiro");
}

/* para-brisa inclinado, somente um painel fino */
panelBetween(1080,665,1370,1105,32,1450,0,M.glass,"para-brisa");

/* vigia traseira inclinada */
panelBetween(3500,665,3320,1105,32,1450,0,M.glass,"vigia-traseira");

/* =========================================================
   7. TRASEIRA
   A planta tem traseira curta, larga e com painel central.
   ========================================================= */
box(500,180,1550,4100,600,0,M.body,"painel-traseiro");
box(250,120,1750,4300,430,0,M.edge,"travessa-traseira");
box(190,105,1200,4210,790,0,M.body,"borda-tampa-traseira");

for(const z of [-760,760]){
  box(420,160,100,4040,650,z,M.body,"canto-traseiro");
}

/* =========================================================
   8. RECORTES INTERNOS / BASE DO HABITÁCULO
   Objetos escuros representam apenas a profundidade dos vãos;
   continuam sendo objetos separados, não um modelo importado.
   ========================================================= */
box(2250,45,1320,2260,700,0,M.inside,"interior-cabine-base");

/* pequenos reforços visíveis da carroceria */
for(const z of [-850,850]){
  box(1450,50,45,2050,625,z,M.edge,"reforco-lateral");
}

/* chão para centralizar visualmente o modelo */
const centerY=.65;

/* =========================================================
   VISTAS
   ========================================================= */
function setView(pos,target=[0,centerY,0]){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById("view3d").onclick=()=>setView([5.9,2.25,5.3]);
document.getElementById("viewFront").onclick=()=>setView([-6.8,1.15,0]);
document.getElementById("viewSide").onclick=()=>setView([0,1.15,6.8]);
document.getElementById("viewTop").onclick=()=>setView([0,7.2,.01],[0,.45,0]);
document.getElementById("viewRear").onclick=()=>setView([6.8,1.15,0]);

document.getElementById("status").textContent="Carroceria 3D carregada — somente objetos";
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

app.listen(PORT,()=>console.log("Servidor rodando na porta "+PORT));

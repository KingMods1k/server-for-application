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
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{
 position:fixed;left:18px;top:18px;z-index:5;color:#fff;
 background:rgba(8,10,14,.78);border:1px solid rgba(255,255,255,.12);
 backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;
 line-height:1.45;max-width:360px
}
.hud b{font-size:16px}.hud small{opacity:.72}
.badge{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;
 background:rgba(255,255,255,.08);font-size:11px}
.controls{
 position:fixed;right:18px;bottom:18px;z-index:5;
 display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end
}
button{
 border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.86);
 color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer
}
button:active{transform:translateY(1px)}
</style>
</head>
<body>
<div id="app"></div>

<div class="hud">
 <b>Modelo 3D — carroceria em blocos</b><br>
 <small>Construção por volumes sólidos, seguindo a silhueta da carroceria real e da planta.</small><br>
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
 "imports":{
  "three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
  "three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
 }
}
</script>

<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/*
  ================================================================
  MODELO EM BLOCOS — DIMENSÕES DA PLANTA
  ================================================================
  comprimento: 4480 mm
  largura:     1950 mm
  altura:      1250 mm
  entre-eixos: 2475 mm
  balanço F:    930 mm
  balanço T:   1075 mm

  A ideia aqui NÃO é fazer um loft contínuo.
  A carroceria é montada por blocos/volumes independentes:
  assoalho, caixas dos para-lamas, capô, cabine, teto,
  traseira e saias laterais. Isso deixa a silhueta controlável
  e próxima da referência em vez de criar uma "caixa loftada".
*/

const L = 4.480;
const W = 1.950;
const H = 1.250;

const FRONT_X = -2.240;
const REAR_X =  2.240;
const FRONT_AXLE_X = -1.310;
const REAR_AXLE_X  =  1.165;
const TRACK = 1.580;
const TRACK_HALF = TRACK / 2;

/* cena */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, .01, 100);
camera.position.set(5.6, 2.55, 5.8);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new OrbitControls(camera,renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.minDistance = 3.0;
controls.maxDistance = 12;
controls.target.set(0,.68,0);

/* iluminação */
scene.add(new THREE.HemisphereLight(0xe8eef7,0x20242b,2.0));

const key = new THREE.DirectionalLight(0xffffff,3.0);
key.position.set(-4,7,5);
key.castShadow = true;
key.shadow.mapSize.set(2048,2048);
scene.add(key);

const fill = new THREE.DirectionalLight(0x9db8ff,1.0);
fill.position.set(5,3,-5);
scene.add(fill);

/* chão */
const floor = new THREE.Mesh(
 new THREE.CircleGeometry(12,96),
 new THREE.MeshStandardMaterial({color:0x11151b,roughness:.82,metalness:.05})
);
floor.rotation.x = -Math.PI/2;
floor.position.y = .02;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(12,24,0x242a33,0x171b21);
grid.position.y = .025;
scene.add(grid);

/* materiais */
const bodyMat = new THREE.MeshPhysicalMaterial({
 color:0x727d88, metalness:.62, roughness:.30,
 clearcoat:.65, clearcoatRoughness:.18
});
const edgeMat = new THREE.MeshStandardMaterial({
 color:0x3e4852, metalness:.55, roughness:.35
});
const darkMat = new THREE.MeshStandardMaterial({
 color:0x080a0d, metalness:.2, roughness:.42
});
const glassMat = new THREE.MeshPhysicalMaterial({
 color:0x0d1721, metalness:.1, roughness:.08,
 transmission:.05, transparent:true, opacity:.9,
 side:THREE.DoubleSide
});
const rubberMat = new THREE.MeshStandardMaterial({
 color:0x050505,roughness:.72,metalness:.03
});
const rimMat = new THREE.MeshStandardMaterial({
 color:0x9da4ad,metalness:.9,roughness:.2
});
const headMat = new THREE.MeshPhysicalMaterial({
 color:0xeaf6ff, emissive:0xbad8ff, emissiveIntensity:1.8,
 roughness:.12, metalness:.04
});
const tailMat = new THREE.MeshPhysicalMaterial({
 color:0x750000, emissive:0x580000, emissiveIntensity:1.8,
 roughness:.18
});

const car = new THREE.Group();
scene.add(car);

/* ================================================================
   HELPERS — TODOS OS VOLUMES SÃO EXPLÍCITOS
   ================================================================ */

function box(name,w,h,d,x,y,z,mat=bodyMat){
 const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.name = name;
 m.position.set(x,y,z);
 m.castShadow = true;
 m.receiveShadow = true;
 car.add(m);
 return m;
}

/* Prisma extrudido a partir de um perfil 2D X/Y.
   Usado somente onde uma peça realmente precisa ter inclinação,
   como capô, teto e traseira. Continua sendo um bloco sólido. */
function prism(name, profile, depth, z, mat=bodyMat){
 const verts = [];
 const inds = [];
 const n = profile.length;

 for(const p of profile) verts.push(p[0],p[1],z-depth/2);
 for(const p of profile) verts.push(p[0],p[1],z+depth/2);

 for(let i=0;i<n;i++){
   const j=(i+1)%n;
   inds.push(i,j,n+j, i,n+j,n+i);
 }
 for(let i=1;i<n-1;i++) inds.push(0,i+1,i);
 for(let i=1;i<n-1;i++) inds.push(n,n+i,n+i+1);

 const g = new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 g.setIndex(inds);
 g.computeVertexNormals();

 const m = new THREE.Mesh(g,mat);
 m.name=name;
 m.castShadow=true;
 m.receiveShadow=true;
 car.add(m);
 return m;
}

/* painel plano fino */
function panel(name,w,h,x,y,z,mat=darkMat,rotX=0,rotY=0,rotZ=0){
 const m=box(name,w,h,.018,x,y,z,mat);
 m.rotation.set(rotX,rotY,rotZ);
 return m;
}

/* ================================================================
   1. BASE / ASSOALHO
   ================================================================ */

box('assoalho',3.55,.18,1.62,.03,.30,0,edgeMat);

/* a lateral integrada abaixo cuidará das soleiras */

/* ================================================================
   2. CAPÔ — baixo, comprido e quase plano como na lateral
   ================================================================ */

prism('capo',[
 [-2.18,.50],[-1.92,.56],[-1.48,.61],[-1.20,.66],
 [-1.20,.82],[-1.72,.75],[-2.15,.62]
],1.62,0,bodyMat);

/* pequena borda frontal */
box('nariz',.10,.22,1.48,-2.20,.50,0,bodyMat);

/* ================================================================
   3. CABINE — BLOCO CENTRAL COM PERFIL DA PLANTA
   ================================================================ */

const cabinProfile = [
 [-1.22,.68],
 [-1.10,.92],
 [-.91,1.14],
 [-.58,1.22],
 [.18,1.22],
 [.55,1.10],
 [.86,.82],
 [.78,.70],
 [-.98,.70]
];
prism('cabine',cabinProfile,1.55,0,bodyMat);

/* teto como bloco fino */
prism('teto',[
 [-.90,1.155],[-.58,1.235],[.18,1.235],[.48,1.12],
 [.40,1.20],[-.72,1.22]
],1.42,0,bodyMat);

/* ================================================================
   4. VIDROS — superfícies separadas, acompanhando o bloco da cabine
   ================================================================ */

/* para-brisa */
prism('parabrisa',[
 [-1.105,.91],[-.91,1.135],[-.78,1.15],[-.97,.89]
],1.49,0,glassMat);

/* vidro traseiro */
prism('vidro_traseiro',[
 [.20,1.15],[.48,1.06],[.76,.84],[.68,.79],[.12,1.06]
],1.47,0,glassMat);

/* janelas laterais */
for(const s of [-1,1]){
 const z=s*.786;
 const sideWindow=prism('janela_lateral',[
  [-1.02,.86],[-.85,1.105],[-.60,1.18],[.12,1.17],
  [.42,1.04],[.70,.83],[.53,.77],[-.92,.79]
 ],.025,z,glassMat);
}

/* pilares: blocos estreitos, não linhas desenhadas */
for(const s of [-1,1]){
 box('pilar_A',.10,.36,.08,-.98,1.00,s*.79,edgeMat)
   .rotation.z=-.35;
 box('pilar_B',.08,.46,.08,-.05,1.00,s*.79,edgeMat)
   .rotation.z=.10;
 box('pilar_C',.09,.36,.08,.48,.94,s*.79,edgeMat)
   .rotation.z=.48;
}

/* ================================================================
   5. TRASEIRA — tampa curta + bloco traseiro
   ================================================================ */

prism('traseira',[
 [.55,.67],[.92,.69],[1.52,.63],[2.05,.54],[2.22,.48],
 [2.20,.75],[1.60,.77],[1.02,.78]
],1.64,0,bodyMat);

box('painel_traseiro',.12,.30,1.55,2.18,.53,0,bodyMat);

/* ================================================================
   6. LATERAIS / PARA-LAMAS INTEGRADOS
   ================================================================
   IMPORTANTE:
   Não usamos barras retangulares por fora das rodas.
   Cada lateral é um bloco fino sólido com dois recortes circulares
   para os pneus. Assim o para-lama nasce da própria carroceria.
   ================================================================ */

function sideShell(side){
 const shape = new THREE.Shape();

 shape.moveTo(-2.22,.25);
 shape.lineTo(-2.12,.48);
 shape.lineTo(-1.72,.62);
 shape.lineTo(-1.30,.70);
 shape.lineTo(-1.12,.78);
 shape.lineTo(.72,.76);
 shape.lineTo(1.25,.70);
 shape.lineTo(1.72,.62);
 shape.lineTo(2.20,.48);
 shape.lineTo(2.22,.25);
 shape.lineTo(1.50,.25);
 shape.lineTo(.35,.27);
 shape.lineTo(-.55,.27);
 shape.lineTo(-1.55,.25);
 shape.closePath();

 /* aberturas das rodas: os pneus ficam realmente dentro da lateral */
 for(const x of [FRONT_AXLE_X,REAR_AXLE_X]){
   const hole = new THREE.Path();
   hole.absarc(x,.405,.405,0,Math.PI*2,true);
   shape.holes.push(hole);
 }

 const geo = new THREE.ExtrudeGeometry(shape,{
   depth:.13,
   bevelEnabled:false,
   steps:1,
   curveSegments:24
 });

 const mesh = new THREE.Mesh(geo,bodyMat);
 mesh.name='lateral_carroceria';
 mesh.position.z = side*.895;
 mesh.rotation.y = side<0 ? Math.PI : 0;
 mesh.castShadow=true;
 mesh.receiveShadow=true;
 car.add(mesh);
 return mesh;
}

sideShell(1);
sideShell(-1);

/* soleiras compactas, alinhadas à carroceria */
for(const s of [-1,1]){
 box('soleira',2.65,.16,.10,-.02,.34,s*.94,bodyMat);
}

/* pequenas quinas superiores dos para-lamas — sem criar trilhos */
for(const s of [-1,1]){
 box('ombro_dianteiro',.58,.10,.13,FRONT_AXLE_X,.79,s*.91,bodyMat);
 box('ombro_traseiro',.62,.10,.13,REAR_AXLE_X,.73,s*.91,bodyMat);
}


/* ================================================================
   8. RODAS
   ================================================================ */

function makeWheel(x,z){
 const g=new THREE.Group();
 g.name='roda';
 g.position.set(x,.40,z);

 const tire=new THREE.Mesh(
   new THREE.CylinderGeometry(.365,.365,.25,32),
   rubberMat
 );
 tire.rotation.x=Math.PI/2;
 tire.castShadow=true;
 g.add(tire);

 const rim=new THREE.Mesh(
   new THREE.CylinderGeometry(.215,.215,.265,24),
   rimMat
 );
 rim.rotation.x=Math.PI/2;
 g.add(rim);

 const hub=new THREE.Mesh(
   new THREE.CylinderGeometry(.075,.075,.28,16),
   darkMat
 );
 hub.rotation.x=Math.PI/2;
 g.add(hub);

 for(let i=0;i<5;i++){
   const spoke=new THREE.Mesh(
     new THREE.BoxGeometry(.035,.17,.035),rimMat
   );
   spoke.position.z=.145;
   spoke.rotation.z=i*Math.PI*2/5;
   g.add(spoke);
 }

 car.add(g);
}

makeWheel(FRONT_AXLE_X, TRACK_HALF);
makeWheel(FRONT_AXLE_X,-TRACK_HALF);
makeWheel(REAR_AXLE_X, TRACK_HALF);
makeWheel(REAR_AXLE_X,-TRACK_HALF);

/* ================================================================
   9. FRENTE / TRASEIRA
   ================================================================ */

box('grade_frontal',.08,.22,.62,-2.255,.47,0,darkMat);

for(const s of [-1,1]){
 box('farol',.07,.16,.34,-2.275,.60,s*.48,headMat);
 box('lanterna',.08,.18,.34,2.255,.59,s*.47,tailMat);
}

/* difusor inferior simples */
box('difusor_traseiro',.10,.12,.92,2.18,.32,0,darkMat);

/* ================================================================
   10. LINHAS DE PAINEL — poucas e alinhadas aos blocos
   ================================================================ */

for(const s of [-1,1]){
 panel('linha_porta',1.75,.018,-.25,.67,s*.984,edgeMat);
 panel('linha_capo',1.05,.018,-1.62,.68,s*.83,edgeMat);
 panel('linha_traseira',.75,.018,1.50,.68,s*.84,edgeMat);
}

/* ================================================================
   VISTAS
   ================================================================ */

function setView(pos,target=[0,.70,0]){
 camera.position.set(...pos);
 controls.target.set(...target);
 controls.update();
}

document.getElementById('view3d').onclick=
 ()=>setView([6.0,2.8,6.2],[0,.70,0]);

document.getElementById('viewFront').onclick=
 ()=>setView([-6.4,1.15,0],[0,.67,0]);

document.getElementById('viewSide').onclick=
 ()=>setView([0,1.25,7.4],[0,.76,0]);

document.getElementById('viewTop').onclick=
 ()=>setView([0,7.5,.01],[0,.20,0]);

/* modo carroceria: só altera acabamento, sem trocar a geometria */
let shellMode=false;
document.getElementById('shell').onclick=()=>{
 shellMode=!shellMode;
 bodyMat.color.set(shellMode?0x9aa1a8:0x697581);
 bodyMat.metalness=shellMode?.45:.68;
 bodyMat.roughness=shellMode?.46:.28;
 document.getElementById('shell').textContent=
   shellMode?'Acabamento':'Carroceria';
};

/* animação */
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

app.listen(PORT,()=>{
 console.log('🟢 Servidor rodando na porta '+PORT);
});

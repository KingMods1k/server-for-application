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
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif}
#app{position:fixed;inset:0}canvas{display:block}
.hud{position:fixed;left:18px;top:18px;z-index:5;color:#fff;background:rgba(8,10,14,.72);
border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(12px);border-radius:14px;
padding:14px 16px;line-height:1.45;max-width:350px}
.hud b{font-size:16px}.hud small{opacity:.7}
.badge{display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px}
.controls{position:fixed;right:18px;bottom:18px;z-index:5;display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
button{border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.82);color:white;border-radius:10px;padding:10px 12px}
</style>
</head>
<body>
<div id="app"></div>
<div class="hud">
<b>Modelo 3D — carroceria</b><br>
<small>Geometria refeita a partir das quatro vistas da planta</small><br>
<span class="badge">4480 × 1950 × 1250 mm</span>
<span class="badge">Entre-eixos: 2475 mm</span><br><br>
Arraste para girar · roda do mouse para zoom
</div>
<div class="controls">
<button id="view3d">3D</button><button id="viewFront">Frente</button>
<button id="viewSide">Lateral</button><button id="viewTop">Superior</button>
<button id="shell">Carroceria</button>
</div>

<script type="importmap">
{"imports":{
"three":"https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.module.js",
"three/addons/":"https://cdn.jsdelivr.net/npm/three@0.179.1/examples/jsm/"
}}
</script>

<script type="module">
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

/*
 * VERSÃO 3
 * ---------------------------------------------------------------
 * A carroceria NÃO é uma extrusão e NÃO é um loft com seção que
 * colapsa no teto.
 *
 * Cada estação X possui 12 pontos em uma seção fechada:
 * fundo -> lateral -> cintura -> ombro -> teto -> espelho.
 *
 * A largura do teto é SEMPRE > 0. Isso mantém a cabine sólida.
 * A largura máxima acompanha a vista superior da planta.
 */

/* ---------------- DIMENSÕES DA PLANTA ---------------- */
const NOSE=-2.240;
const TAIL= 2.240;
const FRONT_AXLE=-1.310;
const REAR_AXLE=1.165;
const TRACK=0.790;

/*
 * Perfil lateral: x / altura do topo.
 * Mais pontos nas transições capô/pilar/teto/traseira.
 */
const P=[
[-2.240,.52],[-2.18,.545],[-2.08,.585],[-1.95,.635],
[-1.78,.685],[-1.60,.715],[-1.45,.728],[-1.31,.735],
[-1.20,.78],[-1.11,.92],[-1.03,1.075],[-.94,1.20],
[-.82,1.245],[-.62,1.255],[-.40,1.258],[-.18,1.255],
[.02,1.248],[.11,1.235],[.22,1.19],[.34,1.10],
[.46,.995],[.57,.90],[.70,.82],[.84,.765],
[1.00,.725],[1.165,.70],[1.35,.675],[1.55,.65],
[1.75,.625],[1.94,.595],[2.10,.56],[2.20,.535],[2.24,.525]
];

/* Meia-largura da carroceria na vista superior. */
const W=[
[-2.240,.50],[-2.18,.58],[-2.08,.68],[-1.95,.78],
[-1.78,.87],[-1.60,.93],[-1.45,.96],[-1.31,.975],
[-1.20,.975],[-1.05,.965],[-.85,.95],[-.60,.925],
[-.35,.91],[-.10,.905],[.11,.91],[.30,.93],
[.50,.95],[.70,.965],[.90,.975],[1.10,.97],
[1.30,.96],[1.50,.945],[1.70,.92],[1.90,.87],
[2.05,.80],[2.18,.68],[2.24,.50]
];

function clamp(t){return Math.max(0,Math.min(1,t))}
function sstep(t){t=clamp(t);return t*t*(3-2*t)}

function sample(arr,x){
 if(x<=arr[0][0])return arr[0][1];
 if(x>=arr[arr.length-1][0])return arr[arr.length-1][1];
 for(let i=0;i<arr.length-1;i++){
  const a=arr[i],b=arr[i+1];
  if(x>=a[0]&&x<=b[0]){
   const t=sstep((x-a[0])/(b[0]-a[0]));
   return a[1]+(b[1]-a[1])*t;
  }
 }
 return arr[arr.length-1][1];
}

const topAt=x=>sample(P,x);
const widthAt=x=>sample(W,x);

/*
 * Altura da cintura.
 * O carro tem uma barriga lateral real, em vez de uma caixa.
 */
function sectionBottom(x){
 let y=.145;
 if(x<FRONT_AXLE-.55)y+=.045*sstep((FRONT_AXLE-.55-x)/.38);
 if(x>REAR_AXLE+.55)y+=.04*sstep((x-(REAR_AXLE+.55))/.40);
 return y;
}

/*
 * Largura do teto.
 * É estreito na cabine, mas nunca zero.
 * Capô e tampa usam uma largura menor e arredondada.
 */
function roofHalfWidth(x){
 if(x<-1.18)return widthAt(x)*.62;
 if(x>.62)return widthAt(x)*.62;
 return .72 + .035*Math.cos((x+.28)*2.2);
}

/*
 * Gera uma seção transversal.
 *
 * t = 0   centro do fundo
 * t = .25  lateral inferior
 * t = .50  cintura
 * t = .75  ombro
 * t = 1    teto
 *
 * A metade esquerda é espelhada.
 */
function makeSection(x){
 const w=widthAt(x);
 const rw=roofHalfWidth(x);
 const bottom=sectionBottom(x);
 const top=topAt(x);
 const points=[];

 const half=16;

 // Lado direito: fundo -> cintura -> teto
 for(let i=0;i<=half;i++){
  const t=i/half;

  let z;
  let y;

  if(t<=.55){
   const q=t/.55;
   // largura cresce rapidamente até a cintura
   z=w*sstep(q);
   y=bottom+(top*.67-bottom)*sstep(q);
  }else{
   const q=(t-.55)/.45;
   // do ombro até o teto: largura volta para rw, não para zero
   z=w+(rw-w)*sstep(q);
   y=top*.67+(top-top*.67)*sstep(q);
  }

  // pequena curvatura do ombro
  if(t>.55){
   const q=(t-.55)/.45;
   y+=.018*Math.sin(q*Math.PI);
  }

  points.push(new THREE.Vector3(x,y,z));
 }

 // Lado esquerdo: teto -> fundo
 for(let i=half-1;i>=0;i--){
  const t=i/half;

  let z,y;

  if(t<=.55){
   const q=t/.55;
   z=w*sstep(q);
   y=bottom+(top*.67-bottom)*sstep(q);
  }else{
   const q=(t-.55)/.45;
   z=w+(rw-w)*sstep(q);
   y=top*.67+(top-top*.67)*sstep(q);
  }

  if(t>.55){
   const q=(t-.55)/.45;
   y+=.018*Math.sin(q*Math.PI);
  }

  points.push(new THREE.Vector3(x,y,-z));
 }

 return points;
}

/*
 * Loft fechado ao longo de X.
 * 97 estações deixam a superfície suave.
 */
const STATIONS=97;
const sections=[];
const vertices=[];
const RING=32;

for(let i=0;i<STATIONS;i++){
 const x=NOSE+(TAIL-NOSE)*(i/(STATIONS-1));
 const sec=makeSection(x);
 sections.push(sec);

 for(const p of sec)vertices.push(p.x,p.y,p.z);
}

const indices=[];

for(let i=0;i<STATIONS-1;i++){
 for(let j=0;j<RING;j++){
  const a=i*RING+j;
  const b=i*RING+((j+1)%RING);
  const c=(i+1)*RING+((j+1)%RING);
  const d=(i+1)*RING+j;

  indices.push(a,b,d,b,c,d);
 }
}

const bodyGeo=new THREE.BufferGeometry();
bodyGeo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
bodyGeo.setIndex(indices);
bodyGeo.computeVertexNormals();

/* ---------------- MATERIAIS ---------------- */
const bodyMat=new THREE.MeshPhysicalMaterial({
 color:0x7c8791,metalness:.78,roughness:.24,
 clearcoat:.65,clearcoatRoughness:.16,side:THREE.DoubleSide
});

const darkMat=new THREE.MeshStandardMaterial({
 color:0x090b0e,metalness:.25,roughness:.38
});

const glassMat=new THREE.MeshPhysicalMaterial({
 color:0x101821,metalness:.15,roughness:.08,
 transmission:.08,transparent:true,opacity:.86,
 side:THREE.DoubleSide
});

const rubberMat=new THREE.MeshStandardMaterial({
 color:0x050505,roughness:.72,metalness:.05
});

const rimMat=new THREE.MeshStandardMaterial({
 color:0x9da4ad,metalness:.92,roughness:.18
});

const lampMat=new THREE.MeshPhysicalMaterial({
 color:0xe9f5ff,emissive:0xbad8ff,emissiveIntensity:2.2,
 roughness:.12,metalness:.05
});

const redLampMat=new THREE.MeshPhysicalMaterial({
 color:0x6b0000,emissive:0x610000,emissiveIntensity:2,
 roughness:.18
});

const car=new THREE.Group();

/*
 ---------------- VIDROS LATERAIS ----------------
 O formato acompanha a lateral da planta e fica apenas sobre a
 superfície, sem cortar a carroceria.
 */
function sideWindow(side){
 const z=side*.91;
 const shape=new THREE.Shape();

 shape.moveTo(-1.04,.80);
 shape.lineTo(-.95,1.105);
 shape.quadraticCurveTo(-.78,1.20,-.50,1.225);
 shape.quadraticCurveTo(-.20,1.235,.10,1.205);
 shape.lineTo(.48,.87);
 shape.quadraticCurveTo(.18,.83,-.22,.815);
 shape.quadraticCurveTo(-.70,.80,-1.04,.80);

 const geo=new THREE.ShapeGeometry(shape,20);
 const mesh=new THREE.Mesh(geo,glassMat);
 mesh.position.z=z;
 if(side<0)mesh.rotation.y=Math.PI;
 car.add(mesh);
}
sideWindow(1);
sideWindow(-1);

/*
 Para-brisa e vidro traseiro como painéis curvos.
 */
function glassPanel(points,depth){
 const curve=new THREE.CatmullRomCurve3(
  points.map(p=>new THREE.Vector3(p[0],p[1],0))
 );
 const geo=new THREE.TubeGeometry(curve,32,.017,8,false);
 const mesh=new THREE.Mesh(geo,glassMat);
 mesh.scale.z=depth;
 car.add(mesh);
}

glassPanel([
 [-1.20,.79],[-1.14,.88],[-1.08,.99],[-1.01,1.115],[-.94,1.205]
],1.43);

glassPanel([
 [.10,1.205],[.19,1.16],[.29,1.08],[.40,.98],[.51,.86]
],1.39);

/* ---------------- RODAS ---------------- */
function makeWheel(x,z){
 const g=new THREE.Group();
 g.position.set(x,.37,z);

 const tire=new THREE.Mesh(
  new THREE.CylinderGeometry(.37,.37,.26,48),rubberMat
 );
 tire.rotation.x=Math.PI/2;
 tire.castShadow=true;
 g.add(tire);

 const rim=new THREE.Mesh(
  new THREE.CylinderGeometry(.225,.225,.275,32),rimMat
 );
 rim.rotation.x=Math.PI/2;
 g.add(rim);

 const hub=new THREE.Mesh(
  new THREE.CylinderGeometry(.085,.085,.285,20),darkMat
 );
 hub.rotation.x=Math.PI/2;
 g.add(hub);

 for(let i=0;i<5;i++){
  const spoke=new THREE.Mesh(
   new THREE.BoxGeometry(.03,.20,.035),rimMat
  );
  spoke.position.z=.145;
  spoke.rotation.z=i*Math.PI*2/5;
  g.add(spoke);
 }
 car.add(g);
}

makeWheel(FRONT_AXLE,TRACK);
makeWheel(FRONT_AXLE,-TRACK);
makeWheel(REAR_AXLE,TRACK);
makeWheel(REAR_AXLE,-TRACK);

/* ---------------- FRENTE/TRASEIRA ---------------- */
function box(w,h,d,mat,x,y,z){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.position.set(x,y,z);
 m.castShadow=true;
 car.add(m);
 return m;
}

box(.10,.18,.52,darkMat,NOSE-.025,.40,0);

for(const side of [1,-1])
 box(.08,.18,.34,lampMat,NOSE-.015,.57,side*.46);

for(const side of [1,-1])
 box(.09,.19,.34,redLampMat,TAIL+.02,.57,side*.45);

for(const z of [-.40,.40]){
 const ex=new THREE.Mesh(new THREE.CylinderGeometry(.065,.065,.18,20),darkMat);
 ex.rotation.z=Math.PI/2;
 ex.position.set(TAIL+.04,.31,z);
 car.add(ex);
}

/* ---------------- CENA ---------------- */
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x090b0f);

const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);
camera.position.set(6.4,3,6.6);

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;

document.getElementById('app').appendChild(renderer.domElement);

const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.07;
controls.minDistance=3.2;
controls.maxDistance=12;
controls.target.set(0,.72,0);

scene.add(new THREE.HemisphereLight(0xdfe9ff,0x20242c,2));

const key=new THREE.DirectionalLight(0xffffff,3);
key.position.set(-4,7,5);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
scene.add(key);

const fill=new THREE.DirectionalLight(0x9db8ff,1.2);
fill.position.set(5,3,-5);
scene.add(fill);

const floor=new THREE.Mesh(
 new THREE.CircleGeometry(12,96),
 new THREE.MeshStandardMaterial({color:0x11151b,roughness:.82,metalness:.05})
);
floor.rotation.x=-Math.PI/2;
floor.position.y=.02;
floor.receiveShadow=true;
scene.add(floor);

const grid=new THREE.GridHelper(12,24,0x242a33,0x171b21);
grid.position.y=.025;
scene.add(grid);

scene.add(car);
car.traverse(o=>{
 if(o.isMesh){o.castShadow=true;o.receiveShadow=true}
});

/* ---------------- VISTAS ---------------- */
function setView(pos,target){
 camera.position.set(...pos);
 controls.target.set(...target);
 controls.update();
}

view3d.onclick=()=>setView([6.4,3,6.6],[0,.72,0]);
viewFront.onclick=()=>setView([-6.3,1.2,0],[0,.72,0]);
viewSide.onclick=()=>setView([0,1.4,7.2],[0,.78,0]);
viewTop.onclick=()=>setView([0,7.5,.01],[0,.15,0]);

let shellMode=false;
shell.onclick=()=>{
 shellMode=!shellMode;
 bodyMat.color.set(shellMode?0x9aa1a8:0x7c8791);
 bodyMat.metalness=shellMode?.48:.78;
 bodyMat.roughness=shellMode?.48:.24;
 shell.textContent=shellMode?'Acabamento':'Carroceria';
};

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

app.listen(PORT,()=>console.log('🟢 Servidor rodando na porta '+PORT));

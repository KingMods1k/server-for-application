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
<title>Carro 3D — carroceria baseada na planta</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{
 position:fixed;left:18px;top:18px;z-index:5;color:#fff;
 background:rgba(8,10,14,.72);border:1px solid rgba(255,255,255,.12);
 backdrop-filter:blur(12px);border-radius:14px;padding:14px 16px;
 line-height:1.45;max-width:340px
}
.hud b{font-size:16px}.hud small{opacity:.7}
.badge{
 display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;
 background:rgba(255,255,255,.08);font-size:11px
}
.controls{
 position:fixed;right:18px;bottom:18px;z-index:5;
 display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end
}
button{
 border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.82);
 color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer
}
</style>
</head>
<body>

<div id="app"></div>

<div class="hud">
 <b>Modelo 3D — carroceria</b><br>
 <small>Loft da carroceria seguindo as proporções da planta técnica</small><br>
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
 CARROCERIA — LOFT POR ESTAÇÕES
 ----------------------------------------------------------------
 Em vez de extrudar um único perfil, a carroceria é construída
 por várias seções ao longo do comprimento. Isso permite que:
 - a largura mude continuamente;
 - capô, teto e tampa traseira tenham curvas;
 - os ombros laterais sejam arredondados;
 - o teto fique mais estreito que a cintura;
 - frente e traseira afunilem;
 - a silhueta lateral continue baseada na planta.

 Dimensões principais da planta:
 comprimento 4480 mm
 largura     1950 mm
 altura      1250 mm
 entre-eixos 2475 mm
 balanço F    930 mm
 balanço T   1075 mm
 ================================================================
*/

const LENGTH = 4.480;
const WIDTH  = 1.950;
const HEIGHT = 1.250;

const FRONT_X = -2.240;
const REAR_X  =  2.240;
const FRONT_AXLE_X = FRONT_X + 0.930; // -1.310
const REAR_AXLE_X  = FRONT_AXLE_X + 2.475; // 1.165

const TRACK_HALF = 0.790; // 1580 mm de bitola
const BODY_MAX_HALF = WIDTH / 2;

/*
 Perfil lateral retirado visualmente da planta.
 O importante aqui é a tendência da curva, não uma sequência
 de caixas retas.
*/
const SIDE_X = [
 -2.240,-2.160,-2.020,-1.850,-1.650,-1.430,-1.310,
 -1.200,-1.090,-0.970,-0.820,-0.600,-0.300,0.000,
  0.110,0.260,0.420,0.560,0.720,0.900,1.165,
  1.380,1.620,1.850,2.050,2.200,2.240
];

const SIDE_TOP = [
 0.520,0.560,0.620,0.675,0.710,0.725,0.735,
 0.790,0.980,1.155,1.235,1.250,1.255,1.250,
 1.240,1.185,1.065,0.915,0.800,0.735,0.700,
 0.670,0.635,0.600,0.570,0.545,0.530
];

function lerp(a,b,t){return a+(b-a)*t}

function smoothstep(t){
 t=Math.max(0,Math.min(1,t));
 return t*t*(3-2*t);
}

function sampleCurve(xs,ys,x){
 if(x<=xs[0]) return ys[0];
 if(x>=xs[xs.length-1]) return ys[ys.length-1];

 for(let i=0;i<xs.length-1;i++){
  if(x>=xs[i] && x<=xs[i+1]){
   const t=smoothstep((x-xs[i])/(xs[i+1]-xs[i]));
   return lerp(ys[i],ys[i+1],t);
  }
 }
 return ys[ys.length-1];
}

const topAt = x => sampleCurve(SIDE_X,SIDE_TOP,x);

/*
 Largura da carroceria:
 - ponta estreita;
 - região dos para-lamas mais larga;
 - cabine ligeiramente mais estreita;
 - traseira novamente arredondada.
*/
function widthAt(x){
 const a = Math.abs(x);

 if(x < -1.95) return lerp(0.52,0.88,smoothstep((x+2.24)/0.29));
 if(x < -1.45) return lerp(0.88,0.975,smoothstep((x+1.95)/0.50));
 if(x < -0.95) return lerp(0.975,0.965,smoothstep((x+1.45)/0.50));
 if(x <  0.25) return lerp(0.965,0.930,smoothstep((x+0.95)/1.20));
 if(x <  0.95) return lerp(0.930,0.975,smoothstep((x-0.25)/0.70));
 if(x <  1.55) return lerp(0.975,0.940,smoothstep((x-0.95)/0.60));
 if(x <  2.05) return lerp(0.940,0.76,smoothstep((x-1.55)/0.50));
 return lerp(0.76,0.52,smoothstep((x-2.05)/0.19));
}

/*
 A cintura fica próxima dos 950-975 mm de meia largura.
 O teto é mais estreito, reproduzindo a vista superior da planta.
*/
function roofWidthAt(x){
 const t = topAt(x);

 // Capô e porta-malas: teto não existe como cabine.
 if(x < -1.15 || x > 0.68){
  return widthAt(x) * 0.72;
 }

 // cabine: teto com ombros arredondados
 const cabinT = smoothstep((x+1.15)/1.83);
 const shoulder = lerp(0.70,0.78,cabinT);
 return shoulder;
}

/*
 Altura inferior do casco.
 O fundo sobe nas regiões das rodas para não parecer uma caixa
 sólida passando através dos pneus.
*/
function bottomAt(x, side){
 let y=0.145;

 function arch(cx,rise,radius){
  const d=Math.abs(x-cx);
  if(d<radius){
   const q=1-d/radius;
   return rise*q*q;
  }
  return 0;
 }

 // abertura visual dos arcos dianteiro/traseiro
 const front=arch(FRONT_AXLE_X,0.135,0.43);
 const rear =arch(REAR_AXLE_X ,0.135,0.43);

 // A subida é mais visível nas laterais externas.
 if(Math.abs(side)>0.72) y += Math.max(front,rear);

 // nariz e traseira sobem conforme a planta
 if(x<FRONT_AXLE_X-0.55){
  y += 0.14*smoothstep((FRONT_AXLE_X-0.55-x)/0.38);
 }
 if(x>REAR_AXLE_X+0.55){
  y += 0.12*smoothstep((x-(REAR_AXLE_X+0.55))/0.40);
 }

 return y;
}

/* ================================================================
   CENA
================================================================ */
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x090b0f);

const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,0.01,100);
camera.position.set(6.4,3.0,6.6);

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

/* iluminação */
scene.add(new THREE.HemisphereLight(0xdfe9ff,0x20242c,2));

const key=new THREE.DirectionalLight(0xffffff,3);
key.position.set(-4,7,5);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
scene.add(key);

const fill=new THREE.DirectionalLight(0x9db8ff,1.2);
fill.position.set(5,3,-5);
scene.add(fill);

/* chão */
const floor=new THREE.Mesh(
 new THREE.CircleGeometry(12,96),
 new THREE.MeshStandardMaterial({
  color:0x11151b,roughness:.82,metalness:.05
 })
);
floor.rotation.x=-Math.PI/2;
floor.position.y=.02;
floor.receiveShadow=true;
scene.add(floor);

const grid=new THREE.GridHelper(12,24,0x242a33,0x171b21);
grid.position.y=.025;
scene.add(grid);

/* materiais */
const bodyMat=new THREE.MeshPhysicalMaterial({
 color:0x707b86,
 metalness:.72,
 roughness:.25,
 clearcoat:.75,
 clearcoatRoughness:.14,
 side:THREE.DoubleSide
});

const darkMat=new THREE.MeshStandardMaterial({
 color:0x090b0e,metalness:.25,roughness:.38
});

const glassMat=new THREE.MeshPhysicalMaterial({
 color:0x101821,
 metalness:.15,
 roughness:.08,
 transmission:.08,
 transparent:true,
 opacity:.86,
 side:THREE.DoubleSide
});

const rubberMat=new THREE.MeshStandardMaterial({
 color:0x050505,roughness:.72,metalness:.05
});

const rimMat=new THREE.MeshStandardMaterial({
 color:0x9da4ad,metalness:.92,roughness:.18
});

const lampMat=new THREE.MeshPhysicalMaterial({
 color:0xe9f5ff,
 emissive:0xbad8ff,
 emissiveIntensity:2.2,
 roughness:.12,
 metalness:.05
});

const redLampMat=new THREE.MeshPhysicalMaterial({
 color:0x6b0000,
 emissive:0x610000,
 emissiveIntensity:2,
 roughness:.18
});

const car=new THREE.Group();
scene.add(car);

/* ================================================================
   LOFT DA CARROCERIA
   Cada estação possui uma seção transversal personalizada.
================================================================ */

const STATIONS=81;
const SECTION_POINTS=20;

function sectionPoint(x,i){
 const w=widthAt(x);
 const roofW=roofWidthAt(x);
 const top=topAt(x);
 const bottom=bottomAt(x);

 /*
  i percorre o contorno inteiro:
  centro inferior -> lateral inferior -> cintura -> ombro -> teto
  -> espelho do outro lado.
 */
 const u=i/(SECTION_POINTS-1);

 // metade 0..1, depois espelha
 const side=u<=.5 ? u*2 : (1-u)*2;

 // largura horizontal
 let z;

 if(u<=.5){
  z=lerp(0,w,side);
 }else{
  z=lerp(w,0,side);
 }

 // Perfil vertical do corte.
 // Base larga, cintura larga, ombro arredondado e teto estreito.
 let y;

 if(side<.20){
  y=lerp(bottom, bottom+0.07, side/.20);
 }else if(side<.52){
  y=lerp(bottom+0.07, top*0.68, (side-.20)/.32);
 }else if(side<.78){
  y=lerp(top*0.68, top-0.07, (side-.52)/.26);
 }else{
  y=lerp(top-0.07, top, (side-.78)/.22);
 }

 // Afunila a parte alta da carroceria.
 if(side>.58){
  const roofBlend=smoothstep((side-.58)/.42);
  z=lerp(z, roofW*(side-.58)/.42, roofBlend);
 }

 return {x,y,z};
}

const vertices=[];
const indices=[];

for(let s=0;s<STATIONS;s++){
 const t=s/(STATIONS-1);
 const x=lerp(FRONT_X,REAR_X,t);

 for(let i=0;i<SECTION_POINTS;i++){
  const p=sectionPoint(x,i);
  vertices.push(p.x,p.y,p.z);
 }
}

for(let s=0;s<STATIONS-1;s++){
 for(let i=0;i<SECTION_POINTS-1;i++){
  const a=s*SECTION_POINTS+i;
  const b=a+1;
  const c=(s+1)*SECTION_POINTS+i+1;
  const d=(s+1)*SECTION_POINTS+i;

  indices.push(a,b,d);
  indices.push(b,c,d);
 }
}

const bodyGeo=new THREE.BufferGeometry();
bodyGeo.setAttribute(
 'position',
 new THREE.Float32BufferAttribute(vertices,3)
);
bodyGeo.setIndex(indices);
bodyGeo.computeVertexNormals();

const bodyMesh=new THREE.Mesh(bodyGeo,bodyMat);
bodyMesh.castShadow=true;
bodyMesh.receiveShadow=true;
car.add(bodyMesh);

/* ================================================================
   PAINÉIS LATERAIS
   Faixas discretas ajudam a dar leitura de carroceria sem destruir
   a forma principal.
================================================================ */
function panelStrip(x1,x2,y1,y2,z,material,curve=0){
 const pts=[
  new THREE.Vector3(x1,y1,z),
  new THREE.Vector3((x1+x2)/2,(y1+y2)/2+curve,z),
  new THREE.Vector3(x2,y2,z)
 ];

 const curve3=new THREE.CatmullRomCurve3(pts);
 const geo=new THREE.TubeGeometry(curve3,18,.012,8,false);
 const mesh=new THREE.Mesh(geo,material);
 mesh.castShadow=true;
 car.add(mesh);
 return mesh;
}

panelStrip(-1.82,0.82,.56,.61,.978,darkMat,.025);

/* ================================================================
   VIDROS
   Agora seguem as curvas do teto, em vez de caixas retangulares.
================================================================ */
function makeGlassSurface(points,width){
 const curve=new THREE.CatmullRomCurve3(
  points.map(p=>new THREE.Vector3(p[0],p[1],0))
 );
 const tube=new THREE.TubeGeometry(curve,32,.018,8,false);

 // achata o tubo na direção Z para virar um painel fino
 const pos=tube.attributes.position;
 for(let i=0;i<pos.count;i++){
  pos.setZ(i,pos.getZ(i));
 }
 const mesh=new THREE.Mesh(tube,glassMat);
 mesh.scale.z=width;
 mesh.castShadow=true;
 car.add(mesh);
 return mesh;
}

/* para-brisa — curva contínua baseada no pilar A */
makeGlassSurface([
 [-1.19,.77],
 [-1.10,.96],
 [-1.00,1.14],
 [-.92,1.22]
],1.43);

/* vidro traseiro — queda progressiva */
makeGlassSurface([
 [.10,1.205],
 [.22,1.12],
 [.34,1.01],
 [.47,.88],
 [.53,.80]
],1.38);

/*
 Vidros laterais como superfícies planas inclinadas, acompanhando
 a linha do teto.
*/
function sideWindow(side){
 const z=side*0.875;

 const shape=new THREE.Shape();
 shape.moveTo(-.98,.84);
 shape.lineTo(-.87,1.13);
 shape.quadraticCurveTo(-.52,1.22,-.05,1.205);
 shape.lineTo(.42,.90);
 shape.quadraticCurveTo(-.15,.83,-.98,.84);

 const geo=new THREE.ShapeGeometry(shape,12);
 const mesh=new THREE.Mesh(geo,glassMat);
 mesh.rotation.y=side>0?0:Math.PI;
 mesh.position.z=z;
 mesh.scale.x=1;
 mesh.castShadow=true;
 car.add(mesh);
}

sideWindow(1);
sideWindow(-1);

/* ================================================================
   RODAS
================================================================ */
const wheels=[];

function makeWheel(x,z){
 const g=new THREE.Group();
 g.position.set(x,.38,z);

 const tire=new THREE.Mesh(
  new THREE.CylinderGeometry(.37,.37,.26,48),
  rubberMat
 );
 tire.rotation.x=Math.PI/2;
 tire.castShadow=true;
 g.add(tire);

 const rim=new THREE.Mesh(
  new THREE.CylinderGeometry(.225,.225,.275,32),
  rimMat
 );
 rim.rotation.x=Math.PI/2;
 g.add(rim);

 const hub=new THREE.Mesh(
  new THREE.CylinderGeometry(.085,.085,.285,20),
  darkMat
 );
 hub.rotation.x=Math.PI/2;
 g.add(hub);

 for(let i=0;i<5;i++){
  const spoke=new THREE.Mesh(
   new THREE.BoxGeometry(.03,.20,.035),
   rimMat
  );
  spoke.position.z=.145;
  spoke.rotation.z=i*Math.PI*2/5;
  g.add(spoke);
 }

 car.add(g);
 wheels.push(g);
}

makeWheel(FRONT_AXLE_X, TRACK_HALF);
makeWheel(FRONT_AXLE_X,-TRACK_HALF);
makeWheel(REAR_AXLE_X,TRACK_HALF);
makeWheel(REAR_AXLE_X,-TRACK_HALF);

/* ================================================================
   FRENTE / TRASEIRA
================================================================ */
function box(w,h,d,mat,x,y,z){
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 m.position.set(x,y,z);
 m.castShadow=true;
 car.add(m);
 return m;
}

/* grade */
box(.10,.18,.52,darkMat,FRONT_X-.025,.40,0);

/* faróis mais integrados à frente */
for(const s of [1,-1]){
 box(.08,.18,.34,lampMat,FRONT_X-.015,.57,s*.46);
}

/* lanternas */
for(const s of [1,-1]){
 box(.09,.19,.34,redLampMat,REAR_X+.02,.57,s*.45);
}

/* escapamentos */
for(const z of [-.40,.40]){
 const ex=new THREE.Mesh(
  new THREE.CylinderGeometry(.065,.065,.18,20),
  darkMat
 );
 ex.rotation.z=Math.PI/2;
 ex.position.set(REAR_X+.04,.31,z);
 car.add(ex);
}

/* ================================================================
   VISTAS
================================================================ */
function setView(pos,target){
 camera.position.set(...pos);
 controls.target.set(...target);
 controls.update();
}

document.getElementById('view3d').onclick=
 ()=>setView([6.4,3,6.6],[0,.72,0]);

document.getElementById('viewFront').onclick=
 ()=>setView([-6.3,1.15,0],[0,.70,0]);

document.getElementById('viewSide').onclick=
 ()=>setView([0,1.35,7.2],[0,.78,0]);

document.getElementById('viewTop').onclick=
 ()=>setView([0,7.5,.01],[0,.15,0]);

/* ================================================================
   MODO CARROCERIA
================================================================ */
let shellMode=false;

document.getElementById('shell').onclick=()=>{
 shellMode=!shellMode;

 bodyMat.color.set(shellMode?0x9aa1a8:0x707b86);
 bodyMat.metalness=shellMode?.48:.72;
 bodyMat.roughness=shellMode?.48:.25;

 document.getElementById('shell').textContent=
  shellMode?'Acabamento':'Carroceria';
};

/* ================================================================
   ANIMAÇÃO
================================================================ */
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

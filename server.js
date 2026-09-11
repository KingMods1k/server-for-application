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
<title>Carro 3D — carroceria por blocos</title>
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
<div id="status" style="position:fixed;left:18px;top:150px;z-index:10;padding:10px 12px;border-radius:9px;background:rgba(0,0,0,.78);color:#fff;font:12px Arial">Inicializando 3D…</div>
<div class="hud">
 <b>Modelo 3D — carroceria por blocos</b><br>
 <small>Casco baixo em segmentos retos, capô e vigia inclinados, cabine trapezoidal com vidros, para-choques, faróis, lanternas e aerofólios — todos blocos simples posicionados pelas cotas reais da planta.</small><br>
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
   COTAS DA PLANTA TÉCNICA — mm, X=0 no nariz
   ================================================================ */
const LENGTH = 4480, WIDTH = 1950, HEIGHT = 1250;
const HALF_TRACK = 1580/2, WHEELBASE = 2475;
const FRONT_OVERHANG = 930, REAR_OVERHANG = 1075;
const WHEEL_R = 335, WHEEL_W = 235;
const M2MM = 0.001;
const BOTTOM_Y = 205; // altura da soleira/assoalho

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);
scene.fog = new THREE.Fog(0x090b0f, 12, 25);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, 0.01, 100);
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
  body: new THREE.MeshPhysicalMaterial({color:0x69747e, metalness:.58, roughness:.28, clearcoat:.8, clearcoatRoughness:.12, side:THREE.DoubleSide}),
  body2: new THREE.MeshPhysicalMaterial({color:0x525c66, metalness:.52, roughness:.34, side:THREE.DoubleSide}),
  glass: new THREE.MeshPhysicalMaterial({color:0x3f5670, metalness:.1, roughness:.08, transmission:.45, transparent:true, opacity:.9, clearcoat:.4, side:THREE.DoubleSide}),
  rubber: new THREE.MeshStandardMaterial({color:0x080a0d, roughness:.72, metalness:.05}),
  rim: new THREE.MeshStandardMaterial({color:0x8b949c, roughness:.22, metalness:.88}),
  lamp: new THREE.MeshStandardMaterial({color:0xdce8f2, roughness:.16, metalness:.3}),
  red: new THREE.MeshStandardMaterial({color:0x8e1116, roughness:.28, metalness:.15}),
  black: new THREE.MeshStandardMaterial({color:0x07090c, roughness:.55, metalness:.2}),
  white: new THREE.MeshStandardMaterial({color:0xe8ebee, roughness:.35, metalness:.15})
};

const car = new THREE.Group();
scene.add(car);
const shell = new THREE.Group();
car.add(shell);
const wheels = new THREE.Group();
car.add(wheels);
const originOffset = -LENGTH*M2MM/2;

function box(wMm, hMm, dMm, xMm, yMm, zMm, mat, name, parent=shell, rz=0){
  const o = new THREE.Mesh(new THREE.BoxGeometry(wMm*M2MM, hMm*M2MM, dMm*M2MM), mat);
  o.name = name;
  o.castShadow = true; o.receiveShadow = true;
  o.rotation.z = rz;
  o.position.set(xMm*M2MM + originOffset, yMm*M2MM, zMm*M2MM);
  parent.add(o);
  return o;
}

/* ================================================================
   CASCO — poucos segmentos retos e largos, baixos (até a cintura,
   ~430mm), seguindo a largura real de cada trecho da planta (vista
   de topo): nariz estreito, alarga nos para-lamas dianteiros, afina
   na cintura das portas, alarga mais nos para-lamas traseiros
   (característico do desenho), estreita na traseira.
   ================================================================ */
const BELT_Y = 430;
const hullSegs = [
  { x0:0,    x1:280,  w:900  }, // nariz
  { x0:280,  x1:700,  w:1820 }, // para-lama dianteiro (alarga)
  { x0:700,  x1:1180, w:1900 }, // capô/base do para-brisa
  { x0:1180, x1:1900, w:1780 }, // porta dianteira
  { x0:1900, x1:2830, w:1770 }, // porta traseira / cintura
  { x0:2830, x1:3550, w:1900 }, // para-lama traseiro (alarga mais)
  { x0:3550, x1:4050, w:1780 }, // traseira lateral
  { x0:4050, x1:4480, w:900  }, // rabo
];
for(const s of hullSegs){
  const xC = (s.x0+s.x1)/2, len = s.x1-s.x0;
  box(len*1.04, BELT_Y-BOTTOM_Y, s.w, xC, (BOTTOM_Y+BELT_Y)/2, 0, M.body, 'casco-'+s.x0);
}

/* ================================================================
   CAPÔ — painel único inclinado do nariz até a base do para-brisa.
   ================================================================ */
const capoX0 = 150, capoX1 = 999;
const capoY0 = 560, capoY1 = BELT_Y+60;
{
  const xC=(capoX0+capoX1)/2, yC=(capoY0+capoY1)/2;
  const len = Math.hypot(capoX1-capoX0, capoY1-capoY0);
  const capo = box(len, 20, 1750, xC, yC, 0, M.body2, 'capo');
  capo.rotation.z = Math.atan2(capoY1-capoY0, capoX1-capoX0);
}

/* ================================================================
   PARA-BRISA — painel trapezoidal inclinado, da base (fim do capô)
   até o início do teto.
   ================================================================ */
const CABIN_X0 = 1180, CABIN_X1 = 3550;
const beltCabinY = BELT_Y+60;
const roofY = 1120;
{
  const xC=(capoX1+CABIN_X0)/2, yC=(beltCabinY+roofY)/2;
  const len = Math.hypot(CABIN_X0-capoX1, roofY-beltCabinY);
  const ws = box(len, 16, 1550, xC, yC, 0, M.glass, 'para-brisa');
  ws.rotation.z = Math.atan2(roofY-beltCabinY, CABIN_X0-capoX1);
}

/* ================================================================
   TETO — painel único plano cobrindo a cabine.
   ================================================================ */
const roofX0 = CABIN_X0+60, roofX1 = CABIN_X1-280;
box(roofX1-roofX0, 26, 1180, (roofX0+roofX1)/2, roofY, 0, M.body2, 'teto');

/* ================================================================
   VIDROS LATERAIS — trapézio único por lado, entre cintura e teto.
   ================================================================ */
for(const side of [-1,1]){
  const xMid = (roofX0+roofX1)/2;
  box(roofX1-roofX0-40, roofY-beltCabinY-8, 24, xMid, (beltCabinY+roofY)/2, side*895, M.glass, 'vidro-lateral');
}

/* ================================================================
   VIGIA TRASEIRA — painel inclinado descendo do teto até a traseira.
   ================================================================ */
{
  const y0=roofY, y1=beltCabinY-20, x0=roofX1, x1=CABIN_X1+120;
  const xC=(x0+x1)/2, yC=(y0+y1)/2;
  const len=Math.hypot(x1-x0,y1-y0);
  const rg = box(len,16,1500,xC,yC,0,M.glass,'vigia-traseira');
  rg.rotation.z = Math.atan2(y1-y0,x1-x0);
}

/* ================================================================
   TAMPA TRASEIRA — painel curto do fim da vigia até a traseira.
   ================================================================ */
{
  const xC=(CABIN_X1+120+4050)/2, yC=(beltCabinY-20+BELT_Y+40)/2;
  box(4050-(CABIN_X1+120), 20, 1700, xC, yC, 0, M.body2, 'tampa-traseira');
}

/* ================================================================
   PARA-CHOQUES, FARÓIS, LANTERNAS, AEROFÓLIOS, SPOILER
   ================================================================ */
box(120, 190, 1760, 60, BOTTOM_Y+95, 0, M.body2, 'parachoque-dianteiro');
box(120, 190, 1700, LENGTH-60, BOTTOM_Y+100, 0, M.body2, 'parachoque-traseiro');
for(const side of [-1,1]){
  box(46,130,320, 130, 600, side*640, M.lamp, 'farol');
  box(46,120,300, LENGTH-100, 640, side*660, M.red, 'lanterna');
  box(30,60,26, CABIN_X1+140, roofY-620+680, side*560, M.white, 'aerofolio');
}
box(40, 10, 1500, LENGTH-15, BOTTOM_Y+40, 0, M.white, 'spoiler-labio');

/* ================================================================
   RODAS
   ================================================================ */
const frontAxleX = FRONT_OVERHANG, rearAxleX = LENGTH-REAR_OVERHANG;
function wheel(xMm, zMm){
  const g = new THREE.Group();
  g.position.set(xMm*M2MM+originOffset, WHEEL_R*M2MM, zMm*M2MM);
  wheels.add(g);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R*M2MM,WHEEL_R*M2MM,WHEEL_W*M2MM,40),M.rubber);
  tire.rotation.x = Math.PI/2; tire.castShadow=true; tire.receiveShadow=true; g.add(tire);
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
for(const z of [-HALF_TRACK,HALF_TRACK]){ wheel(frontAxleX,z); wheel(rearAxleX,z); }

/* ================================================================
   VISTAS
   ================================================================ */
function setView(pos,target=[0,.60,0]){
  camera.position.set(...pos); controls.target.set(...target); controls.update();
}
document.getElementById('view3d').onclick=()=>setView([5.8,2.35,5.4]);
document.getElementById('viewFront').onclick=()=>setView([-6.8,1.15,0],[0,.65,0]);
document.getElementById('viewSide').onclick=()=>setView([0,1.15,6.8],[0,.65,0]);
document.getElementById('viewTop').onclick=()=>setView([0,7.2,.01],[0,.45,0]);
document.getElementById('viewRear').onclick=()=>setView([6.8,1.15,0],[0,.65,0]);

document.getElementById('status').textContent='Modelo 3D carregado — carroceria por blocos';
document.getElementById('view3d').click();
addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});
function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene,camera); }
animate();
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});

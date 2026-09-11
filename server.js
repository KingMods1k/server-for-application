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
<title>Carro 3D — construção por fatias, fiel à planta</title>
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
 <b>Modelo 3D — construção por fatias, fiel à planta</b><br>
 <small>Carroceria montada por dezenas de fatias transversais finas (caixas), cada uma com largura/altura própria digitalizada da silhueta da planta técnica a cada 100mm. Sem malha contínua (loft).</small><br>
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
   DADOS DIGITALIZADOS DA PLANTA TÉCNICA (219063.jpg)
   Pontos de contorno extraídos por leitura visual das 4 vistas
   ortográficas, calibrados pelas cotas reais do desenho.
   Unidades em mm. Origem X=0 no nariz do carro.
   ================================================================ */
const LENGTH = 4480;
const WIDTH = 1950;
const HEIGHT = 1250;
const HALF_TRACK = 1580/2;
const WHEELBASE = 2475;
const FRONT_OVERHANG = 930;
const REAR_OVERHANG = 1075;
const WHEEL_R = 335, WHEEL_W = 235;
const M2MM = 0.001;

// Altura do TETO/CAPÔ (silhueta de cima) por posição X: [x_mm, altura_mm]
// Digitalizado da vista lateral: nariz baixo, sobe suave no capô, degrau
// na base do para-brisa, teto praticamente plano, cai na tampa traseira.
const TOP_PROFILE = [
 [0,505],[77,521],[359,612],[679,683],[999,739],[1180,760],[1180,905],
 [1319,970],[1450,1040],[1640,1080],[1832,1110],[2024,1130],[2152,1150],
 [2280,1165],[2408,1175],[2536,1180],[2664,1180],[2792,1178],[2920,1172],
 [3049,1160],[3177,1140],[3305,1110],[3433,1075],[3550,1040],[3550,860],
 [3689,795],[3817,745],[3945,700],[4073,660],[4201,600],[4329,530],
 [4400,460],[4480,380]
];

// Altura da SOLEIRA/BASE por posição X: [x_mm, altura_mm]
const BOTTOM_PROFILE = [
 [0,230],[487,258],[679,273],[1180,220],[1832,213],[2408,218],[3061,213],
 [3550,220],[3984,213],[4368,218],[4480,240]
];

// Largura TOTAL do carro por posição X (vista de topo): [x_mm, largura_mm]
const WIDTH_PROFILE = [
 [0,600],[127,792],[216,1257],[304,1554],[392,1717],[480,1880],[569,1950],
 [627,1973],[716,1985],[804,1997],[921,1997],[980,1985],[1069,1950],
 [1180,1900],[1304,1780],[1421,1730],[1539,1720],[1627,1715],[1716,1710],
 [1804,1705],[1921,1700],[2010,1698],[2127,1696],[2245,1695],[2421,1695],
 [2539,1696],[2657,1698],[2745,1700],[2862,1705],[2951,1712],[3068,1720],
 [3157,1730],[3245,1745],[3333,1770],[3480,1850],[3550,1900],[3627,1950],
 [3774,1950],[3892,2061],[3980,2031],[4068,1973],[4156,1915],[4245,1845],
 [4333,1694],[4392,1257],[4480,1000]
];

function interp(x, pts){
  if(x <= pts[0][0]) return pts[0][1];
  if(x >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
    if(x >= x1 && x <= x2){
      if(x2===x1) return y2; // degrau (dois pontos no mesmo X): sem interpolação
      const t = (x-x1)/(x2-x1);
      const s = t*t*(3-2*t); // smoothstep
      return y1 + (y2-y1)*s;
    }
  }
  return pts[pts.length-1][1];
}

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
  body: new THREE.MeshPhysicalMaterial({color:0x69747e, metalness:.58, roughness:.28, clearcoat:.8, clearcoatRoughness:.12}),
  body2: new THREE.MeshPhysicalMaterial({color:0x505a63, metalness:.52, roughness:.34}),
  glass: new THREE.MeshPhysicalMaterial({color:0x0d1520, metalness:0, roughness:.05, transmission:.55, transparent:true, opacity:.85, clearcoat:.3, side:THREE.DoubleSide}),
  rubber: new THREE.MeshStandardMaterial({color:0x080a0d, roughness:.72, metalness:.05}),
  rim: new THREE.MeshStandardMaterial({color:0x8b949c, roughness:.22, metalness:.88}),
  lamp: new THREE.MeshStandardMaterial({color:0xdce8f2, roughness:.16, metalness:.3}),
  red: new THREE.MeshStandardMaterial({color:0x8e1116, roughness:.28, metalness:.15}),
  black: new THREE.MeshStandardMaterial({color:0x07090c, roughness:.55, metalness:.2}),
  cabinBody: new THREE.MeshPhysicalMaterial({color:0x5f6a73, metalness:.55, roughness:.30})
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

const originOffset = -LENGTH*M2MM/2;

/* Caixa em coordenadas de planta (mm, X=0 no nariz, Y=0 no chão, Z=0 no
   centro), convertida e recentralizada automaticamente para a cena. */
function box(wMm, hMm, dMm, xMm, yMm, zMm, mat, name, parent=shell){
  const o = new THREE.Mesh(new THREE.BoxGeometry(wMm*M2MM, hMm*M2MM, dMm*M2MM), mat);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  o.position.set(xMm*M2MM + originOffset, yMm*M2MM, zMm*M2MM);
  parent.add(o);
  return o;
}

/* ================================================================
   CARROCERIA POR FATIAS TRANSVERSAIS FINAS
   A cada STEP mm ao longo do comprimento, cria uma caixa fina cuja
   largura (Z) e altura (Y) vêm diretamente dos perfis digitalizados
   da planta. É uma aproximação poligonal do contorno real — sem
   malha contínua (loft) — só caixas discretas empilhadas em X.
   ================================================================ */
const STEP = 60; // mm — resolução longitudinal (quanto menor, mais fatias)
const N_SLICES = Math.floor(LENGTH/STEP);

let sliceCount = 0;
for(let i=0;i<N_SLICES;i++){
  const xStart = i*STEP;
  const xCenter = xStart + STEP/2;
  if(xCenter >= LENGTH) break;

  const top = interp(xCenter, TOP_PROFILE);
  const bottom = interp(xCenter, BOTTOM_PROFILE);
  const totalW = interp(xCenter, WIDTH_PROFILE);
  const h = Math.max(top-bottom, 8);
  const yCenter = bottom + h/2;

  // material varia: cabine (faixa 1180-3550) recebe tom de vidro/teto
  // acima da cintura; carroceria opaca abaixo. Aqui simplificado: toda
  // a fatia é carroceria opaca — vidro/teto são camadas extras abaixo.
  box(STEP*1.02, h, totalW, xCenter, yCenter, 0, M.body, 'faixa-carroceria-'+i);
  sliceCount++;
}

/* ================================================================
   CABINE / VIDROS — faixa 1180 a 3550mm, acima da cintura (62% da
   altura da carroceria naquele X), com o mesmo esquema de fatias finas
   mas mais estreitas (cabine é mais estreita que a carroceria) e
   material de vidro.
   ================================================================ */
const CABIN_X0 = 1180, CABIN_X1 = 3550;
function beltHeightAt(x){
  const top = interp(x, TOP_PROFILE);
  const bottom = interp(x, BOTTOM_PROFILE);
  return bottom + (top-bottom)*0.62;
}
const CABIN_STEP = 60;
const N_CABIN_SLICES = Math.floor((CABIN_X1-CABIN_X0)/CABIN_STEP);
for(let i=0;i<N_CABIN_SLICES;i++){
  const xStart = CABIN_X0 + i*CABIN_STEP;
  const xCenter = xStart + CABIN_STEP/2;
  if(xCenter >= CABIN_X1) break;

  const top = interp(xCenter, TOP_PROFILE) - 12;
  const belt = beltHeightAt(xCenter);
  const totalW = interp(xCenter, WIDTH_PROFILE) * 0.80; // cabine mais estreita
  const h = Math.max(top-belt, 8);
  const yCenter = belt + h/2;

  box(CABIN_STEP*1.02, h, totalW, xCenter, yCenter, 0, M.glass, 'faixa-cabine-'+i);
}

/* Teto sólido: faixa fina no topo da cabine, do mesmo jeito, cobrindo
   apenas o terço superior, material opaco. */
const roofX0 = CABIN_X0+300, roofX1 = CABIN_X1-150;
const ROOF_STEP = 60;
const N_ROOF_SLICES = Math.floor((roofX1-roofX0)/ROOF_STEP);
for(let i=0;i<N_ROOF_SLICES;i++){
  const xStart = roofX0 + i*ROOF_STEP;
  const xCenter = xStart + ROOF_STEP/2;
  if(xCenter >= roofX1) break;

  const top = interp(xCenter, TOP_PROFILE);
  const under = top - 40;
  const totalW = interp(xCenter, WIDTH_PROFILE) * 0.62;
  const h = Math.max(top-under, 6);
  const yCenter = under + h/2;

  box(ROOF_STEP*1.02, h, totalW, xCenter, yCenter, 0, M.cabinBody, 'faixa-teto-'+i);
}

/* Para-choques, faróis e lanternas nas pontas, pelas cotas reais. */
const halfWFront = interp(40, WIDTH_PROFILE)/2;
const halfWRear = interp(LENGTH-40, WIDTH_PROFILE)/2;
box(140, 200, halfWFront*1.9, 40, interp(40,BOTTOM_PROFILE)+100, 0, M.body2, 'parachoque-dianteiro');
box(140, 200, halfWRear*1.9, LENGTH-40, interp(LENGTH-40,BOTTOM_PROFILE)+100, 0, M.body2, 'parachoque-traseiro');
for(const side of [-1,1]){
  box(50, 150, 340, 55, interp(300,TOP_PROFILE)*0.72, side*halfWFront*0.62, M.lamp, 'farol');
  box(50, 140, 340, LENGTH-55, interp(LENGTH-300,TOP_PROFILE)*0.80, side*halfWRear*0.62, M.red, 'lanterna');
}

/* Caixas de roda: arcos nos eixos reais. */
const frontAxleX = FRONT_OVERHANG;
const rearAxleX = LENGTH-REAR_OVERHANG;
function arch(xMm, zMm){
  const torus = new THREE.Mesh(new THREE.TorusGeometry(.40,.035,10,32,Math.PI), M.body2);
  torus.name = 'arco-roda';
  torus.castShadow = true;
  torus.rotation.set(Math.PI/2,0,Math.PI);
  torus.position.set(xMm*M2MM+originOffset, .40, zMm*M2MM);
  shell.add(torus);
}
arch(frontAxleX,-HALF_TRACK-6); arch(frontAxleX,HALF_TRACK+6);
arch(rearAxleX,-HALF_TRACK-6); arch(rearAxleX,HALF_TRACK+6);

/* Rodas na bitola real de 1580mm, raio 335mm (aprox. aro+pneu). */
function wheel(xMm, zMm){
  const g = new THREE.Group();
  g.position.set(xMm*M2MM+originOffset, WHEEL_R*M2MM, zMm*M2MM);
  wheels.add(g);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R*M2MM,WHEEL_R*M2MM,WHEEL_W*M2MM,40),M.rubber);
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
  wheel(frontAxleX,z);
  wheel(rearAxleX,z);
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

document.getElementById('status').textContent='Modelo 3D carregado — carroceria por fatias ('+sliceCount+' segmentos transversais)';

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

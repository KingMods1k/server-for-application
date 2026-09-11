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
<title>Carro 3D — reconstrução fiel à planta</title>
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
 <b>Modelo 3D — reconstrução por loft, fiel à planta</b><br>
 <small>Contorno digitalizado diretamente das 4 vistas ortográficas (lateral, topo, frente, traseira) e reconstruído por malha contínua (loft), não por caixas empilhadas.</small><br>
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
   DADOS DIGITALIZADOS DIRETAMENTE DA PLANTA TÉCNICA (219063.jpg)
   Cada ponto foi extraído por análise de pixel das 4 vistas
   ortográficas, calibrado pelas cotas reais do desenho:
     lateral:  4480 (comprimento) x 1250 (altura)
     topo:     4480 (comprimento) x 1950 (largura)
     frente/traseira: 1950 (largura) x 1250 (altura), bitola 1580
   Todas as unidades abaixo em mm, origem X=0 no nariz do carro.
   ================================================================ */

// Perfil superior (silhueta de cima) lateral: [x_mm, altura_mm]
const TOP_PROFILE = [
 [0,505],[77,521],[359,612],[679,683],[999,739],[1319,779],[1640,805],
 [1832,820],[2024,825],[2152,891],[2280,951],[2408,1012],[2536,1063],
 [2664,1113],[2792,1159],[2920,1199],[3049,1235],[3177,1250],[3305,1265],
 [3433,1275],[3561,1275],[3689,1270],[3817,1265],[3945,1250],[4073,1235],
 [4201,1210],[4329,1150],[4400,1053],[4480,940]
];

// Perfil inferior (soleira/base) lateral: [x_mm, altura_mm]
const BOTTOM_PROFILE = [
 [0,230],[487,258],[679,273],[1832,213],[2408,218],[3061,213],[3561,220],
 [3984,213],[4368,218],[4480,240]
];

// Largura TOTAL do carro por posição X (vista de topo): [x_mm, largura_mm]
const WIDTH_PROFILE = [
 [0,600],[127,792],[216,1257],[304,1554],[392,1717],[480,1880],[569,1950],
 [627,1973],[716,1985],[804,1997],[921,1997],[980,1985],[1069,1950],
 [1304,1950],[1421,1956],[1539,1962],[1627,1950],[1716,1944],[1804,1915],
 [1921,1903],[2010,1892],[2127,1886],[2245,1880],[2421,1880],[2539,1874],
 [2657,1874],[2745,1892],[2862,1898],[2951,1962],[3068,1997],[3157,2020],
 [3245,2037],[3333,2055],[3480,1970],[3627,1950],[3774,1950],[3892,2061],
 [3980,2031],[4068,1973],[4156,1915],[4245,1845],[4333,1694],[4392,1257],
 [4480,1000]
];

// Seção transversal DIANTEIRA: [altura_mm_do_chao, meia_largura_mm]
// normalizado para meia-largura relativa (0..1) em relação ao seu proprio maximo
const FRONT_SECTION = [
 [0,975],[167,967],[288,970],[390,975],[552,975],[673,962],[754,889],
 [835,835],[916,803],[997,760],[1078,717],[1159,666],[1220,508],[1240,309],[1250,150]
];

// Seção transversal TRASEIRA: [altura_mm_do_chao, meia_largura_mm]
const REAR_SECTION = [
 [0,929],[101,943],[202,959],[324,972],[445,970],[587,943],[688,835],
 [789,782],[891,739],[992,680],[1053,89]
];

const LENGTH = 4480;
const WIDTH = 1950;
const HEIGHT = 1250;
const HALF_TRACK = 1580/2;
const WHEEL_R = 335, WHEEL_W = 235;
const FRONT_AXLE = 930 + 380;   // aprox. centro do arco dianteiro, da vista lateral
const REAR_AXLE = LENGTH - 1075 - 380;
const GROUND_MM = 0; // chao = y_mm 0 na planta; rodas assentam no proprio raio

function interp(x, pts){
  if(x <= pts[0][0]) return pts[0][1];
  if(x >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
    if(x >= x1 && x <= x2){
      const t = (x-x1)/(x2-x1);
      // interpolação suave (smoothstep) entre pontos de controle da planta
      const s = t*t*(3-2*t);
      return y1 + (y2-y1)*s;
    }
  }
  return pts[pts.length-1][1];
}

/* Devolve o formato normalizado (0..1 de meia-largura relativa) da seção
   transversal numa dada altura relativa (0=chão do carro,1=topo do carro
   naquele X), misturando FRONT_SECTION e REAR_SECTION conforme a posição
   longitudinal x (0=nariz,1=traseira). Isso dá a curvatura real (ombros
   largos, cintura estreita) em vez de um retângulo. */
function sectionShape(hRel, mixRearT){
  // Normaliza ambas as seções pelo MESMO máximo (o maior dos dois), assim
  // a proporção frente/traseira fica preservada e nao "infla" o nariz.
  function sampleNorm(pts, hRel, refMax){
    const maxH = pts[pts.length-1][0];
    const h = hRel*maxH;
    const w = interp(h, pts);
    return w/refMax;
  }
  const refMax = Math.max(
    ...FRONT_SECTION.map(p=>p[1]),
    ...REAR_SECTION.map(p=>p[1])
  );
  const f = sampleNorm(FRONT_SECTION, hRel, refMax);
  const r = sampleNorm(REAR_SECTION, hRel, refMax);
  return f + (r-f)*mixRearT;
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

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0d1520, metalness: 0, roughness: 0.05,
  transmission: 0.55, transparent: true, opacity: 0.85,
  clearcoat: 0.3, side: THREE.DoubleSide
});

const M = {
  body: new THREE.MeshPhysicalMaterial({color:0x69747e, metalness:.58, roughness:.28, clearcoat:.8, clearcoatRoughness:.12, side:THREE.DoubleSide}),
  body2: new THREE.MeshPhysicalMaterial({color:0x505a63, metalness:.52, roughness:.34}),
  glass: glassMat,
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
shell.name = 'CARROCERIA_LOFT';
car.add(shell);
const wheels = new THREE.Group();
wheels.name = 'RODAS';
car.add(wheels);

const M2MM = 0.001; // conversão mm -> metros (unidade da cena)

/* ================================================================
   GERAÇÃO DA CARROCERIA POR LOFT (malha contínua ao longo de X)
   Para cada fatia longitudinal, a seção transversal (perfil em Y-Z)
   é construída a partir de:
     - topo/base reais daquele X (TOP_PROFILE / BOTTOM_PROFILE)
     - largura máxima real daquele X (WIDTH_PROFILE)
     - formato de arredondamento (sectionShape) interpolado entre a
       seção dianteira e traseira reais da planta
   Isso substitui caixas empilhadas por uma malha suave e fiel.
   ================================================================ */
const N_LONG = 160;      // divisões ao longo do comprimento
const N_RING = 28;       // divisões ao redor da seção transversal (meio-perfil, espelhado)

function buildBodyGeometry(){
  const positions = [];
  const indices = [];
  const uvs = [];

  // pontos de referência para mistura frente/trás (0 = nariz, 1 = traseira)
  const rings = [];
  let bottom0, top0; // guardam topo/base do primeiro anel (X=0), p/ fechar o nariz

  for(let i=0;i<=N_LONG;i++){
    const t = i/N_LONG;
    const x = t*LENGTH;
    const top = interp(x, TOP_PROFILE);
    const bottom = interp(x, BOTTOM_PROFILE);
    if(i===0){ top0 = top; bottom0 = bottom; }
    const halfW = interp(x, WIDTH_PROFILE)/2;
    const mixRearT = t; // mistura linear da forma de seção ao longo do X

    const ring = [];
    // percorre a seção transversal do lado esquerdo (z negativo) por cima
    // até o lado direito (z positivo), formando um "U" invertido (sem base,
    // carroceria aberta embaixo como na planta/BIW)
    for(let j=0;j<=N_RING;j++){
      const s = j/N_RING;         // 0=esquerda topo->baixo->direita=1
      // mapear s em (lado, alturaRelativa)
      let side, hRel;
      if(s <= 0.5){
        side = -1;
        hRel = 1 - (s/0.5); // 0->esquerda-topo (hRel=1), 0.5->esquerda-baixo(hRel=0)
      } else {
        side = 1;
        hRel = (s-0.5)/0.5; // 0.5->direita-baixo(hRel=0), 1->direita-topo(hRel=1)
      }
      const shapeFactor = sectionShape(hRel, mixRearT); // 0..1
      const y = bottom + hRel*(top-bottom);
      const z = side * halfW * shapeFactor;
      ring.push([x, y, z]);
    }
    rings.push(ring);
  }

  for(const ring of rings){
    for(const [x,y,z] of ring){
      positions.push(x*M2MM, y*M2MM, z*M2MM);
      uvs.push(0,0);
    }
  }

  const ringLen = N_RING+1;
  for(let i=0;i<N_LONG;i++){
    for(let j=0;j<N_RING;j++){
      const a = i*ringLen+j;
      const b = i*ringLen+j+1;
      const c = (i+1)*ringLen+j;
      const d = (i+1)*ringLen+j+1;
      indices.push(a,c,b, b,c,d);
    }
  }

  // Fecha a ponta do nariz (primeiro anel, i=0): adiciona um vértice central
  // na mesma posição X e liga em leque, tampando o buraco frontal.
  {
    const [x0,y0] = rings[0][0];
    const centerIdx = positions.length/3;
    positions.push(x0*M2MM, (bottom0+top0)/2*M2MM, 0);
    uvs.push(0,0);
    for(let j=0;j<N_RING;j++){
      indices.push(centerIdx, j+1, j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs,2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const bodyGeo = buildBodyGeometry();
const bodyMesh = new THREE.Mesh(bodyGeo, M.body);
bodyMesh.castShadow = true;
bodyMesh.receiveShadow = true;
bodyMesh.name = 'carroceria-loft';
// recentraliza: planta usa X=0 no nariz; cena usa X=0 no centro, nariz para -X
bodyMesh.position.x = -LENGTH*M2MM/2;
shell.add(bodyMesh);

/* Vidros/cabine: gerados como uma segunda malha, mais fina, encaixada
   logo acima da cintura (belt) até o teto, usando o mesmo loft mas
   restrito à faixa de altura da cabine e um pouco recuada para dentro. */
function beltHeightAt(x){
  // cintura = ~78% da altura entre bottom e top nessa faixa (aprox. visual
  // da planta: vidro comeca proximo ao topo das portas)
  const top = interp(x, TOP_PROFILE);
  const bottom = interp(x, BOTTOM_PROFILE);
  return bottom + (top-bottom)*0.62;
}
const CABIN_X0 = 1180, CABIN_X1 = 3550; // faixa longitudinal aprox. do habitáculo (da vista lateral)

function buildCabinGeometry(){
  const positions = [];
  const indices = [];
  const N_L = 60;
  const rings = [];
  for(let i=0;i<=N_L;i++){
    const t = i/N_L;
    const x = CABIN_X0 + t*(CABIN_X1-CABIN_X0);
    const top = interp(x, TOP_PROFILE) - 12; // recuo pro teto assentar por cima
    const belt = beltHeightAt(x);
    const halfWTop = interp(x, WIDTH_PROFILE)/2 * 0.80; // cabine mais estreita que a carroceria
    const mixRearT = x/LENGTH;
    const ring = [];
    for(let j=0;j<=N_RING;j++){
      const s = j/N_RING;
      let side, hRel;
      if(s<=0.5){ side=-1; hRel = 1-(s/0.5); } else { side=1; hRel=(s-0.5)/0.5; }
      const shapeFactor = sectionShape(0.55+hRel*0.45, mixRearT); // so a parte de cima da secao (mais estreita)
      const y = belt + hRel*(top-belt);
      const z = side*halfWTop*shapeFactor;
      ring.push([x,y,z]);
    }
    rings.push(ring);
  }
  for(const ring of rings) for(const [x,y,z] of ring){ positions.push(x*M2MM,y*M2MM,z*M2MM); }
  const ringLen = N_RING+1;
  for(let i=0;i<N_L;i++){
    for(let j=0;j<N_RING;j++){
      const a=i*ringLen+j, b=i*ringLen+j+1, c=(i+1)*ringLen+j, d=(i+1)*ringLen+j+1;
      indices.push(a,c,b, b,c,d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
const cabinMesh = new THREE.Mesh(buildCabinGeometry(), M.glass);
cabinMesh.position.x = -LENGTH*M2MM/2;
cabinMesh.name = 'cabine-vidro';
shell.add(cabinMesh);

/* Teto sólido: fina camada acima do vidro, mesma técnica, só que opaca
   e cobrindo apenas o terço superior da cabine. */
function buildRoofGeometry(){
  const positions = [];
  const indices = [];
  const N_L = 60;
  const rings = [];
  const roofX0 = CABIN_X0+300, roofX1 = CABIN_X1-150;
  for(let i=0;i<=N_L;i++){
    const t = i/N_L;
    const x = roofX0 + t*(roofX1-roofX0);
    const top = interp(x, TOP_PROFILE);
    const under = top - 30;
    const halfW = interp(x, WIDTH_PROFILE)/2 * 0.62;
    const mixRearT = x/LENGTH;
    const ring = [];
    for(let j=0;j<=N_RING;j++){
      const s=j/N_RING;
      let side,hRel;
      if(s<=0.5){side=-1;hRel=1-(s/0.5);} else {side=1;hRel=(s-0.5)/0.5;}
      const shapeFactor = sectionShape(0.85+hRel*0.15, mixRearT);
      const y = under + hRel*(top-under);
      const z = side*halfW*shapeFactor;
      ring.push([x,y,z]);
    }
    rings.push(ring);
  }
  for(const ring of rings) for(const [x,y,z] of ring){ positions.push(x*M2MM,y*M2MM,z*M2MM); }
  const ringLen = N_RING+1;
  for(let i=0;i<N_L;i++){
    for(let j=0;j<N_RING;j++){
      const a=i*ringLen+j,b=i*ringLen+j+1,c=(i+1)*ringLen+j,d=(i+1)*ringLen+j+1;
      indices.push(a,c,b, b,c,d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
const roofMesh = new THREE.Mesh(buildRoofGeometry(), M.body2);
roofMesh.position.x = -LENGTH*M2MM/2;
roofMesh.castShadow = true;
roofMesh.name = 'teto';
shell.add(roofMesh);

function box(w,h,d,x,y,z,mat,name,parent=shell){
  const o = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  o.position.set(x,y,z);
  parent.add(o);
  return o;
}

/* Para-choques, faróis e lanternas posicionados pelas cotas reais da
   planta (extremos do comprimento e altura do nariz/traseira). */
const frontX = -LENGTH*M2MM/2;
const rearX = LENGTH*M2MM/2;
const halfWFront = interp(40, WIDTH_PROFILE)/2*M2MM;
const halfWRear = interp(LENGTH-40, WIDTH_PROFILE)/2*M2MM;

box(.14,.20, halfWFront*1.9, frontX+.05, interp(40,BOTTOM_PROFILE)*M2MM+.10, 0, M.body2, 'parachoque-dianteiro');
box(.14,.20, halfWRear*1.9, rearX-.05, interp(LENGTH-40,BOTTOM_PROFILE)*M2MM+.10, 0, M.body2, 'parachoque-traseiro');

for(const side of [-1,1]){
  box(.05,.15,.34, frontX+.06, interp(300,TOP_PROFILE)*M2MM*0.72, side*halfWFront*0.62, M.lamp, 'farol');
  box(.05,.14,.34, rearX-.06, interp(LENGTH-300,TOP_PROFILE)*M2MM*0.80, side*halfWRear*0.62, M.red, 'lanterna');
}

/* Caixas de roda: posicionadas nos eixos reais (930mm e 4480-1075mm da
   planta), raio aproximado pelo arco visível na lateral (~380mm). */
function arch(x,z){
  const torus = new THREE.Mesh(new THREE.TorusGeometry(.40,.035,10,32,Math.PI), M.body2);
  torus.name = 'arco-roda';
  torus.castShadow = true;
  torus.rotation.set(Math.PI/2,0,Math.PI);
  torus.position.set(x,.40,z);
  shell.add(torus);
}
const frontAxleX = frontX + 930*M2MM;
const rearAxleX = rearX - 1075*M2MM;
const halfTrackM = HALF_TRACK*M2MM;
arch(frontAxleX,-halfTrackM-.006); arch(frontAxleX,halfTrackM+.006);
arch(rearAxleX,-halfTrackM-.006); arch(rearAxleX,halfTrackM+.006);

/* Rodas na bitola real de 1580mm, raio 335mm (aprox. aro+pneu). */
function wheel(x,z){
  const g = new THREE.Group();
  g.position.set(x, WHEEL_R*M2MM, z);
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
for(const z of [-halfTrackM,halfTrackM]){
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

document.getElementById('status').textContent='Modelo 3D carregado — carroceria por loft ('+N_LONG+'x'+N_RING+' segmentos)';

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

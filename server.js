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
<title>Carro 3D — construção por blocos poligonais</title>
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
<div id="status" style="position:fixed;left:18px;top:190px;z-index:10;padding:10px 12px;border-radius:9px;background:rgba(0,0,0,.78);color:#fff;font:12px Arial">Inicializando 3D…</div>
<div class="hud">
 <b>Modelo 3D — carroceria por blocos poligonais</b><br>
 <small>Casco principal extraído do contorno de topo da planta e extrudado; capô, teto, vidros e para-choques como blocos poligonais próprios, encaixados nas cotas reais. Sem fatias repetidas, sem malha contínua (loft).</small><br>
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
   COTAS DA PLANTA TÉCNICA (219063.jpg) — mm, X=0 no nariz
   ================================================================ */
const LENGTH = 4480, WIDTH = 1950, HEIGHT = 1250;
const HALF_TRACK = 1580/2, WHEELBASE = 2475;
const FRONT_OVERHANG = 930, REAR_OVERHANG = 1075;
const WHEEL_R = 335, WHEEL_W = 235;
const M2MM = 0.001;

// Meia-largura do CASCO por X (vista de topo), ponto a ponto:
const HALFW_PROFILE = [
 [0,260],[100,390],[220,560],[360,725],[500,840],[650,915],
 [800,955],[930,974],[1050,970],[1180,950],[1350,915],
 [1550,895],[1750,888],[1950,884],[2150,883],[2350,883],
 [2550,884],[2740,888],[2900,895],[3070,908],[3220,928],
 [3350,953],[3465,973],[3550,975],[3650,968],[3760,950],
 [3880,920],[3990,878],[4100,825],[4210,755],[4310,665],
 [4400,540],[4460,400],[4480,300]
];
// Altura do TETO/CAPÔ por X (perfil lateral):
const TOP_PROFILE = [
 [0,430],[150,505],[300,570],[450,625],[600,668],[750,700],
 [900,725],[999,742],[1080,800],[1180,935],
 [1420,1090],[1780,1128],[2200,1137],[2620,1133],[3040,1108],
 [3300,1065],[3550,935],[3700,825],[3920,715],[4180,615],
 [4390,490],[4480,360]
];
const BOTTOM_Y = 205; // soleira ~constante

function interp(x, pts){
  if(x <= pts[0][0]) return pts[0][1];
  if(x >= pts[pts.length-1][0]) return pts[pts.length-1][1];
  for(let i=0;i<pts.length-1;i++){
    const [x1,y1] = pts[i], [x2,y2] = pts[i+1];
    if(x >= x1 && x <= x2){
      const t = (x-x1)/(x2-x1);
      const s = t*t*(3-2*t);
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
  glass: new THREE.MeshPhysicalMaterial({color:0x3f5670, metalness:.1, roughness:.08, transmission:.5, transparent:true, opacity:.88, clearcoat:.4, side:THREE.DoubleSide}),
  rubber: new THREE.MeshStandardMaterial({color:0x080a0d, roughness:.72, metalness:.05}),
  rim: new THREE.MeshStandardMaterial({color:0x8b949c, roughness:.22, metalness:.88}),
  lamp: new THREE.MeshStandardMaterial({color:0xdce8f2, roughness:.16, metalness:.3}),
  red: new THREE.MeshStandardMaterial({color:0x8e1116, roughness:.28, metalness:.15}),
  black: new THREE.MeshStandardMaterial({color:0x07090c, roughness:.55, metalness:.2}),
  white: new THREE.MeshStandardMaterial({color:0xe8ebee, roughness:.35, metalness:.15})
};

const car = new THREE.Group();
car.name = 'CARRO_COMPLETO';
scene.add(car);
const shell = new THREE.Group();
shell.name = 'CARROCERIA_BLOCOS';
car.add(shell);
const wheels = new THREE.Group();
wheels.name = 'RODAS';
car.add(wheels);

const originOffset = -LENGTH*M2MM/2;

/* ================================================================
   BLOCO 1 — CASCO INFERIOR: contorno de topo (silhueta vista de cima,
   usando HALFW_PROFILE espelhado) extrudado desde o chão até a linha
   de cintura (60% da altura em cada X). Um único sólido poligonal.
   ================================================================ */
const beltRatio = 1.0; // casco sobe até a altura real do TOP_PROFILE — sem vão
const N_CONTOUR = 46;
function buildHullGeometry(){
  const pts = [];
  for(let i=0;i<=N_CONTOUR;i++){
    const x = (i/N_CONTOUR)*LENGTH;
    pts.push([x, interp(x, HALFW_PROFILE)]);
  }

  // extrusão em Y variável não é suportada nativamente — construímos
  // manualmente vértices topo/base por ponto de contorno.
  const positions = [], indices = [];
  const CABIN_X0_ = 1180, CABIN_X1_ = 3550;
  const ring = (side) => pts.map(([x,hw])=>{
    const isCabin = x >= CABIN_X0_ && x <= CABIN_X1_;
    const fullTop = interp(x,TOP_PROFILE);
    // na região da cabine, o casco para na linha de cintura (deixa vão
    // para o vidro); fora da cabine (capô/traseira), sobe até o topo real.
    const top = isCabin ? (BOTTOM_Y + (fullTop-BOTTOM_Y)*0.44) : fullTop;
    return [x, BOTTOM_Y, side*hw, x, top, side*hw];
  });
  const left = ring(-1), right = ring(1);
  // vértices: para cada ponto de contorno, base-esquerda, topo-esquerda, base-direita, topo-direita
  const idx = [];
  for(let i=0;i<pts.length;i++){
    const bl = positions.length/3;
    positions.push(left[i][0]*M2MM, left[i][1]*M2MM, left[i][2]*M2MM);
    const tl = positions.length/3;
    positions.push(left[i][3]*M2MM, left[i][4]*M2MM, left[i][5]*M2MM);
    const br = positions.length/3;
    positions.push(right[i][0]*M2MM, right[i][1]*M2MM, right[i][2]*M2MM);
    const tr = positions.length/3;
    positions.push(right[i][3]*M2MM, right[i][4]*M2MM, right[i][5]*M2MM);
    idx.push([bl,tl,br,tr]);
  }
  for(let i=0;i<idx.length-1;i++){
    const [bl0,tl0,br0,tr0] = idx[i];
    const [bl1,tl1,br1,tr1] = idx[i+1];
    // lateral esquerda
    indices.push(bl0,bl1,tl0, tl0,bl1,tl1);
    // lateral direita
    indices.push(br0,tr0,br1, tr0,tr1,br1);
    // topo (cintura)
    indices.push(tl0,tl1,tr0, tr0,tl1,tr1);
    // base (assoalho)
    indices.push(bl0,br0,bl1, br0,br1,bl1);
  }
  // tampa frontal e traseira
  const [bl0,tl0,br0,tr0] = idx[0];
  indices.push(bl0,br0,tl0, tl0,br0,tr0);
  const last = idx[idx.length-1];
  indices.push(last[0],last[1],last[2], last[1],last[3],last[2]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
const hull = new THREE.Mesh(buildHullGeometry(), M.body);
hull.name = 'casco-inferior';
hull.castShadow = true; hull.receiveShadow = true;
hull.position.x = originOffset;
shell.add(hull);

/* ================================================================
   BLOCO 2 — CAPÔ: painel único inclinado do nariz (x=100) até a base
   do para-brisa (x=999), como polígono trapezoidal simples.
   ================================================================ */
/* ================================================================
   BLOCO 2 — CAPÔ: painel único inclinado do nariz (x=100) até a base
   do para-brisa (x=999), como polígono trapezoidal simples.
   ================================================================ */
function box(wMm, hMm, dMm, xMm, yMm, zMm, mat, name, parent=shell, rz=0){
  const o = new THREE.Mesh(new THREE.BoxGeometry(wMm*M2MM, hMm*M2MM, dMm*M2MM), mat);
  o.name = name;
  o.castShadow = true; o.receiveShadow = true;
  o.rotation.z = rz;
  o.position.set(xMm*M2MM + originOffset, yMm*M2MM, zMm*M2MM);
  parent.add(o);
  return o;
}

/* Função auxiliar: altura da cintura da cabine (mesmo cálculo usado no
   casco) — usada para ancorar para-brisa, vidros e vigia sem vão nem
   sobreposição. */
function cabinBeltY(x){
  return BOTTOM_Y + (interp(x,TOP_PROFILE)-BOTTOM_Y)*0.44;
}

/* Capô: já é a própria superfície do casco entre 100-999mm (o casco
   agora sobe até o topo real ali). Nenhum painel extra necessário. */
const capoX0 = 100, capoX1 = 999;

/* ================================================================
   BLOCO 3 — PARA-BRISA: painel trapezoidal único inclinado, indo da
   cintura da cabine (em capoX1, onde o casco já é o topo real do
   capô) até o início do teto (CABIN_X0, na cintura da cabine ali).
   ================================================================ */
const CABIN_X0 = 1180, CABIN_X1 = 3550;
{
  const y0 = interp(capoX1, TOP_PROFILE); // topo real do capô nesse X
  const y1 = interp(CABIN_X0, TOP_PROFILE); // altura do teto no início da cabine
  const xC=(capoX1+CABIN_X0)/2, yC=(y0+y1)/2;
  const hw = interp(CABIN_X0,HALFW_PROFILE)*0.86;
  const wsWind = box(Math.hypot(CABIN_X0-capoX1, y1-y0), 14, hw*2, xC, yC, 0, M.glass, 'para-brisa');
  wsWind.rotation.z = Math.atan2(y1-y0, CABIN_X0-capoX1);
}

/* ================================================================
   BLOCO 4 — TETO: painel único cobrindo a cabine, na altura real do
   TOP_PROFILE (que é onde o casco NÃO sobe na região da cabine — o
   vão fica exatamente preenchido por este painel).
   ================================================================ */
{
  const roofX0=CABIN_X0+80, roofX1=CABIN_X1-260;
  const y0=interp(roofX0,TOP_PROFILE), y1=interp(roofX1,TOP_PROFILE);
  const hw0=interp(roofX0,HALFW_PROFILE)*0.60, hw1=interp(roofX1,HALFW_PROFILE)*0.60;
  const xC=(roofX0+roofX1)/2, yC=(y0+y1)/2, hw=(hw0+hw1)/2;
  box(roofX1-roofX0, 26, hw*2, xC, yC, 0, M.body2, 'teto');
}

/* ================================================================
   BLOCO 5 — VIDROS LATERAIS: preenche exatamente o vão entre a
   cintura da cabine (topo do casco ali) e a base do teto.
   ================================================================ */
for(const side of [-1,1]){
  const xMid = (CABIN_X0+CABIN_X1)/2;
  const beltY = cabinBeltY(xMid);
  const roofY = interp(xMid, TOP_PROFILE)-13;
  const hw = interp(xMid, HALFW_PROFILE)*0.60;
  box(CABIN_X1-CABIN_X0-360, roofY-beltY, 18, xMid+70, (beltY+roofY)/2, side*hw, M.glass, 'vidro-lateral');
}

/* ================================================================
   BLOCO 6 — VIGIA TRASEIRA: painel inclinado descendo da traseira do
   teto (altura real) até a cintura da cabine na ponta traseira.
   ================================================================ */
{
  const roofEndX = CABIN_X1-260;
  const y0 = interp(roofEndX,TOP_PROFILE);
  const y1 = cabinBeltY(CABIN_X1);
  const xC=(roofEndX+CABIN_X1)/2, yC=(y0+y1)/2;
  const hw = interp(CABIN_X1,HALFW_PROFILE)*0.75;
  const rg = box(Math.hypot(CABIN_X1-roofEndX,y1-y0), 14, hw*2, xC, yC, 0, M.glass, 'vigia-traseira');
  rg.rotation.z = Math.atan2(y1-y0, CABIN_X1-roofEndX);
}

/* ================================================================
   PARA-CHOQUES, FARÓIS, LANTERNAS, AEROFÓLIO
   ================================================================ */
{
  const hw0 = interp(30,HALFW_PROFILE);
  box(120, 190, hw0*1.9, 30, BOTTOM_Y+95, 0, M.body2, 'parachoque-dianteiro');
}
{
  const hwE = interp(LENGTH-30,HALFW_PROFILE);
  box(120, 190, hwE*1.85, LENGTH-30, BOTTOM_Y+100, 0, M.body2, 'parachoque-traseiro');
}
for(const side of [-1,1]){
  const hwF = interp(300,HALFW_PROFILE);
  box(46,130,320, 90, interp(300,TOP_PROFILE)*0.72, side*hwF*0.68, M.lamp, 'farol');
  const hwR = interp(LENGTH-300,HALFW_PROFILE);
  box(46,120,300, LENGTH-90, interp(LENGTH-300,TOP_PROFILE)*0.78, side*hwR*0.72, M.red, 'lanterna');
  // aerofólios brancos na traseira, como na referência
  box(30,60,26, LENGTH-260, interp(LENGTH-260,TOP_PROFILE)+55, side*hwR*0.55, M.white, 'aerofolio');
}
// spoiler traseiro (lábio) — referência mostra uma lâmina clara na cauda
{
  const hwE = interp(LENGTH-15,HALFW_PROFILE);
  box(40, 10, hwE*1.5, LENGTH-15, BOTTOM_Y+40, 0, M.white, 'spoiler-labio');
}

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

document.getElementById('status').textContent='Modelo 3D carregado — carroceria por blocos poligonais';
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

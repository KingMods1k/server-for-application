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
<title>Carro 3D — carroceria fiel à planta</title>
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
 <b>Modelo 3D — carroceria fiel à planta</b><br>
 <small>Silhueta extrudada seguindo o perfil lateral real do desenho técnico.</small><br>
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
   MEDIDAS EXATAS DA PLANTA
   Comprimento: 4480mm | Largura: 1950mm | Altura: 1250mm
   Entre-eixos: 2475mm | Balanço dianteiro: 930mm | Balanço traseiro: 1075mm
   Bitola: 1580mm
   ================================================================ */
const LENGTH = 4.480;
const WIDTH = 1.950;
const HALF_W = WIDTH / 2;
const HEIGHT = 1.250;
const HALF_TRACK = 1.580 / 2;
const WHEEL_R = 0.335;
const WHEEL_W = 0.235;

const FRONT_AXLE = -1.310;
const REAR_AXLE = 1.165;
const GROUND = WHEEL_R;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);
scene.fog = new THREE.Fog(0x090b0f, 12, 25);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 100);
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
  glass: new THREE.MeshPhysicalMaterial({color:0x101923, metalness:.05, roughness:.16, transmission:.08, transparent:true, opacity:.92}),
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
shell.name = 'CARROCERIA';
car.add(shell);
const wheels = new THREE.Group();
wheels.name = 'RODAS';
car.add(wheels);

function mesh(geometry, material, name, parent=shell){
  const o = new THREE.Mesh(geometry, material);
  o.name = name;
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

/* ================================================================
   PERFIL LATERAL — pontos (x,y) traçados a partir da silhueta real
   da planta: capô baixo e longo, para-brisa inclinado, teto de coupé
   arredondado, vidro traseiro inclinado, traseira curta e alta.
   x: -2.240 (frente) a +2.240 (traseira). y: altura do chão.
   ================================================================ */
const sideProfile = [
  [-2.240, 0.42],   // ponta dianteira, baixa
  [-2.180, 0.56],   // sobe até o para-choque
  [-1.900, 0.66],   // linha do capô começa
  [-1.500, 0.70],   // capô, quase reto e baixo
  [-1.150, 0.72],   // fim do capô, base do para-brisa
  [-0.950, 0.95],   // subida do para-brisa (inclinado)
  [-0.720, 1.17],   // topo do para-brisa / início do teto
  [-0.200, 1.245],  // ponto mais alto do teto (curva suave)
  [ 0.280, 1.235],  // teto continua, levemente descendo
  [ 0.680, 1.13],   // início da descida do vidro traseiro
  [ 0.980, 0.90],   // vidro traseiro inclinado
  [ 1.220, 0.74],   // base do vidro traseiro / tampa
  [ 1.650, 0.70],   // tampa traseira, quase reta
  [ 1.980, 0.66],   // início da queda para o para-choque
  [ 2.220, 0.50],   // para-choque traseiro
  [ 2.240, 0.34],   // ponta traseira baixa
  [ 2.200, 0.22],   // linha inferior traseira
  [ 1.700, 0.19],   // soleira traseira
  [-1.700, 0.19],   // soleira dianteira
  [-2.200, 0.24]    // fecha na ponta dianteira baixa
];

function extrudedSide(points, depth, z){
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for(let i=1;i<points.length;i++) shape.lineTo(points[i][0],points[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:2,steps:1});
  g.translate(0,0,-depth/2);
  const o = mesh(g,M.body,'lateral-carroceria');
  o.position.z = z;
  return o;
}

/* Duas laterais espelhadas, dando espessura à carroceria */
extrudedSide(sideProfile, 0.075, -HALF_W+0.038);
extrudedSide(sideProfile, 0.075,  HALF_W-0.038);

/* Painel de fundo que fecha o volume por dentro (evita ver vazio ao girar) */
{
  const bodyWidth = WIDTH - 0.076;
  const backShape = new THREE.Shape();
  backShape.moveTo(sideProfile[0][0], sideProfile[0][1]);
  for(let i=1;i<sideProfile.length;i++) backShape.lineTo(sideProfile[i][0],sideProfile[i][1]);
  backShape.closePath();
  const capGeo = new THREE.ShapeGeometry(backShape);
  const capL = mesh(capGeo, M.body2, 'tampa-interna-esq');
  capL.position.set(0,0,-bodyWidth/2);
  capL.rotation.y = Math.PI;
  const capR = mesh(capGeo, M.body2, 'tampa-interna-dir');
  capR.position.set(0,0, bodyWidth/2);
}

/* Teto — painel curvo simplificado unindo as duas laterais no topo */
{
  const roofPts = sideProfile.filter(p => p[0] >= -0.72 && p[0] <= 0.68 && p[1] > 1.00);
  const g = new THREE.BufferGeometry();
  const w = HALF_W - 0.02;
  const verts = [];
  for(let i=0;i<roofPts.length-1;i++){
    const [x1,y1] = roofPts[i], [x2,y2] = roofPts[i+1];
    verts.push(x1,y1,-w, x2,y2,-w, x1,y1, w);
    verts.push(x2,y2,-w, x2,y2, w, x1,y1, w);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts,3));
  g.computeVertexNormals();
  mesh(g, M.body, 'teto');
}

/* Vidros — dianteiro, traseiro e laterais, encaixados na abertura da cabine */
{
  const wf = mesh(new THREE.PlaneGeometry(.62,.42), M.glass, 'para-brisa');
  wf.position.set(-.84, 1.06, 0);
  wf.rotation.y = Math.PI/2;
  wf.rotation.z = -0.72;

  const rg = mesh(new THREE.PlaneGeometry(.58,.40), M.glass, 'vidro-traseiro');
  rg.position.set(1.08, 0.98, 0);
  rg.rotation.y = Math.PI/2;
  rg.rotation.z = 0.68;

  const sideWinPts = [[-.68,1.00],[-.42,1.20],[.24,1.20],[.62,1.00],[.58,.80],[-.62,.80]];
  const shape = new THREE.Shape();
  shape.moveTo(sideWinPts[0][0], sideWinPts[0][1]);
  for(let i=1;i<sideWinPts.length;i++) shape.lineTo(sideWinPts[i][0],sideWinPts[i][1]);
  shape.closePath();
  const wg = new THREE.ExtrudeGeometry(shape,{depth:.02,bevelEnabled:false});
  wg.translate(0,0,-.01);
  for(const z of [-HALF_W-0.002, HALF_W+0.002]){
    const win = mesh(wg, M.glass, 'vidro-lateral');
    win.position.z = z;
  }
}

/* Colunas visuais (A e C) nos limites da abertura de vidro */
for(const z of [-HALF_W+0.04, HALF_W-0.04]){
  const colA = mesh(new THREE.BoxGeometry(.07,.42,.07), M.body2, 'coluna-A');
  colA.position.set(-.72,1.00,z);
  colA.rotation.z = -0.55;
  const colC = mesh(new THREE.BoxGeometry(.07,.38,.07), M.body2, 'coluna-C');
  colC.position.set(.90,0.96,z);
  colC.rotation.z = 0.50;
}

/* Para-choques */
const bump = (x,name)=> {
  const o = mesh(new THREE.BoxGeometry(.14,.20,1.80), M.body2, name);
  o.position.set(x,.38,0);
  return o;
};
bump(-2.18,'parachoque-dianteiro');
bump( 2.18,'parachoque-traseiro');

/* Faróis e lanternas */
for(const z of [-.66,.66]){
  const farol = mesh(new THREE.BoxGeometry(.05,.15,.34), M.lamp, 'farol');
  farol.position.set(-2.245,.52,z);
  const lanterna = mesh(new THREE.BoxGeometry(.05,.14,.34), M.red, 'lanterna');
  lanterna.position.set(2.245,.50,z);
}

/* Portas — linhas em relevo */
for(const z of [-HALF_W-0.006, HALF_W+0.006]){
  const contorno = mesh(new THREE.BoxGeometry(1.55,.02,.02), M.body2, 'contorno-porta');
  contorno.position.set(0,.62,z);
  const macaneta = mesh(new THREE.BoxGeometry(.14,.035,.03), M.black, 'macaneta');
  macaneta.position.set(.30,.82,z);
}

/* Caixas de roda — arcos por cima das rodas, seguindo a curvatura */
function arch(x,z){
  const torus = mesh(new THREE.TorusGeometry(.38,.035,10,32,Math.PI), M.body2, 'arco-roda');
  torus.rotation.set(Math.PI/2,0,Math.PI);
  torus.position.set(x,.36,z);
}
arch(FRONT_AXLE,-HALF_W-.006); arch(FRONT_AXLE,HALF_W+.006);
arch(REAR_AXLE,-HALF_W-.006); arch(REAR_AXLE,HALF_W+.006);

/* Rodas — na bitola real de 1580mm */
function wheel(x,z,side){
  const g = new THREE.Group();
  g.name = \`roda-\${side}-\${x<0?'dianteira':'traseira'}\`;
  g.position.set(x,GROUND,z);
  wheels.add(g);
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R,WHEEL_R,WHEEL_W,40),M.rubber);
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
  wheel(FRONT_AXLE,z,z<0?'esq':'dir');
  wheel(REAR_AXLE,z,z<0?'esq':'dir');
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

document.getElementById('status').textContent='Modelo 3D carregado';

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

require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Auron Company Invest — Fábrica &amp; Concessionária</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700&display=swap');

:root{
  --bg: #0a0a0c;
  --bg-alt: #111114;
  --gold: #c9a24b;
  --gold-dim: #8a7038;
  --text: #e8e6e0;
  --text-dim: #8a8a90;
  --line: #2a2a2f;
  --red: #7d1f1f;
}

*{margin:0;padding:0;box-sizing:border-box}

html{scroll-behavior:smooth}

body{
  background:var(--bg);
  color:var(--text);
  font-family:'Archivo',sans-serif;
  overflow-x:hidden;
}

h1,h2,h3,.display{
  font-family:'Bebas Neue',sans-serif;
  letter-spacing:.01em;
  font-weight:400;
  line-height:.92;
}

::selection{background:var(--gold);color:var(--bg)}

/* ---------- reveal on scroll ---------- */
.reveal{
  opacity:0;
  transform:translateY(28px);
  transition:opacity .9s cubic-bezier(.16,1,.3,1), transform .9s cubic-bezier(.16,1,.3,1);
}
.reveal.in{opacity:1;transform:translateY(0)}
.reveal-delay-1{transition-delay:.12s}
.reveal-delay-2{transition-delay:.24s}
.reveal-delay-3{transition-delay:.36s}

@media (prefers-reduced-motion: reduce){
  .reveal{opacity:1;transform:none;transition:none}
  .type-line span{animation:none !important;opacity:1 !important}
}

/* ---------- nav ---------- */
nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  display:flex;justify-content:space-between;align-items:center;
  padding:26px 6vw;
  mix-blend-mode:difference;
}
.nav-mark{font-family:'Bebas Neue';font-size:22px;letter-spacing:.08em}
.nav-links{display:flex;gap:36px;font-size:13px;letter-spacing:.04em}
.nav-links a{color:var(--text);text-decoration:none;opacity:.8;transition:opacity .25s}
.nav-links a:hover{opacity:1}
@media (max-width:720px){.nav-links{display:none}}

/* ---------- hero ---------- */
.hero{
  min-height:100vh;
  display:flex;
  flex-direction:column;
  justify-content:flex-end;
  padding:0 6vw 8vh;
  position:relative;
  border-bottom:1px solid var(--line);
}
.hero-bg{
  position:absolute;inset:0;
  background:
    radial-gradient(ellipse 60% 50% at 70% 20%, rgba(201,162,75,.10), transparent),
    repeating-linear-gradient(100deg, transparent 0 120px, rgba(255,255,255,.018) 120px 121px);
  pointer-events:none;
}
.hero-eyebrow{
  font-size:14px;color:var(--gold);letter-spacing:.14em;
  margin-bottom:22px;
}
.hero-title{
  font-size:clamp(64px,13vw,168px);
  color:var(--text);
}
.hero-title .line{overflow:hidden;display:block}
.hero-title .line span{
  display:inline-block;
  transform:translateY(105%);
  animation:riseUp .9s cubic-bezier(.16,1,.3,1) forwards;
}
.hero-title .line:nth-child(1) span{animation-delay:.15s}
.hero-title .line:nth-child(2) span{animation-delay:.32s}
@keyframes riseUp{to{transform:translateY(0)}}

.hero-sub{
  max-width:520px;
  margin-top:28px;
  font-size:17px;
  line-height:1.6;
  color:var(--text-dim);
  opacity:0;
  animation:fadeIn 1s ease forwards;
  animation-delay:.75s;
}
@keyframes fadeIn{to{opacity:1}}

.hero-meta{
  display:flex;gap:48px;margin-top:56px;
  opacity:0;animation:fadeIn 1s ease forwards;animation-delay:.95s;
}
.hero-meta div{font-size:13px;color:var(--text-dim)}
.hero-meta strong{display:block;font-family:'Bebas Neue';font-size:28px;color:var(--text);letter-spacing:.02em}

/* ---------- section shell ---------- */
section{padding:140px 6vw;position:relative}
.section-alt{background:var(--bg-alt)}
.eyebrow{font-size:13px;color:var(--gold);letter-spacing:.1em;margin-bottom:18px}
.section-title{font-size:clamp(40px,6vw,84px);max-width:900px}
.section-lede{max-width:560px;color:var(--text-dim);font-size:17px;line-height:1.7;margin-top:28px}

/* ---------- sobre ---------- */
.sobre-grid{
  display:grid;grid-template-columns:1.1fr .9fr;gap:80px;margin-top:80px;
}
@media (max-width:900px){.sobre-grid{grid-template-columns:1fr}}
.sobre-stats{display:flex;flex-direction:column;gap:0}
.stat-row{
  display:flex;justify-content:space-between;align-items:baseline;
  padding:26px 0;border-top:1px solid var(--line);
}
.stat-row:last-child{border-bottom:1px solid var(--line)}
.stat-label{font-size:14px;color:var(--text-dim)}
.stat-value{font-family:'Bebas Neue';font-size:42px;color:var(--gold)}

/* ---------- linha (modelos) ---------- */
.linha-list{margin-top:70px;border-top:1px solid var(--line)}
.linha-item{
  display:grid;grid-template-columns:70px 1fr 220px 40px;
  align-items:center;
  padding:34px 0;
  border-bottom:1px solid var(--line);
  cursor:pointer;
  transition:padding-left .3s ease, background .3s ease;
}
.linha-item:hover{padding-left:18px;background:rgba(201,162,75,.04)}
.linha-num{font-family:'Bebas Neue';font-size:16px;color:var(--gold-dim)}
.linha-name{font-family:'Bebas Neue';font-size:clamp(26px,4vw,48px);letter-spacing:.01em}
.linha-tag{font-size:13px;color:var(--text-dim);letter-spacing:.04em}
.linha-status{
  font-size:11px;letter-spacing:.08em;color:var(--text-dim);
  border:1px solid var(--line);border-radius:100px;
  padding:7px 14px;text-align:center;white-space:nowrap;justify-self:start;
}
.linha-arrow{font-size:22px;color:var(--gold);opacity:0;transform:translateX(-8px);transition:.3s}
.linha-item:hover .linha-arrow{opacity:1;transform:translateX(0)}
@media (max-width:720px){
  .linha-item{grid-template-columns:40px 1fr;row-gap:10px}
  .linha-status,.linha-arrow{grid-column:2}
}

/* preview 3D placeholder (visual, sem three.js) */
.preview-note{
  margin-top:56px;padding:28px 30px;border:1px dashed var(--line);
  border-radius:4px;font-size:14px;color:var(--text-dim);line-height:1.7;
  display:flex;gap:18px;align-items:flex-start;
}
.preview-note .dot{width:8px;height:8px;border-radius:50%;background:var(--gold);margin-top:7px;flex:none}

/* ---------- carreiras ---------- */
.carreiras{
  display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:80px;
}
@media (max-width:900px){.carreiras{grid-template-columns:1fr}}
.carreiras-copy p{color:var(--text-dim);font-size:17px;line-height:1.75;margin-bottom:20px}
.uniform-card{
  border:1px solid var(--line);padding:44px 38px;
  background:linear-gradient(160deg, rgba(201,162,75,.06), transparent 60%);
}
.uniform-card h3{font-size:30px;margin-bottom:16px}
.uniform-list{list-style:none;display:flex;flex-direction:column;gap:14px;margin-top:24px}
.uniform-list li{
  display:flex;gap:14px;font-size:15px;color:var(--text-dim);align-items:baseline;
}
.uniform-list li::before{content:'—';color:var(--gold);flex:none}

/* ---------- cta final ---------- */
.cta{
  min-height:70vh;display:flex;flex-direction:column;justify-content:center;
  text-align:left;border-top:1px solid var(--line);
}
.cta-title{font-size:clamp(48px,9vw,120px);max-width:1000px}
.cta-title em{font-style:normal;color:var(--gold)}
.cta-actions{display:flex;gap:20px;margin-top:48px;flex-wrap:wrap}
.btn{
  font-family:'Archivo';font-size:15px;font-weight:600;
  padding:18px 34px;border-radius:2px;text-decoration:none;
  transition:transform .25s ease, background .25s ease;
  display:inline-block;
}
.btn-primary{background:var(--gold);color:var(--bg)}
.btn-primary:hover{transform:translateY(-3px)}
.btn-ghost{border:1px solid var(--line);color:var(--text)}
.btn-ghost:hover{border-color:var(--gold);color:var(--gold)}

footer{
  padding:50px 6vw;border-top:1px solid var(--line);
  display:flex;justify-content:space-between;color:var(--text-dim);font-size:13px;
  flex-wrap:wrap;gap:16px;
}
</style>
</head>
<body>

<nav>
  <div class="nav-mark">AURON</div>
  <div class="nav-links">
    <a href="#sobre">Sobre</a>
    <a href="#linha">Linha</a>
    <a href="#carreiras">Carreiras</a>
    <a href="#investir">Investir</a>
  </div>
</nav>

<header class="hero">
  <div class="hero-bg"></div>
  <div class="hero-eyebrow">Auron Company Invest — Fábrica &amp; Concessionária</div>
  <h1 class="hero-title">
    <span class="line"><span>ENGENHARIA</span></span>
    <span class="line"><span>EM MOVIMENTO.</span></span>
  </h1>
  <p class="hero-sub">Projetamos, fabricamos e entregamos veículos com a mesma régua: precisão de linha de montagem e obsessão pelo detalhe. Esta é a Auron.</p>
  <div class="hero-meta">
    <div><strong>03</strong>modelos em linha</div>
    <div><strong>2026</strong>ano de fundação</div>
    <div><strong>01</strong>fábrica-sede</div>
  </div>
</header>

<section id="sobre">
  <div class="eyebrow reveal">Sobre a Auron</div>
  <h2 class="section-title reveal reveal-delay-1">Da chapa de aço<br>ao showroom.</h2>
  <div class="sobre-grid">
    <p class="section-lede reveal reveal-delay-2">A Auron nasce para ocupar o espaço entre a engenharia pesada e a experiência de quem compra o carro pronto. Uma única companhia cuidando de toda a cadeia: fábrica própria, concessionária própria, padrão único do primeiro parafuso à entrega das chaves.</p>
    <div class="sobre-stats reveal reveal-delay-3">
      <div class="stat-row"><span class="stat-label">Capacidade de produção</span><span class="stat-value">40/dia</span></div>
      <div class="stat-row"><span class="stat-label">Postos de trabalho diretos</span><span class="stat-value">180</span></div>
      <div class="stat-row"><span class="stat-label">Concessionárias planejadas</span><span class="stat-value">06</span></div>
    </div>
  </div>
</section>

<section id="linha" class="section-alt">
  <div class="eyebrow reveal">Linha de produção</div>
  <h2 class="section-title reveal reveal-delay-1">Os modelos<br>Auron.</h2>
  <p class="section-lede reveal reveal-delay-2">Três modelos abrem a linha. As fichas técnicas completas e os modelos 3D interativos entram no ar nas próximas semanas — hoje, a apresentação oficial dos nomes e posicionamento.</p>

  <div class="linha-list">
    <div class="linha-item reveal">
      <span class="linha-num">01</span>
      <span class="linha-name">Auron Ferro</span>
      <span class="linha-tag">Esportivo de entrada</span>
      <span class="linha-status">Em fábrica</span>
      <span class="linha-arrow">→</span>
    </div>
    <div class="linha-item reveal reveal-delay-1">
      <span class="linha-num">02</span>
      <span class="linha-name">Auron Vetor</span>
      <span class="linha-tag">Sedã executivo</span>
      <span class="linha-status">Em fábrica</span>
      <span class="linha-arrow">→</span>
    </div>
    <div class="linha-item reveal reveal-delay-2">
      <span class="linha-num">03</span>
      <span class="linha-name">Auron Marco</span>
      <span class="linha-tag">SUV de linha</span>
      <span class="linha-status">Pré-produção</span>
      <span class="linha-arrow">→</span>
    </div>
  </div>

  <div class="preview-note reveal reveal-delay-3">
    <span class="dot"></span>
    <span>Visualização 3D dos modelos: em desenvolvimento. Esta apresentação traz o posicionamento de marca e a estrutura da linha — os modelos interativos entram nesta mesma página assim que estiverem prontos.</span>
  </div>
</section>

<section id="carreiras">
  <div class="eyebrow reveal">Vista a camisa</div>
  <h2 class="section-title reveal reveal-delay-1">Quem constrói<br>a Auron.</h2>
  <div class="carreiras">
    <div class="carreiras-copy reveal reveal-delay-2">
      <p>Toda empresa começa com quem topa entrar antes de existir prova de que vai dar certo. Hoje convidamos quem está nesta sala a ocupar um posto na Auron — da linha de produção ao balcão da concessionária.</p>
      <p>Quem veste a camisa, entra na fundação da companhia. Não como espectador: como parte do time que decide como a Auron vai ser.</p>
    </div>
    <div class="uniform-card reveal reveal-delay-3">
      <h3>Times abertos hoje</h3>
      <ul class="uniform-list">
        <li>Linha de montagem e engenharia</li>
        <li>Vendas e relacionamento — concessionária</li>
        <li>Marca, comunicação e eventos</li>
        <li>Operações e expansão</li>
      </ul>
    </div>
  </div>
</section>

<section id="investir" class="cta section-alt">
  <div class="eyebrow reveal">Para quem fica de fora do quadro</div>
  <h2 class="cta-title reveal reveal-delay-1">Não trabalha na Auron?<br>Então <em>entre</em> na Auron.</h2>
  <p class="section-lede reveal reveal-delay-2">Quem não veste a camisa hoje ainda tem um lugar: como cliente da primeira hora ou investidor da primeira rodada. A fábrica está de portas abertas.</p>
  <div class="cta-actions reveal reveal-delay-3">
    <a href="#" class="btn btn-primary">Quero investir na Auron</a>
    <a href="#" class="btn btn-ghost">Reservar um modelo</a>
  </div>
</section>

<footer>
  <span>Auron Company Invest — Fábrica &amp; Concessionária</span>
  <span>Apresentação institucional · 2026</span>
</footer>

<script>
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting) e.target.classList.add('in'); });
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
</script>

</body>
</html>
`);
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
});

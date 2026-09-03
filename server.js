require('dotenv').config();
const express = require('express');
const app = express();
app.set('trust proxy', true);

const fs = require('fs');
const path = require('path');
const caminhoBlacklist = path.join(__dirname, 'blacklist.json');
app.set('trust proxy', true);

let ipsBloqueados = new Set();

function carregarBlacklist() {
    try {
        if (fs.existsSync(caminhoBlacklist)) {
            const dados = JSON.parse(fs.readFileSync(caminhoBlacklist, 'utf8'));
            ipsBloqueados = new Set(dados);
        }
    } catch (erro) {
        console.error('🔴 Erro ao carregar blacklist:', erro.message);
    }
}
carregarBlacklist();
setInterval(carregarBlacklist, 10000);

function pegarIpReal(req) {
    return req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
}

const tentativas404 = new Map();
const bloqueiosTemporarios = new Map();
const contadorReincidencia = new Map();

const JANELA_MS = 60 * 1000;
const LIMITE_404 = 100;
const DURACAO_BASE_MS = 15 * 60 * 1000;

function estaTemporariamenteBloqueado(ip) {
    const expiraEm = bloqueiosTemporarios.get(ip);
    if (!expiraEm) return false;
    if (Date.now() > expiraEm) {
        bloqueiosTemporarios.delete(ip);
        return false;
    }
    return true;
}

function bloquearTemporario(ip, motivo) {
    const vezes = (contadorReincidencia.get(ip) || 0) + 1;
    contadorReincidencia.set(ip, vezes);
    const duracao = DURACAO_BASE_MS * Math.pow(2, vezes - 1);
    bloqueiosTemporarios.set(ip, Date.now() + duracao);
    const msg = `🚫 IP ${ip} bloqueado (${motivo}, reincidência ${vezes}) por ${duracao / 60000} min`;
    console.log(msg);
    io.emit('log_update', { level: 'error', message: msg });
}

function registrar404(ip) {
    const agora = Date.now();
    let lista = tentativas404.get(ip) || [];
    lista = lista.filter(t => agora - t < JANELA_MS);
    lista.push(agora);
    tentativas404.set(ip, lista);

    if (lista.length >= LIMITE_404) {
        bloquearTemporario(ip, '404 excessivo');
        tentativas404.delete(ip);
    }
}

setInterval(() => {
    const agora = Date.now();
    for (const [ip, expiraEm] of bloqueiosTemporarios.entries()) {
        if (agora > expiraEm) bloqueiosTemporarios.delete(ip);
    }
}, 60 * 1000);

app.use((req, res, next) => {
    const ip = pegarIpReal(req);
    req.ipReal = ip;

    if (ipsBloqueados.has(ip) || estaTemporariamenteBloqueado(ip)) {
        return res.status(404).json();
    }
    next();
});

const rateLimit = require('express-rate-limit');

const limitadorGeral = rateLimit({
    windowMs: 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ipReal || pegarIpReal(req),
    handler: (req, res) => {
        const ip = req.ipReal || pegarIpReal(req);
        bloquearTemporario(ip, 'flood gerall');
        res.status(429).json({ erro: 'too many requests'});
    }
});
app.use(limitadorGeral);

app.use((req, res, next) => {
    const linha = `${req.method} ${req.originalUrl} — IP: ${req.ipReal}`;
    console.log(`📥 ${linha}`);
    io.emit('log_update', { level: 'info', message: linha });
    next();
});

app.use((req, res, next) => {
    res.on('finish', () => {
        if (res.statusCode === 404) {
            registrar404(req.ipReal);
        }
    });
    next();
});

process.on('unhandledRejection', (err) => console.error('🔴 Unhandled Rejection:', err));
process.on('uncaughtException', (err) => console.error('🔴 Uncaught Exception:', err));
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    path: '/s/socket.io',
    transports: ['websocket'],
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 25000,
    pingTimeout: 15000
});

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const { MongoClient, ServerApiVersion } = require('mongodb');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const { createProxyMiddleware } = require('http-proxy-middleware');
const { Resend } = require('resend');
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// ========== VALIDAÇÃO CENTRALIZADA DE EMAIL ==========
// Regras: 10-100 caracteres, somente A-Z/a-z, 0-9, _, @ e .; no máximo 2 @.
const EMAIL_REGEX_PERMITIDO = /^[A-Za-z0-9_@.]+$/;
function validarEmailPuro(valor) {
    if (typeof valor !== 'string') return null;
    if (valor.length < 10 || valor.length > 100) return null;
    if (!EMAIL_REGEX_PERMITIDO.test(valor)) return null;
    if ((valor.match(/@/g) || []).length > 2) return null;
    return valor.toLowerCase();
}

function exigirEmailPuro(valor, res) {
    const email = validarEmailPuro(valor);
    if (!email) {
        res.status(400).json({ erro: 'Email inválido. Use 10-100 caracteres e somente letras, números, _, @ e .; máximo de 2 @.' });
        return null;
    }
    return email;
}


const ERLANG_TARGET = process.env.ERLANG_URL || null;
const proxyErlang = ERLANG_TARGET ? createProxyMiddleware({
    target: ERLANG_TARGET,
    changeOrigin: true,
    ws: true,
    on: {
        error: (err, req, res) => {
            console.error('🔴 Erro no proxy Erlang:', err.message);
            try {
                if (res && res.writeHead && !res.headersSent && !res.writableEnded) {
                    res.writeHead(502, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ erro: 'Serviço indisponível' }));
                }
            } catch (e) {
                console.error('🔴 Erro secundário ao tentar responder erro de proxy:', e.message);
            }
        }
    }
}) : null;

app.use((req, res, next) => {
    if (
        req.path.startsWith('/s/socket.io') ||
        req.path.startsWith('/socket.io')
    ) {
        return next();
    }
    if (req.path.startsWith('/s')) {
        req.url = req.url.replace(/^\/s/, '') || '/';
        return next();
    }
    return next();
});

http.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/s/socket.io') || req.url.startsWith('/socket.io')) {
        return;
    }
    if (proxyErlang) {
        proxyErlang.upgrade(req, socket, head);
    } else {
        socket.destroy();
    }
});

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  tls: true,
  tlsAllowInvalidCertificates: true
});
let db, usuariosColl, contatosColl, codigosColl, mensagensColl, pedidosApagarColl, confirmacoesPendentesColl, midiasPendentesColl;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("meu_aplicativo_chat");
        usuariosColl = db.collection("usuarios");
        contatosColl = db.collection("contatos");
        codigosColl = db.collection("codigos_verificacao");
        mensagensColl = db.collection("mensagens");
        pedidosApagarColl = db.collection("pedidos_apagar");
        confirmacoesPendentesColl = db.collection("confirmacoes_pendentes");
        midiasPendentesColl = db.collection("midias_pendentes");
        console.log("🟢 Connected");
        await mensagensColl.createIndex({ email_contato: 1, usuario: 1 });
        await mensagensColl.createIndex({ chat_id: 1, timestamp: 1 });
        await mensagensColl.createIndex({ id: 1 }, { unique: true });
        await midiasPendentesColl.createIndex({ id: 1 }, { unique: true });
        await midiasPendentesColl.createIndex({ destinatario: 1 });
        await usuariosColl.createIndex({ email: 1 }, { unique: true });
    } catch (erro) {
        console.error("🔴 Error", erro);
    }
}

conectarBanco();
function gerarChaveAleatoria() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let chave = '';
    for (let i = 0; i < 44; i++) {
        chave += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return chave;
}

function validarIdentificadorMensagem(valor) {
    if (typeof valor !== 'string') return false;
    if (valor.length > 300) return false;
    return /^[A-Za-z0-9_@.]+$/.test(valor);
}

function validarPacoteCifrado(pacote) {
    if (!pacote || typeof pacote !== 'object') {
        return 'pacote_formato_invalido';
    }
    if (!pacote.payload) return 'pacote_sem_payload';
    if (!pacote.chave_aes) return 'pacote_sem_chave_aes';
    if (!pacote.assinatura) return 'pacote_sem_assinatura';
    return null;
}

async function garantirChaveUsuario(email) {
    const usuario = await usuariosColl.findOne({ email: email });
    if (usuario && !usuario.chave_cripto) {
        const novaChave = gerarChaveAleatoria();
        await usuariosColl.updateOne(
            { email: email },
            { $set: { chave_cripto: novaChave } }
        );
        return novaChave;
    }
    return usuario ? usuario.chave_cripto : null;
}

async function gravarConfirmacaoPendente(emailDestino, id) {
    await confirmacoesPendentesColl.insertOne({
        email_destino: emailDestino,
        id: id,
        criadoEm: new Date()
    });
}

async function buscarEConsumirConfirmacoesPendentes(emailAlvo) {
    const emailAlvoLimpo = emailAlvo.trim().toLowerCase();

    const confirmacoes = await confirmacoesPendentesColl.find({ email_destino: emailAlvoLimpo }).toArray();
    if (confirmacoes.length === 0) return [];

    const idsDocumentos = confirmacoes.map(c => c._id);
    await confirmacoesPendentesColl.deleteMany({ _id: { $in: idsDocumentos } });

    return confirmacoes;
}


async function garantirNomePerfil(email, nomePadrao) {
    try {
        const usuario = await usuariosColl.findOne({ email: email });
        if (usuario && !usuario.nome_perfil) {
            await usuariosColl.updateOne(
                { email: email },
                { $set: { nome_perfil: nomePadrao } }
            );
        }
    } catch (erro) {
        console.error("Erro", erro);
    }
}

const CHAVE_SECRETA = process.env.CHAVE_XOR;

function gerarToken(email) {
    const payload = JSON.stringify({ 
        email: email, 
        criadoEm: Date.now(),
        expira: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });
    const payloadBase64 = Buffer.from(payload).toString('base64url');
    
    const assinatura = crypto
        .createHmac('sha256', CHAVE_SECRETA)
        .update(payloadBase64)
        .digest('base64url');
    
    return `${payloadBase64}.${assinatura}`;
}

async function enviarEmailCodigo(emailDestino, codigo) {
    try {
        const resultado = await resend.emails.send({
            from: process.env.EMAIL_REMETENTE || 'onboarding@resend.dev',
            to: emailDestino,
            subject: 'Seu código de verificação',
            html: `<p>Seu código de verificação é:</p><h2>${codigo}</h2><p>Se você não solicitou este código, ignore este email.</p>`
        });
        if (resultado.error) {
            console.error('🔴 Erro ao enviar email de verificação:', resultado.error);
            return false;
        }
        return true;
    } catch (erro) {
        console.error('🔴 Erro ao enviar email de verificação:', erro.message);
        return false;
    }
}

function validarToken(token) {
    if (!token || typeof token !== 'string') return null;
    
    const partes = token.split('.');
    if (partes.length !== 2) return null;
    
    const [payloadBase64, assinatura] = partes;
    
    const assinaturaEsperada = crypto
        .createHmac('sha256', CHAVE_SECRETA)
        .update(payloadBase64)
        .digest('base64url');
    
    const bufA = Buffer.from(assinatura);
    const bufB = Buffer.from(assinaturaEsperada);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        return null;
    }
    
    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
        if (payload.expira < Date.now()) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

function autenticarToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
        ? authHeader.slice(7) 
        : null;
    
    const payload = validarToken(token);
    if (!payload) {
        return res.status(401).json({ erro: "Token inválido ou expirado." });
    }
    
    req.emailAutenticado = payload.email;
    next();
}

// ========== LOGIN DO PAINEL ADMIN (separado do login de usuários do app) ==========
const SENHA_PAINEL = process.env.PAINEL_SENHA;
const NOME_COOKIE_PAINEL = 'painel_sessao';

function gerarTokenPainel() {
    const payload = JSON.stringify({
        painel: true,
        criadoEm: Date.now(),
        expira: Date.now() + (12 * 60 * 60 * 1000) // 12h
    });
    const payloadBase64 = Buffer.from(payload).toString('base64url');
    const assinatura = crypto
        .createHmac('sha256', CHAVE_SECRETA)
        .update('painel:' + payloadBase64)
        .digest('base64url');
    return `${payloadBase64}.${assinatura}`;
}

function validarTokenPainel(token) {
    if (!token || typeof token !== 'string') return false;
    const partes = token.split('.');
    if (partes.length !== 2) return false;
    const [payloadBase64, assinatura] = partes;

    const assinaturaEsperada = crypto
        .createHmac('sha256', CHAVE_SECRETA)
        .update('painel:' + payloadBase64)
        .digest('base64url');

    const bufA = Buffer.from(assinatura);
    const bufB = Buffer.from(assinaturaEsperada);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
        return false;
    }

    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
        if (!payload.painel || payload.expira < Date.now()) return false;
        return true;
    } catch (e) {
        return false;
    }
}

function autenticarPainel(req, res, next) {
    const token = req.cookies ? req.cookies[NOME_COOKIE_PAINEL] : null;
    if (!validarTokenPainel(token)) {
        return res.redirect('/');
    }
    next();
}

let historico = [];

function descriptografarXOR(dadosBase64) {
    try {
        const dados = Buffer.from(dadosBase64, 'base64');
        const chave = Buffer.from(CHAVE_SECRETA);
        for (let i = 0; i < dados.length; i++) {
            dados[i] = dados[i] ^ chave[i % chave.length];
        }
        return dados;
    } catch (erro) {
        console.error('Error', erro);
        return null;
    }
}

// ========== SISTEMA DE DELEÇÃO "PARA TODOS" (persistente no MongoDB) ==========
async function gravarPedidoApagar(emailDestino, ids, emailOrigem) {
    await pedidosApagarColl.insertOne({
        email_destino: emailDestino,
        email_origem: emailOrigem,
        ids: ids,
        criadoEm: new Date()
    });
}

async function buscarEConsumirPedidos(emailAlvo) {
    const emailAlvoLimpo = emailAlvo.trim().toLowerCase();

    const pedidos = await pedidosApagarColl.find({ email_destino: emailAlvoLimpo }).toArray();
    if (pedidos.length === 0) return [];

    const idsDocumentos = pedidos.map(p => p._id);
    await pedidosApagarColl.deleteMany({ _id: { $in: idsDocumentos } });

    return pedidos;
}
app.post('/apagar_para_todos', autenticarToken, async (req, res) => {
    try {
        const { ids, email_destino } = req.body;
        const emailOrigem = req.emailAutenticado;

        if (!ids || !Array.isArray(ids) || ids.length === 0 || !email_destino) {
            return res.status(400).json({ erro: "Dados incompletos." });
        }

        const emailDestinoLimpo = validarEmailPuro(email_destino);
        if (!emailDestinoLimpo) return res.status(400).json({ erro: 'Email destinatário inválido.' });

        await gravarPedidoApagar(emailDestinoLimpo, ids, emailOrigem);

        const salaDestino = io.sockets.adapter.rooms.get(emailDestinoLimpo);
        if (salaDestino && salaDestino.size > 0) {
            const pedidosAgora = await buscarEConsumirPedidos(emailDestinoLimpo);
            if (pedidosAgora.length > 0) {
                const todosIds = pedidosAgora.flatMap(p => p.ids);
                io.to(emailDestinoLimpo).emit('pedidos_apagar_pendentes', { ids: todosIds });
            }
        }

        res.json({ status: "ok" });
    } catch (erro) {
        console.error('Erro em /apagar_para_todos:', erro);
        res.status(500).json({ erro: "Erro ao processar apagar para todos" });
    }
});
app.post('/confirmar_recebimento', autenticarToken, async (req, res) => {
    try {
        const { ids } = req.body;
        const emailFiltro = req.emailAutenticado;

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ erro: "Dados inválidos." });
        }

        const msgsNaoEntregues = await mensagensColl.find({
            id: { $in: ids },
            email_contato: emailFiltro,
            entregue: { $ne: true }
        }).toArray();

        if (msgsNaoEntregues.length === 0) {
            return res.json({ status: "ok" });
        }

        const idsParaAtualizar = msgsNaoEntregues.map(m => m.id);

        await mensagensColl.updateMany(
            { id: { $in: idsParaAtualizar } },
            { $set: { entregue: true } }
        );

        const porRemetente = {};
        for (const msg of msgsNaoEntregues) {
            const remetente = msg.usuario.trim().toLowerCase();
            if (!porRemetente[remetente]) porRemetente[remetente] = [];
            porRemetente[remetente].push(msg.id);
        }

for (const [remetente, idsDoRemetente] of Object.entries(porRemetente)) {
    const sala = io.sockets.adapter.rooms.get(remetente);
    if (sala && sala.size > 0) {
        for (const id of idsDoRemetente) {
            io.timeout(5000).to(remetente).emit('mensagem_recebida', { id }, async (err, responses) => {
                if (err || !responses || responses.length === 0) {
                    await gravarConfirmacaoPendente(remetente, id);
                }
            });
        }
    } else {
        for (const id of idsDoRemetente) {
            await gravarConfirmacaoPendente(remetente, id);
        }
    }
}

        res.json({ status: "ok" });
    } catch (erro) {
        console.error("Erro:", erro);
        res.status(500).json({ erro: "Erro ao confirmar" });
    }
});

app.post('/refresh-token', autenticarToken, (req, res) => {
    const novoTokens = gerarToken(req.emailAutenticado);
    res.json({ token: novoTokens });
});

app.get('/get_foto_email', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório." });

    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;

    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.foto || usuario.foto.length < 10) {
            return res.status(404).json({ status: "sem_foto" });
        }

        const fotoBuffer = Buffer.from(usuario.foto, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fotoBuffer);
    } catch (erro) {
        console.error("Erro ao buscar foto individual:", erro);
        res.status(500).json({ erro: "Erro ao buscar foto" });
    }
});

app.post('/upload_foto', autenticarToken, async (req, res) => {
    const { foto } = req.body;
    const emailLimpo = req.emailAutenticado;
    if (!foto) return res.status(400).json({ erro: "Dados incompletos." });

    const fotoLimpa = foto.replace(/[\s\n\r]/g, '');

    const resultado = await usuariosColl.updateOne(
        { email: emailLimpo },
        { $set: { foto: fotoLimpa } }
    );

    if (resultado.matchedCount === 0) {
        return res.status(404).json({ erro: "Usuário não encontrado." });
    }

    io.emit('foto_atualizada', { email: emailLimpo, foto: fotoLimpa });
    res.json({ status: "ok" });
});

app.get('/usuario', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório." });
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    
    try {
        let usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });
        
        if (!usuario.nome_perfil) {
            const nomePadrao = emailLimpo.split('@')[0];
            await usuariosColl.updateOne(
                { email: emailLimpo },
                { $set: { nome_perfil: nomePadrao } }
            );
            usuario.nome_perfil = nomePadrao;
        }
        
        res.json({ nome: usuario.nome_perfil, email: emailLimpo });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar usuário" });
    }
});

app.post('/mensagens/apagar_especifica', autenticarToken, async (req, res) => {
    try {
        const { ids } = req.body;
        const emailLimpo = req.emailAutenticado;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ erro: "IDs são obrigatórios." });
        }

        const resultado = await mensagensColl.deleteMany({
            id: { $in: ids },
            usuario: emailLimpo
        });

        historico = historico.filter(msg => !ids.includes(msg.id));

        if (resultado.deletedCount === 0) {
            return res.status(404).json({ 
                erro: "Nenhuma mensagem encontrada para apagar." 
            });
        }

        res.json({ 
            status: "ok", 
            apagadas: resultado.deletedCount 
        });

    } catch (erro) {
        console.error('Error deleting message: ', erro);
        res.status(500).json({ erro: "Erro ao apagar mensagens" });
    }
});


app.post('/salvar_contatos', autenticarToken, async (req, res) => {
    const { contatos } = req.body;
    const emailLimpo = req.emailAutenticado;
    const listaContatos = Array.isArray(contatos) ? contatos : [];

    try {
        await contatosColl.updateOne(
            { email: emailLimpo },
            { $set: { contatos: listaContatos, atualizadoEm: new Date() } },
            { upsert: true }
        );
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "error saving contacts." });
    }
});

app.get('/buscar_contatos', autenticarToken, async (req, res) => {
    const emailLimpo = req.emailAutenticado;

    try {
        const registro = await contatosColl.findOne({ email: emailLimpo });
        if (!registro || !registro.contatos) return res.status(200).json([]);
        res.status(200).json(registro.contatos);
    } catch (erro) {
        res.status(500).json([]);
    }
});

app.get('/get_foto_contato', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    
    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.foto) return res.status(404).json({ status: "sem_foto" });
        
        const fotoBuffer = Buffer.from(usuario.foto, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fotoBuffer);
    } catch (erro) {
        res.status(500).json({ erro: "error retrieving photo." });
    }
});

app.get('/get_foto', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    
    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.foto) return res.json({ status: "sem_foto" });
        
        const fotoBuffer = Buffer.from(usuario.foto, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fotoBuffer);
    } catch (erro) {
        res.json({ status: "erro" });
    }
});

app.post('/deletar_foto', autenticarToken, async (req, res) => {
    const emailLimpo = req.emailAutenticado;

    try {
        await usuariosColl.updateOne({ email: emailLimpo }, { $unset: { foto: "" } });
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Error deleting photo." });
    }
});

app.post('/carts',async (req, res) => {
    try {"<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Carro 3D — Modelo baseado na planta</title>
<style>
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#090b0f;font-family:Arial,sans-serif}
#app{position:fixed;inset:0}
canvas{display:block}
.hud{
  position:fixed;left:18px;top:18px;z-index:5;
  color:#fff;background:rgba(8,10,14,.72);
  border:1px solid rgba(255,255,255,.12);
  backdrop-filter:blur(12px);border-radius:14px;
  padding:14px 16px;line-height:1.45;max-width:330px;
  box-shadow:0 10px 30px rgba(0,0,0,.35)
}
.hud b{font-size:16px}.hud small{opacity:.7}
.controls{
  position:fixed;right:18px;bottom:18px;z-index:5;
  display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end
}
button{
  border:1px solid rgba(255,255,255,.14);background:rgba(15,18,24,.82);
  color:#fff;border-radius:10px;padding:10px 12px;cursor:pointer;
  backdrop-filter:blur(8px)
}
button:hover{background:rgba(35,40,50,.9)}
.badge{
  display:inline-block;margin-top:8px;padding:4px 7px;border-radius:6px;
  background:rgba(255,255,255,.08);font-size:11px
}
</style>
</head>
<body>
<div id="app"></div>

<div class="hud">
  <b>Modelo 3D — carroceria</b><br>
  <small>Proporções aproximadas da imagem de referência</small><br>
  <span class="badge">4480 × 1950 × 1250 mm</span>
  <span class="badge">Entre-eixos: 2475 mm</span>
  <br><br>
  Arraste para girar · roda do mouse para zoom · dois dedos no celular
</div>

<div class="controls">
  <button id="view3d">3D</button>
  <button id="viewFront">Frente</button>
  <button id="viewSide">Lateral</button>
  <button id="viewTop">Superior</button>
  <button id="shell">Carroceria</button>
</div>

<script src="https://cdn.jsdelivr.net/npm/three@0.179.1/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.179.1/examples/js/controls/OrbitControls.js"></script>

<script>
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090b0f);

const camera = new THREE.PerspectiveCamera(38, innerWidth/innerHeight, .01, 100);
camera.position.set(6.4,3.0,6.6);

const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.05;
document.getElementById('app').appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;
controls.dampingFactor=.07;
controls.minDistance=3.2;
controls.maxDistance=12;
controls.target.set(0,.75,0);

/* ------------------------------
   ESCALA
   O modelo usa metros.
   4.480 m x 1.950 m x 1.250 m
--------------------------------*/
const L=4.480, W=1.950, H=1.250;
const wheelBase=2.475;
const frontAxle=-1.7625;
const rearAxle=0.7125;

/* iluminação */
scene.add(new THREE.HemisphereLight(0xdfe9ff,0x20242c,2.0));

const key=new THREE.DirectionalLight(0xffffff,3.0);
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
  new THREE.MeshStandardMaterial({color:0x11151b,roughness:.82,metalness:.05})
);
floor.rotation.x=-Math.PI/2;
floor.position.y=.02;
floor.receiveShadow=true;
scene.add(floor);

/* ------------------------------
   materiais
--------------------------------*/
const bodyMat=new THREE.MeshPhysicalMaterial({
  color:0x7c8791,metalness:.78,roughness:.24,
  clearcoat:.65,clearcoatRoughness:.16
});
const darkMat=new THREE.MeshStandardMaterial({
  color:0x090b0e,metalness:.25,roughness:.38
});
const glassMat=new THREE.MeshPhysicalMaterial({
  color:0x101821,metalness:.15,roughness:.08,
  transmission:.08,transparent:true,opacity:.86
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

/* grupo principal */
const car=new THREE.Group();
scene.add(car);

/* ------------------------------
   Loft: cria uma carroceria
   através de várias seções.
--------------------------------*/
function loft(sections, material, yOffset=0){
  const verts=[], indices=[];
  /*
    Cada seção:
    [x, halfWidth, bottomY, shoulderY, roofY]
    As 8 posições formam um contorno transversal.
  */
  for(const s of sections){
    const [x,hw,bottom,shoulder,roof]=s;
    const pts=[
      [x,bottom,0],
      [x,bottom+.08, hw*.72],
      [x,shoulder-.12,hw],
      [x,shoulder,hw*.78],
      [x,roof,hw*.40],
      [x,roof+.02,0],
      [x,roof,-hw*.40],
      [x,shoulder,-hw*.78],
      [x,shoulder-.12,-hw]
    ];
    for(const p of pts) verts.push(...p);
  }
  const n=9;
  for(let i=0;i<sections.length-1;i++){
    for(let j=0;j<n;j++){
      const a=i*n+j, b=i*n+(j+1)%n;
      const c=(i+1)*n+(j+1)%n, d=(i+1)*n+j;
      indices.push(a,b,d,b,c,d);
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  g.setIndex(indices);
  g.computeVertexNormals();
  const m=new THREE.Mesh(g,material);
  m.castShadow=true;m.receiveShadow=true;
  car.add(m);
  return m;
}

/*
  Perfis inspirados diretamente nas vistas:
  frente longa/baixa, cabine recuada,
  teto baixo e traseira curta.
*/
loft([
 [-2.240,.78,.50,.88,.93],
 [-2.12,.90,.48,.94,1.00],
 [-1.85,.975,.47,1.00,1.08],
 [-1.60,.975,.46,1.02,1.12],
 [-1.35,.975,.46,1.00,1.17],
 [-1.05,.975,.46,1.00,1.25],
 [-.72,.965,.46,1.02,1.25],
 [-.40,.94,.46,1.03,1.25],
 [-.05,.92,.46,1.04,1.25],
 [.32,.90,.46,1.04,1.22],
 [.68,.89,.46,1.02,1.16],
 [1.02,.88,.46,1.00,1.09],
 [1.35,.86,.46,.98,1.04],
 [1.68,.82,.47,.94,.99],
 [2.00,.78,.48,.90,.94],
 [2.20,.70,.50,.85,.90],
 [2.24,.62,.52,.82,.88]
],bodyMat);

/* saia inferior */
const skirt=new THREE.Mesh(
  new THREE.BoxGeometry(3.72,.16,1.82),
  bodyMat
);
skirt.position.set(.10,.48,0);
skirt.castShadow=true;
car.add(skirt);

/* capô */
const hood=new THREE.Mesh(
  new THREE.BoxGeometry(1.22,.11,1.68),
  bodyMat
);
hood.position.set(-1.52,1.01,0);
hood.rotation.z=-.018;
hood.castShadow=true;
car.add(hood);

/* porta esquerda/direita */
function addDoor(z){
  const d=new THREE.Mesh(
    new THREE.BoxGeometry(1.48,.64,.035),bodyMat
  );
  d.position.set(-.12,z,.75*(z>0?1:-1));
  d.rotation.x=0;
  d.rotation.z=-.015;
  d.scale.z=.001;
  // placa plana visual na lateral
  const panel=new THREE.Mesh(
    new THREE.BoxGeometry(1.48,.64,.025),bodyMat
  );
  panel.position.set(-.12,.77,z);
  panel.castShadow=true;
  car.add(panel);
}
addDoor(.93);
addDoor(-.93);

/* cabine: vidro + pilares */
const cabin=new THREE.Group();
car.add(cabin);

const windshield=new THREE.Mesh(
  new THREE.BoxGeometry(.62,.48,1.72),glassMat
);
windshield.position.set(-.67,1.27,0);
windshield.rotation.z=-.18;
cabin.add(windshield);

const rearGlass=new THREE.Mesh(
  new THREE.BoxGeometry(.75,.42,1.66),glassMat
);
rearGlass.position.set(.55,1.27,0);
rearGlass.rotation.z=.24;
cabin.add(rearGlass);

const roof=new THREE.Mesh(
  new THREE.BoxGeometry(1.42,.10,1.72),bodyMat
);
roof.position.set(-.02,1.50,0);
roof.rotation.z=.025;
cabin.add(roof);

/* colunas A/B/C */
for(const x of [-.78,.03,.68]){
  for(const z of [-.89,.89]){
    const p=new THREE.Mesh(
      new THREE.BoxGeometry(.10,.58,.075),bodyMat
    );
    p.position.set(x,1.29,z);
    p.rotation.z=x<0?-0.12:.12;
    cabin.add(p);
  }
}

/* teto central escuro, inspirado no desenho */
const roofGlass=new THREE.Mesh(
  new THREE.BoxGeometry(1.22,.025,1.22),
  darkMat
);
roofGlass.position.set(.03,1.555,0);
roofGlass.rotation.z=.025;
cabin.add(roofGlass);

/* ------------------------------
   rodas
--------------------------------*/
const wheels=[];
function makeWheel(x,z){
  const g=new THREE.Group();
  g.position.set(x,.53,z);

  const tire=new THREE.Mesh(
    new THREE.CylinderGeometry(.345,.345,.22,48),
    rubberMat
  );
  tire.rotation.x=Math.PI/2;
  tire.castShadow=true;
  g.add(tire);

  const rim=new THREE.Mesh(
    new THREE.CylinderGeometry(.205,.205,.235,32),
    rimMat
  );
  rim.rotation.x=Math.PI/2;
  g.add(rim);

  const hub=new THREE.Mesh(
    new THREE.CylinderGeometry(.075,.075,.245,20),
    darkMat
  );
  hub.rotation.x=Math.PI/2;
  g.add(hub);

  for(let i=0;i<5;i++){
    const spoke=new THREE.Mesh(
      new THREE.BoxGeometry(.025,.18,.03),rimMat
    );
    spoke.position.z=.125;
    spoke.rotation.z=i*Math.PI*2/5;
    g.add(spoke);
  }

  car.add(g); wheels.push(g);
}
makeWheel(frontAxle,.92);
makeWheel(frontAxle,-.92);
makeWheel(rearAxle,.92);
makeWheel(rearAxle,-.92);

/* arcos das caixas de roda */
function wheelArch(x,z){
  const torus=new THREE.Mesh(
    new THREE.TorusGeometry(.39,.045,12,40,Math.PI),
    darkMat
  );
  torus.position.set(x,.67,z);
  torus.rotation.set(0,Math.PI/2,0);
  car.add(torus);
}
wheelArch(frontAxle,.935); wheelArch(frontAxle,-.935);
wheelArch(rearAxle,.935); wheelArch(rearAxle,-.935);

/* para-choque dianteiro */
const frontBumper=new THREE.Mesh(
  new THREE.BoxGeometry(.16,.32,1.76),bodyMat
);
frontBumper.position.set(-2.18,.69,0);
frontBumper.castShadow=true;
car.add(frontBumper);

/* grade */
const grille=new THREE.Mesh(
  new THREE.BoxGeometry(.035,.24,.82),darkMat
);
grille.position.set(-2.265,.70,0);
car.add(grille);

/* traseira */
const rearBumper=new THREE.Mesh(
  new THREE.BoxGeometry(.14,.30,1.70),bodyMat
);
rearBumper.position.set(2.15,.67,0);
rearBumper.castShadow=true;
car.add(rearBumper);

/* faróis */
for(const z of [-.53,.53]){
  const lamp=new THREE.Mesh(
    new THREE.BoxGeometry(.035,.20,.38),lampMat
  );
  lamp.position.set(-2.27,.91,z);
  car.add(lamp);
}

/* lanternas */
for(const z of [-.56,.56]){
  const lamp=new THREE.Mesh(
    new THREE.BoxGeometry(.04,.19,.34),redLampMat
  );
  lamp.position.set(2.22,.90,z);
  car.add(lamp);
}

/* escapamentos */
for(const z of [-.42,.42]){
  const ex=new THREE.Mesh(
    new THREE.CylinderGeometry(.07,.07,.18,20),
    darkMat
  );
  ex.rotation.z=Math.PI/2;
  ex.position.set(2.25,.51,z);
  car.add(ex);
}

/* maçanetas */
for(const z of [-.985,.985]){
  const h=new THREE.Mesh(
    new THREE.BoxGeometry(.25,.035,.025),
    darkMat
  );
  h.position.set(-.12,.98,z);
  car.add(h);
}

/* ------------------------------
   linhas de referência no chão
--------------------------------*/
const grid=new THREE.GridHelper(12,24,0x242a33,0x171b21);
grid.position.y=.025;
scene.add(grid);

/* eixos discretos */
const axisGroup=new THREE.Group();
scene.add(axisGroup);

/* ------------------------------
   câmeras
--------------------------------*/
function setView(pos,target){
  camera.position.set(...pos);
  controls.target.set(...target);
  controls.update();
}
document.getElementById('view3d').onclick=()=>setView([6.4,3,6.6],[0,.8,0]);
document.getElementById('viewFront').onclick=()=>setView([-6.3,1.25,0],[0,.75,0]);
document.getElementById('viewSide').onclick=()=>setView([0,1.45,7.2],[0,.8,0]);
document.getElementById('viewTop').onclick=()=>setView([0,7.5,0.01],[0,0,0]);

let shellMode=false;
document.getElementById('shell').onclick=()=>{
  shellMode=!shellMode;
  bodyMat.color.set(shellMode?0x9aa1a8:0x7c8791);
  bodyMat.metalness=shellMode?.48:.78;
  bodyMat.roughness=shellMode?.48:.24;
  document.getElementById('shell').textContent=shellMode?'Acabamento':'Carroceria';
};

/* ------------------------------
   animação
--------------------------------*/
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
</html>
"} catch (erro) {
        res.status(500).json({ erro: "Error renderizing" });
    }
});

 app.get('/chave_publica_atual', autenticarToken, async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "email é obrigatório." });

    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;

    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.chave_publica) {
            // 🔧 mesmo tratamento de /buscar_chave_publica: pede reenvio se online
            const salaDono = io.sockets.adapter.rooms.get(emailLimpo);
            if (salaDono && salaDono.size > 0) {
                io.to(emailLimpo).emit('pedir_chave_publica');
                console.log(`🔑 Chave pública ausente para ${emailLimpo} — pedido de reenvio disparado`);
            }
            return res.status(404).json({ erro: "chave não encontrada." });
        }

        res.json({
            status: "ok",
            email: emailLimpo,
            chave_publica: usuario.chave_publica,
            atualizada_em: usuario.chave_atualizada_em || null
        });
    } catch (erro) {
        console.error("Erro em chave_publica_atual:", erro);
        res.status(500).json({ erro: "erro ao buscar chave." });
    }
});

app.post('/cadastro', async (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha || typeof email !== 'string' || typeof senha !== 'string') {
        return res.status(400).json({ erro: "Email e Senha são obrigatórios." });
    }
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    
    try {
        const usuarioExistente = await usuariosColl.findOne({ email: emailLimpo });
        if (usuarioExistente) return res.status(400).json({ erro: "Este email já está cadastrado." });
        
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        await codigosColl.updateOne(
            { email: emailLimpo },
            { $set: { 
                codigo: codigo, 
                senhaProvisoria: senha, 
                criadoEm: new Date() 
            }},
            { upsert: true }
        );
        
        if (resend) {
            const emailEnviado = await enviarEmailCodigo(emailLimpo, codigo);
            if (!emailEnviado) {
                return res.status(502).json({ erro: "Não foi possível enviar o email de verificação. Tente novamente." });
            }
            console.log(`📧 [REGISTER] Email enviado para: ${emailLimpo}`);
        } else {
            // Render não possui RESEND_API_KEY no ambiente atual. Mantém o fluxo
            // compatível com o servidor antigo: o código fica disponível no log.
            console.log(`📧 [REGISTER] RESEND_API_KEY ausente — código para ${emailLimpo}: ${codigo}`);
        }
        return res.status(200).json({ status: "ok", mensagem: "Código enviado." });
    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        return res.status(500).json({ erro: "Erro ao processar cadastro." });
    }
}); 

app.post('/confirmar-cadastro', async (req, res) => {
    const { email, codigo } = req.body;
    
    if (!email || !codigo || typeof email !== 'string' || typeof codigo !== 'string') {
        return res.status(400).json({ erro: "Dados incompletos para validação." });
    }
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    const codigoLimpo = codigo.trim();
    
    try {
        const registro = await codigosColl.findOne({ email: emailLimpo });
        
        if (!registro) {
            return res.status(400).json({ erro: "Solicitação não encontrada ou expirada." });
        }
        if (registro.codigo === codigoLimpo) {
            const senhaHash = await bcrypt.hash(registro.senhaProvisoria, 10);

            // 🔧 upsert em vez de insertOne: se o usuário já existir (ex: confirmação
            // enviada duas vezes por retry de rede ou duplo clique), não sobrescreve
            // os dados existentes (como chave_publica) — só cria se realmente não existir.
            await usuariosColl.updateOne(
                { email: emailLimpo },
                {
                    $setOnInsert: {
                        email: emailLimpo,
                        senha: senhaHash,
                        criadoEm: new Date().toISOString(),
                        foto: "",
                        nome_perfil: emailLimpo.split('@')[0],
                        chave_publica: ""
                    }
                },
                { upsert: true }
            );
            await codigosColl.deleteOne({ email: emailLimpo });
            
            const token = gerarToken(emailLimpo);
            return res.status(200).json({ status: "ok", mensagem: "Cadastro concluído.", token: token });
        } else {
            return res.status(401).json({ erro: "Código incorreto." });
        }
    } catch (erro) {
        console.error("Error: ", erro);
        return res.status(500).json({ erro: "Erro ao validar código." });
    }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha || typeof email !== 'string' || typeof senha !== 'string') {
        return res.status(400).json({ erro: "Email and password are required." });
    }
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    
    try {
        const dadosUsuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!dadosUsuario) return res.status(401).json({ erro: "invalid email or password." });
        
        const nomePadrao = emailLimpo.split('@')[0];
        await garantirNomePerfil(emailLimpo, nomePadrao);
        
        const senhaCorreta = await bcrypt.compare(senha, dadosUsuario.senha);
        if (senhaCorreta) {
            await garantirChaveUsuario(emailLimpo);
            const token = gerarToken(emailLimpo);
            return res.status(200).json({ status: "ok", usuario: emailLimpo, token: token });
        } else {
            return res.status(401).json({ erro: "invalid email or password." });
        }
    } catch (e) {
        return res.status(500).json({ erro: "Error in Authentic." });
    }
});

app.get('/buscar_chave_publica', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "email is required." });

    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;

    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.chave_publica) {
            // 🔧 chave ausente/vazia (ex: cadastro duplicado sobrescreveu com chave em
            // branco) — se o dono da chave estiver online, pede pro app dele reenviar.
            // Quem fez essa requisição vai precisar tentar de novo em alguns segundos.
            const salaDono = io.sockets.adapter.rooms.get(emailLimpo);
            if (salaDono && salaDono.size > 0) {
                io.to(emailLimpo).emit('pedir_chave_publica');
                console.log(`🔑 Chave pública ausente para ${emailLimpo} — pedido de reenvio disparado`);
            }
            return res.status(404).json({ erro: "Key not Exist." });
        }

        res.json({ status: "ok", chave_publica: usuario.chave_publica });
    } catch (erro) {
        console.error("Error in Key:", erro);
        res.status(500).json({ erro: "Error 157" });
    }
});
app.post('/salvar_chave_publica', autenticarToken, async (req, res) => {
    const { chave_publica } = req.body;
    const emailLimpo = req.emailAutenticado;

    if (!chave_publica) {
        return res.status(400).json({ erro: "chave_publica é obrigatória." });
    }

    try {
        const resultado = await usuariosColl.updateOne(
            { email: emailLimpo },
            { $set: { chave_publica: chave_publica } }
        );

        if (resultado.matchedCount === 0) {
            return res.status(404).json({ erro: "User not found." });
        }

        res.json({ status: "ok" });
    } catch (erro) {
        console.error("Error in Key:", erro);
        res.status(500).json({ erro: "Error 158" });
    }
});

app.post('/mensagens', autenticarToken, async (req, res) => {
    const emailFiltro = req.emailAutenticado;
    try {
        const mensagensDoUsuario = await mensagensColl.find({
            email_contato: emailFiltro
        }).sort({ timestamp: 1 }).toArray();
        res.json(mensagensDoUsuario);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar mensagens." });
    }
});

app.post('/enviar', autenticarToken, async (req, res) => {
    const { id, chat_id, texto, destinatario, timestamp, tem_midia } = req.body;
    const usuario = req.emailAutenticado;

    // === Proteção contra NoSQL injection: cada campo precisa ser do tipo
    // esperado antes de tocar o Mongo. Sem isso, um payload como
    // {"texto": {"$ne": null}} passaria reto pro insertOne() e pode alterar
    // o comportamento de queries/índices que reutilizam esses campos.
    if (destinatario !== undefined && typeof destinatario !== 'string') {
        return res.status(400).json({ erro: "invalid destinatario." });
    }
    if (id !== undefined && id !== null && typeof id !== 'string') {
        return res.status(400).json({ erro: "invalid id." });
    }
    if (chat_id !== undefined && chat_id !== null && typeof chat_id !== 'string') {
        return res.status(400).json({ erro: "invalid chat_id." });
    }
    if (timestamp !== undefined && timestamp !== null && typeof timestamp !== 'number') {
        return res.status(400).json({ erro: "invalid timestamp." });
    }
    if (tem_midia !== undefined && typeof tem_midia !== 'boolean') {
        return res.status(400).json({ erro: "invalid tem_midia." });
    }
    if (texto !== undefined && texto !== null && typeof texto !== 'string') {
        return res.status(400).json({ erro: "invalid texto." });
    }

    const ehMensagemDeMidia = tem_midia === true;

    if ((!texto && !ehMensagemDeMidia) || !destinatario) {
        return res.status(400).json({ erro: "required fields." });
    }

    // 🔧 CORRIGIDO: antes, tem_midia=true sempre forçava texto=null no banco,
    // descartando qualquer legenda que o app tivesse mandado junto com a
    // mídia. Agora aceita um texto real como legenda (com limite de 30k
    // caracteres e remoção de bytes nulos/caracteres de controle, mesmo
    // padrão de qualquer texto que entra no banco), mas continua permitindo
    // mídia sem legenda (texto vazio/ausente vira null como antes).
    let textoPuro = null;
    if (ehMensagemDeMidia) {
        if (typeof texto === 'string' && texto.length > 0) {
            if (texto.length > 30000) {
                return res.status(400).json({ erro: "texto too long (max 30000 characters)." });
            }
            // remove bytes nulos e caracteres de controle (exceto \n \r \t),
            // que não têm uso legítimo em texto de chat e podem confundir
            // clientes ou ferramentas de log/análise rio abaixo.
            textoPuro = texto.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
        }
    } else {
        if (texto.length > 30000) {
            return res.status(400).json({ erro: "texto too long (max 30000 characters)." });
        }
        textoPuro = texto.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    }

    const timestampFinal = timestamp || Date.now();
    const idValido = id || (timestampFinal + "_" + Math.floor(Math.random() * 9999));
    
    const destinatarioValidado = validarEmailPuro(destinatario);
    if (!destinatarioValidado) return res.status(400).json({ erro: 'Email destinatário inválido.' });
    const listaEmails = [usuario.trim().toLowerCase(), destinatarioValidado].sort();
    const chatIdValido = "Contato_" + listaEmails[0] + "_" + listaEmails[1];
    
    const novaMsg = { 
        id: idValido, 
        chat_id: chatIdValido,
        email_contato: destinatarioValidado,
        usuario: usuario.trim().toLowerCase(),
        texto: textoPuro,
        tem_midia: ehMensagemDeMidia,
        timestamp: timestampFinal,
        entregue: false
    };
    try {
        await mensagensColl.insertOne(novaMsg);
    } catch (erroInsert) {
        if (erroInsert && erroInsert.code === 11000) {
            // 🔧 CORRIGIDO: mesmo id já foi inserido por uma chamada concorrente
            // (upload duplicado disparado por race condition no app) — trata
            // como sucesso idempotente em vez de estourar erro 500 e o cliente
            // ficar reenviando pra sempre por causa de uma falha que na
            // prática não é uma falha (a mensagem já existe no servidor).
            console.warn(`⚠️ Envio duplicado da mensagem ${idValido} ignorado (id já existia)`);
            return res.json({ status: "ok" });
        }
        throw erroInsert;
    }
    historico.push(novaMsg);
if (historico.length > 500) historico.shift();
    io.emit('recebe_mensagem', novaMsg);
    res.json({ status: "ok" });
});

// 🔧 CORRIGIDO: rotas HTTP de mídia (/enviar_midia, /baixar_midia) e o setup
// do multer/pasta de mídias estavam DENTRO de io.on('connection', ...) — ou
// seja, eram re-registradas no Express a CADA conexão de socket.io (cada app
// abrindo, cada reconexão de rede, cada retry do BackgroundService). Isso
// empilhava handlers duplicados pra sempre no router do Express (vazamento de
// memória que só cresce) e deixava a existência da rota dependendo de já ter
// havido pelo menos UMA conexão de socket desde que o servidor subiu — logo
// após um restart/deploy, /enviar_midia podia responder 404 até o primeiro
// socket conectar. Agora registradas uma única vez, no boot do servidor.
// ========== UPLOAD / DOWNLOAD DE MÍDIA CIFRADA (correio temporário) ==========
const PASTA_MIDIAS = path.join(__dirname, 'midias');
if (!fs.existsSync(PASTA_MIDIAS)) fs.mkdirSync(PASTA_MIDIAS, { recursive: true });

const uploadMidia = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const destinatario = validarEmailPuro(req.body.destinatario);
            if (!destinatario) return cb(new Error('email_destinatario_invalido'));
            const pastaDestino = path.join(PASTA_MIDIAS, destinatario);
            if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino, { recursive: true });
            cb(null, pastaDestino);
        },
        filename: (req, file, cb) => {
            // 🔧 CORRIGIDO: nome sempre único por tentativa de upload (id +
            // timestamp + aleatório), nunca só "id + .zip.enc". Antes, dois
            // uploads com o mesmo id (duplicados por race condition no app)
            // escreviam no MESMO caminho em disco — o segundo sobrescrevia o
            // primeiro ANTES do handler sequer rodar, então mesmo detectando
            // a duplicata depois já era tarde: o arquivo do upload original
            // já tinha sido perdido. Agora cada tentativa tem seu próprio
            // arquivo em disco; o handler decide depois qual promover.
            const id = req.body.id || (Date.now() + "_" + Math.floor(Math.random() * 9999));
            const sufixoUnico = Date.now() + "_" + Math.floor(Math.random() * 1e9);
            cb(null, id + "." + sufixoUnico + ".tmp");
        }
    }),
    limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});

app.post('/enviar_midia', autenticarToken, uploadMidia.single('arquivo'), async (req, res) => {
    let arquivoFinalPath = null;
    try {
        const { id, chat_id, destinatario, chave_aes_cifrada, iv, timestamp, nome_arquivo_original } = req.body;
        const remetente = req.emailAutenticado;

        if (!req.file) {
            return res.status(400).json({ erro: "arquivo_ausente" });
        }
        if (!id || !destinatario || !chave_aes_cifrada || !iv) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ erro: "required fields." });
        }

        const destinatarioLimpo = validarEmailPuro(destinatario);
        if (!destinatarioLimpo) {
            fs.unlink(req.file.path, () => {});
            return res.status(400).json({ erro: 'Email destinatário inválido.' });
        }

        // nome final desejado (o que o download/limpeza esperam encontrar)
        arquivoFinalPath = path.join(path.dirname(req.file.path), id + ".zip.enc");

        // 🔧 CORRIGIDO: tenta RESERVAR o id primeiro via insertOne (o índice
        // único em midias_pendentes.id garante atomicidade — o Mongo só deixa
        // UMA dessas chamadas concorrentes vencer, mesmo com várias rodando
        // ao mesmo tempo). Só quem vence a reserva promove seu arquivo
        // temporário pro nome final; quem perde apaga o próprio temporário
        // sem tocar em nada do vencedor.
        try {
            await midiasPendentesColl.insertOne({
                id: id,
                chat_id: chat_id || null,
                remetente: remetente.trim().toLowerCase(),
                destinatario: destinatarioLimpo,
                chave_aes_cifrada: chave_aes_cifrada,
                iv: iv,
                nome_arquivo_original: nome_arquivo_original || null,
                tamanho: req.file.size,
                caminho_arquivo: arquivoFinalPath,
                timestamp: timestamp || Date.now(),
                criadoEm: new Date()
            });
        } catch (erroInsert) {
            if (erroInsert && erroInsert.code === 11000) {
                // perdeu a corrida — essa mídia já foi salva por outra tentativa
                // (upload duplicado do mesmo id). Descarta só o próprio
                // temporário, não mexe no arquivo/registro do vencedor.
                console.warn(`⚠️ Upload duplicado de mídia ${id} descartado (id já existia)`);
                fs.unlink(req.file.path, () => {});
                return res.json({ status: "ok" });
            }
            throw erroInsert;
        }

        // ganhou a reserva — promove o temporário pro nome final
        fs.renameSync(req.file.path, arquivoFinalPath);

        // avisa o destinatário, se estiver online, que tem mídia esperando
        const salaDestino = io.sockets.adapter.rooms.get(destinatarioLimpo);
        if (salaDestino && salaDestino.size > 0) {
            io.to(destinatarioLimpo).emit('midia_disponivel', { id: id });
        }

        res.json({ status: "ok" });
    } catch (erro) {
        console.error('Erro em /enviar_midia:', erro);
        // se já promovemos o arquivo pro nome final antes do erro, não apaga
        // o final (a mídia pode estar íntegra) — só limpa o temporário
        // original se ainda existir sob esse caminho.
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, () => {});
        }
        res.status(500).json({ erro: "Erro ao salvar mídia." });
    }
});

// app pede o pacote completo (arquivo + chave + IV) por HTTP, usando os mesmos
// headers customizados que /baixar_apk usa pra streaming binário
app.get('/baixar_midia/:id', autenticarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const emailAutenticado = req.emailAutenticado.trim().toLowerCase();

        const midia = await midiasPendentesColl.findOne({ id: id });
        if (!midia) {
            return res.status(404).json({ erro: "midia_nao_encontrada" });
        }
        // só o destinatário legítimo pode baixar — servidor nunca decifra o conteúdo
        if (midia.destinatario !== emailAutenticado) {
            return res.status(403).json({ erro: "nao_autorizado" });
        }
        if (!fs.existsSync(midia.caminho_arquivo)) {
            return res.status(404).json({ erro: "arquivo_nao_encontrado_em_disco" });
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${id}.zip.enc"`);
        res.setHeader('X-Chave-Aes-Cifrada', midia.chave_aes_cifrada);
        res.setHeader('X-Iv', midia.iv);
        res.setHeader('X-Nome-Arquivo-Original', encodeURIComponent(midia.nome_arquivo_original || ''));
        res.setHeader('Access-Control-Expose-Headers', 'X-Chave-Aes-Cifrada, X-Iv, X-Nome-Arquivo-Original');

        fs.createReadStream(midia.caminho_arquivo).pipe(res);
    } catch (erro) {
        console.error('Erro em /baixar_midia:', erro);
        res.status(500).json({ erro: "Erro ao buscar mídia." });
    }
});

io.on('connection', (socket) => {

socket.on('identificar', async (email) => {
    if (!email || typeof email !== 'string') return;

    const emailLimpo = validarEmailPuro(email);
    if (!emailLimpo) return socket.emit('erro_email', { erro: 'Email inválido.' });
    socket.join(emailLimpo);
    console.log(`✅ ${emailLimpo} identificado`);

    try {
        const pedidos = await buscarEConsumirPedidos(emailLimpo);
        if (pedidos.length > 0) {
            const todosIds = pedidos.flatMap(p => p.ids);
            socket.emit('pedidos_apagar_pendentes', { ids: todosIds });
        }

        const confirmacoesPendentes = await buscarEConsumirConfirmacoesPendentes(emailLimpo);
        confirmacoesPendentes.forEach(c => {
            socket.emit('mensagem_recebida', { id: c.id });
        });
        if (confirmacoesPendentes.length > 0) {
            console.log(`📬 ${confirmacoesPendentes.length} confirmação(ões) de entrega reentregue(s) para ${emailLimpo}`);
        }

        const mensagensPendentes = await mensagensColl.find({
            email_contato: emailLimpo,
            entregue: { $ne: true }
        }).sort({ timestamp: 1 }).toArray();

        if (mensagensPendentes.length > 0) {
            mensagensPendentes.forEach(msg => {
                socket.emit('recebe_mensagem', msg);
            });
            console.log(`📨 ${mensagensPendentes.length} mensagem(ns) pendente(s) reentregue(s) para ${emailLimpo}`);
        }

        // reforça o aviso de mídia pendente: se o usuário tinha mídia esperando e
        // ficou offline, precisa receber 'midia_disponivel' de novo ao reconectar
        const midiasPendentes = await midiasPendentesColl.find({
            destinatario: emailLimpo
        }).toArray();

        if (midiasPendentes.length > 0) {
            midiasPendentes.forEach(m => {
                socket.emit('midia_disponivel', { id: m.id });
            });
            console.log(`📦 ${midiasPendentes.length} mídia(s) pendente(s) reavisada(s) para ${emailLimpo}`);
        }
    } catch (erro) {
        console.error('Erro ao buscar pendências ao identificar:', erro);
    }
});

// app confirma "y" — recebeu e salvou o pacote com sucesso — servidor então
// deleta o arquivo do disco e o registro do Mongo (papel de "correio temporário")
socket.on('confirmar_midia_recebida', async (dados) => {
    try {
        const { id } = dados || {};
        if (!id || typeof id !== 'string') return;

        const midia = await midiasPendentesColl.findOne({ id: id });
        if (!midia) return;

        if (midia.caminho_arquivo && fs.existsSync(midia.caminho_arquivo)) {
            fs.unlink(midia.caminho_arquivo, (erro) => {
                if (erro) console.error(`Erro ao apagar arquivo de mídia ${id}:`, erro.message);
            });
        }

        await midiasPendentesColl.deleteOne({ id: id });
        console.log(`🗑️ Mídia ${id} confirmada e apagada (arquivo + registro)`);
    } catch (erro) {
        console.error('Erro em confirmar_midia_recebida:', erro);
    }
});


socket.on('enviar_pacote', (dados) => {
    const { email_destino, email_origem, pacote_cifrado } = dados || {};

    if (!email_destino || typeof email_destino !== 'string') {
        socket.emit('erro_pacote', { erro: 'email_destino_ausente' });
        return;
    }
    if (!email_origem || typeof email_origem !== 'string') {
        socket.emit('erro_pacote', { erro: 'email_origem_ausente' });
        return;
    }
    if (!pacote_cifrado) {
        socket.emit('erro_pacote', { erro: 'pacote_cifrado_ausente' });
        return;
    }

    const erroValidacao = validarPacoteCifrado(pacote_cifrado);
    if (erroValidacao) {
        socket.emit('erro_pacote', { erro: erroValidacao });
        return;
    }

    const emailDestinoLimpo = validarEmailPuro(email_destino);
    const emailOrigemLimpo = validarEmailPuro(email_origem);
    if (!emailDestinoLimpo || !emailOrigemLimpo) {
        socket.emit('erro_pacote', { erro: 'email_invalido' });
        return;
    }

    const salaDestino = io.sockets.adapter.rooms.get(emailDestinoLimpo);

    if (salaDestino && salaDestino.size > 0) {
        io.to(emailDestinoLimpo).emit('pacote_recebido', {
            email_origem: emailOrigemLimpo,
            pacote_cifrado: pacote_cifrado
        });
        socket.emit('status_pacote', {
            status: 'entregue',
            email_destino: emailDestinoLimpo
        });
    } else {
        socket.emit('status_pacote', {
            status: 'destinatario_offline',
            email_destino: emailDestinoLimpo
        });
    }
});

socket.on('trocar_chaves', async (dados) => {
    try {
        const { meu_email, email_contato } = dados || {};
        if (!meu_email || !email_contato || typeof meu_email !== 'string' || typeof email_contato !== 'string') {
            return;
        }

        const meuEmailLimpo = validarEmailPuro(meu_email);
        const emailContatoLimpo = validarEmailPuro(email_contato);
        if (!meuEmailLimpo || !emailContatoLimpo) return;

        const usuarioContato = await usuariosColl.findOne({ email: emailContatoLimpo });

        if (usuarioContato && usuarioContato.chave_publica) {
            socket.emit('chave_publica_recebida', {
                email: emailContatoLimpo,
                chave_publica: usuarioContato.chave_publica
            });
        }

        console.log(`🔑 ${meuEmailLimpo} solicitou chave pública de ${emailContatoLimpo}`);
    } catch (erro) {
        console.error("Error:", erro);
    }
});

socket.on('aviso_nova_chave', async (dados) => {
    try {
        const { email } = dados || {};
        if (!email || typeof email !== 'string') return;
        const emailLimpo = validarEmailPuro(email);
        if (!emailLimpo) return;

        io.emit('contato_trocou_chave', { email: emailLimpo });

        console.log(`🔔 ${emailLimpo} avisou troca de chave`);
    } catch (erro) {
        console.error('Erro em aviso_nova_chave:', erro);
    }
});

socket.on('solicitar_apagar_todos', async (dados) => {
    try {
        const { token, ids, email_destino } = dados || {};

        if (!token || typeof token !== 'string' || !ids || !Array.isArray(ids) || ids.length === 0 || !email_destino || typeof email_destino !== 'string') {
            socket.emit('erro_apagar_todos', { erro: 'dados_incompletos' });
            return;
        }

        const payload = validarToken(token);
        if (!payload) {
            socket.emit('erro_apagar_todos', { erro: 'token_invalido' });
            return;
        }
        const emailOrigem = payload.email;
        const emailDestinoLimpo = validarEmailPuro(email_destino);
        if (!emailDestinoLimpo) return res.status(400).json({ erro: 'Email destinatário inválido.' });

        await gravarPedidoApagar(emailDestinoLimpo, ids, emailOrigem);

        const salaDestino = io.sockets.adapter.rooms.get(emailDestinoLimpo);
        if (salaDestino && salaDestino.size > 0) {
            const pedidosAgora = await buscarEConsumirPedidos(emailDestinoLimpo);
            if (pedidosAgora.length > 0) {
                const todosIds = pedidosAgora.flatMap(p => p.ids);
                io.to(emailDestinoLimpo).emit('pedidos_apagar_pendentes', { ids: todosIds });
            }
        }

        socket.emit('status_apagar_todos', { status: 'ok', ids: ids });

    } catch (erro) {
        console.error('Erro em solicitar_apagar_todos:', erro);
        socket.emit('erro_apagar_todos', { erro: 'erro_interno' });
    }
});
socket.on('envia_mensagem', async (dados) => {
        const { token, id, chat_id, texto } = dados || {};

        if (!token || typeof token !== 'string') return;
        if (!texto || typeof texto !== 'string') return;
        if (chat_id && typeof chat_id !== 'string') return;

        const payload = validarToken(token);
        if (!payload) {
            socket.emit('erro_envio', { erro: 'token_invalido' });
            return;
        }

        const remetente = validarEmailPuro(payload.email);
        if (!remetente) {
            socket.emit('erro_envio', { erro: 'email_token_invalido' });
            return;
        }
        const destinatario = chat_id ? validarEmailPuro(chat_id) : "";
        if (chat_id && !destinatario) {
            socket.emit('erro_envio', { erro: 'email_destinatario_invalido' });
            return;
        }

        const timestamp = Date.now();
        const idValido = (id && typeof id === 'string')
            ? id
            : timestamp + "_" + Math.floor(Math.random() * 9999);

        let chatIdValido = "";
        if (chat_id && chat_id.startsWith("Contato_")) {
            chatIdValido = chat_id;
        } else if (chat_id) {
            const listaEmails = [remetente, destinatario].sort();
            chatIdValido = "Contato_" + listaEmails[0] + "_" + listaEmails[1];
        } else {
            chatIdValido = "Contato_Geral";
        }

        const novaMsg = {
            id: idValido,
            chat_id: chatIdValido,
            email_contato: destinatario,
            usuario: remetente,
            texto: texto,
            timestamp: timestamp,
            entregue: false
        };

        try {
            await mensagensColl.insertOne(novaMsg);
        } catch (erro) {
            console.error('Erro ao salvar mensagem (envia_mensagem):', erro);
            socket.emit('erro_envio', { erro: 'erro_ao_salvar' });
            return;
        }

        historico.push(novaMsg);
        if (historico.length > 500) historico.shift();

        io.to(destinatario).emit('recebe_mensagem', novaMsg);
    });
    socket.on('buscar_pedidos_apagar', async (dados) => {
    try {
        const { email } = dados || {};
        if (!email || typeof email !== 'string') {
            socket.emit('erro_apagar_todos', { erro: 'email_ausente' });
            return;
        }
        const pedidos = await buscarEConsumirPedidos(email);
        const todosIds = pedidos.flatMap(p => p.ids);
        socket.emit('pedidos_apagar_pendentes', { ids: todosIds });
    } catch (erro) {
        console.error('Erro em buscar_pedidos_apagar:', erro);
        socket.emit('erro_apagar_todos', { erro: 'erro_interno' });
    }
});
});

// ========== UPLOAD / DEPLOY DE APK ==========
const PASTA_APKS = path.join(__dirname, 'apks');
if (!fs.existsSync(PASTA_APKS)) fs.mkdirSync(PASTA_APKS, { recursive: true });
const CAMINHO_APK_ATUAL = path.join(PASTA_APKS, 'latest.apk');
const CAMINHO_APK_META = path.join(PASTA_APKS, 'meta.json');

const uploadApk = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 300 * 1024 * 1024 }, // 300MB
    fileFilter: (req, file, cb) => {
        const nomeOk = file.originalname.toLowerCase().endsWith('.apk');
        const tipoOk = file.mimetype === 'application/vnd.android.package-archive'
            || file.mimetype === 'application/octet-stream';
        if (nomeOk && tipoOk) return cb(null, true);
        cb(new Error('arquivo_nao_e_apk'));
    }
});

function lerMetaApk() {
    try {
        if (fs.existsSync(CAMINHO_APK_META)) {
            return JSON.parse(fs.readFileSync(CAMINHO_APK_META, 'utf8'));
        }
    } catch (erro) {
        console.error('Erro ao ler meta do apk:', erro.message);
    }
    return null;
}

// -------- versão Web do aplicativo --------
// Coloque o arquivo cn.twoendtwo.html na mesma pasta deste server.js.
app.get('/', (req, res) => {
    const caminhoWeb = path.join(__dirname, 'cn.twoendtwo.html');
    if (!fs.existsSync(caminhoWeb)) {
        return res.status(404).send('Arquivo cn.twoendtwo.html não encontrado.');
    }
    res.sendFile(caminhoWeb);
});

// -------- login do painel administrativo --------
app.get('/painel_login', (req, res) => {
    const token = req.cookies ? req.cookies[NOME_COOKIE_PAINEL] : null;
    if (validarTokenPainel(token)) {
        return res.redirect('/painel');
    }
    res.send(paginaLogin());
});

app.post('/painel_login', (req, res) => {
    const { usuario, senha } = req.body || {};

    if (!senha || typeof senha !== 'string' || !SENHA_PAINEL) {
        return res.send(paginaLogin('Login indisponível ou senha incorreta.'));
    }

    const bufA = Buffer.from(senha);
    const bufB = Buffer.from(SENHA_PAINEL);
    const senhaOk = bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);

    if (!senhaOk) {
        return res.send(paginaLogin('Usuário ou senha incorreta.'));
    }

    const tokenPainel = gerarTokenPainel();
    res.cookie(NOME_COOKIE_PAINEL, tokenPainel, {
        httpOnly: true,
        sameSite: 'strict',
        maxAge: 12 * 60 * 60 * 1000
    });
    res.redirect('/painel');
});

app.post('/painel_logout', (req, res) => {
    res.clearCookie(NOME_COOKIE_PAINEL);
    res.redirect('/');
});

// -------- painel de upload (protegido) --------
app.get('/painel', autenticarPainel, (req, res) => {
    const meta = lerMetaApk();
    res.send(paginaPainel(meta));
});

app.post('/painel/upload_apk', autenticarPainel, (req, res) => {
    uploadApk.single('apk')(req, res, (erro) => {
        if (erro) {
            const msg = erro.message === 'arquivo_nao_e_apk'
                ? 'O arquivo enviado não é um .apk válido.'
                : 'Erro ao processar o upload: ' + erro.message;
            return res.send(paginaPainel(lerMetaApk(), msg));
        }
        if (!req.file) {
            return res.send(paginaPainel(lerMetaApk(), 'Nenhum arquivo recebido.'));
        }

        const versionCodeStr = (req.body && req.body.version_code) ? req.body.version_code.trim() : '';
        const versionCode = parseInt(versionCodeStr, 10);
        if (!versionCodeStr || !Number.isInteger(versionCode) || versionCode <= 0) {
            return res.send(paginaPainel(lerMetaApk(), 'Informe um versionCode válido (número inteiro positivo).'));
        }

        try {
            fs.writeFileSync(CAMINHO_APK_ATUAL, req.file.buffer);
            const meta = {
                nomeOriginal: req.file.originalname,
                tamanhoBytes: req.file.size,
                versionCode: versionCode,
                enviadoEm: new Date().toISOString()
            };
            fs.writeFileSync(CAMINHO_APK_META, JSON.stringify(meta, null, 2));
            console.log(`📦 Novo APK recebido: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(1)} MB) — versionCode ${versionCode}`);
            return res.send(paginaPainel(meta, null, 'APK enviado e salvo com sucesso.'));
        } catch (erroSalvar) {
            console.error('Erro ao salvar apk:', erroSalvar);
            return res.send(paginaPainel(lerMetaApk(), 'Erro ao salvar o arquivo no servidor.'));
        }
    });
});

function paginaLogin(mensagemErro) {
    return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Painel — Login</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: #0a0e17;
                    color: #fff;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .box {
                    width: 100%;
                    max-width: 380px;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    padding: 36px 32px;
                }
                h1 {
                    font-size: 20px;
                    color: #00d4ff;
                    margin-bottom: 6px;
                }
                p.sub {
                    color: #8899aa;
                    font-size: 13px;
                    margin-bottom: 28px;
                }
                label {
                    display: block;
                    font-size: 12px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #8899aa;
                    margin-bottom: 6px;
                }
                input {
                    width: 100%;
                    background: rgba(0,0,0,0.3);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    padding: 12px 14px;
                    color: #fff;
                    font-size: 15px;
                    margin-bottom: 18px;
                    outline: none;
                }
                input:focus { border-color: #00d4ff; }
                button {
                    width: 100%;
                    background: #00d4ff;
                    color: #000;
                    border: none;
                    border-radius: 8px;
                    padding: 13px;
                    font-size: 15px;
                    font-weight: bold;
                    cursor: pointer;
                }
                button:hover { opacity: 0.9; }
                .erro {
                    background: rgba(255,23,68,0.15);
                    border: 1px solid rgba(255,23,68,0.4);
                    color: #ff8a9b;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 18px;
                }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🔒 Painel administrativo</h1>
                <p class="sub">Acesso restrito</p>
                ${mensagemErro ? `<div class="erro">${mensagemErro}</div>` : ''}
                <form method="POST" action="/painel_login">
                    <label>Usuário</label>
                    <input type="text" name="usuario" autocomplete="username" placeholder="admin">
                    <label>Senha</label>
                    <input type="password" name="senha" autocomplete="current-password" required>
                    <button type="submit">Entrar</button>
                </form>
            </div>
        </body>
        </html>
    `;
}

function paginaPainel(meta, mensagemErro, mensagemSucesso) {
    const infoApk = meta ? `
        <div class="apk-info">
            <div><strong>Arquivo:</strong> ${meta.nomeOriginal}</div>
            <div><strong>Tamanho:</strong> ${(meta.tamanhoBytes / 1024 / 1024).toFixed(1)} MB</div>
            <div><strong>versionCode:</strong> ${meta.versionCode ?? '—'}</div>
            <div><strong>Enviado em:</strong> ${new Date(meta.enviadoEm).toLocaleString('pt-BR')}</div>
        </div>
    ` : `<div class="apk-info vazio">Nenhum APK enviado ainda.</div>`;

    return `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Painel — Deploy APK</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    background: #0a0e17;
                    color: #fff;
                    min-height: 100vh;
                    padding: 30px 20px;
                }
                .container { max-width: 560px; margin: 0 auto; }
                header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 28px;
                }
                h1 { font-size: 22px; color: #00d4ff; }
                .logout-form button {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.2);
                    color: #8899aa;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 13px;
                }
                .logout-form button:hover { color: #fff; border-color: #fff; }
                .card {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    padding: 28px;
                    margin-bottom: 20px;
                }
                .card h2 {
                    font-size: 15px;
                    color: #00d4ff;
                    margin-bottom: 16px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .apk-info div { margin-bottom: 6px; font-size: 14px; color: #cdd; }
                .apk-info.vazio { color: #8899aa; font-style: italic; }
                .drop {
                    border: 2px dashed rgba(255,255,255,0.15);
                    border-radius: 12px;
                    padding: 30px;
                    text-align: center;
                    margin: 20px 0;
                }
                input[type="file"] {
                    color: #cdd;
                    width: 100%;
                }
                button.enviar {
                    width: 100%;
                    background: #00d4ff;
                    color: #000;
                    border: none;
                    border-radius: 8px;
                    padding: 13px;
                    font-size: 15px;
                    font-weight: bold;
                    cursor: pointer;
                    margin-top: 16px;
                }
                button.enviar:hover { opacity: 0.9; }
                .msg-erro {
                    background: rgba(255,23,68,0.15);
                    border: 1px solid rgba(255,23,68,0.4);
                    color: #ff8a9b;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 18px;
                }
                .msg-sucesso {
                    background: rgba(0,200,83,0.15);
                    border: 1px solid rgba(0,200,83,0.4);
                    color: #7fffb0;
                    padding: 10px 14px;
                    border-radius: 8px;
                    font-size: 13px;
                    margin-bottom: 18px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>📦 Deploy do APK</h1>
                    <form class="logout-form" method="POST" action="/painel_logout">
                        <button type="submit">Sair</button>
                    </form>
                </header>

                ${mensagemErro ? `<div class="msg-erro">${mensagemErro}</div>` : ''}
                ${mensagemSucesso ? `<div class="msg-sucesso">${mensagemSucesso}</div>` : ''}

                <div class="card">
                    <h2>Versão atual salva</h2>
                    ${infoApk}
                </div>

                <div class="card">
                    <h2>Enviar novo APK</h2>
                    <form method="POST" action="/painel/upload_apk" enctype="multipart/form-data">
                        <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#8899aa;margin-bottom:6px;">versionCode</label>
                        <input type="number" name="version_code" min="1" step="1" placeholder="ex: 14" required
                            style="width:100%;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:12px 14px;color:#fff;font-size:15px;margin-bottom:18px;outline:none;">
                        <div class="drop">
                            <input type="file" name="apk" accept=".apk" required>
                        </div>
                        <button class="enviar" type="submit">Enviar e substituir</button>
                    </form>
                </div>
            </div>
        </body>
        </html>
    `;
}

app.get('/metrics', (req, res) => {
    const os = require('os');

    const cpuAgora = process.cpuUsage(cpuAnterior);
    const tempoAgora = process.hrtime(tempoAnterior);

    const tempoDecorridoMs = tempoAgora[0] * 1000 + tempoAgora[1] / 1e6;
    const cpuUsadoMs = (cpuAgora.user + cpuAgora.system) / 1000;
    const cpuPercentual = (cpuUsadoMs / tempoDecorridoMs) * 100;

    cpuAnterior = process.cpuUsage();
    tempoAnterior = process.hrtime();

    const totalMem = os.totalmem() / (1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024);
    const usedMem = ((totalMem - freeMem) / totalMem * 100);

    const latency = Math.floor(Math.random() * 50) + 20;

    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    res.json({
        cpu: cpuPercentual.toFixed(1),
        ram: usedMem.toFixed(1),
        latency: latency,
        uptime: uptimeStr
    });
});
let cpuAnterior = process.cpuUsage();
let tempoAnterior = process.hrtime();

// ========== rota que o app consulta periodicamente pra saber se tem versão nova ==========
app.get('/verificar_atualizacao', autenticarToken, (req, res) => {
    const versaoAtualStr = req.query.versao_atual;
    const versaoAtual = parseInt(versaoAtualStr, 10);

    if (!versaoAtualStr || !Number.isInteger(versaoAtual) || versaoAtual <= 0) {
        return res.status(400).json({ erro: 'versao_atual (versionCode) é obrigatória e deve ser um inteiro positivo.' });
    }

    const meta = lerMetaApk();
    if (!meta || !meta.versionCode) {
        return res.json({ atualizacao_disponivel: false });
    }

    const temAtualizacao = meta.versionCode > versaoAtual;
    res.json({
        atualizacao_disponivel: temAtualizacao,
        versao_servidor: meta.versionCode,
        versao_enviada_pelo_app: versaoAtual
    });
});

// ========== rota que o app dos usuários vai usar pra baixar o apk (exige login normal) ==========
app.get('/baixar_apk', autenticarToken, (req, res) => {
    if (!fs.existsSync(CAMINHO_APK_ATUAL)) {
        return res.status(404).json({ erro: 'Nenhum APK disponível.' });
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="app-atualizado.apk"');
    fs.createReadStream(CAMINHO_APK_ATUAL).pipe(res);
});

app.post('/atualizar_nome', autenticarToken, async (req, res) => {
    const { nome } = req.body;
    const emailLimpo = req.emailAutenticado;
    if (!nome) return res.status(400).json({ erro: "not allowed" });

    const nomeLimpo = nome.trim();

    if (nomeLimpo.length < 1 || nomeLimpo.length > 50) {
        return res.status(400).json({ erro: "character limit exceeded" });
    }

    try {
        const resultado = await usuariosColl.updateOne(
            { email: emailLimpo },
            { $set: { nome_perfil: nomeLimpo, atualizadoEm: new Date() } }
        );

        if (resultado.matchedCount === 0) return res.status(404).json({ erro: "user does not exist" });

        io.emit('nome_atualizado', { email: emailLimpo, nome: nomeLimpo });
        res.json({ status: "ok", mensagem: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "error while saving" });
    }
});

app.get('/get_nome', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "email is required." });
    
    const emailLimpo = exigirEmailPuro(email, res);
    if (!emailLimpo) return;
    
    try {
        let usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario) return res.status(404).json({ erro: "user does not exist." });
        
        if (!usuario.nome_perfil) {
            const nomePadrao = emailLimpo.split('@')[0];
            await usuariosColl.updateOne(
                { email: emailLimpo },
                { $set: { nome_perfil: nomePadrao } }
            );
            usuario.nome_perfil = nomePadrao;
        }
        
        res.json({ status: "ok", nome: usuario.nome_perfil, email: emailLimpo });
    } catch (erro) {
        res.status(500).json({ erro: " error retrieving name." });
    }
});

app.post('/get_nomes_lote', async (req, res) => {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ erro: " email list is mandatory." });
    }
    
    try {
        const emailsValidados = emails.map(validarEmailPuro);
        if (emailsValidados.some(e => !e)) {
            return res.status(400).json({ erro: 'A lista contém email inválido.' });
        }

        const usuarios = await usuariosColl.find(
            { email: { $in: emailsValidados } },
            { projection: { email: 1, nome_perfil: 1 } }
        ).toArray();
        
        const resultado = {};
        usuarios.forEach(user => {
            resultado[user.email] = user.nome_perfil || user.email.split('@')[0];
        });
        
        emails.forEach(email => {
            const emailLimpo = validarEmailPuro(email);
            if (!resultado[emailLimpo]) resultado[emailLimpo] = emailLimpo.split('@')[0];
        });
        
        res.json(resultado);
    } catch (erro) {
        res.status(500).json({ erro: "Error214" });
    }
});

async function varrer() {
    try {
        const mensagensEntregues = await mensagensColl.find(
            { entregue: true },
            { projection: { id: 1 } }
        ).toArray();

        const ids = mensagensEntregues.map(msg => msg.id);

        if (ids.length > 0) {
            console.log(`🔎 Varredura encontrou ${ids.length} mensagem(ns) entregue(s)`);
            apagarComEspera(ids);
        } else {
            setTimeout(varrer, 30000);
        }
    } catch (erro) {
        console.error('Erro na varredura de mensagens:', erro);
        setTimeout(varrer, 30000);
    }
}

function apagarComEspera(ids) {
    setTimeout(async () => {
        try {
            const resultado = await mensagensColl.deleteMany({ id: { $in: ids } });
            console.log(`🗑️ ${resultado.deletedCount} mensagem(ns) apagada(s)`);
        } catch (erro) {
            console.error('Erro ao apagar mensagens:', erro);
        }

        varrer();
    }, 30000);
}

setTimeout(() => { varrer(); }, 5000);

app.use((req, res, next) => {
    if (req.path === '/ws') {
        if (!proxyErlang) {
            return res.status(503).json({ erro: 'Serviço Erlang não configurado neste servidor.' });
        }
        req.on('aborted', () => {
            console.log('⚠️ Cliente abortou a requisição, ignorando resto do proxy');
        });
        return proxyErlang(req, res, next);
    }

    res.status(404).json({ erro: 'Rota não encontrada' });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`꧁ CXCODE (Render) ✔️ rodando na porta ${PORT}`);
    console.log(`🌐 Web: /cn.twoendtwo.html`);
    if (!ERLANG_TARGET) console.log('ℹ️ Erlang não configurado (ERLANG_URL ausente).');
});

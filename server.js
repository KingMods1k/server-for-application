const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { MongoClient, ServerApiVersion } = require('mongodb');
app.use(express.json({ limit: '50mb' }));
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
let db, usuariosColl, contatosColl, codigosColl, mensagensColl, pedidosApagarColl;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("meu_aplicativo_chat"); 
        usuariosColl = db.collection("usuarios"); 
        contatosColl = db.collection("contatos"); 
codigosColl = db.collection("codigos_verificacao");
mensagensColl = db.collection("mensagens");
pedidosApagarColl = db.collection("pedidos_apagar");
        console.log("🟢 Connected");
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
        expira: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 dias
    });
    const payloadBase64 = Buffer.from(payload).toString('base64url');
    
    const assinatura = crypto
        .createHmac('sha256', CHAVE_SECRETA)
        .update(payloadBase64)
        .digest('base64url');
    
    return `${payloadBase64}.${assinatura}`;
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
let historico = [];
let codigosVerificacao = {};

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

app.post('/confirmar_recebimento', autenticarToken, async (req, res) => {
    try {
        const { ids } = req.body;
        const emailFiltro = req.emailAutenticado; // vem do token, não do body

        if (!ids || !Array.isArray(ids)) {
            return res.status(400).json({ erro: "Dados inválidos." });
        }

        for (const id of ids) {
            const msg = await mensagensColl.findOne({ 
                id: id, 
                email_contato: emailFiltro 
            });
            
            if (msg && !msg.entregue) {
                await mensagensColl.updateOne(
                    { id: id },
                    { $set: { entregue: true } }
                );
                
                io.to(msg.usuario).emit('mensagem_recebida', { id: id });
                
                console.log(`✅ Mensagem ${id} confirmada por ${emailFiltro}`);
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

    const emailLimpo = email.trim().toLowerCase();

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

app.post('/upload_foto', async (req, res) => {
    const { email, foto } = req.body;
    if (!email || !foto) return res.status(400).json({ erro: "Dados incompletos." });
    
    const emailLimpo = email.trim().toLowerCase();
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
    
    const emailLimpo = email.trim().toLowerCase();
    
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
        const emailLimpo = req.emailAutenticado; // Pega do token

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ erro: "IDs são obrigatórios." });
        }

        // Apaga do MongoDB (só mensagens enviadas por este usuário)
        const resultado = await mensagensColl.deleteMany({
            id: { $in: ids },
            usuario: emailLimpo
        });

        // 🔥 APAGA DA MEMÓRIA (historico)
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


app.post('/salvar_contatos', async (req, res) => {
    const { email, contatos } = req.body;
    if (!email || !contatos) return res.status(400).json({ erro: "Dados incompletos." });
    
    const emailLimpo = email.trim().toLowerCase();
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

app.get('/buscar_contatos', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório." });
    
    const emailLimpo = email.trim().toLowerCase();
    
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
    
    const emailLimpo = email.trim().toLowerCase();
    
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
    
    const emailLimpo = email.trim().toLowerCase();
    
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

app.post('/deletar_foto', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório." });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        await usuariosColl.updateOne({ email: emailLimpo }, { $unset: { foto: "" } });
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Error deleting photo." });
    }
});

 app.get('/chave_publica_atual', autenticarToken, async (req, res) => {
    // pega do query, não do token, pois é a chave de OUTRO usuário que quero buscar
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "email é obrigatório." });

    const emailLimpo = email.trim().toLowerCase();

    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.chave_publica) {
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
    if (!email || !senha) return res.status(400).json({ erro: "Email e Senha são obrigatórios." });
    
    const emailLimpo = email.trim().toLowerCase();
    
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
        
        console.log(`📧 [REGISTER] Email: ${emailLimpo} | Code: ${codigo}`);
        return res.status(200).json({ status: "ok", mensagem: "Código enviado." });
    } catch (erro) {
        console.error("Erro no cadastro:", erro);
        return res.status(500).json({ erro: "Erro ao processar cadastro." });
    }
});

app.post('/confirmar-cadastro', async (req, res) => {
    const { email, codigo } = req.body;
    if (!email || !codigo) return res.status(400).json({ erro: "Dados incompletos para validação." });
    
    const emailLimpo = email.trim().toLowerCase();
    const codigoLimpo = codigo.trim();
    
    try {
        const registro = await codigosColl.findOne({ email: emailLimpo });
        
        if (!registro) {
            return res.status(400).json({ erro: "Solicitação não encontrada ou expirada." });
        }
        if (registro.codigo === codigoLimpo) {
    const senhaHash = await bcrypt.hash(registro.senhaProvisoria, 10);
    const dadosSalvar = {
        email: emailLimpo,
        senha: senhaHash,
        criadoEm: new Date().toISOString(),
        foto: "",
        nome_perfil: emailLimpo.split('@')[0],
        chave_publica: ""
    };
    
    await usuariosColl.insertOne(dadosSalvar);
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
    if (!email || !senha) return res.status(400).json({ erro: "Email and password are required." });
    
    const emailLimpo = email.trim().toLowerCase();
    
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

    const emailLimpo = email.trim().toLowerCase();

    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.chave_publica) {
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
    const emailLimpo = req.emailAutenticado; // vem do token, não do body

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
    const emailFiltro = req.emailAutenticado; // vem do token, não do body
    try {
        const mensagensDoUsuario = await mensagensColl.find({
            $or: [
                { email_contato: emailFiltro },
                { usuario: emailFiltro }
            ]
        }).sort({ timestamp: 1 }).toArray();
        res.json(mensagensDoUsuario);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar mensagens." });
    }
});

app.post('/enviar', autenticarToken, async (req, res) => {
    const { id, chat_id, texto, destinatario, timestamp } = req.body;
    const usuario = req.emailAutenticado; // ← descobre quem é aqui, pelo token validado
    
    if (!texto || !destinatario) {
        return res.status(400).json({ erro: "required fields." });
    }
    const textoPuro = texto;
    const timestampFinal = timestamp || Date.now();
    const idValido = id || (timestampFinal + "_" + Math.floor(Math.random() * 9999));
    
    const listaEmails = [usuario.trim().toLowerCase(), destinatario.trim().toLowerCase()].sort();
    const chatIdValido = "Contato_" + listaEmails[0] + "_" + listaEmails[1];
    
    const novaMsg = { 
        id: idValido, 
        chat_id: chatIdValido,
        email_contato: destinatario.trim().toLowerCase(),
        usuario: usuario.trim().toLowerCase(),
        texto: textoPuro,
        timestamp: timestampFinal,
        entregue: false
    };
    await mensagensColl.insertOne(novaMsg);
    historico.push(novaMsg);
    io.emit('recebe_mensagem', novaMsg);
    res.json({ status: "ok" });
});

app.post('/mensagens/deletar', async (req, res) => {
    const { meuEmail, contatoEmail } = req.query;
    if (!meuEmail || !contatoEmail) {
        return res.status(400).json({ erro: "Parâmetros obrigatórios!" });
    }
    const email1 = meuEmail.trim().toLowerCase();
    const email2 = contatoEmail.trim().toLowerCase();
    try {
        const resultado = await mensagensColl.deleteMany({
            $or: [
                { email_contato: email2, usuario: email1 },
                { email_contato: email1, usuario: email2 }
            ]
        });
        historico = historico.filter(msg => {
            return !((msg.email_contato === email2 && msg.usuario === email1) ||
                     (msg.email_contato === email1 && msg.usuario === email2));
        });
        res.json({ status: "ok", deletadas: resultado.deletedCount });
    } catch (erro) {
        console.error("Error:", erro);
        res.status(500).json({ erro: "Erro ao deletar mensagem." });
    }
});
io.on('connection', (socket) => {
    

socket.on('identificar', async (email) => {
        socket.join(email);
        console.log(`✅ ${email} identificado`);

        try {
            const emailLimpo = email.trim().toLowerCase();
            const pedidos = await buscarEConsumirPedidos(emailLimpo);
            if (pedidos.length > 0) {
                const todosIds = pedidos.flatMap(p => p.ids);
                socket.emit('pedidos_apagar_pendentes', { ids: todosIds });
            }
        } catch (erro) {
            console.error('Erro ao buscar pendências ao identificar:', erro);
        }
    });

socket.on('enviar_pacote', (dados) => {
    const { email_destino, email_origem, pacote_cifrado } = dados || {};

    if (!email_destino) {
        socket.emit('erro_pacote', { erro: 'email_destino_ausente' });
        return;
    }
    if (!email_origem) {
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

    const emailDestinoLimpo = email_destino.trim().toLowerCase();
    const emailOrigemLimpo = email_origem.trim().toLowerCase();

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
        const { meu_email, email_contato } = dados;
        if (!meu_email || !email_contato) return;

        const meuEmailLimpo = meu_email.trim().toLowerCase();
        const emailContatoLimpo = email_contato.trim().toLowerCase();

        const usuarioContato = await usuariosColl.findOne({ email: emailContatoLimpo });

        if (usuarioContato && usuarioContato.chave_publica) {
            // Devolve a chave pública do contato pra quem pediu
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
        if (!email) return;
        const emailLimpo = email.trim().toLowerCase();

        io.emit('contato_trocou_chave', { email: emailLimpo });

        console.log(`🔔 ${emailLimpo} avisou troca de chave`);
    } catch (erro) {
        console.error('Erro em aviso_nova_chave:', erro);
    }
});

    socket.on('envia_mensagem', (dados) => {
        let { id, chat_id, usuario, texto } = dados;
        const timestamp = Date.now();
        if (!id) id = timestamp + "_" + Math.floor(Math.random() * 9999);
        
        let remetente = usuario ? usuario.trim().toLowerCase() : "admin_web";
        let destinatario = chat_id ? chat_id.trim().toLowerCase() : "";
        
        let textoFinal = texto;
        
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
            id: id, 
            chat_id: chatIdValido, 
            email_contato: destinatario,
            usuario: remetente, 
            texto: textoFinal, 
            timestamp: timestamp,
            entregue: false
        };
        
        mensagensColl.insertOne(novaMsg);
        historico.push(novaMsg);
        io.to(destinatario).emit('recebe_mensagem', novaMsg);
        
    });

// A solicita apagar "para todos" — exige token + senha (reautenticação)
    socket.on('solicitar_apagar_todos', async (dados) => {
        try {
            const { token, senha, ids, email_destino } = dados || {};

            if (!token || !senha || !ids || !Array.isArray(ids) || ids.length === 0 || !email_destino) {
                socket.emit('erro_apagar_todos', { erro: 'dados_incompletos' });
                return;
            }

            const payload = validarToken(token);
            if (!payload) {
                socket.emit('erro_apagar_todos', { erro: 'token_invalido' });
                return;
            }
            const emailOrigem = payload.email;

            const usuario = await usuariosColl.findOne({ email: emailOrigem });
            if (!usuario) {
                socket.emit('erro_apagar_todos', { erro: 'usuario_nao_encontrado' });
                return;
            }
            const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
            if (!senhaCorreta) {
                socket.emit('erro_apagar_todos', { erro: 'senha_incorreta' });
                return;
            }

            const emailDestinoLimpo = email_destino.trim().toLowerCase();
            const mensagensEncontradas = await mensagensColl.find({
                id: { $in: ids },
                usuario: emailOrigem
            }).toArray();

            if (mensagensEncontradas.length !== ids.length) {
                socket.emit('erro_apagar_todos', { erro: 'mensagens_nao_pertencem_ao_usuario' });
                return;
            }

            await mensagensColl.deleteMany({ id: { $in: ids }, usuario: emailOrigem });
            historico = historico.filter(msg => !ids.includes(msg.id));

            await gravarPedidoApagar(emailDestinoLimpo, ids, emailOrigem);

            const salaDestino = io.sockets.adapter.rooms.get(emailDestinoLimpo);
            if (salaDestino && salaDestino.size > 0) {
                const pedidosAgora = await buscarEConsumirPedidos(emailDestinoLimpo);
                if (pedidosAgora.length > 0) {
                    const todosIds = pedidosAgora.flatMap(p => p.ids);
                    io.to(emailDestinoLimpo).emit('pedidos_apagar_pendentes', { ids: todosIds });
                }
            }

            socket.emit('status_apagar_todos', { status: 'ok', apagadas: mensagensEncontradas.length });

        } catch (erro) {
            console.error('Erro em solicitar_apagar_todos:', erro);
            socket.emit('erro_apagar_todos', { erro: 'erro_interno' });
        }
    });

    // B pode pedir manualmente também (reconexão, polling, etc.)
    socket.on('buscar_pedidos_apagar', async (dados) => {
        try {
            const { email } = dados || {};
            if (!email) {
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

// ========== PAINEL DE MONITORAMENTO ==========
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="utf-8">
                <title>Server Protection - Me App</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { 
                        font-family: 'Segoe UI', Arial, sans-serif; 
                        background: #0a0e17; 
                        color: #fff;
                        min-height: 100vh;
                        padding: 20px;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                    }
                    h1 {
                        font-size: 28px;
                        margin-bottom: 30px;
                        color: #00d4ff;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                    }
                    .status-badge {
                        font-size: 14px;
                        background: #00c853;
                        padding: 5px 15px;
                        border-radius: 20px;
                        font-weight: normal;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .status-badge .dot {
                        width: 8px;
                        height: 8px;
                        background: #fff;
                        border-radius: 50%;
                        animation: pulse 1.5s infinite;
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.3; }
                    }
                    
                    .grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .card {
                        background: rgba(255,255,255,0.05);
                        backdrop-filter: blur(10px);
                        border: 1px solid rgba(255,255,255,0.1);
                        border-radius: 15px;
                        padding: 25px;
                        transition: all 0.3s;
                    }
                    .card:hover {
                        transform: translateY(-5px);
                        border-color: rgba(0, 212, 255, 0.3);
                        box-shadow: 0 10px 30px rgba(0, 212, 255, 0.1);
                    }
                    .card-title {
                        font-size: 12px;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                        color: #8899aa;
                        margin-bottom: 10px;
                    }
                    .card-value {
                        font-size: 32px;
                        font-weight: bold;
                        color: #00d4ff;
                    }
                    .card-value.green { color: #00c853; }
                    .card-value.yellow { color: #ffd600; }
                    .card-value.red { color: #ff1744; }
                    
                    .section {
                        background: rgba(255,255,255,0.03);
                        border-radius: 15px;
                        padding: 25px;
                        margin-bottom: 20px;
                        border: 1px solid rgba(255,255,255,0.05);
                    }
                    .section-title {
                        font-size: 18px;
                        margin-bottom: 15px;
                        color: #00d4ff;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }
                    .route-item {
                        padding: 8px 12px;
                        margin: 5px 0;
                        background: rgba(255,255,255,0.03);
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        gap: 15px;
                        font-family: 'Courier New', monospace;
                        font-size: 14px;
                        border-left: 3px solid #00d4ff;
                    }
                    .route-method {
                        color: #00d4ff;
                        font-weight: bold;
                        min-width: 60px;
                    }
                    .route-path {
                        color: #fff;
                        flex: 1;
                    }
                    .route-status {
                        font-size: 12px;
                        padding: 2px 10px;
                        border-radius: 10px;
                        background: #00c853;
                        color: #000;
                    }
                    
                    .btn-download {
                        display: inline-flex;
                        align-items: center;
                        gap: 10px;
                        background: #00d4ff;
                        color: #000;
                        padding: 12px 30px;
                        border-radius: 10px;
                        text-decoration: none;
                        font-weight: bold;
                        transition: all 0.3s;
                        border: none;
                        cursor: pointer;
                        font-size: 16px;
                    }
                    .btn-download:hover {
                        transform: scale(1.02);
                        box-shadow: 0 5px 20px rgba(0, 212, 255, 0.3);
                    }
                    
                    .log-container {
                        max-height: 300px;
                        overflow-y: auto;
                        background: rgba(0,0,0,0.3);
                        border-radius: 10px;
                        padding: 15px;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        color: #8899aa;
                    }
                    .log-line {
                        padding: 3px 0;
                        border-bottom: 1px solid rgba(255,255,255,0.03);
                    }
                    .log-line .time {
                        color: #556677;
                        margin-right: 10px;
                    }
                    .log-line .level-info { color: #00d4ff; }
                    .log-line .level-error { color: #ff1744; }
                    .log-line .level-success { color: #00c853; }
                    
                    ::-webkit-scrollbar {
                        width: 6px;
                    }
                    ::-webkit-scrollbar-track {
                        background: rgba(255,255,255,0.05);
                        border-radius: 10px;
                    }
                    ::-webkit-scrollbar-thumb {
                        background: #00d4ff;
                        border-radius: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>
                        🖥️ Cxcode Monitor App
                        <span class="status-badge">
                            <span class="dot"></span>
                            Online
                        </span>
                    </h1>
                    
                    <div class="grid">
                        <div class="card">
                            <div class="card-title">💻 CPU Usage</div>
                            <div class="card-value" id="cpu">0%</div>
                        </div>
                        <div class="card">
                            <div class="card-title">🧠 RAM Usage</div>
                            <div class="card-value" id="ram">0 MB</div>
                        </div>
                        <div class="card">
                            <div class="card-title">📡 Latency</div>
                            <div class="card-value" id="latency">0 ms</div>
                        </div>
                        <div class="card">
                            <div class="card-title">⏱️ Uptime</div>
                            <div class="card-value" id="uptime">0h</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">💠 Rotas</div>
                        <div id="routes">
                            <div class="route-item">
                                <span class="route-method">GET</span>
                                <span class="route-path">/</span>
                                <span class="route-status">✓ Painel</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/login</span>
                                <span class="route-status">✓ Auth</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/cadastro</span>
                                <span class="route-status">✓ Auth</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/confirmar-cadastro</span>
                                <span class="route-status">✓ Auth</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/enviar</span>
                                <span class="route-status">✓ Chat</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/mensagens</span>
                                <span class="route-status">✓ Chat</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/confirmar_recebimento</span>
                                <span class="route-status">✓ Chat</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/upload_foto</span>
                                <span class="route-status">✓ Perfil</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">GET</span>
                                <span class="route-path">/get_foto</span>
                                <span class="route-status">✓ Perfil</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/get_fotos_lote</span>
                                <span class="route-status">✓ Perfil</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/salvar_contatos</span>
                                <span class="route-status">✓ Contatos</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">GET</span>
                                <span class="route-path">/buscar_contatos</span>
                                <span class="route-status">✓ Contatos</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/atualizar_nome</span>
                                <span class="route-status">✓ Perfil</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">GET</span>
                                <span class="route-path">/get_nome</span>
                                <span class="route-status">✓ Perfil</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/get_nomes_lote</span>
                                <span class="route-status">✓ Perfil</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/mensagens/deletar</span>
                                <span class="route-status">✓ Chat</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">POST</span>
                                <span class="route-path">/mensagens/apagar_especifica</span>
                                <span class="route-status">✓ Chat</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">GET</span>
                                <span class="route-path">/metrics</span>
                                <span class="route-status">🖤 Monitor Cxcode 🖤</span>
                            </div>
                            <div class="route-item">
                                <span class="route-method">GET</span>
                                <span class="route-path">/download_server</span>
                                <span class="route-status">✓ Monitor</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="section" style="text-align: center;">
                        <div class="section-title" style="justify-content: center;">📥 download the server</div>
                        <button class="btn-download" onclick="downloadServer()">
                            ⬇️ Baixar server.js
                        </button>
                        <p style="margin-top: 15px; color: #8899aa; font-size: 14px;">
                            Versão: 1.0.0 | Última atualização: ${new Date().toLocaleString()}
                        </p>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">📋real-time logs</div>
                        <div class="log-container" id="logs">
                            <div class="log-line">
                                <span class="time">[${new Date().toLocaleTimeString()}]</span>
                                <span class="level-success">Server is connected</span>
                            </div>
                            <div class="log-line">
                                <span class="time">[${new Date().toLocaleTimeString()}]</span>
                                <span class="level-info">connected</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    function downloadServer() {
                        fetch('/download_server')
                            .then(response => response.text())
                            .then(code => {
                                const blob = new Blob([code], { type: 'application/javascript' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = 'server.js';
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            })
                            .catch(err => {
                                alert('Erro ao baixar o arquivo: ' + err.message);
                            });
                    }
                    
                    async function atualizarMetricas() {
                        try {
                            const response = await fetch('/metrics');
                            const data = await response.json();
                            
                            document.getElementById('cpu').textContent = data.cpu + '%';
                            document.getElementById('ram').textContent = data.ram + ' MB';
                            document.getElementById('latency').textContent = data.latency + ' ms';
                            document.getElementById('uptime').textContent = data.uptime;
                            
                            const cpu = parseFloat(data.cpu);
                            const cpuEl = document.getElementById('cpu');
                            cpuEl.className = 'card-value';
                            if (cpu > 80) cpuEl.classList.add('red');
                            else if (cpu > 50) cpuEl.classList.add('yellow');
                            else cpuEl.classList.add('green');
                            
                            const ram = parseFloat(data.ram);
                            const ramEl = document.getElementById('ram');
                            ramEl.className = 'card-value';
                            if (ram > 80) ramEl.classList.add('red');
                            else if (ram > 50) ramEl.classList.add('yellow');
                            else ramEl.classList.add('green');
                            
                            const latency = parseFloat(data.latency);
                            const latEl = document.getElementById('latency');
                            latEl.className = 'card-value';
                            if (latency > 200) latEl.classList.add('red');
                            else if (latency > 100) latEl.classList.add('yellow');
                            else latEl.classList.add('green');
                            
                        } catch (e) {
                            console.error('Erro ao atualizar métricas:', e);
                        }
                    }
                    
                    // Socket.io para logs
                    const socket = io();
                    socket.on('log_update', function(log) {
                        const logContainer = document.getElementById('logs');
                        const logLine = document.createElement('div');
                        logLine.className = 'log-line';
                        const time = new Date().toLocaleTimeString();
                        logLine.innerHTML = '<span class="time">[' + time + ']</span><span class="level-' + log.level + '">' + log.message + '</span>';
                        logContainer.appendChild(logLine);
                        logContainer.scrollTop = logContainer.scrollHeight;
                    });
                    
                    // Inicia atualizações
                    atualizarMetricas();
                    setInterval(atualizarMetricas, 2000);
                </script>
            </body>
        </html>
    `);
});

app.get('/metrics', (req, res) => {
    const os = require('os');
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMem = os.totalmem() / (1024 * 1024);
    const freeMem = os.freemem() / (1024 * 1024);
    const usedMem = ((totalMem - freeMem) / totalMem * 100);
    
    const latency = Math.floor(Math.random() * 50) + 20;
    
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    
    res.json({
        cpu: cpuUsage.toFixed(1),
        ram: usedMem.toFixed(1),
        latency: latency,
        uptime: uptimeStr
    });
});

app.get('/download_server', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const serverPath = path.join(__dirname, 'server.js');
    
    fs.readFile(serverPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ erro: 'Erro ao ler o arquivo' });
        }
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Content-Disposition', 'attachment; filename="server.js"');
        res.send(data);
    });
});


app.post('/atualizar_nome', async (req, res) => {
    const { email, nome } = req.body;
    if (!email || !nome) return res.status(400).json({ erro: "Email e nome são obrigatórios" });
    
    const emailLimpo = email.trim().toLowerCase();
    const nomeLimpo = nome.trim();
    
    if (nomeLimpo.length < 1 || nomeLimpo.length > 50) {
        return res.status(400).json({ erro: "Nome deve ter entre 1 e 50 caracteres" });
    }
    
    try {
        const resultado = await usuariosColl.updateOne(
            { email: emailLimpo },
            { $set: { nome_perfil: nomeLimpo, atualizadoEm: new Date() } }
        );
        
        if (resultado.matchedCount === 0) return res.status(404).json({ erro: "Usuário não encontrado" });
        
        io.emit('nome_atualizado', { email: emailLimpo, nome: nomeLimpo });
        res.json({ status: "ok", mensagem: "Nome atualizado com sucesso!" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao salvar nome" });
    }
});

app.get('/get_nome', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "email is required." });
    
    const emailLimpo = email.trim().toLowerCase();
    
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
        const usuarios = await usuariosColl.find(
            { email: { $in: emails.map(e => e.trim().toLowerCase()) } },
            { projection: { email: 1, nome_perfil: 1 } }
        ).toArray();
        
        const resultado = {};
        usuarios.forEach(user => {
            resultado[user.email] = user.nome_perfil || user.email.split('@')[0];
        });
        
        emails.forEach(email => {
            const emailLimpo = email.trim().toLowerCase();
            if (!resultado[emailLimpo]) resultado[emailLimpo] = emailLimpo.split('@')[0];
        });
        
        res.json(resultado);
    } catch (erro) {
        res.status(500).json({ erro: "Error214" });
    }
});
http.listen(3000, '0.0.0.0', () => {
    console.log('꧁⃟ CXCODE ✔️');
});
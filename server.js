const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const path = require('path');

// DRIVER DO MONGODB
const { MongoClient, ServerApiVersion } = require('mongodb');

app.use(express.json({ limit: '50mb' }));

// ========== CONFIGURAÇÕES DO BANCO DE DADOS ==========
const uri = "mongodb+srv://server:adm27019213btu@btuapplication.wii3blb.mongodb.net/?appName=btuapplication";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  tls: true,
  tlsAllowInvalidCertificates: true
});


let db, usuariosColl, contatosColl;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("meu_aplicativo_chat"); 
        usuariosColl = db.collection("usuarios"); 
        contatosColl = db.collection("contatos"); 
        console.log("🟢 Conectado com sucesso ao MongoDB Atlas!");
    } catch (erro) {
        console.error("🔴 Erro ao conectar no MongoDB:", erro);
    }
}
conectarBanco();

// ========== CONFIGURAÇÕES DE SEGURANÇA ==========
const CHAVE_SECRETA = "MeApp-2026-05-19-NZ-8y$y$y$y$&-8d)(?!?!{'json','MeAppSHA-256'}'/";

// ========== VARIÁVEIS GLOBAIS ==========
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
        console.error('Erro na descriptografia XOR:', erro);
        return null;
    }
}

// ========== ROTA: UPLOAD DE FOTO ==========
app.post('/upload_foto', async (req, res) => {
    const { email, foto } = req.body;
    
    if (!email || !foto) {
        return res.status(400).json({ erro: "Dados incompletos" });
    }
    
    const fotoLimpa = foto.replace(/[\s\n\r]/g, '');
    const fotoBuffer = descriptografarXOR(fotoLimpa);
    
    if (!fotoBuffer) {
        return res.status(400).json({ erro: "Falha na descriptografia" });
    }
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const fotoBase64 = fotoBuffer.toString('base64');
        
        const resultado = await usuariosColl.updateOne(
            { email: emailLimpo },
            { $set: { foto: fotoBase64 } }
        );
        
        if (resultado.matchedCount === 0) {
            return res.status(404).json({ erro: "Usuário não encontrado para associar a foto." });
        }
        
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao salvar foto no banco de dados." });
    }
});

// ========== ROTAS DE CONTATOS (CORRIGIDAS PARA ENCAIXAR NO SKETCHWARE) ==========
app.post('/salvar_contatos', async (req, res) => {
    const { email, contatos } = req.body;
    
    if (!email || !contatos) {
        return res.status(400).json({ erro: "Dados incompletos" });
    }
    
    const emailLimpo = email.trim().toLowerCase();
    
    // Força garantir que contatos seja uma Array estruturada
    const listaContatos = Array.isArray(contatos) ? contatos : [];
    
    try {
        await contatosColl.updateOne(
            { email: emailLimpo },
            { $set: { contatos: listaContatos, atualizadoEm: new Date() } },
            { upsert: true } 
        );
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao salvar contatos no banco." });
    }
});

app.get('/buscar_contatos', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const registro = await contatosColl.findOne({ email: emailLimpo });
        
        // CORREÇÃO CRÍTICA: Retorna a array limpa diretamente para o Android não se perder no parse
        if (!registro || !registro.contatos) {
            return res.status(200).json([]);
        }
        
        // Retorna a lista direto para o Sketchware ler nativamente como JSONArray
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
        if (!usuario || !usuario.foto) {
            return res.status(404).json({ status: "sem_foto" });
        }
        
        const fotoBuffer = Buffer.from(usuario.foto, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fotoBuffer);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar foto." });
    }
});

app.get('/get_foto', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario || !usuario.foto) {
            return res.json({ status: "sem_foto" });
        }
        
        const fotoBuffer = Buffer.from(usuario.foto, 'base64');
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fotoBuffer);
    } catch (erro) {
        res.json({ status: "erro" });
    }
});

app.post('/deletar_foto', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        await usuariosColl.updateOne(
            { email: emailLimpo },
            { $unset: { foto: "" } } 
        );
        console.log(`🗑️ Foto deletada no banco para: ${emailLimpo}`);
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao deletar foto." });
    }
});

// ========== CADASTRO ==========
app.post('/cadastro', async (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
        return res.status(400).json({ erro: "E-mail e Senha são obrigatórios!" });
    }

    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const usuarioExistente = await usuariosColl.findOne({ email: emailLimpo });
        if (usuarioExistente) {
            return res.status(400).json({ erro: "Este e-mail já está cadastrado!" });
        }

        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        codigosVerificacao[emailLimpo] = {
            codigo: codigo,
            senhaProvisoria: senha
        };

        console.log(`📧 [CADASTRO] Email: ${emailLimpo} | Código: ${codigo}`);
        return res.status(200).json({ status: "ok", mensagem: "Código gerado com sucesso!" });
    } catch (erro) {
        return res.status(500).json({ erro: "Erro ao verificar disponibilidade de e-mail." });
    }
});

app.post('/confirmar-cadastro', async (req, res) => {
    const { email, codigo } = req.body;

    if (!email || !codigo) {
        return res.status(400).json({ erro: "Dados incompletos para validação." });
    }

    const emailLimpo = email.trim().toLowerCase();
    
    if (!codigosVerificacao[emailLimpo]) {
        return res.status(400).json({ erro: "Solicitação não encontrada ou expirada." });
    }

    const dadosProvisorios = codigosVerificacao[emailLimpo];

    if (dadosProvisorios.codigo === codigo.trim()) {
        const dadosSalvar = {
            email: emailLimpo,
            senha: dadosProvisorios.senhaProvisoria,
            criadoEm: new Date().toISOString(),
            foto: "" 
        };
        
        try {
            await usuariosColl.insertOne(dadosSalvar);
            delete codigosVerificacao[emailLimpo];
            return res.status(200).json({ status: "ok", mensagem: "Cadastro concluído com sucesso!" });
        } catch (erroBanco) {
            return res.status(500).json({ erro: "Erro interno ao salvar dados no banco de dados." });
        }
    } else {
        return res.status(401).json({ erro: "Código incorreto!" });
    }
});

// ========== LOGIN ==========
app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: "E-mail e senha são obrigatórios!" });
    }

    const emailLimpo = email.trim().toLowerCase();

    try {
        const dadosUsuario = await usuariosColl.findOne({ email: emailLimpo });

        if (!dadosUsuario) {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }

        if (dadosUsuario.senha === senha) {
            return res.status(200).json({ status: "ok", usuario: emailLimpo });
        } else {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao ler dados de autenticação no banco." });
    }
});

// ========== MENSAGENS ==========
app.get('/mensagens', (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ erro: "Email é obrigatório" });
    }
    
    const mensagensDoUsuario = [];
    const emailFiltro = email.trim().toLowerCase();
    
    for (const msg of historico) {
        if (msg.chat_id && msg.chat_id.toLowerCase().includes(emailFiltro)) {
            mensagensDoUsuario.push({
                id: msg.id,
                chat_id: msg.chat_id,
                email_contato: msg.email_contato,  
                usuario: msg.usuario,
                texto: msg.texto,
                timestamp: msg.timestamp
            });
        }
    }
    
    mensagensDoUsuario.sort((a, b) => a.timestamp - b.timestamp);
    res.json(mensagensDoUsuario);
});

app.post('/enviar', (req, res) => {
    const { id, chat_id, usuario, texto, destinatario } = req.body;
    
    if (!usuario || !texto || !destinatario) {
        return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
    }

    const timestamp = Date.now();
    const idValido = id || (timestamp + "_" + Math.floor(Math.random() * 9999));
    
    const listaEmails = [usuario.trim().toLowerCase(), destinatario.trim().toLowerCase()].sort();
    const chatIdValido = "Contato_" + listaEmails[0] + "_" + listaEmails[1];
    
    const novaMsg = { 
        id: idValido, 
        chat_id: chatIdValido,
        email_contato: destinatario.trim().toLowerCase(),  
        usuario: usuario.trim().toLowerCase(),
        texto: texto,
        timestamp: timestamp
    };
    
    historico.push(novaMsg);
    io.emit('recebe_mensagem', novaMsg);
    res.json({ status: "ok" });
});

app.post('/confirmar_recebimento', (req, res) => {
    const { email, ids } = req.body; 
    const emailFiltro = email.trim().toLowerCase();
    
    historico = historico.filter(msg => {
        if (msg.chat_id && msg.chat_id.toLowerCase().includes(emailFiltro) && ids.includes(msg.id)) {
            return false; 
        }
        return true; 
    });
    
    res.json({ status: "ok", removidas: ids.length });
});

app.post('/mensagens/deletar', (req, res) => {
    const { meuEmail, contatoEmail } = req.query;

    if (!meuEmail || !contatoEmail) {
        return res.status(400).json({ erro: "Parâmetros meuEmail e contatoEmail são obrigatórios!" });
    }

    const email1 = meuEmail.trim().toLowerCase();
    const email2 = contatoEmail.trim().toLowerCase();

    const chatVariacaoA = `Contato_${email1}_${email2}`;
    const chatVariacaoB = `Contato_${email2}_${email1}`;

    const tamanhoAntes = historico.length;

    historico = historico.filter(msg => {
        if (msg.chat_id === chatVariacaoA || msg.chat_id === chatVariacaoB || msg.chat_id === email2) {
            return false; 
        }
        return true; 
    });

    const deletadas = tamanhoAntes - historico.length;
    res.json({ status: "ok", mensagens_deletadas: deletadas });
});

// ========== SOCKET.IO CORRIGIDO ==========
io.on('connection', (socket) => {
    socket.on('envia_mensagem', (dados) => {
        let { id, chat_id, usuario, texto } = dados;
        const timestamp = Date.now();
        if (!id) id = timestamp + "_" + Math.floor(Math.random() * 9999);
        
        let remetente = usuario ? usuario.trim().toLowerCase() : "admin_web";
        let chatIdValido = "";

        // CORREÇÃO: Trata corretamente se o chat já vier formatado ou se for ID simples
        if (chat_id && chat_id.startsWith("Contato_")) {
            chatIdValido = chat_id;
        } else if (chat_id) {
            const listaEmails = [remetente, chat_id.trim().toLowerCase()].sort();
            chatIdValido = "Contato_" + listaEmails[0] + "_" + listaEmails[1];
        } else {
            chatIdValido = "Contato_Geral";
        }

        const msgCompleta = { 
            id: id, 
            chat_id: chatIdValido, 
            email_contato: remetente, 
            usuario: remetente, 
            texto: texto, 
            timestamp: timestamp 
        };
        
        historico.push(msgCompleta);
        io.emit('recebe_mensagem', msgCompleta); 
    });
});

// ========== PAINEL WEB ==========
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <meta charset="utf-8">
                <title>Painel Admin - MeApp</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                    .container { max-width: 600px; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin: 0 auto; }
                    input { display: block; width: 100%; margin-bottom: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; }
                    button { width: 100%; padding: 10px; background: #e53935; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; }
                    #chat { margin-top: 20px; height: 300px; overflow-y: auto; border: 1px solid #eee; padding: 10px; background: #fafafa; border-radius: 5px; }
                    .msg-box { margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee; }
                    .chat-tag { background: #e53935; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>MeApp - Admin</h2>
                    <input id="c" placeholder="Seu e-mail (Ex: admin@teste.com)">
                    <input id="u" placeholder="E-mail do Destinatário (Ex: celular@teste.com)">
                    <input id="m" placeholder="Digite o texto aqui">
                    <button onclick="enviarPelaWeb()">Enviar para o Celular</button>
                    <div id="chat"></div>
                </div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    function enviarPelaWeb() {
                        if(!c.value || !u.value || !m.value) return alert("Preencha todos os campos!");
                        socket.emit('envia_mensagem', {
                            id: "web_" + Date.now() + "_" + Math.floor(Math.random() * 999),
                            chat_id: u.value.trim(),
                            usuario: c.value.trim(),
                            texto: m.value
                        });
                        m.value = "";
                    }
                    socket.on('recebe_mensagem', (d) => {
                        let hora = new Date(d.timestamp).toLocaleTimeString('pt-BR');
                        let chatDiv = document.getElementById('chat');
                        chatDiv.innerHTML += '<div class="msg-box"><span class="chat-tag">Chat: ' + d.chat_id + '</span><br><b>' + d.usuario + ':</b> ' + d.texto + ' <small>(' + hora + ')</small></div>';
                        chatDiv.scrollTop = chatDiv.scrollHeight;
                    });
                </script>
            </body>
        </html>
    `);
});

// ========== ATUALIZAR NOME DO PERFIL ==========
app.post('/atualizar_nome', async (req, res) => {
    const { email, nome } = req.body;
    
    if (!email || !nome) {
        return res.status(400).json({ erro: "Email e nome são obrigatórios" });
    }
    
    const emailLimpo = email.trim().toLowerCase();
    const nomeLimpo = nome.trim();
    
    if (nomeLimpo.length < 1 || nomeLimpo.length > 50) {
        return res.status(400).json({ erro: "Nome deve ter entre 1 e 50 caracteres" });
    }
    
    try {
        const resultado = await usuariosColl.updateOne(
            { email: emailLimpo },
            { $set: { 
                nome_perfil: nomeLimpo,
                atualizadoEm: new Date() 
            }}
        );
        
        if (resultado.matchedCount === 0) {
            return res.status(404).json({ erro: "Usuário não encontrado" });
        }
        
        res.json({ status: "ok", mensagem: "Nome atualizado com sucesso!" });
    } catch (erro) {
        console.error("Erro ao atualizar nome:", erro);
        res.status(500).json({ erro: "Erro ao salvar nome no banco" });
    }
});

// ========== BUSCAR NOME DO PERFIL ==========
app.get('/get_nome', async (req, res) => {
    const { email } = req.query;
    
    if (!email) {
        return res.status(400).json({ erro: "Email é obrigatório" });
    }
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const usuario = await usuariosColl.findOne({ email: emailLimpo });
        
        if (!usuario) {
            return res.status(404).json({ erro: "Usuário não encontrado" });
        }
        
        const nomeExibicao = usuario.nome_perfil || emailLimpo.split('@')[0];
        
        res.json({ 
            status: "ok", 
            nome: nomeExibicao,
            email: emailLimpo
        });
    } catch (erro) {
        console.error("Erro ao buscar nome:", erro);
        res.status(500).json({ erro: "Erro ao buscar nome do usuário" });
    }
});

// ========== BUSCAR NOMES EM LOTE (PRA LISTA DE CONTATOS) ==========
app.post('/get_nomes_lote', async (req, res) => {
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails)) {
        return res.status(400).json({ erro: "Lista de emails é obrigatória" });
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
            if (!resultado[emailLimpo]) {
                resultado[emailLimpo] = emailLimpo.split('@')[0];
            }
        });
        
        res.json(resultado);
    } catch (erro) {
        console.error("Erro ao buscar nomes em lote:", erro);
        res.status(500).json({ erro: "Erro ao buscar nomes" });
    }
});
// ========== INICIAR SERVIDOR ==========
http.listen(3000, '0.0.0.0', () => {
    console.log('🟢 Servidor atualizado rodando na porta 3000 com MongoDB Atlas ativo!');
});

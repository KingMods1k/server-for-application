const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});
const path = require('path');
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

let db, usuariosColl, contatosColl, codigosColl, mensagensColl;

async function conectarBanco() {
    try {
        await client.connect();
        db = client.db("meu_aplicativo_chat"); 
        usuariosColl = db.collection("usuarios"); 
        contatosColl = db.collection("contatos"); 
codigosColl = db.collection("codigos_verificacao");
mensagensColl = db.collection("mensagens");
        console.log("🟢 Conectado com sucesso ao MongoDB Atlas!");
    } catch (erro) {
        console.error("🔴 Erro ao conectar no MongoDB:", erro);
    }
}
conectarBanco();

// ========== FUNÇÃO PARA GERAR CHAVE ALEATÓRIA ==========
function gerarChaveAleatoria() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let chave = '';
    for (let i = 0; i < 44; i++) {
        chave += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return chave;
}

async function garantirChaveUsuario(email) {
    const usuario = await usuariosColl.findOne({ email: email });
    if (usuario && !usuario.chave_cripto) {
        const novaChave = gerarChaveAleatoria();
        await usuariosColl.updateOne(
            { email: email },
            { $set: { chave_cripto: novaChave } }
        );
        console.log(`✅ Chave criada para usuário existente: ${email}`);
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
            console.log(`✅ Adicionado nome_perfil para: ${email} -> ${nomePadrao}`);
        }
    } catch (erro) {
        console.error("Erro ao garantir nome_perfil:", erro);
    }
}

const CHAVE_SECRETA = process.env.CHAVE_XOR;

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
// ========== ROTA HTTP PARA CONFIRMAR RECEBIMENTO (IGUAL AO SOCKET) ==========
app.post('/confirmar_recebimento', async (req, res) => {
    try {
        const { email, ids } = req.body;
        if (!email || !ids || !Array.isArray(ids)) {
            return res.status(400).json({ erro: "Dados inválidos" });
        }

        const emailFiltro = email.trim().toLowerCase();

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
                
                // 🔥 NOTIFICA O REMETENTE IGUAL AO SOCKET
                io.to(msg.usuario).emit('mensagem_recebida', { id: id });
                console.log(`✔ Mensagem ${id} confirmada por ${emailFiltro} (HTTP)`);
            }
        }
        
        res.json({ status: "ok" });
    } catch (erro) {
        console.error("Erro em confirmar_recebimento (HTTP):", erro);
        res.status(500).json({ erro: "Erro ao confirmar" });
    }
});

// ========== ROTAS DE FOTOS EM LOTE AJUSTADA PARA POST ==========
app.post('/get_fotos_lote', async (req, res) => {
    // Agora lê do corpo (req.body) enviado pelo Android
    const { emails } = req.body; 
    
    if (!emails) {
        return res.status(400).json({ erro: "Lista de emails é obrigatória" });
    }
    
    try {
        // Garante que os dados sejam tratados como Array, mesmo vindo em formatos variados
        const listaEmails = Array.isArray(emails) ? emails : JSON.parse(emails);
        
        if (!Array.isArray(listaEmails) || listaEmails.length === 0) {
            return res.status(400).json({ erro: "Lista de emails inválida" });
        }
        
        // Busca no MongoDB apenas os e-mails solicitados (limpos)
        const usuarios = await usuariosColl.find(
            { email: { $in: listaEmails.map(e => e.trim().toLowerCase()) } },
            { projection: { email: 1, foto: 1 } }
        ).toArray();
        
        const resultado = {};
        usuarios.forEach(usuario => {
    resultado[usuario.email] = (usuario.foto && usuario.foto.length > 10) ? usuario.foto : null;
});
        // Garante que todo e-mail solicitado tenha uma resposta (mesmo que nula)
        listaEmails.forEach(email => {
            const emailLimpo = email.trim().toLowerCase();
            if (!(emailLimpo in resultado)) resultado[emailLimpo] = null;
        });
        
        res.json(resultado);
    } catch (erro) {
        console.error("Erro ao buscar fotos em lote:", erro);
        res.status(500).json({ erro: "Erro ao buscar fotos" });
    }
});

app.post('/upload_foto', async (req, res) => {
    const { email, foto } = req.body;
    if (!email || !foto) return res.status(400).json({ erro: "Dados incompletos" });
    
    const fotoLimpa = foto.replace(/[\s\n\r]/g, '');
    const fotoBuffer = descriptografarXOR(fotoLimpa);
    if (!fotoBuffer) return res.status(400).json({ erro: "Falha na descriptografia" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const fotoBase64 = fotoBuffer.toString('base64');
        const resultado = await usuariosColl.updateOne(
            { email: emailLimpo },
            { $set: { foto: fotoBase64 } }
        );
        
        if (resultado.matchedCount === 0) {
            return res.status(404).json({ erro: "Usuário não encontrado" });
        }
        
        io.emit('foto_atualizada', { email: emailLimpo, foto: fotoBase64 });
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao salvar foto" });
    }
});

app.get('/usuario', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        let usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
        
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


app.post('/mensagens/apagar_especifica', async (req, res) => {
    try {
        const { email, senha, ids } = req.body;

        if (!email || !senha || !ids || !Array.isArray(ids)) {
            return res.status(400).json({ erro: "Dados incompletos" });
        }

        const emailLimpo = email.trim().toLowerCase();
        const usuario = await usuariosColl.findOne({ email: emailLimpo });

        if (!usuario || usuario.senha !== senha) {
            return res.status(401).json({ erro: "Não autorizado" });
        }

        // ✅ SÓ QUEM ENVIOU PODE APAGAR!
        const resultado = await mensagensColl.deleteMany({
            id: { $in: ids },
            usuario: emailLimpo  // ← SÓ O REMETENTE!
        });

        // 🔥 Se não apagou nenhuma, avisa
        if (resultado.deletedCount === 0) {
            return res.status(404).json({ 
                erro: "Mensagem não encontrada ou você não é o remetente" 
            });
        }

        res.json({ 
            status: "ok", 
            apagadas: resultado.deletedCount 
        });

    } catch (erro) {
        console.error('Erro ao apagar mensagem:', erro);
        res.status(500).json({ erro: "Erro interno" });
    }
});


app.post('/salvar_contatos', async (req, res) => {
    const { email, contatos } = req.body;
    if (!email || !contatos) return res.status(400).json({ erro: "Dados incompletos" });
    
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
        res.status(500).json({ erro: "Erro ao salvar contatos" });
    }
});

app.get('/buscar_contatos', async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
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
        res.status(500).json({ erro: "Erro ao buscar foto" });
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
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        await usuariosColl.updateOne({ email: emailLimpo }, { $unset: { foto: "" } });
        res.json({ status: "ok" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao deletar foto" });
    }
});

app.post('/cadastro', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: "E-mail e Senha são obrigatórios!" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const usuarioExistente = await usuariosColl.findOne({ email: emailLimpo });
        if (usuarioExistente) return res.status(400).json({ erro: "Este e-mail já está cadastrado!" });
        
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        
        // SALVA NO BANCO (em vez da memória)
        await codigosColl.updateOne(
            { email: emailLimpo },
            { $set: { 
                codigo: codigo, 
                senhaProvisoria: senha, 
                criadoEm: new Date() 
            }},
            { upsert: true }
        );
        
        console.log(`📧 [CADASTRO] Email: ${emailLimpo} | Código: ${codigo}`);
        return res.status(200).json({ status: "ok", mensagem: "Código gerado com sucesso!" });
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
            const dadosSalvar = {
                email: emailLimpo,
                senha: registro.senhaProvisoria,
                criadoEm: new Date().toISOString(),
                foto: "",
                nome_perfil: emailLimpo.split('@')[0]
                // ⬅️ chave_cripto REMOVIDA
            };
            
            await usuariosColl.insertOne(dadosSalvar);
            await codigosColl.deleteOne({ email: emailLimpo });
            
            return res.status(200).json({ status: "ok", mensagem: "Cadastro concluído com sucesso!" });
        } else {
            return res.status(401).json({ erro: "Código incorreto!" });
        }
    } catch (erro) {
        console.error("Erro ao confirmar cadastro:", erro);
        return res.status(500).json({ erro: "Erro ao validar código." });
    }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: "E-mail e senha são obrigatórios!" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        const dadosUsuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!dadosUsuario) return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        
        const nomePadrao = emailLimpo.split('@')[0];
        await garantirNomePerfil(emailLimpo, nomePadrao);
        
        if (dadosUsuario.senha === senha) {
            await garantirChaveUsuario(emailLimpo);
            return res.status(200).json({ status: "ok", usuario: emailLimpo });
        } else {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao ler dados de autenticação." });
    }
});

app.post('/mensagens', async (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) return res.status(400).json({ erro: "Não autorizado" });
    
    const emailLimpo = email.trim().toLowerCase();
    const usuario = await usuariosColl.findOne({ email: emailLimpo });
    if (!usuario || usuario.senha !== senha) return res.status(401).json({ erro: "Não autorizado" });
    const emailFiltro = email.trim().toLowerCase();
    try {
        const mensagensDoUsuario = await mensagensColl.find({
            $or: [
                { email_contato: emailFiltro },  // mensagens recebidas
                { usuario: emailFiltro }         // mensagens enviadas por ele
            ]
            // ← NÃO filtrar por entregue: false
        }).sort({ timestamp: 1 }).toArray();
        res.json(mensagensDoUsuario);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar mensagens" });
    }
});

// 🔥 FUNÇÃO DESCRIPTOGRAFAR REMOVIDA - NÃO USA MAIS CRIPTOGRAFIA

app.post('/enviar', async (req, res) => {
    const { id, chat_id, usuario, texto, destinatario, timestamp } = req.body;
    
    if (!usuario || !texto || !destinatario) {
        return res.status(400).json({ erro: "Campos obrigatórios ausentes." });
    }
    
    // 🔥 SEM CRIPTOGRAFIA - USA TEXTO DIRETO
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
    entregue: false   // 🔥 SÓ ADICIONA ESTA LINHA
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
        // Deleta todas as mensagens trocadas entre os dois
        const resultado = await mensagensColl.deleteMany({
            $or: [
                { email_contato: email2, usuario: email1 },
                { email_contato: email1, usuario: email2 }
            ]
        });
        
        // Também limpa do array em memória (opcional)
        historico = historico.filter(msg => {
            return !((msg.email_contato === email2 && msg.usuario === email1) ||
                     (msg.email_contato === email1 && msg.usuario === email2));
        });
        
        res.json({ status: "ok", deletadas: resultado.deletedCount });
    } catch (erro) {
        console.error("Erro ao deletar:", erro);
        res.status(500).json({ erro: "Erro ao deletar mensagens" });
    }
});

io.on('connection', (socket) => {
    socket.on('identificar', (email) => {
        socket.join(email);
        console.log(`✅ ${email} identificado`);
    });
    // Novo listener: confirmação em tempo real via socket
socket.on('confirmar_recebimento', async (dados) => {
    try {
        const { email, ids } = dados;
        if (!email || !ids || !Array.isArray(ids)) return;

        const emailFiltro = email.trim().toLowerCase();

        for (const id of ids) {
            const msg = await mensagensColl.findOne({ id: id, email_contato: emailFiltro });
            if (msg && !msg.entregue) {
                await mensagensColl.updateOne(
                    { id: id },
                    { $set: { entregue: true } }
                );
                // Notifica o remetente (msg.usuario)
                io.to(msg.usuario).emit('mensagem_recebida', { id: id });
                console.log(`✔ Mensagem ${id} confirmada por ${emailFiltro}`);
            }
        }
    } catch (erro) {
        console.error("Erro em confirmar_recebimento (socket):", erro);
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
        
        console.log(`📨 Mensagem de ${remetente} para ${destinatario}`);
    });
});
// ========== PAINEL WEB - SEM CRIPTOGRAFIA ==========
app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <meta charset="utf-8">
                <title>MeApp - Admin</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
                    .container { max-width: 500px; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    input { display: block; width: 100%; margin-bottom: 15px; padding: 12px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; font-size: 16px; }
                    button { width: 100%; padding: 12px; background: #e53935; color: white; border: none; border-radius: 5px; font-weight: bold; cursor: pointer; font-size: 16px; }
                    button:hover { background: #c62828; }
                    .error { color: red; margin-bottom: 15px; text-align: center; }
                    h2 { text-align: center; color: #e53935; margin-bottom: 25px; }
                </style>
            </head>
            <body>
                <div class="container" id="loginContainer">
                    <h2>🔐 Painel Admin</h2>
                    <input type="text" id="email" placeholder="E-mail" value="server@server">
                    <input type="password" id="senha" placeholder="Senha">
                    <button onclick="fazerLogin()">Entrar</button>
                    <div id="errorMsg" class="error"></div>
                </div>
                
                <div class="container" id="chatContainer" style="display:none; max-width: 800px;">
                    <h2>📨 MeApp - Admin</h2>
                    <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                        <input type="text" id="destinatario" placeholder="E-mail do destinatário" style="flex:2;">
                        <input type="text" id="mensagem" placeholder="Digite sua mensagem" style="flex:3;">
                        <button onclick="enviarMensagem()" style="width: auto; padding: 12px 20px;">Enviar</button>
                        <button onclick="sair()" style="width: auto; background: #666;">Sair</button>
                    </div>
                    <div id="chatArea" style="height: 400px; overflow-y: auto; border: 1px solid #eee; padding: 10px; background: #fafafa; border-radius: 5px;">
                        <div style="text-align: center; color: #999;">Conectado como server@server</div>
                    </div>
                </div>
                
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    let socket = null;
                    let logado = false;
                    
                    async function fazerLogin() {
                        const email = document.getElementById('email').value.trim();
                        const senha = document.getElementById('senha').value;
                        
                        if (email === 'server@server' && senha === 'vxz') {
                            logado = true;
                            document.getElementById('loginContainer').style.display = 'none';
                            document.getElementById('chatContainer').style.display = 'block';
                            
                            socket = io();
                            
                            socket.on('connect', () => {
                                socket.emit('identificar', 'server@server');
                                console.log('✅ Conectado ao servidor');
                            });
                            
                            socket.on('recebe_mensagem', (dados) => {
                                let hora = new Date(dados.timestamp).toLocaleTimeString('pt-BR');
                                // 🔥 SEM CRIPTOGRAFIA - USA TEXTO DIRETO
                                let textoExibido = dados.texto;
                                let chatDiv = document.getElementById('chatArea');
                                chatDiv.innerHTML += '<div style="margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee;"><b>' + dados.usuario + ':</b> ' + textoExibido + ' <small style="color:#999;">(' + hora + ')</small></div>';
                                chatDiv.scrollTop = chatDiv.scrollHeight;
                            });
                            
                            try {
                                const response = await fetch('/criar_conta_server', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email: 'server@server', senha: 'vxz' })
                                });
                                const result = await response.json();
                                console.log('Conta server:', result);
                            } catch(e) {
                                console.log('Conta server já existe ou erro:', e);
                            }
                        } else {
                            document.getElementById('errorMsg').innerText = '❌ E-mail ou senha incorretos!';
                        }
                    }
                    
                    function enviarMensagem() {
                        if (!socket) return alert('Conectando...');
                        
                        const destinatario = document.getElementById('destinatario').value.trim();
                        const texto = document.getElementById('mensagem').value.trim();
                        
                        if (!destinatario || !texto) return alert('Preencha destinatário e mensagem');
                        
                        // 🔥 SEM CRIPTOGRAFIA - ENVIA TEXTO PURO
                        socket.emit('envia_mensagem', {
                            id: "web_" + Date.now() + "_" + Math.floor(Math.random() * 9999),
                            chat_id: destinatario,
                            usuario: 'server@server',
                            texto: texto
                        });
                        
                        let hora = new Date().toLocaleTimeString('pt-BR');
                        let chatDiv = document.getElementById('chatArea');
                        chatDiv.innerHTML += '<div style="margin-bottom: 10px; padding: 8px; border-bottom: 1px solid #eee;"><b>Você (para ' + destinatario + '):</b> ' + texto + ' <small style="color:#999;">(' + hora + ')</small></div>';
                        chatDiv.scrollTop = chatDiv.scrollHeight;
                        document.getElementById('mensagem').value = '';
                    }
                    
                    function sair() {
                        if (socket) socket.disconnect();
                        logado = false;
                        document.getElementById('loginContainer').style.display = 'block';
                        document.getElementById('chatContainer').style.display = 'none';
                        document.getElementById('chatArea').innerHTML = '<div style="text-align: center; color: #999;">Conectado como server@server</div>';
                        document.getElementById('email').value = 'server@server';
                        document.getElementById('senha').value = '';
                        document.getElementById('destinatario').value = '';
                        document.getElementById('mensagem').value = '';
                    }
                </script>
            </body>
        </html>
    `);
});

app.post('/criar_conta_server', async (req, res) => {
    const { email, senha } = req.body;
    const emailLimpo = email.trim().toLowerCase();
    
    const usuarioExistente = await usuariosColl.findOne({ email: emailLimpo });
    if (usuarioExistente) return res.json({ status: "ok", mensagem: "Conta já existe" });
    
    const dadosSalvar = {
        email: emailLimpo,
        senha: senha,
        criadoEm: new Date().toISOString(),
        foto: "",
        nome_perfil: "Admin Server",
        chave_cripto: gerarChaveAleatoria()
    };
    
    try {
        await usuariosColl.insertOne(dadosSalvar);
        res.json({ status: "ok", mensagem: "Conta server criada com sucesso!" });
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao criar conta server" });
    }
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
    if (!email) return res.status(400).json({ erro: "Email é obrigatório" });
    
    const emailLimpo = email.trim().toLowerCase();
    
    try {
        let usuario = await usuariosColl.findOne({ email: emailLimpo });
        if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
        
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
        res.status(500).json({ erro: "Erro ao buscar nome" });
    }
});

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
            if (!resultado[emailLimpo]) resultado[emailLimpo] = emailLimpo.split('@')[0];
        });
        
        res.json(resultado);
    } catch (erro) {
        res.status(500).json({ erro: "Erro ao buscar nomes" });
    }
});

http.listen(3000, '0.0.0.0', () => {
    console.log('🟢 Servidor rodando na porta 3000 - SEM CRIPTOGRAFIA');
});
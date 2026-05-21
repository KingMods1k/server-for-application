const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});
const fs = require('fs');
const path = require('path');

app.use(express.json({ limit: '50mb' }));

// ========== CONFIGURAÇÕES ==========
const CHAVE_SECRETA = "MeApp-2026-05-19-NZ-8y$y$y$y$&-8d)(?!?!{'json','MeAppSHA-256'}'/";

// ========== PASTAS ==========
const PASTA_USUARIOS = path.join(__dirname, 'users');
const PASTA_UPLOADS = path.join(__dirname, 'photos');
const PASTA_CONTATOS = path.join(__dirname, 'contacts');  

// Criar pastas
if (!fs.existsSync(PASTA_USUARIOS)) fs.mkdirSync(PASTA_USUARIOS);
if (!fs.existsSync(PASTA_UPLOADS)) fs.mkdirSync(PASTA_UPLOADS);
if (!fs.existsSync(PASTA_CONTATOS)) fs.mkdirSync(PASTA_CONTATOS);  

// ========== VARIÁVEIS GLOBAIS ==========
let historico = [];
let codigosVerificacao = {};

// ========== FUNÇÃO DESCRIPTOGRAFAR XOR ==========
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
app.post('/upload_foto', (req, res) => {
    const { email, foto } = req.body;
    
    if (!email || !foto) {
        return res.status(400).json({ erro: "Dados incompletos" });
    }
    
    const fotoLimpa = foto.replace(/[\s\n\r]/g, '');
    
    const fotoBuffer = descriptografarXOR(fotoLimpa);
    if (!fotoBuffer) {
        return res.status(400).json({ erro: "Falha na descriptografia" });
    }
    
    const caminhoFoto = path.join(PASTA_UPLOADS, `${email}.jpg`);
    fs.writeFileSync(caminhoFoto, fotoBuffer);
    
    res.json({ status: "ok" });
});

// ========== ROTAS DE CONTATOS ==========
app.post('/salvar_contatos', (req, res) => {
    const { email, contatos } = req.body;
    
    if (!email || !contatos) {
        return res.status(400).json({ erro: "Dados incompletos" });
    }
    
    const caminhoContatos = path.join(PASTA_CONTATOS, `${email}.json`);
    fs.writeFileSync(caminhoContatos, JSON.stringify(contatos, null, 2));
    
    res.json({ status: "ok" });
});

app.get('/buscar_contatos', (req, res) => {
    const { email } = req.query;
    const caminhoContatos = path.join(PASTA_CONTATOS, `${email}.json`);
    
    if (!fs.existsSync(caminhoContatos)) {
        return res.json({ status: "ok", contatos: [] });
    }
    
    const contatos = JSON.parse(fs.readFileSync(caminhoContatos, 'utf-8'));
    res.json({ status: "ok", contatos: contatos });
});

app.get('/get_foto_contato', (req, res) => {
    const { email } = req.query;
    const caminhoFoto = path.join(PASTA_UPLOADS, `${email}.jpg`);
    
    if (!fs.existsSync(caminhoFoto)) {
        return res.status(404).json({ status: "sem_foto" });
    }
    
    const fotoBuffer = fs.readFileSync(caminhoFoto);
    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
    res.end(fotoBuffer);
});

// ========== ROTA: BAIXAR FOTO ==========
app.get('/get_foto', (req, res) => {
    const { email } = req.query;
    const caminhoFoto = path.join(PASTA_UPLOADS, `${email}.jpg`);
    
    if (!fs.existsSync(caminhoFoto)) {
        return res.json({ status: "sem_foto" });
    }
    
    try {
        const fotoBuffer = fs.readFileSync(caminhoFoto);
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        res.end(fotoBuffer);
    } catch (erro) {
        console.error(erro);
        res.json({ status: "erro" });
    }
});

// ========== ROTA: DELETAR FOTO ==========
app.post('/deletar_foto', (req, res) => {
    const { email } = req.body;
    const caminhoFoto = path.join(PASTA_UPLOADS, `${email}.jpg`);
    
    if (fs.existsSync(caminhoFoto)) {
        fs.unlinkSync(caminhoFoto);
        console.log(`🗑️ Foto deletada para: ${email}`);
    }
    res.json({ status: "ok" });
});

// ========== ROTA 1: SOLICITAR CADASTRO ==========
app.post('/cadastro', (req, res) => {
    const { email, senha } = req.body;
    
    if (!email || !senha) {
        return res.status(400).json({ erro: "E-mail e Senha são obrigatórios!" });
    }

    const emailLimpo = email.trim().toLowerCase();
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${emailLimpo}.json`);
    
    if (fs.existsSync(caminhoArquivo)) {
        return res.status(400).json({ erro: "Este e-mail já está cadastrado!" });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    
    codigosVerificacao[emailLimpo] = {
        codigo: codigo,
        senhaProvisoria: senha
    };

    console.log(`📧 [CADASTRO] Email: ${emailLimpo} | Código: ${codigo}`);
    return res.status(200).json({ status: "ok", mensagem: "Código gerado com sucesso!" });
});

// ========== ROTA 2: CONFIRMAR CADASTRO ==========
app.post('/confirmar-cadastro', (req, res) => {
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
            criadoEm: new Date().toISOString()
        };

        const caminhoArquivo = path.join(PASTA_USUARIOS, `${emailLimpo}.json`);
        
        try {
            fs.writeFileSync(caminhoArquivo, JSON.stringify(dadosSalvar, null, 2), 'utf-8');
            delete codigosVerificacao[emailLimpo];
            return res.status(200).json({ status: "ok", mensagem: "Cadastro concluído com sucesso!" });
        } catch (erroFs) {
            return res.status(500).json({ erro: "Erro interno ao salvar dados no servidor." });
        }
    } else {
        return res.status(401).json({ erro: "Código incorreto!" });
    }
});

// ========== ROTA 3: LOGIN ==========
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: "E-mail e senha são obrigatórios!" });
    }

    const emailLimpo = email.trim().toLowerCase();
    const caminhoArquivo = path.join(PASTA_USUARIOS, `${emailLimpo}.json`);

    if (!fs.existsSync(caminhoArquivo)) {
        return res.status(401).json({ erro: "E-mail ou senha incorretos." });
    }

    try {
        const conteudoArquivo = fs.readFileSync(caminhoArquivo, 'utf-8');
        const dadosUsuario = JSON.parse(conteudoArquivo);

        if (dadosUsuario.senha === senha) {
            return res.status(200).json({ status: "ok", usuario: emailLimpo });
        } else {
            return res.status(401).json({ erro: "E-mail ou senha incorretos." });
        }
    } catch (e) {
        return res.status(500).json({ erro: "Erro ao ler dados de autenticação." });
    }
});

// ========== ROTA: RECUPERAR MENSAGENS ==========
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

// ========== ROTA: ENVIAR MENSAGEM VIA APP ==========
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
    io.emit('recebe_mensagem', novaMsg); // Envia para o painel web escutar também
    res.json({ status: "ok" });
});

// ========== ROTA: CONFIRMAR RECEBIMENTO ==========
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

// ========== ROTA: DELETAR CONVERSA COMPLETA NO SERVIDOR ==========
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
    console.log(`🗑️ [SERVER] Conversa limpa entre ${email1} e ${email2}. Foram removidas ${deletadas} mensagens.`);
    
    res.json({ status: "ok", mensagens_deletadas: deletadas });
});

// ========== SOCKET.IO (USADO EXCLUSIVAMENTE PELO PAINEL WEB) ==========
// ========== SOCKET.IO (CALIBRADO COM A REGRA ALFABÉTICA DO APP) ==========
io.on('connection', (socket) => {
    socket.on('envia_mensagem', (dados) => {
        let { id, chat_id, usuario, texto } = dados;
        const timestamp = Date.now();
        if (!id) id = timestamp + "_" + Math.floor(Math.random() * 9999);
        
        let remetente = usuario ? usuario.trim().toLowerCase() : "admin_web";
        let destinatario = "";
        let chatIdValido = "";

        // Se veio do painel web apontando para um contato específico
        if (chat_id && chat_id.startsWith("Contato_")) {
            destinatario = chat_id.replace("Contato_", "").trim().toLowerCase();
            
            // IGUAL AO APP: Organiza em ordem alfabética para bater o ID unificado
            const listaEmails = [remetente, destinatario].sort();
            chatIdValido = "Contato_" + listaEmails[0] + "_" + listaEmails[1];
        } else {
            chatIdValido = chat_id || "Contato_Geral";
            destinatario = "geral";
        }

        const msgCompleta = { 
            id: id, 
            chat_id: chatIdValido, 
            email_contato: remetente, // Define quem mandou a mensagem
            usuario: remetente, 
            texto: texto, 
            timestamp: timestamp 
        };
        
        historico.push(msgCompleta);
        io.emit('recebe_mensagem', msgCompleta); 
        console.log(`✉️ [WEB ADMIN] Mensagem injetada no ChatId: ${chatIdValido}`);
    });
});

// ========== PAINEL WEB ATUALIZADO ==========
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
                    <label style="font-size:12px; color:#666; font-weight:bold;">Para quem vai a mensagem? (E-mail logado no celular)</label>
                    <input id="c" placeholder="Ex: meu_celular@teste.com">
                    
                    <label style="font-size:12px; color:#666; font-weight:bold;">Quem está enviando? (Conta fake de teste)</label>
                    <input id="u" placeholder="Ex: amigodeteste@teste.com">
                    
                    <label style="font-size:12px; color:#666; font-weight:bold;">Mensagem</label>
                    <input id="m" placeholder="Digite o texto aqui">
                    
                    <button onclick="enviarPelaWeb()">Enviar para o Celular</button>
                    <div id="chat"></div>
                </div>
                <script src="/socket.io/socket.io.js"></script>
                <script>
                    const socket = io();
                    function enviarPelaWeb() {
                        if(!c.value || !u.value || !m.value) return alert("Preencha todos os campos para simular as duas contas!");
                        socket.emit('envia_mensagem', {
                            id: "web_" + Date.now() + "_" + Math.floor(Math.random() * 999),
                            chat_id: "Contato_" + c.value.trim(),
                            usuario: u.value.trim(),
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

// ========== INICIAR SERVIDOR ==========
http.listen(3000, '0.0.0.0', () => {
    console.log('🟢 Servidor rodando na porta 3000');
    console.log('📁 Pasta de usuários:', PASTA_USUARIOS);
    console.log('📸 Pasta de fotos:', PASTA_UPLOADS);
});

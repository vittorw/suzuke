// mensagem.js - Sistema de mensagem programada independente por grupo (Envio a cada 1 hora)
const fs = require('fs');

const ARQUIVO_DADOS = './mensagens_programadas.json';
const sessoes = new Map();

function carregarDados() {
    try {
        if (!fs.existsSync(ARQUIVO_DADOS)) return {};
        const dados = JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
        return dados && typeof dados === 'object' ? dados : {};
    } catch (e) { return {}; }
}

function salvarDados() {
    try {
        const dados = {};
        for (const [chatId, sessao] of sessoes.entries()) {
            dados[chatId] = {
                mensagem: sessao.mensagem || '',
                ativo: !!sessao.ativo,
                ultimaMensagemId: sessao.ultimaMensagemId || null
            };
        }
        fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
    } catch (e) {}
}

const salvos = carregarDados();
for (const [chatId, dados] of Object.entries(salvos)) {
    sessoes.set(chatId, {
        mensagem: dados.mensagem || '',
        intervaloId: null,
        ultimaMensagemId: dados.ultimaMensagemId || null,
        ativo: !!dados.ativo
    });
}

function iniciarIntervalo(sock, chatId, sessao) {
    if (sessao.intervaloId) return;
    sessao.ativo = true;
    sessao.intervaloId = setInterval(async () => {
        try {
            if (!sessao.mensagem || sessao.mensagem.trim() === '') return;
            if (sessao.ultimaMensagemId) {
                try { await sock.sendMessage(chatId, { delete: sessao.ultimaMensagemId }); } catch (err) {}
            }
            const sentMsg = await sock.sendMessage(chatId, { text: sessao.mensagem });
            sessao.ultimaMensagemId = {
                remoteJid: chatId,
                id: sentMsg.key.id,
                fromMe: true
            };
            salvarDados();
        } catch (error) {
            console.error('Erro no ciclo de envio automático:', error);
        }
    }, 3600000);
    salvarDados();
}

async function restaurarMensagens(sock) {
    for (const [chatId, sessao] of sessoes.entries()) {
        if (sessao.ativo && sessao.mensagem) iniciarIntervalo(sock, chatId, sessao);
    }
}

module.exports = async (sock, msg) => {
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const chatId = msg.key.remoteJid;

    if (!sessoes.has(chatId)) {
        sessoes.set(chatId, { mensagem: '', intervaloId: null, ultimaMensagemId: null, ativo: false });
    }

    const sessao = sessoes.get(chatId);

    if (text.startsWith('!mensagempg')) {
        const conteudo = text.slice(11).trim();
        if (!conteudo) {
            await sock.sendMessage(chatId, { text: `⚠️ *Por favor, insira a mensagem que deseja programar!*\n\nUse: *!mensagempg [sua mensagem]*` }, { quoted: msg });
            return;
        }
        sessao.mensagem = conteudo;
        salvarDados();
        await sock.sendMessage(chatId, { text: `✅ *Mensagem programada atualizada com sucesso!*\n\n"${sessao.mensagem}"` }, { quoted: msg });
        return;
    }

    if (text === '!cancelarmsg') {
        if (!sessao.intervaloId && !sessao.ativo) {
            await sock.sendMessage(chatId, { text: `⚠️ *O envio automático não está ativado neste grupo!*` }, { quoted: msg });
            return;
        }
        if (sessao.intervaloId) clearInterval(sessao.intervaloId);
        sessao.intervaloId = null;
        sessao.ativo = false;
        sessao.ultimaMensagemId = null;
        salvarDados();
        await sock.sendMessage(chatId, { text: '🛑 *Automação encerrada com sucesso!*' }, { quoted: msg });
        return;
    }

    if (text === '!mensagem') {
        if (sessao.intervaloId || sessao.ativo) {
            if (!sessao.intervaloId) iniciarIntervalo(sock, chatId, sessao);
            await sock.sendMessage(chatId, { text: `⚠️ *O envio automático já está ativado neste grupo!*` }, { quoted: msg });
            return;
        }
        await sock.sendMessage(chatId, { text: '✅ *Automação iniciada!*' }, { quoted: msg });
        iniciarIntervalo(sock, chatId, sessao);
    }
};

module.exports.restaurarMensagens = restaurarMensagens;

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

let ffmpegPath = 'ffmpeg';
try {
    ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (e) {
    try {
        ffmpegPath = require('ffmpeg-static');
    } catch (e2) {}
}

function desembrulharMensagem(mensagem) {
    let atual = mensagem;
    for (let i = 0; i < 5 && atual; i++) {
        if (atual.ephemeralMessage?.message) atual = atual.ephemeralMessage.message;
        else if (atual.viewOnceMessage?.message) atual = atual.viewOnceMessage.message;
        else if (atual.viewOnceMessageV2?.message) atual = atual.viewOnceMessageV2.message;
        else if (atual.viewOnceMessageV2Extension?.message) atual = atual.viewOnceMessageV2Extension.message;
        else break;
    }
    return atual;
}

function criarMensagemCitacao(from, quoted) {
    return {
        key: {
            remoteJid: from,
            id: quoted.stanzaId,
            participant: quoted.participant || from,
            fromMe: false
        },
        message: desembrulharMensagem(quoted.quotedMessage)
    };
}

async function tratarSticker(sock, from, msg, comando, args) {
    try {
        const contexto = msg.message?.extendedTextMessage?.contextInfo;
        const quoted = contexto?.quotedMessage ? contexto : null;

        let messageToDownload = msg;
        if (quoted) {
            messageToDownload = criarMensagemCitacao(from, quoted);
        }

        let innerMsg = desembrulharMensagem(messageToDownload.message);
        if (!innerMsg) {
            await sock.sendMessage(from, { text: `⚠️ Responda a uma imagem ou vídeo com *!s*.` }, { quoted: msg });
            return;
        }
        messageToDownload.message = innerMsg;

        const ehImagem = !!innerMsg.imageMessage;
        const ehVideo = !!innerMsg.videoMessage;
        if (!ehImagem && !ehVideo) {
            await sock.sendMessage(from, { text: `⚠️ Responda a uma imagem ou vídeo com *!s*.` }, { quoted: msg });
            return;
        }

        const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {});
        if (!buffer || !buffer.length) {
            await sock.sendMessage(from, { text: `❌ Não consegui baixar a imagem/vídeo respondido.` }, { quoted: msg });
            return;
        }

        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const extensaoEntrada = ehVideo ? 'mp4' : 'jpg';
        const tempIn = path.resolve(`./temp_sticker_${id}.${extensaoEntrada}`);
        const tempOut = path.resolve(`./temp_sticker_${id}.webp`);
        fs.writeFileSync(tempIn, buffer);

        const filtros = ehVideo
            ? `scale=320:320,setsar=1,fps=15`
            : `scale=512:512,setsar=1`;
        const comandoFfmpeg = `"${ffmpegPath}" -y -i "${tempIn}" -vcodec libwebp -vf "${filtros}" -an -lossless 0 -q:v 60 "${tempOut}"`;

        exec(comandoFfmpeg, async (err, stdout, stderr) => {
            try {
                if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                if (err) {
                    console.log('❌ Erro no FFmpeg da figurinha:', stderr || err.message);
                    await sock.sendMessage(from, { text: `❌ Erro ao converter a mídia em figurinha. Verifique se o FFmpeg está instalado.` }, { quoted: msg });
                    return;
                }
                if (!fs.existsSync(tempOut)) {
                    await sock.sendMessage(from, { text: `❌ O FFmpeg não gerou a figurinha.` }, { quoted: msg });
                    return;
                }
                const stickerBuff = fs.readFileSync(tempOut);
                await sock.sendMessage(from, { sticker: stickerBuff, isAnimated: ehVideo }, { quoted: msg });
            } catch (e) {
                console.log('❌ Erro ao enviar figurinha:', e);
                try { await sock.sendMessage(from, { text: `❌ Não consegui enviar a figurinha.` }, { quoted: msg }); } catch (e2) {}
            } finally {
                try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (e) {}
            }
        });
    } catch (err) {
        console.log('❌ Erro no !s:', err);
        await sock.sendMessage(from, { text: `❌ Falha ao processar a mídia. Responda diretamente a uma imagem ou vídeo e tente novamente.` }, { quoted: msg });
    }
}

async function tratarToImg(sock, from, msg) {
    try {
        const contexto = msg.message?.extendedTextMessage?.contextInfo;
        if (!contexto?.quotedMessage?.stickerMessage) {
            await sock.sendMessage(from, { text: `⚠️ Responda a uma figurinha com *!toimg*` }, { quoted: msg });
            return;
        }
        const messageToDownload = criarMensagemCitacao(from, contexto);
        const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {});
        if (!buffer) {
            await sock.sendMessage(from, { text: `❌ Falha ao baixar a figurinha.` }, { quoted: msg });
            return;
        }
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const tempIn = path.resolve(`./temp_toimg_${id}.webp`);
        const tempOut = path.resolve(`./temp_toimg_${id}.png`);
        fs.writeFileSync(tempIn, buffer);
        exec(`"${ffmpegPath}" -y -i "${tempIn}" "${tempOut}"`, async (err) => {
            try {
                if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
                if (err || !fs.existsSync(tempOut)) {
                    await sock.sendMessage(from, { text: `❌ Erro ao converter figurinha para imagem.` }, { quoted: msg });
                    return;
                }
                await sock.sendMessage(from, { image: fs.readFileSync(tempOut), caption: 'Aqui está sua imagem!' }, { quoted: msg });
            } finally {
                try { if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut); } catch (e) {}
            }
        });
    } catch (e) {
        await sock.sendMessage(from, { text: `❌ Erro ao processar.` }, { quoted: msg });
    }
}

module.exports = { tratarSticker, tratarToImg };

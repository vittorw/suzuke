const fetch = require('node-fetch');

async function tratarTikTok(sock, from, msg, comando, args) {
    const url = args[0];
    if (!url || !url.includes('tiktok.com')) {
        await sock.sendMessage(from, { text: `⚠️ Cole um link válido do TikTok!` }, { quoted: msg });
        return true;
    }

    await sock.sendMessage(from, { text: `⏳ Processando mídia do TikTok...` }, { quoted: msg });

    let mediaUrl = null;

    // Tentativa 1: API TikWM (Principal)
    try {
        const res = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`);
        const json = await res.json();
        if (comando === 'tiktok') {
            mediaUrl = json?.data?.hdplay || json?.data?.play;
        } else {
            mediaUrl = json?.data?.music;
        }
    } catch (e) {}

    // Tentativa 2: API TiklyDown (Reserva caso a principal falhe)
    if (!mediaUrl) {
        try {
            const res = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`);
            const json = await res.json();
            if (comando === 'tiktok') {
                mediaUrl = json?.video?.noWatermark || json?.video?.watermark;
            } else {
                mediaUrl = json?.music?.play_url;
            }
        } catch (e) {}
    }

    if (mediaUrl) {
        if (comando === 'tiktok') {
            await sock.sendMessage(from, { video: { url: mediaUrl }, caption: `✅ *Vídeo do TikTok baixado com sucesso!*` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { audio: { url: mediaUrl }, mimetype: 'audio/mp4', ptt: false }, { quoted: msg });
        }
    } else {
        await sock.sendMessage(from, { text: `❌ Não foi possível baixar o TikTok no momento. Verifique o link.` }, { quoted: msg });
    }

    return true;
}

module.exports = { tratarTikTok };

const fetch = require('node-fetch');

async function tratarTwitter(sock, from, msg, comando, args) {
    const url = args[0];
    if (!url || (!url.includes('twitter.com') && !url.includes('x.com'))) {
        await sock.sendMessage(from, { text: `⚠️ Cole um link válido do Twitter/X!` }, { quoted: msg });
        return true;
    }
    await sock.sendMessage(from, { text: `⏳ Processando mídia do Twitter/X...` }, { quoted: msg });

    let mediaUrl = null;
    let isAudio = (comando === 'twitter2');

    // Tentativa 1: API FixTweet (Altamente estável)
    try {
        let cleanUrl = url.split('?')[0];
        cleanUrl = cleanUrl.replace('twitter.com', 'api.fxtwitter.com').replace('x.com', 'api.fxtwitter.com');
        
        const res = await fetch(cleanUrl);
        const json = await res.json();

        if (json && json.code === 200 && json.tweet) {
            const tweet = json.tweet;
            if (tweet.media && tweet.media.videos && tweet.media.videos.length > 0) {
                mediaUrl = tweet.media.videos[0].url;
            }
        }
    } catch (e) {
        console.log("Erro FixTweet:", e.message);
    }

    // Tentativa 2: Fallback com API externa caso o tweet não tenha vídeo direto
    if (!mediaUrl) {
        try {
            const res = await fetch(`https://api.ryzendesu.vip/api/downloader/twitter?url=${encodeURIComponent(url)}`);
            const json = await res.json();
            mediaUrl = isAudio ? (json?.data?.audio || json?.audio) : (json?.data?.video || json?.url);
        } catch (e) {}
    }

    if (mediaUrl) {
        try {
            if (isAudio) {
                await sock.sendMessage(from, { audio: { url: mediaUrl }, mimetype: 'audio/mp4', ptt: false }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { video: { url: mediaUrl }, caption: `✅ *Vídeo do Twitter/X baixado!*` }, { quoted: msg });
            }
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Erro ao enviar a mídia. O arquivo pode ser pesado demais para o WhatsApp.` }, { quoted: msg });
        }
    } else {
        await sock.sendMessage(from, { text: `❌ Não foi possível baixar. Certifique-se de que o link enviado é de um tweet que contenha um vídeo.` }, { quoted: msg });
    }
    return true;
}

module.exports = { tratarTwitter };

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const yt = require('@vreden/youtube_scraper');

const escolhasYouTube = new Map();

function chaveEscolha(from, msg) {
    const participante = msg?.key?.participant || msg?.key?.remoteJid || from;
    return `${from}:${participante}`;
}

function localizarYtDlp() {
    const candidatos = [
        process.env.YTDLP_PATH,
        path.join(process.cwd(), 'node_modules', '@distube', 'yt-dlp', 'bin', 'yt-dlp'),
        path.join(process.cwd(), 'node_modules', '@distube', 'yt-dlp', 'yt-dlp'),
        'yt-dlp'
    ].filter(Boolean);
    for (const candidato of candidatos) {
        try {
            if (candidato === 'yt-dlp' || fs.existsSync(candidato)) return candidato;
        } catch (e) {}
    }
    return null;
}

function executarYtDlp(bin, args) {
    return new Promise((resolve, reject) => {
        const processo = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        processo.stdout.on('data', d => { stdout += d.toString(); });
        processo.stderr.on('data', d => { stderr += d.toString(); });
        processo.on('error', reject);
        processo.on('close', codigo => {
            if (codigo === 0) resolve({ stdout, stderr });
            else reject(new Error(stderr || `yt-dlp encerrou com código ${codigo}`));
        });
    });
}

function formatarDuracao(segundos) {
    const total = Number(segundos) || 0;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = Math.floor(total % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function montarInfoMusica(info, url) {
    const titulo = info?.title || info?.fulltitle || 'Não informado';
    const canal = info?.channel || info?.uploader || 'Não informado';
    const duracao = formatarDuracao(info?.duration);
    const visualizacoes = Number(info?.view_count);
    const data = info?.upload_date ? `${info.upload_date.slice(6, 8)}/${info.upload_date.slice(4, 6)}/${info.upload_date.slice(0, 4)}` : 'Não informado';
    const visual = Number.isFinite(visualizacoes) ? visualizacoes.toLocaleString('pt-BR') : 'Não informado';
    const thumbnail = info?.thumbnail;
    return {
        titulo,
        canal,
        duracao,
        visualizacoes: visual,
        data,
        url,
        thumbnail
    };
}

function limparEscolha(from, msg) {
    const chave = chaveEscolha(from, msg);
    const existente = escolhasYouTube.get(chave);
    if (existente?.timer) clearTimeout(existente.timer);
    escolhasYouTube.delete(chave);
}

function salvarEscolha(from, msg, dados) {
    const chave = chaveEscolha(from, msg);
    const anterior = escolhasYouTube.get(chave);
    if (anterior?.timer) clearTimeout(anterior.timer);
    const timer = setTimeout(() => escolhasYouTube.delete(chave), 5 * 60 * 1000);
    escolhasYouTube.set(chave, { ...dados, timer });
}

async function buscarVideo(busca) {
    if (busca.includes('youtube.com') || busca.includes('youtu.be')) return busca;
    try {
        const searchResults = await yt.search(busca);
        if (searchResults?.results?.length > 0) return searchResults.results[0].url;
    } catch (e) {
        console.log('Erro na busca do YouTube pelo scraper:', e.message);
    }
    try {
        const res = await fetch(`https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(busca)}`);
        const json = await res.json();
        return json?.data?.[0]?.url || json?.results?.[0]?.url || null;
    } catch (e) {
        console.log('Erro no fallback de busca do YouTube:', e.message);
        return null;
    }
}

async function obterInfoVideo(bin, videoUrl, busca) {
    let info = null;
    if (bin) {
        try {
            const resultadoInfo = await executarYtDlp(bin, [
                '--dump-single-json',
                '--no-playlist',
                '--skip-download',
                '--no-warnings',
                videoUrl
            ]);
            info = JSON.parse(resultadoInfo.stdout);
        } catch (e) {
            console.log('Erro ao obter informações com yt-dlp:', e.message);
        }
    }

    if (!info) {
        try {
            const searchResults = await yt.search(busca);
            const encontrado = searchResults?.results?.find(r => r.url === videoUrl) || searchResults?.results?.[0];
            if (encontrado) {
                info = {
                    title: encontrado.title,
                    channel: encontrado.author || encontrado.channel,
                    duration: encontrado.duration?.seconds || encontrado.duration,
                    view_count: encontrado.views,
                    thumbnail: encontrado.thumbnail
                };
            }
        } catch (e) {}
    }
    return info;
}

function textoInformacoes(dados) {
    return `🎵 *INFORMAÇÕES DA MÚSICA*\n\n` +
        `🎶 *Título:* ${dados.titulo}\n` +
        `👤 *Canal:* ${dados.canal}\n` +
        `⏱️ *Duração:* ${dados.duracao}\n` +
        `👁️ *Visualizações:* ${dados.visualizacoes}\n` +
        `📅 *Publicada em:* ${dados.data}\n` +
        `🔗 *YouTube:* ${dados.url}\n\n` +
        `⬇️ *Escolha o que deseja baixar:*`;
}

async function baixarAudioYtDlp(bin, videoUrl, titulo) {
    const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-youtube-audio-'));
    const base = path.join(pastaTemp, 'musica');
    try {
        const argsDlp = [
            '--no-playlist',
            '--no-warnings',
            '-f', 'bestaudio/best',
            '--extract-audio',
            '--audio-format', 'mp3',
            '--audio-quality', '128K',
            '-o', `${base}.%(ext)s`,
            videoUrl
        ];
        const ffmpegBin = (() => {
            try { return require('@ffmpeg-installer/ffmpeg').path; } catch (e) { return null; }
        })();
        if (ffmpegBin) argsDlp.splice(9, 0, '--ffmpeg-location', path.dirname(ffmpegBin));
        await executarYtDlp(bin, argsDlp);
        const possiveis = fs.readdirSync(pastaTemp).filter(nome => /^musica\.(mp3|m4a|webm|opus)$/i.test(nome));
        if (!possiveis.length) return null;
        return { arquivo: path.join(pastaTemp, possiveis[0]), pastaTemp, titulo };
    } catch (e) {
        console.log('Erro no download do áudio com yt-dlp:', e.message);
        try { fs.rmSync(pastaTemp, { recursive: true, force: true }); } catch (err) {}
        return null;
    }
}

async function baixarVideoYtDlp(bin, videoUrl, titulo) {
    const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-youtube-video-'));
    const base = path.join(pastaTemp, 'clipe');
    try {
        const argsDlp = [
            '--no-playlist',
            '--no-warnings',
            '-f', 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[ext=mp4]/best',
            '--merge-output-format', 'mp4',
            '-o', `${base}.%(ext)s`,
            videoUrl
        ];
        const ffmpegBin = (() => {
            try { return require('@ffmpeg-installer/ffmpeg').path; } catch (e) { return null; }
        })();
        if (ffmpegBin) argsDlp.splice(5, 0, '--ffmpeg-location', path.dirname(ffmpegBin));
        await executarYtDlp(bin, argsDlp);
        const possiveis = fs.readdirSync(pastaTemp).filter(nome => /^clipe\.(mp4|mkv|webm)$/i.test(nome));
        if (!possiveis.length) return null;
        return { arquivo: path.join(pastaTemp, possiveis[0]), pastaTemp, titulo };
    } catch (e) {
        console.log('Erro no download do clipe com yt-dlp:', e.message);
        try { fs.rmSync(pastaTemp, { recursive: true, force: true }); } catch (err) {}
        return null;
    }
}

async function baixarAudioFallback(videoUrl) {
    let audioUrl = null;
    try {
        const result = await yt.ytmp3(videoUrl, 128);
        if (result?.download?.url) audioUrl = result.download.url;
    } catch (e) {
        console.log('Erro no yt.ytmp3:', e.message);
    }
    if (!audioUrl) {
        try {
            const res = await fetch(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`);
            const json = await res.json();
            audioUrl = json?.result?.download?.url || json?.result?.music;
        } catch (e) {
            console.log('Erro na API vreden:', e.message);
        }
    }
    if (!audioUrl) {
        try {
            const res = await fetch(`https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`);
            const json = await res.json();
            audioUrl = json?.url || json?.download?.url;
        } catch (e) {
            console.log('Erro na API ryzendesu:', e.message);
        }
    }
    return audioUrl;
}

async function tratarYouTube(sock, from, msg, comando, args) {
    if (!args.length) {
        await sock.sendMessage(from, { text: `⚠️ Digite o nome ou link da música!\nExemplo: *!play nome da musica*` }, { quoted: msg });
        return true;
    }

    const busca = args.join(' ');
    await sock.sendMessage(from, { text: `🔍 Buscando música: *${busca}*...` }, { quoted: msg });

    try {
        const videoUrl = await buscarVideo(busca);
        if (!videoUrl) {
            await sock.sendMessage(from, { text: `❌ Não encontrei essa música no YouTube.` }, { quoted: msg });
            return true;
        }

        const bin = localizarYtDlp();
        const info = await obterInfoVideo(bin, videoUrl, busca);
        const dados = montarInfoMusica(info, videoUrl);

        await sock.sendMessage(from, {
            text: textoInformacoes(dados).replace(/\n\n⬇️ \*Escolha o que deseja baixar:\*/, '')
        }, { quoted: msg });
        await sock.sendMessage(from, { text: `⬇️ Baixando o áudio...\n🎵 *${dados.titulo}*` }, { quoted: msg });

        if (bin) {
            const resultado = await baixarAudioYtDlp(bin, videoUrl, dados.titulo);
            if (resultado?.arquivo) {
                try {
                    await sock.sendMessage(from, {
                        audio: { url: resultado.arquivo },
                        mimetype: 'audio/mpeg',
                        ptt: false,
                        fileName: `${dados.titulo.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100)}.mp3`
                    }, { quoted: msg });
                    try { fs.rmSync(resultado.pastaTemp, { recursive: true, force: true }); } catch (e) {}
                    return true;
                } catch (e) {
                    console.log('Erro ao enviar o áudio:', e.message);
                }
                try { fs.rmSync(resultado.pastaTemp, { recursive: true, force: true }); } catch (e) {}
            }
        }

        try {
            const audioUrl = await baixarAudioFallback(videoUrl);
            if (audioUrl) {
                await sock.sendMessage(from, { audio: { url: audioUrl }, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
                return true;
            }
        } catch (e) {
            console.log('Erro no fallback do áudio:', e.message);
        }

        await sock.sendMessage(from, { text: `❌ Não foi possível baixar o áudio no momento. O YouTube ou o método de download pode estar bloqueando esta solicitação.` }, { quoted: msg });
        return true;
    } catch (e) {
        console.log('Erro geral na preparação do YouTube:', e.message);
        await sock.sendMessage(from, { text: `❌ Não foi possível preparar o download desta música no momento.` }, { quoted: msg });
        return true;
    }
}

module.exports = { tratarYouTube };

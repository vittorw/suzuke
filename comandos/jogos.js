const fs = require('fs');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

// Configurações Globais dos Jogos e Modos
const CONFIG = {
    prefixo: '!', 
    grupoAlvoPPP: '120363408643997247@g.us',
    grupoAlvoMA: '120363408643997247@g.us',
    pppAtivo: false,
    maAtivo: false,
    tempoEsperaFila: 12000
};

// Armazenamento em memória dos jogos
const participantesPPP = new Map();
const participantesMA = new Map();
let filaPPP = [];
let processandoFilaPPP = false;

let filaMA = [];
let processandoFilaMA = false;

const partidasBomba = new Map(); 
const charadasAtivas = new Map(); 
const quemsoueuAtivos = new Map(); 
const economia = new Map(); 

// --- PROCESSADORES DE FILA DO PPP E MENSAGENS ANÔNIMAS ---
async function tratarFilaPPP(sock) {
    if (processandoFilaPPP || filaPPP.length === 0) return;
    processandoFilaPPP = true;
    while (filaPPP.length > 0) {
        if (!CONFIG.pppAtivo) {
            filaPPP = []; 
            break;
        }
        const item = filaPPP.shift(); 
        try {
            console.log(`📦 [FILA PPP] Processando mídia de: ${item.nomeUsuario}`);
            
            if (item.tipo === 'image') {
                await sock.sendMessage(CONFIG.grupoAlvoPPP, { image: fs.readFileSync(item.caminho), caption: item.caption || '' });
            } else if (item.tipo === 'video') {
                await sock.sendMessage(CONFIG.grupoAlvoPPP, { video: fs.readFileSync(item.caminho), caption: item.caption || '', gifPlayback: item.isGif || false });
            }

            if (fs.existsSync(item.caminho)) {
                fs.unlinkSync(item.caminho);
            }

            await sock.sendMessage(CONFIG.grupoAlvoPPP, {
                poll: {
                    name: 'Pego, Penso ou Passo?',
                    values: ['Pego 😈', 'Penso 🤔', 'Passo ❌'],
                    selectableCount: 1 
                }
            });
            await new Promise(resolve => setTimeout(resolve, 12000));
        } catch (err) {
            console.error('Falha ao processar fila do PPP:', err);
            if (fs.existsSync(item.caminho)) {
                fs.unlinkSync(item.caminho);
            }
        }
    }
    processandoFilaPPP = false;
}

async function tratarFilaMA(sock) {
    if (processandoFilaMA || filaMA.length === 0) return;
    processandoFilaMA = true;
    while (filaMA.length > 0) {
        if (!CONFIG.maAtivo) {
            filaMA = []; 
            break;
        }
        const item = filaMA.shift(); 
        try {
            console.log(`🕵️ [FILA MA] Processando mensagem anônima de: ${item.nomeUsuario}`);
            await sock.sendMessage(CONFIG.grupoAlvoMA, { text: `🕵️ *MENSAGEM ANÔNIMA:*` });

            if (item.tipo === 'text') {
                await sock.sendMessage(CONFIG.grupoAlvoMA, { text: item.text });
            } else if (item.tipo === 'image' && item.caminho && fs.existsSync(item.caminho)) {
                await sock.sendMessage(CONFIG.grupoAlvoMA, { image: fs.readFileSync(item.caminho), caption: item.caption || '' });
            } else if (item.tipo === 'video' && item.caminho && fs.existsSync(item.caminho)) {
                await sock.sendMessage(CONFIG.grupoAlvoMA, { video: fs.readFileSync(item.caminho), caption: item.caption || '', gifPlayback: item.isGif || false });
            } else if (item.msg) {
                await sock.sendMessage(CONFIG.grupoAlvoMA, { forward: item.msg });
            }

            if (item.caminho && fs.existsSync(item.caminho)) {
                fs.unlinkSync(item.caminho);
            }

            await new Promise(resolve => setTimeout(resolve, 12000));
        } catch (err) {
            console.error('Falha ao processar mensagem anônima:', err);
            if (item.caminho && fs.existsSync(item.caminho)) {
                fs.unlinkSync(item.caminho);
            }
        }
    }
    processandoFilaMA = false;
}

// Interceptador para mídias/mensagens enviadas no Privado (PV)
async function tratarPrivadoJogos(sock, msg, numeroPuroRemetente, nomeUsuario, isDono) {
    const jidRemetente = `${numeroPuroRemetente}@s.whatsapp.net`;

    if (isDono) return false;

    const imgMsg = msg.message?.imageMessage;
    const vidMsg = msg.message?.videoMessage;
    const eMidiaNormal = imgMsg || vidMsg;

    if (CONFIG.pppAtivo) {
        const countPPP = participantesPPP.get(numeroPuroRemetente) || 0;
        if (countPPP >= 2) return true;

        if (eMidiaNormal) {
            participantesPPP.set(numeroPuroRemetente, countPPP + 1);

            try {
                let messageToDownload = msg;
                const quoted = msg.message?.extendedTextMessage?.contextInfo;
                if (quoted && quoted.quotedMessage) {
                    messageToDownload = {
                        key: {
                            remoteJid: msg.key.remoteJid,
                            id: quoted.stanzaId,
                            participant: quoted.participant || msg.key.remoteJid
                        },
                        message: quoted.quotedMessage
                    };
                }

                let innerMsg = messageToDownload.message;
                if (innerMsg) {
                    if (innerMsg.ephemeralMessage?.message) innerMsg = innerMsg.ephemeralMessage.message;
                    if (innerMsg.viewOnceMessage?.message) innerMsg = innerMsg.viewOnceMessage.message;
                    if (innerMsg.viewOnceMessageV2?.message) innerMsg = innerMsg.viewOnceMessageV2.message;
                    messageToDownload.message = innerMsg;
                }

                const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {});
                if (!buffer) {
                    await sock.sendMessage(msg.key.remoteJid, { text: `❌ Falha ao baixar a mídia.` });
                    return true;
                }

                const isVideo = !!innerMsg.videoMessage;
                const ext = isVideo ? 'mp4' : 'jpg';
                const caminhoTemp = `./temp_ppp_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                fs.writeFileSync(caminhoTemp, buffer);

                filaPPP.push({
                    tipo: isVideo ? 'video' : 'image',
                    caminho: caminhoTemp,
                    caption: innerMsg.imageMessage?.caption || innerMsg.videoMessage?.caption || '',
                    isGif: innerMsg.videoMessage?.gifPlayback || false,
                    nomeUsuario
                });

                tratarFilaPPP(sock);
            } catch (err) {
                console.error('Erro ao baixar mídia do PPP:', err);
            }

            return true;
        }
    }

    if (CONFIG.maAtivo) {
        const countMA = participantesMA.get(numeroPuroRemetente) || 0;
        if (countMA >= 5) return true;
        participantesMA.set(numeroPuroRemetente, countMA + 1);

        try {
            let messageToDownload = msg;
            const quoted = msg.message?.extendedTextMessage?.contextInfo;
            if (quoted && quoted.quotedMessage) {
                messageToDownload = {
                    key: {
                        remoteJid: msg.key.remoteJid,
                        id: quoted.stanzaId,
                        participant: quoted.participant || msg.key.remoteJid
                    },
                    message: quoted.quotedMessage
                };
            }

            let innerMsg = messageToDownload.message;
            if (innerMsg) {
                if (innerMsg.ephemeralMessage?.message) innerMsg = innerMsg.ephemeralMessage.message;
                if (innerMsg.viewOnceMessage?.message) innerMsg = innerMsg.viewOnceMessage.message;
                if (innerMsg.viewOnceMessageV2?.message) innerMsg = innerMsg.viewOnceMessageV2.message;
                messageToDownload.message = innerMsg;
            }

            let tipo = 'text';
            let caminhoTemp = null;
            let textoMsg = msg.message?.conversation || msg.message?.extendedTextMessage?.text || innerMsg?.imageMessage?.caption || innerMsg?.videoMessage?.caption || '';

            if (innerMsg?.imageMessage || innerMsg?.videoMessage) {
                const buffer = await downloadMediaMessage(messageToDownload, 'buffer', {});
                if (buffer) {
                    const isVideo = !!innerMsg.videoMessage;
                    tipo = isVideo ? 'video' : 'image';
                    const ext = isVideo ? 'mp4' : 'jpg';
                    caminhoTemp = `./temp_ma_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
                    fs.writeFileSync(caminhoTemp, buffer);
                }
            }

            filaMA.push({
                tipo,
                caminho: caminhoTemp,
                text: textoMsg,
                caption: innerMsg.imageMessage?.caption || innerMsg.videoMessage?.caption || '',
                isGif: innerMsg.videoMessage?.gifPlayback || false,
                msg,
                nomeUsuario
            });

            tratarFilaMA(sock);
        } catch (err) {
            console.error('Erro ao processar mensagem anônima:', err);
        }

        return true;
    }

    return false;
}

// Respostas interativas globais (Charada / Quem Sou Eu)
async function checarRespostasInterativas(sock, from, isGroup, textoMinusculo, numeroPuroRemetente, jid) {
    if (!isGroup) return;

    if (charadasAtivas.has(from)) {
        const charada = charadasAtivas.get(from);
        if (textoMinusculo.includes(charada.resposta)) {
            charadasAtivas.delete(from);
            await sock.sendMessage(from, { 
                text: `🎉 Parabéns @${numeroPuroRemetente}! Você acertou a charada! (Resposta: *${charada.resposta}*)`,
                mentions: [jid]
            });
        }
    }

    if (quemsoueuAtivos.has(from)) {
        const qse = quemsoueuAtivos.get(from);
        if (textoMinusculo.includes(qse.resposta)) {
            quemsoueuAtivos.delete(from);
            await sock.sendMessage(from, { 
                text: `🎉 Sensacional @${numeroPuroRemetente}! Você adivinhou o personagem! (Resposta: *${qse.resposta}*)`,
                mentions: [jid]
            });
        }
    }
}

// Execução centralizada dos comandos de jogos e modos especiais
async function executarComandoJogo(sock, from, comando, args, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, isDono, isAdm) {

    if (comando === 'iniciarppp') {
        if (CONFIG.pppAtivo) {
            await sock.sendMessage(from, { text: `⚠️ *O Jogo PPP já está em andamento!*` });
            return true;
        }
        if (CONFIG.maAtivo) {
            await sock.sendMessage(from, { text: `⚠️ *As Mensagens Anônimas já estão em andamento!*` });
            return true;
        }
        CONFIG.pppAtivo = true;
        await sock.sendMessage(from, { text: `📦 *JOGO PPP INICIADO!* \n\n📥 Mandem mídias no meu PV!` });
        return true;
    }

    if (comando === 'encerrarppp') {
        if (!CONFIG.pppAtivo) {
            await sock.sendMessage(from, { text: `⚠️ *Não há nenhum Jogo PPP em andamento!*` });
            return true;
        }
        CONFIG.pppAtivo = false;
        filaPPP = []; 
        participantesPPP.clear(); 
        await sock.sendMessage(from, { text: `🛑 *JOGO PPP ENCERRADO!* \n\n🔒 Fila limpa e privado bloqueado.` });
        return true;
    }

    if (comando === 'grupoppp') {
        const novoGrupo = args[0];
        if (!novoGrupo || !novoGrupo.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: `⚠️ Use: !grupoppp [ID]@g.us` });
            return true;
        }
        CONFIG.grupoAlvoPPP = novoGrupo;
        await sock.sendMessage(from, { text: `✅ Grupo do PPP alterado para:\n👉 \`${novoGrupo}\`` });
        return true;
    }

    if (comando === 'iniciarmm') {
        if (CONFIG.maAtivo) {
            await sock.sendMessage(from, { text: `⚠️ *As Mensagens Anônimas já estão em andamento!*` });
            return true;
        }
        if (CONFIG.pppAtivo) {
            await sock.sendMessage(from, { text: `⚠️ *O Jogo PPP já está em andamento!*` });
            return true;
        }
        CONFIG.maAtivo = true;
        await sock.sendMessage(from, { text: `🕵️ *MENSAGENS ANÔNIMAS INICIADAS!* \n\n📥 Envie mídias/mensagens no PV para serem enviadas no grupo!` });
        return true;
    }

    if (comando === 'encerrarmm') {
        if (!CONFIG.maAtivo) {
            await sock.sendMessage(from, { text: `⚠️ *Não há Mensagens Anônimas em andamento!*` });
            return true;
        }
        CONFIG.maAtivo = false;
        filaMA = [];
        participantesMA.clear();
        await sock.sendMessage(from, { text: `🛑 *MENSAGENS ANÔNIMAS ENCERRADAS!*` });
        return true;
    }

    if (comando === 'grupomm') {
        const novoGrupoMA = args[0];
        if (!novoGrupoMA || !novoGrupoMA.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: `⚠️ Use: !grupomm [ID]@g.us` });
            return true;
        }
        CONFIG.grupoAlvoMA = novoGrupoMA;
        await sock.sendMessage(from, { text: `✅ Grupo das Mensagens Anônimas alterado para:\n👉 \`${novoGrupoMA}\`` });
        return true;
    }

    if (comando === 'bomba') {
        if (!isGroup) return true;
        if (partidasBomba.has(from)) {
            await sock.sendMessage(from, { text: `⚠️ Já existe uma bomba relógio ativa!` });
            return true;
        }
        partidasBomba.set(from, { dono: jid, porta: jid });
        await sock.sendMessage(from, { 
            text: `💣 *A BOMBA FOI ARMADA!* \n\n@${numeroPuroRemetente} está com a bomba! Use *!passarbomba @membro*!`,
            mentions: [jid]
        });

        setTimeout(async () => {
            if (partidasBomba.has(from)) {
                const partida = partidasBomba.get(from);
                const vitima = partida.porta;
                partidasBomba.delete(from);
                await sock.sendMessage(from, { 
                    text: `💥 *BOOOOOOOM!* A bomba explodiu na mão de @${vitima.replace(/[^0-9]/g, '')}! 😵`,
                    mentions: [vitima]
                });
            }
        }, 15000);
        return true;
    }

    if (comando === 'passarbomba') {
        if (!isGroup) return true;
        if (!partidasBomba.has(from)) return true;
        const partida = partidasBomba.get(from);
        if (partida.porta !== jid) {
            await sock.sendMessage(from, { text: `⚠️ A bomba não está com você!` });
            return true;
        }
        const mencoes = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (mencoes.length === 0) return true;
        const novoAlvo = mencoes[0];
        partida.porta = novoAlvo;
        await sock.sendMessage(from, { 
            text: `💣 🏃‍♂️ @${numeroPuroRemetente} passou a bomba para @${novoAlvo.replace(/[^0-9]/g, '')}!`,
            mentions: [jid, novoAlvo]
        });
        return true;
    }

    if (comando === 'daily') {
        const dados = economia.get(numeroPuroRemetente) || { moedas: 0, xp: 0 };
        dados.moedas += 100;
        dados.xp += 50;
        economia.set(numeroPuroRemetente, dados);
        await sock.sendMessage(from, { text: `🎁 @${numeroPuroRemetente} resgatou: 🪙 +100 moedas | ⭐ +50 XP`, mentions: [jid] });
        return true;
    }

    if (comando === 'rank') {
        const dados = economia.get(numeroPuroRemetente) || { moedas: 0, xp: 0 };
        await sock.sendMessage(from, { text: `📊 *STATUS DE @${numeroPuroRemetente}:*\n\n🪙 Moedas: *${dados.moedas}*\n⭐ XP: *${dados.xp}*`, mentions: [jid] });
        return true;
    }

    return false;
}

module.exports = { checarRespostasInterativas, executarComandoJogo, tratarPrivadoJogos };

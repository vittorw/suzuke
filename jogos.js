const fs = require('fs');

const jogosPPP = new Map();
const jogosMA = new Map();
const pendenciasPrivadas = new Map();
const listasGruposJogos = new Map();
const preferenciaPPP = new Map();
const preferenciaMM = new Map();

const partidasBomba = new Map();
const charadasAtivas = new Map();
const quemsoueuAtivos = new Map();

function normalizarId(valor) {
    return String(valor || '').toLowerCase().replace(/:[0-9]+(?=@)/, '');
}

function numeroDeId(valor) {
    return String(valor || '').replace(/[^0-9]/g, '');
}

function idsDoParticipante(p) {
    return [p?.id, p?.jid, p?.lid, p?.phoneNumber, p?.pn].filter(Boolean).map(normalizarId);
}

function participanteCorresponde(p, jid, numero) {
    const candidatos = idsDoParticipante(p);
    const ids = [jid, numero, `${numero}@s.whatsapp.net`].filter(Boolean).map(normalizarId);
    if (candidatos.some(c => ids.includes(c))) return true;
    const numeros = candidatos.map(numeroDeId).filter(Boolean);
    return !!numero && numeros.includes(String(numero).replace(/[^0-9]/g, ''));
}

function ehAdminParticipante(p) {
    return p?.admin === 'admin' || p?.admin === 'superadmin';
}

function botEhAdminNoGrupo(sock, metadata) {
    const botId = normalizarId(sock.user?.id || '');
    const botNumero = numeroDeId(botId);
    return (metadata?.participants || []).some(p => {
        if (!ehAdminParticipante(p)) return false;
        const ids = idsDoParticipante(p);
        if (botId && ids.includes(botId)) return true;
        return botNumero && ids.some(id => numeroDeId(id) === botNumero);
    });
}

async function listarGruposGerenciaveis(sock, requesterJid, requesterNumero) {
    const todos = await sock.groupFetchAllParticipating();
    const lista = [];
    for (const [id, meta] of Object.entries(todos || {})) {
        if (!id.endsWith('@g.us')) continue;
        if (!botEhAdminNoGrupo(sock, meta)) continue;
        const participante = (meta.participants || []).find(p => participanteCorresponde(p, requesterJid, requesterNumero));
        if (!participante || !ehAdminParticipante(participante)) continue;
        lista.push({ id, nome: meta.subject || 'Grupo' });
    }
    lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return lista;
}

function chaveUsuario(numero, jid) {
    return normalizarId(jid || numero || 'usuario');
}

function obterJogo(map, grupoId) {
    let jogo = map.get(grupoId);
    if (!jogo) {
        jogo = {
            ativo: false,
            grupo: grupoId,
            contador: new Map(),
            fila: [],
            processandoFila: false
        };
        map.set(grupoId, jogo);
    }
    return jogo;
}

function jogoAtivo(map, grupoId) {
    return !!map.get(grupoId)?.ativo;
}

async function nomeGrupo(sock, grupoId) {
    try {
        const meta = await sock.groupMetadata(grupoId);
        return meta.subject || 'Grupo';
    } catch (e) {
        return 'Grupo';
    }
}

async function tratarFilaPPP(sock, jogo) {
    if (jogo.processandoFila || jogo.fila.length === 0) return;
    jogo.processandoFila = true;
    try {
        while (jogo.fila.length > 0) {
            if (!jogo.ativo) {
                jogo.fila = [];
                break;
            }
            const item = jogo.fila.shift();
            try {
                await sock.sendMessage(jogo.grupo, { forward: item.msg });
            } catch (err1) {
                try {
                    await sock.sendMessage(jogo.grupo, {
                        forward: { key: item.msg.key, message: item.msg.message }
                    });
                } catch (err2) {
                    console.error('❌ Erro ao encaminhar mídia do PPP:', err2);
                }
            }
            await sock.sendMessage(jogo.grupo, {
                poll: {
                    name: 'Pego, Penso ou Passo?',
                    values: ['Pego 😈', 'Penso 🤔', 'Passo ❌'],
                    selectableCount: 1
                }
            });
            await new Promise(resolve => setTimeout(resolve, 7000));
        }
    } finally {
        jogo.processandoFila = false;
        if (jogo.ativo && jogo.fila.length > 0) tratarFilaPPP(sock, jogo);
    }
}

async function tratarFilaMA(sock, jogo) {
    if (jogo.processandoFila || jogo.fila.length === 0) return;
    jogo.processandoFila = true;
    try {
        while (jogo.fila.length > 0) {
            if (!jogo.ativo) {
                jogo.fila = [];
                break;
            }
            const item = jogo.fila.shift();
            const mensagemOriginal = item.msg.message || {};
            const textoOriginal = mensagemOriginal.conversation || mensagemOriginal.extendedTextMessage?.text;
            try {
                if (typeof textoOriginal === 'string' && textoOriginal.trim()) {
                    await sock.sendMessage(jogo.grupo, {
                        text: '🕵️ *MENSAGEM ANÔNIMA:*\n\n' + textoOriginal
                    });
                } else {
                    await sock.sendMessage(jogo.grupo, { text: '🕵️ *MENSAGEM ANÔNIMA:*' });
                    try {
                        await sock.sendMessage(jogo.grupo, { forward: item.msg });
                    } catch (err1) {
                        await sock.sendMessage(jogo.grupo, {
                            forward: { key: item.msg.key, message: item.msg.message }
                        });
                    }
                }
            } catch (err) {
                console.error('❌ Erro ao processar mensagem anônima:', err);
            }
            await new Promise(resolve => setTimeout(resolve, 7000));
        }
    } finally {
        jogo.processandoFila = false;
        if (jogo.ativo && jogo.fila.length > 0) tratarFilaMA(sock, jogo);
    }
}


async function membroDoGrupo(sock, grupoId, jid, numero) {
    try {
        const meta = await sock.groupMetadata(grupoId);
        return (meta.participants || []).some(p => participanteCorresponde(p, jid, numero));
    } catch (e) {
        return false;
    }
}

async function obterOpcoesPrivadas(sock, jid, numero) {
    const opcoes = [];
    for (const [grupo, jogo] of jogosPPP.entries()) {
        if (jogo.ativo && await membroDoGrupo(sock, grupo, jid, numero)) {
            opcoes.push({ tipo: 'ppp', grupo, jogo });
        }
    }
    for (const [grupo, jogo] of jogosMA.entries()) {
        if (jogo.ativo && await membroDoGrupo(sock, grupo, jid, numero)) {
            opcoes.push({ tipo: 'mm', grupo, jogo });
        }
    }
    return opcoes;
}

async function enviarOpcoesPrivadas(sock, remoteJid, opcoes) {
    let texto = `📥 *Você participa de mais de um jogo ativo.*\n\nEscolha para onde deseja enviar esta mensagem/mídia:\n\n`;
    for (let i = 0; i < opcoes.length; i++) {
        const nome = await nomeGrupo(sock, opcoes[i].grupo);
        opcoes[i].nome = nome;
        texto += `*${i + 1}.* ${opcoes[i].tipo === 'ppp' ? '📦 PPP' : '🕵️ MM'} — ${nome}\n`;
    }
    texto += `\nResponda com o número da opção.`;
    await sock.sendMessage(remoteJid, { text: texto });
}

async function tratarPrivadoJogos(sock, msg, numeroPuroRemetente, nomeUsuario, isDono, jidRemetente) {
    let corpoMsg = '';
    if (msg.message?.conversation) corpoMsg = msg.message.conversation;
    else if (msg.message?.extendedTextMessage?.text) corpoMsg = msg.message.extendedTextMessage.text;
    else if (msg.message?.imageMessage?.caption) corpoMsg = msg.message.imageMessage.caption;
    else if (msg.message?.videoMessage?.caption) corpoMsg = msg.message.videoMessage.caption;

    if (corpoMsg && corpoMsg.startsWith('!')) return false;

    const remoteJid = msg.key.remoteJid;
    const jid = jidRemetente || msg.key.participant || remoteJid;
    const chave = chaveUsuario(numeroPuroRemetente, jid);
    const pendente = pendenciasPrivadas.get(chave);

    if (pendente && corpoMsg.trim()) {
        const escolha = parseInt(corpoMsg.trim(), 10);
        if (!isNaN(escolha) && escolha >= 1 && escolha <= pendente.opcoes.length) {
            const opcao = pendente.opcoes[escolha - 1];
            pendenciasPrivadas.delete(chave);
            return await processarMidiaNoJogo(sock, pendente.msg || msg, numeroPuroRemetente, nomeUsuario, isDono, opcao);
        }
        if (!msg.message?.imageMessage && !msg.message?.videoMessage) {
            await enviarOpcoesPrivadas(sock, remoteJid, pendente.opcoes);
            return true;
        }
    }

    const imgMsg = msg.message?.imageMessage;
    const vidMsg = msg.message?.videoMessage;
    const eMidiaNormal = imgMsg || vidMsg;
    const eMidiaVU = imgMsg?.viewOnce || vidMsg?.viewOnce;
    const eTexto = typeof corpoMsg === 'string' && corpoMsg.trim().length > 0;
    if (!eMidiaNormal && !eTexto) return false;

    let opcoes = await obterOpcoesPrivadas(sock, jid, numeroPuroRemetente);
    if (eTexto && !eMidiaNormal) opcoes = opcoes.filter(opcao => opcao.tipo === 'mm');
    if (opcoes.length === 0) return false;

    if (opcoes.length > 1) {
        pendenciasPrivadas.set(chave, { opcoes, msg });
        await enviarOpcoesPrivadas(sock, remoteJid, opcoes);
        return true;
    }

    return await processarMidiaNoJogo(sock, msg, numeroPuroRemetente, nomeUsuario, isDono, opcoes[0]);
}


async function processarMidiaNoJogo(sock, msg, numeroPuroRemetente, nomeUsuario, isDono, opcao) {
    const imgMsg = msg.message?.imageMessage;
    const vidMsg = msg.message?.videoMessage;
    const eMidiaNormal = imgMsg || vidMsg;
    const eMidiaVU = imgMsg?.viewOnce || vidMsg?.viewOnce;
    const mensagemOriginal = msg.message || {};
    const textoOriginal = mensagemOriginal.conversation || mensagemOriginal.extendedTextMessage?.text || '';
    const eTexto = typeof textoOriginal === 'string' && textoOriginal.trim().length > 0;

    if (eMidiaVU) {
        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Envie apenas imagens ou vídeos normais (sem ser visualização única)!' });
        return true;
    }
    if (!eMidiaNormal && !(opcao.tipo === 'mm' && eTexto)) return false;

    const jogo = opcao.jogo;
    if (!jogo?.ativo) {
        await sock.sendMessage(msg.key.remoteJid, { text: '⚠️ Este jogo foi encerrado.' });
        return true;
    }

    const total = jogo.contador.get(numeroPuroRemetente) || 0;
    const limite = opcao.tipo === 'ppp' ? 3 : 5;
    if (!isDono && total >= limite) {
        await sock.sendMessage(msg.key.remoteJid, {
            text: opcao.tipo === 'ppp'
                ? '⚠️ Você já enviou suas mídias neste PPP e atingiu o limite!'
                : '⚠️ Você atingiu o limite máximo de mensagens anônimas enviadas nesta rodada!'
        });
        return true;
    }
    if (!isDono) jogo.contador.set(numeroPuroRemetente, total + 1);
    jogo.fila.push({ msg, nomeUsuario });
    if (opcao.tipo === 'ppp') tratarFilaPPP(sock, jogo);
    else tratarFilaMA(sock, jogo);
    return true;
}


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

async function mostrarListaGrupos(sock, from, comando, requesterJid, requesterNumero) {
    try {
        const lista = await listarGruposGerenciaveis(sock, requesterJid, requesterNumero);
        const chave = `${chaveUsuario(requesterNumero, requesterJid)}:${comando}`;
        listasGruposJogos.set(chave, lista);
        if (!lista.length) {
            await sock.sendMessage(from, { text: `⚠️ Não encontrei grupos em que você e o bot sejam administradores.` });
            return true;
        }
        let texto = `📋 *GRUPOS DISPONÍVEIS PARA ${comando === 'grupoppp' ? 'PPP' : 'MENSAGENS ANÔNIMAS'}*\n\n`;
        lista.forEach((g, i) => { texto += `*${i + 1}.* ${g.nome}\n`; });
        texto += `\nDigite *!${comando} número* para selecionar. Exemplo: *!${comando} 1*`;
        await sock.sendMessage(from, { text: texto });
        return true;
    } catch (e) {
        console.log(`Erro ao listar grupos para ${comando}:`, e);
        await sock.sendMessage(from, { text: `❌ Não foi possível carregar a lista de grupos.` });
        return true;
    }
}

async function selecionarGrupoDaLista(sock, from, comando, args, requesterJid, requesterNumero) {
    const chave = `${chaveUsuario(requesterNumero, requesterJid)}:${comando}`;
    let lista = listasGruposJogos.get(chave);
    if (!lista || !lista.length) {
        lista = await listarGruposGerenciaveis(sock, requesterJid, requesterNumero);
        listasGruposJogos.set(chave, lista);
    }
    const indice = parseInt(args[0], 10) - 1;
    if (isNaN(indice) || indice < 0 || indice >= lista.length) {
        await sock.sendMessage(from, { text: `⚠️ Número inválido. Use *!${comando}* para ver a lista de grupos.` });
        return null;
    }
    return lista[indice];
}

async function executarComandoJogo(sock, from, comando, args, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, isDono, isAdm, chatAlvoDesejado) {
    let grupoDestinoFinal = chatAlvoDesejado || (isGroup ? from : '');
    const requesterJid = jid || msg?.key?.participant || msg?.key?.remoteJid;

    if (comando === 'iniciarppp') {
        if (!grupoDestinoFinal || !grupoDestinoFinal.endsWith('@g.us')) {
            grupoDestinoFinal = preferenciaPPP.get(chaveUsuario(numeroPuroRemetente, requesterJid)) || '';
        }
        if (!grupoDestinoFinal || !grupoDestinoFinal.endsWith('@g.us')) {
            const lista = await listarGruposGerenciaveis(sock, requesterJid, numeroPuroRemetente);
            if (lista.length === 1) grupoDestinoFinal = lista[0].id;
        }
        if (!grupoDestinoFinal || !grupoDestinoFinal.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: `⚠️ Você precisa estar em um grupo ou selecionar um grupo no painel de gerenciamento para iniciar!` });
            return true;
        }
        if (jogoAtivo(jogosPPP, grupoDestinoFinal)) {
            await sock.sendMessage(from, { text: `⚠️ *O Jogo PPP já está em andamento neste grupo!*` });
            return true;
        }
        const jogo = obterJogo(jogosPPP, grupoDestinoFinal);
        jogo.ativo = true;
        jogo.contador.clear();
        jogo.fila = [];
        await sock.sendMessage(grupoDestinoFinal, { text: `📦 *JOGO PPP INICIADO!* \n\n📥 Mandem mídias no meu PV!` });
        if (from !== grupoDestinoFinal) await sock.sendMessage(from, { text: `✅ Jogo PPP iniciado com sucesso no grupo selecionado!` });
        return true;
    }

    if (comando === 'grupoppp') {
        if (!args.length) return await mostrarListaGrupos(sock, from, comando, requesterJid, numeroPuroRemetente);
        const escolhido = await selecionarGrupoDaLista(sock, from, comando, args, requesterJid, numeroPuroRemetente);
        if (!escolhido) return true;
        preferenciaPPP.set(chaveUsuario(numeroPuroRemetente, requesterJid), escolhido.id);
        await sock.sendMessage(from, { text: `✅ Grupo do PPP selecionado:\n👉 *${escolhido.nome}*` });
        return true;
    }

    if (comando === 'iniciarmm') {
        if (!grupoDestinoFinal || !grupoDestinoFinal.endsWith('@g.us')) {
            grupoDestinoFinal = preferenciaMM.get(chaveUsuario(numeroPuroRemetente, requesterJid)) || '';
        }
        if (!grupoDestinoFinal || !grupoDestinoFinal.endsWith('@g.us')) {
            const lista = await listarGruposGerenciaveis(sock, requesterJid, numeroPuroRemetente);
            if (lista.length === 1) grupoDestinoFinal = lista[0].id;
        }
        if (!grupoDestinoFinal || !grupoDestinoFinal.endsWith('@g.us')) {
            await sock.sendMessage(from, { text: `⚠️ Você precisa estar em um grupo ou selecionar um grupo no painel de gerenciamento para iniciar!` });
            return true;
        }
        if (jogoAtivo(jogosMA, grupoDestinoFinal)) {
            await sock.sendMessage(from, { text: `⚠️ *As Mensagens Anônimas já estão em andamento neste grupo!*` });
            return true;
        }
        const jogo = obterJogo(jogosMA, grupoDestinoFinal);
        jogo.ativo = true;
        jogo.contador.clear();
        jogo.fila = [];
        await sock.sendMessage(grupoDestinoFinal, { text: `🕵️ *MENSAGENS ANÔNIMAS INICIADAS!* \n\n📥 Envie mídias/mensagens no PV!` });
        if (from !== grupoDestinoFinal) await sock.sendMessage(from, { text: `✅ Mensagens anônimas iniciadas com sucesso no grupo selecionado!` });
        return true;
    }

    if (comando === 'grupomm') {
        if (!args.length) return await mostrarListaGrupos(sock, from, comando, requesterJid, numeroPuroRemetente);
        const escolhido = await selecionarGrupoDaLista(sock, from, comando, args, requesterJid, numeroPuroRemetente);
        if (!escolhido) return true;
        preferenciaMM.set(chaveUsuario(numeroPuroRemetente, requesterJid), escolhido.id);
        await sock.sendMessage(from, { text: `✅ Grupo das Mensagens Anônimas selecionado:\n👉 *${escolhido.nome}*` });
        return true;
    }

    return false;
}

async function encerrarTodosJogosNoGrupo(sock, grupoId) {
    let encerrou = false;
    const ppp = jogosPPP.get(grupoId);
    if (ppp) { ppp.ativo = false; ppp.fila = []; ppp.contador.clear(); jogosPPP.delete(grupoId); encerrou = true; }
    const mm = jogosMA.get(grupoId);
    if (mm) { mm.ativo = false; mm.fila = []; mm.contador.clear(); jogosMA.delete(grupoId); encerrou = true; }
    return encerrou;
}
function haJogoAtivoNoGrupo(grupoId) { return jogoAtivo(jogosPPP, grupoId) || jogoAtivo(jogosMA, grupoId); }
module.exports = { checarRespostasInterativas, executarComandoJogo, tratarPrivadoJogos, listarGruposGerenciaveis, encerrarTodosJogosNoGrupo, haJogoAtivoNoGrupo };

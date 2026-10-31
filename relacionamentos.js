'use strict';

const fs = require('fs');
const caminhoDados = './relacionamentos.json';
const FUSO = 'America/Fortaleza';
const EXPIRACAO_PEDIDO_MS = 24 * 60 * 60 * 1000;

function dadosVazios() {
    return { relacionamentos: [], pendencias: [], historicoPedidos: [] };
}

function carregarDados() {
    try {
        if (!fs.existsSync(caminhoDados)) return dadosVazios();
        const bruto = JSON.parse(fs.readFileSync(caminhoDados, 'utf8'));
        return {
            relacionamentos: Array.isArray(bruto.relacionamentos) ? bruto.relacionamentos : [],
            pendencias: Array.isArray(bruto.pendencias) ? bruto.pendencias : [],
            historicoPedidos: Array.isArray(bruto.historicoPedidos) ? bruto.historicoPedidos : []
        };
    } catch (erro) {
        console.error('[Relacionamentos] Não foi possível ler relacionamentos.json:', erro.message);
        return dadosVazios();
    }
}

let dados = carregarDados();

function salvarDados() {
    const temporario = `${caminhoDados}.tmp`;
    try {
        fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), 'utf8');
        fs.renameSync(temporario, caminhoDados);
    } catch (erro) {
        try { if (fs.existsSync(temporario)) fs.unlinkSync(temporario); } catch (_) {}
        console.error('[Relacionamentos] Erro ao salvar os dados:', erro.message);
        throw erro;
    }
}

function normJid(valor) {
    return String(valor || '').toLowerCase().replace(/:[0-9]+(?=@)/, '').trim();
}

function numeroDe(valor) {
    return String(valor || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
}

function pessoa(jid, numero, nome) {
    return {
        jid: normJid(jid),
        numero: String(numero || numeroDe(jid) || ''),
        nome: String(nome || 'Membro').slice(0, 80)
    };
}

function mesmaPessoa(registrada, jid, numero) {
    if (!registrada) return false;
    const jidSalvo = normJid(registrada.jid);
    const jidAtual = normJid(jid);
    if (jidSalvo && jidAtual && jidSalvo === jidAtual) return true;
    // LIDs não são números telefônicos; nunca comparar seus dígitos como telefone.
    if ((jidSalvo.includes('@lid') || jidAtual.includes('@lid')) || !jidSalvo || !jidAtual) return false;
    const n1 = String(registrada.numero || numeroDe(jidSalvo)).replace(/[^0-9]/g, '');
    const n2 = String(numero || numeroDe(jidAtual)).replace(/[^0-9]/g, '');
    return n1.length >= 8 && n2.length >= 8 && n1 === n2;
}

function relacaoAtiva(grupoId, jid, numero) {
    return dados.relacionamentos.find(r => r.grupoId === grupoId && !r.terminadoEm && membroNaRelacao(r, jid, numero)) || null;
}

function relacoesAtivas(grupoId) {
    return dados.relacionamentos.filter(r => r.grupoId === grupoId && !r.terminadoEm);
}

function membroNaRelacao(r, jid, numero) {
    return mesmaPessoa(r.pessoa1, jid, numero) || mesmaPessoa(r.pessoa2, jid, numero);
}

function parceiroDaRelacao(r, jid, numero) {
    if (mesmaPessoa(r.pessoa1, jid, numero)) return r.pessoa2;
    if (mesmaPessoa(r.pessoa2, jid, numero)) return r.pessoa1;
    return null;
}

function duracao(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const dias = Math.floor(total / 86400);
    const horas = Math.floor((total % 86400) / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    if (dias > 0) return `${dias} dia(s), ${horas}h e ${minutos}min`;
    if (horas > 0) return `${horas}h e ${minutos}min`;
    return `${minutos}min`;
}

function dataHora(timestamp) {
    if (!timestamp) return 'não registrada';
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
}

function dataDiaCalendario(timestamp) {
    if (!timestamp) return 'não registrada';
    return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(timestamp));
}

function dataLocal(timestamp) {
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date(timestamp));
    const out = {};
    for (const item of p) if (item.type !== 'literal') out[item.type] = Number(item.value);
    return out;
}

function aniversarioMensalSeguinte(inicio, agora) {
    const pInicio = dataLocal(inicio);
    const pAgora = dataLocal(agora);
    const dataAtual = Date.UTC(pAgora.year, pAgora.month - 1, pAgora.day);
    for (let offset = 0; offset <= 13; offset++) {
        const indiceMes = (pAgora.month - 1) + offset;
        const ano = pAgora.year + Math.floor(indiceMes / 12);
        const mes = (indiceMes % 12) + 1;
        const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dia = Math.min(pInicio.day, ultimoDia);
        const candidato = Date.UTC(ano, mes - 1, dia);
        if (candidato > dataAtual) {
            return { timestamp: candidato, dias: Math.ceil((candidato - dataAtual) / 86400000) };
        }
    }
    return { timestamp: inicio, dias: 0 };
}

function limparPendenciasExpiradas(agora = Date.now()) {
    const antes = dados.pendencias.length;
    dados.pendencias = dados.pendencias.filter(p => agora - Number(p.criadoEm || 0) <= EXPIRACAO_PEDIDO_MS);
    if (dados.pendencias.length !== antes) salvarDados();
}

function textoPedido(p) {
    if (p.tipo === 'namoro') return `💌 *PEDIDO DE NAMORO*\n\n@${p.autor.numero} pediu @${p.alvo.numero} em namoro.\n\n@${p.alvo.numero}, responda diretamente a esta mensagem com *SIM* para aceitar ou *NÃO* para recusar.\n⏳ O pedido expira em 24 horas.`;
    if (p.tipo === 'casamento') return `💍 *PEDIDO DE CASAMENTO*\n\n@${p.autor.numero} pediu @${p.alvo.numero} em casamento!\n\n@${p.alvo.numero}, responda diretamente a esta mensagem com *SIM* para aceitar ou *NÃO* para recusar.\n⏳ O pedido expira em 24 horas.`;
    if (p.tipo === 'termino') return `💔 *CONFIRMAÇÃO DE TÉRMINO*\n\nVocê pediu para encerrar seu relacionamento. Responda diretamente a esta mensagem com *SIM* para confirmar ou *NÃO* para manter o relacionamento.`;
    return `💔 *CONFIRMAÇÃO DE DIVÓRCIO*\n\nVocê pediu para encerrar o casamento. Responda diretamente a esta mensagem com *SIM* para confirmar ou *NÃO* para continuar casado(a).`;
}

async function enviarPedido(sock, grupoId, msg, pedido) {
    const enviados = [pedido.autor.jid, pedido.alvo.jid].filter(Boolean);
    const enviado = await sock.sendMessage(grupoId, {
        text: textoPedido(pedido),
        mentions: [...new Set(enviados)]
    }, { quoted: msg });
    if (!enviado?.key?.id) return false;
    pedido.messageId = enviado.key.id;
    dados.pendencias.push(pedido);
    salvarDados();
    return true;
}

function contarCasamentos(r) {
    return Array.isArray(r.casamentos) ? r.casamentos.length : (r.casadoDesde ? 1 : 0);
}

function casamentoAtual(r) {
    if (!Array.isArray(r.casamentos)) r.casamentos = [];
    return r.casamentos.find(c => !c.ate) || null;
}

function fecharCasamento(r, agora) {
    const atual = casamentoAtual(r);
    if (atual) atual.ate = agora;
    r.casadoDesde = null;
}

function adicionarHistoricoPedido(pedido, resultado, quando = Date.now()) {
    dados.historicoPedidos.push({
        tipo: pedido.tipo, grupoId: pedido.grupoId, autor: pedido.autor,
        alvo: pedido.alvo, resultado, criadoEm: pedido.criadoEm, concluidoEm: quando
    });
    if (dados.historicoPedidos.length > 1000) dados.historicoPedidos = dados.historicoPedidos.slice(-1000);
}

async function tratarRespostaRelacionamento(sock, msg, from, isGroup, corpoMsg, jid, numeroPuroRemetente, nomeUsuario) {
    if (!isGroup) return false;
    const contexto = msg.message?.extendedTextMessage?.contextInfo;
    const idCitado = contexto?.stanzaId || contexto?.quotedMessage?.key?.id || '';
    if (!idCitado) return false;
    const indice = dados.pendencias.findIndex(p => p.grupoId === from && p.messageId === idCitado);
    if (indice < 0) return false;

    const pedido = dados.pendencias[indice];
    const agora = Date.now();
    if (agora - Number(pedido.criadoEm || 0) > EXPIRACAO_PEDIDO_MS) {
        dados.pendencias.splice(indice, 1);
        salvarDados();
        await sock.sendMessage(from, { text: '⌛ Este pedido expirou. Inicie um novo pedido se ainda quiser.' }, { quoted: msg });
        return true;
    }
    const responderEAutor = pedido.tipo === 'termino' || pedido.tipo === 'divorcio';
    const pessoaAutorizada = responderEAutor ? pedido.autor : pedido.alvo;
    if (!mesmaPessoa(pessoaAutorizada, jid, numeroPuroRemetente)) {
        await sock.sendMessage(from, { text: '⚠️ Só a pessoa autorizada pode responder a este pedido.' }, { quoted: msg });
        return true;
    }

    const resposta = String(corpoMsg || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[.!?\s]+/g, '').toUpperCase();
    if (resposta !== 'SIM' && resposta !== 'NAO') {
        if (resposta.startsWith('!')) return false;
        await sock.sendMessage(from, { text: 'Responda a esta mensagem com *SIM* ou *NÃO*.' }, { quoted: msg });
        return true;
    }

    dados.pendencias.splice(indice, 1);
    if (resposta === 'NAO') {
        adicionarHistoricoPedido(pedido, 'recusado', agora);
        salvarDados();
        await sock.sendMessage(from, { text: pedido.tipo === 'namoro'
            ? `💌 @${pedido.alvo.numero} recusou o pedido de namoro.`
            : pedido.tipo === 'casamento'
                ? `💍 @${pedido.alvo.numero} recusou o pedido de casamento.`
                : pedido.tipo === 'termino'
                    ? '✅ Confirmação cancelada. O relacionamento continua ativo.'
                    : '✅ Confirmação cancelada. O casamento continua ativo.',
            mentions: [pedido.autor.jid, pedido.alvo.jid].filter(Boolean)
        }, { quoted: msg });
        return true;
    }

    if (pedido.tipo === 'namoro') {
        if (relacoesAtivas(from).some(r => membroNaRelacao(r, pedido.autor.jid, pedido.autor.numero) || membroNaRelacao(r, pedido.alvo.jid, pedido.alvo.numero))) {
            adicionarHistoricoPedido(pedido, 'não concluído: participante já relacionado', agora);
            salvarDados();
            await sock.sendMessage(from, { text: '⚠️ O pedido não foi concluído porque uma das pessoas já está em um relacionamento ativo neste grupo.' }, { quoted: msg });
            return true;
        }
        const rel = {
            id: `rel-${agora}-${Math.random().toString(36).slice(2, 9)}`,
            grupoId: from, pessoa1: pedido.autor, pessoa2: pedido.alvo,
            namoroDesde: agora, casadoDesde: null, casamentos: [], terminadoEm: null
        };
        dados.relacionamentos.push(rel);
        adicionarHistoricoPedido(pedido, 'namoro aceito', agora);
        salvarDados();
        await sock.sendMessage(from, { text: `💞 *AGORA É OFICIAL!*\n\n@${pedido.autor.numero} e @${pedido.alvo.numero} começaram a namorar!\n📅 Início: ${dataHora(agora)}\n\n💡 Depois de completar 3 dias (72 horas), use *!casar* para pedir casamento.`, mentions: [pedido.autor.jid, pedido.alvo.jid].filter(Boolean) }, { quoted: msg });
        return true;
    }

    if (pedido.tipo === 'casamento') {
        const rel = dados.relacionamentos.find(r => r.id === pedido.relacaoId && r.grupoId === from && !r.terminadoEm);
        if (!rel || !membroNaRelacao(rel, pedido.autor.jid, pedido.autor.numero) || !membroNaRelacao(rel, pedido.alvo.jid, pedido.alvo.numero)) {
            adicionarHistoricoPedido(pedido, 'não concluído: relacionamento não encontrado', agora);
            salvarDados();
            await sock.sendMessage(from, { text: '⚠️ Não encontrei o namoro ativo associado a este pedido.' }, { quoted: msg });
            return true;
        }
        if (agora - Number(rel.namoroDesde || agora) < 72 * 60 * 60 * 1000) {
            dados.pendencias = dados.pendencias.filter(p => p.messageId !== pedido.messageId);
            adicionarHistoricoPedido(pedido, 'não concluído: menos de 72 horas de namoro', agora);
            salvarDados();
            await sock.sendMessage(from, { text: '⏳ Ainda não completaram 3 dias inteiros de namoro. O pedido de casamento foi cancelado.' }, { quoted: msg });
            return true;
        }
        if (casamentoAtual(rel)) {
            salvarDados();
            await sock.sendMessage(from, { text: '💍 Este casal já está casado.' }, { quoted: msg });
            return true;
        }
        rel.casadoDesde = agora;
        rel.casamentos = Array.isArray(rel.casamentos) ? rel.casamentos : [];
        rel.casamentos.push({ desde: agora, ate: null });
        adicionarHistoricoPedido(pedido, 'casamento aceito', agora);
        salvarDados();
        await sock.sendMessage(from, { text: `💒 *CASAMENTO CONFIRMADO!*\n\n💍 @${rel.pessoa1.numero} e @${rel.pessoa2.numero} agora estão casados!\n📅 Casamento: ${dataHora(agora)}\n💞 Namoro iniciado em: ${dataHora(rel.namoroDesde)}`, mentions: [rel.pessoa1.jid, rel.pessoa2.jid].filter(Boolean) }, { quoted: msg });
        return true;
    }

    const rel = dados.relacionamentos.find(r => r.id === pedido.relacaoId && r.grupoId === from && !r.terminadoEm);
    if (!rel || !membroNaRelacao(rel, jid, numeroPuroRemetente)) {
        adicionarHistoricoPedido(pedido, 'não concluído: relacionamento não encontrado', agora);
        salvarDados();
        await sock.sendMessage(from, { text: '⚠️ Não encontrei um relacionamento ativo para essa confirmação.' }, { quoted: msg });
        return true;
    }
    if (pedido.tipo === 'divorcio') {
        if (!casamentoAtual(rel)) {
            adicionarHistoricoPedido(pedido, 'não concluído: casamento não ativo', agora);
            salvarDados();
            await sock.sendMessage(from, { text: '⚠️ Este casal não possui casamento ativo.' }, { quoted: msg });
            return true;
        }
        fecharCasamento(rel, agora);
        adicionarHistoricoPedido(pedido, 'divórcio confirmado; namoro mantido', agora);
        salvarDados();
        await sock.sendMessage(from, { text: `💔 O casamento foi encerrado. @${rel.pessoa1.numero} e @${rel.pessoa2.numero} continuam namorando desde ${dataHora(rel.namoroDesde)}.`, mentions: [rel.pessoa1.jid, rel.pessoa2.jid].filter(Boolean) }, { quoted: msg });
        return true;
    }

    if (casamentoAtual(rel)) fecharCasamento(rel, agora);
    rel.terminadoEm = agora;
    adicionarHistoricoPedido(pedido, 'término confirmado', agora);
    salvarDados();
    await sock.sendMessage(from, { text: `💔 O relacionamento entre @${rel.pessoa1.numero} e @${rel.pessoa2.numero} foi encerrado.\n📅 Namoro começou em: ${dataHora(rel.namoroDesde)}\n⏳ Duração: ${duracao(agora - rel.namoroDesde)}`, mentions: [rel.pessoa1.jid, rel.pessoa2.jid].filter(Boolean) }, { quoted: msg });
    return true;
}

async function executarComandoRelacionamento(sock, contexto) {
    const { from, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, comando, args } = contexto;
    const comandos = new Set(['namorar', 'casal', 'terminar', 'casar', 'divorciar', 'rankcasais', 'statscasal', 'rankcasados', 'relacionamento', 'aniversariodenamoro', 'historicoamor']);
    if (!comandos.has(comando)) return false;
    if (!isGroup) {
        await sock.sendMessage(from, { text: '⚠️ Os comandos de relacionamento funcionam somente em grupos.' }, { quoted: msg });
        return true;
    }
    const responder = (texto, mentions = []) => sock.sendMessage(from, { text: texto, mentions: [...new Set(mentions.filter(Boolean))] }, { quoted: msg });
    limparPendenciasExpiradas();
    const agora = Date.now();
    const eu = pessoa(jid, numeroPuroRemetente, nomeUsuario);

    if (comando === 'namorar') {
        const mencoes = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        if (!mencoes[0]) return responder('💌 Marque a pessoa que deseja pedir em namoro. Exemplo: *!namorar @membro*');
        const alvoJid = normJid(mencoes[0]);
        const alvo = pessoa(alvoJid, numeroDe(alvoJid), 'Membro');
        if (mesmaPessoa(eu, alvo.jid, alvo.numero)) return responder('⚠️ Você não pode pedir a si mesmo em namoro.');
        if (relacoesAtivas(from).some(r => membroNaRelacao(r, eu.jid, eu.numero) || membroNaRelacao(r, alvo.jid, alvo.numero))) return responder('⚠️ Você ou a pessoa marcada já está em um relacionamento ativo neste grupo.');
        if (dados.pendencias.some(p => p.tipo === 'namoro' && p.grupoId === from && (mesmaPessoa(p.autor, eu.jid, eu.numero) || mesmaPessoa(p.alvo, eu.jid, eu.numero) || mesmaPessoa(p.autor, alvo.jid, alvo.numero) || mesmaPessoa(p.alvo, alvo.jid, alvo.numero)))) return responder('⚠️ Já existe um pedido de namoro pendente envolvendo você ou a pessoa marcada.');
        const pedido = { tipo: 'namoro', grupoId: from, autor: eu, alvo, criadoEm: agora, messageId: '' };
        if (!(await enviarPedido(sock, from, msg, pedido))) return responder('❌ Não consegui registrar o pedido porque não recebi o ID da mensagem enviada. Tente novamente.');
        return true;
    }

    if (comando === 'casar') {
        const rel = relacaoAtiva(from, jid, numeroPuroRemetente);
        if (!rel || !membroNaRelacao(rel, jid, numeroPuroRemetente)) return responder('⚠️ Você precisa estar namorando neste grupo para usar *!casar*.');
        if (casamentoAtual(rel)) return responder('💍 Vocês já estão casados.');
        const tempo = agora - Number(rel.namoroDesde || agora);
        if (tempo < 72 * 60 * 60 * 1000) return responder(`⏳ Para casar, vocês precisam completar 3 dias inteiros de namoro. Faltam ${duracao(72 * 60 * 60 * 1000 - tempo)}.`);
        if (dados.pendencias.some(p => p.tipo === 'casamento' && p.relacaoId === rel.id)) return responder('💍 Já existe um pedido de casamento aguardando resposta.');
        const parceiro = parceiroDaRelacao(rel, jid, numeroPuroRemetente);
        const pedido = { tipo: 'casamento', grupoId: from, relacaoId: rel.id, autor: eu, alvo: parceiro, criadoEm: agora, messageId: '' };
        if (!(await enviarPedido(sock, from, msg, pedido))) return responder('❌ Não consegui registrar o pedido de casamento. Tente novamente.');
        return true;
    }

    if (comando === 'terminar' || comando === 'divorciar') {
        const rel = relacaoAtiva(from, jid, numeroPuroRemetente);
        if (!rel || !membroNaRelacao(rel, jid, numeroPuroRemetente)) return responder('⚠️ Você não tem um relacionamento ativo neste grupo.');
        if (comando === 'divorciar' && !casamentoAtual(rel)) return responder('⚠️ Você não está casado(a) neste grupo. Use *!terminar* se deseja encerrar o namoro.');
        if (comando === 'terminar' && dados.pendencias.some(p => p.tipo === 'termino' && p.relacaoId === rel.id)) return responder('⚠️ Já existe uma confirmação de término pendente para este relacionamento.');
        if (comando === 'divorciar' && dados.pendencias.some(p => p.tipo === 'divorcio' && p.relacaoId === rel.id)) return responder('⚠️ Já existe uma confirmação de divórcio pendente.');
        const pedido = { tipo: comando === 'terminar' ? 'termino' : 'divorcio', grupoId: from, relacaoId: rel.id, autor: eu, alvo: parceiroDaRelacao(rel, jid, numeroPuroRemetente), criadoEm: agora, messageId: '' };
        if (!(await enviarPedido(sock, from, msg, pedido))) return responder('❌ Não consegui enviar a confirmação. Tente novamente.');
        return true;
    }

    if (comando === 'casal') {
        const lista = relacoesAtivas(from).sort((a, b) => (a.namoroDesde || 0) - (b.namoroDesde || 0));
        if (!lista.length) return responder('💞 Ainda não há casais ativos neste grupo. Use *!namorar @membro* para começar.');
        const linhas = lista.slice(0, 40).map((r, i) => `${i + 1}. ${casamentoAtual(r) ? '💍' : '💞'} @${r.pessoa1.numero} + @${r.pessoa2.numero}\n   ⏳ ${duracao(agora - r.namoroDesde)}\n   📅 Namoro: ${dataHora(r.namoroDesde)}${casamentoAtual(r) ? `\n   💒 Casados desde: ${dataHora(r.casadoDesde)}` : ''}`);
        return responder(`💞 *CASAIS ATIVOS NESTE GRUPO*\n\n${linhas.join('\n\n')}${lista.length > 40 ? `\n\n… e mais ${lista.length - 40} casal(is).` : ''}`, lista.flatMap(r => [r.pessoa1.jid, r.pessoa2.jid]));
    }

    if (comando === 'relacionamento') {
        const mencao = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mencao) return responder('Use *!relacionamento @membro* para consultar o status de alguém neste grupo.');
        const alvo = pessoa(mencao, numeroDe(mencao), 'Membro');
        const rel = relacoesAtivas(from).find(r => membroNaRelacao(r, alvo.jid, alvo.numero));
        if (!rel) return responder(`💔 @${alvo.numero} não possui relacionamento ativo neste grupo.`, [alvo.jid]);
        const parceiro = parceiroDaRelacao(rel, alvo.jid, alvo.numero);
        const casamento = casamentoAtual(rel);
        return responder(`💞 *RELACIONAMENTO*\n\n👤 @${alvo.numero}\n❤️ Parceiro(a): @${parceiro.numero}\n📌 Status: ${casamento ? 'Casados' : 'Namorando'}\n📅 Início do namoro: ${dataHora(rel.namoroDesde)}\n⏳ Tempo de namoro: ${duracao(agora - rel.namoroDesde)}${casamento ? `\n💒 Casamento: ${dataHora(rel.casadoDesde)}\n⌛ Tempo de casamento: ${duracao(agora - rel.casadoDesde)}` : ''}`, [alvo.jid, parceiro.jid]);
    }

    if (comando === 'aniversariodenamoro') {
        const rel = relacaoAtiva(from, jid, numeroPuroRemetente);
        if (!rel || !membroNaRelacao(rel, jid, numeroPuroRemetente)) return responder('💔 Você não tem um namoro ativo neste grupo para consultar o aniversário.');
        const prox = aniversarioMensalSeguinte(rel.namoroDesde, agora);
        return responder(`💞 *ANIVERSÁRIO DE NAMORO*\n\n❤️ Casal: @${rel.pessoa1.numero} + @${rel.pessoa2.numero}\n📅 Começaram a namorar: ${dataHora(rel.namoroDesde)}\n⏳ Tempo juntos: ${duracao(agora - rel.namoroDesde)}\n🎂 Próximo aniversário mensal: ${dataDiaCalendario(prox.timestamp)}\n🗓️ Faltam ${prox.dias} dia(s).`, [rel.pessoa1.jid, rel.pessoa2.jid]);
    }

    if (comando === 'rankcasais') {
        const lista = relacoesAtivas(from).sort((a, b) => (a.namoroDesde || 0) - (b.namoroDesde || 0));
        if (!lista.length) return responder('🏆 Ainda não há casais ativos para classificar neste grupo.');
        const linhas = lista.slice(0, 20).map((r, i) => `${i + 1}. ${casamentoAtual(r) ? '💍' : '💞'} @${r.pessoa1.numero} + @${r.pessoa2.numero} — ${duracao(agora - r.namoroDesde)}`);
        return responder(`🏆 *RANKING DE CASAIS POR TEMPO DE NAMORO*\n\n${linhas.join('\n')}`, lista.slice(0, 20).flatMap(r => [r.pessoa1.jid, r.pessoa2.jid]));
    }

    if (comando === 'rankcasados') {
        const lista = relacoesAtivas(from).filter(casamentoAtual).sort((a, b) => a.casadoDesde - b.casadoDesde);
        if (!lista.length) return responder('💍 Ainda não há casais casados neste grupo.');
        const linhas = lista.slice(0, 20).map((r, i) => `${i + 1}. @${r.pessoa1.numero} + @${r.pessoa2.numero} — casados há ${duracao(agora - r.casadoDesde)}`);
        return responder(`🏆 *RANKING DE CASAIS CASADOS*\n\n${linhas.join('\n')}`, lista.slice(0, 20).flatMap(r => [r.pessoa1.jid, r.pessoa2.jid]));
    }

    if (comando === 'statscasal') {
        const pessoaTemporaria = { jid, numero: numeroPuroRemetente };
        const rel = relacoesAtivas(from).find(r => membroNaRelacao(r, jid, numeroPuroRemetente));
        const anteriores = dados.relacionamentos.filter(r => r.grupoId === from && membroNaRelacao(r, pessoaTemporaria.jid, pessoaTemporaria.numero));
        const casamentos = anteriores.reduce((total, r) => total + contarCasamentos(r), 0);
        let texto = `📊 *ESTATÍSTICAS DE RELACIONAMENTO*\n\n👤 @${numeroPuroRemetente}\n💞 Relacionamentos registrados neste grupo: ${anteriores.length}\n💍 Casamentos registrados: ${casamentos}`;
        if (rel) texto += `\n❤️ Parceiro(a): @${parceiroDaRelacao(rel, jid, numeroPuroRemetente).numero}\n📌 Status: ${casamentoAtual(rel) ? 'Casados' : 'Namorando'}\n📅 Início do namoro: ${dataHora(rel.namoroDesde)}\n⏳ Tempo atual: ${duracao(agora - rel.namoroDesde)}${casamentoAtual(rel) ? `\n💒 Casados desde: ${dataHora(rel.casadoDesde)}\n⌛ Tempo casado: ${duracao(agora - rel.casadoDesde)}` : ''}`;
        else texto += '\n💔 Você não tem relacionamento ativo neste grupo.';
        return responder(texto, [jid, ...(rel ? [parceiroDaRelacao(rel, jid, numeroPuroRemetente).jid] : [])]);
    }

    if (comando === 'historicoamor') {
        const anteriores = dados.relacionamentos.filter(r => r.grupoId === from && membroNaRelacao(r, jid, numeroPuroRemetente)).sort((a, b) => (b.namoroDesde || 0) - (a.namoroDesde || 0));
        if (!anteriores.length) return responder('📜 Você ainda não tem histórico de relacionamentos registrado neste grupo.');
        const linhas = anteriores.slice(0, 20).map((r, i) => {
            const parceiro = parceiroDaRelacao(r, jid, numeroPuroRemetente);
            const fim = r.terminadoEm ? `terminado em ${dataHora(r.terminadoEm)}` : 'ativo';
            const casamentos = (Array.isArray(r.casamentos) ? r.casamentos : []).map(c => `\n   💍 Casamento: ${dataHora(c.desde)}${c.ate ? ` até ${dataHora(c.ate)}` : ' (ativo)'}`).join('');
            return `${i + 1}. @${parceiro?.numero || 'membro'} — namoro: ${dataHora(r.namoroDesde)} — ${fim}${casamentos}`;
        });
        const mencionados = anteriores.slice(0, 20).flatMap(r => [r.pessoa1.jid, r.pessoa2.jid]);
        return responder(`📜 *HISTÓRICO DE AMOR*\n\n${linhas.join('\n\n')}`, mencionados);
    }

    return false;
}

module.exports = { executarComandoRelacionamento, tratarRespostaRelacionamento };


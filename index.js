// Filtra apenas mensagens rotineiras de manutencao interna do libsignal.
// Elas podem ser emitidas por console.info/warn/error, nao apenas console.log;
// o logger Pino do Baileys nao controla essas chamadas diretas da dependencia.
// Os demais logs, avisos e erros continuam aparecendo normalmente.
const __libsignalPrefixesSilenciosos = [
    /^Closing session:/
];
for (const __metodoConsole of ['log', 'info', 'warn', 'error', 'debug']) {
    const __consoleOriginal = console[__metodoConsole].bind(console);
    console[__metodoConsole] = (...args) => {
        const __primeiroArgumento = args[0];
        const __mensagem = typeof __primeiroArgumento === 'string' ? __primeiroArgumento.trimStart() : '';
        if (__libsignalPrefixesSilenciosos.some(__prefixo => __prefixo.test(__mensagem))) return;
        return __consoleOriginal(...args);
    };
}
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, delay, downloadMediaMessage, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const fs = require('fs');
const path = require('path');
process.chdir(__dirname); // Mantém caminhos relativos ancorados na pasta do Meu Bot.
const readline = require('readline');
// Carrega .env local sem sobrescrever variáveis já fornecidas pelo painel/Termux.
function carregarVariaveisLocais() {
    const arquivo = path.join(__dirname, '.env');
    if (!fs.existsSync(arquivo)) return;
    for (const linhaOriginal of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
        const linha = linhaOriginal.trim();
        if (!linha || linha.startsWith('#')) continue;
        const separador = linha.indexOf('=');
        if (separador <= 0) continue;
        const chave = linha.slice(0, separador).trim();
        let valor = linha.slice(separador + 1).trim();
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(chave)) continue;
        if ((valor.startsWith('"') && valor.endsWith('"')) || (valor.startsWith("'") && valor.endsWith("'"))) {
            valor = valor.slice(1, -1);
        }
        if (valor && (process.env[chave] === undefined || process.env[chave] === '')) process.env[chave] = valor;
    }
}
carregarVariaveisLocais();

// Resolve a autenticação por ambiente. O Termux mantém a pasta histórica;
// a KataBump usa uma pasta externa ao checkout para nunca reutilizar a sessão do celular.
function resolverDiretorioAuthWhatsApp() {
    const configurado = String(process.env.BOT_AUTH_DIR || '').trim();
    const home = String(process.env.HOME || '');
    const emKataBump = Boolean(process.env.KATABUMP || home === '/home/container' || process.cwd().startsWith('/home/container/'));
    let destino;
    if (configurado) destino = path.resolve(configurado);
    else if (emKataBump) destino = '/home/container/suzuke_auth';
    else destino = path.resolve(__dirname, 'sessao_bot_v107');

    if (emKataBump) {
        const relativo = path.relative(__dirname, destino);
        if (!relativo || (relativo !== '..' && !relativo.startsWith('..' + path.sep) && !path.isAbsolute(relativo))) {
            throw new Error('BOT_AUTH_DIR deve apontar para uma pasta persistente fora do código clonado na KataBump.');
        }
    }
    fs.mkdirSync(destino, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(destino, 0o700); } catch (_) {}
    return destino;
}
const DIRETORIO_AUTH_WHATSAPP = resolverDiretorioAuthWhatsApp();

const { checarRespostasInterativas, executarComandoJogo, tratarPrivadoJogos, listarGruposGerenciaveis, encerrarTodosJogosNoGrupo: encerrarJogosGrupo, haJogoAtivoNoGrupo: haJogoAtivoJogos } = require('./jogos');
const { checarRespostasJogos2, executarComandoJogos2, checarVotosQuiz, encerrarTodosJogosNoGrupo: encerrarJogos2Grupo, haJogoAtivoNoGrupo: haJogoAtivoJogos2 } = require('./jogos2');
const { tratarRespostas, euNunca, charadas, quemSouEu, encerrarTodosJogosNoGrupo: encerrarJogosVariadosGrupo, haJogoAtivoNoGrupo: haJogoAtivoVariados } = require('./variados');
const { tratarTikTok } = require('./comandos/tiktok');
const { tratarYouTube } = require('./comandos/youtube');
const { tratarTwitter } = require('./comandos/twitter');
const { tratarSticker, tratarToImg } = require('./comandos/sticker');
const mensagemHandler = require('./mensagem');
const restaurarMensagens = mensagemHandler.restaurarMensagens;
const { executarComandoRelacionamento, tratarRespostaRelacionamento } = require('./relacionamentos');
const atualizador = require('./atualizador');

const CONFIG = {
    prefixo: '!',
    numeroDono: process.env.BOT_OWNER_NUMBER || '',
    numeroDonoSem9: process.env.BOT_OWNER_NUMBER_NO9 || '',
    lidDono: process.env.BOT_OWNER_LID || '',
    lidDonoPuro: process.env.BOT_OWNER_LID_PURO || '',
    senhaMestre: process.env.BOT_MASTER_PASSWORD || '',
    antiFloodAtivo: false,
    antiLinkAtivo: false,
    antiDocAtivo: false,
    antiFakeAtivo: false
};

// Carregar dono salvo se existir
try {
    if (fs.existsSync('./dono.json')) {
        const salvo = JSON.parse(fs.readFileSync('./dono.json', 'utf8'));
        if (salvo.numeroDono) CONFIG.numeroDono = salvo.numeroDono;
        if (salvo.numeroDonoSem9) CONFIG.numeroDonoSem9 = salvo.numeroDonoSem9;
        if (salvo.lidDono) CONFIG.lidDono = salvo.lidDono;
        if (salvo.lidDonoPuro) CONFIG.lidDonoPuro = salvo.lidDonoPuro;
        if (salvo.senhaMestre) CONFIG.senhaMestre = salvo.senhaMestre;
    }
} catch (e) {
    console.error('⚠️ Não foi possível carregar dono.json. Verifique o arquivo local de configuração:', e.message);
}
// Variáveis de ambiente têm prioridade sobre dono.json; sem elas, a configuração local do Termux continua valendo.
for (const [variavel, chave] of Object.entries({
    BOT_OWNER_NUMBER: 'numeroDono',
    BOT_OWNER_NUMBER_NO9: 'numeroDonoSem9',
    BOT_OWNER_LID: 'lidDono',
    BOT_OWNER_LID_PURO: 'lidDonoPuro',
    BOT_MASTER_PASSWORD: 'senhaMestre'
})) {
    const valor = String(process.env[variavel] || '').trim();
    if (valor) CONFIG[chave] = valor;
}
if (!CONFIG.numeroDono && !CONFIG.lidDono) {
    console.error('⚠️ Proprietário não configurado. Preserve dono.json ou configure BOT_OWNER_NUMBER/BOT_OWNER_LID no ambiente.');
}

const comandosBloqueados = new Set();
const historicoMensagens = new Map();
const linksRemovidosRecentes = new Map();
const advertenciasFlood = new Map();
const advertenciasManuais = new Map();
const sessoesGerenciamento = new Map();
const sessoesGerenciamentoGrupo = new Map();
// Destino efetivo para alertas de links: grupo onde o gerenciamento foi iniciado ou PV do gerente.
const destinosGerenciamentoLink = new Map();
const listasGruposComandos = new Map();
const grupoNotificacaoAdmsPorGrupo = new Map();

// Histórico persistente para !adms. Guarda IDs, texto e identificadores PN/LID
// porque Baileys 7 pode entregar o participante em mais de um formato.
const ARQUIVO_MENSAGENS_DENUNCIA = './mensagens_recentes_denuncia.json';
const historicoMensagensDenuncia = new Map();

function desembrulharConteudoDenuncia(conteudo) {
    let atual = conteudo;
    for (let i = 0; i < 12 && atual && typeof atual === 'object'; i++) {
        const proximo = atual.ephemeralMessage?.message
            || atual.viewOnceMessage?.message
            || atual.viewOnceMessageV2?.message
            || atual.viewOnceMessageV2Extension?.message
            || atual.documentWithCaptionMessage?.message
            || atual.deviceSentMessage?.message
            || atual.editedMessage?.message
            || atual.groupMentionedMessage?.message;
        if (!proximo || proximo === atual) break;
        atual = proximo;
    }
    return atual && typeof atual === 'object' ? atual : {};
}

function extrairTextoMensagemDenuncia(conteudo) {
    const m = desembrulharConteudoDenuncia(conteudo);
    return String(
        m.conversation
        || m.extendedTextMessage?.text
        || m.imageMessage?.caption
        || m.videoMessage?.caption
        || m.documentMessage?.caption
        || m.documentWithCaptionMessage?.message?.documentMessage?.caption
        || m.buttonsResponseMessage?.selectedDisplayText
        || m.listResponseMessage?.title
        || m.templateButtonReplyMessage?.selectedDisplayText
        || m.interactiveResponseMessage?.body?.text
        || ''
    ).trim().slice(0, 3000);
}

function encontrarContextoCitacaoDenuncia(entrada) {
    if (!entrada || typeof entrada !== 'object') return null;
    // Aceita tanto a mensagem Baileys inteira quanto apenas o campo .message.
    const raiz = entrada.message && typeof entrada.message === 'object' ? entrada.message : entrada;
    const candidatosDiretos = [
        raiz?.extendedTextMessage?.contextInfo,
        raiz?.imageMessage?.contextInfo,
        raiz?.videoMessage?.contextInfo,
        raiz?.documentMessage?.contextInfo,
        raiz?.audioMessage?.contextInfo,
        raiz?.stickerMessage?.contextInfo,
        raiz?.buttonsResponseMessage?.contextInfo,
        raiz?.listResponseMessage?.contextInfo,
        raiz?.templateButtonReplyMessage?.contextInfo,
        raiz?.interactiveResponseMessage?.contextInfo,
        entrada?.message?.extendedTextMessage?.contextInfo,
        entrada?.message?.imageMessage?.contextInfo,
        entrada?.message?.videoMessage?.contextInfo
    ].filter(c => c && typeof c === 'object');
    const valido = c => Boolean(c && (c.stanzaId || c.quotedMessage || c.participant || c.participantAlt || c.remoteJidAlt || c.mentionedJid?.length));
    const pontuacao = c => (c.quotedMessage ? 100 : 0) + (c.stanzaId ? 50 : 0) + (c.participantAlt ? 30 : 0) + (c.participant ? 20 : 0) + (c.mentionedJid?.length ? 10 : 0);
    const direto = candidatosDiretos.filter(valido).sort((a,b) => pontuacao(b)-pontuacao(a))[0];
    if (direto) return direto;

    // Percorre wrappers do WhatsApp/Baileys e escolhe o contexto mais completo,
    // em vez de retornar o primeiro contexto secundário encontrado.
    const fila = [{ valor: raiz, profundidade: 0 }];
    const vistos = new Set();
    const encontrados = [];
    while (fila.length) {
        const { valor, profundidade } = fila.shift();
        if (!valor || typeof valor !== 'object' || vistos.has(valor) || profundidade > 14) continue;
        vistos.add(valor);
        if (valor.contextInfo && typeof valor.contextInfo === 'object' && valido(valor.contextInfo)) encontrados.push(valor.contextInfo);
        // Algumas versões expõem o contexto sob messageContextInfo.
        if (valor.messageContextInfo && typeof valor.messageContextInfo === 'object' && valido(valor.messageContextInfo)) encontrados.push(valor.messageContextInfo);
        for (const [chave, filho] of Object.entries(valor)) {
            if (filho && typeof filho === 'object' && chave !== 'contextInfo' && chave !== 'messageContextInfo') fila.push({ valor: filho, profundidade: profundidade + 1 });
        }
    }
    return encontrados.sort((a,b) => pontuacao(b)-pontuacao(a))[0] || null;
}

try {
    if (fs.existsSync(ARQUIVO_MENSAGENS_DENUNCIA)) {
        const salvo = JSON.parse(fs.readFileSync(ARQUIVO_MENSAGENS_DENUNCIA, 'utf8'));
        for (const [grupo, mensagens] of Object.entries(salvo || {})) {
            if (Array.isArray(mensagens)) historicoMensagensDenuncia.set(grupo, mensagens.slice(-500));
        }
    }
} catch (e) {
    console.log('Não foi possível carregar o histórico de mensagens de denúncia:', e.message);
}

function salvarHistoricoMensagensDenunciaAgora() {
    try {
        const dados = Object.fromEntries(
            [...historicoMensagensDenuncia.entries()].map(([grupo, mensagens]) => [grupo, mensagens.slice(-500)])
        );
        const temporario = `${ARQUIVO_MENSAGENS_DENUNCIA}.tmp`;
        fs.writeFileSync(temporario, JSON.stringify(dados));
        fs.renameSync(temporario, ARQUIVO_MENSAGENS_DENUNCIA);
    } catch (e) {
        console.log('Erro ao salvar histórico de mensagens para denúncias:', e.message);
    }
}
let timerSalvarHistoricoMensagensDenuncia = null;
function salvarHistoricoMensagensDenuncia() {
    if (timerSalvarHistoricoMensagensDenuncia) return;
    timerSalvarHistoricoMensagensDenuncia = setTimeout(() => {
        timerSalvarHistoricoMensagensDenuncia = null;
        salvarHistoricoMensagensDenunciaAgora();
    }, 1500);
}

function registrarMensagemDenuncia(grupo, msgRecebida, autorFallback, textoFallback) {
    const chave = msgRecebida?.key;
    const idMensagem = chave?.id;
    if (!grupo || !idMensagem) return;

    // No Baileys 7, participantAlt normalmente representa o número telefônico (PN).
    const autorPn = chave?.participantAlt || msgRecebida?.participantAlt || null;
    const autorLid = chave?.participant || msgRecebida?.participant || null;
    const autor = autorPn || autorLid || autorFallback;
    if (!autor || String(autor).endsWith('@g.us')) return;

    const texto = extrairTextoMensagemDenuncia(msgRecebida?.message) || String(textoFallback || '').trim();
    let lista = historicoMensagensDenuncia.get(grupo);
    if (!Array.isArray(lista)) lista = [];
    const registro = {
        id: String(idMensagem),
        autor: String(autor),
        autorPn: autorPn ? String(autorPn) : null,
        autorLid: autorLid ? String(autorLid) : null,
        texto: String(texto || '').slice(0, 3000),
        timestamp: Number(msgRecebida?.messageTimestamp) || Date.now()
    };
    const indice = lista.findIndex(item => String(item?.id || '') === String(idMensagem));
    if (indice >= 0) lista[indice] = registro;
    else lista.push(registro);
    historicoMensagensDenuncia.set(grupo, lista.slice(-500));
    salvarHistoricoMensagensDenuncia();
}

function buscarMensagemDenuncia(grupo, idMensagem) {
    if (!idMensagem) return null;
    const id = String(idMensagem);
    const listaLocal = historicoMensagensDenuncia.get(grupo) || [];
    for (let i = listaLocal.length - 1; i >= 0; i--) {
        if (String(listaLocal[i]?.id || '') === id) return listaLocal[i];
    }
    // O stanzaId é a chave de correlação mais forte; tenta o cache global se o
    // remoteJid do grupo tiver sido normalizado de forma diferente pelo Baileys.
    for (const lista of historicoMensagensDenuncia.values()) {
        for (let i = lista.length - 1; i >= 0; i--) {
            if (String(lista[i]?.id || '') === id) return lista[i];
        }
    }
    return null;
}

function buscarMensagemDenunciaPorTexto(grupo, texto) {
    const normalizar = valor => String(valor || '').replace(/[\s\u200e\u200f]+/g, ' ').trim();
    const procurado = normalizar(texto);
    if (!procurado) return null;
    const listas = [historicoMensagensDenuncia.get(grupo) || [], ...[...historicoMensagensDenuncia.entries()].filter(([g]) => g !== grupo).map(([,lista]) => lista)];
    for (const lista of listas) {
        for (let i = lista.length - 1; i >= 0; i--) {
            if (normalizar(lista[i]?.texto) === procurado) return lista[i];
        }
    }
    return null;
}
const configsGrupos = new Map();
const estatisticasGrupo = new Map();
const confirmacoesReset = new Map();
const ARQUIVO_RESUMO_MENSAGENS = './resumo_mensagens.json';
const sessoesVelha = new Map();
const sessoesTesouro = new Map();
const sessoesJogosNovos = new Map();

function normalizarNumeroJogo(numero) { return String(numero || '').replace(/\D/g, ''); }
function chaveSessaoIndividual(grupo, numero) { return `${grupo}|${normalizarNumeroJogo(numero)}`; }
function localizarSessaoPorMensagem(map, grupo, messageId) {
    for (const [chave, sessao] of map.entries()) {
        if (sessao?.grupo === grupo && sessao?.messageId === messageId) return { chave, sessao };
    }
    return null;
}
function membroTemSessaoIndividual(grupo, numero) {
    const n = normalizarNumeroJogo(numero);
    const pertence = sessao => sessao?.grupo === grupo && normalizarNumeroJogo(sessao?.jogador?.numero) === n;
    return [...sessoesTesouro.values(), ...sessoesJogosNovos.values()].some(pertence);
}
function existeEventoIndividualNoGrupo(grupo) {
    return [...sessoesTesouro.values(), ...sessoesJogosNovos.values()].some(sessao => sessao?.grupo === grupo);
}
function haQualquerJogoAtivoGlobal(grupo) {
    return haJogoAtivoGlobal(grupo) || existeEventoIndividualNoGrupo(grupo);
}
function encerrarSessoesIndividuaisDoGrupo(grupo) {
    let encerrou = false;
    for (const map of [sessoesTesouro, sessoesJogosNovos]) {
        for (const [chave, sessao] of map.entries()) {
            if (sessao?.grupo !== grupo) continue;
            if (sessao.timer) clearTimeout(sessao.timer);
            map.delete(chave);
            encerrou = true;
        }
    }
    return encerrou;
}
const mensagensLojaPorGrupo = new Map();
let historicoResumoGrupo = {};
try {
    historicoResumoGrupo = fs.existsSync(ARQUIVO_RESUMO_MENSAGENS)
        ? JSON.parse(fs.readFileSync(ARQUIVO_RESUMO_MENSAGENS, 'utf8')) : {};
    if (!historicoResumoGrupo || typeof historicoResumoGrupo !== 'object' || Array.isArray(historicoResumoGrupo)) historicoResumoGrupo = {};
} catch (e) { historicoResumoGrupo = {}; }
function registrarMensagemParaResumo(grupo, nome, numero, texto) {
    const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
    if (!grupo || !limpo || limpo.startsWith(CONFIG.prefixo)) return;
    if (!Array.isArray(historicoResumoGrupo[grupo])) historicoResumoGrupo[grupo] = [];
    historicoResumoGrupo[grupo].push({ nome: String(nome || 'Membro'), numero: String(numero || ''), texto: limpo.slice(0, 1000), timestamp: Date.now() });
    historicoResumoGrupo[grupo] = historicoResumoGrupo[grupo].slice(-50);
    try {
        const tmp = `${ARQUIVO_RESUMO_MENSAGENS}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify(historicoResumoGrupo));
        fs.renameSync(tmp, ARQUIVO_RESUMO_MENSAGENS);
    } catch (e) { console.log('Erro ao salvar histórico do resumo:', e.message); }
}
function montarResumoGrupo(grupo) {
    const mensagens = Array.isArray(historicoResumoGrupo[grupo]) ? historicoResumoGrupo[grupo].slice(-50) : [];
    if (mensagens.length < 2) {
        return '📋 Ainda não há conversa suficiente para resumir. O bot precisa registrar pelo menos duas mensagens de texto sobre um assunto.';
    }

    const normalizar = valor => String(valor || '').toLocaleLowerCase('pt-BR')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/https?:\/\/\S+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ').trim();

    // Vocabulário explícito: o bot só relata temas que aparecem nas mensagens.
    const temas = [
        { nome: 'jogos', palavras: ['jogo', 'jogos', 'game', 'games', 'gamer', 'minecraft', 'roblox', 'free fire', 'valorant', 'fortnite', 'playstation', 'xbox', 'nintendo'] },
        { nome: 'futebol', palavras: ['futebol', 'gol', 'gols', 'partida', 'campeonato', 'brasileirao', 'copa', 'time', 'times', 'jogador', 'jogadores', 'flamengo', 'corinthians', 'vasco', 'palmeiras', 'santos', 'real madrid', 'barcelona'] },
        { nome: 'esportes', palavras: ['esporte', 'esportes', 'basquete', 'volei', 'tenis', 'corrida', 'academia', 'treino'] },
        { nome: 'escola e estudos', palavras: ['escola', 'colegio', 'aula', 'prova', 'professor', 'materia', 'estudar', 'estudo', 'faculdade', 'curso'] },
        { nome: 'trabalho', palavras: ['trabalho', 'emprego', 'chefe', 'salario', 'cliente', 'empresa', 'reuniao', 'servico'] },
        { nome: 'música', palavras: ['musica', 'musicas', 'cantor', 'cantora', 'album', 'show', 'banda', 'playlist', 'funk', 'rap', 'sertanejo'] },
        { nome: 'filmes e séries', palavras: ['filme', 'filmes', 'serie', 'series', 'episodio', 'temporada', 'netflix', 'anime', 'animes', 'personagem'] },
        { nome: 'tecnologia', palavras: ['celular', 'telefone', 'computador', 'pc', 'notebook', 'internet', 'aplicativo', 'app', 'software', 'hardware', 'inteligencia artificial', 'ia'] },
        { nome: 'dinheiro e economia', palavras: ['dinheiro', 'pix', 'preco', 'precos', 'comprar', 'vender', 'venda', 'moeda', 'economia', 'pagamento'] },
        { nome: 'comida', palavras: ['comida', 'almoco', 'jantar', 'lanche', 'pizza', 'hamburguer', 'receita', 'comer', 'restaurante'] },
        { nome: 'relacionamentos', palavras: ['namoro', 'namorada', 'namorado', 'relacionamento', 'ficante', 'casamento', 'terminar', 'paquera'] },
        { nome: 'eventos e encontros', palavras: ['festa', 'aniversario', 'evento', 'encontro', 'churrasco', 'role'] },
        { nome: 'viagens', palavras: ['viagem', 'viajar', 'viajando', 'ferias', 'hotel', 'praia', 'passagem', 'turismo'] }
    ];

    const ocorrencias = new Map();
    for (let i = 0; i < mensagens.length; i++) {
        const m = mensagens[i] || {};
        const texto = normalizar(m.texto);
        if (!texto) continue;
        for (const tema of temas) {
            const encontrou = tema.palavras.some(palavra => {
                const termo = normalizar(palavra);
                if (termo.includes(' ')) return (` ${texto} `).includes(` ${termo} `);
                return new RegExp(`(^| )${termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(s|es)?( |$)`).test(texto);
            });
            if (encontrou) {
                if (!ocorrencias.has(tema.nome)) ocorrencias.set(tema.nome, []);
                ocorrencias.get(tema.nome).push({ ...m, indice: i });
            }
        }
    }

    const resumos = [];
    for (const [tema, itens] of ocorrencias) {
        const blocos = [];
        let bloco = [];
        for (const item of itens) {
            if (bloco.length && item.indice - bloco[bloco.length - 1].indice > 8) {
                if (bloco.length >= 2) blocos.push(bloco);
                bloco = [];
            }
            bloco.push(item);
        }
        if (bloco.length >= 2) blocos.push(bloco);

        for (const grupoTema of blocos) {
            const participantes = [];
            const vistos = new Set();
            for (const item of grupoTema) {
                const nome = String(item.nome || 'Membro').replace(/[\r\n]/g, ' ').trim().slice(0, 40);
                const chave = normalizar(nome);
                if (chave && !vistos.has(chave)) { vistos.add(chave); participantes.push(nome); }
            }
            if (participantes.length < 2) continue;
            const nomes = participantes.length <= 4 ? participantes.join(', ')
                : `${participantes.slice(0, 3).join(', ')} e mais ${participantes.length - 3}`;
            resumos.push({ inicio: grupoTema[0].indice, texto: `• ${nomes} estavam conversando sobre ${tema}.` });
        }
    }

    resumos.sort((a, b) => a.inicio - b.inicio);
    const unicos = [];
    const vistosResumo = new Set();
    for (const item of resumos) if (!vistosResumo.has(item.texto)) {
        vistosResumo.add(item.texto); unicos.push(item.texto);
    }

    if (!unicos.length) {
        return '📋 Não consegui identificar com segurança um assunto conversado por pelo menos duas pessoas nas últimas mensagens. Para evitar um resumo desconexo, não vou atribuir assuntos ou participantes por suposição.';
    }
    return `📝 *RESUMO DAS CONVERSAS DO GRUPO*\n\n${unicos.slice(0, 8).join('\n')}\n\nℹ️ Resumo baseado nas últimas ${mensagens.length} mensagens de texto registradas. Só lista assuntos identificados em mensagens próximas de pelo menos duas pessoas; as mensagens originais não são exibidas.`;
}
const tempoInicial = Date.now();
const ARQUIVO_ESTADO = './estado_bot.json';

const ARQUIVO_MUTADOS = './mutados.json';
const ARQUIVO_INATIVOS_NOTIFICADOS = './inativos_notificados.json';
const ARQUIVO_ULTIMAS_MENSAGENS = './ultimas_mensagens_membros.json';
const ultimasMensagensPersistidas = lerJson(ARQUIVO_ULTIMAS_MENSAGENS, {});
const ARQUIVO_FILA_ANTIFAKE1 = './fila_antifake1.json';
let filaAvisosAntiFake1Persistente = lerJson(ARQUIVO_FILA_ANTIFAKE1, {});
let inativosNotificados = {};
const ARQUIVO_MEMBROS_ANTIGOS = './membros_antigos.json';
let mutados = {};
let membrosAntigos = {};
const ultimaMensagemMembro = new Map();
let socketGlobal = null;
let timerAntiInativos = null;
let botIniciando = false;
let timerReconexaoBot = null;
let tentativasReconexaoBot = 0;
let ultimaTentativaReconexaoBot = null;
let ultimaDesconexaoBot = null;
let estadoConexaoBot = 'iniciando';
let sessaoWhatsAppRegistrada = false;
let reconexaoPorRevogacaoEmAndamento = false;
const MAX_TENTATIVAS_RECONEXAO = Number.MAX_SAFE_INTEGER; // reconexão contínua, com intervalo limitado a 5 minutos
const INTERVALO_RECONEXAO_BASE = 2000;
const INTERVALO_RECONEXAO_MAX = 5 * 60 * 1000;
const mensagensProcessadas = new Set();
function registrarIdProcessado(id) { if (!id) return false; if (mensagensProcessadas.has(id)) return true; mensagensProcessadas.add(id); if (mensagensProcessadas.size > 5000) mensagensProcessadas.clear(); mensagensProcessadas.add(id); return false; }
function lerJson(caminho, padrao = {}) { try { return fs.existsSync(caminho) ? JSON.parse(fs.readFileSync(caminho, 'utf8')) : padrao; } catch (e) { return padrao; } }
function salvarJsonImediato(caminho, dados) { try { fs.writeFileSync(caminho, JSON.stringify(dados, null, 2)); } catch (e) { console.log(`Erro ao salvar ${caminho}:`, e.message); } }
inativosNotificados = lerJson(ARQUIVO_INATIVOS_NOTIFICADOS, {});
mutados = lerJson(ARQUIVO_MUTADOS, {});
membrosAntigos = lerJson(ARQUIVO_MEMBROS_ANTIGOS, {});
function numeroCanonico(id) { return String(id || '').toLowerCase().replace(/:[0-9]+(?=@)/, '').replace(/@.*$/, '').replace(/[^0-9a-z]/g, ''); }
function chavePessoa(grupo, jid) { return `${grupo}|${numeroCanonico(jid)}`; }
function ehMembroAntigo(grupo, jid) { return (membrosAntigos[grupo] || []).some(x => numeroCanonico(x) === numeroCanonico(jid)); }
function ehMutado(grupo, jid) { return (mutados[grupo] || []).some(x => numeroCanonico(x) === numeroCanonico(jid)); }
function salvarMutados() { salvarJsonImediato(ARQUIVO_MUTADOS, mutados); }
function salvarMembrosAntigos() { salvarJsonImediato(ARQUIVO_MEMBROS_ANTIGOS, membrosAntigos); }
async function verificarAntiInativos(sock, grupoForcado=null) {
 const grupos = grupoForcado ? [grupoForcado] : Array.from(new Set([...configsGrupos.keys(), ...Object.keys(lerJson(ARQUIVO_ESTADO,{}).configsGrupos || {})]));
 for (const grupo of grupos) {
  const cfg=getGrupoConfig(grupo); if (!cfg.antiInativos?.ativo || !grupo.endsWith('@g.us')) continue;
  const inicio=Date.parse(cfg.antiInativos.ativadoEm||''); if (!Number.isFinite(inicio) || Date.now()-inicio < 5*24*60*60*1000) continue;
  try {
   const meta=await sock.groupMetadata(grupo); const agora=Date.now(); const inativos=[];
   for (const p of (meta.participants||[])) {
    const ids=[p.id,p.jid,p.lid,p.phoneNumber].filter(Boolean); const botId=numeroCanonico(sock.user?.id); if(ids.some(x=>numeroCanonico(x)===botId)) continue;
    const jid=ids[0]; if(!jid) continue; const ts=ultimaMensagemMembro.get(chavePessoa(grupo,jid)) || ultimasMensagensPersistidas[chavePessoa(grupo,jid)];
    if(!ts || agora-ts>5*24*60*60*1000) inativos.push(jid);
   }
   const jaNotificados=new Set(inativosNotificados[grupo]||[]); const pendentes=inativos.filter(x=>!jaNotificados.has(numeroCanonico(x))); const bloco=pendentes.slice(0,10); if(bloco.length){await sock.sendMessage(grupo,{text:`⚠️ *MEMBROS INATIVOS HÁ 5 DIAS OU MAIS*\n\n${bloco.map(x=>`@${x.split('@')[0]}`).join(' ') }\n\nEsses membros estão há 5 dias ou mais sem enviar mensagens. ⚠️ *Atenção: membros que continuarem inativos podem ser removidos do grupo pela administração.* Para evitar isso, voltem a participar do grupo!`,mentions:bloco});for(const x of bloco)jaNotificados.add(numeroCanonico(x));inativosNotificados[grupo]=Array.from(jaNotificados);salvarJsonImediato(ARQUIVO_INATIVOS_NOTIFICADOS,inativosNotificados);}
  } catch(e) { console.log('Erro ao verificar anti-inativos:',e.message); }
 }
}

function carregarEstadoBot() {
    try {
        if (!fs.existsSync(ARQUIVO_ESTADO)) return;
        const salvo = JSON.parse(fs.readFileSync(ARQUIVO_ESTADO, 'utf8'));
        for (const [id, cfg] of Object.entries(salvo.configsGrupos || {})) configsGrupos.set(id, cfg);
        for (const [id, mapa] of Object.entries(salvo.estatisticasGrupo || {})) estatisticasGrupo.set(id, new Map(Object.entries(mapa)));
        for (const [id, qtd] of Object.entries(salvo.advertenciasManuais || {})) advertenciasManuais.set(id, qtd);
        for (const [id, qtd] of Object.entries(salvo.advertenciasFlood || {})) advertenciasFlood.set(id, qtd);
        for (const [id, grupoDestino] of Object.entries(salvo.grupoNotificacaoAdmsPorGrupo || {})) grupoNotificacaoAdmsPorGrupo.set(id, grupoDestino);
    } catch (e) {}
}

let estadoSalvarTimer = null;
function gravarEstadoBotAgora() {
    try {
        const estatisticas = {};
        for (const [id, mapa] of estatisticasGrupo.entries()) estatisticas[id] = Object.fromEntries(mapa);
        const estado = {
            configsGrupos: Object.fromEntries(configsGrupos),
            estatisticasGrupo: estatisticas,
            advertenciasManuais: Object.fromEntries(advertenciasManuais),
            advertenciasFlood: Object.fromEntries(advertenciasFlood),
            grupoNotificacaoAdmsPorGrupo: Object.fromEntries(grupoNotificacaoAdmsPorGrupo)
        };
        const temporario = `${ARQUIVO_ESTADO}.tmp`;
        fs.writeFileSync(temporario, JSON.stringify(estado, null, 2));
        fs.renameSync(temporario, ARQUIVO_ESTADO);
    } catch (e) { console.log('Erro ao salvar estado do bot:', e.message); }
}
function salvarEstadoBot() {
    if (estadoSalvarTimer) clearTimeout(estadoSalvarTimer);
    estadoSalvarTimer = setTimeout(() => { estadoSalvarTimer = null; gravarEstadoBotAgora(); }, 250);
}
process.on('beforeExit', () => { if (estadoSalvarTimer) clearTimeout(estadoSalvarTimer); gravarEstadoBotAgora(); salvarEconomiaSeguro(); });
process.on('SIGINT', () => { if (timerSalvarHistoricoMensagensDenuncia) { clearTimeout(timerSalvarHistoricoMensagensDenuncia); timerSalvarHistoricoMensagensDenuncia = null; salvarHistoricoMensagensDenunciaAgora(); } if (estadoSalvarTimer) clearTimeout(estadoSalvarTimer); gravarEstadoBotAgora(); salvarEconomiaSeguro(); process.exit(0); });
process.on('SIGTERM', () => { if (timerSalvarHistoricoMensagensDenuncia) { clearTimeout(timerSalvarHistoricoMensagensDenuncia); timerSalvarHistoricoMensagensDenuncia = null; salvarHistoricoMensagensDenunciaAgora(); } if (estadoSalvarTimer) clearTimeout(estadoSalvarTimer); gravarEstadoBotAgora(); salvarEconomiaSeguro(); process.exit(0); });
process.on('uncaughtException', (erro) => {
    console.error('Erro fatal não tratado:', erro);
    try { if (estadoSalvarTimer) clearTimeout(estadoSalvarTimer); gravarEstadoBotAgora(); salvarEconomiaSeguro(); salvarHistoricoMensagensDenuncia(); } catch (e) {}
    // Mantém o processo vivo após registrar o erro, evitando queda desnecessária do bot.
});
process.on('unhandledRejection', (erro) => {
    console.error('Promessa rejeitada sem tratamento:', erro);
    try { gravarEstadoBotAgora(); salvarEconomiaSeguro(); salvarHistoricoMensagensDenuncia(); } catch (e) {}
});

carregarEstadoBot();

const ARQUIVO_ECONOMIA = './economia_brincadeira.json';
let dadosEconomia = {};
try { dadosEconomia = fs.existsSync(ARQUIVO_ECONOMIA) ? JSON.parse(fs.readFileSync(ARQUIVO_ECONOMIA, 'utf8')) : {}; } catch (e) { dadosEconomia = {}; }
function salvarEconomiaSeguro() { try { const tmp = `${ARQUIVO_ECONOMIA}.tmp`; fs.writeFileSync(tmp, JSON.stringify(dadosEconomia, null, 2)); fs.renameSync(tmp, ARQUIVO_ECONOMIA); } catch (e) { console.log('Erro ao salvar economia:', e.message); } }
function salvarEconomia() { salvarEconomiaSeguro(); }
function estadoEconomia(grupo) { if (!dadosEconomia[grupo]) dadosEconomia[grupo] = { membros: {}, roubos: {} }; if (!dadosEconomia[grupo].membros) dadosEconomia[grupo].membros = {}; if (!dadosEconomia[grupo].roubos) dadosEconomia[grupo].roubos = {}; return dadosEconomia[grupo]; }
function membroEconomia(grupo, numero) {
    const e = estadoEconomia(grupo);
    if (!e.membros[numero]) e.membros[numero] = { moedas: 0, xp: 0, ultimoXp: 0, missaoDia: '', mensagensDia: 0, roubouEm: 0, inventario: [], protecaoRoubos: 0, armadilhas: 0, sorteRoubos: 0, comandosDia: 0, stickersDia: 0, roubosTentadosDia: 0, roletaEm: 0, cooldownJogosEconomia: 0, cooldownTesouro: 0, cooldownCopos: 0, cooldownDesarme: 0 };
    const m = e.membros[numero]; if (!Array.isArray(m.inventario)) m.inventario = [];
    // Migra proteções compradas antes desta versão para quatro bloqueios por compra.
    if (!Object.prototype.hasOwnProperty.call(m, 'protecaoRoubos')) {
        const antigas = m.inventario.filter(x => x && x.item === 'protecao').reduce((total, x) => total + Math.max(1, Number(x.quantidade) || 1), 0);
        m.protecaoRoubos = antigas * 4;
    }
    for (const k of ['protecaoRoubos','armadilhas','sorteRoubos','comandosDia','stickersDia','roubosTentadosDia','roletaEm','cooldownJogosEconomia','cooldownTesouro','cooldownCopos','cooldownDesarme']) if (!Number.isFinite(Number(m[k]))) m[k] = 0;
    return m;
}
function creditarMissao(membro, id, recompensa) { garantirMissaoDia(membro); if (membro.missoesResgatadas.includes(id)) return false; membro.missoesResgatadas.push(id); membro.moedas = (Number(membro.moedas) || 0) + recompensa; return true; }
function premiarJogo(grupo, numero, moedas, xp, jid) { const eco = membroEconomia(grupo, numero); const nivelAntes = nivelDoXp(eco.xp).nivel; eco.moedas = Math.max(0, Number(eco.moedas) || 0) + moedas; eco.xp = Math.max(0, Number(eco.xp) || 0) + xp; if (jid) eco.jid = jid; salvarEconomia(); return { moedas: eco.moedas, xp: eco.xp, nivelAntes, nivelDepois: nivelDoXp(eco.xp).nivel }; }
const COOLDOWN_JOGOS_ECONOMIA_MS = 15 * 60 * 1000;
function campoCooldownJogo(jogo) { const normalizado = String(jogo || '').toLowerCase(); return normalizado === 'tesouro' ? 'cooldownTesouro' : (['copo','copos'].includes(normalizado) ? 'cooldownCopos' : 'cooldownDesarme'); }
function tempoRestanteJogosEconomia(grupo, numero, jogo) { const eco = membroEconomia(grupo, numero); const campo = campoCooldownJogo(jogo); return Math.max(0, COOLDOWN_JOGOS_ECONOMIA_MS - (Date.now() - (Number(eco[campo]) || 0))); }
function registrarJogoEconomia(grupo, numero, jogo) { const eco = membroEconomia(grupo, numero); eco[campoCooldownJogo(jogo)] = Date.now(); salvarEconomia(); }
async function premiarPodioEconomia(grupo, ranking, nomeJogo, sock = global.__botSockPremiosPodio) {
    const premios = [{ moedas: 150, xp: 100 }, { moedas: 100, xp: 75 }, { moedas: 50, xp: 50 }];
    const medalhas = ['🥇', '🥈', '🥉']; const linhas = []; const mentions = [];
    for (let i = 0; i < Math.min(3, ranking.length); i++) {
        const item = ranking[i]; const numero = String(item.numero || item.jid || '').replace(/@.*$/, '').replace(/\D/g, '');
        if (!numero) continue; const jidPremiado = item.jid && String(item.jid).includes('@') ? item.jid : `${numero}@s.whatsapp.net`;
        const premio = premios[i]; const saldo = premiarJogo(grupo, numero, premio.moedas, premio.xp, jidPremiado);
        linhas.push(`${medalhas[i]} @${numero}: +${premio.moedas} moedas e +${premio.xp} XP`); mentions.push(jidPremiado);
    }
    if (linhas.length && sock) await sock.sendMessage(grupo, { text: `🎁 *RECOMPENSAS DO PÓDIO — ${nomeJogo.toUpperCase()}*\n\n${linhas.join('\n')}`, mentions });
}

function xpParaNivel(nivel) { return Math.max(100, nivel * 100); }
function nivelDoXp(xp) { let nivel = 1, restante = Math.max(0, Number(xp) || 0); while (restante >= xpParaNivel(nivel)) { restante -= xpParaNivel(nivel); nivel++; if (nivel > 10000) break; } return { nivel, progresso: restante, necessario: xpParaNivel(nivel) }; }
function diaEconomia() {
    const partes = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const valores = Object.fromEntries(partes.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return `${valores.year}-${valores.month}-${valores.day}`;
}
function garantirMissaoDia(membro) { const hoje = diaEconomia(); if (membro.missaoDia !== hoje) { membro.missaoDia = hoje; membro.mensagensDia = 0; membro.comandosDia = 0; membro.stickersDia = 0; membro.roubosTentadosDia = 0; membro.diarioDia = ''; membro.missoesResgatadas = []; } if (!Array.isArray(membro.missoesResgatadas)) membro.missoesResgatadas = []; }
function pessoaConfereJogador(jogador, jidAtual, numeroAtual) {
    if (!jogador) return false;
    if (jogador.jid && jidAtual && String(jogador.jid) === String(jidAtual)) return true;
    const a = String(jogador.numero || '').replace(/\D/g, '');
    const b = String(numeroAtual || '').replace(/\D/g, '');
    return !!a && !!b && a === b;
}
function renderizarTabuleiroVelha(tabuleiro) {
    const celulas = tabuleiro.map((v, i) => v || String(i + 1));
    return `╭───┬───┬───╮\n│ ${celulas[0]} │ ${celulas[1]} │ ${celulas[2]} │\n├───┼───┼───┤\n│ ${celulas[3]} │ ${celulas[4]} │ ${celulas[5]} │\n├───┼───┼───┤\n│ ${celulas[6]} │ ${celulas[7]} │ ${celulas[8]} │\n╰───┴───┴───╯`;
}
function vencedorVelha(tabuleiro) {
    const linhas = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const linha of linhas) if (tabuleiro[linha[0]] && tabuleiro[linha[0]] === tabuleiro[linha[1]] && tabuleiro[linha[1]] === tabuleiro[linha[2]]) return tabuleiro[linha[0]];
    return '';
}
async function processarRespostaJogosExtras(sock, msg, from, isGroup, corpoMsg, numeroAtual, jidAtual, isDono, isAdm) {
    global.__botSockPremiosPodio = sock;
    if (!isGroup) return false;
    const contexto = msg.message?.extendedTextMessage?.contextInfo;
    const idCitado = contexto?.stanzaId;
    if (!idCitado) return false;
    const texto = String(corpoMsg || '').trim().toLowerCase();
    const sessaoVelha = sessoesVelha.get(from);
    if (sessaoVelha && sessaoVelha.messageId === idCitado) {
        const responder = async (textoResposta, mencoes = []) => {
            const enviado = await sock.sendMessage(from, { text: textoResposta, ...(mencoes.length ? { mentions: mencoes } : {}) }, { quoted: msg });
            if (enviado?.key?.id) sessaoVelha.messageId = enviado.key.id;
            return enviado;
        };
        if (sessaoVelha.status === 'desafio') {
            if (!pessoaConfereJogador(sessaoVelha.desafiado, jidAtual, numeroAtual)) {
                await responder('⚠️ Só a pessoa desafiada pode responder a este convite.');
                return true;
            }
            if (!['sim','s','não','nao','n'].includes(texto)) return false;
            if (['não','nao','n'].includes(texto)) {
                sessoesVelha.delete(from);
                await responder('❌ Desafio recusado.');
                return true;
            }
            sessaoVelha.status = 'jogando';
            sessaoVelha.tabuleiro = Array(9).fill('');
            sessaoVelha.turno = 0;
            sessaoVelha.jogadores = [sessaoVelha.desafiante, sessaoVelha.desafiado];
            sessaoVelha.jogadores[0].marca = '❌';
            sessaoVelha.jogadores[1].marca = '⭕';
            const textoTabuleiro = `🎮 *JOGO DA VELHA*\n❌ @${sessaoVelha.jogadores[0].numero} contra ⭕ @${sessaoVelha.jogadores[1].numero}\n\n${renderizarTabuleiroVelha(sessaoVelha.tabuleiro)}\n\nÉ a vez de ❌ @${sessaoVelha.jogadores[0].numero}. Responda a esta mensagem com o número de 1 a 9 da posição escolhida. Sempre responda à mensagem mais recente do tabuleiro.`;
            const enviado = await responder(textoTabuleiro, [sessaoVelha.jogadores[0].jid, sessaoVelha.jogadores[1].jid]);
            if (enviado?.key?.id) sessaoVelha.messageId = enviado.key.id;
            return true;
        }
        if (sessaoVelha.status === 'jogando') {
            const numeroCasa = Number(texto);
            if (!Number.isInteger(numeroCasa) || numeroCasa < 1 || numeroCasa > 9) return false;
            const jogadorAtual = sessaoVelha.jogadores[sessaoVelha.turno];
            if (!pessoaConfereJogador(jogadorAtual, jidAtual, numeroAtual)) {
                const enviado = await responder(`⏳ Ainda não é sua vez. Agora joga ${jogadorAtual.marca} @${jogadorAtual.numero}.\n\n${renderizarTabuleiroVelha(sessaoVelha.tabuleiro)}`, [jogadorAtual.jid]);
                if (enviado?.key?.id) sessaoVelha.messageId = enviado.key.id;
                return true;
            }
            if (sessaoVelha.tabuleiro[numeroCasa - 1]) {
                const enviado = await responder(`⚠️ Essa posição já está ocupada. Escolha outra de 1 a 9.\n\n${renderizarTabuleiroVelha(sessaoVelha.tabuleiro)}`);
                if (enviado?.key?.id) sessaoVelha.messageId = enviado.key.id;
                return true;
            }
            sessaoVelha.tabuleiro[numeroCasa - 1] = jogadorAtual.marca;
            const vitoria = vencedorVelha(sessaoVelha.tabuleiro);
            const empate = !vitoria && sessaoVelha.tabuleiro.every(Boolean);
            if (vitoria || empate) {
                const tabuleiroFinal = renderizarTabuleiroVelha(sessaoVelha.tabuleiro);
                if (vitoria) {
                    const vencedor = sessaoVelha.jogadores.find(j => j.marca === vitoria);
                    const ecoVencedor = membroEconomia(from, vencedor.numero);
                    ecoVencedor.xp = (Number(ecoVencedor.xp) || 0) + 100;
                    ecoVencedor.moedas = (Number(ecoVencedor.moedas) || 0) + 75;
                    salvarEconomia();
                    sessoesVelha.delete(from);
                    await sock.sendMessage(from, { text: `🏆 *FIM DE JOGO!*\n${tabuleiroFinal}\n\n🎉 Vitória de ${vencedor.marca} @${vencedor.numero}! Recompensa: +100 XP e +75 moedas.`, mentions: [vencedor.jid] }, { quoted: msg });
                } else {
                    for (const jogador of sessaoVelha.jogadores) { const ecoEmpate = membroEconomia(from, jogador.numero); ecoEmpate.xp = (Number(ecoEmpate.xp) || 0) + 25; }
                    salvarEconomia();
                    sessoesVelha.delete(from);
                    await sock.sendMessage(from, { text: `🤝 *EMPATE!*\n${tabuleiroFinal}\n\nCada jogador recebeu +25 XP.`, mentions: sessaoVelha.jogadores.map(j => j.jid) }, { quoted: msg });
                }
                return true;
            }
            sessaoVelha.turno = 1 - sessaoVelha.turno;
            const proximo = sessaoVelha.jogadores[sessaoVelha.turno];
            const enviado = await responder(`🎮 *JOGO DA VELHA*\n\n${renderizarTabuleiroVelha(sessaoVelha.tabuleiro)}\n\nAgora é a vez de ${proximo.marca} @${proximo.numero}. Responda a esta mensagem com o número de 1 a 9.`, [proximo.jid]);
            if (enviado?.key?.id) sessaoVelha.messageId = enviado.key.id;
            return true;
        }
    }
    const entradaTesouro = localizarSessaoPorMensagem(sessoesTesouro, from, idCitado);
    const sessaoTesouro = entradaTesouro?.sessao;
    if (sessaoTesouro) {
        if (!pessoaConfereJogador(sessaoTesouro.jogador, jidAtual, numeroAtual)) {
            await sock.sendMessage(from, { text: '⚠️ Só a pessoa que iniciou esta caça ao tesouro pode escolher um baú.', mentions: [jidAtual] }, { quoted: msg });
            return true;
        }
        const escolha = Number(texto);
        if (!Number.isInteger(escolha) || escolha < 1 || escolha > 3) return false;
        sessoesTesouro.delete(entradaTesouro.chave);
        const eco = membroEconomia(from, numeroAtual);
        const sorteio = Math.random();
        let resultado;
        if (sorteio < 0.10) { eco.moedas = (Number(eco.moedas) || 0) + 200; eco.xp = (Number(eco.xp) || 0) + 100; resultado = '🏆 Baú lendário! Você ganhou 200 moedas e 100 XP.'; }
        else if (sorteio < 0.75) { eco.moedas = (Number(eco.moedas) || 0) + 40; eco.xp = (Number(eco.xp) || 0) + 30; resultado = '💰 Baú comum! Você ganhou 40 moedas e 30 XP.'; }
        else if (Math.random() < 0.5) { eco.moedas = Math.max(0, (Number(eco.moedas) || 0) - 50); resultado = '🪤 Armadilha! Você perdeu até 50 moedas.'; }
        else { eco.xp = Math.max(0, (Number(eco.xp) || 0) - 25); resultado = '🕳️ Armadilha! Você perdeu até 25 XP.'; }
        salvarEconomia();
        await sock.sendMessage(from, { text: `🗝️ @${numeroAtual} escolheu o baú ${escolha}.\n\n${resultado}\n🪙 Saldo: ${eco.moedas} moedas | ✨ XP: ${eco.xp}.`, mentions: [jidAtual] }, { quoted: msg });
        return true;
    }
    const entradaExtra = localizarSessaoPorMensagem(sessoesJogosNovos, from, idCitado);
    const sessaoExtra = entradaExtra?.sessao;
    if (sessaoExtra) {
        if (!pessoaConfereJogador(sessaoExtra.jogador, jidAtual, numeroAtual)) {
            await sock.sendMessage(from, { text: '⚠️ Só quem iniciou este jogo pode responder. Responda à mensagem mais recente do jogo.', mentions: [jidAtual] }, { quoted: msg });
            return true;
        }
        const resposta = String(texto || '').trim();
        const enviarProxima = async (textoSaida) => {
            const enviado = await sock.sendMessage(from, { text: textoSaida, mentions: [jidAtual] }, { quoted: msg });
            if (enviado?.key?.id) sessaoExtra.messageId = enviado.key.id;
            return enviado;
        };
        if (sessaoExtra.tipo === 'desarme') {
            if (!/^\d{4}$/.test(resposta)) {
                await enviarProxima('⚠️ Digite uma sequência de exatamente 4 dígitos, respondendo a esta mensagem.');
                return true;
            }
            sessaoExtra.tentativas++;
            if (resposta === sessaoExtra.codigo) {
                clearTimeout(sessaoExtra.timer); sessoesJogosNovos.delete(entradaExtra.chave);
                const recompensa = premiarJogo(from, numeroAtual, Math.max(40, 120 - (sessaoExtra.tentativas - 1) * 10), 60, jidAtual);
                await sock.sendMessage(from, { text: `💣 *BOMBA DESARMADA!* @${numeroAtual} acertou o código em ${sessaoExtra.tentativas} tentativa(s)!
🎁 Recompensa: ${Math.max(40, 120 - (sessaoExtra.tentativas - 1) * 10)} moedas e 60 XP.
🪙 Saldo: ${recompensa.moedas} moedas | ✨ XP: ${recompensa.xp}.`, mentions: [jidAtual] }, { quoted: msg });
                return true;
            }
            if (sessaoExtra.tentativas >= 6) {
                clearTimeout(sessaoExtra.timer); sessoesJogosNovos.delete(entradaExtra.chave);
                await sock.sendMessage(from, { text: `💥 *TEMPO ESGOTADO NAS TENTATIVAS!* O código era *${sessaoExtra.codigo}*.`, mentions: [jidAtual] }, { quoted: msg });
                return true;
            }
            const pistas = resposta.split('').map((d, i) => d === sessaoExtra.codigo[i] ? '🟩' : (sessaoExtra.codigo.includes(d) ? '🟨' : '⬛')).join(' ');
            await enviarProxima(`💣 Código incorreto! Pista: ${pistas}\nTentativa ${sessaoExtra.tentativas}/6. Restam ${6 - sessaoExtra.tentativas}. Responda com 4 dígitos.`);
            return true;
        }
        if (sessaoExtra.tipo === 'premio') {
            if (!/^\d{1,3}$/.test(resposta) || Number(resposta) < 1 || Number(resposta) > 100) {
                await enviarProxima('⚠️ Digite um número de 1 a 100, respondendo a esta mensagem.');
                return true;
            }
            const palpite = Number(resposta); sessaoExtra.tentativas++;
            if (palpite === sessaoExtra.numero) {
                clearTimeout(sessaoExtra.timer); sessoesJogosNovos.delete(entradaExtra.chave);
                const moedasPremio = Math.max(30, 150 - (sessaoExtra.tentativas - 1) * 10);
                const recompensa = premiarJogo(from, numeroAtual, moedasPremio, 75, jidAtual);
                await sock.sendMessage(from, { text: `🎉 *VOCÊ ENCONTROU O PRÊMIO!* @${numeroAtual} acertou o número ${sessaoExtra.numero} em ${sessaoExtra.tentativas} tentativa(s)!
🎁 Recompensa: ${moedasPremio} moedas e 75 XP.
🪙 Saldo: ${recompensa.moedas} moedas | ✨ XP: ${recompensa.xp}.`, mentions: [jidAtual] }, { quoted: msg });
                return true;
            }
            await enviarProxima(`🎁 ${palpite < sessaoExtra.numero ? 'O número premiado é MAIOR ⬆️' : 'O número premiado é MENOR ⬇️'}\nTentativa ${sessaoExtra.tentativas}. Responda com outro número de 1 a 100.`);
            return true;
        }
        if (sessaoExtra.tipo === 'copo') {
            if (!/^[1-3]$/.test(resposta)) {
                await enviarProxima('🥤 Escolha 1, 2 ou 3 respondendo a esta mensagem.');
                return true;
            }
            clearTimeout(sessaoExtra.timer); sessoesJogosNovos.delete(entradaExtra.chave);
            const escolha = Number(resposta);
            if (escolha === sessaoExtra.copo) {
                const recompensa = premiarJogo(from, numeroAtual, 60, 35, jidAtual);
                await sock.sendMessage(from, { text: `🎉 Acertou! A bolinha estava sob o copo ${sessaoExtra.copo}.
🎁 Você ganhou 60 moedas e 35 XP.
🪙 Saldo: ${recompensa.moedas} moedas | ✨ XP: ${recompensa.xp}.`, mentions: [jidAtual] }, { quoted: msg });
            } else {
                const recompensa = premiarJogo(from, numeroAtual, 5, 5, jidAtual);
                await sock.sendMessage(from, { text: `🙈 Não foi dessa vez! A bolinha estava sob o copo ${sessaoExtra.copo}.
🎁 Participação: 5 moedas e 5 XP.
🪙 Saldo: ${recompensa.moedas} moedas | ✨ XP: ${recompensa.xp}.`, mentions: [jidAtual] }, { quoted: msg });
            }
            return true;
        }
    }
    return false;
}


async function usuarioEhAdminNoGrupo(sock, grupoId, jidUsuario, numeroPuro) {
    try {
        const metadata = await sock.groupMetadata(grupoId);
        const candidatosUsuario = new Set([jidUsuario, numeroPuro, `${numeroPuro}@s.whatsapp.net`].filter(Boolean));
        return metadata.participants.some(p => {
            if (!(p.admin === 'admin' || p.admin === 'superadmin')) return false;
            const ids = [p.id, p.jid, p.lid, p.phoneNumber].filter(Boolean);
            return ids.some(id => candidatosUsuario.has(id) || String(id).replace(/[^0-9]/g, '') === numeroPuro);
        });
    } catch (e) { return false; }
}

function getGrupoConfig(idGrupo) {
    if (!configsGrupos.has(idGrupo)) {
        configsGrupos.set(idGrupo, {
            antiLink: CONFIG.antiLinkAtivo,
            antiFlood: CONFIG.antiFloodAtivo,
            antiDoc: CONFIG.antiDocAtivo,
            antiFake: CONFIG.antiFakeAtivo,
            antiFake1: false,
            antiFake1Manager: null,
            antiInativos: { ativo: false },
            agendamentoClose: { ativo: false, horario: null },
            agendamentoOpen: { ativo: false, horario: null },
            bemVindo: false,
            textoBemVindo: '',
            soadm: true,
            modobrincadeira: false
        });
    }
    return configsGrupos.get(idGrupo);
}

function desembrulharMensagem(message) {
    let atual = message;
    while (atual) {
        if (atual.ephemeralMessage?.message) atual = atual.ephemeralMessage.message;
        else if (atual.viewOnceMessage?.message) atual = atual.viewOnceMessage.message;
        else if (atual.viewOnceMessageV2?.message) atual = atual.viewOnceMessageV2.message;
        else if (atual.viewOnceMessageV2Extension?.message) atual = atual.viewOnceMessageV2Extension.message;
        else break;
    }
    return atual || {};
}

function textoDaMensagem(message) {
    const m = desembrulharMensagem(message);
    return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption ||
        m.videoMessage?.caption || m.documentMessage?.caption || m.buttonsResponseMessage?.selectedDisplayText ||
        m.listResponseMessage?.title || '';
}

async function enviarTotagSemEncaminhar(sock, destino, origem, todosJids, textoManual = '') {
    const mensagem = desembrulharMensagem(origem?.message || origem || {});
    const tipo = Object.keys(mensagem)[0];
    const tiposEnquete = ['pollCreationMessage', 'pollCreationMessageV2', 'pollCreationMessageV3'];
    if (tiposEnquete.includes(tipo)) {
        const enquete = mensagem[tipo];
        const opcoes = (enquete.options || []).map(o => o.optionName).filter(Boolean);
        if (enquete.name && opcoes.length) {
            await sock.sendMessage(destino, { poll: { name: enquete.name, values: opcoes, selectableCount: enquete.selectableOptionsCount || 1 } });
            await delay(300);
            await sock.sendMessage(destino, { text: '❗️Vote na enquete', mentions: todosJids });
            return true;
        }
    }
    const mapaMidia = {
        imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker',
        documentMessage: 'document'
    };
    if (mapaMidia[tipo]) {
        const buffer = await downloadMediaMessage(origem, 'buffer', {}, { logger: P({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage });
        const conteudo = mensagem[tipo];
        const tipoEnvio = mapaMidia[tipo];
        const payload = { [tipoEnvio]: buffer, mentions: todosJids, contextInfo: { mentionedJid: todosJids } };
        if (tipoEnvio === 'image' || tipoEnvio === 'video') {
            if (conteudo.caption) payload.caption = conteudo.caption;
            if (conteudo.mimetype) payload.mimetype = conteudo.mimetype;
            if (tipoEnvio === 'video' && conteudo.gifPlayback) payload.gifPlayback = true;
        } else if (tipoEnvio === 'audio') {
            payload.mimetype = conteudo.mimetype || 'audio/mpeg';
            if (conteudo.ptt) payload.ptt = true;
        } else if (tipoEnvio === 'document') {
            payload.mimetype = conteudo.mimetype || 'application/octet-stream';
            if (conteudo.fileName) payload.fileName = conteudo.fileName;
            if (conteudo.caption) payload.caption = conteudo.caption;
        }
        await sock.sendMessage(destino, payload);
        return true;
    }
    const texto = textoManual || textoDaMensagem(mensagem) || '📢';
    await sock.sendMessage(destino, { text: texto, mentions: todosJids });
    return true;
}

async function notificarGerenciadorLink(sock, grupoOrigem, nomeGrupo, jidRemetente, numeroRemetente, corpoLink) {
    const hora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const texto = `🚫 *LINK DETECTADO — MEMBRO REMOVIDO*

📍 *Grupo:* ${nomeGrupo}
👤 *Membro:* @${numeroRemetente}
🕒 *Data/hora:* ${hora}
🔗 *Link/mensagem:*
${corpoLink}`;
    const mentions = jidRemetente ? [jidRemetente] : [];
    // Usa o destino registrado no momento em que o grupo foi selecionado.
    // Assim o alerta volta exatamente ao grupo de gerenciamento ou ao PV usado pelo gerente.
    const rota = destinosGerenciamentoLink.get(grupoOrigem);
    if (rota?.destino) {
        await sock.sendMessage(rota.destino, { text: texto, mentions });
        return;
    }
    // Compatibilidade com sessões que já estejam ativas antes de registrar a rota.
    for (const [chave, sessao] of sessoesGerenciamentoGrupo.entries()) {
        if (sessao?.grupoSelecionado === grupoOrigem) {
            const separador = chave.indexOf(':');
            const grupoGerenciador = separador >= 0 ? chave.slice(separador + 1) : '';
            if (grupoGerenciador.endsWith('@g.us')) {
                await sock.sendMessage(grupoGerenciador, { text: texto, mentions });
                return;
            }
        }
    }
    for (const [numero, sessao] of sessoesGerenciamento.entries()) {
        if (sessao?.grupoSelecionado === grupoOrigem) {
            const destinoPV = `${numero}@s.whatsapp.net`;
            await sock.sendMessage(destinoPV, { text: texto, mentions });
            return;
        }
    }
    await sock.sendMessage(`${CONFIG.numeroDono}@s.whatsapp.net`, { text: texto, mentions });
}

// Comandos que continuam exclusivos de administradores/dono, mesmo com !soadm ativado.
const comandosAdminRestritos = new Set([
    'g', 'gerenciar', 'cancelargrc', 'encerrar',
    'aceitar', 'ban', 'adv', 'rmadv', 'gp', 'closegp', 'opengp',
    'totag', 'bemvindo', 'antilink', 'antiflood', 'antidoc', 'antifake', 'anti-inativos', 'antiinativos', 'recusar-fake', 'recusarfake', 'desmutar', 'novasenha',
    'antifake1', 'grupomarcar', 'grupoppp', 'grupomm',
    'mensagem', 'mensagempg', 'cancelarmsg',
    'rankativo', 'ranknivel', 'zerar_rank', 'listagp', 'listagrupos',
    'meulid', 'mylid', 'lid', 'meujid',
    'resposta'
]);

function ehSolicitacaoFake(p) {
    // Nunca classificar por LID: os dígitos de um LID não são um número telefônico.
    // Se qualquer campo confiável revelar DDI brasileiro (+55) ou português (+351), preservar a solicitação.
    const camposTelefone = [p?.participantPn, p?.phoneNumber, p?.phone_number, p?.pn];
    const camposJid = [p?.jid, p?.participant, p?.id];
    const normalizar = (valor) => String(valor || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '');
    const telefones = camposTelefone
        .filter(Boolean)
        .filter(v => !String(v).toLowerCase().includes('@lid'))
        .map(normalizar)
        .filter(n => n.length >= 8);
    for (const campo of camposJid.filter(Boolean)) {
        const valor = String(campo).toLowerCase();
        if (valor.endsWith('@s.whatsapp.net')) {
            const n = normalizar(campo);
            if (n.length >= 8) telefones.push(n);
        }
    }
    if (!telefones.length) return false; // Sem telefone verificável, não recusar.
    if (telefones.some(n => n.startsWith('55') || n.startsWith('351'))) return false;
    return true;
}

const timersAgendamentosGrupo = new Map();

// Jogos de rodada coletiva são exclusivos entre si. Tesouro, Copos,
// Prêmio e Desarme são sessões individuais e não bloqueiam o grupo inteiro.
function haJogoAtivoGlobal(grupoId) {
    return sessoesVelha.has(grupoId) || haJogoAtivoJogos(grupoId) || haJogoAtivoJogos2(grupoId) || haJogoAtivoVariados(grupoId);
}

async function encerrarJogosGlobal(sock, grupoId) {
    const resultados = [];
    resultados.push(await encerrarJogosGrupo(sock, grupoId));
    resultados.push(await encerrarJogos2Grupo(sock, grupoId));
    resultados.push(await encerrarJogosVariadosGrupo(sock, grupoId));
    resultados.push(sessoesVelha.delete(grupoId));
    resultados.push(encerrarSessoesIndividuaisDoGrupo(grupoId));
    return resultados.some(Boolean);
}

function limparAgendamento(grupoId, tipo) {
    const chave = `${grupoId}:${tipo}`;
    const timer = timersAgendamentosGrupo.get(chave);
    if (timer) clearTimeout(timer);
    timersAgendamentosGrupo.delete(chave);
}

function limparTodosAgendamentos() {
    for (const timer of timersAgendamentosGrupo.values()) clearTimeout(timer);
    timersAgendamentosGrupo.clear();
}

const FUSO_HORARIO_AGENDAMENTO = 'America/Fortaleza';

function partesDataNoFuso(timestamp) {
    const partes = new Intl.DateTimeFormat('en-GB', {
        timeZone: FUSO_HORARIO_AGENDAMENTO,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date(timestamp));
    const resultado = {};
    for (const parte of partes) if (parte.type !== 'literal') resultado[parte.type] = Number(parte.value);
    return resultado;
}

function timestampNoFuso(year, month, day, hour, minute) {
    const desejadoComoUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    let candidato = desejadoComoUtc;
    for (let i = 0; i < 4; i++) {
        const p = partesDataNoFuso(candidato);
        const representadoComoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
        const diferenca = desejadoComoUtc - representadoComoUtc;
        candidato += diferenca;
        if (diferenca === 0) break;
    }
    return candidato;
}

function proximoTimestampHorario(horario, agoraMs = Date.now()) {
    const correspondencia = /^(\d{1,2}):(\d{2})$/.exec(String(horario));
    if (!correspondencia) throw new Error('Horário de agendamento inválido: ' + horario);
    const hora = Number(correspondencia[1]);
    const minuto = Number(correspondencia[2]);
    if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) throw new Error('Horário de agendamento inválido: ' + horario);
    const atual = partesDataNoFuso(agoraMs);
    let ano = atual.year, mes = atual.month, dia = atual.day;
    let alvo = timestampNoFuso(ano, mes, dia, hora, minuto);
    if (alvo <= agoraMs) {
        const proximoDia = new Date(Date.UTC(ano, mes - 1, dia + 1));
        ano = proximoDia.getUTCFullYear();
        mes = proximoDia.getUTCMonth() + 1;
        dia = proximoDia.getUTCDate();
        alvo = timestampNoFuso(ano, mes, dia, hora, minuto);
    }
    return alvo;
}

function minutosAteHorario(horario) {
    return Math.max(0, proximoTimestampHorario(horario) - Date.now());
}

function iniciarAgendamentoGrupo(sock, grupoId, tipo) {
    const chaveCfg = tipo === 'closegp' ? 'agendamentoClose' : 'agendamentoOpen';
    limparAgendamento(grupoId, tipo);
    const cfg = getGrupoConfig(grupoId);
    const ag = cfg[chaveCfg];
    if (!ag || !ag.ativo || !ag.horario) return;

    const tempoMs = minutosAteHorario(ag.horario);
    const timer = setTimeout(async () => {
        try {
            const cfgAtual = getGrupoConfig(grupoId);
            const agAtual = cfgAtual[chaveCfg];
            if (!agAtual || !agAtual.ativo || !agAtual.horario) return;
            if (await botEhAdmin(sock, grupoId)) {
                if (tipo === 'closegp') {
                    await sock.groupSettingUpdate(grupoId, 'announcement');
                    await sock.sendMessage(grupoId, { text: `🔒 Grupo fechado automaticamente conforme agendamento diário (${agAtual.horario})!` });
                } else {
                    await sock.groupSettingUpdate(grupoId, 'not_announcement');
                    await sock.sendMessage(grupoId, { text: `🔓 Grupo aberto automaticamente conforme agendamento diário (${agAtual.horario})!` });
                }
            } else {
                console.log(`⚠️ Agendamento ${tipo} não executado: bot não é administrador de ${grupoId}.`);
            }
        } catch (e) {
            console.log(`Erro ao executar agendamento diário ${tipo}:`, e);
        } finally {
            const cfgFinal = getGrupoConfig(grupoId);
            const agFinal = cfgFinal[chaveCfg];
            if (agFinal && agFinal.ativo && agFinal.horario) iniciarAgendamentoGrupo(sock, grupoId, tipo);
            else limparAgendamento(grupoId, tipo);
        }
    }, tempoMs);
    timersAgendamentosGrupo.set(`${grupoId}:${tipo}`, timer);
}

function restaurarAgendamentos(sock) {
    limparTodosAgendamentos();
    for (const [grupoId, cfg] of configsGrupos.entries()) {
        if (cfg.agendamentoClose?.ativo && cfg.agendamentoClose?.horario) iniciarAgendamentoGrupo(sock, grupoId, 'closegp');
        if (cfg.agendamentoOpen?.ativo && cfg.agendamentoOpen?.horario) iniciarAgendamentoGrupo(sock, grupoId, 'opengp');
    }
}

async function aceitarSolicitacoes(sock, idGrupo, quantidade, fromResposta, remoto=false, jidNotificacao=null) {
 try {
  if (!idGrupo.endsWith('@g.us')) { await sock.sendMessage(fromResposta,{text:'⚠️ Este comando só funciona em grupos!'}); return; }
  const meta=await sock.groupMetadata(idGrupo); const atuais=(meta.participants||[]).length; const vagas=Math.max(0,1023-atuais);
  if(vagas<=0){ await sock.sendMessage(fromResposta,{text:'Grupo lotado 1023/1023'}); return; }
  let pendentes=await sock.groupRequestParticipantsList(idGrupo);
  if(!pendentes||!pendentes.length){ await sock.sendMessage(fromResposta,{text:'Nenhuma solicitação pendente.'}); return; }
  pendentes.sort((a,b)=>Number(a.request_time||a.requestTime||a.timestamp||0)-Number(b.request_time||b.requestTime||b.timestamp||0));
  let pedido=parseInt(quantidade,10); if(!Number.isFinite(pedido)||pedido<=0) pedido=pendentes.length;
  const real=Math.min(pedido,vagas,pendentes.length); const paraAceitar=pendentes.slice(0,real); let aceitos=0;
  for(const p of paraAceitar){const alvo=p.jid||p.participant||p.id;if(!alvo)continue;try{await sock.groupRequestParticipantsUpdate(idGrupo,[alvo],'approve');aceitos++;}catch(e){} await delay(400);}
  const totalDepois=Math.min(1023,atuais+aceitos); let texto;
  if(pedido>vagas) texto=`Pediu ${pedido} mas só ${vagas} vagas - ${aceitos} aceitas (${totalDepois}/1023)`;
  else texto=`${aceitos} aceitas (${totalDepois}/1023)`;
  await sock.sendMessage(fromResposta,{text:texto});
  if (aceitos > 0 && jidNotificacao) {
   const aceitosJids = paraAceitar.slice(0, aceitos).map(p => p.jid || p.participant || p.id).filter(Boolean);
   if (aceitosJids.length) {
    const mencoes = [...new Set(aceitosJids)];
    const linhas = mencoes.map((id, i) => `${i + 1}. @${String(id).split('@')[0]}`);
    try { await sock.sendMessage(jidNotificacao, { text: `✅ *Solicitações aceitas*\n\n${linhas.join('\n')}`, mentions: mencoes }); } catch (e) { console.log('Erro ao enviar lista de aceitos no PV:', e.message); }
   }
  }
 } catch(err){console.log('Erro no aceitar:',err);await sock.sendMessage(fromResposta,{text:'Erro ao aceitar. Verifique se o bot é ADM.'});}
}

async function botEhAdmin(sock, grupoId) {
 try {
  const metadata=await sock.groupMetadata(grupoId);
  const normal=id=>String(id||'').toLowerCase().replace(/:[0-9]+(?=@)/,'');
  const digits=id=>String(id||'').replace(/[^0-9]/g,'');
  const idsBot=[sock.user?.id,sock.user?.lid,sock.user?.jid,sock.user?.id?.split(':')[0]+'@s.whatsapp.net',sock.user?.id?.split(':')[0],digits(sock.user?.id)].filter(Boolean).map(normal);
  const numsBot=new Set(idsBot.map(digits).filter(Boolean));
  return (metadata.participants||[]).some(p=>{
   if(!(p.admin==='admin'||p.admin==='superadmin'))return false;
   const candidatos=[p.id,p.jid,p.lid,p.phoneNumber].filter(Boolean).map(normal);
   return candidatos.some(c=>idsBot.includes(c)||numsBot.has(digits(c)));
  });
 } catch(e){return false;}
}

const filaAvisosAntiFake1 = new Map(Object.entries(filaAvisosAntiFake1Persistente));
const timersAvisosAntiFake1 = new Map();
function salvarFilaAntiFake1() { filaAvisosAntiFake1Persistente = Object.fromEntries(filaAvisosAntiFake1); salvarJsonImediato(ARQUIVO_FILA_ANTIFAKE1, filaAvisosAntiFake1Persistente); }
async function enviarLotesAntiFake1(sock, grupoId, destino, forcarParcial=false) {
 const fila=filaAvisosAntiFake1.get(grupoId)||[]; if(!destino||!fila.length)return;
 while(fila.length>=10 || (forcarParcial && fila.length>0)) { const lote=fila.splice(0,10); const linhas=lote.map((x,i)=>`${i+1}. @${x.numero}`); const mentions=[...new Set(lote.map(x=>x.jid).filter(Boolean))];
  try { await sock.sendMessage(destino,{text:`🚫 *Anti-Fake — ${lote.length} solicitações recusadas automaticamente:*\n\n${linhas.join('\n')}`,mentions}); } catch(e) { fila.unshift(...lote); console.log('Erro ao enviar lote Anti-Fake:',e.message); break; }
 }
 filaAvisosAntiFake1.set(grupoId,fila); salvarFilaAntiFake1();
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function iniciarBot() {
    if (botIniciando || socketGlobal) return;
    botIniciando = true;
    limparTodosAgendamentos();
    let authState;
    try {
        const diretorioSessao = DIRETORIO_AUTH_WHATSAPP;
        console.log(`📁 Pasta de autenticacao: ${diretorioSessao}`);
        authState = await useMultiFileAuthState(diretorioSessao);
    } catch (erroAuth) {
        botIniciando = false;
        estadoConexaoBot = 'erro_sessao';
        console.error('❌ Não foi possível carregar a sessão do WhatsApp. Verifique o armazenamento persistente.');
        throw erroAuth;
    }
    const { state, saveCreds } = authState;
    sessaoWhatsAppRegistrada = Boolean(state?.creds?.registered);
    let metodoConexao = null;
    let numeroPareamento = null;
    if (!state.creds.registered) {
        console.log('\n==================================================');
        console.log('🤖 ESCOLHA O MÉTODO DE CONEXÃO:');
        console.log('1 - QR Code');
        console.log('2 - Código de Pareamento');
        console.log('==================================================');
        const metodoConfigurado = String(process.env.BOT_CONNECTION_METHOD || '').trim().toLowerCase();
        if (['1', 'qr', 'qrcode', 'qr-code'].includes(metodoConfigurado)) metodoConexao = '1';
        else if (['2', 'pairing', 'code', 'codigo', 'código'].includes(metodoConfigurado)) metodoConexao = '2';
        else metodoConexao = (await question('Digite o número da opção: ')).trim();
        if (metodoConexao === '2') {
            numeroPareamento = String(process.env.BOT_PAIRING_NUMBER || '').replace(/\D/g, '');
            if (!numeroPareamento) numeroPareamento = (await question('Digite seu número com DDI e DDD (somente números): ')).replace(/\D/g, '');
            if (numeroPareamento.length < 10 || numeroPareamento.length > 15) {
                botIniciando = false;
                console.log('❌ Número inválido. Inicie novamente e informe DDI + DDD + número.');
                return;
            }
        } else if (metodoConexao !== '1') {
            botIniciando = false;
            console.log('❌ Opção inválida. Inicie novamente e escolha 1 ou 2.');
            return;
        }
    }
    // A consulta remota da versão é auxiliar: nunca pode bloquear a recuperação
    // de uma sessão já registrada durante uma queda temporária de internet.
    let versaoWhatsAppAtualizada;
    const diretorioCacheVersao = path.resolve(DIRETORIO_AUTH_WHATSAPP);
    const arquivoCacheVersao = path.join(diretorioCacheVersao, '.wa_web_version.json');
    const versaoValida = (valor) => Array.isArray(valor) && valor.length === 3 && valor.every(n => Number.isInteger(n) && n > 0);
    try {
        console.log('🌐 Consultando a versao atual do WhatsApp Web...');
        const resultadoVersaoWhatsApp = await fetchLatestWaWebVersion();
        if (resultadoVersaoWhatsApp?.isLatest === true && versaoValida(resultadoVersaoWhatsApp.version)) {
            versaoWhatsAppAtualizada = resultadoVersaoWhatsApp.version;
            try {
                fs.mkdirSync(diretorioCacheVersao, { recursive: true, mode: 0o700 });
                const temporarioCache = arquivoCacheVersao + '.tmp';
                fs.writeFileSync(temporarioCache, JSON.stringify({ version: versaoWhatsAppAtualizada, savedAt: new Date().toISOString() }), { mode: 0o600 });
                fs.renameSync(temporarioCache, arquivoCacheVersao);
            } catch (erroCache) {
                console.warn('⚠️ Nao foi possivel atualizar o cache da versao: ' + (erroCache?.message || erroCache));
            }
            console.log('✅ Versao atual do WhatsApp Web: ' + versaoWhatsAppAtualizada.join('.'));
        } else {
            const detalhe = resultadoVersaoWhatsApp?.error?.message || 'versao atual nao confirmada';
            console.warn('⚠️ Consulta remota da versao nao confirmou uma versao atual: ' + detalhe);
        }
    } catch (erroVersaoWhatsApp) {
        console.warn('⚠️ Falha temporaria ao consultar a versao do WhatsApp Web: ' + (erroVersaoWhatsApp?.message || erroVersaoWhatsApp));
    }
    if (!versaoWhatsAppAtualizada) {
        try {
            const cache = JSON.parse(fs.readFileSync(arquivoCacheVersao, 'utf8'));
            if (versaoValida(cache?.version)) {
                versaoWhatsAppAtualizada = cache.version;
                console.log('🗂️ Usando ultima versao valida do WhatsApp Web salva localmente: ' + versaoWhatsAppAtualizada.join('.'));
            }
        } catch (_) {}
    }
    if (!versaoWhatsAppAtualizada) {
        console.warn('⚠️ Sem internet e sem cache de versao. O Meu Bot continuará usando a versao padrao do Baileys; a conexao nao sera interrompida por essa consulta.');
    }

    const sock = makeWASocket({
        logger: P({ level: 'silent' }),
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        defaultQueryTimeoutMs: undefined,
        ...(versaoWhatsAppAtualizada ? { version: versaoWhatsAppAtualizada } : {}),
        browser: Browsers.ubuntu('Chrome')
    });
    // Registrar o salvamento de credenciais imediatamente, antes do pareamento.
    sock.ev.on('creds.update', saveCreds);
    // O listener é instalado imediatamente após criar o socket, antes de qualquer nova espera.
    // Assim o primeiro QR emitido pelo WhatsApp não se perde enquanto o terminal aguarda entrada.
    if (!state.creds.registered && metodoConexao === '1') {
        sock.ev.on('connection.update', ({ qr }) => {
            if (!qr) return;
            console.log('\n==================================================');
            qrcode.generate(qr, { small: true });
            console.log('📸 ESCANEIE O QR CODE ACIMA COM O SEU WHATSAPP!');
            console.log('O QR será atualizado automaticamente se expirar.');
            console.log('==================================================\n');
        });
    }
    const enviarMensagemOriginal = sock.sendMessage.bind(sock);
    sock.sendMessage = (destino, conteudo, opcoes) => {
        const jidDestino = String(destino || '');
        const numeroDestino = numeroCanonico(jidDestino);
        const numeroDonoCanonico = numeroCanonico(CONFIG.numeroDono);
        const numeroDonoSem9Canonico = numeroCanonico(CONFIG.numeroDonoSem9);
        const destinoEhDono = numeroDestino === numeroDonoCanonico || numeroDestino === numeroDonoSem9Canonico || jidDestino === CONFIG.lidDono || numeroDestino === numeroCanonico(CONFIG.lidDonoPuro);
        if (!jidDestino.endsWith('@g.us') && !destinoEhDono) return Promise.resolve(undefined);
        return enviarMensagemOriginal(destino, conteudo, opcoes);
    };
    socketGlobal = sock;
    botIniciando = false;
    sock.ev.on('group.join-request', async (update) => {
        const { id, participant, participantPn } = update;
        const cfg = getGrupoConfig(id);
        if (!cfg.antiFake1 || !participant) return;
        // Só usar campos de telefone/JID telefônico verificáveis; nunca interpretar LID como telefone.
        const candidatosTelefone = [participantPn, update.phoneNumber, update.phone_number, update.pn, update.jid, update.participantJid, participant]
            .filter(Boolean)
            .filter(x => !String(x).toLowerCase().includes('@lid'))
            .filter(x => !String(x).includes('@') || String(x).toLowerCase().endsWith('@s.whatsapp.net'));
        const numeroVerificacao = candidatosTelefone.find(x => String(x).replace(/[^0-9]/g, '').length >= 8) || '';
        const numPuro = String(numeroVerificacao).replace(/[^0-9]/g, '');
        if (!numPuro || numPuro.startsWith('55') || numPuro.startsWith('351')) return;
        setTimeout(async () => {
            try {
                const cfgAtual = getGrupoConfig(id);
                if (!cfgAtual.antiFake1) return;
                await sock.groupRequestParticipantsUpdate(id, [participant], 'reject');
                if (cfgAtual.antiFake1Manager) {
                    const fila = filaAvisosAntiFake1.get(id) || [];
                    fila.push({ numero: numPuro, jid: numeroVerificacao });
                    filaAvisosAntiFake1.set(id, fila);
                    salvarFilaAntiFake1();
                    // Envia imediatamente lotes completos de 10; o restante fica salvo para o próximo lote.
                    await enviarLotesAntiFake1(sock, id, cfgAtual.antiFake1ManagerChat || cfgAtual.antiFake1Manager, false);
                    if ((filaAvisosAntiFake1.get(id)||[]).length && !timersAvisosAntiFake1.has(id)) { const timer=setTimeout(async()=>{timersAvisosAntiFake1.delete(id); await enviarLotesAntiFake1(sock,id,cfgAtual.antiFake1ManagerChat || cfgAtual.antiFake1Manager,true);},10*60*1000); timersAvisosAntiFake1.set(id,timer); }
                }
            } catch (e) {}
        }, 180000);
    });
    sock.ev.on('group-participants-update', async (update) => {
        const { id, participants, action } = update;
        if (['remove', 'leave'].includes(action)) {
            let mudouEconomia = false;
            for (const participant of (participants || [])) {
                const numero = String(participant || '').split('@')[0].replace(/[^0-9]/g, '');
                const canon = numeroCanonico(participant);
                if (dadosEconomia[id]?.membros) {
                    for (const chave of Object.keys(dadosEconomia[id].membros)) {
                        const membro = dadosEconomia[id].membros[chave];
                        if (chave === numero || numeroCanonico(chave) === canon || (membro?.jid && numeroCanonico(membro.jid) === canon)) {
                            delete dadosEconomia[id].membros[chave]; mudouEconomia = true;
                        }
                    }
                }
                for (const mapa of [mutados, membrosAntigos]) {
                    if (Array.isArray(mapa[id])) mapa[id] = mapa[id].filter(x => numeroCanonico(x) !== canon && String(x || '').replace(/\D/g, '') !== numero);
                }
                const stats = estatisticasGrupo.get(id);
                if (stats instanceof Map) for (const chave of stats.keys()) if (String(chave).replace(/\D/g, '') === numero) stats.delete(chave);
            }
            if (mudouEconomia) salvarEconomia();
            salvarMutados(); salvarMembrosAntigos();
        }
        if (action === 'add') {
            const cfg = getGrupoConfig(id);
            for (let participant of participants) {
                const numPuro = participant.replace(/[^0-9]/g, '');
                if (cfg.antiFake) {
                    if (!numPuro.startsWith('55') && !numPuro.startsWith('351')) {
                        try {
                            await sock.sendMessage(id, { text: `🚫 @${numPuro} removido pelo Anti-Fake (número estrangeiro não permitido).`, mentions: [participant] });
                            await sock.groupParticipantsUpdate(id, [participant], 'remove');
                            continue;
                        } catch (e) {}
                    }
                }
                if (cfg.bemVindo) {
                    try {
                        let nomeGp = 'este grupo';
                        try {
                            const meta = await sock.groupMetadata(id);
                            nomeGp = meta.subject || 'este grupo';
                        } catch (e) {}
                        let texto = cfg.textoBemVindo && cfg.textoBemVindo.trim()!== ''
                       ? cfg.textoBemVindo
                            : `👋🏻Olá! @${numPuro}, seja bem-vindo ao grupo ${nomeGp}`;
                        if (texto.includes('#nmr#')) texto=texto.replace(/#nmr#/g,`@${numPuro}`);
                        if (texto.includes('#grupo#')) texto=texto.replace(/#grupo#/g,nomeGp);
                        if (!texto.includes(`@${numPuro}`)) texto += ` @${numPuro}`;
                        await sock.sendMessage(id,{text:texto,mentions:[participant]});
                    } catch (e) {}
                }
            }
        }
    });
    sock.ev.on('messages.update', async (updates) => {
        await checarVotosQuiz(sock, updates);
    });
    // V103: em modo de pareamento, o Baileys deve emitir o primeiro QR
    // (evento gerado quando o WebSocket está pronto) antes de receber o pedido do código.
    let solicitacaoPareamentoEmAndamento = false;
    let codigoPareamentoGerado = false;
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (
            qr &&
            !state.creds.registered &&
            metodoConexao === '2' &&
            !solicitacaoPareamentoEmAndamento &&
            !codigoPareamentoGerado
        ) {
            solicitacaoPareamentoEmAndamento = true;
            try {
                console.log('\n⏳ WhatsApp pronto. Aguardando 5 segundos antes de solicitar o código...');
                await delay(5000);

                // Evita pedir código de um socket que já foi encerrado ou substituído.
                if (socketGlobal !== sock || state.creds.registered) return;

                console.log('🔄 Solicitando código de pareamento...');
                const codigo = await sock.requestPairingCode(numeroPareamento);
                codigoPareamentoGerado = true;
                console.log('\n==================================================');
                console.log(`👉 SEU CÓDIGO DE PAREAMENTO: ${codigo}`);
                console.log('Abra WhatsApp > Aparelhos conectados > Conectar aparelho > Conectar com número.');
                console.log('==================================================\n');
            } catch (err) {
                const status = err?.output?.statusCode ?? err?.data?.statusCode ?? 'não informado';
                console.log('❌ Não foi possível gerar o código de pareamento: ' + (err?.message || err));
                console.log('Código de erro: ' + status);
                console.log('Confira a conexão com a internet e o número com DDI/DDD. A sessão não foi apagada.');
            } finally {
                solicitacaoPareamentoEmAndamento = false;
            }
        }
        if (connection === 'connecting') {
            estadoConexaoBot = 'conectando';
        }
        if (connection === 'close') {
            atualizador.pararMonitoramento();
            if (socketGlobal === sock) socketGlobal = null;
            botIniciando = false;
            estadoConexaoBot = 'desconectado';
            ultimaDesconexaoBot = new Date().toISOString();
            const codigoDesconexao = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.data?.statusCode;
            const motivoDesconexao = lastDisconnect?.error?.message || 'motivo não informado';
            console.log(`⚠️ Conexão com WhatsApp encerrada (código ${codigoDesconexao ?? 'desconhecido'}; ${String(motivoDesconexao).slice(0, 120)}).`);
            const dadosServidor = lastDisconnect?.error?.data || {};
            const payloadServidor = lastDisconnect?.error?.output?.payload || {};
            console.log('🔎 Diagnostico WhatsApp: ' + JSON.stringify({
                statusCode: codigoDesconexao ?? null,
                reason: dadosServidor.reason ?? null,
                location: dadosServidor.location ?? null,
                error: payloadServidor.error ?? null,
                message: payloadServidor.message ?? null
            }));
            const codigosDeRevogacao = [DisconnectReason.loggedOut, DisconnectReason.badSession, DisconnectReason.multideviceMismatch]
                .filter(codigo => codigo !== undefined && codigo !== null);
            const sessaoRevogada = codigoDesconexao !== undefined && codigosDeRevogacao.includes(codigoDesconexao);
            if (sessaoRevogada) {
                estadoConexaoBot = 'autenticacao_necessaria';
                if (timerReconexaoBot) { clearTimeout(timerReconexaoBot); timerReconexaoBot = null; }
                if (!reconexaoPorRevogacaoEmAndamento) {
                    reconexaoPorRevogacaoEmAndamento = true;
                    const diretorioSessao = path.resolve(DIRETORIO_AUTH_WHATSAPP);
                    try {
                        if (fs.existsSync(diretorioSessao)) {
                            const arquivoSessaoAntiga = `${diretorioSessao}.revogada_${new Date().toISOString().replace(/[:.]/g, '-')}`;
                            fs.renameSync(diretorioSessao, arquivoSessaoAntiga);
                            console.log(`🗃️ Sessão anterior preservada em: ${arquivoSessaoAntiga}`);
                        }
                    } catch (erroArquivoSessao) {
                        reconexaoPorRevogacaoEmAndamento = false;
                        console.error('❌ Não foi possível arquivar a sessão antiga. Nenhum arquivo foi apagado. Corrija a permissão/armazenamento e reinicie o bot.');
                        console.error(erroArquivoSessao?.message || erroArquivoSessao);
                        return;
                    }
                    console.log('🔐 O WhatsApp revogou a sessão. Vou iniciar uma nova autenticação. Escolha QR Code ou código de pareamento no console.');
                    console.log('ℹ️ Se a hospedagem não aceitar entrada no console, configure BOT_CONNECTION_METHOD=qr ou pairing; para pareamento, BOT_PAIRING_NUMBER com DDI+DDD+número.');
                    setTimeout(() => {
                        reconexaoPorRevogacaoEmAndamento = false;
                        iniciarBot().catch(erro => {
                            botIniciando = false;
                            estadoConexaoBot = 'erro_nova_autenticacao';
                            console.error('❌ Não foi possível iniciar a nova autenticação:', erro?.message || erro);
                        });
                    }, 1200);
                }
            } else if (!timerReconexaoBot && tentativasReconexaoBot < MAX_TENTATIVAS_RECONEXAO) {
                const atraso = Math.min(INTERVALO_RECONEXAO_BASE * (2 ** tentativasReconexaoBot), INTERVALO_RECONEXAO_MAX);
                tentativasReconexaoBot++;
                ultimaTentativaReconexaoBot = new Date(Date.now() + atraso).toISOString();
                console.log(`🔄 Nova tentativa de conexão em ${Math.ceil(atraso / 1000)}s (tentativa ${tentativasReconexaoBot}; reconexão contínua).`);
                timerReconexaoBot = setTimeout(() => {
                    timerReconexaoBot = null;
                    ultimaTentativaReconexaoBot = new Date().toISOString();
                    iniciarBot().catch(erro => {
                        botIniciando = false;
                        estadoConexaoBot = 'erro_reconexao';
                        console.error('❌ Não foi possível iniciar a reconexão. O sistema tentará novamente.');
                        if (!timerReconexaoBot && tentativasReconexaoBot < MAX_TENTATIVAS_RECONEXAO) {
                            const proximoAtraso = Math.min(INTERVALO_RECONEXAO_BASE * (2 ** tentativasReconexaoBot), INTERVALO_RECONEXAO_MAX);
                            tentativasReconexaoBot++;
                            timerReconexaoBot = setTimeout(() => { timerReconexaoBot = null; iniciarBot().catch(() => {}); }, proximoAtraso);
                        }
                    });
                }, atraso);
            } else if (tentativasReconexaoBot >= MAX_TENTATIVAS_RECONEXAO) {
                estadoConexaoBot = 'limite_reconexao';
                console.log('⚠️ O contador de tentativas atingiu o limite numérico seguro. Verifique a hospedagem e reinicie o processo.');
            }
        } else if (connection === 'open') {
            if (timerReconexaoBot) { clearTimeout(timerReconexaoBot); timerReconexaoBot = null; }
            tentativasReconexaoBot = 0;
            estadoConexaoBot = 'conectado';
            sessaoWhatsAppRegistrada = true;
            ultimaTentativaReconexaoBot = null;
            botIniciando = false;
            atualizador.iniciarMonitoramento({
                sock,
                destino: `${CONFIG.numeroDono}@s.whatsapp.net`,
                repositorio: 'vittorw/suzuke'
            });
            // Mantém o console de entrada aberto para permitir novo pareamento se a sessão for revogada.
            try { await restaurarMensagens(sock); } catch (e) {}
            try { restaurarAgendamentos(sock); } catch (e) {}
            if (timerAntiInativos) clearInterval(timerAntiInativos);
            timerAntiInativos = setInterval(() => verificarAntiInativos(sock).catch(()=>{}), 4*60*60*1000);
            console.log('\n🟩 ============================================');
            console.log('🚀 BOT ONLINE E PRONTO PARA USO! (V114)');
            console.log('==============================================-\n');
        }
    });
    sock.ev.on('messages.upsert', async (m) => {
        if (m.type!== 'notify') return;
        // Registra todas as mensagens do lote antes de processar o primeiro comando.
        for (const candidata of (m.messages || [])) {
            if (!candidata?.message || !candidata?.key?.id) continue;
            const grupoCandidata = candidata.key.remoteJid;
            if (!String(grupoCandidata || '').endsWith('@g.us')) continue;
            const autorCandidata = candidata.key.participantAlt || candidata.key.participant || candidata.participantAlt || candidata.participant;
            registrarMensagemDenuncia(grupoCandidata, candidata, autorCandidata, extrairTextoMensagemDenuncia(candidata.message));
        }
        const processarMensagem = async (msg) => {
        if (!msg || !msg.message || !msg.key?.id) return;
        if (registrarIdProcessado(msg.key.id)) return;
        const timestampInicio = Date.now();
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const jid = msg.key.participant || from;
        if (isGroup && ehMutado(from, jid) && !msg.key.fromMe) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
            return;
        }
        const numeroPuroRemetente = jid.replace(/[^0-9]/g, '');
        const numeroPuroDono = CONFIG.numeroDono.replace(/[^0-9]/g, '');
        const numeroPuroDonoSem9 = CONFIG.numeroDonoSem9.replace(/[^0-9]/g, '');
        const isDono = (numeroPuroRemetente === numeroPuroDono || numeroPuroRemetente === numeroPuroDonoSem9 || jid === CONFIG.lidDono || numeroPuroRemetente === CONFIG.lidDonoPuro) || msg.key.fromMe;
        const nomeUsuario = msg.pushName || 'Usuário';
        if (from === 'status@broadcast' || from.endsWith('@newsletter')) return;
        if (!isGroup && !isDono) return;
        let corpoMsg = '';
        if (msg.message.conversation) corpoMsg = msg.message.conversation;
        else if (msg.message.extendedTextMessage?.text) corpoMsg = msg.message.extendedTextMessage.text;
        else if (msg.message[Object.keys(msg.message)[0]]?.caption) corpoMsg = msg.message[Object.keys(msg.message)[0]]?.caption;

        // Confirmações do atualizador só são aceitas do proprietário e no chat original.
        const confirmacaoAtualizacao = await atualizador.tratarConfirmacao({
            sock, from, remetente: jid, isDono, texto: corpoMsg, msg
        });
        if (confirmacaoAtualizacao) return;

        const chavesConteudoMensagem = Object.keys(msg.message || {}).filter(chave => !['messageContextInfo', 'senderKeyDistributionMessage'].includes(chave));
        // V100_LOG_COMPLETO: hora de Brasilia, nome real do grupo e texto quando houver.
        const horaLog = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
        let nomeGrupoLog = 'Privado';
        if (isGroup) {
            nomeGrupoLog = 'Grupo';
            try { nomeGrupoLog = (await sock.groupMetadata(from)).subject || 'Grupo'; } catch (e) { nomeGrupoLog = 'Grupo (nome indisponivel)'; }
        }
        const tipoMensagemLog = chavesConteudoMensagem.some(chave => ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage', 'ptvMessage', 'documentWithCaptionMessage'].includes(chave))
            ? 'Midia'
            : (corpoMsg.trim() ? 'Texto' : 'Conteudo sem texto');
        const comandoComToken = /^\s*!token\s+\S+/i.test(corpoMsg);
        const textoLog = comandoComToken ? '│   !token [CREDENCIAL OCULTADA]' : (corpoMsg.trim() ? corpoMsg.replace(/\r/g, '').split('\n').map(linha => '│   ' + linha).join('\n') : '');
        console.log('╭─ 📩 NOVA MENSAGEM ─╮\n' +
            '│ Horario (Brasilia): ' + horaLog + '\n' +
            '│ Grupo: ' + nomeGrupoLog + '\n' +
            '│ Usuário: ' + nomeUsuario + '\n' +
            '│ Numero: ' + (numeroPuroRemetente || 'Desconhecido') + '\n' +
            '│ Tipo: ' + tipoMensagemLog + (textoLog ? '\n' + textoLog : '') + '\n' +
            '╰─────────────────────╯');
        if (isGroup && corpoMsg.trim() && !corpoMsg.trim().startsWith(CONFIG.prefixo)) registrarMensagemParaResumo(from, nomeUsuario, numeroPuroRemetente, corpoMsg);

        // v63: aceita número como resposta direta à lista correspondente.
        if (/^\s*\d{1,3}\s*$/.test(corpoMsg)) {
            const contextoSelecao = msg.message?.extendedTextMessage?.contextInfo;
            const citada = contextoSelecao?.quotedMessage;
            const textoCitado = citada?.conversation || citada?.extendedTextMessage?.text || citada?.imageMessage?.caption || citada?.videoMessage?.caption || '';
            const numeroSelecao = corpoMsg.trim();
            if (textoCitado.includes('GERENCIAMENTO DE GRUPOS')) {
                corpoMsg = '!gerenciar ' + numeroSelecao;
            } else if (textoCitado.includes('GRUPOS DISPONÍVEIS PARA O PPP')) {
                corpoMsg = '!g grupoppp ' + numeroSelecao;
            } else if (textoCitado.includes('GRUPOS DISPONÍVEIS PARA MARCAR DENÚNCIAS') || textoCitado.includes('GRUPOS DISPONÍVEIS PARA DENÚNCIAS') || textoCitado.includes('GRUPO DE DENÚNCIAS')) {
                corpoMsg = '!g grupomarcar ' + numeroSelecao;
            }
        }

        // COMANDO SECRETO NOVODONO - ANTES DE TUDO
        if (corpoMsg.startsWith(CONFIG.prefixo)) {
            const argsTmp = corpoMsg.slice(CONFIG.prefixo.length).trim().split(/ +/);
            const cmdTmp = argsTmp.shift().toLowerCase();
            if (cmdTmp === 'novodono' && !(isGroup && getGrupoConfig(from).soadm && !isDono)) {
                const senhaDigitada = argsTmp.join(' ');
                if (senhaDigitada!== CONFIG.senhaMestre) {
                    return; // ignora se errar
                }
                // No grupo só ADM pode reivindicar
                if (isGroup) {
                    try {
                        const metadata = await sock.groupMetadata(from);
                        const adms = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
                        const ehAdm = adms.find(p => p.id === jid || p.id.replace(/[^0-9]/g, '') === numeroPuroRemetente);
                        if (!ehAdm) return;
                    } catch(e){ return; }
                }
                // Transfere dono
                CONFIG.numeroDono = numeroPuroRemetente;
                CONFIG.numeroDonoSem9 = numeroPuroRemetente;
                CONFIG.lidDono = jid;
                CONFIG.lidDonoPuro = numeroPuroRemetente;
                try {
                    fs.writeFileSync('./dono.json', JSON.stringify({
                        numeroDono: CONFIG.numeroDono,
                        numeroDonoSem9: CONFIG.numeroDonoSem9,
                        lidDono: CONFIG.lidDono,
                        lidDonoPuro: CONFIG.lidDonoPuro,
                        senhaMestre: CONFIG.senhaMestre
                    }, null, 2));
                } catch(e){}
                await sock.sendMessage(from, { text: `✅ *Dono transferido com sucesso!*\n\n👤 Novo dono: ${nomeUsuario}\n🆔 JID: ${jid}\n📱 Número: ${numeroPuroRemetente}\n\nAgora você tem acesso total ao bot.` });
                return;
            }
        }

        if (isGroup) {
            if (!estatisticasGrupo.has(from)) {
                estatisticasGrupo.set(from, new Map());
            }
            const membrosMap = estatisticasGrupo.get(from);
            if (!membrosMap.has(numeroPuroRemetente)) {
                membrosMap.set(numeroPuroRemetente, { nome: nomeUsuario, jid, mensagens: 0, stickers: 0, comandos: 0, mensagensPeriodo: 0, inicioPeriodo: Date.now() });
            }
            const stats = membrosMap.get(numeroPuroRemetente);
            stats.nome = nomeUsuario;
            stats.jid = jid;
            if (!Number.isFinite(stats.inicioPeriodo)) stats.inicioPeriodo = Date.now();
            if (!Number.isFinite(stats.mensagensPeriodo)) stats.mensagensPeriodo = 0;
            stats.mensagens += 1;
            stats.mensagensPeriodo += 1;
            const tipoMsg = Object.keys(msg.message)[0];
            if (tipoMsg === 'stickerMessage') stats.stickers += 1;
            if (corpoMsg.startsWith(CONFIG.prefixo)) stats.comandos += 1;
            if (getGrupoConfig(from).modobrincadeira && !msg.key.fromMe) {
                const ecoMissao = membroEconomia(from, numeroPuroRemetente); garantirMissaoDia(ecoMissao);
                const missoesConcluidas = [];
                if (corpoMsg.startsWith(CONFIG.prefixo)) ecoMissao.comandosDia = (Number(ecoMissao.comandosDia) || 0) + 1;
                else if (corpoMsg.trim()) ecoMissao.mensagensDia = (Number(ecoMissao.mensagensDia) || 0) + 1;
                if (tipoMsg === 'stickerMessage') ecoMissao.stickersDia = (Number(ecoMissao.stickersDia) || 0) + 1;
                if (ecoMissao.mensagensDia >= 15 && creditarMissao(ecoMissao, 'mensagens5', 50)) missoesConcluidas.push('Enviar 15 mensagens — 50 moedas');
                if (ecoMissao.mensagensDia >= 25 && creditarMissao(ecoMissao, 'mensagens10', 150)) missoesConcluidas.push('Enviar 25 mensagens — 150 moedas');
                if (ecoMissao.comandosDia >= 10 && creditarMissao(ecoMissao, 'comandos10', 75)) missoesConcluidas.push('Usar 10 comandos — 75 moedas');
                if (ecoMissao.stickersDia >= 10 && creditarMissao(ecoMissao, 'figurinhas10', 50)) missoesConcluidas.push('Enviar 10 figurinhas — 50 moedas');
                salvarEconomia();
                if (!getGrupoConfig(from).soadm) { for (const missao of missoesConcluidas) await sock.sendMessage(from, { text: `✅ @${numeroPuroRemetente} concluiu a missão diária: *${missao}*!`, mentions: [jid] }); }
            }
      // XP por mensagem válida: sem comandos e com intervalo anti-spam de 60 segundos.
      if (getGrupoConfig(from).modobrincadeira && !corpoMsg.startsWith(CONFIG.prefixo)) {
        const eco = membroEconomia(from, numeroPuroRemetente); if (jid) eco.jid = jid; garantirMissaoDia(eco);
        if (Date.now() - (Number(eco.ultimoXp) || 0) >= 60000) {
            const nivelAntes = nivelDoXp(eco.xp).nivel;
            eco.xp = (Number(eco.xp) || 0) + 5; eco.ultimoXp = Date.now();
            let recompensaMissao = false;
            const nivelDepois = nivelDoXp(eco.xp).nivel; salvarEconomia();
            if (nivelDepois > nivelAntes && Date.now() - (Number(eco.ultimoAvisoNivel) || 0) >= 300000) { eco.ultimoAvisoNivel = Date.now(); salvarEconomia(); if (!getGrupoConfig(from).soadm) await sock.sendMessage(from, { text: '🎉 @' + numeroPuroRemetente + ' subiu para o nível ' + nivelDepois + '! Continue participando para evoluir.', mentions: [jid] }); }
            if (recompensaMissao && !getGrupoConfig(from).soadm) await sock.sendMessage(from, { text: '✅ @' + numeroPuroRemetente + ' concluiu uma missão diária e recebeu moedas!', mentions: [jid] });
        }
      }
            salvarEstadoBot();
        }
        if (!isGroup) {
            const processadoJogo = await tratarPrivadoJogos(sock, msg, numeroPuroRemetente, nomeUsuario, isDono, jid);
            if (processadoJogo) return;
            if (!isDono) return;
        }
        let isAdm = false;
        let nomeGrupo = 'Grupo';
        let admsDoGrupo = [];
        if (isGroup) {
            try {
                const metadata = await sock.groupMetadata(from);
                nomeGrupo = metadata.subject || 'Grupo';
                admsDoGrupo = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin');
                const idsDoRemetente = new Set([jid, msg.key.participant, numeroPuroRemetente, numeroPuroRemetente + '@s.whatsapp.net'].filter(Boolean));
                const checarAdm = admsDoGrupo.find(p => {
                    const candidatos = [p.id, p.jid, p.lid, p.phoneNumber].filter(Boolean);
                    return candidatos.some(c => idsDoRemetente.has(c) || c.replace(/[^0-9]/g, '') === numeroPuroRemetente);
                });
                if (checarAdm) isAdm = true;
            } catch (e) {
                isAdm = false;
            }
        }
        if (isGroup) { const agoraMsg=Date.now(); const k1=chavePessoa(from,jid), k2=chavePessoa(from,numeroPuroRemetente); ultimaMensagemMembro.set(k1,agoraMsg); ultimaMensagemMembro.set(k2,agoraMsg); ultimasMensagensPersistidas[k1]=agoraMsg; ultimasMensagensPersistidas[k2]=agoraMsg; salvarJsonImediato(ARQUIVO_ULTIMAS_MENSAGENS,ultimasMensagensPersistidas); }
        // V99_SOADM_COMMANDS_ONLY: comandos de membros sao ignorados sem resposta; texto/respostas de jogos seguem.
        if (isGroup && !isDono && !isAdm && getGrupoConfig(from).soadm && corpoMsg.trim().startsWith(CONFIG.prefixo)) return;
        
        const sessaoGerenciamentoUser = isDono ? sessoesGerenciamento.get(numeroPuroRemetente) : null;
        const chaveGerenciamentoGrupo = `${numeroPuroRemetente}:${from}`;
        const sessaoGerenciamentoGrupo = isGroup ? sessoesGerenciamentoGrupo.get(chaveGerenciamentoGrupo) : null;
        const chatAlvo = (isGroup && sessaoGerenciamentoGrupo && sessaoGerenciamentoGrupo.grupoSelecionado)
            ? sessaoGerenciamentoGrupo.grupoSelecionado
            : (sessaoGerenciamentoUser && sessaoGerenciamentoUser.grupoSelecionado && !isGroup)
                ? sessaoGerenciamentoUser.grupoSelecionado
                : from;
        const cfgAtual = getGrupoConfig(chatAlvo);
        // Quando um grupo/PV está gerenciando outro grupo, os comandos diretos continuam valendo somente para o chat atual.
        // Para agir no grupo selecionado remotamente, é obrigatório usar !g.
        const gerenciamentoRemotoAtivo = chatAlvo !== from && !!(
            (sessaoGerenciamentoGrupo && sessaoGerenciamentoGrupo.grupoSelecionado) ||
            (sessaoGerenciamentoUser && sessaoGerenciamentoUser.grupoSelecionado)
        );
        if (isGroup && !isDono && !isAdm && ehMutado(from, jid)) {
            try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
            return;
        }
        if (isGroup && cfgAtual.antiLink) {
            const contextoRespostaLink = msg.message?.extendedTextMessage?.contextInfo ||
                msg.message?.imageMessage?.contextInfo || msg.message?.videoMessage?.contextInfo ||
                msg.message?.documentMessage?.contextInfo || msg.message?.stickerMessage?.contextInfo ||
                msg.message?.audioMessage?.contextInfo;
            const idRespondido = contextoRespostaLink?.stanzaId;
            const agoraResposta = Date.now();
            for (const [idLink, tempoLink] of linksRemovidosRecentes) {
                if (agoraResposta - tempoLink > 24 * 60 * 60 * 1000) linksRemovidosRecentes.delete(idLink);
            }
            if (idRespondido && linksRemovidosRecentes.has(`${from}:${idRespondido}`)) {
                try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                return;
            }
            if (!isDono && !isAdm) {
                const padraoLink = /(https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+)/i;
                if (padraoLink.test(corpoMsg)) {
                    linksRemovidosRecentes.set(`${from}:${msg.key.id}`, agoraResposta);
                    try { await notificarGerenciadorLink(sock, from, nomeGrupo, jid, numeroPuroRemetente, corpoMsg); } catch (e) { console.log('Erro ao notificar link:', e.message); }
                    await sock.sendMessage(from, { text: `🚫 @${numeroPuroRemetente} enviou um link e foi removido.`, mentions: [jid] });
                    try { await sock.sendMessage(from, { delete: msg.key }); } catch (e) {}
                    try { await sock.groupParticipantsUpdate(from, [jid], 'remove'); } catch (e) { console.log('Erro ao remover membro por link:', e.message); }
                    return;
                }
            }
        }
        if (isGroup && cfgAtual.antiDoc &&!isDono &&!isAdm) {
            const tipoMsg = Object.keys(msg.message)[0];
            if (tipoMsg === 'documentMessage') {
                await sock.sendMessage(from, { text: `🚫 @${numeroPuroRemetente} enviou um documento e foi removido.`, mentions: [jid] });
                try {
                    await sock.sendMessage(from, { delete: msg.key });
                    await sock.groupParticipantsUpdate(from, [jid], 'remove');
                } catch (e) {}
                return;
            }
        }
        if (isGroup && cfgAtual.antiFlood && !isDono && !isAdm) {
            const tipoMsg = Object.keys(msg.message)[0];
            const tiposPermitidos = ['conversation','extendedTextMessage','imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage','viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension'];
            if (tiposPermitidos.includes(tipoMsg)) {
                const chaveUsuario=`${from}_${numeroPuroRemetente}`; const agora=Date.now();
                const registros=historicoMensagens.get(chaveUsuario)||[];
                const idMensagem = msg.key?.id;
                const semDuplicata = registros.some(x => x.id && idMensagem && x.id === idMensagem);
                if (!semDuplicata) registros.push({t:agora,key:msg.key,id:idMensagem});
                const recentes=registros.filter(x=>agora-x.t<=120000); historicoMensagens.set(chaveUsuario,recentes);
                if (semDuplicata) return;
                const ult9=recentes.filter(x=>agora-x.t<=9000).length, ult60=recentes.filter(x=>agora-x.t<=60000).length, ult120=recentes.length;
                if(ult9>=7||ult60>=15||ult120>=20){
                    const advs=(advertenciasFlood.get(chaveUsuario)||0)+1;
                    advertenciasFlood.set(chaveUsuario,advs);
                    salvarEstadoBot();
                    if(advs===1) {
                        historicoMensagens.set(chaveUsuario,[]);
                        await sock.sendMessage(from,{text:`⚠️ @${numeroPuroRemetente} *[ADVERTÊNCIA DE FLOOD 1/2]*`,mentions:[jid]});
                    } else {
                        await sock.sendMessage(from,{text:`🚫 @${numeroPuroRemetente} banido por flood!`,mentions:[jid]});
                        try { await sock.groupParticipantsUpdate(from,[jid],'remove'); } catch(e) {}
                        const apagaveis=recentes.slice(-10).reverse();
                        for(const item of apagaveis){try{await sock.sendMessage(from,{delete:item.key});}catch(e){} await delay(200);}
                        historicoMensagens.set(chaveUsuario,[]);
                        advertenciasFlood.delete(chaveUsuario);
                        salvarEstadoBot();
                    }
                    return;
                }
            }
        }
        const textoMinusculo = corpoMsg.trim().toLowerCase();
        if (!(isGroup && !isDono && !isAdm && getGrupoConfig(from).soadm) && await tratarRespostaRelacionamento(sock, msg, from, isGroup, corpoMsg, jid, numeroPuroRemetente, nomeUsuario)) return;
        if (await processarRespostaJogosExtras(sock, msg, from, isGroup, corpoMsg, numeroPuroRemetente, jid, isDono, isAdm)) return;
        await tratarRespostas(sock, msg, from, isGroup, textoMinusculo, numeroPuroRemetente, jid);
        await checarRespostasInterativas(sock, from, isGroup, textoMinusculo, numeroPuroRemetente, jid);
        await checarRespostasJogos2(sock, from, isGroup, textoMinusculo, numeroPuroRemetente, jid, isDono, isAdm, msg, getGrupoConfig(from).soadm, () => haJogoAtivoJogos(from) || haJogoAtivoVariados(from) || sessoesVelha.has(from), premiarPodioEconomia);
        if (isGroup && !corpoMsg.startsWith(CONFIG.prefixo)) {
            const contextoCompra = msg.message?.extendedTextMessage?.contextInfo;
            const citadaCompra = contextoCompra?.quotedMessage;
            const textoLojaCitada = citadaCompra?.conversation || citadaCompra?.extendedTextMessage?.text || citadaCompra?.imageMessage?.caption || '';
            const idMensagemCitadas = contextoCompra?.stanzaId || '';
            const textoEhListaLoja = String(textoLojaCitada).includes('LOJA DE ITENS');
            const idEhListaLoja = Boolean(idMensagemCitadas && mensagensLojaPorGrupo.get(from) === idMensagemCitadas);
            if (textoEhListaLoja || idEhListaLoja) {
                if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
                if (!getGrupoConfig(from).modobrincadeira) {
                    await sock.sendMessage(from, { text: '⚠️ A loja está desativada neste grupo.' }, { quoted: msg });
                    return;
                }
                const nomeItem = corpoMsg.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
                const aliasesItens = { escudo: 'escudo', protecao: 'escudo', armadilha: 'armadilha', sorte: 'sorte', boostxp: 'boostxp', xp: 'boostxp' };
                const item = aliasesItens[nomeItem];
                const catalogo = { escudo: { preco: 250 }, armadilha: { preco: 130 }, sorte: { preco: 120 }, boostxp: { preco: 50 } };
                if (!item) {
                    await sock.sendMessage(from, { text: '⚠️ Não reconheci esse item. Responda à lista da loja com: escudo, armadilha, sorte ou boostxp.' }, { quoted: msg });
                    return;
                }
                const ecoCompra = membroEconomia(from, numeroPuroRemetente);
                if ((Number(ecoCompra.moedas) || 0) < catalogo[item].preco) {
                    await sock.sendMessage(from, { text: '⚠️ Saldo insuficiente! O item ' + item + ' custa ' + catalogo[item].preco + ' moedas e você tem ' + (Number(ecoCompra.moedas) || 0) + ' moedas.' }, { quoted: msg });
                    return;
                }
                ecoCompra.moedas -= catalogo[item].preco;
                ecoCompra.inventario = Array.isArray(ecoCompra.inventario) ? ecoCompra.inventario : [];
                if (item === 'escudo') ecoCompra.protecaoRoubos = (Number(ecoCompra.protecaoRoubos) || 0) + 4;
                else if (item === 'armadilha') ecoCompra.armadilhas = (Number(ecoCompra.armadilhas) || 0) + 1;
                else if (item === 'sorte') ecoCompra.sorteRoubos = (Number(ecoCompra.sorteRoubos) || 0) + 1;
                else if (item === 'boostxp') ecoCompra.xp = (Number(ecoCompra.xp) || 0) + 100;
                if (item !== 'boostxp') {
                    const existente = ecoCompra.inventario.find(x => x.item === item);
                    if (existente) existente.quantidade = (Number(existente.quantidade) || 0) + 1;
                    else ecoCompra.inventario.push({ item, quantidade: 1 });
                }
                salvarEconomia();
                const confirmacao = item === 'escudo' ? '🛡️ Escudo comprado! Bloqueia as próximas 4 tentativas de roubo contra você.' : item === 'armadilha' ? '🪤 Armadilha comprada! Será acionada na próxima tentativa de roubo contra você.' : item === 'sorte' ? '🍀 Sorte comprada! Seu próximo roubo terá 70% de chance de sucesso.' : '✨ Boost XP comprado! Você recebeu 100 XP.';
                await sock.sendMessage(from, { text: '✅ ' + confirmacao + '\n💰 Valor: ' + catalogo[item].preco + ' moedas.\n🪙 Saldo restante: ' + ecoCompra.moedas + ' moedas.' }, { quoted: msg });
                return;
            }
        }
        // Confirmação do !resetar: resposta simples 'sim'/'não' à mensagem exata do bot.
        const contextoRespostaReset = msg.message?.extendedTextMessage?.contextInfo;
        const idMensagemRespondida = contextoRespostaReset?.stanzaId;
        if (idMensagemRespondida) {
            const chaveReset = `${from}:${idMensagemRespondida}`;
            const pendente = confirmacoesReset.get(chaveReset);
            if (pendente) {
                if (!isDono || String(pendente.donoJid) !== String(jid)) {
                    return;
                }
                const respostaReset = String(corpoMsg || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (respostaReset === 'sim') {
                    confirmacoesReset.delete(chaveReset);
                    const grupoReset = pendente.grupoAlvo || (isGroup ? from : null);
                    if (grupoReset && String(grupoReset).endsWith('@g.us')) {
                        delete dadosEconomia[grupoReset];
                        estatisticasGrupo.set(grupoReset, new Map());
                        salvarEconomia();
                        salvarEstadoBot();
                        await sock.sendMessage(from, { text: '✅ *RESET CONCLUÍDO*\n\nForam apagados no grupo selecionado: moedas, XP, níveis, inventários, itens, progresso da economia/jogos e ranking de atividade.\n\nForam preservados: comandos, configurações, funções ativadas, tarefas e mensagens programadas, relacionamentos, arquivos do bot e conexão do WhatsApp.' }, { quoted: msg });
                    } else {
                        await sock.sendMessage(from, { text: '⚠️ O reset precisa ser iniciado dentro do grupo ou pelo painel com um grupo selecionado.' }, { quoted: msg });
                    }
                    return;
                }
                if (respostaReset === 'nao') {
                    confirmacoesReset.delete(chaveReset);
                    await sock.sendMessage(from, { text: '❎ Reset cancelado. Nenhum dado foi apagado.' }, { quoted: msg });
                    return;
                }
            }
        }

        if (!corpoMsg.startsWith(CONFIG.prefixo)) return;
        const args = corpoMsg.slice(CONFIG.prefixo.length).trim().split(/ +/);
        const comando = args.shift().toLowerCase();
        const enviarRespostaComando = (destino, conteudo, opcoes = {}) => {
            if (conteudo && Object.prototype.hasOwnProperty.call(conteudo, 'delete')) {
                return sock.sendMessage(destino, conteudo, opcoes);
            }
            return sock.sendMessage(destino, conteudo, { ...opcoes, quoted: msg });
        };

        if (comando === 'token') {
            if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o proprietário autorizado pode configurar o token.' });
            if (isGroup) return await enviarRespostaComando(from, { text: '🔒 Por segurança, configure o token somente na conversa privada com o Meu Bot.' });
            const tokenInformado = String(args[0] || '').trim();
            if (!tokenInformado || args.length !== 1) {
                return await enviarRespostaComando(from, { text: 'Use: !token SEU_TOKEN_GITHUB\n\nO token será validado e salvo fora da pasta do projeto. Não envie em grupos.' });
            }
            try {
                await atualizador.configurarTokenGithub(tokenInformado);
                await enviarRespostaComando(from, { text: '✅ Token validado e salvo com segurança. O Meu Bot já pode acessar o repositório privado para verificar atualizações.' });
            } catch (erroToken) {
                await enviarRespostaComando(from, { text: `❌ ${erroToken.message}\n\nNenhum token anterior válido foi substituído.` });
            } finally {
                args[0] = '';
            }
            return;
        }

        if (comando === 'removertoken') {
            if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o proprietário autorizado pode remover o token.' });
            if (isGroup) return await enviarRespostaComando(from, { text: '🔒 Use este comando somente na conversa privada com o Meu Bot.' });
            try {
                const removido = atualizador.removerTokenGithub();
                await enviarRespostaComando(from, { text: removido ? '🗑️ Token local removido. O bot continuará funcionando, mas não poderá acessar o repositório privado até configurar outro token.' : 'ℹ️ Não havia token local configurado.' });
            } catch (erroToken) {
                await enviarRespostaComando(from, { text: `❌ ${erroToken.message}` });
            }
            return;
        }

        if (comando === 'verificaratualizacao') {
            if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o proprietário autorizado pode verificar atualizações.' });
            await atualizador.verificar({
                sock, from, msg,
                repositorio: 'vittorw/suzuke'
            });
            return;
        }

        if (comando === 'atualizar') {
            if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o proprietário autorizado pode atualizar o bot.' });
            await atualizador.iniciar({
                sock, from, msg, remetente: jid,
                repositorio: 'vittorw/suzuke'
            });
            return;
        }

        if (comando === 'status') {
            if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o proprietário autorizado pode consultar o status técnico.' });
            const statusBot = atualizador.montarStatus({
                estadoConexao: estadoConexaoBot,
                sessaoRegistrada: sessaoWhatsAppRegistrada,
                tentativasReconexao: tentativasReconexaoBot,
                ultimaTentativaReconexao: ultimaTentativaReconexaoBot,
                ultimaDesconexao: ultimaDesconexaoBot,
                conectado: Boolean(sock.user),
                versao: atualizador.versaoInstalada()
            });
            await enviarRespostaComando(from, { text: statusBot });
            return;
        }

        if (comando === 'resetar') {
            if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o dono do bot pode usar este comando.' });
            if (!isGroup) return await enviarRespostaComando(from, { text: '⚠️ Use !resetar dentro do grupo que deseja reiniciar.' });
            const confirmacaoReset = await sock.sendMessage(from, { text: '⚠️ *CONFIRMAR RESET DE PROGRESSO?*\n\nSerão apagados SOMENTE neste grupo:\n• Moedas e XP\n• Níveis e inventários\n• Itens da economia\n• Ranking de atividade\n\nSerão PRESERVADOS:\n• Comandos e códigos\n• Configurações e funções ativadas\n• Tarefas, agendamentos e mensagens programadas\n• Relacionamentos\n• Sessão/conexão do WhatsApp\n\nPara confirmar, responda DIRETAMENTE a esta mensagem com *sim*. Para cancelar, responda com *não*.' });
            if (confirmacaoReset?.key?.id) {
                confirmacoesReset.set(`${from}:${confirmacaoReset.key.id}`, { donoJid: jid, grupoAlvo: from, criadoEm: Date.now() });
            }
            return;
        }

        const contextoRespostaComando = msg.message?.extendedTextMessage?.contextInfo;
        const textoMensagemRespondida = contextoRespostaComando?.quotedMessage?.conversation || contextoRespostaComando?.quotedMessage?.extendedTextMessage?.text || '';
        const numeroRespondido = String(textoMensagemRespondida).trim().match(/^\s*(?:\[)?(\d{1,3})(?:\])?\s*$/)?.[1];
        if (numeroRespondido && args.length === 0 && ['gerenciar', 'grupomarcar', 'grupoppp'].includes(comando)) args.push(numeroRespondido);
        if (numeroRespondido && comando === 'g' && args.length === 1 && ['grupomarcar', 'grupoppp'].includes(args[0]?.toLowerCase())) args.push(numeroRespondido);
        if (await executarComandoRelacionamento(sock, { from, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, comando, args })) return;
        if (comando === 'resumo') {
            if (!isGroup) return;
            await enviarRespostaComando(from, { text: montarResumoGrupo(from) });
            return;
        }
        if (['desarme', 'premio', 'copo', 'copos'].includes(comando)) {
            if (!isGroup) { await enviarRespostaComando(from, { text: '🎮 Estes jogos só funcionam em grupos.' }); return; }
            if (!getGrupoConfig(from).modobrincadeira) { await enviarRespostaComando(from, { text: '🎮 Os jogos estão desativados neste grupo. Um administrador precisa ativar o modo de brincadeiras.' }); return; }
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) { await enviarRespostaComando(from, { text: '⛔ Os jogos para membros estão bloqueados enquanto !soadm estiver ativado.' }); return; }
            if (haJogoAtivoGlobal(from)) { await enviarRespostaComando(from, { text: '⚠️ Há um jogo coletivo exclusivo em andamento neste grupo. Termine-o antes de iniciar outro.' }); return; }
            if (membroTemSessaoIndividual(from, numeroPuroRemetente)) { await enviarRespostaComando(from, { text: '⚠️ Você já tem um jogo individual em andamento. Termine sua partida antes de iniciar outra.' }); return; }
            const tipo = comando === 'desarme' ? 'desarme' : (comando === 'premio' ? 'premio' : 'copo');
            const chaveSessao = chaveSessaoIndividual(from, numeroPuroRemetente);
            if (['desarme', 'copo'].includes(tipo)) { const restante = tempoRestanteJogosEconomia(from, numeroPuroRemetente, tipo); if (restante > 0) { const min = Math.ceil(restante / 60000); const nomeJogo = tipo === 'copo' ? 'Copos' : 'Desarme'; await enviarRespostaComando(from, { text: `⏳ Você precisa esperar ${min} minuto(s) antes de jogar ${nomeJogo} novamente. Cada jogo tem seu próprio intervalo de 15 minutos por jogador; você pode jogar outro jogo enquanto espera.` }); return; } }
            const sessao = { tipo, grupo: from, chave: chaveSessao, jogador: { jid, numero: numeroPuroRemetente }, messageId: '', tentativas: 0, criadoEm: Date.now() };
            let textoInicio = '';
            if (tipo === 'desarme') {
                sessao.codigo = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
                textoInicio = `💣 *JOGO DO DESARME*\nDescubra o código de 4 dígitos. Você tem 60 segundos e até 6 tentativas.\n\nResponda a esta mensagem com 4 dígitos. 🧨`;
            } else if (tipo === 'premio') {
                sessao.numero = Math.floor(Math.random() * 100) + 1;
                textoInicio = `🎁 *NÚMERO PREMIADO*\nAdivinhe o número de 1 a 100. Vou dizer se o número correto é maior ou menor.\n\nResponda a esta mensagem com seu palpite. Você tem 60 segundos.`;
            } else {
                sessao.copo = Math.floor(Math.random() * 3) + 1;
                textoInicio = `🥤 *JOGO DOS COPOS*\nA bolinha está escondida sob um dos três copos. Escolha 1, 2 ou 3.\n\nResponda a esta mensagem com o número escolhido. Você tem 60 segundos.`;
            }
            const enviado = await sock.sendMessage(from, { text: textoInicio, mentions: [jid] }, { quoted: msg });
            if (!enviado?.key?.id) return;
            sessao.messageId = enviado.key.id;
            sessoesJogosNovos.set(chaveSessao, sessao);
            if (['desarme', 'copo'].includes(tipo)) registrarJogoEconomia(from, numeroPuroRemetente, tipo);
            sessao.timer = setTimeout(async () => {
                if (sessoesJogosNovos.get(chaveSessao) !== sessao) return;
                sessoesJogosNovos.delete(chaveSessao);
                const final = tipo === 'desarme' ? `💥 O tempo acabou! O código era *${sessao.codigo}*.` : tipo === 'premio' ? `⏰ O tempo acabou! O número premiado era *${sessao.numero}*.` : `⏰ O tempo acabou! A bolinha estava sob o copo *${sessao.copo}*.`;
                try { await sock.sendMessage(from, { text: final, mentions: [jid] }); } catch (e) { console.log('Falha ao encerrar jogo por tempo:', e.message); }
            }, 60000);
            return;
        }
        if (comando === 'velha') {
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            const alvoJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
            if (!alvoJid) return await enviarRespostaComando(from, { text: 'Marque a pessoa que deseja desafiar: !velha @membro' });
            const alvoNumero = String(alvoJid).split('@')[0].replace(/\D/g, '');
            if (!alvoNumero || pessoaConfereJogador({ jid, numero: numeroPuroRemetente }, alvoJid, alvoNumero)) return await enviarRespostaComando(from, { text: '⚠️ Você não pode desafiar a si mesmo.' });
            if (haJogoAtivoGlobal(from)) return await enviarRespostaComando(from, { text: '⚠️ Já existe um jogo ou evento em andamento neste grupo. Termine-o antes de iniciar outro.' });
            try {
                const metadata = await sock.groupMetadata(from);
                const alvoPresente = (metadata.participants || []).some(p => [p.id, p.jid, p.lid].filter(Boolean).includes(alvoJid) || String(p.id || '').replace(/\D/g, '') === alvoNumero);
                if (!alvoPresente) return await enviarRespostaComando(from, { text: '⚠️ A pessoa marcada não foi encontrada entre os membros deste grupo.' });
            } catch (e) { return await enviarRespostaComando(from, { text: '⚠️ Não consegui confirmar se a pessoa marcada está neste grupo. Tente novamente.' }); }
            const sessao = { status: 'desafio', desafiante: { jid, numero: numeroPuroRemetente }, desafiado: { jid: alvoJid, numero: alvoNumero }, messageId: '', criadoEm: Date.now() };
            const enviado = await sock.sendMessage(from, { text: `🎮 *DESAFIO — JOGO DA VELHA*\n@${numeroPuroRemetente} desafiou @${alvoNumero}!\n\n@${alvoNumero}, responda a esta mensagem com *SIM* para jogar ou *NÃO* para recusar. Só a pessoa desafiada pode responder.`, mentions: [jid, alvoJid] }, { quoted: msg });
            if (enviado?.key?.id) { sessao.messageId = enviado.key.id; sessoesVelha.set(from, sessao); }
            return;
        }
        if (comando === 'tesouro') {
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (haJogoAtivoGlobal(from)) return await enviarRespostaComando(from, { text: '⚠️ Há um jogo coletivo exclusivo em andamento neste grupo. Termine-o antes de iniciar outro.' });
            if (membroTemSessaoIndividual(from, numeroPuroRemetente)) return await enviarRespostaComando(from, { text: '⚠️ Você já tem um jogo individual em andamento. Termine sua partida antes de iniciar outra.' });
            const chaveTesouro = chaveSessaoIndividual(from, numeroPuroRemetente);
            const restanteTesouro = tempoRestanteJogosEconomia(from, numeroPuroRemetente, 'tesouro'); if (restanteTesouro > 0) { const min = Math.ceil(restanteTesouro / 60000); return await enviarRespostaComando(from, { text: `⏳ Você precisa esperar ${min} minuto(s) antes de jogar Tesouro novamente. Cada jogo tem seu próprio intervalo de 15 minutos por jogador; você pode jogar Copos ou Desarme enquanto espera.` }); }
            const sessao = { grupo: from, jogador: { jid, numero: numeroPuroRemetente }, messageId: '', criadoEm: Date.now() };
            const enviado = await sock.sendMessage(from, { text: `🗝️ *CAÇA AO TESOURO*\n@${numeroPuroRemetente}, escolha um baú respondendo *a esta mensagem* com o número 1, 2 ou 3.\n\n🎁 Baú 1\n🎁 Baú 2\n🎁 Baú 3\n\nSó você pode escolher e há apenas uma tentativa. O conteúdo será revelado depois da escolha.`, mentions: [jid] }, { quoted: msg });
            if (enviado?.key?.id) { sessao.messageId = enviado.key.id; sessoesTesouro.set(chaveTesouro, sessao); registrarJogoEconomia(from, numeroPuroRemetente, 'tesouro'); }
            return;
        }
        if (comando === 'roleta') {
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (haJogoAtivoGlobal(from)) return await enviarRespostaComando(from, { text: '⚠️ Há um jogo coletivo exclusivo em andamento neste grupo. Termine-o antes de iniciar outro.' });
            if (membroTemSessaoIndividual(from, numeroPuroRemetente)) return await enviarRespostaComando(from, { text: '⚠️ Você já tem um jogo individual em andamento. Termine sua partida antes de iniciar outro.' });
            const ecoRoleta = membroEconomia(from, numeroPuroRemetente);
            const agoraRoleta = Date.now();
            const esperaRoleta = 90 * 60 * 1000;
            const faltaRoleta = esperaRoleta - (agoraRoleta - (Number(ecoRoleta.roletaEm) || 0));
            if (faltaRoleta > 0) {
                const minutos = Math.ceil(faltaRoleta / 60000);
                return await enviarRespostaComando(from, { text: `⏳ Você já girou a roleta. Tente novamente em aproximadamente ${Math.floor(minutos / 60)}h ${minutos % 60}min.` });
            }
            ecoRoleta.roletaEm = agoraRoleta;
            const resultadosRoleta = [
                { texto: '🎉 Sorte grande! Você ganhou 150 moedas e 50 XP.', moedas: 150, xp: 50 },
                { texto: '💰 Você ganhou 75 moedas.', moedas: 75, xp: 0 },
                { texto: '✨ Você ganhou 100 XP.', moedas: 0, xp: 100 },
                { texto: '🍀 Boa sorte! Você ganhou 30 moedas e 25 XP.', moedas: 30, xp: 25 },
                { texto: '💸 Azar! Você perdeu até 80 moedas.', moedas: -80, xp: 0 },
                { texto: '🌪️ A roleta levou até 50 XP.', moedas: 0, xp: -50 },
                { texto: '💥 Pé-frio! Você perdeu até 150 moedas e 25 XP.', moedas: -150, xp: -25 }
            ];
            const resultadoRoleta = resultadosRoleta[Math.floor(Math.random() * resultadosRoleta.length)];
            ecoRoleta.moedas = Math.max(0, (Number(ecoRoleta.moedas) || 0) + resultadoRoleta.moedas);
            ecoRoleta.xp = Math.max(0, (Number(ecoRoleta.xp) || 0) + resultadoRoleta.xp);
            salvarEconomia();
            await enviarRespostaComando(from, { text: `🎰 *ROLETA DA SORTE*\n\n${resultadoRoleta.texto}\n\n🪙 Saldo: ${ecoRoleta.moedas} moedas\n✨ XP: ${ecoRoleta.xp}\n⏳ Próxima tentativa em 1h30min.` });
            return;
        }
        if(comando==='novasenha') { if(!isDono || isGroup) return; const nova=args.join(' '); if(!nova)return; CONFIG.senhaMestre=nova; const dono=lerJson('./dono.json',{}); dono.senhaMestre=nova; salvarJsonImediato('./dono.json',dono); await enviarRespostaComando(from,{text:'Senha alterada'}); try{await enviarRespostaComando(from,{delete:msg.key});}catch(e){} return; }
        const comandosPainelDireto = new Set([
            'aceitar', 'closegp', 'opengp', 'mensagem', 'mensagempg', 'cancelarmsg',
            'grupomarcar', 'iniciarppp', 'iniciarpppvu', 'iniciarmm',
            'grupoppp', 'grupomm', 'totag', 'bemvindo', 'antilink', 'antiflood', 'antidoc', 'antifake'
        ]);
        if (gerenciamentoRemotoAtivo && comandosPainelDireto.has(comando)) return;
        if (comandosBloqueados.has(comando) &&!isDono) return;
        if (comando === 'encerrar') {
            if (!isGroup) return await enviarRespostaComando(from, { text: `⚠️ Este comando só funciona em grupos!` });
            if (!isDono && !isAdm) {
                await enviarRespostaComando(from, { text: `⚠️ Apenas administradores podem encerrar os jogos!` });
                return;
            }
            const encerrouBase = await encerrarJogosGlobal(sock, from);
            const encerrou = encerrouBase;
            await enviarRespostaComando(from, { text: encerrou ? `🛑 *TODOS OS JOGOS ATIVOS FORAM ENCERRADOS!*` : `⚠️ Não há nenhum jogo ativo neste grupo.` });
            return;
        }
        if (comando === 'adms') {
            if (!isGroup) return;
            if (admsDoGrupo.length > 0) {
                let textoLocal = '📢 *Atenção Administradores:*\n\n';
                const mencoesLocais = admsDoGrupo.map(a => a.id);
                admsDoGrupo.forEach(adm => textoLocal += `@${adm.id.split('@')[0]} `);
                await enviarRespostaComando(from, { text: textoLocal, mentions: mencoesLocais });
            }

            // Usa a mensagem Baileys completa para não perder o contextInfo da resposta.
            const contextoDenuncia = encontrarContextoCitacaoDenuncia(msg);
            const quoted = contextoDenuncia?.quotedMessage || null;
            const idCitado = contextoDenuncia?.stanzaId || contextoDenuncia?.quotedMessageId || quoted?.key?.id || null;
            const textoCitadoDireto = extrairTextoMensagemDenuncia(quoted);
            const registroCitado = buscarMensagemDenuncia(from, idCitado)
                || buscarMensagemDenunciaPorTexto(from, textoCitadoDireto);

            // Prioriza IDs de telefone/PN do contexto antes de LID guardado no histórico.
            const autorContexto = contextoDenuncia?.participantAlt
                || contextoDenuncia?.participantPn
                || contextoDenuncia?.participant
                || contextoDenuncia?.remoteJidAlt
                || null;
            const autorCitado = autorContexto
                || registroCitado?.autorPn
                || registroCitado?.autor
                || registroCitado?.autorLid
                || null;

            const textoCitado = textoCitadoDireto || registroCitado?.texto || '';
            const temCitacao = Boolean(quoted || idCitado || autorContexto);
            const autorPorMencao = !temCitacao ? (contextoDenuncia?.mentionedJid?.[0] || null) : null;
            const jidDenunciado = autorCitado || autorPorMencao;
            const textoDenunciado = jidDenunciado
                ? `@${String(jidDenunciado).split('@')[0].split(':')[0]}`
                : 'Não foi informado';
            const textoEvidenciaDenuncia = textoCitado
                ? `\n📝 *Mensagem citada:*\n> ${String(textoCitado).replace(/\r?\n/g, '\n> ').slice(0, 1500)}`
                : '';

            if (!jidDenunciado || (!textoCitado && !quoted)) {
                console.log('[!adms] Diagnóstico de citação:', JSON.stringify({
                    grupo: from,
                    mensagemComContexto: Boolean(contextoDenuncia),
                    camposContexto: contextoDenuncia ? Object.keys(contextoDenuncia) : [],
                    tiposMensagemRecebida: Object.keys(msg.message || {}),
                    stanzaId: idCitado || null,
                    temQuotedMessage: Boolean(quoted),
                    encontradoNoHistorico: Boolean(registroCitado),
                    temAutor: Boolean(jidDenunciado),
                    temTexto: Boolean(textoCitado)
                }));
            }

            const agoraDenuncia = new Date();
            const dataHoraDenuncia = agoraDenuncia.toLocaleString('pt-BR', {
                timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
            const grupoDestinoDenuncia = grupoNotificacaoAdmsPorGrupo.get(from);
            const mencoesNotificacao = [];
            if (jid && !mencoesNotificacao.includes(jid)) mencoesNotificacao.push(jid);
            if (jidDenunciado && !mencoesNotificacao.includes(jidDenunciado)) mencoesNotificacao.push(jidDenunciado);

            const mensagemNotificacao = `⚠️ *ATENÇÃO DENÚNCIA/CHAMADO!*\n\n` +
                `👤 *Quem denunciou:* @${numeroPuroRemetente}\n` +
                `🏰 *Grupo de origem:* "${nomeGrupo}"\n` +
                `🎯 *Pessoa denunciada:* ${textoDenunciado}` +
                `${textoEvidenciaDenuncia}\n` +
                `🕒 *Data e horário:* ${dataHoraDenuncia}`;

            if (grupoDestinoDenuncia) {
                try {
                    await sock.sendMessage(grupoDestinoDenuncia, { text: mensagemNotificacao, mentions: mencoesNotificacao });
                } catch (err) {
                    console.log('Erro ao enviar notificação para o grupo de ADMs:', err);
                }
            } else {
                console.log('[!adms] Nenhum grupo de destino configurado para:', from);
            }
            return;
        }
        if (comando === 'soadm') {
            if (!isGroup) return;
            if (!isDono && !isAdm) return;
            const cfgSoAdm = getGrupoConfig(from);
            cfgSoAdm.soadm = !cfgSoAdm.soadm;
            salvarEstadoBot();
            await enviarRespostaComando(from, { text: cfgSoAdm.soadm ? 'Ativado✅️' : 'Desativado❌️' });
            return;
        }
        // !soadm controla o acesso dos membros comuns aos comandos do grupo.
        // Comandos administrativos continuam bloqueados para membros, sem resposta.
        if (isGroup && !isDono && !isAdm) {
            if (comandosAdminRestritos.has(comando)) return;
            const cfgSoAdm = getGrupoConfig(from);
            if (cfgSoAdm.soadm) return;
        }
        if (comando === 'meulid' || comando === 'mylid' || comando === 'lid' || comando === 'meujid') {
            await enviarRespostaComando(from, {
                text: `🆔 *SEU LID / JID*\n\n*JID completo:* ${jid}\n*Remetente puro:* ${numeroPuroRemetente}\n*From:* ${from}\n*PushName:* ${nomeUsuario}`
            });
            return;
        }
        if (comando === 'anti-inativos' || comando === 'antiinativos') {
            if(!isGroup)return; const cfg=getGrupoConfig(from);
            cfg.antiInativos=cfg.antiInativos||{ativo:false};cfg.antiInativos.ativo=!cfg.antiInativos.ativo;cfg.antiInativos.ativadoEm=cfg.antiInativos.ativo?new Date().toISOString():null;salvarEstadoBot();await enviarRespostaComando(from,{text:cfg.antiInativos.ativo?'Ativado✅️':'Desativado❌️'});return;
        }
        if(comando==='recusar-fake'||comando==='recusarfake'){if(!isGroup)return;try{if(!(await botEhAdmin(sock,from)))return await enviarRespostaComando(from,{text:'Precisa ser ADM'});const pend=await sock.groupRequestParticipantsList(from);const fake=(pend||[]).filter(ehSolicitacaoFake);let n=0;const recusados=[];for(const p of fake){const alvo=p.jid||p.participant||p.id;if(!alvo)continue;try{await sock.groupRequestParticipantsUpdate(from,[alvo],'reject');n++;recusados.push(alvo);}catch(e){}await delay(400+Math.floor(Math.random()*401));}const texto=n?`${n} fakes recusados\n\n${recusados.map((x,i)=>`${i+1}. @${String(x).split('@')[0]}`).join('\n')}`:'Nenhum fake para recusar';await enviarRespostaComando(from,{text:texto,mentions:recusados});}catch(e){await enviarRespostaComando(from,{text:'Precisa ser ADM'});}return;}
        if(comando==='mutar'){if(!isGroup)return;if(!isDono&&!isAdm)return;const contexto=msg.message?.extendedTextMessage?.contextInfo;const alvo=contexto?.mentionedJid?.[0]||contexto?.participant;if(!alvo)return await enviarRespostaComando(from,{text:'Marque o membro ou responda à mensagem dele para mutar.'});if(!mutados[from])mutados[from]=[];if(!mutados[from].some(x=>numeroCanonico(x)===numeroCanonico(alvo)))mutados[from].push(alvo);salvarMutados();await enviarRespostaComando(from,{text:`🔇 @${alvo.split('@')[0]} foi mutado. As mensagens dele serão apagadas.`,mentions:[alvo]});return;}
        if(comando==='desmutar'){if(!isGroup)return;if(!isDono&&!isAdm)return;const contexto=msg.message?.extendedTextMessage?.contextInfo;const alvo=contexto?.mentionedJid?.[0]||contexto?.participant;if(!alvo)return await enviarRespostaComando(from,{text:'Marque o membro ou responda à mensagem dele para desmutar.'});mutados[from]=(mutados[from]||[]).filter(x=>numeroCanonico(x)!==numeroCanonico(alvo));salvarMutados();if(!membrosAntigos[from])membrosAntigos[from]=[];if(!ehMembroAntigo(from,alvo))membrosAntigos[from].push(alvo);salvarMembrosAntigos();await enviarRespostaComando(from,{text:`Desmutado @${alvo.split('@')[0]}`,mentions:[alvo]});return;}
        if (comando === 'aceitar') {
            await aceitarSolicitacoes(sock, chatAlvo, args[0], from, false, jid);
            return;
        }
        if (comando === 'modobrincadeira') {
            if (!isGroup) return await enviarRespostaComando(from, { text: '⚠️ Use este comando em um grupo.' });
            if (!isDono && !isAdm) return;
            const cfgModo = getGrupoConfig(from); cfgModo.modobrincadeira = !cfgModo.modobrincadeira; salvarEstadoBot();
            await enviarRespostaComando(from, { text: cfgModo.modobrincadeira ? 'Ativado✅️' : 'Desativado❌️' }); return;
        }
        if (comando === 'doar') {
            if (!isGroup) return await enviarRespostaComando(from, { text: '⚠️ Use !doar dentro do grupo para transferir moedas ou XP.' });
            const tipoDoacao = String(args[0] || '').toLowerCase();
            if (!['xp', 'moedas', 'moeda'].includes(tipoDoacao)) return await enviarRespostaComando(from, { text: '📌 Formato: !doar xp 100 @membro ou !doar moedas 100 @membro.' });
            const alvoJidDoacao = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.find(Boolean);
            const quantidade = Number(args.find((x, i) => i > 0 && /^\d+$/.test(x)));
            if (!alvoJidDoacao || !Number.isSafeInteger(quantidade) || quantidade <= 0) return await enviarRespostaComando(from, { text: '⚠️ Informe um valor inteiro positivo e marque quem vai receber. Exemplo: !doar xp 100 @membro.' });
            const alvoNumeroDoacao = String(alvoJidDoacao).split('@')[0].replace(/\D/g, '');
            if (!alvoNumeroDoacao || alvoNumeroDoacao === numeroPuroRemetente || pessoaConfereJogador({ numero: numeroPuroRemetente, jid }, alvoJidDoacao, alvoNumeroDoacao)) return await enviarRespostaComando(from, { text: '⚠️ Você precisa marcar outra pessoa do grupo para receber a doação.' });
            const doador = membroEconomia(from, numeroPuroRemetente); const recebedor = membroEconomia(from, alvoNumeroDoacao);
            const campo = tipoDoacao === 'xp' ? 'xp' : 'moedas'; const nomeCampo = campo === 'xp' ? 'XP' : 'moedas';
            if ((Number(doador[campo]) || 0) < quantidade) return await enviarRespostaComando(from, { text: `⚠️ Saldo insuficiente. Você tem ${Number(doador[campo]) || 0} ${nomeCampo} e tentou doar ${quantidade}.` });
            doador[campo] = (Number(doador[campo]) || 0) - quantidade; recebedor[campo] = (Number(recebedor[campo]) || 0) + quantidade; recebedor.jid = alvoJidDoacao; doador.jid = jid; salvarEconomia();
            return await enviarRespostaComando(from, { text: `🎁 *DOAÇÃO REALIZADA!*\n\n@${numeroPuroRemetente} doou ${quantidade} ${nomeCampo} para @${alvoNumeroDoacao}.\n\nO valor foi descontado do saldo de quem doou e creditado ao saldo de quem recebeu.`, mentions: [jid, alvoJidDoacao] });
        }
        if (comando === 'saldo') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup) return await enviarRespostaComando(from, { text: '⚠️ Este comando só funciona em grupos.' });
            if (!getGrupoConfig(from).modobrincadeira) return await enviarRespostaComando(from, { text: '⚠️ O modo brincadeira está desativado neste grupo.' });
            const eco = membroEconomia(from, numeroPuroRemetente); const nv = nivelDoXp(eco.xp); salvarEconomia();
            await enviarRespostaComando(from, { text: '💰 *SUA CARTEIRA*\n\n🪙 Saldo: ' + eco.moedas + ' moedas\n⭐ Nível: ' + nv.nivel + '\n✨ XP: ' + eco.xp }); return;
        }
        if (comando === 'diario') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const eco = membroEconomia(from, numeroPuroRemetente); garantirMissaoDia(eco);
            if (eco.diarioDia === diaEconomia()) return await enviarRespostaComando(from, { text: '⏳ Você já resgatou seu bônus diário.' });
            eco.diarioDia = diaEconomia(); eco.moedas = (Number(eco.moedas) || 0) + 100; salvarEconomia();
            await enviarRespostaComando(from, { text: '🎁 Você recebeu 100 moedas diárias!' }); return;
        }
        if (comando === 'missoes') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const eco = membroEconomia(from, numeroPuroRemetente); garantirMissaoDia(eco); salvarEconomia();
            const linhasMissoes = [
                `${eco.missoesResgatadas.includes('mensagens5') ? '✅' : '▫️'} Envie 15 mensagens válidas (${Math.min(15, eco.mensagensDia || 0)}/15) — 50 moedas`,
                `${eco.missoesResgatadas.includes('mensagens10') ? '✅' : '▫️'} Envie 25 mensagens válidas (${Math.min(25, eco.mensagensDia || 0)}/25) — 150 moedas`,
                `${eco.missoesResgatadas.includes('comandos10') ? '✅' : '▫️'} Use 10 comandos (${Math.min(10, eco.comandosDia || 0)}/10) — 75 moedas`,
                `${eco.missoesResgatadas.includes('figurinhas10') ? '✅' : '▫️'} Envie 10 figurinhas (${Math.min(10, eco.stickersDia || 0)}/10) — 50 moedas`,
                `${eco.missoesResgatadas.includes('roubos5') ? '✅' : '▫️'} Tente 5 roubos (${Math.min(5, eco.roubosTentadosDia || 0)}/5) — 150 moedas`
            ];
            await enviarRespostaComando(from, { text: '📋 *MISSÕES DIÁRIAS*\n\n' + linhasMissoes.join('\n') + '\n\nAs recompensas são creditadas automaticamente ao cumprir cada objetivo.' }); return;
        }
        if (comando === 'roubar') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const contextoRoubo = msg.message?.extendedTextMessage?.contextInfo; const alvoRoubo = contextoRoubo?.mentionedJid?.[0];
            if (!alvoRoubo) return await enviarRespostaComando(from, { text: 'Marque quem você quer tentar roubar: !roubar @membro' });
            const alvoNum = String(alvoRoubo).split('@')[0].replace(/[^0-9]/g, '');
            if (!alvoNum || alvoNum === numeroPuroRemetente) return await enviarRespostaComando(from, { text: '⚠️ Você não pode roubar a si mesmo.' });
            const autorEco = membroEconomia(from, numeroPuroRemetente), alvoEco = membroEconomia(from, alvoNum);
            garantirMissaoDia(autorEco); garantirMissaoDia(alvoEco);
            if (Date.now() - (Number(autorEco.roubouEm) || 0) < 600000) return await enviarRespostaComando(from, { text: '⏳ Você precisa esperar 10 minutos entre tentativas de roubo.' });
            autorEco.roubouEm = Date.now(); autorEco.roubosTentadosDia = (Number(autorEco.roubosTentadosDia) || 0) + 1;
            if (autorEco.roubosTentadosDia >= 5 && creditarMissao(autorEco, 'roubos5', 150)) { salvarEconomia(); await sock.sendMessage(from, { text: `✅ @${numeroPuroRemetente} concluiu a missão diária: *Tentar 5 roubos — 150 moedas*!`, mentions: [jid] }); }
            if ((Number(alvoEco.protecaoRoubos) || 0) > 0) {
                alvoEco.protecaoRoubos = Math.max(0, Number(alvoEco.protecaoRoubos) - 1);
                salvarEconomia();
                await enviarRespostaComando(from, { text: '🛡️ @' + alvoNum + ' estava com o escudo ativo! O roubo foi bloqueado. Bloqueios restantes: ' + alvoEco.protecaoRoubos + '.', mentions: [jid, alvoRoubo] }); return;
            }
            if ((Number(alvoEco.armadilhas) || 0) > 0) {
                alvoEco.armadilhas = Math.max(0, Number(alvoEco.armadilhas) - 1);
                const multaArmadilha = Math.min(Number(autorEco.moedas) || 0, 50);
                autorEco.moedas = Math.max(0, (Number(autorEco.moedas) || 0) - multaArmadilha);
                salvarEconomia();
                await enviarRespostaComando(from, { text: '🪤 @' + numeroPuroRemetente + ' caiu numa armadilha de @' + alvoNum + ' e perdeu ' + multaArmadilha + ' moedas! Armadilhas restantes do alvo: ' + alvoEco.armadilhas + '.', mentions: [jid, alvoRoubo] }); return;
            }
            const chanceRoubo = (Number(autorEco.sorteRoubos) || 0) > 0 ? 0.7 : 0.5;
            if ((Number(autorEco.sorteRoubos) || 0) > 0) autorEco.sorteRoubos = Math.max(0, Number(autorEco.sorteRoubos) - 1);
            if (Math.random() < chanceRoubo && (Number(alvoEco.moedas) || 0) > 0) { const qtd = Math.min(Number(alvoEco.moedas), Math.max(1, Math.floor(Math.random() * 101) + 25)); alvoEco.moedas -= qtd; autorEco.moedas = (Number(autorEco.moedas) || 0) + qtd; salvarEconomia(); await enviarRespostaComando(from, { text: '🦹 @' + numeroPuroRemetente + ' conseguiu roubar ' + qtd + ' moedas de @' + alvoNum + '!', mentions: [jid, alvoRoubo] }); }
            else { const multa = Math.min(Number(autorEco.moedas) || 0, Math.floor(Math.random() * 31) + 10); autorEco.moedas -= multa; alvoEco.moedas = (Number(alvoEco.moedas) || 0) + multa; salvarEconomia(); await enviarRespostaComando(from, { text: '🚨 @' + numeroPuroRemetente + ' fracassou ao tentar roubar @' + alvoNum + ', perdeu ' + multa + ' moedas e elas foram transferidas para a pessoa alvo!', mentions: [jid, alvoRoubo] }); }
            return;
        }
        if (comando === 'rankgay' || comando === 'rankgado') {
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const membrosMapRankSocial = estatisticasGrupo.get(from);
            if (!membrosMapRankSocial || membrosMapRankSocial.size === 0) return;
            const candidatosRankSocial = Array.from(membrosMapRankSocial.entries())
                .map(([num, data]) => ({
                    num,
                    nome: data.nome || 'Membro',
                    jid: data.jid || (num ? `${num}@s.whatsapp.net` : null),
                    total: (Number(data.mensagens) || 0) + (Number(data.stickers) || 0) + (Number(data.comandos) || 0)
                }))
                .filter(item => item.jid && item.num)
                .sort((a, b) => b.total - a.total)
                .slice(0, 40);
            for (let i = candidatosRankSocial.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidatosRankSocial[i], candidatosRankSocial[j]] = [candidatosRankSocial[j], candidatosRankSocial[i]];
            }
            const escolhidosRankSocial = candidatosRankSocial.slice(0, 5);
            if (!escolhidosRankSocial.length) return;
            const mencoesRankSocial = escolhidosRankSocial.map(item => item.jid);
            const tituloRankSocial = comando === 'rankgay' ? '🏳️‍🌈 *RANK GAY DO GRUPO*' : '💘 *RANK GADO DO GRUPO*';
            const textoRankSocial = tituloRankSocial + '\n\n' + escolhidosRankSocial.map((item, indice) =>
                `${indice + 1}. @${String(item.num).replace(/[^0-9]/g, '')}`
            ).join('\n');
            await enviarRespostaComando(from, { text: textoRankSocial, mentions: mencoesRankSocial });
            return;
        }
        if (comando === 'ranknivel') {
            if (!isDono && !isAdm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const ecoGrupo = estadoEconomia(from);
            let participantesGrupo = [];
            try {
                const metadataRank = await sock.groupMetadata(from);
                participantesGrupo = Array.isArray(metadataRank?.participants) ? metadataRank.participants : [];
            } catch (e) {}
            const somenteDigitos = valor => String(valor || '').split('@')[0].replace(/[^0-9]/g, '');
            const jidValidoParticipante = participante => participante?.id || participante?.jid || participante?.lid || null;
            const lista = Object.entries(ecoGrupo.membros).map(([chave, membro]) => {
                const numeroChave = somenteDigitos(chave);
                const numeroSalvo = somenteDigitos(membro.numero || membro.telefone || membro.jid || membro.lid);
                const participante = participantesGrupo.find(p => {
                    const ids = [p?.id, p?.jid, p?.lid, p?.phoneNumber, p?.phone].filter(Boolean);
                    return ids.some(id => somenteDigitos(id) === numeroChave || (numeroSalvo && somenteDigitos(id) === numeroSalvo));
                });
                const jidRank = jidValidoParticipante(participante) || membro.jid || membro.lid || null;
                const numeroMencao = jidRank ? somenteDigitos(jidRank) : (numeroSalvo || numeroChave);
                const nv = nivelDoXp(membro.xp);
                return { numero: numeroMencao, jid: jidRank, nivel: nv.nivel, xp: Number(membro.xp) || 0, moedas: Number(membro.moedas) || 0, falta: Math.max(0, nv.necessario - nv.progresso) };
            }).filter(item => item.numero && item.jid && participantesGrupo.some(p => [p?.id, p?.jid, p?.lid].filter(Boolean).includes(item.jid)))
              .sort((a, b) => b.nivel - a.nivel || b.xp - a.xp || b.moedas - a.moedas).slice(0, 10);
            const mencoesRankNivel = [];
            const blocosRankNivel = lista.map((item, indice) => {
                if (!mencoesRankNivel.includes(item.jid)) mencoesRankNivel.push(item.jid);
                return (indice + 1) + '. @' + item.numero + '\n' +
                    '   🏅 Nível: ' + item.nivel + '\n' +
                    '   🪙 Moedas: ' + item.moedas + '\n' +
                    '   ✨ XP: ' + item.xp + '\n' +
                    '   📈 Falta para o próximo nível: ' + item.falta + ' XP';
            });
            const textoRankNivel = blocosRankNivel.length ? blocosRankNivel.join('\n\n') : 'Ainda não há membros identificáveis no grupo para montar o ranking. Envie algumas mensagens no grupo e tente novamente.';
            await enviarRespostaComando(from, { text: '🏆 *TOP 10 — RANKING DE NÍVEIS*\n\n' + textoRankNivel, mentions: mencoesRankNivel }); return;
        }
        if (comando === 'loja') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const mensagemLojaEnviada = await enviarRespostaComando(from, { text: '🛒 *LOJA DE ITENS*\n\n🛡️ *escudo* — 250 moedas\nBloqueia as próximas 4 tentativas de roubo contra você.\n\n🪤 *armadilha* — 130 moedas\nA próxima pessoa que tentar roubar você perde até 50 moedas.\n\n🍀 *sorte* — 120 moedas\nAumenta para 70% a chance do seu próximo roubo dar certo.\n\n✨ *boostxp* — 50 moedas\nConcede 100 XP imediatamente.\n\n🛍️ *Como comprar:* responda a esta mensagem do bot escrevendo somente o nome do item (escudo, armadilha, sorte ou boostxp).' });
            if (mensagemLojaEnviada?.key?.id) mensagensLojaPorGrupo.set(from, mensagemLojaEnviada.key.id);
            return;
        }
        if (comando === 'comprar' || comando === 'comprar-protecao') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const eco = membroEconomia(from, numeroPuroRemetente); const itemDigitado = comando === 'comprar-protecao' ? 'escudo' : (args[0] || '').toLowerCase(); const item = itemDigitado === 'protecao' ? 'escudo' : itemDigitado;
            const catalogo = { escudo: { preco: 250 }, armadilha: { preco: 130 }, sorte: { preco: 120 }, boostxp: { preco: 50 } };
            if (!catalogo[item]) return await enviarRespostaComando(from, { text: 'Item inválido. Use !loja para ver os itens disponíveis.' });
            if ((Number(eco.moedas) || 0) < catalogo[item].preco) return await enviarRespostaComando(from, { text: '⚠️ Você precisa de ' + catalogo[item].preco + ' moedas para comprar ' + item + '.' });
            eco.moedas -= catalogo[item].preco; eco.inventario = Array.isArray(eco.inventario) ? eco.inventario : [];
            if (item === 'escudo') { eco.protecaoRoubos = (Number(eco.protecaoRoubos) || 0) + 4; }
            else if (item === 'armadilha') { eco.armadilhas = (Number(eco.armadilhas) || 0) + 1; }
            else if (item === 'sorte') { eco.sorteRoubos = (Number(eco.sorteRoubos) || 0) + 1; }
            else if (item === 'boostxp') { eco.xp = (Number(eco.xp) || 0) + 100; }
            if (item !== 'boostxp') { const registro = eco.inventario.find(x => x.item === item); if (registro) registro.quantidade = (Number(registro.quantidade) || 0) + 1; else eco.inventario.push({ item, quantidade: 1 }); }
            salvarEconomia();
            const mensagemCompra = item === 'escudo' ? '🛡️ Escudo comprado por 250 moedas! As próximas 4 tentativas de roubo contra você serão bloqueadas.' : item === 'armadilha' ? '🪤 Armadilha comprada! Ela será acionada na próxima tentativa de roubo contra você.' : item === 'sorte' ? '🍀 Sorte comprada! Seu próximo roubo terá 70% de chance de sucesso.' : '✨ Boost XP comprado! Você recebeu 100 XP.';
            await enviarRespostaComando(from, { text: mensagemCompra + '\n💰 Saldo restante: ' + eco.moedas + ' moedas.' }); return;
        }
        if (comando === 'inventario') {
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            if (!isGroup || !getGrupoConfig(from).modobrincadeira) return;
            const eco = membroEconomia(from, numeroPuroRemetente); const itens = Array.isArray(eco.inventario) ? eco.inventario : [];
            const linhasItens = itens.filter(x => !['protecao','escudo','armadilha','sorte','boostxp'].includes(x.item)).map(x => x.item + ' × ' + (x.quantidade || 1));
            if ((Number(eco.protecaoRoubos) || 0) > 0) linhasItens.push('escudo anti-roubo — ' + eco.protecaoRoubos + ' tentativas restantes');
            if ((Number(eco.armadilhas) || 0) > 0) linhasItens.push('armadilha — ' + eco.armadilhas + ' disponível(is)');
            if ((Number(eco.sorteRoubos) || 0) > 0) linhasItens.push('sorte — ' + eco.sorteRoubos + ' uso(s) disponível(is)');
            await enviarRespostaComando(from, { text: '🎒 *INVENTÁRIO*\n\n' + (linhasItens.length ? linhasItens.join('\n') : 'Seu inventário está vazio.') }); return;
        }
        if (comando === 'perfil') {
            if (!isGroup) return await enviarRespostaComando(from, { text: '⚠️ Este comando só funciona dentro de um grupo.' });
            if (!isDono && !isAdm && getGrupoConfig(from).soadm) return;
            const membrosMap = estatisticasGrupo.get(from); const dados = membrosMap?.get(numeroPuroRemetente);
            if (!dados) return await enviarRespostaComando(from, { text: '⚠️ Ainda não há dados suficientes para montar seu perfil.' });
            const listaRank = Array.from(membrosMap.entries()).map(([num, item]) => ({ num, total: (Number(item.mensagens)||0)+(Number(item.stickers)||0)+(Number(item.comandos)||0) })).sort((a,b)=>b.total-a.total);
            const posicaoRank = listaRank.findIndex(item => item.num === numeroPuroRemetente) + 1;
            const diasPeriodo = Math.max(1, (Date.now() - (Number(dados.inicioPeriodo) || Date.now())) / 86400000);
            const mediaDia = ((Number(dados.mensagensPeriodo)||0) / diasPeriodo).toFixed(1).replace('.', ',');
            const conselhos = ['Valorize quem também valoriza você.', 'Pense antes de agir por impulso.', 'Não transforme toda brincadeira em problema.', 'Respeite os limites dos outros e os seus.', 'Cuide de você antes de tentar agradar todo mundo.', 'Nem toda provocação merece resposta.', 'Seja sincero, mas não perca a gentileza.', 'Aprenda com os erros sem ficar preso a eles.'];
            const valorPrograma = Math.floor(Math.random() * 10001);
            const nivelGado = Math.floor(Math.random() * 101); const nivelGay = Math.floor(Math.random() * 101);
            let textoPerfil = '👤 *PERFIL DO MEMBRO*\n\n' +
                '📨 *Mensagens no total:* ' + ((Number(dados.mensagens)||0)+(Number(dados.stickers)||0)+(Number(dados.comandos)||0)) + '\n' +
                '📊 *Média de mensagens por dia:* ' + mediaDia + '\n' +
                '💵 *Valor do programa:* R$ ' + valorPrograma + '\n' +
                '🐮 *Nível gado:* ' + nivelGado + '%\n' +
                '🌈 *Nível gay:* ' + nivelGay + '%\n' +
                '🏆 *Posição no ranking:* ' + (posicaoRank > 0 ? '#' + posicaoRank : 'Sem posição') + '\n\n' +
                '💬 *Conselho:* ' + conselhos[Math.floor(Math.random() * conselhos.length)];
            if (getGrupoConfig(from).modobrincadeira) { const eco = membroEconomia(from, numeroPuroRemetente); const nv = nivelDoXp(eco.xp); textoPerfil += '\n\n⭐ *Nível:* ' + nv.nivel + '\n✨ *XP:* ' + (Number(eco.xp)||0) + '\n📈 *Falta para o próximo nível:* ' + (nv.necessario - nv.progresso) + ' XP'; }
            await enviarRespostaComando(from, { text: textoPerfil, mentions: [jid] }); return;
        }
        if (comando === 'zerar_rank') {
            if (!isGroup) return await enviarRespostaComando(from, { text: `⚠️ Este comando só funciona dentro de um grupo.` });
            if (!isDono && !isAdm) return await enviarRespostaComando(from, { text: `⚠️ Apenas administradores podem zerar o ranking.` });
            estatisticasGrupo.set(from, new Map());
            salvarEstadoBot();
            return await enviarRespostaComando(from, { text: `✅ Ranking de mais ativos zerado! A contagem começou novamente a partir de agora.` });
        }
        if (comando === 'rankativo') {
            if (!isGroup) return;
            const membrosMap = estatisticasGrupo.get(from);
            if (!membrosMap || membrosMap.size === 0) {
                return await enviarRespostaComando(from, { text: `📊 Nenhuma atividade registrada ainda neste grupo.` });
            }
            const lista = Array.from(membrosMap.entries()).map(([num, data]) => ({
                num,...data, total: data.mensagens + data.stickers + data.comandos
            }));
            lista.sort((a, b) => b.total - a.total);
            const top5 = lista.slice(0, 5);
            const mencoesRank = [];
            let textoRank = `╭══•ೋ❀•✧๑♡ | ⪧✿⊰ | ♡๑✧•❀ೋ•══╮\n` +
                            `║⋆⃟ۣۜ᭪➣ 🔥𝐑𝐀𝐍𝐊 𝐀𝐓𝐈𝐕𝐎𝐒 𝐃𝐎 𝐆𝐑UՊ𝐎🔥\n` +
                            `╰══•ೋ❀•✧๑♡ | ⪧✿⊰ | ♡๑✧•❀ೋ•══╯\n\n`;
            top5.forEach((item, index) => {
                const posicao = index + 1;
                const jidRank = item.jid || (item.num ? `${item.num}@s.whatsapp.net` : null);
                const numeroRank = item.num || (jidRank ? jidRank.replace(/[^0-9]/g, '') : 'usuario');
                if (jidRank && !mencoesRank.includes(jidRank)) mencoesRank.push(jidRank);
                textoRank += `『 ${posicao} 』 ↴\n` +
                             ` ╔═✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ═╗\n` +
                             ` │╭━━─ ≪ •❈• ≫ ─━━╮ \n` +
                             ` │╎░⃟⃛ ➮𝚄𝚂𝚄𝙰𝚁𝙸𝙾 - @${numeroRank} (${item.nome})\n` +
                             ` │╎░⃟⃛ ➮𝙼𝙴𝙽𝚂𝙰𝙶𝙴𝙼𝚂 - ${item.mensagens}\n` +
                             ` │╎░⃟⃛ ➮𝙲𝙾𝙼𝙰𝙽𝙳𝙾𝚂 - ${item.comandos}\n` +
                             ` │╎░⃟⃛ ➮𝚂𝚃𝙸𝙲𝙺𝙴𝚁𝚂 - ${item.stickers}\n` +
                             ` │╎░⃟⃛ ➮𝚃𝙾𝚃𝙰𝙻 - ${item.total}\n` +
                             ` │╰━━─ ≪ •❈• ≫ ─━━━╯\n` +
                             ` ╚═✭･ﾟ✧*･ﾟ| ⊱✿⊰ |*✭˚･ﾟ✧･ﾟ═╝\n\n`;
            });
            await enviarRespostaComando(from, { text: textoRank.trim(), mentions: mencoesRank });
            return;
        }
        if (comando === 'cancelargrc') {
            if (!isDono && !(isGroup && isAdm)) return await enviarRespostaComando(from, { text: `⚠️ Apenas o dono do bot ou um administrador do grupo pode usar este comando.` });
            if (isGroup) sessoesGerenciamentoGrupo.delete(chaveGerenciamentoGrupo);
            else sessoesGerenciamento.delete(numeroPuroRemetente);
            for (const [grupo, rota] of destinosGerenciamentoLink.entries()) {
                if (rota?.destino === from && rota?.numero === numeroPuroRemetente) destinosGerenciamentoLink.delete(grupo);
            }
            await enviarRespostaComando(from, { text: `✅ Modo de gerenciamento encerrado com sucesso.` });
            return;
        }
        if (comando === 'gerenciar') {
            if (!isDono && !(isGroup && isAdm)) return await enviarRespostaComando(from, { text: `⚠️ Apenas o dono do bot ou um administrador do grupo pode usar este comando.` });
            const chaveSessao = isGroup ? chaveGerenciamentoGrupo : numeroPuroRemetente;
            const mapaSessao = isGroup ? sessoesGerenciamentoGrupo : sessoesGerenciamento;
            const sessaoAtual = mapaSessao.get(chaveSessao);
            if (args.length === 0) {
                try {
                    const gruposGerenciaveis = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
                    const listaChaves = gruposGerenciaveis.map(g => g.id);
                    if (listaChaves.length === 0) {
                        return await enviarRespostaComando(from, { text: `⚠️ Não encontrei grupos em que você e o bot sejam administradores.` });
                    }
                    const todosGrupos = Object.fromEntries(gruposGerenciaveis.map(g => [g.id, { subject: g.nome }]));
                    let textoAviso = '';
                    if (sessaoAtual && sessaoAtual.grupoSelecionado) {
                        let nomeGpAtual = 'Grupo';
                        try {
                            const metaAtual = await sock.groupMetadata(sessaoAtual.grupoSelecionado);
                            nomeGpAtual = metaAtual.subject;
                        } catch (e) {}
                        textoAviso = `ℹ️ *Grupo atualmente gerenciado:* 📌 *${nomeGpAtual}*\n_(Você pode escolher outro grupo abaixo para trocar)_:\n\n`;
                    }
                    mapaSessao.set(chaveSessao, { grupos: listaChaves, grupoSelecionado: sessaoAtual ? sessaoAtual.grupoSelecionado : null });
                    let textoLista = textoAviso + `📋 *GERENCIAMENTO DE GRUPOS* 👮‍♀️\n\n` +
                                     `Responda a esta mensagem com o número do grupo para selecionar ou trocar:\n` +
                                     (isGroup ? `\n📌 O gerenciamento será aplicado ao grupo selecionado, mas você continua neste grupo.\n\n` : `\n`);
                    for (let i = 0; i < listaChaves.length; i++) {
                        const meta = todosGrupos[listaChaves[i]];
                        textoLista += `*[${i + 1}]* ${meta.subject}\n`;
                    }
                    textoLista += `\nEnvie *!cancelargrc* para sair do modo de gerenciamento.`;
                    await enviarRespostaComando(from, { text: textoLista });
                } catch (err) {
                    console.log('❌ Erro ao buscar grupos para gerenciamento:', err);
                    await enviarRespostaComando(from, { text: `❌ Erro ao carregar a lista de grupos.` });
                }
                return;
            }
            const subArg = args[0].toLowerCase();
            const sessao = mapaSessao.get(chaveSessao);
            if (!sessao ||!sessao.grupos) {
                return await enviarRespostaComando(from, { text: `⚠️ Envie apenas \`!gerenciar\` primeiro para ver a lista de grupos.` });
            }
            const index = parseInt(subArg) - 1;
            if (isNaN(index) || index < 0 || index >= sessao.grupos.length) {
                return await enviarRespostaComando(from, { text: `⚠️ Número inválido. Digite um número da lista exibida pelo comando \`!gerenciar\`.` });
            }
            const idGrupoEscolhido = sessao.grupos[index];
            sessao.grupoSelecionado = idGrupoEscolhido;
            for (const [grupo, rota] of destinosGerenciamentoLink.entries()) {
                if (rota?.destino === from && rota?.numero === numeroPuroRemetente) destinosGerenciamentoLink.delete(grupo);
            }
            destinosGerenciamentoLink.set(idGrupoEscolhido, { destino: from, numero: numeroPuroRemetente, emGrupo: isGroup });
            let nomeGpEscolhido = 'Grupo';
            try {
                const metaEscolhido = await sock.groupMetadata(idGrupoEscolhido);
                nomeGpEscolhido = metaEscolhido.subject;
            } catch (e) {}
            const cfg = getGrupoConfig(idGrupoEscolhido);
            await enviarRespostaComando(from, {
                text: `✅ *Grupo Selecionado:* ${nomeGpEscolhido}\n\n` +
                      `⚙️ *Status Atual:*\n` +
                      `• Anti-Link: ${cfg.antiLink? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Anti-Flood: ${cfg.antiFlood? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Anti-Doc: ${cfg.antiDoc? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Anti-Fake: ${cfg.antiFake? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Anti-Fake Solicitações: ${cfg.antiFake1? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Anti-inativos: ${cfg.antiInativos?.ativo ? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Só ADM: ${cfg.soadm? 'Ativado✅️' : 'Desativado❌️'}\n` +
                      `• Modo brincadeira: ${cfg.modobrincadeira ? 'Ativado✅️' : 'Desativado❌️'}\n\n` +
                      `📌 Agora você pode gerenciar este grupo diretamente daqui!\n` +
                      `Comandos de controle:\n` +
                      `• \`!g antilink\` / \`!g antiflood\` / \`!g antidoc\`\n` +
                      `• \`!g anti-inativos\` / \`!g recusar-fake\`\n` +
                      `• \`!g antifake\` - Bane/remove estrangeiros após entrarem\n` +
                      `• \`!g antifake1\` - Recusa estrangeiros nas solicitações\n` +
                      `• \`!g soadm\` - Libera ou bloqueia os comandos para membros\n` +
                      `• \`!g modobrincadeira\` - Ativa ou desativa o modo brincadeira\n` +
                      `• \`!g aceitar [qtd]\` - Aceita solicitações na ordem (FIFO)\n` +
                      `• \`!g gp a\` / \`!g gp f\` - Abre ou fecha\n` +
                      `• \`!g closegp [horário]\` / \`!g opengp [horário]\` - Agendamento\n` +
                      `• \`!g totag [texto/mídia/figurinha/enquete]\` - Marca todos\n` +
                      `• \`!g zerar_rank\` - Zera o ranking e inicia nova contagem\n` +
                      `• \`!g resetar\` - Reseta o progresso do grupo selecionado (dono; exige confirmação)\n` +
                      `• \`!g iniciarppp\` - Inicia o PPP\n` +
                      `• \`!g iniciarmm\` - Inicia as Mensagens Anônimas\n` +
                      `• \`!g grupomarcar\` - Define o grupo de denúncias\n` +
                      `• \`!g grupoppp\` - Define o grupo do PPP\n` +
                      `• \`!g grupomm\` - Define o grupo das mensagens anônimas\n` +
                      `• \`!g bemvindo [texto]\` - Define boas-vindas\n` +
                      `• \`!g mensagem\` / \`!g mensagempg\` / \`!g cancelarmsg\`\n` +
                      `• \`!cancelargrc\` - Sair do modo de gerenciamento`
            });
            return;
        }
        if (comando === 'g') {
            const subCmd = args[0]?.toLowerCase();
            if (subCmd === 'resetar') {
                if (!isDono) return await enviarRespostaComando(from, { text: '⛔ Apenas o dono do bot pode usar este comando.' });
                if (!chatAlvo || !String(chatAlvo).endsWith('@g.us')) return await enviarRespostaComando(from, { text: '⚠️ Selecione primeiro um grupo com !gerenciar.' });
                let nomeGrupoReset = 'grupo selecionado';
                try { nomeGrupoReset = (await sock.groupMetadata(chatAlvo)).subject || nomeGrupoReset; } catch (e) {}
                const confirmacaoReset = await sock.sendMessage(from, { text: '⚠️ *CONFIRMAR RESET DE PROGRESSO?*\n\nGrupo: *' + nomeGrupoReset + '*\n\nSerão apagados SOMENTE neste grupo:\n• Moedas e XP\n• Níveis e inventários\n• Itens da economia\n• Ranking de atividade\n\nSerão PRESERVADOS:\n• Comandos e códigos\n• Configurações e funções ativadas\n• Tarefas, agendamentos e mensagens programadas\n• Relacionamentos\n• Sessão/conexão do WhatsApp\n\nPara confirmar, responda DIRETAMENTE a esta mensagem com *sim*. Para cancelar, responda com *não*.' });
                if (confirmacaoReset?.key?.id) confirmacoesReset.set(`${from}:${confirmacaoReset.key.id}`, { donoJid: jid, grupoAlvo: chatAlvo, criadoEm: Date.now() });
                return;
            }
            if (chatAlvo !== from) {
                const admNoAlvo = await usuarioEhAdminNoGrupo(sock, chatAlvo, jid, numeroPuroRemetente);
                const botNoAlvo = await botEhAdmin(sock, chatAlvo);
                if (!admNoAlvo || !botNoAlvo) {
                    sessoesGerenciamentoGrupo.delete(chaveGerenciamentoGrupo);
                    return await enviarRespostaComando(from, { text: `⚠️ Você ou o bot não é mais administrador do grupo selecionado. O gerenciamento remoto foi encerrado.` });
                }
            }
            const cfg = getGrupoConfig(chatAlvo);
            if (subCmd === 'status') {
                if (!chatAlvo || !chatAlvo.endsWith('@g.us')) return await enviarRespostaComando(from, { text: '⚠️ Selecione um grupo primeiro com !gerenciar.' });
                let nomeStatus = 'Grupo';
                try { nomeStatus = (await sock.groupMetadata(chatAlvo)).subject || 'Grupo'; } catch (e) {}
                const cfgStatus = getGrupoConfig(chatAlvo);
                return await enviarRespostaComando(from, { text:
                    '✅ *Grupo Selecionado:* ' + nomeStatus + '\n\n' +
                    '⚙️ *Status Atual:*\n' +
                    '• Anti-Link: ' + (cfgStatus.antiLink ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Anti-Flood: ' + (cfgStatus.antiFlood ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Anti-Doc: ' + (cfgStatus.antiDoc ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Anti-Fake: ' + (cfgStatus.antiFake ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Anti-Fake Solicitações: ' + (cfgStatus.antiFake1 ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Anti-inativos: ' + (cfgStatus.antiInativos?.ativo ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Só ADM: ' + (cfgStatus.soadm ? 'Ativado✅️' : 'Desativado❌️') + '\n' +
                    '• Modo brincadeira: ' + (cfgStatus.modobrincadeira ? 'Ativado✅️' : 'Desativado❌️') + '\n\n' +
                    '📌 Agora você pode gerenciar este grupo diretamente daqui!\n' +
                    'Comandos de controle:\n' +
                    '• `!g antilink` / `!g antiflood` / `!g antidoc`\n' +
                    '• `!g anti-inativos` / `!g recusar-fake`\n' +
                    '• `!g antifake` - Bane/remove estrangeiros após entrarem\n' +
                    '• `!g antifake1` - Recusa estrangeiros nas solicitações\n' +
                    '• `!g soadm` - Libera ou bloqueia os comandos para membros\n' +
                    '• `!g modobrincadeira` - Ativa ou desativa o modo brincadeira\n' +
                    '• `!g aceitar [qtd]` - Aceita solicitações na ordem (FIFO)\n' +
                    '• `!g gp a` / `!g gp f` - Abre ou fecha\n' +
                    '• `!g closegp [horário]` / `!g opengp [horário]` - Agendamento\n' +
                    '• `!g totag [texto/mídia/figurinha/enquete]` - Marca todos\n' +
                    '• `!g zerar_rank` - Zera o ranking e inicia nova contagem\n' +
                    '• `!g resetar` - Reseta o progresso do grupo selecionado (dono; exige confirmação)\n' +
                    '• `!g iniciarppp` - Inicia o PPP\n' +
                    '• `!g iniciarmm` - Inicia as Mensagens Anônimas\n' +
                    '• `!g grupomarcar` - Define o grupo de denúncias\n' +
                    '• `!g grupoppp` - Define o grupo do PPP\n' +
                    '• `!g grupomm` - Define o grupo das mensagens anônimas\n' +
                    '• `!g bemvindo [texto]` - Define boas-vindas\n' +
                    '• `!g mensagem` / `!g mensagempg` / `!g cancelarmsg`\n' +
                    '• `!cancelargrc` - Sair do modo de gerenciamento'
                });
            }
            if (subCmd === 'encerrar') {
                if (!chatAlvo || !chatAlvo.endsWith('@g.us')) {
                    await enviarRespostaComando(from, { text: `⚠️ Selecione um grupo primeiro.` });
                    return;
                }
                if (!isDono && !isAdm) {
                    await enviarRespostaComando(from, { text: `⚠️ Apenas administradores podem encerrar os jogos!` });
                    return;
                }
                const encerrou = await encerrarJogosGlobal(sock, chatAlvo);
                await sock.sendMessage(chatAlvo, { text: encerrou ? `🛑 *TODOS OS JOGOS ATIVOS FORAM ENCERRADOS!*` : `⚠️ Não há nenhum jogo ativo neste grupo.` });
                if (from !== chatAlvo) await enviarRespostaComando(from, { text: encerrou ? `✅ Todos os jogos foram encerrados no grupo selecionado.` : `⚠️ Não havia nenhum jogo ativo no grupo selecionado.` });
                return;
            }

            if (subCmd === 'modobrincadeira') {
                if (!isDono && !isAdm) return;
                if (chatAlvo !== from && !(await usuarioEhAdminNoGrupo(sock, chatAlvo, jid, numeroPuroRemetente))) return;
                cfg.modobrincadeira = !cfg.modobrincadeira; salvarEstadoBot();
                const statusModo = cfg.modobrincadeira ? 'Ativado✅️' : 'Desativado❌️';
                await sock.sendMessage(chatAlvo, { text: statusModo });
                if (from !== chatAlvo) { let nomeModo = 'Grupo'; try { nomeModo = (await sock.groupMetadata(chatAlvo)).subject || 'Grupo'; } catch (e) {} await enviarRespostaComando(from, { text: '✅ Modo brincadeira ' + statusModo + ' no grupo ' + nomeModo + '.' }); }
                return;
            }
            if (subCmd === 'soadm') {
                if (!isDono && !isAdm) return;
                if (chatAlvo !== from && !(await usuarioEhAdminNoGrupo(sock, chatAlvo, jid, numeroPuroRemetente))) return;
                cfg.soadm = !cfg.soadm;
                salvarEstadoBot();
                const statusTexto = cfg.soadm ? 'Ativado✅️' : 'Desativado❌️';
                await sock.sendMessage(chatAlvo, { text: statusTexto });
                if (from !== chatAlvo) {
                    let nomeGp = 'Grupo';
                    try { nomeGp = (await sock.groupMetadata(chatAlvo)).subject || 'Grupo'; } catch (e) {}
                    await enviarRespostaComando(from, { text: `✅ Só ADM alterado para *${statusTexto}* no grupo *${nomeGp}*` });
                }
                return;
            }
            if (subCmd === 'grupoppp') {
                const chaveListaPpp = `${numeroPuroRemetente}:grupoppp`;
                const argumentoPpp = args[1];
                if (!argumentoPpp) {
                    const listaPpp = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
                    listasGruposComandos.set(chaveListaPpp, listaPpp);
                    if (!listaPpp.length) return await enviarRespostaComando(from, { text: '⚠️ Não encontrei grupos em que você e o bot sejam administradores.' });
                    let textoPpp = '📋 *GRUPOS DISPONÍVEIS PARA O PPP*\n\n';
                    listaPpp.forEach((g, i) => { textoPpp += '*' + (i + 1) + '.* ' + g.nome + '\n'; });
                    textoPpp += '\nResponda a esta mensagem com o número do grupo desejado.';
                    return await enviarRespostaComando(from, { text: textoPpp });
                }
                let listaPpp = listasGruposComandos.get(chaveListaPpp);
                if (!listaPpp || !listaPpp.length) listaPpp = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
                const indicePpp = parseInt(argumentoPpp, 10) - 1;
                if (!Number.isInteger(indicePpp) || indicePpp < 0 || indicePpp >= listaPpp.length) return await enviarRespostaComando(from, { text: '⚠️ Número inválido. Use !g grupoppp para ver a lista.' });
                const escolhidoPpp = listaPpp[indicePpp];
                grupoPPP = escolhidoPpp.id;
                salvarEstadoBot();
                return await enviarRespostaComando(from, { text: '✅ Grupo do PPP definido para:\n👉 *' + escolhidoPpp.nome + '*' });
            }
            if (subCmd === 'grupomarcar') {
                const chaveListaPainel = `${numeroPuroRemetente}:grupomarcar`;
                const argumento = args[1];
                if (!argumento) {
                    try {
                        const lista = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
                        listasGruposComandos.set(chaveListaPainel, lista);
                        if (!lista.length) return await enviarRespostaComando(from, { text: `⚠️ Não encontrei grupos em que você e o bot sejam administradores.` });
                        let texto = `📋 *GRUPOS DISPONÍVEIS PARA MARCAR DENÚNCIAS*\n\n`;
                        lista.forEach((g, i) => { texto += `*${i + 1}.* ${g.nome}\n`; });
                        texto += `\nResponda a esta mensagem com o número do grupo desejado.`;
                        await enviarRespostaComando(from, { text: texto });
                    } catch (e) {
                        await enviarRespostaComando(from, { text: `❌ Não foi possível carregar a lista de grupos.` });
                    }
                    return;
                }
                let lista = listasGruposComandos.get(chaveListaPainel);
                if (!lista || !lista.length) lista = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
                const indice = parseInt(argumento, 10) - 1;
                if (isNaN(indice) || indice < 0 || indice >= lista.length) {
                    return await enviarRespostaComando(from, { text: `⚠️ Número inválido. Use *!g grupomarcar* para ver a lista.` });
                }
                const escolhido = lista[indice];
                grupoNotificacaoAdmsPorGrupo.set(chatAlvo, escolhido.id);
                salvarEstadoBot();
                listasGruposComandos.set(chaveListaPainel, lista);
                await enviarRespostaComando(from, { text: `✅ Grupo de alertas de ADMs alterado para:\n👉 *${escolhido.nome}*` });
                return;
            }
            if (subCmd === 'novasenha') {
                if (!isDono) return;
                const nova=args.slice(1).join(' '); if(!nova) return;
                CONFIG.senhaMestre=nova; const dono=lerJson('./dono.json',{}); dono.senhaMestre=nova; salvarJsonImediato('./dono.json',dono);
                await enviarRespostaComando(from,{text:'Senha alterada'}); try{await enviarRespostaComando(from,{delete:msg.key});}catch(e){} return;
            }
            if (subCmd === 'anti-inativos' || subCmd === 'antiinativos') {
                cfg.antiInativos=cfg.antiInativos||{ativo:false}; cfg.antiInativos.ativo=!cfg.antiInativos.ativo; cfg.antiInativos.ativadoEm=cfg.antiInativos.ativo?new Date().toISOString():null; salvarEstadoBot(); const st=cfg.antiInativos.ativo?'Ativado✅️':'Desativado❌️'; await sock.sendMessage(chatAlvo,{text:st}); let ng='Grupo';try{ng=(await sock.groupMetadata(chatAlvo)).subject||'Grupo';}catch(e){} if(from!==chatAlvo)await enviarRespostaComando(from,{text:`Anti-inativos do grupo ${ng} ${st}`}); return;
            }
            if(subCmd==='recusar-fake'||subCmd==='recusarfake') { const qtdSolicitada=Number.parseInt(args[1],10); if(!Number.isInteger(qtdSolicitada)||qtdSolicitada<1){await enviarRespostaComando(from,{text:'Informe a quantidade. Exemplo: !g recusar-fake 10'});return;} try { const pend=await sock.groupRequestParticipantsList(chatAlvo); const fake=(pend||[]).filter(ehSolicitacaoFake).slice(0,qtdSolicitada); let n=0; const recusados=[]; for(const p of fake){const alvo=p.jid||p.participant||p.id||p.participantPn;if(!alvo)continue;try{await sock.groupRequestParticipantsUpdate(chatAlvo,[alvo],'reject');n++;recusados.push(alvo);}catch(e){}await delay(400+Math.floor(Math.random()*401));}const restantes=Math.max(0,(pend||[]).length-n);const texto=n?`${n} fakes recusados (${restantes} solicitações restantes)\n\n${recusados.map((x,i)=>`${i+1}. @${String(x).split('@')[0]}`).join('\n')}`:'Nenhum fake estrangeiro válido para recusar';await enviarRespostaComando(from,{text:texto,mentions:recusados});}catch(e){await enviarRespostaComando(from,{text:'Precisa ser ADM'});} return; }
            if (subCmd === 'aceitar') {
                await aceitarSolicitacoes(sock, chatAlvo, args[1], from, true, jid);
                return;
            }
            if (subCmd === 'antifake') {
                cfg.antiFake = !cfg.antiFake;
                salvarEstadoBot();
                const statusTexto = cfg.antiFake ? 'Ativado✅️' : 'Desativado❌️';
                let nomeGp = 'Grupo';
                try {
                    const meta = await sock.groupMetadata(chatAlvo);
                    nomeGp = meta.subject;
                } catch (e) {}
                await sock.sendMessage(chatAlvo, { text: statusTexto });
                if (from !== chatAlvo) {
                    await enviarRespostaComando(from, { text: `✅ Anti-Fake alterado para *${statusTexto}* no grupo *${nomeGp}*` });
                }
                return;
            }
            if (subCmd === 'antifake1') {
                cfg.antiFake1 = !cfg.antiFake1;
                cfg.antiFake1Manager = cfg.antiFake1 ? from : null;
                cfg.antiFake1ManagerChat = cfg.antiFake1 ? from : null;
                salvarEstadoBot();
                const statusTexto = cfg.antiFake1 ? 'Ativado✅️' : 'Desativado❌️';
                let nomeGp = 'Grupo';
                try {
                    const meta = await sock.groupMetadata(chatAlvo);
                    nomeGp = meta.subject;
                } catch (e) {}
                await sock.sendMessage(chatAlvo, { text: statusTexto });
                if (from !== chatAlvo) {
                    await enviarRespostaComando(from, { text: `✅ Anti-Fake de solicitações alterado para *${statusTexto}* no grupo *${nomeGp}*` });
                }
                return;
            }
            if (['antilink', 'antiflood', 'antidoc'].includes(subCmd)) {
                let statusKey = subCmd === 'antilink'? 'antiLink' : subCmd === 'antiflood'? 'antiFlood' : 'antiDoc';
                cfg[statusKey] =!cfg[statusKey];
                const statusTexto = cfg[statusKey]? 'Ativado✅️' : 'Desativado❌️';
                let nomeGp = 'Grupo';
                try {
                    const meta = await sock.groupMetadata(chatAlvo);
                    nomeGp = meta.subject;
                } catch (e) {}
                await sock.sendMessage(chatAlvo, { text: statusTexto });
                if (from!== chatAlvo) {
                    await enviarRespostaComando(from, { text: `✅ ${subCmd.toUpperCase()} alterado para *${statusTexto}* no grupo *${nomeGp}*` });
                }
                return;
            }
            if (subCmd === 'bemvindo') {
                const textoArgs = args.slice(1).join(' ');
                if(textoArgs.trim()){cfg.bemVindo=true;cfg.textoBemVindo=textoArgs;}else{cfg.bemVindo=!cfg.bemVindo;}
                let nomeGp = 'Grupo';
                try {
                    const meta = await sock.groupMetadata(chatAlvo);
                    nomeGp = meta.subject;
                } catch (e) {}
                const statusBemVindo=cfg.bemVindo?'Ativado✅️':'Desativado❌️';
                await sock.sendMessage(chatAlvo,{text:statusBemVindo});
                if(from!==chatAlvo) await enviarRespostaComando(from,{text:cfg.bemVindo?`✅ Boas-vindas configuradas com sucesso no grupo *${nomeGp}*`:`✅ Boas-vindas desativadas no grupo *${nomeGp}*`});
                return;
            }
            if (subCmd === 'gp') {
                const acao = args[1]?.toLowerCase();
                if (!chatAlvo || !chatAlvo.endsWith('@g.us')) {
                    return await enviarRespostaComando(from, { text: `⚠️ Selecione um grupo primeiro ou use este comando dentro de um grupo.` });
                }
                if (acao !== 'a' && acao !== 'abrir' && acao !== 'f' && acao !== 'fechar') {
                    return await enviarRespostaComando(from, { text: `⚠️ Use: \`!g gp a\` para abrir ou \`!g gp f\` para fechar.` });
                }
                if (!(await botEhAdmin(sock, chatAlvo))) {
                    return await enviarRespostaComando(from, { text: `❌ Não consigo alterar o grupo porque o bot não está reconhecido como administrador.` });
                }
                let nomeGp = 'Grupo';
                try {
                    const meta = await sock.groupMetadata(chatAlvo);
                    nomeGp = meta.subject || 'Grupo';
                } catch (e) {}
                try {
                    if (acao === 'a' || acao === 'abrir') {
                        await sock.groupSettingUpdate(chatAlvo, 'not_announcement');
                        await sock.sendMessage(chatAlvo, { text: `🔓 Grupo aberto!` });
                        if (from !== chatAlvo) {
                            await enviarRespostaComando(from, { text: `🔓 Grupo *${nomeGp}* aberto com sucesso!` });
                        }
                    } else {
                        await sock.groupSettingUpdate(chatAlvo, 'announcement');
                        await sock.sendMessage(chatAlvo, { text: `🔒 Grupo fechado!` });
                        if (from !== chatAlvo) {
                            await enviarRespostaComando(from, { text: `🔒 Grupo *${nomeGp}* fechado com sucesso!` });
                        }
                    }
                } catch (e) {
                    console.log('❌ Erro no !g gp:', e);
                    await enviarRespostaComando(from, { text: `❌ Não foi possível alterar a configuração do grupo. Verifique se o bot continua administrador.` });
                }
                return;
            }
            if (subCmd === 'closegp' || subCmd === 'opengp') {
                const tipoAgendamento = subCmd;
                const horarioStr = args[1];
                if (!chatAlvo || !chatAlvo.endsWith('@g.us')) {
                    return await enviarRespostaComando(from, { text: `⚠️ Selecione um grupo primeiro ou use este comando dentro de um grupo.` });
                }
                if (!(await botEhAdmin(sock, chatAlvo))) {
                    return await enviarRespostaComando(from, { text: `❌ Não consigo alterar o grupo porque o bot não está reconhecido como administrador.` });
                }
                const chaveAgendamento = tipoAgendamento === 'closegp' ? 'agendamentoClose' : 'agendamentoOpen';
                const cfgAgendamento = getGrupoConfig(chatAlvo);
                if (cfgAgendamento[chaveAgendamento]?.ativo && !horarioStr) {
                    cfgAgendamento[chaveAgendamento] = { ativo: false, horario: null };
                    limparAgendamento(chatAlvo, tipoAgendamento);
                    salvarEstadoBot();
                    return await enviarRespostaComando(from, { text: `Desativado❌️` });
                }
                if (!horarioStr || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horarioStr)) {
                    return await enviarRespostaComando(from, { text: `⚠️ Use o formato correto: \`!g closegp 22:00\` ou \`!g opengp 08:00\`` });
                }
                const horarioNormalizado = horarioStr.padStart(5, '0');
                cfgAgendamento[chaveAgendamento] = { ativo: true, horario: horarioNormalizado };
                salvarEstadoBot();
                iniciarAgendamentoGrupo(sock, chatAlvo, tipoAgendamento);
                await enviarRespostaComando(from, { text: `Ativado✅️` });
                return;
            }
            if (subCmd === 'zerar_rank') {
                if (!chatAlvo || !chatAlvo.endsWith('@g.us')) {
                    return await enviarRespostaComando(from, { text: `⚠️ Selecione um grupo válido primeiro.` });
                }
                estatisticasGrupo.set(chatAlvo, new Map());
                salvarEstadoBot();
                await enviarRespostaComando(from, { text: `✅ Ranking de mais ativos zerado! A contagem começou novamente a partir de agora.` });
                return;
            }
            if (subCmd === 'iniciarppp' || subCmd === 'iniciarpppvu' || subCmd === 'iniciarmm' || subCmd === 'grupoppp' || subCmd === 'grupomm') {
                const subJogoCmd = subCmd;
                const subJogoArgs = args.slice(1);
                if (['iniciarppp', 'iniciarpppvu', 'iniciarmm'].includes(subJogoCmd) && chatAlvo && haJogoAtivoGlobal(chatAlvo)) {
                    return await enviarRespostaComando(from, { text: `⚠️ Já existe um jogo em andamento no grupo selecionado. Use *!g encerrar* para encerrar todos os jogos antes de iniciar outro.` });
                }
                await executarComandoJogo(sock, from, subJogoCmd, subJogoArgs, true, jid, numeroPuroRemetente, nomeUsuario, msg, isDono, isAdm, chatAlvo);
                if (from!== chatAlvo && !['grupoppp','grupomm'].includes(subJogoCmd)) {
                    await enviarRespostaComando(from, { text: `✅ Comando do jogo executado no grupo selecionado!` });
                }
                return;
            }
            if (subCmd === 'totag') {
                try {
                    const meta = await sock.groupMetadata(chatAlvo);
                    const todosJids = meta.participants.map(p => p.id);
                    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                    let origem = null;
                    if (contextInfo?.quotedMessage) {
                        origem = {
                            key: {
                                remoteJid: from,
                                fromMe: false,
                                id: contextInfo.stanzaId,
                                participant: contextInfo.participant
                            },
                            message: contextInfo.quotedMessage
                        };
                    } else {
                        const tipoAtual = Object.keys(desembrulharMensagem(msg.message))[0];
                        if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(tipoAtual)) origem = msg;
                    }
                    const textoTag = args.slice(1).join(' ');
                    if (!origem && !textoTag.trim()) return await enviarRespostaComando(from, { text: `⚠️ Responda a uma enquete, mídia/figurinha ou digite um texto após o comando!` });
                    const enviado = await enviarTotagSemEncaminhar(sock, chatAlvo, origem, todosJids, textoTag);
                    if (!enviado) return;
                    if (from !== chatAlvo) await enviarRespostaComando(from, { text: `✅ Totag enviado para o grupo selecionado!` });
                } catch (e) {
                    console.log('Erro no totag do grupo:', e);
                    await enviarRespostaComando(from, { text: `❌ Erro ao executar o totag no grupo.` });
                }
                return;
            }
            if (subCmd === 'mensagem' || subCmd === 'mensagempg' || subCmd === 'cancelarmsg') {
                const msgClone = JSON.parse(JSON.stringify(msg));
                msgClone.key.remoteJid = chatAlvo;
                if (msgClone.message.conversation) {
                    msgClone.message.conversation = msgClone.message.conversation.replace('!g ', '!');
                } else if (msgClone.message.extendedTextMessage?.text) {
                    msgClone.message.extendedTextMessage.text = msgClone.message.extendedTextMessage.text.replace('!g ', '!');
                }
                await mensagemHandler(sock, msgClone);
                if (from!== chatAlvo) await enviarRespostaComando(from, { text: `✅ Comando de mensagem programada executado no grupo selecionado!` });
                return;
            }
        }
        if (comando === 'closegp' || comando === 'opengp') {
            const tipoAgendamento = comando;
            const horarioStr = args[0];
            if (!chatAlvo || !chatAlvo.endsWith('@g.us')) {
                return await enviarRespostaComando(from, { text: `⚠️ Este comando precisa ser usado dentro de um grupo ou com um grupo selecionado no gerenciamento.` });
            }
            if (!(await botEhAdmin(sock, chatAlvo))) {
                return await enviarRespostaComando(from, { text: `❌ Não consigo alterar o grupo porque o bot não está reconhecido como administrador.` });
            }
            const chaveAgendamento = tipoAgendamento === 'closegp' ? 'agendamentoClose' : 'agendamentoOpen';
            const cfgAgendamento = getGrupoConfig(chatAlvo);
            if (cfgAgendamento[chaveAgendamento]?.ativo && !horarioStr) {
                cfgAgendamento[chaveAgendamento] = { ativo: false, horario: null };
                limparAgendamento(chatAlvo, tipoAgendamento);
                salvarEstadoBot();
                return await enviarRespostaComando(from, { text: `Desativado❌️` });
            }
            if (!horarioStr || !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horarioStr)) {
                return await enviarRespostaComando(from, { text: `⚠️ Use: \`!closegp 22:00\` ou \`!opengp 08:00\`` });
            }
            const horarioNormalizado = horarioStr.padStart(5, '0');
            cfgAgendamento[chaveAgendamento] = { ativo: true, horario: horarioNormalizado };
            salvarEstadoBot();
            iniciarAgendamentoGrupo(sock, chatAlvo, tipoAgendamento);
            await enviarRespostaComando(from, { text: `Ativado✅️` });
            return;
        }
        if (comando === 'ping') {
            const latencia = Date.now() - timestampInicio;
            const uptimeMs = Date.now() - tempoInicial;
            const seg = Math.floor((uptimeMs / 1000) % 60);
            const min = Math.floor((uptimeMs / (1000 * 60)) % 60);
            const hor = Math.floor((uptimeMs / (1000 * 60 * 60)) % 24);
            const dia = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
            await enviarRespostaComando(from, { text: `🏓 *Pong!*\n⚡ Latência: *${latencia}ms*\n⏳ *Online:* ${dia}d ${hor}h ${min}m ${seg}s` });
            return;
        }
        if (comando === 'listagp' || comando === 'listagrupos') {
            await enviarRespostaComando(from, { text: `⏳ Carregando a lista de grupos...` });
            try {
                const todosGrupos = await sock.groupFetchAllParticipating();
                const listaChaves = Object.keys(todosGrupos);
                let textoLista = `❒᭄꥓〭 *LISTA DE GRUPOS / COMUNIDADES ⚔*\n\n` +
                                 ` _Total de Grupos:_ ${listaChaves.length}\n\n`;
                for (let i = 0; i < listaChaves.length; i++) {
                    const idGp = listaChaves[i];
                    const meta = todosGrupos[idGp];
                    let linkConvite = 'Não disponível';
                    try {
                        const code = await sock.groupInviteCode(idGp);
                        linkConvite = `https://chat.whatsapp.com/${code}`;
                    } catch (e) {}
                    const criador = meta.owner? `@${meta.owner.split('@')[0]}` : 'Não identificado';
                    textoLista += `〘 ${i} 〙↴\n` +
                                 ` ᭪➮ *Grupo*: ${meta.subject}\n` +
                                 ` ᭪➮ *ID*: ${idGp}\n` +
                                 ` ᭪➮ *Link*: ${linkConvite}\n` +
                                 ` ᭪➮ *Criado por*: ${criador}\n` +
                                 ` ᭪➮ *Membros*: ${meta.participants? meta.participants.length : 0}\n` +
                                 ` ꫶─────୬۟◍⭟\n`;
                }
                await enviarRespostaComando(from, { text: textoLista });
            } catch (err) {
                await enviarRespostaComando(from, { text: `❌ Erro ao obter a lista de grupos.` });
            }
            return;
        }
        if (comando === 'eununca') {
            if (!isGroup) return await enviarRespostaComando(from, { text: `⚠️ Este comando só funciona em grupos!` });
            if (haJogoAtivoGlobal(from)) return await enviarRespostaComando(from, { text: `⚠️ Já existe um jogo em andamento neste grupo. Use *!encerrar* para encerrar todos os jogos antes de iniciar outro.` });
            await euNunca(sock, from);
            return;
        }
        if (comando === 'charadas') {
            if (!isGroup) return await enviarRespostaComando(from, { text: `⚠️ Este comando só funciona em grupos!` });
            if (haJogoAtivoGlobal(from)) return await enviarRespostaComando(from, { text: `⚠️ Já existe um jogo em andamento neste grupo. Use *!encerrar* para encerrar todos os jogos antes de iniciar outro.` });
            await charadas(sock, from, premiarPodioEconomia);
            return;
        }
        if (comando === 'quemsoueu') {
            if (!isGroup) return await enviarRespostaComando(from, { text: `⚠️ Este comando só funciona em grupos!` });
            if (haJogoAtivoGlobal(from)) return await enviarRespostaComando(from, { text: `⚠️ Já existe um jogo em andamento neste grupo. Use *!encerrar* para encerrar todos os jogos antes de iniciar outro.` });
            await quemSouEu(sock, from, premiarPodioEconomia);
            return;
        }
        if (comando === 'tiktok' || comando === 'tiktok2') {
            await tratarTikTok(sock, from, msg, comando, args);
            return;
        }
        if (comando === 'play') {
            await tratarYouTube(sock, from, msg, comando, args);
            return;
        }
        if (comando === 'twitter' || comando === 'twitter2') {
            await tratarTwitter(sock, from, msg, comando, args);
            return;
        }
        if (comando === 'mensagem' || comando === 'mensagempg' || comando === 'cancelarmsg') {
            const msgClone = JSON.parse(JSON.stringify(msg));
            msgClone.key.remoteJid = chatAlvo;
            await mensagemHandler(sock, msgClone);
            if (from!== chatAlvo) {
                await enviarRespostaComando(from, { text: `✅ Comando executado no grupo selecionado!` });
            }
            return;
        }
        const comandosInicioJogo = new Set(['forca', 'quiz', 'iniciarppp', 'iniciarpppvu', 'iniciarmm', 'eununca', 'charadas', 'quemsoueu']);
        const subcomandoInicioPainel = comando === 'g' ? args[0]?.toLowerCase() : '';
        if (comandosInicioJogo.has(comando) && isGroup && haJogoAtivoGlobal(from)) {
            await enviarRespostaComando(from, { text: `⚠️ Já existe um jogo em andamento neste grupo. Use *!encerrar* para encerrar todos os jogos antes de iniciar outro.` });
            return;
        }
        const comandosInicioPainel = new Set(['iniciarppp', 'iniciarpppvu', 'iniciarmm']);
        if (comandosInicioPainel.has(subcomandoInicioPainel) && chatAlvo && haJogoAtivoGlobal(chatAlvo)) {
            await enviarRespostaComando(from, { text: `⚠️ Já existe um jogo em andamento no grupo selecionado. Use *!g encerrar* para encerrar todos os jogos antes de iniciar outro.` });
            return;
        }
        const executouJogo = await executarComandoJogo(sock, from, comando, args, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, isDono, isAdm, chatAlvo);
        if (executouJogo) return;
        const executouJogo2 = await executarComandoJogos2(sock, from, comando, args, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, isDono, isAdm, premiarPodioEconomia, () => haJogoAtivoJogos(from) || haJogoAtivoVariados(from) || sessoesVelha.has(from));
        if (executouJogo2) return;
        if (comando === 'help' || comando === 'ajuda') {
            const ajuda =
                `📖 *AJUDA - COMANDOS*\n\n` +
                `📌 *BÁSICOS*\n` +
                `!menu - Mostra o menu de comandos.\n` +
                `!help / !ajuda - Mostra esta ajuda com a descrição dos comandos.\n` +
                `!ping - Mostra a resposta e o tempo do bot.\n` +
                `!adms - Marca os administradores do grupo e envia o chamado configurado.\n\n` +

                `📥 *DOWNLOADS E MÍDIA*\n` +
                `!play [música] - Procura uma música no YouTube e baixa o áudio.\n` +
                `!s - Responda a uma imagem ou vídeo para transformar em figurinha.\n` +
                `!toimg - Responda a uma figurinha para transformar em imagem.\n` +
                `!tiktok / !tiktok2 - Baixa vídeo ou áudio do TikTok.\n` +
                `!twitter / !twitter2 - Baixa vídeo ou áudio do Twitter/X.\n\n` +

                `🎮 *JOGOS*\n` +
                `!eununca - Inicia Eu Nunca no grupo.\n` +
                `!charadas - Inicia uma rodada de charadas.\n` +
                `!velha @membro - Desafia alguém para jogo da velha; aceite respondendo SIM ou NÃO e jogue respondendo ao tabuleiro com 1 a 9.\n` +
                `!tesouro - Escolha um baú respondendo à mensagem do bot com 1, 2 ou 3.\n` +
                `!roleta - Sorteia moedas e XP, podendo ganhar ou perder; intervalo de 1h30min.\n` +
                `!quemsoueu - Inicia Quem Sou Eu.\n` +
                `!forca - Mostra os temas; responda à mensagem do bot com o tema escolhido.\n` +
                `!quiz - Mostra os temas; responda à mensagem do bot com o tema escolhido.\n` +
                `!iniciarppp - Inicia o PPP.\n` +
                `!iniciarmm - Inicia as mensagens anônimas.\n` +
                `!encerrar - Encerra qualquer jogo ativo no grupo. (ADM)\n\n` +
                `💕 *RELACIONAMENTOS*\n` +
                `!namorar @membro - Faz um pedido de namoro; a pessoa responde SIM ou NÃO à mensagem do bot.\n` +
                `!casal - Lista os casais ativos e o tempo de namoro.\n` +
                `!casar - Pede casamento após pelo menos 3 dias (72 horas) de namoro.\n` +
                `!terminar - Solicita o término e confirma respondendo SIM ou NÃO à mensagem do bot.\n` +
                `!divorciar - Solicita o divórcio; a confirmação é feita respondendo à mensagem do bot.\n` +
                `!relacionamento @membro - Consulta o relacionamento de alguém no grupo.\n` +
                `!aniversariodenamoro - Mostra o tempo juntos e o próximo aniversário mensal.\n` +
                `!rankcasais - Ranking por tempo de namoro.\n` +
                `!rankcasados - Ranking por tempo de casamento.\n` +
                `!statscasal - Estatísticas do seu relacionamento.\n` +
                `!historicoamor - Histórico de relacionamentos no grupo.\n\n` +
                `🛡️ *MODERAÇÃO*\n` +
                `!ban @membro - Bane um membro.\n` +
                `!adv @membro - Dá uma advertência.\n` +
                `!rmadv @membro - Remove advertências.\n` +
                `!gp a / !gp f - Abre ou fecha o grupo.\n` +
                `!closegp / !opengp [horário] - Agenda fechamento ou abertura diária.\n` +
                `!totag - Marca todos os membros.\n` +
                `!bemvindo [texto] - Configura as boas-vindas.\n` +
                `!antilink / !antiflood / !antidoc / !antifake - Alterna proteções do grupo.\n` +
                `!antifake1 - Controla o filtro de solicitações estrangeiras.\n` +
                `!anti-inativos - Avisa sobre membros há 5 dias ou mais sem falar; eles podem ser removidos pela administração.\n` +
                `!recusar-fake - Recusa solicitações estrangeiras.\n` +
                `!mutar @membro ou respondendo à mensagem - Apaga todas as mensagens do membro mutado.\n` +
                `!desmutar @membro ou respondendo à mensagem - Libera membro mutado.\n` +
                `!grupomarcar - Define o grupo de denúncias.\n` +
                `!grupoppp - Define o grupo do PPP.\n` +
                `!grupomm - Define o grupo das mensagens anônimas. (Dono)\n\n` +
                `⚙️ *GERENCIAMENTO*\n` +
                `!mensagem / !mensagempg / !cancelarmsg - Configura mensagens programadas.\n` +
                `!rankativo - Mostra o ranking de participação do grupo.\n` +
                `!rankgay / !rankgado - Marca 5 pessoas em cada ranking.\n` +
                `!resumo - Resume as últimas 50 mensagens do grupo.\n` +
                `!zerar_rank - Zera o ranking e inicia nova contagem.\n` +
                `!listagp - Lista os grupos onde o bot está.\n` +
                `!meulid - Mostra seu LID/JID.\n` +
                `!soadm - Ativado bloqueia os comandos dos membros; Desativado libera os comandos permitidos.\n` +
                `!gerenciar - Abre o gerenciamento dos grupos pelo PV. (DONO)\n` +
                `!cancelargrc - Encerra o modo de gerenciamento. (DONO)`;
            await enviarRespostaComando(from, { text: ajuda });
            return;
        }
        if (comando === 'menuadm') {
            if (!isDono && !isAdm) {
                await enviarRespostaComando(from, { text: '⛔ Este menu é exclusivo para administradores.' });
                return;
            }
            await enviarRespostaComando(from, { text: `🛡️ *MENU DE ADMINISTRAÇÃO*\n\n!ban @membro — Remove do grupo.\n!adv / !rmadv — Adiciona ou remove advertência.\n!gp a / !gp f — Abre ou fecha o grupo agora.\n!closegp / !opengp — Agenda fechar ou abrir.\n!totag — Marca todos os membros.\n!bemvindo — Configura boas-vindas.\n!antilink / !antiflood / !antidoc / !antifake — Liga/desliga proteções.\n!antifake1 — Recusa solicitações de números estrangeiros.\n!anti-inativos — Liga/desliga avisos sobre inativos há 5 dias ou mais; membros inativos podem ser removidos pela administração.\n!recusar-fake — Recusa solicitações identificadas como fake.\n!mutar / !desmutar — Bloqueia ou libera mensagens de membro.\n!grupomarcar / !grupoppp / !grupomm — Define grupos de destino.\n!mensagem / !mensagempg / !cancelarmsg — Gerencia mensagem programada.\n!zerar_rank — Reinicia o ranking de atividade.\n!encerrar — Encerra jogos ativos no grupo.\n!soadm — Bloqueia/libera comandos de membros.` });
            return;
        }
        if (comando === 'menujogos') {
            if (isGroup && !isDono && !isAdm && getGrupoConfig(from).soadm) {
                await enviarRespostaComando(from, { text: '⛔ Os comandos para membros estão bloqueados enquanto !soadm estiver ativado.' });
                return;
            }
            await enviarRespostaComando(from, { text: `🎮 *MENU DE JOGOS E RELACIONAMENTOS*\n\n!eununca — Perguntas de Eu Nunca.\n!charadas — Adivinhe a resposta da charada.\n!quemsoueu — Descubra quem é pelas pistas.\n!velha @membro — Jogue jogo da velha.\n!tesouro — Escolha um baú e tente ganhar (intervalo individual de 15 min por jogo).\n!roleta — Sorteio de moedas/XP (intervalo de 1h30).\n!desarme — Descubra a sequência de 4 dígitos.\n!premio — Acerte o número premiado de 1 a 100.\n!copos — Encontre a bola sob um dos três copos.\n!forca — Escolha o tema respondendo à lista do bot.\n!quiz — Escolha o tema respondendo à lista do bot.\n!iniciarppp / !iniciarmm — Inicia PPP / mensagens anônimas; membros podem iniciar quando !soadm estiver desativado.\n!encerrar — Encerra jogos ativos (ADM).\n\n💕 *Relacionamentos*\n!namorar @membro — Envia pedido de namoro.\n!casal — Mostra casais do grupo.\n!casar — Pede casamento após 72h de namoro.\n!terminar — Solicita término com confirmação.\n!divorciar — Solicita divórcio com confirmação.\n!relacionamento @membro — Consulta o relacionamento.\n!aniversariodenamoro — Consulta aniversário mensal.\n!rankcasais / !rankcasados — Rankings de casais/ casados.\n!statscasal / !historicoamor — Estatísticas e histórico.` });
            return;
        }
        if (comando === 'menumemb') {
            if (isGroup && !isDono && !isAdm && getGrupoConfig(from).soadm) {
                await enviarRespostaComando(from, { text: '⛔ Os comandos para membros estão bloqueados enquanto !soadm estiver ativado.' });
                return;
            }
            await enviarRespostaComando(from, { text: `👥 *MENU DE COMANDOS PARA MEMBROS*\n\n📌 *Gerais*\n!adms — Marca os administradores.\n!meulid — Mostra seu LID/JID.\n!ping — Mostra a latência do bot.\n!perfil — Mostra perfil e posição no ranking.\n!resumo — Resume as últimas mensagens do grupo.\n\n📥 *Mídia*\n!play — Busca música no YouTube.\n!tiktok / !tiktok2 — Baixa vídeo/áudio do TikTok.\n!twitter / !twitter2 — Baixa vídeo/áudio do Twitter.\n!s — Cria figurinha.\n!toimg — Converte figurinha em imagem.\n\n🎮 *Economia e jogos*\n!saldo — Consulta saldo, XP e nível.\n!doar xp|moedas <valor> @membro — Transfere XP ou moedas.\n!diario / !missoes — Recompensa e tarefas diárias.\n!roubar @membro — Tenta roubar moedas.\n!loja / !comprar / !inventario — Loja, compras e itens.\n!rankgay / !rankgado — Rankings de brincadeira.\n!eununca / !charadas / !quemsoueu — Jogos de perguntas.\n!velha @membro — Jogo da velha.\n!tesouro — Jogo de baús.\n!roleta — Sorteio de moedas/XP.\n!desarme — Descubra o código de 4 dígitos em até 6 tentativas (intervalo individual de 15 min por jogo).\n!premio — Adivinhe o número de 1 a 100 com dicas.\n!copo / !copos — Encontre a bolinha sob um dos três copos (intervalo individual de 15 min por jogo).\n\n💕 *Relacionamentos*\n!namorar @membro — Pede namoro.\n!casal — Mostra casais.\n!casar — Pede casamento após 72h.\n!terminar / !divorciar — Solicita término/divórcio com confirmação.\n!relacionamento @membro — Consulta status.\n!aniversariodenamoro — Consulta aniversário mensal.\n!rankcasais / !rankcasados — Rankings de relacionamentos.\n!statscasal / !historicoamor — Estatísticas/histórico.\n\nOs jogos dependem das permissões do grupo e do modo de brincadeiras.` });
            return;
        }
        if (comando === 'menu') {
            const menuTexto = `📋 *MENU COMPLETO DE COMANDOS* 📋\n\n` +
                `📢 *Gerais*\n` +
                `• \`!adms\` - Marca os ADMs no grupo e notifica o painel com link direto\n\n` +
                `✅ *Solicitações*\n` +
                `• \`!aceitar [qtd]\` - Aceita solicitações pendentes na ordem de chegada (FIFO). Ex:!aceitar 5\n\n` +
                `📥 *Downloads & Mídia*\n` +
                `• \`!play [música]\` - YouTube\n` +
                `• \`!tiktok /!tiktok2\` - Baixa vídeo / áudio do TikTok\n` +
                `• \`!twitter /!twitter2\` - Baixa vídeo / áudio do Twitter\n` +
                `• \`!s\` - Cria figurinha\n` +
                `• \`!toimg\` - Converte figurinhas\n` +
                `• \`!soadm\` - Ativa ou desativa a restrição de comandos para membros\n\n` +
                `⏰ *Mensagem Programada*\n` +
                `• \`!mensagem\` - Ativa o envio automático\n` +
                `• \`!mensagempg [texto]\` - Define ou altera a mensagem programada\n` +
                `• \`!cancelarmsg\` - Encerra o envio automático\n\n` +
                `⚙️ *Moderação & Grupo*\n` +
                `• \`!gerenciar\` - Lista e gerencia grupos remotamente do PV\n` +
                `• \`!meulid\` - Mostra seu LID/JID\n` +
                `• \`!antifake1\` - Recusa estrangeiros nas solicitações\n` +
                `• \`!anti-inativos\` / \`!recusar-fake\`\n` +
                `• \`!grupomarcar\` - Define o grupo de denúncias\n` +
                `• \`!grupoppp\` - Define o grupo do PPP\n` +
                `• \`!grupomm\` - Define o grupo das mensagens anônimas\n` +
                `• \`!listagp\` - Exibe a lista completa de grupos onde o bot está\n` +
                `• \`!rankativo\` - Mostra o TOP 5 membros mais participativos do grupo\n` +
                `• \`!perfil\` - Mostra seu perfil e sua posição no ranking\n` +
                `• \`!zerar_rank\` - Zera o ranking e inicia nova contagem\n` +
                `• \`!ban @membro\` - Bane um membro do grupo\n` +
                `• \`!adv @membro\` / \`!rmadv @membro\` - Advertências (3 = Ban)\n` +
                `• \`!gp a\` / \`!gp f\` - Abre ou Fecha o grupo\n` +
                `• \`!closegp [horário]\` / \`!opengp [horário]\` - Agenda fechar/abrir grupo\n` +
                `• \`!totag [texto/mídia/figurinha/enquete]\` - Marca todos do grupo\n` +
                `• \`!bemvindo [texto]\` - Ativa mensagem de boas-vindas (Use #nmr# para marcar)\n` +
                `• \`!antilink\` / \`!antiflood\` / \`!antidoc\` / \`!antifake\` - Liga/desliga sistemas do grupo\n` +
                `• \`!mutar @membro\` ou respondendo à mensagem - Apaga as mensagens do membro mutado\n` +
                `• \`!desmutar @membro\` ou respondendo à mensagem - Libera membro mutado\n` +
                `• \`!grupomarcar\` / \`!grupoppp\` / \`!grupomm\` - Configura grupos\n` +
                `• \`!ping\` - Exibe a velocidade do bot\n\n` +
                `🎲 *Jogos & Interações*\n` +
                `• \`!modobrincadeira\` - Ativa ou desativa o modo brincadeira\n` +
                `• \`!saldo\` - Consulta saldo, XP e nível\n` +
                `• \`!doar xp|moedas <valor> @membro\` - Transfere XP ou moedas para outro membro\n` +
                `• \`!diario\` / \`!missoes\` - Bônus e missões diárias\n` +
                `• \`!roubar @membro\` - Tenta roubar moedas\n` +
                `• \`!loja\` / \`!comprar <item>\` / \`!inventario\` - Loja, escudo anti-roubo (4 bloqueios), armadilha, sorte e XP; responda à lista da loja com o nome do item para comprar\n` +
                `• \`!rankgay\` - Marca 5 pessoas no Rank Gay\n` +
                `• \`!rankgado\` - Marca 5 pessoas no Rank Gado\n` +
                `• \`!resumo\` - Resume as últimas 50 mensagens do grupo\n` +
                `• \`!ranknivel\` - Ranking de níveis (somente ADMs)\n` +
                `• \`!eununca\` / \`!charadas\` / \`!quemsoueu\` - Jogos em grupo (Eu Nunca com perguntas mais ousadas)\n` +
                `• \`!velha @membro\` - Jogo da velha por respostas à mensagem do bot\n` +
                `• \`!tesouro\` - Escolha um baú (intervalo individual de 15 min por jogo)\n` +
                `• \`!roleta\` - Sorteio de moedas/XP com intervalo de 1h30min\n` +
                `• \`!desarme\` - Descubra a sequência de 4 dígitos (intervalo individual de 15 min por jogo)\n` +
                `• \`!premio\` - Adivinhe o número premiado\n` +
                `• \`!copos\` - Encontre a bola (intervalo individual de 15 min por jogo)\n` +
                `• \`!menujogos\` - Menu de jogos e relacionamentos\n` +
                `• \`!menuadm\` - Menu exclusivo para administradores\n` +
                `• \`!menumemb\` - Lista de comandos disponíveis para membros\n` +
                `• \`!forca\` - Escolha o tema respondendo à mensagem de temas do bot\n` +
                `• \`!quiz\` - Escolha o tema respondendo à mensagem de temas do bot\n` +
                `• \`!iniciarppp\` - Inicia o PPP\n` +
                `• \`!iniciarmm\` - Inicia as mensagens anônimas\n` +
                `• \`!encerrar\` - Encerra qualquer jogo ativo neste grupo\n\n` +
                `💕 *Relacionamentos*\n` +
                `• \`!namorar @membro\` - Pede alguém em namoro; a pessoa responde SIM ou NÃO à mensagem do bot\n` +
                `• \`!casal\` - Mostra casais ativos neste grupo\n` +
                `• \`!casar\` - Pede casamento após pelo menos 3 dias (72 horas) de namoro\n` +
                `• \`!terminar\` - Solicita o término com confirmação por resposta\n` +
                `• \`!divorciar\` - Solicita divórcio com confirmação por resposta\n` +
                `• \`!relacionamento @membro\` - Consulta o status de alguém\n` +
                `• \`!aniversariodenamoro\` - Próximo aniversário mensal do namoro\n` +
                `• \`!rankcasais\` / \`!rankcasados\` - Rankings de casais\n` +
                `• \`!statscasal\` / \`!historicoamor\` - Estatísticas e histórico`;
            await enviarRespostaComando(from, { text: menuTexto });
            return;
        }
        if (comando === 'grupomarcar') {
            const chaveLista = `${numeroPuroRemetente}:grupomarcar`;
            if (!args.length) {
                try {
                    const lista = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
                    listasGruposComandos.set(chaveLista, lista);
                    if (!lista.length) return await enviarRespostaComando(from, { text: `⚠️ Não encontrei grupos em que você e o bot sejam administradores.` });
                    let texto = `📋 *GRUPOS DISPONÍVEIS PARA MARCAR DENÚNCIAS*\n\n`;
                    lista.forEach((g, i) => { texto += `*${i + 1}.* ${g.nome}\n`; });
                    texto += `\nResponda a esta mensagem com o número do grupo desejado.`;
                    await enviarRespostaComando(from, { text: texto });
                } catch (e) {
                    await enviarRespostaComando(from, { text: `❌ Não foi possível carregar a lista de grupos.` });
                }
                return;
            }
            let lista = listasGruposComandos.get(chaveLista);
            if (!lista || !lista.length) lista = await listarGruposGerenciaveis(sock, jid, numeroPuroRemetente);
            const indice = parseInt(args[0], 10) - 1;
            if (isNaN(indice) || indice < 0 || indice >= lista.length) {
                return await enviarRespostaComando(from, { text: `⚠️ Número inválido. Use *!grupomarcar* para ver a lista.` });
            }
            const escolhido = lista[indice];
            grupoNotificacaoAdmsPorGrupo.set(from, escolhido.id);
            salvarEstadoBot();
            listasGruposComandos.set(chaveLista, lista);
            await enviarRespostaComando(from, { text: `✅ Grupo de alertas de ADMs alterado para:\n👉 *${escolhido.nome}*` });
            return;
        }
        if (comando === 's') {
            if (!isGroup) return;
            await tratarSticker(sock, from, msg, comando, args);
            return;
        }
        if (comando === 'toimg') {
            if (!isGroup) return;
            await tratarToImg(sock, from, msg);
            return;
        }
        if (comando === 'ban') {
            const contexto = msg.message?.extendedTextMessage?.contextInfo;
            const alvos = [...(contexto?.mentionedJid || [])];
            const rep = contexto?.participant;
            if (rep && !alvos.includes(rep)) alvos.push(rep);
            if (alvos.length === 0) return await enviarRespostaComando(from, { text: `⚠️ Marque ou responda a mensagem de quem deseja banir!` });
            if (!chatAlvo || !chatAlvo.endsWith('@g.us')) return await enviarRespostaComando(from, { text: `⚠️ O alvo selecionado não é um grupo.` });
            if (!(await botEhAdmin(sock, chatAlvo))) return await enviarRespostaComando(from, { text: `❌ Não consigo banir neste grupo porque o bot não está reconhecido como administrador com permissão de remoção.` });
            for (const alvo of alvos) {
                try {
                    await sock.groupParticipantsUpdate(chatAlvo, [alvo], 'remove');
                    const numeroAlvo = alvo.replace(/[^0-9]/g, '') || 'membro';
                    await enviarRespostaComando(from, { text: `✅ @${numeroAlvo} foi removido com sucesso!`, mentions: [alvo] });
                } catch (e) {
                    console.log('Erro ao banir:', e);
                    await enviarRespostaComando(from, { text: `❌ Não foi possível remover o membro. Verifique se o bot está como administrador e se o alvo não é administrador.` });
                }
            }
            return;
        }
        if (comando === 'adv') {
            const alvos = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const rep = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (rep &&!alvos.includes(rep)) alvos.push(rep);
            if (alvos.length === 0) return await enviarRespostaComando(from, { text: `⚠️ Marque ou responda a mensagem de quem deseja advertir!` });
            const alvo = alvos[0];
            const numAlvo = alvo.replace(/[^0-9]/g, '');
            const chave = `${chatAlvo}_${numAlvo}`;
            let qtd = (advertenciasManuais.get(chave) || 0) + 1;
            advertenciasManuais.set(chave, qtd);
            salvarEstadoBot();
            if (qtd >= 3) {
                await enviarRespostaComando(from, { text: `🚫 @${numAlvo} atingiu 3 advertências e foi banido!`, mentions: [alvo] });
                try { await sock.groupParticipantsUpdate(chatAlvo, [alvo], 'remove'); } catch (e) {}
                advertenciasManuais.delete(chave);
                salvarEstadoBot();
            } else {
                await enviarRespostaComando(from, { text: `⚠️ @${numAlvo} recebeu uma advertência!\n📌 Total: *${qtd}/3*`, mentions: [alvo] });
            }
            return;
        }
        if (comando === 'rmadv') {
            const alvos = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const rep = msg.message?.extendedTextMessage?.contextInfo?.participant;
            if (rep &&!alvos.includes(rep)) alvos.push(rep);
            if (alvos.length === 0) return await enviarRespostaComando(from, { text: `⚠️ Marque quem deseja remover as advertências!` });
            const numAlvo = alvos[0].replace(/[^0-9]/g, '');
            const chave = `${chatAlvo}_${numAlvo}`;
            advertenciasManuais.delete(chave);
            advertenciasFlood.delete(chave);
            salvarEstadoBot();
            await enviarRespostaComando(from, { text: `✅ Advertências de @${numAlvo} zeradas!`, mentions: [alvos[0]] });
            return;
        }
        if (comando === 'gp') {
            if (!isGroup) {
                await enviarRespostaComando(from, { text: `⚠️ Este comando só funciona dentro de um grupo.` });
                return;
            }
            const sub = args[0]?.toLowerCase();
            if (sub !== 'a' && sub !== 'abrir' && sub !== 'f' && sub !== 'fechar') {
                await enviarRespostaComando(from, { text: `⚠️ Use: *!gp a* (abrir) ou *!gp f* (fechar)` });
                return;
            }
            if (!(await botEhAdmin(sock, from))) {
                await enviarRespostaComando(from, { text: `❌ Não consigo alterar o grupo porque o bot não está reconhecido como administrador.` });
                return;
            }
            try {
                if (sub === 'a' || sub === 'abrir') {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    await enviarRespostaComando(from, { text: `🔓 *Grupo aberto!*` });
                } else {
                    await sock.groupSettingUpdate(from, 'announcement');
                    await enviarRespostaComando(from, { text: `🔒 *Grupo fechado!*` });
                }
            } catch (e) {
                console.log('❌ Erro no !gp:', e);
                await enviarRespostaComando(from, { text: `❌ Não foi possível alterar a configuração do grupo. Verifique se o bot continua administrador.` });
            }
            return;
        }
        if (comando === 'totag') {
            if (!chatAlvo.endsWith('@g.us')) return;
            try {
                const meta = await sock.groupMetadata(chatAlvo);
                const todosJids = meta.participants.map(p => p.id);
                const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
                let origem = null;
                if (contextInfo?.quotedMessage) {
                    origem = {
                        key: {
                            remoteJid: from,
                            fromMe: false,
                            id: contextInfo.stanzaId,
                            participant: contextInfo.participant
                        },
                        message: contextInfo.quotedMessage
                    };
                } else {
                    const tipoAtual = Object.keys(desembrulharMensagem(msg.message))[0];
                    if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(tipoAtual)) origem = msg;
                }
                const textoMensagem = args.join(' ');
                if (!origem && !textoMensagem.trim()) return await enviarRespostaComando(from, { text: `⚠️ Responda a uma enquete, mídia/figurinha ou digite um texto após o comando!` });
                const enviado = await enviarTotagSemEncaminhar(sock, chatAlvo, origem, todosJids, textoMensagem);
                if (!enviado) return;
            } catch (e) {
                console.log('Erro no totag:', e);
                await enviarRespostaComando(from, { text: `❌ Erro ao executar o totag.` });
            }
            return;
        }
        if (comando === 'bemvindo') {
            const cfg = getGrupoConfig(chatAlvo); const textoArgs=args.join(' ');
            if(textoArgs.trim()){cfg.textoBemVindo=textoArgs;cfg.bemVindo=true;}else{cfg.bemVindo=!cfg.bemVindo;}
            salvarEstadoBot(); await enviarRespostaComando(from,{text:cfg.bemVindo?'Ativado✅️':'Desativado❌️'}); return;
        }
        if (comando === 'antilink' || comando === 'antiflood' || comando === 'antidoc' || comando === 'antifake') {
            const cfg = getGrupoConfig(chatAlvo);
            let statusKey = comando === 'antilink'? 'antiLink' : comando === 'antiflood'? 'antiFlood' : comando === 'antidoc'? 'antiDoc' : 'antiFake';
            cfg[statusKey] =!cfg[statusKey];
            salvarEstadoBot();
            const statusTexto = cfg[statusKey]? 'Ativado✅️' : 'Desativado❌️';
            await enviarRespostaComando(from, { text: statusTexto });
            return;
        }
        };
        for (const msg of (m.messages || [])) await processarMensagem(msg);
    });
}
const iniciarComTratamento = () => iniciarBot().catch(erro => {
    botIniciando = false;
    console.error('❌ Falha ao iniciar o bot:', erro?.message || 'erro de inicialização');
});
if (process.env.BOT_RESTARTED_AFTER_UPDATE === '1') setTimeout(iniciarComTratamento, 1800);
else iniciarComTratamento();

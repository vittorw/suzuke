let charadaAtual = null;
let bombaJogo = null;
let quemSouEuAtual = null;
const rankMoedas = new Map();

const BANCO_EU_NUNCA = [
    "Eu nunca dormi na sala de aula.",
    "Eu nunca me fingi de doente para não ir pra escola/trabalho.",
    "Eu nunca quebrei algo e culpei o cachorro/gato."
];

const BANCO_VERDADE = [
    "Qual foi o maior mico que você já passou na vida?",
    "Quem do grupo você levaria para uma ilha deserta?"
];

const BANCO_DESAFIO = [
    "Mande um áudio de 5 segundos cantando sua música favorita.",
    "Mude sua foto de perfil por 1 hora para algo engraçado."
];

const BANCO_CHARADAS = [
    { pergunta: "O que é, o que é? Quanto mais se tira, maior fica?", resposta: "buraco" },
    { pergunta: "O que é, o que é? Tem cabeça e tem dente, mas não é bicho e nem é gente?", resposta: "alho" }
];

const BANCO_QUIZ = [
    { pergunta: "Qual é a capital do Brasil?", valores: ["Brasília", "Rio de Janeiro", "São Paulo"], correta: "Brasília" },
    { pergunta: "Quantos planetas existem no sistema solar?", valores: ["8", "9", "7"], correta: "8" }
];

const BANCO_QUEM_SOU_EU = [
    { nome: "homem de ferro", pistas: ["Sou um bilionário", "Uso uma armadura vermelha e dourada", "Sou da Marvel"] },
    { nome: "pikachu", pistas: ["Sou amarelo", "Solto raios", "Acompanho o Ash"] }
];

async function tratarRespostas(sock, from, isGroup, textoMinusculo, numeroPuroRemetente, jid) {
    if (isGroup && charadaAtual && textoMinusculo === charadaAtual.resposta) {
        await sock.sendMessage(from, { text: `🎉 Parabéns @${numeroPuroRemetente}! Você acertou a charada! A resposta era: *${charadaAtual.resposta}*`, mentions: [jid] });
        charadaAtual = null;
    }
    if (isGroup && quemSouEuAtual && textoMinusculo === quemSouEuAtual.nome) {
        await sock.sendMessage(from, { text: `🎉 Parabéns @${numeroPuroRemetente}! Você adivinhou! O personagem era: *${quemSouEuAtual.nome.toUpperCase()}*`, mentions: [jid] });
        quemSouEuAtual = null;
    }
}

async function euNunca(sock, from) {
    const frase = BANCO_EU_NUNCA[Math.floor(Math.random() * BANCO_EU_NUNCA.length)];
    await sock.sendMessage(from, { poll: { name: `🙈 *EU NUNCA:*\n${frase}`, values: ['Já fiz 🙋‍♂️', 'Nunca fiz 🙅‍♀️'], selectableCount: 1 } });
}

async function verdade(sock, from) {
    const v = BANCO_VERDADE[Math.floor(Math.random() * BANCO_VERDADE.length)];
    await sock.sendMessage(from, { text: `❓ *VERDADE:*\n\n${v}` });
}

async function desafio(sock, from) {
    const d = BANCO_DESAFIO[Math.floor(Math.random() * BANCO_DESAFIO.length)];
    await sock.sendMessage(from, { text: `🔥 *DESAFIO:*\n\n${d}` });
}

async function charada(sock, from) {
    charadaAtual = BANCO_CHARADAS[Math.floor(Math.random() * BANCO_CHARADAS.length)];
    await sock.sendMessage(from, { text: `🧩 *CHARADA:*\n\n${charadaAtual.pergunta}\n\n👉 Responda diretamente no grupo!` });
}

async function quiz(sock, from) {
    const q = BANCO_QUIZ[Math.floor(Math.random() * BANCO_QUIZ.length)];
    await sock.sendMessage(from, { poll: { name: `🧠 *QUIZ:* ${q.pergunta}`, values: q.valores, selectableCount: 1 } });
}

async function stop(sock, from) {
    const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const letra = letras[Math.floor(Math.random() * letras.length)];
    const categorias = ["Nome", "Objeto", "Filme/Série", "Animal", "Comida", "Cidade/País"];
    const cat = categorias[Math.floor(Math.random() * categorias.length)];
    await sock.sendMessage(from, { text: `🛑 *STOP / ADEDANHA*\n\n🔤 *Letra:* ${letra}\n📌 *Categoria:* ${cat}\n\nO primeiro a responder ganha!` });
}

async function bomba(sock, from, jid, numeroPuroRemetente) {
    if (bombaJogo) return sock.sendMessage(from, { text: "⚠️ Já existe uma bomba rolando!" });
    const tempoBomba = Math.floor(Math.random() * 20000) + 15000;
    bombaJogo = { portador: jid };
    await sock.sendMessage(from, { text: `💣 *A BOMBA FOI LIGADA!*\n\nA bomba está com @${numeroPuroRemetente}! Use \`!passarbomba @membro\` para passar!`, mentions: [jid] });

    setTimeout(async () => {
        if (bombaJogo) {
            const vitima = bombaJogo.portador;
            const numVitima = vitima.replace(/[^0-9]/g, '');
            await sock.sendMessage(from, { text: `💥 *BOOOOM!* A bomba explodiu na mão de @${numVitima}!`, mentions: [vitima] });
            bombaJogo = null;
        }
    }, tempoBomba);
}

async function passarBomba(sock, from, msg) {
    if (!bombaJogo) return sock.sendMessage(from, { text: "⚠️ Não há nenhuma bomba ligada!" });
    const mencao = msg.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mencao) return sock.sendMessage(from, { text: "⚠️ Marque alguém para passar a bomba!" });
    bombaJogo.portador = mencao;
    const numNovo = mencao.replace(/[^0-9]/g, '');
    await sock.sendMessage(from, { text: `💣 A bomba foi passada para @${numNovo}! Corra!`, mentions: [mencao] });
}

async function quemSouEu(sock, from) {
    quemSouEuAtual = BANCO_QUEM_SOU_EU[Math.floor(Math.random() * BANCO_QUEM_SOU_EU.length)];
    let textoPistas = `🕵️ *QUEM SOU EU?*\n\n📌 *Pistas:*\n` + quemSouEuAtual.pistas.map(p => `• ${p}`).join('\n');
    await sock.sendMessage(from, { text: `${textoPistas}\n\n👉 Adivinhe o nome do personagem!` });
}

async function daily(sock, from, numeroPuroRemetente, jid) {
    const chave = `${from}_${numeroPuroRemetente}`;
    const dados = rankMoedas.get(chave) || { xp: 0, moedas: 0 };
    dados.moedas += 100;
    dados.xp += 50;
    rankMoedas.set(chave, dados);
    await sock.sendMessage(from, { text: `💰 @${numeroPuroRemetente} resgatou sua recompensa diária!\n\n+100 Moedas 🪙\n+50 XP ⚡`, mentions: [jid] });
}

async function rank(sock, from, numeroPuroRemetente, jid) {
    const chave = `${from}_${numeroPuroRemetente}`;
    const dados = rankMoedas.get(chave) || { xp: 0, moedas: 0 };
    await sock.sendMessage(from, { text: `🏆 *SEU PERFIL DE JOGO:*\n\n👤 Usuário: @${numeroPuroRemetente}\n🪙 Moedas: ${dados.moedas}\n⚡ XP: ${dados.xp}`, mentions: [jid] });
}

module.exports = { tratarRespostas, euNunca, verdade, desafio, charada, quiz, stop, bomba, passarBomba, quemSouEu, daily, rank };

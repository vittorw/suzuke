let cidadeDormeAtivo = false;
let jogadoresCidade = new Map();
let papeisCidade = new Map();

function iniciarCidade(sock, from, isDono, isAdm) {
    if (!isDono && !isAdm) return;
    if (cidadeDormeAtivo) {
        return sock.sendMessage(from, { text: `⚠️ *O jogo Cidade Dorme já está aberto!*\n\nUse *!entrar* para se juntar.` });
    }
    cidadeDormeAtivo = true;
    jogadoresCidade.clear();
    papeisCidade.clear();
    return sock.sendMessage(from, { text: `🌃 *CIDADE DORME INICIADO!*\n\n👥 Digitem *!entrar* no grupo para se inscrever na partida.\nQuando todos entrarem, o ADM deve digitar *!distribuir*.` });
}

function entrarCidade(sock, from, jid, numeroPuroRemetente, nomeUsuario, isGroup) {
    if (!isGroup) return;
    if (!cidadeDormeAtivo) {
        return sock.sendMessage(from, { text: `⚠️ Nenhuma partida de Cidade Dorme está aberta no momento.` });
    }
    if (jogadoresCidade.has(jid)) {
        return sock.sendMessage(from, { text: `⚠️ @${numeroPuroRemetente}, você já está inscrito!`, mentions: [jid] });
    }
    jogadoresCidade.set(jid, nomeUsuario);
    return sock.sendMessage(from, { text: `✅ @${numeroPuroRemetente} entrou na partida! (Total: ${jogadoresCidade.size} jogadores)`, mentions: [jid] });
}

async function distribuirPapéis(sock, from, isDono, isAdm) {
    if (!isDono && !isAdm) return;
    if (!cidadeDormeAtivo) return;
    if (jogadoresCidade.size < 3) {
        return sock.sendMessage(from, { text: `⚠️ É necessário ter pelo menos 3 jogadores inscritos! (Atuais: ${jogadoresCidade.size})` });
    }

    const listaJids = Array.from(jogadoresCidade.keys());
    const embaralhado = listaJids.sort(() => Math.random() - 0.5);

    papeisCidade.set(embaralhado[0], 'Assassino 🗡️');
    papeisCidade.set(embaralhado[1], 'Médico 🩺');
    papeisCidade.set(embaralhado[2], 'Detetive 🔍');

    for (let i = 3; i < embaralhado.length; i++) {
        papeisCidade.set(embaralhado[i], 'Cidadão 🧑‍🌾');
    }

    await sock.sendMessage(from, { text: `🎭 *PAPÉIS DISTRIBUÍDOS COM SUCESSO!*\n\nVerifiquem o PV ou consultem com o bot/ADM. A noite caiu na cidade... 💤` });

    for (let [j, papel] of papeisCidade.entries()) {
        try {
            await sock.sendMessage(j, { text: `🤫 *SEU PAPEL NO CIDADE DORME:*\n\nVocê é o: *${papel}*` });
        } catch (e) {
            console.log(`Não foi possível enviar PV para ${j}`);
        }
    }
}

function encerrarCidade(sock, from, isDono, isAdm) {
    if (!isDono && !isAdm) return;
    cidadeDormeAtivo = false;
    jogadoresCidade.clear();
    papeisCidade.clear();
    return sock.sendMessage(from, { text: `🛑 *Partida de Cidade Dorme encerrada!*` });
}

module.exports = { iniciarCidade, entrarCidade, distribuirPapéis, encerrarCidade };

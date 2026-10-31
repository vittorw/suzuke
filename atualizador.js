'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const { spawn, spawnSync } = require('child_process');

const REPOSITORIO_PADRAO = 'vittorw/suzuke';
const GITHUB_API = 'https://api.github.com';
const LIMITE_ARQUIVO = 1024 * 1024;
const LIMITE_MANIFESTO = 100;
const INTERVALO_VERIFICACAO_MS = 6 * 60 * 60 * 1000;
const pendencias = new Map();
let monitorTimer = null;
let monitorTimeout = null;
let monitorSock = null;
let monitorDestino = null;

function raizProjeto() {
    return path.resolve(process.env.BOT_HOME || process.cwd());
}

function caminhoInterno(nome) {
    return path.join(raizProjeto(), nome);
}

function lerJson(caminho, padrao = null) {
    try {
        return JSON.parse(fs.readFileSync(caminho, 'utf8'));
    } catch (_) {
        return padrao;
    }
}

function gravarJsonAtomico(caminho, dados) {
    const temporario = `${caminho}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(temporario, caminho);
}

function versaoInstalada() {
    const estado = lerJson(caminhoInterno('.meu_bot_version.json'));
    if (estado && typeof estado.versao === 'string') return estado.versao;
    const pkg = lerJson(caminhoInterno('package.json'), {});
    return String(pkg.version || '0.0.0').replace(/^v/i, '');
}

function analisarVersao(valor) {
    const m = String(valor || '').replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
    if (!m) return null;
    return { numeros: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] || '' };
}

function compararVersoes(a, b) {
    const x = analisarVersao(a);
    const y = analisarVersao(b);
    if (!x || !y) return null;
    for (let i = 0; i < 3; i++) {
        if (x.numeros[i] !== y.numeros[i]) return x.numeros[i] > y.numeros[i] ? 1 : -1;
    }
    if (!x.pre && !y.pre) return 0;
    if (!x.pre) return 1;
    if (!y.pre) return -1;
    return x.pre.localeCompare(y.pre, 'en', { numeric: true });
}

function tokenGithub() {
    const ambiente = String(process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
    if (ambiente) return ambiente;
    const arquivo = path.join(os.homedir(), '.config', 'meu-bot', 'github-token');
    try {
        const token = fs.readFileSync(arquivo, 'utf8').trim();
        return token || '';
    } catch (_) {
        return '';
    }
}

// Configuração do token após a conexão do WhatsApp. O segredo nunca é retornado,
// exibido ou escrito em logs; somente é persistido fora da pasta do projeto.
async function configurarTokenGithub(tokenInformado) {
    const token = String(tokenInformado || '').trim();
    if (!/^(?:github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(token)) {
        throw new Error('Formato de token GitHub inválido.');
    }
    const arquivo = path.join(os.homedir(), '.config', 'meu-bot', 'github-token');
    const diretorio = path.dirname(arquivo);
    fs.mkdirSync(diretorio, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(diretorio, 0o700); } catch (_) {}

    // Valida diretamente o token informado antes de substituir qualquer credencial existente.
    const status = await new Promise((resolve, reject) => {
        const req = https.get('https://api.github.com/repos/vittorw/suzuke', {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'meu-bot-token-setup',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            timeout: 20000
        }, res => { res.resume(); resolve(res.statusCode); });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Tempo limite ao validar o token.')));
    });
    if (status !== 200) {
        if (status === 401) throw new Error('Token recusado pelo GitHub. Confira se está válido.');
        if (status === 403) throw new Error('GitHub negou o acesso. Confira Contents: Read-only e o repositório selecionado.');
        if (status === 404) throw new Error('Repositório não encontrado ou token sem acesso a vittorw/suzuke.');
        throw new Error(`GitHub respondeu HTTP ${status}; o token não foi salvo.`);
    }

    const temporario = `${arquivo}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
        fs.writeFileSync(temporario, token, { mode: 0o600, flag: 'wx' });
        fs.chmodSync(temporario, 0o600);
        fs.renameSync(temporario, arquivo);
        try { fs.chmodSync(arquivo, 0o600); } catch (_) {}
    } catch (erro) {
        try { fs.unlinkSync(temporario); } catch (_) {}
        throw new Error('Não foi possível salvar o token com segurança.');
    }
    return true;
}

function removerTokenGithub() {
    const arquivo = path.join(os.homedir(), '.config', 'meu-bot', 'github-token');
    try { fs.unlinkSync(arquivo); return true; }
    catch (erro) { if (erro.code === 'ENOENT') return false; throw new Error('Não foi possível remover o token local.'); }
}

function mensagemHttp(status) {
    if (status === 401) return 'GitHub recusou o token. Confira se ele está válido.';
    if (status === 403) return 'GitHub negou o acesso. Confira a permissão Contents: Read-only e o limite da API.';
    if (status === 404) return 'Repositório, Release ou arquivo não encontrado. Em repositório privado, isso também pode indicar token sem acesso.';
    if (status === 429) return 'GitHub limitou temporariamente as consultas. Tente novamente mais tarde.';
    return `GitHub respondeu HTTP ${status}.`;
}

function requisicaoGithub(caminhoApi, limite = 2 * 1024 * 1024) {
    const token = tokenGithub();
    if (!token) return Promise.reject(new Error('Token do GitHub não configurado. Configure GITHUB_TOKEN ou ~/.config/meu-bot/github-token.'));
    const url = new URL(caminhoApi, GITHUB_API);
    if (url.origin !== GITHUB_API) return Promise.reject(new Error('Destino GitHub inválido.'));
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'meu-bot-updater',
                'X-GitHub-Api-Version': '2022-11-28'
            },
            timeout: 25000
        }, res => {
            const partes = [];
            let total = 0;
            res.on('data', parte => {
                total += parte.length;
                if (total > limite) {
                    req.destroy(new Error('Resposta do GitHub excedeu o limite permitido.'));
                    return;
                }
                partes.push(parte);
            });
            res.on('end', () => {
                if (req.destroyed) return;
                const corpo = Buffer.concat(partes);
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(mensagemHttp(res.statusCode)));
                }
                resolve(corpo);
            });
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Tempo limite ao consultar o GitHub.')));
    });
}

async function requisicaoJsonGithub(caminhoApi) {
    const corpo = await requisicaoGithub(caminhoApi);
    try {
        return JSON.parse(corpo.toString('utf8'));
    } catch (_) {
        throw new Error('O GitHub retornou JSON inválido.');
    }
}

function codificarCaminhoApi(caminho) {
    return caminho.split('/').map(encodeURIComponent).join('/');
}

async function obterArquivoDoRepositorio(repositorio, caminho, tag) {
    const endpoint = `/repos/${repositorio}/contents/${codificarCaminhoApi(caminho)}?ref=${encodeURIComponent(tag)}`;
    const resposta = await requisicaoJsonGithub(endpoint);
    if (!resposta || resposta.type !== 'file' || resposta.encoding !== 'base64' || typeof resposta.content !== 'string') {
        throw new Error(`O GitHub não retornou o arquivo ${caminho} em formato base64.`);
    }
    if (Number(resposta.size) > LIMITE_ARQUIVO) {
        throw new Error(`O arquivo ${caminho} excede o limite de 1 MB da API Contents.`);
    }
    const conteudo = Buffer.from(resposta.content.replace(/\s/g, ''), 'base64');
    if (conteudo.length > LIMITE_ARQUIVO) throw new Error(`O arquivo ${caminho} excede o limite de 1 MB.`);
    return conteudo;
}

function validarCaminhoRelativo(valor) {
    if (typeof valor !== 'string' || !valor || valor.includes('\0') || valor.includes('\\')) return false;
    if (['.gitignore', '.env.example'].includes(valor) || valor === 'README.md') return true;
    if (valor.startsWith('/') || /^[A-Za-z]:/.test(valor)) return false;
    const partes = valor.split('/');
    if (partes.some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) return false;
    if (valor === 'config.js' || valor === 'atualizacao.json') return false;
    if (['package.json', 'package-lock.json'].includes(valor)) return true;
    if (partes.length === 1) return valor.endsWith('.js');
    if (partes[0] === 'comandos' || partes[0] === 'jogos') {
        return partes.length <= 3 && valor.endsWith('.js');
    }
    return false;
}

function verificarSemLinkSimbolico(caminhoRelativo, permitirDestinoAusente = true) {
    if (!validarCaminhoRelativo(caminhoRelativo)) throw new Error(`Caminho não autorizado: ${caminhoRelativo}`);
    const raiz = raizProjeto();
    const destino = path.resolve(raiz, caminhoRelativo);
    const relativo = path.relative(raiz, destino);
    if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) throw new Error('Tentativa de sair da pasta do bot bloqueada.');
    let atual = raiz;
    const partes = caminhoRelativo.split('/');
    for (let i = 0; i < partes.length; i++) {
        atual = path.join(atual, partes[i]);
        try {
            const st = fs.lstatSync(atual);
            if (st.isSymbolicLink()) throw new Error(`Link simbólico não permitido: ${caminhoRelativo}`);
            if (i < partes.length - 1 && !st.isDirectory()) throw new Error(`Componente de caminho não é pasta: ${caminhoRelativo}`);
        } catch (e) {
            if (e.code === 'ENOENT' && permitirDestinoAusente) break;
            throw e;
        }
    }
    return destino;
}

function validarManifesto(manifesto, tag, versaoAtual) {
    if (!manifesto || typeof manifesto !== 'object' || Array.isArray(manifesto)) throw new Error('Manifesto inválido.');
    if (manifesto.schema !== 1) throw new Error('Versão de formato do manifesto não suportada.');
    const versao = String(manifesto.versao || '').replace(/^v/i, '');
    if (!analisarVersao(versao)) throw new Error('A versão do manifesto não é SemVer válida.');
    if (versao !== String(tag || '').replace(/^v/i, '')) throw new Error('A versão do manifesto não corresponde à tag da Release.');
    if (!analisarVersao(manifesto.versao_minima)) throw new Error('versao_minima ausente ou inválida.');
    if (!analisarVersao(manifesto.node_minimo || '20.0.0')) throw new Error('node_minimo inválido.');
    if (compararVersoes(manifesto.versao_minima, versao) > 0) throw new Error('versao_minima não pode ser maior que a versão publicada.');
    if (compararVersoes(versaoAtual, manifesto.versao_minima) < 0) {
        throw new Error(`Esta atualização exige bot v${manifesto.versao_minima} ou superior; instalado: v${versaoAtual}.`);
    }
    if (compararVersoes(process.versions.node, manifesto.node_minimo || '20.0.0') < 0) {
        throw new Error(`Esta atualização exige Node.js ${manifesto.node_minimo || '20.0.0'} ou superior; instalado: ${process.versions.node}.`);
    }
    if (!Array.isArray(manifesto.arquivos) || manifesto.arquivos.length < 1 || manifesto.arquivos.length > LIMITE_MANIFESTO) {
        throw new Error('A lista de arquivos do manifesto está vazia ou excede o limite permitido.');
    }
    const vistos = new Set();
    for (const item of manifesto.arquivos) {
        if (!item || typeof item !== 'object') throw new Error('Entrada de arquivo inválida no manifesto.');
        const caminho = item.caminho;
        if (!validarCaminhoRelativo(caminho)) throw new Error(`Arquivo não autorizado no manifesto: ${String(caminho)}`);
        if (vistos.has(caminho)) throw new Error(`Arquivo duplicado no manifesto: ${caminho}`);
        vistos.add(caminho);
        if (!/^[a-f0-9]{64}$/i.test(String(item.sha256 || ''))) throw new Error(`SHA-256 inválido para ${caminho}.`);
        if (item.requer !== undefined && (!Array.isArray(item.requer) || item.requer.some(x => typeof x !== 'string'))) {
            throw new Error(`Campo requer inválido para ${caminho}.`);
        }
    }
    for (const item of manifesto.arquivos) {
        for (const dependenciaArquivo of item.requer || []) {
            if (!vistos.has(dependenciaArquivo)) {
                throw new Error(`${item.caminho} exige ${dependenciaArquivo}, mas esse arquivo não está incluído na mesma Release.`);
            }
        }
    }
    const obrigatorios = manifesto.arquivos_obrigatorios || ['index.js', 'atualizador.js', 'package.json'];
    if (!Array.isArray(obrigatorios) || obrigatorios.some(x => typeof x !== 'string' || !validarCaminhoRelativo(x))) {
        throw new Error('arquivos_obrigatorios contém caminhos inválidos.');
    }
    const dependencias = manifesto.dependencias || {};
    if (!dependencias || typeof dependencias !== 'object' || Array.isArray(dependencias)) throw new Error('dependencias deve ser um objeto.');
    for (const [nome, versao] of Object.entries(dependencias)) {
        if (!/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(nome) || !analisarVersao(versao)) {
            throw new Error(`Dependência ou versão inválida no manifesto: ${nome}.`);
        }
    }
    const removidas = manifesto.dependencias_removidas || [];
    if (!Array.isArray(removidas) || removidas.some(x => typeof x !== 'string')) throw new Error('dependencias_removidas inválido.');
    return { versao, caminhos: vistos, obrigatorios, dependencias, removidas };
}

async function consultarAtualizacao(repositorio = REPOSITORIO_PADRAO) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repositorio)) throw new Error('Nome do repositório GitHub inválido.');
    const release = await requisicaoJsonGithub(`/repos/${repositorio}/releases/latest`);
    if (!release || release.draft || release.prerelease || !release.tag_name) throw new Error('Não encontrei uma Release estável publicada.');
    const atual = versaoInstalada();
    if (!analisarVersao(atual)) throw new Error(`Versão instalada inválida em package.json/registro local: ${atual}.`);
    const manifestoBuffer = await obterArquivoDoRepositorio(repositorio, 'atualizacao.json', release.tag_name);
    let manifesto;
    try { manifesto = JSON.parse(manifestoBuffer.toString('utf8')); }
    catch (_) { throw new Error('atualizacao.json da Release contém JSON inválido.'); }
    const validacao = validarManifesto(manifesto, release.tag_name, atual);
    const comparacao = compararVersoes(validacao.versao, atual);
    return {
        release,
        manifesto,
        validacao,
        atual,
        nova: validacao.versao,
        disponivel: comparacao > 0,
        comparacao,
        repositorio
    };
}

function formatarArquivos(manifesto) {
    return manifesto.arquivos.map(item => `• ${item.caminho}`).join('\n');
}

function enviar(sock, chat, texto, quoted) {
    return sock.sendMessage(chat, { text: texto }, quoted ? { quoted } : {});
}

async function verificar({ sock, from, msg, repositorio = REPOSITORIO_PADRAO }) {
    try {
        await enviar(sock, from, '🔎 Consultando a Release e o manifesto privado do GitHub...', msg);
        const dados = await consultarAtualizacao(repositorio);
        if (!dados.disponivel) {
            const texto = dados.comparacao === 0
                ? `✅ Seu bot já está na versão mais recente.\n\n📦 Instalada: v${dados.atual}\n🆕 Disponível: v${dados.nova}`
                : `⚠️ A Release v${dados.nova} não é mais recente que a versão instalada v${dados.atual}. Downgrade automático bloqueado.`;
            await enviar(sock, from, texto, msg);
            return;
        }
        const deps = Object.entries(dados.validacao.dependencias);
        await enviar(sock, from,
            `🆕 *ATUALIZAÇÃO DISPONÍVEL*\n\n📦 Versão instalada: v${dados.atual}\n🚀 Versão disponível: v${dados.nova}\n\n📁 *Arquivos autorizados:*\n${formatarArquivos(dados.manifesto)}\n\n📦 Dependências: ${deps.length ? deps.map(([n, v]) => `${n}@${v}`).join(', ') : 'nenhuma alteração declarada'}\n\nPara instalar, use *!atualizar*.`,
            msg);
    } catch (e) {
        await enviar(sock, from, `❌ Não foi possível verificar a atualização: ${e.message}`, msg);
    }
}

function atualizacaoAtiva() {
    const arquivo = caminhoInterno('.meu_bot_update.lock');
    if (!fs.existsSync(arquivo)) return false;
    const existente = lerJson(arquivo, {});
    return processoExiste(Number(existente.pid));
}

async function iniciar({ sock, from, msg, remetente, repositorio = REPOSITORIO_PADRAO }) {
    const chave = `${from}|${remetente}`;
    if (atualizacaoAtiva()) return enviar(sock, from, '⏳ Já existe uma atualização em andamento. Aguarde a conclusão.', msg);
    if (pendencias.has(chave)) return enviar(sock, from, '⚠️ Você já tem uma confirmação de atualização pendente.', msg);
    try {
        await enviar(sock, from, '🔎 Consultando a versão e validando o manifesto do GitHub...', msg);
        const dados = await consultarAtualizacao(repositorio);
        if (!dados.disponivel) {
            const texto = dados.comparacao === 0
                ? `✅ Seu bot já está atualizado (v${dados.atual}).`
                : `⚠️ A Release v${dados.nova} é anterior à versão instalada v${dados.atual}. Downgrade automático não é permitido.`;
            return enviar(sock, from, texto, msg);
        }
        const prompt = await enviar(sock, from,
            `🔄 *ATUALIZAÇÃO DO MEU BOT*\n\n📦 Versão atual: v${dados.atual}\n🆕 Nova versão: v${dados.nova}\n\n📁 *Somente estes arquivos serão substituídos:*\n${formatarArquivos(dados.manifesto)}\n\n📦 Dependências: ${Object.keys(dados.validacao.dependencias).length ? 'há alterações declaradas' : 'sem alterações'}\n\nResponda diretamente a esta mensagem com *SIM* para atualizar ou *NÃO* para cancelar.\n\n💾 O backup conterá somente os arquivos envolvidos e o registro de versão. Sessões e dados pessoais não serão substituídos.\n\n⏳ Confirmação expira em 60 segundos.`,
            msg);
        const registro = {
            from, remetente, messageId: prompt?.key?.id, dados,
            criadoEm: Date.now(), timer: null
        };
        registro.timer = setTimeout(() => pendencias.delete(chave), 60000);
        pendencias.set(chave, registro);
    } catch (e) {
        await enviar(sock, from, `❌ Não foi possível preparar a atualização: ${e.message}`, msg);
    }
}

function processoExiste(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; }
    catch (e) { return e.code === 'EPERM'; }
}

function adquirirTrava() {
    const arquivo = caminhoInterno('.meu_bot_update.lock');
    const dados = JSON.stringify({ pid: process.pid, inicio: new Date().toISOString() });
    try {
        const fd = fs.openSync(arquivo, 'wx', 0o600);
        fs.writeFileSync(fd, dados);
        fs.closeSync(fd);
        return () => { try { fs.unlinkSync(arquivo); } catch (_) {} };
    } catch (e) {
        if (e.code !== 'EEXIST') throw e;
        const existente = lerJson(arquivo, {});
        if (processoExiste(Number(existente.pid))) throw new Error('Já existe outra atualização em andamento.');
        try { fs.unlinkSync(arquivo); } catch (_) {}
        const fd = fs.openSync(arquivo, 'wx', 0o600);
        fs.writeFileSync(fd, dados);
        fs.closeSync(fd);
        return () => { try { fs.unlinkSync(arquivo); } catch (_) {} };
    }
}

function executar(comando, argumentos, cwd) {
    const resultado = spawnSync(comando, argumentos, {
        cwd,
        encoding: 'utf8',
        timeout: 5 * 60 * 1000,
        maxBuffer: 8 * 1024 * 1024,
        env: (() => { const ambiente = { ...process.env }; delete ambiente.GITHUB_TOKEN; delete ambiente.GH_TOKEN; return ambiente; })()
    });
    if (resultado.error) throw new Error(`${comando} não pôde ser executado: ${resultado.error.message}`);
    if (resultado.status !== 0) {
        const detalhe = String(resultado.stderr || resultado.stdout || `${comando} falhou`).trim().slice(-1200);
        throw new Error(`${comando} falhou (código ${resultado.status}): ${detalhe}`);
    }
    return resultado.stdout || '';
}

function compararDependencias(antigo, novo) {
    const a = { ...(antigo.dependencies || {}), ...(antigo.optionalDependencies || {}) };
    const n = { ...(novo.dependencies || {}), ...(novo.optionalDependencies || {}) };
    const alteradas = {};
    const removidas = [];
    for (const [nome, versao] of Object.entries(n)) if (a[nome] !== versao) alteradas[nome] = versao;
    for (const nome of Object.keys(a)) if (!(nome in n)) removidas.push(nome);
    return { alteradas, removidas };
}

function validarArquivosDePacote(dados, buffers) {
    const raiz = raizProjeto();
    const pkgAtual = lerJson(path.join(raiz, 'package.json'), {});
    let pkgNovo = pkgAtual;
    if (buffers.has('package.json')) {
        try { pkgNovo = JSON.parse(buffers.get('package.json').toString('utf8')); }
        catch (_) { throw new Error('package.json da atualização é inválido.'); }
    }
    if (!pkgNovo || typeof pkgNovo !== 'object' || !pkgNovo.main) throw new Error('package.json novo está incompleto.');
    let lockNovo = lerJson(path.join(raiz, 'package-lock.json'), {});
    if (buffers.has('package-lock.json')) {
        try { lockNovo = JSON.parse(buffers.get('package-lock.json').toString('utf8')); }
        catch (_) { throw new Error('package-lock.json da atualização é inválido.'); }
    }
    const diff = compararDependencias(pkgAtual, pkgNovo);
    const removidasManifesto = new Set(dados.validacao.removidas);
    for (const nome of diff.removidas) if (!removidasManifesto.has(nome)) {
        throw new Error(`A dependência ${nome} foi removida sem declaração em dependencias_removidas.`);
    }
    for (const nome of removidasManifesto) if (!diff.removidas.includes(nome)) {
        throw new Error(`dependencias_removidas declara ${nome}, mas ela não foi removida de package.json.`);
    }
    const declaradas = dados.validacao.dependencias;
    for (const [nome, versao] of Object.entries(diff.alteradas)) {
        if (declaradas[nome] !== versao) throw new Error(`A alteração de ${nome} não corresponde ao manifesto dependencias.`);
    }
    for (const [nome, versao] of Object.entries(declaradas)) {
        if (pkgNovo.dependencies?.[nome] !== versao && pkgNovo.optionalDependencies?.[nome] !== versao) {
            throw new Error(`package.json não declara ${nome}@${versao} conforme o manifesto.`);
        }
    }
    const lockAtualPath = path.join(raiz, 'package-lock.json');
    const lockAlterado = buffers.has('package-lock.json') &&
        (!fs.existsSync(lockAtualPath) || !buffers.get('package-lock.json').equals(fs.readFileSync(lockAtualPath)));
    const dependenciasMudaram = Object.keys(diff.alteradas).length > 0 || diff.removidas.length > 0 || lockAlterado;
    if (dependenciasMudaram) {
        if (!dados.validacao.caminhos.has('package.json') || !dados.validacao.caminhos.has('package-lock.json')) {
            throw new Error('Mudança no package-lock ou nas dependências exige package.json e package-lock.json na mesma Release.');
        }
        const raizLock = lockNovo.packages?.[''] || {};
        if (raizLock.name && pkgNovo.name && raizLock.name !== pkgNovo.name) {
            throw new Error('package-lock.json e package.json possuem nomes diferentes.');
        }
        if (raizLock.version && pkgNovo.version && raizLock.version !== pkgNovo.version) {
            throw new Error('package-lock.json e package.json possuem versões diferentes.');
        }
        const lockDeps = raizLock.dependencies || {};
        const lockOptional = raizLock.optionalDependencies || {};
        for (const [nome, versao] of Object.entries({ ...(pkgNovo.dependencies || {}), ...(pkgNovo.optionalDependencies || {}) })) {
            if (lockDeps[nome] !== versao && lockOptional[nome] !== versao) {
                throw new Error(`package-lock.json não está sincronizado para ${nome}@${versao}.`);
            }
        }
    } else if (Object.keys(declaradas).length || removidasManifesto.size) {
        throw new Error('O manifesto declara alterações de dependências, mas package.json não apresenta mudanças.');
    }
    return { dependenciasMudaram, pkgNovo };
}

function registrarHistorico(registro) {
    const arquivo = caminhoInterno('historico_atualizacoes.json');
    const historico = fs.existsSync(arquivo) ? lerJson(arquivo, null) : [];
    if (!Array.isArray(historico)) throw new Error('O histórico de atualizações existente não é um JSON de lista válido.');
    if (registro.backup && historico.some(x => x.backup === registro.backup && x.resultado === registro.resultado)) return;
    historico.push(registro);
    gravarJsonAtomico(arquivo, historico.slice(-200));
}

function restaurarPeloDiario(journal, motivo = 'recuperação de atualização interrompida') {
    const raiz = raizProjeto();
    const backupDir = path.join(raiz, '.meu_bot_backups', journal.backup_id);
    for (const item of [...(journal.arquivos || [])].reverse()) {
        const destino = verificarCaminhoDeRollback(item.caminho);
        const backup = path.join(backupDir, item.caminho);
        if (item.existia) {
            if (!fs.existsSync(backup)) throw new Error(`Backup ausente para ${item.caminho}; rollback não pode continuar.`);
            fs.mkdirSync(path.dirname(destino), { recursive: true });
            const temporario = `${destino}.${process.pid}.rollback.tmp`;
            fs.copyFileSync(backup, temporario);
            fs.renameSync(temporario, destino);
        } else {
            try { fs.unlinkSync(destino); } catch (e) { if (e.code !== 'ENOENT') throw e; }
        }
    }
    const backupVersao = path.join(backupDir, '.meu_bot_version.json');
    const arquivoVersao = caminhoInterno('.meu_bot_version.json');
    if (journal.versao_existia) {
        if (!fs.existsSync(backupVersao)) throw new Error('Backup do registro de versão ausente.');
        fs.copyFileSync(backupVersao, arquivoVersao);
    } else {
        try { fs.unlinkSync(arquivoVersao); } catch (_) {}
    }
    if (journal.dependencias_mudaram) {
        executar('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--prefer-offline'], raiz);
    }
    try {
        registrarHistorico({
            resultado: 'rollback',
            versao_anterior: journal.versao_anterior,
            versao_nova: journal.versao_nova,
            data: new Date().toISOString(),
            arquivos: (journal.arquivos || []).map(x => x.caminho),
            backup: `.meu_bot_backups/${journal.backup_id}`,
            motivo
        });
    } catch (_) {}
    try { fs.unlinkSync(caminhoInterno('.meu_bot_update_journal.json')); } catch (_) {}
}

function verificarCaminhoDeRollback(rel) {
    if (!validarCaminhoRelativo(rel)) throw new Error(`Caminho inválido no diário de rollback: ${rel}`);
    const destino = path.resolve(raizProjeto(), rel);
    const relativo = path.relative(raizProjeto(), destino);
    if (!relativo || relativo.startsWith('..') || path.isAbsolute(relativo)) throw new Error('Caminho de rollback fora do projeto.');
    let atual = raizProjeto();
    for (const parte of rel.split('/')) {
        atual = path.join(atual, parte);
        try { if (fs.lstatSync(atual).isSymbolicLink()) throw new Error(`Link simbólico detectado em ${rel}.`); }
        catch (e) { if (e.code === 'ENOENT') break; throw e; }
    }
    return destino;
}

function recuperarAtualizacaoInterrompida() {
    const arquivo = caminhoInterno('.meu_bot_update_journal.json');
    if (!fs.existsSync(arquivo)) return;
    const journal = lerJson(arquivo);
    if (!journal || !/^atualizacao-[0-9]+-[a-f0-9]+$/.test(String(journal.backup_id || '')) || !['instalando', 'concluido'].includes(journal.status)) {
        throw new Error('Diário de atualização inválido. Inicialização bloqueada para proteger os arquivos.');
    }
    if (journal.status === 'concluido') {
        try { registrarHistorico({ resultado: 'sucesso', versao_anterior: journal.versao_anterior, versao_nova: journal.versao_nova, data: journal.concluido_em || new Date().toISOString(), arquivos: (journal.arquivos || []).map(x => x.caminho), backup: `.meu_bot_backups/${journal.backup_id}`, recuperado_apos_interrupcao: true }); } catch (_) {}
        try { fs.unlinkSync(arquivo); } catch (_) {}
        return;
    }
    console.error('⚠️ Foi detectada uma atualização interrompida. Restaurando a versão anterior antes de iniciar...');
    restaurarPeloDiario(journal);
    console.error('✅ Rollback de inicialização concluído. A versão anterior foi restaurada.');
}

function verificarNodeSintaxe(arquivo) {
    executar(process.execPath, ['--check', arquivo], raizProjeto());
}

async function aplicarAtualizacao(dados) {
    const raiz = raizProjeto();
    const temporario = fs.mkdtempSync(path.join(os.tmpdir(), 'meu-bot-update-'));
    const stage = path.join(temporario, 'stage');
    fs.mkdirSync(stage, { recursive: true });
    const buffers = new Map();
    const id = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
    const backupId = `atualizacao-${id}`;
    const backupDir = path.join(raiz, '.meu_bot_backups', backupId);
    const journalPath = caminhoInterno('.meu_bot_update_journal.json');
    let journalGravado = false;
    try {
        for (const item of dados.manifesto.arquivos) {
            const destinoLocal = verificarSemLinkSimbolico(item.caminho);
            if (fs.existsSync(destinoLocal)) {
                if (fs.lstatSync(destinoLocal).isDirectory()) throw new Error(`${item.caminho} aponta para uma pasta, não para um arquivo.`);
                const hashLocal = crypto.createHash('sha256').update(fs.readFileSync(destinoLocal)).digest('hex');
                if (hashLocal.toLowerCase() === item.sha256.toLowerCase()) continue;
            }
            const buffer = await obterArquivoDoRepositorio(dados.repositorio || REPOSITORIO_PADRAO, item.caminho, dados.release.tag_name);
            const hash = crypto.createHash('sha256').update(buffer).digest('hex');
            if (hash.toLowerCase() !== item.sha256.toLowerCase()) {
                throw new Error(`SHA-256 não confere para ${item.caminho}. Nenhum arquivo foi instalado.`);
            }
            buffers.set(item.caminho, buffer);
            const destinoStage = path.join(stage, item.caminho);
            fs.mkdirSync(path.dirname(destinoStage), { recursive: true });
            fs.writeFileSync(destinoStage, buffer, { mode: 0o600 });
        }
        const pacote = validarArquivosDePacote(dados, buffers);
        const presentesDepois = new Set();
        for (const rel of dados.validacao.obrigatorios) {
            const destino = verificarSemLinkSimbolico(rel);
            if (!fs.existsSync(destino) && !buffers.has(rel)) throw new Error(`Arquivo obrigatório ausente: ${rel}.`);
            presentesDepois.add(rel);
        }
        for (const [rel] of buffers) {
            const destino = verificarSemLinkSimbolico(rel);
            if (rel.endsWith('.js')) verificarNodeSintaxe(path.join(stage, rel));
            if (rel === 'package.json' || rel === 'package-lock.json') JSON.parse(buffers.get(rel).toString('utf8'));
            if (fs.existsSync(destino) && fs.lstatSync(destino).isDirectory()) throw new Error(`${rel} aponta para uma pasta, não para um arquivo.`);
        }
        if (pacote.dependenciasMudaram) {
            const pkgPath = path.join(stage, 'package.json');
            const lockPath = path.join(stage, 'package-lock.json');
            if (!fs.existsSync(pkgPath) && fs.existsSync(path.join(raiz, 'package.json'))) fs.copyFileSync(path.join(raiz, 'package.json'), pkgPath);
            if (!fs.existsSync(lockPath) && fs.existsSync(path.join(raiz, 'package-lock.json'))) fs.copyFileSync(path.join(raiz, 'package-lock.json'), lockPath);
            if (!fs.existsSync(pkgPath) || !fs.existsSync(lockPath)) throw new Error('Arquivos de dependências não foram preparados.');
        }

        const backupRoot = path.join(raiz, '.meu_bot_backups');
        if (fs.existsSync(backupRoot) && fs.lstatSync(backupRoot).isSymbolicLink()) {
            throw new Error('A pasta de backups é um link simbólico; atualização bloqueada.');
        }
        const totalBaixado = [...buffers.values()].reduce((total, b) => total + b.length, 0);
        try {
            const disco = fs.statfsSync(raiz);
            const livre = Number(disco.bavail) * Number(disco.bsize);
            const minimo = Math.max(totalBaixado * 2 + 8 * 1024 * 1024, pacote.dependenciasMudaram ? 100 * 1024 * 1024 : 0);
            if (livre < minimo) throw new Error(`Espaço livre insuficiente. Disponível: ${Math.floor(livre / 1024 / 1024)} MB; necessário estimado: ${Math.ceil(minimo / 1024 / 1024)} MB.`);
        } catch (e) {
            if (e.message && e.message.startsWith('Espaço livre insuficiente')) throw e;
            if (!['ENOSYS', 'ERR_METHOD_NOT_IMPLEMENTED'].includes(e.code)) throw e;
        }
        fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
        const entradas = [];
        for (const [rel] of buffers) {
            const destino = verificarSemLinkSimbolico(rel);
            const existia = fs.existsSync(destino);
            if (existia) {
                const backup = path.join(backupDir, rel);
                fs.mkdirSync(path.dirname(backup), { recursive: true });
                fs.copyFileSync(destino, backup);
            }
            entradas.push({ caminho: rel, existia });
        }
        const arquivoVersao = caminhoInterno('.meu_bot_version.json');
        const versaoExistia = fs.existsSync(arquivoVersao);
        if (versaoExistia) fs.copyFileSync(arquivoVersao, path.join(backupDir, '.meu_bot_version.json'));

        const journal = {
            status: 'instalando',
            backup_id: backupId,
            versao_anterior: dados.atual,
            versao_nova: dados.nova,
            versao_existia: versaoExistia,
            dependencias_mudaram: pacote.dependenciasMudaram,
            iniciado_em: new Date().toISOString(),
            arquivos: entradas
        };
        gravarJsonAtomico(journalPath, journal);
        journalGravado = true;

        for (const [rel, buffer] of buffers) {
            const destino = verificarSemLinkSimbolico(rel);
            fs.mkdirSync(path.dirname(destino), { recursive: true });
            const temporarioDestino = `${destino}.${id}.tmp`;
            fs.writeFileSync(temporarioDestino, buffer, { mode: 0o600 });
            fs.renameSync(temporarioDestino, destino);
        }

        if (pacote.dependenciasMudaram) {
            executar('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--prefer-offline'], raiz);
            for (const [nome, versao] of Object.entries(dados.validacao.dependencias)) {
                const caminhoPacote = path.join(raiz, 'node_modules', ...nome.split('/'), 'package.json');
                const instalado = lerJson(caminhoPacote, {});
                if (instalado.version !== versao) throw new Error(`A dependência ${nome} não foi instalada na versão ${versao}.`);
            }
        }

        gravarJsonAtomico(arquivoVersao, {
            versao: dados.nova,
            atualizado_em: new Date().toISOString(),
            release_tag: dados.release.tag_name
        });
        const journalConcluido = lerJson(journalPath, journal);
        journalConcluido.status = 'concluido';
        journalConcluido.concluido_em = new Date().toISOString();
        gravarJsonAtomico(journalPath, journalConcluido);
        registrarHistorico({
            resultado: 'sucesso',
            versao_anterior: dados.atual,
            versao_nova: dados.nova,
            data: new Date().toISOString(),
            arquivos: [...buffers.keys()],
            dependencias_alteradas: dados.validacao.dependencias,
            dependencias_removidas: dados.validacao.removidas,
            backup: `.meu_bot_backups/${backupId}`
        });
        try { fs.unlinkSync(journalPath); } catch (_) {}
        return { backup: `.meu_bot_backups/${backupId}`, arquivos: [...buffers.keys()] };
    } catch (e) {
        if (journalGravado) {
            const journal = lerJson(journalPath);
            if (journal) {
                try {
                    restaurarPeloDiario(journal, e.message);
                } catch (rollbackErro) {
                    throw new Error(`${e.message} O rollback automático também falhou: ${rollbackErro.message}. O diário foi preservado para recuperação na próxima inicialização.`);
                }
            }
        }
        throw e;
    } finally {
        try { fs.rmSync(temporario, { recursive: true, force: true }); } catch (_) {}
    }
}

async function tratarConfirmacao({ sock, from, remetente, isDono, texto, msg }) {
    const chave = `${from}|${remetente}`;
    const pendencia = pendencias.get(chave);
    if (!pendencia) return false;
    if (Date.now() - pendencia.criadoEm > 60000) {
        clearTimeout(pendencia.timer);
        pendencias.delete(chave);
        if (isDono) await enviar(sock, from, '⌛ O prazo de 60 segundos expirou. Nenhum arquivo foi alterado.', msg);
        return Boolean(isDono);
    }
    if (!isDono || from !== pendencia.from || remetente !== pendencia.remetente) return false;
    const contexto = msg?.message?.extendedTextMessage?.contextInfo;
    if (!contexto?.stanzaId || contexto.stanzaId !== pendencia.messageId) return false;
    const resposta = String(texto || '').trim().toLocaleUpperCase('pt-BR');
    if (!['SIM', 'S', 'NÃO', 'NAO', 'N'].includes(resposta)) return false;
    clearTimeout(pendencia.timer);
    pendencias.delete(chave);
    if (['NÃO', 'NAO', 'N'].includes(resposta)) {
        await enviar(sock, from, '❎ Atualização cancelada. Nenhum arquivo foi alterado.', msg);
        return true;
    }
    let liberarTrava;
    try {
        liberarTrava = adquirirTrava();
        await enviar(sock, from, '⏳ Confirmação recebida. Baixando e validando os arquivos autorizados...', msg);
        const resultado = await aplicarAtualizacao(pendencia.dados);
        await enviar(sock, from,
            `✅ *ATUALIZAÇÃO CONCLUÍDA*\n\n📦 Versão: v${pendencia.dados.atual} → v${pendencia.dados.nova}\n📁 Arquivos instalados: ${resultado.arquivos.join(', ')}\n💾 Backup: ${resultado.backup}\n\n🔄 O bot será reiniciado.`,
            msg);
        reiniciarProcesso();
    } catch (e) {
        try {
            registrarHistorico({
                resultado: 'falha',
                versao_anterior: pendencia.dados.atual,
                versao_nova: pendencia.dados.nova,
                data: new Date().toISOString(),
                arquivos: pendencia.dados.manifesto.arquivos.map(x => x.caminho),
                dependencias_alteradas: pendencia.dados.validacao.dependencias,
                motivo: String(e.message || e).slice(0, 1200)
            });
        } catch (_) {}
        await enviar(sock, from, `❌ Atualização não concluída.\n\nMotivo: ${e.message}\n\nOs arquivos anteriores foram restaurados quando possível.`, msg);
    } finally {
        if (liberarTrava) liberarTrava();
    }
    return true;
}

function reiniciarProcesso() {
    if (typeof process.send === 'function') {
        try { process.send('shutdown'); } catch (_) {}
        const timer = setTimeout(() => process.exit(0), 1000);
        if (timer.unref) timer.unref();
        return;
    }
    const filho = spawn(process.execPath, process.argv.slice(1), {
        cwd: raizProjeto(),
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, BOT_RESTARTED_AFTER_UPDATE: '1' }
    });
    let timerSaida = null;
    filho.once('error', erro => {
        if (timerSaida) clearTimeout(timerSaida);
        console.error('❌ Não foi possível iniciar o processo atualizado; o processo atual continuará ativo:', erro.message);
    });
    filho.once('exit', (codigo, sinal) => {
        if (codigo !== 0 && timerSaida) {
            clearTimeout(timerSaida);
            timerSaida = null;
            console.error(`❌ O processo atualizado encerrou antes da troca (código ${codigo ?? 'desconhecido'}, sinal ${sinal || 'nenhum'}). O processo atual continuará ativo.`);
        }
    });
    filho.once('spawn', () => {
        filho.unref();
        timerSaida = setTimeout(() => process.exit(0), 700);
    });
}

async function verificarSilenciosamente(repositorio) {
    try {
        const dados = await consultarAtualizacao(repositorio);
        if (!dados.disponivel) return null;
        const arquivoAviso = caminhoInterno('.meu_bot_ultima_notificacao.json');
        const estado = lerJson(arquivoAviso, {});
        if (estado.versao === dados.nova) return null;
        return dados;
    } catch (e) {
        console.error('Verificação automática do GitHub não concluída:', e.message);
        return null;
    }
}

function pararMonitoramento() {
    if (monitorTimer) clearInterval(monitorTimer);
    if (monitorTimeout) clearTimeout(monitorTimeout);
    monitorTimer = null;
    monitorTimeout = null;
    monitorSock = null;
    monitorDestino = null;
}

function iniciarMonitoramento({ sock, destino, repositorio = REPOSITORIO_PADRAO }) {
    if (!sock || !destino) return;
    pararMonitoramento();
    monitorSock = sock;
    monitorDestino = destino;
    const verificar = async () => {
        if (monitorSock !== sock || !sock.user) return;
        const dados = await verificarSilenciosamente(repositorio);
        if (!dados) return;
        try {
            await sock.sendMessage(destino, {
                text: `🆕 *NOVA ATUALIZAÇÃO DISPONÍVEL*\n\n📦 Instalada: v${dados.atual}\n🚀 Disponível: v${dados.nova}\n\n📁 Arquivos:\n${formatarArquivos(dados.manifesto)}\n\nUse *!atualizar* para revisar e instalar.`
            });
            gravarJsonAtomico(caminhoInterno('.meu_bot_ultima_notificacao.json'), {
                versao: dados.nova,
                notificado_em: new Date().toISOString()
            });
        } catch (e) {
            console.error('Não foi possível enviar o aviso de atualização:', e.message);
        }
    };
    monitorTimeout = setTimeout(verificar, 30000);
    monitorTimer = setInterval(verificar, INTERVALO_VERIFICACAO_MS);
}

function montarStatus(dados = {}) {
    const uptime = Math.floor(process.uptime());
    const ambiente = process.env.TERMUX_VERSION ? 'Termux' :
        process.env.PM2_HOME ? 'PM2' :
        process.env.KATABUMP ? 'Katabump/compatível' :
        process.env.RENDER ? 'Render' :
        `${process.platform}/${process.arch}`;
    const formatar = s => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
    return `📊 *STATUS DO MEU BOT*\n\n` +
        `• Processo: ativo (${formatar(uptime)})\n` +
        `• WhatsApp: ${dados.conectado ? 'conectado' : (dados.estadoConexao || 'desconhecido')}\n` +
        `• Sessão registrada: ${dados.sessaoRegistrada ? 'sim' : 'não confirmado'}\n` +
        `• Reconexão automática: ${dados.tentativasReconexao || 0} tentativa(s) nesta sequência\n` +
        `• Próxima/última tentativa: ${dados.ultimaTentativaReconexao || 'não agendada'}\n` +
        `• Última desconexão: ${dados.ultimaDesconexao || 'nenhuma registrada nesta execução'}\n` +
        `• Versão: v${dados.versao || versaoInstalada()}\n` +
        `• Ambiente: ${ambiente}`;
}

// A recuperação acontece ao carregar o módulo, antes de o index.js abrir o socket.
recuperarAtualizacaoInterrompida();

module.exports = {
    iniciar,
    verificar,
    tratarConfirmacao,
    versaoInstalada,
    montarStatus,
    iniciarMonitoramento,
    pararMonitoramento,
    consultarAtualizacao,
    configurarTokenGithub,
    removerTokenGithub
};

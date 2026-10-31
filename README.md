# Meu Bot

Projeto do **Meu Bot** para WhatsApp. O repositório privado no GitHub chama-se **suzuke**; esse é apenas o nome do repositório, não o nome do bot.

## Requisitos

- Node.js 20.9.0 ou superior (Baileys `7.0.0-rc14` e Sharp `0.35.5`).
- npm compatível com a versão do Node.js.
- Acesso à internet para instalar dependências e conectar ao WhatsApp.
- FFmpeg/yt-dlp podem ser necessários para recursos de mídia; o projeto declara os pacotes auxiliares no `package.json`.

## Instalação

```bash
git clone git@github.com:vittorw/suzuke.git
cd suzuke
npm install
npm start
```

O repositório é privado. Configure antes uma integração GitHub ou uma chave SSH/deploy key com acesso somente ao repositório. Não coloque token pessoal na URL do `git clone`, em scripts ou neste repositório.

## Configuração do proprietário

O `index.js` lê estas variáveis de ambiente, que têm prioridade sobre `dono.json` local (se existir). Sem variáveis definidas, a configuração local do Termux continua valendo:

- `BOT_OWNER_NUMBER`: número do proprietário com DDI e DDD, somente dígitos.
- `BOT_OWNER_NUMBER_NO9`: variante sem o nono dígito, se aplicável.
- `BOT_OWNER_LID`: LID completo, se disponível.
- `BOT_OWNER_LID_PURO`: LID sem sufixo, se disponível.
- `BOT_MASTER_PASSWORD`: senha mestre, se utilizada pelo proprietário.

Use o painel de variáveis de ambiente da hospedagem ou um `.env` local (o `index.js` lê esse arquivo sem sobrescrever variáveis já definidas pelo painel). O arquivo `.env.example` contém apenas nomes e valores vazios. Nunca publique `.env`, `dono.json` ou `config.js`.

## Sessão independente do WhatsApp

- **Termux:** por padrão, o Meu Bot continua usando `sessao_bot_v107` dentro da pasta local do projeto. Defina `BOT_AUTH_DIR` somente se quiser apontar explicitamente para a pasta da sessão que já utiliza.
- **KataBump:** clone o código em `/home/container/suzuke` e configure `BOT_AUTH_DIR=/home/container/suzuke_auth`. Essa pasta fica fora de `/home/container/suzuke` (código clonado), portanto não compartilha nem importa a sessão do Termux.
- Não sincronize, copie ou faça upload de nenhuma pasta de sessão entre ambientes.
- Preserve `/home/container/suzuke_auth` ao atualizar ou recriar os arquivos do projeto. A documentação pública da KataBump consultada descreve `/home/container` como diretório de trabalho e a console como visualizador de logs; não documenta claramente um volume externo dedicado. Confirme com o suporte/painel se os arquivos em `/home/container` sobrevivem à recriação completa do servidor. Se não sobreviverem, será necessário um armazenamento persistente oferecido pela plataforma antes de usar a sessão como definitiva.

## Conexão na KataBump

Na console da hospedagem, clone em uma subpasta própria (não diretamente em `/home/container`), instale as dependências dentro dela e inicie a partir dessa pasta:

```bash
cd /home/container
git clone git@github.com:vittorw/suzuke.git suzuke
cd /home/container/suzuke
npm install
npm start
```

Se o painel exigir o campo `JS FILE`, configure `suzuke/index.js`; como o `index.js` ancora o diretório de trabalho em sua própria pasta, os caminhos relativos continuam apontando para o projeto. Se o painel não permitir definir esse caminho ou executar os comandos de instalação na console, confirme com o suporte antes de publicar. A instalação manual acima é necessária porque o `package.json` fica dentro da subpasta `suzuke`.

Configure no painel (Startup/Environment Variables) ou em um `.env` local dentro da pasta do projeto:

```text
BOT_AUTH_DIR=/home/container/suzuke_auth
BOT_CONNECTION_METHOD=pairing
BOT_PAIRING_NUMBER=55DDDNUMERO
BOT_OWNER_NUMBER=
BOT_OWNER_LID=
```

Substitua `55DDDNUMERO` pelo número do WhatsApp que será conectado à sessão **da hospedagem**. `BOT_CONNECTION_METHOD=pairing` e `BOT_PAIRING_NUMBER` evitam a pergunta interativa no início; o código de pareamento é exibido nos logs do processo. A documentação da KataBump confirma console com logs em tempo real, mas não confirma entrada interativa (stdin) nem renderização de QR no painel. Por isso, prefira o pareamento por número e confira os logs. Se o painel não expuser o código, será necessário um método de conexão alternativo aprovado pela hospedagem.

Para QR, configure `BOT_CONNECTION_METHOD=qr`. O QR é renderizado no stdout pelo `qrcode-terminal`; não presuma que todo painel web renderizará o desenho corretamente.

## Dados locais

Os JSONs de economia, missões, grupos, relacionamentos, mensagens e demais estados são dados locais. Eles são ignorados pelo Git e não fazem parte do pacote limpo. O código cria estruturas padrão quando esses arquivos ainda não existem; em uma migração, mantenha os arquivos de dados originais no ambiente correspondente.

## Atualizações pelo GitHub

O atualizador consulta Releases privadas do repositório `vittorw/suzuke`. Configure o token pelo comando privado `!token` no chat com o bot, ou por `GITHUB_TOKEN`/`GH_TOKEN` no ambiente. O arquivo salvo pelo comando fica em `~/.config/meu-bot/github-token`, fora da pasta do projeto. Não coloque `GITHUB_TOKEN` ou `GH_TOKEN` no `.env`. `!removertoken` remove o token salvo. Use token de acesso restrito ao repositório com permissão de leitura de Contents. Nunca inclua o token em commits, manifesto, ZIP ou logs.

O atualizador compara os hashes locais com `atualizacao.json` e baixa somente arquivos ausentes ou diferentes; valida SHA-256 dos downloads e sintaxe JS, e cria backup antes de aplicar arquivos autorizados. O manifesto não inclui sessões nem dados privados.

## Recursos e limites

O código depende de Baileys, FFmpeg/yt-dlp, Sharp e demais bibliotecas listadas no `package.json`. Instale com `npm install`; não copie `node_modules` de Android para Linux, pois módulos nativos podem ser incompatíveis entre plataformas.

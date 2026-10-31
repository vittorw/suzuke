const jogosForca = new Map();
const jogosQuiz = new Map();
const selecoesTemaPendentes = new Map();
const { expandirForca, expandirQuiz, NOVOS_TEMAS } = require('./bancos_jogos');

const temasForca = {
    tecnologia: [
        "computador", "tecnologia", "programa", "javascript", "whatsapp", "desenvolvedor", "servidor", "internet", "seguranca", "sistema",
        "hardware", "software", "algoritmo", "banco", "dados", "rede", "roteador", "bluetooth", "celular", "smartphone",
        "aplicativo", "codigo", "terminal", "linux", "windows"
    ],
    animais: [
        "elefante", "girafa", "cachorro", "gato", "tigre", "papagaio", "tartaruga", "macaco", "golfinho", "pinguim",
        "leao", "zebra", "urso", "lobo", "raposa", "coelho", "cavalo", "ovelha", "porco", "vaca",
        "galinha", "pato", "aguia", "coruja", "tubarao"
    ],
    esportes: [
        "futebol", "basquete", "volei", "natacao", "tenis", "formula", "surf", "atletismo", "boxe", "beisebol",
        "handball", "rugby", "skate", "ciclismo", "ginastica", "judo", "karate", "taekwondo", "esgrima", "halterofilismo",
        "polo", "hipismo", "patinacao", "escalada", "snowboard"
    ],
    filmes: [
        "matrix", "avatar", "titanic", "gladiador", "starwars", "batman", "jurassic", "inception", "interstellar", "rocky",
        "terminator", "alien", "predator", "godfather", "scarface", "avengers", "spiderman", "superman", "ironman", "thor",
        "capitao", "frozen", "shrek", "toy", "story"
    ],
    paises: [
        "brasil", "portugal", "canada", "japao", "argentina", "franca", "italia", "alemanha", "mexico", "espanha",
        "chile", "colombia", "peru", "uruguai", "paraguai", "bolivia", "venezuela", "cuba", "panama", "estados",
        "unidos", "reino", "unido", "china", "india"
    ],
    ciencia: [
        "biologia", "quimica", "fisica", "astronomia", "planeta", "galaxia", "universo", "gravidade", "energia", "molecula",
        "atomos", "celula", "bacteria", "virus", "vacina", "laboratorio", "experimento", "genetica", "dna", "evolucao",
        "telescopio", "microscopio", "fossis", "radiacao", "oxigenio"
    ],
    musica: [
        "guitarra", "violao", "bateria", "piano", "teclado", "baixo", "saxofone", "trompete", "flauta", "violino",
        "cantor", "cantora", "banda", "orquestra", "melodia", "ritmo", "harmonia", "cancao", "album", "single",
        "concerto", "festival", "rock", "pop", "jazz"
    ],
    mitologia: [
        "zeus", "poseidon", "hades", "hercules", "atena", "afrodite", "apolo", "ares", "hera", "cronos",
        "gaia", "uranos", "thor", "loki", "odin", "valhala", "fenrir", "midgard", "ra", "anubis",
        "osiris", "isis", "horus", "set", "minotauro"
    ],
    historia: [
        "imperio", "reino", "republica", "colonia", "revolucao", "guerra", "paz", "batalha", "tratado", "farao",
        "piramide", "imperador", "rei", "rainha", "princesa", "cavaleiro", "cruzada", "feudalismo", "renascimento", "barroco",
        "iluminismo", "industrial", "independencia", "escravidao", "abolicao"
    ],
    geografia: [
        "continente", "pais", "estado", "cidade", "capital", "montanha", "cordilheira", "rio", "lago", "oceano",
        "mar", "peninsula", "ilha", "arquipelago", "deserto", "floresta", "selva", "vales", "planicie", "plateau",
        "equador", "meridiano", "latitude", "longitude", "hemisferio"
    ]
};

const temasQuiz = {
    tecnologia: [
        { p: "Qual empresa desenvolveu originalmente o Android antes de ser comprado pelo Google em 2005?", op: ["A) Samsung", "B) Microsoft", "C) Android Inc.", "D) Nokia"], r: "c" },
        { p: "Pegadinha: Qual é a porta padrão utilizada para conexões seguras HTTPS?", op: ["A) 80", "B) 8080", "C) 21", "D) 443"], r: "d" },
        { p: "Embora o HTML estruture a web, qual linguagem padronizou a interatividade cliente-servidor nativamente nos navegadores em 1995?", op: ["A) Python", "B) JavaScript", "C) PHP", "D) Ruby"], r: "b" },
        { p: "Qual destas opções NÃO é um sistema operacional baseado no kernel Linux?", op: ["A) Ubuntu", "B) Android", "C) FreeBSD", "D) Debian"], r: "c" },
        { p: "O que a sigla 'HTTP' realmente significa?", op: ["A) Hypertext Transfer Protocol", "B) Hyper Transfer Text Protocol", "C) High Tech Transmission Protocol", "D) Hyperlink Transfer Protocol"], r: "a" },
        { p: "Qual foi o 'inseto' real que causou o primeiro 'bug' de computador registrado por Grace Hopper?", op: ["A) Uma mosca", "B) Uma aranha", "C) Uma formiga", "D) Uma mariposa"], r: "d" },
        { p: "Pegadinha: Se você tenta se conectar ao IP '127.0.0.1', com qual máquina você está se comunicando?", op: ["A) O roteador local", "B) Um servidor DNS", "C) A própria máquina (Localhost)", "D) O provedor de internet"], r: "c" },
        { p: "Quem é historicamente reconhecida como a primeira pessoa programadora de computadores?", op: ["A) Alan Turing", "B) Charles Babbage", "C) Ada Lovelace", "D) Bill Gates"], r: "c" },
        { p: "Qual das opções abaixo é um banco de dados do tipo NoSQL, orientado a documentos?", op: ["A) PostgreSQL", "B) MySQL", "C) MongoDB", "D) Oracle"], r: "c" },
        { p: "O que significa um ataque de 'Zero-day' na área de segurança cibernética?", op: ["A) Um vírus antigo que voltou a circular", "B) Uma vulnerabilidade recém-descoberta e sem correção", "C) Um ataque que dura exatamente 0 dias", "D) Um software de backup de emergência"], r: "b" },
        { p: "Qual foi o primeiro console de videogame doméstico comercialmente lançado da história?", op: ["A) Atari 2600", "B) NES (Nintendinho)", "C) Magnavox Odyssey", "D) Super Nintendo"], r: "c" },
        { p: "Pegadinha: Quantos bytes exatos tem um Kilobyte no sistema binário tradicional (JEDEC)?", op: ["A) 1000", "B) 1024", "C) 1048", "D) 100"], r: "b" },
        { p: "Qual é o nome do motor de JavaScript embutido nativamente no Google Chrome?", op: ["A) SpiderMonkey", "B) Chakra", "C) V8", "D) Blink"], r: "c" },
        { p: "No contexto de banco de dados, o que a sigla 'SQL' significa?", op: ["A) System Query Logic", "B) Structured Query Language", "C) Standard Question Language", "D) Simple Query Link"], r: "b" },
        { p: "Qual linguagem foi criada por James Gosling na Sun Microsystems?", op: ["A) C#", "B) JavaScript", "C) Python", "D) Java"], r: "d" },
        { p: "Qual é o atalho de teclado universal na maioria dos navegadores para forçar o recarregamento de uma página ignorando o cache?", op: ["A) F5", "B) Ctrl + Shift + R", "C) Alt + F4", "D) Ctrl + C"], r: "b" },
        { p: "A tecnologia Blockchain, espinha dorsal das criptomoedas, baseia-se primordialmente em qual conceito?", op: ["A) Computação em Nuvem", "B) Inteligência Artificial", "C) Descentralização de Banco de Dados", "D) Aprendizado de Máquina"], r: "c" },
        { p: "O que significa 'RAM' no contexto de hardware de computadores?", op: ["A) Read Access Memory", "B) Random Access Memory", "C) Run All Memory", "D) Real Allocation Memory"], r: "b" },
        { p: "Pegadinha: Qual a principal diferença técnica entre a Deep Web e a Dark Web?", op: ["A) São sinônimos da mesma coisa", "B) A Dark Web é apenas para hackers", "C) Deep Web é tudo que não é indexado; Dark Web requer softwares específicos (ex: Tor)", "D) A Deep Web é sempre ilegal"], r: "c" },
        { p: "Qual foi a empresa de tecnologia que comprou a plataforma GitHub em 2018?", op: ["A) Google", "B) Amazon", "C) Facebook (Meta)", "D) Microsoft"], r: "d" },
        { p: "O navegador 'Edge' da Microsoft foi reconstruído e hoje é baseado em qual motor de renderização?", op: ["A) Trident", "B) Gecko", "C) Chromium", "D) WebKit"], r: "c" },
        { p: "O que o comando 'git commit' faz no controle de versionamento Git?", op: ["A) Envia o código para o servidor online", "B) Salva as alterações feitas no repositório local", "C) Apaga as linhas de código com erro", "D) Clona um novo repositório"], r: "b" },
        { p: "Qual componente do computador executa os cálculos matemáticos complexos, principalmente para renderizar gráficos 3D?", op: ["A) CPU", "B) SSD", "C) GPU", "D) RAM"], r: "c" },
        { p: "Em que ano o primeiro iPhone foi revelado por Steve Jobs?", op: ["A) 2005", "B) 2007", "C) 2008", "D) 2010"], r: "b" },
        { p: "Qual é o sistema de arquivos padrão adotado pela maioria das distribuições Linux modernas para sua raiz?", op: ["A) NTFS", "B) FAT32", "C) ext4", "D) exFAT"], r: "c" }
    ],
    filmes: [
        { p: "Pegadinha: Qual é o nome verdadeiro do monstro de Frankenstein na obra clássica e nos filmes?", op: ["A) Adam", "B) Boris", "C) O monstro não tem nome (Frankenstein é o criador)", "D) Igor"], r: "c" },
        { p: "Qual diretor é responsável pelos filmes 'A Origem', 'Interestelar' e 'Oppenheimer'?", op: ["A) Steven Spielberg", "B) Christopher Nolan", "C) Quentin Tarantino", "D) James Cameron"], r: "b" },
        { p: "Em 'De Volta Para o Futuro' (1985), quanta energia elétrica a máquina do tempo do DeLorean precisa para viajar no tempo?", op: ["A) 1.21 Gigawatts", "B) 88 Megawatts", "C) 1.50 Terawatts", "D) 100 Kilowatts"], r: "a" },
        { p: "Qual filme detém o recorde de bilheteria mais alta de todos os tempos (sem ajuste de inflação, até 2024)?", op: ["A) Vingadores: Ultimato", "B) Titanic", "C) Avatar", "D) Star Wars: O Despertar da Força"], r: "c" },
        { p: "Pegadinha: Qual a frase exata e famosa de Darth Vader para Luke Skywalker em 'O Império Contra-Ataca'?", op: ["A) Luke, eu sou seu pai.", "B) Não, eu sou seu pai.", "C) Você sabe que eu sou seu pai.", "D) Venha para o lado negro, filho."], r: "b" },
        { p: "Quem é o diretor responsável pela clássica franquia 'O Poderoso Chefão'?", op: ["A) Martin Scorsese", "B) Steven Spielberg", "C) Francis Ford Coppola", "D) Ridley Scott"], r: "c" },
        { p: "Qual o primeiro longa-metragem animado lançado pela Walt Disney Pictures em 1937?", op: ["A) Pinóquio", "B) Fantasia", "C) Branca de Neve e os Sete Anões", "D) Cinderela"], r: "c" },
        { p: "Quantos prêmios do Oscar o ator Leonardo DiCaprio ganhou até 2024?", op: ["A) Nenhum", "B) 1", "C) 2", "D) 3"], r: "b" },
        { p: "No universo de 'Matrix', qual era a verdadeira profissão de Thomas Anderson antes de descobrir a verdade e virar Neo?", op: ["A) Agente de Seguros", "B) Hacker e Programador", "C) Policial", "D) Analista Financeiro"], r: "b" },
        { p: "Em 'Jurassic Park' (1993), de onde os cientistas extraíram o DNA inicial dos dinossauros?", op: ["A) Fósseis ósseos no subsolo", "B) Meteoritos antigos", "C) Sangue de mosquito preservado em âmbar", "D) Restos de plantas pré-históricas"], r: "c" },
        { p: "Na tradição de 'O Senhor dos Anéis', quantos Anéis de Poder foram forjados e dados aos Senhores Anões?", op: ["A) 3", "B) 7", "C) 9", "D) 1"], r: "b" },
        { p: "Qual filme sul-coreano fez história em 2020 ao ser o primeiro filme em língua estrangeira a vencer o Oscar de Melhor Filme?", op: ["A) A Criada", "B) Minari", "C) Parasita", "D) Oldboy"], r: "c" },
        { p: "Qual ator imortalizou a frase 'I'll be back' no filme O Exterminador do Futuro?", op: ["A) Sylvester Stallone", "B) Bruce Willis", "C) Arnold Schwarzenegger", "D) Jean-Claude Van Damme"], r: "c" },
        { p: "Em 'O Iluminado', que adapta o livro de Stephen King, qual é o número do assustador quarto do hotel?", op: ["A) 217", "B) 237", "C) 666", "D) 101"], r: "b" },
        { p: "Qual atriz interpretou a personagem Katniss Everdeen na franquia 'Jogos Vorazes'?", op: ["A) Shailene Woodley", "B) Emma Stone", "C) Jennifer Lawrence", "D) Scarlett Johansson"], r: "c" },
        { p: "Qual foi a primeira produção totalmente feita com animação gráfica (CGI) por computador na história do cinema?", op: ["A) Vida de Inseto", "B) Toy Story", "C) Shrek", "D) O Rei Leão"], r: "b" },
        { p: "Em 'O Mágico de Oz' (1939), qual é a cor original dos sapatos mágicos de Dorothy (no filme, não no livro)?", op: ["A) Prata", "B) Rubi (Vermelhos)", "C) Ouro", "D) Esmeralda (Verdes)"], r: "b" },
        { p: "Qual filme clássico tem a lendária regra: 'A primeira regra do clube é: você não fala sobre o clube'?", op: ["A) O Grande Truque", "B) Clube da Luta", "C) Pulp Fiction", "D) Snatch: Porcos e Diamantes"], r: "b" },
        { p: "No universo de Harry Potter, quais são os três objetos mágicos que compõem as 'Relíquias da Morte'?", op: ["A) A Varinha das Varinhas, a Pedra da Ressurreição e a Capa da Invisibilidade", "B) A Varinha, a Espada de Gryffindor e o Cálice", "C) O Vira-Tempo, a Pedra Filosofal e o Mapa do Maroto", "D) O Anel, o Diário e o Diadema"], r: "a" },
        { p: "Qual destes super-heróis NÃO é originalmente dos quadrinhos da Marvel?", op: ["A) Pantera Negra", "B) Doutor Estranho", "C) Mulher Maravilha", "D) Viúva Negra"], r: "c" },
        { p: "Quem compôs as famosas trilhas sonoras de 'Star Wars', 'Jurassic Park' e 'Indiana Jones'?", op: ["A) Hans Zimmer", "B) Ennio Morricone", "C) Danny Elfman", "D) John Williams"], r: "d" },
        { p: "Pegadinha: Qual animal Bruce Wayne cai em um poço, inspirando o seu medo e eventual alter-ego em 'Batman Begins'?", op: ["A) Aranhas", "B) Morcegos", "C) Ratos", "D) Cobras"], r: "b" },
        { p: "No filme 'Psicose' (1960) de Alfred Hitchcock, qual foi a substância usada para simular sangue na famosa cena do chuveiro?", op: ["A) Tinta vermelha", "B) Xarope de bordo", "C) Calda de chocolate (da marca Bosco)", "D) Suco de tomate"], r: "c" },
        { p: "Qual filme ganhou 11 estatuetas do Oscar em 1998, igualando o recorde de Ben-Hur?", op: ["A) Gladiador", "B) O Senhor dos Anéis: O Retorno do Rei", "C) Titanic", "D) Coração Valente"], r: "c" },
        { p: "No universo Marvel cinematográfico, como se chama o martelo encantado do Thor?", op: ["A) Stormbreaker", "B) Mjölnir", "C) Gungnir", "D) Hofund"], r: "b" }
    ],
    geografia: [
        { p: "Pegadinha: Qual é o maior deserto do mundo em extensão territorial?", op: ["A) Saara", "B) Deserto de Gobi", "C) Antártida", "D) Deserto da Arábia"], r: "c" },
        { p: "Pegadinha: Qual é a capital oficial da Austrália?", op: ["A) Sydney", "B) Melbourne", "C) Camberra", "D) Brisbane"], r: "c" },
        { p: "Qual é o país que possui a maior quantidade de ilhas dentro do seu território no mundo?", op: ["A) Indonésia", "B) Filipinas", "C) Suécia", "D) Canadá"], r: "c" },
        { p: "O Rio Nilo, um dos maiores do mundo, deságua em qual mar?", op: ["A) Mar Vermelho", "B) Mar Mediterrâneo", "C) Mar Negro", "D) Mar Morto"], r: "b" },
        { p: "Qual país sul-americano possui a ilha de Galápagos como parte de seu território?", op: ["A) Peru", "B) Colômbia", "C) Equador", "D) Chile"], r: "c" },
        { p: "Qual destas montanhas é a mais alta situada fora do continente asiático?", op: ["A) Kilimanjaro", "B) Monte Elbrus", "C) Monte McKinley (Denali)", "D) Aconcágua"], r: "d" },
        { p: "Quantos oceanos oficiais (incluindo o recém-reconhecido Antártico) existem no planeta Terra?", op: ["A) 3", "B) 4", "C) 5", "D) 7"], r: "c" },
        { p: "Qual é a capital do Canadá?", op: ["A) Toronto", "B) Ottawa", "C) Vancouver", "D) Montreal"], r: "b" },
        { p: "Pegadinha: Em qual continente fica situado a maior parte do território da Turquia?", op: ["A) Europa", "B) África", "C) Ásia", "D) América"], r: "c" },
        { p: "O Vaticano é o menor país do mundo. Qual é o segundo menor?", op: ["A) Mônaco", "B) San Marino", "C) Nauru", "D) Tuvalu"], r: "a" },
        { p: "A Grande Barreira de Corais fica situada na costa de qual país?", op: ["A) Brasil", "B) África do Sul", "C) Austrália", "D) Nova Zelândia"], r: "c" },
        { p: "Pegadinha: Qual é o maior estado do Brasil em população e o maior em extensão territorial, respectivamente?", op: ["A) São Paulo e Minas Gerais", "B) Rio de Janeiro e Amazonas", "C) São Paulo e Amazonas", "D) Bahia e Mato Grosso"], r: "c" },
        { p: "O Canal do Panamá foi construído para conectar quais dois corpos d'água?", op: ["A) Mar Mediterrâneo e Mar Vermelho", "B) Oceano Atlântico e Oceano Pacífico", "C) Golfo do México e Mar do Caribe", "D) Oceano Índico e Oceano Pacífico"], r: "b" },
        { p: "Qual capital europeia é cortada pelo famoso rio Tâmisa?", op: ["A) Paris", "B) Roma", "C) Berlim", "D) Londres"], r: "d" },
        { p: "Em que país está localizada a região da Patagônia, além da Argentina?", op: ["A) Peru", "B) Bolívia", "C) Chile", "D) Uruguai"], r: "c" },
        { p: "Pegadinha: Qual capital suíça frequentemente confunde as pessoas que acham que é Genebra ou Zurique?", op: ["A) Basileia", "B) Berna", "C) Lucerna", "D) Lausana"], r: "b" },
        { p: "Qual é a linha imaginária que atravessa a Inglaterra e define o fuso horário zero?", op: ["A) Linha do Equador", "B) Trópico de Câncer", "C) Meridiano de Greenwich", "D) Linha Internacional de Data"], r: "c" },
        { p: "Qual país europeu tem o seu formato geográfico frequentemente comparado a uma bota?", op: ["A) Grécia", "B) Espanha", "C) Portugal", "D) Itália"], r: "d" },
        { p: "Em qual continente se encontram as cordilheiras do Himalaia?", op: ["A) Europa", "B) América do Sul", "C) Ásia", "D) África"], r: "c" },
        { p: "Qual estreito separa a Europa da África?", op: ["A) Estreito de Bósforo", "B) Estreito de Gibraltar", "C) Estreito de Magalhães", "D) Estreito de Ormuz"], r: "b" },
        { p: "Quais são os dois países que formam a Península Ibérica?", op: ["A) Itália e Grécia", "B) Espanha e Portugal", "C) França e Alemanha", "D) Suécia e Noruega"], r: "b" },
        { p: "Qual é o único país africano que nunca foi formalmente colonizado por uma potência europeia (junto com a Libéria)?", op: ["A) Egito", "B) Etiópia", "C) Marrocos", "D) Gana"], r: "b" },
        { p: "A cordilheira dos Andes corta principalmente o lado oeste de qual continente?", op: ["A) América do Norte", "B) Ásia", "C) África", "D) América do Sul"], r: "d" },
        { p: "Qual é o nome da floresta tropical que se estende por nove países e abriga a maior biodiversidade do mundo?", op: ["A) Floresta do Congo", "B) Taiga", "C) Floresta Amazônica", "D) Mata Atlântica"], r: "c" },
        { p: "A linha do Equador divide a Terra em quais dois hemisférios?", op: ["A) Oriental e Ocidental", "B) Norte e Sul", "C) Continental e Marítimo", "D) Polar e Equatorial"], r: "b" }
    ],
    historia: [
        { p: "Pegadinha: Quanto tempo realmente durou a chamada 'Guerra dos Cem Anos' entre Inglaterra e França?", op: ["A) Exatos 100 anos", "B) 99 anos", "C) 116 anos", "D) 105 anos"], r: "c" },
        { p: "Em que ano teve início a Segunda Guerra Mundial com a invasão da Polônia?", op: ["A) 1935", "B) 1939", "C) 1941", "D) 1945"], r: "b" },
        { p: "Pegadinha: Embora tenha liderado a Revolução Cubana, onde Che Guevara nasceu de verdade?", op: ["A) Cuba", "B) Bolívia", "C) Argentina", "D) Colômbia"], r: "c" },
        { p: "Na antiga civilização egípcia, quem era o(a) último(a) Faraó ativo do Egito ptolomaico antes da anexação por Roma?", op: ["A) Ramsés II", "B) Tutancâmon", "C) Nefertiti", "D) Cleópatra VII"], r: "d" },
        { p: "Qual evento marcou simbolicamente o início da Revolução Francesa no dia 14 de julho de 1789?", op: ["A) A Batalha de Waterloo", "B) A coroação de Napoleão", "C) A Queda da Bastilha", "D) A execução da Rainha Maria Antonieta"], r: "c" },
        { p: "Qual líder macedônio conquistou a Grécia, o Egito e o Império Persa antes de morrer aos 32 anos?", op: ["A) Júlio César", "B) Alexandre, o Grande", "C) Leônidas", "D) Aníbal"], r: "b" },
        { p: "Durante a Guerra Fria, em que ano a União Soviética lançou o primeiro satélite artificial, o Sputnik 1?", op: ["A) 1957", "B) 1961", "C) 1969", "D) 1945"], r: "a" },
        { p: "Pegadinha: O navegador genovês Cristóvão Colombo é creditado por descobrir as Américas, mas qual grupo explorador chegou lá séculos antes?", op: ["A) Os Romanos", "B) Os Fenícios", "C) Os Vikings", "D) Os Mouros"], r: "c" },
        { p: "Quem foi o líder político indiano famoso pela doutrina da resistência não-violenta (Satyagraha)?", op: ["A) Jawaharlal Nehru", "B) Mahatma Gandhi", "C) Nelson Mandela", "D) Subhas Chandra Bose"], r: "b" },
        { p: "Em que século ocorreu a Revolução Industrial originada na Inglaterra?", op: ["A) Século XVI", "B) Século XVII", "C) Século XVIII", "D) Século XIX"], r: "c" },
        { p: "Como era o verdadeiro nome do herói da inconfidência mineira conhecido como 'Tiradentes'?", op: ["A) Joaquim José da Silva Xavier", "B) Antônio Francisco Lisboa", "C) Pedro Álvares Cabral", "D) Tomás Antônio Gonzaga"], r: "a" },
        { p: "Em que ano o famoso Muro de Berlim foi finalmente derrubado, marcando o início do fim da Guerra Fria?", op: ["A) 1985", "B) 1989", "C) 1991", "D) 1979"], r: "b" },
        { p: "Qual tratado dividiu o recém-descoberto Novo Mundo entre Portugal e Espanha em 1494?", op: ["A) Tratado de Versalhes", "B) Tratado de Tordesilhas", "C) Tratado de Utrecht", "D) Tratado de Madri"], r: "b" },
        { p: "Qual famoso navio supostamente 'inafundável' afundou em sua viagem inaugural em 1912?", op: ["A) Lusitania", "B) Queen Mary", "C) Titanic", "D) Bismarck"], r: "c" },
        { p: "O Império Romano atingiu sua maior extensão territorial sob o governo de qual imperador?", op: ["A) Júlio César", "B) Augusto", "C) Nero", "D) Trajano"], r: "d" },
        { p: "Quem foi o presidente norte-americano que assinou a Proclamação de Emancipação para abolir a escravidão?", op: ["A) George Washington", "B) Thomas Jefferson", "C) Abraham Lincoln", "D) John F. Kennedy"], r: "c" },
        { p: "Quem escreveu o clássico manifesto político 'O Príncipe' durante o Renascimento italiano?", op: ["A) Galileu Galilei", "B) Leonardo da Vinci", "C) Nicolau Maquiavel", "D) Dante Alighieri"], r: "c" },
        { p: "A Primeira Guerra Mundial encerrou-se em 1918. Qual documento oficial selou a paz punindo fortemente a Alemanha em 1919?", op: ["A) Tratado de Paris", "B) Pacto de Varsóvia", "C) Acordo de Yalta", "D) Tratado de Versalhes"], r: "d" },
        { p: "Qual antiga civilização mesoamericana habitou a região de Yucatán, no atual México, e construiu templos piramidais fantásticos como Chichén Itzá?", op: ["A) Os Maias", "B) Os Incas", "C) Os Nazcas", "D) Os Tupi-Guaranis"], r: "a" },
        { p: "Onde surgiu o sistema de governo que conhecemos hoje como 'Democracia' na antiguidade?", op: ["A) Roma Antiga", "B) Esparta", "C) Atenas (Grécia)", "D) Babilônia"], r: "c" },
        { p: "Quem foi a figura heroica francesa canonizada que liderou as tropas da França durante a Guerra dos Cem Anos e foi queimada na fogueira?", op: ["A) Maria Antonieta", "B) Catarina de Médici", "C) Joana d'Arc", "D) Ana Bolena"], r: "c" },
        { p: "A cidade romana de Pompeia foi devastada e enterrada por cinzas em 79 d.C. após a erupção de qual vulcão?", op: ["A) Monte Etna", "B) Monte Vesúvio", "C) Monte Olimpo", "D) Krakatoa"], r: "b" },
        { p: "Quem foi o primeiro Presidente dos Estados Unidos da América?", op: ["A) Thomas Jefferson", "B) Abraham Lincoln", "C) Benjamin Franklin", "D) George Washington"], r: "d" },
        { p: "A queda de qual império em 1453 marca, para muitos historiadores, o fim da Idade Média?", op: ["A) Império Romano do Ocidente", "B) Império Otomano", "C) Império Mongol", "D) Império Bizantino (Romano do Oriente)"], r: "d" },
        { p: "Em que ano a Lei Áurea foi assinada, abolindo formalmente a escravidão no Brasil?", op: ["A) 1500", "B) 1822", "C) 1888", "D) 1889"], r: "c" }
    ],
    matematica: [
        { p: "Pegadinha: Quantos meses do ano têm 28 dias?", op: ["A) Apenas 1", "B) Apenas os anos bissextos", "C) Todos os 12 meses", "D) 6 meses"], r: "c" },
        { p: "Pegadinha: Divida 30 por meio (1/2) e adicione 10. Qual é o resultado?", op: ["A) 25", "B) 70", "C) 40", "D) 15"], r: "b" },
        { p: "Qual é o único número primo que também é um número par?", op: ["A) 1", "B) 2", "C) 4", "D) 0"], r: "b" },
        { p: "Se os lados de um triângulo medem 3, 4 e 5, que tipo de triângulo ele é, de acordo com seus ângulos?", op: ["A) Acutângulo", "B) Obtusângulo", "C) Equilátero", "D) Retângulo"], r: "d" },
        { p: "Pegadinha: O que pesa mais, um quilo de algodão ou um quilo de chumbo?", op: ["A) O chumbo", "B) O algodão", "C) Ambos pesam o mesmo", "D) Depende da umidade"], r: "c" },
        { p: "Qual é a raiz quadrada exata de 144?", op: ["A) 10", "B) 11", "C) 12", "D) 14"], r: "c" },
        { p: "Um fazendeiro tinha 15 ovelhas. Todas, exceto 8, morreram. Quantas ovelhas sobreviveram?", op: ["A) 7", "B) 8", "C) 15", "D) Nenhuma"], r: "b" },
        { p: "Na geometria plana, quanto mede, em graus, a soma dos ângulos internos de um triângulo qualquer?", op: ["A) 180°", "B) 360°", "C) 90°", "D) 270°"], r: "a" },
        { p: "Qual é a fórmula matemática correta para se calcular a área de um círculo?", op: ["A) 2 * π * r", "B) π * r²", "C) base * altura", "D) π * d"], r: "b" },
        { p: "Como se chama um polígono que possui exatamente 8 lados?", op: ["A) Heptágono", "B) Hexágono", "C) Octógono", "D) Eneágono"], r: "c" },
        { p: "Se o preço de uma blusa de 100 reais teve um desconto de 20%, e logo depois um aumento de 20%, quanto ela custa agora?", op: ["A) 100 reais", "B) 96 reais", "C) 120 reais", "D) 104 reais"], r: "b" },
        { p: "Qual é a aproximação de Pi (π) considerando apenas duas casas decimais após a vírgula?", op: ["A) 3.12", "B) 3.14", "C) 3.16", "D) 3.18"], r: "b" },
        { p: "Na sequência de Fibonacci (1, 1, 2, 3, 5, 8...), qual é o próximo número?", op: ["A) 10", "B) 11", "C) 12", "D) 13"], r: "d" },
        { p: "Como é chamado o triângulo que possui todos os três lados de comprimentos diferentes?", op: ["A) Isósceles", "B) Escaleno", "C) Equilátero", "D) Retângulo"], r: "b" },
        { p: "Quanto é 5 elevado à 3ª potência (5 ao cubo)?", op: ["A) 15", "B) 25", "C) 125", "D) 150"], r: "c" },
        { p: "Pegadinha: Uma torneira enche um tanque em 2 horas. Duas torneiras iguais encherão o mesmo tanque em quanto tempo?", op: ["A) 4 horas", "B) 1 hora", "C) 2 horas", "D) 30 minutos"], r: "b" },
        { p: "Qual é o valor em graus de um ângulo reto?", op: ["A) 45°", "B) 90°", "C) 180°", "D) 360°"], r: "b" },
        { p: "Qual é o MMC (Mínimo Múltiplo Comum) entre os números 4 e 6?", op: ["A) 2", "B) 12", "C) 24", "D) 10"], r: "b" },
        { p: "Em algarismos romanos, como se representa o número 50?", op: ["A) C", "B) X", "C) V", "D) L"], r: "d" },
        { p: "Se você estiver participando de uma corrida e ultrapassar a pessoa que está em 2º lugar, em qual posição você ficará?", op: ["A) 1º lugar", "B) 2º lugar", "C) 3º lugar", "D) Último lugar"], r: "b" },
        { p: "Qual é a probabilidade percentual de tirar o lado 'Cara' no lançamento de uma moeda honesta?", op: ["A) 100%", "B) 25%", "C) 50%", "D) 75%"], r: "c" },
        { p: "Se você tem uma pizza e a corta no meio três vezes consecutivas (sempre pelo meio de tudo), com quantos pedaços você fica?", op: ["A) 4", "B) 6", "C) 8", "D) 12"], r: "c" },
        { p: "Como se chama o lado mais longo de um triângulo retângulo, que é oposto ao ângulo reto?", op: ["A) Hipotenusa", "B) Cateto oposto", "C) Cateto adjacente", "D) Base"], r: "a" },
        { p: "Resolva a expressão: 8 + 2 × 4 = ?", op: ["A) 40", "B) 16", "C) 14", "D) 10"], r: "b" },
        { p: "Qual é o décimo número primo da matemática, considerando o 2 como o primeiro?", op: ["A) 29", "B) 19", "C) 23", "D) 31"], r: "a" }
    ],
    animais: [
        { p: "Pegadinha: Qual é a cor da pele de um urso polar, que fica por baixo da sua pelagem espessa e translúcida?", op: ["A) Branca", "B) Rosa", "C) Azul", "D) Preta"], r: "d" },
        { p: "Qual é o único mamífero capaz de voar verdadeiramente, não apenas planar?", op: ["A) Esquilo-voador", "B) Morcego", "C) Lêmure-voador", "D) Petauro-do-açúcar"], r: "b" },
        { p: "O chifre do rinoceronte não é feito de osso. De qual material ele é formado, o mesmo dos nossos cabelos e unhas?", op: ["A) Cálcio puro", "B) Colágeno", "C) Queratina", "D) Cartilagem"], r: "c" },
        { p: "Pegadinha: Apesar do mito de que vivem se esbarrando por serem cegos, os morcegos têm excelente visão. Verdadeiro ou falso?", op: ["A) Sim, não são cegos", "B) Falso, todos são 100% cegos", "C) São surdos, não cegos", "D) Falso, enxergam apenas vultos estáticos"], r: "a" },
        { p: "Quais são os dois únicos mamíferos do mundo conhecidos por botarem ovos?", op: ["A) Canguru e Coala", "B) Ornitorrinco e Equidna", "C) Pinguim e Avestruz", "D) Golfinho e Baleia"], r: "b" },
        { p: "Qual mamífero terrestre é frequentemente citado como o mais rápido do mundo, alcançando mais de 100 km/h?", op: ["A) Leão", "B) Antílope", "C) Guepardo (Chita)", "D) Leopardo"], r: "c" },
        { p: "Quantos corações um polvo comum possui em seu corpo?", op: ["A) 1", "B) 2", "C) 3", "D) 4"], r: "c" },
        { p: "Qual ave é amplamente reconhecida como a maior do mundo atualmente, embora não consiga voar?", op: ["A) Emu", "B) Avestruz", "C) Condor", "D) Albatroz"], r: "b" },
        { p: "Pegadinha: Qual animal é frequentemente chamado de 'rei da selva', mas quase nunca vive em selvas ou florestas densas?", op: ["A) Tigre", "B) Gorila", "C) Leão", "D) Jaguatirica"], r: "c" },
        { p: "De que cor é o suor excretado pelos hipopótamos, que atua como protetor solar natural?", op: ["A) Transparente", "B) Amarelo", "C) Vermelho/Rosado", "D) Verde"], r: "c" },
        { p: "Qual é o animal que detém o título de maior cérebro em proporção ou tamanho bruto, sendo o maior cérebro do planeta?", op: ["A) Elefante Africano", "B) Ser humano", "C) Cachalote", "D) Golfinho"], r: "c" },
        { p: "Os pinguins são aves aquáticas não voadoras, mas são encontrados naturalmente apenas em qual metade do mundo?", op: ["A) Hemisfério Norte", "B) Hemisfério Sul", "C) Nas duas metades igualmente", "D) Apenas no Equador"], r: "b" },
        { p: "O que o camelo armazena em suas corcovas?", op: ["A) Água pura", "B) Gordura", "C) Ossos de reserva", "D) Músculos extra"], r: "b" },
        { p: "Qual animal invertebrado marinho, além do polvo, é conhecido por possuir alta inteligência e dez braços/tentáculos?", op: ["A) Lula", "B) Estrela-do-mar", "C) Ouriço-do-mar", "D) Medusa"], r: "a" },
        { p: "O bicho-preguiça é conhecido por sua lentidão. Em qual ambiente ele passa a maior parte de sua vida?", op: ["A) No solo da floresta", "B) Pendurado nas árvores", "C) Em rios rasos", "D) Em cavernas úmidas"], r: "b" },
        { p: "A teia das aranhas é um material impressionante. De que ela é feita?", op: ["A) Carboidratos", "B) Fios de algodão biológico", "C) Proteína (Seda)", "D) Queratina"], r: "c" },
        { p: "Qual é o nome científico do animal de estimação que chamamos de 'Cachorro'?", op: ["A) Felis catus", "B) Canis lupus familiaris", "C) Panthera leo", "D) Ursus arctos"], r: "b" },
        { p: "Qual inseto transmite o parasita causador da malária?", op: ["A) Mosquito Aedes aegypti", "B) Mosca Tsé-tsé", "C) Mosquito Anopheles", "D) Carrapato Estrela"], r: "c" },
        { p: "Qual é a principal diferença visual entre jacarés e crocodilos em relação ao formato de suas cabeças?", op: ["A) Jacarés têm focinho largo em U; Crocodilos focinho fino em V.", "B) Crocodilos não têm dentes expostos.", "C) Jacarés são menores e não possuem cauda escamosa.", "D) Não existe diferença visual."], r: "a" },
        { p: "Que pequeno anfíbio venenoso da Amazônia possui cores brilhantes (aposematismo) para afastar predadores?", op: ["A) Sapo-cururu", "B) Sapo-boi", "C) Rã-dardo-venenoso", "D) Salamandra"], r: "c" },
        { p: "O ornitorrinco possui um esporão venenoso nas patas traseiras. Isso é exclusividade dos:", op: ["A) Machos", "B) Fêmeas", "C) Ambos", "D) Apenas nos filhotes"], r: "a" },
        { p: "Qual desses animais possui a mordida com mais força já registrada entre os animais vivos terrestres ou anfíbios?", op: ["A) Tubarão-branco", "B) Leão", "C) Hipopótamo", "D) Crocodilo-de-água-salgada"], r: "d" },
        { p: "Qual animal produz um som ultrassônico, imperceptível aos humanos, para usar na ecolocalização?", op: ["A) Coruja", "B) Gato", "C) Morcego", "D) Rato"], r: "c" },
        { p: "As zebras são brancas com listras pretas ou pretas com listras brancas (segundo embriologistas)?", op: ["A) Brancas com listras pretas", "B) Pretas com listras brancas", "C) Não possuem cor definida até o nascimento", "D) São marrons na verdade"], r: "b" },
        { p: "Onde ficam as papilas gustativas de uma borboleta, para que ela sinta o sabor do néctar?", op: ["A) Na língua", "B) Nas antenas", "C) Nas asas", "D) Nas patas"], r: "d" }
    ],
    esportes: [
        { p: "Pegadinha: Qual foi a única seleção de futebol a participar de todas as edições da Copa do Mundo?", op: ["A) Alemanha", "B) Itália", "C) Brasil", "D) Argentina"], r: "c" },
        { p: "Em qual esporte de inverno as equipes usam vassouras para varrer o gelo a fim de guiar uma pedra de granito?", op: ["A) Hóquei no gelo", "B) Bobsled", "C) Patinação artística", "D) Curling"], r: "d" },
        { p: "Pegadinha: No tênis de campo tradicional, qual é a pontuação que vem imediatamente após o 30 em um game?", op: ["A) 40", "B) 45", "C) 50", "D) Vantagem"], r: "a" },
        { p: "No basquetebol de quadra cheia da NBA, quantos jogadores TITULARES de ambas as equipes estão em quadra somados?", op: ["A) 5", "B) 10", "C) 12", "D) 14"], r: "b" },
        { p: "Quantos minutos tem um round padrão em uma luta olímpica masculina de Boxe?", op: ["A) 1 minuto", "B) 2 minutos", "C) 3 minutos", "D) 5 minutos"], r: "c" },
        { p: "Qual país venceu a primeiríssima Copa do Mundo da FIFA em 1930?", op: ["A) Brasil", "B) Itália", "C) Uruguai", "D) Argentina"], r: "c" },
        { p: "Qual esporte usa bolas pequenas e tacos, e a expressão 'Hole in One' é considerada o feito mais difícil?", op: ["A) Bilhar", "B) Críquete", "C) Beisebol", "D) Golfe"], r: "d" },
        { p: "Em que cidade as Olimpíadas modernas de 1896 ocorreram?", op: ["A) Paris", "B) Londres", "C) Atenas", "D) Roma"], r: "c" },
        { p: "Qual atleta detém o recorde mundial dos 100 metros rasos com a incrível marca de 9,58 segundos?", op: ["A) Yohan Blake", "B) Usain Bolt", "C) Tyson Gay", "D) Carl Lewis"], r: "b" },
        { p: "Na natação, qual estilo é tradicionalmente considerado o mais rápido e é sempre usado no nado livre?", op: ["A) Borboleta", "B) Costas", "C) Peito", "D) Crawl"], r: "d" },
        { p: "No boliche, quando o jogador derruba todos os pinos na primeira tentativa, como a jogada é chamada?", op: ["A) Spare", "B) Strike", "C) Split", "D) Turkey"], r: "b" },
        { p: "No futebol americano (NFL), quantos pontos vale um 'Touchdown' (sem contar o ponto extra)?", op: ["A) 3 pontos", "B) 5 pontos", "C) 6 pontos", "D) 7 pontos"], r: "c" },
        { p: "Qual é o único Grand Slam de Tênis que é jogado numa quadra de saibro (terra batida)?", op: ["A) Wimbledon", "B) Australian Open", "C) US Open", "D) Roland Garros"], r: "d" },
        { p: "Qual é o esporte em que você usaria os equipamentos: máscara, jaqueta protetora e sabre/florete?", op: ["A) Esgrima", "B) Kendô", "C) Polo Aquático", "D) Hipismo"], r: "a" },
        { p: "Quantos anéis compõem o símbolo dos Jogos Olímpicos e o que eles representam?", op: ["A) 4 anéis; estações do ano", "B) 5 anéis; os continentes habitados", "C) 6 anéis; oceanos", "D) 5 anéis; as modalidades originais"], r: "b" },
        { p: "Qual piloto de Fórmula 1 detém o recorde de 7 títulos mundiais empatado com Michael Schumacher (até 2024)?", op: ["A) Ayrton Senna", "B) Alain Prost", "C) Max Verstappen", "D) Lewis Hamilton"], r: "d" },
        { p: "Qual é a modalidade de ginástica que usa equipamentos como a fita, a bola, o arco e as maças, praticada em sua maioria por mulheres?", op: ["A) Ginástica Artística", "B) Ginástica Rítmica", "C) Ginástica Acrobática", "D) Ginástica de Trampolim"], r: "b" },
        { p: "O termo 'Ippon' representa a vitória absoluta de forma direta e limpa em qual esporte marcial?", op: ["A) Karatê", "B) Taekwondo", "C) Judô", "D) Muay Thai"], r: "c" },
        { p: "Qual seleção feminina de futebol conquistou mais títulos da Copa do Mundo Feminina da FIFA?", op: ["A) Alemanha", "B) Estados Unidos", "C) Brasil", "D) Japão"], r: "b" },
        { p: "Quantas bases um jogador precisa tocar no beisebol para completar um 'Home Run' e marcar?", op: ["A) Nenhuma", "B) Três (1ª, 2ª, 3ª)", "C) Quatro (incluindo o Home Plate)", "D) Duas"], r: "c" },
        { p: "Qual país é amplamente considerado a nação criadora do 'Rugby'?", op: ["A) Estados Unidos", "B) Nova Zelândia", "C) Austrália", "D) Inglaterra"], r: "d" },
        { p: "Em que esporte se usa um pequeno objeto chamado 'Peteca' ou 'Birdie', que atinge altas velocidades?", op: ["A) Tênis de mesa", "B) Squash", "C) Badminton", "D) Vôlei"], r: "c" },
        { p: "Na ginástica artística, qual aparelho é disputado exclusivamente por homens nas Olimpíadas?", op: ["A) Trave de Equilíbrio", "B) Solo", "C) Argolas", "D) Salto"], r: "c" },
        { p: "Quem é conhecido no basquetebol da NBA como 'Air Jordan' e usava frequentemente a camisa 23?", op: ["A) LeBron James", "B) Kobe Bryant", "C) Magic Johnson", "D) Michael Jordan"], r: "d" },
        { p: "O esporte 'Pelota Basca' ou 'Jai Alai' é notório por ser extremamente rápido. Com qual instrumento eles lançam a bola?", op: ["A) Uma raquete de madeira", "B) Uma cesta curva amarrada à mão", "C) Os próprios pés", "D) Um taco metálico"], r: "b" }
    ],
    ciencia: [
        { p: "Pegadinha: Qual é o estado físico do vidro em janelas sob temperatura ambiente?", op: ["A) Líquido super-resfriado", "B) Gás condensado", "C) Plasma", "D) Sólido amorfo"], r: "d" },
        { p: "Pegadinha: Qual é o elemento químico MAIS abundante em todo o Universo?", op: ["A) Oxigênio", "B) Carbono", "C) Hidrogênio", "D) Nitrogênio"], r: "c" },
        { p: "No Sistema Solar, qual planeta tem seu eixo tão inclinado que gira praticamente 'deitado'?", op: ["A) Júpiter", "B) Urano", "C) Vênus", "D) Marte"], r: "b" },
        { p: "Qual biólogo é famoso pela publicação 'A Origem das Espécies' e sua teoria da evolução por seleção natural?", op: ["A) Gregor Mendel", "B) Louis Pasteur", "C) Charles Darwin", "D) Jean-Baptiste Lamarck"], r: "c" },
        { p: "Na tabela periódica, qual é o único metal que é líquido na temperatura ambiente (20ºC a 25ºC)?", op: ["A) Ouro", "B) Sódio", "C) Chumbo", "D) Mercúrio"], r: "d" },
        { p: "Pegadinha: Um tomate do ponto de vista botânico é classificado cientificamente como:", op: ["A) Verdura", "B) Fruta (Fruto)", "C) Legume", "D) Raiz"], r: "b" },
        { p: "O que a Teoria da Relatividade Geral de Albert Einstein descreve fundamentalmente?", op: ["A) A mecânica quântica e átomos", "B) A atração eletromagnética", "C) A gravidade como uma curvatura no espaço-tempo", "D) A velocidade da luz na água"], r: "c" },
        { p: "O que diz a famosa primeira lei de Newton (Princípio da Inércia)?", op: ["A) Toda ação gera uma reação oposta", "B) Força é igual à massa vezes a aceleração", "C) A energia não se cria, apenas se transforma", "D) Um corpo em repouso tende a permanecer em repouso a menos que forçado a mudar"], r: "d" },
        { p: "Qual é a menor unidade básica formadora de todos os elementos químicos?", op: ["A) Molécula", "B) Célula", "C) Átomo", "D) Próton"], r: "c" },
        { p: "A luz viaja mais rápido no vácuo, mas onde o SOM viaja mais rápido?", op: ["A) No ar frio", "B) No vácuo do espaço", "C) Na água (meios líquidos)", "D) O som tem a mesma velocidade em tudo"], r: "c" },
        { p: "Plutão foi rebaixado de 'planeta' para 'planeta anão' no ano de 2006. Verdadeiro ou falso?", op: ["A) Falso, ele ainda é o 9º planeta.", "B) Falso, ele foi considerado apenas um asteroide.", "C) Verdadeiro, decisão da União Astronômica Internacional.", "D) Verdadeiro, ele colidiu com outra lua."], r: "c" },
        { p: "Qual gás de efeito estufa é o principal responsável pelo aquecimento global de origem antropogênica (humana)?", op: ["A) Hélio", "B) Dióxido de Carbono (CO2)", "C) Oxigênio", "D) Argônio"], r: "b" },
        { p: "Como se chama o processo biológico pelo qual as plantas convertem a luz solar, água e gás carbônico em oxigênio e energia?", op: ["A) Fotossíntese", "B) Respiração celular", "C) Fermentação lática", "D) Catálise"], r: "a" },
        { p: "Qual cientista mulher ganhou DOIS prêmios Nobel (em Física e em Química) pelas suas pesquisas com radioatividade?", op: ["A) Rosalind Franklin", "B) Ada Lovelace", "C) Marie Curie", "D) Lise Meitner"], r: "c" },
        { p: "A molécula de DNA tem a forma física clássica de:", op: ["A) Uma linha reta", "B) Um anel perfeitamente redondo", "C) Um triângulo interligado", "D) Uma dupla hélice (escada torcida)"], r: "d" },
        { p: "O coração humano é dividido em quantas câmaras ou cavidades separadas?", op: ["A) 2", "B) 3", "C) 4", "D) 5"], r: "c" },
        { p: "Na escala pH, um valor que marca exatamente 7 é considerado o quê?", op: ["A) Fortemente Ácido", "B) Fortemente Alcalino (Básico)", "C) Neutro", "D) Radioativo"], r: "c" },
        { p: "Qual organela é conhecida por ser a 'fábrica de energia' (produção de ATP) da célula animal?", op: ["A) Complexo de Golgi", "B) Mitocôndria", "C) Lisossomo", "D) Núcleo"], r: "b" },
        { p: "Qual é o nome do satélite natural que orbita a Terra de forma síncrona?", op: ["A) Fobos", "B) Europa", "C) Titã", "D) Lua"], r: "d" },
        { p: "Em física térmica, o Zero Absoluto equivale a qual temperatura teórica onde a agitação molecular para?", op: ["A) 0 graus Celsius", "B) -100 graus Celsius", "C) -273,15 graus Celsius", "D) 0 graus Fahrenheit"], r: "c" },
        { p: "Como os cientistas chamam as regiões do espaço das quais nada, nem mesmo a luz, pode escapar devido à gravidade extrema?", op: ["A) Estrelas de Nêutrons", "B) Supernovas", "C) Anãs Brancas", "D) Buracos Negros"], r: "d" },
        { p: "Qual é o cromossomo que, nos mamíferos, determina se o sexo genético do embrião será tipicamente masculino?", op: ["A) Cromossomo X", "B) Cromossomo Y", "C) Cromossomo 21", "D) Autossomo"], r: "b" },
        { p: "Alexander Fleming descobriu acidentalmente qual substância fundamental em 1928 através do fungo Penicillium?", op: ["A) A Vacina contra pólio", "B) O primeiro antibiótico (Penicilina)", "C) A insulina", "D) O anestésico"], r: "b" },
        { p: "A Via Láctea, a nossa galáxia, tem qual formato astronômico reconhecido?", op: ["A) Elíptica", "B) Espiral Barrada", "C) Irregular", "D) Cilíndrica"], r: "b" },
        { p: "Qual camada da atmosfera terrestre contém a vital 'Camada de Ozônio' (O3), que nos protege dos raios UV?", op: ["A) Troposfera", "B) Mesosfera", "C) Termosfera", "D) Estratosfera"], r: "d" }
    ],
    musica: [
        { p: "Pegadinha: Quantas teclas pretas e brancas juntas existem em um piano acústico clássico de 8 oitavas (padrão)?", op: ["A) 64", "B) 72", "C) 88", "D) 100"], r: "c" },
        { p: "Qual artista é mundialmente conhecido pelo lançamento do álbum e a icônica coreografia do clipe 'Thriller'?", op: ["A) Prince", "B) Elvis Presley", "C) James Brown", "D) Michael Jackson"], r: "d" },
        { p: "Pegadinha: Qual o verdadeiro nome de nascimento do vocalista Freddie Mercury da banda Queen?", op: ["A) Frederic Bulsara", "B) Farrokh Bulsara", "C) Alfred Mercury", "D) Brian May"], r: "b" },
        { p: "Qual famosa banda de rock gravou o álbum cujos sucessos incluem 'Stairway to Heaven' e 'Kashmir'?", op: ["A) The Rolling Stones", "B) Led Zeppelin", "C) Black Sabbath", "D) Pink Floyd"], r: "b" },
        { p: "Na música, qual o nome do termo italiano usado para definir o canto unicamente vocal sem acompanhamento de instrumentos?", op: ["A) Acappella", "B) Allegro", "C) Falsetto", "D) Vibrato"], r: "a" },
        { p: "Quem é a artista feminina, cantora, que mais coleciona estatuetas do Grammy na história (com mais de 30 prêmios)?", op: ["A) Adele", "B) Taylor Swift", "C) Aretha Franklin", "D) Beyoncé"], r: "d" },
        { p: "Quantas cordas tem um baixo elétrico tradicional padrão?", op: ["A) 6", "B) 5", "C) 4", "D) 7"], r: "c" },
        { p: "Qual compositor erudito começou a perder a audição aos 26 anos e continuou a compor obras-primas como a 'Nona Sinfonia' completamente surdo?", op: ["A) Wolfgang Amadeus Mozart", "B) Johann Sebastian Bach", "C) Ludwig van Beethoven", "D) Antonio Vivaldi"], r: "c" },
        { p: "Qual banda britânica famosa imortalizou os rostos de John, Paul, George e Ringo na capa de 'Abbey Road'?", op: ["A) The Who", "B) The Beatles", "C) The Rolling Stones", "D) The Kinks"], r: "b" },
        { p: "De qual região remonta a origem e popularização original do pequeno instrumento de 4 cordas chamado 'Ukulele'?", op: ["A) Caribe", "B) Indonésia", "C) Havaí", "D) Brasil"], r: "c" },
        { p: "Qual foi o famoso movimento cultural, rítmico e poético surgido nos morros e subúrbios do RJ e que originou o estilo musical mais tocado no Carnaval?", op: ["A) Forró", "B) Choro", "C) Samba", "D) Tropicália"], r: "c" },
        { p: "Pegadinha: Qual artista a seguir NÃO fez parte da banda de grunge dos anos 90, Nirvana?", op: ["A) Kurt Cobain", "B) Dave Grohl", "C) Krist Novoselic", "D) Eddie Vedder"], r: "d" },
        { p: "Qual cantor jamaicano popularizou globalmente o Reggae nos anos 70 com a banda The Wailers?", op: ["A) Jimmy Cliff", "B) Bob Marley", "C) Shaggy", "D) Peter Tosh"], r: "b" },
        { p: "O festival de música mais lendário da história ocorreu em 1969, numa fazenda de Nova Iorque. Qual o seu nome?", op: ["A) Glastonbury", "B) Coachella", "C) Woodstock", "D) Rock in Rio"], r: "c" },
        { p: "Qual instrumento musical de sopro (feito de metal) é famoso pelos solos profundos e suaves no estilo de música Jazz?", op: ["A) Flauta Transversal", "B) Oboé", "C) Saxofone", "D) Violino"], r: "c" },
        { p: "Como é chamado o sinal colocado no início da pauta musical que serve para determinar o nome das notas e sua altura (como as famosas Sol e Fá)?", op: ["A) Clave", "B) Compasso", "C) Armadura", "D) Sustenido"], r: "a" },
        { p: "Quem é o famoso compositor clássico brasileiro responsável pelas 'Bachianas Brasileiras' e que une folclore à música erudita?", op: ["A) Tom Jobim", "B) Heitor Villa-Lobos", "C) Carlos Gomes", "D) Pixinguinha"], r: "b" },
        { p: "Qual banda irlandesa gravou o icônico álbum 'The Joshua Tree' e tem Bono como vocalista?", op: ["A) The Cranberries", "B) Coldplay", "C) U2", "D) Oasis"], r: "c" },
        { p: "Qual gênero de música de rua e cultura (incluindo dança, grafite e MCing) se originou no Bronx, Nova York, na década de 70?", op: ["A) Disco", "B) R&B", "C) Hip Hop", "D) Techno"], r: "c" },
        { p: "O grupo BLACKPINK, que conquistou fama global estrondosa com clipes bilionários de K-Pop, possui quantas integrantes oficiais?", op: ["A) 3", "B) 4", "C) 5", "D) 7"], r: "b" },
        { p: "Pegadinha: Na teoria musical convencional ocidental (escala diatônica), existem quantas notas base naturais em uma oitava antes de repetir?", op: ["A) 5", "B) 7", "C) 12", "D) 8"], r: "b" },
        { p: "A Bossa Nova é um grande cartão de visitas brasileiro no exterior. Qual famosa música cantada por João Gilberto projetou o estilo globalmente?", op: ["A) Aquarela do Brasil", "B) Garota de Ipanema", "C) Águas de Março", "D) O Canto da Cidade"], r: "b" },
        { p: "Qual foi o DJ sueco famoso, criador dos hits de música eletrônica 'Wake Me Up' e 'Levels', que infelizmente faleceu jovem?", op: ["A) David Guetta", "B) Calvin Harris", "C) Avicii", "D) Tiësto"], r: "c" },
        { p: "Em orquestras eruditas, qual pessoa usa uma batuta e é a grande líder da orquestra, responsável por marcar o tempo?", op: ["A) O Spalla", "B) O Compositor", "C) O Concertino", "D) O Maestro (Regente)"], r: "d" },
        { p: "A música clássica de terror, sempre tocada para simular dráculas ou fantasmas tocando órgão de tubos, 'Tocata e Fuga em Ré Menor', foi feita por quem?", op: ["A) J.S. Bach", "B) Vivaldi", "C) Chopin", "D) Liszt"], r: "a" }
    ],
    mitologia: [
        { p: "Pegadinha: Na mitologia grega, Hades (deus do submundo) é considerado o mal supremo/diabo da religião antiga?", op: ["A) Sim, ele punia todas as almas sem exceção.", "B) Sim, ele odiava os humanos e os deuses.", "C) Não, ele era um deus severo, mas apenas o governador imparcial do pós-vida.", "D) Não, ele era o deus do amor e do fogo."], r: "c" },
        { p: "Qual herói valente da mitologia grega se aventurou no labirinto de Creta e derrotou o Minotauro para salvar jovens atenienses?", op: ["A) Perseu", "B) Hércules", "C) Teseu", "D) Jasão"], r: "c" },
        { p: "Quem é a contraparte romana direta da grande deusa grega da sabedoria e estratégia, Atena?", op: ["A) Diana", "B) Juno", "C) Vênus", "D) Minerva"], r: "d" },
        { p: "Na mitologia nórdica, quem é o responsável fatal por matar o grandioso Thor durante a batalha do fim do mundo (Ragnarök)?", op: ["A) O lobo gigante Fenrir", "B) A Serpente de Midgard (Jörmungandr)", "C) O deus trapaceiro Loki", "D) O gigante de fogo Surtr"], r: "b" },
        { p: "A majestosa criatura equina alada Pégaso, de acordo com o mito grego, emergiu do corpo/pescoço cortado de qual monstro?", op: ["A) A Hidra", "B) A Quimera", "C) A Medusa", "D) A Esfinge"], r: "c" },
        { p: "Na antiga mitologia egípcia, quem pesava os corações humanos contra uma pluma para julgar a vida da pessoa após a morte?", op: ["A) Rá", "B) Anúbis", "C) Set", "D) Hórus"], r: "b" },
        { p: "O deus supremo do trovão grego é Zeus. Como se chamava seu equivalente supremo nórdico, o deus caolho que usava um tapa-olho e governava Asgard?", op: ["A) Tyr", "B) Freyr", "C) Odin", "D) Balder"], r: "c" },
        { p: "Hércules (ou Héracles) cumpriu punições conhecidas como 'Os Doze Trabalhos'. Qual foi o seu PRIMEIRO trabalho?", op: ["A) Limpar os estábulos", "B) Matar a Hidra de Lerna", "C) Estrangular o Leão de Nemeia", "D) Capturar Cérbero"], r: "c" },
        { p: "Qual deusa grega teria nascido de forma milagrosa da espuma do mar e é reconhecida pelos romanos como Vênus?", op: ["A) Afrodite", "B) Hera", "C) Deméter", "D) Perséfone"], r: "a" },
        { p: "Qual a punição eterna de Sísifo imposta por Zeus por enganar a morte na mitologia grega?", op: ["A) Ter o fígado devorado por uma águia todos os dias.", "B) Segurar os céus em suas costas.", "C) Rolar uma rocha enorme montanha acima, apenas para ela cair tudo de novo.", "D) Ficar amarrado sob uma maçã caindo e sem poder pegá-la."], r: "c" },
        { p: "No mito da fundação de Roma, quem foram os dois irmãos gêmeos alimentados por uma loba?", op: ["A) Cástor e Pólux", "B) Rômulo e Remo", "C) Aquiles e Pátroclo", "D) Hércules e Iolaos"], r: "b" },
        { p: "Pegadinha: O deus Apolo costuma ser popularmente chamado de Deus do Sol na Grécia, mas qual titã era, originalmente, a personificação literal do Sol?", op: ["A) Cronos", "B) Hiperião", "C) Hélio", "D) Oceano"], r: "c" },
        { p: "De acordo com os mitos do Egito Antigo, quem foi o deus que foi esquartejado por seu irmão e depois reconstruído por sua esposa Ísis?", op: ["A) Osíris", "B) Hórus", "C) Rá", "D) Thoth"], r: "a" },
        { p: "Qual criatura japonesa do folclore é tipicamente vista como uma raposa mística que ganha caudas extras à medida que envelhece (até chegar a nove)?", op: ["A) Kappa", "B) Kitsune", "C) Tengu", "D) Oni"], r: "b" },
        { p: "Quem construiu um par de asas feitas de penas e cera para si mesmo e seu filho Ícaro escaparem?", op: ["A) Minos", "B) Pigmalião", "C) Dédalo", "D) Prometeu"], r: "c" },
        { p: "A Árvore do Mundo da mitologia nórdica abriga todos os 9 reinos da existência nos seus galhos e raízes. Qual o nome dela?", op: ["A) Valhala", "B) Yggdrasil", "C) Asgard", "D) Bifröst"], r: "b" },
        { p: "Quem roubou secretamente o fogo dos deuses do Monte Olimpo para entregá-lo e aquecer a humanidade mortal?", op: ["A) Hermes", "B) Hefesto", "C) Dionísio", "D) Prometeu"], r: "d" },
        { p: "Na Odisseia, qual é a criatura de um olho só, filho de Poseidon, que foi cegado pelo herói Odisseu (Ulisses)?", op: ["A) Ciclope (Polifemo)", "B) Hecatônquiro", "C) Argos Panoptes", "D) Centauro"], r: "a" },
        { p: "A espada mítica do Rei Arthur das lendas celtas/britânicas, extraída (ou recebida da Dama do Lago), atende por qual nome?", op: ["A) Durendal", "B) Excalibur", "C) Joyeuse", "D) Tyrfing"], r: "b" },
        { p: "Pandora foi a primeira mulher mortal criada no mito grego. Quando abriu a ânfora (ou caixa) soltando os males do mundo, o que foi a única coisa que sobrou lá no fundo?", op: ["A) A Morte", "B) O Amor", "C) A Esperança", "D) O Perdão"], r: "c" },
        { p: "No épico sumério (um dos mitos mais antigos do mundo), qual rei de Uruk sai numa jornada lendária atrás da imortalidade após perder o amigo Enkidu?", op: ["A) Hamurabi", "B) Nabucodonosor", "C) Gilgamesh", "D) Sargão"], r: "c" },
        { p: "Quem é o deus ferreiro e metalúrgico na mitologia grega, filho de Zeus e Hera, famoso por ter nascido coxo e jogado do Monte Olimpo?", op: ["A) Ares", "B) Hermes", "C) Apolo", "D) Hefesto"], r: "d" },
        { p: "Na Índia, no panteão hindu, quem é a divindade famosa conhecida como 'O Destruidor' que dança na roda do fogo, mas essencialmente prepara o mundo para ser renovado?", op: ["A) Vishnu", "B) Shiva", "C) Brahma", "D) Ganesha"], r: "b" },
        { p: "Na mitologia asteca (mesoamericana), qual divindade era venerada como o deus criador retratado como uma 'Serpente Emplumada'?", op: ["A) Tlaloc", "B) Huitzilopochtli", "C) Quetzalcoatl", "D) Tezcatlipoca"], r: "c" },
        { p: "O deus protetor dos viajantes, comerciantes, ladrões e diplomata dos deuses, possuía sandálias aladas. Qual o nome grego e a contraparte romana desse deus veloz?", op: ["A) Hermes e Mercúrio", "B) Apolo e Febo", "C) Ares e Marte", "D) Hefesto e Vulcano"], r: "a" }
    ]
};

// Expande os bancos sem alterar o fluxo das partidas.
for (const [tema, seeds] of Object.entries(NOVOS_TEMAS)) {
    if (!temasForca[tema] && ['matematica','literatura','gastronomia','jogos','corpo_humano'].includes(tema)) temasForca[tema] = seeds.map(x => x[0]);
    if (!temasQuiz[tema]) temasQuiz[tema] = seeds;
}
expandirForca(temasForca);
expandirQuiz(temasQuiz);

function obterTop3ComMencoes(pontosObj, nomesObj = {}) {
    const arr = Object.entries(pontosObj).map(([num, pts]) => ({ 
        num, 
        pts, 
        nome: nomesObj[num] || num 
    }));
    arr.sort((a, b) => b.pts - a.pts);
    const top3 = arr.slice(0, 3);
    
    if (top3.length === 0) {
        return { texto: "Nenhum ponto registrado.", mencoes: [] };
    }
    
    let txt = "";
    const medalhas = ["🥇", "🥈", "🥉"];
    const mencoes = [];

    top3.forEach((item, index) => {
        txt += `${medalhas[index]} *${item.nome}* — *${item.pts}* ponto(s)\n`;
        mencoes.push(`${item.num}@s.whatsapp.net`);
    });

    return { texto: txt, mencoes };
}

async function proximaPalavraForca(sock, from, jogo) {
    if (!jogosForca.has(from)) return;

    if (jogo.palavraAtualIndex >= jogo.palavras.length) {
        jogosForca.delete(from);
        await sock.sendMessage(from, { text: `🏁 *Fim do Jogo da Forca!* Todas as 5 palavras do tema *${jogo.tema.toUpperCase()}* foram concluídas!\n\n⏳ Aguarde 15 segundos para o placar final...` });
        
        setTimeout(async () => {
            const resultado = obterTop3ComMencoes(jogo.pontos, jogo.nomes);
            await sock.sendMessage(from, { 
                text: `🏆 *Placar Final da Forca (Top 3):*\n\n` + resultado.texto, 
                mentions: resultado.mencoes 
            });
        }, 15000);
        return;
    }

    const palavraSorteada = jogo.palavras[jogo.palavraAtualIndex];
    jogo.palavra = palavraSorteada;
    jogo.oculta = "_ ".repeat(palavraSorteada.length).trim();
    jogo.erros = 0;
    jogo.letrasUsadas = [];

    const textoForca = `🎮 *FORCA - PALAVRA ${jogo.palavraAtualIndex + 1}/${jogo.palavras.length}*\n\n` +
        `📌 Tema: *${jogo.tema.toUpperCase()}*\n` +
        `📌 Palavra: \`${jogo.oculta}\`\n\n` +
        `👉 Envie letras (ex: \`a\`) sem marcar. Para chutar a palavra inteira, *marque/responda* a esta mensagem do bot!`;
    
    const sentMsg = await sock.sendMessage(from, { text: textoForca });
    if (sentMsg?.key?.id) jogo.msgIdBot = sentMsg.key.id;
}

async function finalizarPalavraAtualForca(sock, from, jogo, mensagemFim, quotedMsg = null) {
    if (quotedMsg) await sock.sendMessage(from, { text: mensagemFim }, { quoted: quotedMsg });
    else await sock.sendMessage(from, { text: mensagemFim });
    jogo.palavraAtualIndex++;

    if (jogo.palavraAtualIndex < jogo.palavras.length) {
        await sock.sendMessage(from, { text: `⏳ Próxima palavra da Forca em 20 segundos...` });
        setTimeout(() => {
            proximaPalavraForca(sock, from, jogo);
        }, 20000);
    } else {
        jogosForca.delete(from);
        await sock.sendMessage(from, { text: `🏁 *Fim do Jogo da Forca!* Todas as 5 palavras do tema *${jogo.tema.toUpperCase()}* foram concluídas!\n\n⏳ Aguarde 15 segundos para o placar final...` });
        
        setTimeout(async () => {
            const resultado = obterTop3ComMencoes(jogo.pontos, jogo.nomes);
            await sock.sendMessage(from, { 
                text: `🏆 *Placar Final da Forca (Top 3):*\n\n` + resultado.texto, 
                mentions: resultado.mencoes 
            });
        }, 15000);
    }
}

async function proximaPerguntaQuiz(sock, from, quiz) {
    if (!jogosQuiz.has(from)) return;

    if (quiz.perguntaAtual >= quiz.perguntas.length) {
        jogosQuiz.delete(from);
        await sock.sendMessage(from, { text: `🏁 *Fim do Quiz!* Todas as 10 perguntas do tema *${quiz.tema.toUpperCase()}* foram concluídas!` });
        return;
    }

    quiz.respondidosNestaRodada = new Set();
    const qSorteada = quiz.perguntas[quiz.perguntaAtual];
    quiz.respostaCorretaIndice = ['a', 'b', 'c', 'd'].indexOf(qSorteada.r.toLowerCase());

    const sentMsg = await sock.sendMessage(from, {
        poll: {
            name: `❓ [Pergunta ${quiz.perguntaAtual + 1}/10] - ${qSorteada.p}`,
            values: qSorteada.op,
            selectableCount: 1
        }
    });

    quiz.sentMsg = sentMsg;

    quiz.timeoutId = setTimeout(async () => {
        if (!jogosQuiz.has(from)) return;
        const qAtualObj = jogosQuiz.get(from);
        if (!qAtualObj || qAtualObj.perguntaAtual !== quiz.perguntaAtual) return;

        let textoOpcaoCompleta = qSorteada.op.find(o => o.toLowerCase().startsWith(qSorteada.r.toLowerCase())) || qSorteada.r.toUpperCase();
        await sock.sendMessage(from, { text: `📢 *Tempo esgotado para a Pergunta ${quiz.perguntaAtual + 1}!* \n\n✅ A resposta correta era: *${textoOpcaoCompleta}*` });

        quiz.perguntaAtual++;
        if (quiz.perguntaAtual < quiz.perguntas.length) {
            await sock.sendMessage(from, { text: `⏳ Próxima pergunta do Quiz em 20 segundos...` });
            setTimeout(() => {
                proximaPerguntaQuiz(sock, from, quiz);
            }, 20000);
        } else {
            jogosQuiz.delete(from);
            await sock.sendMessage(from, { text: `🏁 *Fim do Quiz!* Todas as 10 perguntas do tema *${quiz.tema.toUpperCase()}* foram concluídas!` });
        }
    }, 25000); 
}

async function checarVotosQuiz(sock, updates) {
    for (const item of updates) {
        const key = item.key;
        const update = item.update;
        if (!update || !update.pollUpdates) continue;

        for (const from of jogosQuiz.keys()) {
            const quiz = jogosQuiz.get(from);
            if (!quiz || !quiz.sentMsg) continue;

            if (key.id === quiz.sentMsg.key.id) {
                for (const pollUpdate of update.pollUpdates) {
                    const selectedOptions = pollUpdate.vote?.selectedOptions;
                    if (selectedOptions && selectedOptions.length > 0) {
                        const opcaoEscolhidaIndex = Number(selectedOptions[0]);
                        const voterJid = pollUpdate.voterJid || key.participant || key.remoteJid || from;
                        const numeroPuroRemetente = voterJid.replace(/[^0-9]/g, '');
                        const nomeUsuario = numeroPuroRemetente;

                        if (!quiz.nomes) quiz.nomes = {};
                        if (!quiz.nomes[numeroPuroRemetente]) quiz.nomes[numeroPuroRemetente] = numeroPuroRemetente;

                        if (opcaoEscolhidaIndex === quiz.respostaCorretaIndice) {
                            if (!quiz.respondidosNestaRodada) quiz.respondidosNestaRodada = new Set();
                            if (!quiz.respondidosNestaRodada.has(numeroPuroRemetente)) {
                                quiz.respondidosNestaRodada.add(numeroPuroRemetente);
                                quiz.pontos[numeroPuroRemetente] = (quiz.pontos[numeroPuroRemetente] || 0) + 1;
                                
                                if (quiz.timeoutId) clearTimeout(quiz.timeoutId);
                                
                                await sock.sendMessage(from, { 
                                    text: `✅ *${quiz.nomes[numeroPuroRemetente]}* acertou a enquete! (+1 ponto) 🏆`, 
                                    mentions: [`${numeroPuroRemetente}@s.whatsapp.net`] 
                                });

                                quiz.perguntaAtual++;
                                if (quiz.perguntaAtual < quiz.perguntas.length) {
                                    await sock.sendMessage(from, { text: `⏳ Próxima pergunta do Quiz em 20 segundos...` });
                                    setTimeout(() => {
                                        proximaPerguntaQuiz(sock, from, quiz);
                                    }, 20000);
                                } else {
                                    jogosQuiz.delete(from);
                                    await sock.sendMessage(from, { text: `🏁 *Fim do Quiz!* Todas as 10 perguntas do tema *${quiz.tema.toUpperCase()}* foram concluídas!` });
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

async function checarRespostasJogos2(sock, from, isGroup, textoMinusculo, numeroPuroRemetente, jid, isDono, isAdm, msg, soadmAtivo = false) {
    if (!isGroup) return false;

    // A escolha do tema e feita respondendo diretamente a mensagem de temas enviada pelo bot.
    const contextoTema = msg.message?.extendedTextMessage?.contextInfo;
    const idTemaCitado = contextoTema?.stanzaId;
    const selecaoPendente = selecoesTemaPendentes.get(from);
    if (selecaoPendente && idTemaCitado && idTemaCitado === selecaoPendente.msgId) {
        // V99_SOADM_PENDING_THEME_GUARD: nao inicia jogo novo durante !soadm.
        if (soadmAtivo && !isDono && !isAdm) return true;
        const temaEscolhido = String(textoMinusculo || '').trim().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9_ ]/g, '').trim().replace(/ +/g, '_');
        const temasValidos = selecaoPendente.tipo === 'forca' ? temasForca : temasQuiz;
        if (!temasValidos[temaEscolhido]) {
            await sock.sendMessage(from, { text: '⚠️ Tema não reconhecido. Responda à mensagem de temas do bot com um dos nomes exatamente como aparece na lista.' }, { quoted: msg });
            return true;
        }
        selecoesTemaPendentes.delete(from);
        return await executarComandoJogos2(sock, from, selecaoPendente.tipo, [temaEscolhido], true, jid, numeroPuroRemetente, msg.pushName || numeroPuroRemetente, msg, isDono, isAdm);
    }

    const nomeUsuario = msg.pushName || numeroPuroRemetente;

    if (jogosForca.has(from)) {
        const jogo = jogosForca.get(from);
        if (!jogo.nomes) jogo.nomes = {};
        jogo.nomes[numeroPuroRemetente] = nomeUsuario;

        if (textoMinusculo === '!resposta') {
            if (!isDono && !isAdm) {
                await sock.sendMessage(from, { text: `⚠️ Apenas administradores podem revelar a resposta da Forca!` }, { quoted: msg });
                return true;
            }
            await finalizarPalavraAtualForca(sock, from, jogo, `📢 O administrador revelou a palavra da Forca!\n\nA palavra secreta era: *${jogo.palavra.toUpperCase()}* ❌`, msg);
            return true;
        }

        if (textoMinusculo.length === 1 && /^[a-zà-ú]$/.test(textoMinusculo)) {
            const letra = textoMinusculo;
            if (jogo.letrasUsadas.includes(letra)) {
                await sock.sendMessage(from, { text: `⚠️ A letra *'${letra.toUpperCase()}'* já foi tentada antes, *${nomeUsuario}*!`, mentions: [jid] }, { quoted: msg });
                return true;
            }
            jogo.letrasUsadas.push(letra);

            if (jogo.palavra.toLowerCase().includes(letra)) {
                let novaOculta = "";
                for (let i = 0; i < jogo.palavra.length; i++) {
                    if (jogo.palavra[i].toLowerCase() === letra || jogo.oculta.replace(/\s/g, '')[i] !== '_') {
                        novaOculta += jogo.palavra[i] + " ";
                    } else {
                        novaOculta += "_ ";
                    }
                }
                jogo.oculta = novaOculta.trim();
                jogo.pontos[numeroPuroRemetente] = (jogo.pontos[numeroPuroRemetente] || 0) + 1;
                
                if (!jogo.oculta.includes('_')) {
                    jogo.pontos[numeroPuroRemetente] = (jogo.pontos[numeroPuroRemetente] || 0) + 5;
                    await finalizarPalavraAtualForca(sock, from, jogo, `🎉 Parabéns *${nomeUsuario}*! Você acertou a palavra secreta completa: *${jogo.palavra}*! (+5 pts) 🏆`, msg);
                    return true;
                } else {
                    const msgRes = await sock.sendMessage(from, { text: `✅ Boa, *${nomeUsuario}*! A letra *'${letra.toUpperCase()}'* está na palavra (+1 pt).\n\n📌 Tema: *${jogo.tema.toUpperCase()}*\n📌 Palavra: \`${jogo.oculta}\`\n🔤 Letras usadas: ${jogo.letrasUsadas.join(', ')}`, mentions: [jid] }, { quoted: msg });
                    if (msgRes?.key?.id) jogo.msgIdBot = msgRes.key.id;
                    return true;
                }
            } else {
                jogo.erros++;
                if (jogo.erros >= 6) {
                    await finalizarPalavraAtualForca(sock, from, jogo, `💀 Fim desta palavra, *${nomeUsuario}*! A forca completou-se (6/6 erros). A palavra secreta era: *${jogo.palavra}* ❌`, msg);
                    return true;
                } else {
                    const msgRes = await sock.sendMessage(from, { text: `❌ Errou, *${nomeUsuario}*! A letra *'${letra.toUpperCase()}'* não está na palavra.\n\n⚠️ Erros: *${jogo.erros}/6*\n📌 Tema: *${jogo.tema.toUpperCase()}*\n📌 Palavra: \`${jogo.oculta}\`\n🔤 Letras usadas: ${jogo.letrasUsadas.join(', ')}`, mentions: [jid] }, { quoted: msg });
                    if (msgRes?.key?.id) jogo.msgIdBot = msgRes.key.id;
                    return true;
                }
            }
        }

        if (textoMinusculo.length > 1 && !textoMinusculo.startsWith('!')) {
            const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
            const quotedId = contextInfo?.stanzaId;

            if (!quotedId || quotedId !== jogo.msgIdBot) {
                return false; 
            }

            if (textoMinusculo === jogo.palavra.toLowerCase()) {
                jogo.pontos[numeroPuroRemetente] = (jogo.pontos[numeroPuroRemetente] || 0) + 10;
                await finalizarPalavraAtualForca(sock, from, jogo, `🎉 Incrível *${nomeUsuario}*! Você acertou o chute da palavra completa: *${jogo.palavra}*! (+10 pts) 🏆`, msg);
                return true;
            } else {
                jogo.erros++;
                if (jogo.erros >= 6) {
                    await finalizarPalavraAtualForca(sock, from, jogo, `💀 Fim desta palavra, *${nomeUsuario}*! Chute errado ("${textoMinusculo}"). A forca completou-se (6/6 erros). A palavra era: *${jogo.palavra}* ❌`, msg);
                    return true;
                } else {
                    const msgRes = await sock.sendMessage(from, { text: `❌ Chute errado da palavra, *${nomeUsuario}*! ("${textoMinusculo}").\n\n⚠️ Erros: *${jogo.erros}/6*\n📌 Palavra: \`${jogo.oculta}\``, mentions: [jid] }, { quoted: msg });
                    if (msgRes?.key?.id) jogo.msgIdBot = msgRes.key.id;
                    return true;
                }
            }
        }
    }

    return false;
}

async function executarComandoJogos2(sock, from, comando, args, isGroup, jid, numeroPuroRemetente, nomeUsuario, msg, isDono, isAdm) {
    if (!isGroup) return false;

    if (comando === 'forca') {
        if (haJogoAtivoNoGrupo(from)) { await sock.sendMessage(from, { text: `⚠️ Já existe um jogo em andamento neste grupo. Use *!encerrar* para encerrar todos os jogos antes de iniciar outro.` }); return true; }
        if (!isDono && !isAdm) {
            await sock.sendMessage(from, { text: `⚠️ Apenas administradores podem iniciar o jogo da Forca!` });
            return true;
        }

        if (jogosForca.has(from)) {
            await sock.sendMessage(from, { text: `⚠️ Já existe um jogo da Forca ativo neste grupo! Use \`!encerrar\` se quiser encerrar o jogo.` });
            return true;
        }

        const temaArg = args[0]?.toLowerCase();
        let temaEscolhido = temaArg;
        if (!temaEscolhido || !temasForca[temaEscolhido]) {
            const resposta = await sock.sendMessage(from, { text: '📚 *Escolha o tema da Forca*\n\n• ' + Object.keys(temasForca).join('\n• ') + '\n\n↩️ Responda a esta mensagem com o nome de um tema para iniciar. A Forca não começa sem uma escolha.' }, { quoted: msg });
            if (resposta?.key?.id) selecoesTemaPendentes.set(from, { tipo: 'forca', msgId: resposta.key.id });
            return true;
        }

        const listaPalavras = [...temasForca[temaEscolhido]].sort(() => Math.random() - 0.5).slice(0, 5);
        
        const jogoObj = {
            tema: temaEscolhido,
            palavras: listaPalavras,
            palavraAtualIndex: 0,
            palavra: "",
            oculta: "",
            erros: 0,
            letrasUsadas: [],
            pontos: {},
            nomes: {},
            msgIdBot: ""
        };

        jogosForca.set(from, jogoObj);
        await sock.sendMessage(from, { text: `🎮 *JOGO DA FORCA - TEMA: ${temaEscolhido.toUpperCase()} INICIADO!* 🎮\n\n_As palavras serão enviadas em sequência._` });
        
        setTimeout(() => {
            proximaPalavraForca(sock, from, jogoObj);
        }, 2000);

        return true;
    }

    if (comando === 'quiz') {
        if (haJogoAtivoNoGrupo(from)) { await sock.sendMessage(from, { text: `⚠️ Já existe um jogo em andamento neste grupo. Use *!encerrar* para encerrar todos os jogos antes de iniciar outro.` }); return true; }
        if (!isDono && !isAdm) {
            await sock.sendMessage(from, { text: `⚠️ Apenas administradores podem iniciar o Quiz!` });
            return true;
        }

        if (jogosQuiz.has(from)) {
            await sock.sendMessage(from, { text: `⚠️ Já existe um Quiz ativo neste grupo! Use \`!encerrar\` se quiser encerrar o jogo.` });
            return true;
        }

        const temaArg = args[0]?.toLowerCase();
        if (!temaArg || !temasQuiz[temaArg]) {
            const resposta = await sock.sendMessage(from, { text: '📚 *Escolha o tema do Quiz*\n\n• ' + Object.keys(temasQuiz).join('\n• ') + '\n\n↩️ Responda a esta mensagem com o nome de um tema para iniciar o Quiz.' }, { quoted: msg });
            if (resposta?.key?.id) selecoesTemaPendentes.set(from, { tipo: 'quiz', msgId: resposta.key.id });
            return true;
        }

        const listaPerguntas = [...temasQuiz[temaArg]].sort(() => Math.random() - 0.5).slice(0, 10);
        const quizObj = {
            tema: temaArg,
            perguntas: listaPerguntas,
            perguntaAtual: 0,
            respostaCorretaIndice: 0,
            timeoutId: null,
            pontos: {},
            nomes: {},
            respondidosNestaRodada: new Set(),
            sentMsg: null
        };

        jogosQuiz.set(from, quizObj);
        await sock.sendMessage(from, { text: `❓ *QUIZ - TEMA: ${temaArg.toUpperCase()} INICIADO!* ❓\n\n_As enquetes serão enviadas em sequência._` });
        
        setTimeout(() => {
            proximaPerguntaQuiz(sock, from, quizObj);
        }, 2000);

        return true;
    }

    return false;
}

async function encerrarTodosJogosNoGrupo(sock, grupoId) {
    let encerrou = false;
    const forca = jogosForca.get(grupoId);
    if (forca) { if (forca.timeoutId) clearTimeout(forca.timeoutId); jogosForca.delete(grupoId); encerrou = true; }
    const quiz = jogosQuiz.get(grupoId);
    if (quiz) { if (quiz.timeoutId) clearTimeout(quiz.timeoutId); jogosQuiz.delete(grupoId); encerrou = true; }
    return encerrou;
}
function haJogoAtivoNoGrupo(grupoId) { return jogosForca.has(grupoId) || jogosQuiz.has(grupoId); }
module.exports = { checarRespostasJogos2, executarComandoJogos2, checarVotosQuiz, encerrarTodosJogosNoGrupo, haJogoAtivoNoGrupo };

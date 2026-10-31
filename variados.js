let bombaJogo = null;
const fs = require('fs');
const bombasJogo = new Map();
const rankMoedas = new Map();
const charadasAtivas = new Map();
const quemSouEuAtivos = new Map();

const sessoesCharadas = new Map();
const sessoesQuemSouEu = new Map();
const euNuncaAtivos = new Map();
const DADOS_JOGOS_PATH = './dados_jogos.json';

try {
    if (fs.existsSync(DADOS_JOGOS_PATH)) {
        const salvo = JSON.parse(fs.readFileSync(DADOS_JOGOS_PATH, 'utf8'));
        for (const [chave, dados] of Object.entries(salvo.rankMoedas || {})) rankMoedas.set(chave, dados);
    }
} catch (e) {}

function salvarDadosJogos() {
    try {
        fs.writeFileSync(DADOS_JOGOS_PATH, JSON.stringify({ rankMoedas: Object.fromEntries(rankMoedas) }, null, 2));
    } catch (e) {}
}

const BANCO_EU_NUNCA = [
    "Eu nunca mandei áudio cantando uma música romântica achando que estava no privado e mandei no grupo da família.",
    "Eu nunca gastei todo o meu dinheiro com skin de jogo ou créditos e depois fiquei sem poder comprar lanche.",
    "Eu nunca fingi que a ligação caiu só para desligar na cara de alguém chato.",
    "Eu nunca passei mais de 3 horas stalkeando o perfil de uma pessoa que eu nem conheço direito no Instagram.",
    "Eu nunca caí da cadeira de escritório tentando pegar algo que estava longe.",
    "Eu nunca inventei uma desculpa mirabolante dizendo que tinha alergia a um legume só para não comer no almoço de família.",
    "Eu nunca mandei um textão enorme desabafando e a pessoa respondeu apenas com 'ata' ou 'ok'.",
    "Eu nunca tentei consertar um eletrônico dando um tapinha nele e acabei estragando de vez.",
    "Eu nunca esqueci o micro-ondas ligado com pipoca ou comida dentro por tanto tempo que a casa inteira ficou fedendo a queimado.",
    "Eu nunca gastei horas da madrugada inteira assistindo a vídeos bizarros de limpeza de tapete ou organização de armário.",
    "Eu nunca cliquei em um link maluco de sorteio achando que ia ganhar um iPhone novo.",
    "Eu nunca tentei copiar a coreografia de uma dança do TikTok na frente do espelho e paguei um mico terrível.",
    "Eu nunca comecei a rir descontroladamente em pleno velório ou momento sério só porque lembrei de um meme.",
    "Eu nunca mandei um print da conversa errada justamente para a pessoa de quem eu estava falando mal.",
    "Eu nunca fiquei procurando o meu óculos ou celular por 20 minutos com o objeto na minha própria mão.",
    "Eu nunca maratonei uma temporada inteira de uma série em um único final de semana e arrependi no domingo à noite.",
    "Eu nunca fingi que estava entendendo nada em uma discussão só para a pessoa parar de falar.",
    "Eu nunca tentei abrir um pacote de salgadinho com a boca, rasguei errado e espalhei tudo no chão.",
    "Eu nunca fui dormir com fone de ouvido bluetooth e acordei procurando uma das caixinhas perdida no meio dos lençóis.",
    "Eu nunca respondi 'você também' para o entregador que disse 'boa viagem' com a comida.",
    "Eu nunca mandei mensagem para o chefe chamando ele de 'amor' ou 'mãe' sem querer.",
    "Eu nunca tentei fingir que entendia de futebol só para participar de uma roda de conversa.",
    "Eu nunca passei vergonha tentando pagar com aproximação e a maquininha recusou o cartão três vezes.",
    "Eu nunca tentei fingir que estava dormindo no ônibus para não ceder o lugar para alguém.",
    "Eu nunca comecei a chorar copiosamente por causa de um comercial de margarina ou de ração de cachorro.",
    "Eu nunca tentei comer um doce escondido na dispensa e derrubei o pote inteiro no chão.",
    "Eu nunca gastei mais dinheiro comprando lanche pelo app de entrega do que o valor do próprio prato por causa das taxas.",
    "Eu nunca peguei uma roupa emprestada de alguém e esqueci de devolver por mais de seis meses.",
    "Eu nunca tentei tirar uma selfie perfeita na rua e paguei o maior mico sendo pego por um desconhecido.",
    "Eu nunca criei uma senha super complexa para um site e esqueci no mesmo minuto.",
    "Eu nunca passei a noite inteira pesquisando sintomas no Google e me diagnostiquei com uma doença rara.",
    "Eu nunca mandei uma indireta fortíssima nos stories do Instagram para uma pessoa específica que nem viu.",
    "Eu nunca tentei passar a linha na agulha de primeira e demorei meia hora fazendo careta.",
    "Eu nunca fingi estar mexendo no celular só para evitar cumprimentar um conhecido na rua.",
    "Eu nunca comi a borda da pizza de outra pessoa achando que ninguém ia perceber.",
    "Eu nunca tentei abrir uma embalagem a vácuo com os dentes e quase quebrei um incisivo.",
    "Eu nunca fiquei preso em um provador de loja porque o zíper da roupa travou de vez.",
    "Eu nunca comecei a cantar uma música super alta no carro e percebi que a janela estava totalmente aberta no semáforo.",
    "Eu nunca tentei colar em uma prova e o professor olhou bem na hora para mim.",
    "Eu nunca esqueci o aniversário de namoro ou de casamento e tentei inventar um presente de última hora.",
    "Eu nunca passei vergonha tentando pronunciar o nome de um prato chique em um restaurante.",
    "Eu nunca tentei usar o GPS a pé e consegui me perder na mesma rua que eu já conhecia.",
    "Eu nunca joguei um jogo de terror à noite e fiquei com medo de ir ao banheiro no escuro.",
    "Eu nunca comprei um livro caro só porque a capa era bonita e nunca li nem a primeira página.",
    "Eu nunca tentei cortar meu próprio cabelo na quarentena e o resultado foi um desastre total.",
    "Eu nunca tentei fazer pose de durão e acabei tropeçando em um tapete raso.",
    "Eu nunca esqueci o nome da pessoa na hora de apresentá-la para um amigo meu.",
    "Eu nunca mandei um print de uma conversa antiga achando que era atual.",
    "Eu nunca tentei abrir a porta da casa de outra pessoa pensando que era a minha.",
    "Eu nunca tentei comer pipoca no cinema com a sala totalmente silenciosa e fiz um barulho absurdo.",
    "Eu nunca fiquei horas escolhendo um filme na Netflix para no fim dormir antes de acabar os créditos iniciais.",
    "Eu nunca tentei pegar um ônibus correndo, caí no meio da rua e fingi que não foi nada.",
    "Eu nunca gastei um dinheirão em uma academia chique e fui apenas três vezes no mês.",
    "Eu nunca mandei um e-mail profissional importante e esqueci de anexar o arquivo principal.",
    "Eu nunca tentei fazer uma surpresa para alguém e estraguei tudo contando antes da hora.",
    "Eu nunca tentei consertar o vaso sanitário sozinho e acabei alagando o banheiro inteiro.",
    "Eu nunca fui ao mercado com fome e voltei com o carrinho cheio de besteiras que nem comi.",
    "Eu nunca tentei imitar um chef de TV cortando cebola e acabei chorando litros.",
    "Eu nunca tentei pular a catraca da roleta ou passar por baixo e fiquei preso.",
    "Eu nunca tentei fazer uma piada inteligente em um grupo e todo mundo ficou em silêncio me olhando.",
    "Eu nunca fiquei com alguém e depois fingi que não conhecia a pessoa quando encontrei de novo.",
    "Eu nunca traí a confiança de alguém e escondi isso por medo das consequências.",
    "Eu nunca fiquei com duas pessoas que se conheciam sem uma saber da outra.",
    "Eu nunca mandei mensagem para ex escondido enquanto estava ficando sério com outra pessoa.",
    "Eu nunca senti ciúmes de alguém com quem nem tinha nada.",
    "Eu nunca stalkeei tanto alguém que descobri coisas que a pessoa nunca me contou.",
    "Eu nunca inventei uma história para esconder com quem eu realmente estava.",
    "Eu nunca beijei alguém só para provocar ciúmes em outra pessoa.",
    "Eu nunca fui a segunda opção de alguém e aceitei mesmo sabendo disso.",
    "Eu nunca mantive alguém por perto só porque gostava da atenção que recebia.",
    "Eu nunca dei esperança para alguém sabendo que não queria nada sério.",
    "Eu nunca fiquei com alguém comprometido sabendo muito bem da situação.",
    "Eu nunca apaguei uma conversa inteira para ninguém descobrir o que aconteceu.",
    "Eu nunca menti dizendo que estava solteiro(a) para conseguir ficar com alguém.",
    "Eu nunca tive uma queda por alguém que era proibido para mim.",
    "Eu nunca me arrependi de ter ficado com alguém poucos minutos depois.",
    "Eu nunca voltei para alguém que jurava que nunca mais aceitaria de volta.",
    "Eu nunca fui descoberto(a) em uma mentira por causa de um print.",
    "Eu nunca falei mal de alguém e depois agi como se fosse a melhor amizade do mundo.",
    "Eu nunca fiquei com alguém só para esquecer outra pessoa.",
    "Eu nunca tive uma conversa comprometedora enquanto alguém estava olhando minha tela.",
    "Eu nunca senti atração por alguém do grupo e escondi isso de todo mundo.",
    "Eu nunca fiz ciúmes de propósito para testar se alguém gostava de mim.",
    "Eu nunca me envolvi com alguém sabendo que provavelmente daria problema.",
    "Eu nunca aceitei um encontro só por interesse ou para ganhar alguma coisa.",
    "Eu nunca fingi não ver uma mensagem porque queria fazer a pessoa sofrer um pouco.",
    "Eu nunca fui pego(a) mentindo sobre onde estava ou com quem estava.",
    "Eu nunca contei um segredo de alguém durante uma discussão para machucar a pessoa.",
    "Eu nunca me arrependi de ter mandado uma mensagem ousada de madrugada.",
    "Eu nunca tive um crush em alguém que namorava e torci para o relacionamento acabar.",
    "Eu nunca fiquei com alguém e depois descobri que essa pessoa era ex de um amigo.",
    "Eu nunca mantive uma conversa escondida porque sabia que ela causaria uma briga.",
    "Eu nunca voltei a falar com alguém só porque estava carente.",
    "Eu nunca me fiz de difícil mesmo querendo muito que a pessoa insistisse.",
    "Eu nunca espalhei um boato e depois tentei fingir que não tinha nada a ver com isso.",
    "Eu nunca tive vontade de expor alguém depois de uma decepção amorosa.",
    "Eu nunca fiquei com alguém e depois neguei tudo para os meus amigos.",
    "Eu nunca comparei uma pessoa atual com meu/minha ex em segredo.",
    "Eu nunca escondi que ainda sentia algo por alguém do passado."
];

const BANCO_CHARADAS = [
    { pergunta: "O que é, o que é? Tem dentes afiados, mas não morde ninguém; corta o caminho, mas não vai a lugar nenhum?", resposta: "serrote" },
    { pergunta: "O que é, o que é? Nasce no mar, vive na terra, mas se voltar para o mar, morre instantaneamente?", resposta: "sal" },
    { pergunta: "O que é, o que é? Quanto mais se tira de dentro dele, maior ele fica?", resposta: "buraco" },
    { pergunta: "O que é, o que é? Tem quatro pernas, mas não consegue andar sozinho; serve para descansar, mas nunca dorme?", resposta: "cadeira" },
    { pergunta: "O que é, o que é? Corre a casa inteira e depois vai dormir num cantinho?", resposta: "vassoura" },
    { pergunta: "O que é, o que é? Tem olhos que não veem, tem boca que não fala, mas alimenta o mundo inteiro?", resposta: "batata" },
    { pergunta: "O que é, o que é? Cai em pé, corre deitado e depois evapora?", resposta: "chuva" },
    { pergunta: "O que é, o que é? O que é que quanto mais se limpa, mais sujo fica?", resposta: "pano de chão" },
    { pergunta: "O que é, o que é? Tem cabeça e dente, mas não é bicho nem gente?", resposta: "alho" },
    { pergunta: "O que é, o que é? O que passa diante do sol sem fazer sombra?", resposta: "vento" },
    { pergunta: "O que é, o que é? O que tem capa, mas não é herói; tem folhas, mas não é planta?", resposta: "livro" },
    { pergunta: "O que é, o que é? O que se quebra simplesmente ao ser pronunciado?", resposta: "silêncio" },
    { pergunta: "O que é, o que é? Que tem pescoço, mas não tem cabeça?", resposta: "garrafa" },
    { pergunta: "O que é, o que é? Que anda com os pés na cabeça?", resposta: "piolho" },
    { pergunta: "O que é, o que é? Que é meu, mas os outros usam mais do que eu?", resposta: "nome" },
    { pergunta: "O que é, o que é? Que quanto mais velho, mais novo fica?", resposta: "fotografia" },
    { pergunta: "O que é, o que é? Que tem chaves mas não abre nenhuma porta?", resposta: "piano" },
    { pergunta: "O que é, o que é? Que tem escamas mas não é peixe, tem coroa mas não é rei?", resposta: "abacaxi" },
    { pergunta: "O que é, o que é? Que dá muitas voltas, mas fica sempre no mesmo lugar?", resposta: "relógio" },
    { pergunta: "O que é, o que é? Que tem olhos de gato, rabo de gato, pé de gato, mia como gato, mas não é gato?", resposta: "gata" },
    { pergunta: "O que é, o que é? Que quanto mais se divide, mais se multiplica?", resposta: "ideia" },
    { pergunta: "O que é, o que é? Que tem asas mas não voa, tem dentes mas não morde?", resposta: "engrenagem" },
    { pergunta: "O que é, o que é? Que tem pernas mas não anda, tem braços mas não abraça?", resposta: "cadeira" },
    { pergunta: "O que é, o que é? Que tem fogo por dentro e fumaça por fora?", resposta: "chaminé" },
    { pergunta: "O que é, o que é? Que quanto mais se puxa, mais curto fica?", resposta: "cigarro" },
    { pergunta: "O que é, o que é? Que tem boca mas não come, tem leito mas não dorme?", resposta: "rio" },
    { pergunta: "O que é, o que é? Que entra na água e não se molha?", resposta: "sombra" },
    { pergunta: "O que é, o que é? Que tem uma ponta só, mas escreve em folhas inteiras?", resposta: "lápis" },
    { pergunta: "O que é, o que é? Que tem cinco dedos, mas não tem carne nem unha?", resposta: "luva" },
    { pergunta: "O que é, o que é? Que quanto mais se espreme, mais doce fica?", resposta: "laranja" },
    { pergunta: "O que é, o que é? Que sobe e desce sem nunca sair do lugar?", resposta: "escada" },
    { pergunta: "O que é, o que é? Que tem tampa, mas não é panela; tem folha, mas não é árvore?", resposta: "livro" },
    { pergunta: "O que é, o que é? Que tem pernas de pau e anda sobre o mar?", resposta: "navio" },
    { pergunta: "O que é, o que é? Que tem muitas letras, mas não sabe ler nenhuma?", resposta: "teclado" },
    { pergunta: "O que é, o que é? Que brilha no escuro, mas não é estrela?", resposta: "vaga-lume" },
    { pergunta: "O que é, o que é? Que é redondo como a lua, branco como o algodão, se abre no vento e cai no chão?", resposta: "paraquedas" },
    { pergunta: "O que é, o que é? Que tem um olho só, mas não consegue enxergar?", resposta: "agulha" },
    { pergunta: "O que é, o que é? Que tem cauda, mas não é animal; voa alto, mas não é pássaro?", resposta: "pipa" },
    { pergunta: "O que é, o que é? Que tem linha, mas não é costureira; tem ponta, mas não é espada?", resposta: "anzol" },
    { pergunta: "O que é, o que é? Que quanto mais se esquenta, mais frio nos deixa?", resposta: "geladeira" },
    { pergunta: "O que é, o que é? Tem leito mas não dorme, corre mas não tem pernas?", resposta: "rio" },
    { pergunta: "O que é, o que é? Tem capa de chuva mas não se molha nunca?", resposta: "tartaruga" },
    { pergunta: "O que é, o que é? Que entra fechado na água e sai aberto na terra?", resposta: "guarda-chuva" },
    { pergunta: "O que é, o que é? Que quanto mais se olha, menos se vê?", resposta: "escuridão" },
    { pergunta: "O que é, o que é? Que tem dentes e não morde, penteia e não tem cabelo?", resposta: "pente" },
    { pergunta: "O que é, o que é? Que tem unhas mas não tem dedos, vive na parede e segura quadros?", resposta: "prego" },
    { pergunta: "O que é, o que é? Que tem uma boca só, mas fala em centenas de línguas?", resposta: "radio" },
    { pergunta: "O que é, o que é? Que tem pontas afiadas, corta tecidos, mas nunca veste nada?", resposta: "tesoura" },
    { pergunta: "O que é, o que é? Que sobe carregando carga e desce vazio?", resposta: "elevador" },
    { pergunta: "O que é, o que é? Que tem anel mas não tem dedo, tem porta mas não tem casa?", resposta: "cebola" }
];

const BANCO_QUEM_SOU_EU = [
    { nome: "sherlock holmes", pistas: ["Resido na Rua Baker, 221B", "Tenho um parceiro médico chamado Watson", "Uso cachimbo e chapéu de caçador de cervos"] },
    { nome: "albert einstein", pistas: ["Formulei a teoria da relatividade", "Minha equação mais famosa envolve energia e massa", "Fui laureado com o Nobel de Física em 1921"] },
    { nome: "leonardo da vinci", pistas: ["Pintei a obra mais famosa do Louvre", "Desenhei esboços pioneiros de máquinas voadoras", "Fui um gênio polímata do Renascimento italiano"] },
    { nome: "napoleao bonaparte", pistas: ["Fui imperador dos franceses", "Fui exilado na ilha de Santa Helena", "Geralmente sou retratado com a mão dentro do colete"] },
    { nome: "cleopatra", pistas: ["Fui a última rainha do Egito ptolemaico", "Mantive alianças políticas com Júlio César e Marco Antônio", "Dizem que usei uma serpente para meu fim"] },
    { nome: "william shakespeare", pistas: ["Escrevi tragédias imortais como Hamlet e Macbeth", "Nasci em Stratford-upon-Avon", "Sou considerado o maior dramaturgo da língua inglesa"] },
    { nome: "isaac newton", pistas: ["Fui atingido por uma maçã segundo a lenda", "Formulei as três leis do movimento", "Desenvolvi o cálculo matemático independentemente"] },
    { nome: "marie curie", pistas: ["Recebi dois prêmios Nobel em áreas científicas distintas", "Descobri os elementos rádio e polônio", "Fui pioneira nos estudos sobre a radioatividade"] },
    { nome: "nikola tesla", pistas: ["Defendi o sistema de corrente alternada", "Concorri com Thomas Edison na Guerra das Correntes", "Meus experimentos em Wardenclyffe envolviam transmissão sem fio"] },
    { nome: "bruce lee", pistas: ["Popularizei as artes marciais no cinema ocidental", "Criei o estilo de luta Jeet Kune Do", "Fui mestre do Nunchaku e da velocidade extrema"] },
    { nome: "neymar", pistas: ["Comecei minha carreira no Santos FC", "Uso a camisa 10 na Seleção Brasileira", "Fui campeão da Champions League pelo Barcelona"] },
    { nome: "pele", pistas: ["Fui o único jogador a vencer três Copas do Mundo", "Fui apelidado de O Rei do Futebol", "Marquei mais de mil gols na carreira"] },
    { nome: "senna", pistas: ["Fui tricampeão mundial de Fórmula 1", "Fui mestre em pilotar na chuva", "Minhas maiores rivalidades foram com Alain Prost"] },
    { nome: "chaves", pistas: ["Moro dentro de um barril na vila", "Adoro sanduíche de presunto", "Choro com gritos de 'Isso, isso, isso!'"] },
    { nome: "madruga", pistas: ["Devo 14 meses de aluguel ao Senhor Barriga", "Sou o pai da Chiquinha", "Vivo fugindo do trabalho fixo"] },
    { nome: "kiko", pistas: ["Sou o bochechudo da vila", "Minha mãe me mima muito", "Tenho uma bola quadrada"] },
    { nome: "bruxa do 71", pistas: ["Meu verdadeiro nome é Clotilde", "Sou apaixonada pelo Seu Madruga", "As crianças me chamam de bruxa"] },
    { nome: "jake", pistas: ["Sou um cachorro amarelo que estica", "Moro na Terra de Ooo", "Melhor amigo de Finn"] },
    { nome: "finn", pistas: ["Sou um garoto humano de chapéu de urso", "Adoro aventuras heroicas", "Sou o último humano conhecido em Ooo por muito tempo"] },
    { nome: "rick sanchez", pistas: ["Cientista gênio e alcoólatra", "Viajo por dimensões paralelas usando uma pistola de portais", "Tenho um neto chamado Morty"] },
    { nome: "morty", pistas: ["Sou o neto gago e ansioso de um cientista maluco", "Sempre acompanho meu avô em aventuras perigosas pelo multiverso"] },
    { nome: "stitch", pistas: ["Fui criado como arma biológica alienígena", "Caí no Havaí e fui adotado por Lilo", "Meu lema principal é que família significa nunca abandonar"] },
    { nome: "gandalf", pistas: ["Sou um mago cinza (e depois branco)", "Ajudei a destruir um anel precioso", "Lutei contra um Balrog em Moria"] },
    { nome: "darth vader", pistas: ["Fui seduzido pelo Lado Sombrio da Força", "Sou o pai de Luke Skywalker", "Respiro com um som mecânico marcante"] },
    { nome: "yoda", pistas: ["Sou um mestre Jedi baixinho e verde", "Falo com a sintaxe invertida", "Treinei Luke Skywalker em Dagobah"] },
    { nome: "hermione granger", pistas: ["Sou a bruxa mais brilhante da minha turma em Hogwarts", "Uso um vira-tempo para assistir às aulas", "Sou amiga de Harry e Rony"] },
    { nome: "ron wyasley", pistas: ["Venho de uma grande família ruiva de bruxos", "Tenho medo terrível de aranhas", "Jogo xadrez bruxo com maestria"] },
    { nome: "voldemort", pistas: ["Sou o Lorde das Trevas sem nariz", "Dividi minha alma em Horcruxes", "Meu nome verdadeiro não deve ser dito"] },
    { nome: "joker", pistas: ["Sou o arqui-inimigo do Batman", "Tenho cabelo verde e cicatriz de sorriso", "Sou o palhaço do crime em Gotham"] },
    { nome: "harley quinn", pistas: ["Fui psiquiatra no Asilo Arkham antes de enlouquecer", "Sou apaixonada pelo Coringa", "Uso um martelo gigante"] },
    { nome: "deadpool", pistas: ["Sou o mercenário tagarela da Marvel", "Quebro a quarta parede conversando com o leitor", "Tenho regeneração celular avançada"] },
    { nome: "iron man", pistas: ["Sou bilionário, playboy e filantropo", "Criei minha própria armadura de alta tecnologia", "Disse a frase 'Eu sou o Homem de Ferro'"] },
    { nome: "thor", pistas: ["Sou o deus nórdico do trovão", "Carrego um martelo chamado Mjolnir", "Sou filho de Odin"] },
    { nome: "loki", pistas: ["Sou o Deus da Trapaça e da Mentira", "Adoto adagas e ilusões", "Sou o irmão adotivo de Thor"] },
    { nome: "spider man", pistas: ["Fui criado por Stan Lee e Steve Ditko", "Moro no Queens e tiro fotos para o Clarim Diário", "Tio Ben me ensinou sobre grande poder e grande responsabilidade"] },
    { nome: "thanos", pistas: ["Sou um Titã Louco obcecado pelo equilíbrio universal", "Reuni todas as Joias do Infinito em uma manopla", "Eliminei metade da vida no universo com um estalar de dedos"] },
    { nome: "elza", pistas: ["Rainha de Arendelle com controle sobre o gelo", "Cantei o sucesso 'Let It Go'", "Afastei-me para a montanha nevada para viver livre"] },
    { nome: "moana", pistas: ["Naveguei além dos recifes da minha ilha", "Devolvi o coração místico de Te Fiti", "Fui escolhida pelo próprio oceano"] },
    { nome: "simba", pistas: ["Fui exilado após a tragédia do meu pai", "Cresci cantando 'Hakuna Matata' com Timão e Pumba", "Retornei para reclamar a Pedra do Rei"] },
    { nome: "aladdin", pistas: ["Vivia furtando nas ruas de Agrabah", "Libertei um Gênio azul de uma lâmpada mágica", "Conquistei a princesa Jasmine voando em um tapete"] },
    { nome: "jack sparrow", pistas: ["Sou capitão do Pérola Negra", "Tenho um jeito meio cambaleante de andar", "Sempre busco por uma bússola que aponta para o que mais desejo"] },
    { nome: "harry potter", pistas: ["Sobrevivi ao ataque do Lorde das Trevas quando bebê", "Tenho uma cicatriz em forma de raio na testa", "Estudo na Grifinória em Hogwarts"] },
    { nome: "goku", pistas: ["Nasci no planeta Vegeta com o nome Kakaroto", "Consigo me transformar em Super Saiyajin", "Adoro comer e treinar artes marciais"] },
    { nome: "naruto", pistas: ["Tenho um demônio de raposa selado no meu corpo", "Meu maior sonho é me tornar Hokage", "Adoro comer lamen no Ichiraku"] },
    { nome: "luffy", pistas: ["Comi a Gomu Gomu no Mi por acidente", "Quero encontrar o One Piece", "Sou capitão dos Piratas do Chapéu de Palha"] },
    { nome: "wolverine", pistas: ["Tenho garras retráteis de adamantium", "Possuo fator de cura acelerado", "Fui membro dos X-Men"] },
    { nome: "batman", pistas: ["Sou o protetor de Gotham City", "Não possuo superpoderes, apenas inteligência e riqueza", "Uso um traje tecnológico inspirado em morcegos"] },
    { nome: "superman", pistas: ["Venho de um planeta destruído chamado Krypton", "Fico enfraquecido na presença de mineral verde", "Trabalho como repórter no Planeta Diário"] },
    { nome: "wonder woman", pistas: ["Sou uma princesa guerreira de Themyscira", "Uso braceletes refletores de balas e o Laço da Verdade", "Luto pela justiça no mundo dos homens"] },
    { nome: "capitao america", pistas: ["Fui condecorado após um soro especial durante a guerra", "Fui congelado por décadas no gelo", "Uso um escudo circular feito de vibranium"] }
];

async function tratarRespostas(sock, msg, from, isGroup, textoMinusculo, numeroPuroRemetente, jid) {
    if (!isGroup || !msg.message) return;
    const quoted = msg.message.extendedTextMessage?.contextInfo;
    if (!quoted) return;

    const stanzaId = quoted.stanzaId;
    const nomeUsuario = msg.pushName || 'Usuário';

    if (sessoesCharadas.has(from)) {
        const sessao = sessoesCharadas.get(from);
        if (sessao.currentMsgId === stanzaId) {
            if (sessao.ignorados.has(jid)) return;

            if (textoMinusculo === sessao.resposta) {
                if (sessao.timer) clearTimeout(sessao.timer);
                
                const dadosUser = sessao.pontos.get(jid) || { nomeUser: nomeUsuario, pontos: 0, numero: numeroPuroRemetente, jid };
                dadosUser.pontos += 1;
                sessao.pontos.set(jid, dadosUser);

                await sock.sendMessage(from, { text: `🎉 Parabéns ${nomeUsuario}! Você acertou a charada! A resposta era: *${sessao.resposta}*` }, { quoted: msg });
                sessao.resolve('acertou');
            } else {
                let errs = sessao.tentativas.get(jid) || 0;
                errs++;
                sessao.tentativas.set(jid, errs);

                if (errs >= 3) {
                    sessao.ignorados.add(jid);
                    await sock.sendMessage(from, { text: `❌ ${nomeUsuario} errou! (Tentativa ${errs}/3). Você esgotou suas 3 tentativas nesta charada e suas mensagens foram ignoradas para esta questão!` }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: `❌ ${nomeUsuario} errou! Você tem ${3 - errs} tentativa(s) restante(s) nesta charada.` }, { quoted: msg });
                }
            }
        }
    }

    if (sessoesQuemSouEu.has(from)) {
        const sessao = sessoesQuemSouEu.get(from);
        if (sessao.currentMsgId === stanzaId) {
            if (sessao.ignorados.has(jid)) return;

            if (textoMinusculo === sessao.nome) {
                if (sessao.timer) clearTimeout(sessao.timer);

                const dadosUser = sessao.pontos.get(jid) || { nomeUser: nomeUsuario, pontos: 0, numero: numeroPuroRemetente, jid };
                dadosUser.pontos += 1;
                sessao.pontos.set(jid, dadosUser);

                await sock.sendMessage(from, { text: `🎉 Parabéns ${nomeUsuario}! Você adivinhou! O personagem era: *${sessao.nome.toUpperCase()}*` }, { quoted: msg });
                sessao.resolve('acertou');
            } else {
                let errs = sessao.tentativas.get(jid) || 0;
                errs++;
                sessao.tentativas.set(jid, errs);

                if (errs >= 3) {
                    sessao.ignorados.add(jid);
                    await sock.sendMessage(from, { text: `❌ ${nomeUsuario} errou! (Tentativa ${errs}/3). Você esgotou suas 3 tentativas neste 'Quem Sou Eu' e suas mensagens foram ignoradas para esta questão!` }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: `❌ ${nomeUsuario} errou! Você tem ${3 - errs} tentativa(s) restante(s) neste 'Quem Sou Eu'.` }, { quoted: msg });
                }
            }
        }
    }
}

async function charadas(sock, from, premiarPodio) {
    if (charadasAtivas.has(from)) {
        return await sock.sendMessage(from, { text: "⚠️ Já existe uma rodada de *Charadas* rolando neste grupo! Aguarde terminar." });
    }

    charadasAtivas.set(from, { cancelado: false });
    const pontosGerais = new Map();

    try {
        const embaralhadas = [...BANCO_CHARADAS].sort(() => Math.random() - 0.5);
        const escolhidas = embaralhadas.slice(0, 5);

        for (let i = 0; i < escolhidas.length; i++) {
            const controle = charadasAtivas.get(from);
            if (!controle || controle.cancelado) return;
            if (i > 0) { await new Promise(resolve => setTimeout(resolve, 20000)); const depois = charadasAtivas.get(from); if (!depois || depois.cancelado) return; }
            const item = escolhidas[i];
            const textoMsg = `🧩 *CHARADA (Rodada ${i + 1}/5):*\n\n${item.pergunta}\n\n👉 *Responda marcando esta mensagem com a palavra correta! (Máx. 3 tentativas por charada)*`;
            const sent = await sock.sendMessage(from, { text: textoMsg });
            const messageId = sent.key.id;

            await new Promise((resolve) => {
                let timeoutId = setTimeout(async () => {
                    sessoesCharadas.delete(from);
                    await sock.sendMessage(from, { text: `⏰ *Tempo esgotado!* Ninguém acertou a tempo.\nA resposta era: *${item.resposta}*` });
                    resolve('timeout');
                }, 40000);

                sessoesCharadas.set(from, {
                    currentMsgId: messageId,
                    resposta: item.resposta,
                    timer: timeoutId,
                    pontos: pontosGerais,
                    tentativas: new Map(),
                    ignorados: new Set(),
                    resolve: (status) => {
                        clearTimeout(timeoutId);
                        sessoesCharadas.delete(from);
                        resolve(status);
                    }
                });
            });
        }

        if (pontosGerais.size > 0) {
            const ranking = [...pontosGerais.entries()].sort((a, b) => b[1].pontos - a[1].pontos).slice(0, 3);
            let textoTop = `🏆 *TOP 3 - PLACAR FINAL (CHARADAS)* 🏆\n\n`;
            const medalhas = ['🥇', '🥈', '🥉'];
            ranking.forEach(([j, dados], idx) => {
                textoTop += `${medalhas[idx]} ${dados.nomeUser} - *${dados.pontos}* acerto(s)\n`;
            });
            await sock.sendMessage(from, { text: textoTop });
            if (typeof premiarPodio === 'function') await premiarPodio(from, ranking.map(([j, dados]) => ({ jid: j, numero: dados.numero || String(j).split('@')[0], nome: dados.nomeUser, pontos: dados.pontos })), 'Charadas', sock);
        } else {
            await sock.sendMessage(from, { text: `🏁 *Fim da rodada de Charadas!* Ninguém pontuou desta vez.` });
        }

    } finally {
        charadasAtivas.delete(from);
        sessoesCharadas.delete(from);
    }
}

async function quemSouEu(sock, from, premiarPodio) {
    if (quemSouEuAtivos.has(from)) {
        return await sock.sendMessage(from, { text: "⚠️ Já existe uma rodada de *Quem Sou Eu* rolando neste grupo! Aguarde terminar." });
    }

    quemSouEuAtivos.set(from, { cancelado: false });
    const pontosGerais = new Map();

    try {
        const embaralhadas = [...BANCO_QUEM_SOU_EU].sort(() => Math.random() - 0.5);
        const escolhidas = embaralhadas.slice(0, 5);

        for (let i = 0; i < escolhidas.length; i++) {
            const controle = quemSouEuAtivos.get(from);
            if (!controle || controle.cancelado) return;
            if (i > 0) { await new Promise(resolve => setTimeout(resolve, 20000)); const depois = quemSouEuAtivos.get(from); if (!depois || depois.cancelado) return; }
            const item = escolhidas[i];
            let textoPistas = `🕵️ *QUEM SOU EU? (Rodada ${i + 1}/5)*\n\n📌 *Pistas:*\n` + item.pistas.map(p => `• ${p}`).join('\n');
            textoPistas += `\n\n👉 *Responda marcando esta mensagem com o nome correto! (Máx. 3 tentativas por item)*`;
            const sent = await sock.sendMessage(from, { text: textoPistas });
            const messageId = sent.key.id;

            await new Promise((resolve) => {
                let timeoutId = setTimeout(async () => {
                    sessoesQuemSouEu.delete(from);
                    await sock.sendMessage(from, { text: `⏰ *Tempo esgotado!* Ninguém acertou a tempo.\nO personagem era: *${item.nome.toUpperCase()}*` });
                    resolve('timeout');
                }, 40000);

                sessoesQuemSouEu.set(from, {
                    currentMsgId: messageId,
                    nome: item.nome,
                    timer: timeoutId,
                    pontos: pontosGerais,
                    tentativas: new Map(),
                    ignorados: new Set(),
                    resolve: (status) => {
                        clearTimeout(timeoutId);
                        sessoesQuemSouEu.delete(from);
                        resolve(status);
                    }
                });
            });
        }

        if (pontosGerais.size > 0) {
            const ranking = [...pontosGerais.entries()].sort((a, b) => b[1].pontos - a[1].pontos).slice(0, 3);
            let textoTop = `🏆 *TOP 3 - PLACAR FINAL (QUEM SOU EU)* 🏆\n\n`;
            const medalhas = ['🥇', '🥈', '🥉'];
            ranking.forEach(([j, dados], idx) => {
                textoTop += `${medalhas[idx]} ${dados.nomeUser} - *${dados.pontos}* acerto(s)\n`;
            });
            await sock.sendMessage(from, { text: textoTop });
            if (typeof premiarPodio === 'function') await premiarPodio(from, ranking.map(([j, dados]) => ({ jid: j, numero: dados.numero || String(j).split('@')[0], nome: dados.nomeUser, pontos: dados.pontos })), 'Quem Sou Eu', sock);
        } else {
            await sock.sendMessage(from, { text: `🏁 *Fim da rodada de Quem Sou Eu!* Ninguém pontuou desta vez.` });
        }

    } finally {
        quemSouEuAtivos.delete(from);
        sessoesQuemSouEu.delete(from);
    }
}

async function euNunca(sock, from) {
    if (euNuncaAtivos.has(from)) {
        return await sock.sendMessage(from, { text: "⚠️ Já existe uma rodada de *Eu Nunca* rolando neste grupo! Aguarde terminar." });
    }

    euNuncaAtivos.set(from, { cancelado: false });

    try {
        const embaralhadas = [...BANCO_EU_NUNCA].sort(() => Math.random() - 0.5);
        const escolhidas = embaralhadas.slice(0, 5);

        for (let i = 0; i < escolhidas.length; i++) {
            const controle = euNuncaAtivos.get(from);
            if (!controle || controle.cancelado) return;
            if (i > 0) { await new Promise(resolve => setTimeout(resolve, 45000)); const depois = euNuncaAtivos.get(from); if (!depois || depois.cancelado) return; }
            const frase = escolhidas[i];
            await sock.sendMessage(from, { 
                poll: { 
                    name: `🙈 *EU NUNCA (Rodada ${i + 1}/5):*\n${frase}`, 
                    values: ['Já fiz 🙋‍♂️', 'Nunca fiz 🙅‍♀️'], 
                    selectableCount: 1 
                } 
            });
        }
    } finally {
        euNuncaAtivos.delete(from);
    }
}

async function bomba(sock, from, jid, numeroPuroRemetente) {
    if (bombaJogo) return sock.sendMessage(from, { text: "⚠️ Já existe uma bomba rolando!" });
    const tempoBomba = Math.floor(Math.random() * 20000) + 15000;
    bombaJogo = { portador: jid, grupo: from, mensagemId: null };
    const rodadaAtual = bombaJogo;
    const mensagemBomba = await sock.sendMessage(from, { text: `💣 *A BOMBA FOI LIGADA!*

A bomba está com @${numeroPuroRemetente}! Responda a esta mensagem marcando quem vai receber a bomba!`, mentions: [jid] });
    rodadaAtual.mensagemId = mensagemBomba?.key?.id || null;

    setTimeout(async () => {
        if (bombaJogo === rodadaAtual) {
            const vitima = bombaJogo.portador;
            const numVitima = vitima.replace(/[^0-9]/g, '');
            await sock.sendMessage(from, { text: `💥 *BOOOOM!* A bomba explodiu na mão de @${numVitima}!`, mentions: [vitima] });
            bombaJogo = null;
        }
    }, tempoBomba);
}

async function passarBomba(sock, from, msg) {
    if (!bombaJogo || bombaJogo.grupo !== from) return false;
    const contexto = msg.message?.extendedTextMessage?.contextInfo;
    if (!contexto?.stanzaId || contexto.stanzaId !== bombaJogo.mensagemId) return false;
    const mencao = contexto.mentionedJid?.[0];
    if (!mencao) return sock.sendMessage(from, { text: '⚠️ Responda à mensagem atual da bomba marcando quem vai receber!' });
    bombaJogo.portador = mencao;
    const numNovo = mencao.replace(/[^0-9]/g, '');
    const rodadaAtual = bombaJogo;
    const mensagemTransferencia = await sock.sendMessage(from, { text: `💣 A bomba foi passada para @${numNovo}! Corra! Responda a esta mensagem marcando quem vai receber a bomba em seguida!`, mentions: [mencao] }, { quoted: msg });
    if (bombaJogo === rodadaAtual) rodadaAtual.mensagemId = mensagemTransferencia?.key?.id || null;
    return true;
}
async function daily(sock, from, numeroPuroRemetente, jid) {
    const chave = `${from}_${numeroPuroRemetente}`;
    const dados = rankMoedas.get(chave) || { xp: 0, moedas: 0 };
    dados.moedas += 100;
    dados.xp += 50;
    rankMoedas.set(chave, dados);
    salvarDadosJogos();
    await sock.sendMessage(from, { text: `💰 @${numeroPuroRemetente} resgatou sua recompensa diária!\n\n+100 Moedas 🪙\n+50 XP ⚡`, mentions: [jid] });
}

async function rank(sock, from, numeroPuroRemetente, jid) {
    const chave = `${from}_${numeroPuroRemetente}`;
    const dados = rankMoedas.get(chave) || { xp: 0, moedas: 0 };
    await sock.sendMessage(from, { text: `🏆 *SEU PERFIL DE JOGO:*\n\n👤 Usuário: @${numeroPuroRemetente}\n🪙 Moedas: ${dados.moedas}\n⚡ XP: ${dados.xp}`, mentions: [jid] });
}

async function encerrarTodosJogosNoGrupo(sock, grupoId) {
    let encerrou = false;
    const bombaAtual = bombasJogo.get(grupoId);
    if (bombaAtual) { if (bombaAtual.timer) clearTimeout(bombaAtual.timer); bombasJogo.delete(grupoId); encerrou = true; }
    const charada = charadasAtivas.get(grupoId);
    if (charada) { charada.cancelado = true; charadasAtivas.delete(grupoId); const sessao = sessoesCharadas.get(grupoId); if (sessao) { if (sessao.timer) clearTimeout(sessao.timer); sessoesCharadas.delete(grupoId); if (typeof sessao.resolve === 'function') sessao.resolve('encerrado'); } encerrou = true; }
    const quem = quemSouEuAtivos.get(grupoId);
    if (quem) { quem.cancelado = true; quemSouEuAtivos.delete(grupoId); const sessao = sessoesQuemSouEu.get(grupoId); if (sessao) { if (sessao.timer) clearTimeout(sessao.timer); sessoesQuemSouEu.delete(grupoId); if (typeof sessao.resolve === 'function') sessao.resolve('encerrado'); } encerrou = true; }
    const eu = euNuncaAtivos.get(grupoId);
    if (eu) { eu.cancelado = true; euNuncaAtivos.delete(grupoId); encerrou = true; }
    return encerrou;
}
function haJogoAtivoNoGrupo(grupoId) { return bombasJogo.has(grupoId) || charadasAtivas.has(grupoId) || quemSouEuAtivos.has(grupoId) || euNuncaAtivos.has(grupoId); }
module.exports = { tratarRespostas, euNunca, charadas, quemSouEu, bomba, passarBomba, daily, rank, encerrarTodosJogosNoGrupo, haJogoAtivoNoGrupo };


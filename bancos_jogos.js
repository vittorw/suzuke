const fs = require('fs');

const NOVOS_TEMAS = {
    matematica: [
        ['algebra','ramo que trabalha com incógnitas, expressões e equações'],['aritmetica','área da matemática que trata de números e operações básicas'],['geometria','ramo que estuda formas, medidas, posições e propriedades espaciais'],['trigonometria','ramo que relaciona ângulos e lados de triângulos'],['calculo','área matemática que estuda limites, derivadas e integrais'],['probabilidade','medida numérica da chance de um evento ocorrer'],['estatistica','área que coleta, organiza e interpreta dados'],['fracao','representação de uma parte de um todo por numerador e denominador'],['porcentagem','forma de representar uma razão em relação a cem'],['equacao','igualdade matemática que pode conter uma ou mais incógnitas'],['poligono','figura plana fechada formada por segmentos de reta'],['triangulo','polígono com três lados'],['quadrado','quadrilátero com quatro lados iguais e quatro ângulos retos'],['retangulo','quadrilátero com quatro ângulos retos'],['circulo','figura plana formada pelos pontos à mesma distância de um centro'],['diametro','segmento que passa pelo centro de um círculo e liga dois pontos da circunferência'],['raio','segmento que liga o centro de um círculo à circunferência'],['perimetro','medida do contorno de uma figura plana'],['area','medida da superfície de uma figura'],['volume','medida do espaço ocupado por um sólido'],['primo','número natural maior que um com exatamente dois divisores positivos'],['divisibilidade','propriedade relacionada à divisão exata entre números'],['fatorial','produto de todos os inteiros positivos até determinado número'],['potenciacao','operação que representa multiplicações repetidas de uma base'],['radiciacao','operação relacionada à extração de raízes'],['logaritmo','expoente ao qual uma base deve ser elevada para produzir um número'],['matriz','estrutura retangular organizada em linhas e colunas'],['vetor','objeto matemático com magnitude e direção em diversos contextos'],['sequencia','lista ordenada de termos que segue determinada regra'],['fibonacci','sequência em que cada termo resulta da soma dos dois anteriores']
    ],
    paises: [
        ['brasil','maior país da América do Sul e tem Brasília como capital'],['portugal','país europeu cuja capital é Lisboa e que tem o português como língua oficial'],['japao','país insular asiático conhecido pelo Monte Fuji e pela capital Tóquio'],['canada','país da América do Norte conhecido por grandes áreas de florestas e pela capital Ottawa'],['mexico','país da América do Norte cuja capital é Cidade do México'],['argentina','país sul-americano cuja capital é Buenos Aires'],['chile','país sul-americano longo e estreito entre os Andes e o Pacífico'],['peru','país sul-americano onde ficam Machu Picchu e Cusco'],['colombia','país sul-americano cuja capital é Bogotá'],['uruguai','país sul-americano cuja capital é Montevidéu'],['paraguai','país sul-americano sem litoral cuja capital é Assunção'],['bolivia','país sul-americano sem litoral que tem La Paz como sede de governo'],['franca','país europeu cuja capital é Paris e onde fica a Torre Eiffel'],['espanha','país europeu cuja capital é Madri'],['italia','país europeu conhecido por Roma, pelo Coliseu e pelo formato de bota'],['alemanha','país europeu cuja capital é Berlim'],['inglaterra','nação que ocupa a maior parte da ilha da Grã-Bretanha e tem Londres como capital'],['irlanda','país europeu cuja capital é Dublin'],['noruega','país nórdico conhecido pelos fiordes e cuja capital é Oslo'],['suecia','país nórdico cuja capital é Estocolmo'],['finlandia','país nórdico conhecido por muitos lagos e cuja capital é Helsinque'],['islandia','país insular do Atlântico Norte conhecido por vulcões e gêiseres'],['egito','país africano atravessado pelo rio Nilo e conhecido pelas pirâmides de Gizé'],['marrocos','país do norte da África cuja capital é Rabat'],['africa_do_sul','país africano com três capitais oficiais'],['india','país asiático cuja capital é Nova Délhi'],['china','país asiático cuja capital é Pequim'],['australia','país da Oceania que também ocupa um continente'],['nova_zelandia','país insular da Oceania conhecido pelas ilhas Norte e Sul']
    ],
    literatura: [
        ['dom_quixote','romance de Miguel de Cervantes sobre um fidalgo que imagina ser cavaleiro andante'],['hamlet','tragédia de Shakespeare centrada no príncipe da Dinamarca'],['otelo','tragédia de Shakespeare marcada pelo ciúme e pela figura de Iago'],['macbeth','tragédia de Shakespeare envolvendo profecias, ambição e poder'],['romeu_e_julieta','tragédia de Shakespeare sobre dois jovens apaixonados de famílias rivais'],['divina_comedia','poema épico de Dante que percorre Inferno, Purgatório e Paraíso'],['os_lusíadas','poema épico de Camões sobre a viagem de Vasco da Gama e a história portuguesa'],['memorias_postumas','romance de Machado de Assis narrado pelo defunto Brás Cubas'],['dom_casmurro','romance de Machado de Assis narrado por Bento Santiago'],['iracema','romance de José de Alencar associado à formação do Ceará e ao indianismo'],['o_guarani','romance de José de Alencar protagonizado por Peri e Cecília'],['vidas_secas','romance de Graciliano Ramos sobre uma família de retirantes nordestinos'],['capitaes_da_areia','romance de Jorge Amado sobre meninos em situação de rua em Salvador'],['grande_sertao','obra de Guimarães Rosa ambientada no sertão e narrada por Riobaldo'],['a_hora_da_estrela','romance de Clarice Lispector protagonizado por Macabéa'],['o_cortico','romance naturalista de Aluísio Azevedo ambientado em um cortiço'],['senhora','romance de José de Alencar protagonizado por Aurélia Camargo'],['marilia_de_dirceu','obra poética de Tomás Antônio Gonzaga ligada ao arcadismo brasileiro'],['auto_da_compadecida','peça de Ariano Suassuna com João Grilo e Chicó'],['enigma_do_principe','conto literário de fantasia sobre identidade e aventura'],['frankenstein','romance de Mary Shelley sobre Victor Frankenstein e sua criatura'],['dracula','romance de Bram Stoker sobre o vampiro Conde Drácula'],['o_pequeno_principe','livro de Antoine de Saint-Exupéry protagonizado por um pequeno viajante'],['1984','romance de George Orwell sobre uma sociedade sob vigilância totalitária'],['admiravel_mundo_novo','romance de Aldous Huxley sobre uma sociedade de controle e condicionamento'],['fahrenheit_451','romance de Ray Bradbury sobre uma sociedade que proíbe livros'],['o_hobbit','romance de fantasia de J. R. R. Tolkien sobre Bilbo Bolseiro'],['senhor_dos_aneis','trilogia de fantasia de Tolkien centrada no Um Anel'],['cem_anos_de_solidao','romance de Gabriel García Márquez sobre a família Buendía'],['orgulho_e_preconceito','romance de Jane Austen protagonizado por Elizabeth Bennet e Mr. Darcy']
    ],
    gastronomia: [
        ['arroz','cereal muito consumido no Brasil e usado em diversos acompanhamentos'],['feijao','leguminosa muito presente na culinária brasileira'],['feijoada','prato brasileiro tradicional preparado com feijão e carnes'],['acaraje','bolinho de feijão-fradinho frito em azeite de dendê'],['tapioca','preparação feita com goma de mandioca hidratada'],['coxinha','salgado brasileiro geralmente recheado com frango'],['pao_de_queijo','quitute mineiro feito com polvilho e queijo'],['brigadeiro','doce brasileiro feito tradicionalmente com leite condensado e chocolate'],['moqueca','preparação de peixe ou frutos do mar comum em regiões costeiras brasileiras'],['churrasco','preparação de carnes assadas, muito associada à culinária brasileira'],['lasanha','massa em camadas intercaladas com recheio e molho'],['pizza','preparação de massa assada com molho e cobertura'],['sushi','preparação japonesa que pode combinar arroz temperado com peixe e outros ingredientes'],['sashimi','fatias de peixe cru servidas sem arroz'],['ramen','sopa japonesa com macarrão e caldo'],['tempura','preparação japonesa de ingredientes empanados e fritos em massa leve'],['tacos','preparação mexicana geralmente feita com tortilha e recheio'],['guacamole','molho mexicano à base de abacate'],['paella','prato espanhol de arroz tradicionalmente associado à região de Valência'],['risoto','prato italiano de arroz cozido lentamente com caldo'],['gelato','sobremesa italiana semelhante ao sorvete, com textura própria'],['croissant','massa folhada em formato crescente, associada à tradição francesa'],['ratatouille','preparação francesa de vegetais cozidos'],['fondue','prato de origem suíça que pode envolver queijo ou chocolate derretido'],['baklava','doce de camadas de massa, frutos secos e calda, comum no Mediterrâneo e Oriente Médio'],['cuscuz','preparação à base de sêmola ou milho, com muitas variações regionais'],['quibe','preparação de origem árabe feita tradicionalmente com trigo para quibe e carne'],['esfiha','massa recheada muito presente na culinária de origem árabe no Brasil'],['falafel','bolinho de grão-de-bico ou fava comum no Oriente Médio'],['hummus','pasta de grão-de-bico com tahine, limão e outros temperos']
    ],
    jogos: [
        ['xadrez','jogo de estratégia com rei, dama, torres, bispos, cavalos e peões'],['damas','jogo de tabuleiro de captura de peças em casas diagonais'],['go','jogo de estratégia de origem chinesa baseado no controle de território'],['sudoku','quebra-cabeça numérico baseado em grades e restrições'],['tetris','jogo em que peças geométricas caem e devem formar linhas'],['minecraft','jogo de construção e exploração em mundo formado por blocos'],['fortnite','jogo conhecido por seu modo battle royale e construção em algumas modalidades'],['valorant','jogo de tiro tático em equipes desenvolvido pela Riot Games'],['overwatch','jogo de tiro em equipes com heróis de habilidades diferentes'],['league_of_legends','jogo competitivo de arena de batalha online da Riot Games'],['dota_2','jogo de arena de batalha online derivado do universo de Defense of the Ancients'],['counter_strike','franquia de tiro tático em equipes'],['zelda','franquia da Nintendo protagonizada frequentemente por Link'],['mario','franquia da Nintendo centrada no personagem Mario'],['pokemon','franquia que envolve capturar, treinar e batalhar com criaturas'],['sonic','franquia da Sega estrelada por um ouriço azul veloz'],['metroid','franquia da Nintendo protagonizada por Samus Aran'],['kirby','personagem da Nintendo conhecido por copiar habilidades de inimigos'],['pacman','jogo clássico em que o personagem percorre um labirinto comendo pontos'],['space_invaders','arcade clássico de tiro contra formações de alienígenas'],['street_fighter','franquia de jogos de luta da Capcom'],['mortal_kombat','franquia de jogos de luta conhecida pelos fatalities'],['tekken','franquia de jogos de luta da Bandai Namco'],['final_fantasy','série de RPG da Square Enix'],['chrono_trigger','RPG clássico desenvolvido por Square e associado a viagem no tempo'],['castlevania','franquia de ação e exploração com temática de vampiros'],['god_of_war','franquia de ação protagonizada por Kratos'],['the_last_of_us','jogo narrativo pós-apocalíptico desenvolvido pela Naughty Dog'],['red_dead_redemption','franquia de ação ambientada no Velho Oeste'],['assassins_creed','franquia de ação histórica da Ubisoft']
    ],
    corpo_humano: [
        ['coracao','órgão muscular responsável por bombear o sangue'],['pulmao','órgão principal das trocas gasosas da respiração'],['cerebro','órgão central do sistema nervoso localizado no crânio'],['figado','órgão que participa do metabolismo e da produção de bile'],['rim','órgão que filtra o sangue e participa da formação da urina'],['estomago','órgão do sistema digestório que participa da digestão'],['intestino_delgado','parte do sistema digestório onde ocorre grande parte da absorção de nutrientes'],['intestino_grosso','parte do intestino envolvida na absorção de água e formação das fezes'],['pancreas','órgão que produz enzimas digestivas e hormônios como a insulina'],['esofago','tubo que conduz o alimento da faringe ao estômago'],['traqueia','tubo que conduz o ar em direção aos brônquios'],['diafragma','músculo importante para a respiração'],['femur','osso mais longo do corpo humano'],['tibia','osso da perna localizado medialmente e responsável por suportar grande parte do peso'],['fibula','osso mais fino da perna, localizado lateralmente'],['umero','osso do braço entre ombro e cotovelo'],['radio','osso do antebraço localizado no lado do polegar'],['ulna','osso do antebraço localizado no lado do dedo mínimo'],['clavicula','osso que liga o esterno à região do ombro'],['escapula','osso triangular localizado na região posterior do ombro'],['patela','osso localizado anteriormente ao joelho'],['mandibula','osso móvel que forma a parte inferior da mandíbula'],['esterno','osso localizado na parte anterior do tórax'],['aorta','principal artéria que sai do coração'],['hemoglobina','proteína das hemácias que transporta grande parte do oxigênio'],['neuronio','célula especializada na transmissão de sinais nervosos'],['retina','camada do olho que contém células sensíveis à luz'],['cortex_cerebral','camada externa do cérebro envolvida em várias funções superiores'],['medula_espinhal','estrutura do sistema nervoso que liga o encéfalo a nervos do corpo'],['sistema_imunologico','conjunto de estruturas e células que defendem o organismo']
    ]
};

const SUFIXOS = {
    tecnologia: ['digital','online','virtual','movel','computacional'], animais: ['selvagem','marinho','noturno','tropical','domestico'], esportes: ['olimpico','mundial','profissional','juvenil','indoor'], filmes: ['classico','cult','animado','ficcao','aventura'], paises: ['europeu','asiatico','africano','americano','insular'], ciencia: ['molecular','experimental','teorica','aplicada','espacial'], musica: ['acustico','eletronico','instrumental','vocal','orquestral'], mitologia: ['grega','romana','nordica','egipcia','mesopotamica'], historia: ['antiga','medieval','moderna','colonial','industrial'], geografia: ['fisica','humana','urbana','regional','climatica'], matematica: ['algebrico','geometrico','estatistico','numerico','probabilistico'], literatura: ['classico','romantico','moderno','brasileiro','fantastico'], gastronomia: ['caseiro','regional','tradicional','artesanal','internacional'], jogos: ['arcade','online','competitivo','estrategico','cooperativo'], corpo_humano: ['muscular','nervoso','digestivo','respiratorio','circulatorio']
};

function normalizarTermo(s) {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
}

function expandirForca(temas) {
    for (const [tema, lista] of Object.entries(temas)) {
        const alvo = new Set(lista.map(normalizarTermo).filter(Boolean));
        const base = [...lista].map(normalizarTermo).filter(Boolean);
        const sufixos = SUFIXOS[tema] || ['extra','avancado','especial','classico','moderno'];
        for (const palavra of base) {
            for (const sufixo of sufixos) {
                if (alvo.size >= 150) break;
                const termo = normalizarTermo(`${palavra}${sufixo}`);
                if (termo && !alvo.has(termo)) { lista.push(termo); alvo.add(termo); }
            }
            if (alvo.size >= 150) break;
        }
        const seeds = NOVOS_TEMAS[tema] || [];
        for (const [resposta] of seeds) {
            for (const sufixo of sufixos) {
                if (alvo.size >= 150) break;
                const termo = normalizarTermo(`${resposta}${sufixo}`);
                if (termo && !alvo.has(termo)) { lista.push(termo); alvo.add(termo); }
            }
            if (alvo.size >= 150) break;
        }
        let n = 1;
        while (alvo.size < 150) {
            const termo = `${tema}${n++}`;
            if (!alvo.has(termo)) { lista.push(termo); alvo.add(termo); }
        }
        temas[tema] = lista.slice(0, 150);
    }
    return temas;
}

function criarQuestoesDosSeeds(seeds, quantidade = 150) {
    const out = [];
    const respostas = seeds.map(x => x[0]);
    const modelos = [
        clue => `Qual termo é descrito pela seguinte pista? ${clue}`,
        clue => `A descrição a seguir corresponde a qual termo? ${clue}`,
        clue => `Entre as alternativas, qual identifica corretamente o item descrito? ${clue}`,
        clue => `Qual opção representa o termo indicado por esta descrição? ${clue}`,
        clue => `Desafio: usando a pista abaixo, escolha o termo correto: ${clue}`
    ];
    let i = 0;
    while (out.length < quantidade) {
        const seed = seeds[i % seeds.length];
        const modelo = modelos[Math.floor(i / seeds.length) % modelos.length];
        const correta = seed[0];
        const offset = (i % 4) + 1;
        const opcoes = [correta, respostas[(i + offset) % respostas.length], respostas[(i + offset + 7) % respostas.length], respostas[(i + offset + 13) % respostas.length]];
        const unicas = [...new Set(opcoes)];
        while (unicas.length < 4) unicas.push(respostas[(i + unicas.length + 17) % respostas.length]);
        const inicio = i % 4;
        const rotacionadas = unicas.slice(inicio).concat(unicas.slice(0, inicio));
        const idx = rotacionadas.indexOf(correta);
        out.push({ p: modelo(seed[1]), op: rotacionadas.map((v,j) => `${String.fromCharCode(65+j)}) ${v}`), r: String.fromCharCode(97+idx) });
        i++;
    }
    return out;
}

function expandirQuiz(temas) {
    for (const [tema, lista] of Object.entries(temas)) {
        if (NOVOS_TEMAS[tema]) {
            const extras = criarQuestoesDosSeeds(NOVOS_TEMAS[tema], 150);
            temas[tema] = extras;
            continue;
        }
        const originais = lista.slice();
        const extras = [];
        for (let i = 0; i < originais.length && extras.length < 125; i++) {
            const q = originais[i];
            const correta = q.op.find(o => o.toLowerCase().startsWith(`${q.r.toLowerCase()})`)) || q.op[0];
            const resto = q.op.filter(o => o !== correta);
            for (const prefixo of [
                'Versão de revisão: ',
                'Desafio intermediário: ',
                'Teste de conhecimento: ',
                'Pergunta extra: ',
                'Rodada bônus: '
            ]) {
                if (extras.length >= 125) break;
                const opcoes = [correta, ...resto].sort(() => Math.random() - 0.5);
                const idx = opcoes.indexOf(correta);
                extras.push({ p: `${prefixo}${q.p}`, op: opcoes, r: String.fromCharCode(97+idx) });
            }
        }
        temas[tema] = originais.concat(extras).slice(0, 150);
    }
    return temas;
}

module.exports = { NOVOS_TEMAS, expandirForca, expandirQuiz };

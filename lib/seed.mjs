// Canais iniciais. "handle" é o @ do canal (quando conhecido); "busca" é o nome usado
// para achar o canal na busca do YouTube se o @ não existir. Tudo é resolvido no PC,
// na primeira execução, e pode ser corrigido na tela Canais colando o link do canal.
//
// origem: "historico" = apareceu no seu histórico; "semelhante" = sugerido por afinidade;
// "contraponto" = outro lado do debate, começa silenciado (ligue se quiser).

export const CATEGORIAS = {
  politica: "Política",
  cortes: "Cortes",
  debates: "Debates",
  podcasts: "Podcasts",
  noticias: "Notícias",
  economia: "Economia",
  eua: "EUA",
  geral: "Geral",
};

const c = (busca, categoria, origem, handle) => ({ busca, categoria, origem, handle });

export const chaveDaSemente = (c) => (c.handle ? "@" + c.handle.toLowerCase() : c.busca.toLowerCase());

export const CANAIS_INICIAIS = [
  // Do seu histórico
  c("Bacci Notícias", "noticias", "historico", "BacciNoticias"),
  c("NB News", "noticias", "historico"),
  c("ANCAPSU", "politica", "historico", "ancapsu"),
  c("Paulo Figueiredo Show", "politica", "historico"),
  c("Paulo Figueiredo Oficial", "politica", "historico"),
  c("Palco Nacional", "debates", "historico"),
  c("Conversa Timeline", "politica", "historico"),
  c("Consta Timeline", "politica", "historico"),
  c("IronTalks TV", "podcasts", "historico"),
  c("Canal do Coca", "politica", "historico"),
  c("Alta Linguagem", "geral", "historico"),
  c("Kim Paim", "politica", "historico", "KimPaim"),
  c("Senso Incomum", "politica", "historico"),

  // Política e opinião (mesma linha)
  c("Revista Oeste", "politica", "semelhante", "RevistaOeste"),
  c("Jovem Pan News", "noticias", "semelhante", "jovempannews"),
  c("Os Pingos nos Is", "debates", "semelhante"),
  c("Gazeta do Povo", "noticias", "semelhante", "gazetadopovo"),
  c("Brasil Paralelo", "politica", "semelhante", "BrasilParalelo"),
  c("Te Atualizei", "politica", "semelhante", "TeAtualizei"),
  c("Nikolas Ferreira", "politica", "semelhante"),
  c("Gustavo Gayer", "politica", "semelhante"),
  c("Paulo Kogos", "politica", "semelhante"),
  c("Ideias Radicais", "politica", "semelhante", "IdeiasRadicais"),
  c("Visão Libertária", "politica", "semelhante"),
  c("MBL - Movimento Brasil Livre", "politica", "semelhante"),
  c("Renan Santos", "politica", "semelhante"),
  c("Mamaefalei Arthur do Val", "politica", "semelhante"),
  c("Marcel van Hattem", "politica", "semelhante"),
  c("Deltan Dallagnol", "politica", "semelhante"),
  c("Rodrigo Constantino", "politica", "semelhante"),
  c("Alexandre Garcia", "politica", "semelhante"),
  c("Caio Coppolla", "politica", "semelhante"),
  c("Ana Paula Henkel", "politica", "semelhante"),
  c("Leda Nagle", "debates", "semelhante"),
  c("Allan dos Santos", "politica", "semelhante"),

  // Debates, entrevistas e jornalismo
  c("GloboNews", "debates", "semelhante", "GloboNews"),
  c("CNN Brasil", "debates", "semelhante", "CNNbrasil"),
  c("Metrópoles", "noticias", "semelhante", "metropoles"),
  c("Poder360", "noticias", "semelhante", "Poder360"),
  c("Roda Viva", "debates", "semelhante", "rodaviva"),
  c("BBC News Brasil", "noticias", "semelhante", "bbcbrasil"),
  c("Canal Meio", "noticias", "semelhante"),
  c("Band Jornalismo", "noticias", "semelhante"),
  c("Estadão", "noticias", "semelhante"),

  // Podcasts famosos
  c("Flow Podcast", "podcasts", "semelhante", "FlowPodcast"),
  c("Inteligência Ltda", "podcasts", "semelhante", "inteligencialtda"),
  c("Podpah", "podcasts", "semelhante", "Podpah"),
  c("Pânico Jovem Pan", "podcasts", "semelhante", "panicojovempan"),
  c("Monark Talks", "podcasts", "semelhante"),
  c("Ironberg Podcast", "podcasts", "semelhante"),
  c("Venus Podcast", "podcasts", "semelhante"),
  c("Market Makers", "economia", "semelhante", "MarketMakers"),
  c("Os Sócios Podcast", "podcasts", "semelhante"),
  c("PrimoCast", "economia", "semelhante"),
  c("Ciência Sem Fim", "podcasts", "semelhante"),
  c("Podcast 3 Irmãos", "podcasts", "semelhante"),
  c("Rogério Vilela", "podcasts", "semelhante"),
  c("Cara a Tapa", "podcasts", "semelhante"),
  c("O Primo Rico", "economia", "semelhante", "oprimorico"),

  // Canais de cortes
  c("Cortes do Flow [OFICIAL]", "cortes", "semelhante"),
  c("Cortes do Inteligência [OFICIAL]", "cortes", "semelhante"),
  c("Cortes do Podpah", "cortes", "semelhante"),
  c("Cortes do Pânico", "cortes", "semelhante"),
  c("Cortes do Market Makers", "cortes", "semelhante"),
  c("Cortes Brasil Paralelo", "cortes", "semelhante"),
  c("Cortes Os Sócios", "cortes", "semelhante"),
  c("Cortes do Ciência Sem Fim", "cortes", "semelhante"),
  c("Cortes do Ironberg", "cortes", "semelhante"),
  c("Cortes do Monark", "cortes", "semelhante"),
  c("Cortes 3 Irmãos", "cortes", "semelhante"),

  // Política americana
  c("Asmongold TV", "eua", "semelhante"),
  c("Asmongold Clips", "eua", "semelhante"),
  c("Benny Johnson", "eua", "semelhante"),
  c("Tucker Carlson", "eua", "semelhante", "TuckerCarlson"),
  c("Ben Shapiro", "eua", "semelhante", "BenShapiro"),
  c("The Daily Wire", "eua", "semelhante"),
  c("Matt Walsh", "eua", "semelhante"),
  c("Michael Knowles", "eua", "semelhante"),
  c("Charlie Kirk", "eua", "semelhante"),
  c("Candace Owens", "eua", "semelhante"),
  c("Steven Crowder", "eua", "semelhante", "StevenCrowder"),
  c("Timcast", "eua", "semelhante", "Timcast"),
  c("Timcast IRL", "eua", "semelhante", "TimcastIRL"),
  c("Megyn Kelly", "eua", "semelhante", "MegynKelly"),
  c("PBD Podcast", "eua", "semelhante", "PBDPodcast"),
  c("Piers Morgan Uncensored", "eua", "semelhante", "PiersMorganUncensored"),
  c("Jubilee", "eua", "semelhante", "jubilee"),
  c("Breaking Points", "eua", "semelhante", "breakingpoints"),
  c("Glenn Greenwald System Update", "eua", "semelhante"),
  c("Triggernometry", "eua", "semelhante", "triggerpod"),
  c("Fox News", "eua", "semelhante", "FoxNews"),
  c("JRE Clips", "eua", "semelhante", "JREClips"),
  c("PowerfulJRE Joe Rogan", "eua", "semelhante", "joerogan"),
  c("Theo Von", "eua", "semelhante", "TheoVon"),
  c("All-In Podcast", "eua", "semelhante", "allin"),
  c("Lex Fridman", "eua", "semelhante", "lexfridman"),

  // Contraponto (começam silenciados)
  c("ICL Notícias", "noticias", "contraponto"),
  c("Brasil 247", "noticias", "contraponto"),
  c("Reinaldo Azevedo", "politica", "contraponto"),
  c("Meteoro Brasil", "politica", "contraponto"),
  c("Mídia NINJA", "noticias", "contraponto"),
  c("HasanAbi", "eua", "contraponto"),
  c("The Young Turks", "eua", "contraponto", "TheYoungTurks"),
  c("Destiny", "eua", "contraponto"),
  c("Brian Tyler Cohen", "eua", "contraponto"),
  c("MeidasTouch", "eua", "contraponto"),
  c("CNN", "eua", "contraponto", "CNN"),
];

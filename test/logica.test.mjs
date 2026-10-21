import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFeed, lerPaginaCanal, lerBuscaCanais, interpretarEntrada, lerPaginaVideo } from "../lib/youtube.mjs";
import { lerTakeoutJson, lerTakeoutHtml, lerInscricoesCsv, lerPagina, resumirHistorico, categoriaPeloNome } from "../lib/historico.mjs";
import { etiquetas, montarTimeline, intercalar } from "../lib/ranking.mjs";

const FEED = `<?xml version="1.0"?><feed xmlns:yt="x" xmlns:media="y" xmlns="z">
<id>yt:channel:abcdefghijklmnopqrstuv</id><yt:channelId>abcdefghijklmnopqrstuv</yt:channelId><title>Canal &amp; Teste</title>
<entry><id>yt:video:AAAAAAAAAAA</id><yt:videoId>AAAAAAAAAAA</yt:videoId><yt:channelId>UCabcdefghijklmnopqrstuv</yt:channelId>
<title>DEBATE: Fulano x Beltrano &quot;ao vivo&quot;</title><link rel="alternate" href="https://www.youtube.com/watch?v=AAAAAAAAAAA"/>
<published>2026-10-20T10:00:00+00:00</published><updated>2026-10-20T11:00:00+00:00</updated>
<media:group><media:description>desc</media:description><media:community><media:statistics views="21000"/></media:community></media:group></entry>
<entry><id>yt:video:BBBBBBBBBBB</id><yt:videoId>BBBBBBBBBBB</yt:videoId><yt:channelId>UCabcdefghijklmnopqrstuv</yt:channelId>
<title>curtinho</title><link rel="alternate" href="https://www.youtube.com/shorts/BBBBBBBBBBB"/>
<published>2026-10-19T10:00:00+00:00</published><media:group><media:community><media:statistics views="0"/></media:community></media:group></entry>
</feed>`;

test("lê o feed RSS do canal", () => {
  const { canal, videos } = lerFeed(FEED);
  assert.equal(canal.id, "UCabcdefghijklmnopqrstuv");
  assert.equal(canal.titulo, "Canal & Teste");
  assert.equal(videos.length, 2);
  assert.equal(videos[0].titulo, 'DEBATE: Fulano x Beltrano "ao vivo"');
  assert.equal(videos[0].views, 21000);
  assert.equal(videos[0].short, false);
  assert.equal(videos[1].short, true);
});

test("acha o id do canal na página e na busca", () => {
  const html = `<meta property="og:title" content="NB News"><meta itemprop="identifier" content="UC1234567890123456789012">"canonicalBaseUrl":"/@NBNews"`;
  assert.deepEqual(lerPaginaCanal(html), { id: "UC1234567890123456789012", titulo: "NB News", foto: "", handle: "NBNews" });
  const busca = `{"channelRenderer":{"channelId":"UC1234567890123456789012","title":{"simpleText":"Palco \\"Nacional\\""}}}`;
  assert.deepEqual(lerBuscaCanais(busca), [{ id: "UC1234567890123456789012", titulo: 'Palco "Nacional"' }]);
  assert.equal(lerPaginaVideo(`"lengthSeconds":"548"`).duracao, 548);
});

test("entende o que o usuário cola", () => {
  assert.deepEqual(interpretarEntrada("https://www.youtube.com/@FlowPodcast/videos"), { handle: "FlowPodcast" });
  assert.deepEqual(interpretarEntrada("https://www.youtube.com/channel/UC1234567890123456789012"), { id: "UC1234567890123456789012" });
  assert.deepEqual(interpretarEntrada("Palco Nacional"), { busca: "Palco Nacional" });
});

test("importa o histórico do Takeout (JSON e HTML) e inscrições", () => {
  const json = JSON.stringify([
    { header: "YouTube", title: "Assistiu a Debate sobre Lula", titleUrl: "https://www.youtube.com/watch?v=AAAAAAAAAAA", subtitles: [{ name: "NB News", url: "https://www.youtube.com/channel/UC1234567890123456789012" }], time: "2026-10-20T10:00:00Z" },
    { header: "YouTube Music", title: "Assistiu a música", titleUrl: "https://www.youtube.com/watch?v=CCCCCCCCCCC" },
  ]);
  const itens = lerTakeoutJson(json);
  assert.equal(itens.length, 1);
  assert.equal(itens[0].titulo, "Debate sobre Lula");
  assert.equal(itens[0].canal.id, "UC1234567890123456789012");

  const html = `Assistiu a <a href="https://www.youtube.com/watch?v=AAAAAAAAAAA">Vídeo A</a><br><a href="https://www.youtube.com/channel/UC1234567890123456789012">NB News</a><br>20 de out.`;
  assert.equal(lerTakeoutHtml(html)[0].canal.nome, "NB News");

  const csv = "ID do canal,URL do canal,Título do canal\nUC1234567890123456789012,http://www.youtube.com/channel/UC1234567890123456789012,NB News\n";
  assert.deepEqual(lerInscricoesCsv(csv), [{ id: "UC1234567890123456789012", nome: "NB News" }]);
});

test("favorito: separa inscrições de canais vistos", () => {
  const r = lerPagina({
    url: "https://www.youtube.com/feed/history",
    videos: [{ id: "AAAAAAAAAAA", titulo: "x", canalHref: "/@NBNews", canalNome: "NB News" }],
    canais: [{ href: "/@FlowPodcast", nome: "Flow", inscrito: true }],
  });
  assert.equal(r.ehHistorico, true);
  assert.equal(r.itens[0].canal.handle, "NBNews");
  assert.equal(r.canais[0].inscrito, true);
});

test("resume o histórico: canais mais vistos e assuntos", () => {
  const agora = Date.parse("2026-10-20T12:00:00Z");
  const itens = [1, 2, 3].map((i) => ({ video: "v" + i, titulo: `Nikolas e Lula no debate ${i}`, canal: { id: "UCa", nome: "A" }, quando: agora - i * 864e5 }));
  itens.push({ video: "v9", titulo: "outro assunto", canal: { id: "UCb", nome: "B" }, quando: agora });
  const r = resumirHistorico(itens, agora);
  assert.equal(r.canais[0].id, "UCa");
  assert.equal(r.canais[0].vezes, 3);
  assert.ok("nikolas" in r.termos && "lula" in r.termos && "debate" in r.termos);
  assert.equal(categoriaPeloNome("Cortes do Flow [OFICIAL]"), "cortes");
  assert.equal(categoriaPeloNome("Inteligência Ltda Podcast"), "podcasts");
});

test("etiquetas e ranking", () => {
  const canais = {
    UCa: { id: "UCa", categoria: "politica", origem: "historico", vezesNoHistorico: 30, peso: 0 },
    UCb: { id: "UCb", categoria: "podcasts", origem: "semelhante", peso: 0 },
    UCc: { id: "UCc", categoria: "noticias", origem: "semelhante", silenciado: true },
  };
  assert.deepEqual(etiquetas({ titulo: "Fulano x Ciclano", duracao: 600 }, canais.UCa).sort(), ["corte", "curto", "debate", "politica"]);
  // programa completo de TV x corte do mesmo canal
  const tv = { id: "UCt", categoria: "noticias" };
  assert.ok(etiquetas({ titulo: "OS PINGOS NOS IS - 21/10/26" }, tv).includes("programa"));
  assert.ok(etiquetas({ titulo: "Jornal da Oeste segunda edição", duracao: 6500 }, tv).includes("programa"));
  assert.ok(!etiquetas({ titulo: "Ministro rebate deputado ao vivo", duracao: 480 }, tv).includes("programa"));
  assert.ok(etiquetas({ titulo: "Ministro rebate deputado", duracao: 480 }, tv).includes("corte"));
  assert.ok(!etiquetas({ titulo: "Paulo Figueiredo Show - Ep. 324", duracao: 5600 }, { categoria: "politica" }).includes("programa"));
  assert.ok(etiquetas({ titulo: "Ep. 324", duracao: 5000 }, canais.UCb).includes("podcast"));

  const agora = Date.parse("2026-10-20T12:00:00Z");
  const v = (id, canal, horas, titulo = "vídeo") => ({ id, canal, titulo, publicado: new Date(agora - horas * 3600e3).toISOString(), views: 1000 });
  const lista = montarTimeline([v("1", "UCb", 1), v("2", "UCa", 1), v("3", "UCc", 0), v("4", "UCa", 200)], {
    canais, stats: {}, termos: {}, interesses: [], pesosCategoria: {}, agora,
  });
  assert.deepEqual(lista.map((x) => x.id), ["2", "1", "4"]); // canal do histórico primeiro; silenciado some; velho por último
  assert.match(lista[0].motivo, /30 vídeo/);

  const comInteresse = montarTimeline([v("1", "UCb", 1, "Nikolas fala"), v("2", "UCb", 1, "outro")], {
    canais, stats: {}, termos: {}, interesses: ["nikolas"], pesosCategoria: {}, agora,
  });
  assert.equal(comInteresse[0].id, "1");

  // programa completo despenca; vídeo exibido várias vezes sem clique também
  const ctxB = { canais: { ...canais, UCt: { id: "UCt", categoria: "noticias", origem: "historico" } }, stats: {}, agora };
  const [corte, programa] = [v("p1", "UCt", 1, "Ministro rebate"), v("p2", "UCt", 1, "Jornal da noite 20/10/2026")].map((x) => ({ ...x, duracao: x.id === "p1" ? 400 : 7000 }));
  assert.deepEqual(montarTimeline([programa, corte], ctxB).map((x) => x.id), ["p1", "p2"]);
  const cansado = montarTimeline([v("x1", "UCa", 1, "um"), v("x2", "UCa", 1, "dois")], { ...ctxB, exibicoes: { x1: { n: 3 } } });
  assert.equal(cansado[0].id, "x2");

  const bloqueado = montarTimeline([v("1", "UCa", 1, "BBB 26")], { canais, stats: {}, bloqueios: ["bbb"], agora });
  assert.equal(bloqueado.length, 0);
});

test("intercala canais repetidos", () => {
  const r = intercalar([{ canal: "a" }, { canal: "a" }, { canal: "a" }, { canal: "b" }, { canal: "c" }], 2);
  assert.deepEqual(r.map((x) => x.canal), ["a", "b", "c", "a", "a"]);
});

test("lê título, canal e data da página do vídeo", () => {
  const html = `..."videoDetails":{"videoId":"AAAAAAAAAAA","title":"Ele \\"destroys\\" o debate","lengthSeconds":"125","channelId":"UC1234567890123456789012","author":"Benny","viewCount":"999"},"publishDate":"2026-10-19T07:00:00-07:00"`;
  const d = lerPaginaVideo(html);
  assert.equal(d.titulo, 'Ele "destroys" o debate');
  assert.equal(d.canal, "UC1234567890123456789012");
  assert.equal(d.autor, "Benny");
  assert.equal(d.views, 999);
  assert.equal(d.duracao, 125);
  assert.equal(d.publicado, "2026-10-19T14:00:00.000Z");
});

test("feed: agrupa o mesmo assunto e não empilha tema nem canal", async () => {
  const { agrupar, diversificar } = await import("../public/ordenar.js");
  const agora = Date.parse("2026-10-20T12:00:00Z");
  const v = (id, canal, chaves, nota, extra = {}) => ({ id, canal, chaves, nota, publicado: new Date(agora - 3600e3).toISOString(), ...extra });
  const lista = [
    v("a", "c1", ["lula", "flavio", "debate", "globonews", "ajuste", "fiscal"], 10),
    v("b", "c2", ["lula", "flavio", "debatem", "ajuste", "fiscal"], 9),
    v("c", "c3", ["lula", "flavio", "ajuste", "fiscal", "corte"], 8),
    v("d", "c4", ["lula", "governo", "pesquisa"], 7),
    v("e", "c5", ["lula", "governo", "eleicao"], 6.9),
    v("f", "c6", ["lula", "governo", "stf"], 6.8),
    v("g", "c7", ["asmongold", "reage", "trump"], 5),
    v("h", "c8", ["podcast", "economia", "juros"], 4, { explorar: true }),
  ];
  const reps = agrupar(lista);
  assert.deepEqual(reps.find((r) => r.id === "a").similares.map((s) => s.id), ["b", "c"]);
  const ordem = diversificar(reps, { explorar: 3 }).map((x) => x.id);
  assert.equal(ordem[0], "a");
  // depois de três vídeos sobre "lula", algo de outro tema sobe
  assert.ok(ordem.indexOf("g") < ordem.indexOf("f"), ordem.join(","));
  assert.ok(ordem.includes("h"));
});

test("minutagem: descrição, legendas e resposta da IA", async () => {
  const { capitulosDaDescricao, arrayJson, linhasDeEventos } = await import("../lib/legendas.mjs");
  const { validarCapitulos, textoDaTranscricao, escolherModelo } = await import("../lib/ia.mjs");
  const desc = "Apoie o canal\n00:00 Abertura\n05:12 - Lula e o STF\n1:02:03 Perguntas do público\nlink";
  assert.deepEqual(capitulosDaDescricao(desc), [{ s: 0, t: "Abertura" }, { s: 312, t: "Lula e o STF" }, { s: 3723, t: "Perguntas do público" }]);
  assert.deepEqual(capitulosDaDescricao("só 01:00 no meio do texto"), []);
  const html = `x"captionTracks":[{"baseUrl":"https://a/b?x=1\\u0026y=[2]","languageCode":"pt","name":{"runs":[{"text":"Port"}]}}],"outro":1`;
  assert.equal(arrayJson(html, "captionTracks")[0].baseUrl, "https://a/b?x=1&y=[2]");
  const linhas = linhasDeEventos([{ tStartMs: 0, segs: [{ utf8: "oi" }] }, { tStartMs: 10000, segs: [{ utf8: "tudo bem" }] }, { tStartMs: 45000, segs: [{ utf8: "[Música]" }] }, { tStartMs: 61000, segs: [{ utf8: "outro tema" }] }]);
  assert.deepEqual(linhas, [{ s: 0, texto: "oi tudo bem" }, { s: 61, texto: "outro tema" }]);
  assert.match(textoDaTranscricao(linhas), /^\[00:00\] oi tudo bem\n\[01:01\] outro tema$/);
  const caps = validarCapitulos([{ inicio: "02:00", titulo: "B" }, { inicio: "00:10", titulo: "A" }, { inicio: "02:05", titulo: "quase igual" }, { inicio: "99:00", titulo: "depois do fim" }, { inicio: "x", titulo: "ruim" }], 1800);
  assert.deepEqual(caps, [{ s: 0, t: "A" }, { s: 120, t: "B" }]);
  assert.equal(escolherModelo(["llama3:8b", "qwen2.5:7b"], ""), "qwen2.5:7b");
  assert.equal(escolherModelo(["llama3:8b", "qwen2.5:7b"], "llama3:8b"), "llama3:8b");
});

test("em alta, assunto quente e gosto por formato", async () => {
  const { emAlta, reforcarQuentes } = await import("../public/ordenar.js");
  const { preferenciasDeFormato } = await import("../lib/ranking.mjs");
  const agora = Date.parse("2026-10-21T12:00:00Z");
  const v = (canal, chaves, horas = 2) => ({ canal, chaves, publicado: new Date(agora - horas * 3600e3).toISOString() });
  const lista = [v("a", ["stf", "lula"]), v("b", ["stf", "moraes"]), v("c", ["stf", "flow"]), v("d", ["lula"]), v("e", ["lula"], 100), v("flow", ["flow"]), v("x", ["flow"])];
  const alta = emAlta(lista, { agora, minCanais: 2, nomeDoCanal: (id) => (id === "flow" ? "cortes do flow" : "") });
  assert.deepEqual(alta.map((t) => t.termo), ["stf", "lula", "flow"]);
  assert.equal(alta.find((t) => t.termo === "flow").canais, 2); // o canal "Cortes do Flow" não conta para "flow"

  const r = reforcarQuentes([{ id: "1", nota: 1, similares: [] }, { id: "2", nota: 0.9, similares: [{}, {}, {}, {}] }]);
  assert.equal(r[0].id, "2");

  const vistos = Array.from({ length: 10 }, (_, i) => (i < 8 ? ["corte"] : ["podcast", "longo"]));
  const disp = Array.from({ length: 10 }, (_, i) => (i < 3 ? ["corte"] : ["podcast", "longo"]));
  const pref = preferenciasDeFormato(vistos, disp);
  assert.ok(pref.corte > 1.3 && pref.podcast < 0.8, JSON.stringify(pref));
  assert.deepEqual(preferenciasDeFormato(vistos.slice(0, 5), disp), {}); // poucos vistos: não mexe
});

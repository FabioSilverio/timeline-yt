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
  assert.deepEqual(etiquetas({ titulo: "Fulano x Ciclano", duracao: 600 }, canais.UCa).sort(), ["curto", "debate", "politica"]);
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

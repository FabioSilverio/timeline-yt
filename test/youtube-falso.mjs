// Pré-carregável (node --import ./test/youtube-falso.mjs server.mjs): troca o fetch por um
// YouTube de mentira, para testar e tirar prints sem acesso à rede.
const real = globalThis.fetch;
const TITULOS = [
  "NIKOLAS EXPÕE RELATOS DE NORDESTINOS CONTRA LULA: \"ENVELHECI OUVINDO\" | JBN",
  "Nikolas Ferreira DESMONTA jornalismo TENDENCIOSO e diz que acusação sobre a META é PAPO DE PERDEDOR",
  "COMO o PT VOLTOU a ENCHER MANIFESTAÇÕES AGORA? A RESPOSTA é bem SIMPLES",
  "DIREITA pode fazer ENTRE 17 e 19 GOVERNADORES dependendo do SEGUNDO TURNO",
  "Paulo Figueiredo Show - Ep. 324 - A Pior Semana da Vida do Lula",
  "DEBATE NA GLOBONEWS! COORDENADOR DE LULA E FLÁVIO DEBATEM AO VIVO SOBRE AJUSTE FISCAL",
  "Conversa Timeline - 20/10/2026",
  "Flow Podcast #812 - Economista x Deputado: o rombo das contas",
  "O CONFRONTO que ninguém esperava no Roda Viva",
  "Cortes: ele perdeu a paciência com o ministro",
];
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; }
function idCanal(nome) { return ("UC" + hash(nome).toString(36).padEnd(22, "x")).slice(0, 24); }
const nomes = new Map();
function rss(id) {
  const nome = nomes.get(id) || "Canal " + id.slice(2, 8);
  const h = hash(id);
  let entries = "";
  for (let i = 0; i < 6; i++) {
    const vid = (id.slice(2, 8) + i + "abcdefgh").slice(0, 11).replace(/[^\w-]/g, "a");
    const t = TITULOS[(h + i * 3) % TITULOS.length];
    const pub = new Date(Date.now() - (i * 7 + (h % 9)) * 3600e3).toISOString();
    const short = i === 5;
    entries += `<entry><id>yt:video:${vid}</id><yt:videoId>${vid}</yt:videoId><yt:channelId>${id}</yt:channelId><title>${t.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}</title><link rel="alternate" href="https://www.youtube.com/${short ? "shorts/" : "watch?v="}${vid}"/><author><name>${nome}</name></author><published>${pub}</published><updated>${pub}</updated><media:group><media:title>${t}</media:title><media:thumbnail url="https://i1.ytimg.com/vi/${vid}/hqdefault.jpg" width="480" height="360"/><media:description>Descrição do vídeo ${i} de ${nome}.</media:description><media:community><media:starRating count="10" average="5.00" min="1" max="5"/><media:statistics views="${(h % 90000) + i * 1234}"/></media:community></media:group></entry>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom"><link rel="self" href="x"/><id>yt:channel:${id.slice(2)}</id><yt:channelId>${id.slice(2)}</yt:channelId><title>${nome}</title><author><name>${nome}</name></author>${entries}</feed>`;
}
function pagCanal(id, nome) {
  return `<html><head><meta property="og:title" content="${nome}"><meta property="og:image" content=""><meta itemprop="identifier" content="${id}"></head><body>"canonicalBaseUrl":"/@${nome.replace(/\W+/g, "")}"</body></html>`;
}
globalThis.fetch = async (url, opts) => {
  const u = new URL(String(url));
  if (!u.hostname.endsWith("youtube.com")) return real(url, opts);
  await new Promise((r) => setTimeout(r, 20));
  const ok = (body) => new Response(body, { status: 200 });
  if (u.pathname === "/feeds/videos.xml") return ok(rss(u.searchParams.get("channel_id")));
  if (u.pathname === "/results") {
    const q = u.searchParams.get("search_query");
    const id = idCanal(q); nomes.set(id, q);
    return ok(`var ytInitialData = {"channelRenderer":{"channelId":"${id}","title":{"simpleText":"${q}"}}}`);
  }
  if (u.pathname.startsWith("/@")) {
    const h = decodeURIComponent(u.pathname.slice(2));
    if (h.toLowerCase().includes("baccinoticias")) return new Response("", { status: 404 });
    const id = idCanal(h); if (!nomes.has(id)) nomes.set(id, h);
    return ok(pagCanal(id, nomes.get(id)));
  }
  if (u.pathname.startsWith("/channel/")) { const id = u.pathname.split("/")[2]; return ok(pagCanal(id, nomes.get(id) || id)); }
  if (u.pathname === "/watch") {
    const v = u.searchParams.get("v");
    const canal = idCanal("Canal Externo " + (hash(v) % 3));
    nomes.set(canal, "Canal Externo " + (hash(v) % 3));
    return ok(`"videoDetails":{"videoId":"${v}","title":"Vídeo externo \\"${v}\\" sobre debate","lengthSeconds":"${(hash(v) % 5400) + 60}","channelId":"${canal}","author":"Canal Externo ${hash(v) % 3}","viewCount":"4321"},"publishDate":"${new Date(Date.now() - 3600e3).toISOString()}"`);
  }
  return new Response("", { status: 404 });
};

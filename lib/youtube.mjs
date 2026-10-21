// Tudo o que fala com o YouTube: feed RSS dos canais (sem chave de API), achar o ID de
// um canal a partir do @ ou do nome, e ler a duração de um vídeo na página dele.

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Cookie: "CONSENT=YES+cb; SOCS=CAI",
};

const ID_CANAL = /^UC[\w-]{22}$/;
const ID_VIDEO = /^[\w-]{11}$/;

export async function baixar(url, { timeout = 15000 } = {}) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(timeout), redirect: "follow" });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} em ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

export function decodificar(s = "") {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tag(xml, nome) {
  const m = xml.match(new RegExp(`<${nome}(?:\\s[^>]*)?>([\\s\\S]*?)</${nome}>`));
  return m ? decodificar(m[1].trim()) : "";
}

function atributo(xml, nome, attr) {
  const m = xml.match(new RegExp(`<${nome}\\s[^>]*?${attr}="([^"]*)"`));
  return m ? decodificar(m[1]) : "";
}

// Lê o Atom de https://www.youtube.com/feeds/videos.xml?channel_id=UC...
export function lerFeed(xml) {
  const cabeca = xml.split("<entry>")[0];
  const canal = {
    id: tag(cabeca, "yt:channelId"),
    titulo: tag(cabeca, "title"),
  };
  if (canal.id && !canal.id.startsWith("UC")) canal.id = "UC" + canal.id;
  const videos = [];
  for (const bloco of xml.split("<entry>").slice(1)) {
    const id = tag(bloco, "yt:videoId");
    if (!ID_VIDEO.test(id)) continue;
    const link = atributo(bloco, "link", "href");
    const views = Number(atributo(bloco, "media:statistics", "views")) || 0;
    videos.push({
      id,
      canal: tag(bloco, "yt:channelId") || canal.id,
      titulo: tag(bloco, "title"),
      publicado: tag(bloco, "published"),
      atualizado: tag(bloco, "updated"),
      views,
      descricao: tag(bloco, "media:description").slice(0, 400),
      short: link.includes("/shorts/"),
    });
  }
  return { canal, videos };
}

export async function feedDoCanal(id) {
  const xml = await baixar(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  return lerFeed(xml);
}

// Página do canal (/@handle ou /channel/UC...) → id, título, foto
export function lerPaginaCanal(html) {
  const id =
    html.match(/<meta itemprop="identifier" content="(UC[\w-]{22})"/)?.[1] ||
    html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ||
    html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/)?.[1] ||
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1];
  if (!id) return null;
  const titulo = decodificar(html.match(/<meta property="og:title" content="([^"]*)"/)?.[1] || "");
  const foto = decodificar(html.match(/<meta property="og:image" content="([^"]*)"/)?.[1] || "");
  const handle = html.match(/"canonicalBaseUrl":"\/@([^"]+)"/)?.[1] || "";
  return { id, titulo, foto, handle: handle ? decodeURIComponent(handle) : "" };
}

// Resultado de busca filtrado por canais → primeiro canal
export function lerBuscaCanais(html) {
  const out = [];
  const re = /"channelRenderer":\{"channelId":"(UC[\w-]{22})","title":\{"simpleText":"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(html))) out.push({ id: m[1], titulo: JSON.parse(`"${m[2]}"`) });
  return out;
}

function normalizar(s = "") {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Aceita: UC..., link /channel/UC..., link /@handle, @handle, ou um nome
export function interpretarEntrada(texto = "") {
  const t = texto.trim();
  const uc = t.match(/(UC[\w-]{22})/);
  if (uc) return { id: uc[1] };
  const h = t.match(/(?:youtube\.com\/)?@([\w.\-À-ÿ%]+)/);
  if (h) return { handle: decodeURIComponent(h[1]) };
  const c = t.match(/youtube\.com\/(?:c|user)\/([\w.-]+)/);
  if (c) return { caminho: c[0].replace(/^.*youtube\.com/, "") };
  return { busca: t };
}

export async function resolverCanal({ id, handle, caminho, busca }) {
  if (id && ID_CANAL.test(id)) {
    try {
      const info = lerPaginaCanal(await baixar(`https://www.youtube.com/channel/${id}`));
      if (info) return info;
    } catch {}
    return { id, titulo: "", foto: "", handle: "" };
  }
  const tentativas = [];
  if (handle) tentativas.push(`https://www.youtube.com/@${encodeURIComponent(handle)}`);
  if (caminho) tentativas.push(`https://www.youtube.com${caminho}`);
  for (const url of tentativas) {
    try {
      const info = lerPaginaCanal(await baixar(url));
      if (info) return info;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }
  if (busca) {
    const html = await baixar(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(busca)}&sp=EgIQAg%253D%253D`,
    );
    const achados = lerBuscaCanais(html);
    if (!achados.length) return null;
    const alvo = normalizar(busca);
    const melhor =
      achados.find((a) => normalizar(a.titulo) === alvo) ||
      achados.find((a) => normalizar(a.titulo).includes(alvo) || alvo.includes(normalizar(a.titulo))) ||
      achados[0];
    try {
      const info = lerPaginaCanal(await baixar(`https://www.youtube.com/channel/${melhor.id}`));
      if (info) return info;
    } catch {}
    return { id: melhor.id, titulo: melhor.titulo, foto: "", handle: "" };
  }
  return null;
}

function textoJson(trecho, chave) {
  const m = trecho.match(new RegExp(`"${chave}":"((?:[^"\\\\]|\\\\.)*)"`));
  if (!m) return "";
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return m[1];
  }
}

// Página do vídeo → duração, se é live, e (para vídeos vindos da extensão) título, canal, data e views
export function lerPaginaVideo(html) {
  const i = html.indexOf('"videoDetails":{');
  const det = i >= 0 ? html.slice(i, i + 20000) : "";
  const seg = Number(html.match(/"lengthSeconds":"(\d+)"/)?.[1]);
  const publicado = html.match(/"publishDate":"([^"]+)"/)?.[1] || html.match(/"uploadDate":"([^"]+)"/)?.[1] || "";
  return {
    duracao: Number.isFinite(seg) ? seg : null,
    aoVivo: /"isLiveNow":true/.test(html) || /"isLive":true/.test(html),
    agendado: /"isUpcoming":true/.test(html),
    titulo: textoJson(det, "title"),
    canal: det.match(/"channelId":"(UC[\w-]{22})"/)?.[1] || "",
    autor: textoJson(det, "author"),
    views: Number(det.match(/"viewCount":"(\d+)"/)?.[1]) || 0,
    publicado: publicado && !Number.isNaN(Date.parse(publicado)) ? new Date(publicado).toISOString() : "",
    short: /"isShortsEligible":true/.test(html) && Number.isFinite(seg) && seg <= 180,
  };
}

export async function detalhesDoVideo(id) {
  return lerPaginaVideo(await baixar(`https://www.youtube.com/watch?v=${id}&hl=pt`, { timeout: 20000 }));
}

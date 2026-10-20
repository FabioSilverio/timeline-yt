// Importação do histórico e das inscrições. Formatos aceitos:
// - Google Takeout: histórico/watch-history.json ou watch-history.html
// - Google Takeout: inscrições/subscriptions.csv
// - Favorito "Enviar para a timeline" rodado numa página do YouTube (histórico, inscrições, canal)

const UMA_SEMANA = 7 * 24 * 3600e3;

const STOP = new Set(
  `a o e de da do das dos em no na nos nas um uma uns umas para pra por com sem que se ao aos as os
  mais muito muita sobre como quando onde porque pois isso essa esse esta este isto aqui ali ja nao sim
  ele ela eles elas voce voces nos seu sua seus suas meu minha tem ter foi sao ser esta estao vai vao
  vamos fala falou diz disse ate depois antes agora hoje ontem novo nova video videos ao vivo live parte
  episodio ep podcast cortes corte oficial canal shorts short assista veja completo entrevista the of and to
  in is on for you with your what this that from contra entre apos tudo todos todas cada pelo pela pelos pelas`
    .split(/\s+/)
    .filter(Boolean),
);

export function semAcento(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function palavras(titulo = "") {
  return semAcento(titulo)
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d+$/.test(w));
}

function idDoVideo(url = "") {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] || url.match(/\/shorts\/([\w-]{11})/)?.[1] || null;
}

function canalDoLink(url = "") {
  const id = url.match(/\/channel\/(UC[\w-]{22})/)?.[1];
  if (id) return { id };
  const h = url.match(/\/@([^/?#]+)/)?.[1];
  if (h) return { handle: decodeURIComponent(h) };
  return null;
}

function limparTitulo(t = "") {
  return t.replace(/^(Assistiu a |Assistiu |Watched |Visto: )/, "").trim();
}

// Cada item: { video, titulo, canal: {id|handle, nome}, quando (ms|null) }
export function lerTakeoutJson(texto) {
  const lista = JSON.parse(texto);
  if (!Array.isArray(lista)) throw new Error("JSON não parece ser o watch-history do Takeout");
  const itens = [];
  for (const e of lista) {
    if (e.header && /music/i.test(e.header)) continue;
    const video = idDoVideo(e.titleUrl);
    const sub = e.subtitles?.[0];
    const canal = sub ? { ...canalDoLink(sub.url), nome: sub.name } : null;
    if (!video && !canal) continue;
    itens.push({ video, titulo: limparTitulo(e.title), canal, quando: e.time ? Date.parse(e.time) : null });
  }
  return itens;
}

export function lerTakeoutHtml(html) {
  const itens = [];
  const re =
    /<a href="(https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11})[^"]*">([\s\S]*?)<\/a>(?:<br>|\s)*(?:<a href="(https:\/\/www\.youtube\.com\/(?:channel\/UC[\w-]{22}|@[^"]+))">([\s\S]*?)<\/a>)?/g;
  let m;
  while ((m = re.exec(html))) {
    const canal = m[3] ? { ...canalDoLink(m[3]), nome: m[4].trim() } : null;
    itens.push({ video: idDoVideo(m[1]), titulo: m[2].trim(), canal, quando: null });
  }
  return itens;
}

// subscriptions.csv: "Channel Id,Channel Url,Channel Title" (ou o cabeçalho em português)
export function lerInscricoesCsv(texto) {
  const canais = [];
  for (const linha of texto.split(/\r?\n/).slice(1)) {
    const id = linha.match(/(UC[\w-]{22})/)?.[1];
    if (!id) continue;
    const partes = linha.split(",");
    canais.push({ id, nome: partes.slice(2).join(",").replace(/^"|"$/g, "").trim() });
  }
  return canais;
}

// Payload do favorito: { url, videos:[{id,titulo,canalHref,canalNome}], canais:[{href,nome}] }
export function lerPagina(payload) {
  const itens = [];
  const canais = [];
  for (const v of payload.videos || []) {
    const canal = v.canalHref ? { ...canalDoLink(v.canalHref), nome: v.canalNome || "" } : null;
    if (v.id) itens.push({ video: v.id, titulo: v.titulo || "", canal, quando: null });
  }
  for (const c of payload.canais || []) {
    const ref = canalDoLink(c.href || "");
    if (ref) canais.push({ ...ref, nome: c.nome || "", inscrito: !!c.inscrito });
  }
  return { itens, canais, ehHistorico: /\/feed\/history/.test(payload.url || "") };
}

// Conta quanto cada canal aparece (com peso maior para o que foi visto recentemente)
// e quais palavras se repetem nos títulos.
export function resumirHistorico(itens, agora = Date.now()) {
  const canais = new Map();
  const termos = new Map();
  for (const it of itens) {
    const idade = it.quando ? Math.max(0, agora - it.quando) : 0;
    const peso = it.quando ? Math.pow(0.5, idade / (13 * UMA_SEMANA)) : 1;
    if (it.canal && (it.canal.id || it.canal.handle)) {
      const chave = it.canal.id || "@" + it.canal.handle;
      const c = canais.get(chave) || { ...it.canal, vezes: 0, peso: 0, ultimo: 0 };
      c.vezes++;
      c.peso += peso;
      if (it.quando && it.quando > c.ultimo) c.ultimo = it.quando;
      if (!c.nome && it.canal.nome) c.nome = it.canal.nome;
      canais.set(chave, c);
    }
    for (const w of new Set(palavras(it.titulo))) termos.set(w, (termos.get(w) || 0) + peso);
  }
  const topoTermos = [...termos.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60);
  const max = topoTermos[0]?.[1] || 1;
  return {
    canais: [...canais.values()].sort((a, b) => b.peso - a.peso),
    termos: Object.fromEntries(topoTermos.map(([w, n]) => [w, Math.round((n / max) * 100) / 100])),
  };
}

export function categoriaPeloNome(nome = "") {
  const n = semAcento(nome);
  if (/\bcortes?\b|clips?\b/.test(n)) return "cortes";
  if (/podcast|cast\b|talks|flow|podpah|panico/.test(n)) return "podcasts";
  if (/news|noticias|jornal|tv\b|globo|cnn|band|record|sbt|metropoles|poder360|estadao|folha/.test(n)) return "noticias";
  if (/invest|econom|financ|primo|market|dinheiro/.test(n)) return "economia";
  if (/\b(the|show|daily|fox|america|usa)\b/.test(n)) return "eua";
  return "politica";
}

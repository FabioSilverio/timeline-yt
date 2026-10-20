// O "algoritmo" da timeline. Para cada vídeo:
//   nota = afinidade com o canal × frescor × peso da categoria × (1 + assuntos que você curte) × alcance
// e depois a lista é intercalada para não empilhar o mesmo canal.

import { palavras, semAcento } from "./historico.mjs";

const HORA = 3600e3;

const RE_DEBATE = /\bdebat|\bembate|\bconfronto|\bbate.?boca|\bversus\b|\bvs\.?\s|\s[x×]\s|\brebate|\bdesmonta|\btreta|\bdiscuss|\bacareação|\bduelo|\bdestroy|\bowns?\b|\bclash|\bconfront|\bgrill|\bheated|\bsurrounded|\bargu/i;
const RE_CORTE = /\bcortes?\b|#shorts|\bclips?\b|\btrecho\b|\bhighlights?\b/i;
const RE_PODCAST = /\bpodcast\b|\bepisode\b|\bep\.?\s?\d+|\bepis[oó]dio|#\d{2,}|\bflow\b.*#|\bpodpah\b/i;

export function etiquetas(video, canal) {
  const t = video.titulo || "";
  const cat = canal?.categoria || "geral";
  const tags = new Set();
  if (video.short) tags.add("short");
  if (cat === "cortes" || RE_CORTE.test(t) || (video.duracao && video.duracao <= 20 * 60 && cat === "podcasts")) tags.add("corte");
  if (cat === "debates" || RE_DEBATE.test(t)) tags.add("debate");
  if ((cat === "podcasts" && (!video.duracao || video.duracao > 40 * 60)) || RE_PODCAST.test(t)) tags.add("podcast");
  if (cat === "politica" || cat === "debates") tags.add("politica");
  if (cat === "noticias") tags.add("noticias");
  if (cat === "economia") tags.add("economia");
  if (cat === "eua") tags.add("eua").add("politica");
  if (video.aoVivo) tags.add("aovivo");
  if (video.duracao) {
    if (video.duracao <= 20 * 60) tags.add("curto");
    if (video.duracao >= 40 * 60) tags.add("longo");
  }
  return [...tags];
}

const BASE_ORIGEM = { historico: 1.25, inscricao: 1.1, manual: 1.1, semelhante: 0.75, contraponto: 0.6 };

export function afinidade(canal, stats = {}) {
  if (!canal) return 0.5;
  const s = stats[canal.id] || {};
  let a = BASE_ORIGEM[canal.origem] ?? 0.8;
  a += Math.log2(1 + (canal.vezesNoHistorico || 0)) * 0.35;
  a += Math.min(1.5, (s.vistos || 0) * 0.12 + (s.depois || 0) * 0.06);
  a -= Math.min(1, (s.ocultos || 0) * 0.15);
  a *= 1 + (canal.peso || 0) * 0.35; // ajuste manual de -2 a +3
  return Math.max(0.05, a);
}

function termosDoVideo(video) {
  return new Set(palavras(video.titulo));
}

export function pontuar(video, ctx) {
  const { canais, stats, termos = {}, interesses = [], pesosCategoria = {}, agora = Date.now() } = ctx;
  const canal = canais[video.canal];
  const idadeH = Math.max(0, (agora - Date.parse(video.publicado)) / HORA);
  const frescor = 0.03 + Math.pow(0.5, idadeH / 30);
  const tags = etiquetas(video, canal);
  const cat = canal?.categoria || "geral";
  let pesoCat = pesosCategoria[cat] ?? 1;
  if (tags.includes("debate")) pesoCat *= pesosCategoria.debatesExtra ?? 1.15;

  const ws = termosDoVideo(video);
  const tituloSemAcento = semAcento(video.titulo);
  const batidos = [];
  let assunto = 0;
  for (const w of ws) {
    if (termos[w]) {
      assunto += termos[w] * 0.12;
      batidos.push(w);
    }
  }
  for (const i of interesses) {
    if (i && tituloSemAcento.includes(semAcento(i))) {
      assunto += 0.35;
      batidos.push(i);
    }
  }
  assunto = Math.min(assunto, 0.9);

  const alcance = 1 + Math.min(0.35, Math.log10((video.views || 0) + 10) / 20);
  const af = afinidade(canal, stats);
  const nota = af * frescor * pesoCat * (1 + assunto) * alcance;

  return { nota, tags, motivo: motivo(canal, stats, batidos, idadeH) };
}

function motivo(canal, stats, batidos, idadeH) {
  const partes = [];
  if (canal?.vezesNoHistorico) partes.push(`você viu ${canal.vezesNoHistorico} vídeo(s) deste canal`);
  else if (stats?.[canal?.id]?.vistos) partes.push(`você marcou ${stats[canal.id].vistos} vídeo(s) deste canal`);
  else if (canal?.origem === "historico") partes.push("canal do seu histórico");
  else if (canal?.origem === "semelhante") partes.push("canal parecido com os que você assiste");
  else if (canal?.origem === "contraponto") partes.push("contraponto");
  else if (canal?.origem === "inscricao") partes.push("você é inscrito");
  if (batidos.length) partes.push(`fala de ${[...new Set(batidos)].slice(0, 3).join(", ")}`);
  if (idadeH < 3) partes.push("saiu agora");
  if (canal?.peso > 0) partes.push("canal com prioridade");
  return partes.join(" · ");
}

// Evita o mesmo canal em sequência: mantém a ordem da nota, mas empurra repetições
export function intercalar(lista, distancia = 3) {
  const resto = [...lista];
  const out = [];
  while (resto.length) {
    const recentes = new Set(out.slice(-distancia).map((v) => v.canal));
    let i = resto.findIndex((v) => !recentes.has(v.canal));
    if (i === -1 || i > 8) i = 0;
    out.push(resto.splice(i, 1)[0]);
  }
  return out;
}

export function montarTimeline(videos, ctx) {
  const bloqueios = (ctx.bloqueios || []).map(semAcento).filter(Boolean);
  const out = [];
  for (const v of videos) {
    const canal = ctx.canais[v.canal];
    if (!canal || canal.silenciado) continue;
    if (bloqueios.length && bloqueios.some((b) => semAcento(v.titulo).includes(b))) continue;
    const r = pontuar(v, ctx);
    out.push({ ...v, ...r });
  }
  out.sort((a, b) => b.nota - a.nota);
  return intercalar(out);
}

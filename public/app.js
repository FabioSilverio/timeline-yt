// Timeline — interface. O servidor manda tudo em /api/timeline (com a nota de cada vídeo);
// aqui as listas são filtradas, agrupadas por assunto e diversificadas (ordenar.js).

import { agrupar, diversificar } from "./ordenar.js";

// Se algo quebrar, mostra o erro na tela em vez de deixar a página vazia
function mostrarErro(msg) {
  const box = document.getElementById("lista");
  if (!box || box.dataset.erro) return;
  box.dataset.erro = "1";
  const el = document.createElement("div");
  el.className = "vazio";
  el.innerHTML = '<span class="emoji">⚠️</span><b>Algo deu errado ao montar a tela</b>';
  const p = document.createElement("p");
  p.textContent = `${msg} — recarregue a página (Ctrl+Shift+R). Se continuar, mande um print disto.`;
  el.append(p);
  box.replaceChildren(el);
}
addEventListener("error", (e) => mostrarErro(e.message));
addEventListener("unhandledrejection", (e) => mostrarErro(e.reason?.message || String(e.reason)));

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function h(tag, attrs = {}, ...filhos) {
  const svg = tag === "svg" || tag === "path";
  const el = svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.setAttribute("class", v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (!svg && k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f.nodeType ? f : String(f));
  return el;
}

const ICONES = {
  vi: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  fila: "M4 6h12v2H4zm0 5h12v2H4zm0 5h8v2H4zm14-2v-4h2v4h3v2h-3v4h-2v-4h-3v-2z",
  menos: "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
  tres: "M12 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  play: "M8 5v14l11-7z",
  desfazer: "M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62A7.95 7.95 0 0 1 12.5 10c3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 10.53 17.15 8 12.5 8z",
  grade: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
  linhas: "M3 4h18v4H3zm0 6h18v4H3zm0 6h18v4H3z",
  lixo: "M9 3h6l1 1h4v2H4V4h4zm-3 5h12l-1 13H7z",
  reler: "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  mudo: "M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9zM12 4 9.91 6.09 12 8.18z",
  som: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
};
const icone = (nome) => h("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" }, h("path", { d: ICONES[nome] }));

// ---------- estado ----------

let D = null;
const ui = {
  view: "agora",
  arg: null,
  filtro: "tudo",
  busca: "",
  layout: lerLocal("layout", "grade"),
  ordem: [], // ids na ordem da tela (estável entre cliques)
  chave: "", // muda quando a ordem precisa ser refeita
  lista: [],
  mostrados: 0,
  sel: -1,
};

function lerLocal(k, padrao) {
  try {
    return localStorage.getItem("tl_" + k) ?? padrao;
  } catch {
    return padrao;
  }
}
function gravarLocal(k, v) {
  try {
    localStorage.setItem("tl_" + k, v);
  } catch {}
}

async function api(rota, corpo) {
  const res = await fetch(rota, corpo === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  if (res.status === 401) {
    location.reload();
    throw new Error("sessão expirada");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.erro || `erro ${res.status}`);
  return json;
}

// ---------- formatação ----------

const fmtNum = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const fmtRel = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

function ha(iso) {
  const s = (Date.now() - (typeof iso === "number" ? iso : Date.parse(iso))) / 1000;
  if (s < 60) return "agora";
  for (const [lim, un, div] of [
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [604800, "day", 86400],
    [2629800, "week", 604800],
    [31557600, "month", 2629800],
    [Infinity, "year", 31557600],
  ])
    if (s < lim) return fmtRel.format(-Math.floor(s / div), un);
}

function duracao(seg) {
  if (!seg && seg !== 0) return "";
  const hh = Math.floor(seg / 3600);
  const mm = Math.floor((seg % 3600) / 60);
  const ss = String(Math.floor(seg % 60)).padStart(2, "0");
  return hh ? `${hh}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
}

function rotuloDia(ts) {
  const d = new Date(ts);
  const hoje = new Date();
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === new Date(Date.now() - 864e5).toDateString()) return "Ontem";
  if (Date.now() - ts < 6 * 864e5) return d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

const semAcento = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const miniatura = (id, hq) => `https://i.ytimg.com/vi/${id}/${hq ? "hqdefault" : "mqdefault"}.jpg`;
const linkYT = (id) => `https://www.youtube.com/watch?v=${id}`;
const porId = () => new Map(D.videos.map((v) => [v.id, v]));

// ---------- listas ----------

const FILTROS = [
  ["tudo", "Tudo"],
  ["corte", "Cortes"],
  ["debate", "Debates"],
  ["podcast", "Podcasts"],
  ["politica", "Política"],
  ["eua", "EUA"],
  ["noticias", "Notícias"],
  ["economia", "Economia"],
  ["aovivo", "Ao vivo"],
  null,
  ["curto", "Rápidos"],
  ["longo", "Longos"],
  ["novos", "Novos"],
];

const TITULOS = {
  agora: "Agora",
  recentes: "Recentes",
  fila: "Sua fila",
  continuar: "Continuar",
  historico: "Vistos",
  ocultos: "Ocultos",
  canais: "Canais",
  importar: "Importar histórico",
  ajustes: "Ajustes",
};
const APELIDOS = { inicio: "agora", depois: "fila" };

const ehNovo = (v) => (v.chegou || 0) > (D.visitaAnterior || 0) && Date.parse(v.publicado) > (D.visitaAnterior || 0) - 6 * 3600e3;

function passaFiltro(v, f) {
  if (f === "tudo") return true;
  if (f === "novos") return ehNovo(v);
  return v.tags.includes(f);
}

function passaBusca(v, q) {
  if (!q) return true;
  const c = D.canais[v.canal];
  return semAcento(`${v.titulo} ${c?.titulo || ""} ${v.descricao || ""}`).includes(q);
}

// O feed nunca mostra o que já foi visto, está na fila ou foi descartado
function noFeed(v) {
  if (D.vistos[v.id] || D.depois[v.id] || D.ocultos[v.id]) return false;
  if (v.short && D.ajustes.esconderShorts) return false;
  return true;
}

function montarLista() {
  const q = semAcento(ui.busca.trim());
  const ids = porId();
  const doMapa = (mapa, ordem = -1) =>
    Object.entries(mapa)
      .map(([id, ts]) => ({ v: ids.get(id), ts: typeof ts === "object" ? ts.ts : ts }))
      .filter((x) => x.v && passaBusca(x.v, q))
      .sort((a, b) => ordem * (a.ts - b.ts))
      .map((x) => ({ ...x.v, _ts: x.ts, similares: [] }));

  switch (ui.view) {
    case "agora": {
      const base = D.videos.filter((v) => noFeed(v) && passaFiltro(v, ui.filtro) && passaBusca(v, q));
      return diversificar(agrupar(base)); // D.videos já vem ordenado pela nota
    }
    case "recentes":
      return agrupar(
        D.videos.filter((v) => noFeed(v) && passaFiltro(v, ui.filtro) && passaBusca(v, q)).sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado)),
      );
    case "fila":
      return doMapa(D.depois, 1);
    case "continuar":
      return doMapa(D.progresso);
    case "historico":
      return doMapa(D.vistos);
    case "ocultos":
      return doMapa(D.ocultos);
    case "canal":
      return D.videos
        .filter((v) => v.canal === ui.arg && passaFiltro(v, ui.filtro) && passaBusca(v, q))
        .sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado))
        .map((v) => ({ ...v, similares: [] }));
  }
  return [];
}

// A ordem é refeita só quando a tela muda (filtro, busca, dados novos), não a cada clique,
// para os cards não pularem de lugar.
function listaAtual(forcar) {
  const chave = [ui.view, ui.arg, ui.filtro, ui.busca, D.geracao].join("|");
  if (forcar || chave !== ui.chave) {
    ui.chave = chave;
    ui.lista = montarLista();
    return ui.lista;
  }
  const atual = montarLista();
  const mapa = new Map(atual.map((v) => [v.id, v]));
  ui.lista = ui.lista.filter((v) => mapa.has(v.id)).map((v) => mapa.get(v.id) && { ...mapa.get(v.id), similares: v.similares.filter((s) => noFeed(s)), paraVariar: v.paraVariar });
  return ui.lista;
}

function agrupador() {
  if (ui.view === "historico") return (v) => rotuloDia(v._ts);
  if (ui.view === "recentes" || ui.view === "canal") return (v) => rotuloDia(Date.parse(v.publicado));
  return null;
}

// ---------- cards ----------

const ROT_TAG = { corte: "Corte", debate: "Debate", podcast: "Podcast", eua: "EUA", aovivo: "Ao vivo" };

function capa(v, hq) {
  const prog = D.progresso[v.id];
  const pct = prog ? Math.min(100, (prog.t / prog.d) * 100) : 0;
  const novo = ehNovo(v) && !D.vistos[v.id];
  return h(
    "div",
    { class: "capa", onclick: () => tocar(v.id) },
    h("img", { src: miniatura(v.id, hq), alt: "", loading: "lazy", onerror: (e) => (e.target.style.visibility = "hidden") }),
    h("div", { class: "play" }, h("span", {}, icone("play"))),
    h("div", { class: "selo-topo" }, novo && ui.view === "agora" ? h("span", { class: "novo" }, "Novo") : null, v.paraVariar ? h("span", { class: "variar" }, "Para variar") : null),
    v.aoVivo ? h("span", { class: "selo-tempo vivo" }, "AO VIVO") : v.duracao ? h("span", { class: "selo-tempo" }, duracao(v.duracao)) : v.short ? h("span", { class: "selo-tempo" }, "Short") : null,
    pct ? h("div", { class: "barra-prog" }, h("b", { style: `width:${pct}%` })) : null,
  );
}

function linhaCanal(v) {
  const c = D.canais[v.canal] || {};
  return h(
    "div",
    { class: "linha-canal" },
    c.foto ? h("img", { src: c.foto, alt: "", loading: "lazy" }) : h("span", { class: "sem-foto" }),
    h("a", { href: `#/canal/${v.canal}`, title: c.titulo }, c.titulo || "canal"),
    h("span", { class: "pontinho" }, "·"),
    h("span", {}, ha(v.publicado)),
    v.views ? [h("span", { class: "pontinho" }, "·"), h("span", {}, `${fmtNum.format(v.views)} views`)] : null,
  );
}

function textoPorque(v) {
  if (ui.view === "historico") return `visto ${ha(v._ts)}`;
  if (ui.view === "fila") return `na fila ${ha(v._ts)}`;
  if (ui.view === "continuar") return `parou em ${duracao(D.progresso[v.id]?.t)} de ${duracao(D.progresso[v.id]?.d)}`;
  if (v.paraVariar) return "para variar: canal que você ainda não explorou";
  return v.motivo || "";
}

function botaoAcao(classe, nomeIcone, rotulo, titulo, fn, ligado) {
  return h(
    "button",
    { class: `acao ${classe}${ligado ? " on" : ""}`, title: titulo, onclick: (e) => (e.stopPropagation(), fn()) },
    icone(nomeIcone),
    h("span", {}, rotulo),
  );
}

function acoesDo(v) {
  const id = v.id;
  const mais = h("button", { class: "acao mais-btn", title: "Mais opções", onclick: (e) => (e.stopPropagation(), abrirMenu(e.currentTarget, v)) }, icone("tres"));
  switch (ui.view) {
    case "fila":
      return [botaoAcao("vi", "vi", "Vi", "Já vi (v)", () => marcarVisto(id)), botaoAcao("menos", "desfazer", "Tirar", "Tirar da fila", () => tirarDaFila(id)), mais];
    case "historico":
      return [botaoAcao("vi on", "desfazer", "Não vi", "Desmarcar como visto", () => desmarcarVisto(id)), botaoAcao("fila", "fila", "Fila", "Pôr na fila", () => porNaFila(id), !!D.depois[id]), mais];
    case "ocultos":
      return [botaoAcao("vi", "desfazer", "Mostrar de novo", "Voltar para o feed", () => mostrarDeNovo(id)), mais];
    default:
      return [
        botaoAcao("vi", "vi", "Vi", "Já vi (v)", () => marcarVisto(id), !!D.vistos[id]),
        botaoAcao("fila", "fila", "Fila", "Assistir depois (f)", () => (D.depois[id] ? tirarDaFila(id) : porNaFila(id)), !!D.depois[id]),
        botaoAcao("menos", "menos", "Menos", "Menos disso (x)", () => menosDisso(id)),
        mais,
      ];
  }
}

function etiquetas(v) {
  const tags = v.tags.filter((t) => ROT_TAG[t] && !(t === "eua" && ui.filtro === "eua"));
  if (!tags.length) return null;
  return h("div", { class: "etiquetas" }, tags.map((t) => h("span", { class: `etq ${t}` }, ROT_TAG[t])));
}

function botaoSimilares(v) {
  const n = v.similares?.filter((s) => noFeed(s)).length;
  if (!n) return null;
  return h("button", { class: "mais-assunto", onclick: (e) => (e.stopPropagation(), abrirAssunto(v)) }, `+${n} sobre isso`);
}

function card(v, i) {
  const el = h(
    "article",
    { class: "card", tabIndex: -1, dataset: { id: v.id, i } },
    h("div", { class: "rastro dir" }, "⏱ Fila"),
    h("div", { class: "rastro esq" }, "Vi ✓"),
    capa(v),
    h(
      "div",
      { class: "corpo" },
      linhaCanal(v),
      h("h3", { title: v.titulo, onclick: () => tocar(v.id) }, v.titulo),
      textoPorque(v) ? h("div", { class: "porque" }, textoPorque(v)) : null,
      etiquetas(v),
      botaoSimilares(v),
    ),
    h("div", { class: "acoes" }, acoesDo(v)),
  );
  el.addEventListener("click", () => selecionar(i, false));
  if (["agora", "recentes", "canal"].includes(ui.view)) gestos(el, v.id);
  return el;
}

function destaque(v) {
  return h(
    "section",
    { class: "destaque", dataset: { id: v.id, i: 0 } },
    capa(v, true),
    h(
      "div",
      {},
      h("div", { class: "rotulo" }, v.paraVariar ? "Para variar" : "Sua melhor escolha agora"),
      linhaCanal(v),
      h("h2", { onclick: () => tocar(v.id) }, v.titulo),
      v.motivo ? h("div", { class: "porque" }, v.motivo) : null,
      h("div", { style: "margin-top:10px" }, etiquetas(v)),
      h(
        "div",
        { class: "acoes-grandes" },
        h("button", { class: "btn forte", onclick: () => tocar(v.id) }, icone("play"), "Assistir"),
        h("button", { class: "btn", onclick: () => porNaFila(v.id) }, icone("fila"), "Fila"),
        h("button", { class: "btn", onclick: () => marcarVisto(v.id) }, icone("vi"), "Já vi"),
        h("button", { class: "btn", onclick: () => menosDisso(v.id) }, icone("menos"), "Menos disso"),
        botaoSimilares(v),
      ),
    ),
  );
}

// Celular: arrastar para a direita põe na fila, para a esquerda marca como visto
function gestos(el, id) {
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let ativo = false;
  let decidido = false;
  el.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") return;
    x0 = e.clientX;
    y0 = e.clientY;
    dx = 0;
    ativo = true;
    decidido = false;
  });
  el.addEventListener("pointermove", (e) => {
    if (!ativo) return;
    const ddx = e.clientX - x0;
    const ddy = e.clientY - y0;
    if (!decidido) {
      if (Math.abs(ddy) > 12) return (ativo = false);
      if (Math.abs(ddx) < 12) return;
      decidido = true;
      el.classList.add("arrastando");
      el.setPointerCapture(e.pointerId);
    }
    dx = ddx;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
    $(".rastro.dir", el).style.opacity = dx > 0 ? Math.min(1, dx / 90) : 0;
    $(".rastro.esq", el).style.opacity = dx < 0 ? Math.min(1, -dx / 90) : 0;
  });
  const fim = () => {
    if (!ativo) return;
    ativo = false;
    el.classList.remove("arrastando");
    el.style.transform = "";
    $$(".rastro", el).forEach((r) => (r.style.opacity = 0));
    if (dx > 90) porNaFila(id, "dir");
    else if (dx < -90) marcarVisto(id, "esq");
    if (decidido) {
      const bloquear = (e) => (e.stopPropagation(), e.preventDefault());
      el.addEventListener("click", bloquear, { capture: true, once: true });
      setTimeout(() => el.removeEventListener("click", bloquear, { capture: true }), 50);
    }
  };
  el.addEventListener("pointerup", fim);
  el.addEventListener("pointercancel", fim);
}

// ---------- render ----------

const LOTE = 36;

function saudacao() {
  const hora = new Date().getHours();
  return hora < 5 ? "Boa madrugada" : hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
}

function renderCabeca() {
  const box = $("#cabeca");
  box.replaceChildren();
  const ferramentas = h("div", { class: "ferramentas" });
  const layout = h(
    "button",
    { class: "btn so-largo-btn", title: "Trocar visualização", onclick: () => ((ui.layout = ui.layout === "grade" ? "compacta" : "grade"), gravarLocal("layout", ui.layout), render()) },
    icone(ui.layout === "grade" ? "linhas" : "grade"),
    ui.layout === "grade" ? "Lista" : "Grade",
  );
  if (["agora", "recentes", "fila", "canal"].includes(ui.view)) {
    ferramentas.append(h("button", { class: "btn forte", onclick: tocarTudo }, icone("play"), ui.view === "fila" ? "Tocar a fila" : "Tocar em sequência"));
  }
  if (["agora", "recentes", "canal"].includes(ui.view)) {
    ferramentas.append(h("button", { class: "btn", onclick: marcarVisiveis, title: "Marcar como vistos os vídeos carregados na tela" }, icone("vi"), "Limpar tela"));
  }
  if (!["canais", "importar", "ajustes"].includes(ui.view)) ferramentas.append(layout);

  if (ui.view === "agora") {
    const novos = D.videos.filter((v) => ehNovo(v) && noFeed(v)).length;
    const fila = Object.keys(D.depois).length;
    box.append(
      h(
        "div",
        {},
        h("h1", {}, saudacao()),
        h("p", {}, h("b", {}, novos), novos === 1 ? " vídeo novo" : " vídeos novos", " desde a última visita · ", h("b", {}, fila), " na fila"),
      ),
      ferramentas,
    );
  } else if (ui.view === "canal") {
    const c = D.canais[ui.arg];
    if (!c) return box.append(h("h1", {}, "Canal"));
    box.append(
      h(
        "div",
        { class: "cabeca-canal" },
        c.foto ? h("img", { src: c.foto, alt: "" }) : h("span", { class: "sem-foto" }),
        h(
          "div",
          {},
          h("h1", {}, c.titulo),
          h("p", {}, [c.handle ? "@" + c.handle : null, D.categorias[c.categoria], origemTexto(c)].filter(Boolean).join(" · ")),
          h("div", { class: "linha-form", style: "margin-top:10px" }, controlesCanal(c), h("a", { class: "pilula", href: `https://www.youtube.com/channel/${c.id}`, target: "_blank", rel: "noopener" }, "YouTube ↗")),
        ),
      ),
      ferramentas,
    );
  } else {
    const sub = {
      recentes: "Tudo o que saiu, do mais novo para o mais antigo.",
      fila: "O que você guardou para assistir depois, na ordem em que guardou.",
      continuar: "Vídeos que você começou e não terminou.",
      historico: "O que você viu aqui e no YouTube (com a extensão).",
      ocultos: "Vídeos que você descartou.",
    }[ui.view];
    box.append(h("div", {}, h("h1", {}, TITULOS[ui.view] || ""), sub ? h("p", {}, sub) : null));
    if (ferramentas.childElementCount) box.append(ferramentas);
  }
}

function renderFiltros() {
  const box = $("#filtros");
  box.replaceChildren();
  if (!["agora", "recentes", "canal"].includes(ui.view)) return;
  const base = ui.view === "canal" ? D.videos.filter((v) => v.canal === ui.arg) : D.videos.filter(noFeed);
  for (const f of FILTROS) {
    if (!f) {
      box.append(h("span", { class: "pill-sep" }));
      continue;
    }
    const [k, rot] = f;
    const n = k === "tudo" ? 0 : base.filter((v) => passaFiltro(v, k)).length;
    if (k !== "tudo" && !n) continue;
    box.append(h("button", { class: `pill${ui.filtro === k ? " ativo" : ""}`, onclick: () => ((ui.filtro = ui.filtro === k ? "tudo" : k), render()) }, rot, n ? h("small", {}, n) : null));
  }
}

function render({ manter } = {}) {
  if (!D) return;
  for (const a of $$("[data-v]")) a.classList.toggle("ativo", a.dataset.v === ui.view || (ui.view === "ocultos" && a.dataset.v === "ajustes") || (ui.view === "importar" && a.dataset.v === "ajustes"));
  renderContadores();
  renderCabeca();
  renderFiltros();
  const lista = $("#lista");
  const dest = $("#destaque");
  lista.replaceChildren();
  dest.replaceChildren();

  if (["canais", "importar", "ajustes"].includes(ui.view)) {
    lista.className = "lista paginas";
    if (ui.view === "canais") return renderCanais();
    if (ui.view === "importar") return renderImportar();
    return renderAjustes();
  }
  lista.className = `lista${ui.layout === "compacta" ? " compacta" : ""}`;

  const antes = ui.mostrados;
  listaAtual();
  ui.mostrados = 0;
  if (!ui.lista.length) return lista.append(vazio());
  let inicio = 0;
  if (ui.view === "agora" && !ui.busca && ui.layout === "grade") {
    dest.append(destaque(ui.lista[0]));
    inicio = 1;
  }
  ui.inicio = inicio;
  ui.mostrados = inicio;
  maisItens(manter ? Math.max(antes, LOTE) : LOTE);
  observarExibicoes();
}

function maisItens(qtd = LOTE) {
  const lista = $("#lista");
  const grupo = agrupador();
  const ate = Math.min(ui.lista.length, ui.mostrados + qtd);
  let ultimo = ui.mostrados > ui.inicio ? grupo?.(ui.lista[ui.mostrados - 1]) : null;
  for (let i = ui.mostrados; i < ate; i++) {
    const v = ui.lista[i];
    if (grupo) {
      const g = grupo(v);
      if (g !== ultimo) lista.append(h("div", { class: "grupo-data" }, g));
      ultimo = g;
    }
    lista.append(card(v, i));
  }
  ui.mostrados = ate;
  observarExibicoes();
}

function vazio() {
  const msgs = {
    agora:
      D.status.rodando || !Object.keys(D.canais).length
        ? ["⏳", "Montando sua timeline…", "Lendo os canais. Na primeira vez leva alguns minutos."]
        : ui.busca || ui.filtro !== "tudo"
          ? ["🔎", "Nada com esse filtro", "Tente outro filtro ou limpe a busca."]
          : ["🎉", "Você zerou o feed", "Tudo visto ou guardado. Quando sair coisa nova, aparece aqui."],
    recentes: ["🕐", "Nada recente", "Atualize ou adicione canais."],
    fila: ["📥", "Fila vazia", "Use o botão Fila nos cards (ou a tecla f) para guardar vídeos."],
    continuar: ["▶️", "Nada pela metade", "Vídeos que você começar e não terminar aparecem aqui."],
    historico: ["✓", "Nenhum vídeo visto ainda", "Marque como visto ou assista até o fim."],
    ocultos: ["🙈", "Nenhum vídeo oculto", ""],
    canal: ["📺", "Sem vídeos deste canal", "O feed dele pode não ter sido lido ainda."],
  };
  const [e, t, s] = msgs[ui.view] || ["", "Nada aqui", ""];
  return h("div", { class: "vazio" }, h("span", { class: "emoji" }, e), h("b", {}, t), s);
}

function renderContadores() {
  $("#n-fila").textContent = Object.keys(D.depois).length || "";
  $("#n-continuar").textContent = Object.keys(D.progresso).length || "";
  const novos = D.videos.filter((v) => ehNovo(v) && noFeed(v)).length;
  document.title = novos ? `(${novos}) Timeline` : "Timeline";
  const s = D.status;
  $("#btn-atualizar").classList.toggle("girando", !!s.rodando);
  $("#status").textContent = s.rodando ? `atualizando… ${s.etapa || ""}` : s.ultima ? `atualizado ${ha(s.ultima)}` : "";
}

function origemTexto(c) {
  return (
    {
      historico: c.vezesNoHistorico ? `${c.vezesNoHistorico}× no seu histórico` : "do seu histórico",
      inscricao: "inscrição",
      manual: "adicionado por você",
      semelhante: "sugerido",
      contraponto: "contraponto",
    }[c.origem] || ""
  );
}

// ---------- ações ----------

function avisar(msg, desfazer, erro = false) {
  const el = h("div", { class: `aviso${erro ? " erro" : ""}` }, h("span", {}, msg), desfazer ? h("button", { onclick: () => (desfazer(), el.remove()) }, "Desfazer") : null);
  $("#avisos").append(el);
  while ($("#avisos").childElementCount > 3) $("#avisos").firstElementChild.remove();
  setTimeout(() => el.remove(), desfazer ? 6000 : 3500);
}

async function enviarAcao(tipo, id, extra = {}) {
  try {
    await api("/api/acao", { tipo, id, ...extra });
  } catch (e) {
    avisar("Não salvou: " + e.message, null, true);
  }
}

// Tira o card da tela com animação e redesenha mantendo a posição
function sair(id, direcao) {
  const els = $$(`[data-id="${id}"]`);
  if (!els.length) return render({ manter: true });
  els.forEach((el) => el.classList.add(direcao === "dir" ? "saindo-dir" : direcao === "esq" ? "saindo-esq" : "saindo"));
  setTimeout(() => render({ manter: true }), 230);
}

function marcarVisto(id, direcao) {
  const antes = { depois: D.depois[id], prog: D.progresso[id] };
  D.vistos[id] = Date.now();
  delete D.depois[id];
  delete D.progresso[id];
  enviarAcao("visto", id);
  sair(id, direcao);
  avisar("Marcado como visto", () => {
    delete D.vistos[id];
    enviarAcao("nao-visto", id);
    if (antes.depois) (D.depois[id] = antes.depois), enviarAcao("depois", id);
    if (antes.prog) D.progresso[id] = antes.prog;
    render({ manter: true });
  });
}

function desmarcarVisto(id) {
  delete D.vistos[id];
  enviarAcao("nao-visto", id);
  sair(id);
  avisar("Voltou para o feed", () => ((D.vistos[id] = Date.now()), enviarAcao("visto", id), render({ manter: true })));
}

function porNaFila(id, direcao) {
  D.depois[id] = Date.now();
  enviarAcao("depois", id);
  if (ui.view === "historico") render({ manter: true });
  else sair(id, direcao);
  avisar("Guardado na fila", () => (delete D.depois[id], enviarAcao("tirar-depois", id), render({ manter: true })));
}

function tirarDaFila(id) {
  const ts = D.depois[id];
  delete D.depois[id];
  enviarAcao("tirar-depois", id);
  sair(id);
  avisar("Saiu da fila", () => ((D.depois[id] = ts), enviarAcao("depois", id), render({ manter: true })));
}

async function menosDisso(id) {
  D.ocultos[id] = Date.now();
  delete D.depois[id];
  sair(id);
  try {
    await api("/api/sinal", { tipo: "menos", id });
  } catch (e) {
    return avisar(e.message, null, true);
  }
  avisar("Entendido: menos disso", () => (delete D.ocultos[id], enviarAcao("mostrar", id), render({ manter: true })));
}

function mostrarDeNovo(id) {
  delete D.ocultos[id];
  enviarAcao("mostrar", id);
  sair(id);
}

async function maisDisso(id) {
  try {
    await api("/api/sinal", { tipo: "mais", id });
    avisar("Entendido: mais disso");
  } catch (e) {
    avisar(e.message, null, true);
  }
}

async function editarCanal(id, mudancas, msg) {
  Object.assign(D.canais[id], mudancas);
  try {
    await api("/api/canal", { acao: "editar", id, ...mudancas });
    if (msg) avisar(msg);
    await carregar(true);
  } catch (e) {
    avisar(e.message, null, true);
  }
}

function marcarVisiveis() {
  const alvo = ui.lista.slice(0, ui.mostrados).filter((v) => !D.vistos[v.id]);
  if (!alvo.length || !confirm(`Marcar ${alvo.length} vídeos como vistos?`)) return;
  for (const v of alvo) D.vistos[v.id] = Date.now();
  api("/api/acao", { lote: alvo.map((v) => ({ tipo: "visto", id: v.id })) }).catch((e) => avisar(e.message, null, true));
  avisar(`${alvo.length} vídeos marcados`, () => {
    for (const v of alvo) delete D.vistos[v.id];
    api("/api/acao", { lote: alvo.map((v) => ({ tipo: "nao-visto", id: v.id })) });
    render();
  });
  render();
}

function abrirMenu(alvo, v) {
  const menu = $("#menu");
  const c = D.canais[v.canal] || {};
  const item = (texto, fn) => h("button", { onclick: () => (fecharMenu(), fn()) }, texto);
  menu.replaceChildren(
    item("👍 Mais disso", () => maisDisso(v.id)),
    D.ocultos[v.id] ? item("Mostrar de novo", () => mostrarDeNovo(v.id)) : item("👎 Menos disso", () => menosDisso(v.id)),
    v.similares?.length ? item(`Ver os ${v.similares.length + 1} vídeos sobre isso`, () => abrirAssunto(v)) : null,
    h("hr"),
    h("a", { href: linkYT(v.id), target: "_blank", rel: "noopener", onclick: fecharMenu }, "Abrir no YouTube ↗"),
    item("Copiar link", () => navigator.clipboard?.writeText(linkYT(v.id)).then(() => avisar("Link copiado"))),
    h("a", { href: `#/canal/${v.canal}`, onclick: fecharMenu }, `Ir para ${c.titulo || "o canal"}`),
    h("hr"),
    item("Mais vídeos deste canal", () => editarCanal(v.canal, { peso: Math.min(3, (c.peso || 0) + 1) }, `${c.titulo} vai aparecer mais`)),
    item("Menos vídeos deste canal", () => editarCanal(v.canal, { peso: Math.max(-2, (c.peso || 0) - 1) }, `${c.titulo} vai aparecer menos`)),
    item("Silenciar canal", () => editarCanal(v.canal, { silenciado: true }, `${c.titulo} silenciado`)),
  );
  menu.hidden = false;
  const r = alvo.getBoundingClientRect();
  const w = menu.offsetWidth;
  const hh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
  menu.style.top = (r.bottom + hh > innerHeight - 8 ? Math.max(8, r.top - hh) : r.bottom + 4) + "px";
}
function fecharMenu() {
  $("#menu").hidden = true;
}
document.addEventListener("click", (e) => {
  if (!$("#menu").hidden && !e.target.closest("#menu") && !e.target.closest(".mais-btn")) fecharMenu();
});

// Todos os vídeos sobre o mesmo assunto, numa folha por cima
function abrirAssunto(v) {
  const todos = [v, ...(v.similares || [])].filter((x) => noFeed(x) || x.id === v.id);
  const corpo = $("#folha-corpo");
  $("#folha-titulo").textContent = `${todos.length} vídeos sobre isso`;
  const desenhar = () => {
    const vivos = todos.filter((x) => noFeed(x));
    if (!vivos.length) return fecharFolha();
    corpo.replaceChildren(
      h(
        "div",
        { class: "atalhos-pagina" },
        h("button", { class: "btn forte", onclick: () => (fecharFolha(), tocar(vivos[0].id, vivos)) }, icone("play"), "Tocar todos"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              for (const x of vivos) D.vistos[x.id] = Date.now();
              api("/api/acao", { lote: vivos.map((x) => ({ tipo: "visto", id: x.id })) });
              fecharFolha();
              render({ manter: true });
              avisar(`${vivos.length} vídeos marcados como vistos`);
            },
          },
          icone("vi"),
          "Já vi esse assunto",
        ),
      ),
      h(
        "div",
        { class: "lista" },
        vivos.map((x) =>
          h(
            "article",
            { class: "card", dataset: { id: x.id } },
            capa(x),
            h("div", { class: "corpo" }, linhaCanal(x), h("h3", { onclick: () => (fecharFolha(), tocar(x.id, vivos)) }, x.titulo)),
            h(
              "div",
              { class: "acoes" },
              botaoAcao("vi", "vi", "Vi", "Já vi", () => ((D.vistos[x.id] = Date.now()), enviarAcao("visto", x.id), desenhar(), render({ manter: true }))),
              botaoAcao("fila", "fila", "Fila", "Fila", () => ((D.depois[x.id] = Date.now()), enviarAcao("depois", x.id), desenhar(), render({ manter: true }))),
            ),
          ),
        ),
      ),
    );
  };
  desenhar();
  $("#folha").hidden = false;
}
function fecharFolha() {
  $("#folha").hidden = true;
}
$("#folha-fechar").onclick = fecharFolha;
$("#folha").addEventListener("click", (e) => e.target.id === "folha" && fecharFolha());

// Exibições: o que ficou 1,5 s na tela e você não tocou perde força nas próximas vezes
const exibidos = new Set();
const filaExibidos = [];
let observador = null;
function observarExibicoes() {
  if (ui.view !== "agora") return;
  observador ||= new IntersectionObserver(
    (ents) => {
      for (const e of ents) {
        const id = e.target.dataset.id;
        if (e.isIntersecting) e.target._t = setTimeout(() => !exibidos.has(id) && (exibidos.add(id), filaExibidos.push(id)), 1500);
        else clearTimeout(e.target._t);
      }
    },
    { threshold: 0.6 },
  );
  for (const el of $$("#palco [data-id]")) if (!el._observado) (el._observado = true), observador.observe(el);
}
setInterval(() => {
  if (!filaExibidos.length) return;
  const lote = filaExibidos.splice(0).map((id) => ({ tipo: "exibido", id }));
  api("/api/acao", { lote }).catch(() => {});
}, 15000);

// ---------- player ----------

let ytApi = null;
function carregarApiYT() {
  if (ytApi) return ytApi;
  ytApi = new Promise((ok) => {
    window.onYouTubeIframeAPIReady = () => ok(window.YT);
    document.head.append(h("script", { src: "https://www.youtube.com/iframe_api" }));
  });
  return ytApi;
}

const P = { player: null, id: null, fila: [], timer: null, ultimoEnvio: 0 };

function tocarTudo() {
  const lista = ui.lista.filter((v) => !D.vistos[v.id]);
  if (lista.length) tocar(lista[0].id, lista);
}

async function tocar(id, fila) {
  const v = D.videos.find((x) => x.id === id);
  if (!v) return;
  P.fila = (fila || ui.lista).map((x) => x.id);
  if (!P.fila.includes(id)) P.fila.unshift(id);
  P.id = id;
  $("#player").hidden = false;
  $("#player").scrollTo(0, 0);
  document.body.style.overflow = "hidden";
  preencherPlayer(v);
  const YT = await carregarApiYT();
  const inicio = D.progresso[id] && D.progresso[id].t < D.progresso[id].d - 20 ? D.progresso[id].t : 0;
  if (P.player?.loadVideoById) {
    P.player.loadVideoById({ videoId: id, startSeconds: inicio });
  } else {
    $("#yt-alvo").replaceWith(h("div", { id: "yt-alvo" }));
    P.player = new YT.Player("yt-alvo", {
      videoId: id,
      playerVars: { autoplay: 1, start: Math.floor(inicio), rel: 0, playsinline: 1, origin: location.origin },
      events: {
        onReady: (e) => {
          e.target.setPlaybackRate(D.ajustes.velocidade || 1);
          e.target.playVideo();
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) terminou();
          if (e.data === YT.PlayerState.PLAYING) P.player.setPlaybackRate(D.ajustes.velocidade || 1);
        },
      },
    });
  }
  clearInterval(P.timer);
  P.timer = setInterval(salvarProgresso, 5000);
}

function preencherPlayer(v) {
  const c = D.canais[v.canal] || {};
  $("#pl-titulo").textContent = v.titulo;
  $("#pl-canal").textContent = c.titulo || "";
  $("#pl-canal").href = `#/canal/${v.canal}`;
  $("#pl-meta").textContent = [v.views ? `· ${fmtNum.format(v.views)} views` : null, `· ${ha(v.publicado)}`, v.duracao ? `· ${duracao(v.duracao)}` : null].filter(Boolean).join(" ");
  $("#pl-yt").href = linkYT(v.id);
  $("#pl-depois").textContent = D.depois[v.id] ? "⏱ Na fila" : "⏱ Fila";
  $("#pl-vel").replaceChildren(
    ...[1, 1.25, 1.5, 1.75, 2].map((x) =>
      h(
        "button",
        {
          class: (D.ajustes.velocidade || 1) === x ? "ativo" : "",
          onclick: () => {
            D.ajustes.velocidade = x;
            P.player?.setPlaybackRate?.(x);
            api("/api/ajustes", { ajustes: { velocidade: x } }).catch(() => {});
            preencherPlayer(v);
          },
        },
        `${x}x`,
      ),
    ),
  );
  const prox = proximos(10);
  $("#pl-fila").replaceChildren(
    ...prox.map((p) =>
      h(
        "div",
        { class: "pl-item", onclick: () => tocar(p.id, P.fila.map((id) => ({ id }))) },
        h("div", { class: "capa" }, h("img", { src: miniatura(p.id), alt: "", loading: "lazy" }), p.duracao ? h("span", { class: "selo-tempo" }, duracao(p.duracao)) : null),
        h("div", {}, h("b", {}, p.titulo), h("small", {}, `${D.canais[p.canal]?.titulo || ""} · ${ha(p.publicado)}`)),
      ),
    ),
  );
  if (!prox.length) $("#pl-fila").append(h("p", { class: "pl-meta" }, "Fim da lista."));
}

function proximos(n) {
  const i = P.fila.indexOf(P.id);
  const out = [];
  for (let j = i + 1; j < P.fila.length && out.length < n; j++) {
    const v = D.videos.find((x) => x.id === P.fila[j]);
    if (v && !D.vistos[v.id] && !D.ocultos[v.id]) out.push(v);
  }
  return out;
}

function salvarProgresso(forcar) {
  const pl = P.player;
  if (!pl?.getCurrentTime || !P.id) return;
  const t = pl.getCurrentTime();
  const d = pl.getDuration();
  if (!d) return;
  if (t >= 15) D.progresso[P.id] = { t, d, ts: Date.now() };
  if (forcar || Date.now() - P.ultimoEnvio > 15000) {
    P.ultimoEnvio = Date.now();
    enviarAcao("progresso", P.id, { t, d });
  }
  return { t, d };
}

function vistoSilencioso(id) {
  if (D.vistos[id]) return;
  D.vistos[id] = Date.now();
  delete D.depois[id];
  delete D.progresso[id];
  enviarAcao("visto", id);
}

function terminou() {
  if (D.ajustes.marcarAoTerminar) vistoSilencioso(P.id);
  if (D.ajustes.autoplay) proximo();
}

function proximo() {
  const [p] = proximos(1);
  if (p) tocar(p.id, P.fila.map((id) => ({ id })));
  else fecharPlayer();
}

function fecharPlayer() {
  const r = salvarProgresso(true);
  if (r && r.d && r.t / r.d > 0.92) vistoSilencioso(P.id);
  clearInterval(P.timer);
  P.player?.stopVideo?.();
  $("#player").hidden = true;
  document.body.style.overflow = "";
  P.id = null;
  render({ manter: true });
}

$("#pl-fechar").onclick = fecharPlayer;
$("#pl-visto-prox").onclick = () => {
  vistoSilencioso(P.id);
  proximo();
};
$("#pl-depois").onclick = () => {
  if (D.depois[P.id]) delete D.depois[P.id], enviarAcao("tirar-depois", P.id);
  else (D.depois[P.id] = Date.now()), enviarAcao("depois", P.id);
  preencherPlayer(D.videos.find((x) => x.id === P.id));
};
$("#pl-menos").onclick = () => {
  const id = P.id;
  D.ocultos[id] = Date.now();
  api("/api/sinal", { tipo: "menos", id }).catch(() => {});
  avisar("Entendido: menos disso");
  proximo();
};

// ---------- páginas de gestão ----------

function seletorCategoria(valor, onchange) {
  return h("select", { onchange: (e) => onchange(e.target.value) }, ...Object.entries(D.categorias).map(([k, rot]) => h("option", { value: k, selected: k === valor }, rot)));
}

function controlesCanal(c) {
  return [
    seletorCategoria(c.categoria, (cat) => editarCanal(c.id, { categoria: cat }, "Categoria alterada")),
    h(
      "label",
      { class: "peso", title: "Prioridade na timeline" },
      "menos",
      h("input", { type: "range", min: -2, max: 3, step: 1, value: c.peso || 0, onchange: (e) => editarCanal(c.id, { peso: Number(e.target.value) }) }),
      "mais",
    ),
  ];
}

function renderCanais() {
  const box = $("#lista");
  let categoria = "politica";
  const entrada = h("input", { class: "campo", placeholder: "Link do canal, @handle ou nome (ex.: @FlowPodcast)" });
  const adicionar = async (e) => {
    e.preventDefault();
    if (!entrada.value.trim()) return;
    const btn = e.submitter || $("button", e.target);
    btn.disabled = true;
    btn.textContent = "Procurando…";
    try {
      const r = await api("/api/canal", { acao: "adicionar", texto: entrada.value, categoria });
      avisar(`${r.canal.titulo} adicionado`);
      entrada.value = "";
      await carregar(true);
    } catch (err) {
      avisar(err.message, null, true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Adicionar";
    }
  };
  box.append(
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "Adicionar canal"),
      h("p", {}, "Cole o link de qualquer canal do YouTube. Ele entra na timeline na hora."),
      h("form", { class: "linha-form", onsubmit: adicionar }, entrada, seletorCategoria(categoria, (v) => (categoria = v)), h("button", { class: "pilula forte" }, "Adicionar")),
    ),
  );

  if (D.pendentes.length) {
    box.append(h("div", { class: "sub-titulo" }, `Por achar (${D.pendentes.length})`));
    const tab = h("div", { class: "tabela-canais" });
    for (const p of D.pendentes) {
      const corr = h("input", { class: "campo", placeholder: "cole o link certo do canal" });
      tab.append(
        h(
          "div",
          { class: "canal-linha" },
          h("span", { class: "sem-foto" }),
          h("div", { class: "nome" }, h("b", {}, p.nome || p.handle || p.id), h("small", { class: p.erro ? "erro" : "" }, p.erro ? `${p.erro} (tentativa ${p.tentativas})` : "aguardando")),
          h(
            "form",
            {
              class: "linha-form",
              style: "grid-column: span 2",
              onsubmit: async (e) => {
                e.preventDefault();
                try {
                  await api("/api/pendente", { acao: "corrigir", chave: p.chave, texto: corr.value });
                  avisar("Canal encontrado");
                  carregar(true);
                } catch (err) {
                  avisar(err.message, null, true);
                }
              },
            },
            corr,
          ),
          h("div", { class: "botoes-mini" }, h("button", { title: "Descartar", onclick: async () => (await api("/api/pendente", { acao: "remover", chave: p.chave }), carregar(true)) }, icone("lixo"))),
        ),
      );
    }
    box.append(tab);
  }

  const q = semAcento(ui.busca.trim());
  const porCat = {};
  for (const c of Object.values(D.canais)) {
    if (q && !semAcento(`${c.titulo} ${c.handle}`).includes(q)) continue;
    (porCat[c.categoria] ||= []).push(c);
  }
  for (const [cat, rot] of Object.entries(D.categorias)) {
    const lista = (porCat[cat] || []).sort((a, b) => (b.vezesNoHistorico || 0) - (a.vezesNoHistorico || 0) || (a.titulo || "").localeCompare(b.titulo || ""));
    if (!lista.length) continue;
    box.append(h("div", { class: "sub-titulo" }, `${rot} (${lista.length})`));
    const tab = h("div", { class: "tabela-canais" });
    for (const c of lista) {
      tab.append(
        h(
          "div",
          { class: `canal-linha${c.silenciado ? " mudo" : ""}` },
          c.foto ? h("img", { src: c.foto, alt: "", loading: "lazy" }) : h("span", { class: "sem-foto" }),
          h(
            "a",
            { class: "nome", href: `#/canal/${c.id}` },
            h("b", {}, c.titulo || c.id),
            h("small", { class: c.erro ? "erro" : "" }, c.erro ? `erro: ${c.erro}` : [c.handle ? "@" + c.handle : null, origemTexto(c)].filter(Boolean).join(" · ")),
          ),
          ...controlesCanal(c),
          h(
            "div",
            { class: "botoes-mini" },
            h("button", { title: c.silenciado ? "Ligar" : "Silenciar", onclick: () => editarCanal(c.id, { silenciado: !c.silenciado }) }, icone(c.silenciado ? "mudo" : "som")),
            h("button", { title: "Ler o feed agora", onclick: async () => (await api("/api/canal", { acao: "reler", id: c.id }), avisar("Feed relido"), carregar(true)) }, icone("reler")),
            h(
              "button",
              {
                title: "Remover",
                onclick: async () => {
                  if (!confirm(`Remover ${c.titulo}?`)) return;
                  await api("/api/canal", { acao: "remover", id: c.id });
                  carregar(true);
                },
              },
              icone("lixo"),
            ),
          ),
        ),
      );
    }
    box.append(tab);
  }
}

function codigoFavorito() {
  const A = location.origin;
  const js = `(()=>{const A=${JSON.stringify(A)};const V=[],C=[],S=new Set(),K=new Set();const box=a=>a.closest('ytd-video-renderer,ytd-rich-item-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,ytd-playlist-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer,ytm-shorts-lockup-view-model')||a.parentElement&&a.parentElement.parentElement;document.querySelectorAll('a[href*="/watch?v="],a[href^="/shorts/"]').forEach(a=>{const m=a.href.match(/(?:v=|shorts\\/)([\\w-]{11})/);if(!m||S.has(m[1]))return;const b=box(a);const te=b&&b.querySelector('#video-title,h3,[title]');const t=((te&&(te.textContent||te.title))||a.title||a.textContent||'').trim();if(!t)return;S.add(m[1]);const c=b&&b.querySelector('a[href^="/@"],a[href^="/channel/"]');V.push({id:m[1],titulo:t.slice(0,200),canalHref:c?c.getAttribute('href'):'',canalNome:c?c.textContent.trim():''})});const P=location.pathname;const todas=P.startsWith('/feed/channels');document.querySelectorAll('a[href^="/@"],a[href^="/channel/"]').forEach(a=>{const g=a.closest('ytd-guide-renderer,ytd-mini-guide-renderer,tp-yt-app-drawer');if(!g&&!todas)return;const hr=a.getAttribute('href').split(/[?#]/)[0].replace(/\\/(videos|shorts|streams|featured|about|playlists)$/,'');if(K.has(hr))return;const n=(a.textContent||a.title||'').trim();if(!n)return;K.add(hr);C.push({href:hr,nome:n.slice(0,100),inscrito:true})});const D={url:location.href,videos:V,canais:C};try{navigator.clipboard.writeText(JSON.stringify(D))}catch(e){}const w=window.open(A+'/importar-pagina','timelineyt');let n=0;const i=setInterval(()=>{n++;try{w.postMessage({timelineyt:D},A)}catch(e){}if(n>60)clearInterval(i)},500);addEventListener('message',e=>{if(e.origin===A&&e.data==='timelineyt-ok')clearInterval(i)});document.title='✓ '+V.length+' vídeos enviados · '+document.title})()`;
  return "javascript:" + encodeURIComponent(js);
}

function renderImportar() {
  const box = $("#lista");
  const arquivo = h("input", { type: "file", accept: ".json,.html,.csv", multiple: true });
  const colado = h("textarea", { placeholder: "Cole aqui o que o favorito copiou (se a janela não abriu sozinha), ou o conteúdo de um arquivo do Takeout." });
  const resultado = h("p", { class: "motivo" });

  const mandar = async (tipo, conteudo) => {
    resultado.textContent = "Importando…";
    try {
      const r = await api("/api/importar", { tipo, conteudo });
      resultado.textContent = `${r.itens} vídeos lidos · ${r.canais} canais considerados · ${r.novos} canais novos.${r.termos?.length ? " Assuntos: " + r.termos.join(", ") : ""}`;
      avisar("Histórico importado. Atualizando a timeline…");
      carregar(true);
    } catch (e) {
      resultado.textContent = "";
      avisar(e.message, null, true);
    }
  };

  arquivo.onchange = async () => {
    for (const f of arquivo.files) {
      const txt = await f.text();
      const tipo = f.name.endsWith(".csv") ? "inscricoes-csv" : f.name.endsWith(".html") ? "takeout-html" : "takeout-json";
      await mandar(tipo, txt);
    }
  };

  box.append(
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "Extensão do Chrome (recomendado)"),
      h("p", {}, "Com ela, o que você assiste no YouTube entra sozinho no histórico da timeline, e cada miniatura ganha os botões + (mais disso), ⏱ (depois) e − (menos disso). O popup também importa o histórico e as inscrições."),
      h(
        "ol",
        {},
        h("li", {}, "No PC, rode windows\\atualizar.ps1 (ou git pull) para ter a pasta D:\\TimelineYT\\app\\extensao."),
        h("li", {}, "Abra chrome://extensions, ligue o Modo do desenvolvedor e clique em Carregar sem compactação. Escolha a pasta extensao."),
        h("li", {}, `Clique no ícone da Timeline YT na barra do Chrome e entre com ${location.origin} e a sua senha. É uma vez só.`),
        h("li", {}, "Abra youtube.com/feed/history, clique no ícone e em Rolar a página toda e enviar. Repita em youtube.com/feed/channels."),
      ),
    ),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "1. Pelo favorito (sem extensão)"),
      h(
        "ol",
        {},
        h("li", {}, "Arraste o botão vermelho abaixo para a barra de favoritos do navegador."),
        h("li", {}, "Abra youtube.com/feed/history logado na sua conta e role a página para carregar bastante coisa."),
        h("li", {}, "Clique no favorito. Uma aba da timeline abre e importa sozinha. Faça o mesmo em youtube.com/feed/channels para trazer suas inscrições."),
      ),
      h("a", { class: "favorito", href: codigoFavorito(), onclick: (e) => (e.preventDefault(), avisar("Arraste este botão para a barra de favoritos")) }, "▶ Enviar para a Timeline"),
    ),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "2. Pelo Google Takeout (histórico completo)"),
      h(
        "ol",
        {},
        h("li", {}, h("a", { href: "https://takeout.google.com/settings/takeout/custom/youtube", target: "_blank", rel: "noopener", style: "color:var(--azul)" }, "Abra o Takeout do YouTube"), ", deixe marcados histórico e inscrições, e em formato do histórico escolha JSON."),
        h("li", {}, "Quando o Google mandar o arquivo, descompacte e envie aqui: histórico/watch-history.json e inscrições/subscriptions.csv."),
      ),
      arquivo,
    ),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "3. Colar"),
      colado,
      h(
        "div",
        { class: "linha-form", style: "margin-top:8px" },
        h(
          "button",
          {
            class: "pilula forte",
            onclick: () => {
              const t = colado.value.trim();
              if (!t) return;
              const tipo = t.startsWith("[") ? "takeout-json" : t.startsWith("{") ? "pagina" : /Channel Id|ID do canal/i.test(t) ? "inscricoes-csv" : "takeout-html";
              mandar(tipo, t);
            },
          },
          "Importar",
        ),
      ),
      resultado,
    ),
  );
  if (D.importacoes?.length) {
    box.append(h("div", { class: "sub-titulo" }, "Últimas importações"));
    for (const i of D.importacoes) box.append(h("p", { class: "motivo" }, `${new Date(i.quando).toLocaleString("pt-BR")} · ${i.tipo} · ${i.itens} vídeos · ${i.novos} canais novos`));
  }
}

function editorLista(titulo, ajuda, valores, campo) {
  const entrada = h("input", { class: "campo", placeholder: "digite e aperte Enter" });
  const salvar = async (nova) => {
    await api("/api/ajustes", { [campo]: nova });
    await carregar(true);
  };
  return h(
    "div",
    { class: "cartao" },
    h("h2", {}, titulo),
    h("p", {}, ajuda),
    h("div", { class: "tags-editaveis" }, ...valores.map((v) => h("span", {}, v, h("button", { title: "Tirar", onclick: () => salvar(valores.filter((x) => x !== v)) }, "×")))),
    h(
      "form",
      {
        class: "linha-form",
        onsubmit: (e) => {
          e.preventDefault();
          const novos = entrada.value.split(",").map((s) => s.trim()).filter(Boolean);
          if (novos.length) salvar([...valores, ...novos]);
        },
      },
      entrada,
    ),
  );
}

function renderAjustes() {
  const box = $("#lista");
  const a = D.ajustes;
  const ver = D.versao || {};
  box.append(
    h(
      "div",
      { class: "atalhos-pagina" },
      h("a", { class: "btn", href: "#/importar" }, "Importar histórico e extensão"),
      h("a", { class: "btn", href: "#/ocultos" }, "Vídeos ocultos"),
      h("a", { class: "btn", href: "#/canais" }, "Gerenciar canais"),
    ),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "Versão"),
      h(
        "p",
        {},
        ver.commit ? `Rodando a versão ${ver.commit} (${new Date(ver.data).toLocaleString("pt-BR")}).` : "Versão desconhecida.",
        " ",
        ver.ativo ? "Atualiza sozinho do GitHub a cada 15 minutos." : "Atualização automática desligada.",
        ver.verificado ? ` Última conferência ${ha(ver.verificado)}.` : "",
        ver.erro ? ` Último erro: ${ver.erro}` : "",
      ),
      h(
        "button",
        {
          class: "pilula",
          onclick: async (e) => {
            e.target.disabled = true;
            try {
              const r = await api("/api/atualizar-codigo", {});
              avisar(r.aplicado ? "Versão nova instalada; a página recarrega em 30 s" : r.erro ? r.erro : "Já está na última versão", null, !!r.erro);
              if (r.aplicado) setTimeout(() => location.reload(), 30000);
            } finally {
              e.target.disabled = false;
            }
          },
        },
        "Procurar atualização agora",
      ),
    ),
  );
  const salvar = (mud) => api("/api/ajustes", { ajustes: mud }).then(() => carregar(true));
  const chave = (rot, ajuda, k) =>
    h("label", { class: "interruptor" }, h("span", {}, rot, h("small", {}, ajuda)), h("input", { type: "checkbox", checked: !!a[k], onchange: (e) => salvar({ [k]: e.target.checked }) }));
  const numero = (rot, ajuda, k, min, max) =>
    h("label", { class: "interruptor" }, h("span", {}, rot, h("small", {}, ajuda)), h("input", { type: "number", class: "campo", style: "max-width:90px;min-width:0", min, max, value: a[k], onchange: (e) => salvar({ [k]: Number(e.target.value) }) }));

  box.append(
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "Timeline"),
      chave("Esconder Shorts", "Shorts não entram na timeline.", "esconderShorts"),
      chave("Tocar o próximo sozinho", "Ao terminar um vídeo, já começa o seguinte da lista.", "autoplay"),
      chave("Marcar como visto ao terminar", "Também marca quando você fecha depois de ver mais de 92%.", "marcarAoTerminar"),
      chave("Ler a duração dos vídeos", "Separa cortes curtos de podcasts longos. Abre a página de cada vídeo novo, devagar.", "detalhes"),
      numero("Buscar vídeos novos a cada (min)", "Mínimo 5.", "intervaloMin", 5, 240),
      numero("Mostrar vídeos dos últimos (dias)", "Vídeos salvos para depois ficam sempre.", "diasMax", 2, 60),
    ),
  );

  const pesos = h("div", { class: "cartao" }, h("h2", {}, "Peso de cada categoria"), h("p", {}, "Quanto mais à direita, mais aparece no Para você."));
  for (const [k, rot] of Object.entries(D.categorias)) {
    pesos.append(
      h(
        "label",
        { class: "interruptor" },
        h("span", {}, rot),
        h("input", { type: "range", min: 0, max: 2, step: 0.1, value: a.pesosCategoria[k] ?? 1, onchange: (e) => salvar({ pesosCategoria: { [k]: Number(e.target.value) } }) }),
      ),
    );
  }
  box.append(pesos);

  box.append(
    editorLista("Assuntos que você quer ver mais", "Vídeos com essas palavras no título sobem na timeline. Ex.: Nikolas, debate, STF, eleição.", D.interesses, "interesses"),
    editorLista("Palavras bloqueadas", "Vídeos com essas palavras no título não aparecem.", D.bloqueios, "bloqueios"),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "Sinais que você deu"),
      h("p", {}, D.sinais.length ? "Os mais recentes, pela extensão do Chrome:" : "Nenhum ainda. Use os botões + e − da extensão nas miniaturas do YouTube."),
      ...D.sinais.slice(0, 20).map((x) =>
        h(
          "p",
          { class: "motivo" },
          { mais: "+ Mais disso", menos: "− Menos disso", depois: "⏱ Depois", "tirar-depois": "⏱ Tirado de depois" }[x.tipo] || x.tipo,
          " · ",
          h("a", { href: linkYT(x.id), target: "_blank", rel: "noopener" }, x.titulo || x.id),
          D.canais[x.canal] ? ` · ${D.canais[x.canal].titulo}` : "",
          ` · ${ha(x.quando)}`,
        ),
      ),
    ),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "O que a timeline aprendeu do seu histórico"),
      h("p", {}, D.termos.length ? D.termos.join(", ") : "Nada ainda. Importe seu histórico."),
      D.termos.length ? h("button", { class: "pilula", onclick: () => api("/api/ajustes", { esquecerTermos: true }).then(() => carregar(true)) }, "Esquecer") : null,
    ),
    h(
      "div",
      { class: "cartao" },
      h("h2", {}, "Dados"),
      h("p", {}, `Tudo fica em ${D.pastaDados} (no PC). Um backup é feito por dia, mantendo os últimos 14.`),
      h(
        "div",
        { class: "linha-form" },
        h("a", { class: "pilula", href: "/api/backup" }, "Baixar backup"),
        h(
          "label",
          { class: "pilula" },
          "Restaurar backup",
          h("input", {
            type: "file",
            accept: ".json",
            hidden: true,
            onchange: async (e) => {
              const f = e.target.files[0];
              if (!f || !confirm("Substituir o estado atual por este backup?")) return;
              const json = JSON.parse(await f.text());
              await api("/api/restaurar", { estado: json.estado || json });
              avisar("Backup restaurado");
              carregar(true);
            },
          }),
        ),
        h("button", { class: "pilula", onclick: () => api("/api/sair", {}).then(() => location.reload()) }, "Sair"),
      ),
    ),
  );
}


// ---------- navegação ----------

function rota() {
  const partes = location.hash.replace(/^#\/?/, "").split("/");
  let v = APELIDOS[partes[0]] || partes[0] || "agora";
  if (!TITULOS[v] && v !== "canal") v = "agora";
  if (v !== ui.view || partes[1] !== ui.arg) {
    ui.filtro = "tudo";
    ui.sel = -1;
    window.scrollTo(0, 0);
  }
  ui.view = v;
  ui.arg = partes[1] || null;
  fecharFolha();
  render();
}
addEventListener("hashchange", rota);

function selecionar(i, rolar = true) {
  const cards = $$("#palco [data-i]");
  if (!cards.length) return;
  ui.sel = Math.max(0, Math.min(ui.mostrados - 1, i));
  cards.forEach((el) => el.classList.toggle("selecionado", Number(el.dataset.i) === ui.sel));
  const el = cards.find((x) => Number(x.dataset.i) === ui.sel);
  if (rolar && el) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  const aberto = !$("#player").hidden;
  if (e.key === "Escape") return aberto ? fecharPlayer() : (fecharMenu(), fecharFolha());
  if (aberto) {
    if (e.key === "n") proximo();
    if (e.key === "v") $("#pl-visto-prox").click();
    if (e.key === "f" || e.key === "d") $("#pl-depois").click();
    return;
  }
  const v = ui.lista[ui.sel];
  switch (e.key) {
    case "j":
      if (ui.sel + 1 >= ui.mostrados) maisItens();
      selecionar(ui.sel + 1);
      break;
    case "k":
      selecionar(ui.sel - 1);
      break;
    case "Enter":
      if (v) tocar(v.id);
      break;
    case "v":
      if (v) marcarVisto(v.id);
      break;
    case "f":
    case "d":
      if (v) porNaFila(v.id);
      break;
    case "x":
      if (v) menosDisso(v.id);
      break;
    case "/":
      e.preventDefault();
      $("#busca").focus();
      break;
    case "r":
      $("#btn-atualizar").click();
      break;
    default:
      return;
  }
});

new IntersectionObserver((ent) => {
  if (ent[0].isIntersecting && D && ui.mostrados < ui.lista.length) maisItens();
}, { rootMargin: "900px" }).observe($("#sentinela"));

$("#busca").addEventListener("input", (e) => {
  ui.busca = e.target.value;
  clearTimeout(ui.tBusca);
  ui.tBusca = setTimeout(() => {
    if (!["agora", "recentes", "fila", "historico", "continuar", "canal", "canais", "ocultos"].includes(ui.view)) location.hash = "#/agora";
    else render();
  }, 160);
});
$("#form-busca").onsubmit = (e) => (e.preventDefault(), render());
$("#btn-atualizar").onclick = async () => {
  await api("/api/atualizar", {});
  D.status.rodando = true;
  renderContadores();
  avisar("Buscando vídeos novos…");
  vigiar();
};

// ---------- dados ----------

async function carregar(manter) {
  const y = scrollY;
  D = await api("/api/timeline");
  // campos que um servidor de versão anterior pode não mandar
  for (const k of ["sinais", "importacoes", "termos", "interesses", "bloqueios", "pendentes"]) D[k] ||= [];
  for (const k of ["vistos", "depois", "ocultos", "progresso", "canais", "categorias"]) D[k] ||= {};
  D.status ||= {};
  D.geracao = Date.now();
  render({ manter });
  if (manter) scrollTo(0, y);
}

let vigiando = false;
async function vigiar() {
  if (vigiando) return;
  vigiando = true;
  try {
    for (let i = 0; i < 400; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      const s = await api("/api/status");
      D.status = s;
      renderContadores();
      if (!s.rodando) break;
    }
    if ($("#player").hidden && $("#folha").hidden) await carregar(true);
  } finally {
    vigiando = false;
  }
}

// Favorito antigo (sem extensão): recebe o que foi coletado numa página do YouTube
function ouvirFavorito() {
  addEventListener("message", async (e) => {
    if (!/^https:\/\/(www|m)\.youtube\.com$/.test(e.origin) || !e.data?.timelineyt) return;
    e.source?.postMessage("timelineyt-ok", e.origin);
    if (ouvirFavorito.feito) return;
    ouvirFavorito.feito = true;
    try {
      const r = await api("/api/importar", { tipo: "pagina", conteudo: e.data.timelineyt });
      avisar(`Importado: ${r.itens} vídeos, ${r.novos} canais novos`);
      location.hash = "#/agora";
      setTimeout(() => carregar(true), 1500);
      vigiar();
    } catch (err) {
      avisar(err.message, null, true);
    }
  });
}

async function iniciar() {
  if (location.pathname === "/importar-pagina") history.replaceState(null, "", "/#/importar");
  ouvirFavorito();
  try {
    await api("/api/visita", {});
    await carregar();
  } catch (e) {
    $("#lista").replaceChildren(h("div", { class: "vazio" }, h("b", {}, "Não consegui falar com o servidor"), e.message));
    return;
  }
  rota();
  if (D.status.rodando || D.pendentes.length) vigiar();
  // Dados novos a cada 10 min, sem mexer na tela enquanto você assiste
  setInterval(() => {
    if ($("#player").hidden && $("#folha").hidden && !document.hidden) carregar(true).catch(() => {});
  }, 10 * 60e3);
}

iniciar();

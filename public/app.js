// Timeline YT — interface. Sem framework: o servidor manda tudo em /api/timeline
// e as listas (Para você, Recentes, Depois, Histórico...) são filtradas aqui.

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

function h(tag, attrs = {}, ...filhos) {
  const el = document.createElementNS(tag === "svg" || tag === "path" ? "http://www.w3.org/2000/svg" : "http://www.w3.org/1999/xhtml", tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.setAttribute("class", v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && tag !== "svg" && tag !== "path") el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat()) if (f != null && f !== false) el.append(f.nodeType ? f : String(f));
  return el;
}

const ICONES = {
  visto: "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z",
  depois: "M14.97 16.95 10 13.87V7h2v5.76l4.03 2.49-1.06 1.7zM12 3c-4.96 0-9 4.04-9 9s4.04 9 9 9 9-4.04 9-9-4.04-9-9-9m0-1c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2z",
  ocultar: "m12.7 12 6.2-6.2-.7-.7-6.2 6.2-6.2-6.2-.7.7 6.2 6.2-6.2 6.2.7.7 6.2-6.2 6.2 6.2.7-.7z",
  mais: "M12 16.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5-1.5-.67-1.5-1.5.67-1.5 1.5-1.5zM10.5 12c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5zm0-6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5-1.5.67-1.5 1.5z",
  play: "M8 5v14l11-7z",
  verif: "M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zM9.8 17.3l-4.2-4.1L7 11.8l2.8 2.7L17 7.4l1.4 1.4-8.6 8.5z",
  lixo: "M11 17H9V8h2v9zm4-9h-2v9h2V8zm4-4v1h-1v16H6V5H5V4h4V3h6v1h4zm-2 1H7v15h10V5z",
  reler: "M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
  mudo: "M3.63 3.63a.996.996 0 0 0 0 1.41L7.29 8.7 7 9H4c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71v-4.17l4.18 4.18c-.49.37-1.02.68-1.6.91-.36.15-.58.53-.58.92 0 .72.73 1.18 1.39.91.8-.33 1.55-.77 2.22-1.31l1.34 1.34a.996.996 0 1 0 1.41-1.41L5.05 3.63c-.39-.39-1.02-.39-1.42 0zM19 12c0 .82-.15 1.61-.41 2.34l1.53 1.53c.56-1.17.88-2.48.88-3.87 0-3.83-2.4-7.11-5.78-8.4-.59-.23-1.22.23-1.22.86v.19c0 .38.25.71.61.85C17.18 6.54 19 9.06 19 12zm-8.71-6.29-.17.17L12 7.76V6.41c0-.89-1.08-1.33-1.71-.7zM16.5 12A4.5 4.5 0 0 0 14 7.97v1.79l2.48 2.48c.01-.08.02-.16.02-.24z",
  som: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z",
};
const icone = (nome) => h("svg", { viewBox: "0 0 24 24" }, h("path", { d: ICONES[nome] }));

// ---------- estado ----------

let D = null; // payload do servidor
const ui = {
  view: "inicio",
  arg: null,
  chip: "tudo",
  busca: "",
  layout: lerLocal("layout", "lista"),
  mostrarVistos: false,
  mostrarShorts: false,
  lista: [],
  mostrados: 0,
  sel: -1,
  latMais: false,
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
  const passos = [
    [60, "second"],
    [3600, "minute", 60],
    [86400, "hour", 3600],
    [604800, "day", 86400],
    [2629800, "week", 604800],
    [31557600, "month", 2629800],
    [Infinity, "year", 31557600],
  ];
  if (s < 60) return "agora";
  for (const [lim, un, div = 1] of passos) if (s < lim) return fmtRel.format(-Math.floor(s / div), un);
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
  const ontem = new Date(Date.now() - 864e5);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  if (Date.now() - ts < 6 * 864e5) return d.toLocaleDateString("pt-BR", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });
}

const semAcento = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const miniatura = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const linkYT = (id) => `https://www.youtube.com/watch?v=${id}`;

// ---------- listas ----------

const CHIPS = [
  ["tudo", "Tudo"],
  ["novos", "Novos"],
  ["corte", "Cortes"],
  ["debate", "Debates"],
  ["podcast", "Podcasts"],
  ["politica", "Política"],
  ["noticias", "Notícias"],
  ["economia", "Economia"],
  ["aovivo", "Ao vivo"],
  ["curto", "Até 20 min"],
  ["longo", "Mais de 40 min"],
];

const TITULOS = {
  inicio: "Para você",
  recentes: "Recentes",
  continuar: "Continuar assistindo",
  depois: "Assistir depois",
  historico: "Histórico de exibição",
  ocultos: "Ocultos",
  canais: "Canais",
  importar: "Importar histórico",
  ajustes: "Ajustes",
};

function passaChip(v, chip) {
  if (chip === "tudo") return true;
  if (chip === "novos") return (v.chegou || 0) > (D.visitaAnterior || 0) && Date.parse(v.publicado) > (D.visitaAnterior || 0) - 6 * 3600e3;
  return v.tags.includes(chip);
}

function passaBusca(v, q) {
  if (!q) return true;
  const c = D.canais[v.canal];
  return semAcento(`${v.titulo} ${c?.titulo || ""} ${v.descricao || ""}`).includes(q);
}

function baseFiltrada({ usarChip = true, respeitarVistos = true } = {}) {
  const q = semAcento(ui.busca.trim());
  return D.videos.filter((v) => {
    if (D.ocultos[v.id]) return false;
    if (respeitarVistos && D.vistos[v.id] && !ui.mostrarVistos && D.ajustes.esconderVistos) return false;
    if (v.short && D.ajustes.esconderShorts && !ui.mostrarShorts) return false;
    if (usarChip && !passaChip(v, ui.chip)) return false;
    return passaBusca(v, q);
  });
}

function listaDaView() {
  const porId = new Map(D.videos.map((v) => [v.id, v]));
  const q = semAcento(ui.busca.trim());
  const doMapa = (mapa, ordem = -1) =>
    Object.entries(mapa)
      .map(([id, ts]) => ({ v: porId.get(id), ts: typeof ts === "object" ? ts.ts : ts }))
      .filter((x) => x.v && passaBusca(x.v, q))
      .sort((a, b) => ordem * (a.ts - b.ts))
      .map((x) => ({ ...x.v, _ts: x.ts }));

  switch (ui.view) {
    case "inicio":
      return baseFiltrada();
    case "recentes":
      return baseFiltrada().sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado));
    case "continuar":
      return doMapa(D.progresso);
    case "depois":
      return doMapa(D.depois, 1);
    case "historico":
      return doMapa(D.vistos);
    case "ocultos":
      return doMapa(D.ocultos);
    case "canal":
      return D.videos
        .filter((v) => v.canal === ui.arg && passaBusca(v, q) && passaChip(v, ui.chip))
        .sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado));
  }
  return [];
}

function agrupar(view) {
  if (view === "historico") return (v) => rotuloDia(v._ts);
  if (view === "recentes" || view === "canal") return (v) => rotuloDia(Date.parse(v.publicado));
  return null;
}

// ---------- render ----------

function itemVideo(v, i) {
  const c = D.canais[v.canal] || {};
  const prog = D.progresso[v.id];
  const visto = !!D.vistos[v.id];
  const depois = !!D.depois[v.id];
  const novo = (v.chegou || 0) > (D.visitaAnterior || 0) && !visto;
  const tempo = v.aoVivo ? h("span", { class: "tempo vivo" }, "AO VIVO") : v.duracao ? h("span", { class: "tempo" }, duracao(v.duracao)) : v.short ? h("span", { class: "tempo" }, "SHORTS") : null;
  const pct = prog ? Math.min(100, (prog.t / prog.d) * 100) : visto ? 100 : 0;

  const rapido = (nome, titulo, fn) => h("button", { title: titulo, onclick: (e) => (e.stopPropagation(), fn()) }, icone(nome));

  const el = h(
    "div",
    { class: `item${visto ? " visto" : ""}`, tabIndex: -1, dataset: { id: v.id, i } },
    h(
      "div",
      { class: "miniatura", onclick: () => tocar(v.id) },
      h("img", { src: miniatura(v.id), alt: "", loading: "lazy", onerror: (e) => (e.target.style.visibility = "hidden") }),
      tempo,
      visto && ui.view !== "historico" ? h("span", { class: "selo-visto" }, "VISTO") : null,
      pct ? h("div", { class: "barra" }, h("b", { style: `width:${pct}%` })) : null,
      h(
        "div",
        { class: "rapidos" },
        rapido("visto", visto ? "Marcar como não visto (v)" : "Marcar como visto (v)", () => alternarVisto(v.id)),
        rapido("depois", depois ? "Tirar de Assistir depois (d)" : "Assistir depois (d)", () => alternarDepois(v.id)),
        rapido("ocultar", "Não tenho interesse (x)", () => ocultar(v.id)),
      ),
    ),
    h(
      "div",
      { class: "info" },
      h("h3", { title: v.titulo, onclick: () => tocar(v.id) }, v.titulo),
      h(
        "div",
        { class: "meta" },
        h("a", { href: `#/canal/${v.canal}` }, c.titulo || "canal", " ", c.vezesNoHistorico ? icone("verif") : null),
        v.views ? h("span", {}, `▷ ${fmtNum.format(v.views)}`) : null,
        h("span", {}, ha(v.publicado)),
        ui.view === "historico" ? h("span", {}, `visto ${ha(v._ts)}`) : null,
        prog ? h("span", {}, `parou em ${duracao(prog.t)}`) : null,
      ),
      ui.view === "inicio" && v.motivo ? h("div", { class: "motivo" }, v.motivo) : null,
      h(
        "div",
        { class: "etiquetas" },
        novo ? h("span", { class: "etq novo" }, "Novo") : null,
        depois && ui.view !== "depois" ? h("span", { class: "etq depois" }, "Assistir depois") : null,
        ...v.tags.filter((t) => ["corte", "debate", "podcast", "aovivo"].includes(t)).map((t) => h("span", { class: `etq ${t}` }, { corte: "Corte", debate: "Debate", podcast: "Podcast", aovivo: "Ao vivo" }[t])),
      ),
      ui.layout === "lista" && v.descricao && ui.view !== "inicio" ? h("div", { class: "desc" }, v.descricao) : null,
      h("button", { class: "mais-btn", title: "Ações", onclick: (e) => (e.stopPropagation(), abrirMenu(e.currentTarget, v)) }, icone("mais")),
    ),
  );
  el.addEventListener("click", () => selecionar(i, false));
  return el;
}

function renderChips() {
  const box = $("#chips");
  box.replaceChildren();
  if (!["inicio", "recentes", "canal"].includes(ui.view)) return;
  const base = ui.view === "canal" ? D.videos.filter((v) => v.canal === ui.arg) : baseFiltrada({ usarChip: false });
  for (const [k, rot] of CHIPS) {
    const n = base.filter((v) => passaChip(v, k)).length;
    if (k !== "tudo" && !n) continue;
    box.append(
      h("button", { class: `chip${ui.chip === k ? " ativo" : ""}`, onclick: () => ((ui.chip = k), render()) }, rot, k !== "tudo" ? h("small", {}, n) : null),
    );
  }
}

const LOTE = 40;

function render() {
  if (!D) return;
  for (const a of $$("[data-v]")) a.classList.toggle("ativo", a.dataset.v === ui.view);
  $("#titulo-view").textContent = ui.view === "canal" ? "" : TITULOS[ui.view] || "";
  $("#lista").className = `lista${ui.layout === "grade" ? " grade" : ""}`;
  $("#txt-vistos").textContent = ui.mostrarVistos ? "Esconder vistos" : "Mostrar vistos";
  $("#txt-shorts").textContent = ui.mostrarShorts || !D.ajustes.esconderShorts ? "Esconder Shorts" : "Mostrar Shorts";
  $("#txt-layout").textContent = ui.layout === "grade" ? "Ver em lista" : "Ver em grade";
  renderLateral();
  renderContadores();

  const lista = $("#lista");
  lista.replaceChildren();
  $("#chips").replaceChildren();
  if (ui.view === "canais") return renderCanais();
  if (ui.view === "importar") return renderImportar();
  if (ui.view === "ajustes") return renderAjustes();
  if (ui.view === "canal") renderCabecaCanal();

  renderChips();
  ui.lista = listaDaView();
  ui.mostrados = 0;
  ui.sel = Math.min(ui.sel, ui.lista.length - 1);
  if (!ui.lista.length) return lista.append(vazio());
  maisItens();
}

function maisItens() {
  const lista = $("#lista");
  const grupo = agrupar(ui.view);
  const ate = Math.min(ui.lista.length, ui.mostrados + LOTE);
  let ultimoGrupo = ui.mostrados ? grupo?.(ui.lista[ui.mostrados - 1]) : null;
  for (let i = ui.mostrados; i < ate; i++) {
    const v = ui.lista[i];
    if (grupo) {
      const g = grupo(v);
      if (g !== ultimoGrupo) lista.append(h("div", { class: "grupo-data" }, g));
      ultimoGrupo = g;
    }
    lista.append(itemVideo(v, i));
  }
  ui.mostrados = ate;
}

function vazio() {
  const msgs = {
    inicio: D.status.rodando || Object.keys(D.canais).length === 0
      ? ["Montando sua timeline…", "Achando os canais e lendo os vídeos novos. Na primeira vez leva alguns minutos."]
      : ["Tudo visto por aqui", "Troque o filtro, mostre os vistos ou atualize os feeds."],
    recentes: ["Nada recente", "Atualize os feeds ou adicione canais."],
    continuar: ["Nada pela metade", "Vídeos que você começar e não terminar aparecem aqui."],
    depois: ["Lista vazia", "Use o relógio na miniatura (ou a tecla d) para guardar vídeos para depois."],
    historico: ["Nenhum vídeo visto ainda", "Marque como visto (tecla v) ou assista até o fim."],
    ocultos: ["Nenhum vídeo oculto", ""],
    canal: ["Sem vídeos deste canal", "O feed pode não ter sido lido ainda."],
  };
  const [t, s] = msgs[ui.view] || ["Nada aqui", ""];
  return h("div", { class: "vazio" }, h("b", {}, t), s);
}

function renderLateral() {
  const box = $("#lat-canais");
  box.replaceChildren();
  const naoVistosPorCanal = {};
  for (const v of D.videos) {
    if (!D.vistos[v.id] && !D.ocultos[v.id] && (v.chegou || 0) > (D.visitaAnterior || 0)) naoVistosPorCanal[v.canal] = (naoVistosPorCanal[v.canal] || 0) + 1;
  }
  const canais = Object.values(D.canais)
    .filter((c) => !c.silenciado)
    .sort((a, b) => (b.vezesNoHistorico || 0) + (b.peso || 0) * 5 - ((a.vezesNoHistorico || 0) + (a.peso || 0) * 5) || (a.titulo || "").localeCompare(b.titulo || ""));
  const mostrar = ui.latMais ? canais : canais.slice(0, 8);
  for (const c of mostrar) {
    box.append(
      h(
        "a",
        { class: "lat-canal", href: `#/canal/${c.id}`, title: c.titulo },
        c.foto ? h("img", { src: c.foto, alt: "", loading: "lazy" }) : h("span", { class: "sem-foto" }),
        h("span", {}, c.titulo || c.handle || c.id),
        naoVistosPorCanal[c.id] ? h("i") : null,
      ),
    );
  }
  $("#lat-mais span").textContent = ui.latMais ? "Mostrar menos" : `Mostrar mais (${Math.max(0, canais.length - 8)})`;
  $("#lat-mais").hidden = canais.length <= 8;
  const s = D.status;
  $("#lat-status").textContent = s.rodando
    ? `Atualizando: ${s.etapa || "…"}`
    : s.ultima
      ? `Atualizado ${ha(s.ultima)} · ${Object.keys(D.canais).length} canais${D.pendentes.length ? ` · ${D.pendentes.length} por achar` : ""}`
      : "Aguardando a primeira atualização";
}

function renderContadores() {
  const nDepois = Object.keys(D.depois).length;
  const nCont = Object.keys(D.progresso).length;
  $("#n-depois").textContent = nDepois || "";
  $("#n-continuar").textContent = nCont || "";
  const novos = D.videos.filter((v) => (v.chegou || 0) > (D.visitaAnterior || 0) && !D.vistos[v.id] && !D.ocultos[v.id] && !(v.short && D.ajustes.esconderShorts)).length;
  $("#sino-n").hidden = !novos;
  $("#sino-n").textContent = novos > 99 ? "99+" : novos;
  document.title = novos ? `(${novos}) Timeline YT` : "Timeline YT";
  $("#btn-atualizar").classList.toggle("girando", !!D.status.rodando);
  const s = D.status;
  const info = $("#painel-info");
  info.replaceChildren(
    ...[
      h("span", {}, `${ui.lista.length || D.videos.length} vídeos nesta lista`),
      h("span", {}, `${Object.keys(D.canais).length} canais · ${D.pendentes.length} por achar`),
      s.semDuracao ? h("span", {}, `lendo duração de ${s.semDuracao} vídeos`) : null,
      s.falhas ? h("span", {}, `${s.falhas} canal(is) com erro na última leitura`) : null,
    ].filter(Boolean),
  );
}

function renderCabecaCanal() {
  const c = D.canais[ui.arg];
  if (!c) return;
  const cab = h(
    "div",
    { class: "cabeca-canal" },
    c.foto ? h("img", { src: c.foto, alt: "" }) : h("span", { class: "sem-foto" }),
    h(
      "div",
      {},
      h("h1", {}, c.titulo),
      h("p", {}, [c.handle ? "@" + c.handle : null, D.categorias[c.categoria], origemTexto(c)].filter(Boolean).join(" · ")),
    ),
    h("div", { class: "linha-form" }, controlesCanal(c), h("a", { class: "pilula", href: `https://www.youtube.com/channel/${c.id}`, target: "_blank", rel: "noopener" }, "Abrir no YouTube")),
  );
  $("#lista").append(cab);
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
  setTimeout(() => el.remove(), desfazer ? 6000 : 4000);
}

async function enviarAcao(tipo, id, extra = {}) {
  try {
    await api("/api/acao", { tipo, id, ...extra });
  } catch (e) {
    avisar("Não salvou: " + e.message, null, true);
  }
}

function alternarVisto(id, silencioso) {
  if (D.vistos[id]) {
    delete D.vistos[id];
    enviarAcao("nao-visto", id);
    if (!silencioso) avisar("Marcado como não visto");
  } else {
    D.vistos[id] = Date.now();
    const antesDepois = D.depois[id];
    const antesProg = D.progresso[id];
    delete D.depois[id];
    delete D.progresso[id];
    enviarAcao("visto", id);
    if (!silencioso)
      avisar("Marcado como visto", () => {
        delete D.vistos[id];
        if (antesDepois) {
          D.depois[id] = antesDepois;
          enviarAcao("depois", id);
        }
        if (antesProg) D.progresso[id] = antesProg;
        enviarAcao("nao-visto", id);
        render();
      });
  }
  render();
}

function alternarDepois(id) {
  if (D.depois[id]) {
    delete D.depois[id];
    enviarAcao("tirar-depois", id);
    avisar("Removido de Assistir depois", () => ((D.depois[id] = Date.now()), enviarAcao("depois", id), render()));
  } else {
    D.depois[id] = Date.now();
    enviarAcao("depois", id);
    avisar("Salvo em Assistir depois", () => ((delete D.depois[id]), enviarAcao("tirar-depois", id), render()));
  }
  render();
}

function ocultar(id) {
  if (D.ocultos[id]) {
    delete D.ocultos[id];
    enviarAcao("mostrar", id);
  } else {
    D.ocultos[id] = Date.now();
    delete D.depois[id];
    enviarAcao("ocultar", id);
    avisar("Vídeo oculto. A timeline vai mostrar menos desse canal.", () => ((delete D.ocultos[id]), enviarAcao("mostrar", id), render()));
  }
  render();
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

function abrirMenu(alvo, v) {
  const menu = $("#menu");
  const c = D.canais[v.canal] || {};
  const item = (texto, fn) => h("button", { onclick: () => (fecharMenu(), fn()) }, texto);
  menu.replaceChildren(
    item(D.depois[v.id] ? "Tirar de Assistir depois" : "Salvar em Assistir depois", () => alternarDepois(v.id)),
    item(D.vistos[v.id] ? "Marcar como não visto" : "Marcar como visto", () => alternarVisto(v.id)),
    item(D.ocultos[v.id] ? "Mostrar de novo" : "Não tenho interesse", () => ocultar(v.id)),
    h("hr"),
    h("a", { href: linkYT(v.id), target: "_blank", rel: "noopener", onclick: fecharMenu }, "Abrir no YouTube"),
    item("Copiar link", () => navigator.clipboard?.writeText(linkYT(v.id)).then(() => avisar("Link copiado"))),
    h("a", { href: `#/canal/${v.canal}`, onclick: fecharMenu }, `Ir para ${c.titulo || "o canal"}`),
    h("hr"),
    item("Mais vídeos deste canal", () => editarCanal(v.canal, { peso: Math.min(3, (c.peso || 0) + 1) }, `Prioridade de ${c.titulo} aumentada`)),
    item("Menos vídeos deste canal", () => editarCanal(v.canal, { peso: Math.max(-2, (c.peso || 0) - 1) }, `Prioridade de ${c.titulo} reduzida`)),
    item("Silenciar canal", () => editarCanal(v.canal, { silenciado: true }, `${c.titulo} silenciado`)),
  );
  menu.hidden = false;
  const r = alvo.getBoundingClientRect();
  const w = menu.offsetWidth;
  const hh = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + "px";
  menu.style.top = (r.bottom + hh > innerHeight - 8 ? Math.max(8, r.top - hh) : r.bottom) + "px";
}
function fecharMenu() {
  $("#menu").hidden = true;
}
document.addEventListener("click", (e) => {
  if (!$("#menu").hidden && !e.target.closest("#menu") && !e.target.closest(".mais-btn")) fecharMenu();
});

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

async function tocar(id, fila) {
  const v = D.videos.find((x) => x.id === id);
  if (!v) return;
  P.fila = (fila || ui.lista).map((x) => x.id);
  P.id = id;
  $("#player").hidden = false;
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
  $("#pl-meta").textContent = [v.views ? `${fmtNum.format(v.views)} visualizações` : null, ha(v.publicado), v.duracao ? duracao(v.duracao) : null].filter(Boolean).join(" · ");
  $("#pl-yt").href = linkYT(v.id);
  $("#pl-depois").textContent = D.depois[v.id] ? "Tirar de Depois" : "Assistir depois";
  const vel = $("#pl-vel");
  vel.replaceChildren(
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
  const fila = $("#pl-fila");
  const prox = proximos(8);
  fila.replaceChildren(
    ...prox.map((p) => {
      const pc = D.canais[p.canal] || {};
      return h(
        "div",
        { class: "item", onclick: () => tocar(p.id, P.fila.map((id) => ({ id }))) },
        h("div", { class: "miniatura" }, h("img", { src: miniatura(p.id), alt: "", loading: "lazy" }), p.duracao ? h("span", { class: "tempo" }, duracao(p.duracao)) : null),
        h("div", { class: "info" }, h("h3", {}, p.titulo), h("div", { class: "meta" }, pc.titulo || "", " · ", ha(p.publicado))),
      );
    }),
  );
  if (!prox.length) fila.append(h("p", { class: "pl-meta" }, "Fim da lista."));
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

function terminou() {
  if (D.ajustes.marcarAoTerminar && !D.vistos[P.id]) alternarVisto(P.id, true);
  if (D.ajustes.autoplay) proximo();
}

function proximo() {
  const [p] = proximos(1);
  if (p) tocar(p.id, P.fila.map((id) => ({ id })));
  else fecharPlayer();
}

function fecharPlayer() {
  const r = salvarProgresso(true);
  if (r && r.d && r.t / r.d > 0.92 && !D.vistos[P.id]) alternarVisto(P.id, true);
  clearInterval(P.timer);
  P.player?.stopVideo?.();
  $("#player").hidden = true;
  document.body.style.overflow = "";
  P.id = null;
  render();
}

$("#pl-fechar").onclick = fecharPlayer;
$("#pl-visto-prox").onclick = () => {
  if (!D.vistos[P.id]) alternarVisto(P.id, true);
  proximo();
};
$("#pl-depois").onclick = () => {
  alternarDepois(P.id);
  preencherPlayer(D.videos.find((x) => x.id === P.id));
};
$("#player").addEventListener("click", (e) => {
  if (e.target.id === "player") fecharPlayer();
});

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
      h("h2", {}, "1. Pelo próprio YouTube (mais rápido)"),
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
  if (D.importacoes.length) {
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
      chave("Esconder vídeos vistos", "Somem da timeline depois de marcados.", "esconderVistos"),
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
  const v = partes[0] || "inicio";
  const nova = TITULOS[v] || v === "canal" ? v : "inicio";
  if (nova !== ui.view || partes[1] !== ui.arg) {
    ui.chip = "tudo";
    ui.sel = -1;
    window.scrollTo(0, 0);
  }
  ui.view = nova;
  ui.arg = partes[1] || null;
  document.body.classList.remove("menu-aberto");
  render();
}
addEventListener("hashchange", rota);

function selecionar(i, rolar = true) {
  const itens = $$("#lista .item");
  if (!itens.length) return;
  ui.sel = Math.max(0, Math.min(itens.length - 1, i));
  itens.forEach((el) => el.classList.toggle("selecionado", Number(el.dataset.i) === ui.sel));
  const el = itens.find((x) => Number(x.dataset.i) === ui.sel);
  if (rolar && el) el.scrollIntoView({ block: "center", behavior: "smooth" });
}

addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea, select") || e.ctrlKey || e.metaKey || e.altKey) {
    if (e.key === "Escape") e.target.blur();
    return;
  }
  const aberto = !$("#player").hidden;
  if (e.key === "Escape") return aberto ? fecharPlayer() : fecharMenu();
  if (aberto) {
    if (e.key === "n") proximo();
    if (e.key === "v") $("#pl-visto-prox").click();
    if (e.key === "d") $("#pl-depois").click();
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
      if (v) alternarVisto(v.id), selecionar(ui.sel, false);
      break;
    case "d":
      if (v) alternarDepois(v.id), selecionar(ui.sel, false);
      break;
    case "x":
      if (v) ocultar(v.id), selecionar(ui.sel, false);
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
}, { rootMargin: "800px" }).observe($("#sentinela"));

// busca (topo e painel ficam sincronizadas)
for (const id of ["#busca", "#busca-painel"]) {
  $(id).addEventListener("input", (e) => {
    ui.busca = e.target.value;
    for (const o of ["#busca", "#busca-painel"]) if (o !== id) $(o).value = ui.busca;
    clearTimeout(ui.tBusca);
    ui.tBusca = setTimeout(render, 150);
  });
}
$("#form-busca").onsubmit = (e) => {
  e.preventDefault();
  if (!["inicio", "recentes", "canais", "historico", "depois", "canal"].includes(ui.view)) location.hash = "#/inicio";
  render();
};
$("#busca-limpar").onclick = () => {
  ui.busca = $("#busca").value = $("#busca-painel").value = "";
  render();
};
$("#btn-menu").onclick = () => {
  if (innerWidth <= 1000) document.body.classList.toggle("menu-aberto");
  else document.body.classList.toggle("lateral-fechada");
};
$("#veu").onclick = () => document.body.classList.remove("menu-aberto");
$("#lat-mais").onclick = () => ((ui.latMais = !ui.latMais), renderLateral());
$("#btn-atualizar").onclick = async () => {
  await api("/api/atualizar", {});
  D.status.rodando = true;
  render();
  avisar("Buscando vídeos novos…");
  vigiar();
};
$("#acao-tocar").onclick = () => {
  const lista = ui.lista.filter((v) => !D.vistos[v.id]);
  if (lista.length) tocar(lista[0].id, lista);
};
$("#acao-marcar-todos").onclick = () => {
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
};
$("#acao-vistos").onclick = () => ((ui.mostrarVistos = !ui.mostrarVistos), render());
$("#acao-shorts").onclick = () => ((ui.mostrarShorts = !ui.mostrarShorts), render());
$("#acao-layout").onclick = () => {
  ui.layout = ui.layout === "grade" ? "lista" : "grade";
  gravarLocal("layout", ui.layout);
  render();
};

// ---------- dados ----------

async function carregar(manterRolagem) {
  const y = scrollY;
  const mostrados = ui.mostrados;
  D = await api("/api/timeline");
  render();
  if (manterRolagem) {
    while (ui.mostrados < Math.min(mostrados, ui.lista.length)) maisItens();
    scrollTo(0, y);
  }
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
      renderLateral();
      if (!s.rodando) break;
    }
    if ($("#player").hidden) await carregar(true);
  } finally {
    vigiando = false;
  }
}

// Favorito: recebe o que foi coletado numa página do YouTube
function ouvirFavorito() {
  addEventListener("message", async (e) => {
    if (!/^https:\/\/(www|m)\.youtube\.com$/.test(e.origin) || !e.data?.timelineyt) return;
    e.source?.postMessage("timelineyt-ok", e.origin);
    if (ouvirFavorito.feito) return;
    ouvirFavorito.feito = true;
    try {
      const r = await api("/api/importar", { tipo: "pagina", conteudo: e.data.timelineyt });
      avisar(`Importado: ${r.itens} vídeos, ${r.novos} canais novos`);
      location.hash = "#/inicio";
      setTimeout(() => carregar(true), 1500);
      vigiar();
    } catch (err) {
      avisar(err.message, null, true);
    }
  });
}

async function iniciar() {
  if (location.pathname === "/importar-pagina") {
    history.replaceState(null, "", "/#/importar");
  }
  ouvirFavorito();
  try {
    const r = await api("/api/visita", {});
    await carregar();
    D.visitaAnterior = r.visitaAnterior;
  } catch (e) {
    $("#lista").replaceChildren(h("div", { class: "vazio" }, h("b", {}, "Não consegui falar com o servidor"), e.message));
    return;
  }
  rota();
  if (D.status.rodando || D.pendentes.length) vigiar();
  setInterval(() => {
    if ($("#player").hidden && !document.hidden) carregar(true).catch(() => {});
  }, 10 * 60e3);
}

iniciar();

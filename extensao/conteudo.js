// Timeline YT — roda dentro do youtube.com.
// - Botões em cada miniatura: mais disso, assistir depois, menos disso
// - Barra no vídeo aberto, com os mesmos botões
// - Marca como visto na timeline o que você assiste aqui (70% do vídeo ou 5 minutos)
// - Selo nas miniaturas do que já está visto ou salvo na timeline

(() => {
  const CAIXAS =
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model, ytd-playlist-video-renderer, ytd-playlist-panel-video-renderer";
  const MINIATURA = "ytd-thumbnail, yt-thumbnail-view-model, a#thumbnail, .yt-lockup-view-model__content-image";

  let cfg = { botoes: true, marcarMiniaturas: true, autoVisto: true, token: "" };
  const estados = new Map(); // id -> "visto" | "depois" | "oculto" | "mais" | "menos" | null
  const perguntar = new Set();
  const vistosEnviados = new Set();

  // ---------- utilidades ----------

  function el(tag, props = {}, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "class") e.className = v;
      else e.setAttribute(k, v);
    }
    for (const f of filhos) if (f != null) e.append(f);
    return e;
  }

  function idDe(href = "") {
    return href.match(/[?&]v=([\w-]{11})/)?.[1] || href.match(/\/shorts\/([\w-]{11})/)?.[1] || null;
  }

  function mandar(msg) {
    return new Promise((ok, falha) => {
      try {
        chrome.runtime.sendMessage(msg, (r) => {
          if (chrome.runtime.lastError) return falha(new Error("Extensão recarregada; atualize a página (F5)."));
          r?.ok ? ok(r.dados) : falha(new Error(r?.erro || "falhou"));
        });
      } catch {
        falha(new Error("Extensão recarregada; atualize a página (F5)."));
      }
    });
  }

  function aviso(texto, erro) {
    let caixa = document.getElementById("tl-avisos");
    if (!caixa) document.body.append((caixa = el("div", { id: "tl-avisos" })));
    const a = el("div", { class: "tl-aviso" + (erro ? " tl-erro" : "") }, el("b", {}, "Timeline "), texto);
    caixa.append(a);
    setTimeout(() => a.remove(), 3500);
  }

  // ---------- sinais ----------

  const ROTULO = { mais: "Mais disso", menos: "Menos disso", depois: "Salvo para depois", "tirar-depois": "Tirado de Depois", visto: "Marcado como visto" };

  async function enviarSinal(tipo, id, dica = {}) {
    try {
      const r = await mandar({ tipo: "sinal", sinal: tipo, id, dica });
      const novo = { mais: "mais", menos: "oculto", depois: "depois", "tirar-depois": null, visto: "visto" }[tipo];
      estados.set(id, novo);
      aplicarEstados();
      if (tipo !== "visto") aviso(`${ROTULO[tipo]}: ${r.titulo}${r.canal ? " · " + r.canal : ""}`);
      return true;
    } catch (e) {
      aviso(e.message, true);
      return false;
    }
  }

  function dicaDe(caixa) {
    const titulo = caixa.querySelector("#video-title, h3, .yt-lockup-metadata-view-model__title")?.textContent?.trim() || "";
    const canal = caixa.querySelector('a[href^="/@"], a[href^="/channel/"]');
    return { titulo: titulo.slice(0, 200), canalNome: canal?.textContent?.trim() || "", canalHref: canal?.getAttribute("href") || "" };
  }

  function botao(tipo, rotulo, titulo, acao) {
    return el(
      "button",
      {
        class: `tl-btn tl-${tipo}`,
        title: titulo,
        type: "button",
        onclick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          acao();
        },
        onmousedown: (e) => e.stopPropagation(),
      },
      rotulo,
    );
  }

  function barraPara(obterId, obterDica) {
    const alternarDepois = () => {
      const id = obterId();
      enviarSinal(estados.get(id) === "depois" ? "tirar-depois" : "depois", id, obterDica());
    };
    return [
      botao("mais", "+", "Mais disso (a timeline mostra mais desse canal e assunto)", () => enviarSinal("mais", obterId(), obterDica())),
      botao("depois", "⏱", "Assistir depois (na timeline)", alternarDepois),
      botao("menos", "−", "Menos disso (esconde e mostra menos desse canal)", () => enviarSinal("menos", obterId(), obterDica())),
    ];
  }

  // ---------- miniaturas ----------

  function processarMiniaturas() {
    for (const caixa of document.querySelectorAll(CAIXAS)) {
      const link = caixa.querySelector('a[href*="/watch?v="], a[href^="/shorts/"]');
      const id = idDe(link?.getAttribute("href") || "");
      const alvo = caixa.querySelector(MINIATURA);
      if (!id || !alvo) continue;
      if (caixa.dataset.tlId === id && alvo.querySelector(":scope > .tl-selo")) continue;
      caixa.dataset.tlId = id;
      alvo.classList.add("tl-host");
      alvo.querySelector(":scope > .tl-barra")?.remove();
      alvo.querySelector(":scope > .tl-selo")?.remove();
      if (cfg.botoes) {
        const barra = el("div", { class: "tl-barra" }, ...barraPara(() => caixa.dataset.tlId, () => dicaDe(caixa)));
        alvo.append(barra);
      }
      alvo.append(el("div", { class: "tl-selo" }));
      if (!estados.has(id)) perguntar.add(id);
    }
    pedirEstados();
    aplicarEstados();
  }

  let tEstados = null;
  function pedirEstados() {
    if (!cfg.token || !perguntar.size || tEstados) return;
    tEstados = setTimeout(async () => {
      tEstados = null;
      const ids = [...perguntar].slice(0, 200);
      ids.forEach((id) => perguntar.delete(id));
      try {
        const r = await mandar({ tipo: "estados", ids });
        for (const id of ids) estados.set(id, r[id] || null);
        aplicarEstados();
      } catch {}
      if (perguntar.size) pedirEstados();
    }, 500);
  }

  const SELO = { visto: "✓ Visto na Timeline", depois: "⏱ Na Timeline", mais: "+ Mais disso", oculto: "− Oculto", menos: "− Oculto" };

  function aplicarEstados() {
    for (const caixa of document.querySelectorAll("[data-tl-id]")) {
      const st = estados.get(caixa.dataset.tlId) || null;
      const host = caixa.querySelector(".tl-host");
      if (!host) continue;
      for (const k of ["visto", "depois", "mais", "oculto", "menos"]) host.classList.toggle("tl-st-" + k, st === k);
      const selo = host.querySelector(":scope > .tl-selo");
      if (selo) selo.textContent = cfg.marcarMiniaturas && st ? SELO[st] : "";
    }
    atualizarBarraVideo();
  }

  // ---------- vídeo aberto ----------

  const idAtual = () => (location.pathname === "/watch" ? new URLSearchParams(location.search).get("v") : null);

  function dicaDoVideoAberto() {
    const titulo = document.querySelector("ytd-watch-metadata #title h1, h1.ytd-watch-metadata")?.textContent?.trim() || document.title.replace(/ - YouTube$/, "");
    const canal = document.querySelector("ytd-watch-metadata ytd-channel-name a, #owner ytd-channel-name a");
    return { titulo, canalNome: canal?.textContent?.trim() || "", canalHref: canal?.getAttribute("href") || "" };
  }

  function atualizarBarraVideo() {
    const id = idAtual();
    let barra = document.getElementById("tl-barra-video");
    if (!id || !cfg.botoes) return barra?.remove();
    const ancora = document.querySelector("ytd-watch-metadata #top-row, ytd-watch-metadata #owner");
    if (!ancora) return;
    if (!barra || barra.parentElement !== ancora.parentElement) {
      barra?.remove();
      barra = el(
        "div",
        { id: "tl-barra-video" },
        el("span", { class: "tl-marca" }, "Timeline"),
        ...barraPara(idAtual, dicaDoVideoAberto),
        el("span", { class: "tl-estado" }),
      );
      barra.querySelector(".tl-mais").textContent = "+ Mais disso";
      barra.querySelector(".tl-depois").textContent = "⏱ Depois";
      barra.querySelector(".tl-menos").textContent = "− Menos disso";
      ancora.after(barra);
    }
    if (!estados.has(id)) {
      perguntar.add(id);
      pedirEstados();
    }
    const st = estados.get(id);
    barra.querySelector(".tl-estado").textContent = st ? SELO[st] : cfg.autoVisto ? "conta como visto ao assistir" : "";
    barra.querySelector(".tl-depois").classList.toggle("tl-ativo", st === "depois");
    barra.querySelector(".tl-mais").classList.toggle("tl-ativo", st === "mais");
  }

  // Assistiu 70% (ou 5 minutos) aqui no YouTube → visto na timeline
  function vigiarPlayer() {
    const video = document.querySelector("#movie_player video.html5-main-video");
    if (!video || video.dataset.tlVigiado) return;
    video.dataset.tlVigiado = "1";
    video.addEventListener("timeupdate", () => {
      const id = idAtual();
      if (!cfg.autoVisto || !cfg.token || !id || vistosEnviados.has(id)) return;
      if (document.querySelector("#movie_player.ad-showing")) return;
      const d = video.duration;
      const t = video.currentTime;
      if (!d || !Number.isFinite(d)) return;
      if (t / d >= 0.7 || t >= 300) {
        vistosEnviados.add(id);
        if (estados.get(id) !== "visto") enviarSinal("visto", id, dicaDoVideoAberto());
      }
    });
  }

  // ---------- ciclo ----------

  let agendado = false;
  function agendar() {
    if (agendado) return;
    agendado = true;
    setTimeout(() => {
      agendado = false;
      processarMiniaturas();
      vigiarPlayer();
    }, 400);
  }

  async function carregarCfg() {
    try {
      cfg = await mandar({ tipo: "cfg" });
    } catch {}
    document.documentElement.classList.toggle("tl-sem-botoes", !cfg.botoes);
  }

  chrome.storage.onChanged.addListener(async () => {
    await carregarCfg();
    for (const c of document.querySelectorAll("[data-tl-id]")) delete c.dataset.tlId;
    document.querySelectorAll(".tl-barra, .tl-selo, #tl-barra-video").forEach((e) => e.remove());
    estados.clear();
    agendar();
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.tipo === "aviso") aviso(msg.texto, msg.erro);
  });

  carregarCfg().then(() => {
    new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("yt-navigate-finish", agendar);
    agendar();
  });
})();

// Timeline YT — fundo da extensão. Toda conversa com o servidor passa por aqui
// (o content script do YouTube não pode chamar outro domínio direto).

const PADRAO = {
  servidor: "https://yt.faaretz.site",
  token: "",
  botoes: true,
  marcarMiniaturas: true,
  autoVisto: true,
};

async function cfg() {
  return { ...PADRAO, ...(await chrome.storage.local.get(Object.keys(PADRAO))) };
}

const base = (s) => s.trim().replace(/\/+$/, "");

async function api(rota, { metodo = "GET", corpo } = {}) {
  const c = await cfg();
  if (!c.token) throw new Error("Entre com a senha: clique no ícone da Timeline YT na barra do Chrome.");
  const res = await fetch(base(c.servidor) + rota, {
    method: metodo,
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.token },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    await chrome.storage.local.set({ token: "" });
    throw new Error("Sessão expirada. Entre de novo pelo ícone da extensão.");
  }
  if (!res.ok) throw new Error(json.erro || `erro ${res.status}`);
  return json;
}

function idDoVideo(url = "") {
  return url.match(/[?&]v=([\w-]{11})/)?.[1] || url.match(/(?:youtu\.be|\/shorts|\/live)\/([\w-]{11})/)?.[1] || null;
}

const NOMES = { mais: "Mais disso", menos: "Menos disso", depois: "Assistir depois", "tirar-depois": "Tirado de Depois", visto: "Visto" };

async function sinal(tipo, id, dica) {
  const r = await api("/api/sinal", { metodo: "POST", corpo: { tipo, id, dica } });
  atualizarSelo();
  return r;
}

async function atualizarSelo() {
  try {
    const r = await api("/api/resumo");
    await chrome.action.setBadgeBackgroundColor({ color: "#cc0000" });
    await chrome.action.setBadgeText({ text: r.novos ? (r.novos > 99 ? "99+" : String(r.novos)) : "" });
  } catch {
    await chrome.action.setBadgeText({ text: "" });
  }
}

// Coletor que roda dentro da aba do YouTube (histórico, inscrições, qualquer lista)
async function coletorDaPagina(rolar) {
  if (rolar) {
    let altura = 0;
    for (let i = 0; i < 60; i++) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 1300));
      const h = document.documentElement.scrollHeight;
      if (h === altura && i > 3) break;
      altura = h;
    }
  }
  const V = [];
  const C = [];
  const S = new Set();
  const K = new Set();
  const caixa = (a) =>
    a.closest(
      "ytd-video-renderer,ytd-rich-item-renderer,ytd-grid-video-renderer,ytd-compact-video-renderer,ytd-playlist-video-renderer,yt-lockup-view-model,ytd-reel-item-renderer,ytm-shorts-lockup-view-model",
    ) || a.parentElement?.parentElement;
  for (const a of document.querySelectorAll('a[href*="/watch?v="],a[href^="/shorts/"]')) {
    const m = a.href.match(/(?:v=|shorts\/)([\w-]{11})/);
    if (!m || S.has(m[1])) continue;
    const b = caixa(a);
    const te = b?.querySelector("#video-title,h3,[title]");
    const t = ((te && (te.textContent || te.title)) || a.title || a.textContent || "").trim();
    if (!t) continue;
    S.add(m[1]);
    const c = b?.querySelector('a[href^="/@"],a[href^="/channel/"]');
    V.push({ id: m[1], titulo: t.slice(0, 200), canalHref: c ? c.getAttribute("href") : "", canalNome: c ? c.textContent.trim() : "" });
  }
  const todas = location.pathname.startsWith("/feed/channels");
  for (const a of document.querySelectorAll('a[href^="/@"],a[href^="/channel/"]')) {
    const guia = a.closest("ytd-guide-renderer,ytd-mini-guide-renderer,tp-yt-app-drawer");
    if (!guia && !todas) continue;
    const href = a.getAttribute("href").split(/[?#]/)[0].replace(/\/(videos|shorts|streams|featured|about|playlists)$/, "");
    if (K.has(href)) continue;
    const nome = (a.textContent || a.title || "").trim();
    if (!nome) continue;
    K.add(href);
    C.push({ href, nome: nome.slice(0, 100), inscrito: true });
  }
  return { url: location.href, videos: V, canais: C };
}

async function importarAba(rolar) {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.url?.startsWith("https://www.youtube.com/")) throw new Error("Abra uma página do YouTube (histórico ou inscrições) nesta aba.");
  const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: aba.id }, func: coletorDaPagina, args: [!!rolar] });
  if (!result?.videos?.length && !result?.canais?.length) throw new Error("Não achei vídeos nem canais nesta página.");
  return api("/api/importar", { metodo: "POST", corpo: { tipo: "pagina", conteudo: result } });
}

async function entrar(servidor, senha) {
  const res = await fetch(base(servidor) + "/api/entrar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha, token: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.token) throw new Error(json.erro || "Não consegui entrar.");
  await chrome.storage.local.set({ servidor: base(servidor), token: json.token });
  atualizarSelo();
  return { ok: true };
}

async function tratar(msg) {
  switch (msg.tipo) {
    case "sinal":
      return sinal(msg.sinal, msg.id, msg.dica);
    case "estados":
      return msg.ids.length ? api(`/api/estado-ids?ids=${msg.ids.join(",")}`) : {};
    case "resumo":
      return api("/api/resumo");
    case "entrar":
      return entrar(msg.servidor, msg.senha);
    case "sair":
      await chrome.storage.local.set({ token: "" });
      await chrome.action.setBadgeText({ text: "" });
      return {};
    case "importarAba":
      return importarAba(msg.rolar);
    case "cfg":
      return cfg();
  }
  throw new Error("mensagem desconhecida");
}

chrome.runtime.onMessage.addListener((msg, _remetente, responder) => {
  tratar(msg)
    .then((dados) => responder({ ok: true, dados }))
    .catch((e) => responder({ ok: false, erro: e.message }));
  return true;
});

// Botão direito em links/páginas de vídeo, em qualquer site
const PADROES = ["*://www.youtube.com/watch*", "*://m.youtube.com/watch*", "*://youtu.be/*", "*://www.youtube.com/shorts/*", "*://www.youtube.com/live/*"];

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const [id, titulo] of [
      ["mais", "Timeline: mais disso"],
      ["depois", "Timeline: assistir depois"],
      ["menos", "Timeline: menos disso"],
    ]) {
      chrome.contextMenus.create({ id: "link-" + id, title: titulo, contexts: ["link"], targetUrlPatterns: PADROES });
      chrome.contextMenus.create({ id: "pagina-" + id, title: titulo, contexts: ["page", "video"], documentUrlPatterns: PADROES });
    }
  });
  chrome.alarms.create("selo", { periodInMinutes: 15 });
  atualizarSelo();
});

chrome.runtime.onStartup.addListener(atualizarSelo);
chrome.alarms.onAlarm.addListener((a) => a.name === "selo" && atualizarSelo());

async function avisarAba(tabId, texto, erro) {
  try {
    await chrome.tabs.sendMessage(tabId, { tipo: "aviso", texto, erro });
  } catch {
    await chrome.action.setBadgeText({ text: erro ? "!" : "✓" });
    setTimeout(atualizarSelo, 2500);
  }
}

async function sinalComAviso(tipo, url, tabId) {
  const id = idDoVideo(url);
  if (!id) return avisarAba(tabId, "Isso não é um vídeo do YouTube", true);
  try {
    const r = await sinal(tipo, id, {});
    await avisarAba(tabId, `${NOMES[tipo]}: ${r.titulo}`);
  } catch (e) {
    await avisarAba(tabId, e.message, true);
  }
}

chrome.contextMenus.onClicked.addListener((info, aba) => {
  const [, tipo] = info.menuItemId.split("-");
  sinalComAviso(tipo, info.linkUrl || info.pageUrl, aba?.id);
});

chrome.commands.onCommand.addListener(async (comando) => {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (aba) sinalComAviso(comando, aba.url, aba.id);
});

// Timeline YT — servidor local. Sem dependências: só Node 18+.
//   node server.mjs            → http://127.0.0.1:3220
// Variáveis: TIMELINE_PORTA, TIMELINE_HOST, TIMELINE_DADOS, TIMELINE_SENHA

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Armazem } from "./lib/armazem.mjs";
import { Motor } from "./lib/motor.mjs";
import { montarTimeline } from "./lib/ranking.mjs";
import { palavras } from "./lib/historico.mjs";
import { Atualizador } from "./lib/atualizador.mjs";
import { CATEGORIAS } from "./lib/seed.mjs";

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const PUBLICO = path.join(RAIZ, "public");
const PORTA = Number(process.env.TIMELINE_PORTA || 3220);
const HOST = process.env.TIMELINE_HOST || "127.0.0.1";
const INICIO = new Date().toISOString();

const armazem = new Armazem();
const motor = new Motor(armazem);
const atualizador = new Atualizador(RAIZ, { log: (m) => armazem.log(m), antesDeSair: () => armazem.salvarAgora() });
const E = () => armazem.estado;

// ---------- acesso ----------

function lerOuCriar(arquivo, gerar) {
  try {
    const v = fs.readFileSync(arquivo, "utf8").split(/\r?\n/)[0].trim();
    if (v) return v;
  } catch {}
  const v = gerar();
  fs.writeFileSync(arquivo, v + "\n");
  return v;
}

const SENHA =
  process.env.TIMELINE_SENHA ||
  lerOuCriar(path.join(armazem.dir, "acesso.txt"), () => {
    const s = crypto.randomBytes(9).toString("base64url");
    armazem.log(`senha criada em ${path.join(armazem.dir, "acesso.txt")}`);
    return s;
  });
const SEGREDO = lerOuCriar(path.join(armazem.dir, "segredo.txt"), () => crypto.randomBytes(32).toString("hex"));
const COOKIE = "tl_sessao";
const VALIDADE = 400 * 24 * 3600; // o máximo que o Chrome aceita; renovado a cada visita

function assinar(valor) {
  return valor + "." + crypto.createHmac("sha256", SEGREDO).update(valor).digest("base64url");
}

// Sessão: cookie (site) ou "Authorization: Bearer" (extensão do Chrome); o mesmo token assinado
function sessaoValida(req) {
  const token =
    (req.headers.cookie || "").match(new RegExp(`${COOKIE}=([^;]+)`))?.[1] ||
    (req.headers.authorization || "").match(/^Bearer\s+(\S+)$/)?.[1];
  if (!token) return false;
  const [valor] = token.split(".");
  const esperado = Buffer.from(assinar(valor));
  const recebido = Buffer.from(token);
  return esperado.length === recebido.length && crypto.timingSafeEqual(esperado, recebido) ? token : false;
}

function cookieSessao(req, token) {
  const seguro = req.headers["x-forwarded-proto"] === "https" || req.headers["cf-visitor"]?.includes("https");
  return `${COOKIE}=${token}; Path=/; Max-Age=${VALIDADE}; HttpOnly; SameSite=Lax${seguro ? "; Secure" : ""}`;
}

const tentativas = new Map();
function ipDe(req) {
  return req.headers["cf-connecting-ip"] || req.socket.remoteAddress || "";
}

// ---------- utilidades HTTP ----------

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.youtube.com https://s.ytimg.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "img-src 'self' data: https://i.ytimg.com https://*.ggpht.com https://*.googleusercontent.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join("; ");

function cabecalhosBase(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Content-Security-Policy": CSP,
    ...extra,
  };
}

function enviar(req, res, status, corpo, tipo = "application/json; charset=utf-8", extra = {}) {
  let dados = typeof corpo === "string" || Buffer.isBuffer(corpo) ? corpo : JSON.stringify(corpo);
  const h = cabecalhosBase({ "Content-Type": tipo, "Cache-Control": "no-store", ...extra });
  if (/\bgzip\b/.test(req.headers["accept-encoding"] || "") && Buffer.byteLength(dados) > 1024) {
    dados = zlib.gzipSync(dados);
    h["Content-Encoding"] = "gzip";
  }
  res.writeHead(status, h);
  res.end(dados);
}

function lerCorpo(req, limite = 80 * 1024 * 1024) {
  return new Promise((ok, falha) => {
    const partes = [];
    let tamanho = 0;
    req.on("data", (p) => {
      tamanho += p.length;
      if (tamanho > limite) {
        falha(Object.assign(new Error("arquivo grande demais"), { status: 413 }));
        req.destroy();
      } else partes.push(p);
    });
    req.on("end", () => {
      const txt = Buffer.concat(partes).toString("utf8");
      try {
        ok(txt ? JSON.parse(txt) : {});
      } catch {
        falha(Object.assign(new Error("JSON inválido"), { status: 400 }));
      }
    });
    req.on("error", falha);
  });
}

// "__V__" nos arquivos da interface vira um número que muda a cada reinício do servidor:
// assim navegador e Cloudflare nunca usam um app.js velho com um index.html novo.
const VERSAO_ARQUIVOS = String(Date.now());

function servirArquivo(req, res, arquivo) {
  const ext = path.extname(arquivo);
  fs.readFile(arquivo, (err, dados) => {
    if (err) return enviar(req, res, 404, "não encontrado", "text/plain; charset=utf-8");
    if (ext === ".html" || ext === ".js") dados = Buffer.from(dados.toString("utf8").replaceAll("__V__", VERSAO_ARQUIVOS));
    enviar(req, res, 200, dados, TIPOS[ext] || "application/octet-stream", {
      // html, js e css sempre conferidos: depois de uma atualização ninguém fica com versão misturada
      "Cache-Control": [".html", ".js", ".mjs", ".css", ".webmanifest"].includes(ext) ? "no-cache" : "public, max-age=3600",
    });
  });
}

// ---------- montagem da timeline ----------

function payloadTimeline() {
  const e = E();
  const agora = Date.now();
  const limite = agora - e.ajustes.diasMax * 24 * 3600e3;
  const candidatos = Object.values(armazem.videos).filter(
    (v) =>
      Date.parse(v.publicado) >= limite ||
      e.depois[v.id] ||
      e.progresso[v.id] ||
      (e.vistos[v.id] && e.vistos[v.id] > agora - 30 * 24 * 3600e3),
  );
  const ctx = {
    canais: e.canais,
    stats: e.stats,
    termos: e.termos,
    interesses: e.interesses,
    bloqueios: e.bloqueios,
    pesosCategoria: e.ajustes.pesosCategoria,
    exibicoes: e.exibicoes,
    pesoProgramas: e.ajustes.programas === "normal" ? 1 : 0.15,
    agora,
  };
  const videos = montarTimeline(candidatos, ctx).map((v) => ({
    id: v.id,
    canal: v.canal,
    titulo: v.titulo,
    publicado: v.publicado,
    views: v.views,
    duracao: v.duracao,
    short: v.short,
    aoVivo: v.aoVivo,
    descricao: v.descricao?.slice(0, 240),
    chaves: [...new Set(palavras(v.titulo))].slice(0, 12),
    explorar: semInteracao(v.canal),
    exib: e.exibicoes[v.id]?.n || 0,
    nota: Math.round(v.nota * 1000) / 1000,
    tags: v.tags,
    motivo: v.motivo,
    chegou: v.visto1,
  }));
  return {
    videos,
    canais: e.canais,
    pendentes: e.pendentes,
    vistos: e.vistos,
    depois: e.depois,
    ocultos: e.ocultos,
    progresso: e.progresso,
    ajustes: e.ajustes,
    interesses: e.interesses,
    bloqueios: e.bloqueios,
    termos: Object.entries(e.termos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([w]) => w),
    importacoes: e.importacoes.slice(0, 5),
    sinais: e.sinais.slice(0, 40),
    visitaAnterior: e.visitaAnterior,
    categorias: CATEGORIAS,
    status: motor.status,
    pastaDados: armazem.dir,
    versao: atualizador.info,
  };
}

// Contagem para o selo da extensão: vídeos novos desde a última visita ao site
function resumo() {
  const e = E();
  let novos = 0;
  for (const v of Object.values(armazem.videos)) {
    const c = e.canais[v.canal];
    if (!c || c.silenciado || e.vistos[v.id] || e.ocultos[v.id]) continue;
    if (v.short && e.ajustes.esconderShorts) continue;
    if ((v.visto1 || 0) > (e.visitaAnterior || 0) && Date.parse(v.publicado) > (e.visitaAnterior || 0) - 6 * 3600e3) novos++;
  }
  return {
    novos,
    depois: Object.keys(e.depois).length,
    continuar: Object.keys(e.progresso).length,
    canais: Object.keys(e.canais).length,
    ultima: motor.status.ultima,
    rodando: motor.status.rodando,
  };
}

// Canal que você nunca viu, salvou nem pediu "mais": candidato a aparecer "para variar"
function semInteracao(canalId) {
  const c = E().canais[canalId];
  const s = E().stats[canalId] || {};
  return !!c && !c.vezesNoHistorico && !s.vistos && !s.mais && !s.depois && !c.peso;
}

function contar(canalId, campo, delta = 1) {
  if (!canalId) return;
  const s = (E().stats[canalId] ||= {});
  s[campo] = Math.max(0, (s[campo] || 0) + delta);
}

function acao({ tipo, id, t, d }) {
  const e = E();
  const v = armazem.videos[id];
  const canal = v?.canal;
  const agora = Date.now();
  switch (tipo) {
    case "visto":
      if (!e.vistos[id]) contar(canal, "vistos");
      e.vistos[id] = agora;
      delete e.depois[id];
      delete e.progresso[id];
      break;
    case "nao-visto":
      if (e.vistos[id]) contar(canal, "vistos", -1);
      delete e.vistos[id];
      break;
    case "depois":
      if (!e.depois[id]) contar(canal, "depois");
      e.depois[id] = agora;
      break;
    case "tirar-depois":
      delete e.depois[id];
      break;
    case "ocultar":
      if (!e.ocultos[id]) contar(canal, "ocultos");
      e.ocultos[id] = agora;
      delete e.depois[id];
      break;
    case "mostrar":
      if (e.ocultos[id]) contar(canal, "ocultos", -1);
      delete e.ocultos[id];
      break;
    case "exibido": {
      // conta no máximo uma exibição a cada 30 min por vídeo (sessões, não rolagem)
      const x = (e.exibicoes[id] ||= { n: 0, ts: 0 });
      if (agora - x.ts > 30 * 60e3) Object.assign(x, { n: x.n + 1, ts: agora });
      break;
    }
    case "progresso":
      if (Number.isFinite(t) && Number.isFinite(d) && d > 0) {
        if (t < 15 || t / d >= 0.92) delete e.progresso[id];
        else e.progresso[id] = { t: Math.round(t), d: Math.round(d), ts: agora };
        if (v && !v.duracao) v.duracao = Math.round(d);
      }
      break;
    default:
      throw Object.assign(new Error("ação desconhecida"), { status: 400 });
  }
  armazem.salvar();
}

// ---------- rotas ----------

async function api(req, res, rota) {
  const metodo = req.method;
  if (rota === "/api/timeline" && metodo === "GET") return enviar(req, res, 200, payloadTimeline());
  if (rota === "/api/status" && metodo === "GET") return enviar(req, res, 200, motor.status);
  if (rota === "/api/resumo" && metodo === "GET") return enviar(req, res, 200, resumo());
  if (rota === "/api/estado-ids" && metodo === "GET") {
    const e = E();
    const out = {};
    for (const id of (new URL(req.url, "http://x").searchParams.get("ids") || "").split(",").slice(0, 300)) {
      const st = e.vistos[id] ? "visto" : e.depois[id] ? "depois" : e.ocultos[id] ? "oculto" : e.marcados[id] || null;
      if (st) out[id] = st;
    }
    return enviar(req, res, 200, out);
  }
  if (rota === "/api/backup" && metodo === "GET") {
    armazem.salvarAgora();
    return enviar(req, res, 200, JSON.stringify({ estado: E() }), "application/json; charset=utf-8", {
      "Content-Disposition": `attachment; filename="timeline-yt-${new Date().toISOString().slice(0, 10)}.json"`,
    });
  }
  if (metodo !== "POST") return enviar(req, res, 405, { erro: "método não permitido" });

  const corpo = await lerCorpo(req);
  const e = E();
  switch (rota) {
    case "/api/acao": {
      const lista = Array.isArray(corpo.lote) ? corpo.lote : [corpo];
      for (const item of lista) acao(item);
      return enviar(req, res, 200, { ok: true });
    }
    case "/api/visita": {
      const agora = Date.now();
      if (agora - (e.ultimaVisita || 0) > 30 * 60e3) e.visitaAnterior = e.ultimaVisita || agora;
      e.ultimaVisita = agora;
      armazem.salvar();
      return enviar(req, res, 200, { visitaAnterior: e.visitaAnterior }, undefined, { "Set-Cookie": cookieSessao(req, sessaoValida(req)) });
    }
    case "/api/canal": {
      if (corpo.acao === "adicionar") {
        const c = await motor.adicionarPorTexto(String(corpo.texto || ""), corpo.categoria);
        return enviar(req, res, 200, { ok: true, canal: c });
      }
      const c = e.canais[corpo.id];
      if (!c) return enviar(req, res, 404, { erro: "canal não encontrado" });
      if (corpo.acao === "editar") {
        if (corpo.categoria in CATEGORIAS) c.categoria = corpo.categoria;
        if (Number.isFinite(corpo.peso)) c.peso = Math.max(-2, Math.min(3, corpo.peso));
        if (typeof corpo.silenciado === "boolean") c.silenciado = corpo.silenciado;
      } else if (corpo.acao === "remover") {
        delete e.canais[c.id];
        for (const [id, v] of Object.entries(armazem.videos)) if (v.canal === c.id && !e.depois[id]) delete armazem.videos[id];
      } else if (corpo.acao === "reler") {
        await motor.lerFeeds([c.id]);
      }
      armazem.salvar();
      return enviar(req, res, 200, { ok: true });
    }
    case "/api/pendente": {
      const p = e.pendentes.find((x) => x.chave === corpo.chave);
      if (!p) return enviar(req, res, 404, { erro: "não encontrado" });
      if (corpo.acao === "remover") e.pendentes = e.pendentes.filter((x) => x !== p);
      else if (corpo.acao === "corrigir") {
        const c = await motor.adicionarPorTexto(String(corpo.texto || ""), p.categoria);
        c.origem = p.origem === "contraponto" ? "contraponto" : p.origem;
        c.vezesNoHistorico = p.vezesNoHistorico || 0;
        e.pendentes = e.pendentes.filter((x) => x !== p);
      }
      armazem.salvar();
      return enviar(req, res, 200, { ok: true });
    }
    case "/api/sinal": {
      const id = String(corpo.id || "");
      if (!/^[\w-]{11}$/.test(id)) return enviar(req, res, 400, { erro: "id de vídeo inválido" });
      const r = await motor.sinal(corpo.tipo, id, corpo.dica || {});
      return enviar(req, res, 200, { ok: true, titulo: r.video.titulo, canal: r.canal?.titulo || "" });
    }
    case "/api/importar": {
      const r = motor.importar(corpo.tipo, corpo.conteudo);
      return enviar(req, res, 200, { ok: true, ...r });
    }
    case "/api/ajustes": {
      if (corpo.ajustes) {
        const a = corpo.ajustes;
        for (const k of ["esconderShorts", "esconderVistos", "autoplay", "marcarAoTerminar", "detalhes"])
          if (typeof a[k] === "boolean") e.ajustes[k] = a[k];
        if (Number.isFinite(a.intervaloMin)) e.ajustes.intervaloMin = Math.max(5, Math.min(240, a.intervaloMin));
        if (Number.isFinite(a.diasMax)) e.ajustes.diasMax = Math.max(2, Math.min(60, a.diasMax));
        if (["esconder", "menos", "normal"].includes(a.programas)) e.ajustes.programas = a.programas;
        if (Number.isFinite(a.velocidade)) e.ajustes.velocidade = Math.max(0.25, Math.min(2, a.velocidade));
        if (a.pesosCategoria)
          for (const [k, v] of Object.entries(a.pesosCategoria))
            if (k in e.ajustes.pesosCategoria && Number.isFinite(v)) e.ajustes.pesosCategoria[k] = Math.max(0, Math.min(3, v));
      }
      const lista = (x) => (Array.isArray(x) ? [...new Set(x.map((s) => String(s).trim()).filter(Boolean))].slice(0, 200) : null);
      if (lista(corpo.interesses)) e.interesses = lista(corpo.interesses);
      if (lista(corpo.bloqueios)) e.bloqueios = lista(corpo.bloqueios);
      if (Array.isArray(corpo.bloqueios) && !corpo.bloqueios.length) e.bloqueios = [];
      if (Array.isArray(corpo.interesses) && !corpo.interesses.length) e.interesses = [];
      if (corpo.esquecerTermos) e.termos = {};
      armazem.salvar();
      return enviar(req, res, 200, { ok: true });
    }
    case "/api/atualizar-codigo": {
      const r = await atualizador.verificar();
      return enviar(req, res, 200, r);
    }
    case "/api/atualizar": {
      motor.atualizar().catch((err) => armazem.log("erro: " + err.message));
      return enviar(req, res, 202, { ok: true });
    }
    case "/api/restaurar": {
      const novo = corpo.estado;
      if (!novo || typeof novo !== "object" || !novo.canais) return enviar(req, res, 400, { erro: "backup inválido" });
      armazem.salvarAgora();
      Object.assign(armazem.estado, novo);
      armazem.salvarAgora();
      return enviar(req, res, 200, { ok: true });
    }
    case "/api/sair":
      return enviar(req, res, 200, { ok: true }, undefined, { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0` });
  }
  return enviar(req, res, 404, { erro: "rota não encontrada" });
}

const ARQUIVOS_LIVRES = new Set(["/entrar.html", "/entrar.js", "/estilo.css", "/icone.svg", "/manifest.webmanifest"]);

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const rota = decodeURIComponent(url.pathname);
  try {
    if (rota === "/api/entrar" && req.method === "POST") {
      const ip = ipDe(req);
      const t = tentativas.get(ip) || { n: 0, ate: 0 };
      if (t.ate > Date.now()) return enviar(req, res, 429, { erro: "Muitas tentativas. Espere alguns minutos." });
      const { senha, token: querToken } = await lerCorpo(req, 10_000);
      const a = Buffer.from(String(senha || ""));
      const b = Buffer.from(SENHA);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        tentativas.delete(ip);
        const token = assinar(crypto.randomBytes(12).toString("base64url"));
        if (querToken) return enviar(req, res, 200, { ok: true, token });
        return enviar(req, res, 200, { ok: true }, undefined, { "Set-Cookie": cookieSessao(req, token) });
      }
      t.n++;
      if (t.n >= 5) Object.assign(t, { n: 0, ate: Date.now() + 10 * 60e3 });
      tentativas.set(ip, t);
      return enviar(req, res, 401, { erro: "Senha errada." });
    }

    if (ARQUIVOS_LIVRES.has(rota)) return servirArquivo(req, res, path.join(PUBLICO, rota));
    // Sem login: só a versão em execução, para conferir se a atualização entrou
    if (rota === "/versao") return enviar(req, res, 200, { versao: atualizador.info.commit, desde: INICIO, autoAtualiza: atualizador.info.ativo });

    if (!sessaoValida(req)) {
      if (rota.startsWith("/api/")) return enviar(req, res, 401, { erro: "faça login" });
      return servirArquivo(req, res, path.join(PUBLICO, "entrar.html"));
    }

    if (rota.startsWith("/api/")) return await api(req, res, rota);

    const arquivo = path.normalize(path.join(PUBLICO, rota));
    if (arquivo.startsWith(PUBLICO) && path.extname(arquivo) && fs.existsSync(arquivo)) return servirArquivo(req, res, arquivo);
    return servirArquivo(req, res, path.join(PUBLICO, "index.html"));
  } catch (err) {
    armazem.log(`erro ${req.method} ${rota}: ${err.stack || err.message}`);
    enviar(req, res, err.status || 500, { erro: err.message });
  }
});

servidor.listen(PORTA, HOST, () => {
  armazem.log(`Timeline YT em http://${HOST}:${PORTA} · dados em ${armazem.dir}`);
  if (!process.env.TIMELINE_SEM_ATUALIZAR) motor.iniciar();
  atualizador.lerVersao();
  atualizador.iniciar();
});

for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    armazem.salvarAgora();
    process.exit(0);
  });
}

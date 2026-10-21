// Transcrição de um vídeo, para a minutagem: primeiro as legendas que o YouTube expõe na
// página do vídeo; se vierem vazias, o yt-dlp (se estiver instalado no PC).
// Também lê capítulos que o próprio autor já pôs na descrição.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { baixar } from "./youtube.mjs";

// Extrai um array JSON a partir de `"chave":[` respeitando aspas e colchetes aninhados
export function arrayJson(texto, chave) {
  const i = texto.indexOf(`"${chave}":[`);
  if (i < 0) return null;
  const inicio = i + chave.length + 3; // posição do "["
  let j = inicio + 1;
  let nivel = 1;
  let emTexto = false;
  for (; j < texto.length && nivel; j++) {
    const c = texto[j];
    if (emTexto) {
      if (c === "\\") j++;
      else if (c === '"') emTexto = false;
    } else if (c === '"') emTexto = true;
    else if (c === "[") nivel++;
    else if (c === "]") nivel--;
  }
  try {
    return JSON.parse(texto.slice(inicio, j));
  } catch {
    return null;
  }
}

export function descricaoCompleta(html) {
  const m = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (!m) return "";
  try {
    return JSON.parse(`"${m[1]}"`);
  } catch {
    return "";
  }
}

export function segundos(txt) {
  const p = String(txt).trim().split(":").map(Number);
  if (p.some((n) => !Number.isFinite(n))) return null;
  return p.reduce((acc, n) => acc * 60 + n, 0);
}

// "00:00 Abertura" / "1:02:33 - Tema" → [{ s, t }]
export function capitulosDaDescricao(desc = "") {
  const out = [];
  for (const linha of desc.split(/\r?\n/)) {
    const m = linha.match(/^\s*[[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-–—:|]?\s*(.{2,100})$/);
    if (m) out.push({ s: segundos(m[1]), t: m[2].trim() });
  }
  return out.length >= 3 && out[0].s <= 10 ? out : [];
}

// eventos json3 → linhas de ~30 s: [{ s, texto }]
export function linhasDeEventos(eventos, janela = 30) {
  const linhas = [];
  for (const ev of eventos || []) {
    const txt = (ev.segs || []).map((s) => s.utf8 || "").join("").replace(/\s+/g, " ").trim();
    if (!txt || txt === "[Música]" || txt === "[Music]") continue;
    const s = Math.floor((ev.tStartMs || 0) / 1000);
    const ultima = linhas[linhas.length - 1];
    if (ultima && s - ultima.s < janela) ultima.texto += " " + txt;
    else linhas.push({ s, texto: txt });
  }
  return linhas;
}

function escolherFaixa(faixas = []) {
  const pt = (f) => /^pt/.test(f.languageCode || "");
  return faixas.find((f) => pt(f) && f.kind !== "asr") || faixas.find(pt) || faixas.find((f) => /^en/.test(f.languageCode || "")) || faixas[0];
}

async function viaPagina(html) {
  const faixa = escolherFaixa(arrayJson(html, "captionTracks") || []);
  if (!faixa?.baseUrl) return null;
  const texto = await baixar(faixa.baseUrl + "&fmt=json3", { timeout: 20000 });
  if (!texto.trim()) return null; // o YouTube às vezes devolve vazio sem o token do navegador
  const json = JSON.parse(texto);
  const linhas = linhasDeEventos(json.events);
  return linhas.length ? linhas : null;
}

function rodar(cmd, args, timeout) {
  return new Promise((ok, falha) =>
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? falha(new Error((stderr || err.message).trim().split("\n").pop())) : ok(stdout),
    ),
  );
}

let ytdlpDisponivel = null;
export async function temYtDlp() {
  if (ytdlpDisponivel !== null) return ytdlpDisponivel;
  try {
    await rodar(process.env.TIMELINE_YTDLP || "yt-dlp", ["--version"], 15000);
    ytdlpDisponivel = true;
  } catch {
    ytdlpDisponivel = false;
  }
  return ytdlpDisponivel;
}

async function viaYtDlp(id, pastaTemp) {
  if (!(await temYtDlp())) return null;
  fs.mkdirSync(pastaTemp, { recursive: true });
  try {
    await rodar(
      process.env.TIMELINE_YTDLP || "yt-dlp",
      ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "pt.*,pt,en.*,en", "--sub-format", "json3", "--no-warnings", "-o", path.join(pastaTemp, "%(id)s.%(ext)s"), `https://www.youtube.com/watch?v=${id}`],
      180000,
    );
    const arquivos = fs.readdirSync(pastaTemp).filter((f) => f.startsWith(id) && f.endsWith(".json3"));
    const melhor = arquivos.find((f) => /\.pt[^.]*\.json3$/.test(f) && !/orig/.test(f)) || arquivos.find((f) => /\.pt/.test(f)) || arquivos[0];
    if (!melhor) return null;
    const linhas = linhasDeEventos(JSON.parse(fs.readFileSync(path.join(pastaTemp, melhor), "utf8")).events);
    return linhas.length ? linhas : null;
  } finally {
    for (const f of fs.readdirSync(pastaTemp)) if (f.startsWith(id)) fs.rmSync(path.join(pastaTemp, f), { force: true });
  }
}

// → { capitulosAutor, linhas, fonte }
export async function materialDoVideo(id, pastaTemp) {
  const html = await baixar(`https://www.youtube.com/watch?v=${id}&hl=pt`, { timeout: 20000 });
  const capitulosAutor = capitulosDaDescricao(descricaoCompleta(html));
  let linhas = null;
  let fonte = "";
  try {
    linhas = await viaPagina(html);
    if (linhas) fonte = "legendas";
  } catch {}
  if (!linhas) {
    linhas = await viaYtDlp(id, pastaTemp).catch(() => null);
    if (linhas) fonte = "yt-dlp";
  }
  return { capitulosAutor, linhas, fonte };
}

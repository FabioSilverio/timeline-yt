// Guarda tudo em arquivos JSON na pasta de dados (no Windows, D:\TimelineYT\dados).
// Grava de forma atômica (arquivo temporário + rename) e faz um backup por dia.

import fs from "node:fs";
import path from "node:path";
import { CANAIS_INICIAIS, chaveDaSemente } from "./seed.mjs";

export function pastaDeDados() {
  if (process.env.TIMELINE_DADOS) return path.resolve(process.env.TIMELINE_DADOS);
  if (process.platform === "win32" && fs.existsSync("D:\\")) return "D:\\TimelineYT\\dados";
  return path.resolve("dados");
}

export const AJUSTES_PADRAO = {
  esconderShorts: true,
  esconderVistos: true,
  autoplay: true,
  marcarAoTerminar: true,
  intervaloMin: 20,
  diasMax: 21,
  detalhes: true,
  velocidade: 1,
  pesosCategoria: { politica: 1, debates: 1.1, cortes: 1, podcasts: 1, noticias: 0.9, economia: 0.85, eua: 1, geral: 0.9 },
};

function estadoInicial() {
  return {
    versao: 1,
    canais: {},
    pendentes: [],
    sementes: [],
    vistos: {},
    depois: {},
    ocultos: {},
    progresso: {},
    stats: {},
    termos: {},
    interesses: [],
    bloqueios: [],
    ajustes: structuredClone(AJUSTES_PADRAO),
    ultimaVisita: 0,
    visitaAnterior: 0,
    importacoes: [],
  };
}

function lerJson(arquivo, padrao) {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return padrao;
    // arquivo corrompido: tenta o .bak
    try {
      return JSON.parse(fs.readFileSync(arquivo + ".bak", "utf8"));
    } catch {
      throw e;
    }
  }
}

function gravarAtomico(arquivo, dados) {
  const tmp = arquivo + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(dados));
  if (fs.existsSync(arquivo)) fs.copyFileSync(arquivo, arquivo + ".bak");
  fs.renameSync(tmp, arquivo);
}

export class Armazem {
  constructor(dir = pastaDeDados()) {
    this.dir = dir;
    fs.mkdirSync(path.join(dir, "backups"), { recursive: true });
    fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
    this.arqEstado = path.join(dir, "estado.json");
    this.arqVideos = path.join(dir, "videos.json");
    this.estado = { ...estadoInicial(), ...lerJson(this.arqEstado, estadoInicial()) };
    this.estado.ajustes = {
      ...AJUSTES_PADRAO,
      ...this.estado.ajustes,
      pesosCategoria: { ...AJUSTES_PADRAO.pesosCategoria, ...this.estado.ajustes?.pesosCategoria },
    };
    this.videos = lerJson(this.arqVideos, {});
    this.plantarSementes();
    this.timer = null;
  }

  // Canais sugeridos que ainda não entraram (inclusive os adicionados em versões novas)
  plantarSementes() {
    const e = this.estado;
    e.sementes ||= [];
    const feitas = new Set(e.sementes);
    for (const c of CANAIS_INICIAIS) {
      const chave = chaveDaSemente(c);
      if (feitas.has(chave)) continue;
      e.sementes.push(chave);
      e.pendentes.push({
        chave,
        handle: c.handle,
        busca: c.busca,
        nome: c.busca,
        categoria: c.categoria,
        origem: c.origem,
        silenciado: c.origem === "contraponto",
        tentativas: 0,
      });
    }
  }

  salvar() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.salvarAgora(), 1500);
  }

  salvarAgora() {
    clearTimeout(this.timer);
    this.timer = null;
    gravarAtomico(this.arqEstado, this.estado);
    gravarAtomico(this.arqVideos, this.videos);
    this.backupDoDia();
  }

  backupDoDia() {
    const dia = new Date().toISOString().slice(0, 10);
    const alvo = path.join(this.dir, "backups", `estado-${dia}.json`);
    if (fs.existsSync(alvo)) return;
    fs.copyFileSync(this.arqEstado, alvo);
    const antigos = fs
      .readdirSync(path.join(this.dir, "backups"))
      .filter((f) => f.startsWith("estado-"))
      .sort()
      .reverse()
      .slice(14);
    for (const f of antigos) fs.rmSync(path.join(this.dir, "backups", f), { force: true });
  }

  // Tira do cache vídeos velhos que não estão salvos nem em andamento
  limpar(agora = Date.now()) {
    const limite = agora - Math.max(this.estado.ajustes.diasMax, 7) * 2 * 24 * 3600e3;
    for (const [id, v] of Object.entries(this.videos)) {
      if (this.estado.depois[id] || this.estado.progresso[id]) continue;
      if (Date.parse(v.publicado) < limite) delete this.videos[id];
    }
    const umAno = agora - 365 * 24 * 3600e3;
    for (const mapa of [this.estado.vistos, this.estado.ocultos]) {
      for (const [id, ts] of Object.entries(mapa)) if (ts < umAno) delete mapa[id];
    }
  }

  log(msg) {
    const linha = `${new Date().toISOString()} ${msg}\n`;
    try {
      fs.appendFileSync(path.join(this.dir, "logs", "servidor.log"), linha);
    } catch {}
    if (process.stdout.isTTY) process.stdout.write(linha);
  }
}

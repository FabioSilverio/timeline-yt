// Minutagem com IA local (Ollama): a partir da transcrição com tempos, pede ao modelo os
// assuntos do vídeo com o minuto em que cada um começa, mais um resumo curto.

import { segundos } from "./legendas.mjs";

const PREFERIDOS = [/qwen2\.5:(7|14)b/, /qwen3/, /qwen2\.5/, /llama3\.1/, /llama3/, /gemma/, /mistral/];

export async function modelosDoOllama(url) {
  const res = await fetch(url.replace(/\/+$/, "") + "/api/tags", { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Ollama respondeu ${res.status}`);
  const json = await res.json();
  return (json.models || []).map((m) => m.name).filter((n) => !/embed/i.test(n));
}

export function escolherModelo(modelos, preferido) {
  if (preferido && modelos.includes(preferido)) return preferido;
  for (const re of PREFERIDOS) {
    const m = modelos.find((n) => re.test(n));
    if (m) return m;
  }
  return modelos[0] || null;
}

const hhmmss = (s) => {
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return h ? `${h}:${m}:${ss}` : `${m}:${ss}`;
};

// Cabe num contexto de ~8 mil tokens: no máximo ~220 linhas de até 180 caracteres
export function textoDaTranscricao(linhas, maxLinhas = 220, maxChars = 180) {
  let usadas = linhas;
  if (linhas.length > maxLinhas) {
    const passo = linhas.length / maxLinhas;
    usadas = Array.from({ length: maxLinhas }, (_, i) => linhas[Math.floor(i * passo)]);
  }
  return usadas.map((l) => `[${hhmmss(l.s)}] ${l.texto.slice(0, maxChars)}`).join("\n");
}

export function validarCapitulos(lista, duracao) {
  const out = [];
  for (const c of Array.isArray(lista) ? lista : []) {
    const s = typeof c.inicio === "number" ? c.inicio : segundos(c.inicio ?? c.tempo ?? "");
    const t = String(c.titulo ?? c.assunto ?? "").trim().slice(0, 90);
    if (s == null || !t || s < 0 || (duracao && s >= duracao)) continue;
    out.push({ s: Math.floor(s), t });
  }
  out.sort((a, b) => a.s - b.s);
  const limpos = out.filter((c, i) => i === 0 || c.s - out[i - 1].s >= 20).slice(0, 15);
  if (limpos.length && limpos[0].s > 0) limpos[0].s = 0;
  return limpos;
}

export async function gerarMinutagem({ url, modelo, titulo, canal, duracao, linhas }) {
  const prompt = `Título: ${titulo}
Canal: ${canal}
Duração: ${hhmmss(duracao || linhas[linhas.length - 1]?.s || 0)}

Transcrição (cada linha começa com o tempo em que a fala começa):
${textoDaTranscricao(linhas)}

Monte a minutagem deste vídeo. Responda só com JSON neste formato:
{"resumo": "duas frases dizendo do que o vídeo trata", "capitulos": [{"inicio": "00:00", "titulo": "assunto"}]}
Regras:
- de 3 a 12 capítulos, mais ou menos um a cada 3 a 10 minutos, conforme a duração;
- o primeiro começa em 00:00; os tempos ficam em ordem e são tempos que aparecem na transcrição;
- títulos curtos (até 8 palavras) e específicos: nomes de pessoas, temas, perguntas discutidas;
- em português; não invente nada que não esteja na transcrição.`;

  const res = await fetch(url.replace(/\/+$/, "") + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10 * 60e3),
    body: JSON.stringify({
      model: modelo,
      stream: false,
      format: "json",
      keep_alive: "10m",
      options: { temperature: 0.2, num_ctx: 8192 },
      messages: [
        { role: "system", content: "Você cria minutagens (capítulos) de vídeos brasileiros de política, debates e podcasts. Responde só JSON válido." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  let dados;
  try {
    dados = JSON.parse(json.message?.content || "{}");
  } catch {
    throw new Error("a IA não devolveu JSON válido");
  }
  const capitulos = validarCapitulos(dados.capitulos, duracao);
  if (capitulos.length < 2) throw new Error("a IA não encontrou assuntos suficientes");
  return { capitulos, resumo: String(dados.resumo || "").trim().slice(0, 400) };
}

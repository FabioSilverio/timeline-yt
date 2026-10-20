// Ordem final do feed, no navegador (também usado nos testes do servidor).
// O servidor dá a nota de cada vídeo; aqui a lista é:
//   1. agrupada: o mesmo assunto coberto por vários canais vira um card só ("+3 sobre isso")
//   2. diversificada: nada de cinco vídeos seguidos sobre o mesmo tema ou do mesmo canal
//   3. temperada: de tempos em tempos entra um canal que você ainda não explorou

const HORA = 3600e3;

export function similaridade(a, b) {
  const A = a.chaves || [];
  const B = new Set(b.chaves || []);
  if (!A.length || !B.size) return 0;
  let comum = 0;
  for (const w of A) if (B.has(w)) comum++;
  const uniao = A.length + B.size - comum;
  return uniao ? comum / uniao : 0;
}

function mesmoAssunto(a, b) {
  const A = a.chaves || [];
  const B = new Set(b.chaves || []);
  let comum = 0;
  for (const w of A) if (B.has(w)) comum++;
  // três palavras-chave em comum (fora as vazias) e perto no tempo = mesma notícia
  if (comum < 3) return false;
  const perto = Math.abs(Date.parse(a.publicado) - Date.parse(b.publicado)) < 72 * HORA;
  return perto && (comum >= 4 || similaridade(a, b) >= 0.25);
}

// Lista já em ordem de nota → representantes, cada um com .similares (os outros do mesmo assunto).
// Índice palavra → grupos, para não comparar cada vídeo com todos os outros.
export function agrupar(lista) {
  const reps = [];
  const indice = new Map();
  for (const v of lista) {
    const candidatos = new Set();
    for (const w of v.chaves || []) for (const r of indice.get(w) || []) candidatos.add(r);
    let rep = null;
    for (const r of candidatos) {
      if (r.canal !== v.canal ? mesmoAssunto(r, v) : similaridade(r, v) >= 0.6) {
        rep = r;
        break;
      }
    }
    if (rep) {
      rep.similares.push(v);
      continue;
    }
    const novo = { ...v, similares: [] };
    reps.push(novo);
    for (const w of v.chaves || []) {
      if (!indice.has(w)) indice.set(w, []);
      indice.get(w).push(novo);
    }
  }
  return reps;
}

// Escolha gulosa (estilo MMR): a cada posição, o melhor candidato depois de descontar
// a parecença com o que acabou de aparecer, canal repetido e tema saturado.
export function diversificar(lista, { janela = 30, explorar = 6 } = {}) {
  const resto = [...lista];
  const out = [];
  let desdeExploracao = 0;
  while (resto.length) {
    const ultimos = out.slice(-10);
    const canaisRecentes = new Set(out.slice(-4).map((v) => v.canal));
    const contagem = new Map();
    for (const v of out.slice(-8)) for (const w of v.chaves || []) contagem.set(w, (contagem.get(w) || 0) + 1);

    // de tempos em tempos, um canal pouco explorado
    if (explorar && desdeExploracao >= explorar) {
      const i = resto.findIndex((v, j) => j < 80 && v.explorar && !canaisRecentes.has(v.canal));
      if (i >= 0) {
        out.push({ ...resto.splice(i, 1)[0], paraVariar: true });
        desdeExploracao = 0;
        continue;
      }
    }

    let melhor = 0;
    let melhorNota = -Infinity;
    const n = Math.min(janela, resto.length);
    for (let i = 0; i < n; i++) {
      const v = resto[i];
      let nota = v.nota;
      let parecido = 0;
      for (const u of ultimos) parecido = Math.max(parecido, similaridade(v, u));
      nota *= 1 - 0.75 * parecido;
      if (canaisRecentes.has(v.canal)) nota *= 0.3;
      // tema (ou pessoa) que já apareceu 2 vezes nos últimos 8 cards perde força
      let saturados = 0;
      for (const w of v.chaves || []) if ((contagem.get(w) || 0) >= 2) saturados++;
      nota *= Math.max(0.2, Math.pow(0.55, saturados));
      if (nota > melhorNota) {
        melhorNota = nota;
        melhor = i;
      }
    }
    out.push(resto.splice(melhor, 1)[0]);
    desdeExploracao++;
  }
  return out;
}

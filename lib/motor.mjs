// Atualização periódica: resolve canais pendentes, lê os feeds, busca duração dos vídeos novos.
// Tudo com pouca concorrência e pausas, para não chamar atenção do YouTube no IP de casa.

import * as yt from "./youtube.mjs";
import {
  lerTakeoutJson,
  lerTakeoutHtml,
  lerInscricoesCsv,
  lerPagina,
  resumirHistorico,
  categoriaPeloNome,
} from "./historico.mjs";

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function emLotes(itens, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, itens.length) }, async () => {
      while (i < itens.length) {
        const item = itens[i++];
        try {
          await fn(item);
        } catch {}
      }
    }),
  );
}

export class Motor {
  constructor(armazem) {
    this.a = armazem;
    this.status = { rodando: false, etapa: "", ultima: 0, ok: 0, falhas: 0, pendentes: 0, semDuracao: 0 };
    this.filaDetalhes = [];
    this.detalhando = false;
  }

  get e() {
    return this.a.estado;
  }

  iniciar() {
    const ciclo = async () => {
      await this.atualizar().catch((err) => this.a.log("erro no ciclo: " + err.message));
      setTimeout(ciclo, Math.max(5, this.e.ajustes.intervaloMin) * 60e3);
    };
    ciclo();
  }

  async atualizar() {
    if (this.status.rodando) return this.status;
    this.status.rodando = true;
    try {
      await this.resolverPendentes();
      await this.lerFeeds();
      this.a.limpar();
      this.a.salvar();
      this.status.ultima = Date.now();
      this.agendarDetalhes();
    } finally {
      this.status.rodando = false;
      this.status.etapa = "";
    }
    return this.status;
  }

  async resolverPendentes() {
    const fila = this.e.pendentes.filter((p) => (p.tentativas || 0) < 4);
    this.status.pendentes = fila.length;
    if (!fila.length) return;
    this.status.etapa = `achando ${fila.length} canal(is)`;
    await emLotes(fila, 2, async (p) => {
      try {
        const info = await yt.resolverCanal(p);
        await pausa(700);
        if (!info) throw new Error("não encontrado");
        this.adicionarCanal(info, p);
        this.e.pendentes = this.e.pendentes.filter((x) => x !== p);
      } catch (err) {
        p.tentativas = (p.tentativas || 0) + 1;
        p.erro = err.message;
      }
    });
    this.status.pendentes = this.e.pendentes.length;
    this.a.salvar();
  }

  adicionarCanal(info, extra = {}) {
    const atual = this.e.canais[info.id];
    const c = {
      id: info.id,
      titulo: info.titulo || extra.nome || atual?.titulo || "",
      handle: info.handle || atual?.handle || extra.handle || "",
      foto: info.foto || atual?.foto || "",
      categoria: atual?.categoria || extra.categoria || categoriaPeloNome(info.titulo || extra.nome),
      origem: atual?.origem && atual.origem !== "semelhante" ? atual.origem : extra.origem || "manual",
      peso: atual?.peso ?? 0,
      silenciado: atual ? atual.silenciado : !!extra.silenciado,
      vezesNoHistorico: Math.max(atual?.vezesNoHistorico || 0, extra.vezesNoHistorico || 0),
      adicionado: atual?.adicionado || Date.now(),
      erro: null,
    };
    this.e.canais[c.id] = c;
    return c;
  }

  async lerFeeds(ids = Object.keys(this.e.canais)) {
    let ok = 0;
    let falhas = 0;
    this.status.etapa = `lendo ${ids.length} canais`;
    await emLotes(ids, 5, async (id) => {
      const canal = this.e.canais[id];
      if (!canal) return;
      try {
        const { canal: info, videos } = await yt.feedDoCanal(id);
        if (info.titulo && !canal.titulo) canal.titulo = info.titulo;
        for (const v of videos) {
          const antigo = this.a.videos[v.id];
          this.a.videos[v.id] = {
            ...antigo,
            ...v,
            duracao: antigo?.duracao ?? null,
            aoVivo: antigo?.aoVivo ?? false,
            visto1: antigo?.visto1 || Date.now(),
          };
        }
        canal.ultimaLeitura = Date.now();
        canal.erro = null;
        ok++;
      } catch (err) {
        canal.erro = err.message;
        falhas++;
      }
    });
    this.status.ok = ok;
    this.status.falhas = falhas;
  }

  // Duração dos vídeos (para separar cortes curtos de podcasts longos). Um por vez, devagar.
  agendarDetalhes() {
    if (!this.e.ajustes.detalhes) return;
    const limite = Date.now() - 10 * 24 * 3600e3;
    this.filaDetalhes = Object.values(this.a.videos)
      .filter((v) => v.duracao == null && !v.short && !v.semDetalhes && Date.parse(v.publicado) > limite)
      .sort((a, b) => Date.parse(b.publicado) - Date.parse(a.publicado))
      .map((v) => v.id);
    this.status.semDuracao = this.filaDetalhes.length;
    if (!this.detalhando) this.detalhar();
  }

  async detalhar() {
    this.detalhando = true;
    let feitos = 0;
    while (this.filaDetalhes.length && feitos < 300) {
      const id = this.filaDetalhes.shift();
      const v = this.a.videos[id];
      if (!v) continue;
      try {
        const d = await yt.detalhesDoVideo(id);
        v.duracao = d.duracao;
        v.aoVivo = d.aoVivo;
        v.agendado = d.agendado;
        if (d.duracao == null) v.semDetalhes = true;
      } catch (err) {
        v.semDetalhes = true;
        if (err.status === 429) {
          this.a.log("YouTube pediu calma (429); pausando detalhes por 30 min");
          await pausa(30 * 60e3);
        }
      }
      feitos++;
      this.status.semDuracao = this.filaDetalhes.length;
      if (feitos % 20 === 0) this.a.salvar();
      await pausa(2500 + Math.random() * 1500);
    }
    this.a.salvar();
    this.detalhando = false;
  }

  // ---- canais pela interface ----

  async adicionarPorTexto(texto, categoria) {
    const ref = yt.interpretarEntrada(texto);
    const info = await yt.resolverCanal(ref);
    if (!info) throw new Error("Canal não encontrado. Cole o link do canal (youtube.com/@...).");
    const c = this.adicionarCanal(info, { categoria, origem: "manual" });
    c.silenciado = false;
    if (categoria) c.categoria = categoria;
    await this.lerFeeds([c.id]);
    this.a.salvar();
    return c;
  }

  // ---- importação ----

  importar(tipo, conteudo) {
    let itens = [];
    let canaisSoltos = [];
    let marcarVistos = false;
    if (tipo === "takeout-json") {
      itens = lerTakeoutJson(conteudo);
      marcarVistos = true;
    } else if (tipo === "takeout-html") {
      itens = lerTakeoutHtml(conteudo);
      marcarVistos = true;
    } else if (tipo === "inscricoes-csv") {
      canaisSoltos = lerInscricoesCsv(conteudo).map((c) => ({ ...c, origem: "inscricao" }));
    } else if (tipo === "pagina") {
      const r = lerPagina(typeof conteudo === "string" ? JSON.parse(conteudo) : conteudo);
      itens = r.itens;
      marcarVistos = r.ehHistorico;
      canaisSoltos = r.canais.map((c) => ({ ...c, origem: c.inscrito ? "inscricao" : "historico" }));
    } else {
      throw new Error("tipo de importação desconhecido");
    }

    const resumo = resumirHistorico(itens);
    const agora = Date.now();
    if (marcarVistos) for (const it of itens) if (it.video && !this.e.vistos[it.video]) this.e.vistos[it.video] = it.quando || agora;

    // Mistura os termos novos com os que já existiam
    for (const [w, n] of Object.entries(resumo.termos)) this.e.termos[w] = Math.max(this.e.termos[w] || 0, n);

    let novos = 0;
    const considerar = [
      ...resumo.canais.filter((c) => c.peso >= 1.5 || c.vezes >= 2 || itens.length < 60).slice(0, 120).map((c) => ({ ...c, origem: "historico" })),
      ...canaisSoltos,
    ];
    for (const c of considerar) {
      const vezes = c.vezes || 0;
      if (c.id && this.e.canais[c.id]) {
        const atual = this.e.canais[c.id];
        atual.vezesNoHistorico = Math.max(atual.vezesNoHistorico || 0, vezes);
        if (atual.origem === "semelhante" || atual.origem === "contraponto") atual.origem = c.origem;
        if (c.origem === "historico") atual.silenciado = false;
        continue;
      }
      const chave = c.id || "@" + (c.handle || "").toLowerCase();
      if (this.e.pendentes.some((p) => p.chave === chave || (c.id && p.id === c.id))) continue;
      this.e.pendentes.push({
        chave,
        id: c.id,
        handle: c.handle,
        busca: c.id ? undefined : c.nome || c.handle,
        nome: c.nome,
        categoria: categoriaPeloNome(c.nome),
        origem: c.origem,
        vezesNoHistorico: vezes,
        tentativas: 0,
      });
      novos++;
    }
    this.e.importacoes.unshift({ quando: agora, tipo, itens: itens.length, canais: considerar.length, novos });
    this.e.importacoes = this.e.importacoes.slice(0, 30);
    this.a.salvar();
    setTimeout(() => this.atualizar().catch(() => {}), 500);
    return { itens: itens.length, canais: considerar.length, novos, termos: Object.keys(resumo.termos).slice(0, 15) };
  }
}

// Atualização automática: a cada 15 minutos confere o GitHub. Se houver versão nova,
// faz "git merge --ff-only" e encerra o processo; o vigia (windows/manter-ativo.ps1)
// sobe o servidor de novo em até 20 segundos, já com o código novo. Os dados não mudam.

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function git(raiz, args, timeout = 60000) {
  return new Promise((ok, falha) =>
    execFile("git", ["-C", raiz, ...args], { timeout, windowsHide: true }, (err, stdout, stderr) =>
      err ? falha(new Error((stderr || err.message).trim())) : ok(stdout.trim()),
    ),
  );
}

export class Atualizador {
  constructor(raiz, { log, antesDeSair }) {
    this.raiz = raiz;
    this.log = log;
    this.antesDeSair = antesDeSair;
    this.info = { commit: "", data: "", verificado: 0, atrasado: 0, erro: "", ativo: false };
  }

  get disponivel() {
    return fs.existsSync(path.join(this.raiz, ".git"));
  }

  async lerVersao() {
    if (!this.disponivel) return this.info;
    try {
      const [commit, data] = (await git(this.raiz, ["log", "-1", "--format=%h|%cI"])).split("|");
      Object.assign(this.info, { commit, data });
    } catch (e) {
      this.info.erro = e.message;
    }
    return this.info;
  }

  async verificar({ aplicar = true } = {}) {
    if (!this.disponivel) return { ...this.info, erro: "pasta sem git" };
    try {
      await git(this.raiz, ["fetch", "--quiet", "origin", "main"]);
      this.info.atrasado = Number(await git(this.raiz, ["rev-list", "--count", "HEAD..origin/main"])) || 0;
      this.info.verificado = Date.now();
      this.info.erro = "";
      if (this.info.atrasado && aplicar) {
        const sujo = await git(this.raiz, ["status", "--porcelain", "--untracked-files=no"]);
        if (sujo) throw new Error("há arquivos alterados à mão na pasta do app; atualização automática pulada");
        await git(this.raiz, ["merge", "--ff-only", "--quiet", "origin/main"]);
        await this.lerVersao();
        this.log(`atualizado para ${this.info.commit}; reiniciando`);
        setTimeout(() => {
          this.antesDeSair?.();
          process.exit(0);
        }, 1500);
        return { ...this.info, aplicado: true };
      }
    } catch (e) {
      this.info.erro = e.message;
      this.log("atualização automática: " + e.message);
    }
    return this.info;
  }

  iniciar(intervaloMin = 15) {
    if (!this.disponivel || process.env.TIMELINE_SEM_AUTOATUALIZAR) return;
    this.info.ativo = true;
    setTimeout(() => this.verificar(), 2 * 60e3);
    setInterval(() => this.verificar(), intervaloMin * 60e3);
  }
}

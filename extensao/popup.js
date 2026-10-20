// Popup da extensão: login, números da timeline, importar a aba e preferências.
const $ = (s) => document.querySelector(s);

function mandar(msg) {
  return new Promise((ok, falha) =>
    chrome.runtime.sendMessage(msg, (r) => (r?.ok ? ok(r.dados) : falha(new Error(r?.erro || "falhou")))),
  );
}

async function iniciar() {
  const cfg = await mandar({ tipo: "cfg" });
  $("#servidor").value = cfg.servidor;
  if (!cfg.token) {
    $("#tela-entrar").hidden = false;
    $("#senha").focus();
    return;
  }
  $("#tela-principal").hidden = false;
  const url = cfg.servidor;
  $("#abrir").href = url + "/#/inicio";
  $("#n-novos").href = url + "/#/inicio";
  $("#n-depois").href = url + "/#/depois";
  $("#n-continuar").href = url + "/#/continuar";
  for (const k of ["botoes", "marcarMiniaturas", "autoVisto"]) {
    $("#" + k).checked = !!cfg[k];
    $("#" + k).onchange = (e) => chrome.storage.local.set({ [k]: e.target.checked });
  }
  try {
    const r = await mandar({ tipo: "resumo" });
    $("#n-novos b").textContent = r.novos;
    $("#n-depois b").textContent = r.depois;
    $("#n-continuar b").textContent = r.continuar;
  } catch (e) {
    $("#resultado").textContent = e.message;
    $("#resultado").className = "erro";
  }
}

$("#tela-entrar").onsubmit = async (e) => {
  e.preventDefault();
  $("#erro-entrar").textContent = "";
  try {
    await mandar({ tipo: "entrar", servidor: $("#servidor").value, senha: $("#senha").value });
    location.reload();
  } catch (err) {
    $("#erro-entrar").textContent = err.message;
  }
};

async function importar(rolar) {
  const btns = [$("#importar"), $("#importar-tudo")];
  btns.forEach((b) => (b.disabled = true));
  $("#resultado").className = "resultado";
  $("#resultado").textContent = rolar ? "Rolando a página e coletando… (pode levar 1 minuto)" : "Enviando…";
  try {
    const r = await mandar({ tipo: "importarAba", rolar });
    $("#resultado").textContent = `${r.itens} vídeos e ${r.canais} canais enviados · ${r.novos} canais novos.`;
  } catch (e) {
    $("#resultado").className = "erro";
    $("#resultado").textContent = e.message;
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}
$("#importar").onclick = () => importar(false);
$("#importar-tudo").onclick = () => importar(true);
$("#sair").onclick = async () => {
  await mandar({ tipo: "sair" });
  location.reload();
};

iniciar();

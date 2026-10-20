document.getElementById("f").onsubmit = async (e) => {
      e.preventDefault();
      const erro = document.getElementById("erro");
      erro.textContent = "";
      const res = await fetch("/api/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha: document.getElementById("senha").value }),
      });
      if (res.ok) location.reload();
      else erro.textContent = (await res.json().catch(() => ({}))).erro || "Não deu certo.";
    };

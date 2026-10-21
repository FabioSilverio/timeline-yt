# Timeline YT

Sua timeline do YouTube, com cara própria: cortes, debates, política e podcasts
dos canais que você assiste (e de canais parecidos), ranqueados pelo seu histórico.
Marque como visto, guarde para depois, continue de onde parou.

Roda no seu PC, com os dados em **D:\TimelineYT**, e sai para a internet por um túnel
próprio da Cloudflare em **https://yt.faaretz.site** (separado do túnel dos outros projetos).

## O que tem

- **Seções**: **Agora** em prateleiras (destaque, Continue assistindo, Cortes rápidos, Debates e tretas,
  Na sua fila, Podcasts e entrevistas, Política americana, Para variar, e embaixo "Mais para você"), e as
  seções **Cortes**, **Debates**, **Podcasts** e **EUA**, cada uma com filtros próprios (ex.: Cortes →
  Brasil, EUA, Debates e tretas, De podcasts, Notícias, Até 5 min). **🔥 Em alta**: os assuntos que vários
  canais estão cobrindo nas últimas 48 h; um toque mostra tudo sobre aquele assunto.
- **Agora**: o feed. Um destaque no topo ("sua melhor escolha agora") e cards com ações sempre à mão:
  **Vi**, **Fila** e **Menos**. O que você marca sai do feed na hora, com animação e "Desfazer".
  No celular dá para arrastar o card: para a direita vai para a fila, para a esquerda marca como visto.
- **O algoritmo**: cada vídeo ganha uma nota (afinidade com o canal pelo seu histórico e pelos sinais da
  extensão, frescor, peso da categoria, assuntos de interesse, alcance). Depois, no navegador:
  - **agrupa o mesmo assunto**: a mesma notícia em vários canais vira um card só, com "+3 sobre isso";
  - **diversifica**: desconta o que é parecido com o que acabou de aparecer, evita canal repetido e tema
    saturado (o mesmo termo em 3 dos últimos 10);
  - **cansaço**: o que apareceu na tela em várias visitas e você passou direto perde força rápido, e
    depois de 3 visitas sai do Agora (continua em Recentes);
  - **programas completos de TV** (jornais inteiros, lives, edições com data no título) ficam fora do
    feed por padrão, e os cortes desses canais ganham força. Dá para mudar em Ajustes ou ver pelo filtro
    "Programas completos";
  - **para variar**: de vez em quando entra um canal que você ainda não explorou.
- **Filtros**: Cortes, Debates, Podcasts, Política, EUA, Notícias, Economia, Ao vivo, Rápidos (até 20 min),
  Longos (40 min ou mais), Novos.
- **Recentes** (cronológico), **Fila** (assistir depois, com "Tocar a fila"), **Continuar**, **Vistos**, **Ocultos**.
- **Player** com velocidade, retomada de onde parou, "Vi · próximo", "Menos disso", fila "A seguir".
- **Canais**, **Importar histórico** e **Ajustes** (pesos por categoria, assuntos preferidos, palavras
  bloqueadas, sinais dados, backup, versão).
- Atalhos: `j`/`k` navegar, `Enter` assistir, `v` vi, `f` fila, `x` menos, `/` buscar, `r` atualizar, `n` próximo.
- **Minutagem com IA local (Ollama)**: para vídeos com mais de 6 minutos, o servidor lê as legendas
  (ou usa o yt-dlp, se estiver instalado) e pede ao Ollama do PC os assuntos com o minuto em que cada um
  começa, mais um resumo. No player, os assuntos viram botões que pulam para aquele trecho, e o assunto
  que está passando fica destacado; no feed, o card mostra "📑 N assuntos" e a busca encontra pelos assuntos.
  Se o autor já pôs capítulos na descrição, eles são usados. Roda sozinho para a fila e o topo do feed
  (um por vez, em segundo plano) e na hora para o vídeo que você abre. Configuração em Ajustes → IA local
  (endereço do Ollama, modelo; o padrão escolhe um qwen2.5/llama3 que estiver baixado).
- **Player**: "Da sua fila · 3 de 12", Anterior/Próximo, minimizar (o vídeo segue tocando no canto enquanto
  você navega), e o "voltar" do celular minimiza em vez de sair do site. Assistir 20 s conta como visto
  e tira o vídeo da fila; se parar no meio, ele fica em Continuar.
- **Atualiza sozinho**: a cada 15 minutos o servidor confere o GitHub; se houver versão nova, ele se
  atualiza e reinicia (o vigia sobe de novo em segundos). Em Ajustes → Versão dá para forçar.
- Senha de acesso (o site fica público pelo túnel). Você entra uma vez em cada aparelho e fica logado.

## Extensão do Chrome (`extensao/`)

- Botões **+** (mais disso), **⏱** (assistir depois) e **−** (menos disso) em cada miniatura do YouTube
  (início, busca, recomendados, canais) e uma barra embaixo do vídeo aberto. "Mais disso" aumenta o peso
  do canal e dos assuntos do título; se o canal ainda não está na lista, ele entra na hora.
- O que você assiste no YouTube (70% do vídeo ou 5 minutos, sem contar anúncios) vira **visto** na timeline
  e ensina o algoritmo, sem precisar importar nada.
- Selo nas miniaturas do que já está visto ou salvo na timeline.
- Popup: novos / depois / continuar, abrir a timeline, importar a aba atual (com opção de rolar a página
  inteira do histórico ou das inscrições) e preferências.
- Atalhos no vídeo aberto: `Alt+Shift+M` mais, `Alt+Shift+D` depois, `Alt+Shift+X` menos.
  Botão direito em qualquer link de vídeo, em qualquer site, também sinaliza.
- Ícone com o número de vídeos novos (confere a cada 15 min).

Instalar: `chrome://extensions` → ligar **Modo do desenvolvedor** → **Carregar sem compactação** →
pasta `D:\TimelineYT\app\extensao`. Clique no ícone e entre com o endereço e a senha (uma vez).

## Instalação no PC (Windows)

1. No PowerShell (precisa do Git e do Node 20+):
   ```powershell
   git clone https://github.com/FabioSilverio/timeline-yt D:\TimelineYT\app
   powershell -ExecutionPolicy Bypass -File D:\TimelineYT\app\windows\instalar.ps1
   ```
   O script:
   - cria **D:\TimelineYT\dados** (estado, cache de vídeos, logs, backups diários) e a senha em `dados\acesso.txt`;
   - cria um túnel **novo** da Cloudflare chamado `timeline-yt` (credenciais e config em
     `D:\TimelineYT\cloudflared`) e aponta `yt.faaretz.site` para ele. O túnel `jellyfin` e o
     `config.yml` dos outros projetos não são tocados;
   - registra a tarefa **TimelineYT**, que sobe tudo escondido quando você entra no Windows e reinicia
     se cair.
   Opções: `-Dominio outro.faaretz.site`, `-Porta 3220`, `-SemTunel` (só acesso local).
2. Abra http://127.0.0.1:3220, entre com a senha e vá em **Importar histórico**.

Para atualizar: `windows\atualizar.ps1` (puxa do GitHub e reinicia o servidor).
Para parar: `windows\parar.ps1` (com `-Remover` tira também a tarefa agendada). Os dados ficam.

Nada é gravado no C:, exceto a tarefa agendada do Windows e o login da Cloudflare que já existia
(`%USERPROFILE%\.cloudflared\cert.pem`, usado só para criar o túnel e o DNS).

## Como funciona

- Sem chave de API: os vídeos vêm do feed RSS público de cada canal
  (`youtube.com/feeds/videos.xml?channel_id=...`), lido a cada 20 minutos.
- A duração de cada vídeo novo é lida devagar (um a cada ~3 s) da página do vídeo, para separar cortes
  de podcasts longos. Dá para desligar em Ajustes.
- Canais sugeridos são achados pelo @ ou pelo nome na primeira execução. Se algum vier errado ou não
  for achado, corrija em **Canais** colando o link certo.
- Sem dependências: só Node 18+. `npm test` roda os testes; `npm run demo` sobe com um YouTube
  simulado (útil sem internet).

```
server.mjs           servidor HTTP, login, API
lib/youtube.mjs      RSS, achar canais, duração
lib/ranking.mjs      o algoritmo da timeline
lib/historico.mjs    importação (Takeout, favorito) e resumo do histórico
lib/motor.mjs        atualização periódica e filas
lib/armazem.mjs      gravação em D:\TimelineYT\dados (atômica + backup diário)
lib/seed.mjs         canais sugeridos
public/              interface
windows/             instalar, manter ativo, parar
```

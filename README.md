# Timeline YT

Sua timeline do YouTube, no estilo do próprio YouTube: cortes, debates, política e podcasts
dos canais que você assiste (e de canais parecidos), ranqueados pelo seu histórico.
Marque como visto, guarde para depois, continue de onde parou.

Roda no seu PC, com os dados em **D:\TimelineYT**, e sai para a internet por um túnel
próprio da Cloudflare em **https://yt.faaretz.site** (separado do túnel dos outros projetos).

## O que tem

- **Para você**: o "algoritmo". Cada vídeo ganha uma nota que junta afinidade com o canal
  (quantas vezes ele aparece no seu histórico, o que você marca como visto, salva ou oculta),
  frescor, peso da categoria, assuntos que você curte e alcance. Canais repetidos são intercalados.
  Cada vídeo mostra o motivo ("você viu 23 vídeos deste canal · fala de lula, debate").
- **Filtros**: Cortes, Debates, Podcasts, Política, Notícias, Economia, EUA, Ao vivo, até 20 min, mais de 40 min, Novos.
- **Recentes** (cronológico, agrupado por dia), **Continuar assistindo**, **Assistir depois** (fila, com
  "Reproduzir esta lista"), **Histórico** (agrupado por dia, como no YouTube), **Ocultos**.
- **Player embutido** com velocidade (1x a 2x), retomada de onde parou, barra vermelha de progresso,
  "Visto e próximo", autoplay da lista e marcação automática como visto ao terminar.
- **Canais**: ~107 canais já sugeridos (do seu histórico, política, debates, podcasts famosos, canais de
  cortes, política americana (Asmongold, Benny Johnson, Tucker, Shapiro, Timcast, PBD, Jubilee...), e um grupo "contraponto" que começa silenciado). Adicione qualquer canal colando o link;
  ajuste prioridade (menos/mais), categoria, silencie ou remova.
- **Importar histórico**: favorito "Enviar para a Timeline" (roda em youtube.com/feed/history e
  /feed/channels) ou arquivos do Google Takeout (watch-history.json/.html e subscriptions.csv).
  Os canais mais vistos entram sozinhos e as palavras que mais aparecem viram assuntos de interesse.
- **Ajustes**: esconder vistos/Shorts, intervalo de atualização, peso por categoria, assuntos
  preferidos, palavras bloqueadas, backup e restauração.
- Atalhos: `j`/`k` navegar, `Enter` assistir, `v` visto, `d` depois, `x` ocultar, `/` buscar, `r` atualizar, `n` próximo.
- Senha de acesso (o site fica público pelo túnel). Você entra uma vez em cada aparelho e fica logado (a sessão é renovada a cada visita). Funciona no celular (dá para "adicionar à tela inicial").

## Instalação no PC (Windows)

1. Copie esta pasta para **D:\TimelineYT\app**.
2. No PowerShell:
   ```powershell
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
3. Abra http://127.0.0.1:3220, entre com a senha e vá em **Importar histórico**.

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

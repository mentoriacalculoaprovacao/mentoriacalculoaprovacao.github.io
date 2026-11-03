# Página do app de mentoria — instruções para o Claude

- Página estática (GitHub Pages). Sem build: HTML, CSS e JS puros, compatíveis com navegadores de celular.
- **Nunca coloque dados de alunos, IDs de planilhas ou segredos aqui** (repositório público). Tudo vem da API depois do login.
- A regra de quem vê o quê fica no servidor (`sistema-mentoria/apps-script/API.gs`); a página só desenha.
- Chamadas: `POST` em `CONFIG.API_URL` com corpo JSON e `Content-Type: text/plain` (evita preflight de CORS no Apps Script).
- Ao publicar mudança em `assets/` ou `config.js`, aumente o `?v=` nos links do `index.html` (o navegador guarda os arquivos por ~10 min).
- Antes de commitar: `node --check assets/*.js` e `node testes/teste_api_simulada.js` (sem erros no console, três papéis).
- Textos em português do Brasil, tom direto e acolhedor; o painel do aluno fala com ele ("você"), o do mentor fala do aluno.
- Mudou a API? Atualize os dois repositórios no mesmo dia e publique o Apps Script antes da página.

# Mentoria · Cálculo Aprovação — página do app

Página pública do app de mentoria: https://mentoriacalculoaprovacao.github.io

**Não há dados aqui.** A página só mostra o que o servidor (Apps Script, repositório privado `sistema-mentoria`) devolve
depois do login com Google ou do código de acesso, e o servidor confere o papel de quem pede (aluno, mentor, gestor).

| Arquivo | Função |
|---|---|
| `index.html` | estrutura da página |
| `config.js` | endereço do servidor (`API_URL`) e ID do cliente do login Google (`GOOGLE_CLIENT_ID`) — nada secreto |
| `assets/painel.js` | painel visual do aluno (níveis, gráfico, onde focar) |
| `assets/app.js` | login, lista de alunos (mentor/gestor), abas Painel e Diagnóstico, atribuir mentor |
| `assets/estilo.css` | visual |
| `testes/teste_api_simulada.js` | teste com a API simulada: `node testes/teste_api_simulada.js` (precisa do Playwright) |

Publicação: todo commit na branch `main` é publicado pelo GitHub Pages em cerca de 1 minuto.

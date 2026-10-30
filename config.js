// Configuração pública do app (nada aqui é segredo: o servidor confere tudo).
// API_URL: endereço /exec do App da Web do Apps Script (Implantar → Gerenciar implantações).
// GOOGLE_CLIENT_ID: ID do cliente OAuth do Google Cloud (tipo "Aplicativo da Web", origem https://mentoriacalculoaprovacao.github.io).
//   Vazio = o app aceita só o código de acesso. O mesmo ID precisa estar na aba "App — configurações" (célula B37).
window.CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbzu65pzk9LJZDLTIQuhhbgtlxcMoVlLLjADOHDHz6ZrMQUzG0sbUbDWYGoHJqih0p3h_A/exec',
  GOOGLE_CLIENT_ID: ''
};

// Fluxo do app: login (Google ou código), caixas do aluno, lista de alunos (mentor e gestor) e abas de cada aluno.
// Toda regra de quem vê o quê fica no servidor (Apps Script, API.gs): esta página só mostra o que ele devolve.
(function () {
  var C = window.CONFIG || {};
  var P = window.Painel, R = window.Registros, el = P.el, norm = P.norm;
  var app = document.getElementById('app');
  var topoDir = document.getElementById('topo-dir');
  var atualizadoEl = document.getElementById('atualizado');
  var CHAVE_SESSAO = 'mentoria_sessao';
  var est = { sessao: null, inicio: null, cache: {}, atual: null, aba: 'painel', abaAluno: ler('mentoria_aba_aluno') || 'painel', filtro: 'todos', busca: '', cfg: { aceitaCodigo: true, google: false } };
  function googleLigado() { return !!(C.GOOGLE_CLIENT_ID && est.cfg.google); }

  function ler(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function gravar(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { } }

  // ---------- Conversa com o servidor ----------
  function api(acao, dados) {
    var corpo = { acao: acao, sessao: est.sessao };
    for (var k in (dados || {})) corpo[k] = dados[k];
    return fetch(C.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corpo), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (d) {
        if (d && d.erro === 'sessao' && acao !== 'entrar') { encerrar('Sua sessão expirou. Entre de novo.'); throw new Error('sessao'); }
        return d;
      });
  }

  function carregando(txt) { app.innerHTML = ''; app.appendChild(el('p', { class: 'carregando', text: txt || 'Carregando…' })); }
  function aviso(txt, erro) {
    Array.prototype.forEach.call(document.querySelectorAll('.toast'), function (x) { x.remove(); });
    var t = el('div', { class: 'toast' + (erro ? ' erro' : ''), role: 'status', text: txt });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 4200);
  }

  // ---------- Topo ----------
  function montarTopo(quem) {
    topoDir.innerHTML = '';
    if (!quem) return;
    var papel = quem.gestor ? 'Gestor' : quem.mentor ? 'Mentor' : '';
    topoDir.appendChild(el('span', { class: 'quem', text: (papel ? papel + ' · ' : '') + (quem.nome || quem.email || '') }));
    var bt = el('button', { class: 'sair', type: 'button', text: 'Sair' });
    bt.onclick = function () { if (!R.podeSair()) return; encerrar(''); };
    topoDir.appendChild(bt);
  }

  // ---------- Entrada ----------
  function telaEntrada(msg, codigo) {
    montarTopo(null);
    atualizadoEl.textContent = '';
    app.innerHTML = '';
    var erro = el('p', { class: 'erro', role: 'alert', text: msg || '' });
    var caixa = el('div', { class: 'entrada' }, [el('h1', { text: 'Mentoria' })]);
    var google = googleLigado();
    if (google) {
      caixa.appendChild(el('p', { class: 'sub centro', text: 'Entre com a conta Google cadastrada na mentoria.' }));
      var lugar = el('div', { class: 'google-botao' });
      caixa.appendChild(lugar);
      botaoGoogle(lugar, erro, function (cred) { entrar({ credencial: cred }); });
    }
    if (est.cfg.aceitaCodigo) {
      var area = formCodigo(codigo, 'Entrar com o código', function (c) { entrar({ codigo: c }); }, erro);
      if (google) {
        var det = el('details', { class: 'alternativa' }, [el('summary', { text: 'Não consegue entrar com o Google? Use seu código de acesso' }), area]);
        if (codigo) det.open = true;
        caixa.appendChild(det);
      } else {
        caixa.appendChild(el('p', { class: 'sub centro', text: 'Digite o código de acesso que está na aba "Meu painel" da sua planilha de mentoria (mentor: na planilha "Mentorados").' }));
        caixa.appendChild(area);
      }
    } else if (!google) {
      erro.textContent = 'O login com Google ainda não está disponível. Tente de novo mais tarde.';
    }
    caixa.appendChild(erro);
    caixa.appendChild(el('a', { class: 'link-privacidade', href: 'privacidade.html', text: 'Política de privacidade' }));
    app.appendChild(caixa);
  }

  function formCodigo(codigo, rotulo, enviar, erro, principal) {
    var inp = el('input', { type: 'text', maxlength: '9', placeholder: 'XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Código de acesso' });
    inp.value = codigo || '';
    var bt = el('button', { class: 'botao' + (googleLigado() && !principal ? ' sec2' : ''), type: 'button', text: rotulo });
    var ir = function () {
      var c = inp.value.trim();
      if (c.replace(/[^A-Za-z0-9]/g, '').length < 8) { erro.textContent = 'Digite os 8 caracteres do seu código.'; return; }
      enviar(c);
    };
    bt.onclick = ir;
    inp.onkeydown = function (ev) { if (ev.key === 'Enter') ir(); };
    return el('div', { class: 'form-codigo' }, [inp, bt]);
  }

  // Botão oficial "Fazer login com o Google" (Google Identity Services)
  var googlePronto = false;
  function botaoGoogle(lugar, erro, aoEntrar) {
    var tentativas = 0;
    (function esperar() {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: C.GOOGLE_CLIENT_ID, ux_mode: 'popup', auto_select: false, context: 'signin',
          callback: function (resp) { if (resp && resp.credential) aoEntrar(resp.credential); }
        });
        googlePronto = true;
        google.accounts.id.renderButton(lugar, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR', width: 280 });
        return;
      }
      if (++tentativas > 50) { erro.textContent = 'O login com Google não carregou. Recarregue a página' + (est.cfg.aceitaCodigo ? ' ou use seu código de acesso.' : '.'); return; }
      setTimeout(esperar, 200);
    })();
  }

  // Primeiro acesso: conta Google ainda não ligada à planilha. O código confirma quem é a pessoa (uma única vez).
  function telaVincular(credencial, email, msg) {
    app.innerHTML = '';
    var erro = el('p', { class: 'erro', role: 'alert', text: msg || '' });
    var caixa = el('div', { class: 'entrada' }, [
      el('h1', { text: 'Primeiro acesso' }),
      el('p', { class: 'sub centro', text: 'A conta ' + email + ' ainda não está ligada à mentoria. Digite seu código de acesso (aba "Meu painel" da sua planilha) uma única vez para vincular esta conta Google. Depois, é só entrar com o Google.' }),
      formCodigo('', 'Vincular minha conta Google', function (c) { vincular({ credencial: credencial, codigo: c }, email); }, erro, true),
      el('button', { class: 'link-voltar', type: 'button', text: 'Usar outra conta Google' }),
      erro
    ]);
    caixa.querySelector('.link-voltar').onclick = function () { telaEntrada(''); };
    app.appendChild(caixa);
  }

  function vincular(dados, email) {
    carregando('Vinculando sua conta Google…');
    api('vincular', dados).then(function (d) {
      if (!d || !d.ok) {
        var m = {
          codigo: 'Código não encontrado. Confira na aba "Meu painel" da sua planilha.',
          emailEmUso: 'A conta ' + (d && d.email) + ' já está ligada a outro aluno. Entre com a sua própria conta Google ou fale com seu mentor.',
          login: 'Seu login com o Google expirou. Clique em "Fazer login com o Google" de novo.',
          codigoDesligado: 'O acesso por código foi encerrado. Peça ao seu mentor para cadastrar este e-mail.',
          sessao: 'Sua sessão expirou. Entre de novo.'
        }[d && d.erro] || 'Não foi possível vincular agora. Tente de novo em instantes.';
        if (dados.codigo && d && (d.erro === 'codigo')) telaVincular(dados.credencial, email, m); else telaEntrada(m);
        return;
      }
      est.sessao = d.sessao; gravar(CHAVE_SESSAO, d.sessao);
      aviso('Conta Google vinculada! Da próxima vez, é só entrar com o Google.');
      iniciar();
    }).catch(function () { telaEntrada('Não foi possível conectar agora. Tente de novo.'); });
  }

  var MSG_ENTRADA = {
    codigo: 'Código não encontrado. Confira na aba "Meu painel" da sua planilha.',
    codigoDesligado: 'O acesso por código foi encerrado. Entre com a sua conta Google.',
    login: 'Não foi possível confirmar seu login com o Google. Tente de novo.',
    falha: 'Não foi possível entrar agora. Tente de novo em instantes.'
  };
  function entrar(dados) {
    carregando('Entrando…');
    api('entrar', dados).then(function (d) {
      if (!d || !d.ok) {
        if (d && d.erro === 'naoCadastrado' && d.podeVincular && dados.credencial) { telaVincular(dados.credencial, d.email, ''); return; }
        var m = d && d.erro === 'naoCadastrado'
          ? 'A conta ' + d.email + ' não está cadastrada na mentoria. Entre com a conta Google que você usou no diagnóstico ou peça ao seu mentor para cadastrar este e-mail. Não tem conta Google? Dá para criar uma com o seu e-mail atual em accounts.google.com.'
          : MSG_ENTRADA[d && d.erro] || MSG_ENTRADA.falha;
        telaEntrada(m, dados.codigo);
        return;
      }
      est.sessao = d.sessao;
      gravar(CHAVE_SESSAO, d.sessao);
      iniciar();
    }).catch(function () { telaEntrada('Não foi possível conectar agora. Confira sua internet e tente de novo.', dados.codigo); });
  }

  function encerrar(msg) {
    if (est.sessao) api('sair').catch(function () { });
    est.sessao = null; est.inicio = null; est.cache = {}; est.atual = null;
    gravar(CHAVE_SESSAO, null);
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { }
    telaEntrada(msg || '');
  }

  // ---------- Depois de entrar ----------
  function iniciar() {
    carregando('Carregando…');
    api('inicio').then(function (d) {
      if (!d || !d.ok) { encerrar('Não foi possível carregar agora. Entre de novo.'); return; }
      est.inicio = d;
      montarTopo(d.quem);
      if (d.papel === 'aluno') { montarAluno(); avisoVincular(d.quem); return; }
      est.filtro = ler('mentoria_filtro') || 'todos';
      est.aba = ler('mentoria_aba') || 'painel';
      est.secao = ler('mentoria_secao') || 'alunos';
      montarLista();
      avisoVincular(d.quem);
    }).catch(function (e) { if (e.message !== 'sessao') { app.innerHTML = ''; app.appendChild(el('p', { class: 'carregando', text: 'Não foi possível carregar agora. Recarregue a página em instantes.' })); } });
  }

  function avisoVincular(quem) {
    if (!quem || quem.via !== 'codigo' || !googleLigado()) return;
    var erro = el('p', { class: 'erro', text: '' });
    var lugar = el('div', { class: 'google-botao' });
    var caixa = el('div', { class: 'aviso vincular' }, [
      el('b', { text: 'Entre com o Google da próxima vez.' }),
      el('span', { text: ' Vincule sua conta Google agora e não precisa mais do código (o acesso por código vai acabar).' }),
      lugar, erro
    ]);
    app.insertBefore(caixa, app.firstChild);
    botaoGoogle(lugar, erro, function (cred) { vincular({ credencial: cred, sessao: est.sessao }, ''); });
  }

  // ---------- Aluno: caixas (Meu painel · Simulados · Caderno de erros · Rotina) ----------
  var ICONES = {
    painel: ['M4 19V10M10 19V5M16 19v-7M22 19H2'],
    simulados: ['M9 5h11M9 12h11M9 19h11', 'M4 5l1 1 2-2M4 12l1 1 2-2M4 19l1 1 2-2'],
    caderno: ['M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z', 'M9 8l6 6M15 8l-6 6'],
    rotina: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z', 'M4 10h16M9 3v4M15 3v4', 'M8 14h3M13 14h3M8 17h3']
  };
  function icone(nome) {
    var s = P.sv('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    ICONES[nome].forEach(function (d) { P.sv('path', { d: d }, s); });
    return s;
  }
  function montarAluno() {
    var d = est.inicio;
    atualizadoEl.textContent = d.atualizado ? 'Atualizado em ' + d.atualizado : '';
    app.innerHTML = '';
    app.appendChild(P.cabecalhoAluno(d.dados));
    var opcoes = [['painel', 'Meu painel', 'Acertos, níveis e onde focar']];
    if (d.fases && d.fases.lancamentos) opcoes.push(['simulados', 'Simulados', 'Lance e confira seus simulados']);
    if (d.fases && d.fases.caderno) opcoes.push(['caderno', 'Caderno de erros', 'Registre onde você errou']);
    if (d.fases && d.fases.rotina) opcoes.push(['rotina', 'Rotina', 'Sua semana organizada pelo mentor']);
    if (!opcoes.some(function (o) { return o[0] === est.abaAluno; })) est.abaAluno = 'painel';
    var area = el('div', { class: 'aluno-area' });
    if (opcoes.length > 1) {
      var nav = el('nav', { class: 'caixas' + (opcoes.length === 4 ? ' quatro' : ''), 'aria-label': 'Seções do app', style: '--n:' + opcoes.length });
      opcoes.forEach(function (o) {
        var b = el('button', { class: 'caixa', type: 'button', 'aria-pressed': String(est.abaAluno === o[0]) }, [icone(o[0]), el('b', { text: o[1] }), el('span', { text: o[2] })]);
        b.onclick = function () { if (!R.podeSair()) return; est.abaAluno = o[0]; gravar('mentoria_aba_aluno', o[0]); montarAluno(); };
        nav.appendChild(b);
      });
      app.appendChild(nav);
    }
    app.appendChild(area);
    var ctx = { api: api, id: null, mentor: false, fases: d.fases || {}, aviso: aviso, aoMudar: function () { atualizarAluno(null); } };
    if (est.abaAluno === 'simulados') R.simulados(area, ctx);
    else if (est.abaAluno === 'caderno') R.caderno(area, ctx);
    else if (est.abaAluno === 'rotina') R.rotina(area, ctx);
    else {
      if (ctx.fases.revisao) { var rev = el('div', {}); area.appendChild(rev); R.revisao(rev, ctx); }
      P.montar(d.dados, { raiz: area, semCabecalho: true });
    }
  }

  // Depois de lançar ou corrigir: sincroniza só aquele aluno em segundo plano e atualiza o painel
  var atualizando = {};
  function atualizarAluno(id) {
    var k = id || 'eu';
    if (atualizando[k]) { atualizando[k] = 2; return; }
    atualizando[k] = 1;
    api('atualizar', id ? { id: id } : {}).then(function (r) {
      var outraVez = atualizando[k] === 2; atualizando[k] = 0;
      if (r && r.ok && r.dados) {
        if (r.atualizado) atualizadoEl.textContent = 'Atualizado em ' + r.atualizado;
        if (!id && est.inicio && est.inicio.papel === 'aluno') {
          est.inicio.dados = r.dados;
          if (est.abaAluno === 'painel') montarAluno();
          aviso('Seu painel foi atualizado.');
        } else if (id && est.cache[id]) {
          est.cache[id].simulados = r.dados.simulados; est.cache[id].erros = r.dados.erros;
          (est.inicio.alunos || []).forEach(function (y) { if (y.id === id) y.nSims = r.dados.simulados.length; });
          aviso('Painel do aluno atualizado.');
        }
      }
      if (outraVez) atualizarAluno(id);
    }).catch(function () { atualizando[k] = 0; });
  }

  // ---------- Mentor e gestor: lista de alunos ----------
  function montarLista() {
    var d = est.inicio, gestor = d.papel === 'gestor';
    atualizadoEl.textContent = d.atualizado ? 'Atualizado em ' + d.atualizado : '';
    app.innerHTML = '';
    var semMentor = d.alunos.filter(function (x) { return !x.mentor; }).length;
    var primeiro = String(d.quem.nome || '').trim().split(' ')[0];
    var sub = [el('span', { text: gestor ? 'Visão de gestor' : 'Painel dos seus mentorados' }), el('span', { text: d.alunos.length + (d.alunos.length === 1 ? ' aluno' : ' alunos') })];
    if (gestor && semMentor) sub.push(el('span', { text: semMentor + ' sem mentor' }));
    app.appendChild(el('div', {}, [el('h1', { text: 'Olá, ' + (primeiro && primeiro.indexOf('@') < 0 ? primeiro : '') + '!' }), el('p', { class: 'sub' }, sub)]));

    // Seções do topo: Alunos · Simulados em PDF (quando a fase está ligada)
    if (d.fases && d.fases.pdfs) {
      if (est.secao !== 'pdfs') est.secao = 'alunos';
      var secoes = el('div', { class: 'seg secoes', role: 'tablist', 'aria-label': 'Seções' });
      [['alunos', gestor ? 'Alunos' : 'Mentorados'], ['pdfs', 'Simulados em PDF']].forEach(function (o) {
        var b = el('button', { type: 'button', role: 'tab', 'aria-checked': String(est.secao === o[0]), 'aria-selected': String(est.secao === o[0]), text: o[1] });
        b.onclick = function () { if (est.secao === o[0] || !R.podeSair()) return; est.secao = o[0]; gravar('mentoria_secao', o[0]); montarLista(); };
        secoes.appendChild(b);
      });
      app.appendChild(secoes);
      if (est.secao === 'pdfs') {
        var areaPdf = el('div', { class: 'aluno-area' });
        app.appendChild(areaPdf);
        R.pdfsGestao(areaPdf, { api: api, mentor: true, aviso: aviso });
        return;
      }
    }

    if (!d.alunos.length) {
      app.appendChild(el('div', { class: 'aviso', text: gestor ? 'Ainda não há alunos cadastrados.' : 'Você ainda não tem mentorados. Quando o gestor cadastrar você como mentor de um aluno, ele aparece aqui.' }));
      return;
    }

    var barra = el('div', { class: 'seletor' }, [el('span', { class: 'seletor-rot', text: gestor ? 'Aluno' : 'Mentorado' })]);
    var filtros = null;
    if (gestor) {
      filtros = el('div', { class: 'filtros', role: 'group', 'aria-label': 'Filtrar por mentor' });
      barra.appendChild(filtros);
    }
    var busca = el('input', { type: 'search', placeholder: 'Filtrar por nome…', autocomplete: 'off', 'aria-label': 'Filtrar por nome' });
    if (d.alunos.length > 5) barra.appendChild(busca);
    var sel = el('select', { 'aria-label': 'Escolher aluno' });
    var ant = el('button', { class: 'passo', type: 'button', 'aria-label': 'Aluno anterior', text: '‹' });
    var prox = el('button', { class: 'passo', type: 'button', 'aria-label': 'Próximo aluno', text: '›' });
    barra.appendChild(el('div', { class: 'seletor-linha' }, [sel, ant, prox]));
    var area = el('div', { class: 'aluno-area' });
    app.appendChild(barra);
    app.appendChild(area);

    var visiveis = [];
    var rotulo = function (x) {
      var s = x.semPlanilha ? 'aguardando planilhas' : x.nSims + (x.nSims === 1 ? ' simulado' : ' simulados');
      return x.aluno + ' · ' + s + (gestor && !x.mentor ? ' · sem mentor' : '') + (x.novo ? ' · novo' : '');
    };
    function passaFiltro(x) {
      if (!gestor || est.filtro === 'todos') return true;
      if (est.filtro === 'sem') return !x.mentor;
      if (est.filtro === 'semgoogle') return !x.google && !x.semPlanilha;
      return norm(x.mentor) === est.filtro;
    }
    function desenharFiltros() {
      if (!filtros) return;
      filtros.innerHTML = '';
      var cont = {};
      d.alunos.forEach(function (x) { if (x.mentor) cont[norm(x.mentor)] = (cont[norm(x.mentor)] || 0) + 1; });
      var semGoogle = d.alunos.filter(function (x) { return !x.google && !x.semPlanilha; }).length;
      var opcoes = [['todos', 'Todos', d.alunos.length], ['sem', 'Sem mentor', semMentor]];
      if (googleLigado()) opcoes.push(['semgoogle', 'Sem login Google', semGoogle]);
      var nomes = {};
      d.alunos.forEach(function (x) { if (x.mentor && !nomes[norm(x.mentor)]) nomes[norm(x.mentor)] = x.mentor; });
      Object.keys(nomes).sort(function (a, b) { return nomes[a].localeCompare(nomes[b], 'pt-BR'); })
        .forEach(function (k) { opcoes.push([k, (d.meuMentor && norm(d.meuMentor) === k) ? 'Meus mentorados' : nomes[k], cont[k]]); });
      if (!opcoes.some(function (o) { return o[0] === est.filtro; })) est.filtro = 'todos';
      opcoes.forEach(function (o) {
        var b = el('button', { class: 'chip' + (o[0] === 'sem' && o[2] ? ' alerta' : ''), type: 'button', 'aria-pressed': String(est.filtro === o[0]) }, [o[1], el('b', { text: String(o[2]) })]);
        b.onclick = function () { est.filtro = o[0]; gravar('mentoria_filtro', o[0]); desenharFiltros(); opcoes_(); };
        filtros.appendChild(b);
      });
    }
    function opcoes_() {
      var q = norm(busca.value);
      visiveis = d.alunos.filter(function (x) { return passaFiltro(x) && (!q || norm(x.aluno).indexOf(q) >= 0); });
      sel.innerHTML = '';
      visiveis.forEach(function (x) { sel.appendChild(el('option', { value: x.id, text: rotulo(x) })); });
      sel.disabled = !visiveis.length;
      if (!visiveis.length) { mostrar(null); return; }
      var manter = visiveis.some(function (x) { return x.id === est.atual; });
      mostrar(manter ? est.atual : visiveis[0].id);
    }
    function passos() {
      var i = visiveis.map(function (y) { return y.id; }).indexOf(est.atual);
      ant.disabled = i <= 0; prox.disabled = i < 0 || i >= visiveis.length - 1;
    }
    function mostrar(id) {
      if (!R.podeSair()) { if (est.atual) sel.value = est.atual; return; }
      area.innerHTML = '';
      if (!id) { est.atual = null; passos(); area.appendChild(el('p', { class: 'vazio', text: 'Nenhum aluno neste filtro.' })); return; }
      est.atual = id; sel.value = id; gravar('mentoria_aluno', id); passos();
      if (est.cache[id]) { desenharAluno(area, est.cache[id]); return; }
      area.appendChild(el('p', { class: 'carregando', style: 'margin-top:8vh', text: 'Carregando…' }));
      api('aluno', { id: id }).then(function (r) {
        if (est.atual !== id) return;
        area.innerHTML = '';
        if (!r || !r.ok) { area.appendChild(el('div', { class: 'aviso', text: 'Não foi possível abrir este aluno agora.' })); return; }
        est.cache[id] = r.aluno;
        desenharAluno(area, r.aluno);
      }).catch(function (e) { if (e.message !== 'sessao' && est.atual === id) { area.innerHTML = ''; area.appendChild(el('div', { class: 'aviso', text: 'Não foi possível abrir este aluno agora. Tente de novo.' })); } });
    }
    sel.onchange = function () { mostrar(sel.value); };
    busca.oninput = opcoes_;
    ant.onclick = function () { var i = visiveis.map(function (y) { return y.id; }).indexOf(est.atual); if (i > 0) { mostrar(visiveis[i - 1].id); window.scrollTo(0, 0); } };
    prox.onclick = function () { var i = visiveis.map(function (y) { return y.id; }).indexOf(est.atual); if (i >= 0 && i < visiveis.length - 1) { mostrar(visiveis[i + 1].id); window.scrollTo(0, 0); } };

    var salvo = ler('mentoria_aluno');
    est.atual = d.alunos.some(function (x) { return x.id === salvo; }) ? salvo : null;
    desenharFiltros();
    opcoes_();
  }

  // ---------- Um aluno (mentor e gestor) ----------
  function desenharAluno(area, x) {
    var d = est.inicio, gestor = d.papel === 'gestor';
    area.innerHTML = '';
    var atalhos = el('div', { class: 'atalhos' });
    if (x.urlMentor) atalhos.appendChild(el('a', { class: 'atalho', href: x.urlMentor, target: '_blank', rel: 'noopener', text: 'Planilha do mentor ↗' }));
    if (x.urlAluno) atalhos.appendChild(el('a', { class: 'atalho', href: x.urlAluno, target: '_blank', rel: 'noopener', text: 'Rotina e caderno ↗' }));
    if (x.codigo) atalhos.appendChild(el('span', { class: 'atalho cod', text: 'Código do aluno: ' + x.codigo }));
    var titulo = el('h2', { class: 'nome-aluno' }, [x.aluno]);
    if (x.semPlanilha) titulo.appendChild(el('span', { class: 'selo-txt cinza', text: 'aguardando planilhas' }));
    else if (gestor && !x.mentor) titulo.appendChild(el('span', { class: 'selo-txt', text: 'sem mentor' }));
    var item = (est.inicio.alunos || []).filter(function (y) { return y.id === x.id; })[0];
    if (gestor && googleLigado() && item && !item.google && !x.semPlanilha) titulo.appendChild(el('span', { class: 'selo-txt cinza', text: 'ainda não entrou com Google' }));
    var sub = el('p', { class: 'sub' }, [
      el('span', { text: x.curso ? 'Rumo a ' + x.curso : '' }), el('span', { text: x.desde ? 'Na mentoria desde ' + x.desde : '' }),
      gestor && x.mentor ? el('span', { text: 'Mentor: ' + x.mentor }) : null]);
    var cab = el('div', {}, [titulo, sub, atalhos]);
    if (gestor && !x.semPlanilha) cab.appendChild(blocoAtribuir(x));
    area.appendChild(cab);

    var temDiag = x.diagnostico !== undefined && x.diagnostico !== null;
    var fases = d.fases || {};
    var abas = [['painel', 'Painel']];
    if (!x.semPlanilha && fases.lancamentos) abas.push(['simulados', 'Simulados']);
    if (!x.semPlanilha && fases.caderno) abas.push(['caderno', 'Caderno de erros']);
    if (!x.semPlanilha && fases.rotina) abas.push(['rotina', 'Rotina']);
    if (temDiag) abas.push(['diagnostico', 'Diagnóstico']);
    if (!abas.some(function (a) { return a[0] === est.aba; })) est.aba = x.semPlanilha && temDiag ? 'diagnostico' : 'painel';
    var barraAbas = el('div', { class: 'abas', role: 'tablist' });
    var conteudo = el('div', { class: 'aluno-area', role: 'tabpanel' });
    abas.forEach(function (a) {
      var b = el('button', { class: 'aba', type: 'button', role: 'tab', 'aria-selected': String(est.aba === a[0]), text: a[1] });
      b.onclick = function () { if (!R.podeSair()) return; est.aba = a[0]; gravar('mentoria_aba', a[0]); desenharAluno(area, x); };
      barraAbas.appendChild(b);
    });
    if (abas.length > 1) area.appendChild(barraAbas);
    area.appendChild(conteudo);
    var ctx = { api: api, id: x.id, mentor: true, fases: fases, aviso: aviso, aoMudar: function () { atualizarAluno(x.id); } };
    if (est.aba === 'diagnostico' && temDiag) desenharDiagnostico(conteudo, x.diagnostico, x);
    else if (est.aba === 'simulados' && !x.semPlanilha) R.simulados(conteudo, ctx);
    else if (est.aba === 'caderno' && !x.semPlanilha) R.caderno(conteudo, ctx);
    else if (est.aba === 'rotina' && !x.semPlanilha) R.rotina(conteudo, ctx);
    else if (x.semPlanilha) conteudo.appendChild(el('div', { class: 'aviso', text: 'Este aluno respondeu o diagnóstico, mas as planilhas dele ainda não foram criadas. Elas são criadas automaticamente; se demorar, use Mentoria → "Criar planilhas dos alunos pendentes".' }));
    else {
      if (fases.revisao) { var rev = el('div', {}); conteudo.appendChild(rev); R.revisao(rev, ctx); }
      P.montar(x, { mentor: true, raiz: conteudo, semCabecalho: true });
    }
  }

  // Gestor: escolher o mentor responsável
  function blocoAtribuir(x) {
    var mentores = est.inicio.mentores || [];
    var sel = el('select', { 'aria-label': 'Mentor responsável' });
    sel.appendChild(el('option', { value: '', text: '— sem mentor —' }));
    mentores.forEach(function (m, i) { sel.appendChild(el('option', { value: String(i), text: m.nome + (m.email ? ' · ' + m.email : '') })); });
    sel.appendChild(el('option', { value: 'novo', text: 'Outro mentor…' }));
    var atual = mentores.map(function (m) { return norm(m.nome); }).indexOf(norm(x.mentor));
    sel.value = x.mentor ? (atual >= 0 ? String(atual) : 'novo') : '';
    var nome = el('input', { type: 'text', placeholder: 'Nome do mentor', 'aria-label': 'Nome do novo mentor' });
    var email = el('input', { type: 'email', placeholder: 'E-mail do mentor', 'aria-label': 'E-mail do novo mentor' });
    if (sel.value === 'novo') { nome.value = x.mentor || ''; email.value = x.emailMentor || ''; }
    var bt = el('button', { class: 'botao peq', type: 'button', text: 'Salvar' });
    var caixa = el('div', { class: 'atribuir' }, [el('label', { text: 'Mentor responsável' }), sel, nome, email, bt]);
    function mostrarNovo() { var n = sel.value === 'novo'; nome.style.display = n ? '' : 'none'; email.style.display = n ? '' : 'none'; }
    sel.onchange = mostrarNovo; mostrarNovo();
    bt.onclick = function () {
      var m = sel.value === '' ? { nome: '', email: '' } : sel.value === 'novo' ? { nome: nome.value.trim(), email: email.value.trim() } : mentores[Number(sel.value)];
      if (m.nome && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m.email || '')) { aviso('Informe um e-mail válido para o mentor.', true); return; }
      bt.disabled = true; bt.textContent = 'Salvando…';
      api('atribuirMentor', { id: x.id, mentor: m.nome, email: m.email }).then(function (r) {
        bt.disabled = false; bt.textContent = 'Salvar';
        if (!r || !r.ok) { aviso(r && r.erro === 'email' ? 'Informe um e-mail válido para o mentor.' : 'Não foi possível salvar agora.', true); return; }
        x.mentor = m.nome; x.emailMentor = m.email;
        est.inicio.alunos.forEach(function (y) { if (y.id === x.id) { y.mentor = m.nome; y.novo = false; } });
        if (m.nome && !mentores.some(function (y) { return norm(y.nome) === norm(m.nome); })) mentores.push({ nome: m.nome, email: m.email });
        aviso(m.nome ? 'Mentor salvo. As planilhas são compartilhadas com ' + m.nome + ' na próxima sincronização (até 10 min).' : 'Aluno ficou sem mentor.');
        montarLista();
      }).catch(function (e) { bt.disabled = false; bt.textContent = 'Salvar'; if (e.message !== 'sessao') aviso('Não foi possível salvar agora.', true); });
    };
    return caixa;
  }

  // ---------- Diagnóstico pré-mentoria ----------
  var GRUPOS_DIAG = [
    ['Objetivo', ['Curso desejado', 'Instituições prioritárias', 'Processos seletivos', 'Conhece nota de corte']],
    ['Histórico', ['Tentativas (ENEM/vest.)', 'Notas ENEM', 'Simulados', 'Questões por semana']],
    ['Ponto de partida', ['Áreas fortes', 'Áreas de dificuldade', 'Conteúdos críticos', 'Identifica motivo do erro']],
    ['Como estuda', ['Estratégias de estudo', 'Como revisa', 'Organização', 'Melhor período', 'Turnos livres (de 21)']],
    ['Rotina e contexto', ['Etapa escolar', 'Escola / Cursinho', 'Trabalho / atividades fixas', 'Infraestrutura (local/internet)', 'Obstáculos da rotina', 'Descanso e sono', 'O que mais prejudica', 'Acessibilidade / adaptação']],
    ['Expectativas', ['Motivação', 'Significado da aprovação', 'Expectativas com a mentoria', 'Apoio desejado do mentor', 'Frequência de encontros', 'Metas 30/60/90 dias', 'Histórico de interrupção', 'Algo mais a saber']],
    ['Observações do mentor', ['Observações do mentor']]
  ];
  function linhas(v) { return String(v || '').split(/\n+/).map(function (s) { return s.replace(/^[•\-\s]+/, '').trim(); }).filter(String); }
  function campos(dg, chaves) {
    var dl = el('dl', { class: 'campos' }), n = 0;
    chaves.forEach(function (k) { if (dg[k]) { n++; dl.appendChild(el('div', { class: 'campo' }, [el('dt', { text: k }), el('dd', { text: dg[k] })])); } });
    return n ? dl : null;
  }
  function desenharDiagnostico(raiz, dg, x) {
    if (!dg || !Object.keys(dg).length) { raiz.appendChild(el('div', { class: 'aviso', text: 'Não encontrei o diagnóstico deste aluno na aba Perfis. Confira se o nome no diagnóstico é o mesmo da aba Alunos.' })); return; }
    var box = el('div', { class: 'diag' });
    if (dg['Respondido em']) box.appendChild(el('p', { class: 'nota', style: 'margin:0', text: 'Diagnóstico respondido em ' + dg['Respondido em'] + '. Só mentor e gestor veem esta aba.' }));
    // Resumo para a 1ª conversa
    var pr = Number(String(dg['Prontidão (0–100)'] || '').replace(',', '.'));
    var cor = isNaN(pr) ? '#AAB3C0' : pr >= 70 ? 'var(--bom)' : pr >= 45 ? 'var(--aviso)' : 'var(--ruim)';
    var prontidao = el('div', { class: 'card prontidao' }, [
      el('span', { class: 'kpi-top', text: 'Prontidão' }),
      el('span', { class: 'kpi-valor', style: 'color:' + cor, text: isNaN(pr) ? '—' : String(Math.round(pr)) }),
      el('div', { class: 'medidor' }, [el('span', { style: 'width:' + (isNaN(pr) ? 0 : Math.max(0, Math.min(100, pr))) + '%;background:' + cor })]),
      el('span', { class: 'kpi-nota', text: dg['Nível'] ? 'Nível: ' + dg['Nível'] : 'de 0 a 100' })
    ]);
    var al = linhas(dg['Alertas']);
    var listaAl = el('ul', { class: 'alertas' });
    if (!al.length || (al.length === 1 && /nenhum alerta/i.test(al[0]))) listaAl.appendChild(el('li', { class: 'nenhum', text: 'Nenhum alerta' }));
    else al.forEach(function (a) { listaAl.appendChild(el('li', { text: a })); });
    var foco = linhas(dg['Foco sugerido (1ª conversa)']);
    var resumo = el('div', { class: 'card' }, [el('h3', { text: 'Alertas' }), listaAl]);
    if (foco.length) {
      resumo.appendChild(el('h3', { style: 'margin-top:14px', text: 'Foco sugerido para a 1ª conversa' }));
      resumo.appendChild(el('ul', { class: 'foco' }, foco.map(function (f) { return el('li', { text: f }); })));
    }
    box.appendChild(el('div', { class: 'diag-topo' }, [prontidao, resumo]));
    GRUPOS_DIAG.forEach(function (g) {
      var c = campos(dg, g[1]);
      if (c) box.appendChild(el('div', { class: 'card' }, [el('h3', { text: g[0] }), c]));
    });
    var contato = campos(dg, ['Idade', 'Contato', 'Responsável legal']);
    if (contato) box.appendChild(el('details', { class: 'card' }, [el('summary', { text: 'Contato e responsável' }), contato]));
    raiz.appendChild(box);
  }

  // ---------- Começo ----------
  function codigoDaUrl() {
    try {
      var u = new URL(window.location.href), c = u.searchParams.get('codigo');
      if (c) { u.searchParams.delete('codigo'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
      return c;
    } catch (e) { return null; }
  }
  if (!C.API_URL) { telaEntrada('O app ainda não está configurado (falta o endereço do servidor).'); return; }
  var cod = codigoDaUrl();
  est.sessao = ler(CHAVE_SESSAO);
  api('config').then(function (c) { if (c && c.ok) est.cfg = { aceitaCodigo: !!c.aceitaCodigo, google: !!c.google }; })
    .catch(function () { })
    .then(function () {
      if (cod && est.cfg.aceitaCodigo) { entrar({ codigo: cod }); return; }
      if (est.sessao) iniciar(); else telaEntrada('');
    });
})();

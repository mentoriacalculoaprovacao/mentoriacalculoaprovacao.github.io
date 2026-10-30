// Fluxo do app: login (Google ou código), lista de alunos (mentor e gestor), abas Painel e Diagnóstico.
// Toda regra de quem vê o quê fica no servidor (Apps Script, API.gs): esta página só mostra o que ele devolve.
(function () {
  var C = window.CONFIG || {};
  var P = window.Painel, el = P.el, norm = P.norm;
  var app = document.getElementById('app');
  var topoDir = document.getElementById('topo-dir');
  var atualizadoEl = document.getElementById('atualizado');
  var CHAVE_SESSAO = 'mentoria_sessao';
  var est = { sessao: null, inicio: null, cache: {}, atual: null, aba: 'painel', filtro: 'todos', busca: '' };

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
    bt.onclick = function () { encerrar(''); };
    topoDir.appendChild(bt);
  }

  // ---------- Entrada ----------
  function telaEntrada(msg, codigo) {
    montarTopo(null);
    atualizadoEl.textContent = '';
    app.innerHTML = '';
    var erro = el('p', { class: 'erro', role: 'alert', text: msg || '' });
    var caixa = el('div', { class: 'entrada' }, [el('h1', { text: 'Mentoria' })]);
    if (C.GOOGLE_CLIENT_ID) {
      caixa.appendChild(el('p', { class: 'sub centro', text: 'Entre com a conta Google cadastrada na mentoria (o e-mail que você usou no diagnóstico).' }));
      var lugar = el('div', { class: 'google-botao' });
      caixa.appendChild(lugar);
      prepararGoogle(lugar, erro);
      caixa.appendChild(el('div', { class: 'ou', text: 'ou use seu código de acesso' }));
    } else {
      caixa.appendChild(el('p', { class: 'sub centro', text: 'Digite o código de acesso que está na aba "Meu painel" da sua planilha de mentoria (mentor: na planilha "Mentorados").' }));
    }
    var inp = el('input', { type: 'text', maxlength: '9', placeholder: 'XXXX-XXXX', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Código de acesso' });
    inp.value = codigo || '';
    var bt = el('button', { class: 'botao' + (C.GOOGLE_CLIENT_ID ? ' sec2' : ''), type: 'button', text: 'Entrar com o código' });
    var ir = function () {
      var c = inp.value.trim();
      if (c.replace(/[^A-Za-z0-9]/g, '').length < 8) { erro.textContent = 'Digite os 8 caracteres do seu código.'; return; }
      entrar({ codigo: c });
    };
    bt.onclick = ir;
    inp.onkeydown = function (ev) { if (ev.key === 'Enter') ir(); };
    caixa.appendChild(inp); caixa.appendChild(bt); caixa.appendChild(erro);
    app.appendChild(caixa);
  }

  function prepararGoogle(lugar, erro) {
    var tentativas = 0;
    (function esperar() {
      if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.initialize({
          client_id: C.GOOGLE_CLIENT_ID, ux_mode: 'popup', auto_select: false,
          callback: function (resp) { if (resp && resp.credential) entrar({ credencial: resp.credential }); }
        });
        google.accounts.id.renderButton(lugar, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pt-BR', width: 280 });
        return;
      }
      if (++tentativas > 50) { erro.textContent = 'O login com Google não carregou. Use seu código de acesso ou recarregue a página.'; return; }
      setTimeout(esperar, 200);
    })();
  }

  var MSG_ENTRADA = {
    codigo: 'Código não encontrado. Confira na aba "Meu painel" da sua planilha.',
    login: 'Não foi possível confirmar seu login com o Google. Tente de novo.',
    falha: 'Não foi possível entrar agora. Tente de novo em instantes.'
  };
  function entrar(dados) {
    carregando('Entrando…');
    api('entrar', dados).then(function (d) {
      if (!d || !d.ok) {
        var m = d && d.erro === 'naoCadastrado'
          ? 'O e-mail ' + d.email + ' não está cadastrado na mentoria. Entre com o e-mail que você usou no diagnóstico ou use seu código de acesso.'
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
      if (d.papel === 'aluno') { P.montar(d.dados); return; }
      est.filtro = ler('mentoria_filtro') || 'todos';
      est.aba = ler('mentoria_aba') || 'painel';
      montarLista();
    }).catch(function (e) { if (e.message !== 'sessao') { app.innerHTML = ''; app.appendChild(el('p', { class: 'carregando', text: 'Não foi possível carregar agora. Recarregue a página em instantes.' })); } });
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
      return norm(x.mentor) === est.filtro;
    }
    function desenharFiltros() {
      if (!filtros) return;
      filtros.innerHTML = '';
      var cont = {};
      d.alunos.forEach(function (x) { if (x.mentor) cont[norm(x.mentor)] = (cont[norm(x.mentor)] || 0) + 1; });
      var opcoes = [['todos', 'Todos', d.alunos.length], ['sem', 'Sem mentor', semMentor]];
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
    var sub = el('p', { class: 'sub' }, [
      el('span', { text: x.curso ? 'Rumo a ' + x.curso : '' }), el('span', { text: x.desde ? 'Na mentoria desde ' + x.desde : '' }),
      gestor && x.mentor ? el('span', { text: 'Mentor: ' + x.mentor }) : null]);
    var cab = el('div', {}, [titulo, sub, atalhos]);
    if (gestor && !x.semPlanilha) cab.appendChild(blocoAtribuir(x));
    area.appendChild(cab);

    var temDiag = x.diagnostico !== undefined && x.diagnostico !== null;
    var abas = [['painel', 'Painel']];
    if (temDiag) abas.push(['diagnostico', 'Diagnóstico']);
    if (!abas.some(function (a) { return a[0] === est.aba; })) est.aba = x.semPlanilha && temDiag ? 'diagnostico' : 'painel';
    var barraAbas = el('div', { class: 'abas', role: 'tablist' });
    var conteudo = el('div', { class: 'aluno-area', role: 'tabpanel' });
    abas.forEach(function (a) {
      var b = el('button', { class: 'aba', type: 'button', role: 'tab', 'aria-selected': String(est.aba === a[0]), text: a[1] });
      b.onclick = function () { est.aba = a[0]; gravar('mentoria_aba', a[0]); desenharAluno(area, x); };
      barraAbas.appendChild(b);
    });
    if (abas.length > 1) area.appendChild(barraAbas);
    area.appendChild(conteudo);
    if (est.aba === 'diagnostico' && temDiag) desenharDiagnostico(conteudo, x.diagnostico, x);
    else if (x.semPlanilha) conteudo.appendChild(el('div', { class: 'aviso', text: 'Este aluno respondeu o diagnóstico, mas as planilhas dele ainda não foram criadas. Elas são criadas automaticamente; se demorar, use Mentoria → "Criar planilhas dos alunos pendentes".' }));
    else P.montar(x, { mentor: true, raiz: conteudo, semCabecalho: true });
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
  if (cod) { entrar({ codigo: cod }); return; }
  est.sessao = ler(CHAVE_SESSAO);
  if (est.sessao) iniciar(); else telaEntrada('');
})();

// Simulados, caderno de erros e rotina: o aluno lança e corrige pelo app; mentor e gestor usam os mesmos blocos dentro do aluno.
// c = { api, id (null = o próprio aluno), mentor (bool), aviso(texto, erro), aoMudar() }
window.Registros = (function () {
  var P = window.Painel, el = P.el, norm = P.norm;
  var DIAS = {
    1: { nome: 'Dia 1', desc: 'Linguagens, Humanas e Redação', campos: [['L', 'Linguagens'], ['H', 'Ciências Humanas']] },
    2: { nome: 'Dia 2', desc: 'Natureza e Matemática', campos: [['N', 'Ciências da Natureza'], ['M', 'Matemática']] }
  };
  var COMP = ['C1 · Norma culta', 'C2 · Tema e repertório', 'C3 · Argumentação', 'C4 · Coesão', 'C5 · Proposta de intervenção'];
  var MSG = {
    faseDesligada: 'Esta parte do app ainda não está liberada.', proibido: 'Você não tem acesso a este aluno.', soMentor: 'Só o mentor cadastrado deste aluno pode editar a rotina.',
    ocupado: 'O sistema está ocupado salvando outra coisa. Tente de novo em alguns segundos.', naoEncontrado: 'Não encontrei esse registro. Recarregue a página.',
    falha: 'O servidor não conseguiu concluir agora. Tente de novo em instantes.'
  };
  function msgErro(r) { return (r && (r.msg || MSG[r.erro])) || 'Não foi possível salvar agora. Tente de novo.'; }
  function hojeIso() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function carregando(raiz, txt) { raiz.innerHTML = ''; raiz.appendChild(el('p', { class: 'carregando', style: 'margin-top:6vh', text: txt || 'Carregando…' })); }
  function falha(raiz, r) { raiz.innerHTML = ''; raiz.appendChild(el('div', { class: 'aviso', text: msgErro(r) })); }
  function numInput(rotulo, valor, max, nome) {
    var i = el('input', { type: 'number', inputmode: 'numeric', min: '0', max: String(max), step: '1', name: nome, 'aria-label': rotulo });
    if (valor !== null && valor !== undefined && valor !== '') i.value = valor;
    return { input: i, caixa: el('label', { class: 'campo-num' }, [el('span', { text: rotulo }), i, el('small', { text: 'de 0 a ' + max })]) };
  }
  function confirmarInline(lugar, texto, rotuloSim, aoConfirmar) {
    var antes = Array.prototype.slice.call(lugar.childNodes);
    lugar.innerHTML = '';
    var sim = el('button', { class: 'mini perigo', type: 'button', text: rotuloSim });
    var nao = el('button', { class: 'mini', type: 'button', text: 'Cancelar' });
    nao.onclick = function () { lugar.innerHTML = ''; antes.forEach(function (n) { lugar.appendChild(n); }); };
    sim.onclick = function () { sim.disabled = true; sim.textContent = 'Excluindo…'; aoConfirmar(); };
    lugar.appendChild(el('span', { class: 'confirmar', text: texto }));
    lugar.appendChild(sim); lugar.appendChild(nao);
  }

  // ===================== Simulados =====================
  function simulados(raiz, c) {
    carregando(raiz, 'Carregando simulados…');
    c.api('simulados', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { falha(raiz, r); return; }
      desenhar(r);
    }).catch(function (e) { if (e.message !== 'sessao') falha(raiz, null); });

    function desenhar(r) {
      raiz.innerHTML = '';
      var porChave = {}, ordem = [];
      r.lancamentos.forEach(function (l) { // já vem do mais recente para o mais antigo
        var g = porChave[l.chave];
        if (!g) { g = porChave[l.chave] = { nome: l.prova, d1: null, d2: null, anteriores: 0 }; ordem.push(l.chave); }
        if (!g['d' + l.dia]) g['d' + l.dia] = l; else g.anteriores++;
      });
      var catalogo = {};
      r.catalogo.forEach(function (p) { catalogo[p.chave] = p; });

      var btNovo = el('button', { class: 'botao peq', type: 'button', text: '+ Lançar simulado' });
      raiz.appendChild(el('div', { class: 'reg-topo' }, [
        el('div', {}, [el('h2', { class: 'reg-titulo', text: c.mentor ? 'Simulados lançados' : 'Meus simulados' }),
          el('p', { class: 'nota', style: 'margin:2px 0 0', text: 'Cada dia da prova é lançado separado. Use o mesmo nome nos dois dias: o sistema junta Dia 1 e Dia 2.' })]),
        btNovo]));
      var lugarForm = el('div', {});
      raiz.appendChild(lugarForm);
      if (c.fases && c.fases.pdfs && !c.mentor) {
        var lugarPdfs = el('div', {});
        raiz.appendChild(lugarPdfs);
        listaPdfs(lugarPdfs, c, porChave, function (titulo) { abrirForm({ prova: titulo }); lugarForm.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
      }

      // Atalhos: provas com só um dos dias lançado
      var faltando = ordem.filter(function (k) { return !porChave[k].d1 || !porChave[k].d2; }).slice(0, 4);
      if (faltando.length) {
        var at = el('div', { class: 'atalhos-pend' }, [el('span', { class: 'nota', style: 'margin:0', text: 'Completar:' })]);
        faltando.forEach(function (k) {
          var g = porChave[k], dia = g.d1 ? 2 : 1;
          var b = el('button', { class: 'chip', type: 'button', text: g.nome + ' — falta o Dia ' + dia });
          b.onclick = function () { abrirForm({ prova: g.nome, dia: dia, dataIso: (g.d1 || g.d2).dataIso }); };
          at.appendChild(b);
        });
        raiz.appendChild(at);
      }

      var lista = el('div', { class: 'reg-lista' });
      if (!ordem.length) lista.appendChild(el('div', { class: 'card vazio-card' }, [
        el('p', { class: 'vazio', text: c.mentor ? 'Este aluno ainda não lançou simulados.' : 'Você ainda não lançou nenhum simulado. Toque em "+ Lançar simulado" para começar.' })]));
      ordem.forEach(function (k) { lista.appendChild(cartao(porChave[k])); });
      raiz.appendChild(lista);
      btNovo.onclick = function () { abrirForm({}); };

      function cartao(g) {
        var dias = el('div', { class: 'sim-dias' });
        [1, 2].forEach(function (d) { dias.appendChild(blocoDia(g, d)); });
        var datas = [g.d1 && g.d1.data, g.d2 && g.d2.data].filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; });
        return el('div', { class: 'card sim-card' }, [
          el('div', { class: 'sim-cab' }, [el('b', { text: g.nome }), el('span', { class: 'nota', style: 'margin:0', text: datas.join(' e ') })]),
          dias,
          g.anteriores ? el('p', { class: 'nota', text: 'Vale o lançamento mais recente de cada dia.' }) : null
        ]);
      }

      function blocoDia(g, d) {
        var l = g['d' + d], cfg = DIAS[d];
        var caixa = el('div', { class: 'sim-dia' + (l ? '' : ' falta') }, [el('div', { class: 'sim-dia-cab' }, [el('b', { text: cfg.nome }), l ? el('span', { class: 'origem ' + l.origem, text: l.origem === 'app' ? 'pelo app' : 'pelo formulário' }) : null])]);
        if (!l) {
          var b = el('button', { class: 'mini', type: 'button', text: 'Lançar ' + cfg.nome });
          b.onclick = function () { abrirForm({ prova: g.nome, dia: d, dataIso: (g.d1 || g.d2).dataIso }); };
          caixa.appendChild(el('span', { class: 'nota', style: 'margin:0', text: 'Ainda não lançado' }));
          caixa.appendChild(b);
          return caixa;
        }
        var valores = cfg.campos.map(function (f) { return f[1].replace('Ciências ', '') + ' ' + (l[f[0]] === null ? '—' : l[f[0]]); });
        if (d === 1 && l.C.some(function (x) { return x !== null; })) valores.push('Redação ' + l.C.reduce(function (s, x) { return s + (x || 0); }, 0));
        caixa.appendChild(el('span', { class: 'sim-valores', text: valores.join(' · ') }));
        if (l.origem === 'app') {
          var acoes = el('div', { class: 'acoes' });
          var ed = el('button', { class: 'mini', type: 'button', text: 'Editar' });
          var ex = el('button', { class: 'mini', type: 'button', text: 'Excluir' });
          ed.onclick = function () { abrirForm({ idLanc: l.id, prova: l.prova, dia: l.dia, dataIso: l.dataIso, L: l.L, H: l.H, N: l.N, M: l.M, C: l.C }); };
          ex.onclick = function () {
            confirmarInline(acoes, 'Excluir este lançamento?', 'Excluir', function () {
              c.api('excluirSimulado', { id: c.id, idLanc: l.id }).then(function (x) {
                if (!x || !x.ok) { c.aviso(msgErro(x), true); simulados(raiz, c); return; }
                c.aviso('Lançamento excluído.'); simulados(raiz, c); c.aoMudar();
              }).catch(function () { c.aviso('Não foi possível excluir agora.', true); simulados(raiz, c); });
            });
          };
          acoes.appendChild(ed); acoes.appendChild(ex);
          caixa.appendChild(acoes);
        } else if (!c.mentor) {
          caixa.appendChild(el('small', { class: 'nota', style: 'margin:0', text: 'Para corrigir, lance de novo este dia pelo app.' }));
        }
        return caixa;
      }

      // ---------- Formulário de lançamento ----------
      function abrirForm(pre) {
        lugarForm.innerHTML = '';
        var dia = pre.dia === 2 ? 2 : 1;
        var erro = el('p', { class: 'erro', role: 'alert', text: '' });
        var lista = el('datalist', { id: 'provas-catalogo' });
        r.catalogo.forEach(function (p) { lista.appendChild(el('option', { value: p.nome })); });
        var prova = el('input', { type: 'text', list: 'provas-catalogo', placeholder: 'Ex.: SAS 4 2024', autocomplete: 'off', maxlength: '80', 'aria-label': 'Nome da prova' });
        prova.value = pre.prova || '';
        var dica = el('small', { class: 'dica', text: '' });
        var data = el('input', { type: 'date', max: hojeIso(), 'aria-label': 'Data da prova' });
        data.value = pre.dataIso || hojeIso();
        var botoesDia = el('div', { class: 'dia-escolha', role: 'radiogroup', 'aria-label': 'Dia da prova' });
        var camposArea = el('div', { class: 'campos-area' });
        var red = { caixa: el('div', {}), inputs: [], ativa: false };
        var entradas = {};

        function dicaProva() {
          var k = norm(prova.value), p = catalogo[k], g = porChave[k];
          var partes = [];
          if (p && p.nome !== prova.value) partes.push('Prova reconhecida: "' + p.nome + '".');
          else if (p) partes.push('✓ Prova já cadastrada' + (p.alunos > 1 ? ' (lançada por ' + p.alunos + ' alunos)' : '') + '.');
          else if (k) partes.push('Prova nova: confira o nome, ele junta o Dia 1 com o Dia 2.');
          if (g && !pre.idLanc && g['d' + dia]) partes.push('Você já lançou o ' + DIAS[dia].nome + ' desta prova: ao salvar, vamos pedir para editar o existente.');
          dica.textContent = partes.join(' ');
        }
        prova.oninput = dicaProva;
        prova.onblur = function () { var p = catalogo[norm(prova.value)]; if (p) prova.value = p.nome; dicaProva(); };

        function desenharDia() {
          botoesDia.innerHTML = '';
          [1, 2].forEach(function (d) {
            var b = el('button', { class: 'dia-btn', type: 'button', role: 'radio', 'aria-checked': String(d === dia) }, [el('b', { text: DIAS[d].nome }), el('span', { text: DIAS[d].desc })]);
            if (pre.idLanc) b.disabled = d !== dia;
            b.onclick = function () { dia = d; desenharDia(); };
            botoesDia.appendChild(b);
          });
          camposArea.innerHTML = ''; entradas = {};
          var grade = el('div', { class: 'grade-num' });
          DIAS[dia].campos.forEach(function (f) { var n = numInput(f[1] + ' (acertos)', pre[f[0]], 45, f[0]); entradas[f[0]] = n.input; grade.appendChild(n.caixa); });
          camposArea.appendChild(grade);
          if (dia === 1) {
            var tem = pre.C && pre.C.some(function (x) { return x !== null && x !== '' && x !== undefined; });
            var chk = el('input', { type: 'checkbox' }); chk.checked = !!tem;
            var total = el('b', { class: 'total-red', text: '' });
            red = { caixa: el('div', { class: 'grade-num comp' }), inputs: [], ativa: !!tem };
            COMP.forEach(function (nome, i) { var n = numInput(nome, pre.C ? pre.C[i] : '', 200, 'C' + (i + 1)); n.input.oninput = somar; red.inputs.push(n.input); red.caixa.appendChild(n.caixa); });
            function somar() { var s = 0, todos = true; red.inputs.forEach(function (i) { if (i.value === '') todos = false; s += Number(i.value) || 0; }); total.textContent = 'Nota da redação: ' + s + (todos ? '' : ' (preencha as 5)'); }
            function mostrarRed() { red.ativa = chk.checked; red.caixa.style.display = chk.checked ? '' : 'none'; total.style.display = chk.checked ? '' : 'none'; }
            chk.onchange = mostrarRed;
            camposArea.appendChild(el('label', { class: 'check' }, [chk, ' Este simulado teve redação (notas de 0 a 200 por competência)']));
            camposArea.appendChild(red.caixa); camposArea.appendChild(total);
            somar(); mostrarRed();
          }
          dicaProva();
        }

        var salvar = el('button', { class: 'botao peq', type: 'button', text: pre.idLanc ? 'Salvar alterações' : 'Salvar simulado' });
        var cancelar = el('button', { class: 'mini', type: 'button', text: 'Cancelar' });
        cancelar.onclick = function () { lugarForm.innerHTML = ''; };
        salvar.onclick = function () {
          erro.textContent = '';
          var dados = { id: c.id, idLanc: pre.idLanc || '', prova: prova.value.trim(), dia: dia, data: data.value };
          if (!dados.prova) { erro.textContent = 'Informe o nome da prova.'; prova.focus(); return; }
          var falta = DIAS[dia].campos.filter(function (f) { var v = entradas[f[0]].value; return v === '' || Number(v) < 0 || Number(v) > 45 || Math.round(Number(v)) !== Number(v); })[0];
          if (falta) { erro.textContent = falta[1] + ': informe os acertos (0 a 45).'; entradas[falta[0]].focus(); return; }
          DIAS[dia].campos.forEach(function (f) { dados[f[0]] = Number(entradas[f[0]].value); });
          if (dia === 1 && red.ativa) {
            var vals = red.inputs.map(function (i) { return i.value; });
            if (vals.some(function (v) { return v === '' || Number(v) < 0 || Number(v) > 200; })) { erro.textContent = 'Redação: preencha as 5 competências (0 a 200) ou desmarque a redação.'; return; }
            dados.C = vals.map(Number);
          } else dados.C = ['', '', '', '', ''];
          salvar.disabled = true; salvar.textContent = 'Salvando…';
          c.api('salvarSimulado', dados).then(function (x) {
            salvar.disabled = false; salvar.textContent = pre.idLanc ? 'Salvar alterações' : 'Salvar simulado';
            if (x && x.ok) { c.aviso(pre.idLanc ? 'Lançamento atualizado.' : 'Simulado salvo! Atualizando o painel…'); simulados(raiz, c); c.aoMudar(); return; }
            if (x && x.erro === 'duplicado') {
              erro.textContent = x.msg;
              var ex = r.lancamentos.filter(function (l) { return l.id === x.idLanc; })[0];
              if (ex) { var b = el('button', { class: 'mini', type: 'button', text: 'Editar o lançamento existente' }); b.onclick = function () { abrirForm({ idLanc: ex.id, prova: ex.prova, dia: ex.dia, dataIso: ex.dataIso, L: ex.L, H: ex.H, N: ex.N, M: ex.M, C: ex.C }); }; erro.appendChild(el('br')); erro.appendChild(b); }
              return;
            }
            erro.textContent = msgErro(x);
          }).catch(function (e) { salvar.disabled = false; salvar.textContent = 'Salvar simulado'; if (e.message !== 'sessao') erro.textContent = 'Sem conexão. Tente de novo.'; });
        };

        lugarForm.appendChild(el('div', { class: 'card form-reg' }, [
          el('h3', { text: pre.idLanc ? 'Editar lançamento' : 'Lançar simulado' }),
          el('label', { class: 'campo' }, [el('span', { text: 'Nome da prova' }), prova, lista, dica]),
          el('div', { class: 'campo' }, [el('span', { text: 'Qual dia você está lançando?' }), botoesDia]),
          el('label', { class: 'campo curto' }, [el('span', { text: 'Data da prova' }), data]),
          camposArea, erro,
          el('div', { class: 'acoes-form' }, [salvar, cancelar])
        ]));
        desenharDia();
        lugarForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!pre.prova) prova.focus();
      }
    }
  }

  // Áreas: matéria do caderno → área do ENEM, e a numeração oficial do ENEM (Dia 1: 1–45 Linguagens, 46–90 Humanas;
  // Dia 2: 91–135 Natureza, 136–180 Matemática)
  var AREA_MAT = { 'Linguagens': 'L', 'História': 'H', 'Geografia': 'H', 'Sociologia': 'H', 'Filosofia': 'H', 'Física': 'N', 'Química': 'N', 'Biologia': 'N', 'Matemática': 'M' };
  var NOME_AREA = { L: 'Linguagens', H: 'Humanas', N: 'Natureza', M: 'Matemática' };
  function areaDaQuestao(q) { q = Number(q); return !(q >= 1 && q <= 180) ? null : q <= 45 ? 'L' : q <= 90 ? 'H' : q <= 135 ? 'N' : 'M'; }

  // ===================== Caderno de erros =====================
  function caderno(raiz, c) {
    carregando(raiz, 'Carregando caderno de erros…');
    c.api('caderno', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { falha(raiz, r); return; }
      desenhar(r);
    }).catch(function (e) { if (e.message !== 'sessao') falha(raiz, null); });

    function desenhar(r) {
      raiz.innerHTML = '';
      var pendentes = [];
      var partesDe = {};
      r.erros.forEach(function (e) { var l = partesDe[e.materia] = partesDe[e.materia] || []; if (e.parte && l.indexOf(e.parte) < 0) l.push(e.parte); });

      raiz.appendChild(el('div', { class: 'reg-topo' }, [el('div', {}, [
        el('h2', { class: 'reg-titulo', text: 'Caderno de erros' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: c.mentor ? 'Erros registrados pelo aluno: simulado, matéria, tema, motivo e o número da questão, para você conferir.'
          : 'Registre cada questão que você errou: o simulado, a matéria, o tema, o número da questão e o motivo. É assim que a gente descobre onde intervir.' })])]));

      // Resumo por matéria
      if (r.erros.length) {
        var cont = {};
        r.erros.forEach(function (e) { cont[e.materia] = (cont[e.materia] || 0) + 1; });
        var res = el('div', { class: 'resumo-materias' }, [el('span', { class: 'nota', style: 'margin:0', text: r.erros.length + (r.erros.length === 1 ? ' erro' : ' erros') + ':' })]);
        Object.keys(cont).sort(function (a, b) { return cont[b] - cont[a]; }).forEach(function (m) { res.appendChild(el('span', { class: 'tag', text: (m || 'Sem matéria') + ' ' + cont[m] })); });
        raiz.appendChild(res);
      }

      // Quantos erros faltam registrar em cada simulado (45 − acertos de cada área, contra o que já está no caderno)
      var esperados = r.esperados || {};
      function faltamDe(nomeSim, extras) {
        var esp = esperados[norm(nomeSim)];
        if (!esp) return null;
        var reg = { L: 0, H: 0, N: 0, M: 0 };
        r.erros.concat(extras || []).forEach(function (e) { if (norm(e.simulado) === norm(nomeSim) && AREA_MAT[e.materia]) reg[AREA_MAT[e.materia]]++; });
        return ['N', 'M', 'H', 'L'].filter(function (a) { return esp[a] !== null && esp[a] !== undefined; })
          .map(function (a) { return { area: a, nome: NOME_AREA[a], esperado: esp[a], registrado: reg[a], falta: Math.max(0, esp[a] - reg[a]) }; });
      }
      var totalFalta = 0, simsFalta = 0;
      r.simulados.forEach(function (sn) { var f = faltamDe(sn); if (!f) return; var t = f.reduce(function (s2, x) { return s2 + x.falta; }, 0); if (t) { totalFalta += t; simsFalta++; } });
      if (totalFalta && !c.mentor) raiz.appendChild(el('div', { class: 'aviso faltam' }, [el('b', { text: 'Faltam ' + totalFalta + ' erros para registrar' }),
        ' em ' + simsFalta + (simsFalta === 1 ? ' simulado' : ' simulados') + ' (pelos acertos que você lançou). Cada erro registrado entra na sua revisão.']));
      else if (totalFalta && c.mentor) raiz.appendChild(el('div', { class: 'aviso faltam' }, [el('b', { text: 'Faltam ' + totalFalta + ' erros para registrar' }), ' em ' + simsFalta + (simsFalta === 1 ? ' simulado' : ' simulados') + ', pelos acertos lançados pelo aluno.']));

      // ---------- Registrar (modo rápido) ----------
      var erro = el('p', { class: 'erro', role: 'alert', text: '' });
      var dicaFalta = el('p', { class: 'dica', style: 'margin:0', text: '' });
      var avisoNum = el('p', { class: 'dica alerta', style: 'margin:0', text: '' });
      var selSim = el('select', { 'aria-label': 'Simulado' });
      selSim.appendChild(el('option', { value: '', text: 'Escolha o simulado…' }));
      r.simulados.forEach(function (s) { selSim.appendChild(el('option', { value: s, text: s })); });
      selSim.appendChild(el('option', { value: '__outro', text: 'Outro (digitar o nome)…' }));
      var outroSim = el('input', { type: 'text', placeholder: 'Nome do simulado ou da lista de questões', maxlength: '80', 'aria-label': 'Nome do simulado' });
      outroSim.style.display = 'none';
      function mostrarFalta() {
        var f = selSim.value && selSim.value !== '__outro' ? faltamDe(selSim.value, pendentes) : null;
        if (!f || !f.length) { dicaFalta.textContent = ''; return; }
        var falta = f.filter(function (x) { return x.falta; });
        dicaFalta.textContent = falta.length ? 'Neste simulado faltam registrar: ' + falta.map(function (x) { return x.nome + ' ' + x.falta; }).join(' · ') + '.'
          : '✓ Todos os erros deste simulado já estão no caderno.';
      }
      selSim.onchange = function () { outroSim.style.display = selSim.value === '__outro' ? '' : 'none'; if (selSim.value === '__outro') outroSim.focus(); mostrarFalta(); };
      if (r.simulados.length) selSim.value = r.simulados[0];

      var selMat = el('select', { 'aria-label': 'Matéria' });
      selMat.appendChild(el('option', { value: '', text: 'Matéria…' }));
      r.materias.forEach(function (m) { selMat.appendChild(el('option', { value: m, text: m })); });
      var dl = el('datalist', { id: 'partes-sugestoes' });
      var parte = el('input', { type: 'text', list: 'partes-sugestoes', placeholder: 'Tema (ex.: Eletrodinâmica)', maxlength: '200', 'aria-label': 'Tema' });
      var questao = el('input', { type: 'text', inputmode: 'numeric', pattern: '[0-9]*', placeholder: 'Nº da questão', maxlength: '3', 'aria-label': 'Número da questão', class: 'num-questao' });
      selMat.onchange = function () { dl.innerHTML = ''; (partesDe[selMat.value] || []).forEach(function (p) { dl.appendChild(el('option', { value: p })); }); };
      var selMot = el('select', { 'aria-label': 'Motivo do erro' });
      selMot.appendChild(el('option', { value: '', text: 'Motivo do erro…' }));
      r.motivos.forEach(function (m) { selMot.appendChild(el('option', { value: m, text: m })); });
      selMot.appendChild(el('option', { value: '__outro', text: 'Outro motivo…' }));
      var outroMot = el('input', { type: 'text', placeholder: 'Qual foi o motivo?', maxlength: '80', 'aria-label': 'Outro motivo' });
      outroMot.style.display = 'none';
      selMot.onchange = function () { outroMot.style.display = selMot.value === '__outro' ? '' : 'none'; };

      var listaPend = el('div', { class: 'pendentes' });
      var btAdd = el('button', { class: 'mini', type: 'button', text: '+ Adicionar à lista' });
      var btSalvar = el('button', { class: 'botao peq', type: 'button', text: 'Salvar' });
      function simEscolhido() { return selSim.value === '__outro' ? outroSim.value.trim() : selSim.value; }
      function motEscolhido() { return selMot.value === '__outro' ? outroMot.value.trim() : selMot.value; }
      function desenharPend() {
        listaPend.innerHTML = '';
        pendentes.forEach(function (p, i) {
          var rm = el('button', { class: 'mini', type: 'button', 'aria-label': 'Remover', text: '✕' });
          rm.onclick = function () { pendentes.splice(i, 1); desenharPend(); };
          listaPend.appendChild(el('div', { class: 'item-erro pend' }, [el('span', { class: 'tag', text: p.materia }), el('span', { class: 'item-txt', text: 'Questão ' + p.questao + ' · ' + p.parte + ' · ' + p.motivo }), rm]));
        });
        btSalvar.disabled = !pendentes.length;
        btSalvar.textContent = pendentes.length ? 'Salvar ' + pendentes.length + (pendentes.length === 1 ? ' erro' : ' erros') : 'Salvar';
        mostrarFalta();
      }
      function adicionar() {
        erro.textContent = '';
        var e = { simulado: simEscolhido(), materia: selMat.value, parte: parte.value.trim(), questao: questao.value.trim(), motivo: motEscolhido() };
        if (!e.simulado) { erro.textContent = 'Escolha o simulado.'; return false; }
        if (!e.materia) { erro.textContent = 'Escolha a matéria.'; selMat.focus(); return false; }
        if (!e.parte) { erro.textContent = 'Escreva o tema em que errou.'; parte.focus(); return false; }
        if (!/^[0-9]{1,3}$/.test(e.questao) || Number(e.questao) < 1) { erro.textContent = 'Informe o número da questão (ex.: 45).'; questao.focus(); return false; }
        if (!e.motivo) { erro.textContent = 'Escolha o motivo do erro.'; selMot.focus(); return false; }
        if (pendentes.concat(r.erros).some(function (x) { return norm(x.simulado) === norm(e.simulado) && String(x.questao) === e.questao; })) {
          erro.textContent = 'A questão ' + e.questao + ' deste simulado já está no caderno.'; questao.focus(); return false;
        }
        var areaQ = areaDaQuestao(e.questao);
        avisoNum.textContent = areaQ && AREA_MAT[e.materia] && areaQ !== AREA_MAT[e.materia]
          ? 'Atenção: no ENEM, a questão ' + e.questao + ' é de ' + NOME_AREA[areaQ] + ' e você marcou ' + e.materia + '. Se o simulado segue a numeração do ENEM, confira; se não, pode ignorar.' : '';
        pendentes.push(e);
        (partesDe[e.materia] = partesDe[e.materia] || []).indexOf(e.parte) < 0 && partesDe[e.materia].push(e.parte);
        parte.value = ''; questao.value = ''; selMot.value = ''; outroMot.value = ''; outroMot.style.display = 'none';
        desenharPend(); parte.focus();
        return true;
      }
      btAdd.onclick = adicionar;
      parte.onkeydown = questao.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); adicionar(); } };
      btSalvar.onclick = function () {
        if (!pendentes.length) return;
        btSalvar.disabled = true; btSalvar.textContent = 'Salvando…';
        c.api('salvarErros', { id: c.id, erros: pendentes }).then(function (x) {
          if (!x || !x.ok) { erro.textContent = msgErro(x); desenharPend(); return; }
          c.aviso(x.n + (x.n === 1 ? ' erro registrado.' : ' erros registrados.') + ' Atualizando o painel…');
          caderno(raiz, c); c.aoMudar();
        }).catch(function (e) { if (e.message !== 'sessao') { erro.textContent = 'Sem conexão. Tente de novo.'; desenharPend(); } });
      };
      desenharPend();

      raiz.appendChild(el('div', { class: 'card form-reg' }, [
        el('h3', { text: 'Registrar erros' }),
        el('label', { class: 'campo' }, [el('span', { text: '1. Em qual simulado?' }), selSim, outroSim, dicaFalta]),
        el('div', { class: 'campo' }, [el('span', { text: '2. Cada questão que errou' }),
          el('div', { class: 'linha-erro' }, [selMat, parte, dl, el('div', { class: 'motivo-campo' }, [selMot, outroMot]), questao, btAdd])]),
        el('p', { class: 'nota', style: 'margin:0', text: 'Dica: aperte Enter no número da questão para adicionar e já começar o próximo. O simulado e a matéria continuam escolhidos.' }),
        avisoNum, listaPend, erro,
        el('div', { class: 'acoes-form' }, [btSalvar])
      ]));

      // ---------- Erros já registrados ----------
      var grupos = {}, ordem = [];
      r.erros.slice().reverse().forEach(function (e) { var k = e.simulado || 'Sem simulado'; if (!grupos[k]) { grupos[k] = []; ordem.push(k); } grupos[k].push(e); });
      if (!ordem.length) raiz.appendChild(el('div', { class: 'card vazio-card' }, [el('p', { class: 'vazio', text: c.mentor ? 'Nenhum erro registrado ainda.' : 'Nenhum erro registrado ainda. Comece pelo último simulado que você fez.' })]));
      ordem.forEach(function (k) {
        var card = el('div', { class: 'card' }, [el('div', { class: 'sim-cab' }, [el('b', { text: k }), el('span', { class: 'nota', style: 'margin:0', text: grupos[k].length + (grupos[k].length === 1 ? ' erro' : ' erros') })])]);
        var f = faltamDe(k);
        if (f && f.length) card.appendChild(el('div', { class: 'progresso-areas' }, f.map(function (x) {
          return el('span', { class: 'tag' + (x.falta ? '' : ' completo'), text: x.nome + ' ' + Math.min(x.registrado, x.esperado) + ' de ' + x.esperado });
        })));
        grupos[k].sort(function (a, b) { return (Number(a.questao) || 9999) - (Number(b.questao) || 9999); }).forEach(function (e) { card.appendChild(itemErro(e)); });
        raiz.appendChild(card);
      });

      function itemErro(e) {
        var acoes = el('div', { class: 'acoes' });
        var ed = el('button', { class: 'mini', type: 'button', text: 'Editar' });
        var ex = el('button', { class: 'mini', type: 'button', text: 'Excluir' });
        acoes.appendChild(ed); acoes.appendChild(ex);
        var item = el('div', { class: 'item-erro' }, [el('span', { class: 'q-num' + (e.questao ? '' : ' sem'), title: 'Número da questão', text: e.questao ? 'Q' + e.questao : 'Q?' }),
          el('span', { class: 'tag', text: e.materia || '—' }), el('span', { class: 'item-txt' }, [el('span', { text: e.parte }), el('small', { text: e.motivo })]), acoes]);
        ex.onclick = function () {
          confirmarInline(acoes, 'Excluir?', 'Excluir', function () {
            c.api('excluirErro', { id: c.id, linha: e.linha, antes: e }).then(function (x) {
              if (!x || !x.ok) { c.aviso(msgErro(x), true); caderno(raiz, c); return; }
              c.aviso('Erro excluído.'); caderno(raiz, c); c.aoMudar();
            }).catch(function () { c.aviso('Não foi possível excluir agora.', true); caderno(raiz, c); });
          });
        };
        ed.onclick = function () {
          var sMat = el('select', { 'aria-label': 'Matéria' }); r.materias.forEach(function (m) { sMat.appendChild(el('option', { value: m, text: m })); }); sMat.value = e.materia;
          var iPar = el('input', { type: 'text', maxlength: '200', 'aria-label': 'Tema' }); iPar.value = e.parte;
          var iQ = el('input', { type: 'text', inputmode: 'numeric', maxlength: '3', placeholder: 'Nº', 'aria-label': 'Número da questão', class: 'num-questao' }); iQ.value = e.questao || '';
          var sMot = el('input', { type: 'text', list: 'motivos-lista', maxlength: '80', 'aria-label': 'Motivo' }); sMot.value = e.motivo;
          var dlm = el('datalist', { id: 'motivos-lista' }); r.motivos.forEach(function (m) { dlm.appendChild(el('option', { value: m })); });
          var iSim = el('input', { type: 'text', list: 'simulados-lista', maxlength: '80', 'aria-label': 'Simulado' }); iSim.value = e.simulado;
          var dls = el('datalist', { id: 'simulados-lista' }); r.simulados.forEach(function (s) { dls.appendChild(el('option', { value: s })); });
          var ok = el('button', { class: 'mini forte', type: 'button', text: 'Salvar' });
          var no = el('button', { class: 'mini', type: 'button', text: 'Cancelar' });
          var msg = el('small', { class: 'erro', text: '' });
          var form = el('div', { class: 'item-erro editando' }, [el('div', { class: 'linha-erro edicao' }, [iSim, dls, sMat, iPar, sMot, dlm, iQ]), el('div', { class: 'acoes' }, [ok, no]), msg]);
          item.replaceWith(form);
          no.onclick = function () { form.replaceWith(item); };
          ok.onclick = function () {
            ok.disabled = true; ok.textContent = 'Salvando…';
            c.api('editarErro', { id: c.id, linha: e.linha, antes: e, depois: { simulado: iSim.value, materia: sMat.value, parte: iPar.value, questao: iQ.value.trim(), motivo: sMot.value } }).then(function (x) {
              if (!x || !x.ok) { ok.disabled = false; ok.textContent = 'Salvar'; msg.textContent = msgErro(x); return; }
              c.aviso('Erro atualizado.'); caderno(raiz, c); c.aoMudar();
            }).catch(function () { ok.disabled = false; ok.textContent = 'Salvar'; msg.textContent = 'Sem conexão. Tente de novo.'; });
          };
        };
        return item;
      }
    }
  }

  // ===================== Rotina =====================
  // Grade de 7 colunas fixas (segunda a domingo) e linhas livres. Só o mentor cadastrado do aluno edita (o servidor confere);
  // aluno e gestor só veem.
  var PALETA = [['', 'Sem cor'], ['#ff0000', 'Vermelho'], ['#ff9900', 'Laranja'], ['#ffff00', 'Amarelo'], ['#00ff00', 'Verde'],
    ['#4a86e8', 'Azul'], ['#9900ff', 'Roxo'], ['#ff00ff', 'Rosa'], ['#0b2545', 'Azul-marinho'],
    ['#f4cccc', 'Vermelho claro'], ['#fce5cd', 'Laranja claro'], ['#fff2cc', 'Amarelo claro'], ['#d9ead3', 'Verde claro'],
    ['#c9daf8', 'Azul claro'], ['#d9d2e9', 'Roxo claro'], ['#ead1dc', 'Rosa claro'], ['#e0e0e0', 'Cinza']];
  var NOMES_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  var rotinaSuja = false;
  function corTexto(fundo) { // mesmo critério da planilha (contraste WCAG)
    var c = String(fundo || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(c)) return '';
    var lin = function (k) { var v = parseInt(c.substr(k, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5) > 0.179 ? '#1f1f1f' : '#ffffff';
  }
  function pintar(no, cor) { no.style.background = cor || ''; no.style.color = cor ? corTexto(cor) : ''; }
  function diaDeHoje() { var d = new Date().getDay(); return d === 0 ? 6 : d - 1; }
  function linhaVazia() { return NOMES_DIAS.map(function () { return ''; }); }
  function temTexto(l) { return l.some(function (t) { return String(t || '').trim(); }); }
  function podeSair() {
    if (!rotinaSuja) return true;
    if (window.confirm('A rotina tem alterações não salvas. Sair mesmo assim?')) { rotinaSuja = false; window.onbeforeunload = null; return true; }
    return false;
  }

  function rotina(raiz, c) {
    rotinaSuja = false; window.onbeforeunload = null;
    carregando(raiz, 'Carregando rotina…');
    c.api('rotina', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { falha(raiz, r); return; }
      ver(r);
    }).catch(function (e) { if (e.message !== 'sessao') falha(raiz, null); });

    function ver(r) {
      rotinaSuja = false; window.onbeforeunload = null;
      raiz.innerHTML = '';
      var vazia = !r.linhas.some(temTexto);
      var topo = el('div', { class: 'reg-topo' }, [el('div', {}, [
        el('h2', { class: 'reg-titulo', text: c.mentor ? 'Rotina do aluno' : 'Minha rotina' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: !c.mentor ? 'Organizada pelo seu mentor. Para mudar algum bloco, converse com ele.'
          : r.podeEditar ? 'O aluno vê esta rotina no app e na planilha dele. Só você, como mentor dele, pode editar.'
          : 'Só o mentor cadastrado deste aluno edita a rotina. Aqui você só visualiza.' })])]);
      if (r.podeEditar) {
        var bt = el('button', { class: 'botao peq', type: 'button', text: vazia ? 'Montar rotina' : 'Editar rotina' });
        bt.onclick = function () { editar(r); };
        topo.appendChild(bt);
      }
      raiz.appendChild(topo);
      if (r.antiga && r.podeEditar) raiz.appendChild(el('div', { class: 'aviso', text: 'Esta rotina ainda está no formato antigo da planilha (segunda a sexta, 6 blocos, com o horário em cada bloco). Ao salvar pela primeira vez, ela passa para o formato novo, com sábado, domingo, linhas livres e cores.' }));
      if (vazia) {
        raiz.appendChild(el('div', { class: 'card vazio-card' }, [el('p', { class: 'vazio', text: c.mentor ? (r.podeEditar ? 'A rotina deste aluno ainda está vazia. Clique em "Montar rotina" para começar.' : 'A rotina deste aluno ainda está vazia. Quem monta é o mentor cadastrado dele.') : 'Seu mentor ainda não montou a sua rotina. Ela aparece aqui assim que ele salvar.' })]));
        return;
      }
      var h = diaDeHoje();
      if (!c.mentor) {
        var blocos = [];
        r.linhas.forEach(function (l, i) { if (String(l[h] || '').trim()) blocos.push([l[h], r.cores[i][h]]); });
        var hoje = el('div', { class: 'card hoje-card' }, [el('div', { class: 'hoje-tit' }, [el('b', { text: 'Hoje · ' + NOMES_DIAS[h] }), el('span', { class: 'nota', style: 'margin:0', text: blocos.length ? blocos.length + (blocos.length === 1 ? ' bloco' : ' blocos') : 'dia livre' })])]);
        var lista = el('div', { class: 'hoje-lista' });
        blocos.forEach(function (b) { var x = el('div', { class: 'hoje-bloco', text: b[0] }); if (b[1]) x.style.borderLeftColor = b[1]; lista.appendChild(x); });
        if (blocos.length) hoje.appendChild(lista);
        raiz.appendChild(hoje);
      }
      var tab = el('table', { class: 'rotina' }), cab = el('tr');
      NOMES_DIAS.forEach(function (d, j) { cab.appendChild(el('th', { class: j === h ? 'hoje' : '', scope: 'col', text: d })); });
      tab.appendChild(el('thead', {}, [cab]));
      var corpo = el('tbody');
      r.linhas.forEach(function (l, i) {
        var tr = el('tr');
        l.forEach(function (t, j) { var td = el('td', { class: j === h ? 'col-hoje' : '', text: t }); pintar(td, r.cores[i][j]); tr.appendChild(td); });
        corpo.appendChild(tr);
      });
      tab.appendChild(corpo);
      raiz.appendChild(el('div', { class: 'rotina-rolagem' }, [tab]));
      raiz.appendChild(el('p', { class: 'nota', style: 'margin:0', text: 'No celular, deslize a tabela para o lado para ver todos os dias.' }));
    }

    function editar(r) {
      var L = r.linhas.map(function (l) { return l.slice(); }), C = r.cores.map(function (l) { return l.slice(); });
      if (!L.length) for (var k = 0; k < (r.padrao || 8); k++) { L.push(linhaVazia()); C.push(linhaVazia()); }
      var sel = { i: 0, j: 0 }, alvo = 'celula', corAtual = PALETA[1][0];
      raiz.innerHTML = '';
      raiz.appendChild(el('div', { class: 'reg-topo' }, [el('div', {}, [
        el('h2', { class: 'reg-titulo', text: 'Editando a rotina' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: 'Escreva em cada bloco (Enter quebra a linha). Os dias da semana são fixos; as linhas você ajusta à vontade.' })])]));

      // Barra de ferramentas: cores e linhas
      var segs = el('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Aplicar a cor em' });
      [['celula', 'Bloco'], ['linha', 'Linha inteira'], ['coluna', 'Dia inteiro']].forEach(function (o) {
        var b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(alvo === o[0]), text: o[1] });
        b.onclick = function () { alvo = o[0]; Array.prototype.forEach.call(segs.children, function (x) { x.setAttribute('aria-checked', String(x === b)); }); };
        segs.appendChild(b);
      });
      var cores = el('div', { class: 'paleta' });
      PALETA.forEach(function (p) {
        var b = el('button', { type: 'button', class: 'sw-cor' + (p[0] ? '' : ' sem'), title: p[1], 'aria-label': 'Pintar de ' + p[1].toLowerCase() });
        if (p[0]) b.style.background = p[0];
        b.onclick = function () { corAtual = p[0]; aplicarCor(); };
        cores.appendChild(b);
      });
      var nLinhas = el('b', { class: 'n-linhas' });
      var menos = el('button', { class: 'mini', type: 'button', 'aria-label': 'Tirar a última linha', text: '−' });
      var mais = el('button', { class: 'mini', type: 'button', 'aria-label': 'Acrescentar uma linha no fim', text: '+' });
      var avisoLinhas = el('span', { class: 'confirmar' });
      menos.onclick = function () {
        if (L.length <= 1) return;
        if (temTexto(L[L.length - 1]) && avisoLinhas.textContent === '') { avisoLinhas.textContent = 'A última linha tem texto. Clique em − de novo para apagar.'; return; }
        avisoLinhas.textContent = ''; L.pop(); C.pop(); mudou(); desenharGrade();
      };
      mais.onclick = function () { if (L.length >= (r.maxLinhas || 30)) return; avisoLinhas.textContent = ''; L.push(linhaVazia()); C.push(linhaVazia()); mudou(); desenharGrade(); };
      raiz.appendChild(el('div', { class: 'card ferramentas' }, [
        el('div', { class: 'ferr-linha' }, [el('span', { class: 'ferr-rot', text: 'Cor em:' }), segs]),
        el('div', { class: 'ferr-linha' }, [el('span', { class: 'ferr-rot', text: 'Cores:' }), cores]),
        el('div', { class: 'ferr-linha' }, [el('span', { class: 'ferr-rot', text: 'Linhas:' }), menos, nLinhas, mais, avisoLinhas]),
        el('p', { class: 'nota', style: 'margin:0', text: 'Para colorir: clique num bloco, escolha se a cor vai no bloco, na linha inteira ou no dia inteiro, e clique na cor.' })
      ]));

      var grade = el('div', { class: 'rotina-rolagem' });
      raiz.appendChild(grade);
      var erro = el('p', { class: 'erro', role: 'alert', text: '' });
      var salvar = el('button', { class: 'botao peq', type: 'button', text: 'Salvar rotina' });
      var cancelar = el('button', { class: 'mini', type: 'button', text: 'Cancelar' });
      var status = el('span', { class: 'nota', style: 'margin:0' });
      var acoes = el('div', { class: 'acoes-form' }, [salvar, cancelar, status]);
      raiz.appendChild(erro);
      raiz.appendChild(acoes);

      function mudou() {
        if (!rotinaSuja) { rotinaSuja = true; window.onbeforeunload = function () { return 'Alterações não salvas'; }; }
        status.textContent = 'Alterações não salvas';
      }
      function ajustarAltura(t) { t.style.height = 'auto'; t.style.height = Math.max(44, t.scrollHeight + 2) + 'px'; }
      function marcarSel() {
        Array.prototype.forEach.call(grade.querySelectorAll('td.sel'), function (x) { x.classList.remove('sel'); });
        var td = grade.querySelector('td[data-i="' + sel.i + '"][data-j="' + sel.j + '"]');
        if (td) td.classList.add('sel');
      }
      function aplicarCor() {
        if (sel.i >= L.length) sel.i = L.length - 1;
        for (var i = 0; i < L.length; i++) for (var j = 0; j < NOMES_DIAS.length; j++) {
          var vai = alvo === 'celula' ? (i === sel.i && j === sel.j) : alvo === 'linha' ? i === sel.i : j === sel.j;
          if (vai) C[i][j] = corAtual;
        }
        mudou(); desenharGrade();
      }
      function moverLinha(i, d) {
        var k = i + d; if (k < 0 || k >= L.length) return;
        var t = L[i]; L[i] = L[k]; L[k] = t; t = C[i]; C[i] = C[k]; C[k] = t;
        if (sel.i === i) sel.i = k; mudou(); desenharGrade();
      }
      function desenharGrade() {
        nLinhas.textContent = String(L.length);
        menos.disabled = L.length <= 1; mais.disabled = L.length >= (r.maxLinhas || 30);
        var tab = el('table', { class: 'rotina editando' }), cab = el('tr');
        NOMES_DIAS.forEach(function (d) { cab.appendChild(el('th', { scope: 'col', text: d })); });
        cab.appendChild(el('th', { class: 'ferr-col', 'aria-label': 'Linha' }));
        tab.appendChild(el('thead', {}, [cab]));
        var corpo = el('tbody');
        L.forEach(function (l, i) {
          var tr = el('tr');
          l.forEach(function (t, j) {
            var ta = el('textarea', { rows: '2', maxlength: String(r.maxTexto || 300), 'aria-label': NOMES_DIAS[j] + ', linha ' + (i + 1) });
            ta.value = t;
            pintar(ta, C[i][j]);
            ta.onfocus = function () { sel = { i: i, j: j }; marcarSel(); };
            ta.oninput = function () { L[i][j] = ta.value; ajustarAltura(ta); mudou(); };
            var td = el('td', { 'data-i': String(i), 'data-j': String(j) }, [ta]);
            pintar(td, C[i][j]);
            tr.appendChild(td);
          });
          var sobe = el('button', { class: 'mini', type: 'button', title: 'Subir a linha', 'aria-label': 'Subir a linha ' + (i + 1), text: '↑' });
          var desce = el('button', { class: 'mini', type: 'button', title: 'Descer a linha', 'aria-label': 'Descer a linha ' + (i + 1), text: '↓' });
          var insere = el('button', { class: 'mini', type: 'button', title: 'Inserir uma linha abaixo', 'aria-label': 'Inserir uma linha abaixo da linha ' + (i + 1), text: '+' });
          var tira = el('button', { class: 'mini', type: 'button', title: 'Apagar a linha', 'aria-label': 'Apagar a linha ' + (i + 1), text: '✕' });
          sobe.disabled = i === 0; desce.disabled = i === L.length - 1;
          insere.disabled = L.length >= (r.maxLinhas || 30); tira.disabled = L.length <= 1;
          sobe.onclick = function () { moverLinha(i, -1); };
          desce.onclick = function () { moverLinha(i, 1); };
          insere.onclick = function () { L.splice(i + 1, 0, linhaVazia()); C.splice(i + 1, 0, linhaVazia()); mudou(); desenharGrade(); };
          tira.onclick = function () {
            if (temTexto(L[i]) && !tira.classList.contains('perigo')) { tira.classList.add('perigo'); tira.textContent = 'Apagar?'; return; }
            L.splice(i, 1); C.splice(i, 1); if (sel.i >= L.length) sel.i = L.length - 1; mudou(); desenharGrade();
          };
          tr.appendChild(el('td', { class: 'ferr-col' }, [el('div', { class: 'ferr-btns' }, [sobe, desce, insere, tira])]));
          corpo.appendChild(tr);
        });
        tab.appendChild(corpo);
        grade.innerHTML = '';
        grade.appendChild(tab);
        Array.prototype.forEach.call(grade.querySelectorAll('textarea'), ajustarAltura);
        marcarSel();
      }
      desenharGrade();

      cancelar.onclick = function () {
        if (!rotinaSuja) { ver(r); return; }
        confirmarInline(acoes, 'Descartar as alterações?', 'Descartar', function () { ver(r); });
      };
      salvar.onclick = function () {
        erro.textContent = '';
        salvar.disabled = true; salvar.textContent = 'Salvando…';
        c.api('salvarRotina', { id: c.id, linhas: L, cores: C, versao: r.versao }).then(function (x) {
          salvar.disabled = false; salvar.textContent = 'Salvar rotina';
          if (x && x.ok) {
            r.linhas = x.linhas; r.cores = x.cores; r.versao = x.versao; r.antiga = false;
            c.aviso(x.mudou ? 'Rotina salva. O aluno já vê a nova versão.' : 'Nada mudou na rotina.');
            ver(r); return;
          }
          erro.textContent = msgErro(x);
          if (x && x.erro === 'mudou') {
            var rec = el('button', { class: 'mini', type: 'button', text: 'Recarregar a rotina' });
            rec.onclick = function () { rotinaSuja = false; window.onbeforeunload = null; rotina(raiz, c); };
            erro.appendChild(el('br')); erro.appendChild(rec);
          }
        }).catch(function (e) { salvar.disabled = false; salvar.textContent = 'Salvar rotina'; if (e.message !== 'sessao') erro.textContent = 'Sem conexão. Suas alterações continuam aqui: tente salvar de novo.'; });
      };
    }
  }

  // ===================== Revisão espaçada do caderno =====================
  // Cada tema do caderno ("Matéria – Tema") volta para revisão 7 dias depois do erro. Revisou e foi bem: o próximo
  // intervalo é 1,4 vez o anterior (7 → 10 → 14 → 19 → 27 → 30 dias, teto de 30); foi bem na de 30 dias: consolidado.
  // Ainda com dificuldade, ou erro novo no tema: volta para 7 dias. Prioridade do dia = erros do tema × atraso relativo.
  var REV = { primeiro: 7, fator: 1.4, maximo: 30 };
  var ETAPAS = (function () { var l = [REV.primeiro], x = REV.primeiro; while (x < REV.maximo) { x = Math.min(x * REV.fator, REV.maximo); l.push(Math.round(x)); } return l; })();
  var SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  function diaN(iso) { var p = String(iso).split('-'); return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5); }
  function isoDe(n) { return new Date(n * 864e5).toISOString().slice(0, 10); }
  function dataCurta(iso) { var d = new Date(diaN(iso) * 864e5); return SEMANA[d.getUTCDay()] + ' ' + iso.slice(8, 10) + '/' + iso.slice(5, 7); }
  function maisUsada(c) { return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b); })[0]; }

  function agenda(erros, revisoes, hoje) {
    var g = {}, H = diaN(hoje);
    erros.forEach(function (e) {
      var k = norm(e.materia) + '|' + norm(e.tema);
      var x = g[k] = g[k] || { chave: k, materia: e.materia, grafias: {}, eventos: [], erros: [] };
      x.grafias[e.tema] = (x.grafias[e.tema] || 0) + 1; x.erros.push(e); x.eventos.push({ d: diaN(e.data), tipo: 'erro' });
    });
    revisoes.forEach(function (r) { var x = g[norm(r.materia) + '|' + norm(r.tema)]; if (x) x.eventos.push({ d: diaN(r.data), tipo: r.resultado }); });
    return Object.keys(g).map(function (k) {
      var x = g[k], intervalo = null, prox = null, etapa = 0, consolidado = false, nRev = 0;
      x.eventos.sort(function (a, b) { return a.d - b.d || (a.tipo === 'erro' ? -1 : b.tipo === 'erro' ? 1 : 0); }).forEach(function (ev) {
        if (ev.tipo === 'erro') { intervalo = REV.primeiro; etapa = 0; prox = ev.d + REV.primeiro; consolidado = false; return; }
        if (intervalo === null) return;
        nRev++;
        if (ev.tipo === 'dificil') { intervalo = REV.primeiro; etapa = 0; prox = ev.d + REV.primeiro; consolidado = false; return; }
        if (consolidado) return;
        if (intervalo >= REV.maximo) { consolidado = true; prox = null; etapa = ETAPAS.length; return; }
        intervalo = Math.min(intervalo * REV.fator, REV.maximo); etapa++; prox = ev.d + Math.round(intervalo);
      });
      var tema = maisUsada(x.grafias), atraso = prox === null ? 0 : H - prox;
      var questoes = x.erros.filter(function (e) { return e.questao; }).slice(-6).map(function (e) { return { q: e.questao, sim: e.simulado }; });
      return {
        chave: k, materia: x.materia, tema: tema, rotulo: x.materia + ' – ' + tema, nErros: x.erros.length, nRev: nRev, etapa: etapa,
        intervalo: intervalo === null ? null : Math.round(intervalo), proxima: prox === null ? null : isoDe(prox), atraso: atraso,
        situacao: consolidado ? 'consolidado' : prox !== null && prox <= H ? 'hoje' : 'agendado', questoes: questoes,
        prioridade: x.erros.length * (1 + Math.max(0, atraso) / Math.max(1, Math.round(intervalo || REV.primeiro)))
      };
    });
  }

  function textoQuestoes(qs) {
    if (!qs.length) return '';
    var por = {}, ordem = [];
    qs.forEach(function (x) { if (!por[x.sim]) { por[x.sim] = []; ordem.push(x.sim); } por[x.sim].push(x.q); });
    return ordem.map(function (s) { return (por[s].length === 1 ? 'a questão ' : 'as questões ') + por[s].join(', ') + ' do ' + s; }).join(' e ');
  }

  // Cartão do painel: o que revisar hoje (aluno marca; mentor e gestor só veem)
  function revisao(lugar, c) {
    lugar.innerHTML = '';
    var card = el('div', { class: 'card rev-card' }, [el('p', { class: 'carregando', style: 'margin:0', text: 'Montando sua revisão…' })]);
    lugar.appendChild(card);
    c.api('revisoes', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { if (r && r.erro === 'faseDesligada') lugar.innerHTML = ''; else card.innerHTML = ''; return; }
      desenhar(r);
    }).catch(function () { lugar.innerHTML = ''; });

    function desenhar(r) {
      var itens = agenda(r.erros, r.revisoes, r.hoje);
      var hoje = itens.filter(function (x) { return x.situacao === 'hoje'; }).sort(function (a, b) { return b.prioridade - a.prioridade; });
      var H = diaN(r.hoje);
      var proximos = itens.filter(function (x) { return x.situacao === 'agendado' && diaN(x.proxima) - H <= 7; }).sort(function (a, b) { return diaN(a.proxima) - diaN(b.proxima); });
      var consol = itens.filter(function (x) { return x.situacao === 'consolidado'; }).length;
      card.innerHTML = '';
      card.appendChild(el('div', { class: 'rev-cab' }, [el('div', {}, [el('h3', { text: c.mentor ? 'Revisões do aluno' : 'Revisão de hoje' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: 'Pela curva do esquecimento: cada tema do caderno volta 7 dias depois do erro e, a cada revisão boa, o intervalo cresce 1,4 vez (até 30 dias).' })]),
        itens.length ? el('span', { class: 'rev-resumo', text: itens.length + (itens.length === 1 ? ' tema' : ' temas') + ' na agenda' + (consol ? ' · ' + consol + ' consolidado' + (consol === 1 ? '' : 's') : '') }) : null]));
      if (!itens.length) { card.appendChild(el('p', { class: 'vazio', style: 'margin:6px 0 0', text: c.mentor ? 'O aluno ainda não registrou erros com tema no caderno.' : 'Registre os erros dos seus simulados no caderno: a agenda de revisão sai deles.' })); return; }
      if (!hoje.length) {
        var p0 = proximos[0] || itens.filter(function (x) { return x.situacao === 'agendado'; }).sort(function (a, b) { return diaN(a.proxima) - diaN(b.proxima); })[0];
        card.appendChild(el('p', { class: 'rev-msg ok', text: (c.mentor ? 'Nenhuma revisão pendente hoje.' : 'Tudo em dia! Nada para revisar hoje.') + (p0 ? ' Próxima: ' + p0.rotulo + ' em ' + dataCurta(p0.proxima) + '.' : '') }));
      } else {
        var t = hoje[0];
        var q = textoQuestoes(t.questoes);
        card.appendChild(el('p', { class: 'rev-msg' }, [c.mentor ? 'Prioridade do aluno hoje: ' : 'Hoje, comece por ', el('b', { text: t.rotulo }),
          ': ' + t.nErros + (t.nErros === 1 ? ' erro' : ' erros') + ' no caderno' + (t.atraso > 0 ? ' e ' + t.atraso + (t.atraso === 1 ? ' dia' : ' dias') + ' de atraso na revisão' : '') + '. ' +
          (c.mentor ? '' : 'Revise a teoria' + (q ? ', refaça ' + q : '') + ' e resolva questões novas do mesmo tema.')]));
        var lista = el('div', { class: 'rev-lista' });
        hoje.slice(0, 5).forEach(function (x) { lista.appendChild(itemRev(x)); });
        card.appendChild(lista);
        if (hoje.length > 5) {
          var mais = el('div', { class: 'rev-lista' }); hoje.slice(5).forEach(function (x) { mais.appendChild(itemRev(x)); });
          card.appendChild(el('details', { class: 'rev-mais' }, [el('summary', { text: 'Mais ' + (hoje.length - 5) + (hoje.length - 5 === 1 ? ' tema' : ' temas') + ' para revisar' }), mais]));
        }
      }
      if (proximos.length) card.appendChild(el('div', { class: 'rev-prox' }, [el('span', { class: 'nota', style: 'margin:0', text: 'Próximos 7 dias:' })].concat(
        proximos.slice(0, 8).map(function (x) { return el('span', { class: 'tag', text: dataCurta(x.proxima) + ' · ' + x.rotulo }); }))));

      function itemRev(x) {
        var info = x.nErros + (x.nErros === 1 ? ' erro' : ' erros') + ' · revisão ' + Math.min(x.etapa + 1, ETAPAS.length) + ' de ' + ETAPAS.length + ' · ' +
          (x.atraso > 0 ? 'atrasada ' + x.atraso + (x.atraso === 1 ? ' dia' : ' dias') : 'vence hoje');
        var box = el('div', { class: 'rev-item' }, [el('div', { class: 'rev-item-txt' }, [el('b', { text: x.rotulo }), el('small', { text: info }),
          x.questoes.length ? el('small', { text: 'Refazer: ' + textoQuestoes(x.questoes) }) : null])]);
        if (!c.mentor) {
          var bem = el('button', { class: 'mini forte', type: 'button', text: 'Revisei: fui bem' });
          var dif = el('button', { class: 'mini', type: 'button', text: 'Ainda tenho dificuldade' });
          var marcar = function (res) {
            bem.disabled = dif.disabled = true;
            c.api('registrarRevisao', { id: c.id, materia: x.materia, tema: x.tema, resultado: res }).then(function (y) {
              if (!y || !y.ok) { bem.disabled = dif.disabled = false; c.aviso(msgErro(y), true); return; }
              r.revisoes.push({ materia: x.materia, tema: x.tema, resultado: res, data: y.data || r.hoje });
              var depois = agenda(r.erros, r.revisoes, r.hoje).filter(function (z) { return z.chave === x.chave; })[0];
              c.aviso(depois && depois.situacao === 'consolidado' ? 'Tema consolidado! ' + x.rotulo + ' sai da agenda.'
                : res === 'bem' ? 'Boa! Próxima revisão de ' + x.rotulo + ' em ' + depois.intervalo + ' dias (' + dataCurta(depois.proxima) + ').'
                : 'Sem problema: ' + x.rotulo + ' volta em 7 dias (' + dataCurta(depois.proxima) + '). Vale falar disso com seu mentor.');
              desenhar(r);
            }).catch(function () { bem.disabled = dif.disabled = false; c.aviso('Sem conexão. Tente de novo.', true); });
          };
          bem.onclick = function () { marcar('bem'); };
          dif.onclick = function () { marcar('dificil'); };
          box.appendChild(el('div', { class: 'acoes' }, [bem, dif]));
        }
        return box;
      }
    }
  }

  // ===================== Simulados em PDF =====================
  function tamanhoTxt(b) { return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function brData(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : ''; }
  function baixar(c, p, bt) {
    var antes = bt.textContent; bt.disabled = true; bt.textContent = 'Baixando…';
    c.api('baixarPdf', { idPdf: p.id }).then(function (x) {
      bt.disabled = false; bt.textContent = antes;
      if (!x || !x.ok) { c.aviso(msgErro(x), true); return; }
      var bin = atob(x.base64), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      var a = el('a', { href: url, download: x.nome || (p.titulo + '.pdf') });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }).catch(function (e) { bt.disabled = false; bt.textContent = antes; if (e.message !== 'sessao') c.aviso('Não foi possível baixar agora. Tente de novo.', true); });
  }

  // Aluno: lista no topo da caixa Simulados, com atalho para lançar o resultado com o nome certo da prova
  function listaPdfs(lugar, c, porChave, aoLancar) {
    c.api('pdfs', {}).then(function (r) {
      if (!r || !r.ok || !r.pdfs.length) return;
      var H = diaN(r.hoje);
      var card = el('div', { class: 'card pdf-card' }, [el('div', { class: 'sim-cab' }, [el('b', { text: 'Simulados para baixar' }), el('span', { class: 'nota', style: 'margin:0', text: 'Faça a prova e depois lance o resultado aqui mesmo.' })])]);
      var lista = el('div', { class: 'pdf-lista' });
      r.pdfs.forEach(function (p, i) {
        var g = porChave[norm(p.titulo)];
        var feito = g ? (g.d1 && g.d2 ? '✓ Dia 1 e Dia 2 lançados' : g.d1 ? 'Falta lançar o Dia 2' : 'Falta lançar o Dia 1') : '';
        var novo = H - diaN(p.liberarEm) <= 7;
        var bt = el('button', { class: 'mini forte', type: 'button', text: 'Baixar PDF' });
        bt.onclick = function () { baixar(c, p, bt); };
        var lan = el('button', { class: 'mini', type: 'button', text: 'Lançar resultado' });
        lan.onclick = function () { aoLancar(p.titulo); };
        var item = el('div', { class: 'pdf-item' }, [el('div', { class: 'pdf-txt' }, [
          el('b', {}, [p.titulo, novo ? el('span', { class: 'selo-novo', text: 'novo' }) : null]),
          p.descricao ? el('small', { text: p.descricao }) : null,
          el('small', { text: 'Liberado em ' + brData(p.liberarEm) + ' · ' + tamanhoTxt(p.tamanho) + (feito ? ' · ' + feito : '') })]),
          el('div', { class: 'acoes' }, [bt, lan])]);
        if (i >= 3) item.classList.add('oculto');
        lista.appendChild(item);
      });
      card.appendChild(lista);
      if (r.pdfs.length > 3) {
        var ver = el('button', { class: 'link-voltar', type: 'button', text: 'Ver todos (' + r.pdfs.length + ')' });
        ver.onclick = function () { Array.prototype.forEach.call(lista.querySelectorAll('.oculto'), function (x) { x.classList.remove('oculto'); }); ver.remove(); };
        card.appendChild(ver);
      }
      lugar.appendChild(card);
    }).catch(function () { });
  }

  // Gestão (e mentores, só para ver e baixar): enviar, agendar, editar e remover
  function pdfsGestao(raiz, c) {
    carregando(raiz, 'Carregando simulados em PDF…');
    c.api('pdfs', {}).then(function (r) {
      if (!r || !r.ok) { falha(raiz, r); return; }
      desenhar(r);
    }).catch(function (e) { if (e.message !== 'sessao') falha(raiz, null); });

    function desenhar(r) {
      raiz.innerHTML = '';
      raiz.appendChild(el('div', { class: 'reg-topo' }, [el('div', {}, [el('h2', { class: 'reg-titulo', text: 'Simulados em PDF' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: r.podeGerenciar ? 'Os alunos baixam na caixa Simulados a partir da data de liberação. O nome do simulado é o mesmo que eles usam ao lançar o resultado.' : 'Simulados liberados para os alunos.' })])]));
      if (r.podeGerenciar) raiz.appendChild(formEnvio(r));
      var lista = el('div', { class: 'reg-lista' });
      if (!r.pdfs.length) lista.appendChild(el('div', { class: 'card vazio-card' }, [el('p', { class: 'vazio', text: 'Nenhum simulado em PDF publicado ainda.' })]));
      r.pdfs.forEach(function (p) { lista.appendChild(itemGestao(p, r)); });
      raiz.appendChild(lista);
    }

    function formEnvio(r) {
      var arq = el('input', { type: 'file', accept: 'application/pdf,.pdf', 'aria-label': 'Arquivo PDF' });
      var tit = el('input', { type: 'text', maxlength: '80', placeholder: 'Ex.: Simulado Cálculo Aprovação 3 — 2026', 'aria-label': 'Nome do simulado' });
      var desc = el('input', { type: 'text', maxlength: '300', placeholder: 'Opcional: ex.: Dia 1 e Dia 2 no mesmo arquivo; gabarito na última página', 'aria-label': 'Descrição' });
      var lib = el('input', { type: 'date', 'aria-label': 'Liberar em' }); lib.value = hojeIso();
      var erro = el('p', { class: 'erro', role: 'alert', text: '' });
      var env = el('button', { class: 'botao peq', type: 'button', text: 'Publicar simulado' });
      arq.onchange = function () { var f = arq.files[0]; if (f && !tit.value.trim()) tit.value = f.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' '); };
      env.onclick = function () {
        erro.textContent = '';
        var f = arq.files[0];
        if (!f) { erro.textContent = 'Escolha o arquivo PDF.'; return; }
        if (f.size > r.maxBytes) { erro.textContent = 'O PDF tem ' + tamanhoTxt(f.size) + ': o limite é ' + tamanhoTxt(r.maxBytes) + '. Reduza o arquivo e tente de novo.'; return; }
        if (!tit.value.trim()) { erro.textContent = 'Dê um nome ao simulado.'; tit.focus(); return; }
        env.disabled = true; env.textContent = 'Enviando… (pode levar até 1 minuto)';
        var leitor = new FileReader();
        leitor.onload = function () {
          var b64 = String(leitor.result).split(',')[1] || '';
          c.api('enviarPdf', { titulo: tit.value, descricao: desc.value, liberarEm: lib.value, nome: f.name, base64: b64 }).then(function (x) {
            env.disabled = false; env.textContent = 'Publicar simulado';
            if (!x || !x.ok) { erro.textContent = msgErro(x); return; }
            c.aviso('Simulado publicado.'); pdfsGestao(raiz, c);
          }).catch(function (e) { env.disabled = false; env.textContent = 'Publicar simulado'; if (e.message !== 'sessao') erro.textContent = 'O envio falhou (arquivo grande ou conexão). Tente de novo.'; });
        };
        leitor.onerror = function () { env.disabled = false; env.textContent = 'Publicar simulado'; erro.textContent = 'Não consegui ler o arquivo.'; };
        leitor.readAsDataURL(f);
      };
      return el('div', { class: 'card form-reg' }, [el('h3', { text: 'Publicar um simulado' }),
        el('label', { class: 'campo' }, [el('span', { text: 'Arquivo PDF (até ' + tamanhoTxt(r.maxBytes) + ')' }), arq]),
        el('label', { class: 'campo' }, [el('span', { text: 'Nome do simulado' }), tit, el('small', { class: 'dica', text: 'Use um nome único: é ele que junta os resultados de todos os alunos.' })]),
        el('label', { class: 'campo' }, [el('span', { text: 'Descrição' }), desc]),
        el('label', { class: 'campo curto' }, [el('span', { text: 'Liberar para os alunos em' }), lib]),
        erro, el('div', { class: 'acoes-form' }, [env])]);
    }

    function itemGestao(p, r) {
      var bt = el('button', { class: 'mini forte', type: 'button', text: 'Baixar' });
      bt.onclick = function () { baixar(c, p, bt); };
      var acoes = el('div', { class: 'acoes' }, [bt]);
      var info = (p.liberado ? 'Liberado em ' : 'Agendado para ') + brData(p.liberarEm) + ' · ' + tamanhoTxt(p.tamanho) + (r.podeGerenciar ? ' · ' + (p.downloads || 0) + (p.downloads === 1 ? ' download' : ' downloads') : '');
      var card = el('div', { class: 'card pdf-item' }, [el('div', { class: 'pdf-txt' }, [el('b', {}, [p.titulo, p.liberado ? null : el('span', { class: 'selo-agendado', text: 'agendado' })]),
        p.descricao ? el('small', { text: p.descricao }) : null, el('small', { text: info })]), acoes]);
      if (r.podeGerenciar) {
        var ed = el('button', { class: 'mini', type: 'button', text: 'Editar' });
        var rm = el('button', { class: 'mini', type: 'button', text: 'Remover' });
        acoes.appendChild(ed); acoes.appendChild(rm);
        rm.onclick = function () {
          confirmarInline(acoes, 'Tirar do app? (o arquivo fica no Drive)', 'Remover', function () {
            c.api('removerPdf', { idPdf: p.id }).then(function (x) { if (!x || !x.ok) c.aviso(msgErro(x), true); else c.aviso('Simulado removido do app.'); pdfsGestao(raiz, c); })
              .catch(function () { c.aviso('Não foi possível remover agora.', true); pdfsGestao(raiz, c); });
          });
        };
        ed.onclick = function () {
          var t = el('input', { type: 'text', maxlength: '80', 'aria-label': 'Nome do simulado' }); t.value = p.titulo;
          var d = el('input', { type: 'text', maxlength: '300', 'aria-label': 'Descrição' }); d.value = p.descricao;
          var l = el('input', { type: 'date', 'aria-label': 'Liberar em' }); l.value = p.liberarEm;
          var ok = el('button', { class: 'mini forte', type: 'button', text: 'Salvar' }), no = el('button', { class: 'mini', type: 'button', text: 'Cancelar' });
          var msg = el('small', { class: 'erro', text: '' });
          var form = el('div', { class: 'card form-reg' }, [el('label', { class: 'campo' }, [el('span', { text: 'Nome' }), t]), el('label', { class: 'campo' }, [el('span', { text: 'Descrição' }), d]),
            el('label', { class: 'campo curto' }, [el('span', { text: 'Liberar em' }), l]), el('div', { class: 'acoes' }, [ok, no]), msg]);
          card.replaceWith(form);
          no.onclick = function () { form.replaceWith(card); };
          ok.onclick = function () {
            ok.disabled = true;
            c.api('editarPdf', { idPdf: p.id, titulo: t.value, descricao: d.value, liberarEm: l.value }).then(function (x) {
              if (!x || !x.ok) { ok.disabled = false; msg.textContent = msgErro(x); return; }
              c.aviso('Simulado atualizado.'); pdfsGestao(raiz, c);
            }).catch(function () { ok.disabled = false; msg.textContent = 'Sem conexão. Tente de novo.'; });
          };
        };
      }
      return card;
    }
  }

  return { simulados: simulados, caderno: caderno, rotina: rotina, podeSair: podeSair, revisao: revisao, pdfsGestao: pdfsGestao, agenda: agenda, ETAPAS: ETAPAS };
})();

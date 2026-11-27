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
    faseDesligada: 'Esta parte do app ainda não está liberada.', proibido: 'Você não tem acesso a este aluno.', soMentor: 'Só o mentor cadastrado deste aluno pode editar a rotina.', soAluno: 'Só o próprio aluno marca os erros que já corrigiu.',
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

      // ---------- Erros já registrados: um bloco por simulado, com o nome sempre à vista ----------
      // O simulado mais recente começa aberto; os outros abrem com um toque. Com mais de um simulado, chips filtram a lista.
      // Para o aluno, erro marcado como corrigido sai da lista (fica em "Ver erros já corrigidos" para desfazer); ele continua
      // na planilha, na revisão espaçada e nos temas do painel. O mentor vê todos, com a data da correção.
      var lugarLista = el('div', { class: 'reg-lista' });
      raiz.appendChild(lugarLista);
      var filtroSim = '', verCorrigidos = false;
      desenharLista();

      function desenharLista() {
        lugarLista.innerHTML = '';
        var lista = c.mentor ? r.erros : r.erros.filter(function (e) { return !e.corrigido; });
        var feitos = c.mentor ? [] : r.erros.filter(function (e) { return e.corrigido; });
        var grupos = agrupar(lista), ordem = grupos.ordem;
        if (!ordem.length) lugarLista.appendChild(el('div', { class: 'card vazio-card' }, [el('p', { class: 'vazio', text: c.mentor ? 'Nenhum erro registrado ainda.'
          : feitos.length ? 'Você já corrigiu todos os erros registrados. Eles continuam na sua revisão espaçada.' : 'Nenhum erro registrado ainda. Comece pelo último simulado que você fez.' })]));
        if (filtroSim && ordem.indexOf(filtroSim) < 0) filtroSim = '';
        var blocos = [];
        if (ordem.length > 1) {
          var filtros = el('div', { class: 'filtros filtro-sim', role: 'group', 'aria-label': 'Filtrar por simulado' });
          [['', 'Todos', lista.length]].concat(ordem.map(function (k) { return [k, k, grupos.de[k].length]; })).forEach(function (o) {
            var bt = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(o[0] === filtroSim), title: o[1] }, [o[1], el('b', { text: String(o[2]) })]);
            bt.onclick = function () { filtroSim = o[0]; desenharLista(); };
            filtros.appendChild(bt);
          });
          lugarLista.appendChild(filtros);
        }
        ordem.forEach(function (k, idx) {
          if (filtroSim && k !== filtroSim) return;
          var itens = grupos.de[k], n = itens.length, nf = itens.filter(function (e) { return e.corrigido; }).length;
          var cab = el('button', { class: 'grupo-cab', type: 'button' }, [
            el('span', { class: 'grupo-nome' }, [el('span', { class: 'seta', 'aria-hidden': 'true' }), el('b', { text: k })]),
            el('span', { class: 'nota', style: 'margin:0', text: c.mentor ? n + (n === 1 ? ' erro' : ' erros') + (nf ? ' · ' + nf + (nf === 1 ? ' corrigido' : ' corrigidos') : '')
              : n + (n === 1 ? ' erro para corrigir' : ' erros para corrigir') })]);
          var corpo = el('div', { class: 'grupo-corpo' });
          var f = faltamDe(k);
          if (f && f.length) corpo.appendChild(el('div', { class: 'progresso-areas' }, f.map(function (x) {
            return el('span', { class: 'tag' + (x.falta ? '' : ' completo'), text: x.nome + ' ' + Math.min(x.registrado, x.esperado) + ' de ' + x.esperado });
          })));
          itens.forEach(function (e) { corpo.appendChild(itemErro(e)); });
          var card = el('div', { class: 'card grupo-sim', 'data-simulado': k }, [cab, corpo]);
          var abrir = function (v) { card.classList.toggle('aberto', v); cab.setAttribute('aria-expanded', String(v)); };
          cab.onclick = function () { abrir(!card.classList.contains('aberto')); };
          abrir(idx === 0 || !!filtroSim);
          blocos.push(card);
          lugarLista.appendChild(card);
        });
        if (feitos.length) {
          var ver = el('button', { class: 'link-corrigidos', type: 'button', 'aria-expanded': String(verCorrigidos),
            text: (verCorrigidos ? 'Esconder' : 'Ver') + ' erros já corrigidos (' + feitos.length + ')' });
          ver.onclick = function () { verCorrigidos = !verCorrigidos; desenharLista(); };
          lugarLista.appendChild(ver);
          if (verCorrigidos) {
            var caixa = el('div', { class: 'card corrigidos' }, [el('p', { class: 'nota', style: 'margin:0 0 4px', text: 'Já corrigidos. Continuam na sua revisão espaçada. Desmarque se marcou por engano.' })]);
            var gf = agrupar(feitos);
            gf.ordem.forEach(function (k) {
              caixa.appendChild(el('div', { class: 'corrigidos-sim', text: k }));
              gf.de[k].forEach(function (e) { caixa.appendChild(itemErro(e)); });
            });
            lugarLista.appendChild(caixa);
          }
        }
        // O cabeçalho do simulado gruda logo abaixo da barra fixa de alunos (mentor/gestor) enquanto a lista rola
        var fixo = document.querySelector('.seletor');
        document.documentElement.style.setProperty('--topo-fixo', (fixo ? fixo.offsetHeight : 0) + 'px');
      }

      // Agrupa por simulado (o mais recente primeiro) e ordena cada grupo pelo número da questão
      function agrupar(lista) {
        var de = {}, ordem = [];
        lista.slice().reverse().forEach(function (e) { var k = e.simulado || 'Sem simulado'; if (!de[k]) { de[k] = []; ordem.push(k); } de[k].push(e); });
        ordem.forEach(function (k) { de[k].sort(function (a, b) { return (Number(a.questao) || 9999) - (Number(b.questao) || 9999); }); });
        return { de: de, ordem: ordem };
      }

      function itemErro(e) {
        var acoes = el('div', { class: 'acoes' });
        var ed = el('button', { class: 'mini', type: 'button', text: 'Editar' });
        var ex = el('button', { class: 'mini', type: 'button', text: 'Excluir' });
        acoes.appendChild(ed); acoes.appendChild(ex);
        // Caixinha "já corrigi": o aluno marca; o mentor só vê (com a data)
        var feito = !!e.corrigido;
        var chk = el('button', { class: 'check-corr', type: 'button', role: 'checkbox', 'aria-checked': String(feito),
          'aria-label': 'Já corrigi a questão ' + (e.questao || ''), title: feito ? 'Corrigido em ' + e.corrigido : (c.mentor ? 'Ainda não corrigido' : 'Marque quando já tiver corrigido') });
        if (c.mentor) chk.disabled = true;
        var item = el('div', { class: 'item-erro' + (feito ? ' corrigido' : '') }, [chk, el('span', { class: 'q-num' + (e.questao ? '' : ' sem'), title: 'Número da questão', text: e.questao ? 'Q' + e.questao : 'Q?' }),
          el('span', { class: 'tag', text: e.materia || '—' }), el('span', { class: 'item-txt' }, [el('span', { text: e.parte }), el('small', { text: e.motivo + (feito && c.mentor ? ' · corrigido em ' + e.corrigido : '') })]), acoes]);
        chk.onclick = function () {
          // Na hora: o erro sai da lista (ou volta, se desmarcar); se o servidor recusar, desfaz
          var novo = !e.corrigido, antes = e.corrigido;
          var dados = { simulado: e.simulado, materia: e.materia, parte: e.parte, questao: e.questao };
          e.corrigido = novo ? hojeIso().split('-').reverse().join('/') : '';
          item.classList.add('saindo');
          setTimeout(desenharLista, 180);
          if (novo) c.aviso('Corrigido! Sai da sua lista, mas continua registrado para o seu mentor.');
          c.api('marcarCorrigido', { id: c.id, linha: e.linha, antes: dados, corrigido: novo }).then(function (x) {
            if (!x || !x.ok) { e.corrigido = antes; desenharLista(); c.aviso(msgErro(x), true); return; }
            e.corrigido = x.corrigido || '';
          }).catch(function () { e.corrigido = antes; desenharLista(); c.aviso('Sem conexão. Tente de novo.', true); });
        };
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
  // Grade de hora em hora × Segunda a Domingo, preenchida com atividades prontas. O mentor escolhe a atividade (ela vai
  // "na mão" do mouse) e clica ou arrasta nos horários: horário vago recebe a atividade; ocupado é trocado por ela.
  // Cada bloco aceita um detalhe (ex.: a disciplina) e a hora em que termina de verdade (ex.: até 19:30).
  // Só o mentor cadastrado do aluno edita (o servidor confere); aluno e gestor só veem.
  // Tipos: [id, nome, fundo, texto]. O servidor (Código.gs, ROTINA_TIPOS) usa a mesma lista: mude nos dois lugares.
  var TIPOS_ROTINA = [
    ['sono', 'Sono', '#cdebfa', '#0b4f71'], ['escola', 'Escola/cursinho', '#cbd5e1', '#1e293b'],
    ['translado', 'Translado', '#e5e7eb', '#374151'], ['treino', 'Treino', '#86efac', '#14532d'],
    ['aula', 'Aula', '#c7d2fe', '#312e81'], ['combo', 'Combo aula + questões', '#7c3aed', '#ffffff'],
    ['questoes', 'Questões', '#a5f3fc', '#164e63'], ['consolidacao', 'Consolidação', '#5eead4', '#134e4a'],
    ['revisao', 'Revisão', '#fdba74', '#7c2d12'], ['simulado', 'Simulado', '#d946ef', '#ffffff'],
    ['simfrag', 'Simulado fragmentado', '#f0abfc', '#701a75'],
    ['correcao', 'Correção de simulado', '#f5d0fe', '#701a75'], ['redacao', 'Redação', '#fda4af', '#881337'],
    ['refeicao', 'Refeição/pausa', '#ffedd5', '#9a3412'], ['lazer', 'Lazer', '#fef08a', '#713f12'],
    ['outro', 'Outro', '#f1f5f9', '#334155']
  ];
  var TIPO = {}; TIPOS_ROTINA.forEach(function (t) { TIPO[t[0]] = t; });
  var HORA_INI = 6, HORA_FIM = 23;
  var NOMES_DIAS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  var rotinaSuja = false;
  function corTexto(fundo) { // mesmo critério da planilha (contraste WCAG), usado no formato anterior
    var c = String(fundo || '').toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(c)) return '';
    var lin = function (k) { var v = parseInt(c.substr(k, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5) > 0.179 ? '#1f1f1f' : '#ffffff';
  }
  function pintar(no, cor) { no.style.background = cor || ''; no.style.color = cor ? corTexto(cor) : ''; }
  function diaDeHoje() { var d = new Date().getDay(); return d === 0 ? 6 : d - 1; }
  function temTexto(l) { return l.some(function (t) { return String(t || '').trim(); }); }
  function hh(h) { return (h < 10 ? '0' : '') + h + 'h'; }
  function linhaNula() { return NOMES_DIAS.map(function () { return null; }); }
  function gradeVazia() { var g = { inicio: HORA_INI, fim: HORA_FIM, celulas: [] }; for (var h = HORA_INI; h <= HORA_FIM; h++) g.celulas.push(linhaNula()); return g; }
  function tituloBloco(c) { return c.t === 'outro' ? (c.d || 'Outro') : (TIPO[c.t] || TIPO.outro)[1]; }
  function detalheBloco(c) { return c.t === 'outro' ? '' : (c.d || ''); }
  function textoBloco(c) { return [tituloBloco(c), detalheBloco(c), c.f ? 'até ' + c.f : ''].filter(Boolean).join(' · '); }
  function tituloComQuebra(t) { // deixa "Escola/cursinho" quebrar depois da barra, e não no meio da palavra
    var b = el('b'); String(t).split('/').forEach(function (p2, k) { if (k) { b.appendChild(document.createTextNode('/')); b.appendChild(el('wbr')); } b.appendChild(document.createTextNode(p2)); });
    return b;
  }
  function bloco(c) {
    var t = TIPO[c.t] || TIPO.outro;
    return el('div', { class: 'blk', title: textoBloco(c), style: 'background:' + t[2] + ';color:' + t[3] }, [
      tituloComQuebra(tituloBloco(c)), detalheBloco(c) ? el('small', { text: detalheBloco(c) }) : null, c.f ? el('small', { class: 'ate', text: 'até ' + c.f }) : null]);
  }
  var limparEditor = null; // desfaz o que o editor da rotina põe fora da área dele (fantasma, tecla Esc, seletor fixo)
  function fecharEditor() { if (limparEditor) { var f = limparEditor; limparEditor = null; f(); } }
  function podeSair() {
    if (rotinaSuja && !window.confirm('A rotina tem alterações não salvas. Sair mesmo assim?')) return false;
    rotinaSuja = false; window.onbeforeunload = null; fecharEditor();
    return true;
  }

  function rotina(raiz, c) {
    rotinaSuja = false; window.onbeforeunload = null; fecharEditor();
    carregando(raiz, 'Carregando rotina…');
    c.api('rotina', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { falha(raiz, r); return; }
      if (r.formato === 'horas') verHoras(r); else verLivre(r);
    }).catch(function (e) { if (e.message !== 'sessao') falha(raiz, null); });

    function cabecalho(titulo, nota, botao) {
      raiz.appendChild(el('div', { class: 'reg-topo' }, [el('div', {}, [el('h2', { class: 'reg-titulo', text: titulo }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: nota })]), botao]));
    }
    function notaPapel(r) {
      return !c.mentor ? 'Organizada pelo seu mentor. Para mudar algum bloco, converse com ele.'
        : r.podeEditar ? 'O aluno vê esta rotina no app e na planilha dele. Só você, como mentor dele, pode editar.'
        : 'Só o mentor cadastrado deste aluno edita a rotina. Aqui você só visualiza.';
    }

    // ---------- Visualização (formato por hora) ----------
    function verHoras(r) {
      rotinaSuja = false; window.onbeforeunload = null;
      raiz.innerHTML = '';
      var vazia = !r.celulas.some(function (l) { return l.some(Boolean); });
      var bt = null;
      if (r.podeEditar) { bt = el('button', { class: 'botao peq', type: 'button', text: vazia ? 'Montar rotina' : 'Editar rotina' }); bt.onclick = function () { editar(r, false); }; }
      cabecalho(c.mentor ? 'Rotina do aluno' : 'Minha rotina', notaPapel(r), bt);
      if (vazia) {
        raiz.appendChild(el('div', { class: 'card vazio-card' }, [el('p', { class: 'vazio', text: c.mentor ? (r.podeEditar ? 'A rotina deste aluno ainda está vazia. Clique em "Montar rotina" para começar.' : 'A rotina deste aluno ainda está vazia. Quem monta é o mentor cadastrado dele.') : 'Seu mentor ainda não montou a sua rotina. Ela aparece aqui assim que ele salvar.' })]));
        return;
      }
      var hj = diaDeHoje();
      raiz.appendChild(el('div', { class: 'rotina-rolagem' }, [tabelaHoras(r, hj)]));
      raiz.appendChild(el('p', { class: 'nota', style: 'margin:0', text: 'No celular, deslize a tabela para o lado para ver todos os dias.' }));
    }
    // Hoje: blocos iguais e seguidos viram um só ("09h–12h · Simulado")
    function cartaoHoje(r, hj) {
      var itens = [];
      r.celulas.forEach(function (l, i) {
        var x = l[hj], h = r.inicio + i;
        if (!x) return;
        var ult = itens[itens.length - 1];
        if (ult && ult.fimH === h && ult.c.t === x.t && ult.c.d === x.d && !ult.c.f) { ult.fimH = h + 1; ult.c = x; return; }
        itens.push({ ini: h, fimH: h + 1, c: x });
      });
      var card = el('div', { class: 'card hoje-card' }, [el('div', { class: 'hoje-tit' }, [el('b', { text: 'Hoje · ' + NOMES_DIAS[hj] }),
        el('span', { class: 'nota', style: 'margin:0', text: itens.length ? itens.length + (itens.length === 1 ? ' atividade' : ' atividades') : 'dia livre' })])]);
      if (itens.length) {
        var lista = el('div', { class: 'hoje-lista' });
        itens.forEach(function (it) {
          var fim = it.c.f || hh(it.fimH);
          lista.appendChild(el('div', { class: 'hoje-item' }, [el('span', { class: 'hoje-hora', text: hh(it.ini) + '–' + fim }), bloco(it.c)]));
        });
        card.appendChild(lista);
      }
      return card;
    }
    function tabelaHoras(r, hj) {
      var tab = el('table', { class: 'rotina horas' }), cab = el('tr', {}, [el('th', { class: 'hora', scope: 'col', 'aria-label': 'Hora' })]);
      NOMES_DIAS.forEach(function (d, j) { cab.appendChild(el('th', { class: j === hj ? 'hoje' : '', scope: 'col', text: d })); });
      tab.appendChild(el('thead', {}, [cab]));
      var corpo = el('tbody');
      r.celulas.forEach(function (l, i) {
        var tr = el('tr', {}, [el('th', { class: 'hora', scope: 'row', text: hh(r.inicio + i) })]);
        l.forEach(function (x, j) { tr.appendChild(el('td', { class: j === hj ? 'col-hoje' : '' }, x ? [bloco(x)] : [])); });
        corpo.appendChild(tr);
      });
      tab.appendChild(corpo);
      return tab;
    }

    function verLivre(r) {
      rotinaSuja = false; window.onbeforeunload = null;
      raiz.innerHTML = '';
      var vazia = !r.linhas.some(temTexto);
      var topo = el('div', { class: 'reg-topo' }, [el('div', {}, [
        el('h2', { class: 'reg-titulo', text: c.mentor ? 'Rotina do aluno' : 'Minha rotina' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: !c.mentor ? 'Organizada pelo seu mentor. Para mudar algum bloco, converse com ele.'
          : r.podeEditar ? 'O aluno vê esta rotina no app e na planilha dele. Só você, como mentor dele, pode editar.'
          : 'Só o mentor cadastrado deste aluno edita a rotina. Aqui você só visualiza.' })])]);
      if (r.podeEditar) {
        var bt = el('button', { class: 'botao peq', type: 'button', text: 'Montar rotina por hora' });
        bt.onclick = function () { var g = gradeVazia(); g.versao = r.versao; editar(g, true); };
        topo.appendChild(bt);
      }
      raiz.appendChild(topo);
      if (r.podeEditar) raiz.appendChild(el('div', { class: 'aviso', text: 'Esta rotina está no formato anterior (texto livre). Clique em "Montar rotina por hora" para montar a nova grade com as atividades prontas; ao salvar, ela substitui esta.' }));
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


    // ---------- Editor (mentor): pincel de atividades ----------
    function editar(r, substituiLivre) {
      var ini = r.inicio, fim = r.fim;
      var cel = r.celulas.map(function (l) { return l.map(function (x) { return x ? { t: x.t, d: x.d || '', f: x.f || '' } : null; }); });
      var pincel = null, detalhePincel = '', sel = null, arrastando = false;
      // Desfazer / refazer: fotografia da grade antes de cada mudança (até 50 passos)
      var pilha = [], refazer = [];
      function foto() { return JSON.stringify({ ini: ini, fim: fim, cel: cel }); }
      function guardar() { pilha.push(foto()); if (pilha.length > 50) pilha.shift(); refazer = []; atualizarDesfazer(); }
      function restaurar(txt) { var o = JSON.parse(txt); ini = o.ini; fim = o.fim; cel = o.cel; sIni.value = String(ini); sFim.value = String(fim); sel = null; mudou(); desenharGrade(); atualizarDesfazer(); }
      function desfazer() { if (!pilha.length) return; refazer.push(foto()); restaurar(pilha.pop()); }
      function refazerUm() { if (!refazer.length) return; pilha.push(foto()); restaurar(refazer.pop()); }
      var maxD = r.maxDetalhe || 80;
      raiz.innerHTML = '';
      cabecalho('Editando a rotina', 'Escolha uma atividade e clique (ou arraste) nos horários. Clicar num bloco ocupado troca pela atividade escolhida.', null);
      if (substituiLivre) raiz.appendChild(el('div', { class: 'aviso', text: 'Ao salvar, esta grade por hora substitui a rotina do formato anterior.' }));

      // Paleta
      var paleta = el('div', { class: 'paleta-ativ', role: 'group', 'aria-label': 'Atividades' });
      var chips = {};
      TIPOS_ROTINA.concat([['borracha', 'Borracha', '#ffffff', '#9a2e28']]).forEach(function (t) {
        var b = el('button', { class: 'ativ' + (t[0] === 'borracha' ? ' borracha' : ''), type: 'button', 'aria-pressed': 'false', style: 'background:' + t[2] + ';color:' + t[3], text: t[1] });
        b.onclick = function () { escolher(pincel === t[0] ? null : t[0]); };
        chips[t[0]] = b; paleta.appendChild(b);
      });
      var inDet = el('input', { type: 'text', maxlength: String(maxD), placeholder: 'ex.: Física, Simulado dia 1', 'aria-label': 'Detalhe dos próximos blocos' });
      inDet.oninput = function () { detalhePincel = inDet.value.trim(); avisoPincel.textContent = ''; };
      var avisoPincel = el('span', { class: 'erro', style: 'margin:0;font-size:12.5px' });
      var opcHoras = function (de, ate, v) { var s2 = el('select', {}); for (var h = de; h <= ate; h++) { var o = el('option', { value: String(h), text: hh(h) }); if (h === v) o.selected = true; s2.appendChild(o); } return s2; };
      var sIni = opcHoras(0, 23, ini), sFim = opcHoras(0, 23, fim);
      sIni.setAttribute('aria-label', 'Primeiro horário'); sFim.setAttribute('aria-label', 'Último horário');
      sIni.onchange = sFim.onchange = function () { mudarHoras(Number(sIni.value), Number(sFim.value)); };
      // Bloco selecionado: detalhe e horário em que termina
      var selRot = el('b', { class: 'sel-rot' }), selDet = el('input', { type: 'text', maxlength: String(maxD), placeholder: 'Detalhe (opcional)', 'aria-label': 'Detalhe do bloco' });
      var selFim = el('input', { type: 'time', step: '300', 'aria-label': 'Termina às' }), selApaga = el('button', { class: 'mini', type: 'button', text: 'Apagar bloco' });
      var selDica = el('span', { class: 'nota', style: 'margin:0', text: 'Toque num bloco para escrever um detalhe ou o horário em que ele termina.' });
      var selCampos = el('div', { class: 'sel-campos' }, [selRot, selDet, el('label', { class: 'sel-fim' }, ['termina às ', selFim]), selApaga]);
      selDet.onfocus = function () { guardar(); };
      selDet.oninput = function () { if (!sel) return; var x = cel[sel.i][sel.j]; if (!x) return; x.d = selDet.value; redesenhar(sel.i, sel.j); mudou(); };
      selFim.onfocus = function () { guardar(); };
      selFim.oninput = function () { if (!sel) return; var x = cel[sel.i][sel.j]; if (!x) return; x.f = selFim.value || ''; redesenhar(sel.i, sel.j); mudou(); };
      selApaga.onclick = function () { if (!sel) return; guardar(); cel[sel.i][sel.j] = null; redesenhar(sel.i, sel.j); mudou(); mostrarSel(); };
      var btDesfazer = el('button', { class: 'mini', type: 'button', text: '↶ Desfazer (Ctrl+Z)' }), btRefazer = el('button', { class: 'mini', type: 'button', text: '↷ Refazer (Ctrl+Y)' });
      var passos = el('span', { class: 'nota', style: 'margin:0' });
      btDesfazer.onclick = desfazer; btRefazer.onclick = refazerUm;
      function atualizarDesfazer() { btDesfazer.disabled = !pilha.length; btRefazer.disabled = !refazer.length; passos.textContent = pilha.length ? pilha.length + (pilha.length === 1 ? ' passo para desfazer' : ' passos para desfazer') : ''; }

      raiz.appendChild(el('div', { class: 'card ferramentas' }, [
        el('div', { class: 'ferr-linha' }, [el('span', { class: 'ferr-rot', text: 'Atividade:' }), paleta]),
        el('div', { class: 'ferr-linha' }, [el('span', { class: 'ferr-rot', text: 'Detalhe:' }), inDet, el('span', { class: 'nota dica-det', style: 'margin:0', text: 'vai junto nos próximos blocos que você colocar' }), avisoPincel]),
        el('div', { class: 'ferr-linha horas-linha' }, [el('span', { class: 'ferr-rot', text: 'Horário:' }), 'das ', sIni, ' às ', sFim]),
        el('div', { class: 'ferr-linha sel-linha' }, [el('span', { class: 'ferr-rot', text: 'Bloco:' }), selDica, selCampos]),
        el('div', { class: 'ferr-linha horas-linha' }, [el('span', { class: 'ferr-rot', text: 'Desfazer:' }), btDesfazer, btRefazer, passos])
      ]));

      var grade = el('div', { class: 'rotina-rolagem grade-edit' });
      // Enquanto edita, a lista de mentorados rola junto e só a caixa de atividades fica presa no topo
      document.body.classList.add('editando-rotina');
      var fantasma = el('div', { class: 'fantasma', 'aria-hidden': 'true' });
      raiz.appendChild(grade);
      document.body.appendChild(fantasma);
      var erro = el('p', { class: 'erro', role: 'alert', text: '' });
      var salvar = el('button', { class: 'botao peq', type: 'button', text: 'Salvar rotina' });
      var cancelar = el('button', { class: 'mini', type: 'button', text: 'Cancelar' });
      var status = el('span', { class: 'nota', style: 'margin:0' });
      var acoes = el('div', { class: 'acoes-form' }, [salvar, cancelar, status]);
      raiz.appendChild(erro); raiz.appendChild(acoes);

      function mudou() { if (!rotinaSuja) { rotinaSuja = true; window.onbeforeunload = function () { return 'Alterações não salvas'; }; } status.textContent = 'Alterações não salvas'; }
      function escolher(id) {
        pincel = id; avisoPincel.textContent = '';
        Object.keys(chips).forEach(function (k) { chips[k].setAttribute('aria-pressed', String(k === id)); });
        grade.classList.toggle('com-pincel', !!id);
        if (id) { var t = id === 'borracha' ? ['', 'Borracha', '#ffffff', '#9a2e28'] : TIPO[id]; fantasma.textContent = t[1]; fantasma.style.background = t[2]; fantasma.style.color = t[3]; fantasma.classList.toggle('borracha', id === 'borracha'); }
        else fantasma.style.display = 'none';
      }
      function mostrarSel() {
        var x = sel ? cel[sel.i][sel.j] : null;
        selDica.style.display = x ? 'none' : ''; selCampos.style.display = x ? '' : 'none';
        Array.prototype.forEach.call(grade.querySelectorAll('td.sel'), function (n) { n.classList.remove('sel'); });
        if (!sel) return;
        var td = grade.querySelector('td[data-i="' + sel.i + '"][data-j="' + sel.j + '"]');
        if (td) td.classList.add('sel');
        if (!x) return;
        selRot.textContent = NOMES_DIAS[sel.j].slice(0, 3) + ' ' + hh(ini + sel.i) + ' · ' + (TIPO[x.t] || TIPO.outro)[1];
        if (document.activeElement !== selDet) selDet.value = x.d || '';
        if (document.activeElement !== selFim) selFim.value = x.f || '';
        selDet.placeholder = x.t === 'outro' ? 'Nome da atividade (obrigatório)' : 'Detalhe (opcional)';
      }
      function aplicar(i, j) {
        if (pincel === 'borracha') cel[i][j] = null;
        else {
          if (pincel === 'outro' && !detalhePincel) { avisoPincel.textContent = 'Para "Outro", escreva o nome da atividade no Detalhe.'; inDet.focus(); return false; }
          cel[i][j] = { t: pincel, d: detalhePincel, f: '' };
        }
        sel = { i: i, j: j }; redesenhar(i, j); mudou(); mostrarSel();
        return true;
      }
      function redesenhar(i, j) {
        var td = grade.querySelector('td[data-i="' + i + '"][data-j="' + j + '"]');
        if (!td) return;
        td.innerHTML = '';
        if (cel[i][j]) td.appendChild(bloco(cel[i][j]));
      }
      function celulaDoPonto(x, y) { var n = document.elementFromPoint(x, y); n = n && n.closest ? n.closest('td[data-i]') : null; return n && grade.contains(n) ? n : null; }
      function desenharGrade() {
        var tab = el('table', { class: 'rotina horas editando' }), cab = el('tr', {}, [el('th', { class: 'hora', 'aria-label': 'Hora' })]);
        NOMES_DIAS.forEach(function (d) { cab.appendChild(el('th', { scope: 'col', text: d })); });
        tab.appendChild(el('thead', {}, [cab]));
        var corpo = el('tbody');
        cel.forEach(function (l, i) {
          var tr = el('tr', {}, [el('th', { class: 'hora', scope: 'row', text: hh(ini + i) })]);
          l.forEach(function (x, j) {
            var td = el('td', { 'data-i': String(i), 'data-j': String(j), tabindex: '0', title: NOMES_DIAS[j] + ', ' + hh(ini + i), 'aria-label': NOMES_DIAS[j] + ' ' + hh(ini + i) }, x ? [bloco(x)] : []);
            td.onkeydown = function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); clicar(i, j); } };
            tr.appendChild(td);
          });
          corpo.appendChild(tr);
        });
        tab.appendChild(corpo);
        grade.innerHTML = ''; grade.appendChild(tab);
        mostrarSel();
      }
      function clicar(i, j) { if (pincel) aplicar(i, j); else { sel = { i: i, j: j }; mostrarSel(); if (cel[i][j]) selDet.focus(); } }
      // Clique e arraste para pintar vários horários de uma vez (mouse e toque)
      grade.addEventListener('pointerdown', function (ev) {
        var td = ev.target.closest ? ev.target.closest('td[data-i]') : null;
        if (!td) return;
        var i = Number(td.getAttribute('data-i')), j = Number(td.getAttribute('data-j'));
        if (pincel) { ev.preventDefault(); guardar(); arrastando = aplicar(i, j); if (!arrastando) { pilha.pop(); atualizarDesfazer(); } if (arrastando && grade.setPointerCapture) try { grade.setPointerCapture(ev.pointerId); } catch (e) { } }
        else clicar(i, j);
      });
      grade.addEventListener('pointermove', function (ev) {
        if (pincel && ev.pointerType === 'mouse') { fantasma.style.display = 'block'; fantasma.style.left = (ev.clientX + 14) + 'px'; fantasma.style.top = (ev.clientY + 14) + 'px'; }
        if (!arrastando) return;
        var td = celulaDoPonto(ev.clientX, ev.clientY);
        if (!td) return;
        var i = Number(td.getAttribute('data-i')), j = Number(td.getAttribute('data-j')), x = cel[i][j];
        var igual = pincel === 'borracha' ? !x : x && x.t === pincel && x.d === detalhePincel && !x.f;
        if (!igual) aplicar(i, j);
      });
      var parar = function () { arrastando = false; };
      grade.addEventListener('pointerup', parar); grade.addEventListener('pointercancel', parar);
      grade.addEventListener('pointerleave', function () { fantasma.style.display = 'none'; });
      var teclaEsc = function (ev) {
        if (ev.key === 'Escape' && pincel) { escolher(null); return; }
        var t = ev.target, emCampo = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
        if (emCampo || !(ev.ctrlKey || ev.metaKey)) return; // dentro de um campo, o Ctrl+Z é o do próprio campo
        var k = String(ev.key).toLowerCase();
        if (k === 'z' && !ev.shiftKey) { ev.preventDefault(); desfazer(); }
        else if (k === 'y' || (k === 'z' && ev.shiftKey)) { ev.preventDefault(); refazerUm(); }
      };
      document.addEventListener('keydown', teclaEsc);
      function sair() { fecharEditor(); }
      limparEditor = function () { document.removeEventListener('keydown', teclaEsc); fantasma.remove(); document.body.classList.remove('editando-rotina'); };

      function mudarHoras(nIni, nFim) {
        if (nFim < nIni) { var tmp = nIni; nIni = nFim; nFim = tmp; sIni.value = String(nIni); sFim.value = String(nFim); }
        var perde = cel.some(function (l, i) { var h = ini + i; return (h < nIni || h > nFim) && l.some(Boolean); });
        if (perde && !window.confirm('Alguns horários que vão sair da grade têm atividades. Apagar esses blocos?')) { sIni.value = String(ini); sFim.value = String(fim); return; }
        guardar();
        var nova = [];
        for (var h = nIni; h <= nFim; h++) nova.push(h >= ini && h <= fim ? cel[h - ini] : linhaNula());
        if (sel) { var hs = ini + sel.i; sel = hs >= nIni && hs <= nFim ? { i: hs - nIni, j: sel.j } : null; }
        cel = nova; ini = nIni; fim = nFim; mudou(); desenharGrade();
      }
      desenharGrade();
      escolher(null);
      atualizarDesfazer();

      cancelar.onclick = function () {
        var voltar = function () { sair(); rotina(raiz, c); };
        if (!rotinaSuja) { voltar(); return; }
        confirmarInline(acoes, 'Descartar as alterações?', 'Descartar', function () { rotinaSuja = false; window.onbeforeunload = null; voltar(); });
      };
      salvar.onclick = function () {
        erro.textContent = '';
        var semNome = null;
        cel.forEach(function (l, i) { l.forEach(function (x, j) { if (x && x.t === 'outro' && !String(x.d || '').trim() && !semNome) semNome = { i: i, j: j }; }); });
        if (semNome) { sel = semNome; mostrarSel(); erro.textContent = 'Um bloco "Outro" está sem nome: escreva o nome da atividade no Detalhe.'; return; }
        salvar.disabled = true; salvar.textContent = 'Salvando…';
        c.api('salvarRotinaHoras', { id: c.id, inicio: ini, fim: fim, celulas: cel, versao: r.versao }).then(function (x) {
          salvar.disabled = false; salvar.textContent = 'Salvar rotina';
          if (x && x.ok) {
            rotinaSuja = false; window.onbeforeunload = null; sair();
            c.aviso(x.mudou ? 'Rotina salva. O aluno já vê a nova versão.' : 'Nada mudou na rotina.');
            verHoras({ formato: 'horas', inicio: x.inicio, fim: x.fim, celulas: x.celulas, versao: x.versao, podeEditar: true, maxDetalhe: maxD });
            return;
          }
          erro.textContent = msgErro(x);
          if (x && x.erro === 'mudou') {
            var rec = el('button', { class: 'mini', type: 'button', text: 'Recarregar a rotina' });
            rec.onclick = function () { rotinaSuja = false; window.onbeforeunload = null; sair(); rotina(raiz, c); };
            erro.appendChild(el('br')); erro.appendChild(rec);
          }
        }).catch(function (e) { salvar.disabled = false; salvar.textContent = 'Salvar rotina'; if (e.message !== 'sessao') erro.textContent = 'Sem conexão. Suas alterações continuam aqui: tente salvar de novo.'; });
      };
    }
  }

  // ===================== Revisão espaçada do caderno =====================
  // Cada tema do caderno ("Matéria – Tema") volta para revisão 7 dias depois do erro. Depois de cada revisão o aluno diz
  // como foi e o intervalo é multiplicado: fácil × 1,6 · médio × 1,4 · difícil × 0,5 (mínimo 7, teto 30 dias).
  // Fácil ou médio na revisão de 30 dias: tema consolidado. Erro novo no tema: volta para 7 dias.
  // Prioridade do dia = erros do tema × atraso relativo. ("bem", dos primeiros registros, conta como médio.)
  var REV = { primeiro: 7, maximo: 30, fator: { facil: 1.6, medio: 1.4, bem: 1.4, dificil: 0.5 } };
  var ETAPAS = (function () { var l = [REV.primeiro], x = REV.primeiro; while (x < REV.maximo) { x = Math.min(x * REV.fator.medio, REV.maximo); l.push(Math.round(x)); } return l; })();
  function etapaDe(intervalo) { var k = 0; ETAPAS.forEach(function (e, i) { if (Math.round(intervalo) >= e) k = i; }); return k; }
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
        var f = REV.fator[ev.tipo];
        if (!f || consolidado) return;
        if (f >= 1 && intervalo >= REV.maximo) { consolidado = true; prox = null; etapa = ETAPAS.length; return; }
        intervalo = Math.max(REV.primeiro, Math.min(intervalo * f, REV.maximo)); etapa = etapaDe(intervalo); prox = ev.d + Math.round(intervalo);
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

  // Revisão no painel: só os temas do dia, em linhas simples (aluno marca; mentor e gestor só veem)
  function revisao(lugar, c) {
    lugar.innerHTML = '';
    var titulo = el('div', { class: 'sec', text: c.mentor ? 'Revisões do aluno' : 'Revisão de hoje' });
    var card = el('div', { class: 'card rev' }, [el('p', { class: 'rev-vazio', text: 'Carregando…' })]);
    lugar.appendChild(el('div', { class: 'rev-bloco' }, [titulo, card]));
    c.api('revisoes', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { lugar.innerHTML = ''; return; }
      desenhar(r);
    }).catch(function () { lugar.innerHTML = ''; });

    function desenhar(r) {
      var itens = agenda(r.erros, r.revisoes, r.hoje), H = diaN(r.hoje);
      var hoje = itens.filter(function (x) { return x.situacao === 'hoje'; }).sort(function (a, b) { return b.prioridade - a.prioridade; });
      var prox = itens.filter(function (x) { return x.situacao === 'agendado'; }).sort(function (a, b) { return diaN(a.proxima) - diaN(b.proxima); })[0];
      card.innerHTML = '';
      if (!itens.length) {
        card.appendChild(el('p', { class: 'rev-vazio', text: c.mentor ? 'Sem erros com tema no caderno ainda.' : 'Registre seus erros no caderno: a revisão sai deles.' }));
        return;
      }
      // Tudo em dia: mostra as próximas revisões, que o aluno pode adiantar (conta como revisada hoje e recalcula as datas)
      var adiantar = !hoje.length;
      var mostrar = hoje, limite = 3;
      if (adiantar) {
        if (!prox) { card.appendChild(el('p', { class: 'rev-vazio ok' }, [el('span', { class: 'rev-check', text: '✓' }), 'Todos os temas consolidados']));  return; }
        card.appendChild(el('p', { class: 'rev-vazio ok rev-topo' }, [el('span', { class: 'rev-check', text: '✓' }), 'Tudo em dia · próximas revisões']));
        mostrar = itens.filter(function (x) { return x.situacao === 'agendado'; }).sort(function (a, b) { return diaN(a.proxima) - diaN(b.proxima) || b.nErros - a.nErros; });
        limite = 1;
      }
      var lista = el('div', { class: 'rev-linhas' });
      mostrar.forEach(function (x, i) { var l = linha(x, i === 0 && !adiantar, adiantar); if (i >= limite) l.classList.add('oculto'); lista.appendChild(l); });
      card.appendChild(lista);
      if (mostrar.length > limite) {
        var resto = mostrar.length - limite;
        var mais = el('button', { class: 'rev-mais', type: 'button', text: '+ ' + resto + (adiantar ? (resto === 1 ? ' próxima' : ' próximas') : (resto === 1 ? ' tema' : ' temas')) });
        mais.onclick = function () { Array.prototype.forEach.call(lista.querySelectorAll('.oculto'), function (n) { n.classList.remove('oculto'); }); mais.remove(); };
        card.appendChild(mais);
      }

      function linha(x, primeiro, antecipada) {
        var qs = x.questoes.map(function (q) { return 'Q' + q.q; });
        var sub = (antecipada ? dataCurta(x.proxima) + ' · ' : '') + 'Teoria' + (qs.length ? ' + refazer ' + qs.slice(0, 4).join(', ') : '') + ' + questões novas' + (x.atraso > 0 ? ' · atrasada' : '');
        var etapas = el('span', { class: 'rev-etapas', title: 'Revisão ' + Math.min(x.etapa + 1, ETAPAS.length) + ' de ' + ETAPAS.length, 'aria-label': 'Revisão ' + Math.min(x.etapa + 1, ETAPAS.length) + ' de ' + ETAPAS.length });
        ETAPAS.forEach(function (_, k) { etapas.appendChild(el('i', { class: k < x.etapa ? 'feita' : k === x.etapa ? 'atual' : '' })); });
        var box = el('div', { class: 'rev-linha' + (primeiro ? ' primeiro' : '') }, [
          el('div', { class: 'rev-tema' }, [el('b', {}, [x.rotulo, antecipada && !c.mentor ? el('span', { class: 'grifo', text: 'Pode adiantar' }) : null]), el('small', { text: sub })]), etapas]);
        if (!c.mentor) {
          var bts = [['facil', 'Fácil'], ['medio', 'Médio'], ['dificil', 'Difícil']].map(function (o) {
            var b = el('button', { class: 'nivel ' + o[0], type: 'button', title: 'Achei ' + o[1].toLowerCase(), text: o[1] });
            b.onclick = function () { marcar(o[0]); };
            return b;
          });
          var travar = function (v) { bts.forEach(function (b) { b.disabled = v; }); };
          var marcar = function (res) {
            travar(true);
            c.api('registrarRevisao', { id: c.id, materia: x.materia, tema: x.tema, resultado: res }).then(function (y) {
              if (!y || !y.ok) { travar(false); c.aviso(msgErro(y), true); return; }
              r.revisoes.push({ materia: x.materia, tema: x.tema, resultado: res, data: y.data || r.hoje });
              var d = agenda(r.erros, r.revisoes, r.hoje).filter(function (z) { return z.chave === x.chave; })[0];
              c.aviso(d && d.situacao === 'consolidado' ? x.rotulo + ': tema consolidado!' : (antecipada ? 'Revisão adiantada. ' : '') + 'Próxima revisão em ' + d.intervalo + ' dias (' + dataCurta(d.proxima) + ').');
              desenhar(r);
            }).catch(function () { travar(false); c.aviso('Sem conexão. Tente de novo.', true); });
          };
          box.appendChild(el('div', { class: 'rev-btns', role: 'group', 'aria-label': 'Como foi a revisão?' }, bts));
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


  // ===================== Metas do mês =====================
  // O mentor cria, edita e apaga as metas do mês; o aluno só marca o que fez (e pode desmarcar). O servidor confere tudo.
  var NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  function nomeMes(m) { var p = String(m).split('-'); return NOMES_MESES[Number(p[1]) - 1] + ' de ' + p[0]; }
  function somaMes(m, n) { var p = m.split('-'), d = new Date(Number(p[0]), Number(p[1]) - 1 + n, 15); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function fimDoMes(m) { var p = m.split('-'), d = new Date(Number(p[0]), Number(p[1]), 0); return m + '-' + ('0' + d.getDate()).slice(-2); }
  function dataCurta(iso) { var p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; }
  var mesMetas = null;

  function caixaCheck(marcado, rotulo, aoMudar, desligado) {
    var b = el('button', { class: 'check-corr', type: 'button', role: 'checkbox', 'aria-checked': String(!!marcado), 'aria-label': rotulo });
    if (desligado) b.disabled = true; else b.onclick = aoMudar;
    return b;
  }

  // Lista de metas de um mês. resumo = versão curta do painel (só o mês atual, sem navegação nem edição)
  function metas(raiz, c, resumo) {
    if (!resumo) carregando(raiz, 'Carregando metas…');
    c.api('metas', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { if (resumo) raiz.innerHTML = ''; else falha(raiz, r); return; }
      if (!resumo && !mesMetas) mesMetas = r.mesAtual;
      desenhar(r, resumo ? r.mesAtual : mesMetas);
    }).catch(function (e) { if (e.message !== 'sessao') { if (resumo) raiz.innerHTML = ''; else falha(raiz, null); } });

    function desenhar(r, mes) {
      raiz.innerHTML = '';
      var lista = r.metas.filter(function (m) { return m.mes === mes; }).sort(function (a, b) { return a.prazo < b.prazo ? -1 : a.prazo > b.prazo ? 1 : 0; });
      var feitas = lista.filter(function (m) { return m.feita; }).length;
      var card = el('div', { class: 'card metas-card' });
      var nav = null;
      if (!resumo) {
        var ant = el('button', { class: 'mini', type: 'button', 'aria-label': 'Mês anterior', text: '‹' }), prox = el('button', { class: 'mini', type: 'button', 'aria-label': 'Próximo mês', text: '›' });
        ant.onclick = function () { mesMetas = somaMes(mes, -1); desenhar(r, mesMetas); };
        prox.onclick = function () { mesMetas = somaMes(mes, 1); desenhar(r, mesMetas); };
        nav = el('div', { class: 'mes-nav' }, [ant, el('b', { text: nomeMes(mes) }), prox]);
      }
      card.appendChild(el('div', { class: 'card-cab' }, [el('h3', { text: resumo ? 'Metas de ' + NOMES_MESES[Number(mes.slice(5)) - 1] : (c.mentor ? 'Metas do mês' : 'Minhas metas') }),
        resumo ? el('span', { class: 'card-num', text: lista.length ? feitas + ' de ' + lista.length : '' }) : nav]));
      if (!resumo && lista.length) card.appendChild(el('div', { class: 'barra-fina' }, [el('i', { style: 'width:' + Math.round(100 * feitas / lista.length) + '%' })]));
      if (!lista.length) card.appendChild(el('p', { class: 'nota', style: 'margin:4px 0 0', text: r.podeEditar ? 'Nenhuma meta neste mês.' + (resumo ? ' Crie na aba Metas.' : '') : 'Seu mentor ainda não definiu as metas deste mês.' }));
      lista.forEach(function (m) { card.appendChild(linhaMeta(r, m, mes)); });
      if (!resumo && r.podeEditar) card.appendChild(formNova(r, mes));
      if (resumo && !c.mentor && lista.length) card.appendChild(el('p', { class: 'nota', style: 'margin:8px 0 0', text: 'Marque quando cumprir. Quem define as metas é o seu mentor.' }));
      raiz.appendChild(card);
    }

    function linhaMeta(r, m, mes) {
      var atrasada = !m.feita && m.prazo && m.prazo < r.hoje;
      var prazo = el('span', { class: 'meta-prazo' + (atrasada ? ' atrasada' : ''), text: atrasada ? 'atrasada' : m.prazo ? 'até ' + dataCurta(m.prazo) : '' });
      var sub = m.feita ? (c.mentor ? 'feita em ' + m.feita : 'confirmada em ' + m.feita) : (c.mentor ? 'aguardando o aluno' : '');
      var chk = caixaCheck(m.feita, 'Meta cumprida: ' + m.texto, function () {
        var marcar = !m.feita; chk.disabled = true;
        c.api('marcarMeta', { id: c.id, idMeta: m.id, feita: marcar }).then(function (x) {
          if (x && x.ok) { m.feita = x.meta.feita; desenhar(r, resumo ? r.mesAtual : mes); } else { chk.disabled = false; c.aviso(msgErro(x)); }
        }).catch(function () { chk.disabled = false; c.aviso('Sem conexão. Tente de novo.'); });
      }, !r.podeMarcar);
      var linha = el('div', { class: 'meta' + (m.feita ? ' feita' : '') }, [chk, el('div', { class: 'meta-txt' }, [el('b', { text: m.texto }), sub ? el('small', { text: sub }) : null]), prazo]);
      if (!resumo && r.podeEditar) {
        var editar = el('button', { class: 'mini', type: 'button', text: 'Editar' }), apagar = el('button', { class: 'mini', type: 'button', text: 'Apagar' });
        var acoes = el('div', { class: 'meta-acoes' }, [editar, apagar]);
        linha.appendChild(acoes);
        editar.onclick = function () { linha.replaceWith(formMeta(r, mes, m)); };
        apagar.onclick = function () {
          confirmarInline(acoes, 'Apagar?', 'Apagar', function () {
            c.api('apagarMeta', { id: c.id, idMeta: m.id }).then(function (x) {
              if (x && x.ok) { r.metas = r.metas.filter(function (y) { return y.id !== m.id; }); desenhar(r, mes); c.aviso('Meta apagada.'); } else c.aviso(msgErro(x));
            }).catch(function () { c.aviso('Sem conexão. Tente de novo.'); });
          });
        };
      }
      return linha;
    }

    function formMeta(r, mes, m) {
      var t = el('input', { type: 'text', maxlength: String(r.maxTexto || 200), placeholder: 'Nova meta (ex.: 40 questões de Física)', 'aria-label': 'Meta' });
      var d = el('input', { type: 'date', 'aria-label': 'Prazo' });
      t.value = m ? m.texto : ''; d.value = m ? m.prazo : fimDoMes(mes);
      var ok = el('button', { class: 'botao peq', type: 'button', text: m ? 'Salvar' : 'Adicionar' });
      var cancelar = m ? el('button', { class: 'mini', type: 'button', text: 'Cancelar' }) : null;
      var erro = el('span', { class: 'erro', style: 'margin:0;font-size:12.5px' });
      var f = el('div', { class: 'meta-form' }, [t, d, ok, cancelar, erro]);
      if (cancelar) cancelar.onclick = function () { desenhar(r, mes); };
      t.onkeydown = function (ev) { if (ev.key === 'Enter') ok.click(); };
      ok.onclick = function () {
        erro.textContent = '';
        if (!t.value.trim()) { erro.textContent = 'Escreva a meta.'; t.focus(); return; }
        ok.disabled = true;
        c.api('salvarMeta', { id: c.id, idMeta: m ? m.id : '', mes: mes, texto: t.value, prazo: d.value }).then(function (x) {
          ok.disabled = false;
          if (!x || !x.ok) { erro.textContent = msgErro(x); return; }
          if (m) Object.assign(m, x.meta); else r.metas.push(x.meta);
          desenhar(r, mes);
        }).catch(function () { ok.disabled = false; erro.textContent = 'Sem conexão. Tente de novo.'; });
      };
      return f;
    }

    function formNova(r, mes) {
      var w = el('div', {}, [formMeta(r, mes, null)]);
      var anteriorPend = r.metas.some(function (m) { return m.mes === somaMes(mes, -1) && !m.feita; });
      if (anteriorPend) {
        var trazer = el('button', { class: 'mini', type: 'button', text: 'Trazer as pendentes de ' + NOMES_MESES[Number(somaMes(mes, -1).slice(5)) - 1] });
        trazer.onclick = function () {
          trazer.disabled = true;
          c.api('trazerPendentes', { id: c.id, mes: mes }).then(function (x) {
            if (x && x.ok) { r.metas = r.metas.concat(x.metas); desenhar(r, mes); c.aviso(x.trazidas ? x.trazidas + (x.trazidas === 1 ? ' meta trazida.' : ' metas trazidas.') : 'Nenhuma meta pendente para trazer.'); }
            else { trazer.disabled = false; c.aviso(msgErro(x)); }
          }).catch(function () { trazer.disabled = false; });
        };
        w.appendChild(el('div', { style: 'margin-top:8px' }, [trazer]));
      }
      return w;
    }
  }

  // ===================== Cronograma de tópicos =====================
  // Lista única (aba "Cronograma" da planilha do app); o aluno marca os tópicos que já estudou. Os temas aparecem como referência.
  var cronoMateria = null, cronoAbertos = {};
  function estruturaCrono(itens) {
    var mats = [], porMat = {};
    itens.forEach(function (r) {
      var m = porMat[r[1]];
      if (!m) { m = porMat[r[1]] = { nome: r[1], conteudos: [], porC: {} }; mats.push(m); }
      var ct = m.porC[r[2]];
      if (!ct) { ct = m.porC[r[2]] = { nome: r[2], id: null, topicos: [] }; m.conteudos.push(ct); }
      if (r[3]) ct.topicos.push({ id: r[0], nome: r[3], inclui: r[4] }); else ct.id = r[0];
    });
    mats.forEach(function (m) { m.conteudos.forEach(function (ct) { ct.ids = ct.topicos.length ? ct.topicos.map(function (t) { return t.id; }) : (ct.id ? [ct.id] : []); }); m.ids = [].concat.apply([], m.conteudos.map(function (ct) { return ct.ids; })); });
    return mats;
  }
  function pctDe(ids, marc) { return ids.length ? Math.round(100 * ids.filter(function (i) { return marc[i]; }).length / ids.length) : 0; }

  function cronograma(raiz, c, resumo) {
    if (!resumo) carregando(raiz, 'Carregando cronograma…');
    c.api('cronograma', { id: c.id }).then(function (r) {
      if (!r || !r.ok) { if (resumo) raiz.innerHTML = ''; else falha(raiz, r); return; }
      var mats = estruturaCrono(r.itens), marc = {};
      r.marcados.forEach(function (i) { marc[i] = true; });
      if (!cronoMateria || !mats.some(function (m) { return m.nome === cronoMateria; })) cronoMateria = mats.length ? mats[0].nome : null;
      if (resumo) desenharResumo(mats, marc); else desenhar(r, mats, marc);
    }).catch(function (e) { if (e.message !== 'sessao') { if (resumo) raiz.innerHTML = ''; else falha(raiz, null); } });

    function desenharResumo(mats, marc) {
      var todos = [].concat.apply([], mats.map(function (m) { return m.ids; })), n = todos.filter(function (i) { return marc[i]; }).length;
      raiz.innerHTML = '';
      var link = el('button', { class: 'link-btn', type: 'button', text: 'abrir o cronograma ›' });
      link.onclick = function () { if (c.irPara) c.irPara('cronograma'); };
      raiz.appendChild(el('div', { class: 'card' }, [el('div', { class: 'card-cab' }, [el('h3', { text: 'Cronograma' }), el('span', { class: 'card-num', text: pctDe(todos, marc) + '% concluído' })]),
        el('div', { class: 'barra-fina' }, [el('i', { style: 'width:' + pctDe(todos, marc) + '%' })]),
        el('p', { class: 'nota', style: 'margin:8px 0 0' }, [n + ' de ' + todos.length + ' tópicos · ', link])]));
    }

    function desenhar(r, mats, marc) {
      raiz.innerHTML = '';
      var todos = [].concat.apply([], mats.map(function (m) { return m.ids; }));
      raiz.appendChild(el('div', { class: 'reg-topo' }, [el('div', {}, [el('h2', { class: 'reg-titulo', text: c.mentor ? 'Cronograma do aluno' : 'Cronograma' }),
        el('p', { class: 'nota', style: 'margin:2px 0 0', text: c.mentor ? 'O aluno marca o que já estudou. Você também pode marcar ou corrigir.' : 'Marque os tópicos que você já estudou. A porcentagem sobe sozinha.' })])]));
      var chips = el('div', { class: 'crono-chips' }, [el('span', { class: 'nota', style: 'margin:0;align-self:center', text: 'Geral ' + pctDe(todos, marc) + '% ·' })]);
      mats.forEach(function (m) {
        var b = el('button', { class: 'crono-chip', type: 'button', 'aria-pressed': String(m.nome === cronoMateria), text: m.nome + ' ' + pctDe(m.ids, marc) + '%' });
        b.onclick = function () { cronoMateria = m.nome; desenhar(r, mats, marc); };
        chips.appendChild(b);
      });
      raiz.appendChild(chips);
      var m = mats.filter(function (x) { return x.nome === cronoMateria; })[0];
      if (!m) return;
      var feitos = m.ids.filter(function (i) { return marc[i]; }).length;
      raiz.appendChild(el('div', { class: 'card crono-geral' }, [el('div', {}, [el('b', { text: m.nome }), el('div', { class: 'barra-fina', style: 'margin:8px 0 6px' }, [el('i', { style: 'width:' + pctDe(m.ids, marc) + '%' })]),
        el('span', { class: 'nota', style: 'margin:0', text: feitos + ' de ' + m.ids.length + ' tópicos estudados' })]), el('b', { class: 'crono-pct', text: pctDe(m.ids, marc) + '%' })]));
      m.conteudos.forEach(function (ct) {
        var chave = m.nome + '|' + ct.nome, p = pctDe(ct.ids, marc), n = ct.ids.filter(function (i) { return marc[i]; }).length;
        var area = el('div', { class: 'crono-area' });
        var barra = el('div', { class: 'barra-fina' }, [el('i', { style: 'width:' + p + '%' })]);
        if (!ct.topicos.length) {
          area.appendChild(el('div', { class: 'crono-lin' }, [caixa(ct.ids), el('span', { class: n ? 'ok' : '', text: ct.nome }), barra, el('span', { class: 'crono-pc', text: p + '%' })]));
        } else {
          var aberto = !!cronoAbertos[chave];
          var cab = el('button', { class: 'crono-lin cab', type: 'button', 'aria-expanded': String(aberto) }, [el('span', { class: 'chev' + (aberto ? ' on' : '') }),
            el('span', { class: n === ct.ids.length ? 'ok' : '' }, [ct.nome, el('span', { class: 'nota', style: 'margin:0', text: ' · ' + n + ' de ' + ct.ids.length })]), barra, el('span', { class: 'crono-pc', text: p + '%' })]);
          cab.onclick = function () { cronoAbertos[chave] = !aberto; desenhar(r, mats, marc); };
          area.appendChild(cab);
          if (aberto) {
            var corpo = el('div', { class: 'crono-tops' });
            if (r.podeMarcar) {
              var todosF = n === ct.ids.length, bt = el('button', { class: 'mini', type: 'button', text: todosF ? 'Desmarcar todos' : 'Marcar todos deste conteúdo' });
              bt.onclick = function () { marcar(ct.ids, !todosF, bt); };
              corpo.appendChild(el('div', { class: 'crono-todos' }, [bt]));
            }
            ct.topicos.forEach(function (t) {
              corpo.appendChild(el('label', { class: 'crono-top' }, [caixa([t.id]), el('span', {}, [el('b', { class: marc[t.id] ? 'ok' : '', text: t.nome }), t.inclui ? el('small', { text: 'inclui: ' + t.inclui.split(/;\s*/).join(' · ') }) : null])]));
            });
            area.appendChild(corpo);
          }
        }
        raiz.appendChild(area);
      });

      function caixa(ids) {
        var on = ids.every(function (i) { return marc[i]; });
        var b = caixaCheck(on, 'Estudado', function (ev) { if (ev) ev.preventDefault(); marcar(ids, !on, b); }, !r.podeMarcar);
        return b;
      }
      function marcar(ids, valor, botao) {
        if (botao) botao.disabled = true;
        ids.forEach(function (i) { if (valor) marc[i] = true; else delete marc[i]; }); // otimista: desenha já
        desenhar(r, mats, marc);
        c.api('marcarCronograma', { id: c.id, ids: ids, marcar: valor }).then(function (x) {
          if (x && x.ok) return;
          ids.forEach(function (i) { if (valor) delete marc[i]; else marc[i] = true; });
          desenhar(r, mats, marc); c.aviso(msgErro(x));
        }).catch(function () { ids.forEach(function (i) { if (valor) delete marc[i]; else marc[i] = true; }); desenhar(r, mats, marc); c.aviso('Sem conexão: a marcação não foi salva.'); });
      }
    }
  }

  // ===================== Painel: rotina de hoje + metas + cronograma (ao lado das faixas) =====================
  function cartaoHojeRot(r, hj, c) {
    var itens = [];
    r.celulas.forEach(function (l, i) {
      var x = l[hj], h = r.inicio + i;
      if (!x) return;
      var ult = itens[itens.length - 1];
      if (ult && ult.fimH === h && ult.c.t === x.t && (!x.d || x.d === ult.c.d) && !ult.c.f) { ult.fimH = h + 1; if (x.f) ult.c = { t: ult.c.t, d: ult.c.d, f: x.f }; return; }
      itens.push({ ini: h, fimH: h + 1, c: x });
    });
    var link = el('button', { class: 'link-btn', type: 'button', text: 'Ver a semana inteira ›' });
    link.onclick = function () { if (c.irPara) c.irPara('rotina'); };
    var card = el('div', { class: 'card hoje-card' }, [el('div', { class: 'card-cab' }, [el('h3', { text: 'Hoje · ' + NOMES_DIAS[hj] }), link])]);
    if (!itens.length) card.appendChild(el('p', { class: 'nota', style: 'margin:0', text: 'Dia livre na rotina.' }));
    else {
      var lista = el('div', { class: 'hoje-lista' });
      itens.forEach(function (it) { lista.appendChild(el('div', { class: 'hoje-item' }, [el('span', { class: 'hoje-hora', text: hh(it.ini) + '–' + (it.c.f || hh(it.fimH)) }), bloco(it.c)])); });
      card.appendChild(lista);
    }
    return card;
  }
  function painelExtra(raiz, c) {
    raiz.innerHTML = '';
    var f = c.fases || {};
    var esq = el('div', { class: 'stack' }), dir = el('div', { class: 'stack' });
    raiz.appendChild(el('div', { class: 'painel-lado' }, [esq, dir]));
    if (f.rotina) {
      var rot = el('div', {});
      esq.appendChild(rot);
      c.api('rotina', { id: c.id }).then(function (r) {
        if (r && r.ok && r.formato === 'horas' && r.celulas.some(function (l) { return l.some(Boolean); })) rot.appendChild(cartaoHojeRot(r, diaDeHoje(), c));
        else if (r && r.ok) rot.appendChild(el('div', { class: 'card' }, [el('div', { class: 'card-cab' }, [el('h3', { text: 'Rotina' })]), el('p', { class: 'nota', style: 'margin:0', text: c.mentor ? 'A rotina por hora deste aluno ainda não foi montada.' : 'Seu mentor ainda não montou a sua rotina por hora.' })]));
      }).catch(function () { });
    }
    if (f.metas) { var mt = el('div', {}); dir.appendChild(mt); metas(mt, c, true); }
    if (f.cronograma) { var cr = el('div', {}); dir.appendChild(cr); cronograma(cr, c, true); }
    if (!f.rotina) { esq.remove(); }
  }

  return { simulados: simulados, caderno: caderno, rotina: rotina, podeSair: podeSair, revisao: revisao, pdfsGestao: pdfsGestao, agenda: agenda, ETAPAS: ETAPAS,
    metas: metas, cronograma: cronograma, painelExtra: painelExtra, estruturaCrono: estruturaCrono };
})();

// Testa as caixas do aluno (Meu painel · Simulados · Caderno de erros · Rotina), a revisão espaçada, os simulados em PDF
// e as abas do mentor, com um servidor simulado que guarda estado.
// Rodar: node testes/teste_registros.js
const {chromium}=require('playwright');
const SITE='file://'+require('path').resolve(__dirname,'..','index.html');
function novoServidor(){
  const st={lanc:[{id:'',origem:'formulario',prova:'SAS 1 2024',chave:'sas12024',dia:1,data:'01/10/2026',dataIso:'2026-10-01',L:30,H:28,N:null,M:null,C:[160,160,140,160,120],quando:1}],
    erros:[{linha:3,simulado:'SAS 1 2024',materia:'Química',parte:'Estequiometria',motivo:'Erro de cálculo',questao:'',data:'2026-10-20'}],seq:1,log:[],revs:[],baixados:[],
    pdfs:[{id:'P1',titulo:'Simulado Cálculo Aprovação 1',descricao:'Dia 1 e Dia 2',tamanho:2400000,liberarEm:'2026-10-30',liberado:true,downloads:0},
      {id:'P2',titulo:'Simulado Cálculo Aprovação 2',descricao:'',tamanho:900000,liberarEm:'2099-01-01',liberado:false,downloads:0}],
    rot:{linhas:[['8h - 10h','8h - 10h\nSimulado dia 1','8h - 10h\nSimulado dia 1','8h - 10h\nSimulado dia 1','8h - 10h\nSimulado dia 1','8h - 12h','8h - 12h'],
      ['Treina 16h','Treina 16h','Treina 16h','Treina 16h','Treina 16h','Seja feliz','Seja feliz']],
      cores:[['','','','','','#00ff00','#4a86e8'],['#ff0000','#ff0000','#ff0000','#ff0000','#ff0000','#00ff00','#4a86e8']],versao:'v1'}};
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'');
  const dados=()=>({aluno:'Aluna Exemplo',primeiro:'Aluna',curso:'Medicina',desde:'out de 2026',mentor:'Mentor Exemplo',simulados:[{prova:'SAS 1 2024',data:'01/10/2026',ordem:1,L:30,H:28,N:null,M:null,R:740}],erros:st.erros});
  return {st, resp(req,papel){
    st.log.push(req.acao);
    switch(req.acao){
      case 'config': return {ok:true,aceitaCodigo:true,google:false};
      case 'entrar': return {ok:true,sessao:'S',quem:{nome:papel==='mentor'?'Mentor Exemplo':'Aluna Exemplo',via:'codigo',aluno:papel==='aluno',mentor:papel==='mentor'}};
      case 'inicio': return papel==='aluno'?{ok:true,papel:'aluno',quem:{nome:'Aluna Exemplo',via:'codigo',aluno:true},fases:{lancamentos:true,caderno:true,diagnostico:true,rotina:true,revisao:true,pdfs:true},atualizado:'31/10/2026',dados:dados()}
        :{ok:true,papel:'mentor',quem:{nome:'Mentor Exemplo',via:'codigo',mentor:true},fases:{lancamentos:true,caderno:true,diagnostico:true,rotina:true,revisao:true,pdfs:true},atualizado:'31/10/2026',alunos:[{id:'A1',aluno:'Aluna Exemplo',mentor:'Mentor Exemplo',nSims:1}],mentores:[],meuMentor:'Mentor Exemplo'};
      case 'aluno': return {ok:true,aluno:Object.assign({id:'A1',codigo:'AB12-CD34',diagnostico:{'Prontidão (0–100)':'60'}},dados())};
      case 'simulados': return {ok:true,catalogo:[{nome:'SAS 1 2024',chave:'sas12024',alunos:3,ultimo:1},{nome:'Bernoulli 2 2025',chave:'bernoulli22025',alunos:2,ultimo:0}],lancamentos:st.lanc.slice().sort((a,b)=>b.quando-a.quando)};
      case 'salvarSimulado':{
        if(papel==='mentor'&&req.id!=='A1') return {ok:false,erro:'proibido'};
        const k=norm(req.prova);const dup=st.lanc.find(l=>l.origem==='app'&&l.chave===k&&l.dia===req.dia&&l.id!==req.idLanc);
        if(dup) return {ok:false,erro:'duplicado',idLanc:dup.id,msg:'Você já lançou o Dia '+req.dia+' desta prova. Edite o lançamento existente.'};
        const l={id:req.idLanc||('L'+(++st.seq)),origem:'app',prova:req.prova,chave:k,dia:req.dia,data:req.data.split('-').reverse().join('/'),dataIso:req.data,L:req.L??null,H:req.H??null,N:req.N??null,M:req.M??null,C:(req.C||[]).map(x=>x===''?null:x),quando:++st.seq};
        st.lanc=st.lanc.filter(x=>x.id!==req.idLanc||!req.idLanc);st.lanc.push(l);return {ok:true,idLanc:l.id};}
      case 'excluirSimulado': st.lanc=st.lanc.filter(l=>l.id!==req.idLanc); return {ok:true};
      case 'caderno': return {ok:true,esperados:{sas12024:{L:15,H:17,N:null,M:null},bernoulli22025:{L:10,H:12,N:18,M:20}},erros:st.erros,simulados:['Bernoulli 2 2025','SAS 1 2024'],materias:['Física','Química','Biologia','Matemática','História','Geografia','Linguagens','Sociologia','Filosofia'],motivos:['Não sabia o conteúdo','Interpretação do enunciado','Falta de atenção','Erro de cálculo']};
      case 'salvarErros': req.erros.forEach(e=>st.erros.push(Object.assign({linha:3+st.erros.length,data:'2026-11-01'},e))); return {ok:true,n:req.erros.length};
      case 'marcarCorrigido': { if(papel!=='aluno') return {ok:false,erro:'soAluno'}; const e=st.erros.find(y=>y.linha===req.linha); if(!e||e.simulado!==req.antes.simulado) return {ok:false,erro:'mudou'}; e.corrigido=req.corrigido?'04/11/2026':''; return {ok:true,corrigido:e.corrigido}; }
      case 'revisoes': return {ok:true,hoje:'2026-11-02',revisoes:st.revs,erros:st.erros.map(e=>({simulado:e.simulado,materia:e.materia,tema:e.parte,questao:e.questao,data:e.data||'2026-10-20'}))};
      case 'registrarRevisao': st.revs.push({materia:req.materia,tema:req.tema,resultado:req.resultado,data:'2026-11-02'}); return {ok:true,data:'2026-11-02'};
      case 'pdfs': return {ok:true,hoje:'2026-11-02',podeGerenciar:papel==='gestor',maxBytes:15*1048576,pdfs:st.pdfs.filter(p=>papel==='gestor'||p.liberado)};
      case 'baixarPdf': st.baixados.push(req.idPdf); return {ok:true,nome:'simulado.pdf',base64:Buffer.from('%PDF-1.4 teste').toString('base64')};
      case 'enviarPdf': if(papel!=='gestor') return {ok:false,erro:'proibido'}; st.pdfs.unshift({id:'PN'+(++st.seq),titulo:req.titulo,descricao:req.descricao,tamanho:Buffer.from(req.base64,'base64').length,liberarEm:req.liberarEm,liberado:true,downloads:0}); st.enviado=Buffer.from(req.base64,'base64').toString(); return {ok:true};
      case 'editarPdf': { const p=st.pdfs.find(y=>y.id===req.idPdf); Object.assign(p,{titulo:req.titulo,descricao:req.descricao,liberarEm:req.liberarEm}); return {ok:true}; }
      case 'removerPdf': st.pdfs=st.pdfs.filter(y=>y.id!==req.idPdf); return {ok:true};
      case 'editarErro': { const e=st.erros.find(x=>x.linha===req.linha); if(e.parte!==req.antes.parte) return {ok:false,erro:'mudou',msg:'mudou'}; Object.assign(e,req.depois); return {ok:true}; }
      case 'excluirErro': st.erros=st.erros.filter(x=>x.linha!==req.linha); return {ok:true};
      case 'atualizar': return {ok:true,dados:dados(),atualizado:'31/10/2026 01:30'};
      case 'rotina': return {ok:true,dias:['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'],linhas:st.rot.linhas,cores:st.rot.cores,antiga:false,versao:st.rot.versao,podeEditar:papel==='mentor'&&!st.soVer,maxLinhas:30,padrao:8,maxTexto:300};
      case 'salvarRotina':{
        if(papel!=='mentor') return {ok:false,erro:'proibido'};
        if(req.versao!==st.rot.versao) return {ok:false,erro:'mudou',msg:'A rotina foi alterada (na planilha ou por outra pessoa) enquanto você editava. Recarregue para ver a versão atual.'};
        st.rot={linhas:req.linhas,cores:req.cores,versao:'v'+(++st.seq)};return {ok:true,mudou:1,linhas:st.rot.linhas,cores:st.rot.cores,versao:st.rot.versao};}
    } return {ok:true};
  }};
}
(async()=>{const b=await chromium.launch();let falhas=0;const ok=(c,m)=>{console.log((c?'OK   ':'FALHA')+' '+m);if(!c)falhas++;};
 // ---------- Aluno ----------
 {const srv=novoServidor();const p=await b.newPage({viewport:{width:1100,height:1000}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/accounts.google.com/**',r=>r.abort());
  await p.route('**/script.google.com/**',async r=>{const q=JSON.parse(r.request().postData());await new Promise(x=>setTimeout(x,30));r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(srv.resp(q,'aluno'))});});
  await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
  await p.goto(SITE);await p.waitForTimeout(300);
  await p.fill('input[aria-label="Código de acesso"]','ABCD-EFGH');await p.click('text=Entrar com o código');await p.waitForTimeout(600);
  ok((await p.$$('.caixa')).length===4,'aluno vê as 4 caixas');
  ok((await p.textContent('.grade4')).includes('Química – Estequiometria'),'cartão de erros mostra Matéria – Tema');
  ok((await p.$$eval('.sec',x=>x.map(y=>y.textContent))).includes('Temas com mais erros')&&!(await p.content()).includes('Por que você erra'),'"Por que você erra" virou "Temas com mais erros"');
  ok((await p.textContent('.caixa[aria-pressed="true"]')).includes('Meu painel'),'começa em Meu painel');
  ok((await p.textContent('.rev-linha.primeiro')).includes('Química – Estequiometria')&&(await p.$$('.rev-etapas i')).length===6,'revisão de hoje no painel, com o tema vencido e as 6 etapas');
  // ---------- regras da agenda (7 dias × 1,4 até 30) ----------
  const ag=await p.evaluate(()=>{const A=window.Registros.agenda,E=[{materia:'Física',tema:'Óptica',data:'2026-10-01',questao:'101',simulado:'S'}];
    const seq=[],revs=[];let hoje='2026-10-08';
    for(let i=0;i<7;i++){const a=A(E,revs,hoje)[0];seq.push(a.situacao+':'+a.intervalo+':'+(a.proxima||'-'));if(a.situacao==='consolidado')break;revs.push({materia:'Física',tema:'Óptica',resultado:'medio',data:a.proxima});hoje=a.proxima;}
    const dif=A(E,[{materia:'Física',tema:'óptica',resultado:'dificil',data:'2026-10-08'}],'2026-10-09')[0];
    const fac=A(E,[{materia:'Física',tema:'Óptica',resultado:'facil',data:'2026-10-08'},{materia:'Física',tema:'Óptica',resultado:'facil',data:'2026-10-19'}],'2026-10-20')[0];
    const difLongo=A(E,[{materia:'Física',tema:'Óptica',resultado:'medio',data:'2026-10-08'},{materia:'Física',tema:'Óptica',resultado:'medio',data:'2026-10-18'},{materia:'Física',tema:'Óptica',resultado:'dificil',data:'2026-11-01'}],'2026-11-02')[0];
    const novoErro=A(E.concat([{materia:'Física',tema:'Optica',data:'2026-10-12',questao:'',simulado:'T'}]),[{materia:'Física',tema:'Óptica',resultado:'medio',data:'2026-10-08'}],'2026-10-13')[0];
    return {seq,etapas:window.Registros.ETAPAS,dif:dif.proxima,fac:[fac.intervalo,fac.proxima],difLongo:[difLongo.intervalo,difLongo.proxima],novo:[novoErro.proxima,novoErro.nErros]};});
  ok(JSON.stringify(ag.etapas)==='[7,10,14,19,27,30]','médio: intervalos 7 → 10 → 14 → 19 → 27 → 30');
  ok(ag.seq.map(s=>s.split(':').slice(1).join(':')).join(' ')==='7:2026-10-08 10:2026-10-18 14:2026-11-01 19:2026-11-20 27:2026-12-17 30:2027-01-16 30:-'&&ag.seq[6].indexOf('consolidado')===0,'cada revisão boa multiplica por 1,4; teto de 30; depois consolida '+ag.seq.join(' | '));
  ok(ag.dif==='2026-10-15','difícil no 1º intervalo fica em 7 dias (mínimo)');
  ok(ag.fac[0]===18&&ag.fac[1]==='2026-11-06','fácil multiplica por 1,6 (7 → 11 → 18) '+ag.fac);
  ok(ag.difLongo[0]===7&&ag.difLongo[1]==='2026-11-08','difícil corta o intervalo pela metade (14 → 7) '+ag.difLongo);
  ok(ag.novo[0]==='2026-10-19'&&ag.novo[1]===2,'erro novo no tema (grafia diferente) recomeça em 7 dias');
  ok((await p.$$('.rev-linha .nivel')).length===3&&await p.$eval('.nivel.facil',e=>getComputedStyle(e).backgroundColor)==='rgb(221, 243, 230)','três botões (fácil verde, médio amarelo, difícil vermelho) em tons pastel');
  await p.screenshot({path:__dirname+'/aluno_revisao.png',clip:{x:0,y:250,width:1100,height:260}});
  await p.click('.rev-linha button.nivel.medio');await p.waitForTimeout(300);
  ok(srv.st.revs.length===1&&srv.st.revs[0].resultado==='medio','marca a revisão no servidor');
  ok((await p.textContent('.toast')).includes('Próxima revisão em 10 dias (qui 12/11)'),'avisa a próxima revisão (10 dias depois)');
  ok((await p.textContent('.rev')).includes('Tudo em dia'),'tema revisado sai da lista de hoje');
  ok((await p.textContent('.rev-linha .grifo'))==='Pode adiantar'&&(await p.textContent('.rev-linha small')).startsWith('qui 12/11'),'mostra a próxima revisão com "Pode adiantar"');
  ok(await p.$eval('.grifo',e=>getComputedStyle(e).color)==='rgb(22, 32, 46)','"Pode adiantar" em preto com grifo azul');
  await p.click('.rev-linha button.nivel.facil');await p.waitForTimeout(300);
  ok(srv.st.revs.length===2&&srv.st.revs[1].resultado==='facil','adiantar registra a revisão hoje');
  ok((await p.textContent('.toast')).includes('Revisão adiantada. Próxima revisão em 16 dias'),'recalcula a partir de hoje (10 × 1,6 = 16 dias) '+(await p.textContent('.toast')));
  await p.screenshot({path:__dirname+'/aluno_revisao_ok.png',clip:{x:0,y:250,width:1100,height:200}});
  ok(!!(await p.$('.grade4')),'painel com os cartões dentro da caixa');
  await p.screenshot({path:__dirname+'/aluno_caixas.png'});
  await p.click('.caixa:has-text("Simulados")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Meus simulados','abre Simulados');
  await p.waitForTimeout(200);
  ok((await p.$$('.pdf-card .pdf-item')).length===1,'aluno vê só o PDF já liberado');
  await p.click('.pdf-item button:has-text("Baixar PDF")');await p.waitForTimeout(300);
  ok(srv.st.baixados[0]==='P1','baixa pelo servidor (sem link público)');
  await p.click('.pdf-item button:has-text("Lançar resultado")');await p.waitForTimeout(200);
  ok(await p.inputValue('input[aria-label="Nome da prova"]')==='Simulado Cálculo Aprovação 1','"Lançar resultado" já preenche o nome da prova');
  await p.click('.form-reg button:has-text("Cancelar")');await p.waitForTimeout(100);
  ok((await p.textContent('.atalhos-pend')).includes('SAS 1 2024 — falta o Dia 2'),'sugere completar o Dia 2');
  await p.click('.atalhos-pend .chip');await p.waitForTimeout(200);
  ok(await p.inputValue('input[aria-label="Nome da prova"]')==='SAS 1 2024','atalho preenche a prova');
  ok((await p.getAttribute('.dia-btn:nth-child(2)','aria-checked'))==='true','atalho escolhe o Dia 2');
  await p.click('text=Salvar simulado');await p.waitForTimeout(200);
  ok((await p.textContent('.form-reg .erro')).includes('Ciências da Natureza'),'valida acertos obrigatórios');
  await p.fill('input[name="N"]','46');await p.fill('input[name="M"]','25');await p.click('text=Salvar simulado');await p.waitForTimeout(200);
  ok((await p.textContent('.form-reg .erro')).includes('0 a 45'),'recusa acerto acima de 45');
  await p.fill('input[name="N"]','27');await p.click('text=Salvar simulado');await p.waitForTimeout(800);
  ok(srv.st.lanc.some(l=>l.origem==='app'&&l.dia===2&&l.N===27&&l.M===25),'Dia 2 salvo no servidor');
  ok(!(await p.$('.atalhos-pend')),'prova completa some dos atalhos');
  ok(srv.st.log.includes('atualizar'),'pediu a atualização do painel em segundo plano');
  // novo lançamento com grafia diferente -> reconhece a prova do catálogo
  await p.click('text=+ Lançar simulado');await p.waitForTimeout(200);
  await p.fill('input[aria-label="Nome da prova"]','bernoulli 2-2025');await p.dispatchEvent('input[aria-label="Nome da prova"]','blur');await p.waitForTimeout(100);
  ok(await p.inputValue('input[aria-label="Nome da prova"]')==='Bernoulli 2 2025','grafia diferente vira o nome do catálogo');
  await p.fill('input[name="L"]','33');await p.fill('input[name="H"]','31');
  await p.check('.check input');await p.waitForTimeout(100);
  for(const [i,v] of [[1,160],[2,160],[3,140],[4,160],[5,120]]) await p.fill('input[name="C'+i+'"]',String(v));
  ok((await p.textContent('.total-red')).includes('740'),'soma a nota da redação');
  await p.screenshot({path:__dirname+'/aluno_lancar.png'});
  await p.click('text=Salvar simulado');await p.waitForTimeout(700);
  // duplicado
  await p.click('text=+ Lançar simulado');await p.waitForTimeout(200);
  await p.fill('input[aria-label="Nome da prova"]','Bernoulli 2 2025');await p.fill('input[name="L"]','30');await p.fill('input[name="H"]','30');
  await p.click('text=Salvar simulado');await p.waitForTimeout(400);
  ok((await p.textContent('.form-reg .erro')).includes('já lançou o Dia 1'),'bloqueia o mesmo dia lançado duas vezes');
  await p.click('text=Editar o lançamento existente');await p.waitForTimeout(200);
  ok(await p.inputValue('input[name="L"]')==='33','abre o existente para editar');
  await p.fill('input[name="L"]','35');await p.click('text=Salvar alterações');await p.waitForTimeout(600);
  ok(srv.st.lanc.filter(l=>l.chave==='bernoulli22025'&&l.dia===1).length===1&&srv.st.lanc.find(l=>l.chave==='bernoulli22025').L===35,'edição substitui, sem duplicar');
  await p.screenshot({path:__dirname+'/aluno_simulados.png',fullPage:true});
  // excluir com confirmação na própria tela
  const n0=srv.st.lanc.length;
  await p.click('.sim-card:has-text("Bernoulli") .acoes button:has-text("Excluir")');await p.waitForTimeout(100);
  ok(await p.isVisible('text=Excluir este lançamento?'),'pede confirmação antes de excluir');
  await p.click('.mini.perigo');await p.waitForTimeout(500);
  ok(srv.st.lanc.length===n0-1,'excluiu');
  ok(!(await p.$('.sim-card:has-text("SAS 1 2024") .sim-dia:first-child .acoes')),'lançamento do formulário não tem editar/excluir');
  // ---------- Caderno ----------
  await p.click('.caixa:has-text("Caderno")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Caderno de erros','abre o Caderno de erros');
  ok((await p.textContent('.aviso.faltam')).includes('Faltam 92 erros'),'mostra quantos erros faltam registrar (pelos acertos)');
  ok((await p.textContent('.campo .dica')).includes('Natureza 18'),'mostra o que falta no simulado escolhido');
  ok((await p.textContent('.progresso-areas')).includes('Humanas 0 de 17'),'progresso por área em cada simulado');
  ok((await p.inputValue('select[aria-label="Simulado"]'))==='Bernoulli 2 2025','já sugere o simulado mais recente');
  await p.selectOption('select[aria-label="Matéria"]','Química');
  ok((await p.$$eval('#partes-sugestoes option',o=>o.map(x=>x.value))).includes('Estequiometria'),'sugere temas já usados na matéria');
  await p.click('text=+ Adicionar à lista');await p.waitForTimeout(100);
  ok((await p.textContent('.form-reg .erro')).includes('tema'),'exige o tema');
  await p.fill('input[aria-label="Tema"]','Equilíbrio químico');await p.selectOption('select[aria-label="Motivo do erro"]','Não sabia o conteúdo');
  await p.press('input[aria-label="Número da questão"]','Enter');await p.waitForTimeout(100);
  ok((await p.textContent('.form-reg .erro')).includes('número da questão'),'exige o número da questão');
  await p.fill('input[aria-label="Número da questão"]','12a');await p.press('input[aria-label="Número da questão"]','Enter');await p.waitForTimeout(100);
  ok((await p.textContent('.form-reg .erro')).includes('número da questão'),'recusa número inválido');
  await p.fill('input[aria-label="Número da questão"]','112');await p.press('input[aria-label="Número da questão"]','Enter');await p.waitForTimeout(100);
  await p.selectOption('select[aria-label="Matéria"]','Física');await p.fill('input[aria-label="Tema"]','Cinemática');await p.selectOption('select[aria-label="Motivo do erro"]','Falta de atenção');
  await p.fill('input[aria-label="Número da questão"]','112');await p.click('text=+ Adicionar à lista');await p.waitForTimeout(100);
  ok((await p.textContent('.form-reg .erro')).includes('já está no caderno'),'avisa questão repetida no mesmo simulado');
  ok((await p.textContent('.dica.alerta'))==='','sem alerta quando a questão bate com a área (112 = Natureza)');
  await p.fill('input[aria-label="Número da questão"]','150');
  await p.click('text=+ Adicionar à lista');await p.waitForTimeout(100);
  ok((await p.textContent('.dica.alerta')).includes('é de Matemática'),'avisa quando o número não bate com a área no ENEM (150 = Matemática)');
  await p.click('.item-erro.pend:has-text("150") button');await p.waitForTimeout(50);
  await p.selectOption('select[aria-label="Matéria"]','Física');await p.fill('input[aria-label="Tema"]','Cinemática');await p.selectOption('select[aria-label="Motivo do erro"]','Falta de atenção');
  await p.fill('input[aria-label="Número da questão"]','98');
  await p.click('text=+ Adicionar à lista');await p.waitForTimeout(100);
  ok((await p.$$('.item-erro.pend')).length===2,'dois erros na lista antes de salvar');
  ok((await p.textContent('.form-reg .botao')).includes('Salvar 2 erros'),'botão mostra quantos vão ser salvos');
  await p.screenshot({path:__dirname+'/aluno_caderno.png',fullPage:true});
  await p.click('.form-reg .botao');await p.waitForTimeout(600);
  ok(srv.st.erros.length===3&&srv.st.erros.some(e=>e.parte==='Cinemática'&&e.simulado==='Bernoulli 2 2025'&&e.questao==='98'),'erros salvos com o simulado e o número da questão');
  ok(JSON.stringify(await p.$$eval('.card:has-text("Bernoulli 2 2025") .q-num',x=>x.map(y=>y.textContent)))==='["Q98","Q112"]','erros do simulado em ordem de questão');
  await p.click('.item-erro:has-text("Q98") .check-corr');await p.waitForTimeout(500);
  ok(srv.st.erros.find(e=>e.questao==='98').corrigido==='04/11/2026','aluno marca o erro como corrigido (fica salvo)');
  ok(!(await p.$('.grupo-sim .item-erro:has-text("Q98")'))&&(await p.textContent('.grupo-sim:has-text("Bernoulli 2 2025") .grupo-cab .nota'))==='1 erro para corrigir','erro corrigido sai da lista do aluno');
  ok((await p.textContent('.toast')).includes('continua na sua revisão'),'avisa que continua na revisão');
  ok((await p.textContent('.link-corrigidos'))==='Ver erros já corrigidos (1)','link para ver os corrigidos');
  await p.click('.link-corrigidos');await p.waitForTimeout(200);
  ok(!!(await p.$('.card.corrigidos .item-erro:has-text("Q98") .check-corr[aria-checked="true"]')),'corrigidos aparecem marcados ao abrir');
  await p.click('.card.corrigidos .item-erro:has-text("Q98") .check-corr');await p.waitForTimeout(500);
  ok(srv.st.erros.find(e=>e.questao==='98').corrigido===''&&!!(await p.$('.grupo-sim .item-erro:has-text("Q98")'))&&!(await p.$('.link-corrigidos')),'desmarcar devolve o erro para a lista');

  await p.click('.item-erro:has-text("Cinemática") button:has-text("Editar")');await p.waitForTimeout(100);
  ok(await p.inputValue('.editando input[aria-label="Número da questão"]')==='98','edição traz o número da questão');
  await p.fill('.editando input[aria-label="Tema"]','Dinâmica');await p.click('.editando button:has-text("Salvar")');await p.waitForTimeout(500);
  ok(srv.st.erros.some(e=>e.parte==='Dinâmica'),'editou um erro');
  await p.click('.item-erro:has-text("Dinâmica") button:has-text("Excluir")');await p.click('.mini.perigo');await p.waitForTimeout(500);
  ok(!srv.st.erros.some(e=>e.parte==='Dinâmica'),'excluiu um erro');
  // ---------- Rotina (aluno só vê) ----------
  await p.click('.caixa:has-text("Rotina")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Minha rotina','abre a Rotina');
  ok((await p.$$('table.rotina th')).length===7&&(await p.$$('table.rotina tbody tr')).length===2,'tabela com 7 dias e as linhas do mentor');
  ok(await p.$eval('table.rotina tbody tr:nth-child(2) td:nth-child(1)',x=>getComputedStyle(x).backgroundColor)==='rgb(255, 0, 0)','cores da rotina aparecem');
  ok(!(await p.$('text=Editar rotina')),'aluno não tem botão de editar');
  ok(!!(await p.$('.hoje-card')),'mostra o bloco de hoje');
  await p.screenshot({path:__dirname+'/aluno_rotina.png',fullPage:true});
  await p.setViewportSize({width:390,height:900});await p.waitForTimeout(200);
  await p.screenshot({path:__dirname+'/aluno_rotina_celular.png',fullPage:true});
  await p.click('.caixa:has-text("Meu painel")');await p.waitForTimeout(300);
  await p.screenshot({path:__dirname+'/aluno_celular.png'});
  ok(erros.length===0,'aluno: sem erros de JavaScript '+erros.join(';'));await p.close();}
 // ---------- Mentor ----------
 {const srv=novoServidor();const p=await b.newPage({viewport:{width:1100,height:900}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/accounts.google.com/**',r=>r.abort());
  await p.route('**/script.google.com/**',async r=>{const q=JSON.parse(r.request().postData());r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(srv.resp(q,'mentor'))});});
  await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
  await p.goto(SITE);await p.waitForTimeout(300);
  await p.fill('input[aria-label="Código de acesso"]','ABCD-EFGH');await p.click('text=Entrar com o código');await p.waitForTimeout(700);
  const abas=await p.$$eval('.aba',a=>a.map(x=>x.textContent));
  ok(JSON.stringify(abas)===JSON.stringify(['Painel','Simulados','Caderno de erros','Rotina','Diagnóstico']),'mentor tem Painel, Simulados, Caderno, Rotina e Diagnóstico');
  await p.click('.aba:has-text("Simulados")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Simulados lançados','mentor vê os simulados do aluno');
  await p.click('.aba:has-text("Caderno")');await p.waitForTimeout(400);
  ok((await p.$$('.item-erro')).length>=1,'mentor vê o caderno do aluno');
  ok(srv.st.log.filter(a=>a==='caderno').length===1,'chamou o caderno do aluno');
  srv.st.erros.push({linha:9,simulado:'Bernoulli 2 2025',materia:'Física',parte:'Óptica',motivo:'Chutei',questao:'101',data:'2026-11-01',corrigido:'03/11/2026'});
  await p.click('.aba:has-text("Painel")');await p.waitForTimeout(200);await p.click('.aba:has-text("Caderno de erros")');await p.waitForTimeout(500);
  ok(await p.$eval('.check-corr',e=>e.disabled)===true,'mentor vê a caixinha, mas não marca');
  ok((await p.textContent('.grupo-sim:has-text("Bernoulli 2 2025")')).includes('corrigido em 03/11/2026'),'mentor continua vendo o erro corrigido, com a data');
  const blocos=await p.$$eval('.grupo-sim',l=>l.map(c=>[c.dataset.simulado,c.classList.contains('aberto')]));
  ok(blocos.length>=2&&blocos[0][1]&&!blocos[1][1],'um bloco por simulado; o mais recente aberto '+JSON.stringify(blocos));
  ok(await p.$eval('.grupo-sim.aberto .grupo-cab',e=>getComputedStyle(e).position)==='sticky','nome do simulado fica grudado no topo ao rolar');
  await p.click('.filtro-sim .chip:has-text("SAS 1 2024")');await p.waitForTimeout(100);
  ok(JSON.stringify(await p.$$eval('.grupo-sim',l=>l.filter(c=>c.style.display!=='none').map(c=>[c.dataset.simulado,c.classList.contains('aberto')])))==='[["SAS 1 2024",true]]','filtro por simulado mostra só aquele, aberto');
  await p.click('.filtro-sim .chip:has-text("Todos")');await p.waitForTimeout(100);
  await p.screenshot({path:__dirname+'/mentor_caderno.png',fullPage:true});
  // ---------- Rotina (mentor edita) ----------
  await p.click('.aba:has-text("Rotina")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Rotina do aluno','mentor abre a rotina');
  ok((await p.textContent('.reg-topo .nota')).includes('Só você, como mentor dele'),'mentor cadastrado vê que pode editar');
  await p.click('text=Editar rotina');await p.waitForTimeout(200);
  ok((await p.$$('table.rotina.editando textarea')).length===14,'editor com 2 linhas × 7 dias');
  await p.click('.ferramentas button[aria-label="Acrescentar uma linha no fim"]');await p.waitForTimeout(100);
  ok((await p.textContent('.n-linhas'))==='3','acrescenta linha');
  await p.fill('textarea[aria-label="Segunda, linha 3"]','13h-15:30\nCaderno de erros');
  await p.click('.seg button:has-text("Linha inteira")');
  await p.click('.sw-cor[aria-label="Pintar de amarelo claro"]');await p.waitForTimeout(100);
  ok(await p.$eval('td[data-i="2"][data-j="6"]',x=>getComputedStyle(x).backgroundColor)==='rgb(255, 242, 204)','pinta a linha inteira');
  await p.click('textarea[aria-label="Domingo, linha 1"]');await p.click('.seg button:has-text("Dia inteiro")');await p.click('.sw-cor[aria-label="Pintar de azul-marinho"]');await p.waitForTimeout(100);
  ok(await p.$eval('textarea[aria-label="Domingo, linha 2"]',x=>getComputedStyle(x).color)==='rgb(255, 255, 255)','dia inteiro pintado, com texto branco no fundo escuro');
  // apagar linha com texto pede confirmação no próprio botão
  await p.click('button[aria-label="Apagar a linha 3"]');
  ok((await p.textContent('button.perigo'))==='Apagar?','pede confirmação para apagar linha com texto');
  await p.click('button[aria-label="Descer a linha 1"]');await p.waitForTimeout(100);
  ok((await p.inputValue('textarea[aria-label="Segunda, linha 2"]'))==='8h - 10h','move a linha para baixo');
  ok((await p.textContent('.acoes-form')).includes('Alterações não salvas'),'avisa alterações não salvas');
  await p.screenshot({path:__dirname+'/mentor_rotina_editando.png',fullPage:true});
  // trocar de aba com alterações pendentes pergunta antes
  let perguntou=false;p.once('dialog',d=>{perguntou=true;d.dismiss();});
  await p.click('.aba:has-text("Painel")');await p.waitForTimeout(200);
  ok(perguntou&&!!(await p.$('table.rotina.editando')),'pergunta antes de sair sem salvar e fica no editor');
  await p.click('text=Salvar rotina');await p.waitForTimeout(500);
  ok(srv.st.rot.linhas.length===3&&srv.st.rot.linhas[2][0]==='13h-15:30\nCaderno de erros'&&srv.st.rot.cores[2][3]==='#fff2cc'&&srv.st.rot.cores[0][6]==='#0b2545','salvou texto, linhas e cores');
  ok(!!(await p.$('table.rotina:not(.editando)')),'volta para a visualização');
  // conflito: alguém mudou a planilha no meio
  await p.click('text=Editar rotina');await p.waitForTimeout(200);
  srv.st.rot.versao='mexeram';
  await p.fill('textarea[aria-label="Terça, linha 1"]','x');await p.click('text=Salvar rotina');await p.waitForTimeout(400);
  ok((await p.textContent('.erro')).includes('Recarregue')&&!!(await p.$('text=Recarregar a rotina')),'conflito avisa e oferece recarregar');
  p.once('dialog',d=>d.accept());
  await p.click('.aba:has-text("Painel")');await p.waitForTimeout(300);
  ok(!!(await p.$('.grade4')),'confirmando, sai do editor');
  // gestor (ou mentor de outro aluno): só visualiza
  srv.st.soVer=true;await p.click('.aba:has-text("Rotina")');await p.waitForTimeout(400);
  ok(!(await p.$('text=Editar rotina'))&&(await p.textContent('.reg-topo .nota')).includes('só visualiza'),'quem não é o mentor cadastrado só visualiza');
  ok(erros.length===0,'mentor: sem erros de JavaScript '+erros.join(';'));await p.close();}
 // ---------- Gestor: simulados em PDF ----------
 {const srv=novoServidor();const p=await b.newPage({viewport:{width:1100,height:900}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
  await p.route('**/accounts.google.com/**',r=>r.abort());
  await p.route('**/script.google.com/**',async r=>{const q=JSON.parse(r.request().postData());let res=srv.resp(q,'gestor');
    if(q.acao==='inicio') res={ok:true,papel:'gestor',quem:{nome:'Gestor',via:'codigo',gestor:true},fases:{lancamentos:true,caderno:true,rotina:true,revisao:true,pdfs:true},atualizado:'',alunos:[{id:'A1',aluno:'Aluna Exemplo',mentor:'Mentor Exemplo',nSims:1}],mentores:[]};
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(res)});});
  await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
  await p.goto(SITE);await p.waitForTimeout(300);
  await p.fill('input[aria-label="Código de acesso"]','ABCD-EFGH');await p.click('text=Entrar com o código');await p.waitForTimeout(700);
  await p.click('.secoes button:has-text("Simulados em PDF")');await p.waitForTimeout(400);
  ok((await p.$$('.pdf-item')).length===2&&(await p.textContent('.selo-agendado'))==='agendado','gestor vê os liberados e os agendados');
  const pdf=require('path').join(__dirname,'.teste.pdf');require('fs').writeFileSync(pdf,'%PDF-1.4\n% simulado de teste\n');
  await p.setInputFiles('input[aria-label="Arquivo PDF"]',pdf);
  ok(await p.inputValue('input[aria-label="Nome do simulado"]')==='.teste','nome sugerido pelo arquivo');
  await p.fill('input[aria-label="Nome do simulado"]','Simulado Cálculo Aprovação 3');
  await p.click('text=Publicar simulado');await p.waitForTimeout(600);
  ok(srv.st.pdfs[0].titulo==='Simulado Cálculo Aprovação 3'&&srv.st.enviado.startsWith('%PDF'),'publica o PDF (arquivo chega inteiro ao servidor)');
  require('fs').unlinkSync(pdf);
  await p.click('.pdf-item:has-text("Aprovação 2") button:has-text("Editar")');await p.waitForTimeout(100);
  await p.fill('.reg-lista input[aria-label="Liberar em"]','2026-11-01');await p.click('.form-reg button:has-text("Salvar")');await p.waitForTimeout(500);
  ok(srv.st.pdfs.find(y=>y.id==='P2').liberarEm==='2026-11-01','edita a data de liberação');
  await p.click('.pdf-item:has-text("Aprovação 1") button:has-text("Remover")');await p.click('.mini.perigo');await p.waitForTimeout(500);
  ok(!srv.st.pdfs.some(y=>y.id==='P1'),'remove do app');
  await p.screenshot({path:__dirname+'/gestor_pdfs.png',fullPage:true});
  await p.click('.secoes button:has-text("Alunos")');await p.waitForTimeout(500);
  ok(!!(await p.$('select[aria-label="Escolher aluno"]')),'volta para a lista de alunos');
  ok(erros.length===0,'gestor: sem erros de JavaScript '+erros.join(';'));await p.close();}
 await b.close();console.log(falhas?falhas+' falha(s)':'TUDO OK');process.exit(falhas?1:0);})();

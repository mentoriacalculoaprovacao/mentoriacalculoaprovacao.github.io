// Testa as caixas do aluno (Meu painel · Simulados · Caderno de erros) e as abas do mentor, com um servidor simulado que guarda estado.
// Rodar: node testes/teste_registros.js
const {chromium}=require('playwright');
const SITE='file://'+require('path').resolve(__dirname,'..','index.html');
function novoServidor(){
  const st={lanc:[{id:'',origem:'formulario',prova:'SAS 1 2024',chave:'sas12024',dia:1,data:'01/10/2026',dataIso:'2026-10-01',L:30,H:28,N:null,M:null,C:[160,160,140,160,120],quando:1}],
    erros:[{linha:3,simulado:'SAS 1 2024',materia:'Química',parte:'Estequiometria',motivo:'Erro de cálculo'}],seq:1,log:[]};
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'');
  const dados=()=>({aluno:'Aluna Exemplo',primeiro:'Aluna',curso:'Medicina',desde:'out de 2026',mentor:'Mentor Exemplo',simulados:[{prova:'SAS 1 2024',data:'01/10/2026',ordem:1,L:30,H:28,N:null,M:null,R:740}],erros:st.erros});
  return {st, resp(req,papel){
    st.log.push(req.acao);
    switch(req.acao){
      case 'config': return {ok:true,aceitaCodigo:true,google:false};
      case 'entrar': return {ok:true,sessao:'S',quem:{nome:papel==='mentor'?'Mentor Exemplo':'Aluna Exemplo',via:'codigo',aluno:papel==='aluno',mentor:papel==='mentor'}};
      case 'inicio': return papel==='aluno'?{ok:true,papel:'aluno',quem:{nome:'Aluna Exemplo',via:'codigo',aluno:true},fases:{lancamentos:true,caderno:true,diagnostico:true},atualizado:'31/10/2026',dados:dados()}
        :{ok:true,papel:'mentor',quem:{nome:'Mentor Exemplo',via:'codigo',mentor:true},fases:{lancamentos:true,caderno:true,diagnostico:true},atualizado:'31/10/2026',alunos:[{id:'A1',aluno:'Aluna Exemplo',mentor:'Mentor Exemplo',nSims:1}],mentores:[],meuMentor:'Mentor Exemplo'};
      case 'aluno': return {ok:true,aluno:Object.assign({id:'A1',codigo:'AB12-CD34',diagnostico:{'Prontidão (0–100)':'60'}},dados())};
      case 'simulados': return {ok:true,catalogo:[{nome:'SAS 1 2024',chave:'sas12024',alunos:3,ultimo:1},{nome:'Bernoulli 2 2025',chave:'bernoulli22025',alunos:2,ultimo:0}],lancamentos:st.lanc.slice().sort((a,b)=>b.quando-a.quando)};
      case 'salvarSimulado':{
        if(papel==='mentor'&&req.id!=='A1') return {ok:false,erro:'proibido'};
        const k=norm(req.prova);const dup=st.lanc.find(l=>l.origem==='app'&&l.chave===k&&l.dia===req.dia&&l.id!==req.idLanc);
        if(dup) return {ok:false,erro:'duplicado',idLanc:dup.id,msg:'Você já lançou o Dia '+req.dia+' desta prova. Edite o lançamento existente.'};
        const l={id:req.idLanc||('L'+(++st.seq)),origem:'app',prova:req.prova,chave:k,dia:req.dia,data:req.data.split('-').reverse().join('/'),dataIso:req.data,L:req.L??null,H:req.H??null,N:req.N??null,M:req.M??null,C:(req.C||[]).map(x=>x===''?null:x),quando:++st.seq};
        st.lanc=st.lanc.filter(x=>x.id!==req.idLanc||!req.idLanc);st.lanc.push(l);return {ok:true,idLanc:l.id};}
      case 'excluirSimulado': st.lanc=st.lanc.filter(l=>l.id!==req.idLanc); return {ok:true};
      case 'caderno': return {ok:true,erros:st.erros,simulados:['Bernoulli 2 2025','SAS 1 2024'],materias:['Física','Química','Biologia','Matemática','História','Geografia','Linguagens','Sociologia','Filosofia'],motivos:['Não sabia o conteúdo','Interpretação do enunciado','Falta de atenção','Erro de cálculo']};
      case 'salvarErros': req.erros.forEach(e=>st.erros.push(Object.assign({linha:3+st.erros.length},e))); return {ok:true,n:req.erros.length};
      case 'editarErro': { const e=st.erros.find(x=>x.linha===req.linha); if(e.parte!==req.antes.parte) return {ok:false,erro:'mudou',msg:'mudou'}; Object.assign(e,req.depois); return {ok:true}; }
      case 'excluirErro': st.erros=st.erros.filter(x=>x.linha!==req.linha); return {ok:true};
      case 'atualizar': return {ok:true,dados:dados(),atualizado:'31/10/2026 01:30'};
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
  ok((await p.$$('.caixa')).length===3,'aluno vê as 3 caixas');
  ok((await p.textContent('.caixa[aria-pressed="true"]')).includes('Meu painel'),'começa em Meu painel');
  ok(!!(await p.$('.grade4')),'painel com os cartões dentro da caixa');
  await p.screenshot({path:__dirname+'/aluno_caixas.png'});
  await p.click('.caixa:has-text("Simulados")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Meus simulados','abre Simulados');
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
  ok((await p.inputValue('select[aria-label="Simulado"]'))==='Bernoulli 2 2025','já sugere o simulado mais recente');
  await p.selectOption('select[aria-label="Matéria"]','Química');
  ok((await p.$$eval('#partes-sugestoes option',o=>o.map(x=>x.value))).includes('Estequiometria'),'sugere partes já usadas na matéria');
  await p.click('text=+ Adicionar à lista');await p.waitForTimeout(100);
  ok((await p.textContent('.form-reg .erro')).includes('parte da matéria'),'exige a parte da matéria');
  await p.fill('input[aria-label="Parte da matéria"]','Equilíbrio químico');await p.selectOption('select[aria-label="Motivo do erro"]','Não sabia o conteúdo');
  await p.press('input[aria-label="Parte da matéria"]','Enter');await p.waitForTimeout(100);
  await p.selectOption('select[aria-label="Matéria"]','Física');await p.fill('input[aria-label="Parte da matéria"]','Cinemática');await p.selectOption('select[aria-label="Motivo do erro"]','Falta de atenção');
  await p.click('text=+ Adicionar à lista');await p.waitForTimeout(100);
  ok((await p.$$('.item-erro.pend')).length===2,'dois erros na lista antes de salvar');
  ok((await p.textContent('.form-reg .botao')).includes('Salvar 2 erros'),'botão mostra quantos vão ser salvos');
  await p.screenshot({path:__dirname+'/aluno_caderno.png',fullPage:true});
  await p.click('.form-reg .botao');await p.waitForTimeout(600);
  ok(srv.st.erros.length===3&&srv.st.erros.some(e=>e.parte==='Cinemática'&&e.simulado==='Bernoulli 2 2025'),'erros salvos com o simulado escolhido');
  await p.click('.item-erro:has-text("Cinemática") button:has-text("Editar")');await p.waitForTimeout(100);
  await p.fill('.editando input[aria-label="Parte da matéria"]','Dinâmica');await p.click('.editando button:has-text("Salvar")');await p.waitForTimeout(500);
  ok(srv.st.erros.some(e=>e.parte==='Dinâmica'),'editou um erro');
  await p.click('.item-erro:has-text("Dinâmica") button:has-text("Excluir")');await p.click('.mini.perigo');await p.waitForTimeout(500);
  ok(!srv.st.erros.some(e=>e.parte==='Dinâmica'),'excluiu um erro');
  await p.setViewportSize({width:390,height:900});await p.click('.caixa:has-text("Meu painel")');await p.waitForTimeout(300);
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
  ok(JSON.stringify(abas)===JSON.stringify(['Painel','Simulados','Caderno de erros','Diagnóstico']),'mentor tem Painel, Simulados, Caderno e Diagnóstico');
  await p.click('.aba:has-text("Simulados")');await p.waitForTimeout(400);
  ok((await p.textContent('.reg-titulo'))==='Simulados lançados','mentor vê os simulados do aluno');
  await p.click('.aba:has-text("Caderno")');await p.waitForTimeout(400);
  ok((await p.$$('.item-erro')).length>=1,'mentor vê o caderno do aluno');
  ok(srv.st.log.filter(a=>a==='caderno').length===1,'chamou o caderno do aluno');
  await p.screenshot({path:__dirname+'/mentor_caderno.png',fullPage:true});
  ok(erros.length===0,'mentor: sem erros de JavaScript '+erros.join(';'));await p.close();}
 await b.close();console.log(falhas?falhas+' falha(s)':'TUDO OK');process.exit(falhas?1:0);})();

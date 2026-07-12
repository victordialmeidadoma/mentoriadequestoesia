// Depende de: config.js, auth.js

let alunosMentor = [];
let editais = [];
let editalTopicosImportados = null;
let vincularEditalId = null;
let freqEditalId = null, freqAlunoIdx = null;

async function carregarAlunos(){
  const { data } = await _supabase.from('perfis').select('id,nome').eq('role','aluno').order('nome');
  alunosMentor = data||[];
}

function parseLinhaCSV(linha,delim){
  const out=[]; let cur=''; let dentroAspas=false;
  for(let i=0;i<linha.length;i++){
    const c=linha[i];
    if(c==='"'){dentroAspas=!dentroAspas;continue;}
    if(c===delim&&!dentroAspas){out.push(cur);cur='';continue;}
    cur+=c;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}

function parseEditalCSV(texto){
  const linhas=texto.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.trim());
  if(!linhas.length) return [];
  const header=parseLinhaCSV(linhas[0],';').map(h=>h.toLowerCase());
  const start=header[0]==='materia'?1:0;
  const topicos=[];
  for(let i=start;i<linhas.length;i++){
    const cols=parseLinhaCSV(linhas[i],';');
    if(!cols[0]||!cols[1]) continue;
    topicos.push({materia:cols[0].trim(),assunto:cols[1].trim()});
  }
  return topicos;
}

async function init(){
  const ok = await carregarSessao('mentor');
  if(!ok){ esconderLoading(); document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:Inter"><h2>Erro de autenticação</h2><p>Verifique o console (F12) e reporte o erro.</p><a href="/admin/alunos.html">Voltar</a></div>'; return; }

  document.getElementById('userEmailLabel').textContent = perfilAtual?.nome || usuarioAtual.email;

  // Todos os handlers aqui dentro, após autenticação
  document.getElementById('editalSelecionarArquivoBtn').onclick=()=>document.getElementById('editalFileInput').click();
document.getElementById('editalFileInput').onchange=(e)=>{
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=(ev)=>{ document.getElementById('editalCsvInput').value=ev.target.result; };
  r.readAsText(file,'utf-8');
};

document.getElementById('editalImportarBtn').onclick=()=>{
  const raw=document.getElementById('editalCsvInput').value.trim();
  if(!raw) return;
  const topicos=parseEditalCSV(raw);
  if(!topicos.length){ alert('Nenhuma linha válida no CSV.'); return; }
  editalTopicosImportados=topicos;
  document.getElementById('editalInfoCount').textContent=`${topicos.length} assuntos identificados`;
  ['editalInfoConcurso','editalInfoCargo','editalInfoBanca','editalInfoData'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('editalInfoModalOverlay').style.display='flex';
};

document.getElementById('editalInfoCancelar').onclick=()=>{ editalTopicosImportados=null; document.getElementById('editalInfoModalOverlay').style.display='none'; };

document.getElementById('editalInfoConfirmar').onclick = async () => {
  const concurso=document.getElementById('editalInfoConcurso').value.trim();
  const cargo=document.getElementById('editalInfoCargo').value.trim();
  const banca=document.getElementById('editalInfoBanca').value.trim();
  const data_prova=document.getElementById('editalInfoData').value.trim()||null;
  if(!concurso||!editalTopicosImportados) return;
  const { data:ed } = await _supabase.from('editais').insert({concurso,cargo,banca,data_prova,criado_por:usuarioAtual.id}).select().single();
  if(ed) await _supabase.from('edital_topicos').insert(editalTopicosImportados.map(t=>({edital_id:ed.id,...t})));
  editalTopicosImportados=null;
  document.getElementById('editalCsvInput').value='';
  document.getElementById('editalInfoModalOverlay').style.display='none';
  await carregarEditalList();
};

async function carregarEditalList(){
  const { data } = await _supabase
    .from('editais')
    .select('*, edital_topicos(count), edital_vinculos(aluno_id, perfis(nome))')
    .order('created_at',{ascending:false});
  editais=data||[];
  renderEditalList();
}

function renderEditalList(){
  const list=document.getElementById('editalListMentor');
  list.innerHTML='';
  if(!editais.length){ list.innerHTML='<div class="empty">Nenhum edital importado ainda.</div>'; return; }
  editais.forEach(ed=>{
    const totalTop=ed.edital_topicos?.[0]?.count||0;
    const vinculos=ed.edital_vinculos||[];
    const div=document.createElement('div');
    div.className='edital-card';
    div.innerHTML=`
      <div class="et-head">
        <div>
          <div class="et-concurso">${ed.concurso}</div>
          <div class="et-meta">
            ${ed.cargo?`<span>Cargo: <b>${ed.cargo}</b></span>`:''}
            ${ed.banca?`<span>Banca: <b>${ed.banca}</b></span>`:''}
            <span>Data: <b>${ed.data_prova||'a definir'}</b></span>
            <span>${totalTop} assuntos</span>
          </div>
        </div>
        <button class="btn small" data-edital-vincular="${ed.id}">Vincular a aluno</button>
      </div>
      <div class="et-vinculos">
        ${!vinculos.length
          ?'<div class="empty-step">Ainda não vinculado a nenhum aluno.</div>'
          :vinculos.map(v=>`
            <div class="vinculo-row">
              <span class="v-nome">${v.perfis?.nome||'—'}</span>
              <button class="btn ghost small" data-edital-freq="${ed.id}|${v.aluno_id}">Atualizar frequência</button>
            </div>`).join('')
        }
      </div>`;
    list.appendChild(div);
  });
}

document.getElementById('editalListMentor').addEventListener('click',(e)=>{
  const vincBtn=e.target.closest('[data-edital-vincular]');
  const freqBtn=e.target.closest('[data-edital-freq]');
  if(vincBtn){
    vincularEditalId=vincBtn.dataset.editalVincular;
    document.getElementById('vincularEditalSelect').innerHTML=alunosMentor.map(a=>`<option value="${a.id}">${a.nome}</option>`).join('');
    document.getElementById('vincularEditalModalOverlay').style.display='flex';
  }
  if(freqBtn){
    const [eid,aid]=freqBtn.dataset.editalFreq.split('|');
    freqEditalId=eid; freqAlunoIdx=aid;
    document.getElementById('freqCsvInput').value='';
    document.getElementById('freqModalOverlay').style.display='flex';
  }
});

document.getElementById('vincularEditalCancelar').onclick=()=>document.getElementById('vincularEditalModalOverlay').style.display='none';
document.getElementById('vincularEditalConfirmar').onclick = async () => {
  const alunoId=document.getElementById('vincularEditalSelect').value;
  await _supabase.from('edital_vinculos').upsert({edital_id:vincularEditalId,aluno_id:alunoId});
  const { data:topicos } = await _supabase.from('edital_topicos').select('id').eq('edital_id',vincularEditalId);
  if(topicos?.length){
    await _supabase.from('edital_topico_progresso').upsert(
      topicos.map(t=>({topico_id:t.id,aluno_id:alunoId,frequencia:0})),
      {onConflict:'topico_id,aluno_id',ignoreDuplicates:true}
    );
  }
  document.getElementById('vincularEditalModalOverlay').style.display='none';
  await carregarEditalList();
};

document.getElementById('freqModalCancelar').onclick=()=>document.getElementById('freqModalOverlay').style.display='none';
document.getElementById('freqModalConfirmar').onclick = async () => {
  const raw=document.getElementById('freqCsvInput').value.trim();
  if(!raw) return;
  const linhas=raw.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.trim());
  const header=parseLinhaCSV(linhas[0],';').map(h=>h.toLowerCase());
  const start=header[0]==='materia'?1:0;
  const { data:topicos } = await _supabase.from('edital_topicos').select('id,materia,assunto').eq('edital_id',freqEditalId);
  for(let i=start;i<linhas.length;i++){
    const cols=parseLinhaCSV(linhas[i],';');
    if(!cols[0]||!cols[1]) continue;
    const qtd=parseInt(cols[2])||0;
    const topico=topicos?.find(t=>t.materia.trim().toUpperCase()===cols[0].trim().toUpperCase()&&t.assunto.trim().toLowerCase()===cols[1].trim().toLowerCase());
    if(topico){
      const { data:prog } = await _supabase.from('edital_topico_progresso').select('frequencia').eq('topico_id',topico.id).eq('aluno_id',freqAlunoIdx).single().catch(()=>({data:null}));
      await _supabase.from('edital_topico_progresso').upsert({topico_id:topico.id,aluno_id:freqAlunoIdx,frequencia:(prog?.frequencia||0)+qtd,updated_at:new Date().toISOString()},{onConflict:'topico_id,aluno_id'});
    }
  }
  document.getElementById('freqModalOverlay').style.display='none';
  await carregarEditalList();
};

  esconderLoading();
  document.getElementById('appShell').style.display='block';
  await carregarAlunos();
  await carregarEditalList();
}
init();
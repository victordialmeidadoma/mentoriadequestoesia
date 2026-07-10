// Depende de: config.js, auth.js

// ===================== ABA EDITAL =====================
document.getElementById('editalSelecionarArquivoBtn').onclick=()=> document.getElementById('editalFileInput').click();
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
  ['editalInfoConcurso','editalInfoCargo','editalInfoBanca','editalInfoData'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('editalInfoModalOverlay').style.display='flex';
};

document.getElementById('editalInfoCancelar').onclick=()=>{ editalTopicosImportados=null; document.getElementById('editalInfoModalOverlay').style.display='none'; };

document.getElementById('editalInfoConfirmar').onclick = async () => {
  const concurso=document.getElementById('editalInfoConcurso').value.trim();
  const cargo=document.getElementById('editalInfoCargo').value.trim();
  const banca=document.getElementById('editalInfoBanca').value.trim();
  const data_prova=document.getElementById('editalInfoData').value.trim()||null;
  if(!concurso||!editalTopicosImportados) return;
  const { data: ed } = await _supabase.from('editais').insert({ concurso, cargo, banca, data_prova, criado_por: usuarioAtual.id }).select().single();
  if(ed){
    await _supabase.from('edital_topicos').insert(editalTopicosImportados.map(t=>({edital_id:ed.id,...t})));
  }
  editalTopicosImportados=null;
  document.getElementById('editalCsvInput').value='';
  document.getElementById('editalInfoModalOverlay').style.display='none';
  await carregarEditalListMentor();
};

async function carregarEditalListMentor(){
  const { data, error } = await _supabase
    .from('editais')
    .select('*, edital_topicos(count), edital_vinculos(aluno_id, perfis(nome))')
    .order('created_at',{ascending:false});
  if(error){ console.error(error); return; }
  editais=data||[];
  renderEditalListMentor();
}

function renderEditalListMentor(){
  const list=document.getElementById('editalListMentor');
  list.innerHTML='';
  if(!editais.length){ list.innerHTML=`<div class="empty">Nenhum edital importado ainda.</div>`; return; }
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
              <button class="btn ghost small" data-edital-freq="${ed.id}|${v.aluno_id}">Atualizar frequência semanal</button>
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
    const sel=document.getElementById('vincularEditalSelect');
    sel.innerHTML=alunosMentor.map(a=>`<option value="${a.id}">${a.nome}</option>`).join('');
    document.getElementById('vincularEditalModalOverlay').style.display='flex';
  }
  if(freqBtn){
    const [eid,aid]=freqBtn.dataset.editalFreq.split('|');
    freqEditalId=eid; freqAlunoIdx=aid;
    document.getElementById('freqCsvInput').value='';
    document.getElementById('freqModalOverlay').style.display='flex';
  }
});

document.getElementById('vincularEditalCancelar').onclick=()=> document.getElementById('vincularEditalModalOverlay').style.display='none';
document.getElementById('vincularEditalConfirmar').onclick = async () => {
  const alunoId=document.getElementById('vincularEditalSelect').value;
  const { error } = await _supabase.from('edital_vinculos').upsert({ edital_id:vincularEditalId, aluno_id:alunoId });
  if(!error){
    // cria registros de progresso zerado para cada tópico
    const { data: topicos } = await _supabase.from('edital_topicos').select('id').eq('edital_id',vincularEditalId);
    if(topicos?.length){
      await _supabase.from('edital_topico_progresso').upsert(
        topicos.map(t=>({topico_id:t.id, aluno_id:alunoId, frequencia:0})),
        { onConflict:'topico_id,aluno_id', ignoreDuplicates:true }
      );
    }
  }
  document.getElementById('vincularEditalModalOverlay').style.display='none';
  await carregarEditalListMentor();
};

document.getElementById('freqModalCancelar').onclick=()=> document.getElementById('freqModalOverlay').style.display='none';
document.getElementById('freqModalConfirmar').onclick = async () => {
  const raw=document.getElementById('freqCsvInput').value.trim();
  if(!raw) return;
  const linhas=raw.split('\n').map(l=>l.replace(/\r$/,'')).filter(l=>l.trim());
  const header=parseLinhaCSV(linhas[0],';').map(h=>h.toLowerCase());
  const start=header[0]==='materia'?1:0;
  const { data: topicos } = await _supabase.from('edital_topicos').select('id,materia,assunto').eq('edital_id',freqEditalId);
  for(let i=start;i<linhas.length;i++){
    const cols=parseLinhaCSV(linhas[i],';');
    if(!cols[0]||!cols[1]) continue;
    const qtd=parseInt(cols[2])||0;
    const topico=topicos?.find(t=>
      t.materia.trim().toUpperCase()===cols[0].trim().toUpperCase()&&
      t.assunto.trim().toLowerCase()===cols[1].trim().toLowerCase()
    );
    if(topico){
      // soma ao valor existente usando rpc ou upsert com increment
      const { data: prog } = await _supabase.from('edital_topico_progresso')
        .select('frequencia').eq('topico_id',topico.id).eq('aluno_id',freqAlunoIdx).single();
      const novaFreq=(prog?.frequencia||0)+qtd;
      await _supabase.from('edital_topico_progresso')
        .upsert({topico_id:topico.id, aluno_id:freqAlunoIdx, frequencia:novaFreq, updated_at:new Date().toISOString()},
          {onConflict:'topico_id,aluno_id'});
    }
  }
  document.getElementById('freqModalOverlay').style.display='none';
  await carregarEditalListMentor();
};

// ===================== SUPABASE AUTH =====================
function mostrarErro(msg){
  const el=document.getElementById('loginError');
  el.textContent=msg; el.style.display='block';
}

function esconderLoading(){
  document.getElementById('loadingScreen').style.display='none';
}

function entrarNoApp(email){
  esconderLoading();
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appShell').style.display='block';
  document.getElementById('userEmailLabel').textContent=email;
  carregarAlunos();
}

function mostrarLogin(){
  esconderLoading();
  document.getElementById('loginScreen').style.display='flex';
}

_supabase.auth.getSession().then(async ({ data: { session } }) => {
  if(!session){ mostrarLogin(); return; }
  const { data: perfil } = await _supabase.from('perfis').select('role').eq('id',session.user.id).single();
  if(perfil?.role==='mentor'){
    usuarioAtual=session.user;
    entrarNoApp(session.user.email);
  } else {
    await _supabase.auth.signOut();
    mostrarErro('Esta conta não tem acesso ao painel do mentor.');
    mostrarLogin();
  }
});

document.getElementById('loginBtn').onclick = async () => {
  const email=document.getElementById('loginEmail').value.trim();
  const senha=document.getElementById('loginPassword').value.trim();
  if(!email||!senha){ mostrarErro('Preencha e-mail e senha.'); return; }
  document.getElementById('loginError').style.display='none';
  const btn=document.getElementById('loginBtn');
  btn.textContent='Entrando...'; btn.disabled=true;
  const { data, error } = await _supabase.auth.signInWithPassword({email,password:senha});
  btn.textContent='Entrar'; btn.disabled=false;
  if(error){ mostrarErro(error.message); return; }
  const { data: perfil } = await _supabase.from('perfis').select('role').eq('id',data.user.id).single();
  if(perfil?.role!=='mentor'){ await _supabase.auth.signOut(); mostrarErro('Esta conta não tem acesso ao painel do mentor.'); return; }
  usuarioAtual=data.user;
  entrarNoApp(data.user.email);
};

document.getElementById('logoutBtn').onclick = async () => {
  await _supabase.auth.signOut();
  document.getElementById('appShell').style.display='none';
  mostrarLogin();
};

async function init(){
  const ok = await carregarSessao("mentor"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = usuarioAtual.email;
  esconderLoading();
  document.getElementById("appShell").style.display="block";
  carregarEditalListMentor();
}
init();

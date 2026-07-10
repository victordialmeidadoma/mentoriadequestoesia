// Depende de: config.js, auth.js

// ===================== ABA DIRECIONAMENTOS =====================
function renderMDirecAlunoList(){
  const list=document.getElementById('mDirecAlunoList');
  list.innerHTML='';
  alunosMentor.forEach((a,idx)=>{
    const atual=(a.direcionamentos||[]).find(d=>d.status==='atual');
    const div=document.createElement('div');
    div.className='aluno-pill';
    div.innerHTML=`
      <div>
        <div class="nome">${a.nome}</div>
        <div class="foco">${(a.direcionamentos||[]).length} direcionamento${(a.direcionamentos||[]).length!==1?'s':''} · atual: ${atual?'Dir. '+atual.numero:'—'}</div>
      </div>
      <div class="pct">${atual?atual.carreira:''}</div>`;
    div.onclick=()=>showMDirecDetalhe(idx);
    list.appendChild(div);
  });
}

function showMDirecDetalhe(idx){
  mDirecAlunoIdx=idx;
  const a=alunosMentor[idx];
  document.getElementById('mDirecDetalhe').style.display='block';
  document.getElementById('mDirecNomeAluno').textContent=a.nome;
  renderMDirecList();
  document.getElementById('mDirecDetalhe').scrollIntoView({behavior:'smooth',block:'start'});
}

function renderMDirecList(){
  const a=alunosMentor[mDirecAlunoIdx];
  const list=document.getElementById('mDirecList');
  list.innerHTML='';
  if(!(a.direcionamentos||[]).length){
    list.innerHTML=`<div class="empty">Nenhum direcionamento ainda.</div>`;
    return;
  }
  const R=26,C=2*Math.PI*R;
  a.direcionamentos.slice().reverse().forEach((d,i)=>{
    const feitos=(d.blocos||[]).filter(b=>b.etapa===4).length;
    const meta=d.meta_blocos||1;
    const pct=Math.min(100,Math.round((feitos/meta)*100));
    const offset=C-(C*pct/100);
    const div=document.createElement('div');
    div.className='direc-card '+d.status;
    div.style.cursor='default';
    div.innerHTML=`
      <div class="ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle class="track" cx="32" cy="32" r="${R}"/>
          <circle class="fill" cx="32" cy="32" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
        </svg>
        <div class="ring-label">${pct}%</div>
      </div>
      <div class="info">
        <div class="titulo-row">
          <span class="titulo">Direcionamento ${d.numero}</span>
          <span class="badge-status ${d.status}">${d.status==='atual'?'<span class="pulse"></span>Em andamento':'Encerrado'}</span>
        </div>
        <div class="carreira">${d.carreira}</div>
        <div class="sub">${d.periodo||''} · ${feitos}/${meta} blocos</div>
      </div>`;
    list.appendChild(div);
  });
}

document.getElementById('mDirecFecharBtn').onclick=()=> document.getElementById('mDirecDetalhe').style.display='none';

document.getElementById('mDirecNovoBtn').onclick=()=>{
  const a=alunosMentor[mDirecAlunoIdx];
  const ultimo=(a.direcionamentos||[]).slice(-1)[0];
  document.getElementById('novoDirecNumero').value='';
  document.getElementById('novoDirecCarreira').value=ultimo?.carreira||'';
  document.getElementById('novoDirecModalOverlay').style.display='flex';
};
document.getElementById('novoDirecCancelar').onclick=()=> document.getElementById('novoDirecModalOverlay').style.display='none';

document.getElementById('novoDirecConfirmar').onclick = async () => {
  const numero=document.getElementById('novoDirecNumero').value.trim();
  const carreira=document.getElementById('novoDirecCarreira').value.trim();
  if(!numero||!carreira) return;
  const a=alunosMentor[mDirecAlunoIdx];
  await _supabase.from('direcionamentos').insert({
    aluno_id: a.id, numero, carreira,
    status:'atual', meta_blocos: Math.round(((a.horas_semanais||20)*60)/30)
  });
  document.getElementById('novoDirecModalOverlay').style.display='none';
  await carregarAlunos();
  showMDirecDetalhe(mDirecAlunoIdx);
};

async function init(){
  const ok = await carregarSessao("mentor"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = usuarioAtual.email;
  esconderLoading();
  document.getElementById("appShell").style.display="block";
  carregarAlunos().then(renderMDirecAlunoList);
}
init();

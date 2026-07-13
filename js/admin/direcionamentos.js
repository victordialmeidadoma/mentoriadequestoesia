// Depende de: config.js, auth.js

let alunosMentor = [];
let mDirecAlunoIdx = null;

async function carregarAlunos(){
  const { data } = await _supabase
    .from('perfis')
    .select('*, direcionamentos(*, blocos(*))')
    .eq('role','aluno').order('nome');
  alunosMentor = data||[];
  renderMDirecAlunoList();
}

function renderMDirecAlunoList(){
  const list=document.getElementById('mDirecAlunoList');
  list.innerHTML='';
  if(!alunosMentor.length){
    list.innerHTML='<div class="empty"><span class="display">Nenhum aluno ainda</span></div>';
    return;
  }
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
    list.innerHTML='<div class="empty">Nenhum direcionamento ainda.</div>';
    return;
  }
  const R=26,C=2*Math.PI*R;
  a.direcionamentos.slice().reverse().forEach(d=>{
    const feitos=(d.blocos||[]).filter(b=>b.etapa===4).length;
    const meta=d.meta_blocos||1;
    const pct=Math.min(100,Math.round((feitos/meta)*100));
    const offset=C-(C*pct/100);
    const div=document.createElement('div');
    div.className='direc-card';
    div.style.cursor='default';
    div.innerHTML=`
      <div class="ring">
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle fill="none" stroke="#E8F7EF" stroke-width="6" cx="32" cy="32" r="${R}"/>
          <circle fill="none" stroke="#0B6E4F" stroke-width="6" stroke-linecap="round"
            cx="32" cy="32" r="${R}" stroke-dasharray="${C}" stroke-dashoffset="${offset}"
            style="transform:rotate(-90deg);transform-origin:50% 50%"/>
        </svg>
        <div class="ring-label">${pct}%</div>
      </div>
      <div class="info" style="flex:1;">
        <div class="titulo-row">
          <span class="titulo">Direcionamento ${d.numero}</span>
          <span class="badge-status ${d.status}">${d.status==='atual'?'<span class="pulse"></span>Em andamento':'Encerrado'}</span>
        </div>
        <div class="carreira">${d.carreira}</div>
        <div class="sub">${d.periodo||''} · ${feitos}/${meta} blocos</div>
      </div>
      <button class="btn ghost small" data-excluir-direc="${d.id}" style="color:#B5503A;border-color:#F5DDD9;flex-shrink:0;">Excluir</button>`;
    list.appendChild(div);
  });
}

async function init(){
  const ok = await carregarSessao('mentor');
  if(!ok){ esconderLoading(); document.body.innerHTML='<div style="padding:40px;text-align:center;font-family:Inter"><h2>Erro de autenticação</h2><p>Verifique o console (F12) e reporte o erro.</p><a href="/admin/alunos.html">Voltar</a></div>'; return; }

  const _lbl = document.getElementById('userEmailLabel'); if(_lbl) _lbl.textContent = perfilAtual?.nome || usuarioAtual.email;

  // Handlers dentro do init para garantir que o DOM está pronto
  document.getElementById('mDirecFecharBtn').onclick =
    ()=>document.getElementById('mDirecDetalhe').style.display='none';

  // Excluir direcionamento
  document.getElementById('mDirecList').addEventListener('click', async e=>{
    const btn=e.target.closest('[data-excluir-direc]');
    if(!btn) return;
    const id=btn.dataset.excluirDirec;
    const a=alunosMentor[mDirecAlunoIdx];
    const d=a.direcionamentos.find(x=>x.id===id);
    if(!confirm(`Excluir o Direcionamento ${d?.numero}? Esta ação remove também todos os blocos associados.`)) return;
    await _supabase.from('direcionamentos').delete().eq('id',id);
    await carregarAlunos();
    showMDirecDetalhe(mDirecAlunoIdx);
  });

  document.getElementById('mDirecNovoBtn').onclick = ()=>{
    const a=alunosMentor[mDirecAlunoIdx];
    const ultimo=(a?.direcionamentos||[]).slice(-1)[0];
    document.getElementById('novoDirecNumero').value='';
    document.getElementById('novoDirecCarreira').value=ultimo?.carreira||'';
    document.getElementById('novoDirecModalOverlay').style.display='flex';
  };

  document.getElementById('novoDirecCancelar').onclick =
    ()=>document.getElementById('novoDirecModalOverlay').style.display='none';

  document.getElementById('novoDirecConfirmar').onclick = async () => {
    const numero=document.getElementById('novoDirecNumero').value.trim();
    const carreira=document.getElementById('novoDirecCarreira').value.trim();
    if(!numero||!carreira) return;
    const a=alunosMentor[mDirecAlunoIdx];
    const btn=document.getElementById('novoDirecConfirmar');
    btn.textContent='Criando...'; btn.disabled=true;
    await _supabase.from('direcionamentos').insert({
      aluno_id:a.id, numero, carreira,
      status:'atual', meta_blocos:Math.round(((a.horas_semanais||20)*60)/30)
    });
    btn.textContent='Criar direcionamento'; btn.disabled=false;
    document.getElementById('novoDirecModalOverlay').style.display='none';
    await carregarAlunos();
    showMDirecDetalhe(mDirecAlunoIdx);
  };

  esconderLoading();
  document.getElementById('appShell').style.display='block';
  await carregarAlunos();
}

init();
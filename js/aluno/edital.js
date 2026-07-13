// Depende de: config.js, auth.js (carregarSessao, usuarioAtual, perfilAtual, esconderLoading, logout)

// ===================== EDITAL: ALUNO =====================
async function carregarEdital(){
  const { data: vinculos } = await _supabase
    .from('edital_vinculos')
    .select('edital_id')
    .eq('aluno_id', usuarioAtual.id);
  if(!vinculos?.length){
    document.getElementById('editalSubtitulo').textContent='Seu mentor ainda não vinculou um edital';
    document.getElementById('editalConteudo').innerHTML=`<div class="empty"><span class="display">Nenhum edital vinculado</span></div>`;
    return;
  }
  const ids = vinculos.map(v=>v.edital_id);
  const { data: eds } = await _supabase.from('editais').select('*').in('id', ids);
  editais = eds||[];
  renderEditalAluno();
}

async function renderEditalAluno(){
  const conteudo=document.getElementById('editalConteudo');
  conteudo.innerHTML='<div class="empty">Carregando...</div>';
  const html = await Promise.all(editais.map(async (ed,idx)=>{
    const { data: topicos } = await _supabase.from('edital_topicos').select('*, edital_topico_progresso(*)').eq('edital_id', ed.id);
    const total=topicos?.length||0;
    const vistos=(topicos||[]).filter(t=>(t.edital_topico_progresso||[]).some(p=>p.aluno_id===usuarioAtual.id&&p.frequencia>0)).length;
    const pct=total?Math.round((vistos/total)*100):0;
    const totalQ=(topicos||[]).reduce((s,t)=>s+((t.edital_topico_progresso||[]).find(p=>p.aluno_id===usuarioAtual.id)?.frequencia||0),0);
    const porMateria={};
    (topicos||[]).forEach(t=>{ (porMateria[t.materia]=porMateria[t.materia]||[]).push(t); });
    const linhas=Object.keys(porMateria).map(mat=>{
      return `<tr class="materia-row"><td colspan="3">${mat}</td></tr>`
        +porMateria[mat].map(t=>{
          const prog=(t.edital_topico_progresso||[]).find(p=>p.aluno_id===usuarioAtual.id);
          const freq=prog?.frequencia||0;
          return `<tr><td>${t.assunto}</td>
            <td>${freq>0?`<span class="visto-yes"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>Visto</span>`:'<span class="visto-no">Não visto</span>'}</td>
            <td><span class="freq-pill">${freq} questõe${freq===1?'':'s'}</span></td></tr>`;
        }).join('');
    }).join('');
    return `<div style="margin-bottom:34px;">
      <div class="section-head" style="margin-top:${idx===0?'0':'34px'};"><h2>${ed.concurso}</h2>
        <span class="hint">${ed.cargo?ed.cargo+' · ':''}${ed.banca?'Banca '+ed.banca:''}</span></div>
      <div class="edital-dash">
        <div class="card stat-card"><div class="label">Cobertura do edital</div><div class="value">${pct}<span class="unit">%</span></div></div>
        <div class="card stat-card"><div class="label">Assuntos vistos</div><div class="value">${vistos}<span class="unit">/ ${total}</span></div></div>
        <div class="card stat-card"><div class="label">Questões feitas</div><div class="value">${totalQ}</div></div>
        <div class="card stat-card"><div class="label">Data da prova</div><div class="value" style="font-size:20px;">${ed.data_prova||'a definir'}</div></div>
      </div>
      <table class="edital-table">
        <thead><tr><th>Assunto</th><th>Status</th><th>Frequência</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table></div>`;
  }));
  conteudo.innerHTML=html.join('');
  document.getElementById('editalSubtitulo').textContent=editais.length+' edital'+(editais.length>1?'is':'')+' vinculado'+(editais.length>1?'s':'');
}


async function init(){
  const ok = await carregarSessao("aluno"); if(!ok) return;
  document.getElementById("userEmailLabel").textContent = perfilAtual?.nome || usuarioAtual.email;
  esconderLoading();
  document.getElementById("appShell").style.display="block";
  await carregarEdital();
}
init();
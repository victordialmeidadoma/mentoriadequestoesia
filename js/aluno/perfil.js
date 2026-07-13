// Depende de: config.js, auth.js

let direcionamentos = [];

async function init(){
  const ok = await carregarSessao('aluno');
  if(!ok) return;

  const nome = perfilAtual.nome || usuarioAtual.email;
  const iniciais = nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.getElementById('perfilAvatar').textContent = iniciais;
  document.getElementById('perfilNome').textContent = nome;
  document.getElementById('perfilFoco').textContent =
    perfilAtual.carreiras?.length ? 'Foco: '+perfilAtual.carreiras.join(', ') : '';
  document.getElementById('infoNome').textContent = perfilAtual.nome || '—';
  document.getElementById('infoCarreiras').textContent = (perfilAtual.carreiras||[]).join(', ') || '—';
  document.getElementById('infoInicio').textContent = perfilAtual.created_at
    ? new Date(perfilAtual.created_at).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) : '—';
  const _lbl = document.getElementById('userEmailLabel'); if(_lbl) _lbl.textContent = perfilAtual?.nome || usuarioAtual.email;

  const { data: dirs } = await _supabase
    .from('direcionamentos').select('*, blocos(*)')
    .eq('aluno_id', usuarioAtual.id).order('created_at', { ascending: false });
  direcionamentos = dirs || [];

  const atual = direcionamentos.find(d=>d.status==='atual');
  const todosFeitos = direcionamentos.flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  const feitosAtual = atual ? (atual.blocos||[]).filter(b=>b.etapa===4).length : 0;
  const pct = atual ? Math.min(100,Math.round((feitosAtual/(atual.meta_blocos||1))*100)) : 0;
  document.getElementById('pPct').innerHTML = atual ? pct+'<span class="unit">%</span>' : '—';
  document.getElementById('pTotalBlocos').textContent = todosFeitos.length;
  const aprov = todosFeitos.length
    ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10) : 0;
  document.getElementById('pAprov').innerHTML = todosFeitos.length
    ? aprov+'<span class="unit">%</span>' : '—';

  renderDiaInline();
  renderMetasSemana();

  document.getElementById('iniciarDiaBtn').onclick = () => {
    renderDiaModal();
    document.getElementById('diaModalOverlay').style.display = 'flex';
  };
  document.getElementById('diaModalFechar').onclick = () =>
    document.getElementById('diaModalOverlay').style.display = 'none';

  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
}

// ===================== METAS DA SEMANA =====================
function renderMetasSemana() {
  const atual = direcionamentos.find(d=>d.status==='atual');
  const el = document.getElementById('metasSemana');
  if(!el) return;
  if(!atual){ el.innerHTML='<div style="color:var(--text-soft);font-size:13px;">Sem direcionamento ativo.</div>'; return; }

  const feitos = (atual.blocos||[]).filter(b=>b.etapa===4).length;
  const meta = atual.meta_blocos || 0;
  const pct = meta ? Math.min(100,Math.round((feitos/meta)*100)) : 0;
  const restam = Math.max(0, meta - feitos);

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
      <span style="font-size:13.5px;font-weight:600;color:var(--ink);">${feitos} de ${meta} blocos concluídos</span>
      <span style="font-family:Outfit;font-weight:800;font-size:18px;color:var(--g1);">${pct}%</span>
    </div>
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div style="font-size:12px;color:var(--text-soft);margin-top:6px;">
      ${restam > 0 ? `${restam} bloco${restam!==1?'s':''} restante${restam!==1?'s':''} para completar o Direcionamento ${atual.numero}` : 'Meta da semana concluída!'}
    </div>`;
}

// ===================== DIA INLINE =====================
function renderDiaInline() {
  const direc = direcionamentos.find(d=>d.status==='atual');
  document.getElementById('diaSubtitulo').textContent = direc
    ? `Direcionamento ${direc.numero} · ${direc.carreira}` : 'Nenhum direcionamento ativo';

  const idxAtual = direcionamentos.findIndex(d=>d.status==='atual');
  const anterior = direcionamentos[idxAtual+1] || null;
  const revisao = document.getElementById('diaRevisaoConteudo');

  if(!anterior){
    revisao.innerHTML = '<span style="color:var(--text-soft);">Primeiro direcionamento — sem prints anteriores.</span>';
  } else {
    // Prints do direcionamento anterior, do mais antigo para o mais recente (ciclando)
    const blocsComPrints = (anterior.blocos||[]).filter(b=>b.prints_count>0);
    if(!blocsComPrints.length){
      revisao.innerHTML = `<span style="color:var(--text-soft);">Nenhum print salvo no Direcionamento ${anterior.numero}.</span>`;
    } else {
      // Ordenação mais antigo → mais recente (blocos pelo código)
      const blocsOrdenados = [...blocsComPrints].sort((a,b)=>a.codigo.localeCompare(b.codigo));
      revisao.innerHTML = blocsOrdenados.map(b=>
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="font-size:12px;font-weight:700;color:var(--g1);background:var(--white);padding:3px 8px;border-radius:6px;">${b.disciplina}</span>
          <span style="font-size:12px;color:var(--text-soft);">${b.prints_count} print${b.prints_count>1?'s':''}</span>
        </div>`
      ).join('') + `<a href="/aluno/prints.html" style="font-size:12.5px;color:var(--g1);font-weight:600;text-decoration:none;margin-top:4px;display:inline-block;">Abrir prints para revisar →</a>`;
    }
  }

  const pre = direc ? (direc.blocos||[]).filter(b=>b.pre_agendado&&b.etapa===0) : [];
  const preEl = document.getElementById('diaPreAgendadoConteudo');
  if(!pre.length){
    preEl.innerHTML = '<span style="color:var(--text-soft);">Nenhum bloco pré-agendado.<br><small>Pré-agende blocos na aba Direcionamentos.</small></span>';
  } else {
    preEl.innerHTML = pre.map(b=>
      `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;gap:10px;">
        <span style="font-size:13.5px;font-weight:600;color:var(--ink);">
          <span style="color:var(--g1);font-family:Outfit;font-weight:700;margin-right:6px;">${b.codigo}</span>${b.disciplina}
        </span>
        <a href="/aluno/blocos.html?id=${direc.id}&bloco=${b.id}" class="btn small" style="flex-shrink:0;">Iniciar</a>
      </div>`
    ).join('');
  }
}

// ===================== MODAL DIA =====================
function renderDiaModal() {
  const direc = direcionamentos.find(d=>d.status==='atual');
  document.getElementById('diaStep2').className = 'dia-step locked';
  document.getElementById('diaCheck1').className = 'dia-step-num';

  const idxAtual = direcionamentos.findIndex(d=>d.status==='atual');
  const anterior = direcionamentos[idxAtual+1] || null;
  const blocsComPrints = anterior ? (anterior.blocos||[]).filter(b=>b.prints_count>0) : [];
  // Ordena do mais antigo para o mais recente (cicla pelo código)
  const blocsOrdenados = [...blocsComPrints].sort((a,b)=>a.codigo.localeCompare(b.codigo));

  // Pega índice de revisão atual do sessionStorage (cicla)
  const reviKey = `revisao_idx_${anterior?.id || 'none'}`;
  const reviIdx = parseInt(sessionStorage.getItem(reviKey) || '0');

  const body1 = document.getElementById('diaBody1');
  if(!anterior){
    body1.innerHTML = '<div class="empty-step">Primeiro direcionamento — sem prints para revisar.</div>'
      + '<button class="btn small" id="diaAvancar1" style="margin-top:12px;">Ir para os blocos</button>';
  } else if(!blocsOrdenados.length){
    body1.innerHTML = `<div class="empty-step">Nenhum print salvo no Direcionamento ${anterior.numero}.</div>`
      + '<button class="btn small" id="diaAvancar1" style="margin-top:12px;">Ir para os blocos</button>';
  } else {
    // Mostra o próximo bloco na sequência (cíclico)
    const blocoAtual = blocsOrdenados[reviIdx % blocsOrdenados.length];
    const isUltimo = (reviIdx % blocsOrdenados.length) === blocsOrdenados.length - 1;
    body1.innerHTML = `
      <div style="font-size:12px;color:var(--text-soft);margin-bottom:10px;">
        Revisando <b>${blocoAtual.disciplina}</b> do Direcionamento ${anterior.numero}
        · ${reviIdx % blocsOrdenados.length + 1} de ${blocsOrdenados.length}
        ${isUltimo ? ' · <span style="color:var(--g1)">voltando ao início no próximo ciclo</span>' : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--white);border-radius:10px;">
        <span style="font-size:13px;font-weight:600;color:var(--ink);">${blocoAtual.prints_count} print${blocoAtual.prints_count>1?'s':''} para revisar</span>
        <a href="/aluno/prints.html" style="color:var(--g1);font-size:12.5px;font-weight:600;">Ver prints →</a>
      </div>
      <button class="btn small" id="diaAvancar1" style="margin-top:12px;">Marcar como revisado</button>`;
  }

  document.getElementById('diaAvancar1').onclick = () => {
    // Avança o índice de revisão (cicla)
    if(blocsOrdenados.length > 0){
      sessionStorage.setItem(reviKey, String((reviIdx + 1) % blocsOrdenados.length === 0 ? 0 : reviIdx + 1));
    }
    document.getElementById('diaStep2').className = 'dia-step';
    document.getElementById('diaCheck1').className = 'dia-step-num done';
    const body2 = document.getElementById('diaBody2');
    if(!direc){ body2.innerHTML='<div class="empty-step">Nenhum direcionamento ativo.</div>'; return; }
    const pre = (direc.blocos||[]).filter(b=>b.pre_agendado&&b.etapa===0);
    body2.innerHTML = pre.length===0
      ? '<div class="empty-step">Nenhum bloco pré-agendado.</div>'
      : pre.map(b=>`<div class="dia-bloco-mini"><span class="l"><span class="cod">${b.codigo}</span>${b.disciplina}</span><a class="btn small" href="/aluno/blocos.html?id=${direc.id}&bloco=${b.id}">Iniciar</a></div>`).join('');
  };
}

init();
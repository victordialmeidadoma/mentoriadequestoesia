// Depende de: config.js, auth.js

async function init(){
  const ok = await carregarSessao('aluno');
  if(!ok) return;

  const nome = perfilAtual.nome || usuarioAtual.email;
  const iniciais = nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.getElementById('perfilAvatar').textContent = iniciais;
  document.getElementById('perfilNome').textContent = nome;
  document.getElementById('perfilFoco').textContent =
    perfilAtual.carreiras?.length ? 'Foco: '+perfilAtual.carreiras.join(', ') : '';
  document.getElementById('infoNome').textContent = perfilAtual.nome||'—';
  document.getElementById('infoCarreiras').textContent = (perfilAtual.carreiras||[]).join(', ')||'—';
  document.getElementById('infoInicio').textContent = perfilAtual.created_at
    ? new Date(perfilAtual.created_at).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}) : '—';
  document.getElementById('userEmailLabel').textContent = usuarioAtual.email;

  // Busca direcionamentos e blocos
  const { data: dirs } = await _supabase
    .from('direcionamentos').select('*, blocos(*)')
    .eq('aluno_id', usuarioAtual.id)
    .order('created_at', { ascending: false });

  const atual = (dirs||[]).find(d=>d.status==='atual');
  const todosFeitos = (dirs||[]).flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  const feitosAtual = atual ? (atual.blocos||[]).filter(b=>b.etapa===4).length : 0;
  const pct = atual ? Math.min(100,Math.round((feitosAtual/(atual.meta_blocos||1))*100)) : 0;

  document.getElementById('pPct').innerHTML = atual ? pct+'<span class="unit">%</span>' : '—';
  document.getElementById('pTotalBlocos').textContent = todosFeitos.length;
  const aprov = todosFeitos.length
    ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10) : 0;
  document.getElementById('pAprov').innerHTML = todosFeitos.length ? aprov+'<span class="unit">%</span>' : '—';

  // ===== METAS DO DIA =====
  const metaEl = document.getElementById('metasDoDia');
  if(metaEl && atual){
    const blocosPendentes = (atual.blocos||[]).filter(b=>b.etapa<4);
    const blocosHoje = (atual.blocos||[]).filter(b=>b.pre_agendado&&b.etapa===0);

    // Prints do direcionamento anterior para revisar
    const idxAtual = (dirs||[]).findIndex(d=>d.status==='atual');
    const anterior = (dirs||[])[idxAtual+1]||null;
    const printsParaRevisar = anterior
      ? (anterior.blocos||[]).filter(b=>b.prints_count>0).reduce((s,b)=>s+b.prints_count,0)
      : 0;

    metaEl.innerHTML = `
      <div class="section-head"><h2>Meta do dia</h2><a href="/aluno/direcionamentos.html" style="font-size:13px;color:var(--g1);font-weight:600;text-decoration:none;">Iniciar dia de estudos →</a></div>
      <div class="grid grid-3">
        <div class="card stat-card">
          <div class="label">Blocos restantes</div>
          <div class="value">${blocosPendentes.length}<span class="unit"> / ${(atual.blocos||[]).length}</span></div>
        </div>
        <div class="card stat-card">
          <div class="label">Pré-agendados hoje</div>
          <div class="value">${blocosHoje.length}</div>
        </div>
        <div class="card stat-card">
          <div class="label">Prints para revisar</div>
          <div class="value">${printsParaRevisar}<span class="unit">${anterior?' (Dir. '+anterior.numero+')':''}</span></div>
        </div>
      </div>`;
  }

  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
}
init();
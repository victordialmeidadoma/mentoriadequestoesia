// Depende de: config.js, auth.js

async function init(){
  const ok = await carregarSessao('aluno');
  if(!ok) return;

  // Preenche perfil hero
  const nome = perfilAtual.nome || usuarioAtual.email;
  const iniciais = nome.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();
  document.getElementById('perfilAvatar').textContent = iniciais;
  document.getElementById('perfilNome').textContent = nome;
  document.getElementById('perfilFoco').textContent =
    perfilAtual.carreiras?.length ? 'Foco: '+perfilAtual.carreiras.join(', ') : '';

  // Preenche card de informações
  document.getElementById('infoNome').textContent = perfilAtual.nome || '—';
  document.getElementById('infoCarreiras').textContent = (perfilAtual.carreiras||[]).join(', ') || '—';
  document.getElementById('infoInicio').textContent = perfilAtual.created_at
    ? new Date(perfilAtual.created_at).toLocaleDateString('pt-BR',{month:'short',year:'numeric'})
    : '—';

  document.getElementById('userEmailLabel').textContent = usuarioAtual.email;

  // Busca estatísticas de direcionamentos
  const { data: dirs } = await _supabase
    .from('direcionamentos')
    .select('*, blocos(*)')
    .eq('aluno_id', usuarioAtual.id);

  const atual = (dirs||[]).find(d=>d.status==='atual');
  const todosFeitos = (dirs||[]).flatMap(d=>d.blocos||[]).filter(b=>b.etapa===4);
  const feitosAtual = atual ? (atual.blocos||[]).filter(b=>b.etapa===4).length : 0;
  const pct = atual ? Math.min(100, Math.round((feitosAtual/(atual.meta_blocos||1))*100)) : 0;

  document.getElementById('pPct').innerHTML = atual ? pct+'<span class="unit">%</span>' : '—';
  document.getElementById('pTotalBlocos').textContent = todosFeitos.length;

  const aprov = todosFeitos.length
    ? Math.round(todosFeitos.reduce((s,b)=>s+(b.acertos||0),0)/todosFeitos.length*10) : 0;
  document.getElementById('pAprov').innerHTML = todosFeitos.length
    ? aprov+'<span class="unit">%</span>' : '—';

  esconderLoading();
  document.getElementById('appShell').style.display = 'block';
}
init();

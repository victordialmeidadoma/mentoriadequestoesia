let usuarioAtual = null;
let perfilAtual = null;

function esconderLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) el.style.display = 'none';
}

async function logout() {
  sessionStorage.clear();
  await _supabase.auth.signOut();
  window.location.href = '/login.html';
}

async function carregarSessao(roleEsperado) {
  let { data: { session } } = await _supabase.auth.getSession();
  if (!session) {
    const { data } = await _supabase.auth.refreshSession();
    session = data?.session;
  }
  if (!session) { window.location.href = '/login.html'; return false; }
  usuarioAtual = session.user;
  const { data: perfil, error } = await _supabase
    .from('perfis').select('*').eq('id', usuarioAtual.id).maybeSingle();
  console.log('[AUTH] perfil:', JSON.stringify(perfil));
  console.log('[AUTH] error:', JSON.stringify(error));
  console.log('[AUTH] roleEsperado:', roleEsperado);
  if (!perfil) { window.location.href = '/login.html'; return false; }
  perfilAtual = perfil;
  if (roleEsperado && perfil.role !== roleEsperado) {
    console.log('[AUTH] role errado:', perfil.role);
    return false;
  }
  return true;
}

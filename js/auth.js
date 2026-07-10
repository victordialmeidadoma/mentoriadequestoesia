// auth.js — login, logout e verificação de sessão
// Usado por login.html e definir-senha.html

async function verificarSessaoERedirecionarAluno() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return false;
  const { data: perfil } = await _supabase.from('perfis').select('role').eq('id', session.user.id).single();
  if (perfil?.role === 'mentor') {
    window.location.href = '/admin/alunos.html';
    return true;
  }
  window.location.href = '/aluno/perfil.html';
  return true;
}

async function verificarSessaoERedirecionarMentor() {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) return false;
  const { data: perfil } = await _supabase.from('perfis').select('role').eq('id', session.user.id).single();
  if (perfil?.role === 'mentor') {
    window.location.href = '/admin/alunos.html';
    return true;
  }
  return false;
}

async function logout() {
  await _supabase.auth.signOut();
  window.location.href = '/login.html';
}

// Guarda o usuário logado em memória para usar nas páginas
let usuarioAtual = null;
let perfilAtual = null;

async function carregarSessao(roleEsperado) {
  const { data: { session } } = await _supabase.auth.getSession();
  if (!session) { window.location.href = '/login.html'; return false; }
  const { data: perfil } = await _supabase.from('perfis').select('*').eq('id', session.user.id).single();
  if (!perfil || (roleEsperado && perfil.role !== roleEsperado)) {
    window.location.href = '/login.html';
    return false;
  }
  usuarioAtual = session.user;
  perfilAtual = perfil;
  return true;
}

function esconderLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) el.style.display = 'none';
}

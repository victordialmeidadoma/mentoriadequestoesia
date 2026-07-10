// auth.js — sessão e autenticação

let usuarioAtual = null;
let perfilAtual = null;

function esconderLoading() {
  const el = document.getElementById('loadingScreen');
  if (el) el.style.display = 'none';
}

async function logout() {
  sessionStorage.removeItem('userRole');
  sessionStorage.removeItem('userId');
  await _supabase.auth.signOut();
  window.location.href = '/login.html';
}

async function carregarSessao(roleEsperado) {
  // 1. Pega a sessão atual
  let { data: { session } } = await _supabase.auth.getSession();

  // Se não tem sessão tenta refresh
  if (!session) {
    const { data } = await _supabase.auth.refreshSession();
    session = data?.session;
  }

  if (!session) {
    window.location.href = '/login.html';
    return false;
  }

  usuarioAtual = session.user;

  // 2. Verifica role — usa cache do sessionStorage se disponível
  //    (evita query ao banco em cada navegação entre páginas)
  const cachedRole = sessionStorage.getItem('userRole');
  const cachedId   = sessionStorage.getItem('userId');

  let role = null;

  if (cachedRole && cachedId === usuarioAtual.id) {
    // Usa o cache
    role = cachedRole;
    perfilAtual = { role, id: usuarioAtual.id };
  } else {
    // Primeira vez — busca no banco e cacheia
    const { data: perfil } = await _supabase
      .from('perfis')
      .select('*')
      .eq('id', usuarioAtual.id)
      .maybeSingle();

    if (!perfil) {
      window.location.href = '/login.html';
      return false;
    }

    role = perfil.role;
    perfilAtual = perfil;
    sessionStorage.setItem('userRole', role);
    sessionStorage.setItem('userId', usuarioAtual.id);
  }

  // 3. Verifica se o role bate com o esperado
  if (roleEsperado && role !== roleEsperado) {
    window.location.href = role === 'mentor' ? '/admin/alunos.html' : '/aluno/perfil.html';
    return false;
  }

  return true;
}
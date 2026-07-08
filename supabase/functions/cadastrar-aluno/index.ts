import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verifica se quem chamou é mentor
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cliente com a chave do usuário logado (para checar se é mentor)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: perfil, error: perfilErr } = await supabaseUser
      .from('perfis')
      .select('role, id')
      .single()

    if (perfilErr || perfil?.role !== 'mentor') {
      return new Response(JSON.stringify({ error: 'Acesso restrito ao mentor' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cliente admin com service role key (pode criar usuários)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { nome, email, foco } = await req.json()

    if (!nome || !email) {
      return new Response(JSON.stringify({ error: 'Nome e e-mail são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Cria o usuário e envia e-mail de convite
    const { data: novoUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: false,          // exige confirmação por e-mail
      user_metadata: { nome, role: 'aluno' },
    })

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Envia o e-mail de redefinição de senha (é o "convite" — aluno clica e define a senha)
    await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: 'https://www.mentoriadequestoes.com/aluno' }
    })

    // Atualiza o perfil criado pelo trigger com carreiras e mentor_id
    const carreiras = foco
      ? foco.split(',').map((s: string) => s.trim()).filter(Boolean)
      : []

    await supabaseAdmin
      .from('perfis')
      .update({
        nome,
        carreiras,
        mentor_id: perfil.id,
        role: 'aluno'
      })
      .eq('id', novoUser.user.id)

    return new Response(JSON.stringify({ ok: true, id: novoUser.user.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

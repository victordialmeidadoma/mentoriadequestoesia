# Mentoria — Deploy no Vercel + Supabase

## Arquivos

```
aluno.html          → área do aluno  (/aluno)
admin.html          → área do mentor (/admin)
vercel.json         → rotas do Vercel
supabase-setup.sql  → setup completo do banco
README.md           → este arquivo
```

---

## 1. Supabase — configurar banco

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor** e rode o conteúdo de `supabase-setup.sql` completo
3. Vá em **Settings → API** e copie:
   - **Project URL** → `https://xxxx.supabase.co`
   - **anon / public key** → `eyJhbGciOiJIUzI1NiIs...`

---

## 2. Colar as chaves nos HTMLs

Em **aluno.html** e **admin.html**, localize:

```js
const _supabase = supabase.createClient(
  'SUPABASE_URL',      // ← substituir
  'SUPABASE_ANON_KEY'  // ← substituir
);
```

Substitua pelos valores copiados no passo anterior.

---

## 3. Login Google (opcional mas recomendado)

1. [console.cloud.google.com](https://console.cloud.google.com) → crie um projeto → **APIs & Services → Credentials → OAuth 2.0 Client**
2. Authorized redirect URI: `https://xxxx.supabase.co/auth/v1/callback`
3. No Supabase: **Authentication → Providers → Google** → cole Client ID e Client Secret

---

## 4. Storage para prints

1. Supabase Dashboard → **Storage → New Bucket**
2. Nome: `prints` | Public: **não**
3. Pronto — o SQL já configurou as políticas de acesso

---

## 5. Criar o primeiro mentor

Após criar o usuário no Supabase Auth (ou pelo invite), rode no SQL Editor:

```sql
update perfis set role = 'mentor' where id = '48a29c20-5c2d-4b99-8171-dd8c388dace6';
```

Todos os outros usuários criados são `aluno` por padrão.

---

## 6. Deploy no Vercel

```bash
# Instala Vercel CLI (uma vez só)
npm i -g vercel

# Na pasta do projeto
vercel

# Responde as perguntas:
# Set up and deploy? Y
# Which scope? (sua conta)
# Link to existing project? N
# Project name: mentoria
# In which directory is your code? ./
# Want to modify settings? N
```

Pronto — URL gerada na hora. Para conectar domínio próprio: **Vercel Dashboard → seu projeto → Settings → Domains**.

---

## 7. Variáveis de ambiente (alternativa mais segura)

Em vez de colar as chaves direto no HTML, você pode usar variáveis de ambiente do Vercel e um build step mínimo. Mas para um MVP estático, colar direto no HTML com a `anon key` é seguro — essa chave é pública por design, o acesso é controlado pelo RLS no banco.

---

## Fluxo de autenticação

```
/aluno → login → checa role no banco
  role = mentor → redireciona para /admin
  role = aluno  → entra na área do aluno

/admin → login → checa role no banco
  role = mentor  → entra no painel
  role != mentor → desloga e mostra erro
```

const SUPABASE_URL = 'https://ystlgxxqbuchwenyifwg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EZ_0KpOk5s7h9PQTRRB-sA_vCrzR5dv';
const OWNER_EMAIL_HASH = '7aedd7557c036e98ef23918e877a2b8734a6ff77df7806166e7abc5c4ad9c4e7';
const gate = document.querySelector('#authGate');
const status = document.querySelector('#authStatus');
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
window.hitokotoSupabase = client;
let entered = false;

async function sha256(value) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function enter(session) {
  if (entered || !session?.user) return;
  entered = true;
  const user = session.user;
  const isOwner = await sha256(user.email || '') === OWNER_EMAIL_HASH;
  window.hitokotoAuthUser = {id:user.id,email:user.email};
  window.hitokotoAuthIsOwner = isOwner;
  window.hitokotoSupabaseSession = session;
  localStorage.setItem('hitokoto-private-preview-visitor', user.id);
  if (isOwner) sessionStorage.setItem('ownerPassword', 'private-preview');
  else sessionStorage.removeItem('ownerPassword');
  gate.hidden = true;
  document.body.classList.remove('auth-pending');
  document.querySelector('#authIdentity').hidden = false;
  document.querySelector('#authEmail').textContent = user.email;
  document.querySelector('#oauthLogoutButton').addEventListener('click', async () => {
    await client.auth.signOut();
    sessionStorage.removeItem('ownerPassword');
    location.assign(location.pathname + location.search);
  });
  await import('/app.js');
}

const redirectUrl = () => `${location.origin}${location.pathname}${location.search}`;
function showAuthError(error) {
  status.className = 'auth-status error';
  status.textContent = error?.message || 'ログインできませんでした。入力内容と認証設定を確認してください。';
}

for (const [id,provider,scopes] of [
  ['discordLoginButton','discord','identify email']
]) {
  document.querySelector(`#${id}`).addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true; status.className = 'auth-status'; status.textContent = `${provider === 'discord' ? 'Discord' : 'GitHub'}へ接続しています…`;
    try {
      const {error} = await client.auth.signInWithOAuth({provider,options:{redirectTo:redirectUrl(),scopes}});
      if (error) showAuthError(error);
    } catch (error) {
      showAuthError(error);
    } finally {
      button.disabled = false;
    }
  });
}

client.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) enter(session);
});

(async () => {
  const visitorOnly = new URLSearchParams(location.search).get('view') === 'visitor';
  document.querySelector('#authTitle').textContent = visitorOnly ? '訪問者ログイン' : '投稿者ログイン';
  document.querySelector('#authDescription').textContent = visitorOnly
    ? 'Discordでログインして、ひとことにリアクションできます。'
    : 'Discordアカウントでログインしてください。';
  const {data,error} = await client.auth.getSession();
  if (data.session) return enter(data.session);
  if (error) { status.className = 'auth-status error'; status.textContent = error.message || 'ログインを確認できませんでした'; }
  gate.hidden = false; document.querySelector('#discordLoginButton').focus();
})();

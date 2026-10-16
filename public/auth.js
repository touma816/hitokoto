const SUPABASE_URL = 'https://ystlgxxqbuchwenyifwg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EZ_0KpOk5s7h9PQTRRB-sA_vCrzR5dv';
const gate = document.querySelector('#authGate');
const status = document.querySelector('#authStatus');
const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
window.hitokotoSupabase = client;
let entered = false;

async function enter(session) {
  if (entered || !session?.user) return;
  const user = session.user;
  const {data:isOwner,error} = await client.rpc('is_site_owner');
  if (error) {
    status.className = 'auth-status error';
    status.textContent = '投稿者の判定に失敗しました。Supabaseの setup.sql が実行済みか確認してください。';
    return;
  }
  entered = true;
  window.hitokotoAuthUser = {id:user.id};
  window.hitokotoAuthIsOwner = isOwner === true;
  window.hitokotoSupabaseSession = session;
  if (window.hitokotoAuthIsOwner) sessionStorage.setItem('ownerPassword', 'private-preview');
  else sessionStorage.removeItem('ownerPassword');
  gate.hidden = true;
  document.body.classList.remove('auth-pending');
  document.querySelector('#authIdentity').hidden = false;
  document.querySelector('#authEmail').textContent = 'Discordでログイン中';
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
  document.querySelector('#authTitle').textContent = 'Discordでログイン';
  document.querySelector('#authDescription').textContent = '投稿者はつぶやきを投稿でき、訪問者はリアクションできます。';
  const {data,error} = await client.auth.getSession();
  if (data.session) return enter(data.session);
  if (error) { status.className = 'auth-status error'; status.textContent = error.message || 'ログインを確認できませんでした'; }
  gate.hidden = false; document.querySelector('#discordLoginButton').focus();
})();

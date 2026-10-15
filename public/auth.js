const SUPABASE_URL = 'https://ystlgxxqbuchwenyifwg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EZ_0KpOk5s7h9PQTRRB-sA_vCrzR5dv';
const OWNER_EMAIL_HASH = '7aedd7557c036e98ef23918e877a2b8734a6ff77df7806166e7abc5c4ad9c4e7';
const SESSION_KEY = 'hitokoto-supabase-session';
const gate = document.querySelector('#authGate');
const form = document.querySelector('#emailLoginForm');
const status = document.querySelector('#authStatus');

const authFetch = (path, options = {}) => fetch(`${SUPABASE_URL}/auth/v1${path}`, {
  ...options,
  headers: { apikey:SUPABASE_KEY, authorization:`Bearer ${options.token || SUPABASE_KEY}`, 'content-type':'application/json', ...options.headers }
});

function saveSession(value) {
  if (!value) return localStorage.removeItem(SESSION_KEY);
  const expiresAt = value.expiresAt || Date.now() + Number(value.expires_in || 3600) * 1000;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ accessToken:value.accessToken || value.access_token, refreshToken:value.refreshToken || value.refresh_token, expiresAt }));
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
  catch { return null; }
}

function callbackSession() {
  const values = new URLSearchParams(location.hash.slice(1));
  if (values.get('error_description')) throw new Error(values.get('error_description'));
  const accessToken = values.get('access_token');
  if (!accessToken) return null;
  const session = { accessToken, refreshToken:values.get('refresh_token'), expiresAt:Date.now() + Number(values.get('expires_in') || 3600) * 1000 };
  history.replaceState({}, '', `${location.pathname}${location.search}`);
  saveSession(session);
  return session;
}

async function refreshSession(session) {
  if (!session?.refreshToken) return null;
  const response = await authFetch('/token?grant_type=refresh_token', { method:'POST', body:JSON.stringify({refresh_token:session.refreshToken}) });
  if (!response.ok) return null;
  const next = await response.json();
  saveSession(next);
  return loadSession();
}

async function currentUser(session) {
  if (!session?.accessToken) return null;
  if (session.expiresAt < Date.now() + 30_000) session = await refreshSession(session);
  if (!session?.accessToken) return null;
  const response = await authFetch('/user', { token:session.accessToken });
  if (!response.ok) return null;
  return { user:await response.json(), session };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value.trim().toLowerCase());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function enter(user, session) {
  const isOwner = await sha256(user.email || '') === OWNER_EMAIL_HASH;
  window.hitokotoAuthUser = { id:user.id, email:user.email };
  window.hitokotoAuthIsOwner = isOwner;
  localStorage.setItem('hitokoto-private-preview-visitor', user.id);
  if (isOwner) sessionStorage.setItem('ownerPassword', 'private-preview');
  else sessionStorage.removeItem('ownerPassword');
  gate.hidden = true;
  document.body.classList.remove('auth-pending');
  document.querySelector('#authIdentity').hidden = false;
  document.querySelector('#authEmail').textContent = user.email;
  document.querySelector('#emailLogoutButton').addEventListener('click', async () => {
    try { await authFetch('/logout', {method:'POST',token:session.accessToken}); } catch {}
    saveSession(null); sessionStorage.removeItem('ownerPassword'); location.reload();
  });
  await import('/app.js');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  const email = document.querySelector('#loginEmail').value.trim();
  button.disabled = true; status.className = 'auth-status'; status.textContent = '送信しています…';
  try {
    const redirect = `${location.origin}${location.pathname}`;
    const response = await authFetch(`/otp?redirect_to=${encodeURIComponent(redirect)}`, { method:'POST', body:JSON.stringify({email,create_user:true}) });
    if (!response.ok) { const result = await response.json().catch(() => ({})); throw new Error(result.msg || result.error_description || 'メールを送信できませんでした'); }
    status.className = 'auth-status success'; status.textContent = 'ログインリンクを送りました。メールを確認してください。';
  } catch (error) {
    status.className = 'auth-status error'; status.textContent = error.message;
  } finally { button.disabled = false; }
});

(async () => {
  try {
    const result = await currentUser(callbackSession() || loadSession());
    if (result) return enter(result.user, result.session);
    saveSession(null);
  } catch (error) {
    status.className = 'auth-status error'; status.textContent = error.message || 'ログインを確認できませんでした';
  }
  gate.hidden = false; document.querySelector('#loginEmail').focus();
})();

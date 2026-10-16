const $ = selector => document.querySelector(selector);
const feed = $('#feed');
const postText = $('#postText');
const imageInput = $('#imageInput');
const loginDialog = $('#loginDialog');
const profileDialog = $('#profileDialog');
const emojiNames = { '❤️':'いいね', '😂':'笑った', '👏':'拍手', '😭':'泣ける', '😮':'びっくり', '😄':'うれしい', '👍':'いいね', '✨':'きらきら', '💖':'ときめいた', '🎉':'おめでとう', '🤔':'考え中', '😌':'ほっとした', '👀':'気になる', '🔥':'最高', '🥹':'感動', '💜':'紫のハート', '☕':'コーヒー', '🍁':'秋だね', '🌱':'応援' };
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
const icon = name => `<img src="/assets/icons/${name}.svg" alt="">`;
let posts = [];
let profile = { name:'とうま', handle:'touma816', avatar:'/assets/avatar.webp' };
let profileAvatarDraft = profile.avatar;
let ownerPassword = sessionStorage.getItem('ownerPassword') || '';
const emailAuth = Boolean(window.hitokotoAuthUser);
let authenticated = false;
let images = [];
let processing = false;
let submitting = false;
let toastTimer;
let pickerPost = null;
const pendingReactions = new Set();

function showToast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('show');
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 2600);
}
function applyProfile() {
  document.querySelectorAll('[data-profile-name]').forEach(element => { element.textContent = profile.name; });
  document.querySelectorAll('[data-profile-handle]').forEach(element => { element.textContent = `@${profile.handle}`; });
  document.querySelectorAll('[data-profile-avatar]').forEach(image => { image.src = profile.avatar; });
  document.querySelectorAll('.profile-avatar').forEach(image => { image.alt = `${profile.name}のプロフィール画像`; });
  document.querySelector('link[rel="icon"]').href = profile.avatar;
}
async function loadProfile() {
  try { profile = await request('/api/profile'); applyProfile(); }
  catch { applyProfile(); }
}
async function request(path, options = {}, owner = false) {
  const response = await fetch(path, { ...options, headers: { 'content-type':'application/json', ...(owner ? { 'x-owner-password':ownerPassword } : {}), ...options.headers } });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || '操作を完了できませんでした'); error.status = response.status; throw error; }
  return result;
}
function relativeTime(value) {
  const date = new Date(value), minutes = Math.max(0, Math.floor((Date.now() - date) / 60000));
  if (minutes < 1) return 'たった今';
  if (minutes < 60) return `${minutes}分前`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}時間前`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}日前`;
  return new Intl.DateTimeFormat('ja-JP', { timeZone:'Asia/Tokyo', month:'long', day:'numeric' }).format(date);
}
function reactionMarkup(post) {
  const groups = post.reactions.slice();
  if (!groups.some(item => item.emoji === '❤️')) groups.unshift({ emoji:'❤️', count:0, reacted:false });
  return groups.map(item => `<button class="reaction" type="button" data-emoji="${item.emoji}" aria-label="${item.emoji} ${emojiNames[item.emoji] || 'リアクション'} ${item.count}件${item.reacted ? '、取り消す' : ''}" aria-pressed="${item.reacted}"><span class="reaction-emoji">${item.emoji}</span><span>${item.count}</span></button>`).join('') + `<button class="reaction-add" type="button" aria-label="絵文字でリアクション" aria-expanded="false" aria-controls="picker-${escapeHtml(post.id)}">${icon('plus')}</button>`;
}
function postMarkup(post) {
  return `<article class="post" data-id="${escapeHtml(post.id)}"><img class="avatar" src="${escapeHtml(profile.avatar)}" alt="" width="64" height="64"><div class="post-main"><div class="post-byline"><strong>${escapeHtml(profile.name)}</strong><span class="post-handle">@${escapeHtml(profile.handle)}</span><span class="post-separator">·</span><time class="post-time" datetime="${escapeHtml(post.createdAt)}" title="${escapeHtml(new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',dateStyle:'long',timeStyle:'short'}).format(new Date(post.createdAt)))}">${relativeTime(post.createdAt)}</time>${authenticated ? `<button class="delete-button" type="button" aria-label="この投稿を削除">${icon('trash')}</button>` : ''}</div>${post.text ? `<p class="post-text">${escapeHtml(post.text)}</p>` : ''}${post.images.length ? `<div class="post-images${post.images.length > 1 ? ' multiple' : ''}">${post.images.map((image, index) => `<button class="photo-button" type="button" data-image="${index}" aria-label="投稿画像${index + 1}を拡大"><img src="${escapeHtml(image)}" alt="${escapeHtml(profile.name)}の投稿画像 ${index + 1}" loading="lazy"></button>`).join('')}</div>` : ''}<div class="reaction-bar">${reactionMarkup(post)}</div></div></article>`;
}
function renderFeed() {
  closePicker(false);
  feed.innerHTML = posts.length ? posts.map(postMarkup).join('') : '<p class="empty-state">まだ、つぶやきはありません。<br>最初のひとことを、ここから。</p>';
}
async function loadPosts() {
  feed.setAttribute('aria-busy', 'true');
  try { posts = await request('/api/posts'); renderFeed(); }
  catch { feed.innerHTML = '<div class="empty-state">つぶやきを読み込めませんでした。<br><button class="retry-button" type="button">もう一度読み込む</button></div>'; }
  finally { feed.setAttribute('aria-busy', 'false'); }
}
function updateOwnerUI() {
  const compose = authenticated;
  $('#composePanel').hidden = !compose; $('#visitorNote').hidden = compose;
  $('#ownerButton').hidden = emailAuth;
  renderFeed();
}
function openLogin() { $('#loginError').textContent = ''; loginDialog.showModal(); $('#password').focus(); }
async function unlock(password) {
  ownerPassword = password;
  await request('/api/owner/check', { method:'POST' }, true);
  authenticated = true;
  sessionStorage.setItem('ownerPassword', ownerPassword);
  updateOwnerUI(); loginDialog.close(); $('#password').value = ''; postText.focus();
}
$('#ownerButton').addEventListener('click', openLogin);
$('#closeLogin').addEventListener('click', () => loginDialog.close());
$('#loginForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; $('#loginError').textContent = '';
  try { await unlock($('#password').value); }
  catch (error) { $('#loginError').textContent = error.message; ownerPassword = ''; }
  finally { button.disabled = false; }
});
$('#profileButton').addEventListener('click', () => {
  if (!authenticated) { if (emailAuth) showToast('プロフィールは投稿者だけ変更できます'); else openLogin(); return; }
  profileAvatarDraft = profile.avatar; $('#profileAvatarPreview').src = profileAvatarDraft;
  $('#displayName').value = profile.name; $('#handle').value = profile.handle; $('#profileError').textContent = '';
  profileDialog.showModal(); $('#displayName').focus();
});
$('#closeProfile').addEventListener('click', () => profileDialog.close());
$('#profileAvatarButton').addEventListener('click', () => $('#profileAvatarInput').click());
$('#profileAvatarInput').addEventListener('change', async () => {
  const file = $('#profileAvatarInput').files[0]; $('#profileAvatarInput').value = '';
  if (!file) return;
  $('#profileAvatarButton').disabled = true; $('#profileError').textContent = '';
  try { profileAvatarDraft = await prepareAvatar(file); $('#profileAvatarPreview').src = profileAvatarDraft; }
  catch (error) { $('#profileError').textContent = error.message; }
  finally { $('#profileAvatarButton').disabled = false; }
});
$('#profileForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; $('#profileError').textContent = '';
  try {
    profile = await request('/api/profile', { method:'PUT', body:JSON.stringify({ name:$('#displayName').value, handle:$('#handle').value, avatar:profileAvatarDraft }) }, true);
    applyProfile(); renderFeed(); profileDialog.close(); showToast('プロフィールを更新しました');
  } catch (error) { $('#profileError').textContent = error.message; }
  finally { button.disabled = false; }
});
function updateComposer() {
  $('#counter').textContent = `${postText.value.length} / 500`;
  $('#postButton').disabled = submitting || processing || (!postText.value.trim() && !images.length);
  $('#postButton span').textContent = submitting ? '投稿中…' : processing ? '画像を準備中…' : '投稿する';
  $('#addImageButton').disabled = submitting || processing || images.length >= 4;
  $('#addImageButton').hidden = images.length >= 4;
}
postText.addEventListener('input', () => { $('#postError').textContent = ''; updateComposer(); });
postText.addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !$('#postButton').disabled) $('#postForm').requestSubmit(); });
$('#addImageButton').addEventListener('click', () => imageInput.click());
function renderPreviews() {
  $('#imagePreviews').innerHTML = images.map((image, index) => `<div class="image-preview"><img src="${image}" alt="添付画像${index + 1}のプレビュー"><button class="remove-image" type="button" data-index="${index}" aria-label="添付画像${index + 1}を取り消す">${icon('x')}</button></div>`).join('');
}
async function prepareImage(file) {
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('JPEG・PNG・WebP・GIFの画像を選んでください。');
  if (file.size > 20_000_000) throw new Error('元の画像は20MB以下にしてください。');
  if (file.type === 'image/gif' && file.size <= 2_000_000) return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('画像を読み込めませんでした。')); reader.readAsDataURL(file); });
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('画像を読み込めませんでした。別の画像でお試しください。'); }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const data = canvas.toDataURL('image/webp', .86);
  if (data.length > 2_600_000) throw new Error('画像が大きすぎます。小さな画像を選んでください。');
  return data;
}
async function prepareAvatar(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('アイコンはJPEG・PNG・WebPから選んでください。');
  if (file.size > 20_000_000) throw new Error('元の画像は20MB以下にしてください。');
  let bitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('画像を読み込めませんでした。別の画像でお試しください。'); }
  const side = Math.min(bitmap.width, bitmap.height), x = (bitmap.width - side) / 2, y = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
  canvas.getContext('2d').drawImage(bitmap, x, y, side, side, 0, 0, 512, 512); bitmap.close();
  return canvas.toDataURL('image/webp', .88);
}
imageInput.addEventListener('change', async () => {
  const files = Array.from(imageInput.files); imageInput.value = '';
  if (!files.length || submitting || processing) return;
  $('#postError').textContent = '';
  if (images.length + files.length > 4) { $('#postError').textContent = '画像は4枚まで添付できます。'; return; }
  processing = true; updateComposer();
  try { const prepared = []; for (const file of files) prepared.push(await prepareImage(file)); images.push(...prepared); renderPreviews(); }
  catch (error) { $('#postError').textContent = error.message; }
  finally { processing = false; updateComposer(); }
});
$('#imagePreviews').addEventListener('click', event => {
  const button = event.target.closest('.remove-image'); if (!button || submitting) return;
  images.splice(Number(button.dataset.index), 1); renderPreviews(); updateComposer(); $('#addImageButton').focus();
});
$('#postForm').addEventListener('submit', async event => {
  event.preventDefault(); if ($('#postButton').disabled) return;
  submitting = true; updateComposer(); postText.disabled = true; $('#postError').textContent = '';
  try {
    const post = await request('/api/posts', { method:'POST', body:JSON.stringify({ text:postText.value, images }) }, true);
    posts.unshift(post); postText.value = ''; images = []; renderPreviews(); renderFeed(); showToast('ひとこと、投稿しました');
  } catch (error) { $('#postError').textContent = error.message; if (error.status === 401) { authenticated = false; updateOwnerUI(); openLogin(); } }
  finally { submitting = false; postText.disabled = false; updateComposer(); }
});
function closePicker(restoreFocus = true) {
  const picker = document.querySelector('.emoji-picker');
  if (picker) { const opener = picker.parentElement.querySelector('.reaction-add'); picker.remove(); opener.setAttribute('aria-expanded','false'); if (restoreFocus) opener.focus(); }
  pickerPost = null;
}
function openPicker(postId, button) {
  const wasOpen = pickerPost === postId; closePicker(false); if (wasOpen) return;
  pickerPost = postId; button.setAttribute('aria-expanded','true');
  const picker = document.createElement('div'); picker.className = 'emoji-picker'; picker.id = `picker-${postId}`;
  picker.setAttribute('role','group'); picker.setAttribute('aria-label','絵文字でリアクション');
  picker.innerHTML = `<div class="picker-header"><span>絵文字でリアクション</span><button class="icon-button close-picker" type="button" aria-label="絵文字を閉じる">${icon('x')}</button></div><div class="emoji-grid">${Object.entries(emojiNames).map(([emoji,name]) => `<button class="emoji-choice" type="button" data-emoji="${emoji}" aria-label="${emoji} ${name}">${emoji}</button>`).join('')}</div>`;
  button.parentElement.append(picker); picker.querySelector('.emoji-choice').focus();
  const box = picker.getBoundingClientRect();
  if (box.bottom > window.innerHeight && button.getBoundingClientRect().top > box.height + 12) { picker.style.top = 'auto'; picker.style.bottom = 'calc(100% + 10px)'; }
}
async function react(postId, emoji, article) {
  if (pendingReactions.has(postId)) return;
  pendingReactions.add(postId); closePicker(false);
  const buttons = article.querySelectorAll('.reaction, .reaction-add'); buttons.forEach(button => button.disabled = true);
  try {
    const updated = await request(`/api/posts/${encodeURIComponent(postId)}/reactions`, { method:'POST', body:JSON.stringify({ emoji }) });
    posts = posts.map(post => post.id === postId ? updated : post);
    const bar = article.querySelector('.reaction-bar'); bar.innerHTML = reactionMarkup(updated);
    const focus = Array.from(bar.querySelectorAll('[data-emoji]')).find(button => button.dataset.emoji === emoji) || bar.querySelector('.reaction-add'); focus.focus({preventScroll:true});
    const selected = updated.reactions.find(item => item.emoji === emoji)?.reacted;
    showToast(selected ? `${emoji} 気持ちを届けました` : 'リアクションを取り消しました');
  } catch (error) { showToast(error.message); }
  finally { pendingReactions.delete(postId); buttons.forEach(button => button.disabled = false); }
}
feed.addEventListener('click', async event => {
  if (event.target.closest('.retry-button')) return loadPosts();
  if (event.target.closest('.close-picker')) return closePicker();
  const article = event.target.closest('.post'); if (!article) return;
  const postId = article.dataset.id;
  const emojiButton = event.target.closest('[data-emoji]');
  if (emojiButton) return react(postId, emojiButton.dataset.emoji, article);
  const add = event.target.closest('.reaction-add'); if (add) return openPicker(postId, add);
  const photo = event.target.closest('.photo-button');
  if (photo) { $('#expandedImage').src = posts.find(post => post.id === postId).images[Number(photo.dataset.image)]; $('#imageDialog').showModal(); return; }
  const remove = event.target.closest('.delete-button');
  if (remove && confirm('このつぶやきを削除しますか？')) {
    remove.disabled = true;
    try { await request(`/api/posts/${encodeURIComponent(postId)}`, { method:'DELETE' }, true); posts = posts.filter(post => post.id !== postId); renderFeed(); showToast('つぶやきを削除しました'); }
    catch (error) { showToast(error.message); remove.disabled = false; }
  }
});
document.addEventListener('click', event => { if (!event.target.closest('.emoji-picker') && !event.target.closest('.reaction-add')) closePicker(false); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && pickerPost) { closePicker(); event.preventDefault(); } });
let liveRefreshTimer;
window.addEventListener('hitokoto:remote-change', event => {
  clearTimeout(liveRefreshTimer);
  liveRefreshTimer = setTimeout(async () => {
    if (event.detail === 'site_profile') await loadProfile();
    await loadPosts();
  }, 120);
});
$('#closeImage').addEventListener('click', () => $('#imageDialog').close());
for (const dialog of [loginDialog, profileDialog, $('#imageDialog')]) dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
async function init() {
  await loadProfile();
  await loadPosts();
  if (ownerPassword) {
    try { await unlock(ownerPassword); }
    catch (error) { if (error.status === 401) { ownerPassword = ''; sessionStorage.removeItem('ownerPassword'); } else showToast('ログイン状態を確認できませんでした'); }
  }
  if (!authenticated) updateOwnerUI();
  if (['/owner','/owner.html'].includes(location.pathname) && !authenticated && !emailAuth) openLogin();
}
init();

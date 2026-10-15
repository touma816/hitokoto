(() => {
  const originalFetch = window.fetch.bind(window);
  const storageKey = 'hitokoto-private-preview-posts';
  const profileKey = 'hitokoto-private-preview-profile';
  const visitorKey = 'hitokoto-private-preview-visitor';
  const fallbackVisitor = localStorage.getItem(visitorKey) || crypto.randomUUID();
  localStorage.setItem(visitorKey, fallbackVisitor);
  const visitor = () => window.hitokotoAuthUser?.id || fallbackVisitor;
  const ownerRequest = options => Boolean(window.hitokotoAuthIsOwner) && options.headers?.['x-owner-password'] === 'private-preview';
  const defaultProfile = {name:'とうま',handle:'touma816',avatar:'/assets/avatar.webp'};
  const people = count => Array.from({length:count},(_,index) => `sample-${index}`);
  const seedPosts = [
    {id:'first-coffee',text:'朝のコーヒー、やっぱり最高だなあ。\n湯気の向こうで、今日もいい日になりそう ☕',images:['/assets/coffee.webp'],createdAt:new Date(Date.now()-3*3600000).toISOString(),likedBy:people(12),reactions:{'😂':people(4),'👏':people(8)}},
    {id:'autumn-walk',text:'近所の散歩で、秋を見つけた。',images:['/assets/autumn.webp'],createdAt:new Date(Date.now()-6*3600000).toISOString(),likedBy:people(12),reactions:{'😂':people(4),'👏':people(8)}}
  ];
  const allowedEmoji = ['❤️','😂','👏','😭','😮','😄','👍','✨','💖','🎉','🤔','😌','👀','🔥','🥹','💜','☕','🍁','🌱'];
  let remoteReady = null;
  let realtimeChannel;

  const json = (value,status=200) => Promise.resolve(new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}}));
  const supabase = () => window.hitokotoSupabase;
  const missingSchema = error => ['42P01','PGRST205','PGRST204'].includes(error?.code);
  const localProfile = () => {
    try { return {...defaultProfile,...(JSON.parse(localStorage.getItem(profileKey)) || {})}; }
    catch { return {...defaultProfile}; }
  };
  const localPosts = () => {
    try { return JSON.parse(localStorage.getItem(storageKey)) || structuredClone(seedPosts); }
    catch { return structuredClone(seedPosts); }
  };
  const saveLocalPosts = posts => {
    try { localStorage.setItem(storageKey,JSON.stringify(posts)); }
    catch { throw new Error('画像が大きいため、プレビュー内に保存できませんでした'); }
  };
  const publicLocalPost = post => {
    const groups = {'❤️':post.likedBy || [],...(post.reactions || {})};
    return {id:post.id,text:post.text,images:post.images || [],createdAt:post.createdAt,likes:groups['❤️'].length,liked:groups['❤️'].includes(visitor()),reactions:Object.entries(groups).filter(([,users]) => users.length).map(([emoji,users]) => ({emoji,count:users.length,reacted:users.includes(visitor())}))};
  };

  function startRealtime() {
    if (realtimeChannel || !supabase()) return;
    realtimeChannel = supabase().channel('hitokoto-live')
      .on('postgres_changes',{event:'*',schema:'public',table:'posts'},() => window.dispatchEvent(new CustomEvent('hitokoto:remote-change',{detail:'posts'})))
      .on('postgres_changes',{event:'*',schema:'public',table:'reactions'},() => window.dispatchEvent(new CustomEvent('hitokoto:remote-change',{detail:'reactions'})))
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'site_profile'},() => window.dispatchEvent(new CustomEvent('hitokoto:remote-change',{detail:'site_profile'})))
      .subscribe();
  }

  async function remoteProfile() {
    if (!supabase()) return null;
    const {data,error} = await supabase().from('site_profile').select('name,handle,avatar').eq('id',true).maybeSingle();
    if (error) {
      if (missingSchema(error)) { remoteReady = false; return null; }
      throw error;
    }
    remoteReady = true; startRealtime();
    return data ? {...defaultProfile,...data} : {...defaultProfile};
  }

  async function remotePosts() {
    if (!remoteReady) return null;
    const [{data:posts,error:postError},{data:reactions,error:reactionError}] = await Promise.all([
      supabase().from('posts').select('id,text,images,created_at').order('created_at',{ascending:false}),
      supabase().from('reactions').select('post_id,user_id,emoji')
    ]);
    if (postError) throw postError;
    if (reactionError) throw reactionError;
    return posts.map(post => {
      const rows = reactions.filter(row => row.post_id === post.id);
      const grouped = new Map();
      for (const row of rows) grouped.set(row.emoji,[...(grouped.get(row.emoji) || []),row.user_id]);
      const hearts = grouped.get('❤️') || [];
      return {id:post.id,text:post.text,images:post.images || [],createdAt:post.created_at,likes:hearts.length,liked:hearts.includes(visitor()),reactions:Array.from(grouped,([emoji,users]) => ({emoji,count:users.length,reacted:users.includes(visitor())}))};
    });
  }

  async function uploadMedia(dataUrl,folder) {
    if (!dataUrl.startsWith('data:')) return dataUrl;
    const blob = await originalFetch(dataUrl).then(response => response.blob());
    const extension = blob.type.split('/')[1]?.replace('jpeg','jpg') || 'webp';
    const path = `${folder}/${visitor()}/${crypto.randomUUID()}.${extension}`;
    const {error} = await supabase().storage.from('hitokoto-media').upload(path,blob,{contentType:blob.type,upsert:false});
    if (error) throw error;
    return supabase().storage.from('hitokoto-media').getPublicUrl(path).data.publicUrl;
  }

  async function handleRemote(url,method,options) {
    if (url.pathname === '/api/profile' && method === 'GET') {
      const profile = await remoteProfile();
      return profile ? json(profile) : null;
    }
    if (!remoteReady) return null;
    if (url.pathname === '/api/profile' && method === 'PUT') {
      if (!ownerRequest(options)) return json({error:'プロフィールを変更するには投稿者としてログインしてください'},401);
      const body = JSON.parse(options.body || '{}');
      const profile = {name:String(body.name || '').trim(),handle:String(body.handle || '').trim().replace(/^@/,''),avatar:await uploadMedia(body.avatar || defaultProfile.avatar,'avatars'),updated_at:new Date().toISOString()};
      if (!profile.name || profile.name.length > 30) return json({error:'名前は1〜30文字で入力してください'},400);
      if (!/^[A-Za-z0-9_]{1,30}$/.test(profile.handle)) return json({error:'ユーザー名は半角英数字と_で入力してください'},400);
      const {data,error} = await supabase().from('site_profile').update(profile).eq('id',true).select('name,handle,avatar').single();
      if (error) throw error;
      return json(data);
    }
    if (url.pathname === '/api/posts' && method === 'GET') return json(await remotePosts());
    if (url.pathname === '/api/posts' && method === 'POST') {
      if (!ownerRequest(options)) return json({error:'投稿するには投稿者としてログインしてください'},401);
      const body = JSON.parse(options.body || '{}'), text = String(body.text || '').trim(), sourceImages = Array.isArray(body.images) ? body.images : [];
      if ((!text && !sourceImages.length) || text.length > 500 || sourceImages.length > 4) return json({error:'画像かつぶやきを入力してください（500文字・画像4枚まで）'},400);
      const images = [];
      for (const image of sourceImages) images.push(await uploadMedia(image,'posts'));
      const {data,error} = await supabase().from('posts').insert({text,images,author_id:visitor()}).select('id,text,images,created_at').single();
      if (error) throw error;
      return json({id:data.id,text:data.text,images:data.images || [],createdAt:data.created_at,likes:0,liked:false,reactions:[]},201);
    }
    const reaction = url.pathname.match(/^\/api\/posts\/([^/]+)\/(like|reactions)$/);
    if (reaction && method === 'POST') {
      const postId = decodeURIComponent(reaction[1]);
      const emoji = reaction[2] === 'like' ? '❤️' : JSON.parse(options.body || '{}').emoji;
      if (!allowedEmoji.includes(emoji)) return json({error:'リアクションを選んでください'},400);
      const query = supabase().from('reactions').select('post_id').eq('post_id',postId).eq('user_id',visitor()).eq('emoji',emoji).maybeSingle();
      const {data:existing,error:lookupError} = await query;
      if (lookupError) throw lookupError;
      const result = existing
        ? await supabase().from('reactions').delete().eq('post_id',postId).eq('user_id',visitor()).eq('emoji',emoji)
        : await supabase().from('reactions').insert({post_id:postId,user_id:visitor(),emoji});
      if (result.error) throw result.error;
      const posts = await remotePosts();
      const post = posts.find(item => item.id === postId);
      return post ? json(post) : json({error:'投稿が見つかりません'},404);
    }
    const deletion = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (deletion && method === 'DELETE') {
      if (!ownerRequest(options)) return json({error:'削除するには投稿者としてログインしてください'},401);
      const {error} = await supabase().from('posts').delete().eq('id',decodeURIComponent(deletion[1]));
      if (error) throw error;
      return json({ok:true});
    }
    return null;
  }

  async function handleLocal(url,method,options) {
    if (url.pathname === '/api/profile' && method === 'GET') return json(localProfile());
    if (url.pathname === '/api/profile' && method === 'PUT') {
      if (!ownerRequest(options)) return json({error:'プロフィールを変更するには投稿者としてログインしてください'},401);
      const body = JSON.parse(options.body || '{}'), name = String(body.name || '').trim(), handle = String(body.handle || '').trim().replace(/^@/,''), avatar = body.avatar || localProfile().avatar;
      if (!name || name.length > 30) return json({error:'名前は1〜30文字で入力してください'},400);
      if (!/^[A-Za-z0-9_]{1,30}$/.test(handle)) return json({error:'ユーザー名は半角英数字と_で入力してください'},400);
      if (avatar !== defaultProfile.avatar && (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatar) || avatar.length > 2_700_000)) return json({error:'アイコン画像を確認してください'},400);
      const profile = {name,handle,avatar}; localStorage.setItem(profileKey,JSON.stringify(profile)); return json(profile);
    }
    if (url.pathname === '/api/posts' && method === 'GET') return json(localPosts().map(publicLocalPost));
    if (url.pathname === '/api/posts' && method === 'POST') {
      if (!ownerRequest(options)) return json({error:'投稿するには投稿者としてログインしてください'},401);
      const body = JSON.parse(options.body || '{}');
      const post = {id:crypto.randomUUID(),text:String(body.text || '').trim(),images:Array.isArray(body.images) ? body.images : [],createdAt:new Date().toISOString(),likedBy:[],reactions:{}};
      if ((!post.text && !post.images.length) || post.text.length > 500) return json({error:'画像かつぶやきを入力してください（500文字まで）'},400);
      const posts = localPosts(); posts.unshift(post); saveLocalPosts(posts); return json(publicLocalPost(post),201);
    }
    const reaction = url.pathname.match(/^\/api\/posts\/([^/]+)\/(like|reactions)$/);
    if (reaction && method === 'POST') {
      const emoji = reaction[2] === 'like' ? '❤️' : JSON.parse(options.body || '{}').emoji;
      if (!allowedEmoji.includes(emoji)) return json({error:'リアクションを選んでください'},400);
      const posts = localPosts(), post = posts.find(item => item.id === decodeURIComponent(reaction[1]));
      if (!post) return json({error:'投稿が見つかりません'},404);
      post.likedBy ||= []; post.reactions ||= {};
      const users = emoji === '❤️' ? post.likedBy : (post.reactions[emoji] ||= []), id = visitor(), index = users.indexOf(id);
      index >= 0 ? users.splice(index,1) : users.push(id); saveLocalPosts(posts); return json(publicLocalPost(post));
    }
    const deletion = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
    if (deletion && method === 'DELETE') {
      if (!ownerRequest(options)) return json({error:'削除するには投稿者としてログインしてください'},401);
      const posts = localPosts(), next = posts.filter(post => post.id !== decodeURIComponent(deletion[1]));
      if (next.length === posts.length) return json({error:'投稿が見つかりません'},404);
      saveLocalPosts(next); return json({ok:true});
    }
    return json({error:'Not found'},404);
  }

  window.fetch = async (input,options={}) => {
    const url = new URL(typeof input === 'string' ? input : input.url,location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input,options);
    const method = (options.method || 'GET').toUpperCase();
    if (url.pathname === '/api/owner/check' && method === 'POST') return ownerRequest(options) ? json({ok:true}) : json({error:'投稿者のメールアドレスではありません'},401);
    try {
      const remote = await handleRemote(url,method,options);
      if (remote) return remote;
      return handleLocal(url,method,options);
    } catch (error) {
      console.error(error);
      return json({error:error.message || 'データを同期できませんでした'},500);
    }
  };
})();

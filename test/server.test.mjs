import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../server.mjs";

async function startApp() {
  const directory = await mkdtemp(join(tmpdir(), "aikozin-test-"));
  const server = createServer(createApp({ dataFile: join(directory, "posts.json"), ownerPassword: "test-pass" }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  return { baseUrl: `http://127.0.0.1:${address.port}`, close: () => new Promise(resolve => server.close(resolve)) };
}

test("owner can post, readers can like, and comments do not exist", async t => {
  const app = await startApp(); t.after(app.close);
  const unauthorized = await fetch(`${app.baseUrl}/api/posts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "秘密" }) });
  assert.equal(unauthorized.status, 401);
  const createdResponse = await fetch(`${app.baseUrl}/api/posts`, { method: "POST", headers: { "content-type": "application/json", "x-owner-password": "test-pass" }, body: JSON.stringify({ text: "はじめての投稿" }) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json(); assert.equal(created.text, "はじめての投稿");
  const likedResponse = await fetch(`${app.baseUrl}/api/posts/${created.id}/like`, { method: "POST" });
  assert.equal(likedResponse.status, 200);
  const liked = await likedResponse.json(); assert.equal(liked.likes, 1); assert.equal(liked.liked, true); assert.match(likedResponse.headers.get("set-cookie"), /visitor_id=/);
  const commentResponse = await fetch(`${app.baseUrl}/api/posts/${created.id}/comments`, { method: "POST" }); assert.equal(commentResponse.status, 404);
});

test("public page and health check are available", async t => {
  const app = await startApp(); t.after(app.close);
  const [page, health] = await Promise.all([fetch(`${app.baseUrl}/`), fetch(`${app.baseUrl}/api/health`)]);
  assert.equal(page.status, 200); assert.match(await page.text(), /ひとこと/); assert.deepEqual(await health.json(), { status: "ok" });
});

const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5h8AAAAASUVORK5CYII=';
const ownerHeaders = { 'content-type':'application/json', 'x-owner-password':'test-pass' };

test('owner can post images without text; image validation and authentication protect uploads', async t => {
  const app = await startApp(); t.after(app.close);
  const post = body => fetch(`${app.baseUrl}/api/posts`, { method:'POST', headers:ownerHeaders, body:JSON.stringify(body) });
  const created = await post({ text:'', images:[tinyPng] });
  assert.equal(created.status,201); const saved = await created.json(); assert.deepEqual(saved.images,[tinyPng]);
  const listed = await (await fetch(`${app.baseUrl}/api/posts`)).json();
  assert.deepEqual(listed.find(item => item.id === saved.id).images,[tinyPng]);
  for (const images of [[tinyPng,tinyPng,tinyPng,tinyPng,tinyPng],['data:image/svg+xml;base64,PHN2Zz4='],['data:image/png;base64,ZmFrZQ=='],['https://example.com/photo.png']]) {
    assert.equal((await post({ text:'test',images })).status,400);
  }
  assert.equal((await post({ text:'', images:[] })).status,400);
  assert.equal((await post({ text:'x'.repeat(501) })).status,400);
  assert.equal((await fetch(`${app.baseUrl}/api/posts`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ images:[tinyPng] }) })).status,401);
});

test('profile is public, owner-editable, and persisted for visitors', async t => {
  const app = await startApp(); t.after(app.close);
  const initial = await (await fetch(`${app.baseUrl}/api/profile`)).json();
  assert.deepEqual(initial,{name:'とうま',handle:'touma816'});
  const unauthorized = await fetch(`${app.baseUrl}/api/profile`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({name:'別の人',handle:'other'})});
  assert.equal(unauthorized.status,401);
  const updatedResponse = await fetch(`${app.baseUrl}/api/profile`,{method:'PUT',headers:ownerHeaders,body:JSON.stringify({name:'とうまさん',handle:'touma_816'})});
  assert.equal(updatedResponse.status,200);
  assert.deepEqual(await updatedResponse.json(),{name:'とうまさん',handle:'touma_816'});
  assert.deepEqual(await (await fetch(`${app.baseUrl}/api/profile`)).json(),{name:'とうまさん',handle:'touma_816'});
  assert.equal((await fetch(`${app.baseUrl}/api/profile`,{method:'PUT',headers:ownerHeaders,body:JSON.stringify({name:'',handle:'bad-handle'})})).status,400);
});

test('reactions are per visitor, toggle independently, and persist across requests', async t => {
  const app = await startApp(); t.after(app.close);
  const created = await (await fetch(`${app.baseUrl}/api/posts`, { method:'POST', headers:ownerHeaders, body:JSON.stringify({ text:'リアクションのテスト' }) })).json();
  const first = await fetch(`${app.baseUrl}/api/posts`);
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const react = (emoji, visitorCookie = cookie) => fetch(`${app.baseUrl}/api/posts/${created.id}/reactions`, { method:'POST', headers:{'content-type':'application/json', cookie:visitorCookie}, body:JSON.stringify({emoji}) });
  const added = await (await react('👏')).json(); assert.deepEqual(added.reactions,[{emoji:'👏',count:1,reacted:true}]);
  await react('❤️');
  const other = await fetch(`${app.baseUrl}/api/posts`); const otherCookie = other.headers.get('set-cookie').split(';')[0];
  const twoPeople = await (await react('👏',otherCookie)).json(); assert.equal(twoPeople.reactions.find(item => item.emoji==='👏').count,2);
  const removed = await (await react('👏')).json(); assert.equal(removed.reactions.find(item=>item.emoji==='👏').count,1); assert.equal(removed.reactions.find(item=>item.emoji==='👏').reacted,false); assert.equal(removed.liked,true);
  const persisted = (await (await fetch(`${app.baseUrl}/api/posts`,{headers:{cookie}})).json()).find(item=>item.id===created.id);
  assert.deepEqual(persisted.reactions,removed.reactions); assert.equal('likedBy' in persisted,false);
  assert.equal((await react('invalid')).status,400);
  assert.equal((await fetch(`${app.baseUrl}/api/posts/${created.id}/comments`,{method:'POST'})).status,404);
  assert.equal((await fetch(`${app.baseUrl}/api/posts/${created.id}`,{method:'DELETE'})).status,401);
});

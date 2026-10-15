import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const rootDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(rootDir, "public");
const seedPeople = count => Array.from({ length: count }, (_, i) => `seed-${i}`);
const seedPosts = [
  { id: "first-coffee", text: "朝のコーヒー、やっぱり最高だなあ。\n湯気の向こうで、今日もいい日になりそう ☕", images: ["/assets/coffee.webp"], createdAt: new Date(Date.now() - 3 * 3600000).toISOString(), likedBy: seedPeople(12), reactions: { "😂": seedPeople(4), "👏": seedPeople(8) } },
  { id: "autumn-walk", text: "近所の散歩で、秋を見つけた。", images: ["/assets/autumn.webp"], createdAt: new Date(Date.now() - 6 * 3600000).toISOString(), likedBy: seedPeople(12), reactions: { "😂": seedPeople(4), "👏": seedPeople(8) } }
];
export const allowedEmoji = ["❤️", "😂", "👏", "😭", "😮", "😄", "👍", "✨", "💖", "🎉", "🤔", "😌", "👀", "🔥", "🥹", "💜", "☕", "🍁", "🌱"];
const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".woff2": "font/woff2" };

function sendJson(res, status, value, headers = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(value));
}

function publicPost(post, visitorId) {
  const groups = { "❤️": post.likedBy || [], ...(post.reactions || {}) };
  const reactions = Object.entries(groups).filter(([, people]) => people.length).map(([emoji, people]) => ({ emoji, count: people.length, reacted: Boolean(visitorId && people.includes(visitorId)) }));
  return { id: post.id, text: post.text, images: post.images || [], createdAt: post.createdAt, likes: groups["❤️"].length, liked: Boolean(visitorId && groups["❤️"].includes(visitorId)), reactions };
}

async function parseBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 12_000_000) throw new Error("body_too_large");
  }
  return JSON.parse(body || "{}");
}

function validateImages(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 4) throw new RangeError("画像は4枚まで添付できます");
  return value.map(image => {
    if (typeof image !== "string") throw new RangeError("画像の形式を確認してください");
    const match = image.match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!match) throw new RangeError("JPEG・PNG・WebP・GIFの画像を選んでください");
    const bytes = Buffer.from(match[2], "base64");
    if (!bytes.length || bytes.length > 2_000_000) throw new RangeError("画像は1枚2MB以下にしてください");
    const valid = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
      : match[1] === "gif" ? /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))
      : bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    if (!valid) throw new RangeError("画像ファイルを確認してください");
    return image;
  });
}

function getCookie(req, key) {
  for (const item of (req.headers.cookie || "").split(";")) {
    const [name, ...rest] = item.trim().split("=");
    if (name === key) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export function createApp({ dataFile = process.env.DATA_FILE || join(rootDir, "data", "posts.json"), ownerPassword = process.env.OWNER_PASSWORD || "" } = {}) {
  let updateQueue = Promise.resolve();
  async function readPosts() {
    try {
      const data = JSON.parse(await readFile(dataFile, "utf8"));
      return Array.isArray(data.posts) ? data.posts : [];
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return structuredClone(seedPosts);
    }
  }
  async function savePosts(posts) {
    await mkdir(dirname(dataFile), { recursive: true });
    const tempFile = `${dataFile}.${process.pid}.tmp`;
    await writeFile(tempFile, JSON.stringify({ posts }, null, 2));
    await rename(tempFile, dataFile);
  }
  function updatePosts(change) {
    const task = updateQueue.then(async () => {
      const posts = await readPosts();
      const result = await change(posts);
      await savePosts(posts);
      return result;
    });
    updateQueue = task.catch(() => {});
    return task;
  }
  const isOwner = req => Boolean(ownerPassword) && req.headers["x-owner-password"] === ownerPassword;

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      const visitorId = getCookie(req, "visitor_id") || randomUUID();
      const visitorHeaders = getCookie(req, "visitor_id") ? {} : { "set-cookie": `visitor_id=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly` };
      if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { status: "ok" });
      if (req.method === "POST" && url.pathname === "/api/owner/check") {
        return isOwner(req) ? sendJson(res, 200, { ok: true }) : sendJson(res, 401, { error: "パスワードが違います" });
      }
      if (req.method === "GET" && url.pathname === "/api/posts") {
        return sendJson(res, 200, (await readPosts()).map(post => publicPost(post, visitorId)), visitorHeaders);
      }
      if (req.method === "POST" && url.pathname === "/api/posts") {
        if (!ownerPassword) return sendJson(res, 503, { error: "投稿用パスワードが設定されていません" });
        if (!isOwner(req)) return sendJson(res, 401, { error: "投稿するにはログインしてください" });
        const body = await parseBody(req);
        const text = typeof body.text === "string" ? body.text.trim() : "";
        const images = validateImages(body.images);
        if ((!text && !images.length) || text.length > 280) return sendJson(res, 400, { error: "画像かつぶやきを入力してください（280文字まで）" });
        const post = { id: randomUUID(), text, images, createdAt: new Date().toISOString(), likedBy: [], reactions: {} };
        await updatePosts(posts => posts.unshift(post));
        return sendJson(res, 201, publicPost(post, visitorId));
      }
      const likeMatch = url.pathname.match(/^\/api\/posts\/([^/]+)\/(like|reactions)$/);
      if (req.method === "POST" && likeMatch) {
        const id = decodeURIComponent(likeMatch[1]);
        const emoji = likeMatch[2] === "like" ? "❤️" : (await parseBody(req)).emoji;
        if (!allowedEmoji.includes(emoji)) return sendJson(res, 400, { error: "リアクションを選んでください" });
        const result = await updatePosts(posts => {
          const post = posts.find(item => item.id === id);
          if (!post) return null;
          post.likedBy ||= [];
          post.reactions ||= {};
          const people = emoji === "❤️" ? post.likedBy : (post.reactions[emoji] ||= []);
          const index = people.indexOf(visitorId);
          if (index >= 0) people.splice(index, 1); else people.push(visitorId);
          return publicPost(post, visitorId);
        });
        if (!result) return sendJson(res, 404, { error: "投稿が見つかりません" });
        return sendJson(res, 200, result, visitorHeaders);
      }
      const deleteMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/);
      if (req.method === "DELETE" && deleteMatch) {
        if (!isOwner(req)) return sendJson(res, 401, { error: "削除するにはログインしてください" });
        const id = decodeURIComponent(deleteMatch[1]);
        const removed = await updatePosts(posts => {
          const index = posts.findIndex(item => item.id === id);
          if (index < 0) return false;
          posts.splice(index, 1);
          return true;
        });
        return removed ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: "投稿が見つかりません" });
      }
      if (req.method !== "GET" && req.method !== "HEAD") return sendJson(res, 404, { error: "Not found" });
      const routePath = ["/", "/owner", "/owner.html"].includes(url.pathname) ? "/index.html" : url.pathname;
      const requestedFile = resolve(publicDir, `.${routePath}`);
      if (!requestedFile.startsWith(`${publicDir}${sep}`)) return sendJson(res, 403, { error: "Forbidden" });
      try {
        const file = await readFile(requestedFile);
        res.writeHead(200, { "content-type": mimeTypes[extname(requestedFile)] || "application/octet-stream", "x-content-type-options": "nosniff" });
        return res.end(req.method === "HEAD" ? undefined : file);
      } catch (error) {
        if (error.code === "ENOENT") return sendJson(res, 404, { error: "Not found" });
        throw error;
      }
    } catch (error) {
      const status = error.message === "body_too_large" ? 413 : error instanceof SyntaxError || error instanceof RangeError ? 400 : 500;
      if (status === 500) console.error(error);
      return sendJson(res, status, { error: status === 500 ? "サーバーで問題が起きました" : error instanceof RangeError ? error.message : "送信内容を確認してください" });
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const portFlag = process.argv.indexOf("--port");
  const port = Number(portFlag >= 0 ? process.argv[portFlag + 1] : process.env.PORT || 3000);
  createServer(createApp()).listen(port, "0.0.0.0", () => console.log(`AIkozin is running at http://localhost:${port}`));
}

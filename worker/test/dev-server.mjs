// Servidor LOCAL de desenvolvimento: site + Worker (código real) + Resend SIMULADO.
//   node worker/test/dev-server.mjs          ->  abra http://localhost:8080
// Nenhum e-mail real é enviado e nenhuma chave real é usada. Os e-mails "enviados" ficam em
//   http://localhost:8787/__emails
// Para simular falhas do Resend:  http://localhost:8787/__mode?m=ok|fail422|fail500|network|slow
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handle, _resetRateLimit } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SITE_PORT = Number(process.env.SITE_PORT || 8080);
const WORKER_PORT = Number(process.env.WORKER_PORT || 8787);
const EXTRA_SITE_PORT = process.env.EXTRA_SITE_PORT ? Number(process.env.EXTRA_SITE_PORT) : 0; // p/ testar origem não autorizada

const env = {
  ALLOWED_ORIGIN: `http://localhost:${SITE_PORT}`,
  BETEL_DESTINATION_EMAIL: "destino-de-teste@example.com",
  RESEND_API_KEY: "re_SIMULADA_NAO_E_UMA_CHAVE_REAL",
  RESEND_FROM: "Betel Site <onboarding@resend.dev>",
};

let mode = "ok";
const emails = [];
async function mockResend(url, init) {
  if (!String(url).startsWith("https://api.resend.com/")) throw new Error("URL inesperada: " + url);
  emails.push({ at: new Date().toISOString(), headers: { ...init.headers, Authorization: "(oculto)" }, body: JSON.parse(init.body) });
  if (mode === "network") throw new TypeError("fetch failed");
  if (mode === "slow") await new Promise((r) => setTimeout(r, 1500));
  if (mode === "fail422") return new Response(JSON.stringify({ name: "validation_error", message: "simulado" }), { status: 422 });
  if (mode === "fail500") return new Response(JSON.stringify({ name: "application_error", message: "simulado" }), { status: 500 });
  return new Response(JSON.stringify({ id: "em_simulado_" + emails.length }), { status: 200 });
}

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".md": "text/plain" };
function siteServer(port) {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p === "/") p = "/index.html";
    const file = path.join(root, p);
    if (!file.startsWith(root) || p.startsWith("/worker") || p.startsWith("/.git")) { res.writeHead(404); return res.end("404"); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); return res.end("404"); }
      if (p === "/js/config.js") buf = Buffer.from(String(buf).replace(/formEndpoint:\s*"[^"]*"/, `formEndpoint: "http://localhost:${WORKER_PORT}"`)); // só em memória
      res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
      res.end(buf);
    });
  }).listen(port, () => console.log(`site:   http://localhost:${port}`));
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${WORKER_PORT}`);
  if (url.pathname === "/__mode") { mode = url.searchParams.get("m") || "ok"; res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); return res.end("mode=" + mode); }
  if (url.pathname === "/__emails") { res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); return res.end(JSON.stringify(emails, null, 2)); }
  if (url.pathname === "/__reset") { emails.length = 0; mode = "ok"; _resetRateLimit(); res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); return res.end("reset"); }
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(",") : v);
  if (!headers.get("cf-connecting-ip")) headers.set("CF-Connecting-IP", req.socket.remoteAddress || "unknown");
  const request = new Request(`http://localhost:${WORKER_PORT}${req.url}`, { method: req.method, headers, body: ["GET", "HEAD", "OPTIONS"].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const r = await handle(request, env, { fetch: mockResend });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(WORKER_PORT, () => console.log(`worker: http://localhost:${WORKER_PORT}  (Resend SIMULADO)`));

siteServer(SITE_PORT);
if (EXTRA_SITE_PORT) siteServer(EXTRA_SITE_PORT);

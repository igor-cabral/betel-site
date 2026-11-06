// Worker "defeituoso" de teste: aceita o POST e responde 200, mas SEM Access-Control-Allow-Origin na resposta do POST
// (o pré-voo OPTIONS está correto). O servidor "processou" o contato; o navegador é que não pode ler a resposta.
import http from "node:http";
let posts = 0;
http.createServer((req, res) => {
  const o = "http://localhost:8080";
  if (req.url === "/__count") { res.writeHead(200, { "Access-Control-Allow-Origin": "*" }); return res.end(String(posts)); }
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST" }); return res.end(); }
  req.resume(); req.on("end", () => { posts++; res.writeHead(200, { "Content-Type": "application/json" }); res.end('{"ok":true,"id":"em_x"}'); });
}).listen(8788);

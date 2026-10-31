// Testes do Worker (Node >= 18):  node --test worker/test/worker.test.mjs
// O Resend é SIMULADO: nenhum e-mail real é enviado e nenhuma chave real é usada.
import test from "node:test";
import assert from "node:assert/strict";
import { handle, validate, _resetRateLimit, INTERESTS, LIMITS } from "../src/index.js";

const ORIGIN = "https://betel.igorcabral.dev.br";
const env = {
  ALLOWED_ORIGIN: ORIGIN,
  BETEL_DESTINATION_EMAIL: "teste@example.com",
  RESEND_API_KEY: "re_FAKE_KEY_FOR_TESTS",
  RESEND_FROM: "Betel Site <onboarding@resend.dev>",
};
const valid = () => ({
  nome: "Maria da Silva", telefone: "(47) 99999-1234", email: "maria@example.com",
  interesse: INTERESTS["palazzo-di-fatima"], interesse_id: "palazzo-di-fatima",
  mensagem: "Quero saber sobre as unidades de 2 dormitórios.", origem: "index.html",
  website: "", elapsed_ms: 9000, submission_id: "b3f1c2d4-1111-4222-8333-abcdefabcdef",
});
const req = (body, { origin = ORIGIN, method = "POST", type = "application/json", raw, ip = "203.0.113.7" } = {}) =>
  new Request("https://worker.example/", {
    method,
    headers: { ...(origin ? { Origin: origin } : {}), ...(type ? { "Content-Type": type } : {}), "CF-Connecting-IP": ip },
    body: method === "POST" ? (raw ?? JSON.stringify(body)) : undefined,
  });
const resendOk = () => { const calls = []; const f = async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify({ id: "em_123" }), { status: 200 }); }; f.calls = calls; return f; };
const resendStatus = (status, body = { name: "validation_error", message: "x" }) => async () => new Response(JSON.stringify(body), { status });

test.beforeEach(() => _resetRateLimit());

test("1. envio válido: 200 ok e e-mail montado com todos os campos", async () => {
  const f = resendOk();
  const res = await handle(req(valid()), env, { fetch: f, now: () => new Date("2026-10-30T15:30:00Z") });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, id: "em_123" });
  assert.equal(f.calls.length, 1);
  const { url, init } = f.calls[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(init.headers.Authorization, "Bearer re_FAKE_KEY_FOR_TESTS");
  assert.ok(init.headers["Idempotency-Key"].startsWith("betel-"));
  const p = JSON.parse(init.body);
  assert.deepEqual(p.to, ["teste@example.com"]);
  assert.equal(p.from, env.RESEND_FROM);
  assert.equal(p.reply_to, "maria@example.com");
  assert.match(p.subject, /Novo contato pelo site — Palazzo Di Fatima Residence — Maria da Silva/);
  for (const t of ["Maria da Silva", "(47) 99999-1234", "maria@example.com", "Palazzo Di Fatima Residence", "unidades de 2 dormitórios", "30/10/2026", "12:30:00", "index.html", ORIGIN]) {
    assert.ok(p.html.includes(t), `HTML deve conter: ${t}`);
    assert.ok(p.text.includes(t), `texto deve conter: ${t}`);
  }
  assert.ok(p.html.includes("https://wa.me/5547999991234"));
});

test("2. campos obrigatórios vazios: 400 com erros por campo e nenhuma chamada ao Resend", async () => {
  const f = resendOk();
  const res = await handle(req({ ...valid(), nome: "", telefone: "", interesse: "", interesse_id: "" }), env, { fetch: f });
  assert.equal(res.status, 400);
  const j = await res.json();
  assert.equal(j.code, "validation");
  assert.ok(j.errors.nome && j.errors.telefone && j.errors.interesse);
  assert.equal(f.calls.length, 0);
});

test("3. e-mail inválido: 400; e-mail vazio é permitido (campo opcional)", async () => {
  for (const email of ["maria@", "maria example.com", "a@b", "x@y.z", "a@b.com, c@d.com"]) {
    const res = await handle(req({ ...valid(), email }), env, { fetch: resendOk() });
    assert.equal(res.status, 400, email);
    assert.ok((await res.json()).errors.email);
  }
  const f = resendOk();
  const ok = await handle(req({ ...valid(), email: "" }), env, { fetch: f });
  assert.equal(ok.status, 200);
  assert.equal("reply_to" in JSON.parse(f.calls[0].init.body), false);
});

test("4. telefone inválido: 400", async () => {
  for (const telefone of ["123", "00 99999-1234", "(47) 89999-1234", "(47) 9999-12", "abcdefghijk", "(10) 99999-1234"]) {
    const res = await handle(req({ ...valid(), telefone }), env, { fetch: resendOk() });
    assert.equal(res.status, 400, telefone);
    assert.ok((await res.json()).errors.telefone, telefone);
  }
  for (const telefone of ["47999991234", "(47) 3333-1234", "+55 47 99999-1234"]) {
    const res = await handle(req({ ...valid(), telefone }), env, { fetch: resendOk() });
    assert.equal(res.status, 200, telefone);
  }
});

test("5. mensagem muito extensa: 400 (>1000) e 413 (corpo >8 KB)", async () => {
  let res = await handle(req({ ...valid(), mensagem: "a".repeat(1001) }), env, { fetch: resendOk() });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.mensagem);
  res = await handle(req({ ...valid(), mensagem: "a".repeat(1000) }), env, { fetch: resendOk() });
  assert.equal(res.status, 200);
  res = await handle(req({ ...valid(), mensagem: "a".repeat(9000) }), env, { fetch: resendOk() });
  assert.equal(res.status, 413);
});

test("6. envio duplicado: mesma tentativa envia Idempotency-Key igual; limite por IP bloqueia excesso (429)", async () => {
  const f = resendOk();
  await handle(req(valid()), env, { fetch: f });
  await handle(req(valid()), env, { fetch: f });
  assert.equal(f.calls[0].init.headers["Idempotency-Key"], f.calls[1].init.headers["Idempotency-Key"]);
  _resetRateLimit();
  const statuses = [];
  for (let i = 0; i < 7; i++) statuses.push((await handle(req(valid()), env, { fetch: resendOk() })).status);
  assert.deepEqual(statuses, [200, 200, 200, 200, 200, 429, 429]);
  const other = await handle(req(valid(), { ip: "198.51.100.9" }), env, { fetch: resendOk() });
  assert.equal(other.status, 200); // outro IP não é afetado
});

test("6b. envio inválido não consome o limite por IP", async () => {
  for (let i = 0; i < 8; i++) await handle(req({ ...valid(), telefone: "1" }), env, { fetch: resendOk() });
  assert.equal((await handle(req(valid()), env, { fetch: resendOk() })).status, 200);
});

test("7. erro do Resend (422, 401, 429, 500, corpo não JSON, rede, timeout): 502 e NUNCA ok:true", async () => {
  for (const status of [422, 401, 429, 500]) {
    _resetRateLimit();
    const res = await handle(req(valid()), env, { fetch: resendStatus(status) });
    assert.equal(res.status, 502, `status ${status}`);
    const j = await res.json();
    assert.equal(j.ok, false);
    assert.equal(j.code, "email_failed");
    assert.ok(!JSON.stringify(j).includes("re_FAKE"));
  }
  _resetRateLimit();
  let res = await handle(req(valid()), env, { fetch: async () => new Response("<html>oops</html>", { status: 200 }) });
  assert.equal(res.status, 502); // 200 sem id não é "aceito"
  _resetRateLimit();
  res = await handle(req(valid()), env, { fetch: async () => { throw new TypeError("fetch failed"); } });
  assert.equal(res.status, 502);
  _resetRateLimit();
  const prev = LIMITS.resendTimeoutMs; LIMITS.resendTimeoutMs = 40; // simula timeout do Resend
  try {
    res = await handle(req(valid()), env, { fetch: (u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("abort"), { name: "AbortError" })))) });
    assert.equal(res.status, 502);
    assert.equal((await res.json()).ok, false);
  } finally { LIMITS.resendTimeoutMs = prev; }
});

test("8. origem não autorizada: 403 sem cabeçalhos CORS; pré-voo OPTIONS correto só para a origem oficial", async () => {
  const f = resendOk();
  for (const origin of ["https://evil.example", "http://betel.igorcabral.dev.br", "https://betel.igorcabral.dev.br.evil.com", null]) {
    const res = await handle(req(valid(), { origin }), env, { fetch: f });
    assert.equal(res.status, 403, String(origin));
    assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
  }
  assert.equal(f.calls.length, 0);
  const pre = await handle(req(null, { method: "OPTIONS" }), env, { fetch: f });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.match(pre.headers.get("Access-Control-Allow-Headers"), /Content-Type/);
  const preBad = await handle(req(null, { method: "OPTIONS", origin: "https://evil.example" }), env, { fetch: f });
  assert.equal(preBad.status, 403);
  const ok = await handle(req(valid()), env, { fetch: resendOk() });
  assert.equal(ok.headers.get("Access-Control-Allow-Origin"), ORIGIN);
});

test("9. robustez: JSON inválido, tipo errado, método errado, honeypot, envio rápido demais, config ausente", async () => {
  let res = await handle(req(null, { raw: "{nao-e-json" }), env, { fetch: resendOk() });
  assert.equal(res.status, 400); assert.equal((await res.json()).code, "bad_json");
  res = await handle(req(valid(), { type: "text/plain" }), env, { fetch: resendOk() });
  assert.equal(res.status, 415);
  res = await handle(new Request("https://w/", { method: "GET", headers: { Origin: ORIGIN } }), env, { fetch: resendOk() });
  assert.equal(res.status, 405);
  const f = resendOk();
  res = await handle(req({ ...valid(), website: "http://spam.example" }), env, { fetch: f });
  assert.equal(res.status, 200); assert.equal(f.calls.length, 0); // robô: descartado sem enviar e-mail
  res = await handle(req({ ...valid(), elapsed_ms: 300 }), env, { fetch: f });
  assert.equal(res.status, 400); assert.equal((await res.json()).code, "too_fast");
  res = await handle(req({ ...valid(), elapsed_ms: undefined }), env, { fetch: f });
  assert.equal(res.status, 400);
  res = await handle(req(valid()), { ...env, RESEND_API_KEY: "" }, { fetch: f });
  assert.equal(res.status, 500); assert.equal((await res.json()).code, "config");
  assert.equal(f.calls.length, 0);
});

test("10. segurança do conteúdo: HTML escapado, sem injeção de cabeçalho no assunto, sem dados pessoais nos logs", async () => {
  const logs = [];
  const orig = console.log; console.log = (...a) => logs.push(a.join(" "));
  const f = resendOk();
  try {
    const res = await handle(req({ ...valid(), nome: 'Ana <script>alert(1)</script>\r\nBcc: x@y.com', mensagem: '<img src=x onerror=alert(1)>\nlinha 2' }), env, { fetch: f });
    assert.equal(res.status, 200);
  } finally { console.log = orig; }
  const p = JSON.parse(f.calls[0].init.body);
  assert.ok(!p.html.includes("<script>") && !p.html.includes("<img src=x"));
  assert.ok(p.html.includes("&lt;script&gt;"));
  assert.ok(!/[\r\n]/.test(p.subject));
  assert.ok(p.html.includes("linha 2"));
  const all = logs.join("\n");
  for (const secret of ["Maria", "Ana", "99999", "maria@example.com", "re_FAKE", "203.0.113.7", "alert(1)"]) assert.ok(!all.includes(secret), `log não deve conter: ${secret}`);
  assert.ok(all.includes("resend_accepted"));
});

test("validate(): aceita rótulo antigo (sem interesse_id) e normaliza telefone", () => {
  const r = validate({ nome: "João Souza", telefone: "47 3333 1234", interesse: "Residencial Vivendas do Sul" });
  assert.equal(r.value.interesseId, "vivendas-do-sul");
  assert.equal(r.value.telefone, "(47) 3333-1234");
});

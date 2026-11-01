// Testes da interpretação da resposta do Worker no frontend (js/form-response.js).
//   node --test worker/test/form-response.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import FR from "../../js/form-response.js";

// Monta o objeto que main.js recebe depois de FR.readBody (e testa readBody de verdade com Response).
const read = async (status, body, type = "application/json") =>
  FR.readBody(new Response(body, { status, headers: type ? { "Content-Type": type } : {} }));
const kind = async (status, body, type) => FR.classify(await read(status, body, type)).kind;

test("sucesso: 200 {ok:true,id} (formato do Worker atual)", async () => {
  assert.equal(await kind(200, '{"ok":true,"id":"em_123"}'), "success");
});

test("sucesso: formatos alternativos de um Worker antigo/outro (2xx confirmando o envio)", async () => {
  assert.equal(await kind(200, '{"success":true}'), "success");
  assert.equal(await kind(200, '{"success":true,"id":"abc"}'), "success");
  assert.equal(await kind(201, '{"id":"49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}'), "success"); // resposta crua do Resend
  assert.equal(await kind(202, '{"accepted":true}'), "success");
  assert.equal(await kind(200, '{"sent":true}'), "success");
  assert.equal(await kind(200, '{"status":"ok"}'), "success");
  assert.equal(await kind(200, '{"status":"success","message":"E-mail enviado"}'), "success");
});

test("sucesso 'legado': 2xx sem corpo reconhecível (vazio, texto, JSON sem os campos conhecidos)", async () => {
  for (const [status, body, type] of [[200, "", null], [204, null, null], [200, "OK", "text/plain"], [200, '{"message":"E-mail enviado"}', "application/json"], [200, "[]", "application/json"]]) {
    const out = FR.classify(await read(status, body, type));
    assert.equal(out.kind, "success", `${status} ${body}`);
    assert.equal(out.legacy, true);
  }
});

test("NÃO é sucesso: 2xx que recusa explicitamente ou resposta HTML", async () => {
  assert.equal(await kind(200, '{"ok":false,"code":"email_failed"}'), "server");
  assert.equal(await kind(200, '{"success":false}'), "server");
  assert.equal(await kind(200, '{"error":"falha ao enviar"}'), "server");
  assert.equal(await kind(200, "<html>login</html>", "text/html; charset=utf-8"), "server");
});

test("NÃO é sucesso: qualquer status fora de 2xx (o e-mail não foi enviado)", async () => {
  for (const status of [301, 400, 401, 403, 404, 405, 413, 415, 500, 502, 503]) {
    assert.equal(await kind(status, '{"ok":false}'), "server", String(status));
    assert.equal(await kind(status, '{"ok":true}'), "server", `${status} mesmo com ok:true no corpo`);
  }
});

test("validação, envio rápido e limite de tentativas mantêm os tratamentos próprios", async () => {
  assert.equal(await kind(400, '{"ok":false,"code":"validation","errors":{"nome":"x"}}'), "validation");
  assert.equal(await kind(400, '{"ok":false,"code":"too_fast"}'), "fast");
  assert.equal(await kind(400, '{"ok":false,"code":"bad_json"}'), "server");
  assert.equal(await kind(429, '{"ok":false,"code":"rate_limited"}'), "rate");
});

test("código de suporte traz só status e code do Worker (sem dados pessoais)", async () => {
  const out = FR.classify(await read(502, '{"ok":false,"code":"email_failed","nome":"Maria","email":"m@x.com"}'));
  assert.equal(out.ref, "HTTP 502 · email_failed");
  assert.ok(!/Maria|@/.test(out.ref));
});

test("readBody nunca rejeita por causa do corpo (corpo ilegível, JSON quebrado)", async () => {
  const broken = await read(200, "{nao-e-json");
  assert.equal(broken.json, null);
  assert.equal(FR.classify(broken).kind, "success"); // 2xx sem recusa explícita
  const stream = { status: 200, ok: true, headers: new Headers(), text: () => Promise.reject(new Error("boom")) };
  const res = await FR.readBody(stream);
  assert.deepEqual([res.status, res.text, res.json], [200, "", null]);
});

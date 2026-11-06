/* Betel — interpretação da resposta do Worker do formulário.
 *
 * Contrato: o Worker só responde com status 2xx DEPOIS que o Resend aceitou o e-mail.
 * Qualquer 4xx/5xx significa que o e-mail NÃO foi enviado. O frontend não vê o Resend
 * (a chave fica só no Worker), então a decisão se apoia no status HTTP + corpo da resposta.
 *
 * Regras (em ordem):
 *   1. Status fora de 2xx  -> falha (validação / envio rápido / limite / servidor).
 *   2. 2xx com corpo que RECUSA explicitamente ({ok:false}, {success:false}, {error:"..."}) -> falha.
 *   3. 2xx com corpo HTML (página de erro/login interceptando a requisição) -> falha.
 *   4. 2xx com confirmação ({ok:true}, {success:true}, {sent:true}, {accepted:true}, {status:"ok"}, id do Resend) -> sucesso.
 *   5. Demais 2xx (corpo vazio, texto, JSON sem os campos acima) -> sucesso "legado": o Worker só devolve 2xx
 *      quando o e-mail foi aceito. Fica registrado no console (sem dados pessoais) para facilitar o diagnóstico.
 */
(function (root) {
  "use strict";

  /** Lê o corpo UMA vez, tolerando vazio, texto e HTML. Nunca rejeita por causa do corpo. */
  function readBody(r) {
    var type = (r.headers && r.headers.get && r.headers.get("Content-Type") || "").toLowerCase();
    return r.text().then(
      function (text) {
        var json = null;
        if (text) { try { json = JSON.parse(text); } catch (e) { json = null; } }
        if (json === null || typeof json !== "object" || Array.isArray(json)) json = null;
        return { status: r.status, ok: r.ok, type: type, text: text || "", json: json };
      },
      function () { return { status: r.status, ok: r.ok, type: type, text: "", json: null }; }
    );
  }

  function refOf(res, extra) {
    var code = res.json && typeof res.json.code === "string" ? " · " + res.json.code.slice(0, 40) : "";
    return "HTTP " + res.status + code + (extra ? " · " + extra : "");
  }

  /** @returns {{kind:"success"|"validation"|"fast"|"rate"|"server", ref?:string, legacy?:boolean}} */
  function classify(res) {
    var j = res.json;
    if (!res.ok) {
      if (res.status === 400 && j && j.code === "validation") return { kind: "validation" };
      if (res.status === 400 && j && j.code === "too_fast") return { kind: "fast" };
      if (res.status === 429) return { kind: "rate", ref: refOf(res) };
      return { kind: "server", ref: refOf(res) };
    }
    if (j && (j.ok === false || j.success === false || j.sent === false || j.accepted === false || j.error)) {
      return { kind: "server", ref: refOf(res, "recusado") };
    }
    if (res.type.indexOf("text/html") !== -1) return { kind: "server", ref: refOf(res, "resposta HTML inesperada") };
    if (j && (j.ok === true || j.success === true || j.sent === true || j.accepted === true ||
        typeof j.id === "string" || /^(ok|success|sent|accepted)$/i.test(String(j.status || "")))) {
      return { kind: "success" };
    }
    return { kind: "success", legacy: true, ref: refOf(res, "formato não reconhecido") };
  }

  var api = { readBody: readBody, classify: classify };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BetelFormResponse = api;
})(typeof window !== "undefined" ? window : globalThis);

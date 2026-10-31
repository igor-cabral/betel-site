/**
 * Betel Incorporadora — Worker do formulário de contato (Cloudflare Workers, módulo ES).
 *
 * Fluxo: site (browser) -> este Worker -> API do Resend -> e-mail para a Betel.
 *
 * Variáveis (configuradas no painel do Cloudflare; NADA disso fica no código):
 *   ALLOWED_ORIGIN          Ex.: https://betel.igorcabral.dev.br   (origem única permitida, sem "/" no fim)
 *   BETEL_DESTINATION_EMAIL Quem recebe os contatos. Aceita vários separados por vírgula.
 *   RESEND_API_KEY          SECRET. Nunca é lido em log nem devolvido em resposta.
 *   RESEND_FROM             Ex.: Betel Site <contato@dominio-verificado.com.br>
 * Opcional:
 *   RATE_LIMITER            Binding "ratelimit" do Cloudflare (limite real, compartilhado entre instâncias).
 *
 * Respostas SEMPRE em JSON:
 *   200 {ok:true,id}                    e-mail ACEITO pelo Resend (só neste caso o site mostra sucesso)
 *   400 {ok:false,code,errors?}         validação (bad_json | validation | too_fast)
 *   403 {ok:false,code:"origin"}        origem não autorizada
 *   405 / 413 / 415 / 429               método, tamanho, tipo de conteúdo, excesso de requisições
 *   500 {ok:false,code:"config"}        variável obrigatória ausente
 *   502 {ok:false,code:"email_failed"}  o Resend recusou ou não respondeu (nenhum e-mail foi enviado)
 */

export const INTERESTS = {
  "palazzo-di-fatima": "Palazzo Di Fatima Residence",
  "portal-de-paranagua": "Residencial Portal de Paranaguá",
  "vivendas-do-sul": "Residencial Vivendas do Sul",
  "permuta": "Tenho um terreno (permuta)",
  "outro": "Outro assunto / ainda não sei",
};

export const LIMITS = {
  bodyBytes: 8192,
  nome: 100,
  email: 254,
  mensagem: 1000,
  origem: 100,
  minFillMs: 2500,      // tempo mínimo entre abrir a página e enviar (bots costumam enviar na hora)
  rateMax: 5,           // envios por IP...
  rateWindowMs: 10 * 60 * 1000, // ...a cada 10 minutos (fallback em memória, por instância)
  resendTimeoutMs: 10000,
};

/* ---------- utilidades ---------- */

const oneLine = (s) => String(s ?? "").replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
const multiLine = (s) =>
  String(s ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const trimSlash = (s) => String(s || "").replace(/\/+$/, "");

export function formatPhone(digits) {
  return digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
}

/** Valida e normaliza o corpo. Retorna {errors} ou {value}. */
export function validate(body) {
  const errors = {};
  const nome = oneLine(body.nome);
  if (nome.length < 3 || !/\p{L}/u.test(nome)) errors.nome = "Informe seu nome.";
  else if (nome.length > LIMITS.nome) errors.nome = `O nome pode ter no máximo ${LIMITS.nome} caracteres.`;

  let digits = String(body.telefone ?? "").replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  const okDdd = /^[1-9][1-9]/.test(digits);
  if (!(digits.length === 10 || digits.length === 11) || !okDdd || (digits.length === 11 && digits[2] !== "9"))
    errors.telefone = "Informe um telefone válido com DDD.";

  const email = oneLine(body.email);
  if (email && (email.length > LIMITS.email || !/^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/.test(email)))
    errors.email = "E-mail inválido.";

  let interesseId = typeof body.interesse_id === "string" ? body.interesse_id : "";
  if (!INTERESTS[interesseId]) {
    interesseId = Object.keys(INTERESTS).find((k) => INTERESTS[k] === oneLine(body.interesse)) || "";
  }
  if (!interesseId) errors.interesse = "Escolha uma opção.";

  const mensagem = multiLine(body.mensagem);
  if (mensagem.length > LIMITS.mensagem) errors.mensagem = `A mensagem pode ter no máximo ${LIMITS.mensagem} caracteres.`;

  if (Object.keys(errors).length) return { errors };
  return {
    value: {
      nome, digits, telefone: formatPhone(digits), email, interesseId, interesse: INTERESTS[interesseId], mensagem,
      origem: oneLine(body.origem).slice(0, LIMITS.origem) || "index.html",
    },
  };
}

/* ---------- e-mail ---------- */

export function buildEmail(v, env, now = new Date()) {
  const quando = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "medium" }).format(now);
  const site = trimSlash(env.ALLOWED_ORIGIN);
  const subject = oneLine(`Novo contato pelo site — ${v.interesse} — ${v.nome}`).slice(0, 150);
  const waMsg = `Olá, ${v.nome.split(" ")[0]}! Aqui é da Betel Incorporadora. Recebemos seu contato pelo site sobre: ${v.interesse}.`;
  const waUrl = `https://wa.me/55${v.digits}?text=${encodeURIComponent(waMsg)}`;

  const row = (k, val) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid #e6e2d8;width:140px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b97410;font-weight:700;vertical-align:top">${k}</td>` +
    `<td style="padding:10px 0;border-bottom:1px solid #e6e2d8;font-size:15px;color:#18223d;vertical-align:top">${val}</td></tr>`;

  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f4f1ea;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#0b1f4b;padding:22px 28px;border-bottom:4px solid #f0a63a">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:.18em;color:#ffffff;font-weight:bold">BETEL</div>
<div style="font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#f0a63a;margin-top:4px">Construções inteligentes</div></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#0b1f4b;font-weight:normal">Novo contato pelo site</h1>
<p style="margin:0 0 20px;font-size:14px;color:#5a6580">Interesse: <strong style="color:#0b1f4b">${esc(v.interesse)}</strong></p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${row("Nome", esc(v.nome))}
${row("Telefone", `<a href="tel:+55${v.digits}" style="color:#0b1f4b">${esc(v.telefone)}</a>`)}
${row("E-mail", v.email ? `<a href="mailto:${esc(v.email)}" style="color:#0b1f4b">${esc(v.email)}</a>` : '<span style="color:#8a93aa">não informado</span>')}
${row("Interesse", esc(v.interesse))}
${row("Mensagem", v.mensagem ? esc(v.mensagem).replace(/\n/g, "<br>") : '<span style="color:#8a93aa">sem mensagem</span>')}
${row("Enviado em", esc(quando) + " (Brasília)")}
${row("Origem", `${esc(site)} · página ${esc(v.origem)}`)}
</table>
<p style="margin:26px 0 0"><a href="${waUrl}" style="display:inline-block;background:#f0a63a;color:#061230;text-decoration:none;font-weight:bold;font-size:14px;padding:13px 22px">Responder no WhatsApp</a></p>
</td></tr>
<tr><td style="background:#061230;padding:16px 28px;font-size:12px;color:#aab6d3">Mensagem automática do formulário do site da Betel Incorporadora. O contato autorizou o retorno sobre este assunto.</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    "NOVO CONTATO PELO SITE — BETEL",
    "",
    `Nome: ${v.nome}`,
    `Telefone: ${v.telefone}`,
    `E-mail: ${v.email || "não informado"}`,
    `Interesse: ${v.interesse}`,
    `Mensagem: ${v.mensagem || "sem mensagem"}`,
    `Enviado em: ${quando} (Brasília)`,
    `Origem: ${site} · página ${v.origem}`,
    "",
    `Responder no WhatsApp: ${waUrl}`,
  ].join("\n");

  return { subject, html, text };
}

/* ---------- limite de requisições (fallback em memória; por instância) ---------- */

const hits = new Map();
export function memoryRateLimit(ip, now = Date.now()) {
  const list = (hits.get(ip) || []).filter((t) => now - t < LIMITS.rateWindowMs);
  if (list.length >= LIMITS.rateMax) {
    hits.set(ip, list);
    return { limited: true, retryAfter: Math.ceil((LIMITS.rateWindowMs - (now - list[0])) / 1000) };
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // evita crescer sem limite
  return { limited: false };
}
export function _resetRateLimit() { hits.clear(); }

async function rateLimited(env, ip) {
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === "function") {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return success ? { limited: false } : { limited: true, retryAfter: 60 };
  }
  return memoryRateLimit(ip);
}

/* ---------- handler ---------- */

// Logs estruturados SEM dados pessoais (sem nome, telefone, e-mail, mensagem, IP ou chave).
const log = (event, extra = {}) => console.log(JSON.stringify({ app: "betel-form", event, ...extra }));

export async function handle(request, env, deps = {}) {
  const doFetch = deps.fetch || fetch;
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = trimSlash(env.ALLOWED_ORIGIN);
  const originOk = !!allowedOrigin && origin === allowedOrigin;

  const baseHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (originOk) {
    baseHeaders["Access-Control-Allow-Origin"] = allowedOrigin;
    baseHeaders["Vary"] = "Origin";
  }
  const json = (status, data, extra = {}) =>
    new Response(JSON.stringify(data), { status, headers: { ...baseHeaders, ...extra } });

  // 0) configuração obrigatória
  const missing = ["ALLOWED_ORIGIN", "BETEL_DESTINATION_EMAIL", "RESEND_API_KEY", "RESEND_FROM"].filter((k) => !env[k]);
  if (missing.length) {
    log("config_missing", { vars: missing });
    return json(500, { ok: false, code: "config" });
  }

  // 1) pré-voo CORS
  if (request.method === "OPTIONS") {
    if (!originOk) return json(403, { ok: false, code: "origin" });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
    });
  }
  if (request.method !== "POST") return json(405, { ok: false, code: "method" }, { Allow: "POST, OPTIONS" });

  // 2) origem (CORS sozinho não é proteção: clientes fora do navegador podem forjar o cabeçalho,
  //    por isso há também limite de requisições, honeypot e verificação de tempo abaixo)
  if (!originOk) {
    log("origin_rejected");
    return json(403, { ok: false, code: "origin" });
  }

  // 3) tipo e tamanho
  if (!(request.headers.get("Content-Type") || "").toLowerCase().includes("application/json"))
    return json(415, { ok: false, code: "content_type" });
  const declared = Number(request.headers.get("Content-Length") || 0);
  if (declared > LIMITS.bodyBytes) return json(413, { ok: false, code: "too_large" });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > LIMITS.bodyBytes) return json(413, { ok: false, code: "too_large" });

  // 4) JSON
  let body;
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("shape");
  } catch {
    return json(400, { ok: false, code: "bad_json" });
  }

  // 5) anti-spam: honeypot preenchido = robô (descarta em silêncio); envio rápido demais = pede para tentar de novo
  if (oneLine(body.website)) {
    log("honeypot");
    return json(200, { ok: true });
  }
  const elapsed = Number(body.elapsed_ms);
  if (!Number.isFinite(elapsed) || elapsed < LIMITS.minFillMs) {
    log("too_fast");
    return json(400, { ok: false, code: "too_fast" });
  }

  // 6) validação
  const result = validate(body);
  if (result.errors) return json(400, { ok: false, code: "validation", errors: result.errors });
  const v = result.value;
  // 7b) limite de requisições por IP (só conta envios válidos, para não punir quem erra um campo)
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rl = await rateLimited(env, ip);
  if (rl.limited) {
    log("rate_limited");
    return json(429, { ok: false, code: "rate_limited" }, { "Retry-After": String(rl.retryAfter || 60) });
  }

  log("received", { interesse: v.interesseId });

  // 8) envio pelo Resend (sucesso SOMENTE se o Resend aceitar)
  const mail = buildEmail(v, env, deps.now ? deps.now() : new Date());
  const to = String(env.BETEL_DESTINATION_EMAIL).split(",").map((s) => s.trim()).filter(Boolean);
  const payload = { from: env.RESEND_FROM, to, subject: mail.subject, html: mail.html, text: mail.text };
  if (v.email) payload.reply_to = v.email;

  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" };
  const sid = typeof body.submission_id === "string" ? body.submission_id : "";
  if (/^[0-9a-zA-Z-]{16,64}$/.test(sid)) headers["Idempotency-Key"] = `betel-${sid}`; // reenvio da mesma tentativa não duplica o e-mail

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LIMITS.resendTimeoutMs);
  try {
    const res = await doFetch("https://api.resend.com/emails", { method: "POST", headers, body: JSON.stringify(payload), signal: ctrl.signal });
    let data = null;
    try { data = await res.json(); } catch { /* corpo não JSON */ }
    if (res.ok && data && data.id) {
      log("resend_accepted", { id: data.id });
      return json(200, { ok: true, id: data.id });
    }
    // loga só status e tipo do erro, nunca o corpo completo (pode ecoar dados pessoais)
    log("resend_failed", { status: res.status, name: data && typeof data.name === "string" ? data.name : undefined });
    return json(502, { ok: false, code: "email_failed" });
  } catch (err) {
    log("resend_unreachable", { reason: err && err.name === "AbortError" ? "timeout" : "network" });
    return json(502, { ok: false, code: "email_failed" });
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch {
      log("unhandled_error");
      return new Response(JSON.stringify({ ok: false, code: "internal" }), {
        status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
  },
};

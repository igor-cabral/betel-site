/* Betel Incorporadora — comportamento do site (JS puro, sem dependências) */
(function () {
  var cfg = window.BETEL_CONFIG || {};
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Menu mobile ---------- */
  var toggle = $(".menu-toggle"), nav = $("#nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
  }

  /* ---------- WhatsApp (data-wa="mensagem") ---------- */
  function waUrl(msg) { return "https://wa.me/" + cfg.whatsapp + (msg ? "?text=" + encodeURIComponent(msg) : ""); }
  $$("[data-wa]").forEach(function (a) { a.href = waUrl(a.getAttribute("data-wa")); a.target = "_blank"; a.rel = "noopener"; });
  $$("[data-wa-label]").forEach(function (el) { el.textContent = cfg.whatsappLabel; });

  /* ---------- Cabeçalho, progresso, parallax leve e barra mobile ---------- */
  var header = $(".site-header"), bar = $(".progress"), media = $(".hero-media"), mbar = $(".mbar");
  var heroEl = $(".hero, .p-hero"), contact = $("#contato"), ticking = false;
  var contactVisible = false;
  function frame() {
    var y = window.scrollY || 0;
    var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (header) header.classList.toggle("scrolled", y > 8);
    if (bar) bar.style.setProperty("--p", Math.min(1, y / max).toFixed(4));
    if (media && !reduce && heroEl && y < heroEl.offsetHeight) media.style.transform = "translate3d(0," + Math.min(48, y * 0.1).toFixed(1) + "px,0)";
    if (mbar) mbar.classList.toggle("show", y > window.innerHeight * 0.6 && !contactVisible);
    ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
  window.addEventListener("resize", frame);
  frame();

  /* ---------- Observadores de seção (menu / subnav / barra mobile) ---------- */
  if ("IntersectionObserver" in window) {
    if (contact) {
      new IntersectionObserver(function (en) { contactVisible = en[0].isIntersecting; frame(); }, { threshold: 0.15 }).observe(contact);
    }
    var links = $$('.nav a[href*="#"], .subnav a[href^="#"]');
    var byId = {};
    links.forEach(function (a) { var id = a.getAttribute("href").split("#")[1]; if (id) (byId[id] = byId[id] || []).push(a); });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("active"); });
        (byId[en.target.id] || []).forEach(function (a) { a.classList.add("active"); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) { var s = document.getElementById(id); if (s) so.observe(s); });
  }

  /* ---------- Revelação na rolagem ---------- */
  function splitWords(el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/), frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"), inner = document.createElement("span");
            w.className = "w"; inner.textContent = p; inner.style.setProperty("--i", i++);
            w.appendChild(inner); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(el);
  }
  try {
    if ("IntersectionObserver" in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
      }, { threshold: 0.14, rootMargin: "0px 0px -6% 0px" });
      function mark(sel, cls, stagger) {
        $$(sel).forEach(function (el, k) {
          el.classList.add(cls);
          if (stagger) el.style.setProperty("--d", (Math.min(k, 4) * 0.1) + "s");
          io.observe(el);
        });
      }
      $$("main h2:not(.no-split)").forEach(function (h) { splitWords(h); h.classList.add("sw"); io.observe(h); });
      mark(".dim", "dim-obs");
      $$("[data-stagger]").forEach(function (g) { $$(":scope > *", g).forEach(function (c, k) { c.style.setProperty("--i", k); }); g.classList.add("stagger"); io.observe(g); });
      $$(".imr, .draw, .rv, .colmeia-bg").forEach(function (el) { io.observe(el); });
      $$(".draw").forEach(function (g) { $$("path,line,rect", g).forEach(function (p, k) { p.setAttribute("pathLength", "1"); p.style.setProperty("--i", k); }); });
      document.documentElement.classList.add("anim");
    }
  } catch (e) { document.documentElement.classList.remove("anim"); }

  /* ---------- Carrossel ---------- */
  $$(".carousel-wrap").forEach(function (wrap) {
    var track = $(".carousel", wrap), prev = $(".prev", wrap), next = $(".next", wrap), cnt = $(".cnt", wrap);
    var figs = $$("figure", track);
    function upd() {
      var idx = 0, best = 1e9;
      figs.forEach(function (f, k) { var d = Math.abs(f.offsetLeft - track.scrollLeft - track.offsetLeft); if (d < best) { best = d; idx = k; } });
      if (cnt) cnt.textContent = (idx + 1) + " / " + figs.length;
      prev.disabled = track.scrollLeft < 8;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    }
    function go(dir) { track.scrollBy({ left: dir * (figs[0].offsetWidth + 16), behavior: reduce ? "auto" : "smooth" }); }
    prev.addEventListener("click", function () { go(-1); });
    next.addEventListener("click", function () { go(1); });
    var t = false; track.addEventListener("scroll", function () { if (!t) { t = true; requestAnimationFrame(function () { upd(); t = false; }); } }, { passive: true });
    window.addEventListener("resize", upd); upd();
  });

  /* ---------- Lightbox com navegação ---------- */
  var lb = $("#lightbox");
  if (lb && lb.showModal) {
    var big = $("img", lb), cap = $(".lb-cap", lb), items = $$("[data-lb]"), cur = 0;
    function show(i, instant) {
      cur = (i + items.length) % items.length;
      var it = items[cur];
      function set() { big.src = it.currentSrc || it.src; big.alt = it.alt; cap.textContent = it.alt + (items.length > 1 ? "  ·  " + (cur + 1) + " / " + items.length : ""); lb.classList.remove("swap"); }
      if (instant || reduce) set(); else { lb.classList.add("swap"); setTimeout(set, 180); }
    }
    function openAt(i) { show(i, true); lb.showModal(); }
    function close() {
      if (reduce) { lb.close(); return; }
      lb.classList.add("closing");
      setTimeout(function () { lb.classList.remove("closing"); lb.close(); }, 230);
    }
    items.forEach(function (img, i) {
      img.setAttribute("tabindex", "0"); img.setAttribute("role", "button");
      img.setAttribute("aria-label", "Ampliar imagem: " + (img.alt || ""));
      img.addEventListener("click", function () { openAt(i); });
      img.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAt(i); } });
    });
    $(".lb-close", lb).addEventListener("click", close);
    $(".lb-prev", lb).addEventListener("click", function () { show(cur - 1); });
    $(".lb-next", lb).addEventListener("click", function () { show(cur + 1); });
    if (items.length < 2) { $(".lb-prev", lb).hidden = true; $(".lb-next", lb).hidden = true; }
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target.classList.contains("stage")) close(); });
    lb.addEventListener("cancel", function (e) { e.preventDefault(); close(); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
  }

  /* ---------- Formulário ---------- */
  var form = $("#lead-form");
  if (!form) return;
  var status = $("#form-status"), select = form.elements["interesse"], btn = $("button[type=submit]", form);
  var tel = form.elements["telefone"], msgField = form.elements["mensagem"], counter = $("#count-mensagem");
  var pending = $("#form-pending");
  if (pending) pending.hidden = !!cfg.formEndpoint; // aviso "em configuração" só aparece se NÃO houver endpoint

  var param = new URLSearchParams(window.location.search).get("empreendimento");
  if (param && select) $$("option", select).forEach(function (o) { if (o.value === param) select.value = param; });

  // Interpretação da resposta do Worker (js/form-response.js). O reserva abaixo só vale se o arquivo não carregar.
  var FR = window.BetelFormResponse || {
    readBody: function (r) { return r.json().then(function (j) { return { status: r.status, ok: r.ok, type: "", text: "", json: j }; }, function () { return { status: r.status, ok: r.ok, type: "", text: "", json: null }; }); },
    classify: function (res) { return res.ok && res.json && res.json.ok === true ? { kind: "success" } : { kind: "server", ref: "HTTP " + res.status }; }
  };
  var BTN_LABEL = "Enviar contato";
  var loadedAt = performance.now();
  var sending = false, lockedUntil = 0;
  function newId() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2) + "-betel";
  }
  var submissionId = newId(); // identifica a tentativa: reenviar os MESMOS dados não duplica o e-mail

  function setStatus(kind, html, focus) {
    status.className = "status show " + kind; status.innerHTML = html;
    status.setAttribute("role", kind === "bad" ? "alert" : "status");
    if (focus) status.focus();
  }
  function fieldErr(name, msg) {
    var el = form.elements[name], out = document.getElementById("err-" + name);
    if (el && el.setAttribute) el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (out) out.textContent = msg || "";
  }
  function renderBtn() {
    var locked = Date.now() < lockedUntil;
    btn.disabled = sending || locked;
    btn.textContent = sending ? "Enviando" : (locked ? "Enviado" : BTN_LABEL);
    form.setAttribute("aria-busy", sending ? "true" : "false");
  }

  /* Máscara de telefone brasileiro: (47) 99999-9999 ou (47) 3333-9999 */
  function maskPhone(v) {
    var d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length > 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
    if (d.length > 6) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    if (d.length > 2) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    return d ? "(" + d : "";
  }
  tel.addEventListener("input", function () { tel.value = maskPhone(tel.value); });
  function updateCount() {
    if (!counter) return;
    var n = msgField.value.length; counter.textContent = n + "/1000"; counter.classList.toggle("warn", n >= 950);
  }
  msgField.addEventListener("input", updateCount);
  // qualquer edição gera uma nova tentativa (evita reutilizar a mesma chave com dados diferentes)
  form.addEventListener("input", function () { submissionId = newId(); });

  /* As mesmas regras são revalidadas no Worker; aqui servem para dar retorno imediato. */
  function validate() {
    var ok = true;
    var nome = form.elements["nome"].value.trim().replace(/\s+/g, " ");
    var d = tel.value.replace(/\D/g, "");
    var email = form.elements["email"].value.trim();
    var telOk = (d.length === 10 || d.length === 11) && /^[1-9][1-9]/.test(d) && (d.length === 10 || d.charAt(2) === "9");
    if (nome.length < 3 || !/[A-Za-zÀ-ÿ]/.test(nome)) { fieldErr("nome", "Informe seu nome."); ok = false; } else fieldErr("nome", "");
    if (!telOk) { fieldErr("telefone", "Informe um telefone válido com DDD."); ok = false; } else fieldErr("telefone", "");
    if (email && !/^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]{2,}$/.test(email)) { fieldErr("email", "E-mail inválido."); ok = false; } else fieldErr("email", "");
    if (!select.value) { fieldErr("interesse", "Escolha uma opção."); ok = false; } else fieldErr("interesse", "");
    if (msgField.value.length > 1000) { fieldErr("mensagem", "A mensagem pode ter no máximo 1000 caracteres."); ok = false; } else fieldErr("mensagem", "");
    if (!form.elements["consentimento"].checked) { fieldErr("consentimento", "É necessário concordar para continuar."); ok = false; } else fieldErr("consentimento", "");
    return ok;
  }

  // Link de WhatsApp para quando o envio falha. Não leva nome, telefone nem e-mail (dados pessoais ficam fora da URL).
  function waFallback(interesse) {
    var m = "Olá! Tentei enviar o formulário do site da Betel e não consegui. Meu interesse: " + interesse + ".";
    return '<br><a class="btn btn-gold btn-sm" target="_blank" rel="noopener" href="' + waUrl(m) + '">Falar no WhatsApp</a>';
  }
  function diag(ref) {
    return ref ? '<small class="diag">Código de suporte: ' + String(ref).replace(/[^\w ·.:\-]/g, "") + "</small>" : "";
  }
  function showFailure(kind, interesse, ref) {
    var wa = waFallback(interesse), d = diag(ref);
    if (kind === "rate") setStatus("bad", "<strong>Muitas tentativas em pouco tempo.</strong> Aguarde alguns minutos e tente de novo, ou fale com a equipe agora." + wa + d, true);
    else if (kind === "fast") setStatus("warn", "Quase lá! Aguarde alguns segundos e clique em enviar novamente. Seus dados continuam preenchidos.", true);
    else if (kind === "offline") setStatus("bad", "<strong>Sem conexão com a internet.</strong> Seus dados continuam preenchidos; envie novamente quando a conexão voltar." + wa, true);
    // Sem resposta legível (timeout, bloqueio de rede/CORS): o servidor PODE ter recebido o contato. Não incentivamos reenvio imediato.
    else if (kind === "unconfirmed") setStatus("warn", "<strong>Não conseguimos confirmar o envio.</strong> Seus dados continuam preenchidos. Para evitar contatos duplicados, aguarde alguns minutos antes de tentar de novo ou fale com a equipe pelo WhatsApp." + wa + d, true);
    else setStatus("bad", "<strong>Não foi possível enviar agora.</strong> Seu contato não foi enviado, mas seus dados continuam preenchidos. Tente novamente ou fale com a equipe pelo WhatsApp." + wa + d, true);
  }
  function showSuccess() {
    // O sucesso é marcado ANTES de mexer na interface: um erro de tela nunca pode virar "falha de envio".
    lockedUntil = Date.now() + 8000; setTimeout(renderBtn, 8100);
    submissionId = newId(); loadedAt = performance.now();
    try {
      form.reset(); updateCount();
      $$("[aria-invalid]", form).forEach(function (el) { el.setAttribute("aria-invalid", "false"); });
    } catch (e) { /* limpeza opcional */ }
    setStatus("ok", "<strong>Recebemos seu contato.</strong> A equipe da Betel retornará pelo telefone ou e-mail informado.", true);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (sending || Date.now() < lockedUntil) return; // bloqueia clique duplo / Enter repetido
    if (!validate()) { setStatus("bad", "Revise os campos destacados."); var bad = $("[aria-invalid=true]", form); if (bad) bad.focus(); return; }
    var label = select.options[select.selectedIndex].text;
    var data = {
      nome: form.elements["nome"].value.trim().replace(/\s+/g, " "), telefone: tel.value.trim(),
      email: form.elements["email"].value.trim(), interesse: label, interesse_id: select.value,
      mensagem: msgField.value.trim(), origem: window.location.pathname.split("/").pop() || "index.html",
      website: form.elements["website"] ? form.elements["website"].value : "",
      elapsed_ms: Math.round(performance.now() - loadedAt), submission_id: submissionId
    };

    // Sem endpoint configurado: NÃO finge envio. Orienta o visitante a usar o WhatsApp.
    if (!cfg.formEndpoint) {
      var msg = "Olá! Meu nome é " + data.nome + ". Meu interesse: " + data.interesse + "." + (data.mensagem ? " " + data.mensagem : "") + " Telefone para retorno: " + data.telefone + ".";
      setStatus("warn", "<strong>Seus dados ainda não foram enviados.</strong> O envio do formulário está em fase de configuração. Para falar agora com a equipe, continue pelo WhatsApp:<br>" +
        '<a class="btn btn-gold btn-sm" target="_blank" rel="noopener" href="' + waUrl(msg) + '">Continuar no WhatsApp</a>');
      return;
    }

    sending = true; renderBtn();
    status.className = "status"; status.textContent = "";
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    function finish() { clearTimeout(timer); sending = false; renderBtn(); }
    function onResponse(res) {
      var out = FR.classify(res);
      if (out.ref) console.warn("[betel-form]", out.kind + (out.legacy ? " (legado)" : ""), out.ref); // sem dados pessoais
      if (out.kind === "success") return showSuccess();
      if (out.kind === "validation") {
        Object.keys((res.json && res.json.errors) || {}).forEach(function (k) { fieldErr(k, res.json.errors[k]); });
        setStatus("bad", "Revise os campos destacados.", true);
        var first = $("[aria-invalid=true]", form); if (first) first.focus();
        return;
      }
      showFailure(out.kind, label, out.ref);
    }
    function onNetworkError(err) {
      var timedOut = err && err.name === "AbortError";
      console.warn("[betel-form] sem resposta legível", timedOut ? "tempo esgotado" : (err && err.name) || "erro de rede");
      if (navigator.onLine === false) showFailure("offline", label);
      else showFailure("unconfirmed", label, timedOut ? "tempo esgotado" : "sem resposta legível");
    }
    // then(sucesso, falha) em vez de then().catch(): erros ocorridos DEPOIS de receber a resposta nunca viram "falha de envio".
    // Não há nenhuma nova tentativa automática: cada clique gera no máximo UMA requisição.
    fetch(cfg.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: ctrl ? ctrl.signal : undefined })
      .then(FR.readBody)
      .then(
        function (res) {
          try { onResponse(res); } catch (e) { console.error("[betel-form] erro de interface após a resposta", e && e.message); }
          finish();
        },
        function (err) { onNetworkError(err); finish(); }
      );
  });
  updateCount(); renderBtn();
})();

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
      $$(".imr, .draw, .rv").forEach(function (el) { io.observe(el); });
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
  var status = $("#form-status"), select = form.elements["interesse"];
  var param = new URLSearchParams(window.location.search).get("empreendimento");
  if (param && select) $$("option", select).forEach(function (o) { if (o.value === param) select.value = param; });

  function setStatus(kind, html) { status.className = "status show " + kind; status.innerHTML = html; status.setAttribute("role", kind === "bad" ? "alert" : "status"); }
  function fieldErr(name, msg) {
    var el = form.elements[name], out = document.getElementById("err-" + name);
    if (el && el.setAttribute) el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (out) out.textContent = msg || "";
  }
  function validate() {
    var ok = true;
    var nome = form.elements["nome"].value.trim();
    var tel = form.elements["telefone"].value.replace(/\D/g, "");
    var email = form.elements["email"].value.trim();
    if (nome.length < 3) { fieldErr("nome", "Informe seu nome."); ok = false; } else fieldErr("nome", "");
    if (tel.length < 10 || tel.length > 11) { fieldErr("telefone", "Informe um telefone com DDD."); ok = false; } else fieldErr("telefone", "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { fieldErr("email", "E-mail inválido."); ok = false; } else fieldErr("email", "");
    if (!select.value) { fieldErr("interesse", "Escolha uma opção."); ok = false; } else fieldErr("interesse", "");
    if (!form.elements["consentimento"].checked) { fieldErr("consentimento", "É necessário concordar para continuar."); ok = false; } else fieldErr("consentimento", "");
    return ok;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validate()) { setStatus("bad", "Revise os campos destacados."); var bad = $("[aria-invalid=true]", form); if (bad) bad.focus(); return; }
    var data = {
      nome: form.elements["nome"].value.trim(), telefone: form.elements["telefone"].value.trim(),
      email: form.elements["email"].value.trim(), interesse: select.options[select.selectedIndex].text,
      mensagem: form.elements["mensagem"].value.trim(), origem: window.location.pathname.split("/").pop() || "index.html"
    };
    if (!cfg.formEndpoint) {
      var msg = "Olá! Meu nome é " + data.nome + ". Meu interesse: " + data.interesse + "." + (data.mensagem ? " " + data.mensagem : "") + " Telefone para retorno: " + data.telefone + ".";
      setStatus("warn", "<strong>Seus dados ainda não foram enviados.</strong> O envio do formulário está em fase de configuração. Para falar agora com a equipe, continue pelo WhatsApp:<br>" +
        '<a class="btn btn-gold btn-sm" target="_blank" rel="noopener" href="' + waUrl(msg) + '">Continuar no WhatsApp</a>');
      return;
    }
    var btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = "Enviando…";
    fetch(cfg.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); form.reset(); setStatus("ok", "Recebemos seus dados. Em breve a equipe da Betel entrará em contato."); })
      .catch(function () { setStatus("bad", "Não foi possível enviar agora. Tente novamente ou fale conosco pelo WhatsApp."); })
      .then(function () { btn.disabled = false; btn.textContent = "Enviar contato"; });
  });
})();

/* ============================================================
   CONFIGURAÇÃO DO SITE — edite aqui, sem mexer no resto do código.
   Nada neste arquivo deve ser segredo: ele é público no navegador.
   ============================================================ */
window.BETEL_CONFIG = {
  // WhatsApp no formato internacional, só dígitos (55 + DDD + número).
  // Número que consta no PDF: (47) 98801-2992 — CONFIRMAR com a Betel antes de publicar.
  whatsapp: "5547988012992",
  whatsappLabel: "(47) 98801-2992",

  // Endereço do Cloudflare Worker que recebe o formulário (POST JSON) e envia o e-mail.
  // Se ficar vazio, o formulário NÃO envia nada e avisa isso ao visitante.
  // Só o Worker conhece a chave do Resend: nunca coloque segredos neste arquivo.
  formEndpoint: "https://betel-site-ilc.661207.workers.dev"
};

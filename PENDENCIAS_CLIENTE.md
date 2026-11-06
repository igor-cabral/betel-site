# Pendências para confirmar com a Betel

## Aprovação dos textos novos (v2)
Os textos desta versão foram reescritos a partir do PDF, mas **precisam de aprovação da Betel** antes de publicar:
- [ ] Título do hero: "Seu apartamento em Joinville, com o dia a dia por perto." (proposta, não é slogan oficial).
- [ ] Seção "Sobre": os três perfis (sair do aluguel / morar no que é seu / investir) vêm do PDF, mas as frases de apoio são nossas.
- [ ] "Nos três empreendimentos, as unidades térreas são Garten" (baseado na página de pré-lançamentos do PDF).
- [ ] Permuta: texto e os dois passos ("envie a localização e as características"; "a equipe retorna para conversar") são propostos. Qual é o processo real e quem atende?
- [ ] Mensagens de WhatsApp pré-preenchidas em cada botão.

## Contato e institucional
- [ ] O WhatsApp **(47) 98801-2992** (do PDF) é o número oficial e deve receber os contatos do site?
- [ ] E-mail de contato oficial.
- [ ] Endereço do escritório/stand de vendas (se houver) e horário de atendimento.
- [ ] Instagram: o QR code do PDF parece indicar `betel.construcoesinteligentes`. Confirmar o perfil para colocar o link.
- [ ] CNPJ, registro/CRECI e razão social para o rodapé (nada foi inventado).
- [ ] Texto da política de privacidade / LGPD (hoje o formulário só tem uma caixa de consentimento simples).

## Empreendimentos (geral)
- [ ] O status "Pré-lançamento" (título da seção no PDF) continua valendo para os três?
- [ ] Previsão de lançamento/entrega, valores e disponibilidade (não exibidos por não constarem no PDF).
- [ ] Registro de incorporação / memorial, se exigido nas peças de venda.
- [ ] **Imagens em alta resolução.** As do PDF são pequenas; a fachada do Vivendas do Sul (580 px) por isso aparece emoldurada, e não em tela cheia. Interiores do Palazzo têm ~640 px. Mapas e plantas vieram de capturas de tela.
- [ ] Autorização de uso das imagens.

## Palazzo Di Fatima Residence
Material recebido (renders, plantas, elevações, moodboard e quadro de áreas do projeto arquitetônico) já está no site.
- [ ] Confirmar as áreas por final (43,85 / 33,65 / 33,34 / 33,34 / 37,38 m²) e o total de 20 apartamentos (16 de 1 dormitório e 4 de 2 dormitórios), tirados do quadro de áreas do projeto (ARQ 1/2). São áreas do projeto, não necessariamente a área privativa de venda.
- [ ] Confirmar "preparação para ar-condicionado, placas solares e abastecimento de veículos elétricos", medidores individuais e acessos digitais.
- [ ] Planta humanizada: confirmar que representa o pavimento tipo e se há planta específica do térreo com o giardino de cada unidade Garten.
- [ ] Foto do ambiente Garten: a única disponível tem ~580 px (veio do PDF); enviar a original em alta resolução.
- [ ] Os desenhos técnicos (PDFs ARQ) não foram publicados. Usar croqui e elevações é OK?
- [ ] O carimbo do projeto traz "Incorporadora Betel Ltda" e um CNPJ. Confirmar a razão social e o CNPJ para o rodapé (não foi publicado).

## Residencial Portal de Paranaguá
- [ ] Metragem da unidade (não consta no PDF).
- [ ] Fotos de interiores: aparecem no PDF mas não vieram no pacote de imagens (hoje há um aviso "em breve" na página).
- [ ] Confirmar a imagem de planta usada como oficial.

## Residencial Vivendas do Sul
- [ ] Qual é a imagem oficial da fachada? A usada é `vivendas-ou-empreendimento-fachada.png` (a mesma do card do PDF); o nome do arquivo no pacote indica dúvida de atribuição. Existe também `vivendas-fachada-recorte.png`, não usada por falta de certeza.
- [ ] Metragem, número de unidades/pavimentos, vagas e status da obra.
- [ ] Planta humanizada ("Fazer planta humanizada" aparece como nota no PDF) e fotos de interiores.

## Empreendimentos realizados
- [ ] Fotos e descrição de "Salão de Festas de Empresa" e "Recanto da Gruta Residence" (hoje, espaços reservados sem dados inventados).

## Técnico (próxima etapa)
- [ ] **Formulário (produção):** o Worker de referência e os testes estão em `worker/`, mas **nenhum e-mail real foi enviado em teste**. Faltam: e-mail definitivo da Betel (`BETEL_DESTINATION_EMAIL`), domínio verificado no Resend e novo `RESEND_FROM`, publicação do Worker novo junto com o site, e um teste de envio real (ver `worker/README.md`).
- [ ] Anti-spam adicional (regra de rate limiting no Cloudflare e, se necessário, Turnstile).
- [ ] Mapas incorporados: hoje há botão "Explorar no Google Maps" gerado pelo endereço; confirmar que abre no local correto.
- [ ] SEO: `sitemap.xml`, `robots.txt`, URLs canônicas, dados estruturados e imagem Open Graph dedicada (dependem do domínio final).
- [ ] Domínio, hospedagem e publicação (aguardando autorização).
- [ ] Favicon próprio da marca (hoje usa o logo).
- [ ] Logo do desenvolvedor: copiar `logo-white.png` para `img/igor-cabral-logo-white.png`.

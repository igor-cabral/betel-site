# Site Betel Incorporadora — v2 (redesign editorial)

Site institucional estático (HTML + CSS + JavaScript puro). **Não precisa instalar nada nem fazer build.**

## Como abrir
1. Extraia o ZIP.
2. Dê dois cliques em `index.html`.

Funciona offline: fontes, imagens e scripts estão dentro da pasta.

## Estrutura
```
index.html                    Início: hero, projetos, comparativo, sobre, Garten, realizados, permuta, contato
palazzo-di-fatima.html        Página do Palazzo Di Fatima Residence
portal-de-paranagua.html      Página do Residencial Portal de Paranaguá
vivendas-do-sul.html          Página do Residencial Vivendas do Sul
css/style.css                 Estilos (cores e medidas no topo, em :root)
js/config.js                  CONFIGURAÇÃO: WhatsApp e endereço do formulário
js/main.js                    Animações, menu, galeria, ampliação de imagens e formulário
js/form-response.js           Interpretação da resposta do Worker (testada em worker/test)
img/  fonts/                  Imagens otimizadas (nomes semânticos) e fontes locais
PENDENCIAS_CLIENTE.md         O que falta confirmar com a Betel
```

## O que mudou na v2
- **Visual:** linguagem editorial/arquitetônica (linhas de cota nos títulos de seção, grade de projeto nos fundos escuros, cantos retos, tipografia serifada grande). Os três projetos têm composições diferentes na página inicial, e cada página de empreendimento tem estrutura própria.
- **Hero:** foto do Palazzo em tela cheia, título em linhas animadas, dois CTAs e o índice dos três projetos já na primeira dobra.
- **Comparativo** dos três projetos, só com dados confirmados (o que falta aparece como "A confirmar").
- **CTAs contextuais:** cada botão de WhatsApp abre a conversa citando o empreendimento correto. Há CTA após plantas, após a seção institucional, em realizados, em permuta, no fim de cada página e uma barra discreta no celular.
- **Páginas dos empreendimentos:** menu interno fixo, galeria em carrossel (Palazzo), planta ampliável, localização com link para o Google Maps, CTA final e atalho para os outros projetos.

- **Palazzo Di Fatima (v2.1):** página refeita com o material oficial: renders em alta resolução, galeria "por fora" e "por dentro", planta humanizada, planta térrea com giardino, croqui e elevações, paleta de materiais (moodboard) e quadro de unidades (20 apartamentos, áreas por final) tirado do projeto arquitetônico. Os PDFs técnicos não foram publicados.

## Animações
- Revelação ao rolar (texto, títulos palavra a palavra, imagens em "cortina", linhas de cota que se desenham, desenho de planta que se traça), barra de progresso no cabeçalho, destaque da seção atual no menu, parallax leve (máx. 48 px) no hero, zoom suave nas fotos.
- Usam só `transform`/`opacity`/`clip-path` e `IntersectionObserver` (sem biblioteca).
- **Acessibilidade:** respeitam "reduzir movimento" do sistema (tudo aparece sem animar) e, se o JavaScript falhar, todo o conteúdo continua visível.
- Transições entre páginas (`@view-transition`) funcionam em navegadores que suportam, quando o site está publicado; em navegadores sem suporte, não fazem nada.
- Para desligar uma animação específica, remova a classe `rv`, `imr`, `draw` ou `data-stagger` do elemento no HTML.

## Como atualizar
- **WhatsApp / telefone:** `js/config.js` (`whatsapp` e `whatsappLabel`). O número só existe ali.
- **Mensagem do WhatsApp de um botão:** atributo `data-wa="..."` do link no HTML.
- **Textos e dados:** edite o HTML da página. Mantenha apenas informações confirmadas pela Betel.
- **Trocar uma foto:** substitua o arquivo em `img/` mantendo o nome (ou ajuste o `src`). Prefira imagens de alta resolução (veja as pendências).
- **Cores:** variáveis `--navy`, `--gold` etc. no início de `css/style.css`.
- Cabeçalho e rodapé se repetem nas 4 páginas; ao mudar um item de menu, altere nas 4.

## Logo do desenvolvedor (rodapé)
O rodapé tem "Desenvolvido por Igor Cabral" com link para https://igorcabral.dev.br. Para exibir a logo, salve o arquivo `logo-white.png` do seu site em `img/igor-cabral-logo-white.png`. Enquanto não existir, aparece o texto "Igor Cabral".

## Formulário
O formulário envia para um **Cloudflare Worker** (endereço em `formEndpoint`, `js/config.js`), que valida os dados e envia o e-mail pelo Resend. O site só mostra "recebemos seu contato" quando o Worker confirma que o e-mail foi aceito; em qualquer falha os dados ficam preenchidos e aparece um atalho para o WhatsApp. Se `formEndpoint` ficar vazio, o formulário avisa que nada foi enviado.

O código de referência do Worker, os testes e o servidor de teste local estão em `worker/` (veja `worker/README.md`, com variáveis, segurança e o passo a passo de produção). **Não coloque chaves secretas no frontend.**

## Publicação
Nada foi publicado. Para publicar, envie a pasta inteira a uma hospedagem estática, somente com autorização da Betel.

## Fora desta versão
Veja `PENDENCIAS_CLIENTE.md`.

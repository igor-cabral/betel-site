# Worker do formulário (Cloudflare Workers + Resend)

Código de referência do Worker que recebe o formulário do site e envia o e-mail para a Betel.
**Nada aqui foi publicado.** Para entrar em produção, siga o passo a passo abaixo, com a sua autorização.

```
site (navegador) ──POST JSON──▶ Cloudflare Worker ──API──▶ Resend ──▶ e-mail da Betel
```

## Arquivos
- `src/index.js` — o Worker (validação, CORS, limites, anti-abuso, e-mail).
- `test/worker.test.mjs` — testes automatizados (`node --test worker/test/worker.test.mjs`). O Resend é simulado.
- `test/dev-server.mjs` — site + Worker + Resend **simulado** na sua máquina (`node worker/test/dev-server.mjs`, abra http://localhost:8080). Os e-mails "enviados" aparecem em http://localhost:8787/__emails e as falhas se simulam com `/__mode?m=fail422|fail500|network|slow`.

## Variáveis do Worker (painel Cloudflare → Workers → *seu worker* → Settings → Variables)
| Nome | Tipo | Valor |
|---|---|---|
| `ALLOWED_ORIGIN` | texto | `https://betel.igorcabral.dev.br` (sem `/` no fim). Será trocado quando o domínio da Betel entrar. |
| `BETEL_DESTINATION_EMAIL` | texto | e-mail que recebe os contatos (aceita vários, separados por vírgula). **Definido pela Betel.** |
| `RESEND_API_KEY` | **secret** | chave do Resend. Nunca em código, repositório ou log. |
| `RESEND_FROM` | texto | `Betel Site <contato@dominio-verificado>` depois de verificar o domínio no Resend. |
| `RATE_LIMITER` | binding (opcional) | binding de *Rate Limiting* do Cloudflare. Sem ele, usa-se um limite em memória (menos confiável). |

## O que o Worker garante
- **Só responde `200 {ok:true}` quando o Resend aceita o e-mail** (devolve um `id`). Qualquer erro do Resend, timeout ou resposta estranha vira `502` e o site mostra erro, nunca sucesso.
- **CORS restrito** à origem oficial. Origens diferentes recebem `403`. Como CORS não impede scripts fora do navegador, há também: limite de 5 envios válidos por IP a cada 10 min, campo isca (honeypot), tempo mínimo de preenchimento, corpo máximo de 8 KB e mensagem máxima de 1000 caracteres.
- **Validação no servidor** de nome, telefone brasileiro (DDD e 9º dígito), e-mail (opcional), interesse (lista fechada) e mensagem. O HTML do e-mail é escapado e o assunto não aceita quebras de linha.
- **Idempotência:** o site envia um `submission_id`; reenviar a mesma tentativa não gera e-mail duplicado.
- **Logs sem dados pessoais:** só eventos (`received`, `resend_accepted`, `resend_failed`...), status e `id`. Nunca nome, telefone, e-mail, mensagem, IP ou chave.

## Passo a passo para produção (nada disto foi feito)
1. **Revisar e mesclar** a branch `dev/formulario` (Pull Request no GitHub). O Cloudflare Pages publica o site a partir da branch principal.
2. **Comparar com o Worker atual** (o código dele não está neste repositório). Se estiver de acordo, cole `worker/src/index.js` em *Edit code* do Worker `betel-site-ilc` (ou use `wrangler deploy` com um `wrangler.toml` seu). Faça isso **junto** com a publicação do site: o site novo envia campos extras (`interesse_id`, `submission_id`, `elapsed_ms`, `website`) e o Worker novo passa a exigir `elapsed_ms`.
3. **Conferir as variáveis** da tabela acima. Não é preciso mexer na `RESEND_API_KEY`.
4. **Resend — domínio:** o remetente `onboarding@resend.dev` é só para testes e, pelo que consta na documentação do Resend, só entrega para o e-mail da própria conta do Resend (confirme na documentação atual). Para entregar à Betel: *Domains → Add Domain*, criar no DNS os registros SPF/DKIM que o Resend mostrar, esperar "Verified" e então trocar `RESEND_FROM` para um endereço desse domínio e `BETEL_DESTINATION_EMAIL` para o e-mail da Betel.
5. **Teste em produção:** com `BETEL_DESTINATION_EMAIL` ainda no seu e-mail, envie um contato real pelo site e confira o recebimento (caixa de entrada e spam). Só depois aponte para o e-mail da Betel.
6. **Proteção extra recomendada:** regra de *Rate Limiting* no Cloudflare para o Worker e, se houver spam, o **Cloudflare Turnstile** no formulário (exige criar a chave do Turnstile).

Observação: previews do Cloudflare Pages (`*.pages.dev`) são bloqueados pelo CORS de propósito. Para testar fora do domínio oficial, use o `dev-server`.

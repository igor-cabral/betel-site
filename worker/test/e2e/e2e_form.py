# Testes ponta a ponta do formulário (Playwright para Python). Requer: pip install playwright && playwright install chromium
# Uso (na raiz do repositório):  node worker/test/dev-server.mjs &  python3 worker/test/e2e/e2e_form.py
import asyncio, json, urllib.request, re
from playwright.async_api import async_playwright
W='http://localhost:8787'
def ctl(path): return urllib.request.urlopen(W+path).read().decode()
def emails(): return json.loads(ctl('/__emails'))
RES=[]
def check(n,ok,detail=''):
    RES.append((n,ok,detail)); print(('PASS' if ok else 'FAIL'),n,detail)

async def fill(pg,nome='Maria da Silva',tel='47999991234',email='maria@example.com',interesse='palazzo-di-fatima',msg='Quero saber sobre 2 dormitórios.',consent=True):
    await pg.fill('#nome',nome); await pg.type('#telefone',tel); await pg.fill('#email',email)
    await pg.select_option('#interesse',interesse); await pg.fill('#mensagem',msg)
    if consent: await pg.check('#consentimento')

async def new(b,viewport=None,url='http://localhost:8080/index.html',**kw):
    ctx=await b.new_context(viewport=viewport or {'width':1280,'height':900},**kw); pg=await ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    await pg.goto(url); pg.__errs=errs
    await pg.evaluate("document.getElementById('contato').scrollIntoView()"); await pg.wait_for_timeout(1200)
    return ctx,pg

async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # 0. banner e honeypot
        ctx,pg=await new(b)
        check('0a. aviso "em configuração" oculto quando há endpoint', not await pg.is_visible('#form-pending'))
        hp=await pg.evaluate("(()=>{const r=document.getElementById('website').getBoundingClientRect();return r.left<-1000||r.width<=1})()")
        check('0b. honeypot fora da tela', hp)
        await pg.type('#telefone','47999991234')
        check('0c. máscara de telefone', await pg.input_value('#telefone')=='(47) 99999-1234', await pg.input_value('#telefone'))
        await pg.fill('#telefone','')
        await pg.type('#telefone','4733331234'); check('0d. máscara fixo', await pg.input_value('#telefone')=='(47) 3333-1234', await pg.input_value('#telefone'))
        await ctx.close()

        # 1. envio válido
        ctl('/__reset'); ctx,pg=await new(b)
        await fill(pg); await pg.wait_for_timeout(2700)
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.ok',timeout=5000)
        em=emails()
        check('1a. sucesso exibido após aceite',True, (await pg.inner_text('#form-status')).split('\n')[0])
        check('1b. um e-mail chegou ao destinatário de teste', len(em)==1 and em[0]['body']['to']==['destino-de-teste@example.com'])
        body=em[0]['body'] if em else {}
        h=body.get('html','')
        check('1c. e-mail traz nome/telefone/e-mail/interesse/mensagem/data/origem', all(x in h for x in ['Maria da Silva','(47) 99999-1234','maria@example.com','Palazzo Di Fatima Residence','2 dormitórios','Brasília','index.html']))
        check('1d. reply_to e assunto', body.get('reply_to')=='maria@example.com' and 'Novo contato pelo site' in body.get('subject',''), body.get('subject'))
        check('1e. formulário limpo e botão travado após sucesso', await pg.input_value('#nome')=='' and await pg.is_disabled('button[type=submit]'))
        await pg.screenshot(path='/tmp/form-ok.png')
        await ctx.close()

        # 2-4. validação
        ctl('/__reset'); ctx,pg=await new(b)
        reqs=[]; pg.on('request',lambda r: reqs.append(r.url) if '8787' in r.url else None)
        await pg.click('button[type=submit]'); await pg.wait_for_timeout(300)
        errs=[await pg.inner_text(f'#err-{k}') for k in ['nome','telefone','interesse','consentimento']]
        check('2. campos obrigatórios vazios: erros e nenhuma requisição', all(errs) and not reqs, str(errs))
        await fill(pg,email='maria@'); await pg.click('button[type=submit]'); await pg.wait_for_timeout(300)
        check('3. e-mail inválido bloqueado', 'inválido' in await pg.inner_text('#err-email') and not reqs)
        await pg.fill('#email','ok@example.com'); await pg.fill('#telefone',''); await pg.type('#telefone','1234'); await pg.click('button[type=submit]'); await pg.wait_for_timeout(300)
        check('4. telefone inválido bloqueado', 'telefone' in (await pg.inner_text('#err-telefone')).lower() and not reqs)
        await ctx.close()

        # 5. mensagem longa
        ctl('/__reset'); ctx,pg=await new(b)
        await pg.type('#mensagem','x'*1100,delay=0) if False else await pg.evaluate("(()=>{const t=document.getElementById('mensagem');t.value='x'.repeat(1100);t.dispatchEvent(new Event('input',{bubbles:true}))})()")
        # value programático ignora maxlength; o validador do cliente deve barrar
        await fill(pg,msg='y'*1001) if False else None
        await pg.fill('#nome','Maria da Silva'); await pg.type('#telefone','47999991234'); await pg.select_option('#interesse','outro'); await pg.check('#consentimento')
        await pg.click('button[type=submit]'); await pg.wait_for_timeout(300)
        check('5a. mensagem >1000 barrada no cliente', 'máximo 1000' in await pg.inner_text('#err-mensagem') and len(emails())==0)
        await pg.fill('#mensagem','z'*1000); await pg.keyboard.type('EXTRA')
        check('5b. maxlength impede digitar acima de 1000', len(await pg.input_value('#mensagem'))==1000 and '1000/1000' in await pg.inner_text('#count-mensagem'))
        await ctx.close()

        # 6. duplicidade (clique duplo com Resend lento)
        ctl('/__reset'); ctl('/__mode?m=slow'); ctx,pg=await new(b)
        await fill(pg); await pg.wait_for_timeout(2700)
        await pg.dblclick('button[type=submit]'); await pg.press('#nome','Enter')
        await pg.wait_for_selector('#form-status.ok',timeout=6000); await pg.wait_for_timeout(300)
        check('6a. clique duplo + Enter geram UM único e-mail', len(emails())==1, f'{len(emails())} e-mail(s)')
        await ctx.close(); ctl('/__reset')

        # 7. erro do Resend
        for mode in ['fail422','fail500','network']:
            ctl('/__reset'); ctl(f'/__mode?m={mode}'); ctx,pg=await new(b)
            await fill(pg); await pg.wait_for_timeout(2700); await pg.click('button[type=submit]')
            await pg.wait_for_selector('#form-status.show',timeout=6000)
            cls=await pg.get_attribute('#form-status','class'); txt=await pg.inner_text('#form-status')
            href=await pg.get_attribute('#form-status a','href') or ''
            preserved=(await pg.input_value('#nome'))=='Maria da Silva' and (await pg.input_value('#mensagem')).startswith('Quero')
            check(f'7-{mode}. erro do Resend: NÃO mostra sucesso, preserva dados, botão volta', 'bad' in cls and 'ok' not in cls.split() and preserved and not await pg.is_disabled('button[type=submit]'), txt.split('\n')[0])
            check(f'7-{mode}b. link de WhatsApp sem dados pessoais', 'wa.me' in href and 'Maria' not in href and '99999' not in href and 'maria%40' not in href)
            await ctx.close()
        ctl('/__reset')

        # 7c. nova tentativa após falha funciona (mesma chave de idempotência, dados iguais)
        ctl('/__mode?m=fail500'); ctx,pg=await new(b); await fill(pg); await pg.wait_for_timeout(2700); await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.bad')
        ctl('/__mode?m=ok'); await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.ok',timeout=5000)
        em=emails(); keys=[e['headers'].get('Idempotency-Key') for e in em]
        check('7c. retry após falha envia o e-mail e reutiliza a chave de idempotência', len(em)==2 and keys[0]==keys[1] and keys[0], str(keys))
        await ctx.close(); ctl('/__reset')

        # 8. origem não autorizada (site em outra porta)
        ctl('/__reset'); ctx,pg=await new(b,url='http://localhost:8081/index.html')
        await fill(pg); await pg.wait_for_timeout(2700); await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000)
        check('8. origem não autorizada: bloqueada e nenhum e-mail', len(emails())==0 and 'ok' not in (await pg.get_attribute('#form-status','class')).split(), (await pg.inner_text('#form-status')).split('\n')[0])
        await ctx.close()

        # 9. Worker fora do ar / resposta estranha
        for name,handler in [('rede derrubada',lambda r: r.abort()),
                             ('HTML 200 sem {ok:true}',lambda r: r.fulfill(status=200,content_type='text/html',body='<html>x</html>',headers={'access-control-allow-origin':'*'})),
                             ('429',lambda r: r.fulfill(status=429,content_type='application/json',body='{"ok":false,"code":"rate_limited"}',headers={'access-control-allow-origin':'*'})),
                             ('400 validation do Worker',lambda r: r.fulfill(status=400,content_type='application/json',body='{"ok":false,"code":"validation","errors":{"telefone":"Informe um telefone válido com DDD."}}',headers={'access-control-allow-origin':'*'}))]:
            ctx,pg=await new(b)
            def mk(handler):
                async def h(route):
                    if route.request.method=='OPTIONS': await route.fulfill(status=204,headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type','access-control-allow-methods':'POST'})
                    else: await handler(route)
                return h
            h=mk(handler)
            await pg.route('http://localhost:8787/',h)
            await fill(pg); await pg.wait_for_timeout(2700); await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000)
            cls=(await pg.get_attribute('#form-status','class')).split()
            extra=''
            if name.startswith('400'): extra=await pg.inner_text('#err-telefone')
            check(f'9. {name}: sem falso sucesso e dados preservados','ok' not in cls and (await pg.input_value('#nome'))=='Maria da Silva',(await pg.inner_text('#form-status')).split('\n')[0]+' | '+extra)
            await ctx.close()

        # 9b. envio rápido demais (<2,5 s): relógio da página congelado para tornar o teste determinístico
        ctl('/__reset'); ctx=await b.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page()
        await pg.add_init_script("(()=>{let t=0;performance.now=()=>t;})()")
        await pg.goto('http://localhost:8080/index.html'); await pg.evaluate("document.getElementById('contato').scrollIntoView()")
        await fill(pg); await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=5000)
        txt=await pg.inner_text('#form-status')
        check('9b. envio rápido demais: pede para tentar de novo, sem e-mail e sem falso sucesso', len(emails())==0 and 'ok' not in (await pg.get_attribute('#form-status','class')).split() and (await pg.input_value('#nome'))=='Maria da Silva', txt.split('\n')[0])
        await ctx.close()

        # 9c. sem endpoint configurado => não finge envio
        ctx=await b.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page()
        await pg.route('**/js/config.js',lambda r: r.fulfill(status=200,content_type='text/javascript',body='window.BETEL_CONFIG={whatsapp:"5547988012992",whatsappLabel:"(47) 98801-2992",formEndpoint:""};'))
        reqs=[]; pg.on('request',lambda r: reqs.append(r.url) if '8787' in r.url else None)
        await pg.goto('http://localhost:8080/index.html'); await pg.evaluate("document.getElementById('contato').scrollIntoView()")
        await fill(pg); await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.warn')
        check('9c. sem endpoint: aviso, nenhuma requisição, banner visível', not reqs and await pg.is_visible('#form-pending'))
        await ctx.close()

        # 10. celular
        ctl('/__reset'); ctx,pg=await new(b,viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=2)
        ov=await pg.evaluate('document.documentElement.scrollWidth>window.innerWidth+1')
        await pg.tap('#nome'); await pg.keyboard.type('Maria da Silva'); await pg.tap('#telefone'); await pg.keyboard.type('47999991234')
        await pg.select_option('#interesse','vivendas-do-sul'); await pg.tap('#consentimento')
        tgt=await pg.evaluate("(()=>{const r=document.querySelector('button[type=submit]').getBoundingClientRect();return [r.width,r.height]})()")
        await pg.screenshot(path='/tmp/form-mobile.png')
        await pg.wait_for_timeout(2700); await pg.tap('button[type=submit]'); await pg.wait_for_selector('#form-status.ok',timeout=5000)
        await pg.screenshot(path='/tmp/form-mobile-ok.png')
        check('10. celular: sem rolagem lateral, botão >=48px, envio por toque OK', not ov and tgt[1]>=48 and len(emails())==1, f'botão {tgt[0]:.0f}x{tgt[1]:.0f}')
        await ctx.close()
        await b.close()
    bad=[r for r in RES if not r[1]]
    print(f'\nTOTAL {len(RES)} verificações, {len(bad)} falha(s)')
asyncio.run(main())

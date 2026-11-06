# Reproduz o sintoma "e-mail enviado, mas o site mostra erro" com os frontends anteriores e valida a correção.
# Requer: pip install playwright && playwright install chromium; histórico completo do git (commits e376fe0 e 3138b55).
# Uso (na raiz):  node worker/test/dev-server.mjs &  node worker/test/e2e/nocors.mjs &  python3 worker/test/e2e/e2e_resposta.py
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
W='http://localhost:8787'; SITE='http://localhost:8080/index.html'
def ctl(p): return urllib.request.urlopen(W+p).read().decode()
def emails(): return json.loads(ctl('/__emails'))
import subprocess
def git_show(rev):
    return subprocess.run(['git','show',f'{rev}:js/main.js'],capture_output=True,text=True,check=True).stdout
RES=[]
def check(n,ok,detail=''):
    RES.append(ok); print(('PASS' if ok else 'FAIL'),n,('| '+detail) if detail else '')
CORS={'access-control-allow-origin':'http://localhost:8080'}
PRE={'access-control-allow-origin':'http://localhost:8080','access-control-allow-headers':'Content-Type','access-control-allow-methods':'POST'}

async def open_page(b, worker_handler=None, main_js=None, init=None, endpoint=None):
    ctx=await b.new_context(viewport={'width':1280,'height':900}); pg=await ctx.new_page()
    posts=[]
    async def h(route):
        req=route.request
        if req.method=='OPTIONS': return await route.fulfill(status=204,headers=PRE)
        posts.append(1)
        if worker_handler: return await worker_handler(route)
        return await route.continue_()
    await pg.route('http://localhost:8787/',h)
    if endpoint:
        await pg.route('**/js/config.js',lambda r: r.fulfill(status=200,content_type='text/javascript',body='window.BETEL_CONFIG={whatsapp:"5547988012992",whatsappLabel:"(47) 98801-2992",formEndpoint:"%s"};'%endpoint))
    if main_js is not None:
        await pg.route('**/js/main.js',lambda r: r.fulfill(status=200,content_type='text/javascript',body=main_js))
    if init: await pg.add_init_script(init)
    logs=[]; pg.on('console',lambda m: logs.append(m.text))
    await pg.goto(SITE); await pg.evaluate("document.getElementById('contato').scrollIntoView()"); await pg.wait_for_timeout(900)
    await pg.fill('#nome','Maria da Silva'); await pg.type('#telefone','47999991234'); await pg.fill('#email','maria@example.com')
    await pg.select_option('#interesse','palazzo-di-fatima'); await pg.fill('#mensagem','Quero saber mais.'); await pg.check('#consentimento')
    await pg.wait_for_timeout(2700)
    return ctx,pg,posts,logs

def fulfill(status,body,ctype='application/json',cors=True):
    async def f(route):
        await route.fulfill(status=status,content_type=ctype,body=body,headers=CORS if cors else {})
    return f
async def state(pg):
    cls=(await pg.get_attribute('#form-status','class')).split(); txt=(await pg.inner_text('#form-status')).split('\n')[0]
    return cls,txt

async def run():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        old=git_show('e376fe0'); v2=git_show('3138b55')  # frontends anteriores, lidos do histórico do git
        print('=== REPRODUÇÃO DO SINTOMA (e-mail aceito, site mostra falha) com o frontend ANTERIOR ===')
        # 1) frontend pré-patch (o que estava no ar até 30/10) + Worker que responde 2xx mas SEM CORS na resposta do POST
        ctx,pg,posts,_=await open_page(b,main_js=old,endpoint='http://localhost:8788')
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
        n=int(urllib.request.urlopen('http://localhost:8788/__count').read())
        check('R1. pré-patch + Worker que processa (%d contato) mas responde sem CORS -> mostra falha' % n, 'bad' in cls and n>=1, txt); await ctx.close()
        # 2) frontend do meu patch anterior (exige {ok:true}) + Worker antigo que responde {success:true}
        ctx,pg,posts,_=await open_page(b,fulfill(200,'{"success":true}'),main_js=v2)
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
        check('R2. patch anterior (só aceita {ok:true}) + Worker devolvendo {success:true} -> mostra falha', 'bad' in cls and 'Não foi possível enviar agora' in txt, txt); await ctx.close()

        print('\n=== COM A CORREÇÃO ===')
        # A. Worker real (código do repositório) + Resend simulado
        ctl('/__reset'); ctx,pg,posts,_=await open_page(b)
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
        check('A. Worker real: sucesso, 1 requisição, 1 e-mail', 'ok' in cls and len(posts)==1 and len(emails())==1, txt); await ctx.close()

        # B. formatos de sucesso de outros Workers
        for name,fn in [('200 {success:true}',fulfill(200,'{"success":true}')),('201 {id} (Resend cru)',fulfill(201,'{"id":"49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}')),
                        ('202 sem corpo',fulfill(202,'')),('200 texto "OK"',fulfill(200,'OK','text/plain')),('204',fulfill(204,'')),('200 {message}',fulfill(200,'{"message":"E-mail enviado"}'))]:
            ctx,pg,posts,logs=await open_page(b,fn)
            await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
            cleared=(await pg.input_value('#nome'))==''
            check(f'B. {name}: sucesso, formulário limpo, 1 requisição', 'ok' in cls and cleared and len(posts)==1, txt); await ctx.close()

        # C. falhas reais continuam sendo falhas
        for name,fn,expect in [('200 {ok:false}',fulfill(200,'{"ok":false,"code":"email_failed"}'),'HTTP 200'),('500',fulfill(500,'{"ok":false}'),'HTTP 500'),
                               ('502 email_failed',fulfill(502,'{"ok":false,"code":"email_failed"}'),'HTTP 502 · email_failed'),('200 HTML',fulfill(200,'<html>x</html>','text/html'),'HTML')]:
            ctx,pg,posts,logs=await open_page(b,fn)
            await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
            full=await pg.inner_text('#form-status')
            check(f'C. {name}: falha com código de suporte, dados preservados', 'ok' not in cls and expect in full and (await pg.input_value('#nome'))=='Maria da Silva', full.replace('\n',' | ')[:150]); await ctx.close()

        # D. resposta ilegível (sem CORS): não diz "falha definitiva", não reenvia sozinho
        n0=int(urllib.request.urlopen('http://localhost:8788/__count').read())
        ctx,pg,posts,logs=await open_page(b,endpoint='http://localhost:8788')
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
        await pg.wait_for_timeout(3500)
        n1=int(urllib.request.urlopen('http://localhost:8788/__count').read())-n0
        full=await pg.inner_text('#form-status')
        check('D. resposta sem CORS: aviso "não conseguimos confirmar", dados preservados, NENHUM reenvio automático', 'Não conseguimos confirmar' in txt and n1==1 and (await pg.input_value('#nome'))=='Maria da Silva' and 'Código de suporte' in full, f'{n1} POST(s) recebido(s) | {full.replace(chr(10)," | ")[:170]}'); await ctx.close()

        # E. erro de interface depois do sucesso não pode virar falha
        ctx,pg,posts,logs=await open_page(b,fulfill(200,'{"ok":true,"id":"em_1"}'),init="HTMLFormElement.prototype.reset=function(){throw new Error('falha de tela simulada')}")
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000); cls,txt=await state(pg)
        check('E. exceção na limpeza do formulário após o sucesso: continua mostrando SUCESSO', 'ok' in cls, txt); await ctx.close()

        # F. bloqueio de duplicidade após sucesso + sem retry automático
        ctl('/__reset'); ctx,pg,posts,logs=await open_page(b)
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.ok',timeout=6000)
        await pg.fill('#nome','Maria da Silva'); await pg.type('#telefone','47999991234'); await pg.select_option('#interesse','outro'); await pg.check('#consentimento')
        await pg.evaluate("document.querySelector('button[type=submit]').click()"); await pg.press('#nome','Enter'); await pg.wait_for_timeout(1500)
        check('F. cliques após o sucesso (janela de 8 s) não geram novo e-mail', len(posts)==1 and len(emails())==1, f'{len(posts)} requisição(ões), {len(emails())} e-mail(s)'); await ctx.close()

        # G. conteúdo do console não vaza dados pessoais
        ctx,pg,posts,logs=await open_page(b,fulfill(200,'{"message":"ok"}'))
        await pg.click('button[type=submit]'); await pg.wait_for_selector('#form-status.show',timeout=6000)
        joined=' '.join(logs)
        check('G. console do navegador sem dados pessoais', not any(x in joined for x in ['Maria','99999','maria@']), (joined[:120] or '(vazio)')); await ctx.close()
        await b.close()
    print(f'\nTOTAL {len(RES)} verificações, {RES.count(False)} falha(s)')
asyncio.run(run())


const APP = document.getElementById('app');

const groups = [
  {
    title: 'Математика',
    description: 'Основные математические дисциплины',
    items: [
      {title:'Линейная алгебра', subtitle:'1 семестр · экзаменационные билеты', badge:'Билеты', kind:'md', source:'Линейная_алгебра_1_семестр.md', slug:'linear-algebra-1'},
      {title:'Математический анализ', subtitle:'Лекции', badge:'PDF', kind:'pdf', source:'Matan_lektsii_260214_151518.pdf'},
      {title:'Математический анализ', subtitle:'Практика', badge:'PDF', kind:'pdf', source:'Matan_praktika_260209_173531.pdf'},
      {title:'АГиТДУ', subtitle:'Лекции', badge:'PDF', kind:'pdf', source:'AGiTDU_lektsii_260214_161319.pdf'},
      {title:'АГиТДУ', subtitle:'Практика', badge:'PDF', kind:'pdf', source:'AGiTDU_praktika_260214_161726.pdf'}
    ]
  },
  {
    title:'Физика',
    description:'Лекции и практические материалы',
    items:[
      {title:'Физика',subtitle:'Лекции',badge:'PDF',kind:'pdf',source:'Fizika_lektsii_260214_155629.pdf'},
      {title:'Физика',subtitle:'Практика',badge:'PDF',kind:'pdf',source:'Fizika_praktika_260214_214542.pdf'}
    ]
  },
  {
    title:'Другое',
    description:'Дополнительные материалы',
    items:[
      {title:'Верификация данных',subtitle:'Лекции',badge:'PDF',kind:'pdf',source:'Verifikatsia_dannykh_Lektsii_260214_161939.pdf'}
    ]
  }
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function renderHome(){
  history.replaceState(null,'',location.pathname);
  document.title='Учебные материалы';
  APP.innerHTML = `
    <div class="shell">
      <section class="hero">
        <p class="eyebrow">Личный справочник</p>
        <h1>Учебные материалы</h1>
        <p>Конспекты, билеты, лекции и практика — в одном месте.</p>
        <input id="search" class="search" type="search" placeholder="Найти дисциплину или материал…">
      </section>
      <section class="catalog">
        ${groups.map((g,gi)=>`
          <section class="group" data-group>
            <div class="group-head"><div><h2>${esc(g.title)}</h2><p>${esc(g.description)}</p></div></div>
            <div class="grid">
              ${g.items.map((it,ii)=>`
                <a class="card" data-card data-key="${esc((it.title+' '+it.subtitle+' '+g.title).toLowerCase())}"
                   href="${it.kind==='md' ? '#'+it.slug : './'+encodeURI(it.source)}"
                   ${it.kind==='pdf'?'target="_blank" rel="noopener"':''}>
                  <div><h3>${esc(it.title)}</h3><p>${esc(it.subtitle)}</p></div>
                  <div class="card-bottom"><span class="badge">${esc(it.badge)}</span><span>↗</span></div>
                </a>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </section>
    </div>`;
  const input=document.getElementById('search');
  input.addEventListener('input',()=>{
    const q=input.value.trim().toLowerCase();
    document.querySelectorAll('[data-card]').forEach(card=>{
      card.style.display = !q || card.dataset.key.includes(q) ? '' : 'none';
    });
    document.querySelectorAll('[data-group]').forEach(group=>{
      group.style.display = [...group.querySelectorAll('[data-card]')].some(x=>x.style.display!=='none') ? '' : 'none';
    });
  });
}

function stashMath(md){
  const math=[];
  const put=(raw)=>{const k=`@@MATH${math.length}@@`;math.push(raw);return k};
  let s=md;
  s=s.replace(/```math\s*\n([\s\S]*?)```/gi,(_,x)=>put(`$$${x.trim()}$$`));
  s=s.replace(/\\\[([\s\S]*?)\\\]/g,m=>put(m));
  s=s.replace(/\$\$([\s\S]*?)\$\$/g,m=>put(m));
  s=s.replace(/\\\(([\s\S]*?)\\\)/g,m=>put(m));
  s=s.replace(/(^|[^\\$])\$(?!\$)([^\n$]+?)(?<!\\)\$/g,(m,p,x)=>p+put(`$${x}$`));
  return {s,math};
}
function restoreMath(html,math){
  return math.reduce((h,m,i)=>h.replaceAll(`@@MATH${i}@@`,m),html);
}

function inlineFormat(s){
  s=esc(s);
  s=s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img src="$2" alt="$1">');
  s=s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
  s=s.replace(/`([^`]+)`/g,'<code>$1</code>');
  s=s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  s=s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
  s=s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
  return s;
}

function markdownToHtml(source){
  const {s,math}=stashMath(source.replace(/\r\n/g,'\n'));
  const lines=s.split('\n');
  let out=[], para=[], list=null, quote=[], code=false, codeLang='', codeLines=[];
  const flushPara=()=>{if(para.length){out.push(`<p>${inlineFormat(para.join(' '))}</p>`);para=[]}};
  const flushList=()=>{if(list){out.push(`</${list}>`);list=null}};
  const flushQuote=()=>{if(quote.length){out.push(`<blockquote>${markdownToHtml(quote.join('\n'))}</blockquote>`);quote=[]}};
  for(let i=0;i<lines.length;i++){
    let line=lines[i];
    if(code){
      if(/^```/.test(line)){out.push(`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`);code=false;codeLines=[]}
      else codeLines.push(line);
      continue;
    }
    if(/^```/.test(line)){flushPara();flushList();flushQuote();code=true;codeLang=line.slice(3).trim();continue}
    if(/^\s*$/.test(line)){flushPara();flushList();flushQuote();continue}
    if(/^<a\s+id=["'][^"']+["']\s*><\/a>\s*$/.test(line)){flushPara();flushList();flushQuote();out.push(line);continue}
    if(/^---+\s*$/.test(line)){flushPara();flushList();flushQuote();out.push('<hr>');continue}
    const hm=line.match(/^(#{1,6})\s+(.+)$/);
    if(hm){flushPara();flushList();flushQuote();const n=hm[1].length;out.push(`<h${n}>${inlineFormat(hm[2])}</h${n}>`);continue}
    if(/^>\s?/.test(line)){flushPara();flushList();quote.push(line.replace(/^>\s?/,''));continue}
    const ul=line.match(/^\s*[-*+]\s+(.+)$/);
    if(ul){flushPara();flushQuote();if(list!=='ul'){flushList();list='ul';out.push('<ul>')}out.push(`<li>${inlineFormat(ul[1])}</li>`);continue}
    const ol=line.match(/^\s*\d+[.)]\s+(.+)$/);
    if(ol){flushPara();flushQuote();if(list!=='ol'){flushList();list='ol';out.push('<ol>')}out.push(`<li>${inlineFormat(ol[1])}</li>`);continue}
    if(/^\s*</.test(line) && />\s*$/.test(line)){flushPara();flushList();flushQuote();out.push(line);continue}
    para.push(line.trim());
  }
  flushPara();flushList();flushQuote();
  if(codeLines.length)out.push(`<pre><code>${esc(codeLines.join('\n'))}</code></pre>`);
  return restoreMath(out.join('\n'),math);
}

function splitTickets(source){
  const re=/<a\s+id=["']ticket-(\d+)["']\s*><\/a>/gi;
  const matches=[...source.matchAll(re)];
  if(!matches.length)return {intro:source,tickets:[]};
  const intro=source.slice(0,matches[0].index).trim();
  const tickets=matches.map((m,i)=>{
    const start=m.index+m[0].length;
    const end=i+1<matches.length?matches[i+1].index:source.length;
    const raw=source.slice(start,end).trim();
    const title=(raw.match(/^##\s+(.+)$/m)?.[1]||`Билет ${m[1]}`).replace(/[*_`$]/g,'').trim();
    const copy=raw.replace(/\n?\[↑\s*К содержанию\]\([^\n]+\)\s*/gi,'\n').replace(/\n?---\s*$/g,'').trim();
    return {id:`ticket-${m[1]}`,number:m[1],raw,title,copy};
  });
  return {intro,tickets};
}

async function ensureMathJax(){
  if(window.MathJax?.startup?.promise){
    await window.MathJax.startup.promise;
    return true;
  }
  for(let i=0;i<100;i++){
    if(window.MathJax?.typesetPromise) return true;
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('MathJax не загрузился. Проверь доступ к cdn.jsdelivr.net.');
}

async function renderArticle(item){
  APP.innerHTML='<div class="loading">Загружаю статью и математику…</div>';
  try{
    const resp=await fetch('./'+encodeURI(item.source),{cache:'no-cache'});
    if(!resp.ok)throw new Error(`Не удалось загрузить ${item.source}: HTTP ${resp.status}`);
    const src=await resp.text();
    const {intro,tickets}=splitTickets(src);
    const toc=tickets.map(t=>`<a href="#${t.id}">${esc(t.title)}</a>`).join('');
    APP.innerHTML=`
      <div class="article-shell">
        <header class="article-head">
          <a class="back" href="./">← Все материалы</a>
          <h1>${esc(item.title)}</h1>
          <p>${esc(item.subtitle)}</p>
        </header>
        <div class="article-layout">
          <aside class="toc"><p class="toc-title">Билеты</p>${toc}</aside>
          <article class="article" id="article">
            ${markdownToHtml(intro)}
            ${tickets.map(t=>`
              <section class="ticket" id="${t.id}" data-ticket>
                <div class="ticket-actions"><button class="copy-btn" data-copy="${t.number}">Копировать билет</button></div>
                ${markdownToHtml(t.raw)}
                <textarea hidden data-source="${t.number}">${esc(t.copy)}</textarea>
              </section>`).join('')}
          </article>
        </div>
      </div>`;
    document.title=`${item.title} — notes`;
    await ensureMathJax();
    await MathJax.typesetPromise([document.getElementById('article')]);

    document.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const src=document.querySelector(`[data-source="${btn.dataset.copy}"]`).value;
        try{
          await navigator.clipboard.writeText(src);
          const old=btn.textContent;btn.textContent='Скопировано ✓';
          setTimeout(()=>btn.textContent=old,1300);
        }catch{
          const ta=document.createElement('textarea');ta.value=src;document.body.appendChild(ta);ta.select();
          document.execCommand('copy');ta.remove();
          btn.textContent='Скопировано ✓';setTimeout(()=>btn.textContent='Копировать билет',1300);
        }
      });
    });
  }catch(e){
    APP.innerHTML=`<div class="error-box"><h2>Не удалось открыть материал</h2><p>${esc(e.message)}</p><p><a href="./">← На главную</a></p></div>`;
  }
}

function route(){
  const slug=location.hash.replace(/^#/,'');
  if(!slug){renderHome();return}
  const item=groups.flatMap(g=>g.items).find(x=>x.kind==='md'&&x.slug===slug);
  if(item)renderArticle(item);else renderHome();
}
window.addEventListener('hashchange',route);
document.getElementById('brandLink').addEventListener('click',e=>{e.preventDefault();history.pushState(null,'',location.pathname);renderHome()});
window.addEventListener('scroll',()=>{
  const max=document.documentElement.scrollHeight-innerHeight;
  document.getElementById('readingProgress').style.width=(max>0?scrollY/max*100:0)+'%';
},{passive:true});
route();

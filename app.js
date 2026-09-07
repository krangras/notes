
const APP = document.getElementById('app');

const groups = [
  {
    title: 'Математика',
    description: 'Основные математические дисциплины',
    items: [
      {title:'Линейная алгебра', subtitle:'1 семестр · экзаменационные билеты', badge:'Билеты', kind:'md', source:'Линейная_алгебра_1_семестр.md', slug:'linear-algebra-1'},
      {title:'Математический анализ', subtitle:'Лекции', badge:'PDF', kind:'pdf', source:'Matan_lektsii_260214_151518.pdf'},
      {title:'Математический анализ', subtitle:'Практика', badge:'PDF', kind:'pdf', source:'Matan_praktika_260209_173531.pdf'},
      {title:'АГиТДУ', subtitle:'Полный конспект лекций', badge:'Конспект', kind:'md', source:'Алгебра_геометрия_и_ТДУ_полный_конспект.md', slug:'agitdu-full'},
      {title:'АГиТДУ', subtitle:'Лекции · исходный PDF', badge:'PDF', kind:'pdf', source:'AGiTDU_lektsii_260214_161319.pdf'},
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
const mdItems = () => groups.flatMap(g => g.items).filter(x => x.kind === 'md');

const definitionAliases = {
  'complex-def-1': ['комплексное число', 'комплексные числа'],
  'complex-def-2': ['алгебраическая форма записи комплексного числа', 'алгебраическая форма'],
  'complex-def-3': ['комплексно сопряжённое число', 'комплексно сопряжённое'],
  'complex-def-4': ['обратное комплексное число', 'обратное к z'],
  'complex-modulus': ['модуль комплексного числа', 'модуль числа'],
  'complex-arg': ['аргумент комплексного числа', 'главное значение аргумента'],

  'matrix-def-1': ['матрица', 'матрицы'],
  'matrix-def-2': ['равные матрицы', 'матрицы равны'],
  'matrix-op-def-1': ['сумма матриц'],
  'matrix-op-def-2': ['умножение числа на матрицу', 'произведение числа и матрицы'],
  'matrix-op-def-3': ['произведение матриц', 'матричное умножение'],
  'matrix-op-def-4': ['транспонированная матрица', 'транспонирование матрицы'],
  'det-def-1': ['определитель', 'детерминант', 'алгебраическое дополнение', 'минор'],
  'det-def-2': ['вырожденная матрица', 'невырожденная матрица'],
  'det-def-3': ['линейная комбинация матриц-строк'],
  'det-def-4': ['вырожденная линейная комбинация', 'невырожденная линейная комбинация', 'нулевая линейная комбинация', 'ненулевая линейная комбинация'],
  'det-def-5': ['линейно зависимая система матриц-строк', 'линейно независимая система матриц-строк'],
  'inverse-matrix-def': ['обратная матрица'],
  'slu-def-1': ['система линейных уравнений', 'СЛУ', 'матрица СЛУ', 'расширенная матрица СЛУ'],
  'slu-def-2': ['однородная СЛУ', 'ОСЛУ', 'неоднородная СЛУ', 'НСЛУ'],

  'vec-def-1': ['компланарные векторы', 'некомпланарные векторы'],
  'vec-def-2': ['базис на прямой', 'базис на плоскости', 'базис в пространстве', 'базис'],
  'vec-def-3': ['координаты вектора'],
  'vec-def-4': ['правая тройка', 'левая тройка'],
  'vec-def-5': ['правая пара', 'левая пара'],
  'vec-def-6': ['правый базис', 'левый базис'],
  'scalar-def': ['скалярное произведение'],
  'onb-def': ['ортонормированный базис', 'ОНБ'],
  'vector-product-def': ['векторное произведение'],
  'mixed-product-def': ['смешанное произведение'],

  'coord-def-1': ['система координат', 'начало координат', 'оси координат'],
  'coord-def-2': ['радиус-вектор', 'координаты точки'],
  'coord-def-3': ['прямоугольная система координат'],
  'coord-def-4': ['правая система координат', 'левая система координат'],
  'line-def-1': ['нормальный вектор прямой', 'нормальный вектор'],
  'line-def-2': ['направляющий вектор прямой', 'направляющий вектор'],
  'line-def-3': ['общее уравнение прямой на плоскости'],
  'plane-general-eq': ['общее уравнение плоскости'],
  'line-parametric': ['параметрическое уравнение прямой'],
  'line-canonical': ['каноническое уравнение прямой'],
  'line-two-points': ['уравнение прямой по двум точкам'],
  'line-general-space': ['общее уравнение прямой в пространстве'],

  'ellipse-def-1': ['эллипс'],
  'ellipse-def-2': ['каноническое уравнение эллипса', 'центр эллипса', 'полуоси эллипса', 'вершины эллипса'],
  'hyperbola-def-1': ['гипербола'],
  'hyperbola-def-2': ['каноническое уравнение гиперболы', 'асимптоты гиперболы', 'центр гиперболы', 'вершины гиперболы'],
  'parabola-def-1': ['парабола', 'директриса', 'фокус параболы'],
  'parabola-def-2': ['каноническое уравнение параболы', 'вершина параболы', 'ось параболы'],

  'lp-def-1': ['линейное пространство'],
  'lp-def-2': ['линейная комбинация векторов'],
  'lp-def-3': ['линейно зависимая система', 'линейно независимая система', 'ЛЗС', 'ЛНС'],
  'lp-def-4': ['базис линейного пространства', 'координаты вектора в базисе'],
  'lp-def-5': ['матрица перехода', 'матрица перехода из базиса'],
  'subspace-def-1': ['подпространство'],
  'subspace-def-2': ['линейная оболочка'],
  'subspace-def-3': ['сумма подпространств', 'прямая сумма']
};

function noteHref(slug, anchor=''){
  const q = `?note=${encodeURIComponent(slug)}`;
  return q + (anchor ? `#${anchor}` : '');
}

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
        ${groups.map(g=>`
          <section class="group" data-group>
            <div class="group-head"><div><h2>${esc(g.title)}</h2><p>${esc(g.description)}</p></div></div>
            <div class="grid">
              ${g.items.map(it=>`
                <a class="card" data-card data-key="${esc((it.title+' '+it.subtitle+' '+g.title).toLowerCase())}"
                   href="${it.kind==='md' ? noteHref(it.slug) : './'+encodeURI(it.source)}"
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
      if(/^```/.test(line)){
        const cls = codeLang ? ` class="language-${esc(codeLang)}"` : '';
        out.push(`<pre><code${cls}>${esc(codeLines.join('\n'))}</code></pre>`);
        code=false; codeLines=[]; codeLang='';
      } else codeLines.push(line);
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

function ensureDefinitionModal(){
  let modal=document.getElementById('definitionModal');
  if(modal) return modal;
  document.body.insertAdjacentHTML('beforeend',`
    <div class="definition-modal" id="definitionModal" hidden>
      <div class="definition-modal-backdrop" data-def-close></div>
      <section class="definition-modal-panel" role="dialog" aria-modal="true" aria-labelledby="definitionModalTitle">
        <div class="definition-modal-head">
          <div>
            <div class="definition-modal-kicker">Определение</div>
            <h2 id="definitionModalTitle"></h2>
          </div>
          <button class="definition-modal-close" type="button" aria-label="Закрыть" data-def-close>×</button>
        </div>
        <div class="definition-modal-body" id="definitionModalBody"></div>
        <div class="definition-modal-actions">
          <button class="definition-go" type="button" id="definitionGo">Показать в конспекте</button>
          <button class="definition-close-secondary" type="button" data-def-close>Закрыть</button>
        </div>
      </section>
    </div>
  `);
  modal=document.getElementById('definitionModal');
  modal.querySelectorAll('[data-def-close]').forEach(x=>x.addEventListener('click',closeDefinition));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden) closeDefinition()});
  return modal;
}

let activeDefinitionId=null;
function closeDefinition(){
  const modal=document.getElementById('definitionModal');
  if(!modal) return;
  modal.hidden=true;
  document.body.classList.remove('definition-modal-open');
  activeDefinitionId=null;
}

function prettyDefinitionTitle(id, label){
  const aliases=definitionAliases[id]||[];
  if(aliases.length){
    const t=aliases[0];
    return t.charAt(0).toUpperCase()+t.slice(1);
  }
  return label.replace(/[:.]$/,'') || 'Определение';
}

function isDefinitionAnchor(anchor){
  const id=anchor.id;
  if(!id) return false;
  if(definitionAliases[id]) return true;
  let el=anchor.nextElementSibling;
  while(el && el.tagName==='A' && el.id) el=el.nextElementSibling;
  const strong=el?.querySelector?.('strong');
  const txt=(strong?.textContent||el?.textContent||'').trim();
  return /^Определение\b/i.test(txt) ||
         /^(Модуль комплексного числа|Аргумент комплексного числа|Система линейных уравнений)/i.test(txt);
}

function definitionBoundary(el){
  if(!el) return true;
  if(el.tagName==='A' && el.id) return true;
  if(/^H[1-4]$/.test(el.tagName)) return true;
  if(el.tagName==='HR') return true;
  const strong=el.querySelector?.(':scope > strong');
  const txt=(strong?.textContent||'').trim();
  return /^(Теорема|Лемма|Следствие|Замечание|Пример|Д-во|Док-во|Доказательство)\b/i.test(txt);
}

function collectDefinitionData(article){
  const defs=new Map();
  [...article.querySelectorAll('a[id]')].forEach(anchor=>{
    if(!isDefinitionAnchor(anchor)) return;
    const nodes=[];
    let el=anchor.nextElementSibling;
    while(el && nodes.length<20){
      if(nodes.length && definitionBoundary(el)) break;
      if(el.tagName==='A' && el.id) break;
      nodes.push(el);
      el=el.nextElementSibling;
    }
    if(!nodes.length) return;

    const firstStrong=nodes[0]?.querySelector?.('strong');
    const label=(firstStrong?.textContent||'Определение').trim();
    defs.set(anchor.id,{
      id:anchor.id,
      anchor,
      label,
      title:prettyDefinitionTitle(anchor.id,label),
      nodes
    });

    if(firstStrong){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='definition-trigger';
      btn.dataset.definitionId=anchor.id;
      btn.innerHTML=firstStrong.innerHTML;
      firstStrong.replaceWith(btn);
    }

    nodes.forEach(node=>node.classList?.add('definition-source-block'));
  });
  return defs;
}

function openDefinition(id, defs){
  const def=defs.get(id);
  if(!def) return;
  const modal=ensureDefinitionModal();
  activeDefinitionId=id;
  modal.querySelector('#definitionModalTitle').textContent=def.title;
  const body=modal.querySelector('#definitionModalBody');
  body.innerHTML='';
  def.nodes.forEach(node=>{
    const clone=node.cloneNode(true);
    clone.querySelectorAll?.('.definition-trigger').forEach(btn=>{
      const strong=document.createElement('strong');
      strong.innerHTML=btn.innerHTML;
      btn.replaceWith(strong);
    });
    clone.querySelectorAll?.('.definition-term').forEach(link=>{
      const span=document.createElement('span');
      span.textContent=link.textContent;
      link.replaceWith(span);
    });
    body.appendChild(clone);
  });
  modal.querySelector('#definitionGo').onclick=()=>{
    closeDefinition();
    const target=document.getElementById(id);
    if(target){
      history.replaceState(null,'',`${location.pathname}${location.search}#${encodeURIComponent(id)}`);
      target.scrollIntoView({behavior:'smooth',block:'start'});
      const first=target.nextElementSibling;
      first?.classList?.add('definition-flash');
      setTimeout(()=>first?.classList?.remove('definition-flash'),1600);
    }
  };
  modal.hidden=false;
  document.body.classList.add('definition-modal-open');
  setTimeout(()=>modal.querySelector('.definition-modal-close')?.focus(),0);
}

function bindDefinitionReferences(article, defs){
  article.querySelectorAll('a[href^="#"]').forEach(link=>{
    const raw=link.getAttribute('href').slice(1);
    let id;
    try{id=decodeURIComponent(raw)}catch{id=raw}
    if(!defs.has(id)) return;
    link.classList.add('definition-reference');
    link.addEventListener('click',e=>{
      e.preventDefault();
      openDefinition(id,defs);
    });
  });

  article.querySelectorAll('.definition-trigger[data-definition-id]').forEach(btn=>{
    btn.addEventListener('click',()=>openDefinition(btn.dataset.definitionId,defs));
  });
}

function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}

function linkDefinitionTerms(article, defs){
  const entries=[];
  Object.entries(definitionAliases).forEach(([id,aliases])=>{
    if(!defs.has(id)) return;
    aliases.forEach(alias=>{
      const clean=alias.trim();
      if(clean.length>=3) entries.push({id,alias:clean});
    });
  });
  entries.sort((a,b)=>b.alias.length-a.alias.length);

  const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      const p=node.parentElement;
      if(!p || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if(p.closest('a,button,code,pre,textarea,mjx-container,svg,script,style,.definition-modal')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const textNodes=[];
  while(walker.nextNode()) textNodes.push(walker.currentNode);

  for(const node of textNodes){
    let text=node.nodeValue;
    let parts=[{text,linked:false}];

    for(const entry of entries){
      const rx=new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(entry.alias)})(?=$|[^\\p{L}\\p{N}_])`,'giu');
      const next=[];
      for(const part of parts){
        if(part.linked){next.push(part);continue}
        let last=0, m;
        rx.lastIndex=0;
        while((m=rx.exec(part.text))){
          const lead=m[1]||'';
          const term=m[2];
          const start=m.index;
          const termStart=start+lead.length;
          if(termStart>last) next.push({text:part.text.slice(last,termStart),linked:false});
          next.push({text:term,linked:true,id:entry.id});
          last=termStart+term.length;
          if(rx.lastIndex===m.index) rx.lastIndex++;
        }
        if(last<part.text.length) next.push({text:part.text.slice(last),linked:false});
      }
      parts=next;
    }

    if(parts.some(x=>x.linked)){
      const frag=document.createDocumentFragment();
      parts.forEach(part=>{
        if(!part.linked){frag.appendChild(document.createTextNode(part.text));return}
        const a=document.createElement('button');
        a.type='button';
        a.className='definition-term';
        a.dataset.definitionId=part.id;
        a.textContent=part.text;
        a.title='Показать определение';
        a.addEventListener('click',()=>openDefinition(part.id,defs));
        frag.appendChild(a);
      });
      node.replaceWith(frag);
    }
  }
}

function setupDefinitions(article){
  const defs=collectDefinitionData(article);
  bindDefinitionReferences(article,defs);
  linkDefinitionTerms(article,defs);
  return defs;
}

function scrollToCurrentAnchor(defs){
  if(!location.hash) return;
  let id=location.hash.slice(1);
  try{id=decodeURIComponent(id)}catch{}
  if(defs?.has(id)){
    openDefinition(id,defs);
    return;
  }
  requestAnimationFrame(()=>{
    const target=document.getElementById(id);
    target?.scrollIntoView({block:'start'});
  });
}

async function renderArticle(item){
  APP.innerHTML='<div class="loading">Загружаю статью и математику…</div>';
  try{
    const resp=await fetch('./'+encodeURI(item.source),{cache:'no-cache'});
    if(!resp.ok)throw new Error(`Не удалось загрузить ${item.source}: HTTP ${resp.status}`);
    const src=await resp.text();
    const {intro,tickets}=splitTickets(src);

    let toc='';
    if(tickets.length){
      toc=tickets.map(t=>`<a href="#${t.id}">${esc(t.title)}</a>`).join('');
    }else{
      const headingMatches=[...src.matchAll(/^#{2,3}\s+(.+)$/gm)].slice(0,80);
      toc=headingMatches.map((m,i)=>{
        const title=m[1].replace(/[*_`$]/g,'').trim();
        return `<span class="toc-static">${esc(title)}</span>`;
      }).join('');
    }

    APP.innerHTML=`
      <div class="article-shell">
        <header class="article-head">
          <a class="back" href="./">← Все материалы</a>
          <h1>${esc(item.title)}</h1>
          <p>${esc(item.subtitle)}</p>
        </header>
        <div class="article-layout">
          <aside class="toc"><p class="toc-title">${tickets.length?'Билеты':'Содержание'}</p>${toc}</aside>
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

    const article=document.getElementById('article');
    const defs=setupDefinitions(article);

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

    scrollToCurrentAnchor(defs);
  }catch(e){
    APP.innerHTML=`<div class="error-box"><h2>Не удалось открыть материал</h2><p>${esc(e.message)}</p><p><a href="./">← На главную</a></p></div>`;
  }
}

function route(){
  const params=new URLSearchParams(location.search);
  let slug=params.get('note');

  // Совместимость со старыми ссылками вида #linear-algebra-1.
  if(!slug && location.hash){
    const oldSlug=location.hash.slice(1);
    const oldItem=mdItems().find(x=>x.slug===oldSlug);
    if(oldItem){
      slug=oldSlug;
      history.replaceState(null,'',`${location.pathname}?note=${encodeURIComponent(slug)}`);
    }
  }

  if(!slug){renderHome();return}
  const item=mdItems().find(x=>x.slug===slug);
  if(item) renderArticle(item);
  else renderHome();
}

window.addEventListener('popstate',route);

document.getElementById('brandLink').addEventListener('click',e=>{
  e.preventDefault();
  history.pushState(null,'',location.pathname);
  renderHome();
});

window.addEventListener('scroll',()=>{
  const max=document.documentElement.scrollHeight-innerHeight;
  document.getElementById('readingProgress').style.width=(max>0?scrollY/max*100:0)+'%';
},{passive:true});

route();

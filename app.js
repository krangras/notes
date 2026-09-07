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
  'complex-def-1':['комплексное число','комплексные числа'],
  'complex-def-2':['алгебраическая форма записи комплексного числа','алгебраическая форма'],
  'complex-def-3':['комплексно сопряжённое число','сопряжённое число'],
  'complex-def-4':['обратное комплексное число','обратное число'],
  'complex-modulus':['модуль комплексного числа'],
  'complex-arg':['аргумент комплексного числа'],

  'matrix-def-1':['матрица','матрицы'],
  'matrix-def-2':['равные матрицы'],
  'matrix-op-def-1':['сумма матриц'],
  'matrix-op-def-2':['умножение числа на матрицу','произведение числа и матрицы'],
  'matrix-op-def-3':['произведение матриц','матричное умножение'],
  'matrix-op-def-4':['транспонированная матрица','транспонирование'],
  'det-def-1':['определитель','детерминант','минор','алгебраическое дополнение'],
  'det-def-2':['вырожденная матрица','невырожденная матрица'],
  'det-def-3':['линейная комбинация матриц-строк'],
  'det-def-4':['вырожденная линейная комбинация','невырожденная линейная комбинация'],
  'det-def-5':['линейно зависимая система матриц-строк','линейно независимая система матриц-строк'],
  'inverse-matrix-def':['обратная матрица'],
  'slu-def-1':['система линейных уравнений','СЛУ','матрица СЛУ','расширенная матрица СЛУ'],
  'slu-def-2':['однородная СЛУ','ОСЛУ','неоднородная СЛУ','НСЛУ'],

  'vec-def-1':['компланарные векторы','некомпланарные векторы'],
  'vec-def-2':['базис на прямой','базис на плоскости','базис в пространстве','базис'],
  'vec-def-3':['координаты вектора'],
  'vec-def-4':['правая тройка','левая тройка'],
  'vec-def-5':['правая пара','левая пара'],
  'vec-def-6':['правый базис','левый базис'],
  'scalar-def':['скалярное произведение'],
  'onb-def':['ортонормированный базис','ОНБ'],
  'vector-product-def':['векторное произведение'],
  'mixed-product-def':['смешанное произведение'],

  'coord-def-1':['система координат','начало координат','оси координат'],
  'coord-def-2':['радиус-вектор','координаты точки'],
  'coord-def-3':['прямоугольная система координат'],
  'coord-def-4':['правая система координат','левая система координат'],
  'line-def-1':['нормальный вектор прямой','нормальный вектор'],
  'line-def-2':['направляющий вектор прямой','направляющий вектор'],
  'line-def-3':['общее уравнение прямой на плоскости'],
  'plane-general-eq':['общее уравнение плоскости'],
  'line-parametric':['параметрическое уравнение прямой'],
  'line-canonical':['каноническое уравнение прямой'],
  'line-two-points':['уравнение прямой по двум точкам'],
  'line-general-space':['общее уравнение прямой в пространстве'],

  'ellipse-def-1':['эллипс'],
  'ellipse-def-2':['каноническое уравнение эллипса','центр эллипса','полуоси эллипса','вершины эллипса'],
  'hyperbola-def-1':['гипербола'],
  'hyperbola-def-2':['каноническое уравнение гиперболы','асимптоты гиперболы','центр гиперболы','вершины гиперболы'],
  'parabola-def-1':['парабола','директриса','фокус параболы'],
  'parabola-def-2':['каноническое уравнение параболы','вершина параболы','ось параболы'],

  'lp-def-1':['линейное пространство'],
  'lp-def-2':['линейная комбинация векторов'],
  'lp-def-3':['линейно зависимая система','линейно независимая система','ЛЗС','ЛНС'],
  'lp-def-4':['базис линейного пространства','координаты вектора в базисе'],
  'lp-def-5':['матрица перехода'],
  'subspace-def-1':['подпространство'],
  'subspace-def-2':['линейная оболочка'],
  'subspace-def-3':['сумма подпространств','прямая сумма']
};

function noteHref(slug, anchor=''){
  return `?note=${encodeURIComponent(slug)}${anchor ? '#'+encodeURIComponent(anchor) : ''}`;
}

function renderHome(){
  history.replaceState(null,'',location.pathname);
  document.title='Учебные материалы';
  closeDefinition();
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
  const put=raw=>{const k=`@@MATH${math.length}@@`;math.push(raw);return k};
  let s=md;
  s=s.replace(/```math\s*\n([\s\S]*?)```/gi,(_,x)=>put(`$$${x.trim()}$$`));
  s=s.replace(/\\\[([\s\S]*?)\\\]/g,m=>put(m));
  s=s.replace(/\$\$([\s\S]*?)\$\$/g,m=>put(m));
  s=s.replace(/\\\(([\s\S]*?)\\\)/g,m=>put(m));
  s=s.replace(/(^|[^\\$])\$(?!\$)([^\n$]+?)(?<!\\)\$/g,(m,p,x)=>p+put(`$${x}$`));
  return {s,math};
}
function restoreMath(html,math){return math.reduce((h,m,i)=>h.replaceAll(`@@MATH${i}@@`,m),html)}

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
  for(const line0 of lines){
    const line=line0;
    if(code){
      if(/^```/.test(line)){
        const cls=codeLang?` class="language-${esc(codeLang)}"`:'';
        out.push(`<pre><code${cls}>${esc(codeLines.join('\n'))}</code></pre>`);
        code=false;codeLang='';codeLines=[];
      }else codeLines.push(line);
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

function slugify(text){
  return text
    .replace(/\$[^$]*\$/g,' ')
    .replace(/[*_`~]/g,'')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,110) || 'section';
}

function parseSections(source){
  const lines=source.replace(/\r\n/g,'\n').split('\n');
  const sections=[];
  const used=new Map();
  let lastAnchor=null;

  for(let i=0;i<lines.length;i++){
    const a=lines[i].trim().match(/^<a\s+id=["']([^"']+)["']\s*><\/a>$/i);
    if(a){lastAnchor=a[1];continue}
    if(!lines[i].trim()) continue;
    const h=lines[i].match(/^(#{1,4})\s+(.+)$/);
    if(!h){lastAnchor=null;continue}

    const level=h[1].length;
    const title=h[2].trim();
    let id=lastAnchor || slugify(title);
    const count=used.get(id)||0;
    used.set(id,count+1);
    if(count) id=`${id}-${count+1}`;

    sections.push({level,title,id,start:i,end:lines.length,raw:''});
    lastAnchor=null;
  }

  for(let i=0;i<sections.length;i++){
    const s=sections[i];
    let end=lines.length;
    for(let j=i+1;j<sections.length;j++){
      if(sections[j].level<=s.level){end=sections[j].start;break}
    }
    s.end=end;
    s.raw=lines.slice(s.start,end).join('\n').trim();
  }
  return sections;
}

async function copyText(text, button, ok='Скопировано ✓'){
  try{
    await navigator.clipboard.writeText(text);
  }catch{
    const ta=document.createElement('textarea');
    ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();
  }
  if(button){
    const old=button.textContent;
    button.textContent=ok;
    button.classList.add('copied');
    setTimeout(()=>{button.textContent=old;button.classList.remove('copied')},1300);
  }
}

async function ensureMathJax(){
  if(window.MathJax?.startup?.promise){await window.MathJax.startup.promise;return true}
  for(let i=0;i<100;i++){
    if(window.MathJax?.typesetPromise)return true;
    await new Promise(r=>setTimeout(r,50));
  }
  throw new Error('MathJax не загрузился. Проверь доступ к cdn.jsdelivr.net.');
}

function ensureDefinitionModal(){
  let modal=document.getElementById('definitionModal');
  if(modal)return modal;
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
          <button class="definition-copy" type="button" id="definitionCopy">Копировать определение</button>
          <button class="definition-go" type="button" id="definitionGo">Показать в конспекте</button>
        </div>
      </section>
    </div>`);
  modal=document.getElementById('definitionModal');
  modal.querySelectorAll('[data-def-close]').forEach(x=>x.addEventListener('click',closeDefinition));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeDefinition()});
  return modal;
}
function closeDefinition(){
  const modal=document.getElementById('definitionModal');
  if(modal)modal.hidden=true;
  document.body.classList.remove('definition-modal-open');
}
function prettyDefinitionTitle(id,label){
  const a=definitionAliases[id]?.[0];
  if(a)return a.charAt(0).toUpperCase()+a.slice(1);
  return label.replace(/[:.]$/,'')||'Определение';
}
function isDefinitionAnchor(anchor){
  if(definitionAliases[anchor.id])return true;
  let el=anchor.nextElementSibling;
  const txt=(el?.querySelector?.('strong')?.textContent||el?.textContent||'').trim();
  return /^Определение\b/i.test(txt) || /^(Модуль комплексного числа|Аргумент комплексного числа)/i.test(txt);
}
function definitionBoundary(el){
  if(!el)return true;
  if(el.matches?.('a[id],h1,h2,h3,h4,hr'))return true;
  const t=(el.querySelector?.(':scope > strong')?.textContent||'').trim();
  return /^(Теорема|Лемма|Следствие|Замечание|Пример|Д-во|Док-во|Доказательство)\b/i.test(t);
}
function extractDefinitionRaw(source,id){
  const lines=source.replace(/\r\n/g,'\n').split('\n');
  const anchorRx=new RegExp(`^<a\\s+id=["']${id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}["']\\s*><\\/a>$`,'i');
  let start=lines.findIndex(x=>anchorRx.test(x.trim()));
  if(start<0)return '';
  start++;
  let end=lines.length;
  for(let i=start+1;i<lines.length;i++){
    const t=lines[i].trim();
    if(/^<a\s+id=["'][^"']+["']\s*><\/a>$/i.test(t) || /^#{1,4}\s+/.test(t) || /^\*\*(Теорема|Лемма|Следствие|Замечание|Пример|Д-во|Док-во|Доказательство)\b/i.test(t)){
      end=i;break;
    }
  }
  return lines.slice(start,end).join('\n').trim();
}
function collectDefinitions(article,source){
  const defs=new Map();
  [...article.querySelectorAll('a[id]')].forEach(anchor=>{
    if(!isDefinitionAnchor(anchor))return;
    const nodes=[];
    let el=anchor.nextElementSibling;
    while(el&&nodes.length<24){
      if(nodes.length&&definitionBoundary(el))break;
      if(el.matches?.('a[id]'))break;
      nodes.push(el);el=el.nextElementSibling;
    }
    if(!nodes.length)return;
    const strong=nodes[0]?.querySelector?.('strong');
    const label=(strong?.textContent||'Определение').trim();
    const raw=extractDefinitionRaw(source,anchor.id);
    const title=prettyDefinitionTitle(anchor.id,label);
    defs.set(anchor.id,{id:anchor.id,anchor,nodes,label,title,raw});
    if(strong){
      const b=document.createElement('button');
      b.type='button';b.className='definition-trigger';b.dataset.definitionId=anchor.id;b.innerHTML=strong.innerHTML;
      strong.replaceWith(b);
    }
  });
  return defs;
}
function openDefinition(id,defs){
  const d=defs.get(id);if(!d)return;
  const modal=ensureDefinitionModal();
  modal.querySelector('#definitionModalTitle').textContent=d.title;
  const body=modal.querySelector('#definitionModalBody');
  body.innerHTML='';
  d.nodes.forEach(node=>{
    const clone=node.cloneNode(true);
    clone.querySelectorAll?.('.definition-trigger,.definition-term').forEach(x=>{
      const span=document.createElement(x.classList.contains('definition-trigger')?'strong':'span');
      span.innerHTML=x.innerHTML;x.replaceWith(span);
    });
    body.appendChild(clone);
  });
  modal.querySelector('#definitionCopy').onclick=e=>copyText(d.raw||d.nodes.map(n=>n.textContent).join('\n\n'),e.currentTarget);
  modal.querySelector('#definitionGo').onclick=()=>{
    closeDefinition();
    scrollToId(id);
  };
  modal.hidden=false;
  document.body.classList.add('definition-modal-open');
}
function escapeRegExp(s){return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function linkDefinitionTerms(article,defs){
  const entries=[];
  for(const [id,aliases] of Object.entries(definitionAliases)){
    if(!defs.has(id))continue;
    aliases.forEach(alias=>{if(alias.trim().length>=3)entries.push({id,alias:alias.trim()})});
  }
  entries.sort((a,b)=>b.alias.length-a.alias.length);

  const walker=document.createTreeWalker(article,NodeFilter.SHOW_TEXT,{
    acceptNode(node){
      const p=node.parentElement;
      if(!p||!node.nodeValue.trim())return NodeFilter.FILTER_REJECT;
      if(p.closest('a,button,code,pre,textarea,mjx-container,svg,script,style,.heading-copy'))return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);

  for(const node of nodes){
    let parts=[{text:node.nodeValue,linked:false}];
    for(const entry of entries){
      const rx=new RegExp(`(^|[^\\p{L}\\p{N}_])(${escapeRegExp(entry.alias)})(?=$|[^\\p{L}\\p{N}_])`,'giu');
      const next=[];
      for(const part of parts){
        if(part.linked){next.push(part);continue}
        let last=0,m;
        while((m=rx.exec(part.text))){
          const lead=m[1]||'',term=m[2],ts=m.index+lead.length;
          if(ts>last)next.push({text:part.text.slice(last,ts),linked:false});
          next.push({text:term,linked:true,id:entry.id});
          last=ts+term.length;
        }
        if(last<part.text.length)next.push({text:part.text.slice(last),linked:false});
      }
      parts=next;
    }
    if(parts.some(x=>x.linked)){
      const frag=document.createDocumentFragment();
      for(const p of parts){
        if(!p.linked){frag.appendChild(document.createTextNode(p.text));continue}
        const b=document.createElement('button');
        b.type='button';b.className='definition-term';b.dataset.definitionId=p.id;b.textContent=p.text;b.title='Показать определение';
        frag.appendChild(b);
      }
      node.replaceWith(frag);
    }
  }
}
function setupDefinitions(article,source){
  const defs=collectDefinitions(article,source);
  linkDefinitionTerms(article,defs);
  article.addEventListener('click',e=>{
    const trigger=e.target.closest('[data-definition-id]');
    if(trigger){e.preventDefault();e.stopPropagation();openDefinition(trigger.dataset.definitionId,defs)}
  });
  return defs;
}

function scrollToId(id){
  if(!id)return;
  const target=document.getElementById(id);
  if(!target)return;
  history.replaceState(null,'',`${location.pathname}${location.search}#${encodeURIComponent(id)}`);
  target.scrollIntoView({behavior:'smooth',block:'start'});
  const flash=target.matches('h1,h2,h3,h4')?target:target.nextElementSibling;
  flash?.classList.add('definition-flash');
  setTimeout(()=>flash?.classList.remove('definition-flash'),1300);
}

function attachSectionMetadata(article,sections){
  const headings=[...article.querySelectorAll('h1,h2,h3,h4')];
  const used=new Set();
  headings.forEach((h,i)=>{
    const s=sections[i];
    if(!s)return;
    let id=s.id;
    if(used.has(id)){let n=2;while(used.has(`${id}-${n}`))n++;id=`${id}-${n}`}
    used.add(id);
    h.id=id;
    h.dataset.sectionIndex=String(i);
    h.classList.add('navigable-heading');

    const btn=document.createElement('button');
    btn.type='button';
    btn.className='heading-copy';
    btn.dataset.copySection=String(i);
    btn.textContent=s.level===1?'Копировать раздел':s.level===2?'Копировать главу':s.level===3?'Копировать §':'Копировать';
    h.appendChild(btn);
  });
  article.addEventListener('click',e=>{
    const b=e.target.closest('[data-copy-section]');
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    const s=sections[Number(b.dataset.copySection)];
    if(s)copyText(s.raw,b);
  });
  return headings;
}

function buildNavigator(sections,headings,defs){
  const nav=document.getElementById('topicNav');
  const defNav=document.getElementById('definitionNav');
  if(!nav||!defNav)return;

  nav.innerHTML=sections.map((s,i)=>{
    const clean=s.title.replace(/[*_`]/g,'').replace(/\$([^$]+)\$/g,'$1');
    return `<button type="button" class="nav-item nav-level-${s.level}" data-nav-id="${esc(headings[i]?.id||s.id)}" data-nav-search="${esc(clean.toLowerCase())}">${esc(clean)}</button>`;
  }).join('');

  defNav.innerHTML=[...defs.values()].map(d=>
    `<button type="button" class="definition-nav-item" data-definition-id="${esc(d.id)}" data-nav-search="${esc((d.title+' '+d.label).toLowerCase())}"><span>${esc(d.title)}</span><small>${esc(d.label)}</small></button>`
  ).join('');

  document.querySelector('.study-sidebar')?.addEventListener('click',e=>{
    const n=e.target.closest('[data-nav-id]');
    if(n){e.preventDefault();scrollToId(n.dataset.navId);closeMobileNav()}
  });

  const search=document.getElementById('navSearch');
  search?.addEventListener('input',()=>{
    const q=search.value.trim().toLowerCase();
    document.querySelectorAll('.study-sidebar [data-nav-search]').forEach(el=>{
      el.style.display=!q||el.dataset.navSearch.includes(q)?'':'none';
    });
  });

  document.querySelectorAll('[data-nav-tab]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-nav-tab]').forEach(x=>x.classList.toggle('active',x===b));
    document.getElementById('topicNav').hidden=b.dataset.navTab!=='topics';
    document.getElementById('definitionNav').hidden=b.dataset.navTab!=='definitions';
  }));

  // Active topic tracking.
  let ticking=false;
  const update=()=>{
    ticking=false;
    let current=headings[0];
    const y=window.scrollY+130;
    for(const h of headings){
      if(h.offsetTop<=y)current=h;else break;
    }
    document.querySelectorAll('.nav-item.active').forEach(x=>x.classList.remove('active'));
    if(current){
      const b=nav.querySelector(`[data-nav-id="${CSS.escape(current.id)}"]`);
      b?.classList.add('active');
      b?.scrollIntoView({block:'nearest'});
    }
  };
  window.addEventListener('scroll',()=>{if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
  update();
}

function openMobileNav(){document.querySelector('.study-sidebar')?.classList.add('mobile-open');document.querySelector('.sidebar-shade')?.classList.add('show');document.body.classList.add('nav-open')}
function closeMobileNav(){document.querySelector('.study-sidebar')?.classList.remove('mobile-open');document.querySelector('.sidebar-shade')?.classList.remove('show');document.body.classList.remove('nav-open')}

function bindArticleInternalLinks(article,defs){
  // One delegated handler. Hash links NEVER go through the application router.
  article.addEventListener('click',e=>{
    const a=e.target.closest('a[href^="#"]');
    if(!a)return;
    e.preventDefault();
    e.stopPropagation();
    let id=a.getAttribute('href').slice(1);
    try{id=decodeURIComponent(id)}catch{}
    if(defs.has(id))openDefinition(id,defs);
    else scrollToId(id);
  });
}

function renderReaderChrome(item){
  return `
    <div class="article-shell">
      <header class="article-head">
        <div class="article-head-main">
          <a class="back" href="./">← Все материалы</a>
          <h1>${esc(item.title)}</h1>
          <p>${esc(item.subtitle)}</p>
        </div>
        <div class="reader-actions">
          <button type="button" id="mobileNavButton" class="reader-action mobile-nav-button">Навигация</button>
          <button type="button" id="copyWhole" class="reader-action">Копировать весь конспект</button>
          <button type="button" id="copyPageLink" class="reader-action">Скопировать ссылку</button>
        </div>
      </header>
      <div class="sidebar-shade"></div>
      <div class="article-layout study-layout">
        <aside class="study-sidebar">
          <div class="sidebar-mobile-head"><strong>Навигация</strong><button type="button" id="closeMobileNav">×</button></div>
          <input id="navSearch" class="nav-search" type="search" placeholder="Найти тему…">
          <div class="nav-tabs">
            <button type="button" class="nav-tab active" data-nav-tab="topics">Темы</button>
            <button type="button" class="nav-tab" data-nav-tab="definitions">Определения</button>
          </div>
          <nav id="topicNav" class="topic-nav"></nav>
          <nav id="definitionNav" class="definition-nav" hidden></nav>
        </aside>
        <article class="article" id="article"></article>
      </div>
    </div>`;
}

async function renderArticle(item){
  APP.innerHTML='<div class="loading">Загружаю статью и математику…</div>';
  try{
    const resp=await fetch('./'+encodeURI(item.source),{cache:'no-store'});
    if(!resp.ok)throw new Error(`Не удалось загрузить ${item.source}: HTTP ${resp.status}`);
    const source=await resp.text();
    const ticketData=splitTickets(source);

    APP.innerHTML=renderReaderChrome(item);
    const article=document.getElementById('article');

    if(ticketData.tickets.length){
      article.innerHTML=`
        ${markdownToHtml(ticketData.intro)}
        ${ticketData.tickets.map(t=>`
          <section class="ticket" id="${t.id}" data-ticket>
            <div class="ticket-actions"><button class="copy-btn" data-copy-ticket="${t.number}">Копировать билет</button></div>
            ${markdownToHtml(t.raw)}
            <textarea hidden data-ticket-source="${t.number}">${esc(t.copy)}</textarea>
          </section>`).join('')}`;
    }else{
      article.innerHTML=markdownToHtml(source);
    }

    document.title=`${item.title} — notes`;
    await ensureMathJax();
    await MathJax.typesetPromise([article]);

    const sections=parseSections(source);
    const headings=attachSectionMetadata(article,sections);
    const defs=setupDefinitions(article,source);
    bindArticleInternalLinks(article,defs);
    buildNavigator(sections,headings,defs);

    article.addEventListener('click',e=>{
      const b=e.target.closest('[data-copy-ticket]');
      if(!b)return;
      const ta=article.querySelector(`[data-ticket-source="${b.dataset.copyTicket}"]`);
      if(ta)copyText(ta.value,b);
    });

    document.getElementById('copyWhole').onclick=e=>copyText(source,e.currentTarget);
    document.getElementById('copyPageLink').onclick=e=>copyText(location.href,e.currentTarget,'Ссылка скопирована ✓');
    document.getElementById('mobileNavButton').onclick=openMobileNav;
    document.getElementById('closeMobileNav').onclick=closeMobileNav;
    document.querySelector('.sidebar-shade').onclick=closeMobileNav;

    // Handle initial anchor only after article and definitions exist.
    if(location.hash){
      let id=location.hash.slice(1);
      try{id=decodeURIComponent(id)}catch{}
      if(defs.has(id))openDefinition(id,defs);
      else setTimeout(()=>scrollToId(id),40);
    }
  }catch(e){
    APP.innerHTML=`<div class="error-box"><h2>Не удалось открыть материал</h2><p>${esc(e.message)}</p><p><a href="./">← На главную</a></p></div>`;
  }
}

function route(){
  const params=new URLSearchParams(location.search);
  let slug=params.get('note');

  // One-time compatibility with the old URL #linear-algebra-1.
  if(!slug&&location.hash){
    const maybe=location.hash.slice(1);
    const old=mdItems().find(x=>x.slug===maybe);
    if(old){
      slug=maybe;
      history.replaceState(null,'',`${location.pathname}?note=${encodeURIComponent(slug)}`);
    }
  }

  if(!slug){renderHome();return}
  const item=mdItems().find(x=>x.slug===slug);
  if(item)renderArticle(item);
  else renderHome();
}

// IMPORTANT: no hashchange listener. Hash is reserved for navigation INSIDE an article.
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

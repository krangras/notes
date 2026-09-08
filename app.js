const APP = document.getElementById('app');

const groups = [
  {
    title: 'Математика',
    description: 'Основные математические дисциплины',
    items: [
      {title:'Линейная алгебра', subtitle:'1 семестр · 24 экзаменационных билета', badge:'24 билета', kind:'md', source:'Линейная_алгебра_1_семестр.md', slug:'linear-algebra-1'},
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

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));

const mdItems = () => groups.flatMap(g => g.items).filter(x => x.kind === 'md');

function noteHref(slug, anchor='') {
  return `?note=${encodeURIComponent(slug)}${anchor ? '#'+encodeURIComponent(anchor) : ''}`;
}

function renderHome() {
  history.replaceState(null, '', location.pathname);
  document.title = 'Учебные материалы';

  APP.innerHTML = `
    <div class="shell">
      <section class="hero">
        <p class="eyebrow">Личный справочник</p>
        <h1>Учебные материалы</h1>
        <p>Конспекты, билеты, лекции и практика — в одном месте.</p>
        <input id="search" class="search" type="search" placeholder="Найти дисциплину или материал…">
      </section>

      <section class="catalog">
        ${groups.map(g => `
          <section class="group" data-group>
            <div class="group-head">
              <div>
                <h2>${esc(g.title)}</h2>
                <p>${esc(g.description)}</p>
              </div>
            </div>
            <div class="grid">
              ${g.items.map(it => `
                <a class="card"
                   data-card
                   data-key="${esc((it.title+' '+it.subtitle+' '+g.title).toLowerCase())}"
                   href="${it.kind === 'md' ? noteHref(it.slug) : './'+encodeURI(it.source)}"
                   ${it.kind === 'pdf' ? 'target="_blank" rel="noopener"' : ''}>
                  <div>
                    <h3>${esc(it.title)}</h3>
                    <p>${esc(it.subtitle)}</p>
                  </div>
                  <div class="card-bottom">
                    <span class="badge">${esc(it.badge)}</span>
                    <span>↗</span>
                  </div>
                </a>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </section>
    </div>
  `;

  const input = document.getElementById('search');
  input?.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();

    document.querySelectorAll('[data-card]').forEach(card => {
      card.style.display = !q || card.dataset.key.includes(q) ? '' : 'none';
    });

    document.querySelectorAll('[data-group]').forEach(group => {
      group.style.display = [...group.querySelectorAll('[data-card]')]
        .some(x => x.style.display !== 'none') ? '' : 'none';
    });
  });
}

/* ---------------- Markdown + Math ---------------- */

function stashMath(md) {
  const math = [];
  const put = raw => {
    const key = `@@MATH${math.length}@@`;
    math.push(raw);
    return key;
  };

  let s = md;
  s = s.replace(/```math\s*\n([\s\S]*?)```/gi, (_, x) => put(`$$${x.trim()}$$`));
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, m => put(m));
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, m => put(m));
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, m => put(m));
  s = s.replace(/(^|[^\\$])\$(?!\$)([^\n$]+?)(?<!\\)\$/g, (m,p,x) => p + put(`$${x}$`));
  return {s, math};
}

function restoreMath(html, math) {
  return math.reduce((h,m,i) => h.replaceAll(`@@MATH${i}@@`, m), html);
}

function inlineFormat(source) {
  const {s, math} = stashMath(source);

  let html = esc(s);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');

  return restoreMath(html, math);
}

function markdownToHtml(source) {
  const {s, math} = stashMath(source.replace(/\r\n/g, '\n'));
  const lines = s.split('\n');

  let out = [];
  let para = [];
  let list = null;
  let quote = [];
  let code = false;
  let codeLang = '';
  let codeLines = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inlineFormat(para.join(' '))}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(`<blockquote>${markdownToHtml(quote.join('\n'))}</blockquote>`);
      quote = [];
    }
  };

  for (const line of lines) {
    if (code) {
      if (/^```/.test(line)) {
        const cls = codeLang ? ` class="language-${esc(codeLang)}"` : '';
        out.push(`<pre data-code-lang="${esc(codeLang)}"><code${cls}>${esc(codeLines.join('\n'))}</code></pre>`);
        code = false;
        codeLang = '';
        codeLines = [];
      } else {
        codeLines.push(line);
      }
      continue;
    }

    if (/^```/.test(line)) {
      flushPara(); flushList(); flushQuote();
      code = true;
      codeLang = line.slice(3).trim();
      continue;
    }

    if (/^\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      continue;
    }

    if (/^<a\s+id=["'][^"']+["']\s*><\/a>\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      out.push(line);
      continue;
    }

    if (/^---+\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      out.push('<hr>');
      continue;
    }

    const hm = line.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      flushPara(); flushList(); flushQuote();
      const n = hm[1].length;
      out.push(`<h${n}>${inlineFormat(hm[2])}</h${n}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flushPara(); flushList();
      quote.push(line.replace(/^>\s?/, ''));
      continue;
    }

    const ul = line.match(/^\s*[-*+]\s+(.+)$/);
    if (ul) {
      flushPara(); flushQuote();
      if (list !== 'ul') {
        flushList();
        list = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      continue;
    }

    const ol = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (ol) {
      flushPara(); flushQuote();
      if (list !== 'ol') {
        flushList();
        list = 'ol';
        out.push('<ol>');
      }
      out.push(`<li>${inlineFormat(ol[1])}</li>`);
      continue;
    }

    // Existing HTML (images / centered captions).
    if (/^\s*</.test(line) && />\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      out.push(line);
      continue;
    }

    para.push(line.trim());
  }

  flushPara(); flushList(); flushQuote();

  if (codeLines.length) {
    out.push(`<pre data-code-lang="${esc(codeLang)}"><code>${esc(codeLines.join('\n'))}</code></pre>`);
  }

  return restoreMath(out.join('\n'), math);
}

/* ---------------- Source structure ---------------- */

function removeInlineContents(intro) {
  // The huge Markdown TOC at the top duplicates the new sidebar.
  // Keep the document title / introductory note, remove only "## Содержание" + its list.
  const lines = intro.replace(/\r\n/g, '\n').split('\n');
  const idx = lines.findIndex(x => /^##\s+Содержание\s*$/i.test(x.trim()));

  if (idx < 0) return intro;

  let end = idx + 1;
  while (end < lines.length) {
    const t = lines[end].trim();

    if (!t || /^\d+\.\s+\[/.test(t) || /^[-*+]\s+\[/.test(t)) {
      end++;
      continue;
    }

    if (/^---+$/.test(t)) {
      end++;
      break;
    }

    break;
  }

  return [...lines.slice(0, idx), ...lines.slice(end)].join('\n').trim();
}

function cleanTicketRaw(raw) {
  return raw
    .replace(/\n?\[↑\s*К содержанию\]\([^)]+\)\s*/gi, '\n')
    .replace(/\n?---\s*$/g, '')
    .trim();
}

function slugText(s) {
  return s
    .replace(/\$[^$]*\$/g, 'math')
    .replace(/[*_`~]/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

function splitTickets(source) {
  const re = /<a\s+id=["']ticket-(\d+)["']\s*><\/a>/gi;
  const matches = [...source.matchAll(re)];

  if (!matches.length) {
    return {intro: source, tickets: []};
  }

  const intro = source.slice(0, matches[0].index).trim();

  const tickets = matches.map((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i+1].index : source.length;
    const rawOriginal = source.slice(start, end).trim();
    const raw = cleanTicketRaw(rawOriginal);

    const titleMd = raw.match(/^##\s+(.+)$/m)?.[1] || `Билет ${m[1]}`;

    const headings = [];
    const lines = raw.split('\n');

    for (let li=0; li<lines.length; li++) {
      const hm = lines[li].match(/^(#{3,5})\s+(.+)$/);
      if (!hm) continue;

      headings.push({
        level: hm[1].length,
        titleMd: hm[2].trim(),
        line: li,
        id: `ticket-${m[1]}-${slugText(hm[2])}-${headings.length+1}`
      });
    }

    // Source range for every subheading so each topic can be copied separately.
    headings.forEach((h, hi) => {
      let endLine = lines.length;

      for (let j=hi+1; j<headings.length; j++) {
        if (headings[j].level <= h.level) {
          endLine = headings[j].line;
          break;
        }
      }

      h.raw = lines.slice(h.line, endLine).join('\n').trim();
    });

    return {
      id: `ticket-${m[1]}`,
      number: Number(m[1]),
      titleMd,
      raw,
      headings
    };
  });

  return {intro, tickets};
}

/* ---------------- Clipboard ---------------- */

async function copyText(text, button, okText='Скопировано ✓') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  if (!button) return;

  const old = button.dataset.oldLabel || button.textContent;
  button.dataset.oldLabel = old;
  button.textContent = okText;
  button.classList.add('copied');

  setTimeout(() => {
    button.textContent = old;
    button.classList.remove('copied');
  }, 1200);
}

/* ---------------- Readiness progress ---------------- */

function progressKey(slug) {
  return `notes-ready:${slug}:v1`;
}

function loadReady(slug) {
  try {
    const raw = JSON.parse(localStorage.getItem(progressKey(slug)) || '[]');
    return new Set(Array.isArray(raw) ? raw.map(Number) : []);
  } catch {
    return new Set();
  }
}

function saveReady(slug, ready) {
  localStorage.setItem(progressKey(slug), JSON.stringify([...ready].sort((a,b)=>a-b)));
}

function readinessPercent(ready, total) {
  return total ? Math.round(ready.size / total * 100) : 0;
}

function updateProgressUI(slug, ready, total) {
  const pct = readinessPercent(ready, total);

  document.querySelectorAll('[data-ready-percent]').forEach(el => {
    el.textContent = `${pct}%`;
  });

  document.querySelectorAll('[data-ready-count]').forEach(el => {
    el.textContent = `${ready.size} / ${total}`;
  });

  document.querySelectorAll('[data-ready-bar]').forEach(el => {
    el.style.width = `${pct}%`;
  });

  document.querySelectorAll('[data-ready-ticket]').forEach(btn => {
    const num = Number(btn.dataset.readyTicket);
    const isReady = ready.has(num);
    btn.classList.toggle('is-ready', isReady);
    btn.setAttribute('aria-pressed', String(isReady));
    btn.title = isReady ? 'Убрать отметку «готов»' : 'Отметить билет как готовый';

    const icon = btn.querySelector('[data-ready-icon]');
    if (icon) icon.textContent = isReady ? '✓' : '';
  });

  const mobile = document.getElementById('mobileTicketsButton');
  if (mobile) {
    mobile.querySelector('[data-mobile-progress]').textContent = `${pct}%`;
  }

  saveReady(slug, ready);
}

/* ---------------- Sidebar ---------------- */

function renderSidebar(item, tickets, ready) {
  const total = tickets.length;
  const pct = readinessPercent(ready, total);

  return `
    <aside class="ticket-sidebar" id="ticketSidebar">
      <div class="sidebar-mobile-head">
        <strong>Билеты</strong>
        <button type="button" class="sidebar-close" id="sidebarClose" aria-label="Закрыть">×</button>
      </div>

      <section class="readiness-card">
        <div class="readiness-top">
          <div>
            <span class="readiness-label">Готовность</span>
            <strong data-ready-percent>${pct}%</strong>
          </div>
          <span class="readiness-count" data-ready-count>${ready.size} / ${total}</span>
        </div>

        <div class="readiness-track">
          <div class="readiness-fill" data-ready-bar style="width:${pct}%"></div>
        </div>

        <p>Отмечай выученные билеты. Прогресс сохраняется на этом устройстве.</p>
      </section>

      <div class="sidebar-tools">
        <input id="ticketSearch" class="ticket-search" type="search" placeholder="Найти билет или теорему…">
        <button type="button" class="sidebar-mini-btn" id="collapseAll">Свернуть всё</button>
      </div>

      <nav class="ticket-nav" id="ticketNav">
        ${tickets.map(t => `
          <section class="ticket-nav-group" data-ticket-nav-group="${t.number}"
                   data-search-text="${esc((t.titleMd+' '+t.headings.map(h=>h.titleMd).join(' ')).toLowerCase())}">
            <div class="ticket-nav-row">
              <button type="button"
                      class="ready-toggle ${ready.has(t.number) ? 'is-ready' : ''}"
                      data-ready-ticket="${t.number}"
                      aria-pressed="${ready.has(t.number)}"
                      title="${ready.has(t.number) ? 'Убрать отметку «готов»' : 'Отметить билет как готовый'}">
                <span data-ready-icon>${ready.has(t.number) ? '✓' : ''}</span>
              </button>

              <button type="button"
                      class="ticket-nav-link"
                      data-scroll-id="${t.id}">
                <span class="ticket-number">${t.number}</span>
                <span class="ticket-title">${inlineFormat(t.titleMd)}</span>
              </button>

              <button type="button"
                      class="ticket-expand"
                      data-expand-ticket="${t.number}"
                      aria-label="Показать темы билета"
                      aria-expanded="false">⌄</button>

              <button type="button"
                      class="ticket-copy-mini"
                      data-copy-ticket="${t.number}"
                      aria-label="Копировать билет"
                      title="Копировать билет">⧉</button>
            </div>

            <div class="ticket-subnav" data-subnav="${t.number}" hidden>
              ${t.headings.map((h,hi) => `
                <div class="subnav-row subnav-level-${Math.min(h.level,5)}">
                  <button type="button"
                          class="subnav-link"
                          data-scroll-id="${h.id}">
                    ${inlineFormat(h.titleMd)}
                  </button>
                  <button type="button"
                          class="subnav-copy"
                          data-copy-subtopic="${t.number}:${hi}"
                          title="Копировать эту тему"
                          aria-label="Копировать эту тему">⧉</button>
                </div>
              `).join('')}
            </div>
          </section>
        `).join('')}
      </nav>
    </aside>
  `;
}

/* ---------------- Article ---------------- */

function renderTicket(t) {
  const html = markdownToHtml(t.raw);

  return `
    <section class="ticket" id="${t.id}" data-ticket="${t.number}">
      <div class="ticket-toolbar">
        <div class="ticket-toolbar-left">
          <span class="ticket-pill">Билет ${t.number}</span>
          <button type="button"
                  class="article-ready-btn"
                  data-ready-ticket="${t.number}">
            <span class="ready-dot" data-ready-icon></span>
            <span>Готов</span>
          </button>
        </div>

        <button type="button"
                class="copy-btn"
                data-copy-ticket="${t.number}">Копировать билет</button>
      </div>

      <div class="ticket-content">${html}</div>
    </section>
  `;
}

function assignSubheadingIds(article, tickets) {
  for (const t of tickets) {
    const ticketEl = article.querySelector(`#${CSS.escape(t.id)}`);
    if (!ticketEl) continue;

    const headings = [...ticketEl.querySelectorAll('h3,h4,h5')];

    t.headings.forEach((h, i) => {
      if (headings[i]) {
        headings[i].id = h.id;
        headings[i].classList.add('subtopic-heading');

        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'heading-copy-btn';
        copy.dataset.copySubtopic = `${t.number}:${i}`;
        copy.textContent = 'Копировать тему';

        headings[i].appendChild(copy);
      }
    });
  }
}

/* ---------------- Navigation behavior ---------------- */

function scrollToId(id) {
  const target = document.getElementById(id);
  if (!target) return;

  history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(id)}`);
  target.scrollIntoView({behavior:'smooth', block:'start'});

  const flash = target.matches('.ticket') ? target.querySelector('h2') : target;
  flash?.classList.add('jump-flash');
  setTimeout(() => flash?.classList.remove('jump-flash'), 1000);
}

function setExpanded(num, expanded) {
  const sub = document.querySelector(`[data-subnav="${num}"]`);
  const btn = document.querySelector(`[data-expand-ticket="${num}"]`);
  if (!sub || !btn) return;

  sub.hidden = !expanded;
  btn.classList.toggle('expanded', expanded);
  btn.setAttribute('aria-expanded', String(expanded));
}

function openSidebar() {
  document.getElementById('ticketSidebar')?.classList.add('mobile-open');
  document.getElementById('sidebarShade')?.classList.add('show');
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.getElementById('ticketSidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebarShade')?.classList.remove('show');
  document.body.classList.remove('sidebar-open');
}

function setupActiveTracking(tickets) {
  const ticketElements = tickets
    .map(t => document.getElementById(t.id))
    .filter(Boolean);

  let raf = 0;

  const update = () => {
    raf = 0;
    const y = window.scrollY + 150;
    let active = ticketElements[0];

    for (const el of ticketElements) {
      if (el.offsetTop <= y) active = el;
      else break;
    }

    if (!active) return;

    const num = Number(active.dataset.ticket);

    document.querySelectorAll('.ticket-nav-group.active')
      .forEach(x => x.classList.remove('active'));

    const group = document.querySelector(`[data-ticket-nav-group="${num}"]`);
    group?.classList.add('active');

    // On desktop keep current ticket's children visible.
    if (matchMedia('(min-width: 901px)').matches) {
      setExpanded(num, true);
    }

    const sidebar = document.getElementById('ticketNav');
    if (sidebar && group) {
      const top = group.offsetTop;
      const bottom = top + group.offsetHeight;

      if (top < sidebar.scrollTop || bottom > sidebar.scrollTop + sidebar.clientHeight) {
        group.scrollIntoView({block:'nearest'});
      }
    }
  };

  window.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(update);
  }, {passive:true});

  update();
}

function setupSidebar(item, tickets, ready) {
  const sidebar = document.getElementById('ticketSidebar');

  sidebar?.addEventListener('click', e => {
    const scrollBtn = e.target.closest('[data-scroll-id]');
    if (scrollBtn) {
      scrollToId(scrollBtn.dataset.scrollId);

      if (matchMedia('(max-width: 900px)').matches) {
        closeSidebar();
      }
      return;
    }

    const expand = e.target.closest('[data-expand-ticket]');
    if (expand) {
      const num = Number(expand.dataset.expandTicket);
      const sub = document.querySelector(`[data-subnav="${num}"]`);
      setExpanded(num, sub?.hidden ?? true);
      return;
    }

    const readyBtn = e.target.closest('[data-ready-ticket]');
    if (readyBtn) {
      const num = Number(readyBtn.dataset.readyTicket);

      if (ready.has(num)) ready.delete(num);
      else ready.add(num);

      updateProgressUI(item.slug, ready, tickets.length);
      return;
    }
  });

  const search = document.getElementById('ticketSearch');
  search?.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();

    document.querySelectorAll('[data-ticket-nav-group]').forEach(group => {
      const show = !q || group.dataset.searchText.includes(q);
      group.style.display = show ? '' : 'none';

      if (q && show) {
        const num = Number(group.dataset.ticketNavGroup);
        setExpanded(num, true);
      }
    });
  });

  document.getElementById('collapseAll')?.addEventListener('click', () => {
    tickets.forEach(t => setExpanded(t.number, false));
  });

  document.getElementById('sidebarClose')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarShade')?.addEventListener('click', closeSidebar);
  document.getElementById('mobileTicketsButton')?.addEventListener('click', openSidebar);
}

/* ---------------- MathJax ---------------- */

async function ensureMathJax() {
  if (window.MathJax?.startup?.promise) {
    await window.MathJax.startup.promise;
    return true;
  }

  for (let i=0; i<120; i++) {
    if (window.MathJax?.typesetPromise) return true;
    await new Promise(r => setTimeout(r, 50));
  }

  throw new Error('MathJax не загрузился. Проверь доступ к cdn.jsdelivr.net.');
}

/* ---------------- Article boot ---------------- */

async function renderArticle(item) {
  APP.innerHTML = '<div class="loading">Загружаю конспект…</div>';

  try {
    const resp = await fetch('./' + encodeURI(item.source), {cache:'no-store'});

    if (!resp.ok) {
      throw new Error(`Не удалось загрузить ${item.source}: HTTP ${resp.status}`);
    }

    const source = await resp.text();
    const {intro, tickets} = splitTickets(source);
    const cleanIntro = removeInlineContents(intro);
    const ready = loadReady(item.slug);

    APP.innerHTML = `
      <div class="article-shell">
        <header class="article-head">
          <div class="article-title-block">
            <a class="back" href="./">← Все материалы</a>
            <h1>${esc(item.title)}</h1>
            <p>${esc(item.subtitle)}</p>
          </div>

          <div class="article-top-actions">
            <button type="button" class="top-action" id="copyWhole">Копировать весь конспект</button>
            <button type="button" class="top-action" id="copyLink">Скопировать ссылку</button>
          </div>
        </header>

        <div class="mobile-reader-bar">
          <button type="button" class="mobile-tickets-button" id="mobileTicketsButton">
            <span>Билеты</span>
            <strong data-mobile-progress>${readinessPercent(ready, tickets.length)}%</strong>
          </button>

          <div class="mobile-ready-track">
            <div class="mobile-ready-fill"
                 data-ready-bar
                 style="width:${readinessPercent(ready,tickets.length)}%"></div>
          </div>
        </div>

        <div class="sidebar-shade" id="sidebarShade"></div>

        <div class="article-layout">
          ${renderSidebar(item, tickets, ready)}

          <article class="article" id="article">
            ${cleanIntro ? `<section class="article-intro">${markdownToHtml(cleanIntro)}</section>` : ''}
            ${tickets.map(renderTicket).join('')}
          </article>
        </div>
      </div>
    `;

    const article = document.getElementById('article');
    assignSubheadingIds(article, tickets);

    // Set ready state in article buttons immediately.
    updateProgressUI(item.slug, ready, tickets.length);

    // Copy actions use ORIGINAL Markdown / LaTeX source.
    document.addEventListener('click', function readerCopyHandler(e) {
      const ticketBtn = e.target.closest('[data-copy-ticket]');
      if (ticketBtn && APP.contains(ticketBtn)) {
        const num = Number(ticketBtn.dataset.copyTicket);
        const ticket = tickets.find(t => t.number === num);
        if (ticket) copyText(ticket.raw, ticketBtn);
        return;
      }

      const subBtn = e.target.closest('[data-copy-subtopic]');
      if (subBtn && APP.contains(subBtn)) {
        const [tn, hi] = subBtn.dataset.copySubtopic.split(':').map(Number);
        const ticket = tickets.find(t => t.number === tn);
        const sub = ticket?.headings?.[hi];
        if (sub) copyText(sub.raw, subBtn);
        return;
      }

      const articleReady = e.target.closest('.article-ready-btn[data-ready-ticket]');
      if (articleReady && APP.contains(articleReady)) {
        const num = Number(articleReady.dataset.readyTicket);

        if (ready.has(num)) ready.delete(num);
        else ready.add(num);

        updateProgressUI(item.slug, ready, tickets.length);
      }
    }, {signal: window.__notesReaderAbort?.signal});

    document.getElementById('copyWhole')?.addEventListener('click', e => {
      copyText(source, e.currentTarget);
    });

    document.getElementById('copyLink')?.addEventListener('click', e => {
      copyText(location.href, e.currentTarget, 'Ссылка скопирована ✓');
    });

    setupSidebar(item, tickets, ready);

    // Internal Markdown links never control routing.
    article.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;

      e.preventDefault();

      let id = a.getAttribute('href').slice(1);
      try { id = decodeURIComponent(id); } catch {}

      // Old "↑ К содержанию" links are intentionally converted to sidebar/top.
      if (/содержание/i.test(id)) {
        if (matchMedia('(max-width: 900px)').matches) openSidebar();
        else window.scrollTo({top:0, behavior:'smooth'});
        return;
      }

      scrollToId(id);
    });

    await ensureMathJax();

    // Critical fix: render math BOTH in article and sidebar.
    await MathJax.typesetPromise([
      article,
      document.getElementById('ticketSidebar')
    ]);

    setupActiveTracking(tickets);

    // Open first ticket on desktop for discoverability.
    if (tickets[0] && matchMedia('(min-width: 901px)').matches) {
      setExpanded(tickets[0].number, true);
    }

    // Restore deep link.
    if (location.hash) {
      let id = location.hash.slice(1);
      try { id = decodeURIComponent(id); } catch {}
      setTimeout(() => scrollToId(id), 80);
    }

    document.title = `${item.title} — notes`;

  } catch (e) {
    console.error(e);

    APP.innerHTML = `
      <div class="error-box">
        <h2>Не удалось открыть материал</h2>
        <p>${esc(e.message)}</p>
        <p><a href="./">← На главную</a></p>
      </div>
    `;
  }
}

/* ---------------- Router ---------------- */

function route() {
  // Cancel listeners from previous article render.
  if (window.__notesReaderAbort) window.__notesReaderAbort.abort();
  window.__notesReaderAbort = new AbortController();

  const params = new URLSearchParams(location.search);
  let slug = params.get('note');

  // Compatibility with old URLs: /notes/#linear-algebra-1
  if (!slug && location.hash) {
    const oldSlug = location.hash.slice(1);
    const oldItem = mdItems().find(x => x.slug === oldSlug);

    if (oldItem) {
      slug = oldSlug;
      history.replaceState(null, '', noteHref(slug));
    }
  }

  if (!slug) {
    renderHome();
    return;
  }

  const item = mdItems().find(x => x.slug === slug);

  if (!item) {
    renderHome();
    return;
  }

  renderArticle(item);
}

// IMPORTANT: no hashchange routing.
// #ticket-... is reserved only for navigation inside the current article.
window.addEventListener('popstate', route);

document.getElementById('brandLink')?.addEventListener('click', e => {
  e.preventDefault();
  history.pushState(null, '', location.pathname);
  renderHome();
});

window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  const pct = max > 0 ? scrollY / max * 100 : 0;
  document.getElementById('readingProgress').style.width = `${pct}%`;
}, {passive:true});

route();

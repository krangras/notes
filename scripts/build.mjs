import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const OUT = path.join(ROOT, config.outputDir);

const MarkdownIt = require('markdown-it');

const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const texInput = new TeX({ packages: AllPackages });
const svgOutput = new SVG({ fontCache: 'local' });
const mathDocument = mathjax.document('', { InputJax: texInput, OutputJax: svgOutput });

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderMath(latex, display) {
  try {
    const node = mathDocument.convert(latex, { display });
    return adaptor.outerHTML(node);
  } catch (e) {
    const msg = esc(e.message || String(e));
    return `<span class="math-error" title="${msg}">[${esc(latex.slice(0, 120))}]</span>`;
  }
}

function stashMath(md) {
  const math = [];
  const put = (raw, display) => {
    const k = `@@MATH${math.length}@@`;
    math.push({ raw, display });
    return k;
  };
  let s = md;
  s = s.replace(/```math\s*\n([\s\S]*?)```/gi, (_, x) => put(x.trim(), true));
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_, x) => put(x, true));
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_, x) => put(x.trim(), true));
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, (_, x) => put(x, false));
  s = s.replace(/(^|[^\\$])\$(?!\$)([^\n$]+?)(?<!\\)\$/g, (m, p, x) => p + put(x, false));
  return { s, math };
}

function restoreMath(html, math) {
  return math.reduce((h, { raw, display }, i) => {
    const k = `@@MATH${i}@@`;
    const svg = renderMath(raw, display);
    if (display) {
      h = h.replace(new RegExp(`<p>\\s*${k}\\s*<\\/p>`), `<div class="math-display">${svg}</div>`);
    }
    h = h.replace(new RegExp(k, 'g'), svg);
    return h;
  }, html);
}

const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
  breaks: false
});

function slugify(text) {
  return text
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/[*_`~]/g, '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110) || 'section';
}

function parseSections(source) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  const used = new Map();
  let lastAnchor = null;

  for (let i = 0; i < lines.length; i++) {
    const a = lines[i].trim().match(/^<a\s+id=["']([^"']+)["']\s*><\/a>$/i);
    if (a) { lastAnchor = a[1]; continue; }
    if (!lines[i].trim()) continue;
    const h = lines[i].match(/^(?:\s*>)?\s*(#{1,6})\s+(.+)$/);
    if (!h) { lastAnchor = null; continue; }

    const level = h[1].length;
    const title = h[2].trim();
    const fromAnchor = !!lastAnchor;
    let id = lastAnchor || slugify(title);
    const count = used.get(id) || 0;
    used.set(id, count + 1);
    if (count) id = `${id}-${count + 1}`;

    sections.push({ level, title, id, fromAnchor });
    lastAnchor = null;
  }
  return sections;
}

function assignHeadingIds(html, sections) {
  let idx = 0;
  return html.replace(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
    if (/\bid=/.test(attrs)) return m;
    const s = sections[idx];
    idx++;
    if (!s || s.fromAnchor) return m;
    return `<${tag} id="${esc(s.id)}"${attrs}>${inner}</${tag}>`;
  });
}

function prepareSource(source) {
  if (/<a\s+id="ticket-\d+"\s*><\/a>/i.test(source)) {
    return { source, unit: 'ticket', re: /<a\s+id="ticket-(\d+)"\s*><\/a>/gi };
  }
  if (/^#{3}\s+§/m.test(source)) {
    let n = 0;
    const out = source.replace(/^#{3}\s+§.*$/gm, m => `<a id="paragraph-${++n}"></a>\n${m}`);
    return { source: out, unit: 'paragraph', re: /<a\s+id="paragraph-(\d+)"\s*><\/a>/gi };
  }
  return { source, unit: null, re: null };
}

function wrapCopySections(html, source, re, unit) {
  if (!re.test(html)) return html;
  re.lastIndex = 0;

  const label = unit === 'paragraph' ? 'параграф' : 'билет';
  const srcMatches = [...source.matchAll(re)];
  const srcSplits = source.split(re);
  const parts = html.split(re);

  let out = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const num = parts[i];
    const seg = parts[i + 1] ?? '';
    const raw = srcMatches[(i - 1) / 2]
      ? (srcSplits[(i - 1) / 2 + 1] ?? '')
          .replace(/\n?\[↑\s*К содержанию\]\([^\n]+\)\s*/gi, '\n')
          .replace(/\n?\s*---\s*$/g, '')
          .trim()
      : '';
    out += `
    <section class="copy-section" id="${unit}-${num}">
      <div class="copy-actions">
        <button class="copy-btn" type="button" data-copy-id="${num}" data-copy-label="Копировать ${label}">Копировать ${label}</button>
      </div>
      ${seg}
      <textarea class="copy-source" hidden>${esc(raw)}</textarea>
    </section>`;
  }
  return out;
}

function markdownToStaticHtml(sourceRaw) {
  const { source, unit, re } = prepareSource(sourceRaw.replace(/\r\n/g, '\n'));
  const { s, math } = stashMath(source);
  const sections = parseSections(source);
  let html = md.render(s);
  html = assignHeadingIds(html, sections);
  html = restoreMath(html, math);
  if (unit) html = wrapCopySections(html, source, re, unit);
  return { html, sections };
}

function tocLabel(title) {
  const tex = [];
  const put = (raw) => {
    const k = `@@TEX${tex.length}@@`;
    tex.push(raw);
    return k;
  };
  const s = title
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, x) => put(x.trim()))
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, x) => put(x))
    .replace(/\$([^$\n]+?)\$/g, (_, x) => put(x.trim()))
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, x) => put(x));
  return esc(s).replace(/@@TEX(\d+)@@/g, (_, i) => renderMath(tex[i], false));
}

function tocHtml(sections) {
  return sections
    .filter(s => s.title.trim().toLowerCase() !== 'содержание')
    .filter(s => s.level <= 2 || s.title.trim().startsWith('§'))
    .map(s => {
      const level = s.level > 2 ? 3 : s.level;
      return `<a class="toc-link toc-level-${level}" href="#${esc(s.id)}">${tocLabel(s.title)}</a>`;
    })
    .join('');
}

function notePage({ note, content, sections }) {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(note.title)} — ${esc(config.siteTitle)}</title>
<meta name="description" content="${esc(note.subtitle)}">
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<div class="reading-progress" id="readingProgress"></div>

<header class="site-header">
  <a class="brand" href="./"><span class="brand-mark">АИИ</span><span>${esc(config.siteTitle)}</span></a>
  <a class="header-link" href="${esc(config.repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a>
</header>

<main class="site-shell">
  <header class="article-header">
    <a class="back-link" href="./${note.semester ? '?sem=' + note.semester : ''}">← Все материалы</a>
    <h1>${esc(note.title)}</h1>
    <p>${esc(note.subtitle)}</p>
  </header>

  <div class="article-layout">
    <aside class="toc">
      <div class="toc-title">Содержание</div>
      <nav class="toc-list">${tocHtml(sections)}</nav>
    </aside>
    <article class="article-body">${content}</article>
  </div>
</main>

<footer class="site-footer site-shell">
  <p>${esc(config.siteTitle)} · <a href="${esc(config.repoUrl)}" target="_blank" rel="noopener">${esc(config.repoUrl.replace('https://', ''))}</a></p>
</footer>

<script>
(function () {
  var progress = document.getElementById('readingProgress');
  if (progress) {
    addEventListener('scroll', function () {
      var max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';
    }, { passive: true });
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy-id]');
    if (!btn) return;
    var box = btn.closest('.copy-section').querySelector('.copy-source');
    if (!box) return;
    var text = box.value;
    var orig = btn.getAttribute('data-copy-label') || 'Копировать';
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject())
      .catch(function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      });
    btn.classList.add('is-copied');
    btn.textContent = 'Скопировано ✓';
    setTimeout(function () { btn.classList.remove('is-copied'); btn.textContent = orig; }, 1300);
  });
})();
</script>
</body>
</html>`;
}

function semCount(sem) {
  return sem.subjects.reduce((n, s) => n + (s.items?.length || 0), 0);
}

function plural(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function humanSize(bytes) {
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    const v = mb >= 100 ? Math.round(mb) : parseFloat(mb.toFixed(1));
    return `${v} МБ`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

function docPage({ item, sem, subject }) {
  const typeByKey = new Map(config.types.map(t => [t.key, t]));
  const type = typeByKey.get(item.type);
  const tlabel = esc(type ? type.label : item.type);
  const tkey = type ? ` type-${esc(type.key)}` : '';
  const src = path.join(ROOT, item.file);
  const size = fs.existsSync(src) ? humanSize(fs.statSync(src).size) : '';
  const fileHref = `./${encodeURI(item.file)}`;
  const subjectTitle = esc(subject.title);

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(item.title)} — скачать · ${esc(config.siteTitle)}</title>
<meta name="description" content="${subjectTitle} · ${tlabel}. Рукописный конспект, ${sem.number} семестр.">
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="./"><span class="brand-mark">АИИ</span><span>${esc(config.siteTitle)}</span></a>
  <a class="header-link" href="${esc(config.repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a>
</header>

<main class="site-shell">
  <article class="doc-page">
    <div class="doc-page-head">
      <span class="type-chip${tkey}">${tlabel}</span>
      <h1>${esc(item.title)}</h1>
      <p class="doc-page-sub">${subjectTitle} · ${sem.number} семестр · рукописный конспект</p>
    </div>

    <div class="doc-page-actions">
      <a class="dl-btn" href="${fileHref}" download>
        <span class="dl-btn-ico">↓</span>
        <span class="dl-btn-text">
          <span class="dl-btn-title">Скачать рукописный конспект</span>
          <span class="dl-btn-meta">PDF · ${size}</span>
        </span>
      </a>
      <a class="open-btn" href="${fileHref}" target="_blank" rel="noopener">Открыть в просмотре ↗</a>
    </div>

    <p class="doc-page-hint">Если кнопка не сработала — откройте&nbsp;файл напрямую: <a href="${fileHref}" target="_blank" rel="noopener">показать PDF</a>.</p>

    <a class="back-link" href="./?sem=${sem.number}">← Все материалы</a>
  </article>
</main>

<footer class="site-footer site-shell">
  <p>${esc(config.siteTitle)} · <a href="${esc(config.repoUrl)}" target="_blank" rel="noopener">${esc(config.repoUrl.replace('https://', ''))}</a></p>
</footer>
</body>
</html>`;
}

function indexPage() {
  const typeByKey = new Map(config.types.map(t => [t.key, t]));
  const noteFileBySlug = new Map(config.notes.map(n => [n.slug, n.file]));
  const semesterCounts = new Map(config.semesters.map(s => [s.number, semCount(s)]));

  const tabs = config.semesters.map(s => {
    const count = semesterCounts.get(s.number) || 0;
    return `<button type="button" class="sem-tab" data-sem="${s.number}" role="tab"
              aria-selected="false" aria-controls="sem-panel-${s.number}">
      <span class="sem-name">${s.number} семестр</span>
      ${count ? `<span class="sem-count">${count}</span>` : ''}
    </button>`;
  }).join('');

  const panels = config.semesters.map(s => {
    const count = semesterCounts.get(s.number) || 0;

    if (!s.subjects.length) {
      return `<div class="sem-panel" id="sem-panel-${s.number}" data-sem="${s.number}" role="tabpanel" hidden>
        <div class="sem-empty">
          <div class="sem-empty-mark">${s.number}</div>
          <h3>Пока пусто</h3>
          <p>Материалы по ${s.number}-му семестру появятся позже.</p>
        </div>
      </div>`;
    }

    const groups = s.subjects.map(subj => `
      <section class="doc-group" data-group>
        <div class="group-heading"><h2>${esc(subj.title)}</h2><p>${subj.items.length} ${plural(subj.items.length, 'материал', 'материала', 'материалов')}</p></div>
        <div class="doc-grid">
          ${subj.items.map(it => {
            const type = typeByKey.get(it.type);
            const tlabel = esc(type ? type.label : it.type);
            const tkey = type ? ` type-${esc(type.key)}` : '';
            const kind = it.kind === 'note' ? 'Конспект' : 'PDF';
            const pageHref = `./${it.slug}.html?sem=${s.number}`;
            const downloadHref = it.kind === 'note'
              ? `./${encodeURI(noteFileBySlug.get(it.slug))}`
              : `./${encodeURI(it.file)}`;
            const dlTitle = it.kind === 'note' ? 'Скачать конспект' : 'Скачать PDF';
            const dataKey = esc((it.title + ' ' + tlabel + ' ' + subj.title).toLowerCase());
            return `<div class="doc-card has-dl" data-card data-key="${dataKey}">
              <a class="doc-card-link" href="${pageHref}">
                <div class="doc-card-top">
                  <div class="doc-card-title"><h3>${esc(it.title)}</h3><span class="type-chip${tkey}">${tlabel}</span></div>
                </div>
                <div class="doc-card-bottom">
                  <span class="badge">${kind}</span>
                </div>
              </a>
              <a class="card-dl" href="${downloadHref}" download title="${dlTitle}" aria-label="${dlTitle}">↓</a>
            </div>`;
          }).join('')}
        </div>
      </section>`).join('');

    return `<div class="sem-panel" id="sem-panel-${s.number}" data-sem="${s.number}" role="tabpanel" data-count="${count}" hidden>${groups}</div>`;
  }).join('');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(config.siteTitle)}</title>
<meta name="description" content="${esc(config.siteDescription)}">
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<header class="site-header">
  <a class="brand" href="./"><span class="brand-mark">АИИ</span><span>${esc(config.siteTitle)}</span></a>
  <a class="header-link" href="${esc(config.repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a>
</header>

<main class="site-shell">
  <section class="hero">
    <p class="eyebrow">Образовательная программа</p>
    <h1>${esc(config.siteTitle)}</h1>
    <p>${esc(config.siteDescription)}</p>
  </section>

  <nav class="sem-tabs" id="semTabs" role="tablist" aria-label="Семестры">
    ${tabs}
  </nav>

  <div class="search-wrap">
    <input id="catalogSearch" class="catalog-search" type="search" placeholder="Найти дисциплину или материал — лекции, практику, теорию к экзамену…">
  </div>

  <section class="catalog" id="catalog">
    ${panels}
  </section>
</main>

<footer class="site-footer site-shell">
  <p>${esc(config.siteTitle)} · <a href="${esc(config.repoUrl)}" target="_blank" rel="noopener">${esc(config.repoUrl.replace('https://', ''))}</a></p>
</footer>

<script>
(function () {
  var COOKIE = 'notes_semester';
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.sem-tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.sem-panel'));
  var search = document.getElementById('catalogSearch');

  function getCookie(name) {
    var m = document.cookie.match('(?:^|;\\\\s*)' + name + '=([^;]*)');
    return m ? decodeURIComponent(m[1]) : '';
  }

  function setCookie(name, value) {
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; path=/; max-age=31536000; SameSite=Lax';
  }

  function currentSem() {
    var params = new URLSearchParams(location.search);
    return params.get('sem') || getCookie(COOKIE);
  }

  function applySearch(panel) {
    if (!search || !search.value) return;
    var q = search.value.trim().toLowerCase();
    if (!q) return;
    panel.querySelectorAll('[data-card]').forEach(function (c) {
      c.hidden = !c.dataset.key.includes(q);
    });
    panel.querySelectorAll('.doc-group').forEach(function (g) {
      g.hidden = g.querySelectorAll('[data-card]:not([hidden])').length === 0;
    });
  }

  function activate(num) {
    panels.forEach(function (p) {
      p.hidden = p.dataset.sem !== num;
    });
    tabs.forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.sem === num));
    });
    var active = panels.filter(function (p) { return p.dataset.sem === num; })[0];
    if (active) applySearch(active);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var num = tab.dataset.sem;
      activate(num);
      setCookie(COOKIE, num);
      var u = new URL(location.href);
      u.searchParams.set('sem', num);
      history.replaceState(null, '', u);
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      var active = panels.filter(function (p) { return !p.hidden; })[0];
      if (!active) return;
      var q = search.value.trim().toLowerCase();
      active.querySelectorAll('[data-card]').forEach(function (c) {
        c.hidden = q && !c.dataset.key.includes(q);
      });
      active.querySelectorAll('.doc-group').forEach(function (g) {
        g.hidden = [...g.querySelectorAll('[data-card]')].every(function (c) { return c.hidden; });
      });
    });
  }

  var sem = currentSem();
  if (!tabs.some(function (t) { return t.dataset.sem === sem; })) {
    sem = tabs.length ? tabs[0].dataset.sem : '1';
  }
  var u = new URL(location.href);
  u.searchParams.set('sem', sem);
  history.replaceState(null, '', u);
  activate(sem);
})();
</script>
</body>
</html>`;
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  fs.cpSync(src, dst, { recursive: true });
}

function main() {
  cleanDir(OUT);

  const notesBySlug = new Map();
  for (const note of config.notes) {
    const full = path.join(ROOT, note.file);
    let source = fs.readFileSync(full, 'utf8');
    if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
    const { html, sections } = markdownToStaticHtml(source);
    fs.writeFileSync(path.join(OUT, `${note.slug}.html`), notePage({ note, content: html, sections }));
    fs.copyFileSync(full, path.join(OUT, path.basename(note.file)));
    notesBySlug.set(note.slug, { note, sections });
  }

  fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());

  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  if (fs.existsSync(path.join(__dirname, '..', 'site', 'styles.css'))) {
    fs.copyFileSync(path.join(ROOT, 'site', 'styles.css'), path.join(OUT, 'styles.css'));
  }
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  for (const sem of config.semesters) {
    for (const subject of sem.subjects) {
      for (const item of subject.items) {
        if (item.kind !== 'pdf') continue;
        const src = path.join(ROOT, item.file);
        if (!fs.existsSync(src)) continue;
        const dst = path.join(OUT, item.file);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        fs.copyFileSync(src, dst);
        fs.writeFileSync(path.join(OUT, `${item.slug}.html`), docPage({ item, sem, subject }));
      }
    }
  }

  console.log('Built to', OUT);
}

main();
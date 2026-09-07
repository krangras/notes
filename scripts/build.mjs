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

function wrapTickets(html, source) {
  const re = /<a\s+id="ticket-(\d+)"\s*><\/a>/gi;
  if (!re.test(html)) return html;
  re.lastIndex = 0;

  const srcRe = /<a\s+id="ticket-(\d+)"\s*><\/a>/gi;
  const srcMatches = [...source.matchAll(srcRe)];
  const srcSplits = source.split(srcRe);

  const parts = html.split(re);
  let out = parts[0];
  for (let i = 1; i < parts.length; i += 2) {
    const num = parts[i];
    const seg = parts[i + 1] ?? '';
    const rawTicket = srcMatches[(i - 1) / 2] ? (srcSplits[(i - 1) / 2 + 1] ?? '').replace(/\n?\[↑\s*К содержанию\]\([^\n]+\)\s*/gi, '\n').replace(/\n?\s*---\s*$/g, '').trim() : '';
    out += `
    <section class="ticket" id="ticket-${num}">
      <div class="ticket-actions">
        <button class="copy-ticket" type="button" data-copy-ticket="${num}">Копировать билет</button>
      </div>
      ${seg}
      <textarea class="ticket-source" hidden>${esc(rawTicket)}</textarea>
    </section>`;
  }
  return out;
}

function markdownToStaticHtml(source) {
  const { s, math } = stashMath(source.replace(/\r\n/g, '\n'));
  const sections = parseSections(source);
  let html = md.render(s);
  html = assignHeadingIds(html, sections);
  html = restoreMath(html, math);
  html = wrapTickets(html, source);
  return { html, sections };
}

function tocHtml(sections) {
  return sections
    .map(s => {
      const level = s.level > 2 ? 3 : s.level;
      return `<a class="toc-link toc-level-${level}" href="#${esc(s.id)}">${esc(s.title)}</a>`;
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
  <a class="brand" href="./"><span class="brand-mark">N</span><span>notes</span></a>
  <a class="header-link" href="${esc(config.repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a>
</header>

<main class="site-shell">
  <header class="article-header">
    <a class="back-link" href="./">← Все материалы</a>
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
    var btn = e.target.closest('[data-copy-ticket]');
    if (!btn) return;
    var box = btn.closest('.ticket').querySelector('.ticket-source');
    if (!box) return;
    var text = box.value;
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
    setTimeout(function () { btn.classList.remove('is-copied'); btn.textContent = 'Копировать билет'; }, 1300);
  });
})();
</script>
</body>
</html>`;
}

function indexPage() {
  const cards = config.groups.map(g => `
    <section class="doc-group">
      <div class="group-heading"><div><h2>${esc(g.title)}</h2><p>${esc(g.description)}</p></div></div>
      <div class="doc-grid">
        ${g.items.map(it => {
          const href = it.kind === 'note'
            ? `./${it.slug}.html`
            : `./${encodeURI(it.file)}`;
          const target = it.kind === 'pdf' ? ' target="_blank" rel="noopener"' : '';
          return `<a class="doc-card" data-card data-key="${esc((it.title + ' ' + it.subtitle + ' ' + g.title).toLowerCase())}" href="${href}"${target}>
            <div class="doc-card-top"><div><h3>${esc(it.title)}</h3><p>${esc(it.subtitle)}</p></div></div>
            <div class="doc-card-top"><span class="badge">${esc(it.badge)}</span><span class="card-arrow">↗</span></div>
          </a>`;
        }).join('')}
      </div>
    </section>`).join('');

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
  <a class="brand" href="./"><span class="brand-mark">N</span><span>notes</span></a>
  <a class="header-link" href="${esc(config.repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a>
</header>

<main class="site-shell">
  <section class="hero">
    <p class="eyebrow">Личный справочник</p>
    <h1>${esc(config.siteTitle)}</h1>
    <p>${esc(config.siteDescription)}</p>
    <div class="search-wrap">
      <input id="catalogSearch" class="catalog-search" type="search" placeholder="Найти дисциплину или материал…">
    </div>
  </section>
  <section class="catalog">
    ${cards}
  </section>
</main>

<footer class="site-footer site-shell">
  <p>${esc(config.siteTitle)} · <a href="${esc(config.repoUrl)}" target="_blank" rel="noopener">${esc(config.repoUrl.replace('https://', ''))}</a></p>
</footer>

<script>
(function () {
  var input = document.getElementById('catalogSearch');
  if (!input) return;
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    document.querySelectorAll('[data-card]').forEach(function (card) {
      card.hidden = q && !card.dataset.key.includes(q);
    });
    document.querySelectorAll('.doc-group').forEach(function (g) {
      g.hidden = [...g.querySelectorAll('[data-card]')].every(function (c) { return c.hidden; });
    });
  });
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
    notesBySlug.set(note.slug, { note, sections });
  }

  fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());

  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  if (fs.existsSync(path.join(__dirname, '..', 'site', 'styles.css'))) {
    fs.copyFileSync(path.join(ROOT, 'site', 'styles.css'), path.join(OUT, 'styles.css'));
  }
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  for (const group of config.groups) {
    for (const item of group.items) {
      if (item.kind === 'pdf') {
        const src = path.join(ROOT, item.file);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(OUT, item.file));
      }
    }
  }

  console.log('Built to', OUT);
}

main();
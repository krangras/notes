import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const GLOSSARY = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'glossary.json'), 'utf8')); }
  catch { return {}; }
})();
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

const FAVICON = '<link rel="icon" type="image/svg+xml" href="./favicon.svg">';

const BRAND_MARK = '<span class="brand-mark"><svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5a7bff"/><stop offset="1" stop-color="#9a5bff"/></linearGradient></defs><rect width="40" height="40" rx="12" fill="url(#brandGrad)"/><g stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".9" fill="none"><path d="M20 9.5 11 19l9 9.5 9-9.5z"/><path d="M11 19h18"/></g><g fill="#fff"><circle cx="20" cy="9.5" r="2.9"/><circle cx="11" cy="19" r="2.9"/><circle cx="29" cy="19" r="2.9"/><circle cx="20" cy="28.5" r="2.9"/></g></svg></span>';

const BRAND = (siteTitle) => `<a class="brand" href="./">${BRAND_MARK}<span>${esc(siteTitle)}</span></a>`;

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
    const unitActions = unit === 'paragraph'
      ? `${seg}
      <div class="copy-actions">
        <button class="copy-btn" type="button" data-copy-id="${num}" data-copy-label="Копировать ${label}">Копировать ${label}</button>
      </div>`
      : `<div class="copy-actions">
        <button class="copy-btn" type="button" data-copy-id="${num}" data-copy-label="Копировать ${label}">Копировать ${label}</button>
      </div>
      ${seg}`;
    out += `
    <section class="copy-section" id="${unit}-${num}">
      ${unitActions}
      <textarea class="copy-source" hidden>${esc(raw)}</textarea>
    </section>`;
  }
  return out;
}

const escapeRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripMath = s => String(s)
  .replace(/```math\s*\n[\s\S]*?```/gi, ' ')
  .replace(/\\\[[\s\S]*?\\\]/g, ' ')
  .replace(/\$\$[\s\S]*?\$\$/g, ' ')
  .replace(/\\\([\s\S]*?\\\)/g, ' ')
  .replace(/\$[^$\n]+?\$/g, ' ');

const GENRE = {
  'множеством': 'множество', 'числом': 'число', 'числа': 'число', 'числе': 'число', 'числу': 'число',
  'суммой': 'сумма', 'произведением': 'произведение', 'матрицей': 'матрица', 'матрицы': 'матрица', 'матрицам': 'матрица',
  'функцией': 'функция', 'системой': 'система', 'системе': 'система', 'совокупностью': 'совокупность',
  'вектором': 'вектор', 'базисом': 'базис', 'пространством': 'пространство', 'подпространством': 'подпространство',
  'уравнением': 'уравнение', 'прямой': 'прямая', 'кривой': 'кривая', 'точкой': 'точка',
  'выражением': 'выражение', 'координатами': 'координата', 'координатой': 'координата',
  'формулой': 'формула', 'окружностью': 'окружность', 'графиком': 'график', 'углом': 'угол'
};

function extractTerms(text) {
  const clean = stripMath(text)
    .replace(/\*\*[^*]*\*\*/g, ' ')
    .replace(/[«»"():;,<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^пусть\s+/i, '');
  const low = clean.toLowerCase();
  const out = new Set();
  const isLetter = /[а-яёa-z]/;
  const push = p => {
    const w = String(p).replace(/[.,;:)(«»]/g, '').trim().toLowerCase();
    if (!w || w.length < 3) return;
    if (w.includes('называется') || w.includes('— это') || w.includes(';')) return;
    const words = w.split(/\s+/);
    if (words.length > 6) return;
    if (!isLetter.test(w[0])) return;
    out.add(w);
  };

  let subject = '';
  let m;
  if ((m = low.match(/^(.{2,90}?)\s+называется\b/))) subject = m[1];
  else if ((m = low.match(/^(.{2,90}?)\s+(?:—\s*)?это\b/))) subject = m[1];
  else if ((m = low.match(/^(.{2,90}?)\s+есть\b/))) subject = m[1];
  else if ((m = low.match(/^(.{2,90}?)\s+—\s/))) subject = m[1];
  else subject = low.split(/\s+/).slice(0, 5).join(' ');
  push(subject);

  const words = subject.split(/\s+/);
  const first = words[0] || '';
  if (GENRE[first]) push([GENRE[first], ...words.slice(1)].join(' '));

  const prop = low.match(/называется\s+([а-яё]{4,})\s*(?:[,;.]|$)/);
  if (prop && subject) {
    const rest = subject.replace(/^[а-яё]+\s+/, '');
    if (!rest.includes(' ')) push(prop[1] + ' ' + rest);
  }

  return [...out].slice(0, 8);
}

function collectDefinitions(sourceRaw, slug) {
  const lines = String(sourceRaw).replace(/\r\n/g, '\n').split('\n');
  const defs = [];
  const usedAnchors = new Set();
  let lastAnchor = null;
  let currentHeading = '';
  let counter = 0;
  let i = 0;

  while (i < lines.length) {
    const t = lines[i].trim();
    if (!lastAnchor) {
      const a = t.match(/^<a\s+id=["']([^"']+)["']\s*><\/a>$/i);
      if (a) { lastAnchor = a[1]; i++; continue; }
    }
    const h = t.match(/^(#{1,5})\s+(.+)$/);
    if (h) { currentHeading = h[2].trim(); lastAnchor = null; i++; continue; }
    const dm = t.match(/^\*\*Определение(?:\s+(\d+))?\.(.*)$/);
    if (dm) {
      const para = [lines[i]];
      i++;
      while (i < lines.length && lines[i].trim()) { para.push(lines[i]); i++; }
      const trailing = [];
      while (i < lines.length) {
        let j = i;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j >= lines.length || !/^```math/i.test(lines[j].trim())) break;
        const block = [lines[j]];
        let k = j + 1;
        while (k < lines.length && !/^```/.test(lines[k].trim())) { block.push(lines[k]); k++; }
        if (k < lines.length) block.push(lines[k]);
        trailing.push(block.join('\n'));
        i = k + 1;
      }
      counter++;
      const anchorId = lastAnchor;
      lastAnchor = null;
      if (anchorId) usedAnchors.add(anchorId);
      const text = para.join('\n').replace(/^\*\*Определение(?:\s+\d+)?\.\s*/, '').replace(/^\*\*/, '');
      const label = `Определение${dm[1] ? ' ' + dm[1] : ''}.`;
      defs.push({
        kind: 'def', id: anchorId || `def-${slug}-${counter}`, anchorId,
        label, text, trailing, context: currentHeading, terms: extractTerms(text)
      });
      if (!anchorId) continue;
      continue;
    }
    i++;
  }

  for (const anchorId of Object.keys(GLOSSARY)) {
    if (usedAnchors.has(anchorId)) continue;
    let lineAt = -1;
    let ctx = '';
    for (let idx = 0; idx < lines.length; idx++) {
      const lh = lines[idx].match(/^(#{1,5})\s+(.+)$/);
      if (lh) ctx = lh[2].trim();
      if (lines[idx].trim() === `<a id="${anchorId}"></a>`) { lineAt = idx; break; }
    }
    if (lineAt < 0) continue;
    let j = lineAt + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) continue;
    if (/^#{1,5}\s+/.test(lines[j].trim())) continue;
    if (/^\*\*Определение/.test(lines[j].trim())) continue;
    if (/^<a\s+id=/.test(lines[j].trim())) continue;
    const para = [];
    while (j < lines.length && lines[j].trim() && !/^(#{1,5})\s+/.test(lines[j])) { para.push(lines[j]); j++; }
    if (!para.length) continue;
    defs.push({
      kind: 'concept', id: anchorId, anchorId,
      label: (GLOSSARY[anchorId] && GLOSSARY[anchorId][0]) || 'Понятие',
      text: para.join('\n'), trailing: [], context: ctx,
      terms: (GLOSSARY[anchorId] || []).slice(0, 8)
    });
  }

  for (const d of defs) {
    const curated = (d.anchorId && GLOSSARY[d.anchorId]) || [];
    const terms = new Set([...(d.terms || []), ...curated]);
    d.terms = [...terms].slice(0, 10);
    d.json = (d.terms || []).map(t => t);
  }

  return defs;
}

function wrapDefinitions(html, defs) {
  const termsAttr = d => `data-terms="${esc(JSON.stringify(d.terms || []))}"`;

  const anchored = defs.filter(d => d.anchorId);
  if (anchored.length) {
    const re = new RegExp(
      `<p><a\\s+id="(${anchored.map(d => escapeRe(d.anchorId)).join('|')})"\\s*><\\/a>\\s*<strong>Определение(?:\\s+(\\d+))?\\.<\\/strong>`,
      'g'
    );
    const byId = new Map(anchored.map(d => [d.anchorId, d]));
    html = html.replace(re, (m, id, num) => {
      const d = byId.get(id);
      return `<p class="definition" id="${esc(id)}" ${termsAttr(d)}><span class="def-label">Определение${num ? ' ' + num : ''}.</span>`;
    });
  }

  const unanchored = defs.filter(d => !d.anchorId && d.kind === 'def');
  if (unanchored.length) {
    const re = /<p><strong>Определение(?:\s+(\d+))?\.<\/strong>/g;
    let u = 0;
    html = html.replace(re, (m, num) => {
      const d = unanchored[u++ % unanchored.length];
      if (!d) return m;
      return `<p class="definition" id="${esc(d.id)}" ${termsAttr(d)}><span class="def-label">Определение${num ? ' ' + num : ''}.</span>`;
    });
  }

  const concepts = defs.filter(d => d.kind === 'concept' && d.anchorId);
  if (concepts.length) {
    const re = new RegExp(
      `<p><a\\s+id="(${concepts.map(d => escapeRe(d.anchorId)).join('|')})"\\s*><\\/a>`,
      'g'
    );
    const byId = new Map(concepts.map(d => [d.anchorId, d]));
    html = html.replace(re, (m, id) => {
      const d = byId.get(id);
      return `<p class="definition concept" id="${esc(id)}" ${termsAttr(d)}><span class="def-label">${esc(d.label)}</span>`;
    });
  }

  return html;
}

function mdToHtml(fragment) {
  const { s, math } = stashMath(fragment);
  return restoreMath(md.render(s), math);
}

function renderDefinitionsAppendix(fullDefs) {
  const blocks = fullDefs.map(d => {
    const frag = [d.text, ...d.trailing].join('\n\n');
    let h = mdToHtml(frag);
    h = h.replace(/<p>/, `<p class="definition" id="${esc(d.id)}" data-terms="${esc(JSON.stringify(d.terms || []))}"><span class="def-label">${esc(d.label)}</span> `);
    const ctx = d.context ? `<span class="def-source">из раздела «${esc(d.context)}»</span>` : '';
    return `<div class="def-block">${h}${ctx}</div>`;
  });
  return `<h2 id="all-definitions">Все определения из лекционного конспекта</h2>\n<div class="def-appendix">${blocks.join('\n')}</div>`;
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
${FAVICON}
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<div class="reading-progress" id="readingProgress"></div>

<header class="site-header site-header-article">
  ${BRAND(config.siteTitle)}
  <a class="header-link" href="${esc(config.repoUrl)}" target="_blank" rel="noopener">GitHub ↗</a>
</header>

<main class="site-shell site-shell-article">
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

  (function () {
    var defs = document.querySelectorAll('.definition');
    if (!defs.length) return;
    var byId = {};
    var terms = [];
    defs.forEach(function (d) {
      byId[d.id] = d;
      var t = [];
      try { t = JSON.parse(d.getAttribute('data-terms') || '[]'); } catch (e) {}
      for (var i = 0; i < t.length; i++) if (t[i]) terms.push({ t: String(t[i]).toLowerCase(), id: d.id });
    });
    terms.sort(function (a, b) { return b.t.length - a.t.length; });
    var body = document.querySelector('.article-body');
    if (!body || !terms.length) return;

    var isLetter = /[a-zа-яё0-9]/i;
    var minLen = 4;
    for (var z = 0; z < terms.length; z++) if (terms[z].t.length < minLen) { minLen = terms[z].t.length; break; }

    var nodes = [];
    (function walk(node) {
      var children = node.childNodes;
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (c.nodeType === 3) {
          var v = c.nodeValue;
          if (!v || v.length < minLen) continue;
          var p = c.parentNode;
          if (!p || !p.tagName) continue;
          if (!/^(P|LI|TD|TH|BLOCKQUOTE|FIGCAPTION|DT|DD)$/.test(p.tagName)) continue;
          if (p.closest('a, .def-label, script, style, code, pre, .toc, textarea, button')) continue;
          nodes.push(c);
        } else if (c.nodeType === 1 && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') {
          walk(c);
        }
      }
    })(body);

    nodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var low = text.toLowerCase();
      var parts = [];
      var pos = 0;
      var len = text.length;
      while (pos < len) {
        var rest = len - pos;
        if (rest < minLen) { parts.push([0, text.slice(pos)]); break; }
        var match = null;
        for (var k = 0; k < terms.length; k++) {
          var term = terms[k];
          if (term.t.length > rest) continue;
          var eq = low.slice(pos, pos + term.t.length) === term.t;
          var infl = term.t.indexOf(' ') === -1 && low.slice(pos).indexOf(term.t) === 0;
          if (!eq && !infl) continue;
          var before = pos ? text.charAt(pos - 1) : '';
          if (isLetter.test(before)) continue;
          var consumed = term.t.length;
          var endChar = text.charAt(pos + consumed);
          if (eq) {
            if (endChar && isLetter.test(endChar)) continue;
          } else {
            var j = pos + term.t.length;
            while (j < len && isLetter.test(text.charAt(j))) j++;
            consumed = j - pos;
          }
          match = { id: term.id, from: pos, to: pos + consumed };
          break;
        }
        if (match) {
          if (match.from > pos) parts.push([0, text.slice(pos, match.from)]);
          parts.push([match.id, text.slice(match.from, match.to)]);
          pos = match.to;
          if (pos <= match.from) pos = match.from + 1;
        } else {
          pos++;
        }
      }
      var has = false;
      for (var q = 0; q < parts.length; q++) if (parts[q][0]) { has = true; break; }
      if (!has) return;

      var host = textNode.ownerDocument;
      var frag = host.createDocumentFragment();
      for (var i2 = 0; i2 < parts.length; i2++) {
        var P = parts[i2];
        if (!P[0]) { frag.appendChild(host.createTextNode(P[1])); continue; }
        var a = host.createElement('a');
        a.className = 'gloss-term';
        a.href = '#' + P[0];
        a.setAttribute('data-gloss', P[0]);
        a.textContent = P[1];
        frag.appendChild(a);
      }
      textNode.parentNode.replaceChild(frag, textNode);
    });

    var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    var tip = null;
    function closeTip() { if (tip) { tip.remove(); tip = null; } }
    function showTip(src) {
      var id = src.getAttribute('data-gloss');
      var target = id && byId[id];
      if (!target) return;
      closeTip();
      var t = document.createElement('div');
      t.className = 'gloss-tooltip';
      t.setAttribute('role', 'tooltip');
      var clone = target.cloneNode(true);
      Array.prototype.slice.call(clone.querySelectorAll('script, textarea')).forEach(function (n) { n.remove(); });
      t.appendChild(clone);
      document.body.appendChild(t);
      var r = src.getBoundingClientRect();
      var g = 10;
      var x = Math.max(8, Math.min(r.left, innerWidth - t.offsetWidth - 8));
      var y = r.bottom + g;
      if (y + t.offsetHeight > innerHeight - 8) y = Math.max(8, r.top - t.offsetHeight - g);
      t.style.left = x + 'px';
      t.style.top = y + 'px';
      tip = t;
    }

    if (!isTouch) {
      document.addEventListener('mouseover', function (e) {
        var el = e.target.closest ? e.target.closest('.gloss-term') : null;
        if (el) showTip(el);
      });
      document.addEventListener('mouseout', function (e) {
        var el = e.target.closest ? e.target.closest('.gloss-term') : null;
        var rel = e.relatedTarget;
        if (!el) return;
        if (rel && rel.closest && rel.closest('.gloss-term, .gloss-tooltip')) return;
        setTimeout(closeTip, 120);
      });
      document.addEventListener('scroll', closeTip, true);
    }
  })();

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
${FAVICON}
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<header class="site-header">
  ${BRAND(config.siteTitle)}
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
${FAVICON}
<link rel="stylesheet" href="./styles.css">
</head>
<body>
<header class="site-header">
  ${BRAND(config.siteTitle)}
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
    <input id="catalogSearch" class="catalog-search" type="search" placeholder="Найти дисциплину или материал">
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
    const defs = collectDefinitions(source, note.slug);
    let content = wrapDefinitions(html, defs);
    if (note.slug === 'linear-algebra-1') {
      const fullNote = config.notes.find(n => n.slug === 'agitdu-full');
      if (fullNote) {
        let fs2 = fs.readFileSync(path.join(ROOT, fullNote.file), 'utf8');
        if (fs2.charCodeAt(0) === 0xfeff) fs2 = fs2.slice(1);
        const fullDefs = collectDefinitions(fs2, fullNote.slug).filter(d => d.kind === 'def');
        content += renderDefinitionsAppendix(fullDefs);
        sections.push({ level: 2, title: 'Все определения из лекционного конспекта', id: 'all-definitions', fromAnchor: false });
      }
    }
    fs.writeFileSync(path.join(OUT, `${note.slug}.html`), notePage({ note, content, sections }));
    fs.copyFileSync(full, path.join(OUT, path.basename(note.file)));
    notesBySlug.set(note.slug, { note, sections });
  }

  fs.writeFileSync(path.join(OUT, 'index.html'), indexPage());

  copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));
  if (fs.existsSync(path.join(__dirname, '..', 'site', 'styles.css'))) {
    fs.copyFileSync(path.join(ROOT, 'site', 'styles.css'), path.join(OUT, 'styles.css'));
  }
  const favicon = path.join(ROOT, 'site', 'favicon.svg');
  if (fs.existsSync(favicon)) {
    fs.copyFileSync(favicon, path.join(OUT, 'favicon.svg'));
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
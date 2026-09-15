import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalGlossaryKey, injectDefinitionsIntoTickets, wrapTicketDefinitionPanels } from './definition-system.mjs';
// canonical-definition-system:v1

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const GLOSSARY = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'glossary.json'), 'utf8')); }
  catch { return {}; }
})();
const glossaryTerms = anchorId => GLOSSARY[canonicalGlossaryKey(anchorId)] || [];
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

  const semanticBoundary = t => {
    if (!t) return false;
    if (/^<a\s+id=["'][^"']+["']\s*><\/a>$/i.test(t)) return true;
    if (/^#{1,5}\s+/.test(t)) return true;
    if (/^<(?:p|figure|img)\b/i.test(t)) return true;
    if (/^(?:Обозначение|Пример|Примеры|Матрица удобно изображается таблицей|Строки матрицы|Столбцы матрицы)\s*:/i.test(t)) return true;
    return /^\*\*(?:Определение|Замечание|Примечание|Пример|Теорема|Следствие|Лемма|Д-во|Док-во|Доказательство|Обозначение)(?=[\s.:*—-]|$)/i.test(t);
  };

  while (i < lines.length) {
    const t = lines[i].trim();
    const a = t.match(/^<a\s+id=["']([^"']+)["']\s*><\/a>$/i);
    if (a) { lastAnchor = a[1]; i++; continue; }

    const h = t.match(/^(#{1,5})\s+(.+)$/);
    if (h) { currentHeading = h[2].trim(); lastAnchor = null; i++; continue; }

    const dm = t.match(/^\*\*Определение(?:\s+(\d+))?\.(?:\*\*)?(.*)$/i);
    if (dm) {
      const block = [lines[i]];
      i++;
      let inFence = false;
      while (i < lines.length) {
        const next = lines[i].trim();
        if (/^```/.test(next)) {
          block.push(lines[i]);
          inFence = !inFence;
          i++;
          continue;
        }
        if (!inFence && semanticBoundary(next)) break;
        block.push(lines[i]);
        i++;
      }
      while (block.length && !block[block.length - 1].trim()) block.pop();

      counter++;
      const anchorId = lastAnchor;
      lastAnchor = null;
      if (anchorId) usedAnchors.add(anchorId);
      const text = block.join('\n')
        .replace(/^\*\*Определение(?:\s+\d+)?\.\*\*\s*/i, '')
        .replace(/^\*\*Определение(?:\s+\d+)?\.\s*/i, '')
        .replace(/^\*\*/, '');
      const label = `Определение${dm[1] ? ' ' + dm[1] : ''}.`;
      defs.push({
        kind: 'def', id: anchorId || `def-${slug}-${counter}`, anchorId,
        label, text, trailing: [], context: currentHeading, terms: extractTerms(text)
      });
      continue;
    }
    i++;
  }

  // Curated non-"Определение" anchors (formula/concept blocks such as modulus, SLU, equation forms).
  const anchoredKeys = new Set(Object.keys(GLOSSARY));
  for (const rawAnchorId of anchoredKeys) {
    const anchorId = rawAnchorId;
    if (usedAnchors.has(anchorId)) continue;
    let lineAt = -1;
    let ctx = '';
    let inlineText = '';
    for (let idx = 0; idx < lines.length; idx++) {
      const raw = lines[idx].trim();
      const lh = raw.match(/^(#{1,5})\s+(.+)$/);
      if (lh) ctx = lh[2].trim();
      if (raw === `<a id="${anchorId}"></a>` || raw === `<a id='${anchorId}'></a>`) { lineAt = idx; break; }
      const ia = raw.match(/^\d+\.\s*<a\s+id=["']([^"']+)["']\s*><\/a>(.*)$/i);
      if (ia && ia[1] === anchorId) { lineAt = idx; inlineText = ia[2].trim(); break; }
    }
    if (lineAt < 0) continue;
    let j = lineAt + 1;
    let heading = null;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (!t) { j++; continue; }
      const h = t.match(/^(#{1,5})\s+(.+)$/);
      if (h) { heading = h[2].trim(); j++; continue; }
      break;
    }
    if (j >= lines.length) continue;
    if (/^\*\*Определение/i.test(lines[j].trim())) continue;
    if (/^<a\s+id=/.test(lines[j].trim())) continue;

    const para = inlineText ? [inlineText] : [];
    let inFence = false;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (/^```/.test(t)) {
        para.push(lines[j]);
        inFence = !inFence;
        j++;
        continue;
      }
      if (!inFence && para.length && inlineText && /^\d+\.\s+/.test(t)) break;
      if (!inFence && para.length && (/^<a\s+id=/.test(t) || /^(#{1,5})\s+/.test(t) || /^\*\*(?:Определение|Замечание|Примечание|Пример|Теорема|Следствие|Лемма|Д-во|Док-во|Доказательство)(?=[\s.:*—-]|$)/i.test(t))) break;
      if (!inFence && !t && para.length) {
        // Keep blank lines if the next meaningful item is a math block; otherwise finish a compact concept.
        let k = j + 1;
        while (k < lines.length && !lines[k].trim()) k++;
        if (k < lines.length && /^```math/i.test(lines[k].trim())) { para.push(lines[j]); j++; continue; }
        break;
      }
      para.push(lines[j]);
      j++;
    }
    while (para.length && !para[para.length - 1].trim()) para.pop();
    if (!para.length) continue;
    const text = para.join('\n');
    const bold = text.match(/^\*\*([^*]{2,80}?)\*\*/);
    const curated = glossaryTerms(anchorId);
    const label = bold ? bold[1].trim() : heading || curated[0] || 'Понятие';
    defs.push({
      kind: 'concept', id: anchorId, anchorId,
      label, text, trailing: [], context: ctx,
      terms: curated.slice(0, 12)
    });
    usedAnchors.add(anchorId);
  }

  // Also discover curated local ticket copies whose ids are ticket-N__canonical-id.
  const localAnchorRe = /^ticket-\d+__(.+)$/;
  for (let idx = 0; idx < lines.length; idx++) {
    const am = lines[idx].trim().match(/^<a\s+id=["']([^"']+)["']\s*><\/a>$/i);
    if (!am || usedAnchors.has(am[1])) continue;
    const cm = am[1].match(localAnchorRe);
    if (!cm || !GLOSSARY[cm[1]]) continue;
    let j = idx + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length || /^\*\*Определение/i.test(lines[j].trim())) continue;
    const para = [];
    let inFence = false;
    while (j < lines.length) {
      const t = lines[j].trim();
      if (/^```/.test(t)) { para.push(lines[j]); inFence = !inFence; j++; continue; }
      if (!inFence && para.length && (/^<!--\s*ticket-definition-end:/.test(t) || /^<a\s+id=/.test(t) || /^(#{1,5})\s+/.test(t))) break;
      para.push(lines[j]); j++;
    }
    while (para.length && !para[para.length - 1].trim()) para.pop();
    const text = para.join('\n');
    if (!text) continue;
    const terms = glossaryTerms(am[1]);
    defs.push({ kind: 'concept', id: am[1], anchorId: am[1], label: terms[0] || 'Понятие', text, trailing: [], context: 'Определения этого билета', terms });
    usedAnchors.add(am[1]);
  }

  for (const d of defs) {
    const curated = glossaryTerms(d.anchorId || d.id);
    const terms = new Set([...(d.terms || []), ...curated]);
    if (d.kind === 'concept' && !terms.size) {
      const lbl = String(d.label || '').toLowerCase();
      if (lbl && lbl.length >= 3) terms.add(lbl);
    }
    d.terms = [...terms].slice(0, 16);
    d.json = d.terms.slice();
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
    const inlineAnchorRe = new RegExp(
      `<a\\s+id="(${concepts.map(d => escapeRe(d.anchorId)).join('|')})"\\s*><\/a>`,
      'g'
    );
    html = html.replace(inlineAnchorRe, (m, id) => {
      const d = byId.get(id);
      return `<a class="definition concept definition-inline-anchor" id="${esc(id)}" ${termsAttr(d)}></a>`;
    });
  }

  return html;
}

function mdToHtml(fragment) {
  const { s, math } = stashMath(fragment);
  return restoreMath(md.render(s), math);
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

function definitionTemplatesHtml(defs) {
  return (defs || []).map(d => {
    const body = d.kind === 'def' ? `**${d.label || 'Определение.'}** ${d.text || ''}` : String(d.text || '');
    return `<template id="definition-template-${esc(d.id)}">${mdToHtml(body)}</template>`;
  }).join('');
}

function notePage({ note, content, sections, defs }) {
  const definitionTemplates = definitionTemplatesHtml(defs);
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
    <div class="definition-templates" aria-hidden="true">${definitionTemplates}</div>
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
    // canonical-definition-runtime:v3
    var defs = document.querySelectorAll('.definition');
    if (!defs.length) return;
    var byId = {};
    defs.forEach(function (d) { if (d.id) byId[d.id] = d; });
    var body = document.querySelector('.article-body');
    if (!body) return;

    var WORD_RE = /[\p{L}\p{N}]+/gu;
    var RUSSIAN_ENDINGS = [
      'иями','ями','ами','ией','иям','иях','его','ого','ему','ому','ыми','ими','ая','яя','ое','ее','ые','ие',
      'ый','ий','ой','ую','юю','ых','их','ов','ев','ей','ом','ем','ам','ям','ах','ях','ию','ью','ия','ья','а','я','ы','и','у','ю','е','о','й','ь'
    ];

    function normalizeWord(value) {
      return String(value || '').toLowerCase().replace(/ё/g, 'е');
    }
    function stemWord(value) {
      var w = normalizeWord(value).replace(/[^\p{L}\p{N}]+/gu, '');
      if (w.length <= 4 || /\d/.test(w)) return w;
      for (var i = 0; i < RUSSIAN_ENDINGS.length; i++) {
        var ending = RUSSIAN_ENDINGS[i];
        if (w.endsWith(ending) && w.length - ending.length >= 4) return w.slice(0, -ending.length);
      }
      return w;
    }
    function tokensWithSpans(value) {
      var out = [];
      WORD_RE.lastIndex = 0;
      var m;
      while ((m = WORD_RE.exec(String(value || ''))) !== null) {
        out.push({ raw: m[0], low: normalizeWord(m[0]), stem: stemWord(m[0]), from: m.index, to: m.index + m[0].length });
      }
      return out;
    }

    function termsFor(primaryDefs, fallbackDefs) {
      var terms = [];
      var seen = {};
      var priority = 0;
      function add(list, groupPriority) {
        Array.prototype.forEach.call(list || [], function (d) {
          var values = [];
          try { values = JSON.parse(d.getAttribute('data-terms') || '[]'); } catch (e) {}
          for (var i = 0; i < values.length; i++) {
            var raw = String(values[i] || '').trim();
            var low = normalizeWord(raw);
            if (!low || low.length < 3 || seen[low]) continue;
            var toks = tokensWithSpans(raw).map(function (x) { return x.stem; }).filter(Boolean);
            if (!toks.length) continue;
            seen[low] = 1;
            terms.push({ t: low, tokens: toks, id: d.id, priority: groupPriority * 10000 + priority++ });
          }
        });
      }
      // Within a ticket/paragraph, local definitions always win over global ones.
      add(primaryDefs, 0);
      add(fallbackDefs, 1);
      // Longer/more specific aliases are considered first at the same position.
      terms.sort(function (a, b) { return b.tokens.length - a.tokens.length || b.t.length - a.t.length || a.priority - b.priority; });
      return terms;
    }

    function findMatches(text, terms) {
      var words = tokensWithSpans(text);
      if (!words.length) return [];
      var candidates = [];
      for (var wi = 0; wi < words.length; wi++) {
        for (var ti = 0; ti < terms.length; ti++) {
          var term = terms[ti];
          var needle = term.tokens;
          if (wi + needle.length > words.length) continue;
          var ok = true;
          for (var j = 0; j < needle.length; j++) {
            if (words[wi + j].stem !== needle[j]) { ok = false; break; }
          }
          if (!ok) continue;
          candidates.push({
            from: words[wi].from,
            to: words[wi + needle.length - 1].to,
            id: term.id,
            priority: term.priority,
            tokenCount: needle.length
          });
        }
      }
      candidates.sort(function (a, b) {
        return a.from - b.from || (b.to - b.from) - (a.to - a.from) || b.tokenCount - a.tokenCount || a.priority - b.priority;
      });
      var selected = [];
      var cursor = -1;
      for (var k = 0; k < candidates.length; k++) {
        var c = candidates[k];
        if (c.from < cursor) continue;
        selected.push(c);
        cursor = c.to;
      }
      return selected;
    }

    function linkScope(root, primaryDefs, fallbackDefs) {
      var terms = termsFor(primaryDefs, fallbackDefs);
      if (!terms.length) return;
      var nodes = [];
      (function walk(node) {
        var children = node.childNodes;
        for (var i = 0; i < children.length; i++) {
          var c = children[i];
          if (c.nodeType === 3) {
            var v = c.nodeValue;
            if (!v || v.length < 3) continue;
            var parent = c.parentNode;
            if (!parent || !parent.tagName) continue;
            if (!/^(P|LI|TD|TH|BLOCKQUOTE|FIGCAPTION|DT|DD)$/.test(parent.tagName)) continue;
            if (parent.closest('a, .definition, .ticket-definitions, .def-label, script, style, code, pre, .toc, textarea, button, .gloss-tooltip')) continue;
            nodes.push(c);
          } else if (c.nodeType === 1 && c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE') {
            walk(c);
          }
        }
      })(root);

      nodes.forEach(function (textNode) {
        var text = textNode.nodeValue;
        var matches = findMatches(text, terms);
        if (!matches.length) return;
        var host = textNode.ownerDocument;
        var frag = host.createDocumentFragment();
        var cursor = 0;
        for (var i = 0; i < matches.length; i++) {
          var match = matches[i];
          if (match.from > cursor) frag.appendChild(host.createTextNode(text.slice(cursor, match.from)));
          var a = host.createElement('a');
          a.className = 'gloss-term';
          a.href = '#' + match.id;
          a.setAttribute('data-gloss', match.id);
          a.textContent = text.slice(match.from, match.to);
          frag.appendChild(a);
          cursor = match.to;
        }
        if (cursor < text.length) frag.appendChild(host.createTextNode(text.slice(cursor)));
        textNode.parentNode.replaceChild(frag, textNode);
      });
    }

    var ticketSections = body.querySelectorAll('.copy-section[id^="ticket-"]');
    if (ticketSections.length) {
      ticketSections.forEach(function (section) {
        linkScope(section, section.querySelectorAll('.definition'), []);
      });
    } else {
      var paragraphSections = body.querySelectorAll('.copy-section[id^="paragraph-"]');
      if (paragraphSections.length) {
        paragraphSections.forEach(function (section) {
          linkScope(section, section.querySelectorAll('.definition'), defs);
        });
      } else {
        linkScope(body, defs, []);
      }
    }

    var tip = null;
    var activeTerm = null;
    var closeTimer = 0;
    var lastPointerType = 'mouse';
    var tipSeq = 0;

    function cancelClose() {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; }
    }
    function closeTip() {
      cancelClose();
      if (tip) { tip.remove(); tip = null; }
      if (activeTerm) activeTerm.removeAttribute('data-gloss-open');
      activeTerm = null;
    }
    function scheduleClose(delay) {
      cancelClose();
      closeTimer = setTimeout(closeTip, delay == null ? 170 : delay);
    }
    function rewriteClonedIds(root) {
      var map = {};
      tipSeq += 1;
      Array.prototype.slice.call(root.querySelectorAll('[id]')).forEach(function (n, idx) {
        var old = n.id;
        if (!old) return;
        var fresh = 'gloss-tip-' + tipSeq + '-' + idx + '-' + old.replace(/[^A-Za-z0-9_-]/g, '-');
        map[old] = fresh;
        n.id = fresh;
      });
      Array.prototype.slice.call(root.querySelectorAll('*')).forEach(function (n) {
        ['href','xlink:href'].forEach(function (attr) {
          var v = n.getAttribute && n.getAttribute(attr);
          if (v && v.charAt(0) === '#' && map[v.slice(1)]) n.setAttribute(attr, '#' + map[v.slice(1)]);
        });
        ['clip-path','filter','mask','fill','stroke'].forEach(function (attr) {
          var v = n.getAttribute && n.getAttribute(attr);
          if (!v) return;
          n.setAttribute(attr, v.replace(/url\(#([^\)]+)\)/g, function (_, id) {
            return map[id] ? 'url(#' + map[id] + ')' : 'url(#' + id + ')';
          }));
        });
      });
    }
    function positionTip(src, t) {
      var r = src.getBoundingClientRect();
      var gap = 10;
      var pad = 10;
      var w = t.offsetWidth;
      var h = t.offsetHeight;
      var x = r.left + Math.min(r.width * .18, 24);
      x = Math.max(pad, Math.min(x, innerWidth - w - pad));
      var below = r.bottom + gap;
      var above = r.top - h - gap;
      var y = below;
      if (below + h > innerHeight - pad && above >= pad) y = above;
      else y = Math.max(pad, Math.min(below, innerHeight - h - pad));
      t.style.setProperty('left', Math.round(x) + 'px', 'important');
      t.style.setProperty('top', Math.round(y) + 'px', 'important');
    }
    function showTip(src) {
      if (!src || !src.isConnected) return;
      var id = src.getAttribute('data-gloss');
      var target = id && byId[id];
      if (!target) return;
      if (tip && activeTerm === src) { cancelClose(); return; }
      closeTip();

      var t = document.createElement('div');
      t.className = 'gloss-tooltip';
      t.setAttribute('role', 'tooltip');
      t.setAttribute('aria-live', 'polite');

      var tpl = document.getElementById('definition-template-' + id);
      if (tpl && tpl.content) {
        var frag = tpl.content.cloneNode(true);
        Array.prototype.slice.call(frag.querySelectorAll ? frag.querySelectorAll('script, textarea') : []).forEach(function (n) { n.remove(); });
        t.appendChild(frag);
      } else {
        var card = target.closest ? target.closest('.ticket-definition-card') : null;
        var clone = (card || target).cloneNode(true);
        clone.removeAttribute && clone.removeAttribute('id');
        Array.prototype.slice.call(clone.querySelectorAll ? clone.querySelectorAll('script, textarea, .copy-actions') : []).forEach(function (n) { n.remove(); });
        t.appendChild(clone);
      }
      rewriteClonedIds(t);

      var jump = document.createElement('a');
      jump.className = 'gloss-tip-jump';
      jump.href = '#' + id;
      jump.textContent = 'К определению ↓';
      t.appendChild(jump);

      document.body.appendChild(t);
      positionTip(src, t);
      tip = t;
      activeTerm = src;
      src.setAttribute('data-gloss-open', '1');

      t.addEventListener('pointerenter', cancelClose);
      t.addEventListener('pointerleave', function (e) {
        if (e.pointerType === 'mouse' || e.pointerType === 'pen' || !e.pointerType) scheduleClose(120);
      });
    }

    document.addEventListener('pointerdown', function (e) {
      lastPointerType = e.pointerType || 'mouse';
    }, true);

    // Mouse/pen hover works even on hybrid touch laptops. No global isTouch branch.
    document.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var el = e.target.closest ? e.target.closest('.gloss-term') : null;
      if (!el) return;
      cancelClose();
      showTip(el);
    });
    document.addEventListener('pointerout', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var el = e.target.closest ? e.target.closest('.gloss-term, .gloss-tooltip') : null;
      if (!el) return;
      var rel = e.relatedTarget;
      if (rel && rel.closest && rel.closest('.gloss-term, .gloss-tooltip')) return;
      scheduleClose(170);
    });

    // Keyboard users get the same definition popup on focus.
    document.addEventListener('focusin', function (e) {
      var el = e.target.closest ? e.target.closest('.gloss-term') : null;
      if (el) showTip(el);
    });
    document.addEventListener('focusout', function (e) {
      var el = e.target.closest ? e.target.closest('.gloss-term, .gloss-tooltip') : null;
      if (!el) return;
      var rel = e.relatedTarget;
      if (rel && rel.closest && rel.closest('.gloss-term, .gloss-tooltip')) return;
      scheduleClose(120);
    });

    // On touch: first tap opens the definition, second tap follows the local anchor.
    document.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('.gloss-term') : null;
      if (!el) return;
      if (lastPointerType !== 'touch') return;
      if (el.getAttribute('data-gloss-open') === '1') return;
      e.preventDefault();
      showTip(el);
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.gloss-term, .gloss-tooltip')) return;
      closeTip();
    });

    addEventListener('scroll', closeTip, true);
    addEventListener('resize', closeTip, { passive: true });

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
  const sourceBySlug = new Map();
  const noteBySlug = new Map(config.notes.map(note => [note.slug, note]));

  for (const note of config.notes) {
    const full = path.join(ROOT, note.file);
    let source = fs.readFileSync(full, 'utf8');
    if (source.charCodeAt(0) === 0xfeff) source = source.slice(1);
    sourceBySlug.set(note.slug, source);
  }

  const canonicalDefinitions = new Map();
  for (const [slug, source] of sourceBySlug) canonicalDefinitions.set(slug, collectDefinitions(source, slug));

  for (const note of config.notes) {
    const full = path.join(ROOT, note.file);
    let source = sourceBySlug.get(note.slug);
    const sourceSlug = config.definitionSources && config.definitionSources[note.slug];
    let ticketDiagnostics = null;

    if (sourceSlug) {
      const sourceDefs = canonicalDefinitions.get(sourceSlug) || [];
      const injected = injectDefinitionsIntoTickets(source, sourceDefs, {
        glossary: GLOSSARY,
        sourceSlug,
        scopeRules: (config.definitionTicketScopes && config.definitionTicketScopes[note.slug]) || []
      });
      source = injected.source;
      ticketDiagnostics = injected.diagnostics;
    }

    const { html, sections } = markdownToStaticHtml(source);
    const defs = collectDefinitions(source, note.slug);
    let content = wrapDefinitions(html, defs);
    content = wrapTicketDefinitionPanels(content);
    fs.writeFileSync(path.join(OUT, `${note.slug}.html`), notePage({ note, content, sections, defs }));
    fs.copyFileSync(full, path.join(OUT, path.basename(note.file)));
    notesBySlug.set(note.slug, { note, sections });

    if (ticketDiagnostics) {
      const total = ticketDiagnostics.reduce((n, x) => n + x.count, 0);
      console.log(`[definitions] ${note.slug}: ${ticketDiagnostics.length} tickets, ${total} linked canonical definitions`);
      for (const row of ticketDiagnostics) {
        if (!row.count) console.warn(`[definitions] ticket ${row.ticket}: no canonical definitions matched`);
      }
    }
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
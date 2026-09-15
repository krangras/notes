const LETTER_OR_NUMBER = /[\p{L}\p{N}]/u;
const RUSSIAN_ENDINGS = [
  'иями','ями','ами','ией','иям','иях','его','ого','ему','ому','ыми','ими','ая','яя','ое','ее','ые','ие',
  'ый','ий','ой','ую','юю','ых','их','ов','ев','ей','ом','ем','ам','ям','ах','ях','ию','ью','ия','ья','а','я','ы','и','у','ю','е','о','й','ь'
];

const uniq = xs => [...new Set(xs.filter(Boolean))];
const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

function stripMathAndMarkup(input) {
  return String(input ?? '')
    .replace(/```math\s*\n[\s\S]*?```/gi, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/\$[^$\n]+?\$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[[^\]]+\]\([^\)]+\)/g, m => m.replace(/^\[/, '').replace(/\]\([\s\S]*$/, ''))
    .replace(/[*_~`>#|]/g, ' ')
    .replace(/[«»“”"'():;,!?=+\/\\]/g, ' ')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stemWord(word) {
  let w = String(word ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, '');
  if (w.length <= 4 || /\d/.test(w)) return w;
  for (const ending of RUSSIAN_ENDINGS) {
    if (w.endsWith(ending) && w.length - ending.length >= 4) {
      w = w.slice(0, -ending.length);
      break;
    }
  }
  return w;
}

function tokenise(input) {
  return stripMathAndMarkup(input)
    .split(/\s+/)
    .map(w => ({ raw: w, stem: stemWord(w) }))
    .filter(x => x.stem && LETTER_OR_NUMBER.test(x.stem));
}

function termTokens(term) {
  return tokenise(term).map(x => x.stem);
}

function firstTermMatch(haystackTokens, aliases) {
  let best = null;
  for (const alias of aliases) {
    const needle = termTokens(alias);
    if (!needle.length) continue;
    outer: for (let i = 0; i <= haystackTokens.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (haystackTokens[i + j].stem !== needle[j]) continue outer;
      }
      const candidate = { pos: i, length: needle.length, alias };
      if (!best || candidate.pos < best.pos || (candidate.pos === best.pos && candidate.length > best.length)) best = candidate;
      break;
    }
  }
  return best;
}

function definitionScope(anchorId) {
  const id = String(anchorId || '');
  if (/^complex/.test(id)) return 'complex';
  if (/^(matrix|det|inverse|slu)/.test(id)) return 'matrix';
  if (/^(vec|scalar|onb|vector-product|mixed-product)/.test(id)) return 'vector';
  if (/^(coord|line|plane|ellipse|hyperbola|parabola)/.test(id)) return 'analytic';
  if (/^(lp|subspace)/.test(id)) return 'linear-space';
  return 'other';
}

function preferredScope(ticketNo, rules) {
  const n = Number(ticketNo);
  for (const rule of rules || []) {
    if (n >= Number(rule.from) && n <= Number(rule.to)) return String(rule.scope || '');
  }
  return '';
}

function canonicalAnchor(def) {
  return def.anchorId || def.id;
}

function displayName(def, glossary) {
  const id = canonicalAnchor(def);
  const curated = glossary[id] || [];
  const generated = def.terms || [];
  const candidates = uniq([...curated, ...generated])
    .map(s => String(s).trim())
    .filter(s => s.length >= 3);
  if (candidates.length) {
    candidates.sort((a, b) => a.length - b.length);
    const best = candidates[0];
    return best.charAt(0).toUpperCase() + best.slice(1);
  }
  return def.label || 'Определение';
}

function definitionAliases(def, glossary) {
  const id = canonicalAnchor(def);
  return uniq([...(glossary[id] || []), ...(def.terms || [])])
    .map(s => String(s).trim().toLowerCase())
    .filter(s => s.length >= 3);
}

function stripLegacyDefinitionBlock(segment) {
  const lines = String(segment).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let skipping = false;
  for (const line of lines) {
    if (!skipping && /^###\s+Определения\s+из\s+полной\s+тетради\s*$/i.test(line.trim())) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (/^#{1,6}\s+/.test(line.trim()) || /^<a\s+id=["']ticket-\d+["']/.test(line.trim())) {
        skipping = false;
        out.push(line);
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

function sourceLink(sourceSlug, def) {
  return `./${sourceSlug}.html#${encodeURIComponent(canonicalAnchor(def))}`;
}

function localId(ticketNo, def) {
  return `ticket-${ticketNo}__${canonicalAnchor(def)}`;
}

function renderTicketDefinitionBlock(ticketNo, matches, { glossary, sourceSlug }) {
  if (!matches.length) {
    return [
      `<!-- ticket-definitions-start:${ticketNo} -->`,
      '### Определения этого билета',
      '',
      '<p class="ticket-definitions-empty">Автоматически связанных определений в полном конспекте не найдено.</p>',
      `<!-- ticket-definitions-end:${ticketNo} -->`,
      ''
    ].join('\n');
  }

  const chips = matches.map(({ def }) => {
    const id = localId(ticketNo, def);
    return `<a class="ticket-def-chip" href="#${escapeHtml(id)}">${escapeHtml(displayName(def, glossary))}</a>`;
  }).join('');

  const blocks = [];
  matches.forEach(({ def }, index) => {
    const id = localId(ticketNo, def);
    const body = String(def.text || '').trim();
    const trailing = Array.isArray(def.trailing) ? def.trailing.filter(Boolean) : [];
    blocks.push(`<!-- ticket-definition-start:${id} -->`);
    blocks.push(`<a id="${id}"></a>`);
    // Нумерация локальная для каждого билета: 1, 2, 3... независимо от
    // номера определения в полном конспекте. Сам текст остаётся каноническим.
    blocks.push(`**Определение ${index + 1}.** ${body}`);
    if (trailing.length) blocks.push('', ...trailing);
    blocks.push('', `<a class="def-source" href="${sourceLink(sourceSlug, def)}">Открыть в полном конспекте ↗</a>`, '');
    blocks.push(`<!-- ticket-definition-end:${id} -->`, '');
  });

  return [
    `<!-- ticket-definitions-start:${ticketNo} -->`,
    '### Определения этого билета',
    '',
    `<div class="ticket-definitions-meta"><strong>${matches.length}</strong> ${plural(matches.length, 'определение', 'определения', 'определений')} — автоматически из полного конспекта</div>`,
    `<nav class="ticket-definitions-chips" aria-label="Определения билета">${chips}</nav>`,
    '',
    ...blocks,
    `<!-- ticket-definitions-end:${ticketNo} -->`,
    ''
  ].join('\n');
}

function plural(n, one, few, many) {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return one;
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
  return many;
}

export function injectDefinitionsIntoTickets(sourceRaw, definitions, options = {}) {
  const glossary = options.glossary || {};
  const sourceSlug = options.sourceSlug || 'agitdu-full';
  const scopeRules = options.scopeRules || [];
  const source = String(sourceRaw).replace(/\r\n/g, '\n');
  const defs = (definitions || [])
    .filter(d => d && canonicalAnchor(d) && d.text)
    .map((def, sourceOrder) => ({
      def,
      sourceOrder,
      aliases: definitionAliases(def, glossary)
    }))
    .filter(x => x.aliases.length);

  const diagnostics = [];
  let totalDefinitions = 0;

  const out = source.replace(
    /(<a\s+id=["']ticket-(\d+)["']\s*><\/a>\s*\n)([\s\S]*?)(?=(?:<a\s+id=["']ticket-\d+["']\s*><\/a>)|$)/gi,
    (whole, anchor, ticketNo, rawSegment) => {
      let segment = stripLegacyDefinitionBlock(rawSegment);
      const titleMatch = segment.match(/^(\s*##\s+[^\n]+\n)/m);
      if (!titleMatch) return anchor + segment;

      const scanText = segment.replace(/\[↑\s*К содержанию\]\([^\n]+\)/gi, ' ');
      const tokens = tokenise(scanText);
      const matches = [];
      const wantedScope = preferredScope(ticketNo, scopeRules);
      for (const entry of defs) {
        const hit = firstTermMatch(tokens, entry.aliases);
        if (hit) matches.push({ ...entry, ...hit, scope: definitionScope(canonicalAnchor(entry.def)) });
      }
      matches.sort((a, b) => a.pos - b.pos || b.length - a.length || a.sourceOrder - b.sourceOrder);

      // Resolve ambiguous aliases (e.g. "базис" exists both in vector geometry and linear spaces).
      // Same textual occurrence is assigned to the definition from the ticket's preferred subject scope.
      const byOccurrence = new Map();
      for (const m of matches) {
        const key = `${m.pos}:${m.length}:${String(m.alias).toLowerCase()}`;
        const prev = byOccurrence.get(key);
        if (!prev || (wantedScope && m.scope === wantedScope && prev.scope !== wantedScope)) byOccurrence.set(key, m);
      }

      const selected = [];
      const seen = new Set();
      for (const m of [...byOccurrence.values()].sort((a, b) => a.pos - b.pos || b.length - a.length || a.sourceOrder - b.sourceOrder)) {
        const id = canonicalAnchor(m.def);
        if (seen.has(id)) continue;
        seen.add(id);
        selected.push(m);
      }

      // В начале билета определения идут в том же логическом порядке, что и
      // в полном конспекте. Это стабильнее и понятнее, чем порядок первого
      // случайного упоминания внутри доказательства.
      selected.sort((a, b) => a.sourceOrder - b.sourceOrder || a.pos - b.pos);

      totalDefinitions += selected.length;
      diagnostics.push({ ticket: Number(ticketNo), count: selected.length, ids: selected.map(x => canonicalAnchor(x.def)) });

      const block = renderTicketDefinitionBlock(ticketNo, selected, { glossary, sourceSlug });
      const start = titleMatch.index + titleMatch[0].length;
      segment = segment.slice(0, start) + '\n' + block + '\n' + segment.slice(start);
      return anchor + segment;
    }
  );

  return { source: out, diagnostics, totalDefinitions };
}

export function wrapTicketDefinitionPanels(html) {
  return String(html)
    .replace(/<!--\s*ticket-definitions-start:(\d+)\s*-->/g, '<section class="ticket-definitions" data-ticket-definitions="$1">')
    .replace(/<!--\s*ticket-definitions-end:(\d+)\s*-->/g, '</section>')
    .replace(/<!--\s*ticket-definition-start:([^\s]+)\s*-->/g, '<article class="ticket-definition-card" data-definition-card="$1">')
    .replace(/<!--\s*ticket-definition-end:([^\s]+)\s*-->/g, '</article>');
}

export function canonicalGlossaryKey(anchorId) {
  const value = String(anchorId || '');
  return value.replace(/^ticket-\d+__/, '');
}

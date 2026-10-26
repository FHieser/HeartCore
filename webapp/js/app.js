// HeartCore site: data loading + rendering.
// All game data is fetched at runtime from Baseline.md and data/**/*.yaml,
// so editing those files is enough to update the site.
// The loaders (load*) are kept independent of the DOM so a future
// character builder can reuse them.

// The webapp lives in webapp/; the game content sits one level up.
const DATA_ROOT = '../';

const DOMAIN_COLORS = {
  body: '#b3392e',
  mind: '#6e4aa8',
  tech: '#1f6f8b',
  aid: '#2f7a45',
  hcore: '#8a6416',
};
const FALLBACK_COLORS = ['#a8581f', '#9c3a6e', '#4a5fa8', '#5f7a1f'];

// HCore cards: extraordinary cards outside the domains. Name and summary come from data/hcore/hcore.yaml.
const HCORE = {
  id: 'hcore',
  name: 'HCore Cards',
  covers: 'Extraordinary cards outside the domains: special items, artifacts, abilities and curses.',
};

// ---------- Fetching ----------

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return res.text();
}

let baselinePromise;
function loadBaseline() {
  baselinePromise ??= fetchText(`${DATA_ROOT}Baseline.md`).then(parseSections);
  return baselinePromise;
}

// ---------- Markdown helpers ----------

// Split a markdown document into { "Heading": "body" } by "## " headings.
function parseSections(md) {
  const sections = { _intro: '' };
  let current = '_intro';
  for (const line of md.replace(/\r/g, '').split('\n')) {
    const m = line.match(/^## (.+)$/);
    if (m) {
      current = m[1].trim();
      sections[current] = '';
    } else {
      sections[current] += line + '\n';
    }
  }
  return sections;
}

// Rows of the first markdown table in `text`, header and separator skipped.
function parseTable(text) {
  const all = text.split('\n').map(l => l.trim());
  const start = all.findIndex(l => l.startsWith('|'));
  if (start < 0) return [];
  const end = all.findIndex((l, i) => i > start && !l.startsWith('|'));
  const lines = all.slice(start, end < 0 ? undefined : end);
  return lines.slice(2).map(l =>
    l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
  );
}

const stripMd = s => s.replace(/\*\*|\*|`/g, '').trim();
const slug = s => stripMd(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// Minimal inline markdown: **bold**, *italic*, `code`. Input must be escaped.
function inlineMd(s) {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

// Paragraphs and "- " bullet lists; everything else (tables, code) is skipped.
function renderProse(text) {
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${inlineMd(escapeHtml(para.join(' ')))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<ul>${list.map(i => `<li>${inlineMd(escapeHtml(i))}</li>`).join('')}</ul>`);
    list = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (/^- /.test(line)) {
      flushPara();
      (list ??= []).push(line.slice(2));
    } else if (!line || /^(#|\||```|>|---)/.test(line)) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return out.join('');
}

// ---------- Game data loaders ----------

// Domains from the "Domains" table in Baseline.md.
async function loadDomains() {
  const s = await loadBaseline();
  return parseTable(s['Domains'] || '').map(([name, covers]) => ({
    id: slug(name),
    name: stripMd(name),
    covers: stripMd(covers || ''),
  }));
}

// [key in the class file, label, short label]
const FEATURE_KINDS = [['main', 'Main', 'Main'], ['flair', 'Flair', 'Flair'], ['hope', 'Hope feature', 'Hope']];
const asList = v => (Array.isArray(v) ? v : v ? [v] : []);

// Ids of the .yaml files in a data folder, sorted. Static hosts can't list folders,
// so this reads index.json (written by the deploy workflow) and falls back to the
// directory listing that `python -m http.server` serves locally.
async function listYaml(dir) {
  const url = `${DATA_ROOT}${dir}/`;
  let names;
  try {
    names = JSON.parse(await fetchText(`${url}index.json`));
  } catch {
    const html = await fetchText(url);
    names = [...html.matchAll(/href="([^"?#/]+\.ya?ml)"/g)].map(m => decodeURIComponent(m[1]));
  }
  return names.map(n => n.replace(/\.ya?ml$/, '')).sort();
}

// One file per class: data/classes/<id>.yaml.
let classesPromise;
function loadClasses() {
  classesPromise ??= (async () => {
    const ids = await listYaml('data/classes');
    return Promise.all(ids.map(async id => {
      const c = jsyaml.load(await fetchText(`${DATA_ROOT}data/classes/${id}.yaml`)) || {};
      const features = c.features || {};
      return {
        id,
        name: c.name || id,
        domains: asList(c.domains).map(d => slug(String(d))),
        fantasy: c.fantasy || '',
        examples: asList(c.examples),
        stats: c.stats || {},
        features: Object.fromEntries(FEATURE_KINDS.map(([kind]) => {
          const f = features[kind] || {};
          return [kind, {
            name: f.name || '',
            cost: kind === 'hope' ? f.cost ?? 3 : f.cost,
            text: asList(f.text),
            options: asList(f.options),
          }];
        })),
        loop: c.loop || '',
        open: asList(c.open),
      };
    }));
  })();
  return classesPromise;
}

// The HCore file holds guidelines plus cards: { name, summary, rules, types, cards }.
let hcorePromise;
function loadHcore() {
  hcorePromise ??= fetchText(`${DATA_ROOT}data/hcore/hcore.yaml`)
    .then(text => {
      const h = jsyaml.load(text) || {};
      return {
        name: h.name || HCORE.name,
        summary: h.summary || HCORE.covers,
        rules: asList(h.rules),
        types: asList(h.types),
        cards: asList(h.cards),
      };
    })
    .catch(() => ({ name: HCORE.name, summary: HCORE.covers, rules: [], types: [], cards: [] }));
  return hcorePromise;
}

// Cards of one domain (data/domains/<id>.yaml) or the HCore cards. Missing file → empty list.
async function loadCards(id) {
  if (id === HCORE.id) return (await loadHcore()).cards;
  let text;
  try {
    text = await fetchText(`${DATA_ROOT}data/domains/${id}.yaml`);
  } catch {
    return [];
  }
  const data = jsyaml.load(text);
  return Array.isArray(data) ? data : [];
}

// Ailments: rules plus the physical and stress d12 tables (data/mechanics/ailments.yaml).
const AILMENT_TABLES = [
  { id: 'physical', color: '#b3392e' },
  { id: 'stress', color: '#6e4aa8' },
];
const LASTS_LABELS = {
  instant: 'Instant',
  scene: 'Until end of scene',
  short_rest: 'Until short rest',
  long_rest: 'Until long rest',
  treated: 'Until treated',
  permanent: 'Permanent',
  special: 'Special',
};

let ailmentsPromise;
function loadAilments() {
  ailmentsPromise ??= fetchText(`${DATA_ROOT}data/mechanics/ailments.yaml`).then(text => {
    const a = jsyaml.load(text) || {};
    return {
      name: a.name || 'Ailments',
      summary: a.summary || '',
      rules: asList(a.rules),
      treatment: a.treatment ? { name: a.treatment.name || '', text: asList(a.treatment.text) } : null,
      notes: asList(a.notes),
      open: asList(a.open),
      tables: AILMENT_TABLES.map(({ id, color }) => {
        const t = a[id] || {};
        return {
          id,
          color,
          name: t.name || id,
          trigger: t.trigger || '',
          entries: asList(t.table).map(e => ({ ...e, text: asList(e.text) })),
        };
      }),
    };
  });
  return ailmentsPromise;
}

// Rest: rest types and rest actions (data/mechanics/rest.yaml).
let restPromise;
function loadRest() {
  restPromise ??= fetchText(`${DATA_ROOT}data/mechanics/rest.yaml`).then(text => {
    const r = jsyaml.load(text) || {};
    return {
      name: r.name || 'Rest',
      summary: r.summary || '',
      rests: asList(r.rests),
      rules: asList(r.rules),
      actions: asList(r.actions).map(a => ({ ...a, text: asList(a.text) })),
      notes: asList(r.notes),
      open: asList(r.open),
    };
  });
  return restPromise;
}

// Equipment: armor, shields, weapon categories and consumables (data/mechanics/equipment.yaml).
const EQUIPMENT_SECTIONS = [
  { id: 'armor', name: 'Armor' },
  { id: 'shields', name: 'Shields' },
  { id: 'weapons', name: 'Weapons' },
  { id: 'consumables', name: 'Consumables' },
];

let equipmentPromise;
function loadEquipment() {
  equipmentPromise ??= fetchText(`${DATA_ROOT}data/mechanics/equipment.yaml`).then(text => {
    const e = jsyaml.load(text) || {};
    return {
      name: e.name || 'Equipment',
      summary: e.summary || '',
      rules: asList(e.rules),
      open: asList(e.open),
      sections: EQUIPMENT_SECTIONS.map(({ id, name }) => ({
        id,
        name,
        rules: asList(e[id]?.rules),
        items: asList(e[id]?.list).map(item => ({ ...item, text: asList(item.text) })),
      })),
    };
  });
  return equipmentPromise;
}

function domainColor(id, index = 0) {
  return DOMAIN_COLORS[id] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ---------- Shared chrome ----------

const NAV = [['overview', 'index.html', 'Overview'], ['domains', 'domains.html', 'Domains'], ['classes', 'classes.html', 'Classes'], ['mechanics', 'rest.html', 'Mechanics'], ['characters', 'characters.html', 'Characters']];
const MECHANICS_NAV = [['rest', 'rest.html', 'Rest'], ['equipment', 'equipment.html', 'Equipment'], ['ailments', 'ailments.html', 'Ailments']];

// Top tabs; the three mechanics pages share the "Mechanics" tab and get a sub-tab bar.
function renderNav(current) {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  const inMechanics = MECHANICS_NAV.some(([id]) => id === current);
  nav.innerHTML = NAV
    .map(([id, href, label]) => `<a href="${href}" class="${id === current || (id === 'mechanics' && inMechanics) ? 'current' : ''}">${label}</a>`)
    .join('');
  if (inMechanics && !document.querySelector('.sub-nav')) {
    document.querySelector('.site-header').insertAdjacentHTML('afterend', `
      <nav class="sub-nav" aria-label="Mechanics">
        ${MECHANICS_NAV.map(([id, href, label]) => `<a href="${href}" class="${id === current ? 'current' : ''}">${label}</a>`).join('')}
      </nav>`);
  }
}

function showError(el, err) {
  const hint = location.protocol === 'file:'
    ? '\n\nOpened from the file system: browsers block fetch() there. Serve the repo root instead (serve.bat, or `python -m http.server 8000`) and open http://localhost:8000/.'
    : '';
  el.innerHTML = `<p class="status error">${escapeHtml(err.message + hint)}</p>`;
  console.error(err);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Coloured tags linking to each domain's section on the domains page.
function domainTags(ids, domains) {
  return ids.map(id => {
    const i = domains.findIndex(d => d.id === id);
    return i < 0 ? '' : `<a class="tag" href="domains.html#${id}" style="--domain:${domainColor(id, i)}">${escapeHtml(domains[i].name)}</a>`;
  }).join('');
}

// ---------- Overview page ----------

// The links to the other areas as folders in a filing cabinet drawer. Folders stand one behind
// another with staggered tabs; hovering or focusing one pulls it up and out of the drawer.
function renderCabinet(folders) {
  const tabs = folders.length;
  return `
    <section class="cabinet" aria-label="Archive">
      <div class="drawer">
        ${folders.map((f, i) => `
          <a class="folder" href="${f.href}" style="--i:${i};--tab-left:${(i % 3) * 33}%;z-index:${i + 1}">
            <span class="folder-tab">${escapeHtml(f.tab)}</span>
            <span class="folder-body">
              <span class="folder-head">
                <span class="eyebrow">${escapeHtml(f.file)} · ${escapeHtml(f.count)}</span>
                <span class="folder-title">${escapeHtml(f.title)} →</span>
              </span>
              <span class="link-field-domains">
                ${f.chips.map(([label, color]) => `<span style="--domain:${color || '#5d5545'}">${escapeHtml(label)}</span>`).join('')}
              </span>
            </span>
          </a>`).join('')}
      </div>
      <div class="drawer-front" aria-hidden="true">
        <span class="drawer-label">HeartCore · ${tabs} files</span>
        <span class="drawer-handle"></span>
      </div>
    </section>`;
}

async function initOverview() {
  const root = document.getElementById('content');
  renderNav('overview');
  try {
    const [sections, domains, classes, rest, equipment, ailments] = await Promise.all([
      loadBaseline(), loadDomains(), loadClasses(),
      loadRest().catch(() => null), loadEquipment().catch(() => null), loadAilments().catch(() => null),
    ]);
    const all = [...domains, HCORE];
    const cardLists = await Promise.all(all.map(d => loadCards(d.id)));
    const total = cardLists.reduce((n, l) => n + l.length, 0);

    const intro = sections._intro
      .split('\n')
      .filter(l => l.trim() && !/^(#|>|\*A )/.test(l.trim()))
      .join('\n');

    root.innerHTML = `
      <section>
        <p class="eyebrow">A Daggerheart horror variant</p>
        <h1>HeartCore</h1>
        <div class="lede prose">${renderProse(intro)}</div>
      </section>

      ${sections['Design Pillars'] ? `
        <h2>Design Pillars</h2>
        <div class="prose">${renderProse(sections['Design Pillars'])}</div>` : ''}

      <h2>Archive</h2>
      ${renderCabinet([
        { href: 'domains.html', tab: 'Domains', file: 'File 01', title: 'All domains & cards', count: plural(total, 'card'),
          chips: all.map((d, i) => [d.name, domainColor(d.id, i)]) },
        { href: 'classes.html', tab: 'Classes', file: 'File 02', title: 'All classes', count: `${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`,
          chips: classes.map(c => [c.name]) },
        rest && { href: 'rest.html', tab: 'Rest', file: 'File 03', title: 'Short & long rests', count: plural(rest.actions.length, 'rest action'),
          chips: rest.rests.map(r => [`${r.name} · ${plural(r.actions, 'action')}`]) },
        equipment && { href: 'equipment.html', tab: 'Equipment', file: 'File 04', title: 'Armor, weapons & consumables',
          count: plural(equipment.sections.reduce((n, s) => n + s.items.length, 0), 'item'),
          chips: equipment.sections.filter(s => s.items.length).map(s => [s.name]) },
        ailments && { href: 'ailments.html', tab: 'Ailments', file: 'File 05', title: 'Physical & Stress ailments',
          count: plural(ailments.tables.reduce((n, t) => n + t.entries.length, 0), 'ailment'),
          chips: ailments.tables.map(t => [t.name, t.color]) },
        { href: 'characters.html', tab: 'Characters', file: 'File 06', title: 'Character creator', count: 'saved in your browser',
          chips: [['Create, track, level up, export']] },
      ].filter(Boolean))}
    `;
  } catch (err) {
    showError(root, err);
  }
}

// ---------- Domains page ----------

// Walk the domain/class ring so it can be laid out around a 3×3 grid.
// Returns [domain, class, domain, class, …] or null if it isn't a simple ring of 8.
function ringOrder(domains, classes) {
  if (domains.length !== 4 || classes.length !== 4) return null;
  const order = [];
  const used = new Set();
  const rank = id => domains.findIndex(d => d.id === id);
  const other = (c, id) => c.domains.find(d => d !== id);
  let domain = domains[0].id;
  for (let i = 0; i < 4; i++) {
    // Prefer the neighbour listed earliest in the Domains table (Body → Tech, not Body → Aid).
    const cls = classes
      .filter(c => !used.has(c.name) && c.domains.includes(domain))
      .sort((a, b) => rank(other(a, domain)) - rank(other(b, domain)))[0];
    if (!cls) return null;
    used.add(cls.name);
    order.push({ kind: 'domain', id: domain }, { kind: 'class', cls });
    domain = other(cls, domain);
  }
  return domain === domains[0].id ? order : null;
}

function renderRing(domains, classes) {
  const order = ringOrder(domains, classes);
  if (!order) return '';
  // Clockwise perimeter positions of a 3×3 grid, starting top-left.
  const pos = [[1, 1], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1]];
  const byId = Object.fromEntries(domains.map((d, i) => [d.id, { ...d, i }]));
  const cells = order.map((item, k) => {
    const [row, col] = pos[k];
    const style = `grid-row:${row};grid-column:${col}`;
    if (item.kind === 'domain') {
      const d = byId[item.id];
      return `<a class="ring-cell ring-domain" href="#${d.id}"
                 style="${style};--domain:${domainColor(d.id, d.i)}">${escapeHtml(d.name)}</a>`;
    }
    return `<a class="ring-cell ring-class" href="classes.html#${item.cls.id}" style="${style}">${escapeHtml(item.cls.name)}</a>`;
  });
  cells.push(`<div class="ring-cell ring-center" style="grid-row:2;grid-column:2" aria-hidden="true">♥</div>`);
  return `<div class="ring">${cells.join('')}</div>`;
}

// Rules terms explained on hover. Order matters: longer terms first.
const GLOSSARY = [
  ['Help an Ally', 'Spend 1 Hope to add a d6 to an ally\'s roll.'],
  ['Recall Cost', 'Stress you mark to bring a card back from the vault mid-scene. Free during a rest.'],
  ['Very Close', 'Range: a few steps away.'],
  ['Very Far', 'Range: across a large space, at the edge of what you can reach.'],
  ['Melee', 'Range: within arm\'s reach.'],
  ['Close', 'Range: across a room.'],
  ['Far', 'Range: across a large room or a street.'],
  ['Vulnerable', 'Rolls against you have advantage. You become Vulnerable when your Stress is maxed.'],
  ['Restrained', 'You can\'t move, but you can still act.'],
  ['Hidden', 'Out of sight: rolls against you have disadvantage until you\'re found or reveal yourself.'],
  ['temporarily', 'A temporary condition holds until it\'s cleared; the GM can spend Fear to clear it from an adversary.'],
  ['temporary', 'A temporary condition holds until it\'s cleared; the GM can spend Fear to clear it from an adversary.'],
  ['disadvantage', 'Subtract a d6 from the roll.'],
  ['Disadvantage', 'Subtract a d6 from the roll.'],
  ['advantage', 'Add a d6 to the roll.'],
  ['Advantage', 'Add a d6 to the roll.'],
  ['spotlight', 'The moment the scene focuses on your character and you act.'],
  ['vault', 'Where cards go when they aren\'t in your loadout. Vaulted cards can\'t be used.'],
  ['loadout', 'Your active cards: up to 5 slots.'],
  ['Fear', 'The GM\'s resource, used for GM moves and to make adversaries stronger.'],
];
const GLOSSARY_RE = new RegExp(`\\b(${GLOSSARY.map(([t]) => t).join('|')})\\b`, 'g');
const GLOSSARY_MAP = Object.fromEntries(GLOSSARY);

// Wrap glossary terms in text (never inside HTML tags). Input must be escaped HTML.
// Range words only count as ranges after "within" or before "range" ("Close the door" stays plain).
const RANGE_TERMS = new Set(['Very Close', 'Very Far', 'Melee', 'Close', 'Far']);
const isRangeUse = (text, offset, term) => /within\s*$/i.test(text.slice(0, offset)) || /^\s+range/i.test(text.slice(offset + term.length));

function glossarize(html) {
  return html.split(/(<[^>]+>)/).map(part => (part.startsWith('<') ? part
    : part.replace(GLOSSARY_RE, (m, _term, offset, text) => (RANGE_TERMS.has(m) && !isRangeUse(text, offset, m)
      ? m
      : `<abbr class="term" title="${escapeHtml(GLOSSARY_MAP[m])}" tabindex="0">${m}</abbr>`)))).join('');
}

// Small stat chip (used with icons: ↺ Recall, ▢ slots, ◆ Hope).
const chip = text => `<span class="tag">${escapeHtml(text)}</span>`;

// Highlight costs and frequencies in card text and explain rules terms. Input must be escaped.
function highlightRules(s) {
  return glossarize(s.replace(
    /\b((?:Mark|Spend|Clear|Gain) \d+ (?:Stress|Hope|HP|Armor Slots?|Fear)|Once per (?:long rest|short rest|rest|scene|session)|\d+ uses? per (?:long rest|short rest|rest|scene)|Passive|One-shot)\b/g,
    '<span class="kw">$1</span>'
  ));
}

const cardId = (domainId, card) => `${domainId}-${slug(card.name || 'unnamed')}`;
const groupId = (domainId, label) => `${domainId}-${slug(label)}`;

function renderCard(card, domainId) {
  const src = card.source || {};
  const slots = card.slots ?? 1;
  const stats = [
    card.type,
    src.kind === 'domain' && src.level != null ? `Level ${src.level}` : null,
    `▢ ${plural(slots, 'slot')}`,
    card.recall != null ? `↺ Recall ${card.recall}` : null,
  ].filter(v => v != null);
  const text = Array.isArray(card.text) ? card.text : card.text ? [card.text] : [];
  const search = [card.name, card.type, ...text, card.flavor].filter(Boolean).join(' ').toLowerCase();
  return `
    <article class="game-card" id="${cardId(domainId, card)}" data-level="${src.level ?? ''}" data-type="${escapeHtml(card.type || '')}" data-search="${escapeHtml(search)}">
      <header><h4>${escapeHtml(card.name || 'Unnamed')}</h4></header>
      <div class="card-stats">${stats.map(chip).join('')}</div>
      <ul class="features">${text.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>
      ${card.flavor ? `<p class="flavor">“${escapeHtml(card.flavor)}”</p>` : ''}
    </article>`;
}

// Domain cards grouped by level; HCore cards grouped by type.
function groupCards(cards) {
  const groups = new Map();
  for (const c of cards) {
    const key = c.source?.kind === 'domain' && c.source.level != null
      ? `Level ${c.source.level}`
      : (c.type ? c.type[0].toUpperCase() + c.type.slice(1) : 'Other');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

// Guidelines shown at the top of the HCore section: general rules plus one line per card type.
function renderHcoreGuidelines(hcore) {
  if (!hcore || (!hcore.rules.length && !hcore.types.length)) return '';
  return `
    <details class="class-notes hcore-guidelines">
      <summary>Guidelines for HCore cards</summary>
      ${hcore.rules.length ? `<p class="eyebrow">Guidelines</p>
        <ul>${hcore.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
      ${hcore.types.length ? `<p class="eyebrow">Types</p>
        <ul>${hcore.types.map(t => `
          <li><strong>${escapeHtml(t.name || '')}</strong>: ${escapeHtml(t.what || '')}
            ${t.power ? `<br><span class="eyebrow">Power</span> ${escapeHtml(t.power)}` : ''}
            ${t.slots ? `<br><span class="eyebrow">Slots</span> ${escapeHtml(t.slots)}` : ''}
            ${t.price ? `<br><span class="eyebrow">Price</span> ${escapeHtml(t.price)}` : ''}
          </li>`).join('')}</ul>` : ''}
    </details>`;
}

function renderDomainSection({ domain, groups, color }, classes, hcore) {
  const users = classes.filter(c => c.domains.includes(domain.id));
  const count = groups.reduce((n, [, list]) => n + list.length, 0);
  const body = groups.map(([label, list]) => `
    <h3 class="level-head" id="${groupId(domain.id, label)}">${escapeHtml(label)}<span class="eyebrow">${plural(list.length, 'card')}</span></h3>
    <div class="cards">${list.map(c => renderCard(c, domain.id)).join('')}</div>`).join('');
  return `
    <section class="domain-section" id="${domain.id}" style="--domain:${color}">
      <header class="domain-head">
        <p class="eyebrow">${domain.id === HCORE.id ? 'Outside the domains' : 'Domain'} · ${plural(count, 'card')}</p>
        <h2>${escapeHtml(domain.name)}</h2>
        <p class="lede">${escapeHtml(domain.covers)}</p>
        ${users.length ? `<div class="domain-classes"><span class="eyebrow">Classes</span>
          ${users.map(c => `<a class="tag" href="classes.html#${c.id}">${escapeHtml(c.name)}</a>`).join('')}</div>` : ''}
      </header>
      ${domain.id === HCORE.id ? renderHcoreGuidelines(hcore) : ''}
      ${body || '<p class="status">No cards yet.</p>'}
    </section>`;
}

function renderSidebar(entries) {
  return `
    <p class="eyebrow">Contents</p>
    <ol class="toc">
      ${entries.map(({ domain, groups, color }) => `
        <li style="--domain:${color}">
          <a class="toc-domain" href="#${domain.id}" data-section="${domain.id}">${escapeHtml(domain.name)}</a>
          ${groups.length ? `<ol>
            ${groups.map(([label, list]) => `
              <li>
                <a class="toc-group" href="#${groupId(domain.id, label)}">${escapeHtml(label)}</a>
                <ol>${list.map(c => `<li><a class="toc-card" href="#${cardId(domain.id, c)}">${escapeHtml(c.name || 'Unnamed')}</a></li>`).join('')}</ol>
              </li>`).join('')}
          </ol>` : ''}
        </li>`).join('')}
    </ol>`;
}

// Highlight the sidebar entry of the domain currently on screen.
function watchSections(sidebar) {
  const links = Object.fromEntries(
    [...sidebar.querySelectorAll('[data-section]')].map(a => [a.dataset.section, a])
  );
  const visible = new Set();
  const observer = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
    const active = Object.keys(links).find(id => visible.has(id));
    for (const [id, a] of Object.entries(links)) a.classList.toggle('active', id === active);
  }, { rootMargin: '-10% 0px -60% 0px' });
  document.querySelectorAll('.domain-section').forEach(s => observer.observe(s));
}

async function initDomains() {
  const root = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  renderNav('domains');
  try {
    const [domains, classes, hcore] = await Promise.all([loadDomains(), loadClasses(), loadHcore()]);
    const all = [...domains, { ...HCORE, name: hcore.name, covers: hcore.summary }];
    const cardLists = await Promise.all(all.map(d => loadCards(d.id)));
    const entries = all.map((domain, i) => ({
      domain,
      groups: groupCards(cardLists[i]),
      color: domainColor(domain.id, i),
    }));

    sidebar.innerHTML = renderSidebar(entries);
    root.innerHTML = `
      <section class="domains-intro">
        <p class="eyebrow">HeartCore</p>
        <h1>Domains</h1>
        <ul class="domain-list">
          ${entries.map(({ domain, groups, color }) => `
            <li style="--domain:${color}">
              <a href="#${domain.id}">${escapeHtml(domain.name)}</a>
              <span>${escapeHtml(domain.covers)}</span>
              <span class="eyebrow">${plural(groups.reduce((n, [, l]) => n + l.length, 0), 'card')}</span>
            </li>`).join('')}
        </ul>
      </section>
      <div class="filter-bar" role="search">
        <input class="field" type="search" placeholder="Search cards…" data-filter="q" aria-label="Search cards">
        <select class="field" data-filter="level" aria-label="Level">
          <option value="">All levels</option>${[1, 2, 3, 4].map(l => `<option value="${l}">Level ${l}</option>`).join('')}
        </select>
        <select class="field" data-filter="type" aria-label="Type">
          <option value="">All types</option>${['ability', 'item', 'artifact', 'curse'].map(t => `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}
        </select>
        <label class="check"><input type="checkbox" data-filter="compact"> Compact</label>
        <span class="eyebrow filter-count" aria-live="polite"></span>
      </div>
      ${entries.map(e => renderDomainSection(e, classes, hcore)).join('')}
      <p class="status filter-empty" hidden>No cards match.</p>
    `;
    setupCardFilters(root);

    watchSections(sidebar);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (err) {
    showError(root, err);
  }
}

// Search / level / type filters and the compact view on the Domains page.
function setupCardFilters(root) {
  const bar = root.querySelector('.filter-bar');
  const field = key => bar.querySelector(`[data-filter="${key}"]`);
  const apply = () => {
    const q = field('q').value.trim().toLowerCase();
    const level = field('level').value;
    const type = field('type').value;
    root.classList.toggle('compact', field('compact').checked);
    let shown = 0;
    root.querySelectorAll('.game-card').forEach(card => {
      const ok = (!q || card.dataset.search.includes(q))
        && (!level || card.dataset.level === level)
        && (!type || card.dataset.type === type);
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    // Hide level headings and sections that have nothing left.
    root.querySelectorAll('.cards').forEach(grid => {
      const empty = ![...grid.children].some(c => !c.hidden);
      grid.hidden = empty;
      if (grid.previousElementSibling?.classList.contains('level-head')) grid.previousElementSibling.hidden = empty;
    });
    const filtering = Boolean(q || level || type);
    root.querySelectorAll('.domain-section').forEach(sec => {
      sec.hidden = filtering && ![...sec.querySelectorAll('.game-card')].some(c => !c.hidden);
    });
    bar.querySelector('.filter-count').textContent = filtering ? `${shown} shown` : '';
    root.querySelector('.filter-empty').hidden = shown > 0;
  };
  bar.addEventListener('input', apply);
  bar.addEventListener('change', apply);
}

// ---------- Classes page ----------

const featureId = (cls, kind) => `${cls.id}-${kind}`;

function renderFeature(cls, [kind, label]) {
  const f = cls.features[kind];
  const stats = [label, f.cost != null ? `◆ ${f.cost} Hope` : null].filter(Boolean);
  const options = f.options.map(o => typeof o === 'string' ? { text: o } : o);
  return `
    <article class="game-card" id="${featureId(cls, kind)}">
      <header><h4>${escapeHtml(f.name || 'Unnamed')}</h4></header>
      <div class="card-stats">${stats.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      <ul class="features">${f.text.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>
      ${options.length ? `<ul class="options">${options.map(o => `
        <li>${o.name ? `<strong>${escapeHtml(o.name)}</strong> ` : ''}${highlightRules(escapeHtml(o.text || ''))}</li>`).join('')}
      </ul>` : ''}
    </article>`;
}

const CLASS_STATS = [['evasion', 'Evasion'], ['hp', 'HP'], ['stress', 'Stress']];

function renderClassStats(stats) {
  const shown = CLASS_STATS.filter(([key]) => stats[key] != null);
  if (!shown.length) return '';
  return `<div class="class-stats">${shown.map(([key, label]) => `
    <span class="stat"><span class="stat-value">${escapeHtml(stats[key])}</span><span class="eyebrow">${label}</span></span>`).join('')}
  </div>`;
}

function renderClassSection(cls, domains) {
  const colors = cls.domains.map(id => domainColor(id, domains.findIndex(d => d.id === id)));
  const names = cls.domains.map(id => domains.find(d => d.id === id)?.name || id);
  return `
    <section class="domain-section class-section" id="${cls.id}"
             style="--c1:${colors[0] || 'var(--accent)'};--c2:${colors[1] || colors[0] || 'var(--accent)'}">
      <header class="domain-head">
        <p class="eyebrow">Class · ${escapeHtml(names.join(' + '))}</p>
        <h2>${escapeHtml(cls.name)}</h2>
        ${cls.fantasy ? `<p class="lede"><em>${escapeHtml(cls.fantasy)}</em></p>` : ''}
        <div class="domain-classes"><span class="eyebrow">Domains</span>${domainTags(cls.domains, domains)}</div>
        ${cls.examples.length ? `<p class="class-examples"><span class="eyebrow">Examples</span> ${escapeHtml(cls.examples.join(', '))}</p>` : ''}
        ${renderClassStats(cls.stats)}
      </header>
      <div class="cards class-cards">${FEATURE_KINDS.map(k => renderFeature(cls, k)).join('')}</div>
      ${cls.loop || cls.open.length ? `
        <div class="class-notes">
          ${cls.loop ? `<p><span class="eyebrow">Loop</span> ${escapeHtml(cls.loop)}</p>` : ''}
          ${cls.open.length ? `<details><summary>Open points (${cls.open.length})</summary>
            <ul>${cls.open.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul></details>` : ''}
        </div>` : ''}
    </section>`;
}

function renderClassSidebar(classes) {
  return `
    <p class="eyebrow">Contents</p>
    <ol class="toc">
      ${classes.map(cls => `
        <li>
          <a class="toc-domain" href="#${cls.id}" data-section="${cls.id}">${escapeHtml(cls.name)}</a>
          <ol>${FEATURE_KINDS.map(([kind, label]) => `
            <li><a class="toc-card" href="#${featureId(cls, kind)}">${escapeHtml(cls.features[kind].name || label)}</a></li>`).join('')}
          </ol>
        </li>`).join('')}
    </ol>`;
}

async function initClasses() {
  const root = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  renderNav('classes');
  try {
    const [domains, classes] = await Promise.all([loadDomains(), loadClasses()]);

    sidebar.innerHTML = renderClassSidebar(classes);
    root.innerHTML = `
      <section class="domains-intro">
        <p class="eyebrow">HeartCore</p>
        <h1>Classes</h1>
        <p class="lede">Each class has two domains, a main mechanic, a Flair and a Hope feature. Classes are archetypes, not professions.</p>
      </section>
      ${classes.map(c => renderClassSection(c, domains)).join('')}
    `;

    watchSections(sidebar);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (err) {
    showError(root, err);
  }
}

// ---------- Ailments page ----------

const ailmentId = (table, entry) => `${table.id}-${slug(entry.name || String(entry.roll))}`;

function renderAilment(table, entry) {
  const stats = [LASTS_LABELS[entry.lasts] || entry.lasts].filter(Boolean);
  return `
    <article class="game-card" id="${ailmentId(table, entry)}">
      <header>
        <h4>${escapeHtml(entry.name || 'Unnamed')}</h4>
        <span class="roll" title="d12 result">${escapeHtml(entry.roll ?? '?')}</span>
      </header>
      <div class="card-stats">${stats.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      <ul class="features">${entry.text.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>
    </article>`;
}

function renderAilmentSection(table) {
  return `
    <section class="domain-section" id="${table.id}" style="--domain:${table.color}">
      <header class="domain-head">
        <p class="eyebrow">d12 table · ${plural(table.entries.length, 'ailment')}</p>
        <h2>${escapeHtml(table.name)}</h2>
        ${table.trigger ? `<p class="lede"><span class="eyebrow">Trigger</span> ${escapeHtml(table.trigger)}</p>` : ''}
      </header>
      <div class="cards ailment-cards">${table.entries.map(e => renderAilment(table, e)).join('')}</div>
    </section>`;
}

// ---------- Equipment page ----------

const RARITY_LABELS = ['Common', 'Workplace / buildable', 'Traders', 'Special traders'];
const equipmentId = (section, item) => `${section.id}-${slug(item.name || 'item')}`;

function featureList(label, features) {
  const list = asList(features);
  if (!list.length) return '';
  return `
    <p class="eyebrow">${escapeHtml(label)}</p>
    <ul class="options">${list.map(f => `
      <li><strong>${escapeHtml(f.name || '')}</strong> ${highlightRules(escapeHtml(f.text || ''))}</li>`).join('')}
    </ul>`;
}

function renderEquipmentItem(section, item) {
  const stats = [
    item.tier != null ? `Tier ${item.tier}` : null,
    item.rarity != null ? `Rarity ${item.rarity} · ${RARITY_LABELS[item.rarity] || ''}` : null,
    item.thresholds ? `Thresholds ${item.thresholds.join('/')}` : null,
    section.id === 'armor' && item.score != null ? `Armor Score ${item.score}` : null,
    section.id === 'shields' && item.score != null ? `+${item.score} Armor Score` : null,
    item.trait,
    item.range,
    item.damage && item.damage !== 'none' ? `Damage ${item.damage}` : null,
    item.burden,
  ].filter(Boolean);
  const lines = [item.effect, item.built_in, ...item.text].filter(Boolean);
  return `
    <article class="game-card" id="${equipmentId(section, item)}">
      <header><h4>${escapeHtml(item.name || 'Unnamed')}</h4></header>
      <div class="card-stats">${stats.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      ${item.examples ? `<p class="requires"><span class="eyebrow">Examples</span> ${escapeHtml(asList(item.examples).join(', '))}</p>` : ''}
      ${lines.length ? `<ul class="features">${lines.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>` : ''}
      ${featureList('Utility features', item.utility_features)}
      ${featureList(item.utility_features ? 'Combat features' : 'Features', item.features)}
    </article>`;
}

function renderEquipmentSidebar(e) {
  return `
    <p class="eyebrow">Contents</p>
    <ol class="toc">
      ${e.sections.filter(s => s.items.length).map(s => `
        <li>
          <a class="toc-domain" href="#${s.id}" data-section="${s.id}">${escapeHtml(s.name)}</a>
          <ol>${s.items.map(item => `
            <li><a class="toc-card" href="#${equipmentId(s, item)}">${escapeHtml(item.name || '')}</a></li>`).join('')}
          </ol>
        </li>`).join('')}
    </ol>`;
}

async function initEquipment() {
  const root = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  renderNav('equipment');
  try {
    const e = await loadEquipment();
    sidebar.innerHTML = renderEquipmentSidebar(e);
    root.innerHTML = `
      <section class="domains-intro">
        <p class="eyebrow">Mechanics</p>
        <h1>${escapeHtml(e.name)}</h1>
        ${e.summary ? `<p class="lede">${escapeHtml(e.summary)}</p>` : ''}
        ${e.rules.length ? `<div class="prose"><ul>${e.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
      </section>

      ${e.sections.filter(s => s.items.length).map(s => `
        <section class="domain-section" id="${s.id}">
          <header class="domain-head">
            <p class="eyebrow">${s.items.length} ${s.items.length === 1 ? 'entry' : 'entries'}</p>
            <h2>${escapeHtml(s.name)}</h2>
            ${s.rules.length ? `<div class="prose"><ul>${s.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}
          </header>
          <div class="cards ailment-cards">${s.items.map(item => renderEquipmentItem(s, item)).join('')}</div>
        </section>`).join('')}

      ${e.open.length ? `
        <details class="class-notes ailment-notes">
          <summary>Open points (${e.open.length})</summary><ul>${e.open.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>
        </details>` : ''}
    `;

    watchSections(sidebar);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (err) {
    showError(root, err);
  }
}

// ---------- Rest page ----------

function renderRestAction(action) {
  const stats = [action.cost != null ? plural(action.cost, 'action') : null].filter(Boolean);
  return `
    <article class="game-card" id="rest-${slug(action.name || 'action')}">
      <header><h4>${escapeHtml(action.name || 'Unnamed')}</h4></header>
      <div class="card-stats">${stats.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      <ul class="features">${action.text.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>
      ${action.requires ? `<p class="requires"><span class="eyebrow">Requires</span> ${escapeHtml(action.requires)}</p>` : ''}
    </article>`;
}

async function initRest() {
  const root = document.getElementById('content');
  renderNav('rest');
  try {
    const r = await loadRest();
    root.innerHTML = `
      <section>
        <p class="eyebrow">Mechanics</p>
        <h1>${escapeHtml(r.name)}</h1>
        ${r.summary ? `<p class="lede">${escapeHtml(r.summary)}</p>` : ''}
        <div class="class-stats">${r.rests.map(x => `
          <span class="stat"><span class="stat-value">${escapeHtml(x.actions)}</span><span class="eyebrow">${escapeHtml(x.name)} · actions</span></span>`).join('')}
        </div>
      </section>

      ${r.rules.length ? `
        <h2>Rules</h2>
        <div class="prose"><ul>${r.rules.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}

      <h2>Rest actions</h2>
      <div class="cards">${r.actions.map(renderRestAction).join('')}</div>

      ${r.notes.length || r.open.length ? `
        <details class="class-notes ailment-notes">
          <summary>Notes &amp; open points</summary>
          ${r.notes.length ? `<p class="eyebrow">Notes</p><ul>${r.notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
          ${r.open.length ? `<p class="eyebrow">Open</p><ul>${r.open.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
        </details>` : ''}
    `;
  } catch (err) {
    showError(root, err);
  }
}

function renderAilmentSidebar(ailments) {
  return `
    <p class="eyebrow">Contents</p>
    <ol class="toc">
      <li><a class="toc-domain" href="#rules">Rules</a></li>
      ${ailments.tables.map(t => `
        <li style="--domain:${t.color}">
          <a class="toc-domain" href="#${t.id}" data-section="${t.id}">${escapeHtml(t.name)}</a>
          <ol>${t.entries.map(e => `
            <li><a class="toc-card" href="#${ailmentId(t, e)}">${escapeHtml(e.roll ?? '')}. ${escapeHtml(e.name || '')}</a></li>`).join('')}
          </ol>
        </li>`).join('')}
    </ol>`;
}

async function initAilments() {
  const root = document.getElementById('content');
  const sidebar = document.getElementById('sidebar');
  renderNav('ailments');
  try {
    const a = await loadAilments();
    const notes = a.notes;

    sidebar.innerHTML = renderAilmentSidebar(a);
    root.innerHTML = `
      <section class="domains-intro" id="rules">
        <p class="eyebrow">Mechanics</p>
        <h1>${escapeHtml(a.name)}</h1>
        ${a.summary ? `<p class="lede">${escapeHtml(a.summary)}</p>` : ''}

        <ul class="domain-list">
          ${a.tables.map(t => `
            <li style="--domain:${t.color}">
              <a href="#${t.id}">${escapeHtml(t.name)}</a>
              <span>${escapeHtml(t.trigger)}</span>
              <span class="eyebrow">${plural(t.entries.length, 'ailment')}</span>
            </li>`).join('')}
        </ul>

        ${a.rules.length ? `
          <h3 class="level-head">Resolving an ailment</h3>
          <div class="prose"><ul>${a.rules.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>` : ''}

        ${a.treatment ? `
          <div class="rule-box">
            <p class="eyebrow">Rest action</p>
            <h4>${escapeHtml(a.treatment.name)}</h4>
            <ul class="features">${a.treatment.text.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>
          </div>` : ''}
      </section>

      ${a.tables.map(renderAilmentSection).join('')}

      ${notes.length || a.open.length ? `
        <details class="class-notes ailment-notes">
          <summary>Notes &amp; open points</summary>
          ${notes.length ? `<p class="eyebrow">Notes</p><ul>${notes.map(n => `<li>${escapeHtml(n)}</li>`).join('')}</ul>` : ''}
          ${a.open.length ? `<p class="eyebrow">Open</p><ul>${a.open.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
        </details>` : ''}
    `;

    watchSections(sidebar);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (err) {
    showError(root, err);
  }
}

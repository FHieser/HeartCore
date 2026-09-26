// HeartCore site: data loading + rendering.
// All game data is fetched at runtime from Baseline.md and data/**/*.yaml,
// so editing those files is enough to update the site.
// The loaders (load*) are kept independent of the DOM so a future
// character builder can reuse them.

// The webapp lives in webapp/; the game content sits one level up.
const DATA_ROOT = '../';

const DOMAIN_COLORS = {
  body: '#d0453a',
  mind: '#9a6bdc',
  tech: '#3ba7c4',
  aid: '#4fae6a',
  found: '#c9a13b',
};
const FALLBACK_COLORS = ['#d07f3a', '#c24f8f', '#7c8fd6', '#8fae3b'];

const FOUND = {
  id: 'found',
  name: 'Found',
  covers: 'Items, artifacts, abilities and curses picked up during play. Independent of character level; may take more than one slot.',
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

// Cards of one domain (data/domains/<id>.yaml) or the found cards
// (data/found/found.yaml). Missing file → empty list.
async function loadCards(id) {
  const file = id === FOUND.id ? 'data/found/found.yaml' : `data/domains/${id}.yaml`;
  let text;
  try {
    text = await fetchText(DATA_ROOT + file);
  } catch {
    return [];
  }
  const data = jsyaml.load(text);
  return Array.isArray(data) ? data : [];
}

function domainColor(id, index = 0) {
  return DOMAIN_COLORS[id] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

// ---------- Shared chrome ----------

function renderNav(current) {
  const nav = document.querySelector('.site-nav');
  if (!nav) return;
  nav.innerHTML = [['overview', 'index.html', 'Overview'], ['domains', 'domains.html', 'Domains'], ['classes', 'classes.html', 'Classes']]
    .map(([id, href, label]) => `<a href="${href}" class="${id === current ? 'current' : ''}">${label}</a>`)
    .join('');
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

async function initOverview() {
  const root = document.getElementById('content');
  renderNav('overview');
  try {
    const [sections, domains, classes] = await Promise.all([loadBaseline(), loadDomains(), loadClasses()]);
    const all = [...domains, FOUND];
    const cardLists = await Promise.all(all.map(d => loadCards(d.id)));
    const total = cardLists.reduce((n, l) => n + l.length, 0);
    const byId = Object.fromEntries(domains.map((d, i) => [d.id, i]));

    const intro = sections._intro
      .split('\n')
      .filter(l => l.trim() && !/^(#|>|\*A )/.test(l.trim()))
      .join('\n');

    const classCards = classes.map(c => `
      <div class="class-card">
        <a class="class-name" href="classes.html#${c.id}">${escapeHtml(c.name)}</a>
        <span class="class-domains">${domainTags(c.domains, domains)}</span>
        ${c.fantasy ? `<span class="class-line">${escapeHtml(c.fantasy)}</span>` : ''}
        <ul class="class-features">
          ${FEATURE_KINDS.map(([kind, , short]) => `
            <li><span>${short}</span> ${escapeHtml(c.features[kind].name || '(unnamed)')}</li>`).join('')}
        </ul>
      </div>`).join('');

    root.innerHTML = `
      <section>
        <p class="eyebrow">A Daggerheart horror variant</p>
        <h1>HeartCore</h1>
        <div class="lede prose">${renderProse(intro)}</div>
      </section>

      ${sections['Design Pillars'] ? `
        <h2>Design Pillars</h2>
        <div class="prose">${renderProse(sections['Design Pillars'])}</div>` : ''}

      <h2>Domains</h2>
      <a class="link-field" href="domains.html">
        <span class="link-field-title">All domains &amp; cards →</span>
        <span class="link-field-domains">
          ${all.map((d, i) => `<span style="--domain:${domainColor(d.id, i)}">${escapeHtml(d.name)}</span>`).join('')}
        </span>
        <span class="eyebrow">${plural(total, 'card')}</span>
      </a>

      <h2>Classes</h2>
      <div class="grid">${classCards}</div>
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

// Highlight costs and frequencies in card text. Input must be escaped.
function highlightRules(s) {
  return s.replace(
    /\b((?:Mark|Spend|Clear|Gain) \d+ (?:Stress|Hope|HP|Armor Slots?|Fear)|Once per (?:long rest|short rest|rest|scene|session)|\d+ uses? per (?:long rest|short rest|rest|scene)|Passive|One-shot)\b/g,
    '<span class="kw">$1</span>'
  );
}

const cardId = (domainId, card) => `${domainId}-${slug(card.name || 'unnamed')}`;
const groupId = (domainId, label) => `${domainId}-${slug(label)}`;

function renderCard(card, domainId) {
  const src = card.source || {};
  const slots = card.slots ?? 1;
  const stats = [
    card.type,
    src.kind === 'domain' && src.level != null ? `Level ${src.level}` : null,
    plural(slots, 'slot'),
    card.recall != null ? `Recall ${card.recall}` : null,
  ].filter(v => v != null);
  const text = Array.isArray(card.text) ? card.text : card.text ? [card.text] : [];
  return `
    <article class="game-card" id="${cardId(domainId, card)}">
      <header><h4>${escapeHtml(card.name || 'Unnamed')}</h4></header>
      <div class="card-stats">${stats.map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}</div>
      <ul class="features">${text.map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('')}</ul>
      ${card.flavor ? `<p class="flavor">“${escapeHtml(card.flavor)}”</p>` : ''}
    </article>`;
}

// Domain cards grouped by level; found cards grouped by type.
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

function renderDomainSection({ domain, groups, color }, classes) {
  const users = classes.filter(c => c.domains.includes(domain.id));
  const count = groups.reduce((n, [, list]) => n + list.length, 0);
  const body = groups.map(([label, list]) => `
    <h3 class="level-head" id="${groupId(domain.id, label)}">${escapeHtml(label)}<span class="eyebrow">${plural(list.length, 'card')}</span></h3>
    <div class="cards">${list.map(c => renderCard(c, domain.id)).join('')}</div>`).join('');
  return `
    <section class="domain-section" id="${domain.id}" style="--domain:${color}">
      <header class="domain-head">
        <p class="eyebrow">${domain.id === FOUND.id ? 'Found cards' : 'Domain'} · ${plural(count, 'card')}</p>
        <h2>${escapeHtml(domain.name)}</h2>
        <p class="lede">${escapeHtml(domain.covers)}</p>
        ${users.length ? `<div class="domain-classes"><span class="eyebrow">Classes</span>
          ${users.map(c => `<a class="tag" href="classes.html#${c.id}">${escapeHtml(c.name)}</a>`).join('')}</div>` : ''}
      </header>
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
    const [domains, classes] = await Promise.all([loadDomains(), loadClasses()]);
    const all = [...domains, FOUND];
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
      ${entries.map(e => renderDomainSection(e, classes)).join('')}
    `;

    watchSections(sidebar);
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  } catch (err) {
    showError(root, err);
  }
}

// ---------- Classes page ----------

const featureId = (cls, kind) => `${cls.id}-${kind}`;

function renderFeature(cls, [kind, label]) {
  const f = cls.features[kind];
  const stats = [label, f.cost != null ? `${f.cost} Hope` : null].filter(Boolean);
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
      </header>
      <div class="cards class-cards">${FEATURE_KINDS.map(k => renderFeature(cls, k)).join('')}</div>
      ${cls.loop || cls.open.length ? `
        <div class="class-notes">
          ${cls.loop ? `<p><span class="eyebrow">Loop</span> ${escapeHtml(cls.loop)}</p>` : ''}
          ${cls.open.length ? `<p class="eyebrow">Open</p>
            <ul>${cls.open.map(o => `<li>${escapeHtml(o)}</li>`).join('')}</ul>` : ''}
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

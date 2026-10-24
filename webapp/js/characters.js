// HeartCore character creator. Characters are stored only in this browser (localStorage).
// Depends on app.js for data loaders and helpers (loadClasses, loadCards, escapeHtml, …).

const CHAR_STORE = 'heartcore.characters';
const CODE_PREFIX = 'HC1:';
const TRAITS = ['Agility', 'Strength', 'Finesse', 'Instinct', 'Presence', 'Knowledge'];
const TRAIT_ARRAY = [2, 1, 1, 0, 0, -1];
const MAX_LEVEL = 4;
const LOADOUT_SLOTS = 5;
const MAX_HOPE = 4;
const START_HOPE = 2;
const MAX_SCRAP = 5;
const TRACK_CAP = 12;

// Level-up advancements (levels 2–4 = Daggerheart tier 2, minus the removed domain card,
// Proficiency, subclass and multiclass options). max = how often it can be taken in total.
const ADVANCEMENTS = [
  { id: 'traits', label: '+1 to two unmarked traits', max: 3 },
  { id: 'hp', label: '+1 HP slot', max: 2 },
  { id: 'stress', label: '+1 Stress slot', max: 2 },
  { id: 'experiences', label: '+1 to two Experiences', max: 1 },
  { id: 'evasion', label: '+1 Evasion', max: 1 },
];

const charState = { data: null, chars: [], currentId: null, levelUp: null, exportCode: null, notice: '' };

// ---------- Storage ----------

function readChars() {
  try {
    const list = JSON.parse(localStorage.getItem(CHAR_STORE));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeChars() {
  try {
    localStorage.setItem(CHAR_STORE, JSON.stringify(charState.chars));
    return true;
  } catch {
    charState.notice = 'Could not save: this browser blocks local storage.';
    return false;
  }
}

const currentChar = () => charState.chars.find(c => c.id === charState.currentId) || null;

function newCharacter() {
  return {
    id: (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()),
    name: 'New character',
    classId: '',
    level: 1,
    traits: Object.fromEntries(TRAITS.map(t => [t, null])),
    traitBonus: {},
    experiences: [{ name: '', value: 2 }, { name: '', value: 2 }],
    marked: { hp: 0, stress: 0, armor: 0 },
    hope: START_HOPE,
    scars: 0,
    bonus: { hp: 0, stress: 0, evasion: 0 },
    advancements: [],
    cards: [],
    armor: 'Street clothes',
    shield: { name: '', feature: '', broken: false },
    weapons: [],
    consumables: [],
    ailments: [],
    scrap: 0,
    notes: '',
    history: [],
  };
}

// Fill in fields missing from older or imported characters.
function normalizeChar(c) {
  const base = newCharacter();
  const out = { ...base, ...c };
  for (const key of ['traits', 'marked', 'bonus', 'shield']) out[key] = { ...base[key], ...(c[key] || {}) };
  for (const key of ['experiences', 'advancements', 'cards', 'weapons', 'consumables', 'ailments', 'history']) {
    out[key] = Array.isArray(c[key]) ? c[key] : base[key];
  }
  out.traitBonus = c.traitBonus || {};
  return out;
}

// ---------- Data lookups ----------

async function loadCharacterData() {
  const [classes, domains, hcore, equipment, ailments] = await Promise.all([
    loadClasses(), loadDomains(), loadHcore(), loadEquipment(), loadAilments(),
  ]);
  const domainCards = await Promise.all(domains.map(async d => (await loadCards(d.id)).map(card => ({ ...card, owner: d.id }))));
  const cards = [...domainCards.flat(), ...hcore.cards.map(card => ({ ...card, owner: HCORE.id }))];
  return { classes, domains, hcore, equipment, ailments, cards };
}

const cardKey = card => `${card.owner}:${card.name}`;
const findCard = key => charState.data.cards.find(c => cardKey(c) === key);
const equipList = id => charState.data.equipment.sections.find(s => s.id === id)?.items || [];
const findClass = id => charState.data.classes.find(c => c.id === id);
const domainName = id => charState.data.domains.find(d => d.id === id)?.name || (id === HCORE.id ? 'HCore' : id);

// "+2 Evasion", "−1 Evasion, −1 Agility" → 2, -1
function evasionMod(effect) {
  const m = String(effect || '').replace(/−/g, '-').match(/([+-]\d+)\s*Evasion/);
  return m ? Number(m[1]) : 0;
}

function derive(c) {
  const cls = findClass(c.classId);
  const stats = cls?.stats || {};
  const armorList = equipList('armor');
  const armor = armorList.find(a => a.name === c.armor) || armorList[0] || {};
  const shield = c.shield.name ? equipList('shields').find(s => s.name === c.shield.name) : null;
  const shieldActive = !!shield && !c.shield.broken;

  let evasion = (stats.evasion ?? 0) + evasionMod(armor.effect) + c.bonus.evasion;
  if (shieldActive && c.shield.feature !== 'Lightweight') evasion += evasionMod(shield.effect);
  const armorScore = (armor.score || 0) + (shieldActive ? (shield.score || 0) + (c.shield.feature === 'Reinforced' ? 1 : 0) : 0);
  const [major, severe] = armor.thresholds || [0, 0];

  const ownedCards = c.cards.map(entry => ({ entry, card: findCard(entry.key) })).filter(x => x.card);
  const slotsUsed = ownedCards.filter(x => !x.entry.vaulted).reduce((n, x) => n + (x.card.slots ?? 1), 0);
  const loadoutMax = LOADOUT_SLOTS - (c.ailments.some(a => a.name === 'Concussion') ? 1 : 0);
  const domainCardCount = ownedCards.filter(x => x.card.source?.kind === 'domain').length;

  return {
    cls,
    armor,
    shield,
    evasion,
    armorScore,
    major: major + c.level,
    severe: severe + c.level,
    hpMax: Math.min(TRACK_CAP, (stats.hp || 0) + c.bonus.hp),
    stressMax: Math.min(TRACK_CAP, (stats.stress || 0) + c.bonus.stress),
    hopeMax: Math.max(0, MAX_HOPE - c.scars),
    ownedCards,
    slotsUsed,
    loadoutMax,
    domainCardCount,
    expectedDomainCards: 1 + c.level,
    traitValue: t => (c.traits[t] ?? 0) + (c.traitBonus[t] || 0),
  };
}

function traitArrayProblem(c) {
  const values = TRAITS.map(t => c.traits[t]);
  if (values.some(v => v == null)) return 'Assign all six traits.';
  const a = [...values].sort((x, y) => y - x).join(',');
  const b = [...TRAIT_ARRAY].sort((x, y) => y - x).join(',');
  return a === b ? '' : 'Traits must use the array +2, +1, +1, +0, +0, −1.';
}

// ---------- Small render helpers ----------

const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '+0');
const opt = (value, label, selected) => `<option value="${escapeHtml(value)}"${selected ? ' selected' : ''}>${escapeHtml(label)}</option>`;
const lines = text => asList(text).map(t => `<li>${highlightRules(escapeHtml(t))}</li>`).join('');

function track(name, max, marked, { scars = 0 } = {}) {
  const boxes = [];
  for (let i = 0; i < max + scars; i++) {
    if (i >= max) boxes.push('<span class="box scar" title="Scar: Hope slot crossed out"></span>');
    else boxes.push(`<button class="box${i < marked ? ' on' : ''}" data-act="box" data-track="${name}" data-i="${i}" aria-label="${name} ${i + 1}"></button>`);
  }
  return `<div class="track">${boxes.join('') || '<span class="eyebrow">none</span>'}</div>`;
}

function featureBlock(label, f) {
  if (!f || (!f.name && !f.text?.length)) return '';
  return `
    <div class="mini-card" style="--domain:var(--accent)">
      <div><span class="eyebrow">${escapeHtml(label)}</span> <strong>${escapeHtml(f.name || 'Unnamed')}</strong>${f.cost != null ? ` <span class="tag">${f.cost} Hope</span>` : ''}</div>
      <ul class="features">${lines(f.text)}</ul>
      ${f.options?.length ? `<ul class="options">${f.options.map(o => typeof o === 'string' ? `<li>${escapeHtml(o)}</li>` : `<li><strong>${escapeHtml(o.name || '')}</strong> ${highlightRules(escapeHtml(o.text || ''))}</li>`).join('')}</ul>` : ''}
    </div>`;
}

// ---------- Sheet sections ----------

function renderHeader(c, d) {
  const classes = charState.data.classes;
  return `
    <section class="sheet-head">
      <p class="eyebrow">Character · Level ${c.level}${d.cls ? ` · ${escapeHtml(d.cls.name)}` : ''}</p>
      <input class="name-input" data-field="name" value="${escapeHtml(c.name)}" aria-label="Character name">
      <div class="field-row no-print-select">
        <span class="eyebrow">Class</span>
        <select class="field" data-field="classId" ${c.level > 1 ? 'disabled' : ''}>
          ${opt('', 'Choose a class…', !c.classId)}
          ${classes.map(cls => opt(cls.id, `${cls.name} (${cls.domains.map(domainName).join(' + ')})`, cls.id === c.classId)).join('')}
        </select>
      </div>
      <div class="btn-row no-print">
        <button class="btn primary" data-act="level-up" ${c.level >= MAX_LEVEL || !c.classId ? 'disabled' : ''}>Level up</button>
        <button class="btn" data-act="undo-level" ${c.history.length ? '' : 'disabled'}>Undo level-up</button>
        <button class="btn" data-act="export-code">Export code</button>
        <button class="btn" data-act="export-pdf">Export PDF</button>
        <button class="btn danger" data-act="delete">Delete</button>
      </div>
      ${charState.exportCode ? `
        <div class="panel no-print">
          <span class="eyebrow">Export code (copied to clipboard if allowed)</span>
          <textarea class="field code" readonly rows="3">${escapeHtml(charState.exportCode)}</textarea>
          <div><button class="btn" data-act="close-export">Close</button></div>
        </div>` : ''}
    </section>`;
}

function renderCore(c, d) {
  return `
    <div class="sheet-grid">
      <div class="panel">
        <h3>Defense</h3>
        <div class="class-stats">
          <span class="stat"><span class="stat-value">${d.evasion}</span><span class="eyebrow">Evasion</span></span>
          <span class="stat"><span class="stat-value">${d.armorScore}</span><span class="eyebrow">Armor Score</span></span>
        </div>
        <p class="thresholds"><span class="eyebrow">Damage</span> Minor &lt; ${d.major} ≤ Major &lt; ${d.severe} ≤ Severe</p>
        <span class="eyebrow">Armor Slots</span>
        ${track('armor', d.armorScore, Math.min(c.marked.armor, d.armorScore))}
      </div>
      <div class="panel">
        <h3>Hit Points <span class="eyebrow">${c.marked.hp} / ${d.hpMax} marked</span></h3>
        ${track('hp', d.hpMax, c.marked.hp)}
        <h3>Stress <span class="eyebrow">${c.marked.stress} / ${d.stressMax} marked</span></h3>
        ${track('stress', d.stressMax, c.marked.stress)}
        ${d.stressMax && c.marked.stress >= d.stressMax ? '<p class="warn">Stress maxed: roll on the Stress ailment table.</p>' : ''}
      </div>
      <div class="panel">
        <h3>Hope <span class="eyebrow">${c.hope} / ${d.hopeMax}</span></h3>
        ${track('hope', d.hopeMax, Math.min(c.hope, d.hopeMax), { scars: c.scars })}
        <p class="eyebrow">Scars (Avoid Death): ${c.scars}</p>
        <div class="btn-row no-print">
          <button class="btn" data-act="scar-add" ${c.scars >= MAX_HOPE ? 'disabled' : ''}>Avoid Death: add scar</button>
          <button class="btn" data-act="scar-remove" ${c.scars ? '' : 'disabled'}>Remove scar</button>
        </div>
        ${d.hopeMax === 0 ? '<p class="warn">Last Hope slot crossed out: the character\'s journey ends.</p>' : ''}
        ${d.cls?.id === 'mechanic' ? `<h3>Scrap <span class="eyebrow">${c.scrap} / ${MAX_SCRAP}</span></h3>${track('scrap', MAX_SCRAP, c.scrap)}` : ''}
      </div>
    </div>`;
}

function renderTraits(c, d) {
  const problem = traitArrayProblem(c);
  return `
    <div class="panel">
      <h3>Traits</h3>
      <div class="trait-grid">
        ${TRAITS.map(t => `
          <label class="trait">
            <span class="eyebrow">${t}${c.traitBonus[t] ? ' · +1 (marked)' : ''}</span>
            <span class="trait-value">${c.traits[t] == null ? '–' : signed(d.traitValue(t))}</span>
            <select class="field no-print" data-field="traits.${t}" data-num>
              ${opt('', '–', c.traits[t] == null)}
              ${[2, 1, 0, -1].map(v => opt(v, signed(v), c.traits[t] === v)).join('')}
            </select>
          </label>`).join('')}
      </div>
      ${problem ? `<p class="warn">${problem}</p>` : ''}
    </div>`;
}

function renderExperiences(c) {
  return `
    <div class="panel">
      <h3>Experiences <span class="eyebrow">spend 1 Hope to add the bonus</span></h3>
      ${c.experiences.map((e, i) => `
        <div class="exp-row">
          <input class="field" data-field="experiences.${i}.name" value="${escapeHtml(e.name)}" placeholder="${i === 0 ? 'Job, e.g. Nurse' : i === 1 ? 'Personal, e.g. Amateur Boxer' : 'Experience'}">
          <span class="trait-value">${signed(e.value)}</span>
        </div>`).join('')}
      <p class="eyebrow">Experiences also explain your tools.</p>
    </div>`;
}

function renderClassFeatures(c, d) {
  if (!d.cls) return '<div class="panel"><h3>Class</h3><p class="status">Choose a class to see its features.</p></div>';
  const hope = d.cls.features.hope;
  const cost = hope.cost ?? 3;
  return `
    <div class="panel">
      <h3>${escapeHtml(d.cls.name)} features</h3>
      ${featureBlock('Main', d.cls.features.main)}
      ${featureBlock('Flair', d.cls.features.flair)}
      ${featureBlock('Hope feature', hope)}
      <div class="no-print"><button class="btn" data-act="use-hope-feature" ${c.hope >= cost ? '' : 'disabled'}>Use Hope feature (−${cost} Hope)</button></div>
    </div>`;
}

function renderCards(c, d) {
  const domains = d.cls ? d.cls.domains : [];
  const addable = charState.data.cards
    .filter(card => card.source?.kind === 'domain' && domains.includes(card.owner) && (card.source.level ?? 1) <= c.level)
    .filter(card => !c.cards.some(e => e.key === cardKey(card)));
  const hcoreAddable = charState.data.cards.filter(card => card.owner === HCORE.id && !c.cards.some(e => e.key === cardKey(card)));
  const over = d.slotsUsed > d.loadoutMax;
  return `
    <div class="panel wide">
      <h3>Cards <span class="eyebrow">Loadout ${d.slotsUsed} / ${d.loadoutMax} slots · Domain cards ${d.domainCardCount} / ${d.expectedDomainCards}</span></h3>
      ${over ? '<p class="warn">Loadout is over its limit: pack a card into the vault.</p>' : ''}
      <div class="mini-cards">
        ${d.ownedCards.map(({ entry, card }) => {
          const i = c.cards.indexOf(entry);
          const isCurse = card.type === 'curse';
          return `
            <div class="mini-card${entry.vaulted ? ' vaulted' : ''}" style="--domain:${domainColor(card.owner)}">
              <div><strong>${escapeHtml(card.name)}</strong>
                <span class="tag">${escapeHtml(card.owner === HCORE.id ? card.type : domainName(card.owner))}</span>
                ${card.source?.level != null ? `<span class="tag">Level ${card.source.level}</span>` : ''}
                <span class="tag">${plural(card.slots ?? 1, 'slot')}</span>
                <span class="tag">Recall ${card.recall ?? 0}</span>
                ${entry.vaulted ? '<span class="tag">Vault</span>' : ''}
              </div>
              <ul class="features">${lines(card.text)}</ul>
              <div class="btn-row no-print">
                ${isCurse ? '' : `<button class="btn" data-act="card-vault" data-i="${i}">${entry.vaulted ? 'Recall' : 'To vault'}</button>`}
                <button class="btn" data-act="card-remove" data-i="${i}">Remove</button>
              </div>
            </div>`;
        }).join('') || '<p class="status">No cards yet.</p>'}
      </div>
      <div class="add-row no-print">
        <select class="field" data-pick="card">
          ${opt('', d.cls ? 'Add a domain card…' : 'Choose a class first', true)}
          ${addable.map(card => opt(cardKey(card), `${domainName(card.owner)} · L${card.source.level} · ${card.name}`, false)).join('')}
        </select>
        <button class="btn" data-act="card-add" data-from="card">Add</button>
      </div>
      <div class="add-row no-print">
        <select class="field" data-pick="hcore">
          ${opt('', 'Add an HCore card (from the GM)…', true)}
          ${hcoreAddable.map(card => opt(cardKey(card), `${card.type} · ${card.name}`, false)).join('')}
        </select>
        <button class="btn" data-act="card-add" data-from="hcore">Add</button>
      </div>
    </div>`;
}

function renderWeapon(w, i) {
  const cat = equipList('weapons').find(x => x.name === w.category);
  const featureCount = cat?.name === 'Blade' ? 2 : 1;
  const features = asList(cat?.features);
  const stats = cat ? [cat.trait, cat.range, cat.damage, cat.burden].filter(Boolean).join(' · ') : '';
  const chosen = [...features.filter(f => w.features.includes(f.name)), ...asList(cat?.utility_features).filter(f => f.name === w.utility)];
  return `
    <div class="mini-card" style="--domain:#9a9a9a">
      <div class="exp-row">
        <input class="field" data-field="weapons.${i}.name" value="${escapeHtml(w.name)}" placeholder="Name, e.g. Grandpa's revolver">
        <button class="btn no-print" data-act="weapon-remove" data-i="${i}">Remove</button>
      </div>
      <select class="field no-print" data-field="weapons.${i}.category">
        ${equipList('weapons').map(x => opt(x.name, `${x.name} (Tier ${x.tier})`, x.name === w.category)).join('')}
      </select>
      ${stats ? `<p class="eyebrow">${escapeHtml(w.category)} · ${escapeHtml(stats)}</p>` : ''}
      ${cat?.built_in ? `<p class="requires">${escapeHtml(cat.built_in)}</p>` : ''}
      ${cat?.utility_features ? `
        <select class="field no-print" data-field="weapons.${i}.utility">
          ${opt('', 'Utility feature…', !w.utility)}
          ${cat.utility_features.map(f => opt(f.name, f.name, f.name === w.utility)).join('')}
        </select>` : ''}
      ${Array.from({ length: featureCount }, (_, j) => `
        <select class="field no-print" data-field="weapons.${i}.features.${j}">
          ${opt('', cat?.utility_features ? 'Combat feature…' : 'Feature…', !w.features[j])}
          ${features.map(f => opt(f.name, f.name, f.name === w.features[j])).join('')}
        </select>`).join('')}
      ${chosen.length ? `<ul class="options">${chosen.map(f => `<li><strong>${escapeHtml(f.name)}</strong> ${highlightRules(escapeHtml(f.text || ''))}</li>`).join('')}</ul>` : ''}
    </div>`;
}

function renderEquipment(c, d) {
  const shields = equipList('shields');
  const shieldFeatures = asList(d.shield?.features);
  return `
    <div class="panel wide">
      <h3>Equipment</h3>
      <div class="field-row">
        <span class="eyebrow">Armor</span>
        <select class="field" data-field="armor">
          ${equipList('armor').map(a => opt(a.name, `${a.name} (${a.thresholds?.join('/')}, Score ${a.score}${a.effect ? `, ${a.effect}` : ''})`, a.name === c.armor)).join('')}
        </select>
      </div>
      <div class="field-row">
        <span class="eyebrow">Shield</span>
        <select class="field" data-field="shield.name">
          ${opt('', 'No shield', !c.shield.name)}
          ${shields.map(s => opt(s.name, `${s.name} (+${s.score} Armor Score${s.effect ? `, ${s.effect}` : ''})`, s.name === c.shield.name)).join('')}
        </select>
      </div>
      ${d.shield ? `
        <div class="field-row">
          <span class="eyebrow">Shield feature</span>
          <select class="field" data-field="shield.feature">
            ${opt('', 'Choose…', !c.shield.feature)}
            ${shieldFeatures.map(f => opt(f.name, `${f.name}: ${f.text}`, f.name === c.shield.feature)).join('')}
          </select>
        </div>
        <label class="check no-print"><input type="checkbox" data-field="shield.broken" ${c.shield.broken ? 'checked' : ''}> Shield broken (Severe hit)</label>
        ${c.shield.broken ? '<p class="warn">Shield broken: its Armor Score no longer counts.</p>' : ''}` : ''}

      <h3>Weapons</h3>
      <div class="mini-cards">${c.weapons.map(renderWeapon).join('') || '<p class="status">No weapons.</p>'}</div>
      <div class="no-print"><button class="btn" data-act="weapon-add">Add weapon</button></div>

      <h3>Consumables <span class="eyebrow">single use</span></h3>
      <ul class="plain-list">
        ${c.consumables.map((name, i) => {
          const item = equipList('consumables').find(x => x.name === name);
          return `<li><strong>${escapeHtml(name)}</strong> ${item ? `<span class="muted">${highlightRules(escapeHtml(item.text.join(' ')))}</span>` : ''}
            <button class="btn no-print" data-act="consumable-remove" data-i="${i}">Use / remove</button></li>`;
        }).join('') || '<li class="status">None.</li>'}
      </ul>
      <div class="add-row no-print">
        <select class="field" data-pick="consumable">
          ${opt('', 'Add a consumable…', true)}
          ${equipList('consumables').map(x => opt(x.name, `${x.name} (Tier ${x.tier}, rarity ${x.rarity})`, false)).join('')}
        </select>
        <button class="btn" data-act="consumable-add">Add</button>
      </div>
    </div>`;
}

function renderAilments(c) {
  const tables = charState.data.ailments.tables;
  return `
    <div class="panel wide">
      <h3>Ailments</h3>
      <ul class="plain-list">
        ${c.ailments.map((a, i) => {
          const table = tables.find(t => t.id === a.table);
          const entry = table?.entries.find(e => e.name === a.name);
          return `<li style="--domain:${table?.color || 'var(--accent)'}"><strong class="ailment-name">${escapeHtml(a.name)}</strong>
            ${entry ? `<span class="tag">${escapeHtml(LASTS_LABELS[entry.lasts] || entry.lasts || '')}</span> <span class="muted">${highlightRules(escapeHtml(entry.text.join(' ')))}</span>` : ''}
            <button class="btn no-print" data-act="ailment-remove" data-i="${i}">Remove</button></li>`;
        }).join('') || '<li class="status">None.</li>'}
      </ul>
      <div class="add-row no-print">
        <select class="field" data-pick="ailment">
          ${opt('', 'Add an ailment…', true)}
          ${tables.map(t => `<optgroup label="${escapeHtml(t.name)}">${t.entries.map(e => opt(`${t.id}:${e.name}`, `${e.roll}. ${e.name}`, false)).join('')}</optgroup>`).join('')}
        </select>
        <button class="btn" data-act="ailment-add">Add</button>
      </div>
    </div>`;
}

function renderNotes(c) {
  return `
    <div class="panel wide">
      <h3>Notes</h3>
      <textarea class="field" rows="4" data-field="notes" placeholder="Background, pronouns, contacts, what happened…">${escapeHtml(c.notes)}</textarea>
      ${c.advancements.length ? `<p class="eyebrow">Advancements</p>
        <ul class="plain-list">${c.advancements.map(a => `<li>Level ${a.level}: ${escapeHtml(a.label)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

// ---------- Level up ----------

function advancementUses(c, id) {
  return c.advancements.filter(a => a.id === id).length;
}

function levelUpProblems(c, lu) {
  const problems = [];
  const newLevel = c.level + 1;
  const d = derive(c);
  const cardOptions = levelUpCardOptions(c, newLevel, d);
  if (cardOptions.length && !lu.card) problems.push('Choose your new domain card.');
  const picked = lu.adv.map(a => a.id);
  if (picked.some(id => !id)) problems.push('Choose two advancements.');
  for (const adv of ADVANCEMENTS) {
    const count = picked.filter(id => id === adv.id).length;
    if (count && advancementUses(c, adv.id) + count > adv.max) problems.push(`"${adv.label}" is used up.`);
  }
  const traitPicks = lu.adv.filter(a => a.id === 'traits').flatMap(a => [a.a, a.b]);
  if (traitPicks.some(t => !t)) problems.push('Choose two traits for each trait advancement.');
  if (new Set(traitPicks).size !== traitPicks.length) problems.push('Each trait can only be raised once.');
  if (traitPicks.some(t => c.traitBonus[t])) problems.push('Marked traits can\'t be raised again.');
  for (const a of lu.adv.filter(x => x.id === 'experiences')) {
    if (a.a === '' || a.b === '' || a.a === a.b) problems.push('Choose two different Experiences.');
  }
  if (newLevel === 2 && !lu.newExp.trim()) problems.push('Name your new Experience (level 2).');
  return problems;
}

function levelUpCardOptions(c, newLevel, d) {
  const domains = d.cls ? d.cls.domains : [];
  return charState.data.cards.filter(card => card.source?.kind === 'domain' && domains.includes(card.owner)
    && (card.source.level ?? 1) <= newLevel && !c.cards.some(e => e.key === cardKey(card)));
}

function renderLevelUp(c) {
  const lu = charState.levelUp;
  if (!lu) return '';
  const newLevel = c.level + 1;
  const d = derive(c);
  const cardOptions = levelUpCardOptions(c, newLevel, d);
  const problems = levelUpProblems(c, lu);
  const traitOpts = sel => TRAITS.map(t => opt(t, `${t}${c.traitBonus[t] ? ' (marked)' : ''}`, t === sel)).join('');
  const expOpts = sel => c.experiences.map((e, i) => opt(i, e.name || `Experience ${i + 1}`, String(i) === String(sel))).join('');
  return `
    <div class="panel level-up no-print">
      <h3>Level up to ${newLevel}</h3>
      <p class="eyebrow">Damage thresholds rise by 1 automatically.</p>
      <div class="field-row">
        <span class="eyebrow">New domain card</span>
        <select class="field" data-lu="card">
          ${opt('', cardOptions.length ? 'Choose…' : 'No cards available', !lu.card)}
          ${cardOptions.map(card => opt(cardKey(card), `${domainName(card.owner)} · L${card.source.level} · ${card.name}`, cardKey(card) === lu.card)).join('')}
        </select>
      </div>
      ${lu.adv.map((a, k) => `
        <div class="field-row">
          <span class="eyebrow">Advancement ${k + 1}</span>
          <select class="field" data-lu="adv.${k}.id">
            ${opt('', 'Choose…', !a.id)}
            ${ADVANCEMENTS.map(adv => opt(adv.id, `${adv.label} (${adv.max - advancementUses(c, adv.id)} left)`, adv.id === a.id)).join('')}
          </select>
        </div>
        ${a.id === 'traits' ? `<div class="field-row"><span></span><div class="pair">
          <select class="field" data-lu="adv.${k}.a">${opt('', 'Trait…', !a.a)}${traitOpts(a.a)}</select>
          <select class="field" data-lu="adv.${k}.b">${opt('', 'Trait…', !a.b)}${traitOpts(a.b)}</select></div></div>` : ''}
        ${a.id === 'experiences' ? `<div class="field-row"><span></span><div class="pair">
          <select class="field" data-lu="adv.${k}.a">${opt('', 'Experience…', a.a === '')}${expOpts(a.a)}</select>
          <select class="field" data-lu="adv.${k}.b">${opt('', 'Experience…', a.b === '')}${expOpts(a.b)}</select></div></div>` : ''}`).join('')}
      ${newLevel === 2 ? `
        <div class="field-row">
          <span class="eyebrow">New Experience (+2)</span>
          <input class="field" data-lu="newExp" value="${escapeHtml(lu.newExp)}" placeholder="e.g. Survived Sector 7">
        </div>` : ''}
      ${problems.length ? `<ul class="plain-list warn">${problems.map(p => `<li>${escapeHtml(p)}</li>`).join('')}</ul>` : ''}
      <div class="btn-row">
        <button class="btn primary" data-act="lu-confirm">Confirm level ${newLevel}</button>
        <button class="btn" data-act="lu-cancel">Cancel</button>
      </div>
    </div>`;
}

function applyLevelUp(c) {
  const lu = charState.levelUp;
  const { history, ...snapshot } = c;
  c.history = [...history, JSON.stringify(snapshot)];
  c.level += 1;
  if (lu.card) c.cards.push({ key: lu.card, vaulted: false });
  for (const a of lu.adv) {
    const adv = ADVANCEMENTS.find(x => x.id === a.id);
    let label = adv.label;
    if (a.id === 'traits') {
      c.traitBonus[a.a] = 1;
      c.traitBonus[a.b] = 1;
      label = `+1 ${a.a}, +1 ${a.b}`;
    } else if (a.id === 'hp') c.bonus.hp += 1;
    else if (a.id === 'stress') c.bonus.stress += 1;
    else if (a.id === 'evasion') c.bonus.evasion += 1;
    else if (a.id === 'experiences') {
      for (const i of [a.a, a.b]) c.experiences[Number(i)].value += 1;
      label = `+1 ${c.experiences[Number(a.a)].name || 'Experience'}, +1 ${c.experiences[Number(a.b)].name || 'Experience'}`;
    }
    c.advancements.push({ level: c.level, id: a.id, label });
  }
  if (c.level === 2) c.experiences.push({ name: lu.newExp.trim(), value: 2 });
  charState.levelUp = null;
}

function undoLevelUp(c) {
  const history = [...c.history];
  const snapshot = JSON.parse(history.pop());
  Object.assign(c, normalizeChar({ ...snapshot, id: c.id, history }));
}

// ---------- Export / import ----------

function exportCode(c) {
  const { history, ...rest } = c;
  const json = JSON.stringify(rest);
  return CODE_PREFIX + btoa(unescape(encodeURIComponent(json)));
}

function importCode(code) {
  const trimmed = String(code || '').trim();
  if (!trimmed.startsWith(CODE_PREFIX)) throw new Error('Not a HeartCore character code.');
  const json = decodeURIComponent(escape(atob(trimmed.slice(CODE_PREFIX.length))));
  const c = normalizeChar(JSON.parse(json));
  c.id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  c.history = [];
  return c;
}

// ---------- Page ----------

function renderCharSidebar() {
  return `
    <p class="eyebrow">Your characters</p>
    <ul class="char-list">
      ${charState.chars.map(c => {
        const cls = findClass(c.classId);
        return `<li><button class="char-entry${c.id === charState.currentId ? ' active' : ''}" data-act="select" data-id="${escapeHtml(c.id)}">
          <span>${escapeHtml(c.name || 'Unnamed')}</span>
          <span class="eyebrow">${cls ? escapeHtml(cls.name) : 'No class'} · Level ${c.level}</span></button></li>`;
      }).join('') || '<li class="status">None yet.</li>'}
    </ul>
    <div class="btn-row">
      <button class="btn primary" data-act="new">New character</button>
      <button class="btn" data-act="import">Import code</button>
    </div>
    <p class="eyebrow saved-note">Saved only in this browser.</p>`;
}

function renderSheet() {
  const c = currentChar();
  if (!c) {
    return `
      <section class="domains-intro">
        <p class="eyebrow">HeartCore</p>
        <h1>Characters</h1>
        <p class="lede">Create a character, track HP, Stress, Hope and Armor during play, and level up to 4. Characters are saved in this browser; export them as a code to move them, or as a PDF to print.</p>
        <div class="btn-row"><button class="btn primary" data-act="new">New character</button><button class="btn" data-act="import">Import code</button></div>
      </section>`;
  }
  const d = derive(c);
  return `
    ${charState.notice ? `<p class="warn">${escapeHtml(charState.notice)}</p>` : ''}
    ${renderHeader(c, d)}
    ${renderLevelUp(c)}
    ${renderCore(c, d)}
    <div class="sheet-grid">
      ${renderTraits(c, d)}
      ${renderExperiences(c)}
    </div>
    <div class="sheet-grid">${renderClassFeatures(c, d)}</div>
    ${renderCards(c, d)}
    ${renderEquipment(c, d)}
    ${renderAilments(c)}
    ${renderNotes(c)}`;
}

function renderCharacters() {
  document.getElementById('sidebar').innerHTML = renderCharSidebar();
  document.getElementById('content').innerHTML = renderSheet();
}

function commit({ rerender = true } = {}) {
  writeChars();
  if (rerender) renderCharacters();
  else document.getElementById('sidebar').innerHTML = renderCharSidebar();
}

// Set a value by dotted path, e.g. "weapons.0.features.1".
function setPath(obj, path, value) {
  const keys = path.split('.');
  let target = obj;
  for (const k of keys.slice(0, -1)) target = target[k];
  target[keys[keys.length - 1]] = value;
}

function readValue(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.dataset.num !== undefined) return el.value === '' ? null : Number(el.value);
  return el.value;
}

function handleClick(e) {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.act;
  const c = currentChar();
  const i = Number(btn.dataset.i);
  charState.notice = '';

  if (act === 'new') {
    const fresh = newCharacter();
    charState.chars.push(fresh);
    charState.currentId = fresh.id;
    charState.levelUp = null;
    charState.exportCode = null;
    return commit();
  }
  if (act === 'select') {
    charState.currentId = btn.dataset.id;
    charState.levelUp = null;
    charState.exportCode = null;
    return renderCharacters();
  }
  if (act === 'import') {
    const code = prompt('Paste a HeartCore character code:');
    if (!code) return;
    try {
      const imported = importCode(code);
      charState.chars.push(imported);
      charState.currentId = imported.id;
    } catch (err) {
      charState.notice = `Import failed: ${err.message}`;
    }
    return commit();
  }
  if (!c) return;

  switch (act) {
    case 'delete':
      if (!confirm(`Delete ${c.name || 'this character'}? This can't be undone.`)) return;
      charState.chars = charState.chars.filter(x => x.id !== c.id);
      charState.currentId = charState.chars[0]?.id || null;
      break;
    case 'export-code':
      charState.exportCode = exportCode(c);
      navigator.clipboard?.writeText(charState.exportCode).catch(() => {});
      return renderCharacters();
    case 'close-export':
      charState.exportCode = null;
      return renderCharacters();
    case 'export-pdf':
      charState.exportCode = null;
      renderCharacters();
      return window.print();
    case 'box': {
      const d = derive(c);
      const name = btn.dataset.track;
      const current = name === 'hope' ? Math.min(c.hope, d.hopeMax) : name === 'scrap' ? c.scrap : c.marked[name];
      const next = current > i ? i : i + 1;
      if (name === 'hope') c.hope = next;
      else if (name === 'scrap') c.scrap = next;
      else c.marked[name] = next;
      break;
    }
    case 'scar-add':
      c.scars += 1;
      c.hope = Math.min(c.hope, MAX_HOPE - c.scars);
      break;
    case 'scar-remove':
      c.scars = Math.max(0, c.scars - 1);
      break;
    case 'use-hope-feature': {
      const cost = derive(c).cls?.features.hope.cost ?? 3;
      c.hope = Math.max(0, c.hope - cost);
      break;
    }
    case 'card-add': {
      const key = document.querySelector(`[data-pick="${btn.dataset.from}"]`)?.value;
      if (!key) return;
      c.cards.push({ key, vaulted: false });
      break;
    }
    case 'card-vault':
      c.cards[i].vaulted = !c.cards[i].vaulted;
      break;
    case 'card-remove':
      c.cards.splice(i, 1);
      break;
    case 'weapon-add':
      c.weapons.push({ category: equipList('weapons')[0]?.name || '', name: '', features: [], utility: '' });
      break;
    case 'weapon-remove':
      c.weapons.splice(i, 1);
      break;
    case 'consumable-add': {
      const name = document.querySelector('[data-pick="consumable"]')?.value;
      if (!name) return;
      c.consumables.push(name);
      break;
    }
    case 'consumable-remove':
      c.consumables.splice(i, 1);
      break;
    case 'ailment-add': {
      const value = document.querySelector('[data-pick="ailment"]')?.value;
      if (!value) return;
      const [table, ...rest] = value.split(':');
      c.ailments.push({ table, name: rest.join(':') });
      break;
    }
    case 'ailment-remove':
      c.ailments.splice(i, 1);
      break;
    case 'level-up':
      charState.levelUp = { card: '', adv: [{ id: '', a: '', b: '' }, { id: '', a: '', b: '' }], newExp: '' };
      return renderCharacters();
    case 'lu-cancel':
      charState.levelUp = null;
      return renderCharacters();
    case 'lu-confirm':
      // Problems are listed in the panel; re-render so the list reflects the latest input.
      if (levelUpProblems(c, charState.levelUp).length) return renderCharacters();
      applyLevelUp(c);
      break;
    case 'undo-level':
      if (!confirm('Undo the last level-up? Changes made since then are lost.')) return;
      undoLevelUp(c);
      break;
    default:
      return;
  }
  commit();
}

function handleChange(e) {
  const el = e.target;
  const c = currentChar();
  if (!c) return;
  // Text fields are saved by handleInput; re-rendering on blur would swallow the next click.
  if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox')) return;
  if (el.dataset.lu !== undefined && charState.levelUp) {
    setPath(charState.levelUp, el.dataset.lu, el.value);
    const m = el.dataset.lu.match(/^adv\.(\d)\.id$/);
    if (m) Object.assign(charState.levelUp.adv[Number(m[1])], { a: '', b: '' });
    return renderCharacters();
  }
  if (el.dataset.field === undefined) return;
  const path = el.dataset.field;
  setPath(c, path, readValue(el));
  if (path === 'shield.name') Object.assign(c.shield, { feature: '', broken: false });
  const m = path.match(/^weapons\.(\d+)\.category$/);
  if (m) Object.assign(c.weapons[Number(m[1])], { features: [], utility: '' });
  commit();
}

// Text fields save while typing without re-rendering (keeps focus).
function handleInput(e) {
  const el = e.target;
  const c = currentChar();
  if (!c) return;
  if (el.dataset.lu === 'newExp' && charState.levelUp) {
    charState.levelUp.newExp = el.value;
    return;
  }
  if (el.dataset.field === undefined || el.tagName === 'SELECT' || el.type === 'checkbox') return;
  setPath(c, el.dataset.field, el.value);
  commit({ rerender: false });
}

async function initCharacters() {
  const root = document.getElementById('content');
  renderNav('characters');
  try {
    charState.data = await loadCharacterData();
    charState.chars = readChars().map(normalizeChar);
    charState.currentId = charState.chars[0]?.id || null;
    const layout = document.querySelector('.layout');
    layout.addEventListener('click', handleClick);
    layout.addEventListener('change', handleChange);
    layout.addEventListener('input', handleInput);
    renderCharacters();
  } catch (err) {
    showError(root, err);
  }
}

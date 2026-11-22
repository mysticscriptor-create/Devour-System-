// ─────────────────────────────────────────────────────────────
// MARC PROWESS ENGINE v1.0
// DataviewJS — Obsidian Mobile
// Devour HUD exclusive. Generates Marc-specific stat descriptions
// via AI using prowess_base.json as numeric reference.
// Cache: marc_prowess_cache.json, keyed by form.
//
// INPUT via dv.view():
//   container — DOM node to render into
//   form      — "human" | "hybrid"  (active form)
//   rvMap     — { power, speed, vitality, perception, energy, rank? }
//   traits    — [{ name, rank, category, contribs: { stat: value } }]
// ─────────────────────────────────────────────────────────────

const { container } = input;
const form   = input.form   || 'hybrid';
const rvMap  = input.rvMap  || {};
const traits = input.traits || [];

// ── PATHS ─────────────────────────────────────────────────────
const CONFIG_PATH      = "prowess_config.json";
const BASE_PATH        = "prowess_base.json";
const CACHE_PATH       = "marc_prowess_cache.json";
const SPRITE_JSON_PATH = "prowess_sprite.json";
const ICON_MODES_PATH  = "prowess_icon_modes.json";

// ── DISPLAY ───────────────────────────────────────────────────
const COLORS = {
    power:      '#c0392b',
    speed:      '#2980b9',
    vitality:   '#27ae60',
    perception: '#8e44ad',
    energy:     '#d35400',
};
const TITLES = {
    power:      '① POWER',
    speed:      '② SPEED',
    vitality:   '③ VITALITY',
    perception: '④ PERCEPTION',
    energy:     '⑤ ENERGY',
};
const ALL_STATS = ['power', 'speed', 'vitality', 'perception', 'energy'];

// Fields the AI must produce per stat (matches renderStatFields mapping below)
const STAT_FIELDS = {
    power:      ['lift', 'strike', 'impact', 'precision'],
    speed:      ['burst', 'sustained', 'reaction', 'movement'],
    vitality:   ['resistance', 'recovery', 'resilience', 'lifespan', 'stamina', 'environmental'],
    perception: ['sight', 'hearing', 'awareness', 'intuition', 'processing'],
    energy:     ['duration', 'aura', 'burst'],
};

// Rank tiers that unlock flight (C+) and domain (A+)
const FLIGHT_RANKS = new Set(['C-rank','B-rank','A-rank','S-rank','SS-rank','SSS-rank']);
const DOMAIN_RANKS = new Set(['A-rank','S-rank','SS-rank','SSS-rank']);

// A stat is considered stale when its cached RV differs by more than this
const STALE_DELTA = 0.5;

// ── ICON MODES (shared globals with prowess_v4) ───────────────
const ICON_MODES_DEFAULT = {
    lift:{mask:false,bgremove:false,scale:1},
    strike:{mask:false,bgremove:false,scale:1},
    impact:{mask:false,bgremove:false,scale:1},
    control:{mask:false,bgremove:false,scale:1},
    burst:{mask:false,bgremove:false,scale:1},
    sustained:{mask:false,bgremove:false,scale:1},
    reaction:{mask:false,bgremove:false,scale:1},
    movement:{mask:false,bgremove:false,scale:1},
    jump:{mask:false,bgremove:false,scale:1},
    flight:{mask:false,bgremove:false,scale:1},
    threshold:{mask:false,bgremove:false,scale:1},
    recovery:{mask:false,bgremove:false,scale:1},
    stamina:{mask:false,bgremove:false,scale:1},
    toxin:{mask:false,bgremove:false,scale:1},
    env:{mask:false,bgremove:false,scale:1},
    lifespan:{mask:false,bgremove:false,scale:1},
    sight:{mask:false,bgremove:false,scale:1},
    hearing:{mask:false,bgremove:false,scale:1},
    aware:{mask:false,bgremove:false,scale:1},
    intuition:{mask:false,bgremove:false,scale:1},
    processing:{mask:false,bgremove:false,scale:1},
    domain:{mask:false,bgremove:false,scale:1},
    duration:{mask:false,bgremove:false,scale:1},
    aura:{mask:false,bgremove:false,scale:1},
    burst_eruption:{mask:false,bgremove:false,scale:1},
};
let ICON_MODES = { ...ICON_MODES_DEFAULT };
let SHOW_UNITS = true;
function getIconMode(id) { return ICON_MODES[id] || { mask:false, bgremove:false, scale:1 }; }

// ─────────────────────────────────────────────────────────────
// FILE HELPERS
// ─────────────────────────────────────────────────────────────
async function loadFile(path, def) {
    try {
        if (await app.vault.adapter.exists(path))
            return JSON.parse(await app.vault.adapter.read(path));
    } catch(e) { console.error(`[MarcProwess] Load failed: ${path}`, e); }
    return def;
}
async function saveFile(path, data) {
    await app.vault.adapter.write(path, JSON.stringify(data, null, 2));
}

// ─────────────────────────────────────────────────────────────
// RANK HELPER
// ─────────────────────────────────────────────────────────────
// Returns "F-rank" / "D-rank" / … or null for "Dormant" / missing
function normalizeRank(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toUpperCase().replace(/[\s_]+/g, '-');
    const canon = s.match(/^(SSS|SS|S|A|B|C|D|E|F)-RANK$/i);
    if (canon) return canon[1] + '-rank';
    const ORDER = ['F','E','D','C','B','A','S','SS','SSS'];
    for (const r of ['SSS','SS','S','A','B','C','D','E','F']) {
        if (!s.startsWith(r)) continue;
        const suffix = s.slice(r.length);
        if (suffix === '-' || suffix === '\u2212' || suffix === '\u2013') {
            const idx = ORDER.indexOf(r);
            return (idx > 0 ? ORDER[idx - 1] : r) + '-rank';
        }
        return r + '-rank';
    }
    return null; // "Dormant", blank, or unrecognised → no rank
}

// ─────────────────────────────────────────────────────────────
// SPRITE / ICON SYSTEM
// Shares window.ProwessJSONCache with prowess_v4 — if prowess_v4
// already ran this session, the cache is already warm.
// ─────────────────────────────────────────────────────────────
if (typeof window.ProwessJSONCache === 'undefined') window.ProwessJSONCache = null;
if (typeof window.ProwessBgCache   === 'undefined') window.ProwessBgCache   = {};

async function loadSpriteData() {
    if (window.ProwessJSONCache) return;
    try {
        if (await app.vault.adapter.exists(SPRITE_JSON_PATH)) {
            const parsed = JSON.parse(await app.vault.adapter.read(SPRITE_JSON_PATH));
            const firstKey = Object.keys(parsed)[0];
            if (firstKey && parsed[firstKey].maskHtml !== undefined) {
                window.ProwessJSONCache = parsed;
                return;
            }
        }
    } catch(e) {}
    window.ProwessJSONCache = {}; // fallback — icons absent but text still renders
}

function getColoredBgUrl(iconId, color, mode) {
    if (mode.mask) return null;
    const key = `${iconId}_${color}_${mode.bgremove ? 'bgr' : 'def'}`;
    if (window.ProwessBgCache[key]) return window.ProwessBgCache[key];
    const d = window.ProwessJSONCache?.[iconId]; if (!d) return null;
    const html = d.html
        .replaceAll('[[BASE_COLOR]]', color)
        .replaceAll('[[DETAIL_COLOR]]', mode.bgremove ? 'transparent' : '#080808');
    const url = `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.viewBox||'0 0 2048 2048'}">${html}</svg>`
    )}")`;
    return (window.ProwessBgCache[key] = url);
}

function getMaskUrl(iconId, mode) {
    const key = `${iconId}_mask_${mode.bgremove ? 'bgr' : 'def'}`;
    if (window.ProwessBgCache[key]) return window.ProwessBgCache[key];
    const d = window.ProwessJSONCache?.[iconId]; if (!d) return null;
    const dc = mode.bgremove ? 'transparent' : 'black';
    const html = (d.maskHtml || d.html)
        .replaceAll('[[MASK_DETAIL]]', dc)
        .replaceAll('[[BASE_COLOR]]', 'black')
        .replaceAll('[[DETAIL_COLOR]]', dc)
        .replace(/color-mix\([^)]+\)/g, 'black');
    const url = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${d.viewBox||'0 0 2048 2048'}">${html}</svg>`
    )}`;
    return (window.ProwessBgCache[key] = url);
}

function ico(iconId, color, size = 90) {
    const mode  = getIconMode(iconId);
    const d     = window.ProwessJSONCache?.[iconId];
    const scale = (d?.tightScale || 1) * (mode.scale || 1);
    const el    = document.createElement('div');
    el.style.overflow = 'hidden';
    if (mode.mask) {
        const mu = getMaskUrl(iconId, mode);
        el.style.cssText = [
            `width:${size}px`,`height:${size}px`,`display:inline-block`,
            `vertical-align:middle`,`flex-shrink:0`,`opacity:0.95`,`overflow:hidden`,
            `background-color:${color}`,
            mu ? `-webkit-mask-image:url("${mu}")` : '',
            mu ? `mask-image:url("${mu}")` : '',
            `-webkit-mask-size:${scale*100}%`, `mask-size:${scale*100}%`,
            `-webkit-mask-repeat:no-repeat`,   `mask-repeat:no-repeat`,
            `-webkit-mask-position:center`,    `mask-position:center`,
        ].filter(Boolean).join(';');
    } else {
        const bu = getColoredBgUrl(iconId, color, mode);
        el.style.cssText = [
            `width:${size}px`,`height:${size}px`,`display:inline-block`,
            `vertical-align:middle`,`flex-shrink:0`,`opacity:0.95`,`overflow:hidden`,
            bu ? `background-image:${bu}` : '',
            `background-size:${scale*100}%`,`background-repeat:no-repeat`,
            `background-position:center`,
        ].filter(Boolean).join(';');
    }
    return el;
}

// ─────────────────────────────────────────────────────────────
// ROW / FIELD RENDERERS  (mirrors prowess_v4 visual style exactly)
// ─────────────────────────────────────────────────────────────
function makeRow(cnt, iconId, label, field, color) {
    if (!field || field === '—' || field === '') return;
    let text, badge, secVal = null, secUnit = '';
    if (typeof field === 'object' && field !== null) {
        text = field.desc || ''; if (!text) return;
        if (field.value != null && field.value !== 0)
            badge = `${field.value}${field.unit ? ' '+field.unit : ''}`;
        else if (field.height != null) badge = field.height;
        else if (field.speed  != null) badge = field.altitude ? `${field.speed} · ${field.altitude}` : field.speed;
        else if (field.radius != null) badge = field.radius;
        secVal  = field.secondary_value ?? field.secondary ?? null;
        secUnit = field.secondary_unit || '';
    } else { text = field; }
    if (!text || text === '—') return;

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--background-modifier-border);`;
    const iw = document.createElement('div');
    iw.style.cssText = 'flex-shrink:0;margin-top:1px;';
    iw.appendChild(ico(iconId, color, 90));
    const tw = document.createElement('div');
    tw.style.cssText = 'display:flex;flex-direction:column;gap:2px;';
    const lr = document.createElement('div');
    lr.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = `font-size:0.68em;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};opacity:0.75;`;
    lbl.textContent = label;
    lr.appendChild(lbl);
    if (badge && SHOW_UNITS) {
        const b = document.createElement('span');
        b.style.cssText = `font-size:0.62em;font-weight:900;letter-spacing:0.08em;font-family:monospace;color:${color};opacity:0.9;background:rgba(255,255,255,0.04);border:1px solid ${color}33;border-radius:4px;padding:1px 5px;`;
        b.textContent = badge; lr.appendChild(b);
    }
    if (secVal != null && secVal !== '' && SHOW_UNITS) {
        const sb = document.createElement('span');
        sb.style.cssText = `font-size:0.62em;font-weight:900;letter-spacing:0.08em;font-family:monospace;color:${color};opacity:0.7;background:rgba(255,255,255,0.04);border:1px solid ${color}22;border-radius:4px;padding:1px 5px;`;
        sb.textContent = `${secVal}${secUnit ? ' '+secUnit : ''}`; lr.appendChild(sb);
    }
    const val = document.createElement('span');
    val.style.cssText = 'font-size:0.93em;line-height:1.5;color:#E7D9B0;';
    val.textContent = text;
    tw.appendChild(lr); tw.appendChild(val);
    row.appendChild(iw); row.appendChild(tw);
    cnt.appendChild(row);
}

// Renders all fields for a stat from a cached fields object.
// When awakened, speed includes jump/flight and perception includes domain
// as inline supplements stored directly in the same fields object.
function renderStatFields(cnt, stat, f, color) {
    if (!f) return;
    if (stat === 'power') {
        makeRow(cnt, 'lift',          'Lifting Capacity',  f.lift,          color);
        makeRow(cnt, 'strike',        'Strike Force',      f.strike,        color);
        makeRow(cnt, 'impact',        'Ground Impact',     f.impact,        color);
        makeRow(cnt, 'control',       'Force Precision',   f.precision,     color);
    }
    if (stat === 'speed') {
        makeRow(cnt, 'burst',         'Burst Velocity',    f.burst,         color);
        makeRow(cnt, 'sustained',     'Sustained Speed',   f.sustained,     color);
        makeRow(cnt, 'reaction',      'Reaction Time',     f.reaction,      color);
        makeRow(cnt, 'movement',      'Movement',          f.movement,      color);
        // Rank supplements stored inline
        if (f.jump)   makeRow(cnt, 'jump',   'Jump Capability', f.jump,   color);
        if (f.flight) makeRow(cnt, 'flight', 'Flight',          f.flight, color);
    }
    if (stat === 'vitality') {
        makeRow(cnt, 'threshold',     'Damage Resistance', f.resistance,   color);
        makeRow(cnt, 'recovery',      'Recovery Rate',     f.recovery,     color);
        makeRow(cnt, 'stamina',       'Stamina',           f.stamina,      color);
        makeRow(cnt, 'toxin',         'Resilience',        f.resilience,   color);
        makeRow(cnt, 'env',           'Environmental',     f.environmental, color);
        makeRow(cnt, 'lifespan',      'Lifespan',          f.lifespan,     color);
    }
    if (stat === 'perception') {
        makeRow(cnt, 'sight',         'Sight Range',       f.sight,        color);
        makeRow(cnt, 'hearing',       'Hearing',           f.hearing,      color);
        makeRow(cnt, 'aware',         'Spatial Awareness', f.awareness,    color);
        makeRow(cnt, 'intuition',     'Combat Intuition',  f.intuition,    color);
        makeRow(cnt, 'processing',    'Processing Limit',  f.processing,   color);
        // Domain stored inline when awakened at A+
        if (f.domain) makeRow(cnt, 'domain', 'Domain',    f.domain,       color);
    }
    if (stat === 'energy') {
        makeRow(cnt, 'duration',      'Ability Duration',  f.duration,     color);
        makeRow(cnt, 'aura',          'Aura Projection',   f.aura,         color);
        makeRow(cnt, 'burst_eruption','Burst Capacity',    f.burst,        color);
    }
}

// ─────────────────────────────────────────────────────────────
// PROWESS BASE REFERENCE LOOKUP
// Used to pass numeric scale context to the AI — not ability text.
// ─────────────────────────────────────────────────────────────
function findBounds(arr, rv) {
    if (!arr || !arr.length) return { lower: null, upper: null };
    const sorted = [...arr].sort((a, b) => a.v - b.v);
    if (rv <= sorted[0].v)                  return { lower: null, upper: sorted[0] };
    if (rv >= sorted[sorted.length-1].v)    return { lower: sorted[sorted.length-1], upper: null };
    for (let i = 0; i < sorted.length-1; i++) {
        if (rv > sorted[i].v && rv < sorted[i+1].v)
            return { lower: sorted[i], upper: sorted[i+1] };
    }
    return { lower: null, upper: null };
}

// Returns lower/upper reference entries for a stat at the given RV.
// stat_driven (power/speed/perception): numeric array lookup.
// rank_driven (vitality/energy): filtered to charRank if present,
//   falls back to full array as scale guide when Marc has no rank.
function getReference(stat, rv, charRank, base) {
    if (!base) return { lower: null, upper: null };
    if (['power','speed','perception'].includes(stat)) {
        const arr = base.stat_driven?.[stat] || base[stat] || [];
        return findBounds(arr, rv);
    }
    // vitality / energy — rank_driven
    const all = base.rank_driven?.[stat] || [];
    const pool = charRank ? all.filter(e => e.rank === charRank) : [];
    return findBounds(pool.length ? pool : all, rv);
}

function getSpeedRankRef(rv, charRank, base) {
    if (!charRank || !base) return { lower: null, upper: null };
    const arr = (base.rank_driven?.speed || []).filter(e => e.rank === charRank);
    return findBounds(arr, rv);
}

function getPerceptionRankRef(rv, charRank, base) {
    if (!charRank || !base || !DOMAIN_RANKS.has(charRank)) return { lower: null, upper: null };
    const arr = (base.rank_driven?.perception || []).filter(e => e.rank === charRank);
    return findBounds(arr, rv);
}

// Serialise a reference entry for the AI prompt.
// Sends only value+unit (no desc) to keep prompt lean.
function serRef(entry, label) {
    if (!entry) return `${label}: not available`;
    const compact = {};
    for (const [k, v] of Object.entries(entry.fields || {})) {
        compact[k] = typeof v === 'object' && v !== null
            ? { value: v.value, unit: v.unit || '' }
            : v;
    }
    return `${label} (RV ${entry.v}${entry.rank ? ', '+entry.rank : ''}): ${JSON.stringify(compact)}`;
}

// ─────────────────────────────────────────────────────────────
// TRAIT HELPERS
// ─────────────────────────────────────────────────────────────
function traitsForStat(stat) {
    return (traits || [])
        .filter(t => (t.contribs?.[stat] || 0) > 0)
        .sort((a, b) => (b.contribs[stat]||0) - (a.contribs[stat]||0));
}

function formatTraitList(stat, statTraits) {
    if (!statTraits.length) return '  None active in this form.';
    return statTraits.map(t =>
        `  - ${t.name} [${t.rank||'?'}, ${t.category||'?'}]  +${(t.contribs[stat]||0).toFixed(1)} RV`
    ).join('\n');
}

// ─────────────────────────────────────────────────────────────
// STALENESS & VISIBILITY
// ─────────────────────────────────────────────────────────────
function shouldShowEnergy(charRank) {
    if (charRank) return true;
    return traitsForStat('energy').length > 0;
}

function isStatCurrent(stat, rv, charRank, formCache) {
    if (!formCache?.[stat]) return false;
    const snap = formCache.stats_snapshot?.[stat];
    if (snap == null) return false;
    if (Math.abs(snap - rv) > STALE_DELTA) return false;
    if ((formCache.rank_snapshot ?? null) !== (charRank ?? null)) return false;
    return true;
}

function getStaleStats(charRank, formCache, showEnergy) {
    return ALL_STATS.filter(stat => {
        if (stat === 'energy' && !showEnergy) return false;
        if (rvMap[stat] == null) return false;
        return !isStatCurrent(stat, rvMap[stat], charRank, formCache);
    });
}

// ─────────────────────────────────────────────────────────────
// AI PROMPT BUILDER
// One prompt per stat. Sends numeric scale reference from
// prowess_base and the trait list for that stat only.
// ─────────────────────────────────────────────────────────────
const FIELD_RULES = {
    power:
`  lift        → max weight Marc can raise (kg or tons)
  strike      → punch/grip force (kgf) and impact velocity
  impact      → destruction radius on a full-force strike or landing (meters)
  precision   → fine-control of force output; calibration between lethal and delicate`,
    speed:
`  burst       → peak velocity (km/h or Mach)
  sustained   → maintainable cruising speed over distance without deterioration
  reaction    → stimulus-to-movement latency (ms)
  movement    → 3D agility through complex terrain; quality of direction changes`,
    vitality:
`  resistance    → raw damage Marc's body absorbs before tissue failure registers (kgf)
  recovery      → wound closure and tissue regeneration rate (severity and time)
  resilience    → resistance to toxins, crushing pressure, status effects
  lifespan      → effective biological ceiling given accelerated repair mechanics
  stamina       → peak-output duration before physical degradation begins
  environmental → survivable temperature, pressure, and atmospheric extremes (°C, atm)`,
    perception:
`  sight       → visual acuity range and detail resolution
  hearing     → auditory range and ambient noise filtering
  awareness   → omnidirectional spatial tracking radius and passive mapping
  intuition   → pattern recognition and combat prediction from sensory input
  processing  → simultaneous threat/target tracking capacity`,
    energy:
`  duration    → sustained output time at full draw before depletion (minutes)
  aura        → passive energy leak radius detectable by others (meters)
  burst       → maximum single-release spike output (KEY must be "burst")`,
};

function buildPrompt(stat, rv, charRank, ref, speedRankRef, percRankRef, statTraits) {

    // ── World / Marc context ───────────────────────────────────
    const worldCtx = charRank
        ? `Marc is an awakened Corebearer at ${charRank} with an Origin Core (currently damaged but functional post-awakening). His Origin Core distributes stat growth equally across ALL vitals — 20% each — unlike other Core types that weight specific vitals. The RV provided is his exact current capability — it already reflects all contributions from his rank and devoured traits combined. Write descriptions accurate to that exact RV using the reference bounds as calibration. For flavour, frame his capabilities as coming from both Core rank and absorbed creature biology — but describe only what the RV actually represents. Do not add or inflate beyond it.`
        : `Marc has NO awakened Core — it is damaged and he cannot awaken through conventional means. Every stat increase comes from absorbing traits of dead creatures he touches. No Core framework, no rank threshold, no energy refinement applies to him. All described capabilities must be raw biology: absorbed tissue, creature-derived physiology, instinct accumulation. Do NOT reference Core structure, rank thresholds, or Corebearer mechanics.`;

    // ── Form context ───────────────────────────────────────────
    const formCtx = form === 'human'
        ? `ACTIVE FORM: Human. Marc only absorbs appearance-preserving traits in this form by choice. All physical effects MUST be appearance-neutral — internal, subcutaneous, invisible externally. No surface-level physical change may appear in descriptions.`
        : `ACTIVE FORM: Hybrid. This form includes appearance-altering traits Marc intentionally keeps separate from his human form. External manifestation of absorbed creature traits is appropriate where the creature source warrants it.`;

    // ── Numeric scale reference ────────────────────────────────
    let refBlock =
`SCALE REFERENCE (use ONLY for numeric calibration — do NOT copy descriptions or imply Marc has these abilities):
${serRef(ref.lower, 'Lower bound')}
${serRef(ref.upper, 'Upper bound')}`;

    if (!charRank && ['vitality','energy'].includes(stat)) {
        refBlock += `\nNOTE: These reference entries show Corebearer ability levels at similar RV. Marc does NOT have those abilities. Use the numbers only as a scale anchor.`;
    }

    // Rank supplement references for speed and perception
    if (stat === 'speed' && charRank) {
        const supName = FLIGHT_RANKS.has(charRank) ? 'FLIGHT' : 'JUMP';
        refBlock += `\n\nRANK SUPPLEMENT REFERENCE — ${supName} (${charRank}):
${serRef(speedRankRef?.lower, 'Lower bound')}
${serRef(speedRankRef?.upper, 'Upper bound')}`;
    }
    if (stat === 'perception' && charRank && DOMAIN_RANKS.has(charRank)) {
        refBlock += `\n\nRANK SUPPLEMENT REFERENCE — DOMAIN (${charRank}):
${serRef(percRankRef?.lower, 'Lower bound')}
${serRef(percRankRef?.upper, 'Upper bound')}`;
    }

    // ── Trait context ──────────────────────────────────────────
    const traitBlock =
`TRAITS CONTRIBUTING TO ${stat.toUpperCase()} IN ${form.toUpperCase()} FORM (sorted highest contribution first):
${formatTraitList(stat, statTraits)}`;

    // ── Fields to generate ─────────────────────────────────────
    const fields = [...STAT_FIELDS[stat]];
    if (stat === 'speed' && charRank)
        fields.push(FLIGHT_RANKS.has(charRank) ? 'flight' : 'jump');
    if (stat === 'perception' && charRank && DOMAIN_RANKS.has(charRank))
        fields.push('domain');

    // ── Energy no-rank special note ────────────────────────────
    const energyNote = (stat === 'energy' && !charRank)
        ? `\nSPECIAL NOTE — ENERGY WITHOUT CORE: Marc has no Core to channel or refine energy. Any energy stat here comes from absorbed creature biology that naturally stores or emits energy (glands, organs, tissue). Describe it as raw, unrefined, and unstable — not channelled power but leaking biological energy with no control framework.`
        : '';

    // ── Trait mention rule ─────────────────────────────────────
    const traitRule = statTraits.length > 2
        ? `Name at most 1–2 of the top contributing traits in the descriptions. Acknowledge the rest exist with phrases like "alongside other absorbed traits" or "among other contributions" — do NOT list them all.`
        : statTraits.length > 0
        ? `You may name the contributing trait(s) directly — there are only a few.`
        : `No active traits contribute to this stat in this form. Describe Marc's baseline accumulated capability without naming specific traits.`;

    // ── Final prompt ───────────────────────────────────────────
    return `WORLD CONTEXT:
You are writing stat descriptions for Marc, the Devour-type protagonist of a dark fantasy web novel. The world uses a Corebearer system — humans born with energy Cores grow stronger by killing monsters. RV (Rank Value) is the numeric power level of a vital. Normal peak human = RV ~1. Ranks ascend: F → E → D → C → B → A → S → SS → SSS.

${worldCtx}

${formCtx}

STAT: ${stat.toUpperCase()}
Current RV: ${rv.toFixed(2)}

${refBlock}

${traitBlock}
${energyNote}

FIELD RULES FOR ${stat.toUpperCase()}:
${FIELD_RULES[stat]}

FIELDS TO GENERATE: ${fields.join(', ')}

WRITING INSTRUCTIONS:
- Scale all numeric values consistently with the reference bounds.
- Tone: dark, visceral, concrete. Use real units (kg, km/h, ms, °C, kgf, m, years, atm).
- Each desc: 1–3 concise sentences. Specific numbers only — no vague phrases like "greatly enhanced."
- ${traitRule}
- ${charRank
    ? `The RV is the final number — already boosted. Describe capabilities at exactly this RV. Use trait names for flavour context (what gave him this capability), not to justify higher numbers.`
    : 'Pure biology. No Core. No rank abilities. Only raw creature-derived physiology.'}
- ${form === 'human'
    ? 'Human form: all effects must be appearance-neutral — internal, invisible, subcutaneous.'
    : 'Hybrid form: external physical manifestation is appropriate where the creature source warrants it.'}

OUTPUT:
Return ONLY valid JSON. No markdown. No explanation. No preamble.
{"${stat}": {${fields.map(f => `"${f}":{"value":<number>,"unit":"<string>","desc":"<string>"}`).join(',')}}}`;
}

// ─────────────────────────────────────────────────────────────
// AI CALL  (same provider/model logic as prowess_v4)
// ─────────────────────────────────────────────────────────────
async function callAI(prompt, config) {
    const provider = config.providers?.[config.activeProvider];
    const apiKey   = provider?.key;
    const model    = config.activeModel;
    if (!apiKey || apiKey.includes('YOUR_')) {
        new Notice('API Key missing in prowess_config.json', 6000);
        return null;
    }
    let url, headers, body;
    if (config.activeProvider === 'aistudio') {
        url     = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        headers = { 'Content-Type': 'application/json' };
        body    = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json', temperature: 0.4 },
        });
    } else {
        url     = config.activeProvider === 'groq'
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : 'https://openrouter.ai/api/v1/chat/completions';
        headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
        if (config.activeProvider === 'openrouter') {
            headers['HTTP-Referer'] = 'obsidian://app';
            headers['X-Title']      = 'Marc Prowess Engine';
        }
        body = JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.4 });
    }
    try {
        const res  = await requestUrl({ url, method: 'POST', headers, body });
        const text = config.activeProvider === 'aistudio'
            ? (res.json.candidates?.[0]?.content?.parts?.[0]?.text || '')
            : (res.json.choices?.[0]?.message?.content || '');
        const m = text.match(/\{[\s\S]*\}/);
        return JSON.parse(m ? m[0] : text.trim());
    } catch(e) {
        console.error('[MarcProwess] AI error:', e);
        new Notice(`[Marc Prowess] API Error: ${e.message}`, 8000);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────
// CACHE WRITE
// ─────────────────────────────────────────────────────────────
function writeToCache(cache, stat, fields, rv, charRank) {
    if (!cache[form]) cache[form] = { stats_snapshot: {}, rank_snapshot: null };
    cache[form][stat]                = fields;
    cache[form].stats_snapshot       = cache[form].stats_snapshot || {};
    cache[form].stats_snapshot[stat] = rv;
    cache[form].rank_snapshot        = charRank ?? null;
    return cache;
}

// ─────────────────────────────────────────────────────────────
// UPDATE BUTTON
// ─────────────────────────────────────────────────────────────
function makeUpdateBtn(label, color, onClick) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = [
        `font-size:0.58em`, `font-weight:900`, `letter-spacing:0.1em`,
        `text-transform:uppercase`, `padding:2px 8px`, `border-radius:4px`,
        `cursor:pointer`, `border:1px solid ${color}70`,
        `background:${color}10`, `color:${color}`, `margin-left:8px`,
        `vertical-align:middle`, `transition:background 0.15s`,
    ].join(';');
    btn.addEventListener('mouseenter', () => btn.style.background = `${color}25`);
    btn.addEventListener('mouseleave', () => btn.style.background = `${color}10`);
    btn.onclick = onClick;
    return btn;
}

// ─────────────────────────────────────────────────────────────
// SETTINGS PANEL
// Bottom-sheet modal. Provider + model dropdowns + show units toggle.
// Opens from the ⚙ gear button in the heading row.
// Saves changes immediately to prowess_config.json and
// prowess_icon_modes.json, then re-renders.
// ─────────────────────────────────────────────────────────────
function buildSettingsPanel(config, currentShowUnits) {
    // ── Backdrop ──
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed;top:0;left:0;right:0;bottom:0;
        background:rgba(0,0,0,0.75);
        z-index:9998;
        backdrop-filter:blur(3px);
        -webkit-backdrop-filter:blur(3px);
    `;

    // ── Panel ──
    const panel = document.createElement('div');
    panel.style.cssText = `
        position:fixed;bottom:0;left:0;right:0;
        max-height:70vh;
        background:#0e0e12;
        border-top:1px solid #2a2a35;
        border-radius:16px 16px 0 0;
        z-index:9999;
        display:flex;
        flex-direction:column;
        overflow:hidden;
        box-shadow:0 -8px 40px rgba(0,0,0,0.7);
    `;

    // ── Panel Header ──
    const panelHead = document.createElement('div');
    panelHead.style.cssText = `
        display:flex;align-items:center;justify-content:space-between;
        padding:14px 18px 10px;
        border-bottom:1px solid #1e1e28;
        flex-shrink:0;
    `;
    const panelTitle = document.createElement('span');
    panelTitle.style.cssText = `font-size:0.72em;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#5b8af0;`;
    panelTitle.textContent = '⚙ MARC PROWESS — SETTINGS';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `background:none;border:none;color:#666;font-size:1.1em;cursor:pointer;padding:4px 8px;line-height:1;`;
    closeBtn.onclick = () => { overlay.remove(); panel.remove(); };
    panelHead.appendChild(panelTitle);
    panelHead.appendChild(closeBtn);
    panel.appendChild(panelHead);

    // ── Scrollable body ──
    const body = document.createElement('div');
    body.style.cssText = `overflow-y:auto;flex:1;padding:0 18px 24px;`;

    // ── Section label helper ──
    function sectionLabel(text) {
        const el = document.createElement('div');
        el.style.cssText = `font-size:0.6em;font-weight:900;letter-spacing:0.16em;text-transform:uppercase;color:#444;padding:14px 0 6px;`;
        el.textContent = text;
        return el;
    }

    // ── Divider ──
    function divider() {
        const el = document.createElement('div');
        el.style.cssText = `border-top:1px solid #1e1e28;margin:4px 0;`;
        return el;
    }

    // ── AI MODEL SELECTION ─────────────────────────────────────
    body.appendChild(sectionLabel('AI Provider & Model'));

    const selectStyle = `
        width:100%;
        background:#1a1a22;
        color:#E7D9B0;
        border:1px solid #2e2e3e;
        border-radius:8px;
        padding:9px 12px;
        font-size:0.78em;
        font-weight:600;
        font-family:monospace;
        cursor:pointer;
        margin-bottom:8px;
        appearance:none;
        -webkit-appearance:none;
    `;

    // Provider dropdown
    const providerLabel = document.createElement('div');
    providerLabel.style.cssText = `font-size:0.62em;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#555;margin-bottom:4px;`;
    providerLabel.textContent = 'Provider';
    body.appendChild(providerLabel);

    const providerSelect = document.createElement('select');
    providerSelect.style.cssText = selectStyle;
    Object.keys(config.providers || {}).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p; opt.textContent = p.toUpperCase();
        providerSelect.appendChild(opt);
    });
    providerSelect.value = config.activeProvider || '';
    body.appendChild(providerSelect);

    // Model dropdown
    const modelLabel = document.createElement('div');
    modelLabel.style.cssText = `font-size:0.62em;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#555;margin-bottom:4px;`;
    modelLabel.textContent = 'Model';
    body.appendChild(modelLabel);

    const modelSelect = document.createElement('select');
    modelSelect.style.cssText = selectStyle;
    body.appendChild(modelSelect);

    // Populate model options for the currently selected provider
    const populateModels = () => {
        modelSelect.innerHTML = '';
        const models = config.providers?.[providerSelect.value]?.models || [];
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            modelSelect.appendChild(opt);
        });
        // Restore saved model if it exists in the new provider's list
        if (models.includes(config.activeModel)) modelSelect.value = config.activeModel;
        else if (models.length) modelSelect.value = models[0];
    };
    populateModels();

    // Persist on change
    const persistConfig = async () => {
        config.activeProvider = providerSelect.value;
        config.activeModel    = modelSelect.value;
        await saveFile(CONFIG_PATH, config);
    };
    providerSelect.onchange = async () => { populateModels(); await persistConfig(); };
    modelSelect.onchange    = async () => { await persistConfig(); };

    body.appendChild(divider());

    // ── SHOW UNITS TOGGLE ──────────────────────────────────────
    body.appendChild(sectionLabel('Display'));

    const unitsRow = document.createElement('div');
    unitsRow.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:6px 0 10px;`;

    const unitsLabelWrap = document.createElement('div');
    const unitsMain = document.createElement('div');
    unitsMain.style.cssText = `font-size:0.72em;font-weight:900;letter-spacing:0.08em;text-transform:uppercase;color:#9a9aaa;`;
    unitsMain.textContent = 'Show Units';
    const unitsSub = document.createElement('div');
    unitsSub.style.cssText = `font-size:0.6em;color:#444;margin-top:2px;letter-spacing:0.04em;`;
    unitsSub.textContent = 'value badge next to each field label';
    unitsLabelWrap.appendChild(unitsMain);
    unitsLabelWrap.appendChild(unitsSub);
    unitsRow.appendChild(unitsLabelWrap);

    let showUnitsState = currentShowUnits;
    const track = document.createElement('div');
    const thumb = document.createElement('div');
    const applyToggleStyle = () => {
        track.style.cssText = `width:42px;height:22px;border-radius:11px;cursor:pointer;position:relative;flex-shrink:0;background:${showUnitsState ? '#5b8af0' : '#1e1e2a'};border:1px solid ${showUnitsState ? '#5b8af0' : '#2e2e3e'};`;
        thumb.style.cssText = `position:absolute;top:3px;left:${showUnitsState ? '21px' : '3px'};width:14px;height:14px;border-radius:50%;background:${showUnitsState ? 'white' : '#444'};transition:left 0.15s;`;
    };
    applyToggleStyle();
    track.appendChild(thumb);
    track.onclick = async () => {
        showUnitsState = !showUnitsState;
        applyToggleStyle();
        SHOW_UNITS = showUnitsState;
        // Write to prowess_icon_modes.json (shared with prowess_v4)
        const existingModes = await loadFile(ICON_MODES_PATH, {});
        existingModes.showUnits = showUnitsState;
        await saveFile(ICON_MODES_PATH, existingModes);
        // Re-render live so the badge change is visible without closing panel
        renderMarcProwess();
    };
    unitsRow.appendChild(track);
    body.appendChild(unitsRow);

    // ── Note ──
    body.appendChild(divider());
    const note = document.createElement('div');
    note.style.cssText = `font-size:0.6em;color:#333;letter-spacing:0.04em;padding:8px 0 4px;`;
    note.textContent = 'Provider and model changes take effect on the next Update click. Icon render modes are managed from Prowess v4 settings.';
    body.appendChild(note);

    panel.appendChild(body);

    // Close on backdrop click
    overlay.onclick = () => { overlay.remove(); panel.remove(); };
    panel.onclick   = (e) => e.stopPropagation();

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
}

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────
async function renderMarcProwess() {
    await loadSpriteData();

    // Apply icon mode overrides (shared config file with prowess_v4)
    const savedModes = await loadFile(ICON_MODES_PATH, {});
    ICON_MODES = { ...ICON_MODES_DEFAULT };
    for (const [id, m] of Object.entries(savedModes)) {
        if (id === 'showUnits') continue;
        ICON_MODES[id] = { mask: false, bgremove: false, ...m };
    }
    SHOW_UNITS = savedModes.showUnits !== undefined ? savedModes.showUnits : true;

    container.innerHTML = '';
    container.style.cssText = 'font-family:var(--font-text);padding:4px 0;';

    const config = await loadFile(CONFIG_PATH, null);
    if (!config) {
        container.createEl('div', { text: '⚠️ prowess_config.json not found.' });
        return;
    }

    const baseFile   = await loadFile(BASE_PATH, null);
    let   cache      = await loadFile(CACHE_PATH, {});

    const charRank   = normalizeRank(rvMap?.rank);
    const showEnergy = shouldShowEnergy(charRank);
    const formCache  = cache[form] || null;
    const staleStats = getStaleStats(charRank, formCache, showEnergy);
    const anyStale   = staleStats.length > 0;

    // ── Core update helper (builds prompt → calls AI → writes cache) ──
    async function updateStat(stat) {
        const rv         = Math.round((rvMap[stat] || 0) * 10) / 10;
        const ref        = getReference(stat, rv, charRank, baseFile);
        const spdRankRef = stat === 'speed'      ? getSpeedRankRef(rv, charRank, baseFile)      : null;
        const prcRankRef = stat === 'perception' ? getPerceptionRankRef(rv, charRank, baseFile) : null;
        const statTraits = traitsForStat(stat);
        const prompt     = buildPrompt(stat, rv, charRank, ref, spdRankRef, prcRankRef, statTraits);
        const result     = await callAI(prompt, config);
        if (result?.[stat]) {
            cache = writeToCache(cache, stat, result[stat], rv, charRank);
            return true;
        }
        return false;
    }

    // ── HEADING ROW ───────────────────────────────────────────
    const headWrap = document.createElement('div');
    headWrap.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:6px 0 10px;';

    const headLabel = document.createElement('span');
    headLabel.style.cssText = 'font-size:0.62em;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#2a2a38;';
    headLabel.textContent = '// MARC — PROWESS OVERVIEW';
    headWrap.appendChild(headLabel);

    // Form badge
    const formBadge = document.createElement('span');
    const iH = form === 'human';
    formBadge.style.cssText = `font-size:0.58em;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;padding:1px 7px;border-radius:3px;border:1px solid;${iH ? 'color:#81a1c1;border-color:#81a1c1;background:rgba(129,161,193,0.08);' : 'color:#bf616a;border-color:#bf616a;background:rgba(191,97,106,0.08);'}`;
    formBadge.textContent = form.toUpperCase();
    headWrap.appendChild(formBadge);

    // Rank badge (only when awakened)
    if (charRank) {
        const rankBadge = document.createElement('span');
        rankBadge.style.cssText = `font-size:0.58em;font-weight:800;letter-spacing:0.1em;padding:1px 7px;border-radius:3px;border:1px solid #d35400;color:#d35400;background:rgba(211,84,0,0.08);`;
        rankBadge.textContent = charRank.toUpperCase();
        headWrap.appendChild(rankBadge);
    }

    // ⚙ Settings gear button — pushed to far right via margin-left:auto
    const gearBtn = document.createElement('button');
    gearBtn.textContent = '⚙';
    gearBtn.title = 'AI settings';
    gearBtn.style.cssText = `
        margin-left:auto;
        background:none;
        border:1px solid #2a2a38;
        border-radius:4px;
        color:#444;
        font-size:0.8em;
        cursor:pointer;
        padding:1px 6px;
        line-height:1.4;
        flex-shrink:0;
    `;
    gearBtn.addEventListener('mouseenter', () => gearBtn.style.color = '#5b8af0');
    gearBtn.addEventListener('mouseleave', () => gearBtn.style.color = '#444');
    gearBtn.onclick = () => buildSettingsPanel(config, SHOW_UNITS);
    headWrap.appendChild(gearBtn);

    // Status note + Update All button
    if (anyStale) {
        const statusNote = document.createElement('span');
        statusNote.style.cssText = 'font-size:0.58em;color:#c0392b;font-weight:700;';
        statusNote.textContent = `${staleStats.length} stat${staleStats.length > 1 ? 's' : ''} outdated`;
        headWrap.appendChild(statusNote);

        const updateAllBtn = makeUpdateBtn('◈ UPDATE ALL', '#5b8af0', async () => {
            updateAllBtn.textContent = '⌛ GENERATING...';
            updateAllBtn.disabled = true;
            let ok = 0;
            for (const stat of staleStats) {
                updateAllBtn.textContent = `⌛ ${stat.toUpperCase()}...`;
                if (await updateStat(stat)) ok++;
            }
            await saveFile(CACHE_PATH, cache);
            if (ok > 0) {
                new Notice(`[Marc Prowess] ${ok} stat${ok>1?'s':''} updated.`, 4000);
                renderMarcProwess();
            } else {
                updateAllBtn.textContent = '✕ FAILED — RETRY';
                updateAllBtn.disabled = false;
            }
        });
        headWrap.appendChild(updateAllBtn);
    }

    container.appendChild(headWrap);

    // ── STAT SECTIONS ─────────────────────────────────────────
    for (const stat of ALL_STATS) {
        if (stat === 'energy' && !showEnergy) continue;
        if (rvMap[stat] == null) continue;

        const rv         = Math.round(rvMap[stat] * 10) / 10;
        const isStale    = staleStats.includes(stat);
        const cachedData = formCache?.[stat] ?? null;
        const color      = COLORS[stat];

        // ── Stat header row (title + RV + optional update button) ──
        const hdr = document.createElement('div');
        hdr.style.cssText = `display:flex;align-items:center;justify-content:space-between;padding:10px 0 4px;margin-top:8px;border-bottom:2px solid ${color};`;

        const hdrTitle = document.createElement('span');
        hdrTitle.style.cssText = `font-size:1em;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${color};opacity:0.9;`;
        hdrTitle.textContent = `${TITLES[stat]}  —  RV ${rv}`;
        hdr.appendChild(hdrTitle);

        if (isStale) {
            const singleBtn = makeUpdateBtn('↺ UPDATE', color, async () => {
                singleBtn.textContent = '⌛';
                singleBtn.disabled = true;
                if (await updateStat(stat)) {
                    await saveFile(CACHE_PATH, cache);
                    new Notice(`[Marc Prowess] ${stat.toUpperCase()} updated.`, 3000);
                    renderMarcProwess();
                } else {
                    singleBtn.textContent = '↺ RETRY';
                    singleBtn.disabled = false;
                }
            });
            hdr.appendChild(singleBtn);
        }
        container.appendChild(hdr);

        // ── Cached description or first-run placeholder ──
        if (cachedData) {
            renderStatFields(container, stat, cachedData, color);
        } else {
            const ph = document.createElement('div');
            ph.style.cssText = 'font-size:0.8em;color:#3a3a4a;padding:10px 0 6px;font-style:italic;';
            ph.textContent = 'No data yet — click ↺ UPDATE to generate Marc\'s description for this stat.';
            container.appendChild(ph);
        }
    }
}

renderMarcProwess();

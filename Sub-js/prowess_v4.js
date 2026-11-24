// ─────────────────────────────────────────────────────────────
// PROWESS MAPPING ENGINE v6.5 — ICON MODES + SETTINGS PANEL
// DataviewJS — Obsidian Mobile
// Icons: Token replacement + CSS Mask + BG Remove + Settings UI
// ─────────────────────────────────────────────────────────────

const { container, rvMap } = input;
const CACHE_PATH        = "prowess_cache.json";
const CONFIG_PATH       = "prowess_config.json";
const BASE_PATH         = "prowess_base.json";
const SPRITE_PATH       = "sprite.svg";
const SPRITE_JSON_PATH  = "prowess_sprite.json";
const ICON_MODES_PATH   = "prowess_icon_modes.json";

// ── ICON MODE DEFAULTS ────────────────────────────────────────
// Each key is an icon ID used in renderFields/makeRow.
// Flags: mask (bool), bgremove (bool) — combinable.
// These are fallback defaults. UI saves overrides to prowess_icon_modes.json.
const ICON_MODES_DEFAULT = {
    lift:           { mask: false, bgremove: false, scale: 1   },
    strike:         { mask: false, bgremove: false, scale: 1   },
    impact:         { mask: false, bgremove: false, scale: 1   },
    precision:      { mask: false, bgremove: false, scale: 1   },
    burst:          { mask: false, bgremove: false, scale: 1   },
    sustained:      { mask: false, bgremove: false, scale: 1   },
    reaction:       { mask: false, bgremove: false, scale: 1   },
    movement:       { mask: false, bgremove: false, scale: 1   },
    jump:           { mask: false, bgremove: false, scale: 1   },
    flight:         { mask: false, bgremove: false, scale: 1   },
    resistance:     { mask: false, bgremove: false, scale: 1   },
    recovery:       { mask: false, bgremove: false, scale: 1   },
    resilience:     { mask: false, bgremove: false, scale: 1   },
    lifespan:       { mask: false, bgremove: false, scale: 1   },
    stamina:        { mask: false, bgremove: false, scale: 1   },
    env:            { mask: false, bgremove: false, scale: 1   },
    sight:          { mask: false, bgremove: false, scale: 1   },
    hearing:        { mask: false, bgremove: false, scale: 1   },
    aware:          { mask: false, bgremove: false, scale: 1   },
    intuition:      { mask: false, bgremove: false, scale: 1   },
    processing:     { mask: false, bgremove: false, scale: 1   },
    domain:         { mask: false, bgremove: false, scale: 1   },
    duration:       { mask: false, bgremove: false, scale: 1   },
    aura:           { mask: false, bgremove: false, scale: 1   },
    burst_energy:   { mask: false, bgremove: false, scale: 1   },
};

// ── RESOLVED ICON MODES (merged at runtime) ───────────────────
// Populated after prowess_icon_modes.json is loaded.
let ICON_MODES  = { ...ICON_MODES_DEFAULT };
let SHOW_UNITS  = true; // persisted as showUnits in prowess_icon_modes.json

function getIconMode(iconId) {
    return ICON_MODES[iconId] || { mask: false, bgremove: false };
}

// ─────────────────────────────────────────────────────────────
// FILE HELPERS
// ─────────────────────────────────────────────────────────────

async function loadFile(path, defaultVal) {
    try {
        if (await app.vault.adapter.exists(path)) {
            const raw = await app.vault.adapter.read(path);
            return JSON.parse(raw);
        }
    } catch (e) { console.error(`Failed to load ${path}:`, e); }
    return defaultVal;
}

async function saveProwessCache(currentCache) {
    await app.vault.adapter.write(CACHE_PATH, JSON.stringify(currentCache, null, 2));
}

async function saveIconModes(modes) {
    await app.vault.adapter.write(ICON_MODES_PATH, JSON.stringify(modes, null, 2));
}

// ─────────────────────────────────────────────────────────────
// CORE MATH
// ─────────────────────────────────────────────────────────────

function findBounds(arr, target) {
    if (!arr || arr.length === 0) return { exact: null, lower: null, upper: null, nearest: null };
    let lower = arr[0];
    let upper = arr[arr.length - 1];
    let nearest = arr[0];
    let minDiff = Infinity;
    for (let i = 0; i < arr.length; i++) {
        const diff = Math.abs(arr[i].v - target);
        if (diff < minDiff) { minDiff = diff; nearest = arr[i]; }
    }
    const exact = minDiff === 0 ? nearest : null;
    for (let i = 0; i < arr.length - 1; i++) {
        if (target > arr[i].v && target < arr[i + 1].v) { lower = arr[i]; upper = arr[i + 1]; break; }
    }
    return { exact, lower, upper, nearest };
}

// stat_driven lookup (power / speed / perception) — keyed by numeric RV
function getBaseData(type, baseFileData) {
    if (baseFileData && baseFileData.stat_driven && baseFileData.stat_driven[type])
        return baseFileData.stat_driven[type];
    // legacy fallback
    if (baseFileData && baseFileData[type]) return baseFileData[type];
    return [];
}

// rank_driven lookup (vitality / energy / speed supplement / perception supplement)
function getRankData(type, baseFileData) {
    if (baseFileData && baseFileData.rank_driven && baseFileData.rank_driven[type])
        return baseFileData.rank_driven[type];
    return [];
}

// Normalize any rank string → canonical "X-rank" form.
// Handles pseudo-ranks: "C–" / "C-" (not yet this rank) → drops to previous rank.
// Handles: "F", "F+", "F+++", "F-rank", "f rank", "SS+", "SSS", etc.
function normalizeRank(raw) {
    if (!raw) return null;
    const s = String(raw).trim().toUpperCase().replace(/[\s_]+/g, '-');
    // Check already-canonical form first
    const canon = s.match(/^(SSS|SS|S|A|B|C|D|E|F)-RANK$/i);
    if (canon) return canon[1].toUpperCase() + '-rank';
    const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
    // Extract leading rank letters (longest match first to handle SS before S)
    for (const r of ['SSS', 'SS', 'S', 'A', 'B', 'C', 'D', 'E', 'F']) {
        if (s.startsWith(r)) {
            const suffix = s.slice(r.length);
            // Pseudo-rank: trailing lone minus (–, -, −) = not yet this rank → one step down
            if (suffix === '-' || suffix === '\u2212' || suffix === '\u2013') {
                const idx = RANK_ORDER.indexOf(r);
                return (idx > 0 ? RANK_ORDER[idx - 1] : r) + '-rank';
            }
            return r + '-rank';
        }
    }
    return null;
}

// Within a filtered array of rank entries, find the one whose v is nearest to target.
function nearestInRank(entries, targetV) {
    if (!entries || entries.length === 0) return null;
    return entries.reduce((best, e) =>
        Math.abs(e.v - targetV) < Math.abs(best.v - targetV) ? e : best
    );
}

// Like findBounds but scoped to already-filtered same-rank entries.
function findBoundsInRank(entries, targetV) {
    if (!entries || entries.length === 0) return { exact: null, lower: null, upper: null, nearest: null };
    const sorted = [...entries].sort((a, b) => a.v - b.v);
    let lower = null, upper = null;
    let nearest = sorted[0];
    let minDiff = Infinity;
    for (let i = 0; i < sorted.length; i++) {
        const diff = Math.abs(sorted[i].v - targetV);
        if (diff < minDiff) { minDiff = diff; nearest = sorted[i]; }
    }
    const exact = minDiff === 0 ? nearest : null;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (targetV > sorted[i].v && targetV < sorted[i + 1].v) { lower = sorted[i]; upper = sorted[i + 1]; break; }
        if (targetV <= sorted[0].v)  { upper = sorted[0]; break; }        // below floor
        if (targetV >= sorted[sorted.length - 1].v) { lower = sorted[sorted.length - 1]; break; } // above ceiling
    }
    return { exact, lower, upper, nearest };
}

// ─────────────────────────────────────────────────────────────
// AI GENERATION
// ─────────────────────────────────────────────────────────────

async function generateSingleMissing(vital, targetRV, bounds, config) {
    const providerData = config.providers[config.activeProvider];
    const apiKey = providerData.key;
    const model = config.activeModel;
    if (!apiKey || apiKey.includes("YOUR_")) { new Notice("API Key missing in prowess_config.json", 6000); return null; }
    const FIELD_RULES = {
        power:      `power.lift       → weight they can lift (kg or tons)\npower.strike     → punch force (kg-f) and velocity (km/h or Mach)\npower.impact     → environmental destruction radius and effect\npower.precision  → calibration of force output; focused control vs collateral risk`,
        speed:      `speed.burst      → max velocity (km/h or Mach)\nspeed.sustained  → maintainable cruising speed\nspeed.reaction   → reaction time (ms)\nspeed.movement   → 3D movement quality through complex terrain`,
        perception: `perception.sight      → visual range and detail\nperception.hearing    → hearing range and filtering ability\nperception.awareness  → omnidirectional spatial map and tracking radius\nperception.intuition  → combat prediction and intent reading\nperception.processing → simultaneous threat/target tracking capacity limit`,
    };
    const currentRules = FIELD_RULES[vital] || "No specific field rules provided.";
    const prompt = `WORLD_CONTEXT =\nYou are generating power scaling descriptions for a modern-day dark fantasy web novel.\nThe system measures Corebearers — humans born with energy cores who grow stronger by killing monsters.\nRV (Rank Value) is the vital's numeric power level.\n\nINSTRUCTIONS:\n- Use CONCRETE numbers (kg, km/h, meters, years, ms).\n- Use DARK and VISCERAL tone.\n- SCALE LOGICALLY between the provided Lower and Upper bounds.\n- WRITING REFERENCE: For each field desc, include a short evocative sentence describing how this power feels or looks in action.\n\nFIELD RULES FOR ${vital.toUpperCase()}:\n${currentRules}\n\nYou are generating data ONLY for the vital: ${vital.toUpperCase()} at Target RV: ${targetRV}.\n\nLower Bound: ${bounds.lower ? JSON.stringify(bounds.lower.fields) : "{}"}\nUpper Bound: ${bounds.upper ? JSON.stringify(bounds.upper.fields) : "{}"}\n\nOUTPUT FORMAT: Each field must be an object with three keys:\n  "value": a single representative numeric value (number type, use 0 if not applicable)\n  "unit": the unit string (e.g. "kg", "km/h", "ms", "m", "years", "kg-f", "focus_factor", "precision_factor")\n  "desc": a vivid impactfull description using less words with concrete numbers\n\nExample field: "lift": {"value": 500, "unit": "kg", "desc": "..."}\n\nOutput strictly valid JSON. Format: {"${vital}": {fields}}. Do not include markdown formatting. Return only raw JSON.`;
    let url, headers, body;
    if (config.activeProvider === 'aistudio') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", temperature: 0.4 } });
    } else {
        url = config.activeProvider === 'groq' ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
        headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
        if (config.activeProvider === 'openrouter') { headers["HTTP-Referer"] = "obsidian://app"; headers["X-Title"] = "Prowess Engine"; }
        body = JSON.stringify({ model: model, messages: [{ role: "user", content: prompt }], temperature: 0.4 });
    }
    try {
        const response = await requestUrl({ url, method: "POST", headers, body });
        let aiText = "";
        if (config.activeProvider === 'aistudio') { const candidate = response.json.candidates?.[0]; aiText = candidate.content.parts[0].text; }
        else { aiText = response.json.choices[0].message.content; }
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        const cleanedResults = jsonMatch ? jsonMatch[0] : aiText.trim();
        return JSON.parse(cleanedResults);
    } catch (e) { console.error("Interpolation failed:", e); new Notice(`API Error: ${e.message}`, 8000); return null; }
}

// rank_driven AI generation — vitality, energy, speed_rank, perception_rank.
// Bounds are pre-filtered to the character's current rank tier only.
async function generateRankMissing(vital, rank, targetRV, rankBounds, config) {
    const providerData = config.providers[config.activeProvider];
    const apiKey = providerData.key;
    const model = config.activeModel;
    if (!apiKey || apiKey.includes("YOUR_")) { new Notice("API Key missing in prowess_config.json", 6000); return null; }

    const FIELD_RULES = {
        vitality:        `vitality.resistance  → damage absorption threshold before injury registers (kg-f or % reduction)\nvitality.recovery    → rate of wound/tissue regeneration (severity and time)\nvitality.resilience  → resistance to status effects: poison, crushing pressure, extremes\nvitality.lifespan    → effective biological age ceiling given accelerated cellular repair\nvitality.stamina     → sustained combat output before core fatigue begins\nvitality.env         → survivable environmental extremes (temperature, pressure, vacuum)`,
        energy:          `energy.duration     → sustained output time at full draw before depletion (minutes), include chain limit\nenergy.aura         → passive ambient energy leak radius (meters) detectable by others\nenergy.burst        → maximum spike output range and joule output in a single release — KEY MUST BE "burst"`,
        speed_rank:      `speed.jump    → vertical/horizontal leap distance and hang time (F/E/D ranks — no flight yet)\nspeed.flight  → sustained flight speed, altitude ceiling, and maneuverability (C-rank and above only)`,
        perception_rank: `perception.domain → radius of total spatial awareness; ability to perceive through walls, terrain, or obscurement (A-rank and above only)`,
    };

    const currentRules = FIELD_RULES[vital] || "No specific field rules provided.";
    const lowerNote = rankBounds.lower
        ? `Lower Bound (same rank ${rank}, RV ${rankBounds.lower.v}): ${JSON.stringify(rankBounds.lower.fields)}`
        : `Lower Bound: Not available — character may be near the floor of ${rank}.`;
    const upperNote = rankBounds.upper
        ? `Upper Bound (same rank ${rank}, RV ${rankBounds.upper.v}): ${JSON.stringify(rankBounds.upper.fields)}`
        : `Upper Bound: Not available — character may be near the ceiling of ${rank}.`;

    const prompt = `WORLD_CONTEXT =
You are generating power scaling descriptions for a modern-day dark fantasy web novel.
The system measures Corebearers — humans born with energy cores who grow stronger by killing monsters.
RV (Rank Value) is the vital's numeric power level. A normal peak human = RV ~1.
Ranks ascend: F → E → D → C → B → A → S → SS → SSS.

INSTRUCTIONS:
- Use CONCRETE numbers (kg, km/h, meters, years, ms, °C, etc.).
- Use DARK and VISCERAL tone.
- SCALE LOGICALLY between the provided bounds. If a bound is missing, extrapolate from the one available.
- Both bounds are from the SAME rank tier (${rank}). Do NOT bleed into adjacent rank territory.
- For each field desc: vivid, impactful, concrete numbers, less words.

FIELD RULES FOR ${vital.toUpperCase()}:
${currentRules}

Generating: ${vital.toUpperCase()} | Rank: ${rank} | Target RV: ${targetRV}

${lowerNote}
${upperNote}

OUTPUT FORMAT: Each field must be an object with three keys:
  "value": a single representative numeric value (number type, use 0 if not applicable)
  "unit": the unit string
  "desc": vivid impactful description with concrete numbers, concise

Output strictly valid JSON. Format: {"${vital}": {fields}}. No markdown. Raw JSON only.`;

    let url, headers, body;
    if (config.activeProvider === 'aistudio') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        headers = { "Content-Type": "application/json" };
        body = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { response_mime_type: "application/json", temperature: 0.4 } });
    } else {
        url = config.activeProvider === 'groq' ? "https://api.groq.com/openai/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
        headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
        if (config.activeProvider === 'openrouter') { headers["HTTP-Referer"] = "obsidian://app"; headers["X-Title"] = "Prowess Engine"; }
        body = JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.4 });
    }
    try {
        const response = await requestUrl({ url, method: "POST", headers, body });
        let aiText = "";
        if (config.activeProvider === 'aistudio') { const candidate = response.json.candidates?.[0]; aiText = candidate.content.parts[0].text; }
        else { aiText = response.json.choices[0].message.content; }
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : aiText.trim());
    } catch (e) { console.error("Rank interpolation failed:", e); new Notice(`API Error: ${e.message}`, 8000); return null; }
}
// ─────────────────────────────────────────────────────────────
// SVG / SPRITE SYSTEM
// ─────────────────────────────────────────────────────────────

if (typeof window.ProwessJSONCache === 'undefined') { window.ProwessJSONCache = null; }
if (typeof window.ProwessBgCache   === 'undefined') { window.ProwessBgCache = {}; }

async function loadSpriteData() {
    if (window.ProwessJSONCache) return;

    if (await app.vault.adapter.exists(SPRITE_JSON_PATH)) {
        try {
            const raw = await app.vault.adapter.read(SPRITE_JSON_PATH);
            const parsed = JSON.parse(raw);
            // Version check: if any entry is missing maskHtml, cache is stale — rebuild.
            const firstKey = Object.keys(parsed)[0];
            if (firstKey && parsed[firstKey].maskHtml !== undefined) {
                window.ProwessJSONCache = parsed;
                return;
            }
            console.log("Prowess: sprite cache missing maskHtml, rebuilding...");
        } catch (e) { console.error("Failed to parse JSON sprite cache, rebuilding...", e); }
    }

    if (await app.vault.adapter.exists(SPRITE_PATH)) {
        try {
            const rawSvg = await app.vault.adapter.read(SPRITE_PATH);
            await buildSpriteCache(rawSvg);
        } catch (e) { console.error("Failed to process sprite.svg:", e); }
    }
}

async function buildSpriteCache(rawSvg) {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(rawSvg, "image/svg+xml");
    const newCache = {};
    const symbols = svgDoc.querySelectorAll('symbol, g[id]');

    const processColor = (colorStr) => {
        if (!colorStr) return null;
        let c = colorStr.toLowerCase().trim();
        if (c === 'none' || c === 'transparent') return 'none';
        if (c === 'currentcolor') return '[[BASE_COLOR]]';
        let r = 255, g = 255, b = 255;
        if (c.startsWith('#')) {
            let hex = c.replace('#', '');
            if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
            r = parseInt(hex.substring(0, 2), 16) || 0;
            g = parseInt(hex.substring(2, 4), 16) || 0;
            b = parseInt(hex.substring(4, 6), 16) || 0;
        } else if (c.startsWith('rgb')) {
            const match = c.match(/\d+/g);
            if (match && match.length >= 3) { r = parseInt(match[0], 10); g = parseInt(match[1], 10); b = parseInt(match[2], 10); }
        } else if (c === 'black') { r = 0; g = 0; b = 0; }
          else if (c === 'white') { r = 255; g = 255; b = 255; }
          else return null;

        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance <= 60)  return '[[BASE_COLOR]]';
        if (luminance >= 170) return '[[DETAIL_COLOR]]';
        const darknessPercent = 1 - (luminance / 255);
        const pct = Math.round(darknessPercent * 100);
        return `color-mix(in srgb, [[BASE_COLOR]] ${pct}%, [[DETAIL_COLOR]])`;
    };

    const STRUCTURAL_TAGS = new Set(['svg', 'defs', 'symbol', 'g', 'use', 'lineargradient', 'radialgradient', 'pattern', 'clippath', 'mask', 'filter', 'marker']);

    const handleAttribute = (attrName, rawValue, el, idMap, internalDefs) => {
        if (!rawValue) return;
        if (rawValue.includes('url(#')) {
            const updatedVal = rawValue.replace(/url\(#([^)]+)\)/g, (m, id) => idMap[id] ? `url(#${idMap[id]})` : m);
            el.setAttribute(attrName, updatedVal);
            el.style[attrName] = '';
            const gradMatch = updatedVal.match(/url\(#([^)]+)\)/);
            if (gradMatch) {
                const targetId = gradMatch[1];
                const originalId = Object.keys(idMap).find(k => idMap[k] === targetId) || targetId;
                const gradSource = svgDoc.getElementById(originalId);
                if (gradSource && !internalDefs.querySelector(`#${targetId}`)) {
                    const gradClone = gradSource.cloneNode(true);
                    gradClone.id = targetId;
                    gradClone.querySelectorAll('stop').forEach(stop => {
                        const sc = stop.getAttribute('stop-color') || stop.style.stopColor;
                        const token = processColor(sc);
                        if (token) { stop.setAttribute('stop-color', token); stop.style.stopColor = ''; }
                    });
                    internalDefs.appendChild(gradClone);
                }
            }
        } else {
            const token = processColor(rawValue);
            if (token) { el.setAttribute(attrName, token); el.style[attrName] = ''; }
        }
    };

    for (const symbol of symbols) {
        if (!symbol.id) return;
        const iconId = symbol.id;
        const clone = symbol.cloneNode(true);
        const internalDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const idMap = {};
        clone.querySelectorAll('[id]').forEach(el => {
            const oldId = el.id;
            const newId = `${oldId}_${iconId}`;
            idMap[oldId] = newId;
            el.id = newId;
        });
        clone.querySelectorAll('*').forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'stop') {
                const raw = el.getAttribute('stop-color') || el.style.stopColor || '';
                if (raw) { const token = processColor(raw); if (token) { el.setAttribute('stop-color', token); el.style.stopColor = ''; } }
                return;
            }
            const rawFill = el.getAttribute('fill') || el.style.fill;
            if (rawFill) {
                handleAttribute('fill', rawFill, el, idMap, internalDefs);
            } else if (!STRUCTURAL_TAGS.has(tag) && !el.hasAttribute('stroke') && !el.style.stroke) {
                el.setAttribute('fill', '[[BASE_COLOR]]');
            }
            const rawStroke = el.getAttribute('stroke') || el.style.stroke;
            if (rawStroke) { handleAttribute('stroke', rawStroke, el, idMap, internalDefs); }
        });
        if (internalDefs.childNodes.length > 0) clone.insertBefore(internalDefs, clone.firstChild);

        // ── Build maskHtml from the original raw symbol (no tokenization) ──
        // We work directly from the source symbol so no luminance decisions
        // have already collapsed the color structure before we read it.
        const maskClone = symbol.cloneNode(true);
        const maskLuminance = (colorStr) => {
            if (!colorStr) return null;
            const c = colorStr.toLowerCase().trim();
            if (c === 'none' || c === 'transparent') return 'transparent';
            let r = 255, g = 255, b = 255;
            if (c.startsWith('#')) {
                let hex = c.replace('#', '');
                if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
                r = parseInt(hex.substring(0, 2), 16) || 0;
                g = parseInt(hex.substring(2, 4), 16) || 0;
                b = parseInt(hex.substring(4, 6), 16) || 0;
            } else if (c.startsWith('rgb')) {
                const m2 = c.match(/\d+/g);
                if (m2 && m2.length >= 3) { r = parseInt(m2[0]); g = parseInt(m2[1]); b = parseInt(m2[2]); }
            } else if (c === 'black' || c === 'currentcolor') { r = 0; g = 0; b = 0; }
              else if (c === 'white') { r = 255; g = 255; b = 255; }
              else return null;
            // Light areas (luminance >= 170) tagged [[MASK_DETAIL]] so
            // getMaskUrl() can swap them to transparent or black per bgremove flag.
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            return lum >= 170 ? '[[MASK_DETAIL]]' : 'black';
        };
        maskClone.querySelectorAll('*').forEach(el => {
            const tag = el.tagName.toLowerCase();
            if (tag === 'stop') {
                const sc = el.getAttribute('stop-color') || el.style.stopColor || '';
                const mc = maskLuminance(sc);
                if (mc) { el.setAttribute('stop-color', mc); el.style.stopColor = ''; }
                return;
            }
            const rawFill = el.getAttribute('fill') || el.style.fill;
            if (rawFill) {
                const mc = maskLuminance(rawFill);
                if (mc) { el.setAttribute('fill', mc); el.style.fill = ''; }
            } else if (!STRUCTURAL_TAGS.has(tag) && !el.hasAttribute('stroke') && !el.style.stroke) {
                el.setAttribute('fill', 'black');
            }
            const rawStroke = el.getAttribute('stroke') || el.style.stroke;
            if (rawStroke) {
                const mc = maskLuminance(rawStroke);
                if (mc) { el.setAttribute('stroke', mc); el.style.stroke = ''; }
            }
        });

        // Auto-calculate tight zoom using canvas pixel scanning — accurate regardless of getBBox() reliability
        const iconViewBox = symbol.getAttribute('viewBox') || '0 0 2048 2048';
        const iconHtml = clone.innerHTML;
        let tightScale = 1;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 256;
            const ctx = canvas.getContext('2d');
            const svgBlob = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${iconViewBox}">${iconHtml.replaceAll('[[BASE_COLOR]]', 'black').replaceAll('[[DETAIL_COLOR]]', 'white').replace(/color-mix\([^)]+\)/g, 'black')}</svg>`;
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, 256, 256);
                    const pixels = ctx.getImageData(0, 0, 256, 256).data;
                    let minX = 256, minY = 256, maxX = 0, maxY = 0;
                    for (let y = 0; y < 256; y++) {
                        for (let x = 0; x < 256; x++) {
                            const alpha = pixels[(y * 256 + x) * 4 + 3];
                            if (alpha > 10) {
                                if (x < minX) minX = x;
                                if (x > maxX) maxX = x;
                                if (y < minY) minY = y;
                                if (y > maxY) maxY = y;
                            }
                        }
                    }
                    if (maxX > minX && maxY > minY) {
                        const contentW = (maxX - minX) / 256;
                        const contentH = (maxY - minY) / 256;
                        const fill = Math.max(contentW, contentH);
                        tightScale = Math.min(1.8, Math.max(1, Math.round((1 / fill) * 0.9 * 100) / 100));
                    }
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = `data:image/svg+xml,${encodeURIComponent(svgBlob)}`;
            });
        } catch (e) { tightScale = 1; }

        newCache[symbol.id] = {
            viewBox:    iconViewBox,
            html:       iconHtml,
            maskHtml:   maskClone.innerHTML,
            tightScale: tightScale,
        };
    }

    window.ProwessJSONCache = newCache;
    window.ProwessBgCache = {}; // invalidate render cache on rebuild
    await app.vault.adapter.write(SPRITE_JSON_PATH, JSON.stringify(newCache));
    new Notice("✦ Prowess SVG Cache Generated Successfully!");
}

// ─────────────────────────────────────────────────────────────
// ICON RENDERER — THREE MODES
// ─────────────────────────────────────────────────────────────

// Returns a data URL string for default and bgremove modes.
// Returns null for mask mode (mask mode uses CSS, not data URL).
function getColoredBgUrl(iconId, color, mode) {
    const { mask, bgremove } = mode;

    // Mask mode: no data URL needed, handled via CSS in ico()
    if (mask) return null;

    const detailColor = bgremove ? 'transparent' : '#080808';
    const cacheKey = `${iconId}_${color}_${bgremove ? 'bgr' : 'def'}`;
    if (window.ProwessBgCache[cacheKey]) return window.ProwessBgCache[cacheKey];
    if (!window.ProwessJSONCache || !window.ProwessJSONCache[iconId]) return null;

    const iconData = window.ProwessJSONCache[iconId];
    const viewBox = iconData.viewBox || '0 0 2048 2048';
    let html = iconData.html;
    html = html.replaceAll('[[BASE_COLOR]]', color);
    html = html.replaceAll('[[DETAIL_COLOR]]', detailColor);

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${html}</svg>`;
    const dataUrl = `url("data:image/svg+xml,${encodeURIComponent(svgString)}")`;
    window.ProwessBgCache[cacheKey] = dataUrl;
    return dataUrl;
}

// Returns a mask-mode data URL built from maskHtml — the raw original SVG colors,
// never tokenized — so no luminance decisions from the default pipeline affect it.
// [[MASK_DETAIL]] tokens mark originally-light areas; bgremove controls whether
// they are transparent (excluded from mask) or black (included).
function getMaskUrl(iconId, mode) {
    const { bgremove } = mode;
    const detailColor = bgremove ? 'transparent' : 'black';
    const cacheKey = `${iconId}_mask_${bgremove ? 'bgr' : 'def'}`;
    if (window.ProwessBgCache[cacheKey]) return window.ProwessBgCache[cacheKey];
    if (!window.ProwessJSONCache || !window.ProwessJSONCache[iconId]) return null;

    const iconData = window.ProwessJSONCache[iconId];
    const viewBox = iconData.viewBox || '0 0 2048 2048';
    // Use maskHtml (raw-source pass). Fall back to html if cache predates this version.
    let html = iconData.maskHtml || iconData.html;
    html = html.replaceAll('[[MASK_DETAIL]]', detailColor);
    // Fallback: if somehow old tokens remain, resolve them flat
    html = html.replaceAll('[[BASE_COLOR]]', 'black');
    html = html.replaceAll('[[DETAIL_COLOR]]', detailColor);
    html = html.replace(/color-mix\([^)]+\)/g, 'black');

    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${html}</svg>`;
    const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
    window.ProwessBgCache[cacheKey] = dataUrl;
    return dataUrl;
}

function ico(iconId, color, size = 90) {
    const mode = getIconMode(iconId);                              // ← this line is missing
    const iconData = window.ProwessJSONCache?.[iconId];
    const scale = (iconData?.tightScale || 1) * (mode.scale || 1);
    const div = document.createElement('div');
    div.style.overflow = 'hidden'; // contain the scaled icon

    if (mode.mask) {
        const maskUrl = getMaskUrl(iconId, mode);
        div.style.cssText = [
            `width:${size}px`,
            `height:${size}px`,
            `display:inline-block`,
            `vertical-align:middle`,
            `flex-shrink:0`,
            `opacity:0.95`,
            `overflow:hidden`,
            `background-color:${color}`,
            maskUrl ? `-webkit-mask-image:url("${maskUrl}")` : '',
            maskUrl ? `mask-image:url("${maskUrl}")` : '',
            `-webkit-mask-size:${scale * 100}%`,
            `mask-size:${scale * 100}%`,
            `-webkit-mask-repeat:no-repeat`,
            `mask-repeat:no-repeat`,
            `-webkit-mask-position:center`,
            `mask-position:center`,
        ].filter(Boolean).join(';');
    } else {
        const bgUrl = getColoredBgUrl(iconId, color, mode);
        div.style.cssText = [
            `width:${size}px`,
            `height:${size}px`,
            `display:inline-block`,
            `vertical-align:middle`,
            `flex-shrink:0`,
            `opacity:0.95`,
            `overflow:hidden`,
            bgUrl ? `background-image:${bgUrl}` : '',
            `background-size:${scale * 100}%`,
            `background-repeat:no-repeat`,
            `background-position:center`,
        ].filter(Boolean).join(';');
    }

    return div;
}

// ─────────────────────────────────────────────────────────────
// ROW / HEADER BUILDERS
// ─────────────────────────────────────────────────────────────

function makeRow(container, iconName, label, field, color, iconSize = 90) {
    if (!field || field === '—' || field === '') return;

    let displayText, badge;
    let secVal = null, secUnit = '', showSecondary = false;

    if (typeof field === 'object' && field !== null) {
        displayText = field.desc || '';
        if (!displayText) return;
        if (field.value !== undefined && field.value !== null && field.value !== 0) {
            badge = `${field.value}${field.unit ? ' ' + field.unit : ''}`;
        } else if (field.height !== undefined) {
            badge = field.height;
        } else if (field.speed !== undefined) {
            badge = field.altitude ? `${field.speed} · ${field.altitude}` : field.speed;
        } else if (field.radius !== undefined) {
            badge = field.radius;
        }
        // Secondary — scoped outside the if block so rendering can see it
        secVal = field.secondary_value ?? field.secondary ?? null;
        secUnit = field.secondary_unit || '';
        showSecondary = secVal !== null && secVal !== '' && !(Number.isInteger(secVal) && secVal === 0);
    } else {
        displayText = field;
    }
    if (!displayText || displayText === '—') return;

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--background-modifier-border);`;
    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `flex-shrink:0;margin-top:1px;`;
    iconWrap.appendChild(ico(iconName, color, iconSize));
    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

    const labelRow = document.createElement('div');
    labelRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const lbl = document.createElement('span');
    lbl.style.cssText = `font-size:0.68em;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};opacity:0.75;`;
    lbl.textContent = label;
    labelRow.appendChild(lbl);
    if (badge && SHOW_UNITS) {
        const badgeEl = document.createElement('span');
        badgeEl.style.cssText = `font-size:0.62em;font-weight:900;letter-spacing:0.08em;font-family:monospace;color:${color};opacity:0.9;background:rgba(255,255,255,0.04);border:1px solid ${color}33;border-radius:4px;padding:1px 5px;`;
        badgeEl.textContent = badge;
        labelRow.appendChild(badgeEl);
    }
    if (showSecondary && SHOW_UNITS) {
        const secEl = document.createElement('span');
        secEl.style.cssText = `font-size:0.62em;font-weight:900;letter-spacing:0.08em;font-family:monospace;color:${color};opacity:0.7;background:rgba(255,255,255,0.04);border:1px solid ${color}22;border-radius:4px;padding:1px 5px;`;
        secEl.textContent = `${secVal}${secUnit ? ' ' + secUnit : ''}`;
        labelRow.appendChild(secEl);
    }

    const val = document.createElement('span');
    val.style.cssText = 'font-size:0.93em;line-height:1.5;color:#E7D9B0;';
    val.textContent = displayText;
    textWrap.appendChild(labelRow);
    textWrap.appendChild(val);
    row.appendChild(iconWrap);
    row.appendChild(textWrap);
    container.appendChild(row);
}

function makeHeader(container, title, color) {
    const h = document.createElement('div');
    h.style.cssText = `font-size:1em;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${color};padding:10px 0 4px;margin-top:8px;border-bottom:2px solid ${color};opacity:0.9;`;
    h.textContent = title;
    container.appendChild(h);
}

function renderFields(container, type, f, color) {
    if (type === 'power') {
        makeRow(container, 'lift',        'Lifting Capacity',  f.lift,      color);
        makeRow(container, 'strike',      'Strike Force',      f.strike,    color);
        makeRow(container, 'impact',      'Ground Impact',     f.impact,    color);
        makeRow(container, 'control',   'Force Precision',   f.precision, color);
    }
    if (type === 'speed') {
        makeRow(container, 'burst',       'Burst Velocity',    f.burst,     color);
        makeRow(container, 'sustained',   'Sustained Speed',   f.sustained, color);
        makeRow(container, 'reaction',    'Reaction Time',     f.reaction,  color);
        makeRow(container, 'movement',    'Movement',          f.movement,  color);
    }
    if (type === 'speed_rank') {
        // rank_driven supplement: jump (F/E/D) or flight (C–SSS)
        if (f.jump)   makeRow(container, 'jump',   'Jump Capability', f.jump,   color);
        if (f.flight) makeRow(container, 'flight', 'Flight',          f.flight, color);
    }
    if (type === 'vitality') {
        makeRow(container, 'threshold',  'Damage Resistance', f.resistance,   color);
        makeRow(container, 'recovery',    'Recovery Rate',     f.recovery,     color);
        makeRow(container, 'stamina',     'Stamina',           f.stamina,      color);
        makeRow(container, 'toxin',  'Resilience',        f.resilience,   color);
        makeRow(container, 'env',         'Environmental',     f.environmental, color);
        makeRow(container, 'lifespan',    'Lifespan',          f.lifespan,     color);
    }
    if (type === 'perception') {
        makeRow(container, 'sight',       'Sight Range',       f.sight,      color);
        makeRow(container, 'hearing',     'Hearing',           f.hearing,    color);
        makeRow(container, 'aware',       'Spatial Awareness', f.awareness,  color);
        makeRow(container, 'intuition',   'Combat Intuition',  f.intuition,  color);
        makeRow(container, 'processing',  'Processing Limit',  f.processing, color);
    }
    if (type === 'perception_rank') {
        // rank_driven supplement: domain (A–SSS only)
        if (f.domain) makeRow(container, 'domain', 'Domain',          f.domain, color);
    }
    if (type === 'energy') {
        makeRow(container, 'duration',    'Ability Duration',  f.duration, color);
        makeRow(container, 'aura',        'Aura Projection',   f.aura,     color);
        makeRow(container, 'burst_eruption','Burst Capacity',    f.burst,    color);
    }
}

// ─────────────────────────────────────────────────────────────
// SETTINGS PANEL
// Triggered by clicking "// PROWESS METRICS OVERVIEW" heading.
// ─────────────────────────────────────────────────────────────

function buildSettingsPanel(parentContainer, currentModes, currentShowUnits, onSave, onSaveShowUnits, onRecache) {
    // Overlay backdrop
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position:fixed; top:0; left:0; right:0; bottom:0;
        background:rgba(0,0,0,0.75);
        z-index:9998;
        backdrop-filter:blur(3px);
        -webkit-backdrop-filter:blur(3px);
    `;

    // Panel
    const panel = document.createElement('div');
    panel.style.cssText = `
        position:fixed; bottom:0; left:0; right:0;
        max-height:80vh;
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
        display:flex; align-items:center; justify-content:space-between;
        padding:14px 18px 10px;
        border-bottom:1px solid #1e1e28;
        flex-shrink:0;
    `;
    const panelTitle = document.createElement('span');
    panelTitle.style.cssText = `font-size:0.72em;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#5b8af0;`;
    panelTitle.textContent = '⚙ ICON RENDER MODES';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `background:none;border:none;color:#666;font-size:1.1em;cursor:pointer;padding:4px 8px;line-height:1;`;
    closeBtn.onclick = () => { overlay.remove(); panel.remove(); };
    panelHead.appendChild(panelTitle);
    panelHead.appendChild(closeBtn);
    panel.appendChild(panelHead);

    // ── Recache Button ──
    const recacheWrap = document.createElement('div');
    recacheWrap.style.cssText = `padding:10px 18px 8px;flex-shrink:0;border-bottom:1px solid #1e1e28;`;
    const recacheBtn = document.createElement('button');
    recacheBtn.textContent = '↺  REBUILD SPRITE CACHE';
    recacheBtn.style.cssText = `
        width:100%; padding:10px;
        background:rgba(91,138,240,0.08);
        border:1px solid #5b8af0;
        border-radius:8px;
        color:#5b8af0;
        font-size:0.72em; font-weight:900; letter-spacing:0.14em;
        cursor:pointer;
    `;
    recacheBtn.onclick = async () => {
        recacheBtn.textContent = '⌛  REBUILDING...';
        recacheBtn.disabled = true;
        await onRecache();
        recacheBtn.textContent = '✓  CACHE REBUILT';
        setTimeout(() => {
            recacheBtn.textContent = '↺  REBUILD SPRITE CACHE';
            recacheBtn.disabled = false;
        }, 2000);
    };
    recacheWrap.appendChild(recacheBtn);
    panel.appendChild(recacheWrap);

    // ── Show Units Toggle ──
    const unitsWrap = document.createElement('div');
    unitsWrap.style.cssText = `padding:10px 18px 10px;flex-shrink:0;border-bottom:1px solid #1e1e28;display:flex;align-items:center;justify-content:space-between;`;
    const unitsLabel = document.createElement('span');
    unitsLabel.style.cssText = `font-size:0.68em;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#9a9aaa;`;
    unitsLabel.textContent = 'SHOW UNITS';
    const unitsSubLabel = document.createElement('span');
    unitsSubLabel.style.cssText = `font-size:0.58em;font-weight:600;letter-spacing:0.04em;color:#444;display:block;margin-top:1px;`;
    unitsSubLabel.textContent = 'value badge next to field label';
    const unitsLabelWrap = document.createElement('div');
    unitsLabelWrap.appendChild(unitsLabel);
    unitsLabelWrap.appendChild(unitsSubLabel);

    let showUnitsState = currentShowUnits;
    const unitsTrack = document.createElement('div');
    const unitsThumb = document.createElement('div');
    const applyUnitsStyle = () => {
        unitsTrack.style.cssText = `width:42px;height:22px;border-radius:11px;cursor:pointer;position:relative;background:${showUnitsState ? '#5b8af0' : '#1e1e2a'};border:1px solid ${showUnitsState ? '#5b8af0' : '#2e2e3e'};flex-shrink:0;`;
        unitsThumb.style.cssText = `position:absolute;top:3px;left:${showUnitsState ? '21px' : '3px'};width:14px;height:14px;border-radius:50%;background:${showUnitsState ? 'white' : '#444'};`;
    };
    applyUnitsStyle();
    unitsTrack.appendChild(unitsThumb);
    unitsTrack.onclick = async () => {
        showUnitsState = !showUnitsState;
        applyUnitsStyle();
        await onSaveShowUnits(showUnitsState);
    };
    unitsWrap.appendChild(unitsLabelWrap);
    unitsWrap.appendChild(unitsTrack);
    panel.appendChild(unitsWrap);

    // ── Column Headers ──
    const colHead = document.createElement('div');
    colHead.style.cssText = `
        display:grid;
        grid-template-columns:1fr 64px 64px;
        gap:6px;
        padding:6px 18px 4px;
        flex-shrink:0;
    `;
    ['ICON', 'MASK', 'BGREMV'].forEach((label, i) => {
        const c = document.createElement('span');
        c.style.cssText = `font-size:0.6em;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#444;${i > 0 ? 'text-align:center;' : ''}`;
        c.textContent = label;
        colHead.appendChild(c);
    });
    panel.appendChild(colHead);

    // ── Scrollable Icon List ──
    const list = document.createElement('div');
    list.style.cssText = `overflow-y:auto;flex:1;padding:0 18px 20px;`;

    // Work on a mutable copy so changes don't auto-save until toggle
    const workingModes = JSON.parse(JSON.stringify(currentModes));

    const allIconIds = Object.keys(ICON_MODES_DEFAULT);

    allIconIds.forEach(iconId => {
        const row = document.createElement('div');
        row.style.cssText = `
            display:grid;
            grid-template-columns:1fr 64px 64px;
            gap:6px;
            align-items:center;
            padding:7px 0;
            border-bottom:1px solid #16161e;
        `;

        // Icon name
        const nameEl = document.createElement('span');
        nameEl.style.cssText = `font-size:0.78em;font-weight:600;letter-spacing:0.04em;color:#9a9aaa;font-family:monospace;`;
        nameEl.textContent = iconId;
        row.appendChild(nameEl);

        // Toggle builder
        const makeToggle = (flagKey) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = `display:flex;justify-content:center;`;

            const track = document.createElement('div');
            const isOn = () => workingModes[iconId]?.[flagKey] ?? false;

            const applyStyle = () => {
                const on = isOn();
                track.style.cssText = `
                    width:42px; height:22px;
                    border-radius:11px;
                    cursor:pointer;
                    position:relative;
                    transition:background 0.2s;
                    background:${on ? '#5b8af0' : '#1e1e2a'};
                    border:1px solid ${on ? '#5b8af0' : '#2e2e3e'};
                    flex-shrink:0;
                `;
                thumb.style.cssText = `
                    position:absolute;
                    top:3px;
                    left:${on ? '21px' : '3px'};
                    width:14px; height:14px;
                    border-radius:50%;
                    background:${on ? 'white' : '#444'};
                    transition:left 0.2s, background 0.2s;
                `;
            };

            const thumb = document.createElement('div');
            applyStyle();
            track.appendChild(thumb);

            track.onclick = async () => {
                if (!workingModes[iconId]) workingModes[iconId] = { mask: false, bgremove: false };
                workingModes[iconId][flagKey] = !workingModes[iconId][flagKey];
                applyStyle();
                // Invalidate BG cache for this icon so next render uses new mode
                Object.keys(window.ProwessBgCache).forEach(k => {
                    if (k.startsWith(iconId + '_')) delete window.ProwessBgCache[k];
                });
                await onSave(workingModes);
            };

            wrap.appendChild(track);
            return wrap;
        };

        row.appendChild(makeToggle('mask'));
        row.appendChild(makeToggle('bgremove'));
        list.appendChild(row);
    });

    panel.appendChild(list);

    // ── Note at bottom ──
    const note = document.createElement('div');
    note.style.cssText = `padding:8px 18px 6px;flex-shrink:0;border-top:1px solid #1e1e28;`;
    const noteText = document.createElement('span');
    noteText.style.cssText = `font-size:0.6em;color:#333;letter-spacing:0.04em;`;
    noteText.textContent = 'MASK: fill icon with vital color  ·  BGREMV: strip light/white areas  ·  Both can be active together';
    note.appendChild(noteText);
    panel.appendChild(note);

    overlay.onclick = () => { overlay.remove(); panel.remove(); };
    panel.onclick = (e) => e.stopPropagation();

    document.body.appendChild(overlay);
    document.body.appendChild(panel);
}

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────

async function renderProwess(container, rvMap) {
    await loadSpriteData();

    // Load icon mode overrides and merge with defaults
    const savedModes = await loadFile(ICON_MODES_PATH, {});
    ICON_MODES = { ...ICON_MODES_DEFAULT };
    Object.keys(savedModes).forEach(id => {
        if (id === 'showUnits') return;
        ICON_MODES[id] = { ...{ mask: false, bgremove: false }, ...savedModes[id] };
    });
    SHOW_UNITS = savedModes.showUnits !== undefined ? savedModes.showUnits : true;

    container.innerHTML = '';
    container.style.cssText = 'font-family:var(--font-text);padding:4px 0;will-change:transform;transform:translateZ(0);';

    const config = await loadFile(CONFIG_PATH, null);
    if (!config) { container.createEl('div', { text: "⚠️ prowess_config.json not found." }); return; }

    const baseFile     = await loadFile(BASE_PATH, null);
    const currentCache = await loadFile(CACHE_PATH, { power: [], speed: [], perception: [], vitality: [], energy: [], speed_rank: [], perception_rank: [] });

    // Stat-driven types use numeric RV lookup; rank-driven use the character rank string.
    const STAT_TYPES  = ['power', 'speed', 'perception'];
    const COLORS = { power: '#c0392b', speed: '#2980b9', vitality: '#27ae60', perception: '#8e44ad', energy: '#d35400' };
    const TITLES = { power: '① POWER', speed: '② SPEED', vitality: '③ VITALITY', perception: '④ PERCEPTION', energy: '⑤ ENERGY' };

    // Normalize the character's rank (e.g. "F+++", "A-rank", "SS") → "F-rank", "A-rank", "SS-rank"
    const charRank = normalizeRank(rvMap.rank);

    // ── Missing stats: stat_driven (power / speed / perception) ──
    let missingStats = [];
    for (const type of STAT_TYPES) {
        if (rvMap[type] === undefined) continue;
        const rv = Math.round(rvMap[type] * 10) / 10;
        const baseData = getBaseData(type, baseFile);
        const merged = [...baseData, ...(currentCache[type] || [])].sort((a, b) => a.v - b.v);
        const bounds = findBounds(merged, rv);
        if (!bounds.exact) missingStats.push({ type, cacheKey: type, rv, bounds, isRankDriven: false });
    }

    // ── Missing stats: rank_driven (vitality / energy / speed_rank / perception_rank) ──
    // Each supplement uses the parent stat's RV as its lookup value.
    const RANK_DRIVEN = [
        { type: 'vitality',        cacheKey: 'vitality',        baseKey: 'vitality',   rvKey: 'vitality'   },
        { type: 'energy',          cacheKey: 'energy',          baseKey: 'energy',     rvKey: 'energy'     },
        { type: 'speed_rank',      cacheKey: 'speed_rank',      baseKey: 'speed',      rvKey: 'speed'      },
        { type: 'perception_rank', cacheKey: 'perception_rank', baseKey: 'perception', rvKey: 'perception' },
    ];
    if (charRank) {
        for (const { type, cacheKey, baseKey, rvKey } of RANK_DRIVEN) {
            if (rvMap[rvKey] === undefined) continue;
            const targetV = Math.round(rvMap[rvKey] * 10) / 10;
            const baseEntries  = getRankData(baseKey, baseFile).filter(e => e.rank === charRank);
            const cacheEntries = (currentCache[cacheKey] || []).filter(e => e.rank === charRank);
            const allEntries   = [...baseEntries, ...cacheEntries].sort((a, b) => a.v - b.v);
            const rankBounds   = findBoundsInRank(allEntries, targetV);
            if (!rankBounds.exact) missingStats.push({ type, cacheKey, rv: targetV, bounds: rankBounds, isRankDriven: true, rank: charRank });
        }
    }

    if (missingStats.length > 0) {
        const banner = container.createEl('div');
        banner.style.cssText = "background:rgba(20,20,25,0.7);border:1px solid #3b82f6;padding:15px;border-radius:12px;margin-bottom:20px;box-shadow:0 4px 15px rgba(0,0,0,0.5);";
        const apiRow = banner.createEl('div');
        apiRow.style.cssText = "display:flex;gap:8px;margin-bottom:12px;";
        const selectStyle = "background:#1a1a1a;color:#E7D9B0;border:1px solid #3b82f6;border-radius:6px;padding:6px 10px;font-size:0.75em;font-weight:bold;font-family:monospace;cursor:pointer;flex:1;";
        const providerSelect = apiRow.createEl('select');
        providerSelect.style.cssText = selectStyle;
        Object.keys(config.providers).forEach(p => providerSelect.add(new Option(p.toUpperCase(), p)));
        providerSelect.value = config.activeProvider;
        const modelSelect = apiRow.createEl('select');
        modelSelect.style.cssText = selectStyle + "flex:2;";
        const updateModelOptions = () => {
            modelSelect.innerHTML = '';
            config.providers[providerSelect.value].models.forEach(m => modelSelect.add(new Option(m, m)));
            if (config.providers[providerSelect.value].models.includes(config.activeModel)) modelSelect.value = config.activeModel;
            else modelSelect.value = config.providers[providerSelect.value].models[0];
        };
        const persistChange = async () => {
            config.activeProvider = providerSelect.value;
            config.activeModel = modelSelect.value;
            await app.vault.adapter.write(CONFIG_PATH, JSON.stringify(config, null, 2));
        };
        providerSelect.onchange = async () => { updateModelOptions(); await persistChange(); };
        modelSelect.onchange = async () => { await persistChange(); };
        updateModelOptions();
        const vitalRow = banner.createEl('div');
        vitalRow.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;";
        let selectedVitalIndex = 0;
        missingStats.forEach((m, idx) => {
            const pill = vitalRow.createEl('button');
            const label = m.isRankDriven
                ? `${m.type.toUpperCase()}<br><span style="opacity:0.5;font-size:0.75em;">${m.rank}</span><br>RV ${m.rv}`
                : `${m.type.toUpperCase()}<br>RV ${m.rv}`;
            pill.innerHTML = `<span style="opacity:0.6;font-size:0.8em;">${label}</span>`;
            const setStyle = (el, active) => { el.style.cssText = `padding:8px;border-radius:8px;border:1px solid #3b82f6;cursor:pointer;font-size:0.7em;font-weight:bold;transition:all 0.2s;text-align:center;line-height:1.4;background:${active ? '#3b82f6' : 'rgba(59,130,246,0.05)'};color:${active ? 'white' : '#3b82f6'};box-shadow:${active ? '0 0 10px rgba(59,130,246,0.4)' : 'none'};`; };
            setStyle(pill, idx === 0);
            pill.onclick = () => { selectedVitalIndex = idx; Array.from(vitalRow.children).forEach((child, i) => setStyle(child, i === selectedVitalIndex)); };
        });
        const btn = banner.createEl('button', { text: "⚡ WEAVE CORE DATA" });
        btn.style.cssText = "background:linear-gradient(90deg,#1d4ed8,#3b82f6);color:white;border:none;padding:12px;border-radius:8px;cursor:pointer;font-weight:900;width:100%;letter-spacing:2px;text-shadow:0 2px 4px rgba(0,0,0,0.3);";
        btn.onclick = async () => {
            btn.textContent = "⌛ WEAVING...";
            btn.disabled = true;
            const target = missingStats[selectedVitalIndex];

            if (target.isRankDriven) {
                // ── rank_driven path ──
                const result = await generateRankMissing(target.type, target.rank, target.rv, target.bounds, config);
                if (result && result[target.type]) {
                    if (!currentCache[target.cacheKey]) currentCache[target.cacheKey] = [];
                    currentCache[target.cacheKey].push({ v: target.rv, rank: target.rank, fields: result[target.type] });
                    currentCache[target.cacheKey].sort((a, b) => a.v - b.v);
                    await saveProwessCache(currentCache);
                    new Notice(`[DEVOUR] ${target.type.toUpperCase()} (${target.rank}) successfully mapped.`);
                }
            } else {
                // ── stat_driven path ──
                const result = await generateSingleMissing(target.type, target.rv, target.bounds, config);
                if (result && result[target.type]) {
                    currentCache[target.type].push({ v: target.rv, fields: result[target.type] });
                    currentCache[target.type].sort((a, b) => a.v - b.v);
                    await saveProwessCache(currentCache);
                    new Notice(`[DEVOUR] ${target.type.toUpperCase()} successfully mapped.`);

                    // ── Auto-chain rank supplement if this stat has one ──
                    const supplementKey = target.type === 'speed' ? 'speed_rank'
                                        : target.type === 'perception' ? 'perception_rank'
                                        : null;
                    if (supplementKey && charRank) {
                        btn.textContent = "⌛ WEAVING SUPPLEMENT...";
                        const baseKey = target.type; // speed_rank reads from speed base, etc.
                        const suppEntries = [
                            ...getRankData(baseKey, baseFile),
                            ...(currentCache[supplementKey] || [])
                        ].filter(e => e.rank === charRank).sort((a, b) => a.v - b.v);
                        const suppBounds = findBoundsInRank(suppEntries, target.rv);
                        if (!suppBounds.exact) {
                            const suppResult = await generateRankMissing(supplementKey, charRank, target.rv, suppBounds, config);
                            if (suppResult && suppResult[supplementKey]) {
                                if (!currentCache[supplementKey]) currentCache[supplementKey] = [];
                                currentCache[supplementKey].push({ v: target.rv, rank: charRank, fields: suppResult[supplementKey] });
                                currentCache[supplementKey].sort((a, b) => a.v - b.v);
                                await saveProwessCache(currentCache);
                                new Notice(`[DEVOUR] ${supplementKey.toUpperCase()} (${charRank}) auto-mapped.`);
                            }
                        }
                    }
                }
            }
            renderProwess(container, rvMap);
        };
    }

    // ── PROWESS METRICS OVERVIEW heading — click to open settings ──
    const overviewHead = document.createElement('div');
    overviewHead.style.cssText = `
        font-size:0.62em;
        font-weight:900;
        letter-spacing:0.2em;
        text-transform:uppercase;
        color:#2a2a38;
        padding:6px 0 10px;
        cursor:pointer;
        user-select:none;
        transition:color 0.2s;
    `;
    overviewHead.textContent = '// PROWESS METRICS OVERVIEW';
    overviewHead.onmouseenter = () => overviewHead.style.color = '#3d3d52';
    overviewHead.onmouseleave = () => overviewHead.style.color = '#2a2a38';
    overviewHead.onclick = () => {
        buildSettingsPanel(
            container,
            ICON_MODES,
            SHOW_UNITS,
            async (newModes) => {
                // Save only the icons that differ from defaults
                const toSave = {};
                Object.keys(newModes).forEach(id => {
                    const m = newModes[id] || { mask: false, bgremove: false };
                    const d = ICON_MODES_DEFAULT[id] || { mask: false, bgremove: false };
                    if (m.mask !== d.mask || m.bgremove !== d.bgremove) toSave[id] = m;
                });
                // Preserve showUnits when saving icon modes
                const existing = await loadFile(ICON_MODES_PATH, {});
                if (existing.showUnits !== undefined) toSave.showUnits = existing.showUnits;
                await saveIconModes(toSave);
                ICON_MODES = { ...ICON_MODES_DEFAULT, ...newModes };
            },
            async (newShowUnits) => {
                // Save showUnits alongside existing icon modes
                const existing = await loadFile(ICON_MODES_PATH, {});
                existing.showUnits = newShowUnits;
                await saveIconModes(existing);
                SHOW_UNITS = newShowUnits;
            },
            async () => {
                // Recache: delete sprite JSON, clear memory caches, rebuild
                window.ProwessJSONCache = null;
                window.ProwessBgCache = {};
                try { await app.vault.adapter.remove(SPRITE_JSON_PATH); } catch (e) {}
                if (await app.vault.adapter.exists(SPRITE_PATH)) {
                    const rawSvg = await app.vault.adapter.read(SPRITE_PATH);
                    await buildSpriteCache(rawSvg);
                } else {
                    new Notice("⚠ sprite.svg not found.", 5000);
                }
            }
        );
    };
    container.appendChild(overviewHead);

    // ── ① POWER — stat_driven ──
    if (rvMap.power !== undefined) {
        const rv = Math.round(rvMap.power * 10) / 10;
        const merged = [...getBaseData('power', baseFile), ...(currentCache.power || [])].sort((a, b) => a.v - b.v);
        const bounds = findBounds(merged, rv);
        let headerText = `${TITLES.power}  —  RV ${rv}`;
        if (!bounds.exact && bounds.nearest) headerText += ` (Showing RV ${bounds.nearest.v})`;
        makeHeader(container, headerText, COLORS.power);
        const entry = bounds.exact || bounds.nearest;
        if (entry) renderFields(container, 'power', entry.fields, COLORS.power);
    }

    // ── ② SPEED — stat_driven + rank_driven supplement ──
    if (rvMap.speed !== undefined) {
        const rv = Math.round(rvMap.speed * 10) / 10;
        const merged = [...getBaseData('speed', baseFile), ...(currentCache.speed || [])].sort((a, b) => a.v - b.v);
        const bounds = findBounds(merged, rv);
        let headerText = `${TITLES.speed}  —  RV ${rv}`;
        if (!bounds.exact && bounds.nearest) headerText += ` (Showing RV ${bounds.nearest.v})`;
        makeHeader(container, headerText, COLORS.speed);
        const entry = bounds.exact || bounds.nearest;
        if (entry) renderFields(container, 'speed', entry.fields, COLORS.speed);
        // rank_driven supplement: jump (F/E/D) or flight (C–SSS) — merged with cache
        if (charRank) {
            const rankEntries = [
                ...getRankData('speed', baseFile),
                ...(currentCache.speed_rank || [])
            ].filter(e => e.rank === charRank);
            const rankEntry = nearestInRank(rankEntries, rv);
            if (rankEntry) renderFields(container, 'speed_rank', rankEntry.fields, COLORS.speed);
        }
    }

    // ── ③ VITALITY — rank_driven ──
    if (charRank) {
        const allEntries = [
            ...getRankData('vitality', baseFile),
            ...(currentCache.vitality || [])
        ].filter(e => e.rank === charRank).sort((a, b) => a.v - b.v);
        if (allEntries.length > 0) {
            const targetV = rvMap.vitality !== undefined ? Math.round(rvMap.vitality * 10) / 10 : null;
            const entry = targetV !== null ? nearestInRank(allEntries, targetV) : allEntries[allEntries.length - 1];
            let headerText = `${TITLES.vitality}  —  RV ${targetV}`;
            if (targetV !== null && entry && entry.v !== targetV) headerText += ` (Showing RV ${entry.v})`;
            makeHeader(container, headerText, COLORS.vitality);
            if (entry) renderFields(container, 'vitality', entry.fields, COLORS.vitality);
        }
    }

    // ── ④ PERCEPTION — stat_driven + rank_driven supplement ──
    if (rvMap.perception !== undefined) {
        const rv = Math.round(rvMap.perception * 10) / 10;
        const merged = [...getBaseData('perception', baseFile), ...(currentCache.perception || [])].sort((a, b) => a.v - b.v);
        const bounds = findBounds(merged, rv);
        let headerText = `${TITLES.perception}  —  RV ${rv}`;
        if (!bounds.exact && bounds.nearest) headerText += ` (Showing RV ${bounds.nearest.v})`;
        makeHeader(container, headerText, COLORS.perception);
        const entry = bounds.exact || bounds.nearest;
        if (entry) renderFields(container, 'perception', entry.fields, COLORS.perception);
        // rank_driven supplement: domain (A–SSS only) — merged with cache
        if (charRank) {
            const rankEntries = [
                ...getRankData('perception', baseFile),
                ...(currentCache.perception_rank || [])
            ].filter(e => e.rank === charRank);
            const rankEntry = nearestInRank(rankEntries, rv);
            if (rankEntry) renderFields(container, 'perception_rank', rankEntry.fields, COLORS.perception);
        }
    }

    // ── ⑤ ENERGY — rank_driven ──
    if (charRank) {
        const allEntries = [
            ...getRankData('energy', baseFile),
            ...(currentCache.energy || [])
        ].filter(e => e.rank === charRank).sort((a, b) => a.v - b.v);
        if (allEntries.length > 0) {
            const targetV = rvMap.energy !== undefined ? Math.round(rvMap.energy * 10) / 10 : null;
            const entry = targetV !== null ? nearestInRank(allEntries, targetV) : allEntries[allEntries.length - 1];
            let headerText = `${TITLES.energy}  —  RV ${targetV}`;
            if (targetV !== null && entry && entry.v !== targetV) headerText += ` (Showing RV ${entry.v})`;
            makeHeader(container, headerText, COLORS.energy);
            if (entry) renderFields(container, 'energy', entry.fields, COLORS.energy);
        }
    }
}

renderProwess(container, rvMap);

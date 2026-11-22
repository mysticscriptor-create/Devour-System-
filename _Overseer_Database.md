---
obsidianUIMode: preview
cssclasses:
  - performance-mode
  - full-page-db
---

```dataviewjs
// ============================================================
// DIMENSIONAL OVERSEER — CENTRAL DATABASE v7.2 (OVERLAY + FIXES)
// REQUIRES: dimensional-overseer.css snippet enabled
// v7.2 FIXES:
//   1. Overlay now stays in sync after UPDATE — local page object is
//      updated directly with confirmed saved values, bypassing Dataview
//      cache latency that caused stale re-renders & flickering dropdowns
// v7.1 FIXES:
//   1. Dropdown backdrop z-index raised above overlay (9999→10001)
//   2. ovRenderInFlight set BEFORE processFrontMatter prevents
//      Dataview auto-refresh race condition
//   3. Vital bars: Dormant tier added; stats below F-rank now
//      render correctly with F-rank as ceiling
//   4. Click-outside-dropdown now properly closes menu inside overlay
//   5. Full scale-mode picker (Full Spectrum / Next Tier / Next Rank)
//      ported from stable non-overlay build
// ============================================================

// ─────────────────────────────────────────────────────────────
// CUSTOM DROPDOWN HELPER
// ─────────────────────────────────────────────────────────────
function makeDropdown(id, options, currentValue, onChange, accentColor) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ov-dd';
    wrapper.id = id;
    const trigger = document.createElement('div');
    trigger.className = 'ov-dd-trigger';
    if (accentColor) trigger.style.borderColor = accentColor + '60';
    let selected = options.find(o => o.value === currentValue) || options[0];
    trigger.textContent = selected.label;
    Object.defineProperty(wrapper, 'value', {
        get: () => selected.value,
        set: (v) => { const m = options.find(o => o.value === v); if (m) { selected = m; trigger.textContent = m.label; } }
    });
    let backdropEl = null, menuEl = null;
    const closeMenu = () => {
        if (backdropEl) { backdropEl.remove(); backdropEl = null; }
        if (menuEl)     { menuEl.remove();     menuEl = null; }
        trigger.classList.remove('open');
    };
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (menuEl) { closeMenu(); return; }
        trigger.classList.add('open');
        backdropEl = document.createElement('div');
        backdropEl.className = 'ov-dd-backdrop';
        backdropEl.style.cssText = 'position:fixed;inset:0;z-index:10001;';
        backdropEl.addEventListener('click', closeMenu);
        document.body.appendChild(backdropEl);
        menuEl = document.createElement('div');
        menuEl.className = 'ov-dd-menu';
        menuEl.style.zIndex = '10002';
        const rect = trigger.getBoundingClientRect();
        const menuWidth = Math.max(rect.width, 180) + 'px';
        if (window.innerHeight - rect.bottom > 200) {
            menuEl.style.top = rect.bottom + 4 + 'px'; menuEl.style.left = rect.left + 'px'; menuEl.style.width = menuWidth;
        } else {
            menuEl.style.bottom = (window.innerHeight - rect.top + 4) + 'px'; menuEl.style.left = rect.left + 'px'; menuEl.style.width = menuWidth;
        }
        options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'ov-dd-option' + (opt.value === selected.value ? ' selected' : '');
            if (opt.color)                                        item.style.color = opt.color;
            else if (opt.value === selected.value && accentColor) item.style.color = accentColor;
            item.textContent = opt.label;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                selected = opt;
                trigger.textContent = opt.label;
                if (opt.color) trigger.style.color = opt.color;
                else           trigger.style.color = '';
                closeMenu();
                if (accentColor) trigger.style.borderColor = accentColor + '60';
                if (onChange) onChange(opt.value);
            });
            menuEl.appendChild(item);
        });
        document.body.appendChild(menuEl);
    });
    wrapper.appendChild(trigger);
    return wrapper;
}

// ─────────────────────────────────────────────────────────────
// DATA STRUCTURES
// ─────────────────────────────────────────────────────────────
const RANKS = [
    { rank: "Dormant-1", val: 1,      euPerKill: 1,         euRequired: 0,              tier: "Dormant" },
    { rank: "Dormant-2", val: 2,      euPerKill: 2,         euRequired: 0,              tier: "Dormant" },
    { rank: "Dormant-3", val: 3,      euPerKill: 3,         euRequired: 0,              tier: "Dormant" },
    { rank: "F\u2212",       val: 8,       euPerKill: 8,         euRequired: 0,              tier: "F" },
    { rank: "F",        val: 10,      euPerKill: 15,        euRequired: 104464,         tier: "F" },
    { rank: "F+",       val: 13,      euPerKill: 22,        euRequired: 104464,         tier: "F" },
    { rank: "F++",      val: 16,      euPerKill: 30,        euRequired: 104464,         tier: "F" },
    { rank: "F+++",     val: 20,      euPerKill: 50,        euRequired: 125357,         tier: "F" },
    { rank: "E\u2212",       val: 21,      euPerKill: 60,        euRequired: 125357,         tier: "E" },
    { rank: "E",        val: 30,      euPerKill: 80,        euRequired: 1035714,        tier: "E" },
    { rank: "E+",       val: 37,      euPerKill: 130,       euRequired: 1035714,        tier: "E" },
    { rank: "E++",      val: 44,      euPerKill: 170,       euRequired: 1035714,        tier: "E" },
    { rank: "E+++",     val: 50,      euPerKill: 200,       euRequired: 1242857,        tier: "E" },
    { rank: "D\u2212",       val: 51,      euPerKill: 220,       euRequired: 1242857,        tier: "D" },
    { rank: "D",        val: 100,     euPerKill: 350,       euRequired: 6845238,        tier: "D" },
    { rank: "D+",       val: 160,     euPerKill: 500,       euRequired: 6845238,        tier: "D" },
    { rank: "D++",      val: 230,     euPerKill: 650,       euRequired: 6845238,        tier: "D" },
    { rank: "D+++",     val: 300,     euPerKill: 800,       euRequired: 8214286,        tier: "D" },
    { rank: "C\u2212",       val: 301,     euPerKill: 900,       euRequired: 8214286,        tier: "C" },
    { rank: "C",        val: 800,     euPerKill: 1400,      euRequired: 38333333,       tier: "C" },
    { rank: "C+",       val: 1050,    euPerKill: 2000,      euRequired: 38333333,       tier: "C" },
    { rank: "C++",      val: 1250,    euPerKill: 2600,      euRequired: 38333333,       tier: "C" },
    { rank: "C+++",     val: 1500,    euPerKill: 3200,      euRequired: 46000000,       tier: "C" },
    { rank: "B\u2212",       val: 1501,    euPerKill: 3800,      euRequired: 46000000,       tier: "B" },
    { rank: "B",        val: 2500,    euPerKill: 6000,      euRequired: 337857143,      tier: "B" },
    { rank: "B+",       val: 2900,    euPerKill: 9000,      euRequired: 337857143,      tier: "B" },
    { rank: "B++",      val: 3200,    euPerKill: 12000,     euRequired: 337857143,      tier: "B" },
    { rank: "B+++",     val: 3500,    euPerKill: 16000,     euRequired: 405428571,      tier: "B" },
    { rank: "A\u2212",       val: 3501,    euPerKill: 20000,     euRequired: 405428571,      tier: "A" },
    { rank: "A",        val: 5000,    euPerKill: 35000,     euRequired: 3571428571,     tier: "A" },
    { rank: "A+",       val: 6500,    euPerKill: 60000,     euRequired: 3571428571,     tier: "A" },
    { rank: "A++",      val: 8000,    euPerKill: 90000,     euRequired: 3571428571,     tier: "A" },
    { rank: "A+++",     val: 10000,   euPerKill: 115000,    euRequired: 4285714286,     tier: "A" },
    { rank: "S\u2212",       val: 10001,   euPerKill: 140000,    euRequired: 4285714286,     tier: "S" },
    { rank: "S",        val: 15000,   euPerKill: 250000,    euRequired: 50000000000,    tier: "S" },
    { rank: "S+",       val: 25000,   euPerKill: 450000,    euRequired: 50000000000,    tier: "S" },
    { rank: "S++",      val: 37000,   euPerKill: 700000,    euRequired: 50000000000,    tier: "S" },
    { rank: "S+++",     val: 50000,   euPerKill: 1000000,   euRequired: 60000000000,    tier: "S" },
    { rank: "SS\u2212",      val: 50001,   euPerKill: 1300000,   euRequired: 60000000000,    tier: "SS" },
    { rank: "SS",       val: 70000,   euPerKill: 2500000,   euRequired: 982142857143,   tier: "SS" },
    { rank: "SS+",      val: 130000,  euPerKill: 5000000,   euRequired: 982142857143,   tier: "SS" },
    { rank: "SS++",     val: 210000,  euPerKill: 8000000,   euRequired: 982142857143,   tier: "SS" },
    { rank: "SS+++",    val: 300000,  euPerKill: 12000000,  euRequired: 1178571428571,  tier: "SS" },
    { rank: "SSS",      val: 400000,  euPerKill: 20000000,  euRequired: 17261904761905, tier: "SSS" },
    { rank: "SSS+",     val: 600000,  euPerKill: 40000000,  euRequired: 17261904761905, tier: "SSS" },
    { rank: "SSS++",    val: 900000,  euPerKill: 80000000,  euRequired: 17261904761905, tier: "SSS" },
    { rank: "SSS+++",   val: 1500000, euPerKill: 150000000, euRequired: 20714285714286, tier: "SSS" }
];

const POTENTIALS = [
    { name: "F-Core", maxRankTier: "D", maxIdx: 15, mult: 1.0 },
    { name: "E-Core", maxRankTier: "C", maxIdx: 20, mult: 1.5 },
    { name: "D-Core", maxRankTier: "B", maxIdx: 25, mult: 2.0 },
    { name: "C-Core", maxRankTier: "A", maxIdx: 30, mult: 2.5 },
    { name: "B-Core", maxRankTier: "S", maxIdx: 35, mult: 3.0 },
    { name: "A-Core", maxRankTier: "SS", maxIdx: 40, mult: 3.75 },
    { name: "S-Core", maxRankTier: "SSS", maxIdx: 44, mult: 4.5 },
    { name: "SS-Core", maxRankTier: "SSS", maxIdx: 44, mult: 5.5 },
    { name: "SSS-Core", maxRankTier: "SSS+++", maxIdx: 44, mult: 6.5 }
];

const MAX_DAILY_LIMITS = {
    "Dormant": 15, "F": 15, "E": 20, "D": 25, "C": 15,
    "B": 10, "A": 7, "S": 4, "SS": 4, "SSS": 4
};

const TIER_COLOR = {
    Dormant:"#5e7a96", F:"#7bb4cc", E:"#55d490", D:"#4fa8ff",
    C:"#b650ff", B:"#e3ab2b", A:"#ff4a2b", S:"#ff1a1a",
    SS:"#ff1ad9", SSS:"#ff0044"
};
const TIER_GLOW = {
    Dormant:"rgba(94,122,150,0.4)",  F:"rgba(123,180,204,0.5)", E:"rgba(85,212,144,0.5)",
    D:"rgba(79,168,255,0.5)",        C:"rgba(182,80,255,0.6)",  B:"rgba(227,171,43,0.6)",
    A:"rgba(255,74,43,0.7)",         S:"rgba(255,26,26,0.8)",   SS:"rgba(255,26,217,0.8)",
    SSS:"rgba(255,0,68,0.9)"
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const STRIP_HTML = /<[^>]+>/g;
const PERSONAL_REGEX = /%%PERSONAL_START%%([\s\S]*?)%%PERSONAL_ENDS%%/;

function normalizeRank(r) { return r ? r.toUpperCase().replace(/-/g,'\u2212') : "Dormant"; }
function getRankData(r)   { return RANKS.find(v=>v.rank===normalizeRank(r)) || RANKS[0]; }
function getRankVal(r)    { return getRankData(r).val; }
function getTier(r)       { return getRankData(r).tier; }

function parseColors(str) {
    if (!str || typeof str !== 'string') return str;
    return str.replace(/\[c:([^\]]+)\](.*?)\[\/c\]/gi, '<span style="color:$1; font-weight:bold; text-shadow:0 0 5px $140;">$2</span>');
}

function getRankFromValue(val) {
    let highest = RANKS[0].rank;
    for (let i = 0; i < RANKS.length; i++) {
        if (val >= RANKS[i].val) {
            highest = RANKS[i].rank;
        } else {
            break;
        }
    }
    if (highest.startsWith('Dormant-')) return 'Dormant';
    return highest;
}

function getRankFromValueRaw(val) {
    let highest = RANKS[0].rank;
    for (let i = 0; i < RANKS.length; i++) {
        if (val >= RANKS[i].val) {
            highest = RANKS[i].rank;
        } else {
            break;
        }
    }
    return highest; // keeps Dormant-1 / Dormant-2 / Dormant-3
}

function calculateVitals(rankValue, coreReach) {
    if (!coreReach) return null;
    const reach = coreReach.toLowerCase();
    const rv = rankValue;

    if (reach.includes("origin")) {
        const v = Number((rv*0.20).toFixed(2));
        return { power:v, speed:v, perception:v, vitality:v, energy:v };
    }

    let w = null;
    if (reach.includes("substance")) w = { vitality:0.34, power:0.24, energy:0.18, perception:0.14, speed:0.10 };
    else if (reach.includes("force"))     w = { power:0.32, speed:0.26, perception:0.16, energy:0.14, vitality:0.12 };
    else if (reach.includes("space"))     w = { perception:0.34, speed:0.24, energy:0.20, vitality:0.13, power:0.09 };
    else if (reach.includes("mind"))      w = { perception:0.35, energy:0.28, vitality:0.16, speed:0.12, power:0.09 };
    else if (reach.includes("soul"))      w = { vitality:0.36, energy:0.26, perception:0.18, power:0.12, speed:0.08 };
    else if (reach.includes("time"))      w = { speed:0.32, perception:0.28, energy:0.20, vitality:0.13, power:0.07 };
    else if (reach.includes("void"))      w = { energy:0.38, perception:0.30, speed:0.16, vitality:0.10, power:0.06 };
    else return null;

    return {
        power:      Number((rv * w.power).toFixed(2)),
        speed:      Number((rv * w.speed).toFixed(2)),
        perception: Number((rv * w.perception).toFixed(2)),
        vitality:   Number((rv * w.vitality).toFixed(2)),
        energy:     Number((rv * w.energy).toFixed(2))
    };
}

function getImages(p) {
    if (Array.isArray(p.profile_images) && p.profile_images.length > 0) return p.profile_images;
    if (p.profile_image) return [p.profile_image];
    return [];
}
function getCurrentIdx(p) { return Math.max(0, parseInt(p.profile_image_index) || 0); }

async function saveProfileImage(file, notePath, cleanId) {
    const folder = "_corebearers_assets";
    if (!app.vault.getAbstractFileByPath(folder)) await app.vault.createFolder(folder);
    const ext = file.name.split('.').pop();
    const assetPath = `${folder}/${cleanId}_${Date.now()}.${ext}`;
    const ab = await file.arrayBuffer();
    await app.vault.createBinary(assetPath, ab);
    await app.fileManager.processFrontMatter(
        app.vault.getAbstractFileByPath(notePath),
        fm => {
            if (!fm.profile_images) fm.profile_images = fm.profile_image ? [fm.profile_image] : [];
            fm.profile_images.push(assetPath);
            fm.profile_image_index = fm.profile_images.length - 1;
            fm.profile_image = assetPath;
        }
    );
    return assetPath;
}

async function loadImgSrc(vaultPath) {
    if (!vaultPath) return null;
    try {
        const file = app.vault.getAbstractFileByPath(vaultPath);
        if (!file) return null;
        return app.vault.getResourcePath(file);
    } catch(e) { return null; }
}

function fmtNum(n) {
    if (n>=1e12) return (n/1e12).toFixed(2)+'T';
    if (n>=1e9)  return (n/1e9).toFixed(2)+'B';
    if (n>=1e6)  return (n/1e6).toFixed(2)+'M';
    if (n>=1e3)  return (n/1e3).toFixed(1)+'K';
    return String(Math.round(n*10)/10);
}


// ─────────────────────────────────────────────────────────────
// SIGIL CACHE SYSTEM
// ─────────────────────────────────────────────────────────────
const SIGIL_CACHE_PATH = "overseer_sigil_cache.json";
const SIGIL_SIZES = [16, 20, 22, 35];
const SIGIL_VERSION = Object.values(TIER_COLOR).join('');
if (typeof window.OvSigilCache === 'undefined') { window.OvSigilCache = null; }

function tierSigil(tier, size = 20) {
    const c = TIER_COLOR[tier] || "#6e6880";
    const g = TIER_GLOW[tier]  || "rgba(110,104,128,0.4)";
    const s = size, h = s / 2;
    const glow = `filter:drop-shadow(0 0 5px ${g})`;
    if (tier === "Dormant") return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><circle cx="${h}" cy="${h}" r="${h-2}" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.75"/><circle cx="${h}" cy="${h}" r="2.5" fill="${c}" opacity="0.65"/></svg>`;
    if (tier === "SSS")     return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><polygon points="${h},1.5 ${s-1.5},${h} ${h},${s-1.5} 1.5,${h}" fill="${c}" opacity="0.95"/><polygon points="${h},5 ${s-5},${h} ${h},${s-5} 5,${h}" fill="#0b0e17"/><circle cx="${h}" cy="${h}" r="3" fill="${c}"/></svg>`;
    if (tier === "SS")      return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><polygon points="${h},1.5 ${s-1.5},${h} ${h},${s-1.5} 1.5,${h}" fill="${c}" opacity="0.9"/><polygon points="${h},5.5 ${s-5.5},${h} ${h},${s-5.5} 5.5,${h}" fill="#0b0e17"/><circle cx="${h}" cy="${h}" r="2.5" fill="${c}"/></svg>`;
    if (tier === "S")       return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><polygon points="${h},2 ${s-2},${h} ${h},${s-2} 2,${h}" fill="${c}" opacity="0.85"/><polygon points="${h},6 ${s-6},${h} ${h},${s-6} 6,${h}" fill="#0b0e17"/><circle cx="${h}" cy="${h}" r="2" fill="${c}"/></svg>`;
    if (tier === "A")       return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><polygon points="${h},2.5 ${s-2.5},${s-2.5} 2.5,${s-2.5}" fill="${c}" opacity="0.8"/><polygon points="${h},6 ${s-6},${s-6} 6,${s-6}" fill="#0b0e17"/></svg>`;
    if (tier === "B")       return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><rect x="2.5" y="2.5" width="${s-5}" height="${s-5}" fill="${c}" opacity="0.75"/><rect x="6" y="6" width="${s-12}" height="${s-12}" fill="#0b0e17"/></svg>`;
    if (tier === "C")       return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><circle cx="${h}" cy="${h}" r="${h-2.5}" fill="${c}" opacity="0.7"/><circle cx="${h}" cy="${h}" r="${h-5.5}" fill="#0b0e17"/></svg>`;
    if (tier === "D")       return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><polygon points="${h},${s-2.5} 2.5,2.5 ${s-2.5},2.5" fill="${c}" opacity="0.65"/><polygon points="${h},${s-6} 6,6 ${s-6},6" fill="#0b0e17"/></svg>`;
    if (tier === "E")       return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><rect x="3.5" y="3.5" width="${s-7}" height="${s-7}" fill="${c}" opacity="0.6" transform="rotate(45 ${h} ${h})"/><rect x="6.5" y="6.5" width="${s-13}" height="${s-13}" fill="#0b0e17" transform="rotate(45 ${h} ${h})"/></svg>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" style="${glow}"><circle cx="${h}" cy="${h}" r="${h-3.5}" fill="${c}" opacity="0.5"/></svg>`;
}

async function buildSigilCache() {
    const tiers = Object.keys(TIER_COLOR);
    const cache = { _version: SIGIL_VERSION, sigils: {} };
    for (const tier of tiers) {
        cache.sigils[tier] = {};
        for (const size of SIGIL_SIZES) {
            cache.sigils[tier][size] = tierSigil(tier, size);
        }
    }
    await app.vault.adapter.write(SIGIL_CACHE_PATH, JSON.stringify(cache));
    window.OvSigilCache = cache.sigils;
    console.log(`[Overseer] Sigil cache built — ${tiers.length} tiers x ${SIGIL_SIZES.length} sizes.`);
}

async function loadSigilCache() {
    if (window.OvSigilCache) return;
    try {
        if (await app.vault.adapter.exists(SIGIL_CACHE_PATH)) {
            const raw  = await app.vault.adapter.read(SIGIL_CACHE_PATH);
            const data = JSON.parse(raw);
            if (data._version === SIGIL_VERSION && data.sigils) {
                window.OvSigilCache = data.sigils;
                return;
            }
            console.log("[Overseer] Sigil cache stale (color change detected), rebuilding...");
        }
    } catch (e) {
        console.error("[Overseer] Sigil cache read failed, rebuilding:", e);
    }
    await buildSigilCache();
}

function tierSigilCached(tier, size = 20) {
    if (window.OvSigilCache?.[tier]?.[size] !== undefined) {
        return window.OvSigilCache[tier][size];
    }
    const svg = tierSigil(tier, size);
    if (window.OvSigilCache) {
        if (!window.OvSigilCache[tier]) window.OvSigilCache[tier] = {};
        window.OvSigilCache[tier][size] = svg;
    }
    return svg;
}

// ─────────────────────────────────────────────────────────────
// DATA FETCH
// ─────────────────────────────────────────────────────────────
const pages = dv.pages('"character"').map(p => ({
    page: p,
    name: p.name || p.file.name,
    rank: p.rank || "Dormant",
    normalizedRank: normalizeRank(p.rank || "Dormant"),
    rankVal: getRankVal(p.rank || "Dormant"),
    reach: parseColors(p.core_reach) || "\u2014",
    gender: p.gender || "\u2014",
    status: parseColors(p.status) || "\u2014",
    ica: p.ica_status || "\u2014"
}));
const allReaches = [...new Set(pages.map(p=>p.reach.replace(STRIP_HTML, '')).filter(r=>r!=="\u2014"))].sort();

// ─────────────────────────────────────────────────────────────
// BUILD ROOT
// ─────────────────────────────────────────────────────────────
const container = dv.el("div","",{cls:"ov-root"});

function getScroller() {
    const overlay = document.getElementById('ov-detail-overlay');
    if (overlay) return overlay;
    let el = container.parentElement;
    while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const oy = style.overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
    }
    return document.documentElement;
}

const cornerSVG=`<svg width="22" height="22" viewBox="0 0 22 22"><path d="M0 0 L22 0 L22 2 L2 2 L2 22 L0 22 Z" fill="#00d2ff" opacity="0.8"/><circle cx="4" cy="4" r="1.5" fill="#fff" opacity="0.9"/></svg>`;
['tl','tr','bl','br'].forEach(pos=>{
    const d=document.createElement('div');
    d.className=`ov-corner ov-corner-${pos}`; d.innerHTML=cornerSVG;
    container.appendChild(d);
});

const header=document.createElement('div');
header.className='ov-header';
const headerTitleEl = document.createElement('div');
headerTitleEl.className = 'ov-header-title';
headerTitleEl.textContent = 'DIMENSIONAL OVERSEER';

const headerSubtitleEl = document.createElement('div');
headerSubtitleEl.className = 'ov-header-subtitle';
headerSubtitleEl.textContent = 'PRIMAL EXPANSE REGISTRY';

const headerRight = document.createElement('div');
headerRight.className = 'ov-header-right';
headerRight.innerHTML = `
    <div class="ov-header-cl">CLEARANCE: OMEGA-\u221e</div>
    <div class="ov-header-meta">INDEXED: <span class="ov-highlight">${pages.length}</span> SUBJECTS</div>
`;

const modeSwitcher = document.createElement('div');
modeSwitcher.className = 'ov-mode-switch';
modeSwitcher.style.cssText = `
    display: flex;
    gap: 2px;
    background: #0f1420;
    border: 1px solid #1e2535;
    border-radius: 3px;
    padding: 2px;
    margin-top: 8px;
    width: fit-content;
`;

const overseerTab = document.createElement('div');
overseerTab.className = 'ov-mode-tab active';
overseerTab.textContent = 'OVERSEER';
overseerTab.style.cssText = `
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 0.7em;
    letter-spacing: 2px;
    padding: 6px 14px;
    cursor: pointer;
    color: #c8d8f0;
    background: #1a2d4a;
    border-radius: 2px;
    transition: all 0.2s;
`;

const lmcaTab = document.createElement('div');
lmcaTab.className = 'ov-mode-tab';
lmcaTab.textContent = 'LMCA';
lmcaTab.style.cssText = overseerTab.style.cssText;
lmcaTab.style.background = 'transparent';
lmcaTab.style.color = '#5e7a96';

modeSwitcher.appendChild(overseerTab);
modeSwitcher.appendChild(lmcaTab);

header.appendChild(headerTitleEl);
header.appendChild(headerSubtitleEl);
header.appendChild(modeSwitcher);
header.appendChild(headerRight);
container.appendChild(header);

// ── MODE SWITCHING LOGIC ────────────────────────────────────
let currentMode = 'overseer';
let overseerBody = null;
let lmcaModule = null;

async function switchMode(mode) {
    if (mode === currentMode) return;
    currentMode = mode;

    if (mode === 'overseer') {
        overseerTab.style.background = '#1a2d4a';
        overseerTab.style.color = '#c8d8f0';
        overseerTab.classList.add('active');
        lmcaTab.style.background = 'transparent';
        lmcaTab.style.color = '#5e7a96';
        lmcaTab.classList.remove('active');

        if (window.LMCA) window.LMCA.unmount();

        if (overseerBody) {
            body.innerHTML = '';
            while (overseerBody.firstChild) {
                body.appendChild(overseerBody.firstChild);
            }
            overseerBody = null;
        }

        headerTitleEl.textContent = 'DIMENSIONAL OVERSEER';
        headerSubtitleEl.textContent = 'PRIMAL EXPANSE REGISTRY';

    } else if (mode === 'lmca') {
        lmcaTab.style.background = '#1a2d4a';
        lmcaTab.style.color = '#c8d8f0';
        lmcaTab.classList.add('active');
        overseerTab.style.background = 'transparent';
        overseerTab.style.color = '#5e7a96';
        overseerTab.classList.remove('active');

        overseerBody = document.createElement('div');
        while (body.firstChild) {
            overseerBody.appendChild(body.firstChild);
        }

        if (!lmcaModule) lmcaModule = await loadLMCA();
        if (lmcaModule) {
            lmcaModule.render(body, headerTitleEl, headerSubtitleEl);
        } else {
            body.innerHTML = '<div style="padding:40px;text-align:center;color:#5e7a96;font-family:Share Tech Mono,monospace;">[ LMCA MODULE NOT FOUND ]</div><div style="padding:20px;text-align:center;color:#3a4e64;font-size:0.7em;font-family:Share Tech Mono,monospace;">Ensure LMCA.js exists at Meta/Scripts/LMCA.js</div>';
        }
    }
}

overseerTab.addEventListener('click', () => switchMode('overseer'));
lmcaTab.addEventListener('click', () => switchMode('lmca'));

const body=document.createElement('div');
body.className='ov-body';
container.appendChild(body);

// ── LIST PANE ──────────────────────────────────────────────────
const listDiv=document.createElement('div');
listDiv.className='ov-list';

const controls=document.createElement('div');
controls.className='ov-controls';
const searchInput = document.createElement('input');
searchInput.type = 'text';
searchInput.id = 'ov-search';
searchInput.placeholder = '\u2305 INITIATE SUBJECT QUERY...';
controls.appendChild(searchInput);

const row1 = document.createElement('div');
row1.className = 'ov-ctrl-row';

const sortDd = makeDropdown('ov-sort', [
    { value: 'rank-desc', label: 'POWER TIER \u25BC' },
    { value: 'rank-asc',  label: 'POWER TIER \u25B2' },
    { value: 'name-asc',  label: 'DESIGNATION A\u2192Z' },
], 'rank-desc', debouncedRender);

const reachDd = makeDropdown('ov-reach',
    [{ value: 'all', label: 'ALL REACHES' },
     ...allReaches.map(r => ({ value: r, label: r.toUpperCase() }))],
    'all', debouncedRender);

row1.appendChild(sortDd);
row1.appendChild(reachDd);
controls.appendChild(row1);

const row2 = document.createElement('div');
row2.className = 'ov-ctrl-row';

const rankDd = makeDropdown('ov-rank-filter',
    [{ value: 'all', label: 'ALL RANKS' },
     ...RANKS.map(r => ({ value: r.rank, label: r.rank }))],
    'all', debouncedRender);

const statusDd = makeDropdown('ov-status-filter', [
    { value: 'all',      label: 'ALL STATUS' },
    { value: 'Active',   label: 'ACTIVE' },
    { value: 'Inactive', label: 'INACTIVE' },
    { value: 'Deceased', label: 'DECEASED' },
    { value: 'Unknown',  label: 'UNKNOWN' },
], 'all', debouncedRender);

row2.appendChild(rankDd);
row2.appendChild(statusDd);
controls.appendChild(row2);
listDiv.appendChild(controls);

const listCount=document.createElement('div');
listCount.className='ov-list-count'; listCount.id='ov-count';
listDiv.appendChild(listCount);

const itemsWrap=document.createElement('div');
itemsWrap.className='ov-items';
listDiv.appendChild(itemsWrap);
body.appendChild(listDiv);

// ── DETAIL PANE ────────────────────────────────────────────────
const detailDiv=document.createElement('div');
detailDiv.className='ov-detail ov-hidden';

const backBtn=document.createElement('button');
backBtn.className='ov-back-btn';
backBtn.innerHTML='\u25C4 TERMINATE UPLINK & RETURN';
backBtn.addEventListener('click',()=>{
    window.ovActiveSubjectPath = null;
    const overlay = document.getElementById('ov-detail-overlay');
    if (overlay) {
        body.appendChild(detailDiv);
        detailDiv.classList.add('ov-hidden');
        overlay.remove();
    } else {
        detailDiv.classList.add('ov-hidden');
    }
    container.querySelectorAll('.ov-item').forEach(i=>i.classList.remove('active'));
});
detailDiv.appendChild(backBtn);

const detailContent=document.createElement('div');
detailContent.className='ov-detail-content';
detailDiv.appendChild(detailContent);
body.appendChild(detailDiv);


// ── LIGHTBOX ────────────────────────────────────────────────────
function openLightbox(images, idx, tColor, tGlow) {
    let _lbIdx=idx;
    const existing=container.querySelector('.ov-lightbox');
    if (existing) existing.remove();

    const lb=document.createElement('div');
    lb.className='ov-lightbox';

    const backdrop=document.createElement('div');
    backdrop.className='ov-lightbox-backdrop';
    lb.appendChild(backdrop);

    const inner=document.createElement('div');
    inner.className='ov-lightbox-inner';

    const closeBtn=document.createElement('div');
    closeBtn.className='ov-lightbox-close';
    closeBtn.textContent='\u00d7';

    const prevBtn=document.createElement('div');
    prevBtn.className='ov-lightbox-prev';
    prevBtn.innerHTML='\u2039';

    const nextBtn=document.createElement('div');
    nextBtn.className='ov-lightbox-next';
    nextBtn.innerHTML='\u203a';

    const imgEl=document.createElement('img');
    imgEl.style.borderColor=tColor;
    imgEl.style.boxShadow=`0 0 40px ${tGlow}`;

    inner.appendChild(closeBtn);
    if (images.length>1) { inner.appendChild(prevBtn); inner.appendChild(nextBtn); }
    inner.appendChild(imgEl);
    lb.appendChild(inner);
    container.appendChild(lb);

    async function showLbImg(i) {
        _lbIdx=((i%images.length)+images.length)%images.length;
        imgEl.style.opacity='0.3';
        const src=await loadImgSrc(images[_lbIdx]);
        if (src) imgEl.src=src;
        imgEl.style.opacity='1';
    }
    showLbImg(_lbIdx);

    const closeLb=()=>lb.remove();
    closeBtn.addEventListener('click', e=>{ e.stopPropagation(); closeLb(); });
    backdrop.addEventListener('click', closeLb);
    prevBtn.addEventListener('click', e=>{ e.stopPropagation(); showLbImg(_lbIdx-1); });
    nextBtn.addEventListener('click', e=>{ e.stopPropagation(); showLbImg(_lbIdx+1); });
}

// ── GENDER SILHOUETTE PLACEHOLDER ─────────────────────────────
function getGenderSilhouette(gender, c = '#6e6880') {
    const g = (gender || '').toLowerCase();
    if (g === 'female' || g === 'f' || g === 'woman' || g === 'girl') {
        return `<svg viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;opacity:0.30;">
            <ellipse cx="18" cy="8.5" rx="6.5" ry="7" fill="${c}"/>
            <path d="M9,23 Q11,14 15,13 Q16.5,12 18,12 Q19.5,12 21,13 Q25,14 27,23 Q29.5,33 26,38 Q22,42 18,42 Q14,42 10,38 Q6.5,33 9,23Z" fill="${c}"/>
            <rect x="10.5" y="40" width="5.5" height="8" rx="2.5" fill="${c}"/>
            <rect x="20" y="40" width="5.5" height="8" rx="2.5" fill="${c}"/>
        </svg>`;
    }
    return `<svg viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;opacity:0.30;">
        <ellipse cx="18" cy="8.5" rx="7" ry="7.5" fill="${c}"/>
        <path d="M6,23 Q9,13 13,12 Q15,11 18,11 Q21,11 23,12 Q27,13 30,23 Q32,32 29,37 Q25,41 18,41 Q11,41 7,37 Q4,32 6,23Z" fill="${c}"/>
        <rect x="9.5" y="39" width="6.5" height="9" rx="2.5" fill="${c}"/>
        <rect x="20" y="39" width="6.5" height="9" rx="2.5" fill="${c}"/>
    </svg>`;
}

// ── RENDER LIST ────────────────────────────────────────────────
function renderList() {
    itemsWrap.innerHTML='';
    const q  =(searchInput.value||'').toLowerCase();
    const st = sortDd.value||'rank-desc';
    const rt = reachDd.value||'all';
    const rk = normalizeRank(rankDd.value||'all');
    const sk = statusDd.value||'all';

    let filtered=pages.filter(p=>{
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (rt!=='all' && p.reach.replace(STRIP_HTML, '')!==rt) return false;
        if (rk!=='ALL' && p.normalizedRank!==rk) return false;
        if (sk!=='all' && p.status.replace(STRIP_HTML, '')!==sk) return false;
        return true;
    });
    filtered.sort((a,b)=>{
        if (st==='rank-desc') return b.rankVal-a.rankVal;
        if (st==='rank-asc')  return a.rankVal-b.rankVal;
        return a.name.localeCompare(b.name);
    });
    listCount.textContent=`DETECTED ${filtered.length} / ${pages.length} CORES`;

    const fragment = document.createDocumentFragment();
    filtered.forEach(pData=>{
        const tier   =getTier(pData.rank);
        const tColor =TIER_COLOR[tier]||'#6e6880';
        const rawStatus = (pData.status||'').replace(STRIP_HTML, '').toLowerCase();
        const stClass=rawStatus==='active'?'s-active':rawStatus==='deceased'?'s-deceased':'s-inactive';
        const isReg  =(pData.ica||'').toLowerCase()==='registered';

        const item=document.createElement('div');
        item.className='ov-item';
        item.style.borderLeftColor=tColor;
        item.style.boxShadow=`inset 3px 0 12px ${tColor}18`;

        const sigilEl=document.createElement('div');
        sigilEl.className='ov-item-sigil';
        sigilEl.innerHTML=tierSigilCached(tier,22);

        const bodyEl=document.createElement('div');
        bodyEl.className='ov-item-body';
        bodyEl.innerHTML=`
            <span class="ov-item-name">${pData.name}</span>
            <div class="ov-item-tags">
                <span class="ov-item-rank" style="color:${tColor};border-color:${tColor}50;text-shadow:0 0 5px ${tColor}80">${pData.rank}</span>
                ${pData.reach!=='\u2014'?`<span class="ov-item-reach">${pData.reach}</span>`:''}
                ${pData.status!=='\u2014'?`<span class="ov-item-status ${stClass}">${pData.status.toUpperCase()}</span>`:''}
            </div>`;

        const rightEl=document.createElement('div');
        rightEl.className='ov-item-right';
        rightEl.innerHTML=`
            <span class="ov-item-gender">${pData.gender}</span>
            <span class="ov-item-ica ${isReg?'reg':'unreg'}">${isReg?'REG':'UNREG'}</span>`;

        item.appendChild(sigilEl);
        item.appendChild(bodyEl);
        item.appendChild(rightEl);

        const imgs=getImages(pData.page);
        if (imgs.length>0) {
            loadImgSrc(imgs[getCurrentIdx(pData.page)]).then(src=>{
                if (!src) return;
                const img=document.createElement('img');
                img.src=src;
                img.className='ov-item-thumb';
                img.style.cssText=`width:36px;height:48px;object-fit:cover;border-radius:3px;border:1px solid ${tColor}80;flex-shrink:0;`;
                item.style.gridTemplateColumns='26px 36px 1fr auto';
                item.insertBefore(img,bodyEl);
            });
        } else {
            const sil = document.createElement('div');
            sil.style.cssText = `width:36px;height:48px;border-radius:3px;border:1px solid ${tColor}40;flex-shrink:0;background:rgba(0,0,0,0.25);overflow:hidden;`;
            sil.innerHTML = getGenderSilhouette(pData.gender, tColor);
            item.style.gridTemplateColumns = '26px 36px 1fr auto';
            item.insertBefore(sil, bodyEl);
        }

        item.addEventListener('click',()=>{
            window.ovActiveSubjectPath = pData.page.file.path;
            window.ovScrollPosition = 0;
            
            container.querySelectorAll('.ov-item').forEach(i=>i.classList.remove('active'));
            item.classList.add('active');
            
            const overlay = document.createElement('div');
            overlay.className = 'ov-detail-overlay ov-root';
            overlay.id = 'ov-detail-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-ms-overflow-style:none;box-sizing:border-box !important;';
            
            detailDiv.classList.remove('ov-hidden');
            overlay.appendChild(detailDiv);
            document.body.appendChild(overlay);
            
            renderDetail(pData.page,item).then(() => {
                overlay.scrollTop = 0;
            });
        });
        fragment.appendChild(item);
    });
    itemsWrap.appendChild(fragment);
}
let _renderDebounce = null;
function debouncedRender() {
    clearTimeout(_renderDebounce);
    _renderDebounce = setTimeout(renderList, 120);
}
searchInput.addEventListener('input', debouncedRender);
await loadSigilCache();

// ── LOAD LMCA MODULE ────────────────────────────────────────
let lmcaLoaded = false;
async function loadLMCA() {
    if (lmcaLoaded || window.LMCA) return window.LMCA;
    try {
        const file = app.vault.getAbstractFileByPath("Meta/Scripts/LMCA.js");
        if (!file) { console.log("[Overseer] LMCA.js not found at Meta/Scripts/LMCA.js"); return null; }
        const content = await app.vault.cachedRead(file);
        const fn = new Function('dv', 'app', 'makeDropdown', 'fmtNum', 'STRIP_HTML', 'parseColors', 'getScroller', content);
        fn(dv, app, makeDropdown, fmtNum, STRIP_HTML, parseColors, getScroller);
        lmcaLoaded = true;
        console.log("[Overseer] LMCA module loaded");
        return window.LMCA;
    } catch (e) {
        console.error("[Overseer] LMCA load failed:", e);
        return null;
    }
}

renderList();


// ── RENDER DETAIL ──────────────────────────────────────────────
function updateListItem(listItem, rank) {
    if (!listItem) return;
    const tier   = getTier(rank);
    const tColor = TIER_COLOR[tier] || '#6e6880';
    listItem.style.borderLeftColor = tColor;
    listItem.style.boxShadow = `inset 3px 0 12px ${tColor}18`;
    const sigilEl = listItem.querySelector('.ov-item-sigil');
    if (sigilEl) sigilEl.innerHTML = tierSigilCached(tier, 22);
    const rankEl = listItem.querySelector('.ov-item-rank');
    if (rankEl) { rankEl.textContent = rank || 'Dormant'; rankEl.style.color = tColor; }
}

async function renderDetail(p, listItem) {
    const filePath =p.file.path;
    const cleanId  =p.file.name.replace(/[^a-zA-Z0-9]/g,'_');
    const currentEU=p.current_energy_units||0;
    const rankData =getRankData(p.rank);
    const rankIdx  =RANKS.indexOf(rankData);
    const targetEU =p.breakthrough_target||rankData.euRequired||0;
    const pct      =targetEU>0?Math.min(100,(currentEU/targetEU)*100).toFixed(1):100;
    const base     =p.vitals||{power:0,speed:0,perception:0,vitality:0,energy:0};

    const scroller = getScroller();

    function captureDetailOpenState() {
        const q = s => detailContent.querySelector(s);
        const state = {
            cleanId,
            scroll:    scroller.scrollTop,
            calc:      q(`#calc-${cleanId}`)?.style.display === 'block',
            sim:       q(`#sim-container-${cleanId}`)?.style.display === 'block',
            simToggle: q(`#sim-toggle-${cleanId}`)?.classList.contains('active'),
            prow:      q(`#prow-container-${cleanId}`)?.style.display === 'block',
            prowToggle:q(`#prow-toggle-${cleanId}`)?.classList.contains('active'),
        };
        window.ovSectionState = state;
        window.ovScrollPosition = state.scroll;
        return state;
    }

    async function reRenderKeepState(updatedPage, preState) {
        const state = preState || captureDetailOpenState();
        window.ovRenderInFlight = true;
        scroller.style.overflowAnchor = 'none';
        await renderDetail(updatedPage, listItem);
        requestAnimationFrame(() => {
            const q = s => detailContent.querySelector(s);
            if (state.calc) {
                const el = q(`#calc-${cleanId}`);
                if (el) el.style.display = 'block';
            }
            if (state.sim) {
                const el = q(`#sim-container-${cleanId}`);
                const tg = q(`#sim-toggle-${cleanId}`);
                if (el) el.style.display = 'block';
                if (tg && state.simToggle) tg.classList.add('active');
            }
            if (state.prow) {
                const el = q(`#prow-container-${cleanId}`);
                const tg = q(`#prow-toggle-${cleanId}`);
                if (el) el.style.display = 'block';
                if (tg && state.prowToggle) tg.classList.add('active');
            }
            scroller.style.overflowAnchor = '';
            window.ovRenderInFlight = false;
        });
    }

    // File Content Extraction for Personal Block
    const fileObj = app.vault.getAbstractFileByPath(filePath);
    const fileContent = await app.vault.cachedRead(fileObj);
    const match = fileContent.match(PERSONAL_REGEX);
    
    let personalHTML = '';
    if (match) {
        const rawData = match[1].trim().split('\n');
        let personalGridHTML = '';
        rawData.forEach(line => {
            if (line.trim() === '') return;
            const colonIdx = line.indexOf(':');
            if (colonIdx > -1) {
                let key = line.substring(0, colonIdx).trim();
                let val = line.substring(colonIdx + 1).trim();
                val = val.replace(/^\[(.*)\]$/, '$1').replace(/^"(.*)"$/, '$1');
                val = parseColors(val);
                key = key.replace(/_/g, ' ');
                personalGridHTML += `<div><span class="ov-field-label">${key}</span><span class="ov-field-val">${val || '\u2014'}</span></div>`;
            }
        });
        
        personalHTML = `
        <div class="ov-divider" style="margin-top: 20px;"></div>
        <div class="ov-section" id="personal-section-${cleanId}">
            <div class="ov-section-title" id="personal-toggle-${cleanId}" style="cursor:pointer; color:#b650ff; display:flex; justify-content:space-between; user-select:none;">
                <span>// CLASSIFIED DOSSIER</span><span style="font-size:0.8em;">\u25BC</span>
            </div>
            <div class="ov-info-grid" id="personal-content-${cleanId}" style="display:none; margin-top:10px; border-left: 2px solid #b650ff; padding-left: 10px; background: rgba(182,80,255,0.05);">
                ${personalGridHTML}
            </div>
        </div>`;
    }

    const synDeltas = {
        power:      (0.05*base.vitality)+(0.02*base.energy),
        speed:      (0.03*base.power)+(0.04*base.energy),
        vitality:   (0.05*base.energy),
        perception: (0.04*base.energy),
        energy:     0
    };
    const postSyn = {
        power:      base.power+synDeltas.power,
        speed:      base.speed+synDeltas.speed,
        vitality:   base.vitality+synDeltas.vitality,
        perception: base.perception+synDeltas.perception,
        energy:     base.energy
    };
    const boosts = {
        power:      parseFloat(p.pwr_boost)||0,
        speed:      parseFloat(p.spd_boost)||0,
        vitality:   parseFloat(p.vit_boost)||0,
        perception: parseFloat(p.prc_boost)||0,
        energy:     parseFloat(p.eng_boost)||0
    };
    const finalVitals = {
        power:      Number((postSyn.power*(1+boosts.power/100)).toFixed(2)),
        speed:      Number((postSyn.speed*(1+boosts.speed/100)).toFixed(2)),
        vitality:   Number((postSyn.vitality*(1+boosts.vitality/100)).toFixed(2)),
        perception: Number((postSyn.perception*(1+boosts.perception/100)).toFixed(2)),
        energy:     Number((postSyn.energy*(1+boosts.energy/100)).toFixed(2))
    };

    const tier   =getTier(p.rank);
    const tColor =TIER_COLOR[tier]||'#6e6880';
    const tGlow  =TIER_GLOW[tier]||'rgba(110,104,128,0.4)';

    const images       =getImages(p);
    let   imgIdx       =getCurrentIdx(p);
    let   currentImgSrc=images.length>0 ? await loadImgSrc(images[imgIdx]) : null;

    const vColors={power:'#ff3b3b',speed:'#00d2ff',vitality:'#00ff88',perception:'#d400ff',energy:'#ffb700'};

    // ── CALCULATION FOR ASSIMILATION REGISTRY ──
    const totalKills = p.kills || (p.kill_log && typeof p.kill_log === 'object' ? Object.values(p.kill_log).reduce((a,b)=>a+b, 0) : 0);
    let killRows='';
    if (p.kill_log&&typeof p.kill_log==='object') {
        const entries=Object.entries(p.kill_log).filter(([,c])=>c>0).sort((a,b)=>getRankVal(b[0])-getRankVal(a[0]));
        if (entries.length) {
            killRows=entries.map(([rank,count])=>{
                const rd=RANKS.find(r=>r.rank===normalizeRank(rank));
                return `<tr>
                    <td class="kl-rank" style="color:${TIER_COLOR[rd?.tier||'Dormant']};text-shadow:0 0 5px ${TIER_COLOR[rd?.tier||'Dormant']}80">${rank}</td>
                    <td class="kl-count">${fmtNum(count)}</td>
                    <td style="color:var(--text-dim)">${rd?fmtNum(rd.euPerKill):'\u2014'}</td>
                </tr>`;
            }).join('');
        }
    }
    const registryHTML = `
      <div class="ov-section registry-section">
        <div class="ov-section-title">// ASSIMILATION REGISTRY</div>
        <div class="total-kills-badge" style="font-size: 0.8em; color: #a3a8b5; margin-bottom: 8px;">
          Total Creatures Killed: <span style="color: #ffb700; font-weight: bold;">${fmtNum(totalKills)}</span>
        </div>
        <div class="kill-log-container">
          ${killRows ? `<table class="ov-kill-table"><tr><th>SLAIN RANK</th><th style="text-align:right">COUNT</th><th>EU/CORE</th></tr>${killRows}</table>` : `<div style="font-size:0.75em;color:#a3a8b5;text-align:center;padding:10px;">[ NO ASSIMILATION DATA DETECTED ]</div>`} 
        </div>
      </div>
    `;

    const rawStatus=(p.status||'').replace(STRIP_HTML, '').toLowerCase();
    const statusColor=rawStatus==='active'?'#00ff88':'#ff3b3b';
    const rawIca=(p.ica_status||'').replace(STRIP_HTML, '').toLowerCase();
    const icaColor=rawIca==='registered'?'#00d2ff':'#ff9d00';

    const dotHTML = images.length>1 ? `<div class="ov-img-dots" id="img-dots-${cleanId}">${images.map((_,i)=>`<div class="ov-img-dot${i===imgIdx?' active':''}" style="color:${tColor}"></div>`).join('')}</div>` : '';
    const imgFrameHTML = `
        <div class="ov-photo-wrap" id="photo-wrap-${cleanId}" style="max-width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;overflow:hidden;">
            ${currentImgSrc
                ? `<img class="ov-photo" id="main-photo-${cleanId}" src="${currentImgSrc}" style="max-width:100%;max-height:38vh;object-fit:contain;border-radius:6px;border:2px solid ${tColor};box-shadow:0 0 15px ${tGlow};cursor:pointer;">`
                : `<div class="ov-photo-ph" id="main-photo-${cleanId}" style="width:140px;height:180px;border:2px solid ${tColor}50;border-radius:6px;box-shadow:inset 0 0 15px ${tGlow};cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;">${tierSigilCached(tier,35)}<span style="font-size:0.75em;margin-top:8px;color:${tColor}">UNINDEXED</span></div>`}
            <div class="ov-photo-nav-line" id="nav-line-${cleanId}" style="background:${tColor}20;box-shadow:0 0 6px ${tColor}60">
                <div class="ov-nav-zone ov-nav-left"  style="background:${tColor}30"></div>
                <div class="ov-nav-zone ov-nav-mid"   style="background:${tColor}60;position:relative"><div class="ov-nav-dot"></div></div>
                <div class="ov-nav-zone ov-nav-right" style="background:${tColor}30"></div>
            </div>
            ${dotHTML}
            <input type="file" id="file-${cleanId}" accept="image/*" style="display:none">
        </div>`;

    function vitalMods(k) {
        let parts=[];
        const synContribs = { power: base.vitality>0||base.energy>0, speed: base.power>0||base.energy>0, vitality: base.energy>0, perception: base.energy>0, energy: false };
        if (synContribs[k] && synDeltas[k]>0) {
            const pct=base[k]>0?Number(((synDeltas[k]/base[k])*100).toFixed(1)):0;
            parts.push(`<span class="ov-syn-tag">\u2191${pct}% SYN</span>`);
        }
        if (boosts[k]>0) parts.push(`<span class="ov-boost-tag">\u2191${boosts[k]}% BST</span>`);
        return parts.join('');
    }


    detailContent.innerHTML = `
    <div class="ov-subject-header">
        ${imgFrameHTML}
        <div class="ov-subject-info">
            <div class="ov-subject-id">// IDENTIFIER: ${p.file.name.toUpperCase()}</div>
            <div class="ov-subject-name" style="text-shadow:0 0 10px rgba(255,255,255,0.3)">${p.name||p.file.name}</div>
            <div class="ov-rank-badge" style="color:${tColor};border-color:${tColor};background:linear-gradient(90deg,${tColor}15,transparent);box-shadow:0 0 15px ${tGlow}">
                ${tierSigilCached(tier,16)} ${p.rank||'Dormant'}
            </div>
            <div class="ov-meta-grid">
                <div class="ov-meta-cell"><span class="ov-meta-label">Age</span><span class="ov-meta-val">${p.age||'\u2014'}</span></div>
                <div class="ov-meta-cell"><span class="ov-meta-label">Gender</span><span class="ov-meta-val">${p.gender||'\u2014'}</span></div>
                <div class="ov-meta-cell"><span class="ov-meta-label">Status</span><span class="ov-meta-val" style="color:${statusColor};text-shadow:0 0 5px ${statusColor}80">${parseColors(p.status)||'\u2014'}</span></div>
                <div class="ov-meta-cell"><span class="ov-meta-label">ICA</span><span class="ov-meta-val" style="color:${icaColor};text-shadow:0 0 5px ${icaColor}80">${parseColors(p.ica_status)||'\u2014'}</span></div>
                <div class="ov-meta-cell"><span class="ov-meta-label">Origin</span><span class="ov-meta-val">${parseColors(p.origin)||'\u2014'}</span></div>
                <div class="ov-meta-cell"><span class="ov-meta-label">Location</span><span class="ov-meta-val">${parseColors(p.current_location)||'\u2014'}</span></div>
            </div>
        </div>
    </div>

    <div class="ov-divider"></div>
    <div class="ov-section">
        <div class="ov-section-title">// EVOLUTION MATRIX</div>
        <div class="ov-prog-wrap">
            <div class="ov-prog-label"><span style="color:#00d2ff;text-shadow:0 0 5px rgba(0,210,255,0.5)">ENERGY UNITS RESERVED</span><span>${fmtNum(currentEU)} / ${fmtNum(targetEU)}</span></div>
            <div class="ov-prog-track" id="prog-${cleanId}" title="Tap to sync core assimilation"><div class="ov-prog-fill" style="width:${pct}%;background:linear-gradient(90deg,${tColor}80,${tColor});box-shadow:0 0 10px ${tColor}"></div><div class="ov-prog-pct">${pct}%</div></div>
        </div>
        <div class="ov-calc" id="calc-${cleanId}">
            <div class="ov-calc-title">\u26a0 INITIATE MANUAL CORE SYNC</div>
            <div class="ov-calc-row">
                <div id="calc-rank-${cleanId}" class="ov-dd-placeholder"></div>
                <input type="number" id="calc-count-${cleanId}" placeholder="QTY" min="1">
            </div>
            <button class="ov-btn" id="calc-btn-${cleanId}">PROCESS ENERGY</button>
        </div>
    </div>

    <div class="ov-vbar-root">
        <div class="ov-vbar-header">
            <span class="ov-vbar-title" id="ov-vbar-title-${cleanId}" title="Click to reveal arcane lens">// VITAL STATUS</span>
            <div class="ov-vbar-online"><span class="ov-vbar-dot"></span>LIVE</div>
        </div>

        ${(()=>{
            const vColors = {power:'#ff3b3b',speed:'#00d2ff',vitality:'#00ff88',perception:'#d400ff',energy:'#ffb700'};
            const ICONS = {
                power:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><path d="M12 6v5l3 3"/></svg>`,
                speed:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><path d="M7 12h10M14 9l3 3-3 3"/></svg>`,
                vitality:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><path d="M6 12h3l2-4 2 8 2-4h3"/></svg>`,
                perception: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><circle cx="12" cy="12" r="3"/><path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2"/></svg>`,
                energy:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/><path d="M13 2L6 14h7l-1 8 8-12h-7z"/></svg>`
            };

            // ── TIER ZONES: includes Dormant tier for sub-F-rank stats ──
            const TIER_ZONES = [
                { tier:'Dormant', label:'Dor', ranks:['Dormant-1','Dormant-2','Dormant-3'] },
                { tier:'F',   label:'F',   ranks:['F\u2212','F','F+','F++','F+++'] },
                { tier:'E',   label:'E',   ranks:['E\u2212','E','E+','E++','E+++'] },
                { tier:'D',   label:'D',   ranks:['D\u2212','D','D+','D++','D+++'] },
                { tier:'C',   label:'C',   ranks:['C\u2212','C','C+','C++','C+++'] },
                { tier:'B',   label:'B',   ranks:['B\u2212','B','B+','B++','B+++'] },
                { tier:'A',   label:'A',   ranks:['A\u2212','A','A+','A++','A+++'] },
                { tier:'S',   label:'S',   ranks:['S\u2212','S','S+','S++','S+++'] },
                { tier:'SS',  label:'SS',  ranks:['SS\u2212','SS','SS+','SS++','SS+++'] },
                { tier:'SSS', label:'SSS', ranks:['SSS','SSS+','SSS++','SSS+++'] },
            ];

            const synContribsMap = {
                power: base.vitality>0||base.energy>0,
                speed: base.power>0||base.energy>0,
                vitality: base.energy>0,
                perception: base.energy>0,
                energy: false
            };
            const _savedMode = localStorage.getItem('ov-scale-mode') || 'full';

            const allStats = ['power','speed','vitality','perception','energy'].map(k => {
                const vVal  = finalVitals[k];
                const vRank = getRankFromValueRaw(vVal);   // ← changed
                const vTier = getTier(vRank);
                const tierIdx = TIER_ZONES.findIndex(z => z.tier === vTier);
                return { k, vVal, vRank, vTier, tierIdx };
            });

            function getScaleZones(vRank, vTier, mode) {
                const tierIdx    = TIER_ZONES.findIndex(z => z.tier === vTier);
                if (tierIdx < 0) return { zones: TIER_ZONES, tierIdx: 0, rankInZone: 0 };
                const zone       = TIER_ZONES[tierIdx];
                const rankInZone = zone.ranks.indexOf(
                    vRank.startsWith('Dormant') ? vRank : vRank.replace(/-/g,'\u2212')
                );
                const safeRankInZone = rankInZone < 0 ? 0 : rankInZone;
                if (mode === 'full') return { zones: TIER_ZONES, tierIdx, rankInZone: safeRankInZone };
                if (mode === 'next_minor') {
                    const isLastInTier = safeRankInZone >= zone.ranks.length - 1;
                    if (isLastInTier && tierIdx < TIER_ZONES.length - 1) {
                        const nz = TIER_ZONES[tierIdx + 1];
                        return { zones: [zone, Object.assign({}, nz, { ranks: [nz.ranks[0]] })], tierIdx: 0, rankInZone: safeRankInZone };
                    }
                    return { zones: [zone], tierIdx: 0, rankInZone: safeRankInZone };
                }
                if (mode === 'next_major') {
                    if (tierIdx < TIER_ZONES.length - 1)
                        return { zones: [zone, TIER_ZONES[tierIdx + 1]], tierIdx: 0, rankInZone: safeRankInZone };
                    return { zones: [zone], tierIdx: 0, rankInZone: safeRankInZone };
                }
                return { zones: TIER_ZONES, tierIdx, rankInZone: safeRankInZone };
            }

            function buildBarStrip(vRank, vTier, color, mode) {
                const _sz = getScaleZones(vRank, vTier, mode);
                const zones = _sz.zones, localTierIdx = _sz.tierIdx, rankInZone = _sz.rankInZone;
                let html = `<div class="ov-prl-bar-strip">`;
                zones.forEach((zone, zi) => {
                    const isCurrent = zi === localTierIdx;
                    const isPast    = zi < localTierIdx;
                    const zColor    = TIER_COLOR[zone.tier] || '#3a4e64';
                    html += `<div class="ov-seg-blocks prl-blocks">`;
                    zone.ranks.forEach((_, bi) => {
                        const blockFilled = isPast || (isCurrent && bi <= rankInZone);
                        const isEdge      = isCurrent && bi === rankInZone;
                        if (blockFilled) {
                            if (isEdge) {
                                html += `<div class="ov-seg-block filled edge" style="background:radial-gradient(ellipse at 30% 30%, ${color}, ${color}cc);box-shadow:0 0 8px ${color}80, inset 0 0 3px ${color}60;border:1px solid ${color};"></div>`;
                            } else if (isCurrent) {
                                html += `<div class="ov-seg-block filled" style="background:linear-gradient(180deg, ${color}90 0%, ${color}50 100%);box-shadow:inset 0 0 4px ${color}30;"></div>`;
                            } else {
                                html += `<div class="ov-seg-block filled" style="background:${zColor}35;box-shadow:inset 0 0 2px ${zColor}20;"></div>`;
                            }
                        } else {
                            html += `<div class="ov-seg-block" style="background:#0a0f1a;border:1px solid #111827;"></div>`;
                        }
                    });
                    html += `</div>`;
                });
                html += `</div>`;
                return html;
            }

            const rowsHTML = allStats.map(({ k, vVal, vRank, vTier }) => {
                const c = vColors[k];
                let pills = '';
                if (synContribsMap[k] && synDeltas[k]>0) {
                    const sp = base[k]>0 ? Number(((synDeltas[k]/base[k])*100).toFixed(1)) : 0;
                    pills += `<span class="ov-vbar-pill syn" style="border-color:${c}30;color:${c}aa;background:${c}08;">\u2191${sp}% SYN</span>`;
                }
                if (boosts[k]>0) pills += `<span class="ov-vbar-pill bst" style="border-color:${c}30;color:${c}aa;background:${c}08;">\u2191${boosts[k]}% BST</span>`;

                return `
                <div class="ov-prl-row" data-stat="${k}" style="border-bottom:1px solid ${c}08;">
                    <div class="ov-prl-icon" style="color:${c};border-color:${c}35;box-shadow:inset 0 0 10px ${c}10, 0 0 8px ${c}10;background:linear-gradient(135deg, ${c}08 0%, transparent 50%);">${ICONS[k]}</div>
                    <div class="ov-prl-bar-mid" id="ov-bar-mid-${k}-${cleanId}">
                        <div class="ov-prl-bar-row" id="ov-bar-row-${k}-${cleanId}">${buildBarStrip(vRank, vTier, c, _savedMode)}</div>
                        ${pills ? `<div class="ov-vbar-pills" style="margin-top:3px">${pills}</div>` : ''}
                    </div>
                    <div class="ov-prl-right">
                        <div class="ov-prl-rankbadge" style="color:${c};border-color:${c}30;background:${c}10;box-shadow:0 0 6px ${c}15;text-shadow:0 0 4px ${c}40;">${vRank}</div>
                        <div class="ov-prl-val" style="color:${c};text-shadow:0 0 4px ${c}30;">${fmtNum(vVal)}</div>
                    </div>
                </div>`;
            }).join('');

            const scaleModePickerHTML = `
            <div class="ov-prl-scale-picker" id="ov-scale-picker-${cleanId}" style="display:none;margin-bottom:10px;">
                <button class="ov-prl-scale-btn${_savedMode==='full'?' active':''}" data-mode="full" style="background:#0f1420;border:1px solid #1e2535;color:#5e7a96;padding:4px 12px;font-size:0.65em;font-family:'Barlow Condensed',sans-serif;letter-spacing:2px;cursor:pointer;border-radius:3px;transition:all 0.2s;">FULL SPECTRUM</button>
                <button class="ov-prl-scale-btn${_savedMode==='next_major'?' active':''}" data-mode="next_major" style="background:#0f1420;border:1px solid #1e2535;color:#5e7a96;padding:4px 12px;font-size:0.65em;font-family:'Barlow Condensed',sans-serif;letter-spacing:2px;cursor:pointer;border-radius:3px;transition:all 0.2s;margin-left:4px;">NEXT TIER</button>
                <button class="ov-prl-scale-btn${_savedMode==='next_minor'?' active':''}" data-mode="next_minor" style="background:#0f1420;border:1px solid #1e2535;color:#5e7a96;padding:4px 12px;font-size:0.65em;font-family:'Barlow Condensed',sans-serif;letter-spacing:2px;cursor:pointer;border-radius:3px;transition:all 0.2s;margin-left:4px;">NEXT RANK</button>
            </div>`;

            return `
            <div class="ov-prl-panel">
                ${scaleModePickerHTML}
                <div class="ov-prl-rows-wrap" id="ov-rows-wrap-${cleanId}">${rowsHTML}</div>
            </div>`;
        })()}
    </div>

    <div class="ov-toggle-bar">
        <div class="ov-toggle-btn" id="prow-toggle-${cleanId}" data-label="PROWESS" style="background:${tColor}; color:${tColor}; box-shadow:0 0 8px ${tGlow};"></div>
        <div class="ov-toggle-btn" id="sim-toggle-${cleanId}" data-label="SIMULATION" style="background:${tColor}; color:${tColor}; box-shadow:0 0 8px ${tGlow};"></div>
    </div>

    <div class="ov-prowess-container" id="prow-container-${cleanId}" style="display:none; border-color:${tColor}40;">
        <div style="text-align:center; color:${tColor}; font-weight:bold; letter-spacing:1px; margin-bottom:15px; text-shadow:0 0 8px ${tGlow}">// PROWESS METRICS OVERVIEW</div>
        <div id="prow-v4-${cleanId}"></div>
    </div>
    <div id="sim-container-${cleanId}" style="display:none; padding: 15px; background: rgba(0,0,0,0.25); border: 1px solid #374151; border-radius: 6px; margin-bottom: 25px;">
        <div style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
            <button class="ov-sim-btn" id="sim-save-${cleanId}">UPDATE DOSSIER</button>
            <button class="ov-sim-btn" id="copy-summary-${cleanId}" style="background: #10b981; border: 1px solid #059669;">\ud83d\udccb COPY DOSSIER SUMMARY</button>
        </div>
        <div class="ov-sim-grid">
            <div class="ov-sim-input-group">
                <label>Target Rank</label>
                <div id="sim-rank-${cleanId}" class="ov-dd-placeholder"></div>
            </div>
            <div class="ov-sim-input-group">
                <label>Core Potential</label>
                <div id="sim-pot-${cleanId}" class="ov-dd-placeholder"></div>
            </div>
            <div class="ov-sim-input-group">
                <label>Current Age</label>
                <input type="number" id="sim-age-${cleanId}" value="${parseInt(p.age) || 15}" min="1">
            </div>
            <div class="ov-sim-input-group">
                <label>Awakened Age</label>
                <input type="number" id="sim-awakened-${cleanId}" value="${p.awakened_at || 15}" min="1">
            </div>
            <div class="ov-sim-input-group">
                <label>Retirement Age</label>
                <input type="text" id="sim-retired-${cleanId}" value="${p.retired_at || 'active'}" placeholder="'active' or age">
            </div>
        </div>
        <div id="sim-analysis-${cleanId}" class="ov-sim-analysis"></div>

        <div class="ov-divider" style="margin: 15px 0; border-color: #374151;"></div>
        
        <div style="font-weight:bold; color: #60a5fa; margin-bottom: 10px;">// HYPOTHETICAL SIMULATION</div>
        <div style="display:flex; gap: 15px; margin-bottom: 15px;">
            <label><input type="radio" name="simMode-${cleanId}" value="findTime" checked> Calc Time</label>
            <label><input type="radio" name="simMode-${cleanId}" value="findRuns"> Calc Runs</label>
        </div>
        <div class="ov-sim-grid">
            <div class="ov-sim-input-group">
                <label>Runs / Week</label>
                <input type="number" id="sim-runs-${cleanId}" value="3" step="0.1" min="0.1" max="7">
            </div>
            <div class="ov-sim-input-group">
                <label>Years Spent</label>
                <input type="number" id="sim-years-${cleanId}" value="5" step="0.1" min="0.1" disabled>
            </div>
        </div>
        
        <div id="sim-summary-${cleanId}" style="background: rgba(0,0,0,0.4); padding: 10px; border-radius: 4px; margin-top: 10px; font-size: 0.95em; line-height: 1.5;"></div>
        <div id="sim-table-${cleanId}" style="overflow-x:auto; max-height: 250px; margin-top: 10px;"></div>
    </div>

    <div class="ov-divider"></div>
    <div class="ov-section">
        <div class="ov-section-title">// CORE ARCHITECTURE</div>
        <div class="ov-info-grid">
            <div><span class="ov-field-label">Core Reach</span><span class="ov-field-val glow-text">${parseColors(p.core_reach)||'\u2014'}</span></div>
            <div><span class="ov-field-label">Potential Rating</span><span class="ov-field-val">${p.core_potential||'\u2014'}</span></div>
            <div><span class="ov-field-label">Coremark Nexus</span><span class="ov-field-val">${p.coremark_location||'\u2014'}</span></div>
            <div><span class="ov-field-label">Total Assimilations</span><span class="ov-field-val" style="color:#ffb700;text-shadow:0 0 5px rgba(255,183,0,0.5)">${fmtNum(totalKills)}</span></div>
            <div style="grid-column:1/-1"><span class="ov-field-label">Coremark Analysis</span><div class="ov-desc-text" style="margin-top:5px">${p.coremark_description||'\u2014'}</div></div>
        </div>
    </div>

    <div class="ov-divider"></div>
    <div class="ov-section">
        <div class="ov-section-title">// RESONANT ABILITY</div>
        <div class="ov-ability-name" style="color:${tColor};text-shadow:0 0 8px ${tGlow}">${p.ability_name||'DORMANT'}</div>
        <div class="ov-ability-type">CLASSIFICATION: ${p.ability_type||'\u2014'}</div>
        <div class="ov-desc-text">${p.awakened_ability_desc||'\u2014'}</div>
        ${p.ability_limitations?`<div class="ov-warning" style="border-left:3px solid #ff3b3b;padding-left:8px;margin-top:10px;">\u26a0 <b>LIMITATION:</b> ${p.ability_limitations}</div>`:''}
    </div>
    
    <div class="ov-divider"></div>
    <div class="ov-section">
        <div class="ov-section-title">// PERSONNEL DOSSIER</div>
        <div class="ov-info-grid">
            <div><span class="ov-field-label">Directive</span><span class="ov-field-val">${p.role||'\u2014'}</span></div>
            <div><span class="ov-field-label">Psych Profile</span><span class="ov-field-val">${p.personality_archetype||'\u2014'}</span></div>
            <div><span class="ov-field-label">Primary Allegiance</span><span class="ov-field-val glow-text">${parseColors(p.affiliation?.primary)||'\u2014'}</span></div>
            <div><span class="ov-field-label">Secondary Allegiance</span><span class="ov-field-val">${parseColors(p.affiliation?.secondary)||'\u2014'}</span></div>
            <div><span class="ov-field-label">Combat Paradigm</span><span class="ov-field-val">${p.combat_style||'\u2014'}</span></div>
            <div><span class="ov-field-label">Driving Motif</span><span class="ov-field-val">${p.motivation||'\u2014'}</span></div>
            <div style="grid-column:1/-1">
                <span class="ov-field-label">Visual Parameters</span>
                <div class="ov-desc-text" style="margin-top:5px">${p.appearance||'\u2014'}</div>
            </div>
        </div>
    </div>

    ${personalHTML}
    <div class="ov-divider"></div>
    ${registryHTML}
    `;


    // ── LOAD PROWESS v4 ENGINE ──────────────────────────────
    const prowV4Target = detailContent.querySelector(`#prow-v4-${cleanId}`);
    if (prowV4Target) {
        try {
            dv.view("Meta/Scripts/prowess_v4", {
                container: prowV4Target,
                rvMap: {
                    rank:       p.rank,
                    power:      finalVitals.power,
                    speed:      finalVitals.speed,
                    vitality:   finalVitals.vitality,
                    perception: finalVitals.perception,
                    energy:     finalVitals.energy
                }
            });
        } catch(err) {
            prowV4Target.innerHTML = `<div style="color:#ff4444;font-size:0.8em;padding:8px;">\u26a0\ufe0f Prowess v4 error: ${err.message}</div>`;
        }
    }

    // ── PERSONAL DATA TOGGLE ──────────────────────────
    const pToggle = detailContent.querySelector(`#personal-toggle-${cleanId}`);
    const pContent = detailContent.querySelector(`#personal-content-${cleanId}`);
    if (pToggle && pContent) {
        pToggle.addEventListener('click', () => {
            const isHidden = pContent.style.display === 'none';
            pContent.style.display = isHidden ? 'grid' : 'none';
            pToggle.querySelector('span:last-child').textContent = isHidden ? '\u25b2' : '\u25bc';
        });
    }
    
    // ── PROWESS TOGGLE ────────────────────────────────
    const prowToggle = detailContent.querySelector(`#prow-toggle-${cleanId}`);
    const prowContainer = detailContent.querySelector(`#prow-container-${cleanId}`);
    if (prowToggle && prowContainer) {
        prowToggle.addEventListener('click', () => {
            const isHidden = prowContainer.style.display === 'none' || prowContainer.style.display === '';
            prowContainer.style.display = isHidden ? 'block' : 'none';
            prowToggle.classList.toggle('active', isHidden);
        });
    }
    
    // ── VITAL STATUS: title click reveals scale picker + scale mode logic ──
    const vitalTitle  = detailContent.querySelector(`#ov-vbar-title-${cleanId}`);
    const scalePicker = detailContent.querySelector(`#ov-scale-picker-${cleanId}`);
    if (vitalTitle && scalePicker) {
        vitalTitle.style.cursor = 'pointer';
        vitalTitle.addEventListener('click', () => {
            const hidden = scalePicker.style.display === 'none' || scalePicker.style.display === '';
            scalePicker.style.display = hidden ? 'flex' : 'none';
        });
        scalePicker.addEventListener('click', e => {
            const btn = e.target.closest('.ov-prl-scale-btn');
            if (!btn) return;
            const mode = btn.dataset.mode;
            localStorage.setItem('ov-scale-mode', mode);
            scalePicker.querySelectorAll('.ov-prl-scale-btn').forEach(b => {
                b.classList.toggle('active', b === btn);
                b.style.color = (b === btn) ? '#c8d8f0' : '#5e7a96';
                b.style.borderColor = (b === btn) ? '#2a3a5a' : '#1e2535';
                b.style.background = (b === btn) ? '#1a2d4a' : '#0f1420';
            });
            // Rebuild all vital bars with the new scale mode
            const TIER_ZONES = [
                { tier:'Dormant', label:'D', ranks:['Dormant'] },
                { tier:'F',   ranks:['F\u2212','F','F+','F++','F+++'] },
                { tier:'E',   ranks:['E\u2212','E','E+','E++','E+++'] },
                { tier:'D',   ranks:['D\u2212','D','D+','D++','D+++'] },
                { tier:'C',   ranks:['C\u2212','C','C+','C++','C+++'] },
                { tier:'B',   ranks:['B\u2212','B','B+','B++','B+++'] },
                { tier:'A',   ranks:['A\u2212','A','A+','A++','A+++'] },
                { tier:'S',   ranks:['S\u2212','S','S+','S++','S+++'] },
                { tier:'SS',  ranks:['SS\u2212','SS','SS+','SS++','SS+++'] },
                { tier:'SSS', ranks:['SSS','SSS+','SSS++','SSS+++'] },
            ];
            function getScaleZones(vRank, vTier, m) {
                const tierIdx    = TIER_ZONES.findIndex(z => z.tier === vTier);
                if (tierIdx < 0) return { zones: TIER_ZONES, tierIdx: 0, rankInZone: 0 };
                const zone       = TIER_ZONES[tierIdx];
                const rankInZone = zone.ranks.indexOf(
                    vRank.startsWith('Dormant') ? vRank : vRank.replace(/-/g,'\u2212')
                );
                const safeRankInZone = rankInZone < 0 ? 0 : rankInZone;
                if (m === 'full') return { zones: TIER_ZONES, tierIdx, rankInZone: safeRankInZone };
                if (m === 'next_minor') {
                    const isLastInTier = safeRankInZone >= zone.ranks.length - 1;
                    if (isLastInTier && tierIdx < TIER_ZONES.length - 1) {
                        const nz = TIER_ZONES[tierIdx + 1];
                        return { zones: [zone, Object.assign({}, nz, { ranks: [nz.ranks[0]] })], tierIdx: 0, rankInZone: safeRankInZone };
                    }
                    return { zones: [zone], tierIdx: 0, rankInZone: safeRankInZone };
                }
                if (m === 'next_major') {
                    if (tierIdx < TIER_ZONES.length - 1)
                        return { zones: [zone, TIER_ZONES[tierIdx + 1]], tierIdx: 0, rankInZone: safeRankInZone };
                    return { zones: [zone], tierIdx: 0, rankInZone: safeRankInZone };
                }
                return { zones: TIER_ZONES, tierIdx, rankInZone: safeRankInZone };
            }
            function buildBarStrip(vRank, vTier, color, m) {
                const _sz = getScaleZones(vRank, vTier, m);
                const zones = _sz.zones, localTierIdx = _sz.tierIdx, rankInZone = _sz.rankInZone;
                let html = `<div class="ov-prl-bar-strip">`;
                zones.forEach((zone, zi) => {
                    const isCurrent = zi === localTierIdx;
                    const isPast    = zi < localTierIdx;
                    const zColor    = TIER_COLOR[zone.tier] || '#3a4e64';
                    html += `<div class="ov-seg-blocks prl-blocks">`;
                    zone.ranks.forEach((_, bi) => {
                        const blockFilled = isPast || (isCurrent && bi <= rankInZone);
                        const isEdge      = isCurrent && bi === rankInZone;
                        if (blockFilled) {
                            if (isEdge) {
                                html += `<div class="ov-seg-block filled edge" style="background:radial-gradient(ellipse at 30% 30%, ${color}, ${color}cc);box-shadow:0 0 8px ${color}80, inset 0 0 3px ${color}60;border:1px solid ${color};"></div>`;
                            } else if (isCurrent) {
                                html += `<div class="ov-seg-block filled" style="background:linear-gradient(180deg, ${color}90 0%, ${color}50 100%);box-shadow:inset 0 0 4px ${color}30;"></div>`;
                            } else {
                                html += `<div class="ov-seg-block filled" style="background:${zColor}35;box-shadow:inset 0 0 2px ${zColor}20;"></div>`;
                            }
                        } else {
                            html += `<div class="ov-seg-block" style="background:#0a0f1a;border:1px solid #111827;"></div>`;
                        }
                    });
                    html += `</div>`;
                });
                html += `</div>`;
                return html;
            }
            ['power','speed','vitality','perception','energy'].forEach(k => {
                const vVal  = finalVitals[k];
                const vRank = getRankFromValue(vVal);
                const vTier = getTier(vRank);
                const c     = vColors[k];
                const barEl = detailContent.querySelector(`#ov-bar-row-${k}-${cleanId}`);
                if (barEl) barEl.innerHTML = buildBarStrip(vRank, vTier, c, mode);
            });
        });
    }

    // ── IMAGE NAV & LIGHTBOX EVENTS ────────────────────────
    const navLine  = detailContent.querySelector(`#nav-line-${cleanId}`);
    const fileInput= detailContent.querySelector(`#file-${cleanId}`);
    const mainPhoto= detailContent.querySelector(`#main-photo-${cleanId}`);
    const dotsEl   = detailContent.querySelector(`#img-dots-${cleanId}`);

    async function showImg(idx) {
        imgIdx = ((idx%images.length)+images.length)%images.length;
        const src = await loadImgSrc(images[imgIdx]);
        if (mainPhoto && src) {
            if (mainPhoto.tagName==='IMG') mainPhoto.src=src;
            if (dotsEl) dotsEl.querySelectorAll('.ov-img-dot').forEach((d,i)=>d.classList.toggle('active', i===imgIdx));
            window.ovRenderInFlight = true;
            window.ovSkipScrollRestore = true;
            window.ovScrollPosition = scroller.scrollTop;
            await app.fileManager.processFrontMatter(
                app.vault.getAbstractFileByPath(filePath),
                fm=>{ fm.profile_image_index=imgIdx; fm.profile_image=images[imgIdx]; }
            );
            window.ovRenderInFlight = false;
        }
    }

    if (navLine && fileInput) {
        navLine.addEventListener('click', async e => {
            e.stopPropagation();
            const rect = navLine.getBoundingClientRect();
            const x = (e.touches?.[0]?.clientX ?? e.clientX) - rect.left;
            const w = rect.width;
            const zone = x < w*0.33 ? 'left' : x > w*0.67 ? 'right' : 'mid';
            if (zone==='left') { if(images.length>1) await showImg(imgIdx-1); } 
            else if (zone==='right') { if(images.length>1) await showImg(imgIdx+1); } 
            else {
                const onFocus = () => window.removeEventListener('focus', onFocus);
                window.addEventListener('focus', onFocus);
                fileInput.click();
            }
        });
        navLine.addEventListener('touchend', async e => {
            e.preventDefault(); e.stopPropagation();
            const rect = navLine.getBoundingClientRect();
            const x = e.changedTouches[0].clientX - rect.left;
            const w = rect.width;
            const zone = x < w*0.33 ? 'left' : x > w*0.67 ? 'right' : 'mid';
            if (zone==='left') { if(images.length>1) await showImg(imgIdx-1); } 
            else if (zone==='right') { if(images.length>1) await showImg(imgIdx+1); } 
            else { fileInput.click(); }
        }, { passive: false });

        fileInput.addEventListener('change', async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const newPath = await saveProfileImage(file, filePath, cleanId);
            images.push(newPath);
            imgIdx = images.length - 1;
            const src = await loadImgSrc(newPath);
            if (src && mainPhoto) {
                if (mainPhoto.tagName === 'IMG') {
                    mainPhoto.src = src;
                } else {
                    const img = document.createElement('img');
                    img.className = 'ov-photo';
                    img.id = mainPhoto.id;
                    img.src = src;
                    img.style.cssText = mainPhoto.style.cssText;
                    img.style.cursor = 'pointer';
                    img.addEventListener('click', ev => { ev.stopPropagation(); openLightbox(images, imgIdx, tColor, tGlow); });
                    mainPhoto.replaceWith(img);
                }
                if (dotsEl) dotsEl.querySelectorAll('.ov-img-dot').forEach((d,i) => d.classList.toggle('active', i === imgIdx));
            }
            window.ovRenderInFlight = true;
            window.ovSkipScrollRestore = true;
            window.ovScrollPosition = scroller.scrollTop;
            setTimeout(() => { window.ovRenderInFlight = false; }, 500);
        });
    }

    if (mainPhoto && images.length>0) {
        let startX=0, startY=0;
        mainPhoto.addEventListener('click', e => { e.stopPropagation(); openLightbox(images, imgIdx, tColor, tGlow); });
        mainPhoto.addEventListener('touchstart', e => {
            startX = e.changedTouches[0].clientX;
            startY = e.changedTouches[0].clientY;
        }, { passive: true });
        mainPhoto.addEventListener('touchend', e => {
            const dx = Math.abs(e.changedTouches[0].clientX - startX);
            const dy = Math.abs(e.changedTouches[0].clientY - startY);
            if (dx > 10 || dy > 10) return; 
            e.preventDefault();
            e.stopPropagation();
            openLightbox(images, imgIdx, tColor, tGlow);
        }, { passive: false });
    }

    const progTrack=detailContent.querySelector(`#prog-${cleanId}`);
    if (progTrack) {
        progTrack.addEventListener('click',()=>{
            const c=detailContent.querySelector(`#calc-${cleanId}`);
            if(c) c.style.display=c.style.display==='block'?'none':'block';
        });
    }


    // ── SYNC BUTTON & CALC RANK DROPDOWN ──
    const calcBtn=detailContent.querySelector(`#calc-btn-${cleanId}`);
    const calcRankPlaceholder = detailContent.querySelector(`#calc-rank-${cleanId}`);
    if (calcRankPlaceholder) {
        const calcRankDd = makeDropdown(
            `calc-rank-${cleanId}`,
            [{ value: '', label: '\u2014 SELECT ASSIMILATED RANK \u2014' },
             ...RANKS.map((r, i) => {
                 const diff = i - rankIdx;
                 const mult = diff <= -2 ? 0.1 : diff === -1 ? 0.3 : diff === 0 ? 1.0 : diff === 1 ? 4.0 : 10.0;
                 const risk = diff <= -2 ? ' [INEFFICIENT]' : diff === -1 ? ' [LOW YIELD]' : diff === 1 ? ' [HIGH VALUE]' : diff >= 2 ? ' [FATAL RISK]' : '';
                 return { value: r.rank, label: `${r.rank} (+${fmtNum(r.euPerKill * mult)} EU)${risk}` };
             })],
            '',
            null,
            tColor
        );
        calcRankPlaceholder.replaceWith(calcRankDd);
    }

    // ═══════════════════════════════════════════════════════════
    // FIX 1: ovRenderInFlight is set BEFORE processFrontMatter
    // to prevent Dataview auto-refresh from racing the update.
    // ═══════════════════════════════════════════════════════════
    if (calcBtn) {
        calcBtn.addEventListener('click', async () => {
            const selRank = detailContent.querySelector(`#calc-rank-${cleanId}`)?.value || '';
            const count   = parseInt(detailContent.querySelector(`#calc-count-${cleanId}`)?.value);
            calcBtn.textContent = 'SYNCING PROTOCOLS...';
            calcBtn.disabled = true;
            const preState = captureDetailOpenState();
            window.ovSkipScrollRestore = true;
            // Set the flag BEFORE processFrontMatter to block auto-refresh
            window.ovRenderInFlight = true;

            // v7.2: Capture computed values to update local state immediately.
            // Bypasses Dataview cache latency that caused stale re-renders.
            const updates = {};

            await app.fileManager.processFrontMatter(
                app.vault.getAbstractFileByPath(filePath),
                fm => {
                    let needsVitalsRecalc = false;
                    let currentRankData = RANKS.find(r=>r.rank===normalizeRank(fm.rank)) || RANKS[0];
                    if (!selRank || isNaN(count) || count <= 0) {
                        needsVitalsRecalc = true;
                        let rIdx = RANKS.findIndex(r=>r.rank===normalizeRank(fm.rank));
                        if (rIdx > 0) {
                            let autoKills = {};
                            let totalAutoKills = 0;
                            for (let i = 0; i < rIdx; i++) {
                                if (RANKS[i].euRequired > 0) {
                                    let killsReq = Math.ceil(RANKS[i].euRequired / RANKS[i].euPerKill);
                                    autoKills[RANKS[i].rank] = killsReq;
                                    totalAutoKills += killsReq;
                                }
                            }
                            if (Object.keys(autoKills).length > 0) {
                                fm.kill_log = autoKills;
                                fm.kills = totalAutoKills;
                            }
                        }
                    } else {
                        const targetRankData = RANKS.find(r=>r.rank===selRank);
                        fm.kills = (fm.kills || 0) + count;
                        if (!fm.kill_log) fm.kill_log = {};
                        fm.kill_log[selRank] = (fm.kill_log[selRank] || 0) + count;

                        let cEU = (fm.current_energy_units || 0);
                        let rIdx = RANKS.findIndex(r=>r.rank===normalizeRank(fm.rank));
                        let tIdx = RANKS.findIndex(r=>r.rank===selRank);

                        for (let i = 0; i < count; i++) {
                            let diff = tIdx - rIdx;
                            let mult = 1.0;
                            if (diff <= -2) mult = 0.1;
                            else if (diff === -1) mult = 0.3;
                            else if (diff === 0) mult = 1.0;
                            else if (diff === 1) mult = 4.0;
                            else if (diff >= 2) mult = 10.0;

                            cEU += (targetRankData.euPerKill * mult);

                            while (rIdx >= 0 && rIdx < RANKS.length - 1) {
                                const rData = RANKS[rIdx];
                                if (rData.euRequired > 0 && cEU >= rData.euRequired) {
                                    cEU -= rData.euRequired; 
                                    rIdx++; 
                                    needsVitalsRecalc = true;
                                    while (rIdx < RANKS.length - 1 && RANKS[rIdx].rank.endsWith('\u2212')) rIdx++;
                                } else break;
                            }
                        }

                        fm.rank = RANKS[rIdx].rank;
                        fm.current_energy_units = cEU;
                        fm.breakthrough_target = RANKS[rIdx].euRequired;
                        currentRankData = RANKS[rIdx];
                    }
                    if (needsVitalsRecalc) {
                        const newVitals = calculateVitals(currentRankData.val, fm.core_reach);
                        if (newVitals) fm.vitals = newVitals;
                    }

                    // Capture all final values for immediate UI update (v7.2)
                    updates.rank = fm.rank;
                    updates.current_energy_units = fm.current_energy_units;
                    updates.breakthrough_target = fm.breakthrough_target;
                    updates.kills = fm.kills;
                    updates.kill_log = fm.kill_log ? {...fm.kill_log} : {};
                    if (fm.vitals) updates.vitals = {...fm.vitals};
                }
            );

            // CRITICAL v7.2: Update local page object with confirmed values.
            // Prevents stale Dataview cache from corrupting overlay display.
            Object.assign(p, updates);

            await reRenderKeepState(p, preState);
            if (listItem) updateListItem(listItem, p.rank);
        });
    }

    // ── SIMULATION & TIMELINE LOGIC ────────────────────────
    const simToggle = detailContent.querySelector(`#sim-toggle-${cleanId}`);
    const simDiv = detailContent.querySelector(`#sim-container-${cleanId}`);
    
    if (simToggle && simDiv) {
        simToggle.addEventListener('click', () => {
            const isHidden = simDiv.style.display === 'none' || simDiv.style.display === '';
            simDiv.style.display = isHidden ? 'block' : 'none';
            simToggle.classList.toggle('active', isHidden);
        });

        const rankDdEl = simDiv.querySelector(`#sim-rank-${cleanId}`);
        const rankSel = makeDropdown(
            `sim-rank-dd-${cleanId}`,
            RANKS.map((r, i) => ({ value: String(i), label: r.rank })),
            String(rankIdx),
            runSim,
            tColor
        );
        rankDdEl.replaceWith(rankSel);

        const potDdEl = simDiv.querySelector(`#sim-pot-${cleanId}`);
        const potSel = makeDropdown(
            `sim-pot-dd-${cleanId}`,
            POTENTIALS.map((pot, i) => ({ value: String(i), label: pot.name })),
            String(POTENTIALS.findIndex(pot => pot.name === (p.core_potential || '\u2014'))),
            runSim,
            tColor
        );
        potDdEl.replaceWith(potSel);

        const ageInp = simDiv.querySelector(`#sim-age-${cleanId}`);
        const awakenedInp = simDiv.querySelector(`#sim-awakened-${cleanId}`);
        const retiredInp = simDiv.querySelector(`#sim-retired-${cleanId}`);
        const saveBtn = simDiv.querySelector(`#sim-save-${cleanId}`);
        const analysisDiv = simDiv.querySelector(`#sim-analysis-${cleanId}`);
        
        const modeRadios = simDiv.querySelectorAll(`input[name="simMode-${cleanId}"]`);
        const runsInp = simDiv.querySelector(`#sim-runs-${cleanId}`);
        const yearsInp = simDiv.querySelector(`#sim-years-${cleanId}`);
        const summaryDiv = simDiv.querySelector(`#sim-summary-${cleanId}`);
        const tableDiv = simDiv.querySelector(`#sim-table-${cleanId}`);
        const copyBtn = simDiv.querySelector(`#copy-summary-${cleanId}`);

        function runSim() {
            const targetIdx = parseInt(rankSel.value);
            const potIdx = parseInt(potSel.value);
            const mode = simDiv.querySelector(`input[name="simMode-${cleanId}"]:checked`).value;
            
            const currentAge = parseInt(ageInp.value) || 15;
            const awakenedAge = parseInt(awakenedInp.value) || 15;
            const retiredRaw = retiredInp.value.trim().toLowerCase();
            let retiredAge = currentAge;
            if (retiredRaw !== 'active' && !isNaN(parseInt(retiredRaw))) {
                retiredAge = parseInt(retiredRaw);
            }
            
            const potential = POTENTIALS[potIdx];
            let runsPerWeek = parseFloat(runsInp.value) || 0.1;
            let years = parseFloat(yearsInp.value) || 0.1;
            
            let totalSimKills = 0; let totalRuns = 0;
            
            let tableHTML = `<table class="ov-sim-table">
                <thead><tr><th>Progression</th><th>EU Needed</th><th>Yield</th><th>Kills Needed</th><th>Cap/Run</th><th>Total Runs</th></tr></thead>
                <tbody>`;

            for (let i = 0; i < targetIdx; i++) {
                const current = RANKS[i];
                if (current.euRequired <= 0) continue;
                
                let baseLimit = MAX_DAILY_LIMITS[current.tier] || 4;
                let limitPerRun = Math.floor(baseLimit * potential.mult);
                if (limitPerRun < 1) limitPerRun = 1;
                
                const killsReq = Math.ceil(current.euRequired / current.euPerKill);
                const runsReq = Math.ceil(killsReq / limitPerRun);
                
                totalSimKills += killsReq; totalRuns += runsReq;
                
                tableHTML += `<tr>
                    <td>${current.rank} \u2192 ${RANKS[i+1].rank}</td>
                    <td>${fmtNum(current.euRequired)}</td>
                    <td>${fmtNum(current.euPerKill)}</td>
                    <td>${killsReq.toLocaleString()}</td>
                    <td>${limitPerRun}</td>
                    <td>${runsReq.toLocaleString()}</td>
                </tr>`;
            }
            tableHTML += `</tbody></table>`;
            
            if (targetIdx <= 1) tableHTML = `<div style="text-align:center; padding:10px;">Insufficient data to project runs.</div>`;

            if (mode === "findTime") {
                years = totalRuns / (runsPerWeek * 52);
                yearsInp.value = years.toFixed(2);
            } else {
                runsPerWeek = totalRuns / (years * 52);
                runsInp.value = runsPerWeek.toFixed(2);
            }

            let runStr = `Dungeon Runs / Week: <strong style="color:#00d2ff">${runsPerWeek.toFixed(2)}</strong>`;
            if (runsPerWeek > 3) runStr = `<span class="ov-sim-warning">Runs / Week: ${runsPerWeek.toFixed(2)} (High! Requires backing)</span>`;
            if (runsPerWeek > 7) runStr = `<span class="ov-sim-warning">Runs / Week: ${runsPerWeek.toFixed(2)} (Impossible! Exceeds 7 days)</span>`;
            
            let potWarning = "";
            if (targetIdx > potential.maxIdx) potWarning = `<br><span class="ov-sim-warning">\u26a0 LIMIT EXCEEDED: ${potential.name} limits target to ${potential.maxRankTier}!</span>`;

            summaryDiv.innerHTML = `
                Total Slain: <strong style="color:#ffb700">${totalSimKills.toLocaleString()}</strong> | 
                Total Runs: <strong>${totalRuns.toLocaleString()}</strong><br>
                Time Engaged: <strong>${years.toFixed(2)} Years</strong><br>
                ${runStr} ${potWarning}
            `;
            tableDiv.innerHTML = tableHTML;

            const yearsActive = Math.max(0, retiredAge - awakenedAge);
            const stdRuns = 3; 
            const stdYears = totalRuns / (stdRuns * 52);
            
            let analysis = "";
            if (targetIdx <= 1) analysis = `Subject is practically Dormant. Timeline not applicable.`;
            else if (yearsActive === 0 && stdYears > 1) analysis = `\u26a0 Subject is far too young/recently awakened for Rank ${RANKS[targetIdx].rank}. High probability of external essence backing or anomalous rapid awakening.`;
            else if (stdYears > yearsActive * 1.5) analysis = `Subject's progression highly outpaces expected timelines. Indicative of extreme dedication (>3 runs/wk) or faction sponsorship.`;
            else if (yearsActive > stdYears * 2) analysis = `Subject's timeline (${yearsActive}y) vastly exceeds required projection (${stdYears.toFixed(1)}y). Indicative of extended downtime, severe injury, or low efficiency combat loops.`;
            else analysis = `Subject timeline (${yearsActive}y) aligns closely with standard core projection (${stdYears.toFixed(1)}y at 3 runs/wk).`;

            let retirementStr = retiredRaw === 'active' ? 'Active' : `Retired at ${retiredAge}`;
            analysisDiv.innerHTML = `<strong>TIMELINE ESTIMATOR:</strong> Awakened at ${awakenedAge} yrs. ${retirementStr}. Active ~${yearsActive} yrs.<br><span style="color:#a3a8b5; display:block; margin-top:5px;">${analysis}</span>`;
        }

        [rankSel, potSel, ageInp, awakenedInp, retiredInp, runsInp, yearsInp].forEach(el => el.addEventListener('input', runSim));
        modeRadios.forEach(r => r.addEventListener('change', e => {
            if (e.target.value === 'findTime') { runsInp.disabled = false; yearsInp.disabled = true; }
            else { runsInp.disabled = true; yearsInp.disabled = false; }
            runSim();
        }));

        // ═══════════════════════════════════════════════════════════
        // FIX 1 (continued): ovRenderInFlight set BEFORE processFrontMatter
        // FIX v7.2: Update local page object directly — bypasses Dataview
        // cache latency that caused stale re-renders & flickering dropdowns.
        // ═══════════════════════════════════════════════════════════
        saveBtn.addEventListener('click', async () => {
            saveBtn.textContent = "UPDATING..."; saveBtn.disabled = true;
            const preState = captureDetailOpenState();
            window.ovSkipScrollRestore = true;
            // Set the flag BEFORE processFrontMatter to block auto-refresh
            window.ovRenderInFlight = true;

            // Capture new values BEFORE processFrontMatter so we can
            // update local state immediately after save (v7.2 fix).
            const newRank = RANKS[parseInt(rankSel.value)].rank;
            const newPotential = POTENTIALS[parseInt(potSel.value)].name;
            const newAge = parseInt(ageInp.value) || 15;
            const newAwakened = parseInt(awakenedInp.value) || 15;
            const retVal = retiredInp.value.trim().toLowerCase();
            const newRetired = (retVal === 'active' || isNaN(parseInt(retVal))) ? 'active' : parseInt(retVal);

            await app.fileManager.processFrontMatter(
                app.vault.getAbstractFileByPath(filePath),
                fm => {
                    fm.rank = newRank;
                    fm.core_potential = newPotential;
                    fm.age = newAge;
                    fm.awakened_at = newAwakened;
                    fm.retired_at = newRetired;
                }
            );

            // CRITICAL v7.2: Update local page object with confirmed saved
            // values. Prevents stale Dataview cache from corrupting overlay.
            p.rank = newRank;
            p.core_potential = newPotential;
            p.age = newAge;
            p.awakened_at = newAwakened;
            p.retired_at = newRetired;

            await reRenderKeepState(p, preState);
            if (listItem) updateListItem(listItem, newRank);
        });
        
        // COPY BUTTON LOGIC
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const cleanName = (p.name || p.file.name).replace(STRIP_HTML, '');
                const cleanReach = (p.core_reach || '\u2014').replace(STRIP_HTML, '');
                
                const copyText = `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
 COREBEARER  
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
 ${cleanName}
 ${p.age || '\u2014'} | ${p.gender || '\u2014'}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
 Rank: ${p.rank || 'Dormant'}
 Potential: ${p.core_potential || '\u2014'}
 Reach: ${cleanReach}
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501
 PWR: ${getRankFromValue(finalVitals.power)} (${finalVitals.power})
 SPD: ${getRankFromValue(finalVitals.speed)} (${finalVitals.speed})
 VIT: ${getRankFromValue(finalVitals.vitality)} (${finalVitals.vitality})
 PRC: ${getRankFromValue(finalVitals.perception)} (${finalVitals.perception})
 ENG: ${getRankFromValue(finalVitals.energy)} (${finalVitals.energy})
\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501`;
                
                navigator.clipboard.writeText(copyText).then(() => {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = "\u2714 COPIED TO CLIPBOARD!";
                    copyBtn.style.background = "#059669";
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = "#10b981";
                    }, 2000);
                });
            });
        }

        runSim();
    }
}

// ============================================================
// STATE RESTORATION (Prevents Dataview Auto-Refresh Reset)
// ============================================================
if (window.ovActiveSubjectPath && !window.ovRenderInFlight) {
    const activeData = pages.find(p => p.page.file.path === window.ovActiveSubjectPath);
    if (activeData) {
        // Restore detail view in overlay
        const overlay = document.getElementById('ov-detail-overlay');
        if (!overlay) {
            const newOverlay = document.createElement('div');
            newOverlay.className = 'ov-detail-overlay ov-root';
            newOverlay.id = 'ov-detail-overlay';
            newOverlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-ms-overflow-style:none;box-sizing:border-box !important;';
            detailDiv.classList.remove('ov-hidden');
            newOverlay.appendChild(detailDiv);
            document.body.appendChild(newOverlay);
        }
        renderDetail(activeData.page, null).then(() => {
            const autoScroller = getScroller();
            const skipScroll = window.ovSkipScrollRestore;
            if (!skipScroll && window.ovScrollPosition) {
                autoScroller.scrollTop = window.ovScrollPosition;
            }
            autoScroller.style.overflowAnchor = 'none';
            requestAnimationFrame(() => {
                const savedState = window.ovSectionState;
                if (savedState) {
                    if (savedState.calc) {
                        const el = detailContent.querySelector(`#calc-${savedState.cleanId}`);
                        if (el) el.style.display = 'block';
                    }
                    if (savedState.sim) {
                        const el = detailContent.querySelector(`#sim-container-${savedState.cleanId}`);
                        const tg = detailContent.querySelector(`#sim-toggle-${savedState.cleanId}`);
                        if (el) el.style.display = 'block';
                        if (tg && savedState.simToggle) tg.classList.add('active');
                    }
                    if (savedState.prow) {
                        const el = detailContent.querySelector(`#prow-container-${savedState.cleanId}`);
                        const tg = detailContent.querySelector(`#prow-toggle-${savedState.cleanId}`);
                        if (el) el.style.display = 'block';
                        if (tg && savedState.prowToggle) tg.classList.add('active');
                    }
                }
                if (!skipScroll && window.ovScrollPosition) {
                    autoScroller.scrollTop = window.ovScrollPosition;
                }
                autoScroller.style.overflowAnchor = '';
                window.ovSkipScrollRestore = false;
            });
        });
    }
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// PUBLIC API \u2014 Exposed for LMCA module navigation
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
window.ovOpenSubject = function(filePath) {
    const pData = pages.find(p => p.page.file.path === filePath);
    if (!pData) { console.warn("[Overseer] ovOpenSubject: file not found:", filePath); return; }
    window.ovActiveSubjectPath = filePath;
    window.ovScrollPosition = 0;
    window.ovSkipScrollRestore = true;
    if (currentMode === 'lmca') switchMode('overseer');
    const oldOverlay = document.getElementById('ov-detail-overlay');
    if (oldOverlay) {
        if (detailDiv.parentElement === oldOverlay) body.appendChild(detailDiv);
        oldOverlay.remove();
    }
    const overlay = document.createElement('div');
    overlay.className = 'ov-detail-overlay ov-root';
    overlay.id = 'ov-detail-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-ms-overflow-style:none;box-sizing:border-box !important;';
    detailDiv.classList.remove('ov-hidden');
    overlay.appendChild(detailDiv);
    document.body.appendChild(overlay);
    renderDetail(pData.page, null).then(() => {
        overlay.scrollTop = 0;
    });
};
```

// ─────────────────────────────────────────────────────────────
// PROWESS EDITOR v2.0
// DataviewJS — Obsidian Mobile
// Edits:  prowess_base.json  ·  prowess_cache.json  ·  marc_prowess_cache.json
//
// Navigation
//   COREBEARERS → STAT-DRIVEN  (power / speed / perception)
//                 RANK-DRIVEN  (vitality / energy / speed supp. / perc. domain)
//   MARC'S      → HUMAN  |  HYBRID
// ─────────────────────────────────────────────────────────────

const container = dv.container;

// ── FILE PATHS ─────────────────────────────────────────────────
const BASE_PATH       = "prowess_base.json";
const CACHE_PATH      = "prowess_cache.json";
const MARC_PATH       = "marc_prowess_cache.json";

// ── COLORS ─────────────────────────────────────────────────────
const COLORS = {
    power:'#c0392b', speed:'#2980b9', vitality:'#27ae60',
    perception:'#8e44ad', energy:'#d35400',
    speed_rank:'#2980b9', perception_rank:'#8e44ad',
};

// ── FIELD LABELS ───────────────────────────────────────────────
// Corebearer (prowess_base + prowess_cache)
const CB_FIELDS = {
    power:           { lift:'Lifting Capacity', strike:'Strike Force', impact:'Ground Impact', precision:'Force Precision' },
    speed:           { burst:'Burst Velocity', sustained:'Sustained Speed', reaction:'Reaction Time', movement:'Movement' },
    perception:      { sight:'Sight Range', hearing:'Hearing', awareness:'Spatial Awareness', intuition:'Combat Intuition', processing:'Processing Limit' },
    vitality:        { resistance:'Damage Resistance', recovery:'Recovery Rate', stamina:'Stamina', resilience:'Resilience', environmental:'Environmental', lifespan:'Lifespan' },
    energy:          { duration:'Ability Duration', aura:'Aura Projection', burst:'Burst Capacity' },
    speed_rank:      { jump:'Jump Capability', flight:'Flight' },
    perception_rank: { domain:'Domain' },
};
// Marc (marc_prowess_cache) — speed and perception include rank supplements inline
const MARC_FIELDS = {
    power:      CB_FIELDS.power,
    speed:      { ...CB_FIELDS.speed, jump:'Jump Capability', flight:'Flight' },
    vitality:   CB_FIELDS.vitality,
    perception: { ...CB_FIELDS.perception, domain:'Domain' },
    energy:     CB_FIELDS.energy,
};

const RANK_ORDER   = ['F-rank','E-rank','D-rank','C-rank','B-rank','A-rank','S-rank','SS-rank','SSS-rank'];
const MARC_STATS   = ['power','speed','vitality','perception','energy'];
const STAT_TITLES  = ['① POWER','② SPEED','③ VITALITY','④ PERCEPTION','⑤ ENERGY'];

// ── STATE ──────────────────────────────────────────────────────
let activeTab    = 'cb';        // 'cb' | 'marc'
let activeSubTab = 'stat';      // 'stat' | 'rank'
let activeStat   = 'power';
let activeRank   = 'F-rank';
let activeForm   = 'hybrid';

let baseFile  = null;
let cacheFile = null;
let marcFile  = null;
let openPanel = null;           // currently mounted overlay DOM node

// ── FILE HELPERS ───────────────────────────────────────────────
async function loadFile(path, def) {
    try {
        if (await app.vault.adapter.exists(path))
            return JSON.parse(await app.vault.adapter.read(path));
    } catch(e) { console.error('[ProwessEditor]', path, e); }
    return def;
}
async function saveFile(path, data) {
    await app.vault.adapter.write(path, JSON.stringify(data, null, 2));
}

// ── DOM HELPER ─────────────────────────────────────────────────
function el(tag, css, text) {
    const e = document.createElement(tag);
    if (css)  e.style.cssText = css;
    if (text !== undefined) e.textContent = text;
    return e;
}

function divider() {
    return el('div','border-top:1px solid #1a1a22;margin:6px 0;');
}

// ── TAB / PILL BUILDERS ────────────────────────────────────────
const TAB_BASE  = 'flex:1;padding:8px 4px;border-radius:7px;font-size:0.62em;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;';
function makeTab(label, active, onClick) {
    const b = el('button',
        TAB_BASE +
        `background:${active?'rgba(91,138,240,0.12)':'none'};` +
        `border:1px solid ${active?'#5b8af066':'#1e1e28'};` +
        `color:${active?'#5b8af0':'#444'};`,
        label);
    b.onclick = onClick;
    return b;
}
function makeColorTab(label, color, active, onClick) {
    const b = el('button',
        TAB_BASE +
        `flex:none;padding:6px 10px;` +
        `background:${active?color+'18':'none'};` +
        `border:1px solid ${active?color+'66':'#1e1e28'};` +
        `color:${active?color:'#444'};`,
        label);
    b.onclick = onClick;
    return b;
}
function makeRankPill(rank, hasData, active, onClick) {
    const short = rank.replace('-rank','');
    const b = el('button',
        `padding:4px 8px;border-radius:5px;` +
        `font-size:0.58em;font-weight:900;letter-spacing:0.08em;` +
        `cursor:${hasData?'pointer':'default'};` +
        `background:${active?'rgba(91,138,240,0.15)':'none'};` +
        `border:1px solid ${active?'#5b8af066':hasData?'#2a2a38':'#16161e'};` +
        `color:${active?'#5b8af0':hasData?'#666':'#252525'};`,
        short);
    if (hasData && onClick) b.onclick = onClick;
    return b;
}

// ── DATA GETTERS ───────────────────────────────────────────────
function getStatDrivenArr(stat) {
    return baseFile?.stat_driven?.[stat] || [];
}
function getStatCacheArr(stat) {
    return cacheFile?.[stat] || [];
}
function getRankDrivenArr(stat) {
    // stat: 'vitality'|'energy'|'speed_rank'|'perception_rank'
    const baseKey  = stat === 'speed_rank' ? 'speed' : stat === 'perception_rank' ? 'perception' : stat;
    const cacheKey = stat; // cache uses speed_rank / perception_rank as keys
    return {
        base:  baseFile?.rank_driven?.[baseKey] || [],
        cache: cacheFile?.[cacheKey] || [],
    };
}

// Merge base + cache, cache wins if same v (stat-driven)
function mergedStatEntries(stat) {
    const map = new Map();
    getStatDrivenArr(stat).forEach(e  => map.set(e.v, { entry:e, src:'base' }));
    getStatCacheArr(stat).forEach(e   => map.set(e.v, { entry:e, src:'cache' }));
    return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([,d])=>d);
}

// Merge base + cache for rank-driven at a given rank
function mergedRankEntries(stat, rank) {
    const { base, cache } = getRankDrivenArr(stat);
    const map = new Map();
    base.filter(e=>e.rank===rank).forEach(e  => map.set(e.v, { entry:e, src:'base' }));
    cache.filter(e=>e.rank===rank).forEach(e => map.set(e.v, { entry:e, src:'cache' }));
    return [...map.entries()].sort((a,b)=>a[0]-b[0]).map(([,d])=>d);
}

function availableRanks(stat) {
    const { base, cache } = getRankDrivenArr(stat);
    const all = [...base, ...cache].map(e=>e.rank).filter(Boolean);
    return RANK_ORDER.filter(r => all.includes(r));
}

// ── SAVE HELPERS ───────────────────────────────────────────────
async function saveEntryField(stat, entry, fieldKey, newVal, src, isRankDriven, rank) {
    entry.fields[fieldKey] = newVal;
    if (src === 'base') {
        // Write directly to base
        const bKey = stat === 'speed_rank' ? 'speed' : stat === 'perception_rank' ? 'perception' : stat;
        if (isRankDriven) {
            const arr = baseFile.rank_driven[bKey];
            const idx = arr.findIndex(e=>e.v===entry.v && e.rank===rank);
            if (idx>=0) arr[idx] = entry;
        } else {
            const arr = baseFile.stat_driven[stat];
            const idx = arr.findIndex(e=>e.v===entry.v);
            if (idx>=0) arr[idx] = entry;
        }
        await saveFile(BASE_PATH, baseFile);
    } else {
        const cKey = isRankDriven ? stat : stat; // same key both cases
        const arr  = cacheFile[cKey] || [];
        const idx  = isRankDriven
            ? arr.findIndex(e=>e.v===entry.v && e.rank===rank)
            : arr.findIndex(e=>e.v===entry.v);
        if (idx>=0) arr[idx] = entry;
        await saveFile(CACHE_PATH, cacheFile);
    }
}

async function saveMarcField(form, stat, fieldKey, newVal) {
    if (!marcFile[form])       marcFile[form] = {};
    if (!marcFile[form][stat]) marcFile[form][stat] = {};
    marcFile[form][stat][fieldKey] = newVal;
    await saveFile(MARC_PATH, marcFile);
}

// ── ADD NEW ENTRY (always writes to base) ──────────────────────
async function addEntry(stat, v, rank, fields, isRankDriven) {
    if (isRankDriven) {
        const bKey = stat === 'speed_rank' ? 'speed' : stat === 'perception_rank' ? 'perception' : stat;
        if (!baseFile.rank_driven)        baseFile.rank_driven = {};
        if (!baseFile.rank_driven[bKey])  baseFile.rank_driven[bKey] = [];
        const arr = baseFile.rank_driven[bKey];
        if (arr.find(e=>e.v===v && e.rank===rank)) { new Notice(`RV ${v} / ${rank} already exists`); return false; }
        arr.push({ rank, v, fields });
        arr.sort((a,b)=>a.v-b.v);
    } else {
        if (!baseFile.stat_driven)        baseFile.stat_driven = {};
        if (!baseFile.stat_driven[stat])  baseFile.stat_driven[stat] = [];
        const arr = baseFile.stat_driven[stat];
        if (arr.find(e=>e.v===v)) { new Notice(`RV ${v} already exists in ${stat}`); return false; }
        arr.push({ v, fields });
        arr.sort((a,b)=>a.v-b.v);
    }
    await saveFile(BASE_PATH, baseFile);
    return true;
}

// ─────────────────────────────────────────────────────────────
// FIELD ROW — shared between overlay and Marc inline view
// ─────────────────────────────────────────────────────────────
function buildFieldRow(parent, fieldKey, fieldLabel, currentVal, color, onSave) {
    const iStyle = `width:100%;box-sizing:border-box;background:#060608;border:1px solid #2a2a35;border-radius:6px;color:#E7D9B0;font-size:0.82em;padding:7px 8px;margin-bottom:6px;font-family:var(--font-text);`;

    const row    = el('div', 'padding:8px 0;border-bottom:1px solid #13131a;');
    const topBar = el('div', 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;');
    topBar.appendChild(el('span',`font-size:0.63em;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};`,fieldLabel));

    const editBtn = el('button',
        `background:none;border:1px solid ${color}44;border-radius:5px;color:${color};font-size:0.57em;font-weight:900;letter-spacing:0.08em;padding:3px 9px;cursor:pointer;`,
        '✎ EDIT');
    topBar.appendChild(editBtn);
    row.appendChild(topBar);

    const display   = el('div','');
    const editArea  = el('div','display:none;margin-top:6px;');
    row.appendChild(display);
    row.appendChild(editArea);
    parent.appendChild(row);

    // Render the current value for display
    function showVal(val) {
        display.innerHTML = '';
        if (!val && val !== 0) {
            display.appendChild(el('span','font-size:0.8em;color:#2e2e3a;font-style:italic;','— no data —'));
            return;
        }
        if (typeof val === 'object') {
            if ((val.value || val.value === 0) && val.value !== 0) {
                const badge = el('span',
                    `display:inline-block;font-size:0.68em;font-weight:900;font-family:monospace;` +
                    `color:${color};background:rgba(255,255,255,0.03);border:1px solid ${color}33;` +
                    `border-radius:4px;padding:1px 6px;margin-bottom:4px;`,
                    `${val.value}${val.unit ? ' '+val.unit : ''}`);
                display.appendChild(badge);
                display.appendChild(document.createElement('br'));
            }
            display.appendChild(el('span','font-size:0.85em;line-height:1.55;color:#C0B298;', val.desc || '—'));
        } else {
            display.appendChild(el('span','font-size:0.85em;line-height:1.55;color:#C0B298;', val));
        }
    }

    let live = currentVal;
    showVal(live);

    editBtn.onclick = () => {
        if (editArea.style.display !== 'none') {
            editArea.style.display = 'none';
            editBtn.textContent = '✎ EDIT';
            return;
        }
        editArea.innerHTML  = '';
        editArea.style.display = 'block';
        editBtn.textContent = '▲ DONE';

        const isObj = live && typeof live === 'object';
        let vInp, uInp, dInp, flatInp;

        if (isObj || !live) {
            const vRow = el('div','display:flex;gap:6px;');
            vInp = document.createElement('input');
            vInp.type = 'number'; vInp.value = isObj ? (live?.value ?? '') : '';
            vInp.placeholder = 'value';
            vInp.style.cssText = iStyle + 'flex:1;margin-bottom:0;';
            uInp = document.createElement('input');
            uInp.type = 'text'; uInp.value = isObj ? (live?.unit ?? '') : '';
            uInp.placeholder = 'unit';
            uInp.style.cssText = iStyle + 'flex:1;margin-bottom:0;';
            vRow.appendChild(vInp); vRow.appendChild(uInp);
            editArea.appendChild(vRow);
            dInp = document.createElement('textarea');
            dInp.rows = 4; dInp.value = isObj ? (live?.desc ?? '') : '';
            dInp.style.cssText = iStyle + 'resize:vertical;display:block;margin-top:6px;';
            editArea.appendChild(dInp);
        } else {
            flatInp = document.createElement('textarea');
            flatInp.rows = 4; flatInp.value = live || '';
            flatInp.style.cssText = iStyle + 'resize:vertical;display:block;';
            editArea.appendChild(flatInp);
        }

        const btnRow  = el('div','display:flex;gap:6px;margin-top:8px;');
        const saveBtn = el('button',
            'flex:1;padding:9px;background:rgba(39,174,96,0.14);border:1px solid #27ae60;border-radius:6px;color:#27ae60;font-size:0.65em;font-weight:900;letter-spacing:0.1em;cursor:pointer;',
            '✓ SAVE');
        const canBtn  = el('button',
            'flex:1;padding:9px;background:none;border:1px solid #2a2a35;border-radius:6px;color:#444;font-size:0.65em;font-weight:900;letter-spacing:0.1em;cursor:pointer;',
            '✕ CANCEL');
        btnRow.appendChild(saveBtn); btnRow.appendChild(canBtn);
        editArea.appendChild(btnRow);

        canBtn.onclick = () => { editArea.style.display='none'; editBtn.textContent='✎ EDIT'; };

        saveBtn.onclick = async () => {
            saveBtn.textContent = '⌛'; saveBtn.disabled = true;
            const newVal = flatInp
                ? flatInp.value.trim()
                : { value: parseFloat(vInp.value)||0, unit: uInp.value.trim(), desc: dInp.value.trim() };
            live = newVal;
            await onSave(fieldKey, newVal);
            new Notice(`✓ Saved: ${fieldLabel}`, 3000);
            editArea.style.display = 'none'; editBtn.textContent = '✎ EDIT';
            showVal(newVal);
        };
    };
}

// ─────────────────────────────────────────────────────────────
// OVERLAY — for Corebearer RV entry editing
// ─────────────────────────────────────────────────────────────
function closePanel() {
    if (openPanel) { openPanel.remove(); openPanel = null; }
}

function openEntryPanel(stat, { entry, src }, isRankDriven, rank) {
    closePanel();
    const color   = COLORS[stat] || '#5b8af0';
    const labels  = CB_FIELDS[stat] || {};
    const srcCol  = src === 'cache' ? '#5b8af0' : '#27ae60';

    const overlay = el('div',
        'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.88);z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;');
    openPanel = overlay;

    const panel = el('div','margin:14px 10px 48px;background:#0e0e14;border-radius:14px;overflow:hidden;border:1px solid #1e1e2a;');
    overlay.appendChild(panel);

    // Header
    const hdr = el('div',
        'display:flex;align-items:center;justify-content:space-between;padding:12px 15px;background:#121218;border-bottom:1px solid #1a1a24;position:sticky;top:0;z-index:10;');
    const htitle = el('div','display:flex;flex-direction:column;gap:3px;');
    htitle.appendChild(el('span',
        `font-size:0.88em;font-weight:900;letter-spacing:0.1em;font-family:monospace;color:${color};`,
        `RV ${entry.v}${rank ? '  ·  '+rank.replace('-rank','').toUpperCase() : ''}`));
    htitle.appendChild(el('span',
        'font-size:0.6em;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#3a3a4a;',
        stat.replace('_rank',' supplement').toUpperCase()));
    hdr.appendChild(htitle);

    const rw = el('div','display:flex;align-items:center;gap:8px;');
    rw.appendChild(el('span',
        `font-size:0.57em;font-weight:900;padding:2px 7px;border-radius:4px;border:1px solid ${srcCol}33;background:${srcCol}12;color:${srcCol};`,
        src.toUpperCase()));
    const closeBtn = el('button',
        'background:none;border:1px solid #2a2a35;border-radius:6px;color:#666;font-size:0.65em;font-weight:900;padding:4px 10px;cursor:pointer;',
        '✕');
    closeBtn.onclick = closePanel;
    rw.appendChild(closeBtn);
    hdr.appendChild(rw);
    panel.appendChild(hdr);

    const body = el('div','padding:2px 14px 14px;');
    panel.appendChild(body);

    for (const [fk, fl] of Object.entries(labels)) {
        buildFieldRow(body, fk, fl, (entry.fields||{})[fk], color, async (k, v) => {
            await saveEntryField(stat, entry, k, v, src, isRankDriven, rank);
        });
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) closePanel(); });
    document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────────────────────
// ADD NEW ENTRY PANEL
// ─────────────────────────────────────────────────────────────
function openAddPanel(stat, isRankDriven) {
    closePanel();
    const color  = COLORS[stat] || '#5b8af0';
    const labels = CB_FIELDS[stat] || {};
    const iStyle = `width:100%;box-sizing:border-box;background:#060608;border:1px solid #2a2a35;border-radius:6px;color:#E7D9B0;font-size:0.82em;padding:7px 8px;margin-bottom:8px;font-family:var(--font-text);`;

    const overlay = el('div',
        'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.88);z-index:9999;overflow-y:auto;-webkit-overflow-scrolling:touch;');
    openPanel = overlay;

    const panel = el('div','margin:14px 10px 48px;background:#0e0e14;border-radius:14px;overflow:hidden;border:1px solid #1e1e2a;');
    overlay.appendChild(panel);

    const hdr = el('div',
        'display:flex;align-items:center;justify-content:space-between;padding:12px 15px;background:#121218;border-bottom:1px solid #1a1a24;');
    hdr.appendChild(el('span',
        `font-size:0.78em;font-weight:900;letter-spacing:0.1em;color:${color};`,
        `+ NEW ENTRY — ${stat.replace('_rank',' SUPP.').toUpperCase()}`));
    const closeBtn = el('button',
        'background:none;border:1px solid #2a2a35;border-radius:6px;color:#666;font-size:0.65em;font-weight:900;padding:4px 10px;cursor:pointer;',
        '✕');
    closeBtn.onclick = closePanel;
    hdr.appendChild(closeBtn);
    panel.appendChild(hdr);

    const body = el('div','padding:14px;');
    panel.appendChild(body);

    // RV input
    body.appendChild(el('div','font-size:0.6em;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#555;margin-bottom:4px;','RV VALUE'));
    const rvInp = document.createElement('input');
    rvInp.type='number'; rvInp.step='0.01'; rvInp.placeholder='e.g. 14.5';
    rvInp.style.cssText = iStyle;
    body.appendChild(rvInp);

    // Rank selector (rank-driven only)
    let rankSel = null;
    if (isRankDriven) {
        body.appendChild(el('div','font-size:0.6em;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#555;margin-bottom:4px;','RANK'));
        rankSel = document.createElement('select');
        rankSel.style.cssText = iStyle + 'appearance:none;-webkit-appearance:none;cursor:pointer;';
        RANK_ORDER.forEach(r => {
            const o = document.createElement('option');
            o.value=r; o.textContent=r; rankSel.appendChild(o);
        });
        rankSel.value = activeRank;
        body.appendChild(rankSel);
    }

    // Field inputs
    const inputs = {};
    for (const [fk, fl] of Object.entries(labels)) {
        body.appendChild(divider());
        body.appendChild(el('div',`font-size:0.65em;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${color};margin-bottom:6px;margin-top:6px;`,fl));
        const vr = el('div','display:flex;gap:6px;');
        const vi = document.createElement('input');
        vi.type='number'; vi.placeholder='value';
        vi.style.cssText = iStyle + 'flex:1;margin-bottom:0;';
        const ui = document.createElement('input');
        ui.type='text'; ui.placeholder='unit';
        ui.style.cssText = iStyle + 'flex:1;margin-bottom:0;';
        vr.appendChild(vi); vr.appendChild(ui);
        body.appendChild(vr);
        const di = document.createElement('textarea');
        di.rows=3; di.placeholder='description';
        di.style.cssText = iStyle + 'resize:vertical;display:block;margin-top:6px;';
        body.appendChild(di);
        inputs[fk] = { v:vi, u:ui, d:di };
    }

    const saveBtn = el('button',
        'width:100%;padding:12px;background:rgba(39,174,96,0.14);border:1px solid #27ae60;border-radius:8px;color:#27ae60;font-size:0.72em;font-weight:900;letter-spacing:0.12em;cursor:pointer;margin-top:14px;',
        '✓ ADD TO BASE');
    body.appendChild(saveBtn);

    saveBtn.onclick = async () => {
        const v = parseFloat(rvInp.value);
        if (isNaN(v)) { new Notice('Enter a valid RV'); return; }
        saveBtn.textContent = '⌛'; saveBtn.disabled = true;
        const fields = {};
        for (const [fk, inp] of Object.entries(inputs)) {
            fields[fk] = { value: parseFloat(inp.v.value)||0, unit: inp.u.value.trim(), desc: inp.d.value.trim() };
        }
        const rank = rankSel?.value || activeRank;
        const ok   = await addEntry(stat, v, rank, fields, isRankDriven);
        if (ok) { closePanel(); renderEditor(); }
        else { saveBtn.textContent = '✓ ADD TO BASE'; saveBtn.disabled = false; }
    };

    overlay.addEventListener('click', e => { if (e.target===overlay) closePanel(); });
    document.body.appendChild(overlay);
}

// ─────────────────────────────────────────────────────────────
// RV GRID
// ─────────────────────────────────────────────────────────────
function buildRVGrid(parent, merged, stat, isRankDriven, rank) {
    if (!merged.length) {
        parent.appendChild(el('div','font-size:0.78em;color:#2e2e3a;padding:12px 0;font-style:italic;','No entries found.'));
        return;
    }
    const grid = el('div','display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;');
    const color = COLORS[stat];
    merged.forEach(({ entry, src }) => {
        const sc = src==='cache'?'#5b8af0':'#27ae60';
        const pill = el('div',
            'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;' +
            'padding:10px 6px;border-radius:10px;cursor:pointer;text-align:center;' +
            'border:1px solid #1a1a24;background:rgba(255,255,255,0.015);');
        pill.appendChild(el('span',
            `font-size:0.8em;font-weight:900;font-family:monospace;color:#8a8aa0;letter-spacing:0.06em;`,
            `RV ${entry.v}`));
        pill.appendChild(el('span',
            `font-size:0.5em;font-weight:900;padding:1px 6px;border-radius:3px;border:1px solid ${sc}33;background:${sc}10;color:${sc};`,
            src.toUpperCase()));
        pill.addEventListener('touchstart', ()=>{pill.style.background=`${color}12`;pill.style.borderColor=`${color}55`;},{passive:true});
        pill.addEventListener('touchend',   ()=>{pill.style.background='rgba(255,255,255,0.015)';pill.style.borderColor='#1a1a24';},{passive:true});
        pill.onclick = () => openEntryPanel(stat, { entry, src }, isRankDriven, rank);
        grid.appendChild(pill);
    });
    parent.appendChild(grid);
}

// ─────────────────────────────────────────────────────────────
// RENDER — COREBEARER TAB
// ─────────────────────────────────────────────────────────────
function renderCorebearer(root) {
    // Sub-tabs
    const subRow = el('div','display:flex;gap:6px;margin-bottom:12px;');
    subRow.appendChild(makeTab('STAT-DRIVEN', activeSubTab==='stat', ()=>{ activeSubTab='stat'; activeStat='power'; renderEditor(); }));
    subRow.appendChild(makeTab('RANK-DRIVEN', activeSubTab==='rank', ()=>{ activeSubTab='rank'; activeStat='vitality'; renderEditor(); }));
    root.appendChild(subRow);

    if (activeSubTab === 'stat') {
        // Stat pills
        const sRow = el('div','display:flex;gap:5px;margin-bottom:12px;');
        for (const s of ['power','speed','perception'])
            sRow.appendChild(makeColorTab(s.toUpperCase(), COLORS[s], activeStat===s, ()=>{ activeStat=s; renderEditor(); }));
        root.appendChild(sRow);

        // Add button
        const add = el('button',
            'width:100%;padding:9px;background:rgba(91,138,240,0.05);border:1px dashed #5b8af040;border-radius:8px;color:#5b8af0;font-size:0.62em;font-weight:900;letter-spacing:0.1em;cursor:pointer;margin-bottom:10px;',
            '+ ADD NEW ENTRY');
        add.onclick = () => openAddPanel(activeStat, false);
        root.appendChild(add);

        buildRVGrid(root, mergedStatEntries(activeStat), activeStat, false, null);

    } else {
        // Stat pills for rank-driven
        const rankStats = [
            { key:'vitality', label:'VITALITY' },
            { key:'energy',   label:'ENERGY'   },
            { key:'speed_rank',      label:'SPD SUPP.' },
            { key:'perception_rank', label:'PRC DOMAIN' },
        ];
        const sRow = el('div','display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px;');
        for (const {key,label} of rankStats)
            sRow.appendChild(makeColorTab(label, COLORS[key], activeStat===key, ()=>{ activeStat=key; renderEditor(); }));
        root.appendChild(sRow);

        // Rank filter
        const avail = availableRanks(activeStat);
        if (avail.length && !avail.includes(activeRank)) activeRank = avail[0];
        const rRow = el('div','display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;');
        for (const r of RANK_ORDER)
            rRow.appendChild(makeRankPill(r, avail.includes(r), activeRank===r, ()=>{ activeRank=r; renderEditor(); }));
        root.appendChild(rRow);

        // Add button
        const add = el('button',
            'width:100%;padding:9px;background:rgba(91,138,240,0.05);border:1px dashed #5b8af040;border-radius:8px;color:#5b8af0;font-size:0.62em;font-weight:900;letter-spacing:0.1em;cursor:pointer;margin-bottom:10px;',
            `+ ADD NEW ENTRY (${activeRank})`);
        add.onclick = () => openAddPanel(activeStat, true);
        root.appendChild(add);

        buildRVGrid(root, mergedRankEntries(activeStat, activeRank), activeStat, true, activeRank);
    }
}

// ─────────────────────────────────────────────────────────────
// RENDER — MARC'S TAB
// ─────────────────────────────────────────────────────────────
function renderMarc(root) {
    // Form tabs
    const fRow = el('div','display:flex;gap:6px;margin-bottom:14px;');
    fRow.appendChild(makeTab('HUMAN',  activeForm==='human',  ()=>{ activeForm='human';  renderEditor(); }));
    fRow.appendChild(makeTab('HYBRID', activeForm==='hybrid', ()=>{ activeForm='hybrid'; renderEditor(); }));
    root.appendChild(fRow);

    const formData = marcFile?.[activeForm];
    if (!formData) {
        root.appendChild(el('div',
            'font-size:0.8em;color:#2a2a38;padding:14px 0;font-style:italic;',
            `No data for ${activeForm} form yet. Run an Update from the Devour HUD first.`));
        return;
    }

    // Snapshot banner
    const snap     = formData.stats_snapshot || {};
    const snapRank = formData.rank_snapshot;
    const banner   = el('div','background:#0a0a10;border:1px solid #18181f;border-radius:8px;padding:8px 12px;margin-bottom:14px;');
    banner.appendChild(el('div','font-size:0.57em;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;color:#2e2e3a;margin-bottom:3px;','SNAPSHOT AT LAST GENERATION'));
    const snapLine = el('div','font-size:0.63em;color:#3a3a4a;font-family:monospace;');
    let snapText = snapRank ? `Rank: ${snapRank}  ·  ` : 'No rank  ·  ';
    snapText += Object.entries(snap).map(([k,v])=>`${k[0].toUpperCase()}:${v}`).join('  ');
    snapLine.textContent = snapText;
    banner.appendChild(snapLine);
    root.appendChild(banner);

    // Stat sections
    MARC_STATS.forEach((stat, i) => {
        const color     = COLORS[stat];
        const statData  = formData[stat] || null;
        const fields    = MARC_FIELDS[stat] || {};
        const isEnergy  = stat === 'energy';

        const section = el('div','margin-top:4px;');
        const secHdr  = el('div',
            `font-size:0.7em;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;` +
            `color:${color};${!statData?'opacity:0.35;':''}` +
            `padding:10px 0 5px;border-bottom:2px solid ${color}${statData?'55':'18'};margin-bottom:2px;`);

        const labelText = STAT_TITLES[i];
        secHdr.textContent = statData
            ? labelText
            : labelText + (isEnergy ? '  — empty (no Core / no energy traits)' : '  — not generated yet');
        section.appendChild(secHdr);
        root.appendChild(section);

        if (!statData) return;

        // Build field rows — always show base fields; show supplements only if cached
        for (const [fk, fl] of Object.entries(fields)) {
            const isSuppl   = ['jump','flight','domain'].includes(fk);
            const inCache   = statData[fk] !== undefined;
            if (isSuppl && !inCache) continue; // supplements only appear after awakening
            buildFieldRow(section, fk, fl, statData[fk] ?? null, color, async (k, v) => {
                await saveMarcField(activeForm, stat, k, v);
            });
        }
    });
}

// ─────────────────────────────────────────────────────────────
// MAIN RENDER
// ─────────────────────────────────────────────────────────────
async function renderEditor() {
    closePanel();
    container.innerHTML = '';
    container.style.cssText = 'font-family:var(--font-text);padding:4px 0;';

    baseFile  = await loadFile(BASE_PATH,  {});
    cacheFile = await loadFile(CACHE_PATH, { power:[],speed:[],perception:[],vitality:[],energy:[],speed_rank:[],perception_rank:[] });
    marcFile  = await loadFile(MARC_PATH,  {});

    // Title
    container.appendChild(el('div',
        'font-size:0.6em;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:#25253a;padding:6px 0 12px;',
        '// PROWESS EDITOR'));

    // Top tabs
    const topRow = el('div','display:flex;gap:6px;margin-bottom:14px;');
    topRow.appendChild(makeTab('COREBEARERS', activeTab==='cb',   ()=>{ activeTab='cb';   activeStat='power';    activeSubTab='stat'; renderEditor(); }));
    topRow.appendChild(makeTab("MARC'S",      activeTab==='marc', ()=>{ activeTab='marc'; renderEditor(); }));
    container.appendChild(topRow);

    if (activeTab === 'cb') {
        renderCorebearer(container);
    } else {
        renderMarc(container);
    }
}

renderEditor();

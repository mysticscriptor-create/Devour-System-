---
obsidianUIMode: preview
cssclasses:
  - full-page-db
---


```dataviewjs
// ======================================================
//  DEVOUR SYSTEM HUD - UNIFIED (Human + Hybrid) V3
//  + DEVOURED TRAITS SIMULATION PANEL
//  + TRAIT FLOATING MODAL
// ======================================================

(async () => {
    // --- 1. CONFIGURATION ---
    const RANKS = [
        { rank: "Dormant", val: 3,  euPerKill: 3,  euRequired: 0, tier: "Dormant" },
        { rank: "F−",   val: 8,  euPerKill: 8,  euRequired: 0,       tier: "F" },
        { rank: "F",    val: 10, euPerKill: 15, euRequired: 104464,   tier: "F" },
        { rank: "F+",   val: 13, euPerKill: 22, euRequired: 104464,   tier: "F" },
        { rank: "F++",  val: 16, euPerKill: 30, euRequired: 104464,   tier: "F" },
        { rank: "F+++", val: 20, euPerKill: 50, euRequired: 125357,   tier: "F" },
        { rank: "E−",   val: 21, euPerKill: 60,  euRequired: 0,        tier: "E" },
        { rank: "E",    val: 30, euPerKill: 80,  euRequired: 1035714,   tier: "E" },
        { rank: "E+",   val: 37, euPerKill: 130, euRequired: 1035714,   tier: "E" },
        { rank: "E++",  val: 44, euPerKill: 170, euRequired: 1035714,   tier: "E" },
        { rank: "E+++", val: 50, euPerKill: 200, euRequired: 1242857,   tier: "E" },
        { rank: "D−",   val: 51,  euPerKill: 220, euRequired: 0,          tier: "D" },
        { rank: "D",    val: 100, euPerKill: 350, euRequired: 6845238,     tier: "D" },
        { rank: "D+",   val: 160, euPerKill: 500, euRequired: 6845238,     tier: "D" },
        { rank: "D++",  val: 230, euPerKill: 650, euRequired: 6845238,     tier: "D" },
        { rank: "D+++", val: 300, euPerKill: 800, euRequired: 8214286,     tier: "D" },
        { rank: "C−",   val: 301,  euPerKill: 900,  euRequired: 0,           tier: "C" },
        { rank: "C",    val: 800,  euPerKill: 1400, euRequired: 38333333,     tier: "C" },
        { rank: "C+",   val: 1050, euPerKill: 2000, euRequired: 38333333,     tier: "C" },
        { rank: "C++",  val: 1250, euPerKill: 2600, euRequired: 38333333,     tier: "C" },
        { rank: "C+++", val: 1500, euPerKill: 3200, euRequired: 46000000,     tier: "C" },
        { rank: "B−",   val: 1501, euPerKill: 3800,  euRequired: 0,             tier: "B" },
        { rank: "B",    val: 2500, euPerKill: 6000,  euRequired: 337857143,     tier: "B" },
        { rank: "B+",   val: 2900, euPerKill: 9000,  euRequired: 337857143,     tier: "B" },
        { rank: "B++",  val: 3200, euPerKill: 12000, euRequired: 337857143,     tier: "B" },
        { rank: "B+++", val: 3500, euPerKill: 16000, euRequired: 405428571,     tier: "B" },
        { rank: "A−",   val: 3501,  euPerKill: 20000,  euRequired: 0,               tier: "A" },
        { rank: "A",    val: 5000,  euPerKill: 35000,  euRequired: 3571428571,      tier: "A" },
        { rank: "A+",   val: 6500,  euPerKill: 60000,  euRequired: 3571428571,      tier: "A" },
        { rank: "A++",  val: 8000,  euPerKill: 90000,  euRequired: 3571428571,      tier: "A" },
        { rank: "A+++", val: 10000, euPerKill: 115000, euRequired: 4285714286,      tier: "A" },
        { rank: "S−",   val: 10001, euPerKill: 140000,  euRequired: 0,                 tier: "S" },
        { rank: "S",    val: 15000, euPerKill: 250000,  euRequired: 50000000000,       tier: "S" },
        { rank: "S+",   val: 25000, euPerKill: 450000,  euRequired: 50000000000,       tier: "S" },
        { rank: "S++",  val: 37000, euPerKill: 700000,  euRequired: 50000000000,       tier: "S" },
        { rank: "S+++", val: 50000, euPerKill: 1000000, euRequired: 60000000000,       tier: "S" },
        { rank: "SS−",   val: 50001,  euPerKill: 1300000,  euRequired: 0,                    tier: "SS" },
        { rank: "SS",    val: 70000,  euPerKill: 2500000,  euRequired: 982142857143,         tier: "SS" },
        { rank: "SS+",   val: 130000, euPerKill: 5000000,  euRequired: 982142857143,         tier: "SS" },
        { rank: "SS++",  val: 210000, euPerKill: 8000000,  euRequired: 982142857143,         tier: "SS" },
        { rank: "SS+++", val: 300000, euPerKill: 12000000, euRequired: 1178571428571,        tier: "SS" },
        { rank: "SSS",   val: 400000,  euPerKill: 20000000,  euRequired: 17261904761905,     tier: "SSS" },
        { rank: "SSS+",  val: 600000,  euPerKill: 40000000,  euRequired: 17261904761905,     tier: "SSS" },
        { rank: "SSS++", val: 900000,  euPerKill: 80000000,  euRequired: 17261904761905,     tier: "SSS" },
        { rank: "SSS+++",val: 1500000, euPerKill: 150000000, euRequired: 20714285714286,     tier: "SSS" }
    ];

    const categories = ["Body", "Cognition", "Flow", "Origin", "Expression"];

    // --- 2. LOAD BOTH SYSTEM PAGES ---
    const sHuman  = dv.page("00 System Human");
    const sHybrid = dv.page("000 A System/00 System Hybrid.md") || dv.page("00 System Hybrid");

    if (!sHuman) {
        dv.container.innerHTML = `<div style="color:red;font-weight:bold;padding:10px;">⚠️ ERROR: Could not find "00 System Human".</div>`;
        return;
    }
    if (!sHybrid || !sHybrid.file) {
        dv.container.innerHTML = `<div style="color:red;font-weight:bold;padding:10px;">⚠️ ERROR: Could not find "00 System Hybrid".</div>`;
        return;
    }

    // --- 3. STATE ---
    let activeForm = "hybrid";
    let simDisabledTraits = null; // null = closed, Set = open

    // --- 4. PER-FORM DATA EXTRACTION ---
    function extractFormData(s) {
        let currentRank = String(s.core_rank || "Dormant").trim();
        let currentEU   = Number(s.current_eu || 0);
        let killCounts  = s.kill_counts || {};
        let rankIndex   = RANKS.findIndex(r => r.rank === currentRank);
        if (rankIndex === -1) rankIndex = 0;
        const rankData     = RANKS[rankIndex];
        const nextRankData = RANKS[rankIndex + 1];
        let progressPct = 0, requiredEU = rankData.euRequired || 1;
        if (nextRankData && requiredEU > 0) progressPct = Math.min(100, (currentEU / requiredEU) * 100);
        else if (!nextRankData) progressPct = 100;
        let rawAuths = s.authorities, auths = [];
        if (rawAuths) {
            if (Array.isArray(rawAuths)) auths = rawAuths;
            else if (rawAuths.values) auths = Array.from(rawAuths.values);
            else if (typeof rawAuths === 'string') auths = rawAuths.split(',').map(a => a.trim());
            else auths = [String(rawAuths)];
        }
        return { currentRank, currentEU, killCounts, rankData, nextRankData, progressPct, requiredEU, auths };
    }

    const dHuman  = extractFormData(sHuman);
    const dHybrid = extractFormData(sHybrid);

    // --- 5. ASYNC STATUS TEXT ---
    async function fetchStatus(s) {
        if (!s || !s.file || !s.file.path) return "";
        const tFile = app.vault.getAbstractFileByPath(s.file.path);
        if (!tFile) return "";
        const content = await app.vault.cachedRead(tFile);
        const match = content.match(/%%STATUS_START%%([\s\S]*?)%%STATUS_ENDS%%/);
        return match ? match[1].trim() : "";
    }

    const [statusHuman, statusHybrid] = await Promise.all([fetchStatus(sHuman), fetchStatus(sHybrid)]);

    // --- 6. HELPERS ---
    const hasTag     = (p, tag) => (p.tags || []).includes(tag);
    const escapeHtml = (str) => String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

    function formatNumber(num) {
        if (num >= 1e12) return (num/1e12).toFixed(1)+'T';
        if (num >= 1e9)  return (num/1e9).toFixed(1)+'B';
        if (num >= 1e6)  return (num/1e6).toFixed(1)+'M';
        if (num >= 1e3)  return (num/1e3).toFixed(1)+'K';
        return num.toString();
    }

    function getRankInfo(total) {
        let r = { rank: "Unranked", val: 0 };
        for (const t of RANKS) { if (total >= t.val) r = t; }
        return r;
    }

    function getTotalBoostString(baseVal, finalVal) {
        const base = Number(baseVal || 0), final = Number(finalVal || 0);
        if (base === 0) return "+0.0% ↑";
        return `+${(((final - base) / base) * 100).toFixed(1)}% ↑`;
    }

    // --- 7. PLAIN TEXT TREE PARSER ---
    function renderPlainTree(text) {
        if (!text) return ["└─ -"];
        const lines = text.split('\n').map(l => l.trim());
        let parsed = [];
        for (const line of lines) {
            if (!line) { parsed.push({ type: 'empty' }); continue; }
            const match = line.match(/^\[([\d.]+)\]\s+(.*)/);
            if (match) {
                const id = match[1], parts = id.split('.'), parentId = parts.slice(0, -1).join('.');
                parsed.push({ type: 'node', id, parentId, text: match[2], isLast: false });
            } else {
                parsed.push({ type: 'text', text: line });
            }
        }
        const nodesOnly = parsed.filter(p => p.type === 'node');
        const parentGroups = {};
        nodesOnly.forEach(n => { if (!parentGroups[n.parentId]) parentGroups[n.parentId] = []; parentGroups[n.parentId].push(n); });
        Object.values(parentGroups).forEach(g => { if (g.length > 0) g[g.length - 1].isLast = true; });
        const nodeMap = {};
        nodesOnly.forEach(n => nodeMap[n.id] = n);
        const out = [];
        for (let i = 0; i < parsed.length; i++) {
            const item = parsed[i];
            if (item.type === 'node') {
                const ancestors = []; let curr = item.parentId;
                while (curr && nodeMap[curr]) { ancestors.unshift(nodeMap[curr]); curr = nodeMap[curr].parentId; }
                let prefix = " ";
                for (const anc of ancestors) prefix += anc.isLast ? "     " : "│    ";
                out.push(prefix + (item.isLast ? "└─ " : "├─ ") + item.text);
            } else if (item.type === 'empty') {
                let nextNode = null;
                for (let j = i+1; j < parsed.length; j++) { if (parsed[j].type === 'node') { nextNode = parsed[j]; break; } }
                if (nextNode) {
                    const ancestors = []; let curr = nextNode.parentId;
                    while (curr && nodeMap[curr]) { ancestors.unshift(nodeMap[curr]); curr = nodeMap[curr].parentId; }
                    let prefix = " ";
                    for (const anc of ancestors) prefix += anc.isLast ? "     " : "│    ";
                    out.push(prefix + "│");
                }
            } else if (item.type === 'text') {
                out.push("   " + item.text);
            }
        }
        return out.length ? out : ["└─ -"];
    }

    // --- 8. STAT CALCULATION ---
    const traitPages = dv.pages('"000 A System/Traits"').filter(p =>
        p.file.name !== "00 System Human" &&
        p.file.name !== "00 System Hybrid" &&
        p.file.name !== "00_System_Status"
    );

    function buildFormTraits(formKey, rankData, disabledNames = null) {
        let active = [], suppressed = 0;
        for (const p of traitPages) {
            const dev = String(p.devoured_in || "Hybrid").trim().toLowerCase();
            const isBound = hasTag(p, "FormBound");
            if (!isBound || (isBound && dev === formKey)) active.push(p);
            else suppressed++;
        }
        const effectiveActive = disabledNames ? active.filter(p => !disabledNames.has(p.file.name)) : active;

        function calcStats(traitList) {
            const rawBase = { power:0, speed:0, vitality:0, perception:0, energy:0 };
            const boost   = { power:0, speed:0, vitality:0, perception:0, energy:0 };
            for (const p of traitList) {
                rawBase.power      += Number(p.stat_power || 0);
                rawBase.speed      += Number(p.stat_speed || 0);
                rawBase.vitality   += Number(p.stat_vitality || 0);
                rawBase.perception += Number(p.stat_perception || 0);
                rawBase.energy     += Number(p.stat_energy || 0);
                boost.power      += Number(p.boost_power || 0);
                boost.speed      += Number(p.boost_speed || 0);
                boost.vitality   += Number(p.boost_vitality || 0);
                boost.perception += Number(p.boost_perception || 0);
                boost.energy     += Number(p.boost_energy || 0);
            }
            const rv = rankData.val || 0, equalSplit = rv / 5;
            const base = {
                power: rawBase.power + equalSplit, speed: rawBase.speed + equalSplit,
                vitality: rawBase.vitality + equalSplit, perception: rawBase.perception + equalSplit,
                energy: rawBase.energy + equalSplit
            };
            const syncAdded = {
                power:      { vit: base.vitality * 0.05, eng: base.energy * 0.02 },
                speed:      { pwr: base.power * 0.03,    eng: base.energy * 0.04 },
                vitality:   { eng: base.energy * 0.05 },
                perception: { eng: base.energy * 0.04 },
                energy:     {}
            };
            const syncBoosted = {
                power:      base.power      + syncAdded.power.vit + syncAdded.power.eng,
                vitality:   base.vitality   + syncAdded.vitality.eng,
                speed:      base.speed      + syncAdded.speed.pwr + syncAdded.speed.eng,
                perception: base.perception + syncAdded.perception.eng,
                energy:     base.energy
            };
            const sp = formKey === "human" ? sHuman : sHybrid;
            const sysMods = {
                power:      parseFloat(String(sp.power      ||"0").replace('%','')) || 0,
                speed:      parseFloat(String(sp.speed      ||"0").replace('%','')) || 0,
                vitality:   parseFloat(String(sp.vitality   ||"0").replace('%','')) || 0,
                perception: parseFloat(String(sp.perception ||"0").replace('%','')) || 0,
                energy:     parseFloat(String(sp.energy     ||"0").replace('%','')) || 0
            };
            const sysBoosted = {
                power:      syncBoosted.power      * (1 + sysMods.power/100),
                speed:      syncBoosted.speed      * (1 + sysMods.speed/100),
                vitality:   syncBoosted.vitality   * (1 + sysMods.vitality/100),
                perception: syncBoosted.perception * (1 + sysMods.perception/100),
                energy:     syncBoosted.energy     * (1 + sysMods.energy/100)
            };
            const final = {
                power:      sysBoosted.power      * (1 + boost.power/100),
                speed:      sysBoosted.speed      * (1 + boost.speed/100),
                vitality:   sysBoosted.vitality   * (1 + boost.vitality/100),
                perception: sysBoosted.perception * (1 + boost.perception/100),
                energy:     sysBoosted.energy     * (1 + boost.energy/100)
            };
            const totalSync = syncBoosted.power + syncBoosted.speed + syncBoosted.vitality + syncBoosted.perception + syncBoosted.energy;
            return { base, syncAdded, syncBoosted, sysMods, sysBoosted, traitBoost: boost, final, combatRank: getRankInfo(totalSync).rank };
        }

        return { name: formKey, active, effectiveActive, suppressed, stats: calcStats(effectiveActive) };
    }

    const fHuman  = buildFormTraits("human",  dHuman.rankData);
    const fHybrid = buildFormTraits("hybrid", dHybrid.rankData);

    // --- 9. ACTIVE FORM ACCESSOR ---
    function getActive(overrideDisabled) {
        const disabled = overrideDisabled !== undefined ? overrideDisabled : simDisabledTraits;
        if (activeForm === "human") {
            const f = (disabled !== null) ? buildFormTraits("human", dHuman.rankData, disabled) : fHuman;
            return { f, d: dHuman,  s: sHuman,  status: statusHuman,  label: "HUMAN",  inactiveLabel: "HYBRID" };
        } else {
            const f = (disabled !== null) ? buildFormTraits("hybrid", dHybrid.rankData, disabled) : fHybrid;
            return { f, d: dHybrid, s: sHybrid, status: statusHybrid, label: "HYBRID", inactiveLabel: "HUMAN"  };
        }
    }

    // --- 10. RAW TEXT BUILDER ---
    function buildRaw() {
        const { f, d, s, status, label } = getActive();
        const b = f.stats.base, fnl = f.stats.final;
        const statusLines = renderPlainTree(status);
        const hybridActive = (label === "HYBRID");
        const formLine1 = hybridActive ? "   ├─ ◆【 Hybrid 】 (Active)" : "   ├─ ◈【 Hybrid 】";
        const formLine2 = hybridActive ? "   └─ ◈【 Human 】"           : "   └─ ◆【 Human 】 (Active)";
        let txt =
`━━━━━━━━━━━━━━━━━━━━━━━━
◈  THE DEVOUR SYSTEM  ◈
━━━━━━━━━━━━━━━━━━━━━━━━

NAME :  ${s.sys_name || "Unknown"}
CORE RANK : ${d.currentRank}
COMBAT RANK : ${f.stats.combatRank}

FORM
${formLine1}
${formLine2}

━━━━━━━━━━━━━━━━━━━━━━━━
STATUS
`;
        txt += statusLines.join("\n") + "\n";
        txt += `
━━━━━━━━━━━━━━━━━━━━━━━━
VITALS
  ├─ Power      : ${getRankInfo(fnl.power).rank} (${getTotalBoostString(b.power, fnl.power)})
  ├─ Speed      : ${getRankInfo(fnl.speed).rank} (${getTotalBoostString(b.speed, fnl.speed)})
  ├─ Vitality   : ${getRankInfo(fnl.vitality).rank} (${getTotalBoostString(b.vitality, fnl.vitality)})
  ├─ Perception : ${getRankInfo(fnl.perception).rank} (${getTotalBoostString(b.perception, fnl.perception)})
  └─ Energy     : ${getRankInfo(fnl.energy).rank} (${getTotalBoostString(b.energy, fnl.energy)})

━━━━━━━━━━━━━━━━━━━━━━━━
AUTHORITY
`;
        if (d.auths.length === 0) txt += `  └─ NONE\n`;
        else d.auths.forEach((auth, idx) => {
            txt += `${idx === d.auths.length-1 ? "  └──" : "  ├──"}${auth.includes("???") ? "◈" : "◆"}${auth}\n`;
        });
        txt += `\n━━━━━━━━━━━━━━━━━━━━━━━━\nTRAITS\n`;
        for (let i = 0; i < categories.length; i++) {
            const cat = categories[i];
            const tList = f.active.filter(p => p.type === cat).sort((a,b) => (b.rank_value||0)-(a.rank_value||0));
            const isLastCat = (i === categories.length - 1);
            txt += `  ${isLastCat ? "└─ " : "├─ "}${cat}\n`;
            if (tList.length === 0) txt += `  ${isLastCat ? " " : "│"}         └─ -\n`;
            else for (let j = 0; j < tList.length; j++) {
                txt += `  ${isLastCat ? " " : "│"}         ${j === tList.length-1 ? "└─ " : "├─ "}${tList[j].file.name} (${tList[j].rank})\n`;
            }
            if (!isLastCat) txt += `  │\n`;
        }
        txt += `\n  ◈ Form-Bound traits:\n         └─ SUPPRESSED [${f.suppressed}]\n━━━━━━━━━━━━━━━━━━━━━━━━`;
        return txt;
    }

    // --- 11. VITAL HTML COMPONENT ---
    function buildVitalHTML(key, label, f, simF = null) {
        const b = f.stats.base[key], fnl = f.stats.final[key];
        const rank = getRankInfo(fnl).rank, sAdd = f.stats.syncAdded[key];
        const tBst = f.stats.traitBoost[key], sMod = f.stats.sysMods[key];
        let simDeltaHTML = "";
        if (simF) {
            const simFnl = simF.stats.final[key], delta = simFnl - fnl;
            if (Math.abs(delta) > 0.01) {
                const color = delta < 0 ? "#ff4444" : "#22a62d", sign = delta > 0 ? "+" : "";
                simDeltaHTML = `<span style="color:${color};font-size:0.8em;margin-left:6px;">${sign}${delta.toFixed(1)} → <b>${getRankInfo(simFnl).rank}</b> (${simFnl.toFixed(1)})</span>`;
            } else {
                simDeltaHTML = `<span style="color:#555;font-size:0.8em;margin-left:6px;">no change</span>`;
            }
        }
        let syncStrChunks = [];
        for (const [src, val] of Object.entries(sAdd)) {
            if (val > 0) syncStrChunks.push(`<span style="color:#88c0d0;">+${val.toFixed(1)}</span><span style="color:#557b88;font-size:0.85em;">${src.toUpperCase()}</span>`);
        }
        const syncStr = syncStrChunks.length > 0 ? syncStrChunks.join(" ") : `<span style="color:#666;">-</span>`;
        let sysStr = "", traitStr = "";
        if (sMod !== 0) { const color = sMod < 0 ? "#ff4444" : "#22a62d", sign = sMod > 0 ? "+" : ""; sysStr = `| <span style="color:${color};">${sign}${sMod}%</span> <span style="color:#666;font-size:0.85em;">SYS</span>`; }
        if (tBst !== 0) { const tSign = tBst > 0 ? "+" : "", tColor = tBst > 0 ? "#a3be8c" : "#ff4444"; traitStr = `| <span style="color:${tColor};">${tSign}${tBst}%</span> <span style="color:#666;font-size:0.85em;">TRT</span>`; }
        return `
        <div class="hud-vital-card" style="display:flex;flex-direction:column;justify-content:center;">
            <div style="font-weight:bold;font-size:0.9em;letter-spacing:0.5px;">
                <span style="color:#ddd;width:35px;display:inline-block;">${label}</span>:
                <span style="color:#00ffff;margin-left:5px;">${escapeHtml(rank)}</span>
                <span style="color:#aaa;font-weight:normal;font-size:0.85em;">(${fnl.toFixed(1)})</span>
                ${simDeltaHTML}
            </div>
            <div style="font-size:0.7em;color:#999;margin-top:3px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;">
                <span style="color:#bbb;">Base: ${b.toFixed(1)}</span>
                <span style="color:#555;">|</span>
                <span>Sync: ${syncStr}</span>
                ${sysStr}${traitStr}
            </div>
        </div>`;
    }

    // --- 12. TRAIT MODAL (reads vault file content) ---
    async function openTraitModal(traitPage) {
        // Remove any existing modal
        const existing = document.getElementById("devour-trait-modal-overlay");
        if (existing) existing.remove();

        // Read raw file content for body sections
        let rawContent = "";
        try {
            const tFile = app.vault.getAbstractFileByPath(traitPage.file.path);
            if (tFile) rawContent = await app.vault.cachedRead(tFile);
        } catch(e) {}

        // Strip frontmatter
        let bodyContent = rawContent.replace(/^---[\s\S]*?---\n?/, "").trim();

        // Parse sections: split on ### or ## headings
        // We'll render them preserving content under each heading
        function parseSections(text) {
            const lines = text.split('\n');
            const sections = [];
            let current = null;
            for (const line of lines) {
                const h1Match = line.match(/^#\s+(.+)/);
                const h2Match = line.match(/^##\s+(.+)/);
                const h3Match = line.match(/^###\s+(.+)/);
                const hrMatch = line.match(/^[-─━]{3,}$/);
                if (h1Match) {
                    if (current) sections.push(current);
                    current = { heading: h1Match[1], level: 1, lines: [] };
                } else if (h2Match) {
                    if (current) sections.push(current);
                    current = { heading: h2Match[1], level: 2, lines: [] };
                } else if (h3Match) {
                    if (current) sections.push(current);
                    current = { heading: h3Match[1], level: 3, lines: [] };
                } else if (hrMatch) {
                    // horizontal rule — skip, used as separators
                } else {
                    if (!current) current = { heading: null, level: 0, lines: [] };
                    current.lines.push(line);
                }
            }
            if (current) sections.push(current);
            return sections.filter(s => s.heading || s.lines.some(l => l.trim()));
        }

        // Convert a line to HTML (basic markdown: bold, italic, blockquote, list, wikilinks)
        function lineToHtml(line) {
            if (!line.trim()) return null;
            let html = escapeHtml(line);
            // Bold **text**
            html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:#d8dee9;">$1</strong>');
            // Italic *text*
            html = html.replace(/\*(.+?)\*/g, '<em style="color:#c0c8d4;">$1</em>');
            // Wikilinks [[Name]]
            html = html.replace(/\[\[([^\]]+)\]\]/g, '<span style="color:#81a1c1;text-decoration:underline;text-decoration-style:dotted;">$1</span>');
            return html;
        }

        function renderSectionContent(lines) {
            let html = '';
            let inList = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) {
                    if (inList) { html += '</ul>'; inList = false; }
                    continue;
                }
                // Blockquote
                if (trimmed.startsWith('> ')) {
                    if (inList) { html += '</ul>'; inList = false; }
                    html += `<blockquote style="border-left:2px solid #4a5a6a;margin:4px 0 4px 4px;padding:2px 8px;color:#99b0c0;font-style:italic;">${lineToHtml(trimmed.slice(2))}</blockquote>`;
                    continue;
                }
                // List item
                const listMatch = trimmed.match(/^[-•]\s+(.*)/);
                if (listMatch) {
                    if (!inList) { html += '<ul style="margin:4px 0 4px 12px;padding:0;list-style:none;">'; inList = true; }
                    html += `<li style="margin-bottom:3px;color:#b0c0cc;font-size:0.88em;">◦ ${lineToHtml(listMatch[1])}</li>`;
                    continue;
                }
                // Indented sub-list
                const subListMatch = line.match(/^\s{2,}[-•]\s+(.*)/);
                if (subListMatch) {
                    if (!inList) { html += '<ul style="margin:4px 0 4px 12px;padding:0;list-style:none;">'; inList = true; }
                    html += `<li style="margin-bottom:2px;margin-left:12px;color:#8090a0;font-size:0.83em;">· ${lineToHtml(subListMatch[1])}</li>`;
                    continue;
                }
                // Regular line (key: value style)
                if (inList) { html += '</ul>'; inList = false; }
                const kvMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_ ]*?)\s*:\s*(.+)/);
                if (kvMatch) {
                    html += `<div style="font-size:0.85em;margin-bottom:3px;"><span style="color:#7a8a9a;font-size:0.9em;">${escapeHtml(kvMatch[1])}</span><span style="color:#556;"> : </span><span style="color:#c0ccd8;">${lineToHtml(kvMatch[2])}</span></div>`;
                } else {
                    html += `<div style="font-size:0.85em;color:#b0bccc;margin-bottom:2px;">${lineToHtml(trimmed)}</div>`;
                }
            }
            if (inList) html += '</ul>';
            return html;
        }

        const sections = parseSections(bodyContent);

        // Build stat badges
        const statBadges = [];
        const statDefs = [
            { key: 'stat_power',      label: 'PWR', color: '#bf616a' },
            { key: 'stat_speed',      label: 'SPD', color: '#88c0d0' },
            { key: 'stat_vitality',   label: 'VIT', color: '#a3be8c' },
            { key: 'stat_perception', label: 'PRC', color: '#ebcb8b' },
            { key: 'stat_energy',     label: 'ENG', color: '#b48ead' },
        ];
        const boostDefs = [
            { key: 'boost_power',      label: '%PWR', color: '#bf616a' },
            { key: 'boost_speed',      label: '%SPD', color: '#88c0d0' },
            { key: 'boost_vitality',   label: '%VIT', color: '#a3be8c' },
            { key: 'boost_perception', label: '%PRC', color: '#ebcb8b' },
            { key: 'boost_energy',     label: '%ENG', color: '#b48ead' },
        ];
        let hasAnyStats = false;
        for (const def of statDefs) {
            const val = Number(traitPage[def.key] || 0);
            if (val !== 0) {
                hasAnyStats = true;
                statBadges.push(`<span style="background:rgba(0,0,0,0.3);border:1px solid ${def.color};color:${def.color};padding:2px 7px;border-radius:3px;font-size:0.78em;font-weight:bold;">${def.label} +${val}</span>`);
            }
        }
        for (const def of boostDefs) {
            const val = Number(traitPage[def.key] || 0);
            if (val !== 0) {
                hasAnyStats = true;
                statBadges.push(`<span style="background:rgba(0,0,0,0.3);border:1px solid ${def.color};color:${def.color};opacity:0.8;padding:2px 7px;border-radius:3px;font-size:0.78em;">${def.label} +${val}%</span>`);
            }
        }
        if (!hasAnyStats) {
            statBadges.push(`<span style="color:#555;font-size:0.78em;font-style:italic;">No direct stat contributions</span>`);
        }

        // Meta chips
        const metaChips = [];
        const chipDefs = [
            { key: 'type',       label: 'Type',       color: '#81a1c1' },
            { key: 'layer',      label: 'Layer',      color: '#88c0d0' },
            { key: 'status',     label: 'Status',     color: '#a3be8c' },
            { key: 'form',       label: 'Form',       color: '#ebcb8b' },
            { key: 'activation', label: 'Activation', color: '#b48ead' },
            { key: 'load',       label: 'Load',       color: '#bf616a' },
            { key: 'scaling',    label: 'Scaling',    color: '#d08770' },
        ];
        for (const c of chipDefs) {
            const val = traitPage[c.key];
            if (val) metaChips.push(`<span style="font-size:0.72em;padding:1px 6px;border-radius:2px;background:rgba(0,0,0,0.25);border:1px solid #2a3a4a;color:#8a9aaa;"><span style="color:${c.color};">${c.label}</span>: ${escapeHtml(String(val))}</span>`);
        }

        // Source
        const sourceCreature = traitPage.source_creature ? `<div style="font-size:0.78em;color:#667788;margin-top:2px;">Source: <span style="color:#8899aa;">${escapeHtml(String(traitPage.source_creature))}</span>${traitPage.species ? ` <span style="color:#556677;">(${escapeHtml(String(traitPage.species))})</span>` : ''}</div>` : '';

        // Rank badge color
        const rankStr = String(traitPage.rank || '?');
        const rankTier = rankStr.replace(/[^A-Za-z]/g,'')[0] || 'F';
        const rankColors = { F:'#88c0d0', E:'#a3be8c', D:'#ebcb8b', C:'#d08770', B:'#bf616a', A:'#b48ead', S:'#ff9944', SS:'#ffcc22' };
        const rankColor = rankColors[rankTier] || '#aaa';

        // Sections HTML — skip the big title line (level 1 heading that repeats trait name) and the "Register Trait" section
        let sectionsHtml = '';
        for (const sec of sections) {
            if (!sec.heading) continue;
            // Skip the main title heading and register heading
            if (sec.level === 1) continue;
            if (sec.heading.toLowerCase().includes('register trait')) continue;
            if (sec.heading.toLowerCase().includes('devour system notification')) continue;

            const contentHtml = renderSectionContent(sec.lines);
            if (!contentHtml.trim()) continue;

            const hColor = sec.level === 2 ? '#9aacbf' : '#7a8fa0';
            const hSize  = sec.level === 2 ? '0.82em' : '0.78em';
            sectionsHtml += `
                <div style="margin-bottom:10px;">
                    <div style="font-size:${hSize};font-weight:bold;color:${hColor};letter-spacing:0.5px;border-bottom:1px solid #1e2e3e;padding-bottom:3px;margin-bottom:5px;">${escapeHtml(sec.heading)}</div>
                    <div style="padding-left:4px;">${contentHtml}</div>
                </div>`;
        }

        // Build overlay + modal
        const overlay = document.createElement('div');
        overlay.id = 'devour-trait-modal-overlay';
        overlay.style.cssText = `
            position:fixed;top:0;left:0;right:0;bottom:0;
            background:rgba(0,0,0,0.65);
            z-index:9999;
            display:flex;align-items:center;justify-content:center;
            padding:16px;
            backdrop-filter:blur(2px);
        `;

        overlay.innerHTML = `
        <div id="devour-trait-modal" style="
            background:#0e1620;
            border:1px solid #2a3a4a;
            border-radius:8px;
            width:100%;
            max-width:560px;
            max-height:85vh;
            display:flex;
            flex-direction:column;
            box-shadow:0 8px 40px rgba(0,0,0,0.7);
            overflow:hidden;
        ">
            <!-- Modal Header -->
            <div style="padding:12px 14px 10px;border-bottom:1px solid #1e2e3e;flex-shrink:0;background:#0a1018;">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:1em;font-weight:bold;color:#d8dee9;letter-spacing:0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(traitPage.file.name)}</div>
                        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                            <span style="font-size:0.8em;font-weight:bold;color:${rankColor};border:1px solid ${rankColor};padding:1px 7px;border-radius:3px;background:rgba(0,0,0,0.3);">${escapeHtml(rankStr)}</span>
                            ${metaChips.join('')}
                        </div>
                        ${sourceCreature}
                    </div>
                    <button id="trait-modal-close" style="background:transparent;border:1px solid #333;color:#888;width:26px;height:26px;border-radius:4px;cursor:pointer;font-size:0.9em;flex-shrink:0;display:flex;align-items:center;justify-content:center;">✕</button>
                </div>
                <!-- Stat Badges -->
                <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">${statBadges.join('')}</div>
            </div>
            <!-- Modal Body (scrollable) -->
            <div style="padding:12px 14px;overflow-y:auto;flex:1;">
                ${sectionsHtml || '<div style="color:#555;font-style:italic;font-size:0.85em;">No section content found.</div>'}
            </div>
            <!-- Modal Footer -->
            <div style="padding:8px 14px;border-top:1px solid #1e2e3e;flex-shrink:0;background:#0a1018;display:flex;justify-content:flex-end;">
                <button id="trait-modal-open-file" style="font-size:0.8em;padding:4px 14px;background:rgba(129,161,193,0.1);border:1px solid #81a1c1;color:#81a1c1;border-radius:4px;cursor:pointer;letter-spacing:0.5px;">↗ Open File</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);

        // Close handlers
        overlay.querySelector('#trait-modal-close').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Open File button — opens the trait's note in Obsidian
        overlay.querySelector('#trait-modal-open-file').addEventListener('click', () => {
            const tFile = app.vault.getAbstractFileByPath(traitPage.file.path);
            if (tFile) {
                overlay.remove();
                app.workspace.getLeaf(false).openFile(tFile);
            }
        });
    }

    // --- 14. MAIN HUD BUILDER ---
    function buildHUD() {
        const { f, d, s, status } = getActive();
        const statusLines = renderPlainTree(status);
        const simActive = simDisabledTraits !== null;
        const simF = simActive ? getActive(simDisabledTraits).f : null;
        const humanActive  = activeForm === "human";
        const hybridActive = activeForm === "hybrid";

        const pillBase   = "display:inline-block;padding:3px 14px;border-radius:3px;cursor:pointer;font-size:0.85em;font-weight:bold;letter-spacing:0.5px;transition:all 0.15s;border:1px solid;";
        const pillHuman  = humanActive
            ? `${pillBase}background:rgba(129,161,193,0.18);border-color:#81a1c1;color:#81a1c1;`
            : `${pillBase}background:transparent;border-color:#444;color:#555;`;
        const pillHybrid = hybridActive
            ? `${pillBase}background:rgba(191,97,106,0.18);border-color:#bf616a;color:#bf616a;`
            : `${pillBase}background:transparent;border-color:#444;color:#555;`;

        let html = `<div class="hud-container"><div class="hud-glass">`;

        // ── TOP BAR (copy button only) ──
        html += `<div class="hud-top" style="position:relative;">
            <button class="hud-copy-btn" style="position:absolute;right:0;top:0;width:80px;height:100%;opacity:0;z-index:10;">COPY</button>
        </div>`;

        // ── SIMULATION BANNER (if active) ──
        if (simActive) {
            const disabledCount = simDisabledTraits.size, totalCount = f.active.length;
            html += `<div style="background:rgba(235,203,139,0.08);border:1px solid rgba(235,203,139,0.3);border-radius:4px;padding:4px 10px;margin-bottom:6px;font-size:0.75em;color:#ebcb8b;display:flex;align-items:center;gap:6px;">
                <span>⚡ SIMULATION ACTIVE</span>
                <span style="color:#888;">—</span>
                <span>${disabledCount} trait${disabledCount !== 1 ? 's' : ''} removed, ${totalCount - disabledCount} / ${totalCount} active</span>
            </div>`;
        }

        // ── HEADER (title now clickable for SIM, form pills below) ──
        html += `<div class="hud-content">
            <div class="hud-header-section">
                <div class="hud-title" id="hud-main-title" style="cursor:pointer;user-select:none;transition:color 0.15s;${simActive ? 'color:#ebcb8b;text-shadow:0 0 12px rgba(235,203,139,0.4);' : ''}" title="Click to toggle Trait Simulation">THE DEVOUR SYSTEM</div>
                <!-- FORM PILLS below title -->
                <div style="display:flex;gap:6px;margin-top:6px;margin-bottom:4px;">
                    <span id="form-btn-human"  style="${pillHuman}">◆ HUMAN</span>
                    <span id="form-btn-hybrid" style="${pillHybrid}">◆ HYBRID</span>
                </div>
                <div class="hud-sub">
                    NAME: <span class="cyan">${escapeHtml(s.sys_name || "???")}</span>
                </div>
                <div class="hud-sub">
                    RANK: <span class="red">${escapeHtml(d.currentRank)}</span>
                    <span class="cyan">(${f.stats.combatRank})</span>
                    ${simF && simF.stats.combatRank !== f.stats.combatRank ? `<span style="color:#ebcb8b;font-size:0.85em;"> → ${simF.stats.combatRank}</span>` : ''}
                </div>`;

        // ── EU PROGRESS ──
        html += `
                <div id="eu-progress-container" style="margin-top:10px;">
                    <div style="display:flex;justify-content:space-between;font-size:0.7em;color:#88c0d0;margin-bottom:2px;">
                        <span>ESSENCE (EU)</span>
                        <span>${formatNumber(d.currentEU)} / ${d.nextRankData ? formatNumber(d.requiredEU) : "MAX"}</span>
                    </div>
                    <div style="width:100%;overflow:hidden;">
                        <div style="width:${d.progressPct}%;height:100%;transition:width 0.3s ease;"></div>
                    </div>
                </div>`;

        // ── KILL CALCULATOR ──
        html += `
                <div id="eu-calculator-panel" style="display:none;margin-top:10px;">
                    <div class="hud-section-label">▣ KILL COUNT</div>
                    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:15px;">`;
        for (const [kRank, kCount] of Object.entries(d.killCounts)) {
            if (kCount > 0) html += `<div style="background:#111;padding:2px 6px;border-radius:3px;font-size:0.75em;border:1px solid #333;"><span style="color:#bf616a;">${kRank}</span>: <span style="color:#d8dee9;">${formatNumber(kCount)}</span></div>`;
        }
        html += `   </div>
                    <div class="hud-section-label">▣ DEVOUR ENTITY</div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <select id="calc-rank"><option value="">Select Rank...</option>`;
        RANKS.forEach(r => { html += `<option value="${r.rank}">${r.rank} (avg ${r.euPerKill} EU)</option>`; });
        html += `       </select>
                        <input type="number" id="calc-count" placeholder="Count" min="1">
                        <div style="display:flex;align-items:center;gap:4px;background:#111;padding:4px;border-radius:4px;border:1px solid #333;">
                            <label style="font-size:0.7em;color:#aaa;cursor:pointer;">ABSORB EU</label>
                            <input type="checkbox" id="calc-toggle-eu" checked style="accent-color:#81a1c1;">
                        </div>
                        <button id="calc-done-btn">DONE</button>
                    </div>
                </div>
            </div>

            <div class="hud-grid">`;

        // ── VITALS ──
        html += `
                <div class="hud-box">
                    <div class="hud-section-label">▣ VITALS ${simActive ? '<span style="color:#ebcb8b;font-size:0.85em;">[SIM DELTA]</span>' : ''}</div>
                    ${buildVitalHTML("power",      "PWR", f, simF)}
                    ${buildVitalHTML("speed",      "SPD", f, simF)}
                    ${buildVitalHTML("vitality",   "VIT", f, simF)}
                    ${buildVitalHTML("perception", "PRC", f, simF)}
                    ${buildVitalHTML("energy",     "ENG", f, simF)}
                    <div class="hud-prowess-toggle" id="hud-prowess-toggle" title="Expand Prowess Overview"></div>
                    <div class="hud-prowess-container" id="hud-prowess-container" style="display:none;">
                        <div style="text-align:center;color:#81a1c1;font-weight:bold;letter-spacing:1px;margin-bottom:12px;text-shadow:0 0 8px rgba(129,161,193,0.6)">// PROWESS METRICS OVERVIEW</div>
                        <div id="prowess-v4-target"></div>
                    </div>
                </div>`;

        // ── AUTHORITY ──
        html += `
                <div class="hud-box">
                    <div class="hud-section-label">▣ AUTHORITY</div>
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px;">`;
        if (d.auths.length === 0) html += `<span style="color:#666;font-size:0.8em;font-style:italic;">[ NO AUTHORITIES ACCESSED ]</span>`;
        else d.auths.forEach(auth => {
            const isUnknown = auth.includes("???"), symbol = isUnknown ? "◈" : "◆";
            const borderColor = isUnknown ? "#663333" : "#cc3333";
            const bgColor = isUnknown ? "rgba(255,255,255,0.02)" : "rgba(255,0,0,0.08)";
            const textColor = isUnknown ? "#aa6666" : "#ff6666";
            html += `<div style="display:flex;align-items:center;border:1px solid ${borderColor};background:${bgColor};padding:3px 6px;border-radius:3px;font-size:0.8em;box-shadow:inset 0 0 6px rgba(0,0,0,0.5);"><span style="color:${textColor};margin-right:4px;font-size:1.1em;">${symbol}</span><span style="color:#ddd;font-weight:bold;letter-spacing:0.5px;">${escapeHtml(auth)}</span></div>`;
        });
        html += `   </div></div>`;

        // ── STATUS ──
        html += `
                <div class="hud-box">
                    <div class="hud-section-label">▣ CURRENT STATUS</div>
                    <div class="hud-tree-content" style="font-size:0.8em;line-height:1.4;color:#c0d6df;">`;
        html += statusLines.map(line => `<div class="t-row">${escapeHtml(line)}</div>`).join("");
        html += `   </div></div>`;

        // ── TRAITS ──
        html += `
                <div class="hud-box">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                        <div class="hud-section-label" style="margin-bottom:0;">▣ TRAITS</div>
                        <div style="display:flex;gap:5px;align-items:center;">`;
        if (simActive) {
            html += `
                            <button id="sim-select-all"   style="font-size:0.68em;padding:1px 6px;background:#1a2a1a;border:1px solid #3a6a3a;color:#a3be8c;border-radius:3px;cursor:pointer;">ALL</button>
                            <button id="sim-deselect-all" style="font-size:0.68em;padding:1px 6px;background:#2a1a1a;border:1px solid #6a3a3a;color:#bf616a;border-radius:3px;cursor:pointer;">NONE</button>
                            <button id="sim-close" style="font-size:0.68em;padding:1px 6px;background:#111;border:1px solid #444;color:#888;border-radius:3px;cursor:pointer;">✕ SIM</button>`;
        }
        html += `
                        </div>
                    </div>
                    <div class="hud-tree-content" style="font-size:0.8em;line-height:1.4;color:#c0d6df;">`;
        for (let i = 0; i < categories.length; i++) {
            const c = categories[i];
            const tList = f.active.filter(p => p.type === c).sort((a,b) => (b.rank_value||0)-(a.rank_value||0));
            html += `<div class="t-row">${i === categories.length - 1 ? "└─" : "├─"} <span style="font-weight:bold;color:#ddd;">${escapeHtml(c)}</span></div>`;
            if (tList.length === 0) {
                html += `<div class="t-row">│  └─ <span style="color:#555;">-</span></div>`;
            } else {
                tList.forEach((t, j) => {
                    const branch = (j === tList.length - 1) ? "└─ " : "├─ ";
                    const dev = String(t.devoured_in || "Hybrid").trim().toLowerCase();
                    const marker = dev === "human" ? "H" : "M";
                    const isDisabled = simActive && simDisabledTraits.has(t.file.name);
                    const nameStyle  = isDisabled ? `text-decoration:line-through;color:#555;` : `color:#88c0d0;`;
                    if (simActive) {
                        // In sim mode: show inline toggle checkbox + stat contribs on the row
                        const checkIcon  = isDisabled ? "✘" : "✔";
                        const checkColor = isDisabled ? "#555" : "#a3be8c";
                        const checkBg    = isDisabled ? "rgba(80,80,80,0.08)" : "rgba(163,190,140,0.12)";
                        const contribs = [];
                        if (Number(t.stat_power      || 0) > 0) contribs.push(`<span style="color:#bf616a;">PWR+${t.stat_power}</span>`);
                        if (Number(t.stat_speed      || 0) > 0) contribs.push(`<span style="color:#88c0d0;">SPD+${t.stat_speed}</span>`);
                        if (Number(t.stat_vitality   || 0) > 0) contribs.push(`<span style="color:#a3be8c;">VIT+${t.stat_vitality}</span>`);
                        if (Number(t.stat_perception || 0) > 0) contribs.push(`<span style="color:#ebcb8b;">PRC+${t.stat_perception}</span>`);
                        if (Number(t.stat_energy     || 0) > 0) contribs.push(`<span style="color:#b48ead;">ENG+${t.stat_energy}</span>`);
                        if (Number(t.boost_power     || 0) > 0) contribs.push(`<span style="color:#bf616a;opacity:0.7;">%PWR+${t.boost_power}</span>`);
                        if (Number(t.boost_speed     || 0) > 0) contribs.push(`<span style="color:#88c0d0;opacity:0.7;">%SPD+${t.boost_speed}</span>`);
                        if (Number(t.boost_vitality  || 0) > 0) contribs.push(`<span style="color:#a3be8c;opacity:0.7;">%VIT+${t.boost_vitality}</span>`);
                        if (Number(t.boost_perception|| 0) > 0) contribs.push(`<span style="color:#ebcb8b;opacity:0.7;">%PRC+${t.boost_perception}</span>`);
                        if (Number(t.boost_energy    || 0) > 0) contribs.push(`<span style="color:#b48ead;opacity:0.7;">%ENG+${t.boost_energy}</span>`);
                        const contribStr = contribs.length > 0 ? contribs.join(" ") : `<span style="color:#444;">—</span>`;
                        html += `<div class="t-row sim-trait-row" data-trait="${escapeHtml(t.file.name)}" style="display:flex;align-items:flex-start;gap:6px;padding:3px 4px;border-radius:3px;cursor:pointer;margin-bottom:1px;">
                            <span style="flex-shrink:0;margin-top:1px;">│  ${branch}</span>
                            <span class="sim-check" style="flex-shrink:0;width:16px;height:16px;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-size:0.7em;font-weight:bold;background:${checkBg};color:${checkColor};">${checkIcon}</span>
                            <span class="hud-trait-link" data-path="${escapeHtml(t.file.path)}" data-name="${escapeHtml(t.file.name)}" style="${nameStyle}cursor:pointer;" onclick="event.stopPropagation()">${escapeHtml(t.file.name)}</span>
                            <span style="color:#888;white-space:nowrap;">(${escapeHtml(t.rank)})</span>
                            <span style="color:#555;font-size:0.85em;white-space:nowrap;">[${t.rank_value||0} ${marker}]</span>
                            <span style="font-size:0.75em;color:#666;flex:1;text-align:right;">${contribStr}</span>
                        </div>`;
                    } else {
                        html += `<div class="t-row">│  ${branch}<span class="hud-trait-link" data-path="${escapeHtml(t.file.path)}" data-name="${escapeHtml(t.file.name)}" style="${nameStyle}cursor:pointer;">${escapeHtml(t.file.name)}</span> <span class="dim" style="color:#888;">(${escapeHtml(t.rank)})</span> <span class="dim" style="color:#555;font-size:0.9em;">[${t.rank_value||0} ${marker}]</span></div>`;
                    }
                });
            }
        }
        html += `       <div class="t-row" style="margin-top:8px;color:#666;font-style:italic;">└─ SUPPRESSED [${f.suppressed}]</div>
                    </div>
                </div>
            </div></div></div></div>`;

        return html;
    }

    // --- 15. RENDER & WIRE EVENTS ---
    function render() {
        dv.container.innerHTML = buildHUD();

        setTimeout(async () => {
            // Form toggle buttons
            const btnHuman  = dv.container.querySelector("#form-btn-human");
            const btnHybrid = dv.container.querySelector("#form-btn-hybrid");
            if (btnHuman) btnHuman.addEventListener("click", () => {
                if (activeForm !== "human") {
                    activeForm = "human";
                    if (simDisabledTraits !== null) simDisabledTraits = new Set();
                    render();
                }
            });
            if (btnHybrid) btnHybrid.addEventListener("click", () => {
                if (activeForm !== "hybrid") {
                    activeForm = "hybrid";
                    if (simDisabledTraits !== null) simDisabledTraits = new Set();
                    render();
                }
            });

            // Title → SIM toggle
            const mainTitle = dv.container.querySelector("#hud-main-title");
            if (mainTitle) {
                mainTitle.addEventListener("click", () => {
                    simDisabledTraits = simDisabledTraits === null ? new Set() : null;
                    render();
                });
            }

            // EU progress → calculator toggle
            const progressContainer = dv.container.querySelector("#eu-progress-container");
            const calcPanel         = dv.container.querySelector("#eu-calculator-panel");
            if (progressContainer && calcPanel) {
                progressContainer.addEventListener("click", () => {
                    calcPanel.style.display = calcPanel.style.display === "none" ? "block" : "none";
                });
            }

            // Prowess toggle
            const prowToggle    = dv.container.querySelector("#hud-prowess-toggle");
            const prowContainer = dv.container.querySelector("#hud-prowess-container");
            const prowessTarget = dv.container.querySelector("#prowess-v4-target");
            if (prowessTarget) {
                const { f, d } = getActive();
                try {
                    const prowRvMap = {
                        power: f.stats.final.power, speed: f.stats.final.speed,
                        vitality: f.stats.final.vitality, perception: f.stats.final.perception,
                        energy: f.stats.final.energy
                    };
                    if (d.rankData.tier !== "Dormant") prowRvMap.rank = d.rankData.tier + "-rank";
                    const traitSummary = f.active.map(t => {
                        const contribs = {};
                        if (Number(t.stat_power      || 0) > 0) contribs.power      = Number(t.stat_power);
                        if (Number(t.stat_speed      || 0) > 0) contribs.speed      = Number(t.stat_speed);
                        if (Number(t.stat_vitality   || 0) > 0) contribs.vitality   = Number(t.stat_vitality);
                        if (Number(t.stat_perception || 0) > 0) contribs.perception = Number(t.stat_perception);
                        if (Number(t.stat_energy     || 0) > 0) contribs.energy     = Number(t.stat_energy);
                        return { name: t.file.name, rank: t.rank || '?', category: t.type || '?', contribs };
                    }).filter(t => Object.keys(t.contribs).length > 0);
                    await dv.view("Meta/Scripts/marc_prowess", { container: prowessTarget, form: activeForm, rvMap: prowRvMap, traits: traitSummary });
                } catch (err) {
                    prowessTarget.innerHTML = `<div style="color:#ff4444;font-size:0.8em;padding:8px;border:1px dashed #ff4444;">⚠️ <b>Engine Error:</b> Could not load Marc Prowess.<br><i>${err.message}</i></div>`;
                }
            }
            if (prowToggle && prowContainer) {
                prowToggle.addEventListener("click", () => {
                    prowContainer.style.display = (prowContainer.style.display === "none" || !prowContainer.style.display) ? "block" : "none";
                });
            }

            // Sim panel controls
            const simClose = dv.container.querySelector("#sim-close");
            if (simClose) simClose.addEventListener("click", () => { simDisabledTraits = null; render(); });

            const simSelectAll = dv.container.querySelector("#sim-select-all");
            if (simSelectAll) simSelectAll.addEventListener("click", () => { if (simDisabledTraits !== null) { simDisabledTraits.clear(); render(); } });

            const simDeselectAll = dv.container.querySelector("#sim-deselect-all");
            if (simDeselectAll) simDeselectAll.addEventListener("click", () => {
                if (simDisabledTraits !== null) {
                    const { f } = getActive(new Set());
                    f.active.forEach(t => simDisabledTraits.add(t.file.name));
                    render();
                }
            });

            // Sim trait row toggles (ignore clicks that bubble up from the trait name span)
            dv.container.querySelectorAll(".sim-trait-row").forEach(row => {
                row.addEventListener("click", (e) => {
                    if (e.target.classList.contains("hud-trait-link")) return;
                    const traitName = row.dataset.trait;
                    if (!traitName || simDisabledTraits === null) return;
                    if (simDisabledTraits.has(traitName)) simDisabledTraits.delete(traitName);
                    else simDisabledTraits.add(traitName);
                    render();
                });
            });

            // ── TRAIT LINKS → floating modal ──
            dv.container.querySelectorAll(".hud-trait-link").forEach(el => {
                el.addEventListener("click", async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const traitName = el.dataset.name;
                    const traitPage = traitPages.find(p => p.file.name === traitName);
                    if (traitPage) {
                        await openTraitModal(traitPage);
                    }
                });
            });

            // Kill calculator
            const doneBtn    = dv.container.querySelector("#calc-done-btn");
            const rankSelect = dv.container.querySelector("#calc-rank");
            const countInput = dv.container.querySelector("#calc-count");
            const euToggle   = dv.container.querySelector("#calc-toggle-eu");
            if (doneBtn) {
                doneBtn.addEventListener("click", async () => {
                    const selectedRank = rankSelect.value, count = parseInt(countInput.value), absorbEU = euToggle.checked;
                    if (!selectedRank || isNaN(count) || count <= 0) return;
                    const tFileHuman  = sHuman  && sHuman.file  ? app.vault.getAbstractFileByPath(sHuman.file.path)  : null;
                    const tFileHybrid = sHybrid && sHybrid.file ? app.vault.getAbstractFileByPath(sHybrid.file.path) : null;
                    if (!tFileHuman && !tFileHybrid) return;
                    doneBtn.innerText = "PROCESSING..."; doneBtn.style.background = "#ebcb8b";
                    const updateFM = (fm) => {
                        if (!fm.kill_counts) fm.kill_counts = {};
                        fm.kill_counts[selectedRank] = (fm.kill_counts[selectedRank] || 0) + count;
                        if (absorbEU) {
                            const targetRankData = RANKS.find(r => r.rank === selectedRank);
                            let totalAddedEU = targetRankData.euPerKill * count;
                            let tempEU = (fm.current_eu || 0) + totalAddedEU, tempRank = fm.core_rank || "Dormant";
                            let activeRankIndex = RANKS.findIndex(r => r.rank === tempRank);
                            if (activeRankIndex === -1) activeRankIndex = 0;
                            while (true) {
                                const currentRData = RANKS[activeRankIndex];
                                if (!RANKS[activeRankIndex + 1]) break;
                                if (currentRData.euRequired > 0 && tempEU >= currentRData.euRequired) {
                                    tempEU -= currentRData.euRequired; activeRankIndex++;
                                    tempRank = RANKS[activeRankIndex].rank;
                                } else break;
                            }
                            fm.current_eu = tempEU; fm.core_rank = tempRank;
                        }
                    };
                    if (tFileHuman)  await app.fileManager.processFrontMatter(tFileHuman,  updateFM);
                    if (tFileHybrid) await app.fileManager.processFrontMatter(tFileHybrid, updateFM);
                });
            }

            // Copy button
            dv.container.querySelectorAll(".hud-copy-btn").forEach(btn => {
                btn.addEventListener("click", async (e) => {
                    const txt = buildRaw();
                    try {
                        await navigator.clipboard.writeText(txt);
                        const oldText = e.currentTarget.innerText;
                        e.currentTarget.innerText = "✓ SYNCED";
                        e.currentTarget.style.background = "#22a62d"; e.currentTarget.style.color = "#000";
                        setTimeout(() => { e.currentTarget.innerText = oldText; e.currentTarget.style.background = ""; e.currentTarget.style.color = ""; }, 1500);
                    } catch (err) { e.currentTarget.innerText = "ERROR"; }
                });
            });

        }, 150);
    }

    render();

})();
```

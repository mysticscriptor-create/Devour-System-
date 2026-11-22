---
obsidianUIMode: preview
cssclasses:
  - full-page-db
---
```dataviewjs
// Build the container and UI layout (Adding ov-root to inherit the Overseer Theme)
const container = document.createElement("div");
container.className = "ov-root cb-calc-wrapper";

// Add custom styling optimized for the Overseer Theme Variables
const style = document.createElement("style");
style.innerHTML = `
    .cb-calc-wrapper { padding: 20px; box-sizing: border-box; width: 100%; }
    .cb-header { font-family: 'Orbitron', var(--font-ui, monospace); font-size: 1.3em; font-weight: 900; color: var(--accent-cyan, #00ff88); margin-bottom: 15px; border-bottom: 1px solid var(--border-glow, #135730); padding-bottom: 8px; text-shadow: 0 0 8px rgba(0,255,136,0.6); text-transform: uppercase; letter-spacing: 0.1em; }
    .cb-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
    .cb-input-group { display: flex; flex-direction: column; gap: 5px; }
    .cb-input-group label { font-size: 0.72em; color: var(--text-dim, #4d9966); font-family: var(--font-ui, monospace); font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; }
    .cb-input-group input, .cb-input-group select { width: 100%; padding: 8px; border-radius: 0; border: 1px solid var(--border-arcane, #0d3320); background: var(--bg-base, #020905); color: var(--accent-cyan, #00ff88); font-family: var(--font-ui, monospace); outline: none; -webkit-appearance: none; appearance: none; }
    .cb-input-group input:focus, .cb-input-group select:focus { border-color: var(--accent-cyan, #00ff88); box-shadow: 0 0 8px rgba(0,255,136,0.25); }
    .cb-radio-group { display: flex; gap: 15px; align-items: center; margin-bottom: 15px; background: var(--bg-panel, #040d08); padding: 10px; border: 1px solid var(--border-arcane, #0d3320); font-size: 0.85em; color: var(--text-main, #c8f5d8); }
    .cb-summary { background: var(--bg-panel, #040d08); padding: 15px; border-left: 3px solid var(--accent-cyan, #00ff88); margin-bottom: 20px; font-size: 0.95em; line-height: 1.6; color: var(--text-main, #c8f5d8); border-top: 1px solid var(--border-arcane, #0d3320); border-bottom: 1px solid var(--border-arcane, #0d3320); border-right: 1px solid var(--border-arcane, #0d3320); }
    .cb-warning { color: var(--accent-blood, #ff2244); font-weight: bold; text-shadow: 0 0 6px rgba(255,34,68,0.5); }
    .cb-table-wrapper { overflow-x: auto; max-height: 400px; margin-top: 15px; border: 1px solid var(--border-arcane, #0d3320); }
    .cb-table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
    .cb-table th { background: var(--bg-lift, #071410); position: sticky; top: 0; padding: 10px; text-align: right; border-bottom: 1px solid var(--border-glow, #135730); color: var(--accent-cyan, #00ff88); text-transform: uppercase; font-family: var(--font-ui, monospace); z-index: 10;}
    .cb-table th:first-child { text-align: left; }
    .cb-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-arcane, #0d3320); text-align: right; color: var(--text-main, #c8f5d8); }
    .cb-table td:first-child { text-align: left; font-weight: bold; }
    
    /* Vitals Styling */
    .cb-vitals-toggle { font-weight: bold; cursor: pointer; color: var(--accent-cyan, #00ff88); margin: 15px 0 10px 0; display: inline-block; user-select: none; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.1em; }
    .cb-vitals-toggle:hover { text-shadow: 0 0 8px rgba(0,255,136,0.6); }
    .cb-vitals-grid { display: none; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 10px; margin-bottom: 15px; }
    .cb-vital-card { background: var(--bg-panel, #040d08); padding: 10px; text-align: center; border: 1px solid; display: flex; flex-direction: column; gap: 4px; }
    .cb-vital-name { font-size: 0.75em; text-transform: uppercase; font-weight: bold; opacity: 0.9; font-family: var(--font-ui, monospace); }
    .cb-vital-rank { font-size: 1.2em; font-weight: bold; font-family: 'Orbitron', var(--font-ui, monospace); }
    .cb-vital-val { font-size: 0.8em; color: var(--text-dim, #4d9966); }

    /* Prowess Glowing Line Styling */
    .cb-prowess-toggle { height: 4px; width: 80%; margin: 25px auto 15px auto; cursor: pointer; opacity: 0.75; transition: all 0.2s ease; background: var(--accent-cyan, #00ff88); box-shadow: 0 0 10px var(--accent-cyan, #00ff88); border-radius: 2px; }
    .cb-prowess-toggle:active { opacity: 1; transform: scaleY(1.5); }
    .cb-prowess-container { display: none; padding: 15px; background: var(--bg-panel, rgba(0,0,0,0.3)); border: 1px solid var(--border-glow, #135730); margin-bottom: 20px; font-size: 0.9em; }
`;
container.appendChild(style);

// Data structure: Ranks
const RANKS = [
    { rank: "Dormant",  val: 3,       euPerKill: 3,         euRequired: 0,              tier: "Dormant" },
    { rank: "F−",       val: 8,       euPerKill: 8,         euRequired: 0,              tier: "F" },
    { rank: "F",        val: 10,      euPerKill: 15,        euRequired: 104464,         tier: "F" },
    { rank: "F+",       val: 13,      euPerKill: 22,        euRequired: 104464,         tier: "F" },
    { rank: "F++",      val: 16,      euPerKill: 30,        euRequired: 104464,         tier: "F" },
    { rank: "F+++",     val: 20,      euPerKill: 50,        euRequired: 125357,         tier: "F" },
    { rank: "E−",       val: 21,      euPerKill: 60,        euRequired: 125357,         tier: "E" },
    { rank: "E",        val: 30,      euPerKill: 80,        euRequired: 1035714,        tier: "E" },
    { rank: "E+",       val: 37,      euPerKill: 130,       euRequired: 1035714,        tier: "E" },
    { rank: "E++",      val: 44,      euPerKill: 170,       euRequired: 1035714,        tier: "E" },
    { rank: "E+++",     val: 50,      euPerKill: 200,       euRequired: 1242857,        tier: "E" },
    { rank: "D−",       val: 51,      euPerKill: 220,       euRequired: 1242857,        tier: "D" },
    { rank: "D",        val: 100,     euPerKill: 350,       euRequired: 6845238,        tier: "D" },
    { rank: "D+",       val: 160,     euPerKill: 500,       euRequired: 6845238,        tier: "D" },
    { rank: "D++",      val: 230,     euPerKill: 650,       euRequired: 6845238,        tier: "D" },
    { rank: "D+++",     val: 300,     euPerKill: 800,       euRequired: 8214286,        tier: "D" },
    { rank: "C−",       val: 301,     euPerKill: 900,       euRequired: 8214286,        tier: "C" },
    { rank: "C",        val: 800,     euPerKill: 1400,      euRequired: 38333333,       tier: "C" },
    { rank: "C+",       val: 1050,    euPerKill: 2000,      euRequired: 38333333,       tier: "C" },
    { rank: "C++",      val: 1250,    euPerKill: 2600,      euRequired: 38333333,       tier: "C" },
    { rank: "C+++",     val: 1500,    euPerKill: 3200,      euRequired: 46000000,       tier: "C" },
    { rank: "B−",       val: 1501,    euPerKill: 3800,      euRequired: 46000000,       tier: "B" },
    { rank: "B",        val: 2500,    euPerKill: 6000,      euRequired: 337857143,      tier: "B" },
    { rank: "B+",       val: 2900,    euPerKill: 9000,      euRequired: 337857143,      tier: "B" },
    { rank: "B++",      val: 3200,    euPerKill: 12000,     euRequired: 337857143,      tier: "B" },
    { rank: "B+++",     val: 3500,    euPerKill: 16000,     euRequired: 405428571,      tier: "B" },
    { rank: "A−",       val: 3501,    euPerKill: 20000,     euRequired: 405428571,      tier: "A" },
    { rank: "A",        val: 5000,    euPerKill: 35000,     euRequired: 3571428571,     tier: "A" },
    { rank: "A+",       val: 6500,    euPerKill: 60000,     euRequired: 3571428571,     tier: "A" },
    { rank: "A++",      val: 8000,    euPerKill: 90000,     euRequired: 3571428571,     tier: "A" },
    { rank: "A+++",     val: 10000,   euPerKill: 115000,    euRequired: 4285714286,     tier: "A" },
    { rank: "S−",       val: 10001,   euPerKill: 140000,    euRequired: 4285714286,     tier: "S" },
    { rank: "S",        val: 15000,   euPerKill: 250000,    euRequired: 50000000000,    tier: "S" },
    { rank: "S+",       val: 25000,   euPerKill: 450000,    euRequired: 50000000000,    tier: "S" },
    { rank: "S++",      val: 37000,   euPerKill: 700000,    euRequired: 50000000000,    tier: "S" },
    { rank: "S+++",     val: 50000,   euPerKill: 1000000,   euRequired: 60000000000,    tier: "S" },
    { rank: "SS−",      val: 50001,   euPerKill: 1300000,   euRequired: 60000000000,    tier: "SS" },
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

const CORE_REACHES = [
    "Substance (VIT/PWR)", "Force (PWR/SPD)", "Space (PRC/ENG)", 
    "Mind (PRC/ENG)", "Soul (VIT/ENG)", "Time (SPD/PRC)", 
    "Void (ENG/PRC)", "Origin (Balanced)"
];

const MAX_DAILY_LIMITS = {
    "Dormant": 15, "F": 15, "E": 20, "D": 25, "C": 15, 
    "B": 10, "A": 7, "S": 4, "SS": 4, "SSS": 4 
};

// --- HELPER FUNCTIONS FOR VITALS ---
function getRankFromValue(val) {
    let highest = RANKS[0].rank;
    for (let i = 0; i < RANKS.length; i++) {
        if (val >= RANKS[i].val) highest = RANKS[i].rank;
        else break;
    }
    return highest;
}

function calculateVitals(rankValue, coreReach) {
    if (!coreReach) return { power:0, speed:0, perception:0, vitality:0, energy:0 };
    const reach = coreReach.toLowerCase();
    let main="", secondary="";
    
    if      (reach.includes("substance")) { main="vitality";   secondary="power"; }
    else if (reach.includes("force"))     { main="power";      secondary="speed"; }
    else if (reach.includes("space"))     { main="perception"; secondary="energy"; }
    else if (reach.includes("mind"))      { main="perception"; secondary="energy"; }
    else if (reach.includes("soul"))      { main="vitality";   secondary="energy"; }
    else if (reach.includes("time"))      { main="speed";      secondary="perception"; }
    else if (reach.includes("void"))      { main="energy";     secondary="perception"; }
    else if (reach.includes("origin")) {
        const v = Number((rankValue*0.20).toFixed(2));
        return { power:v, speed:v, perception:v, vitality:v, energy:v };
    } else return { power:0, speed:0, perception:0, vitality:0, energy:0 };
    
    const vitals = { power:0, speed:0, perception:0, vitality:0, energy:0 };
    for (const key in vitals) {
        if      (key===main)      vitals[key] = Number((rankValue*0.40).toFixed(2));
        else if (key===secondary) vitals[key] = Number((rankValue*0.25).toFixed(2));
        else                      vitals[key] = Number(((rankValue*0.35)/3).toFixed(2));
    }
    return vitals;
}
// -----------------------------------

// UI Elements Generation
container.innerHTML += `
    <div class="cb-header">Corebearer Progression Profile</div>
    <div class="cb-radio-group">
        <label><input type="radio" name="calcMode" value="findTime" checked> Calculate Time Needed</label>
        <label><input type="radio" name="calcMode" value="findRuns"> Calculate Runs Needed</label>
    </div>
    <div class="cb-grid">
        <div class="cb-input-group">
            <label>Core Potential</label>
            <select id="cb-potential">
                ${POTENTIALS.map((p, i) => `<option value="${i}" ${p.name === "D-Core" ? "selected" : ""}>${p.name}</option>`).join('')}
            </select>
        </div>
        <div class="cb-input-group">
            <label>Core Reach</label>
            <select id="cb-reach">
                ${CORE_REACHES.map(r => `<option value="${r}">${r}</option>`).join('')}
            </select>
        </div>
        <div class="cb-input-group">
            <label>Target Rank</label>
            <select id="cb-target-rank">
                ${RANKS.map((r, i) => `<option value="${i}">${r.rank} (Val: ${r.val.toLocaleString()})</option>`).join('')}
            </select>
        </div>
        <div class="cb-input-group">
            <label>Awakened Age</label>
            <input type="number" id="cb-awakened-age" value="15" min="1">
        </div>
        <div class="cb-input-group">
            <label>Dungeon Runs / Week</label>
            <input type="number" id="cb-runs-week" value="3" step="0.1" min="0.1" max="7">
        </div>
        <div class="cb-input-group">
            <label>Years Spent Hunting</label>
            <input type="number" id="cb-years" value="5" step="0.1" min="0.1" disabled>
        </div>
    </div>
    
    <div id="cb-summary" class="cb-summary"></div>
    
    <div class="cb-vitals-toggle" id="cb-vitals-toggle">> Toggle Core Vitals Distribution_</div>
    <div class="cb-vitals-grid" id="cb-vitals-grid"></div>

    <div class="cb-prowess-toggle" id="cb-prowess-toggle" title="Expand Prowess Overview"></div>
    <div class="cb-prowess-container" id="cb-prowess-container">
        <div style="text-align:center; color:var(--accent-cyan, #00ff88); font-weight:bold; letter-spacing:1px; margin-bottom:15px; font-family:var(--font-ui, monospace);">// PROWESS METRICS OVERVIEW</div>
        <div id="cb-prowess-target"></div>
    </div>

    <div id="cb-table-container" class="cb-table-wrapper"></div>
`;

dv.container.appendChild(container);

// DOM Selection
const potSelect = container.querySelector("#cb-potential");
const reachSelect = container.querySelector("#cb-reach");
const rankSelect = container.querySelector("#cb-target-rank");
const awakenedAgeInput = container.querySelector("#cb-awakened-age");
const runsInput = container.querySelector("#cb-runs-week");
const yearsInput = container.querySelector("#cb-years");
const summaryDiv = container.querySelector("#cb-summary");
const vitalsToggle = container.querySelector("#cb-vitals-toggle");
const vitalsGrid = container.querySelector("#cb-vitals-grid");
const prowToggle = container.querySelector("#cb-prowess-toggle");
const prowContainer = container.querySelector("#cb-prowess-container");
const prowTarget = container.querySelector("#cb-prowess-target");
const tableDiv = container.querySelector("#cb-table-container");
const radios = container.querySelectorAll('input[name="calcMode"]');

// Handle Rendering of Prowess Script
async function renderProwess(vitalsData) {
    if (prowContainer.style.display !== "none" && prowTarget) {
        prowTarget.innerHTML = ""; 
        try {
            await dv.view("Meta/Scripts/prowess_v4", {
                container: prowTarget,
                rvMap: {
                    power: vitalsData.power,
                    speed: vitalsData.speed,
                    vitality: vitalsData.vitality,
                    perception: vitalsData.perception,
                    energy: vitalsData.energy
                }
            });
        } catch(err) {
            prowTarget.innerHTML = `<div style="color:var(--accent-blood, #ff2244); font-size:0.8em; padding:8px; text-align:center;">⚠️ Prowess v4 error: ${err.message}</div>`;
        }
    }
}

// Logic Execution
function calculate() {
    const potIdx = parseInt(potSelect.value);
    const targetIdx = parseInt(rankSelect.value);
    const reachName = reachSelect.value;
    const awakenedAge = parseInt(awakenedAgeInput.value) || 15;
    const mode = container.querySelector('input[name="calcMode"]:checked').value;
    
    const potential = POTENTIALS[potIdx];
    let runsPerWeek = parseFloat(runsInput.value) || 0.1;
    let years = parseFloat(yearsInput.value) || 0.1;
    
    let totalKills = 0;
    let totalRuns = 0;
    let accumulatedEU = 0;
    
    let tableHTML = `<table class="cb-table">
        <thead>
            <tr>
                <th>Progression Step</th>
                <th>Required Essence</th>
                <th>Creature Yield</th>
                <th>Kills Needed</th>
                <th>Kill Limit/Run</th>
                <th>Total Runs</th>
            </tr>
        </thead>
        <tbody>`;

    for (let i = 0; i < targetIdx; i++) {
        const current = RANKS[i];
        if (current.euRequired <= 0) continue;
        
        accumulatedEU += current.euRequired;
        
        // Apply potential multiplier to the base daily limit of this tier
        let baseLimit = MAX_DAILY_LIMITS[current.tier] || 4;
        let limitPerRun = Math.floor(baseLimit * potential.mult);
        if (limitPerRun < 1) limitPerRun = 1;
        
        const killsReq = Math.ceil(current.euRequired / current.euPerKill);
        const runsReq = Math.ceil(killsReq / limitPerRun);
        
        totalKills += killsReq;
        totalRuns += runsReq;
        
        tableHTML += `<tr>
            <td>${current.rank} → ${RANKS[i+1].rank}</td>
            <td>${current.euRequired.toLocaleString()} EU</td>
            <td>${current.euPerKill.toLocaleString()} EU</td>
            <td>${killsReq.toLocaleString()}</td>
            <td>${limitPerRun}</td>
            <td>${runsReq.toLocaleString()}</td>
        </tr>`;
    }
    tableHTML += `</tbody></table>`;
    
    if (targetIdx === 0 || targetIdx === 1) {
        tableHTML = `<div style="padding: 10px; text-align:center; color: var(--text-dim, #4d9966);">No essence required to reach this rank.</div>`;
    }

    // Mathematical resolution based on mode
    if (mode === "findTime") {
        years = totalRuns / (runsPerWeek * 52);
        yearsInput.value = years.toFixed(2);
    } else {
        runsPerWeek = totalRuns / (years * 52);
        runsInput.value = runsPerWeek.toFixed(2);
    }

    const targetAge = awakenedAge + years;

    // Flagging system for extreme metrics and potential cap
    let runStr = `Runs per Week: <strong style="color: var(--accent-cyan, #00ff88);">${runsPerWeek.toFixed(2)}</strong>`;
    if (runsPerWeek > 3) {
        runStr = `<span class="cb-warning">Runs per Week: ${runsPerWeek.toFixed(2)} (High! Requires backing/scholarship)</span>`;
    }
    if (runsPerWeek > 7) {
        runStr = `<span class="cb-warning">Runs per Week: ${runsPerWeek.toFixed(2)} (Impossible! Exceeds 7 days/week)</span>`;
    }
    
    let potentialWarning = "";
    if (targetIdx > potential.maxIdx) {
        potentialWarning = `<br><span class="cb-warning">⚠️ LIMIT EXCEEDED: A Corebearer with ${potential.name} potential physically cannot surpass rank ${potential.maxRankTier}!</span>`;
    }

    summaryDiv.innerHTML = `
        Target Rank: <strong style="color: var(--accent-cyan, #00ff88);">${RANKS[targetIdx].rank}</strong> (Core: ${potential.name})<br>
        Current Age: <strong style="color: var(--accent-cyan, #00ff88);">${~~targetAge} years old</strong> (Active for ${years.toFixed(1)} yrs)<br>
        Total Accumulated EU: <strong style="color: var(--accent-cyan, #00ff88);">${accumulatedEU.toLocaleString()}</strong><br>
        Total Creatures Slain: <strong style="color: var(--accent-cyan, #00ff88);">${totalKills.toLocaleString()}</strong><br>
        Total Dungeon Days (Runs): <strong style="color: var(--accent-cyan, #00ff88);">${totalRuns.toLocaleString()}</strong><br>
        ${runStr}
        ${potentialWarning}
    `;
    
    tableDiv.innerHTML = tableHTML;
    
    // Process Vitals Generation
    const targetRankValue = RANKS[targetIdx].val;
    const vitalsData = calculateVitals(targetRankValue, reachName);
    
    // Kept standard colors for readability, but mapped them inside the neon background gradient
    const vitalColors = { power: '#ff3b3b', speed: '#00d2ff', vitality: '#00ff88', perception: '#d400ff', energy: '#ffb700' };
    
    vitalsGrid.innerHTML = ['power', 'speed', 'vitality', 'perception', 'energy'].map(k => {
        const val = vitalsData[k];
        const rnk = getRankFromValue(val);
        const col = vitalColors[k];
        return `
            <div class="cb-vital-card" style="border-color: ${col}40; background: linear-gradient(180deg, transparent, ${col}10);">
                <div class="cb-vital-name" style="color: ${col}">${k}</div>
                <div class="cb-vital-rank" style="color: ${col}; text-shadow: 0 0 5px ${col}80;">${rnk}</div>
                <div class="cb-vital-val">${val.toLocaleString()}</div>
            </div>
        `;
    }).join('');

    // Update Prowess Engine whenever stats change (if it's currently open)
    renderProwess(vitalsData);
}

// Event Listeners
potSelect.addEventListener("change", calculate);
reachSelect.addEventListener("change", calculate);
rankSelect.addEventListener("change", calculate);
awakenedAgeInput.addEventListener("input", calculate);
runsInput.addEventListener("input", calculate);
yearsInput.addEventListener("input", calculate);

vitalsToggle.addEventListener("click", () => {
    const isHidden = vitalsGrid.style.display === "none" || vitalsGrid.style.display === "";
    vitalsGrid.style.display = isHidden ? "grid" : "none";
});

prowToggle.addEventListener("click", () => {
    const isHidden = prowContainer.style.display === "none" || prowContainer.style.display === "";
    prowContainer.style.display = isHidden ? "block" : "none";
    if (isHidden) {
        calculate(); // Force render the prowess script when opened
    }
});

radios.forEach(r => r.addEventListener("change", (e) => {
    if (e.target.value === "findTime") {
        runsInput.disabled = false;
        yearsInput.disabled = true;
    } else {
        runsInput.disabled = true;
        yearsInput.disabled = false;
    }
    calculate();
}));

// Default init
rankSelect.value = "22"; // Default to B rank
calculate();

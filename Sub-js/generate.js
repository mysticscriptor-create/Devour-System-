// ╔══════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — GENERATOR MODULE  v2.0                     ║
// ║  Registered as: DEVOUR.modules["generate"]                  ║
// ║  Depends on:    prowess_config.json (vault root)            ║
// ║                 devour-prompts.json (vault root)            ║
// ║  Writes to:     Inventory/<Category>/(<Sub>/)name.md        ║
// ║                 Inventory/Services/Commission/name.md       ║
// ╚══════════════════════════════════════════════════════════════╝

DEVOUR.modules["generate"] = function(DEVOUR, container, shellState) {

var esc = DEVOUR.utils.escapeHtml;
var div = DEVOUR.utils.div;

// ── CONSTANTS ────────────────────────────────────────────────
var RANKS      = ["F","E","D","C","B","A","S"];
var MAJOR_CATS = ["Weapons","Armor","Equipment","Consumables","Supplements",
                  "Materials","Crystals","Cores","Creatures","Artifacts","Information","Services"];
var RARITIES   = ["Common","Uncommon","Rare","Epic","Legendary","Unique","Mythic"];
var PHASES     = ["","−","+","++","+++"];
var LAYERS     = ["Legal","Gray","Legal + Gray","Black Market"];
var BM_TIERS   = ["bm-low","bm-mid","bm-high","bm-critical","bm-foreign"];
var BM_LABELS  = {"bm-low":"Street","bm-mid":"Mid","bm-high":"Deep","bm-critical":"Core Trade","bm-foreign":"Foreign"};
var CONTRACT_TYPES = ["Bounty","Collection","Escort","Taming","Reconnaissance","Clearance","Retrieval","Classified"];
var DANGERS    = ["Low","Moderate","High","Extreme","Unknown"];
var COMM_RANKS = ["Open","Listed","Verified","Recognized","Notable","Distinguished","Renowned","Sovereign"];

var REGIONS_HUMAN   = ["Aethelgard Reach","Argent-Palar","Esten Province","Orenthellion",
                       "Vexton Nexus","Mordant Dominion","Mardu Frontier","Fenner Basin","Solace Meridian"];
var REGIONS_FOREIGN = ["Abyssal Convergence","Jade Hegemony","Iron-Sand Sultanate","Glacial Hive"];
var ALL_REGIONS     = REGIONS_HUMAN.concat(REGIONS_FOREIGN);

var AI_PICK = "— AI picks —";

// ── MODULE STATE ─────────────────────────────────────────────
if (!DEVOUR._genState) {
  DEVOUR._genState = {
    mode:             "item",
    rank:             "F",
    category:         "Weapons",
    subcategory:      "",
    rarity:           "",
    phase:            "",
    layer:            "Legal",
    bmTier:           "bm-low",
    region:           AI_PICK,
    notes:            "",
    contractType:     "Bounty",
    difficulty:       "F",
    danger:           "",
    visibilityRank:   "Open",
    reward:           "",
    rewardClassified: false,
    commRegion:       AI_PICK,
    poster:           "",
    posterAnon:       false,
    postedDate:       "",
    expiresDate:      "",
    commNotes:        "",
    provider:         "",
    model:            "",
    status:           "idle",
    lastResult:       null,
    lastError:        null,
    lastFileName:     null,
    _cfg:             null,
    _prompts:         null,   // loaded devour-prompts.json
  };
}
var st = DEVOUR._genState;

// ── CONFIG LOADER ────────────────────────────────────────────
async function loadConfig() {
  try {
    var f = app.vault.getAbstractFileByPath("prowess_config.json");
    if (!f) throw new Error("prowess_config.json not found in vault root");
    var raw = await app.vault.read(f);
    return JSON.parse(raw);
  } catch(e) {
    throw new Error("Config load failed: " + e.message);
  }
}

// ── PROMPT DATA LOADER ───────────────────────────────────────
async function loadPrompts() {
  if (st._prompts) return st._prompts;
  try {
    var f = app.vault.getAbstractFileByPath("devour-prompts.json");
    if (!f) throw new Error("devour-prompts.json not found in vault root");
    var raw = await app.vault.read(f);
    st._prompts = JSON.parse(raw);
    return st._prompts;
  } catch(e) {
    throw new Error("Prompt data load failed: " + e.message);
  }
}

async function initConfigState() {
  try {
    var cfg = await loadConfig();
    st._cfg = cfg;
    if (!st.provider) st.provider = cfg.activeProvider || "";
    if (!st.model)    st.model    = cfg.activeModel    || "";
  } catch(e) {
    console.warn("[DEVOUR Generate] Could not load prowess_config:", e.message);
  }
  // Pre-load prompts in background
  loadPrompts().catch(function(e) {
    console.warn("[DEVOUR Generate] Could not pre-load prompts:", e.message);
  });
}

// ── PROMPT BUILDERS ──────────────────────────────────────────
// Sends ONLY what the AI needs for the selected rank + category.
// No extra data. No unused price tables.

async function buildItemPrompt(opts) {
  var P = await loadPrompts();
  var parts = [];

  // 1. World header (always)
  parts.push(P.world_header);
  parts.push("");

  // 2. Global organizations (always — AI needs these for realistic poster names, buyer pools, item origins)
  if (P.world_orgs) {
    parts.push(P.world_orgs);
    parts.push("");
  }

  // 3. Rarity multipliers (always — AI needs to know what baseline to set)
  parts.push(P.rarity_multipliers);
  parts.push("");

  // 4. Rank + category specific pricing (only the selected rank + category)
  var rankPrices = P.price_ref[opts.rank];
  if (rankPrices && rankPrices[opts.category]) {
    parts.push("PRICING (" + opts.rank + "-RANK — " + opts.category.toUpperCase() + "):");
    parts.push(rankPrices[opts.category]);
    parts.push("");
  }

  // 5. Foreign material note — only if origin is a foreign zone
  var foreignZones = ["Abyssal Convergence","Jade Hegemony","Iron-Sand Sultanate","Glacial Hive"];
  if (opts.region && foreignZones.indexOf(opts.region) !== -1) {
    parts.push(P.foreign_material_note);
    parts.push("");
  }

  // 6. Category context (only selected category)
  if (P.cat_context[opts.category]) {
    parts.push(P.cat_context[opts.category]);
    parts.push("");
  }

  // 7. Region context (only if a specific region was selected)
  if (opts.region && opts.region !== AI_PICK && P.region_context[opts.region]) {
    parts.push(P.region_context[opts.region]);
    parts.push("");
  }

  // 8. Generation request
  var sel = "ITEM GENERATION REQUEST:\n";
  sel += "Rank: " + opts.rank + "\n";
  sel += "Category: " + opts.category + "\n";
  sel += "Subcategory: " + (opts.subcategory || "not specified — choose appropriately") + "\n";
  sel += "Rarity: " + (opts.rarity || "not specified — choose appropriately for rank and category") + "\n";
  sel += "Phase: " + (opts.phase || "standard (blank)") + "\n";
  sel += "Market Layer: " + opts.layer + "\n";
  if (opts.layer === "Black Market" && opts.bmTier) {
    sel += "BM Tier: " + opts.bmTier + " (" + (BM_LABELS[opts.bmTier] || opts.bmTier) + ")\n";
  }
  sel += "Origin: " + (opts.region && opts.region !== AI_PICK ? opts.region : "not specified — choose the most fitting region") + "\n";
  sel += "Custom notes: " + (opts.notes || "none — generate freely within the above selections");
  parts.push(sel);
  parts.push("");

  // 9. Output instructions (always)
  parts.push(P.item_output_instructions);
  parts.push("");

  // 10. Example (always — helps AI format correctly)
  parts.push(P.item_example);

  return parts.join("\n");
}

async function buildCommPrompt(opts) {
  var P = await loadPrompts();
  var parts = [];

  // 1. World header (always)
  parts.push(P.world_header);
  parts.push("");

  // 2. Global organizations (always — AI needs these for realistic poster names and contract context)
  if (P.world_orgs) {
    parts.push(P.world_orgs);
    parts.push("");
  }

  // 3. Region context (only if specific region selected)
  if (opts.region && opts.region !== AI_PICK && P.region_context[opts.region]) {
    parts.push(P.region_context[opts.region]);
    parts.push("");
  }

  // 4. Reward guidelines (always — commissions always need this)
  parts.push(P.comm_reward_guidelines);
  parts.push("");

  // 5. Generation request
  var sel = "COMMISSION GENERATION REQUEST:\n";
  sel += "Contract Type: " + opts.contractType + "\n";
  sel += "Difficulty (min rank): " + opts.difficulty + "\n";
  sel += "Danger Level: " + (opts.danger || "not specified — determine from difficulty and contract type") + "\n";
  sel += "Visibility Rank: " + (opts.visibilityRank || "Open") + "\n";
  sel += "Reward: " + (opts.reward || "not specified — set according to difficulty and danger guidelines") + "\n";
  sel += "Reward Classified: " + (opts.rewardClassified ? "true" : "false") + "\n";
  sel += "Origin: " + (opts.region && opts.region !== AI_PICK ? opts.region : "not specified — choose the most fitting region") + "\n";
  sel += "Poster: " + (opts.poster || "not specified — generate a name or use [ANONYMOUS] as appropriate") + "\n";
  sel += "Poster Anonymous: " + (opts.posterAnon ? "true" : "false") + "\n";
  sel += "Posted Date: " + (opts.postedDate || "not specified — leave blank") + "\n";
  sel += "Expires Date: " + (opts.expiresDate || "not specified — leave blank") + "\n";
  sel += "Custom notes: " + (opts.commNotes || "none — generate freely within the above selections");
  parts.push(sel);
  parts.push("");

  // 6. Output instructions (always)
  parts.push(P.comm_output_instructions);
  parts.push("");

  // 7. Example (always)
  parts.push(P.comm_example);

  return parts.join("\n");
}

// ── FILE WRITING ─────────────────────────────────────────────
async function writeItemFile(mdContent, category, subcategory) {
  var fnMatch = mdContent.match(/<!--\s*filename:\s*(.+?)\s*-->/);
  if (!fnMatch) throw new Error("AI response missing <!-- filename: ... --> comment");

  var rawName  = fnMatch[1].trim().replace(/\.md$/i, "");
  var safeName = rawName.replace(/[\\/:*?"<>|]/g, "-");

  var folder = "Inventory/" + category;
  if (subcategory && subcategory.trim()) {
    var sub = subcategory.trim();
    sub = sub.charAt(0).toUpperCase() + sub.slice(1);
    folder = folder + "/" + sub;
  }

  var parts = folder.split("/");
  var built = "";
  for (var i = 0; i < parts.length; i++) {
    built = built ? built + "/" + parts[i] : parts[i];
    if (!app.vault.getAbstractFileByPath(built)) {
      await app.vault.createFolder(built);
    }
  }

  var targetPath = folder + "/" + safeName + ".md";
  var counter = 2;
  while (app.vault.getAbstractFileByPath(targetPath)) {
    targetPath = folder + "/" + safeName + " " + counter + ".md";
    counter++;
  }

  var cleanContent = mdContent.replace(/<!--\s*filename:.*?-->\n?/, "").trimStart();
  await app.vault.create(targetPath, cleanContent);
  return targetPath;
}

async function writeCommissionFile(mdContent) {
  var fnMatch = mdContent.match(/<!--\s*filename:\s*(.+?)\s*-->/);
  if (!fnMatch) throw new Error("AI response missing <!-- filename: ... --> comment");

  var rawName  = fnMatch[1].trim().replace(/\.md$/i, "");
  var safeName = rawName.replace(/[\\/:*?"<>|]/g, "-");
  var folder   = "Inventory/Services/Commission";

  var parts = folder.split("/");
  var built = "";
  for (var i = 0; i < parts.length; i++) {
    built = built ? built + "/" + parts[i] : parts[i];
    if (!app.vault.getAbstractFileByPath(built)) {
      await app.vault.createFolder(built);
    }
  }

  var targetPath = folder + "/" + safeName + ".md";
  var counter = 2;
  while (app.vault.getAbstractFileByPath(targetPath)) {
    targetPath = folder + "/" + safeName + " " + counter + ".md";
    counter++;
  }

  var cleanContent = mdContent.replace(/<!--\s*filename:.*?-->\n?/, "").trimStart();
  await app.vault.create(targetPath, cleanContent);
  return targetPath;
}

// ── API CALL ─────────────────────────────────────────────────
async function callAPI(prompt) {
  var cfg      = await loadConfig();
  var provider = st.provider || cfg.activeProvider;
  var model    = st.model    || cfg.activeModel;
  var pCfg     = cfg.providers[provider];
  if (!pCfg || !pCfg.key) throw new Error("No API key for provider: " + provider);

  var systemPrompt = "You are a world-consistent item writer for the DEVOUR system. Return only the Obsidian markdown file content as instructed. No preamble, no explanation, no code fences.";

  var url, headers, body;

  if (provider === "aistudio") {
    url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + pCfg.key;
    headers = {"Content-Type": "application/json"};
    body = JSON.stringify({
      system_instruction: {parts: [{text: systemPrompt}]},
      contents: [{parts: [{text: prompt}]}],
      generationConfig: {temperature: 0.85, maxOutputTokens: 1500}
    });
  } else if (provider === "groq") {
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers = {"Content-Type": "application/json", "Authorization": "Bearer " + pCfg.key};
    body = JSON.stringify({
      model:    model,
      messages: [{role:"system",content:systemPrompt},{role:"user",content:prompt}],
      temperature: 0.85,
      max_tokens: 1500
    });
  } else if (provider === "openrouter") {
    url = "https://openrouter.ai/api/v1/chat/completions";
    headers = {"Content-Type": "application/json", "Authorization": "Bearer " + pCfg.key, "HTTP-Referer": "obsidian://devour"};
    body = JSON.stringify({
      model:    model,
      messages: [{role:"system",content:systemPrompt},{role:"user",content:prompt}],
      temperature: 0.85,
      max_tokens: 1500
    });
  } else {
    throw new Error("Unknown provider: " + provider);
  }

  var resp = await fetch(url, {method:"POST", headers:headers, body:body});
  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error("API error " + resp.status + ": " + errText.slice(0,200));
  }
  var data = await resp.json();

  var text = "";
  if (provider === "aistudio") {
    text = (data.candidates &&
            data.candidates[0] &&
            data.candidates[0].content &&
            data.candidates[0].content.parts &&
            data.candidates[0].content.parts[0] &&
            data.candidates[0].content.parts[0].text) || "";
  } else {
    text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  }

  text = text.replace(/^```(?:yaml|markdown|md)?\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return text;
}

// ── COPY HELPERS ─────────────────────────────────────────────
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(function() {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  });
}


// ── OPTION META ───────────────────────────────────────────────
var _SVG = {
  shield: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L3 4v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4L8 2z"/></svg>',
  gem: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14L2 7l2-4h8l2 4-6 7z"/><path d="M2 7h12"/><path d="M5 3l1 4M11 3l-1 4"/></svg>',
  lockOpen:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0"/></svg>',
  lockClosed: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/><circle cx="8" cy="11" r="1" fill="currentColor" stroke="none"/></svg>',
  lockGray:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 1.5"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2" stroke-dasharray="none"/></svg>',
  lockSkull:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10.5v1M10 10.5v1"/><path d="M5.5 8a2.5 2.5 0 015 0c0 1-.5 1.8-1.3 2.2V12h-2.4v-1.8C5.9 9.8 5.5 9 5.5 8z"/><path d="M8 2.5A5 5 0 003 7.5c0 1.8.9 3.3 2.3 4.2V13h5v-1.3A5 5 0 008 2.5z"/></svg>',
  shieldCheck: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L3 4v4c0 3 2.5 5 5 6 2.5-1 5-3 5-6V4L8 2z"/><path d="M5.5 8l2 2 3-3"/></svg>',
  alertTri:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L1.5 13h13L8 2z"/><path d="M8 6v4M8 11.5v.5"/></svg>',
  alertFire:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14c-3 0-5-2-5-4.5 0-2 1.5-3.5 2-5 .5 1 1 2 2 2.5C7 5.5 7.5 3 6 1c3 1 6 3.5 6 8.5 0 2.5-2 4.5-4 4.5z"/></svg>',
  skull:       '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.5 7a3.5 3.5 0 00-7 0c0 1.5.8 2.8 2 3.5V13h3v-2.5c1.2-.7 2-2 2-3.5z"/><path d="M6 13h4M6.5 10v1M9.5 10v1"/></svg>',
  question:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.5 6.5a1.5 1.5 0 012.8.75c0 1-1.3 1.25-1.3 2.25M8 12v.5"/></svg>',
  minus:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="3" y1="8" x2="13" y2="8"/></svg>',
  plus:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>',
  plus2:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="8" x2="12" y2="8"/><line x1="8" y1="4" x2="8" y2="12"/><line x1="2" y1="6" x2="14" y2="6"/></svg>',
  plus3:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="8" y1="3" x2="8" y2="13"/></svg>',
  dot:    '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="8" cy="8" r="2.5" fill="currentColor"/></svg>',
  sword:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l4 4-7 7-2-1-1-2 7-7z"/><path d="M3 13l2-2M6 12l-3 3"/></svg>',
  armor:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2L4 4v3c0 3.5 4 6 4 6s4-2.5 4-6V4L8 2z"/><path d="M8 7v4"/><path d="M6 9h4"/></svg>',
  gear:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="2"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1"/></svg>',
  flask:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h4M6 2v5L3 13h10L10 7V2"/><path d="M4 11h8"/></svg>',
  pill:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="10" height="4" rx="2"/><line x1="8" y1="6" x2="8" y2="10"/></svg>',
  crystal:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l3 4H5l3-4zM5 6l3 8 3-8"/></svg>',
  ore:       '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="8,2 13,6 11,13 5,13 3,6"/><line x1="8" y1="2" x2="8" y2="13"/></svg>',
  core:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/></svg>',
  paw:       '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="5" cy="5" rx="1.5" ry="2"/><ellipse cx="11" cy="5" rx="1.5" ry="2"/><ellipse cx="3.5" cy="8.5" rx="1.2" ry="1.6"/><ellipse cx="12.5" cy="8.5" rx="1.2" ry="1.6"/><path d="M5.5 10.5c.5-1.5 5-1.5 5 0 0 2-2.5 3.5-2.5 3.5s-2.5-1.5-2.5-3.5z"/></svg>',
  scroll:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 3h8a1 1 0 011 1v8a1 1 0 01-1 1H4a2 2 0 010-4h8"/><path d="M7 6h4M7 9h3"/></svg>',
  artifact:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l1.5 4.5H14l-3.7 2.7 1.4 4.3L8 11l-3.7 2.5 1.4-4.3L2 6.5h4.5L8 2z"/></svg>',
  handshake: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l3-3h2l2 2h2l3-3"/><path d="M5 6l1 5 2-2 2 2 1-5"/></svg>',
  target:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="3"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/></svg>',
  bag:       '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 6V4a3 3 0 016 0v2"/><rect x="2" y="6" width="12" height="8" rx="1.5"/></svg>',
  escort:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="5" r="2"/><path d="M2 13c0-2.5 2-4 4-4s4 1.5 4 4"/><path d="M12 8l2 2-2 2"/><path d="M10 10h4"/></svg>',
  taming:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="5" r="2.5"/><path d="M3 12c0-2 1.5-3.5 3.5-3.5 1 0 1.8.4 2.4 1"/><path d="M3 9l1.5 1.5L6 9"/></svg>',
  eye:       '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8s2.5-5 6.5-5 6.5 5 6.5 5-2.5 5-6.5 5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  sword2:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l9-9M9 4l3-1-1 3"/><path d="M4 12l-1 1"/></svg>',
  retrieval: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8a4 4 0 108 0H8"/><path d="M10 6l2 2-2 2"/></svg>',
  classified:'<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5 7V5a3 3 0 016 0v2"/><path d="M6 11h4M8 10v2" stroke-width="1.2"/></svg>',
  eyeOpen:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8s2.5-5 6.5-5 6.5 5 6.5 5-2.5 5-6.5 5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>',
  eyeLock:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4"/><path d="M7 9.5a1.5 1.5 0 002.8-.7V7.5a1.5 1.5 0 00-3 0v1"/><rect x="6" y="9" width="4" height="4" rx="1"/></svg>',
  crown:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h12M2 12L4 6l4 3 4-5 2 8"/></svg>',
  tree:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2l4 8H4l4-8z"/><path d="M8 10v4M6 14h4"/></svg>',
  snowflake: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>',
  wave:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 9c1-2 3-2 4 0s3 2 4 0 3-2 4 0"/><path d="M1 6c1-2 3-2 4 0s3 2 4 0 3-2 4 0"/></svg>',
  mountain:  '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 13L6 4l3 5 2-2.5L15 13H1z"/></svg>',
  city:      '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="5" height="7"/><rect x="6" y="4" width="4" height="10"/><rect x="10" y="6" width="5" height="8"/><path d="M1 14h14"/></svg>',
  compass:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M8 5l1.5 3.5L8 11l-1.5-2.5L8 5z"/></svg>',
  factory:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 14V8l4-2v2l4-2v2l4-4v8H1z"/><path d="M4 14v-3h3v3"/></svg>',
  sword3:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2l3 3-8 8-3-3 8-8z"/><path d="M2 14l2-2"/></svg>',
  wheat:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14V4"/><path d="M8 10c-1.5-1.5-3-1-3-1s.5 1.5 3 1.5"/><path d="M8 7c1.5-1.5 3-1 3-1s-.5 1.5-3 1.5"/><path d="M8 4c0-1.5-2-2-2-2s.5 2 2 2"/></svg>',
  anchor:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="5" r="2"/><path d="M8 7v7"/><path d="M3 9c0 3 5 5 5 5s5-2 5-5"/><path d="M3 5h10"/></svg>',
  abyss:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M5 8c0-2 1.5-3 3-3s3 1 3 3-3 5-3 5S5 10 5 8z"/></svg>',
  leaves:    '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13c1-4 4-6 9-6-1 4-4 7-9 6z"/><path d="M3 13l4-4"/></svg>',
  flame:     '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14c-3 0-5-2.5-5-5 0-2.5 2-4 2.5-6C6 4.5 6.5 6 8 6c0-2 1-4 2.5-4-1 2.5 2 4 2.5 6.5C13 10 12 14 8 14z"/></svg>',
  sparkle:   '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M4 12l2-2M10 6l2-2"/><circle cx="8" cy="8" r="2"/></svg>',
};

var OPTION_META = {
  "F": { color:"#607080", icon:_SVG.shield },
  "E": { color:"#5a9e6f", icon:_SVG.shield },
  "D": { color:"#4a8fcc", icon:_SVG.shield },
  "C": { color:"#9b6dd1", icon:_SVG.shield },
  "B": { color:"#d4a843", icon:_SVG.shield },
  "A": { color:"#e07840", icon:_SVG.shield },
  "S": { color:"#cc3333", icon:_SVG.shield },
  "Common":    { color:"#8a9aa8", icon:_SVG.gem },
  "Uncommon":  { color:"#6db56d", icon:_SVG.gem },
  "Rare":      { color:"#4a8fcc", icon:_SVG.gem },
  "Epic":      { color:"#9b6dd1", icon:_SVG.gem },
  "Legendary": { color:"#d4a843", icon:_SVG.gem },
  "Unique":    { color:"#e07840", icon:_SVG.gem },
  "Mythic":    { color:"#cc3333", icon:_SVG.gem },
  "Legal":         { color:"#5ab8b8", icon:_SVG.lockOpen  },
  "Gray":          { color:"#a0a0a0", icon:_SVG.lockGray  },
  "Legal + Gray":  { color:"#8aacb0", icon:_SVG.lockGray  },
  "Black Market":  { color:"#cc3300", icon:_SVG.lockSkull },
  "bm-low":      { color:"#c47a4a", icon:_SVG.alertTri  },
  "bm-mid":      { color:"#c45a2a", icon:_SVG.alertFire },
  "bm-high":     { color:"#b03020", icon:_SVG.skull     },
  "bm-critical": { color:"#8a1a10", icon:_SVG.skull     },
  "bm-foreign":  { color:"#d4a843", icon:_SVG.lockSkull },
  "":    { color:"#607080", icon:_SVG.dot   },
  "−":   { color:"#c95a5a", icon:_SVG.minus },
  "+":   { color:"#5a9e6f", icon:_SVG.plus  },
  "++":  { color:"#4a8fcc", icon:_SVG.plus2 },
  "+++": { color:"#9b6dd1", icon:_SVG.plus3 },
  "Weapons":     { color:"#c95a5a", icon:_SVG.sword     },
  "Armor":       { color:"#4a8fcc", icon:_SVG.armor     },
  "Equipment":   { color:"#9b6dd1", icon:_SVG.gear      },
  "Consumables": { color:"#5a9e6f", icon:_SVG.flask     },
  "Supplements": { color:"#5ab8b8", icon:_SVG.pill      },
  "Materials":   { color:"#c4956a", icon:_SVG.ore       },
  "Crystals":    { color:"#7ec8e3", icon:_SVG.crystal   },
  "Cores":       { color:"#d4a843", icon:_SVG.core      },
  "Creatures":   { color:"#6db56d", icon:_SVG.paw       },
  "Artifacts":   { color:"#e07840", icon:_SVG.artifact  },
  "Information": { color:"#a0a0a0", icon:_SVG.scroll    },
  "Services":    { color:"#8aacb0", icon:_SVG.handshake },
  "Bounty":         { color:"#c95a5a", icon:_SVG.target    },
  "Collection":     { color:"#c4956a", icon:_SVG.bag       },
  "Escort":         { color:"#5ab8b8", icon:_SVG.escort    },
  "Taming":         { color:"#6db56d", icon:_SVG.taming    },
  "Reconnaissance": { color:"#9b6dd1", icon:_SVG.eye       },
  "Clearance":      { color:"#4a8fcc", icon:_SVG.sword2    },
  "Retrieval":      { color:"#d4a843", icon:_SVG.retrieval },
  "Classified":     { color:"#cc3333", icon:_SVG.classified},
  "Low":      { color:"#5a9e6f", icon:_SVG.shieldCheck },
  "Moderate": { color:"#d4a843", icon:_SVG.alertTri   },
  "High":     { color:"#e07840", icon:_SVG.alertFire  },
  "Extreme":  { color:"#cc3333", icon:_SVG.skull      },
  "Unknown":  { color:"#607080", icon:_SVG.question   },
  "Open":          { color:"#8a9aa8", icon:_SVG.eyeOpen },
  "Listed":        { color:"#5a9e6f", icon:_SVG.eyeOpen },
  "Verified":      { color:"#5ab8b8", icon:_SVG.eyeLock },
  "Recognized":    { color:"#4a8fcc", icon:_SVG.eyeLock },
  "Notable":       { color:"#9b6dd1", icon:_SVG.eyeLock },
  "Distinguished": { color:"#d4a843", icon:_SVG.crown  },
  "Renowned":      { color:"#e07840", icon:_SVG.crown  },
  "Sovereign":     { color:"#cc3333", icon:_SVG.crown  },
  "Aethelgard Reach":    { color:"#6db56d", icon:_SVG.tree      },
  "Argent-Palar":        { color:"#7ec8e3", icon:_SVG.snowflake },
  "Esten Province":      { color:"#a0a0a0", icon:_SVG.compass   },
  "Orenthellion":        { color:"#d4a843", icon:_SVG.city      },
  "Vexton Nexus":        { color:"#9b6dd1", icon:_SVG.factory   },
  "Mordant Dominion":    { color:"#c4956a", icon:_SVG.mountain  },
  "Mardu Frontier":      { color:"#c95a5a", icon:_SVG.sword3    },
  "Fenner Basin":        { color:"#d4a76a", icon:_SVG.wheat     },
  "Solace Meridian":     { color:"#5ab8b8", icon:_SVG.anchor    },
  "Abyssal Convergence": { color:"#1a7a8a", icon:_SVG.abyss     },
  "Jade Hegemony":       { color:"#4a9e6b", icon:_SVG.leaves    },
  "Iron-Sand Sultanate": { color:"#8a3a3a", icon:_SVG.flame     },
  "Glacial Hive":        { color:"#8ab8d4", icon:_SVG.snowflake },
  [AI_PICK]: { color:"#364550", icon:_SVG.sparkle },
};

function getMeta(val) {
  return OPTION_META[val] || { color: "#607080", icon: null };
}

var REGION_COLORS = {};
ALL_REGIONS.forEach(function(r) {
  if (OPTION_META[r]) REGION_COLORS[r] = OPTION_META[r].color;
});

// ── UI BUILDERS ──────────────────────────────────────────────
var _overlayConfigs = {};

function getLabel(options, current) {
  for (var i = 0; i < options.length; i++) {
    var o   = options[i];
    var val = typeof o === "object" ? o.value : o;
    var lbl = typeof o === "object" ? o.label : o;
    if (val === current) return lbl;
  }
  return current || "—";
}

function sel(id, options, current, placeholder, opts_extra) {
  opts_extra = opts_extra || {};
  var gridCols      = opts_extra.gridCols  || 1;
  var groupedRegion = opts_extra.groupedRegion || false;
  var displayLabel  = getLabel(options, current) || placeholder || "—";
  var meta          = getMeta(current);
  var color         = meta.color || "#607080";
  var icon          = meta.icon  || "";
  var iconHtml      = icon
    ? '<span class="gen-ovl-ico gen-ovl-ico-btn" style="color:' + color + '">' + icon + '</span>'
    : '';
  var triggerInner = iconHtml + '<span>' + esc(displayLabel) + '</span>';
  _overlayConfigs[id] = { options: options, current: current, gridCols: gridCols, groupedRegion: groupedRegion };
  return (
    '<div class="gen-ovl-wrap" id="wrap-' + id + '">' +
      '<button class="gen-ovl-btn" id="btn-' + id + '" type="button">' +
        '<span class="gen-ovl-val" id="val-' + id + '">' + triggerInner + '</span>' +
        '<span class="gen-ovl-arrow">▾</span>' +
      '</button>' +
      '<div class="gen-ovl-panel" id="panel-' + id + '" style="display:none;">' +
        buildPanelInner(id, options, current, gridCols, groupedRegion) +
      '</div>' +
    '</div>'
  );
}

function buildPanelInner(id, options, current, gridCols, groupedRegion) {
  if (groupedRegion) {
    var html = '<div class="gen-ovl-section-label">Human Regions</div>';
    REGIONS_HUMAN.forEach(function(r) {
      html += buildOpt(id, r, r, current, false, REGION_COLORS[r] || null);
    });
    html += '<div class="gen-ovl-divider"></div>';
    html += '<div class="gen-ovl-section-label">Foreign Zones</div>';
    REGIONS_FOREIGN.forEach(function(r) {
      html += buildOpt(id, r, r, current, true, REGION_COLORS[r] || null);
    });
    var aiOpt = buildOpt(id, AI_PICK, AI_PICK, current, false, null);
    return aiOpt + html;
  }
  if (gridCols > 1) {
    var html = '<div class="gen-ovl-grid" style="grid-template-columns:repeat(' + gridCols + ',1fr);">';
    options.forEach(function(o) {
      var val = typeof o === "object" ? o.value : o;
      var lbl = typeof o === "object" ? o.label : o;
      html += buildOpt(id, val, lbl, current, false);
    });
    html += '</div>';
    return html;
  }
  var html = "";
  options.forEach(function(o) {
    var val = typeof o === "object" ? o.value : o;
    var lbl = typeof o === "object" ? o.label : o;
    if (val && val.indexOf("──") === 0) {
      html += '<div class="gen-ovl-sep">' + esc(lbl) + '</div>';
    } else {
      html += buildOpt(id, val, lbl, current, false);
    }
  });
  return html;
}

function buildOpt(id, val, lbl, current, isForeign, colorOverride) {
  var meta         = getMeta(val);
  var color        = colorOverride || meta.color || "#607080";
  var icon         = meta.icon || "";
  var activeClass  = (val === current) ? " active" : "";
  var foreignClass = isForeign ? " foreign" : "";
  var tintBg       = hexToRgba(color, 0.09);
  var tintBorder   = hexToRgba(color, 0.28);
  var tintStyle    = 'style="border-left:2px solid ' + tintBorder + ';background:' + tintBg + ';"';
  var prefix       = isForeign ? '<span class="gen-ovl-foreign-mark">⚠</span>' : '';
  var iconHtml     = icon ? '<span class="gen-ovl-ico" style="color:' + color + '">' + icon + '</span>' : '';
  return (
    '<div class="gen-ovl-opt' + activeClass + foreignClass + '" ' +
      tintStyle + ' ' +
      'data-ovl-id="'    + esc(id)    + '" ' +
      'data-ovl-val="'   + esc(val)   + '" ' +
      'data-ovl-lbl="'   + esc(lbl)   + '" ' +
      'data-ovl-color="' + esc(color) + '">' +
      iconHtml + prefix + esc(lbl) +
    '</div>'
  );
}

function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1,3),16);
  var g = parseInt(hex.slice(3,5),16);
  var b = parseInt(hex.slice(5,7),16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
}

function inp(id, val, placeholder) {
  return '<input class="gen-inp" id="' + id + '" value="' + esc(val || "") + '" placeholder="' + esc(placeholder || "") + '">';
}

function chk(id, checked, label) {
  return '<label class="gen-chk-label"><input type="checkbox" id="' + id + '"' + (checked ? " checked" : "") + '> ' + esc(label) + '</label>';
}

function regionOpts() {
  var opts = [{value: AI_PICK, label: AI_PICK}];
  opts.push({value: "── Human Regions ──", label: "── Human Regions ──"});
  REGIONS_HUMAN.forEach(function(r) { opts.push({value:r,label:r}); });
  opts.push({value: "── Foreign Zones ──", label: "── Foreign Zones ──"});
  REGIONS_FOREIGN.forEach(function(r) { opts.push({value:r,label:"⚠ " + r}); });
  return opts;
}

// ── MAIN RENDER ──────────────────────────────────────────────
function render() {
  var isItem    = st.mode === "item";
  var isComm    = st.mode === "commission";
  var isLoading = st.status === "loading";

  var modeToggle = '<div class="gen-mode-toggle">' +
    '<button class="gen-mode-btn' + (isItem ? " active" : "") + '" id="gen-mode-item">Item</button>' +
    '<button class="gen-mode-btn' + (isComm ? " active" : "") + '" id="gen-mode-comm">Commission</button>' +
    '</div>';

  var itemForm = "";
  if (isItem) {
    var showBM = st.layer === "Black Market";
    itemForm = '<div class="gen-form" id="gen-item-form">' +
      '<div class="gen-row"><label class="gen-label">Rank</label>' +
        sel("gen-rank", RANKS, st.rank) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Category</label>' +
        sel("gen-cat", MAJOR_CATS, st.category, null, {gridCols: 3}) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Subcategory</label>' +
        inp("gen-sub", st.subcategory, "e.g. shortsword — optional") + '</div>' +
      '<div class="gen-row"><label class="gen-label">Rarity</label>' +
        sel("gen-rarity", [{value:"",label:"— AI picks —"}].concat(RARITIES.map(function(r){return{value:r,label:r};})), st.rarity) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Phase</label>' +
        sel("gen-phase", [{value:"",label:"Standard (blank)"}].concat(["−","+","++","+++"].map(function(p){return{value:p,label:p};})), st.phase) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Market Layer</label>' +
        sel("gen-layer", LAYERS, st.layer) + '</div>' +
      (showBM ? '<div class="gen-row gen-row-indent"><label class="gen-label">BM Tier</label>' +
        sel("gen-bm", BM_TIERS.map(function(t){return{value:t,label:BM_LABELS[t]};}), st.bmTier) + '</div>' : "") +
      '<div class="gen-row"><label class="gen-label">Origin</label>' +
        sel("gen-region", regionOpts(), st.region, null, {groupedRegion: true}) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Notes</label>' +
        inp("gen-notes", st.notes, "Specific requests, or leave blank") + '</div>' +
    '</div>';
  }

  var commForm = "";
  if (isComm) {
    commForm = '<div class="gen-form" id="gen-comm-form">' +
      '<div class="gen-row"><label class="gen-label">Contract Type</label>' +
        sel("gen-ctype", CONTRACT_TYPES, st.contractType) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Difficulty</label>' +
        sel("gen-diff", RANKS, st.difficulty) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Danger</label>' +
        sel("gen-danger", [{value:"",label:"— AI picks —"}].concat(DANGERS.map(function(d){return{value:d,label:d};})), st.danger) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Visibility</label>' +
        sel("gen-vis", COMM_RANKS, st.visibilityRank) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Reward ₵</label>' +
        inp("gen-reward", st.reward, "Leave blank for AI") +
        chk("gen-rclassified", st.rewardClassified, "Classified") + '</div>' +
      '<div class="gen-row"><label class="gen-label">Origin</label>' +
        sel("gen-comm-region", regionOpts(), st.commRegion, null, {groupedRegion: true}) + '</div>' +
      '<div class="gen-row"><label class="gen-label">Poster</label>' +
        inp("gen-poster", st.poster, "Name or leave blank") +
        chk("gen-panon", st.posterAnon, "Anonymous") + '</div>' +
      '<div class="gen-row"><label class="gen-label">Posted Date</label>' +
        inp("gen-pdate", st.postedDate, "e.g. Year 19, Month 3") + '</div>' +
      '<div class="gen-row"><label class="gen-label">Expires</label>' +
        inp("gen-edate", st.expiresDate, "Optional") + '</div>' +
      '<div class="gen-row"><label class="gen-label">Notes</label>' +
        inp("gen-cnotes", st.commNotes, "Specific requests, or leave blank") + '</div>' +
    '</div>';
  }

  var statusHtml = "";
  if (st.status === "loading") {
    statusHtml = '<div class="gen-status gen-loading">Generating... please wait</div>';
  } else if (st.status === "done" && st.lastFileName) {
    statusHtml = '<div class="gen-status gen-success">✓ Written to: <code>' + esc(st.lastFileName) + '</code></div>';
  } else if (st.status === "error" && st.lastError) {
    statusHtml = '<div class="gen-status gen-error">✗ ' + esc(st.lastError) + '</div>';
  }

  var providerRow = "";
  if (st._cfg && st._cfg.providers) {
    var provOpts     = Object.keys(st._cfg.providers).map(function(p) { return { value: p, label: p }; });
    var currentProv  = st.provider || st._cfg.activeProvider || "";
    var modelList    = (st._cfg.providers[currentProv] && st._cfg.providers[currentProv].models) || [];
    var currentModel = st.model || st._cfg.activeModel || "";
    var modelOpts    = modelList.map(function(m) { return { value: m, label: m }; });
    providerRow = '<div class="gen-ai-row">' +
      '<label class="gen-label">Provider</label>' + sel("gen-provider", provOpts, currentProv) +
      '<label class="gen-label gen-label-model">Model</label>' + sel("gen-model", modelOpts, currentModel) +
    '</div>';
  } else {
    providerRow = '<div class="gen-ai-row gen-ai-loading">Loading config...</div>';
  }

  var btnDisabled = isLoading ? " disabled" : "";
  var buttons = '<div class="gen-btn-row">' +
    '<button class="gen-btn gen-btn-send" id="gen-send"' + btnDisabled + '>' +
      (isLoading ? "Generating..." : "Send") + '</button>' +
    '<button class="gen-btn gen-btn-copy" id="gen-copy"' + btnDisabled + '>Copy Prompt</button>' +
    '<button class="gen-btn gen-btn-full" id="gen-copy-full"' + btnDisabled + '>Copy Full</button>' +
  '</div>';

  container.innerHTML = '<div class="gen-root">' +
    modeToggle + itemForm + commForm + providerRow + statusHtml + buttons +
  '</div>';

  attachEvents();
}

// ── EVENT BINDING ────────────────────────────────────────────
function attachEvents() {
  function on(id, ev, fn) {
    var el2 = container.querySelector("#" + id);
    if (el2) el2.addEventListener(ev, fn);
  }

  on("gen-mode-item", "click", function() { st.mode = "item"; render(); });
  on("gen-mode-comm", "click", function() { st.mode = "commission"; render(); });

  var overlaySetters = {};

  if (st.mode === "item") {
    overlaySetters["gen-rank"]   = function(v) { st.rank     = v; render(); };
    overlaySetters["gen-cat"]    = function(v) { st.category = v; render(); };
    overlaySetters["gen-rarity"] = function(v) { st.rarity   = v; };
    overlaySetters["gen-phase"]  = function(v) { st.phase    = v; };
    overlaySetters["gen-layer"]  = function(v) { st.layer    = v; render(); };
    overlaySetters["gen-bm"]     = function(v) { st.bmTier   = v; };
    overlaySetters["gen-region"] = function(v) { st.region   = v; };
    on("gen-sub",   "input", function(e){ st.subcategory = e.target.value; });
    on("gen-notes", "input", function(e){ st.notes       = e.target.value; });
  }

  if (st.mode === "commission") {
    overlaySetters["gen-ctype"]       = function(v) { st.contractType   = v; };
    overlaySetters["gen-diff"]        = function(v) { st.difficulty     = v; };
    overlaySetters["gen-danger"]      = function(v) { st.danger         = v; };
    overlaySetters["gen-vis"]         = function(v) { st.visibilityRank = v; };
    overlaySetters["gen-comm-region"] = function(v) { st.commRegion     = v; };
    on("gen-reward",      "input",  function(e){ st.reward           = e.target.value; });
    on("gen-rclassified", "change", function(e){ st.rewardClassified = e.target.checked; });
    on("gen-poster",      "input",  function(e){ st.poster           = e.target.value; });
    on("gen-panon",       "change", function(e){ st.posterAnon       = e.target.checked; });
    on("gen-pdate",       "input",  function(e){ st.postedDate       = e.target.value; });
    on("gen-edate",       "input",  function(e){ st.expiresDate      = e.target.value; });
    on("gen-cnotes",      "input",  function(e){ st.commNotes        = e.target.value; });
  }

  overlaySetters["gen-provider"] = function(v) {
    st.provider = v;
    if (st._cfg && st._cfg.providers[st.provider]) {
      var models = st._cfg.providers[st.provider].models || [];
      st.model = models[0] || "";
    }
    render();
  };
  overlaySetters["gen-model"] = function(v) { st.model = v; };

  attachOverlayEvents(overlaySetters);

  // Send button — now async-aware with prompt loader
  on("gen-send", "click", async function() {
    st.status       = "loading";
    st.lastError    = null;
    st.lastFileName = null;
    render();
    try {
      var prompt = st.mode === "item"
        ? await buildItemPrompt(st)
        : await buildCommPrompt(st);
      var result = await callAPI(prompt);
      st.lastResult = result;
      var filePath;
      if (st.mode === "item") {
        filePath = await writeItemFile(result, st.category, st.subcategory);
      } else {
        filePath = await writeCommissionFile(result);
      }
      st.lastFileName = filePath;
      st.status = "done";
    } catch(e) {
      st.lastError = e.message;
      st.status    = "error";
    }
    render();
  });

  // Copy Prompt button — now async-aware
  on("gen-copy", "click", async function() {
    try {
      var prompt = st.mode === "item"
        ? await buildItemPrompt(st)
        : await buildCommPrompt(st);
      copyToClipboard(prompt);
      var btn = container.querySelector("#gen-copy");
      if (btn) { btn.textContent = "Copied!"; setTimeout(function(){ btn.textContent = "Copy Prompt"; }, 1500); }
    } catch(e) {
      var btn = container.querySelector("#gen-copy");
      if (btn) { btn.textContent = "Error"; setTimeout(function(){ btn.textContent = "Copy Prompt"; }, 1500); }
    }
  });

  // Copy Full button — now async-aware
  on("gen-copy-full", "click", async function() {
    try {
      var prompt = st.mode === "item"
        ? await buildItemPrompt(st)
        : await buildCommPrompt(st);
      copyToClipboard(prompt);
      var btn = container.querySelector("#gen-copy-full");
      if (btn) { btn.textContent = "Copied!"; setTimeout(function(){ btn.textContent = "Copy Full"; }, 1500); }
    } catch(e) {
      var btn = container.querySelector("#gen-copy-full");
      if (btn) { btn.textContent = "Error"; setTimeout(function(){ btn.textContent = "Copy Full"; }, 1500); }
    }
  });
}

// ── OVERLAY EVENT WIRING ──────────────────────────────────────
function attachOverlayEvents(setters) {
  var openId      = null;
  var _backdrop   = null;
  var _floatPanel = null;

  function closeAll() {
    if (!openId) return;
    var btn = container.querySelector("#btn-" + openId);
    if (btn) btn.classList.remove("open");
    if (_backdrop   && _backdrop.parentNode)   _backdrop.parentNode.removeChild(_backdrop);
    if (_floatPanel && _floatPanel.parentNode) _floatPanel.parentNode.removeChild(_floatPanel);
    _backdrop   = null;
    _floatPanel = null;
    openId = null;
  }

  function openPanel(id) {
    closeAll();
    var templatePanel = container.querySelector("#panel-" + id);
    var btn           = container.querySelector("#btn-"   + id);
    if (!templatePanel) return;

    _backdrop = document.createElement("div");
    _backdrop.className = "gen-ovl-backdrop";
    _backdrop.addEventListener("click", function(e) { e.stopPropagation(); closeAll(); });
    document.body.appendChild(_backdrop);

    _floatPanel = document.createElement("div");
    _floatPanel.className = "gen-ovl-modal";

    var titleMap = {
      "gen-rank":"Select Rank","gen-cat":"Select Category",
      "gen-rarity":"Select Rarity","gen-phase":"Select Phase",
      "gen-layer":"Select Market Layer","gen-bm":"Select BM Tier",
      "gen-region":"Select Origin","gen-comm-region":"Select Origin",
      "gen-ctype":"Select Contract Type","gen-diff":"Select Difficulty",
      "gen-danger":"Select Danger","gen-vis":"Select Visibility",
      "gen-provider":"Select Provider","gen-model":"Select Model"
    };
    var titleText = titleMap[id] || "Select";
    _floatPanel.innerHTML =
      '<div class="gen-ovl-modal-header">' +
        '<span class="gen-ovl-modal-title">' + titleText + '</span>' +
        '<button class="gen-ovl-modal-close" id="gen-ovl-close">✕</button>' +
      '</div>' +
      '<div class="gen-ovl-modal-body">' + templatePanel.innerHTML + '</div>';

    document.body.appendChild(_floatPanel);

    var closeBtn = _floatPanel.querySelector("#gen-ovl-close");
    if (closeBtn) closeBtn.addEventListener("click", function(e) { e.stopPropagation(); closeAll(); });

    _floatPanel.addEventListener("click", function(e) {
      var opt = e.target.closest ? e.target.closest(".gen-ovl-opt") : null;
      if (!opt) return;
      e.stopPropagation();
      var val = opt.getAttribute("data-ovl-val");
      var lbl = opt.getAttribute("data-ovl-lbl");
      if (!setters[id]) { closeAll(); return; }
      var valEl = container.querySelector("#val-" + id);
      if (valEl) {
        var selMeta  = getMeta(val);
        var selColor = opt.getAttribute("data-ovl-color") || selMeta.color || "#607080";
        var selIcon  = selMeta.icon || "";
        var iconHtml = selIcon
          ? '<span class="gen-ovl-ico gen-ovl-ico-btn" style="color:' + selColor + '">' + selIcon + '</span>'
          : '';
        valEl.innerHTML = iconHtml + '<span>' + esc(lbl) + '</span>';
      }
      closeAll();
      setters[id](val);
    });

    if (btn) btn.classList.add("open");
    openId = id;

    requestAnimationFrame(function() {
      _backdrop.classList.add("gen-ovl-backdrop-in");
      _floatPanel.classList.add("gen-ovl-modal-in");
    });
  }

  Object.keys(setters).forEach(function(id) {
    var btn = container.querySelector("#btn-" + id);
    if (!btn) return;
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      if (openId === id) { closeAll(); } else { openPanel(id); }
    });
  });

  document.addEventListener("keydown", function(e) {
    if (e.key === "Escape") closeAll();
  });
}

// ── INIT ─────────────────────────────────────────────────────
initConfigState().then(function() { render(); });

}; // end DEVOUR.modules["generate"]

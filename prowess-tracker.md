---
obsidianUIMode: preview
cssclasses:
  - full-page-db
---

```dataviewjs
/* ═══════════════════════════════════════════════════════════════════════════════
   PROWESS TRACKER - Complete Novel Chapter Analysis System
   For Obsidian Mobile + DataviewJS
   Aesthetic: Ancient + Modern + Magic
   Version: 2.0.0 (Auto-Styling · Dynamic Tabs · Sticky Panel)
   ═══════════════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const _input = (typeof input !== "undefined") ? input : {};

const PROWESS = {
  version: "2.0.0",
  configPath: "prowess_config.json",
  chaptersFolder: _input?.chaptersFolder || "Prowess/Chapters",
  rawChaptersFolder: _input?.rawChaptersFolder || "Prowess/RawChapters",
  charactersFolder: _input?.charactersFolder || "Prowess/Characters",
  settingsPath: "Prowess/settings.json",
  splitDelimiter: "\n---SPLIT---\n",
  imageCachePath: "Prowess/image_cache.json",
};

const DEFAULT_SETTINGS = {
  backgroundImage: "",
  blurAmount: 8,
  overlayOpacity: 0.75,
  accentColor: "#d4a853",
  defaultApiProvider: "aistudio",
  defaultModel: "gemini-2.5-flash",
  chaptersFolder: "Prowess/Chapters",
  rawChaptersFolder: "Prowess/RawChapters",
  charactersFolder: "Prowess/Characters",
  // Sticky panel settings (new in v2.0)
  stickyPanelEnabled: true,
  stickyPanelItems: ["characters", "locations", "factions", "artifacts", "timers"],
  disabledTabs: [],     // TAB_CONFIG ids that are hidden + excluded from AI prompt
  customTabs: [],       // User-defined tabs: {id, label, jsonField, structure, prompt}
};

// Tab configuration — define order, labels, and which data fields determine visibility
// New tabs auto-style via CSS nth-child color cycling — no CSS edits needed
const TAB_CONFIG = [
  { id: "chapters",    label: "Chapters",   icon: "\u2726", dataField: null },
  { id: "characters",  label: "Characters", icon: "\u263A", dataField: "newCharacters" },
  { id: "timers",      label: "Timers",     icon: "\u23F1", dataField: "timers" },
  { id: "locations",   label: "Locations",  icon: "\u26EB", dataField: "activeLocations" },
  { id: "factions",    label: "Factions",   icon: "\u26A1", dataField: "factions" },
  { id: "artifacts",   label: "Artifacts",  icon: "\u2694", dataField: "artifacts" },
  { id: "prowess",     label: "Prowess",    icon: "\u2605", dataField: "prowessUpdates" },
  { id: "status",      label: "Status",     icon: "\u2668", dataField: "statusChanges" },
  { id: "world",       label: "World",      icon: "\u265F", dataField: "worldBuilding" },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function loadConfig() {
  try {
    const file = app.vault.getAbstractFileByPath(PROWESS.configPath);
    if (!file) return null;
    const content = await app.vault.cachedRead(file);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function loadSettings() {
  try {
    const file = app.vault.getAbstractFileByPath(PROWESS.settingsPath);
    if (!file) return DEFAULT_SETTINGS;
    const content = await app.vault.read(file);
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch (e) {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings) {
  try {
    const folder = "Prowess";
    const folderExists = app.vault.getAbstractFileByPath(folder);
    if (!folderExists) await app.vault.createFolder(folder);
    const file = app.vault.getAbstractFileByPath(PROWESS.settingsPath);
    const data = JSON.stringify(settings, null, 2);
    if (file) {
      await app.vault.modify(file, data);
    } else {
      await app.vault.create(PROWESS.settingsPath, data);
    }
    return true;
  } catch (e) {
    // Show error visibly on mobile instead of silently failing
    const errDiv = document.createElement("div");
    errDiv.style.cssText = "position:fixed;top:60px;left:10px;right:10px;background:#8b0000;color:#fff;padding:12px;border-radius:8px;z-index:9999;font-size:13px;";
    errDiv.textContent = "Settings save failed: " + e.message;
    document.body.appendChild(errDiv);
    setTimeout(() => errDiv.remove(), 6000);
    return false;
  }
}

async function saveImageCache(base64Data, fileName, mimeType) {
  try {
    const folder = "Prowess";
    const folderExists = app.vault.getAbstractFileByPath(folder);
    if (!folderExists) await app.vault.createFolder(folder);
    const cache = { base64Data, fileName, mimeType, savedAt: Date.now() };
    const content = JSON.stringify(cache, null, 2);
    const file = app.vault.getAbstractFileByPath(PROWESS.imageCachePath);
    if (file) {
      await app.vault.modify(file, content);
    } else {
      await app.vault.create(PROWESS.imageCachePath, content);
    }
    return cache;
  } catch (e) {
    console.error("Failed to save image cache:", e);
    return null;
  }
}

async function loadImageCache() {
  try {
    const file = app.vault.getAbstractFileByPath(PROWESS.imageCachePath);
    if (!file) return null;
    const content = await app.vault.cachedRead(file);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function ensureFolder(path) {
  const parts = path.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const exists = app.vault.getAbstractFileByPath(current);
    if (!exists) {
      await app.vault.createFolder(current);
    }
  }
}

async function readJsonFile(path) {
  try {
    const file = app.vault.getAbstractFileByPath(path);
    if (!file) return null;
    const content = await app.vault.cachedRead(file);
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
}

async function writeJsonFile(path, data) {
  await ensureFolder(path.substring(0, path.lastIndexOf("/")));
  const file = app.vault.getAbstractFileByPath(path);
  const content = JSON.stringify(data, null, 2);
  if (file) {
    await app.vault.modify(file, content);
  } else {
    await app.vault.create(path, content);
  }
}

async function writeTextFile(path, textContent) {
  await ensureFolder(path.substring(0, path.lastIndexOf("/")));
  const file = app.vault.getAbstractFileByPath(path);
  if (file) {
    await app.vault.modify(file, textContent);
  } else {
    await app.vault.create(path, textContent);
  }
}

async function listJsonFiles(folder) {
  const files = [];
  const folderObj = app.vault.getAbstractFileByPath(folder);
  if (!folderObj || !folderObj.children) return files;
  for (const child of folderObj.children) {
    if (child.extension === "json" && child.name.startsWith("chapter_")) {
      files.push(child);
    }
  }
  return files.sort((a, b) => {
    const numA = parseInt(a.name.match(/chapter_(\\d+)/)?.[1] || 0);
    const numB = parseInt(b.name.match(/chapter_(\\d+)/)?.[1] || 0);
    return numA - numB;
  });
}

async function listRawChapterFiles(folder) {
  const files = [];
  const folderObj = app.vault.getAbstractFileByPath(folder);
  if (!folderObj || !folderObj.children) return files;
  for (const child of folderObj.children) {
    if (child.extension === "txt" || child.extension === "md") {
      files.push(child);
    }
  }
  return files;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function sanitizeFilename(name) {
  return name.replace(/[\\/*?"<>|:#^]/g, "_").trim();
}

function countTokens(text) {
  let count = 0;
  for (const char of text) {
    count += (char.charCodeAt(0) > 127) ? 1 : 0.25;
  }
  return Math.ceil(count);
}

function countChars(text) {
  return text?.length || 0;
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function mergeChapterData(existing, newData) {
  const merged = deepClone(existing);
  const arrayFields = [
    "keyIncidents", "openThreads", "activeLocations",
    "worldBuilding", "factions", "artifacts", "resources",
    "prowessUpdates", "statusChanges", "timers",
  ];
  for (const field of arrayFields) {
    const existingArr = merged[field] || [];
    const newArr = newData[field] || [];
    if (field === "artifacts" || field === "resources") {
      const nameMap = new Map();
      for (const item of existingArr) {
        if (item?.name) nameMap.set(item.name.toLowerCase(), item);
      }
      for (const item of newArr) {
        if (item?.name) nameMap.set(item.name.toLowerCase(), item);
      }
      merged[field] = Array.from(nameMap.values());
    } else if (field === "prowessUpdates" || field === "statusChanges") {
      const keyMap = new Map();
      for (const item of existingArr) {
        const key = `${item?.character || ""}_${item?.change || ""}`;
        if (key) keyMap.set(key.toLowerCase(), item);
      }
      for (const item of newArr) {
        const key = `${item?.character || ""}_${item?.change || ""}`;
        if (key) keyMap.set(key.toLowerCase(), item);
      }
      merged[field] = Array.from(keyMap.values());
    } else {
      const combined = [...existingArr, ...newArr];
      merged[field] = [...new Set(combined.map(s => String(s).toLowerCase()))]
        .map(name => {
          const orig = combined.find(i => String(i).toLowerCase() === name);
          return orig || name;
        });
    }
  }
  const charMap = new Map();
  for (const ch of (merged.newCharacters || [])) {
    if (ch?.name) charMap.set(ch.name.toLowerCase(), ch);
  }
  for (const ch of (newData.newCharacters || [])) {
    if (ch?.name) charMap.set(ch.name.toLowerCase(), ch);
  }
  merged.newCharacters = Array.from(charMap.values());
  const intMap = new Map();
  for (const i of (merged.protagonistInteractions || [])) {
    const key = `${i?.character || ""}_${i?.location || ""}`;
    if (key) intMap.set(key.toLowerCase(), i);
  }
  for (const i of (newData.protagonistInteractions || [])) {
    const key = `${i?.character || ""}_${i?.location || ""}`;
    if (key) intMap.set(key.toLowerCase(), i);
  }
  merged.protagonistInteractions = Array.from(intMap.values());
  if (newData.detailedSummary && newData.detailedSummary.length > (merged.detailedSummary?.length || 0)) {
    merged.detailedSummary = newData.detailedSummary;
  }
  if (newData.coreSummary) merged.coreSummary = newData.coreSummary;
  if (newData.chapterTitle) merged.chapterTitle = newData.chapterTitle;
  if (newData.timeline) merged.timeline = newData.timeline;
  if (newData.splitInfo) merged.splitInfo = { ...merged.splitInfo, ...newData.splitInfo };
  return merged;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: AI PROMPT CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════════

const EXTRACTION_OPTIONS = {
  coreSummary: { label: "Core Summary", desc: "3-4 sentence overview" },
  detailedSummary: { label: "Detailed Summary", desc: "Longer comprehensive summary" },
  keyIncidents: { label: "Key Incidents", desc: "Major battles, revelations, turning points" },
  openThreads: { label: "Open Threads", desc: "Unresolved conflicts, mysteries" },
  timeline: { label: "Timeline", desc: "Day, season, era of chapter events" },
  newCharacters: { label: "New Characters", desc: "First appearances with details" },
  protagonistInteractions: { label: "Protagonist Interactions", desc: "Who MC met, where, nature of exchange" },
  prowessUpdates: { label: "Prowess Updates", desc: "Power level changes, new techniques, rank milestones (Dormant to SSS)" },
  statusChanges: { label: "Status Changes", desc: "Injuries, deaths, emotional shifts, allegiance changes" },
  activeLocations: { label: "Active Locations", desc: "Biomes, cities, continents visited" },
  worldBuilding: { label: "World-Building", desc: "New history, myths, societal rules" },
  factions: { label: "Factions", desc: "Active sects, clans, ruling bodies" },
  artifacts: { label: "Artifacts", desc: "Weapons, relics, quest items discovered/lost/used" },
  resources: { label: "Resources", desc: "Materials, currency, supplies" },
  timers: { label: "Novel Timers", desc: "Time-sensitive events (e.g., '2 days until trial')" },
};

function buildPrompt(chapterText, selectedOptions, isValidation = false, existingJson = null, settings = {}) {
  const disabled = settings.disabledTabs || [];
  const customTabs = settings.customTabs || [];
  const parts = [];
  if (isValidation) {
    parts.push(`VALIDATE AND ENHANCE: Review the following chapter analysis JSON against the original chapter text. Identify any missing information, inaccuracies, or important details that were overlooked. Add anything important that was missed and correct any errors.`);
    parts.push(`\nEXISTING JSON:\n${JSON.stringify(existingJson, null, 2)}`);
    parts.push(`\nORIGINAL CHAPTER:\n${chapterText}`);
  } else {
    parts.push(`Analyze the following novel chapter and extract the specified information. Respond ONLY with a valid JSON object. No markdown formatting, no code fences, no explanation text - ONLY raw JSON.`);
    parts.push(`\nCHAPTER TEXT:\n${chapterText}`);
  }
  const instructions = [];
  const schema = {};
  if (selectedOptions.coreSummary && !disabled.includes("coreSummary")) {
    instructions.push("coreSummary: Write a concise 3-4 sentence overview of the primary events and outcomes.");
    schema.coreSummary = "string";
  }
  if (selectedOptions.detailedSummary && !disabled.includes("detailedSummary")) {
    instructions.push("detailedSummary: Write a comprehensive but focused summary covering all significant events in the chapter.");
    schema.detailedSummary = "string";
  }
  if (selectedOptions.keyIncidents && !disabled.includes("keyIncidents")) {
    instructions.push("keyIncidents: List major battles, revelations, or turning points as an array of strings.");
    schema.keyIncidents = ["string"];
  }
  if (selectedOptions.openThreads && !disabled.includes("openThreads")) {
    instructions.push("openThreads: List unresolved conflicts, promises made, or newly introduced mysteries.");
    schema.openThreads = ["string"];
  }
  if (selectedOptions.timeline && !disabled.includes("timeline")) {
    instructions.push("timeline: Specify the day, season, year, or era. Format: 'Day X, Season, Year' or descriptive.");
    schema.timeline = "string";
  }
  if (selectedOptions.newCharacters && !disabled.includes("characters")) {
    instructions.push("newCharacters: Array of objects with {name, firstAppearance: true, meetingLocation, description, faction}. Only characters making their FIRST appearance in this chapter.");
    schema.newCharacters = [{ name: "string", firstAppearance: true, meetingLocation: "string", description: "string", faction: "string" }];
  }
  if (selectedOptions.protagonistInteractions && !disabled.includes("characters")) {
    instructions.push("protagonistInteractions: Array of {character, location, natureOfExchange}. Who the main character met, where, and what happened.");
    schema.protagonistInteractions = [{ character: "string", location: "string", natureOfExchange: "string" }];
  }
  if (selectedOptions.prowessUpdates && !disabled.includes("prowess")) {
    instructions.push("prowessUpdates: Array of {character, change, rank, description}. Power level shifts, new techniques, cultivation breakthroughs. Ranks: Dormant, F, E, D, C, B, A, S, SS, SSS.");
    schema.prowessUpdates = [{ character: "string", change: "string", rank: "string", description: "string" }];
  }
  if (selectedOptions.statusChanges && !disabled.includes("status")) {
    instructions.push("statusChanges: Array of {character, change, description}. Significant injuries, deaths, emotional shifts, allegiance changes.");
    schema.statusChanges = [{ character: "string", change: "string", description: "string" }];
  }
  if (selectedOptions.activeLocations && !disabled.includes("locations")) {
    instructions.push("activeLocations: Array of location names where the chapter takes place or characters travel.");
    schema.activeLocations = ["string"];
  }
  if (selectedOptions.worldBuilding && !disabled.includes("world")) {
    instructions.push("worldBuilding: Array of newly introduced history, myths, societal rules, or lore elements.");
    schema.worldBuilding = ["string"];
  }
  if (selectedOptions.factions && !disabled.includes("factions")) {
    instructions.push("factions: Array of faction names actively involved or mentioned.");
    schema.factions = ["string"];
  }
  if (selectedOptions.artifacts && !disabled.includes("artifacts")) {
    instructions.push("artifacts: Array of {name, action (discovered/lost/used), description, location}. Weapons, relics, quest items.");
    schema.artifacts = [{ name: "string", action: "string", description: "string", location: "string" }];
  }
  if (selectedOptions.resources && !disabled.includes("resources")) {
    instructions.push("resources: Array of {name, amount, action (acquired/consumed), description}. Materials, currency, supplies.");
    schema.resources = [{ name: "string", amount: "string", action: "string", description: "string" }];
  }
  if (selectedOptions.timers && !disabled.includes("timers")) {
    instructions.push("timers: Array of {description, timeRemaining, eventType}. Time-sensitive events mentioned: '2 days until trial', 'one month for toxin', etc.");
    schema.timers = [{ description: "string", timeRemaining: "string", eventType: "string" }];
  }

  // Inject enabled custom tab prompts
  for (const ct of customTabs) {
    if (disabled.includes(ct.id)) continue;
    if (!selectedOptions[ct.jsonField]) continue;
    instructions.push(`${ct.jsonField}: ${ct.prompt}`);
    schema[ct.jsonField] = getCustomTabSchema(ct.structure);
  }

  schema.chapterNumber = "number";
  schema.chapterTitle = "string";
  parts.push(`\n${isValidation ? "VALIDATE AND RETURN complete corrected JSON with these fields:" : "EXTRACT and return JSON with these fields:"}`);
  parts.push(instructions.join("\n"));
  parts.push(`\nJSON SCHEMA (follow exactly):\n${JSON.stringify(schema, null, 2)}`);
  const backticks = "```";
  parts.push(`\nRULES:
- Return ONLY valid raw JSON. No markdown, no ${backticks}, no explanations.
- Use empty arrays [] or empty strings "" for missing data, never null for arrays.
- Character names must be exact and consistent.
- All text fields: plain text only, no markdown formatting.
- Ensure JSON is syntactically valid. Every opening bracket must close.`);
  return parts.join("\n");
}

// Returns the JSON schema shape for a custom tab based on its structure type
function getCustomTabSchema(structure) {
  switch (structure) {
    case "simple-list":    return ["string"];
    case "name-desc":      return [{ name: "string", description: "string" }];
    case "name-desc-meta": return [{ name: "string", description: "string", meta: "string" }];
    case "character-update": return [{ character: "string", change: "string", description: "string" }];
    case "artifact-style": return [{ name: "string", action: "string", description: "string", location: "string" }];
    default:               return [{ name: "string", description: "string" }];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: API INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

async function callAI(provider, model, prompt, config) {
  const providerConfig = config?.providers?.[provider];
  if (!providerConfig) throw new Error(`Provider ${provider} not configured`);
  const apiKey = providerConfig.key;
  if (!apiKey) throw new Error(`No API key for ${provider}`);
  let url, body, headers;
  switch (provider) {
    case "aistudio": {
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      body = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      });
      headers = { "Content-Type": "application/json" };
      break;
    }
    case "groq": {
      url = "https://api.groq.com/openai/v1/chat/completions";
      body = JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a precise JSON generator. Respond only with valid raw JSON, no markdown formatting." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      });
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      };
      break;
    }
    case "openrouter": {
      url = "https://openrouter.ai/api/v1/chat/completions";
      body = JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: "You are a precise JSON generator. Respond only with valid raw JSON, no markdown formatting." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 8192,
      });
      headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "obsidian://prowess-tracker",
        "X-Title": "Prowess Tracker",
      };
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error (${response.status}): ${errorText}`);
  }
  const result = await response.json();
  let text;
  if (provider === "aistudio") {
    text = result.candidates?.[0]?.content?.parts?.[0]?.text;
  } else {
    text = result.choices?.[0]?.message?.content;
  }
  if (!text) throw new Error("Empty response from AI");
  text = text.trim();
  if (text.startsWith("```json")) {
    text = text.replace(/```json\s*/, "").replace(/\s*```\s*$/, "");
  } else if (text.startsWith("```")) {
    text = text.replace(/```\s*/, "").replace(/\s*```\s*$/, "");
  }
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error(`Invalid JSON response: ${e.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: CHARACTER DATABASE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

async function updateCharacterDatabase(chapterData) {
  const allChars = new Map();
  const charFolder = PROWESS.charactersFolder;
  await ensureFolder(charFolder);
  const charFolderObj = app.vault.getAbstractFileByPath(charFolder);
  if (charFolderObj?.children) {
    for (const child of charFolderObj.children) {
      if (child.extension === "json") {
        try {
          const data = await readJsonFile(child.path);
          if (data?.name) allChars.set(data.name.toLowerCase(), data);
        } catch (e) {}
      }
    }
  }
  for (const ch of (chapterData.newCharacters || [])) {
    if (!ch?.name) continue;
    const key = ch.name.toLowerCase();
    const existing = allChars.get(key);
    if (existing) {
      existing.firstAppearanceChapter = existing.firstAppearanceChapter || chapterData.chapterNumber;
      if (ch.meetingLocation && !existing.meetingLocations?.includes(ch.meetingLocation)) {
        existing.meetingLocations = existing.meetingLocations || [];
        existing.meetingLocations.push({
          chapter: chapterData.chapterNumber,
          location: ch.meetingLocation,
        });
      }
      existing.lastAppearanceChapter = chapterData.chapterNumber;
      existing.faction = ch.faction || existing.faction;
      existing.description = ch.description || existing.description;
      allChars.set(key, existing);
    } else {
      allChars.set(key, {
        name: ch.name,
        firstAppearanceChapter: chapterData.chapterNumber,
        lastAppearanceChapter: chapterData.chapterNumber,
        meetingLocations: ch.meetingLocation ? [{
          chapter: chapterData.chapterNumber,
          location: ch.meetingLocation,
        }] : [],
        faction: ch.faction || "",
        description: ch.description || "",
        interactions: [],
        statusChanges: [],
        prowessUpdates: [],
      });
    }
  }
  for (const interaction of (chapterData.protagonistInteractions || [])) {
    if (!interaction?.character) continue;
    const key = interaction.character.toLowerCase();
    let char = allChars.get(key);
    if (!char) {
      char = {
        name: interaction.character,
        firstAppearanceChapter: chapterData.chapterNumber,
        lastAppearanceChapter: chapterData.chapterNumber,
        meetingLocations: [],
        faction: "",
        description: "",
        interactions: [],
        statusChanges: [],
        prowessUpdates: [],
      };
      allChars.set(key, char);
    }
    char.interactions.push({
      chapter: chapterData.chapterNumber,
      location: interaction.location || "",
      nature: interaction.natureOfExchange || "",
    });
    char.lastAppearanceChapter = chapterData.chapterNumber;
  }
  for (const sc of (chapterData.statusChanges || [])) {
    if (!sc?.character) continue;
    const key = sc.character.toLowerCase();
    let char = allChars.get(key);
    if (!char) {
      char = {
        name: sc.character,
        firstAppearanceChapter: chapterData.chapterNumber,
        lastAppearanceChapter: chapterData.chapterNumber,
        meetingLocations: [],
        faction: "",
        description: "",
        interactions: [],
        statusChanges: [],
        prowessUpdates: [],
      };
      allChars.set(key, char);
    }
    char.statusChanges.push({
      chapter: chapterData.chapterNumber,
      change: sc.change,
      description: sc.description || "",
    });
    char.lastAppearanceChapter = chapterData.chapterNumber;
  }
  for (const pu of (chapterData.prowessUpdates || [])) {
    if (!pu?.character) continue;
    const key = pu.character.toLowerCase();
    let char = allChars.get(key);
    if (!char) {
      char = {
        name: pu.character,
        firstAppearanceChapter: chapterData.chapterNumber,
        lastAppearanceChapter: chapterData.chapterNumber,
        meetingLocations: [],
        faction: "",
        description: "",
        interactions: [],
        statusChanges: [],
        prowessUpdates: [],
      };
      allChars.set(key, char);
    }
    char.prowessUpdates.push({
      chapter: chapterData.chapterNumber,
      change: pu.change,
      rank: pu.rank || "",
      description: pu.description || "",
    });
    char.lastAppearanceChapter = chapterData.chapterNumber;
  }
  for (const [key, charData] of allChars) {
    const filePath = `${charFolder}/${sanitizeFilename(charData.name)}.json`;
    await writeJsonFile(filePath, charData);
  }
}

async function getAllCharacters() {
  const chars = [];
  const charFolderObj = app.vault.getAbstractFileByPath(PROWESS.charactersFolder);
  if (!charFolderObj?.children) return chars;
  for (const child of charFolderObj.children) {
    if (child.extension === "json") {
      try {
        const data = await readJsonFile(child.path);
        if (data?.name) chars.push(data);
      } catch (e) {}
    }
  }
  return chars.sort((a, b) => a.name.localeCompare(b.name));
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

let modalOverlay = null;
let activeModalContent = null;

function createModal(container, title, contentHtml, onClose = null) {
  closeModal();
  modalOverlay = document.createElement("div");
  modalOverlay.className = "prowess-modal-overlay";
  const modal = document.createElement("div");
  modal.className = "prowess-modal";
  const header = document.createElement("div");
  header.className = "prowess-modal-header";
  header.innerHTML = `
    <span class="prowess-modal-title">${escapeHtml(title)}</span>
    <button class="prowess-modal-close" aria-label="Close">&times;</button>
  `;
  const body = document.createElement("div");
  body.className = "prowess-modal-body";
  body.innerHTML = contentHtml;
  modal.appendChild(header);
  modal.appendChild(body);
  modalOverlay.appendChild(modal);
  container.appendChild(modalOverlay);
  activeModalContent = body;
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) {
      closeModal();
      if (onClose) onClose();
    }
  });
  header.querySelector(".prowess-modal-close").addEventListener("click", () => {
    closeModal();
    if (onClose) onClose();
  });
  document.body.style.overflow = "hidden";
  return { overlay: modalOverlay, body, close: () => { closeModal(); if (onClose) onClose(); } };
}

function closeModal() {
  if (modalOverlay) {
    modalOverlay.remove();
    modalOverlay = null;
    activeModalContent = null;
    document.body.style.overflow = "";
  }
}

function showToast(container, message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `prowess-toast prowess-toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showLoading(container, message = "Analyzing...") {
  const loader = document.createElement("div");
  loader.className = "prowess-loader-overlay";
  loader.innerHTML = `
    <div class="prowess-loader">
      <div class="prowess-loader-spinner"></div>
      <div class="prowess-loader-text">${escapeHtml(message)}</div>
    </div>
  `;
  container.appendChild(loader);
  return loader;
}

function hideLoading(loader) {
  if (loader) loader.remove();
}

// Helper: smooth scroll to element by ID (for sticky nav)
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: MAIN PAGE — Dynamic Tab System (Auto-discovers available tabs)
// ═══════════════════════════════════════════════════════════════════════════════

// Determine which tabs should be shown based on aggregate data across all chapters
async function getAvailableTabs(chapters, allChars) {
  const settings = await loadSettings();
  const disabled = settings.disabledTabs || [];
  const customTabs = settings.customTabs || [];
  const tabs = [];

  // Chapters tab always shows (unless explicitly disabled)
  if (!disabled.includes("chapters")) {
    tabs.push(TAB_CONFIG.find(t => t.id === "chapters"));
  }
  // Characters tab shows if we have characters and isn't disabled
  if (!disabled.includes("characters") && allChars.length > 0) {
    tabs.push(TAB_CONFIG.find(t => t.id === "characters"));
  }

  // Check built-in data tabs
  const aggregate = {};
  for (const tab of TAB_CONFIG) {
    if (!tab.dataField) continue;
    aggregate[tab.id] = 0;
  }
  // Also aggregate custom tab fields
  for (const ct of customTabs) {
    aggregate[ct.id] = 0;
  }

  for (const file of chapters) {
    const chData = await readJsonFile(file.path);
    if (!chData) continue;
    for (const tab of TAB_CONFIG) {
      if (!tab.dataField) continue;
      const val = chData[tab.dataField];
      if (Array.isArray(val) && val.length > 0) aggregate[tab.id] += val.length;
    }
    for (const ct of customTabs) {
      const val = chData[ct.jsonField];
      if (Array.isArray(val) && val.length > 0) aggregate[ct.id] += val.length;
    }
  }

  // Add built-in tabs (skip chapters/characters already handled, skip disabled)
  for (const tab of TAB_CONFIG) {
    if (tab.id === "chapters" || tab.id === "characters") continue;
    if (disabled.includes(tab.id)) continue;
    if (aggregate[tab.id] > 0) tabs.push(tab);
  }

  // Add custom tabs (only if they have data and aren't disabled)
  for (const ct of customTabs) {
    if (disabled.includes(ct.id)) continue;
    if (aggregate[ct.id] > 0) {
      tabs.push({ id: ct.id, label: ct.label, icon: ct.icon || "\u2726", dataField: ct.jsonField, isCustom: true, structure: ct.structure });
    }
  }

  return tabs;
}

async function renderMainPage(container, activeTab = "chapters", invalidateCache = false) {
  const settings = await loadSettings();
  container.innerHTML = "";
  await applyBackground(container, settings);

  // Header
  const header = document.createElement("div");
  header.className = "prowess-main-header";
  header.innerHTML = `
    <div class="prowess-title-section">
      <div class="prowess-main-title">Prowess Tracker</div>
      <div class="prowess-main-subtitle">Ancient Chronicles</div>
    </div>
    <div class="prowess-header-actions">
      <button class="prowess-icon-btn prowess-settings-btn" id="prowess-settings" title="Settings" aria-label="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m4.22-10.22l4.24-4.24M6.34 6.34L2.1 2.1m17.8 17.8l-4.24-4.24M6.34 17.66l-4.24 4.24M23 12h-6m-6 0H1m20.07-4.93l-4.24 4.24M6.34 6.34l-4.24-4.24"/>
        </svg>
      </button>
      <button class="prowess-icon-btn prowess-add-btn" id="prowess-add-chapter" title="Add Chapter" aria-label="Add Chapter">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>
    </div>
  `;
  container.appendChild(header);

  // Load data once and cache it on the container element.
  // Tab switches reuse this cache — no extra file reads.
  // Pass invalidateCache = true after a chapter is saved to force a refresh.
  if (invalidateCache || !container._prowessCache) {
    const chapters = await listJsonFiles(settings.chaptersFolder || PROWESS.chaptersFolder);
    const allChars = await getAllCharacters();
    container._prowessCache = { chapters, allChars };
  }
  const { chapters, allChars } = container._prowessCache;
  const availableTabs = await getAvailableTabs(chapters, allChars);

  // Tab bar — dynamic, only shows tabs with data
  const tabBar = document.createElement("div");
  tabBar.className = "prowess-main-tab-bar";
  let tabHtml = "";
  for (const tab of availableTabs) {
    const isActive = tab.id === activeTab;
    const badge = tab.id === "chapters" ? chapters.length
      : tab.id === "characters" ? allChars.length
      : "";
    tabHtml += `
      <button class="prowess-main-tab ${isActive ? "active" : ""}" data-tab="${tab.id}">
        ${tab.label}
        ${badge ? `<span class="prowess-tab-badge">${badge}</span>` : ""}
      </button>
    `;
  }
  tabBar.innerHTML = tabHtml;
  container.appendChild(tabBar);

  // Content area
  const contentArea = document.createElement("div");
  contentArea.className = "prowess-tab-content-area";
  container.appendChild(contentArea);

  // Route to the correct tab renderer
  const tabRouter = {
    chapters:    () => renderChaptersTab(contentArea, settings, chapters, allChars),
    characters:  () => renderCharactersTab(contentArea),
    timers:      () => renderDataTab(contentArea, "timers", "timer"),
    locations:   () => renderDataTab(contentArea, "activeLocations", "location"),
    factions:    () => renderDataTab(contentArea, "factions", "faction"),
    artifacts:   () => renderArtifactTab(contentArea),
    prowess:     () => renderUpdateTab(contentArea, "prowessUpdates", "prowess", "character"),
    status:      () => renderUpdateTab(contentArea, "statusChanges", "status", "character"),
    world:       () => renderDataTab(contentArea, "worldBuilding", "world"),
  };

  // Register custom tab renderers
  for (const ct of (settings.customTabs || [])) {
    if ((settings.disabledTabs || []).includes(ct.id)) continue;
    tabRouter[ct.id] = () => renderCustomTab(contentArea, ct);
  }

  if (tabRouter[activeTab]) {
    await tabRouter[activeTab]();
  } else {
    await renderChaptersTab(contentArea, settings, chapters, allChars);
  }

  // Tab click handlers
  tabBar.querySelectorAll(".prowess-main-tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const newTab = btn.dataset.tab;

      // Update active state on buttons without rebuilding the bar
      tabBar.querySelectorAll(".prowess-main-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // Only clear and re-render the content area, not the whole page
      contentArea.innerHTML = "";
      if (tabRouter[newTab]) {
        await tabRouter[newTab]();
      } else {
        await renderChaptersTab(contentArea, settings, chapters, allChars);
      }
    });
  });

  container.querySelector("#prowess-add-chapter")?.addEventListener("click", () => {
    openChapterSubmissionModal(container);
  });
  container.querySelector("#prowess-settings")?.addEventListener("click", () => {
    openSettingsModal(container);
  });
}

async function createChapterCard(chData, filePath) {
  const card = document.createElement("div");
  card.className = "prowess-chapter-card";
  card.dataset.filePath = filePath;

  const chapterNum = chData.chapterNumber || "?";
  const title = chData.chapterTitle || `Chapter ${chapterNum}`;
  const summary = chData.coreSummary || chData.detailedSummary || "No summary available";

  const allCharNames = [
    ...(chData.newCharacters || []).map(c => c.name),
    ...(chData.protagonistInteractions || []).map(i => i.character),
  ];
  const uniqueChars = [...new Set(allCharNames)].slice(0, 5);

  const timerHtml = (chData.timers || []).slice(0, 2).map(t =>
    `<span class="prowess-timer-badge">${escapeHtml(t.description)}: ${escapeHtml(t.timeRemaining)}</span>`
  ).join("");

  const charTagsHtml = uniqueChars.length > 0
    ? uniqueChars.map(name =>
        `<span class="prowess-tag" data-type="character" data-char="${escapeHtml(name)}">${escapeHtml(name)}</span>`
      ).join("")
    : '<span class="prowess-no-chars">No characters</span>';

  // Location tags (if any) — up to 2
  const locTags = (chData.activeLocations || []).slice(0, 2).map(loc =>
    `<span class="prowess-tag" data-type="location">${escapeHtml(loc)}</span>`
  ).join("");

  card.innerHTML = `
    <div class="prowess-card-watermark">${chapterNum}</div>
    <div class="prowess-card-header">
      <div class="prowess-chapter-num">Ch. ${chapterNum}</div>
      <div class="prowess-chapter-title">${escapeHtml(title)}</div>
    </div>
    <div class="prowess-card-summary">${escapeHtml(summary)}</div>
    <div class="prowess-card-tags">
      ${charTagsHtml}
    </div>
    ${locTags ? `<div class="prowess-card-tags">${locTags}</div>` : ""}
    ${timerHtml ? `<div class="prowess-card-timers">${timerHtml}</div>` : ""}
    ${chData.splitInfo?.isSplit ? `<div class="prowess-split-badge">Part ${chData.splitInfo.partNumber}/${chData.splitInfo.totalParts}</div>` : ""}
  `;

  card.addEventListener("click", (e) => {
    if (_selectionState) return; // selection mode handles clicks itself
    if (e.target.classList.contains("prowess-tag") && e.target.dataset.char) {
      e.preventDefault();
      e.stopPropagation();
      navigateToCharacter(e.target.dataset.char);
      return;
    }
    openChapterDetailModal(chData, filePath);
  });

  // Long-press meta — allCardsRef is filled in by renderChaptersTab after all cards are built
  card._selectionMeta = {
    tabType: "chapters",
    filePath,
    chapterNumber: chData.chapterNumber,
    itemName: `Chapter ${chData.chapterNumber}`,
  };

  return card;
}

async function renderChaptersTab(contentArea, settings, chapters, allChars) {
  const stats = document.createElement("div");
  stats.className = "prowess-stats-bar";
  stats.innerHTML = `
    <div class="prowess-stat">
      <span class="prowess-stat-value">${chapters.length}</span>
      <span class="prowess-stat-label">Chapters</span>
    </div>
    <div class="prowess-stat">
      <span class="prowess-stat-value">${allChars.length}</span>
      <span class="prowess-stat-label">Characters</span>
    </div>
  `;
  contentArea.appendChild(stats);

  const grid = document.createElement("div");
  grid.className = "prowess-chapter-grid";

  if (chapters.length === 0) {
    grid.innerHTML = `
      <div class="prowess-empty-state">
        <div class="prowess-empty-icon">&#10020;</div>
        <div class="prowess-empty-text">No chapters recorded yet</div>
        <div class="prowess-empty-sub">Tap + to add your first chapter</div>
      </div>
    `;
  } else {
    for (const file of chapters) {
      const chData = await readJsonFile(file.path);
      if (!chData) continue;
      const card = await createChapterCard(chData, file.path);
      grid.appendChild(card);
    }
    // Wire long-press on all cards now that they're all in the grid
    const allCards = Array.from(grid.querySelectorAll(".prowess-chapter-card"));
    const prowessContainer = contentArea.closest(".prowess-container");
    for (const card of allCards) {
      attachSelectionBehavior(card, prowessContainer, card._selectionMeta, allCards, async () => {
        prowessContainer._prowessCache = null;
        contentArea.innerHTML = "";
        const s = await loadSettings();
        const chs = await listJsonFiles(s.chaptersFolder || PROWESS.chaptersFolder);
        const ac = await getAllCharacters();
        prowessContainer._prowessCache = { chapters: chs, allChars: ac };
        await renderChaptersTab(contentArea, s, chs, ac);
      });
    }
  }
  contentArea.appendChild(grid);
}

async function renderCharactersTab(contentArea) {
  const allChars = await getAllCharacters();
  const page = document.createElement("div");
  page.className = "prowess-chars-page";

  if (allChars.length === 0) {
    page.innerHTML = `
      <div class="prowess-empty-state">
        <div class="prowess-empty-icon">&#10020;</div>
        <div class="prowess-empty-text">No characters yet</div>
        <div class="prowess-empty-sub">Characters appear after chapters are analyzed</div>
      </div>
    `;
  } else {
    const grid = document.createElement("div");
    grid.className = "prowess-chars-grid";
    const prowessContainer = contentArea.closest(".prowess-container");
    for (const char of allChars) {
      const card = document.createElement("div");
      card.className = "prowess-char-card";
      card.innerHTML = `
        <div class="prowess-char-card-name">${escapeHtml(char.name)}</div>
        ${char.faction ? `<div class="prowess-char-card-faction">${escapeHtml(char.faction)}</div>` : ""}
        <div class="prowess-char-card-chapters">Ch. ${char.firstAppearanceChapter || "?"} \u2013 ${char.lastAppearanceChapter || "?"}</div>
      `;
      card.addEventListener("click", () => {
        if (_selectionState) return;
        navigateToCharacter(char.name);
      });
      card._selectionMeta = {
        tabType: "characters",
        charName: char.name,
        filePath: `${PROWESS.charactersFolder}/${sanitizeFilename(char.name)}.json`,
        itemName: char.name,
      };
      grid.appendChild(card);
    }
    // Wire long-press after all cards exist
    const allCards = Array.from(grid.querySelectorAll(".prowess-char-card"));
    for (const card of allCards) {
      attachSelectionBehavior(card, prowessContainer, card._selectionMeta, allCards, async () => {
        prowessContainer._prowessCache = null;
        contentArea.innerHTML = "";
        await renderCharactersTab(contentArea);
      });
    }
    page.appendChild(grid);
  }
  contentArea.appendChild(page);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: CHAPTER SUBMISSION MODAL
// ═══════════════════════════════════════════════════════════════════════════════

async function openChapterSubmissionModal(container) {
  const settings = await loadSettings();
  const config = await loadConfig();

  const providerOptions = Object.keys(config?.providers || {}).map(p =>
    `<option value="${p}" ${p === (settings.defaultApiProvider || config?.activeProvider) ? "selected" : ""}>${p}</option>`
  ).join("");

  const activeProvider = settings.defaultApiProvider || config?.activeProvider || "aistudio";
  const models = config?.providers?.[activeProvider]?.models || [];
  const activeModel = settings.defaultModel || config?.activeModel || models[0] || "";

  const modelOptions = models.map(m =>
    `<option value="${m}" ${m === activeModel ? "selected" : ""}>${m}</option>`
  ).join("");

  const disabled = settings.disabledTabs || [];
  const customTabs = settings.customTabs || [];

  const optionCheckboxes = Object.entries(EXTRACTION_OPTIONS)
    .filter(([key]) => !disabled.includes(key))
    .map(([key, opt]) => `
    <label class="prowess-option-checkbox">
      <input type="checkbox" name="extract-option" value="${key}" checked>
      <span class="prowess-checkmark"></span>
      <div class="prowess-option-info">
        <span class="prowess-option-label">${opt.label}</span>
        <span class="prowess-option-desc">${opt.desc}</span>
      </div>
    </label>
  `).join("");

  // Custom tab checkboxes appended after built-ins
  const customTabCheckboxes = customTabs
    .filter(ct => !disabled.includes(ct.id))
    .map(ct => `
    <label class="prowess-option-checkbox">
      <input type="checkbox" name="extract-option" value="${ct.jsonField}" checked>
      <span class="prowess-checkmark"></span>
      <div class="prowess-option-info">
        <span class="prowess-option-label">${ct.label}</span>
        <span class="prowess-option-desc">${ct.prompt.slice(0, 60)}${ct.prompt.length > 60 ? "…" : ""}</span>
      </div>
    </label>
  `).join("");

  const content = `
    <div class="prowess-submission-form">
      <div class="prowess-tabs">
        <button class="prowess-tab-btn active" data-tab="paste">Paste Text</button>
        <button class="prowess-tab-btn" data-tab="file">From Vault</button>
      </div>

      <div class="prowess-tab-content" id="tab-paste">
        <div class="prowess-textarea-wrapper">
          <textarea class="prowess-chapter-input" id="chapter-text" placeholder="Paste chapter text here..."></textarea>
          <div class="prowess-counter-bar">
            <span id="char-count">0 chars</span>
            <span id="token-count">~0 tokens</span>
          </div>
        </div>
      </div>

      <div class="prowess-tab-content hidden" id="tab-file">
        <div class="prowess-folder-select">
          <label>Chapters Folder:</label>
          <input type="text" id="chapters-folder-path" value="${settings.rawChaptersFolder || PROWESS.rawChaptersFolder}" placeholder="Prowess/RawChapters">
          <button class="prowess-btn secondary" id="load-folder-btn">Load Files</button>
        </div>
        <div class="prowess-file-list" id="file-list"></div>
      </div>

      <div class="prowess-options-section">
        <div class="prowess-section-header">
          <span>Extraction Options</span>
          <button class="prowess-btn small" id="select-all-options">Select All</button>
          <button class="prowess-btn small" id="deselect-all-options">None</button>
        </div>
        <div class="prowess-options-grid">
          ${optionCheckboxes}
          ${customTabCheckboxes}
        </div>
      </div>

      <div class="prowess-split-section">
        <label class="prowess-option-checkbox">
          <input type="checkbox" id="split-chapter" value="1">
          <span class="prowess-checkmark"></span>
          <div class="prowess-option-info">
            <span class="prowess-option-label">Split Long Chapter</span>
            <span class="prowess-option-desc">Divide into parts for large chapters</span>
          </div>
        </label>
        <div class="prowess-split-controls hidden" id="split-controls">
          <label>Parts: <input type="number" id="split-parts" value="2" min="2" max="3"></label>
        </div>
      </div>

      <div class="prowess-api-section">
        <div class="prowess-api-row">
          <div class="prowess-select-group">
            <label>Provider</label>
            <select id="api-provider">${providerOptions}</select>
          </div>
          <div class="prowess-select-group">
            <label>Model</label>
            <select id="api-model">${modelOptions}</select>
          </div>
        </div>
      </div>

      <div class="prowess-actions">
        <button class="prowess-btn primary prowess-submit-btn" id="submit-chapter">
          <span class="prowess-btn-icon">&#10020;</span> Analyze Chapter
        </button>
      </div>
    </div>
  `;

  const modal = createModal(container, "Add New Chapter", content);

  // Tab switching
  const tabBtns = modal.body.querySelectorAll(".prowess-tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      modal.body.querySelectorAll(".prowess-tab-content").forEach(tc => tc.classList.add("hidden"));
      modal.body.querySelector(`#tab-${btn.dataset.tab}`).classList.remove("hidden");
    });
  });

  // Character counter
  const textarea = modal.body.querySelector("#chapter-text");
  const charCountEl = modal.body.querySelector("#char-count");
  const tokenCountEl = modal.body.querySelector("#token-count");

  textarea?.addEventListener("input", () => {
    const text = textarea.value;
    charCountEl.textContent = `${countChars(text)} chars`;
    tokenCountEl.textContent = `~${countTokens(text)} tokens`;
  });

  // Provider change
  const providerSelect = modal.body.querySelector("#api-provider");
  const modelSelect = modal.body.querySelector("#api-model");

  providerSelect?.addEventListener("change", () => {
    const newProvider = providerSelect.value;
    const newModels = config?.providers?.[newProvider]?.models || [];
    modelSelect.innerHTML = newModels.map(m => `<option value="${m}">${m}</option>`).join("");
  });

  // Select all / none
  modal.body.querySelector("#select-all-options")?.addEventListener("click", () => {
    modal.body.querySelectorAll("[name='extract-option']").forEach(cb => cb.checked = true);
  });
  modal.body.querySelector("#deselect-all-options")?.addEventListener("click", () => {
    modal.body.querySelectorAll("[name='extract-option']").forEach(cb => cb.checked = false);
  });

  // Split toggle
  const splitCb = modal.body.querySelector("#split-chapter");
  const splitControls = modal.body.querySelector("#split-controls");
  splitCb?.addEventListener("change", () => {
    splitControls.classList.toggle("hidden", !splitCb.checked);
  });

  // Folder loading
  modal.body.querySelector("#load-folder-btn")?.addEventListener("click", async () => {
    const folderPath = modal.body.querySelector("#chapters-folder-path")?.value || PROWESS.rawChaptersFolder;
    await ensureFolder(folderPath);
    const files = await listRawChapterFiles(folderPath);
    const fileList = modal.body.querySelector("#file-list");
    if (files.length === 0) {
      fileList.innerHTML = `<div class="prowess-empty-files">No .txt or .md files found</div>`;
    } else {
      fileList.innerHTML = files.map(f => `
        <div class="prowess-file-item" data-path="${f.path}">
          <span class="prowess-file-name">${escapeHtml(f.name)}</span>
          <span class="prowess-file-size">${Math.round(f.stat?.size / 1024 || 0)} KB</span>
        </div>
      `).join("");

      fileList.querySelectorAll(".prowess-file-item").forEach(item => {
        item.addEventListener("click", async () => {
          fileList.querySelectorAll(".prowess-file-item").forEach(i => i.classList.remove("selected"));
          item.classList.add("selected");
          const fileContent = await app.vault.cachedRead(
            app.vault.getAbstractFileByPath(item.dataset.path)
          );
          textarea.value = fileContent;
          charCountEl.textContent = `${countChars(fileContent)} chars`;
          tokenCountEl.textContent = `~${countTokens(fileContent)} tokens`;
          tabBtns[0].click();
        });
      });
    }
  });

  // Submit handler
  modal.body.querySelector("#submit-chapter")?.addEventListener("click", async () => {
    const text = textarea?.value?.trim();
    if (!text) {
      showToast(container, "Please paste chapter text", "error");
      return;
    }
    const selectedOptions = {};
    modal.body.querySelectorAll("[name='extract-option']:checked").forEach(cb => {
      selectedOptions[cb.value] = true;
    });
    if (Object.keys(selectedOptions).length === 0) {
      showToast(container, "Select at least one extraction option", "error");
      return;
    }
    const provider = providerSelect?.value;
    const model = modelSelect?.value;
    const shouldSplit = splitCb?.checked;
    const splitCount = parseInt(modal.body.querySelector("#split-parts")?.value || "2");

    modal.close();

    if (shouldSplit && text.length > 1000) {
      await processSplitChapter(container, text, selectedOptions, provider, model, splitCount);
    } else {
      await processChapter(container, text, selectedOptions, provider, model);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: CHAPTER PROCESSING & SPLITTING
// ═══════════════════════════════════════════════════════════════════════════════

async function processChapter(container, text, options, provider, model, existingData = null, isContinuation = false) {
  const loader = showLoading(container, "Analyzing chapter with AI...");
  const config = await loadConfig();
  const settings = await loadSettings();

  try {
    const prompt = buildPrompt(text, options, false, null, settings);
    const result = await callAI(provider, model, prompt, config);

    hideLoading(loader);

    if (!result || typeof result !== "object") {
      throw new Error("Invalid response from AI");
    }

    let finalData = result;
    if (isContinuation && existingData) {
      finalData = mergeChapterData(existingData, result);
      finalData.splitInfo = {
        ...existingData.splitInfo,
        partNumber: (existingData.splitInfo?.partNumber || 1) + 1,
      };
    }

    if (!finalData.chapterNumber) {
      const chapters = await listJsonFiles(PROWESS.chaptersFolder);
      const maxNum = chapters.reduce((max, f) => {
        const match = f.name.match(/chapter_(\\d+)/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      finalData.chapterNumber = maxNum + 1;
    }

    const rawPath = `${PROWESS.rawChaptersFolder}/chapter_${String(finalData.chapterNumber).padStart(3, "0")}.txt`;
    await ensureFolder(PROWESS.rawChaptersFolder);
    await writeTextFile(rawPath, text);

    const jsonPath = `${PROWESS.chaptersFolder}/chapter_${String(finalData.chapterNumber).padStart(3, "0")}.json`;
    await ensureFolder(PROWESS.chaptersFolder);
    await writeJsonFile(jsonPath, finalData);

    await updateCharacterDatabase(finalData);

    showToast(container, `Chapter ${finalData.chapterNumber} analyzed successfully!`, "success");
    setTimeout(() => renderMainPage(container, "chapters", true), 1500);

    return finalData;
  } catch (e) {
    hideLoading(loader);
    showToast(container, `Error: ${e.message}`, "error");
    console.error(e);
    return null;
  }
}

async function processSplitChapter(container, text, options, provider, model, parts) {
  const splitSize = Math.ceil(text.length / parts);
  const segments = [];

  for (let i = 0; i < parts; i++) {
    const start = i * splitSize;
    const end = i === parts - 1 ? text.length : (i + 1) * splitSize;
    let splitPoint = end;
    if (i < parts - 1) {
      const nextNewline = text.indexOf("\n\n", end - 100);
      if (nextNewline !== -1 && nextNewline < end + 100) {
        splitPoint = nextNewline + 2;
      }
    }
    segments.push(text.substring(start, splitPoint));
  }

  let accumulatedData = null;

  for (let i = 0; i < segments.length; i++) {
    const segmentLoader = showLoading(container, `Analyzing part ${i + 1} of ${parts}...`);

    try {
      const config = await loadConfig();
      const settings = await loadSettings();
      const prompt = buildPrompt(segments[i], options, false, null, settings);
      const result = await callAI(provider, model, prompt, config);

      hideLoading(segmentLoader);

      if (i === 0) {
        result.splitInfo = {
          isSplit: true,
          partNumber: 1,
          totalParts: parts,
          continuationOf: null,
        };
        accumulatedData = result;
      } else {
        accumulatedData = mergeChapterData(accumulatedData, result);
        accumulatedData.splitInfo.partNumber = i + 1;
      }

      if (!accumulatedData.chapterNumber) {
        const chapters = await listJsonFiles(PROWESS.chaptersFolder);
        const maxNum = chapters.reduce((max, f) => {
          const match = f.name.match(/chapter_(\\d+)/);
          return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);
        accumulatedData.chapterNumber = maxNum + 1;
      }

      const jsonPath = `${PROWESS.chaptersFolder}/chapter_${String(accumulatedData.chapterNumber).padStart(3, "0")}.json`;
      await ensureFolder(PROWESS.chaptersFolder);
      await writeJsonFile(jsonPath, accumulatedData);

      const rawPath = `${PROWESS.rawChaptersFolder}/chapter_${String(accumulatedData.chapterNumber).padStart(3, "0")}_part${i + 1}.txt`;
      await ensureFolder(PROWESS.rawChaptersFolder);
      await writeTextFile(rawPath, segments[i]);

    } catch (e) {
      hideLoading(segmentLoader);
      showToast(container, `Error in part ${i + 1}: ${e.message}`, "error");
      return;
    }
  }

  accumulatedData.splitInfo.isSplit = true;
  accumulatedData.splitInfo.totalParts = parts;

  const finalPath = `${PROWESS.chaptersFolder}/chapter_${String(accumulatedData.chapterNumber).padStart(3, "0")}.json`;
  await writeJsonFile(finalPath, accumulatedData);
  await updateCharacterDatabase(accumulatedData);

  showToast(container, `Chapter ${accumulatedData.chapterNumber} (split into ${parts} parts) analyzed!`, "success");
  setTimeout(() => renderMainPage(container, "chapters", true), 1500);
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: CHAPTER DETAIL PAGE — With Sticky Nav & Two-Column Layout
// ═══════════════════════════════════════════════════════════════════════════════

async function openChapterDetailModal(chData, filePath) {
  const container = document.querySelector(".prowess-container") || document.body;
  await renderChapterDetailPage(container, chData, filePath);
}

async function renderChapterDetailPage(container, chData, filePath) {
  const settings = await loadSettings();

  const formatList = (items, emptyMsg = "None recorded") => {
    if (!items || items.length === 0) return `<div class="prowess-empty-list">${emptyMsg}</div>`;
    if (typeof items[0] === "string") {
      return `<ul class="prowess-list">${items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    }
    return `<div class="prowess-object-list">${items.map(item => `
      <div class="prowess-object-item">
        ${Object.entries(item).map(([k, v]) =>
          v ? `<div class="prowess-obj-field"><span class="prowess-obj-key">${k}:</span> <span class="prowess-obj-val">${escapeHtml(String(v))}</span></div>` : ""
        ).join("")}
      </div>
    `).join("")}</div>`;
  };

  const allCharNames = [
    ...((chData.newCharacters || []).map(c => c.name)),
    ...((chData.protagonistInteractions || []).map(i => i.character)),
  ];
  const uniqueChars = [...new Set(allCharNames)];

  // Build sticky nav items based on settings
  const stickyEnabled = settings.stickyPanelEnabled !== false;
  const stickyItems = settings.stickyPanelItems || DEFAULT_SETTINGS.stickyPanelItems;

  let stickyNavHtml = "";
  if (stickyEnabled) {
    const pills = [];
    if (stickyItems.includes("characters") && uniqueChars.length > 0) {
      for (const name of uniqueChars.slice(0, 8)) {
        pills.push(`<button class="prowess-sticky-pill" data-type="character" onclick="scrollToSection('section-characters')">${escapeHtml(name)}</button>`);
      }
    }
    if (stickyItems.includes("locations") && (chData.activeLocations || []).length > 0) {
      for (const loc of chData.activeLocations.slice(0, 4)) {
        pills.push(`<button class="prowess-sticky-pill" data-type="location" onclick="scrollToSection('section-locations')">${escapeHtml(loc)}</button>`);
      }
    }
    if (stickyItems.includes("factions") && (chData.factions || []).length > 0) {
      for (const f of chData.factions.slice(0, 4)) {
        pills.push(`<button class="prowess-sticky-pill" data-type="faction" onclick="scrollToSection('section-factions')">${escapeHtml(f)}</button>`);
      }
    }
    if (stickyItems.includes("artifacts") && (chData.artifacts || []).length > 0) {
      for (const a of chData.artifacts.slice(0, 4)) {
        pills.push(`<button class="prowess-sticky-pill" data-type="artifact" onclick="scrollToSection('section-artifacts')">${escapeHtml(a.name || a)}</button>`);
      }
    }
    if (stickyItems.includes("timers") && (chData.timers || []).length > 0) {
      for (const t of chData.timers.slice(0, 4)) {
        pills.push(`<button class="prowess-sticky-pill" data-type="timer" onclick="scrollToSection('section-timers')">${escapeHtml(t.description || "")}</button>`);
      }
    }
    if (pills.length > 0) {
      stickyNavHtml = `
        <div class="prowess-sticky-nav" id="sticky-nav">
          <span class="prowess-sticky-nav-label">Quick Nav</span>
          ${pills.join("")}
        </div>
      `;
    }
  }

  // Ensure background is always a direct child of container (position:fixed, always visible).
  // Must happen BEFORE shell wrapping so it doesn't get swept into mainView and hidden.
  const _bgSettings = await loadSettings();
  let bgLayer = container.querySelector(":scope > .prowess-bg-layer");
  if (!bgLayer) {
    await applyBackground(container, _bgSettings);
    bgLayer = container.querySelector(".prowess-bg-layer");
  }
  // If it got nested inside a shell div, rescue it back to container root
  if (bgLayer && bgLayer.parentElement !== container) {
    container.insertBefore(bgLayer, container.firstChild);
  }

  // Shell swap: hide the main view, show/reuse the detail slot.
  // This avoids wiping the container (which causes the white flash).
  let mainView = container.querySelector(".prowess-main-shell");
  let detailSlot = container.querySelector(".prowess-detail-shell");

  if (!mainView) {
    // First time visiting a detail page — wrap existing content in a shell div.
    // Skip the bg-layer so it stays at container root and is never hidden.
    mainView = document.createElement("div");
    mainView.className = "prowess-main-shell";
    const children = Array.from(container.childNodes).filter(n => !n.classList?.contains("prowess-bg-layer"));
    for (const child of children) mainView.appendChild(child);
    container.appendChild(mainView);
  }
  if (!detailSlot) {
    detailSlot = document.createElement("div");
    detailSlot.className = "prowess-detail-shell";
    container.appendChild(detailSlot);
  }

  // Swap visibility instantly — no blank moment
  mainView.style.display = "none";
  detailSlot.style.display = "block";

  // Clear only the detail slot, not the whole container
  detailSlot.innerHTML = "";

  const _detailEl = document.createElement("div");
  _detailEl.className = "prowess-detail-page";
  _detailEl.innerHTML = `
      <div class="prowess-detail-top-bar">
        <button class="prowess-btn secondary prowess-back-btn" id="back-to-main">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <div class="prowess-detail-actions" style="display:flex;gap:6px;">
          <button class="prowess-icon-btn" id="validate-chapter" title="Validate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
          </button>
          <button class="prowess-icon-btn" id="continue-chapter" title="Continuation">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button class="prowess-icon-btn" id="edit-chapter" title="Edit Raw">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="prowess-detail-hero">
        <div class="prowess-detail-chapter-num">Chapter ${chData.chapterNumber || "?"}</div>
        <div class="prowess-detail-chapter-title-large">${escapeHtml(chData.chapterTitle || "")}</div>
        ${chData.timeline ? `<div class="prowess-detail-timeline">&#9716; ${escapeHtml(chData.timeline)}</div>` : ""}
      </div>

      ${stickyNavHtml}

      <div class="prowess-detail-body">
        <div class="prowess-detail-section-full" id="section-summary">
          <div class="prowess-section-title">Summary</div>
          <div class="prowess-detail-text">${escapeHtml(chData.coreSummary || "No summary available")}</div>
        </div>

        ${uniqueChars.length > 0 ? `
          <div class="prowess-detail-section-full" id="section-characters">
            <div class="prowess-section-title">Characters</div>
            <div class="prowess-card-tags">
              ${uniqueChars.map(name =>
                `<span class="prowess-tag" data-type="character" data-char="${escapeHtml(name)}">${escapeHtml(name)}</span>`
              ).join("")}
            </div>
          </div>
        ` : ""}

        ${chData.detailedSummary ? `
          <div class="prowess-detail-section-full" id="section-detailed">
            <div class="prowess-section-title">Detailed Summary</div>
            <div class="prowess-detail-text">${escapeHtml(chData.detailedSummary)}</div>
          </div>
        ` : ""}

        <div class="prowess-detail-two-col">
          <div class="prowess-detail-section-inner" id="section-incidents">
            <div class="prowess-section-title">Key Incidents</div>
            ${formatList(chData.keyIncidents)}
          </div>
          <div class="prowess-detail-section-inner" id="section-threads">
            <div class="prowess-section-title">Open Threads</div>
            ${formatList(chData.openThreads)}
          </div>
        </div>

        <div class="prowess-detail-two-col">
          <div class="prowess-detail-section-inner" id="section-prowess">
            <div class="prowess-section-title">Prowess Updates</div>
            ${formatList(chData.prowessUpdates)}
          </div>
          <div class="prowess-detail-section-inner" id="section-status">
            <div class="prowess-section-title">Status Changes</div>
            ${formatList(chData.statusChanges)}
          </div>
        </div>

        <div class="prowess-detail-two-col">
          <div class="prowess-detail-section-inner" id="section-locations">
            <div class="prowess-section-title">Active Locations</div>
            ${formatList(chData.activeLocations)}
          </div>
          <div class="prowess-detail-section-inner" id="section-factions">
            <div class="prowess-section-title">Factions</div>
            ${formatList(chData.factions)}
          </div>
        </div>

        <div class="prowess-detail-section-full" id="section-world">
          <div class="prowess-section-title">World-Building</div>
          ${formatList(chData.worldBuilding)}
        </div>

        <div class="prowess-detail-two-col">
          <div class="prowess-detail-section-inner" id="section-artifacts">
            <div class="prowess-section-title">Artifacts</div>
            ${formatList(chData.artifacts)}
          </div>
          <div class="prowess-detail-section-inner" id="section-resources">
            <div class="prowess-section-title">Resources</div>
            ${formatList(chData.resources)}
          </div>
        </div>

        ${(chData.timers || []).length > 0 ? `
          <div class="prowess-detail-section-full" id="section-timers">
            <div class="prowess-section-title">Novel Timers</div>
            <div class="prowess-timers-list">
              ${chData.timers.map(t => `
                <div class="prowess-timer-item">
                  <span class="prowess-timer-clock">&#9201;</span>
                  <div class="prowess-timer-info">
                    <div class="prowess-timer-desc">${escapeHtml(t.description)}</div>
                    <div class="prowess-timer-time">${escapeHtml(t.timeRemaining)}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
  `;
  detailSlot.appendChild(_detailEl);

  detailSlot.querySelector("#back-to-main")?.addEventListener("click", () => {
    // Shell swap back: show main view, hide detail slot — instant, no rebuild
    detailSlot.style.display = "none";
    mainView.style.display = "";
  });
  detailSlot.querySelectorAll(".prowess-tag[data-char]").forEach(tag => {
    tag.addEventListener("click", () => navigateToCharacter(tag.dataset.char));
  });
  detailSlot.querySelector("#validate-chapter")?.addEventListener("click", () => {
    openValidationModal(container, chData, filePath);
  });
  detailSlot.querySelector("#continue-chapter")?.addEventListener("click", () => {
    openContinuationModal(container, chData, filePath);
  });
  detailSlot.querySelector("#edit-chapter")?.addEventListener("click", () => {
    const rawPath = `${PROWESS.rawChaptersFolder}/chapter_${String(chData.chapterNumber).padStart(3, "0")}.txt`;
    const rawFile = app.vault.getAbstractFileByPath(rawPath);
    if (rawFile) app.workspace.getLeaf().openFile(rawFile);
    else showToast(container, "Raw file not found", "error");
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: VALIDATION & DIFF COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

async function openValidationModal(container, chData, filePath) {
  const config = await loadConfig();
  const settings = await loadSettings();

  const rawPath = `${PROWESS.rawChaptersFolder}/chapter_${String(chData.chapterNumber).padStart(3, "0")}.txt`;
  const rawFile = app.vault.getAbstractFileByPath(rawPath);
  let chapterText = "";
  if (rawFile) {
    chapterText = await app.vault.cachedRead(rawFile);
  }

  const existingOptions = {};
  Object.keys(EXTRACTION_OPTIONS).forEach(key => {
    if (chData[key] !== undefined && chData[key] !== null && chData[key] !== "" &&
        (!Array.isArray(chData[key]) || chData[key].length > 0)) {
      existingOptions[key] = true;
    }
  });

  const optionCheckboxes = Object.entries(EXTRACTION_OPTIONS).map(([key, opt]) => `
    <label class="prowess-option-checkbox">
      <input type="checkbox" name="validate-option" value="${key}" ${existingOptions[key] ? "checked" : ""}>
      <span class="prowess-checkmark"></span>
      <div class="prowess-option-info">
        <span class="prowess-option-label">${opt.label}</span>
      </div>
    </label>
  `).join("");

  const provider = settings.defaultApiProvider || config?.activeProvider || "aistudio";
  const models = config?.providers?.[provider]?.models || [];
  const model = settings.defaultModel || config?.activeModel || models[0] || "";

  const providerOptions = Object.keys(config?.providers || {}).map(p =>
    `<option value="${p}" ${p === provider ? "selected" : ""}>${p}</option>`
  ).join("");

  const modelOptions = models.map(m =>
    `<option value="${m}" ${m === model ? "selected" : ""}>${m}</option>`
  ).join("");

  const content = `
    <div class="prowess-validation-form">
      <div class="prowess-validation-info">
        <p>Select which sections to validate. The AI will check for missing or incorrect information.</p>
      </div>
      <div class="prowess-options-grid">
        ${optionCheckboxes}
      </div>
      <div class="prowess-api-row">
        <div class="prowess-select-group">
          <label>Provider</label>
          <select id="validate-provider">${providerOptions}</select>
        </div>
        <div class="prowess-select-group">
          <label>Model</label>
          <select id="validate-model">${modelOptions}</select>
        </div>
      </div>
      <div class="prowess-actions">
        <button class="prowess-btn primary" id="run-validation">Run Validation</button>
      </div>
    </div>
  `;

  const modal = createModal(container, "Validate Chapter Analysis", content);

  const providerSelect = modal.body.querySelector("#validate-provider");
  const modelSelect = modal.body.querySelector("#validate-model");
  providerSelect?.addEventListener("change", () => {
    const newModels = config?.providers?.[providerSelect.value]?.models || [];
    modelSelect.innerHTML = newModels.map(m => `<option value="${m}">${m}</option>`).join("");
  });

  modal.body.querySelector("#run-validation")?.addEventListener("click", async () => {
    const selectedOptions = {};
    modal.body.querySelectorAll("[name='validate-option']:checked").forEach(cb => {
      selectedOptions[cb.value] = true;
    });
    if (Object.keys(selectedOptions).length === 0) {
      showToast(container, "Select at least one option", "error");
      return;
    }
    const valProvider = providerSelect?.value;
    const valModel = modelSelect?.value;
    modal.close();
    await runValidationAndShowDiff(container, chData, filePath, chapterText, selectedOptions, valProvider, valModel);
  });
}

async function runValidationAndShowDiff(container, existingData, filePath, chapterText, options, provider, model) {
  const loader = showLoading(container, "Running AI validation...");
  const config = await loadConfig();
  const settings = await loadSettings();

  try {
    const prompt = buildPrompt(chapterText, options, true, existingData, settings);
    const newData = await callAI(provider, model, prompt, config);
    hideLoading(loader);
    if (!newData) throw new Error("Empty validation response");
    openDiffModal(container, existingData, newData, options, filePath);
  } catch (e) {
    hideLoading(loader);
    showToast(container, `Validation error: ${e.message}`, "error");
  }
}

function openDiffModal(container, oldData, newData, options, filePath) {
  const changes = [];

  Object.keys(options).forEach(key => {
    const oldVal = oldData[key];
    const newVal = newData[key];
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) return;
    const label = EXTRACTION_OPTIONS[key]?.label || key;

    if (Array.isArray(oldVal) && Array.isArray(newVal)) {
      const oldStrs = oldVal.map(i => JSON.stringify(i));
      const added = newVal.filter(i => !oldStrs.includes(JSON.stringify(i)));
      const removed = oldVal.filter(i => !newVal.map(n => JSON.stringify(n)).includes(JSON.stringify(i)));
      if (added.length > 0 || removed.length > 0) {
        changes.push({ key, label, type: "array", added, removed, oldVal, newVal });
      }
    } else if (typeof oldVal === "string" && typeof newVal === "string") {
      if (oldVal !== newVal) {
        changes.push({ key, label, type: "string", oldVal, newVal });
      }
    } else {
      changes.push({ key, label, type: "other", oldVal, newVal });
    }
  });

  if (changes.length === 0) {
    showToast(container, "No changes found - existing data is complete!", "success");
    return;
  }

  const content = `
    <div class="prowess-diff-container">
      <div class="prowess-diff-header">
        <button class="prowess-btn small" id="diff-select-all">Select All New</button>
        <button class="prowess-btn small" id="diff-deselect-all">Deselect All</button>
        <span class="prowess-diff-count">${changes.length} sections changed</span>
      </div>
      <div class="prowess-diff-columns">
        <div class="prowess-diff-col">
          <div class="prowess-diff-col-header">Current Data</div>
        </div>
        <div class="prowess-diff-col">
          <div class="prowess-diff-col-header">AI Suggested</div>
        </div>
      </div>
      <div class="prowess-diff-list">
        ${changes.map((change, idx) => {
          if (change.type === "array") {
            return `
              <div class="prowess-diff-item" data-key="${change.key}">
                <div class="prowess-diff-section-title">${escapeHtml(change.label)}</div>
                <div class="prowess-diff-columns">
                  <div class="prowess-diff-col">
                    <div class="prowess-diff-content">
                      ${change.oldVal?.length > 0
                        ? change.oldVal.map(item => `
                            <div class="prowess-diff-old-item">${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</div>
                          `).join("")
                        : "<div class='prowess-diff-empty'>Empty</div>"
                      }
                    </div>
                  </div>
                  <div class="prowess-diff-col">
                    <div class="prowess-diff-content">
                      ${change.added.length > 0
                        ? change.added.map((item, aidx) => `
                            <label class="prowess-diff-new-item">
                              <input type="checkbox" class="diff-check" data-action="add" data-index="${aidx}" checked>
                              <span class="prowess-diff-add-badge">+</span>
                              <span>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</span>
                            </label>
                          `).join("")
                        : "<div class='prowess-diff-empty'>No additions</div>"
                      }
                      ${change.removed.length > 0
                        ? change.removed.map((item, ridx) => `
                            <label class="prowess-diff-removed-item">
                              <input type="checkbox" class="diff-check" data-action="remove" data-index="${ridx}">
                              <span class="prowess-diff-rem-badge">-</span>
                              <span>${escapeHtml(typeof item === "string" ? item : JSON.stringify(item))}</span>
                            </label>
                          `).join("")
                        : ""
                      }
                    </div>
                  </div>
                </div>
              </div>
            `;
          } else if (change.type === "string") {
            return `
              <div class="prowess-diff-item" data-key="${change.key}">
                <div class="prowess-diff-section-title">${escapeHtml(change.label)}</div>
                <div class="prowess-diff-columns">
                  <div class="prowess-diff-col">
                    <div class="prowess-diff-content prowess-diff-old-text">${escapeHtml(change.oldVal || "(empty)")}</div>
                  </div>
                  <div class="prowess-diff-col">
                    <label class="prowess-diff-new-text">
                      <input type="checkbox" class="diff-check-string" data-action="replace" checked>
                      <span>${escapeHtml(change.newVal || "(empty)")}</span>
                    </label>
                  </div>
                </div>
              </div>
            `;
          } else {
            return `
              <div class="prowess-diff-item" data-key="${change.key}">
                <div class="prowess-diff-section-title">${escapeHtml(change.label)}</div>
                <div class="prowess-diff-columns">
                  <div class="prowess-diff-col">
                    <div class="prowess-diff-content">${escapeHtml(JSON.stringify(change.oldVal))}</div>
                  </div>
                  <div class="prowess-diff-col">
                    <label class="prowess-diff-content">
                      <input type="checkbox" class="diff-check-other" data-action="replace" checked>
                      <span>${escapeHtml(JSON.stringify(change.newVal))}</span>
                    </label>
                  </div>
                </div>
              </div>
            `;
          }
        }).join("")}
      </div>
      <div class="prowess-diff-actions">
        <button class="prowess-btn primary prowess-save-btn" id="save-diff">Save Selected Changes</button>
        <button class="prowess-btn secondary" id="cancel-diff">Cancel</button>
      </div>
    </div>
  `;

  const modal = createModal(container, "Review Changes", content);

  modal.body.querySelector("#diff-select-all")?.addEventListener("click", () => {
    modal.body.querySelectorAll(".diff-check, .diff-check-string, .diff-check-other").forEach(cb => cb.checked = true);
  });
  modal.body.querySelector("#diff-deselect-all")?.addEventListener("click", () => {
    modal.body.querySelectorAll(".diff-check, .diff-check-string, .diff-check-other").forEach(cb => cb.checked = false);
  });

  modal.body.querySelector("#save-diff")?.addEventListener("click", async () => {
    const merged = deepClone(oldData);
    changes.forEach(change => {
      const itemEl = modal.body.querySelector(`[data-key="${change.key}"]`);
      if (!itemEl) return;
      if (change.type === "array") {
        const checkedAdds = Array.from(itemEl.querySelectorAll("[data-action='add']:checked")).map(cb => {
          const idx = parseInt(cb.dataset.index);
          return change.added[idx];
        });
        const checkedRemoves = Array.from(itemEl.querySelectorAll("[data-action='remove']:checked")).map(cb => {
          const idx = parseInt(cb.dataset.index);
          return change.removed[idx];
        });
        let mergedArray = [...(change.oldVal || [])];
        if (checkedRemoves.length > 0) {
          const removeStrs = checkedRemoves.map(i => JSON.stringify(i));
          mergedArray = mergedArray.filter(i => !removeStrs.includes(JSON.stringify(i)));
        }
        for (const item of checkedAdds) {
          if (!mergedArray.some(i => JSON.stringify(i) === JSON.stringify(item))) {
            mergedArray.push(item);
          }
        }
        merged[change.key] = mergedArray;
      } else if (change.type === "string") {
        const useNew = itemEl.querySelector(".diff-check-string")?.checked;
        if (useNew) {
          merged[change.key] = change.newVal;
        }
      } else {
        const useNew = itemEl.querySelector(".diff-check-other")?.checked;
        if (useNew) {
          merged[change.key] = change.newVal;
        }
      }
    });
    await writeJsonFile(filePath, merged);
    await updateCharacterDatabase(merged);
    modal.close();
    showToast(container, "Changes saved successfully!", "success");
    setTimeout(() => renderMainPage(container, "chapters", true), 1000);
  });

  modal.body.querySelector("#cancel-diff")?.addEventListener("click", () => {
    modal.close();
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: CONTINUATION MODAL (FOR SPLIT CHAPTERS)
// ═══════════════════════════════════════════════════════════════════════════════

async function openContinuationModal(container, chData, filePath) {
  const config = await loadConfig();
  const settings = await loadSettings();

  const content = `
    <div class="prowess-continuation-form">
      <div class="prowess-textarea-wrapper">
        <textarea class="prowess-chapter-input" id="continuation-text" placeholder="Paste the continuation of the chapter here..."></textarea>
        <div class="prowess-counter-bar">
          <span id="cont-char-count">0 chars</span>
          <span id="cont-token-count">~0 tokens</span>
        </div>
      </div>
      <div class="prowess-actions">
        <button class="prowess-btn primary" id="submit-continuation">Analyze & Merge</button>
      </div>
    </div>
  `;

  const modal = createModal(container, `Continue Chapter ${chData.chapterNumber}`, content);

  const textarea = modal.body.querySelector("#continuation-text");
  const charCountEl = modal.body.querySelector("#cont-char-count");
  const tokenCountEl = modal.body.querySelector("#cont-token-count");

  textarea?.addEventListener("input", () => {
    charCountEl.textContent = `${countChars(textarea.value)} chars`;
    tokenCountEl.textContent = `~${countTokens(textarea.value)} tokens`;
  });

  modal.body.querySelector("#submit-continuation")?.addEventListener("click", async () => {
    const text = textarea?.value?.trim();
    if (!text) {
      showToast(container, "Please paste continuation text", "error");
      return;
    }
    modal.close();
    const allOptions = {};
    Object.keys(EXTRACTION_OPTIONS).forEach(k => allOptions[k] = true);
    const provider = settings.defaultApiProvider || config?.activeProvider || "aistudio";
    const models = config?.providers?.[provider]?.models || [];
    const model = settings.defaultModel || models[0] || "";
    await processChapter(container, text, allOptions, provider, model, chData, true);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: CHARACTER PAGE — No heading elements, class-based titles
// ═══════════════════════════════════════════════════════════════════════════════

async function navigateToCharacter(charName) {
  const container = document.querySelector(".prowess-container") || document.body;
  await renderCharacterPage(container, charName);
}

async function renderCharacterPage(container, charName) {
  const charFilePath = `${PROWESS.charactersFolder}/${sanitizeFilename(charName)}.json`;
  const charData = await readJsonFile(charFilePath);

  if (!charData) {
    showToast(container, `Character "${charName}" not found`, "error");
    return;
  }

  const backButton = `
    <button class="prowess-btn secondary prowess-back-btn" id="back-to-main">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Back to Chapters
    </button>
  `;

  const content = `
    <div class="prowess-character-page">
      ${backButton}
      <div class="prowess-character-header">
        <div class="prowess-character-name">${escapeHtml(charData.name)}</div>
        ${charData.faction ? `<div class="prowess-character-faction">${escapeHtml(charData.faction)}</div>` : ""}
      </div>

      <div class="prowess-character-meta">
        <div class="prowess-meta-item">
          <span class="prowess-meta-label">First Appearance</span>
          <span class="prowess-meta-value">Chapter ${charData.firstAppearanceChapter || "?"}</span>
        </div>
        <div class="prowess-meta-item">
          <span class="prowess-meta-label">Last Appearance</span>
          <span class="prowess-meta-value">Chapter ${charData.lastAppearanceChapter || "?"}</span>
        </div>
      </div>

      ${charData.description ? `
        <div class="prowess-character-section">
          <div class="prowess-section-title">Description</div>
          <p>${escapeHtml(charData.description)}</p>
        </div>
      ` : ""}

      ${(charData.meetingLocations || []).length > 0 ? `
        <div class="prowess-character-section">
          <div class="prowess-section-title">Meeting Locations</div>
          <div class="prowess-location-list">
            ${charData.meetingLocations.map(ml => `
              <div class="prowess-location-item">
                <span class="prowess-location-name">${escapeHtml(ml.location || ml)}</span>
                <span class="prowess-location-chapter">Ch. ${ml.chapter || "?"}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${(charData.interactions || []).length > 0 ? `
        <div class="prowess-character-section">
          <div class="prowess-section-title">Interactions with Protagonist</div>
          <div class="prowess-interaction-list">
            ${charData.interactions.map(inter => `
              <div class="prowess-interaction-item">
                <div class="prowess-interaction-chapter">Chapter ${inter.chapter}</div>
                <div class="prowess-interaction-loc">${escapeHtml(inter.location || "")}</div>
                <div class="prowess-interaction-nature">${escapeHtml(inter.nature || "")}</div>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${(charData.prowessUpdates || []).length > 0 ? `
        <div class="prowess-character-section">
          <div class="prowess-section-title">Prowess Updates</div>
          <div class="prowess-prowess-list">
            ${charData.prowessUpdates.map(pu => `
              <div class="prowess-prowess-item">
                <div class="prowess-prowess-chapter">Ch. ${pu.chapter}</div>
                <div class="prowess-prowess-change">${escapeHtml(pu.change)}</div>
                ${pu.rank ? `<div class="prowess-prowess-rank">${escapeHtml(pu.rank)}</div>` : ""}
                ${pu.description ? `<div class="prowess-prowess-desc">${escapeHtml(pu.description)}</div>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      ${(charData.statusChanges || []).length > 0 ? `
        <div class="prowess-character-section">
          <div class="prowess-section-title">Status Changes</div>
          <div class="prowess-status-list">
            ${charData.statusChanges.map(sc => `
              <div class="prowess-status-item">
                <div class="prowess-status-chapter">Ch. ${sc.chapter}</div>
                <div class="prowess-status-change">${escapeHtml(sc.change)}</div>
                ${sc.description ? `<div class="prowess-status-desc">${escapeHtml(sc.description)}</div>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}
    </div>
  `;

  // Ensure background stays at container root, never swept into mainView
  const _bgSettings = await loadSettings();
  let bgLayer = container.querySelector(":scope > .prowess-bg-layer");
  if (!bgLayer) {
    await applyBackground(container, _bgSettings);
    bgLayer = container.querySelector(".prowess-bg-layer");
  }
  if (bgLayer && bgLayer.parentElement !== container) {
    container.insertBefore(bgLayer, container.firstChild);
  }

  // Shell swap: same pattern as chapter detail — no container wipe
  let mainView = container.querySelector(".prowess-main-shell");
  let detailSlot = container.querySelector(".prowess-detail-shell");

  if (!mainView) {
    mainView = document.createElement("div");
    mainView.className = "prowess-main-shell";
    const children = Array.from(container.childNodes).filter(n => !n.classList?.contains("prowess-bg-layer"));
    for (const child of children) mainView.appendChild(child);
    container.appendChild(mainView);
  }
  if (!detailSlot) {
    detailSlot = document.createElement("div");
    detailSlot.className = "prowess-detail-shell";
    container.appendChild(detailSlot);
  }

  if (!container.querySelector(".prowess-bg-layer")) {
    await applyBackground(container, _bgSettings);
  }

  mainView.style.display = "none";
  detailSlot.style.display = "block";
  detailSlot.innerHTML = content;

  detailSlot.querySelector("#back-to-main")?.addEventListener("click", () => {
    // Shell swap back: show main view, hide detail slot — instant, no rebuild
    detailSlot.style.display = "none";
    mainView.style.display = "";
  });

  // ── Wire selection mode on prowess + status items ─────────────────────────
  // The page renders these as innerHTML, so we rebuild them as proper DOM
  // elements after render so attachSelectionBehavior can hook into them.
  const prowessContainer = container;

  function rebuildSelectableList(sectionClass, items, dataField, tabType) {
    const section = detailSlot.querySelector(`.${sectionClass}`);
    if (!section || !items || items.length === 0) return;
    section.innerHTML = ""; // clear the innerHTML-rendered version

    const els = [];
    for (const item of items) {
      const el = document.createElement("div");
      el.className = sectionClass === "prowess-prowess-list"
        ? "prowess-prowess-item"
        : "prowess-status-item";
      el.style.position = "relative"; // needed for checkmark ::after
      el.innerHTML = `
        <div class="${sectionClass === "prowess-prowess-list" ? "prowess-prowess-chapter" : "prowess-status-chapter"}">Ch. ${item.chapter}</div>
        <div class="${sectionClass === "prowess-prowess-list" ? "prowess-prowess-change" : "prowess-status-change"}">${escapeHtml(item.change || "")}</div>
        ${item.rank ? `<div class="prowess-prowess-rank">${escapeHtml(item.rank)}</div>` : ""}
        ${item.description ? `<div class="${sectionClass === "prowess-prowess-list" ? "prowess-prowess-desc" : "prowess-status-desc"}">${escapeHtml(item.description)}</div>` : ""}
      `;
      el._selectionMeta = {
        tabType,
        dataField,
        changeText: item.change || "",
        itemName: item.change || item.description || "entry",
        chapterNumber: item.chapter,
      };
      section.appendChild(el);
      els.push(el);
    }

    for (const el of els) {
      attachSelectionBehavior(el, prowessContainer, el._selectionMeta, els, () => {
        // After delete, go back to main and re-render character detail
        renderMainPage(prowessContainer, "prowess", true);
      });
    }
  }

  rebuildSelectableList(
    "prowess-prowess-list",
    charData.prowessUpdates || [],
    "prowessUpdates",
    "prowess"
  );
  rebuildSelectableList(
    "prowess-status-list",
    charData.statusChanges || [],
    "statusChanges",
    "status"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14: SETTINGS MODAL — Now includes sticky panel settings
// ═══════════════════════════════════════════════════════════════════════════════

async function openSettingsModal(container) {
  const settings = await loadSettings();
  const disabled = settings.disabledTabs || [];
  const customTabs = settings.customTabs || [];

  // Built-in tabs that can be disabled (id → display label)
  const BUILT_IN_TABS = [
    { id: "characters",  label: "Characters" },
    { id: "timers",      label: "Timers" },
    { id: "locations",   label: "Locations" },
    { id: "factions",    label: "Factions" },
    { id: "artifacts",   label: "Artifacts" },
    { id: "prowess",     label: "Prowess" },
    { id: "status",      label: "Status" },
    { id: "world",       label: "World" },
  ];

  // Structure examples shown in the custom tab builder
  const STRUCTURES = [
    {
      id: "simple-list",
      label: "Simple List",
      example: "\"Vast Cavern\", \"Dungeon Shaft\"",
      desc: "Just names — like Locations or Factions"
    },
    {
      id: "name-desc",
      label: "Name + Description",
      example: "{ name: \"Tunnel\", description: \"Narrow passage...\" }",
      desc: "Name and a short description — like World-Building"
    },
    {
      id: "name-desc-meta",
      label: "Name + Description + Extra",
      example: "{ name: \"Trial\", description: \"...\", meta: \"2 days\" }",
      desc: "Three fields — like Timers"
    },
    {
      id: "artifact-style",
      label: "Item Card",
      example: "{ name: \"Sword\", action: \"found\", description: \"...\", location: \"...\" }",
      desc: "Named item with action and location — like Artifacts"
    },
    {
      id: "character-update",
      label: "Character Update",
      example: "{ character: \"Marc\", change: \"Learned skill\", description: \"...\" }",
      desc: "Tied to a character — like Prowess/Status"
    },
  ];

  const builtInToggles = BUILT_IN_TABS.map(t => `
    <div class="prowess-tab-toggle-row">
      <span class="prowess-tab-toggle-label">${t.label}</span>
      <label class="prowess-toggle">
        <input type="checkbox" class="prowess-tab-enable-cb" data-tab-id="${t.id}"
          ${disabled.includes(t.id) ? "" : "checked"}>
        <span class="prowess-toggle-slider"></span>
      </label>
    </div>
  `).join("");

  const customTabRows = customTabs.map((ct, i) => `
    <div class="prowess-custom-tab-row" data-idx="${i}">
      <span class="prowess-custom-tab-name">${escapeHtml(ct.label)}</span>
      <span class="prowess-custom-tab-field">${escapeHtml(ct.jsonField)}</span>
      <div class="prowess-custom-tab-actions">
        <label class="prowess-toggle" title="${disabled.includes(ct.id) ? "Disabled" : "Enabled"}">
          <input type="checkbox" class="prowess-custom-tab-enable-cb" data-tab-id="${ct.id}"
            ${disabled.includes(ct.id) ? "" : "checked"}>
          <span class="prowess-toggle-slider"></span>
        </label>
        <button class="prowess-btn small danger prowess-remove-custom-tab" data-idx="${i}">Remove</button>
      </div>
    </div>
  `).join("");

  const content = `
    <div class="prowess-settings-form">

      <!-- Background Settings -->
      <div class="prowess-settings-section">
        <div class="prowess-settings-section-title">Background</div>
        <div class="prowess-setting-group">
          <label>Background Image</label>
          <div class="prowess-image-picker">
            <input type="file" id="bg-image-file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" style="display:none">
            <button class="prowess-btn secondary" id="bg-image-pick-btn">Choose Image</button>
            <span class="prowess-image-filename" id="bg-image-name">No image selected</span>
            <button class="prowess-btn small danger" id="bg-image-clear-btn">Clear</button>
          </div>
          <canvas id="bg-image-preview" style="display:none;max-width:100%;height:60px;object-fit:cover;border-radius:6px;margin-top:6px;"></canvas>
        </div>
        <div class="prowess-setting-group">
          <label>Blur Amount (${settings.blurAmount}px)</label>
          <input type="range" id="bg-blur" min="0" max="20" value="${settings.blurAmount}">
        </div>
        <div class="prowess-setting-group">
          <label>Overlay Opacity (${Math.round((settings.overlayOpacity || 0.75) * 100)}%)</label>
          <input type="range" id="bg-opacity" min="0" max="100" value="${Math.round((settings.overlayOpacity || 0.75) * 100)}">
        </div>
        <div class="prowess-setting-group">
          <label>Accent Color</label>
          <input type="color" id="accent-color" value="${settings.accentColor || "#d4a853"}">
        </div>
      </div>

      <!-- Quick Navigation Panel -->
      <div class="prowess-settings-section">
        <div class="prowess-settings-section-title">Quick Navigation Panel</div>
        <div class="prowess-setting-toggle">
          <div>
            <div class="prowess-toggle-label">Enable Sticky Panel</div>
            <div class="prowess-toggle-sublabel">Show quick-nav strip on detail pages</div>
          </div>
          <label class="prowess-toggle">
            <input type="checkbox" id="sticky-panel-enabled" ${settings.stickyPanelEnabled !== false ? "checked" : ""}>
            <span class="prowess-toggle-slider"></span>
          </label>
        </div>
        <div class="prowess-setting-group" style="margin-top:8px;">
          <label>Show in Panel</label>
          <div class="prowess-checkbox-list">
            ${["characters","locations","factions","artifacts","timers"].map(id => `
              <label class="prowess-checkbox-row">
                <input type="checkbox" id="sp-item-${id}" ${(settings.stickyPanelItems || []).includes(id) ? "checked" : ""}>
                <span class="prowess-checkbox-row-label">${id.charAt(0).toUpperCase() + id.slice(1)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      </div>

      <!-- Tab Management -->
      <div class="prowess-settings-section">
        <div class="prowess-settings-section-title">Tabs</div>
        <div class="prowess-setting-group">
          <label style="margin-bottom:10px;">Built-in Tabs — toggle to disable/enable</label>
          <div class="prowess-tab-toggles" id="built-in-tab-toggles">
            ${builtInToggles}
          </div>
        </div>
        <div class="prowess-setting-group" style="margin-top:16px;">
          <label style="margin-bottom:10px;">Custom Tabs</label>
          <div id="custom-tab-list">
            ${customTabRows || "<div class='prowess-empty-sub'>No custom tabs yet</div>"}
          </div>
          <button class="prowess-btn secondary" id="add-custom-tab-btn" style="margin-top:12px;">
            + Add Custom Tab
          </button>
        </div>
      </div>

      <!-- Folders -->
      <div class="prowess-settings-section">
        <div class="prowess-settings-section-title">Folders</div>
        <div class="prowess-setting-group">
          <label>Chapters JSON Folder</label>
          <input type="text" id="setting-chapters-folder" value="${escapeHtml(settings.chaptersFolder || PROWESS.chaptersFolder)}">
        </div>
        <div class="prowess-setting-group">
          <label>Raw Chapters Folder</label>
          <input type="text" id="setting-raw-folder" value="${escapeHtml(settings.rawChaptersFolder || PROWESS.rawChaptersFolder)}">
        </div>
        <div class="prowess-setting-group">
          <label>Characters Folder</label>
          <input type="text" id="setting-chars-folder" value="${escapeHtml(settings.charactersFolder || PROWESS.charactersFolder)}">
        </div>
      </div>

      <div class="prowess-actions">
        <button class="prowess-btn primary" id="save-settings">Save Settings</button>
      </div>
    </div>
  `;

  const modal = createModal(container, "Settings", content);

  // ── Range value live updates ──────────────────────────────────────────────
  const blurInput = modal.body.querySelector("#bg-blur");
  const opacityInput = modal.body.querySelector("#bg-opacity");
  blurInput?.addEventListener("input", (e) => {
    e.target.previousElementSibling.textContent = `Blur Amount (${e.target.value}px)`;
  });
  opacityInput?.addEventListener("input", (e) => {
    e.target.previousElementSibling.textContent = `Overlay Opacity (${e.target.value}%)`;
  });

  // ── Image picker ──────────────────────────────────────────────────────────
  const pickBtn = modal.body.querySelector("#bg-image-pick-btn");
  const fileInput = modal.body.querySelector("#bg-image-file");
  const fileNameEl = modal.body.querySelector("#bg-image-name");
  const clearBtn = modal.body.querySelector("#bg-image-clear-btn");
  const previewCanvas = modal.body.querySelector("#bg-image-preview");
  let pendingImageCache = null;

  const existingCache = await loadImageCache();
  if (existingCache?.fileName) {
    fileNameEl.textContent = existingCache.fileName;
    previewCanvas.style.display = "block";
    const img = new Image();
    img.onload = () => {
      const ctx = previewCanvas.getContext("2d");
      previewCanvas.width = previewCanvas.offsetWidth || 300;
      previewCanvas.height = 60;
      ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
    };
    img.src = `data:${existingCache.mimeType};base64,${existingCache.base64Data}`;
  }

  pickBtn?.addEventListener("click", () => fileInput?.click());
  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target.result;
      const [header, base64Data] = result.split(",");
      const mimeType = header.match(/data:([^;]+)/)?.[1] || "image/png";
      pendingImageCache = { base64Data, fileName: file.name, mimeType };
      fileNameEl.textContent = file.name;
      previewCanvas.style.display = "block";
      const img = new Image();
      img.onload = () => {
        const ctx = previewCanvas.getContext("2d");
        previewCanvas.width = previewCanvas.offsetWidth || 300;
        previewCanvas.height = 60;
        ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
  clearBtn?.addEventListener("click", async () => {
    pendingImageCache = null;
    fileNameEl.textContent = "No image selected";
    previewCanvas.style.display = "none";
    const ctx = previewCanvas.getContext("2d");
    ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    const cacheFile = app.vault.getAbstractFileByPath(PROWESS.imageCachePath);
    if (cacheFile) await app.vault.delete(cacheFile);
  });

  // ── Custom tab management ─────────────────────────────────────────────────
  // Live list of pending custom tabs (copy so we don't mutate settings until Save)
  let pendingCustomTabs = JSON.parse(JSON.stringify(customTabs));

  function refreshCustomTabList() {
    const listEl = modal.body.querySelector("#custom-tab-list");
    if (!listEl) return;
    const currentDisabled = getDisabledFromForm();
    if (pendingCustomTabs.length === 0) {
      listEl.innerHTML = "<div class='prowess-empty-sub'>No custom tabs yet</div>";
    } else {
      listEl.innerHTML = pendingCustomTabs.map((ct, i) => `
        <div class="prowess-custom-tab-row" data-idx="${i}">
          <span class="prowess-custom-tab-name">${escapeHtml(ct.label)}</span>
          <span class="prowess-custom-tab-field">${escapeHtml(ct.jsonField)}</span>
          <div class="prowess-custom-tab-actions">
            <label class="prowess-toggle" title="Enable/Disable">
              <input type="checkbox" class="prowess-custom-tab-enable-cb" data-tab-id="${ct.id}"
                ${currentDisabled.includes(ct.id) ? "" : "checked"}>
              <span class="prowess-toggle-slider"></span>
            </label>
            <button class="prowess-btn small danger prowess-remove-custom-tab" data-idx="${i}">Remove</button>
          </div>
        </div>
      `).join("");
    }
    // Wire remove buttons
    listEl.querySelectorAll(".prowess-remove-custom-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx);
        pendingCustomTabs.splice(idx, 1);
        refreshCustomTabList();
      });
    });
  }

  function getDisabledFromForm() {
    const result = [];
    modal.body.querySelectorAll(".prowess-tab-enable-cb").forEach(cb => {
      if (!cb.checked) result.push(cb.dataset.tabId);
    });
    modal.body.querySelectorAll(".prowess-custom-tab-enable-cb").forEach(cb => {
      if (!cb.checked) result.push(cb.dataset.tabId);
    });
    return result;
  }

  // Wire remove on initial render
  modal.body.querySelectorAll(".prowess-remove-custom-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx);
      pendingCustomTabs.splice(idx, 1);
      refreshCustomTabList();
    });
  });

  // ── Add Custom Tab button → opens inline builder ──────────────────────────
  modal.body.querySelector("#add-custom-tab-btn")?.addEventListener("click", () => {
    openCustomTabBuilder(container, STRUCTURES, modal.body, (newTab) => {
      pendingCustomTabs.push(newTab);
      refreshCustomTabList();
      showToast(container, `"${newTab.label}" added — save settings to apply`, "success");
    });
  });

  // ── Save handler ──────────────────────────────────────────────────────────
  modal.body.querySelector("#save-settings")?.addEventListener("click", async () => {
    const stickyPanelItems = ["characters","locations","factions","artifacts","timers"]
      .filter(id => modal.body.querySelector(`#sp-item-${id}`)?.checked);

    const newDisabled = getDisabledFromForm();

    const newSettings = {
      ...settings,
      blurAmount: parseInt(blurInput?.value || "8"),
      overlayOpacity: parseInt(opacityInput?.value || "75") / 100,
      chaptersFolder: modal.body.querySelector("#setting-chapters-folder")?.value || PROWESS.chaptersFolder,
      rawChaptersFolder: modal.body.querySelector("#setting-raw-folder")?.value || PROWESS.rawChaptersFolder,
      charactersFolder: modal.body.querySelector("#setting-chars-folder")?.value || PROWESS.charactersFolder,
      accentColor: modal.body.querySelector("#accent-color")?.value || "#d4a853",
      stickyPanelEnabled: modal.body.querySelector("#sticky-panel-enabled")?.checked ?? true,
      stickyPanelItems: stickyPanelItems.length > 0 ? stickyPanelItems : DEFAULT_SETTINGS.stickyPanelItems,
      disabledTabs: newDisabled,
      customTabs: pendingCustomTabs,
    };

    const saved = await saveSettings(newSettings);
    if (!saved) return; // error already shown by saveSettings

    if (pendingImageCache) {
      await saveImageCache(pendingImageCache.base64Data, pendingImageCache.fileName, pendingImageCache.mimeType);
    }

    PROWESS.chaptersFolder = newSettings.chaptersFolder;
    PROWESS.rawChaptersFolder = newSettings.rawChaptersFolder;
    PROWESS.charactersFolder = newSettings.charactersFolder;

    modal.close();
    showToast(container, "Settings saved!", "success");
    renderMainPage(container, "chapters", true);
  });
}

// ─── Custom Tab Builder — renders inline inside the settings modal body ───────
function openCustomTabBuilder(container, STRUCTURES, modalBody, onAdd) {
  // Disable the Add button while builder is open
  const addTabBtn = modalBody.querySelector("#add-custom-tab-btn");
  if (addTabBtn) addTabBtn.disabled = true;

  const structureCards = STRUCTURES.map(s => `
    <div class="prowess-structure-card" data-id="${s.id}">
      <div class="prowess-structure-card-label">${s.label}</div>
      <div class="prowess-structure-card-desc">${s.desc}</div>
      <div class="prowess-structure-card-example">${escapeHtml(s.example)}</div>
    </div>
  `).join("");

  const builder = document.createElement("div");
  builder.className = "prowess-inline-builder";
  builder.innerHTML = `
    <div class="prowess-inline-builder-header">
      <span>New Custom Tab</span>
      <button class="prowess-btn small" id="ct-cancel-inline">&times; Cancel</button>
    </div>
    <div class="prowess-setting-group">
      <label>Tab Label</label>
      <input type="text" id="ct-label" placeholder="e.g. Skills, Techniques, Gods" autocomplete="off">
    </div>
    <div class="prowess-setting-group">
      <label>JSON Field Name <span style="color:var(--pg-gold-dim);font-size:11px;">auto-generated, editable</span></label>
      <input type="text" id="ct-field" placeholder="e.g. skills" autocomplete="off" style="font-family:monospace;">
    </div>
    <div class="prowess-setting-group">
      <label>AI Extraction Prompt</label>
      <textarea id="ct-prompt" rows="3" placeholder="e.g. Extract any skills or techniques the protagonist learns or uses." style="resize:vertical;width:100%;box-sizing:border-box;"></textarea>
    </div>
    <div class="prowess-setting-group">
      <label style="margin-bottom:8px;">Data Structure</label>
      <div class="prowess-structure-cards">${structureCards}</div>
      <input type="hidden" id="ct-structure" value="">
    </div>
    <div class="prowess-actions" style="margin-top:12px;">
      <button class="prowess-btn primary" id="ct-add-inline" disabled>Add Tab</button>
    </div>
  `;

  // Insert builder right before the Add button
  addTabBtn.parentNode.insertBefore(builder, addTabBtn);

  const labelInput = builder.querySelector("#ct-label");
  const fieldInput = builder.querySelector("#ct-field");
  const promptInput = builder.querySelector("#ct-prompt");
  const structureInput = builder.querySelector("#ct-structure");
  const addBtn = builder.querySelector("#ct-add-inline");

  function validateForm() {
    addBtn.disabled = !(labelInput.value.trim() && fieldInput.value.trim() && promptInput.value.trim() && structureInput.value);
  }

  labelInput.addEventListener("input", () => {
    const raw = labelInput.value.trim().toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+(.)/g, (_, c) => c.toUpperCase());
    fieldInput.value = raw || "";
    validateForm();
  });

  builder.querySelectorAll(".prowess-structure-card").forEach(card => {
    card.addEventListener("click", () => {
      builder.querySelectorAll(".prowess-structure-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      structureInput.value = card.dataset.id;
      validateForm();
    });
  });

  [fieldInput, promptInput].forEach(el => el.addEventListener("input", validateForm));

  function closeBuilder() {
    builder.remove();
    if (addTabBtn) addTabBtn.disabled = false;
  }

  builder.querySelector("#ct-cancel-inline").addEventListener("click", closeBuilder);

  addBtn.addEventListener("click", () => {
    const label = labelInput.value.trim();
    const jsonField = fieldInput.value.trim();
    const prompt = promptInput.value.trim();
    const structure = structureInput.value;
    if (!label || !jsonField || !prompt || !structure) return;
    const id = "custom_" + jsonField + "_" + Date.now();
    onAdd({ id, label, jsonField, prompt, structure });
    closeBuilder();
  });
}


// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15: NEW TAB RENDERERS
// Generic, auto-styled renderers for: Timers, Locations, Factions, Artifacts,
// Prowess, Status, World-Building. Each uses data-type attributes for CSS coloring.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Generic Data Tab — For simple string arrays (locations, factions, world-building) ───
async function renderDataTab(contentArea, dataField, itemType) {
  const chapters = await listJsonFiles(PROWESS.chaptersFolder);
  const items = [];
  for (const file of chapters) {
    const chData = await readJsonFile(file.path);
    if (!chData || !chData[dataField]) continue;
    const fieldData = chData[dataField];
    if (Array.isArray(fieldData)) {
      for (const item of fieldData) {
        if (typeof item === "string") {
          items.push({ name: item, chapter: chData.chapterNumber, chapterTitle: chData.chapterTitle });
        } else if (item?.name || item?.description) {
          items.push({
            name: item.name || item.description,
            chapter: chData.chapterNumber,
            chapterTitle: chData.chapterTitle,
            ...item,
          });
        }
      }
    }
  }

  const page = document.createElement("div");
  page.className = "prowess-tab-page";

  // Count stat
  const uniqueCount = new Set(items.map(i => String(i.name).toLowerCase())).size;
  const stats = document.createElement("div");
  stats.className = "prowess-stats-bar";
  stats.innerHTML = `
    <div class="prowess-stat">
      <span class="prowess-stat-value">${uniqueCount}</span>
      <span class="prowess-stat-label">Unique</span>
    </div>
    <div class="prowess-stat">
      <span class="prowess-stat-value">${items.length}</span>
      <span class="prowess-stat-label">Total</span>
    </div>
  `;
  page.appendChild(stats);

  if (items.length === 0) {
    page.innerHTML += `
      <div class="prowess-empty-state">
        <div class="prowess-empty-icon">&#10020;</div>
        <div class="prowess-empty-text">No ${itemType}s recorded yet</div>
        <div class="prowess-empty-sub">${itemType}s appear after chapters are analyzed</div>
      </div>
    `;
  } else {
    const list = document.createElement("div");
    list.className = "prowess-accent-list";
    const prowessContainer = contentArea.closest(".prowess-container");
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "prowess-list-item";
      el.dataset.type = itemType;
      el.innerHTML = `
        <span class="prowess-list-item-marker">\u2726</span>
        <div class="prowess-list-item-content">
          <div class="prowess-list-item-title">${escapeHtml(item.name)}</div>
          ${item.description ? `<div class="prowess-list-item-desc">${escapeHtml(item.description)}</div>` : ""}
        </div>
        <span class="prowess-list-item-chapter">Ch. ${item.chapter || "?"}</span>
      `;
      el.addEventListener("click", () => {
        if (_selectionState) return;
        if (!prowessContainer) return;
        listJsonFiles(PROWESS.chaptersFolder).then(files => {
          const match = files.find(f => f.path.includes(`chapter_${String(item.chapter).padStart(3, "0")}`));
          if (match) {
            readJsonFile(match.path).then(chData => {
              if (chData) renderChapterDetailPage(prowessContainer, chData, match.path);
            });
          }
        });
      });
      el._selectionMeta = {
        tabType: itemType,
        dataField,
        itemName: item.name,
        chapterNumber: item.chapter,
      };
      list.appendChild(el);
    }
    const allEls = Array.from(list.querySelectorAll(".prowess-list-item"));
    for (const el of allEls) {
      attachSelectionBehavior(el, prowessContainer, el._selectionMeta, allEls, async () => {
        contentArea.innerHTML = "";
        await renderDataTab(contentArea, itemType, dataField, label);
      });
    }
    page.appendChild(list);
  }
  contentArea.appendChild(page);
}

// ─── Artifact Tab — Special renderer for artifact objects ───
async function renderArtifactTab(contentArea) {
  const chapters = await listJsonFiles(PROWESS.chaptersFolder);
  const items = [];
  for (const file of chapters) {
    const chData = await readJsonFile(file.path);
    if (!chData || !Array.isArray(chData.artifacts)) continue;
    for (const item of chData.artifacts) {
      items.push({ ...item, chapter: chData.chapterNumber, chapterTitle: chData.chapterTitle });
    }
  }

  const page = document.createElement("div");
  page.className = "prowess-tab-page";

  const stats = document.createElement("div");
  stats.className = "prowess-stats-bar";
  stats.innerHTML = `
    <div class="prowess-stat">
      <span class="prowess-stat-value">${items.length}</span>
      <span class="prowess-stat-label">Artifacts</span>
    </div>
  `;
  page.appendChild(stats);

  if (items.length === 0) {
    page.innerHTML += `
      <div class="prowess-empty-state">
        <div class="prowess-empty-icon">&#10020;</div>
        <div class="prowess-empty-text">No artifacts recorded yet</div>
        <div class="prowess-empty-sub">Artifacts appear after chapters are analyzed</div>
      </div>
    `;
  } else {
    const grid = document.createElement("div");
    grid.className = "prowess-tab-grid";
    const prowessContainer = contentArea.closest(".prowess-container");
    for (const item of items) {
      const card = document.createElement("div");
      card.className = "prowess-accent-card";
      card.dataset.category = "artifact";
      card.innerHTML = `
        <div class="prowess-accent-card-header">
          <div class="prowess-accent-card-title">${escapeHtml(item.name || "Unknown")}</div>
          <span class="prowess-accent-card-chapter">Ch. ${item.chapter || "?"}</span>
        </div>
        ${item.action ? `<div class="prowess-accent-card-meta">${escapeHtml(item.action)}</div>` : ""}
        ${item.description ? `<div class="prowess-accent-card-subtitle">${escapeHtml(item.description)}</div>` : ""}
        ${item.location ? `<div class="prowess-accent-card-subtitle">Location: ${escapeHtml(item.location)}</div>` : ""}
      `;
      card._selectionMeta = {
        tabType: "artifacts",
        dataField: "artifacts",
        itemName: item.name || "Unknown",
        chapterNumber: item.chapter,
      };
      grid.appendChild(card);
    }
    const allCards = Array.from(grid.querySelectorAll(".prowess-accent-card"));
    for (const card of allCards) {
      attachSelectionBehavior(card, prowessContainer, card._selectionMeta, allCards, async () => {
        contentArea.innerHTML = "";
        await renderArtifactTab(contentArea);
      });
    }
    page.appendChild(grid);
  }
  contentArea.appendChild(page);
}

// ─── Update Tab — For prowessUpdates and statusChanges (object arrays with character) ───
async function renderUpdateTab(contentArea, dataField, itemType, entityField) {
  const chapters = await listJsonFiles(PROWESS.chaptersFolder);
  const items = [];
  for (const file of chapters) {
    const chData = await readJsonFile(file.path);
    if (!chData || !Array.isArray(chData[dataField])) continue;
    for (const item of chData[dataField]) {
      items.push({ ...item, chapter: chData.chapterNumber, chapterTitle: chData.chapterTitle });
    }
  }

  const page = document.createElement("div");
  page.className = "prowess-tab-page";

  const uniqueEntities = new Set(items.map(i => i[entityField]).filter(Boolean)).size;
  const stats = document.createElement("div");
  stats.className = "prowess-stats-bar";
  stats.innerHTML = `
    <div class="prowess-stat">
      <span class="prowess-stat-value">${items.length}</span>
      <span class="prowess-stat-label">Updates</span>
    </div>
    <div class="prowess-stat">
      <span class="prowess-stat-value">${uniqueEntities}</span>
      <span class="prowess-stat-label">Characters</span>
    </div>
  `;
  page.appendChild(stats);

  if (items.length === 0) {
    page.innerHTML += `
      <div class="prowess-empty-state">
        <div class="prowess-empty-icon">&#10020;</div>
        <div class="prowess-empty-text">No ${itemType} updates recorded yet</div>
        <div class="prowess-empty-sub">${itemType} updates appear after chapters are analyzed</div>
      </div>
    `;
  } else {
    const list = document.createElement("div");
    list.className = "prowess-accent-list";
    const prowessContainer = contentArea.closest(".prowess-container");
    for (const item of items) {
      const el = document.createElement("div");
      el.className = "prowess-list-item";
      el.dataset.type = itemType;

      const entityName = item[entityField] || "Unknown";
      const rankDisplay = item.rank ? `<span class="prowess-tag" data-type="${itemType}">${escapeHtml(item.rank)}</span>` : "";

      el.innerHTML = `
        <span class="prowess-list-item-marker">\u2726</span>
        <div class="prowess-list-item-content">
          <div class="prowess-list-item-title">
            <span class="prowess-tag" data-type="character" data-char="${escapeHtml(entityName)}">${escapeHtml(entityName)}</span>
            ${rankDisplay}
          </div>
          <div class="prowess-list-item-desc">${escapeHtml(item.change || item.description || "")}</div>
          ${item.description && item.change ? `<div class="prowess-list-item-desc">${escapeHtml(item.description)}</div>` : ""}
        </div>
        <span class="prowess-list-item-chapter">Ch. ${item.chapter || "?"}</span>
      `;

      // Character tag click
      const charTag = el.querySelector(".prowess-tag[data-char]");
      if (charTag) {
        charTag.addEventListener("click", (e) => {
          if (_selectionState) return;
          e.stopPropagation();
          navigateToCharacter(charTag.dataset.char);
        });
      }

      el._selectionMeta = {
        tabType: itemType,
        dataField,
        changeText: item.change || "",
        itemName: item.change || item.description || entityName,
        chapterNumber: item.chapter,
      };

      list.appendChild(el);
    }
    const allEls = Array.from(list.querySelectorAll(".prowess-list-item"));
    for (const el of allEls) {
      attachSelectionBehavior(el, prowessContainer, el._selectionMeta, allEls, async () => {
        contentArea.innerHTML = "";
        await renderUpdateTab(contentArea, itemType, dataField, entityField, label);
      });
    }
    page.appendChild(list);
  }
  contentArea.appendChild(page);
}

// ─── Custom Tab Renderer ─────────────────────────────────────────────────────
async function renderCustomTab(contentArea, ctDef) {
  const chapters = await listJsonFiles(PROWESS.chaptersFolder);
  const items = [];

  for (const file of chapters) {
    const chData = await readJsonFile(file.path);
    if (!chData) continue;
    const arr = chData[ctDef.jsonField];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (typeof item === "string") {
        items.push({ name: item, chapter: chData.chapterNumber });
      } else {
        items.push({ ...item, chapter: chData.chapterNumber });
      }
    }
  }

  const page = document.createElement("div");
  page.className = "prowess-tab-page";

  const heading = document.createElement("div");
  heading.className = "prowess-section-header";
  heading.innerHTML = `<span>${escapeHtml(ctDef.label)}</span><span class="prowess-count-badge">${items.length}</span>`;
  page.appendChild(heading);

  if (items.length === 0) {
    page.innerHTML += `
      <div class="prowess-empty-state">
        <div class="prowess-empty-icon">&#10020;</div>
        <div class="prowess-empty-text">No ${escapeHtml(ctDef.label)} recorded yet</div>
        <div class="prowess-empty-sub">Entries appear after chapters are analyzed</div>
      </div>
    `;
  } else {
    const prowessContainer = contentArea.closest(".prowess-container");

    // Render based on structure type
    if (ctDef.structure === "artifact-style") {
      const grid = document.createElement("div");
      grid.className = "prowess-tab-grid";
      for (const item of items) {
        const card = document.createElement("div");
        card.className = "prowess-accent-card";
        card.innerHTML = `
          <div class="prowess-accent-card-header">
            <div class="prowess-accent-card-title">${escapeHtml(item.name || item.description || "")}</div>
            <span class="prowess-accent-card-chapter">Ch. ${item.chapter || "?"}</span>
          </div>
          ${item.action ? `<div class="prowess-accent-card-meta">${escapeHtml(item.action)}</div>` : ""}
          ${item.description ? `<div class="prowess-accent-card-subtitle">${escapeHtml(item.description)}</div>` : ""}
          ${item.location ? `<div class="prowess-accent-card-subtitle">Location: ${escapeHtml(item.location)}</div>` : ""}
        `;
        card._selectionMeta = { tabType: ctDef.id, dataField: ctDef.jsonField, itemName: item.name || item.description || "", chapterNumber: item.chapter };
        grid.appendChild(card);
      }
      const allCards = Array.from(grid.querySelectorAll(".prowess-accent-card"));
      for (const card of allCards) {
        attachSelectionBehavior(card, prowessContainer, card._selectionMeta, allCards, async () => {
          contentArea.innerHTML = "";
          await renderCustomTab(contentArea, ctDef);
        });
      }
      page.appendChild(grid);

    } else if (ctDef.structure === "character-update") {
      const list = document.createElement("div");
      list.className = "prowess-accent-list";
      for (const item of items) {
        const el = document.createElement("div");
        el.className = "prowess-list-item";
        el.innerHTML = `
          <span class="prowess-list-item-marker">\u2726</span>
          <div class="prowess-list-item-content">
            <div class="prowess-list-item-title">
              <span class="prowess-tag" data-type="character" data-char="${escapeHtml(item.character || "")}">${escapeHtml(item.character || "Unknown")}</span>
            </div>
            <div class="prowess-list-item-desc">${escapeHtml(item.change || "")}</div>
            ${item.description ? `<div class="prowess-list-item-desc">${escapeHtml(item.description)}</div>` : ""}
          </div>
          <span class="prowess-list-item-chapter">Ch. ${item.chapter || "?"}</span>
        `;
        const charTag = el.querySelector(".prowess-tag[data-char]");
        if (charTag) charTag.addEventListener("click", (e) => { if (_selectionState) return; e.stopPropagation(); navigateToCharacter(charTag.dataset.char); });
        el._selectionMeta = { tabType: ctDef.id, dataField: ctDef.jsonField, itemName: item.change || item.description || item.character || "", chapterNumber: item.chapter };
        list.appendChild(el);
      }
      const allEls = Array.from(list.querySelectorAll(".prowess-list-item"));
      for (const el of allEls) {
        attachSelectionBehavior(el, prowessContainer, el._selectionMeta, allEls, async () => {
          contentArea.innerHTML = "";
          await renderCustomTab(contentArea, ctDef);
        });
      }
      page.appendChild(list);

    } else {
      // simple-list, name-desc, name-desc-meta — all render as list items
      const list = document.createElement("div");
      list.className = "prowess-accent-list";
      for (const item of items) {
        const name = typeof item === "string" ? item : (item.name || item.description || "");
        const desc = typeof item === "string" ? "" : (item.description || item.meta || "");
        const el = document.createElement("div");
        el.className = "prowess-list-item";
        el.innerHTML = `
          <span class="prowess-list-item-marker">\u2726</span>
          <div class="prowess-list-item-content">
            <div class="prowess-list-item-title">${escapeHtml(name)}</div>
            ${desc ? `<div class="prowess-list-item-desc">${escapeHtml(desc)}</div>` : ""}
          </div>
          <span class="prowess-list-item-chapter">Ch. ${item.chapter || "?"}</span>
        `;
        el._selectionMeta = { tabType: ctDef.id, dataField: ctDef.jsonField, itemName: name, chapterNumber: item.chapter };
        list.appendChild(el);
      }
      const allEls = Array.from(list.querySelectorAll(".prowess-list-item"));
      for (const el of allEls) {
        attachSelectionBehavior(el, prowessContainer, el._selectionMeta, allEls, async () => {
          contentArea.innerHTML = "";
          await renderCustomTab(contentArea, ctDef);
        });
      }
      page.appendChild(list);
    }
  }
  contentArea.appendChild(page);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 17: DELETION LOGIC
// Each function handles surgical removal from JSON files.
// "thisEntry" = remove only the specific record.
// "allTraces" = scrub every mention of that value across all files.
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Helper: get all chapter files ───
async function getAllChapterFiles() {
  return await listJsonFiles(PROWESS.chaptersFolder);
}

// ─── Helper: get all character files ───
async function getAllCharacterFiles() {
  const files = [];
  const folder = app.vault.getAbstractFileByPath(PROWESS.charactersFolder);
  if (!folder?.children) return files;
  for (const child of folder.children) {
    if (child.extension === "json") files.push(child);
  }
  return files;
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAPTER DELETION — always "all traces" (no partial option)
// Removes chapter file + scrubs all chapter-specific data from character files
// ─────────────────────────────────────────────────────────────────────────────
async function deleteChapter(filePath, chapterNumber) {
  const chNum = Number(chapterNumber);

  // 1. Scrub chapter-specific data from every character file
  const charFiles = await getAllCharacterFiles();
  for (const cf of charFiles) {
    const charData = await readJsonFile(cf.path);
    if (!charData) continue;
    let changed = false;

    // Remove interactions from this chapter
    const prevInteractions = (charData.interactions || []).length;
    charData.interactions = (charData.interactions || []).filter(i => Number(i.chapter) !== chNum);
    if (charData.interactions.length !== prevInteractions) changed = true;

    // Remove status changes from this chapter
    const prevStatus = (charData.statusChanges || []).length;
    charData.statusChanges = (charData.statusChanges || []).filter(i => Number(i.chapter) !== chNum);
    if (charData.statusChanges.length !== prevStatus) changed = true;

    // Remove prowess updates from this chapter
    const prevProwess = (charData.prowessUpdates || []).length;
    charData.prowessUpdates = (charData.prowessUpdates || []).filter(i => Number(i.chapter) !== chNum);
    if (charData.prowessUpdates.length !== prevProwess) changed = true;

    // Remove meeting locations from this chapter
    const prevMeetings = (charData.meetingLocations || []).length;
    charData.meetingLocations = (charData.meetingLocations || []).filter(i => Number(i.chapter) !== chNum);
    if (charData.meetingLocations.length !== prevMeetings) changed = true;

    if (changed) {
      // If character only appeared in this chapter and now has no data, delete the file
      const hasAnyData =
        (charData.interactions?.length > 0) ||
        (charData.statusChanges?.length > 0) ||
        (charData.prowessUpdates?.length > 0) ||
        (charData.meetingLocations?.length > 0);

      const onlyInThisChapter =
        Number(charData.firstAppearanceChapter) === chNum &&
        Number(charData.lastAppearanceChapter) === chNum;

      if (onlyInThisChapter && !hasAnyData) {
        const file = app.vault.getAbstractFileByPath(cf.path);
        if (file) await app.vault.delete(file);
      } else {
        // Recalculate first/last appearance chapters from remaining data
        const allChapters = [
          ...(charData.interactions || []).map(i => Number(i.chapter)),
          ...(charData.statusChanges || []).map(i => Number(i.chapter)),
          ...(charData.prowessUpdates || []).map(i => Number(i.chapter)),
          ...(charData.meetingLocations || []).map(i => Number(i.chapter)),
        ].filter(Boolean);

        if (allChapters.length > 0) {
          charData.firstAppearanceChapter = Math.min(...allChapters);
          charData.lastAppearanceChapter = Math.max(...allChapters);
        }
        await writeJsonFile(cf.path, charData);
      }
    }
  }

  // 2. Delete the chapter file itself
  const chFile = app.vault.getAbstractFileByPath(filePath);
  if (chFile) await app.vault.delete(chFile);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER DELETION
// ─────────────────────────────────────────────────────────────────────────────

// "This entry" — delete just the character JSON file
async function deleteCharacterEntry(charFilePath) {
  const file = app.vault.getAbstractFileByPath(charFilePath);
  if (file) await app.vault.delete(file);
}

// "All traces" — delete character file + remove from all chapter JSONs
async function deleteCharacterAllTraces(charName) {
  const nameLower = charName.toLowerCase();

  // Scrub from every chapter file
  const chapterFiles = await getAllChapterFiles();
  for (const cf of chapterFiles) {
    const chData = await readJsonFile(cf.path);
    if (!chData) continue;
    let changed = false;

    const fields = [
      { key: "newCharacters",          match: i => i?.name?.toLowerCase() === nameLower },
      { key: "protagonistInteractions", match: i => i?.character?.toLowerCase() === nameLower },
      { key: "prowessUpdates",          match: i => i?.character?.toLowerCase() === nameLower },
      { key: "statusChanges",           match: i => i?.character?.toLowerCase() === nameLower },
    ];

    for (const { key, match } of fields) {
      if (!Array.isArray(chData[key])) continue;
      const before = chData[key].length;
      chData[key] = chData[key].filter(i => !match(i));
      if (chData[key].length !== before) changed = true;
    }

    if (changed) await writeJsonFile(cf.path, chData);
  }

  // Delete the character file
  const charFiles = await getAllCharacterFiles();
  for (const cf of charFiles) {
    const data = await readJsonFile(cf.path);
    if (data?.name?.toLowerCase() === nameLower) {
      const file = app.vault.getAbstractFileByPath(cf.path);
      if (file) await app.vault.delete(file);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLE ARRAY FIELD DELETION (timers, locations, factions, world, artifacts)
// ─────────────────────────────────────────────────────────────────────────────

// "This entry" — remove from the specific chapter only (by value + chapter number)
async function deleteFieldEntryFromChapter(dataField, itemName, chapterNumber) {
  const files = await getAllChapterFiles();
  const match = files.find(f => f.path.includes(`chapter_${String(chapterNumber).padStart(3, "0")}`));
  if (!match) return;
  const chData = await readJsonFile(match.path);
  if (!chData || !Array.isArray(chData[dataField])) return;

  chData[dataField] = chData[dataField].filter(item => {
    const val = typeof item === "string" ? item : (item?.name || item?.description || "");
    return val.toLowerCase() !== itemName.toLowerCase();
  });

  await writeJsonFile(match.path, chData);
}

// "All traces" — remove every occurrence of this value from every chapter file
async function deleteFieldEntryAllTraces(dataField, itemName) {
  const files = await getAllChapterFiles();
  for (const cf of files) {
    const chData = await readJsonFile(cf.path);
    if (!chData || !Array.isArray(chData[dataField])) continue;

    const before = chData[dataField].length;
    chData[dataField] = chData[dataField].filter(item => {
      const val = typeof item === "string" ? item : (item?.name || item?.description || "");
      return val.toLowerCase() !== itemName.toLowerCase();
    });

    if (chData[dataField].length !== before) await writeJsonFile(cf.path, chData);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROWESS / STATUS DELETION (match on exact change text)
// ─────────────────────────────────────────────────────────────────────────────

// "This entry" — remove from specific chapter only
async function deleteProwessStatusFromChapter(dataField, changeText, chapterNumber) {
  const files = await getAllChapterFiles();
  const match = files.find(f => f.path.includes(`chapter_${String(chapterNumber).padStart(3, "0")}`));
  if (!match) return;
  const chData = await readJsonFile(match.path);
  if (!chData || !Array.isArray(chData[dataField])) return;

  chData[dataField] = chData[dataField].filter(
    item => (item?.change || "").toLowerCase() !== changeText.toLowerCase()
  );

  await writeJsonFile(match.path, chData);

  // Also clean up character file: remove matching entry from the right array
  const charArrayKey = dataField === "prowessUpdates" ? "prowessUpdates" : "statusChanges";
  const charFiles = await getAllCharacterFiles();
  for (const cf of charFiles) {
    const charData = await readJsonFile(cf.path);
    if (!charData || !Array.isArray(charData[charArrayKey])) continue;
    const before = charData[charArrayKey].length;
    charData[charArrayKey] = charData[charArrayKey].filter(
      i => !(Number(i.chapter) === Number(chapterNumber) && (i.change || "").toLowerCase() === changeText.toLowerCase())
    );
    if (charData[charArrayKey].length !== before) await writeJsonFile(cf.path, charData);
  }
}

// "All traces" — remove every entry with this exact change text across all chapters
async function deleteProwessStatusAllTraces(dataField, changeText) {
  const files = await getAllChapterFiles();
  for (const cf of files) {
    const chData = await readJsonFile(cf.path);
    if (!chData || !Array.isArray(chData[dataField])) continue;
    const before = chData[dataField].length;
    chData[dataField] = chData[dataField].filter(
      item => (item?.change || "").toLowerCase() !== changeText.toLowerCase()
    );
    if (chData[dataField].length !== before) await writeJsonFile(cf.path, chData);
  }

  // Clean character files too
  const charArrayKey = dataField === "prowessUpdates" ? "prowessUpdates" : "statusChanges";
  const charFiles = await getAllCharacterFiles();
  for (const cf of charFiles) {
    const charData = await readJsonFile(cf.path);
    if (!charData || !Array.isArray(charData[charArrayKey])) continue;
    const before = charData[charArrayKey].length;
    charData[charArrayKey] = charData[charArrayKey].filter(
      i => (i.change || "").toLowerCase() !== changeText.toLowerCase()
    );
    if (charData[charArrayKey].length !== before) await writeJsonFile(cf.path, charData);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 18: SELECTION MODE ENGINE
// Long-press activates selection. Action bar offers "This Entry" / "All Traces".
// Works across all tabs. Each card registers itself via attachSelectionBehavior().
// ═══════════════════════════════════════════════════════════════════════════════

// Global selection state — one active session per page
let _selectionState = null;

function exitSelectionMode() {
  if (!_selectionState) return;
  const { bar, selectedCards, onExit, container: stateContainer } = _selectionState;
  bar.remove();
  if (stateContainer) stateContainer.classList.remove("prowess-selection-active");
  for (const { el } of selectedCards) {
    el.classList.remove("prowess-selected", "prowess-selection-mode");
  }
  if (_selectionState.allCards) {
    for (const el of _selectionState.allCards) {
      el.classList.remove("prowess-selection-mode");
    }
  }
  _selectionState = null;
  if (onExit) onExit();
}

function updateSelectionBar() {
  if (!_selectionState) return;
  const { bar, selectedCards, isChapterTab } = _selectionState;
  const count = selectedCards.length;
  const countEl = bar.querySelector(".prowess-sel-count");
  const deleteBtn = bar.querySelector(".prowess-sel-delete");
  const deleteAllBtn = bar.querySelector(".prowess-sel-delete-all");

  countEl.textContent = `${count} selected`;
  deleteBtn.disabled = count === 0;
  if (deleteAllBtn) deleteAllBtn.disabled = count === 0;
}

// Show the confirmation modal before actually deleting
function confirmDeleteModal(container, message, onConfirm) {
  const overlay = document.createElement("div");
  overlay.className = "prowess-modal-overlay";
  overlay.style.zIndex = "3000";
  overlay.innerHTML = `
    <div class="prowess-modal" style="max-width:320px">
      <div class="prowess-modal-header">
        <span class="prowess-modal-title">Confirm Delete</span>
      </div>
      <div class="prowess-modal-body">
        <p style="color:var(--pg-text-secondary);font-size:14px;margin-bottom:20px;">${message}</p>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="prowess-btn secondary" id="del-cancel">Cancel</button>
          <button class="prowess-btn" id="del-confirm" style="background:var(--pg-crimson);border-color:var(--pg-crimson-soft);color:#fff;">Delete</button>
        </div>
      </div>
    </div>
  `;
  container.appendChild(overlay);
  overlay.querySelector("#del-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#del-confirm").addEventListener("click", () => {
    overlay.remove();
    onConfirm();
  });
}

// Build the floating action bar at the bottom
function buildSelectionBar(container, isChapterTab) {
  const bar = document.createElement("div");
  bar.className = "prowess-selection-bar";

  if (isChapterTab) {
    // Chapters: only one delete option (always all traces)
    bar.innerHTML = `
      <button class="prowess-sel-cancel">Cancel</button>
      <span class="prowess-sel-count">0 selected</span>
      <button class="prowess-sel-delete prowess-sel-danger" disabled>Delete Chapter</button>
    `;
  } else {
    // All other tabs: two delete options
    bar.innerHTML = `
      <button class="prowess-sel-cancel">Cancel</button>
      <span class="prowess-sel-count">0 selected</span>
      <div class="prowess-sel-actions">
        <button class="prowess-sel-delete" disabled>This Entry</button>
        <button class="prowess-sel-delete-all prowess-sel-danger" disabled>All Traces</button>
      </div>
    `;
  }

  container.appendChild(bar);

  bar.querySelector(".prowess-sel-cancel").addEventListener("click", exitSelectionMode);

  return bar;
}

// The main entry point — call this on every card element
// meta: { tabType, dataField, itemName, chapterNumber, filePath, charName }
function attachSelectionBehavior(el, container, meta, allCardsRef, onDeleteDone) {
  let pressTimer = null;
  const LONG_PRESS_MS = 500;

  function startPress(e) {
    pressTimer = setTimeout(() => {
      pressTimer = null;
      activateOrJoin(el, container, meta, allCardsRef, onDeleteDone);
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
  }

  el.addEventListener("touchstart", startPress, { passive: true });
  el.addEventListener("touchend", cancelPress);
  el.addEventListener("touchmove", cancelPress);
  el.addEventListener("mousedown", startPress);
  el.addEventListener("mouseup", cancelPress);
  el.addEventListener("mouseleave", cancelPress);
}

function activateOrJoin(el, container, meta, allCardsRef, onDeleteDone) {
  const isChapterTab = meta.tabType === "chapters";

  if (!_selectionState) {
    // First long-press — enter selection mode
    const bar = buildSelectionBar(container, isChapterTab);
    _selectionState = {
      bar,
      container,
      selectedCards: [],
      allCards: allCardsRef || [],
      isChapterTab,
      onExit: null,
    };
    container.classList.add("prowess-selection-active");

    // Put all sibling cards into selection-mode style
    for (const sibling of (_selectionState.allCards || [])) {
      sibling.classList.add("prowess-selection-mode");
    }

    // Wire delete buttons
    const deleteBtn = bar.querySelector(".prowess-sel-delete");
    const deleteAllBtn = bar.querySelector(".prowess-sel-delete-all");

    deleteBtn.addEventListener("click", async () => {
      const items = [..._selectionState.selectedCards];
      if (items.length === 0) return;

      const names = items.map(i => i.meta.itemName || i.meta.charName || "item").join(", ");
      const msg = isChapterTab
        ? `Delete ${items.length} chapter(s) and all their data? This cannot be undone.`
        : `Remove ${items.length} selected entr${items.length > 1 ? "ies" : "y"} from their source chapter(s) only?`;

      confirmDeleteModal(container, msg, async () => {
        exitSelectionMode();
        showToast(container, "Deleting...", "info");
        for (const { meta: m } of items) {
          if (m.tabType === "chapters") {
            await deleteChapter(m.filePath, m.chapterNumber);
          } else if (m.tabType === "characters") {
            await deleteCharacterEntry(m.filePath);
          } else if (m.tabType === "prowess" || m.tabType === "status") {
            const field = m.tabType === "prowess" ? "prowessUpdates" : "statusChanges";
            await deleteProwessStatusFromChapter(field, m.changeText, m.chapterNumber);
          } else {
            await deleteFieldEntryFromChapter(m.dataField, m.itemName, m.chapterNumber);
          }
        }
        // Invalidate cache and re-render
        const prowessContainer = container.closest(".prowess-container") || container;
        prowessContainer._prowessCache = null;
        showToast(prowessContainer, "Deleted successfully", "success");
        if (onDeleteDone) onDeleteDone();
      });
    });

    if (deleteAllBtn) {
      deleteAllBtn.addEventListener("click", async () => {
        const items = [..._selectionState.selectedCards];
        if (items.length === 0) return;

        const names = items.map(i => i.meta.itemName || i.meta.charName || "item").join(", ");
        const msg = `Remove ALL traces of "${names}" from every chapter and character file? This cannot be undone.`;

        confirmDeleteModal(container, msg, async () => {
          exitSelectionMode();
          showToast(container, "Deleting all traces...", "info");
          for (const { meta: m } of items) {
            if (m.tabType === "characters") {
              await deleteCharacterAllTraces(m.charName);
            } else if (m.tabType === "prowess" || m.tabType === "status") {
              const field = m.tabType === "prowess" ? "prowessUpdates" : "statusChanges";
              await deleteProwessStatusAllTraces(field, m.changeText);
            } else {
              await deleteFieldEntryAllTraces(m.dataField, m.itemName);
            }
          }
          const prowessContainer = container.closest(".prowess-container") || container;
          prowessContainer._prowessCache = null;
          showToast(prowessContainer, "All traces removed", "success");
          if (onDeleteDone) onDeleteDone();
        });
      });
    }
  }

  // Toggle this card's selection
  if (_selectionState) {
    const alreadySelected = _selectionState.selectedCards.findIndex(s => s.el === el);
    if (alreadySelected >= 0) {
      _selectionState.selectedCards.splice(alreadySelected, 1);
      el.classList.remove("prowess-selected");
    } else {
      _selectionState.selectedCards.push({ el, meta });
      el.classList.add("prowess-selected");
    }

    // In selection mode, tapping a card toggles it (override normal click)
    if (!el._selectionClickBound) {
      el._selectionClickBound = true;
      el.addEventListener("click", (e) => {
        if (!_selectionState) return;
        e.stopPropagation();
        const idx = _selectionState.selectedCards.findIndex(s => s.el === el);
        if (idx >= 0) {
          _selectionState.selectedCards.splice(idx, 1);
          el.classList.remove("prowess-selected");
        } else {
          _selectionState.selectedCards.push({ el, meta });
          el.classList.add("prowess-selected");
        }
        updateSelectionBar();
      }, true);
    }

    updateSelectionBar();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16: BACKGROUND & ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

async function applyBackground(container, settings) {
  const cache = await loadImageCache();
  const dataUrl = cache?.base64Data
    ? `data:${cache.mimeType};base64,${cache.base64Data}`
    : settings.backgroundImage || null;

  if (!dataUrl) return;

  let bg = container.querySelector(".prowess-bg-layer");
  if (!bg) {
    bg = document.createElement("div");
    bg.className = "prowess-bg-layer";
    container.insertBefore(bg, container.firstChild);
  }

  bg.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: url('${dataUrl}');
    background-size: cover;
    background-position: center;
    filter: blur(${settings.blurAmount || 8}px);
    opacity: ${settings.overlayOpacity || 0.75};
    z-index: -1;
    pointer-events: none;
  `;
}

async function initProwessTracker() {
  const container = dv.container;
  container.classList.add("prowess-container");
  // Prevent double-tap/click from triggering Obsidian's edit mode
  container.addEventListener("dblclick", e => e.stopPropagation(), true);
  container.innerHTML = "<div class='prowess-init-loading'>Initializing Prowess Tracker...</div>";

  await ensureFolder(PROWESS.chaptersFolder);
  await ensureFolder(PROWESS.rawChaptersFolder);
  await ensureFolder(PROWESS.charactersFolder);

  const config = await loadConfig();
  if (!config) {
    container.innerHTML = `
      <div class="prowess-error-state">
        <div>Configuration Required</div>
        <p>Create <code>prowess_config.json</code> in your vault root with your API keys.</p>
        <pre>${JSON.stringify({
          activeProvider: "aistudio",
          activeModel: "gemini-2.5-flash",
          providers: {
            aistudio: { key: "YOUR_KEY", models: ["gemini-2.5-flash", "gemini-2.5-pro"] },
            groq: { key: "YOUR_KEY", models: ["llama-3.3-70b-versatile"] },
            openrouter: { key: "YOUR_KEY", models: ["deepseek/deepseek-v3"] },
          }
        }, null, 2)}</pre>
      </div>
    `;
    return;
  }

  await renderMainPage(container);
}

// Run initialization
await initProwessTracker();
```

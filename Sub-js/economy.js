// ╔══════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — ECONOMY MODULE  v4.0                       ║
// ║  Fully dynamic: auto-discovers & renders ALL JSON data      ║
// ║  Adds new keys automatically — no JS edits needed           ║
// ╚══════════════════════════════════════════════════════════════╝

DEVOUR.modules["economy"] = function(DEVOUR, container, shellState) {

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
var esc = DEVOUR.utils.escapeHtml;
function div(cls, inner) { return '<div class="' + cls + '">' + inner + '</div>'; }
function span(cls, inner) { return '<span class="' + cls + '">' + inner + '</span>'; }

var ECON_CFG = DEVOUR.cfg.economy;
var CURR_CFG = DEVOUR.cfg.currency;
var showUSD         = shellState.showUSD         || false;
var showAuthorNotes = shellState.showAuthorNotes || false;

// ── SELF-LOAD points.json ────────────────────────────────────
var PTS_CFG = DEVOUR.cfg.points || null;
if (!PTS_CFG && app && app.vault) {
  var ptsPaths = ["config/points.json","Config/points.json","Meta/config/points.json","Meta/Config/points.json"];
  (function tryLoad(i) {
    if (i >= ptsPaths.length) return;
    app.vault.adapter.exists(ptsPaths[i]).then(function(exists) {
      if (!exists) { tryLoad(i+1); return; }
      app.vault.adapter.read(ptsPaths[i]).then(function(raw) {
        try {
          DEVOUR.cfg.points = JSON.parse(raw); PTS_CFG = DEVOUR.cfg.points;
          // Force full shell rebuild so the points tab appears in the tab bar
          var existingRoot = container.querySelector(".econ-root");
          if (existingRoot) {
            var tabsEl = existingRoot.querySelector(".econ-tabs");
            if (tabsEl) tabsEl.__tabsBound = false;
            existingRoot.remove();
          }
          render();
        }
        catch(e) { console.error("[DEVOUR Economy] Failed to parse points.json:", e); }
      }).catch(function() { tryLoad(i+1); });
    }).catch(function() { tryLoad(i+1); });
  })(0);
}

// ── MODULE STATE ─────────────────────────────────────────────
if (!DEVOUR._econState) {
  DEVOUR._econState = {
    activeSection:  "tiers",
    editingTier:    null,
    editingConv:    null,
    newCurrency:    null,
    activePointOrg: null,
  };
}
var state = DEVOUR._econState;

// ── CURRENCY COLOR MAP ───────────────────────────────────────
var CURR_COLORS = {
  "CRED": "var(--econ-credit)",
  "LOW◈": "var(--econ-crystal)",
  "MID◈": "#88d8ff",
  "HIGH◈":"var(--econ-core)",
  "CORE▣":"var(--econ-core)",
  "_default": "var(--econ-teal)"
};
var CURR_CLASS = {
  "CRED": "cs-cred", "LOW◈": "cs-low", "MID◈": "cs-mid",
  "HIGH◈":"cs-high", "CORE▣":"cs-core", "AP": "cs-ap",
  "_default": "cs-default"
};

function currColor(str) {
  if (!str) return CURR_COLORS._default;
  if (/₵/.test(str))  return CURR_COLORS["CRED"];
  if (/◈/.test(str))  return CURR_COLORS["LOW◈"];
  if (/▣/.test(str))  return CURR_COLORS["CORE▣"];
  if (/AP/.test(str)) return "var(--econ-amber)";
  return CURR_COLORS._default;
}
function currClass(str) {
  if (!str) return CURR_CLASS._default;
  if (/₵/.test(str))  return CURR_CLASS["CRED"];
  if (/◈/.test(str))  return CURR_CLASS["LOW◈"];
  if (/▣/.test(str))  return CURR_CLASS["CORE▣"];
  if (/AP/.test(str)) return CURR_CLASS["AP"];
  return CURR_CLASS._default;
}
function cVal(str) {
  if (!str || str === "—" || str === "--") return esc(str || "—");
  return '<span class="' + currClass(str) + '">' + esc(str) + '</span>';
}

// ── FORMAT HELPERS ───────────────────────────────────────────
function fmtN(n) {
  if (n === null || n === undefined) return "--";
  return Number(n).toLocaleString() + " ₵";
}
function fmtUSD(credits) {
  if (!showUSD) return null;
  var uv = credits * (CURR_CFG && CURR_CFG.credit_usd ? CURR_CFG.credit_usd : 0.5);
  if      (uv >= 1e9) return "$" + (uv/1e9).toFixed(1) + "B";
  else if (uv >= 1e6) return "$" + (uv/1e6).toFixed(1) + "M";
  else if (uv >= 1e3) return "$" + Math.round(uv/1e3)  + "K";
  else                return "$" + Math.round(uv).toLocaleString();
}
function sectionTitle(label, color) {
  var s = color ? 'style="color:' + color + '"' : '';
  return '<div class="econ-section-title" ' + s + '>' + esc(label) + '</div>';
}

// ── PERSISTENCE ──────────────────────────────────────────────
function saveJSON(path, data) {
  try {
    var f = app.vault.getAbstractFileByPath(path);
    var content = JSON.stringify(data, null, 2);
    if (f) app.vault.modify(f, content);
    else   app.vault.create(path, content);
  } catch(e) { console.error("[DEVOUR Economy] Failed to save " + path + ":", e); }
}
function saveCurrencyConfig() { saveJSON("config/currency-reference.json", CURR_CFG); }
function saveEconomyConfig()  { saveJSON("config/economy-reference.json",  ECON_CFG); }

// ── RATE PROPAGATION ─────────────────────────────────────────
function propagateRateChange(changedCode, newRate) {
  var tbl = CURR_CFG.conversion_table || [];
  for (var i = 0; i < tbl.length; i++) {
    if (tbl[i].code === changedCode) {
      tbl[i].rate = newRate;
      tbl[i].to_credits = String(newRate);
      break;
    }
  }
  if (changedCode === "CRED_USD") {
    CURR_CFG.credit_usd = newRate;
    if (ECON_CFG) ECON_CFG.credit_usd_equivalent = newRate;
  }
  if (changedCode === "AP") {
    CURR_CFG.ap_credit_rate = newRate;
    if (ECON_CFG) ECON_CFG.ap_credit_rate = newRate;
  }
  if (CURR_CFG.tiers) {
    for (var ti = 0; ti < CURR_CFG.tiers.length; ti++) {
      var tier = CURR_CFG.tiers[ti];
      if (tier.id === "essence_crystals" && changedCode === "LOW◈") {
        tier.base_value = newRate;
        if (tier.grades) {
          for (var gi = 0; gi < tier.grades.length; gi++) {
            var g = tier.grades[gi];
            if (g.grade === "Low-grade ◈")  g.value_credits = newRate.toLocaleString() + " ₵";
            if (g.grade === "Mid-grade ◈")  g.value_credits = (newRate * 100).toLocaleString() + " ₵";
            if (g.grade === "High-grade ◈") g.value_credits = (newRate * 10000).toLocaleString() + " ₵";
          }
        }
        for (var ci = 0; ci < tbl.length; ci++) {
          if (tbl[ci].code === "MID◈")  { tbl[ci].rate = newRate * 100;   tbl[ci].to_credits = String(newRate * 100); }
          if (tbl[ci].code === "HIGH◈") { tbl[ci].rate = newRate * 10000; tbl[ci].to_credits = String(newRate * 10000); }
        }
      }
      if (tier.id === "dungeon_cores" && changedCode === "CORE▣") {
        tier.base_value = newRate;
        if (tier.grades && tier.grades[0]) tier.grades[0].value_credits = newRate.toLocaleString() + " ₵";
      }
    }
  }
  saveCurrencyConfig();
  saveEconomyConfig();
}

// ═══════════════════════════════════════════════════════════════
//  DATA SHAPE DETECTION  (for auto-rendering unknown data)
// ═══════════════════════════════════════════════════════════════
function isPlain(v) {
  return v === null || v === undefined || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}
function hasIncomeFields(obj) {
  return obj && (obj.daily !== undefined || obj.monthly !== undefined || obj.annual !== undefined ||
    obj.daily_low !== undefined || obj.annual_low !== undefined || obj.annual_gross_low !== undefined);
}
function hasArrayProperty(obj) {
  if (!obj || typeof obj !== "object") return false;
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    if (Array.isArray(obj[keys[i]])) return true;
  }
  return false;
}
function getNoteField(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (obj._note) return obj._note;
  if (obj.notes && typeof obj.notes === "string" && obj.notes.length > 60) return obj.notes;
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  TAB DISCOVERY — auto-route ALL JSON keys to appropriate tabs
// ═══════════════════════════════════════════════════════════════
function discoverTabs() {
  var tabMap = {};   // tabId -> {id, label, sources: []}
  var seenKeys = {}; // Track which economy keys are assigned

  // Tab label map — ensures consistent tab names regardless of section labels
  var TAB_LABELS = {
    tiers: "Currency Tiers", conversion: "Exchange Rates",
    wages: "Wages", fees: "Dungeon Fees",
    reference: "Reference", points: "Point Systems"
  };
  function tabLabel(id) { return TAB_LABELS[id] || id.replace(/[_-]/g, " ").replace(/\b\w/g, function(c){return c.toUpperCase();}); }

  function ensureTab(id) {
    if (!tabMap[id]) tabMap[id] = {id: id, label: tabLabel(id), sources: []};
    return tabMap[id];
  }
  function addSource(tabId, key, data, sourceCfg, sectionDef) {
    if (data === undefined || data === null) return;
    ensureTab(tabId).sources.push({
      key: key, data: data, sourceCfg: sourceCfg, sectionDef: sectionDef || null
    });
    if (sourceCfg === "economy") seenKeys[key] = true;
  }

  // ── 1. Process _sections from economy-reference.json ──
  if (ECON_CFG && ECON_CFG._sections) {
    for (var si = 0; si < ECON_CFG._sections.length; si++) {
      var sec = ECON_CFG._sections[si];
      var data = ECON_CFG[sec.key];
      if (data === undefined || data === null) continue;

      // If the value is a non-array object but _sections defines fields,
      // auto-unwrap common sub-array keys (by_rank, items, modifiers, etc.)
      if (sec.fields && !Array.isArray(data) && typeof data === "object") {
        var subArrayKeys = ["by_rank", "items", "modifiers", "entries", "rows"];
        var unwrapped = false;
        var originalData = data;
        for (var sak = 0; sak < subArrayKeys.length; sak++) {
          if (Array.isArray(data[subArrayKeys[sak]]) && data[subArrayKeys[sak]].length) {
            // Carry the parent note into sectionDef so the banner still renders
            var unwrappedSec = {};
            for (var sk in sec) { if (Object.prototype.hasOwnProperty.call(sec, sk)) unwrappedSec[sk] = sec[sk]; }
            if (data._note || data.notes) unwrappedSec._parentNote = data._note || (typeof data.notes === "string" ? data.notes : null);
            data = data[subArrayKeys[sak]];
            sec = unwrappedSec;
            unwrapped = true;
            break;
          }
        }
        if (unwrapped) {
          var leftover = {};
          var dKeys = Object.keys(originalData);
          for (var dk = 0; dk < dKeys.length; dk++) {
            var dkk = dKeys[dk];
            if (dkk[0] === "_" || dkk === "notes" || subArrayKeys.indexOf(dkk) >= 0) continue;
            if (isPlain(originalData[dkk])) leftover[dkk] = originalData[dkk];
          }
          if (Object.keys(leftover).length > 0) {
            addSource(sec.tab, sec.key + "_meta", leftover, "economy", {label: (sec.label || sec.key) + " Details"});
          }
        }
      }

      addSource(sec.tab, sec.key, data, "economy", sec);
    }
  }

  // ── 2. Auto-categorize remaining economy keys ──
  if (ECON_CFG) {
    var eKeys = Object.keys(ECON_CFG);
    for (var ei = 0; ei < eKeys.length; ei++) {
      var ek = eKeys[ei];
      if (ek[0] === "_" || seenKeys[ek]) continue; // Skip _sections, metadata, already-assigned
      var edata = ECON_CFG[ek];

      // Skip primitive/metadata fields
      if (isPlain(edata)) continue;
      if (ek === "notes" || ek === "credit_usd_equivalent" || ek === "ap_credit_rate") continue;
      if (ek === "real_world_benchmarks") continue; // Rendered separately at bottom
      if (ek === "point_systems") continue; // Handled by points tab

      // Skip objects marked as assumptions or that are pure narrative/prose blobs
      // (objects whose only plain values are long strings — not tabular data)
      if (typeof edata === "object" && !Array.isArray(edata) && edata._assumption === true) {
        var hasContent = Object.keys(edata).some(function(k) {
          return k[0] !== "_" && typeof edata[k] === "string" && edata[k].length > 40;
        });
        if (!hasContent) continue;
      }
      if (typeof edata === "object" && !Array.isArray(edata)) {
        // (prose blob check removed — all objects are rendered regardless of string length)
      }

      // Determine best tab
      var tabId = "reference", tLabel = "Reference";

      if (ek === "civilian" || ek === "dormant") {
        tabId = "wages"; tLabel = "Wages";
      } else if (ek === "corebearers") {
        tabId = "wages"; tLabel = "Wages";
      } else if (ek === "dungeon_entry_fees") {
        tabId = "fees"; tLabel = "Dungeon Fees";
      } else if (ek === "dungeon_yield") {
        tabId = "fees"; tLabel = "Dungeon Fees";
      } else if (Array.isArray(edata) && edata.length > 0 && edata[0].rank !== undefined) {
        tabId = "reference"; tLabel = "Reference";
      } else if (hasIncomeFields(edata)) {
        tabId = "wages"; tLabel = "Wages";
      } else if (hasArrayProperty(edata) && getNoteField(edata)) {
        tabId = "reference"; tLabel = "Reference";
      } else if (Array.isArray(edata)) {
        tabId = "reference"; tLabel = "Reference";
      } else {
        tabId = "reference"; tLabel = "Reference";
      }

      addSource(tabId, ek, edata, "economy", null);
    }

    // ── 2b. Collect leftover primitive/metadata values ──
    var meta = {};
    for (var mi = 0; mi < eKeys.length; mi++) {
      var mk = eKeys[mi];
      if (mk[0] === "_" || seenKeys[mk]) continue;
      if (mk === "notes" || mk === "credit_usd_equivalent" || mk === "ap_credit_rate") continue;
      if (mk === "real_world_benchmarks" || mk === "point_systems") continue;
      var mv = ECON_CFG[mk];
      if (isPlain(mv) && mv !== null && mv !== undefined && mv !== "") {
        meta[mk] = mv;
      }
    }
    if (Object.keys(meta).length > 0) {
      addSource("reference", "_metadata", meta, "economy", null);
    }
  }

  // ── 3. Currency-reference.json keys ──
  if (CURR_CFG) {
    // Tiers
    if (CURR_CFG.tiers) {
      addSource("tiers", "tiers", CURR_CFG.tiers, "currency", null);
    }
    // Conversion
    if (CURR_CFG.conversion_table) {
      addSource("conversion", "conversion_table", CURR_CFG.conversion_table, "currency", null);
    }
    if (CURR_CFG.conversion_reference) {
      addSource("conversion", "conversion_reference", CURR_CFG.conversion_reference, "currency", null);
    }
    if (CURR_CFG.real_world_benchmarks) {
      addSource("conversion", "real_world_benchmarks", CURR_CFG.real_world_benchmarks, "currency", null);
    }
    // Auto-discover any other currency keys
    var cKeys = Object.keys(CURR_CFG);
    for (var ci = 0; ci < cKeys.length; ci++) {
      var ck = cKeys[ci];
      if (ck === "tiers" || ck === "conversion_table" || ck === "conversion_reference" ||
          ck === "real_world_benchmarks" || ck === "notes" || ck === "credit_usd" || ck === "ap_credit_rate") continue;
      if (isPlain(CURR_CFG[ck])) continue;
      addSource("conversion", ck, CURR_CFG[ck], "currency", null);
    }
  }

  // ── 4. Point Systems ──
  var ptsSystems = (PTS_CFG && PTS_CFG.systems) || (ECON_CFG && ECON_CFG.point_systems) || null;
  if (ptsSystems) {
    addSource("points", "point_systems", ptsSystems, "points", null);
  }

  // ── 5. Build ordered tab list ──
  var tabOrder = ["tiers", "conversion", "wages", "fees", "reference", "points"];
  var result = [];
  var seenTabs = {};
  for (var ti = 0; ti < tabOrder.length; ti++) {
    if (tabMap[tabOrder[ti]]) {
      result.push(tabMap[tabOrder[ti]]);
      seenTabs[tabOrder[ti]] = true;
    }
  }
  // Any dynamically discovered tabs
  var extraIds = Object.keys(tabMap);
  for (var xi = 0; xi < extraIds.length; xi++) {
    if (!seenTabs[extraIds[xi]]) result.push(tabMap[extraIds[xi]]);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
//  GENERIC AUTO-RENDERERS
// ═══════════════════════════════════════════════════════════════

// ── RANK COLOR MAP ───────────────────────────────────────────
var RANK_COLORS = {
  "F": { bg: "rgba(160,112,208,0.12)", border: "#a070d0", text: "#a070d0" },
  "E": { bg: "rgba(96,196,255,0.10)",  border: "#60c4ff", text: "#60c4ff" },
  "D": { bg: "rgba(0,200,170,0.10)",   border: "#00c8aa", text: "#00c8aa" },
  "C": { bg: "rgba(0,200,170,0.13)",   border: "#00e8c0", text: "#00e8c0" },
  "B": { bg: "rgba(212,168,67,0.12)",  border: "#d4a843", text: "#d4a843" },
  "A": { bg: "rgba(212,168,67,0.18)",  border: "#f0c050", text: "#f0c050" },
  "S": { bg: "rgba(255,200,80,0.18)",  border: "#ffc850", text: "#ffc850" },
  "_default": { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)", text: "#8a94a6" }
};
function rankColor(rank) {
  if (!rank) return RANK_COLORS._default;
  var r = String(rank).trim().toUpperCase().charAt(0);
  return RANK_COLORS[r] || RANK_COLORS._default;
}
function rankBadge(rank) {
  var c = rankColor(rank);
  return '<span class="rank-chip" style="background:' + c.bg + ';border-color:' + c.border + ';color:' + c.text + ';">' + esc(String(rank)) + '</span>';
}

// ── ITEM PRICE RANGE DETECTOR ────────────────────────────────
// Detects per-rank arrays of objects with consumable/weapon pricing fields
function isItemPriceRangeArray(data) {
  if (!Array.isArray(data) || !data.length) return false;
  var first = data[0];
  return first && (
    first.consumable_common_low !== undefined ||
    first.weapon_armor_common_low !== undefined ||
    first.consumable_effective_low !== undefined
  );
}

// ── HEALING COST DETECTOR ────────────────────────────────────
// Detects per-rank arrays with heal_pct field
function isHealingCostArray(data) {
  if (!Array.isArray(data) || !data.length) return false;
  var first = data[0];
  // healing_costs by_rank uses rate_pct + description (not income fields)
  return first && first.rate_pct !== undefined && first.description !== undefined &&
         first.rank !== undefined && first.annual_gross_low === undefined;
}

// ── ITEM PRICE RANGE RENDERER ────────────────────────────────
function iprFmt(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1e9)  return (n / 1e9).toFixed(n % 1e9 === 0 ? 0 : 1) + "B ₵";
  if (n >= 1e6)  return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 1) + "M ₵";
  if (n >= 1e3)  return Math.round(n / 1e3) + "K ₵";
  return Number(n).toLocaleString() + " ₵";
}

function iprRange(lo, hi) {
  if (lo !== undefined && lo !== null && hi !== undefined && hi !== null) {
    return '<span class="ipr-range-lo">' + iprFmt(lo) + '</span>'
      + '<span class="ipr-range-dash">–</span>'
      + '<span class="ipr-range-hi">' + iprFmt(hi) + '</span>';
  }
  if (lo !== undefined && lo !== null) return '<span class="ipr-range-hi">' + iprFmt(lo) + '</span>';
  if (hi !== undefined && hi !== null) return '<span class="ipr-range-hi">' + iprFmt(hi) + '</span>';
  return '<span class="ipr-range-lo">—</span>';
}

function renderItemPriceRanges(data, title) {
  if (!Array.isArray(data) || !data.length) return "";

  var out = title ? sectionTitle(title) : "";
  out += '<div class="ipr-grid">';

  for (var i = 0; i < data.length; i++) {
    var row  = data[i];
    var rank = row.rank || ("Rank " + (i + 1));
    var rc   = rankColor(rank);

    var conLo  = row.consumable_common_low,   conHi  = row.consumable_common_high;
    var conELo = row.consumable_effective_low, conEHi = row.consumable_effective_high;
    var wpnLo  = row.weapon_armor_common_low,  wpnHi  = row.weapon_armor_common_high;
    var wpnDur = row.weapon_durability_years;
    var wpnAnn = row.weapon_annual_cost;
    var wpnFnd = row.weapon_replacement_fund_annual;
    var hasConsumables = conLo !== null && conLo !== undefined;

    // ── STAT HEADER ──────────────────────────────────────────
    var stats = [];
    if (wpnDur !== undefined && wpnDur !== null) {
      stats.push({ label: "DURABILITY", val: wpnDur + " yr" + (wpnDur !== 1 ? "s" : ""), none: false });
    }
    if (wpnAnn !== undefined && wpnAnn !== null) {
      stats.push({ label: "ANNUAL COST", val: iprFmt(wpnAnn), none: false });
    }
    stats.push({ label: "CONSUMABLES", val: hasConsumables ? "Active" : "None", none: !hasConsumables });

    var statsHtml = "";
    for (var si = 0; si < stats.length; si++) {
      statsHtml += '<div class="ipr-stat">'
        + '<span class="ipr-stat-label">' + stats[si].label + '</span>'
        + '<span class="ipr-stat-val' + (stats[si].none ? ' ipr-stat-none' : '') + '">' + esc(stats[si].val) + '</span>'
        + '</div>';
    }

    var html = '<div class="ipr-rank-header" style="background:linear-gradient(135deg,' + rc.bg + ' 0%,transparent 100%);">'
      + '<div class="ipr-header-left">' + rankBadge(rank) + '</div>'
      + '<div class="ipr-header-stats">' + statsHtml + '</div>'
      + '</div>';

    // ── WEAPONS & ARMOR ───────────────────────────────────────
    if (wpnLo !== undefined || wpnHi !== undefined) {
      html += '<div class="ipr-group ipr-group-wpn">'
        + '<div class="ipr-group-label">Weapons &amp; Armor</div>'
        + '<div class="ipr-price-row">'
        + '<span class="ipr-price-key">Common price</span>'
        + '<span class="ipr-price-val">' + iprRange(wpnLo, wpnHi) + '</span>'
        + '</div>';
      if (wpnAnn !== undefined && wpnAnn !== null) {
        html += '<div class="ipr-price-row ipr-price-sub">'
          + '<span class="ipr-price-key">Annual cost</span>'
          + '<span class="ipr-price-val"><span class="ipr-range-hi">' + iprFmt(wpnAnn) + '</span></span>'
          + '</div>';
      }
      if (wpnFnd !== undefined && wpnFnd !== null) {
        html += '<div class="ipr-price-row ipr-price-sub">'
          + '<span class="ipr-price-key">Replacement fund</span>'
          + '<span class="ipr-price-val ipr-fund-val">' + iprFmt(wpnFnd) + '/yr</span>'
          + '</div>';
      }
      html += '</div>';
    }

    // ── CONSUMABLES ───────────────────────────────────────────
    if (hasConsumables) {
      html += '<div class="ipr-group">'
        + '<div class="ipr-group-label">Consumables</div>'
        + '<div class="ipr-price-row">'
        + '<span class="ipr-price-key">Common price</span>'
        + '<span class="ipr-price-val">' + iprRange(conLo, conHi) + '</span>'
        + '</div>';
      if (conELo !== undefined && conELo !== null && conEHi !== undefined && conEHi !== null) {
        html += '<div class="ipr-price-row ipr-price-sub">'
          + '<span class="ipr-price-key">Effective spend</span>'
          + '<span class="ipr-price-val"><span class="ipr-range-lo">' + iprFmt(conELo) + '</span>'
          + '<span class="ipr-range-dash">–</span>'
          + '<span class="ipr-range-hi">' + iprFmt(conEHi) + '</span></span>'
          + '</div>';
      }
      html += '</div>';
    }

    // ── LORE ─────────────────────────────────────────────────
    if (row.lore) {
      html += '<div class="ipr-lore"><div class="ipr-lore-text">' + esc(row.lore) + '</div></div>';
    }
    if (row.notes && showAuthorNotes) {
      html += '<div class="econ-author-note" style="margin:0;border-radius:0;"><span class="econ-author-tag">✎ Author</span>' + esc(row.notes) + '</div>';
    }

    out += '<div class="ipr-card" style="border-top-color:' + rc.border + ';">' + html + '</div>';
  }

  out += '</div>';
  return out;
}

// ── HEALING COST RENDERER ────────────────────────────────────
function renderHealingCosts(data, title) {
  if (!Array.isArray(data) || !data.length) return "";
  var out = title ? sectionTitle(title) : "";
  out += '<div class="heal-grid">';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rank = row.rank || ("Rank " + (i + 1));
    var rc = rankColor(rank);
    var pct = row.rate_pct !== undefined ? row.rate_pct : null;

    var html = '<div class="heal-card-header" style="border-color:' + rc.border + ';background:' + rc.bg + ';">'
      + rankBadge(rank);
    if (pct !== null) {
      html += '<div class="heal-pct-pill" style="color:' + rc.text + ';border-color:' + rc.border + ';background:' + rc.bg + ';">'
        + '<span class="heal-pct-val">' + esc(String(pct)) + '%</span>'
        + '<span class="heal-pct-label">of net</span>'
        + '</div>';
    }
    html += '</div>';

    if (row.description) {
      html += '<div class="heal-desc">' + esc(row.description) + '</div>';
    }
    if (row.lore) {
      html += '<div class="econ-lore" style="margin:8px 0 0;">' + esc(row.lore) + '</div>';
    }
    if (row.notes && showAuthorNotes) {
      html += '<div class="econ-author-note" style="margin:4px 0 0;"><span class="econ-author-tag">✎ Author</span>' + esc(row.notes) + '</div>';
    }

    out += '<div class="heal-card" style="border-top-color:' + rc.border + ';">' + html + '</div>';
  }

  out += '</div>';
  return out;
}

// Detect best layout for unknown data
function detectLayout(data) {
  if (Array.isArray(data)) {
    if (!data.length) return "empty";
    if (isItemPriceRangeArray(data)) return "item_price_ranges";
    if (isHealingCostArray(data))    return "healing_costs";
    if (data.every(function(d) { return isPlain(d); })) return "list";
    var first = data[0];
    if (typeof first === "object" && first !== null) {
      var keys = Object.keys(first);
      // If objects have sub-arrays or nested objects → cards
      for (var i = 0; i < keys.length; i++) {
        var v = first[keys[i]];
        if (Array.isArray(v) && v.length > 0) return "cards";
        if (typeof v === "object" && v !== null && !isPlain(v)) return "cards";
      }
      // If has label + value-like fields → cards
      if (first.label && (first.value !== undefined || first.price !== undefined || first.monthly !== undefined)) {
        return "cards";
      }
      return "table";
    }
    return "list";
  }
  if (typeof data === "object" && data !== null) {
    if (hasIncomeFields(data)) return "income_card";
    if (getNoteField(data) && hasArrayProperty(data)) return "note_section";
    if (Object.keys(data).length <= 6 && Object.values(data).every(isPlain)) return "kv";
    return "nested";
  }
  return "text";
}

// Render any data with auto-detected layout
function renderAny(data, title, opts) {
  opts = opts || {};
  var layout = opts.forceLayout || detectLayout(data);
  switch (layout) {
    case "table":    return renderAutoTable(data, title, opts);
    case "cards":    return renderAutoCards(data, title, opts);
    case "kv":       return renderKeyValue(data, title);
    case "income_card": return renderIncomeCard(data);
    case "note_section": return renderNoteSection(data, title);
    case "item_price_ranges": return renderItemPriceRanges(data, title);
    case "healing_costs": return renderHealingCosts(data, title);
    case "nested":   return renderNestedObject(data, title);
    case "list":     return renderList(data, title);
    case "text":     return data ? div("econ-callout", esc(String(data))) : "";
    case "empty":    return div("no-results", "-- No data --");
    default:         return renderAutoTable(data, title, opts);
  }
}

// Auto-detect columns for table rendering
function detectColumns(data) {
  if (!Array.isArray(data) || !data.length) return [];
  var first = data[0];
  if (typeof first !== "object" || first === null) return ["value"];
  var keys = Object.keys(first);
  // Skip internal/utility keys and raw _low/_high numeric pairs (shown via display fields)
  return keys.filter(function(k) {
    return k[0] !== "_" && k !== "id" && !/_low$/.test(k) && !/_high$/.test(k) && !/_pct$/.test(k);
  });
}

// Format a raw field value for display in a table cell
// Handles auto-pairing of *_low/*_high sibling fields into "X–Y" range strings
function fmtCellValue(row, field) {
  var val = row[field];
  // If the field itself is a display string (contains spaces, ₵, ◈, etc.) return as-is
  if (val !== null && val !== undefined) {
    var str = String(val);
    if (str === "" || str === "null" || str === "undefined") return "—";
    return str;
  }
  // Try auto-pairing: if field ends in _display, look for it; otherwise try _low/_high
  var lowKey = field + "_low", highKey = field + "_high";
  if (row[lowKey] !== undefined || row[highKey] !== undefined) {
    var lo = row[lowKey], hi = row[highKey];
    if (lo !== null && lo !== undefined && hi !== null && hi !== undefined) {
      return Number(lo).toLocaleString() + "–" + Number(hi).toLocaleString() + " ₵";
    }
    if (lo !== null && lo !== undefined) return Number(lo).toLocaleString() + " ₵";
    if (hi !== null && hi !== undefined) return Number(hi).toLocaleString() + " ₵";
  }
  return "—";
}

// Render array of objects as auto-detected table
function renderAutoTable(data, title, opts) {
  opts = opts || {};
  if (!Array.isArray(data) || !data.length) return "";
  var fields = opts.fields || detectColumns(data);
  if (!fields.length) return "";

  // Mobile card mode: if viewport is narrow and table has many columns or long notes
  var isMobile = typeof window !== "undefined" && window.innerWidth <= 480;
  var hasWideNotes = fields.some(function(f) {
    return f === "notes" || f === "description" || f === "note" || f === "buyer_pool";
  });
  var useCards = isMobile && (fields.length >= 4 || hasWideNotes);

  if (useCards) {
    return renderAutoCards(data, title);
  }

  // Build column widths based on field name semantics
  // Build column widths based on field name semantics
  var firstRow = data[0];
  var cols = fields.map(function(f, i) {
    if (i === 0) return "minmax(60px, max-content)";
    if (f === "notes" || f === "description" || f === "note" || f === "buyer_pool") return "minmax(140px, 2.5fr)";
    // Display/range fields tend to be medium width
    if (/_display$/.test(f) || /_price$/.test(f) || /_yield$/.test(f)) return "minmax(90px, 1fr)";
    var val = firstRow[f];
    var str = val !== null && val !== undefined ? String(val) : fmtCellValue(firstRow, f);
    if (str.length > 40) return "minmax(100px, 1.5fr)";
    if (str.length < 10) return "minmax(60px, max-content)";
    return "minmax(80px, 1fr)";
  }).join(" ");

  var out = title ? sectionTitle(title) : "";
  out += '<div class="table-wrap" onscroll="this.classList.toggle(\'can-scroll\', this.scrollLeft < (this.scrollWidth - this.clientWidth - 5))"><div class="gen-table" style="grid-template-columns:' + cols + '">';

  // Headers
  for (var fi = 0; fi < fields.length; fi++) {
    out += '<div class="gen-cell gen-header">' + esc(fields[fi].replace(/[_-]/g, " ")) + '</div>';
  }
  // Rows
  for (var ri = 0; ri < data.length; ri++) {
    var row = data[ri];
    if (typeof row !== "object" || row === null) continue;
    for (var fj = 0; fj < fields.length; fj++) {
      var f = fields[fj];
      var str = fmtCellValue(row, f);
      var isFirst = fj === 0;
      var isNote  = (f === "notes" || f === "description" || f === "note" || f === "buyer_pool") && fj === fields.length - 1;
      var cls = "gen-cell" + (isFirst ? " gen-rank" : isNote ? " gen-note" : " gen-val");
      var inner;
      if (isNote) {
        inner = str !== "—" ? '<em>' + esc(str) + '</em>' : '—';
      } else if (isFirst) {
        inner = esc(str);
      } else {
        inner = cVal(str);
      }
      out += '<div class="' + cls + '">' + inner + '</div>';
    }
  }
  out += '</div></div>';
  return out;
}

// Render array of objects as cards
// ── OP EXPENSE LEDGER CARD ───────────────────────────────────
function isOpExpenseItem(item) {
  return item && item.rate_pct !== undefined && item.gear_repair_pct !== undefined;
}

function renderOpExpenseCard(item) {
  var rank = item.rank || "—";
  var ratePct = item.rate_pct !== undefined ? item.rate_pct : "—";
  var html = '<div class="op-card-header">'
    + '<span class="op-card-rank">' + esc(rank) + '-Rank</span>'
    + '<span class="op-card-rate"><span class="op-card-rate-val">' + esc(String(ratePct)) + '%</span> of post-living net</span>'
    + '</div>';

  // Ledger
  var rows = [
    { label: "Gear Repair",   pct: item.gear_repair_pct,  amt: item.gear_repair_low,  cls: "" },
    { label: "Transport",     pct: item.transport_pct,     amt: item.transport_low,    cls: "" },
    { label: "Weapon Fund",   pct: item.weapon_fund_pct,   amt: item.weapon_fund_low,  cls: "op-ledger-weapon" },
  ];

  html += '<div class="op-ledger-header">'
    + '<span>Allocation</span><span>%</span><span>Annual (low)</span>'
    + '</div>';

  for (var ri = 0; ri < rows.length; ri++) {
    var row = rows[ri];
    var pctStr = row.pct !== undefined ? row.pct + "%" : "—";
    var amtStr = row.amt !== undefined ? Number(row.amt).toLocaleString() + " ₵" : "—";
    html += '<div class="op-ledger-row ' + row.cls + '">'
      + '<span class="op-ledger-label">' + esc(row.label) + '</span>'
      + '<span class="op-ledger-pct">' + esc(pctStr) + '</span>'
      + '<span class="op-ledger-amt">' + esc(amtStr) + '</span>'
      + '</div>';
  }

  // Lore quote
  if (item.op_expense_lore) {
    html += '<div class="op-lore-quote"><div class="op-lore-quote-text">' + esc(item.op_expense_lore) + '</div></div>';
  }

  // Author note (toggle gated)
  if (item.op_expense_author_note && showAuthorNotes) {
    html += '<div class="op-author-note"><span class="op-author-tag">✎ AUTHOR</span>' + esc(item.op_expense_author_note) + '</div>';
  }

  return div("econ-card", html);
}

// Render array of objects as cards
function renderAutoCards(data, title) {
  if (!Array.isArray(data) || !data.length) return "";
  var out = title ? sectionTitle(title) : "";
  out += '<div class="econ-cards">';
  for (var i = 0; i < data.length; i++) {
    var item = data[i];
    if (typeof item !== "object" || item === null) continue;

    // Op-expense items get the ledger card renderer
    if (isOpExpenseItem(item)) {
      out += renderOpExpenseCard(item);
      continue;
    }

    var label = item.label || item.name || item.tier || item.rank || item.category || item.type || ("Item " + (i+1));
    var html = '<div class="econ-card-label">' + esc(label) + '</div>';

    // Find a value to highlight
    var valKeys = ["fee_display", "fee", "price", "value", "monthly", "rate", "rate_pct", "combined_placeholder_pct"];
    var highlighted = false;
    for (var vi = 0; vi < valKeys.length; vi++) {
      if (item[valKeys[vi]] !== undefined && item[valKeys[vi]] !== null) {
        html += '<div class="econ-highlight">' + cVal(String(item[valKeys[vi]])) + '</div>';
        highlighted = true;
        break;
      }
    }

    // Render remaining simple fields
    var keys = Object.keys(item);
    for (var ki = 0; ki < keys.length; ki++) {
      var k = keys[ki];
      if (k === "label" || k === "name" || k === "tier" || k === "rank" || k === "category" || k === "type") continue;
      if (k[0] === "_") continue;
      var v = item[k];
      // Lore fields — always render, then skip normal kv rendering
      if (k === "lore" || k === "species_lore" || k === "regen_lore" || k === "consumables_lore" || k === "op_expense_lore") {
        html += '<div class="econ-card-note econ-lore">' + esc(String(v)) + '</div>';
        continue;
      }
      // Author note fields — render only if toggle on, then skip
      if (k === "notes" || k === "species_author_note" || k === "regen_author_note" || k === "consumables_author_note" || k === "op_expense_author_note") {
        if (showAuthorNotes) html += '<div class="econ-card-note econ-author-note"><span class="econ-author-tag">✎ Author</span> ' + esc(String(v)) + '</div>';
        continue;
      }
      if (isPlain(v) && !(highlighted && valKeys.indexOf(k) >= 0)) {
        if (k === "description") {
          html += '<div class="econ-card-note">' + esc(String(v)) + '</div>';
        } else {
          html += '<div class="econ-card-vals"><span>' + esc(k.replace(/[_-]/g, " ")) + ': ' + cVal(String(v)) + '</span></div>';
        }
      } else if (Array.isArray(v) && v.length && typeof v[0] === "object") {
        // Nested sub-table inside card
        html += '<div style="margin-top:8px;border-top:1px solid var(--econ-border2);padding-top:8px;">';
        html += renderAutoTable(v, null, {forceLayout: "table"});
        html += '</div>';
      }
    }
    out += div("econ-card", html);
  }
  out += '</div>';
  return out;
}

// Render flat object as key-value grid
function renderKeyValue(obj, title) {
  if (!obj || typeof obj !== "object") return "";
  var out = title ? sectionTitle(title) : "";
  var AUTHOR_KEYS = ["notes", "regen_author_note", "consumables_author_note", "species_author_note", "op_expense_author_note"];
  var LORE_KEYS   = ["lore", "regen_lore", "consumables_lore", "species_lore", "op_expense_lore"];
  out += '<div class="kv-grid">';
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k[0] === "_") continue;
    // Author-only fields — skip unless toggle on
    if (AUTHOR_KEYS.indexOf(k) !== -1 && !showAuthorNotes) continue;
    var v = obj[k];
    if (!isPlain(v)) continue;
    var str = v !== null && v !== undefined ? String(v) : "—";
    // Lore fields — render as styled banner outside the kv-grid
    if (LORE_KEYS.indexOf(k) !== -1) {
      out += '</div><div class="info-banner econ-lore">' + esc(str) + '</div><div class="kv-grid">';
      continue;
    }
    // Author fields (only if toggle on)
    if (AUTHOR_KEYS.indexOf(k) !== -1) {
      out += '</div><div class="info-banner econ-author-note"><span class="econ-author-tag">✎ Author</span>' + esc(str) + '</div><div class="kv-grid">';
      continue;
    }
    var isLong = str.length > 60;
    out += '<div class="kv-row' + (isLong ? ' kv-stacked' : '') + '"><span class="kv-key">' + esc(k.replace(/[_-]/g, " ")) + '</span>';
    out += '<span class="kv-val">' + cVal(str) + '</span></div>';
  }
  out += '</div>';
  return out;
}

// Render income-style object as card
function renderIncomeCard(obj) {
  if (!obj || typeof obj !== "object") return "";
  if (obj.narrative_ceiling_note && obj.annual_gross_low === null && obj.annual_gross_high === null) {
    return div("econ-card",
      '<div class="econ-card-label">' + esc(obj.label || obj.rank || "S-rank") + '</div>' +
      '<div class="econ-card-note" style="font-style:italic;">' + esc(obj.narrative_ceiling_note) + '</div>'
    );
  }
  var html = '';
  if (obj.label) html += '<div class="econ-card-label">' + esc(obj.label) + '</div>';

  // Daily
  if (obj.daily !== undefined) {
    html += '<div class="econ-card-vals"><span>' + cVal(fmtN(obj.daily)) + '/day</span></div>';
  } else if (obj.daily_low !== undefined) {
    html += '<div class="econ-card-vals"><span>' + cVal(fmtN(obj.daily_low) + " – " + fmtN(obj.daily_high)) + '/day</span></div>';
  }
  // Monthly
  if (obj.monthly !== undefined) {
    html += '<div class="econ-card-vals"><span>' + cVal(fmtN(obj.monthly)) + '/mo</span></div>';
  } else if (obj.monthly_low !== undefined) {
    html += '<div class="econ-card-vals"><span>' + cVal(fmtN(obj.monthly_low) + " – " + fmtN(obj.monthly_high)) + '/mo</span></div>';
  }
  // Annual
  if (obj.annual !== undefined) {
    html += '<div class="econ-highlight">' + cVal(fmtN(obj.annual)) + '/yr</div>';
    if (showUSD) html += '<span class="econ-usd-ref">' + fmtUSD(obj.annual) + '</span>';
  } else if (obj.annual_low !== undefined) {
    html += '<div class="econ-highlight">' + cVal(fmtN(obj.annual_low) + " – " + fmtN(obj.annual_high)) + '/yr</div>';
    if (showUSD && obj.annual_low) html += '<span class="econ-usd-ref">' + fmtUSD(obj.annual_low) + ' – ' + fmtUSD(obj.annual_high) + '</span>';
  }
  // Corebearer extended
  if (obj.annual_gross_low !== undefined) {
    html += '<div class="econ-card-vals" style="margin-top:6px;">';
    html += '<span style="font-size:10px;color:var(--econ-muted);">GROSS</span> ' + cVal(fmtN(obj.annual_gross_low) + " – " + fmtN(obj.annual_gross_high)) + '/yr</div>';
  }
  if (obj.annual_net_low !== undefined) {
    html += '<div class="econ-card-vals">';
    html += '<span style="font-size:10px;color:var(--econ-muted);">NET</span> ' + cVal(fmtN(obj.annual_net_low) + " – " + fmtN(obj.annual_net_high)) + '/yr</div>';
  }
  if (obj.annual_spendable_low !== undefined) {
    html += '<div class="econ-highlight">' + cVal(fmtN(obj.annual_spendable_low) + " – " + fmtN(obj.annual_spendable_high)) + '/yr spendable</div>';
    if (showUSD && obj.annual_spendable_low) html += '<span class="econ-usd-ref">' + fmtUSD(obj.annual_spendable_low) + ' – ' + fmtUSD(obj.annual_spendable_high) + '</span>';
  }
  // Notes / Lore
  if (obj.lore) html += '<div class="econ-card-note econ-lore">' + esc(obj.lore) + '</div>';
  if (obj.notes && showAuthorNotes) html += '<div class="econ-card-note econ-author-note"><span class="econ-author-tag">✎ Author</span> ' + esc(obj.notes) + '</div>';
  // Description (for dormant)
  if (obj.description) html += '<div class="econ-card-note">' + esc(obj.description) + '</div>';

  // Living cost breakdown
  if (obj.living_cost_breakdown && typeof obj.living_cost_breakdown === "object") {
    var lcb = obj.living_cost_breakdown;
    var lcbKeys = Object.keys(lcb).filter(function(k){ return k[0] !== "_" && isPlain(lcb[k]); });
    if (lcbKeys.length) {
      html += '<div style="margin-top:8px;border-top:1px solid var(--econ-border2);padding-top:6px;">';
      html += '<div style="font-size:10px;color:var(--econ-muted);margin-bottom:4px;">LIVING COSTS</div>';
      html += '<div class="kv-grid" style="grid-template-columns:1fr 1fr">';
      for (var li = 0; li < lcbKeys.length; li++) {
        var lk = lcbKeys[li];
        html += '<div class="kv-row"><span class="kv-key">' + esc(lk) + '</span>';
        html += '<span class="kv-val">' + cVal(String(lcb[lk])) + '</span></div>';
      }
      html += '</div></div>';
    }
  }

  return div("econ-card", html);
}

// Render object with _note + sub-arrays (tax_structure, healing_costs, etc.)
function renderNoteSection(obj, title) {
  if (!obj || typeof obj !== "object") return "";
  var note = getNoteField(obj);
  var out = title ? sectionTitle(title) : "";

  if (note) {
    out += '<div class="info-banner"><em>Note</em>' + esc(note) + '</div>';
  }

  // Render each sub-array or sub-object
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k[0] === "_" || k === "notes") continue;
    // Author-only fields — skip unless toggle is on
    if ((k === "regen_author_note" || k === "consumables_author_note" || k === "species_author_note" || k === "op_expense_author_note") && !showAuthorNotes) continue;
    // Lore fields — always show, styled as lore
    var isLoreField = (k === "regen_lore" || k === "consumables_lore" || k === "species_lore" || k === "op_expense_lore");
    var v = obj[k];
    if (isPlain(v)) {
      var noteClass = isLoreField ? "info-banner econ-lore" : (showAuthorNotes && (k === "regen_author_note" || k === "consumables_author_note") ? "info-banner econ-author-note" : "");
      if (isLoreField || typeof v === "string") {
        out += '<div class="' + (noteClass || "info-banner") + '">' + (isLoreField ? '' : '<em>' + esc(k.replace(/[_-]/g," ")) + '</em>') + esc(String(v)) + '</div>';
      } else {
        out += '<div class="kv-grid"><div class="kv-row"><span class="kv-key">' + esc(k.replace(/[_-]/g, " ")) + '</span>';
        out += '<span class="kv-val">' + cVal(String(v)) + '</span></div></div>';
      }
    } else if (Array.isArray(v) && v.length && typeof v[0] === "object") {
      out += renderAny(v, k.replace(/[_-]/g, " "));
    } else if (typeof v === "object" && v !== null) {
      // Check if it's a flat descriptor object
      var subKeys = Object.keys(v);
      var isFlat = subKeys.every(function(sk) { return isPlain(v[sk]); });
      if (isFlat && subKeys.length <= 6) {
        out += renderKeyValue(v, k.replace(/[_-]/g, " "));
      } else {
        out += renderAny(v, k.replace(/[_-]/g, " "));
      }
    }
  }
  return out;
}

// Render nested object
function renderNestedObject(obj, title) {
  if (!obj || typeof obj !== "object") return "";
  var note = getNoteField(obj);
  var out = title ? sectionTitle(title) : "";
  if (note) {
    out += '<div class="info-banner"><em>Note</em>' + esc(note) + '</div>';
  }
  var keys = Object.keys(obj);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (k[0] === "_" || k === "notes") continue;
    var v = obj[k];
    out += renderAny(v, k.replace(/[_-]/g, " "));
  }
  return out;
}

// Render simple list
function renderList(data, title) {
  if (!Array.isArray(data) || !data.length) return "";
  var out = title ? sectionTitle(title) : "";
  out += '<div class="kv-grid">';
  for (var i = 0; i < data.length; i++) {
    out += '<div class="kv-row"><span class="kv-val">' + esc(String(data[i])) + '</span></div>';
  }
  out += '</div>';
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  SPECIALIZED PANEL BUILDERS
// ═══════════════════════════════════════════════════════════════

// ── TIERS PANEL ──────────────────────────────────────────────
function buildTiersPanel() {
  if (!CURR_CFG || !CURR_CFG.tiers) return div("no-results", "-- No currency tiers defined --");
  var out = '';

  out += div("econ-anchor",
    '<span class="econ-anchor-label">Credit Anchor</span>' +
    '<span class="econ-anchor-val cs-cred">1 ₵ Credit</span>' +
    (showUSD ? '<span class="econ-anchor-converted">' + fmtUSD(1) + '</span>' : '')
  );
  if (CURR_CFG.ap_credit_rate) {
    out += div("econ-anchor econ-anchor-ap",
      '<span class="econ-anchor-label">AP Conversion (LMCA)</span>' +
      '<span class="econ-anchor-val cs-ap">1 AP = ' + CURR_CFG.ap_credit_rate + ' ₵</span>' +
      (showUSD ? '<span class="econ-anchor-converted">$' + (CURR_CFG.ap_credit_rate * (CURR_CFG.credit_usd||0.5)).toFixed(2) + '</span>' : '')
    );
  }

  out += '<div class="currency-grid">';
  for (var ti = 0; ti < CURR_CFG.tiers.length; ti++) {
    var t = CURR_CFG.tiers[ti];
    if (state.editingTier === t.id) { out += buildTierEditor(t); continue; }
    var symClass = ti === 0 ? "cs-cred" : ti === 1 ? "cs-low" : ti === 2 ? "cs-core" : "cs-void";
    var html = '<div class="currency-header">' +
      '<span class="currency-symbol ' + symClass + '">' + esc(t.symbol) + '</span>' +
      '<span class="currency-name">' + esc(t.name) + '</span>' +
      '<span class="currency-range">' + esc(t.rank_range) + '</span>' +
      '<button class="mkt-btn-sm tier-edit-btn" data-tierid="' + esc(t.id) + '">&#9998;</button>' +
      '</div>';
    if (t.locked) html += '<span class="currency-locked-tag">NOT IN CIRCULATION</span>';
    html += '<div class="currency-desc">' + esc(t.description) + '</div>';
    if (t.grades && t.grades.length) {
      html += '<div class="currency-grades">';
      for (var gi = 0; gi < t.grades.length; gi++) {
        var g = t.grades[gi];
        html += '<div class="currency-grade"><span>' + esc(g.grade) + '</span>' +
          '<span class="grade-val ' + symClass + '">' + esc(g.value_credits) + '</span>' +
          (g.source ? '<span class="grade-source">' + esc(g.source) + '</span>' : '') + '</div>';
      }
      html += '</div>';
    }
    if (t.examples && t.examples.length) {
      html += '<div class="currency-examples">';
      for (var ei = 0; ei < t.examples.length; ei++) {
        var ex = t.examples[ei];
        html += '<div class="currency-ex"><span>' + esc(ex.item) + '</span>' +
          '<span class="ex-price">' + esc(ex.price) + '</span></div>';
      }
      html += '</div>';
    }
    out += div("currency-card" + (t.locked ? " currency-locked-card" : ""), html);
  }
  out += '</div>';
  return out;
}

function buildTierEditor(tier) {
  var gradesHtml = (tier.grades || []).map(function(g, gi) {
    return '<div class="te-grade-row">' +
      '<input class="sf-input te-grade" data-gi="' + gi + '" data-field="grade" value="' + esc(g.grade) + '" placeholder="Grade">' +
      '<input class="sf-input te-grade te-grade-val" data-gi="' + gi + '" data-field="value_credits" value="' + esc(g.value_credits) + '" placeholder="Value in credits">' +
      '</div>';
  }).join('');
  var exHtml = (tier.examples || []).map(function(ex, ei) {
    return '<div class="te-grade-row">' +
      '<input class="sf-input te-grade" data-ei="' + ei + '" data-field="item" value="' + esc(ex.item) + '" placeholder="Item">' +
      '<input class="sf-input te-grade te-grade-val" data-ei="' + ei + '" data-field="price" value="' + esc(ex.price) + '" placeholder="Price">' +
      '</div>';
  }).join('');
  return '<div class="currency-card currency-edit-card"><div class="tier-editor">' +
    '<div class="te-row"><label class="sf-label">Symbol</label><input class="sf-input" id="te-sym" value="' + esc(tier.symbol) + '"></div>' +
    '<div class="te-row"><label class="sf-label">Name</label><input class="sf-input" id="te-name" value="' + esc(tier.name) + '"></div>' +
    '<div class="te-row"><label class="sf-label">Rank Range</label><input class="sf-input" id="te-range" value="' + esc(tier.rank_range) + '"></div>' +
    '<div class="te-row"><label class="sf-label">Description</label><textarea class="sf-textarea" id="te-desc" rows="2">' + esc(tier.description) + '</textarea></div>' +
    '<div class="te-row"><label class="sf-label"><input type="checkbox" id="te-locked"' + (tier.locked ? ' checked' : '') + '> Locked</label></div>' +
    '<div class="sf-section-title">Grades</div>' + gradesHtml +
    '<div class="sf-section-title">Examples</div>' + exHtml +
    '<div class="sf-actions">' +
    '<button class="mkt-btn mkt-btn-active" id="te-save" data-tierid="' + esc(tier.id) + '">Save</button>' +
    '<button class="mkt-btn" id="te-cancel">Cancel</button>' +
    '</div></div></div>';
}

// ── CONVERSION PANEL ─────────────────────────────────────────
function buildConversionPanel() {
  var out = '<div class="conv-header-row">' +
    '<span class="econ-panel-subtitle">Exchange Rates — editing propagates to all tabs</span>' +
    '<button class="mkt-btn" id="btn-add-currency">+ Add Currency</button>' +
    '</div>';
  if (state.newCurrency) out += buildNewCurrencyForm();

  // Conversion table
  if (CURR_CFG && CURR_CFG.conversion_table && CURR_CFG.conversion_table.length) {
    out += '<div class="conv-editor-table">';
    out += '<div class="conv-ed-header">' +
      '<span class="conv-ed-currency">Currency</span>' +
      '<span class="conv-ed-rate">Rate (in ₵)</span>' +
      (showUSD ? '<span class="conv-ed-usd">≈ USD</span>' : '') +
      '<span class="conv-ed-actions"></span></div>';
    for (var ci = 0; ci < CURR_CFG.conversion_table.length; ci++) {
      var row = CURR_CFG.conversion_table[ci];
      var symClass = currClass(row.symbol || row.code);
      if (state.editingConv === row.code) {
        out += buildConvEditor(row, symClass);
      } else {
        var rateVal = row.to_credits || row.rate;
        out += '<div class="conv-ed-row" data-code="' + esc(row.code) + '">' +
          '<span class="conv-ed-currency"><strong class="' + symClass + '">' + esc(row.code) + '</strong> <span class="conv-ed-name">' + esc(row.name || "") + '</span></span>' +
          '<span class="conv-ed-rate-val ' + symClass + '">' + esc(String(rateVal)) + ' ₵</span>' +
          (showUSD ? '<span class="conv-ed-usd-val">' + fmtUSD(parseFloat(rateVal)||1) + '</span>' : '') +
          '<span class="conv-ed-actions">' +
          '<button class="mkt-btn-sm conv-edit-btn" data-code="' + esc(row.code) + '">&#9998;</button>' +
          (row.code !== "CRED" ? '<button class="mkt-btn-sm conv-del-btn danger" data-code="' + esc(row.code) + '">&#10005;</button>' : '') +
          '</span></div>';
      }
    }
    out += '</div>';
  }

  // AP rate
  if (CURR_CFG && CURR_CFG.ap_credit_rate !== undefined) {
    out += sectionTitle("Academy Point Rate", "var(--econ-amber)");
    out += '<div class="conv-editor-table">';
    if (state.editingConv === "AP") {
      out += '<div class="conv-ed-row conv-editing">' +
        '<span class="conv-ed-currency"><strong class="cs-ap">AP</strong> <span class="conv-ed-name">Academy Points (LMCA)</span></span>' +
        '<input class="sf-input conv-rate-input" id="ce-rate" type="number" step="0.5" min="1" value="' + CURR_CFG.ap_credit_rate + '">' +
        (showUSD ? '<span class="conv-ed-usd-val" id="ce-usd">$' + (CURR_CFG.ap_credit_rate*(CURR_CFG.credit_usd||0.5)).toFixed(2) + '</span>' : '') +
        '<span class="conv-ed-actions">' +
        '<button class="mkt-btn-sm mkt-btn-active" id="ce-save" data-code="AP">&#10003;</button>' +
        '<button class="mkt-btn-sm" id="ce-cancel">&#10005;</button>' +
        '</span></div>';
    } else {
      out += '<div class="conv-ed-row">' +
        '<span class="conv-ed-currency"><strong class="cs-ap">AP</strong> <span class="conv-ed-name">Academy Points (LMCA)</span></span>' +
        '<span class="conv-ed-rate-val cs-ap">1 AP = ' + CURR_CFG.ap_credit_rate + ' ₵</span>' +
        (showUSD ? '<span class="conv-ed-usd-val">$' + (CURR_CFG.ap_credit_rate*(CURR_CFG.credit_usd||0.5)).toFixed(2) + '</span>' : '') +
        '<span class="conv-ed-actions"><button class="mkt-btn-sm conv-edit-btn" data-code="AP">&#9998;</button></span>' +
        '</div>';
    }
    out += '</div>';
  }

  // Conversion reference
  if (CURR_CFG && CURR_CFG.conversion_reference && CURR_CFG.conversion_reference.length) {
    out += sectionTitle("Conversion Reference", "var(--econ-amber)");
    out += renderAutoTable(CURR_CFG.conversion_reference, null, {
      fields: detectColumns(CURR_CFG.conversion_reference)
    });
  }

  out += sectionTitle("Cross-Reference Matrix", "var(--econ-amber)");
  out += buildCrossReference();
  return out;
}

function buildNewCurrencyForm() {
  return '<div class="new-currency-form">' +
    '<div class="te-row"><label class="sf-label">Code</label><input class="sf-input" id="nc-code" placeholder="e.g. SOL"></div>' +
    '<div class="te-row"><label class="sf-label">Name</label><input class="sf-input" id="nc-name" placeholder="e.g. Solari"></div>' +
    '<div class="te-row"><label class="sf-label">Value in Credits (1 unit = ? ₵)</label><input class="sf-input" id="nc-rate" type="number" step="1" placeholder="e.g. 10000"></div>' +
    '<div class="sf-actions">' +
    '<button class="mkt-btn mkt-btn-active" id="nc-save">Add</button>' +
    '<button class="mkt-btn" id="nc-cancel">Cancel</button>' +
    '</div></div>';
}

function buildConvEditor(row, symClass) {
  var rateVal = parseFloat(row.to_credits || row.rate) || 1;
  return '<div class="conv-ed-row conv-editing">' +
    '<span class="conv-ed-currency"><strong class="' + (symClass||'cs-default') + '">' + esc(row.code) + '</strong></span>' +
    '<input class="sf-input conv-rate-input" id="ce-rate" type="number" step="1" min="1" value="' + rateVal + '">' +
    (showUSD ? '<span class="conv-ed-usd-val" id="ce-usd">' + fmtUSD(rateVal) + '</span>' : '') +
    '<span class="conv-ed-actions">' +
    '<button class="mkt-btn-sm mkt-btn-active" id="ce-save" data-code="' + esc(row.code) + '">&#10003;</button>' +
    '<button class="mkt-btn-sm" id="ce-cancel">&#10005;</button>' +
    '</span></div>';
}

function buildCrossReference() {
  var table = CURR_CFG.conversion_table;
  if (!table || table.length < 2) return div("no-results", "Add at least 2 currencies for cross-reference");
  var n = table.length;
  var out = '<div class="xref-table" style="--xref-cols:' + n + '"><div class="xref-row xref-header"><span class="xref-cell xref-corner">From \\ To</span>';
  for (var hi = 0; hi < n; hi++) out += '<span class="xref-cell xref-head ' + currClass(table[hi].code) + '">' + esc(table[hi].code) + '</span>';
  out += '</div>';
  for (var fi = 0; fi < n; fi++) {
    var from = table[fi]; var fromRate = parseFloat(from.to_credits||from.rate)||1;
    out += '<div class="xref-row"><span class="xref-cell xref-from ' + currClass(from.code) + '">' + esc(from.code) + '</span>';
    for (var ti2 = 0; ti2 < n; ti2++) {
      var to = table[ti2]; var toRate = parseFloat(to.to_credits||to.rate)||1;
      if (fi === ti2) { out += '<span class="xref-cell xref-same">—</span>'; continue; }
      var cr = fromRate / toRate;
      var d = cr < 0.01 ? cr.toExponential(2) : cr < 1 ? cr.toFixed(4) : cr < 100 ? cr.toFixed(2) : cr.toFixed(0);
      out += '<span class="xref-cell">' + d + '</span>';
    }
    out += '</div>';
  }
  out += '</div>';
  return out;
}

// ── WAGES PANEL ──────────────────────────────────────────────
function buildWagesPanel() {
  if (!ECON_CFG) return div("no-results", "-- Economy config not loaded --");
  var out = sectionTitle("Wages & Income", "#9098a8") + '<div class="econ-cards">';

  // Auto-discover income objects
  var eKeys = Object.keys(ECON_CFG);
  var incomeKeys = [];
  for (var i = 0; i < eKeys.length; i++) {
    var ek = eKeys[i];
    if (ek[0] === "_") continue;
    var edata = ECON_CFG[ek];
    if (typeof edata === "object" && edata !== null && !Array.isArray(edata) && hasIncomeFields(edata)) {
      incomeKeys.push(ek);
    }
  }
  for (var wi = 0; wi < incomeKeys.length; wi++) {
    out += renderIncomeCard(ECON_CFG[incomeKeys[wi]]);
  }

  // Corebearers array
  if (ECON_CFG.corebearers && ECON_CFG.corebearers.length) {
    for (var ci = 0; ci < ECON_CFG.corebearers.length; ci++) {
      out += renderIncomeCard(ECON_CFG.corebearers[ci]);
    }
  }

  out += '</div>';
  return out;
}

// ── DUNGEON FEES PANEL ───────────────────────────────────────
function buildFeesPanel() {
  if (!ECON_CFG) return div("no-results", "-- Economy config not loaded --");
  var out = '';

  // Entry fee cards
  if (ECON_CFG.dungeon_entry_fees && ECON_CFG.dungeon_entry_fees.length) {
    out += sectionTitle("Dungeon Entry Fees", "#70c090") + '<div class="econ-cards">';
    for (var di = 0; di < ECON_CFG.dungeon_entry_fees.length; di++) {
      var df = ECON_CFG.dungeon_entry_fees[di];
      var feeStr = df.fee_display || df.fee || "—";
      out += div("econ-card",
        '<div class="econ-card-label">' + esc(df.tier) + '</div>' +
        '<div class="econ-highlight">' + cVal(feeStr) + '</div>' +
        (df.who_accesses ? '<div class="econ-card-sub">' + esc(df.who_accesses) + '</div>' : '') +
        '<div class="econ-card-note">' + esc(df.notes||"") + '</div>'
      );
    }
    out += '</div>';
  }

  // Dungeon yield
  var dy = ECON_CFG.dungeon_yield;
  if (dy) {
    // Note
    if (dy._note) {
      out += '<div class="info-banner"><em>Note</em>' + esc(dy._note) + '</div>';
    }

    // Income flow
    if (dy.income_flow && dy.income_flow.steps) {
      out += sectionTitle(dy.income_flow.description || "Income Flow", "#d4af60");
      out += '<div class="flow-table">';
      out += '<div class="flow-row flow-header">' +
        '<span class="flow-step">Step</span>' +
        '<span class="flow-cut">Cut</span>' +
        '<span class="flow-desc">Description</span>' +
        '</div>';
      for (var si = 0; si < dy.income_flow.steps.length; si++) {
        var step = dy.income_flow.steps[si];
        var pctVal = step.value_pct !== undefined ? step.value_pct : step.value_pct_default;
        var cut = pctVal !== undefined ? String(pctVal) + "%" : "—";
        var cutColor = String(pctVal).includes("-") ? "var(--econ-danger)" :
          pctVal === "~55–60" ? "var(--econ-teal)" : "var(--econ-amber)";
        out += '<div class="flow-row">' +
          '<span class="flow-step">' + esc(step.step) + '</span>' +
          '<span class="flow-cut" style="color:' + cutColor + '">' + esc(cut) + '</span>' +
          '<span class="flow-desc">' + esc(step.description) + '</span>' +
          '</div>';
      }
      out += '</div>';
    }

    // Yield by monster rank
    if (dy.by_monster_rank && dy.by_monster_rank.length) {
      out += sectionTitle("Yield by Monster Rank", "#c08060");
      out += '<div class="yield-cards">';
      for (var ri = 0; ri < dy.by_monster_rank.length; ri++) {
        var mr = dy.by_monster_rank[ri];
        var isHigh = !mr.kills_per_run_avg;
        out += '<div class="yield-card' + (isHigh ? ' yield-card-classified' : '') + '">';
        out += '<div class="yield-card-top">';
        out += '<span class="yield-rank-badge">' + esc(mr.monster_rank) + '</span>';
        out += '<div class="yield-nums">';
        out += '<div class="yield-num-item">' +
          '<span class="yield-num-label">Core Price</span>' +
          '<span class="yield-num-val">' + cVal(mr.core_price_display||"—") + '</span>' +
          '</div>';
        out += '<div class="yield-num-item">' +
          '<span class="yield-num-label">Parts Yield</span>' +
          '<span class="yield-num-val">' + cVal(mr.parts_display||"—") + '</span>' +
          '</div>';
        if (mr.kills_per_run_avg) {
          out += '<div class="yield-num-item">' +
            '<span class="yield-num-label">Avg Kills/Run</span>' +
            '<span class="yield-num-val">' + mr.kills_per_run_avg + ' <span class="yield-top">(top: ' + mr.kills_per_run_top + ')</span></span>' +
            '</div>';
          out += '<div class="yield-num-item">' +
            '<span class="yield-num-label">Gross/Run (avg)</span>' +
            '<span class="yield-num-val yield-gross">' + cVal(fmtN(mr.gross_per_run_avg)) + '</span>' +
            '</div>';
        }
        out += '</div></div>';
        out += '<div class="yield-card-detail">';
        if (mr.species_note) out += '<div class="yield-detail-line"><em>Note:</em> ' + esc(mr.species_note) + '</div>';
        if (mr.buyer_pool)   out += '<div class="yield-detail-line"><em>Buyers:</em> ' + esc(mr.buyer_pool) + '</div>';
        out += '</div></div>';
      }
      out += '</div>';
    }

    // Licensing
    if (dy.licensing_requirements && dy.licensing_requirements.length) {
      out += sectionTitle("Licensing Requirements", "#9098a8");
      out += '<div class="lic-table">';
      for (var li = 0; li < dy.licensing_requirements.length; li++) {
        var lr = dy.licensing_requirements[li];
        out += '<div class="lic-row">' +
          '<span class="lic-rank">' + esc(lr.rank) + '</span>' +
          '<span class="lic-req">' + esc(lr.requirement) + '</span>' +
          '<span class="lic-note">' + esc(lr.notes) + '</span>' +
          '</div>';
      }
      out += '</div>';
    }

    if (dy.academy_salvage_note) out += '<div class="econ-callout">' + esc(dy.academy_salvage_note) + '</div>';

    // Rarity modifiers
    if (dy.species_rarity_modifiers && dy.species_rarity_modifiers.modifiers) {
      out += sectionTitle("Species Rarity Multipliers", "#b060c0");
      out += '<div class="rarity-table">';
      var mods = dy.species_rarity_modifiers.modifiers;
      for (var mi = 0; mi < mods.length; mi++) {
        var mod = mods[mi];
        out += '<div class="rarity-row">' +
          '<span class="rarity-name">' + esc(mod.rarity) + '</span>' +
          '<span class="rarity-mult">×' + mod.multiplier + '</span>' +
          '<span class="rarity-ex">' + esc(mod.example) + '</span>' +
          '</div>';
      }
      out += '</div>';
    }

    // LMCA AP System
    if (dy.lmca_ap_system) {
      var ap = dy.lmca_ap_system;
      out += sectionTitle("LMCA AP System", "var(--econ-amber)");
      if (ap.rate) out += '<div class="econ-callout">' + esc(ap.rate) + '</div>';
      if (ap.ap_cap) {
        out += renderKeyValue(ap.ap_cap, null);
      }
    }
  }
  return out || div("no-results", "-- No dungeon fee data --");
}

// ── REFERENCE PANEL (dynamic) ────────────────────────────────
function buildReferencePanel() {
  if (!ECON_CFG) return div("no-results", "-- Economy config not loaded --");
  var tabs = discoverTabs();
  var refTab = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].id === "reference") { refTab = tabs[i]; break; }
  }
  if (!refTab || !refTab.sources.length) {
    return div("no-results", "-- No reference data found --");
  }

  var out = '';
  for (var si = 0; si < refTab.sources.length; si++) {
    var src = refTab.sources[si];
    var title = src.sectionDef && src.sectionDef.label ? src.sectionDef.label :
                src.key.replace(/[_-]/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });

    // Show parent note banner if the section was unwrapped from a nested object
    var sectionOut = '';
    if (src.sectionDef && src.sectionDef._parentNote) {
      sectionOut += '<div class="info-banner"><em>Note</em>' + esc(src.sectionDef._parentNote) + '</div>';
    }

    // Use sectionDef fields if available
    if (isItemPriceRangeArray(src.data)) {
      sectionOut += renderItemPriceRanges(src.data, title);
    } else if (isHealingCostArray(src.data)) {
      sectionOut += renderHealingCosts(src.data, title);
    } else if (src.sectionDef && src.sectionDef.fields && Array.isArray(src.data) && src.data.length) {
      sectionOut += renderAutoTable(src.data, title, {fields: src.sectionDef.fields});
    } else if (src.sectionDef && src.sectionDef.layout === "cards") {
      sectionOut += renderAutoCards(src.data, title);
    } else {
      sectionOut += renderAny(src.data, title);
    }
    out += sectionOut;
  }
  return out || div("no-results", "-- No reference data found --");
}

// ── POINTS SYSTEM TAB ────────────────────────────────────────
function buildPointsPanel() {
  if (!PTS_CFG && DEVOUR.cfg.points) PTS_CFG = DEVOUR.cfg.points;
  var systems = (PTS_CFG && PTS_CFG.systems) || (ECON_CFG && ECON_CFG.point_systems) || null;
  if (!systems) {
    return '<div class="pts-loading">' +
      '<div class="pts-loading-icon">◆</div>' +
      '<div class="pts-loading-text">Loading point systems...</div>' +
      '<div class="pts-loading-sub">Reading config/points.json</div>' +
      '</div>';
  }
  if (!systems.length) return div("no-results", "-- No point systems defined --");
  if (state.activePointOrg) {
    var org = null;
    for (var i = 0; i < systems.length; i++) { if (systems[i].id === state.activePointOrg) { org = systems[i]; break; } }
    if (org) return buildPointOrgDetail(org);
  }
  var out = sectionTitle("Point Systems Registry", "#d4af60");
  out += '<div class="pts-grid">';
  for (var pi = 0; pi < systems.length; pi++) {
    var sys = systems[pi];
    out += '<div class="pts-card" data-orgid="' + esc(sys.id) + '">' +
      '<div class="pts-card-header">' +
      '<span class="pts-card-icon cs-amber">' + esc(sys.icon||"◆") + '</span>' +
      '<div class="pts-card-titles">' +
      '<div class="pts-card-name">' + esc(sys.name) + '</div>' +
      '<div class="pts-card-org">' + esc(sys.organization) + '</div>' +
      '</div></div>' +
      '<div class="pts-card-currency">' + esc(sys.currency_name) + ' (' + esc(sys.currency_symbol) + ')</div>' +
      '<div class="pts-card-desc">' + esc(sys.description) + '</div>' +
      (sys.credit_rate ? '<div class="pts-card-rate">1 ' + esc(sys.currency_symbol) + ' = <span class="cs-cred">' + sys.credit_rate + ' ₵</span></div>' : '') +
      '<div class="pts-card-footer">Tap to view full system ›</div>' +
      '</div>';
  }
  out += '</div>';
  return out;
}

function buildPointOrgDetail(org) {
  var out = '<button class="mkt-btn pts-back-btn" id="pts-back">← Back</button>';
  out += '<div class="pts-detail">';
  out += '<div class="pts-detail-header">' +
    '<span class="pts-detail-icon cs-amber">' + esc(org.icon||"◆") + '</span>' +
    '<div><div class="pts-detail-name">' + esc(org.name) + '</div>' +
    '<div class="pts-detail-org">' + esc(org.organization) + '</div>' +
    (org.location ? '<div class="pts-detail-loc">' + esc(org.location) + '</div>' : '') +
    '</div></div>';
  out += '<div class="pts-currency-bar">' +
    '<span>Currency: <strong>' + esc(org.currency_name) + '</strong> (' + esc(org.currency_symbol) + ')</span>' +
    (org.credit_rate ? '<span>1 ' + esc(org.currency_symbol) + ' = <strong class="cs-cred">' + org.credit_rate + ' ₵</strong>' + (showUSD ? ' ≈ $' + (org.credit_rate*(CURR_CFG.credit_usd||0.5)).toFixed(2) : '') + '</span>' : '') +
    '</div>';
  if (org.description) out += '<div class="pts-detail-desc">' + esc(org.description) + '</div>';
  if (org.ideology)    out += '<div class="pts-detail-ideology">"' + esc(org.ideology) + '"</div>';

  function buildPtsTable(items, col1, col2) {
    var t = '<div class="pts-tbl">';
    t += '<div class="pts-tbl-header"><span class="pts-tbl-c1">' + col1 + '</span><span class="pts-tbl-c2">' + col2 + '</span><span class="pts-tbl-c3">Notes</span></div>';
    for (var k = 0; k < items.length; k++) {
      var item = items[k];
      var val = item.reward || item.cost || item.deduction || item.requirement || "—";
      t += '<div class="pts-tbl-row">' +
        '<span class="pts-tbl-c1">' + esc(item.activity||item.item||item.violation||item.milestone||"—") + '</span>' +
        '<span class="pts-tbl-c2 cs-ap">' + esc(val) + '</span>' +
        '<span class="pts-tbl-c3">' + esc(item.notes||"—") + '</span>' +
        '</div>';
    }
    return t + '</div>';
  }

  if (org.earn_methods && org.earn_methods.length) {
    out += sectionTitle("How to Earn " + org.currency_symbol, "#70c090");
    for (var ei = 0; ei < org.earn_methods.length; ei++) {
      var em = org.earn_methods[ei];
      if (em.category) out += '<div class="pts-earn-category">' + esc(em.category) + '</div>';
      if (em.items && em.items.length) out += buildPtsTable(em.items, "Activity", "Reward");
    }
  }
  if (org.spend_costs && org.spend_costs.length) {
    out += sectionTitle("What " + org.currency_symbol + " Buys", "#c08060");
    for (var si2 = 0; si2 < org.spend_costs.length; si2++) {
      var sc = org.spend_costs[si2];
      if (sc.category) out += '<div class="pts-earn-category">' + esc(sc.category) + '</div>';
      if (sc.items && sc.items.length) out += buildPtsTable(sc.items, "Item / Service", "Cost");
    }
  }
  if (org.penalties && org.penalties.length) {
    out += sectionTitle("Penalties", "#cc4444");
    out += buildPtsTable(org.penalties, "Violation", "Deduction");
  }
  if (org.milestones && org.milestones.length) {
    out += sectionTitle("Milestones & Thresholds", "#9098a8");
    out += buildPtsTable(org.milestones, "Milestone", "Requirement");
  }
  if (org.system_notes) out += '<div class="econ-callout">' + esc(org.system_notes) + '</div>';
  out += '</div>';
  return out;
}

// ── BENCHMARKS ───────────────────────────────────────────────
function buildBenchmarks(source) {
  var bmarks = source || ((CURR_CFG && CURR_CFG.real_world_benchmarks) || (ECON_CFG && ECON_CFG.real_world_benchmarks));
  if (!bmarks || !bmarks.length) return '';
  var out = sectionTitle("Real World Reference", "#70c090");
  out += '<div class="bench-header"><span>Item</span><span>Credits</span>' + (showUSD ? '<span>USD ~</span>' : '') + '</div>';
  out += '<div class="bench-table">';
  for (var bi = 0; bi < bmarks.length; bi++) {
    var b = bmarks[bi];
    out += '<div class="bench-row">' +
      '<span class="bench-label">' + esc(b.label) + '</span>' +
      '<span class="bench-credits">' + cVal(b.credits) + '</span>' +
      (showUSD ? '<span class="bench-usd">' + esc(b.usd||"") + '</span>' : '') +
      '</div>';
  }
  return out + '</div>';
}

// ═══════════════════════════════════════════════════════════════
//  DYNAMIC TAB RENDERER — routes any tab to appropriate builder
// ═══════════════════════════════════════════════════════════════
function buildDynamicTab(tabId, tabSources) {
  var out = '';
  for (var i = 0; i < tabSources.length; i++) {
    var src = tabSources[i];
    var title = src.sectionDef && src.sectionDef.label ? src.sectionDef.label :
                src.key.replace(/[_-]/g, " ").replace(/\b\w/g, function(c) { return c.toUpperCase(); });

    // Show parent note banner for unwrapped nested objects
    if (src.sectionDef && src.sectionDef._parentNote) {
      out += '<div class="info-banner"><em>Note</em>' + esc(src.sectionDef._parentNote) + '</div>';
    }

    if (isItemPriceRangeArray(src.data)) {
      out += renderItemPriceRanges(src.data, title);
    } else if (isHealingCostArray(src.data)) {
      out += renderHealingCosts(src.data, title);
    } else if (src.sectionDef && src.sectionDef.fields && Array.isArray(src.data) && src.data.length) {
      out += renderAutoTable(src.data, title, {fields: src.sectionDef.fields});
    } else if (src.sectionDef && src.sectionDef.layout === "cards") {
      out += renderAutoCards(src.data, title);
    } else {
      out += renderAny(src.data, title);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
//  MAIN RENDER
// ═══════════════════════════════════════════════════════════════

// Inject lore/author styles once per page load
(function injectEconStyles() {
  if (document.getElementById("devour-econ-lore-styles")) return;
  var s = document.createElement("style");
  s.id = "devour-econ-lore-styles";
  s.textContent = [
    ".econ-lore { border-left: 3px solid var(--econ-accent, #00c896); background: rgba(0,200,150,0.05); color: var(--econ-fg2, #aaa); font-style: italic; padding: 8px 12px; margin: 8px 0 4px; border-radius: 0 4px 4px 0; font-size: 0.92em; line-height: 1.5; }",
    ".econ-author-note { border-left: 3px solid #f0a500; background: rgba(240,165,0,0.07); color: var(--econ-fg2, #aaa); font-size: 0.85em; padding: 8px 12px; margin: 6px 0 4px; border-radius: 0 4px 4px 0; line-height: 1.5; }",
    ".econ-author-tag { color: #f0a500; font-weight: 700; margin-right: 6px; font-style: normal; }",
    ".dv-dev-btn-active { background: rgba(240,165,0,0.18) !important; border-color: #f0a500 !important; color: #f0a500 !important; }",
  ].join("\n");
  document.head.appendChild(s);
})();

function render() {
  if (!ECON_CFG && !CURR_CFG) {
    container.innerHTML = div("no-results", "-- Economy data not loaded --");
    return;
  }

  var tabs = discoverTabs();

  // Tab bar
  var tabHtml = '<div class="econ-tabs">';
  for (var ti = 0; ti < tabs.length; ti++) {
    var st = tabs[ti];
    tabHtml += '<button class="econ-tab' + (state.activeSection===st.id ? ' econ-tab-active' : '') + '" data-esection="' + st.id + '">' + st.label + '</button>';
  }
  tabHtml += '</div>';

  // Content
  var content = '';
  if (state.activeSection !== "points") {
    if (ECON_CFG && ECON_CFG.lore) {
      content += '<div class="info-banner econ-lore">' + esc(ECON_CFG.lore) + '</div>';
    }
    if (ECON_CFG && ECON_CFG.notes && showAuthorNotes) {
      content += '<div class="info-banner econ-author-note"><span class="econ-author-tag">✎ Author</span>' + esc(ECON_CFG.notes) + '</div>';
    }
  }
  var noBench = ["fees", "reference", "points"];
  var activeTab = null;
  for (var ai = 0; ai < tabs.length; ai++) {
    if (tabs[ai].id === state.activeSection) { activeTab = tabs[ai]; break; }
  }

  if (activeTab) {
    switch (state.activeSection) {
      case "tiers":      content = buildTiersPanel();      break;
      case "conversion": content = buildConversionPanel(); break;
      case "wages":      content = buildWagesPanel();      break;
      case "fees":       content = buildFeesPanel();       break;
      case "reference":  content = buildReferencePanel();  break;
      case "points":     content = buildPointsPanel();     break;
      default:
        content = buildDynamicTab(state.activeSection, activeTab.sources);
    }
  } else {
    content = div("no-results", "-- Select a tab --");
  }

  // Benchmarks on selected tabs
  if (noBench.indexOf(state.activeSection) === -1) {
    // Prefer currency benchmarks, fall back to economy
    var bmSource = (CURR_CFG && CURR_CFG.real_world_benchmarks) ? CURR_CFG.real_world_benchmarks :
                   (ECON_CFG && ECON_CFG.real_world_benchmarks) ? ECON_CFG.real_world_benchmarks : null;
    if (bmSource) content += buildBenchmarks(bmSource);
  }

  var root = container.querySelector(".econ-root");
  if (!root) {
    // First render — build full shell including tab bar
    container.innerHTML = '<div class="econ-root">' + tabHtml + '<div class="econ-content">' + content + '</div></div>';
  } else {
    // Subsequent renders — only update active tab state and content, leave tab bar DOM intact
    root.querySelectorAll(".econ-tab").forEach(function(btn) {
      btn.classList.toggle("econ-tab-active", btn.dataset.esection === state.activeSection);
    });
    var contentEl = root.querySelector(".econ-content");
    if (contentEl) contentEl.innerHTML = content;
  }

  // ═══════════════════════════════════════════════════════════
  //  EVENT BINDING
  // ═══════════════════════════════════════════════════════════

  // Tabs — delegated listener attached once on first render only
  var tabsEl = container.querySelector(".econ-tabs");
  if (tabsEl && !tabsEl.__tabsBound) {
    tabsEl.__tabsBound = true;
    tabsEl.addEventListener("click", function(e) {
      var btn = e.target.closest(".econ-tab");
      if (!btn) return;
      state.activeSection = btn.dataset.esection;
      state.editingTier = state.editingConv = state.newCurrency = state.activePointOrg = null;
      render();
    });
  }

  // Tier edit
  container.querySelectorAll(".tier-edit-btn").forEach(function(btn) {
    btn.addEventListener("click", function(e) { e.stopPropagation(); state.editingTier = btn.dataset.tierid; render(); });
  });
  var teSave = container.querySelector("#te-save");
  if (teSave) teSave.addEventListener("click", function() {
    var tid = teSave.dataset.tierid, tier = null;
    for (var i = 0; i < CURR_CFG.tiers.length; i++) { if (CURR_CFG.tiers[i].id === tid) { tier = CURR_CFG.tiers[i]; break; } }
    if (!tier) { state.editingTier = null; render(); return; }
    tier.symbol      = (container.querySelector("#te-sym")?.value  || tier.symbol).trim();
    tier.name        = (container.querySelector("#te-name")?.value || tier.name).trim();
    tier.rank_range  = (container.querySelector("#te-range")?.value|| tier.rank_range).trim();
    tier.description = (container.querySelector("#te-desc")?.value || tier.description).trim();
    var lockedCb = container.querySelector("#te-locked");
    if (lockedCb) tier.locked = lockedCb.checked;
    container.querySelectorAll(".te-grade[data-gi]").forEach(function(inp) {
      var gi = parseInt(inp.dataset.gi);
      if (tier.grades && tier.grades[gi]) tier.grades[gi][inp.dataset.field] = inp.value;
    });
    container.querySelectorAll(".te-grade[data-ei]").forEach(function(inp) {
      var ei = parseInt(inp.dataset.ei);
      if (tier.examples && tier.examples[ei]) tier.examples[ei][inp.dataset.field] = inp.value;
    });
    state.editingTier = null; saveCurrencyConfig(); render();
  });
  var teCancel = container.querySelector("#te-cancel");
  if (teCancel) teCancel.addEventListener("click", function() { state.editingTier = null; render(); });

  // Add currency
  var addBtn = container.querySelector("#btn-add-currency");
  if (addBtn) addBtn.addEventListener("click", function() { state.newCurrency = {}; render(); });
  var ncSave = container.querySelector("#nc-save");
  if (ncSave) ncSave.addEventListener("click", function() {
    var code = (container.querySelector("#nc-code")?.value||"").trim().toUpperCase();
    var name = (container.querySelector("#nc-name")?.value||"").trim();
    var rate = parseFloat(container.querySelector("#nc-rate")?.value||"1");
    if (!code) { alert("Code required"); return; }
    if (isNaN(rate)||rate<=0) { alert("Valid rate required"); return; }
    if (CURR_CFG.conversion_table.some(function(r) { return r.code===code; })) { alert("Code exists"); return; }
    CURR_CFG.conversion_table.push({code:code, name:name||code, rate:rate, to_credits:String(rate)});
    CURR_CFG.conversion_table.sort(function(a,b) { return (parseFloat(b.rate)||1)-(parseFloat(a.rate)||1); });
    state.newCurrency = null; propagateRateChange(code, rate); render();
  });
  var ncCancel = container.querySelector("#nc-cancel");
  if (ncCancel) ncCancel.addEventListener("click", function() { state.newCurrency = null; render(); });

  // Conv edit
  container.querySelectorAll(".conv-edit-btn").forEach(function(btn) {
    btn.addEventListener("click", function() { state.editingConv = btn.dataset.code; render(); });
  });
  container.querySelectorAll(".conv-del-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var code = btn.dataset.code;
      if (!confirm("Delete " + code + "?")) return;
      CURR_CFG.conversion_table = CURR_CFG.conversion_table.filter(function(r) { return r.code!==code; });
      saveCurrencyConfig(); render();
    });
  });
  var ceSave = container.querySelector("#ce-save");
  if (ceSave) ceSave.addEventListener("click", function() {
    var code = ceSave.dataset.code;
    var newRate = parseFloat(container.querySelector("#ce-rate")?.value||"1");
    if (isNaN(newRate)||newRate<=0) { alert("Valid rate required"); return; }
    state.editingConv = null;
    propagateRateChange(code, newRate);
    render();
  });
  var ceCancel = container.querySelector("#ce-cancel");
  if (ceCancel) ceCancel.addEventListener("click", function() { state.editingConv = null; render(); });
  var ceRate = container.querySelector("#ce-rate");
  if (ceRate) ceRate.addEventListener("input", function() {
    var v = parseFloat(ceRate.value);
    if (!isNaN(v)&&v>0) {
      var uEl = container.querySelector("#ce-usd"), cEl = container.querySelector("#ce-credits");
      if (uEl)  uEl.textContent  = fmtUSD(v) || "";
      if (cEl)  cEl.textContent  = v + " ₵";
    }
  });

  // Points
  container.querySelectorAll(".pts-card").forEach(function(card) {
    card.addEventListener("click", function() { state.activePointOrg = card.dataset.orgid; render(); });
  });
  var ptsBack = container.querySelector("#pts-back");
  if (ptsBack) ptsBack.addEventListener("click", function() { state.activePointOrg = null; render(); });
}

render();
}; // end DEVOUR.modules["economy"]

---
obsidianUIMode: preview
cssclasses:
  - full-page-db
---

```dataviewjs
// ╔══════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — WORLD DASHBOARD  v3.2                      ║
// ║  Shell: System/_WORLD.md                                     ║
// ║  Modules: System/modules/*.js  (eval-injected)              ║
// ║  Configs: config/*.json                                      ║
// ╚══════════════════════════════════════════════════════════════╝

// ── 0. NAMESPACE ─────────────────────────────────────────────
var DEVOUR = {
  cfg:     {},
  modules: {},
  state:   {},
  utils:   {},
  _sharedItems: [],
  _sharedState: {},
  _persistedLoaded: false,
};

// ── 1. CONFIG LOADER ─────────────────────────────────────────
async function loadJSON(path) {
  try {
    var f = app.vault.getAbstractFileByPath(path);
    if (!f) throw new Error("Not found: " + path);
    return JSON.parse(await app.vault.cachedRead(f));
  } catch(e) {
    console.error("[DEVOUR] Config error:", path, e);
    return null;
  }
}

// ── 2. MODULE LOADER ─────────────────────────────────────────
async function loadModule(path) {
  var t0 = performance.now();
  try {
    var f = app.vault.getAbstractFileByPath(path);
    if (!f) throw new Error("Module not found: " + path);
    var src = await app.vault.cachedRead(f);
    var wrapped = "(function(DEVOUR){\n" + src + "\n})(DEVOUR);";
    eval(wrapped);
    var ms = (performance.now() - t0).toFixed(1);
    console.log("[DEVOUR] Module loaded:", path, "(" + ms + "ms)");
    return { ok: true };
  } catch(e) {
    console.error("[DEVOUR] Module load error:", path, e);
    return { ok: false, error: e };
  }
}

// ── 3. SHARED UTILITIES ──────────────────────────────────────
DEVOUR.utils.el = function(tag, attrs, inner) {
  var a = "";
  if (attrs) {
    var ks = Object.keys(attrs);
    for (var i = 0; i < ks.length; i++) {
      var v = attrs[ks[i]];
      if (v !== null && v !== undefined && v !== false)
        a += " " + ks[i] + '="' + String(v).replace(/"/g,'&quot;') + '"';
    }
  }
  return "<" + tag + a + ">" + (inner || "") + "</" + tag + ">";
};
DEVOUR.utils.div  = function(cls, inner) { return DEVOUR.utils.el("div",  {"class": cls}, inner); };
DEVOUR.utils.span = function(cls, inner) { return DEVOUR.utils.el("span", {"class": cls}, inner); };

DEVOUR.utils.escapeHtml = function(s) {
  return String(s || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
};
var esc = DEVOUR.utils.escapeHtml;

DEVOUR.utils.getAssetSVG = function(key) {
  var cache = (DEVOUR.cfg.assets && DEVOUR.cfg.assets.svg) || {};
  return cache[key] || null;
};
DEVOUR.utils.getAssetImg = function(key) {
  var cache = (DEVOUR.cfg.assets && DEVOUR.cfg.assets.webp) || {};
  var b64 = cache[key];
  if (!b64) return null;
  return "data:" + (b64.mime || "image/webp") + ";base64," + b64.data;
};

// ── 3c. CONFIG SAVE UTILITY ──────────────────────────────────
DEVOUR.utils.saveConfig = async function(filename, data) {
  try {
    var path = "config/" + filename + ".json";
    var content = JSON.stringify(data, null, 2);
    var f = app.vault.getAbstractFileByPath(path);
    if (f) {
      await app.vault.modify(f, content);
    } else {
      await app.vault.create(path, content);
    }
    if (filename === "region-assets-cache") {
      DEVOUR.cfg.regionAssetsCache = data;
    }
  } catch(e) {
    console.error("[DEVOUR] saveConfig error:", filename, e);
  }
};

// ── 3b. CUSTOM SELECT UTILITY ────────────────────────────────
// Replaces ALL native <select class="mkt-sel"> elements found
// inside a container with fully styled custom dropdowns.
// Modules can also call DEVOUR.utils.makeSelect() directly.
//
// Usage (from module HTML):
//   <select class="mkt-sel" data-dv-select id="myId">
//     <option value="a">Label A</option>
//   </select>
//
// Or imperatively:
//   DEVOUR.utils.upgradeSelects(panelEl);
//
// The custom element fires a native "change" event so existing
// module listeners (addEventListener("change", ...)) keep working.

DEVOUR.utils.upgradeSelects = function(root) {
  // Close any open dropdowns when clicking outside
  if (!window._dvSelectOutsideHandler) {
    window._dvSelectOutsideHandler = true;
    document.addEventListener("click", function(e) {
      if (!e.target.closest(".dv-sel-wrap")) {
        document.querySelectorAll(".dv-sel-wrap.open").forEach(function(w) {
          w.classList.remove("open");
        });
      }
    });
  }

  root.querySelectorAll("select.mkt-sel, select[data-dv-select]").forEach(function(sel) {
    if (sel.dataset.dvUpgraded) return;
    sel.dataset.dvUpgraded = "1";

    var opts    = Array.from(sel.options);
    var current = sel.value || (opts[0] && opts[0].value) || "";
    var label   = (sel.options[sel.selectedIndex] && sel.options[sel.selectedIndex].text) || current;

    // Build wrapper
    var wrap = document.createElement("div");
    wrap.className = "dv-sel-wrap";
    if (sel.className) wrap.dataset.origClass = sel.className;
    // copy any data attributes for width hints etc
    if (sel.style.maxWidth) wrap.style.maxWidth = sel.style.maxWidth;

    // Trigger button
    var trigger = document.createElement("button");
    trigger.className = "dv-sel-trigger";
    trigger.type = "button";
    trigger.innerHTML =
      '<span class="dv-sel-label">' + esc(label) + '</span>'
      + '<span class="dv-sel-arrow">▾</span>';

    // Dropdown panel
    var dropdown = document.createElement("div");
    dropdown.className = "dv-sel-dropdown";

    opts.forEach(function(o) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "dv-sel-item" + (o.value === current ? " active" : "");
      item.textContent = o.text;
      item.dataset.val = o.value;
      item.addEventListener("click", function(e) {
        e.stopPropagation();
        current = o.value;
        label   = o.text;
        trigger.querySelector(".dv-sel-label").textContent = o.text;
        dropdown.querySelectorAll(".dv-sel-item").forEach(function(i) { i.classList.remove("active"); });
        item.classList.add("active");
        wrap.classList.remove("open");
        // Sync hidden select + fire change
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      });
      dropdown.appendChild(item);
    });

    trigger.addEventListener("click", function(e) {
      e.stopPropagation();
      var isOpen = wrap.classList.contains("open");
      // close all others
      document.querySelectorAll(".dv-sel-wrap.open").forEach(function(w) { w.classList.remove("open"); });
      if (!isOpen) wrap.classList.add("open");
    });

    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);

    // Hide the original select but keep it in DOM for value reads
    sel.style.display = "none";
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
  });
};

// Auto-upgrade whenever a module renders — hook into MutationObserver
// Scoped to the DataviewJS container to avoid colliding with other DV blocks.
// Called once during bootstrap after the shell is in the DOM.
DEVOUR.utils.initSelectObserver = function(root) {
  if (root._dvSelectObserver) return; // already attached
  var mo = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
      m.addedNodes.forEach(function(n) {
        if (n.nodeType === 1) {
          if (n.matches && (n.matches("select.mkt-sel") || n.matches("select[data-dv-select]"))) {
            DEVOUR.utils.upgradeSelects(n.parentNode || root);
          } else if (n.querySelectorAll) {
            var sels = n.querySelectorAll("select.mkt-sel, select[data-dv-select]");
            if (sels.length) DEVOUR.utils.upgradeSelects(n);
          }
        }
      });
    });
  });
  mo.observe(root, { childList: true, subtree: true });
  root._dvSelectObserver = mo;
};

// ── 4. SHELL STATE ───────────────────────────────────────────
DEVOUR.state = {
  activeModule:    "market",
  _wsOverride:     null,
  _clrOverride:    null,
  _commOverride:   null,
  showUSD:         false,
  showAuthorNotes: false,
};

// ── 5. PERSISTENCE ───────────────────────────────────────────
async function loadPersistedOverrides() {
  try {
    var f = app.vault.getAbstractFileByPath("config/devour-state.json");
    if (f) {
      var raw = await app.vault.cachedRead(f);
      var parsed = JSON.parse(raw);
      if (parsed._wsOverride)    DEVOUR.state._wsOverride      = parsed._wsOverride;
      if (parsed._clrOverride)   DEVOUR.state._clrOverride     = parsed._clrOverride;
      if (parsed._commOverride)  DEVOUR.state._commOverride    = parsed._commOverride;
      if (parsed.activeModule)   DEVOUR.state.activeModule     = parsed.activeModule;
      if (parsed.showAuthorNotes !== undefined) DEVOUR.state.showAuthorNotes = parsed.showAuthorNotes;
      DEVOUR._persistedLoaded = true;
    }
  } catch(e) {
    console.log("[DEVOUR] No persisted overrides.", e);
  }
}

async function savePersistedOverrides() {
  try {
    var data = JSON.stringify({
      _wsOverride:     DEVOUR.state._wsOverride,
      _clrOverride:    DEVOUR.state._clrOverride,
      _commOverride:   DEVOUR.state._commOverride,
      activeModule:    DEVOUR.state.activeModule,
      showAuthorNotes: DEVOUR.state.showAuthorNotes,
      _savedAt:        new Date().toISOString(),
    }, null, 2);
    var f = app.vault.getAbstractFileByPath("config/devour-state.json");
    if (f) {
      await app.vault.modify(f, data);
    } else {
      await app.vault.create("config/devour-state.json", data);
    }
  } catch(e) {
    console.error("[DEVOUR] Failed to save overrides:", e);
  }
}

// ── 6. TABS CONFIG ───────────────────────────────────────────
var TAB_DEFS = [
  { id: "market",      label: "Market",      icon: "&#9876;",   module: "System/modules/market.js"      },
  { id: "commissions", label: "Commissions", icon: "&#128203;", module: "System/modules/commissions.js" },
  { id: "dungeons",    label: "Dungeons",    icon: "&#11041;",  module: "System/modules/dungeons.js"    },
  { id: "guilds",      label: "Guilds",      icon: "&#9873;",   module: "System/modules/guilds.js"      },
  { id: "factions",    label: "Factions",    icon: "&#9670;",   module: "System/modules/factions.js"    },
  { id: "calendar",    label: "Calendar",    icon: "&#9716;",   module: "System/modules/calendar.js"    },
  { id: "regions",     label: "Regions",     icon: "&#9673;",   module: "System/modules/regions.js"      },
  { id: "economy",     label: "Economy",     icon: "&#9838;",   module: "System/modules/economy.js"     },
  { id: "shop",        label: "Shops",       icon: "&#9962;",   module: "System/modules/shop.js"        },
  { id: "generate",    label: "Generate",    icon: "&#9997;",   module: "System/modules/generate.js"    },
];

function getActiveTabDef() {
  for (var i = 0; i < TAB_DEFS.length; i++) {
    if (TAB_DEFS[i].id === DEVOUR.state.activeModule) return TAB_DEFS[i];
  }
  return TAB_DEFS[0];
}

// ── 7. SHELL CSS → main styles in MKT_World_v3.css
// ── 7. SHELL CSS → see _MKT_world.css (v3.3 sections appended)


// ── 8. MODAL BUILDER ─────────────────────────────────────────
function buildShellModal(id, title, options, currentVal, stateKey) {
  var opts = "";
  for (var i = 0; i < options.length; i++) {
    var o   = options[i];
    var cls = "dv-modal-opt" + (o.value === currentVal ? " active" : "");
    opts += '<button class="' + cls + '" data-state="' + stateKey + '" data-val="' + o.value + '">'
          + esc(o.label) + '</button>';
  }
  return '<div class="dv-modal-overlay" id="dv-modal-' + id + '">'
       + '<div class="dv-modal-box">'
       + '<div class="dv-modal-title">' + title + '</div>'
       + '<div class="dv-modal-opts">' + opts + '</div>'
       + '<button class="dv-modal-close dv-modal-dismiss">Close</button>'
       + '</div></div>';
}


// ── 9. SHELL RENDER ──────────────────────────────────────────
// Performs a FULL initial render (called once or after config reload).
// Pill clicks and tab clicks patch the DOM in-place via patchHeader() /
// patchTabs() to avoid tearing down the panel and reattaching listeners.

function _buildClrColors() {
  return {
    "F":"#888","E":"#4aaa4a","D":"#4a8fff","C":"#cc44cc",
    "B":"#ff8c00","A":"#ff4444","S":"#ffdd00","SS":"#ff88ff","SSS":"#00ffee"
  };
}

// ── Patch header stat lines only (no DOM rebuild) ─────────────
function patchHeader(container) {
  var wCfg     = DEVOUR.cfg.world;
  var wsKey    = DEVOUR.state._wsOverride  || (wCfg && wCfg.world_state)    || "Stable";
  var clrLvl   = DEVOUR.state._clrOverride || (wCfg && wCfg.clearance_level) || "F";
  var wsColor  = (wCfg && wCfg.world_states[wsKey] && wCfg.world_states[wsKey].color) || "#4a9a4a";
  var clrColor = _buildClrColors()[clrLvl] || "#888";

  // Stat value spans
  var wsVal  = container.querySelector(".dv-ws-val");
  var clrVal = container.querySelector(".dv-clr-val");
  if (wsVal)  { wsVal.textContent  = wsKey;          wsVal.style.color  = wsColor;  }
  if (clrVal) { clrVal.textContent = clrLvl + "-CLR"; clrVal.style.color = clrColor; }

  // Active pill highlight — world state
  container.querySelectorAll(".dv-ws-pill").forEach(function(b) {
    b.classList.toggle("active", b.dataset.ws === wsKey);
  });
  // Active pill highlight — clearance
  container.querySelectorAll(".dv-clr-pill").forEach(function(b) {
    b.classList.toggle("active", b.dataset.clr === clrLvl);
  });
}

// ── Patch tab bar only (no DOM rebuild) ──────────────────────
function patchTabs(container) {
  var id = DEVOUR.state.activeModule;
  // Tab button highlights
  container.querySelectorAll(".dv-tab").forEach(function(b) {
    b.classList.toggle("active", b.dataset.tab === id);
  });
  // Header title text
  var titleEl = container.querySelector(".dv-world-title");
  if (titleEl) titleEl.textContent = getActiveTabDef().label.toUpperCase();
}

function renderShell(container) {
  var wCfg   = DEVOUR.cfg.world;
  var wsKey  = DEVOUR.state._wsOverride  || (wCfg && wCfg.world_state)     || "Stable";
  var clrLvl = DEVOUR.state._clrOverride || (wCfg && wCfg.clearance_level)  || "F";
  var date   = (wCfg && wCfg.active_date) || "--";

  var wsStates  = wCfg ? Object.keys(wCfg.world_states) : ["Stable"];
  var clrRanks  = (wCfg && wCfg.clearance_ranks) || ["F","E","D","C","B","A","S","SS","SSS"];
  var wsColor   = (wCfg && wCfg.world_states[wsKey] && wCfg.world_states[wsKey].color) || "#4a9a4a";
  var clrColors = _buildClrColors();
  var clrColor  = clrColors[clrLvl] || "#888";

  // Active tab label shown as the main title
  var activeTabDef = getActiveTabDef();
  var titleText    = activeTabDef.label.toUpperCase();

  // ── HEADER ───────────────────────────────────────────────
  var header =
    '<div class="dv-header dv-world-header">'
    + '<div class="dv-world-boot">&gt; SYSTEM BOOT SEQUENCE COMPLETE_</div>'
    // Main title = active tab name
    + '<div class="dv-header-title dv-world-title">' + esc(titleText) + '</div>'
    // Sub = "PRIMAL EXPANSE REGISTRY" (static branding)
    + '<div class="dv-header-subtitle">PRIMAL EXPANSE REGISTRY</div>'
    // World state line — ids used by patchHeader()
    + '<div class="dv-world-ws-line">'
    +   '<span class="dv-wsl-label">WORLD STATE: </span>'
    +   '<span class="dv-wsl-val dv-ws-val" style="color:' + wsColor + '">' + esc(wsKey) + '</span>'
    + '</div>'
    // Clearance line — id used by patchHeader()
    + '<div class="dv-world-stat-line">'
    +   '<span class="dv-wsl-label">CLEARANCE: </span>'
    +   '<span class="dv-wsl-val dv-clr-val" style="color:' + clrColor + '">' + esc(clrLvl) + '-CLR</span>'
    + '</div>'
    // Tap-line
    + '<div class="dv-world-tapline" id="dv-tapline">'
    +   '<span class="dv-world-tapline-text">&#9135;&#9135;&#9135; TAP TO CONFIGURE &#9135;&#9135;&#9135;</span>'
    + '</div>'
    // Hidden control panel
    + '<div class="dv-world-controls hidden" id="dv-controls">'
    // World state pills
    + '<div class="dv-world-ctrl-row">'
    +   '<span class="dv-world-ctrl-label">World State</span>'
    +   '<div class="dv-world-pill-group">';

  wsStates.forEach(function(ws) {
    var c = (wCfg && wCfg.world_states[ws] && wCfg.world_states[ws].color) || "#888";
    var active = ws === wsKey ? " active" : "";
    header += '<button class="dv-pill dv-ws-pill' + active + '" data-ws="' + esc(ws) + '" style="color:' + c + '">' + esc(ws) + '</button>';
  });

  header += '</div></div>'
    // Clearance pills
    + '<div class="dv-world-ctrl-row">'
    +   '<span class="dv-world-ctrl-label">Clearance</span>'
    +   '<div class="dv-world-pill-group">';

  clrRanks.forEach(function(cl) {
    var c = clrColors[cl] || "#888";
    var active = cl === clrLvl ? " active" : "";
    header += '<button class="dv-pill dv-clr-pill' + active + '" data-clr="' + esc(cl) + '" style="color:' + c + '">' + esc(cl) + '-CLR</button>';
  });

  // Date row — editable input writes back to world-config.json
  header += '</div></div>'
    + '<div class="dv-world-ctrl-row dv-date-row">'
    +   '<span class="dv-world-ctrl-label">Date</span>'
    +   '<div class="dv-date-field">'
    +     '<input id="dv-date-input" class="dv-date-input" type="text" value="' + esc(date) + '" '
    +       'placeholder="e.g. Year 3, Day 14" />'
    +     '<button class="dv-date-save" id="dv-date-save" title="Save date">&#10003;</button>'
    +   '</div>'
    + '</div>'
    // Dev tools row — force reload + config reload
    + '<div class="dv-world-ctrl-row dv-devtools-row">'
    +   '<span class="dv-world-ctrl-label">Dev Tools</span>'
    +   '<div class="dv-devtools-group">'
    +     '<button class="dv-dev-btn dv-dev-btn-full" id="dv-btn-force-reload" title="Clear module cache and reload active module">&#x1F504; Force Reload</button>'
    +     '<button class="dv-dev-btn dv-dev-btn-full" id="dv-btn-cfg-reload"   title="Re-read all config JSON files">&#x2699;&#xFE0F; Reload Configs</button>'
    +     '<button class="dv-dev-btn dv-dev-btn-full' + (DEVOUR.state.showAuthorNotes ? ' dv-dev-btn-active' : '') + '" id="dv-btn-author-notes" title="Show/hide author notes in all modules">&#x270E; Author Notes: ' + (DEVOUR.state.showAuthorNotes ? 'ON' : 'OFF') + '</button>'
    +   '</div>'
    + '</div>'
    + '</div>'  // close dv-world-controls
    + '</div>'; // close dv-header

  // ── TABS (3-per-row grid) ─────────────────────────────────
  var tabHtml = '<div class="dv-tabs" id="dv-tabs-bar">';
  for (var i = 0; i < TAB_DEFS.length; i++) {
    var t   = TAB_DEFS[i];
    var cls = "dv-tab" + (DEVOUR.state.activeModule === t.id ? " active" : "");
    tabHtml += '<button class="' + cls + '" data-tab="' + t.id + '">'
             + '<span class="tab-icon">' + t.icon + '</span>' + t.label + '</button>';
  }
  tabHtml += '</div>';

  // ── MODALS (kept for legacy module use) ───────────────────
  var wsOpts  = wsStates.map(function(k) { return {value:k, label:k}; });
  var clrOpts = clrRanks.map(function(r) { return {value:r, label:r+"-Clearance"}; });
  var modals  = buildShellModal("ws",  "World State",     wsOpts,  wsKey,  "ws")
              + buildShellModal("clr", "Clearance Level", clrOpts, clrLvl, "clr");

  // ── PANEL ─────────────────────────────────────────────────
  var panel = '<div class="dv-panel-wrap" id="dv-panel">'
            + '<div class="dv-loading" id="dv-panel-loading">Loading module...</div>'
            + '</div>';

  container.innerHTML = modals
    + '<div class="dv-root">' + header + tabHtml + panel + '</div>';

  // ── EVENTS ───────────────────────────────────────────────

  // Tap-line toggle
  var tapLine  = container.querySelector("#dv-tapline");
  var controls = container.querySelector("#dv-controls");
  var panelOpen = false;
  tapLine.addEventListener("click", function() {
    panelOpen = !panelOpen;
    controls.classList.toggle("hidden", !panelOpen);
    tapLine.classList.toggle("open", panelOpen);
  });

  // World state pills — patch in-place, no full re-render
  container.querySelectorAll(".dv-ws-pill").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      DEVOUR.state._wsOverride = btn.dataset.ws;
      await savePersistedOverrides();
      patchHeader(container);
    });
  });

  // Clearance pills — patch in-place, no full re-render
  container.querySelectorAll(".dv-clr-pill").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      DEVOUR.state._clrOverride = btn.dataset.clr;
      await savePersistedOverrides();
      patchHeader(container);
    });
  });

  // Tabs — patch tab bar + title, then mount new module panel
  container.querySelectorAll(".dv-tab").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      DEVOUR.state.activeModule = btn.dataset.tab;
      await savePersistedOverrides();
      patchTabs(container);
      mountActiveModule(container);
    });
  });

  // Editable date — save on ✓ button or Enter key
  var dateInput = container.querySelector("#dv-date-input");
  var dateSave  = container.querySelector("#dv-date-save");
  async function saveDateValue() {
    var val = dateInput ? dateInput.value.trim() : "";
    if (!val || !DEVOUR.cfg.world) return;
    DEVOUR.cfg.world.active_date = val;
    await DEVOUR.utils.saveConfig("world-config", DEVOUR.cfg.world);
    // Flash the save button to confirm
    if (dateSave) { dateSave.textContent = "✓"; setTimeout(function() { dateSave.textContent = "✓"; }, 800); }
    console.log("[DEVOUR] Date saved:", val);
  }
  if (dateSave)  dateSave.addEventListener("click", saveDateValue);
  if (dateInput) dateInput.addEventListener("keydown", function(e) { if (e.key === "Enter") saveDateValue(); });

  // 🔄 Force-reload: clear module cache for active module then remount
  var btnForce = container.querySelector("#dv-btn-force-reload");
  if (btnForce) {
    btnForce.addEventListener("click", async function() {
      var id     = DEVOUR.state.activeModule;
      var tabDef = getActiveTabDef();
      console.log("[DEVOUR] Force-reload:", id);
      delete DEVOUR.modules[id];
      delete _loadedModules[tabDef.module];
      await mountActiveModule(container);
    });
  }

  // ⚙️ Config hot-reload: re-read all JSON configs then remount current module
  var btnCfg = container.querySelector("#dv-btn-cfg-reload");
  if (btnCfg) {
    btnCfg.addEventListener("click", async function() {
      var t0 = performance.now();
      btnCfg.disabled = true;
      btnCfg.textContent = "…";
      console.log("[DEVOUR] Config reload started");
      var results = await Promise.all([
        loadJSON("config/world-config.json"),
        loadJSON("config/economy-reference.json"),
        loadJSON("config/region-config.json"),
        loadJSON("config/currency-reference.json"),
        loadJSON("config/assets-cache.json"),
        loadJSON("config/shops-config.json"),
        loadJSON("config/region-lore.json"),
        loadJSON("config/region-assets-cache.json"),
      ]);
      DEVOUR.cfg.world             = results[0] || DEVOUR.cfg.world;
      DEVOUR.cfg.economy           = results[1] || DEVOUR.cfg.economy;
      DEVOUR.cfg.regions           = results[2] || DEVOUR.cfg.regions;
      DEVOUR.cfg.currency          = results[3] || DEVOUR.cfg.currency;
      DEVOUR.cfg.assets            = results[4] || DEVOUR.cfg.assets;
      DEVOUR.cfg.shops             = results[5] || DEVOUR.cfg.shops;
      DEVOUR.cfg.regionLore        = results[6] || DEVOUR.cfg.regionLore;
      DEVOUR.cfg.regionAssetsCache = results[7] || DEVOUR.cfg.regionAssetsCache;
      var ms = (performance.now() - t0).toFixed(1);
      console.log("[DEVOUR] Config reload complete (" + ms + "ms)");
      btnCfg.disabled = false;
      btnCfg.textContent = "⚙️";
      // Re-render shell so header reflects any world-config changes, then remount
      renderShell(container);
      await mountActiveModule(container);
    });
  }

  // ✎ Author Notes toggle — flip flag, persist, patch button label in-place, remount module only
  var btnAuthor = container.querySelector("#dv-btn-author-notes");
  if (btnAuthor) {
    btnAuthor.addEventListener("click", async function() {
      DEVOUR.state.showAuthorNotes = !DEVOUR.state.showAuthorNotes;
      await savePersistedOverrides();
      // Patch button label and active state without rebuilding shell DOM
      var isOn = DEVOUR.state.showAuthorNotes;
      btnAuthor.textContent = "✎ Author Notes: " + (isOn ? "ON" : "OFF");
      btnAuthor.classList.toggle("dv-dev-btn-active", isOn);
      // Remount module so showAuthorNotes is re-read
      await mountActiveModule(container);
    });
  }

  // Legacy modal opts
  container.querySelectorAll(".dv-modal-opt").forEach(function(btn) {
    btn.addEventListener("click", async function() {
      if (btn.dataset.state === "ws")  DEVOUR.state._wsOverride  = btn.dataset.val;
      if (btn.dataset.state === "clr") DEVOUR.state._clrOverride = btn.dataset.val;
      await savePersistedOverrides();
      container.querySelectorAll(".dv-modal-overlay").forEach(function(m) { m.classList.remove("open"); });
      patchHeader(container);
    });
  });

  container.querySelectorAll(".dv-modal-dismiss").forEach(function(btn) {
    btn.addEventListener("click", function() {
      container.querySelectorAll(".dv-modal-overlay").forEach(function(m) { m.classList.remove("open"); });
    });
  });
  container.querySelectorAll(".dv-modal-overlay").forEach(function(ov) {
    ov.addEventListener("click", function(e) {
      if (e.target === ov) ov.classList.remove("open");
    });
  });
}

// ── 10. MODULE MOUNT ─────────────────────────────────────────
var _loadedModules = {};

async function mountActiveModule(container) {
  var t0     = performance.now();
  var id     = DEVOUR.state.activeModule;
  var tabDef = null;
  for (var i = 0; i < TAB_DEFS.length; i++) {
    if (TAB_DEFS[i].id === id) { tabDef = TAB_DEFS[i]; break; }
  }
  if (!tabDef) {
    console.warn("[DEVOUR] mountActiveModule: unknown module id:", id, "— falling back to first tab");
    DEVOUR.state.activeModule = TAB_DEFS[0].id;
    tabDef = TAB_DEFS[0];
  }

  var panel = container.querySelector("#dv-panel");
  if (!panel) return;

  // ── Load the .js file if not yet cached ──────────────────
  if (!DEVOUR.modules[id]) {
    panel.innerHTML = '<div class="dv-loading">Loading ' + esc(tabDef.label) + '...</div>';
    if (!_loadedModules[tabDef.module]) {
      var result = await loadModule(tabDef.module);
      _loadedModules[tabDef.module] = result;
      if (!result.ok) {
        var errMsg = esc((result.error && result.error.message) || "Unknown error");
        panel.innerHTML =
          '<div class="dv-error">'
          + '<strong>Failed to load module:</strong> ' + esc(tabDef.module) + '<br>'
          + '<span class="dv-error-detail">' + errMsg + '</span><br><br>'
          + '<button class="dv-pill dv-retry-btn" id="dv-retry-btn">&#x21BA; Retry</button>'
          + '</div>';
        var retryBtn = panel.querySelector("#dv-retry-btn");
        if (retryBtn) retryBtn.addEventListener("click", function() { mountActiveModule(container); });
        return;
      }
    }
  }

  // ── Render ───────────────────────────────────────────────
  if (DEVOUR.modules[id]) {
    try {
      var t1 = performance.now();
      DEVOUR.modules[id](DEVOUR, panel, DEVOUR.state);
      DEVOUR.utils.upgradeSelects(panel);
      var ms = (performance.now() - t0).toFixed(1);
      console.log("[DEVOUR] Module mounted:", id, "(" + ms + "ms total)");
    } catch(e) {
      var errMsg = esc(e.message || String(e));
      panel.innerHTML =
        '<div class="dv-error">'
        + '<strong>Module error:</strong> ' + esc(id) + '<br>'
        + '<span class="dv-error-detail">' + errMsg + '</span><br><br>'
        + '<button class="dv-pill dv-retry-btn" id="dv-retry-btn">&#x21BA; Retry</button>'
        + '</div>';
      var retryBtn = panel.querySelector("#dv-retry-btn");
      if (retryBtn) retryBtn.addEventListener("click", function() { mountActiveModule(container); });
      console.error("[DEVOUR] Module render error:", id, e);
    }
  } else {
    panel.innerHTML = '<div class="dv-loading" style="color:var(--dv-muted)">Module <em>'
      + esc(tabDef.label) + '</em> not yet implemented.</div>';
  }
}

// ── 11. BOOTSTRAP ────────────────────────────────────────────
(async function(C) {

  var tBoot = performance.now();
  console.log("[DEVOUR] Bootstrap start");

  // ── Boot screen helpers ───────────────────────────────────
  // Steps: index matches cfgFiles order + 2 extras at end (state + module)
  var BOOT_STEPS = [
    { key: "state",       label: "Restoring session state" },
    { key: "world",       label: "world-config.json" },
    { key: "economy",     label: "economy-reference.json" },
    { key: "regions",     label: "region-config.json" },
    { key: "currency",    label: "currency-reference.json" },
    { key: "assets",      label: "assets-cache.json" },
    { key: "shops",       label: "shops-config.json" },
    { key: "regionLore",  label: "region-lore.json" },
    { key: "regionAssets",label: "region-assets-cache.json" },
    { key: "shell",       label: "Initialising shell" },
    { key: "module",      label: "Loading active module" },
  ];
  var TOTAL = BOOT_STEPS.length;

  function renderBootScreen(doneCount) {
    var pct = Math.round((doneCount / TOTAL) * 100);
    var stepsHtml = BOOT_STEPS.map(function(s, i) {
      var state = i < doneCount ? "done" : (i === doneCount ? "active" : "");
      var icon  = i < doneCount ? "&#x2713;" : (i === doneCount ? "&#x25B6;" : "&#x25A1;");
      return '<div class="dv-boot-step ' + state + '" id="dv-bstep-' + s.key + '">'
        + '<span class="dv-boot-step-icon">' + icon + '</span>'
        + '<span class="dv-boot-step-label">' + s.label + '</span>'
        + '<span class="dv-boot-step-ms" id="dv-bms-' + s.key + '"></span>'
        + '</div>';
    }).join("");

    C.innerHTML = '<div class="dv-boot-screen">'
      +   '<div class="dv-boot-title">DEVOUR SYSTEM</div>'
      +   '<div class="dv-boot-sub">PRIMAL EXPANSE REGISTRY — BOOT SEQUENCE</div>'
      +   '<div class="dv-boot-bar-wrap"><div class="dv-boot-bar" id="dv-boot-bar" style="width:' + pct + '%"></div></div>'
      +   '<div class="dv-boot-steps">' + stepsHtml + '</div>'
      + '</div>';
  }

  // Advance one step: mark previous done with timing, activate next
  function bootTick(stepKey, ms, isError) {
    var stepEl = C.querySelector("#dv-bstep-" + stepKey);
    var msEl   = C.querySelector("#dv-bms-"   + stepKey);
    if (!stepEl) return;
    stepEl.classList.remove("active");
    stepEl.classList.add(isError ? "error" : "done");
    stepEl.querySelector(".dv-boot-step-icon").innerHTML = isError ? "&#x2717;" : "&#x2713;";
    if (msEl && ms !== null) msEl.textContent = ms + "ms";
    // Advance progress bar
    var doneCount = C.querySelectorAll(".dv-boot-step.done, .dv-boot-step.error").length;
    var barEl = C.querySelector("#dv-boot-bar");
    if (barEl) barEl.style.width = Math.round((doneCount / TOTAL) * 100) + "%";
    // Activate next step
    var nextStep = null;
    for (var i = 0; i < BOOT_STEPS.length; i++) {
      if (BOOT_STEPS[i].key === stepKey && i + 1 < BOOT_STEPS.length) {
        nextStep = BOOT_STEPS[i + 1];
        break;
      }
    }
    if (nextStep) {
      var nextEl = C.querySelector("#dv-bstep-" + nextStep.key);
      if (nextEl) {
        nextEl.classList.add("active");
        nextEl.querySelector(".dv-boot-step-icon").innerHTML = "&#x25B6;";
      }
    }
  }

  // ── Render initial boot screen ────────────────────────────
  renderBootScreen(0);

  // ── Step: restore session state ───────────────────────────
  var t0 = performance.now();
  await loadPersistedOverrides();
  bootTick("state", (performance.now() - t0).toFixed(0));

  // ── Steps: config files (sequential for live progress) ───
  var cfgDefs = [
    { key: "world",        path: "config/world-config.json"        },
    { key: "economy",      path: "config/economy-reference.json"    },
    { key: "regions",      path: "config/region-config.json"        },
    { key: "currency",     path: "config/currency-reference.json"   },
    { key: "assets",       path: "config/assets-cache.json"         },
    { key: "shops",        path: "config/shops-config.json"         },
    { key: "regionLore",   path: "config/region-lore.json"          },
    { key: "regionAssets", path: "config/region-assets-cache.json"  },
  ];

  var cfgResults = {};
  for (var ci = 0; ci < cfgDefs.length; ci++) {
    var def = cfgDefs[ci];
    var ct0 = performance.now();
    var r   = await loadJSON(def.path);
    var cms = (performance.now() - ct0).toFixed(0);
    cfgResults[def.key] = r;
    bootTick(def.key, cms, !r);
    console.log("[DEVOUR] Config loaded: " + def.path + " (" + cms + "ms)" + (r ? "" : " ⚠ null"));
  }

  DEVOUR.cfg.world             = cfgResults.world;
  DEVOUR.cfg.economy           = cfgResults.economy;
  DEVOUR.cfg.regions           = cfgResults.regions;
  DEVOUR.cfg.currency          = cfgResults.currency;
  DEVOUR.cfg.assets            = cfgResults.assets            || { svg: {}, webp: {} };
  DEVOUR.cfg.shops             = cfgResults.shops             || { shops: [] };
  DEVOUR.cfg.regionLore        = cfgResults.regionLore        || { regions: [] };
  DEVOUR.cfg.regionAssetsCache = cfgResults.regionAssets      || { global: {}, regions: {} };

  if (!DEVOUR.cfg.world || !DEVOUR.cfg.regions) {
    // Mark shell step as error and show message below screen
    var shellEl = C.querySelector("#dv-bstep-shell");
    if (shellEl) { shellEl.classList.add("error"); shellEl.querySelector(".dv-boot-step-icon").innerHTML = "&#x2717;"; }
    var screen = C.querySelector(".dv-boot-screen");
    if (screen) screen.insertAdjacentHTML("beforeend",
      '<div style="margin-top:18px;padding:10px 14px;border:1px solid #cc2200;border-radius:4px;'
      + 'font-size:10px;color:#e05555;letter-spacing:0.06em;max-width:340px;width:100%">'
      + '&#x26A0; Missing required config files.<br>'
      + 'world-config.json or region-config.json not found.<br>'
      + 'Check your config/ folder.</div>');
    return;
  }

  // ── Step: shell init ──────────────────────────────────────
  var st0 = performance.now();
  // Brief yield so the last config tick paints before shell wipes the DOM
  await new Promise(function(res) { setTimeout(res, 40); });
  renderShell(C);
  DEVOUR.utils.initSelectObserver(C);
  bootTick("shell", (performance.now() - st0).toFixed(0));  // won't be visible — DOM replaced

  // ── Step: active module ───────────────────────────────────
  var mt0 = performance.now();
  await mountActiveModule(C);
  // Module step is already inside the new shell DOM (not boot screen), so just log
  console.log("[DEVOUR] Module step: " + (performance.now() - mt0).toFixed(0) + "ms");

  var totalMs = (performance.now() - tBoot).toFixed(1);
  console.log("[DEVOUR] Bootstrap complete (" + totalMs + "ms)");

})(this.container);
```



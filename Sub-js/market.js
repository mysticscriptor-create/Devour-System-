// ╔══════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — MARKET MODULE  v7.0                        ║
// ║  Registered as: DEVOUR.modules["market"]                    ║
// ║  Depends on:    DEVOUR.cfg.world / .regions / .currency     ║
// ║  Items from:    Inventory/<Category>/(<Sub>/)*.md           ║
// ║  Exports:       DEVOUR._sharedItems (for shop module)       ║
// ╚══════════════════════════════════════════════════════════════╝

DEVOUR.modules["market"] = function(DEVOUR, container, shellState) {

// ── ALIAS SHARED UTILS ───────────────────────────────────────
var el   = DEVOUR.utils.el;
var div  = DEVOUR.utils.div;
var span = DEVOUR.utils.span;
var esc  = DEVOUR.utils.escapeHtml;

// ── CONFIGS ──────────────────────────────────────────────────
var WORLD_CFG  = DEVOUR.cfg.world;
var REGION_CFG = DEVOUR.cfg.regions;
var CURR_CFG   = DEVOUR.cfg.currency;

var REGIONS      = REGION_CFG.regions;
var TRADE_ROUTES = REGION_CFG.trade_routes;
var SCARCITY     = REGION_CFG.scarcity;
var TUNNEL_PAIRS = REGION_CFG.tunnel_benefit_pairs;
var SEA_PAIRS    = REGION_CFG.sea_only_pairs;
var BRIDGE_PAIRS = REGION_CFG.prime_bridge_pairs;
var ACTIVE_DATE  = WORLD_CFG.active_date;
var CLEARANCE_RANKS = WORLD_CFG.clearance_ranks;
var _DEFAULT_WSK = WORLD_CFG.world_state;
var _DEFAULT_CLR = WORLD_CFG.clearance_level;

// ── CONSTANTS ────────────────────────────────────────────────
var MAJOR_CATS = [
  "Weapons","Armor","Equipment","Consumables",
  "Supplements","Materials","Crystals","Cores",
  "Creatures","Artifacts","Information","Services"
];

var ROUTE_MUL = {0:1.00,1:1.10,2:1.30,3:1.60,4:2.00,5:2.60};

var PHASE_MOD = {"-":0.80,"":1.00,"+":1.25,"++":1.50,"+++":2.00};

var RARITY_MOD = {
  "Common":1.0,"Uncommon":1.5,"Rare":3.0,
  "Epic":6.0,"Legendary":15.0,"Unique":40.0,"Mythic":100.0
};

var BM_MULT = {
  "bm-low":1.30,"bm-mid":1.60,"bm-high":2.20,
  "bm-critical":3.50,"bm-foreign":2.80
};

var BM_CRITICAL_FLOOR = 5000000;
var GRAY_DISCOUNT      = 0.65;

var RANK_COLORS = {
  "F":"#888","E":"#4aaa4a","D":"#4a8fff","C":"#cc44cc",
  "B":"#ff8c00","A":"#ff4444","S":"#ffdd00","SS":"#ff88ff","SSS":"#00ffee"
};

var RARITY_COLORS = {
  "Common":"#607080","Uncommon":"#4a9a4a","Rare":"#4a8fff",
  "Epic":"#aa44cc","Legendary":"#ff8c00","Unique":"#ff4444","Mythic":"#00ffee"
};

// ── MODULE STATE ─────────────────────────────────────────────
// Kept in a closure so tab switches don't reset it
if (!DEVOUR._mktState) {
  DEVOUR._mktState = {
    viewRegion:   "Aethelgard Reach",
    activeTab:    "legal",
    search:       "",
    rankFilter:   "all",
    catFilter:    "all",
    rarityFilter: "all",
    subFilter:    "all",
    sortKey:      "name",
    sortDir:      "asc",
    showHidden:   false,
    showUSD:      false,
  };
}
var state = DEVOUR._mktState;

// ── PERSISTENCE: World State & Clearance ─────────────────────
var PERSIST_PATH = "config/devour-state.json";

function loadPersistedState() {
  try {
    var f = app.vault.getAbstractFileByPath(PERSIST_PATH);
    if (f) {
      var raw = app.vault.cachedRead(f);
      var parsed = JSON.parse(raw);
      if (parsed._wsOverride)  shellState._wsOverride  = parsed._wsOverride;
      if (parsed._clrOverride) shellState._clrOverride = parsed._clrOverride;
      DEVOUR._persistedLoaded = true;
    }
  } catch(e) {
    console.log("[DEVOUR Market] No persisted state yet.", e);
  }
}

function savePersistedState() {
  try {
    var data = {
      _wsOverride:  shellState._wsOverride  || null,
      _clrOverride: shellState._clrOverride || null,
      savedAt:      new Date().toISOString()
    };
    var f = app.vault.getAbstractFileByPath(PERSIST_PATH);
    var content = JSON.stringify(data, null, 2);
    if (f) app.vault.modify(f, content);
    else   app.vault.create(PERSIST_PATH, content);
  } catch(e) {
    console.error("[DEVOUR Market] Failed to persist state:", e);
  }
}

// Load persisted overrides on first module load
if (!DEVOUR._persistedLoaded) {
  loadPersistedState();
}

// ── WORLD STATE HELPERS ──────────────────────────────────────
function getWorldState(wsKey) {
  return WORLD_CFG.world_states[wsKey] || WORLD_CFG.world_states["Stable"];
}
function getWorldFlux(ws, cat) { return (ws.category_flux && ws.category_flux[cat]) || 1.0; }
function getBMFlux(ws, tier)   { return (ws.bm_tier_flux  && ws.bm_tier_flux[tier]) || 1.0; }
function isBMHidden(ws, tier)  { return (ws.hide_bm_tiers || []).indexOf(tier) !== -1; }
function isForeignSusp(ws)     { return ws.foreign_suspended === true; }

// ── CLEARANCE ────────────────────────────────────────────────
function clrIdx(rank) { return CLEARANCE_RANKS.indexOf((rank || "F").toUpperCase()); }
function isRedacted(rank, clrLvl) { return clrIdx(rank) > clrIdx(clrLvl); }

// ── PRICING ──────────────────────────────────────────────────
function formatPrice(raw, showUSD) {
  var result;
  if (raw < 10000) {
    result = {amount: Math.round(raw).toLocaleString(), symbol: "credits", short: "c", cls: "price-credit"};
  } else if (raw < 500000000) {
    var c = raw / 10000;
    var g = c >= 1000 ? "High" : c >= 100 ? "Mid" : "Low";
    result = {
      amount: c < 10 ? c.toFixed(2) : Math.round(c).toLocaleString(),
      symbol: g + " Crystal", short: g + " c", cls: "price-crystal"
    };
  } else {
    var cores = raw / 500000000;
    result = {
      amount: cores < 10 ? cores.toFixed(3) : cores.toFixed(1),
      symbol: "Core", short: "Core", cls: "price-core"
    };
  }
  if (showUSD) {
    var uv = raw * 0.50;
    if      (uv >= 1000000000) result.usd = "$" + (uv/1000000000).toFixed(1) + "B";
    else if (uv >= 1000000)    result.usd = "$" + (uv/1000000).toFixed(1)    + "M";
    else if (uv >= 1000)       result.usd = "$" + Math.round(uv/1000)        + "K";
    else                       result.usd = "$" + Math.round(uv).toLocaleString();
  }
  return result;
}

function isPair(pairs, a, b) {
  for (var i = 0; i < pairs.length; i++) {
    if ((pairs[i][0]===a && pairs[i][1]===b) || (pairs[i][1]===a && pairs[i][0]===b)) return true;
  }
  return false;
}

function getRouteCost(o, d) {
  if (!o || !d || o === d) return 0;
  var cost = (TRADE_ROUTES[o] && TRADE_ROUTES[o][d] !== undefined) ? TRADE_ROUTES[o][d] : 3;
  if (isPair(TUNNEL_PAIRS, o, d)) cost = Math.max(1, cost - 1);
  return cost;
}

function getRouteTag(o, d) {
  if (!o || !d || o === d) return "";
  var tags = [];
  if (isPair(TUNNEL_PAIRS, o, d))  tags.push(span("rtag rtag-tunnel",  "Tunnels"));
  if (isPair(SEA_PAIRS, o, d))     tags.push(span("rtag rtag-sea",     "Sea Only"));
  if (isPair(BRIDGE_PAIRS, o, d))  tags.push(span("rtag rtag-bridge",  "Prime-Bridge"));
  return tags.join(" ");
}

function calcPrice(item, region, ws, shopMod) {
  var sv = (item.starting_value && Number(item.starting_value) > 0)
           ? Number(item.starting_value) : 0;
  if (!sv) return 0;
  var pm  = PHASE_MOD[item.phase || ""]          || 1.0;
  var rar = RARITY_MOD[item.rarity || "Common"]  || 1.0;
  var orig = item.origin || "Aethelgard Reach";
  var cost = getRouteCost(orig, region);
  var rm2  = ROUTE_MUL[cost] || 1.0;
  var sc   = orig !== region ? (SCARCITY[orig] || 1.0) : 1.0;
  var wf   = getWorldFlux(ws, item.major_cat);
  var sm   = (shopMod !== undefined && shopMod !== null) ? (1 + shopMod / 100) : 1.0;
  var p    = sv * pm * rar * rm2 * sc * wf * sm;
  if (item.bm_tier) {
    p *= BM_MULT[item.bm_tier] || 1.0;
    p *= getBMFlux(ws, item.bm_tier);
  }
  if (item.bm_tier === "bm-critical") p = Math.max(p, BM_CRITICAL_FLOOR);
  return Math.round(p);
}

// ── DATA LOADING ─────────────────────────────────────────────
function parsePath(path) {
  var parts = path.replace(/\\/g, "/").split("/");
  var ii = -1;
  for (var i = 0; i < parts.length; i++) { if (parts[i] === "Inventory") { ii = i; break; } }
  if (ii === -1) return {major: "Other", sub: ""};
  var after = parts.slice(ii + 1);
  var major = after[0] || "Other";
  var sub   = (after.length >= 3 && after[1].indexOf(".") === -1) ? after[1] : "";
  return {major: major, sub: sub};
}

function loadItems(showHidden) {
  return dv.pages('"Inventory"').array().map(function(p) {
    var ps = parsePath(p.file.path);
    return {
      name:           p.file.name,
      path:           p.file.path,
      major_cat:      ps.major,
      sub_cat:        p.subcategory || ps.sub,
      rank:           p.rank            || "F",
      phase:          p.phase           || "",
      origin:         p.origin          || "Aethelgard Reach",
      rarity:         p.rarity          || "Common",
      starting_value: p.starting_value  || null,
      market_legal:   p.market_legal    || false,
      market_gray:    p.market_gray     || false,
      market_black:   p.market_black    || false,
      bm_tier:        p.black_market_tier || null,
      lore_hidden:    p.lore_hidden     || false,
      commission:     p.commission      || false,
      reward:         p.reward          || null,
      poster:         p.poster          || "",
      difficulty:     p.difficulty      || "",
      description:    p.description     || "",
      shop_bind:      p.shop_bind       || null,
    };
  }).filter(function(i) { return showHidden ? true : !i.lore_hidden; });
}

// ── EXPORT ITEMS FOR SHOP MODULE ─────────────────────────────
function exportItemsForShop(wsKey, clrLvl) {
  DEVOUR._sharedItems = loadItems(state.showHidden);
  DEVOUR._sharedState = {
    wsKey:   wsKey,
    clrLvl:  clrLvl,
    showUSD: state.showUSD,
  };
}

// ── BADGE BUILDERS ───────────────────────────────────────────
function rankBadge(rank) {
  var r   = (rank || "F").toUpperCase();
  var col = RANK_COLORS[r] || "#888";
  return '<span class="badge rank-badge" style="color:' + col + ';border-color:' + col + '40">' + r + '</span>';
}
function phaseBadge(phase) {
  if (!phase) return "";
  var col = phase==="-" ? "#ff6040" : phase==="+++" ? "#b080ff" : phase==="++" ? "#80a8ff" : "#506070";
  return '<span class="badge phase-badge" style="color:' + col + '">' + phase + '</span>';
}
function rarityTag(rarity) {
  var col = RARITY_COLORS[rarity || "Common"] || "#607080";
  return '<span class="tag-rarity" style="color:' + col + '">' + esc(rarity || "Common") + '</span>';
}
function layerBadge(tier) {
  var map = {
    "legal":       {cls:"layer-legal",    label:"Legal"},
    "gray":        {cls:"layer-gray",     label:"Gray"},
    "bm-low":      {cls:"layer-black",    label:"Street"},
    "bm-mid":      {cls:"layer-black",    label:"Mid"},
    "bm-high":     {cls:"layer-black",    label:"Deep"},
    "bm-critical": {cls:"layer-critical", label:"CORE"},
    "bm-foreign":  {cls:"layer-foreign",  label:"Foreign"}
  };
  var l = map[tier] || {cls:"layer-gray", label:tier};
  return '<span class="layer-badge ' + l.cls + '">' + l.label + '</span>';
}
function distPips(cost) {
  var h = "";
  for (var i = 1; i <= 5; i++) {
    var cls = "dp";
    if (i <= cost) { cls += " dp-on"; if (cost >= 5) cls += " hostile"; else if (cost >= 4) cls += " far"; }
    h += '<span class="' + cls + '"></span>';
  }
  return '<span class="dist-pips">' + h + '</span>';
}
function getLayer(item) {
  if (item.bm_tier)      return item.bm_tier;
  if (item.market_legal) return "legal";
  if (item.market_gray)  return "gray";
  return "bm-low";
}

// ── ITEM DETAIL POPUP ─────────────────────────────────────────
function openItemPopup(item, viewRegion, ws, clrLvl, showUSD) {
  // Remove any existing popup
  var existing = document.getElementById("dv-item-popup-overlay");
  if (existing) existing.parentNode.removeChild(existing);

  var orig    = item.origin || "Aethelgard Reach";
  var cost    = getRouteCost(orig, viewRegion);
  var rtag    = getRouteTag(orig, viewRegion);
  var layer   = getLayer(item);
  var rawLocal = calcPrice(item, viewRegion, ws, 0);
  var rawOrig  = calcPrice(item, orig, ws, 0);

  // Price block
  var priceBlock = "";
  if (!rawLocal) {
    priceBlock = '<span class="price-missing">— no value set —</span>';
  } else {
    var fmtL = formatPrice(rawLocal, showUSD);
    priceBlock = '<div class="pop-price-row">'
      + '<span class="pop-price-label">Price (' + esc(viewRegion) + ')</span>'
      + '<span class="' + fmtL.cls + ' pop-price-val">' + fmtL.amount + ' ' + fmtL.symbol + '</span>'
      + (fmtL.usd ? '<span class="price-usd">' + fmtL.usd + '</span>' : '')
      + '</div>';
    if (orig !== viewRegion && rawOrig) {
      var fmtO = formatPrice(rawOrig, false);
      priceBlock += '<div class="pop-price-row">'
        + '<span class="pop-price-label">Source price (' + esc(orig) + ')</span>'
        + '<span class="' + fmtO.cls + ' pop-price-val">' + fmtO.amount + ' ' + fmtO.symbol + '</span>'
        + '</div>';
    }
    if (item.market_legal && item.market_gray) {
      var fmtG = formatPrice(Math.round(rawLocal * GRAY_DISCOUNT), false);
      priceBlock += '<div class="pop-price-row">'
        + '<span class="pop-price-label">Gray market price</span>'
        + '<span class="' + fmtG.cls + ' pop-price-val">' + fmtG.amount + ' ' + fmtG.symbol + '</span>'
        + '</div>';
    }
  }

  // Market availability row
  var mkts = [];
  if (item.market_legal) mkts.push('<span class="layer-badge layer-legal">Legal</span>');
  if (item.market_gray)  mkts.push('<span class="layer-badge layer-gray">Gray</span>');
  if (item.market_black && item.bm_tier) mkts.push(layerBadge(item.bm_tier));
  var mktRow = mkts.join(" ") || '<span class="layer-badge layer-gray">Unknown</span>';

  // Route info
  var routeRow = "";
  if (orig !== viewRegion) {
    routeRow = '<div class="pop-detail-row">'
      + '<span class="pop-detail-label">Trade route</span>'
      + '<span class="pop-detail-val">' + distPips(cost) + ' ' + (rtag || '') + '</span>'
      + '</div>';
  }

  // Commission fields (if commission item)
  var commBlock = "";
  if (item.commission) {
    commBlock = '<div class="pop-section-title">Contract Details</div>'
      + (item.difficulty ? '<div class="pop-detail-row"><span class="pop-detail-label">Min Rank</span><span class="pop-detail-val">' + rankBadge(item.difficulty) + '</span></div>' : '')
      + (item.poster     ? '<div class="pop-detail-row"><span class="pop-detail-label">Posted by</span><span class="pop-detail-val">' + esc(item.poster) + '</span></div>' : '');
  }

  // Description
  var descBlock = item.description
    ? '<div class="pop-section-title">Description</div><div class="pop-desc">' + esc(item.description) + '</div>'
    : '';

  // Open in vault link
  var openLink = '<a class="pop-open-link" href="' + item.path + '">Open in vault ↗</a>';

  var catLine = item.sub_cat ? item.major_cat + ' › ' + item.sub_cat : item.major_cat;

  var overlay = document.createElement("div");
  overlay.id = "dv-item-popup-overlay";
  overlay.className = "dv-popup-overlay";
  overlay.innerHTML =
    '<div class="dv-popup-panel" id="dv-popup-panel">' +
      // Header
      '<div class="pop-header">' +
        '<div class="pop-header-left">' +
          '<div class="pop-name">' + esc(item.name) + (item.lore_hidden ? ' <span class="hidden-tag">HIDDEN</span>' : '') + '</div>' +
          '<div class="pop-meta">' + rankBadge(item.rank) + ' ' + phaseBadge(item.phase) + ' ' + rarityTag(item.rarity) + ' ' + layerBadge(layer) + '</div>' +
        '</div>' +
        '<button class="pop-close" id="dv-popup-close">✕</button>' +
      '</div>' +
      // Body
      '<div class="pop-body">' +
        // Left column
        '<div class="pop-col">' +
          '<div class="pop-section-title">Origin & Category</div>' +
          '<div class="pop-detail-row"><span class="pop-detail-label">Origin</span><span class="pop-detail-val">' + esc(orig) + '</span></div>' +
          '<div class="pop-detail-row"><span class="pop-detail-label">Category</span><span class="pop-detail-val">' + esc(catLine) + '</span></div>' +
          '<div class="pop-detail-row"><span class="pop-detail-label">Rank</span><span class="pop-detail-val">' + rankBadge(item.rank) + (item.phase ? ' ' + phaseBadge(item.phase) : '') + '</span></div>' +
          '<div class="pop-detail-row"><span class="pop-detail-label">Rarity</span><span class="pop-detail-val">' + rarityTag(item.rarity) + '</span></div>' +
          routeRow +
          commBlock +
        '</div>' +
        // Right column
        '<div class="pop-col">' +
          '<div class="pop-section-title">Market & Pricing</div>' +
          '<div class="pop-detail-row"><span class="pop-detail-label">Available</span><span class="pop-detail-val">' + mktRow + '</span></div>' +
          priceBlock +
        '</div>' +
      '</div>' +
      // Description
      (descBlock ? '<div class="pop-desc-block">' + descBlock + '</div>' : '') +
      // Footer
      '<div class="pop-footer">' + openLink + '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) overlay.parentNode.removeChild(overlay);
  });
  // Close button
  var closeBtn = overlay.querySelector("#dv-popup-close");
  if (closeBtn) closeBtn.addEventListener("click", function() {
    overlay.parentNode.removeChild(overlay);
  });
  // Close on Escape
  function onKey(e) {
    if (e.key === "Escape") {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener("keydown", onKey);
    }
  }
  document.addEventListener("keydown", onKey);

  // Animate in
  requestAnimationFrame(function() { overlay.classList.add("dv-popup-in"); });
}

// ── CARD BUILDERS ────────────────────────────────────────────
function buildCard(item, viewRegion, ws, clrLvl, showUSD, shopMod) {
  var layer  = getLayer(item);
  var orig   = item.origin || "Aethelgard Reach";
  var cost   = getRouteCost(orig, viewRegion);
  var rtag   = getRouteTag(orig, viewRegion);

  if (isRedacted(item.rank, clrLvl)) {
    return div("item-card item-card-redacted",
      div("card-top",
        '<span class="card-name redact-name">[REDACTED]</span>' +
        '<span class="card-price redact-price">[CLEARANCE REQUIRED]</span>'
      ) +
      div("card-mid", rankBadge(item.rank) + " " + phaseBadge(item.phase) + " " + layerBadge(layer)) +
      div("card-bot", '<span class="card-origin">&#9679; Classified</span>' + distPips(cost))
    );
  }

  var rawLocal = calcPrice(item, viewRegion, ws, shopMod);
  var sameReg  = orig === viewRegion;

  var priceInner;
  if (!rawLocal) {
    priceInner = '<span class="price-missing" title="starting_value not set">— no value —</span>';
  } else {
    var fmtL = formatPrice(rawLocal, showUSD);
    priceInner = '<span class="' + fmtL.cls + ' card-price-val">' + fmtL.amount + ' ' + fmtL.symbol + '</span>';
    if (fmtL.usd) priceInner += '<span class="price-usd">' + fmtL.usd + '</span>';
    if (!sameReg) {
      var fmtO = formatPrice(calcPrice(item, orig, ws, 0), false);
      priceInner += '<span class="' + fmtO.cls + ' card-price-origin">' + fmtO.amount + ' ' + fmtO.symbol + ' @ src</span>';
    }
    if (item.market_legal && item.market_gray) {
      var fmtG = formatPrice(Math.round(rawLocal * GRAY_DISCOUNT), false);
      priceInner += '<span class="' + fmtG.cls + ' card-price-gray">gray: ' + fmtG.amount + ' ' + fmtG.symbol + '</span>';
    }
  }

  var hiddenTag = item.lore_hidden ? '<span class="hidden-tag"> HIDDEN</span>' : "";
  var catLine   = item.sub_cat ? item.major_cat + " > " + item.sub_cat : item.major_cat;

  return '<div class="item-card" data-item-path="' + esc(item.path) + '">' +
    div("card-top",
      '<span class="card-name"><a href="' + item.path + '" onclick="event.stopPropagation()">' + esc(item.name) + '</a>' + hiddenTag + '</span>' +
      '<span class="card-price">' + priceInner + '</span>'
    ) +
    div("card-mid",
      rankBadge(item.rank) + " " + phaseBadge(item.phase) + " " + rarityTag(item.rarity) + " " + layerBadge(layer)
    ) +
    div("card-bot",
      '<span class="card-origin">&#8857; ' + esc(orig) + '</span>' +
      '<span class="card-cat"> ' + esc(catLine) + '</span>' +
      '<span class="card-route">' + distPips(cost) + " " + rtag + '</span>'
    ) +
  '</div>';
}

function buildCards(items, viewRegion, ws, clrLvl, sortKey, sortDir, showUSD, shopMod) {
  if (!items.length) return div("no-results", "-- No items --");
  var rankOrder   = ["F","E","D","C","B","A","S","SS","SSS"];
  var rarityOrder = ["Common","Uncommon","Rare","Epic","Legendary","Unique","Mythic"];
  var sorted = items.slice().sort(function(a,b) {
    var va, vb;
    if (sortKey === "price") {
      va = calcPrice(a,viewRegion,ws,shopMod); vb = calcPrice(b,viewRegion,ws,shopMod);
    } else if (sortKey === "rank") {
      va = rankOrder.indexOf((a.rank||"F").toUpperCase());
      vb = rankOrder.indexOf((b.rank||"F").toUpperCase());
    } else if (sortKey === "rarity") {
      va = rarityOrder.indexOf(a.rarity||"Common");
      vb = rarityOrder.indexOf(b.rarity||"Common");
    } else {
      va = (a[sortKey]||"").toString().toLowerCase();
      vb = (b[sortKey]||"").toString().toLowerCase();
    }
    if (va < vb) return sortDir === "asc" ? -1 : 1;
    if (va > vb) return sortDir === "asc" ?  1 : -1;
    return 0;
  });
  return div("card-grid", sorted.map(function(i) { return buildCard(i,viewRegion,ws,clrLvl,showUSD,shopMod); }).join(""));
}

function buildCommissionCard(item, viewRegion, ws, showUSD) {
  var rawReward = item.reward
    ? formatPrice(Number(String(item.reward).replace(/[^0-9]/g,"")), showUSD) : null;
  var diffColors = {"F":"#888","E":"#4aaa4a","D":"#4a8fff","C":"#cc44cc","B":"#ff8c00","A":"#ff4444"};
  var diffCol = diffColors[(item.difficulty||"").toUpperCase()] || "#607080";
  var rewardHtml = rawReward
    ? '<span class="' + rawReward.cls + ' card-price-val">' + rawReward.amount + ' ' + rawReward.symbol + '</span>'
    : '<span class="price-credit card-price-val">' + esc(item.reward || "Negotiable") + '</span>';
  var diffHtml  = item.difficulty
    ? '<span class="badge rank-badge" style="color:' + diffCol + ';border-color:' + diffCol + '40">' + esc(item.difficulty) + '</span> ' : "";
  var posterHtml = item.poster ? '<span class="commission-poster">via ' + esc(item.poster) + '</span>' : "";
  var desc = item.description || "";
  var descHtml = desc.length > 70 ? esc(desc.slice(0,70)) + "..." : esc(desc);
  return div("item-card commission-card",
    div("card-top",
      '<span class="card-name"><a href="' + item.path + '">' + esc(item.name) + '</a></span>' +
      '<span class="card-price">' + rewardHtml + '</span>'
    ) +
    div("card-mid", diffHtml + '<span class="tag-rarity" style="color:#607080">' + esc(item.major_cat) + '</span> ' + posterHtml) +
    div("card-bot",
      '<span class="card-origin">&#8857; ' + esc(item.origin || "Unknown") + '</span>' +
      '<span class="card-cat card-desc">' + descHtml + '</span>'
    )
  );
}

// ── SECTION / SORT / SELECT BUILDERS ─────────────────────────
function sectionTitle(label, colorVar) {
  var style = colorVar ? 'style="color:' + colorVar + ';border-color:' + colorVar + '"' : '';
  return '<div class="market-section-title" ' + style + '>' + label + '</div>';
}
function suspendedBar(label) { return div("bm-suspended", label); }

function buildSelect(id, options, currentVal, icon) {
  var opts = "";
  for (var i = 0; i < options.length; i++) {
    var o   = options[i];
    var val = typeof o === "object" ? o.value : o;
    var lbl = typeof o === "object" ? o.label : o;
    opts += '<option value="' + esc(val) + '"' + (val === currentVal ? ' selected' : '') + '>' + esc(lbl) + '</option>';
  }
  var dataIcon = icon ? ' data-icon="' + icon + '"' : '';
  return '<select class="mkt-sel mkt-sel-icon" id="' + id + '"' + dataIcon + '>' + opts + '</select>';
}

function rankOpts()   { return [{value:"all",label:"All Ranks"}].concat(["F","E","D","C","B","A","S","SS","SSS"].map(function(r){ return {value:r,label:r}; })); }
function rarityOpts() { return [{value:"all",label:"All Rarities"}].concat(["Common","Uncommon","Rare","Epic","Legendary","Unique","Mythic"].map(function(r){ return {value:r,label:r}; })); }
function catOpts()    { return [{value:"all",label:"All Categories"}].concat(MAJOR_CATS.map(function(c){ return {value:c,label:c}; })); }
function sortOpts()   { return [
  {value:"name",label:"Name"},
  {value:"rank",label:"Rank"},
  {value:"price",label:"Price"},
  {value:"rarity",label:"Rarity"},
  {value:"origin",label:"Origin"}
]; }

// ── FILTER ───────────────────────────────────────────────────
function filterItems(items, search, rankFilter, catFilter, rarityFilter, subFilter) {
  return items.filter(function(i) {
    if (search) {
      var q = search.toLowerCase();
      var fields = [i.name, i.major_cat, i.sub_cat, i.origin, i.rarity, i.description];
      var found = false;
      for (var fi = 0; fi < fields.length; fi++) {
        if ((fields[fi]||"").toLowerCase().indexOf(q) !== -1) { found = true; break; }
      }
      if (!found) return false;
    }
    if (rankFilter   && rankFilter   !== "all" && (i.rank||"F").toUpperCase() !== rankFilter.toUpperCase()) return false;
    if (catFilter    && catFilter    !== "all" && i.major_cat !== catFilter)    return false;
    if (rarityFilter && rarityFilter !== "all" && (i.rarity||"Common") !== rarityFilter) return false;
    if (subFilter    && subFilter    !== "all" && (i.sub_cat||"")  !== subFilter)  return false;
    return true;
  });
}

// ── MAIN RENDER ──────────────────────────────────────────────
function render(container, st) {
  var wsKey  = shellState._wsOverride  || _DEFAULT_WSK;
  var clrLvl = shellState._clrOverride || _DEFAULT_CLR;
  var ws     = getWorldState(wsKey);

  var ALL_ITEMS  = loadItems(false);
  var ALL_HIDDEN = loadItems(true);
  var ITEMS      = loadItems(st.showHidden);

  // Export for shop module
  exportItemsForShop(wsKey, clrLvl);

  var filtered = filterItems(ITEMS, st.search, st.rankFilter, st.catFilter, st.rarityFilter, st.subFilter);

  var visible = filtered.filter(function(i) {
    if (i.bm_tier && isBMHidden(ws, i.bm_tier)) return false;
    if (i.bm_tier === "bm-foreign" && isForeignSusp(ws)) return false;
    return true;
  });

  var legal    = visible.filter(function(i){ return i.market_legal; });
  var gray     = visible.filter(function(i){ return i.market_gray; });
  var bStreet  = visible.filter(function(i){ return i.bm_tier==="bm-low"; });
  var bMid     = visible.filter(function(i){ return i.bm_tier==="bm-mid"; });
  var bDeep    = visible.filter(function(i){ return i.bm_tier==="bm-high"; });
  var critical = visible.filter(function(i){ return i.bm_tier==="bm-critical"; });
  var foreign  = visible.filter(function(i){ return i.bm_tier==="bm-foreign"; });
  var commList = visible.filter(function(i){ return i.commission; });

  var totalItems = ALL_ITEMS.length;
  var legalCount = ALL_ITEMS.filter(function(i){ return i.market_legal; }).length;
  var blackCount = ALL_ITEMS.filter(function(i){ return i.market_black; }).length;
  var critCount  = ALL_ITEMS.filter(function(i){ return i.bm_tier==="bm-critical"; }).length;
  var commCount  = ALL_ITEMS.filter(function(i){ return i.commission; }).length;
  var hiddenCount= ALL_HIDDEN.filter(function(i){ return i.lore_hidden; }).length;

  var subSet = {};
  ITEMS.forEach(function(i) {
    if ((st.catFilter==="all" || i.major_cat===st.catFilter) && i.sub_cat) subSet[i.sub_cat]=1;
  });
  var availSubs = Object.keys(subSet).sort();
  var subOpts = [{value:"all",label:"All Sub"}].concat(availSubs.map(function(s){ return {value:s,label:s}; }));

  var wsColor  = ws.color || "#607080";
  var clrColors = {"F":"#888","E":"#4aaa4a","D":"#4a8fff","C":"#cc44cc","B":"#ff8c00","A":"#ff4444","S":"#ffdd00","SS":"#ff88ff","SSS":"#00ffee"};
  var clrColor  = clrColors[clrLvl] || "#888";

  var worldNotice = "";
  if (wsKey !== "Stable") {
    worldNotice = '<div class="world-notice" style="border-color:' + wsColor + '">'
      + '<span class="wn-label" style="color:' + wsColor + '">' + esc(wsKey.toUpperCase()) + '</span>'
      + '<span class="wn-desc">' + esc(ws.description) + '</span>'
      + '</div>';
  }

  var statsBar = div("market-stats",
    div("stat-item", '<span class="sl">Items</span><span class="sv hi">'     + totalItems + '</span>') +
    div("stat-item", '<span class="sl">Legal</span><span class="sv">'        + legalCount + '</span>') +
    div("stat-item", '<span class="sl">Black</span><span class="sv">'        + blackCount + '</span>') +
    div("stat-item", '<span class="sl">Core</span><span class="sv" style="color:var(--dv-danger)">'   + critCount  + '</span>') +
    div("stat-item", '<span class="sl">Jobs</span><span class="sv" style="color:var(--dv-warn)">'     + commCount  + '</span>') +
    div("stat-item", '<span class="sl">Hidden</span><span class="sv" style="color:#304050">' + hiddenCount + '</span>')
  );

  // Redesigned controls: compact, no external labels
  var regionOpts = REGIONS.map(function(r){ return {value:r,label:r}; });
  var controls = div("ctrl-wrap",
    // Row 1: dropdowns only with icons
    div("ctrl-row ctrl-dropdowns",
      buildSelect("ctrl-region", regionOpts,  st.viewRegion, "&#127758;") +
      buildSelect("ctrl-rank",   rankOpts(),  st.rankFilter, "&#9733;") +
      buildSelect("ctrl-cat",    catOpts(),   st.catFilter, "&#9638;") +
      buildSelect("ctrl-sub",    subOpts,     st.subFilter, "&#9641;") +
      buildSelect("ctrl-rarity", rarityOpts(), st.rarityFilter, "&#9670;") +
      buildSelect("ctrl-sort",   sortOpts(),  st.sortKey, "&#8693;")
    ) +
    // Row 2: search + toggle buttons
    div("ctrl-row ctrl-search-row",
      '<input class="mkt-input" id="ctrl-search" placeholder="Search items..." value="' + esc(st.search) + '">' +
      '<button class="mkt-btn' + (st.showHidden?" mkt-btn-active":"") + '" id="btn-author" title="Toggle hidden items">' + (st.showHidden?"&#128065;":"&#128065;") + '</button>' +
      '<button class="mkt-btn' + (st.showUSD?   " mkt-btn-active":"") + '" id="btn-usd" title="Toggle USD display">' + (st.showUSD?"&#36; ON":"&#36; OFF") + '</button>'
    )
  );

  var tabDefs = [
    {id:"legal",      label:"Legal"},
    {id:"gray",       label:"Gray"},
    {id:"black",      label:"Black"},
    {id:"commission", label:"Jobs"},
    {id:"regional",   label:"Regional"}
  ];
  var tabHtml = '<div class="market-tabs" id="market-tabs-bar">';
  for (var ti = 0; ti < tabDefs.length; ti++) {
    var td  = tabDefs[ti];
    var cls = "market-tab" + (st.activeTab===td.id ? " tab-active tab-" + td.id : "");
    tabHtml += '<button class="' + cls + '" data-mtab="' + td.id + '">' + td.label + '</button>';
  }
  tabHtml += '</div>';

  function panel(id, inner) {
    return '<div class="market-panel' + (st.activeTab===id?" active":"") + '" id="mpanel-' + id + '">' + inner + '</div>';
  }

  var vr = st.viewRegion;
  var sk = st.sortKey;
  var sd = st.sortDir;
  var su = st.showUSD;

  var critBox = "";
  if (critical.length) {
    critBox = '<div class="critical-lockbox" id="critical-lockbox">'
      + '<div class="critical-lockbox-header" id="clh">! Classified -- Core Trade<span class="clh-toggle">&#9662;</span></div>'
      + '<div class="critical-lockbox-body">'
      + '<div class="critical-warning">Priority-One ICA contraband. Terminal classification on sight.</div>'
      + buildCards(critical, vr, ws, clrLvl, sk, sd, su, 0)
      + '</div></div>';
  }

  var blackPanel =
    (isBMHidden(ws,"bm-low")  ? suspendedBar("Street Level -- Underground (" + wsKey + ")")   : sectionTitle("Street Level","#cc7a00") + buildCards(bStreet, vr, ws, clrLvl, sk, sd, su, 0)) +
    (isBMHidden(ws,"bm-mid")  ? suspendedBar("Mid-Market -- Underground (" + wsKey + ")")     : sectionTitle("Mid-Market","#cc7a00")   + buildCards(bMid,    vr, ws, clrLvl, sk, sd, su, 0)) +
    sectionTitle("Deep Market","#cc7a00") + buildCards(bDeep, vr, ws, clrLvl, sk, sd, su, 0) +
    (isForeignSusp(ws)         ? suspendedBar("Foreign Trade -- Suspended (" + wsKey + ")")   : sectionTitle("Foreign -- Anchor Port","#7a4acc") + buildCards(foreign, vr, ws, clrLvl, sk, sd, su, 0)) +
    critBox;

  var commCards = commList.length
    ? div("card-grid", commList.map(function(i){ return buildCommissionCard(i,vr,ws,su); }).join(""))
    : div("no-results","-- No active contracts --");

  // Sort indicator
  var sortIndicator = st.sortDir === "asc" ? " &#9650;" : " &#9660;";

  var html = '<div class="mkt-root">'
    + worldNotice + statsBar + controls + tabHtml
    + panel("legal",      sectionTitle("ICA-Licensed Market","#4a9eff") + buildCards(legal, vr, ws, clrLvl, sk, sd, su, 0))
    + panel("gray",       sectionTitle("Gray Market -- Off-CME","#9098a8") + buildCards(gray, vr, ws, clrLvl, sk, sd, su, 0))
    + panel("black",      blackPanel)
    + panel("commission",
        sectionTitle("Commission Board -- Active Contracts","#cc7a00") +
        '<div class="commission-note">12% processing fee on all completed contracts.</div>' +
        commCards
      )
    + panel("regional",   sectionTitle("Regional Market — " + esc(vr),"#70c090") + buildCards(visible.filter(function(i){ return (i.origin||"") === vr; }), vr, ws, clrLvl, sk, sd, su, 0))
    + '</div>';

  container.innerHTML = html;

  // ── SHELL STATE PERSISTENCE ──
  // When world state or clearance changes, persist to vault
  function persistAndRender() {
    savePersistedState();
    render(container, st);
  }

  // ── EVENTS ──
  // Inner tab switching
  container.querySelectorAll(".market-tab").forEach(function(btn) {
    btn.addEventListener("click", function() {
      st.activeTab = btn.dataset.mtab;
      render(container, st);
    });
  });

  // Controls - all dropdowns
  var selBindings = {
    "ctrl-region": function(v){ st.viewRegion   = v; },
    "ctrl-rank":   function(v){ st.rankFilter   = v; },
    "ctrl-cat":    function(v){ st.catFilter    = v; st.subFilter = "all"; },
    "ctrl-sub":    function(v){ st.subFilter    = v; },
    "ctrl-rarity": function(v){ st.rarityFilter = v; },
    "ctrl-sort":   function(v){ st.sortKey = v; st.sortDir = "asc"; },
  };
  Object.keys(selBindings).forEach(function(id) {
    var el2 = container.querySelector("#" + id);
    if (el2) el2.addEventListener("change", function(e) {
      selBindings[id](e.target.value);
      render(container, st);
    });
  });

  // Sort direction toggle: clicking same sort select toggles direction
  var sortEl = container.querySelector("#ctrl-sort");
  if (sortEl) {
    sortEl.addEventListener("mousedown", function(e) {
      // If clicking the same option, toggle direction
      var newVal = e.target.value;
      if (newVal && st.sortKey === newVal) {
        st.sortDir = st.sortDir === "asc" ? "desc" : "asc";
      }
    });
  }

  var searchTimer;
  var searchEl = container.querySelector("#ctrl-search");
  if (searchEl) searchEl.addEventListener("input", function(e) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function(){ st.search = e.target.value; render(container,st); }, 250);
  });

  var authorBtn = container.querySelector("#btn-author");
  if (authorBtn) authorBtn.addEventListener("click", function() {
  st.showHidden = !st.showHidden;
  var _wsKey  = shellState._wsOverride  || _DEFAULT_WSK;
  var _clrLvl = shellState._clrOverride || _DEFAULT_CLR;
  exportItemsForShop(_wsKey, _clrLvl);
  render(container,st);
});

  var usdBtn = container.querySelector("#btn-usd");
  if (usdBtn) usdBtn.addEventListener("click", function() {
    st.showUSD = !st.showUSD;
    shellState.showUSD = st.showUSD;
    render(container,st);
  });

  var clh = container.querySelector("#clh");
  if (clh) clh.addEventListener("click", function() {
    var lb = container.querySelector("#critical-lockbox");
    if (lb) lb.classList.toggle("open");
  });

  // ── CARD CLICK → POPUP ──
  var wsKey2  = shellState._wsOverride  || _DEFAULT_WSK;
  var clrLvl2 = shellState._clrOverride || _DEFAULT_CLR;
  var ws2     = getWorldState(wsKey2);
  var allItems = loadItems(st.showHidden);

  container.querySelectorAll(".item-card[data-item-path]").forEach(function(card) {
    card.addEventListener("click", function(e) {
      // Don't open popup if clicking the vault link
      if (e.target.tagName === "A") return;
      var path = card.getAttribute("data-item-path");
      var item = allItems.filter(function(i){ return i.path === path; })[0];
      if (item) openItemPopup(item, st.viewRegion, ws2, clrLvl2, st.showUSD);
    });
  });

  // ── INJECT POPUP CSS (once) ──
  if (!document.getElementById("dv-popup-styles")) {
    var styleEl = document.createElement("style");
    styleEl.id = "dv-popup-styles";
    styleEl.textContent = [
      ".dv-popup-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .18s ease;}",
      ".dv-popup-overlay.dv-popup-in{opacity:1;}",
      ".dv-popup-panel{background:var(--background-primary,#1a2028);border:1px solid #2a3a4a;border-radius:10px;width:min(680px,94vw);max-height:85vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,0.7);display:flex;flex-direction:column;transform:translateY(12px);transition:transform .18s ease;}",
      ".dv-popup-overlay.dv-popup-in .dv-popup-panel{transform:translateY(0);}",
      ".pop-header{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px 14px;border-bottom:1px solid #1e2e3e;}",
      ".pop-header-left{display:flex;flex-direction:column;gap:6px;}",
      ".pop-name{font-size:1.15em;font-weight:700;color:var(--text-normal,#cdd6e0);line-height:1.2;}",
      ".pop-meta{display:flex;flex-wrap:wrap;gap:5px;align-items:center;}",
      ".pop-close{background:none;border:none;color:#607080;font-size:1.1em;cursor:pointer;padding:2px 6px;border-radius:4px;line-height:1;transition:color .1s;}",
      ".pop-close:hover{color:#cdd6e0;}",
      ".pop-body{display:grid;grid-template-columns:1fr 1fr;gap:0;padding:16px 20px;}",
      "@media(max-width:520px){.pop-body{grid-template-columns:1fr;}}",
      ".pop-col{display:flex;flex-direction:column;gap:6px;padding-right:12px;}",
      ".pop-col+.pop-col{padding-right:0;padding-left:12px;border-left:1px solid #1e2e3e;}",
      ".pop-section-title{font-size:0.7em;letter-spacing:.08em;text-transform:uppercase;color:#506070;margin:10px 0 4px;font-weight:600;}",
      ".pop-detail-row{display:flex;align-items:center;gap:8px;padding:3px 0;border-bottom:1px solid #111a22;}",
      ".pop-detail-label{font-size:0.78em;color:#5a7080;min-width:90px;flex-shrink:0;}",
      ".pop-detail-val{font-size:0.82em;color:#9aafbf;display:flex;align-items:center;gap:4px;flex-wrap:wrap;}",
      ".pop-price-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #111a22;}",
      ".pop-price-label{font-size:0.78em;color:#5a7080;min-width:90px;flex-shrink:0;}",
      ".pop-price-val{font-size:0.95em;font-weight:600;}",
      ".pop-desc-block{padding:4px 20px 16px;border-top:1px solid #1e2e3e;}",
      ".pop-desc{font-size:0.82em;color:#8a9faf;line-height:1.6;margin-top:4px;}",
      ".pop-footer{padding:12px 20px;border-top:1px solid #1e2e3e;display:flex;justify-content:flex-end;}",
      ".pop-open-link{font-size:0.78em;color:#4a8fff;text-decoration:none;opacity:0.8;transition:opacity .1s;}",
      ".pop-open-link:hover{opacity:1;}",
      ".item-card[data-item-path]{cursor:pointer;transition:border-color .12s,box-shadow .12s;}",
      ".item-card[data-item-path]:hover{border-color:#2a4a6a;box-shadow:0 2px 12px rgba(0,0,0,0.4);}",
    ].join("\n");
    document.head.appendChild(styleEl);
  }
}

// ── INIT ─────────────────────────────────────────────────────
if (shellState._wsOverride)  state._wsOverride  = shellState._wsOverride;
if (shellState._clrOverride) state._clrOverride = shellState._clrOverride;

// Sync USD state from shell
state.showUSD = shellState.showUSD || false;

render(container, state);

}; // end DEVOUR.modules["market"]

// ╔══════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — SHOP MODULE  v2.1                          ║
// ║  Registered as: DEVOUR.modules["shop"]                      ║
// ║  Depends on:    DEVOUR.cfg.shops / .regions / .assets       ║
// ║                 DEVOUR._sharedItems (from market)           ║
// ║                 DEVOUR.cfg.world                            ║
// ╚══════════════════════════════════════════════════════════════╝

DEVOUR.modules["shop"] = function(DEVOUR, container, shellState) {

var el   = DEVOUR.utils.el;
var div  = DEVOUR.utils.div;
var span = DEVOUR.utils.span;
var esc  = DEVOUR.utils.escapeHtml;

var WORLD_CFG  = DEVOUR.cfg.world;
var REGION_CFG = DEVOUR.cfg.regions;
var SHOPS_CFG  = DEVOUR.cfg.shops;
var showUSD    = shellState.showUSD || false;

var REGIONS      = REGION_CFG.regions;
var CLEARANCE_RANKS = WORLD_CFG.clearance_ranks;
var MAJOR_CATS = [
  "Weapons","Armor","Equipment","Consumables",
  "Supplements","Materials","Crystals","Cores",
  "Creatures","Artifacts","Information","Services"
];

var GRAY_DISCOUNT = 0.65;
var RANK_MULT = {
  "F":1,"E":8,"D":60,"C":500,"B":4000,
  "A":25000,"S":180000,"SS":1500000,"SSS":12000000
};
var PHASE_MOD = {"-":0.80,"":1.00,"+":1.25,"++":1.50,"+++":2.00};
var RARITY_MOD = {
  "Common":1.0,"Uncommon":1.5,"Rare":3.0,
  "Epic":6.0,"Legendary":15.0,"Unique":40.0,"Mythic":100.0
};
var CAT_FLOOR = {
  "Weapons":200,"Armor":150,"Equipment":130,"Consumables":50,
  "Supplements":2000,"Materials":30,"Crystals":60,"Cores":80,
  "Creatures":500,"Artifacts":400,"Information":200,"Services":100
};
var BM_MULT = {
  "bm-low":1.30,"bm-mid":1.60,"bm-high":2.20,
  "bm-critical":3.50,"bm-foreign":2.80
};
var BM_CRITICAL_FLOOR = 5000000;
var ROUTE_MUL = {0:1.00,1:1.10,2:1.30,3:1.60,4:2.00,5:2.60};

var RANK_COLORS = {
  "F":"#888","E":"#4aaa4a","D":"#4a8fff","C":"#cc44cc",
  "B":"#ff8c00","A":"#ff4444","S":"#ffdd00","SS":"#ff88ff","SSS":"#00ffee"
};
var RARITY_COLORS = {
  "Common":"#607080","Uncommon":"#4a9a4a","Rare":"#4a8fff",
  "Epic":"#aa44cc","Legendary":"#ff8c00","Unique":"#ff4444","Mythic":"#00ffee"
};

// ── MODULE STATE ─────────────────────────────────────────────
if (!DEVOUR._shopState) {
  DEVOUR._shopState = {
    view:        "list",
    editingShop: null,
    detailShop:  null,
  };
}
var state = DEVOUR._shopState;

// ── WORLD STATE HELPERS ──────────────────────────────────────
var wsKey  = shellState._wsOverride  || WORLD_CFG.world_state;
var clrLvl = shellState._clrOverride || WORLD_CFG.clearance_level;
var ws     = WORLD_CFG.world_states[wsKey] || WORLD_CFG.world_states["Stable"];

function getWorldFlux(wsc, cat) { return (wsc.category_flux && wsc.category_flux[cat]) || 1.0; }
function getBMFlux(wsc, tier)   { return (wsc.bm_tier_flux  && wsc.bm_tier_flux[tier]) || 1.0; }
function isBMHidden(wsc, tier)  { return (wsc.hide_bm_tiers || []).indexOf(tier) !== -1; }
function isForeignSusp(wsc)     { return wsc.foreign_suspended === true; }

// ── CLEARANCE ────────────────────────────────────────────────
function clrIdx(rank) { return CLEARANCE_RANKS.indexOf((rank || "F").toUpperCase()); }
function isRedacted(rank, cLvl) { return clrIdx(rank) > clrIdx(cLvl); }

// ── PRICING (mirrored from market) ───────────────────────────
function getLayer(item) {
  if (item.bm_tier)      return item.bm_tier;
  if (item.market_legal) return "legal";
  if (item.market_gray)  return "gray";
  return "bm-low";
}

function isPair(pairs, a, b) {
  for (var i = 0; i < pairs.length; i++) {
    if ((pairs[i][0]===a && pairs[i][1]===b) || (pairs[i][1]===a && pairs[i][0]===b)) return true;
  }
  return false;
}

function getRouteCost(o, d) {
  if (!o || !d || o === d) return 0;
  var TRADE_ROUTES = REGION_CFG.trade_routes;
  var TUNNEL_PAIRS = REGION_CFG.tunnel_benefit_pairs;
  var cost = (TRADE_ROUTES[o] && TRADE_ROUTES[o][d] !== undefined) ? TRADE_ROUTES[o][d] : 3;
  if (isPair(TUNNEL_PAIRS, o, d)) cost = Math.max(1, cost - 1);
  return cost;
}

function calcPrice(item, region, shopMod) {
  var sv  = (item.starting_value && Number(item.starting_value) > 0)
            ? Number(item.starting_value) : (CAT_FLOOR[item.major_cat] || 40);
  var rm  = RANK_MULT[(item.rank || "F").toUpperCase()]  || 1;
  var pm  = PHASE_MOD[item.phase || ""]                  || 1.0;
  var rar = RARITY_MOD[item.rarity || "Common"]          || 1.0;
  var orig = item.origin || "Aethelgard Reach";
  var cost = getRouteCost(orig, region);
  var rm2  = ROUTE_MUL[cost] || 1.0;
  var sc   = orig !== region ? (REGION_CFG.scarcity[orig] || 1.0) : 1.0;
  var wf   = getWorldFlux(ws, item.major_cat);
  var sm   = (shopMod !== undefined && shopMod !== null) ? (1 + shopMod / 100) : 1.0;
  var p    = sv * rm * pm * rar * rm2 * sc * wf * sm;
  if (item.bm_tier) {
    p *= BM_MULT[item.bm_tier] || 1.0;
    p *= getBMFlux(ws, item.bm_tier);
  }
  if (item.bm_tier === "bm-critical") p = Math.max(p, BM_CRITICAL_FLOOR);
  return Math.round(p);
}

function formatPrice(raw) {
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

// ── ITEMS ACCESS ─────────────────────────────────────────────
function getAllItems() {
  return DEVOUR._sharedItems || [];
}

function getShopItems(shop, allItems) {
  return allItems.filter(function(item) {
    if (shop.bound_items && shop.bound_items.length > 0) {
      var bound = shop.bound_items.indexOf(item.name) !== -1 ||
                  shop.bound_items.indexOf(item.path) !== -1;
      if (!bound) return false;
    }
    if (shop.show_categories && shop.show_categories.length > 0) {
      if (shop.show_categories.indexOf(item.major_cat) === -1) return false;
    }
    if (shop.show_layers && shop.show_layers.length > 0) {
      var layer = getLayer(item);
      if (shop.show_layers.indexOf(layer) === -1) return false;
    }
    if (shop.max_rank) {
      var rankOrder = ["F","E","D","C","B","A","S","SS","SSS"];
      var itemRankIdx = rankOrder.indexOf((item.rank||"F").toUpperCase());
      var capIdx = rankOrder.indexOf(shop.max_rank.toUpperCase());
      if (itemRankIdx > capIdx) return false;
    }
    return true;
  });
}

// ── SHOP HELPERS ─────────────────────────────────────────────
function getShops() { return (SHOPS_CFG && SHOPS_CFG.shops) ? SHOPS_CFG.shops : []; }

function saveShops(shops) {
  SHOPS_CFG.shops = shops;
  DEVOUR.cfg.shops = SHOPS_CFG;
  try {
    var f = app.vault.getAbstractFileByPath("config/shops-config.json");
    var content = JSON.stringify(SHOPS_CFG, null, 2);
    if (f) app.vault.modify(f, content);
    else   app.vault.create("config/shops-config.json", content);
  } catch(e) {
    console.error("[DEVOUR Shop] Failed to save shops:", e);
  }
}

function saveAssets() {
  try {
    var f = app.vault.getAbstractFileByPath("config/assets-cache.json");
    var content = JSON.stringify(DEVOUR.cfg.assets, null, 2);
    if (f) app.vault.modify(f, content);
    else   app.vault.create("config/assets-cache.json", content);
  } catch(e) {
    console.error("[DEVOUR Shop] Failed to save assets:", e);
  }
}

function genShopId() {
  return "shop_" + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
}

function getShopById(id) {
  var shops = getShops();
  for (var i = 0; i < shops.length; i++) { if (shops[i].id === id) return shops[i]; }
  return null;
}

// ── DATA URI NORMALIZER ──────────────────────────────────────
// Ensures raw SVG text or base64 data gets turned into a usable data URI
function toDataUri(raw) {
  if (!raw) return "";
  if (raw.indexOf("data:") === 0) return raw;
  var trimmed = raw.trim();
  if (trimmed.indexOf("<svg") === 0 || trimmed.indexOf("<?xml") === 0) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(trimmed);
  }
  // Assume base64 without prefix
  return "data:image/webp;base64," + trimmed;
}

// ── ASSET RENDERING ──────────────────────────────────────────
function renderShopIcon(shop, size) {
  size = size || 32;
  if (shop._icon_data_uri) {
    var uri = toDataUri(shop._icon_data_uri);
    return '<img class="shop-icon-img" src="' + uri + '" width="' + size + '" height="' + size + '" style="object-fit:cover;border-radius:3px" />';
  }
  if (shop.icon_key) {
    var svg = DEVOUR.utils.getAssetSVG(shop.icon_key);
    if (svg) {
      return '<span class="shop-icon-svg" style="width:' + size + 'px;height:' + size + 'px;display:inline-block">'
           + svg + '</span>';
    }
    var img = DEVOUR.utils.getAssetImg(shop.icon_key);
    if (img) {
      return '<img class="shop-icon-img" src="' + img + '" width="' + size + '" height="' + size + '" style="object-fit:cover;border-radius:3px" />';
    }
  }
  return '<span class="shop-icon-placeholder" style="font-size:' + (size*0.6) + 'px">&#9876;</span>';
}

function renderShopBgStyle(shop) {
  var uri = "";
  if (shop._bg_data_uri) {
    uri = toDataUri(shop._bg_data_uri);
  } else if (shop.bg_key) {
    var svg = DEVOUR.utils.getAssetSVG(shop.bg_key);
    if (svg) {
      uri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    } else {
      var img = DEVOUR.utils.getAssetImg(shop.bg_key);
      if (img) uri = img;
    }
  }
  if (!uri) return "";
  return 'background-image:url("' + uri + '");background-size:cover;background-position:center;';
}

// ── FILE PICKER & CACHE ──────────────────────────────────────
function setupFilePicker(container, inputId, previewId, cacheType, onCache) {
  var inp = container.querySelector("#" + inputId);
  if (!inp) return;

  inp.addEventListener("change", function(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(evt) {
      var result = evt.target.result;
      var mime = file.type || "image/webp";

      if (mime.indexOf("svg") !== -1 || file.name.toLowerCase().endsWith(".svg")) {
        var svgText = result;
        if (result.indexOf("data:") === 0) {
          svgText = decodeURIComponent(result.split(",")[1] || result);
        }
        var key = "shop_" + Date.now().toString(36);
        if (!DEVOUR.cfg.assets.svg) DEVOUR.cfg.assets.svg = {};
        DEVOUR.cfg.assets.svg[key] = svgText;
        saveAssets();
        // Pass a proper data URI for preview / storage
        var dataUri = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);
        if (onCache) onCache(key, dataUri);
      } else {
        var key = "shop_" + Date.now().toString(36);
        if (!DEVOUR.cfg.assets.webp) DEVOUR.cfg.assets.webp = {};
        var b64 = result;
        if (result.indexOf("data:") === 0) {
          b64 = result.split(",")[1];
        }
        DEVOUR.cfg.assets.webp[key] = { data: b64, mime: mime };
        saveAssets();
        if (onCache) onCache(key, result);
      }
    };

    if (file.name.toLowerCase().endsWith(".svg")) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

// ── BADGE BUILDERS ───────────────────────────────────────────
function rankBadge(rank) {
  var r = (rank || "F").toUpperCase();
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
function getRouteTag(o, d) {
  if (!o || !d || o === d) return "";
  var TUNNEL_PAIRS = REGION_CFG.tunnel_benefit_pairs;
  var SEA_PAIRS    = REGION_CFG.sea_only_pairs;
  var BRIDGE_PAIRS = REGION_CFG.prime_bridge_pairs;
  var tags = [];
  if (isPair(TUNNEL_PAIRS, o, d))  tags.push(span("rtag rtag-tunnel",  "Tunnels"));
  if (isPair(SEA_PAIRS, o, d))     tags.push(span("rtag rtag-sea",     "Sea Only"));
  if (isPair(BRIDGE_PAIRS, o, d))  tags.push(span("rtag rtag-bridge",  "Prime-Bridge"));
  return tags.join(" ");
}

// ── CARD BUILDERS ────────────────────────────────────────────
function buildCard(item, shopMod) {
  var layer  = getLayer(item);
  var orig   = item.origin || "Aethelgard Reach";
  var shopRegion = state.detailShop ? (getShopById(state.detailShop)?.region || "Aethelgard Reach") : "Aethelgard Reach";
  var cost   = getRouteCost(orig, shopRegion);
  var rtag   = getRouteTag(orig, shopRegion);

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

  var rawLocal = calcPrice(item, shopRegion, shopMod);
  var fmtL     = formatPrice(rawLocal);
  var sameReg  = orig === shopRegion;

  var priceInner = '<span class="' + fmtL.cls + ' card-price-val">' + fmtL.amount + ' ' + fmtL.symbol + '</span>';
  if (fmtL.usd) priceInner += '<span class="price-usd">' + fmtL.usd + '</span>';
  if (!sameReg) {
    var fmtO = formatPrice(calcPrice(item, orig, 0));
    priceInner += '<span class="' + fmtO.cls + ' card-price-origin">' + fmtO.amount + ' ' + fmtO.symbol + ' @ src</span>';
  }
  if (item.market_legal && item.market_gray) {
    var fmtG = formatPrice(Math.round(rawLocal * GRAY_DISCOUNT));
    priceInner += '<span class="' + fmtG.cls + ' card-price-gray">gray: ' + fmtG.amount + ' ' + fmtG.symbol + '</span>';
  }

  var hiddenTag = item.lore_hidden ? '<span class="hidden-tag"> HIDDEN</span>' : "";
  var catLine   = item.sub_cat ? item.major_cat + " > " + item.sub_cat : item.major_cat;

  return div("item-card",
    div("card-top",
      '<span class="card-name"><a href="' + item.path + '">' + esc(item.name) + '</a>' + hiddenTag + '</span>' +
      '<span class="card-price">' + priceInner + '</span>'
    ) +
    div("card-mid",
      rankBadge(item.rank) + " " + phaseBadge(item.phase) + " " + rarityTag(item.rarity) + " " + layerBadge(layer)
    ) +
    div("card-bot",
      '<span class="card-origin">&#8857; ' + esc(orig) + '</span>' +
      '<span class="card-cat"> ' + esc(catLine) + '</span>' +
      '<span class="card-route">' + distPips(cost) + " " + rtag + '</span>'
    )
  );
}

function buildCards(items, shopMod) {
  if (!items.length) return div("no-results", "-- No items in this shop --");
  return div("card-grid", items.map(function(i) { return buildCard(i, shopMod); }).join(""));
}

function sectionTitle(label, colorVar) {
  var style = colorVar ? 'style="color:' + colorVar + ';border-color:' + colorVar + '"' : '';
  return '<div class="market-section-title" ' + style + '>' + esc(label) + '</div>';
}

// ── SELECT BUILDER ───────────────────────────────────────────
function buildSelect(id, options, currentVal) {
  var opts = "";
  for (var i = 0; i < options.length; i++) {
    var o   = options[i];
    var val = typeof o === "object" ? o.value : o;
    var lbl = typeof o === "object" ? o.label : o;
    opts += '<option value="' + esc(val) + '"' + (val === currentVal ? ' selected' : '') + '>' + esc(lbl) + '</option>';
  }
  return '<select class="mkt-sel" id="' + id + '">' + opts + '</select>';
}

// ── SHOP LIST VIEW ───────────────────────────────────────────
function buildShopListPanel() {
  var shops = getShops();
  var html  = '<div class="shop-list-header">' +
    '<span class="shop-list-title">Registered Markets &amp; Shops</span>' +
    '<button class="mkt-btn shop-create-btn" id="btn-shop-create">+ New Shop</button>' +
    '</div>';

  if (!shops.length) {
    html += div("no-results", "-- No shops registered. Create one to get started. --");
  } else {
    html += '<div class="shop-cards">';
    for (var i = 0; i < shops.length; i++) {
      var s = shops[i];
      var bgStyle = renderShopBgStyle(s);
      var hasModifier = s.city_modifier !== null && s.city_modifier !== undefined && s.city_modifier !== 0;
      var modLabel = hasModifier
        ? '<span class="shop-mod-badge ' + (s.city_modifier > 0 ? "mod-pos" : "mod-neg") + '">' +
          (s.city_modifier > 0 ? "+" : "") + s.city_modifier + '%</span>'
        : '';

      html += '<div class="shop-card" data-shopid="' + s.id + '">' +
        (bgStyle ? '<div class="shop-card-bg" style="' + bgStyle + '"></div>' : '') +
        '<div class="shop-card-inner">' +
        '<div class="shop-card-top">' +
        '<span class="shop-card-icon">' + renderShopIcon(s, 28) + '</span>' +
        '<span class="shop-card-name">' + esc(s.name) + '</span>' +
        modLabel +
        '</div>' +
        '<div class="shop-card-meta">' +
        '<span class="shop-region-tag">' + esc(s.region || "--") + '</span>' +
        (s.city ? '<span class="shop-city-tag">' + esc(s.city) + '</span>' : '') +
        '</div>' +
        '<div class="shop-card-cats">' +
        (s.show_categories && s.show_categories.length ? s.show_categories.slice(0,4).map(function(c){ return '<span class="shop-cat-pill">' + esc(c) + '</span>'; }).join("") : '<span class="shop-cat-pill muted">All Categories</span>') +
        '</div>' +
        '<div class="shop-card-actions">' +
        '<button class="mkt-btn-sm shop-view-btn" data-shopid="' + s.id + '">View</button>' +
        '<button class="mkt-btn-sm shop-edit-btn" data-shopid="' + s.id + '">Edit</button>' +
        '<button class="mkt-btn-sm shop-del-btn danger" data-shopid="' + s.id + '">&#10005;</button>' +
        '</div>' +
        '</div></div>';
    }
    html += '</div>';
  }
  return html;
}

// ── SHOP FORM ────────────────────────────────────────────────
function buildShopForm(initialData) {
  var isEdit = !!initialData;
  var d = initialData || {
    id: null, name: "", region: REGIONS[0], city: "",
    city_modifier: 0,
    icon_key: "", bg_key: "",
    _icon_data_uri: "", _bg_data_uri: "",
    show_categories: [],
    show_layers: ["legal"],
    max_rank: "",
    bound_items: [],
    notes: "",
  };

  var regionOpts = REGIONS.map(function(r){ return {value:r,label:r}; });
  var layerChoices = [
    {val:"legal",label:"Legal"},
    {val:"gray",label:"Gray"},
    {val:"bm-low",label:"Street BM"},
    {val:"bm-mid",label:"Mid BM"},
    {val:"bm-high",label:"Deep BM"},
    {val:"bm-foreign",label:"Foreign"},
  ];
  var rankOps = ["","F","E","D","C","B","A","S","SS","SSS"].map(function(r){ return {value:r,label:r||"No Cap"}; });

  var layerBoxes = layerChoices.map(function(lc) {
    var checked = (d.show_layers || []).indexOf(lc.val) !== -1 ? " checked" : "";
    return '<label class="shop-check-label"><input type="checkbox" class="shop-layer-cb" value="' + lc.val + '"' + checked + '> ' + lc.label + '</label>';
  }).join("");

  var catBoxes = MAJOR_CATS.map(function(c) {
    var checked = (d.show_categories || []).indexOf(c) !== -1 ? " checked" : "";
    return '<label class="shop-check-label"><input type="checkbox" class="shop-cat-cb" value="' + esc(c) + '"' + checked + '> ' + c + '</label>';
  }).join("");

  var svgKeys  = Object.keys((DEVOUR.cfg.assets && DEVOUR.cfg.assets.svg)  || {});
  var webpKeys = Object.keys((DEVOUR.cfg.assets && DEVOUR.cfg.assets.webp) || {});
  var allAssetKeys = svgKeys.concat(webpKeys);
  var assetKeyOpts = [""].concat(allAssetKeys).map(function(k){ return {value:k,label:k||"-- None --"}; });

  var html = '<div class="shop-form">' +
    '<div class="shop-form-title">' + (isEdit ? 'Edit Shop: ' + esc(d.name) : 'Create New Shop / Market') + '</div>';

  html += '<div class="sf-section-title">Basic Info</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">Name</label>' +
    '  <input class="sf-input" id="sf-name" type="text" placeholder="e.g. The Iron Ledger" value="' + esc(d.name) + '">' +
    '</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">Region</label>' +
    buildSelect("sf-region", regionOpts, d.region) +
    '</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">City</label>' +
    '  <input class="sf-input" id="sf-city" type="text" placeholder="City name (optional)" value="' + esc(d.city || "") + '">' +
    '</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">City Price Modifier</label>' +
    '  <div class="sf-modifier-wrap">' +
    '    <input class="sf-input sf-modifier" id="sf-modifier" type="number" min="-90" max="500" step="1" value="' + (d.city_modifier || 0) + '">' +
    '    <span class="sf-modifier-unit">%</span>' +
    '    <span class="sf-modifier-hint">(negative = discount, positive = markup)</span>' +
    '  </div>' +
    '</div>';

  html += '<div class="sf-section-title">Visuals</div>';

  html += '<div class="sf-row sf-file-row">' +
    '<label class="sf-label">Shop Icon</label>' +
    '<div class="sf-file-wrap">' +
    '<label class="sf-file-label">' +
    '<input type="file" id="sf-icon-file" accept=".svg,image/*" style="display:none">' +
    '<span class="sf-file-btn">&#128444; Choose File</span>' +
    '</label>' +
    '<span class="sf-file-hint">SVG or image</span>' +
    '<div class="sf-file-preview" id="sf-icon-preview">' + (d._icon_data_uri ? '<img src="' + toDataUri(d._icon_data_uri) + '" style="max-height:40px;max-width:40px;border-radius:3px">' : (d.icon_key ? '<span class="sf-file-cached">Cached: ' + esc(d.icon_key) + '</span>' : '<span class="sf-file-none">No icon</span>')) + '</div>' +
    '</div></div>';

  html += '<div class="sf-row sf-file-row">' +
    '<label class="sf-label">Background</label>' +
    '<div class="sf-file-wrap">' +
    '<label class="sf-file-label">' +
    '<input type="file" id="sf-bg-file" accept=".svg,image/*" style="display:none">' +
    '<span class="sf-file-btn">&#127748; Choose File</span>' +
    '</label>' +
    '<span class="sf-file-hint">SVG or image</span>' +
    '<div class="sf-file-preview" id="sf-bg-preview">' + (d._bg_data_uri ? '<img src="' + toDataUri(d._bg_data_uri) + '" style="max-height:60px;max-width:100px;border-radius:3px">' : (d.bg_key ? '<span class="sf-file-cached">Cached: ' + esc(d.bg_key) + '</span>' : '<span class="sf-file-none">No background</span>')) + '</div>' +
    '</div></div>';

  html += '<div class="sf-asset-note">' +
    '<strong>Or select from cache:</strong>' +
    '</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">Icon Key</label>' +
    buildSelect("sf-icon-key", assetKeyOpts, d.icon_key || "") +
    '</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">Background Key</label>' +
    buildSelect("sf-bg-key", assetKeyOpts, d.bg_key || "") +
    '</div>';

  html += '<div class="sf-section-title">Inventory Layers</div>' +
    '<div class="sf-checks">' + layerBoxes + '</div>';

  html += '<div class="sf-section-title">Inventory Categories</div>' +
    '<div class="sf-row sf-check-all-row">' +
    '  <label class="shop-check-label"><input type="checkbox" id="sf-cat-all"> All Categories</label>' +
    '</div>' +
    '<div class="sf-checks" id="sf-cat-checks">' + catBoxes + '</div>';

  html += '<div class="sf-section-title">Inventory Rank Cap</div>' +
    '<div class="sf-row">' +
    '  <label class="sf-label">Max Rank</label>' +
    buildSelect("sf-max-rank", rankOps, d.max_rank || "") +
    '  <span class="sf-hint">Items above this rank are hidden</span>' +
    '</div>';

  html += '<div class="sf-section-title">Bound Items</div>' +
    '<div class="sf-row">' +
    '  <span class="sf-hint">Bind specific items by name (one per line). If listed, only those items appear. Leave empty to show all matching items.</span>' +
    '</div>' +
    '<textarea class="sf-textarea" id="sf-bound-items" rows="4" placeholder="Item Name\nAnother Item Name">' +
    esc((d.bound_items || []).join("\n")) +
    '</textarea>';

  html += '<div class="sf-section-title">Notes</div>' +
    '<textarea class="sf-textarea" id="sf-notes" rows="3" placeholder="Internal notes about this shop...">' +
    esc(d.notes || "") +
    '</textarea>';

  html += '<div class="sf-actions">' +
    '<button class="mkt-btn mkt-btn-active" id="sf-save">' + (isEdit ? 'Save Changes' : 'Create Shop') + '</button>' +
    '<button class="mkt-btn" id="sf-cancel">Cancel</button>' +
    '</div>';

  html += '</div>';

  return html;
}

// ── SHOP DETAIL VIEW ─────────────────────────────────────────
function buildShopDetailPanel(shop, allItems) {
  var shopItems   = getShopItems(shop, allItems);
  var bgStyle     = renderShopBgStyle(shop);
  var hasModifier = shop.city_modifier !== null && shop.city_modifier !== undefined && shop.city_modifier !== 0;

  var html =
    '<div class="shop-detail">' +

    // Full-bleed background layer
    (bgStyle
      ? '<div class="shop-detail-fullbg" style="' + bgStyle + '">' +
        '  <div class="shop-detail-fullbg-scrim"></div>' +
        '</div>'
      : '') +

    // All content sits above the bg
    '<div class="shop-detail-content">' +

    // Centered header: icon above name above location
    '<div class="shop-detail-header">' +
    '  <div class="shop-detail-icon">' + renderShopIcon(shop, 52) + '</div>' +
    '  <div class="shop-detail-name">' + esc(shop.name) + '</div>' +
    '  <div class="shop-detail-location">' +
    '    <span class="shop-loc-region">' + esc(shop.region || "Unknown Region") + '</span>' +
    (shop.city ? '<span class="shop-loc-sep">&middot;</span><span class="shop-loc-city">' + esc(shop.city) + '</span>' : '') +
    '  </div>' +
    (hasModifier
      ? '<span class="shop-mod-badge ' + (shop.city_modifier > 0 ? "mod-pos" : "mod-neg") + ' mod-lg">' +
        (shop.city_modifier > 0 ? "+" : "") + shop.city_modifier + "%</span>"
      : "") +
    '</div>' +

    // Nav bar + stats
    '<div class="shop-detail-bar">' +
    '  <button class="mkt-btn shop-back-btn" id="btn-shop-back">&larr; Shops</button>' +
    '  <div class="shop-detail-stats">' +
    '    <span class="shop-stat">' + shopItems.length + ' items</span>' +
    (shop.show_layers ? '<span class="shop-stat">' + shop.show_layers.join(", ") + '</span>' : '') +
    (shop.max_rank ? '<span class="shop-stat">Max ' + shop.max_rank + '</span>' : '') +
    '  </div>' +
    '</div>' +

    buildCards(shopItems, shop.city_modifier || 0) +

    '</div></div>';

  return html;
}

// ── MAIN RENDER ──────────────────────────────────────────────
function render() {
  var allItems = getAllItems();
  var html = '';

  if (state.view === "create") {
    html = buildShopForm(null);
  } else if (state.view === "edit" && state.editingShop) {
    var editTarget = getShopById(state.editingShop);
    html = editTarget ? buildShopForm(editTarget) : buildShopListPanel();
  } else if (state.view === "detail" && state.detailShop) {
    var detailTarget = getShopById(state.detailShop);
    html = detailTarget ? buildShopDetailPanel(detailTarget, allItems) : buildShopListPanel();
  } else {
    html = buildShopListPanel();
  }

  container.innerHTML = '<div class="shop-root">' + html + '</div>';

  // ── EVENTS ──
  var createBtn = container.querySelector("#btn-shop-create");
  if (createBtn) createBtn.addEventListener("click", function() {
    state.view = "create"; state.editingShop = null;
    render();
  });

  container.querySelectorAll(".shop-view-btn").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      state.view = "detail"; state.detailShop = btn.dataset.shopid;
      render();
    });
  });

  container.querySelectorAll(".shop-edit-btn").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      state.view = "edit"; state.editingShop = btn.dataset.shopid;
      render();
    });
  });

  container.querySelectorAll(".shop-del-btn").forEach(function(btn) {
    btn.addEventListener("click", function(e) {
      e.stopPropagation();
      var sid = btn.dataset.shopid;
      if (!confirm("Delete this shop?")) return;
      var shops = getShops();
      var updated = shops.filter(function(s){ return s.id !== sid; });
      saveShops(updated);
      render();
    });
  });

  var backBtn = container.querySelector("#btn-shop-back");
  if (backBtn) backBtn.addEventListener("click", function() {
    state.view = "list"; state.detailShop = null;
    render();
  });

  var catAllCb = container.querySelector("#sf-cat-all");
  if (catAllCb) catAllCb.addEventListener("change", function() {
    container.querySelectorAll(".shop-cat-cb").forEach(function(cb) { cb.checked = catAllCb.checked; });
  });

  // ── FILE PICKERS ──
  setupFilePicker(container, "sf-icon-file", "sf-icon-preview", "icon", function(key, dataUri) {
    var inp = container.querySelector("#sf-icon-file");
    if (inp) { inp.dataset.cachedKey = key; inp.dataset.cachedUri = dataUri; }
    var preview = container.querySelector("#sf-icon-preview");
    if (preview) preview.innerHTML = '<img src="' + dataUri + '" style="max-height:40px;max-width:40px;border-radius:3px">';
    var sel = container.querySelector("#sf-icon-key");
    if (sel) sel.value = key;
  });

  setupFilePicker(container, "sf-bg-file", "sf-bg-preview", "bg", function(key, dataUri) {
    var inp = container.querySelector("#sf-bg-file");
    if (inp) { inp.dataset.cachedKey = key; inp.dataset.cachedUri = dataUri; }
    var preview = container.querySelector("#sf-bg-preview");
    if (preview) preview.innerHTML = '<img src="' + dataUri + '" style="max-height:60px;max-width:100px;border-radius:3px">';
    var sel = container.querySelector("#sf-bg-key");
    if (sel) sel.value = key;
  });

  // ── FORM SAVE ──
  var saveBtn = container.querySelector("#sf-save");
  if (saveBtn) saveBtn.addEventListener("click", function() {
    var nameEl     = container.querySelector("#sf-name");
    var regionEl   = container.querySelector("#sf-region");
    var cityEl     = container.querySelector("#sf-city");
    var modEl      = container.querySelector("#sf-modifier");
    var iconKeyEl  = container.querySelector("#sf-icon-key");
    var bgKeyEl    = container.querySelector("#sf-bg-key");
    var iconFileEl = container.querySelector("#sf-icon-file");
    var bgFileEl   = container.querySelector("#sf-bg-file");
    var maxRankEl  = container.querySelector("#sf-max-rank");
    var boundEl    = container.querySelector("#sf-bound-items");
    var notesEl    = container.querySelector("#sf-notes");

    var name = nameEl ? nameEl.value.trim() : "";
    if (!name) { alert("Shop name is required."); return; }

    var selectedLayers = [];
    container.querySelectorAll(".shop-layer-cb:checked").forEach(function(cb){ selectedLayers.push(cb.value); });
    var selectedCats = [];
    container.querySelectorAll(".shop-cat-cb:checked").forEach(function(cb){ selectedCats.push(cb.value); });
    var boundRaw = boundEl ? boundEl.value.trim() : "";
    var boundItems = boundRaw ? boundRaw.split("\n").map(function(s){ return s.trim(); }).filter(Boolean) : [];

    var modVal = modEl ? parseFloat(modEl.value) : 0;
    if (isNaN(modVal)) modVal = 0;

    var isEdit = !!(state.view === "edit" && state.editingShop);
    var shops  = getShops();
    var shopId = isEdit ? state.editingShop : genShopId();

    var iconKey = iconKeyEl ? iconKeyEl.value : "";
    var bgKey   = bgKeyEl ? bgKeyEl.value : "";
    var iconDataUri = "";
    var bgDataUri   = "";

    if (iconFileEl && iconFileEl.dataset.cachedKey) {
      iconKey     = iconFileEl.dataset.cachedKey;
      iconDataUri = iconFileEl.dataset.cachedUri || "";
    }
    if (bgFileEl && bgFileEl.dataset.cachedKey) {
      bgKey     = bgFileEl.dataset.cachedKey;
      bgDataUri = bgFileEl.dataset.cachedUri || "";
    }

    if (state.view === "edit" && state.editingShop) {
      var _ex = getShopById(state.editingShop);
      if (_ex) {
        if (!iconDataUri && _ex._icon_data_uri) iconDataUri = _ex._icon_data_uri;
        if (!bgDataUri   && _ex._bg_data_uri)   bgDataUri   = _ex._bg_data_uri;
      }
    }

    var shopData = {
      id:              shopId,
      name:            name,
      region:          regionEl ? regionEl.value : REGIONS[0],
      city:            cityEl ? cityEl.value.trim() : "",
      city_modifier:   modVal,
      icon_key:        iconKey,
      bg_key:          bgKey,
      _icon_data_uri:  iconDataUri,
      _bg_data_uri:    bgDataUri,
      show_categories: selectedCats,
      show_layers:     selectedLayers,
      max_rank:        maxRankEl ? maxRankEl.value : "",
      bound_items:     boundItems,
      notes:           notesEl ? notesEl.value.trim() : "",
    };

    if (isEdit) {
      var existing = null;
      for (var si = 0; si < shops.length; si++) { if (shops[si].id === shopId) { existing = shops[si]; break; } }
      if (existing && existing.created) shopData.created = existing.created;
      var updated = shops.map(function(s){ return s.id === shopId ? Object.assign({}, s, shopData) : s; });
      saveShops(updated);
    } else {
      shopData.created = new Date().toISOString();
      shops.push(shopData);
      saveShops(shops);
    }

    state.view = "list"; state.editingShop = null;
    render();
  });

  // Form cancel
  var cancelBtn = container.querySelector("#sf-cancel");
  if (cancelBtn) cancelBtn.addEventListener("click", function() {
    state.view = "list"; state.editingShop = null;
    render();
  });
}

// ── INIT ─────────────────────────────────────────────────────
render();

}; // end DEVOUR.modules["shop"]

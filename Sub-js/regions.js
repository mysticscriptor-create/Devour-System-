// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — REGION MODULE  v2.0                                     ║
// ║  File: System/modules/regions.js                                         ║
// ║  Displays 8 Human Region cards with layered imagery, text strips,        ║
// ║  settings panel, image adjuster, and detail pages.                       ║
// ║  CSS: regions.css (Obsidian snippet)                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

DEVOUR.modules["regions"] = function(DEVOUR, container, shellState) {
// State initialization handled below conditionally

// ═════════════════════════════════════════════════════════════════════════════
//  PART 0 — MODULE STATE
// ═════════════════════════════════════════════════════════════════════════════

if (!DEVOUR._regionState) {
  DEVOUR._regionState = {
    loaded: false,
    settingsOpen: null,
    detailSettingsOpen: false,
    headerMenuOpen: false,
    error: null,
    _assets: null,
    _lore: null,
    detailPage: null,      // { regionIdx, regionId }
    adjusterOpen: null,    // { slot, regionId, regionIdx }
    _cssChecked: false
  };
}

var mState = DEVOUR._regionState;
var esc = DEVOUR.utils.escapeHtml;

// ═════════════════════════════════════════════════════════════════════════════
//  PART 1 — ASSET CACHE SYSTEM (RegionAssets)
// ═════════════════════════════════════════════════════════════════════════════

if (!DEVOUR._regionAssets) {
  DEVOUR._regionAssets = {
    _data: { global: {}, regions: {} },
    _dirty: false,
    _loaded: false,
    _blobCache: {},
    CACHE_PATH: "config/region-assets-cache.json"
  };
}

var RegionAssets = DEVOUR._regionAssets;

Object.assign(RegionAssets, {

  load: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      try {
        var f = app.vault.getAbstractFileByPath(self.CACHE_PATH);
        if (!f) {
          self._data = { global: {}, regions: {} };
          self._loaded = true;
          self._dirty = true;
          self.save().then(function() { resolve(); }).catch(function(e) { reject(e); });
          return;
        }
        app.vault.adapter.read(self.CACHE_PATH).then(function(raw) {
          try {
            var parsed = JSON.parse(raw);
            self._data = {
              global: self._migrateOldFormat(parsed.global || {}),
              regions: self._migrateOldRegions(parsed.regions || {})
            };
            self._loaded = true;
            self._dirty = false;
            resolve();
          } catch(e) {
            console.error("[RegionAssets] Parse error:", e);
            self._data = { global: {}, regions: {} };
            self._loaded = true;
            self._dirty = false;
            resolve();
          }
        }).catch(function(e) {
          console.error("[RegionAssets] Read error:", e);
          self._loaded = true;
          resolve();
        });
      } catch(e) {
        reject(e);
      }
    });
  },

  _migrateOldFormat: function(globalObj) {
    var result = {};
    for (var key in globalObj) {
      if (!globalObj.hasOwnProperty(key)) continue;
      var entry = globalObj[key];
      result[key] = this._convertEntry(entry);
    }
    return result;
  },

  _migrateOldRegions: function(regionsObj) {
    var result = {};
    for (var rid in regionsObj) {
      if (!regionsObj.hasOwnProperty(rid)) continue;
      result[rid] = this._migrateOldFormat(regionsObj[rid]);
    }
    return result;
  },

  _convertEntry: function(entry) {
    if (!entry) return null;
    if (typeof entry === "object" && entry.type && typeof entry.data === "string") {
      return entry;
    }
    if (typeof entry === "string") {
      var s = entry.trimStart();
      if (s.indexOf("<svg") === 0) {
        return { type: "svg", data: entry };
      }
      if (s.indexOf("data:") === 0) {
        if (s.indexOf("data:image/png;base64,") === 0) {
          return { type: "png", data: s.substring("data:image/png;base64,".length) };
        }
        if (s.indexOf("data:image/webp;base64,") === 0) {
          return { type: "webp", data: s.substring("data:image/webp;base64,".length) };
        }
        if (s.indexOf("data:image/svg+xml,") === 0) {
          return { type: "svg", data: decodeURIComponent(s.substring("data:image/svg+xml,".length)) };
        }
      }
    }
    return entry;
  },

  save: function() {
    var self = this;
    return new Promise(function(resolve, reject) {
      if (!self._dirty) { resolve(); return; }
      try {
        var content = JSON.stringify(self._data, null, 2);
        app.vault.adapter.write(self.CACHE_PATH, content).then(function() {
          self._dirty = false;
          DEVOUR.cfg.regionAssetsCache = self._data;
          resolve();
        }).catch(function(e) {
          console.error("[RegionAssets] Write error:", e);
          reject(e);
        });
      } catch(e) {
        reject(e);
      }
    });
  },

  get: function(slot, regionId) {
    if (slot === "__settings__") return null;
    if (slot === "__detail_settings__") return null;
    if (regionId) {
      var r = this._data.regions[regionId];
      return r ? (r[slot] || null) : null;
    }
    return this._data.global[slot] || null;
  },

  set: function(slot, regionId, file) {
    var self = this;
    return new Promise(function(resolve, reject) {
      self._detectAndEncode(file).then(function(entry) {
        // Revoke any existing blob URL for this slot before replacing
        self.revokeBlobUrl(slot, regionId);
        if (regionId) {
          if (!self._data.regions[regionId]) self._data.regions[regionId] = {};
          self._data.regions[regionId][slot] = entry;
        } else {
          self._data.global[slot] = entry;
        }
        self._dirty = true;
        self.save().then(function() { resolve(); }).catch(function(e) { reject(e); });
      }).catch(function(e) { reject(e); });
    });
  },

  clear: function(slot, regionId) {
    if (regionId) {
      if (this._data.regions[regionId]) {
        delete this._data.regions[regionId][slot];
      }
    } else {
      delete this._data.global[slot];
    }
    this.revokeBlobUrl(slot, regionId);
    this._dirty = true;
    return this.save();
  },

  clearRegion: function(regionId) {
    if (this._data.regions[regionId]) {
      var self = this;
      var slots = ["scene", "portrait", "center_bg", "card_bg", "frame", "sigil", "guardian_sigil"];
      slots.forEach(function(slot) { self.revokeBlobUrl(slot, regionId); });
      this._data.regions[regionId] = {};
      this._dirty = true;
    }
    return this.save();
  },

  getBlobUrl: function(slot, regionId) {
    var key = (regionId || "global") + ":" + slot;
    if (this._blobCache[key]) return this._blobCache[key];
    var entry = this.get(slot, regionId);
    if (!entry || entry.type === "svg") return null;
    try {
      var mime = entry.type === "webp" ? "image/webp" : "image/png";
      var binary = atob(entry.data);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      var blob = new Blob([bytes], { type: mime });
      var url = URL.createObjectURL(blob);
      this._blobCache[key] = url;
      return url;
    } catch(e) {
      console.error("[RegionAssets] Blob URL creation failed:", e);
      return null;
    }
  },

  revokeBlobUrl: function(slot, regionId) {
    var key = (regionId || "global") + ":" + slot;
    if (this._blobCache[key]) {
      URL.revokeObjectURL(this._blobCache[key]);
      delete this._blobCache[key];
    }
  },

  warmBlobCache: function(regions) {
    var self = this;
    var slots = ["scene", "portrait", "center_bg", "card_bg", "frame", "section_bg"];
    regions.forEach(function(r) {
      slots.forEach(function(slot) {
        self.getBlobUrl(slot, r.id);
      });
    });
    // Global slots
    slots.forEach(function(slot) {
      self.getBlobUrl(slot, null);
    });
  },

  getCssUrl: function(slot, regionId) {
    var entry = this.get(slot, regionId);
    if (!entry) return "";
    if (entry.type === "svg") {
      return "url('data:image/svg+xml," + encodeURIComponent(entry.data) + "')";
    }
    var blobUrl = this.getBlobUrl(slot, regionId);
    if (blobUrl) return "url('" + blobUrl + "')";
    // Fallback to base64 if blob creation failed
    var mime = entry.type === "webp" ? "image/webp" : "image/png";
    return "url('data:" + mime + ";base64," + entry.data + "')";
  },

  getSvgInline: function(slot, regionId) {
    var entry = this.get(slot, regionId);
    if (!entry || entry.type !== "svg") return "";
    return entry.data;
  },

  getImgSrc: function(slot, regionId) {
    var entry = this.get(slot, regionId);
    if (!entry) return "";
    if (entry.type === "svg") {
      return "data:image/svg+xml," + encodeURIComponent(entry.data);
    }
    var mime = entry.type === "webp" ? "image/webp" : "image/png";
    return "data:" + mime + ";base64," + entry.data;
  },

  // Async preview - returns placeholder HTML, loads image after
  getPreviewHtml: function(slot, regionId) {
    var entry = this.get(slot, regionId);
    if (!entry) return '<div class="rgn-slot-empty">No image</div>';
    // Return a placeholder with data attributes for async loading
    var scope = regionId || "global";
    if (entry.type === "svg") {
      return '<div class="rgn-slot-preview rgn-slot-preview-svg" data-preview-slot="' + slot + '" data-preview-scope="' + scope + '">' + entry.data + '</div>';
    }
    var mime = entry.type === "webp" ? "image/webp" : "image/png";
    return '<div class="rgn-slot-preview-wrap has-image" data-preview-slot="' + slot + '" data-preview-scope="' + scope + '" data-preview-src="data:' + mime + ';base64,' + entry.data + '"><div class="rgn-slot-preview" style="width:100%;height:100%;background:rgba(255,255,255,0.05);"></div></div>';
  },

  // Fill preview containers with actual images (called after panel is visible)
  fillPreviews: function(containerEl) {
    var wraps = containerEl.querySelectorAll('[data-preview-src]');
    wraps.forEach(function(wrap) {
      var src = wrap.getAttribute('data-preview-src');
      if (src) {
        var img = new Image();
        img.className = 'rgn-slot-preview';
        img.onload = function() {
          var existing = wrap.querySelector('.rgn-slot-preview');
          if (existing) existing.replaceWith(img);
        };
        img.onerror = function() {
          wrap.innerHTML = '<div class="rgn-slot-empty">Error</div>';
        };
        // Defer to next frame for smoother panel open
        requestAnimationFrame(function() {
          img.src = src;
        });
      }
    });
  },

  _detectAndEncode: function(file) {
    return new Promise(function(resolve, reject) {
      var type = "";
      var ext = "";

      if (file.type) {
        if (file.type.indexOf("svg") !== -1) type = "svg";
        else if (file.type.indexOf("webp") !== -1) type = "webp";
        else if (file.type.indexOf("png") !== -1) type = "png";
      }

      if (!type) {
        var name = file.name || "";
        ext = name.split(".").pop().toLowerCase();
        if (ext === "svg") type = "svg";
        else if (ext === "webp") type = "webp";
        else if (ext === "png") type = "png";
      }

      if (!type) {
        reject(new Error("Unsupported file type: " + (file.type || ext)));
        return;
      }

      if (type === "svg") {
        var rText = new FileReader();
        rText.onload = function(e) {
          resolve({ type: "svg", data: e.target.result });
        };
        rText.onerror = function(e) { reject(e); };
        rText.readAsText(file);
      } else {
        var r64 = new FileReader();
        r64.onload = function(e) {
          var result = e.target.result;
          var idx = result.indexOf("base64,");
          if (idx !== -1) {
            resolve({ type: type, data: result.substring(idx + 7) });
          } else {
            reject(new Error("Failed to parse base64"));
          }
        };
        r64.onerror = function(e) { reject(e); };
        r64.readAsDataURL(file);
      }
    });
  },

  checkSize: function(file) {
    var kb = file.size / 1024;
    if (kb > 800) {
      return "Warning: " + Math.round(kb) + "KB — large images may cause lag on mobile";
    }
    return null;
  },

  getSettings: function(regionId) {
    var bucket = regionId
      ? (this._data.regions[regionId] || {})
      : this._data.global;
    var raw = bucket["__settings__"];
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return {};
  },

  saveSettings: function(regionId, settingsObj) {
    if (regionId) {
      if (!this._data.regions[regionId]) this._data.regions[regionId] = {};
      this._data.regions[regionId]["__settings__"] = JSON.stringify(settingsObj);
    } else {
      this._data.global["__settings__"] = JSON.stringify(settingsObj);
    }
    this._dirty = true;
    this.save().catch(function(e) { console.error("[RegionAssets] Settings save failed:", e); });
  },

  // ── Detail page settings ──
  getDetailSettings: function(regionId) {
    var bucket = regionId
      ? (this._data.regions[regionId] || {})
      : this._data.global;
    var raw = bucket["__detail_settings__"];
    if (raw) {
      try { return JSON.parse(raw); } catch(e) {}
    }
    return null;
  },

  saveDetailSettings: function(regionId, settingsObj) {
    if (regionId) {
      if (!this._data.regions[regionId]) this._data.regions[regionId] = {};
      this._data.regions[regionId]["__detail_settings__"] = JSON.stringify(settingsObj);
    } else {
      this._data.global["__detail_settings__"] = JSON.stringify(settingsObj);
    }
    this._dirty = true;
    this.save().catch(function(e) { console.error("[RegionAssets] Detail settings save failed:", e); });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  PART 2 — LORE DATA ACCESS
// ═════════════════════════════════════════════════════════════════════════════

function getRegionLore() {
  if (DEVOUR.cfg && DEVOUR.cfg.regionLore && DEVOUR.cfg.regionLore.regions) {
    return DEVOUR.cfg.regionLore.regions;
  }
  return null;
}

// ═════════════════════════════════════════════════════════════════════════════
//  PART 3 — HELPER FUNCTIONS
// ═════════════════════════════════════════════════════════════════════════════

function toNumber(val, fallback) {
  var n = parseFloat(val);
  return isNaN(n) ? fallback : n;
}

// ── Shadow builder: slider 0-1 → visible text-shadow ──
// Uses text-shadow only — filter:drop-shadow darkens the text itself at high values
function buildTextShadow(shadowVal, intensity) {
  var s = toNumber(shadowVal, 0);
  if (s <= 0) return "text-shadow: none !important;";

  var mult = intensity || 1;
  s = Math.min(Math.max(s, 0), 1);

  var a = function(base) { return Math.min(base * s * mult, 1.0).toFixed(2); };

  var layers = [];

  // Tight dark outline
  layers.push("0 1px 2px rgba(0,0,0," + a(1.0) + ")");
  layers.push("0 -1px 2px rgba(0,0,0," + a(0.8) + ")");

  // Soft centered glow
  layers.push("0 0 " + (2 + s * 5).toFixed(1) + "px rgba(0,0,0," + a(0.9) + ")");

  // Wider ambient
  if (s > 0.3) {
    layers.push("0 0 " + (4 + s * 8).toFixed(1) + "px rgba(0,0,0," + a(0.7) + ")");
  }

  // Deep legibility shadow
  if (s > 0.5) {
    layers.push("0 2px " + (5 + s * 7).toFixed(1) + "px rgba(0,0,0," + a(0.6) + ")");
  }

  return "text-shadow: " + layers.join(", ") + " !important;";
}

function hexToRgba(hex, alpha) {
  var r = 0, g = 0, b = 0;
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

// ── Check if CSS file is loaded ──
function ensureCSS() {
  if (mState._cssChecked) return true;
  var style = document.getElementById("rgn-css");
  if (style) {
    mState._cssChecked = true;
    return true;
  }
  // CSS not loaded - warn but don't break
  console.warn("[RegionModule] regions.css not loaded. Add it as an Obsidian CSS snippet.");
  mState._cssChecked = true;
  return false;
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 4 — CARD LAYOUT ENGINE
// ═════════════════════════════════════════════════════════════════════════════

function buildRegionCard(region, regionIdx) {
  var ra = RegionAssets;
  var regionId = region.id;
  var accent = region.color || region.color_accent || "#888";

  // -- Read per-region display settings
  var settings   = ra.getSettings(regionId);
  var pad            = settings.padding         !== undefined ? settings.padding         : 10;
  var framePadX      = settings.framePadX       !== undefined ? settings.framePadX       : 6;
  var framePadY      = settings.framePadY       !== undefined ? settings.framePadY       : 6;
  var imgInsetW      = settings.imgInsetW       !== undefined ? settings.imgInsetW       : 0;
  var imgInsetH      = settings.imgInsetH       !== undefined ? settings.imgInsetH       : 0;
  var taglineOffsetX = settings.taglineOffsetX  !== undefined ? settings.taglineOffsetX  : 0;
  var taglineOffsetY = settings.taglineOffsetY  !== undefined ? settings.taglineOffsetY  : 0;
  var nameOffsetX    = settings.nameOffsetX     !== undefined ? settings.nameOffsetX     : 0;
  var nameOffsetY    = settings.nameOffsetY     !== undefined ? settings.nameOffsetY     : 0;
  var countryOffsetX = settings.countryOffsetX  !== undefined ? settings.countryOffsetX  : 0;
  var countryOffsetY = settings.countryOffsetY  !== undefined ? settings.countryOffsetY  : 0;
  var guardianOffsetX= settings.guardianOffsetX !== undefined ? settings.guardianOffsetX : 0;
  var guardianOffsetY= settings.guardianOffsetY !== undefined ? settings.guardianOffsetY : 0;
  var sigilOffsetX   = settings.sigilOffsetX    !== undefined ? settings.sigilOffsetX    : 0;
  var sigilOffsetY   = settings.sigilOffsetY    !== undefined ? settings.sigilOffsetY    : 0;

  // ── FIX #1: Shadow slider → visible text-shadow ──
  // Slider 0-1, default 0.75. Use buildTextShadow for clear visibility.
  var nameShadow     = toNumber(settings.nameShadow,      0.75);
  var countryShadow  = toNumber(settings.countryShadow,   0.75);
  var taglineShadow  = toNumber(settings.taglineShadow,   0.75);
  var guardianShadow = toNumber(settings.guardianShadow,  0.75);

  var nameShadowStyle     = buildTextShadow(nameShadow,     1.6);
  var countryShadowStyle  = buildTextShadow(countryShadow,  1.4);
  var taglineShadowStyle  = buildTextShadow(taglineShadow,  1.3);
  var guardianTextShadow  = buildTextShadow(guardianShadow, 1.4);

  var eraserTop      = settings.eraserTop       !== undefined ? settings.eraserTop       : 0;
  var eraserBottom   = settings.eraserBottom    !== undefined ? settings.eraserBottom    : 0;
  var eraserLeft     = settings.eraserLeft      !== undefined ? settings.eraserLeft      : 0;
  var eraserRight    = settings.eraserRight     !== undefined ? settings.eraserRight     : 0;
  var sceneZ     = settings.sceneZ     !== undefined ? settings.sceneZ     : 2;
  var centerZ    = settings.centerZ    !== undefined ? settings.centerZ    : 3;
  var portraitZ  = settings.portraitZ  !== undefined ? settings.portraitZ  : 4;
  var sceneFade  = settings.sceneFade  !== undefined ? settings.sceneFade  : 40;
  var portraitFade = settings.portraitFade !== undefined ? settings.portraitFade : 45;
  var centerFade = settings.centerFade !== undefined ? settings.centerFade : 12;

  // -- Image position settings (new)
  var scenePosX    = toNumber(settings.scenePosX,    50);
  var scenePosY    = toNumber(settings.scenePosY,    50);
  var sceneZoom    = toNumber(settings.sceneZoom,    100);
  var portraitPosX = toNumber(settings.portraitPosX, 50);
  var portraitPosY = toNumber(settings.portraitPosY, 50);
  var portraitZoom = toNumber(settings.portraitZoom, 100);
  var centerPosX   = toNumber(settings.centerPosX,   50);
  var centerPosY   = toNumber(settings.centerPosY,   50);
  var centerZoom   = toNumber(settings.centerZoom,   100);

  // -- Card background
  var cardBgUrl  = ra.getCssUrl("card_bg", null);
  var cardBgImgVal = cardBgUrl ? cardBgUrl : "";
  var cardBgStyle = cardBgImgVal
    ? "background-image:" + cardBgImgVal + ";"
    : "background:transparent;";

  // -- Scene (left) with position
  var sceneUrl = ra.getCssUrl("scene", regionId);
  var sceneBgSize = sceneZoom !== 100 ? sceneZoom + "%" : "cover";
  var scenePos = scenePosX + "% " + scenePosY + "%";
  var sceneHtml = sceneUrl
    ? '<div class="rgn-layer rgn-scene" style="background-image:' + sceneUrl
      + "; z-index:" + sceneZ + ";"
      + " background-position:" + scenePos + ";"
      + (sceneZoom !== 100 ? " background-size:" + sceneBgSize + ";" : "")
      + " -webkit-mask-image:linear-gradient(to right,black " + sceneFade + "%,transparent 100%);"
      + " mask-image:linear-gradient(to right,black " + sceneFade + "%,transparent 100%);\"></div>"
    : "";

  // -- Center bg with position
  var centerUrl = ra.getCssUrl("center_bg", regionId);
  var centerBgSize = centerZoom !== 100 ? centerZoom + "%" : "cover";
  var centerPos = centerPosX + "% " + centerPosY + "%";
  var centerHtml = centerUrl
    ? '<div class="rgn-layer rgn-center-bg" style="background-image:' + centerUrl
      + "; z-index:" + centerZ + ";"
      + " background-position:" + centerPos + ";"
      + (centerZoom !== 100 ? " background-size:" + centerBgSize + ";" : "")
      + " -webkit-mask-image:linear-gradient(to right,transparent 0%,black " + centerFade + "%,black " + (100-centerFade) + "%,transparent 100%);"
      + " mask-image:linear-gradient(to right,transparent 0%,black " + centerFade + "%,black " + (100-centerFade) + "%,transparent 100%);\"></div>"
    : "";

  // -- Portrait (right) with position
  var portraitUrl = ra.getCssUrl("portrait", regionId);
  var portraitBgSize = portraitZoom !== 100 ? portraitZoom + "%" : "cover";
  var portraitPos = portraitPosX + "% " + portraitPosY + "%";
  var portraitHtml = portraitUrl
    ? '<div class="rgn-layer rgn-portrait" style="background-image:' + portraitUrl
      + "; z-index:" + portraitZ + ";"
      + " background-position:" + portraitPos + ";"
      + (portraitZoom !== 100 ? " background-size:" + portraitBgSize + ";" : "")
      + " -webkit-mask-image:linear-gradient(to left,black " + portraitFade + "%,transparent 100%);"
      + " mask-image:linear-gradient(to left,black " + portraitFade + "%,transparent 100%);\"></div>"
    : "";

  // -- Frame
  var frameUrl = ra.getCssUrl("frame", regionId) || ra.getCssUrl("frame", null);
  var frameHtml = frameUrl
    ? '<div class="rgn-layer rgn-frame" style="background-image:' + frameUrl + ';"></div>'
    : "";

  // -- Sigil
  var sigilInline  = ra.getSvgInline("sigil", regionId);
  var sigilImgSrc  = ra.getImgSrc("sigil", regionId);
  var sigilHtml = "";
  var sigilTop   = 7 + sigilOffsetY;
  var sigilRight = 7 - sigilOffsetX;
  if (sigilInline) {
    sigilHtml = '<div class="rgn-sigil" style="top:' + sigilTop + 'px;right:' + sigilRight + 'px;">' + sigilInline + '</div>';
  } else if (sigilImgSrc) {
    sigilHtml = '<div class="rgn-sigil" style="top:' + sigilTop + 'px;right:' + sigilRight + 'px;"><img src="' + sigilImgSrc + '" alt="sigil"></div>';
  }

  // -- Region Name with fixed shadow
  var nameHtml = '<div class="rgn-name" style="position:relative;margin-left:' + nameOffsetX + 'px;top:' + nameOffsetY + 'px;' + nameShadowStyle + '">' + esc(region.name) + '</div>';

  // -- Countries row
  var countriesHtml = "";
  var countryPairs = [];

  if (region.countries && region.countries.length) {
    for (var ci = 0; ci < region.countries.length; ci++) {
      var c = region.countries[ci];
      countryPairs.push({ name: c.name || c.country || "", capital: c.capital || "" });
    }
  } else if (region.cities && region.cities.length) {
    for (var ci2 = 0; ci2 < region.cities.length; ci2++) {
      var city = region.cities[ci2];
      if (city.role && city.role.indexOf("Capital") !== -1) {
        var label = city.role.replace("Capital", "").trim();
        countryPairs.push({ name: label || region.name, capital: city.name });
      }
    }
  }

  var eraserVars = "--es-top:" + eraserTop + "px; --es-bottom:" + eraserBottom + "px; --es-left:" + eraserLeft + "px; --es-right:" + eraserRight + "px;";

  if (countryPairs.length > 0) {
    var countryParts = [];
    for (var pi = 0; pi < countryPairs.length; pi++) {
      var p = countryPairs[pi];
      var cHtml = '<span class="rgn-country" style="' + countryShadowStyle + '">' + esc(p.name);
      if (p.capital) {
        cHtml += '<span class="rgn-country-sep"> \u00b7 </span><span class="rgn-country-cap" style="' + countryShadowStyle + '">' + esc(p.capital) + '</span>';
      }
      cHtml += '</span>';
      countryParts.push(cHtml);
    }
    countriesHtml =
      '<div class="rgn-eraser-strip-content" style="position:relative;margin-left:' + countryOffsetX + 'px;top:' + countryOffsetY + 'px;">'
      + '<div class="rgn-countries">' + countryParts.join('<span class="rgn-country-sep">&nbsp;&nbsp;|&nbsp;&nbsp;</span>') + '</div>'
      + '</div>';
  } else {
    var cap = region.capital || "";
    if (cap) {
      countriesHtml =
        '<div class="rgn-eraser-strip-content" style="position:relative;margin-left:' + countryOffsetX + 'px;top:' + countryOffsetY + 'px;">'
        + '<span class="rgn-country" style="' + countryShadowStyle + '">' + esc(cap) + '</span>'
        + '</div>';
    }
  }

  // -- Tagline with shadow
  var taglineHtml = "";
  if (region.tagline) {
    var taglineStyle = "position:relative; margin-left:" + taglineOffsetX + "px; top:" + taglineOffsetY + "px; " + eraserVars;
    taglineHtml =
      '<div class="rgn-tagline-strip" style="' + taglineStyle + '">'
      + '<div class="rgn-tagline-strip-content">'
      + '<span class="rgn-tagline" style="' + taglineShadowStyle + '">' + esc(region.tagline) + '</span>'
      + '</div></div>';
  }

  // -- Guardian strip
  var guardian = region.guardian || {};
  var guardianSigilInline  = ra.getSvgInline("guardian_sigil", regionId);
  var guardianSigilImgSrc  = ra.getImgSrc("guardian_sigil", regionId);
  var guardianIconHtml = guardianSigilInline
    ? '<div class="rgn-guardian-sigil-wrap">' + guardianSigilInline + '</div>'
    : guardianSigilImgSrc
      ? '<div class="rgn-guardian-sigil-wrap"><img src="' + guardianSigilImgSrc + '" alt=""></div>'
      : '<div class="rgn-guardian-diamond"></div>';

  var guardianHtml = "";
  if (guardian.name) {
    var guardianRowStyle = "bottom:" + (-guardianOffsetY) + "px;left:" + guardianOffsetX + "px;right:" + (-guardianOffsetX) + "px;";
    guardianHtml =
      '<div class="rgn-guardian-row" style="' + guardianRowStyle + '">'
      + '<div class="rgn-guardian-bg"></div>'
      + guardianIconHtml
      + '<div class="rgn-guardian-text">'
      + '<div class="rgn-guardian-top">'
      + '<span class="rgn-guardian-rank" style="' + guardianTextShadow + '">' + esc(guardian.rank || "SSS") + '-Rank Guardian:</span>'
      + '<div class="rgn-guardian-nameblock">'
      + '<span class="rgn-guardian-name" style="' + guardianTextShadow + '">' + esc(guardian.name) + '</span>'
      + (guardian.title ? '<span class="rgn-guardian-title" style="' + guardianTextShadow + '">\u2014 ' + esc(guardian.title) + '</span>' : "")
      + '</div>'
      + '</div>'
      + '</div></div>';
  }

  // -- Card padding and frame
  var contentPad = pad + "px";
  var contentStyle = "padding:" + contentPad + " " + contentPad + " " + (parseInt(pad,10) + 18) + "px " + contentPad + ";";

  var fpX = framePadX + "px";
  var fpY = framePadY + "px";
  var frameAreaStyle = "top:" + fpY + ";left:" + fpX + ";right:" + fpX + ";bottom:" + fpY + ";";

  var ipX = (framePadX + imgInsetW) + "px";
  var ipY = (framePadY + imgInsetH) + "px";
  var imageAreaStyle = "position:absolute;top:" + ipY + ";left:" + ipX + ";right:" + ipX + ";bottom:" + ipY + ";overflow:hidden;pointer-events:none;";

  var shadowStyle = "box-shadow: 0 3px 14px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), 0 6px 24px rgba(0,0,0,0.3);";
  var cardEraserVar = cardBgImgVal ? "--rgn-eraser-bg:" + cardBgImgVal + ";" : "--rgn-eraser-bg:none;";

  return (
    '<div class="rgn-card" data-region-id="' + esc(regionId) + '" data-region-idx="' + regionIdx + '" style="' + shadowStyle + cardEraserVar + '">'
    + '<div class="rgn-layer rgn-card-bg" style="' + cardBgStyle + '"></div>'
    + '<div class="rgn-frame-area" style="' + frameAreaStyle + '">'
    +   '<div style="position:absolute;inset:0;overflow:hidden;border-radius:4px;pointer-events:none;">'
    +     '<div style="' + imageAreaStyle + '">'
    +       sceneHtml
    +       centerHtml
    +       portraitHtml
    +     '</div>'
    +     frameHtml
    +     '<div class="rgn-card-overlay"></div>'
    +   '</div>'
    +   '<div class="rgn-content" style="' + contentStyle + '">'
    +     nameHtml
       +     countriesHtml
    +     taglineHtml
    +   '</div>'
    +   guardianHtml
    +   sigilHtml
    + '</div>'
    + '</div>'
  );
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 5 — SETTINGS PANEL
// ═════════════════════════════════════════════════════════════════════════════

function buildSettingsPanel(region, regionIdx) {
  var ra = RegionAssets;
  var regionId = region.id;
  var settings = ra.getSettings(regionId);

  var regionSlots = [
    { key: "scene",          label: "Scene Image",       hint: "Left side image",        adjustable: true },
    { key: "portrait",       label: "Portrait Image",    hint: "Right side character",   adjustable: true },
    { key: "center_bg",      label: "Center Background", hint: "Behind title text",      adjustable: true },
    { key: "sigil",          label: "Region Sigil",      hint: "Top-right corner icon",  adjustable: false },
    { key: "guardian_sigil", label: "Guardian Sigil",    hint: "Beside guardian name",   adjustable: false },
    { key: "frame",          label: "Region Frame",      hint: "Frame for this region",  adjustable: false }
  ];

  var globalSlots = [
    { key: "section_bg", label: "Section Background", hint: "Full-screen background behind all cards", adjustable: false },
    { key: "card_bg",    label: "Card Background",    hint: "Fills card behind frame",                adjustable: false },
    { key: "frame",      label: "Global Frame",       hint: "Fallback frame",                         adjustable: false }
  ];

  var regionRowsHtml = "";
  for (var i = 0; i < regionSlots.length; i++) {
    regionRowsHtml += buildSlotRow(regionSlots[i], regionId, regionIdx);
  }
  var globalRowsHtml = "";
  for (var j = 0; j < globalSlots.length; j++) {
    globalRowsHtml += buildSlotRow(globalSlots[j], null, regionIdx);
  }

  // Read all settings with defaults
  var s = settings;
  function g(key, def) { return s[key] !== undefined ? s[key] : def; }

  var layerControlsHtml =
    '<div class="rgn-slot-section-title">Frame Inset</div>'
    + '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:6px;">How far inside the card edges the frame sits.</div>'
    + buildRangeRow("Horizontal Inset (px)", "framePadX", g("framePadX", 6), 0, 40, 1, regionId, regionIdx)
    + buildRangeRow("Vertical Inset (px)",   "framePadY", g("framePadY", 6), 0, 40, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Image Size Inside Frame</div>'
    + '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:6px;">Shrinks only the scene/portrait/center images.</div>'
    + buildRangeRow("Shrink Width (px each side)",  "imgInsetW", g("imgInsetW", 0), 0, 60, 1, regionId, regionIdx)
    + buildRangeRow("Shrink Height (px each side)", "imgInsetH", g("imgInsetH", 0), 0, 60, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Layer Order (Z-Index)</div>'
    + '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:6px;">Higher number = in front. Defaults: 2, 3, 4</div>'
    + buildRangeRow("Scene Z",    "sceneZ",    g("sceneZ", 2),    1, 8, 1, regionId, regionIdx)
    + buildRangeRow("Center Z",   "centerZ",   g("centerZ", 3),   1, 8, 1, regionId, regionIdx)
    + buildRangeRow("Portrait Z", "portraitZ", g("portraitZ", 4), 1, 8, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Fade Controls (%)</div>'
    + buildRangeRow("Scene Fade",    "sceneFade",    g("sceneFade", 40),    0, 80, 5, regionId, regionIdx)
    + buildRangeRow("Portrait Fade", "portraitFade", g("portraitFade", 45), 0, 80, 5, regionId, regionIdx)
    + buildRangeRow("Center Fade",   "centerFade",   g("centerFade", 12),   0, 40, 2, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Card Padding</div>'
    + buildRangeRow("Inner Padding", "padding", g("padding", 10), 4, 40, 2, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Title Position</div>'
    + buildRangeRow("Left / Right (px)", "nameOffsetX", g("nameOffsetX", 0), -80, 80, 1, regionId, regionIdx)
    + buildRangeRow("Up / Down (px)",    "nameOffsetY", g("nameOffsetY", 0), -60, 60, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Country & City Position</div>'
    + buildRangeRow("Left / Right (px)", "countryOffsetX", g("countryOffsetX", 0), -80, 80, 1, regionId, regionIdx)
    + buildRangeRow("Up / Down (px)",    "countryOffsetY", g("countryOffsetY", 0), -60, 60, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Tagline Position</div>'
    + buildRangeRow("Left / Right (px)", "taglineOffsetX", g("taglineOffsetX", 0), -60, 60, 1, regionId, regionIdx)
    + buildRangeRow("Up / Down (px)",    "taglineOffsetY", g("taglineOffsetY", 0), -40, 40, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Guardian Line Position</div>'
    + buildRangeRow("Left / Right (px)", "guardianOffsetX", g("guardianOffsetX", 0), -80, 80, 1, regionId, regionIdx)
    + buildRangeRow("Up / Down (px)",    "guardianOffsetY", g("guardianOffsetY", 0), -60, 60, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Region Sigil Position</div>'
    + buildRangeRow("Left / Right (px)", "sigilOffsetX", g("sigilOffsetX", 0), -80, 80, 1, regionId, regionIdx)
    + buildRangeRow("Up / Down (px)",    "sigilOffsetY", g("sigilOffsetY", 0), -60, 60, 1, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Shadows</div>'
    + '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:6px;">0 = no shadow. Higher = darker, more spread.</div>'
    + buildRangeRow("Title Shadow",    "nameShadow",     g("nameShadow", 0.75),     0, 1, 0.05, regionId, regionIdx)
    + buildRangeRow("Country Shadow",  "countryShadow",  g("countryShadow", 0.75),  0, 1, 0.05, regionId, regionIdx)
    + buildRangeRow("Tagline Shadow",  "taglineShadow",  g("taglineShadow", 0.75),  0, 1, 0.05, regionId, regionIdx)
    + buildRangeRow("Guardian Shadow", "guardianShadow", g("guardianShadow", 0.75), 0, 1, 0.05, regionId, regionIdx)
    + '<div class="rgn-settings-divider"></div>'
    + '<div class="rgn-slot-section-title">Tagline Background Expand</div>'
    + buildRangeRow("Expand Top (px)",    "eraserTop",    g("eraserTop", 0),    0, 40, 1, regionId, regionIdx)
    + buildRangeRow("Expand Bottom (px)", "eraserBottom", g("eraserBottom", 0), 0, 40, 1, regionId, regionIdx)
    + buildRangeRow("Expand Left (px)",   "eraserLeft",   g("eraserLeft", 0),   0, 60, 1, regionId, regionIdx)
    + buildRangeRow("Expand Right (px)",  "eraserRight",  g("eraserRight", 0),  0, 60, 1, regionId, regionIdx);

  var panel =
    '<div class="rgn-settings-overlay" id="rgn-settings-overlay-' + regionIdx + '" data-region-idx="' + regionIdx + '">'
    + '<div class="rgn-settings-sheet">'
    +   '<div class="rgn-settings-header">'
    +     '<div class="rgn-settings-title">Configure \u2014 ' + esc(region.name) + '</div>'
    +     '<button class="rgn-settings-apply-all" id="rgn-apply-all-btn" title="Apply slider changes to all cards" aria-pressed="false">&#10003;</button>'
    +     '<button class="rgn-settings-close" data-action="close-settings" aria-label="Close">&times;</button>'
    +   '</div>'
    +   '<div class="rgn-settings-body">'
    +     '<div class="rgn-slot-section-title">Region Images</div>'
    +     regionRowsHtml
    +     '<div class="rgn-settings-divider"></div>'
    +     '<div class="rgn-slot-section-title">Global Images (All Cards)</div>'
    +     globalRowsHtml
    +     '<div class="rgn-settings-divider"></div>'
    +     layerControlsHtml
    +     '<div class="rgn-settings-divider"></div>'
    +     '<div class="rgn-settings-actions">'
    +       '<button class="rgn-action-btn rgn-action-btn-danger" data-action="clear-region" data-region-id="' + esc(regionId) + '" data-region-idx="' + regionIdx + '">Clear All Images for This Region</button>'
    +       '<button class="rgn-action-btn" data-action="export-cache">Export Cache as Backup</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '</div>';

  return panel;
}

function buildRangeRow(label, key, value, min, max, step, regionId, regionIdx) {
  var inputId = "rgn-range-" + key + "-" + regionIdx;
  return '<div class="rgn-layer-ctrl">'
    + '<div class="rgn-layer-ctrl-label">'
    +   '<span>' + esc(label) + '</span>'
    +   '<span id="' + inputId + '-val">' + value + '</span>'
    + '</div>'
    + '<input type="range" id="' + inputId + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"'
    +   ' data-setting-key="' + esc(key) + '"'
    +   ' data-region-id="' + esc(regionId || "") + '"'
    +   ' data-region-idx="' + regionIdx + '">'
    + '</div>';
}

function buildSlotRow(slot, regionId, regionIdx) {
  var ra = RegionAssets;
  var preview = ra.getPreviewHtml(slot.key, regionId);
  var isGlobal = !regionId;
  var inputId = "rgn-file-" + slot.key + "-" + (regionId || "global") + "-" + regionIdx;
  var rowId = "rgn-row-" + slot.key + "-" + (regionId || "global") + "-" + regionIdx;
  var savedIndicatorId = rowId + "-saved";
  var warningId = rowId + "-warn";
  var scopeAttr = isGlobal ? "" : "data-region-id=\"" + esc(regionId || "") + "\"";

  var adjustBtn = "";
  if (slot.adjustable) {
    adjustBtn = '<button class="rgn-slot-btn rgn-slot-btn-adjust" data-action="adjust-image" data-slot="' + slot.key + '" ' + scopeAttr + ' data-region-idx="' + regionIdx + '">Adj</button>';
  }

  return '<div class="rgn-slot-row" id="' + rowId + '" data-slot="' + slot.key + '" ' + scopeAttr + ' data-region-idx="' + regionIdx + '">'
    + '<div class="rgn-slot-preview-wrap">' + preview + '</div>'
    + '<div class="rgn-slot-info">'
    +   '<div class="rgn-slot-name">' + esc(slot.label) + '</div>'
    +   '<div class="rgn-slot-hint">' + esc(slot.hint) + '</div>'
    +   '<div class="rgn-slot-size-warning" id="' + warningId + '" style="display:none"></div>'
    +   '<div class="rgn-slot-saved" id="' + savedIndicatorId + '" style="display:none">&#10003; Saved</div>'
    + '</div>'
    + '<div class="rgn-slot-actions">'
    +   '<button class="rgn-slot-btn" data-action="pick" data-slot="' + slot.key + '" ' + scopeAttr + ' data-region-idx="' + regionIdx + '">Pick</button>'
    +   adjustBtn
    +   '<button class="rgn-slot-btn rgn-slot-btn-clear" data-action="clear-slot" data-slot="' + slot.key + '" ' + scopeAttr + ' data-region-idx="' + regionIdx + '">&times;</button>'
    + '</div>'
    + '<input type="file" class="rgn-slot-file-input" id="' + inputId + '" accept="image/png,image/webp,image/svg+xml" data-slot="' + slot.key + '" ' + scopeAttr + ' data-region-idx="' + regionIdx + '">'
    + '</div>';
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 6 — IMAGE ADJUSTER MODAL
//  Opens after picking scene/portrait/center to adjust position & zoom
// ═════════════════════════════════════════════════════════════════════════════

function openImageAdjuster(slot, regionId, regionIdx) {
  var ra = RegionAssets;
  var region = mState._lore[regionIdx];
  if (!region) return;

  var imgUrl = ra.getCssUrl(slot, regionId || null);
  if (!imgUrl) {
    alert("No image to adjust. Pick an image first.");
    return;
  }

  var settings = ra.getSettings(regionId || "");
  var posKeyX = slot + "PosX", posKeyY = slot + "PosY", zoomKey = slot + "Zoom";
  var posX = toNumber(settings[posKeyX], 50);
  var posY = toNumber(settings[posKeyY], 50);
  var zoom = toNumber(settings[zoomKey], 100);

  var slotLabels = { scene: "Scene", portrait: "Portrait", center_bg: "Center Background" };
  var label = slotLabels[slot] || slot;

  var previewClass = slot === "scene" ? "scene-preview" : slot === "portrait" ? "portrait-preview" : "center-preview";

  var html =
    '<div class="rgn-adjuster-overlay" id="rgn-adjuster-overlay">'
    + '<div class="rgn-adjuster-sheet">'
    +   '<div class="rgn-adjuster-header">'
    +     '<div class="rgn-adjuster-title">Adjust ' + esc(label) + '</div>'
    +     '<button class="rgn-adjuster-close" data-action="close-adjuster">&times;</button>'
    +   '</div>'
    +   '<div class="rgn-adjuster-body">'
    +     '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:8px;text-align:center;">'
    +       'Use arrows to pan. Zoom to scale. Preview shows card placement.'
    +     '</div>'
    +     '<div class="rgn-adjuster-preview-wrap ' + previewClass + '">'
    +       '<div class="rgn-adjuster-preview-img" id="rgn-adjuster-img" '
    +       'style="background-image:' + imgUrl + ';'
    +       'background-position:' + posX + '% ' + posY + '%;'
    +       'background-size:' + zoom + '%;"></div>'
    +     '</div>'
    +     '<div style="text-align:center;font-size:10px;color:var(--dv-text2,#666);margin-bottom:10px;">Preview</div>'
    +     '<div class="rgn-adjuster-dpad">'
    +       '<button class="rgn-adjuster-dpad-btn dpad-up" data-dir="up">&#9650;</button>'
    +       '<button class="rgn-adjuster-dpad-btn dpad-left" data-dir="left">&#9664;</button>'
    +       '<div class="rgn-adjuster-dpad-btn dpad-center"></div>'
    +       '<button class="rgn-adjuster-dpad-btn dpad-right" data-dir="right">&#9654;</button>'
    +       '<button class="rgn-adjuster-dpad-btn dpad-down" data-dir="down">&#9660;</button>'
    +     '</div>'
    +     '<div class="rgn-adjuster-zoom-wrap">'
    +       '<div class="rgn-adjuster-zoom-label">'
    +         '<span>Zoom</span><span id="rgn-adjuster-zoom-val">' + zoom + '%</span>'
    +       '</div>'
    +       '<input type="range" id="rgn-adjuster-zoom" min="100" max="300" step="5" value="' + zoom + '">'
    +     '</div>'
    +     '<div class="rgn-adjuster-actions">'
    +       '<button class="rgn-action-btn" data-action="adjuster-save">Save</button>'
    +       '<button class="rgn-action-btn rgn-action-btn-danger" data-action="adjuster-cancel">Cancel</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '</div>';

  var temp = document.createElement("div");
  temp.innerHTML = html;
  var overlay = temp.firstElementChild;
  document.body.appendChild(overlay);

  // State
  var state = { posX: posX, posY: posY, zoom: zoom };

  // Elements
  var imgEl = overlay.querySelector("#rgn-adjuster-img");
  var zoomInput = overlay.querySelector("#rgn-adjuster-zoom");
  var zoomVal = overlay.querySelector("#rgn-adjuster-zoom-val");

  function updatePreview() {
    if (imgEl) {
      imgEl.style.backgroundPosition = state.posX + "% " + state.posY + "%";
      imgEl.style.backgroundSize = state.zoom + "%";
    }
  }

  // D-pad events
  overlay.querySelectorAll(".rgn-adjuster-dpad-btn[data-dir]").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var dir = btn.dataset.dir;
      var step = 5;
      if (dir === "up") state.posY = Math.max(0, state.posY - step);
      if (dir === "down") state.posY = Math.min(100, state.posY + step);
      if (dir === "left") state.posX = Math.max(0, state.posX - step);
      if (dir === "right") state.posX = Math.min(100, state.posX + step);
      updatePreview();
    });
  });

  // Zoom events
  if (zoomInput) {
    zoomInput.addEventListener("input", function() {
      state.zoom = parseInt(zoomInput.value, 10);
      if (zoomVal) zoomVal.textContent = state.zoom + "%";
      updatePreview();
    });
  }

  // Close
  overlay.querySelector("[data-action='close-adjuster']").addEventListener("click", close);
  overlay.querySelector("[data-action='adjuster-cancel']").addEventListener("click", close);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) close();
  });

  // Save
  overlay.querySelector("[data-action='adjuster-save']").addEventListener("click", function() {
    var current = ra.getSettings(regionId || "");
    current[posKeyX] = state.posX;
    current[posKeyY] = state.posY;
    current[zoomKey] = state.zoom;
    ra.saveSettings(regionId || "", current);
    refreshCard(regionIdx);
    close();
  });

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 7 — REGION DETAIL PAGE
// ═════════════════════════════════════════════════════════════════════════════

function openDetailPage(region, regionIdx) {
  var ra = RegionAssets;
  var regionId = region.id;
  var accent = region.color_accent || region.color || "#888";

  mState.detailPage = { regionIdx: regionIdx, regionId: regionId };

  // Detail page settings
  var detailSettings = ra.getDetailSettings(regionId) || {};
  var detailBgUrl = ra.getCssUrl("detail_bg", regionId) || "";
  var sections = detailSettings.sections || buildDefaultSections(region);

  // Scene image for hero
  var sceneUrl = ra.getCssUrl("scene", regionId);
  var hasScene = !!sceneUrl;

  // Build hero
  var heroHtml = "";
  if (hasScene) {
    heroHtml =
      '<div class="rgn-detail-hero">'
      + '<div class="rgn-detail-scene" id="rgn-detail-scene" style="background-image:' + sceneUrl + ';"></div>'
      + (detailBgUrl ? '<div class="rgn-detail-bg" id="rgn-detail-bg" style="background-image:' + detailBgUrl + ';"></div>' : '')
      + '<div class="rgn-detail-hero-gradient"></div>'
      + '<div class="rgn-detail-hero-content">'
      +   '<div class="rgn-detail-hero-title" id="rgn-detail-title">' + esc(region.name) + '</div>'
      +   (region.tagline ? '<div class="rgn-detail-hero-tagline">' + esc(region.tagline) + '</div>' : '')
      + '</div>'
      + '<button class="rgn-detail-back" id="rgn-detail-back">&#9664;</button>'
      + '</div>';
  } else {
    heroHtml =
      '<div class="rgn-detail-hero" style="height:140px;background:linear-gradient(135deg,' + hexToRgba(accent,0.25) + ' 0%,rgba(0,0,0,0) 100%);">'
      + '<div class="rgn-detail-hero-gradient"></div>'
      + '<div class="rgn-detail-hero-content">'
      +   '<div class="rgn-detail-hero-title" id="rgn-detail-title">' + esc(region.name) + '</div>'
      +   (region.tagline ? '<div class="rgn-detail-hero-tagline">' + esc(region.tagline) + '</div>' : '')
      + '</div>'
      + '<button class="rgn-detail-back" id="rgn-detail-back">&#9664;</button>'
      + '</div>';
  }

  // Build sections
  var sectionsHtml = buildDetailSections(region, sections, detailSettings);

  var html =
    '<div class="rgn-detail-overlay" id="rgn-detail-overlay">'
    + '<div class="rgn-detail-scroll" id="rgn-detail-scroll">'
    +   heroHtml
    +   '<div class="rgn-detail-body">'
    +     sectionsHtml
    +   '</div>'
    + '</div>'
    + '</div>';

  var temp = document.createElement("div");
  temp.innerHTML = html;
  var overlay = temp.firstElementChild;
  document.documentElement.appendChild(overlay);

  // Scroll handler for scene → bg fade
  var scrollEl = overlay.querySelector("#rgn-detail-scroll");
  var sceneEl = overlay.querySelector("#rgn-detail-scene");
  var bgEl = overlay.querySelector("#rgn-detail-bg");

  if (scrollEl && (sceneEl || bgEl)) {
    scrollEl.addEventListener("scroll", function() {
      var scrollTop = scrollEl.scrollTop;
      var fadeStart = 20;
      var fadeEnd = 180;
      var progress = Math.min(Math.max((scrollTop - fadeStart) / (fadeEnd - fadeStart), 0), 1);

      if (sceneEl) sceneEl.style.opacity = (1 - progress).toFixed(3);
      if (bgEl) bgEl.style.opacity = progress.toFixed(3);
    });
  }

  // Back button
  overlay.querySelector("#rgn-detail-back").addEventListener("click", function() {
    closeDetailPage();
  });

  // Title click → detail settings
  overlay.querySelector("#rgn-detail-title").addEventListener("click", function() {
    openDetailSettings(region, regionIdx);
  });
}

function closeDetailPage() {
  var overlay = document.documentElement.querySelector("#rgn-detail-overlay");
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  mState.detailPage = null;
  mState.detailSettingsOpen = false;
}

// ── Build default sections from region data ──
function buildDefaultSections(region) {
  var sections = [];

  sections.push({ type: "climate", title: "Climate" });

  if (region.countries && region.countries.length) {
    sections.push({ type: "countries", title: "Countries" });
  }

  if (region.cities && region.cities.length) {
    sections.push({ type: "cities", title: "Cities" });
  }

  if (region.guardian && region.guardian.name) {
    sections.push({ type: "guardian", title: "Guardian" });
  }

  if (region.academies && region.academies.length) {
    sections.push({ type: "academies", title: "Academies" });
  }

  if (region.guilds && region.guilds.length) {
    sections.push({ type: "guilds", title: "Guilds" });
  }

  if (region.corporations && region.corporations.length) {
    sections.push({ type: "corporations", title: "Corporations" });
  }

  if (region.bloodlines && region.bloodlines.length) {
    sections.push({ type: "bloodlines", title: "Bloodlines" });
  }

  if (region.lore_tags && region.lore_tags.length) {
    sections.push({ type: "tags", title: "Lore Tags" });
  }

  return sections;
}

// ── Build detail sections HTML ──
function buildDetailSections(region, sections, detailSettings) {
  var ra = RegionAssets;
  var regionId = region.id;
  var html = "";

  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var secHtml = "";
    var imageHtml = "";

    // Section image
    if (sec.image) {
      var imgUrl = ra.getCssUrl(sec.image, regionId);
      if (imgUrl) {
        var alignClass = sec.imageAlign ? "rgn-detail-section-image-align-" + sec.imageAlign : "";
        var fadeTop = sec.fadeTop || 0;
        var fadeBottom = sec.fadeBottom || 0;
        imageHtml =
          '<div class="rgn-detail-section-image ' + alignClass + '" style="background-image:' + imgUrl + ';">'
          + '<div class="rgn-detail-section-image-fade-top" style="--section-fade-top:' + fadeTop + 'px;"></div>'
          + '<div class="rgn-detail-section-image-fade-bottom" style="--section-fade-bottom:' + fadeBottom + 'px;"></div>'
          + '</div>';
      }
    }

    switch (sec.type) {
      case "climate":
        if (region.climate) {
          secHtml = '<div class="rgn-detail-climate">' + esc(region.climate) + '</div>';
        }
        break;

      case "countries":
        if (region.countries && region.countries.length) {
          var parts = [];
          for (var ci = 0; ci < region.countries.length; ci++) {
            var c = region.countries[ci];
            parts.push(
              '<div class="rgn-detail-country">'
              + '<div class="rgn-detail-country-name">' + esc(c.name) + '</div>'
              + (c.capital ? '<div class="rgn-detail-country-capital">Capital: ' + esc(c.capital) + '</div>' : '')
              + (c.note ? '<div class="rgn-detail-country-note">' + esc(c.note) + '</div>' : '')
              + '</div>'
            );
          }
          secHtml = '<div class="rgn-detail-list">' + parts.join('') + '</div>';
        }
        break;

      case "cities":
        if (region.cities && region.cities.length) {
          var cityParts = [];
          for (var ci2 = 0; ci2 < region.cities.length; ci2++) {
            var city = region.cities[ci2];
            cityParts.push(
              '<div class="rgn-detail-list-item">'
              + '<div class="rgn-detail-list-item-name">' + esc(city.name) + '</div>'
              + (city.role ? '<div class="rgn-detail-list-item-meta">' + esc(city.role) + (city.population ? ' &middot; ' + esc(city.population) : '') + '</div>' : '')
              + (city.note ? '<div class="rgn-detail-list-item-note">' + esc(city.note) + '</div>' : '')
              + '</div>'
            );
          }
          secHtml = '<div class="rgn-detail-list">' + cityParts.join('') + '</div>';
        }
        break;

      case "guardian":
        if (region.guardian && region.guardian.name) {
          var g = region.guardian;
          var guardianSigilInline = ra.getSvgInline("guardian_sigil", regionId);
          var guardianSigilImgSrc = ra.getImgSrc("guardian_sigil", regionId);
          var iconHtml = guardianSigilInline
            ? '<div class="rgn-guardian-sigil-wrap" style="width:40px;height:40px;">' + guardianSigilInline + '</div>'
            : guardianSigilImgSrc
              ? '<div class="rgn-guardian-sigil-wrap" style="width:40px;height:40px;"><img src="' + guardianSigilImgSrc + '" alt=""></div>'
              : '<div class="rgn-detail-guardian-diamond"></div>';

          secHtml =
            '<div class="rgn-detail-guardian-card">'
            + iconHtml
            + '<div class="rgn-detail-guardian-info">'
            +   '<div class="rgn-detail-guardian-rank">' + esc(g.rank || "SSS") + '-Rank Guardian</div>'
            +   '<div class="rgn-detail-guardian-name">' + esc(g.name) + '</div>'
            +   (g.title ? '<div class="rgn-detail-guardian-title">' + esc(g.title) + '</div>' : '')
            + '</div></div>';
        }
        break;

      case "academies":
        if (region.academies && region.academies.length) {
          var acadParts = [];
          for (var ai = 0; ai < region.academies.length; ai++) {
            var a = region.academies[ai];
            acadParts.push(
              '<div class="rgn-detail-list-item">'
              + '<div class="rgn-detail-list-item-name">' + esc(a.name) + '</div>'
              + (a.location ? '<div class="rgn-detail-list-item-meta">' + esc(a.location) + '</div>' : '')
              + (a.note ? '<div class="rgn-detail-list-item-note">' + esc(a.note) + '</div>' : '')
              + '</div>'
            );
          }
          secHtml = '<div class="rgn-detail-list">' + acadParts.join('') + '</div>';
        }
        break;

      case "guilds":
        if (region.guilds && region.guilds.length) {
          var guildParts = [];
          for (var gi = 0; gi < region.guilds.length; gi++) {
            var guild = region.guilds[gi];
            guildParts.push(
              '<div class="rgn-detail-list-item">'
              + '<div class="rgn-detail-list-item-name">' + esc(guild.name) + '</div>'
              + (guild.size ? '<div class="rgn-detail-list-item-meta">' + esc(guild.size) + '</div>' : '')
              + (guild.note ? '<div class="rgn-detail-list-item-note">' + esc(guild.note) + '</div>' : '')
              + '</div>'
            );
          }
          secHtml = '<div class="rgn-detail-list">' + guildParts.join('') + '</div>';
        }
        break;

      case "corporations":
        if (region.corporations && region.corporations.length) {
          var corpParts = [];
          for (var ci3 = 0; ci3 < region.corporations.length; ci3++) {
            var corp = region.corporations[ci3];
            corpParts.push(
              '<div class="rgn-detail-list-item">'
              + '<div class="rgn-detail-list-item-name">' + esc(corp.name) + '</div>'
              + (corp.note ? '<div class="rgn-detail-list-item-note">' + esc(corp.note) + '</div>' : '')
              + '</div>'
            );
          }
          secHtml = '<div class="rgn-detail-list">' + corpParts.join('') + '</div>';
        }
        break;

      case "bloodlines":
        if (region.bloodlines && region.bloodlines.length) {
          var bloodParts = [];
          for (var bi = 0; bi < region.bloodlines.length; bi++) {
            var b = region.bloodlines[bi];
            bloodParts.push(
              '<div class="rgn-detail-list-item">'
              + '<div class="rgn-detail-list-item-name">' + esc(b.name) + '</div>'
              + (b.note ? '<div class="rgn-detail-list-item-note">' + esc(b.note) + '</div>' : '')
              + '</div>'
            );
          }
          secHtml = '<div class="rgn-detail-list">' + bloodParts.join('') + '</div>';
        }
        break;

      case "tags":
        if (region.lore_tags && region.lore_tags.length) {
          var tagParts = [];
          for (var ti = 0; ti < region.lore_tags.length; ti++) {
            tagParts.push('<span class="rgn-detail-tag">' + esc(region.lore_tags[ti]) + '</span>');
          }
          secHtml = '<div class="rgn-detail-tags">' + tagParts.join('') + '</div>';
        }
        break;

      case "text":
        if (sec.content) {
          secHtml = '<div class="rgn-detail-text">' + esc(sec.content).replace(/\n/g, '<br>') + '</div>';
        }
        break;

      case "divider":
        secHtml = '<div class="rgn-settings-divider" style="margin:20px 0;"></div>';
        break;
    }

    if (secHtml) {
      html +=
        '<div class="rgn-detail-section">'
        + '<div class="rgn-detail-section-title">' + esc(sec.title) + '</div>'
        + imageHtml
        + secHtml
        + '</div>';
    }
  }

  return html;
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 8 — DETAIL PAGE SETTINGS
// ═════════════════════════════════════════════════════════════════════════════

function openDetailSettings(region, regionIdx) {
  var ra = RegionAssets;
  var regionId = region.id;

  if (mState.detailSettingsOpen) return;
  mState.detailSettingsOpen = true;

  var detailSettings = ra.getDetailSettings(regionId) || {};
  var sections = detailSettings.sections || buildDefaultSections(region);

  // Available section types
  var sectionTypes = [
    { value: "climate", label: "Climate" },
    { value: "countries", label: "Countries" },
    { value: "cities", label: "Cities" },
    { value: "guardian", label: "Guardian" },
    { value: "academies", label: "Academies" },
    { value: "guilds", label: "Guilds" },
    { value: "corporations", label: "Corporations" },
    { value: "bloodlines", label: "Bloodlines" },
    { value: "tags", label: "Lore Tags" },
    { value: "text", label: "Custom Text" },
    { value: "divider", label: "Divider" }
  ];

  // Build sections editor
  var sectionsHtml = '<div class="rgn-section-builder-list" id="rgn-section-builder-list">';
  for (var i = 0; i < sections.length; i++) {
    sectionsHtml += buildSectionEditorRow(sections[i], i, regionId, regionIdx, sectionTypes);
  }
  sectionsHtml += '</div>';

  // Available images for sections
  var imageSlots = [
    { key: "", label: "No Image" },
    { key: "scene", label: "Scene" },
    { key: "portrait", label: "Portrait" },
    { key: "center_bg", label: "Center BG" },
    { key: "detail_bg", label: "Detail BG" }
  ];
  var imageOptionsHtml = imageSlots.map(function(s) {
    return '<option value="' + s.key + '">' + esc(s.label) + '</option>';
  }).join('');

  var panel =
    '<div class="rgn-detail-settings-overlay" id="rgn-detail-settings-overlay">'
    + '<div class="rgn-detail-settings-sheet">'
    +   '<div class="rgn-settings-header">'
    +     '<div class="rgn-settings-title">Detail Page \u2014 ' + esc(region.name) + '</div>'
    +     '<button class="rgn-settings-close" data-action="close-detail-settings">&times;</button>'
    +   '</div>'
    +   '<div class="rgn-detail-settings-body">'
    +     '<div class="rgn-slot-section-title">Detail Background Image</div>'
    +     '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:8px;">Shown as the scene image fades on scroll.</div>'
    +     buildDetailSlotRow("detail_bg", "Background Image", "Fades in as you scroll", regionId, regionIdx)
    +     '<div class="rgn-settings-divider"></div>'
    +     '<div class="rgn-slot-section-title">Sections</div>'
    +     '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:8px;">Drag to reorder (use arrow buttons). Select type, add images, set style.</div>'
    +     sectionsHtml
    +     '<button class="rgn-add-section-btn" data-action="add-section">+ Add Section</button>'
    +     '<div class="rgn-settings-divider"></div>'
    +     '<div class="rgn-settings-actions">'
    +       '<button class="rgn-action-btn" data-action="save-detail-settings">Save & Apply</button>'
    +       '<button class="rgn-action-btn rgn-action-btn-danger" data-action="reset-detail-settings">Reset to Default</button>'
    +     '</div>'
    +   '</div>'
    + '</div>'
    + '</div>';

  var temp = document.createElement("div");
  temp.innerHTML = panel;
  var overlay = temp.firstElementChild;
  document.documentElement.appendChild(overlay);

  // Fill preview images asynchronously
  requestAnimationFrame(function() {
    ra.fillPreviews(overlay);
  });

  // Close handler
  overlay.querySelector("[data-action='close-detail-settings']").addEventListener("click", close);
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) close();
  });

  function close() {
    mState.detailSettingsOpen = false;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  // Add section
  overlay.querySelector("[data-action='add-section']").addEventListener("click", function() {
    var list = overlay.querySelector("#rgn-section-builder-list");
    if (list) {
      var newIdx = list.children.length;
      var newSec = { type: "text", title: "New Section" };
      var rowHtml = buildSectionEditorRow(newSec, newIdx, regionId, regionIdx, sectionTypes);
      var rowTemp = document.createElement("div");
      rowTemp.innerHTML = rowHtml;
      list.appendChild(rowTemp.firstElementChild);
      bindSectionRowEvents(list.lastElementChild);
    }
  });

  // Save detail settings
  overlay.querySelector("[data-action='save-detail-settings']").addEventListener("click", function() {
    var newSections = collectSectionsFromEditor(overlay);
    var detailBg = overlay.querySelector('[data-detail-slot="detail_bg"]');
    var newSettings = {
      sections: newSections
    };
    ra.saveDetailSettings(regionId, newSettings);

    // Refresh the detail page
    closeDetailPage();
    openDetailPage(region, regionIdx);
  });

  // Reset
  overlay.querySelector("[data-action='reset-detail-settings']").addEventListener("click", function() {
    ra.saveDetailSettings(regionId, { sections: buildDefaultSections(region) });
    closeDetailPage();
    openDetailPage(region, regionIdx);
    close();
  });

  // File pick for detail_bg
  overlay.querySelectorAll("[data-action='pick-detail']").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var slot = btn.dataset.slot;
      var rid = btn.dataset.regionId || null;
      var ridx = btn.dataset.regionIdx;
      var inputId = "rgn-detail-file-" + slot + "-" + regionIdx;
      var input = document.getElementById(inputId);
      if (input) input.click();
    });
  });

  overlay.querySelectorAll(".rgn-slot-file-input").forEach(function(input) {
    if (input.dataset.detail === "true") {
      input.addEventListener("change", function() {
        if (!input.files || !input.files[0]) return;
        var file = input.files[0];
        var slot = input.dataset.slot;
        var rid = input.dataset.regionId || null;
        var rowId = "rgn-detail-row-" + slot + "-" + regionIdx;
        RegionAssets.set(slot, rid, file).then(function() {
          var previewWrap = document.querySelector("#" + rowId + " .rgn-slot-preview-wrap");
          if (previewWrap) {
            previewWrap.innerHTML = RegionAssets.getPreviewHtml(slot, rid);
            RegionAssets.fillPreviews(overlay);
          }
        });
        input.value = "";
      });
    }
  });

  // Clear detail slot
  overlay.querySelectorAll("[data-action='clear-detail-slot']").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var slot = btn.dataset.slot;
      var rid = btn.dataset.regionId || null;
      var rowId = "rgn-detail-row-" + slot + "-" + regionIdx;
      RegionAssets.clear(slot, rid).then(function() {
        var previewWrap = document.querySelector("#" + rowId + " .rgn-slot-preview-wrap");
        if (previewWrap) {
          previewWrap.innerHTML = '<div class="rgn-slot-empty">No image</div>';
          previewWrap.classList.remove("has-image");
        }
      }).catch(function(err) {
        console.error("[RegionModule] Failed to clear detail slot:", err);
      });
    });
  });

  // Bind section row events
  overlay.querySelectorAll(".rgn-section-builder-item").forEach(bindSectionRowEvents);

  function bindSectionRowEvents(row) {
    // Move up/down
    row.querySelectorAll("[data-action='sec-up'],[data-action='sec-down']").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var action = btn.dataset.action;
        var list = overlay.querySelector("#rgn-section-builder-list");
        if (!list) return;
        if (action === "sec-up" && row.previousElementSibling) {
          list.insertBefore(row, row.previousElementSibling);
        } else if (action === "sec-down" && row.nextElementSibling) {
          list.insertBefore(row.nextElementSibling, row);
        }
        reindexSections(list);
      });
    });

    // Remove
    var removeBtn = row.querySelector("[data-action='sec-remove']");
    if (removeBtn) {
      removeBtn.addEventListener("click", function() {
        row.parentNode.removeChild(row);
        var list = overlay.querySelector("#rgn-section-builder-list");
        if (list) reindexSections(list);
      });
    }

    // Type change
    var typeSelect = row.querySelector(".rgn-section-type-select");
    if (typeSelect) {
      typeSelect.addEventListener("change", function() {
        var titleInput = row.querySelector(".rgn-section-title-input");
        if (titleInput) {
          var opt = typeSelect.options[typeSelect.selectedIndex];
          titleInput.value = opt.text;
        }
      });
    }

    // Align buttons
    row.querySelectorAll(".rgn-section-align-btn[data-align]").forEach(function(btn) {
      btn.addEventListener("click", function() {
        row.querySelectorAll(".rgn-section-align-btn").forEach(function(b) {
          b.classList.remove("is-active");
        });
        btn.classList.add("is-active");
      });
    });
  }

  function reindexSections(list) {
    var items = list.querySelectorAll(".rgn-section-builder-item");
    items.forEach(function(item, idx) {
      item.dataset.sectionIndex = idx;
    });
  }
}

function buildSectionEditorRow(sec, idx, regionId, regionIdx, sectionTypes) {
  var typeOptions = sectionTypes.map(function(t) {
    return '<option value="' + t.value + '"' + (sec.type === t.value ? ' selected' : '') + '>' + esc(t.label) + '</option>';
  }).join('');

  var imageSlots = [
    { key: "", label: "No Image" },
    { key: "scene", label: "Scene" },
    { key: "portrait", label: "Portrait" },
    { key: "center_bg", label: "Center BG" },
    { key: "detail_bg", label: "Detail BG" },
    { key: "card_bg", label: "Card BG" }
  ];
  var imageOptions = imageSlots.map(function(s) {
    return '<option value="' + s.key + '"' + (sec.image === s.key ? ' selected' : '') + '>' + esc(s.label) + '</option>';
  }).join('');

  var alignOpts = ["left", "center", "right"];
  var alignHtml = alignOpts.map(function(a) {
    return '<button class="rgn-section-align-btn' + (sec.imageAlign === a ? ' is-active' : '') + '" data-align="' + a + '">' + a + '</button>';
  }).join('');

  return '<div class="rgn-section-builder-item" data-section-index="' + idx + '">'
    + '<div class="rgn-section-builder-item-header">'
    +   '<input type="text" class="rgn-section-title-input" value="' + esc(sec.title || '') + '" '
    +     'style="flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:6px;'
    +     'padding:6px 10px;color:var(--dv-text1,#e0e0e0);font-size:12px;outline:none;" '
    +     'placeholder="Section title">'
    +   '<div class="rgn-section-builder-item-actions">'
    +     '<button class="rgn-section-builder-btn" data-action="sec-up">&#9650;</button>'
    +     '<button class="rgn-section-builder-btn" data-action="sec-down">&#9660;</button>'
    +     '<button class="rgn-section-builder-btn rgn-section-builder-btn-danger" data-action="sec-remove">&times;</button>'
    +   '</div>'
    + '</div>'
    + '<select class="rgn-section-type-select">' + typeOptions + '</select>'
    + '<div class="rgn-section-image-row">'
    +   '<select class="rgn-section-image-select" style="flex:1;padding:6px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);'
    +     'background:rgba(255,255,255,0.05);color:var(--dv-text1,#e0e0e0);font-size:11px;outline:none;">'
    +     imageOptions + '</select>'
    + '</div>'
    + '<div style="font-size:10px;color:var(--dv-text2,#888);margin-bottom:4px;">Image alignment</div>'
    + '<div class="rgn-section-align-options">' + alignHtml + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:6px;">'
    +   '<div style="flex:1;">'
    +     '<div style="font-size:9px;color:var(--dv-text2,#888);margin-bottom:2px;">Fade top (px)</div>'
    +     '<input type="number" class="rgn-section-fade-top" value="' + (sec.fadeTop || 0) + '" '
    +       'style="width:100%;padding:5px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);'
    +       'background:rgba(255,255,255,0.05);color:var(--dv-text1,#e0e0e0);font-size:11px;box-sizing:border-box;" '
    +       'min="0" max="160">'
    +   '</div>'
    +   '<div style="flex:1;">'
    +     '<div style="font-size:9px;color:var(--dv-text2,#888);margin-bottom:2px;">Fade bottom (px)</div>'
    +     '<input type="number" class="rgn-section-fade-bottom" value="' + (sec.fadeBottom || 0) + '" '
    +       'style="width:100%;padding:5px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);'
    +       'background:rgba(255,255,255,0.05);color:var(--dv-text1,#e0e0e0);font-size:11px;box-sizing:border-box;" '
    +       'min="0" max="160">'
    +   '</div>'
    + '</div>'
    + (sec.type === "text" ? '<textarea class="rgn-section-text-input" placeholder="Enter text content..." '
      + 'style="width:100%;min-height:60px;padding:8px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);'
      + 'background:rgba(255,255,255,0.05);color:var(--dv-text1,#e0e0e0);font-size:12px;resize:vertical;box-sizing:border-box;'
      + 'font-family:inherit;outline:none;">' + esc(sec.content || '') + '</textarea>' : '')
    + '</div>';
}

function buildDetailSlotRow(slot, label, hint, regionId, regionIdx) {
  var ra = RegionAssets;
  var preview = ra.getPreviewHtml(slot, regionId);
  var rowId = "rgn-detail-row-" + slot + "-" + regionIdx;
  var inputId = "rgn-detail-file-" + slot + "-" + regionIdx;

  return '<div class="rgn-slot-row" id="' + rowId + '" data-detail-slot="' + slot + '" data-region-id="' + esc(regionId || "") + '">'
    + '<div class="rgn-slot-preview-wrap">' + preview + '</div>'
    + '<div class="rgn-slot-info">'
    +   '<div class="rgn-slot-name">' + esc(label) + '</div>'
    +   '<div class="rgn-slot-hint">' + esc(hint) + '</div>'
    + '</div>'
    + '<div class="rgn-slot-actions">'
    +   '<button class="rgn-slot-btn" data-action="pick-detail" data-slot="' + slot + '" data-region-id="' + esc(regionId || "") + '" data-region-idx="' + regionIdx + '">Pick</button>'
    +   '<button class="rgn-slot-btn rgn-slot-btn-clear" data-action="clear-detail-slot" data-slot="' + slot + '" data-region-id="' + esc(regionId || "") + '" data-region-idx="' + regionIdx + '">&times;</button>'
    + '</div>'
    + '<input type="file" class="rgn-slot-file-input" id="' + inputId + '" accept="image/png,image/webp,image/svg+xml" '
    +   'data-slot="' + slot + '" data-region-id="' + esc(regionId || "") + '" data-detail="true">'
    + '</div>';
}

function collectSectionsFromEditor(overlay) {
  var list = overlay.querySelector("#rgn-section-builder-list");
  if (!list) return [];
  var items = list.querySelectorAll(".rgn-section-builder-item");
  var sections = [];
  items.forEach(function(item) {
    var titleInput = item.querySelector(".rgn-section-title-input");
    var typeSelect = item.querySelector(".rgn-section-type-select");
    var imageSelect = item.querySelector(".rgn-section-image-select");
    var activeAlign = item.querySelector(".rgn-section-align-btn.is-active");
    var fadeTopInput = item.querySelector(".rgn-section-fade-top");
    var fadeBottomInput = item.querySelector(".rgn-section-fade-bottom");
    var textInput = item.querySelector(".rgn-section-text-input");

    var sec = {
      type: typeSelect ? typeSelect.value : "text",
      title: titleInput ? titleInput.value : "",
      image: imageSelect ? imageSelect.value : "",
      imageAlign: activeAlign ? activeAlign.dataset.align : "center",
      fadeTop: fadeTopInput ? parseInt(fadeTopInput.value, 10) || 0 : 0,
      fadeBottom: fadeBottomInput ? parseInt(fadeBottomInput.value, 10) || 0 : 0
    };
    if (textInput) sec.content = textInput.value;
    sections.push(sec);
  });
  return sections;
}


// ═════════════════════════════════════════════════════════════════════════════
//  PART 9 — MODULE SHELL + RENDER LOOP
// ═════════════════════════════════════════════════════════════════════════════

function render() {
  ensureCSS();
  var regions = getRegionLore();

  if (!regions || !regions.length) {
    container.innerHTML =
      '<div class="rgn-error-card">'
      + '<div class="rgn-error-msg">Failed to load region lore data.<br>Make sure <code>config/region-lore.json</code> exists.</div>'
      + '<button class="rgn-error-retry" id="rgn-retry-btn">Retry</button>'
      + '</div>';

    var retryBtn = container.querySelector("#rgn-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", function() {
        mState.loaded = false;
        mState.error = null;
        initModule();
      });
    }
    return;
  }

  mState._lore = regions;

  var isFirstRender = !container.querySelector("#rgn-cards-list");

  if (isFirstRender) {
    // Full build — only runs once
    var cardsHtml = "";
    for (var i = 0; i < regions.length; i++) {
      cardsHtml += buildRegionCard(regions[i], i);
    }

    var sectionBgUrl = RegionAssets.getCssUrl("section_bg", null);
    var sectionBgHtml = sectionBgUrl
      ? '<div class="rgn-section-bg" style="background-image:' + sectionBgUrl + ';"></div>'
      : "";

    var rootHtml =
      sectionBgHtml
      + '<div class="rgn-root">'
      + '<div class="rgn-header">'
      +   '<div class="rgn-header-title" id="rgn-header-title">'
      +     'Human Regions'
      +     '<span class="rgn-header-title-arrow">&#9660;</span>'
      +   '</div>'
      +   '<div class="rgn-header-subtitle">The Eight Territories of the Known World</div>'
      + '</div>'
      + '<div class="rgn-cards-list" id="rgn-cards-list">'
      +   cardsHtml
      + '</div>'
      + '</div>';

    container.style.position = "relative";
    container.style.overflow = "hidden";
    container.innerHTML = rootHtml;

    injectImageStyles(regions);
    bindCardEvents(regions);
    bindHeaderEvents(regions);
  }

  // Header menu — append/remove without touching cards
  var header = container.querySelector(".rgn-header");
  var existingMenu = container.querySelector("#rgn-header-menu");
  var headerTitle = container.querySelector("#rgn-header-title");

  if (mState.headerMenuOpen) {
    if (!existingMenu && header) {
      var menuItems = "";
      for (var mi = 0; mi < regions.length; mi++) {
        var mr = regions[mi];
        var dotColor = mr.color || mr.color_accent || "#888";
        menuItems +=
          '<div class="rgn-header-menu-item" data-action="open-settings" data-region-idx="' + mi + '">'
          + '<div class="rgn-header-menu-dot" style="background:' + dotColor + ';"></div>'
          + '<span class="rgn-header-menu-name">' + esc(mr.name) + '</span>'
          + '<span class="rgn-header-menu-gear">&#9881;</span>'
          + '</div>';
      }
      var menuEl = document.createElement("div");
      menuEl.className = "rgn-header-menu";
      menuEl.id = "rgn-header-menu";
      menuEl.innerHTML = menuItems;
      header.appendChild(menuEl);
      bindHeaderMenuEvents(regions, menuEl);
    }
    if (headerTitle) headerTitle.classList.add("is-open");
  } else {
    if (existingMenu) existingMenu.remove();
    if (headerTitle) headerTitle.classList.remove("is-open");
  }

  // Settings panel — append/remove without touching cards
  var root = container.querySelector(".rgn-root");
  var existingOverlay = container.querySelector(".rgn-settings-overlay");

  if (mState.settingsOpen !== null) {
    var sIdx = mState.settingsOpen;
    if (sIdx >= 0 && sIdx < regions.length) {
      if (existingOverlay && parseInt(existingOverlay.dataset.regionIdx, 10) !== sIdx) {
        existingOverlay.remove();
        existingOverlay = null;
      }
      if (!existingOverlay && root) {
        var panelHtml = buildSettingsPanel(regions[sIdx], sIdx);
        var tempDiv = document.createElement("div");
        tempDiv.innerHTML = panelHtml;
        var newOverlay = tempDiv.firstElementChild;
        root.appendChild(newOverlay);
        requestAnimationFrame(function() {
          RegionAssets.fillPreviews(newOverlay);
        });
        bindSettingsEvents(regions, newOverlay);
      }
    }
  } else {
    if (existingOverlay) existingOverlay.remove();
  }
}

// ── Card click events — bound once on first render ──
function bindCardEvents(regions) {
  container.querySelectorAll(".rgn-card").forEach(function(card) {
    card.addEventListener("click", function(e) {
      if (e.target.closest("[data-action]")) return;
      var idx = parseInt(card.dataset.regionIdx, 10);
      if (regions[idx]) openDetailPage(regions[idx], idx);
    });
  });
}

// ── Header title toggle — bound once on first render ──
function bindHeaderEvents(regions) {
  var headerTitle = container.querySelector("#rgn-header-title");
  if (headerTitle) {
    headerTitle.addEventListener("click", function(e) {
      e.stopPropagation();
      mState.headerMenuOpen = !mState.headerMenuOpen;
      render();
    });
  }

  // Click outside to close menu
  document.addEventListener("click", function onDocClick(e) {
    if (!mState.headerMenuOpen) return;
    var menu = container.querySelector("#rgn-header-menu");
    var title = container.querySelector("#rgn-header-title");
    if (menu && !menu.contains(e.target) && title && !title.contains(e.target)) {
      mState.headerMenuOpen = false;
      render();
    }
  });
}

// ── Header menu items — bound each time the menu is opened ──
function bindHeaderMenuEvents(regions, menuEl) {
  menuEl.addEventListener("click", function(e) {
    var item = e.target.closest("[data-action='open-settings']");
    if (item) {
      var idx = parseInt(item.dataset.regionIdx, 10);
      mState.headerMenuOpen = false;
      mState.settingsOpen = idx;
      render();
    }
  });
}

// ── Settings panel events — bound each time the panel is opened ──
function bindSettingsEvents(regions, overlay) {
  // Close button
  var closeBtn = overlay.querySelector(".rgn-settings-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", function() {
      mState.settingsOpen = null;
      render();
    });
  }

  // Backdrop tap to close
  overlay.addEventListener("click", function(e) {
    if (e.target === overlay) {
      mState.settingsOpen = null;
      render();
    }
  });

  // Pick buttons → trigger file input
  overlay.querySelectorAll("[data-action='pick']").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var slot = btn.dataset.slot;
      var rid = btn.dataset.regionId || null;
      var ridx = btn.dataset.regionIdx;
      var inputId = "rgn-file-" + slot + "-" + (rid || "global") + "-" + ridx;
      var input = document.getElementById(inputId);
      if (input) input.click();
    });
  });

  // Image adjuster button
  overlay.querySelectorAll("[data-action='adjust-image']").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var slot = btn.dataset.slot;
      var rid = btn.dataset.regionId || null;
      var ridx = parseInt(btn.dataset.regionIdx, 10);
      openImageAdjuster(slot, rid, ridx);
    });
  });

  // File input changes → encode and save
  overlay.querySelectorAll(".rgn-slot-file-input").forEach(function(input) {
    input.addEventListener("change", function() {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      var slot = input.dataset.slot;
      var rid = input.dataset.regionId || null;
      var ridx = input.dataset.regionIdx;
      var rowId = "rgn-row-" + slot + "-" + (rid || "global") + "-" + ridx;
      var warnEl = document.getElementById(rowId + "-warn");
      var sizeWarn = RegionAssets.checkSize(file);
      if (warnEl) {
        warnEl.textContent = sizeWarn || "";
        warnEl.style.display = sizeWarn ? "block" : "none";
      }
      RegionAssets.set(slot, rid, file).then(function() {
        var savedEl = document.getElementById(rowId + "-saved");
        if (savedEl) {
          savedEl.style.display = "block";
          setTimeout(function() { savedEl.style.display = "none"; }, 2000);
        }
        refreshCard(ridx);
        refreshSettingsPreview(slot, rid, ridx);
      }).catch(function(err) {
        console.error("[RegionModule] Failed to save asset:", err);
        if (warnEl) {
          warnEl.textContent = "Save failed: " + (err.message || "Unknown error");
          warnEl.style.display = "block";
        }
      });
      input.value = "";
    });
  });

  // Clear slot buttons
  overlay.querySelectorAll("[data-action='clear-slot']").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var slot = btn.dataset.slot;
      var rid = btn.dataset.regionId || null;
      var ridx = btn.dataset.regionIdx;
      RegionAssets.clear(slot, rid).then(function() {
        refreshCard(ridx);
        refreshSettingsPanel();
      }).catch(function(err) {
        console.error("[RegionModule] Failed to clear asset:", err);
      });
    });
  });

  // Clear all for region
  var clearRegionBtn = overlay.querySelector("[data-action='clear-region']");
  if (clearRegionBtn) {
    clearRegionBtn.addEventListener("click", function() {
      var rid = clearRegionBtn.dataset.regionId;
      var ridx = clearRegionBtn.dataset.regionIdx;
      if (!rid) return;
      RegionAssets.clearRegion(rid).then(function() {
        refreshCard(ridx);
        refreshSettingsPanel();
      }).catch(function(err) {
        console.error("[RegionModule] Failed to clear region:", err);
      });
    });
  }

  // Export cache
  var exportBtn = overlay.querySelector("[data-action='export-cache']");
  if (exportBtn) {
    exportBtn.addEventListener("click", function() { exportCacheBackup(); });
  }

  // Apply-all tick toggle
  var applyAllBtn = overlay.querySelector("#rgn-apply-all-btn");
  var applyAllActive = false;
  if (applyAllBtn) {
    applyAllBtn.addEventListener("click", function() {
      applyAllActive = !applyAllActive;
      applyAllBtn.setAttribute("aria-pressed", applyAllActive ? "true" : "false");
      applyAllBtn.classList.toggle("is-active", applyAllActive);
    });
  }

  // Range sliders
  overlay.querySelectorAll("input[type=range][data-setting-key]").forEach(function(slider) {
    var valEl = document.getElementById(slider.id + "-val");

    slider.addEventListener("input", function() {
      if (valEl) valEl.textContent = slider.value;
      var key = slider.dataset.settingKey;
      var rid = slider.dataset.regionId || null;
      var ridx = parseInt(slider.dataset.regionIdx, 10);
      var val = parseFloat(slider.value);
      var current = RegionAssets.getSettings(rid);
      current[key] = val;
      if (rid) {
        if (!RegionAssets._data.regions[rid]) RegionAssets._data.regions[rid] = {};
        RegionAssets._data.regions[rid]["__settings__"] = JSON.stringify(current);
      } else {
        RegionAssets._data.global["__settings__"] = JSON.stringify(current);
      }
      applySettingsToCard(ridx, rid, current);

      // Apply-all: propagate only this key to every other region
      if (applyAllActive && mState._lore) {
        mState._lore.forEach(function(otherRegion, otherIdx) {
          if (otherIdx === ridx) return; // skip current card
          var otherId = otherRegion.id || null;
          var otherSettings = RegionAssets.getSettings(otherId);
          otherSettings[key] = val;
          if (otherId) {
            if (!RegionAssets._data.regions[otherId]) RegionAssets._data.regions[otherId] = {};
            RegionAssets._data.regions[otherId]["__settings__"] = JSON.stringify(otherSettings);
          } else {
            RegionAssets._data.global["__settings__"] = JSON.stringify(otherSettings);
          }
          applySettingsToCard(otherIdx, otherId, otherSettings);
        });
      }
    });

    slider.addEventListener("change", function() {
      var key = slider.dataset.settingKey;
      var rid = slider.dataset.regionId || null;
      var val = parseFloat(slider.value);
      var current = RegionAssets.getSettings(rid);
      current[key] = val;
      RegionAssets.saveSettings(rid, current);

      // Persist to all other regions too if apply-all is active
      if (applyAllActive && mState._lore) {
        mState._lore.forEach(function(otherRegion, otherIdx) {
          var otherId = otherRegion.id || null;
          if (otherId === rid) return;
          var otherSettings = RegionAssets.getSettings(otherId);
          otherSettings[key] = val;
          RegionAssets.saveSettings(otherId, otherSettings);
        });
      }
    });
  });
}

// ── Inject all card image styles into a single <style> block ──
// Called once after render. Images live in the stylesheet, never in card HTML.
function injectImageStyles(regions) {
  var existing = document.getElementById("rgn-img-styles");
  if (existing) existing.remove();

  var css = "";
  var slots = ["scene", "portrait", "center_bg", "card_bg", "frame"];

  regions.forEach(function(r) {
    slots.forEach(function(slot) {
      var url = RegionAssets.getCssUrl(slot, r.id) || RegionAssets.getCssUrl(slot, null);
      if (!url) return;
      var cls = slot === "center_bg" ? "rgn-center-bg" : "rgn-" + slot.replace(/_/g, "-");
      css += '.' + cls + '[data-region-id="' + r.id + '"]{background-image:' + url + ';}\n';
    });
  });

  // Global card_bg and section_bg
  var cardBgUrl = RegionAssets.getCssUrl("card_bg", null);
  if (cardBgUrl) css += '.rgn-card-bg{background-image:' + cardBgUrl + ';}\n';
  var sectionBgUrl = RegionAssets.getCssUrl("section_bg", null);
  if (sectionBgUrl) css += '.rgn-section-bg{background-image:' + sectionBgUrl + ';}\n';

  if (!css) return;
  var style = document.createElement("style");
  style.id = "rgn-img-styles";
  style.textContent = css;
  document.head.appendChild(style);
}

// ── Surgical card update — only touches changed style properties, never rebuilds HTML ──
function applySettingsToCard(regionIdx, regionId, settings) {
  var card = container.querySelector('[data-region-idx="' + regionIdx + '"]');
  if (!card) return;

  var s = settings;
  function g(key, def) { return s[key] !== undefined ? s[key] : def; }

  // ── Text positions
  var name = card.querySelector(".rgn-name");
  if (name) {
    name.style.top        = g("nameOffsetY", 0) + "px";
    name.style.marginLeft = g("nameOffsetX", 0) + "px";
  }

  var country = card.querySelector(".rgn-eraser-strip-content");
  if (country) {
    country.style.top        = g("countryOffsetY", 0) + "px";
    country.style.marginLeft = g("countryOffsetX", 0) + "px";
  }

  var tagline = card.querySelector(".rgn-tagline-strip");
  if (tagline) {
    tagline.style.top        = g("taglineOffsetY", 0) + "px";
    tagline.style.marginLeft = g("taglineOffsetX", 0) + "px";
    var et = g("eraserTop",0), eb = g("eraserBottom",0), el = g("eraserLeft",0), er = g("eraserRight",0);
    tagline.style.setProperty("--es-top",    et + "px");
    tagline.style.setProperty("--es-bottom", eb + "px");
    tagline.style.setProperty("--es-left",   el + "px");
    tagline.style.setProperty("--es-right",  er + "px");
  }

  var guardian = card.querySelector(".rgn-guardian-row");
  if (guardian) {
    guardian.style.bottom = (-g("guardianOffsetY", 0)) + "px";
    guardian.style.left   = g("guardianOffsetX", 0) + "px";
    guardian.style.right  = (-g("guardianOffsetX", 0)) + "px";
  }

  var sigil = card.querySelector(".rgn-sigil");
  if (sigil) {
    sigil.style.top   = (7 + g("sigilOffsetY", 0)) + "px";
    sigil.style.right = (7 - g("sigilOffsetX", 0)) + "px";
  }

  // ── Image positions (update background-position on existing layer elements)
  var scene = card.querySelector(".rgn-scene");
  if (scene) {
    scene.style.backgroundPosition = g("scenePosX", 50) + "% " + g("scenePosY", 50) + "%";
    var sceneZoom = g("sceneZoom", 100);
    scene.style.backgroundSize = sceneZoom !== 100 ? sceneZoom + "%" : "cover";
    scene.style.zIndex = g("sceneZ", 2);
    var sf = g("sceneFade", 40);
    var sceneMask = "linear-gradient(to right,black " + sf + "%,transparent 100%)";
    scene.style.webkitMaskImage = sceneMask;
    scene.style.maskImage       = sceneMask;
  }

  var center = card.querySelector(".rgn-center-bg");
  if (center) {
    center.style.backgroundPosition = g("centerPosX", 50) + "% " + g("centerPosY", 50) + "%";
    var centerZoom = g("centerZoom", 100);
    center.style.backgroundSize = centerZoom !== 100 ? centerZoom + "%" : "cover";
    center.style.zIndex = g("centerZ", 3);
    var cf = g("centerFade", 12);
    var centerMask = "linear-gradient(to right,transparent 0%,black " + cf + "%,black " + (100-cf) + "%,transparent 100%)";
    center.style.webkitMaskImage = centerMask;
    center.style.maskImage       = centerMask;
  }

  var portrait = card.querySelector(".rgn-portrait");
  if (portrait) {
    portrait.style.backgroundPosition = g("portraitPosX", 50) + "% " + g("portraitPosY", 50) + "%";
    var portraitZoom = g("portraitZoom", 100);
    portrait.style.backgroundSize = portraitZoom !== 100 ? portraitZoom + "%" : "cover";
    portrait.style.zIndex = g("portraitZ", 4);
    var pf = g("portraitFade", 45);
    var portraitMask = "linear-gradient(to left,black " + pf + "%,transparent 100%)";
    portrait.style.webkitMaskImage = portraitMask;
    portrait.style.maskImage       = portraitMask;
  }

  // ── Frame area and image area insets
  var frameArea = card.querySelector(".rgn-frame-area");
  if (frameArea) {
    var fpX = g("framePadX", 6) + "px";
    var fpY = g("framePadY", 6) + "px";
    frameArea.style.top    = fpY;
    frameArea.style.left   = fpX;
    frameArea.style.right  = fpX;
    frameArea.style.bottom = fpY;
  }

  var imageArea = frameArea ? frameArea.querySelector("div > div") : null;
  if (imageArea) {
    var ipX = (g("framePadX", 6) + g("imgInsetW", 0)) + "px";
    var ipY = (g("framePadY", 6) + g("imgInsetH", 0)) + "px";
    imageArea.style.top    = ipY;
    imageArea.style.left   = ipX;
    imageArea.style.right  = ipX;
    imageArea.style.bottom = ipY;
  }

  // ── Content padding
  var content = card.querySelector(".rgn-content");
  if (content) {
    var pad = g("padding", 10);
    content.style.padding = pad + "px " + pad + "px " + (pad + 18) + "px " + pad + "px";
  }

  // ── Shadows — rebuild text-shadow on text elements
  var nameShadowStyle    = buildTextShadow(g("nameShadow", 0.75), 1.6);
  var countryShadowStyle = buildTextShadow(g("countryShadow", 0.75), 1.4);
  var taglineShadowStyle = buildTextShadow(g("taglineShadow", 0.75), 1.3);
  var guardianShadowStyle = buildTextShadow(g("guardianShadow", 0.75), 1.4);

  // Extract just the value from "text-shadow: X !important;" for setProperty
  function extractShadowValue(css) {
    var m = css.match(/text-shadow:\s*(.+?)(?:\s*!important)?\s*;/);
    return m ? m[1] : "none";
  }
  var nameShVal      = extractShadowValue(nameShadowStyle);
  var countryShVal   = extractShadowValue(countryShadowStyle);
  var taglineShVal   = extractShadowValue(taglineShadowStyle);
  var guardianShVal  = extractShadowValue(guardianShadowStyle);

  if (name) name.style.setProperty("text-shadow", nameShVal, "important");

  // Country shadow must go on the text spans, not the wrapper div — text-shadow doesn't inherit
  card.querySelectorAll(".rgn-country, .rgn-country-cap").forEach(function(el) {
    el.style.setProperty("text-shadow", countryShVal, "important");
  });

  var taglineText = card.querySelector(".rgn-tagline");
  if (taglineText) taglineText.style.setProperty("text-shadow", taglineShVal, "important");

  card.querySelectorAll(".rgn-guardian-rank, .rgn-guardian-name, .rgn-guardian-title").forEach(function(el) {
    el.style.setProperty("text-shadow", guardianShVal, "important");
  });

  // Clean up any previously injected scoped shadow style tag for this card
  var oldStyleEl = document.getElementById("rgn-shadow-" + regionIdx);
  if (oldStyleEl) oldStyleEl.remove();
}

// ── Refresh a single card without full re-render ──
function refreshCard(regionIdx) {
  if (!mState._lore || !mState._lore[regionIdx]) return;
  var region = mState._lore[regionIdx];
  var cardsList = container.querySelector("#rgn-cards-list");
  if (!cardsList) return;
  var oldCard = cardsList.querySelector('[data-region-idx="' + regionIdx + '"]');
  if (!oldCard) return;

  var newCardHtml = buildRegionCard(region, regionIdx);
  var tempDiv = document.createElement("div");
  tempDiv.innerHTML = newCardHtml;
  var newCard = tempDiv.firstElementChild;
  if (newCard && oldCard.parentNode) {
    oldCard.parentNode.replaceChild(newCard, oldCard);
  }
  // Re-inject image styles so new/cleared images take effect
  injectImageStyles(mState._lore);
  // Re-bind click for the new card
  newCard.addEventListener("click", function() {
    openDetailPage(region, regionIdx);
  });
}

// ── Refresh settings panel preview ──
function refreshSettingsPreview(slot, regionId, regionIdx) {
  var rowId = "rgn-row-" + slot + "-" + (regionId || "global") + "-" + regionIdx;
  var row = document.getElementById(rowId);
  if (!row) return;
  var previewWrap = row.querySelector(".rgn-slot-preview-wrap");
  if (previewWrap) {
    previewWrap.innerHTML = RegionAssets.getPreviewHtml(slot, regionId);
    requestAnimationFrame(function() {
      RegionAssets.fillPreviews(row.closest(".rgn-settings-overlay") || document.body);
    });
  }
}

// ── Full settings panel refresh ──
function refreshSettingsPanel() {
  if (mState.settingsOpen === null) return;
  var region = mState._lore[mState.settingsOpen];
  if (!region) return;

  var oldOverlay = container.querySelector(".rgn-settings-overlay");
  if (!oldOverlay) return;

  var newPanelHtml = buildSettingsPanel(region, mState.settingsOpen);
  var tempDiv = document.createElement("div");
  tempDiv.innerHTML = newPanelHtml;
  var newOverlay = tempDiv.firstElementChild;
  if (newOverlay && oldOverlay.parentNode) {
    oldOverlay.parentNode.replaceChild(newOverlay, oldOverlay);
    requestAnimationFrame(function() {
      RegionAssets.fillPreviews(newOverlay);
    });
    bindSettingsEvents(mState._lore, newOverlay);
  }
}

// ── Export cache as downloadable backup ──
function exportCacheBackup() {
  try {
    var data = JSON.stringify(RegionAssets._data, null, 2);
    var blob = new Blob([data], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "region-assets-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch(e) {
    console.error("[RegionModule] Export failed:", e);
    alert("Export failed: " + e.message);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  INIT SEQUENCE
// ═════════════════════════════════════════════════════════════════════════════

function initModule() {
  if (RegionAssets._loaded) {
    render();
    return;
  }

  container.innerHTML = '<div class="rgn-loading">Loading region data...</div>';

  RegionAssets.load().then(function() {
    mState.loaded = true;
    mState.error = null;
    var regions = getRegionLore();
    if (regions && regions.length) RegionAssets.warmBlobCache(regions);
    render();
  }).catch(function(e) {
    console.error("[RegionModule] Init error:", e);
    mState.error = e.message || "Failed to initialize";
    container.innerHTML =
      '<div class="rgn-error-card">'
      + '<div class="rgn-error-msg">' + esc(mState.error) + '</div>'
      + '<button class="rgn-error-retry" id="rgn-retry-btn">Retry</button>'
      + '</div>';

    var retryBtn = container.querySelector("#rgn-retry-btn");
    if (retryBtn) {
      retryBtn.addEventListener("click", function() {
        RegionAssets._loaded = false;
        mState.error = null;
        initModule();
      });
    }
  });
}

// ── Kick off ──
initModule();

}; // end DEVOUR.modules["regions"]

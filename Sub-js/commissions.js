// ╔══════════════════════════════════════════════════════════════╗
// ║  DEVOUR SYSTEM — COMMISSIONS MODULE  v1.0                   ║
// ║  Registered as: DEVOUR.modules["commissions"]               ║
// ║  Depends on:    DEVOUR.cfg.world / .economy / .regions      ║
// ║  Items from:    Inventory/Services/Commission/*.md          ║
// ╚══════════════════════════════════════════════════════════════╝

DEVOUR.modules["commissions"] = function(DEVOUR, container, shellState) {

var el   = DEVOUR.utils.el;
var div  = DEVOUR.utils.div;
var span = DEVOUR.utils.span;
var esc  = DEVOUR.utils.escapeHtml;

var WORLD_CFG  = DEVOUR.cfg.world;
var ECON_CFG   = DEVOUR.cfg.economy;
var REGION_CFG = DEVOUR.cfg.regions;

// ── COMMISSION RANK ORDER ────────────────────────────────────
var COMM_RANKS = [
  "Open", "Listed", "Verified", "Recognized",
  "Notable", "Distinguished", "Renowned", "Sovereign"
];

// ── CONTRACT TYPES ───────────────────────────────────────────
var CONTRACT_TYPES = [
  "all", "Bounty", "Collection", "Escort",
  "Taming", "Reconnaissance", "Clearance", "Retrieval", "Classified"
];

// ── STATUS CONFIG ────────────────────────────────────────────
var STATUS_COLORS = {
  "Open":        { cls: "comm-status-open",     color: "#00c8aa" },
  "In Progress": { cls: "comm-status-progress", color: "#d4a843" },
  "Completed":   { cls: "comm-status-done",     color: "#4a6040" },
  "Expired":     { cls: "comm-status-expired",  color: "#4a5870" },
  "Classified":  { cls: "comm-status-class",    color: "#cc2200" }
};

// ── DANGER CONFIG ────────────────────────────────────────────
var DANGER_CONFIG = {
  "Low":      { cls: "danger-low",      color: "#4a9a4a", pips: 1 },
  "Moderate": { cls: "danger-moderate", color: "#d4a843", pips: 2 },
  "High":     { cls: "danger-high",     color: "#cc7a00", pips: 3 },
  "Extreme":  { cls: "danger-extreme",  color: "#cc2200", pips: 4 },
  "Unknown":  { cls: "danger-unknown",  color: "#4a5870", pips: 0 }
};

// ── RANK COLORS (Corebearer rank for difficulty) ─────────────
var RANK_COLORS = {
  "F":"#888","E":"#4aaa4a","D":"#4a8fff","C":"#cc44cc",
  "B":"#ff8c00","A":"#ff4444","S":"#ffdd00","SS":"#ff88ff","SSS":"#00ffee"
};

// ── COMMISSION FEE ───────────────────────────────────────────
// Default 12%, reduced by rank per economy config
function getCommFee(commRank) {
  if (!ECON_CFG || !ECON_CFG.commission_ranks) return 12;
  var ranks = ECON_CFG.commission_ranks;
  for (var i = 0; i < ranks.length; i++) {
    if (ranks[i].rank === commRank) return ranks[i].fee_cut;
  }
  return 12;
}

// ── CURRENCY FORMAT ──────────────────────────────────────────
function formatReward(raw, showUSD) {
  if (!raw || isNaN(raw)) return null;
  var n = Number(raw);
  var result;
  if (n < 10000) {
    result = { amount: Math.round(n).toLocaleString(), symbol: "credits", cls: "price-credit" };
  } else if (n < 500000000) {
    var c = n / 10000;
    var g = c >= 1000 ? "High" : c >= 100 ? "Mid" : "Low";
    result = {
      amount: c < 10 ? c.toFixed(2) : Math.round(c).toLocaleString(),
      symbol: g + " Crystal", cls: "price-crystal"
    };
  } else {
    var cores = n / 500000000;
    result = {
      amount: cores < 10 ? cores.toFixed(3) : cores.toFixed(1),
      symbol: "Core", cls: "price-core"
    };
  }
  if (showUSD) {
    var uv = n * 0.50;
    if      (uv >= 1000000000) result.usd = "$" + (uv/1000000000).toFixed(1) + "B";
    else if (uv >= 1000000)    result.usd = "$" + (uv/1000000).toFixed(1)    + "M";
    else if (uv >= 1000)       result.usd = "$" + Math.round(uv/1000)        + "K";
    else                       result.usd = "$" + Math.round(uv).toLocaleString();
  }
  return result;
}

// ── MODULE STATE ─────────────────────────────────────────────
if (!DEVOUR._commState) {
  DEVOUR._commState = {
    view:          "board",    // board | detail | reference
    detailPath:    null,
    search:        "",
    typeFilter:    "all",
    statusFilter:  "all",
    regionFilter:  "all",
    sortKey:       "posted_date",
    sortDir:       "desc",
    showHidden:    false,
    showUSD:       false,
  };
}
var state = DEVOUR._commState;

// Sync from shell
state.showHidden = shellState.showHidden || false;
state.showUSD    = shellState.showUSD    || false;

// ── LIVE VALUES FROM SHELL ───────────────────────────────────
function getCommRank() {
  // Read from DEVOUR.state for persistence, fall back to shellState, then config
  if (DEVOUR.state && DEVOUR.state._commOverride) return DEVOUR.state._commOverride;
  if (shellState._commOverride) return shellState._commOverride;
  return WORLD_CFG.commission_rank || "Open";
}

function getCommRankIdx(rank) {
  var idx = COMM_RANKS.indexOf(rank);
  return idx === -1 ? 0 : idx;
}

function isCommRestricted(contract) {
  var viewerIdx   = getCommRankIdx(getCommRank());
  var requiredIdx = getCommRankIdx(contract.visibility_rank || "Open");
  return requiredIdx > viewerIdx;
}

// ── DATA LOADING ─────────────────────────────────────────────
function loadContracts(showHidden) {
  return dv.pages('"Inventory/Services/Commission"').array().map(function(p) {
    return {
      name:               p.file.name,
      path:               p.file.path,
      contract_type:      p.contract_type      || "Classified",
      contract_status:    p.contract_status    || "Open",
      visibility_rank:    p.visibility_rank    || "Open",
      difficulty:         p.difficulty         || "F",
      danger:             p.danger             || "Unknown",
      reward:             p.reward             || null,
      reward_bonus:       p.reward_bonus       || "",
      reward_classified:  p.reward_classified  || false,
      origin:             p.origin             || "Aethelgard Reach",
      poster:             p.poster             || "[ANONYMOUS]",
      poster_anonymous:   p.poster_anonymous   || false,
      poster_accord:      p.poster_accord      || false,
      posted_date:        p.posted_date        || "",
      expires_date:       p.expires_date       || "",
      description:        p.description        || "",
      lore_hidden:        p.lore_hidden        || false,
    };
  }).filter(function(c) {
    return showHidden ? true : !c.lore_hidden;
  });
}

// ── FILTER ───────────────────────────────────────────────────
function filterContracts(contracts, search, typeF, statusF, regionF) {
  return contracts.filter(function(c) {
    if (search) {
      var q = search.toLowerCase();
      var fields = [c.name, c.contract_type, c.origin, c.poster, c.description];
      var found = false;
      for (var i = 0; i < fields.length; i++) {
        if ((fields[i] || "").toLowerCase().indexOf(q) !== -1) { found = true; break; }
      }
      if (!found) return false;
    }
    if (typeF   && typeF   !== "all" && c.contract_type   !== typeF)   return false;
    if (statusF && statusF !== "all" && c.contract_status !== statusF) return false;
    if (regionF && regionF !== "all" && c.origin          !== regionF) return false;
    return true;
  });
}

// ── SORT ─────────────────────────────────────────────────────
function sortContracts(contracts, key, dir) {
  var rankOrder = ["F","E","D","C","B","A","S","SS","SSS"];
  var commOrder = COMM_RANKS;
  var statOrder = ["Open","In Progress","Completed","Expired","Classified"];

  return contracts.slice().sort(function(a, b) {
    var va, vb;
    if (key === "difficulty") {
      va = rankOrder.indexOf((a.difficulty || "F").toUpperCase());
      vb = rankOrder.indexOf((b.difficulty || "F").toUpperCase());
    } else if (key === "visibility_rank") {
      va = commOrder.indexOf(a.visibility_rank || "Open");
      vb = commOrder.indexOf(b.visibility_rank || "Open");
    } else if (key === "contract_status") {
      va = statOrder.indexOf(a.contract_status || "Open");
      vb = statOrder.indexOf(b.contract_status || "Open");
    } else if (key === "reward") {
      va = Number(a.reward) || 0;
      vb = Number(b.reward) || 0;
    } else {
      va = (a[key] || "").toString().toLowerCase();
      vb = (b[key] || "").toString().toLowerCase();
    }
    if (va < vb) return dir === "asc" ? -1 : 1;
    if (va > vb) return dir === "asc" ?  1 : -1;
    return 0;
  });
}

// ── BADGE BUILDERS ───────────────────────────────────────────
function statusBadge(status) {
  var cfg = STATUS_COLORS[status] || STATUS_COLORS["Open"];
  return '<span class="comm-status-badge ' + cfg.cls + '">' + esc(status) + '</span>';
}

function typeBadge(type) {
  return '<span class="comm-type-badge">' + esc(type) + '</span>';
}

function difficultyBadge(rank) {
  var r   = (rank || "F").toUpperCase();
  var col = RANK_COLORS[r] || "#888";
  return '<span class="comm-diff-badge" style="color:' + col + ';border-color:' + col + '40">' + r + '</span>';
}

function dangerMeter(danger) {
  var cfg  = DANGER_CONFIG[danger] || DANGER_CONFIG["Unknown"];
  var pips = "";
  for (var i = 1; i <= 4; i++) {
    var on  = i <= cfg.pips;
    var col = on ? cfg.color : "transparent";
    pips += '<span class="comm-danger-pip' + (on ? " on" : "") + '" style="' + (on ? "background:" + cfg.color + ";border-color:" + cfg.color : "") + '"></span>';
  }
  return '<span class="comm-danger-meter" title="Danger: ' + esc(danger) + '">' + pips + '</span>';
}

function commRankBadge(rank) {
  var idx = getCommRankIdx(rank);
  var maxIdx = COMM_RANKS.length - 1;
  var frac = idx / maxIdx;
  // Color shifts amber→teal as rank increases
  var col = idx >= 6 ? "#cc44ff" : idx >= 4 ? "#d4a843" : idx >= 2 ? "#4a8fff" : "#4a5870";
  return '<span class="comm-rank-badge" style="color:' + col + ';border-color:' + col + '40">' + esc(rank) + '</span>';
}

function posterDisplay(contract, showHidden) {
  if (contract.poster_anonymous || contract.poster === "[ANONYMOUS]") {
    return '<span class="comm-poster-anon">[ANONYMOUS]</span>';
  }
  var out = '<span class="comm-poster">' + esc(contract.poster) + '</span>';
  if (contract.poster_accord && showHidden) {
    out += ' <span class="comm-accord-tag">◈ ACCORD</span>';
  }
  return out;
}

function rewardDisplay(contract, commRank, showUSD) {
  if (contract.reward_classified) {
    return '<span class="comm-reward-classified">[CLASSIFIED]</span>';
  }

  var feeRate = getCommFee(commRank);
  var raw     = Number(contract.reward) || 0;
  var net     = Math.round(raw * (1 - feeRate / 100));
  var fmtRaw  = raw  ? formatReward(raw,  false) : null;
  var fmtNet  = net  ? formatReward(net,  showUSD) : null;

  var out = "";
  if (fmtRaw) {
    out += '<span class="' + fmtRaw.cls + ' comm-reward-gross">' + fmtRaw.amount + ' ' + fmtRaw.symbol + '</span>';
    if (fmtNet && feeRate > 0) {
      out += '<span class="comm-reward-net-label">after ' + feeRate + '% fee: </span>';
      out += '<span class="' + fmtNet.cls + ' comm-reward-net">' + fmtNet.amount + ' ' + fmtNet.symbol + '</span>';
    } else if (feeRate === 0) {
      out += '<span class="comm-reward-net-label comm-sovereign-fee">No fee (Sovereign)</span>';
    }
    if (fmtNet && fmtNet.usd) {
      out += '<span class="price-usd">' + fmtNet.usd + '</span>';
    }
  } else {
    out += '<span class="comm-reward-nego">Negotiable</span>';
  }

  if (contract.reward_bonus) {
    out += '<span class="comm-reward-bonus">+ ' + esc(contract.reward_bonus) + '</span>';
  }

  return out;
}

// ── RESTRICTED CARD ──────────────────────────────────────────
function buildRestrictedCard(contract) {
  var reqRank = contract.visibility_rank || "Open";
  return div("comm-card comm-card-restricted",
    div("comm-card-top",
      '<span class="comm-restricted-name">[RESTRICTED — INSUFFICIENT STANDING]</span>' +
      '<span class="comm-restricted-rank">Requires: ' + esc(reqRank) + '</span>'
    ) +
    div("comm-card-mid",
      typeBadge(contract.contract_type) + " " +
      difficultyBadge(contract.difficulty) + " " +
      dangerMeter(contract.danger)
    ) +
    div("comm-card-bot",
      '<span class="comm-origin">&#8857; ' + esc(contract.origin) + '</span>'
    )
  );
}

// ── CONTRACT CARD ────────────────────────────────────────────
function buildContractCard(contract, commRank, showHidden, showUSD) {
  if (isCommRestricted(contract)) return buildRestrictedCard(contract);

  var status    = contract.contract_status || "Open";
  var isExpired = status === "Expired" || status === "Completed";
  var isClassif = contract.contract_type === "Classified";
  var hiddenTag = (contract.lore_hidden && showHidden)
    ? '<span class="hidden-tag"> HIDDEN</span>' : "";
  var accordTag = (contract.poster_accord && showHidden)
    ? ' <span class="comm-accord-tag">◈ ACCORD</span>' : "";

  return div("comm-card" + (isExpired ? " comm-card-expired" : "") + (isClassif ? " comm-card-classified" : ""),
    div("comm-card-top",
      '<span class="comm-card-name"><a href="' + contract.path + '">' + esc(contract.name) + '</a>' + hiddenTag + '</span>' +
      '<span class="comm-card-reward">' + rewardDisplay(contract, commRank, showUSD) + '</span>'
    ) +
    div("comm-card-mid",
      typeBadge(contract.contract_type) + " " +
      statusBadge(status) + " " +
      difficultyBadge(contract.difficulty) + " " +
      dangerMeter(contract.danger) + " " +
      commRankBadge(contract.visibility_rank || "Open")
    ) +
    div("comm-card-bot",
      '<span class="comm-origin">&#8857; ' + esc(contract.origin) + '</span>' +
      '<span class="comm-poster-wrap">' + posterDisplay(contract, showHidden) + accordTag + '</span>' +
      (contract.expires_date ? '<span class="comm-expires">exp: ' + esc(contract.expires_date) + '</span>' : '') +
      (contract.description
        ? '<span class="comm-desc">' + esc(contract.description.slice(0, 80)) + (contract.description.length > 80 ? "..." : "") + '</span>'
        : "")
    )
  );
}

// ── DETAIL VIEW ──────────────────────────────────────────────
function buildDetailView(contract, commRank, showHidden, showUSD) {
  var restricted = isCommRestricted(contract);
  var feeRate    = getCommFee(commRank);
  var raw        = Number(contract.reward) || 0;
  var net        = Math.round(raw * (1 - feeRate / 100));
  var fmtRaw     = raw ? formatReward(raw,  false)   : null;
  var fmtNet     = net ? formatReward(net,  showUSD) : null;

  var header = div("comm-detail-header",
    div("comm-detail-badges",
      typeBadge(contract.contract_type) + " " +
      statusBadge(contract.contract_status || "Open") + " " +
      commRankBadge(contract.visibility_rank || "Open")
    ) +
    '<div class="comm-detail-name">' + esc(contract.name) + '</div>' +
    div("comm-detail-sub",
      '<span class="comm-origin">&#8857; ' + esc(contract.origin) + '</span>' +
      (contract.posted_date ? '<span class="comm-posted">Posted: ' + esc(contract.posted_date) + '</span>' : '') +
      (contract.expires_date ? '<span class="comm-expires">Expires: ' + esc(contract.expires_date) + '</span>' : '')
    )
  );

  if (restricted) {
    return '<button class="mkt-btn comm-back-btn" id="comm-back-btn">&larr; Board</button>' +
      header +
      div("comm-detail-restricted",
        '<div class="comm-restricted-msg">INSUFFICIENT COMMISSION STANDING</div>' +
        '<div class="comm-restricted-sub">This contract requires ' + esc(contract.visibility_rank) + '-rank standing or above.</div>'
      );
  }

  // Reward breakdown
  var rewardSection = div("comm-detail-section",
    '<div class="comm-detail-section-title">Reward</div>' +
    div("comm-detail-reward",
      (contract.reward_classified
        ? '<span class="comm-reward-classified">[CLASSIFIED]</span>'
        : (fmtRaw
          ? '<span class="' + fmtRaw.cls + ' comm-detail-gross">' + fmtRaw.amount + ' ' + fmtRaw.symbol + '</span>' +
            '<span class="comm-fee-line">Commission fee (' + feeRate + '%): ' +
              (feeRate === 0 ? '<span class="comm-sovereign-fee">Waived (Sovereign rank)</span>' :
                '<span class="comm-fee-amount">' + (fmtRaw ? formatReward(raw - net, false).amount + ' ' + formatReward(raw - net, false).symbol : '—') + '</span>') +
            '</span>' +
            (fmtNet && feeRate > 0
              ? '<span class="' + fmtNet.cls + ' comm-detail-net">Net: ' + fmtNet.amount + ' ' + fmtNet.symbol + (fmtNet.usd ? ' <span class="price-usd">' + fmtNet.usd + '</span>' : '') + '</span>'
              : '')
          : '<span class="comm-reward-nego">Negotiable</span>')
      ) +
      (contract.reward_bonus ? '<span class="comm-reward-bonus comm-detail-bonus">+ ' + esc(contract.reward_bonus) + '</span>' : '')
    )
  );

  // Danger + difficulty
  var riskSection = div("comm-detail-section comm-detail-risk",
    '<div class="comm-detail-section-title">Risk Assessment</div>' +
    '<div class="comm-risk-row">' +
      '<span class="comm-risk-label">Min Rank</span>' + difficultyBadge(contract.difficulty) +
    '</div>' +
    '<div class="comm-risk-row">' +
      '<span class="comm-risk-label">Danger</span>' +
      dangerMeter(contract.danger) +
      '<span class="comm-danger-text">' + esc(contract.danger) + '</span>' +
    '</div>'
  );

  // Poster
  var posterSection = div("comm-detail-section",
    '<div class="comm-detail-section-title">Posted By</div>' +
    '<div class="comm-detail-poster">' +
      posterDisplay(contract, showHidden) +
      (contract.poster_accord && showHidden ? ' <span class="comm-accord-tag">◈ ACCORD CONNECTED</span>' : '') +
    '</div>'
  );

  // Description
  var descSection = contract.description ? div("comm-detail-section",
    '<div class="comm-detail-section-title">Brief</div>' +
    '<div class="comm-detail-desc">' + esc(contract.description) + '</div>'
  ) : "";

  return '<button class="mkt-btn comm-back-btn" id="comm-back-btn">&larr; Board</button>' +
    header + rewardSection + riskSection + posterSection + descSection;
}

// ── REFERENCE VIEW ───────────────────────────────────────────
function buildReferenceView() {
  var commRanks = (ECON_CFG && ECON_CFG.commission_ranks) || [];
  var currentRank = getCommRank();

  var rows = commRanks.map(function(r) {
    var isActive = r.rank === currentRank;
    var idx      = getCommRankIdx(r.rank);
    var col      = idx >= 6 ? "#cc44ff" : idx >= 4 ? "#d4a843" : idx >= 2 ? "#4a8fff" : "#4a5870";
    return '<div class="comm-ref-row' + (isActive ? " comm-ref-active" : "") + '">' +
      '<span class="comm-ref-rank" style="color:' + col + '">' + esc(r.rank) + (isActive ? ' &#9654;' : '') + '</span>' +
      '<span class="comm-ref-members">' + (r.members || "—").toLocaleString() + '</span>' +
      '<span class="comm-ref-fee">' + (r.fee_cut === 0 ? "None" : r.fee_cut + "%") + '</span>' +
      '<span class="comm-ref-notes">' + esc(r.notes || "") + '</span>' +
      '</div>';
  }).join("");

  var header = '<div class="comm-ref-header">' +
    '<span class="comm-ref-rank">Rank</span>' +
    '<span class="comm-ref-members">Members</span>' +
    '<span class="comm-ref-fee">Fee</span>' +
    '<span class="comm-ref-notes">Notes</span>' +
    '</div>';

  var loreBox = div("comm-lore-box",
    '<div class="comm-lore-title">About the Commission</div>' +
    '<div class="comm-lore-text">The Commission for Open Contracts is a legitimate private enterprise registered in Orenthellion. ' +
    'Anyone may post. Anyone may join. The 12% processing fee on completed contracts is never waived — except for Sovereign-rank members. ' +
    'Higher-rank listings are invisible to lower-rank members. The most valuable contracts never appear on the open board at all.</div>' +
    '<div class="comm-lore-text">The Commission has been operating for approximately 400 years. ' +
    'What preceded it, and who truly controls it, is not information the Commission provides.</div>'
  );

  return '<button class="mkt-btn comm-back-btn" id="comm-back-btn">&larr; Board</button>' +
    div("comm-ref-wrap",
      loreBox +
      '<div class="comm-section-title">Membership Tiers</div>' +
      '<div class="comm-ref-table">' + header + rows + '</div>'
    );
}

// ── SELECT BUILDER ───────────────────────────────────────────
function buildSelect(id, options, current) {
  var opts = "";
  for (var i = 0; i < options.length; i++) {
    var o   = options[i];
    var val = typeof o === "object" ? o.value : o;
    var lbl = typeof o === "object" ? o.label : o;
    opts += '<option value="' + esc(val) + '"' + (val === current ? ' selected' : '') + '>' + esc(lbl) + '</option>';
  }
  return '<select class="mkt-sel" id="' + id + '">' + opts + '</select>';
}

// ── MAIN RENDER ──────────────────────────────────────────────
function render() {
  var commRank  = getCommRank();
  var showHidden = state.showHidden;
  var showUSD   = state.showUSD;

  var ALL   = loadContracts(showHidden);
  var total = loadContracts(false).length;

  // Counts by status
  var openCount  = ALL.filter(function(c){ return c.contract_status === "Open"; }).length;
  var doneCount  = ALL.filter(function(c){ return c.contract_status === "Completed"; }).length;
  var hidCount   = loadContracts(true).filter(function(c){ return c.lore_hidden; }).length;
  var accordCount = ALL.filter(function(c){ return c.poster_accord; }).length;

  // ── BOARD VIEW ──────────────────────────────────────────
  if (state.view === "board") {
    var filtered = filterContracts(ALL, state.search, state.typeFilter, state.statusFilter, state.regionFilter);
    var sorted   = sortContracts(filtered, state.sortKey, state.sortDir);

    var regionOpts = [{value:"all",label:"All Regions"}].concat(
      (REGION_CFG.regions || []).map(function(r){ return {value:r,label:r}; })
    );
    var typeOpts = CONTRACT_TYPES.map(function(t){ return {value:t,label:t==="all"?"All Types":t}; });
    var statusOpts = [{value:"all",label:"All Status"}].concat(
      ["Open","In Progress","Completed","Expired","Classified"].map(function(s){ return {value:s,label:s}; })
    );
    var sortOpts = [
      {value:"posted_date",   label:"Date"},
      {value:"reward",        label:"Reward"},
      {value:"difficulty",    label:"Difficulty"},
      {value:"contract_type", label:"Type"},
      {value:"origin",        label:"Region"},
      {value:"visibility_rank",label:"Standing"},
    ];

    var cards = sorted.length
      ? div("comm-card-grid", sorted.map(function(c){
          return buildContractCard(c, commRank, showHidden, showUSD);
        }).join(""))
      : div("no-results", "-- No contracts match current filters --");

    var sortDir = state.sortDir === "asc" ? " &#9650;" : " &#9660;";

    // Standing modal
    var standingModalOpts = COMM_RANKS.map(function(r) {
      var idx = getCommRankIdx(r);
      var col = idx >= 6 ? "#cc44ff" : idx >= 4 ? "#d4a843" : idx >= 2 ? "#4a8fff" : "#4a5870";
      return '<button class="dv-modal-opt comm-standing-modal-opt' + (r === commRank ? " active" : "") + '" ' +
        'data-rank="' + r + '" style="border-color:' + col + '40;color:' + col + '">' +
        esc(r) +
        '</button>';
    }).join("");

    var standingModal =
      '<div class="dv-modal-overlay comm-standing-modal" id="comm-standing-modal">' +
        div("dv-modal-box",
          '<div class="dv-modal-title">Commission Standing</div>' +
          '<div class="comm-standing-modal-note">Sets your visible rank on the Commission board. Contracts above your standing are hidden or restricted.</div>' +
          '<div class="dv-modal-opts comm-standing-modal-opts">' + standingModalOpts + '</div>' +
          '<button class="dv-modal-close dv-modal-dismiss" id="comm-standing-close">Close</button>'
        ) +
      '</div>';

    var html = div("comm-root",
      standingModal +
      // Stats bar
      div("comm-stats",
        div("stat-item", '<span class="sl">Contracts</span><span class="sv hi">' + total + '</span>') +
        div("stat-item", '<span class="sl">Open</span><span class="sv" style="color:var(--dv-teal)">' + openCount + '</span>') +
        div("stat-item", '<span class="sl">Completed</span><span class="sv" style="color:#4a6040">' + doneCount + '</span>') +
        (showHidden
          ? div("stat-item", '<span class="sl">Hidden</span><span class="sv" style="color:#4a5870">' + hidCount + '</span>') +
            div("stat-item", '<span class="sl">Accord</span><span class="sv" style="color:#cc44ff">' + accordCount + '</span>')
          : "") +
        div("stat-item stat-item-btn", '<span class="sl">Standing</span><span class="sv comm-standing-val" id="cc-standing-btn" style="color:' + (getCommRankIdx(commRank) >= 6 ? "#cc44ff" : getCommRankIdx(commRank) >= 4 ? "#d4a843" : getCommRankIdx(commRank) >= 2 ? "#4a8fff" : "#4a5870") + ';cursor:pointer;text-decoration:underline dotted">' + esc(commRank) + '</span>') +
        div("stat-item", '<span class="sl">Fee</span><span class="sv">' + getCommFee(commRank) + '%</span>')
      ) +

      // Header
      div("comm-board-header",
        '<div class="comm-board-title">COMMISSION BOARD</div>' +
        '<div class="comm-board-sub">Open Contracts Registry &middot; ' + esc(WORLD_CFG.active_date || "") + '</div>'
      ) +

      // Controls
      div("comm-controls",
        div("ctrl-row",
          buildSelect("cc-region", regionOpts, state.regionFilter) +
          buildSelect("cc-type",   typeOpts,   state.typeFilter) +
          buildSelect("cc-status", statusOpts, state.statusFilter)
        ) +
        div("ctrl-row ctrl-search-row",
          '<input class="mkt-input" id="cc-search" placeholder="Search contracts..." value="' + esc(state.search) + '">' +
          buildSelect("cc-sort", sortOpts, state.sortKey) +
          '<button class="mkt-btn comm-sort-dir-btn" id="cc-sortdir" title="Toggle sort direction">' + sortDir + '</button>' +
          '<button class="mkt-btn" id="cc-ref-btn" title="Commission reference">&#9432;</button>' +
          '<button class="mkt-btn' + (showHidden ? " mkt-btn-active" : "") + '" id="cc-author" title="Author mode">' + (showHidden ? "&#128065; ON" : "&#128065;") + '</button>' +
          '<button class="mkt-btn' + (showUSD ? " mkt-btn-active" : "") + '" id="cc-usd">&#36;</button>'
        )
      ) +

      // Notice — 12% fee
      div("comm-fee-notice",
        '&#9873; All rewards shown before the Commission processing fee of ' + getCommFee(commRank) + '% is deducted.'
      ) +

      cards
    );

    container.innerHTML = html;

    // Events — board
    var searchTimer;
    var searchEl = container.querySelector("#cc-search");
    if (searchEl) searchEl.addEventListener("input", function(e) {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function(){ state.search = e.target.value; render(); }, 250);
    });

    var selBindings = {
      "cc-region": function(v){ state.regionFilter = v; },
      "cc-type":   function(v){ state.typeFilter   = v; },
      "cc-status": function(v){ state.statusFilter = v; },
      "cc-sort":   function(v){ state.sortKey      = v; },
    };
    Object.keys(selBindings).forEach(function(id) {
      var el2 = container.querySelector("#" + id);
      if (el2) el2.addEventListener("change", function(e) {
        selBindings[id](e.target.value); render();
      });
    });

    var sortDirBtn = container.querySelector("#cc-sortdir");
    if (sortDirBtn) sortDirBtn.addEventListener("click", function() {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc"; render();
    });

    var refBtn = container.querySelector("#cc-ref-btn");
    if (refBtn) refBtn.addEventListener("click", function() {
      state.view = "reference"; render();
    });

    var authorBtn = container.querySelector("#cc-author");
    if (authorBtn) authorBtn.addEventListener("click", function() {
      state.showHidden = !state.showHidden; render();
    });

    var usdBtn = container.querySelector("#cc-usd");
    if (usdBtn) usdBtn.addEventListener("click", function() {
      state.showUSD = !state.showUSD;
      shellState.showUSD = state.showUSD;
      render();
    });

    // Standing pill → open modal
    var standingBtn = container.querySelector("#cc-standing-btn");
    if (standingBtn) standingBtn.addEventListener("click", function() {
      var modal = container.querySelector("#comm-standing-modal");
      if (modal) modal.classList.add("open");
    });

    // Standing modal close
    var standingClose = container.querySelector("#comm-standing-close");
    if (standingClose) standingClose.addEventListener("click", function() {
      var modal = container.querySelector("#comm-standing-modal");
      if (modal) modal.classList.remove("open");
    });

    // Standing modal options
    container.querySelectorAll(".comm-standing-modal-opt").forEach(function(btn) {
      btn.addEventListener("click", function() {
        var rank = btn.dataset.rank;
        // Write to DEVOUR.state so it persists like world state and clearance
        if (DEVOUR.state) DEVOUR.state._commOverride = rank;
        shellState._commOverride = rank;
        // Trigger shell's save function if available
        if (typeof savePersistedOverrides === "function") savePersistedOverrides();
        var modal = container.querySelector("#comm-standing-modal");
        if (modal) modal.classList.remove("open");
        render();
      });
    });

    // Close modal on overlay click
    var standingOverlay = container.querySelector("#comm-standing-modal");
    if (standingOverlay) standingOverlay.addEventListener("click", function(e) {
      if (e.target === standingOverlay) standingOverlay.classList.remove("open");
    });

    // Card click → detail
    container.querySelectorAll(".comm-card").forEach(function(card) {
      // Only non-restricted cards are clickable for detail
      if (card.classList.contains("comm-card-restricted")) return;
      card.addEventListener("click", function(e) {
        // Don't intercept link clicks
        if (e.target.tagName === "A") return;
        var link = card.querySelector("a");
        if (!link) return;
        var path = link.getAttribute("href");
        state.view       = "detail";
        state.detailPath = path;
        render();
      });
    });

    DEVOUR.utils.upgradeSelects(container);
    return;
  }

  // ── DETAIL VIEW ─────────────────────────────────────────
  if (state.view === "detail" && state.detailPath) {
    var target = null;
    for (var i = 0; i < ALL.length; i++) {
      if (ALL[i].path === state.detailPath) { target = ALL[i]; break; }
    }

    if (!target) {
      state.view = "board"; render(); return;
    }

    container.innerHTML = div("comm-root comm-detail-root",
      buildDetailView(target, commRank, showHidden, showUSD)
    );

    var backBtn = container.querySelector("#comm-back-btn");
    if (backBtn) backBtn.addEventListener("click", function() {
      state.view = "board"; render();
    });
    return;
  }

  // ── REFERENCE VIEW ───────────────────────────────────────
  if (state.view === "reference") {
    container.innerHTML = div("comm-root comm-ref-root",
      buildReferenceView()
    );

    var backBtn2 = container.querySelector("#comm-back-btn");
    if (backBtn2) backBtn2.addEventListener("click", function() {
      state.view = "board"; render();
    });
    return;
  }

  // Fallback
  state.view = "board"; render();
}

// ── INIT ─────────────────────────────────────────────────────
render();

}; // end DEVOUR.modules["commissions"]

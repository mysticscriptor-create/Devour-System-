// ============================================================
// LORD MARKHAM COREBEARER ACADEMY — LMCA.js v2.0
// Companion module to Dimensional Overseer
//
// DEPENDENCIES (injected by Overseer via new Function() args):
//   - dv, app, makeDropdown, fmtNum, STRIP_HTML, parseColors, getScroller
//
// EXPOSES:
//   - window.LMCA.render(container, titleEl, subtitleEl)
//   - window.LMCA.unmount()
//
// TABS: REGISTRY | TRACKS | DEPARTMENTS | RANKINGS | AP | DUNGEONS
// ============================================================

// ── DEPENDENCY CAPTURE ──
// These are passed as function arguments by Overseer's loadLMCA()
const _deps = { dv, app, makeDropdown, fmtNum, STRIP_HTML, parseColors, getScroller };

// ── DATA STATE ──
let TRACK_DATA = [], DEPT_DATA = [], RANKING_TIERS = [], STRIPE_LABELS = [];
let _dataLoaded = false;
let _dataPromise = null;

// ── DATA LOADING ──
async function _loadLMCAData() {
    if (_dataLoaded) return;
    const paths = [
        "lmca_data.json",
        "Meta/Scripts/lmca_data.json",
        "Scripts/lmca_data.json",
        "_data/lmca_data.json"
    ];
    for (const path of paths) {
        try {
            if (await _deps.app.vault.adapter.exists(path)) {
                const raw = await _deps.app.vault.adapter.read(path);
                const data = JSON.parse(raw);
                TRACK_DATA = data.TRACK_DATA || [];
                DEPT_DATA = data.DEPT_DATA || [];
                RANKING_TIERS = data.RANKING_TIERS || [];
                STRIPE_LABELS = data.STRIPE_LABELS || [];
                _dataLoaded = true;
                console.log("[LMCA] Data loaded from", path, "—", TRACK_DATA.length, "tracks,", DEPT_DATA.length, "depts");
                return;
            }
        } catch (e) { /* try next path */ }
    }
    console.error("[LMCA] lmca_data.json not found. Tried:", paths.join(", "));
    _dataLoaded = true; // Mark ready to prevent UI hang
}

// ── CSS INJECTION ──
async function _injectCSS() {
    if (document.getElementById('lmca-styles-v2')) return;
    const cssPaths = [
        "Meta/Scripts/LMCA.css",
        "Scripts/LMCA.css",
        "_css/LMCA.css"
    ];
    for (const path of cssPaths) {
        try {
            if (await _deps.app.vault.adapter.exists(path)) {
                const cssRaw = await _deps.app.vault.adapter.read(path);
                const style = document.createElement('style');
                style.id = 'lmca-styles-v2';
                style.textContent = cssRaw;
                document.head.appendChild(style);
                console.log("[LMCA] CSS injected from", path);
                return;
            }
        } catch (e) { /* try next */ }
    }
    console.warn("[LMCA] LMCA.css not found. Enable it as a CSS snippet for styling.");
}

// ── RANK HELPERS (mirrored from Overseer) ──
function normalizeRank(r) { return r ? r.toUpperCase().replace(/-/g, '\u2212') : "Dormant"; }

const RANK_ORDER = [
    "Dormant","F\u2212","F","F+","F++","F+++","E\u2212","E","E+","E++","E+++",
    "D\u2212","D","D+","D++","D+++","C\u2212","C","C+","C++","C+++",
    "B\u2212","B","B+","B++","B+++","A\u2212","A","A+","A++","A+++",
    "S\u2212","S","S+","S++","S+++","SS\u2212","SS","SS+","SS++","SS+++",
    "SSS","SSS+","SSS++","SSS+++"
];
function getRankSortKey(r) {
    const nr = normalizeRank(r);
    const idx = RANK_ORDER.indexOf(nr);
    return idx >= 0 ? idx : -1;
}

// ── MODULE INSTANCE STATE ──
let _root = null;
let _body = null;
let _allChars = [];
let _lmcaChars = [];
let _studentChars = [];
let _facultyChars = [];
let _currentFilter = 'all';
let _searchQuery = '';
let _wizardTarget = null;
let _activeWizard = null;

// ── TIER HELPERS (for inline wizard and navigate) ──
const TIER_COLOR = {
    Dormant:"#5e7a96", F:"#7bb4cc", E:"#55d490", D:"#4fa8ff",
    C:"#b650ff", B:"#e3ab2b", A:"#ff4a2b", S:"#ff1a1a",
    SS:"#ff1ad9", SSS:"#ff0044"
};
function getTier(r) {
    const nr = normalizeRank(r);
    for (let i = RANK_ORDER.length - 1; i >= 0; i--) {
        if (nr === RANK_ORDER[i]) return RANK_ORDER[i].replace(/[\u2212+].*$/, '') || 'Dormant';
    }
    return 'Dormant';
}

// ── DATA FETCH ──
function _fetchCharacters() {
    const pages = _deps.dv.pages('"character"').map(p => ({
        page: p,
        filePath: p.file.path,
        name: p.name || p.file.name,
        rank: p.rank || 'Dormant',
        gender: p.gender || '\u2014',
        reach: p.core_reach || '',
        // LMCA fields
        lmcaRole: p.lmca_role || null,
        lmcaTrack: p.lmca_track || null,
        lmcaCohort: typeof p.lmca_cohort === 'number' ? p.lmca_cohort : null,
        lmcaStripes: typeof p.lmca_stripes === 'number' ? p.lmca_stripes : null,
        lmcaDept: p.lmca_dept || null,
        lmcaPosition: p.lmca_position || null,
        lmcaCoreRank: p.lmca_core_rank || null,
        lmcaAP: typeof p.lmca_ap === 'number' ? p.lmca_ap : null,
        lmcaRankPos: typeof p.lmca_rank_position === 'number' ? p.lmca_rank_position : null,
        lmcaFlags: Array.isArray(p.lmca_flags) ? p.lmca_flags : (p.lmca_flags ? [p.lmca_flags] : []),
        tags: Array.isArray(p.tags) ? p.tags : (p.tags ? [p.tags] : []),
    }));

    _allChars = pages;

    // Characters with LMCA tag or any lmca_ frontmatter field
    _lmcaChars = pages.filter(c =>
        c.tags.some(t => String(t).toLowerCase().includes('lmca')) ||
        c.lmcaRole !== null || c.lmcaDept !== null || c.lmcaTrack !== null
    );

    _studentChars = _lmcaChars.filter(c => c.lmcaRole === 'student');
    _facultyChars = _lmcaChars.filter(c => c.lmcaRole === 'faculty' || c.lmcaRole === 'staff');
}

// ═══════════════════════════════════════════════════════════
// UI BUILDERS
// ═══════════════════════════════════════════════════════════

function _buildRegistryPanel() {
    const panel = document.createElement('div');
    panel.className = 'lm-panel active';
    panel.dataset.panel = 'registry';

    // ── Controls row ──
    const regControls = document.createElement('div');
    regControls.className = 'lm-reg-grid';

    const regSearch = document.createElement('input');
    regSearch.className = 'lm-input';
    regSearch.placeholder = '\u2315 Search subjects...';
    let _regDebounce;
    regSearch.addEventListener('input', () => {
        clearTimeout(_regDebounce);
        _regDebounce = setTimeout(() => {
            _searchQuery = regSearch.value;
            _renderRegList();
        }, 150);
    });
    regControls.appendChild(regSearch);

    const regFilterDd = _deps.makeDropdown('lm-reg-filter', [
        { value: 'all',          label: 'All Characters' },
        { value: 'lmca-all',     label: 'All LMCA Subjects' },
        { value: 'unregistered', label: 'Unregistered' },
        { value: 'student',      label: 'Students' },
        { value: 'faculty',      label: 'Faculty & Staff' },
    ], 'all', (v) => { _currentFilter = v; _renderRegList(); });
    regControls.appendChild(regFilterDd);
    panel.appendChild(regControls);

    const regCount = document.createElement('div');
    regCount.className = 'lm-section-title';
    regCount.id = 'lm-reg-count';
    panel.appendChild(regCount);

    const charListEl = document.createElement('div');
    charListEl.className = 'lm-char-list';
    charListEl.id = 'lm-char-list';
    panel.appendChild(charListEl);

    return panel;
}

function _getFilterChars() {
    let source = _currentFilter === 'all' ? _allChars : _lmcaChars;
    const q = _searchQuery.toLowerCase();

    return source.filter(c => {
        if (q && !c.name.toLowerCase().includes(q)) return false;

        switch (_currentFilter) {
            case 'lmca-all':
                return c.tags.some(t => String(t).toLowerCase().includes('lmca')) ||
                       c.lmcaRole !== null || c.lmcaDept !== null || c.lmcaTrack !== null;
            case 'unregistered':
                // In "all" mode: characters NOT in lmcaChars (no LMCA tag/fields)
                // In lmca mode: characters in lmcaChars with no role
                if (source === _allChars) {
                    const hasLMCA = _lmcaChars.some(lc => lc.filePath === c.filePath);
                    return !hasLMCA;
                }
                return c.lmcaRole === null;
            case 'student':
                return c.lmcaRole === 'student';
            case 'faculty':
                return c.lmcaRole === 'faculty' || c.lmcaRole === 'staff';
            default: // 'all'
                return true;
        }
    }).sort((a, b) => {
        // Sort: registered first, then by name
        const aReg = a.lmcaRole !== null ? 1 : 0;
        const bReg = b.lmcaRole !== null ? 1 : 0;
        if (aReg !== bReg) return bReg - aReg;
        return a.name.localeCompare(b.name);
    });
}

function _renderRegList() {
    const charListEl = _root.querySelector('#lm-char-list');
    const regCount = _root.querySelector('#lm-reg-count');
    if (!charListEl) return;

    charListEl.innerHTML = '';
    const chars = _getFilterChars();

    // Update count
    const regCount_val = _lmcaChars.filter(c => c.lmcaRole !== null).length;
    const unregCount = chars.filter(c => {
        const hasLMCA = _lmcaChars.some(lc => lc.filePath === c.filePath);
        return !hasLMCA || c.lmcaRole === null;
    }).length;
    regCount.innerHTML = `// ${(_currentFilter === 'all' ? 'ALL' : 'LMCA')} SUBJECTS <span>${chars.length}</span> \u2014 REGISTERED <span>${regCount_val}</span> \u2014 UNREGISTERED <span style="color:${unregCount > 0 ? '#a08030' : '#3a9960'}">${unregCount}</span>`;

    if (chars.length === 0) {
        charListEl.innerHTML = `<div class="lm-empty">[ NO SUBJECTS FOUND ]</div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    chars.forEach(c => {
        const inLMCA = _lmcaChars.some(lc => lc.filePath === c.filePath);
        const isReg = c.lmcaRole !== null;
        const item = document.createElement('div');
        item.className = `lm-char-item ${isReg ? 'registered' : (inLMCA ? 'unregistered' : 'unregistered')}`;

        let metaStr = '\u2014';
        if (isReg) {
            if (c.lmcaRole === 'student') {
                const track = TRACK_DATA.find(t => t.id === c.lmcaTrack);
                metaStr = [
                    track ? track.name : 'No Track',
                    c.lmcaCohort ? `${c.lmcaCohort}${['st','nd','rd','th','th','th'][(c.lmcaCohort||1)-1]} Cohort` : null,
                    c.lmcaStripes !== null ? `${c.lmcaStripes} Stripe${c.lmcaStripes !== 1 ? 's' : ''}` : null,
                ].filter(Boolean).join(' \u00b7 ');
            } else {
                const dept = DEPT_DATA.find(d => d.id === c.lmcaDept);
                metaStr = [
                    c.lmcaRole.toUpperCase(),
                    dept ? dept.name : c.lmcaDept || null,
                    c.lmcaPosition || null,
                ].filter(Boolean).join(' \u00b7 ');
            }
        } else if (inLMCA) {
            metaStr = 'LMCA TAGGED \u2014 NOT REGISTERED';
        } else {
            metaStr = `${c.rank} \u00b7 ${c.gender}`;
        }

        let badges = '';
        if (isReg) {
            badges += `<div class="lm-char-status-badge registered">${c.lmcaRole.toUpperCase()}</div>`;
        } else {
            badges += `<div class="lm-char-status-badge unregistered">UNREGISTERED</div>`;
        }
        if (c.lmcaFlags.includes('named')) {
            badges += '<div class="lm-char-status-badge registered" style="margin-top:4px;">NAMED</div>';
        }
        if (c.lmcaFlags.includes('watchlist')) {
            badges += '<div class="lm-char-status-badge unregistered" style="margin-top:4px;">WATCHLIST</div>';
        }

        item.innerHTML = `
            <div>
                <div class="lm-char-name">${c.name}</div>
                <div class="lm-char-meta">${metaStr}</div>
            </div>
            <div>${badges}</div>
        `;

        // Name click → navigate to Overseer
        const nameEl = item.querySelector('.lm-char-name');
        if (nameEl) {
            nameEl.style.cursor = 'pointer';
            nameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.ovOpenSubject) window.ovOpenSubject(c.filePath);
            });
        }

        // Edit button (pencil icon) → inline wizard
        const editBtn = document.createElement('div');
        editBtn.style.cssText = 'width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:3px;font-size:0.75em;color:#5e7a96;border:1px solid #1e2535;background:#0f1420;flex-shrink:0;margin-top:2px;';
        editBtn.innerHTML = '&#9998;';
        editBtn.title = 'Edit classification';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            _root.querySelectorAll('.lm-char-item').forEach(i => i.style.background = '');
            item.style.background = '#141c2e';
            _openInlineWizard(c, item, () => _renderRegList());
        });
        item.querySelector('div:last-child').appendChild(editBtn);

        frag.appendChild(item);
    });
    charListEl.appendChild(frag);
}

// ── INLINE WIZARD ──

function _openInlineWizard(charData, anchorEl, onComplete) {
    if (_activeWizard) { _activeWizard.remove(); _activeWizard = null; }

    const isReg = charData.lmcaRole !== null;
    const role = charData.lmcaRole || 'student';

    const wiz = document.createElement('div');
    wiz.className = 'lm-wizard';
    wiz.style.cssText = 'margin:4px 0;border-radius:4px;overflow:hidden;width:400px;box-sizing:border-box;';
    _activeWizard = wiz;

    wiz.innerHTML = `
        <div class="lm-wizard-header" style="display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div class="lm-wizard-title">// Classification Wizard</div>
                <div class="lm-wizard-subject">${charData.name.toUpperCase()}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
                <span style="font-family:'Share Tech Mono',monospace;font-size:0.65em;color:#3a4e64;letter-spacing:1px;">${isReg ? '[ EDIT RECORD ]' : '[ NEW REGISTRATION ]'}</span>
                <span id="wiz-close-btn" style="font-size:1.2em;color:#5e7a96;cursor:pointer;line-height:1;">&times;</span>
            </div>
        </div>
        <div class="lm-wizard-body" id="wizard-body"></div>
        <div class="lm-wizard-actions">
            <button class="lm-btn accent" id="wiz-save">COMMIT RECORD</button>
            ${isReg ? '<button class="lm-btn danger" id="wiz-clear">CLEAR CLASSIFICATION</button>' : ''}
            <button class="lm-btn" id="wiz-cancel">CANCEL</button>
        </div>
        <div id="wiz-msg"></div>
    `;

    anchorEl.parentNode.insertBefore(wiz, anchorEl.nextSibling);

    _renderWizardBody(role, charData, wiz);

    wiz.querySelector('#wiz-close-btn').addEventListener('click', () => { wiz.remove(); _activeWizard = null; });
    wiz.querySelector('#wiz-cancel').addEventListener('click', () => { wiz.remove(); _activeWizard = null; });
    wiz.querySelector('#wiz-save').addEventListener('click', () => _commitRecord(charData, wiz, onComplete));
    const clearBtn = wiz.querySelector('#wiz-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => _clearRecord(charData, wiz, onComplete));

    wiz.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _renderWizardBody(role, charData, wiz) {
    const body = wiz ? wiz.querySelector('#wizard-body') : _root.querySelector('#wizard-body');
    if (!body) return;

    const roleDd = _deps.makeDropdown('wiz-role-dd', [
        { value: 'student', label: 'Student' },
        { value: 'faculty', label: 'Faculty' },
        { value: 'staff',   label: 'Staff' },
    ], role || 'student', (v) => {
        _renderWizardBody(v, charData, wiz);
    });

    body.innerHTML = '';

    const roleField = document.createElement('div');
    roleField.className = 'lm-wizard-field';
    const roleLabel = document.createElement('span');
    roleLabel.className = 'lm-wizard-label';
    roleLabel.textContent = 'Role';
    roleField.appendChild(roleLabel);
    roleField.appendChild(roleDd);
    body.appendChild(roleField);

    if (role === 'student') {
        const trackField = document.createElement('div');
        trackField.className = 'lm-wizard-field';
        const trackLabel = document.createElement('span');
        trackLabel.className = 'lm-wizard-label';
        trackLabel.textContent = 'Track';
        const trackDd = _deps.makeDropdown('wiz-track-dd', [
            { value: '', label: '\u2014 Select Track \u2014' },
            ...TRACK_DATA.map(t => ({ value: t.id, label: t.name, color: t.trim })),
        ], charData.lmcaTrack || '', null);
        trackField.appendChild(trackLabel);
        trackField.appendChild(trackDd);
        body.appendChild(trackField);

        const cohortField = document.createElement('div');
        cohortField.className = 'lm-wizard-field';
        const cohortLabel = document.createElement('span');
        cohortLabel.className = 'lm-wizard-label';
        cohortLabel.textContent = 'Cohort (Year)';
        const cohortDd = _deps.makeDropdown('wiz-cohort-dd', [
            { value: '', label: '\u2014 Select Cohort \u2014' },
            ...[1,2,3,4,5,6].map(n => ({ value: String(n), label: `${n}${['st','nd','rd','th','th','th'][n-1]} Cohort` })),
        ], charData.lmcaCohort ? String(charData.lmcaCohort) : '', null);
        cohortField.appendChild(cohortLabel);
        cohortField.appendChild(cohortDd);
        body.appendChild(cohortField);

        const stripesField = document.createElement('div');
        stripesField.className = 'lm-wizard-field';
        const stripesLabel = document.createElement('span');
        stripesLabel.className = 'lm-wizard-label';
        stripesLabel.textContent = 'Stripes';
        const stripesDd = _deps.makeDropdown('wiz-stripes-dd', [
            { value: '', label: '\u2014 Select Stripes \u2014' },
            ...[0,1,2,3,4,5].map(n => ({ value: String(n), label: `${n} Stripe${n!==1?'s':''} \u2014 ${STRIPE_LABELS[n] || ''}` })),
        ], charData.lmcaStripes !== null ? String(charData.lmcaStripes) : '', null);
        stripesField.appendChild(stripesLabel);
        stripesField.appendChild(stripesDd);
        body.appendChild(stripesField);

        const apField = document.createElement('div');
        apField.className = 'lm-wizard-field';
        const apLabel = document.createElement('span');
        apLabel.className = 'lm-wizard-label';
        apLabel.textContent = 'Academy Points (AP)';
        const apInput = document.createElement('input');
        apInput.className = 'lm-input';
        apInput.id = 'wiz-ap-input';
        apInput.type = 'number';
        apInput.placeholder = '100';
        apInput.value = charData.lmcaAP !== null ? charData.lmcaAP : '';
        apField.appendChild(apLabel);
        apField.appendChild(apInput);
        body.appendChild(apField);

        const rankPosField = document.createElement('div');
        rankPosField.className = 'lm-wizard-field';
        const rankPosLabel = document.createElement('span');
        rankPosLabel.className = 'lm-wizard-label';
        rankPosLabel.textContent = 'Ranking Board Position (leave blank if unranked)';
        const rankPosInput = document.createElement('input');
        rankPosInput.className = 'lm-input';
        rankPosInput.id = 'wiz-rankpos-input';
        rankPosInput.type = 'number';
        rankPosInput.placeholder = '1\u2013200';
        rankPosInput.min = '1';
        rankPosInput.max = '200';
        rankPosInput.value = charData.lmcaRankPos !== null ? charData.lmcaRankPos : '';
        rankPosField.appendChild(rankPosLabel);
        rankPosField.appendChild(rankPosInput);
        body.appendChild(rankPosField);

    } else {
        const deptField = document.createElement('div');
        deptField.className = 'lm-wizard-field';
        const deptLabel = document.createElement('span');
        deptLabel.className = 'lm-wizard-label';
        deptLabel.textContent = 'Department';
        const deptDd = _deps.makeDropdown('wiz-dept-dd', [
            { value: '', label: '\u2014 Select Department \u2014' },
            ...DEPT_DATA.map(d => ({ value: d.id, label: `Dept ${d.num} \u2014 ${d.name}`, color: d.color })),
        ], charData.lmcaDept || '', null);
        deptField.appendChild(deptLabel);
        deptField.appendChild(deptDd);
        body.appendChild(deptField);

        const posField = document.createElement('div');
        posField.className = 'lm-wizard-field';
        const posLabel = document.createElement('span');
        posLabel.className = 'lm-wizard-label';
        posLabel.textContent = 'Position / Title';
        const posInput = document.createElement('input');
        posInput.className = 'lm-input';
        posInput.id = 'wiz-pos-input';
        posInput.type = 'text';
        posInput.placeholder = 'e.g. Senior Instructor, Deputy Director...';
        posInput.value = charData.lmcaPosition || '';
        posField.appendChild(posLabel);
        posField.appendChild(posInput);
        body.appendChild(posField);

        const rankField = document.createElement('div');
        rankField.className = 'lm-wizard-field';
        const rankLabel = document.createElement('span');
        rankLabel.className = 'lm-wizard-label';
        rankLabel.textContent = 'Core Rank (institutional role rank)';
        const rankInput = document.createElement('input');
        rankInput.className = 'lm-input';
        rankInput.id = 'wiz-corerank-input';
        rankInput.type = 'text';
        rankInput.placeholder = 'e.g. B-rank, Dormant, C-rank...';
        rankInput.value = charData.lmcaCoreRank || '';
        rankField.appendChild(rankLabel);
        rankField.appendChild(rankInput);
        body.appendChild(rankField);
    }

    const flagsField = document.createElement('div');
    flagsField.className = 'lm-wizard-field';
    const flagsLabel = document.createElement('span');
    flagsLabel.className = 'lm-wizard-label';
    flagsLabel.textContent = 'Flags (comma-separated: named, watchlist, key, flagged)';
    const flagsInput = document.createElement('input');
    flagsInput.className = 'lm-input';
    flagsInput.id = 'wiz-flags-input';
    flagsInput.type = 'text';
    flagsInput.placeholder = 'e.g. named, watchlist';
    flagsInput.value = (charData.lmcaFlags || []).join(', ');
    flagsField.appendChild(flagsLabel);
    flagsField.appendChild(flagsInput);
    body.appendChild(flagsField);
}

async function _commitRecord(charData, wiz, onComplete) {
    const wizEl = wiz || _root.querySelector('#lm-wizard');
    if (!wizEl) return;
    const saveBtn = wizEl.querySelector('#wiz-save');
    const msgEl = wizEl.querySelector('#wiz-msg');
    saveBtn.textContent = 'COMMITTING...';
    saveBtn.disabled = true;

    const roleDd = wizEl.querySelector('#wiz-role-dd');
    const role = roleDd ? roleDd.value : 'student';

    try {
        const fileObj = _deps.app.vault.getAbstractFileByPath(charData.filePath);
        await _deps.app.fileManager.processFrontMatter(fileObj, fm => {
            fm.lmca_role = role;

            if (role === 'student') {
                const trackDd   = wizEl.querySelector('#wiz-track-dd');
                const cohortDd  = wizEl.querySelector('#wiz-cohort-dd');
                const stripesDd = wizEl.querySelector('#wiz-stripes-dd');
                const apInp     = wizEl.querySelector('#wiz-ap-input');
                const rpInp     = wizEl.querySelector('#wiz-rankpos-input');

                if (trackDd && trackDd.value)    fm.lmca_track = trackDd.value;
                else delete fm.lmca_track;
                if (cohortDd && cohortDd.value)  fm.lmca_cohort = parseInt(cohortDd.value);
                else delete fm.lmca_cohort;
                if (stripesDd && stripesDd.value !== '') fm.lmca_stripes = parseInt(stripesDd.value);
                else delete fm.lmca_stripes;
                if (apInp && apInp.value !== '') fm.lmca_ap = parseInt(apInp.value);
                else delete fm.lmca_ap;
                if (rpInp && rpInp.value !== '') fm.lmca_rank_position = parseInt(rpInp.value);
                else fm.lmca_rank_position = null;

                delete fm.lmca_dept;
                delete fm.lmca_position;
                delete fm.lmca_core_rank;
            } else {
                const deptDd = wizEl.querySelector('#wiz-dept-dd');
                const posInp = wizEl.querySelector('#wiz-pos-input');
                const crInp  = wizEl.querySelector('#wiz-corerank-input');

                if (deptDd && deptDd.value)  fm.lmca_dept = deptDd.value;
                else delete fm.lmca_dept;
                if (posInp && posInp.value)  fm.lmca_position = posInp.value.trim();
                else delete fm.lmca_position;
                if (crInp  && crInp.value)   fm.lmca_core_rank = crInp.value.trim();
                else delete fm.lmca_core_rank;

                delete fm.lmca_track;
                delete fm.lmca_cohort;
                delete fm.lmca_stripes;
                delete fm.lmca_rank_position;
            }

            const flagsInp = wizEl.querySelector('#wiz-flags-input');
            if (flagsInp) {
                const flags = flagsInp.value.split(',').map(f => f.trim()).filter(Boolean);
                fm.lmca_flags = flags.length > 0 ? flags : [];
            }
        });

        msgEl.innerHTML = `<div class="lm-wizard-msg success">// RECORD COMMITTED \u2014 ${charData.name.toUpperCase()}</div>`;
        saveBtn.textContent = '\u2714 COMMITTED';
        _fetchCharacters();
        if (onComplete) onComplete();
        setTimeout(() => { wizEl.remove(); _activeWizard = null; }, 1200);

    } catch (e) {
        msgEl.innerHTML = `<div class="lm-wizard-msg error">// ERROR: ${e.message}</div>`;
        saveBtn.textContent = 'COMMIT RECORD';
        saveBtn.disabled = false;
    }
}

async function _clearRecord(charData, wiz, onComplete) {
    const wizEl = wiz || _root.querySelector('#lm-wizard');
    if (!wizEl) return;
    const msgEl = wizEl.querySelector('#wiz-msg');
    try {
        const fileObj = _deps.app.vault.getAbstractFileByPath(charData.filePath);
        await _deps.app.fileManager.processFrontMatter(fileObj, fm => {
            delete fm.lmca_role;
            delete fm.lmca_track;
            delete fm.lmca_cohort;
            delete fm.lmca_stripes;
            delete fm.lmca_ap;
            delete fm.lmca_rank_position;
            delete fm.lmca_dept;
            delete fm.lmca_position;
            delete fm.lmca_core_rank;
            delete fm.lmca_flags;
        });
        msgEl.innerHTML = `<div class="lm-wizard-msg success">// CLASSIFICATION CLEARED</div>`;
        _fetchCharacters();
        if (onComplete) onComplete();
        setTimeout(() => { wizEl.remove(); _activeWizard = null; }, 1000);
    } catch (e) {
        msgEl.innerHTML = `<div class="lm-wizard-msg error">// ERROR: ${e.message}</div>`;
    }
}

// ═══════════════════════════════════════════════════════════
// TRACKS PANEL
// ═══════════════════════════════════════════════════════════

function _buildTracksPanel() {
    const panel = document.createElement('div');
    panel.className = 'lm-panel';
    panel.dataset.panel = 'tracks';

    // ── Sub-tab bar: OVERVIEW tab + one tab per track ──
    const subBar = document.createElement('div');
    subBar.style.cssText = 'display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:10px 0 6px;border-bottom:1px solid #1e2535;margin-bottom:12px;';

    // Content area below the sub-bar
    const contentArea = document.createElement('div');

    // ── OVERVIEW tab (shows all cards) ──
    const overviewTab = document.createElement('div');
    overviewTab.className = 'lm-dept-subtab active';
    overviewTab.textContent = 'OVERVIEW';
    overviewTab.style.cssText = 'font-size:0.68em;padding:5px 10px;white-space:nowrap;flex-shrink:0;cursor:pointer;';
    subBar.appendChild(overviewTab);

    // ── One tab per track ──
    const trackTabs = [];
    TRACK_DATA.forEach((track, i) => {
        const t = document.createElement('div');
        t.className = 'lm-dept-subtab';
        t.textContent = track.nickname;
        t.style.cssText = `font-size:0.68em;padding:5px 10px;white-space:nowrap;flex-shrink:0;cursor:pointer;color:${track.trim};`;
        t.dataset.trackId = track.id;
        trackTabs.push(t);
        subBar.appendChild(t);
    });

    // ── Card grid (OVERVIEW view) ──
    const trackCardsGrid = document.createElement('div');
    trackCardsGrid.className = 'lm-track-cards';

    TRACK_DATA.forEach((track, i) => {
        const studentsInTrack = _studentChars.filter(c => c.lmcaTrack === track.id);
        const card = document.createElement('div');
        card.className = 'lm-track-card';
        card.style.setProperty('--lm-track-color', track.trim);

        card.innerHTML = `
            <div class="lm-track-card-header">
                <div class="lm-track-card-name">${track.name}</div>
                <div class="lm-track-card-nick">// "${track.nickname}" ${track.formerly ? `\u00b7 formerly: ${track.formerly}` : ''}</div>
            </div>
            <div class="lm-track-card-body">${track.desc}</div>
            <div class="lm-track-card-meta">
                <div class="lm-track-card-row">PATCH SYMBOL: <span>${track.symbol}</span></div>
                <div class="lm-track-card-row">HOUSING: <span>${track.housing}</span></div>
                <div class="lm-track-card-row">DUNGEON ACCESS: <span>${track.dungeons}</span></div>
                <div>
                    <div class="lm-track-count-badge" style="--lm-track-color:${track.trim}">
                        ${studentsInTrack.length} STUDENT${studentsInTrack.length !== 1 ? 'S' : ''} INDEXED
                    </div>
                </div>
            </div>
        `;

        // Clicking a card switches to that track's tab
        card.addEventListener('click', () => {
            switchToTrack(track.id);
        });

        trackCardsGrid.appendChild(card);
    });

    // ── Student list area (track detail view) ──
    const studentArea = document.createElement('div');
    studentArea.style.display = 'none';

    // ── Switch functions ──
    function switchToOverview() {
        overviewTab.classList.add('active');
        trackTabs.forEach(t => t.classList.remove('active'));
        trackCardsGrid.style.display = '';
        studentArea.style.display = 'none';
        contentArea.innerHTML = '';
        contentArea.appendChild(trackCardsGrid);
        contentArea.appendChild(studentArea);
    }

    function switchToTrack(trackId) {
        const track = TRACK_DATA.find(t => t.id === trackId);
        if (!track) return;

        overviewTab.classList.remove('active');
        trackTabs.forEach(t => {
            t.classList.toggle('active', t.dataset.trackId === trackId);
        });

        trackCardsGrid.style.display = 'none';
        studentArea.style.display = '';

        _renderTrackStudents(track, studentArea);
        studentArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Tab bar click events
    overviewTab.addEventListener('click', switchToOverview);
    trackTabs.forEach(t => {
        t.addEventListener('click', () => switchToTrack(t.dataset.trackId));
    });

    // Initial state: overview
    contentArea.appendChild(trackCardsGrid);
    contentArea.appendChild(studentArea);

    panel.appendChild(subBar);
    panel.appendChild(contentArea);
    return panel;
}

function _renderTrackStudents(track, container) {
    container.innerHTML = '';

    const students = _studentChars.filter(c => c.lmcaTrack === track.id);

    // Header
    const hd = document.createElement('div');
    hd.className = 'lm-section-title';
    hd.innerHTML = `// ${track.name.toUpperCase()} <span>${students.length} STUDENTS</span>`;
    container.appendChild(hd);

    // Cohort sub-tabs
    const cohortsPresent = [...new Set(students.map(s => s.lmcaCohort).filter(Boolean))].sort((a, b) => a - b);
    const subTabBar = document.createElement('div');
    subTabBar.className = 'lm-dept-subtabs';
    subTabBar.style.borderColor = track.trim + '40';

    const allTab = document.createElement('div');
    allTab.className = 'lm-dept-subtab active';
    allTab.textContent = 'ALL';
    allTab.style.setProperty('--lm-tab-color', track.trim);
    subTabBar.appendChild(allTab);

    cohortsPresent.forEach(c => {
        const t = document.createElement('div');
        t.className = 'lm-dept-subtab';
        t.textContent = `${c}${['ST','ND','RD','TH','TH','TH'][c-1]} COHORT`;
        t.dataset.cohort = c;
        subTabBar.appendChild(t);
    });
    container.appendChild(subTabBar);

    const studentListEl = document.createElement('div');
    studentListEl.style.padding = '16px';

    function renderStudents(cohortFilter) {
        studentListEl.innerHTML = '';
        const filtered = cohortFilter
            ? students.filter(s => String(s.lmcaCohort) === String(cohortFilter))
            : students;

        if (filtered.length === 0) {
            studentListEl.innerHTML = `<div class="lm-empty">[ NO STUDENTS IN THIS COHORT ]</div>`;
            return;
        }

        filtered.sort((a, b) => {
            if (a.lmcaStripes !== null && b.lmcaStripes !== null) return b.lmcaStripes - a.lmcaStripes;
            return a.name.localeCompare(b.name);
        });

        filtered.forEach(s => {
            const stripes = s.lmcaStripes !== null ? s.lmcaStripes : 0;
            const stripeHTML = Array.from({length: 5}, (_, i) =>
                `<div class="lm-stripe ${i < stripes ? 'filled' : ''}" style="--lm-stripe-color:${track.trim}"></div>`
            ).join('');

            const item = document.createElement('div');
            item.className = 'lm-student-item';
            item.style.cursor = 'pointer';
            item.innerHTML = `
                <div>
                    <div class="lm-student-name">${s.name}</div>
                    <div class="lm-student-meta-row">
                        ${s.lmcaCohort ? `<span class="lm-cohort-badge">COHORT ${s.lmcaCohort}</span>` : ''}
                        ${s.lmcaAP !== null ? `<span class="lm-cohort-badge" style="color:#a08030;border-color:#4a3a14">${_deps.fmtNum(s.lmcaAP)} AP</span>` : ''}
                        ${s.lmcaRankPos ? `<span class="lm-cohort-badge" style="color:#4a6fa5;border-color:#1e3050">RANK #${s.lmcaRankPos}</span>` : ''}
                        ${s.lmcaFlags.includes('named') ? `<span class="lm-cohort-badge" style="color:#3a9960;border-color:#1e4a2e">NAMED</span>` : ''}
                        ${s.lmcaFlags.includes('watchlist') ? `<span class="lm-cohort-badge" style="color:#c03030;border-color:#4a1e1e">WATCHLIST</span>` : ''}
                    </div>
                </div>
                <div>
                    <div class="lm-stripes" title="${stripes} stripe${stripes!==1?'s':''} \u2014 ${STRIPE_LABELS[stripes]}">${stripeHTML}</div>
                </div>
            `;

            // Click name → Overseer navigate; click pencil → wizard
            const nameEl = item.querySelector('.lm-student-name');
            nameEl.style.cursor = 'pointer';
            nameEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.ovOpenSubject) window.ovOpenSubject(s.filePath);
            });

            const editBtn = document.createElement('div');
            editBtn.style.cssText = 'width:20px;height:20px;display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:3px;font-size:0.7em;color:#5e7a96;border:1px solid #1e2535;background:#0f1420;flex-shrink:0;margin-top:4px;';
            editBtn.innerHTML = '&#9998;';
            editBtn.title = 'Edit classification';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _openInlineWizard(s, item, () => _renderTrackStudents(track, container));
            });
            item.querySelector('div:last-child').appendChild(editBtn);

            studentListEl.appendChild(item);
        });
    }

    renderStudents(null);
    container.appendChild(studentListEl);

    subTabBar.addEventListener('click', e => {
        const tab = e.target.closest('.lm-dept-subtab');
        if (!tab) return;
        subTabBar.querySelectorAll('.lm-dept-subtab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderStudents(tab.dataset.cohort || null);
    });
}

// ═══════════════════════════════════════════════════════════
// DEPARTMENTS PANEL
// ═══════════════════════════════════════════════════════════

function _buildDeptsPanel() {
    const panel = document.createElement('div');
    panel.className = 'lm-panel';
    panel.dataset.panel = 'departments';

    // ── Mode toggle: ALL vs TABS ──
    const modeBar = document.createElement('div');
    modeBar.style.cssText = 'display:flex;gap:4px;padding:8px 0 6px;border-bottom:1px solid #1e2535;margin-bottom:10px;';

    const allModeBtn = document.createElement('div');
    allModeBtn.className = 'lm-dept-type-tab active';
    allModeBtn.textContent = 'All';
    allModeBtn.dataset.mode = 'all';

    const tabsModeBtn = document.createElement('div');
    tabsModeBtn.className = 'lm-dept-type-tab';
    tabsModeBtn.textContent = 'Tabs';
    tabsModeBtn.dataset.mode = 'tabs';

    modeBar.appendChild(allModeBtn);
    modeBar.appendChild(tabsModeBtn);
    panel.appendChild(modeBar);

    // ── Content area ──
    const contentArea = document.createElement('div');
    panel.appendChild(contentArea);

    let currentMode = 'all';

    function renderMode(mode) {
        currentMode = mode;
        allModeBtn.classList.toggle('active', mode === 'all');
        tabsModeBtn.classList.toggle('active', mode === 'tabs');
        contentArea.innerHTML = '';

        if (mode === 'all') {
            // Original accordion list
            const deptListEl = document.createElement('div');
            deptListEl.className = 'lm-dept-list';
            _renderDeptList(deptListEl, 'all');
            contentArea.appendChild(deptListEl);
        } else {
            // TABS mode: two groups with scrollable pill rows
            _renderDeptTabsMode(contentArea);
        }
    }

    modeBar.addEventListener('click', e => {
        const btn = e.target.closest('.lm-dept-type-tab');
        if (!btn) return;
        renderMode(btn.dataset.mode);
    });

    renderMode('all');
    return panel;
}

function _renderDeptTabsMode(container) {
    container.innerHTML = '';

    const primaryDepts    = DEPT_DATA.filter(d => d.type === 'primary');
    const subsidiaryDepts = DEPT_DATA.filter(d => d.type === 'subsidiary');

    const detailArea = document.createElement('div');
    detailArea.style.marginTop = '12px';

    let activePill = null;

    function showDeptDetail(dept) {
        detailArea.innerHTML = '';
        const faculty = _facultyChars.filter(c => c.lmcaDept === dept.id);

        // Header
        const hd = document.createElement('div');
        hd.className = 'lm-section-title';
        hd.innerHTML = `// DEPT ${String(dept.num).padStart(2,'0')} \u2014 <span style="color:${dept.color}">${dept.name}</span>`;
        detailArea.appendChild(hd);

        // Sub-nav: Overview | Positions | Personnel
        const subTabs = document.createElement('div');
        subTabs.className = 'lm-dept-subtabs';
        ['OVERVIEW', 'POSITIONS', 'PERSONNEL'].forEach((label, i) => {
            const t = document.createElement('div');
            t.className = 'lm-dept-subtab' + (i === 0 ? ' active' : '');
            t.textContent = label;
            t.dataset.sub = label.toLowerCase();
            subTabs.appendChild(t);
        });
        detailArea.appendChild(subTabs);

        // Overview panel
        const ovPanel = document.createElement('div');
        ovPanel.className = 'lm-dept-subpanel active';
        ovPanel.dataset.subpanel = 'overview';
        ovPanel.innerHTML = `
            <div class="lm-motto">"${dept.motto}"</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.82em;">
                <div>
                    <div class="lm-wizard-label">Department Head</div>
                    <div style="color:#c8d8f0;font-family:'Barlow Condensed',sans-serif;font-size:1.05em;letter-spacing:1px;">${dept.head}</div>
                    <div style="font-family:'Share Tech Mono',monospace;font-size:0.65em;color:#5e7a96;margin-top:2px;">${dept.headRank}</div>
                </div>
                <div>
                    <div class="lm-wizard-label">Title</div>
                    <div style="color:#8ba8c8;font-size:0.88em;">${dept.headTitle}</div>
                </div>
                <div>
                    <div class="lm-wizard-label">Classification</div>
                    <div style="color:#5e7a96;font-family:'Share Tech Mono',monospace;font-size:0.65em;letter-spacing:1px;text-transform:uppercase;">${dept.type}</div>
                </div>
                <div>
                    <div class="lm-wizard-label">Indexed Personnel</div>
                    <div style="color:${faculty.length > 0 ? '#3a9960' : '#5e3a2e'};font-family:'Share Tech Mono',monospace;font-size:0.65em;letter-spacing:1px;">${faculty.length} INDEXED</div>
                </div>
            </div>
        `;
        detailArea.appendChild(ovPanel);

        // Positions panel
        const posPanel = document.createElement('div');
        posPanel.className = 'lm-dept-subpanel';
        posPanel.dataset.subpanel = 'positions';
        const posListEl = document.createElement('div');
        posListEl.className = 'lm-position-list';

        dept.positions.forEach(pos => {
            const holder = faculty.find(c =>
                c.lmcaPosition && c.lmcaPosition.toLowerCase().includes(pos.title.split('\u2014').pop().trim().toLowerCase().substring(0, 15))
            );
            const isOccupied = !!pos.current || !!holder;

            const posItem = document.createElement('div');
            posItem.className = `lm-position-item level-${pos.level}`;

            const posLeft = document.createElement('div');
            posLeft.innerHTML = `
                <div class="lm-position-title">${pos.title}</div>
                <div class="lm-position-current">
                    ${pos.current ? `// ${pos.current}` : holder ? `// ${holder.name} (indexed)` : '// VACANT'}
                </div>
            `;
            posItem.appendChild(posLeft);

            const posRight = document.createElement('div');
            posRight.className = `lm-position-rank ${isOccupied ? 'lm-position-occupied' : 'lm-position-vacant'}`;

            if (!isOccupied) {
                // Clickable VACANT → position picker
                posRight.style.cursor = 'pointer';
                posRight.innerHTML = `${pos.rank}<br><span style="font-size:0.85em;opacity:0.7">\u25a1 VACANT \u25b6</span>`;
                posRight.addEventListener('click', () => {
                    _showPositionPicker(posRight, dept, pos, () => showDeptDetail(dept));
                });
            } else {
                posRight.innerHTML = `${pos.rank}<br><span style="font-size:0.85em;opacity:0.7">\u25a0 FILLED</span>`;
            }

            posItem.appendChild(posRight);
            posListEl.appendChild(posItem);
        });
        posPanel.appendChild(posListEl);
        detailArea.appendChild(posPanel);

        // Personnel panel
        const perPanel = document.createElement('div');
        perPanel.className = 'lm-dept-subpanel';
        perPanel.dataset.subpanel = 'personnel';

        if (faculty.length === 0) {
            perPanel.innerHTML = `<div class="lm-empty">[ NO PERSONNEL INDEXED FOR THIS DEPARTMENT ]</div>`;
        } else {
            faculty.forEach(c => {
                const item = document.createElement('div');
                item.className = 'lm-faculty-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div>
                        <div class="lm-faculty-name">${c.name}</div>
                        <div class="lm-faculty-pos">${c.lmcaPosition || 'Position not specified'}</div>
                    </div>
                    <div class="lm-faculty-rank">${c.lmcaCoreRank || c.rank || '\u2014'}</div>
                `;
                item.addEventListener('click', () => {
                    if (window.ovOpenSubject) window.ovOpenSubject(c.filePath);
                });
                perPanel.appendChild(item);
            });
        }
        detailArea.appendChild(perPanel);

        // Sub-tab switching
        subTabs.addEventListener('click', e => {
            const t = e.target.closest('.lm-dept-subtab');
            if (!t) return;
            subTabs.querySelectorAll('.lm-dept-subtab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            detailArea.querySelectorAll('.lm-dept-subpanel').forEach(p => p.classList.remove('active'));
            const target = detailArea.querySelector(`[data-subpanel="${t.dataset.sub}"]`);
            if (target) target.classList.add('active');
        });

        }

    function buildPillRow(depts) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px;';
        depts.forEach(dept => {
            const pill = document.createElement('div');
            pill.style.cssText = `font-family:'Barlow Condensed',sans-serif;font-size:0.65em;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;padding:4px 8px;border-radius:2px;cursor:pointer;white-space:nowrap;border:1px solid transparent;color:${dept.color};transition:all 0.15s;user-select:none;`;
            pill.textContent = dept.name;
            pill.dataset.deptId = dept.id;
            pill.addEventListener('click', () => {
                // If same pill clicked again, collapse
                if (activePill === pill) {
                    activePill.style.borderColor = 'transparent';
                    activePill.style.background = 'transparent';
                    activePill = null;
                    detailArea.innerHTML = '';
                    detailArea.remove();
                    return;
                }
                // Deactivate previous pill
                if (activePill) {
                    activePill.style.borderColor = 'transparent';
                    activePill.style.background = 'transparent';
                }
                // Activate this pill
                pill.style.borderColor = dept.color;
                pill.style.background = dept.color + '18';
                activePill = pill;
                // Move detailArea to appear after this pill's row
                row.parentNode.insertBefore(detailArea, row.nextSibling);
                showDeptDetail(dept);
            });
            row.appendChild(pill);
        });
        return row;
    }

    // PRIMARY section
    if (primaryDepts.length > 0) {
        const primaryHd = document.createElement('div');
        primaryHd.className = 'lm-section-title';
        primaryHd.style.cssText = 'font-size:0.6em;margin-bottom:6px;';
        primaryHd.textContent = '// PRIMARY DEPARTMENTS';
        container.appendChild(primaryHd);

        // Split into two rows
        const mid = Math.ceil(primaryDepts.length / 2);
        container.appendChild(buildPillRow(primaryDepts.slice(0, mid)));
        container.appendChild(buildPillRow(primaryDepts.slice(mid)));
    }

    // SUBSIDIARY section
    if (subsidiaryDepts.length > 0) {
        const subHd = document.createElement('div');
        subHd.className = 'lm-section-title';
        subHd.style.cssText = 'font-size:0.6em;margin-bottom:6px;margin-top:14px;';
        subHd.textContent = '// SUBSIDIARY DEPARTMENTS';
        container.appendChild(subHd);

        const mid = Math.ceil(subsidiaryDepts.length / 2);
        container.appendChild(buildPillRow(subsidiaryDepts.slice(0, mid)));
        container.appendChild(buildPillRow(subsidiaryDepts.slice(mid)));
    }

    // detailArea is inserted dynamically after the clicked row, not here
}

function _renderDeptList(deptListEl, deptTypeFilter) {
    if (!deptListEl) return;
    deptListEl.innerHTML = '';
    const depts = deptTypeFilter === 'all' ? DEPT_DATA :
                  DEPT_DATA.filter(d => d.type === deptTypeFilter);

    depts.forEach(dept => {
        const facultyInDept = _facultyChars.filter(c => c.lmcaDept === dept.id);

        const row = document.createElement('div');
        row.className = 'lm-dept-row';
        row.style.setProperty('--lm-dept-color', dept.color);

        const rowHeader = document.createElement('div');
        rowHeader.className = 'lm-dept-row-header';
        rowHeader.innerHTML = `
            <div class="lm-dept-num">${String(dept.num).padStart(2,'0')}</div>
            <div class="lm-dept-name-wrap">
                <div class="lm-dept-name" style="color:${dept.color}">${dept.name}</div>
                <div class="lm-dept-head-line">${dept.headTitle} \u2014 ${dept.head} [${dept.headRank}]</div>
            </div>
            <div class="lm-dept-chevron">\u25bc</div>
        `;
        row.appendChild(rowHeader);

        const rowBody = document.createElement('div');
        rowBody.className = 'lm-dept-body';

        const subTabs = document.createElement('div');
        subTabs.className = 'lm-dept-subtabs';
        ['OVERVIEW', 'POSITIONS', 'PERSONNEL'].forEach((label, i) => {
            const t = document.createElement('div');
            t.className = 'lm-dept-subtab' + (i === 0 ? ' active' : '');
            t.textContent = label;
            t.dataset.sub = label.toLowerCase();
            subTabs.appendChild(t);
        });
        rowBody.appendChild(subTabs);

        // Overview
        const ovPanel = document.createElement('div');
        ovPanel.className = 'lm-dept-subpanel active';
        ovPanel.dataset.subpanel = 'overview';
        ovPanel.innerHTML = `
            <div class="lm-motto">"${dept.motto}"</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.82em;">
                <div>
                    <div class="lm-wizard-label">Department Head</div>
                    <div style="color:#c8d8f0;font-family:'Barlow Condensed',sans-serif;font-size:1.05em;letter-spacing:1px;">${dept.head}</div>
                    <div style="font-family:'Share Tech Mono',monospace;font-size:0.65em;color:#5e7a96;margin-top:2px;">${dept.headRank}</div>
                </div>
                <div>
                    <div class="lm-wizard-label">Title</div>
                    <div style="color:#8ba8c8;font-size:0.88em;">${dept.headTitle}</div>
                </div>
                <div>
                    <div class="lm-wizard-label">Classification</div>
                    <div style="color:#5e7a96;font-family:'Share Tech Mono',monospace;font-size:0.65em;letter-spacing:1px;text-transform:uppercase;">${dept.type}</div>
                </div>
                <div>
                    <div class="lm-wizard-label">Indexed Personnel</div>
                    <div style="color:${facultyInDept.length > 0 ? '#3a9960' : '#5e3a2e'};font-family:'Share Tech Mono',monospace;font-size:0.65em;letter-spacing:1px;">${facultyInDept.length} INDEXED</div>
                </div>
            </div>
        `;
        rowBody.appendChild(ovPanel);

        // Positions
        const posPanel = document.createElement('div');
        posPanel.className = 'lm-dept-subpanel';
        posPanel.dataset.subpanel = 'positions';
        const posListEl = document.createElement('div');
        posListEl.className = 'lm-position-list';

        dept.positions.forEach(pos => {
            const holder = facultyInDept.find(c =>
                c.lmcaPosition && c.lmcaPosition.toLowerCase().includes(pos.title.split('\u2014').pop().trim().toLowerCase().substring(0, 15))
            );
            const isOccupied = !!pos.current || !!holder;

            const posItem = document.createElement('div');
            posItem.className = `lm-position-item level-${pos.level}`;

            const posLeft = document.createElement('div');
            posLeft.innerHTML = `
                <div class="lm-position-title">${pos.title}</div>
                <div class="lm-position-current">
                    ${pos.current ? `// ${pos.current}` : holder ? `// ${holder.name} (indexed)` : '// VACANT'}
                </div>
            `;
            posItem.appendChild(posLeft);

            const posRight = document.createElement('div');
            posRight.className = `lm-position-rank ${isOccupied ? 'lm-position-occupied' : 'lm-position-vacant'}`;

            if (!isOccupied) {
                posRight.style.cursor = 'pointer';
                posRight.innerHTML = `${pos.rank}<br><span style="font-size:0.85em;opacity:0.7">\u25a1 VACANT \u25b6</span>`;
                posRight.addEventListener('click', () => {
                    _showPositionPicker(posRight, dept, pos, () => _renderDeptList(posItem.closest('.lm-dept-list'), 'all'));
                });
            } else {
                posRight.innerHTML = `${pos.rank}<br><span style="font-size:0.85em;opacity:0.7">\u25a0 FILLED</span>`;
            }

            posItem.appendChild(posRight);
            posListEl.appendChild(posItem);
        });
        posPanel.appendChild(posListEl);
        rowBody.appendChild(posPanel);

        // Personnel
        const perPanel = document.createElement('div');
        perPanel.className = 'lm-dept-subpanel';
        perPanel.dataset.subpanel = 'personnel';

        if (facultyInDept.length === 0) {
            perPanel.innerHTML = `<div class="lm-empty">[ NO PERSONNEL INDEXED FOR THIS DEPARTMENT ]</div>`;
        } else {
            facultyInDept.forEach(c => {
                const item = document.createElement('div');
                item.className = 'lm-faculty-item';
                item.style.cursor = 'pointer';
                item.innerHTML = `
                    <div>
                        <div class="lm-faculty-name">${c.name}</div>
                        <div class="lm-faculty-pos">${c.lmcaPosition || 'Position not specified'}</div>
                    </div>
                    <div class="lm-faculty-rank">${c.lmcaCoreRank || c.rank || '\u2014'}</div>
                `;
                item.addEventListener('click', () => {
                    if (window.ovOpenSubject) window.ovOpenSubject(c.filePath);
                });
                perPanel.appendChild(item);
            });
        }
        rowBody.appendChild(perPanel);

        subTabs.addEventListener('click', e => {
            const t = e.target.closest('.lm-dept-subtab');
            if (!t) return;
            subTabs.querySelectorAll('.lm-dept-subtab').forEach(x => x.classList.remove('active'));
            t.classList.add('active');
            rowBody.querySelectorAll('.lm-dept-subpanel').forEach(p => p.classList.remove('active'));
            const target = rowBody.querySelector(`[data-subpanel="${t.dataset.sub}"]`);
            if (target) target.classList.add('active');
        });

        row.appendChild(rowBody);
        rowHeader.addEventListener('click', () => {
            const isOpen = row.classList.toggle('open');
            if (isOpen) {
                deptListEl.querySelectorAll('.lm-dept-row.open').forEach(r => {
                    if (r !== row) r.classList.remove('open');
                });
            }
        });

        deptListEl.appendChild(row);
    });
}

// ── POSITION PICKER (for filling vacant positions) ──
function _showPositionPicker(posEl, dept, position, onFilled) {
    const existing = posEl.parentNode.querySelector('.lm-pos-picker');
    if (existing) { existing.remove(); return; }

    const positionedCharPaths = new Set(
        _facultyChars.filter(c => c.lmcaPosition && c.lmcaDept).map(c => c.filePath)
    );
    const eligible = _allChars.filter(c => !positionedCharPaths.has(c.filePath));

    const picker = document.createElement('div');
    picker.className = 'lm-pos-picker';
    picker.style.cssText = 'background:#0f1420;border:1px solid #2e4060;border-radius:4px;padding:10px;margin-top:6px;width:100%;box-sizing:border-box;';

    if (eligible.length === 0) {
        picker.innerHTML = `<div class="lm-empty" style="padding:12px;">[ NO ELIGIBLE CANDIDATES ]</div>`;
        posEl.parentNode.insertBefore(picker, posEl.nextSibling);
        return;
    }

    picker.innerHTML = `
        <div style="font-family:'Share Tech Mono',monospace;font-size:0.6em;color:#4a6fa5;letter-spacing:2px;margin-bottom:8px;">
            // ASSIGN ${position.title.toUpperCase()} \u2014 DEPT ${dept.num}
        </div>
        <div id="pos-pick-list" style="max-height:300px;overflow-y:auto;border:1px solid #1e2535;border-radius:3px;margin-top:6px;"></div>
        <div style="margin-top:8px;">
            <button class="lm-btn" id="pos-cancel" style="font-size:0.7em;padding:4px 10px;">CANCEL</button>
        </div>
    `;
    posEl.parentNode.insertBefore(picker, posEl.nextSibling);

    const listEl = picker.querySelector('#pos-pick-list');
    eligible.forEach(c => {
        const row = document.createElement('div');
        row.className = 'lm-faculty-item';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <div>
                <div class="lm-faculty-name">${c.name}</div>
                <div class="lm-faculty-pos">${c.rank} \u00b7 ${c.gender}</div>
            </div>
        `;
        row.addEventListener('click', () => _fillPosition(c, dept, position, picker, onFilled));
        listEl.appendChild(row);
    });

    picker.querySelector('#pos-cancel').addEventListener('click', () => picker.remove());
}

async function _fillPosition(char, dept, position, picker, onFilled) {
    try {
        const fileObj = _deps.app.vault.getAbstractFileByPath(char.filePath);
        await _deps.app.fileManager.processFrontMatter(fileObj, fm => {
            fm.lmca_role = 'faculty';
            fm.lmca_dept = dept.id;
            fm.lmca_position = position.title;
            fm.lmca_core_rank = fm.rank || 'Dormant';
            delete fm.lmca_track; delete fm.lmca_cohort; delete fm.lmca_stripes;
            delete fm.lmca_rank_position;
        });
        picker.innerHTML = `<div style="color:#3a9960;font-family:'Share Tech Mono',monospace;font-size:0.65em;padding:8px;">// ASSIGNED: ${char.name.toUpperCase()} \u2192 ${position.title.toUpperCase()}</div>`;
        _fetchCharacters();
        if (onFilled) onFilled();
        setTimeout(() => picker.remove(), 1500);
    } catch (e) {
        picker.innerHTML = `<div style="color:#c03030;font-family:'Share Tech Mono',monospace;font-size:0.65em;padding:8px;">// ERROR: ${e.message}</div>`;
    }
}

// ═══════════════════════════════════════════════════════════
// RANKINGS PANEL
// ═══════════════════════════════════════════════════════════

function _buildRankingsPanel() {
    const panel = document.createElement('div');
    panel.className = 'lm-panel';
    panel.dataset.panel = 'rankings';

    const rankNote = document.createElement('div');
    rankNote.className = 'lm-motto';
    rankNote.textContent = 'Rankings update weekly. Displayed in the central hall and canteen screens. Dormant students do not appear. Rankings are calculated from AP, combat performance, dungeon contribution, and instructor evaluations.';
    panel.appendChild(rankNote);

    const rankTiersEl = document.createElement('div');
    rankTiersEl.className = 'lm-rank-tiers';

    const rankedStudents = _studentChars
        .filter(c => c.lmcaRankPos !== null && c.lmcaRankPos >= 1 && c.lmcaRankPos <= 200)
        .sort((a, b) => a.lmcaRankPos - b.lmcaRankPos);

    RANKING_TIERS.forEach(tier => {
        const tieredStudents = rankedStudents.filter(s => s.lmcaRankPos >= tier.min && s.lmcaRankPos <= tier.max);

        const tierEl = document.createElement('div');
        tierEl.className = 'lm-rank-tier';
        tierEl.style.setProperty('--lm-tier-color', tier.color);

        let studentsHTML = '';
        if (tieredStudents.length === 0) {
            studentsHTML = `<div class="lm-empty" style="padding:12px;">[ NO RANKED STUDENTS IN THIS TIER ]</div>`;
        } else {
            studentsHTML = `<div class="lm-rank-student-list">` +
                tieredStudents.map(s => {
                    const track = TRACK_DATA.find(t => t.id === s.lmcaTrack);
                    return `
                        <div class="lm-rank-student">
                            <div>
                                <span class="lm-rank-num" style="color:${tier.color}">#${s.lmcaRankPos}</span>
                                <span class="lm-rank-student-name">${s.name}</span>
                            </div>
                            <div style="font-family:'Share Tech Mono',monospace;font-size:0.6em;color:#5e7a96;">
                                ${track ? track.nickname : ''}${s.lmcaCohort ? ` \u00b7 ${s.lmcaCohort}th Cohort` : ''}${s.lmcaStripes !== null ? ` \u00b7 ${s.lmcaStripes}S` : ''}
                            </div>
                        </div>
                    `;
                }).join('') +
                `</div>`;
        }

        tierEl.innerHTML = `
            <div class="lm-rank-tier-header" style="border-left-color:${tier.color}">
                <div class="lm-rank-tier-title" style="color:${tier.color}">${tier.title}</div>
                <div class="lm-rank-tier-range">${tier.range}</div>
            </div>
            ${studentsHTML}
        `;
        rankTiersEl.appendChild(tierEl);
    });

    panel.appendChild(rankTiersEl);

    // Unranked section
    const unranked = _studentChars.filter(c => !c.lmcaRankPos);
    if (unranked.length > 0) {
        const unrankedEl = document.createElement('div');
        unrankedEl.className = 'lm-section-title';
        unrankedEl.style.marginTop = '20px';
        unrankedEl.innerHTML = `// UNRANKED STUDENTS <span>${unranked.length}</span>`;
        panel.appendChild(unrankedEl);

        const unrankedList = document.createElement('div');
        unrankedList.style.display = 'grid';
        unrankedList.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
        unrankedList.style.gap = '6px';
        unrankedList.innerHTML = unranked
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(s => {
                const track = TRACK_DATA.find(t => t.id === s.lmcaTrack);
                return `<div style="font-size:0.82em;color:#7a8a9a;padding:4px 8px;background:#0f1420;border-radius:2px;">
                    <span style="color:#c8d8f0;font-family:'Barlow Condensed',sans-serif;">${s.name}</span>
                    <span style="font-size:0.75em;color:#5e7a96;"> ${track ? track.nickname : ''}${s.lmcaCohort ? ` \u00b7 Y${s.lmcaCohort}` : ''}</span>
                </div>`;
            }).join('');
        panel.appendChild(unrankedList);
    }

    return panel;
}

// ═══════════════════════════════════════════════════════════
// AP SYSTEM PANEL (shell)
// ═══════════════════════════════════════════════════════════

function _buildAPPanel() {
    const panel = document.createElement('div');
    panel.className = 'lm-panel';
    panel.dataset.panel = 'ap';
    panel.innerHTML = `<div class="lm-empty">[ AP SYSTEM \u2014 UNDER CONSTRUCTION ]</div>`;
    return panel;
}

// ═══════════════════════════════════════════════════════════
// DUNGEONS PANEL (shell)
// ═══════════════════════════════════════════════════════════

function _buildDungeonsPanel() {
    const panel = document.createElement('div');
    panel.className = 'lm-panel';
    panel.dataset.panel = 'dungeons';
    panel.innerHTML = `<div class="lm-empty">[ DUNGEON SYSTEM \u2014 UNDER CONSTRUCTION ]</div>`;
    return panel;
}

// ═══════════════════════════════════════════════════════════
// MAIN RENDER
// ═══════════════════════════════════════════════════════════

function _switchTab(tabId) {
    if (!_root) return;
    _root.querySelectorAll('.lm-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
    _root.querySelectorAll('.lm-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabId));
}

async function _render(container, titleEl, subtitleEl) {
    // Ensure data is loaded
    if (!_dataLoaded && _dataPromise) await _dataPromise;
    if (!_dataLoaded) await _loadLMCAData();
    await _injectCSS();
    _fetchCharacters();

    // Update header
    if (titleEl) titleEl.textContent = 'LORD MARKHAM COREBEARER ACADEMY';
    if (subtitleEl) subtitleEl.textContent = '// INSTITUTIONAL REGISTRY \u2014 OAKHAVEN, KEST \u2014 AETHELGARD REACH';

    // Save refs
    _container = container;

    // Clear and build
    container.innerHTML = '';

    _root = document.createElement('div');
    _root.className = 'lm-root';

    // ── HEADER ──
    const header = document.createElement('div');
    header.className = 'lm-header';
    header.innerHTML = `
        <div class="lm-header-top">
            <div>
                <div class="lm-header-title">Lord Markham Corebearer Academy</div>
                <div class="lm-header-sub">// INSTITUTIONAL REGISTRY \u2014 OAKHAVEN, KEST \u2014 AETHELGARD REACH</div>
            </div>
            <div class="lm-header-meta">
                ICA STATUS: <span>TIER-1 RECOGNIZED</span><br>
                ENROLLMENT: <span>~3,400 ACTIVE</span><br>
                INDEXED: <span>${_lmcaChars.length}</span> SUBJECTS
            </div>
        </div>
        <div class="lm-tabs" id="lm-main-tabs">
            <div class="lm-tab active" data-tab="registry">REGISTRY</div>
            <div class="lm-tab" data-tab="tracks">TRACKS</div>
            <div class="lm-tab" data-tab="departments">DEPARTMENTS</div>
            <div class="lm-tab" data-tab="rankings">RANKINGS</div>
            <div class="lm-tab shell" data-tab="ap">AP SYSTEM</div>
            <div class="lm-tab shell" data-tab="dungeons">DUNGEONS</div>
        </div>
    `;
    _root.appendChild(header);

    // ── BODY ──
    _body = document.createElement('div');
    _body.className = 'lm-body';
    _root.appendChild(_body);

    // Build panels
    _body.appendChild(_buildRegistryPanel());
    _body.appendChild(_buildTracksPanel());
    _body.appendChild(_buildDeptsPanel());
    _body.appendChild(_buildRankingsPanel());
    _body.appendChild(_buildAPPanel());
    _body.appendChild(_buildDungeonsPanel());

    // Tab switching
    header.querySelector('#lm-main-tabs').addEventListener('click', e => {
        const tab = e.target.closest('.lm-tab');
        if (tab) _switchTab(tab.dataset.tab);
    });

    // Initial render
    _renderRegList();

    container.appendChild(_root);
}

function _unmount() {
    if (_activeWizard) { _activeWizard.remove(); _activeWizard = null; }
    if (_root) {
        _root.remove();
        _root = null;
    }
    _body = null;
    _container = null;
    _wizardTarget = null;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
    // Kick off async data loading early
    _dataPromise = _loadLMCAData();

    window.LMCA = {
        render: _render,
        unmount: _unmount,
    };
    console.log("[LMCA] Module registered. Call window.LMCA.render(container, titleEl, subtitleEl) to activate.");
}

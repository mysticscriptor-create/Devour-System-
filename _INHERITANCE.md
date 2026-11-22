---
obsidianUIMode: preview
cssclasses:
  -  performance-mode
  - performance-mode
  - full-page-db
  - performance-mode
---
```dataviewjs
const filePath = "000 A System/MARC/00 Zenith File.md";
const startMarker = "%%ZENITH_INHERITANCE_STARTS%%";
const endMarker = "%%ZENITH_INHERITANCE_ENDS%%";

const container = dv.el("div", "", { cls: "zenith-container" });

// ── SVG pieces ──────────────────────────────────────────────
const SVG = {
  topSigil: `<svg width="52" height="52" viewBox="0 0 52 52" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="display:block;margin:-26px auto 0;position:relative;z-index:25">
    <defs>
      <radialGradient id="sg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f0d090"/>
        <stop offset="60%" stop-color="#c07828"/>
        <stop offset="100%" stop-color="#5a2e08"/>
      </radialGradient>
    </defs>
    <circle cx="26" cy="26" r="24" fill="#1a0e06" stroke="#7a4a18" stroke-width="1.5"/>
    <circle cx="26" cy="26" r="20" fill="none" stroke="#c07828" stroke-width="0.8" opacity="0.6"/>
    <polygon points="26,6 40,26 26,46 12,26" fill="url(#sg)"/>
    <polygon points="26,12 36,26 26,40 16,26" fill="#1a0e06" opacity="0.75"/>
    <polygon points="26,18 32,26 26,34 20,26" fill="#e0a040" opacity="0.55"/>
    <circle cx="26" cy="26" r="3" fill="#f0d090"/>
  </svg>`,

  arrowL: `<svg width="26" height="10" viewBox="0 0 26 10" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="flex-shrink:0">
    <path d="M26 5L15 0l2 5-2 5Z" fill="#c07828" opacity="0.85"/>
    <path d="M16 5L5 0l2 5-2 5Z" fill="#8a5218" opacity="0.6"/>
    <line x1="0" y1="5" x2="16" y2="5" stroke="#c07828" stroke-width="0.8" opacity="0.5"/>
  </svg>`,

  arrowR: `<svg width="26" height="10" viewBox="0 0 26 10" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="flex-shrink:0;transform:scaleX(-1)">
    <path d="M26 5L15 0l2 5-2 5Z" fill="#c07828" opacity="0.85"/>
    <path d="M16 5L5 0l2 5-2 5Z" fill="#8a5218" opacity="0.6"/>
    <line x1="0" y1="5" x2="16" y2="5" stroke="#c07828" stroke-width="0.8" opacity="0.5"/>
  </svg>`,

  subDiamond: `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="display:block;margin:10px auto 0">
    <polygon points="8,1 15,8 8,15 1,8" fill="#c07828" opacity="0.7"/>
    <polygon points="8,4 12,8 8,12 4,8" fill="#120a05"/>
    <circle cx="8" cy="8" r="2.2" fill="#e0a040" opacity="0.8"/>
  </svg>`,

  headerSep: `<svg width="100%" height="16" viewBox="0 0 400 16" preserveAspectRatio="none"
    xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="display:block;margin:12px 0 0">
    <line x1="0" y1="8" x2="178" y2="8" stroke="#7a4a18" stroke-width="0.8"/>
    <circle cx="172" cy="8" r="2" fill="#c07828" opacity="0.55"/>
    <polyline points="186,3 194,8 186,13" fill="none" stroke="#c07828" stroke-width="1.4" stroke-linejoin="round" opacity="0.85"/>
    <polyline points="194,3 202,8 194,13" fill="none" stroke="#8a5218" stroke-width="1.0" stroke-linejoin="round" opacity="0.6"/>
    <circle cx="228" cy="8" r="2" fill="#c07828" opacity="0.55"/>
    <line x1="222" y1="8" x2="400" y2="8" stroke="#7a4a18" stroke-width="0.8"/>
  </svg>`,

  bigSep: `<svg width="100%" height="16" viewBox="0 0 400 16" preserveAspectRatio="none"
    xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="display:block;margin:14px 0">
    <line x1="0" y1="8" x2="172" y2="8" stroke="#7a4a18" stroke-width="0.9"/>
    <polygon points="186,2 196,8 186,14 194,8" fill="#c07828" opacity="0.75"/>
    <polygon points="214,2 204,8 214,14 206,8" fill="#c07828" opacity="0.75"/>
    <line x1="228" y1="8" x2="400" y2="8" stroke="#7a4a18" stroke-width="0.9"/>
    <circle cx="165" cy="8" r="2" fill="#8a5218" opacity="0.6"/>
    <circle cx="235" cy="8" r="2" fill="#8a5218" opacity="0.6"/>
  </svg>`,

  thinRule: `<svg width="100%" height="5" viewBox="0 0 400 5" preserveAspectRatio="none"
    xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)" style="display:block;margin:4px 0 14px">
    <line x1="0" y1="2.5" x2="400" y2="2.5" stroke="#4a2e10" stroke-width="0.7" opacity="0.7"/>
  </svg>`,

  bullet: `<svg width="9" height="9" viewBox="0 0 9 9" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="flex-shrink:0;margin-top:6px;margin-right:6px">
    <polygon points="4.5,0 9,4.5 4.5,9 0,4.5" fill="#c07828"/>
  </svg>`,

  checkbox: `<span style="display:inline-block;width:13px;height:13px;border:1.5px solid #c07828;
    box-shadow:0 0 5px rgba(200,130,30,0.35);opacity:0.85;flex-shrink:0;margin-top:1px"></span>`,

  bottomSigil: `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="display:block;margin:16px auto 0">
    <polygon points="10,1 19,10 10,19 1,10" fill="#7a4818" opacity="0.8"/>
    <polygon points="10,5 15,10 10,15 5,10" fill="#120a05"/>
    <circle cx="10" cy="10" r="2.8" fill="#c07828" opacity="0.75"/>
  </svg>`,

  cornerTL: `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="position:absolute;top:-1px;left:-1px;pointer-events:none;z-index:10">
    <path d="M0 0 L60 0 L60 5 L7 5 L7 60 L0 60 Z" fill="#3a1e0a"/>
    <path d="M0 0 L52 0 L52 3 L3 3 L3 52 L0 52 Z" fill="#7a4a18"/>
    <path d="M0 0 L22 0 L0 22 Z" fill="#c07828" opacity="0.5"/>
    <circle cx="7" cy="7" r="2" fill="#e0a040" opacity="0.6"/>
    <line x1="7" y1="7" x2="28" y2="7" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
    <line x1="7" y1="7" x2="7" y2="28" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
  </svg>`,

  cornerTR: `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="position:absolute;top:-1px;right:-1px;pointer-events:none;z-index:10">
    <path d="M60 0 L0 0 L0 5 L53 5 L53 60 L60 60 Z" fill="#3a1e0a"/>
    <path d="M60 0 L8 0 L8 3 L57 3 L57 52 L60 52 Z" fill="#7a4a18"/>
    <path d="M60 0 L38 0 L60 22 Z" fill="#c07828" opacity="0.5"/>
    <circle cx="53" cy="7" r="2" fill="#e0a040" opacity="0.6"/>
    <line x1="53" y1="7" x2="32" y2="7" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
    <line x1="53" y1="7" x2="53" y2="28" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
  </svg>`,

  cornerBL: `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="position:absolute;bottom:-1px;left:-1px;pointer-events:none;z-index:10">
    <path d="M0 60 L60 60 L60 55 L7 55 L7 0 L0 0 Z" fill="#3a1e0a"/>
    <path d="M0 60 L52 60 L52 57 L3 57 L3 8 L0 8 Z" fill="#7a4a18"/>
    <path d="M0 60 L22 60 L0 38 Z" fill="#c07828" opacity="0.5"/>
    <circle cx="7" cy="53" r="2" fill="#e0a040" opacity="0.6"/>
    <line x1="7" y1="53" x2="28" y2="53" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
    <line x1="7" y1="53" x2="7" y2="32" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
  </svg>`,

  cornerBR: `<svg width="60" height="60" viewBox="0 0 60 60" xmlns="[http://www.w3.org/2000/svg](http://www.w3.org/2000/svg)"
    style="position:absolute;bottom:-1px;right:-1px;pointer-events:none;z-index:10">
    <path d="M60 60 L0 60 L0 55 L53 55 L53 0 L60 0 Z" fill="#3a1e0a"/>
    <path d="M60 60 L8 60 L8 57 L57 57 L57 8 L60 8 Z" fill="#7a4a18"/>
    <path d="M60 60 L38 60 L60 38 Z" fill="#c07828" opacity="0.5"/>
    <circle cx="53" cy="53" r="2" fill="#e0a040" opacity="0.6"/>
    <line x1="53" y1="53" x2="32" y2="53" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
    <line x1="53" y1="53" x2="53" y2="32" stroke="#c07828" stroke-width="0.5" opacity="0.45"/>
  </svg>`
};

// ── Styles ───────────────────────────────────────────────────
const styles = `<style>
@import url('[https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Cormorant+Garamond:ital,wght@0,500;1,400&display=swap](https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Cormorant+Garamond:ital,wght@0,500;1,400&display=swap)');

.z-wrap {
  padding: 36px 12px 48px;
  display: flex;
  justify-content: center;
  background: #080503;
}

.z-outer {
  width: 100%;
  max-width: 500px;
  position: relative;
  border: 2.5px solid #8a5c1e;
  box-shadow:
    0 0 0 1px #110a04,
    0 0 0 4px #3a1e08,
    0 0 24px rgba(0,0,0,0.95),
    0 0 48px rgba(120,60,8,0.3);
  background: #0e0804;
}

.z-inner {
  padding: 44px 36px 40px;
  position: relative;
  background:
    radial-gradient(ellipse 80% 55% at 50% 30%, #1e1008 0%, #0e0804 55%, #08040 100%),
    radial-gradient(ellipse 40% 25% at 75% 12%, rgba(160,80,15,0.1) 0%, transparent 60%);
}

.z-inner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 85% 85% at 50% 50%, transparent 45%, rgba(0,0,0,0.6) 100%);
  pointer-events: none;
  z-index: 0;
}

.z-inner > * { position: relative; z-index: 1; }

.z-title-zone { 
  text-align: center; 
  padding-bottom: 18px; 
  margin-bottom: 18px; 
  cursor: pointer;
  transition: opacity 0.2s;
}
.z-title-zone:hover { opacity: 0.8; }

.z-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  flex-wrap: nowrap;
}

.z-title {
  font-family: 'Cinzel', serif;
  font-size: clamp(1.05rem, 5vw, 1.65rem);
  font-weight: 600;
  color: #f0d090;
  letter-spacing: 0.2em;
  white-space: nowrap;
  text-shadow: 0 0 10px rgba(240,190,80,0.45), 0 2px 2px rgba(0,0,0,0.8);
}

.z-block { margin: 0 0 18px; }
.z-block-realm {
  background: rgba(0,0,0,0.22);
  border: 1px solid rgba(120,75,20,0.2);
  padding: 12px 14px;
  margin-bottom: 6px;
}

.z-bhead {
  font-family: 'Cinzel', serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: #f0d090;
  letter-spacing: 0.12em;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 9px;
  text-shadow: 0 0 10px rgba(240,190,60,0.3);
}

.z-items { display: flex; flex-direction: column; gap: 4px; }

.z-item {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.05rem;
  font-weight: 500;
  color: #c8a46e;
  display: flex;
  align-items: flex-start;
  line-height: 1.45;
  letter-spacing: 0.025em;
}

.z-tree-prefix {
  font-family: 'Courier New', Courier, monospace;
  color: #8a5218;
  opacity: 0.8;
  font-size: 0.95rem;
  white-space: pre;
}

.z-unknown { color: #c87a3a; font-style: italic; }
.z-warn    { color: #d48050; font-weight: 600; }
.z-ok      { color: #9fc46a; }

.z-sysnote {
  font-family: 'Cormorant Garamond', serif;
  font-size: 0.88rem;
  color: #8a6838;
  font-style: italic;
  letter-spacing: 0.06em;
  margin-top: 8px;
  opacity: 0.85;
}

.z-quote {
  font-family: 'Cormorant Garamond', serif;
  font-style: italic;
  font-size: 1.1rem;
  color: #eed9a0;
  line-height: 1.7;
  letter-spacing: 0.04em;
  text-align: center;
  text-shadow: 0 0 16px rgba(240,180,60,0.18), 0 1px 3px rgba(0,0,0,0.7);
  opacity: 0.92;
}
</style>`;

// ── Data parser ───────────────────────────────────────────────
async function loadSystem() {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) {
    container.innerHTML = "<p style='color:#c87a3a;font-family:serif;padding:20px'>⚠ File not found: " + filePath + "</p>";
    return;
  }

  const raw = await app.vault.read(file);
  const parts = raw.split(startMarker);
  if (parts.length < 2) {
    container.innerHTML = "<p style='color:#c87a3a;font-family:serif;padding:20px'>⚠ Start marker missing.</p>";
    return;
  }

  const data = parts[1].split(endMarker)[0].trim();
  const lines = data.split('\n');

  let blocks = [];
  let current = null;
  let quote = '';
  let sysNote = '';

  for (const line of lines) {
    const t = line.trim();
    // Skip empties and purely decorative markdown lines 
    if (!t || t.includes('━') || t.includes('◈')) continue;
    
    if (t.startsWith('**') && t.endsWith('**')) {
      if (current) blocks.push(current);
      current = { header: t.replace(/\*\*/g, ''), items: [] };
    } else if (t.startsWith('- System Note:')) {
      sysNote = t.replace('- System Note:', '').trim();
    } else if (t.startsWith('- ')) {
      if (current) current.items.push({ type: 'point', text: t.slice(2) });
    } else if (/^\[([\d\.]+)\]\s*(.*)/.test(t)) {
      const match = t.match(/^\[([\d\.]+)\]\s*(.*)/);
      const id = match[1];
      const text = match[2];
      const depth = id.split('.').length - 1;
      if (current) current.items.push({ type: 'tree', id, depth, text });
    } else if (t.startsWith('"') || t.endsWith('"')) {
      quote = t;
    }
  }
  if (current) blocks.push(current);

  // ── Post Process Trees ───────────────────────────────────
  blocks.forEach(b => {
    const treeItems = b.items.filter(i => i.type === 'tree');
    
    // Determine isLast status for each depth level
    for (let i = 0; i < treeItems.length; i++) {
      let isLast = true;
      for (let j = i + 1; j < treeItems.length; j++) {
        if (treeItems[j].depth < treeItems[i].depth) break;
        if (treeItems[j].depth === treeItems[i].depth) {
          isLast = false; break;
        }
      }
      treeItems[i].isLast = isLast;
    }

    let ancestorIsLast = [];
    b.items.forEach(item => {
      if (item.type === 'tree') {
        ancestorIsLast[item.depth] = item.isLast;
        let prefix = '';
        
        for (let d = 0; d < item.depth; d++) {
          if (ancestorIsLast[d]) prefix += '     ';
          else prefix += '│    ';
        }

        if (item.depth === 0) prefix += item.isLast ? '└⟡ ' : '├⟡ ';
        else prefix += item.isLast ? '└─ ' : '├─ ';
        
        item.prefix = prefix;
      }
    });
  });

  // ── Render helpers ───────────────────────────────────────
  // Colors custom tags: [c:#ff0000]text[/c] or [c:red]text[/c]
  function colorItem(text) {
    let t = text
      .replace(/\?\?\?/g, '<span class="z-unknown">???</span>')
      .replace(/\b(Termination|Withheld|Irregular|Calibrating)\b/g, '<span class="z-warn">$1</span>')
      .replace(/\b(Available|Initiated)\b/g, '<span class="z-ok">$1</span>');
    
    // Custom color parser
    t = t.replace(/\[c:([^\]]+)\](.*?)\[\/c\]/g, '<span style="color:$1;">$2</span>');
    return t;
  }

  function stripColorTags(text) {
    return text.replace(/\[c:([^\]]+)\](.*?)\[\/c\]/g, '$2');
  }

  function renderBlock(b, isRealm, sysNote) {
    const items = b.items.map(i => {
      if (i.type === 'point') {
        return `<div class="z-item">${SVG.bullet}<span>${colorItem(i.text)}</span></div>`;
      } else if (i.type === 'tree') {
        return `<div class="z-item"><span class="z-tree-prefix">${i.prefix}</span><span>${colorItem(i.text)}</span></div>`;
      }
    }).join('');
    
    const note = (isRealm && sysNote) ? `<div class="z-sysnote">System Note : ${sysNote}</div>` : '';
    return `<div class="z-block${isRealm ? ' z-block-realm' : ''}">
      <div class="z-bhead">${SVG.checkbox}${b.header}</div>
      <div class="z-items">${items}</div>
      ${note}
    </div>`;
  }

  const realmIdx = blocks.findIndex(b => b.header.toLowerCase().includes('realm'));

  let blocksHtml = '';
  blocks.forEach((b, i) => {
    const isRealm = i === realmIdx;
    blocksHtml += renderBlock(b, isRealm, sysNote);
    if (i < blocks.length - 1) {
      blocksHtml += (i === realmIdx - 1 || i === realmIdx) ? SVG.bigSep : SVG.thinRule;
    }
  });

  // ── Clipboard Logic ──────────────────────────────────────
  function generateClipboardText() {
    let out = "━━━━━━━━━━━━━━━━━━━━━\n" +
              "     ◈  ZENITH INHERITANCE  ◈\n" +
              "━━━━━━━━━━━━━━━━━━━━━\n\n";

    blocks.forEach(b => {
       out += `▣ ${b.header}\n`;
       b.items.forEach(item => {
          let rawText = stripColorTags(item.text);
          if (item.type === 'point') {
             out += `     ⟡ ${rawText}\n`;
          } else if (item.type === 'tree') {
             out += `   ${item.prefix}${rawText}\n`;
          }
       });

       if (b.header.toLowerCase().includes('realm') && sysNote) {
          out += `\n⟡ System Note: ${sysNote}\n`;
       }
       out += '\n';
    });

    if (quote) {
       out += "━━━━━━━━━━━━━━━━━━━━━\n";
       // Trying to center linebreaks beautifully based on your requested format
       if(quote.length > 50) {
          out += `      ${quote.substring(0, 23)}\n          ${quote.substring(23, 43)}\n     ${quote.substring(43)}\n`;
       } else {
          out += `      ${quote}\n`;
       }
       out += "━━━━━━━━━━━━━━━━━━━━━\n";
    }
    return out.trim();
  }

  window.copyZenithData = async () => {
    const text = generateClipboardText();
    await navigator.clipboard.writeText(text);
    new Notice("Zenith Inheritance data copied to clipboard!");
  };

  // ── Assemble ─────────────────────────────────────────────
  container.innerHTML = styles + `
  <div class="z-wrap">
    <div class="z-outer">
      ${SVG.topSigil}
      ${SVG.cornerTL}${SVG.cornerTR}${SVG.cornerBL}${SVG.cornerBR}
      <div class="z-inner">

        <div class="z-title-zone" onclick="window.copyZenithData()" title="Click to copy structured data">
          <div class="z-title-row">
            ${SVG.arrowL}
            <div class="z-title">Zenith Inheritance</div>
            ${SVG.arrowR}
          </div>
          ${SVG.subDiamond}
          ${SVG.headerSep}
        </div>

        ${blocksHtml}

        ${SVG.bigSep}

        <div style="text-align:center;padding-top:16px">
          <div class="z-quote">${quote}</div>
          ${SVG.bottomSigil}
        </div>

      </div>
    </div>
  </div>`;
}

loadSystem();

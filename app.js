/* =========================================================
   TRACKER — shared engine
   Each page defines a SCHEMA object describing its fields,
   then calls initTracker(SCHEMA). Dashboard reads all
   localStorage keys directly (see initDashboard at bottom).
   ========================================================= */

const CATEGORY_LIST = [
  { key: "anime",       label: "Anime",       icon: "🎬", href: "anime.html" },
  { key: "books",       label: "Books",       icon: "📚", href: "books.html" },
  { key: "movies",      label: "Movies/TV",   icon: "🍿", href: "movies.html" },
  { key: "budget",      label: "Budget",      icon: "💰", href: "budget.html" },
  { key: "assignments", label: "Assignments", icon: "📝", href: "assignments.html" },
  { key: "goals",       label: "Goals/Ideas", icon: "💡", href: "goals.html" },
];

/* ---------- Sidebar (runs on every page) ---------- */
function renderSidebar(activeKey) {
  const nav = document.getElementById("navList");
  if (!nav) return;
  nav.innerHTML = `<li><a class="nav-link ${activeKey === 'home' ? 'active' : ''}" href="index.html"><span class="nav-icon">🏠</span> Dashboard</a></li>`
    + CATEGORY_LIST.map(c => `
      <li><a class="nav-link ${activeKey === c.key ? 'active' : ''}" href="${c.href}">
        <span class="nav-icon">${c.icon}</span> ${c.label}
      </a></li>
    `).join("");

  const toggle = document.getElementById("sidebarToggle");
  if (toggle) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
}

/* ---------- Helpers ---------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}
function loadEntries(storeKey) {
  return JSON.parse(localStorage.getItem(storeKey) || "[]");
}
function saveEntries(storeKey, entries) {
  localStorage.setItem(storeKey, JSON.stringify(entries));
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(dateStr + "T00:00:00");
  return Math.round((due - today) / 86400000);
}

/* =========================================================
   GENERIC TRACKER ENGINE
   schema = {
     storeKey, title, eyebrow, sub,
     fields: [ {key,label,type:'text'|'textarea'|'tags'|'number'|'date',placeholder,suggest?:[]} ],
     statuses: [ {value,label,color} ],   // color: teal|gold|red|purple|blue
     hasRating: bool,
     priceField: 'price' | null,          // if set, shows ₦ price on card + budget total stat
     dueField: 'dueDate' | null,          // if set, shows due-date badge + overdue sort
     tagField: 'tags' | null,             // field key used for the filter chip row
     cardExtra: fn(entry) => html string (optional extra card line)
   }
   ========================================================= */

function initTracker(schema) {
  let entries = loadEntries(schema.storeKey);
  let activeTagFilters = new Set();
  let currentRating = 0;

  renderSidebar(schema.key);
  document.getElementById("pageEyebrow").textContent = schema.eyebrow;
  document.getElementById("pageTitle").textContent = schema.title;
  document.getElementById("pageSub").textContent = schema.sub;

  buildForm();
  wireStaticControls();
  renderAll();

  // ---------- Build form fields dynamically ----------
  function buildForm() {
    const grid = document.getElementById("formGrid");
    let html = "";

    schema.fields.forEach(f => {
      if (f.type === "tags") {
        html += `
          <div class="field full">
            <label for="f_${f.key}">${f.label}</label>
            <div class="tag-input-wrap">
              <input type="text" id="f_${f.key}" placeholder="${f.placeholder || ''}">
              <div class="tag-suggest" id="suggest_${f.key}"></div>
            </div>
          </div>`;
      } else if (f.type === "textarea") {
        html += `
          <div class="field full">
            <label for="f_${f.key}">${f.label}</label>
            <textarea id="f_${f.key}" placeholder="${f.placeholder || ''}"></textarea>
          </div>`;
      } else {
        html += `
          <div class="field${f.full ? ' full' : ''}">
            <label for="f_${f.key}">${f.label}</label>
            <input type="${f.type}" id="f_${f.key}" placeholder="${f.placeholder || ''}" ${f.step ? `step="${f.step}"` : ''}>
          </div>`;
      }
    });

    if (schema.statuses) {
      html += `
        <div class="field full">
          <label>Status</label>
          <div class="status-radio" id="statusRadio">
            ${schema.statuses.map((s, i) => `
              <input type="radio" name="status" id="st_${s.value}" value="${s.value}" ${i === 0 ? "checked" : ""}>
              <label for="st_${s.value}">${s.label}</label>
            `).join("")}
          </div>
        </div>`;
    }

    if (schema.hasRating) {
      html += `
        <div class="field">
          <label>Your rating</label>
          <div class="star-input" id="starInput">
            <span data-v="1">★</span><span data-v="2">★</span><span data-v="3">★</span><span data-v="4">★</span><span data-v="5">★</span>
          </div>
        </div>`;
    }

    html += `
      <div class="form-actions">
        <button class="btn primary" id="saveBtn">Add</button>
        <button class="btn ghost-dark" id="clearFormBtn">Clear form</button>
      </div>`;

    grid.innerHTML = html;

    // wire tag suggestions
    schema.fields.filter(f => f.type === "tags" && f.suggest).forEach(f => {
      const wrap = document.getElementById(`suggest_${f.key}`);
      f.suggest.forEach(val => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tag-chip-btn";
        b.textContent = val;
        b.onclick = () => {
          const input = document.getElementById(`f_${f.key}`);
          const parts = input.value.split(",").map(s => s.trim()).filter(Boolean);
          if (!parts.includes(val)) parts.push(val);
          input.value = parts.join(", ");
        };
        wrap.appendChild(b);
      });
    });

    if (schema.hasRating) {
      document.getElementById("starInput").addEventListener("click", e => {
        const span = e.target.closest("span[data-v]");
        if (!span) return;
        currentRating = parseInt(span.dataset.v);
        updateStars();
      });
    }

    document.getElementById("saveBtn").addEventListener("click", handleSave);
    document.getElementById("clearFormBtn").addEventListener("click", resetForm);
  }

  function updateStars() {
    document.querySelectorAll("#starInput span").forEach(s => {
      s.classList.toggle("active", parseInt(s.dataset.v) <= currentRating);
    });
  }

  function resetForm() {
    schema.fields.forEach(f => { document.getElementById(`f_${f.key}`).value = ""; });
    if (schema.statuses) document.getElementById(`st_${schema.statuses[0].value}`).checked = true;
    currentRating = 0;
    if (schema.hasRating) updateStars();
  }

  function handleSave() {
    const titleField = schema.fields[0].key; // convention: first field is the "title"
    const titleVal = document.getElementById(`f_${titleField}`).value.trim();
    if (!titleVal) {
      document.getElementById(`f_${titleField}`).focus();
      return;
    }

    const entry = { id: uid(), createdAt: Date.now() };
    schema.fields.forEach(f => {
      const raw = document.getElementById(`f_${f.key}`).value.trim();
      if (f.type === "tags") {
        entry[f.key] = raw ? raw.split(",").map(s => s.trim()).filter(Boolean) : [];
      } else if (f.type === "number") {
        entry[f.key] = raw ? parseFloat(raw) : null;
      } else {
        entry[f.key] = raw;
      }
    });
    if (schema.statuses) entry.status = document.querySelector('input[name=status]:checked').value;
    if (schema.hasRating) entry.rating = currentRating;

    entries.unshift(entry);
    saveEntries(schema.storeKey, entries);
    resetForm();
    renderAll();
  }

  function deleteEntry(id) {
    entries = entries.filter(e => e.id !== id);
    saveEntries(schema.storeKey, entries);
    renderAll();
  }

  function cycleStatus(id) {
    if (!schema.statuses) return;
    const order = schema.statuses.map(s => s.value);
    const e = entries.find(x => x.id === id);
    e.status = order[(order.indexOf(e.status) + 1) % order.length];
    saveEntries(schema.storeKey, entries);
    renderAll();
  }

  function statusColor(value) {
    const s = schema.statuses && schema.statuses.find(s => s.value === value);
    return s ? s.color : "teal";
  }
  function statusLabel(value) {
    const s = schema.statuses && schema.statuses.find(s => s.value === value);
    return s ? s.label : value;
  }

  /* ---------- Filters / sort ---------- */
  function wireStaticControls() {
    document.getElementById("searchInput").addEventListener("input", renderAll);
    if (schema.statuses) {
      const sel = document.getElementById("statusFilter");
      sel.innerHTML = `<option value="all">All statuses</option>` +
        schema.statuses.map(s => `<option value="${s.value}">${s.label}</option>`).join("");
      sel.addEventListener("change", renderAll);
    } else {
      document.getElementById("statusFilterWrap").style.display = "none";
    }

    const sortSel = document.getElementById("sortSelect");
    let sortOpts = `<option value="dateDesc">Newest first</option><option value="dateAsc">Oldest first</option>`;
    if (schema.hasRating) sortOpts += `<option value="ratingDesc">Highest rated</option>`;
    if (schema.priceField) sortOpts += `<option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option>`;
    if (schema.dueField) sortOpts += `<option value="dueAsc">Due soonest</option>`;
    sortOpts += `<option value="titleAsc">Title A–Z</option>`;
    sortSel.innerHTML = sortOpts;
    sortSel.addEventListener("change", renderAll);

    document.getElementById("exportBtn").addEventListener("click", doExport);
    document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
    document.getElementById("importFile").addEventListener("change", doImport);
  }

  function allTagsInUse() {
    if (!schema.tagField) return [];
    const s = new Set();
    entries.forEach(e => (e[schema.tagField] || []).forEach(t => s.add(t)));
    return Array.from(s).sort();
  }

  function renderTagFilterRow() {
    const row = document.getElementById("tagFilterRow");
    if (!schema.tagField) { row.style.display = "none"; return; }
    const tags = allTagsInUse();
    row.innerHTML = "";
    tags.forEach(t => {
      const b = document.createElement("button");
      b.className = "chip" + (activeTagFilters.has(t) ? " active" : "");
      b.textContent = t;
      b.onclick = () => { activeTagFilters.has(t) ? activeTagFilters.delete(t) : activeTagFilters.add(t); renderAll(); };
      row.appendChild(b);
    });
    if (activeTagFilters.size) {
      const clear = document.createElement("button");
      clear.className = "chip";
      clear.textContent = "Clear ✕";
      clear.onclick = () => { activeTagFilters.clear(); renderAll(); };
      row.appendChild(clear);
    }
  }

  function getFiltered() {
    const q = document.getElementById("searchInput").value.trim().toLowerCase();
    const statusF = schema.statuses ? document.getElementById("statusFilter").value : "all";
    const sortV = document.getElementById("sortSelect").value;
    const titleField = schema.fields[0].key;
    const notesField = schema.fields.find(f => f.type === "textarea");

    let list = entries.filter(e => {
      if (schema.statuses && statusF !== "all" && e.status !== statusF) return false;
      if (schema.tagField && activeTagFilters.size && !(e[schema.tagField] || []).some(t => activeTagFilters.has(t))) return false;
      if (q) {
        const hay = (e[titleField] + " " + (notesField ? e[notesField.key] : "")).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortV === "dateDesc") return b.createdAt - a.createdAt;
      if (sortV === "dateAsc") return a.createdAt - b.createdAt;
      if (sortV === "ratingDesc") return (b.rating||0) - (a.rating||0);
      if (sortV === "priceAsc") return (a[schema.priceField]||0) - (b[schema.priceField]||0);
      if (sortV === "priceDesc") return (b[schema.priceField]||0) - (a[schema.priceField]||0);
      if (sortV === "dueAsc") {
        const da = a[schema.dueField] ? new Date(a[schema.dueField]) : new Date(8640000000000000);
        const db = b[schema.dueField] ? new Date(b[schema.dueField]) : new Date(8640000000000000);
        return da - db;
      }
      if (sortV === "titleAsc") return String(a[titleField]).localeCompare(String(b[titleField]));
      return 0;
    });
    return list;
  }

  function renderCard(e) {
    const titleField = schema.fields[0].key;
    const notesField = schema.fields.find(f => f.type === "textarea");
    const color = schema.statuses ? statusColor(e.status) : "teal";

    let metaBits = [];
    schema.fields.slice(1).forEach(f => {
      if (f.type === "tags" || f.type === "textarea" || !e[f.key]) return;
      metaBits.push(escapeHtml(e[f.key]));
    });

    let dueHtml = "";
    if (schema.dueField && e[schema.dueField]) {
      const d = daysUntil(e[schema.dueField]);
      let cls = "normal", label = e[schema.dueField];
      if (d !== null) {
        if (d < 0) { cls = "overdue"; label = `Overdue by ${Math.abs(d)}d — ${e[schema.dueField]}`; }
        else if (d <= 3) { cls = "soon"; label = `Due in ${d}d — ${e[schema.dueField]}`; }
        else { label = `Due ${e[schema.dueField]}`; }
      }
      dueHtml = `<div class="card-due ${cls}">${escapeHtml(label)}</div>`;
    }

    const priceHtml = schema.priceField && e[schema.priceField] != null && e[schema.priceField] !== ""
      ? `<div class="card-price">₦${Number(e[schema.priceField]).toLocaleString()}</div>` : "";

    const tagsHtml = schema.tagField && e[schema.tagField] && e[schema.tagField].length
      ? `<div class="card-tags">${e[schema.tagField].map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>` : "";

    const starsHtml = schema.hasRating
      ? `<div class="card-stars">${"★".repeat(e.rating||0)}${"☆".repeat(5-(e.rating||0))}</div>` : "";

    return `
      <div class="card c-${color}" data-id="${e.id}">
        <div class="card-top">
          <div class="card-title">${escapeHtml(e[titleField])}</div>
          ${starsHtml}
        </div>
        ${metaBits.length ? `<div class="card-meta">${metaBits.join(" · ")}</div>` : ""}
        ${schema.statuses ? `<div class="card-status-label" data-action="cycle">${statusLabel(e.status)} ↻</div>` : ""}
        ${priceHtml}
        ${dueHtml}
        ${tagsHtml}
        ${notesField && e[notesField.key] ? `<div class="card-notes">${escapeHtml(e[notesField.key])}</div>` : ""}
        <div class="card-actions">
          <button class="icon-btn" data-action="delete">Delete</button>
        </div>
      </div>`;
  }

  function renderShelf() {
    const shelf = document.getElementById("shelf");
    const list = getFiltered();
    document.getElementById("emptyState").style.display = entries.length === 0 ? "block" : "none";

    if (entries.length > 0 && list.length === 0) {
      shelf.innerHTML = `<div class="empty" style="grid-column:1/-1;">No matches — try clearing a filter.</div>`;
      return;
    }
    shelf.innerHTML = list.map(renderCard).join("");

    shelf.querySelectorAll('[data-action="cycle"]').forEach(el => {
      el.addEventListener("click", () => cycleStatus(el.closest(".card").dataset.id));
    });
    shelf.querySelectorAll('[data-action="delete"]').forEach(el => {
      el.addEventListener("click", () => {
        const card = el.closest(".card");
        const entry = entries.find(x => x.id === card.dataset.id);
        const titleField = schema.fields[0].key;
        if (confirm(`Remove "${entry[titleField]}"?`)) deleteEntry(card.dataset.id);
      });
    });
  }

  function renderStats() {
    const box = document.getElementById("stats");
    let html = `<div class="stat"><span class="num">${entries.length}</span><span class="lbl">Total</span></div>`;
    if (schema.statuses) {
      schema.statuses.forEach(s => {
        const n = entries.filter(e => e.status === s.value).length;
        html += `<div class="stat c-${s.color}"><span class="num">${n}</span><span class="lbl">${s.label}</span></div>`;
      });
    }
    if (schema.priceField) {
      const total = entries.reduce((sum, e) => sum + (Number(e[schema.priceField]) || 0), 0);
      html += `<div class="stat c-teal"><span class="num">₦${total.toLocaleString()}</span><span class="lbl">Total planned</span></div>`;
    }
    box.innerHTML = html;
  }

  function renderAll() {
    renderStats();
    renderTagFilterRow();
    renderShelf();
  }

  function doExport() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.storeKey}-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function doImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error("bad format");
        const merge = confirm(`Import ${imported.length} entries?\nOK = merge\nCancel = replace`);
        if (merge) {
          const existingIds = new Set(entries.map(x => x.id));
          imported.forEach(item => { if (!existingIds.has(item.id)) entries.push(item); });
        } else {
          entries = imported;
        }
        saveEntries(schema.storeKey, entries);
        renderAll();
      } catch (err) {
        alert("Could not read that file — make sure it's a JSON export from this tracker.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */
function initDashboard(configs) {
  renderSidebar("home");
  const grid = document.getElementById("dashGrid");
  grid.innerHTML = configs.map(cfg => {
    const entries = loadEntries(cfg.storeKey);
    let numHtml, detailHtml;
    if (cfg.priceField) {
      const total = entries.reduce((s, e) => s + (Number(e[cfg.priceField]) || 0), 0);
      numHtml = `₦${total.toLocaleString()}`;
      detailHtml = `${entries.length} item${entries.length===1?'':'s'} planned`;
    } else if (cfg.dueField) {
      const overdue = entries.filter(e => e[cfg.dueField] && daysUntil(e[cfg.dueField]) < 0 && e.status !== cfg.doneStatus).length;
      numHtml = entries.length;
      detailHtml = overdue > 0 ? `${overdue} overdue` : "on track";
    } else {
      numHtml = entries.length;
      const activeStatus = cfg.activeStatus;
      const activeCount = activeStatus ? entries.filter(e => e.status === activeStatus).length : null;
      detailHtml = activeCount !== null ? `${activeCount} ${cfg.activeLabel}` : `${entries.length} total`;
    }
    return `
      <a class="dash-card c-${cfg.color}" href="${cfg.href}">
        <div class="dc-title">${cfg.icon} ${cfg.label}</div>
        <div class="dc-num">${numHtml}</div>
        <div class="dc-detail">${detailHtml}</div>
      </a>`;
  }).join("");
}

/**
 * Columns visibility popover — show/hide columns.
 */
import { escapeHtml } from '../utils/dom.js';

export const columnsPopoverMethods = {
  _closeColumnsPopover() {
    const f = this._getFloating();
    const existing = f?.querySelector("[data-colspop]");
    if (existing) existing.remove();
  },

  _toggleColumnsPopover(anchorEl) {
    const f = this._getFloating();
    const existing = f?.querySelector("[data-colspop]");
    if (existing) { existing.remove(); return; }

    const rect = anchorEl.getBoundingClientRect();
    const x = rect.left;
    const y = rect.bottom + 6;

    const pop = document.createElement("div");
    pop.className = "colsPop";
    pop.setAttribute("data-colspop", "1");

    const cols = this.state.columns;
    const visibleCount = cols.filter(c => !this.state.colHidden[c.id]).length;
    pop.innerHTML = `
      <div class="cpopHeader">
        <div class="cpopTitle">
          <span class="cpopIcon">⚙</span>
          <span>Show / Hide Columns</span>
        </div>
        <button class="cpopClose" data-cols-close aria-label="Close">✕</button>
      </div>
      <div class="cpopMeta">${visibleCount} of ${cols.length} visible</div>
      <div class="cpopSearch">
        <span class="cpopSearchIcon">🔍</span>
        <input type="text" class="cpopSearchInput" placeholder="Search columns…" data-cols-search />
      </div>
      <div class="colsList" data-cols-list>
        ${cols.map(c => {
          const hidden = !!this.state.colHidden[c.id];
          const isRO = !!c.readOnly;
          return `
            <label class="colsItem" data-col-name="${escapeHtml(c.name.toLowerCase())}">
              <input type="checkbox" data-col-toggle value="${escapeHtml(c.id)}" ${hidden ? "" : "checked"} />
              <span class="colsToggle"></span>
              <span class="colsName">${escapeHtml(c.name)}</span>
              <span class="colsMeta ${isRO ? 'metaRO' : 'metaED'}">${isRO ? "Read Only" : "Editable"}</span>
            </label>
          `;
        }).join("")}
      </div>
      <div class="cpopActions">
        <button class="cpopBtn cpopBtnOutline" data-cols-showall>✔ Show All</button>
        <button class="cpopBtn cpopBtnGhost" data-cols-hideall>✖ Hide All</button>
      </div>
      <div class="cpopTip">💡 Tip: Hide columns you don't need to stay focused.</div>
    `;

    f.appendChild(pop);

    const pw = 360;
    const ph = 580;
    pop.style.left = `${Math.min(window.innerWidth - pw - 12, Math.max(8, x))}px`;
    pop.style.top = `${Math.min(window.innerHeight - ph - 12, Math.max(8, y))}px`;

    pop.addEventListener("mousedown", (e) => e.stopPropagation());

    // Close button
    pop.querySelector("[data-cols-close]")?.addEventListener("click", () => this._closeColumnsPopover());

    // Live search filter
    pop.querySelector("[data-cols-search]")?.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase().trim();
      pop.querySelectorAll(".colsItem").forEach(item => {
        const name = item.getAttribute("data-col-name") || "";
        item.style.display = name.includes(q) ? "" : "none";
      });
    });

    pop.querySelectorAll("[data-col-toggle]").forEach(ch => {
      ch.addEventListener("change", () => {
        const id = ch.value;
        const show = !!ch.checked;
        if (show) this._showColumn(id);
        else this._hideColumn(id);
        // update meta count
        const vis = cols.filter(c => !this.state.colHidden[c.id]).length;
        const metaEl = pop.querySelector(".cpopMeta");
        if (metaEl) metaEl.textContent = `${vis} of ${cols.length} visible`;
      });
    });

    pop.querySelector("[data-cols-showall]")?.addEventListener("click", () => {
      for (const c of this.state.columns) {
        delete this.state.colHidden[c.id];
      }
      this._recomputeView();
      this._renderGrid({ full: true });
      this._persistUiDebounced();
      this._closeColumnsPopover();
    });

    pop.querySelector("[data-cols-hideall]")?.addEventListener("click", () => {
      const visibleCols = this.state.columns;
      const keep = visibleCols[0]?.id;
      for (const c of this.state.columns) this.state.colHidden[c.id] = true;
      if (keep) delete this.state.colHidden[keep];
      this._recomputeView();
      this._renderGrid({ full: true });
      this._persistUiDebounced();
      this._closeColumnsPopover();
    });
  },
};

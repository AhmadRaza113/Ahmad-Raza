/**
 * Header context menu — sort, filter, auto-fit, hide column.
 */
import { escapeHtml } from '../utils/dom.js';

export const contextMenuMethods = {
  _getFloating() {
    return this.shadowRoot.querySelector("[data-floating]");
  },

  _closeCtxMenu() {
    const f = this._getFloating();
    const existing = f?.querySelector("[data-ctxmenu]");
    if (existing) existing.remove();
  },

  _openHeaderCtxMenu(colId, thEl) {
    this._closeCtxMenu();
    this._closeFilter();

    const col = this._colById(colId);
    if (!col) return;

    const rect = thEl.getBoundingClientRect();
    const x = rect.left;
    const y = rect.bottom + 6;

    const f = this._getFloating();
    const menu = document.createElement("div");
    menu.className = "ctxMenu";
    menu.setAttribute("data-ctxmenu", "1");

    const sortIdx = this.state.sorts.findIndex(s => s.colId === colId);
    const hasSort = sortIdx >= 0;

    menu.innerHTML = `
      <div class="ctxHead">${escapeHtml(col.name)}</div>
      <div class="ctxItem" data-act="sortAsc"><span class="ctxIcon">A</span> Sort A → Z</div>
      <div class="ctxItem" data-act="sortDesc"><span class="ctxIcon">Z</span> Sort Z → A</div>
      ${hasSort ? `<div class="ctxItem" data-act="clearSort"><span class="ctxIcon">S</span> Clear sort</div>` : ""}
      <div class="ctxSep"></div>
      <div class="ctxItem" data-act="filter"><span class="ctxIcon">F</span> Filter…</div>
      <div class="ctxItem" data-act="clearFilter"><span class="ctxIcon">C</span> Clear filter</div>
      <div class="ctxSep"></div>
      <div class="ctxItem" data-act="autofit"><span class="ctxIcon">↔</span> Auto-fit column</div>
      <div class="ctxItem" data-act="hideCol"><span class="ctxIcon">H</span> Hide column</div>
    `;

    f.appendChild(menu);

    const mw = 270;
    const mh = 330;
    menu.style.left = `${Math.min(window.innerWidth - mw, Math.max(8, x))}px`;
    menu.style.top = `${Math.min(window.innerHeight - mh, Math.max(8, y))}px`;

    menu.addEventListener("mousedown", (e) => e.stopPropagation());
    menu.addEventListener("click", (e) => {
      const item = e.target.closest("[data-act]");
      if (!item) return;
      const act = item.dataset.act;

      if (act === "sortAsc") { this.state.sorts = [{ colId, dir: "asc" }]; this._renderGrid({ full: true }); }
      if (act === "sortDesc") { this.state.sorts = [{ colId, dir: "desc" }]; this._renderGrid({ full: true }); }
      if (act === "clearSort") this._clearSort(colId);

      if (act === "filter") this._openFilterPopover(colId, menu.getBoundingClientRect());
      if (act === "clearFilter") {
        delete this.state.filters[colId];
        this._recomputeView();
        this._computeRowMeta();
        this._renderGrid({ full: true });
      }

      if (act === "autofit") this._autoFitSingleColumn(colId);
      if (act === "hideCol") this._hideColumn(colId);

      this._closeCtxMenu();
      this._persistUiDebounced();
    });
  },
};

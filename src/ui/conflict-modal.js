/**
 * Conflict resolution modal — shows "Your value" vs "Server value" with action buttons.
 */
import { escapeHtml } from '../utils/dom.js';

export const conflictModalMethods = {
  _openConflictModal(rowId, colId) {
    const key = `${rowId}|${colId}`;
    const c = this._conflicts.get(key);
    if (!c) return;

    this._closeConflictModal();

    const col = this._colById(colId);
    const f = this._getFloating();

    const back = document.createElement("div");
    back.className = "modalBackdrop";
    back.setAttribute("data-conflict-modal", "1");

    const modal = document.createElement("div");
    modal.className = "modal";

    modal.innerHTML = `
      <h3>Save conflict</h3>
      <div class="sub">
        Column: <b>${escapeHtml(col?.name || colId)}</b> — Server updated by <b>${escapeHtml(c.updatedBy || "someone")}</b>
        ${c.updatedAt ? `at <b>${escapeHtml(c.updatedAt)}</b>` : ""}.
      </div>

      <div class="grid">
        <div>
          <div class="sub" style="margin-top:10px;">Your value</div>
          <pre>${escapeHtml(c.mine ?? "")}</pre>
        </div>
        <div>
          <div class="sub" style="margin-top:10px;">Server value</div>
          <pre>${escapeHtml(c.server ?? "")}</pre>
        </div>
      </div>

      <div class="actions">
        <button class="btnPrimary" data-act="keep">Keep mine (overwrite)</button>
        <button data-act="accept">Accept server</button>
        <button class="btnDanger" data-act="close">Close</button>
      </div>
    `;

    back.appendChild(modal);
    f.appendChild(back);

    back.addEventListener("mousedown", (e) => { if (e.target === back) this._closeConflictModal(); });
    modal.addEventListener("mousedown", (e) => e.stopPropagation());

    modal.querySelector('[data-act="close"]')?.addEventListener("click", () => this._closeConflictModal());
    modal.querySelector('[data-act="accept"]')?.addEventListener("click", () => {
      this._conflicts.delete(key);
      this._closeConflictModal();
      this._renderGrid({ full: false });
      this._toast("Accepted server value.", { kind: "ok" });
    });

    modal.querySelector('[data-act="keep"]')?.addEventListener("click", async () => {
      const row = this.state.rows.find(r => r.id === rowId);
      if (row) row.values[colId] = c.mine;

      this._conflicts.delete(key);
      this._closeConflictModal();
      this._renderGrid({ full: false });

      await this._saveCellToServer(rowId, colId, c.mine);
      this._toast("Re-applied your value (saving).", { kind: "ok" });
    });
  },

  _closeConflictModal() {
    const f = this._getFloating();
    const el = f?.querySelector('[data-conflict-modal="1"]');
    if (el) el.remove();
  },
};

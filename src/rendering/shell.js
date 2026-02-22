/**
 * Shell rendering — initial Shadow DOM template (styles + toolbar + grid skeleton).
 */
import { GRID_STYLES } from '../styles/grid-styles.js';

export const shellMethods = {
  _renderShell() {
    this.shadowRoot.innerHTML = `
      <style>${GRID_STYLES}</style>
      <div class="wrap">
        <div class="toolbar">
          <div class="left">
            <button data-add-row>Add row</button>
            <button data-del-row>Delete selected rows</button>
            <button data-autofit-all>Auto-fit columns</button>
            <button data-cols>Columns</button>
          </div>
          <div class="right">
            <span class="pill" data-live>Live: —</span>
            <div class="search">
              <span style="font-size:12px;color:#64748b;font-weight:800">Search</span>
              <input data-search placeholder="Type to filter rows..." />
            </div>
            <span class="pill" data-status>Ready</span>
          </div>
        </div>

        <div class="gridWrap" data-gridwrap tabindex="0">
          <table data-table>
            <colgroup data-colgroup></colgroup>
            <thead data-thead></thead>
            <tbody data-tbody></tbody>
          </table>
        </div>
      </div>

      <div class="floating" data-floating></div>
      <div class="toasts" data-toasts></div>
    `;

    this.shadowRoot.querySelector("[data-add-row]")?.addEventListener("click", () => this._addRow());
    this.shadowRoot.querySelector("[data-del-row]")?.addEventListener("click", () => this._deleteSelectedRows());
    this.shadowRoot.querySelector("[data-autofit-all]")?.addEventListener("click", () => this._autoFitColumns());
    this.shadowRoot.querySelector("[data-cols]")?.addEventListener("click", (e) => this._toggleColumnsPopover(e.currentTarget));

    const search = this.shadowRoot.querySelector("[data-search]");
    if (search) {
      search.value = this.state.search || "";
      search.addEventListener("input", () => {
        this.state.search = search.value;
        this._recomputeView();
        this._computeRowMeta();
        this._renderGrid({ full: false });
        this._persistUiDebounced();
      });
    }
  },
};

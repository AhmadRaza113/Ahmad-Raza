/**
 * Table body rendering with virtualization — row headers, resize handles, editor wiring.
 */
export const bodyMethods = {
  _renderBody() {
    const tbody = this.shadowRoot.querySelector("[data-tbody]");
    if (!tbody) return;

    // Capture live editor value + cursor before re-render so it survives innerHTML rebuild
    if (this.state.editing) {
      const existingEditor = this.shadowRoot.querySelector("[data-inline-editor]");
      if (existingEditor) {
        this.state.editing._liveValue = existingEditor.value ?? "";
        this.state.editing._cursorPos = existingEditor.selectionStart ?? null;
      }
    }

    const colIds = this._view.viewColIds;
    const cols = colIds.map(id => this._colById(id));
    const totalRows = this._view.viewRowIds.length;

    if (totalRows === 0) {
      tbody.innerHTML = `<tr><td colspan="${1 + cols.length}" style="padding:16px;color:#64748b">No rows</td></tr>`;
      return;
    }

    const { start, end } = this._calcVirtRange();
    this._virt.start = start;
    this._virt.end = end;

    const topH = this._rowMeta.offsets[start] ?? 0;
    const bottomH = (this._rowMeta.total - (this._rowMeta.offsets[end + 1] ?? this._rowMeta.total)) ?? 0;

    const parts = [];

    if (this.config.virtualization && topH > 0) {
      parts.push(`<tr class="spacer"><td colspan="${1 + cols.length}" style="height:${topH}px"></td></tr>`);
    }

    for (let viewR = start; viewR <= end; viewR++) {
      const rowId = this._view.viewRowIds[viewR];
      const row = this._rowMap.get(rowId);
      const rowLabel = row?.values?.req_no ?? (viewR + 1);
      const h = this._rowMeta.heights[viewR] ?? this.config.defaultRowHeight;

      parts.push(`
        <tr data-rowid="${rowId}" style="height:${h}px">
          <th class="rowHead" data-rowhead="${viewR}" style="height:${h}px">
            <div class="rowHeadInner" title="Click to select row">
              <span class="reqNoLabel">${rowLabel}</span>
              <div class="resizeRow" data-resize-row="${rowId}" title="Resize row"></div>
            </div>
          </th>
          ${cols.map((c, viewC) => this._renderCell(row, c, viewR, viewC, h)).join("")}
        </tr>
      `);
    }

    if (this.config.virtualization && bottomH > 0) {
      parts.push(`<tr class="spacer"><td colspan="${1 + cols.length}" style="height:${bottomH}px"></td></tr>`);
    }

    tbody.innerHTML = parts.join("");

    tbody.querySelectorAll("[data-rowhead]").forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-resize-row]")) return;
        const viewR = Number(el.dataset.rowhead);
        this._selectRow(viewR, { shift: e.shiftKey });
      });
    });

    tbody.querySelectorAll("[data-resize-row]").forEach(hEl => {
      hEl.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rowId = hEl.dataset.resizeRow;
        const current = this.state.rowHeights[rowId] ?? this.config.defaultRowHeight;
        this._mouse.resizingRow = { rowId, startY: e.clientY, startH: current };
      });
    });

    this._wireInlineEditorIfAny();
  },
};

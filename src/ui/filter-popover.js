/**
 * Filter popover — text, range, blanks, values-list filter UI.
 */
import { escapeHtml } from '../utils/dom.js';
import { isBlank } from '../utils/helpers.js';
import { toDatetimeLocalValue, normalizeDatetimeLocalValue } from '../utils/datetime.js';
import { valueKeyForFilter, valueLabelForFilterKey } from '../utils/format.js';

export const filterPopoverMethods = {
  _closeFilter() {
    const f = this._getFloating();
    const existing = f?.querySelector("[data-filterpop]");
    if (existing) existing.remove();
  },

  _buildUniqueValuesForCol(colId, { limit = 250 } = {}) {
    const col = this._colById(colId);
    if (!col) return [];
    const map = new Map();
    for (const r of this.state.rows) {
      const vRaw = r.values?.[colId];
      const v = col.type === "datetime" ? toDatetimeLocalValue(vRaw) : (vRaw ?? "");
      const k = valueKeyForFilter(v);
      const label = valueLabelForFilterKey(k);
      map.set(k, { key: k, label, count: (map.get(k)?.count ?? 0) + 1 });
      if (map.size > limit) break;
    }
    const arr = [...map.values()];
    arr.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return arr;
  },

  _openFilterPopover(colId, anchorRect) {
    this._closeFilter();
    const col = this._colById(colId);
    if (!col) return;

    const f = this._getFloating();
    const pop = document.createElement("div");
    pop.className = "popover";
    pop.setAttribute("data-filterpop", "1");

    const existing = this.state.filters[colId] ?? { mode: "none" };
    const type = col.type;
    const canRange = (type === "number" || type === "datetime");
    const uniqueValues = this._buildUniqueValuesForCol(colId);
    const includeSet = new Set(existing.include ?? []);

    const modeOptions = [
      { id: "none", label: "None" },
      { id: "text", label: "Text" },
      ...(canRange ? [{ id: "range", label: type === "number" ? "Number range" : "Date/Time range" }] : []),
      { id: "blanks", label: "Blanks" },
      { id: "values", label: "Values list" },
    ];

    const mode = existing.mode ?? "none";

    pop.innerHTML = `
      <h4>Filter: ${escapeHtml(col.name)}</h4>

      <label>Mode</label>
      <select data-f-mode>
        ${modeOptions.map(o => `<option value="${o.id}" ${o.id === mode ? "selected" : ""}>${o.label}</option>`).join("")}
      </select>

      <div data-f-body></div>

      <div class="actions">
        <button data-f-apply>Apply</button>
        <button data-f-clear>Clear</button>
      </div>
      <div class="muted">Tip: Values list is the most spreadsheet-like filter.</div>
    `;

    f.appendChild(pop);

    const pw = 400;
    const ph = 520;
    const x = anchorRect?.left ?? (window.innerWidth / 2 - pw / 2);
    const y = (anchorRect?.bottom ?? 100) + 8;

    pop.style.left = `${Math.min(window.innerWidth - pw, Math.max(8, x))}px`;
    pop.style.top = `${Math.min(window.innerHeight - ph, Math.max(8, y))}px`;

    pop.addEventListener("mousedown", (e) => e.stopPropagation());

    const modeEl = pop.querySelector("[data-f-mode]");
    const body = pop.querySelector("[data-f-body]");

    const renderBody = () => {
      const m = modeEl.value;

      if (m === "none") {
        body.innerHTML = `<div class="muted">No filter applied.</div>`;
        return;
      }

      if (m === "text") {
        const op = existing.op ?? "contains";
        const val = existing.value ?? "";
        body.innerHTML = `
          <label>Operation</label>
          <select data-f-op>
            <option value="contains" ${op === "contains" ? "selected" : ""}>Contains</option>
            <option value="equals" ${op === "equals" ? "selected" : ""}>Equals</option>
            <option value="starts" ${op === "starts" ? "selected" : ""}>Starts with</option>
          </select>

          <label>Value</label>
          <input data-f-val value="${escapeHtml(val)}" placeholder="Type to filter..." />
        `;
        return;
      }

      if (m === "range") {
        if (type === "number") {
          const min = existing.min ?? "";
          const max = existing.max ?? "";
          body.innerHTML = `
            <div class="row">
              <div>
                <label>Min</label>
                <input data-f-min value="${escapeHtml(min)}" placeholder="e.g. 10" />
              </div>
              <div>
                <label>Max</label>
                <input data-f-max value="${escapeHtml(max)}" placeholder="e.g. 100" />
              </div>
            </div>
          `;
        } else {
          const from = existing.from ?? "";
          const to = existing.to ?? "";
          body.innerHTML = `
            <div class="row">
              <div>
                <label>From</label>
                <input data-f-from type="datetime-local" value="${escapeHtml(toDatetimeLocalValue(from))}" />
              </div>
              <div>
                <label>To</label>
                <input data-f-to type="datetime-local" value="${escapeHtml(toDatetimeLocalValue(to))}" />
              </div>
            </div>
          `;
        }
        return;
      }

      if (m === "blanks") {
        const blanks = !!existing.blanks;
        const nonblanks = !!existing.nonblanks;
        body.innerHTML = `
          <label>
            <input data-f-blanks type="checkbox" ${blanks ? "checked" : ""}/>
            Show blanks
          </label>
          <label style="margin-top:8px;">
            <input data-f-nonblanks type="checkbox" ${nonblanks ? "checked" : ""}/>
            Show non-blanks
          </label>
        `;
        return;
      }

      if (m === "values") {
        body.innerHTML = `
          <div class="valTools">
            <button type="button" data-f-all>Select all</button>
            <button type="button" data-f-none>Select none</button>
          </div>
          <div class="valList" data-f-list>
            ${uniqueValues.map(u => {
              const checked = includeSet.has(u.key);
              return `
                <div class="valItem">
                  <input type="checkbox" data-f-vchk value="${escapeHtml(u.key)}" ${checked ? "checked" : ""}/>
                  <span>${escapeHtml(u.label)}</span>
                  <span style="margin-left:auto;color:#64748b;font-size:11px;font-weight:900">${u.count}</span>
                </div>
              `;
            }).join("")}
          </div>
        `;
        body.querySelector("[data-f-all]")?.addEventListener("click", () => {
          body.querySelectorAll("[data-f-vchk]").forEach(ch => { ch.checked = true; });
        });
        body.querySelector("[data-f-none]")?.addEventListener("click", () => {
          body.querySelectorAll("[data-f-vchk]").forEach(ch => { ch.checked = false; });
        });
        return;
      }

      body.innerHTML = `<div class="muted">Unknown mode</div>`;
    };

    modeEl.addEventListener("change", () => renderBody());
    renderBody();

    pop.querySelector("[data-f-apply]")?.addEventListener("click", () => {
      const m = modeEl.value;
      const filter = { mode: m };

      if (m === "text") {
        filter.op = pop.querySelector("[data-f-op]")?.value ?? "contains";
        filter.value = pop.querySelector("[data-f-val]")?.value ?? "";
      } else if (m === "range") {
        if (type === "number") {
          filter.min = pop.querySelector("[data-f-min]")?.value ?? "";
          filter.max = pop.querySelector("[data-f-max]")?.value ?? "";
        } else {
          filter.from = normalizeDatetimeLocalValue(pop.querySelector("[data-f-from]")?.value ?? "");
          filter.to = normalizeDatetimeLocalValue(pop.querySelector("[data-f-to]")?.value ?? "");
        }
      } else if (m === "blanks") {
        filter.blanks = !!pop.querySelector("[data-f-blanks]")?.checked;
        filter.nonblanks = !!pop.querySelector("[data-f-nonblanks]")?.checked;
      } else if (m === "values") {
        const include = [];
        pop.querySelectorAll("[data-f-vchk]").forEach(ch => { if (ch.checked) include.push(ch.value); });
        filter.include = include;
      }

      if (m === "none") delete this.state.filters[colId];
      else this.state.filters[colId] = filter;

      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: true });
      this._persistUiDebounced();
      this._closeFilter();
    });

    pop.querySelector("[data-f-clear]")?.addEventListener("click", () => {
      delete this.state.filters[colId];
      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: true });
      this._persistUiDebounced();
      this._closeFilter();
    });
  },
};

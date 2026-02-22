// src/editing/inline-editor.js
// InlineEditor — activates contenteditable on a grid cell when the user
// double-clicks it, then calls onCommit when the edit is confirmed.
//
// Confirm : Enter key
// Cancel  : Escape key

export class InlineEditor {
  /**
   * @param {ShadowRoot} root
   * @param {{ onCommit: function({ rowId: string, colId: string, value: string }): void }} options
   */
  constructor(root, { onCommit }) {
    this._root     = root;
    this._onCommit = onCommit;
    this._active   = null; // { td, rowId, colId, original }
  }

  /**
   * Attaches event listeners to a <tbody> element.
   * Safe to call on every re-render — removes the previous listener first.
   *
   * @param {HTMLElement} tbody
   */
  attach(tbody) {
    tbody.removeEventListener('dblclick', this._onDblClick);
    tbody.addEventListener('dblclick', this._onDblClick);

    this._root.removeEventListener('keydown', this._onKeyDown);
    this._root.addEventListener('keydown', this._onKeyDown);
  }

  // ── Private ────────────────────────────────────────────────────────────

  _onDblClick = (ev) => {
    const td = ev.target.closest('td[data-row-id]');
    // tabindex="0" is only set on editable cells (see component._renderGrid)
    if (!td || !td.hasAttribute('tabindex')) return;
    this._startEdit(td);
  };

  _onKeyDown = (ev) => {
    if (!this._active) return;
    if (ev.key === 'Enter')  { ev.preventDefault(); this._commit(); }
    if (ev.key === 'Escape') { this._cancel(); }
  };

  _startEdit(td) {
    if (this._active) this._cancel();
    const rowId    = td.dataset.rowId;
    const colId    = td.dataset.colId;
    const original = td.textContent;

    td.dataset.editing  = '';
    td.contentEditable  = 'true';
    td.focus();

    this._active = { td, rowId, colId, original };
  }

  _commit() {
    if (!this._active) return;
    const { td, rowId, colId, original } = this._active;
    const value = td.textContent;

    td.contentEditable = 'false';
    delete td.dataset.editing;
    this._active = null;

    if (value !== original) {
      this._onCommit({ rowId, colId, value });
    }
  }

  _cancel() {
    if (!this._active) return;
    const { td, original } = this._active;
    td.textContent     = original;
    td.contentEditable = 'false';
    delete td.dataset.editing;
    this._active = null;
  }
}

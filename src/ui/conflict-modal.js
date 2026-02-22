// src/ui/conflict-modal.js
// ConflictModal — shows a server-vs-client value diff and lets the user pick
// which version to keep after a concurrent edit conflict is detected.
//
// Calls onResolve({ rowId, values, rowVer }) with the chosen value set.
// The caller is responsible for POSTing the resolution to the API.

export class ConflictModal {
  /**
   * @param {ShadowRoot} root
   * @param {{ onResolve: function({ rowId: string, values: object, rowVer: number }): void }} options
   */
  constructor(root, { onResolve }) {
    this._root     = root;
    this._onResolve = onResolve;
    this._el        = null;   // <dialog> element (lazily created)
    this._pending   = null;   // current conflict payload
  }

  /**
   * Opens the dialog for a detected conflict.
   *
   * @param {{
   *   rowId:        string,
   *   rowVer:       number,
   *   serverValues: object,
   *   clientValues: object,
   * }} conflict
   */
  show({ rowId, rowVer, serverValues, clientValues }) {
    this._pending = { rowId, rowVer, serverValues, clientValues };
    if (!this._el) this._mount();
    this._update();
    this._el.showModal();
  }

  // ── Private ────────────────────────────────────────────────────────────

  _mount() {
    this._el = document.createElement('dialog');
    this._el.className = 'conflict-modal';
    this._el.innerHTML = `
      <h3>Edit Conflict</h3>
      <p>Another user saved this row while you were editing. Choose which version to keep.</p>
      <div class="diff"></div>
      <menu>
        <button data-action="keep-server">Keep Server Version</button>
        <button data-action="keep-mine">Keep My Version</button>
      </menu>
    `;

    this._el.addEventListener('click', (ev) => {
      const btn = ev.target.closest('button[data-action]');
      if (!btn || !this._pending) return;

      const { rowId, rowVer, serverValues, clientValues } = this._pending;
      const values = btn.dataset.action === 'keep-mine' ? clientValues : serverValues;

      this._onResolve({ rowId, values, rowVer });
      this._el.close();
    });

    this._root.appendChild(this._el);
  }

  _update() {
    if (!this._pending || !this._el) return;
    const { serverValues, clientValues } = this._pending;

    const allKeys = new Set([
      ...Object.keys(serverValues),
      ...Object.keys(clientValues),
    ]);

    const rows = [...allKeys].map(key => {
      const sv   = serverValues[key]  ?? '';
      const cv   = clientValues[key] ?? '';
      const diff = sv !== cv ? ' class="changed"' : '';
      return `<tr${diff}><th>${key}</th><td>${sv}</td><td>${cv}</td></tr>`;
    });

    this._el.querySelector('.diff').innerHTML = `
      <table>
        <thead><tr><th>Column</th><th>Server</th><th>Yours</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    `;
  }
}

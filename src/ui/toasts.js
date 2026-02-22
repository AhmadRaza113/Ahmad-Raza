/**
 * Toast notification UI — ephemeral messages in the bottom-right corner.
 */
import { escapeHtml } from '../utils/dom.js';

export const toastMethods = {
  _showToast(message, { kind = "ok", detail = "", ms = 3600 } = {}) {
    const host = this.shadowRoot.querySelector("[data-toasts]");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.innerHTML = `
      <div class="t1">${escapeHtml(message)}</div>
      ${detail ? `<div class="t2">${escapeHtml(detail)}</div>` : ""}
    `;
    host.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch {} }, ms);
  },
};

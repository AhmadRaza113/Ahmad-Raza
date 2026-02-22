/**
 * Individual cell rendering — handles editor mode, locks, typing, conflicts.
 */
import { escapeHtml } from '../utils/dom.js';
import { toDatetimeLocalValue } from '../utils/datetime.js';
import { initialsFromUserId, displayNameFromUserId } from '../utils/format.js';
import { equalsCI } from '../utils/helpers.js';

export const cellMethods = {
  _renderCell(row, col, viewR, viewC, rowH) {
    const value = row?.values?.[col.id];
    const isEditing = this.state.editing && this.state.editing.r === viewR && this.state.editing.c === viewC;
    const canEdit = this._canEditCol(col);

    const cls = [];
    if (col.readOnly || this.readOnly) cls.push("readonlyCell");

    const key = `${row?.id}|${col.id}`;
    const lock = this._locks.get(key);
    const conflict = this._conflicts.get(key);
    const remoteType = this._remoteTyping.get(key);

    // Only show lock badge for OTHER users' locks
    const isLockedByOther = lock?.userId && lock.userId !== this.userId;
    const lockHtml = isLockedByOther
      ? `<div class="lockBadge other" title="Locked by ${escapeHtml(displayNameFromUserId(lock.userId))}">${escapeHtml(initialsFromUserId(lock.userId))}&nbsp;${escapeHtml(displayNameFromUserId(lock.userId))}<span class="typingDots"><span></span><span></span><span></span></span></div>`
      : "";

    // Typing badge — shown when another user is actively typing in this cell
    const isRemoteTyping = !!(remoteType && remoteType.userId !== this.userId);
    // Show typingBadge only if the cell is NOT already showing a lockBadge
    // (lockBadge already includes the name + dots). If there's no lock yet
    // (race between typing event and lock event), still show who is typing.
    const typingBadge = (isRemoteTyping && !isLockedByOther)
      ? `<div class="typingBadge" title="${escapeHtml(displayNameFromUserId(remoteType.userId))} is typing">` +
        `${escapeHtml(initialsFromUserId(remoteType.userId))}&nbsp;${escapeHtml(displayNameFromUserId(remoteType.userId))}` +
        `<span class="typingDots"><span></span><span></span><span></span></span></div>`
      : "";

    const conflictClass = conflict ? "conflict" : "";
    const lockedOtherClass = isLockedByOther ? "lockedByOther" : "";
    const remoteTypingClass = isRemoteTyping ? "remoteTyping" : "";

    const tdClasses = [conflictClass, lockedOtherClass, remoteTypingClass].filter(Boolean).join(" ");

    if (isEditing && canEdit) {
      // Use captured live value if editor was rebuilt by a re-render
      const draft = (this.state.editing._liveValue != null)
        ? this.state.editing._liveValue
        : this._formatValue(col, value);

      let editorHtml = "";
      if (col.type === "datetime") {
        editorHtml = `<input class="editorInput" data-inline-editor type="datetime-local" value="${escapeHtml(toDatetimeLocalValue(draft))}" />`;
      } else if (col.type === "number") {
        editorHtml = `<input class="editorInput" data-inline-editor type="text" inputmode="decimal" value="${escapeHtml(draft)}" />`;
      } else if ((col.type === "choice" || col.type === "person") && Array.isArray(col.options)) {
        editorHtml = `
          <select class="editorSelect" data-inline-editor>
            ${col.options.map(o => {
              const s = String(o);
              const sel = equalsCI(s, draft) ? "selected" : "";
              return `<option ${sel} value="${escapeHtml(s)}">${escapeHtml(s)}</option>`;
            }).join("")}
          </select>
        `;
      } else if (col.type === "multiline") {
        editorHtml = `<textarea class="editorTextarea" data-inline-editor>${escapeHtml(draft)}</textarea>`;
      } else {
        editorHtml = `<input class="editorInput" data-inline-editor type="text" value="${escapeHtml(draft)}" />`;
      }

      const lockPendingCls = this._startEditInFlight ? " lockPending" : "";
      return `
        <td class="${tdClasses}" style="height:${rowH}px" data-r="${viewR}" data-c="${viewC}" data-rowid="${row.id}" data-colid="${col.id}">
          <div class="cell editorFrame${lockPendingCls} ${cls.join(" ")}" data-type="${col.type}">
            ${editorHtml}
          </div>
        </td>
      `;
    }

    // Show remote typing content if another user is typing in this cell
    const hasRemoteTyping = remoteType && remoteType.userId !== this.userId;
    const displayText = hasRemoteTyping ? remoteType.value : this._formatValue(col, value);
    const arrow = (canEdit && !isLockedByOther && (col.type === "choice" || col.type === "person" || col.type === "datetime"))
      ? `<span class="cellArrow">▾</span>` : "";

    return `
      <td class="${tdClasses}" style="height:${rowH}px" data-r="${viewR}" data-c="${viewC}" data-rowid="${row?.id}" data-colid="${col.id}">
        <div class="cell ${cls.join(" ")}" data-type="${col.type}">
          ${escapeHtml(displayText)}
          ${arrow}
          ${lockHtml}
          ${typingBadge}
        </div>
      </td>
    `;
  },
};

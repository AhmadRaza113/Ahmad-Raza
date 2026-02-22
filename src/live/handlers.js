/**
 * SignalR event handlers for live patches, row changes, lock changes, and typing.
 */
export const liveHandlerMethods = {
  _onGridPatch(msg) {
    try {
      if (!msg || Number(msg.clientId) !== this.clientId) return;
      const { rowId, colId, value, rowVer, updatedAt, updatedBy } = msg;

      // Ignore self-broadcasted patches — but still apply the confirmed value
      if (updatedBy === this.userId) {
        const row = this._rowMap.get(rowId);
        if (row) {
          row.values[colId] = value; // apply server-confirmed value
          row.rowVer = rowVer;
          row.updatedAt = updatedAt;
          row.updatedBy = updatedBy;
        }
        this._rowVer.set(rowId, rowVer);
        return;
      }

      const key = `${rowId}|${colId}`;

      // If we have pending changes for this cell, treat as conflict
      if (this._pending.has(key)) {
        const mine = this._pending.get(key)?.value;
        this._pending.delete(key);

        this._conflicts.set(key, {
          rowId, colId,
          mine,
          server: value,
          updatedAt,
          updatedBy,
          currentRowVer: rowVer,
        });
      }

      // If user is currently editing the same cell, do not override the input
      const isEditingSame = this.state.editing && this.state.editing.rowId === rowId && this.state.editing.colId === colId;

      const row = this._rowMap.get(rowId);
      if (row) {
        if (!isEditingSame) row.values[colId] = value;
        row.rowVer = rowVer;
        row.updatedAt = updatedAt;
        row.updatedBy = updatedBy;
      }
      this._rowVer.set(rowId, rowVer);

      // A gridPatch means the value is now committed — cancel any pending
      // delayed-clear timer so it doesn't fire an unnecessary DB re-fetch.
      const clearTimer = this._typingClearTimers?.get(key);
      if (clearTimer) {
        clearTimeout(clearTimer);
        this._typingClearTimers.delete(key);
      }

      // Clear the remote-typing preview: the authoritative saved value is in `value`.
      this._remoteTyping.delete(key);

      this._recomputeView();
      // _computeRowMeta not needed for a cell-value patch — row heights are unchanged

      // If we are currently editing, do a targeted cell update for the patched
      // cell instead of a full re-render that would destroy our editor.
      if (this.state.editing) {
        const td = this.shadowRoot.querySelector(
          `td[data-rowid="${rowId}"][data-colid="${colId}"]`
        );
        if (td && !td.querySelector("[data-inline-editor]")) {
          const cellDiv = td.querySelector(".cell");
          const col = this._colById(colId);
          const row = this._rowMap.get(rowId);
          if (cellDiv && col && row) {
            cellDiv.childNodes[0].textContent = this._formatValue(col, row.values?.[colId]);
            // Remove typing/lock badges since the value is now committed
            cellDiv.querySelector(".typingBadge")?.remove();
            td.classList.remove("remoteTyping");
          }
        }
        return;
      }

      this._renderGrid({ full: false, persist: false });
    } catch (e) {
      console.error("gridPatch error", e);
    }
  },

  _onGridRowAdded(msg) {
    try {
      if (!msg || Number(msg.clientId) !== this.clientId) return;
      const row = msg.row;
      if (!row?.id) return;

      if (this.state.rows.some(r => r.id === row.id)) return;
      this.state.rows.unshift({
        id: row.id,
        clientId: row.clientId,
        rowVer: row.rowVer,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        values: {
          ...(row.values || {}),
          ...(row.reqNo != null ? { req_no: row.reqNo } : {}),
        },
      });
      this._rowVer.set(row.id, row.rowVer);
      this._syncRowMap();

      this.state.rowOrder = [row.id, ...this.state.rowOrder.filter(id => id !== row.id)];

      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: true, persist: false });
      this._toast("Row added (live).", { kind: "ok" });
    } catch (e) { console.error(e); }
  },

  _onGridRowsDeleted(msg) {
    try {
      if (!msg || Number(msg.clientId) !== this.clientId) return;
      const ids = new Set(msg.rowIds || []);
      if (!ids.size) return;

      this.state.rows = this.state.rows.filter(r => !ids.has(r.id));
      this._syncRowMap();
      this.state.rowOrder = this.state.rowOrder.filter(id => !ids.has(id));
      for (const id of ids) this._rowVer.delete(id);

      for (const k of [...this._pending.keys()]) if (ids.has(k.split("|")[0])) this._pending.delete(k);
      for (const k of [...this._conflicts.keys()]) if (ids.has(k.split("|")[0])) this._conflicts.delete(k);
      for (const k of [...this._locks.keys()]) if (ids.has(k.split("|")[0])) this._locks.delete(k);

      this._recomputeView();
      this._computeRowMeta();
      this._renderGrid({ full: true, persist: false });
      this._toast("Rows deleted (live).", { kind: "ok" });
    } catch (e) { console.error(e); }
  },

  _onGridLockChanged(msg) {
    try {
      if (!msg || Number(msg.clientId) !== this.clientId) return;
      const { rowId, colId, locked, holder } = msg;
      const key = `${rowId}|${colId}`;

      // If we are currently editing this cell and this is our own lock event,
      // just update the map — do NOT re-render, because _renderBody() would
      // destroy the active editor DOM element and kill the editing session.
      const isEditingSame = this.state.editing
        && this.state.editing.rowId === rowId
        && this.state.editing.colId === colId;

      if (locked && holder?.userId) {
        const isOwn = holder.userId === this.userId;
        this._locks.set(key, { ...holder, owned: isOwn });
        if (isEditingSame && isOwn) return; // skip re-render for own lock on editing cell
      } else {
        this._locks.delete(key);
        this._remoteTyping.delete(key);
        if (isEditingSame) return; // lock released while editing — don't nuke editor
      }
      this._renderBody();
      this._updateSelectionClasses();
      this._attachFillHandle();
    } catch (e) { console.error(e); }
  },

  _onGridTyping(msg) {
    try {
      if (!msg || Number(msg.clientId) !== this.clientId) return;
      // Ignore self-broadcasted typing events
      if (msg.userId === this.userId) return;

      const key = `${msg.rowId}|${msg.colId}`;

      if (msg.value != null && msg.value !== "") {
        // ── Active typing ────────────────────────────────────────────────────
        // User resumed typing — cancel any pending delayed-clear timer so we
        // don't accidentally wipe the preview mid-keystroke.
        const pendingClear = this._typingClearTimers?.get(key);
        if (pendingClear) {
          clearTimeout(pendingClear);
          this._typingClearTimers.delete(key);
        }

        this._remoteTyping.set(key, {
          userId: msg.userId,
          value: msg.value,
          timestamp: Date.now(),
        });

        // ── Targeted render when we are editing another cell ─────────────────
        if (this.state.editing) {
          const td = this.shadowRoot.querySelector(
            `td[data-rowid="${msg.rowId}"][data-colid="${msg.colId}"]`
          );
          if (td) {
            const cellDiv = td.querySelector(".cell");
            if (cellDiv && !td.querySelector("[data-inline-editor]")) {
              const typing = this._remoteTyping.get(key);
              cellDiv.childNodes[0].textContent = typing?.value ?? "";
              td.classList.add("remoteTyping");
              let badge = cellDiv.querySelector(".typingBadge");
              if (typing && !this._locks.has(key)) {
                if (!badge) {
                  badge = document.createElement("div");
                  badge.className = "typingBadge";
                  cellDiv.appendChild(badge);
                }
                const initials = typing.userId.split("@")[0].split(/[^a-zA-Z0-9]+/).filter(Boolean)
                  .map((p, i, a) => a.length >= 2 && i === 0 ? p[0].toUpperCase() : (i === 1 ? p[0].toUpperCase() : "")).join("") ||
                  typing.userId.slice(0, 2).toUpperCase();
                const displayName = typing.userId.split("@")[0].split(/[^a-zA-Z0-9]+/).filter(Boolean)
                  .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
                badge.innerHTML = `${initials}&nbsp;${displayName}<span class="typingDots"><span></span><span></span><span></span></span>`;
              } else if (badge) {
                badge.remove();
              }
            }
          }
          return;
        }

        this._renderBody();
        this._updateSelectionClasses();
        this._attachFillHandle();

      } else {
        // ── Typing cleared (user saved or cancelled) ─────────────────────────
        //
        // Strategy: keep showing the last-streamed value for 450 ms so there is
        // no flash-of-old-value while we wait for gridPatch to arrive.
        // If gridPatch arrives within that window it cancels this timer and
        // applies the authoritative value itself (zero extra requests).
        // If gridPatch never arrives (Azure Function not broadcasting to all
        // connections, message lost, etc.) the timer fires and fetches the
        // row directly from the DB so the saved value always appears.
        //
        // Cancel any previous clear timer for this key.
        const existing = this._typingClearTimers?.get(key);
        if (existing) clearTimeout(existing);

        const rowId  = msg.rowId;
        const colId  = msg.colId;
        const timer  = setTimeout(async () => {
          this._typingClearTimers?.delete(key);

          // Fetch the authoritative committed value directly from the DB.
          // Inlined here so this handler is self-contained and does not depend
          // on _refreshSingleRow being available (avoids ES-module cache races).
          try {
            const json = await this._api(
              `/api/auditorRequests?clientId=${encodeURIComponent(this.clientId)}&rowId=${encodeURIComponent(rowId)}`
            );
            if (json?.ok) {
              const rows = Array.isArray(json.rows) ? json.rows : [];
              const fresh = rows.find(r => r.id === rowId);
              const existing = this._rowMap.get(rowId);
              if (fresh && existing) {
                const freshVer = Number(fresh.rowVer ?? 0);
                const curVer   = Number(existing.rowVer ?? -1);
                // Apply if fresh is strictly newer, OR if versions are non-numeric
                // (NaN > NaN = false, but !(NaN <= NaN) = true — safe fallback).
                if (!(freshVer <= curVer)) {
                  existing.values = {
                    ...(fresh.values || {}),
                    ...(fresh.reqNo != null ? { req_no: fresh.reqNo } : {}),
                  };
                  existing.rowVer    = fresh.rowVer;
                  existing.updatedAt = fresh.updatedAt;
                  existing.updatedBy = fresh.updatedBy;
                  this._rowVer.set(rowId, fresh.rowVer);
                }
              }
            }
          } catch { /* non-critical — gridPatch may still arrive */ }

          // Now clear the typing preview — row.values has the saved value.
          this._remoteTyping.delete(key);

          // Re-render: targeted when we are editing, full otherwise.
          this._recomputeView();
          if (this.state.editing) {
            const td = this.shadowRoot.querySelector(
              `td[data-rowid="${rowId}"][data-colid="${colId}"]`
            );
            if (td && !td.querySelector("[data-inline-editor]")) {
              const cellDiv = td.querySelector(".cell");
              const col = this._colById(colId);
              const row = this._rowMap.get(rowId);
              if (cellDiv && col && row) {
                cellDiv.childNodes[0].textContent = this._formatValue(col, row.values?.[colId]);
                cellDiv.querySelector(".typingBadge")?.remove();
                td.classList.remove("remoteTyping");
              }
            }
          } else {
            this._renderBody();
            this._updateSelectionClasses();
            this._attachFillHandle();
          }
        }, 450);

        this._typingClearTimers?.set(key, timer);
        // Do NOT re-render here — keep showing the last typed value during the
        // 450 ms window so the cell changes once (to the saved value) not twice.
      }
    } catch (e) { console.error("gridTyping error", e); }
  },
};

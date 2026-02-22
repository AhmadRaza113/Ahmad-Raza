/**
 * All CSS styles for the <sheet-grid> Shadow DOM.
 * Exported as a plain string — injected into the shadow root via <style>.
 */
export const GRID_STYLES = `
  :host { display:block; font-family: Segoe UI, Arial, sans-serif; color:#0f172a; }
  .wrap { position:relative; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; background:#fff; }

  .toolbar {
    display:flex; gap:10px; align-items:center; padding:10px 12px;
    background:linear-gradient(180deg, #f8fafc, #f1f5f9);
    border-bottom:1px solid #e2e8f0;
    flex-wrap:wrap;
  }
  .toolbar .left { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .toolbar .right { margin-left:auto; display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  button {
    border:1px solid #cbd5e1; background:#fff; border-radius:10px;
    padding:8px 10px; font-weight:700; cursor:pointer;
  }
  button:disabled { opacity:.5; cursor:not-allowed; }

  .pill { font-size:12px; padding:5px 10px; border-radius:999px; background:#e2e8f0; color:#334155; font-weight:900; border:1px solid #e2e8f0; }

  .search {
    display:flex; align-items:center; gap:8px;
    border:1px solid #cbd5e1; background:#fff; border-radius:10px; padding:6px 10px;
    min-width:260px;
  }
  .search input { border:none; outline:none; width:100%; font-size:13px; }

  .gridWrap {
    position:relative;
    height:560px;
    overflow:auto;
    outline:none;
    user-select:none; -webkit-user-select:none;
    background:#fff;
  }

  table { border-collapse:separate; border-spacing:0; table-layout:fixed; width:100%; }
  thead th {
    position:sticky; top:0; z-index:5;
    background:#f8fafc;
    border-bottom:1px solid #e2e8f0;
    padding:0;
    height:46px;
  }
  thead th .thInner {
    position:relative;
    display:flex; align-items:flex-start; gap:8px;
    height:46px;
    padding:8px 10px;
    border-right:1px solid #e2e8f0;
    user-select:none;
    cursor:default;
  }
  .thInner.clickable { cursor:pointer; }
  .thLabel{
    font-weight:900;
    font-size:12px;
    line-height:14px;
    white-space:normal;
    word-break:break-word;
    overflow:hidden;
    max-height:30px;
  }
  .badge {
    margin-left:6px;
    font-size:10px;
    font-weight:900;
    color:#0f172a;
    background:#e2e8f0;
    padding:2px 6px;
    border-radius:999px;
  }

  tbody td, tbody th {
    border-bottom:1px solid #eef2f7;
    border-right:1px solid #eef2f7;
    padding:0;
    height:auto;
    background:#fff;
    font-size:13px;
    vertical-align:top;
  }
  tbody td { cursor:cell; }
  tbody tr:hover td { background:#fafcff; }

  .rowHead, .corner {
    position:sticky; left:0; z-index:4;
    background:#f8fafc;
    border-right:1px solid #e2e8f0;
    text-align:center;
    font-size:12px; color:#475569;
    width:52px;
    user-select:none;
    padding:0;
    overflow:visible;
  }
  .corner { top:0; z-index:6; border-bottom:1px solid #e2e8f0; cursor:pointer; }

  .rowHeadInner {
    position:relative;
    height:100%;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
  }
  .reqNoLabel {
    font-size:11px;
    font-weight:800;
    color:#334155;
    letter-spacing:0.3px;
    overflow:hidden;
    text-overflow:ellipsis;
    white-space:nowrap;
    max-width:64px;
    text-align:center;
  }

  td { position:relative; }
  .cell {
    position:relative;
    box-sizing:border-box;
    width:100%;
    height:100%;
    min-height:100%;
    padding:6px 28px 6px 8px;
    overflow:hidden;
    white-space:pre-wrap;
    word-break:break-word;
    line-height:16px;
    background:transparent;
  }

  .readonlyCell { background:#f8fafc; color:#334155; }
  .cellMeta {
    position:absolute; left:8px; bottom:4px;
    font-size:10px; color:#94a3b8; font-weight:800;
    pointer-events:none;
  }

  td.active > .cell { box-shadow: inset 0 0 0 2px #2563eb; background:#eff6ff !important; }
  td.range > .cell { background:#e0f2fe !important; }
  td.anchor > .cell { box-shadow: inset 0 0 0 2px #0284c7; }
  td.fillPreview > .cell { box-shadow: inset 0 0 0 2px #2563eb; background:rgba(37,99,235,.08) !important; }

  td.conflict > .cell { box-shadow: inset 0 0 0 2px #ef4444; background: rgba(239,68,68,.08) !important; }

  .resizeCol { position:absolute; right:0; top:0; width:12px; height:46px; cursor:col-resize; }
  .resizeCol:hover { background:rgba(37,99,235,.08); }

  .resizeRow {
    position:absolute; left:0; right:0; bottom:-5px;
    height:10px; cursor:row-resize; background:transparent;
  }
  .rowHead:hover .resizeRow { background:rgba(37,99,235,.06); }

  .dragHandle {
    width:16px; height:16px;
    border-radius:6px;
    background:#e2e8f0;
    color:#334155;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:10px;
    font-weight:900;
    cursor:grab;
    flex:0 0 auto;
    margin-top:1px;
    touch-action:none;
  }
  .dragHandle:active { cursor:grabbing; }

  .sortBadge { margin-left:auto; font-size:11px; font-weight:900; color:#0f172a; background:#e2e8f0; padding:2px 6px; border-radius:999px; }

  .editorFrame { box-sizing:border-box; width:100%; height:100%; padding:0; background:#ffffff; box-shadow: inset 0 0 0 2px #2563eb; }
  .editorFrame.lockPending { animation: lockPendingPulse 0.55s ease-in-out infinite alternate; }
  @keyframes lockPendingPulse {
    from { box-shadow: inset 0 0 0 2px #93c5fd; }
    to   { box-shadow: inset 0 0 0 2px #2563eb; }
  }
  .editorInput, .editorSelect, .editorTextarea {
    display:block;
    width:100%;
    height:100%;
    box-sizing:border-box;
    border:none;
    outline:none;
    background:transparent;
    font: inherit;
    padding:6px 8px;
    margin:0;
  }
  .editorTextarea { resize:none; white-space:pre-wrap; line-height:16px; }

  .cellArrow {
    position:absolute;
    right:8px;
    top:50%;
    transform:translateY(-50%);
    font-size:11px;
    color:#64748b;
    pointer-events:none;
  }

  .fillHandle {
    position:absolute;
    width:8px;
    height:8px;
    right:-4px;
    bottom:-4px;
    background:#2563eb;
    border:2px solid #ffffff;
    border-radius:3px;
    cursor:crosshair;
    z-index:20;
  }

  .lockBadge {
    position:absolute;
    top:4px;
    right:6px;
    height:20px;
    padding:0 6px;
    border-radius:999px;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:4px;
    font-size:10px;
    font-weight:800;
    border:1px solid rgba(148,163,184,.5);
    background: rgba(248,250,252,.92);
    color:#0f172a;
    pointer-events:none;
    box-shadow:0 4px 12px rgba(0,0,0,.08);
    white-space:nowrap;
    z-index:3;
  }
  .lockBadge.owned { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.35); color:#166534; }
  .lockBadge.other { background: #dc2626; border-color: #dc2626; color:#fff; }

  /* Remote typing indicator — Excel-style: solid colored border + faint tint */
  td.remoteTyping > .cell {
    background: rgba(220,252,231,.40) !important;
    box-shadow: inset 0 0 0 2px #16a34a;
  }

  /* Cell locked by another user — non-editable, visual cue.
     Declared AFTER remoteTyping so it wins when both classes are present. */
  td.lockedByOther { pointer-events: none; }
  td.lockedByOther > .cell {
    background: rgba(241,245,249,.85) !important;
    cursor: not-allowed !important;
    box-shadow: inset 0 0 0 2px #dc2626 !important;
  }

  /* Typing-person badge (shown for cells with remote typing but no lock yet) */
  /* Sits inside .cell top-left — mirrors the lockBadge on the right. */
  .typingBadge {
    position:absolute;
    top:3px;
    left:4px;
    height:18px;
    padding:0 6px;
    border-radius:999px;
    display:flex;
    align-items:center;
    justify-content:center;
    gap:4px;
    font-size:10px;
    font-weight:800;
    background: #16a34a;
    color:#ffffff;
    pointer-events:none;
    white-space:nowrap;
    z-index:4;
    letter-spacing:0.3px;
    max-width:calc(100% - 12px);
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .typingDots {
    display:inline-flex; gap:2px; align-items:center; margin-left:2px;
  }
  .typingDots span {
    width:4px; height:4px; border-radius:50%;
    background:currentColor; opacity:.5;
    animation: typeDot .9s ease-in-out infinite;
  }
  .typingDots span:nth-child(2) { animation-delay: .15s; }
  .typingDots span:nth-child(3) { animation-delay: .3s; }
  @keyframes typeDot {
    0%,80%,100% { opacity:.3; transform:scale(.8); }
    40% { opacity:1; transform:scale(1.15); }
  }

  .colDragGhost {
    position:fixed; z-index:2000;
    background:#fff; border:1px solid #cbd5e1;
    border-radius:10px; padding:8px 10px;
    box-shadow:0 20px 40px rgba(0,0,0,.18);
    font-weight:900; font-size:12px; pointer-events:none;
    transform:translate(-50%, -50%);
  }
  th.colDropTarget { outline:2px dashed #2563eb; outline-offset:-2px; }

  .floating { position:fixed; inset:0; pointer-events:none; z-index:1000; }
  .floating > * { pointer-events:auto; }

  .ctxMenu {
    position:fixed;
    min-width:260px;
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:12px;
    box-shadow:0 22px 50px rgba(0,0,0,.18);
    padding:6px;
  }
  .ctxHead {
    padding:10px 10px 8px;
    font-size:12px;
    font-weight:900;
    color:#334155;
    border-bottom:1px solid #eef2f7;
    margin-bottom:6px;
  }
  .ctxItem {
    display:flex; align-items:center; gap:10px;
    padding:10px 10px;
    border-radius:10px;
    cursor:pointer;
    font-size:13px;
  }
  .ctxItem:hover { background:#f8fafc; }
  .ctxIcon {
    width:18px; height:18px; border-radius:6px;
    background:#e2e8f0; color:#0f172a;
    display:inline-flex; align-items:center; justify-content:center;
    font-size:11px; font-weight:900;
  }
  .ctxSep { height:1px; background:#eef2f7; margin:6px 6px; }

  /* Generic popover (filter, etc.) */
  .popover {
    position:fixed;
    width:380px;
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:12px;
    box-shadow:0 22px 50px rgba(0,0,0,.18);
    padding:12px;
  }
  .popover h4 { margin:0 0 10px 0; font-size:13px; }
  .popover label { font-size:12px; color:#475569; display:block; margin-top:10px; font-weight:800; }
  .popover select, .popover input {
    width:100%; margin-top:6px;
    border:1px solid #cbd5e1; border-radius:10px; padding:8px 10px; outline:none;
    font-size:13px;
  }
  .popover .row { display:flex; gap:10px; }
  .popover .row > * { flex:1; }
  .popover .actions { display:flex; gap:8px; margin-top:12px; }
  .popover .actions button { flex:1; }
  .muted { color:#64748b; font-size:12px; margin-top:6px; }

  /* ── Columns Show/Hide Popover ── */
  .colsPop {
    position:fixed;
    width:340px;
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:16px;
    box-shadow:0 24px 60px rgba(0,0,0,.18), 0 4px 16px rgba(0,0,0,.08);
    display:flex;
    flex-direction:column;
    overflow:hidden;
  }
  .cpopHeader {
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:14px 14px 12px;
    border-bottom:1px solid #f1f5f9;
    background:linear-gradient(180deg,#f8fafc,#fff);
    flex-shrink:0;
  }
  .cpopTitle {
    display:flex;
    align-items:center;
    gap:8px;
    font-size:13px;
    font-weight:900;
    color:#0f172a;
    letter-spacing:0.2px;
  }
  .cpopIcon {
    width:28px; height:28px;
    border-radius:8px;
    background:#e2e8f0;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    font-size:14px;
    flex-shrink:0;
  }
  .cpopClose {
    width:28px; height:28px;
    border-radius:8px;
    background:transparent;
    border:none;
    font-size:14px;
    color:#64748b;
    display:flex;
    align-items:center;
    justify-content:center;
    cursor:pointer;
    padding:0;
    transition:background .15s,color .15s;
  }
  .cpopClose:hover { background:#fee2e2; color:#dc2626; }
  .cpopMeta {
    padding:6px 14px;
    font-size:11px;
    font-weight:800;
    color:#64748b;
    background:#f8fafc;
    border-bottom:1px solid #f1f5f9;
    flex-shrink:0;
    letter-spacing:0.2px;
  }
  .cpopSearch {
    display:flex;
    align-items:center;
    gap:8px;
    margin:10px 12px 6px;
    padding:8px 10px;
    border:1px solid #e2e8f0;
    border-radius:10px;
    background:#f8fafc;
    flex-shrink:0;
  }
  .cpopSearchIcon { font-size:13px; opacity:.6; flex-shrink:0; }
  .cpopSearchInput {
    border:none;
    outline:none;
    background:transparent;
    font-size:13px;
    width:100%;
    color:#0f172a;
  }
  .cpopSearchInput::placeholder { color:#94a3b8; }

  .valTools { display:flex; gap:8px; align-items:center; margin-top:8px; }
  .valTools button { padding:6px 8px; border-radius:8px; }
  .valList { margin-top:8px; max-height:240px; overflow:auto; border:1px solid #eef2f7; border-radius:10px; padding:6px; }
  .valItem { display:flex; align-items:center; gap:10px; padding:6px 6px; border-radius:8px; }
  .valItem:hover { background:#f8fafc; }
  .valItem span { font-size:13px; color:#0f172a; }

  .colsList {
    flex:1;
    overflow-y:auto;
    margin:0 12px;
    border:1px solid #eef2f7;
    border-radius:12px;
    padding:4px;
    max-height:310px;
  }
  .colsList::-webkit-scrollbar { width:4px; }
  .colsList::-webkit-scrollbar-track { background:transparent; }
  .colsList::-webkit-scrollbar-thumb { background:#e2e8f0; border-radius:4px; }
  .colsItem {
    display:flex;
    align-items:center;
    gap:10px;
    padding:9px 10px;
    border-radius:8px;
    cursor:pointer;
    transition:background .12s;
    user-select:none;
  }
  .colsItem:hover { background:#f8fafc; }
  /* Hide native checkbox */
  .colsItem input[type="checkbox"] { position:absolute; opacity:0; width:0; height:0; pointer-events:none; }
  /* Custom toggle switch */
  .colsToggle {
    flex:0 0 34px;
    width:34px; height:19px;
    border-radius:999px;
    background:#cbd5e1;
    position:relative;
    transition:background .18s;
    flex-shrink:0;
  }
  .colsToggle::after {
    content:'';
    position:absolute;
    left:2px; top:2px;
    width:15px; height:15px;
    border-radius:50%;
    background:#fff;
    box-shadow:0 1px 4px rgba(0,0,0,.18);
    transition:transform .18s;
  }
  .colsItem input:checked ~ .colsToggle { background:#2563eb; }
  .colsItem input:checked ~ .colsToggle::after { transform:translateX(15px); }
  .colsName {
    flex:1;
    font-size:13px;
    font-weight:700;
    color:#0f172a;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .colsItem input:not(:checked) ~ .colsToggle ~ .colsName { color:#94a3b8; }
  .colsMeta {
    flex-shrink:0;
    font-size:10px;
    font-weight:800;
    padding:2px 7px;
    border-radius:999px;
    letter-spacing:0.3px;
  }
  .metaED { background:#dbeafe; color:#1d4ed8; }
  .metaRO { background:#f1f5f9; color:#64748b; }
  /* Action buttons */
  .cpopActions {
    display:flex;
    gap:8px;
    padding:10px 12px;
    border-top:1px solid #f1f5f9;
    flex-shrink:0;
  }
  .cpopBtn {
    flex:1;
    border-radius:10px;
    padding:9px 10px;
    font-size:12px;
    font-weight:800;
    cursor:pointer;
    transition:background .15s, border-color .15s;
  }
  .cpopBtnOutline {
    border:1.5px solid rgba(37,99,235,.35);
    background:rgba(37,99,235,.07);
    color:#1d4ed8;
  }
  .cpopBtnOutline:hover { background:rgba(37,99,235,.14); }
  .cpopBtnGhost {
    border:1.5px solid #e2e8f0;
    background:#f8fafc;
    color:#475569;
  }
  .cpopBtnGhost:hover { background:#f1f5f9; border-color:#cbd5e1; }
  .cpopTip {
    padding:0 14px 12px;
    font-size:11px;
    color:#94a3b8;
    font-weight:700;
    flex-shrink:0;
    line-height:1.4;
  }

  .spacer td { border:none !important; padding:0 !important; background:transparent !important; }

  /* Toasts */
  .toasts { position:fixed; right:14px; bottom:14px; display:flex; flex-direction:column; gap:8px; z-index:4000; pointer-events:none; }
  .toast { pointer-events:auto; max-width:380px; background:#fff; border:1px solid #e2e8f0; border-radius:14px; box-shadow:0 18px 44px rgba(0,0,0,.18); padding:10px 12px; }
  .toast .t1{ font-size:13px; font-weight:900; }
  .toast .t2{ margin-top:4px; font-size:12px; color:#64748b; font-weight:700; }
  .toast.ok{ border-color: rgba(34,197,94,.25); }
  .toast.warn{ border-color: rgba(245,158,11,.28); }
  .toast.error{ border-color: rgba(239,68,68,.25); }

  /* Conflict modal */
  .modalBackdrop{
    position:fixed; inset:0; background: rgba(15,23,42,.35);
    display:flex; align-items:center; justify-content:center;
  }
  .modal{
    width:min(560px, calc(100vw - 24px));
    background:#fff; border:1px solid #e2e8f0; border-radius:16px;
    box-shadow:0 26px 80px rgba(0,0,0,.35);
    padding:14px;
  }
  .modal h3{ margin:0; font-size:14px; font-weight:1000; }
  .modal .sub{ margin-top:6px; font-size:12px; color:#64748b; font-weight:800; }
  .modal pre{
    background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;
    padding:10px; overflow:auto; white-space:pre-wrap; word-break:break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size:12px;
  }
  .modal .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:10px; }
  .modal .actions{ display:flex; gap:10px; margin-top:12px; }
  .modal .actions button{ flex:1; border-radius:12px; }
  .btnPrimary{ border-color: rgba(37,99,235,.35); background: rgba(37,99,235,.10); }
  .btnDanger{ border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.08); }
`;

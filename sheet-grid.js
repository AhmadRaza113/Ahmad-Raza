// sheet-grid.js
// Entry point — imports and registers the <sheet-grid> custom element.
// Load this as a module: <script type="module" src="sheet-grid.js"></script>
// SignalR (@microsoft/signalr) must be available on window.signalR before this
// module executes (e.g. via a CDN <script> tag that precedes this one).

import { SheetGrid } from './src/component.js';

if (!customElements.get('sheet-grid')) {
  customElements.define('sheet-grid', SheetGrid);
}

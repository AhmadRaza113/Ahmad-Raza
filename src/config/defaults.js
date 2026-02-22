/**
 * Default configuration for SheetGrid behavior, UI limits, and live-editing timing.
 */
export const DEFAULT_CONFIG = {
  // UI
  autosaveUiMs: 600,
  minColWidth: 10,
  maxColWidth: 900,
  hideDragThreshold: 8,
  defaultRowHeight: 34,
  minRowHeight: 26,
  maxRowHeight: 320,
  virtualization: true,
  overscan: 10,

  // Live / Server
  lockTtlSeconds: 30,
  lockRenewEveryMs: 12000,            // safe renewal (ttl 30s)
  serverFlushDebounceMs: 800,          // save on blur/enter/debounce — NOT per keystroke
  serverFlushBatchMax: 40,             // max updates in a single /batch call
};

/** Persistence version — bump when localStorage schema changes */
export const PERSIST_VERSION = 14;

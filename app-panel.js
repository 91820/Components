const PANEL_TAG_NAME = "app-panel";
const SNAP_NAMES = ["small", "medium", "large"];
const VIEWPORT_QUERY = "(min-width: 768px)";
const TRIGGER_SELECTOR = [
  "[data-panel-target]",
  "[panel-target]",
  "[data-panel-action]",
  "[panel-action]",
  "[data-panel-open]",
  "[panel-open]",
  "[data-panel-snap]",
  "[panel-snap]",
].join(", ");
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");
const DEFAULT_SNAP_FRACTIONS = {
  mobile: {
    small: 0.44,
    medium: 0.72,
    large: 0.94,
  },
  desktop: {
    small: 0.52,
    medium: 0.68,
    large: 0.84,
  },
};
const PANEL_BASE_Z_INDEX = 999;
const STACK_VISUAL_MAX_DEPTH = 3;

const template = document.createElement("template");

template.innerHTML = `
  <style>
    :host {
      --app-panel-bg: rgba(255, 255, 255, 0.78);
      --app-panel-border: rgba(255, 255, 255, 0.28);
      --app-panel-backdrop: rgba(15, 23, 42, 0.48);
      --app-panel-handle: rgba(15, 23, 42, 0.18);
      --app-panel-radius: 28px;
      --app-panel-shadow: 0 26px 80px rgba(15, 23, 42, 0.3);
      --app-panel-ease: cubic-bezier(0.32, 0.72, 0, 1);
      --app-panel-duration: 320ms;
      --app-panel-drag-resistance: 0.55;
      --app-panel-max-width: 40rem;
      --app-panel-page-scale: 0.956;
      --app-panel-page-radius: 26;
      --app-panel-page-shift: 12;

      position: fixed;
      inset: 0;
      z-index: 999;
      display: block;
      pointer-events: none;
      color: #0f172a;
    }

    :host([data-mounted="true"]) {
      pointer-events: auto;
    }

    :host([data-mounted="true"][data-interactive="false"]) {
      pointer-events: none;
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        --app-panel-duration: 1ms;
      }
    }

    .viewport {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      padding:
        0
        max(0.375rem, env(safe-area-inset-right))
        calc(0.375rem + env(safe-area-inset-bottom))
        max(0.375rem, env(safe-area-inset-left));
      overflow: hidden;
    }

    .backdrop {
      position: absolute;
      inset: 0;
      background: var(--app-panel-backdrop);
      opacity: 0;
      transition: opacity var(--app-panel-duration) linear;
      will-change: opacity;
    }

    .sheet {
      position: relative;
      display: flex;
      flex-direction: column;
      width: min(calc(100vw - 0.75rem), var(--app-panel-max-width));
      height: min(100%, 32rem);
      max-height: calc(100dvh - 0.75rem);
      border: 1px solid var(--app-panel-border);
      border-radius: var(--app-panel-radius);
      background: var(--app-panel-bg);
      box-shadow: var(--app-panel-shadow);
      backdrop-filter: blur(30px) saturate(180%);
      -webkit-backdrop-filter: blur(30px) saturate(180%);
      transform: translate3d(0, 100%, 0);
      transition: transform var(--app-panel-duration) var(--app-panel-ease);
      will-change: transform;
      overflow: hidden;
      contain: layout style paint;
      outline: none;
      transform-origin: center bottom;
      filter: brightness(1);
      transition:
        transform var(--app-panel-duration) var(--app-panel-ease),
        filter var(--app-panel-duration) linear;
    }

    .sheet.is-dragging,
    .sheet.is-immediate {
      transition: none !important;
    }

    .grab-zone {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 2.75rem;
      padding-top: 0.25rem;
      cursor: grab;
      touch-action: none;
      user-select: none;
    }

    .sheet.is-dragging .grab-zone {
      cursor: grabbing;
    }

    .handle {
      width: 2.9rem;
      height: 0.34rem;
      border-radius: 999px;
      background: var(--app-panel-handle);
    }

    .body {
      min-height: 0;
      flex: 1 1 auto;
      overflow: auto;
      overscroll-behavior-y: contain;
      -webkit-overflow-scrolling: touch;
      padding: 0 1.25rem calc(1.25rem + env(safe-area-inset-bottom));
    }

    ::slotted(*) {
      box-sizing: border-box;
    }

    @media (min-width: 768px) {
      .viewport {
        padding:
          0
          max(1rem, env(safe-area-inset-right))
          calc(1rem + env(safe-area-inset-bottom))
          max(1rem, env(safe-area-inset-left));
      }

      .sheet {
        width: min(calc(100vw - 2rem), var(--app-panel-max-width));
      }
    }
  </style>

  <div class="viewport" part="viewport">
    <div class="backdrop" part="backdrop"></div>
    <section class="sheet" part="sheet" role="dialog" aria-modal="true" tabindex="-1">
      <div class="grab-zone" part="grab-zone">
        <div class="handle" part="handle"></div>
      </div>
      <div class="body" part="body">
        <slot></slot>
      </div>
    </section>
  </div>
`;

function normalizeSnapName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return SNAP_NAMES.includes(normalized) ? normalized : null;
}

function parseNumericValue(value) {
  const numeric = Number.parseFloat(String(value ?? "").trim());
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeSnapFraction(value, fallback) {
  const numeric = parseNumericValue(value);
  if (numeric === null) {
    return fallback;
  }

  const fraction = numeric > 1 ? numeric / 100 : numeric;
  return Math.min(Math.max(fraction, 0.2), 1);
}

function readTriggerAttribute(element, suffix) {
  return element.getAttribute(`data-panel-${suffix}`) ?? element.getAttribute(`panel-${suffix}`);
}

function resolvePanelFromTrigger(trigger) {
  const targetValue = readTriggerAttribute(trigger, "target");

  if (!targetValue) {
    return trigger.closest(PANEL_TAG_NAME);
  }

  const trimmed = targetValue.trim();
  if (!trimmed) {
    return trigger.closest(PANEL_TAG_NAME);
  }

  if (/^[A-Za-z][-A-Za-z0-9_:.]*$/.test(trimmed)) {
    return document.getElementById(trimmed);
  }

  try {
    return document.querySelector(trimmed);
  } catch {
    return document.getElementById(trimmed);
  }
}

class AppPanel extends HTMLElement {
  static openStack = [];
  static scrollLockCount = 0;
  static scrollLockSnapshot = null;

  static get observedAttributes() {
    return [
      "open",
      "snaps",
      "default-snap",
      "initial-snap",
      "mobile-snaps",
      "desktop-snaps",
      "snap-small",
      "snap-medium",
      "snap-large",
      "mobile-snap-small",
      "mobile-snap-medium",
      "mobile-snap-large",
      "desktop-snap-small",
      "desktop-snap-medium",
      "desktop-snap-large",
      "scale-background",
      "stacked",
      "app-root",
      "aria-label",
      "aria-labelledby",
      "drag-threshold",
      "scroll-handoff-delay",
      "close-projection",
    ];
  }

  static getTopPanel() {
    return AppPanel.openStack[AppPanel.openStack.length - 1] ?? null;
  }

  static registerOpenPanel(panel) {
    AppPanel.openStack = AppPanel.openStack.filter((candidate) => candidate !== panel);
    AppPanel.openStack.push(panel);
    AppPanel.syncOpenStack();
  }

  static unregisterOpenPanel(panel) {
    AppPanel.openStack = AppPanel.openStack.filter((candidate) => candidate !== panel);
    AppPanel.syncOpenStack();
  }

  static syncOpenStack() {
    AppPanel.openStack = AppPanel.openStack.filter((panel) => panel.isConnected && panel.dataset.mounted === "true");

    const stack = AppPanel.openStack;
    const topPanel = AppPanel.getTopPanel();

    stack.forEach((panel, position) => {
      const depthFromTop = stack.length - 1 - position;
      const canVisualStack = depthFromTop > 0
        && topPanel !== null
        && topPanel.isStackedEnabled()
        && panel.isStackedEnabled();

      panel.applyStackLayer({
        position,
        depthFromTop,
        isTop: panel === topPanel,
        canVisualStack,
      });
    });

    if (topPanel) {
      topPanel.syncBackgroundEffect(topPanel.computeOpenProgress(), { fromStackSync: true });
    } else {
      document.querySelectorAll("[data-panel-app]").forEach((target) => {
        target.removeAttribute("data-panel-scaled");
        target.style.removeProperty("--app-panel-live-scale");
        target.style.removeProperty("--app-panel-live-radius");
        target.style.removeProperty("--app-panel-live-shift");
      });
    }
  }

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(template.content.cloneNode(true));

    this.backdropElement = this.shadowRoot.querySelector(".backdrop");
    this.sheetElement = this.shadowRoot.querySelector(".sheet");
    this.grabZoneElement = this.shadowRoot.querySelector(".grab-zone");
    this.bodyElement = this.shadowRoot.querySelector(".body");

    this.dragState = null;
    this.bodyGesture = null;
    this.snapPoints = [];
    this.snapPointMap = new Map();
    this.closedOffset = 0;
    this.currentOffset = 0;
    this.currentSnapName = null;
    this.currentSnapIndex = 0;
    this.stackDepth = 0;
    this.stackPosition = 0;
    this.stackShiftY = 0;
    this.stackScale = 1;
    this.stackBrightness = 1;
    this.backdropMultiplier = 1;
    this.didApplyScrollLock = false;
    this.isDesktop = false;
    this.panelHeight = 0;
    this.viewportHeight = 0;
    this.backgroundMetrics = {
      scale: 0.956,
      radius: 26,
      shift: 12,
    };
    this.openAnimationFrame = 0;
    this.animationTimeout = 0;
    this.immediateCleanupFrame = 0;
    this.pendingSnapName = null;
    this.pendingOpenReason = null;
    this.recentBodyScrollTime = 0;
    this.lastTriggerElement = null;
    this.focusOriginElement = null;
    this.pendingCloseReason = null;

    this.handleBackdropClick = this.handleBackdropClick.bind(this);
    this.handleViewportChange = this.handleViewportChange.bind(this);
    this.handleGrabPointerDown = this.handleGrabPointerDown.bind(this);
    this.handleGrabPointerMove = this.handleGrabPointerMove.bind(this);
    this.handleGrabPointerUp = this.handleGrabPointerUp.bind(this);
    this.handleBodyTouchStart = this.handleBodyTouchStart.bind(this);
    this.handleBodyTouchMove = this.handleBodyTouchMove.bind(this);
    this.handleBodyTouchEnd = this.handleBodyTouchEnd.bind(this);
    this.handleBodyScroll = this.handleBodyScroll.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
  }

  connectedCallback() {
    this.mediaQuery = window.matchMedia(VIEWPORT_QUERY);
    this.mediaQuery.addEventListener("change", this.handleViewportChange);
    window.addEventListener("resize", this.handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", this.handleViewportChange, { passive: true });

    this.backdropElement.addEventListener("click", this.handleBackdropClick);
    this.grabZoneElement.addEventListener("pointerdown", this.handleGrabPointerDown);
    this.sheetElement.addEventListener("pointermove", this.handleGrabPointerMove);
    this.sheetElement.addEventListener("pointerup", this.handleGrabPointerUp);
    this.sheetElement.addEventListener("pointercancel", this.handleGrabPointerUp);
    this.sheetElement.addEventListener("lostpointercapture", this.handleGrabPointerUp);
    this.bodyElement.addEventListener("touchstart", this.handleBodyTouchStart, { passive: true });
    this.bodyElement.addEventListener("touchmove", this.handleBodyTouchMove, { passive: false });
    this.bodyElement.addEventListener("touchend", this.handleBodyTouchEnd);
    this.bodyElement.addEventListener("touchcancel", this.handleBodyTouchEnd);
    this.bodyElement.addEventListener("scroll", this.handleBodyScroll, { passive: true });
    document.addEventListener("keydown", this.handleKeydown);

    this.dataset.mounted = "false";
    this.dataset.state = "closed";
    this.dataset.interactive = "true";
    this.style.zIndex = String(PANEL_BASE_Z_INDEX);

    this.cacheBackgroundMetrics();
    this.updateA11y();
    this.updateLayout();
    this.updateTriggerState();

    if (this.hasAttribute("open")) {
      this.mountOpen({ animate: false, reason: "initial", silent: true });
    } else {
      this.setOffset(this.closedOffset, { immediate: true });
      this.syncBackgroundEffect(0, { forceClear: true });
    }
  }

  disconnectedCallback() {
    this.mediaQuery?.removeEventListener("change", this.handleViewportChange);
    window.removeEventListener("resize", this.handleViewportChange);
    window.visualViewport?.removeEventListener("resize", this.handleViewportChange);

    this.backdropElement.removeEventListener("click", this.handleBackdropClick);
    this.grabZoneElement.removeEventListener("pointerdown", this.handleGrabPointerDown);
    this.sheetElement.removeEventListener("pointermove", this.handleGrabPointerMove);
    this.sheetElement.removeEventListener("pointerup", this.handleGrabPointerUp);
    this.sheetElement.removeEventListener("pointercancel", this.handleGrabPointerUp);
    this.sheetElement.removeEventListener("lostpointercapture", this.handleGrabPointerUp);
    this.bodyElement.removeEventListener("touchstart", this.handleBodyTouchStart);
    this.bodyElement.removeEventListener("touchmove", this.handleBodyTouchMove);
    this.bodyElement.removeEventListener("touchend", this.handleBodyTouchEnd);
    this.bodyElement.removeEventListener("touchcancel", this.handleBodyTouchEnd);
    this.bodyElement.removeEventListener("scroll", this.handleBodyScroll);
    document.removeEventListener("keydown", this.handleKeydown);

    cancelAnimationFrame(this.openAnimationFrame);
    cancelAnimationFrame(this.immediateCleanupFrame);
    window.clearTimeout(this.animationTimeout);
    AppPanel.unregisterOpenPanel(this);
    this.releaseScrollLock();
    this.syncBackgroundEffect(0, { forceClear: true });
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.isConnected) {
      return;
    }

    if (name === "open") {
      if (newValue !== null) {
        this.mountOpen({ animate: true, reason: this.pendingOpenReason || "attribute" });
      } else {
        this.mountClosed({ animate: true, reason: this.pendingCloseReason || "attribute" });
      }

      this.updateTriggerState();
      return;
    }

    if (name === "aria-label" || name === "aria-labelledby") {
      this.updateA11y();
      return;
    }

    this.cacheBackgroundMetrics();
    this.updateLayout({ preserveOffset: this.open || this.dragState !== null });
    this.syncBackgroundEffect(this.computeOpenProgress());
    this.updateTriggerState();

    if (name === "stacked" && this.dataset.mounted === "true") {
      this.closeIncompatibleOpenPanels("stack-mode-change");
      AppPanel.syncOpenStack();
    }
  }

  get open() {
    return this.hasAttribute("open");
  }

  set open(value) {
    if (value) {
      this.setAttribute("open", "");
    } else {
      this.removeAttribute("open");
    }
  }

  get currentSnap() {
    return this.currentSnapName;
  }

  get availableSnaps() {
    return this.snapPoints.map((point) => point.name);
  }

  show(options = {}) {
    if (typeof options === "string" || typeof options === "number") {
      return this.openAt(options);
    }

    return this.openAt(options.snap, options);
  }

  openAt(target = null, options = {}) {
    const snapPoint = this.resolveSnapPoint(target) ?? this.resolveDefaultSnapPoint();
    const animate = options.animate !== false;

    this.rememberFocusOrigin(options.trigger);

    if (!this.open) {
      this.pendingSnapName = snapPoint.name;
      this.pendingOpenReason = options.reason || "programmatic";
      this.open = true;
      return this;
    }

    AppPanel.registerOpenPanel(this);

    this.settleToSnapPoint(snapPoint, {
      animate,
      reason: options.reason || "programmatic",
    });

    return this;
  }

  close(options = {}) {
    if (!this.open && this.dataset.mounted !== "true") {
      return this;
    }

    this.pendingCloseReason = options.reason || "programmatic";
    this.open = false;
    return this;
  }

  hide(options = {}) {
    return this.close(options);
  }

  toggle(forceOrOptions) {
    if (typeof forceOrOptions === "boolean") {
      return forceOrOptions ? this.openAt() : this.close();
    }

    if (typeof forceOrOptions === "string" || typeof forceOrOptions === "number") {
      return this.open ? this.close({ reason: "toggle" }) : this.openAt(forceOrOptions, { reason: "toggle" });
    }

    const options = forceOrOptions || {};

    if (typeof options.force === "boolean") {
      return options.force
        ? this.openAt(options.snap, options)
        : this.close({ reason: options.reason || "toggle" });
    }

    return this.open
      ? this.close({ reason: options.reason || "toggle" })
      : this.openAt(options.snap, options);
  }

  snapTo(target, options = {}) {
    const snapPoint = this.resolveSnapPoint(target);
    if (!snapPoint) {
      return this;
    }

    if (!this.open) {
      return this.openAt(snapPoint.name, options);
    }

    this.settleToSnapPoint(snapPoint, {
      animate: options.animate !== false,
      reason: options.reason || "programmatic",
    });

    return this;
  }

  handleTriggerElement(trigger, event) {
    const internalTrigger = trigger.closest(PANEL_TAG_NAME) === this;

    if (!internalTrigger) {
      this.lastTriggerElement = trigger;
      this.focusOriginElement = trigger;
    }

    const action = (readTriggerAttribute(trigger, "action") || (readTriggerAttribute(trigger, "open") ? "open" : "toggle"))
      .trim()
      .toLowerCase();
    const requestedSnap = readTriggerAttribute(trigger, "open") || readTriggerAttribute(trigger, "snap");

    if (trigger instanceof HTMLAnchorElement && trigger.getAttribute("href") === "#") {
      event?.preventDefault();
    }

    if (action === "close") {
      this.close({ reason: "trigger" });
      return;
    }

    if (action === "snap") {
      this.snapTo(requestedSnap || this.resolveDefaultSnapPoint()?.name, {
        reason: "trigger",
        trigger,
      });
      return;
    }

    if (action === "toggle") {
      this.toggle({
        snap: requestedSnap,
        reason: "trigger",
        trigger,
      });
      return;
    }

    this.openAt(requestedSnap, {
      reason: "trigger",
      trigger,
    });
  }

  handleBackdropClick() {
    if (!this.isTopOfStack() || !this.isDismissible()) {
      return;
    }

    this.close({ reason: "backdrop" });
  }

  handleViewportChange() {
    this.cacheBackgroundMetrics();
    this.updateLayout({ preserveOffset: this.open || this.dragState !== null });
  }

  handleGrabPointerDown(event) {
    if (!this.open || !this.isDraggable() || !this.isTopOfStack()) {
      return;
    }

    if (event.button !== undefined && event.button !== 0) {
      return;
    }

    this.beginDragSession({
      pointerId: event.pointerId,
      startY: event.clientY,
      capturePointer: true,
    });
  }

  handleGrabPointerMove(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    this.updateDragPosition(event.clientY);
  }

  handleGrabPointerUp(event) {
    if (!this.dragState || event.pointerId !== this.dragState.pointerId) {
      return;
    }

    this.endDragSession({ pointerId: event.pointerId, reason: "drag" });
  }

  handleBodyTouchStart(event) {
    if (!this.open || !this.isDraggable() || !this.isTopOfStack() || event.touches.length !== 1) {
      this.bodyGesture = null;
      return;
    }

    const touch = event.touches[0];

    this.bodyGesture = {
      identifier: touch.identifier,
      startX: touch.clientX,
      startY: touch.clientY,
      startedAtTop: this.isBodyAtTop(),
      dragging: false,
    };
  }

  handleBodyTouchMove(event) {
    if (!this.bodyGesture) {
      return;
    }

    const touch = this.findTouchByIdentifier(event.changedTouches, this.bodyGesture.identifier);
    if (!touch) {
      return;
    }

    if (this.bodyGesture.dragging) {
      event.preventDefault();
      this.updateDragPosition(touch.clientY);
      return;
    }

    const deltaY = touch.clientY - this.bodyGesture.startY;
    const deltaX = touch.clientX - this.bodyGesture.startX;

    if (Math.abs(deltaY) < this.getDragThreshold() || Math.abs(deltaY) <= Math.abs(deltaX)) {
      return;
    }

    if (deltaY <= 0 || !this.bodyGesture.startedAtTop) {
      this.bodyGesture = null;
      return;
    }

    if (!this.isBodyAtTop() || performance.now() - this.recentBodyScrollTime < this.getScrollHandoffDelay()) {
      return;
    }

    event.preventDefault();

    this.bodyGesture.dragging = true;
    this.beginDragSession({
      pointerId: `touch-${touch.identifier}`,
      startY: touch.clientY,
      capturePointer: false,
    });
  }

  handleBodyTouchEnd(event) {
    if (!this.bodyGesture) {
      return;
    }

    const touch = this.findTouchByIdentifier(event.changedTouches, this.bodyGesture.identifier);

    if (this.bodyGesture.dragging && this.dragState) {
      if (touch) {
        this.updateDragPosition(touch.clientY);
        this.endDragSession({ pointerId: `touch-${touch.identifier}`, reason: "drag" });
      } else {
        this.endDragSession({ pointerId: this.dragState.pointerId, reason: "drag" });
      }
    }

    this.bodyGesture = null;
  }

  handleBodyScroll() {
    this.recentBodyScrollTime = performance.now();
  }

  handleKeydown(event) {
    if (!this.open || !this.isTopOfStack()) {
      return;
    }

    if (event.key === "Escape" && this.isDismissible()) {
      event.preventDefault();
      this.close({ reason: "escape" });
      return;
    }

    if (event.key === "Tab") {
      this.trapFocus(event);
    }
  }

  updateA11y() {
    const labelledby = this.getAttribute("aria-labelledby");
    const label = this.getAttribute("aria-label");

    if (labelledby) {
      this.sheetElement.setAttribute("aria-labelledby", labelledby);
      this.sheetElement.removeAttribute("aria-label");
      return;
    }

    this.sheetElement.removeAttribute("aria-labelledby");
    this.sheetElement.setAttribute("aria-label", label || "Panel");
  }

  updateLayout(options = {}) {
    const preserveOffset = options.preserveOffset === true;
    const previousOffset = this.currentOffset;

    this.isDesktop = this.mediaQuery?.matches ?? window.innerWidth >= 768;
    this.viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);

    const topGap = this.isDesktop ? 56 : 12;
    const bottomGap = this.isDesktop ? 16 : 6;
    const availableHeight = Math.max(320, this.viewportHeight - topGap - bottomGap);
    this.panelHeight = this.isDesktop ? Math.min(availableHeight, 720) : availableHeight;

    const radius = this.isDesktop ? 32 : 28;

    this.sheetElement.style.height = `${this.panelHeight}px`;
    this.sheetElement.style.maxHeight = `${this.panelHeight}px`;
    this.sheetElement.style.borderRadius = `${radius}px`;

    const snapNames = this.parseDeclaredSnapNames();
    const legacyFractions = this.parseLegacySnapFractions(snapNames);
    const viewportKey = this.isDesktop ? "desktop" : "mobile";

    this.snapPoints = snapNames
      .map((name, index) => {
        const fraction = this.resolveSnapFraction(name, index, legacyFractions, viewportKey);
        return {
          name,
          fraction,
          offset: this.panelHeight - this.panelHeight * fraction,
        };
      })
      .sort((left, right) => left.offset - right.offset)
      .map((point, index) => ({
        ...point,
        index,
      }));

    this.snapPointMap = new Map(this.snapPoints.map((point) => [point.name, point]));
    this.closedOffset = this.panelHeight + 32;

    if (!this.snapPoints.length) {
      const fallbackPoint = {
        name: "medium",
        fraction: DEFAULT_SNAP_FRACTIONS[viewportKey].medium,
        offset: Math.max(this.panelHeight * 0.28, 0),
        index: 0,
      };
      this.snapPoints = [fallbackPoint];
      this.snapPointMap = new Map([[fallbackPoint.name, fallbackPoint]]);
    }

    if (!preserveOffset) {
      const targetPoint = this.resolveDefaultSnapPoint();
      this.setActiveSnapPoint(targetPoint, { emit: false });
      this.currentOffset = this.open ? targetPoint.offset : this.closedOffset;
      this.setOffset(this.currentOffset, { immediate: true });
      return;
    }

    const target = this.findNearestTarget(previousOffset);
    if (target.type === "closed") {
      this.currentOffset = this.closedOffset;
      this.setOffset(this.closedOffset, { immediate: true });
      return;
    }

    this.setActiveSnapPoint(target.point, { emit: false });
    this.currentOffset = target.point.offset;
    this.setOffset(target.point.offset, { immediate: true });
  }

  parseDeclaredSnapNames() {
    const raw = this.getAttribute("snaps");
    if (!raw) {
      return [...SNAP_NAMES];
    }

    const names = raw
      .split(/[,\s]+/)
      .map((value) => normalizeSnapName(value))
      .filter(Boolean);

    return [...new Set(names)].length ? [...new Set(names)] : [...SNAP_NAMES];
  }

  parseLegacySnapFractions(snapNames) {
    const attributeName = this.isDesktop ? "desktop-snaps" : "mobile-snaps";
    const raw = this.getAttribute(attributeName);

    if (!raw) {
      return [];
    }

    return raw
      .split(/[,\s]+/)
      .map((value) => normalizeSnapFraction(value, null))
      .slice(0, snapNames.length);
  }

  resolveSnapFraction(name, index, legacyFractions, viewportKey) {
    const viewportAttribute = `${viewportKey}-snap-${name}`;
    const genericAttribute = `snap-${name}`;
    const fallback = DEFAULT_SNAP_FRACTIONS[viewportKey][name] ?? DEFAULT_SNAP_FRACTIONS[viewportKey].medium;

    return normalizeSnapFraction(
      this.getAttribute(viewportAttribute) ?? this.getAttribute(genericAttribute) ?? legacyFractions[index],
      fallback,
    );
  }

  resolveDefaultSnapPoint() {
    const requested = this.pendingSnapName
      ?? this.getAttribute("default-snap")
      ?? this.getAttribute("initial-snap")
      ?? "medium";

    return this.resolveSnapPoint(requested) ?? this.snapPointMap.get("medium") ?? this.snapPoints[0];
  }

  resolveSnapPoint(target) {
    if (!this.snapPoints.length) {
      return null;
    }

    if (typeof target === "number" && Number.isFinite(target)) {
      const index = Math.min(Math.max(target, 0), this.snapPoints.length - 1);
      return this.snapPoints[index];
    }

    const numeric = parseNumericValue(target);
    if (numeric !== null && String(target).trim() !== "") {
      const index = Math.min(Math.max(Math.round(numeric), 0), this.snapPoints.length - 1);
      return this.snapPoints[index];
    }

    const snapName = normalizeSnapName(target);
    if (snapName) {
      return this.snapPointMap.get(snapName) ?? null;
    }

    return null;
  }

  isStackedEnabled() {
    if (!this.hasAttribute("stacked")) {
      return false;
    }

    return this.getAttribute("stacked") !== "false";
  }

  isTopOfStack() {
    return AppPanel.getTopPanel() === this;
  }

  canStackWith(panel) {
    return this.isStackedEnabled() && panel.isStackedEnabled();
  }

  closeIncompatibleOpenPanels(reason = "superseded") {
    AppPanel.openStack.forEach((panel) => {
      if (panel === this || !panel.open) {
        return;
      }

      if (!this.canStackWith(panel)) {
        panel.close({ reason });
      }
    });
  }

  applyStackLayer(options = {}) {
    const depthFromTop = Math.max(options.depthFromTop ?? 0, 0);
    const position = options.position ?? 0;
    const isTop = options.isTop === true;
    const canVisualStack = options.canVisualStack === true;

    this.stackDepth = depthFromTop;
    this.stackPosition = position;
    this.dataset.stackDepth = String(depthFromTop);
    this.dataset.stackTop = isTop ? "true" : "false";
    this.dataset.interactive = isTop ? "true" : "false";
    this.style.zIndex = String(PANEL_BASE_Z_INDEX + position);

    if (canVisualStack) {
      const clampedDepth = Math.min(depthFromTop, STACK_VISUAL_MAX_DEPTH);
      this.stackShiftY = -(10 + (clampedDepth - 1) * 6);
      this.stackScale = Math.max(0.9, 1 - clampedDepth * 0.025);
      this.stackBrightness = Math.max(0.84, 1 - clampedDepth * 0.06);
      this.backdropMultiplier = 0;
    } else {
      this.stackShiftY = 0;
      this.stackScale = 1;
      this.stackBrightness = 1;
      this.backdropMultiplier = isTop ? 1 : 0;
    }

    this.sheetElement.style.filter = this.stackBrightness === 1
      ? "brightness(1)"
      : `brightness(${this.stackBrightness.toFixed(3)})`;
    this.applyCurrentSheetTransform();
    this.updateBackdropOpacity();
  }

  rememberFocusOrigin(trigger) {
    if (trigger instanceof HTMLElement) {
      this.lastTriggerElement = trigger;
      this.focusOriginElement = trigger;
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement !== document.body) {
      this.focusOriginElement = activeElement;
    }
  }

  beginDragSession(options = {}) {
    this.dragState = {
      pointerId: options.pointerId,
      startY: options.startY,
      startOffset: this.currentOffset,
      lastY: options.startY,
      lastTime: performance.now(),
      velocity: 0,
      capturePointer: options.capturePointer === true,
    };

    if (this.dragState.capturePointer && options.pointerId !== undefined) {
      this.sheetElement.setPointerCapture(options.pointerId);
    }

    this.sheetElement.classList.add("is-dragging");
    this.dataset.mounted = "true";
    this.dataset.state = "dragging";
    this.dispatchPanelEvent("panel-drag-start", {
      reason: options.reason || "drag",
      snap: this.currentSnap,
    });
  }

  resetGestures() {
    this.dragState = null;
    this.bodyGesture = null;
    this.sheetElement.classList.remove("is-dragging");
  }

  getDragThreshold() {
    return parseNumericValue(this.getAttribute("drag-threshold")) ?? 10;
  }

  getScrollHandoffDelay() {
    return parseNumericValue(this.getAttribute("scroll-handoff-delay")) ?? 80;
  }

  getCloseProjection() {
    return parseNumericValue(this.getAttribute("close-projection")) ?? 180;
  }

  resolveDragOffset(offset) {
    const topSnapOffset = this.snapPoints[0]?.offset ?? 0;

    if (offset >= topSnapOffset) {
      return Math.min(offset, this.closedOffset);
    }

    const overdrag = topSnapOffset - offset;
    const resistedDistance = this.rubberBandDistance(overdrag, this.panelHeight || this.viewportHeight || 1);

    return topSnapOffset - resistedDistance;
  }

  rubberBandDistance(distance, dimension) {
    const resistance = Number.parseFloat(
      getComputedStyle(this).getPropertyValue("--app-panel-drag-resistance"),
    ) || 0.55;

    return (distance * dimension * resistance) / (dimension + resistance * distance);
  }

  updateDragPosition(clientY) {
    if (!this.dragState) {
      return;
    }

    const now = performance.now();
    const deltaY = clientY - this.dragState.startY;
    const nextOffset = this.resolveDragOffset(this.dragState.startOffset + deltaY);
    const deltaTime = Math.max(now - this.dragState.lastTime, 1);
    const instantVelocity = (clientY - this.dragState.lastY) / deltaTime;

    this.dragState.velocity = this.dragState.velocity * 0.72 + instantVelocity * 0.28;
    this.dragState.lastY = clientY;
    this.dragState.lastTime = now;

    this.setOffset(nextOffset, { allowOvershoot: true });
  }

  endDragSession(options = {}) {
    if (!this.dragState || options.pointerId !== this.dragState.pointerId) {
      return;
    }

    if (this.dragState.capturePointer && this.sheetElement.hasPointerCapture(options.pointerId)) {
      this.sheetElement.releasePointerCapture(options.pointerId);
    }

    const velocity = this.dragState.velocity;
    const projectedOffset = this.currentOffset + velocity * this.getCloseProjection();
    const target = this.findNearestTarget(projectedOffset);

    this.dispatchPanelEvent("panel-drag-end", {
      reason: options.reason || "drag",
      snap: this.currentSnap,
      velocity,
    });

    this.resetGestures();

    if (target.type === "closed") {
      this.close({ reason: options.reason || "drag" });
      return;
    }

    this.settleToSnapPoint(target.point, {
      animate: true,
      reason: options.reason || "drag",
    });
  }

  findTouchByIdentifier(touchList, identifier) {
    if (identifier === undefined) {
      return null;
    }

    for (let index = 0; index < touchList.length; index += 1) {
      const touch = touchList[index];
      if (touch.identifier === identifier) {
        return touch;
      }
    }

    return null;
  }

  isBodyAtTop() {
    return this.bodyElement.scrollTop <= 1;
  }

  findNearestTarget(offset) {
    const candidates = this.isDismissible()
      ? [...this.snapPoints.map((point) => ({ type: "snap", point })), { type: "closed", offset: this.closedOffset }]
      : [...this.snapPoints.map((point) => ({ type: "snap", point }))];

    let nearest = candidates[0];
    let smallestDistance = Number.POSITIVE_INFINITY;

    candidates.forEach((candidate) => {
      const candidateOffset = candidate.type === "closed" ? candidate.offset : candidate.point.offset;
      const distance = Math.abs(candidateOffset - offset);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nearest = candidate;
      }
    });

    return nearest;
  }

  setActiveSnapPoint(point, options = {}) {
    if (!point) {
      return;
    }

    const previousSnap = this.currentSnapName;
    this.currentSnapName = point.name;
    this.currentSnapIndex = point.index;
    this.dataset.snap = point.name;

    if (options.emit !== false && previousSnap !== point.name) {
      this.dispatchPanelEvent("panel-snap-change", {
        snap: point.name,
        previousSnap,
        reason: options.reason || "programmatic",
      });
    }
  }

  settleToSnapPoint(point, options = {}) {
    if (!point) {
      return;
    }

    const animate = options.animate !== false;

    this.setActiveSnapPoint(point, {
      emit: options.emit !== false,
      reason: options.reason,
    });
    this.dataset.state = animate ? "settling" : "open";
    this.setOffset(point.offset, { immediate: !animate });

    if (animate) {
      this.finishStateTransition("open");
    }
  }

  mountOpen(options = {}) {
    const animate = options.animate !== false;
    const targetPoint = this.resolveSnapPoint(this.pendingSnapName) ?? this.resolveDefaultSnapPoint();

    this.pendingSnapName = null;
    this.pendingOpenReason = null;
    this.resetGestures();
    this.closeIncompatibleOpenPanels(options.reason || "programmatic");
    this.applyScrollLock();
    this.dataset.mounted = "true";
    this.dataset.state = animate ? "opening" : "open";
    AppPanel.registerOpenPanel(this);
    this.setActiveSnapPoint(targetPoint, {
      emit: !options.silent,
      reason: options.reason || "programmatic",
    });

    if (!animate) {
      this.setOffset(targetPoint.offset, { immediate: true });
      this.finalizeOpen(options);
      return;
    }

    this.setOffset(this.closedOffset, { immediate: true });
    cancelAnimationFrame(this.openAnimationFrame);
    this.openAnimationFrame = requestAnimationFrame(() => {
      this.setOffset(targetPoint.offset);
      this.finishStateTransition("open", () => this.finalizeOpen(options));
    });
  }

  mountClosed(options = {}) {
    const animate = options.animate !== false;

    cancelAnimationFrame(this.openAnimationFrame);
    this.resetGestures();

    if (!animate) {
      this.dataset.state = "closed";
      this.dataset.mounted = "false";
      this.setOffset(this.closedOffset, { immediate: true });
      this.finalizeClose(options);
      return;
    }

    this.dataset.mounted = "true";
    this.dataset.state = "closing";
    this.setOffset(this.closedOffset);
    this.finishStateTransition("closed", () => this.finalizeClose(options));
  }

  finishStateTransition(nextState, callback) {
    const duration = this.getAnimationDuration();

    window.clearTimeout(this.animationTimeout);
    this.animationTimeout = window.setTimeout(() => {
      this.dataset.state = nextState;
      callback?.();
    }, duration + 24);
  }

  finalizeOpen(options = {}) {
    this.dataset.state = "open";
    this.updateTriggerState();
    this.focusFirstElement();

    if (!options.silent) {
      this.dispatchPanelEvent("panel-open", {
        reason: options.reason || "programmatic",
        snap: this.currentSnap,
      });
    }
  }

  finalizeClose(options = {}) {
    AppPanel.unregisterOpenPanel(this);
    this.dataset.state = "closed";
    this.dataset.mounted = "false";
    this.releaseScrollLock();
    this.syncBackgroundEffect(0, { forceClear: true });
    this.updateTriggerState();
    this.restoreFocus();

    const reason = options.reason || this.pendingCloseReason || "programmatic";
    this.pendingCloseReason = null;

    if (!options.silent) {
      this.dispatchPanelEvent("panel-close", {
        reason,
        snap: this.currentSnap,
      });
    }
  }

  getAnimationDuration() {
    const value = getComputedStyle(this).getPropertyValue("--app-panel-duration").trim();

    if (!value) {
      return 320;
    }

    if (value.endsWith("ms")) {
      return Number.parseFloat(value) || 320;
    }

    if (value.endsWith("s")) {
      return (Number.parseFloat(value) || 0.32) * 1000;
    }

    return Number.parseFloat(value) || 320;
  }

  setOffset(offset, options = {}) {
    const immediate = options.immediate === true;
    const allowOvershoot = options.allowOvershoot === true;

    this.currentOffset = allowOvershoot
      ? Math.min(offset, this.closedOffset)
      : this.clampOffset(offset);
    this.sheetElement.classList.toggle("is-immediate", immediate);
    this.applyCurrentSheetTransform();

    if (immediate) {
      cancelAnimationFrame(this.immediateCleanupFrame);
      this.immediateCleanupFrame = requestAnimationFrame(() => {
        this.sheetElement.classList.remove("is-immediate");
      });
    }

    this.updateBackdropOpacity();
    this.syncBackgroundEffect(this.computeOpenProgress());
  }

  applyCurrentSheetTransform() {
    const y = this.currentOffset + this.stackShiftY;
    this.sheetElement.style.transform = `translate3d(0, ${y}px, 0) scale(${this.stackScale.toFixed(4)})`;
  }

  updateBackdropOpacity() {
    const opacity = this.computeOpenProgress() * this.backdropMultiplier;
    this.backdropElement.style.opacity = opacity.toFixed(3);
  }

  clampOffset(offset) {
    const topOffset = this.snapPoints[0]?.offset ?? 0;
    return Math.min(Math.max(offset, topOffset), this.closedOffset);
  }

  computeOpenProgress() {
    if (!this.closedOffset || !this.snapPoints.length) {
      return 0;
    }

    const topOffset = this.snapPoints[0].offset;
    const range = Math.max(this.closedOffset - topOffset, 1);
    const progress = 1 - (this.currentOffset - topOffset) / range;

    return Math.min(Math.max(progress, 0), 1);
  }

  cacheBackgroundMetrics() {
    const styles = getComputedStyle(this);

    this.backgroundMetrics = {
      scale: Number.parseFloat(styles.getPropertyValue("--app-panel-page-scale")) || 0.956,
      radius: Number.parseFloat(styles.getPropertyValue("--app-panel-page-radius")) || 26,
      shift: Number.parseFloat(styles.getPropertyValue("--app-panel-page-shift")) || 12,
    };
  }

  syncBackgroundEffect(progress, options = {}) {
    const topPanel = AppPanel.getTopPanel();
    const isTopPanel = topPanel === this;

    if (!isTopPanel && !options.forceClear) {
      return;
    }

    if (options.forceClear && topPanel && topPanel !== this) {
      return;
    }

    const target = this.resolveBackgroundTarget();

    if (!target) {
      return;
    }

    const shouldScale = this.hasAttribute("scale-background") && progress > 0;

    if (!shouldScale || options.forceClear) {
      target.removeAttribute("data-panel-scaled");
      target.style.removeProperty("--app-panel-live-scale");
      target.style.removeProperty("--app-panel-live-radius");
      target.style.removeProperty("--app-panel-live-shift");
      return;
    }

    const scale = 1 - (1 - this.backgroundMetrics.scale) * progress;
    const radius = this.backgroundMetrics.radius * progress;
    const shift = this.backgroundMetrics.shift * progress;

    target.setAttribute("data-panel-scaled", "true");
    target.style.setProperty("--app-panel-live-scale", scale.toFixed(4));
    target.style.setProperty("--app-panel-live-radius", `${radius.toFixed(2)}px`);
    target.style.setProperty("--app-panel-live-shift", `${shift.toFixed(2)}px`);
  }

  resolveBackgroundTarget() {
    const selector = this.getAttribute("app-root");
    if (selector) {
      try {
        return document.querySelector(selector);
      } catch {
        return document.getElementById(selector);
      }
    }

    return document.querySelector("[data-panel-app]");
  }

  getFocusableElements() {
    return [...this.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => this.isFocusableVisible(element));
  }

  isFocusableVisible(element) {
    return element instanceof HTMLElement
      && element.getClientRects().length > 0
      && element.getAttribute("aria-hidden") !== "true";
  }

  focusFirstElement() {
    const target = this.querySelector("[autofocus], [data-panel-autofocus]") ?? this.getFocusableElements()[0] ?? this.sheetElement;

    requestAnimationFrame(() => {
      target?.focus?.({ preventScroll: true });
    });
  }

  trapFocus(event) {
    const focusables = this.getFocusableElements();

    if (!focusables.length) {
      event.preventDefault();
      this.sheetElement.focus({ preventScroll: true });
      return;
    }

    const shadowActive = this.shadowRoot.activeElement;
    const activeElement = shadowActive instanceof HTMLElement ? shadowActive : document.activeElement;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (event.shiftKey) {
      if (activeElement === first || activeElement === this.sheetElement || activeElement === this) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      }
      return;
    }

    if (activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  restoreFocus() {
    const target = this.lastTriggerElement?.isConnected
      ? this.lastTriggerElement
      : this.focusOriginElement?.isConnected
        ? this.focusOriginElement
        : null;

    target?.focus?.({ preventScroll: true });
  }

  updateTriggerState() {
    const triggers = document.querySelectorAll(TRIGGER_SELECTOR);

    triggers.forEach((trigger) => {
      if (resolvePanelFromTrigger(trigger) !== this) {
        return;
      }

      if (this.id) {
        trigger.setAttribute("aria-controls", this.id);
      }

      trigger.setAttribute("aria-expanded", String(this.open));
    });
  }

  dispatchPanelEvent(name, detail = {}) {
    this.dispatchEvent(new CustomEvent(name, {
      bubbles: true,
      detail: {
        panel: this,
        snap: this.currentSnap,
        viewport: this.isDesktop ? "desktop" : "mobile",
        ...detail,
      },
    }));
  }

  isDismissible() {
    if (!this.hasAttribute("dismissible")) {
      return true;
    }

    return this.getAttribute("dismissible") !== "false";
  }

  isDraggable() {
    if (!this.hasAttribute("draggable")) {
      return true;
    }

    return this.getAttribute("draggable") !== "false";
  }

  applyScrollLock() {
    if (this.didApplyScrollLock) {
      return;
    }

    if (AppPanel.scrollLockCount === 0) {
      AppPanel.scrollLockSnapshot = {
        htmlOverflow: document.documentElement.style.overflow,
        bodyOverflow: document.body.style.overflow,
      };
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    }

    AppPanel.scrollLockCount += 1;
    this.didApplyScrollLock = true;
  }

  releaseScrollLock() {
    if (!this.didApplyScrollLock) {
      return;
    }

    this.didApplyScrollLock = false;
    AppPanel.scrollLockCount = Math.max(0, AppPanel.scrollLockCount - 1);

    if (AppPanel.scrollLockCount > 0) {
      return;
    }

    if (AppPanel.scrollLockSnapshot) {
      document.documentElement.style.overflow = AppPanel.scrollLockSnapshot.htmlOverflow;
      document.body.style.overflow = AppPanel.scrollLockSnapshot.bodyOverflow;
      AppPanel.scrollLockSnapshot = null;
    }
  }
}

function installTriggerDelegation() {
  if (globalThis.__appPanelTriggerDelegationInstalled) {
    return;
  }

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const trigger = target?.closest(TRIGGER_SELECTOR);
    if (!trigger) {
      return;
    }

    const panel = resolvePanelFromTrigger(trigger);
    if (!(panel instanceof AppPanel)) {
      return;
    }

    panel.handleTriggerElement(trigger, event);
  });

  globalThis.__appPanelTriggerDelegationInstalled = true;
}

if (!customElements.get(PANEL_TAG_NAME)) {
  customElements.define(PANEL_TAG_NAME, AppPanel);
}

installTriggerDelegation();

import { getStroke } from "perfect-freehand";
import "./style.css";

type Mode = "draw" | "type";
type Point = [number, number, number];

interface Stroke {
  points: Point[];
  color: string;
  size: number;
  flow: number;
  pressure: number;
  velocityPressure: boolean;
  pointerType: string;
}

interface State {
  mode: Mode;
  strokes: Stroke[];
  current: Stroke | null;
  color: string;
  size: number;
  flow: number;
  pressure: number;
  velocityPressure: boolean;
  font: string;
  name: string;
  hintDismissed: boolean;
}

const STORAGE_KEY = "hancock:state:v2";

const state: State = loadState();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const canvasHint = document.getElementById("canvasHint")!;
const typeControls = document.getElementById("typeControls")!;
const nameInput = document.getElementById("nameInput") as HTMLInputElement;
const fontPicker = document.getElementById("fontPicker") as HTMLElement;
const fontToggle = document.getElementById("fontToggle") as HTMLButtonElement;
const fontMenu = document.getElementById("fontMenu") as HTMLUListElement;
const fontCurrent = document.getElementById("fontCurrent") as HTMLElement;
const customSwatchWrap = document.getElementById("customSwatchWrap") as HTMLLabelElement;
const customColor = document.getElementById("customColor") as HTMLInputElement;
const customClear = document.getElementById("customClear") as HTMLButtonElement;
const weightControl = document.getElementById("weightControl") as HTMLElement;
const pressureControl = document.getElementById("pressureControl") as HTMLElement;
const velocityControl = document.getElementById("velocityControl") as HTMLElement;
const flowControl = document.getElementById("flowControl") as HTMLElement;
const undoBtn = document.getElementById("undo") as HTMLButtonElement;
const clearBtn = document.getElementById("clear") as HTMLButtonElement;
const downloadBtn = document.getElementById("download") as HTMLButtonElement;
const copyBtn = document.getElementById("copy") as HTMLButtonElement;
const weightInput = document.getElementById("weight") as HTMLInputElement;
const flowInput = document.getElementById("flow") as HTMLInputElement;
const pressureInput = document.getElementById("pressure") as HTMLInputElement;
const velocityToggle = document.getElementById("velocityToggle") as HTMLInputElement;
const swatches = document.querySelectorAll<HTMLButtonElement>(".swatch");
const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const linkLikeTab = document.querySelector<HTMLButtonElement>(".linklike");
const mouseHint = document.getElementById("mouseHint") as HTMLElement;
const toast = document.getElementById("toast") as HTMLElement;

let dpr = Math.min(window.devicePixelRatio || 1, 2);

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return {
        mode: saved.mode ?? "draw",
        strokes: saved.strokes ?? [],
        current: null,
        color: saved.color ?? "#0a0a0a",
        size: saved.size ?? 5,
        flow: saved.flow ?? 65,
        pressure: saved.pressure ?? 55,
        velocityPressure: saved.velocityPressure ?? false,
        font: saved.font ?? "Dancing Script",
        name: saved.name ?? "",
        hintDismissed: saved.hintDismissed ?? false,
      };
    }
  } catch {
    // fall through
  }
  return {
    mode: "draw",
    strokes: [],
    current: null,
    color: "#0a0a0a",
    size: 5,
    flow: 65,
    pressure: 55,
    velocityPressure: false,
    font: "Dancing Script",
    name: "",
    hintDismissed: false,
  };
}

function persistState() {
  const snapshot = {
    mode: state.mode,
    strokes: state.strokes,
    color: state.color,
    size: state.size,
    flow: state.flow,
    pressure: state.pressure,
    velocityPressure: state.velocityPressure,
    font: state.font,
    name: state.name,
    hintDismissed: state.hintDismissed,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage blocked or full; ignore
  }
}

function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  render();
}

function clearCanvas() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function strokeOptions(s: Stroke, isLive = false) {
  const base = ((s.flow ?? 65) / 100) * 0.9;
  const mouseBoost = s.pointerType !== "pen" ? 0.08 : 0;
  const streamline = Math.min(0.85, base + mouseBoost);
  const thinning = s.velocityPressure ? 0.2 + ((s.pressure ?? 55) / 100) * 0.55 : 0;
  return {
    size: s.size,
    thinning,
    smoothing: 0.35,
    streamline,
    simulatePressure: false,
    start: { taper: 0, cap: true },
    end: { taper: 0, cap: true },
    last: !isLive,
  };
}

function renderStroke(target: CanvasRenderingContext2D, s: Stroke, isLive = false) {
  if (s.points.length === 0) return;
  const outline = getStroke(s.points, strokeOptions(s, isLive));
  if (outline.length < 2) return;
  target.fillStyle = s.color;
  target.beginPath();
  target.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    target.lineTo(outline[i][0], outline[i][1]);
  }
  target.closePath();
  target.fill();
}

function renderText(target: CanvasRenderingContext2D, width: number, height: number) {
  const text = state.name.trim();
  if (!text) return;
  target.fillStyle = state.color;
  target.textBaseline = "middle";
  target.textAlign = "center";
  let fontSize = height * 0.7;
  target.font = `${fontSize}px "${state.font}", cursive`;
  const maxWidth = width * 0.88;
  const m = target.measureText(text);
  if (m.width > maxWidth) {
    fontSize *= maxWidth / m.width;
    target.font = `${fontSize}px "${state.font}", cursive`;
  }
  target.fillText(text, width / 2, height / 2);
}

function render() {
  clearCanvas();
  if (state.mode === "draw") {
    for (const s of state.strokes) renderStroke(ctx, s);
    if (state.current) renderStroke(ctx, state.current, true);
  } else {
    renderText(ctx, canvas.clientWidth, canvas.clientHeight);
  }
  updateHint();
  updateButtons();
}

function updateHint() {
  const isEmpty =
    state.mode === "draw"
      ? state.strokes.length === 0 && !state.current
      : state.name.trim() === "";
  if (isEmpty) {
    canvasHint.textContent =
      state.mode === "draw" ? "Draw your signature" : "Type your name above";
    canvasHint.classList.remove("is-hidden");
  } else {
    canvasHint.classList.add("is-hidden");
  }
}

function updateButtons() {
  const hasContent =
    state.mode === "draw" ? state.strokes.length > 0 : state.name.trim().length > 0;
  undoBtn.disabled = state.mode !== "draw" || state.strokes.length === 0;
  clearBtn.disabled = !hasContent;
  downloadBtn.disabled = !hasContent;
  copyBtn.disabled = !hasContent;
}

function updateFontPicker() {
  fontCurrent.textContent = state.font;
  fontCurrent.style.fontFamily = `"${state.font}", cursive`;
  const items = fontMenu.querySelectorAll<HTMLLIElement>("li");
  for (const li of items) {
    li.setAttribute("aria-selected", String(li.dataset.value === state.font));
  }
}

function openFontMenu() {
  fontMenu.hidden = false;
  fontToggle.setAttribute("aria-expanded", "true");
  const items = Array.from(fontMenu.querySelectorAll<HTMLLIElement>("li"));
  const selected = items.find((li) => li.getAttribute("aria-selected") === "true") || items[0];
  selected?.focus();
}

function closeFontMenu() {
  fontMenu.hidden = true;
  fontToggle.setAttribute("aria-expanded", "false");
}

function focusFontOption(direction: 1 | -1) {
  const items = Array.from(fontMenu.querySelectorAll<HTMLLIElement>("li"));
  const focused = document.activeElement as HTMLLIElement;
  const idx = items.indexOf(focused);
  const nextIdx = idx === -1 ? 0 : (idx + direction + items.length) % items.length;
  items[nextIdx]?.focus();
}

function selectFontOption(li: HTMLLIElement) {
  state.font = li.dataset.value!;
  closeFontMenu();
  fontToggle.focus();
  updateFontPicker();
  persistState();
  render();
}

function setMode(mode: Mode) {
  state.mode = mode;
  for (const tab of tabs) {
    const isActive = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }
  typeControls.hidden = mode !== "type";
  const drawOnly = mode === "draw";
  weightControl.style.display = drawOnly ? "" : "none";
  pressureControl.style.display = drawOnly ? "" : "none";
  velocityControl.style.display = drawOnly ? "" : "none";
  flowControl.style.display = drawOnly ? "" : "none";
  canvas.style.cursor = mode === "draw" ? "crosshair" : "default";
  canvas.style.pointerEvents = mode === "draw" ? "auto" : "none";
  persistState();
  render();
}

interface ToastAction {
  label: string;
  onClick: () => void;
}

function hideToast() {
  toast.classList.remove("is-visible");
  window.setTimeout(() => (toast.hidden = true), 220);
}

function showToast(msg: string, action?: ToastAction, durationMs = 1800) {
  toast.innerHTML = "";
  const msgSpan = document.createElement("span");
  msgSpan.textContent = msg;
  toast.appendChild(msgSpan);
  if (action) {
    const btn = document.createElement("button");
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      action.onClick();
      hideToast();
    });
    toast.appendChild(btn);
  }
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  const ref = showToast as unknown as { t?: number };
  window.clearTimeout(ref.t);
  ref.t = window.setTimeout(hideToast, durationMs);
}

function getBounds(): { x: number; y: number; w: number; h: number } | null {
  if (state.mode === "draw") {
    if (state.strokes.length === 0) return null;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const s of state.strokes) {
      const outline = getStroke(s.points, strokeOptions(s));
      for (const [x, y] of outline) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (!isFinite(minX)) return null;
    const pad = 24;
    return {
      x: Math.max(0, minX - pad),
      y: Math.max(0, minY - pad),
      w: Math.min(canvas.clientWidth, maxX - minX + pad * 2),
      h: Math.min(canvas.clientHeight, maxY - minY + pad * 2),
    };
  } else {
    if (!state.name.trim()) return null;
    return { x: 0, y: 0, w: canvas.clientWidth, h: canvas.clientHeight };
  }
}

async function exportBlob(): Promise<Blob | null> {
  const bounds = getBounds();
  if (!bounds) return null;
  const scale = dpr;
  const off = document.createElement("canvas");
  off.width = Math.max(1, Math.floor(bounds.w * scale));
  off.height = Math.max(1, Math.floor(bounds.h * scale));
  const offCtx = off.getContext("2d")!;
  offCtx.scale(scale, scale);
  offCtx.translate(-bounds.x, -bounds.y);

  if (state.mode === "draw") {
    for (const s of state.strokes) renderStroke(offCtx, s);
  } else {
    renderText(offCtx, canvas.clientWidth, canvas.clientHeight);
  }

  return new Promise((resolve) => off.toBlob((b) => resolve(b), "image/png"));
}

async function downloadPNG() {
  const blob = await exportBlob();
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "hancock-signature.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Downloaded");
}

async function copyToClipboard() {
  const blob = await exportBlob();
  if (!blob) return;
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    showToast("Copied to clipboard");
  } catch {
    showToast("Copy not supported — use Download");
  }
}

let lastEventTime = 0;
let lastEventX = 0;
let lastEventY = 0;
let smoothedPressure = 0.7;

function computePressure(e: PointerEvent, isFirst: boolean): number {
  if (e.pointerType === "pen" && e.pressure > 0 && e.pressure !== 0.5) {
    return e.pressure;
  }
  if (isFirst) {
    smoothedPressure = 0.85;
    return smoothedPressure;
  }
  const now = e.timeStamp || performance.now();
  const dt = Math.max(1, now - lastEventTime);
  const dx = e.clientX - lastEventX;
  const dy = e.clientY - lastEventY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const v = dist / dt; // px per ms
  const raw = 1 - Math.min(1, v * 0.5);
  const clamped = Math.max(0.35, Math.min(1, raw));
  smoothedPressure = smoothedPressure * 0.7 + clamped * 0.3;
  return smoothedPressure;
}

function pointFromEvent(e: PointerEvent, isFirst = false): Point {
  const rect = canvas.getBoundingClientRect();
  const pressure = computePressure(e, isFirst);
  lastEventTime = e.timeStamp || performance.now();
  lastEventX = e.clientX;
  lastEventY = e.clientY;
  return [e.clientX - rect.left, e.clientY - rect.top, pressure];
}

function onPointerDown(e: PointerEvent) {
  if (state.mode !== "draw") return;
  canvas.setPointerCapture(e.pointerId);
  state.current = {
    points: [pointFromEvent(e, true)],
    color: state.color,
    size: state.size,
    flow: state.flow,
    pressure: state.pressure,
    velocityPressure: state.velocityPressure,
    pointerType: e.pointerType || "mouse",
  };
  render();
}

function onPointerMove(e: PointerEvent) {
  if (state.mode !== "draw" || !state.current) return;
  state.current.points.push(pointFromEvent(e));
  render();
}

function dismissMouseHint() {
  if (state.hintDismissed) return;
  state.hintDismissed = true;
  mouseHint.hidden = true;
  mouseHint.classList.remove("is-shown");
  persistState();
}

function onPointerUp() {
  if (state.mode !== "draw" || !state.current) return;
  if (state.current.points.length > 1) {
    // Pen-lift profile: ramp pressure up at the trailing points so the line
    // terminates with a soft rounded end instead of a needle from fast lift-off
    const points = state.current.points;
    const tailTargets = [0.65, 0.6, 0.55];
    for (let i = 0; i < tailTargets.length && points.length - 1 - i >= 0; i++) {
      const idx = points.length - 1 - i;
      const p = points[idx];
      points[idx] = [p[0], p[1], Math.max(p[2], tailTargets[i])];
    }
    state.strokes.push(state.current);
    dismissMouseHint();
    persistState();
  }
  state.current = null;
  render();
}

function undo() {
  if (state.mode !== "draw") return;
  if (state.strokes.length === 0) return;
  state.strokes.pop();
  persistState();
  render();
}

function clearAll() {
  if (state.mode === "draw") {
    if (state.strokes.length === 0) return;
    const backup = state.strokes.slice();
    state.strokes = [];
    state.current = null;
    persistState();
    render();
    showToast(
      "Cleared",
      {
        label: "Undo",
        onClick: () => {
          state.strokes = backup;
          persistState();
          render();
        },
      },
      5000
    );
  } else {
    if (!state.name.trim()) return;
    const backup = state.name;
    state.name = "";
    nameInput.value = "";
    persistState();
    render();
    showToast(
      "Cleared",
      {
        label: "Undo",
        onClick: () => {
          state.name = backup;
          nameInput.value = backup;
          persistState();
          render();
        },
      },
      5000
    );
  }
}

function init() {
  for (const tab of tabs) {
    tab.addEventListener("click", () => setMode(tab.dataset.mode as Mode));
  }
  linkLikeTab?.addEventListener("click", () => setMode("type"));

  if (
    !state.hintDismissed &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches
  ) {
    mouseHint.hidden = false;
    mouseHint.classList.add("is-shown");
  }

  let hasPresetMatch = false;
  for (const sw of swatches) {
    if (sw.classList.contains("swatch-custom")) continue;
    if (sw.dataset.color === state.color) {
      sw.classList.add("is-active");
      hasPresetMatch = true;
    }
    sw.addEventListener("click", () => {
      state.color = sw.dataset.color!;
      for (const s of swatches) s.classList.remove("is-active");
      sw.classList.add("is-active");
      customSwatchWrap.classList.remove("has-color");
      customClear.hidden = true;
      persistState();
      render();
    });
  }
  if (!hasPresetMatch && state.color) {
    customColor.value = state.color;
    customSwatchWrap.style.setProperty("--c", state.color);
    customSwatchWrap.classList.add("has-color", "is-active");
    customClear.hidden = false;
  }

  weightInput.value = String(state.size);
  weightInput.addEventListener("input", () => {
    state.size = Number(weightInput.value);
    persistState();
  });

  flowInput.value = String(state.flow);
  flowInput.addEventListener("input", () => {
    state.flow = Number(flowInput.value);
    for (const s of state.strokes) s.flow = state.flow;
    persistState();
    render();
  });

  pressureInput.value = String(state.pressure);
  pressureInput.addEventListener("input", () => {
    state.pressure = Number(pressureInput.value);
    for (const s of state.strokes) s.pressure = state.pressure;
    persistState();
    render();
  });

  function syncPressureEnabled() {
    pressureInput.disabled = !state.velocityPressure;
    pressureControl.classList.toggle("is-disabled", !state.velocityPressure);
  }

  velocityToggle.checked = state.velocityPressure;
  syncPressureEnabled();
  velocityToggle.addEventListener("change", () => {
    state.velocityPressure = velocityToggle.checked;
    for (const s of state.strokes) s.velocityPressure = state.velocityPressure;
    syncPressureEnabled();
    persistState();
    render();
  });

  updateFontPicker();
  fontToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (fontMenu.hidden) openFontMenu();
    else closeFontMenu();
  });
  fontToggle.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFontMenu();
    }
  });
  fontMenu.addEventListener("click", (e) => {
    const li = (e.target as HTMLElement).closest("li");
    if (li) selectFontOption(li as HTMLLIElement);
  });
  fontMenu.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusFontOption(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusFontOption(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const li = document.activeElement as HTMLLIElement;
      if (li.tagName === "LI") selectFontOption(li);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeFontMenu();
      fontToggle.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (!fontPicker.contains(e.target as Node)) closeFontMenu();
  });

  customColor.addEventListener("input", () => {
    state.color = customColor.value;
    customSwatchWrap.style.setProperty("--c", state.color);
    customSwatchWrap.classList.add("has-color");
    for (const s of swatches) s.classList.remove("is-active");
    customSwatchWrap.classList.add("is-active");
    customClear.hidden = false;
    persistState();
    render();
  });

  customClear.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const DEFAULT_COLOR = "#0a0a0a";
    state.color = DEFAULT_COLOR;
    customSwatchWrap.classList.remove("has-color", "is-active");
    customSwatchWrap.style.removeProperty("--c");
    customClear.hidden = true;
    for (const s of swatches) {
      const isMatch =
        !s.classList.contains("swatch-custom") && s.dataset.color === DEFAULT_COLOR;
      s.classList.toggle("is-active", isMatch);
    }
    persistState();
    render();
  });

  nameInput.value = state.name;
  nameInput.addEventListener("input", () => {
    state.name = nameInput.value;
    if (state.name.trim()) dismissMouseHint();
    persistState();
    render();
  });

  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearAll);
  downloadBtn.addEventListener("click", () => void downloadPNG());
  copyBtn.addEventListener("click", () => void copyToClipboard());

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      if (document.activeElement === nameInput) return;
      e.preventDefault();
      undo();
    }
  });

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);

  const ro = new ResizeObserver(() => sizeCanvas());
  ro.observe(canvas);

  setMode(state.mode);
  sizeCanvas();

  document.fonts.ready.then(() => render());
}

init();

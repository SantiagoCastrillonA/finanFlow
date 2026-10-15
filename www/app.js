/**
 * ==========================================================================
 * FinanFlow - Control de gastos personales
 * Script clásico único (sin bundler). index.html carga solo este archivo.
 * ==========================================================================
 */

/* ==========================================================================
   Configuración
   ========================================================================== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB1TR7ta9YJBRzVxohdJ0KoINTLOLEPhUI",
  authDomain: "finanflow-32cae.firebaseapp.com",
  projectId: "finanflow-32cae",
  storageBucket: "finanflow-32cae.firebasestorage.app",
  messagingSenderId: "119524136972",
  appId: "1:119524136972:web:711118945524e8c15e3629"
};

// Los ids se guardan en cada transacción: no renombrarlos.
const CATEGORIES = {
  expense: [
    { id: "Comida", label: "Comida", icon: "restaurant", color: "#FF9F0A" },
    { id: "Transporte", label: "Transporte", icon: "directions_car", color: "#0A84FF" },
    { id: "Compras", label: "Compras", icon: "shopping_bag", color: "#FF375F" },
    { id: "Hogar/Servicios", label: "Hogar", icon: "home", color: "#E5B800" },
    { id: "Entretenimiento", label: "Ocio", icon: "theater_comedy", color: "#BF5AF2" },
    { id: "Salud", label: "Salud", icon: "favorite", color: "#FF453A" },
    { id: "Educación", label: "Educación", icon: "school", color: "#40C8E0" },
    { id: "Suscripciones", label: "Suscripciones", icon: "autorenew", color: "#5E5CE6" },
    { id: "Otros", label: "Otros", icon: "more_horiz", color: "#8E8E93" }
  ],
  income: [
    { id: "Salario", label: "Salario", icon: "work", color: "#30D158" },
    { id: "Freelance", label: "Freelance", icon: "laptop_mac", color: "#66D4CF" },
    { id: "Inversiones", label: "Inversiones", icon: "trending_up", color: "#0A84FF" },
    { id: "Regalos", label: "Regalos", icon: "redeem", color: "#FF9F0A" },
    { id: "Otros", label: "Otros", icon: "more_horiz", color: "#8E8E93" }
  ]
};

const GEMINI_CONFIG = {
  // Alias que Google mantiene apuntando al Flash estable más reciente (evita que el asistente
  // deje de funcionar cuando retiran una versión fija).
  model: "gemini-flash-latest",
  maxTokens: 512,
  temperature: 0.7
};

const CURRENCY_CONFIG = {
  COP: { locale: "es-CO", fractionDigits: 0 },
  USD: { locale: "en-US", fractionDigits: 2 },
  EUR: { locale: "de-DE", fractionDigits: 2 },
  MXN: { locale: "es-MX", fractionDigits: 0 },
  ARS: { locale: "es-AR", fractionDigits: 0 },
  CLP: { locale: "es-CL", fractionDigits: 0 },
  PEN: { locale: "es-PE", fractionDigits: 2 }
};

const TAB_TITLES = { dashboard: "Inicio", transactions: "Historial", budgets: "Límites", settings: "Ajustes" };

const STORAGE_KEY = "finanflow_state";
const MIGRATED_KEY = "finanflow_migrated";
const THEME_KEY = "finanflow_theme";
const GEMINI_KEY = "finanflow_gemini_key";

/* ==========================================================================
   Plataforma nativa (Capacitor). En la PWA todos estos plugins son undefined.
   ========================================================================== */

const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const plugin = (name) => (window.Capacitor && window.Capacitor.Plugins ? window.Capacitor.Plugins[name] : undefined);

function haptic(kind = "light") {
  const Haptics = plugin("Haptics");
  if (Haptics) {
    const p = kind === "success" ? Haptics.notification({ type: "SUCCESS" }) : Haptics.impact({ style: "LIGHT" });
    p.catch(() => {});
  } else if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const centeredSheets = window.matchMedia("(min-width: 700px)");

/* ==========================================================================
   Estado y persistencia
   ========================================================================== */

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (e) {
    return null;
  }
}

const saved = loadState() || {};

const state = {
  currency: saved.currency || "COP",
  transactions: Array.isArray(saved.transactions) ? saved.transactions : [],
  budgets: saved.budgets || {},
  activeTab: TAB_TITLES[saved.activeTab] ? saved.activeTab : "dashboard",
  chartType: saved.chartType || "balance",
  lastUsed: saved.lastUsed || { expense: {}, income: {} },
  notify: Object.assign({ reminder: false, reminderTime: "20:00", budget: false, weekly: false }, saved.notify),
  notified: saved.notified || {},
  viewMonth: monthKey(new Date()),
  filters: { type: "all", category: "all", date: "month", search: "" },
  user: null,
  firebaseEnabled: false
};

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        currency: state.currency,
        transactions: state.transactions,
        budgets: state.budgets,
        activeTab: state.activeTab,
        chartType: state.chartType,
        lastUsed: state.lastUsed,
        notify: state.notify,
        notified: state.notified
      })
    );
  } catch (e) {
    showToast("No se pudo guardar en este dispositivo", "error");
  }
}

/** Punto único tras cualquier cambio de datos: persistir, pintar y avisar a lo nativo. */
function commit() {
  saveState();
  const before = captureRowPositions();
  render();
  playRowFlip(before);
  checkBudgetAlerts();
  refreshScheduledNotifications();
  syncWidget();
}

/* ==========================================================================
   Utilidades
   ========================================================================== */

const $ = (id) => document.getElementById(id);
function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO() {
  return toISODate(new Date());
}
function parseISO(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function monthKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
function addMonths(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
}
function daysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function monthLabel(ym, withYear = true) {
  const [y, m] = ym.split("-").map(Number);
  const opts = withYear ? { month: "long", year: "numeric" } : { month: "long" };
  const txt = new Date(y, m - 1, 1).toLocaleDateString("es-CO", opts).replace(" de ", " ");
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
// Las fechas son "YYYY-MM-DD": pertenecer a un mes es un prefijo.
const isInMonth = (dateStr, ym) => dateStr.startsWith(ym);

function currencyCfg() {
  return CURRENCY_CONFIG[state.currency] || CURRENCY_CONFIG.COP;
}
function formatMoney(amount, currency = state.currency) {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.COP;
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: cfg.fractionDigits,
    maximumFractionDigits: cfg.fractionDigits
  }).format(amount);
}
function formatCompact(amount) {
  const cfg = currencyCfg();
  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: state.currency,
    notation: "compact",
    maximumFractionDigits: 1
  }).format(amount);
}
function getCurrencySymbol() {
  const cfg = currencyCfg();
  const part = new Intl.NumberFormat(cfg.locale, { style: "currency", currency: state.currency })
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part ? part.value : "$";
}
function roundMoney(amount) {
  const f = 10 ** currencyCfg().fractionDigits;
  return Math.round(amount * f) / f;
}
function sumAmounts(list) {
  return roundMoney(list.reduce((s, t) => s + (Number(t.amount) || 0), 0));
}

/* Campo de monto con separador de miles mientras se escribe (p. ej. 3.200.000). */
function separators() {
  const parts = new Intl.NumberFormat(currencyCfg().locale).formatToParts(1234567.8);
  return {
    group: (parts.find((p) => p.type === "group") || { value: "." }).value,
    decimal: (parts.find((p) => p.type === "decimal") || { value: "," }).value
  };
}
function formatAmountInput(raw) {
  const { group, decimal } = separators();
  const digits = currencyCfg().fractionDigits;
  // Quitar los separadores de miles ya puestos; con decimales, "." o "," cuentan como decimal.
  let clean = raw.split(group).join("");
  if (digits) clean = clean.replace(/[.,]/g, decimal);
  clean = clean.replace(new RegExp(`[^0-9${digits ? "\\" + decimal : ""}]`, "g"), "");
  const [first, ...rest] = digits ? clean.split(decimal) : [clean];
  const decPart = rest.length ? rest.join("").slice(0, digits) : null;
  const intPart = first.replace(/^0+(?=\d)/, "");
  if (!intPart && decPart === null) return "";
  const grouped = new Intl.NumberFormat(currencyCfg().locale, { maximumFractionDigits: 0 }).format(Number(intPart || 0));
  return decPart === null ? grouped : `${grouped}${decimal}${decPart}`;
}
function parseAmountInput(str) {
  const { group, decimal } = separators();
  const normalized = str.split(group).join("").replace(decimal, ".");
  const n = parseFloat(normalized);
  return isNaN(n) ? NaN : roundMoney(n);
}
function amountToInput(amount) {
  return formatAmountInput(
    new Intl.NumberFormat(currencyCfg().locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: currencyCfg().fractionDigits,
      useGrouping: false
    }).format(amount)
  );
}

function getCategoryInfo(catId, type = "expense") {
  return (
    (CATEGORIES[type] || []).find((c) => c.id === catId) || {
      id: catId,
      label: catId,
      icon: "payments",
      color: "#8E8E93"
    }
  );
}
function formatDateFriendly(dateStr) {
  const today = todayISO();
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  if (dateStr === today) return "Hoy";
  if (dateStr === toISODate(yest)) return "Ayer";
  return parseISO(dateStr).toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}
function formatDateGroupHeader(dateStr) {
  const friendly = formatDateFriendly(dateStr);
  if (friendly === "Hoy" || friendly === "Ayer") return friendly;
  const d = parseISO(dateStr);
  const opts = { weekday: "long", day: "numeric", month: "long" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  const txt = d.toLocaleDateString("es-CO", opts);
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
function generateId(prefix = "tx") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function byDateDesc(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  return (b.createdAt || 0) - (a.createdAt || 0);
}
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ==========================================================================
   Cálculos (una pasada por render)
   ========================================================================== */

function monthStats(ym, untilDay = 31) {
  let income = 0;
  let expense = 0;
  const byCat = { expense: {}, income: {} };
  for (const t of state.transactions) {
    if (!isInMonth(t.date, ym) || Number(t.date.slice(8, 10)) > untilDay) continue;
    const a = Number(t.amount) || 0;
    if (t.type === "income") income += a;
    else expense += a;
    byCat[t.type][t.category] = (byCat[t.type][t.category] || 0) + a;
  }
  return { income: roundMoney(income), expense: roundMoney(expense), byCat };
}

/** Saldo acumulado de todas las transacciones con fecha <= dateStr. */
function balanceUntil(dateStr) {
  let total = 0;
  for (const t of state.transactions) {
    if (t.date <= dateStr) total += t.type === "income" ? Number(t.amount) || 0 : -(Number(t.amount) || 0);
  }
  return roundMoney(total);
}

function budgetUsage(stats) {
  return Object.keys(state.budgets).map((cat) => {
    const limit = Number(state.budgets[cat]) || 0;
    const spent = stats.byCat.expense[cat] || 0;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    return { cat, limit, spent, pct, level: pct >= 100 ? "danger" : pct >= 80 ? "warning" : "safe" };
  });
}

/* ==========================================================================
   Tema (preferencia dark | light | system, separada del tema aplicado)
   ========================================================================== */

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function getThemePref() {
  return localStorage.getItem(THEME_KEY) || "system";
}
function applyThemePref(pref) {
  localStorage.setItem(THEME_KEY, pref);
  const theme = pref === "system" ? (darkQuery.matches ? "dark" : "light") : pref;
  const changed = document.documentElement.getAttribute("data-theme") !== theme;
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#000000" : "#F2F2F7");
  const select = $("settings-theme");
  if (select) select.value = pref;
  if (changed && (charts.category || charts.trend)) resetCharts();
}
function initTheme() {
  applyThemePref(getThemePref());
  darkQuery.addEventListener("change", () => {
    if (getThemePref() === "system") applyThemePref("system");
  });
}

/* ==========================================================================
   Toasts (con acción opcional, p. ej. Deshacer)
   ========================================================================== */

function showToast(message, type = "info", duration = 3000, action = null) {
  let container = $("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("aria-live", "polite");
    document.body.appendChild(container);
  }
  const icons = { info: "info", success: "check_circle", warning: "warning", error: "error" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `<span class="ms toast-icon">${icons[type] || "info"}</span><span class="toast-message"></span>`;
  toast.querySelector(".toast-message").textContent = message;

  let timer;
  let remaining = duration;
  let shownAt = Date.now();
  const dismiss = () => {
    clearTimeout(timer);
    if (toast.classList.contains("leaving")) return;
    toast.classList.remove("dragging");
    toast.style.transform = "";
    toast.style.opacity = "";
    toast.classList.add("leaving");
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  };

  // Deslizar hacia abajo para cerrar (sale por donde entró).
  let startY = null;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  toast.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".toast-action")) return;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    velocity = 0;
    clearTimeout(timer);
    remaining -= Date.now() - shownAt;
    toast.setPointerCapture(e.pointerId);
  });
  toast.addEventListener("pointermove", (e) => {
    if (startY === null) return;
    const dy = e.clientY - startY;
    velocity = 0.8 * ((e.clientY - lastY) / Math.max(1, e.timeStamp - lastT)) + 0.2 * velocity;
    lastY = e.clientY;
    lastT = e.timeStamp;
    if (Math.abs(dy) < 6 && !toast.classList.contains("dragging")) return;
    toast.classList.add("dragging");
    toast.style.transform = `translateY(${dy > 0 ? dy : dy * 0.2}px)`;
    toast.style.opacity = String(Math.max(0, 1 - Math.max(dy, 0) / 120));
  });
  const release = () => {
    if (startY === null) return;
    const dy = lastY - startY;
    startY = null;
    if (dy > 40 || (velocity > 0.11 && dy > 10)) return dismiss();
    toast.classList.remove("dragging");
    toast.style.transform = "";
    toast.style.opacity = "";
    shownAt = Date.now();
    timer = setTimeout(dismiss, Math.max(remaining, 1500));
  };
  toast.addEventListener("pointerup", release);
  toast.addEventListener("pointercancel", release);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "toast-action";
    btn.textContent = action.label;
    btn.onclick = () => {
      action.onClick();
      dismiss();
    };
    toast.appendChild(btn);
  }

  container.appendChild(toast);
  while (container.children.length > 3) container.firstElementChild.remove();
  void toast.offsetWidth; // fija el estado inicial para que la transición corra
  toast.classList.add("show");
  shownAt = Date.now();
  timer = setTimeout(dismiss, duration);
}

/* ==========================================================================
   Modales (hojas inferiores y diálogos) con pila para Atrás / Escape
   ========================================================================== */

const modalStack = [];

function openModal(id, focusId = null) {
  const modal = $(id);
  if (!modal || modal.classList.contains("open")) return;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  modalStack.push(id);
  if (focusId) {
    // Enfocar después de la entrada: si el teclado sale a mitad de la animación, la hoja salta.
    setTimeout(() => $(focusId)?.focus({ preventScroll: true }), reduceMotion.matches ? 0 : 360);
  }
}
function closeModal(id) {
  const modal = $(id);
  if (!modal || !modal.classList.contains("open")) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  const panel = modal.querySelector(".sheet");
  if (panel) panel.style.transform = "";
  const i = modalStack.lastIndexOf(id);
  if (i !== -1) modalStack.splice(i, 1);
  if (document.activeElement && modal.contains(document.activeElement)) document.activeElement.blur();
}
function closeTopModal() {
  if (!modalStack.length) return false;
  closeModal(modalStack[modalStack.length - 1]);
  return true;
}

function showConfirmDialog(title, message, onConfirm, confirmLabel = "Confirmar") {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  const actionBtn = $("confirm-action-btn");
  actionBtn.textContent = confirmLabel;
  actionBtn.onclick = () => {
    closeModal("confirm-modal");
    onConfirm();
  };
  openModal("confirm-modal");
}

/** Arrastrar hacia abajo para cerrar: sigue al dedo y decide por distancia o velocidad. */
function setupSheetGesture(sheet) {
  let startY = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let tracking = false;
  let dragging = false;

  sheet.addEventListener(
    "touchstart",
    (e) => {
      // Solo arrastrar si nada entre el dedo y la hoja está desplazado (p. ej. el chat de FinanBot).
      let scrolled = false;
      for (let el = e.target; el && el !== sheet.parentElement; el = el.parentElement) {
        if (el.scrollTop > 0) scrolled = true;
      }
      // En tablet las hojas son ventanas centradas: no se arrastran.
      tracking = !centeredSheets.matches && !scrolled && !e.target.closest("input, select, textarea");
      dragging = false;
      startY = lastY = e.touches[0].clientY;
      lastT = e.timeStamp;
      velocity = 0;
    },
    { passive: true }
  );

  sheet.addEventListener(
    "touchmove",
    (e) => {
      if (!tracking) return;
      const y = e.touches[0].clientY;
      const dy = y - startY;
      if (!dragging) {
        if (dy > 6) {
          dragging = true;
          sheet.classList.add("dragging");
        } else if (dy < -6) {
          tracking = false; // es un scroll hacia arriba del contenido
          return;
        } else {
          return;
        }
      }
      e.preventDefault();
      const dt = Math.max(1, e.timeStamp - lastT);
      // Velocidad suavizada: un solo evento ruidoso no decide el gesto.
      velocity = 0.8 * ((y - lastY) / dt) + 0.2 * velocity;
      lastY = y;
      lastT = e.timeStamp;
      // Hacia arriba: fricción creciente que nunca pasa de ~60 px.
      const offset = dy > 0 ? dy : -(1 - 1 / (1 + Math.abs(dy) / 120)) * 60;
      sheet.style.transform = `translateY(${offset}px)`;
    },
    { passive: false }
  );

  const end = () => {
    if (!tracking || !dragging) {
      tracking = false;
      return;
    }
    tracking = false;
    dragging = false;
    sheet.classList.remove("dragging");
    const dy = lastY - startY;
    const height = sheet.offsetHeight;
    if (dy > height * 0.25 || (velocity > 0.11 && dy > 10)) {
      // La salida conserva el impulso del dedo: más rápido el gesto, más corta la animación.
      const ms = Math.min(300, Math.max(150, (height - dy) / Math.max(velocity, 0.5)));
      sheet.style.transitionDuration = `${Math.round(ms)}ms`;
      setTimeout(() => (sheet.style.transitionDuration = ""), ms + 50);
      closeModal(sheet.closest(".modal").id);
    } else {
      sheet.style.transform = "";
    }
  };
  sheet.addEventListener("touchend", end);
  sheet.addEventListener("touchcancel", end);
}

/* ==========================================================================
   Control segmentado (indicador deslizante)
   ========================================================================== */

function setupSegmented(el, onChange) {
  const buttons = [...el.querySelectorAll("button")];
  const thumb = document.createElement("span");
  thumb.className = "seg-thumb";
  thumb.style.width = `calc((100% - 4px) / ${buttons.length})`;
  el.prepend(thumb);
  buttons.forEach((b) => {
    b.type = "button";
    b.addEventListener("click", () => {
      if (b.classList.contains("active")) return;
      setSegmented(el, b.dataset.value);
      onChange(b.dataset.value);
    });
  });
}
function setSegmented(el, value) {
  const buttons = [...el.querySelectorAll("button")];
  const i = Math.max(0, buttons.findIndex((b) => b.dataset.value === value));
  buttons.forEach((b, j) => {
    b.classList.toggle("active", i === j);
    b.setAttribute("aria-pressed", String(i === j));
  });
  const thumb = el.querySelector(".seg-thumb");
  if (thumb) thumb.style.transform = `translateX(${i * 100}%)`;
}

/* ==========================================================================
   Gráficos (Chart.js local). Se actualizan con update() en vez de recrearse.
   ========================================================================== */

const charts = { category: null, trend: null };

const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart) {
    const lines = chart.$center || [];
    if (!lines.length) return;
    const { ctx, chartArea } = chart;
    const x = (chartArea.left + chartArea.right) / 2;
    const y = (chartArea.top + chartArea.bottom) / 2;
    const size = Math.min(chartArea.width / 9, 17);
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = cssVar("--text-secondary");
    ctx.font = `500 ${size * 0.72}px ${cssVar("--font")}`;
    ctx.fillText(lines[0], x, y - size * 0.6);
    ctx.fillStyle = cssVar("--text");
    ctx.font = `700 ${size}px ${cssVar("--font")}`;
    ctx.fillText(lines[1] || "", x, y + size * 0.45);
    ctx.restore();
  }
};

function chartAnimation() {
  return reduceMotion.matches ? false : { duration: 400, easing: "easeOutQuart" };
}
function resetCharts() {
  if (charts.category) charts.category.destroy();
  if (charts.trend) charts.trend.destroy();
  charts.category = charts.trend = null;
  if ($("tab-dashboard").classList.contains("active")) renderCharts(monthStats(state.viewMonth));
}
function toggleChartEmpty(canvasId, emptyId, empty, text) {
  $(canvasId).classList.toggle("hidden", empty);
  const box = $(emptyId);
  box.classList.toggle("hidden", !empty);
  if (text) box.querySelector("p").textContent = text;
}

function renderCharts(stats) {
  if (typeof Chart === "undefined") {
    toggleChartEmpty("categoryChart", "no-chart-data", true, "Gráficos no disponibles");
    toggleChartEmpty("trendChart", "no-trend-data", true, "Gráficos no disponibles");
    return;
  }
  renderCategoryChart(stats);
  renderTrendChart();
}

function renderCategoryChart(stats) {
  const type = state.chartType;
  let ids;
  let labels;
  let data;
  let colors;
  let center;

  if (type === "balance") {
    ids = ["income", "expense"];
    labels = ["Ingresos", "Gastos"];
    data = [stats.income, stats.expense];
    colors = [cssVar("--income"), cssVar("--expense")];
    const net = stats.income - stats.expense;
    center = ["Neto", (net > 0 ? "+" : "") + formatCompact(net)];
  } else {
    const entries = Object.entries(stats.byCat[type]).sort((a, b) => b[1] - a[1]);
    ids = entries.map((e) => e[0]);
    labels = ids.map((id) => getCategoryInfo(id, type).label);
    data = entries.map((e) => e[1]);
    colors = ids.map((id) => getCategoryInfo(id, type).color);
    const total = data.reduce((s, v) => s + v, 0);
    center = ["Total", formatCompact(total)];
  }

  const empty = data.every((v) => !v);
  const emptyText = { balance: "Sin movimientos este mes", expense: "Sin gastos este mes", income: "Sin ingresos este mes" }[type];
  toggleChartEmpty("categoryChart", "no-chart-data", empty, emptyText);
  if (empty) return;

  if (!charts.category) {
    charts.category = new Chart($("categoryChart"), {
      type: "doughnut",
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6, spacing: 2, borderRadius: 4 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        animation: chartAnimation(),
        onClick: (evt, elements, chart) => {
          if (elements.length) drillDown(chart.$ids[elements[0].index]);
        },
        onHover: (evt, elements) => {
          evt.native.target.style.cursor = elements.length ? "pointer" : "default";
        },
        plugins: {
          legend: {
            position: "right",
            onClick: (evt, item, legend) => drillDown(legend.chart.$ids[item.index]),
            labels: { color: cssVar("--text"), usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 12, font: { family: cssVar("--font"), size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const sum = ctx.dataset.data.reduce((s, v) => s + v, 0);
                return ` ${formatMoney(ctx.raw)} (${((ctx.raw / sum) * 100).toFixed(0)}%)`;
              }
            }
          }
        }
      },
      plugins: [centerTextPlugin]
    });
    charts.category.$ids = ids;
    charts.category.$center = center;
  } else {
    const chart = charts.category;
    chart.$ids = ids;
    chart.$center = center;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();
  }
}

function renderTrendChart() {
  if (!state.transactions.length) {
    toggleChartEmpty("trendChart", "no-trend-data", true);
    return;
  }
  toggleChartEmpty("trendChart", "no-trend-data", false);

  const current = monthKey(new Date());
  const end = state.viewMonth === current ? new Date() : parseISO(`${state.viewMonth}-${pad(daysInMonth(state.viewMonth))}`);
  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    labels.push(d.toLocaleDateString("es-CO", { day: "numeric", month: "short" }).replace(" de ", " ").replace(".", ""));
    data.push(balanceUntil(toISODate(d)));
  }

  const accent = cssVar("--accent");
  if (!charts.trend) {
    const ctx = $("trendChart").getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, accent + "40");
    gradient.addColorStop(1, accent + "00");
    charts.trend = new Chart($("trendChart"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          data,
          borderColor: accent,
          borderWidth: 2.5,
          backgroundColor: gradient,
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 20,
          pointBackgroundColor: accent
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimation(),
        interaction: { intersect: false, mode: "index" },
        scales: {
          y: {
            grid: { color: cssVar("--separator") },
            border: { display: false },
            ticks: { color: cssVar("--text-secondary"), font: { family: cssVar("--font"), size: 11 }, maxTicksLimit: 4, callback: (v) => formatCompact(v) }
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: cssVar("--text-secondary"), font: { family: cssVar("--font"), size: 11 }, maxRotation: 0, autoSkipPadding: 8 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` Saldo: ${formatMoney(ctx.raw)}` } }
        }
      }
    });
  } else {
    charts.trend.data.labels = labels;
    charts.trend.data.datasets[0].data = data;
    charts.trend.update();
  }
}

/** Tocar la dona lleva al Historial filtrado por esa categoría (o tipo) y el mes visto. */
function drillDown(id) {
  if (!id) return;
  const f = state.filters;
  if (state.chartType === "balance") {
    f.type = id;
    f.category = "all";
  } else {
    f.type = state.chartType;
    f.category = id;
  }
  f.search = "";
  f.date = state.viewMonth === monthKey(new Date()) ? "month" : `m:${state.viewMonth}`;
  haptic();
  switchTab("transactions");
}

/* ==========================================================================
   Render
   ========================================================================== */

let lastChangedId = null; // fila que entra animada tras guardar / deshacer
let prevAlertKeys = new Set();
let budgetsAnimated = false;

function render() {
  const stats = monthStats(state.viewMonth);
  renderDashboard(stats);
  renderTransactionsList();
  renderBudgetsList(stats);
  updateFirebaseStatusUI();
  const sym = getCurrencySymbol();
  $("modal-currency-symbol").textContent = sym;
  $("budget-currency-symbol").textContent = sym;
}

function renderDashboard(stats) {
  const current = monthKey(new Date());
  const isCurrent = state.viewMonth === current;
  $("month-label").textContent = monthLabel(state.viewMonth, state.viewMonth.slice(0, 4) !== current.slice(0, 4));
  $("month-next").disabled = isCurrent;

  const endOfView = isCurrent ? todayISO() : `${state.viewMonth}-31`;
  setAnimatedText($("total-balance"), formatMoney(balanceUntil(endOfView)));
  $("balance-label").textContent = isCurrent ? "Saldo" : `Saldo al cierre de ${monthLabel(state.viewMonth, false).toLowerCase()}`;
  setAnimatedText($("total-incomes"), formatMoney(stats.income));
  setAnimatedText($("total-expenses"), formatMoney(stats.expense));

  renderComparison(stats, isCurrent);
  renderAllowance(stats, isCurrent);
  renderBudgetAlerts(stats);
  renderRecentTransactions();
  // Chart.js mide el canvas al crearse: solo dibujar con la pestaña visible.
  if ($("tab-dashboard").classList.contains("active")) renderCharts(stats);
}

function renderComparison(stats, isCurrent) {
  const el = $("month-compare");
  const prevYM = addMonths(state.viewMonth, -1);
  // En el mes en curso se compara contra el mismo tramo del mes anterior (día 1 → hoy).
  const prev = monthStats(prevYM, isCurrent ? new Date().getDate() : 31);
  if (!prev.expense || !stats.expense) {
    el.classList.add("hidden");
    return;
  }
  const diff = ((stats.expense - prev.expense) / prev.expense) * 100;
  const name = monthLabel(prevYM, false).toLowerCase();
  const pct = Math.abs(Math.round(diff));
  el.classList.remove("hidden", "good", "bad");
  if (pct === 0) {
    el.textContent = `Gastos iguales que en ${name}${isCurrent ? " a esta fecha" : ""}`;
  } else {
    el.classList.add(diff < 0 ? "good" : "bad");
    el.innerHTML = `<span class="ms">${diff < 0 ? "south_east" : "north_east"}</span>Gastos ${pct}% ${diff < 0 ? "menos" : "más"} que en ${name}${isCurrent ? " a esta fecha" : ""}`;
  }
}

function renderAllowance(stats, isCurrent) {
  const el = $("daily-allowance");
  const cats = Object.keys(state.budgets);
  if (!isCurrent || !cats.length) {
    el.classList.add("hidden");
    return;
  }
  const limit = cats.reduce((s, c) => s + Number(state.budgets[c]), 0);
  const spent = cats.reduce((s, c) => s + (stats.byCat.expense[c] || 0), 0);
  const remaining = limit - spent;
  const daysLeft = daysInMonth(state.viewMonth) - new Date().getDate() + 1;
  el.classList.remove("hidden");
  el.classList.toggle("bad", remaining <= 0);
  if (!el.firstElementChild) el.innerHTML = '<span class="allowance-value"></span><span class="allowance-label"></span>';
  const [value, label] = el.children;
  if (remaining > 0) {
    setAnimatedText(value, formatMoney(roundMoney(remaining / daysLeft)));
    label.textContent = `disponible por día · ${daysLeft} ${daysLeft === 1 ? "día" : "días"} restantes`;
  } else {
    setAnimatedText(value, formatMoney(Math.abs(remaining)));
    label.textContent = "por encima de tus límites este mes";
  }
}

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

/* FLIP: al re-renderizar, las filas que siguen existiendo se deslizan desde donde estaban. */
function captureRowPositions() {
  const map = new Map();
  if (reduceMotion.matches) return map;
  document.querySelectorAll(".tx-row[data-id]").forEach((row) => {
    if (row.offsetParent) map.set(`${row.parentElement.closest("[id]").id}:${row.dataset.id}`, row.getBoundingClientRect().top);
  });
  return map;
}
function playRowFlip(before) {
  if (!before.size) return;
  document.querySelectorAll(".tx-row[data-id]").forEach((row) => {
    const prev = before.get(`${row.parentElement.closest("[id]").id}:${row.dataset.id}`);
    if (prev === undefined || !row.offsetParent) return;
    const delta = prev - row.getBoundingClientRect().top;
    if (delta && Math.abs(delta) < 400) {
      row.animate([{ transform: `translateY(${delta}px)` }, { transform: "none" }], { duration: 250, easing: EASE_OUT });
    }
  });
}

/** Cambia una cifra con un cruce suave (fundido + 6 px + desenfoque de 2 px que disimula la superposición). */
function setAnimatedText(el, text) {
  if (el.textContent === text) return;
  const firstPaint = !el.dataset.painted;
  el.textContent = text;
  el.dataset.painted = "1";
  if (firstPaint || document.hidden || !$("tab-dashboard").classList.contains("active")) return;
  const frames = reduceMotion.matches
    ? [{ opacity: 0.5 }, { opacity: 1 }]
    : [
        { opacity: 0, transform: "translateY(6px)", filter: "blur(2px)" },
        { opacity: 1, transform: "none", filter: "blur(0)" }
      ];
  el.animate(frames, { duration: reduceMotion.matches ? 150 : 220, easing: EASE_OUT });
}

function renderBudgetAlerts(stats) {
  const container = $("budget-alerts");
  const alerts = budgetUsage(stats).filter((u) => u.level !== "safe");
  const keys = new Set(alerts.map((a) => `${a.cat}:${a.level}`));
  container.innerHTML = "";
  alerts.forEach((a) => {
    const info = getCategoryInfo(a.cat);
    const div = document.createElement("button");
    div.type = "button";
    div.className = `alert-row ${a.level}`;
    if (!prevAlertKeys.has(`${a.cat}:${a.level}`)) div.classList.add("is-new");
    div.innerHTML = `
      <span class="ms">${a.level === "danger" ? "error" : "warning"}</span>
      <span class="alert-text"><strong>${escapeHtml(info.label)}</strong> ${a.level === "danger" ? "superó su límite" : "está cerca del límite"} · ${Math.round(a.pct)}%</span>
      <span class="ms chevron">chevron_right</span>`;
    div.onclick = () => switchTab("budgets");
    container.appendChild(div);
  });
  prevAlertKeys = keys;
  container.classList.toggle("hidden", !alerts.length);
}

function emptyStateHTML(icon, title, text, actionLabel) {
  return `
    <div class="empty-state">
      <span class="ms">${icon}</span>
      <p class="empty-title">${title}</p>
      ${text ? `<p class="empty-text">${text}</p>` : ""}
      ${actionLabel ? `<button type="button" class="btn-tinted" data-empty-action>${actionLabel}</button>` : ""}
    </div>`;
}

function renderRecentTransactions() {
  const container = $("recent-transactions-list");
  const sorted = [...state.transactions].sort(byDateDesc).slice(0, 5);
  container.innerHTML = "";
  if (!sorted.length) {
    container.innerHTML = emptyStateHTML("receipt_long", "Aún no hay movimientos", "Registra tu primer gasto o ingreso.", "Agregar movimiento");
    container.querySelector("[data-empty-action]").onclick = () => openTransactionModal();
    return;
  }
  sorted.forEach((t) => container.appendChild(txRow(t, true)));
}

function txRow(t, showDate) {
  const cat = getCategoryInfo(t.category, t.type);
  const el = document.createElement("button");
  el.type = "button";
  el.className = "list-row tx-row";
  el.dataset.id = t.id;
  if (t.id === lastChangedId) el.classList.add("is-new");
  const sub = [cat.label, t.method, showDate ? formatDateFriendly(t.date) : null].filter(Boolean).map(escapeHtml).join(" · ");
  const repeat = t.recurring || t.recurringOf ? '<span class="ms row-badge" aria-label="Recurrente">repeat</span>' : "";
  el.innerHTML = `
    <span class="row-icon" style="color:${cat.color};background:${cat.color}24"><span class="ms">${cat.icon}</span></span>
    <span class="row-main">
      <span class="row-title">${escapeHtml(t.note || cat.label)}</span>
      <span class="row-sub">${sub}</span>
    </span>
    <span class="row-amount ${t.type}">${repeat}${t.type === "income" ? "+" : ""}${formatMoney(t.amount)}</span>`;
  el.onclick = () => openTransactionModal(t.id);
  return el;
}

function matchesDateFilter(dateStr, filter) {
  if (filter === "all") return true;
  const today = todayISO();
  const cur = monthKey(new Date());
  if (filter.startsWith("m:")) return isInMonth(dateStr, filter.slice(2));
  switch (filter) {
    case "today":
      return dateStr === today;
    case "yesterday": {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      return dateStr === toISODate(y);
    }
    case "week": {
      const w = new Date();
      w.setDate(w.getDate() - 6);
      return dateStr >= toISODate(w) && dateStr <= today;
    }
    case "month":
      return isInMonth(dateStr, cur);
    case "last-month":
      return isInMonth(dateStr, addMonths(cur, -1));
    default:
      return true;
  }
}

function syncFilterControls() {
  const f = state.filters;
  setSegmented($("type-filter"), f.type);
  $("filter-category").value = f.category;
  $("search-input").value = f.search;
  const custom = $("chip-custom-month");
  const isCustom = f.date.startsWith("m:");
  custom.classList.toggle("hidden", !isCustom);
  if (isCustom) {
    custom.dataset.value = f.date;
    custom.textContent = monthLabel(f.date.slice(2));
  }
  document.querySelectorAll("#date-filter-chips .chip").forEach((c) => {
    const on = c.dataset.value === f.date;
    c.classList.toggle("active", on);
    c.setAttribute("aria-pressed", String(on));
  });
}

function renderTransactionsList() {
  const container = $("all-transactions-list");
  const f = state.filters;
  const q = f.search.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  const filtered = state.transactions
    .filter((t) => {
      if (f.type !== "all" && t.type !== f.type) return false;
      if (f.category !== "all" && t.category !== f.category) return false;
      if (!matchesDateFilter(t.date, f.date)) return false;
      if (q) {
        const cat = getCategoryInfo(t.category, t.type).label.toLowerCase();
        const text = `${t.note || ""} ${cat} ${t.method || ""}`.toLowerCase();
        const amountHit = qDigits && String(Math.round(t.amount)).includes(qDigits);
        if (!text.includes(q) && !amountHit) return false;
      }
      return true;
    })
    .sort(byDateDesc);

  const summary = $("filter-summary");
  container.innerHTML = "";
  if (!filtered.length) {
    summary.textContent = "";
    const hasAny = state.transactions.length > 0;
    container.innerHTML = hasAny
      ? emptyStateHTML("search_off", "Sin resultados", "Prueba con otro filtro o búsqueda.", "Limpiar filtros")
      : emptyStateHTML("receipt_long", "Aún no hay movimientos", "Registra tu primer gasto o ingreso.", "Agregar movimiento");
    container.querySelector("[data-empty-action]").onclick = hasAny ? clearFilters : () => openTransactionModal();
    return;
  }

  const spent = sumAmounts(filtered.filter((t) => t.type === "expense"));
  const earned = sumAmounts(filtered.filter((t) => t.type === "income"));
  const parts = [`${filtered.length} ${filtered.length === 1 ? "movimiento" : "movimientos"}`];
  if (earned) parts.push(`+${formatMoney(earned)}`);
  if (spent) parts.push(`−${formatMoney(spent)}`);
  summary.textContent = parts.join(" · ");

  let group = null;
  let groupDate = null;
  filtered.forEach((t) => {
    if (t.date !== groupDate) {
      groupDate = t.date;
      const header = document.createElement("h3");
      header.className = "group-header";
      header.textContent = formatDateGroupHeader(t.date);
      container.appendChild(header);
      group = document.createElement("div");
      group.className = "list-group";
      container.appendChild(group);
    }
    group.appendChild(txRow(t, false));
  });
}

function clearFilters() {
  state.filters = { type: "all", category: "all", date: "all", search: "" };
  syncFilterControls();
  renderTransactionsList();
}

function renderBudgetsList(stats) {
  const container = $("budgets-list");
  $("budgets-month").textContent = monthLabel(state.viewMonth);
  container.innerHTML = "";
  const usage = budgetUsage(stats);
  if (!usage.length) {
    container.innerHTML = emptyStateHTML("savings", "Sin límites todavía", "Define cuánto quieres gastar al mes por categoría y te avisaremos al acercarte.", "Crear límite");
    container.querySelector("[data-empty-action]").onclick = () => openBudgetModal();
    return;
  }
  const animate = !budgetsAnimated && state.activeTab === "budgets" && !reduceMotion.matches;
  usage
    .sort((a, b) => b.pct - a.pct)
    .forEach((u, i) => {
      const info = getCategoryInfo(u.cat);
      const remaining = u.limit - u.spent;
      const status = u.level === "danger" ? `Excedido por ${formatMoney(-remaining)}` : `Quedan ${formatMoney(remaining)}`;
      const row = document.createElement("button");
      row.type = "button";
      row.className = `budget-row ${u.level}`;
      row.innerHTML = `
        <div class="budget-top">
          <span class="row-icon" style="color:${info.color};background:${info.color}24"><span class="ms">${info.icon}</span></span>
          <span class="row-main">
            <span class="row-title">${escapeHtml(info.label)}</span>
            <span class="row-sub">${formatMoney(u.spent)} de ${formatMoney(u.limit)}</span>
          </span>
          <span class="budget-pct">${Math.round(u.pct)}%</span>
        </div>
        <div class="progress"><div class="progress-fill" style="transform:scaleX(${Math.min(u.pct, 100) / 100})${animate ? `;transition-delay:${Math.min(i, 4) * 40}ms` : ""}"></div></div>
        <span class="budget-status">${status}</span>`;
      row.onclick = () => openBudgetModal(u.cat);
      container.appendChild(row);
    });
  if (animate) {
    budgetsAnimated = true;
    container.classList.add("animate-in");
    setTimeout(() => container.classList.remove("animate-in"), 900);
  }
}

/* ==========================================================================
   Navegación
   ========================================================================== */

function switchTab(tabId) {
  if (!TAB_TITLES[tabId]) tabId = "dashboard";
  const changed = state.activeTab !== tabId;
  state.activeTab = tabId;
  document.querySelectorAll(".tab-view").forEach((t) => t.classList.toggle("active", t.id === `tab-${tabId}`));
  document.querySelectorAll(".nav-item[data-tab]").forEach((b) => {
    const on = b.dataset.tab === tabId;
    b.classList.toggle("active", on);
    if (on) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  $("page-title").textContent = TAB_TITLES[tabId];
  $("app-content").scrollTop = 0;

  if (tabId === "dashboard") renderCharts(monthStats(state.viewMonth));
  if (tabId === "transactions") {
    syncFilterControls();
    renderTransactionsList();
  }
  if (tabId === "budgets") renderBudgetsList(monthStats(state.viewMonth));
  if (changed) saveState();
}

function changeMonth(delta) {
  const next = addMonths(state.viewMonth, delta);
  if (next > monthKey(new Date())) return;
  state.viewMonth = next;
  haptic();
  render();
  // El mes entra desde el lado de la flecha pulsada: anterior desde la izquierda, siguiente desde la derecha.
  const from = reduceMotion.matches ? "none" : `translateX(${delta < 0 ? -12 : 12}px)`;
  $("month-label").animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: 200, easing: EASE_OUT });
}

/* ==========================================================================
   Transacciones
   ========================================================================== */

const txSheet = { type: "expense", category: null, editing: null };

function renderCategoryGrid() {
  const grid = $("tx-category-grid");
  grid.innerHTML = "";
  CATEGORIES[txSheet.type].forEach((c) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cat-btn";
    b.setAttribute("role", "radio");
    const on = c.id === txSheet.category;
    b.classList.toggle("active", on);
    b.setAttribute("aria-checked", String(on));
    b.style.setProperty("--c", c.color);
    b.innerHTML = `<span class="cat-icon"><span class="ms">${c.icon}</span></span><span class="cat-label">${c.label}</span>`;
    b.onclick = () => {
      txSheet.category = c.id;
      grid.querySelectorAll(".cat-btn").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-checked", String(x === b));
      });
      haptic();
    };
    grid.appendChild(b);
  });
}

function setTxType(type, keepCategory = false) {
  txSheet.type = type;
  setSegmented($("tx-type"), type);
  const valid = CATEGORIES[type].some((c) => c.id === txSheet.category);
  if (!keepCategory || !valid) {
    const last = state.lastUsed[type] || {};
    txSheet.category = CATEGORIES[type].some((c) => c.id === last.category) ? last.category : CATEGORIES[type][0].id;
    if (!txSheet.editing && last.method) $("tx-method").value = last.method;
  }
  renderCategoryGrid();
}

function openTransactionModal(editId = null, presetType = "expense") {
  const tx = editId ? state.transactions.find((t) => t.id === editId) : null;
  if (editId && !tx) return;
  txSheet.editing = tx;
  $("transaction-form").reset();
  $("modal-title").textContent = tx ? "Editar movimiento" : "Nuevo movimiento";
  $("tx-delete-btn").classList.toggle("hidden", !tx);
  $("tx-date").value = tx ? tx.date : todayISO();
  $("tx-amount").value = tx ? amountToInput(tx.amount) : "";
  $("tx-note").value = tx ? tx.note || "" : "";
  $("tx-method").value = tx ? tx.method : "Efectivo";

  // Las copias generadas por un recurrente no se pueden marcar como recurrentes.
  const isCopy = !!(tx && tx.recurringOf);
  $("tx-recurring-row").classList.toggle("hidden", isCopy);
  $("tx-recurring-hint").classList.toggle("hidden", !isCopy);
  $("tx-recurring").checked = !!(tx && tx.recurring === "monthly");

  txSheet.category = tx ? tx.category : null;
  setTxType(tx ? tx.type : presetType, !!tx);
  openModal("transaction-modal", tx ? null : "tx-amount");
}

function saveTransaction(event) {
  event.preventDefault();
  const amount = parseAmountInput($("tx-amount").value);
  const date = $("tx-date").value;
  if (!(amount > 0)) {
    showToast("Ingresa un monto mayor a 0", "warning");
    $("tx-amount").focus();
    return;
  }
  if (!date) {
    showToast("Elige una fecha", "warning");
    return;
  }
  const prev = txSheet.editing;
  const tx = {
    ...(prev || {}),
    id: prev ? prev.id : generateId("tx"),
    type: txSheet.type,
    amount,
    category: txSheet.category,
    date,
    method: $("tx-method").value,
    note: $("tx-note").value.trim(),
    createdAt: prev && prev.createdAt ? prev.createdAt : Date.now()
  };
  if (!tx.recurringOf) {
    if ($("tx-recurring").checked) tx.recurring = "monthly";
    else delete tx.recurring;
  }

  state.lastUsed[tx.type] = { category: tx.category, method: tx.method };
  lastChangedId = tx.id;
  upsertTransaction(tx);
  if (tx.recurring) materializeRecurring();
  closeModal("transaction-modal");
  haptic("success");
  if (state.activeTab !== "dashboard" && state.activeTab !== "transactions") {
    showToast(prev ? "Movimiento actualizado" : "Movimiento guardado", "success");
  }
  setTimeout(() => (lastChangedId = null), 1000);
}

function deleteFromSheet() {
  const tx = txSheet.editing;
  closeModal("transaction-modal");
  if (tx) setTimeout(() => deleteTransaction(tx.id), 200);
}

/** Borra al instante con animación de salida y ofrece Deshacer. */
function deleteTransaction(id) {
  const tx = state.transactions.find((t) => t.id === id);
  if (!tx) return;
  document.querySelectorAll(`.tx-row[data-id="${CSS.escape(id)}"]`).forEach((r) => r.classList.add("is-removing"));
  haptic();

  setTimeout(
    () => {
      // Una copia borrada de un recurrente no debe regenerarse.
      const template = tx.recurringOf && state.transactions.find((t) => t.id === tx.recurringOf);
      if (template) {
        const ym = tx.date.slice(0, 7);
        upsertTransaction({ ...template, skipMonths: [...new Set([...(template.skipMonths || []), ym])] }, false);
      }
      removeTransaction(id);
      showToast("Movimiento eliminado", "info", 5000, {
        label: "Deshacer",
        onClick: () => {
          if (template) {
            const t = state.transactions.find((x) => x.id === template.id);
            if (t) upsertTransaction({ ...t, skipMonths: (t.skipMonths || []).filter((m) => m !== tx.date.slice(0, 7)) }, false);
          }
          lastChangedId = tx.id;
          upsertTransaction(tx);
          setTimeout(() => (lastChangedId = null), 1000);
        }
      });
    },
    reduceMotion.matches ? 0 : 150
  );
}

/** Crea las copias mensuales que falten de cada movimiento recurrente (ids deterministas: idempotente). */
function materializeRecurring() {
  const today = todayISO();
  const currentYM = today.slice(0, 7);
  const existing = new Set(state.transactions.map((t) => t.id));
  const created = [];
  state.transactions.forEach((t) => {
    if (t.recurring !== "monthly") return;
    const day = Number(t.date.slice(8, 10));
    for (let ym = addMonths(t.date.slice(0, 7), 1); ym <= currentYM; ym = addMonths(ym, 1)) {
      const date = `${ym}-${pad(Math.min(day, daysInMonth(ym)))}`;
      if (date > today) break;
      const id = `${t.id}-${ym}`;
      if (existing.has(id) || (t.skipMonths || []).includes(ym)) continue;
      existing.add(id);
      created.push({
        id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        method: t.method,
        note: t.note,
        date,
        recurringOf: t.id,
        createdAt: Date.now()
      });
    }
  });
  if (!created.length) return;
  if (isCloud()) {
    created.forEach((t) => cloudDoc("transactions", t.id).set(t).catch(cloudError));
  } else {
    state.transactions.push(...created);
    commit();
  }
}

/* ==========================================================================
   Presupuestos
   ========================================================================== */

let budgetEditing = null;

function openBudgetModal(category = null) {
  const select = $("budget-category");
  const free = CATEGORIES.expense.filter((c) => category === c.id || state.budgets[c.id] === undefined);
  if (!category && !free.length) {
    showToast("Todas las categorías ya tienen límite", "info");
    return;
  }
  budgetEditing = category;
  $("budget-form").reset();
  select.innerHTML = "";
  free.forEach((c) => select.appendChild(new Option(c.label, c.id)));
  select.value = category || free[0].id;
  select.disabled = !!category;
  $("budget-title").textContent = category ? "Editar límite" : "Nuevo límite";
  $("budget-limit").value = category ? amountToInput(state.budgets[category]) : "";
  $("budget-delete-btn").classList.toggle("hidden", !category);
  openModal("budget-modal", "budget-limit");
}

function saveBudget(event) {
  event.preventDefault();
  const category = $("budget-category").value;
  const limit = parseAmountInput($("budget-limit").value);
  if (!(limit > 0)) {
    showToast("Ingresa un límite mayor a 0", "warning");
    return;
  }
  upsertBudget(category, limit);
  closeModal("budget-modal");
  haptic("success");
}

function deleteBudgetFromSheet() {
  const category = budgetEditing;
  if (!category) return;
  const limit = state.budgets[category];
  closeModal("budget-modal");
  removeBudget(category);
  haptic();
  showToast(`Límite de ${getCategoryInfo(category).label} eliminado`, "info", 5000, {
    label: "Deshacer",
    onClick: () => upsertBudget(category, limit)
  });
}

/* ==========================================================================
   Capa de datos: local o nube (Firestore aplica en caché local al instante)
   ========================================================================== */

let db = null;
let auth = null;
let firestoreListeners = [];

const isCloud = () => !!(state.firebaseEnabled && state.user && db);
const cloudDoc = (col, id) => db.collection("users").doc(state.user.uid).collection(col).doc(id);
const cloudError = (err) => {
  console.error("Firestore:", err);
  showToast("No se pudo sincronizar con la nube", "error");
};

function upsertTransaction(tx, doCommit = true) {
  if (isCloud()) {
    cloudDoc("transactions", tx.id).set(tx).catch(cloudError);
    if (doCommit) {
      saveState();
      refreshScheduledNotifications();
    }
    return;
  }
  const i = state.transactions.findIndex((t) => t.id === tx.id);
  if (i !== -1) state.transactions[i] = tx;
  else state.transactions.push(tx);
  if (doCommit) commit();
}
function removeTransaction(id) {
  if (isCloud()) {
    cloudDoc("transactions", id).delete().catch(cloudError);
    return;
  }
  state.transactions = state.transactions.filter((t) => t.id !== id);
  commit();
}
function upsertBudget(category, limit) {
  if (isCloud()) {
    cloudDoc("budgets", category).set({ limit }).catch(cloudError);
    return;
  }
  state.budgets[category] = limit;
  commit();
}
function removeBudget(category) {
  if (isCloud()) {
    cloudDoc("budgets", category).delete().catch(cloudError);
    return;
  }
  delete state.budgets[category];
  commit();
}

/* ==========================================================================
   Firebase (Auth + Firestore)
   ========================================================================== */

function initFirebase() {
  if (typeof firebase === "undefined") {
    state.firebaseEnabled = false;
    return;
  }
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
    state.firebaseEnabled = true;
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    auth.onAuthStateChanged(handleAuthStateChange);
  } catch (error) {
    console.error("Error inicializando Firebase:", error);
    state.firebaseEnabled = false;
  }
}

function handleAuthStateChange(user) {
  state.user = user || null;
  state.cloudStatus = user ? "syncing" : null;
  if (user) {
    migrateLocalDataToCloud();
    syncWithFirestore();
  } else {
    unsubscribeFirestore();
    const local = loadState() || {};
    state.transactions = local.transactions || [];
    state.budgets = local.budgets || {};
  }
  render();
}

function syncWithFirestore() {
  unsubscribeFirestore();
  if (!isCloud()) return;
  const userRef = db.collection("users").doc(state.user.uid);
  let materialized = false;
  const onData = commit;
  firestoreListeners.push(
    userRef.collection("transactions").onSnapshot((snap) => {
      state.transactions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      state.cloudStatus = null; // primera sincronización terminada
      onData();
      if (!materialized) {
        materialized = true;
        materializeRecurring();
      }
    }, cloudError),
    userRef.collection("budgets").onSnapshot((snap) => {
      const budgets = {};
      snap.forEach((d) => (budgets[d.id] = d.data().limit));
      state.budgets = budgets;
      onData();
    }, cloudError)
  );
}

function unsubscribeFirestore() {
  firestoreListeners.forEach((fn) => fn());
  firestoreListeners = [];
}

function migrateLocalDataToCloud() {
  const local = loadState();
  if (!local || localStorage.getItem(MIGRATED_KEY) === "true") return;
  const txs = (local.transactions || []).filter((t) => !String(t.id).startsWith("seed-"));
  if (!txs.length) return;
  showConfirmDialog(
    "¿Subir tus datos a la nube?",
    `Tienes ${txs.length} movimientos en este dispositivo. ¿Quieres sincronizarlos con tu cuenta de Google?`,
    () => {
      const batch = db.batch();
      const userRef = db.collection("users").doc(state.user.uid);
      txs.forEach((t) => batch.set(userRef.collection("transactions").doc(t.id), t));
      Object.keys(local.budgets || {}).forEach((cat) => batch.set(userRef.collection("budgets").doc(cat), { limit: local.budgets[cat] }));
      batch
        .commit()
        .then(() => {
          localStorage.setItem(MIGRATED_KEY, "true");
          showToast("Datos sincronizados con la nube", "success");
        })
        .catch(cloudError);
    },
    "Sincronizar"
  );
}

function loginWithGoogle() {
  if (!state.firebaseEnabled) return;
  closeModal("login-modal");
  state.cloudStatus = "connecting";
  updateFirebaseStatusUI();
  const signIn = isNative ? signInWithGoogleNative() : auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
  signIn
    .then((result) => result && showToast("Sesión iniciada", "success"))
    .catch((error) => showToast("No se pudo iniciar sesión: " + error.message, "error", 5000))
    .finally(() => {
      // Cancelado o fallido: volver al estado normal. Con éxito, onAuthStateChanged ya pasó a "syncing".
      if (!state.user) {
        state.cloudStatus = null;
        updateFirebaseStatusUI();
      }
    });
}

// Google bloquea el login OAuth dentro del WebView (disallowed_useragent): en Android
// se hace con Google Sign-In nativo y el ID token se pasa a Firebase JS, que sigue
// siendo el único dueño de la sesión (skipNativeAuth en capacitor.config.json).
// Resuelve null si el usuario cancela el selector de cuentas.
async function signInWithGoogleNative() {
  const NativeAuth = plugin("FirebaseAuthentication");
  if (!NativeAuth) throw new Error("login nativo no disponible");
  let result;
  try {
    result = await NativeAuth.signInWithGoogle();
  } catch (error) {
    if (/cancel/i.test(error && error.message)) return null;
    throw error;
  }
  const idToken = result && result.credential && result.credential.idToken;
  if (!idToken) throw new Error("Google no devolvió credenciales");
  return auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken));
}

function signOutEverywhere() {
  const NativeAuth = isNative ? plugin("FirebaseAuthentication") : undefined;
  // Cierra también la sesión de Google en el dispositivo para poder elegir otra cuenta.
  if (NativeAuth) NativeAuth.signOut().catch(() => {});
  return auth.signOut();
}

function handleFirebaseSettingsAction() {
  if (!state.firebaseEnabled) {
    showToast("La sincronización no está disponible sin conexión", "warning");
  } else if (state.user) {
    showConfirmDialog("¿Cerrar sesión?", "Volverás al modo local en este dispositivo.", () => {
      signOutEverywhere().then(() => showToast("Sesión cerrada", "info"));
    }, "Cerrar sesión");
  } else {
    openModal("login-modal");
  }
}

function updateFirebaseStatusUI() {
  const icon = $("firebase-status-icon");
  const title = $("firebase-status-title");
  const subtitle = $("firebase-status-subtitle");
  const btn = $("firebase-action-btn");
  const spinner = '<span class="spinner" aria-hidden="true"></span>';
  btn.disabled = state.cloudStatus === "connecting";
  if (state.cloudStatus === "connecting") {
    icon.textContent = "cloud";
    icon.style.color = "";
    title.textContent = "Conectando con Google…";
    subtitle.textContent = "Elige tu cuenta para continuar.";
    btn.innerHTML = `${spinner}Conectando…`;
    btn.className = "btn-plain loading";
    return;
  }
  if (state.user && state.cloudStatus === "syncing") {
    icon.textContent = "cloud_sync";
    icon.style.color = "";
    title.textContent = "Sincronizando…";
    subtitle.innerHTML = `${spinner}Descargando tus movimientos`;
    btn.textContent = "Salir";
    btn.className = "btn-plain destructive";
    return;
  }
  if (state.user) {
    icon.textContent = "cloud_done";
    icon.style.color = "var(--income)";
    title.textContent = "Sincronizado con Google";
    subtitle.textContent = state.user.email || state.user.displayName || "";
    btn.textContent = "Salir";
    btn.className = "btn-plain destructive";
  } else {
    icon.textContent = state.firebaseEnabled ? "cloud" : "cloud_off";
    icon.style.color = "";
    title.textContent = "Modo local";
    subtitle.textContent = state.firebaseEnabled ? "Tus datos están solo en este dispositivo." : "Sin conexión con la nube.";
    btn.textContent = "Conectar";
    btn.className = "btn-plain";
  }
}

/* ==========================================================================
   Notificaciones locales (solo nativo)
   ========================================================================== */

const LN = () => plugin("LocalNotifications");
const REMINDER_IDS = [100, 101, 102, 103, 104, 105, 106];
const WEEKLY_ID = 300;

async function ensureNotifyPermission() {
  const ln = LN();
  if (!ln) return false;
  try {
    let p = await ln.checkPermissions();
    if (p.display !== "granted" && p.display !== "denied") p = await ln.requestPermissions();
    return p.display === "granted";
  } catch (e) {
    return false;
  }
}

function initNotifications() {
  const ln = LN();
  $("notify-group").classList.toggle("hidden", !(isNative && ln));
  if (!isNative || !ln) return;
  ln.createChannel({ id: "finanflow", name: "FinanFlow", description: "Recordatorios y alertas de presupuesto", importance: 3 }).catch(() => {});
  ln.addListener("localNotificationActionPerformed", (e) => routeTo(e && e.notification && e.notification.extra && e.notification.extra.route));

  ["reminder", "budget", "weekly"].forEach((key) => {
    const input = $(`notify-${key}`);
    input.checked = !!state.notify[key];
    input.onchange = async () => {
      if (input.checked && !(await ensureNotifyPermission())) {
        input.checked = false;
        showToast("Activa las notificaciones de FinanFlow en los ajustes del sistema", "warning", 5000);
        return;
      }
      state.notify[key] = input.checked;
      $("notify-time-row").classList.toggle("hidden", !state.notify.reminder);
      saveState();
      refreshScheduledNotifications();
    };
  });
  const time = $("notify-time");
  time.value = state.notify.reminderTime;
  time.onchange = () => {
    if (!time.value) return;
    state.notify.reminderTime = time.value;
    saveState();
    refreshScheduledNotifications();
  };
  $("notify-time-row").classList.toggle("hidden", !state.notify.reminder);
  refreshScheduledNotifications();
}

let notifyTimer = null;
function refreshScheduledNotifications() {
  const ln = LN();
  if (!isNative || !ln) return;
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(async () => {
    try {
      await ln.cancel({ notifications: [...REMINDER_IDS, WEEKLY_ID].map((id) => ({ id })) });
    } catch (e) {
      /* nada programado */
    }
    const list = [];
    const now = new Date();
    const base = { channelId: "finanflow", smallIcon: "ic_stat_finanflow" };

    if (state.notify.reminder) {
      const [h, m] = state.notify.reminderTime.split(":").map(Number);
      const loggedToday = state.transactions.some((t) => t.date === todayISO() && !t.recurringOf);
      REMINDER_IDS.forEach((id, i) => {
        const at = new Date();
        at.setDate(at.getDate() + i);
        at.setHours(h, m, 0, 0);
        if (at <= now || (i === 0 && loggedToday)) return;
        list.push({ ...base, id, title: "FinanFlow", body: "¿Registraste tus gastos de hoy? Toma 5 segundos.", schedule: { at, allowWhileIdle: true }, extra: { route: "add" } });
      });
    }

    if (state.notify.weekly) {
      const at = new Date();
      at.setDate(at.getDate() + ((7 - at.getDay()) % 7));
      at.setHours(19, 0, 0, 0);
      if (at <= now) at.setDate(at.getDate() + 7);
      const from = new Date(at);
      from.setDate(at.getDate() - 6);
      const week = state.transactions.filter((t) => t.type === "expense" && t.date >= toISODate(from) && t.date <= toISODate(at));
      const byCat = {};
      week.forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + Number(t.amount)));
      const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      const body = week.length
        ? `Esta semana gastaste ${formatMoney(sumAmounts(week))}${top ? ` · Más en ${getCategoryInfo(top[0]).label}` : ""}.`
        : "Esta semana no registraste gastos. ¿Todo al día?";
      list.push({ ...base, id: WEEKLY_ID, title: "Tu resumen semanal", body, schedule: { at, allowWhileIdle: true }, extra: { route: "dashboard" } });
    }

    if (list.length) ln.schedule({ notifications: list }).catch((e) => console.warn("Notificaciones:", e));
  }, 300);
}

/** Avisa una sola vez por categoría, umbral (80/100) y mes. */
function checkBudgetAlerts() {
  const ym = monthKey(new Date());
  const usage = budgetUsage(monthStats(ym));
  const seen = state.notified[ym] || {};
  const fresh = [];
  usage.forEach((u) => {
    const level = u.pct >= 100 ? 100 : u.pct >= 80 ? 80 : 0;
    if (level > (seen[u.cat] || 0)) {
      seen[u.cat] = level;
      fresh.push({ ...u, threshold: level });
    }
  });
  if (!fresh.length) return;
  state.notified = { [ym]: seen }; // solo se guarda el mes en curso
  saveState();

  const ln = LN();
  if (!isNative || !ln || !state.notify.budget) return;
  ln.schedule({
    notifications: fresh.map((u, i) => {
      const label = getCategoryInfo(u.cat).label;
      return {
        id: 200 + (CATEGORIES.expense.findIndex((c) => c.id === u.cat) + 1) * 2 + (u.threshold === 100 ? 1 : 0),
        channelId: "finanflow",
        smallIcon: "ic_stat_finanflow",
        title: u.threshold === 100 ? `Superaste el límite de ${label}` : `${label}: cerca del límite`,
        body: `Llevas ${formatMoney(u.spent)} de ${formatMoney(u.limit)} (${Math.round(u.pct)}%).`,
        schedule: { at: new Date(Date.now() + 1000 + i * 200), allowWhileIdle: true },
        extra: { route: "budgets" }
      };
    })
  }).catch(() => {});
}

function routeTo(route) {
  if (route === "add") {
    switchTab("dashboard");
    openTransactionModal();
  } else if (route === "budgets") {
    switchTab("budgets");
  } else if (route === "history") {
    switchTab("transactions");
  } else {
    switchTab("dashboard");
  }
}

/* ==========================================================================
   Widget de Android (puente a SharedPreferences vía plugin local WidgetBridge)
   ========================================================================== */

let widgetTimer = null;
function syncWidget() {
  const bridge = plugin("WidgetBridge");
  if (!bridge) return;
  clearTimeout(widgetTimer);
  widgetTimer = setTimeout(() => {
    const ym = monthKey(new Date());
    const s = monthStats(ym);
    bridge
      .update({
        json: JSON.stringify({
          balance: formatMoney(balanceUntil(todayISO())),
          income: formatMoney(s.income),
          expense: formatMoney(s.expense),
          monthKey: ym,
          monthLabel: monthLabel(ym, false)
        })
      })
      .catch(() => {});
  }, 500);
}

/* ==========================================================================
   Android: botón Atrás, App Shortcuts / deep links
   ========================================================================== */

function handleDeepLink(url) {
  if (!url) return;
  const match = url.match(/finanflow:\/\/action\/([\w-]+)/) || url.match(/[?&]action=([\w-]+)/);
  if (!match) return;
  const routes = { "add-expense": "add", "view-balance": "dashboard", "view-history": "history" };
  routeTo(routes[match[1]]);
}

function initNative() {
  const App = plugin("App");
  if (!App) return;
  App.addListener("backButton", () => {
    if (closeTopModal()) return;
    if (state.activeTab !== "dashboard") switchTab("dashboard");
    else App.exitApp();
  });
  App.addListener("appUrlOpen", (data) => handleDeepLink(data && data.url));
  App.getLaunchUrl()
    .then((r) => handleDeepLink(r && r.url))
    .catch(() => {});
}

/* ==========================================================================
   FinanBot (Gemini)
   ========================================================================== */

let chatHistory = [];

const getGeminiKey = () => localStorage.getItem(GEMINI_KEY) || "";

function openAI() {
  if (getGeminiKey().length < 10) {
    showToast("Agrega tu API Key de Gemini para usar FinanBot", "info", 5000, {
      label: "Configurar",
      onClick: () => {
        switchTab("settings");
        setTimeout(() => $("gemini-api-key").focus(), 200);
      }
    });
    return;
  }
  const box = $("ai-messages");
  if (!box.children.length) {
    appendMessage("ai", "¡Hola! Soy FinanBot. Conozco tus números de este mes. ¿En qué te ayudo?");
    renderAISuggestions();
  }
  openModal("ai-modal");
}

function renderAISuggestions() {
  const box = $("ai-suggestions");
  box.innerHTML = "";
  ["¿En qué gasto más?", "¿Cómo voy con mis límites?", "Dame un consejo de ahorro"].forEach((q) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = q;
    b.onclick = () => {
      $("ai-input").value = q;
      sendAIMessage();
    };
    box.appendChild(b);
  });
}

async function sendAIMessage() {
  const input = $("ai-input");
  const sendBtn = $("ai-send-btn");
  const text = input.value.trim();
  if (!text || sendBtn.disabled) return;

  $("ai-suggestions").innerHTML = "";
  appendMessage("user", text);
  input.value = "";
  sendBtn.disabled = true;
  const typing = appendMessage("ai", "");
  typing.classList.add("typing");
  typing.firstElementChild.innerHTML = '<span class="typing-dots" role="status" aria-label="FinanBot está escribiendo"><i></i><i></i><i></i></span>';

  chatHistory.push({ role: "user", parts: [{ text }] });
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": getGeminiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: chatHistory.slice(-8),
        generationConfig: { maxOutputTokens: GEMINI_CONFIG.maxTokens, temperature: GEMINI_CONFIG.temperature }
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err.error && err.error.message) || `Error HTTP ${response.status}`);
    }
    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "No pude generar una respuesta.";
    chatHistory.push({ role: "model", parts: [{ text: reply }] });
    typing.remove();
    appendMessage("ai", reply);
  } catch (err) {
    chatHistory.pop();
    typing.remove();
    appendMessage("ai", "No pude conectarme. Revisa tu conexión o tu API Key.");
    console.error("FinanBot:", err);
  } finally {
    sendBtn.disabled = false;
  }
}

function appendMessage(role, text) {
  const box = $("ai-messages");
  const msg = document.createElement("div");
  msg.className = `ai-message ${role}`;
  msg.innerHTML = `<div class="ai-bubble">${escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</div>`;
  box.appendChild(msg);
  box.scrollTop = box.scrollHeight;
  return msg;
}

function buildSystemPrompt() {
  const ym = monthKey(new Date());
  const s = monthStats(ym);
  const top = Object.entries(s.byCat.expense)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c, v]) => `${getCategoryInfo(c).label}: ${formatMoney(v)}`)
    .join(", ");
  const budgets = budgetUsage(s)
    .map((u) => `${getCategoryInfo(u.cat).label}: ${formatMoney(u.spent)} / ${formatMoney(u.limit)} (${Math.round(u.pct)}%)`)
    .join("; ");
  return `Eres "FinanBot", un asistente de finanzas personales amable, conciso y práctico.
REGLAS: responde en español, máximo 4 oraciones salvo que pidan detalle; da consejos accionables; usa la moneda ${state.currency}; no pidas datos sensibles; si preguntan algo ajeno a finanzas, redirige con amabilidad.
DATOS DEL USUARIO (${monthLabel(ym)}, hoy ${todayISO()}):
- Ingresos del mes: ${formatMoney(s.income)}
- Gastos del mes: ${formatMoney(s.expense)}
- Saldo total: ${formatMoney(balanceUntil(todayISO()))}
- Categorías con más gasto: ${top || "sin gastos"}
- Límites: ${budgets || "sin límites configurados"}`;
}

function saveGeminiKey(key) {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_KEY, trimmed);
    showToast("FinanBot activado", "success");
  } else {
    localStorage.removeItem(GEMINI_KEY);
    showToast("API Key eliminada", "info");
  }
  chatHistory = [];
  $("ai-messages").innerHTML = "";
}

function toggleApiKeyVisibility() {
  const input = $("gemini-api-key");
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  $("api-key-visibility-icon").textContent = show ? "visibility" : "visibility_off";
}

/* ==========================================================================
   Ajustes: moneda, exportar / importar, borrar todo
   ========================================================================== */

function changeCurrency(currency) {
  state.currency = currency;
  saveState();
  resetCharts();
  render();
  syncWidget();
}

// En el WebView de Android `<a download>` no hace nada: el archivo se escribe en
// Cache (privado de la app) y se abre la hoja de compartir. Resuelve false si el
// usuario cancela la hoja.
async function downloadFile(content, filename, type) {
  const Filesystem = plugin("Filesystem");
  const Share = plugin("Share");
  if (isNative && Filesystem && Share) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: content, directory: "CACHE", encoding: "utf8" });
    try {
      await Share.share({ title: filename, url: uri, dialogTitle: "Exportar " + filename });
    } catch (error) {
      if (/cancel/i.test(error && error.message)) return false;
      throw error;
    }
    return true;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

function exportFile(content, filename, type, successMessage) {
  return downloadFile(content, filename, type)
    .then((done) => done && showToast(successMessage, "success"))
    .catch(() => showToast("No se pudo exportar el archivo", "error"));
}

function exportDataJSON() {
  const data = JSON.stringify({ app: "FinanFlow", currency: state.currency, transactions: state.transactions, budgets: state.budgets }, null, 2);
  return exportFile(data, `finanflow-respaldo-${todayISO()}.json`, "application/json", "Respaldo exportado");
}

function exportDataCSV() {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Fecha", "Tipo", "Categoría", "Monto", "Método", "Nota"].join(",");
  const rows = [...state.transactions]
    .sort(byDateDesc)
    .map((t) => [t.date, t.type === "income" ? "Ingreso" : "Gasto", getCategoryInfo(t.category, t.type).label, t.amount, t.method, t.note].map(esc).join(","));
  return exportFile("﻿" + [header, ...rows].join("\n"), `finanflow-${todayISO()}.csv`, "text/csv;charset=utf-8", "CSV exportado");
}

function isValidBackup(data) {
  return (
    data &&
    Array.isArray(data.transactions) &&
    data.transactions.every(
      (t) => t && typeof t.id === "string" && (t.type === "income" || t.type === "expense") && Number(t.amount) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(t.date) && typeof t.category === "string"
    ) &&
    (data.budgets === undefined || (typeof data.budgets === "object" && Object.values(data.budgets).every((v) => Number(v) > 0)))
  );
}

function importDataJSON(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    let data;
    try {
      data = JSON.parse(e.target.result);
    } catch (err) {
      data = null;
    }
    if (!isValidBackup(data)) {
      showToast("El archivo no es un respaldo válido de FinanFlow", "error", 4000);
      return;
    }
    showConfirmDialog(
      "¿Restaurar respaldo?",
      `Se reemplazarán tus datos actuales por ${data.transactions.length} movimientos del archivo.`,
      () => {
        if (CURRENCY_CONFIG[data.currency]) state.currency = data.currency;
        if (isCloud()) {
          data.transactions.forEach((t) => cloudDoc("transactions", t.id).set(t).catch(cloudError));
          Object.entries(data.budgets || {}).forEach(([c, l]) => cloudDoc("budgets", c).set({ limit: Number(l) }).catch(cloudError));
        } else {
          state.transactions = data.transactions;
          state.budgets = data.budgets || {};
        }
        resetCharts();
        commit();
        showToast("Respaldo restaurado", "success");
      },
      "Restaurar"
    );
  };
  reader.readAsText(file);
}

function confirmResetAll() {
  showConfirmDialog(
    "¿Borrar todos los datos?",
    "Se eliminarán tus movimientos y límites de este dispositivo. No se puede deshacer.",
    () => {
      state.transactions = [];
      state.budgets = {};
      state.lastUsed = { expense: {}, income: {} };
      state.notified = {};
      state.viewMonth = monthKey(new Date());
      state.filters = { type: "all", category: "all", date: "month", search: "" };
      commit();
      showToast("Datos borrados", "info");
    },
    "Borrar todo"
  );
}

/* ==========================================================================
   Inicialización
   ========================================================================== */

function bindUI() {
  // Formularios
  $("transaction-form").addEventListener("submit", saveTransaction);
  $("budget-form").addEventListener("submit", saveBudget);
  $("tx-delete-btn").onclick = deleteFromSheet;
  $("budget-delete-btn").onclick = deleteBudgetFromSheet;
  ["tx-amount", "budget-limit"].forEach((id) => {
    $(id).addEventListener("input", (e) => {
      e.target.value = formatAmountInput(e.target.value);
    });
  });

  // Que el teclado no tape el campo enfocado dentro de una hoja
  document.querySelectorAll(".sheet").forEach((sheet) => {
    setupSheetGesture(sheet);
    sheet.addEventListener("focusin", (e) => {
      if (e.target.matches("input, select, textarea")) setTimeout(() => e.target.scrollIntoView({ block: "nearest" }), 300);
    });
  });

  // Cerrar modales: fondo, botones [data-close] y Escape
  document.addEventListener("click", (e) => {
    const closer = e.target.closest("[data-close]");
    if (closer) closeModal(closer.closest(".modal").id);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTopModal();
  });

  // Controles segmentados
  setupSegmented($("tx-type"), (type) => setTxType(type));
  setupSegmented($("chart-type-toggle"), (type) => {
    state.chartType = type;
    saveState();
    renderCategoryChart(monthStats(state.viewMonth));
  });
  setupSegmented($("type-filter"), (type) => {
    state.filters.type = type;
    renderTransactionsList();
  });
  setSegmented($("chart-type-toggle"), state.chartType);

  // Filtros del Historial
  document.querySelectorAll("#date-filter-chips .chip").forEach((chip) => {
    chip.onclick = () => {
      state.filters.date = chip.dataset.value;
      syncFilterControls();
      renderTransactionsList();
    };
  });
  $("search-input").addEventListener("input", (e) => {
    state.filters.search = e.target.value;
    renderTransactionsList();
  });
  const filterCat = $("filter-category");
  [["Gastos", "expense"], ["Ingresos", "income"]].forEach(([label, type]) => {
    const og = document.createElement("optgroup");
    og.label = label;
    CATEGORIES[type].forEach((c) => og.appendChild(new Option(c.label, c.id)));
    filterCat.appendChild(og);
  });
  filterCat.onchange = () => {
    state.filters.category = filterCat.value;
    renderTransactionsList();
  };

  // Meses
  $("month-prev").onclick = () => changeMonth(-1);
  $("month-next").onclick = () => changeMonth(1);

  // Ajustes
  $("settings-theme").value = getThemePref();
  $("settings-currency").value = state.currency;
  $("gemini-api-key").value = getGeminiKey();
  $("ai-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendAIMessage();
  });

  // Al volver a la app: nuevas copias recurrentes, "hoy" correcto y avisos al día
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const current = monthKey(new Date());
    if (state.viewMonth > current) state.viewMonth = current;
    materializeRecurring();
    render();
    refreshScheduledNotifications();
    syncWidget();
  });
}

function init() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  initTheme();
  initFirebase();
  bindUI();
  materializeRecurring();
  switchTab(state.activeTab);
  render();
  initNative();
  initNotifications();
  handleDeepLink(location.href);
  checkBudgetAlerts();
  syncWidget();
}

const app = {
  switchTab,
  openTransactionModal,
  openBudgetModal,
  openAI,
  sendAIMessage,
  closeModal,
  applyThemePref,
  changeCurrency,
  saveGeminiKey,
  toggleApiKeyVisibility,
  exportDataJSON,
  exportDataCSV,
  importDataJSON,
  confirmResetAll,
  handleFirebaseSettingsAction,
  loginWithGoogle
};
window.app = app;
document.addEventListener("DOMContentLoaded", init);

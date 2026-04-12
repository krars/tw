(() => {
  "use strict";

  const SCRIPT_NAME = "SC.js";
  const SCRIPT_VERSION = "1.0.2";
  const INSTANCE_KEY = "__SC_JS_INSTANCE__";
  const STYLE_ID = "sc-js-arrival-style";
  const STORAGE_KEY = "sc.cancel.slice.v1";
  const ARRIVAL_CELL_SELECTOR =
    "#commands_incomings tr.command-row td:nth-child(2)";
  const CONTAINER_SELECTOR = "#commands_incomings";
  const MONITOR_PANEL_ID = "sc-confirm-monitor";
  const SECOND_BAR_ID = "sc-confirm-second-bar";
  const OWN_PANEL_ID = "sc-own-plan-panel";
  const OWN_HINT_CLASS = "sc-own-cancel-hint";
  const OWN_META_CLASS = "sc-own-cancel-meta";
  const OWN_COUNTDOWN_CLASS = "sc-own-cancel-countdown";
  const MONTH_MAP = {
    jan: 1,
    january: 1,
    янв: 1,
    января: 1,
    feb: 2,
    february: 2,
    фев: 2,
    февраля: 2,
    mar: 3,
    march: 3,
    мар: 3,
    марта: 3,
    apr: 4,
    april: 4,
    апр: 4,
    апреля: 4,
    may: 5,
    май: 5,
    мая: 5,
    jun: 6,
    june: 6,
    июн: 6,
    июня: 6,
    jul: 7,
    july: 7,
    июл: 7,
    июля: 7,
    aug: 8,
    august: 8,
    авг: 8,
    августа: 8,
    sep: 9,
    sept: 9,
    september: 9,
    сен: 9,
    сент: 9,
    сентября: 9,
    oct: 10,
    october: 10,
    окт: 10,
    октября: 10,
    nov: 11,
    november: 11,
    ноя: 11,
    ноября: 11,
    dec: 12,
    december: 12,
    дек: 12,
    декабря: 12,
  };

  const previousInstance = window[INSTANCE_KEY];
  if (previousInstance && typeof previousInstance.destroy === "function") {
    previousInstance.destroy();
  }

  const state = {
    observer: null,
    clickHandler: null,
    lastCell: null,
    monitorTimer: null,
    monitorPanel: null,
    secondBar: null,
    secondBarFrameId: null,
    lastDecisionSecondStamp: null,
    ownPanel: null,
    ownPlannerPromise: null,
    ownCountdownTimer: null,
  };

  function normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function notify(text, type = "success") {
    const message = normalizeText(text);
    if (!message) return;
    const ui = window.UI;
    if (ui) {
      if (type === "error" && typeof ui.ErrorMessage === "function") {
        ui.ErrorMessage(message);
        return;
      }
      if (type === "success" && typeof ui.SuccessMessage === "function") {
        ui.SuccessMessage(message);
        return;
      }
      if (typeof ui.InfoMessage === "function") {
        ui.InfoMessage(message);
        return;
      }
    }
    console.log(`[${SCRIPT_NAME}] ${message}`);
  }

  function parseArrivalCell(text) {
    const normalized = normalizeText(text).toLowerCase();
    const match = normalized.match(
      /(сегодня|завтра|today|tomorrow|\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s*в\s*(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/i,
    );
    if (!match) return null;
    const dayToken = String(match[1] || "").toLowerCase();
    const hh = String(Number(match[2])).padStart(2, "0");
    const mm = String(match[3]).padStart(2, "0");
    const ss = String(match[4]).padStart(2, "0");
    const ms = String(match[5] || "000").padStart(3, "0").slice(-3);
    return {
      dayToken,
      time: `${hh}:${mm}:${ss}:${ms}`,
      normalized,
    };
  }

  async function copyToClipboard(value) {
    const text = normalizeText(value);
    if (!text) return false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand("copy");
      ta.remove();
      return Boolean(ok);
    } catch (error) {
      return false;
    }
  }

  function getCommandIdFromRow(cell) {
    const row = cell.closest("tr.command-row");
    if (!row) return null;
    const cancelLink = row.querySelector("a.command-cancel");
    if (!cancelLink) return null;
    return normalizeText(cancelLink.getAttribute("data-id")) || null;
  }

  function writeCancelSliceData(payload) {
    window.SC = window.SC || {};
    window.SC.cancel = window.SC.cancel || {};
    const orders =
      window.SC.cancel.orders && typeof window.SC.cancel.orders === "object"
        ? window.SC.cancel.orders
        : {};
    Object.assign(window.SC.cancel, payload, { orders });
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const base = parsed && typeof parsed === "object" ? parsed : {};
      const merged = Object.assign({}, base, payload);
      if (
        base.orders &&
        typeof base.orders === "object" &&
        (!payload.orders || typeof payload.orders !== "object")
      ) {
        merged.orders = base.orders;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (error) {}
  }

  function applyArrivalCellHints(root = document) {
    const cells = root.querySelectorAll(ARRIVAL_CELL_SELECTOR);
    cells.forEach((cell) => {
      if (!(cell instanceof HTMLElement)) return;
      cell.classList.add("sc-arrival-clickable");
      cell.dataset.scArrivalClickable = "1";
      if (!cell.title) {
        cell.title = "Клик: зафиксировать время для среза отменой";
      }
    });
  }

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!(style instanceof HTMLStyleElement)) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      document.head.appendChild(style);
    }
    style.textContent = `
      .sc-arrival-clickable {
        cursor: pointer;
      }
      .sc-arrival-clickable:hover {
        text-decoration: underline dotted;
        text-underline-offset: 2px;
      }
      .sc-arrival-clickable.sc-arrival-selected {
        background: rgba(64, 174, 81, 0.16);
      }
      #${MONITOR_PANEL_ID} {
        position: fixed;
        top: 14px;
        left: 40px;
        right: auto;
        z-index: 100000;
        min-width: 260px;
        max-width: 360px;
        padding: 10px 12px;
        border: 1px solid #6f6744;
        border-radius: 8px;
        background: #f4e4bc;
        color: #2d2417;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28);
        font-size: 13px;
        line-height: 1.35;
      }
      #${MONITOR_PANEL_ID} .sc-line-title {
        font-weight: 700;
        margin-bottom: 4px;
      }
      #${MONITOR_PANEL_ID} .sc-line-mode {
        margin-bottom: 4px;
      }
      #${MONITOR_PANEL_ID} .sc-line-second {
        margin-bottom: 4px;
      }
      #${MONITOR_PANEL_ID}[data-sc-decision="send"] .sc-line-decision {
        color: #0d6f1f;
        font-weight: 700;
      }
      #${MONITOR_PANEL_ID}[data-sc-decision="wait"] .sc-line-decision {
        color: #8a1313;
        font-weight: 700;
      }
      #${SECOND_BAR_ID} {
        position: fixed;
        top: 0;
        left: 0;
        width: 30px;
        height: 100vh;
        z-index: 99990;
        pointer-events: none;
        border-left: 1px solid rgba(80, 57, 33, 0.35);
        border-right: 1px solid rgba(80, 57, 33, 0.35);
        background:
          linear-gradient(180deg, rgba(45, 165, 72, 0.14) 0%, rgba(165, 35, 35, 0.14) 100%),
          repeating-linear-gradient(
            to bottom,
            rgba(80, 57, 33, 0.35) 0px,
            rgba(80, 57, 33, 0.35) 1px,
            rgba(255, 255, 255, 0) 1px,
            rgba(255, 255, 255, 0) 20px
          );
        box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
      }
      #${SECOND_BAR_ID} .sc-second-fill {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 0%;
        z-index: 1;
        background: linear-gradient(
          180deg,
          rgba(36, 176, 85, 0.35) 0%,
          rgba(214, 47, 47, 0.35) 100%
        );
      }
      #${SECOND_BAR_ID} .sc-second-window {
        position: absolute;
        left: 0;
        right: 0;
        display: none;
        min-height: 2px;
        z-index: 2;
        background: rgba(42, 122, 199, 0.34);
        box-shadow: inset 0 0 0 1px rgba(15, 74, 130, 0.7);
      }
      #${SECOND_BAR_ID} .sc-second-head {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        height: 3px;
        z-index: 3;
        background: #cf2020;
        box-shadow:
          0 0 0 1px rgba(255, 255, 255, 0.72),
          0 0 8px rgba(207, 32, 32, 0.55);
        transform: translateY(0px);
      }
      #${SECOND_BAR_ID}[data-sc-decision="wait"] .sc-second-head {
        display: none;
      }
      #${SECOND_BAR_ID}[data-sc-decision="send"] .sc-second-head {
        display: block;
      }
      #${SECOND_BAR_ID} .sc-second-top,
      #${SECOND_BAR_ID} .sc-second-bottom,
      #${SECOND_BAR_ID} .sc-second-current,
      #${SECOND_BAR_ID} .sc-second-window-label {
        position: absolute;
        left: 2px;
        right: 2px;
        text-align: center;
        font-size: 10px;
        line-height: 1;
        z-index: 4;
        color: #2d2417;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      #${SECOND_BAR_ID} .sc-second-top {
        top: 3px;
      }
      #${SECOND_BAR_ID} .sc-second-bottom {
        bottom: 3px;
      }
      #${SECOND_BAR_ID} .sc-second-current {
        bottom: 20px;
        font-weight: 700;
      }
      #${SECOND_BAR_ID} .sc-second-window-label {
        top: 18px;
        font-size: 9px;
        font-weight: 700;
        color: #154f80;
        text-shadow: 0 1px 0 rgba(255, 255, 255, 0.9);
      }
      #${SECOND_BAR_ID}[data-window="off"] .sc-second-window-label {
        color: #6d6d6d;
        font-weight: 700;
      }
      #${OWN_PANEL_ID} {
        position: fixed;
        left: 14px;
        top: 14px;
        z-index: 100000;
        min-width: 290px;
        max-width: 430px;
        max-height: 55vh;
        overflow: auto;
        padding: 10px 12px;
        border: 1px solid #26475f;
        border-radius: 8px;
        background: #dcebf5;
        color: #102531;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
        font-size: 12px;
      }
      #${OWN_PANEL_ID} .sc-own-title {
        font-weight: 700;
        margin-bottom: 6px;
      }
      #${OWN_PANEL_ID} .sc-own-line {
        margin-bottom: 4px;
      }
      #${OWN_PANEL_ID} .sc-own-line.err {
        color: #8a1313;
      }
      #${OWN_PANEL_ID} .sc-own-line.ok {
        color: #0e6d24;
      }
      .${OWN_HINT_CLASS} {
        margin-top: 4px;
        font-size: 12px;
        font-weight: 700;
        color: #0f4b0f;
      }
      .${OWN_HINT_CLASS}.urgent {
        color: #b40000;
        font-size: 15px;
        letter-spacing: 0.2px;
      }
      .${OWN_META_CLASS} {
        margin-top: 2px;
        font-size: 11px;
        color: #4f4f4f;
      }
      .${OWN_COUNTDOWN_CLASS} {
        font-weight: 700;
      }
    `;
  }

  function pad2(value) {
    return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
  }

  function pad3(value) {
    return String(Math.max(0, Number(value) || 0)).padStart(3, "0");
  }

  function parseClockText(value) {
    const match = normalizeText(value).match(
      /(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/,
    );
    if (!match) return null;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    const ss = Number(match[3]);
    const ms = Number(String(match[4] || "0").padStart(3, "0").slice(-3));
    if (
      !Number.isInteger(hh) ||
      !Number.isInteger(mm) ||
      !Number.isInteger(ss) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59 ||
      ss < 0 ||
      ss > 59
    ) {
      return null;
    }
    return { hh, mm, ss, ms };
  }

  function extractMillisecondPart(value) {
    const parsed = parseClockText(value);
    return parsed ? parsed.ms : 0;
  }

  function formatClock(dateLike) {
    const dt = new Date(dateLike);
    if (!Number.isFinite(dt.getTime())) return "--:--:--";
    return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(
      dt.getSeconds(),
    )}`;
  }

  function formatClockWithMs(dateLike) {
    const dt = new Date(dateLike);
    if (!Number.isFinite(dt.getTime())) return "--:--:--:---";
    return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}:${pad2(
      dt.getSeconds(),
    )}:${pad3(dt.getMilliseconds())}`;
  }

  function formatDurationHms(ms) {
    if (!Number.isFinite(ms)) return "--:--:--";
    const safeMs = Math.max(0, Math.trunc(ms));
    const totalSec = Math.ceil(safeMs / 1000);
    const hh = Math.floor(totalSec / 3600);
    const mm = Math.floor((totalSec % 3600) / 60);
    const ss = totalSec % 60;
    return `${hh}:${pad2(mm)}:${pad2(ss)}`;
  }

  function isProjectedMsWithinSliceWindow(
    projectedEntryTs,
    sliceWindowStartTs,
    sliceWindowEndTs,
  ) {
    if (
      !Number.isFinite(projectedEntryTs) ||
      !Number.isFinite(sliceWindowStartTs) ||
      !Number.isFinite(sliceWindowEndTs)
    ) {
      return false;
    }

    const projectedTs = Math.trunc(projectedEntryTs);
    const startTs = Math.min(
      Math.trunc(sliceWindowStartTs),
      Math.trunc(sliceWindowEndTs),
    );
    const endTs = Math.max(
      Math.trunc(sliceWindowStartTs),
      Math.trunc(sliceWindowEndTs),
    );
    const projectedSec = Math.trunc(projectedTs / 1000);
    const startSec = Math.trunc(startTs / 1000);
    const endSec = Math.trunc(endTs / 1000);
    const projectedMs = new Date(projectedTs).getMilliseconds();
    const startMs = new Date(startTs).getMilliseconds();
    const endMs = new Date(endTs).getMilliseconds();

    if (startSec === endSec) {
      const minMs = Math.min(startMs, endMs);
      const maxMs = Math.max(startMs, endMs);
      return projectedSec === startSec && projectedMs >= minMs && projectedMs <= maxMs;
    }

    if (endSec === startSec + 1) {
      if (projectedSec === startSec) return projectedMs >= startMs;
      if (projectedSec === endSec) return projectedMs <= endMs;
      return false;
    }

    return projectedTs >= startTs && projectedTs <= endTs;
  }

  function formatSliceMsWindowLabel(sliceWindowStartTs, sliceWindowEndTs) {
    if (!Number.isFinite(sliceWindowStartTs) || !Number.isFinite(sliceWindowEndTs)) {
      return "--";
    }
    const startTs = Math.min(
      Math.trunc(sliceWindowStartTs),
      Math.trunc(sliceWindowEndTs),
    );
    const endTs = Math.max(
      Math.trunc(sliceWindowStartTs),
      Math.trunc(sliceWindowEndTs),
    );
    const startMs = new Date(startTs).getMilliseconds();
    const endMs = new Date(endTs).getMilliseconds();
    const startSec = Math.trunc(startTs / 1000);
    const endSec = Math.trunc(endTs / 1000);

    if (startSec === endSec) {
      return `${pad3(Math.min(startMs, endMs))}-${pad3(Math.max(startMs, endMs))}`;
    }
    if (endSec === startSec + 1) {
      return `${pad3(startMs)}-999 + 000-${pad3(endMs)}`;
    }
    return "000-999";
  }

  function parseDurationMs(value) {
    const match = normalizeText(value).match(/^(\d+):(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    const ss = Number(match[3]);
    if (
      !Number.isInteger(hh) ||
      !Number.isInteger(mm) ||
      !Number.isInteger(ss) ||
      mm < 0 ||
      mm > 59 ||
      ss < 0 ||
      ss > 59
    ) {
      return null;
    }
    return (hh * 3600 + mm * 60 + ss) * 1000;
  }

  function normalizeMonthToken(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я]/gi, "");
  }

  function resolveMonthNumber(token) {
    const norm = normalizeMonthToken(token);
    if (!norm) return null;
    return MONTH_MAP[norm] || null;
  }

  function parseAbsoluteDateText(value) {
    const text = normalizeText(value);
    if (!text) return null;
    const clock = parseClockText(text);
    if (!clock) return null;

    let day = null;
    let month = null;
    let year = null;

    let match = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (match) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    }

    if (!year) {
      match = text.match(/([a-zа-яё.]+)\s*(\d{1,2}),?\s*(\d{4})/i);
      if (match) {
        month = resolveMonthNumber(match[1]);
        day = Number(match[2]);
        year = Number(match[3]);
      }
    }

    if (!year) {
      match = text.match(/(\d{1,2})\s*([a-zа-яё.]+)\s*(\d{4})/i);
      if (match) {
        day = Number(match[1]);
        month = resolveMonthNumber(match[2]);
        year = Number(match[3]);
      }
    }

    if (
      !Number.isInteger(day) ||
      !Number.isInteger(month) ||
      !Number.isInteger(year) ||
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12
    ) {
      return null;
    }

    const dt = new Date(
      year,
      month - 1,
      day,
      clock.hh,
      clock.mm,
      clock.ss,
      clock.ms,
    );
    if (!Number.isFinite(dt.getTime())) return null;
    return dt.getTime();
  }

  function isConfirmScreen() {
    let params;
    try {
      params = new URLSearchParams(String(location.search || ""));
    } catch (error) {
      return false;
    }
    const screen = normalizeText(params.get("screen")).toLowerCase();
    const tryToken = normalizeText(params.get("try")).toLowerCase();
    return screen === "place" && tryToken === "confirm";
  }

  function readStoredSliceData() {
    if (window.SC && window.SC.cancel && window.SC.cancel.time) {
      return window.SC.cancel;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function getCurrentVillageId() {
    try {
      const fromGameData =
        window.game_data &&
        window.game_data.village &&
        window.game_data.village.id;
      if (fromGameData) return String(fromGameData);
    } catch (error) {}
    try {
      const params = new URLSearchParams(String(location.search || ""));
      const fromUrl = normalizeText(params.get("village"));
      if (fromUrl) return fromUrl;
    } catch (error) {}
    return "";
  }

  function resolveSliceBaseTimestamp(stored) {
    if (!stored || typeof stored !== "object") return null;

    const directTs = Number(stored.targetTimestamp);
    if (Number.isFinite(directTs) && directTs > 0) {
      return Math.trunc(directTs);
    }

    const parsedClock = parseClockText(stored.time);
    if (!parsedClock) return null;

    const baseMs = getServerTimeMs() || Date.now();
    const baseDate = new Date(baseMs);
    if (!Number.isFinite(baseDate.getTime())) return null;

    const result = new Date(baseDate.getTime());
    const dayToken = String(stored.dayToken || "").toLowerCase().trim();

    if (dayToken === "tomorrow" || dayToken === "завтра") {
      result.setDate(result.getDate() + 1);
    } else if (dayToken && dayToken !== "today" && dayToken !== "сегодня") {
      const dateMatch = dayToken.match(
        /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2}|\d{4}))?$/,
      );
      if (dateMatch) {
        const day = Number(dateMatch[1]);
        const month = Number(dateMatch[2]);
        let year = Number(result.getFullYear());
        if (dateMatch[3]) {
          const yy = Number(dateMatch[3]);
          year = dateMatch[3].length === 2 ? 2000 + yy : yy;
        }
        if (
          Number.isInteger(day) &&
          day >= 1 &&
          day <= 31 &&
          Number.isInteger(month) &&
          month >= 1 &&
          month <= 12
        ) {
          result.setFullYear(year, month - 1, day);
        }
      }
    }

    result.setHours(
      parsedClock.hh,
      parsedClock.mm,
      parsedClock.ss,
      parsedClock.ms,
    );
    if (!Number.isFinite(result.getTime())) return null;
    return result.getTime();
  }

  function resolveSliceWindow(stored) {
    if (!stored || typeof stored !== "object") return null;
    const startRaw = Number(stored.sliceWindowStart);
    const endRaw = Number(stored.sliceWindowEnd);
    if (
      Number.isFinite(startRaw) &&
      startRaw > 0 &&
      Number.isFinite(endRaw) &&
      endRaw > 0
    ) {
      const start = Math.min(startRaw, endRaw);
      const end = Math.max(startRaw, endRaw);
      return {
        start,
        end,
        center: Math.round((start + end) / 2),
        span: end - start,
      };
    }
    const base = resolveSliceBaseTimestamp(stored);
    if (!Number.isFinite(base) || base <= 0) return null;
    return {
      start: base,
      end: base,
      center: base,
      span: 0,
    };
  }

  function resolveSliceTargetTimestamp(stored) {
    const windowRange = resolveSliceWindow(stored);
    if (!windowRange) return null;
    return windowRange.center;
  }

  function getArrivalTimestampFromRow(row, arrivalCellSelector = "td:nth-child(2)") {
    if (!(row instanceof Element)) return null;
    const secNode = row.querySelector("td:nth-child(3) span[data-endtime]");
    if (!(secNode instanceof HTMLElement)) return null;
    const sec = Number(secNode.getAttribute("data-endtime"));
    if (!Number.isFinite(sec) || sec <= 0) return null;
    const arrivalCell = row.querySelector(arrivalCellSelector);
    const ms = arrivalCell ? extractMillisecondPart(arrivalCell.textContent) : 0;
    return Math.trunc(sec) * 1000 + Math.max(0, Math.min(999, ms));
  }

  function getIncomingWindowFromRow(row) {
    if (!(row instanceof Element)) return null;
    const currentTs = getArrivalTimestampFromRow(row, "td:nth-child(2)");
    if (!Number.isFinite(currentTs) || currentTs <= 0) return null;

    const scope = row.parentElement || row.closest("table") || document;
    const rows = Array.from(scope.querySelectorAll("tr.command-row"));
    const index = rows.indexOf(row);
    if (index <= 0) {
      return {
        start: currentTs,
        end: currentTs,
        center: currentTs,
        current: currentTs,
        prev: null,
        span: 0,
        hasRange: false,
      };
    }

    const prevRow = rows[index - 1];
    const prevTs = getArrivalTimestampFromRow(prevRow, "td:nth-child(2)");
    if (!Number.isFinite(prevTs) || prevTs <= 0) {
      return {
        start: currentTs,
        end: currentTs,
        center: currentTs,
        current: currentTs,
        prev: null,
        span: 0,
        hasRange: false,
      };
    }

    const start = Math.min(prevTs, currentTs);
    const end = Math.max(prevTs, currentTs);
    return {
      start,
      end,
      center: Math.round((start + end) / 2),
      current: currentTs,
      prev: prevTs,
      span: end - start,
      hasRange: end > start,
    };
  }

  function extractSecondFromTimeString(timeValue) {
    const normalized = normalizeText(timeValue);
    const match = normalized.match(
      /^(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?$/,
    );
    if (!match) return null;
    const sec = Number(match[3]);
    if (!Number.isInteger(sec) || sec < 0 || sec > 59) return null;
    return sec;
  }

  function getServerTimeMs() {
    try {
      if (
        window.Timing &&
        typeof window.Timing.getCurrentServerTime === "function"
      ) {
        const value = Number(window.Timing.getCurrentServerTime());
        if (Number.isFinite(value) && value > 0) return value;
      }
    } catch (error) {}
    return null;
  }

  function parityLabel(value) {
    return value % 2 === 0 ? "чётное" : "нечётное";
  }

  function renderMonitorPanel() {
    let panel = document.getElementById(MONITOR_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = MONITOR_PANEL_ID;
    panel.setAttribute("data-sc-decision", "wait");
    panel.innerHTML = `
      <div class="sc-line-title">SC.js · контроль отправки</div>
      <div class="sc-line-mode">Загрузка режима...</div>
      <div class="sc-line-second">Секунда сервера: --</div>
      <div class="sc-line-decision">НЕ ОТПРАВЛЯЙ</div>
    `;
    document.body.appendChild(panel);
    state.monitorPanel = panel;
    return panel;
  }

  function renderSecondBar() {
    let panel = document.getElementById(SECOND_BAR_ID);
    if (panel) {
      state.secondBar = panel;
      return panel;
    }
    panel = document.createElement("div");
    panel.id = SECOND_BAR_ID;
    panel.setAttribute("data-window", "off");
    panel.setAttribute("data-sc-decision", "wait");
    panel.innerHTML = `
      <div class="sc-second-fill"></div>
      <div class="sc-second-window sc-second-window-a"></div>
      <div class="sc-second-window sc-second-window-b"></div>
      <div class="sc-second-head"></div>
      <div class="sc-second-top">000</div>
      <div class="sc-second-window-label">окно: --</div>
      <div class="sc-second-current">000ms</div>
      <div class="sc-second-bottom">999</div>
    `;
    document.body.appendChild(panel);
    state.secondBar = panel;
    return panel;
  }

  function setSecondBarProgress(serverMs) {
    const panel = state.secondBar || document.getElementById(SECOND_BAR_ID);
    if (!panel) return;
    const msInt = Math.max(0, Math.trunc(Number(serverMs) || 0));
    const msPart = ((msInt % 1000) + 1000) % 1000;
    const ratio = msPart / 999;
    const safeRatio = Math.max(0, Math.min(1, ratio));
    const panelHeight = Math.max(1, panel.clientHeight || window.innerHeight || 1);
    const y = Math.round(safeRatio * Math.max(0, panelHeight - 3));
    const fill = panel.querySelector(".sc-second-fill");
    const head = panel.querySelector(".sc-second-head");
    const current = panel.querySelector(".sc-second-current");

    if (fill instanceof HTMLElement) {
      fill.style.height = `${Math.round(safeRatio * 100)}%`;
    }
    if (head instanceof HTMLElement) {
      head.style.transform = `translateY(${y}px)`;
    }
    if (current instanceof HTMLElement) {
      current.textContent = `${pad3(msPart)}ms`;
    }
  }

  function toMsOrNull(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    const ms = Math.trunc(parsed);
    if (ms < 0 || ms > 999) return null;
    return ms;
  }

  function setSecondBarWindowSegments(panel, segments, labelText) {
    const first = panel.querySelector(".sc-second-window-a");
    const second = panel.querySelector(".sc-second-window-b");
    const label = panel.querySelector(".sc-second-window-label");

    const applySegment = (node, segment) => {
      if (!(node instanceof HTMLElement)) return;
      if (!segment) {
        node.style.display = "none";
        node.style.top = "";
        node.style.height = "";
        return;
      }
      const startMs = Math.max(0, Math.min(999, Math.trunc(segment.startMs)));
      const endMs = Math.max(startMs, Math.min(999, Math.trunc(segment.endMs)));
      const topPercent = (startMs / 1000) * 100;
      const heightPercent = ((endMs - startMs + 1) / 1000) * 100;
      node.style.display = "block";
      node.style.top = `${topPercent}%`;
      node.style.height = `${Math.max(0.2, heightPercent)}%`;
    };

    applySegment(first, segments[0] || null);
    applySegment(second, segments[1] || null);

    if (label instanceof HTMLElement) {
      label.textContent = labelText;
    }
  }

  function setSecondBarDecision(canSend) {
    const panel = state.secondBar || document.getElementById(SECOND_BAR_ID);
    if (!panel) return;
    panel.setAttribute("data-sc-decision", canSend ? "send" : "wait");
    const head = panel.querySelector(".sc-second-head");
    if (head instanceof HTMLElement) {
      head.style.display = canSend ? "block" : "none";
    }
  }

  function setSecondBarWindowFromStored(stored) {
    const panel = state.secondBar || document.getElementById(SECOND_BAR_ID);
    if (!panel) return;

    const windowRange = resolveSliceWindow(stored);
    if (!windowRange) {
      panel.setAttribute("data-window", "off");
      setSecondBarWindowSegments(panel, [], "окно: --");
      return;
    }

    const startTs = Number(windowRange.start);
    const endTs = Number(windowRange.end);
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      panel.setAttribute("data-window", "off");
      setSecondBarWindowSegments(panel, [], "окно: --");
      return;
    }

    const startMs = new Date(startTs).getMilliseconds();
    const endMs = new Date(endTs).getMilliseconds();
    const startSecStamp = Math.trunc(startTs / 1000);
    const endSecStamp = Math.trunc(endTs / 1000);
    const span = Math.max(0, Math.trunc(endTs - startTs));

    if (span >= 1000 || endSecStamp > startSecStamp + 1) {
      panel.setAttribute("data-window", "on");
      setSecondBarWindowSegments(
        panel,
        [{ startMs: 0, endMs: 999 }],
        "окно: 000-999",
      );
      return;
    }

    if (startSecStamp === endSecStamp) {
      const minMs = Math.min(startMs, endMs);
      const maxMs = Math.max(startMs, endMs);
      panel.setAttribute("data-window", "on");
      setSecondBarWindowSegments(
        panel,
        [{ startMs: minMs, endMs: maxMs }],
        `окно: ${pad3(minMs)}-${pad3(maxMs)}`,
      );
      return;
    }

    if (endSecStamp === startSecStamp + 1) {
      panel.setAttribute("data-window", "on");
      setSecondBarWindowSegments(
        panel,
        [
          { startMs, endMs: 999 },
          { startMs: 0, endMs },
        ],
        `окно: ${pad3(startMs)}-999 + 000-${pad3(endMs)}`,
      );
      return;
    }

    const minFallback =
      toMsOrNull(stored && stored.sliceWindowMsMin) ?? Math.min(startMs, endMs);
    const maxFallback =
      toMsOrNull(stored && stored.sliceWindowMsMax) ?? Math.max(startMs, endMs);
    panel.setAttribute("data-window", "on");
    setSecondBarWindowSegments(
      panel,
      [{ startMs: minFallback, endMs: maxFallback }],
      `окно: ${pad3(minFallback)}-${pad3(maxFallback)}`,
    );
  }

  function startConfirmSecondBar() {
    if (!isConfirmScreen()) return;
    renderSecondBar();
    if (state.secondBarFrameId !== null) return;
    const loop = () => {
      const serverMs = getServerTimeMs();
      const sourceMs =
        Number.isFinite(serverMs) && serverMs > 0 ? serverMs : Date.now();
      setSecondBarProgress(sourceMs);
      state.secondBarFrameId = window.requestAnimationFrame(loop);
    };
    loop();
  }

  function setMonitorLine(selector, text) {
    const panel = state.monitorPanel || document.getElementById(MONITOR_PANEL_ID);
    if (!panel) return;
    const node = panel.querySelector(selector);
    if (!node) return;
    node.textContent = text;
  }

  function setMonitorDecision(canSend) {
    const panel = state.monitorPanel || document.getElementById(MONITOR_PANEL_ID);
    if (!panel) return;
    panel.setAttribute("data-sc-decision", canSend ? "send" : "wait");
    setMonitorLine(".sc-line-decision", canSend ? "ОТПРАВЛЯЙ" : "НЕ ОТПРАВЛЯЙ");
    setSecondBarDecision(canSend);
  }

  function startConfirmMonitor() {
    if (!isConfirmScreen()) return;
    const panel = renderMonitorPanel();
    startConfirmSecondBar();
    const stored = readStoredSliceData();
    setSecondBarWindowFromStored(stored);
    const targetTimestamp = resolveSliceTargetTimestamp(stored);
    const targetSecond =
      Number.isFinite(targetTimestamp) && targetTimestamp > 0
        ? new Date(targetTimestamp).getSeconds()
        : extractSecondFromTimeString(stored && stored.time);
    if (!Number.isInteger(targetSecond)) {
      setMonitorLine(
        ".sc-line-mode",
        "Нет сохранённого времени среза (сначала зафиксируй его на входящих).",
      );
      setMonitorLine(".sc-line-second", "Секунда сервера: --");
      setMonitorDecision(false);
      notify(
        "SC.js: не найдено время среза. Сначала кликни время прибытия на входящих.",
        "error",
      );
      return;
    }

    const targetParity = targetSecond % 2;
    const targetParityText = parityLabel(targetSecond);
    setMonitorLine(
      ".sc-line-mode",
      `Отправка на ${targetParityText} секунду (эталон: ${String(targetSecond).padStart(2, "0")}).`,
    );

    const tick = () => {
      const serverMs = getServerTimeMs();
      if (!Number.isFinite(serverMs)) {
        setMonitorLine(".sc-line-second", "Секунда сервера: n/a");
        setMonitorDecision(false);
        return;
      }
      const serverDate = new Date(Math.trunc(serverMs));
      const serverSecond = serverDate.getUTCSeconds();
      const secondStamp = Math.trunc(serverMs / 1000);
      const canSend = serverSecond % 2 === targetParity;

      setMonitorLine(
        ".sc-line-second",
        `Секунда сервера: ${String(serverSecond).padStart(2, "0")} (${parityLabel(serverSecond)}).`,
      );
      setMonitorDecision(canSend);

      if (state.lastDecisionSecondStamp !== secondStamp) {
        state.lastDecisionSecondStamp = secondStamp;
        const text = canSend ? "ОТПРАВЛЯЙ" : "НЕ ОТПРАВЛЯЙ";
        console.log(`[${SCRIPT_NAME}] ${text} · sec=${serverSecond}`);
      }
    };

    tick();
    state.monitorTimer = window.setInterval(tick, 500);
    panel.setAttribute("data-sc-monitor-active", "1");
  }

  function renderOwnPlanPanel() {
    let panel = document.getElementById(OWN_PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("div");
    panel.id = OWN_PANEL_ID;
    panel.innerHTML = `<div class="sc-own-title">SC.js · срез отменой</div>`;
    document.body.appendChild(panel);
    state.ownPanel = panel;
    return panel;
  }

  function setOwnPlanTitle(text) {
    const panel = state.ownPanel || renderOwnPlanPanel();
    let node = panel.querySelector(".sc-own-title");
    if (!node) {
      node = document.createElement("div");
      node.className = "sc-own-title";
      panel.prepend(node);
    }
    node.textContent = normalizeText(text) || "SC.js · срез отменой";
  }

  function appendOwnPlanLine(text, kind = "") {
    const panel = state.ownPanel || renderOwnPlanPanel();
    const line = document.createElement("div");
    line.className = `sc-own-line${kind ? ` ${kind}` : ""}`;
    line.textContent = normalizeText(text);
    panel.appendChild(line);
  }

  function relabelOwnCommandsHeader() {
    const headers = Array.from(
      document.querySelectorAll("table.vis th"),
    );
    headers.forEach((th) => {
      if (!(th instanceof HTMLElement)) return;
      const text = normalizeText(th.textContent).toLowerCase();
      if (!text || !/прибытие\s+через/.test(text)) return;
      const table = th.closest("table");
      if (!table) return;
      const hasOwnCancelable = table.querySelector(
        "tr.command-row a.command-cancel[data-id]",
      );
      const hasOwnInfoLink = table.querySelector(
        "tr.command-row a[href*='screen=info_command'][href*='type=own']",
      );
      if (!hasOwnCancelable || !hasOwnInfoLink) return;
      th.textContent = "Отмена через";
    });
  }

  function clearOwnPlanLines() {
    const panel = state.ownPanel || document.getElementById(OWN_PANEL_ID);
    if (!panel) return;
    const lines = panel.querySelectorAll(".sc-own-line");
    lines.forEach((line) => line.remove());
  }

  function collectCancelableOwnCommands() {
    const rows = Array.from(document.querySelectorAll("tr.command-row"));
    const items = [];
    const seen = new Set();

    rows.forEach((row) => {
      const cancelLink = row.querySelector("a.command-cancel[data-id]");
      if (!(cancelLink instanceof HTMLAnchorElement)) return;
      const infoLink = row.querySelector(
        "td a[href*='screen=info_command'][href*='type=own']",
      );
      if (!(infoLink instanceof HTMLAnchorElement)) return;

      const commandId =
        normalizeText(cancelLink.getAttribute("data-id")) ||
        normalizeText(new URL(infoLink.href, location.origin).searchParams.get("id"));
      if (!commandId || seen.has(commandId)) return;
      seen.add(commandId);

      items.push({
        row,
        commandId,
        cancelLinkHref: new URL(cancelLink.href, location.origin).toString(),
        infoUrl: new URL(infoLink.href, location.origin).toString(),
      });
    });

    return items;
  }

  function iterateInfoRows(doc) {
    const rows = Array.from(doc.querySelectorAll("table.vis tr"));
    return rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 2) return null;
        const valueCell = cells[cells.length - 1];
        const labelText = normalizeText(
          cells
            .slice(0, -1)
            .map((cell) => cell.textContent)
            .join(" "),
        ).toLowerCase();
        return {
          row,
          labelText,
          valueCell,
          valueText: normalizeText(valueCell.textContent),
        };
      })
      .filter(Boolean);
  }

  function parseDurationFromInfoDoc(doc) {
    const rows = iterateInfoRows(doc);
    for (const item of rows) {
      if (/(длитель|duration)/i.test(item.labelText)) {
        const durationMs = parseDurationMs(item.valueText);
        if (Number.isFinite(durationMs) && durationMs > 0) return durationMs;
      }
    }
    return null;
  }

  function parseArrivalFromInfoDoc(doc) {
    const rows = iterateInfoRows(doc);
    for (const item of rows) {
      if (!/(прибытие|arrival)/i.test(item.labelText)) continue;
      if (/(до прибытия|time left|remaining)/i.test(item.labelText)) continue;
      const parsed = parseAbsoluteDateText(item.valueText);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  async function fetchCommandInfoDoc(url) {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  function buildRenameUrl(commandId, cancelLinkHref) {
    const id = normalizeText(commandId);
    if (!id) return null;
    try {
      if (window.TribalWars && typeof window.TribalWars.buildURL === "function") {
        const url = window.TribalWars.buildURL("POST", "info_command", {
          ajaxaction: "edit_other_comment",
          id,
        });
        if (url) return new URL(String(url), location.origin).toString();
      }
    } catch (error) {}

    const fallback = new URL("/game.php", location.origin);
    const villageId = getCurrentVillageId();
    if (villageId) fallback.searchParams.set("village", villageId);
    fallback.searchParams.set("screen", "info_command");
    fallback.searchParams.set("ajaxaction", "edit_other_comment");
    fallback.searchParams.set("id", id);
    if (cancelLinkHref) {
      try {
        const parsedCancel = new URL(cancelLinkHref, location.origin);
        const h = normalizeText(parsedCancel.searchParams.get("h"));
        if (h) fallback.searchParams.set("h", h);
      } catch (error) {}
    }
    return fallback.toString();
  }

  function isRenameResponseSuccessful(bodyText, desiredText) {
    const body = String(bodyText || "");
    if (!body) return false;
    const wanted = normalizeText(desiredText).toLowerCase();
    try {
      const json = JSON.parse(body);
      if (json && (json.success === true || json.status === "success")) {
        return true;
      }
      const values = [
        json && json.value,
        json && json.text,
        json && json.label,
        json && json.name,
      ]
        .map((value) => normalizeText(value).toLowerCase())
        .filter(Boolean);
      if (wanted && values.some((value) => value.includes(wanted))) return true;
      if (json && json.error) return false;
    } catch (error) {}

    const low = body.toLowerCase();
    if (wanted && low.includes(wanted)) return true;
    if (/(error|ошиб|forbidden|denied|invalid|permission)/i.test(body)) {
      return false;
    }
    return true;
  }

  async function renameCommand(commandId, cancelLinkHref, renameText) {
    const url = buildRenameUrl(commandId, cancelLinkHref);
    if (!url) return false;
    const keys = [
      "label",
      "text",
      "name",
      "comment",
      "value",
      "new_name",
      "new_label",
    ];

    for (const key of keys) {
      const payload = new URLSearchParams();
      payload.set(key, renameText);
      try {
        const response = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: payload.toString(),
        });
        const body = await response.text();
        if (!response.ok) continue;
        if (isRenameResponseSuccessful(body, renameText)) return true;
      } catch (error) {}
    }
    return false;
  }

  function getOrCreateOwnCountdownNode(targetCell) {
    if (!(targetCell instanceof HTMLElement)) return null;
    let node = targetCell.querySelector(`.${OWN_COUNTDOWN_CLASS}`);
    if (node instanceof HTMLElement) return node;

    const nativeTimerSpans = Array.from(
      targetCell.querySelectorAll("span[data-endtime]"),
    );
    nativeTimerSpans.forEach((span) => span.remove());

    const plainHmsSpans = Array.from(targetCell.querySelectorAll(":scope > span"));
    plainHmsSpans.forEach((span) => {
      if (!(span instanceof HTMLElement)) return;
      if (span.classList.contains(OWN_COUNTDOWN_CLASS)) return;
      if (span.classList.contains(OWN_HINT_CLASS)) return;
      if (span.classList.contains(OWN_META_CLASS)) return;
      if (/^\d+:\d{2}:\d{2}$/.test(normalizeText(span.textContent))) {
        span.remove();
      }
    });

    const directTextNodes = Array.from(targetCell.childNodes);
    directTextNodes.forEach((nodeItem) => {
      if (nodeItem.nodeType !== Node.TEXT_NODE) return;
      if (/^\s*\d+:\d{2}:\d{2}\s*$/.test(String(nodeItem.textContent || ""))) {
        nodeItem.remove();
      }
    });

    node = document.createElement("span");
    node.className = OWN_COUNTDOWN_CLASS;
    targetCell.prepend(node);
    return node;
  }

  function updateOwnCancelCountdowns() {
    const rows = Array.from(
      document.querySelectorAll("tr.command-row[data-sc-cancel-ts]"),
    );
    if (!rows.length) return;
    const nowMs = getServerTimeMs() || Date.now();

    rows.forEach((row) => {
      if (!(row instanceof HTMLElement)) return;
      const cancelTs = Number(row.dataset.scCancelTs);
      if (!Number.isFinite(cancelTs) || cancelTs <= 0) return;
      const urgent = row.dataset.scUrgent === "1";
      const targetCell = row.querySelector("td:nth-child(3)") || row.lastElementChild;
      if (!(targetCell instanceof HTMLElement)) return;
      const countdownNode = getOrCreateOwnCountdownNode(targetCell);
      if (!(countdownNode instanceof HTMLElement)) return;
      countdownNode.textContent = urgent
        ? "СРОЧНО"
        : formatDurationHms(cancelTs - nowMs);
    });
  }

  function startOwnCancelCountdownTicker() {
    updateOwnCancelCountdowns();
    if (state.ownCountdownTimer) return;
    state.ownCountdownTimer = window.setInterval(updateOwnCancelCountdowns, 500);
  }

  function applyPlanToRow(row, renameText, metaText, urgent, cancelTs) {
    if (!(row instanceof Element)) return;
    const targetCell = row.querySelector("td:nth-child(3)") || row.lastElementChild;
    if (!(targetCell instanceof HTMLElement)) return;

    if (Number.isFinite(cancelTs) && cancelTs > 0) {
      row.dataset.scCancelTs = String(Math.trunc(cancelTs));
    }
    row.dataset.scUrgent = urgent ? "1" : "0";

    const countdownNode = getOrCreateOwnCountdownNode(targetCell);
    if (countdownNode) {
      const nowMs = getServerTimeMs() || Date.now();
      countdownNode.textContent = urgent
        ? "СРОЧНО"
        : formatDurationHms(cancelTs - nowMs);
    }

    let hint = targetCell.querySelector(`.${OWN_HINT_CLASS}`);
    if (!(hint instanceof HTMLElement)) {
      hint = document.createElement("div");
      hint.className = OWN_HINT_CLASS;
      targetCell.appendChild(hint);
    }
    hint.textContent = renameText;
    hint.classList.toggle("urgent", Boolean(urgent));

    let meta = targetCell.querySelector(`.${OWN_META_CLASS}`);
    if (!(meta instanceof HTMLElement)) {
      meta = document.createElement("div");
      meta.className = OWN_META_CLASS;
      targetCell.appendChild(meta);
    }
    meta.textContent = metaText;

    const labelNode = row.querySelector(".quickedit-label");
    if (labelNode) {
      labelNode.textContent = renameText;
    }
  }

  function writeOrderPlan(commandId, planPayload) {
    window.SC = window.SC || {};
    window.SC.cancel = window.SC.cancel || {};
    window.SC.cancel.orders = window.SC.cancel.orders || {};
    window.SC.cancel.orders[String(commandId)] = planPayload;

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const base = parsed && typeof parsed === "object" ? parsed : {};
      const orders = base.orders && typeof base.orders === "object" ? base.orders : {};
      orders[String(commandId)] = planPayload;
      base.orders = orders;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
    } catch (error) {}
  }

  async function startOwnCommandsPlanner() {
    if (state.ownPlannerPromise) return state.ownPlannerPromise;
    const job = (async () => {
      const items = collectCancelableOwnCommands();
      if (!items.length) return;

      relabelOwnCommandsHeader();
      renderOwnPlanPanel();
      clearOwnPlanLines();
      const stored = readStoredSliceData();
      const sliceWindow = resolveSliceWindow(stored);
      if (!sliceWindow) {
        setOwnPlanTitle("SC.js · срез отменой");
        appendOwnPlanLine(
          "Нет сохранённого времени захода. Сначала зафиксируй время на входящих.",
          "err",
        );
        return;
      }

      const sliceMsStart = new Date(sliceWindow.start).getMilliseconds();
      const sliceMsEnd = new Date(sliceWindow.end).getMilliseconds();
      const storedSliceMsMin = toMsOrNull(stored && stored.sliceWindowMsMin);
      const storedSliceMsMax = toMsOrNull(stored && stored.sliceWindowMsMax);
      const sliceMsMinRaw =
        storedSliceMsMin !== null ? storedSliceMsMin : Math.min(sliceMsStart, sliceMsEnd);
      const sliceMsMaxRaw =
        storedSliceMsMax !== null ? storedSliceMsMax : Math.max(sliceMsStart, sliceMsEnd);
      const sliceMsMin = Math.min(sliceMsMinRaw, sliceMsMaxRaw);
      const sliceMsMax = Math.max(sliceMsMinRaw, sliceMsMaxRaw);
      const sliceMsWindowLabel = `${pad3(sliceMsMin)}-${pad3(sliceMsMax)}`;

      setOwnPlanTitle(
        `SC.js · окно захода ${formatClockWithMs(
          sliceWindow.start,
        )} - ${formatClockWithMs(sliceWindow.end)}`,
      );
      appendOwnPlanLine(`Найдено приказов с отменой: ${items.length}`);

      let okCount = 0;
      let urgentCount = 0;
      let renameOkCount = 0;
      let errorCount = 0;

      for (const item of items) {
        try {
          const doc = await fetchCommandInfoDoc(item.infoUrl);
          const durationMs = parseDurationFromInfoDoc(doc);
          if (!Number.isFinite(durationMs) || durationMs <= 0) {
            throw new Error("не найдена длительность");
          }

          const arrivalTs =
            getArrivalTimestampFromRow(item.row) || parseArrivalFromInfoDoc(doc);
          if (!Number.isFinite(arrivalTs) || arrivalTs <= 0) {
            throw new Error("не найдено время прибытия");
          }

          const sendTs = arrivalTs - durationMs;
          if (!Number.isFinite(sendTs) || sendTs <= 0) {
            throw new Error("ошибка вычисления отправки");
          }

          const sendSecondStamp = Math.trunc(sendTs / 1000);
          const sliceStartSecondStamp = Math.trunc(sliceWindow.start / 1000);
          const sliceEndSecondStamp = Math.trunc(sliceWindow.end / 1000);
          const fixedMs = new Date(sendTs).getMilliseconds();

          // Для отмены управляются секунды, миллисекунды остаются фиксом от отправки.
          const cancelWindowStartSec = Math.round(
            (sliceStartSecondStamp + sendSecondStamp) / 2,
          );
          const cancelWindowEndSec = Math.round(
            (sliceEndSecondStamp + sendSecondStamp) / 2,
          );
          const cancelSecondStamp = Math.round(
            (cancelWindowStartSec + cancelWindowEndSec) / 2,
          );

          const cancelWindowStart = cancelWindowStartSec * 1000;
          const cancelWindowEnd = cancelWindowEndSec * 1000;
          const cancelTs = cancelSecondStamp * 1000;

          const projectedEntrySecondStamp =
            2 * cancelSecondStamp - sendSecondStamp;
          const projectedEntryTs = projectedEntrySecondStamp * 1000 + fixedMs;
          const cancelMs = new Date(cancelTs).getMilliseconds();
          const projectedMs = fixedMs;
          const inSliceWindowByTime =
            projectedEntrySecondStamp >= sliceStartSecondStamp &&
            projectedEntrySecondStamp <= sliceEndSecondStamp;
          const inSliceWindowByMs =
            projectedMs >= sliceMsMin && projectedMs <= sliceMsMax;
          const urgent = !inSliceWindowByTime || !inSliceWindowByMs;
          if (urgent) urgentCount += 1;

          const renameText = urgent
            ? "ОТМЕНИТЬ СРОЧНО!"
            : `Отменить в ${formatClock(cancelTs)}`;
          const metaText = `Отправка ${formatClockWithMs(
            sendTs,
          )} · отмена ${formatClock(cancelTs)} · прогноз входа ${formatClockWithMs(
            projectedEntryTs,
          )} · ms отправки (фикс) ${pad3(projectedMs)} / окно ${sliceMsWindowLabel} · вход ${
            inSliceWindowByTime && inSliceWindowByMs ? "в окне" : "мимо окна"
          }`;

          applyPlanToRow(item.row, renameText, metaText, urgent, cancelTs);

          const renamed = await renameCommand(
            item.commandId,
            item.cancelLinkHref,
            renameText,
          );
          if (renamed) renameOkCount += 1;

          writeOrderPlan(item.commandId, {
            commandId: item.commandId,
            infoUrl: item.infoUrl,
            sendTimestamp: sendTs,
            cancelTimestamp: cancelTs,
            cancelWindowStart,
            cancelWindowEnd,
            projectedEntryTimestamp: projectedEntryTs,
            cancelMs,
            projectedMs,
            inSliceWindowByTime,
            inSliceWindowByMs,
            sliceWindowStart: sliceWindow.start,
            sliceWindowEnd: sliceWindow.end,
            sliceMsMin,
            sliceMsMax,
            sliceMsWindowLabel,
            renameText,
            urgent,
            updatedAt: new Date().toISOString(),
          });

          okCount += 1;
          appendOwnPlanLine(
            `#${item.commandId}: ${renameText} (${renamed ? "rename OK" : "rename local"})`,
            renamed ? "ok" : "",
          );
        } catch (error) {
          errorCount += 1;
          const text = normalizeText(error && error.message) || "unknown";
          appendOwnPlanLine(`#${item.commandId}: ошибка (${text})`, "err");
        }
      }

      appendOwnPlanLine(
        `Итог: рассчитано ${okCount}, срочно ${urgentCount}, rename OK ${renameOkCount}, ошибок ${errorCount}.`,
      );
      startOwnCancelCountdownTicker();
      notify(
        `SC.js: рассчитано ${okCount}/${items.length}, срочно ${urgentCount}, rename OK ${renameOkCount}.`,
      );
    })();

    state.ownPlannerPromise = job.finally(() => {
      state.ownPlannerPromise = null;
    });
    return state.ownPlannerPromise;
  }

  async function onArrivalClick(event) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cell = target.closest(ARRIVAL_CELL_SELECTOR);
    if (!(cell instanceof HTMLElement)) return;

    const parsed = parseArrivalCell(cell.textContent);
    if (!parsed) {
      notify("Не удалось распознать время прибытия.", "error");
      return;
    }

    const commandId = getCommandIdFromRow(cell);
    const row = cell.closest("tr.command-row");
    const incomingWindow = getIncomingWindowFromRow(row);
    const targetTimestamp = incomingWindow
      ? incomingWindow.center
      : getArrivalTimestampFromRow(row);
    const targetSecond = Number.isFinite(targetTimestamp)
      ? new Date(targetTimestamp).getSeconds()
      : extractSecondFromTimeString(parsed.time);
    const windowStart = incomingWindow ? incomingWindow.start : targetTimestamp;
    const windowEnd = incomingWindow ? incomingWindow.end : targetTimestamp;
    const windowStartMs = Number.isFinite(windowStart)
      ? new Date(windowStart).getMilliseconds()
      : null;
    const windowEndMs = Number.isFinite(windowEnd)
      ? new Date(windowEnd).getMilliseconds()
      : null;
    const payload = {
      source: SCRIPT_NAME,
      version: SCRIPT_VERSION,
      dayToken: parsed.dayToken,
      time: parsed.time,
      targetTimestamp: Number.isFinite(targetTimestamp)
        ? Math.trunc(targetTimestamp)
        : null,
      targetSecond: Number.isInteger(targetSecond) ? targetSecond : null,
      targetParity: Number.isInteger(targetSecond)
        ? targetSecond % 2 === 0
          ? "even"
          : "odd"
        : null,
      sliceWindowStart:
        Number.isFinite(windowStart) && windowStart > 0
          ? Math.trunc(windowStart)
          : null,
      sliceWindowEnd:
        Number.isFinite(windowEnd) && windowEnd > 0 ? Math.trunc(windowEnd) : null,
      sliceWindowSpanMs:
        Number.isFinite(windowStart) &&
        Number.isFinite(windowEnd) &&
        windowEnd >= windowStart
          ? Math.trunc(windowEnd - windowStart)
          : null,
      sliceWindowMsMin:
        Number.isInteger(windowStartMs) && Number.isInteger(windowEndMs)
          ? Math.min(windowStartMs, windowEndMs)
          : null,
      sliceWindowMsMax:
        Number.isInteger(windowStartMs) && Number.isInteger(windowEndMs)
          ? Math.max(windowStartMs, windowEndMs)
          : null,
      commandId,
      updatedAt: new Date().toISOString(),
      rawText: normalizeText(cell.textContent),
    };

    if (state.lastCell && state.lastCell.isConnected) {
      state.lastCell.classList.remove("sc-arrival-selected");
    }
    state.lastCell = cell;
    cell.classList.add("sc-arrival-selected");

    writeCancelSliceData(payload);
    const copied = await copyToClipboard(parsed.time);

    window.dispatchEvent(
      new CustomEvent("sc:cancel-slice-updated", { detail: payload }),
    );
    void startOwnCommandsPlanner();

    if (copied) {
      if (incomingWindow && incomingWindow.hasRange) {
        notify(
          `Окно захода зафиксировано: ${formatClockWithMs(
            incomingWindow.start,
          )} - ${formatClockWithMs(incomingWindow.end)}.`,
          "success",
        );
      } else if (incomingWindow) {
        notify(
          `Заход зафиксирован без окна (нет строки выше): ${formatClockWithMs(
            incomingWindow.current,
          )}.`,
          "success",
        );
      } else {
        notify(`Срез зафиксирован: ${parsed.time}. Данные обновлены.`, "success");
      }
      return;
    }

    notify(
      `Срез зафиксирован: ${parsed.time}. Данные обновлены, но буфер недоступен.`,
      "error",
    );
  }

  function startObserver() {
    const container = document.querySelector(CONTAINER_SELECTOR);
    if (!container) return;
    state.observer = new MutationObserver(() => {
      applyArrivalCellHints(container);
    });
    state.observer.observe(container, {
      childList: true,
      subtree: true,
    });
  }

  function destroy() {
    if (state.clickHandler) {
      document.removeEventListener("click", state.clickHandler, true);
    }
    if (state.observer) {
      state.observer.disconnect();
    }
    if (state.monitorTimer) {
      window.clearInterval(state.monitorTimer);
      state.monitorTimer = null;
    }
    if (state.monitorPanel && state.monitorPanel.isConnected) {
      state.monitorPanel.remove();
    }
    if (state.secondBarFrameId !== null) {
      window.cancelAnimationFrame(state.secondBarFrameId);
      state.secondBarFrameId = null;
    }
    const secondBar = state.secondBar || document.getElementById(SECOND_BAR_ID);
    if (secondBar && secondBar.isConnected) {
      secondBar.remove();
    }
    state.secondBar = null;
    if (state.ownCountdownTimer) {
      window.clearInterval(state.ownCountdownTimer);
      state.ownCountdownTimer = null;
    }
    if (state.ownPanel && state.ownPanel.isConnected) {
      state.ownPanel.remove();
    }
    const selected = document.querySelector(".sc-arrival-selected");
    if (selected) selected.classList.remove("sc-arrival-selected");
    delete window[INSTANCE_KEY];
  }

  function init() {
    ensureStyle();
    applyArrivalCellHints(document);
    relabelOwnCommandsHeader();
    state.clickHandler = (event) => {
      void onArrivalClick(event);
    };
    document.addEventListener("click", state.clickHandler, true);
    startObserver();
    startConfirmMonitor();
    void startOwnCommandsPlanner();
    window[INSTANCE_KEY] = {
      version: SCRIPT_VERSION,
      destroy,
    };
    if (isConfirmScreen()) {
      notify(
        `SC.js v${SCRIPT_VERSION} запущен: режим confirm активен (контроль чёт/нечёт).`,
      );
    } else {
      notify(
        `SC.js v${SCRIPT_VERSION} запущен. Кликни по времени прибытия для фиксации среза.`,
      );
    }
  }

  init();
})();

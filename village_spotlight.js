(() => {
  "use strict";

  const SCRIPT_KEY = "__scriptmmVillageSpotlight";
  const STYLE_ID = "scriptmm-village-spotlight-style";
  const ROOT_ID = "scriptmm-village-spotlight-root";
  const LOAD_ENDPOINT = "/map/village.txt";
  const MAIN_SCRIPT_REMOTE_URLS = [
    "https://raw.githubusercontent.com/krars/tw/main/main.js",
    "https://raw.githubusercontent.com/krars/tw/main/github_ru/main.js",
  ];
  const GAME_REQUEST_MIN_INTERVAL_MS = 250;
  const COMMAND_CACHE_TTL_MS = 30 * 60 * 1000;
  const SIGIL_CACHE_TTL_MS = 10 * 60 * 1000;
  const PLACE_FORM_CACHE_TTL_MS = 5 * 60 * 1000;
  const COMMAND_DETAILS_WORKERS = 8;
  const UNIT_ORDER = [
    "spear",
    "sword",
    "axe",
    "archer",
    "spy",
    "light",
    "marcher",
    "heavy",
    "ram",
    "catapult",
    "knight",
    "snob",
    "militia",
  ];
  const UNIT_LABELS = {
    spear: "коп",
    sword: "меч",
    axe: "топ",
    archer: "лук",
    spy: "разв",
    light: "лк",
    marcher: "кл",
    heavy: "тк",
    ram: "таран",
    catapult: "ката",
    knight: "пал",
    snob: "двор",
    militia: "ополч",
  };
  const PLAN_ACTION_LABELS = {
    slice: "Срез/дефф",
    intercept: "Атака/двор",
  };
  const UNIT_SPEED_FALLBACK = {
    spear: 18,
    sword: 22,
    axe: 18,
    archer: 18,
    spy: 9,
    light: 10,
    marcher: 10,
    heavy: 11,
    ram: 30,
    catapult: 30,
    knight: 10,
    snob: 35,
    militia: 0,
  };

  if (window[SCRIPT_KEY] && typeof window[SCRIPT_KEY].destroy === "function") {
    window[SCRIPT_KEY].destroy();
  }

  const isGamePage = () => {
    try {
      const url = new URL(window.location.href);
      if (url.pathname === "/game.php") return true;
    } catch (error) {
      void error;
    }
    return Boolean(window.game_data);
  };

  if (!isGamePage()) {
    console.warn("[ScriptMM][village-spotlight] not on Tribal Wars game page");
    return;
  }

  const state = {
    villagesByCoord: new Map(),
    villagesLoadPromise: null,
    commandUnitsCache: new Map(),
    sigilCache: new Map(),
    placeCommandFormCache: new Map(),
    speedModelPromise: null,
    mainBridgePromise: null,
    rootEl: null,
    inputEl: null,
    statusEl: null,
    resultEl: null,
    visible: false,
    searchToken: 0,
    searchDebounceTimerId: null,
    currentView: null,
    currentCoordKey: null,
    timerIntervalId: null,
    lastGameRequestAt: 0,
    gameRequestQueue: Promise.resolve(),
    boundKeydown: null,
    boundClick: null,
    boundInput: null,
  };

  const cleanText = (value) =>
    String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const toInt = (value) => {
    const text = cleanText(value).replace(/[^\d-]/g, "");
    if (!text) return NaN;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
  };

  const toNumber = (value) => {
    const text = cleanText(value).replace(",", ".");
    if (!text) return NaN;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : NaN;
  };

  const escapeHtml = (value) =>
    String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });

  const resolveCurrentVillageId = () => {
    try {
      const url = new URL(window.location.href);
      const fromUrl = cleanText(url.searchParams.get("village"));
      if (fromUrl) return fromUrl;
    } catch (error) {
      void error;
    }
    const gameVillage =
      window.game_data &&
      window.game_data.village &&
      window.game_data.village.id != null
        ? window.game_data.village.id
        : null;
    return cleanText(gameVillage);
  };

  const buildGameUrl = (params) => {
    const url = new URL("/game.php", window.location.origin);
    const currentVillageId = resolveCurrentVillageId();
    if (currentVillageId) {
      url.searchParams.set("village", currentVillageId);
    }
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  };

  const getAbsoluteUrl = (value) => {
    const text = cleanText(value);
    if (!text) return null;
    try {
      return new URL(text, window.location.origin).toString();
    } catch (error) {
      return null;
    }
  };

  const getUrlParam = (urlRaw, key) => {
    const urlText = cleanText(urlRaw);
    if (!urlText || !key) return null;
    try {
      return cleanText(new URL(urlText, window.location.origin).searchParams.get(key));
    } catch (error) {
      return null;
    }
  };

  const parseCoordInput = (value) => {
    const text = cleanText(value);
    const match = text.match(/^(\d{1,3})\s*\|\s*(\d{1,3})$/);
    if (!match) return null;
    const x = toInt(match[1]);
    const y = toInt(match[2]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, key: `${x}|${y}` };
  };

  const normalizeCoordDraft = (value) => {
    const raw = String(value == null ? "" : value).replace(/\u00a0/g, " ");
    if (!raw.trim()) return "";

    const explicitMatch = raw.match(/(\d{1,3})\s*\|\s*(\d{0,3})/);
    if (explicitMatch) {
      const left = String(explicitMatch[1] || "").slice(0, 3);
      const right = String(explicitMatch[2] || "").slice(0, 3);
      return right.length ? `${left}|${right}` : `${left}|`;
    }

    const digits = raw.replace(/\D/g, "").slice(0, 6);
    if (!digits) return "";
    if (digits.length <= 3) return digits;
    return `${digits.slice(0, 3)}|${digits.slice(3)}`;
  };

  const extractCoordFromText = (value) => {
    const raw = String(value == null ? "" : value);
    const explicitMatch = raw.match(/(\d{1,3})\s*\|\s*(\d{1,3})/);
    if (explicitMatch) {
      return parseCoordInput(`${explicitMatch[1]}|${explicitMatch[2]}`);
    }
    const compactMatch = raw.match(/\b(\d{3})(\d{3})\b/);
    if (compactMatch) {
      return parseCoordInput(`${compactMatch[1]}|${compactMatch[2]}`);
    }
    return null;
  };

  const syncInputValue = (rawValue, { force = false } = {}) => {
    if (!state.inputEl) return "";
    const currentValue = String(state.inputEl.value == null ? "" : state.inputEl.value);
    if (!force && !currentValue && rawValue == null) return "";
    const nextValue = normalizeCoordDraft(rawValue == null ? currentValue : rawValue);
    if (nextValue !== currentValue) {
      state.inputEl.value = nextValue;
    }
    return nextValue;
  };

  const autofillCoordFromClipboard = async () => {
    if (!state.inputEl || state.inputEl.disabled) return false;
    if (cleanText(state.inputEl.value)) return false;
    const clipboardApi =
      navigator && navigator.clipboard && typeof navigator.clipboard.readText === "function"
        ? navigator.clipboard
        : null;
    if (!clipboardApi) return false;

    try {
      const clipboardText = await clipboardApi.readText();
      if (cleanText(state.inputEl.value)) return false;
      const coord = extractCoordFromText(clipboardText);
      if (!coord) return false;
      state.inputEl.value = coord.key;
      handleInputChange();
      return true;
    } catch (error) {
      return false;
    }
  };

  const parseVillageLine = (lineRaw) => {
    const line = String(lineRaw || "");
    if (!cleanText(line)) return null;
    const parts = line.split(",");
    if (parts.length < 7) return null;

    const id = toInt(parts[0]);
    const rank = toInt(parts[parts.length - 1]);
    const points = toInt(parts[parts.length - 2]);
    const playerId = toInt(parts[parts.length - 3]);
    const y = toInt(parts[parts.length - 4]);
    const x = toInt(parts[parts.length - 5]);
    const name = cleanText(parts.slice(1, parts.length - 5).join(","));

    if (
      !Number.isFinite(id) ||
      id <= 0 ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return null;
    }

    return {
      id: String(id),
      name: name || `Village ${x}|${y}`,
      x,
      y,
      coord: `${x}|${y}`,
      playerId:
        Number.isFinite(playerId) && playerId >= 0 ? String(playerId) : "0",
      points: Number.isFinite(points) ? points : 0,
      rank: Number.isFinite(rank) ? rank : 0,
    };
  };

  const reserveGameRequestSlot = () => {
    const acquire = async () => {
      const now = Date.now();
      const waitMs = Math.max(
        0,
        state.lastGameRequestAt + GAME_REQUEST_MIN_INTERVAL_MS - now,
      );
      if (waitMs > 0) {
        await sleep(waitMs);
      }
      state.lastGameRequestAt = Date.now();
    };

    const slotPromise = state.gameRequestQueue.then(acquire, acquire);
    state.gameRequestQueue = slotPromise.catch(() => null);
    return slotPromise;
  };

  const fetchText = async (
    url,
    { rateLimited = false, method = "GET", headers = undefined, body = undefined } = {},
  ) => {
    if (rateLimited) {
      await reserveGameRequestSlot();
    }
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      method,
      headers,
      body,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const text = String(await response.text());
    const finalUrl = cleanText(response.url || "");
    if (/session-expired/i.test(finalUrl) || /session-expired/i.test(text)) {
      throw new Error("Сессия истекла. Обнови страницу игры.");
    }
    return text;
  };

  const fetchDocument = async (url, { rateLimited = false } = {}) => {
    const text = await fetchText(url, { rateLimited });
    return new DOMParser().parseFromString(text, "text/html");
  };

  const fetchJson = async (url, options = {}) => {
    const text = await fetchText(url, options);
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("Не удалось разобрать JSON ответ.");
    }
  };

  const normalizeUnitKey = (value) => {
    const unit = cleanText(value).toLowerCase();
    if (!unit) return null;
    if (UNIT_ORDER.includes(unit)) return unit;
    return null;
  };

  const getImageBase = () => cleanText(window.image_base || "");

  const getUnitIconUrl = (unitRaw) => {
    const unit = normalizeUnitKey(unitRaw);
    if (!unit) return "";
    const base = getImageBase();
    if (!base) return "";
    try {
      return new URL(`unit/unit_${unit}.webp`, base).toString();
    } catch (error) {
      return "";
    }
  };

  const formatCountdown = (secondsRaw) => {
    const totalSeconds = Math.max(0, Math.round(Number(secondsRaw) || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  };

  const parseTimerToSeconds = (value) => {
    const text = cleanText(value);
    const match = text.match(/^(\d+):(\d{2}):(\d{2})$/);
    if (!match) return null;
    return (
      Math.max(0, toInt(match[1]) || 0) * 3600 +
      Math.max(0, toInt(match[2]) || 0) * 60 +
      Math.max(0, toInt(match[3]) || 0)
    );
  };

  const parseDurationSeconds = (value) => {
    const parts = String(value == null ? "" : value).match(/\d+/g);
    if (!parts || !parts.length) return null;
    const nums = parts
      .map((part) => Number(part))
      .filter((part) => Number.isFinite(part));
    if (!nums.length) return null;
    if (nums.length === 4) {
      return (((nums[0] * 24 + nums[1]) * 60 + nums[2]) * 60) + nums[3];
    }
    if (nums.length === 3) {
      return nums[0] * 3600 + nums[1] * 60 + nums[2];
    }
    if (nums.length === 2) {
      return nums[0] * 60 + nums[1];
    }
    return null;
  };

  const readXmlText = (root, selectors) => {
    const selectorList = Array.isArray(selectors) ? selectors : [selectors];
    for (const selector of selectorList) {
      const node = root && root.querySelector ? root.querySelector(selector) : null;
      const text = cleanText(node && node.textContent);
      if (text) return text;
    }
    return "";
  };

  const fetchXmlDoc = async (url, { rateLimited = false } = {}) => {
    const text = await fetchText(url, { rateLimited });
    return new DOMParser().parseFromString(text, "text/xml");
  };

  const parseUnitInfoBaseSpeeds = (unitDoc) => {
    const parsed = {};
    if (!unitDoc || !unitDoc.documentElement) return parsed;
    Array.from(unitDoc.documentElement.children || []).forEach((node) => {
      const key = cleanText(node && node.tagName).toLowerCase();
      const speed = toNumber(readXmlText(node, "speed"));
      if (!key || !Number.isFinite(speed) || speed <= 0) return;
      parsed[key] = speed;
    });
    return parsed;
  };

  const loadSpeedModel = () => {
    if (state.speedModelPromise) return state.speedModelPromise;
    state.speedModelPromise = (async () => {
      let base = { ...UNIT_SPEED_FALLBACK };
      let worldSpeed = 1;
      let unitSpeed = 1;
      let source = "fallback";

      try {
        const [configDoc, unitDoc] = await Promise.all([
          fetchXmlDoc("/interface.php?func=get_config", { rateLimited: true }),
          fetchXmlDoc("/interface.php?func=get_unit_info", { rateLimited: true }),
        ]);

        const parsedWorldSpeed = toNumber(
          readXmlText(configDoc, ["config > speed", "speed"]),
        );
        const parsedUnitSpeed = toNumber(
          readXmlText(configDoc, ["config > unit_speed", "unit_speed"]),
        );
        if (Number.isFinite(parsedWorldSpeed) && parsedWorldSpeed > 0) {
          worldSpeed = parsedWorldSpeed;
        }
        if (Number.isFinite(parsedUnitSpeed) && parsedUnitSpeed > 0) {
          unitSpeed = parsedUnitSpeed;
        }

        const parsedBase = parseUnitInfoBaseSpeeds(unitDoc);
        if (Object.keys(parsedBase).length) {
          base = { ...base, ...parsedBase };
        }

        source = "live";
      } catch (error) {
        void error;
        source = "fallback";
      }

      const factor = Math.max(0.0001, worldSpeed * unitSpeed);
      const effectiveMinutesPerField = {};
      UNIT_ORDER.forEach((unit) => {
        const baseMinutes = toNumber(base[unit]);
        if (!Number.isFinite(baseMinutes) || baseMinutes <= 0) return;
        effectiveMinutesPerField[unit] = baseMinutes / factor;
      });

      return {
        worldSpeed,
        unitSpeed,
        factor,
        source,
        effectiveMinutesPerField,
      };
    })();
    return state.speedModelPromise;
  };

  const parseVillageTitle = (doc, fallbackVillage) => {
    const heading = cleanText(
      doc.querySelector(
        "#content_value h2, #content_value h3, h2, h3, .village-name",
      ) &&
        doc.querySelector(
          "#content_value h2, #content_value h3, h2, h3, .village-name",
        ).textContent,
    );
    if (heading) return heading;
    const title = cleanText(doc.title).replace(
      /\s*-\s*Война плем[её]н.*$/i,
      "",
    );
    return title || cleanText(fallbackVillage && fallbackVillage.name) || "?";
  };

  const parseVillageOwnerName = (doc, fallbackVillage) => {
    const rows = Array.from(
      doc.querySelectorAll("#content_value table.vis tr, table.vis tr"),
    );
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 2) continue;
      const label = cleanText(cells[0].textContent);
      if (!/^(игрок|player)\s*:?\s*$/i.test(label)) continue;
      const value = cleanText(cells[1].textContent);
      if (value) return value;
    }

    const ownerLink = doc.querySelector(
      '#content_value a[href*="screen=info_player"], a[href*="screen=info_player"]',
    );
    const ownerName = cleanText(ownerLink && ownerLink.textContent);
    if (ownerName) return ownerName;
    if (cleanText(fallbackVillage && fallbackVillage.playerId) === "0") {
      return "Без владельца";
    }
    return "";
  };

  const extractCommandIconsHtml = (commandCell) => {
    if (!commandCell) return "";
    const images = Array.from(
      commandCell.querySelectorAll(".icon-container img[src], img[src*='/graphic/command/']"),
    );
    if (!images.length) return "";
    return images
      .map((img) => {
        const src = getAbsoluteUrl(img.getAttribute("src"));
        if (!src) return "";
        const hintNode = img.closest("[data-icon-hint]");
        const title =
          cleanText(hintNode && hintNode.getAttribute("data-icon-hint")) ||
          cleanText(img.getAttribute("title")) ||
          "";
        return `<img class="svs-command-icon" src="${escapeHtml(src)}" alt=""${
          title ? ` title="${escapeHtml(title)}"` : ""
        } />`;
      })
      .filter(Boolean)
      .join("");
  };

  const parseInfoVillageCommands = (doc, fallbackVillage) => {
    const container =
      doc.querySelector("#commands_outgoings") ||
      doc.querySelector(".commands-container[data-type='towards_village']");
    const rows = container
      ? Array.from(container.querySelectorAll("tr.command-row"))
      : [];

    return rows
      .map((row, index) => {
        const cells = Array.from(row.children || []).filter(
          (cell) => cell && cell.tagName === "TD",
        );
        if (cells.length < 2) return null;

        const commandCell = cells[0];
        const arrivalCell = cells[1];
        const timerCell = cells.length > 2 ? cells[2] : null;
        const label =
          cleanText(
            commandCell.querySelector(".quickedit-label") &&
              commandCell.querySelector(".quickedit-label").textContent,
          ) ||
          cleanText(commandCell.textContent) ||
          "приказ";
        const linkNode =
          commandCell.querySelector("a[href*='screen=info_command']") || null;
        const commandUrl = getAbsoluteUrl(
          cleanText(linkNode && linkNode.getAttribute("href")) ||
            cleanText(linkNode && linkNode.href),
        );
        const commandId =
          cleanText(
            commandCell.querySelector(".quickedit-out") &&
              commandCell.querySelector(".quickedit-out").getAttribute("data-id"),
          ) ||
          cleanText(getUrlParam(commandUrl, "id")) ||
          null;
        const timerNode =
          row.querySelector(".widget-command-timer, .timer_link, .timer") ||
          (timerCell &&
            timerCell.querySelector(".widget-command-timer, .timer_link, .timer"));
        const timerText =
          cleanText(timerNode && timerNode.textContent) ||
          cleanText(timerCell && timerCell.textContent) ||
          "";
        const endTimeSec = Number(
          cleanText(timerNode && timerNode.getAttribute("data-endtime")) || "",
        );

        return {
          key: commandId || `${cleanText(fallbackVillage && fallbackVillage.id) || "v"}_${index}`,
          commandId: commandId || null,
          commandUrl: commandUrl || null,
          label,
          arrivalText: cleanText(arrivalCell.textContent),
          timerText,
          endTimeSec: Number.isFinite(endTimeSec) ? endTimeSec : null,
          iconHtml: extractCommandIconsHtml(commandCell),
          units: null,
          unitsStatus: "pending",
          unitsError: null,
          planState: null,
        };
      })
      .filter(Boolean);
  };

  const extractUnitFromUnitItemClass = (classValue) => {
    const tokens = String(classValue || "")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);
    for (const token of tokens) {
      const match = token.match(/^unit-item-([a-z_]+)$/i);
      if (!match || !match[1]) continue;
      const unit = normalizeUnitKey(match[1]);
      if (unit) return unit;
    }
    return null;
  };

  const extractUnitsFromCommandDoc = (doc) => {
    const candidateRows = [];
    const rows = Array.from(doc.querySelectorAll("#content_value table tr, #content_value tr"));

    rows.forEach((row) => {
      const cells = Array.from(row.children || []).filter(
        (cell) =>
          cell &&
          (cell.tagName === "TD" || cell.tagName === "TH") &&
          /\bunit-item\b/i.test(cleanText(cell.getAttribute("class")) || ""),
      );
      if (!cells.length) return;

      const units = {};
      cells.forEach((cell) => {
        const unit = extractUnitFromUnitItemClass(cell.getAttribute("class"));
        if (!unit) return;
        const dataCount = toInt(cell.getAttribute("data-unit-count"));
        const textCount = toInt(cell.textContent);
        const count = Math.max(
          0,
          Number.isFinite(dataCount) ? dataCount : 0,
          Number.isFinite(textCount) ? textCount : 0,
        );
        if (!count) return;
        units[unit] = Math.max(0, toInt(units[unit]) || 0) + count;
      });

      const total = Object.values(units).reduce(
        (sum, count) => sum + Math.max(0, toInt(count) || 0),
        0,
      );
      if (total <= 0) return;
      candidateRows.push({ units, total });
    });

    if (!candidateRows.length) return {};
    candidateRows.sort((a, b) => b.total - a.total);
    return candidateRows[0].units || {};
  };

  const getCachedCommandUnits = (commandKey) => {
    const key = cleanText(commandKey);
    if (!key) return null;
    const cached = state.commandUnitsCache.get(key);
    if (!cached) return null;
    const ageMs = Date.now() - (Number(cached.loadedAtMs) || 0);
    if (ageMs > COMMAND_CACHE_TTL_MS) {
      state.commandUnitsCache.delete(key);
      return null;
    }
    return cached;
  };

  const setCachedCommandUnits = (commandKey, entry) => {
    const key = cleanText(commandKey);
    if (!key) return;
    state.commandUnitsCache.set(key, {
      loadedAtMs: Date.now(),
      status: cleanText(entry && entry.status) || "loaded",
      units:
        entry && entry.units && typeof entry.units === "object" ? entry.units : {},
    });
  };

  const getCurrentVillageCoord = () => {
    const village =
      window.game_data && window.game_data.village ? window.game_data.village : null;
    const x = toInt(village && village.x);
    const y = toInt(village && village.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y, coord: `${x}|${y}` };
  };

  const readTableValueByLabel = (doc, labelRegex) => {
    const rows = Array.from(
      doc.querySelectorAll("#command-data-form table.vis tr, table.vis tr"),
    );
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 2) continue;
      const label = cleanText(cells[0].textContent);
      if (!labelRegex.test(label)) continue;
      return cleanText(cells[1].textContent);
    }
    return "";
  };

  const getCachedSigil = (cacheKey) => {
    const key = cleanText(cacheKey);
    if (!key) return null;
    const cached = state.sigilCache.get(key);
    if (!cached) return null;
    const ageMs = Date.now() - (Number(cached.loadedAtMs) || 0);
    if (ageMs > SIGIL_CACHE_TTL_MS) {
      state.sigilCache.delete(key);
      return null;
    }
    return cached;
  };

  const setCachedSigil = (cacheKey, entry) => {
    const key = cleanText(cacheKey);
    if (!key) return;
    state.sigilCache.set(key, {
      loadedAtMs: Date.now(),
      ...entry,
    });
  };

  const getCachedPlaceCommandForm = (villageId) => {
    const key = cleanText(villageId);
    if (!key) return null;
    const cached = state.placeCommandFormCache.get(key);
    if (!cached) return null;
    const ageMs = Date.now() - (Number(cached.loadedAtMs) || 0);
    if (ageMs > PLACE_FORM_CACHE_TTL_MS) {
      state.placeCommandFormCache.delete(key);
      return null;
    }
    return cached;
  };

  const setCachedPlaceCommandForm = (snapshot) => {
    const key = cleanText(snapshot && snapshot.currentVillageId);
    if (!key) return;
    state.placeCommandFormCache.set(key, {
      loadedAtMs: Date.now(),
      ...snapshot,
    });
  };

  const parsePlaceCommandFormSnapshot = (doc, currentVillageId) => {
    const form =
      doc.querySelector("form#command-data-form[name='units'][action*='try=confirm']") ||
      doc.querySelector("form[name='units'][action*='try=confirm']") ||
      doc.querySelector("form#command-data-form[action*='try=confirm']");
    if (!form) {
      throw new Error("Не найдена форма площади для расчета сигила.");
    }

    const baseParams = [];
    Array.from(form.elements || []).forEach((element) => {
      if (!element || !element.tagName) return;
      const name = cleanText(element.name || element.getAttribute("name"));
      if (!name || element.disabled) return;
      const type = cleanText(element.type || element.getAttribute("type")).toLowerCase();
      if (["submit", "button", "image", "file"].includes(type)) return;
      if ((type === "checkbox" || type === "radio") && !element.checked) return;
      baseParams.push([name, String(element.value == null ? "" : element.value)]);
    });

    const availableUnits = {};
    UNIT_ORDER.forEach((unit) => {
      const input = form.querySelector(`input[name="${unit}"]`);
      if (!input) return;
      const attrCount = toInt(input.getAttribute("data-all-count"));
      const fallbackText = cleanText(
        form.querySelector(`#units_entry_all_${unit}`) &&
          form.querySelector(`#units_entry_all_${unit}`).textContent,
      );
      const fallbackCount = toInt(fallbackText.replace(/[()]/g, ""));
      const count = Number.isFinite(attrCount)
        ? attrCount
        : Number.isFinite(fallbackCount)
          ? fallbackCount
          : 0;
      availableUnits[unit] = Math.max(0, count);
    });

    return {
      currentVillageId: cleanText(currentVillageId),
      sourceVillageId:
        cleanText(
          form.querySelector('input[name="source_village"]') &&
            form.querySelector('input[name="source_village"]').value,
        ) || cleanText(currentVillageId),
      baseParams,
      availableUnits,
    };
  };

  const loadPlaceCommandFormSnapshot = async ({ force = false } = {}) => {
    const currentVillageId = resolveCurrentVillageId();
    if (!currentVillageId) {
      throw new Error("Не удалось определить текущую деревню.");
    }

    if (!force) {
      const cached = getCachedPlaceCommandForm(currentVillageId);
      if (cached) return cached;
    }

    const liveForm = document.querySelector(
      "form#command-data-form[name='units'][action*='try=confirm']",
    );
    if (liveForm && !force) {
      const liveSnapshot = parsePlaceCommandFormSnapshot(document, currentVillageId);
      setCachedPlaceCommandForm(liveSnapshot);
      return liveSnapshot;
    }

    const placeDoc = await fetchDocument(buildGameUrl({ screen: "place" }), {
      rateLimited: true,
    });
    const snapshot = parsePlaceCommandFormSnapshot(placeDoc, currentVillageId);
    setCachedPlaceCommandForm(snapshot);
    return snapshot;
  };

  const chooseSigilProbeUnit = (availableUnits) => {
    for (const unit of UNIT_ORDER) {
      if (unit === "militia") continue;
      const count = Math.max(0, toInt(availableUnits && availableUnits[unit]) || 0);
      if (count > 0) {
        return { unit, count };
      }
    }
    return null;
  };

  const parseSigilDialog = (dialogHtml) => {
    const doc = new DOMParser().parseFromString(String(dialogHtml || ""), "text/html");
    return {
      durationText: readTableValueByLabel(doc, /длительн|duration/i),
    };
  };

  const formatSigilLabel = (sigilPercent) => {
    if (!Number.isFinite(sigilPercent) || sigilPercent < 0.1) {
      return "без сигила";
    }
    if (sigilPercent < 10) {
      return `сигил ${sigilPercent.toFixed(1)}%`;
    }
    return `сигил ${Math.round(sigilPercent)}%`;
  };

  const buildSigilTooltip = (result) => {
    if (!result) return "";
    return [
      `Маршрут ${result.sourceCoord} -> ${result.targetCoord}`,
      `Юнит ${UNIT_LABELS[result.probeUnit] || result.probeUnit}`,
      `База ${formatCountdown(result.baseDurationSec)}`,
      `Факт ${formatCountdown(result.observedDurationSec)}`,
      `Сигил ${result.sigilPercent.toFixed(2)}%`,
    ].join(" | ");
  };

  const requestVillageSigil = async (village, { refreshPlaceForm = false } = {}) => {
    const currentVillageId = resolveCurrentVillageId();
    const currentVillageCoord = getCurrentVillageCoord();
    if (!currentVillageId || !currentVillageCoord) {
      throw new Error("Не удалось определить свою деревню для расчета сигила.");
    }

    const targetX = toInt(village && village.x);
    const targetY = toInt(village && village.y);
    if (!Number.isFinite(targetX) || !Number.isFinite(targetY)) {
      throw new Error("Не удалось определить координаты цели.");
    }

    const snapshot = await loadPlaceCommandFormSnapshot({ force: refreshPlaceForm });
    const probe = chooseSigilProbeUnit(snapshot.availableUnits);
    if (!probe) {
      throw new Error("Нет доступной юниты для тестового расчета сигила.");
    }

    const speedModel = await loadSpeedModel();
    const minutesPerField = toNumber(speedModel.effectiveMinutesPerField[probe.unit]);
    if (!Number.isFinite(minutesPerField) || minutesPerField <= 0) {
      throw new Error("Не удалось получить скорость тестовой юниты.");
    }

    const params = new URLSearchParams();
    snapshot.baseParams.forEach(([name, value]) => {
      params.append(name, value);
    });

    UNIT_ORDER.forEach((unit) => {
      if (unit === "militia") return;
      params.set(unit, unit === probe.unit ? "1" : "");
    });

    params.set("source_village", cleanText(snapshot.sourceVillageId) || currentVillageId);
    params.set("village", currentVillageId);
    params.set("screen", "place");
    params.set("ajax", "confirm");
    params.set("template_id", "");
    params.set("target_type", "coord");
    params.set("x", String(targetX));
    params.set("y", String(targetY));
    params.set("input", `${targetX}|${targetY}`);
    params.delete("attack");
    params.delete("submit_confirm");
    params.set("support", "");

    const csrf = cleanText(window.game_data && window.game_data.csrf);
    if (csrf) {
      params.set("h", csrf);
    }

    const payload = await fetchJson(buildGameUrl({ screen: "place", ajax: "confirm" }), {
      rateLimited: true,
      method: "POST",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "tribalwars-ajax": "1",
        "x-requested-with": "XMLHttpRequest",
      },
      body: params.toString(),
    });

    const dialogHtml =
      payload &&
      payload.response &&
      typeof payload.response.dialog === "string"
        ? payload.response.dialog
        : "";
    if (!dialogHtml) {
      const message =
        cleanText(payload && payload.error) ||
        cleanText(payload && payload.message) ||
        cleanText(payload && payload.response && payload.response.error) ||
        "Пустой ответ ajax=confirm.";
      throw new Error(message);
    }

    const { durationText } = parseSigilDialog(dialogHtml);
    const observedDurationSec = parseDurationSeconds(durationText);
    if (!Number.isFinite(observedDurationSec) || observedDurationSec <= 0) {
      throw new Error("Не удалось вытащить длительность из ajax=confirm.");
    }

    const dx = targetX - currentVillageCoord.x;
    const dy = targetY - currentVillageCoord.y;
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance <= 0) {
      throw new Error("Некорректная дистанция между деревнями.");
    }

    const baseDurationSec = distance * minutesPerField * 60;
    let sigilPercent = (baseDurationSec / observedDurationSec - 1) * 100;
    sigilPercent = Math.max(0, Math.min(100, sigilPercent));

    return {
      sigilPercent,
      baseDurationSec,
      observedDurationSec,
      probeUnit: probe.unit,
      probeLabel: UNIT_LABELS[probe.unit] || probe.unit,
      distance,
      sourceCoord: currentVillageCoord.coord,
      targetCoord: `${targetX}|${targetY}`,
      speedModelSource: cleanText(speedModel.source) || "fallback",
    };
  };

  const updateView = (view, patch) => {
    if (!view || typeof patch !== "object" || !patch) return;
    Object.assign(view, patch);
    if (state.currentView === view) {
      renderCurrentView();
    }
  };

  const loadVillageSigil = async (view, village, token) => {
    const currentVillageId = resolveCurrentVillageId();
    const cacheKey = `${cleanText(currentVillageId)}::${cleanText(village && village.coord)}`;
    const cached = getCachedSigil(cacheKey);
    if (cached) {
      updateView(view, {
        sigilStatus: cleanText(cached.status) || "loaded",
        sigilPercent: Number(cached.sigilPercent),
        sigilLabel: cleanText(cached.label),
        sigilTooltip: cleanText(cached.tooltip),
      });
      return;
    }

    updateView(view, {
      sigilStatus: "loading",
      sigilPercent: null,
      sigilLabel: "сигил...",
      sigilTooltip: "",
    });

    try {
      let result;
      try {
        result = await requestVillageSigil(village);
      } catch (firstError) {
        state.placeCommandFormCache.delete(cleanText(currentVillageId));
        result = await requestVillageSigil(village, { refreshPlaceForm: true });
      }
      if (token !== state.searchToken) return;

      const label = formatSigilLabel(result.sigilPercent);
      const tooltip = buildSigilTooltip(result);
      setCachedSigil(cacheKey, {
        status: "loaded",
        sigilPercent: result.sigilPercent,
        label,
        tooltip,
      });

      updateView(view, {
        sigilStatus: "loaded",
        sigilPercent: result.sigilPercent,
        sigilLabel: label,
        sigilTooltip: tooltip,
      });
    } catch (error) {
      if (token !== state.searchToken) return;
      updateView(view, {
        sigilStatus: "error",
        sigilPercent: null,
        sigilLabel: "сигил ?",
        sigilTooltip: cleanText(error && error.message) || "Ошибка расчета сигила",
      });
    }
  };

  const buildBaseView = (village) => ({
    villageId: cleanText(village && village.id) || null,
    playerId: cleanText(village && village.playerId) || "0",
    coord: cleanText(village && village.coord) || null,
    mapName: cleanText(village && village.name) || null,
    title: cleanText(village && village.name) || cleanText(village && village.coord) || "?",
    ownerName: "",
    mapUrl:
      Number.isFinite(toInt(village && village.x)) &&
      Number.isFinite(toInt(village && village.y))
        ? buildGameUrl({
            screen: "map",
            x: toInt(village.x),
            y: toInt(village.y),
            beacon: 1,
          })
        : null,
    sigilStatus: "idle",
    sigilPercent: null,
    sigilLabel: "",
    sigilTooltip: "",
    infoStatus: "loading",
    infoUrl: null,
    commands: [],
  });

  const formatUnitsHtml = (unitsRaw) => {
    const units = unitsRaw && typeof unitsRaw === "object" ? unitsRaw : {};
    const entries = UNIT_ORDER.filter((unit) => Math.max(0, toInt(units[unit]) || 0) > 0);
    if (!entries.length) {
      return '<span class="svs-units-empty">нет данных</span>';
    }
    return `<div class="svs-units-wrap">${entries
      .map((unit) => {
        const count = Math.max(0, toInt(units[unit]) || 0);
        const icon = getUnitIconUrl(unit);
        const label = UNIT_LABELS[unit] || unit;
        return `<span class="svs-unit-chip" title="${escapeHtml(label)}: ${count}">${
          icon
            ? `<img class="svs-unit-icon" src="${escapeHtml(icon)}" alt="" />`
            : `<span class="svs-unit-fallback">${escapeHtml(label)}</span>`
        }<span class="svs-unit-count">${count}</span></span>`;
      })
      .join("")}</div>`;
  };

  const countResolvedCommands = (commands) =>
    (Array.isArray(commands) ? commands : []).filter((command) =>
      ["loaded", "empty", "error", "unavailable"].includes(
        cleanText(command && command.unitsStatus),
      ),
    ).length;

  const normalizePlanAction = (value) => {
    const action = cleanText(value);
    if (action === "slice" || action === "intercept") return action;
    return null;
  };

  const getPlanActionLabel = (actionRaw) => {
    const action = normalizePlanAction(actionRaw);
    return action ? PLAN_ACTION_LABELS[action] : "Расчет";
  };

  const actionUsesSigil = (actionRaw) => normalizePlanAction(actionRaw) === "slice";

  const buildCommandPlanRequestId = () =>
    `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const sanitizeDomToken = (value, fallback = "node") => {
    const token = cleanText(value).replace(/[^a-z0-9_-]+/gi, "_");
    return token || fallback;
  };

  const buildPlanSlotId = (commandKey) =>
    `svs_plan_${sanitizeDomToken(commandKey, "command")}`;

  const getPlanSlotNode = (commandKey) =>
    document.getElementById(buildPlanSlotId(commandKey));

  const findCommandIndexByKey = (view, commandKeyRaw) => {
    const commandKey = cleanText(commandKeyRaw);
    const commands = Array.isArray(view && view.commands) ? view.commands : [];
    return commands.findIndex(
      (command) => cleanText(command && command.key) === commandKey,
    );
  };

  const getCommandByKey = (view, commandKeyRaw) => {
    const index = findCommandIndexByKey(view, commandKeyRaw);
    if (index < 0) return null;
    return view.commands[index] || null;
  };

  const buildSpotlightIncomingId = (view, command) =>
    [
      "svs",
      cleanText(view && view.villageId) || "v",
      cleanText(command && command.commandId) || cleanText(command && command.key) || "cmd",
    ].join("_");

  const buildSpotlightIncoming = (view, command) => {
    if (!view || !command) return null;
    const etaEpochMs = Number(command.endTimeSec) * 1000;
    const targetCoord = cleanText(view.coord);
    if (!targetCoord || !Number.isFinite(etaEpochMs) || etaEpochMs <= 0) {
      return null;
    }
    const incoming = {
      id: buildSpotlightIncomingId(view, command),
      sourceIncomingId: cleanText(command.commandId) || cleanText(command.key),
      target: targetCoord,
      targetCoord,
      targetVillageId: cleanText(view.villageId) || null,
      arrivalText:
        cleanText(command.arrivalText) ||
        new Date(etaEpochMs).toLocaleString("ru-RU"),
      etaEpochMs,
      arrivalEpochMs: etaEpochMs,
      timerText: cleanText(command.timerText) || null,
      commandType: "attack",
      displayType: "attack",
    };
    if (Number.isFinite(Number(view.sigilPercent))) {
      incoming.sigilPercent = Number(view.sigilPercent);
    }
    return incoming;
  };

  const buildSpotlightIncomingList = (view) =>
    (Array.isArray(view && view.commands) ? view.commands : [])
      .map((command) => buildSpotlightIncoming(view, command))
      .filter(Boolean)
      .sort((left, right) => Number(left.etaEpochMs || 0) - Number(right.etaEpochMs || 0));

  const scriptCodeHasSpotlightBridge = (codeRaw) => {
    const code = String(codeRaw || "");
    return (
      /\brenderSpotlightPlanPanel\b/.test(code) &&
      /\b__ScriptMMExternalOnly\b/.test(code)
    );
  };

  const ensureMainBridgeLoaded = () => {
    if (
      window.ScriptMM &&
      typeof window.ScriptMM.renderSpotlightPlanPanel === "function"
    ) {
      return Promise.resolve(window.ScriptMM);
    }
    if (state.mainBridgePromise) {
      return state.mainBridgePromise;
    }

    state.mainBridgePromise = (async () => {
      const errors = [];
      for (const remoteUrl of MAIN_SCRIPT_REMOTE_URLS) {
        const url = `${remoteUrl}?ts=${Date.now()}`;
        const response = await fetch(url, {
          credentials: "omit",
          cache: "no-store",
        });
        if (!response.ok) {
          errors.push(`${remoteUrl}: HTTP ${response.status}`);
          continue;
        }
        let code = String(await response.text());
        code = code.replace(/^\s*javascript:\s*/i, "");
        if (!scriptCodeHasSpotlightBridge(code)) {
          errors.push(`${remoteUrl}: bridge не найден в коде`);
          continue;
        }
        window.__ScriptMMExternalOnly = true;
        try {
          const script = document.createElement("script");
          script.textContent = code;
          document.documentElement.appendChild(script);
          script.remove();
        } finally {
          try {
            delete window.__ScriptMMExternalOnly;
          } catch (error) {
            window.__ScriptMMExternalOnly = false;
          }
        }
        if (
          window.ScriptMM &&
          typeof window.ScriptMM.renderSpotlightPlanPanel === "function"
        ) {
          return window.ScriptMM;
        }
        errors.push(`${remoteUrl}: main.js исполнился, но bridge не зарегистрирован`);
      }
      throw new Error(
        errors.length
          ? errors.join(" | ")
          : "Не удалось найти bridge-версию main.js.",
      );
    })();

    return state.mainBridgePromise.catch((error) => {
      state.mainBridgePromise = null;
      throw error;
    });
  };

  const renderPlanPlaceholder = (slotNode, text, type = "muted") => {
    if (!slotNode) return;
    slotNode.innerHTML = `<div class="svs-plan-placeholder svs-plan-${escapeHtml(
      cleanText(type) || "muted",
    )}">${escapeHtml(cleanText(text) || "")}</div>`;
  };

  const mountCommandPlan = async (commandKeyRaw) => {
    const view = state.currentView;
    const commandKey = cleanText(commandKeyRaw);
    const command = getCommandByKey(view, commandKey);
    const planState = command && command.planState ? command.planState : null;
    if (!view || !command || !planState || cleanText(planState.status) !== "ready") {
      return false;
    }

    const slotNode = getPlanSlotNode(commandKey);
    if (!slotNode) return false;
    const renderKey = [
      cleanText(planState.requestId),
      cleanText(planState.action),
      Number.isFinite(Number(view.sigilPercent))
        ? Number(view.sigilPercent).toFixed(2)
        : "na",
    ].join("|");
    if (slotNode.getAttribute("data-svs-plan-rendered") === renderKey) {
      return true;
    }
    if (planState.renderPromise) {
      return planState.renderPromise;
    }

    planState.renderPromise = (async () => {
      renderPlanPlaceholder(slotNode, "Строю таблицу расчета...", "muted");
      const bridge = await ensureMainBridgeLoaded();
      const currentView = state.currentView;
      const currentCommand = getCommandByKey(currentView, commandKey);
      const currentPlanState =
        currentCommand && currentCommand.planState ? currentCommand.planState : null;
      if (
        !currentView ||
        !currentCommand ||
        !currentPlanState ||
        cleanText(currentPlanState.requestId) !== cleanText(planState.requestId)
      ) {
        return false;
      }

      const mountNode = getPlanSlotNode(commandKey);
      if (!mountNode) return false;

      const incoming = buildSpotlightIncoming(currentView, currentCommand);
      if (!incoming) {
        throw new Error("Для этого приказа нет точного времени прибытия.");
      }

      const result = await bridge.renderSpotlightPlanPanel({
        mountNode,
        incoming,
        incomings: buildSpotlightIncomingList(currentView),
        action: currentPlanState.action,
        actionLabel: getPlanActionLabel(currentPlanState.action),
        sigilPercent: actionUsesSigil(currentPlanState.action)
          ? currentView.sigilPercent
          : undefined,
        statusMessage: `${getPlanActionLabel(currentPlanState.action)} построен.`,
      });

      if (!result || result.ok === false) {
        throw new Error("main.js не смог построить таблицу.");
      }

      mountNode.setAttribute("data-svs-plan-rendered", renderKey);
      return true;
    })()
      .catch((error) => {
        const currentView = state.currentView;
        const currentIndex = findCommandIndexByKey(currentView, commandKey);
        if (currentIndex >= 0) {
          const currentCommand = currentView.commands[currentIndex];
          const currentPlanState =
            currentCommand && currentCommand.planState ? currentCommand.planState : null;
          if (
            currentPlanState &&
            cleanText(currentPlanState.requestId) === cleanText(planState.requestId)
          ) {
            currentPlanState.status = "error";
            currentPlanState.error =
              cleanText(error && error.message) || "Ошибка построения таблицы.";
            renderCurrentView();
          }
        }
        return false;
      })
      .finally(() => {
        const currentView = state.currentView;
        const currentIndex = findCommandIndexByKey(currentView, commandKey);
        if (currentIndex >= 0) {
          const currentCommand = currentView.commands[currentIndex];
          if (currentCommand && currentCommand.planState === planState) {
            delete currentCommand.planState.renderPromise;
          }
        }
        queueMicrotask(() => {
          syncCurrentViewInlinePlans();
        });
      });

    return planState.renderPromise;
  };

  const syncCurrentViewInlinePlans = () => {
    const view = state.currentView;
    if (!view || !state.resultEl) return;
    (Array.isArray(view.commands) ? view.commands : []).forEach((command) => {
      const planState = command && command.planState ? command.planState : null;
      if (!planState) return;
      const slotNode = getPlanSlotNode(command.key);
      if (!slotNode) return;
      const status = cleanText(planState.status);
      if (status === "loading") {
        renderPlanPlaceholder(slotNode, "Подключаю расчет...", "muted");
        return;
      }
      if (status === "error") {
        renderPlanPlaceholder(
          slotNode,
          cleanText(planState.error) || "Не удалось построить таблицу.",
          "error",
        );
        return;
      }
      if (status === "ready") {
        void mountCommandPlan(command.key);
      }
    });
  };

  const toggleCommandPlan = async (commandKeyRaw, actionRaw) => {
    const view = state.currentView;
    const commandKey = cleanText(commandKeyRaw);
    const action = normalizePlanAction(actionRaw);
    if (!view || !commandKey || !action) return;

    const commandIndex = findCommandIndexByKey(view, commandKey);
    if (commandIndex < 0) return;
    const currentCommand = view.commands[commandIndex];
    const currentPlanState =
      currentCommand && currentCommand.planState ? currentCommand.planState : null;

    if (currentPlanState && cleanText(currentPlanState.action) === action) {
      view.commands[commandIndex] = {
        ...currentCommand,
        planState: null,
      };
      renderCurrentView();
      return;
    }

    const requestId = buildCommandPlanRequestId();
    view.commands[commandIndex] = {
      ...currentCommand,
      planState: {
        action,
        status: "loading",
        error: null,
        requestId,
      },
    };
    renderCurrentView();

    try {
      await ensureMainBridgeLoaded();
      const nextCommand = getCommandByKey(state.currentView, commandKey);
      const nextPlanState =
        nextCommand && nextCommand.planState ? nextCommand.planState : null;
      if (
        !nextCommand ||
        !nextPlanState ||
        cleanText(nextPlanState.requestId) !== requestId
      ) {
        return;
      }
      nextPlanState.status = "ready";
      nextPlanState.error = null;
      void mountCommandPlan(commandKey);
    } catch (error) {
      const latestCommand = getCommandByKey(state.currentView, commandKey);
      const latestPlanState =
        latestCommand && latestCommand.planState ? latestCommand.planState : null;
      if (
        latestCommand &&
        latestPlanState &&
        cleanText(latestPlanState.requestId) === requestId
      ) {
        latestPlanState.status = "error";
        latestPlanState.error =
          cleanText(error && error.message) || "Не удалось загрузить main.js.";
        renderCurrentView();
      }
    }
  };

  const renderIdle = () => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML = "";
  };

  const renderNotFound = (coordKey) => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML = `<div class="svs-empty">Для <code>${escapeHtml(
      coordKey,
    )}</code> деревня не найдена.</div>`;
  };

  const renderInvalid = () => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML =
      '<div class="svs-empty">Нужен формат <code>xxx|yyy</code>.</div>';
  };

  const setStatus = (text, type = "muted") => {
    if (!state.statusEl) return;
    state.statusEl.textContent = cleanText(text) || "";
    state.statusEl.setAttribute("data-svs-status", cleanText(type) || "muted");
  };

  const refreshCountdowns = () => {
    if (!state.rootEl || state.rootEl.hidden) return;
    Array.from(state.rootEl.querySelectorAll("[data-svs-endtime]")).forEach((node) => {
      const endTimeSec = Number(node.getAttribute("data-svs-endtime"));
      if (!Number.isFinite(endTimeSec)) return;
      const diffSeconds = Math.max(
        0,
        Math.round(endTimeSec - Date.now() / 1000),
      );
      node.textContent = formatCountdown(diffSeconds);
    });
  };

  const renderCurrentView = () => {
    if (!state.resultEl) return;
    const view = state.currentView;
    if (!view) {
      renderIdle();
      return;
    }

    const commands = Array.isArray(view.commands) ? view.commands : [];
    const resolvedCount = countResolvedCommands(commands);
    const commandsMeta = commands.length
      ? `Приказы: ${commands.length} · войска: ${resolvedCount}/${commands.length}`
      : "Приказы: 0";

    const commandsHtml =
      view.infoStatus === "error"
        ? `<div class="svs-empty">Не удалось загрузить приказы для <code>${escapeHtml(
            cleanText(view.coord),
          )}</code>.</div>`
        : view.infoStatus === "loading" && !commands.length
          ? '<div class="svs-empty">Загружаю страницу деревни и список приказов...</div>'
          : commands.length
            ? `<div class="svs-commands-wrap"><table class="svs-commands-table"><thead><tr><th>Приказ</th><th>Прибытие</th><th>Через</th><th>Войска</th><th class="svs-actions-head">Расчет</th></tr></thead><tbody>${commands
                .map((command) => {
                  const planState =
                    command && command.planState && typeof command.planState === "object"
                      ? command.planState
                      : null;
                  const activeAction = normalizePlanAction(planState && planState.action);
                  const hasEta = Number.isFinite(Number(command && command.endTimeSec));
                  const unitsCell =
                    command.unitsStatus === "loaded"
                      ? formatUnitsHtml(command.units)
                      : command.unitsStatus === "empty"
                        ? '<span class="svs-units-empty">нет войск</span>'
                        : command.unitsStatus === "error"
                          ? `<span class="svs-units-error" title="${escapeHtml(
                              cleanText(command.unitsError) || "Ошибка запроса",
                            )}">ошибка</span>`
                          : command.unitsStatus === "unavailable"
                            ? '<span class="svs-units-empty">нет ссылки</span>'
                            : '<span class="svs-units-loading">загрузка...</span>';

                  const timerHtml = command.endTimeSec
                    ? `<span class="svs-timer" data-svs-endtime="${escapeHtml(
                        command.endTimeSec,
                      )}">${escapeHtml(command.timerText || "")}</span>`
                    : escapeHtml(command.timerText || "");

                  const renderPlanButton = (action) => {
                    const disabled = !hasEta;
                    const isActive = activeAction === action;
                    const buttonLabel =
                      action === "slice" ? "Срез/дефф" : "Атака/двор";
                    const title =
                      action === "slice"
                        ? "С учетом сигила"
                        : "Без учета сигила";
                    return `<button class="svs-plan-btn${
                      isActive ? " is-active" : ""
                    }" type="button" data-svs-plan-action="${escapeHtml(
                      action,
                    )}" data-svs-command-key="${escapeHtml(
                      cleanText(command.key),
                    )}" title="${escapeHtml(
                      disabled ? "Нет точного ETA" : title,
                    )}"${disabled ? " disabled" : ""}>${escapeHtml(
                      buttonLabel,
                    )}</button>`;
                  };

                  const commandRowHtml = `<tr><td class="svs-command-cell"><div class="svs-command-main"><span class="svs-command-icons">${
                    command.iconHtml || ""
                  }</span><div class="svs-command-text"><div class="svs-command-label">${
                    command.commandUrl
                      ? `<a href="${escapeHtml(
                          command.commandUrl,
                        )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
                          command.label,
                        )}</a>`
                      : escapeHtml(command.label)
                  }</div><div class="svs-command-sub">${escapeHtml(
                    command.commandId ? `id ${command.commandId}` : "id ?",
                  )}</div></div></div></td><td class="svs-arrival-cell">${escapeHtml(
                    command.arrivalText || "",
                  )}</td><td class="svs-timer-cell">${timerHtml}</td><td class="svs-units-cell">${unitsCell}</td><td class="svs-plan-cell svs-actions-cell"><div class="svs-plan-actions">${renderPlanButton(
                    "slice",
                  )}${renderPlanButton("intercept")}</div></td></tr>`;

                  if (!planState) {
                    return commandRowHtml;
                  }

                  const slotId = buildPlanSlotId(command.key);
                  const inlineStateHtml =
                    cleanText(planState.status) === "error"
                      ? `<div class="svs-plan-placeholder svs-plan-error">${escapeHtml(
                          cleanText(planState.error) || "Не удалось построить таблицу.",
                        )}</div>`
                      : '<div class="svs-plan-placeholder svs-plan-muted">Подключаю расчет...</div>';

                  return `${commandRowHtml}<tr class="svs-plan-row"><td colspan="5" class="svs-plan-row-cell"><div id="${escapeHtml(
                    slotId,
                  )}" class="svs-plan-slot" data-svs-plan-slot="${escapeHtml(
                    cleanText(command.key),
                  )}">${inlineStateHtml}</div></td></tr>`;
                })
                .join("")}</tbody></table></div>`
            : '<div class="svs-empty">По этой деревне видимых приказов нет.</div>';

    state.resultEl.innerHTML = `<div class="svs-village-head"><div><div class="svs-title-row"><div class="svs-card-title">${escapeHtml(
      cleanText(view.title),
    )}</div>${
      view.sigilStatus !== "idle" && cleanText(view.sigilLabel)
        ? `<span class="svs-sigil-badge svs-sigil-${escapeHtml(
            cleanText(view.sigilStatus),
          )}" title="${escapeHtml(cleanText(view.sigilTooltip))}">${escapeHtml(
            cleanText(view.sigilLabel),
          )}</span>`
        : ""
    }${
      view.mapUrl
        ? `<a class="svs-map-link" href="${escapeHtml(
            view.mapUrl,
          )}" target="_blank" rel="noopener noreferrer">Показать на карте</a>`
        : ""
    }</div>${
      cleanText(view.ownerName)
        ? `<div class="svs-card-owner">${escapeHtml(cleanText(view.ownerName))}</div>`
        : ""
    }</div><div class="svs-card-meta">${escapeHtml(commandsMeta)}</div></div><div class="svs-section-head"><div class="svs-section-title">Приказы в деревню</div>${
      view.infoUrl
        ? `<a class="svs-open-link" href="${escapeHtml(
            view.infoUrl,
          )}" target="_blank" rel="noopener noreferrer">Открыть info_village</a>`
        : ""
    }</div>${commandsHtml}`;

    refreshCountdowns();
    syncCurrentViewInlinePlans();
  };

  const loadVillages = async () => {
    if (state.villagesByCoord.size > 0) {
      return state.villagesByCoord;
    }
    if (state.villagesLoadPromise) {
      return state.villagesLoadPromise;
    }

    state.villagesLoadPromise = (async () => {
      setStatus(`Загружаю ${LOAD_ENDPOINT} ...`, "muted");
      if (state.inputEl) state.inputEl.disabled = true;

      const text = await fetchText(new URL(LOAD_ENDPOINT, window.location.origin).toString());
      const villagesByCoord = new Map();
      text.split(/\r?\n/).forEach((line) => {
        const village = parseVillageLine(line);
        if (!village) return;
        villagesByCoord.set(village.coord, village);
      });

      state.villagesByCoord = villagesByCoord;
      if (state.inputEl) {
        state.inputEl.disabled = false;
        if (state.visible) {
          state.inputEl.focus();
        }
      }
      setStatus(`Загружено деревень: ${villagesByCoord.size}`, "success");
      handleInputChange();
      return villagesByCoord;
    })()
      .catch((error) => {
        const message = cleanText(error && error.message) || "unknown error";
        setStatus(`Ошибка загрузки: ${message}`, "error");
        if (state.resultEl) {
          state.resultEl.innerHTML = `<div class="svs-empty">Не удалось загрузить <code>${escapeHtml(
            LOAD_ENDPOINT,
          )}</code>.</div>`;
        }
        throw error;
      })
      .finally(() => {
        state.villagesLoadPromise = null;
      });

    return state.villagesLoadPromise;
  };

  const markCommandResult = (view, commandIndex, patch) => {
    if (!view || !Array.isArray(view.commands) || !view.commands[commandIndex]) return;
    view.commands[commandIndex] = {
      ...view.commands[commandIndex],
      ...patch,
    };
    state.currentView = view;
    renderCurrentView();
  };

  const loadVillageCommands = async (village, token) => {
    const view = buildBaseView(village);
    state.currentView = view;
    renderCurrentView();

    const infoUrl = buildGameUrl({
      screen: "info_village",
      id: cleanText(village && village.id),
    });
    view.infoUrl = infoUrl;

    setStatus(
      `Запрашиваю info_village для ${cleanText(village && village.coord)}. Лимит: до 4 запросов в секунду.`,
      "muted",
    );

    try {
      const doc = await fetchDocument(infoUrl, { rateLimited: true });
      if (token !== state.searchToken) return;

      view.title = parseVillageTitle(doc, village);
      view.ownerName = parseVillageOwnerName(doc, village);
      view.infoStatus = "loaded";
      view.commands = parseInfoVillageCommands(doc, village);

      view.commands = view.commands.map((command) => {
        const cacheKey = cleanText(command.commandId) || cleanText(command.commandUrl);
        const cached = getCachedCommandUnits(cacheKey);
        if (!cached) return command;
        return {
          ...command,
          units: cached.units || {},
          unitsStatus: cleanText(cached.status) || "loaded",
        };
      });

      state.currentView = view;
      renderCurrentView();
      void loadVillageSigil(view, village, token).catch(() => null);

      if (!view.commands.length) {
        setStatus(
          `Деревня ${cleanText(view.coord)} загружена. Видимых приказов нет.`,
          "success",
        );
        return;
      }

      const cachedResolved = countResolvedCommands(view.commands);
      if (cachedResolved > 0) {
        setStatus(
          `Приказы загружены: ${view.commands.length}. Из кэша войск: ${cachedResolved}/${view.commands.length}.`,
          "muted",
        );
      } else {
        setStatus(
          `Приказы загружены: ${view.commands.length}. Догружаю войска с лимитом до 4 запросов в секунду.`,
          "muted",
        );
      }

      const pendingIndexes = [];
      view.commands.forEach((command, index) => {
        if (!command) return;
        if (
          ["loaded", "empty", "error", "unavailable"].includes(
            cleanText(command.unitsStatus),
          )
        ) {
          return;
        }
        const commandUrl = cleanText(command.commandUrl);
        if (!commandUrl) {
          markCommandResult(view, index, {
            unitsStatus: "unavailable",
            unitsError: "Нет ссылки на info_command",
          });
          return;
        }
        pendingIndexes.push(index);
      });

      if (!pendingIndexes.length) {
        setStatus(
          `Готово: ${view.commands.length} приказов, войска обработаны для ${countResolvedCommands(
            view.commands,
          )}/${view.commands.length}.`,
          "success",
        );
        return;
      }

      let nextPendingCursor = 0;
      let completedPending = 0;
      const totalPending = pendingIndexes.length;
      const updateUnitsProgressStatus = () => {
        if (token !== state.searchToken) return;
        setStatus(
          `Догружаю войска: ${countResolvedCommands(
            view.commands,
          )}/${view.commands.length}. Детальные запросы: ${completedPending}/${totalPending}. Лимит до 4 запросов в секунду.`,
          "muted",
        );
      };

      updateUnitsProgressStatus();

      const loadCommandDetails = async (index) => {
        const command = view.commands[index];
        if (!command) return;

        const commandUrl = cleanText(command.commandUrl);
        const cacheKey = cleanText(command.commandId) || commandUrl;
        markCommandResult(view, index, { unitsStatus: "loading" });

        try {
          const commandDoc = await fetchDocument(commandUrl, { rateLimited: true });
          if (token !== state.searchToken) return;

          const units = extractUnitsFromCommandDoc(commandDoc);
          const hasUnits = Object.values(units).some(
            (count) => Math.max(0, toInt(count) || 0) > 0,
          );

          setCachedCommandUnits(cacheKey, {
            status: hasUnits ? "loaded" : "empty",
            units,
          });

          markCommandResult(view, index, {
            units,
            unitsStatus: hasUnits ? "loaded" : "empty",
            unitsError: null,
          });
        } catch (error) {
          if (token !== state.searchToken) return;
          markCommandResult(view, index, {
            unitsStatus: "error",
            unitsError: cleanText(error && error.message) || "Ошибка info_command",
          });
        } finally {
          completedPending += 1;
          updateUnitsProgressStatus();
        }
      };

      const workerCount = Math.min(COMMAND_DETAILS_WORKERS, totalPending);
      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (token === state.searchToken) {
            const index = pendingIndexes[nextPendingCursor];
            nextPendingCursor += 1;
            if (index == null) return;
            await loadCommandDetails(index);
          }
        }),
      );

      if (token !== state.searchToken) return;
      setStatus(
        `Готово: ${view.commands.length} приказов, войска обработаны для ${countResolvedCommands(
          view.commands,
        )}/${view.commands.length}.`,
        "success",
      );
    } catch (error) {
      if (token !== state.searchToken) return;
      view.infoStatus = "error";
      state.currentView = view;
      renderCurrentView();
      setStatus(
        `Ошибка info_village: ${cleanText(error && error.message) || "unknown error"}`,
        "error",
      );
    }
  };

  const cancelPendingSearch = () => {
    if (state.searchDebounceTimerId) {
      clearTimeout(state.searchDebounceTimerId);
      state.searchDebounceTimerId = null;
    }
  };

  const handleInputChange = () => {
    if (!state.inputEl) return;
    syncInputValue();
    cancelPendingSearch();
    state.searchToken += 1;
    const token = state.searchToken;

    const value = cleanText(state.inputEl.value);
    if (!value) {
      state.currentCoordKey = null;
      state.currentView = null;
      renderIdle();
      if (state.villagesByCoord.size > 0) {
        setStatus("Введи координаты деревни.", "muted");
      }
      return;
    }

    const coord = parseCoordInput(value);
    if (!coord) {
      state.currentCoordKey = null;
      state.currentView = null;
      renderInvalid();
      if (state.villagesByCoord.size > 0) {
        setStatus("Ожидаю координаты в формате xxx|yyy.", "muted");
      }
      return;
    }

    if (!state.villagesByCoord.size) {
      renderIdle();
      setStatus(`Жду загрузку ${LOAD_ENDPOINT} ...`, "muted");
      return;
    }

    const village = state.villagesByCoord.get(coord.key);
    if (!village) {
      state.currentCoordKey = coord.key;
      state.currentView = null;
      renderNotFound(coord.key);
      setStatus(`Для ${coord.key} деревня не найдена.`, "muted");
      return;
    }

    state.currentCoordKey = coord.key;
    state.currentView = buildBaseView(village);
    renderCurrentView();
    setStatus(`Найдена ${coord.key}. Готовлю приказы...`, "muted");

    state.searchDebounceTimerId = setTimeout(() => {
      if (token !== state.searchToken) return;
      void loadVillageCommands(village, token).catch(() => null);
    }, 260);
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:18px;font-family:Trebuchet MS,Segoe UI,sans-serif}
#${ROOT_ID}[hidden]{display:none}
#${ROOT_ID} .svs-backdrop{position:absolute;inset:0;background:radial-gradient(circle at center,rgba(255,215,146,.1),transparent 26%),rgba(9,12,18,.24);backdrop-filter:blur(2px)}
#${ROOT_ID} .svs-panel{position:relative;display:flex;flex-direction:column;width:min(960px,92vw);max-height:min(84vh,760px);padding:14px 14px 12px;border:1px solid rgba(236,201,130,.5);border-radius:14px;background:linear-gradient(180deg,rgba(34,27,19,.94) 0%,rgba(21,17,12,.94) 100%);box-shadow:0 18px 60px rgba(0,0,0,.32);color:#f8ecd0;overflow:hidden}
#${ROOT_ID} .svs-top{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-bottom:8px}
#${ROOT_ID} .svs-close{width:30px;height:30px;border:1px solid rgba(236,201,130,.38);border-radius:9px;background:rgba(255,255,255,.03);color:#f8ecd0;font-size:18px;line-height:1;cursor:pointer}
#${ROOT_ID} .svs-close:hover{background:rgba(255,255,255,.09)}
#${ROOT_ID} .svs-input-wrap{position:relative}
#${ROOT_ID} .svs-input{width:100%;box-sizing:border-box;border:1px solid rgba(236,201,130,.38);border-radius:12px;padding:11px 14px;background:rgba(255,248,231,.04);color:#fff6e5;font-size:20px;line-height:1.05;font-weight:700;letter-spacing:.03em;outline:none}
#${ROOT_ID} .svs-input::placeholder{color:rgba(248,236,208,.28)}
#${ROOT_ID} .svs-input:focus{border-color:#f0c676;box-shadow:0 0 0 2px rgba(240,198,118,.12)}
#${ROOT_ID} .svs-input:disabled{opacity:.6;cursor:wait}
#${ROOT_ID} .svs-status{margin-top:6px;min-height:15px;font-size:11px;line-height:1.3}
#${ROOT_ID} .svs-status[data-svs-status="muted"]{color:#d6c5a4}
#${ROOT_ID} .svs-status[data-svs-status="success"]{color:#9ad58e}
#${ROOT_ID} .svs-status[data-svs-status="error"]{color:#ff9d91}
#${ROOT_ID} .svs-result{margin-top:10px;overflow:auto;padding-right:2px}
#${ROOT_ID} .svs-result:empty{display:none}
#${ROOT_ID} .svs-empty{padding:14px 12px;border:1px dashed rgba(236,201,130,.22);border-radius:12px;background:rgba(255,248,231,.025);font-size:13px;line-height:1.35;color:#d9ccb4;text-align:center}
#${ROOT_ID} .svs-empty code{color:#ffe2a9}
#${ROOT_ID} .svs-village-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
#${ROOT_ID} .svs-title-row{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
#${ROOT_ID} .svs-card-title{font-size:18px;font-weight:800;color:#fff1cf}
#${ROOT_ID} .svs-sigil-badge{display:inline-flex;align-items:center;padding:2px 7px;border:1px solid rgba(236,201,130,.22);border-radius:999px;background:rgba(255,248,231,.05);font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;line-height:1;color:#f5dfb4}
#${ROOT_ID} .svs-sigil-loading{color:#d9ccb4}
#${ROOT_ID} .svs-sigil-loaded{color:#9ad58e;border-color:rgba(154,213,142,.28);background:rgba(154,213,142,.08)}
#${ROOT_ID} .svs-sigil-error{color:#ffb1a6;border-color:rgba(255,157,145,.28);background:rgba(255,157,145,.08)}
#${ROOT_ID} .svs-map-link{font-size:11px;color:#ffe2a9;text-decoration:none;border-bottom:1px dotted rgba(255,226,169,.45)}
#${ROOT_ID} .svs-map-link:hover{color:#fff2d0;border-bottom-color:rgba(255,242,208,.95)}
#${ROOT_ID} .svs-card-owner{margin-top:3px;font-size:12px;font-weight:600;color:#d7c29c}
#${ROOT_ID} .svs-card-meta{font-size:11px;color:#d2bd96;white-space:nowrap}
#${ROOT_ID} .svs-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 6px}
#${ROOT_ID} .svs-section-title{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#f0c979}
#${ROOT_ID} .svs-open-link{font-size:11px;color:#ffe2a9;text-decoration:underline}
#${ROOT_ID} .svs-open-link:hover{color:#fff2d0}
#${ROOT_ID} .svs-commands-wrap{display:block;width:100%;max-width:100%;border:1px solid rgba(236,201,130,.2);border-radius:12px;overflow-x:auto;overflow-y:visible;background:rgba(255,248,231,.03);-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;overscroll-behavior:contain}
#${ROOT_ID} .svs-commands-table{width:100%;border-collapse:separate;border-spacing:0;min-width:860px}
#${ROOT_ID} .svs-commands-table th{position:sticky;top:0;padding:8px 10px;background:#f0dfbb;color:#4f320c;text-align:left;font-size:11px;letter-spacing:.05em;text-transform:uppercase;z-index:1}
#${ROOT_ID} .svs-commands-table td{padding:7px 10px;border-top:1px solid rgba(236,201,130,.14);vertical-align:top;background:rgba(255,248,231,.015);font-size:12px;color:#f8ecd0}
#${ROOT_ID} .svs-commands-table tbody tr:nth-child(even) td{background:rgba(255,248,231,.035)}
#${ROOT_ID} .svs-command-cell{min-width:300px}
#${ROOT_ID} .svs-command-main{display:flex;align-items:flex-start;gap:8px}
#${ROOT_ID} .svs-command-icons{display:inline-flex;align-items:center;gap:3px;min-width:38px;flex-wrap:wrap}
#${ROOT_ID} .svs-command-icon{width:15px;height:15px;object-fit:contain;display:block}
#${ROOT_ID} .svs-command-text{min-width:0}
#${ROOT_ID} .svs-command-label{font-size:12px;font-weight:700;line-height:1.25;color:#fff5dd;word-break:break-word}
#${ROOT_ID} .svs-command-label a{color:inherit;text-decoration:none;border-bottom:1px dotted rgba(255,245,221,.45)}
#${ROOT_ID} .svs-command-label a:hover{border-bottom-color:rgba(255,245,221,.95)}
#${ROOT_ID} .svs-command-sub{margin-top:2px;font-size:10px;color:#c9b28b}
#${ROOT_ID} .svs-arrival-cell{white-space:nowrap;min-width:160px}
#${ROOT_ID} .svs-timer-cell{white-space:nowrap;min-width:92px;font-weight:700;color:#ffe3a4}
#${ROOT_ID} .svs-units-cell{min-width:220px}
#${ROOT_ID} .svs-plan-cell{white-space:nowrap;min-width:178px;text-align:center}
#${ROOT_ID} .svs-actions-head{position:sticky;right:0;z-index:3;box-shadow:-10px 0 16px rgba(19,14,10,.08)}
#${ROOT_ID} .svs-actions-cell{position:sticky;right:0;z-index:2;box-shadow:-10px 0 16px rgba(19,14,10,.16)}
#${ROOT_ID} .svs-commands-table tbody tr:nth-child(odd) .svs-actions-cell{background:rgba(36,29,20,.96)}
#${ROOT_ID} .svs-commands-table tbody tr:nth-child(even) .svs-actions-cell{background:rgba(43,34,24,.98)}
#${ROOT_ID} .svs-plan-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px}
#${ROOT_ID} .svs-plan-btn{min-width:82px;border:1px solid rgba(236,201,130,.34);border-radius:8px;padding:4px 8px;background:rgba(255,248,231,.06);color:#fff0cf;font-size:11px;font-weight:700;cursor:pointer}
#${ROOT_ID} .svs-plan-btn:hover:not(:disabled){background:rgba(255,248,231,.11);border-color:rgba(255,226,169,.6)}
#${ROOT_ID} .svs-plan-btn.is-active{background:rgba(240,201,121,.14);border-color:rgba(240,201,121,.62);color:#ffe2a9}
#${ROOT_ID} .svs-plan-btn:disabled{opacity:.45;cursor:not-allowed}
#${ROOT_ID} .svs-plan-row td{padding:0;background:transparent !important;border-top:0}
#${ROOT_ID} .svs-plan-row-cell{padding:0 !important}
#${ROOT_ID} .svs-plan-slot{padding:0 10px 10px}
#${ROOT_ID} .svs-plan-placeholder{margin:0;padding:10px 12px;border-top:1px dashed rgba(236,201,130,.18);font-size:12px;line-height:1.35}
#${ROOT_ID} .svs-plan-muted{color:#d6c5a4}
#${ROOT_ID} .svs-plan-error{color:#ff9d91}
#${ROOT_ID} .svs-plan-slot .smm-unit-toggle{border:1px solid rgba(196,163,103,.45);border-radius:5px;background:linear-gradient(180deg,rgba(255,250,238,.96) 0%,rgba(241,228,198,.94) 100%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)}
#${ROOT_ID} .svs-plan-slot .smm-unit-toggle:hover{filter:brightness(1.08)}
#${ROOT_ID} .svs-plan-slot .smm-unit-toggle.is-disabled{opacity:1;filter:grayscale(1) saturate(0) brightness(.74);border-color:rgba(143,108,63,.7);background:linear-gradient(180deg,rgba(190,178,157,.96) 0%,rgba(149,136,115,.96) 100%)}
#${ROOT_ID} .svs-plan-slot .smm-unit-toggle.is-disabled .smm-unit-icon{opacity:.42}
#${ROOT_ID} .svs-plan-slot .smm-unit-toggle.is-disabled::after{left:0;right:0;top:50%;border-top:3px solid #a12518;box-shadow:0 0 0 1px rgba(255,243,230,.26);transform:rotate(-18deg)}
#${ROOT_ID} .svs-units-wrap{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
#${ROOT_ID} .svs-unit-chip{display:inline-flex;align-items:center;gap:3px;padding:2px 6px;border:1px solid rgba(236,201,130,.24);border-radius:999px;background:rgba(255,248,231,.06);color:#fff5dd;font-size:10px;font-weight:700;line-height:1}
#${ROOT_ID} .svs-unit-icon{width:13px;height:13px;object-fit:contain;display:block}
#${ROOT_ID} .svs-unit-fallback{font-size:10px;text-transform:uppercase}
#${ROOT_ID} .svs-unit-count{font-variant-numeric:tabular-nums}
#${ROOT_ID} .svs-units-loading{color:#ffe3a4}
#${ROOT_ID} .svs-units-empty{color:#d4c6ac}
#${ROOT_ID} .svs-units-error{color:#ff9d91}
#${ROOT_ID} .svs-hint{margin-top:8px;font-size:10px;line-height:1.3;color:#ad9a77;text-align:right}
@media (max-width: 760px){
  #${ROOT_ID}{padding:10px}
  #${ROOT_ID} .svs-panel{width:100%;max-height:94vh;padding:12px;border-radius:12px}
  #${ROOT_ID} .svs-input{padding:10px 12px;font-size:18px;border-radius:10px}
  #${ROOT_ID} .svs-village-head{display:block}
  #${ROOT_ID} .svs-title-row{gap:8px}
  #${ROOT_ID} .svs-card-meta{margin-top:6px;white-space:normal}
  #${ROOT_ID} .svs-section-head{display:block}
  #${ROOT_ID} .svs-open-link{display:inline-block;margin-top:4px}
  #${ROOT_ID} .svs-hint{text-align:left}
}
    `;
    document.head.appendChild(style);
  };

  const setVisible = (visible) => {
    state.visible = Boolean(visible);
    if (state.rootEl) {
      state.rootEl.hidden = !state.visible;
    }
    if (state.visible && state.inputEl && !state.inputEl.disabled) {
      requestAnimationFrame(() => {
        state.inputEl.focus();
        state.inputEl.select();
      });
      void autofillCoordFromClipboard();
    }
    refreshCountdowns();
  };

  const createOverlay = () => {
    ensureStyles();
    const previous = document.getElementById(ROOT_ID);
    if (previous) previous.remove();

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="svs-backdrop" data-svs-action="close"></div>
      <div class="svs-panel" role="dialog" aria-modal="true" aria-label="Village spotlight">
        <div class="svs-top">
          <button class="svs-close" type="button" data-svs-action="close" aria-label="Закрыть">×</button>
        </div>
        <div class="svs-input-wrap">
          <input class="svs-input" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="454|435" disabled />
        </div>
        <div class="svs-status" data-svs-status="muted">Введи координаты в формате 454|435.</div>
        <div class="svs-result"></div>
        <div class="svs-hint">Esc закрыть.</div>
      </div>
    `;

    state.rootEl = root;
    state.inputEl = root.querySelector(".svs-input");
    state.statusEl = root.querySelector(".svs-status");
    state.resultEl = root.querySelector(".svs-result");

    state.boundClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const planButton = target.closest("[data-svs-plan-action][data-svs-command-key]");
      if (planButton) {
        event.preventDefault();
        event.stopPropagation();
        void toggleCommandPlan(
          planButton.getAttribute("data-svs-command-key"),
          planButton.getAttribute("data-svs-plan-action"),
        );
        return;
      }
      const action = cleanText(target.getAttribute("data-svs-action"));
      if (action === "close") {
        setVisible(false);
      }
    };

    state.boundInput = () => {
      handleInputChange();
    };

    root.addEventListener("click", state.boundClick);
    state.inputEl.addEventListener("input", state.boundInput);

    document.body.appendChild(root);
    renderIdle();
    setVisible(true);
  };

  const onGlobalKeydown = (event) => {
    if (!event) return;
    const target = event.target instanceof Element ? event.target : null;
    const isEditable =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);

    if (event.key === "Escape" && state.visible) {
      event.preventDefault();
      setVisible(false);
      return;
    }

    if (!state.visible && !isEditable && /^[0-9|]$/.test(String(event.key || ""))) {
      setVisible(true);
      if (state.inputEl && !state.inputEl.disabled) {
        state.inputEl.value = String(event.key);
        handleInputChange();
      }
    }
  };

  const destroy = () => {
    cancelPendingSearch();

    if (state.rootEl && state.boundClick) {
      state.rootEl.removeEventListener("click", state.boundClick);
    }
    if (state.inputEl && state.boundInput) {
      state.inputEl.removeEventListener("input", state.boundInput);
    }
    if (state.boundKeydown) {
      document.removeEventListener("keydown", state.boundKeydown, true);
    }
    if (state.timerIntervalId) {
      clearInterval(state.timerIntervalId);
      state.timerIntervalId = null;
    }

    const root = document.getElementById(ROOT_ID);
    if (root) root.remove();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    delete window[SCRIPT_KEY];
  };

  createOverlay();
  state.boundKeydown = onGlobalKeydown;
  document.addEventListener("keydown", state.boundKeydown, true);
  state.timerIntervalId = window.setInterval(refreshCountdowns, 1000);

  void loadVillages().catch(() => null);

  window[SCRIPT_KEY] = {
    destroy,
    open: () => setVisible(true),
  };
})();

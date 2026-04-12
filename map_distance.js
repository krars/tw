(() => {
  const SCRIPT_KEY = "__scriptmmMapDistance";
  const STYLE_ID = "scriptmm-map-distance-style";
  const PANEL_ID = "scriptmm-map-distance-panel";
  const ROUTE_SVG_ID = "scriptmm-map-distance-route-svg";

  if (window[SCRIPT_KEY] && window[SCRIPT_KEY].destroy) {
    window[SCRIPT_KEY].destroy();
  }

  const isMapScreen = () => {
    const screen = String((window.game_data && window.game_data.screen) || "").toLowerCase();
    if (screen === "map") return true;
    return /(?:[?&])screen=map\b/i.test(String(location.href || ""));
  };

  if (!isMapScreen()) {
    console.warn("[ScriptMM][map-distance] screen!=map, skip init");
    return;
  }

  const REQUEST_INTERVAL_MIN_MS = 270;
  const REQUEST_INTERVAL_MAX_MS = 450;
  const SIGIL_STORAGE_KEY = "__scriptmm_map_distance_sigil";
  const PLAN_STORAGE_KEY  = "__scriptmm_map_distance_plans";
  const SIGIL_MAX_AGE_MS = 48 * 60 * 60 * 1000;
  let lastNetworkRequestAt = 0;

  const state = {
    firstPick: null,
    firstMarker: null,
    mapClickHandler: null,
    destroyed: false,
    settings: null,
    settingsPromise: null,
    villageMapPromise: null,
    villageCoordById: new Map(),
    villageIdByCoord: new Map(),   // "x|y" → id
    villageNameByCoord: new Map(), // "x|y" → name
    panelEl: null,
    mapEl: null,
    routeSvgEl: null,
    routes: new Map(),
    nextRouteId: 1,
    nextRouteZ: 10001,
    firstPointPx: null,
    pickCycle: 0,
    processingClick: false,
    rafId: null,
    totalDriftX: 0,
    totalDriftY: 0,
    firstPickPt: null,
    firstPickDriftX: 0,
    firstPickDriftY: 0,
    viewRef: null,   // { cx, cy, px, py, driftX, driftY } — калибровочная точка
    pointerState: {
      active: false,
      downX: 0,
      downY: 0,
      downAtMs: 0,
      idBefore: "",
      downCursorHint: { pointer: false, drag: false },
    },
    sigilPercent: 0,
    planRows: [],
    countdownTimerId: null,
  };

  const cleanText = (value) =>
    String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const toInt = (value) => {
    const raw = String(value == null ? "" : value).replace(/\s+/g, "").replace(/[^\d-]/g, "");
    const num = Number(raw);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
  };

  const toNumber = (value) => {
    if (value == null) return null;
    const text = cleanText(value).replace(",", ".");
    if (!text) return null;
    const num = Number(text);
    return Number.isFinite(num) ? num : null;
  };

  const clampSigilPercent = (value) => {
    const num = Math.round(toNumber(value) || 0);
    if (!Number.isFinite(num)) return 0;
    if (num < 0) return 0;
    if (num > 50) return 50;
    return num;
  };

  const loadSigilPercent = () => {
    try {
      const raw = localStorage.getItem(SIGIL_STORAGE_KEY);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      const value = clampSigilPercent(parsed && parsed.value);
      const savedAt = Number(parsed && parsed.savedAt);
      if (!Number.isFinite(savedAt) || savedAt <= 0) {
        localStorage.removeItem(SIGIL_STORAGE_KEY);
        return 0;
      }
      if (Date.now() - savedAt > SIGIL_MAX_AGE_MS) {
        localStorage.removeItem(SIGIL_STORAGE_KEY);
        return 0;
      }
      return value;
    } catch (e) {
      return 0;
    }
  };

  const saveSigilPercent = (value) => {
    try {
      localStorage.setItem(
        SIGIL_STORAGE_KEY,
        JSON.stringify({
          value: clampSigilPercent(value),
          savedAt: Date.now(),
        }),
      );
    } catch (e) {
      void e;
    }
  };

  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, toInt(ms)));
    });

  const randomInt = (min, max) => {
    const low = Math.max(0, toInt(min));
    const high = Math.max(low, toInt(max));
    return low + Math.floor(Math.random() * (high - low + 1));
  };

  const reserveNetworkSlot = async () => {
    const now = Date.now();
    const intervalMs = randomInt(REQUEST_INTERVAL_MIN_MS, REQUEST_INTERVAL_MAX_MS);
    const waitMs = intervalMs - (now - lastNetworkRequestAt);
    if (waitMs > 0) await sleep(waitMs);
    lastNetworkRequestAt = Date.now();
  };

  const resolveVillageParam = () => {
    try {
      const fromUrl = new URL(location.href, location.origin).searchParams.get("village");
      if (cleanText(fromUrl)) return cleanText(fromUrl);
    } catch (e) {
      void e;
    }
    const gdVillage = window.game_data && window.game_data.village;
    if (gdVillage && gdVillage.id != null) return String(gdVillage.id);
    return "";
  };

  const buildGameUrl = (params) => {
    const url = new URL("/game.php", location.origin);
    const village = resolveVillageParam();
    if (village) url.searchParams.set("village", village);
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  };

  const fetchText = async (url) => {
    await reserveNetworkSlot();
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
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

  const fetchXmlDocument = async (url) => {
    const text = await fetchText(url);
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const parserError = xml.querySelector("parsererror");
    if (parserError) throw new Error("XML parse error");
    return xml;
  };

  const parseCoord = (value) => {
    const text = cleanText(value);
    const m = text.match(/(\d{2,3})\s*\|\s*(\d{2,3})/);
    if (!m) return null;
    return { x: toInt(m[1]), y: toInt(m[2]), key: `${m[1]}|${m[2]}` };
  };

  const formatCoord = (coord) => {
    if (!coord || !Number.isFinite(coord.x) || !Number.isFinite(coord.y)) return "?";
    return `${coord.x}|${coord.y}`;
  };

  const readXmlText = (root, selectors) => {
    const list = String(selectors || "")
      .split(",")
      .map((x) => cleanText(x))
      .filter(Boolean);
    for (const selector of list) {
      const node = root ? root.querySelector(selector) : null;
      const value = cleanText(node ? node.textContent : "");
      if (value) return value;
    }
    return "";
  };

  const parseWorldSettings = (configXml, unitXml) => {
    const worldSpeed = toNumber(readXmlText(configXml, "config > speed, speed"));
    const unitSpeed = toNumber(readXmlText(configXml, "config > unit_speed, unit_speed"));
    const speedFactor = Number.isFinite(worldSpeed) && Number.isFinite(unitSpeed) ? worldSpeed * unitSpeed : null;

    const unitSpeedBase = {};
    Array.from(unitXml.querySelectorAll("config > *")).forEach((node) => {
      const key = cleanText(node && node.nodeName).toLowerCase();
      if (!key) return;
      const speed = toNumber(readXmlText(node, "speed"));
      if (Number.isFinite(speed) && speed > 0) unitSpeedBase[key] = speed;
    });

    const unitSpeedEffective = {};
    Object.entries(unitSpeedBase).forEach(([unit, base]) => {
      if (!Number.isFinite(base) || base <= 0) return;
      unitSpeedEffective[unit] = Number.isFinite(speedFactor) && speedFactor > 0 ? base / speedFactor : base;
    });

    return {
      worldSpeed: Number.isFinite(worldSpeed) ? worldSpeed : null,
      unitSpeed: Number.isFinite(unitSpeed) ? unitSpeed : null,
      speedFactor: Number.isFinite(speedFactor) ? speedFactor : null,
      unitSpeedBase,
      unitSpeedEffective,
    };
  };

  const loadWorldSettings = async () => {
    const configXml = await fetchXmlDocument("/interface.php?func=get_config");
    const unitXml = await fetchXmlDocument("/interface.php?func=get_unit_info");
    return parseWorldSettings(configXml, unitXml);
  };

  const ensureWorldSettings = async () => {
    if (state.settings) return state.settings;
    if (!state.settingsPromise) {
      state.settingsPromise = loadWorldSettings()
        .then((settings) => {
          state.settings = settings;
          return settings;
        })
        .finally(() => {
          state.settingsPromise = null;
        });
    }
    return state.settingsPromise;
  };

  const safeDecode = (value) => {
    const text = cleanText(value);
    if (!text) return "";
    try {
      return decodeURIComponent(text.replace(/\+/g, "%20"));
    } catch (e) {
      return text;
    }
  };

  const ingestSectorPrefetch = () => {
    const sectors = window.TWMap && Array.isArray(window.TWMap.sectorPrefech) ? window.TWMap.sectorPrefech : [];
    if (!sectors.length) return;

    sectors.forEach((sector) => {
      const baseX = toInt(sector && sector.x);
      const baseY = toInt(sector && sector.y);
      const rows = sector && sector.data && Array.isArray(sector.data.villages) ? sector.data.villages : [];
      if (!rows.length) return;

      rows.forEach((rowObj, yOffset) => {
        if (!rowObj || typeof rowObj !== "object") return;
        Object.entries(rowObj).forEach(([xOffsetRaw, villageEntry]) => {
          const xOffset = toInt(xOffsetRaw);
          let villageId = 0;
          if (Array.isArray(villageEntry)) {
            villageId = toInt(villageEntry[0]);
          } else if (villageEntry && typeof villageEntry === "object") {
            villageId = toInt(villageEntry.id || villageEntry[0]);
          }
          if (!(villageId > 0)) return;

          const x = baseX + xOffset;
          const y = baseY + yOffset;
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;

          const coordKey = `${x}|${y}`;
          state.villageCoordById.set(String(villageId), coordKey);
          state.villageIdByCoord.set(coordKey, String(villageId));
        });
      });
    });
  };

  const loadVillageMapById = async () => {
    const text = await fetchText("/map/village.txt");
    const byId = new Map();
    String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const cols = line.split(",");
        if (!Array.isArray(cols) || cols.length < 4) return;
        const id = toInt(cols[0]);
        const name = cleanText(cols[1]);
        const x = toInt(cols[2]);
        const y = toInt(cols[3]);
        if (!(id > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const coordKey = `${x}|${y}`;
        byId.set(String(id), coordKey);
        state.villageIdByCoord.set(coordKey, String(id));
        if (name) state.villageNameByCoord.set(coordKey, name);
      });
    return byId;
  };

  const ensureVillageCoord = async (villageId) => {
    const id = cleanText(villageId);
    if (!id) return null;

    ingestSectorPrefetch();
    if (state.villageCoordById.has(id)) {
      return parseCoord(state.villageCoordById.get(id));
    }

    if (!state.villageMapPromise) {
      state.villageMapPromise = loadVillageMapById().finally(() => {
        state.villageMapPromise = null;
      });
    }

    const byId = await state.villageMapPromise;
    if (byId instanceof Map) {
      byId.forEach((coord, key) => {
        state.villageCoordById.set(String(key), coord);
        state.villageIdByCoord.set(coord, String(key));
      });
    }
    if (!state.villageCoordById.has(id)) return null;
    return parseCoord(state.villageCoordById.get(id));
  };

  const getVillageIdByCoord = (coord) => {
    if (!coord) return null;
    const key = `${coord.x}|${coord.y}`;
    return state.villageIdByCoord.get(key) || null;
  };

  const getVillageNameByCoord = (coord) => {
    if (!coord) return "";
    const key = `${coord.x}|${coord.y}`;
    return state.villageNameByCoord.get(key) || formatCoord(coord);
  };

  const buildPlanLink = (fromCoord, toCoord) => {
    const fromId = getVillageIdByCoord(fromCoord);
    const toId = getVillageIdByCoord(toCoord);
    if (!fromId || !toId) return "";
    const url = `${location.origin}${location.pathname}?village=${fromId}&screen=place&mode=command&target=${toId}`;
    return { url, name: "площадь", fromId, toId };
  };

  const getSelectedVillageId = () => {
    const infoLink = document.querySelector("#mp_info");
    const candidates = [
      infoLink ? infoLink.getAttribute("href") : "",
      infoLink ? infoLink.href : "",
      document.querySelector("#mp_att")?.getAttribute("href") || "",
      document.querySelector("#mp_att")?.href || "",
    ];

    for (const urlRaw of candidates) {
      const urlText = cleanText(urlRaw);
      if (!urlText) continue;
      try {
        const url = new URL(urlText, location.origin);
        const id = cleanText(url.searchParams.get("id"));
        if (id) return id;
        const target = cleanText(url.searchParams.get("target"));
        if (target) return target;
      } catch (e) {
        const m = urlText.match(/[?&](?:id|target)=(\d+)/i);
        if (m && m[1]) return cleanText(m[1]);
      }
    }

    return "";
  };

  const extractVillageIdFromText = (value) => {
    const text = cleanText(value);
    if (!text) return "";
    const patterns = [
      /[?&](?:id|target)=(\d+)/i,
      /popupVillage\((\d+)\)/i,
      /popup\((\d+)\)/i,
      /info_village.*[?&]id=(\d+)/i,
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (m && m[1]) return cleanText(m[1]);
    }
    return "";
  };

  const isMapUiOverlayElement = (el) => {
    if (!(el instanceof Element)) return false;
    if (
      el.closest("#map_popup") ||
      el.closest("#map-ctx-buttons") ||
      el.closest(".popup_menu") ||
      el.closest("#map_config") ||
      el.closest("#edit_color_popup_menu") ||
      el.closest("#map_legend") ||
      el.closest(".map_navigation")
    ) {
      return true;
    }
    const ownId = cleanText(el.id).toLowerCase();
    if (ownId && /^mp_/.test(ownId)) return true;
    return false;
  };

  const getVillageIdFromElementsAtPoint = (clientX, clientY) => {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return "";
    const elements = Array.isArray(document.elementsFromPoint(clientX, clientY))
      ? document.elementsFromPoint(clientX, clientY)
      : [];
    for (const el of elements) {
      if (!(el instanceof Element)) continue;
      if (isMapUiOverlayElement(el)) continue;
      const candidates = [];
      if (el instanceof HTMLAnchorElement && el.href) {
        const aid = cleanText(el.id).toLowerCase();
        if (!/^mp_/.test(aid)) candidates.push(el.href);
      }
      const hrefAttr = cleanText(el.getAttribute("href"));
      if (hrefAttr && !/^#/.test(hrefAttr)) candidates.push(hrefAttr);
      const onclickAttr = cleanText(el.getAttribute("onclick"));
      if (onclickAttr) candidates.push(onclickAttr);
      const dataId = cleanText(el.getAttribute("data-id"));
      if (dataId && /^\d+$/.test(dataId)) candidates.push(`id=${dataId}`);
      const idAttr = cleanText(el.id);
      if (idAttr && !/^mp_/i.test(idAttr)) candidates.push(idAttr);

      for (const candidate of candidates) {
        const parsed = extractVillageIdFromText(candidate);
        if (parsed) return parsed;
      }
    }
    return "";
  };

  const waitForSelectedVillageId = async (excludeId = "") => {
    const excluded = cleanText(excludeId);
    let lastSeen = "";
    for (let i = 0; i < 16; i += 1) {
      const id = getSelectedVillageId();
      if (id) {
        lastSeen = id;
        if (!excluded || id !== excluded) return id;
      }
      await sleep(40);
    }
    return excluded ? "" : lastSeen;
  };

  const formatDuration = (ms) => {
    const totalSec = Math.max(0, Math.round((toNumber(ms) || 0) / 1000));
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return days > 0 ? `${days}д ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
  };

  const formatDistance = (distance) => {
    const num = toNumber(distance);
    if (!Number.isFinite(num)) return "-";
    return num.toFixed(2);
  };

  const getUnitOrder = (settings) => {
    const rawUnits = Array.isArray(window.game_data && window.game_data.units)
      ? window.game_data.units.map((u) => cleanText(u).toLowerCase()).filter(Boolean)
      : [];
    const fallback = ["spear", "sword", "axe", "spy", "light", "heavy", "ram", "catapult", "knight", "snob"];
    const source = rawUnits.length ? rawUnits : fallback;
    return source.filter((unit) => Number.isFinite(toNumber(settings?.unitSpeedEffective?.[unit])));
  };

  const UNIT_LABELS = {
    spear: "Копейщик",
    sword: "Мечник",
    axe: "Топорщик",
    archer: "Лучник",
    spy: "Разведчик",
    light: "ЛК",
    marcher: "КЛ",
    heavy: "ТК",
    ram: "Таран",
    catapult: "Катапульта",
    knight: "Паладин",
    snob: "Дворянин",
  };
  const EXCLUDED_UNITS = new Set(["militia"]);

  const getImageBase = () => {
    const base = cleanText(window.image_base || "");
    if (!base) return "/graphic/";
    return base.endsWith("/") ? base : `${base}/`;
  };

  const getUnitIconUrls = (unit) => {
    const safeUnit = cleanText(unit).toLowerCase();
    const base = getImageBase();
    return {
      webp: `${base}unit/unit_${safeUnit}.webp`,
      png: `${base}unit/unit_${safeUnit}.png`,
    };
  };

  const computeDistance = (fromCoord, toCoord) => {
    if (!fromCoord || !toCoord) return null;
    const dx = Math.abs((toNumber(toCoord.x) || 0) - (toNumber(fromCoord.x) || 0));
    const dy = Math.abs((toNumber(toCoord.y) || 0) - (toNumber(fromCoord.y) || 0));
    return Math.sqrt(dx * dx + dy * dy);
  };

  const computeTravelRows = (settings, distance, sigilPercent) => {
    const sigil = clampSigilPercent(sigilPercent);
    const sigilMultiplier = Math.max(0, 1 - sigil / 100);
    const order = getUnitOrder(settings);
    const rows = [];
    order.forEach((unit) => {
      if (EXCLUDED_UNITS.has(unit)) return;
      const minutesPerField = toNumber(settings && settings.unitSpeedEffective && settings.unitSpeedEffective[unit]);
      if (!Number.isFinite(minutesPerField) || minutesPerField <= 0) return;
      const adjustedMinutesPerField = minutesPerField * sigilMultiplier;
      const ms = (toNumber(distance) || 0) * adjustedMinutesPerField * 60 * 1000;
      rows.push({
        unit,
        label: UNIT_LABELS[unit] || unit,
        icon: getUnitIconUrls(unit),
        minutesPerField: adjustedMinutesPerField,
        travelMs: ms,
        travelText: formatDuration(ms),
      });
    });
    return rows;
  };

  // ─── Следование стрелки за картой ─────────────────────────────────────────
  //
  // TW при прокрутке карты двигает два DOM-элемента — линейки координат:
  //   #map_coord_x  (ширина 53000px)  — style.left  меняется при горизонтальном скролле
  //   #map_coord_y  (высота 38000px)  — style.top   меняется при вертикальном скролле
  //
  // Эти элементы движутся 1:1 с тайлами карты и являются надёжным источником дрейфа.
  // В RAF-цикле читаем parseInt(el.style.left/top) и сравниваем с baseline на старте.
  // Дрейф всегда считается относительно момента создания каждого объекта (маршрут /
  // первый маркер), чтобы не накапливались смещения при старте скрипта.

  const updateAllMapOverlays = () => {
    // Первый маркер: дрейф относительно момента первого клика
    if (state.firstPickPt && state.firstMarker && state.firstMarker.isConnected) {
      const dx = state.totalDriftX - state.firstPickDriftX;
      const dy = state.totalDriftY - state.firstPickDriftY;
      state.firstMarker.style.left = `${state.firstPickPt.x + dx}px`;
      state.firstMarker.style.top  = `${state.firstPickPt.y + dy}px`;
    }
    state.routes.forEach((route) => {
      if (!route.fromPt || !route.toPt) return;
      // Дрейф относительно момента создания маршрута
      const cdx = route.driftAtCreation ? route.driftAtCreation.x : 0;
      const cdy = route.driftAtCreation ? route.driftAtCreation.y : 0;
      const dx = state.totalDriftX - cdx;
      const dy = state.totalDriftY - cdy;
      if (route.lineEl) {
        route.lineEl.setAttribute("x1", String(Math.round(route.fromPt.x + dx)));
        route.lineEl.setAttribute("y1", String(Math.round(route.fromPt.y + dy)));
        route.lineEl.setAttribute("x2", String(Math.round(route.toPt.x  + dx)));
        route.lineEl.setAttribute("y2", String(Math.round(route.toPt.y  + dy)));
      }
      if (route.resultEl && route.resultEl.isConnected) {
        const mapRect = state.mapEl.getBoundingClientRect();
        const mapW = mapRect.width || 795;
        const mapH = mapRect.height || 570;
        const w = route.resultEl.offsetWidth || 340;
        const h = route.resultEl.offsetHeight || 180;
        const margin = 6;
        route.resultEl.style.left = `${Math.max(margin, Math.min(mapW - w - margin, route.creationLeft + dx))}px`;
        route.resultEl.style.top  = `${Math.max(margin, Math.min(mapH - h - margin, route.creationTop  + dy))}px`;
      }
    });
  };

  const startViewportWatcher = () => {
    // Линейки координат TW: их inline style.left/top двигаются 1:1 с картой
    const coordX = document.getElementById("map_coord_x");
    const coordY = document.getElementById("map_coord_y");
    if (!coordX || !coordY) {
      console.warn("[ScriptMM][map-distance] #map_coord_x / #map_coord_y не найдены — drift tracking отключён");
      return;
    }

    const baseLeft = parseInt(coordX.style.left || "0", 10) || 0;
    const baseTop  = parseInt(coordY.style.top  || "0", 10) || 0;

    const tick = () => {
      if (state.destroyed) return;
      const curLeft = parseInt(coordX.style.left || "0", 10) || 0;
      const curTop  = parseInt(coordY.style.top  || "0", 10) || 0;
      const newDriftX = curLeft - baseLeft;
      const newDriftY = curTop  - baseTop;
      if (newDriftX !== state.totalDriftX || newDriftY !== state.totalDriftY) {
        state.totalDriftX = newDriftX;
        state.totalDriftY = newDriftY;
        updateAllMapOverlays();
      }
      state.rafId = requestAnimationFrame(tick);
    };
    state.rafId = requestAnimationFrame(tick);
  };

  const stopViewportWatcher = () => {
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId);
      state.rafId = null;
    }
  };

  const onMapMouseMove = (_event) => {};

  const getPointInMap = (event) => {
    if (!(event instanceof MouseEvent) || !state.mapEl) return null;
    const rect = state.mapEl.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0)) return null;
    return {
      x: Math.max(0, Math.min(rect.width, event.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, event.clientY - rect.top)),
      width: rect.width,
      height: rect.height,
    };
  };

  const isOverlayUiTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest(`#${PANEL_ID}`) ||
        target.closest(".smm-mapdist-route-result"),
    );
  };

  const isInteractiveInOverlay = (target) => {
    if (!(target instanceof Element)) return false;
    return target.closest("input, select, textarea, button, a[href]") !== null;
  };

  const getCursorHintAtPoint = (clientX, clientY) => {
    const hint = { pointer: false, drag: false };
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return hint;
    let el = document.elementFromPoint(clientX, clientY);
    while (el && el instanceof Element) {
      const cursor = String(getComputedStyle(el).cursor || "").toLowerCase();
      if (cursor.includes("pointer")) hint.pointer = true;
      if (
        cursor.includes("grab") ||
        cursor.includes("grabbing") ||
        cursor.includes("move") ||
        cursor.includes("all-scroll")
      ) {
        hint.drag = true;
      }
      if (el === state.mapEl) break;
      el = el.parentElement;
    }
    return hint;
  };

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID} {
        position: fixed;
        top: 90px;
        right: 18px;
        z-index: 120000;
        min-width: 320px;
        width: max-content;
        max-width: calc(100vw - 36px);
        background: #f3ead5;
        border: 1px solid #b08b4f;
        border-radius: 10px;
        box-shadow: 0 8px 22px rgba(0,0,0,.22);
        color: #3a2a16;
        font: 12px/1.35 Verdana, Arial, sans-serif;
        user-select: none;
      }
      #${PANEL_ID} .smm-mapdist-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        background: #5a340c;
        color: #fff7e8;
        border-radius: 10px 10px 0 0;
        font-weight: 700;
        cursor: move;
      }
      #${PANEL_ID} .smm-mapdist-body {
        padding: 8px 10px;
      }
      #${PANEL_ID} .smm-mapdist-row { margin: 3px 0; }
      #${PANEL_ID} .smm-mapdist-status { color: #5a340c; font-weight: 700; }
      #${PANEL_ID} .smm-mapdist-coord { color: #15457b; font-weight: 700; }
      #${PANEL_ID} .smm-mapdist-btn {
        border: 1px solid #a37a43;
        background: #f2e2c5;
        border-radius: 8px;
        padding: 2px 7px;
        cursor: pointer;
        font: inherit;
        color: #4a3518;
      }
      #${PANEL_ID} .smm-mapdist-btn:hover { background: #eed7b0; }

      .smm-mapdist-pick-marker {
        position: absolute;
        width: 24px;
        height: 24px;
        margin-left: -12px;
        margin-top: -12px;
        border: 3px solid #b08b4f;
        border-radius: 50%;
        box-shadow: 0 0 0 3px rgba(255,255,255,.92), 0 0 16px rgba(176,139,79,.7);
        pointer-events: none;
        z-index: 9999;
        animation: smmMapDistPulse 1.2s ease-in-out infinite;
      }
      @keyframes smmMapDistPulse {
        0% { transform: scale(0.9); opacity: .85; }
        50% { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(0.9); opacity: .85; }
      }

      #${ROUTE_SVG_ID} {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9998;
      }
      .smm-mapdist-route-result {
        position: absolute;
        z-index: 10001;
        pointer-events: auto;
        min-width: 300px;
        max-width: 420px;
        max-height: 280px;
        overflow: auto;
        background: rgba(243,234,213,.74);
        backdrop-filter: blur(1.5px);
        border: 1px solid #b08b4f;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,.25);
        color: #3a2a16;
        font: 12px/1.35 Verdana, Arial, sans-serif;
      }
      .smm-mapdist-route-result .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 8px;
        background: rgba(107,76,35,.84);
        color: #fff3dd;
        border-radius: 10px 10px 0 0;
        font-weight: 700;
      }
      .smm-mapdist-route-result .body { padding: 8px; }
      .smm-mapdist-route-result .smm-mapdist-kv { margin: 0 0 8px; }
      .smm-mapdist-route-result .smm-mapdist-inline { display: inline-flex; align-items: center; gap: 6px; }
      .smm-mapdist-route-result .smm-mapdist-input {
        width: 72px;
        border: 1px solid #b28a52;
        border-radius: 6px;
        padding: 2px 6px;
        font: inherit;
        color: #3a2a16;
        background: rgba(255,253,250,.94);
      }
      .smm-mapdist-route-result .smm-mapdist-input[type="range"] {
        width: 120px !important;
        cursor: pointer;
        pointer-events: auto !important;
      }
      .smm-mapdist-route-result table { width: 100%; border-collapse: collapse; }
      .smm-mapdist-route-result th,
      .smm-mapdist-route-result td {
        border: 1px solid #ccb488;
        padding: 3px 5px;
        text-align: left;
        background: #e3d5b3 !important;
      }
      .smm-mapdist-route-result td.smm-mapdist-unit-cell {
        text-align: center;
        width: 44px;
      }
      .smm-mapdist-route-result td.smm-mapdist-plan-cell {
        text-align: center;
        width: 78px;
      }
      .smm-mapdist-route-result .smm-mapdist-unit-icon {
        width: 18px;
        height: 18px;
        vertical-align: middle;
        image-rendering: auto;
      }
      .smm-mapdist-route-result .smm-mapdist-btn-mini {
        border: 1px solid #a37a43;
        background: #f2e2c5;
        border-radius: 6px;
        padding: 1px 6px;
        cursor: pointer;
        font: 11px/1.2 Verdana, Arial, sans-serif;
        color: #4a3518;
      }
      .smm-mapdist-route-result .smm-mapdist-btn-mini:hover { background: #eed7b0; }
      .smm-mapdist-route-result th { background: #c4a35f; color: #2f2010; }
      .smm-mapdist-route-result tr:nth-child(even) td { background: #dcc79c !important; }

      /* ── Collapse ── */
      .smm-mapdist-route-result.smm-collapsed .body { display: none; }
      .smm-mapdist-route-result.smm-collapsed { border-radius: 10px; max-height: none; overflow: visible; }
      .smm-mapdist-btn-collapse {
        background: none;
        border: none;
        color: #fff3dd;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0 2px;
        opacity: 0.85;
      }
      .smm-mapdist-btn-collapse:hover { opacity: 1; }

      /* ── Plan block ── */
      #${PANEL_ID} .smm-mapdist-plan-block {
        margin-top: 8px;
        border-top: 1px solid #c4a35f;
        padding-top: 6px;
      }
      #${PANEL_ID} .smm-mapdist-plan-title {
        font-weight: 700;
        color: #4a3518;
        margin-bottom: 4px;
      }
      #${PANEL_ID} .smm-mapdist-plan-table-wrap {
        max-height: 200px;
        overflow-y: auto;
      }
      #${PANEL_ID} .smm-mapdist-plan-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        white-space: nowrap;
        table-layout: auto;
      }
      #${PANEL_ID} .smm-mapdist-plan-table th {
        background: #c4a35f;
        color: #2f2010;
        border: 1px solid #ccb488;
        padding: 2px 4px;
        white-space: nowrap;
      }
      #${PANEL_ID} .smm-mapdist-plan-table td {
        border: 1px solid #ccb488;
        padding: 1px 3px;
        background: #e3d5b3;
      }
      #${PANEL_ID} .smm-mapdist-plan-table tr:nth-child(even) td { background: #dcc79c; }
      #${PANEL_ID} .smm-mapdist-plan-table input[type="time"],
      #${PANEL_ID} .smm-mapdist-plan-table input[type="date"] {
        font: 11px/1.2 Verdana, Arial, sans-serif;
        border: 1px solid #b28a52;
        border-radius: 4px;
        padding: 1px 2px;
        background: #fffaf4;
        color: #3a2a16;
        width: 84px;
      }
      #${PANEL_ID} .smm-mapdist-plan-table input[type="text"] {
        font: 11px/1.2 Verdana, Arial, sans-serif;
        border: 1px solid #b28a52;
        border-radius: 4px;
        padding: 1px 4px;
        background: #fffaf4;
        color: #3a2a16;
        width: 110px;
      }
      #${PANEL_ID} .smm-mapdist-plan-actions {
        margin-top: 5px;
        display: flex;
        gap: 6px;
      }
    `;
    document.head.appendChild(style);
  };

  const setPanelStatus = (text, pickedCoord) => {
    const panel = state.panelEl;
    if (!panel) return;
    const statusEl = panel.querySelector("[data-smm-role='status']");
    if (statusEl) statusEl.textContent = cleanText(text) || "";
    const pickedEl = panel.querySelector("[data-smm-role='picked']");
    if (pickedEl) {
      pickedEl.textContent = pickedCoord ? `1-я деревня: ${formatCoord(pickedCoord)}` : "1-я деревня: —";
    }
  };

  const ensurePanel = () => {
    if (state.panelEl && state.panelEl.isConnected) return state.panelEl;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="smm-mapdist-head">
        <span>Map Distance</span>
        <div>
          <button type="button" class="smm-mapdist-btn" data-smm-action="reset">Сброс</button>
          <button type="button" class="smm-mapdist-btn" data-smm-action="close">×</button>
        </div>
      </div>
      <div class="smm-mapdist-body">
        <div class="smm-mapdist-row smm-mapdist-status" data-smm-role="status"></div>
        <div class="smm-mapdist-row smm-mapdist-coord" data-smm-role="picked"></div>
        <div class="smm-mapdist-row" style="color:#6e5633;">Кликни 1-ю деревню, затем 2-ю.</div>
        <div class="smm-mapdist-plan-block">
          <div class="smm-mapdist-plan-title">📋 Манёвр</div>
          <div class="smm-mapdist-plan-table-wrap">
            <table class="smm-mapdist-plan-table">
              <thead>
                <tr>
                  <th>Кора старта</th>
                  <th>Время манёвра</th>
                  <th>Юнит</th>
                  <th>Дата прихода</th>
                  <th>Время прихода</th>
                  <th>Время выхода</th>
                  <th>До выхода</th>
                  <th>Целевая кора</th>
                  <th>Ссылка</th>
                  <th>Комментарий</th>
                  <th></th>
                </tr>
              </thead>
              <tbody data-smm-role="plan-rows"></tbody>
            </table>
          </div>
          <div class="smm-mapdist-plan-actions">
            <button type="button" class="smm-mapdist-btn" data-smm-action="plan-save">Сохранить</button>
            <button type="button" class="smm-mapdist-btn" data-smm-action="plan-open">Открыть</button>
            <button type="button" class="smm-mapdist-btn" data-smm-action="plan-clipboard">Блокнот</button>
          </div>
        </div>
      </div>
    `;

    panel.addEventListener("click", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-smm-action]") : null;
      if (!target) return;
      const action = cleanText(target.getAttribute("data-smm-action"));
      if (action === "reset") {
        resetSelection();
        setPanelStatus("Выбор сброшен.", null);
      }
      if (action === "close") {
        destroy();
      }
      if (action === "plan-save") {
        showSaveDialog();
        return;
      }
      if (action === "plan-open") {
        showOpenDialog();
        return;
      }
      if (action === "plan-clipboard") {
        copyPlanToClipboard();
        return;
      }
      if (action === "plan-row-delete") {
        const idx = parseInt(cleanText(target.getAttribute("data-smm-plan-idx")), 10);
        if (idx >= 0 && idx < state.planRows.length) {
          state.planRows.splice(idx, 1);
          renderPlanTable();
        }
        return;
      }
    });

    panel.addEventListener("input", (event) => {
      const target = event.target instanceof Element ? event.target.closest("[data-smm-plan-field]") : null;
      if (!target) return;
      const idx = parseInt(cleanText(target.getAttribute("data-smm-plan-idx")), 10);
      const field = cleanText(target.getAttribute("data-smm-plan-field"));
      if (!Number.isFinite(idx) || idx < 0 || idx >= state.planRows.length) return;
      const row = state.planRows[idx];
      const val = target.value;
      if (field === "arrivalTime") {
        row.arrivalTime = val;
        row.startTime = computeStartTime(val, row.travelMs);
        const paired = panel.querySelector(`[data-smm-plan-field="startTime"][data-smm-plan-idx="${idx}"]`);
        if (paired) paired.value = row.startTime;
        // Обновляем countdown: меняем время старта и дату
        const target = event.target;
        if (target instanceof Element) {
          const tr = target.closest("tr");
          const cd = tr ? tr.querySelector(".smm-mapdist-countdown") : null;
          if (cd) {
            cd.setAttribute("data-smm-plan-start", row.startTime);
            const dateInput = panel.querySelector(`[data-smm-plan-field="arrivalDate"][data-smm-plan-idx="${idx}"]`);
            if (dateInput) cd.setAttribute("data-smm-plan-date", cleanText(dateInput.value));
          }
        }
        updateCountdowns();
      } else if (field === "startTime") {
        row.startTime = val;
        row.arrivalTime = computeArrivalTime(val, row.travelMs);
        const paired = panel.querySelector(`[data-smm-plan-field="arrivalTime"][data-smm-plan-idx="${idx}"]`);
        if (paired) paired.value = row.arrivalTime;
        // Обновляем countdown
        const target = event.target;
        if (target instanceof Element) {
          const tr = target.closest("tr");
          const cd = tr ? tr.querySelector(".smm-mapdist-countdown") : null;
          if (cd) {
            cd.setAttribute("data-smm-plan-start", row.startTime);
            const dateInput = panel.querySelector(`[data-smm-plan-field="arrivalDate"][data-smm-plan-idx="${idx}"]`);
            if (dateInput) cd.setAttribute("data-smm-plan-date", cleanText(dateInput.value));
          }
        }
        updateCountdowns();
      } else if (field === "arrivalDate") {
        row.arrivalDate = val;
        // Обновляем атрибут countdown-ячейки в той же строке
        const target = event.target;
        if (target instanceof Element) {
          const tr = target.closest("tr");
          const cd = tr ? tr.querySelector(".smm-mapdist-countdown") : null;
          if (cd) {
            cd.setAttribute("data-smm-plan-date", cleanText(val));
          }
        }
        updateCountdowns();
      } else if (field === "comment") {
        row.comment = val;
      }
    });

    // ── Drag-and-drop панели за шапку ──────────────────────────────────────
    const head = panel.querySelector(".smm-mapdist-head");
    if (head) {
      let dragActive = false;
      let dragStartX = 0, dragStartY = 0;
      let panelStartLeft = 0, panelStartTop = 0;

      const onDragMove = (e) => {
        if (!dragActive) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const newLeft = panelStartLeft + (clientX - dragStartX);
        const newTop  = panelStartTop  + (clientY - dragStartY);
        const maxLeft = window.innerWidth  - panel.offsetWidth;
        const maxTop  = window.innerHeight - panel.offsetHeight;
        panel.style.right  = "auto";
        panel.style.left   = `${Math.max(0, Math.min(maxLeft, newLeft))}px`;
        panel.style.top    = `${Math.max(0, Math.min(maxTop,  newTop))}px`;
      };

      const onDragEnd = () => {
        dragActive = false;
        document.removeEventListener("mousemove", onDragMove);
        document.removeEventListener("mouseup",   onDragEnd);
        document.removeEventListener("touchmove", onDragMove);
        document.removeEventListener("touchend",  onDragEnd);
      };

      head.addEventListener("mousedown", (e) => {
        // Не перетаскиваем если кликнули на кнопку
        if (e.target instanceof Element && e.target.closest("button")) return;
        e.preventDefault();
        dragActive  = true;
        dragStartX  = e.clientX;
        dragStartY  = e.clientY;
        const rect  = panel.getBoundingClientRect();
        panelStartLeft = rect.left;
        panelStartTop  = rect.top;
        document.addEventListener("mousemove", onDragMove);
        document.addEventListener("mouseup",   onDragEnd);
      });

      head.addEventListener("touchstart", (e) => {
        if (e.target instanceof Element && e.target.closest("button")) return;
        dragActive  = true;
        dragStartX  = e.touches[0].clientX;
        dragStartY  = e.touches[0].clientY;
        const rect  = panel.getBoundingClientRect();
        panelStartLeft = rect.left;
        panelStartTop  = rect.top;
        document.addEventListener("touchmove", onDragMove, { passive: true });
        document.addEventListener("touchend",  onDragEnd);
      }, { passive: true });
    }

    document.body.appendChild(panel);
    state.panelEl = panel;
    setPanelStatus("Ожидаю выбор 1-й деревни.", null);
    return panel;
  };

  const ensureRouteSvg = () => {
    if (!state.mapEl) return null;
    if (state.routeSvgEl && state.routeSvgEl.isConnected) return state.routeSvgEl;
    const svgNs = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("id", ROUTE_SVG_ID);
    const defs = document.createElementNS(svgNs, "defs");
    const marker = document.createElementNS(svgNs, "marker");
    marker.setAttribute("id", "smmMapDistArrowHead");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "8");
    marker.setAttribute("refX", "7");
    marker.setAttribute("refY", "4");
    marker.setAttribute("orient", "auto");
    const arrowPath = document.createElementNS(svgNs, "path");
    arrowPath.setAttribute("d", "M0,0 L8,4 L0,8 Z");
    arrowPath.setAttribute("fill", "#e03030");
    marker.appendChild(arrowPath);
    defs.appendChild(marker);
    svg.appendChild(defs);

    state.mapEl.appendChild(svg);
    state.routeSvgEl = svg;
    return svg;
  };

  const createRouteLine = (fromPoint, toPoint) => {
    const svg = ensureRouteSvg();
    if (!svg || !fromPoint || !toPoint) return null;
    const svgNs = "http://www.w3.org/2000/svg";
    const line = document.createElementNS(svgNs, "line");
    line.setAttribute("stroke", "#e03030");
    line.setAttribute("stroke-width", "3");
    line.setAttribute("marker-end", "url(#smmMapDistArrowHead)");
    line.setAttribute("opacity", "0.95");
    line.setAttribute("x1", String(Math.round(fromPoint.x)));
    line.setAttribute("y1", String(Math.round(fromPoint.y)));
    line.setAttribute("x2", String(Math.round(toPoint.x)));
    line.setAttribute("y2", String(Math.round(toPoint.y)));
    svg.appendChild(line);
    return line;
  };

  const removeRouteLineElement = (lineEl) => {
    if (lineEl && lineEl.isConnected) lineEl.remove();
  };

  const removeRouteById = (routeId) => {
    const key = cleanText(routeId);
    if (!key) return;
    const route = state.routes.get(key);
    if (!route) return;
    if (route.resultEl && route.resultEl.isConnected) route.resultEl.remove();
    removeRouteLineElement(route.lineEl);
    state.routes.delete(key);
  };

  const bringRouteToFront = (routeId) => {
    const key = cleanText(routeId);
    if (!key) return;
    const route = state.routes.get(key);
    if (!route || !route.resultEl || !route.resultEl.isConnected) return;
    state.nextRouteZ += 1;
    route.resultEl.style.zIndex = String(state.nextRouteZ);
  };

  const rerenderAllRouteTables = () => {
    state.routes.forEach((route) => {
      if (typeof route.renderRows === "function") route.renderRows();
      if (route.sigilInput && route.sigilInput.isConnected) {
        const val = clampSigilPercent(state.sigilPercent);
        route.sigilInput.value = String(val);
        const sigilValue = route.resultEl ? route.resultEl.querySelector("[data-smm-role='sigil-value']") : null;
        if (sigilValue) sigilValue.textContent = `${val}%`;
      }
    });
  };

  const createRouteResultNearSecondVillage = ({
    fromCoord,
    toCoord,
    distance,
    settings,
    fromPoint,
    toPoint,
  }) => {
    if (!state.mapEl || !toPoint) return;
    const routeId = `route_${Date.now()}_${state.nextRouteId++}`;
    const lineEl = createRouteLine(fromPoint, toPoint);

    const result = document.createElement("div");
    result.className = "smm-mapdist-route-result";
    result.setAttribute("data-smm-route-id", routeId);
    state.nextRouteZ += 1;
    result.style.zIndex = String(state.nextRouteZ);
    result.innerHTML = `
      <div class="head">
        <span>${formatCoord(fromCoord)} → ${formatCoord(toCoord)}</span>
        <button type="button" class="smm-mapdist-btn-collapse" data-smm-action="collapse-route" data-smm-route-id="${routeId}" title="Свернуть/развернуть">▼</button>
        <button type="button" class="smm-mapdist-btn" data-smm-action="close-route" data-smm-route-id="${routeId}">×</button>
      </div>
      <div class="body">
        <div class="smm-mapdist-kv"><b>Дистанция:</b> ${formatDistance(distance)}</div>
        <div class="smm-mapdist-kv">
          <label class="smm-mapdist-inline">
            <b>Сигил:</b>
            <input
              class="smm-mapdist-input"
              data-smm-role="sigil-input"
              type="range"
              min="0"
              max="50"
              step="1"
              value="${clampSigilPercent(state.sigilPercent) > 50 ? 50 : clampSigilPercent(state.sigilPercent)}"
              style="width:120px;cursor:pointer;"
            />
            <span data-smm-role="sigil-value" style="min-width:28px;text-align:right;font-weight:700;">${clampSigilPercent(state.sigilPercent) > 50 ? 50 : clampSigilPercent(state.sigilPercent)}%</span>
          </label>
        </div>
        <table>
          <thead>
            <tr>
              <th>Юнит</th>
              <th>Время</th>
              <th>План</th>
            </tr>
          </thead>
          <tbody data-smm-role="travel-rows"></tbody>
        </table>
      </div>
    `;

    const renderRows = () => {
      const tbody = result.querySelector("[data-smm-role='travel-rows']");
      if (!tbody) return;
      const rows = computeTravelRows(settings, distance, state.sigilPercent);
      tbody.innerHTML =
        rows
          .map(
            (row) => `
          <tr>
            <td class="smm-mapdist-unit-cell">
              <img
                class="smm-mapdist-unit-icon"
                src="${row.icon.webp}"
                data-smm-fallback="${row.icon.png}"
                alt="${row.label}"
                title="${row.label}"
              />
            </td>
            <td>${row.travelText}</td>
            <td class="smm-mapdist-plan-cell">
              <button type="button" class="smm-mapdist-btn-mini" data-smm-action="plan-add" data-smm-route-id="${routeId}" data-smm-unit="${row.unit}">
                Добавить
              </button>
            </td>
          </tr>
        `,
          )
          .join("") || '<tr><td colspan="3">Нет данных</td></tr>';
      tbody.querySelectorAll("img[data-smm-fallback]").forEach((img) => {
        if (!(img instanceof HTMLImageElement)) return;
        img.addEventListener(
          "error",
          () => {
            const fallback = cleanText(img.getAttribute("data-smm-fallback"));
            if (fallback && img.src !== fallback) {
              img.src = fallback;
            }
          },
          { once: true },
        );
      });
    };

    const sigilInput = result.querySelector("[data-smm-role='sigil-input']");
    const sigilValue = result.querySelector("[data-smm-role='sigil-value']");
    if (sigilInput instanceof HTMLInputElement) {
      const applySigil = () => {
        const normalized = clampSigilPercent(sigilInput.value);
        state.sigilPercent = normalized;
        saveSigilPercent(normalized);
        rerenderAllRouteTables();
        if (sigilValue) sigilValue.textContent = `${normalized}%`;
      };
      sigilInput.addEventListener("input", applySigil);
      sigilInput.addEventListener("change", applySigil);
    }

    result.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target instanceof Element ? event.target.closest("[data-smm-action]") : null;
      if (target) {
        event.preventDefault();
        const action = cleanText(target.getAttribute("data-smm-action"));
        if (action === "close-route") {
          const id = cleanText(target.getAttribute("data-smm-route-id"));
          removeRouteById(id || routeId);
          return;
        }
        if (action === "collapse-route") {
          result.classList.toggle("smm-collapsed");
          target.textContent = result.classList.contains("smm-collapsed") ? "▶" : "▼";
          return;
        }
        if (action === "plan-add") {
          const unit = cleanText(target.getAttribute("data-smm-unit"));
          const rows = computeTravelRows(settings, distance, state.sigilPercent);
          const row = rows.find((r) => r.unit === unit);
          if (!row) return;
          showTimePicker().then((resultData) => {
            if (!resultData || !resultData.arrivalTime) return;
            // Сворачиваем окно маршрута сразу после нажатия OK
            result.classList.add("smm-collapsed");
            const collapseBtn = result.querySelector(".smm-mapdist-btn-collapse");
            if (collapseBtn) collapseBtn.textContent = "▶";

            const { arrivalTime, arrivalDate } = resultData;
            const startTime = computeStartTime(arrivalTime, row.travelMs);
            state.planRows.push({
              fromCoord,
              toCoord,
              unit: row.unit,
              unitLabel: row.label,
              startTime,
              travelMs: row.travelMs,
              travelText: row.travelText,
              arrivalTime,
              arrivalDate: arrivalDate || getServerDate(),
              comment: "",
            });
            renderPlanTable();
          });
          return;
        }
      }
    });

    result.addEventListener(
      "mousedown",
      (event) => {
        // Для интерактивных элементов — полностью пропускаем, не трогаем
        if (isInteractiveInOverlay(event.target)) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        bringRouteToFront(routeId);
      },
      true,
    );
    result.addEventListener(
      "mouseup",
      (event) => {
        if (isInteractiveInOverlay(event.target)) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
      },
      true,
    );
    result.addEventListener("dblclick", (event) => {
      event.stopPropagation();
      event.preventDefault();
    });

    state.mapEl.appendChild(result);

    // Позиционируем окно над/рядом со 2-й деревней без перекрытия самой точки.
    const rect = state.mapEl.getBoundingClientRect();
    const mapW = rect.width || 795;
    const mapH = rect.height || 570;
    const w = result.offsetWidth || 340;
    const h = result.offsetHeight || 180;
    const stackIndex = state.routes.size % 5;
    const margin = 6;
    const gap = 18;
    const shiftX = stackIndex * 12;
    const shiftY = stackIndex * 8;

    const candidates = [
      // Предпочтительно: выше деревни, справа/слева от стрелки.
      { left: toPoint.x + gap + shiftX, top: toPoint.y - h - gap - shiftY },
      { left: toPoint.x - w - gap - shiftX, top: toPoint.y - h - gap - shiftY },
      // Fallback: ниже деревни, если сверху нет места.
      { left: toPoint.x + gap + shiftX, top: toPoint.y + gap + shiftY },
      { left: toPoint.x - w - gap - shiftX, top: toPoint.y + gap + shiftY },
      // Последний fallback: центр над деревней.
      { left: toPoint.x - w / 2 + shiftX, top: toPoint.y - h - gap - shiftY },
    ];

    const fits = (p) =>
      p.left >= margin &&
      p.top >= margin &&
      p.left + w <= mapW - margin &&
      p.top + h <= mapH - margin;

    const overflowScore = (p) => {
      const overLeft = Math.max(0, margin - p.left);
      const overTop = Math.max(0, margin - p.top);
      const overRight = Math.max(0, p.left + w - (mapW - margin));
      const overBottom = Math.max(0, p.top + h - (mapH - margin));
      return overLeft + overTop + overRight + overBottom;
    };

    let chosen = candidates.find(fits);
    if (!chosen) {
      chosen = candidates
        .slice()
        .sort((a, b) => overflowScore(a) - overflowScore(b))[0];
    }

    const left = Math.max(margin, Math.min(mapW - w - margin, chosen.left));
    const top = Math.max(margin, Math.min(mapH - h - margin, chosen.top));
    result.style.left = `${left}px`;
    result.style.top = `${top}px`;

    state.routes.set(routeId, {
      id: routeId,
      lineEl,
      resultEl: result,
      renderRows,
      sigilInput: sigilInput instanceof HTMLInputElement ? sigilInput : null,
      fromCoord,
      toCoord,
      fromPt: fromPoint ? { x: fromPoint.x, y: fromPoint.y } : null,
      toPt:   toPoint   ? { x: toPoint.x,   y: toPoint.y   } : null,
      creationLeft: left,
      creationTop:  top,
      driftAtCreation: { x: state.totalDriftX, y: state.totalDriftY },
    });
    renderRows();
  };

  // ─── Time helpers ─────────────────────────────────────────────────────────

  const formatTimeHMS = (totalSec) => {
    const s = Math.max(0, Math.round(totalSec)) % 86400;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const parseTimeHMS = (str) => {
    const m = String(str || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return 0;
    return toInt(m[1]) * 3600 + toInt(m[2]) * 60 + toInt(m[3] || "0");
  };

  const computeArrivalTime = (startTimeStr, travelMs) => {
    const startSec = parseTimeHMS(startTimeStr);
    const travelSec = Math.round((toNumber(travelMs) || 0) / 1000);
    return formatTimeHMS((startSec + travelSec) % 86400);
  };

  const computeStartTime = (arrivalTimeStr, travelMs) => {
    const arrivalSec = parseTimeHMS(arrivalTimeStr);
    const travelSec = Math.round((toNumber(travelMs) || 0) / 1000);
    return formatTimeHMS(((arrivalSec - travelSec) % 86400 + 86400) % 86400);
  };

  const getServerTimeSec = () => {
    const timing = window.Timing;
    if (timing && typeof timing.getCurrentServerTime === "function") {
      const raw = timing.getCurrentServerTime();
      const ms = Math.floor(Number(raw) / 1000);
      return ms % 86400;
    }
    return null;
  };

  const getServerDate = () => {
    const timing = window.Timing;
    if (timing && typeof timing.getCurrentServerTime === "function") {
      const raw = timing.getCurrentServerTime();
      const d = new Date(raw);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
    // Fallback to local
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const countdownToStart = (startTimeStr, arrivalDateStr) => {
    const startSec = parseTimeHMS(startTimeStr);

    // Если есть дата прихода — вычисляем абсолютное время выхода
    if (arrivalDateStr) {
      const parts = String(arrivalDateStr).split("-").map(Number);
      if (parts.length === 3) {
        const departureMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        const departureAbsMs = departureMidnight + startSec * 1000;
        const now = Date.now();
        const diffMs = departureAbsMs - now;
        if (diffMs < 0) return "00:00:00";
        const h = Math.floor(diffMs / 3600000);
        const m = Math.floor((diffMs % 3600000) / 60000);
        const s = Math.floor((diffMs % 60000) / 1000);
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
      }
    }

    // Fallback: только время
    const serverSec = getServerTimeSec();
    if (serverSec === null) return "—";
    const diff = ((startSec - serverSec) % 86400 + 86400) % 86400;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const sortPlanRows = (rows) => {
    const getDepartureAbsMs = (row) => {
      const dateStr = row.arrivalDate || getServerDate();
      const arrivalSec = parseTimeHMS(row.arrivalTime);
      const travelSec = Math.round((toNumber(row.travelMs) || 0) / 1000);

      const parts = dateStr.split("-").map(Number);
      if (parts.length !== 3) return 0;
      const arrivalMidnight = new Date(parts[0], parts[1] - 1, parts[2]).getTime();
      const arrivalAbsMs = arrivalMidnight + arrivalSec * 1000;
      return arrivalAbsMs - travelSec * 1000;
    };

    return rows.slice().sort((a, b) => getDepartureAbsMs(a) - getDepartureAbsMs(b));
  };

  // ─── Copy plan to clipboard (BBCode) ──────────────────────────────────────

  const copyPlanToClipboard = () => {
    if (!state.planRows.length) {
      setPanelStatus("Нет строк для копирования.", null);
      return;
    }

    const headers = ["Кора старта", "Время манёвра", "Юнит", "Дата прихода", "Время прихода", "Время выхода", "Целевая кора", "Ссылка", "Комментарий"];
    const headerRow = `[table]\n[**]${headers.map((h) => `[b]${h}[/b]`).join("[||]")}[/**]`;

    const sorted = sortPlanRows(state.planRows);
    const bodyRows = sorted.map((row) => {
      const linkInfo = buildPlanLink(row.fromCoord, row.toCoord);
      const linkCell = linkInfo.url
        ? `[url=${linkInfo.url}]${linkInfo.name}[/url]`
        : "—";
      const cells = [
        formatCoord(row.fromCoord),
        cleanText(row.travelText),
        `[unit]${row.unit}[/unit]`,
        cleanText(row.arrivalDate || getServerDate()),
        cleanText(row.arrivalTime),
        cleanText(row.startTime),
        formatCoord(row.toCoord),
        linkCell,
        cleanText(row.comment || ""),
      ];
      return `[*]${cells.join("[|]")}`;
    });

    const bbcode = `${headerRow}\n${bodyRows.join("\n")}\n[/table]`;

    navigator.clipboard.writeText(bbcode).then(() => {
      setPanelStatus(`Скопировано ${state.planRows.length} строк в буфер обмена.`, null);
    }).catch((err) => {
      console.error("[ScriptMM][map-distance] clipboard error:", err);
      setPanelStatus("Ошибка копирования в буфер.", null);
    });
  };

  const updateCountdowns = () => {
    const panel = state.panelEl;
    if (!panel) return;
    const tbody = panel.querySelector("[data-smm-role='plan-rows']");
    if (!tbody) return;
    const countdownEls = tbody.querySelectorAll(".smm-mapdist-countdown");
    countdownEls.forEach((el) => {
      const start = el.getAttribute("data-smm-plan-start");
      const date = el.getAttribute("data-smm-plan-date");
      if (start) el.textContent = countdownToStart(start, date);
    });
  };

  // ─── Plan table render ────────────────────────────────────────────────────

  const renderPlanTable = () => {
    const panel = state.panelEl;
    if (!panel) return;
    const tbody = panel.querySelector("[data-smm-role='plan-rows']");
    if (!tbody) return;
    if (!state.planRows.length) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:#888;padding:4px;">Пусто</td></tr>`;
      // Stop the countdown timer if no rows
      if (state.countdownTimerId) {
        clearInterval(state.countdownTimerId);
        state.countdownTimerId = null;
      }
      return;
    }

    const sorted = sortPlanRows(state.planRows);

    const renderRowsHtml = () => {
      return sorted
        .map((row) => {
          const origIdx = state.planRows.indexOf(row);
          const linkInfo = buildPlanLink(row.fromCoord, row.toCoord);
          return `
        <tr>
          <td>${formatCoord(row.fromCoord)}</td>
          <td>${cleanText(row.travelText)}</td>
          <td>${cleanText(row.unitLabel)}</td>
          <td><input type="date" value="${cleanText(row.arrivalDate || getServerDate())}" data-smm-plan-field="arrivalDate" data-smm-plan-idx="${origIdx}" /></td>
          <td><input type="time" step="1" value="${cleanText(row.arrivalTime)}" data-smm-plan-field="arrivalTime" data-smm-plan-idx="${origIdx}" /></td>
          <td><input type="time" step="1" value="${cleanText(row.startTime)}" data-smm-plan-field="startTime" data-smm-plan-idx="${origIdx}" /></td>
          <td class="smm-mapdist-countdown" data-smm-plan-start="${row.startTime}" data-smm-plan-date="${cleanText(row.arrivalDate || getServerDate())}">${countdownToStart(row.startTime, row.arrivalDate)}</td>
          <td>${formatCoord(row.toCoord)}</td>
          <td class="smm-mapdist-link-cell" data-smm-link-url="${linkInfo.url || ""}" data-smm-link-name="${linkInfo.name || ""}">${linkInfo.url ? `<a href="${linkInfo.url}" target="_blank" style="font-size:11px;">${linkInfo.name}</a>` : "—"}</td>
          <td><input type="text" value="${cleanText(row.comment || "")}" placeholder="заметка..." data-smm-plan-field="comment" data-smm-plan-idx="${origIdx}" /></td>
          <td><button type="button" class="smm-mapdist-btn-mini" data-smm-action="plan-row-delete" data-smm-plan-idx="${origIdx}">×</button></td>
        </tr>
      `;
        })
        .join("");
    };

    tbody.innerHTML = renderRowsHtml();

    // Start countdown update timer
    if (state.countdownTimerId) clearInterval(state.countdownTimerId);
    state.countdownTimerId = setInterval(updateCountdowns, 1000);
  };

  // ─── Coord → pixel ────────────────────────────────────────────────────────
  // Три метода по убыванию надёжности:
  // 1) state.viewRef — калибровочная точка, взятая из реального клика по деревне
  // 2) TWMap.map.x/y — центр вьюпорта из внутреннего объекта TW
  // 3) Линейки #map_coord_x/y (резерв)

  const coordToPixel = (coord) => {
    if (!coord || !state.mapEl) return null;
    const tileW = (window.TWMap && window.TWMap.tileSize && window.TWMap.tileSize[0]) || 53;
    const tileH = (window.TWMap && window.TWMap.tileSize && window.TWMap.tileSize[1]) || 38;
    const mapRect = state.mapEl.getBoundingClientRect();
    const mapW = mapRect.width  || 795;
    const mapH = mapRect.height || 570;

    // Метод 1: калибровочная точка из реального клика
    if (state.viewRef) {
      const driftDx = state.totalDriftX - state.viewRef.driftX;
      const driftDy = state.totalDriftY - state.viewRef.driftY;
      return {
        x: Math.round(state.viewRef.px + (coord.x - state.viewRef.cx) * tileW + driftDx),
        y: Math.round(state.viewRef.py + (coord.y - state.viewRef.cy) * tileH + driftDy),
      };
    }

    // Метод 2: TWMap.map.x/y — текущий центр вьюпорта в игровых координатах
    const twm = window.TWMap && window.TWMap.map;
    if (twm && typeof twm.x === "number" && typeof twm.y === "number") {
      return {
        x: Math.round((coord.x - twm.x) * tileW + mapW / 2),
        y: Math.round((coord.y - twm.y) * tileH + mapH / 2),
      };
    }

    // Метод 3: линейки координат TW
    const coordX = document.getElementById("map_coord_x");
    const coordY = document.getElementById("map_coord_y");
    if (coordX && coordY) {
      const leftEdge = -(parseInt(coordX.style.left || "0", 10) || 0) / tileW;
      const topEdge  = -(parseInt(coordY.style.top  || "0", 10) || 0) / tileH;
      return {
        x: Math.round((coord.x - leftEdge) * tileW),
        y: Math.round((coord.y - topEdge)  * tileH),
      };
    }

    return null;
  };

  // ─── Plan localStorage I/O ────────────────────────────────────────────────

  const loadPlansFromStorage = () => {
    try {
      const raw = localStorage.getItem(PLAN_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const savePlansToStorage = (plans) => {
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plans));
    } catch (e) {
      void e;
    }
  };

  // ─── Modal dialogs ────────────────────────────────────────────────────────

  const MODAL_STYLE_ID = "scriptmm-modal-style";

  const ensureModalStyle = () => {
    if (document.getElementById(MODAL_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = MODAL_STYLE_ID;
    style.textContent = `
      .smm-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.45);
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .smm-modal {
        background: #f3ead5;
        border: 1px solid #b08b4f;
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,.35);
        min-width: 260px;
        max-width: 400px;
        font: 13px/1.4 Verdana, Arial, sans-serif;
        color: #3a2a16;
        overflow: hidden;
      }
      .smm-modal .smm-modal-head {
        background: rgba(107,76,35,.9);
        color: #fff3dd;
        font-weight: 700;
        padding: 8px 12px;
      }
      .smm-modal .smm-modal-body { padding: 12px 14px; }
      .smm-modal .smm-modal-foot {
        padding: 8px 14px;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        border-top: 1px solid #d4b87a;
      }
      .smm-modal-btn {
        border: 1px solid #a37a43;
        background: #f2e2c5;
        border-radius: 8px;
        padding: 3px 12px;
        cursor: pointer;
        font: inherit;
        color: #4a3518;
      }
      .smm-modal-btn:hover { background: #eed7b0; }
      .smm-modal-btn.primary { background: #c4a35f; color: #2a1a08; border-color: #9a7030; }
      .smm-modal-btn.primary:hover { background: #b8943f; }
      .smm-modal input[type="time"],
      .smm-modal input[type="text"] {
        border: 1px solid #b28a52;
        border-radius: 6px;
        padding: 4px 8px;
        font: inherit;
        color: #3a2a16;
        background: #fff;
        width: 100%;
        box-sizing: border-box;
        margin-top: 4px;
      }
      .smm-modal-plan-list {
        list-style: none;
        margin: 0;
        padding: 0;
        max-height: 220px;
        overflow-y: auto;
      }
      .smm-modal-plan-list li {
        padding: 7px 10px;
        cursor: pointer;
        border-radius: 5px;
        border: 1px solid transparent;
        margin-bottom: 3px;
      }
      .smm-modal-plan-list li:hover { background: #e8d8b0; border-color: #c4a35f; }
      .smm-modal-plan-list .plan-name { font-weight: 700; }
      .smm-modal-plan-list .plan-meta { font-size: 10px; color: #7a6040; display: block; margin-top: 1px; }
    `;
    document.head.appendChild(style);
  };

  const showTimePicker = () => {
    ensureModalStyle();
    const defaultDate = getServerDate();
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "smm-modal-overlay";
      overlay.innerHTML = `
        <div class="smm-modal">
          <div class="smm-modal-head">Время прихода</div>
          <div class="smm-modal-body">
            <label style="display:block;font-size:12px;">Дата прихода:</label>
            <input type="date" class="smm-modal-date" value="${defaultDate}" style="font-size:15px;" />
            <label style="display:block;font-size:12px;margin-top:8px;">Время прихода (ЧЧ:ММ:СС):</label>
            <input type="time" class="smm-modal-time" step="1" value="00:00:00" style="font-size:15px;" />
          </div>
          <div class="smm-modal-foot">
            <button type="button" class="smm-modal-btn" data-smm-modal="cancel">Отмена</button>
            <button type="button" class="smm-modal-btn primary" data-smm-modal="ok">OK</button>
          </div>
        </div>
      `;
      const timeInput = overlay.querySelector(".smm-modal-time");
      const dateInput = overlay.querySelector(".smm-modal-date");
      const doOk = () => {
        const arrivalTime = timeInput ? cleanText(timeInput.value) : "";
        const arrivalDate = dateInput ? cleanText(dateInput.value) : defaultDate;
        overlay.remove();
        if (!arrivalTime) {
          resolve(null);
          return;
        }
        resolve({ arrivalTime, arrivalDate });
      };
      overlay.addEventListener("click", (e) => {
        e.stopPropagation();
        const btn = e.target instanceof Element ? e.target.closest("[data-smm-modal]") : null;
        const act = btn ? cleanText(btn.getAttribute("data-smm-modal")) : "";
        if (act === "ok") { doOk(); }
        else if (act === "cancel" || e.target === overlay) { overlay.remove(); resolve(null); }
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doOk();
        else if (e.key === "Escape") { overlay.remove(); resolve(null); }
      });
      document.body.appendChild(overlay);
      if (timeInput) timeInput.focus();
    });
  };

  const showSaveDialog = () => {
    ensureModalStyle();
    const existingPlans = loadPlansFromStorage();
    const defaultName = `манёвр ${existingPlans.length + 1}`;
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "smm-modal-overlay";
      overlay.innerHTML = `
        <div class="smm-modal">
          <div class="smm-modal-head">Сохранить манёвр</div>
          <div class="smm-modal-body">
            <label style="display:block;font-size:12px;">Название:</label>
            <input type="text" value="${defaultName}" placeholder="${defaultName}" maxlength="60" />
          </div>
          <div class="smm-modal-foot">
            <button type="button" class="smm-modal-btn" data-smm-modal="cancel">Отмена</button>
            <button type="button" class="smm-modal-btn primary" data-smm-modal="ok">Сохранить</button>
          </div>
        </div>
      `;
      const input = overlay.querySelector("input");
      const doSave = () => {
        const name = cleanText(input ? input.value : "") || defaultName;
        const plans = loadPlansFromStorage();
        plans.push({
          name,
          savedAt: Date.now(),
          rows: state.planRows.map((r) => ({ ...r })),
        });
        savePlansToStorage(plans);
        overlay.remove();
        resolve(name);
      };
      overlay.addEventListener("click", (e) => {
        e.stopPropagation();
        const btn = e.target instanceof Element ? e.target.closest("[data-smm-modal]") : null;
        const act = btn ? cleanText(btn.getAttribute("data-smm-modal")) : "";
        if (act === "ok") { doSave(); }
        else if (act === "cancel" || e.target === overlay) { overlay.remove(); resolve(null); }
      });
      overlay.addEventListener("keydown", (e) => {
        if (e.key === "Enter") doSave();
        else if (e.key === "Escape") { overlay.remove(); resolve(null); }
      });
      document.body.appendChild(overlay);
      if (input) { input.focus(); input.select(); }
    });
  };

  const doOpenPlan = (plan) => {
    // Удаляем все текущие маршруты (черновик и предыдущий открытый)
    Array.from(state.routes.keys()).forEach((id) => removeRouteById(id));
    resetSelection();
    state.planRows = Array.isArray(plan.rows) ? plan.rows.map((r) => ({ ...r, comment: r.comment || "", arrivalDate: r.arrivalDate || getServerDate() })) : [];

    // Загружаем village.txt чтобы работали ссылки (id по координатам)
    const ensureVillageData = () => {
      if (!state.villageMapPromise) {
        state.villageMapPromise = loadVillageMapById().finally(() => {
          state.villageMapPromise = null;
        });
      }
      return state.villageMapPromise;
    };

    // Первый рендер (возможно без ссылок, пока village.txt не загрузится)
    renderPlanTable();

    // Догружаем village.txt и перерисовываем таблицу со ссылками
    ensureVillageData().then(() => {
      renderPlanTable();
    }).catch(() => {
      // Если не удалось загрузить — таблица всё равно отобразится без ссылок
    });

    // Рисуем стрелки для уникальных маршрутов из плана
    const seenRoutes = new Set();
    const routesToDraw = [];
    state.planRows.forEach((row) => {
      if (!row.fromCoord || !row.toCoord) return;
      const key = `${formatCoord(row.fromCoord)}->${formatCoord(row.toCoord)}`;
      if (seenRoutes.has(key)) return;
      seenRoutes.add(key);
      routesToDraw.push({ fromCoord: row.fromCoord, toCoord: row.toCoord });
    });
    if (routesToDraw.length) {
      ensureWorldSettings().then((settings) => {
        routesToDraw.forEach(({ fromCoord, toCoord }) => {
          const fromPt = coordToPixel(fromCoord);
          const toPt   = coordToPixel(toCoord);

          // Fallback: если coordToPixel вернул null, вычисляем через TWMap.map
          const mapRect = state.mapEl.getBoundingClientRect();
          const mapW = mapRect.width  || 795;
          const mapH = mapRect.height || 570;
          const tileW = (window.TWMap && window.TWMap.tileSize && window.TWMap.tileSize[0]) || 53;
          const tileH = (window.TWMap && window.TWMap.tileSize && window.TWMap.tileSize[1]) || 38;

          let fp = fromPt;
          let tp = toPt;

          if (!fp) {
            const twm = window.TWMap && window.TWMap.map;
            if (twm && typeof twm.x === "number" && typeof twm.y === "number") {
              fp = {
                x: Math.round((fromCoord.x - twm.x) * tileW + mapW / 2),
                y: Math.round((fromCoord.y - twm.y) * tileH + mapH / 2),
              };
            } else {
              fp = { x: Math.round(mapW / 4), y: Math.round(mapH / 2) };
            }
          }

          if (!tp) {
            const twm = window.TWMap && window.TWMap.map;
            if (twm && typeof twm.x === "number" && typeof twm.y === "number") {
              tp = {
                x: Math.round((toCoord.x - twm.x) * tileW + mapW / 2),
                y: Math.round((toCoord.y - twm.y) * tileH + mapH / 2),
              };
            } else {
              tp = { x: Math.round(mapW * 3 / 4), y: Math.round(mapH / 2) };
            }
          }

          const distance = computeDistance(fromCoord, toCoord);
          createRouteResultNearSecondVillage({
            fromCoord,
            toCoord,
            distance,
            settings,
            fromPoint: fp,
            toPoint: tp,
          });
        });
      }).catch((err) => {
        console.error("[ScriptMM][map-distance] open plan error:", err);
      });
    }
  };

  const showOpenDialog = () => {
    ensureModalStyle();

    const renderDialog = () => {
      const plans = loadPlansFromStorage();
      overlay.innerHTML = "";

      const modal = document.createElement("div");
      modal.className = "smm-modal";

      if (!plans.length) {
        modal.innerHTML = `
          <div class="smm-modal-head">Открыть манёвр</div>
          <div class="smm-modal-body" style="color:#888;text-align:center;">Нет сохранённых манёвров.</div>
          <div class="smm-modal-foot">
            <button type="button" class="smm-modal-btn primary" data-smm-modal="cancel">OK</button>
          </div>
        `;
      } else {
        modal.innerHTML = `
          <div class="smm-modal-head">Открыть манёвр</div>
          <div class="smm-modal-body" style="padding:8px 6px;">
            <ul class="smm-modal-plan-list">
              ${plans.map((p, i) => `
                <li data-smm-plan-idx="${i}" style="display:flex;align-items:center;justify-content:space-between;gap:6px;cursor:default;">
                  <span style="flex:1;min-width:0;">
                    <span class="plan-name">${cleanText(p.name)}</span>
                    <span class="plan-meta">${Array.isArray(p.rows) ? p.rows.length : 0} строк · ${new Date(p.savedAt).toLocaleDateString()}</span>
                  </span>
                  <span style="display:flex;gap:4px;flex-shrink:0;">
                    <button type="button" class="smm-modal-btn primary" style="padding:2px 8px;font-size:11px;" data-smm-plan-action="open" data-smm-plan-idx="${i}">Открыть</button>
                    <button type="button" class="smm-modal-btn" style="padding:2px 8px;font-size:11px;color:#a00;" data-smm-plan-action="delete" data-smm-plan-idx="${i}">Удалить</button>
                  </span>
                </li>
              `).join("")}
            </ul>
          </div>
          <div class="smm-modal-foot">
            <button type="button" class="smm-modal-btn" data-smm-modal="cancel">Закрыть</button>
          </div>
        `;
      }
      overlay.appendChild(modal);
    };

    const overlay = document.createElement("div");
    overlay.className = "smm-modal-overlay";
    renderDialog();

    overlay.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target === overlay) { overlay.remove(); return; }

      const cancelBtn = e.target instanceof Element ? e.target.closest("[data-smm-modal='cancel']") : null;
      if (cancelBtn) { overlay.remove(); return; }

      const actionBtn = e.target instanceof Element ? e.target.closest("[data-smm-plan-action]") : null;
      if (!actionBtn) return;

      const action = cleanText(actionBtn.getAttribute("data-smm-plan-action"));
      const idx = parseInt(cleanText(actionBtn.getAttribute("data-smm-plan-idx")), 10);
      const plans = loadPlansFromStorage();
      const plan = plans[idx];
      if (!plan) return;

      if (action === "open") {
        overlay.remove();
        doOpenPlan(plan);
      } else if (action === "delete") {
        plans.splice(idx, 1);
        savePlansToStorage(plans);
        renderDialog();
      }
    });

    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") overlay.remove();
    });
    document.body.appendChild(overlay);
  };

  const placeFirstMarker = (point) => {
    if (!point || !state.mapEl) return;
    const marker = state.firstMarker || document.createElement("div");
    marker.className = "smm-mapdist-pick-marker";
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    if (!marker.isConnected) {
      state.mapEl.appendChild(marker);
    }
    state.firstMarker = marker;
  };

  const removeFirstMarker = () => {
    if (state.firstMarker && state.firstMarker.isConnected) {
      state.firstMarker.remove();
    }
    state.firstMarker = null;
  };

  const resetSelection = () => {
    state.pickCycle += 1;
    state.firstPick = null;
    state.firstPointPx = null;
    removeFirstMarker();
  };

  const handleSecondPick = async (secondPick, secondPoint) => {
    const first = state.firstPick;
    if (!first || !first.coord || !secondPick || !secondPick.coord) {
      setPanelStatus("Не удалось считать координаты. Повтори выбор.", null);
      return;
    }

    const distance = computeDistance(first.coord, secondPick.coord);
    const settings = await ensureWorldSettings();

    // Пересчитываем позицию первой точки относительно текущего viewport
    const fromPoint = coordToPixel(first.coord) || state.firstPointPx;

    createRouteResultNearSecondVillage({
      fromCoord: first.coord,
      toCoord: secondPick.coord,
      distance,
      settings,
      fromPoint,
      toPoint: secondPoint,
    });

    setPanelStatus(
      `Готово: ${formatCoord(first.coord)} → ${formatCoord(secondPick.coord)} (дист. ${formatDistance(distance)}).`,
      null,
    );

    state.firstPick = null;
    state.firstPointPx = null;
    removeFirstMarker();
  };

  const processMapTap = async (event, idBefore) => {
    if (state.processingClick || state.destroyed) return;
    state.processingClick = true;
    try {
      const clickCycle = state.pickCycle;
      const priorKnownId = cleanText(
        idBefore || (state.firstPick && state.firstPick.id) || "",
      );
      let directVillageId = getVillageIdFromElementsAtPoint(event.clientX, event.clientY);
      const isFirstPick = !state.firstPick;
      const staleDirectFirstPick =
        isFirstPick &&
        Boolean(priorKnownId) &&
        Boolean(directVillageId) &&
        cleanText(directVillageId) === priorKnownId;
      if (staleDirectFirstPick) {
        directVillageId = "";
      }

      let villageId = directVillageId;
      if (!villageId) {
        if (isFirstPick) {
          villageId = await waitForSelectedVillageId(priorKnownId);
        } else {
          villageId = await waitForSelectedVillageId(priorKnownId);
        }
      }
      if (state.firstPick && villageId && String(villageId) === String(state.firstPick.id)) {
        const retryChangedId = await waitForSelectedVillageId(state.firstPick.id);
        if (retryChangedId && retryChangedId !== state.firstPick.id) {
          villageId = retryChangedId;
        }
      }
      if (!villageId) {
        setPanelStatus("Кликни именно по деревне на карте.", state.firstPick && state.firstPick.coord);
        return;
      }

      const upHint = getCursorHintAtPoint(event.clientX, event.clientY);
      const wasVillageHoverDown = Boolean(state.pointerState.downCursorHint && state.pointerState.downCursorHint.pointer);
      const wasVillageHoverUp = Boolean(upHint && upHint.pointer);
      const wasVillageHover = wasVillageHoverDown || wasVillageHoverUp;
      const changedFromBefore = Boolean(priorKnownId) && cleanText(villageId) !== priorKnownId;
      const looksLikeVillageClick =
        Boolean(directVillageId) ||
        (changedFromBefore && wasVillageHoverDown && wasVillageHoverUp);
      if (!looksLikeVillageClick) {
        setPanelStatus(
          wasVillageHover
            ? "Не удалось считать деревню под курсором. Кликни точнее по деревне."
            : "Кликни именно по деревне (пустая карта не считается).",
          state.firstPick && state.firstPick.coord,
        );
        return;
      }
      if (!directVillageId && priorKnownId && cleanText(villageId) === priorKnownId) {
        setPanelStatus(
          "Взялась текущая выбранная деревня. Кликни точнее по нужной деревне.",
          state.firstPick && state.firstPick.coord,
        );
        return;
      }
      if (
        cleanText(villageId) === cleanText(idBefore || "") &&
        !wasVillageHover &&
        !directVillageId
      ) {
        setPanelStatus(
          "Не поймал выбор новой деревни. Кликни прямо по деревне.",
          state.firstPick && state.firstPick.coord,
        );
        return;
      }

      const coord = await ensureVillageCoord(villageId);
      if (clickCycle !== state.pickCycle || state.destroyed) return;

      if (!coord) {
        setPanelStatus(`Не нашёл координаты для id=${villageId}.`, state.firstPick && state.firstPick.coord);
        return;
      }

      if (!state.firstPick) {
        state.firstPick = { id: villageId, coord };
        const firstPoint = getPointInMap(event);
        state.firstPointPx = firstPoint;
        placeFirstMarker(firstPoint);
        state.firstPickPt = firstPoint ? { x: firstPoint.x, y: firstPoint.y } : null;
        state.firstPickDriftX = state.totalDriftX;
        state.firstPickDriftY = state.totalDriftY;
        // Сохраняем калибровочную точку: точное соответствие координаты ↔ пиксель
        if (firstPoint && coord) {
          state.viewRef = {
            cx: coord.x, cy: coord.y,
            px: firstPoint.x, py: firstPoint.y,
            driftX: state.totalDriftX, driftY: state.totalDriftY,
          };
        }
        setPanelStatus("Первая деревня выбрана. Кликни вторую.", coord);
        return;
      }

      if (String(state.firstPick.id) === String(villageId)) {
        setPanelStatus("Это та же деревня. Выбери другую.", state.firstPick.coord);
        return;
      }

      const secondPoint = getPointInMap(event);
      await handleSecondPick({ id: villageId, coord }, secondPoint);
    } catch (error) {
      console.error("[ScriptMM][map-distance] click error", error);
      setPanelStatus(`Ошибка: ${cleanText(error && error.message) || "unknown"}`, state.firstPick && state.firstPick.coord);
    } finally {
      state.processingClick = false;
    }
  };

  const onMapMouseDown = (event) => {
    if (!(event instanceof MouseEvent)) return;
    if (event.button !== 0) return;
    if (isOverlayUiTarget(event.target)) {
      // Для интерактивных элементов — не блокируем ничего, пусть работают
      if (isInteractiveInOverlay(event.target)) {
        state.pointerState.active = false;
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      const routeEl = event.target instanceof Element ? event.target.closest(".smm-mapdist-route-result") : null;
      if (routeEl instanceof Element) {
        bringRouteToFront(cleanText(routeEl.getAttribute("data-smm-route-id")));
      }
      state.pointerState.active = false;
      return;
    }
    state.pointerState.active = true;
    state.pointerState.downX = event.clientX;
    state.pointerState.downY = event.clientY;
    state.pointerState.downAtMs = Date.now();
    state.pointerState.idBefore = getSelectedVillageId();
    state.pointerState.downCursorHint = getCursorHintAtPoint(event.clientX, event.clientY);
  };

  const onMapMouseUp = (event) => {
    if (!(event instanceof MouseEvent)) return;
    if (isOverlayUiTarget(event.target)) {
      // Для интерактивных элементов — не блокируем ничего
      if (isInteractiveInOverlay(event.target)) {
        state.pointerState.active = false;
        return;
      }
      event.stopPropagation();
      event.preventDefault();
      state.pointerState.active = false;
      return;
    }
    if (!state.pointerState.active) return;
    state.pointerState.active = false;
    if (event.button !== 0) return;

    const dx = Math.abs(event.clientX - state.pointerState.downX);
    const dy = Math.abs(event.clientY - state.pointerState.downY);
    const dragDistance = Math.sqrt(dx * dx + dy * dy);

    // Если карта двигалась мышью, это не выбор деревни.
    if (dragDistance > 8) return;

    processMapTap(event, state.pointerState.idBefore);
  };

  const init = () => {
    ensureStyle();
    ensurePanel();
    state.sigilPercent = loadSigilPercent();
    renderPlanTable();

    const mapEl = document.querySelector("#map");
    if (!mapEl) {
      setPanelStatus("Элемент #map не найден.", null);
      return;
    }

    state.mapEl = mapEl;
    state.mapClickHandler = {
      down: onMapMouseDown,
      move: onMapMouseMove,
      up: onMapMouseUp,
    };

    mapEl.addEventListener("mousedown", state.mapClickHandler.down, true);
    mapEl.addEventListener("mousemove", state.mapClickHandler.move, true);
    mapEl.addEventListener("mouseup", state.mapClickHandler.up, true);
    ingestSectorPrefetch();
    startViewportWatcher();

    console.log("[ScriptMM][map-distance] ready");
  };

  const destroy = () => {
    if (state.destroyed) return;
    state.destroyed = true;
    stopViewportWatcher();

    // Clean up countdown timer
    if (state.countdownTimerId) {
      clearInterval(state.countdownTimerId);
      state.countdownTimerId = null;
    }

    if (state.mapEl && state.mapClickHandler) {
      state.mapEl.removeEventListener("mousedown", state.mapClickHandler.down, true);
      state.mapEl.removeEventListener("mousemove", state.mapClickHandler.move, true);
      state.mapEl.removeEventListener("mouseup", state.mapClickHandler.up, true);
    }

    resetSelection();
    const routeIds = Array.from(state.routes.keys());
    routeIds.forEach((routeId) => removeRouteById(routeId));
    if (state.routeSvgEl && state.routeSvgEl.isConnected) state.routeSvgEl.remove();
    state.routeSvgEl = null;

    if (state.panelEl && state.panelEl.isConnected) {
      state.panelEl.remove();
    }
    state.panelEl = null;

    delete window[SCRIPT_KEY];
  };

  window[SCRIPT_KEY] = {
    destroy,
    reset: () => {
      resetSelection();
      setPanelStatus("Выбор сброшен.", null);
    },
    getState: () => ({
      firstPick: state.firstPick,
      settings: state.settings,
      cachedCoords: state.villageCoordById.size,
    }),
  };

  init();
})();

(() => {
  "use strict";

  const SCRIPT_KEY = "__scriptmmVillageSpotlight";
  const STYLE_ID = "scriptmm-village-spotlight-style";
  const ROOT_ID = "scriptmm-village-spotlight-root";
  const LOAD_ENDPOINT = "/map/village.txt";
  const GAME_REQUEST_MIN_INTERVAL_MS = 4000;
  const COMMAND_CACHE_TTL_MS = 30 * 60 * 1000;
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

  const fetchText = async (url, { rateLimited = false } = {}) => {
    if (rateLimited) {
      await reserveGameRequestSlot();
    }
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

  const fetchDocument = async (url, { rateLimited = false } = {}) => {
    const text = await fetchText(url, { rateLimited });
    return new DOMParser().parseFromString(text, "text/html");
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

  const buildBaseView = (village) => ({
    villageId: cleanText(village && village.id) || null,
    playerId: cleanText(village && village.playerId) || "0",
    coord: cleanText(village && village.coord) || null,
    mapName: cleanText(village && village.name) || null,
    title: cleanText(village && village.name) || cleanText(village && village.coord) || "?",
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

  const renderIdle = () => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML =
      '<div class="svs-empty">Введи координаты в формате <code>454|435</code>.</div>';
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

    const ownerText =
      cleanText(view.playerId) === "0"
        ? "0 (варварская деревня)"
        : cleanText(view.playerId);
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
            ? `<div class="svs-commands-wrap"><table class="svs-commands-table"><thead><tr><th>Приказ</th><th>Прибытие</th><th>Через</th><th>Войска</th></tr></thead><tbody>${commands
                .map((command) => {
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

                  return `<tr><td class="svs-command-cell"><div class="svs-command-main"><span class="svs-command-icons">${
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
                  )}</td><td class="svs-timer-cell">${timerHtml}</td><td class="svs-units-cell">${unitsCell}</td></tr>`;
                })
                .join("")}</tbody></table></div>`
            : '<div class="svs-empty">По этой деревне видимых приказов нет.</div>';

    state.resultEl.innerHTML = `<div class="svs-village-head"><div><div class="svs-card-title">${escapeHtml(
      cleanText(view.title),
    )}</div><div class="svs-card-coord">${escapeHtml(
      cleanText(view.coord),
    )}</div></div><div class="svs-card-meta">${escapeHtml(commandsMeta)}</div></div><div class="svs-card"><div class="svs-grid"><div class="svs-label">ID деревни</div><div class="svs-value">${escapeHtml(
      cleanText(view.villageId),
    )}</div><div class="svs-label">ID игрока</div><div class="svs-value">${escapeHtml(
      ownerText,
    )}</div></div></div><div class="svs-section-head"><div class="svs-section-title">Приказы в деревню</div>${
      view.infoUrl
        ? `<a class="svs-open-link" href="${escapeHtml(
            view.infoUrl,
          )}" target="_blank" rel="noopener noreferrer">Открыть info_village</a>`
        : ""
    }</div>${commandsHtml}`;

    refreshCountdowns();
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
      `Запрашиваю info_village для ${cleanText(village && village.coord)}. Интервал: 4 сек.`,
      "muted",
    );

    try {
      const doc = await fetchDocument(infoUrl, { rateLimited: true });
      if (token !== state.searchToken) return;

      view.title = parseVillageTitle(doc, village);
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
          `Приказы загружены: ${view.commands.length}. Догружаю войска по одному запросу раз в 4 сек.`,
          "muted",
        );
      }

      for (let index = 0; index < view.commands.length; index += 1) {
        if (token !== state.searchToken) return;

        const command = view.commands[index];
        if (!command) continue;
        if (
          ["loaded", "empty", "error", "unavailable"].includes(
            cleanText(command.unitsStatus),
          )
        ) {
          continue;
        }

        const commandUrl = cleanText(command.commandUrl);
        const cacheKey = cleanText(command.commandId) || commandUrl;
        if (!commandUrl) {
          markCommandResult(view, index, {
            unitsStatus: "unavailable",
            unitsError: "Нет ссылки на info_command",
          });
          continue;
        }

        markCommandResult(view, index, { unitsStatus: "loading" });
        setStatus(
          `Догружаю войска ${index + 1}/${view.commands.length}. Следующие запросы идут с шагом 4 сек.`,
          "muted",
        );

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
        }
      }

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
#${ROOT_ID} .svs-backdrop{position:absolute;inset:0;background:radial-gradient(circle at center,rgba(255,215,146,.18),transparent 28%),rgba(9,12,18,.62);backdrop-filter:blur(5px)}
#${ROOT_ID} .svs-panel{position:relative;display:flex;flex-direction:column;width:min(1180px,96vw);max-height:min(92vh,980px);padding:18px;border:1px solid rgba(236,201,130,.72);border-radius:18px;background:linear-gradient(180deg,rgba(34,27,19,.98) 0%,rgba(21,17,12,.98) 100%);box-shadow:0 26px 90px rgba(0,0,0,.46);color:#f8ecd0;overflow:hidden}
#${ROOT_ID} .svs-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}
#${ROOT_ID} .svs-title{font-size:24px;line-height:1;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#f8d48e}
#${ROOT_ID} .svs-subtitle{margin-top:6px;font-size:12px;line-height:1.35;color:#d6c5a4}
#${ROOT_ID} .svs-close{width:34px;height:34px;border:1px solid rgba(236,201,130,.45);border-radius:10px;background:rgba(255,255,255,.04);color:#f8ecd0;font-size:20px;line-height:1;cursor:pointer}
#${ROOT_ID} .svs-close:hover{background:rgba(255,255,255,.09)}
#${ROOT_ID} .svs-input-wrap{position:relative}
#${ROOT_ID} .svs-input{width:100%;box-sizing:border-box;border:1px solid rgba(236,201,130,.45);border-radius:14px;padding:16px 18px;background:rgba(255,248,231,.06);color:#fff6e5;font-size:28px;line-height:1.1;font-weight:700;letter-spacing:.04em;outline:none}
#${ROOT_ID} .svs-input::placeholder{color:rgba(248,236,208,.34)}
#${ROOT_ID} .svs-input:focus{border-color:#f0c676;box-shadow:0 0 0 3px rgba(240,198,118,.16)}
#${ROOT_ID} .svs-input:disabled{opacity:.6;cursor:wait}
#${ROOT_ID} .svs-status{margin-top:10px;min-height:18px;font-size:12px;line-height:1.35}
#${ROOT_ID} .svs-status[data-svs-status="muted"]{color:#d6c5a4}
#${ROOT_ID} .svs-status[data-svs-status="success"]{color:#9ad58e}
#${ROOT_ID} .svs-status[data-svs-status="error"]{color:#ff9d91}
#${ROOT_ID} .svs-result{margin-top:14px;overflow:auto;padding-right:2px}
#${ROOT_ID} .svs-empty{padding:22px 18px;border:1px dashed rgba(236,201,130,.26);border-radius:14px;background:rgba(255,248,231,.03);font-size:14px;line-height:1.45;color:#d9ccb4;text-align:center}
#${ROOT_ID} .svs-empty code{color:#ffe2a9}
#${ROOT_ID} .svs-village-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}
#${ROOT_ID} .svs-card{padding:14px 16px;border:1px solid rgba(236,201,130,.28);border-radius:16px;background:linear-gradient(180deg,rgba(255,248,231,.08) 0%,rgba(255,248,231,.04) 100%)}
#${ROOT_ID} .svs-card-title{font-size:22px;font-weight:800;color:#fff1cf}
#${ROOT_ID} .svs-card-coord{margin-top:4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#d0b88a}
#${ROOT_ID} .svs-card-meta{font-size:12px;color:#d2bd96;white-space:nowrap}
#${ROOT_ID} .svs-grid{display:grid;grid-template-columns:140px 1fr;gap:10px 14px}
#${ROOT_ID} .svs-label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c8b185}
#${ROOT_ID} .svs-value{font-size:18px;font-weight:800;color:#ffffff}
#${ROOT_ID} .svs-section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0 8px}
#${ROOT_ID} .svs-section-title{font-size:14px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#f0c979}
#${ROOT_ID} .svs-open-link{font-size:12px;color:#ffe2a9;text-decoration:underline}
#${ROOT_ID} .svs-open-link:hover{color:#fff2d0}
#${ROOT_ID} .svs-commands-wrap{border:1px solid rgba(236,201,130,.22);border-radius:14px;overflow:auto;background:rgba(255,248,231,.04)}
#${ROOT_ID} .svs-commands-table{width:100%;border-collapse:separate;border-spacing:0;min-width:860px}
#${ROOT_ID} .svs-commands-table th{position:sticky;top:0;padding:10px 12px;background:#f0dfbb;color:#4f320c;text-align:left;font-size:12px;letter-spacing:.05em;text-transform:uppercase;z-index:1}
#${ROOT_ID} .svs-commands-table td{padding:10px 12px;border-top:1px solid rgba(236,201,130,.16);vertical-align:top;background:rgba(255,248,231,.02);font-size:13px;color:#f8ecd0}
#${ROOT_ID} .svs-commands-table tbody tr:nth-child(even) td{background:rgba(255,248,231,.05)}
#${ROOT_ID} .svs-command-cell{min-width:340px}
#${ROOT_ID} .svs-command-main{display:flex;align-items:flex-start;gap:10px}
#${ROOT_ID} .svs-command-icons{display:inline-flex;align-items:center;gap:4px;min-width:44px;flex-wrap:wrap}
#${ROOT_ID} .svs-command-icon{width:18px;height:18px;object-fit:contain;display:block}
#${ROOT_ID} .svs-command-text{min-width:0}
#${ROOT_ID} .svs-command-label{font-size:13px;font-weight:700;line-height:1.35;color:#fff5dd;word-break:break-word}
#${ROOT_ID} .svs-command-label a{color:inherit;text-decoration:none;border-bottom:1px dotted rgba(255,245,221,.45)}
#${ROOT_ID} .svs-command-label a:hover{border-bottom-color:rgba(255,245,221,.95)}
#${ROOT_ID} .svs-command-sub{margin-top:3px;font-size:11px;color:#c9b28b}
#${ROOT_ID} .svs-arrival-cell{white-space:nowrap;min-width:180px}
#${ROOT_ID} .svs-timer-cell{white-space:nowrap;min-width:100px;font-weight:700;color:#ffe3a4}
#${ROOT_ID} .svs-units-cell{min-width:250px}
#${ROOT_ID} .svs-units-wrap{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#${ROOT_ID} .svs-unit-chip{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;border:1px solid rgba(236,201,130,.28);border-radius:999px;background:rgba(255,248,231,.08);color:#fff5dd;font-size:11px;font-weight:700;line-height:1}
#${ROOT_ID} .svs-unit-icon{width:14px;height:14px;object-fit:contain;display:block}
#${ROOT_ID} .svs-unit-fallback{font-size:10px;text-transform:uppercase}
#${ROOT_ID} .svs-unit-count{font-variant-numeric:tabular-nums}
#${ROOT_ID} .svs-units-loading{color:#ffe3a4}
#${ROOT_ID} .svs-units-empty{color:#d4c6ac}
#${ROOT_ID} .svs-units-error{color:#ff9d91}
#${ROOT_ID} .svs-hint{margin-top:12px;font-size:11px;line-height:1.4;color:#ad9a77;text-align:right}
@media (max-width: 760px){
  #${ROOT_ID}{padding:10px}
  #${ROOT_ID} .svs-panel{width:100%;max-height:96vh;padding:14px;border-radius:16px}
  #${ROOT_ID} .svs-title{font-size:18px}
  #${ROOT_ID} .svs-subtitle{font-size:11px}
  #${ROOT_ID} .svs-input{padding:14px 16px;font-size:22px;border-radius:12px}
  #${ROOT_ID} .svs-village-head{display:block}
  #${ROOT_ID} .svs-card-meta{margin-top:6px;white-space:normal}
  #${ROOT_ID} .svs-grid{grid-template-columns:1fr;gap:4px}
  #${ROOT_ID} .svs-value{margin-bottom:8px}
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
          <div>
            <div class="svs-title">Village Spotlight</div>
            <div class="svs-subtitle">Поиск деревни по координатам, загрузка <code>${escapeHtml(
              LOAD_ENDPOINT,
            )}</code>, таблица приказов и состав войск по <code>info_command</code>.</div>
          </div>
          <button class="svs-close" type="button" data-svs-action="close" aria-label="Закрыть">×</button>
        </div>
        <div class="svs-input-wrap">
          <input class="svs-input" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="454|435" disabled />
        </div>
        <div class="svs-status" data-svs-status="muted">Подготовка...</div>
        <div class="svs-result"></div>
        <div class="svs-hint">Esc закрыть. Ctrl/⌘+K открыть снова.</div>
      </div>
    `;

    state.rootEl = root;
    state.inputEl = root.querySelector(".svs-input");
    state.statusEl = root.querySelector(".svs-status");
    state.resultEl = root.querySelector(".svs-result");

    state.boundClick = (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
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

    if (
      (event.ctrlKey || event.metaKey) &&
      String(event.key || "").toLowerCase() === "k"
    ) {
      event.preventDefault();
      setVisible(true);
      return;
    }

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

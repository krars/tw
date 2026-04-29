javascript:(function () {
  "use strict";

  var RUNTIME_KEY = "__scriptmmWatchtowerVillageRuntime";
  var LOG_PREFIX = "[ScriptMM][watchtower-village]";
  var LABEL_CLASS = "scriptmm-wt-village-label";
  var STATUS_ID = "scriptmm-wt-village-status";
  var STYLE_ID = "scriptmm-wt-village-style";
  var REFRESH_BUTTON_CLASS = "scriptmm-wt-village-refresh";
  var FETCH_COOLDOWN_MS = 12000;
  var RENDER_EVERY_MS = 1000;

  var previousRuntime = window[RUNTIME_KEY];
  if (previousRuntime && Array.isArray(previousRuntime.cleanup)) {
    previousRuntime.cleanup.forEach(function (fn) {
      try {
        fn();
      } catch (e) {}
    });
  }

  var runtime = {
    cleanup: [],
    scriptStartMs: Date.now(),
    state: {
      inFlight: false,
      fetchedAtMs: 0,
      attacksById: new Map(),
    },
  };
  window[RUNTIME_KEY] = runtime;

  runtime.cleanup.push(function () {
    var status = document.getElementById(STATUS_ID);
    if (status) status.remove();
    clearLabels();
  });

  if (!isPlaceVillagePage()) {
    alert("Скрипт Сторожевой Башни нужно запускать на странице деревни: Площадь / Приказы (screen=place).");
    return;
  }

  if (!getVisibleIncomingRows().length) {
    alert("На этой странице деревни нет видимых входящих атак.");
    return;
  }

  injectStyles();
  installStatusPanel();
  refresh(true);

  var renderInterval = window.setInterval(renderLabels, RENDER_EVERY_MS);
  runtime.cleanup.push(function () {
    window.clearInterval(renderInterval);
  });

  function isPlaceVillagePage() {
    var screen = cleanText(getGameDataValue("screen"));
    if (screen === "place") {
      return true;
    }
    try {
      var url = new URL(window.location.href);
      return url.searchParams.get("screen") === "place";
    } catch (e) {
      return false;
    }
  }

  function refresh(force) {
    var state = runtime.state;
    if (state.inFlight) {
      return;
    }

    var nowMs = Date.now();
    if (!force && nowMs - state.fetchedAtMs < FETCH_COOLDOWN_MS) {
      renderLabels();
      return;
    }

    var ids = getVisibleIncomingCommandIds();
    if (!ids.length) {
      setStatus("Видимых входящих атак нет", "muted");
      clearLabels();
      return;
    }

    state.inFlight = true;
    setStatus("Обновляю данные Сторожевой Башни...", "loading");

    fetchAttacksDocument()
      .then(function (doc) {
        var parsed = parseAttacksDocument(doc);
        state.attacksById = parsed;
        state.fetchedAtMs = Date.now();
        renderLabels();
        setStatus(
          "Сторожевая Башня: найдено " +
            countMatched(ids, parsed) +
            " из " +
            ids.length +
            " видимых атак",
          "ok",
        );
      })
      .catch(function (error) {
        console.warn(LOG_PREFIX, error);
        setStatus("Сторожевая Башня: не удалось загрузить все атаки", "error");
      })
      .finally(function () {
        state.inFlight = false;
      });
  }

  function fetchAttacksDocument() {
    var url = buildAttacksUrl();
    return fetch(url, {
      credentials: "include",
      cache: "no-store",
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status + " while loading " + url);
        }
        return response.text();
      })
      .then(function (html) {
        return new DOMParser().parseFromString(html, "text/html");
      });
  }

  function buildAttacksUrl() {
    var villageId =
      cleanText(getGameDataValue("village.id")) ||
      getUrlParam(window.location.href, "village");
    var url = new URL("/game.php", window.location.origin);
    if (villageId) {
      url.searchParams.set("village", villageId);
    }
    url.searchParams.set("screen", "overview_villages");
    url.searchParams.set("mode", "incomings");
    url.searchParams.set("type", "all");
    url.searchParams.set("subtype", "attacks");
    url.searchParams.set("group", "0");
    url.searchParams.set("page", "-1");
    return url.toString();
  }

  function parseAttacksDocument(doc) {
    var table = doc.querySelector("#incomings_table");
    var rows = table
      ? Array.from(table.querySelectorAll("tr.row_a, tr.row_b"))
      : [];
    var byId = new Map();

    rows.forEach(function (row) {
      var id = parseCommandIdFromRow(row);
      if (!id) {
        return;
      }

      byId.set(id, {
        id: id,
        label: readCommandLabel(row),
        kind: readCommandKind(row),
        target: readCellText(row, 2),
        origin: readCellText(row, 3),
        player: readCellText(row, 4),
        distance: readCellText(row, 5),
        arrival: readArrivalCellText(row),
        arrivalIn: readCellText(row, 7),
        watchtowerEndMs: readWatchtowerEndMs(row),
        watchtowerRawText: cleanText(
          safe(function () {
            return row.querySelector(".watchtower-timer").textContent;
          }, ""),
        ),
      });
    });

    return byId;
  }

  function renderLabels() {
    var rows = getVisibleIncomingRows();
    if (!rows.length) {
      clearLabels();
      return;
    }

    rows.forEach(function (row) {
      var id = parseCommandIdFromRow(row);
      var label = getOrCreateRowLabel(row);
      if (!label) {
        return;
      }

      if (!id) {
        label.textContent = "СБ: нет id приказа";
        label.className = LABEL_CLASS + " is-error";
        return;
      }

      var attack = runtime.state.attacksById.get(id);
      if (!attack) {
        label.textContent = runtime.state.inFlight
          ? "СБ: ищу данные в списке всех атак..."
          : "СБ: нет данных на странице всех атак";
        label.className = LABEL_CLASS + " is-muted";
        return;
      }

      var timing = formatWatchtowerTiming(attack);
      var details = formatAttackDetails(attack);
      label.textContent =
        "СБ: " + timing.text + (details ? " | " + details : "");
      label.title = formatFullTitle(attack, timing.text);
      label.className = LABEL_CLASS + " " + timing.className;
    });
  }

  function clearLabels() {
    Array.from(document.querySelectorAll("." + LABEL_CLASS)).forEach(function (
      node,
    ) {
      node.remove();
    });
  }

  function getVisibleIncomingRows() {
    return Array.from(
      document.querySelectorAll("#commands_incomings tr.command-row"),
    ).filter(function (row) {
      return row.offsetParent !== null || row.getClientRects().length > 0;
    });
  }

  function getVisibleIncomingCommandIds() {
    return getVisibleIncomingRows()
      .map(parseCommandIdFromRow)
      .filter(Boolean);
  }

  function getOrCreateRowLabel(row) {
    var firstCell = row.querySelector("td");
    if (!firstCell) {
      return null;
    }

    var existing = firstCell.querySelector("." + LABEL_CLASS);
    if (existing) {
      return existing;
    }

    var label = document.createElement("div");
    label.className = LABEL_CLASS + " is-muted";

    var quickeditContent = firstCell.querySelector(".quickedit-content");
    if (quickeditContent) {
      quickeditContent.appendChild(label);
    } else {
      firstCell.appendChild(label);
    }

    return label;
  }

  function parseCommandIdFromRow(row) {
    if (!row) {
      return null;
    }

    var input = row.querySelector("input[name^='command_ids[']");
    var fromInput = input
      ? parseCommandIdFromText(input.getAttribute("name"))
      : null;
    if (fromInput) {
      return fromInput;
    }

    var quickedit = row.querySelector(".quickedit[data-id]");
    var fromQuickedit = quickedit
      ? cleanText(quickedit.getAttribute("data-id"))
      : null;
    if (fromQuickedit) {
      return fromQuickedit;
    }

    var link = row.querySelector("a[href*='screen=info_command'][href*='id=']");
    return link ? getUrlParam(link.href, "id") : null;
  }

  function parseCommandIdFromText(value) {
    var match = String(value || "").match(/\[(\d+)\]|id_(\d+)|[?&]id=(\d+)/);
    return match ? match[1] || match[2] || match[3] : null;
  }

  function readCommandLabel(row) {
    return cleanText(
      safe(function () {
        return row.querySelector(".quickedit-label").textContent;
      }, ""),
    );
  }

  function readCommandKind(row) {
    var titled = Array.from(row.querySelectorAll("td:first-child [title]"))
      .map(function (node) {
        return cleanText(node.getAttribute("title"));
      })
      .filter(Boolean);
    return titled.length ? titled.join(", ") : "";
  }

  function readArrivalCellText(row) {
    var cell = row.querySelector("td:nth-child(6)");
    if (!cell) {
      return "";
    }

    var text = cleanText(cell.textContent);
    var msNode = cell.querySelector(".grey.small");
    var ms = cleanText(msNode ? msNode.textContent : "");
    if (ms) {
      text = cleanText(text.replace(ms, ":" + ms.padStart(3, "0")));
    }
    return text;
  }

  function readCellText(row, index) {
    return cleanText(
      safe(function () {
        return row.querySelector("td:nth-child(" + index + ")").textContent;
      }, ""),
    );
  }

  function readWatchtowerEndMs(row) {
    var timer = row.querySelector(".watchtower-timer");
    var raw = cleanText(
      timer
        ? timer.getAttribute("data-endtime") ||
            timer.getAttribute("data-endTime") ||
            safe(function () {
              return timer.dataset.endtime;
            }, "")
        : "",
    );
    var numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return null;
    }
    return numeric >= 1000000000000
      ? Math.round(numeric)
      : Math.round(numeric * 1000);
  }

  function formatWatchtowerTiming(attack) {
    var endMs = Number(attack && attack.watchtowerEndMs);
    if (!Number.isFinite(endMs)) {
      var fallback = cleanText(attack && attack.watchtowerRawText);
      return {
        text: fallback || "нет времени распознавания",
        className: "is-muted",
      };
    }

    var diffMs = endMs - getServerNowMs();
    var clock = formatServerClock(endMs);
    if (diffMs <= 0) {
      var past = "в зоне покрытия";
      if (clock) {
        past += " с " + clock;
      }
      return {
        text: past,
        className: "is-ready",
      };
    }

    var future = "будет распознано через " + formatDuration(diffMs);
    if (clock) {
      future += " (" + clock + ")";
    }
    return {
      text: future,
      className: "is-future",
    };
  }

  function formatAttackDetails(attack) {
    var parts = [];
    if (attack.kind) {
      parts.push(attack.kind);
    } else if (attack.label) {
      parts.push(attack.label);
    }
    if (attack.origin) {
      parts.push("из " + attack.origin);
    }
    if (attack.player) {
      parts.push(attack.player);
    }
    if (attack.distance) {
      parts.push("дист. " + attack.distance);
    }
    if (attack.arrival) {
      parts.push("прибытие " + attack.arrival);
    }
    return parts.join("; ");
  }

  function formatFullTitle(attack, timing) {
    return [
      "Сторожевая Башня: " + timing,
      attack.target ? "Цель: " + attack.target : "",
      attack.origin ? "Источник: " + attack.origin : "",
      attack.player ? "Игрок: " + attack.player : "",
      attack.distance ? "Расстояние: " + attack.distance : "",
      attack.arrival ? "Прибытие: " + attack.arrival : "",
      attack.arrivalIn ? "До прибытия: " + attack.arrivalIn : "",
      attack.kind ? "Тип: " + attack.kind : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function countMatched(ids, attacksById) {
    return ids.reduce(function (sum, id) {
      return sum + (attacksById.has(id) ? 1 : 0);
    }, 0);
  }

  function installStatusPanel() {
    var old = document.getElementById(STATUS_ID);
    if (old) {
      old.remove();
    }

    var container = document.querySelector("#commands_incomings");
    if (!container) {
      return;
    }

    var panel = document.createElement("div");
    panel.id = STATUS_ID;
    panel.className = "scriptmm-wt-village-status is-muted";

    var text = document.createElement("span");
    text.className = "scriptmm-wt-village-status-text";
    text.textContent = "Сторожевая Башня: ожидаю данные";

    var button = document.createElement("button");
    button.type = "button";
    button.className = REFRESH_BUTTON_CLASS;
    button.textContent = "обновить";
    button.addEventListener("click", function () {
      refresh(true);
    });

    panel.appendChild(text);
    panel.appendChild(button);
    container.parentNode.insertBefore(panel, container);
  }

  function setStatus(text, mode) {
    var panel = document.getElementById(STATUS_ID);
    if (!panel) {
      return;
    }
    var textNode = panel.querySelector(".scriptmm-wt-village-status-text");
    if (textNode) {
      textNode.textContent = text;
    }
    panel.className = "scriptmm-wt-village-status is-" + (mode || "muted");
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "." + LABEL_CLASS + " {",
      "  display: block;",
      "  margin-top: 3px;",
      "  padding: 2px 5px;",
      "  border-radius: 3px;",
      "  font-size: 11px;",
      "  line-height: 1.25;",
      "  white-space: normal;",
      "  max-width: 520px;",
      "}",
      "." + LABEL_CLASS + ".is-future {",
      "  color: #4b2d00;",
      "  background: #fff3cd;",
      "  border: 1px solid #d9ad45;",
      "}",
      "." + LABEL_CLASS + ".is-ready {",
      "  color: #174017;",
      "  background: #dff0d8;",
      "  border: 1px solid #8bc58b;",
      "}",
      "." + LABEL_CLASS + ".is-muted {",
      "  color: #555;",
      "  background: #eeeeee;",
      "  border: 1px solid #c9c9c9;",
      "}",
      "." + LABEL_CLASS + ".is-error {",
      "  color: #6d1111;",
      "  background: #f2dede;",
      "  border: 1px solid #c79090;",
      "}",
      ".scriptmm-wt-village-status {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 8px;",
      "  margin: 0 0 6px 0;",
      "  padding: 4px 6px;",
      "  border: 1px solid #c7b58b;",
      "  background: #f4e4bc;",
      "  color: #4a3410;",
      "  font-size: 12px;",
      "}",
      ".scriptmm-wt-village-status.is-error {",
      "  border-color: #b98282;",
      "  background: #f2dede;",
      "  color: #6d1111;",
      "}",
      ".scriptmm-wt-village-status.is-ok {",
      "  border-color: #91b56f;",
      "  background: #e4f1d7;",
      "  color: #2b4a17;",
      "}",
      "." + REFRESH_BUTTON_CLASS + " {",
      "  cursor: pointer;",
      "  padding: 1px 7px;",
      "  font-size: 11px;",
      "}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function getServerNowMs() {
    var timingValue = readTimingApiValue();
    var timingDate = parseDateLike(timingValue);
    if (timingDate) {
      return timingDate.getTime();
    }

    var generated = Number(getGameDataValue("time_generated"));
    if (Number.isFinite(generated) && generated > 0) {
      var generatedMs =
        generated >= 1000000000000 ? generated : Math.round(generated * 1000);
      return generatedMs + (Date.now() - runtime.scriptStartMs);
    }

    return Date.now();
  }

  function readTimingApiValue() {
    var timing = safe(function () {
      return window.Timing;
    }, null);
    if (!timing || typeof timing !== "object") {
      return null;
    }

    if (typeof timing.getCurrentServerTime === "function") {
      return safe(function () {
        return timing.getCurrentServerTime();
      }, null);
    }
    if (typeof timing.getServerTime === "function") {
      return safe(function () {
        return timing.getServerTime();
      }, null);
    }
    return timing.currentServerTime || timing.serverTime || null;
  }

  function parseDateLike(value) {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value;
    }

    var numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      var epochMs =
        numeric >= 1000000000000 ? numeric : Math.round(numeric * 1000);
      var numericDate = new Date(epochMs);
      return Number.isFinite(numericDate.getTime()) ? numericDate : null;
    }

    var text = cleanText(value);
    if (!text) {
      return null;
    }

    var parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    var date = new Date(parsed);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  function formatDuration(ms) {
    var totalSeconds = Math.max(0, Math.ceil(Number(ms) / 1000));
    var days = Math.floor(totalSeconds / 86400);
    var rest = totalSeconds % 86400;
    var hours = Math.floor(rest / 3600);
    var minutes = Math.floor((rest % 3600) / 60);
    var seconds = rest % 60;
    var hms =
      String(hours).padStart(2, "0") +
      ":" +
      String(minutes).padStart(2, "0") +
      ":" +
      String(seconds).padStart(2, "0");
    return days > 0 ? days + "д " + hms : hms;
  }

  function formatServerClock(epochMs) {
    var ms = Number(epochMs);
    if (!Number.isFinite(ms)) {
      return "";
    }

    var offsetSeconds =
      Number(
        safe(function () {
          return window.server_utc_diff;
        }, NaN),
      ) ||
      Number(
        safe(function () {
          return window.game_data.server_utc_diff;
        }, NaN),
      ) ||
      0;
    var shifted = new Date(ms + offsetSeconds * 1000);
    if (!Number.isFinite(shifted.getTime())) {
      return "";
    }

    return (
      String(shifted.getUTCHours()).padStart(2, "0") +
      ":" +
      String(shifted.getUTCMinutes()).padStart(2, "0") +
      ":" +
      String(shifted.getUTCSeconds()).padStart(2, "0")
    );
  }

  function getGameDataValue(path) {
    var data = safe(function () {
      if (window.game_data) {
        return window.game_data;
      }
      if (
        window.TribalWars &&
        typeof window.TribalWars.getGameData === "function"
      ) {
        return window.TribalWars.getGameData();
      }
      return null;
    }, null);

    if (!data) {
      return null;
    }

    return String(path || "")
      .split(".")
      .reduce(function (current, part) {
        return current && Object.prototype.hasOwnProperty.call(current, part)
          ? current[part]
          : null;
      }, data);
  }

  function getUrlParam(url, key) {
    try {
      return new URL(url, window.location.origin).searchParams.get(key);
    } catch (e) {
      return null;
    }
  }

  function cleanText(value) {
    return String(value == null ? "" : value)
      .replace(/\s+/g, " ")
      .trim();
  }

  function safe(fn, fallback) {
    try {
      return fn();
    } catch (e) {
      return fallback;
    }
  }
})();

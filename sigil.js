(function () {
  "use strict";

  var SCRIPT_ID = "scriptmm-sigil-analyzer";
  var PANEL_ID = "scriptmm-sigil-panel";

  var UNIT_LABELS = {
    spear: "Коп",
    sword: "Меч",
    axe: "Топ",
    archer: "Луч",
    spy: "Разв",
    light: "ЛК",
    marcher: "КЛ",
    heavy: "ТК",
    ram: "Таран",
    catapult: "Ката",
    knight: "Пал",
    snob: "Двор",
    militia: "Опол",
  };

  var UNIT_SPEED_FALLBACK = {
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

  function isConfirmPage() {
    var qs = new URLSearchParams(window.location.search);
    var isTryConfirm = qs.get("try") === "confirm";
    var isPlaceScreen =
      (window.game_data && game_data.screen === "place") ||
      /(?:\?|&)screen=place(?:&|$)/.test(window.location.search);
    return isTryConfirm && isPlaceScreen;
  }

  function toNumber(value) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseCoordFromText(text) {
    var m = String(text || "").match(/(\d{1,3})\|(\d{1,3})/);
    if (!m) return null;
    return {
      x: Number(m[1]),
      y: Number(m[2]),
      text: m[1] + "|" + m[2],
    };
  }

  function parseDurationSeconds(text) {
    var parts = String(text || "").match(/\d+/g);
    if (!parts || !parts.length) return null;

    var nums = parts.map(function (v) {
      return Number(v);
    });

    if (nums.length === 3) {
      return nums[0] * 3600 + nums[1] * 60 + nums[2];
    }
    if (nums.length === 4) {
      return (((nums[0] * 24 + nums[1]) * 60 + nums[2]) * 60) + nums[3];
    }
    if (nums.length === 2) {
      return nums[0] * 60 + nums[1];
    }
    return null;
  }

  function formatSeconds(totalSeconds) {
    var sec = Math.max(0, Math.round(Number(totalSeconds) || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return (
      String(h).padStart(2, "0") +
      ":" +
      String(m).padStart(2, "0") +
      ":" +
      String(s).padStart(2, "0")
    );
  }

  function readConfirmValueByLabel(labelRegex) {
    var table = document.querySelector("#command-data-form table.vis");
    if (!table) return null;

    var rows = table.querySelectorAll("tr");
    for (var i = 0; i < rows.length; i += 1) {
      var tds = rows[i].querySelectorAll("td");
      if (tds.length < 2) continue;
      var label = tds[0].textContent.replace(/\s+/g, " ").trim();
      if (labelRegex.test(label)) {
        return tds[1].textContent.replace(/\s+/g, " ").trim();
      }
    }

    return null;
  }

  function getSourceCoord() {
    var menuRow = document.querySelector("#menu_row2");
    var parsed = parseCoordFromText(menuRow ? menuRow.textContent : "");
    if (parsed) return parsed;

    if (window.game_data && game_data.village) {
      var x = Number(game_data.village.x);
      var y = Number(game_data.village.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { x: x, y: y, text: x + "|" + y };
      }
    }

    return null;
  }

  function getTargetCoord() {
    var destinationText = readConfirmValueByLabel(/пункт\s*назначения|target|цель/i);
    var parsed = parseCoordFromText(destinationText);
    if (parsed) return parsed;

    var xInput = document.querySelector('#command-data-form input[name="x"]');
    var yInput = document.querySelector('#command-data-form input[name="y"]');
    var x = xInput ? Number(xInput.value) : NaN;
    var y = yInput ? Number(yInput.value) : NaN;
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return { x: x, y: y, text: x + "|" + y };
    }

    return null;
  }

  function getDurationSeconds() {
    var durationText = readConfirmValueByLabel(/длительн|duration/i);
    return parseDurationSeconds(durationText);
  }

  function getKnownUnitsList() {
    var list = [];

    if (window.game_data && Array.isArray(game_data.units)) {
      list = list.concat(game_data.units);
    }

    list = list.concat(Object.keys(UNIT_LABELS));

    var dedup = {};
    return list.filter(function (u) {
      if (!u || dedup[u]) return false;
      dedup[u] = true;
      return true;
    });
  }

  function readUnitsFromHiddenInputs() {
    var form = document.getElementById("command-data-form");
    if (!form) return {};

    var units = {};
    var known = getKnownUnitsList();

    for (var i = 0; i < known.length; i += 1) {
      var unit = known[i];
      var input = form.querySelector('input[type="hidden"][name="' + unit + '"]');
      if (!input) continue;
      var count = Number(input.value);
      units[unit] = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    }

    return units;
  }

  function readUnitsFromUnitsRowFallback() {
    var row = document.querySelector("#place_confirm_units tr.units-row");
    if (!row) return {};

    var units = {};
    var cells = row.querySelectorAll("td.unit-item");
    for (var i = 0; i < cells.length; i += 1) {
      var cls = cells[i].className || "";
      var m = cls.match(/unit-item-([a-z_]+)/i);
      if (!m) continue;
      var unit = String(m[1]).toLowerCase();
      var fromAttr = Number(cells[i].getAttribute("data-unit-count"));
      var count = Number.isFinite(fromAttr)
        ? fromAttr
        : Number(cells[i].textContent.replace(/\D+/g, ""));
      units[unit] = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    }

    return units;
  }

  function getSelectedUnits() {
    var fromHidden = readUnitsFromHiddenInputs();
    var hasAny = Object.keys(fromHidden).some(function (u) {
      return Number(fromHidden[u]) > 0;
    });

    if (hasAny) return fromHidden;
    return readUnitsFromUnitsRowFallback();
  }

  function formatUnits(units) {
    var items = [];
    Object.keys(units).forEach(function (unit) {
      var count = Number(units[unit]) || 0;
      if (count <= 0) return;
      var label = UNIT_LABELS[unit] || unit;
      items.push(label + " " + count);
    });
    return items.length ? items.join(", ") : "—";
  }

  function readXmlText(root, selectors) {
    var list = Array.isArray(selectors) ? selectors : [selectors];
    for (var i = 0; i < list.length; i += 1) {
      var selector = list[i];
      var node = root && root.querySelector ? root.querySelector(selector) : null;
      if (!node) continue;
      var text = String(node.textContent || "").trim();
      if (text) return text;
    }
    return "";
  }

  async function fetchXmlDoc(url) {
    var response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }

    var xmlText = await response.text();
    return new DOMParser().parseFromString(xmlText, "text/xml");
  }

  function parseUnitInfoBaseSpeeds(unitDoc) {
    var parsed = {};
    if (!unitDoc || !unitDoc.documentElement) return parsed;

    var root = unitDoc.documentElement;
    var children = root.children || [];

    for (var i = 0; i < children.length; i += 1) {
      var node = children[i];
      var key = String(node.tagName || "").toLowerCase();
      if (!key) continue;
      var speed = toNumber(readXmlText(node, "speed"));
      if (Number.isFinite(speed) && speed > 0) {
        parsed[key] = speed;
      }
    }

    return parsed;
  }

  async function loadSpeedModel(requiredUnits) {
    var base = Object.assign({}, UNIT_SPEED_FALLBACK);
    var worldSpeed = 1;
    var unitSpeed = 1;
    var source = "fallback";

    try {
      var docs = await Promise.all([
        fetchXmlDoc("/interface.php?func=get_config"),
        fetchXmlDoc("/interface.php?func=get_unit_info"),
      ]);

      var configDoc = docs[0];
      var unitDoc = docs[1];

      var ws = toNumber(readXmlText(configDoc, ["config > speed", "speed"]));
      var us = toNumber(readXmlText(configDoc, ["config > unit_speed", "unit_speed"]));

      if (Number.isFinite(ws) && ws > 0) worldSpeed = ws;
      if (Number.isFinite(us) && us > 0) unitSpeed = us;

      var parsedBase = parseUnitInfoBaseSpeeds(unitDoc);
      if (Object.keys(parsedBase).length) {
        base = Object.assign(base, parsedBase);
      }

      source = "live";
    } catch (error) {
      source = "fallback";
    }

    var factor = worldSpeed * unitSpeed;
    var effectiveMinutesPerField = {};

    requiredUnits.forEach(function (unit) {
      var baseMpf = Number(base[unit]);
      if (!Number.isFinite(baseMpf) || baseMpf <= 0) return;
      effectiveMinutesPerField[unit] = baseMpf / factor;
    });

    return {
      worldSpeed: worldSpeed,
      unitSpeed: unitSpeed,
      factor: factor,
      source: source,
      effectiveMinutesPerField: effectiveMinutesPerField,
    };
  }

  function getSlowestUnit(units, effectiveMinutesPerField) {
    var slowest = null;

    Object.keys(units).forEach(function (unit) {
      var count = Number(units[unit]) || 0;
      if (count <= 0) return;

      var mpf = Number(effectiveMinutesPerField[unit]);
      if (!Number.isFinite(mpf) || mpf <= 0) return;

      if (!slowest || mpf > slowest.minutesPerField) {
        slowest = {
          unit: unit,
          count: count,
          minutesPerField: mpf,
        };
      }
    });

    return slowest;
  }

  function ensurePanel() {
    var oldPanel = document.getElementById(PANEL_ID);
    if (oldPanel) {
      oldPanel.remove();
    }

    var panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.margin = "8px 0";
    panel.style.padding = "8px 10px";
    panel.style.border = "1px solid #b89d6a";
    panel.style.background = "#f8efd9";
    panel.style.fontSize = "12px";
    panel.style.lineHeight = "1.45";

    var table = document.querySelector("#command-data-form table.vis");
    if (table && table.parentNode) {
      table.parentNode.insertBefore(panel, table.nextSibling);
    } else {
      var form = document.getElementById("command-data-form") || document.body;
      form.appendChild(panel);
    }

    return panel;
  }

  function renderError(message) {
    var panel = ensurePanel();
    panel.innerHTML =
      '<div style="font-weight:700;margin-bottom:4px;">Sigil Analyzer</div>' +
      '<div style="color:#9a3c00;">' + message + "</div>";
  }

  function renderSuccess(data) {
    var panel = ensurePanel();

    var sigilText;
    if (data.sigilPercent < 0.1) {
      sigilText = "Сигил не обнаружен (≈ 0%).";
    } else {
      sigilText =
        Math.round(data.sigilPercent) + "% сигил работает на эту координату.";
    }

    panel.innerHTML =
      '<div style="font-weight:700;margin-bottom:4px;">Sigil Analyzer</div>' +
      '<div style="font-size:14px;font-weight:700;color:#2e4e1f;margin-bottom:5px;">' +
      sigilText +
      "</div>" +
      '<div><b>Маршрут:</b> ' +
      data.sourceCoord.text +
      " → " +
      data.targetCoord.text +
      " (" +
      data.distance.toFixed(3) +
      " поля)</div>" +
      '<div><b>Юниты в приказе:</b> ' +
      data.unitsText +
      "</div>" +
      '<div><b>Самая медленная юнита:</b> ' +
      (UNIT_LABELS[data.slowest.unit] || data.slowest.unit) +
      " (" +
      data.slowest.minutesPerField.toFixed(3) +
      " мин/поле)</div>" +
      '<div><b>Длительность:</b> база ' +
      formatSeconds(data.baseDurationSec) +
      " | факт " +
      formatSeconds(data.observedDurationSec) +
      "</div>" +
      '<div><b>Расчетный сигил:</b> ' +
      data.sigilPercent.toFixed(2) +
      "%</div>" +
      '<div style="opacity:.75;"><b>Скорости:</b> x' +
      data.speedModel.factor.toFixed(3) +
      " (world=" +
      data.speedModel.worldSpeed +
      ", unit=" +
      data.speedModel.unitSpeed +
      "), source=" +
      data.speedModel.source +
      "</div>";
  }

  async function run() {
    if (!isConfirmPage()) {
      return;
    }

    var sourceCoord = getSourceCoord();
    if (!sourceCoord) {
      renderError("Не удалось определить координаты своей деревни.");
      return;
    }

    var targetCoord = getTargetCoord();
    if (!targetCoord) {
      renderError("Не удалось определить координаты пункта назначения.");
      return;
    }

    var observedDurationSec = getDurationSeconds();
    if (!Number.isFinite(observedDurationSec) || observedDurationSec <= 0) {
      renderError("Не удалось прочитать строку «Длительность».");
      return;
    }

    var units = getSelectedUnits();
    var activeUnits = Object.keys(units).filter(function (unit) {
      return Number(units[unit]) > 0;
    });

    if (!activeUnits.length) {
      renderError("Не удалось определить состав отправляемых войск.");
      return;
    }

    var speedModel = await loadSpeedModel(activeUnits);
    var slowest = getSlowestUnit(units, speedModel.effectiveMinutesPerField);

    if (!slowest) {
      renderError("Не удалось вычислить скорость самой медленной юниты.");
      return;
    }

    var dx = targetCoord.x - sourceCoord.x;
    var dy = targetCoord.y - sourceCoord.y;
    var distance = Math.hypot(dx, dy);

    if (!Number.isFinite(distance) || distance <= 0) {
      renderError("Некорректная дистанция между деревнями.");
      return;
    }

    var baseDurationSec = distance * slowest.minutesPerField * 60;
    var sigilPercent = (baseDurationSec / observedDurationSec - 1) * 100;
    sigilPercent = Math.max(0, Math.min(100, sigilPercent));

    renderSuccess({
      sourceCoord: sourceCoord,
      targetCoord: targetCoord,
      observedDurationSec: observedDurationSec,
      baseDurationSec: baseDurationSec,
      sigilPercent: sigilPercent,
      distance: distance,
      unitsText: formatUnits(units),
      slowest: slowest,
      speedModel: speedModel,
    });
  }

  function bootstrap() {
    if (window[SCRIPT_ID]) {
      window[SCRIPT_ID].run();
      return;
    }

    window[SCRIPT_ID] = {
      run: run,
    };

    run();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();

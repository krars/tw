// ScriptMM combined overview highlighter.
// Colors rows on overview_villages&mode=combined by incoming threat/coverage state.
(function () {
  "use strict";

  const CONFIG = {
    autoRun: true,
    requestDelayMs: 320,
    maxInfoVillageRequests: 80,
    maxCommandDetailRequests: 160,
    unitsOverviewType: "complete",
    largeDefenseRequired: {
      1: 26000,
      2: 36000,
      3: 48000,
    },
    extraLargeDefenseStep: 12000,
    defenseHeavyWeight: 2,
    noDefenseBelow: 5000,
    greenSmallNobleSupport: 5000,
    greenOrangeNobleSupport: 15000,
  };

  const STATE = {
    running: false,
    villages: [],
    attacksByVillageId: new Map(),
    supportsByVillageId: new Map(),
    infoByVillageId: new Map(),
    results: [],
    commandDetailRequests: 0,
    unitsOverviewParsed: 0,
    unitsOverviewMatched: 0,
  };

  const STYLE_ID = "scriptmm-combined-highlight-style";
  const PANEL_ID = "scriptmm-combined-highlight-panel";
  const COLORS = {
    red: { label: "КРАСНЫЙ", className: "smm-threat-red" },
    blue: { label: "СИНИЙ", className: "smm-threat-blue" },
    green: { label: "ЗЕЛЕНЫЙ", className: "smm-threat-green" },
    purple: { label: "ФИОЛЕТ", className: "smm-threat-purple" },
  };
  const UNIT_RENDER_ORDER = [
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
  const IN_VILLAGE_LABEL_RE =
    /(?:^|\b)(?:в\s*деревн(?:е|и|у)?|дома|in\s*village|at\s*home|home)(?:\b|$)/i;

  function cleanText(value) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toInt(value) {
    const raw = String(value == null ? "" : value)
      .replace(/\s+/g, "")
      .replace(/[^\d-]/g, "");
    const num = Number(raw);
    return Number.isFinite(num) ? Math.trunc(num) : 0;
  }

  function parseCoord(value) {
    const match = cleanText(value).match(/(\d{1,3})\s*\|\s*(\d{1,3})/);
    return match ? `${match[1]}|${match[2]}` : "";
  }

  function getUrlParam(urlLike, key) {
    try {
      return cleanText(new URL(urlLike, location.origin).searchParams.get(key));
    } catch (error) {
      return "";
    }
  }

  function getCurrentVillageId() {
    return (
      cleanText(window.game_data && game_data.village && game_data.village.id) ||
      getUrlParam(location.href, "village")
    );
  }

  function buildGameUrl(params) {
    const url = new URL("/game.php", location.origin);
    const village = getCurrentVillageId();
    if (village) url.searchParams.set("village", village);
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, toInt(ms))));
  }

  async function fetchDocument(url) {
    await sleep(CONFIG.requestDelayMs);
    const response = await fetch(url, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
    const html = await response.text();
    if (/session-expired/i.test(response.url || "") || /session-expired/i.test(html)) {
      throw new Error("Сессия истекла. Обнови страницу игры.");
    }
    return new DOMParser().parseFromString(html, "text/html");
  }

  function baseDateMs() {
    const ms = Number(window.game_data && game_data.time_generated);
    return Number.isFinite(ms) && ms > 0 ? ms : Date.now();
  }

  function parseArrivalText(textRaw) {
    const text = cleanText(textRaw);
    if (!text) return null;

    const timeMatch = text.match(/(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?/);
    if (!timeMatch) return null;

    const base = new Date(baseDateMs());
    let year = base.getFullYear();
    let month = base.getMonth();
    let day = base.getDate();

    if (/завтра/i.test(text)) {
      const tomorrow = new Date(year, month, day + 1);
      year = tomorrow.getFullYear();
      month = tomorrow.getMonth();
      day = tomorrow.getDate();
    } else {
      const dateMatch = text.match(/(\d{1,2})\.(\d{1,2})\./);
      if (dateMatch) {
        day = Number(dateMatch[1]);
        month = Number(dateMatch[2]) - 1;
      }
    }

    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2]);
    const second = Number(timeMatch[3]);
    const ms = Number(String(timeMatch[4] || "0").padEnd(3, "0").slice(0, 3));
    let parsed = new Date(year, month, day, hour, minute, second, ms).getTime();

    if (!/(?:сегодня|завтра|\d{1,2}\.\d{1,2}\.)/i.test(text)) {
      const baseMs = baseDateMs();
      if (parsed < baseMs - 12 * 60 * 60 * 1000) {
        parsed = new Date(year, month, day + 1, hour, minute, second, ms).getTime();
      }
    }

    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseArrivalMsFromRow(row, arrivalCellIndex, timerCellIndex) {
    const timerCell = row.cells && row.cells[timerCellIndex] ? row.cells[timerCellIndex] : null;
    const endNode = timerCell ? timerCell.querySelector("[data-endtime]") : null;
    const endTime = Number(endNode ? endNode.getAttribute("data-endtime") : NaN);
    if (Number.isFinite(endTime) && endTime > 0) return endTime * 1000;

    const arrivalCell = row.cells && row.cells[arrivalCellIndex] ? row.cells[arrivalCellIndex] : null;
    return parseArrivalText(arrivalCell ? arrivalCell.textContent : "");
  }

  function parseUnitKeyFromIcon(srcRaw, titleRaw) {
    const src = String(srcRaw || "").toLowerCase();
    const title = cleanText(titleRaw).toLowerCase();
    const srcMatch = src.match(/unit_([a-z_]+)\.(?:png|webp|gif|jpg|jpeg)/i);
    if (srcMatch && srcMatch[1]) return srcMatch[1].toLowerCase();

    const byTitle = [
      ["spear", /копей/i],
      ["sword", /меч/i],
      ["axe", /топор/i],
      ["archer", /лучник/i],
      ["spy", /лазут|шпион/i],
      ["light", /легк|лёгк/i],
      ["marcher", /конн.*луч|к\.\s*луч|лучн.*кон/i],
      ["heavy", /тяж/i],
      ["ram", /таран/i],
      ["catapult", /катап/i],
      ["knight", /палад/i],
      ["snob", /двор/i],
      ["militia", /ополч/i],
    ];
    const found = byTitle.find(([, re]) => re.test(title));
    return found ? found[0] : "";
  }

  function getCommandSizeFromIconAndHints(iconSrcs, hints) {
    const source = `${iconSrcs.join(" ")} ${hints}`.toLowerCase();
    if (/attack_large|большой отряд|5000\+/i.test(source)) return "large";
    if (/attack_medium|средний отряд|1000-5000/i.test(source)) return "medium";
    if (/attack_small|небольшой отряд|1-1000|маленький|малый/i.test(source)) return "small";
    return "unknown";
  }

  function getCommandHints(firstCell) {
    return Array.from(firstCell ? firstCell.querySelectorAll("[title], [data-icon-hint]") : [])
      .map((node) => cleanText(node.getAttribute("data-icon-hint") || node.getAttribute("title")))
      .filter(Boolean)
      .join(" ");
  }

  function getDataCommandId(root) {
    const node = root ? root.querySelector("[data-command-id]") : null;
    return cleanText(node ? node.getAttribute("data-command-id") : "");
  }

  function hasNobleIconOrHint(iconSrcs, hints, text) {
    return (
      iconSrcs.some((src) => /(?:\/command\/snob|unit_snob|\/snob\.)/i.test(src)) ||
      /(?:дворян|двор|snob|noble)/i.test(`${hints} ${text}`)
    );
  }

  function planFlagsFromText(textRaw) {
    const text = cleanText(textRaw).toLowerCase();
    return {
      slice: /(?:срез|slice)/i.test(text),
      def: /(?:задеф|деф|def|подкреп|support)/i.test(text),
      intercept: /(?:перехват|intercept)/i.test(text),
    };
  }

  function mergePlanFlags(items) {
    return (items || []).reduce(
      (acc, item) => {
        const flags = item && item.planFlags ? item.planFlags : item || {};
        acc.slice = acc.slice || !!flags.slice;
        acc.def = acc.def || !!flags.def;
        acc.intercept = acc.intercept || !!flags.intercept;
        return acc;
      },
      { slice: false, def: false, intercept: false },
    );
  }

  function defenseScore(units) {
    const u = units || {};
    return (
      Math.max(0, toInt(u.spear)) +
      Math.max(0, toInt(u.sword)) +
      CONFIG.defenseHeavyWeight * Math.max(0, toInt(u.heavy))
    );
  }

  function offScore(units) {
    const u = units || {};
    return (
      Math.max(0, toInt(u.axe)) +
      4 * Math.max(0, toInt(u.light)) +
      5 * Math.max(0, toInt(u.ram)) +
      8 * Math.max(0, toInt(u.catapult))
    );
  }

  function requiredDefenseForLargeCount(countRaw) {
    const count = Math.max(0, toInt(countRaw));
    if (!count) return 0;
    if (CONFIG.largeDefenseRequired[count]) return CONFIG.largeDefenseRequired[count];
    return (
      CONFIG.largeDefenseRequired[3] +
      (count - 3) * Math.max(0, toInt(CONFIG.extraLargeDefenseStep))
    );
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#combined_table tr.smm-threat-red > td{background-color:rgba(255,55,55,.32)!important}
#combined_table tr.smm-threat-blue > td{background-color:rgba(60,135,255,.30)!important}
#combined_table tr.smm-threat-green > td{background-color:rgba(60,180,80,.28)!important}
#combined_table tr.smm-threat-purple > td{background-color:rgba(155,80,220,.30)!important}
.smm-threat-badge{display:inline-block;margin-left:5px;padding:1px 4px;border-radius:3px;color:#fff;font:bold 10px Verdana,Arial,sans-serif;vertical-align:middle}
.smm-threat-badge-red{background:#b92828}
.smm-threat-badge-blue{background:#2865bd}
.smm-threat-badge-green{background:#2b7d35}
.smm-threat-badge-purple{background:#7136a3}
#${PANEL_ID}{position:fixed;right:14px;top:62px;z-index:99999;width:360px;background:#f4e4bc;border:1px solid #7d510f;box-shadow:0 2px 12px rgba(0,0,0,.35);font:12px Verdana,Arial,sans-serif;color:#2f210f}
#${PANEL_ID} .smm-hl-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 9px;background:#c1a264;border-bottom:1px solid #7d510f;font-weight:700}
#${PANEL_ID} .smm-hl-body{padding:8px 9px}
#${PANEL_ID} .smm-hl-barbox{height:14px;background:#d7c59b;border:1px solid #7d510f;overflow:hidden;margin:7px 0}
#${PANEL_ID} .smm-hl-bar{width:0;height:100%;background:#2f8a3a;transition:width .2s ease}
#${PANEL_ID} button{cursor:pointer;border:1px solid #7d510f;background:#f7e9c8;color:#2f210f;font:12px Verdana,Arial,sans-serif;padding:2px 7px}
#${PANEL_ID} .smm-hl-stats{margin-top:6px;line-height:1.35;color:#533915}
`;
    document.head.appendChild(style);
  }

  const UI = {
    root: null,
    statusNode: null,
    barNode: null,
    statsNode: null,

    ensure() {
      injectStyle();
      if (this.root && document.body.contains(this.root)) return;
      const old = document.getElementById(PANEL_ID);
      if (old) old.remove();

      const root = document.createElement("div");
      root.id = PANEL_ID;
      root.innerHTML = `
<div class="smm-hl-head"><span>combined_highlight.js</span><button type="button" data-role="rerun">Пересчитать</button></div>
<div class="smm-hl-body">
  <div data-role="status">Готовлюсь...</div>
  <div class="smm-hl-barbox"><div class="smm-hl-bar" data-role="bar"></div></div>
  <div class="smm-hl-stats" data-role="stats"></div>
</div>`;
      document.body.appendChild(root);
      this.root = root;
      this.statusNode = root.querySelector("[data-role='status']");
      this.barNode = root.querySelector("[data-role='bar']");
      this.statsNode = root.querySelector("[data-role='stats']");
      root.querySelector("[data-role='rerun']").addEventListener("click", () => run());
    },

    status(text) {
      this.ensure();
      if (this.statusNode) this.statusNode.textContent = cleanText(text);
    },

    progress(done, total) {
      this.ensure();
      const safeTotal = Math.max(1, toInt(total));
      const percent = Math.max(0, Math.min(100, Math.round((toInt(done) / safeTotal) * 100)));
      if (this.barNode) this.barNode.style.width = `${percent}%`;
    },

    stats(htmlText) {
      this.ensure();
      if (this.statsNode) this.statsNode.innerHTML = htmlText;
    },
  };

  function parseCombinedRows(doc) {
    const table = doc.querySelector("#combined_table");
    if (!table) return [];

    return Array.from(
      table.querySelectorAll("tr.row_a, tr.row_b, tr.row_ax, tr.row_bx"),
    )
      .map((row) => {
        const quick = row.querySelector(".quickedit-vn[data-id]");
        const villageId = cleanText(quick ? quick.getAttribute("data-id") : "");
        const labelNode = row.querySelector(".quickedit-label");
        const label = cleanText(labelNode ? labelNode.textContent : row.textContent);
        const coord = parseCoord(label || row.textContent);
        if (!villageId || !coord) return null;

        return {
          row,
          villageId,
          coord,
          label,
          units: {},
          defenseScore: 0,
          troopsSource: "pending_units_overview",
        };
      })
      .filter(Boolean);
  }

  function uniqueUnits(units) {
    const seen = new Set();
    return (units || [])
      .map((unit) => cleanText(unit).toLowerCase())
      .filter((unit) => {
        if (!unit || seen.has(unit)) return false;
        seen.add(unit);
        return true;
      });
  }

  function getWorldUnitOrder() {
    const gameUnits =
      window.game_data && Array.isArray(window.game_data.units) ? window.game_data.units : [];
    return uniqueUnits(gameUnits.length ? gameUnits : UNIT_RENDER_ORDER);
  }

  function parseUnitsHeaderOrder(table) {
    const rows = Array.from(table ? table.querySelectorAll("tr") : []);
    const headerRow = rows.find((row) => row.querySelector("th img[src*='unit_'], th img[src*='/unit/']"));
    if (!headerRow) return getWorldUnitOrder();

    const units = Array.from(headerRow.children || [])
      .map((cell) => {
        const img = cell.querySelector("img[src]");
        return parseUnitKeyFromIcon(
          img ? img.getAttribute("src") : "",
          img ? img.getAttribute("title") || img.getAttribute("alt") : cell.textContent,
        );
      })
      .filter(Boolean);
    return uniqueUnits(units.length ? units : getWorldUnitOrder());
  }

  function chooseUnitOrderForCells(cellCountRaw, headerOrder) {
    const cellCount = Math.max(0, toInt(cellCountRaw));
    const worldOrder = getWorldUnitOrder();
    const candidates = [
      uniqueUnits(headerOrder),
      worldOrder,
      uniqueUnits(UNIT_RENDER_ORDER),
    ].filter((items) => items.length);

    const exact = candidates.find((items) => items.length === cellCount);
    if (exact) return exact;
    const longEnough = candidates.find((items) => items.length >= cellCount);
    if (longEnough) return longEnough.slice(0, cellCount);
    return candidates[0] || [];
  }

  function parseUnitsFromUnitsOverviewRow(row, headerOrder) {
    const units = {};
    getWorldUnitOrder().forEach((unit) => {
      units[unit] = 0;
    });

    const cells = Array.from(row ? row.querySelectorAll("td.unit-item, th.unit-item") : []);
    const unitOrder = chooseUnitOrderForCells(cells.length, headerOrder);
    cells.forEach((cell, index) => {
      const unit = unitOrder[index];
      if (!unit) return;
      units[unit] = Math.max(0, toInt(cell.getAttribute("data-unit-count")) || toInt(cell.textContent));
    });

    if (Object.prototype.hasOwnProperty.call(units, "knight")) {
      units.knight = Math.min(1, Math.max(0, toInt(units.knight)));
    }
    return units;
  }

  function rowHasLabel(row, re) {
    return Array.from((row && row.children) || []).some((cell) => re.test(cleanText(cell.textContent)));
  }

  function parseVillageIdentityFromRows(rows) {
    let villageId = "";
    let coord = "";
    let label = "";

    (rows || []).forEach((row) => {
      if (!label) label = cleanText(row.textContent);
      if (!coord) coord = parseCoord(row.textContent);
      if (villageId) return;

      const idNode = row.querySelector(
        ".quickedit-vn[data-id], .quickedit-label[data-id], [data-village-id]",
      );
      if (idNode) {
        villageId =
          cleanText(idNode.getAttribute("data-id")) ||
          cleanText(idNode.getAttribute("data-village-id"));
      }
      if (villageId) return;

      const link = row.querySelector(
        "a[href*='screen=overview'], a[href*='screen=info_village'], a[href*='screen=place']",
      );
      if (link) {
        villageId =
          getUrlParam(link.getAttribute("href"), "village") ||
          getUrlParam(link.getAttribute("href"), "id");
      }
    });

    return { villageId, coord, label };
  }

  function parseUnitsOverviewInVillage(doc) {
    const table = doc.querySelector("#units_table");
    const byVillageId = new Map();
    const byCoord = new Map();
    const items = [];
    if (!table) return { byVillageId, byCoord, items, error: "missing_units_table" };

    const headerOrder = parseUnitsHeaderOrder(table);
    const pushItem = (item) => {
      if (!item || (!item.villageId && !item.coord)) return;
      items.push(item);
      if (item.villageId) byVillageId.set(item.villageId, item);
      if (item.coord) byCoord.set(item.coord, item);
    };

    const blocks = Array.from(table.querySelectorAll("tbody.row_marker"));
    if (blocks.length) {
      blocks.forEach((block) => {
        const rows = Array.from(block.querySelectorAll("tr")).filter((row) => row.querySelector("td"));
        const identity = parseVillageIdentityFromRows(rows);
        const sourceRow = rows.find((row) => rowHasLabel(row, IN_VILLAGE_LABEL_RE));
        if (!sourceRow) return;
        const units = parseUnitsFromUnitsOverviewRow(sourceRow, headerOrder);
        pushItem({
          villageId: identity.villageId,
          coord: identity.coord,
          label: identity.label,
          units,
          defenseScore: defenseScore(units),
          troopsSource: "in_village_row",
        });
      });
    } else {
      Array.from(table.querySelectorAll("tr"))
        .filter((row) => row.querySelector("td") && rowHasLabel(row, IN_VILLAGE_LABEL_RE))
        .forEach((row) => {
          const identity = parseVillageIdentityFromRows([row]);
          const units = parseUnitsFromUnitsOverviewRow(row, headerOrder);
          pushItem({
            villageId: identity.villageId,
            coord: identity.coord,
            label: identity.label,
            units,
            defenseScore: defenseScore(units),
            troopsSource: "in_village_row",
          });
        });
    }

    return { byVillageId, byCoord, items };
  }

  function attachUnitsOverviewToCombinedRows(villages, unitsOverview) {
    let matched = 0;
    (villages || []).forEach((village) => {
      const item =
        unitsOverview.byVillageId.get(village.villageId) ||
        unitsOverview.byCoord.get(village.coord);
      if (!item) {
        village.units = {};
        village.defenseScore = 0;
        village.troopsSource = "missing_units_overview";
        return;
      }
      matched += 1;
      village.units = item.units || {};
      village.defenseScore = Math.max(0, toInt(item.defenseScore));
      village.troopsSource = item.troopsSource || "in_village_row";
    });
    return matched;
  }

  function parseIncomingAttacks(doc) {
    return Array.from(
      doc.querySelectorAll("#incomings_table tr.row_a, #incomings_table tr.row_b"),
    )
      .map((row) => {
        const firstCell = row.cells && row.cells[0] ? row.cells[0] : row;
        const targetCell = row.cells && row.cells[1] ? row.cells[1] : null;
        const originCell = row.cells && row.cells[2] ? row.cells[2] : null;
        const playerCell = row.cells && row.cells[3] ? row.cells[3] : null;
        const targetLink = targetCell
          ? targetCell.querySelector("a[href*='screen=overview'], a[href*='screen=info_village']")
          : null;
        const commandLink = firstCell.querySelector("a[href*='screen=info_command']");
        const href = cleanText(commandLink ? commandLink.getAttribute("href") : "");
        const iconSrcs = Array.from(firstCell.querySelectorAll("img[src]")).map((img) =>
          cleanText(img.getAttribute("src")),
        );
        const hints = getCommandHints(firstCell);
        const label = cleanText(
          (firstCell.querySelector(".quickedit-label") || {}).textContent || firstCell.textContent,
        );
        const targetText = cleanText(targetCell ? targetCell.textContent : "");
        const targetVillageId =
          (targetLink && getUrlParam(targetLink.getAttribute("href"), "village")) ||
          (targetLink && getUrlParam(targetLink.getAttribute("href"), "id"));
        const coord = parseCoord(targetText);
        if (!targetVillageId || !coord) return null;

        return {
          commandId: getUrlParam(href, "id") || getDataCommandId(firstCell),
          commandUrl: href ? new URL(href, location.origin).toString() : "",
          targetVillageId,
          targetCoord: coord,
          originCoord: parseCoord(originCell ? originCell.textContent : ""),
          player: cleanText(playerCell ? playerCell.textContent : ""),
          label,
          sizeClass: getCommandSizeFromIconAndHints(iconSrcs, hints),
          isNoble: hasNobleIconOrHint(iconSrcs, hints, label),
          arrivalMs: parseArrivalMsFromRow(row, 5, 6),
          planFlags: planFlagsFromText(label),
          rawText: cleanText(row.textContent),
        };
      })
      .filter(Boolean);
  }

  function parseIncomingSupports(doc) {
    return Array.from(
      doc.querySelectorAll("#incomings_table tr.row_a, #incomings_table tr.row_b"),
    )
      .map((row) => {
        const firstCell = row.cells && row.cells[0] ? row.cells[0] : row;
        const targetCell = row.cells && row.cells[1] ? row.cells[1] : null;
        const targetLink = targetCell
          ? targetCell.querySelector("a[href*='screen=overview'], a[href*='screen=info_village']")
          : null;
        const commandLink = firstCell.querySelector("a[href*='screen=info_command']");
        const href = cleanText(commandLink ? commandLink.getAttribute("href") : "");
        const targetVillageId =
          (targetLink && getUrlParam(targetLink.getAttribute("href"), "village")) ||
          (targetLink && getUrlParam(targetLink.getAttribute("href"), "id"));
        const coord = parseCoord(targetCell ? targetCell.textContent : "");
        if (!targetVillageId || !coord) return null;
        return {
          commandId: getUrlParam(href, "id"),
          commandUrl: href ? new URL(href, location.origin).toString() : "",
          targetVillageId,
          targetCoord: coord,
          arrivalMs: parseArrivalMsFromRow(row, 5, 6),
          label: cleanText((firstCell.querySelector(".quickedit-label") || {}).textContent || firstCell.textContent),
          units: {},
          defenseScore: 0,
          planFlags: { def: true, slice: false, intercept: false },
        };
      })
      .filter(Boolean);
  }

  function groupBy(items, keyName) {
    const map = new Map();
    (items || []).forEach((item) => {
      const key = cleanText(item && item[keyName]);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    });
    return map;
  }

  function parseUnitsFromInfoCommandDoc(doc) {
    const units = {};
    Array.from(doc.querySelectorAll("td.unit-item, th.unit-item")).forEach((cell) => {
      const className = cleanText(cell.getAttribute("class"));
      const match = className.match(/\bunit-item-([a-z_]+)\b/i);
      if (!match || !match[1]) return;
      const unit = String(match[1]).toLowerCase();
      if (!unit || unit === "militia") return;
      const count = Math.max(
        0,
        toInt(cell.getAttribute("data-unit-count")) || toInt(cell.textContent),
      );
      if (!count) return;
      units[unit] = Math.max(0, toInt(units[unit])) + count;
    });
    return units;
  }

  async function enrichCommandUnits(command) {
    if (!command || !command.commandUrl || STATE.commandDetailRequests >= CONFIG.maxCommandDetailRequests) {
      return command;
    }
    STATE.commandDetailRequests += 1;
    try {
      const doc = await fetchDocument(command.commandUrl);
      const units = parseUnitsFromInfoCommandDoc(doc);
      command.units = units;
      command.defenseScore = defenseScore(units);
      command.offScore = offScore(units);
      command.snobCount = Math.max(toInt(command.snobCount), toInt(units.snob));
    } catch (error) {
      command.detailError = cleanText(error && error.message);
    }
    return command;
  }

  function parseInfoVillageCommands(doc) {
    const rows = Array.from(
      doc.querySelectorAll("#commands_outgoings tr.command-row, .commands-container[data-type='towards_village'] tr.command-row"),
    );
    return rows
      .map((row) => {
        const firstCell = row.cells && row.cells[0] ? row.cells[0] : row;
        const commandLink = firstCell.querySelector("a[href*='screen=info_command']");
        const href = cleanText(commandLink ? commandLink.getAttribute("href") : "");
        const iconSrcs = Array.from(firstCell.querySelectorAll("img[src]")).map((img) =>
          cleanText(img.getAttribute("src")),
        );
        const hints = getCommandHints(firstCell);
        const label = cleanText(
          (firstCell.querySelector(".quickedit-label") || {}).textContent || firstCell.textContent,
        );
        const typeHints = Array.from(firstCell.querySelectorAll("[data-command-type]"))
          .map((node) => cleanText(node.getAttribute("data-command-type")))
          .join(" ");
        const allText = `${label} ${hints} ${typeHints}`;
        const isSupport = /(?:support|подкреп|поддерж)/i.test(allText) || iconSrcs.some((src) => /\/support\./i.test(src));
        const isAttack = /(?:attack|атака)/i.test(allText) || iconSrcs.some((src) => /attack_/i.test(src));
        const isAlly = !!firstCell.querySelector(".commandicon-ally");
        const isOwn = !isAlly || !!row.querySelector(".command-cancel");
        const isNoble = hasNobleIconOrHint(iconSrcs, hints, label);
        return {
          commandId: getUrlParam(href, "id") || getDataCommandId(firstCell),
          commandUrl: href ? new URL(href, location.origin).toString() : "",
          label,
          isSupport,
          isAttack,
          isAlly,
          isOwn,
          isNoble,
          sizeClass: getCommandSizeFromIconAndHints(iconSrcs, hints),
          arrivalMs: parseArrivalMsFromRow(row, 1, 2),
          planFlags: planFlagsFromText(label),
          units: {},
          defenseScore: 0,
          offScore: 0,
          snobCount: isNoble ? 1 : 0,
        };
      })
      .filter((command) => command.commandUrl || command.label);
  }

  function supportDefenseBefore(items, limitMs) {
    const list = Array.isArray(items) ? items : [];
    return list
      .filter((item) => {
        if (!Number.isFinite(limitMs)) return true;
        if (!Number.isFinite(Number(item.arrivalMs))) return true;
        return Number(item.arrivalMs) <= limitMs;
      })
      .reduce((sum, item) => sum + Math.max(0, toInt(item.defenseScore)), 0);
  }

  function supportCountBefore(items, limitMs) {
    const list = Array.isArray(items) ? items : [];
    return list.filter((item) => {
      if (!Number.isFinite(limitMs)) return true;
      if (!Number.isFinite(Number(item.arrivalMs))) return true;
      return Number(item.arrivalMs) <= limitMs;
    }).length;
  }

  function minArrival(items) {
    const values = (items || [])
      .map((item) => Number(item.arrivalMs))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.min.apply(null, values) : null;
  }

  function maxArrival(items) {
    const values = (items || [])
      .map((item) => Number(item.arrivalMs))
      .filter((value) => Number.isFinite(value));
    return values.length ? Math.max.apply(null, values) : null;
  }

  function analyzeVillage(village) {
    const attacks = STATE.attacksByVillageId.get(village.villageId) || [];
    const supports = STATE.supportsByVillageId.get(village.villageId) || [];
    const info = STATE.infoByVillageId.get(village.villageId) || { commands: [] };
    const ownCommands = info.commands || [];

    const largeAttacks = attacks.filter((attack) => attack.sizeClass === "large");
    const mediumAttacks = attacks.filter((attack) => attack.sizeClass === "medium");
    const nobleAttacks = attacks.filter((attack) => attack.isNoble);
    const threatAttacks = attacks.filter(
      (attack) => attack.isNoble || attack.sizeClass === "large" || attack.sizeClass === "medium",
    );

    const firstLargeMs = minArrival(largeAttacks);
    const firstNobleMs = minArrival(nobleAttacks);
    const firstCriticalMs = minArrival(largeAttacks.concat(nobleAttacks));
    const firstThreatMs = minArrival(threatAttacks);
    const lastThreatMs = maxArrival(threatAttacks);
    const supportItems = supports.concat(ownCommands.filter((command) => command.isSupport));
    const supportBeforeFirstThreat = supportDefenseBefore(supportItems, firstThreatMs);
    const supportBeforeFirstLarge = supportDefenseBefore(supportItems, firstLargeMs);
    const supportBeforeFirstNoble = supportDefenseBefore(supportItems, firstNobleMs);
    const supportBeforeCritical = supportDefenseBefore(supportItems, firstCriticalMs);
    const supportCountBeforeFirstThreat = supportCountBefore(supportItems, firstThreatMs);
    const supportCountBeforeCritical = supportCountBefore(supportItems, firstCriticalMs);

    const required = requiredDefenseForLargeCount(largeAttacks.length);
    const availableForCritical = village.defenseScore + supportBeforeCritical;
    const blue = largeAttacks.length > 0 && required > 0 && availableForCritical >= required;

    const firstNoble = nobleAttacks
      .slice()
      .sort((a, b) => (Number(a.arrivalMs) || 0) - (Number(b.arrivalMs) || 0))[0];
    const nobleSupportRequired =
      firstNoble && firstNoble.sizeClass === "small"
        ? CONFIG.greenSmallNobleSupport
        : CONFIG.greenOrangeNobleSupport;
    const lowCurrentDefense = village.defenseScore < CONFIG.noDefenseBelow;
    const green =
      !blue &&
      !!firstNoble &&
      lowCurrentDefense &&
      supportBeforeFirstNoble >= nobleSupportRequired;

    const commandsAfterThreat = ownCommands.filter((command) => {
      if (!command.isAttack) return false;
      if (!Number.isFinite(lastThreatMs) || !Number.isFinite(Number(command.arrivalMs))) return true;
      return Number(command.arrivalMs) >= lastThreatMs;
    });
    const mediumOrLargeOwnOff = commandsAfterThreat.some(
      (command) =>
        command.sizeClass === "medium" ||
        command.sizeClass === "large" ||
        /(?:офф|рыж|оранж|orange)/i.test(command.label) ||
        Math.max(0, toInt(command.offScore)) >= 1000,
    );
    const ownNoblesAfterThreat = commandsAfterThreat.reduce(
      (sum, command) => sum + Math.max(0, toInt(command.snobCount) || (command.isNoble ? 1 : 0)),
      0,
    );
    const purple = mediumOrLargeOwnOff && ownNoblesAfterThreat >= 2;

    const planFlags = mergePlanFlags(
      attacks
        .map((attack) => attack.planFlags)
        .concat(ownCommands.map((command) => command.planFlags)),
    );
    const hasExplicitCoverage =
      planFlags.slice ||
      planFlags.def ||
      planFlags.intercept ||
      purple ||
      green ||
      blue;

    const red =
      !purple &&
      !blue &&
      !green &&
      largeAttacks.length > 0 &&
      nobleAttacks.length > 0 &&
      !hasExplicitCoverage;

    let color = "";
    let reason = "";
    if (purple) {
      color = "purple";
      reason = `за угрозой идет свой/союзный офф + дворяне (${ownNoblesAfterThreat})`;
    } else if (blue) {
      color = "blue";
      reason = `дефф ${availableForCritical}/${required} выдерживает ${largeAttacks.length} большой отряд`;
    } else if (green) {
      color = "green";
      reason = `нет основного деффа, но подкрепы до двора ${supportBeforeFirstNoble}/${nobleSupportRequired}`;
    } else if (red) {
      color = "red";
      reason = "большой офф + дворяне без среза/задефа/перехвата";
    }

    return {
      village,
      color,
      reason,
      attacks,
      supports: supportItems,
      large: largeAttacks.length,
      medium: mediumAttacks.length,
      nobles: nobleAttacks.length,
      currentDefense: village.defenseScore,
      supportBeforeFirstThreat,
      supportCountBeforeFirstThreat,
      supportBeforeFirstLarge,
      supportBeforeFirstNoble,
      supportBeforeCritical,
      supportCountBeforeCritical,
      required,
      availableForCritical,
      ownNoblesAfterThreat,
      planFlags,
    };
  }

  function clearRow(row) {
    Object.values(COLORS).forEach((item) => row.classList.remove(item.className));
    row.querySelectorAll(".smm-threat-badge").forEach((node) => node.remove());
    row.removeAttribute("data-smm-threat-color");
  }

  function applyAnalysis(result) {
    const row = result.village.row;
    clearRow(row);
    if (!result.color || !COLORS[result.color]) return;
    const color = COLORS[result.color];
    row.classList.add(color.className);
    row.setAttribute("data-smm-threat-color", result.color);
    row.title = [
      result.reason,
      `больших: ${result.large}`,
      `средних: ${result.medium}`,
      `дворов: ${result.nobles}`,
      `дефф в деревне: ${result.currentDefense}`,
      `успевает до двора/большого: ${result.supportBeforeCritical} (${result.supportCountBeforeCritical} шт.)`,
      `сумма деффа: ${result.availableForCritical}/${result.required || 0}`,
      `источник войск: ${result.village.troopsSource}`,
      `подкреп до первой угрозы: ${result.supportBeforeFirstThreat} (${result.supportCountBeforeFirstThreat} шт.)`,
    ].join(" | ");

    const villageCell = row.cells && row.cells[1] ? row.cells[1] : row.querySelector("td");
    if (villageCell) {
      const badge = document.createElement("span");
      badge.className = `smm-threat-badge smm-threat-badge-${result.color}`;
      badge.textContent = color.label;
      villageCell.appendChild(badge);
    }
  }

  function renderStats(results) {
    const counts = results.reduce(
      (acc, result) => {
        if (result.color) acc[result.color] = (acc[result.color] || 0) + 1;
        return acc;
      },
      { red: 0, blue: 0, green: 0, purple: 0 },
    );
    const attacked = results.filter((result) => result.attacks.length > 0).length;
    UI.stats(
      [
        `Деревень: ${results.length}, под атаками: ${attacked}`,
        `Войска "в деревне": ${STATE.unitsOverviewMatched}/${STATE.villages.length} (строк: ${STATE.unitsOverviewParsed})`,
        `Красный: ${counts.red || 0}, Синий: ${counts.blue || 0}, Зеленый: ${counts.green || 0}, Фиолет: ${counts.purple || 0}`,
        `Детали приказов: ${STATE.commandDetailRequests}/${CONFIG.maxCommandDetailRequests}`,
      ].join("<br>"),
    );
  }

  async function enrichSupportsWithUnits(supports) {
    for (let index = 0; index < supports.length; index += 1) {
      UI.status(`Подкрепления: читаю размер ${index + 1}/${supports.length}`);
      UI.progress(index, supports.length);
      await enrichCommandUnits(supports[index]);
    }
  }

  async function loadInfoForThreatVillages(villages) {
    const targets = villages
      .filter((village) => (STATE.attacksByVillageId.get(village.villageId) || []).length)
      .slice(0, CONFIG.maxInfoVillageRequests);

    for (let index = 0; index < targets.length; index += 1) {
      const village = targets[index];
      UI.status(`Деревня ${village.coord}: свои/союзные приказы ${index + 1}/${targets.length}`);
      UI.progress(index, targets.length);
      try {
        const doc = await fetchDocument(
          buildGameUrl({ screen: "info_village", id: village.villageId }),
        );
        const commands = parseInfoVillageCommands(doc);
        for (let c = 0; c < commands.length; c += 1) {
          const command = commands[c];
          if (
            command.isSupport ||
            command.isNoble ||
            command.sizeClass === "medium" ||
            command.sizeClass === "large" ||
            command.planFlags.slice ||
            command.planFlags.def ||
            command.planFlags.intercept
          ) {
            await enrichCommandUnits(command);
          }
        }
        STATE.infoByVillageId.set(village.villageId, { commands });
      } catch (error) {
        STATE.infoByVillageId.set(village.villageId, {
          commands: [],
          error: cleanText(error && error.message),
        });
      }
    }
    UI.progress(targets.length, targets.length || 1);
  }

  async function run() {
    if (STATE.running) return;
    STATE.running = true;
    STATE.commandDetailRequests = 0;
    STATE.unitsOverviewParsed = 0;
    STATE.unitsOverviewMatched = 0;
    UI.ensure();
    if (UI.barNode) UI.barNode.style.background = "#2f8a3a";
    UI.status("Читаю комбинированный обзор...");
    UI.progress(0, 1);

    try {
      const villages = parseCombinedRows(document);
      STATE.villages = villages;
      if (!villages.length) {
        throw new Error("Не нашел #combined_table. Открой комбинированный обзор с page=-1.");
      }
      villages.forEach((village) => clearRow(village.row));

      UI.status("Загружаю войска в деревнях...");
      UI.progress(0, 4);
      const unitsDoc = await fetchDocument(
        buildGameUrl({
          screen: "overview_villages",
          mode: "units",
          type: CONFIG.unitsOverviewType,
          group: 0,
          page: -1,
        }),
      );
      const unitsOverview = parseUnitsOverviewInVillage(unitsDoc);
      STATE.unitsOverviewParsed = unitsOverview.items.length;
      STATE.unitsOverviewMatched = attachUnitsOverviewToCombinedRows(villages, unitsOverview);
      UI.stats(
        `Комбинированный обзор: ${villages.length}<br>Войска "в деревне": ${STATE.unitsOverviewMatched}/${villages.length}`,
      );

      UI.status("Загружаю входящие атаки...");
      UI.progress(1, 4);
      const attacksDoc = await fetchDocument(
        buildGameUrl({
          screen: "overview_villages",
          mode: "incomings",
          type: "unignored",
          subtype: "attacks",
          page: -1,
        }),
      );
      const attacks = parseIncomingAttacks(attacksDoc);
      STATE.attacksByVillageId = groupBy(attacks, "targetVillageId");

      UI.status("Загружаю входящие подкрепления...");
      UI.progress(2, 4);
      const supportsDoc = await fetchDocument(
        buildGameUrl({
          screen: "overview_villages",
          mode: "incomings",
          type: "unignored",
          subtype: "supports",
          page: -1,
        }),
      );
      const supports = parseIncomingSupports(supportsDoc);
      await enrichSupportsWithUnits(supports);
      STATE.supportsByVillageId = groupBy(supports, "targetVillageId");

      UI.status("Проверяю атакованные деревни...");
      UI.progress(3, 4);
      STATE.infoByVillageId = new Map();
      await loadInfoForThreatVillages(villages);

      UI.status("Крашу строки...");
      const results = villages.map((village) => analyzeVillage(village));
      results.forEach(applyAnalysis);
      STATE.results = results;
      renderStats(results);
      UI.status("Готово.");
      UI.progress(1, 1);
      console.table(
        results
          .filter((result) => result.color)
          .map((result) => ({
            color: result.color,
            village: result.village.label,
            def_in_village: result.currentDefense,
            troopsSource: result.village.troopsSource,
            support_before_noble_or_large: result.supportBeforeCritical,
            total_def: result.availableForCritical,
            required: result.required,
            large: result.large,
            medium: result.medium,
            nobles: result.nobles,
            reason: result.reason,
          })),
      );
    } catch (error) {
      UI.status(`Ошибка: ${cleanText(error && error.message)}`);
      if (UI.barNode) UI.barNode.style.background = "#b33";
      console.error("[combined_highlight]", error);
    } finally {
      STATE.running = false;
    }
  }

  window.ScriptMMCombinedHighlight = {
    config: CONFIG,
    state: STATE,
    run,
    parseCombinedRows,
    parseUnitsOverviewInVillage,
    parseIncomingAttacks,
    parseIncomingSupports,
  };

  if (CONFIG.autoRun) run();
})();

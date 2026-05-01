// ScriptMM groups helper for Tribal Wars / Vojna Plemyon.
// Finds own villages with noble-marked incoming attacks, adds them to FOCUS,
// and adds low-population targets to the intercept group.
(function () {
  "use strict";

  var CONFIG = {
    dryRun: true,
    focusGroupId: null,
    interceptGroupId: null,
    focusGroupNames: ["FOCUS"],
    interceptGroupNames: ["перезват", "перехват", "Перехват"],
    populationThreshold: 7000,
    incomingType: "unignored",
    incomingSubtype: "attacks",
    requestDelayMs: 700,
    fallbackToVillageAssignment: true,
  };

  var LOG_PREFIX = "[groups.js]";

  function cleanText(value) {
    return String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeName(value) {
    return cleanText(value).toLowerCase().replace(/ё/g, "е");
  }

  function toInt(value) {
    var match = String(value == null ? "" : value).replace(/\s+/g, "").match(/-?\d+/);
    return match ? Number(match[0]) : null;
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function getUrlParam(url, key) {
    try {
      return new URL(url, location.origin).searchParams.get(key);
    } catch (error) {
      return null;
    }
  }

  function buildGameUrl(screen, params) {
    if (window.TribalWars && typeof TribalWars.buildURL === "function") {
      return TribalWars.buildURL("GET", screen, params || {});
    }

    var url = new URL("/game.php", location.origin);
    var villageId =
      (window.game_data && game_data.village && game_data.village.id) ||
      getUrlParam(location.href, "village");
    if (villageId) url.searchParams.set("village", villageId);
    url.searchParams.set("screen", screen);
    Object.keys(params || {}).forEach(function (key) {
      if (params[key] !== undefined && params[key] !== null) {
        url.searchParams.set(key, params[key]);
      }
    });
    return url.pathname + url.search;
  }

  async function fetchDocument(url) {
    var response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    var html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  async function fetchJson(url) {
    var response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json, text/javascript, */*; q=0.01" },
    });
    if (!response.ok) {
      throw new Error("HTTP " + response.status + " for " + url);
    }
    return JSON.parse(await response.text());
  }

  function parseCoord(text) {
    var match = String(text || "").match(/(\d{1,3})\|(\d{1,3})/);
    return match ? match[1] + "|" + match[2] : null;
  }

  function isNobleIconSrc(src) {
    return /(?:\/command\/snob|\/unit\/(?:tiny\/)?snob|unit_snob)\.(?:webp|png|gif|jpg|jpeg)/i.test(
      String(src || ""),
    );
  }

  function isNobleIncomingRow(row) {
    var firstCell = row.querySelector("td");
    var label = cleanText(
      (row.querySelector(".quickedit-label") || {}).textContent || "",
    );
    var iconOrTooltipText = cleanText(
      Array.prototype.map
        .call(firstCell ? firstCell.querySelectorAll("[title], [data-command-id], img[src]") : [], function (node) {
          return [
            node.getAttribute("title") || "",
            node.getAttribute("alt") || "",
            node.getAttribute("src") || "",
            node.tooltipText || "",
          ].join(" ");
        })
        .join(" "),
    );
    var rowText = cleanText(label + " " + iconOrTooltipText);

    if (/(?:двор|дворян|snob|noble)/i.test(rowText)) return true;

    return Array.prototype.some.call(
      firstCell ? firstCell.querySelectorAll("img[src]") : [],
      function (img) {
        return isNobleIconSrc(img.getAttribute("src"));
      },
    );
  }

  function parseIncomingTargets(doc) {
    var rows = Array.prototype.slice.call(
      doc.querySelectorAll("#incomings_table tr.row_a, #incomings_table tr.row_b"),
    );
    var targetsById = new Map();

    rows.forEach(function (row) {
      if (!isNobleIncomingRow(row)) return;

      var commandInput = row.querySelector("input[name^='command_ids[']");
      var commandIdMatch = commandInput
        ? String(commandInput.getAttribute("name") || "").match(/\[(\d+)\]/)
        : null;
      var commandId = commandIdMatch ? commandIdMatch[1] : null;

      var targetCell = row.cells && row.cells.length > 1 ? row.cells[1] : null;
      var targetAnchor = targetCell
        ? targetCell.querySelector("a[href*='screen=overview'], a[href*='screen=info_village']")
        : null;
      var targetText = cleanText(
        (targetAnchor && targetAnchor.textContent) ||
          (targetCell && targetCell.textContent) ||
          "",
      );
      var villageId =
        (targetAnchor && getUrlParam(targetAnchor.href, "village")) ||
        (targetAnchor && getUrlParam(targetAnchor.href, "id")) ||
        null;
      var coord = parseCoord(targetText);

      if (!villageId || !coord) return;

      var existing = targetsById.get(String(villageId)) || {
        villageId: String(villageId),
        coord: coord,
        name: targetText,
        commandIds: [],
        labels: [],
      };
      if (commandId) existing.commandIds.push(String(commandId));
      var label = cleanText((row.querySelector(".quickedit-label") || {}).textContent || "");
      if (label) existing.labels.push(label);
      targetsById.set(String(villageId), existing);
    });

    return Array.from(targetsById.values()).sort(function (a, b) {
      return Number(a.villageId) - Number(b.villageId);
    });
  }

  function parseVillagePopulation(doc) {
    var result = new Map();
    var rows = Array.prototype.slice.call(doc.querySelectorAll("tr.nowrap"));

    rows.forEach(function (row) {
      var quickedit = row.querySelector(".quickedit-vn[data-id], .quickedit-label[data-id]");
      var villageId = quickedit ? quickedit.getAttribute("data-id") : null;
      if (!villageId) {
        var villageAnchor = row.querySelector("a[href*='screen=overview']");
        villageId = villageAnchor ? getUrlParam(villageAnchor.href, "village") : null;
      }
      if (!villageId) return;

      var nameNode = row.querySelector(".quickedit-label");
      var name = cleanText(nameNode ? nameNode.textContent : row.cells[1] && row.cells[1].textContent);
      var coord = parseCoord(name || row.textContent);
      var farmLink = row.querySelector("a[href*='screen=farm']");
      var pop = farmLink ? toInt(farmLink.textContent) : null;
      if (!Number.isFinite(pop)) return;

      result.set(String(villageId), {
        villageId: String(villageId),
        name: name,
        coord: coord,
        pop: pop,
      });
    });

    return result;
  }

  async function fetchGroups() {
    var url = buildGameUrl("groups", { mode: "overview", ajax: "load_group_menu" });
    var payload = await fetchJson(url);
    var groups = Array.isArray(payload && payload.result) ? payload.result : [];
    return groups
      .filter(function (group) {
        return group && group.type !== "separator";
      })
      .map(function (group) {
        return {
          id: String(group.group_id || group.id || ""),
          name: cleanText(group.name),
          type: cleanText(group.type),
          raw: group,
        };
      })
      .filter(function (group) {
        return group.id && group.name;
      });
  }

  function findGroup(groups, names, explicitId) {
    var id = cleanText(explicitId);
    if (id) {
      return (
        groups.find(function (group) {
          return String(group.id) === String(id);
        }) || null
      );
    }

    var wanted = (names || []).map(normalizeName).filter(Boolean);
    return (
      groups.find(function (group) {
        return wanted.indexOf(normalizeName(group.name)) !== -1;
      }) || null
    );
  }

  async function addCoordinatesToGroup(coords, group, options) {
    var uniqueCoords = Array.from(new Set(coords.map(cleanText).filter(Boolean)));
    if (!uniqueCoords.length) {
      return { skipped: true, reason: "no_coords", group: group };
    }

    if ((options || {}).dryRun) {
      console.log(LOG_PREFIX, "[DRY]", "would add", uniqueCoords.length, "coords to", group.name, group.id, uniqueCoords);
      return { dryRun: true, group: group, coords: uniqueCoords };
    }

    await sleep(CONFIG.requestDelayMs);

    return new Promise(function (resolve, reject) {
      if (!window.TribalWars || typeof TribalWars.post !== "function") {
        reject(new Error("TribalWars.post is not available"));
        return;
      }

      TribalWars.post(
        "overview_villages",
        { ajaxaction: "add_coordinates" },
        { coordinates: uniqueCoords.join("\n"), group_id: group.id },
        function (response) {
          if (response && response.status) {
            console.log(LOG_PREFIX, "[OK]", "added", uniqueCoords.length, "coords to", group.name, response);
            resolve({ ok: true, group: group, coords: uniqueCoords, response: response });
            return;
          }

          var message =
            (response && (response.message || response.error)) ||
            "server returned a falsy/non-success response";
          console.error(LOG_PREFIX, "[FAIL]", "add_coordinates failed for", group.name, group.id, message, response);
          resolve({
            ok: false,
            group: group,
            coords: uniqueCoords,
            message: message,
            response: response,
          });
        },
        function (error) {
          reject(error || new Error("add_coordinates failed for group " + group.name));
        },
      );
    });
  }

  function tribalGet(screen, params) {
    return new Promise(function (resolve, reject) {
      if (!window.TribalWars || typeof TribalWars.get !== "function") {
        reject(new Error("TribalWars.get is not available"));
        return;
      }
      TribalWars.get(
        screen,
        params || {},
        function (response) {
          resolve(response);
        },
        function (error) {
          reject(error || new Error("GET failed: " + screen));
        },
      );
    });
  }

  function tribalPost(screen, params, data) {
    return new Promise(function (resolve, reject) {
      if (!window.TribalWars || typeof TribalWars.post !== "function") {
        reject(new Error("TribalWars.post is not available"));
        return;
      }
      TribalWars.post(
        screen,
        params || {},
        data || {},
        function (response) {
          resolve(response);
        },
        function (error) {
          reject(error || new Error("POST failed: " + screen));
        },
      );
    });
  }

  async function addVillagesToGroupByAssignment(targets, group, options) {
    var uniqueTargets = [];
    var seen = new Set();

    (targets || []).forEach(function (target) {
      if (!target || !target.villageId || seen.has(String(target.villageId))) return;
      seen.add(String(target.villageId));
      uniqueTargets.push(target);
    });

    if (!uniqueTargets.length) {
      return { skipped: true, reason: "no_villages", group: group };
    }

    if ((options || {}).dryRun) {
      console.log(
        LOG_PREFIX,
        "[DRY fallback]",
        "would assign",
        uniqueTargets.length,
        "villages to",
        group.name,
        group.id,
        uniqueTargets.map(function (target) {
          return target.villageId + " " + target.coord;
        }),
      );
      return { dryRun: true, fallback: true, group: group, targets: uniqueTargets };
    }

    var results = [];
    for (var index = 0; index < uniqueTargets.length; index += 1) {
      var target = uniqueTargets[index];
      await sleep(CONFIG.requestDelayMs);

      try {
        var groupsResponse = await tribalGet("groups", {
          ajax: "load_groups",
          village_id: target.villageId,
        });
        var availableGroups = Array.isArray(groupsResponse && groupsResponse.result)
          ? groupsResponse.result
          : [];
        var currentIds = availableGroups
          .filter(function (item) {
            return item && item.in_group;
          })
          .map(function (item) {
            return String(item.group_id);
          });
        var hasTargetGroup = availableGroups.some(function (item) {
          return item && String(item.group_id) === String(group.id);
        });

        if (!hasTargetGroup) {
          results.push({
            ok: false,
            villageId: target.villageId,
            coord: target.coord,
            reason: "target_group_not_available_for_village",
          });
          console.warn(LOG_PREFIX, "[fallback skip]", target.villageId, target.coord, group.name, "not available");
          continue;
        }

        var nextIds = Array.from(new Set(currentIds.concat(String(group.id))));
        var data = {
          village_id: target.villageId,
          mode: "village",
          "groups[]": nextIds,
        };
        var saveResponse = await tribalPost("groups", { ajaxaction: "village" }, data);
        var ok = Boolean(saveResponse && saveResponse.result);
        results.push({
          ok: ok,
          villageId: target.villageId,
          coord: target.coord,
          group: group,
          response: saveResponse,
        });
        console.log(
          LOG_PREFIX,
          ok ? "[fallback OK]" : "[fallback FAIL]",
          "[" + (index + 1) + "/" + uniqueTargets.length + "]",
          target.villageId,
          target.coord,
          "->",
          group.name,
          saveResponse,
        );
      } catch (error) {
        results.push({
          ok: false,
          villageId: target.villageId,
          coord: target.coord,
          group: group,
          error: String((error && error.message) || error),
        });
        console.error(LOG_PREFIX, "[fallback ERR]", target.villageId, target.coord, error);
      }
    }

    return { fallback: true, group: group, results: results };
  }

  async function collect() {
    var incomingsUrl = buildGameUrl("overview_villages", {
      mode: "incomings",
      type: CONFIG.incomingType,
      subtype: CONFIG.incomingSubtype,
      page: -1,
    });
    var combinedUrl = buildGameUrl("overview_villages", {
      mode: "combined",
      group: 0,
      page: -1,
    });

    var incomingDoc = await fetchDocument(incomingsUrl);
    var combinedDoc = await fetchDocument(combinedUrl);
    var groups = await fetchGroups();

    var nobleTargets = parseIncomingTargets(incomingDoc);
    var populationByVillageId = parseVillagePopulation(combinedDoc);

    var targets = nobleTargets.map(function (target) {
      var popInfo = populationByVillageId.get(String(target.villageId));
      return Object.assign({}, target, {
        pop: popInfo ? popInfo.pop : null,
        lowPop: popInfo ? popInfo.pop < CONFIG.populationThreshold : false,
      });
    });

    var focusGroup = findGroup(groups, CONFIG.focusGroupNames, CONFIG.focusGroupId);
    var interceptGroup = findGroup(
      groups,
      CONFIG.interceptGroupNames,
      CONFIG.interceptGroupId,
    );
    var focusTargets = targets;
    var interceptTargets = targets.filter(function (target) {
      return target.lowPop;
    });

    return {
      groups: groups,
      focusGroup: focusGroup,
      interceptGroup: interceptGroup,
      targets: targets,
      focusTargets: focusTargets,
      interceptTargets: interceptTargets,
      urls: {
        incomings: incomingsUrl,
        combined: combinedUrl,
      },
    };
  }

  async function run(options) {
    var opts = Object.assign({ dryRun: CONFIG.dryRun }, options || {});
    var report = await collect();
    window.ScriptMMGroups.lastReport = report;

    console.log(LOG_PREFIX, "groups:", report.groups);
    console.table(
      report.targets.map(function (target) {
        return {
          village_id: target.villageId,
          coord: target.coord,
          pop: target.pop,
          low_pop: target.lowPop,
          attacks: target.commandIds.length,
          labels: target.labels.slice(0, 3).join(" | "),
          name: target.name,
        };
      }),
    );

    if (!report.focusGroup) {
      throw new Error("FOCUS group not found. Seen groups: " + report.groups.map(function (g) { return g.name; }).join(", "));
    }
    if (!report.interceptGroup) {
      console.warn(
        LOG_PREFIX,
        "intercept group not found by names:",
        CONFIG.interceptGroupNames,
      );
    }

    var results = [];
    var focusResult = await addCoordinatesToGroup(
      report.focusTargets.map(function (target) {
        return target.coord;
      }),
      report.focusGroup,
      opts,
    );
    results.push(focusResult);
    if (
      !opts.dryRun &&
      CONFIG.fallbackToVillageAssignment &&
      focusResult &&
      focusResult.ok === false
    ) {
      results.push(
        await addVillagesToGroupByAssignment(
          report.focusTargets,
          report.focusGroup,
          opts,
        ),
      );
    }

    if (report.interceptGroup) {
      var interceptResult = await addCoordinatesToGroup(
        report.interceptTargets.map(function (target) {
          return target.coord;
        }),
        report.interceptGroup,
        opts,
      );
      results.push(interceptResult);
      if (
        !opts.dryRun &&
        CONFIG.fallbackToVillageAssignment &&
        interceptResult &&
        interceptResult.ok === false
      ) {
        results.push(
          await addVillagesToGroupByAssignment(
            report.interceptTargets,
            report.interceptGroup,
            opts,
          ),
        );
      }
    }

    window.ScriptMMGroups.lastResults = results;
    console.log(LOG_PREFIX, "done", {
      dryRun: opts.dryRun,
      focus: report.focusTargets.length,
      intercept: report.interceptTargets.length,
      results: results,
    });
    return { report: report, results: results };
  }

  window.ScriptMMGroups = {
    config: CONFIG,
    collect: collect,
    run: run,
    dryRun: function () {
      return run({ dryRun: true });
    },
    apply: function () {
      return run({ dryRun: false });
    },
  };

  console.log(LOG_PREFIX, "loaded. Run: ScriptMMGroups.dryRun(); then ScriptMMGroups.apply();");
})();

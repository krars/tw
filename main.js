(() => {
  "use strict";

  const VERSION = "0.10.53";
  const LOG_PREFIX = "[ScriptMM]";
  const DEBUG_VERBOSE_LOGS = false;
  const MULTI_TAB_PRESENCE_KEY = "scriptmm.active_instances.v1";
  const MULTI_TAB_HEARTBEAT_INTERVAL_MS = 3000;
  const MULTI_TAB_STALE_MS = 12000;
  const MULTI_TAB_WARNING_TEXT =
    "В нескольких вкладках одновременно работа скрипта может быть нестабильна, для корректной работы настоятельно рекомендуется закрыть иные владки с активным скриптом";
  const MULTI_TAB_INSTANCE_ID = `tab_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const SPEED_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const TROOPS_CACHE_TTL_MS = 30 * 1000;
  const SIGIL_SNAPSHOT_CACHE_TTL_MS = 30 * 1000;
  const TIMING_COPY_HISTORY_MAX_ITEMS = 200;
  const MAX_FETCHES_PER_SECOND = 4;
  const FETCH_REQUEST_TIMEOUT_MS = 12000;
  const FETCH_MIN_INTERVAL_MS = Math.max(
    250,
    Math.ceil(1000 / MAX_FETCHES_PER_SECOND) + 20,
  );
  const STORAGE_KEYS = {
    speed: "scriptmm.speed_config.v2",
    incomings: "scriptmm.incomings.v1",
    troops: "scriptmm.troops.v2",
    troopsDefense: "scriptmm.troops.defense.v2",
    snapshot: "scriptmm.snapshot.v2",
    planActions: "scriptmm.plan_actions.v1",
    scheduledCommands: "scriptmm.scheduled_commands.v1",
    scheduledCommandsBackup: "scriptmm.scheduled_commands.backup.v1",
    scheduledCommandsSession: "scriptmm.scheduled_commands.session.v1",
    autoDispatchBridge: "scriptmm.auto_dispatch.bridge.v1",
    autoDispatchActive: "scriptmm.auto_dispatch.active.v1",
    overviewCommands: "scriptmm.overview_villages.commands.v1",
    overviewUnits: "scriptmm.overview_villages.units.v2",
    overviewUnitsDefense: "scriptmm.overview_villages.units.defense.v2",
    incomingsSupports: "scriptmm.incomings.supports.v1",
    supportCommandDetails: "scriptmm.support_command_details.v1",
    commandRouteDetails: "scriptmm.command_route_details.v1",
    maneuversArchive: "scriptmm.maneuvers.archive.v1",
    hubConnection: "scriptmm.hub.connection.v1",
    calcDisabledUnits: "scriptmm.calc.disabled_units.v1",
    activeTab: "scriptmm.active_tab.v1",
    uiSettings: "scriptmm.ui_settings.v1",
    villageGroupSelection: "scriptmm.village_group_selection.v1",
    villageGroupOptions: "scriptmm.village_group_options.v1",
    hiddenIncomings: "scriptmm.hidden_incomings.v1",
    hiddenVillageGroups: "scriptmm.hidden_village_groups.v1",
    favorites: "scriptmm.favorites.v1",
    uiMigrations: "scriptmm.ui_migrations.v1",
    timingCopyHistory: "scriptmm.timing_copy_history.v1",
  };
  const SUPPORT_COMMAND_DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const COMMAND_ROUTE_DETAILS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const COMMAND_ROUTE_UNRESOLVED_RETRY_MS = 90 * 1000;
  const COMMAND_ROUTE_DETAILS_FETCH_LIMIT = 8;
  const ARCHIVE_MAX_ITEMS = 100;
  const COMMAND_UNITS_TOLERANCE_RATIO = 0.2;
  const COMMAND_CHECK_GRACE_MS = 15000;
  const PLAN_DEPARTED_VISIBLE_GRACE_MS = 60 * 1000;
  const TIMING_POINT_TOLERANCE_MS = 400;
  const HUB_SYNC_INTERVAL_LEGACY_DEFAULT_MS = 10000;
  const HUB_SYNC_INTERVAL_DEFAULT_MS = 70000;
  const HUB_SYNC_INTERVAL_MIN_MS = 3000;
  const HUB_SYNC_INTERVAL_MAX_MS = 120000;
  const HUB_COMMANDS_REFRESH_MIN_INTERVAL_MS = 9000;
  const HUB_QUERY_PULL_MAX_ROWS = 250;
  const HUB_OWN_QUERY_PULL_MAX_ROWS = 300;
  const HUB_MASS_PULL_MAX_ROWS = 300;
  const HUB_PLAN_PULL_MAX_ROWS = 500;
  const HUB_TRIBE_PULL_MAX_ROWS = 15000;
  const WORLD_VILLAGE_MAP_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  const OVERVIEW_COMMANDS_EXHAUSTIVE_REFETCH_MS = 2 * 60 * 1000;
  const SLICE_TABLE_VISIBLE_ROWS = 7;
  const NEAREST_SLICE_LOOKAHEAD_DEFAULT_MINUTES = 10;
  const NEAREST_SLICE_LOOKAHEAD_DEFAULT_MS =
    NEAREST_SLICE_LOOKAHEAD_DEFAULT_MINUTES * 60 * 1000;
  const NEAREST_SLICE_LOOKAHEAD_MIN_MS = 1 * 60 * 1000;
  const NEAREST_SLICE_LOOKAHEAD_MAX_MS = 12 * 60 * 60 * 1000;
  const NEAREST_SLICE_DUPLICATE_WINDOW_MS = 100;
  const NEAREST_SLICE_EQ_THRESHOLD_SMALL = 3000;
  const NEAREST_SLICE_EQ_THRESHOLD_UNKNOWN = 4000;
  const NEAREST_SLICE_EQ_THRESHOLD_DEFAULT = 5000;
  const UI_SETTINGS_DEFAULTS = Object.freeze({
    hideHubDuplicatesByCoordTime: true,
    hideHubSliceIncomings: false,
    hideHubMassIncomings: false,
    exchangeTribeAttacks: true,
    checkSliceConflicts: true,
    loadPlanFromHub: false,
    forceSigilEnabled: false,
    forceSigilPercent: null,
    hubPollIntervalMs: HUB_SYNC_INTERVAL_DEFAULT_MS,
    nearestSliceWindowMs: NEAREST_SLICE_LOOKAHEAD_DEFAULT_MS,
    favoritesEnabled: true,
    plannerCommentEnabled: false,
  });
  const UI_BOOLEAN_SETTING_KEYS = new Set([
    "hideHubDuplicatesByCoordTime",
    "hideHubSliceIncomings",
    "hideHubMassIncomings",
    "exchangeTribeAttacks",
    "checkSliceConflicts",
    "loadPlanFromHub",
    "forceSigilEnabled",
    "favoritesEnabled",
    "plannerCommentEnabled",
  ]);
  const UI_MIGRATION_KEYS = Object.freeze({
    favoritesEnabledDefaultOn: "favorites_enabled_default_on_2026_04_12",
    hubPollDefault70Sec: "hub_poll_default_70sec_2026_04_12",
  });

  const UNIT_BASE_MINUTES_FALLBACK = {
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
    militia: 0.016666666666667,
  };

  const UNIT_META = {
    spear: { label: "копьё" },
    sword: { label: "меч" },
    axe: { label: "топор" },
    archer: { label: "лучник" },
    spy: { label: "разведка" },
    light: { label: "лк" },
    marcher: { label: "к.луч" },
    heavy: { label: "тк" },
    ram: { label: "таран" },
    catapult: { label: "ката" },
    knight: { label: "пал" },
    snob: { label: "двор" },
    militia: { label: "ополч." },
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
  const UNIT_ORDER_INDEX = UNIT_RENDER_ORDER.reduce((acc, unit, index) => {
    acc[unit] = index;
    return acc;
  }, {});

  const DEFENSE_EQ_WEIGHTS = {
    spear: 1,
    sword: 1,
    archer: 1,
    heavy: 5.4,
  };

  const DEFENSE_CARD_UNIT_WEIGHTS = {
    spear: 1,
    sword: 1,
    archer: 1,
    heavy: 6,
  };
  const DEFENSE_CARD_UNITS_HINT = "коп/меч/лук + тк×6";
  const DEFENSE_COMMAND_TYPES = new Set(["support", "return"]);

  const SUPPORT_EQ_BASE_BY_UNIT = {
    spear: 2200,
    sword: 2200,
    archer: 2100,
    heavy: 4200,
    knight: 3200,
    axe: 1800,
    light: 1700,
    marcher: 1700,
    ram: 1400,
    catapult: 1400,
    snob: 1200,
    spy: 900,
  };

  const SUPPORT_UNIT_EQ_WEIGHT = {
    spear: 1,
    sword: 1,
    archer: 1,
    axe: 0.75,
    spy: 0.2,
    light: 2.2,
    marcher: 2.6,
    heavy: 5.4,
    ram: 1.7,
    catapult: 1.3,
    knight: 4.2,
    snob: 0,
  };

  const SUPPORT_EQ_SIZE_MULTIPLIER = {
    small: 0.45,
    medium: 1,
    large: 1.8,
    normal: 1,
  };

  const state = {
    speedModel: null,
    incomings: null,
    supportIncomings: null,
    troops: null,
    troopsDefense: null,
    snapshot: null,
    overviewCommandsDump: null,
    overviewUnitsDump: null,
    overviewUnitsDefenseDump: null,
    planActions: {},
    scheduledCommands: [],
    archivedManeuvers: [],
    hubEntries: [],
    hubConnection: null,
    hubSyncTimerId: null,
    hubSyncInFlight: false,
    hubLastCommandsFetchMs: 0,
    hubLastSyncAtMs: null,
    hubLastSyncError: null,
    hubLastSyncStats: null,
    hubQueryIncomings: [],
    hubQueryThreshold: null,
    hubQueryLastLoadedMs: null,
    hubQueryLoading: false,
    hubQueryError: null,
    hubQueryLastFingerprint: null,
    hubOwnQueries: [],
    hubOwnQueriesLastLoadedMs: null,
    hubOwnQueriesLoading: false,
    hubOwnQueriesError: null,
    hubMassIncomings: [],
    hubMassLastLoadedMs: null,
    hubMassLoading: false,
    hubMassError: null,
    hubMassLastFingerprint: null,
    hubTribeIncomings: [],
    hubTribeAllIncomings: [],
    hubTribeTroopsRows: [],
    hubTribeCommandsRows: [],
    hubTribeCommandsCacheRows: [],
    hubTribePlansRows: [],
    hubTribeLastLoadedMs: null,
    hubTribeLoading: false,
    hubTribeError: null,
    hubTribeLastFingerprint: null,
    hubTribeSyncError: null,
    hubTribeLastSyncAtMs: null,
    overviewCommandsExhaustiveFetchedAtMs: 0,
    hubPlanLoading: false,
    hubPlanError: null,
    hubPlanLastLoadedMs: null,
    hubPlanLastFingerprint: null,
    worldVillageMapLoadedAtMs: 0,
    worldVillageMapByCoord: null,
    worldVillageMapLoadingPromise: null,
    sliceConflictSupportDetailsCache: {},
    uiSettings: { ...UI_SETTINGS_DEFAULTS },
    calcDisabledUnits: {},
    hasPrimaryIncomingsRender: false,
    activeTab: "incomings",
    messageMode: false,
    openIncomingId: null,
    infoVillageTargetCoord: null,
    countdownTimerId: null,
    detectedSigilPercent: 0,
    errors: [],
    messageActionListenerBound: false,
    messageStorageLoaded: false,
    storageSyncListenerBound: false,
    multiTabPresenceTimerId: null,
    multiTabPresenceCleanupBound: false,
    multiTabLastWarningAtMs: 0,
    selectedVillageGroupId: "0",
    villageGroupOptions: [{ id: "0", label: "все" }],
    villageGroupReloadPromise: null,
    forumThreadSigilCacheKey: null,
    forumThreadSigilPercent: null,
    forumThreadSigilLoadedAtMs: 0,
    forumThreadSigilLoadingPromise: null,
    hiddenIncomings: {},
    hiddenVillageGroups: {},
    favoritesEntries: [],
    tribeSearchQuery: "",
    tribeOwnerNickFilter: "all",
    tribeFilterNoble: false,
    tribeFilterLarge: false,
    tribeFilterMedium: false,
    pendingIncomingsRerender: false,
    pendingIncomingsRerenderReason: null,
    pendingActiveTabRerender: false,
    refreshInProgress: false,
    pendingPlanRerender: false,
    pendingHubTabRerender: false,
    nearestDialogState: { open: false, source: null },
    ui: null,
  };
  const HUB_URL_PLACEHOLDER = "https://script.google.com/macros/s/XXXI/exec";
  const MESSAGE_INLINE_LAUNCH_COUNTER_KEY = "__ScriptMM_msg_inline_launches";
  const MESSAGE_ACTION_LISTENER_BOUND_KEY = "__ScriptMM_msg_listener_bound";
  const MESSAGE_ACTION_LISTENER_VERSION_KEY =
    "__ScriptMM_msg_listener_version";
  const MESSAGE_ACTION_LISTENER_HANDLER_KEY =
    "__ScriptMM_msg_listener_handler";

  const scriptStartMs = Date.now();
  const serverGeneratedMs =
    typeof window.game_data !== "undefined" && window.game_data
      ? Number(window.game_data.time_generated || 0)
      : 0;

  const safe = (fn, fallback = null) => {
    try {
      return fn();
    } catch (error) {
      return fallback;
    }
  };

  const cleanText = (value) => {
    if (value === null || value === undefined) return null;
    const normalized = String(value).replace(/\s+/g, " ").trim();
    return normalized || null;
  };
  const normalizeNickKey = (value) =>
    String(cleanText(value) || "")
      .trim()
      .toLowerCase();
  const formatErrorText = (reason) =>
    cleanText(
      reason && reason.message ? reason.message : String(reason || ""),
    ) || "unknown";
  const notifyHubStatus = (message, options = {}) => {
    const text = cleanText(message);
    if (!text) return;
    const isError =
      typeof options === "boolean"
        ? options
        : Boolean(options && options.error);
    const isSuccess = Boolean(
      options && typeof options === "object" && options.success,
    );
    const skipStatus = Boolean(
      options && typeof options === "object" && options.skipStatus,
    );
    const timeoutMsRaw =
      options && typeof options === "object" ? toInt(options.timeoutMs) : null;
    const timeoutMs =
      Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : 2000;
    if (state.ui && !skipStatus) {
      setStatus(state.ui, text);
    }
    const uiApi = safe(() => window.UI, null);
    if (isError && uiApi && typeof uiApi.ErrorMessage === "function") {
      safe(() => uiApi.ErrorMessage(text), null);
      return;
    }
    if (isSuccess && uiApi && typeof uiApi.SuccessMessage === "function") {
      safe(() => uiApi.SuccessMessage(text, timeoutMs), null);
      return;
    }
    if (uiApi && typeof uiApi.InfoMessage === "function") {
      safe(() => uiApi.InfoMessage(text), null);
      return;
    }
    console.log(`${LOG_PREFIX} ${text}`);
  };

  const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(
      String(value)
        .replace(",", ".")
        .replace(/[^\d.-]/g, ""),
    );
    return Number.isFinite(numeric) ? numeric : null;
  };

  const toInt = (value) => {
    if (value === null || value === undefined) return null;
    const numeric = Number(String(value).replace(/[^\d-]/g, ""));
    return Number.isInteger(numeric) ? numeric : null;
  };

  const parseStrictIntegerText = (value) => {
    const text = String(value == null ? "" : value)
      .replace(/\u00a0/g, " ")
      .trim();
    if (!text) return null;
    if (!/^[0-9][0-9.\s]*$/.test(text)) return null;
    return toInt(text);
  };

  const escapeHtml = (value) =>
    String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const escapeCssSelector = (value) => {
    const raw = String(value == null ? "" : value);
    if (!raw) return "";
    return safe(() => CSS.escape(raw), raw.replace(/["\\]/g, "\\$&"));
  };

  const getUrlParam = (href, key) =>
    safe(() => new URL(href, location.origin).searchParams.get(key), null);
  const isInfoVillagePlanningScreen = () => {
    const href = String(location && location.href ? location.href : "");
    if (!/(?:[?&])screen=info_village\b/i.test(href)) return false;
    if (/(?:[?&])(?:i|id|village)(?:=|&|$)/i.test(href)) return true;
    const params = safe(() => new URL(location.href).searchParams, null);
    if (!params) return false;
    const screen =
      cleanText(params.get("screen")) ||
      cleanText(safe(() => window.game_data.screen, null));
    if (screen !== "info_village") return false;
    return true;
  };
  const isVillageOverviewInlinePlanningScreen = () => {
    const params = safe(() => new URL(location.href).searchParams, null);
    if (!params) return false;
    const screen =
      cleanText(params.get("screen")) ||
      cleanText(safe(() => window.game_data.screen, null));
    if (screen !== "overview" && screen !== "place") return false;
    return Boolean(
      document.querySelector(
        "#commands_incomings tr.command-row, .commands-container[data-type='incoming'] tr.command-row",
      ),
    );
  };
  const isOverviewIncomingsPlanningScreen = () => {
    const params = safe(() => new URL(location.href).searchParams, null);
    if (!params) return false;
    const screen =
      cleanText(params.get("screen")) ||
      cleanText(safe(() => window.game_data.screen, null));
    const mode =
      cleanText(params.get("mode")) ||
      cleanText(safe(() => window.game_data.mode, null));
    const subtype = cleanText(params.get("subtype")) || "attacks";
    return (
      screen === "overview_villages" &&
      mode === "incomings" &&
      subtype === "attacks"
    );
  };
  const isMessagePlanningScreen = () => {
    const href = String(location && location.href ? location.href : "");
    if (
      href.includes("&screen=mail&mode=view&") ||
      href.includes("?screen=mail&mode=view&") ||
      href.includes("&screen=forum&screenmode=view_thread") ||
      href.includes("?screen=forum&screenmode=view_thread") ||
      href.includes("&screen=forum&mode=view_thread") ||
      href.includes("?screen=forum&mode=view_thread")
    ) {
      return true;
    }
    if (isInfoVillagePlanningScreen()) return true;
    if (isVillageOverviewInlinePlanningScreen()) return true;
    if (isOverviewIncomingsPlanningScreen()) return true;
    const params = safe(() => new URL(location.href).searchParams, null);
    if (!params) return false;
    const screen =
      cleanText(params.get("screen")) ||
      cleanText(safe(() => window.game_data.screen, null));
    const mode =
      cleanText(params.get("mode")) ||
      cleanText(safe(() => window.game_data.mode, null));
    const screenmode = cleanText(params.get("screenmode"));
    return (
      (screen === "mail" && (mode === "view" || screenmode === "view")) ||
      (screen === "forum" &&
        (screenmode === "view_thread" || mode === "view_thread"))
    );
  };
  const isForumThreadPlanningScreen = () => {
    const href = String(location && location.href ? location.href : "");
    if (
      href.includes("&screen=forum&screenmode=view_thread") ||
      href.includes("?screen=forum&screenmode=view_thread") ||
      href.includes("&screen=forum&mode=view_thread") ||
      href.includes("?screen=forum&mode=view_thread")
    ) {
      return true;
    }
    const params = safe(() => new URL(location.href).searchParams, null);
    if (!params) return false;
    const screen =
      cleanText(params.get("screen")) ||
      cleanText(safe(() => window.game_data.screen, null));
    const mode =
      cleanText(params.get("mode")) ||
      cleanText(safe(() => window.game_data.mode, null));
    const screenmode = cleanText(params.get("screenmode"));
    return (
      screen === "forum" &&
      (screenmode === "view_thread" || mode === "view_thread")
    );
  };

  const normalizeVillageGroupId = (value) => {
    const raw = cleanText(value);
    if (!raw) return "0";
    const parsed = toInt(raw);
    if (!Number.isFinite(parsed) || parsed < 0) return "0";
    return String(parsed);
  };

  const normalizeVillageGroupLabel = (labelRaw, groupIdRaw = null) => {
    const groupId = normalizeVillageGroupId(groupIdRaw);
    const raw = cleanText(labelRaw);
    if (!raw) return groupId === "0" ? "все" : `группа ${groupId}`;
    const withoutBrackets = raw
      .replace(/^[\[\s>]+/g, "")
      .replace(/[\]\s<]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!withoutBrackets) return groupId === "0" ? "все" : `группа ${groupId}`;
    const normalized =
      withoutBrackets.toLowerCase() === "все" ? "все" : withoutBrackets;
    return normalized;
  };

  const normalizeVillageGroupOption = (optionRaw) => {
    if (!optionRaw || typeof optionRaw !== "object") return null;
    const id = normalizeVillageGroupId(optionRaw.id);
    const label = normalizeVillageGroupLabel(optionRaw.label, id);
    return { id, label };
  };

  const normalizeVillageGroupOptions = (optionsRaw) => {
    const list = Array.isArray(optionsRaw) ? optionsRaw : [];
    const byId = new Map();
    list.forEach((optionRaw) => {
      const normalized = normalizeVillageGroupOption(optionRaw);
      if (!normalized) return;
      const existing = byId.get(normalized.id);
      if (!existing) {
        byId.set(normalized.id, normalized);
        return;
      }
      const existingLabel = cleanText(existing.label) || "";
      const nextLabel = cleanText(normalized.label) || "";
      if (
        !existingLabel ||
        (nextLabel && nextLabel.length > existingLabel.length)
      ) {
        byId.set(normalized.id, normalized);
      }
    });
    if (!byId.has("0")) {
      byId.set("0", { id: "0", label: "все" });
    }
    const sorted = Array.from(byId.values()).sort((a, b) => {
      if (a.id === "0") return -1;
      if (b.id === "0") return 1;
      return Number(a.id) - Number(b.id);
    });
    return sorted;
  };

  const mergeVillageGroupOptions = (...optionLists) =>
    normalizeVillageGroupOptions(
      optionLists.flatMap((list) => (Array.isArray(list) ? list : [])),
    );

  const getCurrentWorldKey = () =>
    cleanText(safe(() => window.game_data.world, null)) ||
    cleanText(location.hostname) ||
    "default";

  const parseVillageGroupsFromDocument = (root = document) => {
    const scope = root || document;
    const nodes = Array.from(
      scope.querySelectorAll(
        ".group-menu-item[data-group-id], strong.group-menu-item[data-group-id], a.group-menu-item[href*='group='], strong.group-menu-item",
      ),
    );
    const options = [];
    let selectedId = null;
    nodes.forEach((node) => {
      const tagName = String(node.tagName || "").toUpperCase();
      const href = cleanText(safe(() => node.getAttribute("href"), null));
      const className = cleanText(safe(() => node.className, ""));
      const text = cleanText(node.textContent);
      const fromData = cleanText(node.getAttribute("data-group-id"));
      const fromHref = href ? cleanText(getUrlParam(href, "group")) : null;
      const id = normalizeVillageGroupId(fromData || fromHref || "0");
      if (
        tagName === "A" &&
        className &&
        className.includes("paged-nav-item") &&
        /^\[\d+\]$/.test(cleanText(text || "") || "")
      ) {
        return;
      }
      const label = normalizeVillageGroupLabel(cleanText(node.textContent), id);
      options.push({ id, label });
      const isSelected =
        tagName === "STRONG" ||
        node.classList.contains("active") ||
        node.classList.contains("selected");
      if (isSelected) selectedId = id;
    });
    const urlGroup = normalizeVillageGroupId(
      getUrlParam(location.href, "group"),
    );
    const gameDataGroup = normalizeVillageGroupId(
      safe(() => window.game_data.group_id, "0"),
    );
    const normalizedOptions = normalizeVillageGroupOptions(options);
    const finalSelectedId = normalizeVillageGroupId(
      selectedId || urlGroup || gameDataGroup || "0",
    );
    return {
      selectedId: finalSelectedId,
      options: normalizedOptions,
    };
  };

  const ensureVillageGroupsLoaded = async ({ force = false } = {}) => {
    syncVillageGroupsFromPage();
    const currentOptions = getVillageGroupOptionsForUi();
    if (!force && currentOptions.length > 1) {
      return currentOptions;
    }

    const sourceUrl = buildGameUrl({
      screen: "overview_villages",
      mode: "units",
      type: "complete",
      group: getSelectedVillageGroupId(),
      page: -1,
    });

    try {
      const doc = await fetchDocument(sourceUrl);
      const parsed = parseVillageGroupsFromDocument(doc);
      if (parsed.options.length > 1) {
        state.villageGroupOptions = normalizeVillageGroupOptions(parsed.options);
      }
      ensureVillageGroupExists(getSelectedVillageGroupId());
      saveVillageGroupOptions();
      saveSelectedVillageGroupId();
    } catch (error) {
      console.warn(`${LOG_PREFIX} failed to load village groups`, error);
    }

    return getVillageGroupOptionsForUi();
  };

  const loadVillageGroupOptions = () => {
    const world = getCurrentWorldKey();
    const stored = readJson(STORAGE_KEYS.villageGroupOptions);
    const storedWorld = cleanText(stored && stored.world);
    const storedOptions =
      stored && typeof stored === "object" && storedWorld === world
        ? normalizeVillageGroupOptions(stored.options)
        : [{ id: "0", label: "все" }];
    state.villageGroupOptions = storedOptions;
    return storedOptions;
  };

  const saveVillageGroupOptions = () =>
    saveJson(STORAGE_KEYS.villageGroupOptions, {
      world: getCurrentWorldKey(),
      options: normalizeVillageGroupOptions(state.villageGroupOptions),
      savedAt: new Date(getServerNowMs()).toISOString(),
    });

  const loadSelectedVillageGroupId = () => {
    const world = getCurrentWorldKey();
    const stored = readJson(STORAGE_KEYS.villageGroupSelection);
    const storedWorld = cleanText(stored && stored.world);
    const storedGroupId =
      stored && typeof stored === "object" && storedWorld === world
        ? normalizeVillageGroupId(stored.groupId)
        : null;
    const urlGroupId = normalizeVillageGroupId(
      getUrlParam(location.href, "group"),
    );
    const gameDataGroupId = normalizeVillageGroupId(
      safe(() => window.game_data.group_id, "0"),
    );
    state.selectedVillageGroupId = normalizeVillageGroupId(
      urlGroupId || storedGroupId || gameDataGroupId || "0",
    );
    return state.selectedVillageGroupId;
  };

  const saveSelectedVillageGroupId = () =>
    saveJson(STORAGE_KEYS.villageGroupSelection, {
      world: getCurrentWorldKey(),
      groupId: normalizeVillageGroupId(state.selectedVillageGroupId),
      savedAt: new Date(getServerNowMs()).toISOString(),
    });

  const getSelectedVillageGroupId = () =>
    normalizeVillageGroupId(
      state.selectedVillageGroupId ||
        safe(() => window.game_data.group_id, "0") ||
        getUrlParam(location.href, "group") ||
        "0",
    );

  const ensureVillageGroupExists = (groupIdRaw) => {
    const groupId = normalizeVillageGroupId(groupIdRaw);
    const options = normalizeVillageGroupOptions(state.villageGroupOptions);
    if (!options.some((option) => option.id === groupId)) {
      options.push({
        id: groupId,
        label: groupId === "0" ? "все" : `группа ${groupId}`,
      });
    }
    state.villageGroupOptions = normalizeVillageGroupOptions(options);
  };

  const syncVillageGroupsFromPage = () => {
    const parsed = parseVillageGroupsFromDocument(document);
    const hasPageGroups = parsed.options.length > 1;
    if (hasPageGroups) {
      state.villageGroupOptions = normalizeVillageGroupOptions(parsed.options);
    }
    const currentSelected = getSelectedVillageGroupId();
    if (!state.villageGroupOptions.some((option) => option.id === currentSelected)) {
      state.selectedVillageGroupId = normalizeVillageGroupId(
        parsed.selectedId || currentSelected || "0",
      );
      ensureVillageGroupExists(state.selectedVillageGroupId);
    }
    saveVillageGroupOptions();
    saveSelectedVillageGroupId();
    return {
      selectedId: getSelectedVillageGroupId(),
      options: normalizeVillageGroupOptions(state.villageGroupOptions),
    };
  };

  const setSelectedVillageGroupId = (groupIdRaw) => {
    const next = normalizeVillageGroupId(groupIdRaw);
    const current = getSelectedVillageGroupId();
    if (next === current) return false;
    state.selectedVillageGroupId = next;
    ensureVillageGroupExists(next);
    saveVillageGroupOptions();
    saveSelectedVillageGroupId();
    return true;
  };

  const getVillageGroupOptionsForUi = () => {
    ensureVillageGroupExists(getSelectedVillageGroupId());
    return normalizeVillageGroupOptions(state.villageGroupOptions);
  };

  const buildVillageGroupSelectHtml = (
    selectedIdRaw = null,
    { className = "smm-calc-group-select", withLabel = false } = {},
  ) => {
    const options = getVillageGroupOptionsForUi();
    const selectedId = normalizeVillageGroupId(
      selectedIdRaw || getSelectedVillageGroupId(),
    );
    const optionsHtml = options
      .map((option) => {
        const id = normalizeVillageGroupId(option.id);
        const label = normalizeVillageGroupLabel(option.label, id);
        return `<option value="${escapeHtml(id)}"${
          id === selectedId ? " selected" : ""
        }>${escapeHtml(label)}</option>`;
      })
      .join("");
    const selectHtml = `<select class="${escapeHtml(
      className,
    )}" data-village-group-select="1" title="Группа деревень">${optionsHtml}</select>`;
    if (!withLabel) return selectHtml;
    return `<label class="smm-group-select-wrap"><span class="smm-group-select-label">Группа:</span>${selectHtml}</label>`;
  };

  const syncVillageGroupSelectNode = (selectNode) => {
    if (!selectNode) return;
    selectNode.innerHTML = buildVillageGroupSelectHtml(
      getSelectedVillageGroupId(),
      {
        className: cleanText(selectNode.className) || "smm-calc-group-select",
        withLabel: false,
      },
    ).replace(/^<select[^>]*>|<\/select>$/g, "");
    selectNode.value = getSelectedVillageGroupId();
  };

  const getVillageGroupOptionById = (groupIdRaw) => {
    const groupId = normalizeVillageGroupId(groupIdRaw);
    const options = getVillageGroupOptionsForUi();
    return (
      options.find(
        (option) => normalizeVillageGroupId(option.id) === groupId,
      ) || null
    );
  };

  const getSelectedVillageGroupLabel = (fallback = "все") => {
    const selectedOption = getVillageGroupOptionById(
      getSelectedVillageGroupId(),
    );
    return (
      cleanText(selectedOption && selectedOption.label) ||
      cleanText(fallback) ||
      "все"
    );
  };

  const syncAllVillageGroupSelects = (root = document) => {
    const scope = root && root.querySelectorAll ? root : document;
    scope
      .querySelectorAll('select[data-village-group-select="1"]')
      .forEach((selectNode) => {
        syncVillageGroupSelectNode(selectNode);
      });
  };

  const initVillageGroupState = () => {
    loadVillageGroupOptions();
    loadSelectedVillageGroupId();
    syncVillageGroupsFromPage();
  };

  const parseCoord = (text) => {
    const match = String(text || "").match(/(\d{1,3})\|(\d{1,3})/);
    if (!match) return null;
    const x = Number(match[1]);
    const y = Number(match[2]);
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x, y, key: `${x}|${y}` }
      : null;
  };

  const calcDistance = (from, to) => {
    if (!from || !to) return null;
    const dx = from.x - to.x;
    const dy = from.y - to.y;
    return Number(Math.sqrt(dx * dx + dy * dy).toFixed(3));
  };

  const detectCommandTypeByIcon = (iconSrc) => {
    const src = String(iconSrc || "");
    if (!src) return null;
    if (src.includes("/command/support")) return "support";
    if (src.includes("/command/attack_small")) return "attack_small";
    if (src.includes("/command/attack_medium")) return "attack_medium";
    if (src.includes("/command/attack_large")) return "attack_large";
    if (src.includes("/command/attack")) return "attack";
    return "other";
  };

  const detectUnitFromTinyIcon = (iconSrc) => {
    const src = String(iconSrc || "");
    if (!src) return null;
    const match = src.match(
      /\/unit\/tiny\/([a-z_]+)\.(?:webp|png|gif|jpg|jpeg)/i,
    );
    return match ? match[1].toLowerCase() : null;
  };

  const detectUnitFromText = (text) => {
    const source = String(text || "").toLowerCase();
    if (!source) return null;
    if (/(?:двор|snob)/i.test(source)) return "snob";
    if (/(?:таран|ram)/i.test(source)) return "ram";
    if (/(?:ката|катап|catapult)/i.test(source)) return "catapult";
    if (/(?:\bлк\b|легк|light)/i.test(source)) return "light";
    if (/(?:\bтк\b|тяж|heavy)/i.test(source)) return "heavy";
    if (/(?:меч|sword)/i.test(source)) return "sword";
    if (/(?:копь|копье|копьё|spear)/i.test(source)) return "spear";
    if (/(?:топор|axe)/i.test(source)) return "axe";
    if (/(?:развед|лазут|шпион|spy)/i.test(source)) return "spy";
    if (/(?:палад|knight)/i.test(source)) return "knight";
    if (/(?:луч|archer|marcher)/i.test(source)) return "archer";
    return null;
  };

  const tooltipHtmlToText = (value) => {
    const raw = String(value || "");
    if (!raw) return null;
    const withSpaces = raw
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(td|th|tr|div|p|li|ul|ol)>/gi, " ")
      .replace(/<[^>]+>/g, " ");
    const decoded = safe(() => {
      const node = document.createElement("textarea");
      node.innerHTML = withSpaces;
      return node.value;
    }, withSpaces);
    return cleanText(decoded);
  };

  const parseSupportCountFromTooltip = (tooltipRaw) => {
    const text = tooltipHtmlToText(tooltipRaw);
    if (!text) return null;
    const numbers = (text.match(/\b\d{1,7}\b/g) || [])
      .map((token) => Number(token))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (!numbers.length) return null;
    const candidate = Math.max(...numbers);
    return Number.isFinite(candidate) && candidate > 0 ? candidate : null;
  };

  const normalizeUnitKeyForSupportCalc = (unitRaw) => {
    let unit = String(unitRaw || "")
      .toLowerCase()
      .trim();
    if (!unit) return null;
    unit = unit.replace(/^unit_+/, "");
    unit = unit.replace(/[^a-z_].*$/i, "");
    if (!unit || unit === "militia") return null;
    if (UNIT_ORDER_INDEX[unit] === undefined) return null;
    return unit;
  };

  const normalizeSupportUnitsMap = (units, speedModel = null) => {
    const result = {};
    Object.entries(units && typeof units === "object" ? units : {}).forEach(
      ([unit, count]) => {
        const unitKey = normalizeUnitKeyForSupportCalc(unit);
        const unitCount = Math.max(0, toInt(count) || 0);
        if (!unitKey || unitCount <= 0) return;
        if (!isUnitAllowedInWorld(unitKey, speedModel)) return;
        result[unitKey] = Math.max(result[unitKey] || 0, unitCount);
      },
    );
    return result;
  };

  const sumSupportUnits = (units) =>
    Object.values(units && typeof units === "object" ? units : {}).reduce(
      (sum, value) => {
        const count = Math.max(0, toInt(value) || 0);
        return sum + count;
      },
      0,
    );

  const getDominantSupportUnit = (units) => {
    let bestUnit = null;
    let bestCount = -1;
    Object.entries(units && typeof units === "object" ? units : {}).forEach(
      ([unit, count]) => {
        const safeCount = Math.max(0, toInt(count) || 0);
        if (safeCount > bestCount) {
          bestCount = safeCount;
          bestUnit = String(unit || "").toLowerCase();
        }
      },
    );
    return bestUnit;
  };

  const parsePositiveIntsFromText = (value) => {
    const text = String(value == null ? "" : value).replace(/\u00a0/g, " ");
    if (!text) return [];
    const tokens = text.match(/\d[\d.\s]{0,16}/g) || [];
    const values = [];
    tokens.forEach((token) => {
      const parsed = parseStrictIntegerText(token);
      if (Number.isFinite(parsed) && parsed > 0) values.push(parsed);
    });
    return values;
  };

  const normalizeSupportCommandDetailsEntry = (
    key,
    entry,
    speedModel = null,
  ) => {
    if (!entry || typeof entry !== "object") return null;
    const commandId = cleanText(entry.commandId) || cleanText(key);
    if (!commandId) return null;
    const fetchedAtMs =
      Number(entry.fetchedAtMs) ||
      Number(
        safe(() => new Date(cleanText(entry.fetchedAt) || "").getTime(), NaN),
      );
    if (!Number.isFinite(fetchedAtMs)) return null;
    const units = normalizeSupportUnitsMap(entry.units, speedModel);
    const totalUnits = sumSupportUnits(units);
    if (!totalUnits) return null;
    return {
      commandId,
      fetchedAtMs,
      sourceUrl: cleanText(entry.sourceUrl) || null,
      units,
      totalUnits,
    };
  };

  const loadSupportCommandDetailsCache = (speedModel = null) => {
    const raw = readJson(STORAGE_KEYS.supportCommandDetails);
    const entries = {};
    if (
      raw &&
      typeof raw === "object" &&
      raw.entries &&
      typeof raw.entries === "object"
    ) {
      Object.entries(raw.entries).forEach(([key, value]) => {
        const normalized = normalizeSupportCommandDetailsEntry(
          key,
          value,
          speedModel,
        );
        if (!normalized) return;
        entries[normalized.commandId] = normalized;
      });
    }

    return {
      version: 1,
      fetchedAt:
        cleanText(raw && raw.fetchedAt) ||
        new Date(getServerNowMs()).toISOString(),
      entries,
    };
  };

  const saveSupportCommandDetailsCache = (cache) => {
    const entries = {};
    Object.entries(
      cache && cache.entries && typeof cache.entries === "object"
        ? cache.entries
        : {},
    ).forEach(([key, value]) => {
      const normalized = normalizeSupportCommandDetailsEntry(
        key,
        value,
        state.speedModel,
      );
      if (!normalized) return;
      entries[normalized.commandId] = normalized;
    });

    return saveJson(STORAGE_KEYS.supportCommandDetails, {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      entries,
    });
  };

  const normalizeCommandRouteDetailsEntry = (key, entry) => {
    if (!entry || typeof entry !== "object") return null;
    const commandId = cleanText(entry.commandId) || cleanText(key);
    if (!commandId) return null;
    const fetchedAtMs =
      Number(entry.fetchedAtMs) ||
      Number(
        safe(() => new Date(cleanText(entry.fetchedAt) || "").getTime(), NaN),
      );
    if (!Number.isFinite(fetchedAtMs)) return null;
    const routeToCoord = normalizeCoordIdentity(entry.routeToCoord);
    const routeFromCoord = normalizeCoordIdentity(entry.routeFromCoord);
    const unresolved =
      Boolean(entry.unresolved) || (!routeToCoord && !routeFromCoord);
    return {
      commandId,
      fetchedAtMs: Math.round(fetchedAtMs),
      sourceUrl: cleanText(entry.sourceUrl) || null,
      routeToCoord: routeToCoord || null,
      routeFromCoord: routeFromCoord || null,
      unresolved,
    };
  };

  const loadCommandRouteDetailsCache = () => {
    const raw = readJson(STORAGE_KEYS.commandRouteDetails);
    const entries = {};
    if (
      raw &&
      typeof raw === "object" &&
      raw.entries &&
      typeof raw.entries === "object"
    ) {
      Object.entries(raw.entries).forEach(([key, value]) => {
        const normalized = normalizeCommandRouteDetailsEntry(key, value);
        if (!normalized) return;
        entries[normalized.commandId] = normalized;
      });
    }
    return {
      version: 1,
      fetchedAt:
        cleanText(raw && raw.fetchedAt) ||
        new Date(getServerNowMs()).toISOString(),
      entries,
    };
  };

  const saveCommandRouteDetailsCache = (cache) => {
    const entries = {};
    Object.entries(
      cache && cache.entries && typeof cache.entries === "object"
        ? cache.entries
        : {},
    ).forEach(([key, value]) => {
      const normalized = normalizeCommandRouteDetailsEntry(key, value);
      if (!normalized) return;
      entries[normalized.commandId] = normalized;
    });
    return saveJson(STORAGE_KEYS.commandRouteDetails, {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      entries,
    });
  };

  const extractCommandRouteByLabelFromDoc = (doc, labelMatcher) => {
    if (!doc || typeof labelMatcher !== "function") return null;
    const rows = Array.from(
      doc.querySelectorAll("#content_value tr, table.vis tr, table tr"),
    );
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("th,td"));
      if (cells.length < 2) continue;
      const labelText = cleanText(cells[0].textContent);
      if (!labelText || !labelMatcher(String(labelText).toLowerCase()))
        continue;
      for (let index = 1; index < cells.length; index += 1) {
        const coord = normalizeCoordIdentity(cells[index].textContent);
        if (coord) return coord;
      }
    }
    const rootText = cleanText(
      safe(() => {
        const root = doc.querySelector("#content_value") || doc.body;
        return root ? root.textContent : "";
      }, ""),
    );
    if (!rootText) return null;
    const pattern = labelMatcher("пункт назначения")
      ? /(?:пункт назначения|цель|назначение)\s*:?\s*.*?(\d{1,3}\|\d{1,3})/i
      : /(?:из деревни|пункт отправления|отправление|откуда)\s*:?\s*.*?(\d{1,3}\|\d{1,3})/i;
    const match = rootText.match(pattern);
    return normalizeCoordIdentity(match && match[1]);
  };

  const extractOwnCommandRouteFromDoc = (doc) => {
    const routeToCoord = extractCommandRouteByLabelFromDoc(doc, (label) =>
      /пункт назначения|цель|назначение|target/.test(label),
    );
    const routeFromCoord = extractCommandRouteByLabelFromDoc(doc, (label) =>
      /из деревни|пункт отправления|отправление|откуда|origin|from/.test(label),
    );
    return {
      routeToCoord: routeToCoord || null,
      routeFromCoord: routeFromCoord || null,
    };
  };

  const buildInfoCommandUrlForOwnCommand = (item) => {
    const rawUrl = cleanText(item && item.commandUrl);
    if (rawUrl) {
      return safe(() => new URL(rawUrl, location.origin).toString(), null);
    }
    const commandId = cleanText(item && item.id);
    if (!commandId) return null;
    return buildGameUrl({
      screen: "info_command",
      id: commandId,
      type: "own",
    });
  };

  const applyRouteDetailsToOwnCommand = (item, details) => {
    if (
      !item ||
      typeof item !== "object" ||
      !details ||
      typeof details !== "object"
    )
      return item;
    const routeToCoord = normalizeCoordIdentity(details.routeToCoord);
    const routeFromCoord = normalizeCoordIdentity(details.routeFromCoord);
    if (!routeToCoord && !routeFromCoord) return item;
    return {
      ...item,
      routeToCoord:
        normalizeCoordIdentity(item.routeToCoord) || routeToCoord || null,
      routeFromCoord:
        normalizeCoordIdentity(item.routeFromCoord) || routeFromCoord || null,
    };
  };

  const enrichOverviewCommandsWithRouteDetails = async (dump) => {
    if (!dump || !Array.isArray(dump.items) || !dump.items.length) return dump;
    const nowMs = getServerNowMs();
    const cache = loadCommandRouteDetailsCache();
    let cacheDirty = false;
    let changed = false;
    let fetched = 0;
    let cacheHits = 0;
    let failed = 0;

    Object.entries(cache.entries).forEach(([commandId, entry]) => {
      const fetchedAtMs = Number(entry && entry.fetchedAtMs);
      if (
        !Number.isFinite(fetchedAtMs) ||
        nowMs - fetchedAtMs > COMMAND_ROUTE_DETAILS_CACHE_TTL_MS
      ) {
        delete cache.entries[commandId];
        cacheDirty = true;
      }
    });

    const items = dump.items.map((item) => ({ ...(item || {}) }));
    const unresolvedIndexes = [];

    items.forEach((item, index) => {
      const commandId = cleanText(item && item.id);
      if (!commandId) return;
      const currentTo = normalizeCoordIdentity(item && item.routeToCoord);
      const currentFrom = normalizeCoordIdentity(item && item.routeFromCoord);
      const cached = normalizeCommandRouteDetailsEntry(
        commandId,
        cache.entries[commandId],
      );
      if (cached) {
        if (
          (cached.routeToCoord || cached.routeFromCoord) &&
          (!currentTo || !currentFrom)
        ) {
          const next = applyRouteDetailsToOwnCommand(item, cached);
          if (next !== item) {
            items[index] = next;
            changed = true;
          }
          cacheHits += 1;
          return;
        }
        if (cached.unresolved) {
          const unresolvedAgeMs = nowMs - Number(cached.fetchedAtMs || 0);
          if (
            Number.isFinite(unresolvedAgeMs) &&
            unresolvedAgeMs >= 0 &&
            unresolvedAgeMs < COMMAND_ROUTE_UNRESOLVED_RETRY_MS
          ) {
            return;
          }
        }
      }
      if (!normalizeCoordIdentity(items[index] && items[index].routeToCoord)) {
        unresolvedIndexes.push(index);
      }
    });

    const fetchLimit = Math.max(
      0,
      toInt(COMMAND_ROUTE_DETAILS_FETCH_LIMIT) || 0,
    );
    for (
      let index = 0;
      index < unresolvedIndexes.length && fetched < fetchLimit;
      index += 1
    ) {
      const itemIndex = unresolvedIndexes[index];
      const item = items[itemIndex];
      const commandId = cleanText(item && item.id);
      if (!commandId) continue;
      const commandUrl = buildInfoCommandUrlForOwnCommand(item);
      if (!commandUrl) continue;
      try {
        const doc = await fetchDocument(commandUrl);
        const route = extractOwnCommandRouteFromDoc(doc);
        const details = {
          commandId,
          fetchedAtMs: getServerNowMs(),
          sourceUrl: commandUrl,
          routeToCoord: normalizeCoordIdentity(route && route.routeToCoord),
          routeFromCoord: normalizeCoordIdentity(route && route.routeFromCoord),
          unresolved: false,
        };
        if (!details.routeToCoord && !details.routeFromCoord) {
          details.unresolved = true;
        }
        cache.entries[commandId] = details;
        cacheDirty = true;
        fetched += 1;
        const next = applyRouteDetailsToOwnCommand(item, details);
        if (next !== item) {
          items[itemIndex] = next;
          changed = true;
        }
      } catch (error) {
        cache.entries[commandId] = {
          commandId,
          fetchedAtMs: getServerNowMs(),
          sourceUrl: commandUrl,
          unresolved: true,
        };
        cacheDirty = true;
        failed += 1;
      }
    }

    if (cacheDirty) {
      saveCommandRouteDetailsCache(cache);
    }
    if (!changed) return dump;
    return {
      ...dump,
      items,
      routeDetailsStats: {
        fetched,
        cacheHits,
        failed,
      },
    };
  };

  const extractSupportUnitsFromCommandDoc = (doc, speedModel = null) => {
    const extractUnitFromUnitItemClass = (classValue) => {
      const tokens = String(classValue || "")
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
      for (const token of tokens) {
        const match = token.match(/^unit-item-([a-z_]+)$/i);
        if (!match || !match[1]) continue;
        const unit = normalizeUnitKeyForSupportCalc(match[1]);
        if (unit) return unit;
      }
      return null;
    };
    const extractStrictUnitsFromUnitItemRows = () => {
      const candidates = [];
      const rows = Array.from(
        doc.querySelectorAll("#content_value table tr, #content_value tr"),
      );
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
          const textCount = parseStrictIntegerText(cleanText(cell.textContent));
          const count = Math.max(
            0,
            Number.isFinite(dataCount) ? dataCount : 0,
            Number.isFinite(textCount) ? textCount : 0,
          );
          if (!count) return;
          if (!isUnitAllowedInWorld(unit, speedModel)) return;
          units[unit] = Math.max(0, toInt(units[unit]) || 0) + count;
        });
        const normalized = normalizeSupportUnitsMap(units, speedModel);
        const total = sumSupportUnits(normalized);
        if (total <= 0) return;
        candidates.push({
          units: normalized,
          total,
        });
      });
      if (!candidates.length) return {};
      candidates.sort((a, b) => b.total - a.total);
      return normalizeSupportUnitsMap(candidates[0].units, speedModel);
    };

    const strictUnits = extractStrictUnitsFromUnitItemRows();
    if (Object.keys(strictUnits).length) return strictUnits;
    return {};
  };

  const getCommandIdFromIncoming = (incoming) => {
    const direct = cleanText(incoming && incoming.id);
    if (direct) return direct;
    const byUrl = cleanText(
      getUrlParam(cleanText(incoming && incoming.commandUrl), "id"),
    );
    return byUrl || null;
  };

  const buildInfoCommandUrlForIncoming = (incoming) => {
    const rawUrl = cleanText(incoming && incoming.commandUrl);
    if (rawUrl) {
      return safe(() => new URL(rawUrl, location.origin).toString(), null);
    }
    const commandId = getCommandIdFromIncoming(incoming);
    if (!commandId) return null;
    return buildGameUrl({
      screen: "info_command",
      id: commandId,
      type: "other",
    });
  };

  const applySupportCommandDetailsToIncoming = (
    incoming,
    details,
    speedModel = null,
  ) => {
    const units = normalizeSupportUnitsMap(
      details && details.units,
      speedModel,
    );
    const totalUnits = sumSupportUnits(units);
    if (!totalUnits) return incoming;

    const existingIcons =
      incoming &&
      incoming.unitIconsByKey &&
      typeof incoming.unitIconsByKey === "object"
        ? incoming.unitIconsByKey
        : {};
    const unitIconsByKey = { ...existingIcons };
    Object.keys(units).forEach((unit) => {
      if (!unitIconsByKey[unit]) {
        unitIconsByKey[unit] = getUnitIconFallback(unit);
      }
    });

    const dominantUnit = getDominantSupportUnit(units);
    const detected = Array.from(
      new Set(
        [
          ...(Array.isArray(incoming && incoming.detectedUnits)
            ? incoming.detectedUnits
            : []),
          ...Object.keys(units),
        ]
          .map((unit) => String(unit || "").toLowerCase())
          .filter(
            (unit) =>
              isUnitAllowedInWorld(unit, speedModel) && unit !== "militia",
          ),
      ),
    );

    const guessedUnit =
      dominantUnit || cleanText(incoming && incoming.guessedUnit) || null;
    const guessedUnitIcon = guessedUnit
      ? unitIconsByKey[guessedUnit] || getUnitIconFallback(guessedUnit)
      : cleanText(incoming && incoming.guessedUnitIcon) || null;

    return {
      ...incoming,
      supportUnits: units,
      supportUnitCount: totalUnits,
      supportDetailsSource: "info_command",
      detectedUnits: detected,
      unitIconsByKey,
      guessedUnit,
      guessedUnitIcon,
      tinyUnitIcon:
        guessedUnitIcon || cleanText(incoming && incoming.tinyUnitIcon) || null,
    };
  };

  const enrichSupportIncomingsWithCommandDetails = async (
    supportIncomings,
    speedModel = null,
  ) => {
    if (!supportIncomings || !Array.isArray(supportIncomings.items))
      return supportIncomings;

    const nowMs = getServerNowMs();
    const cache = loadSupportCommandDetailsCache(speedModel);
    let cacheDirty = false;
    let fetched = 0;
    let cacheHits = 0;
    let failed = 0;

    Object.entries(cache.entries).forEach(([commandId, entry]) => {
      const fetchedAtMs = Number(entry && entry.fetchedAtMs);
      if (
        !Number.isFinite(fetchedAtMs) ||
        nowMs - fetchedAtMs > SUPPORT_COMMAND_DETAILS_CACHE_TTL_MS
      ) {
        delete cache.entries[commandId];
        cacheDirty = true;
      }
    });

    const items = [];
    for (const item of supportIncomings.items) {
      const isSupport =
        String((item && item.commandType) || "").toLowerCase() === "support";
      if (!isSupport) {
        items.push(item);
        continue;
      }

      const commandId = getCommandIdFromIncoming(item);
      if (!commandId) {
        items.push(item);
        continue;
      }

      const fromCache = normalizeSupportCommandDetailsEntry(
        commandId,
        cache.entries[commandId],
        speedModel,
      );
      if (
        fromCache &&
        Number.isFinite(fromCache.fetchedAtMs) &&
        nowMs - fromCache.fetchedAtMs <= SUPPORT_COMMAND_DETAILS_CACHE_TTL_MS
      ) {
        cacheHits += 1;
        items.push(
          applySupportCommandDetailsToIncoming(item, fromCache, speedModel),
        );
        continue;
      }

      const commandUrl = buildInfoCommandUrlForIncoming(item);
      if (!commandUrl) {
        items.push(item);
        continue;
      }

      try {
        const doc = await fetchDocument(commandUrl);
        const units = extractSupportUnitsFromCommandDoc(doc, speedModel);
        const totalUnits = sumSupportUnits(units);
        if (totalUnits > 0) {
          const details = {
            commandId,
            fetchedAtMs: getServerNowMs(),
            sourceUrl: commandUrl,
            units,
            totalUnits,
          };
          cache.entries[commandId] = details;
          cacheDirty = true;
          fetched += 1;
          items.push(
            applySupportCommandDetailsToIncoming(item, details, speedModel),
          );
        } else {
          failed += 1;
          items.push(item);
        }
      } catch (error) {
        failed += 1;
        items.push(item);
      }
    }

    if (cacheDirty) {
      saveSupportCommandDetailsCache(cache);
    }

    return {
      ...supportIncomings,
      items,
      supportDetailsStats: {
        fetched,
        cacheHits,
        failed,
      },
    };
  };

  const getImageBase = () => {
    const base = String(window.image_base || "/graphic/");
    return base.endsWith("/") ? base : `${base}/`;
  };

  const getUnitIconFallback = (unit) =>
    unit
      ? `${getImageBase()}unit/tiny/${String(unit).toLowerCase()}.webp`
      : null;

  const getUnitLabel = (unit) =>
    UNIT_META[String(unit || "").toLowerCase()] &&
    UNIT_META[String(unit || "").toLowerCase()].label
      ? UNIT_META[String(unit || "").toLowerCase()].label
      : String(unit || "");

  const getGameDataUnits = () =>
    Array.isArray(window.game_data && window.game_data.units)
      ? window.game_data.units
          .map((unit) => String(unit || "").toLowerCase())
          .filter(Boolean)
      : [];

  const isArchersEnabledFromModelOrGameData = (speedModel = null) => {
    const modelFlag =
      speedModel &&
      speedModel.unitFlags &&
      typeof speedModel.unitFlags.archer === "boolean"
        ? speedModel.unitFlags.archer
        : null;
    if (typeof modelFlag === "boolean") return modelFlag;
    const units = getGameDataUnits();
    return units.includes("archer") || units.includes("marcher");
  };

  const isUnitAllowedInWorld = (unit, speedModel = null) => {
    const key = String(unit || "").toLowerCase();
    if (!key) return false;
    if (key === "militia") return false;
    if (
      (key === "archer" || key === "marcher") &&
      !isArchersEnabledFromModelOrGameData(speedModel)
    ) {
      return false;
    }
    return true;
  };

  const normalizeUnitsForWorld = (units, speedModel = null) =>
    Array.from(
      new Set(
        (Array.isArray(units) ? units : [])
          .map((unit) => String(unit || "").toLowerCase())
          .filter((unit) => isUnitAllowedInWorld(unit, speedModel)),
      ),
    );

  const actionUsesSigil = (action) => action === "slice";

  const normalizeSigilPercent = (value) => {
    const numeric = Number(
      String(value == null ? "" : value).replace(",", "."),
    );
    if (!Number.isFinite(numeric)) return 0;
    return Math.min(100, Math.max(0, Number(numeric.toFixed(2))));
  };

  const selectPreferredSigilPercent = (...candidates) => {
    for (let index = 0; index < candidates.length; index += 1) {
      const normalized = normalizeSigilPercent(candidates[index]);
      if (normalized > 0) return normalized;
    }
    return 0;
  };

  const selectPreferredPositiveSigilPercent = (...candidates) => {
    for (let index = 0; index < candidates.length; index += 1) {
      const raw = candidates[index];
      if (raw === null || raw === undefined || raw === "") continue;
      const normalized = normalizeSigilPercent(raw);
      if (normalized > 0) return normalized;
    }
    return null;
  };

  const extractSigilPercentsFromText = (text) => {
    const source = String(text || "");
    if (!source) return [];

    const values = [];
    const patterns = [
      /(?:сигил|sigil|дружб\w*|friendship)[^%\n\r]{0,140}?([+\-]?\d{1,3}(?:[.,]\d{1,2})?)\s*%/gi,
      /(?:сигил|sigil|дружб\w*|friendship)[^%\n\r]{0,80}?([+\-]?\d{1,3}(?:[.,]\d{1,2})?)/gi,
    ];

    const matches = [];
    const seen = new Set();
    patterns.forEach((re) => {
      let match;
      while ((match = re.exec(source))) {
        if (!match || match[1] == null) continue;
        const value = normalizeSigilPercent(match[1]);
        if (!Number.isFinite(value)) continue;
        const key = `${match.index}:${value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        matches.push({
          index: match.index,
          value,
        });
      }
    });

    matches.sort((a, b) => a.index - b.index);
    matches.forEach((item) => {
      if (!values.includes(item.value)) values.push(item.value);
    });
    return values;
  };

  const extractSigilPercentFromText = (text) => {
    const values = extractSigilPercentsFromText(text);
    if (!values.length) return null;
    return values[0];
  };

  const parseTribeLevelInitPayload = (scriptText) => {
    const source = String(scriptText || "");
    const marker = "TribeLevelScreen.init(";
    const markerIndex = source.indexOf(marker);
    if (markerIndex < 0) return null;

    let start = markerIndex + marker.length;
    while (start < source.length && /\s/.test(source[start])) start += 1;
    if (source[start] !== "{") return null;

    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;

    for (let i = start; i < source.length; i += 1) {
      const ch = source[i];
      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") {
          escaped = true;
          continue;
        }
        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "{") {
        depth += 1;
        continue;
      }
      if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end < 0) return null;
    const jsonText = source.slice(start, end + 1);
    return safe(() => JSON.parse(jsonText), null);
  };

  const getFriendshipValueFromTribeLevelPayload = (payload) => {
    if (!payload || typeof payload !== "object") return null;

    const skills =
      payload.skills && typeof payload.skills === "object"
        ? payload.skills
        : {};
    const activeSkills =
      payload.player &&
      payload.player.active_skills &&
      typeof payload.player.active_skills === "object"
        ? payload.player.active_skills
        : {};

    const friendshipEntry = Object.entries(skills).find(([, skill]) =>
      /дружб\w*|friendship/i.test(cleanText(skill && skill.name) || ""),
    );
    if (!friendshipEntry) return null;

    const [friendshipSkillKey, friendshipSkill] = friendshipEntry;
    const friendshipSkillId =
      toInt(friendshipSkill && friendshipSkill.id) ||
      toInt(friendshipSkillKey);
    if (!Number.isFinite(friendshipSkillId)) return null;

    const activeEntry = Object.values(activeSkills).find(
      (entry) => toInt(entry && entry.skill_id) === friendshipSkillId,
    );
    if (!activeEntry) return 0;

    const activeLevel = toInt(activeEntry.level);
    if (!Number.isFinite(activeLevel) || activeLevel <= 0) return 0;

    const expiresSeconds = toInt(activeEntry.expires);
    if (Number.isFinite(expiresSeconds) && expiresSeconds > 0) {
      const nowSeconds = Math.floor(getServerNowMs() / 1000);
      if (Number.isFinite(nowSeconds) && expiresSeconds <= nowSeconds) {
        return 0;
      }
    }

    const magnitudes =
      friendshipSkill &&
      friendshipSkill.effect_magnitudes &&
      friendshipSkill.effect_magnitudes[String(activeLevel)];
    if (Array.isArray(magnitudes) && magnitudes.length) {
      const nums = magnitudes
        .map((value) => toNumber(value))
        .filter((value) => Number.isFinite(value));
      if (nums.length) return normalizeSigilPercent(nums[0]);
    }
    if (Number.isFinite(toNumber(magnitudes))) {
      return normalizeSigilPercent(magnitudes);
    }

    const levelDescription =
      friendshipSkill &&
      friendshipSkill.level_descriptions &&
      friendshipSkill.level_descriptions[String(activeLevel)];
    if (Array.isArray(levelDescription)) {
      const fromDesc = extractSigilPercentsFromText(levelDescription.join(" "));
      if (fromDesc.length) return normalizeSigilPercent(fromDesc[0]);
    } else if (levelDescription) {
      const fromDesc = extractSigilPercentsFromText(String(levelDescription));
      if (fromDesc.length) return normalizeSigilPercent(fromDesc[0]);
    }

    return normalizeSigilPercent(activeLevel);
  };

  const getActiveFriendshipPercentFromLevelPage = (doc) => {
    if (!doc) return null;
    const scriptText = Array.from(doc.querySelectorAll("script"))
      .map((node) => node.textContent || "")
      .join("\n");
    const payload = parseTribeLevelInitPayload(scriptText);
    return getFriendshipValueFromTribeLevelPayload(payload);
  };

  const getCurrentPageAuthoritativeSigilPercent = () => {
    const value = getActiveFriendshipPercentFromLevelPage(document);
    return Number.isFinite(value) ? normalizeSigilPercent(value) : null;
  };

  const detectActiveSigilPercent = () => {
    const authoritativePageValue = getCurrentPageAuthoritativeSigilPercent();
    if (Number.isFinite(authoritativePageValue)) {
      return authoritativePageValue;
    }

    const candidates = [];
    const pushCandidate = (value) => {
      const parsed = normalizeSigilPercent(value);
      if (Number.isFinite(parsed) && parsed > 0) candidates.push(parsed);
    };

    const direct = [
      safe(() => window.game_data.player.sigil, null),
      safe(() => window.game_data.player.sigil_bonus, null),
      safe(() => window.game_data.village.sigil, null),
      safe(() => window.sigil, null),
      safe(() => window.sigil_bonus, null),
    ];
    direct.forEach((value) => {
      if (value !== null && value !== undefined && value !== "")
        pushCandidate(value);
    });

    const sigilNodes = Array.from(
      document.querySelectorAll(
        "[title*='сигил' i],[title*='sigil' i],[title*='дружб' i],[title*='friendship' i],[class*='sigil'],[class*='friendship'],[id*='sigil'],[id*='friendship'],[data-sigil],[data-sigil-value],[data-friendship],[data-friendship-value]",
      ),
    ).slice(0, 100);

    sigilNodes.forEach((node) => {
      if (node.closest && node.closest("#scriptmm-overlay-root")) return;
      const explicitData =
        cleanText(node.getAttribute("data-sigil")) ||
        cleanText(node.getAttribute("data-sigil-value")) ||
        cleanText(node.getAttribute("data-friendship")) ||
        cleanText(node.getAttribute("data-friendship-value"));
      if (explicitData) pushCandidate(explicitData);

      const extracted = extractSigilPercentFromText(
        `${cleanText(node.getAttribute("title")) || ""} ${cleanText(node.textContent) || ""}`,
      );
      if (Number.isFinite(extracted)) pushCandidate(extracted);
    });

    if (!candidates.length) return 0;
    return normalizeSigilPercent(Math.max(...candidates));
  };

  const detectNearestSigilPercentAboveNode = (node) => {
    if (
      !node ||
      !node.isConnected ||
      typeof document.createRange !== "function"
    )
      return null;

    const scope =
      (node.closest &&
        node.closest(
          "[id^='post_'], .post, .forum_post, .thread_post, .mail, .message, .mail_report, #content_value",
        )) ||
      document.querySelector("#content_value") ||
      document.body;
    if (!scope || !scope.contains(node)) return null;

    let textBefore = "";
    try {
      const range = document.createRange();
      range.setStart(scope, 0);
      range.setEndBefore(node);
      textBefore = String(range.toString() || "");
    } catch (error) {
      textBefore = String(scope.textContent || "");
    }
    if (!textBefore) return null;

    const patterns = [
      /(?:сигил|sigil|дружб\w*|friendship)[^%\n\r]{0,140}?([+\-]?\d{1,3}(?:[.,]\d{1,2})?)\s*%/gi,
      /(?:сигил|sigil|дружб\w*|friendship)[^%\n\r]{0,80}?([+\-]?\d{1,3}(?:[.,]\d{1,2})?)/gi,
    ];
    const matches = [];
    patterns.forEach((re) => {
      let match;
      while ((match = re.exec(textBefore))) {
        if (!match || match[1] == null) continue;
        const value = normalizeSigilPercent(match[1]);
        if (!Number.isFinite(value)) continue;
        matches.push({
          index: match.index,
          value,
        });
      }
    });
    if (!matches.length) return null;
    matches.sort((a, b) => a.index - b.index);
    return normalizeSigilPercent(matches[matches.length - 1].value);
  };

  const getCurrentForumThreadCacheKey = () => {
    if (!isForumThreadPlanningScreen()) return null;
    const threadId = cleanText(getUrlParam(location.href, "thread_id"));
    if (!threadId) return null;
    const world =
      cleanText(safe(() => window.game_data.world, null)) ||
      cleanText(location.host) ||
      "world";
    return `${world}:${threadId}`;
  };

  const isCurrentForumThreadFirstPage = () => {
    if (!isForumThreadPlanningScreen()) return false;
    const pageRaw = cleanText(getUrlParam(location.href, "page"));
    if (!pageRaw) return true;
    const page = toInt(pageRaw);
    return Number.isFinite(page) && page <= 0;
  };

  const buildForumThreadFirstPageUrl = () => {
    if (!isForumThreadPlanningScreen()) return null;
    return safe(() => {
      const url = new URL(location.href, location.origin);
      url.searchParams.set("page", "0");
      url.searchParams.delete("answer");
      url.searchParams.delete("quote_id");
      url.searchParams.delete("edit_post_id");
      url.hash = "";
      return url.toString();
    }, null);
  };

  const getCachedForumThreadSigilPercent = () => {
    const key = getCurrentForumThreadCacheKey();
    if (!key || state.forumThreadSigilCacheKey !== key) return null;
    const value = normalizeSigilPercent(state.forumThreadSigilPercent);
    return value > 0 ? value : null;
  };

  const setCachedForumThreadSigilPercent = (value) => {
    const normalized = normalizeSigilPercent(value);
    const key = getCurrentForumThreadCacheKey();
    if (!key || normalized <= 0) return null;
    state.forumThreadSigilCacheKey = key;
    state.forumThreadSigilPercent = normalized;
    state.forumThreadSigilLoadedAtMs = getServerNowMs();
    state.detectedSigilPercent = normalized;
    return normalized;
  };

  const getForumPostBodies = (root = document) => {
    const scope =
      root.querySelector("#forum_post_list") ||
      root.querySelector("#content_value") ||
      root.body ||
      null;
    if (!scope) return [];
    return Array.from(
      scope.querySelectorAll(".post .text, #forum_post_list .text"),
    ).filter((node) => node && node.isConnected);
  };

  const extractForumFirstPostSigilPercent = (root = document) => {
    const firstPostBody = getForumPostBodies(root)[0] || null;
    if (!firstPostBody) return null;
    const text = `${safe(() => firstPostBody.innerText, "") || ""}\n${
      safe(() => firstPostBody.textContent, "") || ""
    }`;
    return selectPreferredPositiveSigilPercent(
      ...extractSigilPercentsFromText(text),
    );
  };

  const getForumThreadFirstPostSigilPercent = (root = document) => {
    if (!isForumThreadPlanningScreen()) return null;

    if (root !== document) {
      return extractForumFirstPostSigilPercent(root);
    }

    const cached = getCachedForumThreadSigilPercent();
    if (Number.isFinite(cached) && cached > 0) return cached;

    if (!isCurrentForumThreadFirstPage()) return null;

    const local = extractForumFirstPostSigilPercent(root);
    if (Number.isFinite(local) && local > 0) {
      return setCachedForumThreadSigilPercent(local);
    }
    return null;
  };

  const loadForumThreadFirstPostSigilPercent = async ({ force = false } = {}) => {
    if (!isForumThreadPlanningScreen()) return null;

    const cached = getCachedForumThreadSigilPercent();
    if (!force && Number.isFinite(cached) && cached > 0) return cached;

    const local = getForumThreadFirstPostSigilPercent(document);
    if (!force && Number.isFinite(local) && local > 0) return local;

    if (state.forumThreadSigilLoadingPromise && !force) {
      return state.forumThreadSigilLoadingPromise;
    }

    const firstPageUrl = buildForumThreadFirstPageUrl();
    if (!firstPageUrl) return null;

    state.forumThreadSigilLoadingPromise = (async () => {
      try {
        const response = await fetch(firstPageUrl, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response || !response.ok) return null;
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const parsed = extractForumFirstPostSigilPercent(doc);
        if (Number.isFinite(parsed) && parsed > 0) {
          if (DEBUG_VERBOSE_LOGS) {
            console.info(`${LOG_PREFIX} [forum-sigil][loaded-first-post]`, {
              version: VERSION,
              sigilPercent: parsed,
              url: firstPageUrl,
            });
          }
          return setCachedForumThreadSigilPercent(parsed);
        }
        if (DEBUG_VERBOSE_LOGS) {
          console.info(`${LOG_PREFIX} [forum-sigil][not-found-first-post]`, {
            version: VERSION,
            url: firstPageUrl,
          });
        }
        return null;
      } catch (error) {
        console.warn(`${LOG_PREFIX} [forum-sigil][load-failed]`, {
          version: VERSION,
          url: firstPageUrl,
          error: formatErrorText(error),
        });
        return null;
      } finally {
        state.forumThreadSigilLoadingPromise = null;
      }
    })();

    return state.forumThreadSigilLoadingPromise;
  };

  const collectSigilCandidatesFromDocument = (doc) => {
    if (!doc) return [];
    const values = [];
    const pushValue = (value) => {
      const normalized = normalizeSigilPercent(value);
      if (!Number.isFinite(normalized)) return;
      if (!values.includes(normalized)) values.push(normalized);
    };

    const bodyText = `${safe(() => doc.body.innerText, "") || ""}\n${
      safe(() => doc.body.textContent, "") || ""
    }`;
    extractSigilPercentsFromText(bodyText).forEach(pushValue);

    const sigilNodes = Array.from(
      doc.querySelectorAll(
        "[title*='сигил' i],[title*='sigil' i],[title*='дружб' i],[title*='friendship' i],[class*='sigil'],[class*='friendship'],[id*='sigil'],[id*='friendship'],[data-sigil],[data-sigil-value],[data-friendship],[data-friendship-value]",
      ),
    ).slice(0, 200);
    sigilNodes.forEach((node) => {
      const explicitData =
        cleanText(node.getAttribute("data-sigil")) ||
        cleanText(node.getAttribute("data-sigil-value")) ||
        cleanText(node.getAttribute("data-friendship")) ||
        cleanText(node.getAttribute("data-friendship-value"));
      if (explicitData) pushValue(explicitData);
      extractSigilPercentsFromText(
        `${cleanText(node.getAttribute("title")) || ""} ${cleanText(node.textContent) || ""}`,
      ).forEach(pushValue);
    });

    const scriptText = Array.from(doc.querySelectorAll("script"))
      .map((node) => node.textContent || "")
      .join("\n");
    extractSigilPercentsFromText(scriptText).forEach(pushValue);

    return values;
  };

  const collectFriendshipFromLevelPage = (doc) => {
    if (!doc) return [];
    const structuredValue = getActiveFriendshipPercentFromLevelPage(doc);
    if (Number.isFinite(structuredValue)) {
      return [normalizeSigilPercent(structuredValue)];
    }

    const values = [];
    const pushValue = (raw) => {
      const value = normalizeSigilPercent(raw);
      if (!Number.isFinite(value)) return;
      if (!values.includes(value)) values.push(value);
    };

    const rowLikeNodes = Array.from(doc.querySelectorAll("tr, li, div, td"));
    rowLikeNodes.forEach((node) => {
      const text = cleanText(node.textContent);
      if (!text || !/(дружб\w*|friendship)/i.test(text)) return;

      extractSigilPercentsFromText(text).forEach(pushValue);

      const directNearName = text.match(
        /(?:дружб\w*|friendship)[^\d]{0,60}([+\-]?\d{1,3}(?:[.,]\d{1,2})?)/i,
      );
      if (directNearName && directNearName[1] != null)
        pushValue(directNearName[1]);
    });

    return values;
  };

  const fetchTribeSigilPercent = async () => {
    const pages = [
      {
        key: "ally_level",
        url: buildGameUrl({ screen: "ally", mode: "level" }),
      },
      {
        key: "ally_overview",
        url: buildGameUrl({ screen: "ally", mode: "overview" }),
      },
      {
        key: "ally_properties",
        url: buildGameUrl({ screen: "ally", mode: "properties" }),
      },
    ];

    const results = await Promise.allSettled(
      pages.map((item) => fetchDocument(item.url)),
    );
    let bestFallbackValue = null;
    let bestFallbackSource = null;
    let authoritativeLevelValue = null;
    const probes = {};

    results.forEach((result, index) => {
      const page = pages[index];
      if (!page) return;

      if (result.status !== "fulfilled") {
        probes[page.key] = {
          error:
            cleanText(result.reason && result.reason.message) || "fetch failed",
        };
        return;
      }

      const genericValues = collectSigilCandidatesFromDocument(result.value);
      const levelValues =
        page.key === "ally_level"
          ? collectFriendshipFromLevelPage(result.value)
          : [];
      const values =
        page.key === "ally_level" && levelValues.length
          ? Array.from(new Set(levelValues))
          : Array.from(new Set([...genericValues, ...levelValues]));
      probes[page.key] = values;

      if (page.key === "ally_level" && levelValues.length) {
        authoritativeLevelValue = normalizeSigilPercent(levelValues[0]);
        return;
      }

      if (!Number.isFinite(bestFallbackValue) && values.length) {
        const candidate = selectPreferredSigilPercent(...values);
        if (candidate > 0) {
          bestFallbackValue = candidate;
          bestFallbackSource = page.key;
        }
      }
    });

    return {
      value: Number.isFinite(authoritativeLevelValue)
        ? normalizeSigilPercent(authoritativeLevelValue)
        : Number.isFinite(bestFallbackValue)
          ? normalizeSigilPercent(bestFallbackValue)
        : null,
      source: Number.isFinite(authoritativeLevelValue)
        ? "ally_level.active_friendship"
        : bestFallbackSource,
      probes,
    };
  };

  let detectedPageSigilCacheValue = null;
  let detectedPageSigilCacheAtMs = 0;
  let detectedPageSigilCacheAuthoritative = false;
  const getDetectedPageSigilPercentCached = () => {
    const nowMs = Date.now();
    if (
      Number.isFinite(detectedPageSigilCacheValue) &&
      nowMs - detectedPageSigilCacheAtMs <= 1500
    ) {
      return normalizeSigilPercent(detectedPageSigilCacheValue);
    }
    const structuredLevelValue = getCurrentPageAuthoritativeSigilPercent();
    detectedPageSigilCacheAuthoritative =
      Number.isFinite(structuredLevelValue);
    const liveSigil = detectedPageSigilCacheAuthoritative
      ? structuredLevelValue
      : normalizeSigilPercent(detectActiveSigilPercent());
    detectedPageSigilCacheValue = liveSigil;
    detectedPageSigilCacheAtMs = nowMs;
    return liveSigil;
  };

  const getDefaultSigilForAction = (action) => {
    if (!actionUsesSigil(action)) return 0;
    const liveSigil = getDetectedPageSigilPercentCached();
    if (detectedPageSigilCacheAuthoritative) {
      state.detectedSigilPercent = liveSigil;
      return liveSigil;
    }
    if (liveSigil > 0) {
      state.detectedSigilPercent = liveSigil;
      return liveSigil;
    }

    const stateSigil = normalizeSigilPercent(state.detectedSigilPercent);
    if (stateSigil > 0) return stateSigil;

    const snapshotSigil = getTrustedSnapshotSigilPercent(state.snapshot);
    if (snapshotSigil > 0) {
      state.detectedSigilPercent = snapshotSigil;
      return snapshotSigil;
    }

    return stateSigil;
  };

  const getSnapshotGeneratedAtMs = (snapshot) => {
    const generatedAt = cleanText(snapshot && snapshot.generatedAt);
    if (!generatedAt) return NaN;
    return Number(safe(() => new Date(generatedAt).getTime(), NaN));
  };

  const getTrustedSnapshotSigilPercent = (snapshot) => {
    const value = normalizeSigilPercent(
      toNumber(snapshot && snapshot.sigilPercent),
    );
    if (value <= 0) return 0;
    const generatedAtMs = getSnapshotGeneratedAtMs(snapshot);
    const ageMs = getServerNowMs() - generatedAtMs;
    if (
      !Number.isFinite(generatedAtMs) ||
      !Number.isFinite(ageMs) ||
      ageMs < 0 ||
      ageMs > SIGIL_SNAPSHOT_CACHE_TTL_MS
    ) {
      return 0;
    }
    return value;
  };

  const getIncomingSigilPercent = (incoming) => {
    const raw = toNumber(
      incoming &&
        (incoming.sigilPercent ??
          incoming.friendshipPercent ??
          incoming.ownerSigilPercent),
    );
    if (!Number.isFinite(raw)) return null;
    return normalizeSigilPercent(raw);
  };

  const resolveSigilPercentForAction = (
    action,
    incoming = null,
    explicitSigilRaw = undefined,
  ) => {
    if (!actionUsesSigil(action)) return 0;
    const forcedSigil = getForcedSigilPercent();
    if (Number.isFinite(forcedSigil))
      return normalizeSigilPercent(forcedSigil);
    const explicitSigil = toNumber(explicitSigilRaw);
    if (Number.isFinite(explicitSigil))
      return normalizeSigilPercent(explicitSigil);
    const defaultSigil = normalizeSigilPercent(getDefaultSigilForAction(action));
    const incomingSigil = getIncomingSigilPercent(incoming);
    const incomingSigilSource = cleanText(
      incoming &&
        (incoming.arrivalEpochSource ||
          incoming.source ||
          incoming.sourceKind ||
          incoming.sourceUrl),
    );
    const shouldPreferIncomingSigil = Boolean(
      incoming &&
        (incoming.isHubIncoming ||
          incoming.isHubMass ||
          incoming.isTribeIncoming ||
          incoming.isTribeAllyCommand ||
          incoming.isTribeAllyPlanned ||
          incoming.isFavoriteEntry ||
          /^msg_/i.test(cleanText(incoming.id)) ||
          /(?:message|forum|mail|favorite|info_village_note|forum_auto_favorite)/i.test(
            incomingSigilSource,
          )),
    );
    if (Number.isFinite(incomingSigil) && incomingSigil > 0) {
      if (shouldPreferIncomingSigil) {
        return normalizeSigilPercent(incomingSigil);
      }
      if (defaultSigil <= 0) return normalizeSigilPercent(incomingSigil);
    }
    return defaultSigil;
  };

  const restoreDetectedSigilPercentFromSnapshot = () => {
    const structuredLevelValue = getCurrentPageAuthoritativeSigilPercent();
    if (Number.isFinite(structuredLevelValue)) {
      state.detectedSigilPercent = structuredLevelValue;
      return state.detectedSigilPercent > 0;
    }

    const snapshot = readJson(STORAGE_KEYS.snapshot);
    if (!snapshot || typeof snapshot !== "object") return false;
    const snapshotSigil = getTrustedSnapshotSigilPercent(snapshot);
    state.snapshot = {
      ...snapshot,
      sigilPercent: snapshotSigil,
      sigilSource:
        snapshotSigil > 0
          ? cleanText(snapshot.sigilSource) || "snapshot"
          : "cache_stale",
    };
    if (snapshotSigil > 0) {
      state.detectedSigilPercent = snapshotSigil;
      return true;
    }
    return false;
  };

  const isSameVillageAsIncomingTarget = (incoming, village) => {
    const incomingTargetId = toInt(incoming && incoming.targetVillageId);
    const villageId = toInt(village && village.villageId);
    if (Number.isFinite(incomingTargetId) && Number.isFinite(villageId)) {
      return incomingTargetId === villageId;
    }

    const incomingTargetCoord = parseCoord(
      incoming && (incoming.targetCoord || incoming.target),
    );
    const villageCoord = parseCoord(
      village && (village.villageCoord || village.villageName),
    );
    return Boolean(
      incomingTargetCoord &&
        villageCoord &&
        incomingTargetCoord.x === villageCoord.x &&
        incomingTargetCoord.y === villageCoord.y,
    );
  };

  const isNobleIconSrc = (iconSrc) =>
    /\/(?:command\/snob|unit\/tiny\/snob|unit\/snob|unit_snob)\.(?:webp|png|gif|jpg|jpeg)/i.test(
      String(iconSrc || ""),
    );

  const parseTimerToSeconds = (value) => {
    const text = cleanText(value);
    if (!text) return null;

    const hms = text.match(/^(\d+):([0-5]\d):([0-5]\d)$/);
    if (hms) {
      return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
    }

    const dhms = text.match(/^(\d+)\D+(\d+):([0-5]\d):([0-5]\d)$/);
    if (dhms) {
      return (
        Number(dhms[1]) * 86400 +
        Number(dhms[2]) * 3600 +
        Number(dhms[3]) * 60 +
        Number(dhms[4])
      );
    }

    return null;
  };

  const parseCommandId = (name) => {
    const match = String(name || "").match(/\[(\d+)\]/);
    return match ? match[1] : null;
  };

  const parseServerClockDomParts = () => {
    const dateText = cleanText(
      safe(() => document.querySelector("#serverDate").textContent, null),
    );
    const timeText = cleanText(
      safe(() => document.querySelector("#serverTime").textContent, null),
    );
    const dateParts = dateText ? dateText.match(/\d+/g) : null;
    const timeParts = timeText ? timeText.match(/\d+/g) : null;
    if (
      !dateParts ||
      dateParts.length < 3 ||
      !timeParts ||
      timeParts.length < 2
    ) {
      return null;
    }
    const day = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const year = Number(dateParts[2]);
    const hour = Number(timeParts[0]);
    const minute = Number(timeParts[1]);
    const second = Number(timeParts[2] || 0);
    if (
      !Number.isFinite(day) ||
      !Number.isFinite(month) ||
      !Number.isFinite(year) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      !Number.isFinite(second)
    ) {
      return null;
    }
    return { year, month, day, hour, minute, second };
  };

  const buildServerEpochMs = (
    year,
    month,
    day,
    hour,
    minute,
    second = 0,
    millisecond = 0,
  ) => {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const hh = Number(hour);
    const mm = Number(minute);
    const ss = Number(second || 0);
    const ms = Number(millisecond || 0);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      !Number.isFinite(ss) ||
      !Number.isFinite(ms)
    ) {
      return null;
    }
    const epochMs =
      Date.UTC(y, m - 1, d, hh, mm, ss, ms) - getServerUtcOffsetMs();
    return Number.isFinite(epochMs) ? epochMs : null;
  };

  const buildServerEpochMsWithOffset = (
    year,
    month,
    day,
    hour,
    minute,
    second = 0,
    millisecond = 0,
    offsetMsRaw = 0,
  ) => {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    const hh = Number(hour);
    const mm = Number(minute);
    const ss = Number(second || 0);
    const ms = Number(millisecond || 0);
    const offsetMs = Number(offsetMsRaw || 0);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(m) ||
      !Number.isFinite(d) ||
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      !Number.isFinite(ss) ||
      !Number.isFinite(ms) ||
      !Number.isFinite(offsetMs)
    ) {
      return null;
    }
    const epochMs = Date.UTC(y, m - 1, d, hh, mm, ss, ms) - offsetMs;
    return Number.isFinite(epochMs) ? epochMs : null;
  };

  const getDirectServerUtcOffsetMs = () => {
    const directOffsetCandidates = [
      safe(() => window.server_utc_diff, null),
      safe(() => window.game_data.server_utc_diff, null),
      safe(() => window.game_data.market === "ru" ? 10800 : null, null),
      safe(() => window.game_data.locale === "ru_RU" ? 10800 : null, null),
      safe(() => window.TribalWars.getGameData().server_utc_diff, null),
      safe(
        () => (window.TribalWars.getGameData().market === "ru" ? 10800 : null),
        null,
      ),
      safe(
        () =>
          window.TribalWars.getGameData().locale === "ru_RU" ? 10800 : null,
        null,
      ),
    ];
    for (let index = 0; index < directOffsetCandidates.length; index += 1) {
      const rawSeconds = Number(directOffsetCandidates[index]);
      if (!Number.isFinite(rawSeconds)) continue;
      return Math.round(rawSeconds * 1000);
    }
    const hostname = cleanText(safe(() => location.hostname, ""));
    if (/(^|\.)voynaplemyon\.(?:com|ru)$/i.test(hostname) || /voynaplemyon/i.test(hostname)) {
      return 3 * 60 * 60 * 1000;
    }
    return null;
  };

  const parseTimingServerDate = (rawValue) => {
    if (rawValue === null || rawValue === undefined) return null;
    if (rawValue instanceof Date) {
      const rawMs = rawValue.getTime();
      return Number.isFinite(rawMs) ? new Date(rawMs) : null;
    }

    const normalizeEpochMs = (value) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) return null;
      if (numeric >= 1000000000000) return Math.round(numeric);
      if (numeric >= 1000000000) return Math.round(numeric * 1000);
      return null;
    };

    const numericEpochMs = normalizeEpochMs(rawValue);
    if (Number.isFinite(numericEpochMs)) {
      const dt = new Date(numericEpochMs);
      if (Number.isFinite(dt.getTime())) return dt;
    }

    const textValue = cleanText(rawValue);
    if (!textValue) return null;

    const textEpochMs = normalizeEpochMs(textValue);
    if (Number.isFinite(textEpochMs)) {
      const dt = new Date(textEpochMs);
      if (Number.isFinite(dt.getTime())) return dt;
    }

    const parsedMs = Number(Date.parse(textValue));
    if (Number.isFinite(parsedMs)) {
      const dt = new Date(parsedMs);
      if (Number.isFinite(dt.getTime())) return dt;
    }
    return null;
  };

  let cachedServerUtcOffsetMs = null;

  const resolveApproximateServerNowMs = () => {
    const timingApi = safe(() => window.Timing, null);
    if (timingApi && typeof timingApi === "object") {
      const timingMethods = ["getCurrentServerTime", "getServerTime"];
      for (let index = 0; index < timingMethods.length; index += 1) {
        const methodName = timingMethods[index];
        if (typeof timingApi[methodName] !== "function") continue;
        const timingValue = safe(() => timingApi[methodName](), null);
        const parsedDate = parseTimingServerDate(timingValue);
        if (parsedDate) return parsedDate.getTime();
      }
      const timingProps = [
        safe(() => timingApi.currentServerTime, null),
        safe(() => timingApi.serverTime, null),
      ];
      for (let index = 0; index < timingProps.length; index += 1) {
        const parsedDate = parseTimingServerDate(timingProps[index]);
        if (parsedDate) return parsedDate.getTime();
      }
    }

    if (serverGeneratedMs) {
      const baseMs =
        Number(serverGeneratedMs) >= 1000000000000
          ? Number(serverGeneratedMs)
          : Number(serverGeneratedMs) >= 1000000000
            ? Number(serverGeneratedMs) * 1000
            : NaN;
      if (Number.isFinite(baseMs)) {
        return baseMs + (Date.now() - scriptStartMs);
      }
    }

    return null;
  };

  const getServerUtcOffsetMs = () => {
    const directOffsetMs = getDirectServerUtcOffsetMs();
    if (Number.isFinite(directOffsetMs)) {
      const offsetMs = Math.round(directOffsetMs);
      cachedServerUtcOffsetMs = offsetMs;
      return offsetMs;
    }

    if (Number.isFinite(cachedServerUtcOffsetMs)) {
      return cachedServerUtcOffsetMs;
    }

    const domParts = parseServerClockDomParts();
    const approxNowMs = resolveApproximateServerNowMs();
    if (domParts && Number.isFinite(approxNowMs)) {
      const naiveUtcMs = Date.UTC(
        domParts.year,
        domParts.month - 1,
        domParts.day,
        domParts.hour,
        domParts.minute,
        domParts.second,
        0,
      );
      const offsetMs =
        Math.round((naiveUtcMs - approxNowMs) / (60 * 1000)) * 60 * 1000;
      cachedServerUtcOffsetMs = offsetMs;
      return offsetMs;
    }

    return 0;
  };

  const getReliableServerTextUtcOffsetMs = () => {
    const directOffsetMs = getDirectServerUtcOffsetMs();
    if (Number.isFinite(directOffsetMs) && Math.abs(directOffsetMs) > 0) {
      return Math.round(directOffsetMs);
    }
    const hostname = cleanText(safe(() => location.hostname, ""));
    const world = cleanText(safe(() => window.game_data.world, ""));
    const market = cleanText(safe(() => window.game_data.market, ""));
    const locale = cleanText(safe(() => window.game_data.locale, ""));
    if (
      /^ru\d+$/i.test(world) ||
      market === "ru" ||
      locale === "ru_RU" ||
      /voynaplemyon/i.test(hostname)
    ) {
      return 3 * 60 * 60 * 1000;
    }
    const fallbackOffsetMs = getServerUtcOffsetMs();
    return Number.isFinite(fallbackOffsetMs) ? Math.round(fallbackOffsetMs) : 0;
  };

  const getServerWallClockPartsWithOffset = (dateLike, offsetMsRaw) => {
    const epochMs = Number(new Date(dateLike).getTime());
    const offsetMs = Number(offsetMsRaw || 0);
    if (!Number.isFinite(epochMs) || !Number.isFinite(offsetMs)) return null;
    const shifted = new Date(epochMs + offsetMs);
    if (!Number.isFinite(shifted.getTime())) return null;
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
      hour: shifted.getUTCHours(),
      minute: shifted.getUTCMinutes(),
      second: shifted.getUTCSeconds(),
      millisecond: shifted.getUTCMilliseconds(),
    };
  };

  const getServerWallClockDate = (dateLike) => {
    const epochMs = Number(new Date(dateLike).getTime());
    if (!Number.isFinite(epochMs)) return null;
    const shifted = new Date(epochMs + getServerUtcOffsetMs());
    return Number.isFinite(shifted.getTime()) ? shifted : null;
  };

  const getServerWallClockParts = (dateLike) => {
    const dt = getServerWallClockDate(dateLike);
    if (!dt) return null;
    return {
      year: dt.getUTCFullYear(),
      month: dt.getUTCMonth() + 1,
      day: dt.getUTCDate(),
      hour: dt.getUTCHours(),
      minute: dt.getUTCMinutes(),
      second: dt.getUTCSeconds(),
      millisecond: dt.getUTCMilliseconds(),
    };
  };

  const getServerNow = () => {
    // Критично: в первую очередь берём время только из игрового Timing API.
    const timingApi = safe(() => window.Timing, null);
    if (timingApi && typeof timingApi === "object") {
      const timingMethods = ["getCurrentServerTime", "getServerTime"];
      for (let index = 0; index < timingMethods.length; index += 1) {
        const methodName = timingMethods[index];
        if (typeof timingApi[methodName] !== "function") continue;
        const timingValue = safe(() => timingApi[methodName](), null);
        const parsedDate = parseTimingServerDate(timingValue);
        if (parsedDate) return parsedDate;
      }
      const timingProps = [
        safe(() => timingApi.currentServerTime, null),
        safe(() => timingApi.serverTime, null),
      ];
      for (let index = 0; index < timingProps.length; index += 1) {
        const parsedDate = parseTimingServerDate(timingProps[index]);
        if (parsedDate) return parsedDate;
      }
    }

    const domParts = parseServerClockDomParts();
    if (domParts) {
      const epochMs = buildServerEpochMs(
        domParts.year,
        domParts.month,
        domParts.day,
        domParts.hour,
        domParts.minute,
        domParts.second,
        0,
      );
      if (Number.isFinite(epochMs)) {
        const dt = new Date(epochMs);
        if (Number.isFinite(dt.getTime())) return dt;
      }
    }

    if (serverGeneratedMs) {
      const baseMs =
        Number(serverGeneratedMs) >= 1000000000000
          ? Number(serverGeneratedMs)
          : Number(serverGeneratedMs) >= 1000000000
            ? Number(serverGeneratedMs) * 1000
            : NaN;
      if (Number.isFinite(baseMs)) {
        const dt = new Date(baseMs + (Date.now() - scriptStartMs));
        if (Number.isFinite(dt.getTime())) return dt;
      }
    }
    return new Date(Date.now());
  };

  const saveJson = (key, value) =>
    safe(() => {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }, false);

  const readJson = (key) =>
    safe(() => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    }, null);
  const readSessionJson = (key) =>
    safe(() => {
      if (typeof sessionStorage === "undefined" || !sessionStorage) return null;
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    }, null);
  const normalizeTimingCopyHistoryEntry = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const timingCenter = cleanText(raw.timingCenter);
    if (!timingCenter) return null;
    const savedAtMsRaw = Number(raw.savedAtMs);
    const savedAtMsFromText = Number(
      safe(() => new Date(cleanText(raw.savedAt) || "").getTime(), NaN),
    );
    const savedAtMs = Number.isFinite(savedAtMsRaw)
      ? Math.round(savedAtMsRaw)
      : Number.isFinite(savedAtMsFromText)
        ? Math.round(savedAtMsFromText)
        : getServerNowMs();
    const id =
      cleanText(raw.id) ||
      `timing_copy_${savedAtMs}_${Math.random().toString(36).slice(2, 10)}`;
    return {
      id,
      savedAtMs,
      savedAt: new Date(savedAtMs).toISOString(),
      timingCenter,
      source: cleanText(raw.source) || null,
      action: cleanText(raw.action) || null,
      incomingId: cleanText(raw.incomingId) || null,
      commandId: cleanText(raw.commandId) || null,
      fromVillageCoord: cleanText(raw.fromVillageCoord) || null,
      targetCoord: cleanText(raw.targetCoord) || null,
      goUrl: cleanText(raw.goUrl) || null,
    };
  };
  const loadTimingCopyHistory = () => {
    const raw = readJson(STORAGE_KEYS.timingCopyHistory);
    return (Array.isArray(raw) ? raw : [])
      .map((entry) => normalizeTimingCopyHistoryEntry(entry))
      .filter(Boolean)
      .sort(
        (left, right) =>
          Number(right && right.savedAtMs) - Number(left && left.savedAtMs),
      )
      .slice(0, TIMING_COPY_HISTORY_MAX_ITEMS);
  };
  const saveTimingCopyHistory = (entries) =>
    saveJson(
      STORAGE_KEYS.timingCopyHistory,
      (Array.isArray(entries) ? entries : [])
        .map((entry) => normalizeTimingCopyHistoryEntry(entry))
        .filter(Boolean)
        .sort(
          (left, right) =>
            Number(right && right.savedAtMs) - Number(left && left.savedAtMs),
        )
        .slice(0, TIMING_COPY_HISTORY_MAX_ITEMS),
    );
  const appendTimingCopyHistory = (entryRaw) => {
    const normalizedEntry = normalizeTimingCopyHistoryEntry(entryRaw);
    if (!normalizedEntry) return null;
    const history = loadTimingCopyHistory();
    const dedupeKey = [
      normalizedEntry.timingCenter,
      normalizedEntry.source,
      normalizedEntry.action,
      normalizedEntry.incomingId,
      normalizedEntry.commandId,
      normalizedEntry.fromVillageCoord,
      normalizedEntry.targetCoord,
      normalizedEntry.goUrl,
    ].join("|");
    const dedupedHistory = history.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const key = [
        cleanText(entry.timingCenter) || "",
        cleanText(entry.source) || "",
        cleanText(entry.action) || "",
        cleanText(entry.incomingId) || "",
        cleanText(entry.commandId) || "",
        cleanText(entry.fromVillageCoord) || "",
        cleanText(entry.targetCoord) || "",
        cleanText(entry.goUrl) || "",
      ].join("|");
      return key !== dedupeKey;
    });
    const nextHistory = [normalizedEntry].concat(dedupedHistory);
    saveTimingCopyHistory(nextHistory);
    return normalizedEntry;
  };
  const normalizeMultiTabPresenceMap = (raw, nowMs = Date.now()) => {
    const source =
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const minActiveTs = Math.max(0, Number(nowMs) - MULTI_TAB_STALE_MS);
    const normalized = {};
    Object.entries(source).forEach(([tabIdRaw, tsRaw]) => {
      const tabId = cleanText(tabIdRaw);
      const ts = Number(tsRaw);
      if (!tabId || !Number.isFinite(ts) || ts < minActiveTs) return;
      normalized[tabId] = Math.round(ts);
    });
    return normalized;
  };
  const loadMultiTabPresenceMap = () =>
    safe(() => {
      const raw = localStorage.getItem(MULTI_TAB_PRESENCE_KEY);
      if (!raw) return {};
      return normalizeMultiTabPresenceMap(JSON.parse(raw), Date.now());
    }, {});
  const saveMultiTabPresenceMap = (mapRaw) =>
    safe(() => {
      const normalized = normalizeMultiTabPresenceMap(mapRaw, Date.now());
      if (!Object.keys(normalized).length) {
        localStorage.removeItem(MULTI_TAB_PRESENCE_KEY);
        return true;
      }
      localStorage.setItem(MULTI_TAB_PRESENCE_KEY, JSON.stringify(normalized));
      return true;
    }, false);
  const touchMultiTabPresence = () => {
    const map = loadMultiTabPresenceMap();
    map[MULTI_TAB_INSTANCE_ID] = Date.now();
    saveMultiTabPresenceMap(map);
    return map;
  };
  const removeMultiTabPresence = () => {
    const map = loadMultiTabPresenceMap();
    if (!Object.prototype.hasOwnProperty.call(map, MULTI_TAB_INSTANCE_ID))
      return true;
    delete map[MULTI_TAB_INSTANCE_ID];
    return saveMultiTabPresenceMap(map);
  };
  const getOtherActiveScriptTabsCount = () => {
    const map = loadMultiTabPresenceMap();
    return Object.keys(map).filter(
      (tabId) => String(tabId) !== String(MULTI_TAB_INSTANCE_ID),
    ).length;
  };
  const isMultiTabScriptActive = () => getOtherActiveScriptTabsCount() > 0;
  const maybeShowMultiTabWarning = ({
    force = false,
    statusTarget = null,
  } = {}) => {
    const otherTabsCount = getOtherActiveScriptTabsCount();
    if (!(otherTabsCount > 0)) return false;
    const nowMs = Date.now();
    if (
      !force &&
      Number.isFinite(Number(state.multiTabLastWarningAtMs)) &&
      nowMs - Number(state.multiTabLastWarningAtMs) < 15000
    ) {
      return true;
    }
    state.multiTabLastWarningAtMs = nowMs;
    const uiTarget = statusTarget || state.ui || null;
    if (uiTarget) {
      setStatus(uiTarget, MULTI_TAB_WARNING_TEXT);
    }
    safe(() => {
      console.warn("[ScriptMM][multi-tab]", {
        currentTab: MULTI_TAB_INSTANCE_ID,
        activeTabsTotal: otherTabsCount + 1,
      });
      return true;
    }, false);
    return true;
  };
  const stopMultiTabPresenceHeartbeat = ({ removeInstance = true } = {}) => {
    if (state.multiTabPresenceTimerId) {
      clearInterval(state.multiTabPresenceTimerId);
      state.multiTabPresenceTimerId = null;
    }
    if (removeInstance) {
      removeMultiTabPresence();
    }
  };
  const startMultiTabPresenceHeartbeat = () => {
    touchMultiTabPresence();
    if (state.multiTabPresenceTimerId) {
      clearInterval(state.multiTabPresenceTimerId);
      state.multiTabPresenceTimerId = null;
    }
    state.multiTabPresenceTimerId = setInterval(() => {
      touchMultiTabPresence();
      if (state.ui) {
        maybeShowMultiTabWarning({ force: false, statusTarget: state.ui });
      }
    }, MULTI_TAB_HEARTBEAT_INTERVAL_MS);
    if (
      !state.multiTabPresenceCleanupBound &&
      typeof window !== "undefined" &&
      window &&
      window.addEventListener
    ) {
      const cleanup = () => {
        stopMultiTabPresenceHeartbeat({ removeInstance: true });
      };
      window.addEventListener("beforeunload", cleanup);
      window.addEventListener("pagehide", cleanup);
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          touchMultiTabPresence();
        }
      });
      state.multiTabPresenceCleanupBound = true;
    }
  };
  const normalizeHubConnection = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const url = cleanText(raw.url);
    if (!url) return null;
    return {
      url,
      mode: cleanText(raw.mode) || "connect",
      connectedAt:
        cleanText(raw.connectedAt) || new Date(getServerNowMs()).toISOString(),
    };
  };
  const loadHubConnection = () =>
    normalizeHubConnection(readJson(STORAGE_KEYS.hubConnection));
  const saveHubConnection = (connection) => {
    const normalized = normalizeHubConnection(connection);
    state.hubConnection = normalized;
    if (!normalized) {
      safe(() => localStorage.removeItem(STORAGE_KEYS.hubConnection), null);
      return false;
    }
    return saveJson(STORAGE_KEYS.hubConnection, normalized);
  };
  const clearHubConnection = () => {
    state.hubConnection = null;
    safe(() => localStorage.removeItem(STORAGE_KEYS.hubConnection), null);
  };

  const PLAN_ACTIONS = ["slice", "intercept"];
  const PLAN_ACTION_LABELS = {
    slice: "Срез",
    intercept: "Перехват/атака",
  };
  const TOP_TABS = ["incomings", "plan", "hub", "tribe", "favorites", "archive"];
  const TOP_TAB_LABELS = {
    incomings: "Входящие",
    plan: "План",
    hub: "Хаб",
    tribe: "Племя",
    favorites: "Избранное",
    archive: "Статистика",
  };
  const normalizeUiSettings = (raw) => {
    const source =
      raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const normalizeHubPollIntervalMs = (value) => {
      const numeric = Math.round(Number(value));
      if (!Number.isFinite(numeric)) return HUB_SYNC_INTERVAL_DEFAULT_MS;
      return Math.min(
        HUB_SYNC_INTERVAL_MAX_MS,
        Math.max(HUB_SYNC_INTERVAL_MIN_MS, numeric),
      );
    };
    const normalizeForcedSigilPercent = (value) => {
      if (value === null || value === undefined || value === "") return null;
      const numeric = Number(String(value).replace(",", "."));
      if (!Number.isFinite(numeric)) return null;
      return normalizeSigilPercent(numeric);
    };
    const normalizeNearestSliceWindowMs = (value) => {
      const numeric = Math.round(Number(value));
      if (!Number.isFinite(numeric)) return NEAREST_SLICE_LOOKAHEAD_DEFAULT_MS;
      return Math.min(
        NEAREST_SLICE_LOOKAHEAD_MAX_MS,
        Math.max(NEAREST_SLICE_LOOKAHEAD_MIN_MS, numeric),
      );
    };
    return {
      hideHubDuplicatesByCoordTime:
        source.hideHubDuplicatesByCoordTime === undefined
          ? UI_SETTINGS_DEFAULTS.hideHubDuplicatesByCoordTime
          : Boolean(source.hideHubDuplicatesByCoordTime),
      hideHubSliceIncomings:
        source.hideHubSliceIncomings === undefined
          ? UI_SETTINGS_DEFAULTS.hideHubSliceIncomings
          : Boolean(source.hideHubSliceIncomings),
      hideHubMassIncomings:
        source.hideHubMassIncomings === undefined
          ? UI_SETTINGS_DEFAULTS.hideHubMassIncomings
          : Boolean(source.hideHubMassIncomings),
      exchangeTribeAttacks:
        source.exchangeTribeAttacks === undefined
          ? UI_SETTINGS_DEFAULTS.exchangeTribeAttacks
          : Boolean(source.exchangeTribeAttacks),
      checkSliceConflicts:
        source.checkSliceConflicts === undefined
          ? UI_SETTINGS_DEFAULTS.checkSliceConflicts
          : Boolean(source.checkSliceConflicts),
      loadPlanFromHub:
        source.loadPlanFromHub === undefined
          ? UI_SETTINGS_DEFAULTS.loadPlanFromHub
          : Boolean(source.loadPlanFromHub),
      forceSigilEnabled:
        source.forceSigilEnabled === undefined
          ? UI_SETTINGS_DEFAULTS.forceSigilEnabled
          : Boolean(source.forceSigilEnabled),
      forceSigilPercent:
        source.forceSigilPercent === undefined
          ? UI_SETTINGS_DEFAULTS.forceSigilPercent
          : normalizeForcedSigilPercent(source.forceSigilPercent),
      hubPollIntervalMs:
        source.hubPollIntervalMs === undefined
          ? UI_SETTINGS_DEFAULTS.hubPollIntervalMs
          : normalizeHubPollIntervalMs(source.hubPollIntervalMs),
      nearestSliceWindowMs:
        source.nearestSliceWindowMs === undefined
          ? UI_SETTINGS_DEFAULTS.nearestSliceWindowMs
          : normalizeNearestSliceWindowMs(source.nearestSliceWindowMs),
      favoritesEnabled:
        source.favoritesEnabled === undefined
          ? UI_SETTINGS_DEFAULTS.favoritesEnabled
          : Boolean(source.favoritesEnabled),
      plannerCommentEnabled:
        source.plannerCommentEnabled === undefined
          ? UI_SETTINGS_DEFAULTS.plannerCommentEnabled
          : Boolean(source.plannerCommentEnabled),
    };
  };
  const loadUiSettings = () => {
    const raw = readJson(STORAGE_KEYS.uiSettings);
    const normalized = normalizeUiSettings(raw);
    const migrationStateRaw = readJson(STORAGE_KEYS.uiMigrations);
    const migrationState =
      migrationStateRaw &&
      typeof migrationStateRaw === "object" &&
      !Array.isArray(migrationStateRaw)
        ? migrationStateRaw
        : {};
    const favoritesMigrationKey = UI_MIGRATION_KEYS.favoritesEnabledDefaultOn;
    if (!migrationState[favoritesMigrationKey]) {
      const shouldEnableFavorites =
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        raw.favoritesEnabled === false;
      if (shouldEnableFavorites) {
        normalized.favoritesEnabled = true;
        saveJson(STORAGE_KEYS.uiSettings, normalized);
      }
      migrationState[favoritesMigrationKey] = new Date(
        getServerNowMs(),
      ).toISOString();
      saveJson(STORAGE_KEYS.uiMigrations, migrationState);
    }
    const hubPollMigrationKey = UI_MIGRATION_KEYS.hubPollDefault70Sec;
    if (!migrationState[hubPollMigrationKey]) {
      const hasRawHubPollInterval =
        raw &&
        typeof raw === "object" &&
        !Array.isArray(raw) &&
        Object.prototype.hasOwnProperty.call(raw, "hubPollIntervalMs");
      const rawHubPollIntervalMs = hasRawHubPollInterval
        ? Math.round(Number(raw.hubPollIntervalMs))
        : null;
      const shouldApplyDefault70Sec =
        !hasRawHubPollInterval ||
        !Number.isFinite(rawHubPollIntervalMs) ||
        rawHubPollIntervalMs === HUB_SYNC_INTERVAL_LEGACY_DEFAULT_MS;
      if (shouldApplyDefault70Sec) {
        normalized.hubPollIntervalMs = HUB_SYNC_INTERVAL_DEFAULT_MS;
        saveJson(STORAGE_KEYS.uiSettings, normalized);
      }
      migrationState[hubPollMigrationKey] = new Date(
        getServerNowMs(),
      ).toISOString();
      saveJson(STORAGE_KEYS.uiMigrations, migrationState);
    }
    state.uiSettings = normalized;
    return normalized;
  };
  const saveUiSettings = () =>
    saveJson(STORAGE_KEYS.uiSettings, normalizeUiSettings(state.uiSettings));
  const getUiSetting = (key) =>
    state.uiSettings &&
    Object.prototype.hasOwnProperty.call(state.uiSettings, key)
      ? state.uiSettings[key]
      : UI_SETTINGS_DEFAULTS[key];
  const setUiSetting = (key, value) => {
    if (!key || !UI_BOOLEAN_SETTING_KEYS.has(key)) return false;
    state.uiSettings = normalizeUiSettings(state.uiSettings);
    const normalizedValue = Boolean(value);
    if (state.uiSettings[key] === normalizedValue) return false;
    state.uiSettings[key] = normalizedValue;
    saveUiSettings();
    return true;
  };
  const normalizeUiForcedSigilPercent = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(String(value).replace(",", "."));
    if (!Number.isFinite(numeric)) return null;
    return normalizeSigilPercent(numeric);
  };
  const setUiForcedSigilPercent = (value) => {
    state.uiSettings = normalizeUiSettings(state.uiSettings);
    const normalizedValue = normalizeUiForcedSigilPercent(value);
    const currentValue = normalizeUiForcedSigilPercent(
      state.uiSettings && state.uiSettings.forceSigilPercent,
    );
    if (
      (normalizedValue === null && currentValue === null) ||
      (Number.isFinite(normalizedValue) &&
        Number.isFinite(currentValue) &&
        Number(normalizedValue) === Number(currentValue))
    ) {
      return false;
    }
    state.uiSettings.forceSigilPercent = normalizedValue;
    saveUiSettings();
    return true;
  };
  const getForcedSigilPercent = () => {
    const enabled = Boolean(getUiSetting("forceSigilEnabled"));
    if (!enabled) return null;
    const value = normalizeUiForcedSigilPercent(getUiSetting("forceSigilPercent"));
    return Number.isFinite(value) ? value : null;
  };
  const normalizeHubPollIntervalMs = (value) => {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) return HUB_SYNC_INTERVAL_DEFAULT_MS;
    return Math.min(
      HUB_SYNC_INTERVAL_MAX_MS,
      Math.max(HUB_SYNC_INTERVAL_MIN_MS, numeric),
    );
  };
  const getHubSyncIntervalMs = () =>
    normalizeHubPollIntervalMs(
      state &&
        state.uiSettings &&
        Object.prototype.hasOwnProperty.call(
          state.uiSettings,
          "hubPollIntervalMs",
        )
        ? state.uiSettings.hubPollIntervalMs
        : HUB_SYNC_INTERVAL_DEFAULT_MS,
    );
  const setHubSyncIntervalMs = (value) => {
    state.uiSettings = normalizeUiSettings(state.uiSettings);
    const normalizedValue = normalizeHubPollIntervalMs(value);
    if (Number(state.uiSettings.hubPollIntervalMs) === normalizedValue)
      return false;
    state.uiSettings.hubPollIntervalMs = normalizedValue;
    saveUiSettings();
    return true;
  };
  const normalizeNearestSliceWindowMs = (value) => {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) return NEAREST_SLICE_LOOKAHEAD_DEFAULT_MS;
    return Math.min(
      NEAREST_SLICE_LOOKAHEAD_MAX_MS,
      Math.max(NEAREST_SLICE_LOOKAHEAD_MIN_MS, numeric),
    );
  };
  const getNearestSliceWindowMs = () =>
    normalizeNearestSliceWindowMs(
      state &&
        state.uiSettings &&
        Object.prototype.hasOwnProperty.call(
          state.uiSettings,
          "nearestSliceWindowMs",
        )
        ? state.uiSettings.nearestSliceWindowMs
        : NEAREST_SLICE_LOOKAHEAD_DEFAULT_MS,
    );
  const getNearestSliceWindowMinutes = () =>
    Math.max(1, Math.round(getNearestSliceWindowMs() / (60 * 1000)));
  const setNearestSliceWindowMs = (value) => {
    state.uiSettings = normalizeUiSettings(state.uiSettings);
    const normalizedValue = normalizeNearestSliceWindowMs(value);
    if (Number(state.uiSettings.nearestSliceWindowMs) === normalizedValue)
      return false;
    state.uiSettings.nearestSliceWindowMs = normalizedValue;
    saveUiSettings();
    return true;
  };
  const normalizeActiveTab = (raw) => {
    const tab = cleanText(raw);
    const normalizedTab = tab && TOP_TABS.includes(tab) ? tab : "incomings";
    if (normalizedTab === "favorites" && !getUiSetting("favoritesEnabled")) {
      return "incomings";
    }
    return normalizedTab;
  };
  const loadActiveTab = () =>
    normalizeActiveTab(readJson(STORAGE_KEYS.activeTab));
  const saveActiveTab = () =>
    saveJson(STORAGE_KEYS.activeTab, normalizeActiveTab(state.activeTab));
  const setActiveTab = (tabRaw) => {
    const nextTab = normalizeActiveTab(tabRaw);
    const changed = state.activeTab !== nextTab;
    state.activeTab = nextTab;
    saveActiveTab();
    return changed;
  };
  const loadHiddenIncomings = () => {
    const raw = readJson(STORAGE_KEYS.hiddenIncomings);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      state.hiddenIncomings = {};
      return state.hiddenIncomings;
    }
    const normalized = {};
    Object.keys(raw).forEach((key) => {
      const cleanKey = cleanText(key);
      if (!cleanKey) return;
      const value = raw[key];
      normalized[cleanKey] = value === 0 ? 0 : Number(value) || Date.now();
    });
    state.hiddenIncomings = normalized;
    return state.hiddenIncomings;
  };
  const saveHiddenIncomings = () => {
    const source =
      state.hiddenIncomings && typeof state.hiddenIncomings === "object"
        ? state.hiddenIncomings
        : {};
    saveJson(STORAGE_KEYS.hiddenIncomings, source);
  };
  const buildIncomingHideKey = (itemRaw) => {
    const item = itemRaw && typeof itemRaw === "object" ? itemRaw : {};
    const stableId =
      cleanText(item.hideId) ||
      cleanText(item.sourceIncomingId) ||
      cleanText(item.rowKey) ||
      cleanText(item.hubRowKey) ||
      cleanText(item.id);
    if (stableId) return `id:${stableId}`;
    const etaMs = toFiniteEpochMs(item.arrivalEpochMs || item.etaEpochMs);
    const fromCoord =
      normalizeCoordIdentity(item.originCoord || item.origin) || "?";
    const targetCoord =
      normalizeCoordIdentity(item.targetCoord || item.target) || "?";
    const player = cleanText(item.player) || cleanText(item.ownerNick) || "?";
    const squadHint =
      cleanText(item.squadText) ||
      cleanText(item.squadSummaryText) ||
      cleanText(item.commandLabel) ||
      cleanText(item.kindText) ||
      cleanText(item.commandType) ||
      "?";
    const guessed = cleanText(item.guessedUnit) || "";
    return [
      "fp",
      fromCoord,
      targetCoord,
      player.toLowerCase(),
      Number.isFinite(etaMs) ? String(Math.round(etaMs)) : "?",
      squadHint,
      guessed,
    ].join("|");
  };
  const isIncomingHidden = (item) => {
    const key = buildIncomingHideKey(item);
    if (!key) return false;
    const map =
      state.hiddenIncomings && typeof state.hiddenIncomings === "object"
        ? state.hiddenIncomings
        : {};
    return Boolean(map[key]);
  };
  const hideIncomingItem = (item) => {
    const key = buildIncomingHideKey(item);
    if (!key) return false;
    return hideIncomingByKey(key);
  };
  const hideIncomingByKey = (keyRaw) => {
    const key = cleanText(keyRaw);
    if (!key) return false;
    if (!state.hiddenIncomings || typeof state.hiddenIncomings !== "object") {
      state.hiddenIncomings = {};
    }
    if (state.hiddenIncomings[key]) return false;
    state.hiddenIncomings[key] = Date.now();
    saveHiddenIncomings();
    return true;
  };
  const clearAllHiddenIncomings = () => {
    state.hiddenIncomings = {};
    saveHiddenIncomings();
  };
  const loadHiddenVillageGroups = () => {
    const raw = readJson(STORAGE_KEYS.hiddenVillageGroups);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      state.hiddenVillageGroups = {};
      return state.hiddenVillageGroups;
    }
    const normalized = {};
    Object.keys(raw).forEach((key) => {
      const cleanKey = cleanText(key);
      if (!cleanKey) return;
      const value = raw[key];
      normalized[cleanKey] = value === 0 ? 0 : Number(value) || Date.now();
    });
    state.hiddenVillageGroups = normalized;
    return state.hiddenVillageGroups;
  };
  const saveHiddenVillageGroups = () => {
    const source =
      state.hiddenVillageGroups &&
      typeof state.hiddenVillageGroups === "object"
        ? state.hiddenVillageGroups
        : {};
    saveJson(STORAGE_KEYS.hiddenVillageGroups, source);
  };
  const buildVillageGroupHideKey = (groupRaw) => {
    const group = groupRaw && typeof groupRaw === "object" ? groupRaw : {};
    const coordKey = normalizeCoordIdentity(group.coordKey || group.label);
    if (coordKey) return `coord:${coordKey}`;
    const villageId = cleanText(group.villageId);
    if (villageId) return `village:${villageId}`;
    const fallback = cleanText(group.key) || cleanText(group.label);
    if (!fallback) return null;
    return `group:${fallback}`;
  };
  const isVillageGroupHiddenByKey = (keyRaw) => {
    const key = cleanText(keyRaw);
    if (!key) return false;
    const map =
      state.hiddenVillageGroups && typeof state.hiddenVillageGroups === "object"
        ? state.hiddenVillageGroups
        : {};
    return Boolean(map[key]);
  };
  const hideVillageGroupByKey = (keyRaw) => {
    const key = cleanText(keyRaw);
    if (!key) return false;
    if (
      !state.hiddenVillageGroups ||
      typeof state.hiddenVillageGroups !== "object"
    ) {
      state.hiddenVillageGroups = {};
    }
    if (state.hiddenVillageGroups[key]) return false;
    state.hiddenVillageGroups[key] = Date.now();
    saveHiddenVillageGroups();
    return true;
  };
  const clearAllHiddenVillageGroups = () => {
    state.hiddenVillageGroups = {};
    saveHiddenVillageGroups();
  };
  const cloneSerializable = (value, fallback = null) => {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return fallback;
    }
  };
  const buildCoordEtaKey = (coordRaw, etaRaw) => {
    const coord = normalizeCoordIdentity(coordRaw);
    const etaMs = toFiniteEpochMs(etaRaw);
    if (!coord || !Number.isFinite(etaMs)) return null;
    return `${coord}|${Math.round(etaMs)}`;
  };
  const buildFavoriteSourceKey = (incomingRaw) => {
    const incoming = incomingRaw && typeof incomingRaw === "object" ? incomingRaw : {};
    const sourceIncomingId =
      cleanText(incoming.sourceIncomingId) || cleanText(incoming.id) || "?";
    const originKey = normalizeCoordIdentity(incoming.originCoord || incoming.origin) || "?";
    const targetKey = normalizeCoordIdentity(incoming.targetCoord || incoming.target) || "?";
    const etaMs = toFiniteEpochMs(incoming.etaEpochMs || incoming.arrivalEpochMs);
    return ["src", sourceIncomingId, originKey, targetKey, Number.isFinite(etaMs) ? String(Math.round(etaMs)) : "?"].join("|");
  };
  const isServerOffsetShift = (leftMsRaw, rightMsRaw, toleranceMs = 60 * 1000) => {
    const leftMs = toFiniteEpochMs(leftMsRaw);
    const rightMs = toFiniteEpochMs(rightMsRaw);
    if (!Number.isFinite(leftMs) || !Number.isFinite(rightMs)) return false;
    const serverOffsetMs = Math.abs(getReliableServerTextUtcOffsetMs());
    if (!Number.isFinite(serverOffsetMs) || serverOffsetMs <= 0) return false;
    return Math.abs(Math.abs(leftMs - rightMs) - serverOffsetMs) <= toleranceMs;
  };
  const isSameFavoriteAttackWindow = (entryRaw, incomingRaw) => {
    const entry =
      entryRaw && typeof entryRaw === "object"
        ? entryRaw.incoming || entryRaw.item || entryRaw.payload || entryRaw
        : null;
    const incoming =
      incomingRaw && typeof incomingRaw === "object" ? incomingRaw : null;
    if (!entry || !incoming) return false;
    const entrySourceId =
      cleanText(entryRaw && entryRaw.sourceIncomingId) ||
      cleanText(entry.sourceIncomingId) ||
      cleanText(entry.id);
    const incomingSourceId =
      cleanText(incoming.sourceIncomingId) || cleanText(incoming.id);
    const sameSourceId =
      entrySourceId && incomingSourceId && entrySourceId === incomingSourceId;
    const entryTarget = normalizeCoordIdentity(entry.targetCoord || entry.target);
    const incomingTarget = normalizeCoordIdentity(
      incoming.targetCoord || incoming.target,
    );
    const entryOrigin = normalizeCoordIdentity(entry.originCoord || entry.origin);
    const incomingOrigin = normalizeCoordIdentity(
      incoming.originCoord || incoming.origin,
    );
    const sameRoute =
      entryTarget &&
      incomingTarget &&
      entryTarget === incomingTarget &&
      (!entryOrigin || !incomingOrigin || entryOrigin === incomingOrigin);
    if (!sameSourceId && !sameRoute) return false;
    const entryEtaMs = toFiniteEpochMs(entry.etaEpochMs || entry.arrivalEpochMs);
    const incomingEtaMs = toFiniteEpochMs(
      incoming.etaEpochMs || incoming.arrivalEpochMs,
    );
    if (!Number.isFinite(entryEtaMs) || !Number.isFinite(incomingEtaMs)) {
      return sameSourceId;
    }
    return (
      Math.abs(entryEtaMs - incomingEtaMs) <= 3000 ||
      isServerOffsetShift(entryEtaMs, incomingEtaMs)
    );
  };
  function repairMessageFavoriteEtaMs(source, etaMs) {
    if (!source || typeof source !== "object" || !Number.isFinite(etaMs)) {
      return { etaMs, repaired: false };
    }
    const sourceKind = cleanText(source.arrivalEpochSource);
    const nowParts = getServerWallClockParts(getServerNowMs());
    if (!nowParts) return { etaMs, repaired: false };
    const favoriteTextOffsetMs = getReliableServerTextUtcOffsetMs();
    const buildFavoriteTextEpochMs = (
      year,
      month,
      day,
      hour,
      minute,
      second = 0,
      millisecond = 0,
    ) =>
      buildServerEpochMsWithOffset(
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
        favoriteTextOffsetMs,
      );

    const monthIndexToNumber = (tokenRaw) => {
      const token = String(tokenRaw || "")
        .toLowerCase()
        .replace(/\./g, "")
        .trim();
      if (!token) return null;
      const months = {
        jan: 1,
        feb: 2,
        mar: 3,
        apr: 4,
        may: 5,
        jun: 6,
        jul: 7,
        aug: 8,
        sep: 9,
        sept: 9,
        oct: 10,
        nov: 11,
        dec: 12,
        янв: 1,
        фев: 2,
        мар: 3,
        апр: 4,
        май: 5,
        мая: 5,
        июн: 6,
        июл: 7,
        авг: 8,
        сен: 9,
        сент: 9,
        окт: 10,
        ноя: 11,
        дек: 12,
      };
      return months[token] || months[token.slice(0, 3)] || null;
    };

    const parseCandidateText = (textRaw) => {
      const text = cleanText(textRaw);
      if (!text) return null;
      const currentParts = getServerWallClockParts(etaMs) || nowParts;
      const monthMatch = text.match(
        /([A-Za-zА-Яа-яёЁ]{3,}\.?)\s*(\d{1,2})\s*,?\s*(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/i,
      );
      if (monthMatch) {
        const month = monthIndexToNumber(monthMatch[1]);
        const day = toInt(monthMatch[2]);
        const year = toInt(monthMatch[3]);
        const hour = toInt(monthMatch[4]);
        const minute = toInt(monthMatch[5]);
        const second = toInt(monthMatch[6]);
        const ms = Math.max(
          0,
          toInt(monthMatch[7]) || toInt(source.arrivalMs) || 0,
        );
        if (
          Number.isFinite(month) &&
          Number.isFinite(day) &&
          Number.isFinite(year) &&
          Number.isFinite(hour) &&
          Number.isFinite(minute) &&
          Number.isFinite(second)
        ) {
          const parsedMs = buildFavoriteTextEpochMs(
            year,
            month,
            day,
            hour,
            minute,
            second,
            ms,
          );
          if (Number.isFinite(parsedMs)) {
            return { parsedMs, hour, minute, second, ms, text };
          }
        }
      }

      const numericMatch = text.match(
        /(?:(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*(?:в)?\s*)?(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/,
      );
      if (!numericMatch) return null;
      const hasDate =
        Number.isFinite(toInt(numericMatch[1])) &&
        Number.isFinite(toInt(numericMatch[2]));
      const day = hasDate ? toInt(numericMatch[1]) : currentParts.day;
      const month = hasDate ? toInt(numericMatch[2]) : currentParts.month;
      const yearRaw = toInt(numericMatch[3]);
      const year = Number.isFinite(yearRaw)
        ? yearRaw < 100
          ? 2000 + yearRaw
          : yearRaw
        : currentParts.year || nowParts.year;
      const hour = toInt(numericMatch[4]);
      const minute = toInt(numericMatch[5]);
      const second = toInt(numericMatch[6]);
      const ms = Math.max(
        0,
        toInt(numericMatch[7]) || toInt(source.arrivalMs) || 0,
      );
      if (
        !Number.isFinite(day) ||
        !Number.isFinite(month) ||
        !Number.isFinite(year) ||
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        !Number.isFinite(second)
      ) {
        return null;
      }
      const parsedMs = buildFavoriteTextEpochMs(
        year,
        month,
        day,
        hour,
        minute,
        second,
        ms,
      );
      return Number.isFinite(parsedMs)
        ? { parsedMs, hour, minute, second, ms, text }
        : null;
    };

    const rawCandidates = [
      cleanText(source.commandLabel),
      cleanText(source.rawText),
      cleanText(source.arrivalServerText),
      cleanText(source.arrivalText),
    ].filter(Boolean);
    const candidates = [];
    rawCandidates.forEach((candidate) => {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    });
    for (let index = 0; index < candidates.length; index += 1) {
      const parsed = parseCandidateText(candidates[index]);
      if (!parsed) continue;
      const currentParts = getServerWallClockParts(etaMs);
      const sameDisplayedTime =
        currentParts &&
        currentParts.hour === parsed.hour &&
        currentParts.minute === parsed.minute &&
        currentParts.second === parsed.second;
      const diffMs = Math.abs(parsed.parsedMs - etaMs);
      if (diffMs < 1000) {
        return { etaMs, repaired: false };
      }
      const serverOffsetMs = Math.abs(
        favoriteTextOffsetMs || getServerUtcOffsetMs(),
      );
      const offsetShift =
        Number.isFinite(serverOffsetMs) &&
        serverOffsetMs > 0 &&
        Math.abs(diffMs - serverOffsetMs) <= 60 * 1000;
      const trustedTextSource =
        !sourceKind ||
        /(message|forum|mail|info_village|overview_incomings|forum_auto_favorite)/i.test(
          sourceKind,
        );
      const plausibleTextShift = trustedTextSource && diffMs <= 12 * 60 * 60 * 1000;
      if (!offsetShift && (!plausibleTextShift || sameDisplayedTime)) continue;
      console.warn(`${LOG_PREFIX} [favorite-time-repair]`, {
        version: VERSION,
        sourceKind: sourceKind || null,
        from: formatTimeWithMs(etaMs),
        to: formatTimeWithMs(parsed.parsedMs),
        text: parsed.text,
        offsetMs: favoriteTextOffsetMs,
      });
      return { etaMs: parsed.parsedMs, repaired: true };
    }
    return { etaMs, repaired: false };
  }
  const normalizeFavoriteIncoming = (incomingRaw, favoriteId) => {
    const source =
      incomingRaw && typeof incomingRaw === "object"
        ? cloneSerializable(incomingRaw, null)
        : null;
    if (!source || typeof source !== "object") return null;
    const rawEtaMs = toFiniteEpochMs(source.etaEpochMs || source.arrivalEpochMs);
    const repairResult = repairMessageFavoriteEtaMs(source, rawEtaMs);
    const etaMs = Number.isFinite(repairResult.etaMs)
      ? repairResult.etaMs
      : rawEtaMs;
    if (!Number.isFinite(etaMs)) return null;
    const sourceIncomingId =
      cleanText(source.sourceIncomingId) || cleanText(source.id) || null;
    source.id = cleanText(favoriteId) || source.id;
    source.sourceIncomingId = sourceIncomingId;
    source.etaEpochMs = etaMs;
    source.arrivalEpochMs = etaMs;
    if (repairResult.repaired) {
      source.arrivalText = formatArrivalTextFromEpochMs(etaMs) || source.arrivalText;
    }
    source.serverTimeRepaired = Boolean(repairResult.repaired);
    source.isFavoriteEntry = true;
    source.isHubIncoming = false;
    source.isHubMass = false;
    source.isTribeIncoming = false;
    source.isTribeAllyCommand = false;
    source.isTribeAllyPlanned = false;
    const normalizedSigil = getIncomingSigilPercent(source);
    if (Number.isFinite(normalizedSigil)) {
      source.sigilPercent = normalizeSigilPercent(normalizedSigil);
    }
    return source;
  };
  const normalizeExternalIncoming = (incomingRaw, fallbackId = null) => {
    const source =
      incomingRaw && typeof incomingRaw === "object"
        ? cloneSerializable(incomingRaw, null)
        : null;
    if (!source || typeof source !== "object") return null;
    const etaMs = toFiniteEpochMs(source.etaEpochMs || source.arrivalEpochMs);
    const targetCoord = cleanText(source.targetCoord || source.target);
    if (!Number.isFinite(etaMs) || !targetCoord) return null;
    const normalizedId =
      cleanText(source.id) ||
      cleanText(fallbackId) ||
      `ext_${Math.random().toString(36).slice(2, 10)}`;
    const sourceIncomingId =
      cleanText(source.sourceIncomingId) || cleanText(source.id) || normalizedId;
    source.id = normalizedId;
    source.sourceIncomingId = sourceIncomingId;
    source.targetCoord = targetCoord;
    source.target = cleanText(source.target) || targetCoord;
    source.arrivalText =
      cleanText(source.arrivalText) || formatArrivalTextFromEpochMs(etaMs);
    source.etaEpochMs = etaMs;
    source.arrivalEpochMs = etaMs;
    source.commandType = cleanText(source.commandType) || "attack";
    source.displayType =
      cleanText(source.displayType) || cleanText(source.commandType) || "attack";
    source.isHubIncoming = false;
    source.isHubMass = false;
    source.isTribeIncoming = false;
    source.isTribeAllyCommand = false;
    source.isTribeAllyPlanned = false;
    source.isFavoriteEntry = false;
    const normalizedSigil = getIncomingSigilPercent(source);
    if (Number.isFinite(normalizedSigil)) {
      source.sigilPercent = normalizeSigilPercent(normalizedSigil);
    }
    return source;
  };
  const normalizeFavoriteEntry = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const id = cleanText(raw.id) || `fav_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const addedAtMs = toFiniteMs(raw.addedAtMs) || getServerNowMs();
    const comment = cleanText(raw.comment) || null;
    const incoming = normalizeFavoriteIncoming(
      raw.incoming || raw.item || raw.payload || raw,
      id,
    );
    if (!incoming) return null;
    const rawSigilCandidates = [
      toNumber(raw.sigilPercent),
      toNumber(raw.incoming && raw.incoming.sigilPercent),
      toNumber(raw.payload && raw.payload.sigilPercent),
      getIncomingSigilPercent(raw.incoming || raw.payload || raw),
    ].filter((value) => Number.isFinite(Number(value)));
    if (rawSigilCandidates.length) {
      incoming.sigilPercent = normalizeSigilPercent(
        Number(rawSigilCandidates[0]),
      );
    }
    const etaMs = toFiniteEpochMs(incoming.etaEpochMs || incoming.arrivalEpochMs);
    if (!Number.isFinite(etaMs)) return null;
    const sourceKey = incoming.serverTimeRepaired
      ? buildFavoriteSourceKey(incoming)
      : cleanText(raw.sourceKey) || buildFavoriteSourceKey(incoming);
    incoming.favoriteComment = comment;
    return {
      id,
      sourceKey,
      sourceIncomingId:
        cleanText(raw.sourceIncomingId) ||
        cleanText(incoming.sourceIncomingId) ||
        cleanText(incoming.id) ||
        null,
      comment,
      sigilPercent: Number.isFinite(getIncomingSigilPercent(incoming))
        ? normalizeSigilPercent(getIncomingSigilPercent(incoming))
        : null,
      addedAtMs,
      incoming,
      etaEpochMs: etaMs,
    };
  };
  const purgeStaleFavoriteEntries = (
    entries,
    nowMs = getServerNowMs(),
  ) => {
    const map = new Map();
    (Array.isArray(entries) ? entries : [])
      .map((item) => normalizeFavoriteEntry(item))
      .filter(Boolean)
      .forEach((entry) => {
        if (!Number.isFinite(entry.etaEpochMs) || entry.etaEpochMs <= nowMs) return;
        const key = cleanText(entry.sourceKey) || cleanText(entry.id);
        if (!key) return;
        map.set(key, entry);
      });
    return Array.from(map.values()).sort(
      (a, b) => Number(a.etaEpochMs || 0) - Number(b.etaEpochMs || 0),
    );
  };
  const loadFavoriteEntries = () => {
    const raw = readJson(STORAGE_KEYS.favorites);
    const normalized = purgeStaleFavoriteEntries(raw, getServerNowMs());
    state.favoritesEntries = normalized;
    saveJson(STORAGE_KEYS.favorites, normalized);
    return normalized;
  };
  const saveFavoriteEntries = () => {
    state.favoritesEntries = purgeStaleFavoriteEntries(
      state.favoritesEntries,
      getServerNowMs(),
    );
    return saveJson(STORAGE_KEYS.favorites, state.favoritesEntries);
  };
  const getFavoriteIncomingItems = () =>
    (Array.isArray(state.favoritesEntries) ? state.favoritesEntries : [])
      .map((entry) => normalizeFavoriteEntry(entry))
      .filter(Boolean)
      .map((entry) => {
        const item = cloneSerializable(entry.incoming, {}) || {};
        item.id = cleanText(entry.id) || item.id;
        item.sourceIncomingId =
          cleanText(entry.sourceIncomingId) ||
          cleanText(item.sourceIncomingId) ||
          cleanText(item.id) ||
          null;
        item.favoriteComment = cleanText(entry.comment) || null;
        const entrySigil = toNumber(entry && entry.sigilPercent);
        if (Number.isFinite(entrySigil)) {
          item.sigilPercent = normalizeSigilPercent(entrySigil);
        } else {
          const incomingSigil = getIncomingSigilPercent(item);
          if (Number.isFinite(incomingSigil)) {
            item.sigilPercent = normalizeSigilPercent(incomingSigil);
          }
        }
        item.isFavoriteEntry = true;
        item.etaEpochMs = Number(entry.etaEpochMs);
        item.arrivalEpochMs = Number(entry.etaEpochMs);
        return item;
      })
      .sort((a, b) => {
        const av = toFiniteEpochMs(a && (a.etaEpochMs || a.arrivalEpochMs));
        const bv = toFiniteEpochMs(b && (b.etaEpochMs || b.arrivalEpochMs));
        if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv) return av - bv;
        return String(cleanText(a && a.id) || "").localeCompare(
          String(cleanText(b && b.id) || ""),
        );
      });
  const addIncomingToFavorites = ({
    incoming,
    comment = null,
    sigilPercent = undefined,
  } = {}) => {
    const normalizedIncoming = normalizeFavoriteIncoming(
      incoming,
      `fav_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    );
    if (!normalizedIncoming) return { ok: false, reason: "incoming_invalid" };
    const sourceKey = buildFavoriteSourceKey(normalizedIncoming);
    const safeComment = cleanText(comment) || null;
    const explicitSigil = toNumber(sigilPercent);
    const resolvedSigil = Number.isFinite(explicitSigil)
      ? normalizeSigilPercent(explicitSigil)
      : resolveSigilPercentForAction("slice", normalizedIncoming);
    if (Number.isFinite(resolvedSigil)) {
      normalizedIncoming.sigilPercent = normalizeSigilPercent(resolvedSigil);
    }
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [favorite-add]`, {
        version: VERSION,
        sourceKind: cleanText(normalizedIncoming.arrivalEpochSource) || null,
        targetCoord:
          cleanText(normalizedIncoming.targetCoord || normalizedIncoming.target) ||
          null,
        originCoord:
          cleanText(normalizedIncoming.originCoord || normalizedIncoming.origin) ||
          null,
        arrivalText: cleanText(normalizedIncoming.arrivalText) || null,
        etaEpochMs: Number(normalizedIncoming.etaEpochMs) || null,
        etaServerTime: formatTimeWithMs(normalizedIncoming.etaEpochMs),
        repaired: Boolean(normalizedIncoming.serverTimeRepaired),
      });
    }
    const sourceEntries = purgeStaleFavoriteEntries(
      readJson(STORAGE_KEYS.favorites),
      getServerNowMs(),
    );
    state.favoritesEntries = sourceEntries;
    const existingIndex = sourceEntries.findIndex(
      (entry) =>
        String(cleanText(entry && entry.sourceKey) || "") ===
          String(sourceKey || "") ||
        isSameFavoriteAttackWindow(entry, normalizedIncoming),
    );
    const addedAtMs = getServerNowMs();
    if (existingIndex >= 0) {
      const existing = normalizeFavoriteEntry(sourceEntries[existingIndex]);
      if (!existing) {
        sourceEntries.splice(existingIndex, 1);
      } else {
        const existingId = cleanText(existing.id);
        const existingSourceIncomingId =
          cleanText(existing.sourceIncomingId) ||
          cleanText(existing.incoming && existing.incoming.sourceIncomingId) ||
          cleanText(normalizedIncoming.sourceIncomingId) ||
          cleanText(normalizedIncoming.id) ||
          null;
        const replacementIncoming = {
          ...normalizedIncoming,
          id: existingId || cleanText(normalizedIncoming.id),
          sourceIncomingId: existingSourceIncomingId,
          favoriteComment: safeComment,
        };
        existing.comment = safeComment;
        existing.addedAtMs = addedAtMs;
        existing.sourceKey = sourceKey;
        existing.sourceIncomingId = existingSourceIncomingId;
        existing.etaEpochMs = toFiniteEpochMs(
          replacementIncoming.etaEpochMs || replacementIncoming.arrivalEpochMs,
        );
        existing.incoming = replacementIncoming;
        if (Number.isFinite(resolvedSigil)) {
          existing.incoming.sigilPercent = normalizeSigilPercent(resolvedSigil);
          existing.sigilPercent = normalizeSigilPercent(resolvedSigil);
        }
        sourceEntries[existingIndex] = existing;
        state.favoritesEntries = sourceEntries;
        saveFavoriteEntries();
        return { ok: true, updated: true, entry: existing };
      }
    }
    const entry = normalizeFavoriteEntry({
      id: cleanText(normalizedIncoming.id),
      sourceKey,
      sourceIncomingId:
        cleanText(normalizedIncoming.sourceIncomingId) ||
        cleanText(normalizedIncoming.id) ||
        null,
      comment: safeComment,
      sigilPercent: Number.isFinite(resolvedSigil)
        ? normalizeSigilPercent(resolvedSigil)
        : null,
      addedAtMs,
      incoming: normalizedIncoming,
    });
    if (!entry) return { ok: false, reason: "entry_invalid" };
    sourceEntries.push(entry);
    state.favoritesEntries = sourceEntries;
    saveFavoriteEntries();
    return { ok: true, updated: false, entry };
  };
  const updateFavoriteByCoordEtaKey = ({
    coordEtaKey = null,
    comment = null,
    sigilPercent = undefined,
  } = {}) => {
    const key = cleanText(coordEtaKey);
    if (!key) return { ok: false, reason: "coord_eta_key_missing" };
    const sourceEntries = purgeStaleFavoriteEntries(
      readJson(STORAGE_KEYS.favorites),
      getServerNowMs(),
    );
    const safeComment = cleanText(comment) || null;
    const explicitSigil = toNumber(sigilPercent);
    const normalizedSigil = Number.isFinite(explicitSigil)
      ? normalizeSigilPercent(explicitSigil)
      : null;

    let updated = 0;
    const nextEntries = sourceEntries.map((entry) => {
      const normalized = normalizeFavoriteEntry(entry);
      if (!normalized) return null;
      const entryKey = buildCoordEtaKey(
        normalized &&
          normalized.incoming &&
          (normalized.incoming.targetCoord || normalized.incoming.target),
        normalized && normalized.etaEpochMs,
      );
      if (!entryKey || String(entryKey) !== String(key)) return normalized;
      normalized.comment = safeComment;
      if (normalized.incoming) {
        normalized.incoming.favoriteComment = safeComment;
      }
      if (Number.isFinite(normalizedSigil)) {
        normalized.sigilPercent = normalizedSigil;
        if (normalized.incoming) {
          normalized.incoming.sigilPercent = normalizedSigil;
        }
      }
      updated += 1;
      return normalized;
    }).filter(Boolean);

    if (!updated) return { ok: false, reason: "not_found" };
    state.favoritesEntries = nextEntries;
    saveFavoriteEntries();
    return { ok: true, updated };
  };
  const removeFavoriteEntryById = (favoriteIdRaw) => {
    const favoriteId = cleanText(favoriteIdRaw);
    if (!favoriteId) return false;
    const sourceEntries = purgeStaleFavoriteEntries(
      readJson(STORAGE_KEYS.favorites),
      getServerNowMs(),
    );
    const nextEntries = sourceEntries.filter(
      (entry) =>
        String(cleanText(entry && entry.id) || "") !== String(favoriteId),
    );
    if (nextEntries.length === sourceEntries.length) return false;
    state.favoritesEntries = nextEntries;
    if (String(cleanText(state.openIncomingId) || "") === String(favoriteId)) {
      state.openIncomingId = null;
    }
    saveFavoriteEntries();
    return true;
  };
  const resolveFavoriteEntryIdByIncomingId = (incomingIdRaw) => {
    const incomingId = cleanText(incomingIdRaw);
    if (!incomingId) return null;
    const findInEntries = (entriesRaw) => {
      const entries = Array.isArray(entriesRaw) ? entriesRaw : [];
      let matchedId = null;
      entries.forEach((entryRaw) => {
        if (matchedId) return;
        const entry = normalizeFavoriteEntry(entryRaw);
        if (!entry) return;
        const entryId = cleanText(entry.id);
        const sourceIncomingId = cleanText(entry.sourceIncomingId);
        if (
          String(entryId || "") === String(incomingId) ||
          String(sourceIncomingId || "") === String(incomingId)
        ) {
          matchedId = entryId || null;
        }
      });
      return matchedId;
    };

    const fromState = findInEntries(state.favoritesEntries);
    if (fromState) return fromState;

    const fromStorage = purgeStaleFavoriteEntries(
      readJson(STORAGE_KEYS.favorites),
      getServerNowMs(),
    );
    state.favoritesEntries = fromStorage;
    return findInEntries(fromStorage);
  };
  const getIncomingVillageGroupHideKeys = (itemRaw) => {
    const item = itemRaw && typeof itemRaw === "object" ? itemRaw : {};
    const keys = [];
    const coordKey = normalizeCoordIdentity(item.targetCoord || item.target);
    if (coordKey) keys.push(`coord:${coordKey}`);
    const villageId = cleanText(item.targetVillageId);
    if (villageId) keys.push(`village:${villageId}`);
    return keys;
  };
  const isIncomingInHiddenVillageGroup = (itemRaw) => {
    const keys = getIncomingVillageGroupHideKeys(itemRaw);
    if (!keys.length) return false;
    return keys.some((key) => isVillageGroupHiddenByKey(key));
  };
  const hasInlinePlanningPanelOpen = () => {
    if (typeof document === "undefined" || !document || !document.querySelector)
      return false;
    if (document.querySelector(".smm-nearest-dialog-backdrop")) return true;
    if (document.querySelector(".smm-msg-inline-panel")) return true;
    if (document.querySelector("#smm-msg-inline-fallback .smm-plan-panel"))
      return true;
    if (document.querySelector(".smm-msg-manual-inline .smm-plan-panel"))
      return true;
    return false;
  };
  const canSafelyRerenderIncomings = () => {
    if (!state.ui || !state.hasPrimaryIncomingsRender) return false;
    if (state.refreshInProgress) return false;
    if (state.activeTab !== "incomings" && state.activeTab !== "tribe")
      return false;
    if (cleanText(state.openIncomingId)) return false;
    if (hasInlinePlanningPanelOpen()) return false;
    return true;
  };
  const requestIncomingsRerender = (reason = null, { force = false } = {}) => {
    if (!state.ui || !state.hasPrimaryIncomingsRender) return false;
    if (!force && state.refreshInProgress) {
      state.pendingIncomingsRerender = true;
      state.pendingIncomingsRerenderReason =
        cleanText(reason) || state.pendingIncomingsRerenderReason || "deferred";
      return false;
    }
    if (!force && !canSafelyRerenderIncomings()) {
      state.pendingIncomingsRerender = true;
      state.pendingIncomingsRerenderReason =
        cleanText(reason) || state.pendingIncomingsRerenderReason || "deferred";
      return false;
    }
    state.pendingIncomingsRerender = false;
    state.pendingIncomingsRerenderReason = null;
    if (state.activeTab === "tribe") {
      renderTribeTab(state.ui);
      return true;
    }
    if (state.activeTab === "incomings") {
      renderIncomings(state.ui, state.incomings);
      return true;
    }
    return false;
  };
  const flushPendingIncomingsRerender = ({ force = false } = {}) => {
    if (!state.pendingIncomingsRerender) return false;
    return requestIncomingsRerender(state.pendingIncomingsRerenderReason, {
      force,
    });
  };
  const flushDeferredUiRerenders = () => {
    if (!state.ui) return;
    if (state.pendingActiveTabRerender && !hasInlinePlanningPanelOpen()) {
      state.pendingActiveTabRerender = false;
      renderActiveTab(state.ui);
    }
    if (state.pendingHubTabRerender && state.activeTab === "hub") {
      state.pendingHubTabRerender = false;
      renderHubTab(state.ui);
    }
    if (state.pendingPlanRerender && state.activeTab === "plan") {
      state.pendingPlanRerender = false;
      renderPlanTab(state.ui);
    }
    flushPendingIncomingsRerender({ force: false });
  };
  const isMobileUi = () => {
    const raw = safe(() => window.mobile, null);
    if (typeof raw === "boolean") return raw;
    if (typeof raw === "number") return raw === 1;
    if (typeof raw === "string") return /^(1|true|yes)$/i.test(raw.trim());
    return false;
  };
  const MANEUVER_STATUS = {
    waiting: "waiting",
    success: "success",
    missed: "missed",
    timingMiss: "timing_miss",
  };
  const MANEUVER_STATUS_LABELS = {
    [MANEUVER_STATUS.waiting]: "ожидание",
    [MANEUVER_STATUS.success]: "успешно",
    [MANEUVER_STATUS.missed]: "пропущен",
    [MANEUVER_STATUS.timingMiss]: "не попал в тайминг",
  };
  const FINAL_MANEUVER_STATUSES = new Set([
    MANEUVER_STATUS.success,
    MANEUVER_STATUS.missed,
    MANEUVER_STATUS.timingMiss,
  ]);

  const normalizeManeuverStatus = (status) => {
    const value = String(status || "").toLowerCase();
    if (value === MANEUVER_STATUS.success || value === "успешно")
      return MANEUVER_STATUS.success;
    if (value === MANEUVER_STATUS.missed || value === "пропущен")
      return MANEUVER_STATUS.missed;
    if (
      value === MANEUVER_STATUS.timingMiss ||
      value === "не попал в тайминг" ||
      value === "не_попал_в_тайминг"
    ) {
      return MANEUVER_STATUS.timingMiss;
    }
    return MANEUVER_STATUS.waiting;
  };
  const getManeuverStatusLabel = (status) =>
    MANEUVER_STATUS_LABELS[normalizeManeuverStatus(status)] ||
    MANEUVER_STATUS_LABELS[MANEUVER_STATUS.waiting];
  const isFinalManeuverStatus = (status) =>
    FINAL_MANEUVER_STATUSES.has(normalizeManeuverStatus(status));

  const loadPlanActions = () => {
    const raw = readJson(STORAGE_KEYS.planActions);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const normalized = {};
    Object.entries(raw).forEach(([incomingId, actionRaw]) => {
      const incomingKey = cleanText(incomingId);
      if (!incomingKey) return;
      const action = cleanText(actionRaw);
      if (action === "def") {
        normalized[incomingKey] = "slice";
        return;
      }
      if (PLAN_ACTIONS.includes(action)) {
        normalized[incomingKey] = action;
      }
    });
    return normalized;
  };

  const savePlanActions = () =>
    saveJson(STORAGE_KEYS.planActions, state.planActions);

  const getPlanAction = (incomingId) => {
    if (!incomingId) return null;
    const action = state.planActions[String(incomingId)];
    return PLAN_ACTIONS.includes(action) ? action : null;
  };

  const setPlanAction = (incomingId, action) => {
    if (!incomingId || !PLAN_ACTIONS.includes(action)) return;
    state.planActions[String(incomingId)] = action;
    savePlanActions();
  };

  const getServerNowMs = () => getServerNow().getTime();
  const resolvePayloadFetchedAtMs = (payload) => {
    if (!payload || typeof payload !== "object") return NaN;
    const fetchedAtMs = Number(payload.fetchedAtMs);
    if (Number.isFinite(fetchedAtMs) && fetchedAtMs > 0) return fetchedAtMs;
    const fetchedAtText =
      cleanText(payload.fetchedAt) || cleanText(payload.generatedAt) || null;
    if (!fetchedAtText) return NaN;
    return Number(safe(() => new Date(fetchedAtText).getTime(), NaN));
  };
  const isPayloadFreshByFetchedAt = (payload, ttlMs) => {
    if (!payload || typeof payload !== "object") return false;
    const maxAgeMs = Math.max(0, Number(ttlMs) || 0);
    if (!maxAgeMs) return false;
    const fetchedAtMs = resolvePayloadFetchedAtMs(payload);
    if (!Number.isFinite(fetchedAtMs)) return false;
    const ageMs = getServerNowMs() - fetchedAtMs;
    return Number.isFinite(ageMs) && ageMs <= maxAgeMs;
  };
  const normalizePlanAction = (action) => {
    const value = cleanText(action).toLowerCase();
    if (PLAN_ACTIONS.includes(value)) return value;
    if (/^(attack|атака|intercept|перехват)$/.test(value)) return "intercept";
    if (/^(support|подкреп|def|defence|defense|slice|срез)$/.test(value))
      return "slice";
    return "slice";
  };
  const getPlanActionLabelByKey = (action) =>
    PLAN_ACTION_LABELS[normalizePlanAction(action)] || PLAN_ACTION_LABELS.slice;
  const getManeuverTypeLabel = (action) => {
    const key = normalizePlanAction(action);
    if (key === "intercept") return "перехват/атака";
    return "срез";
  };
  const normalizeCalcDisabledUnits = (raw) => {
    const source = raw && typeof raw === "object" ? raw : null;
    const disabled = {};
    if (!source) return disabled;

    const appendUnit = (unitRaw) => {
      const unit = String(unitRaw || "")
        .toLowerCase()
        .trim();
      if (!unit) return;
      disabled[unit] = true;
    };

    if (Array.isArray(source)) {
      source.forEach(appendUnit);
      return disabled;
    }

    Object.entries(source).forEach(([unitRaw, value]) => {
      if (!value) return;
      appendUnit(unitRaw);
    });
    return disabled;
  };
  const loadCalcDisabledUnits = () => {
    const normalized = normalizeCalcDisabledUnits(
      readJson(STORAGE_KEYS.calcDisabledUnits),
    );
    state.calcDisabledUnits = normalized;
    return normalized;
  };
  const saveCalcDisabledUnits = () =>
    saveJson(STORAGE_KEYS.calcDisabledUnits, state.calcDisabledUnits || {});
  const isUnitDisabledForCalc = (unitRaw) => {
    const unit = String(unitRaw || "")
      .toLowerCase()
      .trim();
    if (!unit) return false;
    return Boolean(state.calcDisabledUnits && state.calcDisabledUnits[unit]);
  };
  const isUnitEnabledForCalc = (unitRaw) => !isUnitDisabledForCalc(unitRaw);
  const setUnitDisabledForCalc = (unitRaw, disabled) => {
    const unit = String(unitRaw || "")
      .toLowerCase()
      .trim();
    if (!unit) return false;
    if (
      !state.calcDisabledUnits ||
      typeof state.calcDisabledUnits !== "object"
    ) {
      state.calcDisabledUnits = {};
    }
    if (disabled) {
      state.calcDisabledUnits[unit] = true;
    } else {
      delete state.calcDisabledUnits[unit];
    }
    saveCalcDisabledUnits();
    return Boolean(state.calcDisabledUnits[unit]);
  };
  const toggleUnitDisabledForCalc = (unitRaw) =>
    setUnitDisabledForCalc(unitRaw, !isUnitDisabledForCalc(unitRaw));
  const normalizeUnitsMap = (units) => {
    const source = units && typeof units === "object" ? units : {};
    const normalized = {};
    Object.entries(source).forEach(([unit, count]) => {
      const unitKey = String(unit || "").toLowerCase();
      const unitCount = Math.max(0, toInt(count) || 0);
      if (!unitKey || unitCount <= 0) return;
      normalized[unitKey] = unitCount;
    });
    return normalized;
  };
  const hasNobleUnits = (units) => {
    const normalized = normalizeUnitsMap(units);
    return Math.max(0, toInt(normalized.snob) || 0) > 0;
  };
  const getInterceptWindowAfterMs = (units) => (hasNobleUnits(units) ? 100 : 50);
  const toFiniteMs = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === "boolean") return null;
    if (typeof value === "string" && !cleanText(value)) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const toFiniteEpochMs = (value) => {
    const num = toFiniteMs(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  };
  const normalizeCoordIdentity = (value) => {
    const coord = parseCoord(value);
    return coord ? coord.key : cleanText(value);
  };

  const normalizeAutoDispatchRouteSignature = (urlRaw) =>
    safe(() => {
      const url = new URL(cleanText(urlRaw), location.origin);
      if (url.pathname !== "/game.php") return null;
      const pieces = [
        `village=${cleanText(url.searchParams.get("village"))}`,
        `screen=${cleanText(url.searchParams.get("screen"))}`,
        `from=${cleanText(url.searchParams.get("from"))}`,
        `x=${cleanText(url.searchParams.get("x"))}`,
        `y=${cleanText(url.searchParams.get("y"))}`,
      ];
      const attackParts = [];
      url.searchParams.forEach((value, key) => {
        if (!/^att_/i.test(key)) return;
        attackParts.push(`${key.toLowerCase()}=${cleanText(value)}`);
      });
      attackParts.sort();
      pieces.push(`units=${attackParts.join("&")}`);
      return `${url.origin}${url.pathname}?${pieces.join("&")}`;
    }, null);

  const appendAutoDispatchParamsToUrl = (urlRaw, bridgePayload) =>
    safe(() => {
      const url = new URL(cleanText(urlRaw), location.origin);
      const payload = bridgePayload || {};
      const set = (key, value) => {
        const text = cleanText(value);
        if (text) url.searchParams.set(key, text);
      };
      set("smm_cmd_id", payload.commandId);
      set("smm_departure_ms", Number.isFinite(Number(payload.departureMs)) ? Math.round(Number(payload.departureMs)) : "");
      set("smm_action", payload.action);
      set("smm_timing_center", payload.timingCenter);
      set("smm_timing_label", payload.timingLabel);
      set("smm_timing_type", payload.timingType);
      set("smm_timing_start_ms", Number.isFinite(Number(payload.timingStartMs)) ? Math.round(Number(payload.timingStartMs)) : "");
      set("smm_timing_end_ms", Number.isFinite(Number(payload.timingEndMs)) ? Math.round(Number(payload.timingEndMs)) : "");
      set("smm_timing_point_ms", Number.isFinite(Number(payload.timingPointMs)) ? Math.round(Number(payload.timingPointMs)) : "");
      set("smm_from_village_id", payload.fromVillageId);
      set("smm_from_village_coord", payload.fromVillageCoord);
      set("smm_target_coord", payload.targetCoord);
      set("smm_comment", payload.comment);
      return url.toString();
    }, cleanText(urlRaw));

  const writeAutoDispatchBridgeForCommand = ({
    command,
    url,
    timingCenter = null,
  } = {}) => {
    const normalized = normalizeScheduledCommand(command);
    const goUrl = cleanText(url) || cleanText(normalized && normalized.goUrl);
    if (!normalized || !goUrl) return { ok: false, reason: "invalid_command" };
    const route = normalizeAutoDispatchRouteSignature(goUrl);
    if (!route) return { ok: false, reason: "invalid_route" };
    const payload = {
      version: 1,
      commandId: cleanText(normalized.id),
      route,
      departureMs: Number.isFinite(Number(normalized.departureMs))
        ? Math.round(Number(normalized.departureMs))
        : null,
      action: normalizePlanAction(normalized.action),
      fromVillageId: cleanText(normalized.fromVillageId) || null,
      fromVillageCoord: cleanText(normalized.fromVillageCoord) || null,
      targetCoord: cleanText(normalized.targetCoord) || null,
      incomingId: cleanText(normalized.incomingId) || null,
      timingLabel: cleanText(normalized.timingLabel) || null,
      timingStartMs: Number.isFinite(Number(normalized.timingStartMs))
        ? Math.round(Number(normalized.timingStartMs))
        : null,
      timingEndMs: Number.isFinite(Number(normalized.timingEndMs))
        ? Math.round(Number(normalized.timingEndMs))
        : null,
      timingPointMs: Number.isFinite(Number(normalized.timingPointMs))
        ? Math.round(Number(normalized.timingPointMs))
        : null,
      timingType: cleanText(normalized.timingType) || null,
      comment: cleanText(normalized.comment) || null,
      goUrl,
      timingCenter: cleanText(timingCenter) || null,
      createdAtMs: Math.round(getServerNowMs()),
    };
    const saved = saveJson(STORAGE_KEYS.autoDispatchBridge, payload);
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [auto-dispatch-bridge]`, {
        version: VERSION,
        saved,
        commandId: payload.commandId,
        route: payload.route,
        departureMs: payload.departureMs,
        timingCenter: payload.timingCenter,
      });
    }
    return { ok: Boolean(saved), payload };
  };

  const normalizeScheduledCommand = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const departureMs = toFiniteMs(raw.departureMs);
    if (!Number.isFinite(departureMs)) return null;
    const fromVillageId = cleanText(raw.fromVillageId);
    const fromVillageCoord = cleanText(raw.fromVillageCoord);
    const targetVillageId = cleanText(raw.targetVillageId);
    const targetCoord = cleanText(raw.targetCoord);
    const normalizedUnits = normalizeUnitsMap(raw.units);
    if (!Object.keys(normalizedUnits).length) return null;
    const action = normalizePlanAction(raw.action);
    let status = normalizeManeuverStatus(raw.status);
    const incomingEtaMs = toFiniteMs(raw.incomingEtaMs);
    const sourceIncomingId =
      cleanText(raw.sourceIncomingId) || cleanText(raw.incomingId) || null;
    const sourceIncomingEtaMs =
      toFiniteMs(raw.sourceIncomingEtaMs) ||
      (Number.isFinite(incomingEtaMs) ? incomingEtaMs : null);
    const createdAtMs = toFiniteMs(raw.createdAtMs) || getServerNowMs();
    const travelDurationMsRaw = toFiniteMs(raw.travelDurationMs);
    const travelDurationMs =
      Number.isFinite(travelDurationMsRaw) && travelDurationMsRaw >= 0
        ? travelDurationMsRaw
        : Number.isFinite(sourceIncomingEtaMs)
          ? Math.max(0, sourceIncomingEtaMs - departureMs)
          : Number.isFinite(incomingEtaMs)
            ? Math.max(0, incomingEtaMs - departureMs)
            : null;
    const timingGapMs = toFiniteMs(raw.timingGapMs);
    const timingStartMs = toFiniteMs(raw.timingStartMs);
    const timingEndMs = toFiniteMs(raw.timingEndMs);
    const timingPointMs = toFiniteMs(raw.timingPointMs);
    const sigilPercentRaw = toNumber(raw.sigilPercent);
    const sigilPercent = Number.isFinite(sigilPercentRaw)
      ? normalizeSigilPercent(sigilPercentRaw)
      : null;
    const statusUpdatedAtMs = toFiniteMs(raw.statusUpdatedAtMs);
    const checkedAtMs = toFiniteMs(raw.checkedAtMs);
    const resolvedAtMs = toFiniteMs(raw.resolvedAtMs);
    const comment = cleanText(raw.comment) || null;
    const matchedUnits = normalizeUnitsMap(raw.matchedUnits);
    const matchedCommandId = cleanText(raw.matchedCommandId);
    const matchedCommandType = cleanText(raw.matchedCommandType) || null;
    const matchedArrivalMs = toFiniteEpochMs(raw.matchedArrivalMs);
    const hasMatchEvidence = Boolean(
      matchedCommandId ||
        matchedCommandType ||
        cleanText(raw.matchedCommandTypeLabel) ||
        cleanText(raw.matchedFromCoord) ||
        cleanText(raw.matchedToCoord) ||
        cleanText(raw.matchedArrivalText) ||
        Object.keys(matchedUnits).length,
    );
    const timingMatchedByEvidence = Number.isFinite(matchedArrivalMs)
      ? isTimingMatchedByEtaMs(
          {
            action,
            incomingEtaMs,
            timingType: cleanText(raw.timingType) || null,
            timingGapMs,
            timingStartMs,
            timingEndMs,
            timingPointMs,
          },
          matchedArrivalMs,
        )
      : false;
    if (hasMatchEvidence) {
      status = timingMatchedByEvidence
        ? MANEUVER_STATUS.success
        : MANEUVER_STATUS.timingMiss;
    }
    const resolvedFromVillageId = resolveScheduledCommandFromVillageId({
      fromVillageId,
      fromVillageCoord,
    });
    const resolvedGoUrl =
      cleanText(raw.goUrl) ||
      resolveScheduledCommandGoUrl({
        fromVillageId: resolvedFromVillageId || fromVillageId || null,
        fromVillageCoord,
        targetCoord,
        units: normalizedUnits,
      }) ||
      null;

    return {
      id: cleanText(raw.id) || `cmd_${Math.random().toString(36).slice(2)}`,
      incomingId: cleanText(raw.incomingId) || null,
      sourceIncomingId,
      action,
      actionLabel:
        cleanText(raw.actionLabel) || getPlanActionLabelByKey(action),
      comment,
      status,
      statusUpdatedAtMs: Number.isFinite(statusUpdatedAtMs)
        ? statusUpdatedAtMs
        : null,
      createdAtMs,
      checkedAtMs: Number.isFinite(checkedAtMs) ? checkedAtMs : null,
      resolvedAtMs: Number.isFinite(resolvedAtMs) ? resolvedAtMs : null,
      fromVillageId: resolvedFromVillageId || fromVillageId || null,
      fromVillageCoord: fromVillageCoord || null,
      targetVillageId: targetVillageId || null,
      targetCoord: targetCoord || null,
      departureMs,
      incomingEtaMs: Number.isFinite(incomingEtaMs) ? incomingEtaMs : null,
      sourceIncomingEtaMs: Number.isFinite(sourceIncomingEtaMs)
        ? sourceIncomingEtaMs
        : null,
      travelDurationMs: Number.isFinite(travelDurationMs)
        ? Math.round(travelDurationMs)
        : null,
      timingType: cleanText(raw.timingType) || null,
      timingLabel: cleanText(raw.timingLabel) || null,
      timingGapMs: Number.isFinite(timingGapMs) ? timingGapMs : null,
      timingStartMs: Number.isFinite(timingStartMs) ? timingStartMs : null,
      timingEndMs: Number.isFinite(timingEndMs) ? timingEndMs : null,
      timingPointMs: Number.isFinite(timingPointMs) ? timingPointMs : null,
      sigilPercent,
      units: normalizedUnits,
      goUrl: resolvedGoUrl,
      matchedCommandId: matchedCommandId || null,
      matchedCommandType,
      matchedCommandTypeLabel: cleanText(raw.matchedCommandTypeLabel) || null,
      matchedArrivalMs: Number.isFinite(matchedArrivalMs)
        ? matchedArrivalMs
        : null,
      matchedArrivalText: cleanText(raw.matchedArrivalText) || null,
      matchedFromCoord: cleanText(raw.matchedFromCoord) || null,
      matchedToCoord: cleanText(raw.matchedToCoord) || null,
      matchedUnits,
    };
  };
  const diagnoseScheduledCommandForPlan = (raw, index = 0) => {
    const rawType = raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw;
    const departureMs = toFiniteMs(raw && raw.departureMs);
    const units = normalizeUnitsMap(raw && raw.units);
    const status = normalizeManeuverStatus(raw && raw.status);
    const normalized = normalizeScheduledCommand(raw);
    const normalizedStatus = normalized
      ? normalizeManeuverStatus(normalized.status)
      : null;
    const normalizedDepartureMs = normalized
      ? toFiniteMs(normalized.departureMs)
      : null;
    const nowMs = getServerNowMs();
    let reason = "ok";
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      reason = "not_object";
    } else if (!Number.isFinite(departureMs)) {
      reason = "bad_departureMs";
    } else if (!Object.keys(units).length) {
      reason = "empty_units";
    } else if (!normalized) {
      reason = "normalize_failed";
    } else if (isFinalManeuverStatus(normalized.status)) {
      reason = `final_status:${normalized.status}`;
    }
    return {
      index,
      reason,
      rawType,
      normalizedOk: Boolean(normalized),
      id: cleanText(raw && raw.id) || null,
      action: cleanText(raw && raw.action) || null,
      status,
      normalizedStatus,
      isFinal: isFinalManeuverStatus(status),
      normalizedIsFinal: isFinalManeuverStatus(normalizedStatus),
      fromVillageId: cleanText(raw && raw.fromVillageId) || null,
      fromVillageCoord: cleanText(raw && raw.fromVillageCoord) || null,
      targetCoord: cleanText(raw && raw.targetCoord) || null,
      incomingId: cleanText(raw && raw.incomingId) || null,
      departureMs: Number.isFinite(departureMs) ? Math.round(departureMs) : null,
      normalizedDepartureMs: Number.isFinite(normalizedDepartureMs)
        ? Math.round(normalizedDepartureMs)
        : null,
      departureText: Number.isFinite(departureMs)
        ? safe(() => formatDateTimeShort(departureMs), String(Math.round(departureMs)))
        : null,
      nowMs: Math.round(nowMs),
      nowText: safe(() => formatDateTimeShort(nowMs), String(Math.round(nowMs))),
      departureDeltaMs: Number.isFinite(departureMs)
        ? Math.round(departureMs - nowMs)
        : null,
      createdAtMs: Number.isFinite(toFiniteMs(raw && raw.createdAtMs))
        ? Math.round(toFiniteMs(raw && raw.createdAtMs))
        : null,
      units,
      unitsKeys: Object.keys(units),
      timingType: cleanText(raw && raw.timingType) || null,
      timingLabel: cleanText(raw && raw.timingLabel) || null,
      comment: cleanText(raw && raw.comment) || null,
      hasGoUrl: Boolean(cleanText(raw && raw.goUrl)),
      matchedCommandId: cleanText(raw && raw.matchedCommandId) || null,
      matchedCommandType: cleanText(raw && raw.matchedCommandType) || null,
      matchedArrivalMs: Number.isFinite(toFiniteMs(raw && raw.matchedArrivalMs))
        ? Math.round(toFiniteMs(raw && raw.matchedArrivalMs))
        : null,
      matchedArrivalText: cleanText(raw && raw.matchedArrivalText) || null,
    };
  };
  const createScheduledCommandId = () => {
    const existing = new Set(
      (Array.isArray(state.scheduledCommands) ? state.scheduledCommands : [])
        .map((item) => cleanText(item && item.id))
        .filter(Boolean),
    );
    const nowBase = Math.round(getServerNowMs());
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const randomPart =
        typeof crypto !== "undefined" &&
        crypto &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
          : `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
      const id = `cmd_${nowBase}_${randomPart}`;
      if (!existing.has(id)) return id;
    }
    return `cmd_${nowBase}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  };

  const getExpectedOwnCommandTypeForAction = () => "support";
  const isCommandTypeExpectedForManeuver = (maneuver, ownCommand) => {
    if (!maneuver || !ownCommand) return false;
    const expectedType = getExpectedOwnCommandTypeForAction(maneuver.action);
    return cleanText(ownCommand.type) === expectedType;
  };
  const isUnitsWithinTolerance = (
    plannedUnits,
    actualUnits,
    ratio = COMMAND_UNITS_TOLERANCE_RATIO,
  ) => {
    const source =
      plannedUnits && typeof plannedUnits === "object" ? plannedUnits : {};
    const target =
      actualUnits && typeof actualUnits === "object" ? actualUnits : {};
    const keys = Object.keys(source);
    if (!keys.length) return false;
    return keys.every((unit) => {
      const planned = Math.max(0, toInt(source[unit]) || 0);
      if (planned <= 0) return true;
      const actual = Math.max(0, toInt(target[unit]) || 0);
      const delta = planned * Math.max(0, Number(ratio) || 0);
      const min = Math.max(1, Math.floor(planned - delta));
      const max = Math.ceil(planned + delta);
      return actual >= min && actual <= max;
    });
  };
  const isUnitsTooSmallForManeuver = (
    plannedUnits,
    actualUnits,
    ratio = COMMAND_UNITS_TOLERANCE_RATIO,
  ) => {
    const source =
      plannedUnits && typeof plannedUnits === "object" ? plannedUnits : {};
    const target =
      actualUnits && typeof actualUnits === "object" ? actualUnits : {};
    const keys = Object.keys(source);
    if (!keys.length) return false;
    return keys.some((unit) => {
      const planned = Math.max(0, toInt(source[unit]) || 0);
      if (planned <= 0) return false;
      const actual = Math.max(0, toInt(target[unit]) || 0);
      const delta = planned * Math.max(0, Number(ratio) || 0);
      const min = Math.max(1, Math.floor(planned - delta));
      return actual < min;
    });
  };
  const isManeuverRouteMatch = (maneuver, ownCommand) => {
    if (!maneuver || !ownCommand) return false;
    const plannedTargetCoord = normalizeCoordIdentity(maneuver.targetCoord);
    const commandTargetCoord = normalizeCoordIdentity(ownCommand.routeToCoord);
    if (plannedTargetCoord && !commandTargetCoord) return false;
    if (
      plannedTargetCoord &&
      commandTargetCoord &&
      plannedTargetCoord !== commandTargetCoord
    )
      return false;

    const plannedVillageId = cleanText(maneuver.fromVillageId);
    const commandVillageId = cleanText(ownCommand.fromVillageId);
    const plannedVillageCoord = normalizeCoordIdentity(
      maneuver.fromVillageCoord,
    );
    const commandVillageCoord = normalizeCoordIdentity(
      ownCommand.routeFromCoord || ownCommand.fromVillageCoord,
    );
    const hasPlannedIdentity = Boolean(plannedVillageId || plannedVillageCoord);
    const hasCommandIdentity = Boolean(commandVillageId || commandVillageCoord);
    if (hasPlannedIdentity && !hasCommandIdentity) return false;

    let comparedIdentity = false;
    if (plannedVillageId && commandVillageId) {
      comparedIdentity = true;
      if (plannedVillageId !== commandVillageId) return false;
    }
    if (plannedVillageCoord && commandVillageCoord) {
      comparedIdentity = true;
      if (plannedVillageCoord !== commandVillageCoord) return false;
    }
    if (hasPlannedIdentity && hasCommandIdentity && !comparedIdentity)
      return false;
    return true;
  };
  const getManeuverTimingExpectation = (maneuver) => {
    if (!maneuver || typeof maneuver !== "object") return { mode: "any" };
    const timingType = cleanText(maneuver.timingType);
    const incomingEtaMs = toFiniteMs(maneuver.incomingEtaMs);

    if (timingType === "intercept_window") {
      let startMs = toFiniteMs(maneuver.timingStartMs);
      let endMs = toFiniteMs(maneuver.timingEndMs);
      if (
        (!Number.isFinite(startMs) || !Number.isFinite(endMs)) &&
        Number.isFinite(incomingEtaMs)
      ) {
        startMs = incomingEtaMs;
        endMs = incomingEtaMs + getInterceptWindowAfterMs(maneuver.units);
      }
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        return {
          mode: "range",
          startMs: Math.min(startMs, endMs),
          endMs: Math.max(startMs, endMs),
        };
      }
      return { mode: "any" };
    }

    if (timingType === "intercept_point") {
      const pointMs = toFiniteMs(maneuver.timingPointMs);
      if (Number.isFinite(pointMs)) {
        return {
          mode: "point",
          pointMs,
          toleranceMs: TIMING_POINT_TOLERANCE_MS,
        };
      }
      if (Number.isFinite(incomingEtaMs)) {
        return {
          mode: "point",
          pointMs: incomingEtaMs + 50,
          toleranceMs: TIMING_POINT_TOLERANCE_MS,
        };
      }
      return { mode: "any" };
    }

    if (timingType === "slice_window") {
      let startMs = toFiniteMs(maneuver.timingStartMs);
      let endMs = toFiniteMs(maneuver.timingEndMs);
      if (
        (!Number.isFinite(startMs) || !Number.isFinite(endMs)) &&
        Number.isFinite(incomingEtaMs)
      ) {
        startMs = incomingEtaMs - 100;
        endMs = incomingEtaMs;
      }
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        return {
          mode: "range",
          startMs: Math.min(startMs, endMs),
          endMs: Math.max(startMs, endMs),
        };
      }
      return { mode: "any" };
    }

    if (timingType === "slice_gap") {
      let startMs = toFiniteMs(maneuver.timingStartMs);
      let endMs = toFiniteMs(maneuver.timingEndMs);
      const gapMs = toFiniteMs(maneuver.timingGapMs);
      if (
        (!Number.isFinite(startMs) || !Number.isFinite(endMs)) &&
        Number.isFinite(incomingEtaMs) &&
        Number.isFinite(gapMs)
      ) {
        startMs = incomingEtaMs - gapMs;
        endMs = incomingEtaMs;
      }
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        return {
          mode: "range",
          startMs: Math.min(startMs, endMs),
          endMs: Math.max(startMs, endMs),
        };
      }
      return { mode: "any" };
    }

    return { mode: "any" };
  };
  const getTimingDeviationMs = (maneuver, ownCommand) => {
    const expectation = getManeuverTimingExpectation(maneuver);
    if (expectation.mode === "any") return 0;
    const etaMs = toFiniteMs(ownCommand && ownCommand.etaEpochMs);
    if (!Number.isFinite(etaMs)) return Number.MAX_SAFE_INTEGER;
    if (expectation.mode === "range") {
      if (etaMs < expectation.startMs) return expectation.startMs - etaMs;
      if (etaMs > expectation.endMs) return etaMs - expectation.endMs;
      return 0;
    }
    if (expectation.mode === "point") {
      return Math.abs(etaMs - expectation.pointMs);
    }
    return 0;
  };
  const isTimingMatchedByEtaMs = (maneuver, etaMs) => {
    const expectation = getManeuverTimingExpectation(maneuver);
    if (expectation.mode === "any") return true;
    if (!Number.isFinite(etaMs)) return false;
    if (expectation.mode === "range") {
      return etaMs >= expectation.startMs && etaMs <= expectation.endMs;
    }
    if (expectation.mode === "point") {
      const toleranceMs = Number.isFinite(expectation.toleranceMs)
        ? expectation.toleranceMs
        : TIMING_POINT_TOLERANCE_MS;
      return Math.abs(etaMs - expectation.pointMs) <= toleranceMs;
    }
    return true;
  };
  const isTimingMatchedForManeuver = (maneuver, ownCommand) => {
    const etaMs = toFiniteMs(ownCommand && ownCommand.etaEpochMs);
    return isTimingMatchedByEtaMs(maneuver, etaMs);
  };
  const scoreOwnCommandCandidate = (maneuver, ownCommand) => {
    const timingDeviation = getTimingDeviationMs(maneuver, ownCommand);
    const unitDeviation = Object.keys(maneuver.units || {}).reduce(
      (sum, unit) => {
        const planned = Math.max(0, toInt(maneuver.units[unit]) || 0);
        if (planned <= 0) return sum;
        const actual = Math.max(
          0,
          toInt(ownCommand && ownCommand.units && ownCommand.units[unit]) || 0,
        );
        return sum + Math.abs(actual - planned) / planned;
      },
      0,
    );
    const safeTiming = Number.isFinite(timingDeviation)
      ? timingDeviation
      : Number.MAX_SAFE_INTEGER;
    return safeTiming + unitDeviation * 1000;
  };
  const findMatchingOwnCommandForManeuver = ({
    maneuver,
    ownCommands,
    usedCommandIds,
    requireExpectedType = true,
    requireUnitsTolerance = true,
  }) => {
    const used = usedCommandIds instanceof Set ? usedCommandIds : new Set();
    const candidates = (Array.isArray(ownCommands) ? ownCommands : [])
      .filter((item) => {
        const commandId = cleanText(item && item.id);
        if (!commandId || used.has(commandId)) return false;
        if (
          requireExpectedType &&
          !isCommandTypeExpectedForManeuver(maneuver, item)
        )
          return false;
        if (!isManeuverRouteMatch(maneuver, item)) return false;
        if (
          requireUnitsTolerance &&
          !isUnitsWithinTolerance(maneuver.units, item.units)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        const aScore = scoreOwnCommandCandidate(maneuver, a);
        const bScore = scoreOwnCommandCandidate(maneuver, b);
        if (aScore !== bScore) return aScore - bScore;
        const aEta = toFiniteMs(a.etaEpochMs);
        const bEta = toFiniteMs(b.etaEpochMs);
        if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta)
          return aEta - bEta;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

    return candidates.length ? candidates[0] : null;
  };
  const normalizeArchivedManeuver = (raw) => {
    if (!raw || typeof raw !== "object") return null;
    const units = normalizeUnitsMap(raw.units);
    if (!Object.keys(units).length) return null;
    const action = normalizePlanAction(raw.action);
    let status = normalizeManeuverStatus(raw.status);
    if (!isFinalManeuverStatus(status)) return null;

    const id =
      cleanText(raw.id) ||
      cleanText(raw.scheduledCommandId) ||
      `arc_${Math.random().toString(36).slice(2)}`;
    const departureMs = toFiniteMs(raw.departureMs);
    const createdAtMs = toFiniteMs(raw.createdAtMs);
    const resolvedAtMs = toFiniteMs(raw.resolvedAtMs) || getServerNowMs();
    const incomingEtaMs = toFiniteMs(raw.incomingEtaMs);
    const timingGapMs = toFiniteMs(raw.timingGapMs);
    const timingStartMs = toFiniteMs(raw.timingStartMs);
    const timingEndMs = toFiniteMs(raw.timingEndMs);
    const timingPointMs = toFiniteMs(raw.timingPointMs);
    const matchedArrivalMs = toFiniteEpochMs(raw.matchedArrivalMs);
    const matchedCommandId = cleanText(raw.matchedCommandId) || null;
    const matchedCommandType = cleanText(raw.matchedCommandType) || null;
    const matchedUnits = normalizeUnitsMap(raw.matchedUnits);
    const hasMatchEvidence = Boolean(
      matchedCommandId ||
        matchedCommandType ||
        cleanText(raw.matchedCommandTypeLabel) ||
        cleanText(raw.matchedFromCoord) ||
        cleanText(raw.matchedToCoord) ||
        cleanText(raw.matchedArrivalText) ||
        Object.keys(matchedUnits).length,
    );
    const timingMatchedByEvidence = Number.isFinite(matchedArrivalMs)
      ? isTimingMatchedByEtaMs(
          {
            action,
            incomingEtaMs,
            timingType: cleanText(raw.timingType) || null,
            timingGapMs,
            timingStartMs,
            timingEndMs,
            timingPointMs,
          },
          matchedArrivalMs,
        )
      : false;
    if (hasMatchEvidence) {
      status = timingMatchedByEvidence
        ? MANEUVER_STATUS.success
        : MANEUVER_STATUS.timingMiss;
    }

    return {
      id,
      scheduledCommandId:
        cleanText(raw.scheduledCommandId) || cleanText(raw.id) || null,
      incomingId: cleanText(raw.incomingId) || null,
      action,
      actionLabel:
        cleanText(raw.actionLabel) || getPlanActionLabelByKey(action),
      status,
      statusLabel: getManeuverStatusLabel(status),
      createdAtMs: Number.isFinite(createdAtMs) ? createdAtMs : null,
      resolvedAtMs,
      fromVillageId: cleanText(raw.fromVillageId) || null,
      fromVillageCoord: cleanText(raw.fromVillageCoord) || null,
      targetCoord: cleanText(raw.targetCoord) || null,
      departureMs: Number.isFinite(departureMs) ? departureMs : null,
      incomingEtaMs: Number.isFinite(incomingEtaMs) ? incomingEtaMs : null,
      timingType: cleanText(raw.timingType) || null,
      timingLabel: cleanText(raw.timingLabel) || null,
      timingGapMs: Number.isFinite(timingGapMs) ? timingGapMs : null,
      timingStartMs: Number.isFinite(timingStartMs) ? timingStartMs : null,
      timingEndMs: Number.isFinite(timingEndMs) ? timingEndMs : null,
      timingPointMs: Number.isFinite(timingPointMs) ? timingPointMs : null,
      units,
      goUrl: cleanText(raw.goUrl) || null,
      matchedCommandId,
      matchedCommandType,
      matchedCommandTypeLabel: cleanText(raw.matchedCommandTypeLabel) || null,
      matchedArrivalMs: Number.isFinite(matchedArrivalMs)
        ? matchedArrivalMs
        : null,
      matchedArrivalText: cleanText(raw.matchedArrivalText) || null,
      matchedFromCoord: cleanText(raw.matchedFromCoord) || null,
      matchedToCoord: cleanText(raw.matchedToCoord) || null,
      matchedUnits,
    };
  };
  const getArchiveEntryKey = (entry) =>
    cleanText(entry && (entry.scheduledCommandId || entry.id)) ||
    [
      cleanText(entry && entry.action) || "",
      normalizeCoordIdentity(
        entry && (entry.fromVillageCoord || entry.fromVillageId),
      ) || "",
      normalizeCoordIdentity(entry && entry.targetCoord) || "",
      Number(entry && entry.departureMs) || 0,
    ].join("|");
  const saveArchivedManeuvers = () => {
    const normalized = (
      Array.isArray(state.archivedManeuvers) ? state.archivedManeuvers : []
    )
      .map((item) => normalizeArchivedManeuver(item))
      .filter(Boolean)
      .sort(
        (a, b) => (Number(b.resolvedAtMs) || 0) - (Number(a.resolvedAtMs) || 0),
      )
      .slice(0, ARCHIVE_MAX_ITEMS);
    state.archivedManeuvers = normalized;
    return saveJson(STORAGE_KEYS.maneuversArchive, state.archivedManeuvers);
  };
  const loadArchivedManeuvers = () => {
    const raw = readJson(STORAGE_KEYS.maneuversArchive);
    state.archivedManeuvers = (Array.isArray(raw) ? raw : [])
      .map((item) => normalizeArchivedManeuver(item))
      .filter(Boolean)
      .sort(
        (a, b) => (Number(b.resolvedAtMs) || 0) - (Number(a.resolvedAtMs) || 0),
      )
      .slice(0, ARCHIVE_MAX_ITEMS);
    saveArchivedManeuvers();
    return state.archivedManeuvers;
  };
  const appendArchivedManeuvers = (entries) => {
    const normalizedEntries = (Array.isArray(entries) ? entries : [])
      .map((entry) => normalizeArchivedManeuver(entry))
      .filter(Boolean);
    if (!normalizedEntries.length) return false;

    const archiveMap = new Map();
    (Array.isArray(state.archivedManeuvers) ? state.archivedManeuvers : [])
      .map((entry) => normalizeArchivedManeuver(entry))
      .filter(Boolean)
      .forEach((entry) => {
        archiveMap.set(getArchiveEntryKey(entry), entry);
      });
    normalizedEntries.forEach((entry) => {
      archiveMap.set(getArchiveEntryKey(entry), entry);
    });

    state.archivedManeuvers = Array.from(archiveMap.values())
      .sort(
        (a, b) => (Number(b.resolvedAtMs) || 0) - (Number(a.resolvedAtMs) || 0),
      )
      .slice(0, ARCHIVE_MAX_ITEMS);
    saveArchivedManeuvers();
    return true;
  };
  const buildArchivedManeuverEntry = (command, nowMs = getServerNowMs()) => {
    const normalized = normalizeScheduledCommand(command);
    if (!normalized || !isFinalManeuverStatus(normalized.status)) return null;
    return normalizeArchivedManeuver({
      ...normalized,
      id: normalized.id,
      scheduledCommandId: normalized.id,
      resolvedAtMs: Number.isFinite(normalized.resolvedAtMs)
        ? normalized.resolvedAtMs
        : nowMs,
      statusUpdatedAtMs: Number.isFinite(normalized.statusUpdatedAtMs)
        ? normalized.statusUpdatedAtMs
        : nowMs,
    });
  };
  const reconcileScheduledCommandsWithOwnCommands = (
    ownCommands,
    nowMs = getServerNowMs(),
  ) => {
    const scheduled = (
      Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
    )
      .map((item) => normalizeScheduledCommand(item))
      .filter(Boolean)
      .sort((a, b) => Number(a.departureMs || 0) - Number(b.departureMs || 0));
    const usedCommandIds = new Set();
    const active = [];
    const finalized = [];

    scheduled.forEach((maneuver) => {
      if (!maneuver) return;
      if (isFinalManeuverStatus(maneuver.status)) {
        finalized.push({
          ...maneuver,
          resolvedAtMs: Number.isFinite(maneuver.resolvedAtMs)
            ? maneuver.resolvedAtMs
            : nowMs,
        });
        return;
      }

      const departureMs = toFiniteMs(maneuver.departureMs);
      const checkThresholdMs = Number.isFinite(departureMs)
        ? departureMs + COMMAND_CHECK_GRACE_MS
        : Number.POSITIVE_INFINITY;
      if (!Number.isFinite(checkThresholdMs) || nowMs < checkThresholdMs) {
        active.push({
          ...maneuver,
          status: MANEUVER_STATUS.waiting,
        });
        return;
      }

      const matchedCommandStrict = findMatchingOwnCommandForManeuver({
        maneuver,
        ownCommands,
        usedCommandIds,
        requireExpectedType: true,
        requireUnitsTolerance: true,
      });
      const matchedCommandSameType =
        matchedCommandStrict ||
        findMatchingOwnCommandForManeuver({
          maneuver,
          ownCommands,
          usedCommandIds,
          requireExpectedType: true,
          requireUnitsTolerance: false,
        });
      const matchedCommand =
        matchedCommandSameType ||
        findMatchingOwnCommandForManeuver({
          maneuver,
          ownCommands,
          usedCommandIds,
          requireExpectedType: false,
          requireUnitsTolerance: false,
        });
      if (!matchedCommand) {
        finalized.push({
          ...maneuver,
          status: MANEUVER_STATUS.missed,
          statusUpdatedAtMs: nowMs,
          checkedAtMs: nowMs,
          resolvedAtMs: nowMs,
          matchedCommandId: null,
          matchedCommandType: null,
          matchedCommandTypeLabel: null,
          matchedArrivalMs: null,
          matchedArrivalText: null,
          matchedFromCoord: null,
          matchedToCoord: null,
          matchedUnits: {},
        });
        return;
      }

      const matchedCommandId = cleanText(matchedCommand.id);
      if (matchedCommandId) usedCommandIds.add(matchedCommandId);
      const timingMatched = isTimingMatchedForManeuver(
        maneuver,
        matchedCommand,
      );
      const matchedArrivalMs = toFiniteEpochMs(matchedCommand.etaEpochMs);
      const matchedType = cleanText(matchedCommand.type) || null;
      const resolvedStatus = timingMatched
        ? MANEUVER_STATUS.success
        : MANEUVER_STATUS.timingMiss;
      finalized.push({
        ...maneuver,
        status: resolvedStatus,
        statusUpdatedAtMs: nowMs,
        checkedAtMs: nowMs,
        resolvedAtMs: nowMs,
        matchedCommandId: matchedCommandId || null,
        matchedCommandType: matchedType,
        matchedCommandTypeLabel:
          cleanText(matchedCommand.typeLabel) ||
          (matchedType ? getOwnCommandTypeLabel(matchedType) : null),
        matchedArrivalMs: Number.isFinite(matchedArrivalMs)
          ? matchedArrivalMs
          : null,
        matchedArrivalText: cleanText(matchedCommand.arrivalText) || null,
        matchedFromCoord:
          normalizeCoordIdentity(
            matchedCommand.routeFromCoord || matchedCommand.fromVillageCoord,
          ) || null,
        matchedToCoord:
          normalizeCoordIdentity(matchedCommand.routeToCoord) || null,
        matchedUnits: normalizeUnitsMap(matchedCommand.units),
      });
    });

    const archiveEntries = finalized
      .map((entry) => buildArchivedManeuverEntry(entry, nowMs))
      .filter(Boolean);
    const finalizedIds = new Set(
      finalized
        .map((entry) => cleanText(entry && entry.id))
        .filter(Boolean)
        .map((value) => String(value)),
    );
    const mergedActiveMap = new Map();
    readScheduledCommandsStorageSnapshot().commands.forEach((entry) => {
      const key = String(cleanText(entry && entry.id) || "");
      if (!key || finalizedIds.has(key)) return;
      mergedActiveMap.set(key, entry);
    });
    active.forEach((entry) => {
      const key = String(cleanText(entry && entry.id) || "");
      if (!key || finalizedIds.has(key)) return;
      mergedActiveMap.set(key, entry);
    });
    state.scheduledCommands = Array.from(mergedActiveMap.values()).sort(
      (a, b) =>
        Number((a && a.departureMs) || 0) - Number((b && b.departureMs) || 0),
    );
    if (archiveEntries.length) {
      appendArchivedManeuvers(archiveEntries);
    }
    if (archiveEntries.length && DEBUG_VERBOSE_LOGS) {
      console.warn(`${LOG_PREFIX} [plan-reconcile][finalized]`, {
        version: VERSION,
        nowMs: Math.round(nowMs),
        nowText: safe(() => formatDateTimeShort(nowMs), String(Math.round(nowMs))),
        finalizedCount: archiveEntries.length,
        activeCount: active.length,
        finalizedSample: finalized
          .slice(0, 20)
          .map((entry, index) => diagnoseScheduledCommandForPlan(entry, index)),
      });
    }
    if (!scheduled.length && !archiveEntries.length) {
      if (DEBUG_VERBOSE_LOGS) {
        console.info(`${LOG_PREFIX} [plan-reconcile][skip-empty-save]`, {
          version: VERSION,
          nowMs: Math.round(nowMs),
          reason: "no_scheduled_commands",
        });
      }
    } else {
      saveScheduledCommands("reconcile");
    }

    return {
      activeCount: active.length,
      finalizedCount: archiveEntries.length,
      successCount: archiveEntries.filter(
        (entry) => entry.status === MANEUVER_STATUS.success,
      ).length,
      missedCount: archiveEntries.filter(
        (entry) => entry.status === MANEUVER_STATUS.missed,
      ).length,
      timingMissCount: archiveEntries.filter(
        (entry) => entry.status === MANEUVER_STATUS.timingMiss,
      ).length,
    };
  };

  const purgeStaleScheduledCommands = (commands, nowMs = getServerNowMs()) =>
    (Array.isArray(commands) ? commands : [])
      .map((item) => normalizeScheduledCommand(item))
      .filter((item) => {
        if (!item || isFinalManeuverStatus(item.status)) return false;
        const departureMs = toFiniteMs(item.departureMs);
        if (!Number.isFinite(departureMs)) return false;
        return departureMs >= nowMs - PLAN_DEPARTED_VISIBLE_GRACE_MS;
      });

  const mergeScheduledCommandListsForStorage = (...lists) => {
    const map = new Map();
    const mergeFallbackScheduledCommand = (existing, fallback) => {
      if (!existing) return fallback;
      if (!fallback) return existing;
      let merged = existing;
      const fallbackComment = cleanText(fallback.comment);
      if (!cleanText(merged.comment) && fallbackComment) {
        merged = {
          ...merged,
          comment: fallbackComment,
        };
      }
      const fallbackTimingLabel = cleanText(fallback.timingLabel);
      if (!cleanText(merged.timingLabel) && fallbackTimingLabel) {
        merged = {
          ...merged,
          timingType: fallback.timingType,
          timingLabel: fallback.timingLabel,
          timingGapMs: fallback.timingGapMs,
          timingStartMs: fallback.timingStartMs,
          timingEndMs: fallback.timingEndMs,
          timingPointMs: fallback.timingPointMs,
        };
      }
      if (!cleanText(merged.goUrl) && cleanText(fallback.goUrl)) {
        merged = {
          ...merged,
          goUrl: fallback.goUrl,
        };
      }
      return merged === existing
        ? existing
        : normalizeScheduledCommand(merged) || merged;
    };
    lists.forEach((list) => {
      (Array.isArray(list) ? list : [])
        .map((item) => normalizeScheduledCommand(item))
        .filter((item) => item && !isFinalManeuverStatus(item.status))
        .forEach((item) => {
          const key = cleanText(item && item.id);
          if (!key) return;
          const storageKey = String(key);
          if (map.has(storageKey)) {
            map.set(
              storageKey,
              mergeFallbackScheduledCommand(map.get(storageKey), item),
            );
            return;
          }
          map.set(storageKey, item);
        });
    });
    return Array.from(map.values()).sort(
      (a, b) =>
        Number((a && a.departureMs) || 0) - Number((b && b.departureMs) || 0),
    );
  };

  const readScheduledCommandsStorageSnapshot = () => {
    const primaryRaw = readJson(STORAGE_KEYS.scheduledCommands);
    const backupRaw = readJson(STORAGE_KEYS.scheduledCommandsBackup);
    const sessionRaw = readSessionJson(STORAGE_KEYS.scheduledCommandsSession);
    const primaryArray = Array.isArray(primaryRaw) ? primaryRaw : [];
    const backupArray = Array.isArray(backupRaw) ? backupRaw : [];
    const sessionArray = Array.isArray(sessionRaw) ? sessionRaw : [];
    const nowMs = getServerNowMs();
    const primaryCommands = purgeStaleScheduledCommands(primaryArray, nowMs);
    const backupCommands = purgeStaleScheduledCommands(backupArray, nowMs);
    const sessionCommands = purgeStaleScheduledCommands(sessionArray, nowMs);
    const commands = mergeScheduledCommandListsForStorage(
      primaryCommands,
      backupCommands,
      sessionCommands,
    );
    const primaryIds = new Set(
      primaryCommands.map((item) => String(cleanText(item && item.id) || "")),
    );
    const fallbackUsed = backupCommands.concat(sessionCommands).some(
      (item) => !primaryIds.has(String(cleanText(item && item.id) || "")),
    );
    return {
      primaryRaw,
      backupRaw,
      sessionRaw,
      primaryArray,
      backupArray,
      sessionArray,
      primaryCommands,
      backupCommands,
      sessionCommands,
      commands,
      backupUsed: fallbackUsed,
      primaryRawType:
        primaryRaw === null
          ? "null"
          : Array.isArray(primaryRaw)
            ? "array"
            : typeof primaryRaw,
      backupRawType:
        backupRaw === null
          ? "null"
          : Array.isArray(backupRaw)
            ? "array"
            : typeof backupRaw,
      sessionRawType:
        sessionRaw === null
          ? "null"
          : Array.isArray(sessionRaw)
            ? "array"
            : typeof sessionRaw,
    };
  };

  const getLocalStorageUsageSummary = () =>
    safe(() => {
      if (typeof localStorage === "undefined" || !localStorage) return null;
      const rows = [];
      let totalChars = 0;
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        const value = key ? localStorage.getItem(key) || "" : "";
        const chars = String(key || "").length + String(value || "").length;
        totalChars += chars;
        rows.push({
          key,
          chars,
          approxBytes: chars * 2,
        });
      }
      rows.sort((left, right) => Number(right.chars) - Number(left.chars));
      return {
        keys: localStorage.length,
        totalChars,
        approxBytes: totalChars * 2,
        topKeys: rows.slice(0, 12),
      };
    }, null);

  const clearVolatileStorageForScheduledCommands = () =>
    safe(() => {
      if (typeof localStorage === "undefined" || !localStorage) return null;
      const keys = [
        STORAGE_KEYS.overviewUnits,
        STORAGE_KEYS.overviewUnitsDefense,
        STORAGE_KEYS.troops,
        STORAGE_KEYS.troopsDefense,
        STORAGE_KEYS.overviewCommands,
        STORAGE_KEYS.supportCommandDetails,
        STORAGE_KEYS.commandRouteDetails,
        STORAGE_KEYS.snapshot,
      ].filter(Boolean);
      const removed = [];
      const errors = {};
      keys.forEach((key) => {
        try {
          const value = localStorage.getItem(key);
          if (!value) return;
          const chars = String(key).length + String(value).length;
          localStorage.removeItem(key);
          removed.push({
            key,
            chars,
            approxBytes: chars * 2,
          });
        } catch (error) {
          errors[key] = {
            name: cleanText(error && error.name) || null,
            message:
              cleanText(error && error.message) ||
              cleanText(String(error || "")) ||
              "unknown",
          };
        }
      });
      return {
        removedCount: removed.length,
        removedChars: removed.reduce(
          (sum, item) => sum + Number(item.chars || 0),
          0,
        ),
        removedApproxBytes: removed.reduce(
          (sum, item) => sum + Number(item.approxBytes || 0),
          0,
        ),
        removed,
        errors,
      };
    }, null);

  const writeScheduledCommandsStorage = (commands, context = "save") => {
    const normalized = purgeStaleScheduledCommands(commands);
    const payload = JSON.stringify(normalized);
    const expectedIds = new Set(
      normalized.map((item) => String(cleanText(item && item.id) || "")),
    );
    const writeErrors = {};
    const sessionWriteErrors = {};
    const captureStorageError = (error) => ({
      name: cleanText(error && error.name) || null,
      message:
        cleanText(error && error.message) ||
        cleanText(String(error || "")) ||
        "unknown",
    });
    const writeOne = (key) => {
      try {
        localStorage.setItem(key, payload);
        return true;
      } catch (error) {
        writeErrors[key] = captureStorageError(error);
        return false;
      }
    };
    const writeSessionOne = (key) => {
      try {
        if (typeof sessionStorage === "undefined" || !sessionStorage)
          return false;
        sessionStorage.setItem(key, payload);
        return true;
      } catch (error) {
        sessionWriteErrors[key] = captureStorageError(error);
        return false;
      }
    };
    let primaryWriteOk = writeOne(STORAGE_KEYS.scheduledCommands);
    let backupWriteOk = writeOne(STORAGE_KEYS.scheduledCommandsBackup);
    const sessionWriteOk = writeSessionOne(STORAGE_KEYS.scheduledCommandsSession);
    let storageCleanup = null;
    const writeRetries = {};
    if (normalized.length && (!primaryWriteOk || !backupWriteOk)) {
      storageCleanup = clearVolatileStorageForScheduledCommands();
      if (!primaryWriteOk) {
        primaryWriteOk = writeOne(STORAGE_KEYS.scheduledCommands);
        writeRetries[STORAGE_KEYS.scheduledCommands] = primaryWriteOk;
      }
      if (!backupWriteOk) {
        backupWriteOk = writeOne(STORAGE_KEYS.scheduledCommandsBackup);
        writeRetries[STORAGE_KEYS.scheduledCommandsBackup] = backupWriteOk;
      }
    }
    const primaryStored = purgeStaleScheduledCommands(
      readJson(STORAGE_KEYS.scheduledCommands),
    );
    const backupStored = purgeStaleScheduledCommands(
      readJson(STORAGE_KEYS.scheduledCommandsBackup),
    );
    const sessionStored = purgeStaleScheduledCommands(
      readSessionJson(STORAGE_KEYS.scheduledCommandsSession),
    );
    const containsExpected = (stored) => {
      if (stored.length !== expectedIds.size) return false;
      return stored.every((item) =>
        expectedIds.has(String(cleanText(item && item.id) || "")),
      );
    };
    const primaryVerified = containsExpected(primaryStored);
    const backupVerified = containsExpected(backupStored);
    const sessionVerified = containsExpected(sessionStored);
    const ok = primaryVerified || backupVerified || sessionVerified;
    if (ok && DEBUG_VERBOSE_LOGS) {
      const logPayload = {
        version: VERSION,
        context,
        expectedCount: normalized.length,
        primaryWriteOk,
        backupWriteOk,
        sessionWriteOk,
        primaryVerified,
        backupVerified,
        sessionVerified,
        primaryStoredCount: primaryStored.length,
        backupStoredCount: backupStored.length,
        sessionStoredCount: sessionStored.length,
        payloadChars: payload.length,
        payloadApproxBytes: payload.length * 2,
        writeErrors,
        sessionWriteErrors,
        writeRetries,
        storageCleanup,
        localStorageUsage: null,
      };
      console.info(`${LOG_PREFIX} [plan-save]`, logPayload);
    } else if (!ok) {
      const logPayload = {
        version: VERSION,
        context,
        expectedCount: normalized.length,
        primaryWriteOk,
        backupWriteOk,
        sessionWriteOk,
        primaryVerified,
        backupVerified,
        sessionVerified,
        primaryStoredCount: primaryStored.length,
        backupStoredCount: backupStored.length,
        sessionStoredCount: sessionStored.length,
        payloadChars: payload.length,
        payloadApproxBytes: payload.length * 2,
        writeErrors,
        sessionWriteErrors,
        writeRetries,
        storageCleanup,
        localStorageUsage: getLocalStorageUsageSummary(),
        expectedIds: Array.from(expectedIds).slice(0, 50),
        primaryIds: primaryStored
          .slice(0, 50)
          .map((item) => cleanText(item && item.id) || "?"),
        backupIds: backupStored
          .slice(0, 50)
          .map((item) => cleanText(item && item.id) || "?"),
        sessionIds: sessionStored
          .slice(0, 50)
          .map((item) => cleanText(item && item.id) || "?"),
        normalizedSample: normalized
          .slice(0, 10)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index)),
      };
      console.error(`${LOG_PREFIX} [plan-save][failed]`, logPayload);
    }
    return ok;
  };

  const saveScheduledCommands = (context = "save") => {
    state.scheduledCommands = purgeStaleScheduledCommands(
      state.scheduledCommands,
    );
    return writeScheduledCommandsStorage(state.scheduledCommands, context);
  };

  const loadScheduledCommands = () => {
    const snapshot = readScheduledCommandsStorageSnapshot();
    const rawArray = snapshot.primaryArray;
    const backupArray = snapshot.backupArray;
    const sessionArray = snapshot.sessionArray;
    const stalePurged =
      rawArray.length !== snapshot.primaryCommands.length ||
      backupArray.length !== snapshot.backupCommands.length ||
      sessionArray.length !== snapshot.sessionCommands.length;
    const normalized = mergeScheduledCommandListsForStorage(
      snapshot.primaryCommands,
      snapshot.backupCommands,
      snapshot.sessionCommands,
    )
      .map((item) => normalizeScheduledCommand(item))
      .filter(Boolean);
    const active = [];
    const finalized = [];
    normalized.forEach((item) => {
      if (!item) return;
      if (isFinalManeuverStatus(item.status)) finalized.push(item);
      else active.push(item);
    });
    state.scheduledCommands = active;
    if (finalized.length) {
      const migratedArchiveEntries = finalized
        .map((entry) => buildArchivedManeuverEntry(entry, getServerNowMs()))
        .filter(Boolean);
      if (migratedArchiveEntries.length) {
        appendArchivedManeuvers(migratedArchiveEntries);
      }
    }
    if (snapshot.backupUsed || finalized.length || stalePurged) {
      writeScheduledCommandsStorage(state.scheduledCommands, "load_restore");
    }
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [plan-load]`, {
        version: VERSION,
        storageKey: STORAGE_KEYS.scheduledCommands,
        backupStorageKey: STORAGE_KEYS.scheduledCommandsBackup,
        sessionStorageKey: STORAGE_KEYS.scheduledCommandsSession,
        rawType: snapshot.primaryRawType,
        backupRawType: snapshot.backupRawType,
        sessionRawType: snapshot.sessionRawType,
        rawCount: rawArray.length,
        backupRawCount: backupArray.length,
        sessionRawCount: sessionArray.length,
        normalizedCount: normalized.length,
        activeCount: active.length,
        finalizedCount: finalized.length,
        stalePurged,
        droppedCount: Math.max(
          0,
          rawArray.length +
            backupArray.length +
            sessionArray.length -
            normalized.length,
        ),
        backupUsed: snapshot.backupUsed,
        storagePreserved: !snapshot.backupUsed && !finalized.length && !stalePurged,
        diagnostics: rawArray
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index)),
        backupDiagnostics: backupArray
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index)),
        sessionDiagnostics: sessionArray
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index)),
      });
    }
    return state.scheduledCommands;
  };
  const syncScheduledCommandsFromStorage = () => loadScheduledCommands();

  const getVillageIdentityKey = ({ villageId, villageCoord }) =>
    cleanText(villageId)
      ? `id:${cleanText(villageId)}`
      : cleanText(villageCoord)
        ? `coord:${cleanText(villageCoord)}`
        : null;

  const buildReservedUnitsMap = () => {
    const reserveMap = new Map();
    const stateScheduled = purgeStaleScheduledCommands(state.scheduledCommands);
    const storageScheduled = purgeStaleScheduledCommands(
      readJson(STORAGE_KEYS.scheduledCommands),
    );
    const mergedById = new Map();
    storageScheduled.forEach((command) => {
      if (!command) return;
      const key = cleanText(command.id);
      if (!key) return;
      mergedById.set(String(key), command);
    });
    stateScheduled.forEach((command) => {
      if (!command) return;
      const key = cleanText(command.id);
      if (!key) return;
      mergedById.set(String(key), command);
    });
    const activeScheduled = Array.from(mergedById.values()).sort(
      (a, b) =>
        Number((a && a.departureMs) || 0) - Number((b && b.departureMs) || 0),
    );
    state.scheduledCommands = activeScheduled;
    activeScheduled.forEach((command) => {
      const villageKey = getVillageIdentityKey({
        villageId: command.fromVillageId,
        villageCoord: command.fromVillageCoord,
      });
      if (!villageKey) return;
      Object.entries(command.units || {}).forEach(([unit, count]) => {
        const safeUnit = String(unit || "").toLowerCase();
        const safeCount = Math.max(0, toInt(count) || 0);
        if (!safeUnit || safeCount <= 0) return;
        const key = `${villageKey}|${safeUnit}`;
        reserveMap.set(key, (reserveMap.get(key) || 0) + safeCount);
      });
    });
    return reserveMap;
  };

  const getReservedUnitsCount = (reserveMap, village, unit) => {
    if (!reserveMap || !village || !unit) return 0;
    const villageKeys = [
      getVillageIdentityKey({
        villageId: village.villageId,
        villageCoord: null,
      }),
      getVillageIdentityKey({
        villageId: null,
        villageCoord: village.villageCoord,
      }),
    ].filter(Boolean);
    let total = 0;
    villageKeys.forEach((villageKey) => {
      const value = reserveMap.get(
        `${villageKey}|${String(unit || "").toLowerCase()}`,
      );
      if (Number.isFinite(value) && value > 0) total += value;
    });
    return total;
  };

  const formatCountdown = (totalSeconds) => {
    if (!Number.isFinite(totalSeconds)) return "n/a";
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
  };

  const updateCountdownNodes = () => {
    const roots = [];
    if (state.ui && state.ui.root) {
      roots.push(state.ui.root);
    }
    document.querySelectorAll(".smm-msg-inline-panel").forEach((node) => {
      if (node && node.isConnected) roots.push(node);
    });
    if (!roots.length) {
      if (state.countdownTimerId) {
        clearInterval(state.countdownTimerId);
        state.countdownTimerId = null;
      }
      return;
    }
    const nowMs = getServerNow().getTime();
    let hasCountdownNodes = false;
    roots.forEach((root) => {
      root
        .querySelectorAll(".smm-plan-countdown[data-departure-ms]")
        .forEach((node) => {
          hasCountdownNodes = true;
          const departureMs = Number(node.getAttribute("data-departure-ms"));
          if (!Number.isFinite(departureMs)) {
            if (node.textContent !== "n/a") node.textContent = "n/a";
            return;
          }
          const diffSeconds = (departureMs - nowMs) / 1000;
          const isLate = diffSeconds < 0;
          const nextText = isLate
            ? `-${formatCountdown(Math.abs(diffSeconds))}`
            : formatCountdown(diffSeconds);
          if (node.textContent !== nextText) node.textContent = nextText;
          if (node.classList.contains("late") !== isLate) {
            node.classList.toggle("late", isLate);
          }
        });
    });
    if (!hasCountdownNodes && state.countdownTimerId) {
      clearInterval(state.countdownTimerId);
      state.countdownTimerId = null;
    }
  };

  const applySliceScrollLimits = (rootNode = null) => {
    const root = rootNode && rootNode.querySelectorAll ? rootNode : document;
    const scrollNodes = Array.from(root.querySelectorAll(".smm-slice-scroll"));
    scrollNodes.forEach((scrollNode) => {
      const table = scrollNode.querySelector(".smm-slice-table");
      if (!table) return;

      const calcRowsByClass = Array.from(
        table.querySelectorAll("tbody tr.smm-slice-row"),
      );
      const hasCalcInputs = Boolean(
        table.querySelector(".smm-slice-input, .smm-sigil-input"),
      );
      const candidateRows = calcRowsByClass.length
        ? calcRowsByClass
        : hasCalcInputs
          ? Array.from(table.querySelectorAll("tbody tr"))
          : [];
      if (!candidateRows.length) {
        scrollNode.style.maxHeight = "";
        scrollNode.style.overflowY = "";
        return;
      }

      if (candidateRows.length <= SLICE_TABLE_VISIBLE_ROWS) {
        scrollNode.style.maxHeight = "";
        scrollNode.style.overflowY = "";
        return;
      }

      const visibleRows = candidateRows.slice(0, SLICE_TABLE_VISIBLE_ROWS);
      const headRow = table.querySelector("thead tr");
      const headHeight = Math.max(
        0,
        Math.ceil(
          (headRow &&
            headRow.getBoundingClientRect &&
            headRow.getBoundingClientRect().height) ||
            (headRow && headRow.offsetHeight) ||
            0,
        ),
      );
      const rowsHeight = visibleRows.reduce((sum, row) => {
        const value = Math.max(
          0,
          Math.ceil(
            (row &&
              row.getBoundingClientRect &&
              row.getBoundingClientRect().height) ||
              (row && row.offsetHeight) ||
              0,
          ),
        );
        return sum + value;
      }, 0);
      const computedMaxHeight = Math.max(150, headHeight + rowsHeight + 12);
      scrollNode.style.maxHeight = `${computedMaxHeight}px`;
      scrollNode.style.overflowY = "auto";
    });
  };

  const scheduleApplySliceScrollLimits = (rootNode = null) => {
    const run = () => applySliceScrollLimits(rootNode);
    run();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => requestAnimationFrame(run));
    } else {
      setTimeout(run, 0);
    }
    setTimeout(run, 80);
  };

  const startCountdownTicker = () => {
    if (!state.countdownTimerId) {
      state.countdownTimerId = setInterval(updateCountdownNodes, 1000);
    }
    updateCountdownNodes();
  };

  const stopCountdownTicker = () => {
    if (state.countdownTimerId) {
      clearInterval(state.countdownTimerId);
      state.countdownTimerId = null;
    }
  };

  const addSitterParams = (url) => {
    const sitter = safe(() => String(window.game_data.player.sitter), "0");
    if (sitter !== "0") {
      url.searchParams.set("t", String(window.game_data.player.id));
    }
  };

  const buildGameUrl = (params) => {
    const url = new URL("/game.php", location.origin);
    addSitterParams(url);
    url.searchParams.set(
      "village",
      String(safe(() => window.game_data.village.id, "")),
    );
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      url.searchParams.set(key, String(value));
    });
    return url.toString();
  };

  const buildVillageInfoUrlByCoordOrId = (coordRaw, villageIdRaw) => {
    const villageId = toInt(villageIdRaw);
    if (Number.isFinite(villageId) && villageId > 0) {
      return buildGameUrl({ screen: "info_village", id: String(villageId) });
    }
    const coord = parseCoord(coordRaw);
    if (!coord) return null;
    return buildGameUrl({
      screen: "map",
      x: String(coord.x),
      y: String(coord.y),
    });
  };

  const buildVillageOverviewUrlById = (villageIdRaw) => {
    const villageId = toInt(villageIdRaw);
    if (!Number.isFinite(villageId) || villageId <= 0) return null;
    const url = new URL("/game.php", location.origin);
    addSitterParams(url);
    url.searchParams.set("village", String(villageId));
    url.searchParams.set("screen", "overview");
    return url.toString();
  };

  const renderVillageCoordLinkHtml = ({
    coordRaw,
    villageIdRaw = null,
    preferOverview = false,
  } = {}) => {
    const coordText = cleanText(coordRaw) || "?";
    const villageId =
      cleanText(villageIdRaw) || resolveVillageIdByCoord(coordText) || null;
    const href =
      (preferOverview ? buildVillageOverviewUrlById(villageId) : null) ||
      buildVillageInfoUrlByCoordOrId(coordText, villageId);
    if (!href) return escapeHtml(coordText);
    return `<a class="smm-route-link" href="${escapeHtml(
      href,
    )}" target="_blank" rel="noopener noreferrer">${escapeHtml(coordText)}</a>`;
  };

  const buildPlaceCommandUrl = ({ fromVillageId, targetCoord, units }) => {
    const villageId = cleanText(fromVillageId);
    const villageIdInt = toInt(villageId);
    const coord = parseCoord(targetCoord);
    if (!Number.isFinite(villageIdInt) || villageIdInt <= 0 || !coord)
      return null;

    const url = new URL("/game.php", location.origin);
    addSitterParams(url);
    url.searchParams.set("village", String(villageIdInt));
    url.searchParams.set("screen", "place");
    url.searchParams.set("from", "simulator");
    url.searchParams.set("x", String(coord.x));
    url.searchParams.set("y", String(coord.y));

    Object.entries(units || {}).forEach(([unit, count]) => {
      const safeUnit = String(unit || "").toLowerCase();
      const safeCount = toInt(count);
      if (!safeUnit || !Number.isFinite(safeCount) || safeCount <= 0) return;
      url.searchParams.set(`att_${safeUnit}`, String(safeCount));
    });

    return url.toString();
  };

  const resolveVillageIdByCoord = (coordRaw) => {
    const coord = normalizeCoordIdentity(coordRaw);
    if (!coord) return null;
    const sources = [state.troops, state.troopsDefense];
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex += 1) {
      const villages =
        sources[sourceIndex] && Array.isArray(sources[sourceIndex].villages)
          ? sources[sourceIndex].villages
          : [];
      for (let villageIndex = 0; villageIndex < villages.length; villageIndex += 1) {
        const village = villages[villageIndex];
        const villageCoord = normalizeCoordIdentity(
          village && (village.villageCoord || village.villageName)
        );
        if (!villageCoord || villageCoord !== coord) continue;
        const villageId = toInt(village && village.villageId);
        if (Number.isFinite(villageId) && villageId > 0) {
          return String(villageId);
        }
      }
    }
    const currentCoord = normalizeCoordIdentity(safe(() => window.game_data.village.coord, null));
    const currentVillageId = toInt(safe(() => window.game_data.village.id, null));
    if (coord === currentCoord && Number.isFinite(currentVillageId) && currentVillageId > 0) {
      return String(currentVillageId);
    }
    return null;
  };

  const resolveScheduledCommandFromVillageId = (commandRaw) => {
    const explicitVillageId = toInt(commandRaw && commandRaw.fromVillageId);
    if (Number.isFinite(explicitVillageId) && explicitVillageId > 0) {
      return String(explicitVillageId);
    }
    return resolveVillageIdByCoord(commandRaw && commandRaw.fromVillageCoord);
  };

  const resolveScheduledCommandGoUrl = (commandRaw) => {
    if (!commandRaw || typeof commandRaw !== "object") return null;
    const fromVillageId = resolveScheduledCommandFromVillageId(commandRaw);
    const targetCoord = cleanText(commandRaw.targetCoord);
    const units = normalizeUnitsMap(commandRaw.units);
    if (!fromVillageId || !targetCoord || !Object.keys(units).length) return null;
    return buildPlaceCommandUrl({
      fromVillageId,
      targetCoord,
      units,
    });
  };

  const resolveSliceRowGoUrl = (row) => {
    if (!row || !row.getAttribute) return null;
    const targetCoord = cleanText(row.getAttribute("data-target-coord"));
    const fromVillageCoord = cleanText(row.getAttribute("data-village-coord"));
    const explicitVillageId = cleanText(row.getAttribute("data-village-id"));
    const fromVillageId =
      explicitVillageId || resolveVillageIdByCoord(fromVillageCoord);
    const selection = collectSliceRowSelection(row);
    const units = normalizeUnitsMap(selection && selection.units);
    if (!fromVillageId || !targetCoord || !Object.keys(units).length) return null;
    return buildPlaceCommandUrl({
      fromVillageId,
      targetCoord,
      units,
    });
  };

  const parseWorldVillageMapByCoord = (textRaw) => {
    const text = String(textRaw || "");
    const byCoord = new Map();
    if (!text) return byCoord;
    text.split(/\r?\n/).forEach((lineRaw) => {
      const line = cleanText(lineRaw);
      if (!line) return;
      const parts = line.split(",");
      if (parts.length < 4) return;
      const villageId = toInt(parts[0]);
      const x = toInt(parts[2]);
      const y = toInt(parts[3]);
      if (
        !Number.isFinite(villageId) ||
        villageId <= 0 ||
        !Number.isFinite(x) ||
        !Number.isFinite(y)
      ) {
        return;
      }
      byCoord.set(`${x}|${y}`, String(villageId));
    });
    return byCoord;
  };

  const fetchWorldVillageMapByCoord = async ({ force = false } = {}) => {
    const nowMs = getServerNowMs();
    const hasCache =
      state.worldVillageMapByCoord instanceof Map &&
      state.worldVillageMapByCoord.size > 0;
    if (!force && hasCache) {
      const ageMs = Math.max(0, nowMs - (state.worldVillageMapLoadedAtMs || 0));
      if (ageMs <= WORLD_VILLAGE_MAP_CACHE_TTL_MS) {
        return state.worldVillageMapByCoord;
      }
    }
    if (!force && state.worldVillageMapLoadingPromise) {
      return state.worldVillageMapLoadingPromise;
    }
    const loadPromise = (async () => {
      const url = new URL("/map/village.txt", location.origin);
      const text = await fetchTextWithRetry(url.toString(), { retries: 1 });
      const parsed = parseWorldVillageMapByCoord(text);
      if (parsed.size > 0) {
        state.worldVillageMapByCoord = parsed;
        state.worldVillageMapLoadedAtMs = getServerNowMs();
      }
      return parsed;
    })();
    state.worldVillageMapLoadingPromise = loadPromise;
    try {
      return await loadPromise;
    } finally {
      if (state.worldVillageMapLoadingPromise === loadPromise) {
        state.worldVillageMapLoadingPromise = null;
      }
    }
  };

  const resolveVillageIdByWorldMap = async (coordRaw) => {
    const coord = parseCoord(coordRaw);
    if (!coord) return null;
    const map = await fetchWorldVillageMapByCoord();
    if (!(map instanceof Map) || !map.size) return null;
    const byCoord = cleanText(map.get(coord.key));
    return byCoord || null;
  };

  const sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, Math.max(0, Number(ms) || 0));
    });

  let fetchRateQueue = Promise.resolve();
  let fetchNextAllowedAtMs = 0;

  const waitForFetchRateSlot = () => {
    const acquire = async () => {
      const now = Date.now();
      const scheduledAt = Math.max(now, fetchNextAllowedAtMs);
      fetchNextAllowedAtMs = scheduledAt + FETCH_MIN_INTERVAL_MS;
      const waitMs = scheduledAt - now;
      if (waitMs > 0) {
        await sleep(waitMs);
      }
    };

    const slotPromise = fetchRateQueue.then(acquire, acquire);
    fetchRateQueue = slotPromise.catch(() => null);
    return slotPromise;
  };

  const parseRetryAfterMs = (headerValue) => {
    const value = cleanText(headerValue);
    if (!value) return null;
    if (/^\d+(\.\d+)?$/.test(value)) {
      const seconds = Number(value);
      return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
    }
    const asDateMs = Number(new Date(value).getTime());
    if (!Number.isFinite(asDateMs)) return null;
    const diff = asDateMs - Date.now();
    return diff > 0 ? diff : null;
  };

  const isRetriableStatus = (status) =>
    [429, 502, 503, 504].includes(Number(status));

  const fetchTextWithRetry = async (url, options = {}) => {
    const retries = Math.max(0, toInt(options.retries) || 0);
    const baseDelayMs = Math.max(250, toInt(options.baseDelayMs) || 950);
    const requestTimeoutMs = Math.max(
      3000,
      toInt(options.timeoutMs) || FETCH_REQUEST_TIMEOUT_MS,
    );
    let attempt = 0;
    let lastError = null;

    while (attempt <= retries) {
      await waitForFetchRateSlot();
      let response = null;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          try {
            controller.abort();
          } catch (error) {
            // noop
          }
        }, requestTimeoutMs);
        try {
          response = await fetch(url, {
            credentials: "same-origin",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (fetchError) {
        const error = new Error(
          `fetch failed for ${url}: ${cleanText(fetchError && fetchError.message) || "network_error"}`,
        );
        error.url = url;
        error.cause = fetchError;
        lastError = error;
        if (attempt >= retries) {
          throw error;
        }
        const backoffMs = Math.round(
          baseDelayMs * Math.pow(1.8, attempt) + Math.random() * 250,
        );
        await sleep(backoffMs);
        attempt += 1;
        continue;
      }
      if (response.ok) {
        return response.text();
      }

      const status = Number(response.status);
      const error = new Error(`HTTP ${status} for ${url}`);
      error.status = status;
      error.url = url;
      lastError = error;

      if (attempt >= retries || !isRetriableStatus(status)) {
        throw error;
      }

      const retryAfterMs = parseRetryAfterMs(
        response.headers.get("Retry-After"),
      );
      const backoffMs = Math.round(
        baseDelayMs * Math.pow(1.8, attempt) + Math.random() * 250,
      );
      await sleep(Number.isFinite(retryAfterMs) ? retryAfterMs : backoffMs);
      attempt += 1;
    }

    throw lastError || new Error(`Fetch failed for ${url}`);
  };

  const fetchDocument = async (url) => {
    const text = await fetchTextWithRetry(url, { retries: 2 });
    const html = String(text || "");
    return new DOMParser().parseFromString(html, "text/html");
  };

  const fetchXmlDocument = async (url) => {
    const text = await fetchTextWithRetry(url, { retries: 2 });
    const xml = String(text || "");
    return new DOMParser().parseFromString(xml, "text/xml");
  };

  const readXmlText = (root, selector) =>
    cleanText(safe(() => root.querySelector(selector).textContent, null));
  const detectUnitSpeedMode = (unitMinutes, speedFactor) => {
    if (!unitMinutes || typeof unitMinutes !== "object") return "base";
    if (!Number.isFinite(speedFactor) || speedFactor <= 0) return "base";

    const sampleUnits = Object.keys(UNIT_BASE_MINUTES_FALLBACK).filter(
      (unit) => {
        if (unit === "militia") return false;
        const fallback = Number(UNIT_BASE_MINUTES_FALLBACK[unit]);
        const candidate = Number(unitMinutes[unit]);
        return (
          Number.isFinite(fallback) &&
          fallback > 0 &&
          Number.isFinite(candidate) &&
          candidate > 0
        );
      },
    );
    if (sampleUnits.length < 3) return "base";

    let errorAsBase = 0;
    let errorAsEffective = 0;

    sampleUnits.forEach((unit) => {
      const fallback = Number(UNIT_BASE_MINUTES_FALLBACK[unit]);
      const candidate = Number(unitMinutes[unit]);
      errorAsBase += Math.abs(candidate - fallback) / fallback;
      errorAsEffective +=
        Math.abs(candidate * speedFactor - fallback) / fallback;
    });

    const avgErrorAsBase = errorAsBase / sampleUnits.length;
    const avgErrorAsEffective = errorAsEffective / sampleUnits.length;
    return avgErrorAsEffective + 0.003 < avgErrorAsBase ? "effective" : "base";
  };
  const detectSpeedPairFromPageText = () => {
    const bodyText = safe(() => document.body.innerText, "") || "";
    const source = String(bodyText);
    if (!source) return null;
    const match = source.match(
      /(?:скорость|speed)\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*[x×*]\s*([0-9]+(?:[.,][0-9]+)?)/i,
    );
    if (!match) return null;
    const worldSpeed = toNumber(match[1]);
    const unitSpeed = toNumber(match[2]);
    if (!Number.isFinite(worldSpeed) || !Number.isFinite(unitSpeed))
      return null;
    return { worldSpeed, unitSpeed };
  };

  const buildSpeedModel = ({
    worldSpeed,
    unitSpeed,
    unitBaseMinutes,
    unitSpeedMode = "base",
    unitFlags = {},
    source,
    warning = null,
    error = null,
  }) => {
    const speedMode = unitSpeedMode === "effective" ? "effective" : "base";
    const speedFactor =
      Number.isFinite(worldSpeed) && Number.isFinite(unitSpeed)
        ? worldSpeed * unitSpeed
        : null;
    const rawUnitMinutes =
      unitBaseMinutes && typeof unitBaseMinutes === "object"
        ? unitBaseMinutes
        : {};
    const base = { ...UNIT_BASE_MINUTES_FALLBACK };

    Object.entries(rawUnitMinutes).forEach(([unit, rawValue]) => {
      const value = Number(rawValue);
      if (!Number.isFinite(value) || value <= 0) return;
      if (
        speedMode === "effective" &&
        Number.isFinite(speedFactor) &&
        speedFactor > 0
      ) {
        base[unit] = Number((value * speedFactor).toFixed(5));
      } else {
        base[unit] = value;
      }
    });

    const effectiveMinutesPerField = {};

    Object.keys(base).forEach((unit) => {
      const baseValue = Number(base[unit]);
      if (!Number.isFinite(baseValue) || baseValue < 0) return;
      const rawValue = Number(rawUnitMinutes[unit]);
      if (
        speedMode === "effective" &&
        Number.isFinite(rawValue) &&
        rawValue > 0
      ) {
        effectiveMinutesPerField[unit] = Number(rawValue.toFixed(5));
        return;
      }
      effectiveMinutesPerField[unit] =
        Number.isFinite(speedFactor) && speedFactor > 0
          ? Number((baseValue / speedFactor).toFixed(5))
          : baseValue;
    });

    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      world: safe(() => window.game_data.world, null),
      worldSpeed: Number.isFinite(worldSpeed) ? worldSpeed : null,
      unitSpeed: Number.isFinite(unitSpeed) ? unitSpeed : null,
      speedFactor,
      unitBaseMinutes: base,
      effectiveMinutesPerField,
      unitSpeedMode: speedMode,
      unitFlags: {
        archer:
          unitFlags && typeof unitFlags.archer === "boolean"
            ? unitFlags.archer
            : null,
      },
      source,
      warning,
      error,
    };
  };

  const loadSpeedModel = async () => {
    const cached = readJson(STORAGE_KEYS.speed);
    const now = Date.now();
    const currentWorld = cleanText(safe(() => window.game_data.world, null));
    const isSpeedModelForCurrentWorld = (model) => {
      const modelWorld = cleanText(model && model.world);
      if (!modelWorld || !currentWorld) return true;
      return modelWorld === currentWorld;
    };

    if (cached && cached.fetchedAt) {
      const cacheAge = now - Number(new Date(cached.fetchedAt).getTime());
      if (
        Number.isFinite(cacheAge) &&
        cacheAge <= SPEED_CACHE_TTL_MS &&
        isSpeedModelForCurrentWorld(cached)
      ) {
        return {
          ...cached,
          source: `${cached.source || "speed-cache"} (cache)`,
        };
      }
    }

    try {
      const [configXml, unitXml] = await Promise.all([
        fetchXmlDocument("/interface.php?func=get_config"),
        fetchXmlDocument("/interface.php?func=get_unit_info"),
      ]);

      const worldSpeed = toNumber(
        readXmlText(configXml, "config > speed, speed"),
      );
      const unitSpeed = toNumber(
        readXmlText(configXml, "config > unit_speed, unit_speed"),
      );
      const archerRaw = toInt(
        readXmlText(configXml, "config > game > archer, game > archer, archer"),
      );
      const unitBaseMinutes = {};
      const speedFactor =
        Number.isFinite(worldSpeed) && Number.isFinite(unitSpeed)
          ? worldSpeed * unitSpeed
          : null;

      Array.from(unitXml.querySelectorAll("config > *")).forEach((node) => {
        const speed = toNumber(readXmlText(node, "speed"));
        if (Number.isFinite(speed)) unitBaseMinutes[node.nodeName] = speed;
      });
      const unitSpeedMode = detectUnitSpeedMode(unitBaseMinutes, speedFactor);

      const model = buildSpeedModel({
        worldSpeed,
        unitSpeed,
        unitBaseMinutes,
        unitSpeedMode,
        unitFlags: {
          archer: Number.isFinite(archerRaw) ? archerRaw === 1 : null,
        },
        source:
          unitSpeedMode === "effective"
            ? "interface.php (unit_speeds_effective)"
            : "interface.php",
      });

      saveJson(STORAGE_KEYS.speed, model);
      return model;
    } catch (error) {
      if (cached && isSpeedModelForCurrentWorld(cached)) {
        return {
          ...cached,
          source: `${cached.source || "speed-cache"} (stale)`,
          warning: "Speed config fetch failed, using stale cache",
          error: cleanText(
            error && error.message ? error.message : String(error),
          ),
        };
      }

      const pageSpeedPair = detectSpeedPairFromPageText();
      if (pageSpeedPair) {
        return buildSpeedModel({
          worldSpeed: pageSpeedPair.worldSpeed,
          unitSpeed: pageSpeedPair.unitSpeed,
          unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
          source: "page_speed_text_fallback",
          warning: "Speed config fetch failed, using page speed text",
          error: cleanText(
            error && error.message ? error.message : String(error),
          ),
        });
      }

      return buildSpeedModel({
        worldSpeed: null,
        unitSpeed: null,
        unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
        source: "fallback",
        warning: "Speed config fetch failed, using fallback speeds",
        error: cleanText(
          error && error.message ? error.message : String(error),
        ),
      });
    }
  };

  const isUntrustedSpeedModelForPlanning = (model) => {
    if (!model || typeof model !== "object") return true;
    if (!model.effectiveMinutesPerField) return true;
    const source = cleanText(model.source).toLowerCase();
    if (!Number.isFinite(toNumber(model.worldSpeed))) return true;
    if (!Number.isFinite(toNumber(model.unitSpeed))) return true;
    return (
      source === "fallback" ||
      source === "message_inline_fallback" ||
      source === "message_runtime_fallback"
    );
  };

  const extractArrivalDateTimeText = (text) => {
    const source = cleanText(text);
    if (!source) return null;
    const matches = source.match(
      /(?:сегодня|завтра|today|tomorrow|\d{1,2}\.\d{1,2}(?:\.)?)\s+в\s+\d{1,2}:\d{2}:\d{2}/gi,
    );
    if (!matches || !matches.length) return null;
    return cleanText(matches[matches.length - 1]);
  };
  const extractArrivalMsFromText = (text) => {
    const source = String(text || "");
    if (!source) return null;
    const matches = source.match(/\d{1,2}:\d{2}:\d{2}\s*[:.]\s*(\d{1,3})/g);
    if (!matches || !matches.length) return null;
    const last = matches[matches.length - 1];
    const msMatch = String(last).match(/[:.]\s*(\d{1,3})$/);
    const ms = toInt(msMatch ? msMatch[1] : null);
    return Number.isFinite(ms) ? Math.max(0, ms) : null;
  };
  const normalizeTimerEndtimeToEpochMs = (value) => {
    const numeric = toNumber(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric >= 100000000000
      ? Math.round(numeric)
      : Math.round(numeric * 1000);
  };
  const estimateTimerNodeEtaEpochMs = (timerNode) => {
    if (!timerNode) return null;
    const timerText = cleanText(timerNode.textContent);
    const timerSeconds = parseTimerToSeconds(timerText);
    const endtimeRaw =
      cleanText(timerNode.getAttribute("data-endtime")) ||
      cleanText(timerNode.getAttribute("data-endTime")) ||
      cleanText(safe(() => timerNode.dataset.endtime, null));
    const endtimeEpochMs = normalizeTimerEndtimeToEpochMs(endtimeRaw);
    if (Number.isFinite(endtimeEpochMs)) return endtimeEpochMs;
    if (Number.isFinite(timerSeconds))
      return getServerNowMs() + timerSeconds * 1000;
    return null;
  };
  const selectIncomingArrivalTimerNode = (row) => {
    const timers = Array.from(row ? row.querySelectorAll(".timer") : []);
    if (!timers.length) return null;
    const hasArrivalDatePattern = (text) =>
      /(?:сегодня|завтра|today|tomorrow|\d{1,2}\.\d{1,2}(?:\.)?)\s+в\s+\d{1,2}:\d{2}:\d{2}/i.test(
        String(text || ""),
      );

    const ranked = timers
      .map((node, index) => {
        const cell = node.closest("td");
        const cellText = cleanText(cell ? cell.textContent : null) || "";
        const hasDate = hasArrivalDatePattern(cellText);
        const hasMs = Boolean(cell && cell.querySelector(".grey.small"));
        const isWatchtower = Boolean(node.closest(".watchtower-timer"));
        const endtimeRaw =
          cleanText(node.getAttribute("data-endtime")) ||
          cleanText(node.getAttribute("data-endTime")) ||
          cleanText(safe(() => node.dataset.endtime, null));
        const hasEndtime = Number.isFinite(
          normalizeTimerEndtimeToEpochMs(endtimeRaw),
        );
        const etaEpochMs = estimateTimerNodeEtaEpochMs(node);
        const score =
          (hasDate ? 100 : 0) +
          (hasMs ? 35 : 0) +
          (hasEndtime ? 12 : 0) +
          (isWatchtower ? -120 : 0) -
          index;
        return { node, score, etaEpochMs };
      })
      .sort((a, b) => b.score - a.score);

    const etaCandidates = ranked
      .filter((item) => Number.isFinite(item.etaEpochMs))
      .sort((a, b) => Number(b.etaEpochMs) - Number(a.etaEpochMs));
    if (etaCandidates.length >= 2) {
      const lead = Number(etaCandidates[0].etaEpochMs);
      const second = Number(etaCandidates[1].etaEpochMs);
      if (
        Number.isFinite(lead) &&
        Number.isFinite(second) &&
        lead - second > 15 * 1000
      ) {
        return etaCandidates[0].node;
      }
    }
    if (etaCandidates.length === 1) {
      return etaCandidates[0].node;
    }

    return ranked.length ? ranked[0].node : null;
  };

  const parseIncomingsDocument = (doc, sourceUrl) => {
    const table = doc.querySelector("#incomings_table");
    const rows = table
      ? Array.from(table.querySelectorAll("tr.row_a, tr.row_b"))
      : [];

    const items = rows
      .map((row) => {
        const commandInput = row.querySelector("input[name^='command_ids[']");
        const id = parseCommandId(
          commandInput ? commandInput.getAttribute("name") : "",
        );

        const commandLink = row.querySelector("a[href*='screen=info_command']");
        const commandIcon = row.querySelector(
          ".icon-container img[src*='/graphic/command/']",
        );
        const tinyUnitIcons = Array.from(
          row.querySelectorAll(
            "td:nth-child(1) img[src*='/graphic/unit/tiny/']",
          ),
        );
        const rowIcons = Array.from(
          row.querySelectorAll("td:nth-child(1) img[src]"),
        ).map((img) => String(img.getAttribute("src") || ""));
        const nobleIconFromRow =
          rowIcons.find((src) => isNobleIconSrc(src)) || null;

        const commandTypeByIcon = detectCommandTypeByIcon(
          commandIcon ? commandIcon.getAttribute("src") : null,
        );
        const tooltipCandidates = Array.from(
          row.querySelectorAll(
            "td:nth-child(1) [title], td:nth-child(1) [data-command-id], td:nth-child(1) .tooltip",
          ),
        )
          .map((node) => node.getAttribute("title") || node.tooltipText || null)
          .filter((raw) => cleanText(raw));
        const kindRaw = tooltipCandidates.length ? tooltipCandidates[0] : null;

        const anchors = Array.from(row.querySelectorAll("a[href]"));
        const targetCell = row.querySelector("td:nth-child(2)");
        const originCell = row.querySelector("td:nth-child(3)");
        const playerCell = row.querySelector("td:nth-child(4)");

        const targetAnchor =
          safe(() => targetCell.querySelector("a[href]"), null) ||
          anchors.find((anchor) =>
            /(?:screen=overview|screen=info_village)\b/.test(
              anchor.getAttribute("href") || "",
            ),
          ) ||
          null;
        const originAnchor =
          safe(() => originCell.querySelector("a[href]"), null) ||
          anchors.find((anchor) =>
            /screen=info_village\b/.test(anchor.getAttribute("href") || ""),
          ) ||
          null;
        const playerAnchor =
          safe(() => playerCell.querySelector("a[href]"), null) ||
          anchors.find((anchor) =>
            /screen=info_player\b/.test(anchor.getAttribute("href") || ""),
          ) ||
          null;

        const targetText = cleanText(
          (targetAnchor && targetAnchor.textContent) ||
            safe(() => targetCell.textContent, null) ||
            safe(() => row.textContent, null),
        );
        const originText = cleanText(
          (originAnchor && originAnchor.textContent) ||
            safe(() => originCell.textContent, null),
        );
        const playerText = cleanText(
          (playerAnchor && playerAnchor.textContent) ||
            safe(() => playerCell.textContent, null),
        );

        const targetCoord = parseCoord(targetText);
        const originCoord = parseCoord(originText);
        const distance = calcDistance(originCoord, targetCoord);

        const timerNode = selectIncomingArrivalTimerNode(row);
        const timerText = cleanText(safe(() => timerNode.textContent, null));
        const timerSeconds = parseTimerToSeconds(timerText);
        const arrivalCell = timerNode ? timerNode.closest("td") : null;
        const msNode =
          safe(() => arrivalCell.querySelector(".grey.small"), null) ||
          safe(
            () => timerNode.parentElement.querySelector(".grey.small"),
            null,
          ) ||
          null;
        const arrivalMsFromNode = toInt(msNode ? msNode.textContent : null);
        const arrivalCellText = cleanText(
          safe(() => arrivalCell.textContent, null) ||
            safe(
              () => (msNode ? msNode.parentElement.textContent : null),
              null,
            ),
        );
        const msText = cleanText(msNode ? msNode.textContent : null);
        const arrivalTextFromCell = arrivalCellText
          ? cleanText(
              msText ? arrivalCellText.replace(msText, "") : arrivalCellText,
            )
          : null;
        const arrivalText =
          extractArrivalDateTimeText(arrivalTextFromCell) ||
          extractArrivalDateTimeText(safe(() => row.textContent, null));
        const arrivalMsFromCellText =
          extractArrivalMsFromText(arrivalTextFromCell);
        const arrivalMsFromRowText = extractArrivalMsFromText(
          safe(() => row.textContent, null),
        );
        const arrivalMs = Number.isFinite(arrivalMsFromNode)
          ? arrivalMsFromNode
          : Number.isFinite(arrivalMsFromCellText)
            ? arrivalMsFromCellText
            : Number.isFinite(arrivalMsFromRowText)
              ? arrivalMsFromRowText
              : null;
        const arrivalEpochMsByText = parseCommandsArrivalEpochMs(
          arrivalText,
          arrivalMs,
        );
        const timerEndtimeRaw =
          cleanText(
            timerNode ? timerNode.getAttribute("data-endtime") : null,
          ) ||
          cleanText(
            timerNode ? timerNode.getAttribute("data-endTime") : null,
          ) ||
          cleanText(
            safe(() => (timerNode ? timerNode.dataset.endtime : null), null),
          );
        const timerEndtimeEpochMs =
          normalizeTimerEndtimeToEpochMs(timerEndtimeRaw);
        const arrivalEpochMsByTimerEndtime = Number.isFinite(
          timerEndtimeEpochMs,
        )
          ? timerEndtimeEpochMs + (Number.isFinite(arrivalMs) ? arrivalMs : 0)
          : null;
        const arrivalEpochMsByTimerText = Number.isFinite(timerSeconds)
          ? getServerNowMs() +
            timerSeconds * 1000 +
            (Number.isFinite(arrivalMs) ? arrivalMs : 0)
          : null;
        const allTimerNodes = Array.from(row.querySelectorAll(".timer"));
        const maxTimerEtaWithMs = allTimerNodes
          .map((node) => {
            const eta = estimateTimerNodeEtaEpochMs(node);
            if (!Number.isFinite(eta)) return null;
            const nodeCellText = cleanText(
              safe(() => node.closest("td").textContent, null),
            );
            const nodeMs = extractArrivalMsFromText(nodeCellText);
            return eta + (Number.isFinite(nodeMs) ? nodeMs : 0);
          })
          .filter((value) => Number.isFinite(value))
          .sort((a, b) => b - a)[0];
        let arrivalEpochMs = Number.isFinite(arrivalEpochMsByText)
          ? arrivalEpochMsByText
          : null;
        if (!Number.isFinite(arrivalEpochMs)) {
          arrivalEpochMs = Number.isFinite(arrivalEpochMsByTimerEndtime)
            ? arrivalEpochMsByTimerEndtime
            : Number.isFinite(arrivalEpochMsByTimerText)
              ? arrivalEpochMsByTimerText
              : null;
        } else if (
          Number.isFinite(arrivalEpochMsByTimerEndtime) &&
          Math.abs(arrivalEpochMs - arrivalEpochMsByTimerEndtime) >
            2 * 60 * 1000
        ) {
          arrivalEpochMs = arrivalEpochMsByTimerEndtime;
        }
        if (
          Number.isFinite(maxTimerEtaWithMs) &&
          (!Number.isFinite(arrivalEpochMs) ||
            maxTimerEtaWithMs - arrivalEpochMs > 60 * 1000)
        ) {
          arrivalEpochMs = maxTimerEtaWithMs;
        }
        const arrivalEpochSource = Number.isFinite(arrivalEpochMsByText)
          ? "text"
          : Number.isFinite(arrivalEpochMsByTimerEndtime)
            ? "timer_endtime"
            : Number.isFinite(arrivalEpochMsByTimerText)
              ? "timer_text"
              : "unknown";
        const arrivalEpochResolvedSource =
          Number.isFinite(maxTimerEtaWithMs) &&
          Number.isFinite(arrivalEpochMs) &&
          arrivalEpochMs === maxTimerEtaWithMs
            ? "timer_max"
            : arrivalEpochSource;

        const watchtowerNode = row.querySelector(".watchtower-timer");
        const watchtowerEndtime = cleanText(
          watchtowerNode ? watchtowerNode.getAttribute("data-endtime") : null,
        );
        const watchtowerText = cleanText(
          watchtowerNode ? watchtowerNode.textContent : null,
        );
        const commandLabel = cleanText(
          safe(() => row.querySelector(".quickedit-label").textContent, null),
        );
        const kindText = cleanText(tooltipHtmlToText(kindRaw) || kindRaw);
        const supportUnitCount =
          commandTypeByIcon === "support"
            ? tooltipCandidates
                .map((raw) => parseSupportCountFromTooltip(raw))
                .find((value) => Number.isFinite(value) && value > 0) || null
            : null;
        const hasNobleByText = /(?:дворян|snob)/i.test(
          `${commandLabel || ""} ${kindText || ""}`,
        );
        const hasNoble = Boolean(nobleIconFromRow || hasNobleByText);
        const nobleIconFallback = safe(
          () => `${String(window.image_base || "/graphic/")}command/snob.webp`,
          "/graphic/command/snob.webp",
        );
        const unitIconsByKey = {};
        const detectedUnits = [];

        tinyUnitIcons.forEach((iconNode) => {
          const src = String(iconNode.getAttribute("src") || "");
          const unit = detectUnitFromTinyIcon(src);
          if (!unit) return;
          if (!unitIconsByKey[unit]) unitIconsByKey[unit] = src;
          if (!detectedUnits.includes(unit)) detectedUnits.push(unit);
        });

        const textDetectedUnit = detectUnitFromText(
          `${commandLabel || ""} ${kindText || ""}`,
        );
        if (textDetectedUnit && !detectedUnits.includes(textDetectedUnit)) {
          detectedUnits.push(textDetectedUnit);
        }
        if (hasNoble && !detectedUnits.includes("snob")) {
          detectedUnits.unshift("snob");
        }

        const guessedUnit = hasNoble
          ? "snob"
          : detectedUnits.length
            ? detectedUnits[0]
            : null;
        const guessedUnitIcon = guessedUnit
          ? unitIconsByKey[guessedUnit] ||
            (guessedUnit === "snob"
              ? nobleIconFromRow || nobleIconFallback
              : getUnitIconFallback(guessedUnit))
          : null;
        const displayType = hasNoble ? "noble" : commandTypeByIcon;

        return {
          id,
          commandUrl: commandLink ? commandLink.getAttribute("href") : null,
          commandLabel,
          commandType: commandTypeByIcon,
          commandIcon: commandIcon ? commandIcon.getAttribute("src") : null,
          kindText,
          supportUnitCount,
          hasNoble,
          nobleIcon: hasNoble ? nobleIconFromRow || nobleIconFallback : null,
          displayType,
          tinyUnitIcon: guessedUnitIcon,
          unitIconsByKey,
          detectedUnits,
          guessedUnit,
          guessedUnitIcon,

          target: targetText,
          targetCoord: targetCoord ? targetCoord.key : null,
          targetVillageId: targetAnchor
            ? getUrlParam(targetAnchor.href, "village") ||
              getUrlParam(targetAnchor.href, "id")
            : null,

          origin: originText,
          originCoord: originCoord ? originCoord.key : null,
          originVillageId: originAnchor
            ? getUrlParam(originAnchor.href, "id") ||
              getUrlParam(originAnchor.href, "village")
            : null,

          player: playerText,
          playerId: playerAnchor ? getUrlParam(playerAnchor.href, "id") : null,

          distance,
          arrivalText,
          arrivalMs,
          arrivalEpochMs,
          arrivalEpochSource: arrivalEpochResolvedSource,
          timerText,
          timerSeconds,
          watchtowerEndtime,
          watchtowerText,
        };
      })
      .filter((item) => item.id);

    const byId = new Map();
    items.forEach((item) => byId.set(item.id, item));
    const uniqueItems = Array.from(byId.values()).sort((a, b) => {
      const aEta = Number(a && a.arrivalEpochMs);
      const bEta = Number(b && b.arrivalEpochMs);
      if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta)
        return aEta - bEta;
      const av = Number.isFinite(a.timerSeconds)
        ? a.timerSeconds
        : Number.MAX_SAFE_INTEGER;
      const bv = Number.isFinite(b.timerSeconds)
        ? b.timerSeconds
        : Number.MAX_SAFE_INTEGER;
      return av - bv;
    });

    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      sourceUrl,
      count: uniqueItems.length,
      items: uniqueItems,
    };
  };

  const fetchIncomingsAttacks = async () => {
    const sourceUrl = buildGameUrl({
      screen: "overview_villages",
      mode: "incomings",
      type: "unignored",
      subtype: "attacks",
      page: -1,
    });
    const doc = await fetchDocument(sourceUrl);
    return parseIncomingsDocument(doc, sourceUrl);
  };

  const fetchIncomingsSupports = async () => {
    const sourceUrl = buildGameUrl({
      screen: "overview_villages",
      mode: "incomings",
      subtype: "supports",
      page: -1,
    });
    const doc = await fetchDocument(sourceUrl);
    return parseIncomingsDocument(doc, sourceUrl);
  };

  const parseUnitKeyFromIcon = (src) => {
    const value = String(src || "").toLowerCase();
    if (!value) return null;

    const explicit = value.match(/unit_([a-z_]+)\.(?:png|webp|gif|jpg|jpeg)/i);
    if (explicit && explicit[1]) return explicit[1].toLowerCase();

    const fromPath = value.match(
      /\/([a-z_]+)\.(?:png|webp|gif|jpg|jpeg)(?:$|\?)/i,
    );
    if (fromPath && fromPath[1]) {
      const candidate = fromPath[1].toLowerCase();
      if (UNIT_ORDER_INDEX[candidate] !== undefined) return candidate;
    }

    const knownUnits = Array.from(
      new Set([
        ...(Array.isArray(window.game_data && window.game_data.units)
          ? window.game_data.units
          : []),
        ...UNIT_RENDER_ORDER,
      ]),
    )
      .map((unit) => String(unit || "").toLowerCase())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const unit of knownUnits) {
      if (
        value.includes(`unit_${unit}.`) ||
        value.includes(`/${unit}.`) ||
        value.includes(`_${unit}.`)
      ) {
        return unit;
      }
    }

    return null;
  };

  const parseTroopsDocument = (doc, sourceUrl) => {
    const sourceType = cleanText(getUrlParam(sourceUrl, "type"));
    const IN_VILLAGE_LABEL_RE =
      /(?:^|\b)(?:в\s*деревн(?:е|и|у)?|дома|in\s*village|at\s*home|home)(?:\b|$)/i;
    const OWN_LABEL_RE = /(?:^|\b)(?:свои|own)(?:\b|$)/i;
    const TOTAL_LABEL_RE = /(?:^|\b)(?:всего|total)(?:\b|$)/i;
    const rowHasLabel = (row, re) =>
      Array.from((row && row.children) || []).some((cell) =>
        re.test(cleanText(cell.textContent) || ""),
      );
    const countTroopsMap = (troopsMap) =>
      Object.values(
        troopsMap && typeof troopsMap === "object" ? troopsMap : {},
      ).reduce(
        (sum, value) =>
          sum + (Number.isFinite(Number(value)) ? Number(value) : 0),
        0,
      );
    const mergeTroopsMapsMax = (left, right) => {
      const merged = {};
      Object.entries(left && typeof left === "object" ? left : {}).forEach(
        ([unit, count]) => {
          const safeCount = Math.max(0, toInt(count) || 0);
          if (safeCount > (merged[unit] || 0)) merged[unit] = safeCount;
        },
      );
      Object.entries(right && typeof right === "object" ? right : {}).forEach(
        ([unit, count]) => {
          const safeCount = Math.max(0, toInt(count) || 0);
          if (safeCount > (merged[unit] || 0)) merged[unit] = safeCount;
        },
      );
      return merged;
    };
    const mergeDefenseTroopsSource = (leftSourceRaw, rightSourceRaw) => {
      const left = cleanText(leftSourceRaw);
      const right = cleanText(rightSourceRaw);
      if (left === "total_row" || right === "total_row") return "total_row";
      return right || left || "fallback_row";
    };

    const table =
      doc.querySelector("#units_table") ||
      Array.from(doc.querySelectorAll("table")).find(
        (candidate) => candidate.querySelector("img[src*='unit_']") !== null,
      );

    if (!table) {
      return {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl,
        count: 0,
        units: [],
        villages: [],
        warning: "Units table not found in fetched page",
      };
    }

    const headerRow = Array.from(table.querySelectorAll("tr")).find(
      (row) => row.querySelector("th img[src*='unit_']") !== null,
    );

    const unitColumns = [];
    if (headerRow) {
      Array.from(headerRow.children).forEach((cell, columnIndex) => {
        const icon = cell.querySelector("img[src*='unit_']");
        const iconAny = icon || cell.querySelector("img[src]");
        if (!iconAny) return;
        const unit = parseUnitKeyFromIcon(iconAny.getAttribute("src"));
        if (unit) unitColumns.push({ unit, columnIndex });
      });
    }

    const rowCandidates = Array.from(table.querySelectorAll("tr")).filter(
      (row) => {
        if (!row.querySelector("td")) return false;
        const text = cleanText(row.textContent);
        return Boolean(parseCoord(text));
      },
    );

    const worldUnits = normalizeUnitsForWorld(
      getGameDataUnits(),
      state.speedModel,
    );

    const dedupeUnitColumns = (columns) => {
      const seen = new Set();
      return columns.filter((item) => {
        if (!item || !item.unit || seen.has(item.unit)) return false;
        seen.add(item.unit);
        return true;
      });
    };
    const headerUnitColumnsAll = dedupeUnitColumns(unitColumns);
    const headerUnitOrderAll = headerUnitColumnsAll.map((item) => item.unit);
    let finalUnitColumnsRaw = unitColumns.slice();
    let finalUnitColumns = dedupeUnitColumns(finalUnitColumnsRaw);

    const minExpectedUnits = worldUnits.length
      ? Math.max(4, Math.floor(worldUnits.length * 0.65))
      : 4;
    const needSequentialFallback = finalUnitColumns.length < minExpectedUnits;

    if (needSequentialFallback) {
      const referenceRow =
        rowCandidates[0] ||
        Array.from(table.querySelectorAll("tr")).find((row) =>
          row.querySelector("td"),
        );
      const maxCells = referenceRow ? referenceRow.children.length : 0;

      let firstUnitIndex = null;
      if (headerRow) {
        Array.from(headerRow.children).forEach((cell, idx) => {
          if (firstUnitIndex !== null) return;
          const img = cell.querySelector("img[src]");
          const src = cleanText(img ? img.getAttribute("src") : null);
          if (!src) return;
          if (parseUnitKeyFromIcon(src) || /\/unit\//i.test(src)) {
            firstUnitIndex = idx;
          }
        });
      }

      if (!Number.isInteger(firstUnitIndex)) {
        firstUnitIndex = 2;
      }

      const sequentialUnits = worldUnits.length
        ? worldUnits
        : normalizeUnitsForWorld(UNIT_RENDER_ORDER, state.speedModel);
      const sequentialColumns = [];
      sequentialUnits.forEach((unit, offset) => {
        const columnIndex = firstUnitIndex + offset;
        if (!Number.isFinite(maxCells) || columnIndex >= maxCells) return;
        sequentialColumns.push({ unit, columnIndex });
      });

      const dedupedSequential = dedupeUnitColumns(sequentialColumns);
      if (dedupedSequential.length > finalUnitColumns.length) {
        finalUnitColumnsRaw = sequentialColumns.slice();
        finalUnitColumns = dedupedSequential;
      }
    }

    finalUnitColumnsRaw = finalUnitColumnsRaw.filter(({ unit }) =>
      isUnitAllowedInWorld(unit, state.speedModel),
    );
    finalUnitColumns = dedupeUnitColumns(finalUnitColumnsRaw);

    const unitColumnIndexMap = new Map();
    finalUnitColumnsRaw.forEach(({ unit, columnIndex }) => {
      if (!unitColumnIndexMap.has(unit)) {
        unitColumnIndexMap.set(unit, []);
      }
      unitColumnIndexMap.get(unit).push(columnIndex);
    });
    const orderedUnits = finalUnitColumns.map((item) => item.unit);
    const firstHeaderUnitColumnIndex = finalUnitColumns.length
      ? Math.min(...finalUnitColumns.map((item) => item.columnIndex))
      : null;

    const allRows = Array.from(table.querySelectorAll("tr"));
    const candidateIndexes = rowCandidates
      .map((row) => allRows.indexOf(row))
      .filter((index) => index >= 0);

    const buildSequentialUnitsForRowCellCount = (rowUnitCellCount) => {
      const count = Math.max(0, toInt(rowUnitCellCount) || 0);
      if (!count) return [];

      const worldSequential = normalizeUnitsForWorld(
        worldUnits && worldUnits.length ? worldUnits : UNIT_RENDER_ORDER,
        state.speedModel,
      ).filter((unit) => isUnitAllowedInWorld(unit, state.speedModel));
      const headerSequential = headerUnitOrderAll.filter((unit) =>
        isUnitAllowedInWorld(unit, state.speedModel),
      );

      const appendMilitiaIfFits = (units) => {
        const base = Array.isArray(units) ? units.slice() : [];
        if (
          count === base.length + 1 &&
          !base.includes("militia") &&
          isUnitAllowedInWorld("militia", state.speedModel)
        ) {
          base.push("militia");
        }
        return base;
      };

      const worldWithOptionalMilitia = appendMilitiaIfFits(worldSequential);
      if (worldWithOptionalMilitia.length === count)
        return worldWithOptionalMilitia;

      if (headerSequential.length === count) return headerSequential;

      const orderedWithOptionalMilitia = appendMilitiaIfFits(orderedUnits);
      if (orderedWithOptionalMilitia.length === count)
        return orderedWithOptionalMilitia;

      if (
        worldWithOptionalMilitia.length >= count &&
        count >= minExpectedUnits
      ) {
        return worldWithOptionalMilitia.slice(0, count);
      }
      if (headerSequential.length >= count && count >= minExpectedUnits) {
        return headerSequential.slice(0, count);
      }
      if (orderedWithOptionalMilitia.length >= count) {
        return orderedWithOptionalMilitia.slice(0, count);
      }
      return worldWithOptionalMilitia.length
        ? worldWithOptionalMilitia
        : orderedUnits.slice(0, count);
    };

    const villages = rowCandidates.map((row, rowIndex) => {
      const blockStart = candidateIndexes[rowIndex];
      const blockEnd =
        rowIndex + 1 < candidateIndexes.length
          ? candidateIndexes[rowIndex + 1] - 1
          : allRows.length - 1;
      const blockRows = allRows
        .slice(blockStart, blockEnd + 1)
        .filter((candidate) => candidate && candidate.querySelector("td"));
      const inVillageRow =
        blockRows.find((candidate) =>
          rowHasLabel(candidate, IN_VILLAGE_LABEL_RE),
        ) || null;
      const ownRow =
        blockRows.find((candidate) => rowHasLabel(candidate, OWN_LABEL_RE)) ||
        null;
      const totalRowByLabel =
        blockRows.find((candidate) => rowHasLabel(candidate, TOTAL_LABEL_RE)) ||
        blockRows.find((candidate) =>
          /(?:^|\s)(всего|total)(?:\s|$)/i.test(
            cleanText(candidate.textContent) || "",
          ),
        ) ||
        null;
      const totalRowByBoldStyle =
        blockRows.find((candidate) =>
          /font-weight\s*:\s*bold/i.test(
            cleanText(candidate.getAttribute("style")) || "",
          ),
        ) || null;
      const totalRowByTail =
        !totalRowByLabel && blockRows.length >= 4
          ? blockRows[blockRows.length - 1] || null
          : null;
      const totalRow =
        totalRowByLabel || totalRowByBoldStyle || totalRowByTail || null;
      const homeLinkRow =
        blockRows.find((candidate) =>
          candidate.querySelector("a[href*='screen=place&mode=units']"),
        ) || null;
      const sourceRow =
        inVillageRow ||
        (homeLinkRow && !rowHasLabel(homeLinkRow, TOTAL_LABEL_RE)
          ? homeLinkRow
          : null) ||
        ownRow ||
        (sourceType === "own_home" && blockRows.length === 1 ? row : null) ||
        totalRow ||
        row;
      const troopsSource =
        sourceRow === inVillageRow
          ? "in_village_row"
          : sourceRow === homeLinkRow && sourceRow !== totalRow
            ? "home_link_row"
            : sourceType === "own_home" &&
                sourceRow === row &&
                blockRows.length === 1
              ? "own_home_single_row"
              : sourceRow === ownRow
                ? "own_row"
                : sourceRow === totalRow
                  ? "total_row"
                  : "fallback_row";

      const villageAnchor =
        row.querySelector("a[href*='screen=overview']") ||
        row.querySelector("a[href*='screen=info_village']");
      const villageText = cleanText(
        villageAnchor
          ? villageAnchor.textContent
          : safe(() => row.textContent, null),
      );
      const villageCoord = parseCoord(villageText);
      const villageIdFromQuickEdit = cleanText(
        safe(
          () =>
            row
              .querySelector(
                ".quickedit-vn[data-id], .quickedit-label[data-id]",
              )
              .getAttribute("data-id"),
          null,
        ),
      );
      const villageIdFromAttr = cleanText(
        safe(
          () =>
            row
              .querySelector("[data-village-id]")
              .getAttribute("data-village-id"),
          null,
        ),
      );
      const villageId =
        villageIdFromQuickEdit ||
        villageIdFromAttr ||
        (villageAnchor
          ? getUrlParam(villageAnchor.href, "village") ||
            getUrlParam(villageAnchor.href, "id")
          : null);

      const buildTroopsFromRow = (rowForTroops) => {
        const troopsMap = {};
        orderedUnits.forEach((unit) => {
          troopsMap[unit] = 0;
        });
        if (!rowForTroops) return troopsMap;

        const rowUnitCells = Array.from(
          rowForTroops.querySelectorAll("td.unit-item, th.unit-item"),
        );
        const rowUnitCellCount = rowUnitCells.length;
        const rowCells = Array.from(rowForTroops.children || []);
        const firstRowUnitCellIndex = rowCells.findIndex(
          (cell) =>
            cell && cell.classList && cell.classList.contains("unit-item"),
        );
        const rowUnitOffset =
          Number.isInteger(firstHeaderUnitColumnIndex) &&
          firstRowUnitCellIndex >= 0
            ? firstRowUnitCellIndex - firstHeaderUnitColumnIndex
            : 0;
        // Приоритет: strict-парсинг unit-item по порядку колонок.
        if (rowUnitCellCount > 0) {
          const sequentialUnits =
            buildSequentialUnitsForRowCellCount(rowUnitCellCount);
          for (let index = 0; index < rowUnitCellCount; index += 1) {
            const unit = sequentialUnits[index];
            if (!unit || !isUnitAllowedInWorld(unit, state.speedModel))
              continue;
            const value = Math.max(
              0,
              toInt(cleanText(rowUnitCells[index].textContent)) || 0,
            );
            if (value > (troopsMap[unit] || 0)) {
              troopsMap[unit] = value;
            }
          }
        } else {
          // Редкий fallback для нестандартной вёрстки без unit-item.
          finalUnitColumns.forEach(({ unit }) => {
            const indexes = unitColumnIndexMap.get(unit) || [];
            indexes.forEach((columnIndex) => {
              const mappedIndex =
                rowUnitOffset !== 0 &&
                Number.isInteger(columnIndex + rowUnitOffset)
                  ? columnIndex + rowUnitOffset
                  : columnIndex;
              const cell = rowCells[mappedIndex] || null;
              const value = Math.max(
                0,
                toInt(cleanText(cell ? cell.textContent : null)) || 0,
              );
              if (value > (troopsMap[unit] || 0)) {
                troopsMap[unit] = value;
              }
            });
          });
        }

        // В племенах паладин не может быть > 1 в деревне.
        if (Object.prototype.hasOwnProperty.call(troopsMap, "knight")) {
          troopsMap.knight = Math.min(
            1,
            Math.max(0, toInt(troopsMap.knight) || 0),
          );
        }

        return troopsMap;
      };

      const troops = buildTroopsFromRow(sourceRow);
      const totalTroops = countTroopsMap(troops);
      const defenseTroopsSource = totalRow ? "total_row" : troopsSource;
      const troopsDefense = buildTroopsFromRow(totalRow || sourceRow || row);
      const totalDefenseTroops = countTroopsMap(troopsDefense);

      return {
        villageId: villageId || null,
        villageName: villageText,
        villageCoord: villageCoord ? villageCoord.key : null,
        troopsSource,
        troops,
        totalTroops,
        defenseTroopsSource,
        troopsDefense,
        totalDefenseTroops,
      };
    });

    const dedup = new Map();
    const getTroopsSourceRank = (source) => {
      const key = cleanText(source) || "";
      if (key === "in_village_row") return 70;
      if (key === "home_link_row") return 65;
      if (key === "own_home_single_row") return 60;
      if (key === "own_home_row") return 55;
      if (key === "own_row") return 40;
      if (key === "fallback_row") return 20;
      if (key === "total_row") return 10;
      return 0;
    };
    villages.forEach((item) => {
      const key = item.villageId || item.villageCoord || item.villageName;
      const existing = dedup.get(key);
      if (!existing) {
        dedup.set(key, item);
        return;
      }

      const existingRank = getTroopsSourceRank(existing.troopsSource);
      const itemRank = getTroopsSourceRank(item.troopsSource);
      if (itemRank > existingRank) {
        const mergedDefenseTroops = mergeTroopsMapsMax(
          existing.troopsDefense,
          item.troopsDefense,
        );
        const mergedTotalDefenseTroops = countTroopsMap(mergedDefenseTroops);
        dedup.set(key, {
          ...item,
          villageId:
            cleanText(item.villageId) || cleanText(existing.villageId) || null,
          villageCoord:
            cleanText(item.villageCoord) ||
            cleanText(existing.villageCoord) ||
            null,
          villageName:
            cleanText(item.villageName) ||
            cleanText(existing.villageName) ||
            null,
          troopsDefense: mergedDefenseTroops,
          totalDefenseTroops: mergedTotalDefenseTroops,
          defenseTroopsSource: mergeDefenseTroopsSource(
            existing.defenseTroopsSource,
            item.defenseTroopsSource,
          ),
        });
        return;
      }
      if (itemRank < existingRank) {
        const mergedDefenseTroops = mergeTroopsMapsMax(
          existing.troopsDefense,
          item.troopsDefense,
        );
        const mergedTotalDefenseTroops = countTroopsMap(mergedDefenseTroops);
        dedup.set(key, {
          ...existing,
          villageId:
            cleanText(existing.villageId) || cleanText(item.villageId) || null,
          villageCoord:
            cleanText(existing.villageCoord) ||
            cleanText(item.villageCoord) ||
            null,
          villageName:
            cleanText(existing.villageName) ||
            cleanText(item.villageName) ||
            null,
          troopsDefense: mergedDefenseTroops,
          totalDefenseTroops: mergedTotalDefenseTroops,
          defenseTroopsSource: mergeDefenseTroopsSource(
            existing.defenseTroopsSource,
            item.defenseTroopsSource,
          ),
        });
        return;
      }

      const mergedTroops = mergeTroopsMapsMax(existing.troops, item.troops);
      const mergedTotalTroops = countTroopsMap(mergedTroops);
      const mergedDefenseTroops = mergeTroopsMapsMax(
        existing.troopsDefense,
        item.troopsDefense,
      );
      const mergedTotalDefenseTroops = countTroopsMap(mergedDefenseTroops);
      const mergedVillageId =
        cleanText(existing.villageId) || cleanText(item.villageId) || null;
      const mergedVillageCoord =
        cleanText(existing.villageCoord) ||
        cleanText(item.villageCoord) ||
        null;
      const mergedVillageName =
        cleanText(existing.villageName) || cleanText(item.villageName) || null;
      const mergedTroopsSource =
        cleanText(existing.troopsSource) ||
        cleanText(item.troopsSource) ||
        "fallback_row";
      const mergedDefenseTroopsSource = mergeDefenseTroopsSource(
        existing.defenseTroopsSource,
        item.defenseTroopsSource,
      );

      dedup.set(key, {
        ...existing,
        villageId: mergedVillageId,
        villageName: mergedVillageName,
        villageCoord: mergedVillageCoord,
        troopsSource: mergedTroopsSource,
        troops: mergedTroops,
        totalTroops: mergedTotalTroops,
        defenseTroopsSource: mergedDefenseTroopsSource,
        troopsDefense: mergedDefenseTroops,
        totalDefenseTroops: mergedTotalDefenseTroops,
      });
    });

    const uniqueVillages = Array.from(dedup.values());

    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      sourceUrl,
      count: uniqueVillages.length,
      units: finalUnitColumns.map((item) => item.unit),
      villages: uniqueVillages,
      warning: null,
    };
  };

  const fetchTroopsOwn = async (groupIdRaw = null) => {
    const groupId = normalizeVillageGroupId(
      groupIdRaw !== null && groupIdRaw !== undefined
        ? groupIdRaw
        : getSelectedVillageGroupId(),
    );
    const sourceUrl = buildGameUrl({
      screen: "overview_villages",
      mode: "units",
      type: "own_home",
      group: groupId,
      page: -1,
    });
    const doc = await fetchDocument(sourceUrl);
    return parseTroopsDocument(doc, sourceUrl);
  };

  const parseCommandsArrivalEpochMs = (arrivalText, arrivalMs) => {
    const text = cleanText(arrivalText);
    if (!text) return null;
    const ms = Math.max(0, toInt(arrivalMs) || 0);
    const now = getServerNow();
    const nowMs = now.getTime();
    const nowParts = getServerWallClockParts(nowMs);
    if (!nowParts) return null;
    const makeDateWithMs = (year, month, day, hour, minute, second) => {
      const epochMs = buildServerEpochMs(
        year,
        month,
        day,
        hour,
        minute,
        second,
        0,
      );
      return Number.isFinite(epochMs) ? epochMs + ms : null;
    };
    const parseTimeParts = (match) => {
      if (!match) return null;
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      const second = Number(match[3]);
      if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        !Number.isFinite(second)
      )
        return null;
      return { hour, minute, second };
    };

    const todayMatch = text.match(
      /(?:^|\s)(?:сегодня|today)\s+в\s+(\d{1,2}):(\d{2}):(\d{2})/i,
    );
    if (todayMatch) {
      const time = parseTimeParts(todayMatch);
      if (time) {
        return makeDateWithMs(
          nowParts.year,
          nowParts.month,
          nowParts.day,
          time.hour,
          time.minute,
          time.second,
        );
      }
    }

    const tomorrowMatch = text.match(
      /(?:^|\s)(?:завтра|tomorrow)\s+в\s+(\d{1,2}):(\d{2}):(\d{2})/i,
    );
    if (tomorrowMatch) {
      const time = parseTimeParts(tomorrowMatch);
      if (time) {
        const epochMs = buildServerEpochMs(
          nowParts.year,
          nowParts.month,
          nowParts.day + 1,
          time.hour,
          time.minute,
          time.second,
          0,
        );
        return Number.isFinite(epochMs) ? epochMs + ms : null;
      }
    }

    const dateMatch = text.match(
      /(\d{1,2})\.(\d{1,2})(?:\.)?\s*в\s*(\d{1,2}):(\d{2}):(\d{2})/i,
    );
    if (dateMatch) {
      const day = Number(dateMatch[1]);
      const month = Number(dateMatch[2]);
      const hour = Number(dateMatch[3]);
      const minute = Number(dateMatch[4]);
      const second = Number(dateMatch[5]);
      const year = nowParts.year;
      let candidate = makeDateWithMs(year, month, day, hour, minute, second);
      if (Number.isFinite(candidate)) {
        const sixMonthsMs = 183 * 24 * 60 * 60 * 1000;
        if (candidate < nowMs - sixMonthsMs) {
          candidate = makeDateWithMs(
            year + 1,
            month,
            day,
            hour,
            minute,
            second,
          );
        }
        return candidate;
      }
    }

    return null;
  };
  const hashString = (value) => {
    const source = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < source.length; i += 1) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return String(hash >>> 0);
  };
  const MESSAGE_MONTH_INDEX = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    sept: 8,
    oct: 9,
    nov: 10,
    dec: 11,
    янв: 0,
    фев: 1,
    мар: 2,
    апр: 3,
    май: 4,
    мая: 4,
    июн: 5,
    июл: 6,
    авг: 7,
    сен: 8,
    сент: 8,
    окт: 9,
    ноя: 10,
    дек: 11,
  };
  const parseMessageMonthIndex = (token) => {
    const cleanToken = String(token || "")
      .toLowerCase()
      .replace(/\./g, "")
      .trim();
    if (!cleanToken) return null;
    const direct = MESSAGE_MONTH_INDEX[cleanToken];
    if (Number.isInteger(direct)) return direct;
    const short = cleanToken.slice(0, 3);
    const byShort = MESSAGE_MONTH_INDEX[short];
    return Number.isInteger(byShort) ? byShort : null;
  };
  const formatArrivalTextFromEpochMs = (epochMs) => {
    const parts = getServerWallClockParts(epochMs);
    if (!parts) return null;
    const dd = String(parts.day).padStart(2, "0");
    const mm = String(parts.month).padStart(2, "0");
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    return `${dd}.${mm} в ${hh}:${mi}:${ss}`;
  };
  const getLastCoordKeyFromText = (text) => {
    const matches = Array.from(
      String(text || "").matchAll(/(\d{1,3}\|\d{1,3})/g),
    );
    if (!matches.length) return null;
    const last = matches[matches.length - 1];
    return cleanText(last && last[1]);
  };
  const parseMessageArrivalDatePayload = (rawText) => {
    const source = String(rawText || "").replace(/\u00a0/g, " ");
    if (!cleanText(source)) return null;

    const monthDateMatch = source.match(
      /([A-Za-zА-Яа-яёЁ]{3,}\.?)\s*(\d{1,2})\s*,?\s*(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/i,
    );
    if (monthDateMatch) {
      const monthIndex = parseMessageMonthIndex(monthDateMatch[1]);
      const day = toInt(monthDateMatch[2]);
      const year = toInt(monthDateMatch[3]);
      const hour = toInt(monthDateMatch[4]);
      const minute = toInt(monthDateMatch[5]);
      const second = toInt(monthDateMatch[6]);
      const ms = Math.max(0, toInt(monthDateMatch[7]) || 0);
      if (
        Number.isInteger(monthIndex) &&
        Number.isFinite(day) &&
        Number.isFinite(year) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        Number.isFinite(second)
      ) {
        const etaEpochMs = buildServerEpochMs(
          year,
          monthIndex + 1,
          day,
          hour,
          minute,
          second,
          ms,
        );
        if (Number.isFinite(etaEpochMs)) {
          const tail = cleanText(
            source.slice(monthDateMatch.index + monthDateMatch[0].length),
          );
          return {
            etaEpochMs,
            arrivalMs: ms,
            attackerName: tail || null,
            timeToken: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
              second,
            ).padStart(2, "0")}:${String(ms).padStart(3, "0")}`,
          };
        }
      }
    }

    const numericDateMatch = source.match(
      /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*(?:в)?\s*(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/i,
    );
    if (numericDateMatch) {
      const day = toInt(numericDateMatch[1]);
      const month = toInt(numericDateMatch[2]);
      const yearRaw = toInt(numericDateMatch[3]);
      const nowYear = (getServerWallClockParts(getServerNowMs()) || {}).year;
      const year = Number.isFinite(yearRaw)
        ? yearRaw < 100
          ? 2000 + yearRaw
          : yearRaw
        : nowYear;
      const hour = toInt(numericDateMatch[4]);
      const minute = toInt(numericDateMatch[5]);
      const second = toInt(numericDateMatch[6]);
      const ms = Math.max(0, toInt(numericDateMatch[7]) || 0);
      if (
        Number.isFinite(day) &&
        Number.isFinite(month) &&
        Number.isFinite(year) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        Number.isFinite(second)
      ) {
        const etaEpochMs = buildServerEpochMs(
          year,
          month,
          day,
          hour,
          minute,
          second,
          ms,
        );
        if (Number.isFinite(etaEpochMs)) {
          const tail = cleanText(
            source.slice(numericDateMatch.index + numericDateMatch[0].length),
          );
          return {
            etaEpochMs,
            arrivalMs: ms,
            attackerName: tail || null,
            timeToken: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
              second,
            ).padStart(2, "0")}:${String(ms).padStart(3, "0")}`,
          };
        }
      }
    }

    const arrivalMs = extractArrivalMsFromText(source);
    const arrivalText = extractArrivalDateTimeText(source) || cleanText(source);
    const etaEpochMs = parseCommandsArrivalEpochMs(arrivalText, arrivalMs);
    if (!Number.isFinite(etaEpochMs)) return null;
    const parts = getServerWallClockParts(etaEpochMs);
    const timeToken = parts
      ? `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(
          parts.second,
        ).padStart(
          2,
          "0",
        )}:${String(Math.max(0, toInt(arrivalMs) || 0)).padStart(3, "0")}`
      : null;
    return {
      etaEpochMs,
      arrivalMs: Number.isFinite(arrivalMs) ? arrivalMs : null,
      attackerName: null,
      timeToken,
    };
  };
  const parseForumArrivalDatePayloadReliable = (rawText) => {
    const fallbackPayload = parseMessageArrivalDatePayload(rawText);
    const source = String(rawText || "").replace(/\u00a0/g, " ");
    if (!cleanText(source)) return fallbackPayload;

    const offsetMs = getReliableServerTextUtcOffsetMs();
    const makePayload = ({
      etaEpochMs,
      arrivalMs = null,
      attackerName = null,
      hour,
      minute,
      second,
      millisecond = 0,
    }) => {
      if (!Number.isFinite(etaEpochMs)) return fallbackPayload;
      const safeMs = Math.max(0, toInt(millisecond) || toInt(arrivalMs) || 0);
      return {
        ...(fallbackPayload || {}),
        etaEpochMs,
        arrivalMs: safeMs,
        attackerName:
          cleanText(attackerName) ||
          cleanText(fallbackPayload && fallbackPayload.attackerName) ||
          null,
        timeToken: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
          second,
        ).padStart(2, "0")}:${String(safeMs).padStart(3, "0")}`,
      };
    };

    const monthDateMatch = source.match(
      /([A-Za-zА-Яа-яёЁ]{3,}\.?)\s*(\d{1,2})\s*,?\s*(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/i,
    );
    if (monthDateMatch) {
      const monthIndex = parseMessageMonthIndex(monthDateMatch[1]);
      const day = toInt(monthDateMatch[2]);
      const year = toInt(monthDateMatch[3]);
      const hour = toInt(monthDateMatch[4]);
      const minute = toInt(monthDateMatch[5]);
      const second = toInt(monthDateMatch[6]);
      const ms = Math.max(0, toInt(monthDateMatch[7]) || 0);
      if (
        Number.isInteger(monthIndex) &&
        Number.isFinite(day) &&
        Number.isFinite(year) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        Number.isFinite(second)
      ) {
        const etaEpochMs = buildServerEpochMsWithOffset(
          year,
          monthIndex + 1,
          day,
          hour,
          minute,
          second,
          ms,
          offsetMs,
        );
        const tail = cleanText(
          source.slice(monthDateMatch.index + monthDateMatch[0].length),
        );
        return makePayload({
          etaEpochMs,
          arrivalMs: ms,
          attackerName: tail || null,
          hour,
          minute,
          second,
          millisecond: ms,
        });
      }
    }

    const numericDateMatch = source.match(
      /(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*(?:в)?\s*(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/i,
    );
    if (numericDateMatch) {
      const day = toInt(numericDateMatch[1]);
      const month = toInt(numericDateMatch[2]);
      const yearRaw = toInt(numericDateMatch[3]);
      const nowParts = getServerWallClockPartsWithOffset(
        getServerNowMs(),
        offsetMs,
      );
      const year = Number.isFinite(yearRaw)
        ? yearRaw < 100
          ? 2000 + yearRaw
          : yearRaw
        : nowParts && nowParts.year;
      const hour = toInt(numericDateMatch[4]);
      const minute = toInt(numericDateMatch[5]);
      const second = toInt(numericDateMatch[6]);
      const ms = Math.max(0, toInt(numericDateMatch[7]) || 0);
      if (
        Number.isFinite(day) &&
        Number.isFinite(month) &&
        Number.isFinite(year) &&
        Number.isFinite(hour) &&
        Number.isFinite(minute) &&
        Number.isFinite(second)
      ) {
        let etaEpochMs = buildServerEpochMsWithOffset(
          year,
          month,
          day,
          hour,
          minute,
          second,
          ms,
          offsetMs,
        );
        if (
          Number.isFinite(etaEpochMs) &&
          !Number.isFinite(yearRaw) &&
          etaEpochMs < getServerNowMs() - 183 * 24 * 60 * 60 * 1000
        ) {
          etaEpochMs = buildServerEpochMsWithOffset(
            year + 1,
            month,
            day,
            hour,
            minute,
            second,
            ms,
            offsetMs,
          );
        }
        const tail = cleanText(
          source.slice(numericDateMatch.index + numericDateMatch[0].length),
        );
        return makePayload({
          etaEpochMs,
          arrivalMs: ms,
          attackerName: tail || null,
          hour,
          minute,
          second,
          millisecond: ms,
        });
      }
    }

    return fallbackPayload;
  };
  const formatManualDateTimeInputValue = (epochMs) => {
    const parts = getServerWallClockParts(epochMs);
    if (!parts) return "";
    const dd = String(parts.day).padStart(2, "0");
    const mm = String(parts.month).padStart(2, "0");
    const yyyy = String(parts.year);
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    const ms = String(parts.millisecond).padStart(3, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}:${ms}`;
  };
  const parseManualDateTimeInputPayload = (rawValue) => {
    const text = cleanText(rawValue);
    if (!text) return null;
    const now = getServerNow();
    const nowMs = now.getTime();
    const nowParts = getServerWallClockParts(nowMs);
    if (!nowParts) return null;
    const sixMonthsMs = 183 * 24 * 60 * 60 * 1000;

    const normalizeYear = (yearValue) => {
      const rawYear = toInt(yearValue);
      if (!Number.isFinite(rawYear)) return null;
      return rawYear < 100 ? 2000 + rawYear : rawYear;
    };
    const parseParts = ({
      year,
      month,
      day,
      hour,
      minute,
      second = 0,
      millisecond = 0,
      allowYearRollover = false,
    }) => {
      const y = Number(year);
      const m = Number(month);
      const d = Number(day);
      const hh = Number(hour);
      const mm = Number(minute);
      const ss = Number(second || 0);
      const ms = Number(millisecond || 0);
      if (
        !Number.isFinite(y) ||
        !Number.isFinite(m) ||
        !Number.isFinite(d) ||
        !Number.isFinite(hh) ||
        !Number.isFinite(mm) ||
        !Number.isFinite(ss) ||
        !Number.isFinite(ms)
      ) {
        return null;
      }
      if (
        m < 1 ||
        m > 12 ||
        d < 1 ||
        d > 31 ||
        hh < 0 ||
        hh > 23 ||
        mm < 0 ||
        mm > 59 ||
        ss < 0 ||
        ss > 59 ||
        ms < 0 ||
        ms > 999
      ) {
        return null;
      }
      const epochMs = buildServerEpochMs(y, m, d, hh, mm, ss, ms);
      if (!Number.isFinite(epochMs)) return null;
      const dt = getServerWallClockParts(epochMs);
      if (
        !dt ||
        dt.year !== y ||
        dt.month !== m ||
        dt.day !== d ||
        dt.hour !== hh ||
        dt.minute !== mm ||
        dt.second !== ss
      ) {
        return null;
      }
      let etaEpochMs = epochMs;
      if (allowYearRollover && etaEpochMs < nowMs - sixMonthsMs) {
        const nextYear = y + 1;
        const nextEpochMs = buildServerEpochMs(nextYear, m, d, hh, mm, ss, ms);
        const nextDt = Number.isFinite(nextEpochMs)
          ? getServerWallClockParts(nextEpochMs)
          : null;
        if (
          nextDt &&
          nextDt.year === nextYear &&
          nextDt.month === m &&
          nextDt.day === d &&
          nextDt.hour === hh &&
          nextDt.minute === mm &&
          nextDt.second === ss
        ) {
          etaEpochMs = nextEpochMs;
        }
      }
      return {
        etaEpochMs,
        arrivalMs: ms,
      };
    };

    const isoMatch = text.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?$/i,
    );
    if (isoMatch) {
      return parseParts({
        year: isoMatch[1],
        month: isoMatch[2],
        day: isoMatch[3],
        hour: isoMatch[4],
        minute: isoMatch[5],
        second: isoMatch[6] || 0,
        millisecond: isoMatch[7] || 0,
      });
    }

    const localMatch = text.match(
      /^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\.?\s*(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?$/i,
    );
    if (localMatch) {
      const explicitYear = normalizeYear(localMatch[3]);
      const year = Number.isFinite(explicitYear)
        ? explicitYear
        : nowParts.year;
      return parseParts({
        year,
        month: localMatch[2],
        day: localMatch[1],
        hour: localMatch[4],
        minute: localMatch[5],
        second: localMatch[6] || 0,
        millisecond: localMatch[7] || 0,
        allowYearRollover: !Number.isFinite(explicitYear),
      });
    }

    const dayTokenMatch = text.match(
      /^(сегодня|today|завтра|tomorrow)\s*(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?$/i,
    );
    if (dayTokenMatch) {
      const token = String(dayTokenMatch[1] || "").toLowerCase();
      const shiftDays = token === "завтра" || token === "tomorrow" ? 1 : 0;
      const baseDate = getServerWallClockParts(
        buildServerEpochMs(
          nowParts.year,
          nowParts.month,
          nowParts.day + shiftDays,
          0,
          0,
          0,
          0,
        ),
      );
      if (!baseDate) return null;
      return parseParts({
        year: baseDate.year,
        month: baseDate.month,
        day: baseDate.day,
        hour: dayTokenMatch[2],
        minute: dayTokenMatch[3],
        second: dayTokenMatch[4] || 0,
        millisecond: dayTokenMatch[5] || 0,
      });
    }

    const timeOnlyMatch = text.match(
      /^(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?$/i,
    );
    if (timeOnlyMatch) {
      return parseParts({
        year: nowParts.year,
        month: nowParts.month,
        day: nowParts.day,
        hour: timeOnlyMatch[1],
        minute: timeOnlyMatch[2],
        second: timeOnlyMatch[3] || 0,
        millisecond: timeOnlyMatch[4] || 0,
      });
    }

    const fallbackArrivalMs = extractArrivalMsFromText(text);
    const fallbackEpochMs = parseCommandsArrivalEpochMs(
      text,
      fallbackArrivalMs,
    );
    if (Number.isFinite(fallbackEpochMs)) {
      return {
        etaEpochMs: fallbackEpochMs,
        arrivalMs: Math.max(0, toInt(fallbackArrivalMs) || 0),
      };
    }

    return null;
  };
  const extractMessageLinesWithHosts = (root) => {
    if (!root) return [];
    const lines = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = cleanText(node && node.nodeValue);
        if (!text) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("#scriptmm-overlay-root"))
          return NodeFilter.FILTER_REJECT;
        if (
          parent.closest(
            ".smm-msg-inline-actions, .smm-msg-inline-panel, #smm-msg-inline-fallback",
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let order = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const hostElement =
        node && node.parentElement ? node.parentElement : null;
      const sourceText = String(node && node.nodeValue ? node.nodeValue : "");
      const chunks = Array.from(sourceText.matchAll(/[^\n]+/g));
      chunks.forEach((match) => {
        const chunk = String(match && match[0] ? match[0] : "");
        const line = cleanText(chunk);
        if (!line) return;
        const offsetStart = Number(match && match.index);
        const safeOffsetStart = Number.isFinite(offsetStart)
          ? offsetStart
          : null;
        const safeOffsetEnd =
          Number.isFinite(safeOffsetStart) && Number.isFinite(chunk.length)
            ? safeOffsetStart + chunk.length
            : null;
        lines.push({
          line,
          hostElement,
          sourceNode: node,
          lineOffsetStart: safeOffsetStart,
          lineOffsetEnd: safeOffsetEnd,
          order,
        });
        order += 1;
      });
    }
    return lines;
  };
  const findNearestMessageTargetAbove = (lines, startIndex) => {
    const sourceLines = Array.isArray(lines) ? lines : [];
    const from = Math.max(0, toInt(startIndex) || 0);
    for (let i = from; i >= 0; i -= 1) {
      const line = cleanText(sourceLines[i] && sourceLines[i].line);
      if (!line) continue;
      if (!/^\s*деревня\s*:/i.test(line)) continue;
      let coord = parseCoord(line);
      let targetLabel = line;
      if (!coord) {
        for (let lookAhead = 1; lookAhead <= 4; lookAhead += 1) {
          const nextLine = cleanText(
            sourceLines[i + lookAhead] && sourceLines[i + lookAhead].line,
          );
          if (!nextLine) continue;
          if (/^\s*деревня\s*:/i.test(nextLine)) break;
          const parsed = parseCoord(nextLine);
          if (!parsed) continue;
          coord = parsed;
          targetLabel = cleanText(`${line} ${nextLine}`) || nextLine;
          break;
        }
      }
      if (!coord) continue;
      return {
        targetCoord: coord.key,
        targetLabel,
      };
    }
    return null;
  };
  const findNearestMessageOriginAbove = (lines, startIndex, targetCoord) => {
    const sourceLines = Array.isArray(lines) ? lines : [];
    const from = Math.max(0, toInt(startIndex) || 0);
    for (let i = from; i >= 0; i -= 1) {
      const line = cleanText(sourceLines[i] && sourceLines[i].line);
      if (!line) continue;
      if (/^\s*деревня\s*:/i.test(line)) break;
      const coord = getLastCoordKeyFromText(line);
      if (!coord) continue;
      if (
        targetCoord &&
        normalizeCoordKey(coord) === normalizeCoordKey(targetCoord)
      )
        continue;
      return coord;
    }
    return null;
  };
  const findNearestMessageSigilPercentAbove = (lines, startIndex) => {
    const sourceLines = Array.isArray(lines) ? lines : [];
    const from = Math.max(0, toInt(startIndex) || 0);
    for (let i = from; i >= 0; i -= 1) {
      const line = cleanText(sourceLines[i] && sourceLines[i].line);
      if (!line) continue;
      const parsed = extractSigilPercentFromText(line);
      if (Number.isFinite(parsed)) return normalizeSigilPercent(parsed);
    }
    return null;
  };
  const extractMessagePlainLines = (root) => {
    if (!root) return [];
    const clone = safe(() => root.cloneNode(true), null);
    const textRoot = clone || root;
    if (clone && clone.querySelectorAll) {
      Array.from(
        clone.querySelectorAll(
          "#scriptmm-overlay-root, .smm-msg-inline-actions, .smm-msg-inline-panel, #smm-msg-inline-fallback, .smm-msg-manual-inline",
        ),
      ).forEach((node) => safe(() => node.remove(), null));
    }
    const rawText = String(textRoot.innerText || textRoot.textContent || "").replace(
      /\u00a0/g,
      " ",
    );
    if (!cleanText(rawText)) return [];
    const lines = [];
    let order = 0;
    rawText.split(/\n+/).forEach((lineRaw) => {
      const line = cleanText(lineRaw);
      if (!line) return;
      lines.push({ line, order });
      order += 1;
    });
    return lines;
  };
  const extractMessageTimeAnchorCandidates = (root) => {
    if (!root) return [];
    const candidates = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const text = cleanText(node && node.nodeValue);
        if (!text) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (parent.closest("#scriptmm-overlay-root"))
          return NodeFilter.FILTER_REJECT;
        if (
          parent.closest(
            ".smm-msg-inline-actions, .smm-msg-inline-panel, #smm-msg-inline-fallback",
          )
        ) {
          return NodeFilter.FILTER_REJECT;
        }
        const contextText = cleanText(parent.textContent);
        if (!/время\s*прибытия/i.test(String(contextText || ""))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let order = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node && node.parentElement ? node.parentElement : null;
      if (!parent) continue;
      const raw = String(node && node.nodeValue ? node.nodeValue : "");
      const matches = Array.from(
        raw.matchAll(/(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?/g),
      );
      matches.forEach((match) => {
        const hour = toInt(match[1]);
        const minute = toInt(match[2]);
        const second = toInt(match[3]);
        if (
          !Number.isFinite(hour) ||
          !Number.isFinite(minute) ||
          !Number.isFinite(second)
        )
          return;
        const ms = Math.max(0, toInt(match[4]) || 0);
        const token = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(
          second,
        ).padStart(2, "0")}:${String(ms).padStart(3, "0")}`;
        const start = Number(match.index);
        const end =
          Number.isFinite(start) &&
          Number.isFinite(String(match[0] || "").length)
            ? start + String(match[0] || "").length
            : null;
        candidates.push({
          order,
          hostElement: parent,
          sourceNode: node,
          lineOffsetStart: Number.isFinite(start) ? start : null,
          lineOffsetEnd: Number.isFinite(end) ? end : null,
          timeToken: token,
        });
        order += 1;
      });
    }
    return candidates;
  };
  const FORUM_SLICE_KEYWORD_RE =
    /(?:^|[^\p{L}\p{N}_])(?:с|c)рез[\p{L}\p{N}_-]*(?=$|[^\p{L}\p{N}_-])/iu;
  const FORUM_SLICE_ARRIVAL_LOOKAROUND_LINES = 18;
  const isForumSliceKeywordLine = (lineRaw) =>
    FORUM_SLICE_KEYWORD_RE.test(String(lineRaw || ""));
  const normalizeForumSliceComment = (lineRaw) =>
    cleanText(
      String(lineRaw || "")
        .replace(/\p{Extended_Pictographic}/gu, " ")
        .replace(/[^\p{L}\p{N}\s%.,:+\-]/gu, " ")
        .replace(/\s+/g, " "),
    );
  const isForumInlineUiNoiseLine = (
    lineRaw,
    { allowSliceKeyword = false } = {},
  ) => {
    const line = cleanText(lineRaw).toLowerCase();
    if (!line) return true;
    if (line === "срез" && !allowSliceKeyword) return true;
    if (
      line === "перехват/атака" ||
      line === "в хаб" ||
      line === "в избранное"
    ) {
      return true;
    }
    if (/^\?\s*→\s*\d{1,3}\|\d{1,3}$/i.test(line)) return true;
    return false;
  };
  const parseForumSliceAutoFavoriteHints = (root = document) => {
    const scope =
      root.querySelector("#forum_post_list") ||
      root.querySelector("#content_value") ||
      root.body ||
      null;
    if (!scope) return [];

    const postBodies = getForumPostBodies(root);
    const threadSigilPercent = getForumThreadFirstPostSigilPercent(root);
    const hints = [];
    const parseDebug = {
      posts: postBodies.length,
      hostLines: 0,
      plainLines: 0,
      triggerHost: 0,
      triggerPlain: 0,
      threadSigilPercent: Number.isFinite(threadSigilPercent)
        ? threadSigilPercent
        : null,
      threadSigilFallbackUsed: 0,
    };
    const parseHintsFromLines = (lines, mode = "host", fallbackSigil = null) => {
      const sourceLines = Array.isArray(lines) ? lines : [];
      const localHints = [];
      if (mode === "host") parseDebug.hostLines += sourceLines.length;
      if (mode === "plain") parseDebug.plainLines += sourceLines.length;

      for (let index = 0; index < sourceLines.length; index += 1) {
        const triggerLineRaw = cleanText(
          sourceLines[index] && sourceLines[index].line,
        );
        const triggerLine = normalizeForumSliceComment(triggerLineRaw);
        if (!triggerLine || !isForumSliceKeywordLine(triggerLine)) continue;
        if (isForumInlineUiNoiseLine(triggerLine, { allowSliceKeyword: true }))
          continue;
        if (mode === "host") parseDebug.triggerHost += 1;
        if (mode === "plain") parseDebug.triggerPlain += 1;

        let arrivalIndex = -1;
        const forwardLimit = Math.min(
          sourceLines.length - 1,
          index + FORUM_SLICE_ARRIVAL_LOOKAROUND_LINES,
        );
        for (let i = index + 1; i <= forwardLimit; i += 1) {
          const candidateLine = cleanText(sourceLines[i] && sourceLines[i].line);
          if (!candidateLine) continue;
          if (isForumSliceKeywordLine(candidateLine)) break;
          if (/время\s*прибытия/i.test(candidateLine)) {
            arrivalIndex = i;
            break;
          }
        }
        if (arrivalIndex < 0) continue;

        const arrivalLine = cleanText(
          sourceLines[arrivalIndex] && sourceLines[arrivalIndex].line,
        );
        if (!arrivalLine) continue;
        const markerMatch = arrivalLine.match(/время\s*прибытия\s*:?\s*/i);
        const markerIndex = markerMatch
          ? arrivalLine.toLowerCase().indexOf(markerMatch[0].toLowerCase())
          : -1;
        if (markerIndex < 0) continue;

        const beforeMarker = cleanText(arrivalLine.slice(0, markerIndex)) || null;
        const afterMarker =
          cleanText(arrivalLine.slice(markerIndex + markerMatch[0].length)) || "";
        const parsedDate = parseForumArrivalDatePayloadReliable(afterMarker);
        if (!parsedDate || !Number.isFinite(parsedDate.etaEpochMs)) continue;

        const nearestTarget = findNearestMessageTargetAbove(
          sourceLines,
          arrivalIndex,
        );
        const targetCoord = cleanText(nearestTarget && nearestTarget.targetCoord);
        if (!targetCoord) continue;
        const originCoord =
          getLastCoordKeyFromText(beforeMarker) ||
          findNearestMessageOriginAbove(
            sourceLines,
            arrivalIndex - 1,
            targetCoord,
          );
        const nearestSigilPercent = findNearestMessageSigilPercentAbove(
          sourceLines,
          arrivalIndex,
        );
        const resolvedSigilPercent = selectPreferredPositiveSigilPercent(
          nearestSigilPercent,
          fallbackSigil,
          threadSigilPercent,
        );
        if (
          !Number.isFinite(nearestSigilPercent) &&
          Number.isFinite(resolvedSigilPercent)
        ) {
          parseDebug.threadSigilFallbackUsed += 1;
        }
        const comment = normalizeForumSliceComment(triggerLineRaw || triggerLine);
        localHints.push({
          targetCoord,
          originCoord: cleanText(originCoord) || null,
          etaEpochMs: Number(parsedDate.etaEpochMs),
          arrivalText: afterMarker,
          arrivalMs: Number.isFinite(parsedDate.arrivalMs)
            ? parsedDate.arrivalMs
            : null,
          comment,
          sigilPercent: Number.isFinite(resolvedSigilPercent)
            ? normalizeSigilPercent(resolvedSigilPercent)
            : null,
        });
      }
      return localHints;
    };
    postBodies.forEach((postBody) => {
      const hostLines = extractMessageLinesWithHosts(postBody);
      const postSigilPercent = selectPreferredPositiveSigilPercent(
        findNearestMessageSigilPercentAbove(hostLines, hostLines.length - 1),
      );
      let postHints = parseHintsFromLines(hostLines, "host", postSigilPercent);
      if (!postHints.length) {
        const plainLines = extractMessagePlainLines(postBody).filter(
          (entry) =>
            !isForumInlineUiNoiseLine(entry && entry.line, {
              allowSliceKeyword: true,
            }),
        );
        const plainPostSigilPercent = selectPreferredPositiveSigilPercent(
          findNearestMessageSigilPercentAbove(plainLines, plainLines.length - 1),
          postSigilPercent,
        );
        postHints = parseHintsFromLines(plainLines, "plain", plainPostSigilPercent);
      }
      if (postHints.length) hints.push(...postHints);
    });
    state.forumAutoFavoriteParseDebug = parseDebug;

    const byKey = new Map();
    hints.forEach((hint) => {
      const key = [
        normalizeCoordIdentity(hint.targetCoord) || "?",
        normalizeCoordIdentity(hint.originCoord) || "?",
        Number.isFinite(hint.etaEpochMs) ? String(Math.round(hint.etaEpochMs)) : "?",
      ].join("|");
      if (!byKey.has(key)) {
        byKey.set(key, hint);
        return;
      }
      const existing = byKey.get(key);
      if (!cleanText(existing && existing.comment) && cleanText(hint.comment)) {
        byKey.set(key, hint);
      }
    });
	    return Array.from(byKey.values());
	  };
  const parseArrivalClockFromText = (textRaw, arrivalMsRaw = null) => {
    const text = cleanText(textRaw);
    if (!text) return null;
    const matches = Array.from(
      text.matchAll(/(\d{1,2}):(\d{2}):(\d{2})(?:[:.](\d{1,3}))?/g),
    );
    if (!matches.length) return null;
    const match = matches[matches.length - 1];
    const hour = toInt(match[1]);
    const minute = toInt(match[2]);
    const second = toInt(match[3]);
    const msRaw = toInt(match[4]);
    const fallbackMs = toInt(arrivalMsRaw);
    const millisecond = Number.isFinite(msRaw)
      ? Math.max(0, msRaw)
      : Number.isFinite(fallbackMs)
        ? Math.max(0, fallbackMs)
        : null;
    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      !Number.isFinite(second)
    ) {
      return null;
    }
    return { hour, minute, second, millisecond };
  };
  const epochMatchesArrivalClockText = (epochMsRaw, textRaw, arrivalMsRaw = null) => {
    const epochMs = toFiniteEpochMs(epochMsRaw);
    if (!Number.isFinite(epochMs)) return false;
    const clock = parseArrivalClockFromText(textRaw, arrivalMsRaw);
    if (!clock) return false;
    const parts = getServerWallClockPartsWithOffset(
      epochMs,
      getReliableServerTextUtcOffsetMs(),
    );
    if (!parts) return false;
    const msMatches =
      !Number.isFinite(clock.millisecond) ||
      Math.abs(parts.millisecond - clock.millisecond) <= 1;
    return (
      parts.hour === clock.hour &&
      parts.minute === clock.minute &&
      parts.second === clock.second &&
      msMatches
    );
  };
  const chooseForumFavoriteEtaMs = ({ hint, incoming }) => {
    const hintEtaMs = toFiniteEpochMs(hint && hint.etaEpochMs);
    const incomingEtaMs = toFiniteEpochMs(
      incoming && (incoming.arrivalEpochMs || incoming.etaEpochMs),
    );
    if (!Number.isFinite(hintEtaMs)) return incomingEtaMs;
    if (!Number.isFinite(incomingEtaMs)) return hintEtaMs;
    const diffMs = Math.abs(hintEtaMs - incomingEtaMs);
    if (diffMs <= 3000) return hintEtaMs;
    if (!isServerOffsetShift(hintEtaMs, incomingEtaMs)) return hintEtaMs;

    const arrivalText = cleanText(hint && hint.arrivalText);
    const arrivalMs = Number.isFinite(toInt(hint && hint.arrivalMs))
      ? toInt(hint && hint.arrivalMs)
      : null;
    const hintMatches = epochMatchesArrivalClockText(
      hintEtaMs,
      arrivalText,
      arrivalMs,
    );
    const incomingMatches = epochMatchesArrivalClockText(
      incomingEtaMs,
      arrivalText,
      arrivalMs,
    );
    const selectedEtaMs =
      incomingMatches || !hintMatches ? incomingEtaMs : hintEtaMs;
    console.warn(`${LOG_PREFIX} [forum-favorite-eta-repair]`, {
      version: VERSION,
      hint: formatTimeWithMs(hintEtaMs),
      incoming: formatTimeWithMs(incomingEtaMs),
      selected: formatTimeWithMs(selectedEtaMs),
      arrivalText,
      hintMatches,
      incomingMatches,
    });
    return selectedEtaMs;
  };
  const matchForumSliceHintToIncoming = (hint, incomingItems) => {
    const sourceItems = Array.isArray(incomingItems) ? incomingItems : [];
    const hintEtaMs = toFiniteEpochMs(hint && hint.etaEpochMs);
    if (!Number.isFinite(hintEtaMs)) return null;
    const hintTargetKey = normalizeCoordIdentity(hint && hint.targetCoord);
    const hintOriginKey = normalizeCoordIdentity(hint && hint.originCoord);
    if (!hintTargetKey) return null;
    const targetItems = sourceItems.filter((item) => {
      const itemTargetKey = normalizeCoordIdentity(
        item && (item.targetCoord || item.target),
      );
      return Boolean(itemTargetKey && itemTargetKey === hintTargetKey);
    });
    if (!targetItems.length) return null;

    const scopedItems = hintOriginKey
      ? (() => {
          const sameOrigin = targetItems.filter((item) => {
            const itemOriginKey = normalizeCoordIdentity(
              item && (item.originCoord || item.origin),
            );
            return Boolean(itemOriginKey && itemOriginKey === hintOriginKey);
          });
          return sameOrigin.length ? sameOrigin : targetItems;
        })()
      : targetItems;

    let best = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    scopedItems.forEach((item) => {
      const itemEtaMs = toFiniteEpochMs(
        item && (item.arrivalEpochMs || item.etaEpochMs),
      );
      if (!Number.isFinite(itemEtaMs)) return;
      const deltaMs = Math.abs(itemEtaMs - hintEtaMs);
      const adjustedDeltaMs = isServerOffsetShift(itemEtaMs, hintEtaMs)
        ? 3000 +
          Math.abs(deltaMs - Math.abs(getReliableServerTextUtcOffsetMs()))
        : deltaMs;
      if (deltaMs > 3000 && !isServerOffsetShift(itemEtaMs, hintEtaMs)) return;
      if (adjustedDeltaMs < bestDelta) {
        bestDelta = adjustedDeltaMs;
        best = item;
      }
    });
    return best;
  };
  const autoAddForumSliceFavorites = (payload = null) => {
    if (!isForumThreadPlanningScreen()) {
      return { ok: true, skipped: true, reason: "not_forum_view_thread" };
    }
    const uiSettings = normalizeUiSettings(readJson(STORAGE_KEYS.uiSettings));
    if (!uiSettings.favoritesEnabled) {
      return { ok: true, skipped: true, reason: "favorites_disabled" };
    }

    loadFavoriteEntries();
    const hints = parseForumSliceAutoFavoriteHints(document);
    if (!hints.length) {
      return {
        ok: true,
        skipped: true,
        reason: "no_slice_hints",
        debug: cloneSerializable(state.forumAutoFavoriteParseDebug, null),
      };
    }
    const incomingItems =
      payload &&
      payload.dump &&
      Array.isArray(payload.dump.items) &&
      payload.dump.items.length
        ? payload.dump.items
        : getIncomingItems();
    let sourceIncomingItems = Array.isArray(incomingItems) ? incomingItems : [];
    if (!sourceIncomingItems.length && isMessagePlanningScreen()) {
      const fallbackPayload = parseMessagePlanningPayload(document);
      if (
        fallbackPayload &&
        fallbackPayload.dump &&
        Array.isArray(fallbackPayload.dump.items)
      ) {
        sourceIncomingItems = fallbackPayload.dump.items;
      }
    }
    if (!sourceIncomingItems.length) {
      return { ok: true, skipped: true, reason: "no_incomings" };
    }

    const existingCoordEtaKeys = new Set();
    (Array.isArray(state.favoritesEntries) ? state.favoritesEntries : [])
      .map((entry) => normalizeFavoriteEntry(entry))
      .filter(Boolean)
      .forEach((entry) => {
        const key = buildCoordEtaKey(
          entry &&
            entry.incoming &&
            (entry.incoming.targetCoord || entry.incoming.target),
          entry && entry.etaEpochMs,
        );
        if (key) existingCoordEtaKeys.add(key);
      });

    let added = 0;
    let updated = 0;
    let matched = 0;
    let skippedDuplicate = 0;
    let skippedNoMatch = 0;
    hints.forEach((hint) => {
      const incoming = matchForumSliceHintToIncoming(hint, sourceIncomingItems);
      if (!incoming) {
        skippedNoMatch += 1;
        return;
      }
      matched += 1;
      const favoriteEtaMs = chooseForumFavoriteEtaMs({ hint, incoming });
      const incomingForFavorite =
        Number.isFinite(favoriteEtaMs) && incoming && typeof incoming === "object"
          ? {
              ...incoming,
              etaEpochMs: favoriteEtaMs,
              arrivalEpochMs: favoriteEtaMs,
              arrivalText: formatArrivalTextFromEpochMs(favoriteEtaMs),
              arrivalServerText: cleanText(hint && hint.arrivalText) || null,
              arrivalMs: Number.isFinite(toInt(hint && hint.arrivalMs))
                ? toInt(hint && hint.arrivalMs)
                : incoming.arrivalMs,
              arrivalEpochSource: "forum_auto_favorite",
              originCoord:
                cleanText(hint && hint.originCoord) ||
                cleanText(incoming.originCoord) ||
                null,
            }
          : incoming;
      const key = buildCoordEtaKey(
        incomingForFavorite &&
          (incomingForFavorite.targetCoord || incomingForFavorite.target),
        incomingForFavorite &&
          (incomingForFavorite.arrivalEpochMs || incomingForFavorite.etaEpochMs),
      );
      if (key && existingCoordEtaKeys.has(key)) {
        const updatedResult = updateFavoriteByCoordEtaKey({
          coordEtaKey: key,
          comment: cleanText(hint && hint.comment) || null,
          sigilPercent: Number.isFinite(toNumber(hint && hint.sigilPercent))
            ? normalizeSigilPercent(toNumber(hint && hint.sigilPercent))
            : undefined,
        });
        if (updatedResult && updatedResult.ok) {
          updated += Number(updatedResult.updated) || 1;
        } else {
          skippedDuplicate += 1;
        }
        return;
      }
      const result = addIncomingToFavorites({
        incoming: incomingForFavorite,
        comment: cleanText(hint && hint.comment) || null,
        sigilPercent: Number.isFinite(toNumber(hint && hint.sigilPercent))
          ? normalizeSigilPercent(toNumber(hint && hint.sigilPercent))
          : undefined,
      });
      if (result && result.ok) {
        added += 1;
        if (key) existingCoordEtaKeys.add(key);
      }
    });
    return {
      ok: true,
      added,
      updated,
      matched,
      skippedDuplicate,
      skippedNoMatch,
      parsedHints: hints.length,
      debug: cloneSerializable(state.forumAutoFavoriteParseDebug, null),
    };
  };
  const runForumAutoFavoriteImport = ({
    payload = null,
    phase = "run",
    notifyOnAdd = false,
  } = {}) => {
    const result = autoAddForumSliceFavorites(payload);
    if (DEBUG_VERBOSE_LOGS && isForumThreadPlanningScreen()) {
      console.info("[ScriptMM][forum-auto-favorites]", {
        phase,
        ...(result || {}),
      });
    }
    if (notifyOnAdd && result && Number(result.added) > 0) {
      const infoText = `Форум: добавлено в избранное ${result.added}.`;
      notifyHubStatus(infoText, { skipStatus: true });
    }
    return result;
  };
  const scheduleForumAutoFavoriteImportRetries = () => {
    if (!isForumThreadPlanningScreen()) return;
    const retries = [350, 900, 1800, 3200];
    retries.forEach((delayMs, retryIndex) => {
      setTimeout(() => {
        if (!isForumThreadPlanningScreen()) return;
        runForumAutoFavoriteImport({
          payload: null,
          phase: `retry_${retryIndex + 1}`,
          notifyOnAdd: retryIndex === 0,
        });
      }, delayMs);
    });
  };
  const extractInfoVillageTargetCoord = (root) => {
    if (!root) return null;

    const rows = Array.from(root.querySelectorAll("tr"));
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td, th"));
      if (cells.length < 2) continue;
      const label = cleanText(cells[0].textContent);
      if (!label || !/(?:координат|coordinates?)/i.test(label)) continue;
      const coord = parseCoord(cells[1].textContent);
      if (coord) return coord.key;
    }

    const source = `${safe(() => root.innerText, "") || ""}\n${safe(() => root.textContent, "") || ""}`;
    const byLabel = source.match(
      /(?:координат[ыа]?|coordinates?)\s*:?\s*(\d{1,3}\|\d{1,3})/i,
    );
    if (byLabel && byLabel[1]) {
      const parsed = parseCoord(byLabel[1]);
      if (parsed) return parsed.key;
    }

    const fallback = parseCoord(source);
    return fallback ? fallback.key : null;
  };
  const parseInfoVillagePlanningPayload = (doc = document) => {
    const root = doc.querySelector("#content_value") || doc.body;
    if (!root) {
      return {
        dump: {
          version: 1,
          fetchedAt: new Date(getServerNowMs()).toISOString(),
          sourceUrl: location.href,
          count: 0,
          items: [],
          warning: "info_village root not found",
          source: "info_village_parser",
        },
        anchors: [],
      };
    }

    const targetCoord = extractInfoVillageTargetCoord(root);
    const targetTitle =
      cleanText(
        safe(
          () =>
            root.querySelector(
              "h2, h3, .box-item h2, .box-item h3, .village-name, #content_value h2, #content_value h3",
            ).textContent,
          null,
        ),
      ) || targetCoord;

    const mergeUnits = (target, source) => {
      Object.entries(
        source && typeof source === "object" && !Array.isArray(source)
          ? source
          : {},
      ).forEach(([unit, count]) => {
        const unitKey = String(unit || "").toLowerCase();
        const safeCount = Math.max(0, toInt(count) || 0);
        if (!unitKey || !safeCount) return;
        target[unitKey] = Math.max(0, toInt(target[unitKey]) || 0) + safeCount;
      });
    };
    const extractSquadUnitsFromCommandCell = (commandCell, commandText) => {
      const units = {};
      if (commandCell) {
        Array.from(commandCell.querySelectorAll("[title], [data-icon-hint]")).forEach(
          (node) => {
            if (!node) return;
            const candidates = [
              cleanText(node.getAttribute("title")),
              cleanText(node.getAttribute("data-original-title")),
              cleanText(node.getAttribute("data-icon-hint")),
              cleanText(node.tooltipText),
            ].filter(Boolean);
            candidates.forEach((payload) => {
              mergeUnits(
                units,
                parseUnitsMapFromTooltipPayload(payload, state.speedModel),
              );
            });
          },
        );
      }
      if (!Object.keys(units).length && cleanText(commandText)) {
        mergeUnits(
          units,
          parseUnitsMapFromCommandLabel(cleanText(commandText)),
        );
      }
      return normalizeSupportUnitsMap(units, state.speedModel);
    };

    const items = [];
    const anchors = [];
    const directRowsSet = new Set();
    const directRows = [];
    const pushRow = (row) => {
      if (!row || directRowsSet.has(row)) return;
      const cells = Array.from(row.children || []).filter(
        (cell) => cell && cell.tagName === "TD",
      );
      if (cells.length < 2) return;
      const arrivalText =
        cleanText(safe(() => cells[1].textContent, null)) || "";
      if (!arrivalText || !/\b\d{1,2}:\d{2}:\d{2}\b/.test(arrivalText)) return;
      directRowsSet.add(row);
      directRows.push(row);
    };

    Array.from(
      doc.querySelectorAll(
        "#commands_outgoings table tr, .commands-container[data-type='towards_village'] table tr",
      ),
    ).forEach((row) => pushRow(row));

    Array.from(doc.querySelectorAll("a[href*='screen=info_command']")).forEach(
      (link) => {
        const row = link.closest("tr");
        pushRow(row);
      },
    );

    const directCommandRows = directRows;
    directCommandRows.forEach((row, rowIndex) => {
      const cells = Array.from(row.children || []).filter(
        (cell) => cell && cell.tagName === "TD",
      );
      if (cells.length < 2) return;

      const commandCell = cells[0];
      const arrivalCell = cells[1];
      const timerCell = cells.length > 2 ? cells[2] : null;
      if (!arrivalCell) return;

      const msNode = arrivalCell.querySelector(".grey.small");
      const msText = cleanText(msNode ? msNode.textContent : null);
      const arrivalMs = toInt(msText);
      const rawArrivalText = cleanText(
        safe(() => arrivalCell.textContent, null),
      );
      const arrivalTextWithoutMs = rawArrivalText
        ? cleanText(
            msText ? rawArrivalText.replace(msText, "") : rawArrivalText,
          )
        : null;
      const arrivalText =
        extractArrivalDateTimeText(arrivalTextWithoutMs) ||
        arrivalTextWithoutMs ||
        rawArrivalText;

      const timerNode =
        row.querySelector(".widget-command-timer, .timer_link, .timer") ||
        (timerCell &&
          timerCell.querySelector(
            ".widget-command-timer, .timer_link, .timer",
          ));
      const timerNodeText = cleanText(timerNode ? timerNode.textContent : null);
      const timerCellText = cleanText(timerCell ? timerCell.textContent : null);
      const timerText = timerNodeText || timerCellText || null;
      const timerSeconds = parseTimerToSeconds(timerText);
      const timerEndtime = Number(
        safe(() => timerNode.getAttribute("data-endtime"), null),
      );

      let etaEpochMs = parseCommandsArrivalEpochMs(arrivalText, arrivalMs);
      if (!Number.isFinite(etaEpochMs) && Number.isFinite(timerEndtime)) {
        etaEpochMs = timerEndtime * 1000 + Math.max(0, toInt(arrivalMs) || 0);
      }
      if (!Number.isFinite(etaEpochMs) && Number.isFinite(timerSeconds)) {
        etaEpochMs =
          getServerNowMs() +
          timerSeconds * 1000 +
          Math.max(0, toInt(arrivalMs) || 0);
      }
      if (!Number.isFinite(etaEpochMs)) return;

      const commandText =
        cleanText(safe(() => commandCell.textContent, null)) || "приказ";
      const squadUnits = extractSquadUnitsFromCommandCell(commandCell, commandText);
      const commandLink =
        commandCell.querySelector("a[href*='screen=info_command']") || null;
      const commandHrefRaw =
        cleanText(safe(() => commandLink.getAttribute("href"), null)) ||
        cleanText(safe(() => commandLink.href, null));
      const commandUrl = commandHrefRaw
        ? safe(() => new URL(commandHrefRaw, location.origin).toString(), null)
        : null;
      const commandId =
        cleanText(getUrlParam(commandHrefRaw, "id")) ||
        cleanText(getUrlParam(commandUrl, "id")) ||
        null;
      const commandIcons = Array.from(commandCell.querySelectorAll("img[src]"))
        .map((img) => cleanText(img.getAttribute("src")))
        .filter(Boolean);
      const commandTypeByHint = cleanText(
        safe(
          () =>
            commandCell
              .querySelector("[data-command-type]")
              .getAttribute("data-command-type"),
          null,
        ),
      );
      const commandTypeByIcon =
        commandIcons
          .map((src) => detectCommandTypeByIcon(src))
          .find((type) => type && type !== "other") || null;
      const normalizedCommandType =
        commandTypeByHint === "support" ||
        commandTypeByHint === "attack" ||
        commandTypeByHint === "return"
          ? commandTypeByHint
          : commandTypeByIcon || "support";

      const detectedUnits = Array.from(
        new Set(
          commandIcons
            .map(
              (src) => parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src),
            )
            .map((unit) => String(unit || "").toLowerCase())
            .filter(Boolean)
            .filter((unit) => isUnitAllowedInWorld(unit, state.speedModel)),
        ),
      );
      const unitFromText = detectUnitFromText(commandText);
      if (
        unitFromText &&
        isUnitAllowedInWorld(unitFromText, state.speedModel) &&
        !detectedUnits.includes(unitFromText)
      ) {
        detectedUnits.push(unitFromText);
      }
      const guessedUnit = detectedUnits.length ? detectedUnits[0] : null;
      const unitIconsByKey = {};
      detectedUnits.forEach((unit) => {
        const iconSrc =
          commandIcons.find((src) => {
            const parsed =
              parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src);
            return parsed === unit;
          }) || getUnitIconFallback(unit);
        if (iconSrc) unitIconsByKey[unit] = iconSrc;
      });

      const originCoordRaw = getLastCoordKeyFromText(commandText);
      const targetCoordObj = parseCoord(targetCoord);
      const originCoordObj = parseCoord(originCoordRaw);
      const distance = calcDistance(originCoordObj, targetCoordObj);
      const resolvedTimerSeconds = Number.isFinite(timerSeconds)
        ? Math.max(0, timerSeconds)
        : Math.max(0, Math.round((etaEpochMs - getServerNowMs()) / 1000));

      const incomingId = `iv_${hashString(
        `${targetCoord || "?"}|${etaEpochMs}|${Math.max(0, toInt(arrivalMs) || 0)}|direct|${rowIndex}|${commandText}`,
      )}`;
      const arrivalTextResolved =
        arrivalText || formatArrivalTextFromEpochMs(etaEpochMs);

      items.push({
        id: incomingId,
        commandType: normalizedCommandType,
        displayType: normalizedCommandType,
        commandLabel: commandText,
        kindText: guessedUnit ? getUnitLabel(guessedUnit) : null,
        target: targetTitle || targetCoord || "?",
        targetCoord: targetCoord || null,
        targetVillageId:
          cleanText(
            getUrlParam(location.href, "i") ||
              getUrlParam(location.href, "id") ||
              getUrlParam(location.href, "village"),
          ) || null,
        origin: originCoordRaw || "unknown",
        originCoord: originCoordRaw || null,
        originVillageId: null,
        player: "unknown",
        playerId: null,
        distance,
        commandId,
        sourceCommandId: commandId || null,
        commandUrl: commandUrl || null,
        arrivalText: arrivalTextResolved,
        arrivalMs: Number.isFinite(arrivalMs) ? arrivalMs : null,
        arrivalEpochMs: etaEpochMs,
        arrivalEpochSource: "info_village_direct",
        timerText: timerText || formatCountdown(resolvedTimerSeconds),
        timerSeconds: resolvedTimerSeconds,
        guessedUnit,
        guessedUnitIcon: guessedUnit
          ? unitIconsByKey[guessedUnit] || getUnitIconFallback(guessedUnit)
          : null,
        squadUnits,
        detectedUnits,
        unitIconsByKey,
      });
      anchors.push({
        incomingId,
        hostElement: arrivalCell,
        sourceNode: null,
        lineOffsetStart: null,
        lineOffsetEnd: null,
        timeToken:
          Number.isFinite(etaEpochMs) && Number.isFinite(arrivalMs)
            ? formatTimeWithMs(etaEpochMs)
            : Number.isFinite(etaEpochMs)
              ? formatTimeOnly(etaEpochMs)
              : null,
        originCoord: originCoordRaw || null,
        targetCoord: targetCoord || null,
        player: null,
        line: commandText,
      });
    });

    let allowGenericFallbackRows = true;
    if (!items.length) {
      const outgoingContainers = Array.from(
        doc.querySelectorAll(
          "#commands_outgoings, .commands-container[data-type='towards_village']",
        ),
      ).filter((container) => {
        if (!container) return false;
        const rows = Array.from(container.querySelectorAll("table tr"));
        return rows.some((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length < 2) return false;
          const arrivalText =
            cleanText(safe(() => cells[1].textContent, null)) || "";
          return /\b\d{1,2}:\d{2}:\d{2}\b/.test(arrivalText);
        });
      });
      const outgoingTables = outgoingContainers
        .map(
          (container) =>
            container.querySelector("table.vis") ||
            container.querySelector("table"),
        )
        .filter(Boolean);

      const candidateTables =
        outgoingTables.length > 0
          ? Array.from(new Set(outgoingTables))
          : Array.from(doc.querySelectorAll("table.vis, table")).filter(
              (table) => {
                const previewRows = Array.from(
                  table.querySelectorAll("tr"),
                ).slice(0, 4);
                const previewCells = previewRows.flatMap((row) =>
                  Array.from(row.querySelectorAll("th, td")),
                );
                const previewTexts = previewCells
                  .map((cell) => cleanText(cell.textContent) || "")
                  .filter(Boolean);
                return previewTexts.some((text) =>
                  /(?:^|\s)(?:прибытие|arrival)\b/i.test(text),
                );
              },
            );
      const tables = candidateTables.filter(
        (table) =>
          !candidateTables.some(
            (other) => other !== table && table.contains(other),
          ),
      );
      allowGenericFallbackRows = outgoingTables.length === 0;

      tables.forEach((table, tableIndex) => {
        const rows = Array.from(table.querySelectorAll("tr")).filter(
          (row) => row.closest("table") === table,
        );
        const headerRow = rows.find((row) => {
          const headers = Array.from(row.querySelectorAll("th, td"));
          return headers.some((cell) =>
            /(?:^|\s)(?:прибытие|arrival)\b/i.test(
              cleanText(cell.textContent) || "",
            ),
          );
        });
        if (!headerRow) return;

        const headerCells = Array.from(headerRow.querySelectorAll("th, td"));
        let arrivalColumnIndex = headerCells.findIndex((cell) => {
          const text = cleanText(cell.textContent) || "";
          return (
            /(?:^|\s)(?:прибытие|arrival)\b/i.test(text) &&
            !/(?:через|remaining|left)/i.test(text)
          );
        });
        if (arrivalColumnIndex < 0) {
          arrivalColumnIndex = headerCells.findIndex((cell) =>
            /(?:^|\s)(?:прибытие|arrival)\b/i.test(
              cleanText(cell.textContent) || "",
            ),
          );
        }
        if (arrivalColumnIndex < 0) return;

        const timerColumnIndex = headerCells.findIndex((cell) =>
          /(?:через|remaining|left|до прибытия|in\s)/i.test(
            cleanText(cell.textContent) || "",
          ),
        );

        const dataRowsRaw = Array.from(
          table.querySelectorAll("tr.row_a, tr.row_b, tr.row_ax, tr.row_bx"),
        ).filter((row) => row.closest("table") === table);
        const commandRows = Array.from(
          table.querySelectorAll("tr.command-row"),
        ).filter((row) => row.closest("table") === table);
        const headerRowIndex = rows.indexOf(headerRow);
        const dataRows = commandRows.length
          ? commandRows
          : dataRowsRaw.length
            ? dataRowsRaw
            : rows.filter((row, index) => {
                if (index <= headerRowIndex) return false;
                if (row === headerRow) return false;
                const cells = Array.from(row.querySelectorAll("td"));
                if (cells.length <= arrivalColumnIndex) return false;
                const rowText = cleanText(row.textContent) || "";
                if (
                  /(?:^|\s)(?:прибытие|arrival)\b/i.test(rowText) &&
                  /(?:через|remaining|left)/i.test(rowText)
                ) {
                  return false;
                }
                return true;
              });

        dataRows.forEach((row, rowIndex) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length <= arrivalColumnIndex) return;

          const commandCell = cells[0] || row;
          const arrivalCell = cells[arrivalColumnIndex];
          const timerCell =
            timerColumnIndex >= 0 ? cells[timerColumnIndex] || null : null;
          if (!arrivalCell) return;

          const msNode = arrivalCell.querySelector(".grey.small");
          const msText = cleanText(msNode ? msNode.textContent : null);
          const arrivalMs = toInt(msText);
          const rawArrivalText = cleanText(
            safe(() => arrivalCell.textContent, null),
          );
          const arrivalTextWithoutMs = rawArrivalText
            ? cleanText(
                msText ? rawArrivalText.replace(msText, "") : rawArrivalText,
              )
            : null;
          const arrivalText =
            extractArrivalDateTimeText(arrivalTextWithoutMs) ||
            arrivalTextWithoutMs ||
            rawArrivalText;

          const timerNode =
            row.querySelector(".timer_link, .timer") ||
            (timerCell && timerCell.querySelector(".timer_link, .timer"));
          const timerNodeText = cleanText(
            timerNode ? timerNode.textContent : null,
          );
          const timerCellText = cleanText(
            timerCell ? timerCell.textContent : null,
          );
          const timerText = timerNodeText || timerCellText || null;
          const timerSeconds = parseTimerToSeconds(timerText);
          const timerEndtime = Number(
            safe(() => timerNode.getAttribute("data-endtime"), null),
          );

          let etaEpochMs = parseCommandsArrivalEpochMs(arrivalText, arrivalMs);
          if (!Number.isFinite(etaEpochMs) && Number.isFinite(timerEndtime)) {
            etaEpochMs =
              timerEndtime * 1000 + Math.max(0, toInt(arrivalMs) || 0);
          }
          if (!Number.isFinite(etaEpochMs) && Number.isFinite(timerSeconds)) {
            etaEpochMs =
              getServerNowMs() +
              timerSeconds * 1000 +
              Math.max(0, toInt(arrivalMs) || 0);
          }
          if (!Number.isFinite(etaEpochMs)) return;

          const commandText =
            cleanText(safe(() => commandCell.textContent, null)) || "приказ";
          const squadUnits = extractSquadUnitsFromCommandCell(
            commandCell,
            commandText,
          );
          const commandLink =
            commandCell.querySelector("a[href*='screen=info_command']") || null;
          const commandHrefRaw =
            cleanText(safe(() => commandLink.getAttribute("href"), null)) ||
            cleanText(safe(() => commandLink.href, null));
          const commandUrl = commandHrefRaw
            ? safe(() => new URL(commandHrefRaw, location.origin).toString(), null)
            : null;
          const commandId =
            cleanText(getUrlParam(commandHrefRaw, "id")) ||
            cleanText(getUrlParam(commandUrl, "id")) ||
            null;
          const commandIcons = Array.from(
            commandCell.querySelectorAll("img[src]"),
          )
            .map((img) => cleanText(img.getAttribute("src")))
            .filter(Boolean);
          const commandTypeByIcon =
            commandIcons
              .map((src) => detectCommandTypeByIcon(src))
              .find((type) => type && type !== "other") || "support";
          const detectedUnits = Array.from(
            new Set(
              commandIcons
                .map(
                  (src) =>
                    parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src),
                )
                .map((unit) => String(unit || "").toLowerCase())
                .filter((unit) => isUnitAllowedInWorld(unit, state.speedModel)),
            ),
          );
          const unitFromText = detectUnitFromText(commandText);
          if (
            unitFromText &&
            isUnitAllowedInWorld(unitFromText, state.speedModel) &&
            !detectedUnits.includes(unitFromText)
          ) {
            detectedUnits.push(unitFromText);
          }
          const guessedUnit = detectedUnits.length ? detectedUnits[0] : null;
          const unitIconsByKey = {};
          detectedUnits.forEach((unit) => {
            const iconSrc =
              commandIcons.find((src) => {
                const parsed =
                  parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src);
                return parsed === unit;
              }) || getUnitIconFallback(unit);
            if (iconSrc) unitIconsByKey[unit] = iconSrc;
          });

          const originCoordRaw = getLastCoordKeyFromText(commandText);
          const targetCoordObj = parseCoord(targetCoord);
          const originCoordObj = parseCoord(originCoordRaw);
          const distance = calcDistance(originCoordObj, targetCoordObj);
          const resolvedTimerSeconds = Number.isFinite(timerSeconds)
            ? Math.max(0, timerSeconds)
            : Math.max(0, Math.round((etaEpochMs - getServerNowMs()) / 1000));

          const incomingId = `iv_${hashString(
            `${targetCoord || "?"}|${etaEpochMs}|${Math.max(0, toInt(arrivalMs) || 0)}|${tableIndex}|${rowIndex}|${commandText}`,
          )}`;
          const arrivalTextResolved =
            arrivalText || formatArrivalTextFromEpochMs(etaEpochMs);
          items.push({
            id: incomingId,
            commandType: commandTypeByIcon,
            displayType: commandTypeByIcon,
            commandLabel: commandText,
            kindText: guessedUnit ? getUnitLabel(guessedUnit) : null,
            target: targetTitle || targetCoord || "?",
            targetCoord: targetCoord || null,
            targetVillageId:
              cleanText(
                getUrlParam(location.href, "i") ||
                  getUrlParam(location.href, "id") ||
                  getUrlParam(location.href, "village"),
              ) || null,
            origin: originCoordRaw || "unknown",
            originCoord: originCoordRaw || null,
            originVillageId: null,
            player: "unknown",
            playerId: null,
            distance,
            commandId,
            sourceCommandId: commandId || null,
            commandUrl: commandUrl || null,
            arrivalText: arrivalTextResolved,
            arrivalMs: Number.isFinite(arrivalMs) ? arrivalMs : null,
            arrivalEpochMs: etaEpochMs,
            arrivalEpochSource: "info_village",
            timerText: timerText || formatCountdown(resolvedTimerSeconds),
            timerSeconds: resolvedTimerSeconds,
            guessedUnit,
            guessedUnitIcon: guessedUnit
              ? unitIconsByKey[guessedUnit] || getUnitIconFallback(guessedUnit)
              : null,
            squadUnits,
            detectedUnits,
            unitIconsByKey,
          });
          anchors.push({
            incomingId,
            hostElement: arrivalCell,
            sourceNode: null,
            lineOffsetStart: null,
            lineOffsetEnd: null,
            timeToken:
              Number.isFinite(etaEpochMs) && Number.isFinite(arrivalMs)
                ? formatTimeWithMs(etaEpochMs)
                : Number.isFinite(etaEpochMs)
                  ? formatTimeOnly(etaEpochMs)
                  : null,
            originCoord: originCoordRaw || null,
            targetCoord: targetCoord || null,
            player: null,
            line: commandText,
          });
        });
      });
    }

    if (!items.length && allowGenericFallbackRows) {
      const allRows = Array.from(root.querySelectorAll("table tr"));
      allRows.forEach((row, rowIndex) => {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 2) return;

        let picked = null;
        for (let cellIndex = 1; cellIndex < cells.length; cellIndex += 1) {
          const candidateCell = cells[cellIndex];
          const msNode = candidateCell.querySelector(".grey.small");
          const msText = cleanText(msNode ? msNode.textContent : null);
          const arrivalMs = toInt(msText);
          const rawText = cleanText(
            safe(() => candidateCell.textContent, null),
          );
          if (!rawText) continue;
          const arrivalTextWithoutMs =
            cleanText(msText ? rawText.replace(msText, "") : rawText) ||
            rawText;
          const arrivalText =
            extractArrivalDateTimeText(arrivalTextWithoutMs) ||
            arrivalTextWithoutMs;
          const etaEpochMs = parseCommandsArrivalEpochMs(
            arrivalText,
            arrivalMs,
          );
          if (!Number.isFinite(etaEpochMs)) continue;
          picked = {
            cell: candidateCell,
            arrivalMs,
            arrivalText,
            rawText,
            etaEpochMs,
          };
          break;
        }
        if (!picked) return;

        const commandCell = cells[0] || row;
        const commandText =
          cleanText(safe(() => commandCell.textContent, null)) || "приказ";
        const squadUnits = extractSquadUnitsFromCommandCell(commandCell, commandText);
        const commandLink =
          commandCell.querySelector("a[href*='screen=info_command']") || null;
        const commandHrefRaw =
          cleanText(safe(() => commandLink.getAttribute("href"), null)) ||
          cleanText(safe(() => commandLink.href, null));
        const commandUrl = commandHrefRaw
          ? safe(() => new URL(commandHrefRaw, location.origin).toString(), null)
          : null;
        const commandId =
          cleanText(getUrlParam(commandHrefRaw, "id")) ||
          cleanText(getUrlParam(commandUrl, "id")) ||
          null;
        const commandIcons = Array.from(
          commandCell.querySelectorAll("img[src]"),
        )
          .map((img) => cleanText(img.getAttribute("src")))
          .filter(Boolean);
        const commandTypeByIcon =
          commandIcons
            .map((src) => detectCommandTypeByIcon(src))
            .find((type) => type && type !== "other") || "support";
        const detectedUnits = Array.from(
          new Set(
            commandIcons
              .map(
                (src) =>
                  parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src),
              )
              .map((unit) => String(unit || "").toLowerCase())
              .filter((unit) => isUnitAllowedInWorld(unit, state.speedModel)),
          ),
        );
        const unitFromText = detectUnitFromText(commandText);
        if (
          unitFromText &&
          isUnitAllowedInWorld(unitFromText, state.speedModel) &&
          !detectedUnits.includes(unitFromText)
        ) {
          detectedUnits.push(unitFromText);
        }
        const guessedUnit = detectedUnits.length ? detectedUnits[0] : null;
        const unitIconsByKey = {};
        detectedUnits.forEach((unit) => {
          const iconSrc =
            commandIcons.find((src) => {
              const parsed =
                parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src);
              return parsed === unit;
            }) || getUnitIconFallback(unit);
          if (iconSrc) unitIconsByKey[unit] = iconSrc;
        });

        const originCoordRaw = getLastCoordKeyFromText(commandText);
        const targetCoordObj = parseCoord(targetCoord);
        const originCoordObj = parseCoord(originCoordRaw);
        const distance = calcDistance(originCoordObj, targetCoordObj);
        const resolvedTimerSeconds = Math.max(
          0,
          Math.round((picked.etaEpochMs - getServerNowMs()) / 1000),
        );
        const incomingId = `iv_${hashString(
          `${targetCoord || "?"}|${picked.etaEpochMs}|${Math.max(0, toInt(picked.arrivalMs) || 0)}|fallback|${rowIndex}|${commandText}`,
        )}`;

        items.push({
          id: incomingId,
          commandType: commandTypeByIcon,
          displayType: commandTypeByIcon,
          commandLabel: commandText,
          kindText: guessedUnit ? getUnitLabel(guessedUnit) : null,
          target: targetTitle || targetCoord || "?",
          targetCoord: targetCoord || null,
          targetVillageId:
            cleanText(
              getUrlParam(location.href, "i") ||
                getUrlParam(location.href, "id") ||
                getUrlParam(location.href, "village"),
            ) || null,
          origin: originCoordRaw || "unknown",
          originCoord: originCoordRaw || null,
          originVillageId: null,
          player: "unknown",
          playerId: null,
          distance,
          commandId,
          sourceCommandId: commandId || null,
          commandUrl: commandUrl || null,
          arrivalText:
            picked.arrivalText ||
            formatArrivalTextFromEpochMs(picked.etaEpochMs),
          arrivalMs: Number.isFinite(picked.arrivalMs)
            ? picked.arrivalMs
            : null,
          arrivalEpochMs: picked.etaEpochMs,
          arrivalEpochSource: "info_village_fallback",
          timerText: formatCountdown(resolvedTimerSeconds),
          timerSeconds: resolvedTimerSeconds,
          guessedUnit,
          guessedUnitIcon: guessedUnit
            ? unitIconsByKey[guessedUnit] || getUnitIconFallback(guessedUnit)
            : null,
          squadUnits,
          detectedUnits,
          unitIconsByKey,
        });
        anchors.push({
          incomingId,
          hostElement: picked.cell,
          sourceNode: null,
          lineOffsetStart: null,
          lineOffsetEnd: null,
          timeToken:
            Number.isFinite(picked.etaEpochMs) &&
            Number.isFinite(picked.arrivalMs)
              ? formatTimeWithMs(picked.etaEpochMs)
              : Number.isFinite(picked.etaEpochMs)
                ? formatTimeOnly(picked.etaEpochMs)
                : null,
          originCoord: originCoordRaw || null,
          targetCoord: targetCoord || null,
          player: null,
          line: commandText,
        });
      });
    }

    const mapTextOffsetToNodeRange = (spans, startOffset, endOffset) => {
      const start = Number(startOffset);
      const end = Number(endOffset);
      if (!Array.isArray(spans) || !Number.isFinite(start) || !Number.isFinite(end))
        return null;
      const span = spans.find(
        (item) => start >= item.start && end <= item.end,
      );
      if (!span || !span.node) return null;
      return {
        node: span.node,
        start: start - span.start,
        end: end - span.start,
      };
    };

    const collectTextNodeSpans = (container) => {
      const spans = [];
      if (!container) return { text: "", spans };
      const walker = doc.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => {
          const parent = node && node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (
            parent.closest(
              "#scriptmm-overlay-root, .smm-msg-inline-actions, .smm-msg-inline-panel, #smm-msg-inline-fallback, .smm-msg-manual-inline",
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          const text = String(node.nodeValue || "").replace(/\u00a0/g, " ");
          return cleanText(text)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        },
      });
      let text = "";
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const value = String(node.nodeValue || "").replace(/\u00a0/g, " ");
        const start = text.length;
        text += value;
        spans.push({ node, start, end: text.length, text: value });
      }
      return { text, spans };
    };

    const findTimeTokenRangeAfterOffset = (text, fromOffset, timeToken) => {
      const token = cleanText(timeToken);
      if (!token) return null;
      const normalizedToken = token.replace(/^(\d):/, "0$1:");
      const source = String(text || "");
      const startFrom = Math.max(0, Number(fromOffset) || 0);
      const re = /(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?/g;
      let match = null;
      re.lastIndex = startFrom;
      while ((match = re.exec(source))) {
        const candidate = `${String(toInt(match[1]) || 0).padStart(2, "0")}:${String(
          toInt(match[2]) || 0,
        ).padStart(2, "0")}:${String(toInt(match[3]) || 0).padStart(
          2,
          "0",
        )}:${String(Math.max(0, toInt(match[4]) || 0)).padStart(3, "0")}`;
        if (candidate === normalizedToken) {
          const start = Number(match.index);
          const end = start + String(match[0] || "").length;
          return { start, end };
        }
      }
      return null;
    };

    const noteBodies = Array.from(root.querySelectorAll(".village-note-body"));
    noteBodies.forEach((noteBody, noteIndex) => {
      const { text: noteTextRaw, spans } = collectTextNodeSpans(noteBody);
      const noteText = String(noteTextRaw || "").replace(/\u00a0/g, " ");
      if (!/время\s*прибытия/i.test(noteText)) return;

      const markerRe = /время\s*прибытия\s*:?\s*/gi;
      let markerMatch = null;
      while ((markerMatch = markerRe.exec(noteText))) {
        const markerStart = Number(markerMatch.index);
        const markerEnd = markerStart + String(markerMatch[0] || "").length;
        const afterMarker = cleanText(noteText.slice(markerEnd, markerEnd + 220));
        const parsedDate = parseMessageArrivalDatePayload(afterMarker);
        if (!parsedDate || !Number.isFinite(parsedDate.etaEpochMs)) continue;

        const beforeMarker = cleanText(
          noteText.slice(Math.max(0, markerStart - 360), markerStart),
        );
        const lineText = cleanText(
          noteText.slice(Math.max(0, markerStart - 220), markerEnd + 220),
        );
        const originCoordRaw = getLastCoordKeyFromText(beforeMarker);
        const unit =
          detectUnitFromText(beforeMarker) || detectUnitFromText(lineText);
        const commandIcons = Array.from(noteBody.querySelectorAll("img[src]"))
          .map((img) => cleanText(img.getAttribute("src")))
          .filter(Boolean);
        const commandTypeByIcon =
          commandIcons
            .map((src) => detectCommandTypeByIcon(src))
            .find((type) => type && type !== "other") || "support";
        const unitIconsByKey = {};
        const detectedUnits = unit ? [unit] : [];
        if (unit) unitIconsByKey[unit] = getUnitIconFallback(unit);
        const targetCoordObj = parseCoord(targetCoord);
        const originCoordObj = parseCoord(originCoordRaw);
        const etaEpochMs = parsedDate.etaEpochMs;
        const arrivalMs = Number.isFinite(parsedDate.arrivalMs)
          ? parsedDate.arrivalMs
          : null;
        const timerSeconds = Math.max(
          0,
          Math.round((etaEpochMs - getServerNowMs()) / 1000),
        );
        const player = cleanText(parsedDate.attackerName) || "unknown";
        const incomingId = `iv_note_${hashString(
          `${targetCoord || "?"}|${originCoordRaw || "?"}|${etaEpochMs}|${Math.max(
            0,
            toInt(arrivalMs) || 0,
          )}|${noteIndex}|${markerStart}|${lineText}`,
        )}`;
        const timeRange = findTimeTokenRangeAfterOffset(
          noteText,
          markerEnd,
          parsedDate.timeToken,
        );
        const nodeRange = timeRange
          ? mapTextOffsetToNodeRange(spans, timeRange.start, timeRange.end)
          : null;

        items.push({
          id: incomingId,
          commandType: commandTypeByIcon,
          displayType: commandTypeByIcon,
          commandLabel: lineText || beforeMarker || "заметка",
          kindText: unit ? getUnitLabel(unit) : null,
          target: targetTitle || targetCoord || "?",
          targetCoord: targetCoord || null,
          targetVillageId:
            cleanText(
              getUrlParam(location.href, "i") ||
                getUrlParam(location.href, "id") ||
                getUrlParam(location.href, "village"),
            ) || null,
          origin: originCoordRaw || "unknown",
          originCoord: originCoordRaw || null,
          originVillageId: null,
          player,
          playerId: null,
          distance: calcDistance(originCoordObj, targetCoordObj),
          commandId: null,
          sourceCommandId: null,
          commandUrl: null,
          arrivalText: formatArrivalTextFromEpochMs(etaEpochMs),
          arrivalMs,
          arrivalEpochMs: etaEpochMs,
          arrivalEpochSource: "info_village_note",
          timerText: formatCountdown(timerSeconds),
          timerSeconds,
          guessedUnit: unit || null,
          guessedUnitIcon: unit ? getUnitIconFallback(unit) : null,
          squadUnits: {},
          detectedUnits,
          unitIconsByKey,
        });
        anchors.push({
          incomingId,
          hostElement:
            nodeRange && nodeRange.node && nodeRange.node.parentElement
              ? nodeRange.node.parentElement
              : noteBody,
          sourceNode: nodeRange ? nodeRange.node : null,
          lineOffsetStart: nodeRange ? nodeRange.start : null,
          lineOffsetEnd: nodeRange ? nodeRange.end : null,
          timeToken: cleanText(parsedDate.timeToken) || null,
          originCoord: originCoordRaw || null,
          targetCoord: targetCoord || null,
          player,
          line: lineText || beforeMarker || null,
          sourceKind: "info_village_note",
        });
      }
    });

    const uniqueItems = [];
    const uniqueItemsBySignature = new Map();
    items.forEach((item) => {
      const signature = [
        cleanText(item && item.targetCoord) || "?",
        Number(item && item.arrivalEpochMs) || 0,
        Math.max(0, toInt(item && item.arrivalMs) || 0),
        cleanText(item && item.commandLabel) || "",
      ].join("|");
      if (uniqueItemsBySignature.has(signature)) return;
      uniqueItemsBySignature.set(signature, item);
      uniqueItems.push(item);
    });
    uniqueItems.sort((a, b) => {
      const aEta = Number(a && a.arrivalEpochMs);
      const bEta = Number(b && b.arrivalEpochMs);
      if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta)
        return aEta - bEta;
      return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
    });

    const anchorByIncomingId = new Map();
    anchors.forEach((anchor) => {
      const key = cleanText(anchor && anchor.incomingId);
      if (!key || anchorByIncomingId.has(key)) return;
      anchorByIncomingId.set(key, anchor);
    });
    const finalAnchors = uniqueItems
      .map((item) => anchorByIncomingId.get(String(item.id)))
      .filter(Boolean);

    return {
      dump: {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: location.href,
        count: uniqueItems.length,
        items: uniqueItems,
        targetCoord: targetCoord || null,
        targetTitle: targetTitle || null,
        warning: targetCoord ? null : "info_village target coord not found",
        source: "info_village_parser",
      },
      anchors: finalAnchors,
    };
  };
  const extractCurrentVillageCoordForInlinePlanning = (root) => {
    const fromGameData = cleanText(
      safe(() => window.game_data.village.coord, null),
    );
    const parsedFromGameData = parseCoord(fromGameData);
    if (parsedFromGameData) return parsedFromGameData.key;

    const menuText = cleanText(
      safe(
        () =>
          root.querySelector(
            "#menu_row2 b, #menu_row2 a, #header_info .village-name, #header_info .menu .box .nowrap",
          ).textContent,
        null,
      ),
    );
    const parsedFromMenu = parseCoord(menuText);
    if (parsedFromMenu) return parsedFromMenu.key;

    const fallbackText = `${safe(() => root.innerText, "") || ""}\n${safe(() => root.textContent, "") || ""}`;
    const parsedFallback = parseCoord(fallbackText);
    return parsedFallback ? parsedFallback.key : null;
  };
  const parseVillageOverviewInlinePlanningPayload = (doc = document) => {
    const root = doc.querySelector("#content_value") || doc.body;
    if (!root) {
      return {
        dump: {
          version: 1,
          fetchedAt: new Date(getServerNowMs()).toISOString(),
          sourceUrl: location.href,
          count: 0,
          items: [],
          warning: "overview root not found",
          source: "overview_incomings_parser",
        },
        anchors: [],
      };
    }

    const targetCoord = extractCurrentVillageCoordForInlinePlanning(root);
    const targetTitle =
      cleanText(safe(() => window.game_data.village.display_name, null)) ||
      cleanText(safe(() => window.game_data.village.name, null)) ||
      targetCoord ||
      "цель";
    const rows = Array.from(
      root.querySelectorAll(
        "#commands_incomings tr.command-row, .commands-container[data-type='incoming'] tr.command-row",
      ),
    );

    const items = [];
    const anchors = [];
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 2) return;
      const commandCell = cells[0];
      const arrivalCell = cells[1];
      const timerCell = cells.length > 2 ? cells[2] : null;
      if (!arrivalCell) return;

      const msNode = arrivalCell.querySelector(".grey.small");
      const msText = cleanText(msNode ? msNode.textContent : null);
      const arrivalMs = toInt(msText);
      const rawArrivalText = cleanText(
        safe(() => arrivalCell.textContent, null),
      );
      const arrivalTextWithoutMs = rawArrivalText
        ? cleanText(
            msText ? rawArrivalText.replace(msText, "") : rawArrivalText,
          )
        : null;
      const arrivalText =
        extractArrivalDateTimeText(arrivalTextWithoutMs) ||
        arrivalTextWithoutMs ||
        rawArrivalText;

      const timerNode =
        row.querySelector(".widget-command-timer, .timer_link, .timer") ||
        (timerCell &&
          timerCell.querySelector(
            ".widget-command-timer, .timer_link, .timer",
          ));
      const timerNodeText = cleanText(timerNode ? timerNode.textContent : null);
      const timerCellText = cleanText(timerCell ? timerCell.textContent : null);
      const timerText = timerNodeText || timerCellText || null;
      const timerSeconds = parseTimerToSeconds(timerText);
      const timerEndtime = Number(
        safe(() => timerNode.getAttribute("data-endtime"), null),
      );

      let etaEpochMs = parseCommandsArrivalEpochMs(arrivalText, arrivalMs);
      if (!Number.isFinite(etaEpochMs) && Number.isFinite(timerEndtime)) {
        etaEpochMs = timerEndtime * 1000 + Math.max(0, toInt(arrivalMs) || 0);
      }
      if (!Number.isFinite(etaEpochMs) && Number.isFinite(timerSeconds)) {
        etaEpochMs =
          getServerNowMs() +
          timerSeconds * 1000 +
          Math.max(0, toInt(arrivalMs) || 0);
      }
      if (!Number.isFinite(etaEpochMs)) return;

      const commandText =
        cleanText(
          safe(
            () => commandCell.querySelector(".quickedit-label").textContent,
            null,
          ),
        ) ||
        cleanText(safe(() => commandCell.textContent, null)) ||
        "приказ";
      const commandIcons = Array.from(commandCell.querySelectorAll("img[src]"))
        .map((img) => cleanText(img.getAttribute("src")))
        .filter(Boolean);
      const commandTypeByHint = cleanText(
        safe(
          () =>
            commandCell
              .querySelector("[data-command-type]")
              .getAttribute("data-command-type"),
          null,
        ),
      );
      const commandTypeByIcon =
        commandIcons
          .map((src) => detectCommandTypeByIcon(src))
          .find((type) => type && type !== "other") || null;
      const normalizedCommandType =
        commandTypeByHint === "support" ||
        commandTypeByHint === "attack" ||
        commandTypeByHint === "return"
          ? commandTypeByHint
          : commandTypeByIcon || "attack";

      const detectedUnits = Array.from(
        new Set(
          commandIcons
            .map(
              (src) => parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src),
            )
            .map((unit) => String(unit || "").toLowerCase())
            .filter(Boolean)
            .filter((unit) => isUnitAllowedInWorld(unit, state.speedModel)),
        ),
      );
      const unitFromText = detectUnitFromText(commandText);
      if (
        unitFromText &&
        isUnitAllowedInWorld(unitFromText, state.speedModel) &&
        !detectedUnits.includes(unitFromText)
      ) {
        detectedUnits.push(unitFromText);
      }
      const guessedUnit = detectedUnits.length ? detectedUnits[0] : null;
      const unitIconsByKey = {};
      detectedUnits.forEach((unit) => {
        const iconSrc =
          commandIcons.find((src) => {
            const parsed =
              parseUnitKeyFromIcon(src) || detectUnitFromTinyIcon(src);
            return parsed === unit;
          }) || getUnitIconFallback(unit);
        if (iconSrc) unitIconsByKey[unit] = iconSrc;
      });

      const commandLink = commandCell.querySelector(
        "a[href*='screen=info_command']",
      );
      const quickEditId =
        cleanText(
          safe(
            () =>
              commandCell
                .querySelector(".quickedit-out[data-id], .quickedit[data-id]")
                .getAttribute("data-id"),
            null,
          ),
        ) || null;
      const commandId = cleanText(
        quickEditId || getUrlParam(commandLink && commandLink.href, "id"),
      );
      const incomingId = commandId
        ? `ov_${commandId}`
        : `ov_${hashString(`${targetCoord || "?"}|${etaEpochMs}|${Math.max(0, toInt(arrivalMs) || 0)}|${rowIndex}`)}`;
      const originCoordRaw = getLastCoordKeyFromText(commandText);
      const targetCoordObj = parseCoord(targetCoord);
      const originCoordObj = parseCoord(originCoordRaw);
      const distance = calcDistance(originCoordObj, targetCoordObj);
      const resolvedTimerSeconds = Number.isFinite(timerSeconds)
        ? Math.max(0, timerSeconds)
        : Math.max(0, Math.round((etaEpochMs - getServerNowMs()) / 1000));

      items.push({
        id: incomingId,
        commandType: normalizedCommandType,
        displayType: normalizedCommandType,
        commandLabel: commandText,
        kindText: guessedUnit ? getUnitLabel(guessedUnit) : null,
        target: targetTitle || targetCoord || "?",
        targetCoord: targetCoord || null,
        targetVillageId:
          cleanText(safe(() => window.game_data.village.id, null)) || null,
        origin: originCoordRaw || "unknown",
        originCoord: originCoordRaw || null,
        originVillageId: null,
        player: "unknown",
        playerId: null,
        distance,
        arrivalText: arrivalText || formatArrivalTextFromEpochMs(etaEpochMs),
        arrivalMs: Number.isFinite(arrivalMs) ? arrivalMs : null,
        arrivalEpochMs: etaEpochMs,
        arrivalEpochSource: "overview_incomings",
        timerText: timerText || formatCountdown(resolvedTimerSeconds),
        timerSeconds: resolvedTimerSeconds,
        guessedUnit,
        guessedUnitIcon: guessedUnit
          ? unitIconsByKey[guessedUnit] || getUnitIconFallback(guessedUnit)
          : null,
        detectedUnits,
        unitIconsByKey,
      });
      anchors.push({
        incomingId,
        hostElement: arrivalCell,
        sourceNode: null,
        lineOffsetStart: null,
        lineOffsetEnd: null,
        timeToken:
          Number.isFinite(etaEpochMs) && Number.isFinite(arrivalMs)
            ? formatTimeWithMs(etaEpochMs)
            : Number.isFinite(etaEpochMs)
              ? formatTimeOnly(etaEpochMs)
              : null,
        originCoord: originCoordRaw || null,
        targetCoord: targetCoord || null,
        player: null,
        line: commandText,
      });
    });

    const uniqueById = new Map();
    items.forEach((item) => {
      const key = cleanText(item && item.id);
      if (!key || uniqueById.has(key)) return;
      uniqueById.set(key, item);
    });
    const uniqueItems = Array.from(uniqueById.values()).sort((a, b) => {
      const aEta = Number(a && a.arrivalEpochMs);
      const bEta = Number(b && b.arrivalEpochMs);
      if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta)
        return aEta - bEta;
      return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
    });
    const anchorByIncomingId = new Map();
    anchors.forEach((anchor) => {
      const key = cleanText(anchor && anchor.incomingId);
      if (!key || anchorByIncomingId.has(key)) return;
      anchorByIncomingId.set(key, anchor);
    });
    const finalAnchors = uniqueItems
      .map((item) => anchorByIncomingId.get(String(item.id)))
      .filter(Boolean);

    return {
      dump: {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: location.href,
        count: uniqueItems.length,
        items: uniqueItems,
        targetCoord: targetCoord || null,
        targetTitle: targetTitle || null,
        warning: targetCoord ? null : "overview target coord not found",
        source: "overview_incomings_parser",
      },
      anchors: finalAnchors,
    };
  };
  const parseOverviewIncomingsPlanningPayload = (doc = document) => {
    const dump = parseIncomingsDocument(doc, location.href);
    const table = doc.querySelector("#incomings_table");
    const rows = table
      ? Array.from(table.querySelectorAll("tr.row_a, tr.row_b"))
      : [];
    const rowById = new Map();
    rows.forEach((row) => {
      const commandInput = row.querySelector("input[name^='command_ids[']");
      const id = parseCommandId(
        commandInput ? commandInput.getAttribute("name") : "",
      );
      if (!id || rowById.has(id)) return;
      rowById.set(id, row);
    });
    const anchors = (dump && Array.isArray(dump.items) ? dump.items : [])
      .map((item) => {
        const id = cleanText(item && item.id);
        if (!id) return null;
        const row = rowById.get(id);
        const arrivalCell =
          safe(() => selectIncomingArrivalTimerNode(row).closest("td"), null) ||
          safe(() => row.querySelector("td:nth-child(6)"), null) ||
          null;
        if (!arrivalCell) return null;
        return {
          incomingId: id,
          hostElement: arrivalCell,
          sourceNode: null,
          lineOffsetStart: null,
          lineOffsetEnd: null,
          timeToken:
            Number.isFinite(Number(item && item.arrivalEpochMs)) &&
            Number.isFinite(Number(item && item.arrivalMs))
              ? formatTimeWithMs(Number(item.arrivalEpochMs))
              : cleanText(item && item.arrivalText) || null,
          originCoord: cleanText(item && item.originCoord) || null,
          targetCoord: cleanText(item && item.targetCoord) || null,
          player: cleanText(item && item.player) || null,
          line: cleanText(item && item.commandLabel) || null,
        };
      })
      .filter(Boolean);
    return {
      dump: {
        ...(dump || {
          version: 1,
          fetchedAt: new Date(getServerNowMs()).toISOString(),
          sourceUrl: location.href,
          count: 0,
          items: [],
        }),
        source: "overview_villages_incomings_parser",
      },
      anchors,
    };
  };
  const parseMessagePlanningPayload = (doc = document) => {
    if (isInfoVillagePlanningScreen()) {
      return parseInfoVillagePlanningPayload(doc);
    }
    if (isOverviewIncomingsPlanningScreen()) {
      return parseOverviewIncomingsPlanningPayload(doc);
    }
    if (isVillageOverviewInlinePlanningScreen()) {
      return parseVillageOverviewInlinePlanningPayload(doc);
    }
    const root = doc.querySelector("#content_value") || doc.body;
    if (!root) {
      return {
        dump: {
          version: 1,
          fetchedAt: new Date(getServerNowMs()).toISOString(),
          sourceUrl: location.href,
          count: 0,
          items: [],
          warning: "message root not found",
        },
        anchors: [],
      };
    }

    const lines = extractMessagePlainLines(root);
    const anchorCandidates = extractMessageTimeAnchorCandidates(root);
    const threadSigilPercent = getForumThreadFirstPostSigilPercent(doc);
    const items = [];
    const parsedEntries = [];

    lines.forEach((entry, index) => {
      const line = cleanText(entry && entry.line);
      if (!line) return;

      if (!/время\s*прибытия/i.test(line)) return;
      const nearestTarget = findNearestMessageTargetAbove(lines, index);
      if (!nearestTarget || !nearestTarget.targetCoord) return;
      const currentTargetCoord = nearestTarget.targetCoord;
      const currentTargetLabel =
        nearestTarget.targetLabel || currentTargetCoord;

      const markerMatch = line.match(/время\s*прибытия\s*:?\s*/i);
      const markerIndex = markerMatch
        ? line.toLowerCase().indexOf(markerMatch[0].toLowerCase())
        : -1;
      if (markerIndex < 0) return;
      const beforeMarker = cleanText(line.slice(0, markerIndex)) || null;
      const afterMarker =
        cleanText(line.slice(markerIndex + markerMatch[0].length)) || "";
      const parsedDate = parseMessageArrivalDatePayload(afterMarker);
      if (!parsedDate || !Number.isFinite(parsedDate.etaEpochMs)) return;

      const originCoord = getLastCoordKeyFromText(beforeMarker);
      const fallbackOriginCoord = originCoord
        ? originCoord
        : findNearestMessageOriginAbove(lines, index - 1, currentTargetCoord);
      const nearestSigilPercent = selectPreferredPositiveSigilPercent(
        findNearestMessageSigilPercentAbove(lines, index),
        threadSigilPercent,
      );
      const unit = detectUnitFromText(beforeMarker) || detectUnitFromText(line);
      const targetCoordObj = parseCoord(currentTargetCoord);
      const originCoordObj = parseCoord(fallbackOriginCoord);
      const distance = calcDistance(originCoordObj, targetCoordObj);
      const timerSeconds = Math.max(
        0,
        Math.round((parsedDate.etaEpochMs - getServerNowMs()) / 1000),
      );
      const attacker = cleanText(parsedDate.attackerName);
      const identityKey = [
        currentTargetCoord,
        fallbackOriginCoord || "?",
        parsedDate.etaEpochMs,
        attacker || "",
        unit || "",
      ].join("|");

      const incomingId = `msg_${hashString(`${identityKey}|${index}`)}`;
      const arrivalText = formatArrivalTextFromEpochMs(parsedDate.etaEpochMs);
      const arrivalMs = Number.isFinite(parsedDate.arrivalMs)
        ? parsedDate.arrivalMs
        : null;
      const item = {
        id: incomingId,
        commandType: "support",
        displayType: "support",
        commandLabel: line,
        kindText: unit ? getUnitLabel(unit) : null,
        target: currentTargetLabel || currentTargetCoord,
        targetCoord: currentTargetCoord,
        targetVillageId: null,
        origin: beforeMarker || fallbackOriginCoord || "unknown",
        originCoord: fallbackOriginCoord || null,
        originVillageId: null,
        player: attacker || "unknown",
        playerId: null,
        distance,
        arrivalText,
        arrivalMs,
        arrivalEpochMs: parsedDate.etaEpochMs,
        arrivalEpochSource: "message_text",
        timerText: formatCountdown(timerSeconds),
        timerSeconds,
        guessedUnit: unit || null,
        guessedUnitIcon: unit ? getUnitIconFallback(unit) : null,
        detectedUnits: unit ? [unit] : [],
        unitIconsByKey: unit ? { [unit]: getUnitIconFallback(unit) } : {},
        sigilPercent: Number.isFinite(nearestSigilPercent)
          ? nearestSigilPercent
          : null,
      };

      items.push(item);
      parsedEntries.push({
        incomingId,
        timeToken: cleanText(parsedDate.timeToken) || null,
        originCoord: fallbackOriginCoord || null,
        targetCoord: currentTargetCoord,
        player: attacker || null,
        line,
      });
    });

    const usedAnchorCandidateIndexes = new Set();
    const anchors = parsedEntries.map((entry) => {
      let candidateIndex = -1;
      if (entry.timeToken) {
        candidateIndex = anchorCandidates.findIndex(
          (candidate, idx) =>
            !usedAnchorCandidateIndexes.has(idx) &&
            cleanText(candidate && candidate.timeToken) === entry.timeToken,
        );
      }
      if (candidateIndex < 0) {
        candidateIndex = anchorCandidates.findIndex(
          (candidate, idx) => !usedAnchorCandidateIndexes.has(idx),
        );
      }
      if (candidateIndex < 0) {
        return {
          incomingId: entry.incomingId,
          hostElement: null,
          sourceNode: null,
          lineOffsetStart: null,
          lineOffsetEnd: null,
          timeToken: entry.timeToken || null,
          originCoord: entry.originCoord || null,
          targetCoord: entry.targetCoord || null,
          player: entry.player || null,
          line: entry.line || null,
        };
      }
      usedAnchorCandidateIndexes.add(candidateIndex);
      const candidate = anchorCandidates[candidateIndex];
      return {
        incomingId: entry.incomingId,
        hostElement:
          candidate && candidate.hostElement ? candidate.hostElement : null,
        sourceNode:
          candidate && candidate.sourceNode ? candidate.sourceNode : null,
        lineOffsetStart: Number.isFinite(
          Number(candidate && candidate.lineOffsetStart),
        )
          ? Number(candidate.lineOffsetStart)
          : null,
        lineOffsetEnd: Number.isFinite(
          Number(candidate && candidate.lineOffsetEnd),
        )
          ? Number(candidate.lineOffsetEnd)
          : null,
        timeToken:
          entry.timeToken ||
          cleanText(candidate && candidate.timeToken) ||
          null,
        originCoord: entry.originCoord || null,
        targetCoord: entry.targetCoord || null,
        player: entry.player || null,
        line: entry.line || null,
      };
    });

    items.sort((a, b) => {
      const aEta = Number(a && a.arrivalEpochMs);
      const bEta = Number(b && b.arrivalEpochMs);
      if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta)
        return aEta - bEta;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    return {
      dump: {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: location.href,
        count: items.length,
        items,
        warning: null,
        source: "mail_forum_message_parser",
      },
      anchors,
    };
  };

  const normalizeOwnCommandType = (rawType, commandLabel, iconSources = []) => {
    const value = String(rawType || "").toLowerCase();
    if (value.includes("return")) return "return";
    if (value.includes("support")) return "support";
    if (value.includes("attack")) return "attack";

    const labelSource = String(commandLabel || "").toLowerCase();
    if (/(?:возвращ|return)/i.test(labelSource)) return "return";
    if (/(?:подкреп|support)/i.test(labelSource)) return "support";
    if (/(?:атак|attack)/i.test(labelSource)) return "attack";

    const iconText = String((iconSources || []).join(" ")).toLowerCase();
    if (/\/command\/return/i.test(iconText)) return "return";
    if (/\/command\/support/i.test(iconText)) return "support";
    if (/\/command\/attack/i.test(iconText)) return "attack";
    return "other";
  };
  const isOwnCommandTypeUnknown = (typeRaw) => {
    const type = cleanText(typeRaw);
    return !type || type === "other";
  };
  const isCommandTypeCompatibleForManeuver = (maneuver, ownCommand) => {
    if (!maneuver) return false;
    const type = cleanText(ownCommand && ownCommand.type);
    if (isOwnCommandTypeUnknown(type)) return true;
    return isCommandTypeExpectedForManeuver(maneuver, ownCommand);
  };

  const getOwnCommandTypeLabel = (type) => {
    if (type === "attack") return "атака";
    if (type === "support") return "подкрепление";
    if (type === "return") return "возвращение";
    return "другое";
  };

  const parseOverviewCommandsDocument = (doc, sourceUrl) => {
    const table = doc.querySelector("#commands_table");
    if (!table) {
      return {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl,
        count: 0,
        units: [],
        items: [],
        byType: { attack: 0, support: 0, return: 0, other: 0 },
        warning: "Commands table not found in fetched page",
      };
    }

    const fallbackUnitOrder = normalizeUnitsForWorld(
      getGameDataUnits(),
      state.speedModel,
    ).filter((unit) => unit !== "militia");
    const unitColumns = [];
    let bestHeaderColumns = [];
    Array.from(table.querySelectorAll("tr")).forEach((row) => {
      const detected = [];
      Array.from(row.children || []).forEach((cell, columnIndex) => {
        const icon = cell.querySelector("img[src]");
        const unit = parseUnitKeyFromIcon(
          cleanText(icon ? icon.getAttribute("src") : null),
        );
        if (
          !unit ||
          !isUnitAllowedInWorld(unit, state.speedModel) ||
          unit === "militia"
        )
          return;
        detected.push({ unit, columnIndex });
      });
      if (detected.length > bestHeaderColumns.length) {
        bestHeaderColumns = detected;
      }
    });
    bestHeaderColumns.forEach(({ unit, columnIndex }) => {
      unitColumns.push({ unit, columnIndex });
    });

    const byType = { attack: 0, support: 0, return: 0, other: 0 };
    const rows = Array.from(
      table.querySelectorAll("tr.row_ax, tr.row_bx, tr.row_a, tr.row_b"),
    );
    const items = rows
      .map((row) => {
        const cells = Array.from(row.children || []);
        if (cells.length < 3) return null;

        const commandCell = cells[0];
        const fromCell = cells[1];
        const arrivalCell = cells[2];
        const infoLink = commandCell.querySelector(
          "a[href*='screen=info_command']",
        );
        const commandInput = commandCell.querySelector(
          "input[name='cancel[]']",
        );
        const commandSpans = Array.from(
          commandCell.querySelectorAll(
            ".own_command[data-command-id], [data-command-id][data-command-type], [data-command-type]",
          ),
        );
        const commandIcons = Array.from(
          commandCell.querySelectorAll(
            "img[src*='/command/'], .command_hover_details img[src], .icon-container img[src], .quickedit-content img[src]",
          ),
        )
          .map((img) => cleanText(img.getAttribute("src")))
          .filter(Boolean);
        const commandLabel = cleanText(
          safe(
            () => commandCell.querySelector(".quickedit-label").textContent,
            null,
          ) ||
            safe(() => infoLink.textContent, null) ||
            commandCell.textContent,
        );
        const commandId =
          cleanText(commandInput ? commandInput.getAttribute("value") : null) ||
          cleanText(
            safe(
              () =>
                commandCell
                  .querySelector(".quickedit[data-id]")
                  .getAttribute("data-id"),
              null,
            ),
          ) ||
          cleanText(
            commandSpans[0]
              ? commandSpans[0].getAttribute("data-command-id")
              : null,
          ) ||
          cleanText(
            infoLink ? getUrlParam(infoLink.getAttribute("href"), "id") : null,
          );
        if (!commandId) return null;

        const rawType =
          commandSpans
            .map((node) => cleanText(node && node.getAttribute("data-command-type")))
            .find(Boolean) || null;
        const type = normalizeOwnCommandType(
          rawType,
          commandLabel,
          commandIcons,
        );
        if (!Object.prototype.hasOwnProperty.call(byType, type))
          byType.other += 1;
        else byType[type] += 1;

        const fromAnchor = fromCell.querySelector("a[href]");
        const fromVillage = cleanText(
          (fromAnchor && fromAnchor.textContent) ||
            safe(() => fromCell.textContent, null),
        );
        const fromVillageCoordParsed = parseCoord(fromVillage);
        const fromVillageCoord = fromVillageCoordParsed
          ? fromVillageCoordParsed.key
          : null;
        const fromVillageId = fromAnchor
          ? getUrlParam(fromAnchor.getAttribute("href"), "id") ||
            getUrlParam(fromAnchor.getAttribute("href"), "village")
          : null;

        const rawArrivalText = cleanText(
          safe(() => arrivalCell.textContent, null),
        );
        const msNode = arrivalCell.querySelector(".grey.small");
        const arrivalMs = toInt(msNode ? msNode.textContent : null);
        const arrivalText = rawArrivalText
          ? cleanText(
              rawArrivalText.replace(
                cleanText(msNode ? msNode.textContent : "") || "",
                "",
              ),
            )
          : null;
        const etaEpochMs = parseCommandsArrivalEpochMs(arrivalText, arrivalMs);

        const labelCoordParsed = parseCoord(commandLabel);
        const labelCoord = labelCoordParsed ? labelCoordParsed.key : null;
        const routeFromCoord =
          type === "return" ? labelCoord || null : fromVillageCoord || null;
        const routeToCoord =
          type === "return" ? fromVillageCoord || null : labelCoord || null;

        const unitsByColumns = {};
        unitColumns.forEach(({ unit, columnIndex }) => {
          const cell = cells[columnIndex];
          const value = Math.max(
            0,
            toInt(cleanText(cell ? cell.textContent : null)) || 0,
          );
          if (value > 0) unitsByColumns[unit] = value;
        });

        const unitsByFallbackOrder = {};
        if (fallbackUnitOrder.length) {
          const rowUnitCells = cells.filter(
            (cell) =>
              cell && cell.classList && cell.classList.contains("unit-item"),
          );
          const limit = Math.min(rowUnitCells.length, fallbackUnitOrder.length);
          for (let index = 0; index < limit; index += 1) {
            const unit = fallbackUnitOrder[index];
            const value = Math.max(
              0,
              toInt(
                cleanText(
                  rowUnitCells[index] ? rowUnitCells[index].textContent : null,
                ),
              ) || 0,
            );
            if (value > 0) unitsByFallbackOrder[unit] = value;
          }
        }

        const totalByColumns = Object.values(unitsByColumns).reduce(
          (sum, value) => sum + (Number(value) || 0),
          0,
        );
        const totalByFallback = Object.values(unitsByFallbackOrder).reduce(
          (sum, value) => sum + (Number(value) || 0),
          0,
        );
        const units =
          totalByFallback > totalByColumns
            ? unitsByFallbackOrder
            : unitsByColumns;
        const totalUnits = Math.max(totalByColumns, totalByFallback);

        return {
          id: commandId,
          type,
          typeLabel: getOwnCommandTypeLabel(type),
          commandLabel,
          commandUrl: infoLink
            ? cleanText(infoLink.getAttribute("href"))
            : null,
          iconSources: commandIcons,
          fromVillage,
          fromVillageId: cleanText(fromVillageId) || null,
          fromVillageCoord,
          routeFromCoord,
          routeToCoord,
          arrivalText,
          arrivalMs: Number.isFinite(arrivalMs) ? arrivalMs : null,
          etaEpochMs: Number.isFinite(etaEpochMs) ? etaEpochMs : null,
          canCancel: Boolean(commandInput && !commandInput.disabled),
          units,
          totalUnits,
        };
      })
      .filter(Boolean);

    const uniqueById = new Map();
    items.forEach((item) => {
      uniqueById.set(String(item.id), item);
    });
    const uniqueItems = Array.from(uniqueById.values()).sort((a, b) => {
      const av = Number.isFinite(a.etaEpochMs)
        ? a.etaEpochMs
        : Number.MAX_SAFE_INTEGER;
      const bv = Number.isFinite(b.etaEpochMs)
        ? b.etaEpochMs
        : Number.MAX_SAFE_INTEGER;
      return av - bv;
    });

    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      sourceUrl,
      count: uniqueItems.length,
      units: unitColumns.length
        ? unitColumns.map((item) => item.unit)
        : fallbackUnitOrder,
      items: uniqueItems,
      byType,
      warning: null,
    };
  };

  const parseOverviewRowsForStorage = (doc, options = {}) => {
    const limit = Math.max(1, toInt(options.limit) || 800);
    const rows = Array.from(
      doc.querySelectorAll(
        "#content_value table.vis tr.row_a, #content_value table.vis tr.row_b, #content_value table.vis tr.row_ax, #content_value table.vis tr.row_bx",
      ),
    );
    return rows.slice(0, limit).map((row, index) => {
      const cells = Array.from(row.querySelectorAll("td")).map(
        (cell) => cleanText(cell.textContent) || "",
      );
      const links = Array.from(row.querySelectorAll("a[href]"))
        .slice(0, 6)
        .map((link) => ({
          text: cleanText(link.textContent) || "",
          href: cleanText(link.getAttribute("href")) || "",
        }));
      return {
        index,
        cells,
        links,
      };
    });
  };

  const parseOverviewCommandsPageNumbers = (doc) => {
    const pages = new Set();
    if (!doc || !doc.querySelectorAll) return [];
    Array.from(
      doc.querySelectorAll(
        ".paged-nav-item[href*='mode=commands'][href*='page='], a[href*='mode=commands'][href*='page=']",
      ),
    ).forEach((link) => {
      const href = cleanText(link && link.getAttribute("href"));
      const pageRaw = toInt(getUrlParam(href, "page"));
      if (Number.isInteger(pageRaw) && pageRaw >= 0) {
        pages.add(pageRaw);
      }
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  const buildOverviewCommandsByType = (items) => {
    const result = { attack: 0, support: 0, return: 0, other: 0 };
    (Array.isArray(items) ? items : []).forEach((item) => {
      const type = String(cleanText(item && item.type) || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(result, type)) {
        result[type] += 1;
      } else {
        result.other += 1;
      }
    });
    return result;
  };

  const fetchOverviewCommandsDump = async ({ groupIdRaw = "0" } = {}) => {
    const groupId = normalizeVillageGroupId(groupIdRaw);
    const sourceUrl = buildGameUrl({
      screen: "overview_villages",
      mode: "commands",
      type: "all",
      page: -1,
      // Важно: для синка/конфликтов всегда нужен полный список приказов,
      // иначе при активной группе теряются приказы соплемов по другим деревням.
      group: groupId,
    });
    const doc = await fetchDocument(sourceUrl);
    const rows = parseOverviewRowsForStorage(doc, { limit: 1200 });
    const parsedCommands = parseOverviewCommandsDocument(doc, sourceUrl);

    const pageNumbers = parseOverviewCommandsPageNumbers(doc);
    let items = Array.isArray(parsedCommands.items)
      ? parsedCommands.items.slice()
      : [];
    let exhaustivePagesFetched = 0;
    const nowMs = getServerNowMs();
    const shouldTryExhaustive =
      items.length < 1000 &&
      (!Number.isFinite(state.overviewCommandsExhaustiveFetchedAtMs) ||
        nowMs - state.overviewCommandsExhaustiveFetchedAtMs >=
          OVERVIEW_COMMANDS_EXHAUSTIVE_REFETCH_MS);

    if (shouldTryExhaustive) {
      const uniqueById = new Map();
      items.forEach((item) => {
        const id = cleanText(item && item.id);
        if (id) uniqueById.set(String(id), item);
      });
      let discoveredPages = pageNumbers.slice();
      let pageZeroDoc = null;
      if (!discoveredPages.length) {
        const pageZeroUrl = buildGameUrl({
          screen: "overview_villages",
          mode: "commands",
          type: "all",
          page: 0,
          group: groupId,
        });
        try {
          pageZeroDoc = await fetchDocument(pageZeroUrl);
          discoveredPages = parseOverviewCommandsPageNumbers(pageZeroDoc);
        } catch (error) {
          void error;
        }
      }
      if (!discoveredPages.length) {
        discoveredPages = [0];
      } else if (!discoveredPages.includes(0)) {
        discoveredPages.unshift(0);
      }
      const cappedPages = discoveredPages.slice(0, 80);
      for (const page of cappedPages) {
        try {
          const pageUrl = buildGameUrl({
            screen: "overview_villages",
            mode: "commands",
            type: "all",
            page,
            group: groupId,
          });
          const pageDoc =
            Number(page) === 0 && pageZeroDoc
              ? pageZeroDoc
              : await fetchDocument(pageUrl);
          const parsedPage = parseOverviewCommandsDocument(pageDoc, pageUrl);
          (Array.isArray(parsedPage.items) ? parsedPage.items : []).forEach(
            (item) => {
              const id = cleanText(item && item.id);
              if (!id) return;
              uniqueById.set(String(id), item);
            },
          );
          exhaustivePagesFetched += 1;
        } catch (error) {
          void error;
        }
      }
      items = Array.from(uniqueById.values()).sort((a, b) => {
        const av = Number(a && a.etaEpochMs);
        const bv = Number(b && b.etaEpochMs);
        if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
          return av - bv;
        return String(cleanText(a && a.id) || "").localeCompare(
          String(cleanText(b && b.id) || ""),
        );
      });
      state.overviewCommandsExhaustiveFetchedAtMs = getServerNowMs();
    }

    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      sourceUrl,
      world: safe(() => window.game_data.world, null),
      screen: "overview_villages",
      mode: "commands",
      rowsCount: rows.length,
      rows,
      commandsCount: Array.isArray(items) ? items.length : 0,
      units: parsedCommands.units || [],
      byType: buildOverviewCommandsByType(items),
      items: items || [],
      pageNumbers: (pageNumbers && pageNumbers.length ? pageNumbers : null) ||
        undefined,
      exhaustivePagesFetched,
      warning: parsedCommands.warning || null,
    };
  };

  const fetchOverviewUnitsDump = async (
    type = "own_home",
    groupIdRaw = null,
  ) => {
    const requestedType = cleanText(type) || "own_home";
    const groupId = normalizeVillageGroupId(
      groupIdRaw !== null && groupIdRaw !== undefined
        ? groupIdRaw
        : getSelectedVillageGroupId(),
    );
    const sourceUrl = buildGameUrl({
      screen: "overview_villages",
      mode: "units",
      type: requestedType,
      group: groupId,
      page: -1,
    });
    const doc = await fetchDocument(sourceUrl);
    const rows = parseOverviewRowsForStorage(doc, { limit: 1200 });
    const parsedTroops = parseTroopsDocument(doc, sourceUrl);

    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      sourceUrl,
      world: safe(() => window.game_data.world, null),
      screen: "overview_villages",
      mode: "units",
      type: requestedType,
      rowsCount: rows.length,
      rows,
      villagesCount: parsedTroops.count || 0,
      units: parsedTroops.units || [],
      villages: parsedTroops.villages || [],
    };
  };

  const enrichIncomingsWithSpeed = (incomings, speedModel) => {
    if (!incomings || !Array.isArray(incomings.items)) return incomings;
    if (!speedModel || !speedModel.effectiveMinutesPerField) return incomings;

    const serverNowMs = getServerNow().getTime();
    const effective = speedModel.effectiveMinutesPerField;

    const items = incomings.items.map((item) => {
      const travelSecondsByUnit = {};

      if (Number.isFinite(item.distance)) {
        Object.entries(effective).forEach(([unit, minutesPerField]) => {
          if (!Number.isFinite(minutesPerField)) return;
          travelSecondsByUnit[unit] = Math.round(
            item.distance * minutesPerField * 60,
          );
        });
      }

      const guessedTravelSeconds =
        item.guessedUnit &&
        Number.isFinite(travelSecondsByUnit[item.guessedUnit])
          ? travelSecondsByUnit[item.guessedUnit]
          : null;
      const arrivalMsValue = toFiniteMs(item && item.arrivalMs);
      const etaByArrivalText = Number(item && item.arrivalEpochMs);
      const etaEpochMs = Number.isFinite(etaByArrivalText)
        ? etaByArrivalText
        : Number.isFinite(item.timerSeconds)
          ? serverNowMs +
            item.timerSeconds * 1000 +
            (Number.isFinite(arrivalMsValue) ? arrivalMsValue : 0)
          : null;
      const guessedSendEpochMs =
        Number.isFinite(etaEpochMs) && Number.isFinite(guessedTravelSeconds)
          ? etaEpochMs - guessedTravelSeconds * 1000
          : null;

      return {
        ...item,
        travelSecondsByUnit,
        guessedTravelSeconds,
        etaEpochMs,
        guessedSendEpochMs,
      };
    });

    return {
      ...incomings,
      speedContext: {
        worldSpeed: speedModel.worldSpeed,
        unitSpeed: speedModel.unitSpeed,
        speedFactor: speedModel.speedFactor,
        source: speedModel.source,
      },
      items,
    };
  };

  const buildSnapshot = ({
    speedModel,
    incomings,
    troops,
    overviewCommands,
    detectedSigilPercent,
    sigilSource,
    errors,
  }) => ({
    version: VERSION,
    generatedAt: new Date(getServerNowMs()).toISOString(),
    world: safe(() => window.game_data.world, null),
    villageId: safe(() => window.game_data.village.id, null),
    screen: safe(() => window.game_data.screen, null),
    mode: safe(() => window.game_data.mode, null),
    speedModel: speedModel
      ? {
          worldSpeed: speedModel.worldSpeed,
          unitSpeed: speedModel.unitSpeed,
          speedFactor: speedModel.speedFactor,
          source: speedModel.source,
          fetchedAt: speedModel.fetchedAt,
          warning: speedModel.warning,
        }
      : null,
    sigilPercent: Number.isFinite(detectedSigilPercent)
      ? normalizeSigilPercent(detectedSigilPercent)
      : 0,
    sigilSource: cleanText(sigilSource) || null,
    incomings: incomings || { count: 0, items: [] },
    troops: troops || { count: 0, villages: [] },
    commands: overviewCommands
      ? {
          count: Math.max(0, toInt(overviewCommands.commandsCount) || 0),
          byType:
            overviewCommands.byType &&
            typeof overviewCommands.byType === "object"
              ? {
                  attack: Math.max(
                    0,
                    toInt(overviewCommands.byType.attack) || 0,
                  ),
                  support: Math.max(
                    0,
                    toInt(overviewCommands.byType.support) || 0,
                  ),
                  return: Math.max(
                    0,
                    toInt(overviewCommands.byType.return) || 0,
                  ),
                  other: Math.max(0, toInt(overviewCommands.byType.other) || 0),
                }
              : { attack: 0, support: 0, return: 0, other: 0 },
        }
      : { count: 0, byType: { attack: 0, support: 0, return: 0, other: 0 } },
    errors,
  });

  const ensureStyles = () => {
    if (document.getElementById("scriptmm-overlay-style")) return;

    const style = document.createElement("style");
    style.id = "scriptmm-overlay-style";
    style.textContent = `
#scriptmm-overlay-root{position:fixed;inset:0;z-index:2147483600;font-family:"Trebuchet MS","Segoe UI",sans-serif}
#scriptmm-overlay-root .smm-backdrop{position:absolute;inset:0;background:radial-gradient(circle at 20% 20%,rgba(255,214,128,.25),transparent 45%),rgba(14,19,28,.62)}
#scriptmm-overlay-root .smm-modal{position:relative;width:min(1540px,98.8vw);height:min(92vh,900px);margin:3vh auto;background:linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%);border:1px solid #b89a5a;border-radius:16px;box-shadow:0 28px 90px rgba(0,0,0,.45);display:flex;flex-direction:column;overflow:hidden}
#scriptmm-overlay-root .smm-header{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 16px;background:linear-gradient(180deg,#3d2a12 0%,#2e1f0d 100%);color:#f8e9c3;border-bottom:1px solid #a37b36;gap:12px}
#scriptmm-overlay-root .smm-header-left{display:flex;flex-direction:column;gap:7px;min-width:0}
#scriptmm-overlay-root .smm-title{font-size:18px;font-weight:700;letter-spacing:.3px}
#scriptmm-overlay-root .smm-title a{color:inherit;text-decoration:none;border-bottom:1px dotted rgba(248,233,195,.55)}
#scriptmm-overlay-root .smm-title a:hover{border-bottom-color:rgba(248,233,195,.95)}
#scriptmm-overlay-root .smm-subtitle{font-size:12px;opacity:.85}
#scriptmm-overlay-root .smm-tabs{display:flex;align-items:center;gap:6px}
#scriptmm-overlay-root .smm-tab{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer}
#scriptmm-overlay-root .smm-tab:hover{filter:brightness(1.05)}
#scriptmm-overlay-root .smm-tab.active{border-color:#8f2f13;background:linear-gradient(180deg,#ffddc7 0%,#f3b084 100%);color:#5d1908}
#scriptmm-overlay-root .smm-actions{display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end}
#scriptmm-overlay-root .smm-btn{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;cursor:pointer}
#scriptmm-overlay-root .smm-btn:hover{filter:brightness(1.05)}
#scriptmm-overlay-root .smm-btn.smm-icon-btn{width:24px;min-width:24px;height:24px;padding:0;display:inline-flex;align-items:center;justify-content:center;font-size:14px;line-height:1;border-radius:7px}
#scriptmm-overlay-root .smm-hub-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
#scriptmm-overlay-root .smm-nearest-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px}
#scriptmm-overlay-root .smm-nearest-dialog-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(15,9,2,.52);z-index:2147483600}
#scriptmm-overlay-root .smm-nearest-dialog-card{width:min(1380px,98vw);max-height:94vh;display:flex;flex-direction:column;padding:10px;border:1px solid #b89a5a;border-radius:12px;background:linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%);box-shadow:0 18px 60px rgba(0,0,0,.35);overflow:hidden}
#scriptmm-overlay-root .smm-nearest-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
#scriptmm-overlay-root .smm-nearest-dialog-title{font-size:14px;font-weight:800;color:#4b310d}
#scriptmm-overlay-root .smm-nearest-dialog-head-right{display:inline-flex;align-items:center;gap:6px}
#scriptmm-overlay-root .smm-nearest-dialog-meta{font-size:11px;line-height:1.25;color:#5d4420;margin-bottom:6px}
#scriptmm-overlay-root .smm-nearest-context{font-size:10px;font-weight:700;color:#4b2f10;background:#f7edd6}
#scriptmm-overlay-root .smm-nearest-route{font-size:10px;color:#4f3514;background:#fbf3df}
#scriptmm-overlay-root .smm-nearest-comment{font-size:10px;line-height:1.2;max-width:220px;white-space:normal;text-align:left;color:#4f3514;background:#fbf3df}
#scriptmm-overlay-root .smm-nearest-group-select{min-width:94px}
#scriptmm-overlay-root .smm-hub-dialog-backdrop{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,9,2,.52);z-index:9}
#scriptmm-overlay-root .smm-hub-dialog-backdrop[hidden]{display:none}
#scriptmm-overlay-root .smm-hub-dialog-card{width:min(470px,92vw);padding:12px;border:1px solid #b89a5a;border-radius:12px;background:linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%);box-shadow:0 18px 60px rgba(0,0,0,.3)}
#scriptmm-overlay-root .smm-hub-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#scriptmm-overlay-root .smm-hub-dialog-title{font-size:14px;font-weight:800;color:#4b310d}
#scriptmm-overlay-root .smm-hub-dialog-close{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;padding:2px 7px;font-size:13px;line-height:1;font-weight:800;cursor:pointer}
#scriptmm-overlay-root .smm-hub-dialog-close:hover{filter:brightness(1.05)}
#scriptmm-overlay-root .smm-hub-dialog-label{display:block;margin:0 0 6px 1px;font-size:12px;font-weight:700;color:#5a4320}
#scriptmm-overlay-root .smm-hub-dialog-input{width:100%;box-sizing:border-box;border:1px solid #cab286;border-radius:8px;padding:7px 8px;background:#fffef8;color:#2c220f;font-size:12px}
#scriptmm-overlay-root .smm-hub-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:10px}
#scriptmm-overlay-root .smm-settings-dialog-backdrop{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,9,2,.52);z-index:11}
#scriptmm-overlay-root .smm-settings-dialog-backdrop[hidden]{display:none}
#scriptmm-overlay-root .smm-settings-dialog-card{width:min(560px,94vw);padding:12px;border:1px solid #b89a5a;border-radius:12px;background:linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%);box-shadow:0 18px 60px rgba(0,0,0,.3)}
#scriptmm-overlay-root .smm-settings-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
#scriptmm-overlay-root .smm-settings-dialog-title{font-size:14px;font-weight:800;color:#4b310d}
#scriptmm-overlay-root .smm-settings-list{display:flex;flex-direction:column;gap:7px}
#scriptmm-overlay-root .smm-settings-item{display:flex;align-items:flex-start;gap:8px;padding:6px 4px;border:1px dashed #ccb68a;border-radius:8px;background:#fff9e7}
#scriptmm-overlay-root .smm-settings-item input[type="checkbox"]{margin-top:1px}
#scriptmm-overlay-root .smm-settings-item span{font-size:12px;line-height:1.25;color:#4d3816}
#scriptmm-overlay-root .smm-settings-item.disabled{opacity:.6}
#scriptmm-overlay-root .smm-settings-item.smm-settings-item-inline{align-items:center;justify-content:space-between}
#scriptmm-overlay-root .smm-settings-reset-hidden-btn{margin-top:4px;align-self:flex-start}
#scriptmm-overlay-root .smm-settings-inline-title{font-size:12px;line-height:1.2;color:#4d3816;font-weight:700}
#scriptmm-overlay-root .smm-settings-inline-title input[type="checkbox"]{margin-right:6px;vertical-align:middle}
#scriptmm-overlay-root .smm-settings-number-input{width:78px;border:1px solid #cab286;border-radius:7px;padding:4px 6px;background:#fffef8;color:#2c220f;font-size:12px;text-align:right}
#scriptmm-overlay-root .smm-confirm-dialog-backdrop{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,9,2,.52);z-index:2147483600}
#scriptmm-overlay-root .smm-confirm-dialog-card{width:min(460px,92vw);padding:12px;border:1px solid #b89a5a;border-radius:12px;background:linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%);box-shadow:0 18px 60px rgba(0,0,0,.3)}
#scriptmm-overlay-root .smm-confirm-dialog-title{font-size:14px;font-weight:800;color:#4b310d;margin-bottom:7px}
#scriptmm-overlay-root .smm-confirm-dialog-text{font-size:12px;line-height:1.4;color:#4d3918}
#scriptmm-overlay-root .smm-confirm-dialog-actions{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:10px}
#scriptmm-overlay-root .smm-body{flex:1 1 auto;padding:12px;overflow:auto;background:linear-gradient(180deg,#f7f2e5 0%,#f2e8d3 100%)}
#scriptmm-overlay-root .smm-list{display:flex;flex-direction:column;gap:8px}
#scriptmm-overlay-root .smm-incomings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(700px,1fr));gap:8px;align-content:start}
#scriptmm-overlay-root .smm-village-group{border:1px solid #d3bc8f;background:#fcf4e2;border-radius:10px;padding:6px;box-shadow:0 2px 6px rgba(41,26,5,.08);display:flex;flex-direction:column;gap:6px;min-width:0}
#scriptmm-overlay-root .smm-village-group-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px}
#scriptmm-overlay-root .smm-village-group-head-right{display:inline-flex;align-items:center;gap:6px;min-width:0;justify-content:flex-end}
#scriptmm-overlay-root .smm-village-group-title{font-size:12px;line-height:1.1;font-weight:800;color:#3f2a0d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scriptmm-overlay-root .smm-village-group-coord{font-size:10px;line-height:1;color:#6c5733;white-space:nowrap}
#scriptmm-overlay-root .smm-hide-village-btn{padding:1px 6px;font-size:10px;border-radius:6px}
#scriptmm-overlay-root .smm-village-group-list{display:flex;flex-direction:column;gap:6px;min-width:0}
#scriptmm-overlay-root .smm-item{border:1px solid #d3bc8f;background:#fff8e8;border-radius:10px;padding:7px 9px;box-shadow:0 2px 6px rgba(41,26,5,.08);min-width:0}
#scriptmm-overlay-root .smm-item.smm-def-ok{background:#f6fbf2;border-color:#bfd8b0;box-shadow:0 0 0 1px rgba(96,149,72,.12) inset,0 2px 6px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-item.smm-def-low{background:#fff3ef;border-color:#e2b9af;box-shadow:0 0 0 1px rgba(173,74,52,.12) inset,0 2px 6px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-item.smm-hub-card{background:#eef6ff;border-color:#9fb9d9;box-shadow:0 0 0 1px rgba(62,104,160,.13) inset,0 2px 6px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-item.smm-tribe-card{background:#eef8f1;border-color:#9fc6aa;box-shadow:0 0 0 1px rgba(63,130,86,.12) inset,0 2px 6px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-item.smm-tribe-command-card{background:#f3f8ff;border-color:#a7bcd7;box-shadow:0 0 0 1px rgba(66,95,138,.10) inset,0 1px 3px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-item.smm-tribe-planned-card{background:#fff4e8;border-color:#d9b98f;box-shadow:0 0 0 1px rgba(155,108,64,.10) inset,0 1px 3px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-item.smm-mass-card{background:#fff6cf;border-color:#d3ba67;box-shadow:0 0 0 1px rgba(168,132,34,.18) inset,0 2px 6px rgba(41,26,5,.08)}
#scriptmm-overlay-root .smm-unit-chip.smm-hub-chip{background:#dcecff;border-color:#7ea3cf;color:#173f6d}
#scriptmm-overlay-root .smm-unit-chip.smm-hub-chip-plan{background:#e8f8e6;border-color:#7fb97a;color:#1e5a1c}
#scriptmm-overlay-root .smm-unit-chip.smm-mass-chip{background:#fff0a8;border-color:#c6a749;color:#5c4303}
#scriptmm-overlay-root .smm-unit-chip.smm-mass-chip-plan{background:#e8f8e6;border-color:#7fb97a;color:#1e5a1c}
#scriptmm-overlay-root .smm-unit-chip.smm-probable-spam-chip{background:#ffe8c9;border-color:#d79752;color:#7a3f02}
#scriptmm-overlay-root .smm-item-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
#scriptmm-overlay-root .smm-head-left{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
#scriptmm-overlay-root .smm-type{display:inline-flex;align-items:center;gap:5px;font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid #cdb587;background:#f7e7c3;color:#5a3b10;font-weight:700;text-transform:uppercase}
#scriptmm-overlay-root .smm-unit-icon{width:12px;height:12px;object-fit:contain;vertical-align:middle}
#scriptmm-overlay-root .smm-unit-chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;padding:1px 7px;border-radius:99px;border:1px solid #cdb587;background:#eef5ff;color:#123f66;font-weight:700}
#scriptmm-overlay-root .smm-item.smm-attack .smm-type{background:#e7eaee;border-color:#a8b0b8;color:#39424a}
#scriptmm-overlay-root .smm-item.smm-attack_small .smm-type{background:#ddf7d8;border-color:#79be6c;color:#1c5a22}
#scriptmm-overlay-root .smm-item.smm-attack_medium .smm-type{background:#ffe4c6;border-color:#d88a3b;color:#7a430d}
#scriptmm-overlay-root .smm-item.smm-attack_large{border-color:#c44a3a;box-shadow:0 0 0 1px #d56454 inset,0 2px 6px rgba(120,24,12,.12)}
#scriptmm-overlay-root .smm-item.smm-noble-threat{border-color:#c44a3a;box-shadow:0 0 0 1px #d56454 inset,0 2px 6px rgba(120,24,12,.12)}
#scriptmm-overlay-root .smm-item.smm-attack_large .smm-type{background:#ffd5d0;border-color:#c23c2c;color:#7b1f13}
#scriptmm-overlay-root .smm-type.smm-type-noble{background:#ffe3ef;border-color:#de86ab;color:#6f1541}
#scriptmm-overlay-root .smm-player{font-weight:700;color:#2c1f0f;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48%}
#scriptmm-overlay-root .smm-route{margin-top:3px;color:#41311b;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scriptmm-overlay-root .smm-route-link{color:#254a7a;text-decoration:underline}
#scriptmm-overlay-root .smm-route-link:hover{color:#1a3560}
#scriptmm-overlay-root .smm-time{margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scriptmm-overlay-root .smm-eta{font-size:15px;font-weight:900;color:#341d05;cursor:copy;user-select:none}
#scriptmm-overlay-root .smm-eta:hover{text-decoration:underline}
#scriptmm-overlay-root .smm-time-meta{font-size:11px;font-weight:500;color:#6a5331}
#scriptmm-overlay-root .smm-plan-actions{margin-top:6px;display:flex;gap:6px}
#scriptmm-overlay-root .smm-plan-btn{border:1px solid #b99656;background:linear-gradient(180deg,#f8edcf 0%,#e4cd97 100%);color:#4a2f0f;border-radius:7px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer}
#scriptmm-overlay-root .smm-plan-btn:hover{filter:brightness(1.04)}
#scriptmm-overlay-root .smm-plan-btn.active{border-color:#8f2f13;background:linear-gradient(180deg,#ffddc7 0%,#f3b084 100%);color:#5d1908}
#scriptmm-overlay-root .smm-hide-incoming-btn{margin-left:auto;border-color:#b07f46;background:linear-gradient(180deg,#f7ebce 0%,#e3c995 100%);color:#5c3912}
#scriptmm-overlay-root .smm-hide-incoming-btn:hover{filter:brightness(1.04)}
#scriptmm-overlay-root .smm-favorite-del-btn{margin-left:auto;border-color:#b07f46;background:linear-gradient(180deg,#f7ebce 0%,#e3c995 100%);color:#5c3912}
#scriptmm-overlay-root .smm-plan-actions.readonly{justify-content:flex-end}
#scriptmm-overlay-root .smm-tribe-filters-wrap{display:inline-flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end}
#scriptmm-overlay-root .smm-tribe-search-wrap{display:inline-flex;align-items:center;gap:6px;margin-left:0}
#scriptmm-overlay-root .smm-tribe-search-label{font-size:11px;line-height:1;color:#6d5330}
#scriptmm-overlay-root .smm-tribe-search-input{width:120px;max-width:38vw;height:24px;border:1px solid #ccb287;border-radius:6px;background:#fff9e8;color:#4f3310;font-size:12px;padding:0 8px}
#scriptmm-overlay-root .smm-tribe-toggle{display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#5a4323;font-weight:700;line-height:1}
#scriptmm-overlay-root .smm-tribe-toggle input{margin:0;accent-color:#8f6f2d}
#scriptmm-overlay-root .smm-tribe-owner-wrap{display:inline-flex;align-items:center;gap:6px}
#scriptmm-overlay-root .smm-tribe-owner-select{height:24px;min-width:114px;max-width:200px;border:1px solid #ccb287;border-radius:6px;background:#fff9e8;color:#4f3310;font-size:12px;padding:0 22px 0 6px}
#scriptmm-overlay-root .smm-tribe-loading-hint{display:block;flex:1 1 100%;margin-top:2px;font-size:11px;line-height:1.2;color:#7a4d14}
#scriptmm-overlay-root .smm-plan-panel{margin-top:6px;border:1px solid #d6be91;background:#fffdf7;border-radius:8px;padding:6px}
#scriptmm-overlay-root .smm-plan-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;font-weight:700;color:#5b3d13;margin-bottom:4px}
#scriptmm-overlay-root .smm-plan-head-right,.smm-msg-inline-panel .smm-plan-head-right{display:inline-flex;align-items:center;gap:6px;min-width:0}
#scriptmm-overlay-root .smm-calc-group-select,.smm-msg-inline-panel .smm-calc-group-select{min-width:76px;max-width:170px;height:20px;border:1px solid #c6ab74;border-radius:6px;background:#fff9e8;color:#4f3310;font-size:11px;font-weight:700;line-height:1;padding:0 20px 0 6px}
#scriptmm-overlay-root .smm-plan-body{max-height:220px;overflow:auto;border-top:1px dashed #e2cfab;padding-top:4px}
#scriptmm-overlay-root .smm-plan-row{display:flex;justify-content:space-between;gap:8px;padding:3px 2px;border-bottom:1px solid rgba(104,77,30,.11)}
#scriptmm-overlay-root .smm-plan-row:last-child{border-bottom:0}
#scriptmm-overlay-root .smm-plan-left{display:flex;align-items:center;gap:6px;min-width:0;flex:1 1 auto}
#scriptmm-overlay-root .smm-plan-unit{display:inline-flex;align-items:center;gap:4px;min-width:64px;font-size:11px;font-weight:700;color:#284366}
#scriptmm-overlay-root .smm-plan-count{font-size:11px;font-weight:700;color:#4a3311;min-width:34px}
#scriptmm-overlay-root .smm-plan-village{font-size:11px;color:#3f2f16;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scriptmm-overlay-root .smm-plan-right{display:flex;align-items:center;gap:8px;white-space:nowrap}
#scriptmm-overlay-root .smm-hub-query-row .smm-plan-left{flex-direction:column;align-items:flex-start;gap:2px}
#scriptmm-overlay-root .smm-hub-query-row .smm-plan-right{align-items:flex-end;gap:4px}
#scriptmm-overlay-root .smm-plan-dist{font-size:11px;color:#6f5733}
#scriptmm-overlay-root .smm-plan-depart{font-size:11px;font-weight:700;color:#4a3210}
#scriptmm-overlay-root .smm-plan-countdown{font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#15531b}
#scriptmm-overlay-root .smm-plan-countdown.late{color:#8f1f1f}
#scriptmm-overlay-root .smm-plan-empty{font-size:12px;color:#674e26;padding:5px 2px}
#scriptmm-overlay-root .smm-plan-unit-icons{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
#scriptmm-overlay-root .smm-plan-unit-chip{display:inline-flex;align-items:center;gap:3px;padding:1px 4px;border:1px solid #cdb587;border-radius:999px;background:#eef5ff;color:#1d456b;font-size:10px;font-weight:700}
#scriptmm-overlay-root .smm-plan-unit-chip .smm-unit-icon{width:11px;height:11px}
#scriptmm-overlay-root .smm-plan-actions-wrap{display:flex;align-items:center;justify-content:center;gap:4px}
#scriptmm-overlay-root .smm-slice-scroll{overflow-x:auto;overflow-y:auto;border-top:1px dashed #e2cfab;padding-top:4px;overscroll-behavior:contain;max-height:320px;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}
#scriptmm-overlay-root .smm-slice-table{width:max-content;min-width:100%;border-collapse:separate;border-spacing:0;font-size:11px}
#scriptmm-overlay-root .smm-slice-table th,#scriptmm-overlay-root .smm-slice-table td{border:1px solid #dcc89f;padding:2px 4px;text-align:center;white-space:nowrap;background:#fff8e6}
#scriptmm-overlay-root .smm-slice-table thead th{position:sticky;top:0;z-index:1;background:#f0dfbb;color:#4f320c}
#scriptmm-overlay-root .smm-plan-comment-cell{text-align:left;white-space:normal;line-height:1.25;min-width:110px;max-width:260px}
#scriptmm-overlay-root .smm-plan-comment-wrap{display:flex;align-items:flex-start;gap:6px}
#scriptmm-overlay-root .smm-plan-comment-text{flex:1 1 auto;min-width:0;word-break:break-word}
#scriptmm-overlay-root .smm-plan-timing-cell{text-align:left;white-space:normal;line-height:1.25;min-width:128px}
#scriptmm-overlay-root .smm-plan-timing-text{flex:1 1 auto;min-width:0;word-break:break-word}
#scriptmm-overlay-root .smm-plan-comment-edit{width:18px;height:18px;min-width:18px;padding:0;border:1px solid #b99656;border-radius:5px;cursor:pointer;background:linear-gradient(180deg,#fff6de 0%,#ecd7ab 100%);background-repeat:no-repeat;background-position:center;background-size:12px 12px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235a3a10' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'/%3E%3Cpath d='M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4z'/%3E%3C/svg%3E")}
#scriptmm-overlay-root .smm-plan-comment-edit:hover{filter:brightness(1.06)}
#scriptmm-overlay-root .smm-unit-toggle,.smm-msg-inline-panel .smm-unit-toggle{position:relative;display:inline-flex;align-items:center;justify-content:center;width:20px;height:16px;padding:0;margin:0;border:0;background:transparent;cursor:pointer}
#scriptmm-overlay-root .smm-unit-toggle:hover,.smm-msg-inline-panel .smm-unit-toggle:hover{filter:brightness(1.1)}
#scriptmm-overlay-root .smm-unit-toggle.is-disabled,.smm-msg-inline-panel .smm-unit-toggle.is-disabled{opacity:.35;filter:grayscale(1)}
#scriptmm-overlay-root .smm-unit-toggle.is-disabled::after,.smm-msg-inline-panel .smm-unit-toggle.is-disabled::after{content:"";position:absolute;left:1px;right:1px;top:52%;border-top:2px solid #8e3025;transform:rotate(-17deg)}
#scriptmm-overlay-root .smm-plan-timing-copy{cursor:copy;user-select:none;font-weight:700;color:#2f4c70}
#scriptmm-overlay-root .smm-plan-timing-copy:hover{background:#eef5ff}
#scriptmm-overlay-root .smm-slice-village{font-weight:700;text-align:center !important;min-width:92px;max-width:102px;overflow:hidden;text-overflow:ellipsis;background:#f7edd6 !important}
#scriptmm-overlay-root .smm-village-coord{display:block;font-size:13px;line-height:1.05;color:#37250c}
#scriptmm-overlay-root .smm-row-scale-wrap{display:flex;align-items:center;gap:4px;margin-top:2px}
#scriptmm-overlay-root .smm-row-scale{width:58px;height:14px;accent-color:#9f6f1e}
#scriptmm-overlay-root .smm-row-scale-label{font-size:9px;line-height:1;color:#6b5732;min-width:28px;text-align:right}
#scriptmm-overlay-root .smm-slice-cell{min-width:42px}
#scriptmm-overlay-root .smm-slice-cell.is-empty{color:#9a8762;background:#f8f1df}
#scriptmm-overlay-root .smm-slice-cell.is-blocked{background:#f6e6e2}
#scriptmm-overlay-root .smm-slice-input{width:42px;border:1px solid #cab286;border-radius:4px;padding:1px 2px;font-size:11px;text-align:center;background:#ffffff;color:#2c220f}
#scriptmm-overlay-root .smm-slice-cell.is-blocked .smm-slice-input{background:#efe1dc;color:#8d6b64}
#scriptmm-overlay-root .smm-slice-avail{display:block;font-size:10px;line-height:1.15;color:#6b5732}
#scriptmm-overlay-root .smm-sigil-cell{min-width:62px}
#scriptmm-overlay-root .smm-sigil-input{width:54px;border:1px solid #cab286;border-radius:4px;padding:1px 2px;font-size:11px;text-align:center;background:#fffef8;color:#2c220f}
#scriptmm-overlay-root .smm-slice-depart{font-weight:700;color:#4a3210;min-width:62px;font-size:10px;line-height:1}
#scriptmm-overlay-root .smm-slice-arrive{font-weight:700;color:#4a3210;min-width:62px;font-size:10px;line-height:1}
#scriptmm-overlay-root .smm-slice-timer{min-width:76px}
#scriptmm-overlay-root .smm-slice-action{min-width:188px}
#scriptmm-overlay-root .smm-slice-action-wrap{display:flex;align-items:center;justify-content:center;gap:4px}
#scriptmm-overlay-root .smm-go-btn{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;cursor:pointer}
#scriptmm-overlay-root .smm-slice-action-wrap .smm-go-btn{padding:2px 6px;font-size:10px}
#scriptmm-overlay-root .smm-go-btn:hover{filter:brightness(1.05)}
#scriptmm-overlay-root .smm-go-btn.disabled,#scriptmm-overlay-root .smm-go-btn:disabled{opacity:.5;cursor:not-allowed;filter:none}
#scriptmm-overlay-root .smm-footer{padding:8px 14px;border-top:1px solid #d8c094;background:#f7efd9;display:flex;justify-content:space-between;gap:12px;align-items:flex-end}
#scriptmm-overlay-root .smm-footer-main{flex:1 1 auto;min-width:0}
#scriptmm-overlay-root .smm-meta{font-size:11px;color:#6a5331;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
#scriptmm-overlay-root .smm-status{font-size:12px;color:#5a4524}
#scriptmm-overlay-root .smm-progress{margin-top:5px}
#scriptmm-overlay-root .smm-progress-track{height:6px;border:1px solid #c9ae77;border-radius:999px;background:#efe2c7;overflow:hidden}
#scriptmm-overlay-root .smm-progress-bar{height:100%;width:0%;background:linear-gradient(90deg,#5f943e 0%,#7eaf4f 100%);transition:width .18s ease}
#scriptmm-overlay-root .smm-progress-text{margin-top:2px;font-size:10px;color:#6f5733;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#scriptmm-overlay-root .smm-loading{font-size:13px;color:#5b4522}
#scriptmm-overlay-root .smm-empty{padding:22px;border:1px dashed #c8af7d;border-radius:10px;background:#fff6e4;color:#6a532d;text-align:center}
.smm-msg-inline-actions{display:inline-flex;align-items:center;gap:4px;margin-left:8px;vertical-align:middle;white-space:nowrap}
.smm-msg-inline-hint{font-size:10px;color:#5f4a27;background:#f5ebd2;border:1px solid #cdb587;border-radius:10px;padding:1px 5px}
.smm-msg-plan-btn{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;padding:1px 6px;font-size:10px;font-weight:700;cursor:pointer}
.smm-msg-plan-btn:hover{filter:brightness(1.05)}
.smm-msg-plan-btn.active{border-color:#8f2f13;background:linear-gradient(180deg,#ffddc7 0%,#f3b084 100%);color:#5d1908}
.smm-msg-manual-inline{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0 6px 0;padding:6px;border:1px dashed #cdb587;border-radius:8px;background:#fff7e5}
.smm-msg-manual-label{font-size:11px;font-weight:700;color:#5f4215}
.smm-msg-manual-datetime{min-width:220px;border:1px solid #cab286;border-radius:6px;padding:2px 6px;font-size:11px;background:#fffef8;color:#2c220f}
.smm-msg-manual-btn{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;padding:2px 8px;font-size:10px;font-weight:700;cursor:pointer}
.smm-msg-manual-btn:hover{filter:brightness(1.05)}
.smm-msg-manual-btn.active{border-color:#8f2f13;background:linear-gradient(180deg,#ffddc7 0%,#f3b084 100%);color:#5d1908}
.smm-msg-manual-status{font-size:10px;color:#6b532b;min-width:160px}
.smm-msg-inline-panel{position:absolute;left:0;top:0;display:block;margin:0;padding:24px 6px 6px 6px;border:1px solid #d3bc8f;border-radius:9px;background:linear-gradient(180deg,#fff9ec 0%,#f4ead6 100%);box-shadow:0 12px 30px rgba(41,26,5,.22);max-width:none;overflow-x:visible;overflow-y:auto;z-index:2147483200}
.smm-msg-inline-panel.smm-dragging{cursor:grabbing}
.smm-msg-inline-panel.smm-spotlight-inline-panel{position:relative;left:auto;top:auto;width:100%;max-width:100%;max-height:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;overflow:visible;z-index:auto}
.smm-msg-inline-panel.smm-spotlight-inline-panel .smm-plan-panel{margin-top:6px}
.smm-msg-inline-panel.smm-spotlight-inline-panel .smm-slice-scroll{max-height:280px}
.smm-msg-inline-panel.smm-spotlight-inline-panel .smm-msg-inline-status{margin-top:6px}
.smm-msg-inline-open-plan{position:absolute;top:4px;left:5px;border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;padding:1px 7px;font-size:10px;line-height:1.2;font-weight:700;cursor:pointer}
.smm-msg-inline-open-plan:hover{filter:brightness(1.05)}
.smm-msg-inline-group-select{position:absolute;top:4px;left:62px;min-width:86px;max-width:170px;height:20px;border:1px solid #b7904f;background:linear-gradient(180deg,#fff9e8 0%,#f4e4c4 100%);color:#4c2f0c;border-radius:6px;padding:0 20px 0 6px;font-size:10px;line-height:1.2;font-weight:700}
.smm-msg-inline-close{position:absolute;top:4px;right:5px;width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;font-size:13px;line-height:1;font-weight:700;cursor:pointer}
.smm-msg-inline-close:hover{filter:brightness(1.05)}
.smm-msg-inline-panel .smm-plan-panel{margin:0;border:1px solid #d6be91;background:#fffdf7;border-radius:8px;padding:6px}
.smm-msg-inline-panel .smm-plan-head{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;font-weight:700;color:#5b3d13;margin-bottom:4px}
.smm-msg-inline-panel .smm-plan-empty{font-size:12px;color:#674e26;padding:5px 2px}
.smm-msg-inline-panel .smm-slice-scroll{overflow-x:auto;overflow-y:auto;border-top:1px dashed #e2cfab;padding-top:4px;overscroll-behavior:contain;max-height:320px;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}
.smm-msg-inline-panel .smm-slice-table{width:max-content;min-width:0;border-collapse:separate;border-spacing:0;font-size:11px}
.smm-msg-inline-panel .smm-slice-table th,.smm-msg-inline-panel .smm-slice-table td{border:1px solid #dcc89f;padding:2px 4px;text-align:center;white-space:nowrap;background:#fff8e6}
.smm-msg-inline-panel .smm-slice-table thead th{position:sticky;top:0;z-index:1;background:#f0dfbb;color:#4f320c}
.smm-msg-inline-panel .smm-slice-village{font-weight:700;text-align:center !important;min-width:92px;max-width:102px;overflow:hidden;text-overflow:ellipsis;background:#f7edd6 !important}
.smm-msg-inline-panel .smm-village-coord{display:block;font-size:13px;line-height:1.05;color:#37250c}
.smm-msg-inline-panel .smm-row-scale-wrap{display:flex;align-items:center;gap:4px;margin-top:2px}
.smm-msg-inline-panel .smm-row-scale{width:58px;height:14px;accent-color:#9f6f1e}
.smm-msg-inline-panel .smm-row-scale-label{font-size:9px;line-height:1;color:#6b5732;min-width:28px;text-align:right}
.smm-msg-inline-panel .smm-slice-cell{min-width:42px}
.smm-msg-inline-panel .smm-slice-cell.is-empty{color:#9a8762;background:#f8f1df}
.smm-msg-inline-panel .smm-slice-cell.is-blocked{background:#f6e6e2}
.smm-msg-inline-panel .smm-slice-input{width:42px;border:1px solid #cab286;border-radius:4px;padding:1px 2px;font-size:11px;text-align:center;background:#ffffff;color:#2c220f}
.smm-msg-inline-panel .smm-slice-cell.is-blocked .smm-slice-input{background:#efe1dc;color:#8d6b64}
.smm-msg-inline-panel .smm-slice-avail{display:block;font-size:10px;line-height:1.15;color:#6b5732}
.smm-msg-inline-panel .smm-sigil-cell{min-width:62px}
.smm-msg-inline-panel .smm-sigil-input{width:54px;border:1px solid #cab286;border-radius:4px;padding:1px 2px;font-size:11px;text-align:center;background:#fffef8;color:#2c220f}
.smm-msg-inline-panel .smm-slice-depart{font-weight:700;color:#4a3210;min-width:62px;font-size:10px;line-height:1}
.smm-msg-inline-panel .smm-slice-arrive{font-weight:700;color:#4a3210;min-width:62px;font-size:10px;line-height:1}
.smm-msg-inline-panel .smm-slice-timer{min-width:76px}
.smm-msg-inline-panel .smm-slice-action{min-width:188px}
.smm-msg-inline-panel .smm-slice-action-wrap{display:flex;align-items:center;justify-content:center;gap:4px}
.smm-msg-inline-panel .smm-go-btn{border:1px solid #b7904f;background:linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%);color:#4c2f0c;border-radius:6px;padding:2px 6px;font-size:10px;font-weight:700;cursor:pointer}
.smm-msg-inline-panel .smm-go-btn:hover{filter:brightness(1.05)}
.smm-msg-inline-panel .smm-go-btn.disabled,.smm-msg-inline-panel .smm-go-btn:disabled{opacity:.5;cursor:not-allowed;filter:none}
.smm-msg-inline-panel .smm-plan-countdown{font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:800;color:#15531b}
.smm-msg-inline-panel .smm-plan-countdown.late{color:#8f1f1f}
.smm-msg-inline-status{margin-top:4px;font-size:11px;color:#5b3f15}
#scriptmm-overlay-root.smm-mobile .smm-modal{width:100vw;height:100vh;margin:0;border-radius:0}
#scriptmm-overlay-root.smm-mobile .smm-header{position:relative;display:block;padding:5px 0 4px}
#scriptmm-overlay-root.smm-mobile .smm-header-left{gap:3px;padding-right:82px}
#scriptmm-overlay-root.smm-mobile .smm-actions{position:absolute;top:4px;right:3px;z-index:2;gap:3px;flex-wrap:nowrap;justify-content:flex-end}
#scriptmm-overlay-root.smm-mobile .smm-title{font-size:12px;line-height:1.1}
#scriptmm-overlay-root.smm-mobile .smm-subtitle{font-size:9px;line-height:1.1}
#scriptmm-overlay-root.smm-mobile .smm-tabs{gap:2px}
#scriptmm-overlay-root.smm-mobile .smm-tab{padding:2px 5px;font-size:9px;border-radius:6px}
#scriptmm-overlay-root.smm-mobile .smm-body{padding:0}
#scriptmm-overlay-root.smm-mobile .smm-list{gap:4px}
#scriptmm-overlay-root.smm-mobile .smm-incomings-grid{grid-template-columns:1fr;gap:4px}
#scriptmm-overlay-root.smm-mobile .smm-village-group{padding:2px 0;border-left:0;border-right:0;border-radius:0}
#scriptmm-overlay-root.smm-mobile .smm-village-group-head{padding:0 1px}
#scriptmm-overlay-root.smm-mobile .smm-village-group-head-right{gap:3px}
#scriptmm-overlay-root.smm-mobile .smm-village-group-title{font-size:10px}
#scriptmm-overlay-root.smm-mobile .smm-village-group-coord{font-size:8px}
#scriptmm-overlay-root.smm-mobile .smm-hide-village-btn{padding:1px 4px;font-size:8px;border-radius:5px}
#scriptmm-overlay-root.smm-mobile .smm-village-group-list{gap:4px}
#scriptmm-overlay-root.smm-mobile .smm-item{padding:4px 0;border-radius:0}
#scriptmm-overlay-root.smm-mobile .smm-route,#scriptmm-overlay-root.smm-mobile .smm-time-meta,#scriptmm-overlay-root.smm-mobile .smm-player{font-size:10px}
#scriptmm-overlay-root.smm-mobile .smm-eta{font-size:12px}
#scriptmm-overlay-root.smm-mobile .smm-plan-actions{gap:3px;margin-top:4px}
#scriptmm-overlay-root.smm-mobile .smm-plan-btn{padding:1px 5px;font-size:9px;border-radius:6px}
#scriptmm-overlay-root.smm-mobile .smm-hide-incoming-btn{margin-left:0}
#scriptmm-overlay-root.smm-mobile .smm-tribe-filters-wrap{gap:3px;margin-left:0;justify-content:flex-start}
#scriptmm-overlay-root.smm-mobile .smm-tribe-search-wrap{gap:3px;margin-left:0}
#scriptmm-overlay-root.smm-mobile .smm-tribe-search-label{font-size:8px}
#scriptmm-overlay-root.smm-mobile .smm-tribe-search-input{width:74px;max-width:38vw;height:16px;font-size:8px;padding:0 3px;border-radius:4px}
#scriptmm-overlay-root.smm-mobile .smm-tribe-toggle{gap:2px;font-size:8px}
#scriptmm-overlay-root.smm-mobile .smm-tribe-owner-wrap{gap:3px}
#scriptmm-overlay-root.smm-mobile .smm-tribe-owner-select{height:16px;min-width:78px;max-width:112px;font-size:8px;padding:0 12px 0 3px;border-radius:4px}
#scriptmm-overlay-root.smm-mobile .smm-tribe-loading-hint{font-size:8px;line-height:1.15}
#scriptmm-overlay-root.smm-mobile .smm-nearest-toolbar{gap:4px;margin-bottom:4px}
#scriptmm-overlay-root.smm-mobile .smm-nearest-dialog-backdrop{padding:0}
#scriptmm-overlay-root.smm-mobile .smm-nearest-dialog-card{width:100vw;max-height:100vh;height:100vh;border-radius:0;padding:4px 0}
#scriptmm-overlay-root.smm-mobile .smm-nearest-dialog-head{padding:0 4px;margin-bottom:4px}
#scriptmm-overlay-root.smm-mobile .smm-nearest-dialog-title{font-size:11px}
#scriptmm-overlay-root.smm-mobile .smm-nearest-dialog-meta{font-size:8px;padding:0 4px;margin-bottom:4px}
#scriptmm-overlay-root.smm-mobile .smm-nearest-context,#scriptmm-overlay-root.smm-mobile .smm-nearest-route{font-size:7px;padding:0 1px}
#scriptmm-overlay-root.smm-mobile .smm-nearest-comment{font-size:7px;line-height:1.15;max-width:92px;padding:0 1px}
#scriptmm-overlay-root.smm-mobile .smm-nearest-group-select{min-width:56px;max-width:78px;height:15px;padding:0 10px 0 2px;font-size:7px;border-radius:3px}
#scriptmm-overlay-root.smm-mobile .smm-plan-panel,.smm-msg-inline-panel.smm-mobile .smm-plan-panel{padding:2px 0;margin-left:0;margin-right:0;border-left:0;border-right:0;border-radius:0}
#scriptmm-overlay-root.smm-mobile .smm-plan-head,.smm-msg-inline-panel.smm-mobile .smm-plan-head{font-size:9px;margin-bottom:2px;gap:4px}
#scriptmm-overlay-root.smm-mobile .smm-calc-group-select,.smm-msg-inline-panel.smm-mobile .smm-calc-group-select{min-width:48px;max-width:64px;height:14px;padding:0 10px 0 2px;font-size:7px;border-radius:3px}
#scriptmm-overlay-root.smm-mobile .smm-slice-scroll,.smm-msg-inline-panel.smm-mobile .smm-slice-scroll{padding:0}
#scriptmm-overlay-root.smm-mobile .smm-slice-table,.smm-msg-inline-panel.smm-mobile .smm-slice-table{font-size:7px}
#scriptmm-overlay-root.smm-mobile .smm-slice-table th,#scriptmm-overlay-root.smm-mobile .smm-slice-table td,.smm-msg-inline-panel.smm-mobile .smm-slice-table th,.smm-msg-inline-panel.smm-mobile .smm-slice-table td{padding:0 1px}
#scriptmm-overlay-root.smm-mobile .smm-slice-table thead th,.smm-msg-inline-panel.smm-mobile .smm-slice-table thead th{font-size:6px}
#scriptmm-overlay-root.smm-mobile .smm-slice-village,.smm-msg-inline-panel.smm-mobile .smm-slice-village{min-width:42px;max-width:44px}
#scriptmm-overlay-root.smm-mobile .smm-village-coord,.smm-msg-inline-panel.smm-mobile .smm-village-coord{font-size:7px}
#scriptmm-overlay-root.smm-mobile .smm-row-scale-wrap,.smm-msg-inline-panel.smm-mobile .smm-row-scale-wrap{gap:1px;margin-top:1px}
#scriptmm-overlay-root.smm-mobile .smm-row-scale,.smm-msg-inline-panel.smm-mobile .smm-row-scale{width:24px;height:8px}
#scriptmm-overlay-root.smm-mobile .smm-row-scale-label,.smm-msg-inline-panel.smm-mobile .smm-row-scale-label{display:none}
#scriptmm-overlay-root.smm-mobile .smm-slice-cell,.smm-msg-inline-panel.smm-mobile .smm-slice-cell{min-width:12px}
#scriptmm-overlay-root.smm-mobile .smm-slice-input,.smm-msg-inline-panel.smm-mobile .smm-slice-input{width:12px;padding:0;font-size:7px;line-height:1;border-radius:2px}
#scriptmm-overlay-root.smm-mobile .smm-slice-avail,.smm-msg-inline-panel.smm-mobile .smm-slice-avail{display:none}
#scriptmm-overlay-root.smm-mobile .smm-sigil-cell,.smm-msg-inline-panel.smm-mobile .smm-sigil-cell{min-width:14px}
#scriptmm-overlay-root.smm-mobile .smm-sigil-input,.smm-msg-inline-panel.smm-mobile .smm-sigil-input{width:12px;padding:0;font-size:7px;line-height:1;border-radius:2px}
#scriptmm-overlay-root.smm-mobile .smm-slice-depart,.smm-msg-inline-panel.smm-mobile .smm-slice-depart{min-width:26px;font-size:7px}
#scriptmm-overlay-root.smm-mobile .smm-slice-arrive,.smm-msg-inline-panel.smm-mobile .smm-slice-arrive{min-width:26px;font-size:7px}
#scriptmm-overlay-root.smm-mobile .smm-slice-timer,.smm-msg-inline-panel.smm-mobile .smm-slice-timer{min-width:30px}
#scriptmm-overlay-root.smm-mobile .smm-slice-action,.smm-msg-inline-panel.smm-mobile .smm-slice-action{min-width:30px}
#scriptmm-overlay-root.smm-mobile .smm-slice-action-wrap,.smm-msg-inline-panel.smm-mobile .smm-slice-action-wrap{gap:1px}
#scriptmm-overlay-root.smm-mobile .smm-slice-action-wrap .smm-go-btn,.smm-msg-inline-panel.smm-mobile .smm-slice-action-wrap .smm-go-btn{min-width:14px;width:14px;height:13px;padding:0;font-size:0;border-radius:4px}
#scriptmm-overlay-root.smm-mobile .smm-slice-action-wrap .smm-go-btn::before,.smm-msg-inline-panel.smm-mobile .smm-slice-action-wrap .smm-go-btn::before{font-size:9px;line-height:1}
#scriptmm-overlay-root.smm-mobile .smm-slice-action-wrap .smm-go-btn:nth-child(1)::before,.smm-msg-inline-panel.smm-mobile .smm-slice-action-wrap .smm-go-btn:nth-child(1)::before{content:"→"}
#scriptmm-overlay-root.smm-mobile .smm-slice-action-wrap .smm-go-btn:nth-child(2)::before,.smm-msg-inline-panel.smm-mobile .smm-slice-action-wrap .smm-go-btn:nth-child(2)::before{content:"⏱"}
#scriptmm-overlay-root.smm-mobile .smm-unit-toggle,.smm-msg-inline-panel.smm-mobile .smm-unit-toggle{width:10px;height:10px}
#scriptmm-overlay-root.smm-mobile .smm-unit-toggle .smm-unit-icon,.smm-msg-inline-panel.smm-mobile .smm-unit-toggle .smm-unit-icon{width:9px;height:9px}
#scriptmm-overlay-root.smm-mobile .smm-footer{padding:4px 0;gap:6px}
#scriptmm-overlay-root.smm-mobile .smm-status{font-size:9px}
#scriptmm-overlay-root.smm-mobile .smm-meta{font-size:8px;margin-top:1px}
#scriptmm-overlay-root.smm-mobile .smm-progress{margin-top:2px}
#scriptmm-overlay-root.smm-mobile .smm-progress-track{height:4px}
#scriptmm-overlay-root.smm-mobile .smm-progress-text{font-size:8px;margin-top:1px}
#scriptmm-overlay-root.smm-mobile .smm-settings-item.smm-settings-item-inline{gap:5px}
#scriptmm-overlay-root.smm-mobile .smm-settings-inline-title{font-size:10px}
#scriptmm-overlay-root.smm-mobile .smm-settings-number-input{width:60px;padding:2px 4px;font-size:10px}
.smm-msg-inline-panel.smm-mobile{padding:18px 0 0 0;border-left:0;border-right:0;border-radius:0}
.smm-msg-inline-panel.smm-spotlight-inline-panel.smm-mobile{padding:0;border:0}
.smm-msg-inline-panel.smm-mobile .smm-msg-inline-group-select{top:2px;left:54px;min-width:56px;max-width:74px;height:15px;padding:0 10px 0 2px;font-size:7px;border-radius:3px}
#smm-msg-inline-fallback{margin:8px 0;padding:8px;border:1px solid #c9b084;border-radius:8px;background:#fff7e5}
#smm-msg-inline-fallback .smm-msg-inline-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:4px 0}
#smm-msg-inline-fallback .smm-msg-inline-label{font-size:11px;color:#4b3718}
@media (max-width:840px){
  #scriptmm-overlay-root:not(.smm-mobile) .smm-modal{width:96vw;height:92vh;margin:3vh auto}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-header{flex-direction:column;align-items:stretch}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-header-left{gap:6px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-actions{justify-content:flex-start}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-title{font-size:16px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-tabs{gap:4px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-tab{padding:4px 7px;font-size:11px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-btn{padding:4px 7px;font-size:11px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-player{max-width:52%}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-slice-village{min-width:86px;max-width:92px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-slice-table th,#scriptmm-overlay-root:not(.smm-mobile) .smm-slice-table td{padding:2px 3px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-slice-input{width:34px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-row-scale{width:46px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-row-scale-label{min-width:24px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-sigil-cell{min-width:54px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-sigil-input{width:46px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-slice-action{min-width:168px}
  #scriptmm-overlay-root:not(.smm-mobile) .smm-meta{font-size:10px}
}
`;
    document.head.appendChild(style);
  };

  const createOverlay = () => {
    stopCountdownTicker();
    const previous = document.getElementById("scriptmm-overlay-root");
    if (previous) previous.remove();

    ensureStyles();

    const root = document.createElement("div");
    root.id = "scriptmm-overlay-root";
    root.innerHTML = `
<div class="smm-backdrop"></div>
<section class="smm-modal" role="dialog" aria-modal="true">
  <header class="smm-header">
    <div class="smm-header-left">
      <div class="smm-title"><a class="smm-route-link" href="https://t.me/PantherTamer" target="_blank" rel="noopener noreferrer">Command Panel by GGG</a></div>
      <div class="smm-subtitle">v${escapeHtml(VERSION)} · fetch-based data collector</div>
      <div class="smm-tabs" id="smm-tabs">
        <button type="button" class="smm-tab active" data-tab="incomings">Входящие</button>
        <button type="button" class="smm-tab" data-tab="plan">План</button>
        <button type="button" class="smm-tab" data-tab="hub">Хаб</button>
        <button type="button" class="smm-tab" data-tab="tribe">Племя</button>
        <button type="button" class="smm-tab" data-tab="favorites">Избранное</button>
        <button type="button" class="smm-tab" data-tab="archive">Статистика</button>
      </div>
    </div>
    <div class="smm-actions">
      <button type="button" class="smm-btn" id="smm-refresh">Обновить</button>
      <button type="button" class="smm-btn" id="smm-settings">Настройки</button>
      <button type="button" class="smm-btn" id="smm-close">Закрыть</button>
    </div>
  </header>
  <div class="smm-body">
    <div class="smm-list" id="smm-incomings-list"></div>
  </div>
  <footer class="smm-footer">
    <div class="smm-footer-main">
      <div class="smm-status" id="smm-status">Ready</div>
      <div class="smm-meta" id="smm-meta"></div>
      <div class="smm-progress" id="smm-progress" hidden>
        <div class="smm-progress-track"><div class="smm-progress-bar" id="smm-progress-bar"></div></div>
        <div class="smm-progress-text" id="smm-progress-text"></div>
      </div>
    </div>
    <div class="smm-status" id="smm-updated"></div>
  </footer>
  <div class="smm-hub-dialog-backdrop" id="smm-hub-dialog" hidden>
    <div class="smm-hub-dialog-card" role="dialog" aria-modal="true" aria-labelledby="smm-hub-dialog-title">
      <div class="smm-hub-dialog-head">
        <div class="smm-hub-dialog-title" id="smm-hub-dialog-title">Хаб: подключение</div>
        <button type="button" class="smm-hub-dialog-close" id="smm-hub-dialog-close">×</button>
      </div>
      <label class="smm-hub-dialog-label" for="smm-hub-address">Адрес хаба</label>
      <input class="smm-hub-dialog-input" id="smm-hub-address" type="text" placeholder="${escapeHtml(
        HUB_URL_PLACEHOLDER,
      )}">
      <div class="smm-hub-dialog-actions">
        <button type="button" class="smm-btn" id="smm-hub-dialog-connect">Подключиться</button>
      </div>
    </div>
  </div>
  <div class="smm-settings-dialog-backdrop" id="smm-settings-dialog" hidden>
    <div class="smm-settings-dialog-card" role="dialog" aria-modal="true" aria-labelledby="smm-settings-dialog-title">
      <div class="smm-settings-dialog-head">
        <div class="smm-settings-dialog-title" id="smm-settings-dialog-title">Настройки</div>
        <button type="button" class="smm-hub-dialog-close" id="smm-settings-dialog-close">×</button>
      </div>
      <div class="smm-settings-list">
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="hideHubDuplicatesByCoordTime">
          <span>не отображать хаб если время и кора совподают с входящими</span>
        </label>
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="hideHubSliceIncomings">
          <span>не отображать в входящих срезы из хаба</span>
        </label>
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="hideHubMassIncomings">
          <span>не отображать в входящих масс из хаба</span>
        </label>
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="exchangeTribeAttacks">
          <span>обмен племенными атаками</span>
        </label>
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="checkSliceConflicts">
          <span>проверка на уже идущие срезы</span>
        </label>
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="favoritesEnabled">
          <span>работа с избранными</span>
        </label>
        <label class="smm-settings-item">
          <input type="checkbox" data-setting-key="plannerCommentEnabled">
          <span>комментарий в планер</span>
        </label>
        <label class="smm-settings-item" data-setting-wrap="loadPlanFromHub">
          <input type="checkbox" data-setting-key="loadPlanFromHub">
          <span>грузить план из хаба</span>
        </label>
        <label class="smm-settings-item smm-settings-item-inline" data-setting-wrap="forceSigilPercent">
          <span class="smm-settings-inline-title">
            <input type="checkbox" data-setting-key="forceSigilEnabled">
            принудительный сигил (%)
          </span>
          <input id="smm-force-sigil-input" class="smm-settings-number-input" type="number" min="0" max="100" step="0.1" inputmode="decimal" placeholder="напр. 17">
        </label>
        <label class="smm-settings-item smm-settings-item-inline" data-setting-wrap="hubPollIntervalMs">
          <span class="smm-settings-inline-title">частота опроса сервера (сек)</span>
          <input id="smm-hub-poll-interval-input" class="smm-settings-number-input" type="number" min="3" max="120" step="1" inputmode="numeric">
        </label>
        <label class="smm-settings-item smm-settings-item-inline" data-setting-wrap="nearestSliceWindowMs">
          <span class="smm-settings-inline-title">длинна окна для ближайших срезов (мин)</span>
          <input id="smm-nearest-slice-window-input" class="smm-settings-number-input" type="number" min="1" max="720" step="1" inputmode="numeric">
        </label>
        <button type="button" class="smm-btn smm-settings-reset-hidden-btn" id="smm-reset-hidden-incomings">Показать все скрытые атаки</button>
      </div>
    </div>
  </div>
</section>`;

    document.body.appendChild(root);
    if (isMobileUi()) {
      root.classList.add("smm-mobile");
    }

    return {
      root,
      meta: root.querySelector("#smm-meta"),
      list: root.querySelector("#smm-incomings-list"),
      status: root.querySelector("#smm-status"),
      updated: root.querySelector("#smm-updated"),
      progress: root.querySelector("#smm-progress"),
      progressBar: root.querySelector("#smm-progress-bar"),
      progressText: root.querySelector("#smm-progress-text"),
      tabs: root.querySelector("#smm-tabs"),
      hubDialog: root.querySelector("#smm-hub-dialog"),
      hubAddressInput: root.querySelector("#smm-hub-address"),
      hubDialogConnectButton: root.querySelector("#smm-hub-dialog-connect"),
      hubDialogCloseButton: root.querySelector("#smm-hub-dialog-close"),
      settingsDialog: root.querySelector("#smm-settings-dialog"),
      settingsDialogCloseButton: root.querySelector(
        "#smm-settings-dialog-close",
      ),
      resetHiddenIncomingsButton: root.querySelector(
        "#smm-reset-hidden-incomings",
      ),
      settingsCheckboxes: Array.from(
        root.querySelectorAll(
          "#smm-settings-dialog input[type='checkbox'][data-setting-key]",
        ),
      ),
      settingsForceSigilInput: root.querySelector("#smm-force-sigil-input"),
      settingsHubPollInput: root.querySelector("#smm-hub-poll-interval-input"),
      settingsNearestSliceWindowInput: root.querySelector(
        "#smm-nearest-slice-window-input",
      ),
      refreshButton: root.querySelector("#smm-refresh"),
      settingsButton: root.querySelector("#smm-settings"),
      closeButton: root.querySelector("#smm-close"),
    };
  };

  const applyMobileHeaderActionButtons = (ui) => {
    if (!ui || !ui.root) return;
    const mobile = isMobileUi();
    ui.root.classList.toggle("smm-mobile", mobile);
    const controls = [
      { node: ui.refreshButton, label: "Обновить", icon: "↻" },
      { node: ui.settingsButton, label: "Настройки", icon: "⚙" },
      { node: ui.closeButton, label: "Закрыть", icon: "✕" },
    ];
    controls.forEach((control) => {
      const node = control && control.node;
      if (!node) return;
      if (mobile) {
        node.textContent = control.icon;
        node.classList.add("smm-icon-btn");
        node.setAttribute("title", control.label);
        node.setAttribute("aria-label", control.label);
      } else {
        node.textContent = control.label;
        node.classList.remove("smm-icon-btn");
        node.setAttribute("title", control.label);
        node.removeAttribute("aria-label");
      }
    });
  };

  const formatDateTime = (dateLike) => {
    const parts = getServerWallClockParts(dateLike);
    if (!parts) return "n/a";
    const dd = String(parts.day).padStart(2, "0");
    const mm = String(parts.month).padStart(2, "0");
    const yyyy = String(parts.year);
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}:${ss}`;
  };

  const extractClockFromEtaText = (text) => {
    const match = String(text || "").match(/(\d{1,2}:\d{2}:\d{2})/);
    return match ? match[1] : null;
  };

  const buildEtaDisplayData = (arrivalText, arrivalMs) => {
    const base = cleanText(arrivalText) || "ETA n/a";
    const baseNoTail = base.replace(/[:\s]+$/g, "");
    const baseMsMatch = String(baseNoTail).match(
      /(\d{1,2}:\d{2}:\d{2}):(\d{3})(?!\d)/,
    );
    const hasMsInBase = Boolean(baseMsMatch);
    const msTextFromBase =
      hasMsInBase && baseMsMatch ? String(baseMsMatch[2]) : null;
    const hasMs = Number.isFinite(arrivalMs);
    const msTextFromValue = hasMs
      ? String(Math.max(0, Math.trunc(arrivalMs))).padStart(3, "0")
      : null;
    const msText = msTextFromBase || msTextFromValue || null;
    const display = hasMsInBase ? baseNoTail : msText ? `${baseNoTail}:${msText}` : baseNoTail;
    const clock = extractClockFromEtaText(baseNoTail);
    const copy = clock ? (msText ? `${clock}:${msText}` : clock) : null;
    return { display, copy };
  };

  const copyTextToClipboardSync = (text) => {
    const value = cleanText(text);
    if (!value) return false;
    try {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return Boolean(ok);
    } catch (error) {
      return false;
    }
  };

  const copyTextToClipboard = async (text) => {
    const value = cleanText(text);
    if (!value) return false;
    if (copyTextToClipboardSync(value)) return true;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch (error) {}
    return false;
  };

  const formatDateTimeShort = (dateLike) => {
    const parts = getServerWallClockParts(dateLike);
    if (!parts) return "n/a";
    const dd = String(parts.day).padStart(2, "0");
    const mm = String(parts.month).padStart(2, "0");
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    return `${dd}.${mm} ${hh}:${mi}:${ss}`;
  };
  const formatDateTimeShortWithMs = (dateLike) => {
    const parts = getServerWallClockParts(dateLike);
    if (!parts) return "n/a";
    const dd = String(parts.day).padStart(2, "0");
    const mm = String(parts.month).padStart(2, "0");
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    const ms = String(parts.millisecond).padStart(3, "0");
    return `${dd}.${mm} ${hh}:${mi}:${ss}:${ms}`;
  };

  const formatTimeOnly = (dateLike) => {
    const parts = getServerWallClockParts(dateLike);
    if (!parts) return "n/a";
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    return `${hh}:${mi}:${ss}`;
  };

  const formatTimeWithMs = (dateLike) => {
    const parts = getServerWallClockParts(dateLike);
    if (!parts) return "n/a";
    const hh = String(parts.hour).padStart(2, "0");
    const mi = String(parts.minute).padStart(2, "0");
    const ss = String(parts.second).padStart(2, "0");
    const ms = String(parts.millisecond).padStart(3, "0");
    return `${hh}:${mi}:${ss}:${ms}`;
  };
  const parseClockWithOptionalMsToDayMs = (value) => {
    const match = String(value || "").match(
      /(\d{1,2}):(\d{2}):(\d{2})(?::(\d{1,3}))?/,
    );
    if (!match) return null;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    const ss = Number(match[3]);
    const ms = Number(match[4] || 0);
    if (
      !Number.isFinite(hh) ||
      !Number.isFinite(mm) ||
      !Number.isFinite(ss) ||
      !Number.isFinite(ms) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59 ||
      ss < 0 ||
      ss > 59 ||
      ms < 0 ||
      ms > 999
    ) {
      return null;
    }
    return ((hh * 60 + mm) * 60 + ss) * 1000 + ms;
  };
  const formatDayMsToTimeWithMs = (dayMsRaw) => {
    if (!Number.isFinite(dayMsRaw)) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    const normalized = ((Math.round(dayMsRaw) % dayMs) + dayMs) % dayMs;
    const hh = Math.floor(normalized / 3600000);
    const mm = Math.floor((normalized % 3600000) / 60000);
    const ss = Math.floor((normalized % 60000) / 1000);
    const ms = normalized % 1000;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}:${String(ms).padStart(3, "0")}`;
  };
  const buildNormalizedTimingLabel = ({
    timingType = null,
    timingLabel = null,
    timingStartMs = null,
    timingEndMs = null,
    timingPointMs = null,
    units = null,
  } = {}) => {
    const type = cleanText(timingType);
    const startMs = toFiniteMs(timingStartMs);
    const endMs = toFiniteMs(timingEndMs);
    const pointMs = toFiniteMs(timingPointMs);
    const rawLabel = cleanText(timingLabel);

    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      const fromMs = Math.min(startMs, endMs);
      const toMs = Math.max(startMs, endMs);
      return `${formatTimeWithMs(fromMs)}-${formatTimeWithMs(toMs)}`;
    }
    if (type === "intercept_window" && Number.isFinite(pointMs)) {
      const fromMs = pointMs;
      const toMs = pointMs + getInterceptWindowAfterMs(units);
      return `${formatTimeWithMs(fromMs)}-${formatTimeWithMs(toMs)}`;
    }
    if (type === "intercept_point" && Number.isFinite(pointMs)) {
      const fromMs = pointMs;
      const toMs = pointMs + 50;
      return `${formatTimeWithMs(fromMs)}-${formatTimeWithMs(toMs)}`;
    }
    if (rawLabel) {
      const plusMatch = rawLabel.match(
        /(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)\s*\(\+\s*(\d{1,4})\s*мс\)/i,
      );
      if (plusMatch) {
        const baseMs = parseClockWithOptionalMsToDayMs(plusMatch[1]);
        const deltaMs = Number(plusMatch[2]);
        if (Number.isFinite(baseMs) && Number.isFinite(deltaMs)) {
          return `${formatDayMsToTimeWithMs(baseMs)}-${formatDayMsToTimeWithMs(baseMs + deltaMs)}`;
        }
      }
      return rawLabel;
    }
    if (Number.isFinite(startMs)) return formatTimeWithMs(startMs);
    if (Number.isFinite(endMs)) return formatTimeWithMs(endMs);
    if (Number.isFinite(pointMs)) return formatTimeWithMs(pointMs);
    return "—";
  };
  const computeTimingCenterCopyValue = (timing) => {
    const source = timing && typeof timing === "object" ? timing : {};
    const startMs = toFiniteMs(source.timingStartMs);
    const endMs = toFiniteMs(source.timingEndMs);
    const pointMs = toFiniteMs(source.timingPointMs);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      let start = startMs;
      let end = endMs;
      if (end < start) {
        end += 24 * 60 * 60 * 1000;
      }
      return formatTimeWithMs(Math.round((start + end) / 2));
    }
    if (Number.isFinite(pointMs)) return formatTimeWithMs(pointMs);
    if (Number.isFinite(startMs)) return formatTimeWithMs(startMs);
    if (Number.isFinite(endMs)) return formatTimeWithMs(endMs);

    const label = cleanText(source.timingLabel);
    if (!label || label === "—") return null;
    const rangeMatch = label.match(
      /(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)\s*-\s*(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)/,
    );
    if (rangeMatch) {
      const startDayMs = parseClockWithOptionalMsToDayMs(rangeMatch[1]);
      const endDayMs = parseClockWithOptionalMsToDayMs(rangeMatch[2]);
      if (Number.isFinite(startDayMs) && Number.isFinite(endDayMs)) {
        let start = startDayMs;
        let end = endDayMs;
        if (end < start) {
          end += 24 * 60 * 60 * 1000;
        }
        return formatDayMsToTimeWithMs((start + end) / 2);
      }
    }
    const pointMatch = label.match(/(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)/);
    if (!pointMatch) return null;
    const pointDayMs = parseClockWithOptionalMsToDayMs(pointMatch[1]);
    return Number.isFinite(pointDayMs)
      ? formatDayMsToTimeWithMs(pointDayMs)
      : null;
  };

  const buildEpochMsFromDayMsNearAnchor = (dayMsRaw, anchorMsRaw) => {
    const dayMs = Number(dayMsRaw);
    if (!Number.isFinite(dayMs)) return null;
    const anchorMs = toFiniteEpochMs(anchorMsRaw) || getServerNowMs();
    const anchorParts = getServerWallClockParts(anchorMs);
    if (!anchorParts) return null;
    const normalized = ((Math.round(dayMs) % DAY_MS) + DAY_MS) % DAY_MS;
    const hh = Math.floor(normalized / 3600000);
    const mm = Math.floor((normalized % 3600000) / 60000);
    const ss = Math.floor((normalized % 60000) / 1000);
    const ms = normalized % 1000;
    let epochMs = buildServerEpochMs(
      anchorParts.year,
      anchorParts.month,
      anchorParts.day,
      hh,
      mm,
      ss,
      ms,
    );
    while (epochMs - anchorMs > DAY_MS / 2) epochMs -= DAY_MS;
    while (anchorMs - epochMs > DAY_MS / 2) epochMs += DAY_MS;
    return epochMs;
  };

  const normalizeManualTimingInput = (inputRaw, commandRaw = null) => {
    const input = cleanText(inputRaw);
    if (!input || input === "—") {
      return {
        timingType: null,
        timingLabel: null,
        timingGapMs: null,
        timingStartMs: null,
        timingEndMs: null,
        timingPointMs: null,
      };
    }
    const command =
      commandRaw && typeof commandRaw === "object" ? commandRaw : {};
    const anchorMs =
      toFiniteEpochMs(command.incomingEtaMs) ||
      toFiniteEpochMs(command.departureMs) ||
      getServerNowMs();
    const rangeMatch = input.match(
      /(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)\s*[-–—]\s*(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)/,
    );
    if (rangeMatch) {
      const startDayMs = parseClockWithOptionalMsToDayMs(rangeMatch[1]);
      const endDayMs = parseClockWithOptionalMsToDayMs(rangeMatch[2]);
      let startMs = buildEpochMsFromDayMsNearAnchor(startDayMs, anchorMs);
      let endMs = buildEpochMsFromDayMsNearAnchor(endDayMs, anchorMs);
      if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
        if (endMs < startMs) endMs += DAY_MS;
        let centerMs = Math.round((startMs + endMs) / 2);
        while (centerMs - anchorMs > DAY_MS / 2) {
          startMs -= DAY_MS;
          endMs -= DAY_MS;
          centerMs -= DAY_MS;
        }
        while (anchorMs - centerMs > DAY_MS / 2) {
          startMs += DAY_MS;
          endMs += DAY_MS;
          centerMs += DAY_MS;
        }
        return {
          timingType: "manual",
          timingLabel: `${formatTimeWithMs(startMs)}-${formatTimeWithMs(endMs)}`,
          timingGapMs: null,
          timingStartMs: startMs,
          timingEndMs: endMs,
          timingPointMs: Math.round((startMs + endMs) / 2),
        };
      }
    }
    const pointMatch = input.match(/(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)/);
    if (pointMatch) {
      const pointDayMs = parseClockWithOptionalMsToDayMs(pointMatch[1]);
      const pointMs = buildEpochMsFromDayMsNearAnchor(pointDayMs, anchorMs);
      if (Number.isFinite(pointMs)) {
        return {
          timingType: "manual",
          timingLabel: formatTimeWithMs(pointMs),
          timingGapMs: null,
          timingStartMs: pointMs,
          timingEndMs: pointMs,
          timingPointMs: pointMs,
        };
      }
    }
    return {
      timingType: "manual",
      timingLabel: input,
      timingGapMs: null,
      timingStartMs: null,
      timingEndMs: null,
      timingPointMs: null,
    };
  };

  const formatDurationWithMs = (durationMs) => {
    if (!Number.isFinite(durationMs)) return "n/a";
    const totalMs = Math.max(0, Math.round(durationMs));
    const totalSeconds = Math.floor(totalMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const ms = totalMs % 1000;
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}:${String(
      ms,
    ).padStart(3, "0")}`;
  };

  const normalizeCoordKey = (value) => {
    const coord = parseCoord(value);
    return coord ? coord.key : cleanText(value);
  };

  const getIncomingTypeKey = (incoming) =>
    cleanText(
      incoming && (incoming.displayType || incoming.commandType || "other"),
    ) || "other";

  const getIncomingSizeClass = (incoming) => {
    const source = String(
      [
        getIncomingTypeKey(incoming),
        cleanText(incoming && incoming.kindText) || "",
        cleanText(incoming && incoming.commandLabel) || "",
        cleanText(incoming && incoming.commandIcon) || "",
      ].join(" "),
    ).toLowerCase();

    if (
      /\bsmall\b|small|небольш|1-1000|attack_small|support_small/.test(source)
    ) {
      return "small";
    }
    if (
      /\bmedium\b|средн|1001-5000|attack_medium|support_medium/.test(source)
    ) {
      return "medium";
    }
    if (/\blarge\b|больш|5001|attack_large|support_large/.test(source)) {
      return "large";
    }
    return "normal";
  };

  const getIncomingThreatType = (incoming) => {
    const commandType = cleanText(incoming && incoming.commandType);
    if (commandType === "attack_large" || commandType === "attack_medium") {
      return commandType;
    }

    const sizeClass = getIncomingSizeClass(incoming);
    if (sizeClass === "large") return "attack_large";
    if (sizeClass === "medium") return "attack_medium";

    const nobleByFlag = Boolean(incoming && incoming.hasNoble);
    const nobleByText = /(?:дворян|snob)/i.test(
      `${cleanText(incoming && incoming.commandLabel) || ""} ${cleanText(incoming && incoming.kindText) || ""}`,
    );
    if (nobleByFlag || nobleByText) {
      return "attack_large";
    }

    return null;
  };
  const isNobleIncomingThreat = (incoming) =>
    Boolean(
      (incoming && incoming.hasNoble) ||
        /(?:дворян|snob)/i.test(
          `${cleanText(incoming && incoming.commandLabel) || ""} ${
            cleanText(incoming && incoming.kindText) || ""
          }`,
        ),
    );
  const getIncomingKnownSizeClass = (incoming) => {
    const explicit = cleanText(incoming && incoming.sizeClass);
    if (explicit && /^(small|medium|large)$/i.test(explicit)) {
      return explicit.toLowerCase();
    }
    const detected = getIncomingSizeClass(incoming);
    return /^(small|medium|large)$/i.test(String(detected || ""))
      ? detected
      : null;
  };
  const buildNobleOrderByTargetMap = (itemsRaw) => {
    const items = Array.isArray(itemsRaw) ? itemsRaw : [];
    const grouped = new Map();
    items.forEach((item) => {
      if (!item || !isNobleIncomingThreat(item)) return;
      const targetKey = normalizeCoordKey(item.targetCoord || item.target);
      if (!targetKey) return;
      if (!grouped.has(targetKey)) grouped.set(targetKey, []);
      grouped.get(targetKey).push(item);
    });
    const orderMap = new WeakMap();
    grouped.forEach((list) => {
      list
        .slice()
        .sort((left, right) => {
          const leftEta = toFiniteEpochMs(
            left && (left.etaEpochMs || left.arrivalEpochMs),
          );
          const rightEta = toFiniteEpochMs(
            right && (right.etaEpochMs || right.arrivalEpochMs),
          );
          if (
            Number.isFinite(leftEta) &&
            Number.isFinite(rightEta) &&
            leftEta !== rightEta
          ) {
            return leftEta - rightEta;
          }
          return String(cleanText(left && left.id) || "").localeCompare(
            String(cleanText(right && right.id) || ""),
          );
        })
        .forEach((item, index) => {
          orderMap.set(item, index + 1);
        });
    });
    return orderMap;
  };
  const formatNobleOrderLabel = (orderRaw) => {
    const order = toInt(orderRaw);
    if (!Number.isFinite(order) || order <= 0) return null;
    return `${order}-й двор`;
  };
  const calcNearestSliceCommandEquivalent = (unitsRaw) => {
    const units = unitsRaw && typeof unitsRaw === "object" ? unitsRaw : {};
    const spear = Math.max(0, toInt(units.spear) || 0);
    const sword = Math.max(0, toInt(units.sword) || 0);
    const heavy = Math.max(0, toInt(units.heavy) || 0);
    const light = Math.max(0, toInt(units.light) || 0);
    const axe = Math.max(0, toInt(units.axe) || 0);
    const ram = Math.max(0, toInt(units.ram) || 0);
    const catapult = Math.max(0, toInt(units.catapult) || 0);
    return Math.max(
      0,
      spear + sword + heavy * 4 + light + axe * 0.25 + ram + catapult * 2,
    );
  };
  const buildNearestSliceCommandArrivalsByTarget = (overviewCommandsDump) => {
    const byTarget = new Map();
    const items =
      overviewCommandsDump && Array.isArray(overviewCommandsDump.items)
        ? overviewCommandsDump.items
        : [];
    items.forEach((item) => {
      const type = cleanText(item && item.type);
      if (!type || (type !== "attack" && type !== "support")) return;
      const targetKey = normalizeCoordKey(
        item &&
          (item.routeToCoord ||
            item.targetCoord ||
            item.target ||
            item.toCoord),
      );
      const etaMs = toFiniteEpochMs(item && item.etaEpochMs);
      if (!targetKey || !Number.isFinite(etaMs)) return;
      const equivalent = calcNearestSliceCommandEquivalent(item && item.units);
      if (!(equivalent > 0)) return;
      if (!byTarget.has(targetKey)) byTarget.set(targetKey, []);
      byTarget.get(targetKey).push({
        etaMs,
        equivalent: Math.round(equivalent),
      });
    });
    byTarget.forEach((arrivals) => arrivals.sort((a, b) => a.etaMs - b.etaMs));
    return byTarget;
  };
  const getNearestSliceExistingEquivalentBeforeEta = (
    commandArrivalsByTarget,
    targetKey,
    etaMs,
    windowMs = NEAREST_SLICE_DUPLICATE_WINDOW_MS,
  ) => {
    if (!commandArrivalsByTarget || !targetKey || !Number.isFinite(etaMs))
      return 0;
    const arrivals = commandArrivalsByTarget.get(targetKey) || [];
    if (!arrivals.length) return 0;
    const startMs =
      etaMs - Math.max(1, toInt(windowMs) || NEAREST_SLICE_DUPLICATE_WINDOW_MS);
    let total = 0;
    arrivals.forEach((arrival) => {
      const arrivalEtaMs = Number(arrival && arrival.etaMs);
      if (!Number.isFinite(arrivalEtaMs)) return;
      if (arrivalEtaMs < startMs || arrivalEtaMs > etaMs) return;
      total += Math.max(0, Number(arrival && arrival.equivalent) || 0);
    });
    return Math.max(0, Math.round(total));
  };
  const resolveNearestSliceIncomingMeta = (incoming, nobleOrderMap) => {
    if (!incoming || !isNobleIncomingThreat(incoming)) {
      return { include: false, reason: "not_noble" };
    }
    const sizeClass = getIncomingKnownSizeClass(incoming);
    const nobleOrder =
      nobleOrderMap instanceof WeakMap
        ? toInt(nobleOrderMap.get(incoming))
        : null;
    if (sizeClass === "large") {
      return { include: false, reason: "large", sizeClass, nobleOrder };
    }
    if (sizeClass === "small" || sizeClass === "medium") {
      const contextLabel =
        sizeClass === "small" ? "малый двор" : "средний двор";
      return {
        include: true,
        reason: "tower_size",
        sizeClass,
        nobleOrder,
        contextLabel,
      };
    }
    if (Number.isFinite(nobleOrder) && nobleOrder >= 2) {
      return {
        include: true,
        reason: "noble_order",
        sizeClass: null,
        nobleOrder,
        contextLabel: formatNobleOrderLabel(nobleOrder) || "двор",
      };
    }
    return {
      include: false,
      reason: "early_unknown_noble",
      sizeClass: null,
      nobleOrder,
    };
  };
  const getTribeTimelineEntryNature = (item) => {
    const source = String(
      [
        cleanText(item && item.tribeCommandNature) || "",
        cleanText(item && item.kindText) || "",
        cleanText(item && item.commandType) || "",
        cleanText(item && item.commandLabel) || "",
        cleanText(item && item.displayType) || "",
      ].join(" "),
    ).toLowerCase();
    if (/(?:return|возврат|обратно)/i.test(source)) return "return";
    if (/(?:support|подкреп|поддерж|def|задеф|slice|срез)/i.test(source))
      return "support";
    if (/(?:attack|атака|перехват|intercept)/i.test(source)) return "attack";
    return "other";
  };
  const isTribeSliceTimingByNobles = (etaMs, nobleEtas) => {
    if (
      !Number.isFinite(etaMs) ||
      !Array.isArray(nobleEtas) ||
      !nobleEtas.length
    )
      return false;
    const minWindowMs = Math.max(
      1,
      toInt(NEAREST_SLICE_DUPLICATE_WINDOW_MS) || 100,
    );
    const firstEta = Number(nobleEtas[0]);
    if (
      Number.isFinite(firstEta) &&
      etaMs < firstEta &&
      firstEta - etaMs >= minWindowMs
    ) {
      return true;
    }
    for (let index = 0; index < nobleEtas.length - 1; index += 1) {
      const left = Number(nobleEtas[index]);
      const right = Number(nobleEtas[index + 1]);
      if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
      if (right - left < minWindowMs) continue;
      if (etaMs > left && etaMs < right) return true;
    }
    return false;
  };
  const isTribeInterceptTimingByNobles = (etaMs, nobleEtas) => {
    if (
      !Number.isFinite(etaMs) ||
      !Array.isArray(nobleEtas) ||
      !nobleEtas.length
    )
      return false;
    const firstEta = Number(nobleEtas[0]);
    return Number.isFinite(firstEta) && etaMs > firstEta;
  };
  const buildFilteredTribeTimelineItems = ({
    attacks = [],
    commands = [],
    plans = [],
  } = {}) => {
    const attackItems = Array.isArray(attacks) ? attacks.filter(Boolean) : [];
    const commandItems = Array.isArray(commands)
      ? commands.filter(Boolean)
      : [];
    const planItems = Array.isArray(plans) ? plans.filter(Boolean) : [];
    const nobleEtasByTarget = new Map();
    attackItems.forEach((item) => {
      if (!item || !isNobleIncomingThreat(item)) return;
      const targetKey = normalizeCoordKey(item.targetCoord || item.target);
      const etaMs = toFiniteEpochMs(item.etaEpochMs || item.arrivalEpochMs);
      if (!targetKey || !Number.isFinite(etaMs)) return;
      if (!nobleEtasByTarget.has(targetKey))
        nobleEtasByTarget.set(targetKey, []);
      nobleEtasByTarget.get(targetKey).push(Math.round(etaMs));
    });
    if (!nobleEtasByTarget.size) {
      return attackItems.slice().sort((left, right) => {
        const leftEta = toFiniteEpochMs(
          left && (left.etaEpochMs || left.arrivalEpochMs),
        );
        const rightEta = toFiniteEpochMs(
          right && (right.etaEpochMs || right.arrivalEpochMs),
        );
        if (
          Number.isFinite(leftEta) &&
          Number.isFinite(rightEta) &&
          leftEta !== rightEta
        ) {
          return leftEta - rightEta;
        }
        return String(cleanText(left && left.id) || "").localeCompare(
          String(cleanText(right && right.id) || ""),
        );
      });
    }
    nobleEtasByTarget.forEach((etas) =>
      etas.sort((left, right) => left - right),
    );
    const hasNoblesTargets = new Set(nobleEtasByTarget.keys());

    const filteredAttackItems = attackItems.slice();

    const filterTribeReadOnlyItems = (items) =>
      (Array.isArray(items) ? items : []).filter((item) => {
        const targetKey = normalizeCoordKey(
          item && (item.targetCoord || item.target),
        );
        if (!targetKey || !hasNoblesTargets.has(targetKey)) return false;
        const etaMs = toFiniteEpochMs(
          item && (item.etaEpochMs || item.arrivalEpochMs),
        );
        if (!Number.isFinite(etaMs)) return false;
        const nobleEtas = nobleEtasByTarget.get(targetKey) || [];
        const nature = getTribeTimelineEntryNature(item);
        if (nature === "support") {
          return isTribeSliceTimingByNobles(etaMs, nobleEtas);
        }
        if (nature === "attack") {
          return isTribeInterceptTimingByNobles(etaMs, nobleEtas);
        }
        return false;
      });

    const filteredCommandItems = filterTribeReadOnlyItems(commandItems);
    const filteredPlanItems = filterTribeReadOnlyItems(planItems);

    return filteredAttackItems
      .concat(filteredCommandItems)
      .concat(filteredPlanItems)
      .sort((left, right) => {
        const leftEta = toFiniteEpochMs(
          left && (left.etaEpochMs || left.arrivalEpochMs),
        );
        const rightEta = toFiniteEpochMs(
          right && (right.etaEpochMs || right.arrivalEpochMs),
        );
        if (
          Number.isFinite(leftEta) &&
          Number.isFinite(rightEta) &&
          leftEta !== rightEta
        ) {
          return leftEta - rightEta;
        }
        return String(cleanText(left && left.id) || "").localeCompare(
          String(cleanText(right && right.id) || ""),
        );
      });
  };
  const getSliceTableDisplayUnits = () =>
    normalizeUnitsForWorld(
      [
        ...getGameDataUnits(),
        ...(Array.isArray(state.troops && state.troops.units)
          ? state.troops.units
          : []),
        ...UNIT_RENDER_ORDER,
      ],
      state.speedModel,
    );
  const buildNearestSliceRowsData = ({ source = "incomings" } = {}) => {
    const nowMs = getServerNowMs();
    const lookaheadMs = getNearestSliceWindowMs();
    const lookaheadMinutes = Math.max(
      1,
      Math.round(lookaheadMs / (60 * 1000)),
    );
    const untilMs = nowMs + lookaheadMs;
    const commandArrivalsByTarget = buildNearestSliceCommandArrivalsByTarget(
      state.overviewCommandsDump,
    );
    if (source === "favorites") {
      loadFavoriteEntries();
    }
    const sourceItemsRaw =
      source === "tribe"
        ? Array.isArray(state.hubTribeIncomings)
          ? state.hubTribeIncomings
          : []
        : source === "favorites"
          ? getFavoriteIncomingItems()
        : getIncomingItems();
    const applyHiddenFilters = source !== "favorites";
    const sourceItems = sourceItemsRaw.filter((item) => {
      if (!item) return false;
      if (!applyHiddenFilters) return true;
      // В "Ближайших срезах" учитываем только видимые (не скрытые) атаки.
      return !isIncomingHidden(item) && !isIncomingInHiddenVillageGroup(item);
    });
    const favoriteSigilByIncomingId = new Map();
    if (source === "favorites") {
      const favoriteEntries = Array.isArray(state.favoritesEntries)
        ? state.favoritesEntries
            .map((entry) => normalizeFavoriteEntry(entry))
            .filter(Boolean)
        : [];
      favoriteEntries.forEach((entry) => {
        const sigil = getIncomingSigilPercent(entry && entry.incoming);
        if (!Number.isFinite(sigil)) return;
        const favoriteId = cleanText(entry && entry.id);
        const sourceIncomingId = cleanText(entry && entry.sourceIncomingId);
        if (favoriteId) {
          favoriteSigilByIncomingId.set(
            favoriteId,
            normalizeSigilPercent(sigil),
          );
        }
        if (sourceIncomingId) {
          favoriteSigilByIncomingId.set(
            sourceIncomingId,
            normalizeSigilPercent(sigil),
          );
        }
      });
    }
    const nobleOrderMap = buildNobleOrderByTargetMap(sourceItems);
    const rows = [];
    let eligibleIncomingCount = 0;

    sourceItems.forEach((incoming) => {
      let meta = resolveNearestSliceIncomingMeta(incoming, nobleOrderMap);
      // Для вкладки "Избранное" пользователь вручную выбрал цели:
      // если это дворянин, не отфильтровываем его как "первый неизвестный двор".
      if (
        source === "favorites" &&
        (!meta || !meta.include) &&
        isNobleIncomingThreat(incoming)
      ) {
        const nobleOrder =
          nobleOrderMap instanceof WeakMap
            ? toInt(nobleOrderMap.get(incoming))
            : null;
        meta = {
          include: true,
          reason: "favorite_manual",
          sizeClass: getIncomingKnownSizeClass(incoming),
          nobleOrder,
          contextLabel:
            formatNobleOrderLabel(nobleOrder) ||
            cleanText(getIncomingKnownSizeClass(incoming)) ||
            "двор",
        };
      }
      if (!meta.include) return;
      const incomingEtaMs = toFiniteEpochMs(
        incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
      );
      const targetKey = normalizeCoordKey(
        incoming && (incoming.targetCoord || incoming.target),
      );
      const existingEquivalent = getNearestSliceExistingEquivalentBeforeEta(
        commandArrivalsByTarget,
        targetKey,
        incomingEtaMs,
        NEAREST_SLICE_DUPLICATE_WINDOW_MS,
      );
      const equivalentThreshold =
        meta && meta.sizeClass === "small"
          ? NEAREST_SLICE_EQ_THRESHOLD_SMALL
          : !cleanText(meta && meta.sizeClass)
            ? NEAREST_SLICE_EQ_THRESHOLD_UNKNOWN
            : NEAREST_SLICE_EQ_THRESHOLD_DEFAULT;
      // Для "Избранного" не режем по дубликатам: это ручной приоритетный список.
      if (source !== "favorites" && existingEquivalent >= equivalentThreshold)
        return;
      eligibleIncomingCount += 1;
      const incomingIdKey = cleanText(incoming && incoming.id);
      const sourceIncomingIdKey = cleanText(incoming && incoming.sourceIncomingId);
      const favoriteSigil = favoriteSigilByIncomingId.size
        ? [incomingIdKey, sourceIncomingIdKey]
            .map((key) =>
              key && favoriteSigilByIncomingId.has(key)
                ? favoriteSigilByIncomingId.get(key)
                : null,
            )
            .find((value) => Number.isFinite(Number(value)))
        : null;
      if (Number.isFinite(Number(favoriteSigil))) {
        incoming.sigilPercent = normalizeSigilPercent(Number(favoriteSigil));
      }
      const explicitSigilPercent =
        Number.isFinite(Number(favoriteSigil)) &&
        normalizeSigilPercent(Number(favoriteSigil)) > 0
          ? Number(favoriteSigil)
          : undefined;
      const defaultSigilPercent = resolveSigilPercentForAction(
        "slice",
        incoming,
        explicitSigilPercent,
      );
      const villagePlan = buildIncomingVillagePlans(incoming, {
        action: "slice",
        sigilPercent: defaultSigilPercent,
      });
      if (
        !villagePlan ||
        !Array.isArray(villagePlan.rows) ||
        !villagePlan.rows.length
      )
        return;
      const timingCenter = computeTimingCenterCopyValue(
        buildTimingPayload({
          action: "slice",
          incomingId: incoming.id,
          targetCoord: incoming.targetCoord || incoming.target || "",
          incomingEtaMs: toFiniteEpochMs(
            incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
          ),
        }),
      );
      villagePlan.rows.forEach((row) => {
        const departureMs = Number(
          row &&
            (Number.isFinite(Number(row.sortDepartureMs))
              ? row.sortDepartureMs
              : row.bestDepartureMs),
        );
        if (!Number.isFinite(departureMs)) return;
        if (departureMs < nowMs || departureMs > untilMs) return;
        rows.push({
          incoming,
          row,
          meta,
          defaultSigilPercent,
          timingCenter: cleanText(timingCenter) || null,
          favoriteComment: cleanText(
            incoming && incoming.favoriteComment,
          ) || null,
        });
      });
    });

    rows.sort((left, right) => {
      const leftDeparture = Number(
        left && left.row && left.row.bestDepartureMs,
      );
      const rightDeparture = Number(
        right && right.row && right.row.bestDepartureMs,
      );
      if (
        Number.isFinite(leftDeparture) &&
        Number.isFinite(rightDeparture) &&
        leftDeparture !== rightDeparture
      ) {
        return leftDeparture - rightDeparture;
      }
      const leftEta = Number(left && left.incoming && left.incoming.etaEpochMs);
      const rightEta = Number(
        right && right.incoming && right.incoming.etaEpochMs,
      );
      if (
        Number.isFinite(leftEta) &&
        Number.isFinite(rightEta) &&
        leftEta !== rightEta
      ) {
        return leftEta - rightEta;
      }
      return String(
        cleanText(left && left.incoming && left.incoming.id) || "",
      ).localeCompare(
        String(cleanText(right && right.incoming && right.incoming.id) || ""),
      );
    });

    return {
      source,
      nowMs,
      untilMs,
      lookaheadMs,
      lookaheadMinutes,
      sourceItemsCount: sourceItems.length,
      eligibleIncomingCount,
      rows,
    };
  };

  const getLargeAttackNeedPerType = (largeCount) => {
    const count = Math.max(1, toInt(largeCount) || 1);
    if (count <= 1) return 14000;
    if (count === 2) return 19000;
    if (count === 3) return 23000;
    if (count === 4) return 28000;
    return 28000 + (count - 4) * 5000;
  };
  const getLargeAttackNeedCardUnits = (largeCount) => {
    const count = Math.max(1, toInt(largeCount) || 1);
    if (count <= 1) return 20000;
    return 20000 + (count - 1) * 5000;
  };

  const toSafeTroopCount = (troops, unit) =>
    Math.max(0, toInt(troops && troops[unit]) || 0);

  const calcVillageDefenseEquivalent = (troops) => {
    const spear = toSafeTroopCount(troops, "spear");
    const sword = toSafeTroopCount(troops, "sword");
    const archer = toSafeTroopCount(troops, "archer");
    const heavy = toSafeTroopCount(troops, "heavy");
    const infantryEquivalent =
      spear * DEFENSE_EQ_WEIGHTS.spear +
      sword * DEFENSE_EQ_WEIGHTS.sword +
      archer * DEFENSE_EQ_WEIGHTS.archer;
    const heavyWeight = infantryEquivalent > 0 ? DEFENSE_EQ_WEIGHTS.heavy : 5.1;
    const heavyEquivalent = heavy * heavyWeight;
    return Math.max(0, Math.round(infantryEquivalent + heavyEquivalent));
  };

  const calcVillageDefenseCardUnits = (troops) => {
    const spear = toSafeTroopCount(troops, "spear");
    const sword = toSafeTroopCount(troops, "sword");
    const archer = toSafeTroopCount(troops, "archer");
    const heavy = toSafeTroopCount(troops, "heavy");
    const total =
      spear * DEFENSE_CARD_UNIT_WEIGHTS.spear +
      sword * DEFENSE_CARD_UNIT_WEIGHTS.sword +
      archer * DEFENSE_CARD_UNIT_WEIGHTS.archer +
      heavy * DEFENSE_CARD_UNIT_WEIGHTS.heavy;
    return Math.max(0, Math.round(total));
  };

  const calcDefenseEquivalentFromUnitsByWeights = (units, weights) => {
    const source = units && typeof units === "object" ? units : {};
    return Object.entries(weights || {}).reduce((sum, [unit, weight]) => {
      const count = Math.max(0, toInt(source[unit]) || 0);
      const safeWeight = Number.isFinite(Number(weight)) ? Number(weight) : 0;
      return sum + count * safeWeight;
    }, 0);
  };

  const buildOwnCommandDefenseArrivalsByTarget = (overviewCommandsDump) => {
    const byTarget = new Map();
    const items =
      overviewCommandsDump && Array.isArray(overviewCommandsDump.items)
        ? overviewCommandsDump.items
        : [];
    items.forEach((item) => {
      const type = cleanText(item && item.type);
      if (!type || !DEFENSE_COMMAND_TYPES.has(type)) return;
      const targetKey = normalizeCoordKey(
        item &&
          (item.routeToCoord ||
            item.targetCoord ||
            item.target ||
            item.fromVillageCoord),
      );
      const etaMs = Number(item && item.etaEpochMs);
      if (!targetKey || !Number.isFinite(etaMs)) return;
      const units =
        item && item.units && typeof item.units === "object" ? item.units : {};
      const equivalent = calcDefenseEquivalentFromUnitsByWeights(
        units,
        DEFENSE_EQ_WEIGHTS,
      );
      const cardUnits = calcDefenseEquivalentFromUnitsByWeights(
        units,
        DEFENSE_CARD_UNIT_WEIGHTS,
      );
      if (equivalent <= 0 && cardUnits <= 0) return;
      if (!byTarget.has(targetKey)) byTarget.set(targetKey, []);
      byTarget.get(targetKey).push({
        id: cleanText(item && item.id) || null,
        etaMs,
        equivalent: Math.max(0, Math.round(equivalent)),
        cardUnits: Math.max(0, Math.round(cardUnits)),
      });
    });
    byTarget.forEach((arrivals) => arrivals.sort((a, b) => a.etaMs - b.etaMs));
    return byTarget;
  };

  const getOwnCommandDefenseUntilEta = (commandsByTarget, targetKey, etaMs) => {
    if (!commandsByTarget || !targetKey || !Number.isFinite(etaMs)) {
      return { equivalent: 0, cardUnits: 0 };
    }
    const arrivals = commandsByTarget.get(targetKey) || [];
    let equivalent = 0;
    let cardUnits = 0;
    arrivals.forEach((arrival) => {
      if (arrival.etaMs <= etaMs) {
        equivalent += Number(arrival.equivalent) || 0;
        cardUnits += Number(arrival.cardUnits) || 0;
      }
    });
    return {
      equivalent: Math.max(0, Math.round(equivalent)),
      cardUnits: Math.max(0, Math.round(cardUnits)),
    };
  };

  const buildVillageDefenseIndex = (troopsModel) => {
    const byCoord = new Map();
    const byVillageId = new Map();
    const byOwnerCoord = new Map();
    const byCoordCardUnits = new Map();
    const byVillageIdCardUnits = new Map();
    const byOwnerCoordCardUnits = new Map();
    const setMaxMapValue = (map, key, value) => {
      if (!map || !key || !Number.isFinite(Number(value))) return;
      const next = Math.max(0, Math.round(Number(value)));
      const current = Number(map.get(key) || 0);
      if (next > current) {
        map.set(key, next);
      } else if (!map.has(key)) {
        map.set(key, current);
      }
    };
    const villages =
      troopsModel && Array.isArray(troopsModel.villages)
        ? troopsModel.villages
        : [];
    villages.forEach((village) => {
      const inVillageTroops =
        village && village.troops && typeof village.troops === "object"
          ? village.troops
          : {};
      const fallbackDefenseTroops =
        village &&
        village.troopsDefense &&
        typeof village.troopsDefense === "object"
          ? village.troopsDefense
          : {};
      const hasInVillage = Object.values(
        inVillageTroops && typeof inVillageTroops === "object"
          ? inVillageTroops
          : {},
      ).some((value) => Math.max(0, toInt(value) || 0) > 0);
      const baseTroops = hasInVillage ? inVillageTroops : fallbackDefenseTroops;
      // Подкрас берём из "в деревне"; fallback на defense только если "в деревне" пусто/не распарсилось.
      const equivalent = calcVillageDefenseEquivalent(baseTroops);
      const cardUnits = calcVillageDefenseCardUnits(baseTroops);
      const coordKey = normalizeCoordKey(
        village && (village.villageCoord || village.villageName),
      );
      const villageId = toInt(village && village.villageId);
      const ownerNickNorm = String(
        cleanText(
          village && (village.ownerNick || village.nick || village.playerName),
        ) || "",
      )
        .trim()
        .toLowerCase();
      if (coordKey) {
        setMaxMapValue(byCoord, coordKey, equivalent);
        setMaxMapValue(byCoordCardUnits, coordKey, cardUnits);
      }
      if (coordKey && ownerNickNorm) {
        const ownerCoordKey = `${ownerNickNorm}|${coordKey}`;
        setMaxMapValue(byOwnerCoord, ownerCoordKey, equivalent);
        setMaxMapValue(byOwnerCoordCardUnits, ownerCoordKey, cardUnits);
      }
      if (Number.isFinite(villageId)) {
        setMaxMapValue(byVillageId, villageId, equivalent);
        setMaxMapValue(byVillageIdCardUnits, villageId, cardUnits);
      }
    });
    return {
      byCoord,
      byVillageId,
      byOwnerCoord,
      byCoordCardUnits,
      byVillageIdCardUnits,
      byOwnerCoordCardUnits,
    };
  };

  const detectSupportUnit = (incoming) => {
    const supportUnits =
      incoming &&
      incoming.supportUnits &&
      typeof incoming.supportUnits === "object"
        ? incoming.supportUnits
        : null;
    if (supportUnits) {
      const dominantUnit = getDominantSupportUnit(supportUnits);
      if (dominantUnit) return dominantUnit.toLowerCase();
    }

    const byGuess = cleanText(incoming && incoming.guessedUnit);
    if (byGuess) return byGuess.toLowerCase();

    const detected =
      incoming && Array.isArray(incoming.detectedUnits)
        ? incoming.detectedUnits
        : [];
    for (const unit of detected) {
      const normalized = cleanText(unit);
      if (normalized) return normalized.toLowerCase();
    }

    const byText = detectUnitFromText(
      `${cleanText(incoming && incoming.commandLabel) || ""} ${cleanText(incoming && incoming.kindText) || ""}`,
    );
    return byText ? String(byText).toLowerCase() : null;
  };

  const estimateSupportEquivalent = (incoming) => {
    if (
      incoming &&
      incoming.supportUnits &&
      typeof incoming.supportUnits === "object"
    ) {
      const weighted = Object.entries(incoming.supportUnits).reduce(
        (sum, [unit, count]) => {
          const safeUnit = String(unit || "").toLowerCase();
          const safeCount = Math.max(0, toInt(count) || 0);
          if (!safeUnit || safeCount <= 0) return sum;
          const weight = Number.isFinite(SUPPORT_UNIT_EQ_WEIGHT[safeUnit])
            ? SUPPORT_UNIT_EQ_WEIGHT[safeUnit]
            : 1;
          return sum + safeCount * weight;
        },
        0,
      );
      if (weighted > 0) {
        return Math.max(0, Math.round(weighted));
      }
    }

    const unit = detectSupportUnit(incoming);
    const exactCount = Math.max(
      0,
      toInt(incoming && incoming.supportUnitCount) || 0,
    );
    if (exactCount > 0) {
      const unitWeight =
        unit && Number.isFinite(SUPPORT_UNIT_EQ_WEIGHT[unit])
          ? SUPPORT_UNIT_EQ_WEIGHT[unit]
          : 1;
      return Math.max(0, Math.round(exactCount * unitWeight));
    }

    const base =
      unit && SUPPORT_EQ_BASE_BY_UNIT[unit]
        ? SUPPORT_EQ_BASE_BY_UNIT[unit]
        : 2200;
    const sizeClass = getIncomingSizeClass(incoming);
    const sizeMultiplier =
      SUPPORT_EQ_SIZE_MULTIPLIER[sizeClass] ||
      SUPPORT_EQ_SIZE_MULTIPLIER.normal;
    const richnessMultiplier =
      incoming &&
      Array.isArray(incoming.detectedUnits) &&
      incoming.detectedUnits.length > 1
        ? 1.12
        : 1;
    return Math.max(0, Math.round(base * sizeMultiplier * richnessMultiplier));
  };

  const buildSupportArrivalsByTarget = (supportIncomings) => {
    const byTarget = new Map();
    const items =
      supportIncomings && Array.isArray(supportIncomings.items)
        ? supportIncomings.items
        : [];

    items.forEach((item) => {
      const targetKey = normalizeCoordKey(
        item && (item.targetCoord || item.target),
      );
      const etaMs = Number(item && item.etaEpochMs);
      if (!targetKey || !Number.isFinite(etaMs)) return;
      const equivalent = estimateSupportEquivalent(item);
      if (!equivalent) return;
      if (!byTarget.has(targetKey)) byTarget.set(targetKey, []);
      byTarget.get(targetKey).push({
        id: cleanText(item.id),
        etaMs,
        equivalent,
      });
    });

    byTarget.forEach((arrivals) => arrivals.sort((a, b) => a.etaMs - b.etaMs));
    return byTarget;
  };

  const getSupportEquivalentUntilEta = (supportMap, targetKey, etaMs) => {
    if (!supportMap || !targetKey || !Number.isFinite(etaMs)) return 0;
    const arrivals = supportMap.get(targetKey) || [];
    let total = 0;
    arrivals.forEach((arrival) => {
      if (arrival.etaMs <= etaMs) total += arrival.equivalent;
    });
    return total;
  };

  const buildIncomingDefenseAssessmentMap = ({
    incomings,
    troops,
    supportIncomings,
    overviewCommands,
  }) => {
    const assessment = new Map();
    const items =
      incomings && Array.isArray(incomings.items) ? incomings.items : [];
    if (!items.length) return assessment;
    const villages =
      troops && Array.isArray(troops.villages) ? troops.villages : [];
    if (!villages.length) return assessment;

    const villageDefenseIndex = buildVillageDefenseIndex(troops);
    const supportByTarget = buildSupportArrivalsByTarget(supportIncomings);
    const ownCommandByTarget =
      buildOwnCommandDefenseArrivalsByTarget(overviewCommands);
    const largeByTarget = new Map();

    items.forEach((item) => {
      const threatType = getIncomingThreatType(item);
      const isNobleThreat = isNobleIncomingThreat(item);
      if (threatType !== "attack_large" && !isNobleThreat) return;
      const targetKey = normalizeCoordKey(
        item && (item.targetCoord || item.target),
      );
      if (!targetKey) return;
      largeByTarget.set(targetKey, (largeByTarget.get(targetKey) || 0) + 1);
    });

    items.forEach((item) => {
      const threatType = getIncomingThreatType(item);
      const isNobleThreat = isNobleIncomingThreat(item);
      if (
        threatType !== "attack_medium" &&
        threatType !== "attack_large" &&
        !isNobleThreat
      )
        return;
      const targetKey = normalizeCoordKey(
        item && (item.targetCoord || item.target),
      );
      const targetVillageId = toInt(item && item.targetVillageId);
      const targetOwnerNorm = String(
        cleanText(
          item && (item.ownerNick || item.sourceNick || item.targetOwnerNick),
        ) || "",
      )
        .trim()
        .toLowerCase();
      const id = cleanText(item && item.id);
      const etaMs = Number(item && item.etaEpochMs);
      if (
        (!targetKey && !Number.isFinite(targetVillageId)) ||
        !id ||
        !Number.isFinite(etaMs)
      ) {
        return;
      }

      let requiredEquivalent = 0;
      if (threatType === "attack_medium" && !isNobleThreat) {
        requiredEquivalent = 6000 * 2;
      } else {
        const largeCount = largeByTarget.get(targetKey) || 1;
        requiredEquivalent = getLargeAttackNeedPerType(largeCount) * 2;
      }

      const hasByCoord = targetKey
        ? villageDefenseIndex.byCoord.has(targetKey)
        : false;
      const ownerCoordKey =
        targetOwnerNorm && targetKey ? `${targetOwnerNorm}|${targetKey}` : null;
      const hasByOwnerCoord = ownerCoordKey
        ? villageDefenseIndex.byOwnerCoord.has(ownerCoordKey)
        : false;
      const hasByVillageId = Number.isFinite(targetVillageId)
        ? villageDefenseIndex.byVillageId.has(targetVillageId)
        : false;
      const hasOwnVillageMatch =
        hasByOwnerCoord || hasByCoord || hasByVillageId;
      if (!hasOwnVillageMatch) {
        return;
      }

      let baseEquivalent = ownerCoordKey
        ? villageDefenseIndex.byOwnerCoord.get(ownerCoordKey) || 0
        : 0;
      if (!baseEquivalent && targetKey) {
        baseEquivalent = villageDefenseIndex.byCoord.get(targetKey) || 0;
      }
      if (!baseEquivalent && Number.isFinite(targetVillageId)) {
        baseEquivalent =
          villageDefenseIndex.byVillageId.get(targetVillageId) || 0;
      }
      let baseCardUnits = ownerCoordKey
        ? villageDefenseIndex.byOwnerCoordCardUnits.get(ownerCoordKey) || 0
        : 0;
      if (!baseCardUnits && targetKey) {
        baseCardUnits =
          villageDefenseIndex.byCoordCardUnits.get(targetKey) || 0;
      }
      if (!baseCardUnits && Number.isFinite(targetVillageId)) {
        baseCardUnits =
          villageDefenseIndex.byVillageIdCardUnits.get(targetVillageId) || 0;
      }
      const supportEquivalent = getSupportEquivalentUntilEta(
        supportByTarget,
        targetKey,
        etaMs,
      );
      const ownCommandDefense = getOwnCommandDefenseUntilEta(
        ownCommandByTarget,
        targetKey,
        etaMs,
      );
      const commandEquivalent = Number(ownCommandDefense.equivalent) || 0;
      const commandCardUnits = Number(ownCommandDefense.cardUnits) || 0;
      let availableEquivalent =
        baseEquivalent + supportEquivalent + commandEquivalent;
      // Для крупных атак подсветка по пользовательскому правилу:
      // 20к+ "карточных" юнитов (в деревне + приказы, успевающие до ETA) = OK.
      if (threatType === "attack_large" || isNobleThreat) {
        const largeCount = largeByTarget.get(targetKey) || 1;
        requiredEquivalent = getLargeAttackNeedCardUnits(largeCount);
        availableEquivalent = Math.max(0, baseCardUnits + commandCardUnits);
      }
      const status = availableEquivalent >= requiredEquivalent ? "ok" : "low";

      assessment.set(id, {
        status,
        hasOwnVillageMatch,
        baseEquivalent,
        baseCardUnits,
        supportEquivalent,
        commandEquivalent,
        commandCardUnits,
        availableEquivalent,
        requiredEquivalent,
      });
    });

    return assessment;
  };

  const buildTimingPayload = ({
    action,
    incomingId,
    targetCoord,
    incomingEtaMs,
    units = null,
  }) => {
    const actionKey = cleanText(action) || "slice";
    const incomingItems = getIncomingItems();
    const incoming =
      cleanText(incomingId) && Array.isArray(incomingItems)
        ? incomingItems.find((item) => String(item.id) === String(incomingId))
        : null;
    const etaMsFromIncoming = toFiniteEpochMs(
      incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
    );
    const etaMsFromParam = toFiniteEpochMs(incomingEtaMs);
    const etaMs = Number.isFinite(etaMsFromIncoming)
      ? etaMsFromIncoming
      : etaMsFromParam;
    if (!Number.isFinite(etaMs)) {
      return {
        timingType: "none",
        timingLabel: "—",
      };
    }

    const effectiveTarget = normalizeCoordKey(
      targetCoord ||
        (incoming ? incoming.targetCoord || incoming.target : null),
    );

    if (actionKey === "intercept") {
      const timingPointMs = etaMs;
      const timingStartMs = timingPointMs;
      const timingEndMs = timingPointMs + getInterceptWindowAfterMs(units);
      return {
        timingType: "intercept_window",
        timingStartMs,
        timingEndMs,
        timingPointMs,
        timingLabel: `${formatTimeWithMs(timingStartMs)}-${formatTimeWithMs(timingEndMs)}`,
      };
    }

    if (actionKey === "slice") {
      let gapMs = null;
      if (effectiveTarget && Array.isArray(incomingItems)) {
        const previousEtaMs = incomingItems
          .filter((item) => {
            if (String(item.id) === String(incomingId)) return false;
            const targetKey = normalizeCoordKey(
              item.targetCoord || item.target,
            );
            const itemEtaMs = toFiniteEpochMs(
              item.etaEpochMs || item.arrivalEpochMs,
            );
            return (
              targetKey &&
              targetKey === effectiveTarget &&
              Number.isFinite(itemEtaMs) &&
              itemEtaMs < etaMs
            );
          })
          .map((item) =>
            toFiniteEpochMs(item.etaEpochMs || item.arrivalEpochMs),
          )
          .filter((itemEtaMs) => Number.isFinite(itemEtaMs))
          .sort((a, b) => b - a)[0];
        if (Number.isFinite(previousEtaMs)) gapMs = etaMs - previousEtaMs;
      }

      if (Number.isFinite(gapMs) && gapMs <= 15 * 60 * 1000) {
        const timingStartMs = etaMs - gapMs;
        const timingEndMs = etaMs;
        return {
          timingType: "slice_gap",
          timingGapMs: gapMs,
          timingStartMs,
          timingEndMs,
          timingLabel: `${formatTimeWithMs(timingStartMs)}-${formatTimeWithMs(timingEndMs)}`,
        };
      }

      const timingStartMs = etaMs - 100;
      const timingEndMs = etaMs;
      return {
        timingType: "slice_window",
        timingStartMs,
        timingEndMs,
        timingLabel: `${formatTimeWithMs(timingStartMs)}-${formatTimeWithMs(timingEndMs)}`,
      };
    }

    return {
      timingType: "none",
      timingLabel: "—",
    };
  };
  const getSliceRowTimingCenterCopyValue = (rowElement) => {
    if (!rowElement) return null;
    const action = cleanText(rowElement.getAttribute("data-action")) || "slice";
    const incomingId = cleanText(rowElement.getAttribute("data-incoming-id"));
    const targetCoord = cleanText(rowElement.getAttribute("data-target-coord"));
    const incomingEtaMs = Number(rowElement.getAttribute("data-eta-ms"));
    const selection = collectSliceRowSelection(rowElement);
    const timing = buildTimingPayload({
      action,
      incomingId,
      targetCoord,
      incomingEtaMs,
      units: selection.units,
    });
    return computeTimingCenterCopyValue(timing);
  };

  const getSortedUnitKeys = (troops) =>
    Object.keys(troops || {}).sort((a, b) => {
      const ai = Object.prototype.hasOwnProperty.call(UNIT_ORDER_INDEX, a)
        ? UNIT_ORDER_INDEX[a]
        : Number.MAX_SAFE_INTEGER;
      const bi = Object.prototype.hasOwnProperty.call(UNIT_ORDER_INDEX, b)
        ? UNIT_ORDER_INDEX[b]
        : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });

  const buildIncomingPlanRows = (incoming) => {
    if (!incoming || !state.troops || !Array.isArray(state.troops.villages))
      return [];
    if (!state.speedModel || !state.speedModel.effectiveMinutesPerField)
      return [];

    const targetCoord = parseCoord(incoming.targetCoord || incoming.target);
    const etaEpochMs = toFiniteEpochMs(
      incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
    );
    if (!targetCoord || !Number.isFinite(etaEpochMs)) return [];

    const effective = state.speedModel.effectiveMinutesPerField;
    const nowMs = getServerNow().getTime();
    const reserveMap = buildReservedUnitsMap();
    const rows = [];

    state.troops.villages.forEach((village) => {
      if (isSameVillageAsIncomingTarget(incoming, village)) return;
      const fromCoord = parseCoord(village.villageCoord || village.villageName);
      if (!fromCoord) return;

      const distance = calcDistance(fromCoord, targetCoord);
      if (!Number.isFinite(distance)) return;

      const troops =
        village.troops && typeof village.troops === "object"
          ? village.troops
          : {};
      getSortedUnitKeys(troops).forEach((unit) => {
        if (!isUnitEnabledForCalc(unit)) return;
        if (!isUnitAllowedInWorld(unit, state.speedModel)) return;
        const baseCount = toInt(troops[unit]);
        const reserved = getReservedUnitsCount(reserveMap, village, unit);
        const count = Math.max(
          0,
          (Number.isFinite(baseCount) ? baseCount : 0) - reserved,
        );
        if (!Number.isFinite(count) || count <= 0) return;

        const minutesPerField = Number(effective[unit]);
        if (!Number.isFinite(minutesPerField) || minutesPerField <= 0) return;

        const travelSeconds = Math.round(distance * minutesPerField * 60);
        const departureMs = etaEpochMs - travelSeconds * 1000;
        if (!Number.isFinite(departureMs) || departureMs < nowMs) return;

        rows.push({
          incomingId: incoming.id,
          villageId: village.villageId || null,
          villageName: village.villageName || village.villageCoord || "деревня",
          villageCoord: village.villageCoord || null,
          unit,
          unitLabel: getUnitLabel(unit),
          unitIcon: getUnitIconFallback(unit),
          count,
          distance,
          travelSeconds,
          departureMs,
        });
      });
    });

    rows.sort((a, b) => {
      if (a.departureMs !== b.departureMs) return a.departureMs - b.departureMs;
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.villageName !== b.villageName)
        return a.villageName.localeCompare(b.villageName);
      return a.unit.localeCompare(b.unit);
    });

    return rows;
  };

  const buildIncomingVillagePlans = (incoming, options = {}) => {
    if (!incoming || !state.troops || !Array.isArray(state.troops.villages)) {
      return { rows: [], displayUnits: [] };
    }
    if (!state.speedModel || !state.speedModel.effectiveMinutesPerField) {
      return { rows: [], displayUnits: [] };
    }

    const targetCoord = parseCoord(incoming.targetCoord || incoming.target);
    const etaEpochMs = toFiniteEpochMs(
      incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
    );
    if (!targetCoord || !Number.isFinite(etaEpochMs)) {
      return { rows: [], displayUnits: [] };
    }

    const effective = state.speedModel.effectiveMinutesPerField;
    const action =
      cleanText(options.action) || getPlanAction(incoming.id) || "slice";
    const sigilPercent = resolveSigilPercentForAction(
      action,
      incoming,
      options && options.sigilPercent,
    );
    const sigilFactor = actionUsesSigil(action)
      ? Math.max(0.01, 1 + sigilPercent / 100)
      : 1;
    const nowMs = getServerNow().getTime();
    const reserveMap = buildReservedUnitsMap();
    const rows = [];
    const allUnits = normalizeUnitsForWorld(
      [
        ...getGameDataUnits(),
        ...(Array.isArray(state.troops.units) ? state.troops.units : []),
        ...UNIT_RENDER_ORDER,
      ],
      state.speedModel,
    );

    state.troops.villages.forEach((village, villageIndex) => {
      if (isSameVillageAsIncomingTarget(incoming, village)) return;
      const fromCoord = parseCoord(village.villageCoord || village.villageName);
      if (!fromCoord) return;

      const distance = calcDistance(fromCoord, targetCoord);
      if (!Number.isFinite(distance)) return;

      const troops =
        village.troops && typeof village.troops === "object"
          ? village.troops
          : {};
      const units = {};
      let hasAnyTroops = false;
      const arrivableStates = [];

      allUnits.forEach((unit) => {
        const unitEnabled = isUnitEnabledForCalc(unit);
        const countBase = unitEnabled
          ? Math.max(0, toInt(troops[unit]) || 0)
          : 0;
        const count = Math.max(
          0,
          countBase - getReservedUnitsCount(reserveMap, village, unit),
        );

        if (count > 0) {
          hasAnyTroops = true;
        }

        const minutesPerField = Number(effective[unit]);
        if (
          !unitEnabled ||
          !Number.isFinite(minutesPerField) ||
          minutesPerField <= 0 ||
          count <= 0
        ) {
          units[unit] = {
            unit,
            count,
            canArrive: false,
            travelBaseSeconds: null,
            travelSeconds: null,
            departureMs: null,
          };
          return;
        }

        const travelBaseSeconds = distance * minutesPerField * 60;
        const travelSeconds = Math.max(
          0,
          Math.round(travelBaseSeconds / sigilFactor),
        );
        const departureMs = etaEpochMs - travelSeconds * 1000;
        const canArrive = Number.isFinite(departureMs) && departureMs >= nowMs;

        units[unit] = {
          unit,
          count,
          canArrive,
          travelBaseSeconds,
          travelSeconds,
          departureMs,
        };

        if (canArrive) {
          arrivableStates.push(units[unit]);
        }
      });

      if (!hasAnyTroops || !arrivableStates.length) return;

      const travelProfiles = Array.from(
        new Set(
          arrivableStates
            .map((unitState) =>
              Number.isFinite(unitState.travelBaseSeconds)
                ? Number(unitState.travelBaseSeconds.toFixed(3))
                : null,
            )
            .filter((value) => Number.isFinite(value)),
        ),
      ).sort((a, b) => b - a);

      const villageRowBaseKey = String(
        village.villageId || village.villageCoord || villageIndex,
      );
      travelProfiles.forEach((profileTravelBaseSeconds, profileIndex) => {
        const profileUnits = {};
        let hasProfileUnits = false;
        let bestDepartureMs = null;

        allUnits.forEach((unit) => {
          const unitState = units[unit];
          if (!unitState) return;

          const includeInProfile =
            Boolean(unitState.canArrive) &&
            Math.max(0, toInt(unitState.count) || 0) > 0 &&
            Number.isFinite(unitState.travelBaseSeconds) &&
            unitState.travelBaseSeconds <= profileTravelBaseSeconds + 0.001;

          if (includeInProfile) {
            profileUnits[unit] = {
              ...unitState,
            };
            hasProfileUnits = true;
            const depMs = Number(unitState.departureMs);
            if (
              Number.isFinite(depMs) &&
              (!Number.isFinite(bestDepartureMs) || depMs < bestDepartureMs)
            ) {
              bestDepartureMs = depMs;
            }
          } else {
            profileUnits[unit] = {
              unit,
              count: 0,
              canArrive: false,
              travelBaseSeconds: unitState.travelBaseSeconds,
              travelSeconds: unitState.travelSeconds,
              departureMs: unitState.departureMs,
            };
          }
        });

        if (!hasProfileUnits || !Number.isFinite(bestDepartureMs)) return;
        const knightState = profileUnits.knight;
        const sortDepartureMs =
          action === "slice" &&
          knightState &&
          knightState.canArrive &&
          Math.max(0, toInt(knightState.count) || 0) > 0 &&
          Number.isFinite(Number(knightState.departureMs))
            ? Number(knightState.departureMs)
            : Number(bestDepartureMs);
        rows.push({
          rowKey: `${villageRowBaseKey}_${profileIndex}`,
          villageId: village.villageId || null,
          villageName: village.villageName || village.villageCoord || "деревня",
          villageCoord: village.villageCoord || null,
          distance,
          etaEpochMs,
          bestDepartureMs,
          sortDepartureMs,
          units: profileUnits,
        });
      });
    });

    rows.sort((a, b) => {
      const av = Number.isFinite(a.sortDepartureMs)
        ? a.sortDepartureMs
        : Number.isFinite(a.bestDepartureMs)
          ? a.bestDepartureMs
          : Number.MAX_SAFE_INTEGER;
      const bv = Number.isFinite(b.sortDepartureMs)
        ? b.sortDepartureMs
        : Number.isFinite(b.bestDepartureMs)
          ? b.bestDepartureMs
          : Number.MAX_SAFE_INTEGER;
      if (av !== bv) return av - bv;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return String(a.villageName).localeCompare(String(b.villageName));
    });

    const displayUnits = allUnits;

    return { rows, displayUnits };
  };

  const collectSliceRowSelection = (rowElement) => {
    const units = {};
    let departureMs = null;

    rowElement.querySelectorAll(".smm-slice-input").forEach((input) => {
      const unit = cleanText(input.getAttribute("data-unit"));
      const max = Math.max(0, toInt(input.getAttribute("data-max")) || 0);
      let value = toInt(input.value);
      if (!Number.isFinite(value) || value < 0) value = 0;
      if (value > max) value = max;
      if (String(value) !== String(input.value || ""))
        input.value = String(value);

      if (!unit || input.disabled || value <= 0) return;

      units[unit] = value;

      const dep = Number(input.getAttribute("data-departure-ms"));
      if (Number.isFinite(dep)) {
        if (!Number.isFinite(departureMs) || dep < departureMs)
          departureMs = dep;
      }
    });

    return { units, departureMs };
  };
  const getSliceRowDisplayedDepartureMs = (
    rowElement,
    fallbackDepartureMs = null,
  ) => {
    if (!rowElement)
      return Number.isFinite(Number(fallbackDepartureMs))
        ? Number(fallbackDepartureMs)
        : null;
    const countdownNode = rowElement.querySelector("[data-role='countdown']");
    const countdownDepartureMs = Number(
      countdownNode && countdownNode.getAttribute("data-departure-ms"),
    );
    if (Number.isFinite(countdownDepartureMs)) return countdownDepartureMs;
    const rowDepartureMs = Number(
      rowElement.getAttribute("data-selected-departure-ms"),
    );
    if (Number.isFinite(rowDepartureMs)) return rowDepartureMs;
    const fallback = Number(fallbackDepartureMs);
    return Number.isFinite(fallback) ? fallback : null;
  };

  const syncRowScaleLabel = (rowElement) => {
    const slider = rowElement.querySelector(".smm-row-scale");
    const label = rowElement.querySelector(".smm-row-scale-label");
    if (!slider || !label) return;
    let value = toInt(slider.value);
    if (!Number.isFinite(value)) value = 100;
    value = Math.max(1, Math.min(100, value));
    slider.value = String(value);
    label.textContent = `${value}%`;
  };

  const applyRowScaleToInputs = (rowElement) => {
    const slider = rowElement.querySelector(".smm-row-scale");
    if (!slider) return;
    let scalePercent = toInt(slider.value);
    if (!Number.isFinite(scalePercent)) scalePercent = 100;
    scalePercent = Math.max(1, Math.min(100, scalePercent));
    slider.value = String(scalePercent);
    syncRowScaleLabel(rowElement);

    rowElement.querySelectorAll(".smm-slice-input").forEach((input) => {
      if (input.disabled) {
        input.value = "0";
        return;
      }
      const max = Math.max(0, toInt(input.getAttribute("data-max")) || 0);
      if (max <= 0) {
        input.value = "0";
        return;
      }
      const scaled = Math.floor((max * scalePercent) / 100);
      input.value = String(Math.max(1, scaled));
    });
  };

  const updateSliceRowState = (rowElement) => {
    if (!rowElement) return;
    syncRowScaleLabel(rowElement);
    const departureCell = rowElement.querySelector("[data-role='depart']");
    const countdownNode = rowElement.querySelector("[data-role='countdown']");
    const goButton = rowElement.querySelector(".smm-go-btn");
    const sigilInput = rowElement.querySelector(".smm-sigil-input");

    const villageId = cleanText(rowElement.getAttribute("data-village-id"));
    const targetCoord = cleanText(rowElement.getAttribute("data-target-coord"));
    const action = cleanText(rowElement.getAttribute("data-action")) || "slice";
    const incomingId = cleanText(rowElement.getAttribute("data-incoming-id"));
    const incoming = incomingId ? getIncomingById(incomingId) : null;
    const etaEpochMs = Number(rowElement.getAttribute("data-eta-ms"));
    const nowMs = getServerNow().getTime();

    const rowDefaultSigil = toNumber(
      cleanText(rowElement.getAttribute("data-default-sigil")),
    );
    let sigilPercent = actionUsesSigil(action)
      ? selectPreferredPositiveSigilPercent(
          rowDefaultSigil,
          getIncomingSigilPercent(incoming),
          getForumThreadFirstPostSigilPercent(document),
          resolveSigilPercentForAction(action, incoming, rowDefaultSigil),
        ) || 0
      : 0;
    if (actionUsesSigil(action) && sigilInput) {
      const parsedSigil = toNumber(sigilInput.value);
      sigilPercent =
        selectPreferredPositiveSigilPercent(parsedSigil, sigilPercent) || 0;
      sigilInput.value = String(sigilPercent);
    } else if (sigilInput) {
      sigilInput.value = "0";
    }
    const sigilFactor = actionUsesSigil(action)
      ? Math.max(0.01, 1 + sigilPercent / 100)
      : 1;
    const applyInputTravelState = (input, travelBaseSecondsRaw) => {
      const max = Math.max(0, toInt(input.getAttribute("data-max")) || 0);
      const cell = input.closest(".smm-slice-cell");
      const baseTravelSeconds = Number(travelBaseSecondsRaw);
      if (
        !Number.isFinite(baseTravelSeconds) ||
        max <= 0 ||
        !Number.isFinite(etaEpochMs)
      ) {
        input.disabled = true;
        input.value = "0";
        input.setAttribute("min", "0");
        input.removeAttribute("data-departure-ms");
        if (cell) cell.classList.add("is-blocked");
        return { canArrive: false, departureMs: null };
      }

      const adjustedTravelSeconds = Math.max(
        0,
        Math.round(baseTravelSeconds / sigilFactor),
      );
      const departureMs = etaEpochMs - adjustedTravelSeconds * 1000;
      const canArrive = Number.isFinite(departureMs) && departureMs >= nowMs;

      if (cell) {
        cell.classList.toggle("is-blocked", !canArrive);
      }

      if (canArrive) {
        const wasDisabled = Boolean(input.disabled);
        input.disabled = false;
        input.setAttribute("min", "1");
        input.setAttribute("max", String(max));
        let currentValue = toInt(input.value);
        if (!Number.isFinite(currentValue) || currentValue < 1) {
          currentValue = wasDisabled ? max : 1;
        }
        if (currentValue > max) currentValue = max;
        if (String(currentValue) !== String(input.value || "")) {
          input.value = String(currentValue);
        }
        input.setAttribute("data-departure-ms", String(departureMs));
      } else {
        input.disabled = true;
        input.value = "0";
        input.setAttribute("min", "0");
        input.removeAttribute("data-departure-ms");
      }

      return {
        canArrive,
        departureMs: Number.isFinite(departureMs) ? departureMs : null,
      };
    };

    const unitInputs = Array.from(
      rowElement.querySelectorAll(".smm-slice-input"),
    );
    const inputByUnit = new Map();
    unitInputs.forEach((input) => {
      const unit = cleanText(input.getAttribute("data-unit"));
      if (!unit) return;
      inputByUnit.set(unit, input);
    });

    let knightTravelBaseSeconds = null;
    let knightSelectedForSlice = false;
    if (action === "slice") {
      const knightInput = inputByUnit.get("knight");
      if (knightInput) {
        const knightBaseTravelRaw = Number(
          knightInput.getAttribute("data-base-travel"),
        );
        knightTravelBaseSeconds =
          Number.isFinite(knightBaseTravelRaw) && knightBaseTravelRaw > 0
            ? knightBaseTravelRaw
            : null;
        const knightState = applyInputTravelState(
          knightInput,
          knightTravelBaseSeconds,
        );
        if (knightState.canArrive) {
          knightSelectedForSlice =
            Math.max(0, toInt(knightInput.value) || 0) > 0;
        } else {
          knightSelectedForSlice = false;
        }
      }
    }

    unitInputs.forEach((input) => {
      const unit = cleanText(input.getAttribute("data-unit"));
      if (!unit) return;
      if (action === "slice" && unit === "knight") return;
      const baseTravelRaw = Number(input.getAttribute("data-base-travel"));
      const effectiveTravelBase =
        action === "slice" &&
        knightSelectedForSlice &&
        unit !== "knight" &&
        Number.isFinite(knightTravelBaseSeconds)
          ? knightTravelBaseSeconds
          : baseTravelRaw;
      applyInputTravelState(input, effectiveTravelBase);
    });

    const selection = collectSliceRowSelection(rowElement);
    const units = selection.units || {};
    const departureMs = Number(selection.departureMs);
    const hasUnits = Object.keys(units).length > 0;
    const hasDeparture = Number.isFinite(departureMs);
    if (hasDeparture) {
      rowElement.setAttribute(
        "data-selected-departure-ms",
        String(departureMs),
      );
    } else {
      rowElement.removeAttribute("data-selected-departure-ms");
    }

    if (departureCell) {
      departureCell.textContent = hasDeparture
        ? formatTimeOnly(departureMs)
        : "—";
    }

    if (countdownNode) {
      if (hasDeparture) {
        countdownNode.setAttribute("data-departure-ms", String(departureMs));
        countdownNode.textContent = formatCountdown(
          (departureMs - getServerNow().getTime()) / 1000,
        );
      } else {
        countdownNode.removeAttribute("data-departure-ms");
        countdownNode.textContent = "—";
        countdownNode.classList.remove("late");
      }
    }

    const url =
      hasUnits && hasDeparture
        ? buildPlaceCommandUrl({ fromVillageId: villageId, targetCoord, units })
        : null;

    if (goButton) {
      const timingCenter = getSliceRowTimingCenterCopyValue(rowElement);
      if (url) {
        goButton.disabled = false;
        goButton.classList.remove("disabled");
        goButton.setAttribute("data-url", url);
      } else {
        goButton.disabled = true;
        goButton.classList.add("disabled");
        goButton.removeAttribute("data-url");
      }
      if (timingCenter) {
        goButton.setAttribute("data-copy-time", timingCenter);
      } else {
        goButton.removeAttribute("data-copy-time");
      }
    }
  };

  const applySliceRowFallbackState = (rowElement) => {
    if (!rowElement) return;
    const departureCell = rowElement.querySelector("[data-role='depart']");
    const countdownNode = rowElement.querySelector("[data-role='countdown']");
    const goButton = rowElement.querySelector(".smm-go-btn");
    const sigilInput = rowElement.querySelector(".smm-sigil-input");
    const action = cleanText(rowElement.getAttribute("data-action")) || "slice";
    if (sigilInput && !cleanText(sigilInput.value)) {
      const incomingId = cleanText(rowElement.getAttribute("data-incoming-id"));
      const incoming = incomingId ? getIncomingById(incomingId) : null;
      const rowDefaultSigil = toNumber(
        cleanText(rowElement.getAttribute("data-default-sigil")),
      );
      const defaultSigil = actionUsesSigil(action)
        ? selectPreferredPositiveSigilPercent(
            rowDefaultSigil,
            getIncomingSigilPercent(incoming),
            getForumThreadFirstPostSigilPercent(document),
            resolveSigilPercentForAction(action, incoming, rowDefaultSigil),
          ) || 0
        : 0;
      sigilInput.value = String(normalizeSigilPercent(defaultSigil));
    }
    const selection = collectSliceRowSelection(rowElement);
    const units = selection.units || {};
    let departureMs = Number(
      getSliceRowDisplayedDepartureMs(rowElement, selection.departureMs),
    );
    if (!Number.isFinite(departureMs)) {
      const bestDepartureMs = Number(
        rowElement.getAttribute("data-best-departure-ms"),
      );
      if (Number.isFinite(bestDepartureMs)) departureMs = bestDepartureMs;
    }
    const hasDeparture = Number.isFinite(departureMs);
    if (hasDeparture) {
      rowElement.setAttribute(
        "data-selected-departure-ms",
        String(departureMs),
      );
    } else {
      rowElement.removeAttribute("data-selected-departure-ms");
    }
    if (departureCell) {
      departureCell.textContent = hasDeparture
        ? formatTimeOnly(departureMs)
        : "—";
    }
    if (countdownNode) {
      if (hasDeparture) {
        countdownNode.setAttribute("data-departure-ms", String(departureMs));
        const diffSeconds = (departureMs - getServerNowMs()) / 1000;
        countdownNode.textContent =
          diffSeconds >= 0
            ? formatCountdown(diffSeconds)
            : `-${formatCountdown(Math.abs(diffSeconds))}`;
        countdownNode.classList.toggle("late", diffSeconds < 0);
      } else {
        countdownNode.removeAttribute("data-departure-ms");
        countdownNode.textContent = "—";
        countdownNode.classList.remove("late");
      }
    }
    if (goButton) {
      const villageId = cleanText(rowElement.getAttribute("data-village-id"));
      const targetCoord = cleanText(
        rowElement.getAttribute("data-target-coord"),
      );
      const hasUnits = Object.keys(units).length > 0;
      const url =
        hasUnits && hasDeparture
          ? buildPlaceCommandUrl({
              fromVillageId: villageId,
              targetCoord,
              units,
            })
          : null;
      if (url) {
        goButton.disabled = false;
        goButton.classList.remove("disabled");
        goButton.setAttribute("data-url", url);
      } else {
        goButton.disabled = true;
        goButton.classList.add("disabled");
        goButton.removeAttribute("data-url");
      }
      const timingCenter = getSliceRowTimingCenterCopyValue(rowElement);
      if (timingCenter) {
        goButton.setAttribute("data-copy-time", timingCenter);
      } else {
        goButton.removeAttribute("data-copy-time");
      }
    }
  };

  const initSliceRows = (root) => {
    if (!root) return;
    root.querySelectorAll(".smm-slice-row").forEach((row) => {
      let ok = false;
      try {
        updateSliceRowState(row);
        ok = true;
      } catch (error) {
        console.warn(`${LOG_PREFIX} updateSliceRowState failed`, error);
      }
      if (!ok) {
        applySliceRowFallbackState(row);
        return;
      }
      const departureCell = row.querySelector("[data-role='depart']");
      const countdownNode = row.querySelector("[data-role='countdown']");
      const hasDepartureCellValue =
        departureCell &&
        cleanText(departureCell.textContent) &&
        cleanText(departureCell.textContent) !== "—";
      const hasCountdownAttr = Boolean(
        countdownNode &&
          Number.isFinite(
            Number(countdownNode.getAttribute("data-departure-ms")),
          ),
      );
      if (!hasDepartureCellValue || !hasCountdownAttr) {
        applySliceRowFallbackState(row);
      }
    });
  };

  const renderSimplePlanPanel = (incoming, actionLabel) => {
    const rows = buildIncomingPlanRows(incoming);
    const nowMs = getServerNow().getTime();

    if (!Number.isFinite(incoming.etaEpochMs)) {
      return `
<section class="smm-plan-panel">
  <div class="smm-plan-head">
    <span>${escapeHtml(actionLabel)} · #${escapeHtml(incoming.id)}</span>
    <span>ETA не распознан</span>
  </div>
  <div class="smm-plan-empty">Нельзя посчитать выходы: на странице нет корректного таймера прибытия.</div>
</section>`;
    }

    if (!rows.length) {
      return `
<section class="smm-plan-panel">
  <div class="smm-plan-head">
    <span>${escapeHtml(actionLabel)} · #${escapeHtml(incoming.id)}</span>
    <span>0 вариантов</span>
  </div>
  <div class="smm-plan-empty">Нет доступных войск, которые успевают к этой атаке.</div>
</section>`;
    }

    const rowsHtml = rows
      .map((row) => {
        const iconHtml = row.unitIcon
          ? `<img class="smm-unit-icon" src="${escapeHtml(row.unitIcon)}" alt="${escapeHtml(
              row.unit,
            )}">`
          : "";
        const villageText = row.villageCoord || row.villageName;
        const initialCountdown = formatCountdown(
          (row.departureMs - nowMs) / 1000,
        );
        return `
<div class="smm-plan-row">
  <div class="smm-plan-left">
    <span class="smm-plan-unit">${iconHtml}${escapeHtml(row.unitLabel)}</span>
    <span class="smm-plan-count">x${escapeHtml(row.count)}</span>
    <span class="smm-plan-village">${escapeHtml(villageText)}</span>
  </div>
  <div class="smm-plan-right">
    <span class="smm-plan-dist">${escapeHtml(row.distance.toFixed(1))} пол.</span>
    <span class="smm-plan-depart">${escapeHtml(formatDateTimeShort(row.departureMs))}</span>
    <span class="smm-plan-countdown" data-departure-ms="${escapeHtml(
      row.departureMs,
    )}">${escapeHtml(initialCountdown)}</span>
  </div>
</div>`;
      })
      .join("");

    return `
<section class="smm-plan-panel">
  <div class="smm-plan-head">
    <span>${escapeHtml(actionLabel)} · #${escapeHtml(incoming.id)}</span>
    <span>${escapeHtml(rows.length)} вариантов</span>
  </div>
  <div class="smm-plan-body">${rowsHtml}</div>
</section>`;
  };

  const renderSlicePlanPanel = (
    incoming,
    action,
    actionLabel,
    options = {},
  ) => {
    const renderGroupSelectInHeader =
      options.renderGroupSelectInHeader !== false;
    const groupSelectHtml = renderGroupSelectInHeader
      ? buildVillageGroupSelectHtml(getSelectedVillageGroupId(), {
          className: "smm-calc-group-select",
          withLabel: false,
        })
      : "";
    const renderHeadRight = (valueHtml) =>
      renderGroupSelectInHeader
        ? `<span class="smm-plan-head-right">${groupSelectHtml}<span>${valueHtml}</span></span>`
        : `<span>${valueHtml}</span>`;
    const incomingEtaEpochMs = toFiniteEpochMs(
      incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
    );
    const etaValid = Number.isFinite(incomingEtaEpochMs);
    if (!etaValid) {
      return `
<section class="smm-plan-panel smm-slice-panel">
  <div class="smm-plan-head">
    <span>${escapeHtml(actionLabel)} · #${escapeHtml(incoming.id)}</span>
    ${renderHeadRight("ETA не распознан")}
  </div>
  <div class="smm-plan-empty">Нельзя посчитать срез: на странице нет корректного ETA.</div>
</section>`;
    }

    const explicitOptionSigil = toNumber(options && options.sigilPercent);
    const defaultSigilPercent = actionUsesSigil(action)
      ? selectPreferredPositiveSigilPercent(
          explicitOptionSigil,
          getIncomingSigilPercent(incoming),
          getForumThreadFirstPostSigilPercent(document),
          resolveSigilPercentForAction(action, incoming, explicitOptionSigil),
        ) || 0
      : 0;
    const villagePlan = buildIncomingVillagePlans(incoming, {
      action,
      sigilPercent: defaultSigilPercent,
    });
    if (!villagePlan.rows.length || !villagePlan.displayUnits.length) {
      return `
<section class="smm-plan-panel smm-slice-panel">
  <div class="smm-plan-head">
    <span>${escapeHtml(actionLabel)} · #${escapeHtml(incoming.id)}</span>
    ${renderHeadRight("0 вариантов")}
  </div>
  <div class="smm-plan-empty">Нет деревень с войсками, которые успевают на срез.</div>
</section>`;
    }

    const showSigilColumn = actionUsesSigil(action);
    const panelTimingCenter = computeTimingCenterCopyValue(
      buildTimingPayload({
        action,
        incomingId: incoming.id,
        targetCoord: incoming.targetCoord || incoming.target || "",
        incomingEtaMs: incomingEtaEpochMs,
      }),
    );
    const villageHeaderLabel = isMobileUi() ? "дер." : "Деревня";
    const unitHeader = villagePlan.displayUnits
      .map((unit) => {
        const icon = getUnitIconFallback(unit);
        const disabled = isUnitDisabledForCalc(unit);
        return `<th title="${escapeHtml(getUnitLabel(unit))}"><button type="button" class="smm-unit-toggle${
          disabled ? " is-disabled" : ""
        }" data-unit-toggle="1" data-unit="${escapeHtml(unit)}" title="${escapeHtml(
          `${getUnitLabel(unit)} · ${disabled ? "выключен" : "включен"}`,
        )}">${
          icon
            ? `<img class="smm-unit-icon" src="${escapeHtml(icon)}" alt="${escapeHtml(unit)}">`
            : escapeHtml(getUnitLabel(unit))
        }</button></th>`;
      })
      .join("");

    const bodyRows = villagePlan.rows
      .map((row, rowIndex) => {
        const villageText = row.villageCoord || row.villageName || "деревня";
        const arrivalMs = Number(
          Number.isFinite(Number(row && row.etaEpochMs))
            ? row.etaEpochMs
            : incomingEtaEpochMs,
        );
        const unitCells = villagePlan.displayUnits
          .map((unit) => {
            const unitState = row.units[unit];
            if (!unitState) {
              return `<td class="smm-slice-cell is-empty">—</td>`;
            }

            const max = Math.max(0, unitState.count || 0);
            if (max <= 0) {
              return `<td class="smm-slice-cell is-empty">—</td>`;
            }
            const canArrive = Boolean(unitState.canArrive);
            const value = canArrive ? max : 0;
            const depMs =
              canArrive && Number.isFinite(unitState.departureMs)
                ? unitState.departureMs
                : "";
            const baseTravelSeconds =
              Number.isFinite(unitState.travelBaseSeconds) &&
              unitState.travelBaseSeconds > 0
                ? Number(unitState.travelBaseSeconds.toFixed(3))
                : "";

            return `<td class="smm-slice-cell${canArrive ? "" : " is-blocked"}">
  <input class="smm-slice-input" type="number" min="${canArrive ? "1" : "0"}" step="1" max="${escapeHtml(
    max,
  )}" value="${escapeHtml(value)}" data-unit="${escapeHtml(unit)}" data-max="${escapeHtml(
    max,
  )}" data-base-travel="${escapeHtml(baseTravelSeconds)}" data-departure-ms="${escapeHtml(
    depMs,
  )}"${canArrive ? "" : " disabled"}>
  <span class="smm-slice-avail">макс ${escapeHtml(max)}</span>
</td>`;
          })
          .join("");

        return `<tr class="smm-slice-row" data-row-key="${escapeHtml(
          `${incoming.id}_${row.rowKey || rowIndex}`,
        )}" data-incoming-id="${escapeHtml(incoming.id || "")}" data-village-id="${escapeHtml(
          row.villageId || "",
        )}" data-village-coord="${escapeHtml(villageText)}" data-target-coord="${escapeHtml(
          incoming.targetCoord || incoming.target || "",
        )}" data-eta-ms="${escapeHtml(row.etaEpochMs || incoming.etaEpochMs || "")}" data-best-departure-ms="${escapeHtml(
          row.bestDepartureMs || "",
        )}" data-selected-departure-ms="${escapeHtml(
          row.bestDepartureMs || "",
        )}" data-action="${escapeHtml(
          action || "slice",
        )}" data-default-sigil="${escapeHtml(defaultSigilPercent)}">
  <td class="smm-slice-village">
    <span class="smm-village-coord">${escapeHtml(villageText)}</span>
    <span class="smm-row-scale-wrap">
      <input class="smm-row-scale" type="range" min="1" max="100" step="1" value="100">
      <span class="smm-row-scale-label">100%</span>
    </span>
  </td>
  ${unitCells}
  ${
    showSigilColumn
      ? `<td class="smm-sigil-cell"><input class="smm-sigil-input" type="number" min="0" max="100" step="0.1" value="${escapeHtml(
          defaultSigilPercent,
        )}"></td>`
      : ""
  }
  <td class="smm-slice-depart" data-role="depart">${escapeHtml(
    Number.isFinite(Number(row.bestDepartureMs))
      ? formatTimeOnly(row.bestDepartureMs)
      : "—",
  )}</td>
  <td class="smm-slice-arrive">${escapeHtml(
    Number.isFinite(arrivalMs) ? formatTimeWithMs(arrivalMs) : "—",
  )}</td>
  <td class="smm-slice-timer"><span class="smm-plan-countdown" data-role="countdown"${
    Number.isFinite(Number(row.bestDepartureMs))
      ? ` data-departure-ms="${escapeHtml(row.bestDepartureMs)}"`
      : ""
  }>${escapeHtml(
    Number.isFinite(Number(row.bestDepartureMs))
      ? formatCountdown((Number(row.bestDepartureMs) - getServerNowMs()) / 1000)
      : "—",
  )}</span></td>
  <td class="smm-slice-action">
    <div class="smm-slice-action-wrap">
      <button type="button" class="smm-go-btn" title="Перейти" data-copy-time="${escapeHtml(
        panelTimingCenter || "",
      )}">Перейти</button>
      <button type="button" class="smm-go-btn smm-schedule-btn" title="Запланировать">Запланировать</button>
    </div>
  </td>
</tr>`;
      })
      .join("");

    return `
<section class="smm-plan-panel smm-slice-panel">
  <div class="smm-plan-head">
    <span>${escapeHtml(actionLabel)} · #${escapeHtml(incoming.id)}</span>
    ${renderHeadRight(`${escapeHtml(villagePlan.rows.length)} вариантов`)}
  </div>
  <div class="smm-slice-scroll">
    <table class="smm-slice-table">
      <thead>
        <tr>
          <th>${escapeHtml(villageHeaderLabel)}</th>
          ${unitHeader}
          ${showSigilColumn ? "<th>Сиг</th>" : ""}
          <th>Выход</th>
          <th>Приход</th>
          <th>Таймер</th>
          <th>Приказ</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
</section>`;
  };

  const renderPlanPanel = (incoming) => {
    const action = getPlanAction(incoming.id);
    const actionLabel = action ? PLAN_ACTION_LABELS[action] : "План";
    return renderSlicePlanPanel(incoming, action || "slice", actionLabel);
  };

  const renderMeta = (ui, snapshot) => {
    if (!ui || !snapshot) return;

    const parts = [];
    parts.push(`Мир: ${snapshot.world || "n/a"}`);
    parts.push(
      `Экран: ${snapshot.screen || "n/a"}${snapshot.mode ? `/${snapshot.mode}` : ""}`,
    );
    parts.push(
      `Входящих атак: ${snapshot.incomings ? snapshot.incomings.count : 0}`,
    );
    parts.push(
      `Деревень с войсками: ${snapshot.troops ? snapshot.troops.count : 0}`,
    );
    parts.push(`Приказов: ${snapshot.commands ? snapshot.commands.count : 0}`);

    if (snapshot.speedModel) {
      parts.push(
        `Скорость: ${snapshot.speedModel.worldSpeed ?? "?"} × ${snapshot.speedModel.unitSpeed ?? "?"}`,
      );
    } else {
      parts.push("Скорость: n/a");
    }

    parts.push(
      `Сиг: ${Number.isFinite(snapshot.sigilPercent) ? snapshot.sigilPercent : 0}%`,
    );
    ui.meta.textContent = parts.join(" · ");
  };

  const getIncomingItems = () =>
    state.incomings && Array.isArray(state.incomings.items)
      ? state.incomings.items
      : [];

  const upsertIncomingItem = (incoming) => {
    if (!incoming || typeof incoming !== "object") return false;
    const incomingId = cleanText(incoming.id);
    if (!incomingId) return false;
    if (!state.incomings || !Array.isArray(state.incomings.items)) {
      state.incomings = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: location.href,
        count: 0,
        items: [],
      };
    }
    const items = Array.isArray(state.incomings.items)
      ? state.incomings.items
      : [];
    const existingIndex = items.findIndex(
      (item) => String(item && item.id) === String(incomingId),
    );
    if (existingIndex >= 0) {
      items[existingIndex] = incoming;
    } else {
      items.push(incoming);
    }
    items.sort((a, b) => {
      const av = Number(a && a.arrivalEpochMs);
      const bv = Number(b && b.arrivalEpochMs);
      if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
        return av - bv;
      return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
    });
    state.incomings.items = items;
    state.incomings.count = items.length;
    state.incomings.fetchedAt = new Date(getServerNowMs()).toISOString();
    state.incomings.sourceUrl = location.href;
    return true;
  };

  const resolveTimingForScheduledCommand = (command) => {
    if (!command || typeof command !== "object") {
      return { timingType: "none", timingLabel: "—" };
    }
    const existingLabel = cleanText(command.timingLabel);
    if (cleanText(command.timingType) === "manual" && existingLabel) {
      return {
        timingType: "manual",
        timingLabel: existingLabel,
        timingGapMs: Number(command.timingGapMs),
        timingStartMs: Number(command.timingStartMs),
        timingEndMs: Number(command.timingEndMs),
        timingPointMs: Number(command.timingPointMs),
      };
    }
    const recalculated = buildTimingPayload({
      action: command.action,
      incomingId: command.incomingId,
      targetCoord: command.targetCoord,
      incomingEtaMs: command.incomingEtaMs,
      units: command.units,
    });
    if (
      recalculated &&
      cleanText(recalculated.timingType) &&
      recalculated.timingType !== "none"
    ) {
      return recalculated;
    }
    if (existingLabel) {
      return {
        timingType: cleanText(command.timingType) || "manual",
        timingLabel: existingLabel,
        timingGapMs: Number(command.timingGapMs),
        timingStartMs: Number(command.timingStartMs),
        timingEndMs: Number(command.timingEndMs),
        timingPointMs: Number(command.timingPointMs),
      };
    }
    return (
      recalculated || {
        timingType: "none",
        timingLabel: "—",
      }
    );
  };
  const safeResolveTimingForScheduledCommand = (command) =>
    safe(
      () => resolveTimingForScheduledCommand(command),
      {
        timingType: cleanText(command && command.timingType) || "none",
        timingLabel: cleanText(command && command.timingLabel) || "—",
        timingGapMs: toFiniteMs(command && command.timingGapMs),
        timingStartMs: toFiniteMs(command && command.timingStartMs),
        timingEndMs: toFiniteMs(command && command.timingEndMs),
        timingPointMs: toFiniteMs(command && command.timingPointMs),
      },
    ) || { timingType: "none", timingLabel: "—" };
  const safeComputeTimingCenterCopyValue = (timing) =>
    safe(() => computeTimingCenterCopyValue(timing), null);

  const renderTopTabs = (ui) => {
    if (!ui || !ui.tabs) return;
    const favoritesEnabled = Boolean(getUiSetting("favoritesEnabled"));
    if (!favoritesEnabled && state.activeTab === "favorites") {
      setActiveTab("incomings");
    }
    ui.tabs.querySelectorAll(".smm-tab").forEach((tab) => {
      const tabKey = cleanText(tab.getAttribute("data-tab"));
      if (tabKey === "favorites") {
        tab.hidden = !favoritesEnabled;
      }
      tab.classList.toggle("active", tabKey === state.activeTab);
    });
  };

  const renderPlanTab = (ui) => {
    if (!ui) return;
    stopCountdownTicker();
    ui.list.innerHTML = "";
    maybeShowMultiTabWarning({ force: false, statusTarget: ui });
    const storageSnapshotBeforeSync = DEBUG_VERBOSE_LOGS
      ? readScheduledCommandsStorageSnapshot()
      : null;
    const rawScheduledArray = storageSnapshotBeforeSync
      ? storageSnapshotBeforeSync.primaryArray
      : [];
    const rawBackupScheduledArray = storageSnapshotBeforeSync
      ? storageSnapshotBeforeSync.backupArray
      : [];
    const rawSessionScheduledArray = storageSnapshotBeforeSync
      ? storageSnapshotBeforeSync.sessionArray
      : [];
    const rawStorageType = storageSnapshotBeforeSync
      ? storageSnapshotBeforeSync.primaryRawType
      : null;
    const rawBackupStorageType = storageSnapshotBeforeSync
      ? storageSnapshotBeforeSync.backupRawType
      : null;
    const rawSessionStorageType = storageSnapshotBeforeSync
      ? storageSnapshotBeforeSync.sessionRawType
      : null;
    const rawDiagnosticsBeforeSync = DEBUG_VERBOSE_LOGS
      ? rawScheduledArray
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index))
      : [];
    const rawBackupDiagnosticsBeforeSync = DEBUG_VERBOSE_LOGS
      ? rawBackupScheduledArray
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index))
      : [];
    const rawSessionDiagnosticsBeforeSync = DEBUG_VERBOSE_LOGS
      ? rawSessionScheduledArray
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index))
      : [];
    syncScheduledCommandsFromStorage();
    state.scheduledCommands = purgeStaleScheduledCommands(
      state.scheduledCommands,
    );
    const scheduled = state.scheduledCommands
      .slice()
      .sort((a, b) => Number(a.departureMs || 0) - Number(b.departureMs || 0));
    const stateDiagnosticsAfterSync = DEBUG_VERBOSE_LOGS
      ? scheduled
          .slice(0, 30)
          .map((item, index) => diagnoseScheduledCommandForPlan(item, index))
      : [];
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [plan-render][input]`, {
        version: VERSION,
        activeTab: state.activeTab,
        storageKey: STORAGE_KEYS.scheduledCommands,
        backupStorageKey: STORAGE_KEYS.scheduledCommandsBackup,
        sessionStorageKey: STORAGE_KEYS.scheduledCommandsSession,
        rawStorageType,
        rawBackupStorageType,
        rawSessionStorageType,
        rawStorageCount: rawScheduledArray.length,
        rawBackupStorageCount: rawBackupScheduledArray.length,
        rawSessionStorageCount: rawSessionScheduledArray.length,
        rawStorageSample: rawDiagnosticsBeforeSync,
        rawBackupStorageSample: rawBackupDiagnosticsBeforeSync,
        rawSessionStorageSample: rawSessionDiagnosticsBeforeSync,
        backupUsedBeforeSync: Boolean(
          storageSnapshotBeforeSync && storageSnapshotBeforeSync.backupUsed,
        ),
        scheduledCount: scheduled.length,
        scheduledSample: stateDiagnosticsAfterSync,
      });
    }
    const hasCommentColumn =
      Boolean(getUiSetting("plannerCommentEnabled")) ||
      scheduled.some((command) => cleanText(command && command.comment));

    if (!scheduled.length) {
      if (DEBUG_VERBOSE_LOGS) {
        console.warn(`${LOG_PREFIX} [plan-render][empty]`, {
          version: VERSION,
          rawStorageType,
          rawBackupStorageType,
          rawSessionStorageType,
          rawStorageCount: rawScheduledArray.length,
          rawBackupStorageCount: rawBackupScheduledArray.length,
          rawSessionStorageCount: rawSessionScheduledArray.length,
          rawStorageSample: rawDiagnosticsBeforeSync,
          rawBackupStorageSample: rawBackupDiagnosticsBeforeSync,
          rawSessionStorageSample: rawSessionDiagnosticsBeforeSync,
          backupUsedBeforeSync: Boolean(
            storageSnapshotBeforeSync && storageSnapshotBeforeSync.backupUsed,
          ),
          stateCountAfterSync: state.scheduledCommands.length,
          stateSampleAfterSync: stateDiagnosticsAfterSync,
        });
      }
      const empty = document.createElement("div");
      empty.className = "smm-empty";
      empty.textContent =
        "План пуст. Нажимай «Запланировать» в расчётах, чтобы добавить приказ.";
      ui.list.appendChild(empty);
      return;
    }

    const failedPlanRows = [];
    const rowsHtml = scheduled
      .map((command) => {
        const rowHtml = safe(() => {
          const unitsHtml = formatPlanUnitsIconsHtml(command.units);
          const resolvedGoUrl =
            resolveScheduledCommandGoUrl(command) || cleanText(command.goUrl) || "";
          const fromVillageHtml = renderVillageCoordLinkHtml({
            coordRaw: command.fromVillageCoord || command.fromVillageId || "?",
            villageIdRaw: command.fromVillageId,
            preferOverview: true,
          });
          const targetVillageHtml = renderVillageCoordLinkHtml({
            coordRaw: command.targetCoord || "?",
            villageIdRaw: command.targetVillageId,
          });
          const departureMs = Number(command.departureMs);
          const timing = safeResolveTimingForScheduledCommand(command);
          const timingCenter = safeComputeTimingCenterCopyValue(timing);
          const timingCopyValue = timingCenter;
          const timingText = cleanText(timing && timing.timingLabel) || "—";
          const timingTextAttrs = timingCopyValue
            ? ` class="smm-plan-timing-text smm-plan-timing-copy" data-copy-time="${escapeHtml(
                timingCopyValue,
              )}" title="Клик: скопировать центр тайминга ${escapeHtml(timingCopyValue)}"`
            : ` class="smm-plan-timing-text"`;
          const timingButtonTitle = "Изменить тайминг";
          const typeLabel = getManeuverTypeLabel(command.action);
          const statusLabel = getManeuverStatusLabel(command.status);
          const commentText = cleanText(command.comment);
          const commentButtonTitle = commentText
            ? "Изменить комментарий"
            : "Добавить комментарий";
          const departureText = Number.isFinite(departureMs)
            ? formatDateTimeShort(departureMs)
            : "—";
          const countdownDataAttr = Number.isFinite(departureMs)
            ? String(departureMs)
            : "";
          const departureCountdown = Number.isFinite(departureMs)
            ? formatCountdown((departureMs - getServerNowMs()) / 1000)
            : "—";
          return `<tr class="smm-plan-cmd-row" data-cmd-id="${escapeHtml(
            command.id || "",
          )}">
  <td>${escapeHtml(typeLabel)}</td>
  <td>${unitsHtml}</td>
  <td>${fromVillageHtml}</td>
  <td>${targetVillageHtml}</td>
  <td>${escapeHtml(departureText)}</td>
  <td class="smm-plan-timing-cell"><div class="smm-plan-comment-wrap"><span${timingTextAttrs}>${escapeHtml(
    timingText,
  )}</span><button type="button" class="smm-plan-comment-edit smm-plan-timing-edit" data-cmd-id="${escapeHtml(
    command.id || "",
  )}" title="${escapeHtml(timingButtonTitle)}" aria-label="${escapeHtml(
    timingButtonTitle,
  )}"></button></div></td>
  <td>${escapeHtml(statusLabel)}</td>
  ${
    hasCommentColumn
      ? `<td class="smm-plan-comment-cell"><div class="smm-plan-comment-wrap"><span class="smm-plan-comment-text">${escapeHtml(
          commentText || "—",
        )}</span><button type="button" class="smm-plan-comment-edit" data-cmd-id="${escapeHtml(
          command.id || "",
        )}" title="${escapeHtml(commentButtonTitle)}" aria-label="${escapeHtml(
          commentButtonTitle,
        )}"></button></div></td>`
      : ""
  }
  <td><span class="smm-plan-countdown" data-departure-ms="${escapeHtml(countdownDataAttr)}">${escapeHtml(
    departureCountdown,
  )}</span></td>
  <td>
    <div class="smm-plan-actions-wrap">
      <button type="button" class="smm-go-btn smm-plan-go-btn" data-cmd-id="${escapeHtml(
        command.id || "",
      )}" data-url="${escapeHtml(
        resolvedGoUrl,
      )}" data-copy-time="${escapeHtml(timingCenter || "")}">Перейти</button>
      <button type="button" class="smm-go-btn smm-plan-del-btn" data-cmd-id="${escapeHtml(
        command.id || "",
      )}">Удалить</button>
    </div>
  </td>
</tr>`;
        }, null);
        if (rowHtml) return rowHtml;
        failedPlanRows.push(cleanText(command && command.id) || "?");
        const commandId = cleanText(command && command.id) || "";
        return `<tr class="smm-plan-cmd-row" data-cmd-id="${escapeHtml(commandId)}">
  <td colspan="${hasCommentColumn ? "10" : "9"}">Запись плана повреждена, но сохранена: ${escapeHtml(commandId || "?")}</td>
</tr>`;
      })
      .join("");
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [plan-render][output]`, {
        version: VERSION,
        scheduledCount: scheduled.length,
        rowsHtmlLength: rowsHtml.length,
        tableWillRender: Boolean(rowsHtml),
        failedPlanRows: failedPlanRows.slice(),
        renderedCommandIds: scheduled
          .slice(0, 50)
          .map((command) => cleanText(command && command.id) || "?"),
      });
    }

    ui.list.innerHTML = `
<section class="smm-plan-panel smm-slice-panel">
  <div class="smm-plan-head">
    <span>План приказов</span>
    <span>${escapeHtml(scheduled.length)} записей</span>
  </div>
  <div class="smm-slice-scroll">
    <table class="smm-slice-table">
      <thead>
        <tr>
          <th>Тип манёвра</th>
          <th>Юниты</th>
          <th>Откуда</th>
          <th>Куда</th>
          <th>Выход</th>
          <th>Тайминг</th>
          <th>Статус</th>
          ${hasCommentColumn ? "<th>Комментарий</th>" : ""}
          <th>До выхода</th>
          <th>Приказ</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
	</section>`;
    if (failedPlanRows.length) {
      console.warn(`${LOG_PREFIX} plan render row fallback`, failedPlanRows);
      setStatus(
        ui,
        `План показан, но ${failedPlanRows.length} строк(и) отрисованы fallback.`,
      );
    }
    startCountdownTicker();
  };

  const formatHubUnits = (units) => {
    if (!units || typeof units !== "object") return "юниты не выбраны";
    const pairs = getSortedUnitKeys(units)
      .map((unit) => {
        const value = Math.max(0, toInt(units[unit]) || 0);
        if (!value) return null;
        return `${getUnitLabel(unit)} ${value}`;
      })
      .filter(Boolean);
    return pairs.length ? pairs.join(", ") : "юниты не выбраны";
  };

  const formatPlanUnitsIconsHtml = (units) => {
    if (!units || typeof units !== "object") return "—";
    const normalizedUnits = normalizeSupportUnitsMap(units, state.speedModel);
    const parts = getSortedUnitKeys(normalizedUnits)
      .map((unit) => {
        const value = Math.max(0, toInt(normalizedUnits[unit]) || 0);
        if (!value) return null;
        const icon = getUnitIconFallback(unit);
        return `<span class="smm-plan-unit-chip">${
          icon
            ? `<img class="smm-unit-icon" src="${escapeHtml(icon)}" alt="${escapeHtml(unit)}">`
            : ""
        }<span>${escapeHtml(value)}</span></span>`;
      })
      .filter(Boolean);
    if (!parts.length) return "—";
    return `<span class="smm-plan-unit-icons">${parts.join("")}</span>`;
  };

  const getHubSyncNick = () =>
    cleanText(safe(() => window.game_data.player.name, null)) || "unknown";

  const getHubSyncId = (connection) => {
    const hubFromConnection = cleanText(connection && connection.hub);
    if (hubFromConnection) return hubFromConnection;
    const hubFromUrl = safe(
      () =>
        new URL(
          cleanText(connection && connection.url),
          location.origin,
        ).searchParams.get("hub"),
      null,
    );
    return cleanText(hubFromUrl) || "default";
  };

  const toIsoStringIfMs = (value) => {
    const ms = Number(value);
    if (!Number.isFinite(ms)) return null;
    const dt = new Date(ms);
    return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
  };

  const getPlanArrivalEpochMs = (command) => {
    if (!command || typeof command !== "object") return null;
    const candidates = [
      command.incomingEtaMs,
      command.timingPointMs,
      command.timingEndMs,
      command.timingStartMs,
    ];
    for (let index = 0; index < candidates.length; index += 1) {
      const value = Number(candidates[index]);
      if (Number.isFinite(value)) return value;
    }
    return null;
  };

  const buildHubPlanSyncItems = () => {
    const commands = (
      Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
    )
      .map((item) => normalizeScheduledCommand(item))
      .filter(Boolean);
    const byId = new Map();
    commands.forEach((command) => {
      byId.set(String(command.id || Math.random()), command);
    });
    return Array.from(byId.values()).map((command) => {
      const arrivalAtMs = getPlanArrivalEpochMs(command);
      const timing = safeResolveTimingForScheduledCommand(command);
      return {
        id: cleanText(command.id) || null,
        type: getManeuverTypeLabel(command.action),
        typeKey: cleanText(command.action) || "slice",
        squad: command.units || {},
        squadText: formatHubUnits(command.units),
        fromCoord:
          cleanText(command.fromVillageCoord || command.fromVillageId) || null,
        targetCoord: cleanText(command.targetCoord) || null,
        arrivalAt: toIsoStringIfMs(arrivalAtMs),
        arrivalAtMs: Number.isFinite(arrivalAtMs)
          ? Math.round(arrivalAtMs)
          : null,
        arrivalServerText: Number.isFinite(arrivalAtMs)
          ? formatDateTimeShortWithMs(arrivalAtMs)
          : null,
        departureAt: toIsoStringIfMs(command.departureMs),
        departureAtMs: Number.isFinite(Number(command.departureMs))
          ? Math.round(Number(command.departureMs))
          : null,
        goUrl: cleanText(command.goUrl) || null,
        timingType: cleanText(timing && timing.timingType) || null,
        timingLabel: cleanText(timing && timing.timingLabel) || null,
        timingGapMs: Number.isFinite(Number(timing && timing.timingGapMs))
          ? Math.round(Number(timing.timingGapMs))
          : null,
        timingStartMs: Number.isFinite(Number(timing && timing.timingStartMs))
          ? Math.round(Number(timing.timingStartMs))
          : null,
        timingEndMs: Number.isFinite(Number(timing && timing.timingEndMs))
          ? Math.round(Number(timing.timingEndMs))
          : null,
        timingPointMs: Number.isFinite(Number(timing && timing.timingPointMs))
          ? Math.round(Number(timing.timingPointMs))
          : null,
        sourceVersion: VERSION,
      };
    });
  };

  const buildHubCommandSyncItems = () => {
    const dump = state.overviewCommandsDump;
    const items = dump && Array.isArray(dump.items) ? dump.items : [];
    const byId = new Map();
    items.forEach((item) => {
      const id = cleanText(item && item.id);
      if (!id) return;
      byId.set(id, item);
    });
    const sourceFetchedAt = cleanText(dump && dump.fetchedAt) || null;
    return Array.from(byId.values()).map((item) => {
      const typeKey = cleanText(item && item.type) || "other";
      const rawUrl = cleanText(item && item.commandUrl);
      const commandUrl = rawUrl
        ? safe(() => new URL(rawUrl, location.origin).toString(), rawUrl)
        : null;
      const etaEpochMs = Number(item && item.etaEpochMs);
      const fallbackArrival = cleanText(item && item.arrivalText);
      return {
        id: cleanText(item && item.id) || null,
        type: getOwnCommandTypeLabel(typeKey),
        typeKey,
        squad:
          item && item.units && typeof item.units === "object"
            ? item.units
            : {},
        squadText: formatHubUnits(item && item.units),
        fromCoord:
          cleanText(
            item &&
              (item.routeFromCoord ||
                item.fromVillageCoord ||
                item.fromVillage),
          ) || null,
        targetCoord:
          cleanText(
            item && (item.routeToCoord || item.targetCoord || item.target),
          ) || null,
        arrivalAt: Number.isFinite(etaEpochMs)
          ? toIsoStringIfMs(etaEpochMs)
          : fallbackArrival || null,
        arrivalAtMs: Number.isFinite(etaEpochMs)
          ? Math.round(etaEpochMs)
          : null,
        arrivalServerText: Number.isFinite(etaEpochMs)
          ? formatDateTimeShortWithMs(etaEpochMs)
          : null,
        commandUrl,
        sourceFetchedAt,
      };
    });
  };

  const buildHubTribeAttackSyncItems = () => {
    const items =
      state.incomings && Array.isArray(state.incomings.items)
        ? state.incomings.items
        : [];
    const byId = new Map();
    items.forEach((item) => {
      const key = cleanText(item && item.id);
      if (!key) return;
      byId.set(key, item);
    });
    return Array.from(byId.values()).map((item) => {
      const etaEpochMs = Number(
        item && (item.arrivalEpochMs || item.etaEpochMs),
      );
      const sizeClass = getIncomingSizeClass(item);
      const commandType = cleanText(item && item.commandType) || null;
      const guessedUnit = cleanText(item && item.guessedUnit) || null;
      const detectedUnits = Array.isArray(item && item.detectedUnits)
        ? item.detectedUnits.map((unit) => cleanText(unit)).filter(Boolean)
        : [];
      const unit =
        guessedUnit || (detectedUnits.length ? detectedUnits[0] : null);
      const supportUnitCount = Math.max(
        0,
        toInt(item && item.supportUnitCount) || 0,
      );
      const sizeHint =
        commandType ||
        (sizeClass && sizeClass !== "normal" ? `attack_${sizeClass}` : null) ||
        cleanText(item && item.displayType) ||
        null;
      return {
        id: cleanText(item && item.id) || null,
        unit,
        detectedUnits,
        squadSize:
          supportUnitCount > 0
            ? supportUnitCount
            : Number.isFinite(toInt(item && item.unitCount))
              ? Math.max(0, toInt(item && item.unitCount) || 0)
              : null,
        squadSizeText: cleanText(item && item.kindText) || sizeHint,
        sizeClass: cleanText(sizeClass) || null,
        commandType: commandType || null,
        fromCoord: cleanText(item && (item.originCoord || item.origin)) || null,
        targetCoord:
          cleanText(item && (item.targetCoord || item.target)) || null,
        attackerNick: cleanText(item && item.player) || null,
        arrivalAt: Number.isFinite(etaEpochMs)
          ? toIsoStringIfMs(etaEpochMs)
          : null,
        arrivalAtMs: Number.isFinite(etaEpochMs)
          ? Math.round(etaEpochMs)
          : null,
        arrivalServerText: Number.isFinite(etaEpochMs)
          ? formatDateTimeShortWithMs(etaEpochMs)
          : null,
        sourceVersion: VERSION,
      };
    });
  };

  const buildHubTribeTroopsSyncItems = () => {
    const getSourceRank = (sourceRaw) => {
      const source = cleanText(sourceRaw) || "";
      if (source === "in_village_row") return 100;
      if (source === "home_link_row") return 90;
      if (source === "own_home_single_row") return 80;
      if (source === "own_home_row") return 70;
      if (source === "own_row") return 20;
      if (source === "fallback_row") return 10;
      if (source === "total_row") return 0;
      return 0;
    };
    const troopModels = [
      state.troopsDefense && Array.isArray(state.troopsDefense.villages)
        ? state.troopsDefense
        : null,
      state.troops && Array.isArray(state.troops.villages)
        ? state.troops
        : null,
    ].filter(Boolean);
    const villages = troopModels.flatMap((model) =>
      Array.isArray(model && model.villages) ? model.villages : [],
    );
    const byCoord = new Map();
    villages.forEach((village) => {
      const coord = normalizeCoordIdentity(
        village && (village.villageCoord || village.villageName),
      );
      if (!coord) return;
      const troops = normalizeUnitsMap(village && village.troops);
      const sourceRank = getSourceRank(village && village.troopsSource);
      const existing = byCoord.get(coord);
      if (!existing || sourceRank >= Number(existing.sourceRank || 0)) {
        byCoord.set(coord, {
          coord,
          troops,
          sourceRank,
        });
      }
    });
    const authoritativePageSigil = getCurrentPageAuthoritativeSigilPercent();
    const detectedSigilNow = toNumber(detectActiveSigilPercent());
    const sigilPercent = Number.isFinite(authoritativePageSigil)
      ? authoritativePageSigil
      : selectPreferredSigilPercent(
          toNumber(state.detectedSigilPercent),
          toNumber(state.snapshot && state.snapshot.sigilPercent),
          detectedSigilNow,
        );
    if (Number.isFinite(sigilPercent)) {
      state.detectedSigilPercent = sigilPercent;
    }
    return Array.from(byCoord.values()).map((entry) => ({
      coord: cleanText(entry && entry.coord) || null,
      troops: normalizeUnitsMap(entry && entry.troops),
      sigilPercent: Number.isFinite(sigilPercent) ? sigilPercent : 0,
      sourceVersion: VERSION,
    }));
  };

  const buildHubSyncPayload = (connection) => {
    const payload = {
      action: "sync_state",
      hub: getHubSyncId(connection),
      nick: getHubSyncNick(),
      sender: "game",
      sourceVersion: VERSION,
      generatedAt: new Date(getServerNowMs()).toISOString(),
      planItems: buildHubPlanSyncItems(),
      commandItems: buildHubCommandSyncItems(),
    };
    if (getUiSetting("exchangeTribeAttacks")) {
      payload.tribeAttackItems = buildHubTribeAttackSyncItems();
      payload.tribeTroopsItems = buildHubTribeTroopsSyncItems();
    }
    return payload;
  };

  const postHubSyncPayload = async (hubUrl, payload) => {
    const isGasUrl = (() => {
      const parsed = safe(
        () => new URL(String(hubUrl || ""), location.origin),
        null,
      );
      const host = cleanText(parsed && parsed.host);
      return Boolean(
        host &&
          (host.includes("script.google.com") ||
            host.includes("script.googleusercontent.com")),
      );
    })();
    const headers = isGasUrl
      ? { "Content-Type": "text/plain;charset=utf-8" }
      : {
          "Content-Type": "application/json;charset=utf-8",
          Accept: "application/json",
        };
    const response = await fetch(hubUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    const parsed = safe(() => JSON.parse(text), null);
    if (!response.ok) {
      throw new Error(`hub sync http ${response.status}`);
    }
    if (!parsed || parsed.ok !== true) {
      throw new Error(cleanText(parsed && parsed.error) || "hub sync failed");
    }
    return parsed;
  };

  const postHubQueryPayload = async (hubUrl, payload) => {
    const isGasUrl = (() => {
      const parsed = safe(
        () => new URL(String(hubUrl || ""), location.origin),
        null,
      );
      const host = cleanText(parsed && parsed.host);
      return Boolean(
        host &&
          (host.includes("script.google.com") ||
            host.includes("script.googleusercontent.com")),
      );
    })();
    const headers = isGasUrl
      ? { "Content-Type": "text/plain;charset=utf-8" }
      : {
          "Content-Type": "application/json;charset=utf-8",
          Accept: "application/json",
        };
    const response = await fetch(hubUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const text = await response.text();
    const parsed = safe(() => JSON.parse(text), null);
    if (!response.ok) {
      throw new Error(`hub query http ${response.status}`);
    }
    if (!parsed || parsed.ok !== true) {
      throw new Error(
        cleanText(parsed && parsed.reason) ||
          cleanText(parsed && parsed.error) ||
          "hub query failed",
      );
    }
    return parsed;
  };

  const fetchHubJson = async (url) => {
    const response = await fetch(String(url || ""), { method: "GET" });
    const text = await response.text();
    const parsed = safe(() => JSON.parse(text), null);
    if (!response.ok) {
      throw new Error(`hub http ${response.status}`);
    }
    if (!parsed || parsed.ok !== true) {
      throw new Error(
        cleanText(parsed && parsed.reason) ||
          cleanText(parsed && parsed.error) ||
          "hub request failed",
      );
    }
    return parsed;
  };

  const ensureHubConnectionLoaded = () => {
    const fromState = normalizeHubConnection(state.hubConnection);
    if (fromState) return fromState;
    const fromStorage = loadHubConnection();
    state.hubConnection = fromStorage;
    return fromStorage;
  };

  const formatHubCoveragePercent = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    const rounded = num >= 10 ? Math.round(num) : Math.round(num * 10) / 10;
    if (!Number.isFinite(rounded)) return "0";
    return Number.isInteger(rounded)
      ? String(rounded)
      : String(rounded)
          .replace(/\.0+$/g, "")
          .replace(/(\.\d*[1-9])0+$/g, "$1");
  };

  const buildHubQueryIncomingsFingerprint = (items) => {
    const list = Array.isArray(items) ? items : [];
    return list
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        return [
          cleanText(item.id) || "",
          cleanText(item.targetCoord) || "",
          Number.isFinite(toFiniteEpochMs(item.etaEpochMs))
            ? String(Math.round(toFiniteEpochMs(item.etaEpochMs)))
            : "",
          cleanText(item.timingType) || "",
          cleanText(item.timingLabel) || "",
          Number.isFinite(Number(item.timingStartMs))
            ? String(Math.round(Number(item.timingStartMs)))
            : "",
          Number.isFinite(Number(item.timingEndMs))
            ? String(Math.round(Number(item.timingEndMs)))
            : "",
          Number.isFinite(Number(item.hubMatchedUnitsEq))
            ? String(Math.round(Number(item.hubMatchedUnitsEq)))
            : "",
          Number.isFinite(Number(item.hubThresholdUnitsEq))
            ? String(Math.round(Number(item.hubThresholdUnitsEq)))
            : "",
          Number.isFinite(Number(item.hubPlannedUnitsEq))
            ? String(Math.round(Number(item.hubPlannedUnitsEq)))
            : "",
          Number.isFinite(Number(item.sigilPercent))
            ? String(Number(item.sigilPercent))
            : "",
        ].join("|");
      })
      .join("||");
  };

  const buildHubMassIncomingsFingerprint = (items) => {
    const list = Array.isArray(items) ? items : [];
    return list
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        return [
          cleanText(item.id) || "",
          cleanText(item.targetCoord) || "",
          Number.isFinite(toFiniteEpochMs(item.etaEpochMs))
            ? String(Math.round(toFiniteEpochMs(item.etaEpochMs)))
            : "",
          cleanText(item.timingLabel) || "",
          Number.isFinite(Number(item.massRequiredFullOffs))
            ? String(Math.round(Number(item.massRequiredFullOffs)))
            : "",
          Number.isFinite(Number(item.massInPathFullOffs))
            ? String(Math.round(Number(item.massInPathFullOffs)))
            : "",
          Number.isFinite(Number(item.massRequiredNobles))
            ? String(Math.round(Number(item.massRequiredNobles)))
            : "",
          Number.isFinite(Number(item.massInPathNobles))
            ? String(Math.round(Number(item.massInPathNobles)))
            : "",
          cleanText(item.massPlannedFullOffText) || "",
          cleanText(item.massPlannedNoblesText) || "",
        ].join("|");
      })
      .join("||");
  };

  const buildHubTribeIncomingsFingerprint = (
    items,
    troopsRows,
    commandRows,
    planRows,
  ) => {
    const incomingPart = (Array.isArray(items) ? items : [])
      .map((item) => {
        if (!item || typeof item !== "object") return "";
        return [
          cleanText(item.id) || "",
          cleanText(item.ownerNick) || "",
          cleanText(item.originCoord) || "",
          cleanText(item.targetCoord) || "",
          Number.isFinite(Number(item.arrivalEpochMs))
            ? String(Math.round(Number(item.arrivalEpochMs)))
            : "",
          cleanText(item.guessedUnit) || "",
          cleanText(item.commandType) || "",
          cleanText(item.displayType) || "",
          Number.isFinite(Number(item.sigilPercent))
            ? String(Number(item.sigilPercent))
            : "",
        ].join("|");
      })
      .sort()
      .join("||");
    const troopsPart = (Array.isArray(troopsRows) ? troopsRows : [])
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const troops = normalizeUnitsMap(
          parseHubUnitsJson(row.troops || row.troopsJson),
        );
        return [
          cleanText(row.coord) || "",
          cleanText(row.nick) || "",
          JSON.stringify(troops),
          Number.isFinite(Number(row.sigilPercent))
            ? String(Number(row.sigilPercent))
            : "",
        ].join("|");
      })
      .sort()
      .join("||");
    const commandsPart = (Array.isArray(commandRows) ? commandRows : [])
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        return [
          cleanText(row.id) || "",
          cleanText(row.ownerNick || row.player) || "",
          cleanText(row.commandType || row.kindText) || "",
          cleanText(row.squadSummaryText || row.squadText) || "",
          cleanText(row.originCoord || row.origin) || "",
          cleanText(row.targetCoord || row.target) || "",
          Number.isFinite(Number(row.etaEpochMs || row.arrivalAtMs))
            ? String(Math.round(Number(row.etaEpochMs || row.arrivalAtMs)))
            : "",
        ].join("|");
      })
      .sort()
      .join("||");
    const plansPart = (Array.isArray(planRows) ? planRows : [])
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        return [
          cleanText(row.id) || "",
          cleanText(row.ownerNick || row.player) || "",
          cleanText(row.commandType || row.kindText || row.typeKey) || "",
          cleanText(row.squadSummaryText || row.squadText) || "",
          cleanText(row.originCoord || row.origin) || "",
          cleanText(row.targetCoord || row.target) || "",
          Number.isFinite(Number(row.etaEpochMs || row.arrivalAtMs))
            ? String(Math.round(Number(row.etaEpochMs || row.arrivalAtMs)))
            : "",
        ].join("|");
      })
      .sort()
      .join("||");
    return `${incomingPart}###${troopsPart}###${commandsPart}###${plansPart}`;
  };

  const clearHubQueryIncomings = ({ rerender = false } = {}) => {
    state.hubQueryIncomings = [];
    state.hubQueryThreshold = null;
    state.hubQueryLastLoadedMs = null;
    state.hubQueryError = null;
    state.hubQueryLoading = false;
    state.hubQueryLastFingerprint = null;
    if (rerender) {
      requestIncomingsRerender("clear_hub_query");
    }
  };

  const clearHubOwnQueries = ({ rerender = false } = {}) => {
    state.hubOwnQueries = [];
    state.hubOwnQueriesLastLoadedMs = null;
    state.hubOwnQueriesLoading = false;
    state.hubOwnQueriesError = null;
    if (rerender && state.ui && state.activeTab === "hub") {
      renderHubTab(state.ui);
    }
  };

  const clearHubMassIncomings = ({ rerender = false } = {}) => {
    state.hubMassIncomings = [];
    state.hubMassLastLoadedMs = null;
    state.hubMassLoading = false;
    state.hubMassError = null;
    state.hubMassLastFingerprint = null;
    if (rerender) {
      requestIncomingsRerender("clear_hub_mass");
    }
  };

  const clearHubTribeIncomings = ({ rerender = false } = {}) => {
    state.hubTribeIncomings = [];
    state.hubTribeAllIncomings = [];
    state.hubTribeTroopsRows = [];
    state.hubTribeCommandsRows = [];
    state.hubTribeCommandsCacheRows = [];
    state.hubTribePlansRows = [];
    state.hubTribeLastLoadedMs = null;
    state.hubTribeError = null;
    state.hubTribeLoading = false;
    state.hubTribeLastFingerprint = null;
    state.hubTribeSyncError = null;
    state.hubTribeLastSyncAtMs = null;
    if (rerender) {
      requestIncomingsRerender("clear_hub_tribe");
    }
  };

  const pullHubQueryAlerts = async ({
    hubUrl,
    hubId,
    nick,
    limit = HUB_QUERY_PULL_MAX_ROWS,
  } = {}) => {
    const endpoint = new URL(String(hubUrl || ""), location.origin);
    endpoint.searchParams.set("action", "pull_query_alerts");
    endpoint.searchParams.set("hub", cleanText(hubId) || "default");
    const normalizedNick = cleanText(nick);
    if (normalizedNick) endpoint.searchParams.set("nick", normalizedNick);
    endpoint.searchParams.set(
      "limit",
      String(Math.max(1, Math.round(Number(limit) || HUB_QUERY_PULL_MAX_ROWS))),
    );

    try {
      return await fetchHubJson(endpoint.toString());
    } catch (error) {
      throw new Error(`hub query pull failed: ${formatErrorText(error)}`);
    }
  };

  const pullHubOwnQueries = async ({
    hubUrl,
    hubId,
    nick,
    limit = HUB_OWN_QUERY_PULL_MAX_ROWS,
  } = {}) => {
    const endpoint = new URL(String(hubUrl || ""), location.origin);
    endpoint.searchParams.set("action", "pull_query_mine");
    endpoint.searchParams.set("hub", cleanText(hubId) || "default");
    const normalizedNick = cleanText(nick);
    if (normalizedNick) endpoint.searchParams.set("nick", normalizedNick);
    endpoint.searchParams.set(
      "limit",
      String(
        Math.max(1, Math.round(Number(limit) || HUB_OWN_QUERY_PULL_MAX_ROWS)),
      ),
    );
    try {
      return await fetchHubJson(endpoint.toString());
    } catch (error) {
      throw new Error(`hub own-query pull failed: ${formatErrorText(error)}`);
    }
  };

  const pullHubMassAlerts = async ({
    hubUrl,
    hubId,
    nick,
    limit = HUB_MASS_PULL_MAX_ROWS,
  } = {}) => {
    const endpoint = new URL(String(hubUrl || ""), location.origin);
    endpoint.searchParams.set("action", "pull_mass_alerts");
    endpoint.searchParams.set("hub", cleanText(hubId) || "default");
    const normalizedNick = cleanText(nick);
    if (normalizedNick) endpoint.searchParams.set("nick", normalizedNick);
    endpoint.searchParams.set(
      "limit",
      String(Math.max(1, Math.round(Number(limit) || HUB_MASS_PULL_MAX_ROWS))),
    );
    try {
      return await fetchHubJson(endpoint.toString());
    } catch (error) {
      throw new Error(`hub mass pull failed: ${formatErrorText(error)}`);
    }
  };

  const pullHubOwnPlan = async ({
    hubUrl,
    hubId,
    nick,
    limit = HUB_PLAN_PULL_MAX_ROWS,
  } = {}) => {
    const endpoint = new URL(String(hubUrl || ""), location.origin);
    endpoint.searchParams.set("action", "pull_plan_mine");
    endpoint.searchParams.set("hub", cleanText(hubId) || "default");
    const normalizedNick = cleanText(nick);
    if (normalizedNick) endpoint.searchParams.set("nick", normalizedNick);
    endpoint.searchParams.set(
      "limit",
      String(Math.max(1, Math.round(Number(limit) || HUB_PLAN_PULL_MAX_ROWS))),
    );
    try {
      return await fetchHubJson(endpoint.toString());
    } catch (error) {
      throw new Error(`hub plan pull failed: ${formatErrorText(error)}`);
    }
  };

  const pullHubTribeOverview = async ({
    hubUrl,
    hubId,
    nick,
    limit = HUB_TRIBE_PULL_MAX_ROWS,
  } = {}) => {
    const endpoint = new URL(String(hubUrl || ""), location.origin);
    endpoint.searchParams.set("action", "pull_tribe_overview");
    endpoint.searchParams.set("hub", cleanText(hubId) || "default");
    const normalizedNick = cleanText(nick);
    if (normalizedNick) endpoint.searchParams.set("nick", normalizedNick);
    endpoint.searchParams.set(
      "limit",
      String(Math.max(1, Math.round(Number(limit) || HUB_TRIBE_PULL_MAX_ROWS))),
    );
    try {
      return await fetchHubJson(endpoint.toString());
    } catch (error) {
      throw new Error(`hub tribe pull failed: ${formatErrorText(error)}`);
    }
  };

  const mapHubPlanTypeToAction = (value) => {
    const text = cleanText(value);
    if (!text) return "slice";
    const normalized = text.toLowerCase();
    if (normalized === "intercept") return "intercept";
    if (normalized === "slice") return "slice";
    if (normalized.includes("перехват")) return "intercept";
    return "slice";
  };

  const normalizeHubPlanRowsToCommands = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const departureMs = Number(row.departureAtMs);
        if (!Number.isFinite(departureMs)) return null;
        const action = mapHubPlanTypeToAction(
          cleanText(row.typeKey) ||
            cleanText(row.actionKey) ||
            cleanText(row.maneuverType),
        );
        const squadRaw =
          row.squad !== undefined
            ? row.squad
            : row.units !== undefined
              ? row.units
              : row.squadJson;
        const squadParsed =
          typeof squadRaw === "string"
            ? safe(() => JSON.parse(squadRaw), {})
            : squadRaw || {};
        const units = normalizeUnitsMap(squadParsed);
        if (!Object.keys(units).length) return null;
        const normalized = normalizeScheduledCommand({
          id:
            cleanText(row.planId) ||
            cleanText(row.rowKey) ||
            `hub_plan_${Math.random().toString(36).slice(2, 8)}`,
          incomingId: cleanText(row.incomingId) || null,
          action,
          actionLabel: getPlanActionLabelByKey(action),
          status: MANEUVER_STATUS.waiting,
          createdAtMs: Number.isFinite(Number(row.receivedAtMs))
            ? Math.round(Number(row.receivedAtMs))
            : getServerNowMs(),
          fromVillageCoord:
            cleanText(row.fromCoord || row.fromVillageCoord) || null,
          targetVillageId:
            cleanText(row.targetVillageId || row.villageId || row.targetId) ||
            null,
          targetCoord: cleanText(row.targetCoord) || null,
          departureMs: Math.round(departureMs),
          incomingEtaMs: Number.isFinite(Number(row.arrivalAtMs))
            ? Math.round(Number(row.arrivalAtMs))
            : null,
          timingType: cleanText(row.timingType) || null,
          timingLabel: cleanText(row.timingLabel) || null,
          timingGapMs: Number.isFinite(Number(row.timingGapMs))
            ? Math.round(Number(row.timingGapMs))
            : null,
          timingStartMs: Number.isFinite(Number(row.timingStartMs))
            ? Math.round(Number(row.timingStartMs))
            : null,
          timingEndMs: Number.isFinite(Number(row.timingEndMs))
            ? Math.round(Number(row.timingEndMs))
            : null,
          timingPointMs: Number.isFinite(Number(row.timingPointMs))
            ? Math.round(Number(row.timingPointMs))
            : null,
          units,
          goUrl: cleanText(row.goUrl) || null,
        });
        return normalized;
      })
      .filter(Boolean)
      .sort((a, b) => {
        const av = Number(a && a.departureMs);
        const bv = Number(b && b.departureMs);
        if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
          return av - bv;
        return String((a && a.id) || "").localeCompare(
          String((b && b.id) || ""),
        );
      });

  const buildScheduledCommandsFingerprint = (commands) =>
    (Array.isArray(commands) ? commands : [])
      .map((command) => {
        const unitsText = JSON.stringify(
          normalizeUnitsMap(command && command.units),
        );
        return [
          cleanText(command && command.id) || "",
          Number(command && command.departureMs) || 0,
          cleanText(command && command.action) || "",
          normalizeCoordIdentity(
            command && (command.fromVillageCoord || command.fromVillageId),
          ) || "",
          normalizeCoordIdentity(command && command.targetCoord) || "",
          unitsText,
          cleanText(command && command.timingType) || "",
          cleanText(command && command.timingLabel) || "",
          Number(command && command.timingStartMs) || 0,
          Number(command && command.timingEndMs) || 0,
          Number(command && command.timingPointMs) || 0,
          cleanText(command && command.comment) || "",
        ].join("|");
      })
      .join("||");
  const mergeScheduledCommandsById = (remoteCommands, localCommands) => {
    const map = new Map();
    (Array.isArray(remoteCommands) ? remoteCommands : [])
      .map((item) => normalizeScheduledCommand(item))
      .filter(Boolean)
      .forEach((item) => {
        map.set(String(item.id), item);
      });
    (Array.isArray(localCommands) ? localCommands : [])
      .map((item) => normalizeScheduledCommand(item))
      .filter(Boolean)
      .forEach((item) => {
        const key = String(item.id);
        if (!map.has(key)) {
          map.set(key, item);
          return;
        }
        const existing = map.get(key);
        const existingComment = cleanText(existing && existing.comment);
        const localComment = cleanText(item && item.comment);
        const existingTimingType = cleanText(existing && existing.timingType);
        const localTimingType = cleanText(item && item.timingType);
        const existingTimingLabel = cleanText(existing && existing.timingLabel);
        const localTimingLabel = cleanText(item && item.timingLabel);
        let merged = existing;
        if (!existingComment && localComment) {
          merged = {
            ...merged,
            comment: localComment,
          };
        }
        if (
          localTimingType === "manual" &&
          localTimingLabel &&
          (existingTimingType !== "manual" ||
            existingTimingLabel !== localTimingLabel ||
            Number(existing && existing.timingStartMs) !==
              Number(item && item.timingStartMs) ||
            Number(existing && existing.timingEndMs) !==
              Number(item && item.timingEndMs) ||
            Number(existing && existing.timingPointMs) !==
              Number(item && item.timingPointMs))
        ) {
          merged = {
            ...merged,
            timingType: item.timingType,
            timingLabel: item.timingLabel,
            timingGapMs: item.timingGapMs,
            timingStartMs: item.timingStartMs,
            timingEndMs: item.timingEndMs,
            timingPointMs: item.timingPointMs,
            departureMs: item.departureMs,
            incomingId: item.incomingId,
            incomingEtaMs: item.incomingEtaMs,
            sourceIncomingId: item.sourceIncomingId,
            sourceIncomingEtaMs: item.sourceIncomingEtaMs,
            travelDurationMs: item.travelDurationMs,
          };
        } else if (!existingTimingLabel && localTimingLabel) {
          merged = {
            ...merged,
            timingType: item.timingType,
            timingLabel: item.timingLabel,
            timingGapMs: item.timingGapMs,
            timingStartMs: item.timingStartMs,
            timingEndMs: item.timingEndMs,
            timingPointMs: item.timingPointMs,
            departureMs: item.departureMs,
            incomingId: item.incomingId,
            incomingEtaMs: item.incomingEtaMs,
            sourceIncomingId: item.sourceIncomingId,
            sourceIncomingEtaMs: item.sourceIncomingEtaMs,
            travelDurationMs: item.travelDurationMs,
          };
        }
        if (merged !== existing) {
          map.set(key, normalizeScheduledCommand(merged) || merged);
        }
      });
    return Array.from(map.values()).sort((a, b) => {
      const av = Number(a && a.departureMs);
      const bv = Number(b && b.departureMs);
      if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
        return av - bv;
      return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
    });
  };
  const upsertScheduledCommandWithStorageSync = (rawCommand) => {
    const normalized = normalizeScheduledCommand(rawCommand);
    if (!normalized) return null;
    const normalizedId = cleanText(normalized.id);
    if (!normalizedId) return null;
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [plan-upsert][input]`, {
        version: VERSION,
        command: diagnoseScheduledCommandForPlan(normalized, 0),
      });
    }
    const latestCommands = syncScheduledCommandsFromStorage();
    const mergedCommands = mergeScheduledCommandsById(latestCommands, [
      normalized,
    ]);
    state.scheduledCommands = mergedCommands;
    const writeOk = saveScheduledCommands("upsert");
    const storageAfterWrite = readScheduledCommandsStorageSnapshot();
    const persistedCommands = mergeScheduledCommandsById(
      storageAfterWrite.commands,
      state.scheduledCommands,
    );
    state.scheduledCommands = persistedCommands;
    let persistedCommand = persistedCommands.find(
      (command) =>
        String(cleanText(command && command.id) || "") === String(normalizedId),
    );
    if (!persistedCommand) {
      state.scheduledCommands = mergeScheduledCommandsById(persistedCommands, [
        normalized,
      ]);
      saveScheduledCommands("upsert_retry");
      const storageAfterRetry = readScheduledCommandsStorageSnapshot();
      state.scheduledCommands = mergeScheduledCommandsById(
        storageAfterRetry.commands,
        [normalized],
      );
      persistedCommand = (
        Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
      ).find(
        (command) =>
          String(cleanText(command && command.id) || "") === String(normalizedId),
      );
    }
    if (DEBUG_VERBOSE_LOGS) {
      console.info(`${LOG_PREFIX} [plan-upsert][result]`, {
        version: VERSION,
        id: normalizedId,
        saved: Boolean(persistedCommand),
        writeOk,
        latestCount: Array.isArray(latestCommands) ? latestCommands.length : 0,
        mergedCount: Array.isArray(mergedCommands) ? mergedCommands.length : 0,
        persistedCount: Array.isArray(persistedCommands)
          ? persistedCommands.length
          : 0,
        primaryStoredCount: storageAfterWrite.primaryCommands.length,
        backupStoredCount: storageAfterWrite.backupCommands.length,
        sessionStoredCount: storageAfterWrite.sessionCommands.length,
        backupUsed: storageAfterWrite.backupUsed,
        persistedCommand: persistedCommand
          ? diagnoseScheduledCommandForPlan(persistedCommand, 0)
          : null,
      });
    }
    return persistedCommand || null;
  };
  const updateScheduledCommandCommentById = (commandId, comment) => {
    const safeId = cleanText(commandId);
    if (!safeId) return null;
    const safeComment = cleanText(comment) || null;
    const latestCommands = syncScheduledCommandsFromStorage();
    const updatedCommands = (Array.isArray(latestCommands) ? latestCommands : [])
      .map((command) => normalizeScheduledCommand(command))
      .filter(Boolean)
      .map((command) => {
        if (String(cleanText(command.id) || "") !== String(safeId)) {
          return command;
        }
        return normalizeScheduledCommand({
          ...command,
          comment: safeComment,
        });
      })
      .filter(Boolean);
    const updatedCommand = updatedCommands.find(
      (command) => String(cleanText(command && command.id) || "") === String(safeId),
    );
    if (!updatedCommand) return null;
    state.scheduledCommands = updatedCommands;
    saveScheduledCommands("comment");
    return updatedCommand;
  };
  const getScheduledCommandTravelDurationMs = (command) => {
    const stored = toFiniteMs(command && command.travelDurationMs);
    if (Number.isFinite(stored) && stored >= 0) return Math.round(stored);
    const sourceEta =
      toFiniteEpochMs(command && command.sourceIncomingEtaMs) ||
      toFiniteEpochMs(command && command.incomingEtaMs);
    const departureMs = toFiniteEpochMs(command && command.departureMs);
    if (Number.isFinite(sourceEta) && Number.isFinite(departureMs)) {
      return Math.max(0, Math.round(sourceEta - departureMs));
    }
    return null;
  };
  const getManualTimingTargetMs = (timing) => {
    const pointMs = toFiniteEpochMs(timing && timing.timingPointMs);
    if (Number.isFinite(pointMs)) return Math.round(pointMs);
    const startMs = toFiniteEpochMs(timing && timing.timingStartMs);
    const endMs = toFiniteEpochMs(timing && timing.timingEndMs);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      return Math.round((startMs + endMs) / 2);
    }
    return null;
  };
  const buildScheduledCommandTimingUpdate = (command, timing) => {
    const timingType = cleanText(timing && timing.timingType);
    const sourceIncomingId =
      cleanText(command && command.sourceIncomingId) ||
      cleanText(command && command.incomingId) ||
      null;
    const sourceIncomingEtaMs =
      toFiniteEpochMs(command && command.sourceIncomingEtaMs) ||
      toFiniteEpochMs(command && command.incomingEtaMs);
    const travelDurationMs = getScheduledCommandTravelDurationMs(command);
    const base = {
      timingType: timingType || null,
      timingLabel: cleanText(timing && timing.timingLabel) || null,
      timingGapMs: toFiniteMs(timing && timing.timingGapMs),
      timingStartMs: toFiniteEpochMs(timing && timing.timingStartMs),
      timingEndMs: toFiniteEpochMs(timing && timing.timingEndMs),
      timingPointMs: toFiniteEpochMs(timing && timing.timingPointMs),
      sourceIncomingId,
      sourceIncomingEtaMs: Number.isFinite(sourceIncomingEtaMs)
        ? Math.round(sourceIncomingEtaMs)
        : null,
      travelDurationMs: Number.isFinite(travelDurationMs)
        ? Math.round(travelDurationMs)
        : null,
    };
    if (timingType !== "manual") {
      const restoredEtaMs = Number.isFinite(sourceIncomingEtaMs)
        ? Math.round(sourceIncomingEtaMs)
        : toFiniteEpochMs(command && command.incomingEtaMs);
      const restoredDepartureMs =
        Number.isFinite(restoredEtaMs) && Number.isFinite(travelDurationMs)
          ? Math.round(restoredEtaMs - travelDurationMs)
          : toFiniteEpochMs(command && command.departureMs);
      return {
        ...base,
        incomingId: sourceIncomingId || cleanText(command && command.incomingId) || null,
        incomingEtaMs: Number.isFinite(restoredEtaMs) ? restoredEtaMs : null,
        departureMs: Number.isFinite(restoredDepartureMs)
          ? restoredDepartureMs
          : command.departureMs,
      };
    }
    const manualTargetMs = getManualTimingTargetMs(timing);
    if (!Number.isFinite(manualTargetMs) || !Number.isFinite(travelDurationMs)) {
      return base;
    }
    return {
      ...base,
      // Force external userscripts to use manual timing fields instead of
      // recalculating from the original incoming command.
      incomingId: null,
      incomingEtaMs: null,
      departureMs: Math.round(manualTargetMs - travelDurationMs),
    };
  };
  const updateScheduledCommandTimingById = (commandId, timingInput) => {
    const safeId = cleanText(commandId);
    if (!safeId) return null;
    const latestCommands = syncScheduledCommandsFromStorage();
    let updatedCommand = null;
    const updatedCommands = (Array.isArray(latestCommands) ? latestCommands : [])
      .map((command) => normalizeScheduledCommand(command))
      .filter(Boolean)
      .map((command) => {
        if (String(cleanText(command.id) || "") !== String(safeId)) {
          return command;
        }
        const timing = normalizeManualTimingInput(timingInput, command);
        updatedCommand = normalizeScheduledCommand({
          ...command,
          ...buildScheduledCommandTimingUpdate(command, timing),
        });
        return updatedCommand;
      })
      .filter(Boolean);
    if (!updatedCommand) return null;
    state.scheduledCommands = updatedCommands;
    saveScheduledCommands("timing");
    return updatedCommand;
  };

  const loadHubPlanFromHubAsync = async ({
    force = false,
    silent = true,
  } = {}) => {
    if (!getUiSetting("loadPlanFromHub")) return [];
    const connection = ensureHubConnectionLoaded();
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) return [];

    if (state.hubPlanLoading && !force) {
      return Array.isArray(state.scheduledCommands)
        ? state.scheduledCommands
        : [];
    }

    state.hubPlanLoading = true;
    state.hubPlanError = null;
    try {
      const response = await pullHubOwnPlan({
        hubUrl,
        hubId: getHubSyncId(connection),
        nick: getHubSyncNick(),
        limit: HUB_PLAN_PULL_MAX_ROWS,
      });
      const rows = Array.isArray(response && response.rows)
        ? response.rows
        : [];
      if (!rows.length) {
        state.hubPlanLastLoadedMs = getServerNowMs();
        state.hubPlanError = null;
        return Array.isArray(state.scheduledCommands)
          ? state.scheduledCommands
          : [];
      }
      const commands = normalizeHubPlanRowsToCommands(rows);
      const localCommands = syncScheduledCommandsFromStorage();
      const mergedCommands = mergeScheduledCommandsById(
        commands,
        localCommands,
      );
      const currentFingerprint =
        buildScheduledCommandsFingerprint(localCommands);
      const nextFingerprint = buildScheduledCommandsFingerprint(mergedCommands);
      if (nextFingerprint !== currentFingerprint) {
        state.scheduledCommands = mergedCommands;
        saveScheduledCommands("hub_plan_sync");
        state.hubPlanLastFingerprint = nextFingerprint;
        if (state.ui && state.activeTab === "plan") {
          if (state.refreshInProgress) {
            state.pendingPlanRerender = true;
          } else {
            renderPlanTab(state.ui);
          }
        } else if (state.ui && state.activeTab === "incomings") {
          requestIncomingsRerender("hub_plan_sync");
        }
      } else {
        state.hubPlanLastFingerprint = nextFingerprint;
      }
      state.hubPlanLastLoadedMs = getServerNowMs();
      state.hubPlanError = null;
      return Array.isArray(state.scheduledCommands)
        ? state.scheduledCommands
        : [];
    } catch (error) {
      state.hubPlanError = formatErrorText(error);
      if (!silent) {
        notifyHubStatus(`HubPlan: ${state.hubPlanError}`, true);
      }
      return Array.isArray(state.scheduledCommands)
        ? state.scheduledCommands
        : [];
    } finally {
      state.hubPlanLoading = false;
    }
  };

  const checkHubQueryDuplicate = async ({
    hubUrl,
    hubId,
    nick,
    targetCoord,
    timingStartMs = null,
    timingEndMs = null,
    timingPointMs = null,
    incomingEtaMs = null,
  } = {}) => {
    const endpoint = new URL(String(hubUrl || ""), location.origin);
    endpoint.searchParams.set("action", "check_query_duplicate");
    endpoint.searchParams.set("hub", cleanText(hubId) || "default");
    const normalizedNick = cleanText(nick);
    if (normalizedNick) endpoint.searchParams.set("nick", normalizedNick);
    const normalizedTarget = cleanText(targetCoord);
    if (normalizedTarget)
      endpoint.searchParams.set("targetCoord", normalizedTarget);
    const safeTimingStartMs = toFiniteEpochMs(timingStartMs);
    const safeTimingEndMs = toFiniteEpochMs(timingEndMs);
    const safeTimingPointMs = toFiniteEpochMs(timingPointMs);
    const safeIncomingEtaMs = toFiniteEpochMs(incomingEtaMs);
    if (Number.isFinite(safeTimingStartMs))
      endpoint.searchParams.set(
        "timingStartMs",
        String(Math.round(safeTimingStartMs)),
      );
    if (Number.isFinite(safeTimingEndMs))
      endpoint.searchParams.set(
        "timingEndMs",
        String(Math.round(safeTimingEndMs)),
      );
    if (Number.isFinite(safeTimingPointMs))
      endpoint.searchParams.set(
        "timingPointMs",
        String(Math.round(safeTimingPointMs)),
      );
    if (Number.isFinite(safeIncomingEtaMs))
      endpoint.searchParams.set(
        "incomingEtaMs",
        String(Math.round(safeIncomingEtaMs)),
      );
    try {
      return await fetchHubJson(endpoint.toString());
    } catch (error) {
      throw new Error(
        `hub query duplicate check failed: ${formatErrorText(error)}`,
      );
    }
  };

  const deleteHubOwnQuery = async ({ hubUrl, hubId, nick, rowKey } = {}) => {
    const payload = {
      action: "delete_query",
      hub: cleanText(hubId) || "default",
      nick: cleanText(nick) || null,
      rowKey: cleanText(rowKey) || null,
    };
    return postHubQueryPayload(hubUrl, payload);
  };

  const deleteHubOwnPlan = async ({ hubUrl, hubId, nick, planId } = {}) => {
    const payload = {
      action: "delete_plan",
      hub: cleanText(hubId) || "default",
      nick: cleanText(nick) || null,
      planId: cleanText(planId) || null,
    };
    return postHubQueryPayload(hubUrl, payload);
  };

  const logSliceConflictDebug = (stage, payload) => {
    if (!DEBUG_VERBOSE_LOGS) return;
    safe(() => {
      console.info("[ScriptMM][slice-conflict]", stage, payload || {});
      return true;
    }, false);
  };

  const resolveSliceConflictWindowByIncomings = ({
    incomingId = null,
    targetCoord = null,
    incomingEtaMs = null,
  } = {}) => {
    const targetKey = normalizeCoordKey(targetCoord);
    const etaMs = toFiniteEpochMs(incomingEtaMs);
    if (!targetKey || !Number.isFinite(etaMs)) return null;
    const incomingIdKey = cleanText(incomingId);
    const incomingItems = Array.isArray(getIncomingItems())
      ? getIncomingItems()
      : [];

    let previousEtaMs = null;
    incomingItems.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const itemId = cleanText(item.id);
      if (incomingIdKey && itemId && String(itemId) === String(incomingIdKey)) {
        return;
      }
      const itemTargetKey = normalizeCoordKey(item.targetCoord || item.target);
      if (!itemTargetKey || itemTargetKey !== targetKey) return;
      const itemEtaMs = toFiniteEpochMs(item.etaEpochMs || item.arrivalEpochMs);
      if (!Number.isFinite(itemEtaMs) || itemEtaMs >= etaMs) return;
      if (!Number.isFinite(previousEtaMs) || itemEtaMs > previousEtaMs) {
        previousEtaMs = itemEtaMs;
      }
    });

    if (Number.isFinite(previousEtaMs) && previousEtaMs < etaMs) {
      return {
        startMs: previousEtaMs,
        endMs: etaMs,
        source: "between_prev_attack",
        isFallback: false,
      };
    }

    return {
      startMs: Math.max(0, etaMs - 50),
      endMs: etaMs + 50,
      source: "fallback_50ms",
      isFallback: true,
    };
  };

  const buildSliceTimingWindowFromRow = (rowElement) => {
    if (!rowElement) return null;
    const action = cleanText(rowElement.getAttribute("data-action")) || "slice";
    if (action !== "slice") return null;
    const incomingId = cleanText(rowElement.getAttribute("data-incoming-id"));
    const targetCoord = cleanText(rowElement.getAttribute("data-target-coord"));
    const incomingEtaMs = toFiniteEpochMs(rowElement.getAttribute("data-eta-ms"));
    if (!targetCoord || !Number.isFinite(incomingEtaMs)) return null;
    const resolvedWindow = resolveSliceConflictWindowByIncomings({
      incomingId,
      targetCoord,
      incomingEtaMs,
    });
    let startMs = toFiniteEpochMs(resolvedWindow && resolvedWindow.startMs);
    let endMs = toFiniteEpochMs(resolvedWindow && resolvedWindow.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
    if (startMs > endMs) {
      const temp = startMs;
      startMs = endMs;
      endMs = temp;
    }
    return {
      action,
      incomingId,
      targetCoord,
      targetKey: normalizeCoordKey(targetCoord),
      startMs,
      endMs,
      timingPointMs: incomingEtaMs,
      source:
        cleanText(resolvedWindow && resolvedWindow.source) || "row_timing",
      timingLabel:
        `${formatTimeWithMs(startMs)}-${formatTimeWithMs(endMs)}`,
    };
  };

  const buildSliceTimingWindowFromPlanCommand = (commandRaw) => {
    const command = normalizeScheduledCommand(commandRaw);
    if (!command || cleanText(command.action) !== "slice") return null;
    const targetCoord = cleanText(command.targetCoord);
    const targetKey = normalizeCoordKey(targetCoord);
    if (cleanText(command.timingType) === "manual") {
      const manualTiming =
        normalizeManualTimingInput(command.timingLabel, command) || {};
      const manualStartMs = toFiniteEpochMs(
        command.timingStartMs || manualTiming.timingStartMs,
      );
      const manualEndMs = toFiniteEpochMs(
        command.timingEndMs || manualTiming.timingEndMs,
      );
      const manualPointMs = toFiniteEpochMs(
        command.timingPointMs || manualTiming.timingPointMs,
      );
      let startMs = manualStartMs;
      let endMs = manualEndMs;
      if (!Number.isFinite(startMs) && Number.isFinite(manualPointMs))
        startMs = manualPointMs;
      if (!Number.isFinite(endMs) && Number.isFinite(manualPointMs))
        endMs = manualPointMs;
      if (targetKey && Number.isFinite(startMs) && Number.isFinite(endMs)) {
        if (startMs > endMs) {
          const temp = startMs;
          startMs = endMs;
          endMs = temp;
        }
        return {
          action: "slice",
          incomingId: cleanText(command.incomingId) || cleanText(command.id) || null,
          targetCoord,
          targetKey,
          startMs,
          endMs,
          timingPointMs: Number.isFinite(manualPointMs) ? manualPointMs : null,
          source: "plan_manual_timing",
          timingLabel: buildNormalizedTimingLabel({
            timingType: "manual",
            timingLabel: command.timingLabel,
            timingStartMs: startMs,
            timingEndMs: endMs,
            timingPointMs: manualPointMs,
          }),
        };
      }
    }
    const resolvedWindow = resolveSliceConflictWindowByIncomings({
      incomingId: cleanText(command.incomingId) || cleanText(command.id),
      targetCoord,
      incomingEtaMs: toFiniteEpochMs(command.incomingEtaMs),
    });
    let startMs = toFiniteEpochMs(
      resolvedWindow && resolvedWindow.startMs,
    );
    let endMs = toFiniteEpochMs(
      resolvedWindow && resolvedWindow.endMs,
    );
    const pointMs = toFiniteEpochMs(command.timingPointMs || command.incomingEtaMs);
    if (!Number.isFinite(startMs)) startMs = toFiniteEpochMs(command.timingStartMs);
    if (!Number.isFinite(endMs)) endMs = toFiniteEpochMs(command.timingEndMs);
    if (!Number.isFinite(startMs) && Number.isFinite(pointMs)) startMs = pointMs;
    if (!Number.isFinite(endMs) && Number.isFinite(pointMs)) endMs = pointMs;
    if (Number.isFinite(pointMs) && !Number.isFinite(startMs))
      startMs = Math.max(0, pointMs - 50);
    if (Number.isFinite(pointMs) && !Number.isFinite(endMs)) endMs = pointMs;
    if (!targetKey || !Number.isFinite(startMs) || !Number.isFinite(endMs)) {
      return null;
    }
    if (startMs > endMs) {
      const temp = startMs;
      startMs = endMs;
      endMs = temp;
    }
    return {
      action: "slice",
      incomingId: cleanText(command.incomingId) || cleanText(command.id) || null,
      targetCoord,
      targetKey,
      startMs,
      endMs,
      timingPointMs: Number.isFinite(pointMs) ? pointMs : null,
      source:
        cleanText(resolvedWindow && resolvedWindow.source) ||
        "plan_timing",
      timingLabel:
        `${formatTimeWithMs(startMs)}-${formatTimeWithMs(endMs)}`,
    };
  };

  const buildCoordTokens = (value) => {
    const tokens = new Set();
    const key = cleanText(normalizeCoordKey(value));
    if (key) tokens.add(key);
    const raw = String(cleanText(value) || "");
    const fuzzyMatch = raw.match(/(\d{1,3})\D+(\d{1,3})/);
    if (fuzzyMatch) {
      const x = String(Number(fuzzyMatch[1]));
      const y = String(Number(fuzzyMatch[2]));
      if (x && y) {
        tokens.add(`${x}|${y}`);
        tokens.add(`${x}${y}`);
      }
    }
    const compactFromValue = raw.replace(/\D+/g, "");
    if (compactFromValue.length >= 6) tokens.add(compactFromValue);
    const compactFromKey = String(key || "").replace(/\D+/g, "");
    if (compactFromKey.length >= 6) tokens.add(compactFromKey);
    return tokens;
  };

  const hasCoordTokenIntersection = (leftValue, rightValue) => {
    const left = buildCoordTokens(leftValue);
    const right = buildCoordTokens(rightValue);
    if (!left.size || !right.size) return false;
    for (const token of left) {
      if (right.has(token)) return true;
    }
    return false;
  };

  const DAY_MS = 24 * 60 * 60 * 1000;

  const toDayMsFromEpochMs = (epochMs) => {
    const parts = getServerWallClockParts(epochMs);
    if (!parts) return null;
    return (
      ((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 +
      parts.millisecond
    );
  };

  const parseDayMsFromFreeText = (text) => {
    const clean = cleanText(text);
    if (!clean) return null;
    const match = clean.match(/(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)/);
    if (!match) return null;
    return parseClockWithOptionalMsToDayMs(match[1]);
  };

  const normalizeDayRange = (startRaw, endRaw) => {
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    const norm = (value) => ((Math.round(value) % DAY_MS) + DAY_MS) % DAY_MS;
    return { start: norm(start), end: norm(end) };
  };

  const isDayMsInsideRange = (valueRaw, rangeRaw) => {
    const value = Number(valueRaw);
    const range = rangeRaw && typeof rangeRaw === "object" ? rangeRaw : null;
    if (!Number.isFinite(value) || !range) return false;
    let start = Number(range.start);
    let end = Number(range.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    const normalize = (raw) => ((Math.round(raw) % DAY_MS) + DAY_MS) % DAY_MS;
    start = normalize(start);
    end = normalize(end);
    let v = normalize(value);
    if (end < start) {
      end += DAY_MS;
      if (v < start) v += DAY_MS;
    }
    return v >= start && v <= end;
  };

  const resolveWindowDayRangeFromWindowInfo = (windowInfo) => {
    if (!windowInfo || typeof windowInfo !== "object") return null;
    const byLabel = cleanText(windowInfo.timingLabel);
    if (byLabel) {
      const rangeMatch = byLabel.match(
        /(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)\s*-\s*(\d{1,2}:\d{2}:\d{2}(?::\d{1,3})?)/,
      );
      if (rangeMatch) {
        const startDayMs = parseClockWithOptionalMsToDayMs(rangeMatch[1]);
        const endDayMs = parseClockWithOptionalMsToDayMs(rangeMatch[2]);
        const normalized = normalizeDayRange(startDayMs, endDayMs);
        if (normalized) return normalized;
      }
      const singleDayMs = parseDayMsFromFreeText(byLabel);
      if (Number.isFinite(singleDayMs)) {
        const normalized = normalizeDayRange(singleDayMs, singleDayMs);
        if (normalized) return normalized;
      }
    }
    const startEpoch = toFiniteEpochMs(windowInfo.startMs);
    const endEpoch = toFiniteEpochMs(windowInfo.endMs);
    const normalized = normalizeDayRange(
      toDayMsFromEpochMs(startEpoch),
      toDayMsFromEpochMs(endEpoch),
    );
    if (normalized) return normalized;
    const pointEpoch = toFiniteEpochMs(windowInfo.timingPointMs);
    const pointDayMs = toDayMsFromEpochMs(pointEpoch);
    return normalizeDayRange(pointDayMs, pointDayMs);
  };

  const getCommandArrivalDayMsCandidates = (command, arrivalCandidatesRaw) => {
    const values = [];
    const add = (dayMs) => {
      if (!Number.isFinite(dayMs)) return;
      const normalized = ((Math.round(dayMs) % DAY_MS) + DAY_MS) % DAY_MS;
      if (!values.includes(normalized)) values.push(normalized);
    };
    const arrivalCandidates = Array.isArray(arrivalCandidatesRaw)
      ? arrivalCandidatesRaw
      : extractEpochMsCandidatesFromCommand(command);
    arrivalCandidates.forEach((epochMs) => add(toDayMsFromEpochMs(epochMs)));
    add(parseDayMsFromFreeText(command && command.arrivalText));
    add(parseDayMsFromFreeText(command && command.arrivalServerTimeMsText));
    add(parseDayMsFromFreeText(command && command.arrivalServerText));
    return values;
  };

  const isCommandArrivalInWindow = (
    command,
    windowInfo,
    arrivalCandidatesRaw,
    options = {},
  ) => {
    if (!command || !windowInfo) return false;
    const arrivalCandidates = Array.isArray(arrivalCandidatesRaw)
      ? arrivalCandidatesRaw
      : extractEpochMsCandidatesFromCommand(command);
    const byEpoch = arrivalCandidates.some((epochMs) =>
      isEpochInWindow(epochMs, windowInfo.startMs, windowInfo.endMs),
    );
    if (byEpoch) return true;
    const allowDayFallback = !(
      options &&
      typeof options === "object" &&
      options.allowDayFallback === false
    );
    if (!allowDayFallback) return false;
    const dayRange = resolveWindowDayRangeFromWindowInfo(windowInfo);
    if (!dayRange) return false;
    const dayCandidates = getCommandArrivalDayMsCandidates(
      command,
      arrivalCandidates,
    );
    return dayCandidates.some((dayMs) => isDayMsInsideRange(dayMs, dayRange));
  };
  const isCommandArrivalInSliceConflictWindow = (
    command,
    windowInfo,
    arrivalCandidatesRaw,
  ) =>
    isCommandArrivalInWindow(command, windowInfo, arrivalCandidatesRaw, {
      allowDayFallback: false,
    });

  const extractEpochMsCandidatesFromCommand = (command) => {
    const candidates = [];
    const push = (value) => {
      const epochMs = toFiniteEpochMs(value);
      if (!Number.isFinite(epochMs)) return;
      if (!candidates.includes(epochMs)) candidates.push(epochMs);
    };
    if (!command || typeof command !== "object") return candidates;
    push(command.etaEpochMs);
    push(command.arrivalEpochMs);
    push(command.arrivalAtMs);
    push(command.arrivalMs);
    const arrivalText = cleanText(command.arrivalText) || cleanText(command.arrivalServerTimeMsText);
    if (arrivalText) {
      const arrivalMs = extractArrivalMsFromText(arrivalText);
      const arrivalDateText = extractArrivalDateTimeText(arrivalText) || arrivalText;
      push(parseCommandsArrivalEpochMs(arrivalDateText, arrivalMs));
    }
    return candidates;
  };

  const buildOwnCommandsCacheRowsForConflict = () => {
    const dump = state.overviewCommandsDump;
    const items = dump && Array.isArray(dump.items) ? dump.items : [];
    if (!items.length) return [];
    const mapped = [];
    items.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const type = String(cleanText(item.type) || "").toLowerCase();
      const targetCoord = cleanText(
        normalizeCoordIdentity(item.routeToCoord || item.targetCoord || item.target),
      );
      const etaEpochMs = toFiniteEpochMs(item.etaEpochMs || item.arrivalEpochMs);
      if (!targetCoord || !Number.isFinite(etaEpochMs)) return;
      const units = normalizeUnitsMap(item.units);
      mapped.push({
        id: `own_cmd_${cleanText(item.id) || hashString(`${targetCoord}|${etaEpochMs}|${type}`)}`,
        commandType: type || "command",
        tribeCommandNature: type === "support" ? "support" : type === "attack" ? "attack" : type,
        kindText:
          type === "support"
            ? "подкрепление"
            : type === "attack"
              ? "атака"
              : type === "return"
                ? "возврат"
                : "приказ",
        targetCoord,
        squadUnits: units,
        etaEpochMs,
        arrivalEpochMs: etaEpochMs,
        arrivalAtMs: etaEpochMs,
        arrivalText:
          cleanText(item.arrivalText) || formatDateTimeShortWithMs(etaEpochMs),
        source: "own_overview_commands",
      });
    });
    return mapped;
  };

  const getSliceConflictCommandCandidates = () => {
    const hubRows = Array.isArray(state.hubTribeCommandsCacheRows)
      ? state.hubTribeCommandsCacheRows
      : Array.isArray(state.hubTribeCommandsRows)
        ? state.hubTribeCommandsRows
        : [];
    const ownRows = buildOwnCommandsCacheRowsForConflict();
    const byId = new Map();
    [...hubRows, ...ownRows].forEach((item) => {
      if (!item || typeof item !== "object") return;
      const key =
        cleanText(item.id) ||
        cleanText(item.sourceCommandId) ||
        `${cleanText(item.targetCoord || item.target) || "?"}|${
          toFiniteEpochMs(item.etaEpochMs || item.arrivalEpochMs || item.arrivalAtMs) || 0
        }|${cleanText(item.commandType) || "?"}|${cleanText(item.source) || "?"}`;
      byId.set(String(key), item);
    });
    return Array.from(byId.values());
  };

  const isEpochInWindow = (epochMs, windowStartMs, windowEndMs) => {
    if (!Number.isFinite(epochMs)) return false;
    if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs))
      return false;
    if (epochMs >= windowStartMs && epochMs <= windowEndMs) return true;
    const threeHoursMs = 3 * 60 * 60 * 1000;
    if (
      epochMs + threeHoursMs >= windowStartMs &&
      epochMs + threeHoursMs <= windowEndMs
    )
      return true;
    if (
      epochMs - threeHoursMs >= windowStartMs &&
      epochMs - threeHoursMs <= windowEndMs
    )
      return true;
    return false;
  };

  const calcUnitsEqForHubQuery = (unitsRaw) => {
    const units = normalizeUnitsMap(unitsRaw);
    const spear = Math.max(0, toInt(units.spear) || 0);
    const sword = Math.max(0, toInt(units.sword) || 0);
    const light = Math.max(0, toInt(units.light) || 0);
    const heavy = Math.max(0, toInt(units.heavy) || 0);
    return spear + sword + light + heavy * 4;
  };

  const resolveHubQueryTimingWindow = (row) => {
    const source = row && typeof row === "object" ? row : {};
    const startRaw = toFiniteEpochMs(source.timingStartMs);
    const endRaw = toFiniteEpochMs(source.timingEndMs);
    const pointRaw = toFiniteEpochMs(source.timingPointMs);
    const etaRaw = toFiniteEpochMs(source.incomingEtaMs);
    if (Number.isFinite(startRaw) && Number.isFinite(endRaw)) {
      return {
        startMs: Math.min(startRaw, endRaw),
        endMs: Math.max(startRaw, endRaw),
      };
    }
    if (Number.isFinite(startRaw)) return { startMs: startRaw, endMs: startRaw };
    if (Number.isFinite(endRaw)) return { startMs: endRaw, endMs: endRaw };
    if (Number.isFinite(pointRaw)) return { startMs: pointRaw, endMs: pointRaw };
    if (Number.isFinite(etaRaw)) return { startMs: etaRaw, endMs: etaRaw };
    return null;
  };

  const estimateMatchedUnitsEqFromLocalCacheForHubQuery = (row) => {
    if (!row || typeof row !== "object") return 0;
    const timingWindow = resolveHubQueryTimingWindow(row);
    if (!timingWindow) return 0;
    const timingLabel = buildNormalizedTimingLabel({
      timingType: cleanText(row.timingType) || null,
      timingLabel: cleanText(row.timingLabel) || null,
      timingStartMs: toFiniteEpochMs(row.timingStartMs),
      timingEndMs: toFiniteEpochMs(row.timingEndMs),
      timingPointMs: toFiniteEpochMs(row.timingPointMs),
      units: row.units,
    });
    const localWindowInfo = {
      startMs: timingWindow.startMs,
      endMs: timingWindow.endMs,
      timingLabel,
      targetCoord: cleanText(row.targetCoord) || null,
    };
    const targetCoord = cleanText(row.targetCoord);
    if (!targetCoord) return 0;
    const candidates = getSliceConflictCommandCandidates();
    if (!candidates.length) return 0;
    let sum = 0;
    let matchedWithTarget = 0;
    candidates.forEach((command) => {
      const commandTarget = cleanText(command && (command.targetCoord || command.target));
      if (!hasCoordTokenIntersection(targetCoord, commandTarget)) return;
      const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
      const isMatchedByTime = isCommandArrivalInSliceConflictWindow(
        command,
        localWindowInfo,
        arrivalCandidates,
      );
      if (!isMatchedByTime) return;
      matchedWithTarget += 1;
      sum += calcUnitsEqForHubQuery(command.squadUnits);
    });
    if (matchedWithTarget <= 0) {
      candidates.forEach((command) => {
        const commandTarget = cleanText(command && (command.targetCoord || command.target));
        const hasTargetTokens = buildCoordTokens(commandTarget).size > 0;
        if (hasTargetTokens) return;
        const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
        const isMatchedByTime = isCommandArrivalInSliceConflictWindow(
          command,
          localWindowInfo,
          arrivalCandidates,
        );
        if (!isMatchedByTime) return;
        sum += calcUnitsEqForHubQuery(command.squadUnits);
      });
    }
    return Math.max(0, Math.round(sum));
  };

  const normalizeSliceConflictWindowForCheck = (windowInfo) => {
    if (!windowInfo || typeof windowInfo !== "object") return null;
    let startMs = toFiniteEpochMs(windowInfo.startMs);
    let endMs = toFiniteEpochMs(windowInfo.endMs);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return windowInfo;
    if (startMs > endMs) {
      const temp = startMs;
      startMs = endMs;
      endMs = temp;
    }
    const widthMs = Math.max(0, endMs - startMs);
    const timingPointMs = toFiniteEpochMs(windowInfo.timingPointMs);
    const pivotMs = Number.isFinite(timingPointMs) ? timingPointMs : endMs;
    const clampedEnd = pivotMs;
    const clampedStart = Math.max(0, clampedEnd - 100);
    return {
      ...windowInfo,
      startMs: clampedStart,
      endMs: clampedEnd,
      timingLabel: `${formatTimeWithMs(clampedStart)}-${formatTimeWithMs(clampedEnd)}`,
      source: `${cleanText(windowInfo.source) || "window"}+before_noble_100ms`,
      conflictWindowClamped: true,
      conflictWindowOriginalStartMs: startMs,
      conflictWindowOriginalEndMs: endMs,
      conflictWindowOriginalWidthMs: widthMs,
      conflictWindowCenterMs: Math.round((startMs + endMs) / 2),
      conflictWindowPivotMs: pivotMs,
    };
  };

  const parseUnitsMapFromCommandLabel = (textRaw) => {
    const text = String(textRaw || "")
      .replace(/\u00a0/g, " ")
      .trim();
    if (!text) return {};

    const escaped = (value) =>
      String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      { unit: "spear", aliases: ["копь", "копье", "копьё", "копий", "spear"] },
      { unit: "sword", aliases: ["меч", "мечник", "мечей", "sword"] },
      { unit: "axe", aliases: ["топор", "топорщик", "топоров", "axe"] },
      { unit: "archer", aliases: ["луч", "лучник", "лучников", "archer"] },
      {
        unit: "spy",
        aliases: ["развед", "разведка", "лазут", "лазутчик", "spy"],
      },
      {
        unit: "light",
        aliases: ["лк", "легк", "легкая", "лёгкая", "light"],
      },
      {
        unit: "heavy",
        aliases: ["тк", "тяж", "тяжелая", "тяжёлая", "heavy"],
      },
      { unit: "ram", aliases: ["таран", "ram"] },
      { unit: "catapult", aliases: ["ката", "катап", "catapult"] },
      { unit: "knight", aliases: ["пал", "паладин", "knight"] },
      { unit: "snob", aliases: ["двор", "дворянин", "snob"] },
      { unit: "marcher", aliases: ["к.луч", "конный лучник", "marcher"] },
    ];
    const units = {};
    const add = (unit, rawCount) => {
      const count = Math.max(0, toInt(rawCount) || 0);
      if (!unit || !count) return;
      units[unit] = Math.max(0, toInt(units[unit]) || 0) + count;
    };

    patterns.forEach(({ unit, aliases }) => {
      const aliasPattern = aliases
        .map((alias) => escaped(alias))
        .filter(Boolean)
        .join("|");
      if (!aliasPattern) return;
      const reAfter = new RegExp(
        `(?:^|[^A-Za-zА-Яа-яЁё0-9_])(?:${aliasPattern})[^\\d]{0,5}(\\d{1,7})`,
        "gi",
      );
      const reBefore = new RegExp(
        `(?:^|[^A-Za-zА-Яа-яЁё0-9_])(\\d{1,7})[^A-Za-zА-Яа-яЁё0-9_]{0,5}(?:${aliasPattern})`,
        "gi",
      );
      let match = null;
      while ((match = reAfter.exec(text))) {
        add(unit, match[1]);
      }
      while ((match = reBefore.exec(text))) {
        add(unit, match[1]);
      }
    });

    return normalizeUnitsMap(units);
  };

  const parseUnitsMapFromTooltipPayload = (payloadRaw, speedModel = null) => {
    const addCount = (target, unitRaw, countRaw) => {
      const unit = normalizeUnitKeyForSupportCalc(unitRaw);
      const count = Math.max(0, toInt(countRaw) || 0);
      if (!unit || !count) return;
      if (!isUnitAllowedInWorld(unit, speedModel)) return;
      target[unit] = Math.max(0, toInt(target[unit]) || 0) + count;
    };
    const mergeUnits = (target, source) => {
      Object.entries(
        source && typeof source === "object" && !Array.isArray(source)
          ? source
          : {},
      ).forEach(([unit, count]) => addCount(target, unit, count));
    };
    const decodeEntities = (value) =>
      safe(() => {
        const node = document.createElement("textarea");
        node.innerHTML = String(value || "");
        return node.value;
      }, String(value || ""));

    const raw = String(payloadRaw || "");
    if (!raw) return {};

    const units = {};
    const sourceVariants = Array.from(
      new Set([
        raw,
        decodeEntities(raw),
        tooltipHtmlToText(raw) || "",
        tooltipHtmlToText(decodeEntities(raw)) || "",
      ]),
    ).filter(Boolean);

    sourceVariants.forEach((source) => {
      const iconWithNumberRe =
        /(?:unit_|\/tiny\/|\/unit\/)([a-z_]+)(?:@2x)?(?:\.(?:png|webp|gif|jpg|jpeg))?[^0-9]{0,120}(\d{1,7})/gi;
      let match = null;
      while ((match = iconWithNumberRe.exec(source))) {
        addCount(units, match[1], match[2]);
      }
      mergeUnits(units, parseUnitsMapFromCommandLabel(source));
    });

    return normalizeSupportUnitsMap(units, speedModel);
  };

  const extractSupportCommandsFromInfoVillageDoc = (
    doc,
    { targetCoord = null } = {},
  ) => {
    const parsed = parseInfoVillagePlanningPayload(doc);
    const items =
      parsed &&
      parsed.dump &&
      Array.isArray(parsed.dump.items)
        ? parsed.dump.items
        : [];
    if (!items.length) return [];
    const targetKey = normalizeCoordKey(targetCoord);
    const supportRows = [];
    items.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const textSource = String(
        [
          cleanText(item.commandType) || "",
          cleanText(item.displayType) || "",
          cleanText(item.commandLabel) || "",
          cleanText(item.kindText) || "",
        ].join(" "),
      ).toLowerCase();
      if (/(?:return|back|возврат|отозван)/i.test(textSource)) return;
      const nature = getTribeTimelineEntryNature(item);
      const isSupport =
        nature === "support" || /(?:support|подкреп|поддерж|def)/i.test(textSource);
      if (!isSupport) return;

      const itemTargetCoord = normalizeCoordIdentity(item.targetCoord || targetCoord);
      if (
        targetKey &&
        itemTargetCoord &&
        !hasCoordTokenIntersection(targetKey, itemTargetCoord)
      ) {
        return;
      }
      const arrivalEpochMs = toFiniteEpochMs(item.arrivalEpochMs || item.etaEpochMs);
      if (!Number.isFinite(arrivalEpochMs)) return;
      const commandLabel =
        cleanText(item.commandLabel) || cleanText(item.kindText) || "подкрепление";
      const detectedUnits = Array.isArray(item.detectedUnits)
        ? item.detectedUnits
            .map((unit) => String(unit || "").toLowerCase())
            .filter((unit) => isUnitAllowedInWorld(unit, state.speedModel))
        : [];
      let squadUnits = normalizeUnitsMap(
        item.squadUnits && typeof item.squadUnits === "object"
          ? item.squadUnits
          : parseUnitsMapFromCommandLabel(commandLabel),
      );
      if (!Object.keys(squadUnits).length && detectedUnits.length === 1) {
        const compactLabel = String(commandLabel || "").replace(/\s+/g, "");
        if (/^\d{1,6}$/.test(compactLabel)) {
          const inferredCount = Math.max(0, toInt(compactLabel) || 0);
          if (inferredCount > 0) {
            squadUnits = normalizeUnitsMap({
              [detectedUnits[0]]: inferredCount,
            });
          }
        }
      }
      supportRows.push({
        id:
          cleanText(item.id) ||
          `iv_support_${hashString(`${itemTargetCoord || targetCoord || "?"}|${arrivalEpochMs}|${commandLabel}`)}`,
        commandId:
          cleanText(item.commandId) ||
          cleanText(item.sourceCommandId) ||
          cleanText(getUrlParam(cleanText(item.commandUrl), "id")) ||
          null,
        sourceCommandId:
          cleanText(item.sourceCommandId) ||
          cleanText(item.commandId) ||
          cleanText(getUrlParam(cleanText(item.commandUrl), "id")) ||
          null,
        commandUrl: cleanText(item.commandUrl) || null,
        commandType: "support",
        tribeCommandNature: "support",
        kindText: "подкрепление",
        commandLabel,
        targetCoord: itemTargetCoord || targetCoord || null,
        arrivalEpochMs,
        etaEpochMs: arrivalEpochMs,
        arrivalAtMs: arrivalEpochMs,
        arrivalText:
          cleanText(item.arrivalText) || formatDateTimeShortWithMs(arrivalEpochMs),
        squadUnits,
        source: "info_village_commands",
      });
    });
    return supportRows;
  };

  const getSliceConflictSupportDetailsCache = () => {
    if (
      !state.sliceConflictSupportDetailsCache ||
      typeof state.sliceConflictSupportDetailsCache !== "object" ||
      Array.isArray(state.sliceConflictSupportDetailsCache)
    ) {
      state.sliceConflictSupportDetailsCache = {};
    }
    return state.sliceConflictSupportDetailsCache;
  };

  const resolveSliceConflictCommandId = (command) =>
    cleanText(command && command.commandId) ||
    cleanText(command && command.sourceCommandId) ||
    cleanText(getUrlParam(cleanText(command && command.commandUrl), "id")) ||
    cleanText(command && command.id) ||
    null;

  const resolveSliceConflictCommandUrl = (command) => {
    const directUrl = cleanText(command && command.commandUrl);
    if (directUrl) {
      return safe(() => new URL(directUrl, location.origin).toString(), null);
    }
    const commandId = resolveSliceConflictCommandId(command);
    if (!commandId) return null;
    return buildGameUrl({
      screen: "info_command",
      id: commandId,
      type: "other",
    });
  };

  const buildSliceConflictCommandUrlVariants = (command) => {
    const variants = new Set();
    const addVariant = (value) => {
      const normalized = cleanText(value);
      if (!normalized) return;
      const absolute = safe(
        () => new URL(normalized, location.origin).toString(),
        null,
      );
      if (absolute) variants.add(absolute);
    };

    const directUrl = resolveSliceConflictCommandUrl(command);
    addVariant(directUrl);

    const commandId = resolveSliceConflictCommandId(command);
    if (commandId) {
      const canonicalUrl = buildGameUrl({
        screen: "info_command",
        id: commandId,
        type: "other",
      });
      addVariant(canonicalUrl);
      [
        ["ajax", "details"],
        ["ajax", "command"],
        ["ajax", "popup"],
        ["ajaxaction", "details"],
      ].forEach(([key, value]) => {
        const prepared = safe(() => {
          const url = new URL(canonicalUrl, location.origin);
          url.searchParams.set(key, value);
          return url.toString();
        }, null);
        addVariant(prepared);
      });
    }
    return Array.from(variants);
  };

  const extractUnitsFromJsonLikePayload = (payloadText, speedModel = null) => {
    const text = String(payloadText || "").trim();
    if (!text || (!text.startsWith("{") && !text.startsWith("["))) return {};
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      return {};
    }
    const units = {};
    const addCount = (unitRaw, countRaw) => {
      const unit = normalizeUnitKeyForSupportCalc(unitRaw);
      const count = Math.max(0, toInt(countRaw) || 0);
      if (!unit || !count) return;
      if (!isUnitAllowedInWorld(unit, speedModel)) return;
      units[unit] = Math.max(0, toInt(units[unit]) || 0) + count;
    };
    const walk = (node) => {
      if (!node) return;
      if (Array.isArray(node)) {
        node.forEach((item) => walk(item));
        return;
      }
      if (typeof node === "string") {
        const parsedFromString = parseUnitsMapFromTooltipPayload(node, speedModel);
        Object.entries(parsedFromString).forEach(([unit, count]) =>
          addCount(unit, count),
        );
        return;
      }
      if (typeof node !== "object") return;
      Object.entries(node).forEach(([key, value]) => {
        const normalizedKey = String(key || "").toLowerCase();
        if (
          UNIT_ORDER_INDEX[normalizedKey] !== undefined &&
          (typeof value === "number" || typeof value === "string")
        ) {
          addCount(normalizedKey, value);
        }
        walk(value);
      });
    };
    walk(parsed);
    return normalizeSupportUnitsMap(units, speedModel);
  };

  const extractSupportUnitsFromAnyPayloadText = (
    payloadText,
    speedModel = null,
    command = null,
  ) => {
    const text = String(payloadText || "");
    if (!text) return {};

    const jsonUnits = extractUnitsFromJsonLikePayload(text, speedModel);
    if (Object.keys(jsonUnits).length) return jsonUnits;

    const htmlDoc = new DOMParser().parseFromString(text, "text/html");
    const commandId = resolveSliceConflictCommandId(command);
    const isInfoVillageLike = Boolean(
      htmlDoc.querySelector("#commands_outgoings, .commands-container[data-type='towards_village']") &&
        htmlDoc.querySelector("#support_sum"),
    );
    if (isInfoVillageLike && commandId) {
      const commandRow =
        htmlDoc.querySelector(`.quickedit-out[data-id="${escapeCssSelector(commandId)}"]`)?.closest("tr") ||
        htmlDoc.querySelector(`[data-command-id="${escapeCssSelector(commandId)}"]`)?.closest("tr");
      if (commandRow) {
        const rowUnits = {};
        Array.from(commandRow.querySelectorAll("[title], [data-icon-hint]")).forEach(
          (node) => {
            if (!node) return;
            const payloads = [
              cleanText(node.getAttribute("title")),
              cleanText(node.getAttribute("data-original-title")),
              cleanText(node.getAttribute("data-icon-hint")),
              cleanText(node.tooltipText),
            ].filter(Boolean);
            payloads.forEach((payload) => {
              Object.entries(
                parseUnitsMapFromTooltipPayload(payload, speedModel),
              ).forEach(([unit, count]) => {
                rowUnits[unit] = Math.max(0, toInt(rowUnits[unit]) || 0) + Math.max(0, toInt(count) || 0);
              });
            });
          },
        );
        const normalizedRowUnits = normalizeSupportUnitsMap(rowUnits, speedModel);
        if (Object.keys(normalizedRowUnits).length) return normalizedRowUnits;
      }
      return {};
    }
    const unitsFromDoc = normalizeSupportUnitsMap(
      extractSupportUnitsFromCommandDoc(htmlDoc, speedModel),
      speedModel,
    );
    if (Object.keys(unitsFromDoc).length) return unitsFromDoc;
    return {};
  };

  const fetchSupportUnitsForSliceConflictCommand = async (command) => {
    const detailsSourceTag = "info_command_v2";
    const commandId = resolveSliceConflictCommandId(command);
    const commandUrl = resolveSliceConflictCommandUrl(command);
    const cacheKey = commandId || commandUrl;
    const cache = getSliceConflictSupportDetailsCache();
    if (cacheKey && cache[cacheKey] && typeof cache[cacheKey] === "object") {
      const sameSource = cleanText(cache[cacheKey].source) === detailsSourceTag;
      if (sameSource) {
        const cachedUnits = normalizeSupportUnitsMap(
          cache[cacheKey].units,
          state.speedModel,
        );
        if (Object.keys(cachedUnits).length) return cachedUnits;
      }
    }
    const commandUrls = buildSliceConflictCommandUrlVariants(command);
    if (!commandUrls.length) return {};
    let lastError = null;
    for (const candidateUrl of commandUrls) {
      try {
        const payloadText = await fetchTextWithRetry(candidateUrl, { retries: 1 });
        const parsedUnits = normalizeSupportUnitsMap(
          extractSupportUnitsFromAnyPayloadText(
            payloadText,
            state.speedModel,
            command,
          ),
          state.speedModel,
        );
        if (Object.keys(parsedUnits).length) {
          if (cacheKey) {
            cache[cacheKey] = {
              fetchedAtMs: getServerNowMs(),
              commandUrl: candidateUrl,
              units: parsedUnits,
              source: detailsSourceTag,
            };
          }
          return parsedUnits;
        }
      } catch (error) {
        lastError = error;
      }
    }
    if (cacheKey) {
      cache[cacheKey] = {
        fetchedAtMs: getServerNowMs(),
        commandUrl: commandUrl || commandUrls[0] || null,
        units: {},
        failed: true,
        error: formatErrorText(lastError),
        source: detailsSourceTag,
      };
    }
    return {};
  };

  const buildAllySliceConflictSummaryByInfoVillageWindow = async (windowInfo) => {
    const targetCoord = cleanText(windowInfo && windowInfo.targetCoord);
    if (!targetCoord) {
      return {
        usedNetwork: false,
        summary: null,
        debug: { reason: "no_target_coord" },
      };
    }
    let targetVillageId = null;
    try {
      targetVillageId = await resolveVillageIdByWorldMap(targetCoord);
    } catch (error) {
      return {
        usedNetwork: false,
        summary: null,
        debug: {
          reason: "world_map_fetch_failed",
          error: formatErrorText(error),
        },
      };
    }
    if (!targetVillageId) {
      targetVillageId = resolveVillageIdByCoord(targetCoord);
    }
    if (!targetVillageId) {
      return {
        usedNetwork: false,
        summary: null,
        debug: { reason: "village_id_not_found", targetCoord },
      };
    }
    const infoUrl =
      buildVillageInfoUrlByCoordOrId(targetCoord, targetVillageId) ||
      buildGameUrl({ screen: "info_village", id: String(targetVillageId) });
    const doc = await fetchDocument(infoUrl);
    const supportCommands = extractSupportCommandsFromInfoVillageDoc(doc, {
      targetCoord,
    });
    const matched = [];
    const summedUnits = {};
    const collectUnits = (command) => {
      const units = normalizeSupportUnitsMap(
        command && command.squadUnits,
        state.speedModel,
      );
      getSortedUnitKeys(units).forEach((unit) => {
        const count = Math.max(0, toInt(units[unit]) || 0);
        if (!count) return;
        summedUnits[unit] = Math.max(0, toInt(summedUnits[unit]) || 0) + count;
      });
    };
    supportCommands.forEach((command) => {
      const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
      const inWindow = isCommandArrivalInSliceConflictWindow(
        command,
        windowInfo,
        arrivalCandidates,
      );
      if (!inWindow) return;
      matched.push(command);
    });
    let resolvedUnitsRows = 0;
    for (let index = 0; index < matched.length; index += 1) {
      const command = matched[index];
      const detailedUnits = await fetchSupportUnitsForSliceConflictCommand(command);
      const finalUnits = Object.keys(detailedUnits).length ? detailedUnits : {};
      if (Object.keys(finalUnits).length) resolvedUnitsRows += 1;
      matched[index] = {
        ...command,
        squadUnits: finalUnits,
      };
      collectUnits(matched[index]);
    }
    const summary =
      matched.length > 0
        ? {
            ...windowInfo,
            matchedCount: matched.length,
            unknownTargetCount: 0,
            timeOnlyCount: 0,
            targetGraceCount: 0,
            summedUnits,
            unitsHtml: formatPlanUnitsIconsHtml(summedUnits),
          }
        : null;
    return {
      usedNetwork: true,
      summary,
      debug: {
        targetCoord,
        targetVillageId: String(targetVillageId),
        infoUrl,
        supportRows: supportCommands.length,
        windowRows: matched.length,
        resolvedUnitsRows,
        matchedSample: matched.slice(0, 8).map((command) => ({
          id: cleanText(command.id) || null,
          commandId: resolveSliceConflictCommandId(command),
          commandUrl: resolveSliceConflictCommandUrl(command),
          arrivalEpochMs: toFiniteEpochMs(command.arrivalEpochMs),
          squadUnits: normalizeUnitsMap(command.squadUnits),
        })),
        sample: supportCommands.slice(0, 8).map((command) => ({
          id: cleanText(command.id) || null,
          targetCoord: cleanText(command.targetCoord) || null,
          arrivalEpochMs: toFiniteEpochMs(command.arrivalEpochMs),
          arrivalText: cleanText(command.arrivalText) || null,
          commandType: cleanText(command.commandType) || null,
        })),
      },
    };
  };

  const hasActiveHubBackgroundLoading = () =>
    Boolean(
      state.refreshInProgress ||
        state.hubSyncInFlight ||
        state.hubQueryLoading ||
        state.hubOwnQueriesLoading ||
        state.hubMassLoading ||
        state.hubTribeLoading ||
        state.hubPlanLoading,
    );

  const buildAllySliceConflictSummaryByWindowAsync = async (
    windowInfo,
    { source = null } = {},
  ) => {
    if (!windowInfo || !cleanText(windowInfo.targetCoord)) return null;
    const sourceTag = cleanText(source) || "unknown";
    const effectiveWindow =
      normalizeSliceConflictWindowForCheck(windowInfo) || windowInfo;
    const cacheFirstSummary = buildAllySliceConflictSummaryByWindow(effectiveWindow);
    logSliceConflictDebug(`${sourceTag}_cache_priority`, {
      conflictFound: Boolean(cacheFirstSummary),
      matchedCount: Math.max(
        0,
        toInt(cacheFirstSummary && cacheFirstSummary.matchedCount) || 0,
      ),
    });
    if (cacheFirstSummary) {
      return cacheFirstSummary;
    }

    if (hasActiveHubBackgroundLoading()) {
      logSliceConflictDebug(`${sourceTag}_network_lookup_skipped_busy`, {
        refreshInProgress: Boolean(state.refreshInProgress),
        hubSyncInFlight: Boolean(state.hubSyncInFlight),
        hubQueryLoading: Boolean(state.hubQueryLoading),
        hubOwnQueriesLoading: Boolean(state.hubOwnQueriesLoading),
        hubMassLoading: Boolean(state.hubMassLoading),
        hubTribeLoading: Boolean(state.hubTribeLoading),
        hubPlanLoading: Boolean(state.hubPlanLoading),
      });
      return null;
    }

    const networkLookupTimeoutMs = 3500;
    try {
      const networkResult = await Promise.race([
        buildAllySliceConflictSummaryByInfoVillageWindow(effectiveWindow),
        sleep(networkLookupTimeoutMs).then(() => ({
          usedNetwork: false,
          timedOut: true,
          summary: null,
          debug: { reason: "timeout", timeoutMs: networkLookupTimeoutMs },
        })),
      ]);
      logSliceConflictDebug(`${sourceTag}_network_lookup`, networkResult.debug);
      if (!networkResult || !networkResult.timedOut) {
        logSliceConflictDebug(`${sourceTag}_window_effective`, {
          targetCoord:
            cleanText(effectiveWindow && effectiveWindow.targetCoord) || null,
          timingLabel:
            cleanText(effectiveWindow && effectiveWindow.timingLabel) || null,
          startMs: toFiniteEpochMs(effectiveWindow && effectiveWindow.startMs),
          endMs: toFiniteEpochMs(effectiveWindow && effectiveWindow.endMs),
          clamped: Boolean(effectiveWindow && effectiveWindow.conflictWindowClamped),
          originalStartMs: toFiniteEpochMs(
            effectiveWindow && effectiveWindow.conflictWindowOriginalStartMs,
          ),
          originalEndMs: toFiniteEpochMs(
            effectiveWindow && effectiveWindow.conflictWindowOriginalEndMs,
          ),
        });
        if (networkResult.usedNetwork) {
          return networkResult.summary;
        }
      }
    } catch (error) {
      logSliceConflictDebug(`${sourceTag}_network_lookup_error`, {
        error: formatErrorText(error),
      });
    }
    const fallback = buildAllySliceConflictSummaryByWindow(effectiveWindow);
    logSliceConflictDebug(`${sourceTag}_fallback_cache`, {
      conflictFound: Boolean(fallback),
      matchedCount: Math.max(0, toInt(fallback && fallback.matchedCount) || 0),
    });
    return fallback;
  };

  const buildAllySliceConflictSummaryByWindow = (windowInfo) => {
    if (!windowInfo || !cleanText(windowInfo.targetKey)) return null;
    const normalizedCachedCommands = getSliceConflictCommandCandidates();
    if (!normalizedCachedCommands.length) return null;
    const matched = [];
    const matchedByTargetGrace = [];
    const summedUnits = {};
    const collectUnits = (command) => {
      const units = normalizeUnitsMap(command.squadUnits);
      getSortedUnitKeys(units).forEach((unit) => {
        const count = Math.max(0, toInt(units[unit]) || 0);
        if (!count) return;
        summedUnits[unit] = Math.max(0, toInt(summedUnits[unit]) || 0) + count;
      });
    };
    normalizedCachedCommands.forEach((command) => {
      if (!command) return;
      const nature = getTribeTimelineEntryNature(command);
      if (nature !== "support") return;
      const commandTarget = cleanText(command.targetCoord || command.target);
      const hasTargetTokens = buildCoordTokens(commandTarget).size > 0;
      if (!hasCoordTokenIntersection(windowInfo.targetCoord, commandTarget)) return;
      const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
      const inWindow = isCommandArrivalInSliceConflictWindow(
        command,
        windowInfo,
        arrivalCandidates,
      );
      if (!inWindow) return;
      matched.push(command);
      collectUnits(command);
    });
    if (!matched.length) {
      const strictStart = toFiniteEpochMs(windowInfo.startMs);
      const strictEnd = toFiniteEpochMs(windowInfo.endMs);
      if (Number.isFinite(strictStart) && Number.isFinite(strictEnd)) {
        const graceWindow = {
          ...windowInfo,
          startMs: Math.min(strictStart, strictEnd) - 50,
          endMs: Math.max(strictStart, strictEnd) + 50,
        };
        normalizedCachedCommands.forEach((command) => {
          if (!command) return;
          const nature = getTribeTimelineEntryNature(command);
          if (nature !== "support") return;
          const commandTarget = cleanText(command.targetCoord || command.target);
          if (!hasCoordTokenIntersection(windowInfo.targetCoord, commandTarget)) return;
          const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
          const inWindow = isCommandArrivalInSliceConflictWindow(
            command,
            graceWindow,
            arrivalCandidates,
          );
          if (!inWindow) return;
          matched.push(command);
          matchedByTargetGrace.push(command);
          collectUnits(command);
        });
      }
    }
    if (!matched.length) return null;
    return {
      ...windowInfo,
      matchedCount: matched.length,
      unknownTargetCount: 0,
      timeOnlyCount: 0,
      targetGraceCount: matchedByTargetGrace.length,
      summedUnits,
      unitsHtml: formatPlanUnitsIconsHtml(summedUnits),
    };
  };

  const buildAllySliceConflictSummaryFromCache = (rowElement) => {
    const windowInfo = buildSliceTimingWindowFromRow(rowElement);
    return buildAllySliceConflictSummaryByWindow(windowInfo);
  };

  const buildAllySliceConflictSummaryFromPlanCommand = (commandRaw) => {
    const windowInfo = buildSliceTimingWindowFromPlanCommand(commandRaw);
    return buildAllySliceConflictSummaryByWindow(windowInfo);
  };

  const buildSliceConflictDebugSnapshot = (windowInfo) => {
    const normalizedCachedCommands = getSliceConflictCommandCandidates();
    const ownRowsCount = buildOwnCommandsCacheRowsForConflict().length;
    const snapshot = {
      hasWindow: Boolean(windowInfo && cleanText(windowInfo.targetKey)),
      window: windowInfo
        ? {
            action: cleanText(windowInfo.action) || null,
            incomingId: cleanText(windowInfo.incomingId) || null,
            targetCoord: cleanText(windowInfo.targetCoord) || null,
            targetKey: cleanText(windowInfo.targetKey) || null,
            startMs: toFiniteEpochMs(windowInfo.startMs),
            endMs: toFiniteEpochMs(windowInfo.endMs),
            timingLabel: cleanText(windowInfo.timingLabel) || null,
          }
        : null,
      cacheRows: normalizedCachedCommands.length,
      ownRows: ownRowsCount,
      supportRows: 0,
      targetRows: 0,
      windowRows: 0,
      invalidArrivalRows: 0,
      unknownTargetRowsInWindow: 0,
      timeOnlySupportRowsInWindow: 0,
      sample: [],
      windowOnlySample: [],
    };
    normalizedCachedCommands.forEach((command) => {
      const nature = getTribeTimelineEntryNature(command);
      const targetCoord = cleanText(command && (command.targetCoord || command.target));
      const targetKey = normalizeCoordKey(targetCoord);
      const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
      const dayCandidates = getCommandArrivalDayMsCandidates(
        command,
        arrivalCandidates,
      );
      if (nature === "support") snapshot.supportRows += 1;
      if (
        nature === "support" &&
        snapshot.hasWindow &&
        hasCoordTokenIntersection(snapshot.window.targetCoord, targetCoord)
      ) {
        snapshot.targetRows += 1;
        const inWindow = isCommandArrivalInSliceConflictWindow(
          command,
          snapshot.window,
          arrivalCandidates,
        );
        if (inWindow) {
          snapshot.windowRows += 1;
        } else if (!arrivalCandidates.length) {
          snapshot.invalidArrivalRows += 1;
        }
      }
      if (nature === "support" && snapshot.hasWindow) {
        const hasTargetTokens = buildCoordTokens(targetCoord).size > 0;
        const inWindowByAnyTarget = isCommandArrivalInSliceConflictWindow(
          command,
          snapshot.window,
          arrivalCandidates,
        );
        if (inWindowByAnyTarget) {
          snapshot.timeOnlySupportRowsInWindow += 1;
          if (snapshot.windowOnlySample.length < 8) {
            snapshot.windowOnlySample.push({
              id:
                cleanText(command && command.id) ||
                cleanText(command && command.sourceCommandId) ||
                null,
              targetCoord: targetCoord || null,
              nature,
              kind: cleanText(command && command.kindText) || null,
              arrivalMs: arrivalCandidates.length
                ? Math.round(arrivalCandidates[0])
                : null,
              arrivalText: cleanText(command && command.arrivalText) || null,
              dayCandidates: dayCandidates,
            });
          }
        }
        if (!hasTargetTokens) {
          if (inWindowByAnyTarget) snapshot.unknownTargetRowsInWindow += 1;
        }
      }
      if (snapshot.sample.length < 8) {
        snapshot.sample.push({
          id:
            cleanText(command && command.id) ||
            cleanText(command && command.sourceCommandId) ||
            null,
          nature,
          kind: cleanText(command && command.kindText) || null,
          commandType: cleanText(command && command.commandType) || null,
          targetCoord: targetCoord || null,
          targetKey: targetKey || null,
          arrivalMs: arrivalCandidates.length ? Math.round(arrivalCandidates[0]) : null,
          arrivalText: cleanText(command && command.arrivalText) || null,
          arrivalCandidatesCount: arrivalCandidates.length,
          dayCandidates: dayCandidates,
        });
      }
    });
    return snapshot;
  };

  const buildSliceConflictFullDebugDump = (windowInfo) => {
    const commands = getSliceConflictCommandCandidates();
    const ownNickNorm = String(safe(() => window.game_data.player.name, "") || "")
      .trim()
      .toLowerCase();
    const windowStartMs = toFiniteEpochMs(windowInfo && windowInfo.startMs);
    const windowEndMs = toFiniteEpochMs(windowInfo && windowInfo.endMs);
    const windowTargetCoord = cleanText(windowInfo && windowInfo.targetCoord);
    const windowTokens = Array.from(buildCoordTokens(windowTargetCoord));
    const windowDayRange = resolveWindowDayRangeFromWindowInfo(windowInfo);
    const mappedSupport = [];
    commands.forEach((command) => {
      const nature = getTribeTimelineEntryNature(command);
      if (nature !== "support") return;
      const commandTargetCoord = cleanText(command && (command.targetCoord || command.target));
      const commandTargetTokens = Array.from(buildCoordTokens(commandTargetCoord));
      const arrivalCandidates = extractEpochMsCandidatesFromCommand(command);
      const dayCandidates = getCommandArrivalDayMsCandidates(command, arrivalCandidates);
      const intersectsTarget = hasCoordTokenIntersection(
        windowTargetCoord,
        commandTargetCoord,
      );
      const inWindowStrict = isCommandArrivalInSliceConflictWindow(
        command,
        windowInfo,
        arrivalCandidates,
      );
      const inWindowPlus50ms =
        Number.isFinite(windowStartMs) && Number.isFinite(windowEndMs)
          ? isCommandArrivalInSliceConflictWindow(
              command,
              {
                ...windowInfo,
                startMs: Math.min(windowStartMs, windowEndMs) - 50,
                endMs: Math.max(windowStartMs, windowEndMs) + 50,
              },
              arrivalCandidates,
            )
          : false;
      const ownerNick = cleanText(
        command &&
          (command.ownerNick ||
            command.nick ||
            command.player ||
            command.attackerNick),
      );
      const ownerNickNorm = String(ownerNick || "")
        .trim()
        .toLowerCase();
      const sourceTag = cleanText(command && command.source);
      const isOwn =
        sourceTag === "own_overview_commands" ||
        (ownNickNorm && ownerNickNorm && ownNickNorm === ownerNickNorm);
      mappedSupport.push({
        id:
          cleanText(command && command.id) ||
          cleanText(command && command.sourceCommandId) ||
          null,
        source: sourceTag || null,
        ownerNick: ownerNick || null,
        isOwn,
        commandType: cleanText(command && command.commandType) || null,
        kindText: cleanText(command && command.kindText) || null,
        targetCoord: commandTargetCoord || null,
        targetTokens: commandTargetTokens,
        arrivalText:
          cleanText(command && command.arrivalText) ||
          cleanText(command && command.arrivalServerTimeMsText) ||
          null,
        arrivalServerTimeMsText:
          cleanText(command && command.arrivalServerTimeMsText) || null,
        etaEpochMs: toFiniteEpochMs(command && command.etaEpochMs),
        arrivalEpochMs: toFiniteEpochMs(
          command && (command.arrivalEpochMs || command.arrivalAtMs || command.arrivalMs),
        ),
        arrivalCandidates,
        dayCandidates,
        intersectsTarget,
        inWindowStrict,
        inWindowPlus50ms,
        matchState:
          intersectsTarget && inWindowStrict
            ? "target+window"
            : intersectsTarget && inWindowPlus50ms
              ? "target+window(+50ms)"
              : !intersectsTarget && inWindowStrict
                ? "window_only"
                : "no_match",
      });
    });
    return {
      window: {
        action: cleanText(windowInfo && windowInfo.action) || null,
        incomingId: cleanText(windowInfo && windowInfo.incomingId) || null,
        targetCoord: windowTargetCoord || null,
        targetTokens: windowTokens,
        startMs: windowStartMs,
        endMs: windowEndMs,
        timingLabel: cleanText(windowInfo && windowInfo.timingLabel) || null,
        dayRange: windowDayRange,
      },
      counts: {
        allCandidates: commands.length,
        supportCandidates: mappedSupport.length,
        ownSupportCandidates: mappedSupport.filter((row) => row.isOwn).length,
        allySupportCandidates: mappedSupport.filter((row) => !row.isOwn).length,
        strictMatches: mappedSupport.filter(
          (row) => row.intersectsTarget && row.inWindowStrict,
        ).length,
        plus50Matches: mappedSupport.filter(
          (row) => row.intersectsTarget && row.inWindowPlus50ms,
        ).length,
        windowOnlyMatches: mappedSupport.filter(
          (row) => !row.intersectsTarget && row.inWindowStrict,
        ).length,
      },
      allySupportCommands: mappedSupport.filter((row) => !row.isOwn),
      ownSupportCommands: mappedSupport.filter((row) => row.isOwn),
    };
  };

  const askSliceConflictProceedDialog = ({ summary } = {}) =>
    new Promise((resolve) => {
      const info =
        summary && typeof summary === "object"
          ? summary
          : buildAllySliceConflictSummaryFromCache(null);
      if (!info) {
        resolve(true);
        return;
      }
      const root = document.body;
      const backdrop = document.createElement("div");
      backdrop.className = "smm-confirm-dialog-backdrop";
      backdrop.style.position = "fixed";
      backdrop.style.inset = "0";
      backdrop.style.display = "flex";
      backdrop.style.alignItems = "center";
      backdrop.style.justifyContent = "center";
      backdrop.style.background = "rgba(15,9,2,.52)";
      backdrop.style.zIndex = "2147483646";
      const coordText = cleanText(info.targetCoord) || "?";
      const timingText = cleanText(info.timingLabel) || "—";
      const matchedCount = Math.max(1, toInt(info.matchedCount) || 1);
      const unknownTargetCount = Math.max(
        0,
        toInt(info.unknownTargetCount) || 0,
      );
      const timeOnlyCount = Math.max(0, toInt(info.timeOnlyCount) || 0);
      const targetGraceCount = Math.max(0, toInt(info.targetGraceCount) || 0);
      const unitsHtmlRaw =
        typeof info.unitsHtml === "string" && info.unitsHtml
          ? info.unitsHtml
          : formatPlanUnitsIconsHtml(
              normalizeSupportUnitsMap(info.summedUnits, state.speedModel),
            );
      const unitsHtml =
        typeof unitsHtmlRaw === "string" && unitsHtmlRaw
          ? unitsHtmlRaw
          : "—";
      logSliceConflictDebug("modal_open", {
        targetCoord: coordText,
        timingLabel: timingText,
        matchedCount,
        unknownTargetCount,
        timeOnlyCount,
        targetGraceCount,
        hasUnitsHtml: Boolean(cleanText(unitsHtml) && cleanText(unitsHtml) !== "—"),
      });
      const favoriteId = cleanText(summary && summary.favoriteId) || null;
      const canDeleteFavorite = Boolean(favoriteId);
      backdrop.innerHTML = `
<div class="smm-confirm-dialog-card" role="dialog" aria-modal="true">
  <div class="smm-confirm-dialog-title">Уже идёт срез соплеменников</div>
  <div class="smm-confirm-dialog-text">Цель: ${escapeHtml(coordText)} · окно: ${escapeHtml(
        timingText,
      )} · совпадений: ${escapeHtml(String(matchedCount))}</div>
  ${
    unknownTargetCount > 0
      ? `<div class="smm-confirm-dialog-text">Часть совпадений без распознанной цели: ${escapeHtml(
          String(unknownTargetCount),
        )}</div>`
      : ""
  }
  ${
    timeOnlyCount > 0 && unknownTargetCount <= 0
      ? `<div class="smm-confirm-dialog-text">Совпадение найдено по времени окна (без точной цели): ${escapeHtml(
          String(timeOnlyCount),
        )}</div>`
      : ""
  }
  ${
    targetGraceCount > 0
      ? `<div class="smm-confirm-dialog-text">Совпадение найдено в расширенном окне цели (±50мс): ${escapeHtml(
          String(targetGraceCount),
        )}</div>`
      : ""
  }
  <div class="smm-confirm-dialog-text">Суммарно: ${unitsHtml}</div>
  <div class="smm-confirm-dialog-actions">
    <button type="button" class="smm-btn smm-confirm-cancel-btn">${
      canDeleteFavorite ? "Удалить из избранного" : "Отменить отправку"
    }</button>
    <button type="button" class="smm-btn smm-confirm-yes-btn">Отправить всё равно</button>
  </div>
</div>`;
      const card = backdrop.querySelector(".smm-confirm-dialog-card");
      if (card) {
        card.style.width = "min(560px,94vw)";
        card.style.padding = "12px";
        card.style.border = "1px solid #b89a5a";
        card.style.borderRadius = "12px";
        card.style.background =
          "linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%)";
        card.style.boxShadow = "0 18px 60px rgba(0,0,0,.3)";
      }
      const close = ({
        accepted = false,
        favoriteRemoved = false,
        favoriteId: closedFavoriteId = null,
      } = {}) => {
        if (backdrop && backdrop.parentNode)
          backdrop.parentNode.removeChild(backdrop);
        logSliceConflictDebug("modal_close", {
          accepted: Boolean(accepted),
          favoriteRemoved: Boolean(favoriteRemoved),
          favoriteId: cleanText(closedFavoriteId) || null,
          targetCoord: coordText,
          timingLabel: timingText,
        });
        resolve({
          accepted: Boolean(accepted),
          favoriteRemoved: Boolean(favoriteRemoved),
          favoriteId: cleanText(closedFavoriteId) || null,
        });
      };
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) close({ accepted: false });
      });
      const yesButton = backdrop.querySelector(".smm-confirm-yes-btn");
      const cancelButton = backdrop.querySelector(".smm-confirm-cancel-btn");
      if (yesButton) yesButton.addEventListener("click", () => close({ accepted: true }));
      if (cancelButton) {
        cancelButton.addEventListener("click", () => {
          if (!canDeleteFavorite || !favoriteId) {
            close({ accepted: false });
            return;
          }
          const removed = removeFavoriteEntryById(favoriteId);
          close({
            accepted: false,
            favoriteRemoved: removed,
            favoriteId,
          });
        });
      }
      root.appendChild(backdrop);
    });

  const buildScheduledCommandTimingWindow = (commandRaw) => {
    const command = normalizeScheduledCommand(commandRaw);
    if (!command) return null;
    const startMs = toFiniteEpochMs(command.timingStartMs);
    const endMs = toFiniteEpochMs(command.timingEndMs);
    const pointMs = toFiniteEpochMs(command.timingPointMs);
    const incomingEtaMs = toFiniteEpochMs(command.incomingEtaMs);
    const rawLabel = cleanText(command.timingLabel);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      const fromMs = Math.min(startMs, endMs);
      const toMs = Math.max(startMs, endMs);
      return {
        type: "range",
        startMs: fromMs,
        endMs: toMs,
        label: buildNormalizedTimingLabel({
          timingType: command.timingType,
          timingLabel: command.timingLabel,
          timingStartMs: fromMs,
          timingEndMs: toMs,
          timingPointMs: command.timingPointMs,
          units: command.units,
        }),
      };
    }
    if (Number.isFinite(pointMs)) {
      return {
        type: "point",
        startMs: pointMs,
        endMs: pointMs,
        label: buildNormalizedTimingLabel({
          timingType: command.timingType,
          timingLabel: command.timingLabel,
          timingPointMs: pointMs,
          units: command.units,
        }),
      };
    }
    if (Number.isFinite(incomingEtaMs)) {
      return {
        type: "eta",
        startMs: incomingEtaMs,
        endMs: incomingEtaMs,
        label: formatTimeWithMs(incomingEtaMs),
      };
    }
    if (rawLabel && rawLabel !== "—") {
      return {
        type: "label",
        startMs: null,
        endMs: null,
        label: rawLabel,
      };
    }
    return null;
  };

  const scheduledCommandTimingWindowsMatch = (
    leftWindow,
    rightWindow,
    toleranceMs = 50,
  ) => {
    if (!leftWindow || !rightWindow) return false;
    const leftHasMs =
      Number.isFinite(leftWindow.startMs) && Number.isFinite(leftWindow.endMs);
    const rightHasMs =
      Number.isFinite(rightWindow.startMs) && Number.isFinite(rightWindow.endMs);
    if (leftHasMs && rightHasMs) {
      const leftStart = Math.min(leftWindow.startMs, leftWindow.endMs);
      const leftEnd = Math.max(leftWindow.startMs, leftWindow.endMs);
      const rightStart = Math.min(rightWindow.startMs, rightWindow.endMs);
      const rightEnd = Math.max(rightWindow.startMs, rightWindow.endMs);
      return (
        Math.abs(leftStart - rightStart) <= toleranceMs &&
        Math.abs(leftEnd - rightEnd) <= toleranceMs
      );
    }
    const leftLabel = cleanText(leftWindow.label);
    const rightLabel = cleanText(rightWindow.label);
    return Boolean(leftLabel && rightLabel && leftLabel === rightLabel);
  };

  const buildLocalScheduledDuplicateSummary = (commandRaw) => {
    const command = normalizeScheduledCommand(commandRaw);
    if (!command) return null;
    const targetCoord = normalizeCoordIdentity(command.targetCoord);
    const timingWindow = buildScheduledCommandTimingWindow(command);
    if (!targetCoord || !timingWindow) return null;
    const commandId = String(cleanText(command.id) || "");
    const scheduled = syncScheduledCommandsFromStorage();
    const matches = (Array.isArray(scheduled) ? scheduled : [])
      .map((item) => normalizeScheduledCommand(item))
      .filter(Boolean)
      .filter((item) => !isFinalManeuverStatus(item.status))
      .filter((item) => String(cleanText(item.id) || "") !== commandId)
      .filter(
        (item) => normalizeCoordIdentity(item.targetCoord) === targetCoord,
      )
      .filter((item) =>
        scheduledCommandTimingWindowsMatch(
          buildScheduledCommandTimingWindow(item),
          timingWindow,
        ),
      );
    if (!matches.length) return null;

    const summedUnits = {};
    matches.forEach((item) => {
      const itemUnits = normalizeUnitsMap(item.units);
      Object.entries(itemUnits).forEach(([unit, count]) => {
        const safeCount = Math.max(0, toInt(count) || 0);
        if (!unit || safeCount <= 0) return;
        summedUnits[unit] = (summedUnits[unit] || 0) + safeCount;
      });
    });
    const originSamples = matches
      .map((item) => cleanText(item.fromVillageCoord || item.fromVillageId))
      .filter(Boolean)
      .slice(0, 5);
    return {
      targetCoord,
      timingLabel:
        cleanText(timingWindow.label) ||
        buildNormalizedTimingLabel({
          timingType: command.timingType,
          timingLabel: command.timingLabel,
          timingStartMs: command.timingStartMs,
          timingEndMs: command.timingEndMs,
          timingPointMs: command.timingPointMs,
          units: command.units,
        }),
      duplicateCount: matches.length,
      summedUnits,
      originSamples,
      matches,
    };
  };

  const confirmLocalScheduledDuplicate = (commandRaw) =>
    new Promise((resolve) => {
      const summary = buildLocalScheduledDuplicateSummary(commandRaw);
      if (!summary) {
        resolve(true);
        return;
      }
      const targetText = cleanText(summary.targetCoord) || "?";
      const timingText = cleanText(summary.timingLabel) || "—";
      const duplicateCount = Math.max(1, toInt(summary.duplicateCount) || 1);
      const unitsHtml =
        formatPlanUnitsIconsHtml(
          normalizeSupportUnitsMap(summary.summedUnits, state.speedModel),
        ) || "—";
      const originText = summary.originSamples.length
        ? summary.originSamples.join(", ")
        : null;
      if (DEBUG_VERBOSE_LOGS) {
        console.info(`${LOG_PREFIX} [plan-schedule][local-duplicate]`, {
          version: VERSION,
          targetCoord: targetText,
          timingLabel: timingText,
          duplicateCount,
          summedUnits: normalizeUnitsMap(summary.summedUnits),
          originSamples: summary.originSamples,
        });
      }
      const plainMessage = `На цель ${targetText} в окно ${timingText} уже запланировано отправок: ${duplicateCount}. Всё равно запланировать?`;
      const root =
        document.body || (state.ui && state.ui.root ? state.ui.root : null);
      if (!root) {
        resolve(Boolean(window.confirm(plainMessage)));
        return;
      }

      const backdrop = document.createElement("div");
      backdrop.className = "smm-confirm-dialog-backdrop";
      backdrop.style.position = "fixed";
      backdrop.style.inset = "0";
      backdrop.style.display = "flex";
      backdrop.style.alignItems = "center";
      backdrop.style.justifyContent = "center";
      backdrop.style.padding = "12px";
      backdrop.style.background = "rgba(15,9,2,.52)";
      backdrop.style.zIndex = "2147483646";
      backdrop.style.boxSizing = "border-box";
      backdrop.innerHTML = `
<div class="smm-confirm-dialog-card" role="dialog" aria-modal="true">
  <div class="smm-confirm-dialog-title">Уже запланировано на это окно</div>
  <div class="smm-confirm-dialog-text">Цель: ${escapeHtml(targetText)} · окно: ${escapeHtml(
        timingText,
      )} · уже запланировано отправок: ${escapeHtml(String(duplicateCount))}</div>
  <div class="smm-confirm-dialog-text">Суммарно уже в плане: ${unitsHtml}</div>
  ${
    originText
      ? `<div class="smm-confirm-dialog-text">Откуда: ${escapeHtml(originText)}${
          duplicateCount > summary.originSamples.length ? "…" : ""
        }</div>`
      : ""
  }
  <div class="smm-confirm-dialog-actions">
    <button type="button" class="smm-btn smm-confirm-cancel-btn">Отмена</button>
    <button type="button" class="smm-btn smm-confirm-yes-btn">Всё равно запланировать</button>
  </div>
</div>`;
      const card = backdrop.querySelector(".smm-confirm-dialog-card");
      if (card) {
        card.style.width = "min(560px,94vw)";
        card.style.padding = "12px";
        card.style.border = "1px solid #b89a5a";
        card.style.borderRadius = "12px";
        card.style.background =
          "linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%)";
        card.style.boxShadow = "0 18px 60px rgba(0,0,0,.3)";
        card.style.fontFamily = '"Trebuchet MS","Segoe UI",sans-serif';
        card.style.color = "#4d3918";
      }
      const titleNode = backdrop.querySelector(".smm-confirm-dialog-title");
      if (titleNode) {
        titleNode.style.fontSize = "14px";
        titleNode.style.fontWeight = "800";
        titleNode.style.color = "#4b310d";
        titleNode.style.marginBottom = "7px";
      }
      Array.from(backdrop.querySelectorAll(".smm-confirm-dialog-text")).forEach(
        (node) => {
          node.style.fontSize = "12px";
          node.style.lineHeight = "1.4";
          node.style.color = "#4d3918";
          node.style.marginTop = "4px";
        },
      );
      const actionsNode = backdrop.querySelector(".smm-confirm-dialog-actions");
      if (actionsNode) {
        actionsNode.style.display = "flex";
        actionsNode.style.alignItems = "center";
        actionsNode.style.justifyContent = "flex-end";
        actionsNode.style.gap = "6px";
        actionsNode.style.marginTop = "10px";
      }
      const close = (accepted) => {
        if (backdrop && backdrop.parentNode)
          backdrop.parentNode.removeChild(backdrop);
        resolve(Boolean(accepted));
      };
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) close(false);
      });
      const yesButton = backdrop.querySelector(".smm-confirm-yes-btn");
      const cancelButton = backdrop.querySelector(".smm-confirm-cancel-btn");
      [cancelButton, yesButton].forEach((button) => {
        if (!button) return;
        button.style.border = "1px solid #b7904f";
        button.style.background =
          "linear-gradient(180deg,#f7e9ca 0%,#e1c58f 100%)";
        button.style.color = "#4c2f0c";
        button.style.borderRadius = "8px";
        button.style.padding = "5px 10px";
        button.style.fontSize = "12px";
        button.style.fontWeight = "700";
        button.style.cursor = "pointer";
      });
      if (yesButton) {
        yesButton.style.borderColor = "#8f2f13";
        yesButton.style.background =
          "linear-gradient(180deg,#ffddc7 0%,#f3b084 100%)";
        yesButton.style.color = "#5d1908";
      }
      if (yesButton) yesButton.addEventListener("click", () => close(true));
      if (cancelButton) {
        cancelButton.addEventListener("click", () => close(false));
      }
      root.appendChild(backdrop);
    });

  const buildHubIncomingFromQueryRow = (row, thresholdUnitsEq) => {
    if (!row || typeof row !== "object") return null;
    const rowKey = cleanText(row.rowKey);
    if (!rowKey) return null;

    const targetCoord = cleanText(row.targetCoord) || "?";
    const incomingEtaMs = toFiniteEpochMs(row.incomingEtaMs);
    const safeEtaMs = Number.isFinite(incomingEtaMs)
      ? Math.round(incomingEtaMs)
      : null;
    const arrivalMs =
      safeEtaMs !== null ? new Date(safeEtaMs).getMilliseconds() : null;
    const timerSeconds =
      safeEtaMs !== null
        ? Math.max(0, Math.round((safeEtaMs - getServerNowMs()) / 1000))
        : null;
    const matchedUnitsEqRaw = Math.max(0, Number(row.matchedUnitsEq) || 0);
    const matchedUnitsEqLocal = estimateMatchedUnitsEqFromLocalCacheForHubQuery(
      row,
    );
    const matchedUnitsEq = Math.max(matchedUnitsEqRaw, matchedUnitsEqLocal);
    if (DEBUG_VERBOSE_LOGS && matchedUnitsEqLocal > matchedUnitsEqRaw) {
      safe(() => {
        console.info("[ScriptMM][hub-query][local-fallback]", {
          rowKey: cleanText(row.rowKey) || null,
          targetCoord: cleanText(row.targetCoord) || null,
          raw: matchedUnitsEqRaw,
          local: matchedUnitsEqLocal,
          effective: matchedUnitsEq,
        });
        return true;
      }, false);
    }
    const plannedUnitsEq = Math.max(0, Number(row.plannedUnitsEq) || 0);
    const threshold = Math.max(0, Number(thresholdUnitsEq) || 0);
    const coveragePercent =
      threshold > 0 ? (matchedUnitsEq / threshold) * 100 : null;
    const plannedCoveragePercent =
      threshold > 0 ? (plannedUnitsEq / threshold) * 100 : null;
    if (!(threshold > 0)) return null;
    if (matchedUnitsEq >= threshold) return null;
    if (Number.isFinite(coveragePercent) && coveragePercent >= 100) return null;
    const actionKey = normalizePlanAction(cleanText(row.actionKey) || "slice");
    const actionLabel =
      cleanText(row.actionLabel) || getPlanActionLabelByKey(actionKey);
    const sigilPercentRaw = toNumber(row && row.sigilPercent);
    const sigilPercent = Number.isFinite(sigilPercentRaw)
      ? normalizeSigilPercent(sigilPercentRaw)
      : 0;

    const normalizedTimingLabel = buildNormalizedTimingLabel({
      timingType: cleanText(row.timingType) || null,
      timingLabel: cleanText(row.timingLabel) || null,
      timingStartMs: Number.isFinite(Number(row.timingStartMs))
        ? Math.round(Number(row.timingStartMs))
        : null,
      timingEndMs: Number.isFinite(Number(row.timingEndMs))
        ? Math.round(Number(row.timingEndMs))
        : null,
      timingPointMs: Number.isFinite(Number(row.timingPointMs))
        ? Math.round(Number(row.timingPointMs))
        : null,
      units: row.units,
    });

    return {
      id: `hubq_${rowKey}`,
      hubRowKey: rowKey,
      isHubIncoming: true,
      displayType: "hub_query",
      commandType: cleanText(row.actionKey) || "hub_query",
      actionKey,
      kindText: actionLabel || "Хаб",
      player: cleanText(row.nick) || "hub",
      originCoord: "hub",
      origin: "hub",
      targetCoord,
      target: targetCoord,
      arrivalText:
        (safeEtaMs !== null ? formatArrivalTextFromEpochMs(safeEtaMs) : null) ||
        cleanText(row.incomingEtaServerText) ||
        cleanText(row.timingLabel) ||
        "ETA n/a",
      arrivalMs,
      arrivalEpochMs: safeEtaMs,
      etaEpochMs: safeEtaMs,
      timerSeconds,
      timerText: Number.isFinite(timerSeconds)
        ? formatCountdown(timerSeconds)
        : "n/a",
      timingType: cleanText(row.timingType) || null,
      timingLabel: normalizedTimingLabel,
      timingStartMs: Number.isFinite(Number(row.timingStartMs))
        ? Math.round(Number(row.timingStartMs))
        : null,
      timingEndMs: Number.isFinite(Number(row.timingEndMs))
        ? Math.round(Number(row.timingEndMs))
        : null,
      timingPointMs: Number.isFinite(Number(row.timingPointMs))
        ? Math.round(Number(row.timingPointMs))
        : null,
      sigilPercent,
      hubMatchedUnitsEq: matchedUnitsEq,
      hubMatchedUnitsEqRaw: matchedUnitsEqRaw,
      hubMatchedUnitsEqLocal: matchedUnitsEqLocal,
      hubThresholdUnitsEq: threshold,
      hubCoveragePercent: Number.isFinite(coveragePercent)
        ? coveragePercent
        : null,
      hubPlannedUnitsEq: plannedUnitsEq,
      hubPlannedCoveragePercent: Number.isFinite(plannedCoveragePercent)
        ? plannedCoveragePercent
        : null,
    };
  };

  const buildHubMassIncomingFromRow = (row) => {
    if (!row || typeof row !== "object") return null;
    const targetCoord = cleanText(row.targetCoord);
    if (!targetCoord) return null;
    const requiredFullOffs = Math.max(0, Number(row.requiredFullOffs) || 0);
    const inPathFullOffs = Math.max(0, Number(row.inPathFullOffs) || 0);
    const requiredNobles = Math.max(0, Number(row.requiredNobles) || 0);
    const inPathNobles = Math.max(0, Number(row.inPathNobles) || 0);
    const plannedFullOffs = Math.max(0, Number(row.plannedFullOffs) || 0);
    const plannedNobles = Math.max(0, Number(row.plannedNobles) || 0);
    const plannedFullOffsPercent =
      requiredFullOffs > 0 ? (plannedFullOffs / requiredFullOffs) * 100 : 0;
    const plannedNoblesPercent =
      requiredNobles > 0 ? (plannedNobles / requiredNobles) * 100 : 0;
    const needsMore =
      (requiredFullOffs > 0 && inPathFullOffs < requiredFullOffs) ||
      (requiredNobles > 0 && inPathNobles < requiredNobles);
    if (!needsMore) return null;

    const displayArrivalMsRaw = Number(row.displayArrivalMs);
    const baseArrivalMsRaw = Number(row.baseArrivalMs);
    const safeEtaMs = Number.isFinite(displayArrivalMsRaw)
      ? Math.round(displayArrivalMsRaw)
      : Number.isFinite(baseArrivalMsRaw)
        ? Math.round(baseArrivalMsRaw)
        : null;
    if (!Number.isFinite(safeEtaMs)) return null;
    const arrivalMs = new Date(safeEtaMs).getMilliseconds();
    const timerSeconds = Math.max(
      0,
      Math.round((safeEtaMs - getServerNowMs()) / 1000),
    );
    const rowNumber = Math.max(0, Number(row.rowNumber) || 0);
    const id =
      rowNumber > 0
        ? `mass_${rowNumber}_${safeEtaMs}`
        : `mass_${String(targetCoord).replace(/[^\d|]/g, "")}_${safeEtaMs}`;
    return {
      id,
      isHubMass: true,
      displayType: "mass_alert",
      commandType: "mass_alert",
      kindText: "Выход в масс",
      player: "hub mass",
      originCoord: "mass",
      origin: "mass",
      targetCoord,
      target: targetCoord,
      arrivalText:
        formatArrivalTextFromEpochMs(safeEtaMs) ||
        cleanText(row.displayArrivalServerText) ||
        "ETA n/a",
      arrivalMs,
      arrivalEpochMs: safeEtaMs,
      etaEpochMs: safeEtaMs,
      timerSeconds,
      timerText: formatCountdown(timerSeconds),
      timingLabel: cleanText(row.shiftText) || null,
      massRequiredFullOffs: requiredFullOffs,
      massInPathFullOffs: inPathFullOffs,
      massRequiredNobles: requiredNobles,
      massInPathNobles: inPathNobles,
      massProgressText: `${inPathFullOffs}/${requiredFullOffs} оффов уже в пути и ${inPathNobles}/${requiredNobles} дворов уже в пути`,
      massPlannedFullOffText: `${plannedFullOffs}/${requiredFullOffs} (${formatHubCoveragePercent(plannedFullOffsPercent)}%)`,
      massPlannedNoblesText: `${plannedNobles}/${requiredNobles} (${formatHubCoveragePercent(plannedNoblesPercent)}%)`,
    };
  };

  const loadHubQueryIncomingsAsync = async ({
    force = false,
    silent = true,
  } = {}) => {
    const connection = ensureHubConnectionLoaded();
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) {
      clearHubQueryIncomings({ rerender: true });
      return [];
    }

    if (state.hubQueryLoading && !force) {
      return Array.isArray(state.hubQueryIncomings)
        ? state.hubQueryIncomings
        : [];
    }

    state.hubQueryLoading = true;
    state.hubQueryError = null;
    try {
      const response = await pullHubQueryAlerts({
        hubUrl,
        hubId: getHubSyncId(connection),
        nick: getHubSyncNick(),
        limit: HUB_QUERY_PULL_MAX_ROWS,
      });
      const thresholdUnitsEq = Number(response && response.thresholdUnitsEq);
      const rows = Array.isArray(response && response.rows)
        ? response.rows
        : [];
      const mapped = rows
        .map((row) => buildHubIncomingFromQueryRow(row, thresholdUnitsEq))
        .filter(Boolean)
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          if (Number.isFinite(av) && !Number.isFinite(bv)) return -1;
          if (!Number.isFinite(av) && Number.isFinite(bv)) return 1;
          return String((a && a.id) || "").localeCompare(
            String((b && b.id) || ""),
          );
        });

      const nextFingerprint = buildHubQueryIncomingsFingerprint(mapped);
      const changed = nextFingerprint !== state.hubQueryLastFingerprint;
      state.hubQueryIncomings = changed ? mapped : state.hubQueryIncomings;
      state.hubQueryLastFingerprint = nextFingerprint;
      state.hubQueryThreshold =
        Number.isFinite(thresholdUnitsEq) && thresholdUnitsEq > 0
          ? Math.round(thresholdUnitsEq)
          : null;
      state.hubQueryLastLoadedMs = getServerNowMs();
      state.hubQueryError = null;
      if (changed) {
        requestIncomingsRerender("hub_query_changed");
      }
      return Array.isArray(state.hubQueryIncomings)
        ? state.hubQueryIncomings
        : mapped;
    } catch (error) {
      state.hubQueryError = formatErrorText(error);
      if (!silent) {
        notifyHubStatus(`HubQuery: ${state.hubQueryError}`, true);
      }
      return Array.isArray(state.hubQueryIncomings)
        ? state.hubQueryIncomings
        : [];
    } finally {
      state.hubQueryLoading = false;
    }
  };

  const loadHubMassIncomingsAsync = async ({
    force = false,
    silent = true,
  } = {}) => {
    const connection = ensureHubConnectionLoaded();
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) {
      clearHubMassIncomings({ rerender: true });
      return [];
    }

    if (state.hubMassLoading && !force) {
      return Array.isArray(state.hubMassIncomings)
        ? state.hubMassIncomings
        : [];
    }

    state.hubMassLoading = true;
    state.hubMassError = null;
    try {
      const response = await pullHubMassAlerts({
        hubUrl,
        hubId: getHubSyncId(connection),
        nick: getHubSyncNick(),
        limit: HUB_MASS_PULL_MAX_ROWS,
      });
      const rows = Array.isArray(response && response.rows)
        ? response.rows
        : [];
      const mapped = rows
        .map((row) => buildHubMassIncomingFromRow(row))
        .filter(Boolean)
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          if (Number.isFinite(av) && !Number.isFinite(bv)) return -1;
          if (!Number.isFinite(av) && Number.isFinite(bv)) return 1;
          return String((a && a.id) || "").localeCompare(
            String((b && b.id) || ""),
          );
        });
      const nextFingerprint = buildHubMassIncomingsFingerprint(mapped);
      const changed = nextFingerprint !== state.hubMassLastFingerprint;
      state.hubMassIncomings = changed ? mapped : state.hubMassIncomings;
      state.hubMassLastFingerprint = nextFingerprint;
      state.hubMassLastLoadedMs = getServerNowMs();
      state.hubMassError = null;
      if (changed) {
        requestIncomingsRerender("hub_mass_changed");
      }
      return Array.isArray(state.hubMassIncomings)
        ? state.hubMassIncomings
        : mapped;
    } catch (error) {
      state.hubMassError = formatErrorText(error);
      if (!silent) {
        notifyHubStatus(`HubMass: ${state.hubMassError}`, true);
      }
      return Array.isArray(state.hubMassIncomings)
        ? state.hubMassIncomings
        : [];
    } finally {
      state.hubMassLoading = false;
    }
  };

  const parseHubUnitsJson = (value) => {
    if (!value) return {};
    if (typeof value === "object") return normalizeUnitsMap(value);
    const text = cleanText(value);
    if (!text) return {};
    const parsed = safe(() => JSON.parse(text), null);
    return normalizeUnitsMap(
      parsed && typeof parsed === "object" ? parsed : {},
    );
  };

  const buildHubTribeTroopsModel = (rows) => {
    const villages = (Array.isArray(rows) ? rows : [])
      .map((row) => {
        const coord = normalizeCoordIdentity(row && row.coord);
        if (!coord) return null;
        const ownerNick = cleanText(row && row.nick) || null;
        const troops = parseHubUnitsJson(row && (row.troops || row.troopsJson));
        const sigilPercentRaw = toNumber(row && row.sigilPercent);
        const sigilPercent = Number.isFinite(sigilPercentRaw)
          ? normalizeSigilPercent(sigilPercentRaw)
          : null;
        return {
          villageId: null,
          villageCoord: coord,
          villageName: coord,
          ownerNick,
          troops,
          troopsDefense: troops,
          sigilPercent: Number.isFinite(sigilPercent) ? sigilPercent : null,
        };
      })
      .filter(Boolean);
    return {
      version: 1,
      fetchedAt: new Date(getServerNowMs()).toISOString(),
      sourceUrl: null,
      count: villages.length,
      villages,
    };
  };

  const buildHubTribeIncomingFromRow = (
    row,
    { sigilByOwnerCoord = null, ownerSigilByOwner = null } = {},
  ) => {
    if (!row || typeof row !== "object") return null;
    const etaEpochMs = Number(row.arrivalAtMs);
    const targetCoord = normalizeCoordIdentity(row.targetCoord);
    if (!targetCoord || !Number.isFinite(etaEpochMs)) return null;
    const originCoord = normalizeCoordIdentity(row.fromCoord);
    const guessedUnit = cleanText(row.unit) || null;
    const commandType =
      cleanText(row.commandType) || cleanText(row.sizeHint) || "other";
    const sizeClassRaw = cleanText(row.sizeClass);
    const sizeClass =
      sizeClassRaw && /^(small|medium|large|normal)$/i.test(sizeClassRaw)
        ? sizeClassRaw.toLowerCase()
        : commandType.includes("small")
          ? "small"
          : commandType.includes("medium")
            ? "medium"
            : commandType.includes("large")
              ? "large"
              : "normal";
    const detectedUnitsRaw =
      row.detectedUnits && Array.isArray(row.detectedUnits)
        ? row.detectedUnits
        : typeof row.detectedUnitsCsv === "string"
          ? row.detectedUnitsCsv.split(",")
          : guessedUnit
            ? [guessedUnit]
            : [];
    const detectedUnits = Array.from(
      new Set(detectedUnitsRaw.map((unit) => cleanText(unit)).filter(Boolean)),
    );
    const timerSeconds = Math.max(
      0,
      Math.round((etaEpochMs - getServerNowMs()) / 1000),
    );
    const rawIncomingId =
      cleanText(row.incomingId) ||
      `evt_${hashString(
        [
          cleanText(row.ownerNick) || "owner",
          cleanText(row.attackerNick) || "attacker",
          originCoord || "?",
          targetCoord,
          String(Math.round(etaEpochMs)),
          cleanText(row.commandType) || "",
          cleanText(row.sizeClass) || "",
          cleanText(row.unit) || "",
          Number.isFinite(toInt(row.squadSize))
            ? String(Math.max(0, toInt(row.squadSize) || 0))
            : "",
        ].join("|"),
      )}`;
    const ownerNick = cleanText(row.ownerNick) || null;
    const ownerNorm = String(ownerNick || "")
      .trim()
      .toLowerCase();
    const incomingId = `tribe_${hashString(
      `${ownerNick || "owner"}|${rawIncomingId}|${originCoord || "?"}|${targetCoord}|${etaEpochMs}`,
    )}`;
    const directSigil = toNumber(row && row.sigilPercent);
    const coordKey = normalizeCoordIdentity(targetCoord);
    const sigilFromCoordMap =
      sigilByOwnerCoord && ownerNorm && coordKey
        ? toNumber(sigilByOwnerCoord.get(`${ownerNorm}|${coordKey}`))
        : null;
    const sigilFromOwnerMap =
      ownerSigilByOwner && ownerNorm
        ? toNumber(ownerSigilByOwner.get(ownerNorm))
        : null;
    const resolvedSigil = [
      directSigil,
      sigilFromCoordMap,
      sigilFromOwnerMap,
    ].find((value) => Number.isFinite(value));
    const attackerNick = cleanText(row.attackerNick) || "unknown";
    const item = {
      id: incomingId,
      isTribeIncoming: true,
      ownerNick,
      attackerNick,
      commandType,
      displayType: commandType,
      commandLabel: cleanText(row.squadSizeText) || commandType,
      kindText: cleanText(row.sizeHint) || null,
      supportUnitCount: Number.isFinite(toInt(row.squadSize))
        ? Math.max(0, toInt(row.squadSize) || 0)
        : null,
      hasNoble: guessedUnit === "snob" || detectedUnits.includes("snob"),
      guessedUnit,
      guessedUnitIcon: guessedUnit ? getUnitIconFallback(guessedUnit) : null,
      detectedUnits,
      unitIconsByKey: {},
      target: targetCoord,
      targetCoord,
      targetVillageId: null,
      origin: originCoord || "?",
      originCoord: originCoord || null,
      originVillageId: null,
      player: attackerNick,
      playerId: null,
      distance: calcDistance(parseCoord(originCoord), parseCoord(targetCoord)),
      arrivalText:
        cleanText(row.arrivalServerTimeMsText) ||
        formatArrivalTextFromEpochMs(etaEpochMs),
      arrivalMs: Math.max(0, toInt(etaEpochMs % 1000) || 0),
      arrivalEpochMs: Math.round(etaEpochMs),
      etaEpochMs: Math.round(etaEpochMs),
      arrivalEpochSource: "hub_tribe",
      timerText: formatCountdown(timerSeconds),
      timerSeconds,
      watchtowerEndtime: null,
      watchtowerText: null,
      sourceNick: cleanText(row.ownerNick) || null,
      sourceIncomingId: rawIncomingId,
      sizeClass,
      sourceVersion: cleanText(row.sourceVersion) || null,
      sigilPercent: Number.isFinite(resolvedSigil)
        ? normalizeSigilPercent(resolvedSigil)
        : 0,
    };
    if (item.hasNoble && !item.nobleIcon) {
      item.nobleIcon = getUnitIconFallback("snob");
    }
    return item;
  };

  const parseHubArrivalEpochMsFromRow = (row) => {
    if (!row || typeof row !== "object") return null;
    const directCandidates = [
      row.arrivalAtMs,
      row.arrivalEpochMs,
      row.etaEpochMs,
    ];
    for (let index = 0; index < directCandidates.length; index += 1) {
      const raw = directCandidates[index];
      const epochMs = toFiniteEpochMs(raw);
      if (Number.isFinite(epochMs)) return epochMs;
      const numeric = toNumber(raw);
      if (!Number.isFinite(numeric) || numeric <= 0) continue;
      if (numeric < 100000000000) {
        const scaled = Math.round(numeric * 1000);
        if (Number.isFinite(scaled) && scaled > 0) return scaled;
      }
    }

    const textCandidates = [
      cleanText(row.arrivalServerTimeMsText),
      cleanText(row.arrivalAt),
      cleanText(row.arrivalText),
    ].filter(Boolean);

    for (let index = 0; index < textCandidates.length; index += 1) {
      const text = textCandidates[index];
      if (!text) continue;

      const dateParsedMs = Date.parse(text);
      if (Number.isFinite(dateParsedMs) && dateParsedMs > 0) {
        return Math.round(dateParsedMs);
      }

      const arrivalMs = extractArrivalMsFromText(text);
      const directParsed = parseCommandsArrivalEpochMs(
        extractArrivalDateTimeText(text) || text,
        arrivalMs,
      );
      if (Number.isFinite(directParsed)) return Math.round(directParsed);

      const noMarkerDateMatch = text.match(
        /(\d{1,2}\.\d{1,2}(?:\.\d{2,4})?)\s+(\d{1,2}:\d{2}:\d{2})/,
      );
      if (noMarkerDateMatch) {
        const withMarker = `${noMarkerDateMatch[1]} в ${noMarkerDateMatch[2]}`;
        const parsed = parseCommandsArrivalEpochMs(withMarker, arrivalMs);
        if (Number.isFinite(parsed)) return Math.round(parsed);
      }

      const noMarkerRelativeMatch = text.match(
        /\b(сегодня|завтра|today|tomorrow)\b\s+(\d{1,2}:\d{2}:\d{2})/i,
      );
      if (noMarkerRelativeMatch) {
        const withMarker = `${noMarkerRelativeMatch[1]} в ${noMarkerRelativeMatch[2]}`;
        const parsed = parseCommandsArrivalEpochMs(withMarker, arrivalMs);
        if (Number.isFinite(parsed)) return Math.round(parsed);
      }
    }
    return null;
  };

  const buildHubTribeCommandEntryFromRow = (
    row,
    { isPlanned = false } = {},
  ) => {
    if (!row || typeof row !== "object") return null;
    const targetCoord =
      normalizeCoordIdentity(row.targetCoord) || cleanText(row.targetCoord);
    const fromCoord =
      normalizeCoordIdentity(row.fromCoord) || cleanText(row.fromCoord);
    const arrivalAtMs = parseHubArrivalEpochMsFromRow(row);
    if (!Number.isFinite(arrivalAtMs)) return null;
    const fromCoordSafe = fromCoord || "?";
    const nick = cleanText(row.nick) || "unknown";
    const squadJsonRaw = row.squadJson;
    const squadParsed =
      typeof squadJsonRaw === "string"
        ? safe(() => JSON.parse(squadJsonRaw), {})
        : squadJsonRaw && typeof squadJsonRaw === "object"
          ? squadJsonRaw
          : {};
    const squad = normalizeUnitsMap(squadParsed);
    const squadText = cleanText(row.squadText) || formatHubUnits(squad);
    const arrivalServerText = cleanText(row.arrivalServerTimeMsText) || null;
    const timerSeconds = Math.max(
      0,
      Math.round((arrivalAtMs - getServerNowMs()) / 1000),
    );
    const typeText = isPlanned ? "запланировано" : "приказ";
    const typeKeyRaw = isPlanned
      ? cleanText(row.typeKey) || cleanText(row.maneuverType) || "planned"
      : cleanText(row.commandType) || "command";
    const stableSourceId =
      cleanText(row.commandId) ||
      cleanText(row.planId) ||
      cleanText(row.incomingId) ||
      cleanText(row.id) ||
      null;
    const cardIdPrefix = isPlanned ? "tribe_plan" : "tribe_cmd";
    const cardIdSeed = [
      stableSourceId || "",
      nick,
      fromCoordSafe,
      targetCoord,
      String(Math.round(arrivalAtMs)),
      typeKeyRaw,
      squadText,
    ].join("|");
    const cardId = `${cardIdPrefix}_${hashString(cardIdSeed)}`;
    return {
      id: cardId,
      rowKey: cleanText(row.rowKey) || null,
      hideId: stableSourceId || cleanText(row.rowKey) || cardId,
      sourceCommandId: stableSourceId,
      isTribeIncoming: true,
      isTribeAllyCommand: !isPlanned,
      isTribeAllyPlanned: Boolean(isPlanned),
      displayType: isPlanned ? "tribe_planned" : "tribe_command",
      commandType: isPlanned ? "tribe_planned" : "tribe_command",
      commandLabel: typeText,
      kindText: cleanText(typeKeyRaw) || typeText,
      target: targetCoord || "?",
      targetCoord: targetCoord || null,
      origin: fromCoordSafe,
      originCoord: fromCoord || null,
      player: nick,
      ownerNick: nick,
      attackerNick: nick,
      arrivalText:
        arrivalServerText || formatArrivalTextFromEpochMs(arrivalAtMs),
      arrivalServerTimeMsText: arrivalServerText,
      arrivalMs: new Date(arrivalAtMs).getMilliseconds(),
      arrivalEpochMs: Math.round(arrivalAtMs),
      etaEpochMs: Math.round(arrivalAtMs),
      arrivalEpochSource: isPlanned ? "hub_tribe_plan" : "hub_tribe_command",
      timerText: formatCountdown(timerSeconds),
      timerSeconds,
      squadText,
      squadSummaryText: squadText,
      squadUnits: squad,
      guessedUnit: null,
      guessedUnitIcon: null,
      detectedUnits: [],
      unitIconsByKey: {},
    };
  };

  const loadHubTribeIncomingsAsync = async ({
    force = false,
    silent = true,
  } = {}) => {
    const connection = ensureHubConnectionLoaded();
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) {
      clearHubTribeIncomings({ rerender: true });
      return [];
    }

    if (state.hubTribeLoading && !force) {
      return Array.isArray(state.hubTribeIncomings)
        ? state.hubTribeIncomings
        : [];
    }

    state.hubTribeLoading = true;
    state.hubTribeError = null;
    try {
      const ownNickNorm = String(getHubSyncNick() || "")
        .trim()
        .toLowerCase();
      const response = await pullHubTribeOverview({
        hubUrl,
        hubId: getHubSyncId(connection),
        nick: getHubSyncNick(),
        limit: HUB_TRIBE_PULL_MAX_ROWS,
      });
      const attackRows = Array.isArray(response && response.rows)
        ? response.rows
        : [];
      const troopRows = Array.isArray(response && response.troops)
        ? response.troops
        : [];
      const commandRows = Array.isArray(response && response.commands)
        ? response.commands
        : [];
      const planRows = Array.isArray(response && response.plans)
        ? response.plans
        : [];
      const filteredTroopRows = troopRows.filter((row) => {
        const ownerNorm = String(cleanText(row && row.nick) || "")
          .trim()
          .toLowerCase();
        return !ownNickNorm || !ownerNorm || ownerNorm !== ownNickNorm;
      });
      const filteredCommandRows = commandRows.filter((row) => {
        const ownerNorm = String(cleanText(row && row.nick) || "")
          .trim()
          .toLowerCase();
        return !ownNickNorm || !ownerNorm || ownerNorm !== ownNickNorm;
      });
      const filteredPlanRows = planRows.filter((row) => {
        const ownerNorm = String(cleanText(row && row.nick) || "")
          .trim()
          .toLowerCase();
        return !ownNickNorm || !ownerNorm || ownerNorm !== ownNickNorm;
      });
      const sigilByOwnerCoord = new Map();
      const ownerSigilByOwner = new Map();
      filteredTroopRows.forEach((row) => {
        const ownerNorm = String(cleanText(row && row.nick) || "")
          .trim()
          .toLowerCase();
        const coordNorm = normalizeCoordIdentity(row && row.coord);
        const sigilRaw = toNumber(row && row.sigilPercent);
        if (!ownerNorm || !Number.isFinite(sigilRaw)) return;
        const normalizedSigil = normalizeSigilPercent(sigilRaw);
        if (coordNorm) {
          sigilByOwnerCoord.set(`${ownerNorm}|${coordNorm}`, normalizedSigil);
        }
        const existing = toNumber(ownerSigilByOwner.get(ownerNorm));
        if (!Number.isFinite(existing) || normalizedSigil > existing) {
          ownerSigilByOwner.set(ownerNorm, normalizedSigil);
        }
      });
      const mapped = attackRows
        .map((row) =>
          buildHubTribeIncomingFromRow(row, {
            sigilByOwnerCoord,
            ownerSigilByOwner,
          }),
        )
        .filter(Boolean)
        .reduce((acc, item) => {
          const key = cleanText(item && item.id);
          if (!key) return acc;
          acc.set(String(key), item);
          return acc;
        }, new Map())
        .values();
      const mappedAllList = Array.from(mapped)
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return String(cleanText(a && a.id) || "").localeCompare(
            String(cleanText(b && b.id) || ""),
          );
        });
      const mappedList = mappedAllList
        .filter((item) => {
          if (!item) return false;
          const ownerNorm = String(cleanText(item.ownerNick) || "")
            .trim()
            .toLowerCase();
          return !ownNickNorm || !ownerNorm || ownerNorm !== ownNickNorm;
        })
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return String(cleanText(a && a.id) || "").localeCompare(
            String(cleanText(b && b.id) || ""),
          );
        });
      const mappedCommandsAll = commandRows
        .map((row) =>
          buildHubTribeCommandEntryFromRow(row, { isPlanned: false }),
        )
        .filter(Boolean)
        .reduce((acc, item) => {
          const key = cleanText(item && item.id);
          if (!key) return acc;
          acc.set(String(key), item);
          return acc;
        }, new Map());
      const mappedCommandsAllList = Array.from(mappedCommandsAll.values())
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return String(cleanText(a && a.id) || "").localeCompare(
            String(cleanText(b && b.id) || ""),
          );
        });
      const mappedCommands = filteredCommandRows
        .map((row) =>
          buildHubTribeCommandEntryFromRow(row, { isPlanned: false }),
        )
        .filter(Boolean)
        .reduce((acc, item) => {
          const key = cleanText(item && item.id);
          if (!key) return acc;
          acc.set(String(key), item);
          return acc;
        }, new Map());
      const mappedCommandsList = Array.from(mappedCommands.values())
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return String(cleanText(a && a.id) || "").localeCompare(
            String(cleanText(b && b.id) || ""),
          );
        });
      const mappedPlans = filteredPlanRows
        .map((row) =>
          buildHubTribeCommandEntryFromRow(row, { isPlanned: true }),
        )
        .filter(Boolean)
        .reduce((acc, item) => {
          const key = cleanText(item && item.id);
          if (!key) return acc;
          acc.set(String(key), item);
          return acc;
        }, new Map());
      const mappedPlansList = Array.from(mappedPlans.values())
        .sort((a, b) => {
          const av = Number(a && a.etaEpochMs);
          const bv = Number(b && b.etaEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return String(cleanText(a && a.id) || "").localeCompare(
            String(cleanText(b && b.id) || ""),
          );
        });
      if (DEBUG_VERBOSE_LOGS) {
        safe(() => {
          console.info("[ScriptMM][hub-tribe-sync]", {
            rows: attackRows.length,
            troops: troopRows.length,
            commands: commandRows.length,
            plans: planRows.length,
            mappedIncomings: mappedAllList.length,
            mappedCommands: mappedCommandsList.length,
            mappedCommandsCache: mappedCommandsAllList.length,
            mappedPlans: mappedPlansList.length,
          });
          return true;
        }, false);
      }
      const nextFingerprint = buildHubTribeIncomingsFingerprint(
        mappedAllList,
        filteredTroopRows,
        mappedCommandsList,
        mappedPlansList,
      );
      const changed = nextFingerprint !== state.hubTribeLastFingerprint;
      if (changed) {
        state.hubTribeAllIncomings = mappedAllList;
        state.hubTribeIncomings = mappedList;
        state.hubTribeTroopsRows = filteredTroopRows;
        state.hubTribeCommandsRows = mappedCommandsList;
        state.hubTribeCommandsCacheRows = mappedCommandsAllList;
        state.hubTribePlansRows = mappedPlansList;
      }
      if (!changed) {
        state.hubTribeCommandsCacheRows = mappedCommandsAllList;
      }
      state.hubTribeLastFingerprint = nextFingerprint;
      state.hubTribeLastLoadedMs = getServerNowMs();
      state.hubTribeError = null;
      if (changed) {
        requestIncomingsRerender("hub_tribe_changed");
      }
      return Array.isArray(state.hubTribeIncomings)
        ? state.hubTribeIncomings
        : mappedList;
    } catch (error) {
      state.hubTribeError = formatErrorText(error);
      requestIncomingsRerender("hub_tribe_error");
      if (!silent) {
        notifyHubStatus(`HubTribe: ${state.hubTribeError}`, true);
      }
      return Array.isArray(state.hubTribeIncomings)
        ? state.hubTribeIncomings
        : [];
    } finally {
      state.hubTribeLoading = false;
    }
  };

  const loadHubOwnQueriesAsync = async ({
    force = false,
    silent = true,
  } = {}) => {
    const connection = ensureHubConnectionLoaded();
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) {
      clearHubOwnQueries({ rerender: true });
      return [];
    }

    if (state.hubOwnQueriesLoading && !force) {
      return Array.isArray(state.hubOwnQueries) ? state.hubOwnQueries : [];
    }

    state.hubOwnQueriesLoading = true;
    state.hubOwnQueriesError = null;
    try {
      const response = await pullHubOwnQueries({
        hubUrl,
        hubId: getHubSyncId(connection),
        nick: getHubSyncNick(),
        limit: HUB_OWN_QUERY_PULL_MAX_ROWS,
      });
      const rows = Array.isArray(response && response.rows)
        ? response.rows
        : [];
      const mapped = rows
        .map((row) => {
          const timingStartMs = Number.isFinite(
            Number(row && row.timingStartMs),
          )
            ? Math.round(Number(row.timingStartMs))
            : null;
          const timingEndMs = Number.isFinite(Number(row && row.timingEndMs))
            ? Math.round(Number(row.timingEndMs))
            : null;
          const timingPointMs = Number.isFinite(
            Number(row && row.timingPointMs),
          )
            ? Math.round(Number(row.timingPointMs))
            : null;
          return {
            rowKey: cleanText(row && row.rowKey),
            incomingId: cleanText(row && row.incomingId) || null,
            actionKey: normalizePlanAction(
              cleanText(row && row.actionKey) || "slice",
            ),
            actionLabel: cleanText(row && row.actionLabel) || null,
            targetCoord: cleanText(row && row.targetCoord) || "?",
            timingType: cleanText(row && row.timingType) || null,
            timingLabel: buildNormalizedTimingLabel({
              timingType: cleanText(row && row.timingType) || null,
              timingLabel: cleanText(row && row.timingLabel) || null,
              timingStartMs,
              timingEndMs,
              timingPointMs,
              units: row && row.units,
            }),
            timingStartMs,
            timingEndMs,
            timingPointMs,
            incomingEtaMs: Number.isFinite(
              toFiniteEpochMs(row && row.incomingEtaMs),
            )
              ? Math.round(toFiniteEpochMs(row.incomingEtaMs))
              : null,
            incomingEtaServerText:
              cleanText(row && row.incomingEtaServerText) || null,
            receivedAtMs: Number.isFinite(Number(row && row.receivedAtMs))
              ? Math.round(Number(row.receivedAtMs))
              : null,
          };
        })
        .filter((row) => row.rowKey)
        .sort((a, b) => {
          const aEta = Number(a && a.incomingEtaMs);
          const bEta = Number(b && b.incomingEtaMs);
          if (Number.isFinite(aEta) && Number.isFinite(bEta) && aEta !== bEta)
            return aEta - bEta;
          if (Number.isFinite(aEta) && !Number.isFinite(bEta)) return -1;
          if (!Number.isFinite(aEta) && Number.isFinite(bEta)) return 1;
          const aRecv = Number(a && a.receivedAtMs);
          const bRecv = Number(b && b.receivedAtMs);
          if (
            Number.isFinite(aRecv) &&
            Number.isFinite(bRecv) &&
            aRecv !== bRecv
          )
            return aRecv - bRecv;
          return String((a && a.rowKey) || "").localeCompare(
            String((b && b.rowKey) || ""),
          );
        });
      state.hubOwnQueries = mapped;
      state.hubOwnQueriesLastLoadedMs = getServerNowMs();
      state.hubOwnQueriesError = null;
      if (state.ui && state.activeTab === "hub") {
        if (state.refreshInProgress) {
          state.pendingHubTabRerender = true;
        } else {
          renderHubTab(state.ui);
        }
      }
      return mapped;
    } catch (error) {
      state.hubOwnQueriesError = formatErrorText(error);
      if (!silent) {
        notifyHubStatus(`HubQuery(mine): ${state.hubOwnQueriesError}`, true);
      }
      return Array.isArray(state.hubOwnQueries) ? state.hubOwnQueries : [];
    } finally {
      state.hubOwnQueriesLoading = false;
    }
  };

  const confirmHubDuplicateSend = ({
    targetCoord,
    timingLabel,
    duplicateCount = 1,
  } = {}) =>
    new Promise((resolve) => {
      const coordText = cleanText(targetCoord) || "?";
      const timingText = cleanText(timingLabel) || "—";
      const countText = Math.max(1, toInt(duplicateCount) || 1);
      const message = `В хабе уже есть такой запрос (цель ${coordText}, окно ${timingText})${countText > 1 ? ` · совпадений: ${countText}` : ""}. Отправить повторно?`;
      if (!state.ui || !state.ui.root) {
        resolve(Boolean(window.confirm(message)));
        return;
      }

      const root = state.ui.root;
      const backdrop = document.createElement("div");
      backdrop.className = "smm-confirm-dialog-backdrop";
      backdrop.innerHTML = `
<div class="smm-confirm-dialog-card" role="dialog" aria-modal="true">
  <div class="smm-confirm-dialog-title">Дубликат запроса в хабе</div>
  <div class="smm-confirm-dialog-text">${escapeHtml(message)}</div>
  <div class="smm-confirm-dialog-actions">
    <button type="button" class="smm-btn smm-confirm-cancel-btn">Отмена</button>
    <button type="button" class="smm-btn smm-confirm-yes-btn">Да</button>
  </div>
</div>`;
      const close = (accepted) => {
        if (backdrop && backdrop.parentNode)
          backdrop.parentNode.removeChild(backdrop);
        resolve(Boolean(accepted));
      };
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          close(false);
        }
      });
      const yesButton = backdrop.querySelector(".smm-confirm-yes-btn");
      const cancelButton = backdrop.querySelector(".smm-confirm-cancel-btn");
      if (yesButton) {
        yesButton.addEventListener("click", () => close(true));
      }
      if (cancelButton) {
        cancelButton.addEventListener("click", () => close(false));
      }
      root.appendChild(backdrop);
    });

  const askHubQueryActionChoice = ({ preferredAction = null } = {}) =>
    new Promise((resolve) => {
      const defaultAction = normalizePlanAction(preferredAction || "slice");
      const finish = (value) =>
        resolve(cleanText(value) ? normalizePlanAction(value) : null);
      if (!state.ui || !state.ui.root) {
        const defaultLabel =
          defaultAction === "intercept" ? "перехват" : "срез";
        const raw = window.prompt(
          "Отправить в хаб как: срез или перехват/атака?",
          defaultLabel,
        );
        const text = String(cleanText(raw) || "").toLowerCase();
        if (!text) {
          finish(null);
          return;
        }
        if (
          text.includes("перехват") ||
          text.includes("intercept") ||
          text.includes("атака")
        ) {
          finish("intercept");
          return;
        }
        if (text.includes("срез") || text.includes("slice")) {
          finish("slice");
          return;
        }
        finish(defaultAction);
        return;
      }

      const root = state.ui.root;
      const backdrop = document.createElement("div");
      backdrop.className = "smm-confirm-dialog-backdrop";
      backdrop.innerHTML = `
<div class="smm-confirm-dialog-card" role="dialog" aria-modal="true">
  <div class="smm-confirm-dialog-title">Отправка в хаб</div>
  <div class="smm-confirm-dialog-text">Выбери тип манёвра для запроса:</div>
  <div class="smm-confirm-dialog-actions">
    <button type="button" class="smm-btn smm-confirm-cancel-btn">Отмена</button>
    <button type="button" class="smm-btn smm-confirm-slice-btn">Срез</button>
    <button type="button" class="smm-btn smm-confirm-intercept-btn">Перехват/атака</button>
  </div>
</div>`;
      const close = (value) => {
        if (backdrop && backdrop.parentNode)
          backdrop.parentNode.removeChild(backdrop);
        finish(value);
      };
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          close(null);
        }
      });
      const cancelButton = backdrop.querySelector(".smm-confirm-cancel-btn");
      const sliceButton = backdrop.querySelector(".smm-confirm-slice-btn");
      const interceptButton = backdrop.querySelector(
        ".smm-confirm-intercept-btn",
      );
      if (cancelButton) {
        cancelButton.addEventListener("click", () => close(null));
      }
      if (sliceButton) {
        if (defaultAction === "slice") sliceButton.classList.add("active");
        sliceButton.addEventListener("click", () => close("slice"));
      }
      if (interceptButton) {
        if (defaultAction === "intercept")
          interceptButton.classList.add("active");
        interceptButton.addEventListener("click", () => close("intercept"));
      }
      root.appendChild(backdrop);
    });

  const askFavoriteCommentDialog = ({
    title = "Добавить в избранное",
    initialValue = "",
    inputLabel = "Комментарий (необязательно)",
    placeholder = "можно оставить пустым",
  } = {}) =>
    new Promise((resolve) => {
      const finish = (payload) => {
        const result =
          payload && typeof payload === "object"
            ? {
                canceled: Boolean(payload.canceled),
                comment:
                  payload.comment == null ? null : cleanText(payload.comment) || null,
              }
            : { canceled: true, comment: null };
        resolve(result);
      };

      const root =
        (state.ui && state.ui.root) ||
        document.querySelector("#scriptmm-overlay-root") ||
        document.body;
      const backdrop = document.createElement("div");
      backdrop.className = "smm-confirm-dialog-backdrop";
      if (!(state.ui && state.ui.root)) {
        backdrop.style.position = "fixed";
        backdrop.style.inset = "0";
        backdrop.style.display = "flex";
        backdrop.style.alignItems = "center";
        backdrop.style.justifyContent = "center";
        backdrop.style.background = "rgba(15,9,2,.52)";
        backdrop.style.zIndex = "2147483600";
      }
      backdrop.innerHTML = `
<div class="smm-confirm-dialog-card" role="dialog" aria-modal="true">
  <div class="smm-confirm-dialog-title">${escapeHtml(cleanText(title) || "Добавить в избранное")}</div>
  <label class="smm-hub-dialog-label" for="smm-favorite-comment-input">${escapeHtml(cleanText(inputLabel) || "Комментарий (необязательно)")}</label>
  <input id="smm-favorite-comment-input" class="smm-hub-dialog-input" type="text" value="${escapeHtml(cleanText(initialValue) || "")}" placeholder="${escapeHtml(cleanText(placeholder) || "можно оставить пустым")}">
  <div class="smm-confirm-dialog-actions">
    <button type="button" class="smm-btn smm-confirm-cancel-btn">Отмена</button>
    <button type="button" class="smm-btn smm-confirm-save-btn">Сохранить</button>
  </div>
</div>`;
      if (!(state.ui && state.ui.root)) {
        const card = backdrop.querySelector(".smm-confirm-dialog-card");
        if (card) {
          card.style.width = "min(460px,92vw)";
          card.style.padding = "12px";
          card.style.border = "1px solid #b89a5a";
          card.style.borderRadius = "12px";
          card.style.background =
            "linear-gradient(165deg,#f7f3e8 0%,#efe6d0 52%,#e8dcc0 100%)";
          card.style.boxShadow = "0 18px 60px rgba(0,0,0,.3)";
        }
      }

      const close = (payload) => {
        if (backdrop && backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        finish(payload);
      };

      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) {
          close({ canceled: true, comment: null });
        }
      });

      const input = backdrop.querySelector("#smm-favorite-comment-input");
      const cancelButton = backdrop.querySelector(".smm-confirm-cancel-btn");
      const saveButton = backdrop.querySelector(".smm-confirm-save-btn");

      if (cancelButton) {
        cancelButton.addEventListener("click", () =>
          close({ canceled: true, comment: null }),
        );
      }
      if (saveButton) {
        saveButton.addEventListener("click", () =>
          close({
            canceled: false,
            comment: cleanText(input && input.value) || null,
          }),
        );
      }
      if (input) {
        input.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            close({ canceled: true, comment: null });
          } else if (event.key === "Enter") {
            event.preventDefault();
            close({
              canceled: false,
              comment: cleanText(input.value) || null,
            });
          }
        });
      }

      root.appendChild(backdrop);
      if (input) {
        setTimeout(() => {
          try {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          } catch (error) {
            void error;
          }
        }, 0);
      }
    });

  const sendIncomingTimingToHubQuery = async ({
    incomingId,
    preferredAction = null,
    source = "ui_button",
  } = {}) => {
    const incomingKey = cleanText(incomingId);
    if (!incomingKey) return false;

    const connection = ensureHubConnectionLoaded();
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) {
      notifyHubStatus("Хаб не подключён. Подключи хаб и повтори.", true);
      return false;
    }

    const incoming = getIncomingById(incomingKey);
    if (!incoming) {
      notifyHubStatus(`Не найден входящий приказ #${incomingKey}.`, true);
      return false;
    }

    const targetCoord = cleanText(incoming.targetCoord || incoming.target);
    const incomingEtaMs = toFiniteEpochMs(
      incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
    );
    if (!targetCoord || !Number.isFinite(incomingEtaMs)) {
      notifyHubStatus(
        "Не удалось вычислить цель/время для отправки в хаб.",
        true,
      );
      return false;
    }

    const preferred = normalizePlanAction(
      preferredAction || getPlanAction(incomingKey) || "slice",
    );
    const chosenAction = await askHubQueryActionChoice({
      preferredAction: preferred,
    });
    if (!chosenAction) {
      if (state.ui) setStatus(state.ui, "Отправка в хаб отменена.");
      return false;
    }
    const actionKey = normalizePlanAction(chosenAction || preferred);
    const sigilPercent = actionUsesSigil(actionKey)
      ? resolveSigilPercentForAction(actionKey, incoming)
      : null;
    const timing = buildTimingPayload({
      action: actionKey,
      incomingId: incomingKey,
      targetCoord,
      incomingEtaMs,
    });
    const payload = {
      action: "push_query",
      hub: getHubSyncId(connection),
      nick: getHubSyncNick(),
      sender: "game",
      sourceVersion: VERSION,
      source,
      sourceUrl: location.href,
      incomingId: incomingKey,
      actionKey,
      actionLabel: getPlanActionLabelByKey(actionKey),
      targetCoord,
      timingType: cleanText(timing.timingType) || "none",
      timingLabel: cleanText(timing.timingLabel) || "—",
      timingStartMs: Number.isFinite(Number(timing.timingStartMs))
        ? Math.round(Number(timing.timingStartMs))
        : null,
      timingEndMs: Number.isFinite(Number(timing.timingEndMs))
        ? Math.round(Number(timing.timingEndMs))
        : null,
      timingPointMs: Number.isFinite(Number(timing.timingPointMs))
        ? Math.round(Number(timing.timingPointMs))
        : null,
      incomingEtaMs: Math.round(incomingEtaMs),
      sigilPercent: Number.isFinite(Number(sigilPercent))
        ? normalizeSigilPercent(Number(sigilPercent))
        : null,
    };

    try {
      try {
        const duplicateCheck = await checkHubQueryDuplicate({
          hubUrl,
          hubId: getHubSyncId(connection),
          nick: getHubSyncNick(),
          targetCoord: payload.targetCoord,
          timingStartMs: payload.timingStartMs,
          timingEndMs: payload.timingEndMs,
          timingPointMs: payload.timingPointMs,
          incomingEtaMs: payload.incomingEtaMs,
        });
        const hasDuplicate = Boolean(
          duplicateCheck && duplicateCheck.duplicate,
        );
        if (hasDuplicate) {
          const duplicateCount =
            Number(duplicateCheck && duplicateCheck.count) || 1;
          const confirmed = await confirmHubDuplicateSend({
            targetCoord: payload.targetCoord,
            timingLabel: payload.timingLabel,
            duplicateCount,
          });
          if (!confirmed) {
            setStatus(state.ui, "Отправка в хаб отменена.");
            return false;
          }
        }
      } catch (duplicateCheckError) {
        const warningText = `Проверка дубля недоступна (${formatErrorText(duplicateCheckError)}), отправка без проверки`;
        setStatus(state.ui, warningText);
      }

      const response = await postHubQueryPayload(hubUrl, payload);
      const inserted =
        Number(response && response.query && response.query.inserted) || 0;
      const marker = inserted > 0 ? "добавлено" : "уже было";
      if (state.ui) {
        setStatus(
          state.ui,
          `ХабQuery: ${marker} · ${targetCoord} · ${payload.timingLabel}`,
        );
      }
      notifyHubStatus("Успешная отправка", {
        success: true,
        timeoutMs: 2000,
        skipStatus: true,
      });
      void loadHubOwnQueriesAsync({ force: true, silent: true });
      return true;
    } catch (error) {
      notifyHubStatus(
        `ХабQuery: ошибка отправки (${formatErrorText(error)})`,
        true,
      );
      return false;
    }
  };

  const refreshHubCommandsIfNeeded = async (force = false) => {
    const nowMs = getServerNowMs();
    const hasDump = Boolean(
      state.overviewCommandsDump &&
        Array.isArray(state.overviewCommandsDump.items),
    );
    if (
      !force &&
      hasDump &&
      Number.isFinite(state.hubLastCommandsFetchMs) &&
      nowMs - state.hubLastCommandsFetchMs <
        HUB_COMMANDS_REFRESH_MIN_INTERVAL_MS
    ) {
      return null;
    }
    state.hubLastCommandsFetchMs = nowMs;
    let freshDump = await fetchOverviewCommandsDump({ groupIdRaw: "0" });
    freshDump = await enrichOverviewCommandsWithRouteDetails(freshDump);
    state.overviewCommandsDump = freshDump;
    saveJson(STORAGE_KEYS.overviewCommands, freshDump);
    return freshDump;
  };

  const runHubSyncCycle = async ({ forceCommandsRefresh = false } = {}) => {
    const connection = normalizeHubConnection(state.hubConnection);
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) return null;
    if (state.hubSyncInFlight) return null;
    state.hubSyncInFlight = true;
    try {
      let refreshWarning = null;
      try {
        await refreshHubCommandsIfNeeded(forceCommandsRefresh);
      } catch (refreshError) {
        refreshWarning = `overview_commands: ${formatErrorText(refreshError)}`;
      }

      const payload = buildHubSyncPayload(connection);
      const response = await postHubSyncPayload(hubUrl, payload);
      state.hubLastSyncAtMs = getServerNowMs();
      state.hubLastSyncStats = {
        plan: response.plan || null,
        commands: response.commands || null,
        tribeAttacks: response.tribeAttacks || null,
        tribeTroops: response.tribeTroops || null,
      };
      state.hubTribeSyncError =
        cleanText(response && response.tribeExchangeError) || null;
      state.hubTribeLastSyncAtMs = getServerNowMs();
      state.hubLastSyncError =
        refreshWarning ||
        cleanText(response && response.tribeExchangeError) ||
        null;
      if (state.ui && state.activeTab === "hub") {
        if (state.refreshInProgress) {
          state.pendingHubTabRerender = true;
        } else {
          renderHubTab(state.ui);
        }
      }
      return response;
    } catch (error) {
      state.hubLastSyncError = formatErrorText(error);
      if (state.ui && state.activeTab === "hub") {
        if (state.refreshInProgress) {
          state.pendingHubTabRerender = true;
        } else {
          renderHubTab(state.ui);
        }
      }
      return null;
    } finally {
      state.hubSyncInFlight = false;
      void loadHubQueryIncomingsAsync({ silent: true });
      void loadHubOwnQueriesAsync({ silent: true });
      void loadHubMassIncomingsAsync({ silent: true });
      if (getUiSetting("exchangeTribeAttacks")) {
        void loadHubTribeIncomingsAsync({ silent: true });
      } else {
        clearHubTribeIncomings({ rerender: true });
      }
      if (getUiSetting("loadPlanFromHub")) {
        void loadHubPlanFromHubAsync({ silent: true });
      }
    }
  };

  const stopHubSyncLoop = () => {
    if (state.hubSyncTimerId) {
      clearInterval(state.hubSyncTimerId);
      state.hubSyncTimerId = null;
    }
    state.hubSyncInFlight = false;
  };

  const startHubSyncLoop = () => {
    const connection = normalizeHubConnection(state.hubConnection);
    const hubUrl = cleanText(connection && connection.url);
    if (!hubUrl) {
      stopHubSyncLoop();
      clearHubQueryIncomings({ rerender: true });
      clearHubOwnQueries({ rerender: true });
      clearHubMassIncomings({ rerender: true });
      clearHubTribeIncomings({ rerender: true });
      state.hubPlanLoading = false;
      state.hubPlanError = null;
      state.hubPlanLastLoadedMs = null;
      state.hubPlanLastFingerprint = null;
      return;
    }
    stopHubSyncLoop();
    runHubSyncCycle({ forceCommandsRefresh: false });
    void loadHubQueryIncomingsAsync({ force: true, silent: true });
    void loadHubOwnQueriesAsync({ force: true, silent: true });
    void loadHubMassIncomingsAsync({ force: true, silent: true });
    if (getUiSetting("exchangeTribeAttacks")) {
      void loadHubTribeIncomingsAsync({ force: true, silent: true });
    } else {
      clearHubTribeIncomings({ rerender: true });
    }
    if (getUiSetting("loadPlanFromHub")) {
      void loadHubPlanFromHubAsync({ force: true, silent: true });
    }
    const intervalMs = getHubSyncIntervalMs();
    state.hubSyncTimerId = setInterval(() => {
      runHubSyncCycle();
    }, intervalMs);
  };

  const renderHubTab = (ui) => {
    if (!ui) return;
    stopCountdownTicker();
    ui.list.innerHTML = "";
    const ownQueries = Array.isArray(state.hubOwnQueries)
      ? state.hubOwnQueries
      : [];
    const hubConnection = normalizeHubConnection(state.hubConnection);
    const connectedUrl = cleanText(hubConnection && hubConnection.url);
    const connectedAt = cleanText(hubConnection && hubConnection.connectedAt);
    const syncAtText = Number.isFinite(state.hubLastSyncAtMs)
      ? formatDateTime(state.hubLastSyncAtMs)
      : null;
    const syncSummary =
      state.hubLastSyncStats &&
      state.hubLastSyncStats.plan &&
      state.hubLastSyncStats.commands
        ? ` · синк: план +${state.hubLastSyncStats.plan.inserted || 0}, приказы +${
            state.hubLastSyncStats.commands.inserted || 0
          }`
        : "";
    const syncError = cleanText(state.hubLastSyncError);
    const connectedMeta = connectedUrl
      ? `Подключено: ${connectedUrl}${
          connectedAt ? ` · ${formatDateTime(connectedAt)}` : ""
        }${syncAtText ? ` · sync ${syncAtText}` : ""}${syncSummary}${syncError ? ` · ошибка: ${syncError}` : ""}`
      : "Хаб не подключен";
    const toolbarHtml = `
<div class="smm-hub-toolbar">
  <button type="button" class="smm-btn smm-hub-connect-btn">Подключиться к хабу</button>
  ${
    connectedUrl
      ? '<button type="button" class="smm-btn smm-hub-leave-btn">Удалиться из хаба</button>'
      : ""
  }
  <span class="smm-plan-village">${escapeHtml(connectedMeta)}</span>
</div>`;

    if (!connectedUrl) {
      ui.list.innerHTML = `${toolbarHtml}<div class="smm-empty">Хаб не подключен. Подключи адрес GAS, чтобы видеть и удалять свои запросы.</div>`;
      return;
    }

    const errorText = cleanText(state.hubOwnQueriesError);
    const syncSuffix = state.hubOwnQueriesLoading
      ? " · загрузка..."
      : Number.isFinite(state.hubOwnQueriesLastLoadedMs)
        ? ` · обновлено ${escapeHtml(formatDateTime(state.hubOwnQueriesLastLoadedMs))}`
        : "";
    const rowsHtml = ownQueries
      .map((entry) => {
        const actionLabel =
          cleanText(entry && entry.actionLabel) ||
          getPlanActionLabelByKey(entry && entry.actionKey) ||
          "Срез";
        const targetCoord = cleanText(entry && entry.targetCoord) || "?";
        const timingLabel = cleanText(entry && entry.timingLabel) || "—";
        const etaText =
          (Number.isFinite(Number(entry && entry.incomingEtaMs))
            ? formatDateTimeShortWithMs(Number(entry.incomingEtaMs))
            : null) ||
          cleanText(entry && entry.incomingEtaServerText) ||
          "—";
        const rowKey = cleanText(entry && entry.rowKey) || "";
        return `
<div class="smm-plan-row smm-hub-query-row">
  <div class="smm-plan-left">
    <span class="smm-plan-unit">${escapeHtml(actionLabel)} · #${escapeHtml(cleanText(entry && entry.incomingId) || "?")}</span>
    <span class="smm-plan-village">${escapeHtml("? → " + targetCoord)}</span>
    <span class="smm-plan-village">${escapeHtml("Тайминг: " + timingLabel)}</span>
  </div>
  <div class="smm-plan-right">
    <span class="smm-plan-depart">${escapeHtml(etaText)}</span>
    <button type="button" class="smm-go-btn smm-hub-query-del-btn" data-row-key="${escapeHtml(rowKey)}">Удалить</button>
  </div>
</div>`;
      })
      .join("");

    ui.list.innerHTML = `${toolbarHtml}
<section class="smm-plan-panel">
  <div class="smm-plan-head">
    <span>Мои запросы в хабе</span>
    <span>${escapeHtml(ownQueries.length)} записей${syncSuffix}</span>
  </div>
  ${
    errorText
      ? `<div class="smm-plan-empty">Ошибка загрузки: ${escapeHtml(errorText)}</div>`
      : ownQueries.length
        ? `<div class="smm-plan-body">${rowsHtml}</div>`
        : `<div class="smm-plan-empty">${
            state.hubOwnQueriesLoading
              ? "Загрузка запросов..."
              : "Пока нет твоих запросов в хабе."
          }</div>`
  }
</section>`;
  };

  const closeNearestSlicesDialog = ({
    flushDeferredRerender = true,
    updateState = true,
  } = {}) => {
    if (!state.ui || !state.ui.root) return false;
    const dialog = state.ui.root.querySelector(".smm-nearest-dialog-backdrop");
    if (!dialog) return false;
    dialog.remove();
    if (updateState) {
      state.nearestDialogState = { open: false, source: null };
    }
    if (flushDeferredRerender) {
      if (state.pendingActiveTabRerender && state.ui) {
        state.pendingActiveTabRerender = false;
        renderActiveTab(state.ui);
      }
      flushPendingIncomingsRerender({ force: true });
    }
    return true;
  };
  const buildNearestSlicesGroupSelectHtml = (source = "incomings") =>
    buildVillageGroupSelectHtml(getSelectedVillageGroupId(), {
      className: "smm-calc-group-select smm-nearest-group-select",
      withLabel: false,
    }).replace(
      /<select\b/,
      `<select data-nearest-source="${escapeHtml(source)}"`,
    );
  const renderNearestSlicesDialogContent = (
    payload,
    { source = "incomings" } = {},
  ) => {
    const data =
      payload && typeof payload === "object" ? payload : { rows: [] };
    const rows = Array.isArray(data.rows) ? data.rows : [];
    const lookaheadMinutes = Math.max(
      1,
      toInt(data && data.lookaheadMinutes) || getNearestSliceWindowMinutes(),
    );
    const displayUnits = getSliceTableDisplayUnits();
    const sourceLabel =
      source === "tribe"
        ? "Племя"
        : source === "favorites"
          ? "Избранное"
          : "Входящие";
    const groupSelectHtml = buildNearestSlicesGroupSelectHtml(source);
    const hasCommentColumn = rows.some((entry) =>
      Boolean(
        cleanText(
          (entry && entry.favoriteComment) ||
            (entry && entry.incoming && entry.incoming.favoriteComment),
        ),
      ),
    );

    if (!rows.length) {
      return `
<div class="smm-nearest-dialog-head">
  <div class="smm-nearest-dialog-title">Ближайшие срезы · ${escapeHtml(sourceLabel)}</div>
  <div class="smm-nearest-dialog-head-right">
    ${groupSelectHtml}
    <button type="button" class="smm-hub-dialog-close smm-nearest-close-btn">×</button>
  </div>
</div>
<div class="smm-nearest-dialog-meta">Дворян в выборке: ${escapeHtml(
        String(Number(data.eligibleIncomingCount) || 0),
      )} · окно: ${escapeHtml(String(lookaheadMinutes))} мин</div>
<div class="smm-plan-empty">Нет ближайших срезов на ближайшие ${escapeHtml(
        String(lookaheadMinutes),
      )} мин.</div>`;
    }

    const unitHeader = displayUnits
      .map((unit) => {
        const icon = getUnitIconFallback(unit);
        const disabled = isUnitDisabledForCalc(unit);
        return `<th title="${escapeHtml(getUnitLabel(unit))}"><button type="button" class="smm-unit-toggle${
          disabled ? " is-disabled" : ""
        }" data-unit-toggle="1" data-unit="${escapeHtml(unit)}" title="${escapeHtml(
          `${getUnitLabel(unit)} · ${disabled ? "выключен" : "включен"}`,
        )}">${
          icon
            ? `<img class="smm-unit-icon" src="${escapeHtml(icon)}" alt="${escapeHtml(unit)}">`
            : escapeHtml(getUnitLabel(unit))
        }</button></th>`;
      })
      .join("");

    const bodyRows = rows
      .map((entry, rowIndex) => {
        const incoming = entry && entry.incoming ? entry.incoming : {};
        const row = entry && entry.row ? entry.row : {};
        const meta = entry && entry.meta ? entry.meta : {};
        const incomingId = cleanText(incoming.id) || `nearest_${rowIndex}`;
        const villageText =
          cleanText(row.villageCoord || row.villageName) || "?";
        const villageHref = buildVillageInfoUrlByCoordOrId(villageText, row.villageId);
        const villageLinkHtml = villageHref
          ? `<a class="smm-village-coord smm-route-link" href="${escapeHtml(villageHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(villageText)}</a>`
          : `<span class="smm-village-coord">${escapeHtml(villageText)}</span>`;
        const targetCoord =
          cleanText(incoming.targetCoord || incoming.target) || "?";
        const incomingEtaMs = toFiniteEpochMs(
          incoming && (incoming.etaEpochMs || incoming.arrivalEpochMs),
        );
        const defaultSigilFromEntry = Number(entry && entry.defaultSigilPercent);
        const fallbackIncomingSigil = getIncomingSigilPercent(incoming);
        const defaultSigilPercent = Number.isFinite(defaultSigilFromEntry)
          ? normalizeSigilPercent(defaultSigilFromEntry)
          : Number.isFinite(fallbackIncomingSigil)
            ? normalizeSigilPercent(fallbackIncomingSigil)
            : 0;
        const contextBits = [];
        const contextLabel = cleanText(meta.contextLabel);
        if (contextLabel) contextBits.push(contextLabel);
        const nobleOrderLabel = formatNobleOrderLabel(meta && meta.nobleOrder);
        if (nobleOrderLabel && !contextBits.includes(nobleOrderLabel))
          contextBits.push(nobleOrderLabel);
        const contextText = contextBits.length
          ? contextBits.join(" · ")
          : "двор";
        const targetVillageId = resolveVillageIdByCoord(targetCoord);
        const targetHref = buildVillageInfoUrlByCoordOrId(targetCoord, targetVillageId);
        const contextLinkHtml = targetHref
          ? `<a class="smm-route-link" href="${escapeHtml(targetHref)}" target="_blank" rel="noopener noreferrer">${escapeHtml(contextText)}</a>`
          : escapeHtml(contextText);
        const favoriteComment =
          cleanText(entry && entry.favoriteComment) ||
          cleanText(incoming && incoming.favoriteComment) ||
          "—";
        const unitCells = displayUnits
          .map((unit) => {
            const unitState =
              row.units && row.units[unit] ? row.units[unit] : null;
            if (!unitState) {
              return `<td class="smm-slice-cell is-empty">—</td>`;
            }
            const max = Math.max(0, unitState.count || 0);
            if (max <= 0) {
              return `<td class="smm-slice-cell is-empty">—</td>`;
            }
            const canArrive = Boolean(unitState.canArrive);
            const value = canArrive ? max : 0;
            const depMs =
              canArrive && Number.isFinite(unitState.departureMs)
                ? unitState.departureMs
                : "";
            const baseTravelSeconds =
              Number.isFinite(unitState.travelBaseSeconds) &&
              unitState.travelBaseSeconds > 0
                ? Number(unitState.travelBaseSeconds.toFixed(3))
                : "";
            return `<td class="smm-slice-cell${canArrive ? "" : " is-blocked"}">
  <input class="smm-slice-input" type="number" min="${canArrive ? "1" : "0"}" step="1" max="${escapeHtml(
    max,
  )}" value="${escapeHtml(value)}" data-unit="${escapeHtml(unit)}" data-max="${escapeHtml(
    max,
  )}" data-base-travel="${escapeHtml(baseTravelSeconds)}" data-departure-ms="${escapeHtml(
    depMs,
  )}"${canArrive ? "" : " disabled"}>
  <span class="smm-slice-avail">макс ${escapeHtml(max)}</span>
</td>`;
          })
          .join("");
        const departureMs = Number(
          Number.isFinite(Number(row.sortDepartureMs))
            ? row.sortDepartureMs
            : row.bestDepartureMs,
        );
        const countdownText = Number.isFinite(departureMs)
          ? formatCountdown((departureMs - getServerNowMs()) / 1000)
          : "—";
        return `<tr class="smm-slice-row" data-row-key="${escapeHtml(
          `nearest_${incomingId}_${row.rowKey || rowIndex}`,
        )}" data-incoming-id="${escapeHtml(incomingId)}" data-village-id="${escapeHtml(
          row.villageId || "",
        )}" data-village-coord="${escapeHtml(villageText)}" data-target-coord="${escapeHtml(
          targetCoord,
        )}" data-eta-ms="${escapeHtml(Number.isFinite(incomingEtaMs) ? incomingEtaMs : "")}" data-best-departure-ms="${escapeHtml(
          departureMs || "",
        )}" data-selected-departure-ms="${escapeHtml(departureMs || "")}" data-action="slice" data-default-sigil="${escapeHtml(
          defaultSigilPercent,
        )}">
  <td class="smm-nearest-context">${contextLinkHtml}</td>
  ${
    hasCommentColumn
      ? `<td class="smm-nearest-comment">${escapeHtml(favoriteComment)}</td>`
      : ""
  }
  <td class="smm-slice-village">
    ${villageLinkHtml}
    <span class="smm-row-scale-wrap">
      <input class="smm-row-scale" type="range" min="1" max="100" step="1" value="100">
      <span class="smm-row-scale-label">100%</span>
    </span>
  </td>
  ${unitCells}
  <td class="smm-sigil-cell"><input class="smm-sigil-input" type="number" min="0" max="100" step="0.1" value="${escapeHtml(
    defaultSigilPercent,
  )}"></td>
  <td class="smm-slice-depart" data-role="depart">${escapeHtml(
    Number.isFinite(departureMs) ? formatTimeOnly(departureMs) : "—",
  )}</td>
  <td class="smm-slice-arrive">${escapeHtml(
    Number.isFinite(incomingEtaMs) ? formatTimeWithMs(incomingEtaMs) : "—",
  )}</td>
  <td class="smm-slice-timer"><span class="smm-plan-countdown" data-role="countdown"${
    Number.isFinite(departureMs)
      ? ` data-departure-ms="${escapeHtml(departureMs)}"`
      : ""
  }>${escapeHtml(countdownText)}</span></td>
  <td class="smm-slice-action">
    <div class="smm-slice-action-wrap">
      <button type="button" class="smm-go-btn" title="Перейти" data-copy-time="${escapeHtml(
        cleanText(entry.timingCenter) || "",
      )}">Перейти</button>
      <button type="button" class="smm-go-btn smm-schedule-btn" title="Запланировать">Запланировать</button>
      <button type="button" class="smm-go-btn smm-hub-btn" title="В хаб">В хаб</button>
    </div>
  </td>
</tr>`;
      })
      .join("");

    return `
<div class="smm-nearest-dialog-head">
  <div class="smm-nearest-dialog-title">Ближайшие срезы · ${escapeHtml(sourceLabel)}</div>
  <div class="smm-nearest-dialog-head-right">
    ${groupSelectHtml}
    <button type="button" class="smm-hub-dialog-close smm-nearest-close-btn">×</button>
  </div>
</div>
<div class="smm-nearest-dialog-meta">Дворян в выборке: ${escapeHtml(
      String(Number(data.eligibleIncomingCount) || 0),
    )} · вариантов среза в ближайшие ${escapeHtml(
      String(lookaheadMinutes),
    )} мин: ${escapeHtml(String(rows.length))}</div>
<div class="smm-slice-scroll">
  <table class="smm-slice-table">
    <thead>
      <tr>
        <th>Контекст</th>
        ${hasCommentColumn ? "<th>Комментарий</th>" : ""}
        <th>Деревня</th>
        ${unitHeader}
        <th>Сиг</th>
        <th>Выход</th>
        <th>Приход</th>
        <th>Таймер</th>
        <th>Приказ</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</div>`;
  };
  const openNearestSlicesDialog = async ({ source = "incomings" } = {}) => {
    if (!state.ui || !state.ui.root) return false;
    const sourceValue = cleanText(source);
    const sourceKey =
      sourceValue === "tribe"
        ? "tribe"
        : sourceValue === "favorites"
          ? "favorites"
          : "incomings";
    state.nearestDialogState = { open: true, source: sourceKey };
    closeNearestSlicesDialog({
      flushDeferredRerender: false,
      updateState: false,
    });
    setStatus(state.ui, "Ближайшие срезы: считаю варианты...");
    const renderDialogWithPayload = (payload, statusText = null) => {
      if (!state.ui || !state.ui.root) return false;
      const backdrop = document.createElement("div");
      backdrop.className = "smm-nearest-dialog-backdrop";
      backdrop.setAttribute("data-nearest-source", sourceKey);
      backdrop.innerHTML = `<section class="smm-nearest-dialog-card">${renderNearestSlicesDialogContent(
        payload,
        { source: sourceKey },
      )}</section>`;
      state.ui.root.appendChild(backdrop);
      initSliceRows(backdrop);
      syncAllVillageGroupSelects(backdrop);
      scheduleApplySliceScrollLimits(backdrop);
      updateCountdownNodes();
      startCountdownTicker();
      if (cleanText(statusText)) {
        setStatus(state.ui, statusText);
      }
      return true;
    };

    const runtimeReadyFromCache = await ensureMessageRuntimeDataLoaded({
      cacheOnly: true,
    });
    if (runtimeReadyFromCache) {
      try {
        const payload = buildNearestSliceRowsData({ source: sourceKey });
        const lookaheadMinutes = Math.max(
          1,
          toInt(payload && payload.lookaheadMinutes) || getNearestSliceWindowMinutes(),
        );
        renderDialogWithPayload(
          payload,
          `Ближайшие срезы: ${payload.rows.length} вариантов в ближайшие ${lookaheadMinutes} мин.`,
        );
      } catch (error) {
        const text = cleanText(error && error.message) || "unknown";
        const fallbackPayload = {
          lookaheadMinutes: getNearestSliceWindowMinutes(),
          eligibleIncomingCount: 0,
          rows: [],
        };
        renderDialogWithPayload(
          fallbackPayload,
          `Ближайшие срезы: ошибка построения таблицы (${text}).`,
        );
      }
      return true;
    }

    // Окно открываем сразу даже без сетевых данных, чтобы интерфейс не блокировался.
    const fallbackPayload = {
      lookaheadMinutes: getNearestSliceWindowMinutes(),
      eligibleIncomingCount: 0,
      rows: [],
    };
    renderDialogWithPayload(
      fallbackPayload,
      "Ближайшие срезы: кэш пуст, подгружаю данные в фоне...",
    );

    void ensureMessageRuntimeDataLoaded({ cacheOnly: false })
      .then((runtimeReady) => {
        if (!runtimeReady || !state.ui || !state.ui.root) return;
        const dialog = state.ui.root.querySelector(
          '.smm-nearest-dialog-backdrop[data-nearest-source="' +
            String(sourceKey).replace(/"/g, '\\"') +
            '"]',
        );
        if (!dialog) return;
        let payload = null;
        try {
          payload = buildNearestSliceRowsData({ source: sourceKey });
        } catch (error) {
          const text = cleanText(error && error.message) || "unknown";
          setStatus(
            state.ui,
            `Ближайшие срезы: ошибка построения таблицы (${text}).`,
          );
          return;
        }
        const lookaheadMinutes = Math.max(
          1,
          toInt(payload && payload.lookaheadMinutes) || getNearestSliceWindowMinutes(),
        );
        const card = dialog.querySelector(".smm-nearest-dialog-card");
        if (!card) return;
        card.innerHTML = renderNearestSlicesDialogContent(payload, {
          source: sourceKey,
        });
        initSliceRows(dialog);
        syncAllVillageGroupSelects(dialog);
        scheduleApplySliceScrollLimits(dialog);
        updateCountdownNodes();
        startCountdownTicker();
        setStatus(
          state.ui,
          `Ближайшие срезы: ${payload.rows.length} вариантов в ближайшие ${lookaheadMinutes} мин.`,
        );
      })
      .catch((error) => {
        const text = cleanText(error && error.message) || "unknown";
        setStatus(
          state.ui,
          `Ближайшие срезы: ошибка фоновой загрузки (${text}).`,
        );
      });
    return true;
  };

  const restoreNearestSlicesDialogIfMissing = () => {
    if (!state.ui || !state.ui.root) return false;
    const dialogState =
      state.nearestDialogState &&
      typeof state.nearestDialogState === "object" &&
      !Array.isArray(state.nearestDialogState)
        ? state.nearestDialogState
        : { open: false, source: null };
    if (!dialogState.open) return false;
    const sourceValue = cleanText(dialogState.source);
    const sourceKey =
      sourceValue === "tribe"
        ? "tribe"
        : sourceValue === "favorites"
          ? "favorites"
          : "incomings";
    const existing = state.ui.root.querySelector(
      '.smm-nearest-dialog-backdrop[data-nearest-source="' +
        String(sourceKey).replace(/"/g, '\\"') +
        '"]',
    );
    if (existing) return false;
    void openNearestSlicesDialog({ source: sourceKey });
    return true;
  };

  const renderTribeTab = (ui) => {
    if (!ui) return;
    stopCountdownTicker();
    state.pendingIncomingsRerender = false;
    state.pendingIncomingsRerenderReason = null;
    const hubConnection = normalizeHubConnection(state.hubConnection);
    const connectedUrl = cleanText(hubConnection && hubConnection.url);
    const exchangeEnabled = Boolean(getUiSetting("exchangeTribeAttacks"));
    const exchangeError = cleanText(
      state.hubTribeError || state.hubTribeSyncError,
    );
    if (!connectedUrl || !exchangeEnabled || exchangeError) {
      ui.list.innerHTML = `<div class="smm-empty">хаб не подключен</div>`;
      return;
    }

    const tribeAttackItemsRaw = Array.isArray(state.hubTribeIncomings)
      ? state.hubTribeIncomings
      : [];
    const tribeCommandItems = Array.isArray(state.hubTribeCommandsRows)
      ? state.hubTribeCommandsRows
      : [];
    const tribePlanItems = Array.isArray(state.hubTribePlansRows)
      ? state.hubTribePlansRows
      : [];
    const attackedNickOptionsMap = new Map();
    tribeAttackItemsRaw.forEach((item) => {
      const ownerNick = cleanText(item && item.ownerNick);
      if (!ownerNick) return;
      const ownerKey = normalizeNickKey(ownerNick);
      if (!ownerKey) return;
      if (!attackedNickOptionsMap.has(ownerKey)) {
        attackedNickOptionsMap.set(ownerKey, ownerNick);
      }
    });
    const attackedNickOptions = Array.from(attackedNickOptionsMap.entries())
      .sort((left, right) =>
        String(left[1] || "").localeCompare(String(right[1] || ""), "ru"),
      )
      .map(([key, label]) => ({ key, label }));
    let ownerNickFilterKey =
      normalizeNickKey(state.tribeOwnerNickFilter) || "all";
    if (
      ownerNickFilterKey !== "all" &&
      !attackedNickOptionsMap.has(ownerNickFilterKey)
    ) {
      ownerNickFilterKey = "all";
      state.tribeOwnerNickFilter = "all";
    }
    const hasTypeFilter =
      Boolean(state.tribeFilterNoble) ||
      Boolean(state.tribeFilterLarge) ||
      Boolean(state.tribeFilterMedium);
    const tribeAttackItems = tribeAttackItemsRaw.filter((item) => {
      if (!item) return false;
      if (ownerNickFilterKey !== "all") {
        const ownerNick = cleanText(item && item.ownerNick) || "";
        if (normalizeNickKey(ownerNick) !== ownerNickFilterKey) return false;
      }
      if (!hasTypeFilter) return true;
      const knownSizeClass = getIncomingKnownSizeClass(item);
      const includeByNoble =
        Boolean(state.tribeFilterNoble) && isNobleIncomingThreat(item);
      const includeByLarge =
        Boolean(state.tribeFilterLarge) && knownSizeClass === "large";
      const includeByMedium =
        Boolean(state.tribeFilterMedium) && knownSizeClass === "medium";
      return includeByNoble || includeByLarge || includeByMedium;
    });
    const tribeItems = buildFilteredTribeTimelineItems({
      attacks: tribeAttackItems,
      commands: tribeCommandItems,
      plans: tribePlanItems,
    });
    const troopsRows = Array.isArray(state.hubTribeTroopsRows)
      ? state.hubTribeTroopsRows
      : [];
    const troopsModel = buildHubTribeTroopsModel(troopsRows);
    const searchQuery = cleanText(state.tribeSearchQuery) || "";
    const ownerOptionsHtml =
      `<option value="all"${
        ownerNickFilterKey === "all" ? " selected" : ""
      }>все</option>` +
      attackedNickOptions
        .map(
          (item) =>
            `<option value="${escapeHtml(item.key)}"${
              ownerNickFilterKey === item.key ? " selected" : ""
            }>${escapeHtml(item.label)}</option>`,
        )
        .join("");
    renderIncomings(
      ui,
      {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: connectedUrl,
        count: tribeItems.length,
        items: tribeItems,
      },
      {
        includeHubAndMass: false,
        defenseIncomings: { items: tribeAttackItems },
        defenseSupportIncomings: { items: [] },
        defenseOverviewCommands: { items: [] },
        defenseTroopsModel: troopsModel,
        coordFilter: searchQuery,
        showNearestSlicesButton: false,
        emptyMessage: state.hubTribeLoading
          ? "Племенные входящие подгружаются..."
          : "Племенные входящие не найдены.",
      },
    );
    const updatedText = Number.isFinite(state.hubTribeLastLoadedMs)
      ? `обновлено ${formatDateTime(state.hubTribeLastLoadedMs)}`
      : state.hubTribeLoading
        ? "загрузка..."
        : "ожидание данных";
    const tribeLoadingHint = state.hubTribeLoading
      ? `<span class="smm-tribe-loading-hint">Фильтры заработают после загрузки данных, надо подождать 5-50сек.</span>`
      : "";
    const summary = document.createElement("div");
    summary.className = "smm-hub-toolbar";
    summary.innerHTML = `<span class="smm-plan-village">Племенные события: ${escapeHtml(
      String(tribeItems.length),
    )} · ${escapeHtml(updatedText)}</span>
    <button type="button" class="smm-plan-btn smm-nearest-open-btn" data-nearest-source="tribe">Ближайшие срезы</button>
    <div class="smm-tribe-filters-wrap">
      <label class="smm-tribe-search-wrap">
        <span class="smm-tribe-search-label">Поиск кор:</span>
        <input type="text" class="smm-tribe-search-input" placeholder="например 553|436" value="${escapeHtml(searchQuery)}">
      </label>
      <label class="smm-tribe-toggle"><input type="checkbox" class="smm-tribe-filter-toggle" data-filter="noble"${
        state.tribeFilterNoble ? " checked" : ""
      }>Дворяне</label>
      <label class="smm-tribe-toggle"><input type="checkbox" class="smm-tribe-filter-toggle" data-filter="large"${
        state.tribeFilterLarge ? " checked" : ""
      }>Большие</label>
      <label class="smm-tribe-toggle"><input type="checkbox" class="smm-tribe-filter-toggle" data-filter="medium"${
        state.tribeFilterMedium ? " checked" : ""
      }>Средние</label>
      <label class="smm-tribe-owner-wrap"><span class="smm-tribe-search-label">Ник:</span><select class="smm-tribe-owner-select">${ownerOptionsHtml}</select></label>
      ${tribeLoadingHint}
    </div>`;
    ui.list.prepend(summary);
  };

  const renderFavoritesTab = (ui) => {
    if (!ui) return;
    stopCountdownTicker();
    state.pendingIncomingsRerender = false;
    state.pendingIncomingsRerenderReason = null;
    const before = Array.isArray(state.favoritesEntries)
      ? state.favoritesEntries.length
      : 0;
    const normalized = loadFavoriteEntries();
    if (normalized.length !== before) saveFavoriteEntries();
    const favoriteItems = getFavoriteIncomingItems();
    renderIncomings(
      ui,
      {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: location.href,
        count: favoriteItems.length,
        items: favoriteItems,
      },
      {
        includeHubAndMass: false,
        nearestSlicesSource: "favorites",
        showNearestSlicesButton: true,
        applyHiddenFilters: false,
        allowIncomingHide: false,
        allowVillageGroupHide: false,
        emptyMessage: "Избранное пусто.",
      },
    );
    const summary = document.createElement("div");
    summary.className = "smm-hub-toolbar";
    summary.innerHTML = `<span class="smm-plan-village">Избранных атак: ${escapeHtml(
      String(favoriteItems.length),
    )}</span>`;
    ui.list.prepend(summary);
  };

  const renderArchiveTab = (ui) => {
    if (!ui) return;
    stopCountdownTicker();
    const archived = (
      Array.isArray(state.archivedManeuvers) ? state.archivedManeuvers : []
    )
      .map((item) => normalizeArchivedManeuver(item))
      .filter(Boolean)
      .sort(
        (a, b) => (Number(b.resolvedAtMs) || 0) - (Number(a.resolvedAtMs) || 0),
      );

    if (!archived.length) {
      ui.list.innerHTML = `
<section class="smm-plan-panel">
  <div class="smm-plan-head">
    <span>Статистика</span>
    <span>0 записей</span>
  </div>
  <div class="smm-plan-empty">Статистика пока пуста.</div>
</section>`;
      return;
    }

    const rowsHtml = archived
      .map((entry) => {
        const plannedUnitsHtml = formatPlanUnitsIconsHtml(entry.units);
        const matchedUnitsHtml = formatPlanUnitsIconsHtml(entry.matchedUnits);
        const typeLabel = getManeuverTypeLabel(entry.action);
        const statusLabel = getManeuverStatusLabel(entry.status);
        const departureText = Number.isFinite(Number(entry.departureMs))
          ? formatDateTimeShort(entry.departureMs)
          : "—";
        const matchedArrivalMs = toFiniteEpochMs(entry.matchedArrivalMs);
        const arrivalText = Number.isFinite(matchedArrivalMs)
          ? formatDateTimeShortWithMs(matchedArrivalMs)
          : entry.matchedArrivalText || "—";
        const commandTypeLabel =
          entry.matchedCommandTypeLabel ||
          (entry.matchedCommandType
            ? getOwnCommandTypeLabel(entry.matchedCommandType)
            : "—");
        const fromValue =
          entry.fromVillageCoord ||
          entry.matchedFromCoord ||
          entry.fromVillageId ||
          "?";
        const toValue = entry.targetCoord || entry.matchedToCoord || "?";
        return `<tr class="smm-plan-cmd-row">
  <td>${escapeHtml(typeLabel)}</td>
  <td>${escapeHtml(statusLabel)}</td>
  <td>${plannedUnitsHtml}</td>
  <td>${matchedUnitsHtml}</td>
  <td>${escapeHtml(fromValue)}</td>
  <td>${escapeHtml(toValue)}</td>
  <td>${escapeHtml(departureText)}</td>
  <td>${escapeHtml(arrivalText)}</td>
  <td>${escapeHtml(commandTypeLabel)}</td>
</tr>`;
      })
      .join("");
    const totalCount = archived.length;
    const successCount = archived.filter(
      (entry) => normalizeManeuverStatus(entry.status) === MANEUVER_STATUS.success,
    ).length;
    const missedCount = archived.filter(
      (entry) => normalizeManeuverStatus(entry.status) === MANEUVER_STATUS.missed,
    ).length;
    const timingMissCount = archived.filter(
      (entry) =>
        normalizeManeuverStatus(entry.status) === MANEUVER_STATUS.timingMiss,
    ).length;
    const archiveSummaryText = `${missedCount}/${totalCount} пропущено, ${successCount}/${totalCount} успешно, ${timingMissCount}/${totalCount} не попал в тайминг.`;

    ui.list.innerHTML = `
<section class="smm-plan-panel smm-slice-panel">
  <div class="smm-plan-head">
    <span>Статистика</span>
    <span>${escapeHtml(archived.length)} записей (макс ${escapeHtml(ARCHIVE_MAX_ITEMS)})</span>
  </div>
  <div class="smm-meta">${escapeHtml(archiveSummaryText)}</div>
  <div class="smm-slice-scroll">
    <table class="smm-slice-table">
      <thead>
        <tr>
          <th>Тип манёвра</th>
          <th>Статус</th>
          <th>Юниты (план)</th>
          <th>Юниты (факт)</th>
          <th>Откуда</th>
          <th>Куда</th>
          <th>Выход</th>
          <th>Приход</th>
          <th>Тип приказа</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</section>`;
  };

  const renderActiveTab = (ui) => {
    if (!ui) return;
    renderTopTabs(ui);
    if (state.activeTab === "plan") {
      renderPlanTab(ui);
    } else if (state.activeTab === "hub") {
      renderHubTab(ui);
    } else if (state.activeTab === "tribe") {
      renderTribeTab(ui);
    } else if (state.activeTab === "favorites") {
      renderFavoritesTab(ui);
    } else if (state.activeTab === "archive") {
      renderArchiveTab(ui);
    } else {
      renderIncomings(ui, state.incomings);
    }
    scheduleApplySliceScrollLimits(ui.root || document);
    restoreNearestSlicesDialogIfMissing();
  };

  const renderIncomings = (ui, incomings, options = {}) => {
    if (!ui) return;
    state.pendingIncomingsRerender = false;
    state.pendingIncomingsRerenderReason = null;

    const renderOptions =
      options && typeof options === "object" && !Array.isArray(options)
        ? options
        : {};
    const includeHubAndMass = renderOptions.includeHubAndMass !== false;
    const showNearestSlicesButton =
      renderOptions.showNearestSlicesButton !== false;
    const applyHiddenFilters = renderOptions.applyHiddenFilters !== false;
    const allowIncomingHide =
      renderOptions.allowIncomingHide !== false && applyHiddenFilters;
    const allowVillageGroupHide =
      renderOptions.allowVillageGroupHide !== false && applyHiddenFilters;
    const nearestSlicesSource =
      cleanText(renderOptions.nearestSlicesSource) ||
      (state.activeTab === "tribe" ? "tribe" : "incomings");

    ui.list.innerHTML = "";
    if (showNearestSlicesButton) {
      const nearestToolbar = document.createElement("div");
      nearestToolbar.className = "smm-nearest-toolbar";
      nearestToolbar.innerHTML = `<button type="button" class="smm-plan-btn smm-nearest-open-btn" data-nearest-source="${escapeHtml(
        nearestSlicesSource,
      )}">Ближайшие срезы</button>`;
      ui.list.appendChild(nearestToolbar);
    }
    const ownItems =
      incomings && Array.isArray(incomings.items) ? incomings.items : [];
    const settings = normalizeUiSettings(state.uiSettings);
    const hubItemsRaw =
      includeHubAndMass && Array.isArray(state.hubQueryIncomings)
        ? state.hubQueryIncomings
        : [];
    const massItemsRaw =
      includeHubAndMass && Array.isArray(state.hubMassIncomings)
        ? state.hubMassIncomings
        : [];
    const buildCoordEtaKey = (item) => {
      if (!item || typeof item !== "object") return null;
      const coord = normalizeCoordIdentity(item.targetCoord || item.target);
      const etaMs = toFiniteEpochMs(item.etaEpochMs || item.arrivalEpochMs);
      if (!coord || !Number.isFinite(etaMs)) return null;
      return `${coord}|${Math.round(etaMs)}`;
    };
    const ownCoordEtaKeys = new Set();
    ownItems.forEach((item) => {
      const key = buildCoordEtaKey(item);
      if (!key) return;
      ownCoordEtaKeys.add(key);
    });
    const hideHubDuplicates = Boolean(settings.hideHubDuplicatesByCoordTime);
    const hubItems = hubItemsRaw.filter((item) => {
      if (settings.hideHubSliceIncomings) return false;
      if (!hideHubDuplicates) return true;
      const key = buildCoordEtaKey(item);
      return !(key && ownCoordEtaKeys.has(key));
    });
    const massItems = massItemsRaw.filter((item) => {
      if (settings.hideHubMassIncomings) return false;
      if (!hideHubDuplicates) return true;
      const key = buildCoordEtaKey(item);
      return !(key && ownCoordEtaKeys.has(key));
    });
    const coordFilterRaw = cleanText(renderOptions.coordFilter);
    const coordFilter = coordFilterRaw
      ? String(coordFilterRaw).replace(/\s+/g, "")
      : null;
    const allItems = ownItems.concat(hubItems).concat(massItems);
    const items = allItems.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const isTribeReadOnlyEntry = Boolean(
        item.isTribeAllyCommand || item.isTribeAllyPlanned,
      );
      // Скрытие применяем только к входящим атакам (где есть кнопка "Скрыть"),
      // а сопл. приказы/запланированные в "Племя" всегда показываем.
      if (
        applyHiddenFilters &&
        !isTribeReadOnlyEntry &&
        isIncomingHidden(item)
      ) {
        return false;
      }
      if (!coordFilter) return true;
      const targetText = String(
        cleanText(item.targetCoord || item.target || item.targetVillageId) ||
          "",
      )
        .toLowerCase()
        .replace(/\s+/g, "");
      return targetText.includes(coordFilter.toLowerCase());
    });
    const hubSpamCandidatesByOrigin = new Map();
    const hubSpamSourceItems = Array.isArray(state.hubTribeAllIncomings)
      ? state.hubTribeAllIncomings
      : Array.isArray(state.hubTribeIncomings)
        ? state.hubTribeIncomings
        : [];
    hubSpamSourceItems.forEach((hubItem) => {
      if (!hubItem) return;
      const originKey = normalizeCoordKey(
        hubItem.originCoord || hubItem.origin || "",
      );
      if (!originKey) return;
      const sizeClass = getIncomingKnownSizeClass(hubItem);
      if (sizeClass !== "large" && sizeClass !== "medium") return;
      const commandType = String(
        cleanText(hubItem.commandType || hubItem.displayType || "") || "",
      ).toLowerCase();
      if (
        commandType &&
        !/(?:attack|noble|snob|двор|атака|перехват)/i.test(commandType)
      ) {
        return;
      }
      if (!hubSpamCandidatesByOrigin.has(originKey)) {
        hubSpamCandidatesByOrigin.set(originKey, []);
      }
      hubSpamCandidatesByOrigin.get(originKey).push({
        etaMs: toFiniteEpochMs(hubItem.etaEpochMs || hubItem.arrivalEpochMs),
        targetKey: normalizeCoordKey(hubItem.targetCoord || hubItem.target),
      });
    });
    const isProbableSpamIncoming = (incoming) => {
      if (!incoming) return false;
      if (
        incoming.isHubIncoming ||
        incoming.isHubMass ||
        incoming.isTribeIncoming ||
        incoming.isTribeAllyCommand ||
        incoming.isTribeAllyPlanned
      ) {
        return false;
      }
      const knownSize = getIncomingKnownSizeClass(incoming);
      if (knownSize === "small" || knownSize === "medium" || knownSize === "large") {
        return false;
      }
      const typeText = String(
        cleanText(
          incoming.commandType || incoming.displayType || incoming.commandLabel,
        ) || "",
      ).toLowerCase();
      if (
        typeText &&
        !/(?:attack|noble|snob|двор|атака|перехват)/i.test(typeText)
      ) {
        return false;
      }
      const originKey = normalizeCoordKey(
        incoming.originCoord || incoming.origin || "",
      );
      if (!originKey) return false;
      const candidates = hubSpamCandidatesByOrigin.get(originKey) || [];
      if (!candidates.length) return false;
      const currentEta = toFiniteEpochMs(
        incoming.etaEpochMs || incoming.arrivalEpochMs,
      );
      const currentTarget = normalizeCoordKey(
        incoming.targetCoord || incoming.target || "",
      );
      return candidates.some((candidate) => {
        if (!candidate) return false;
        const sameTarget =
          cleanText(candidate.targetKey) &&
          cleanText(currentTarget) &&
          candidate.targetKey === currentTarget;
        const candidateEta = Number(candidate.etaMs);
        const sameEta =
          Number.isFinite(candidateEta) &&
          Number.isFinite(currentEta) &&
          Math.abs(candidateEta - currentEta) <= 1000;
        return !(sameTarget && sameEta);
      });
    };
    if (applyHiddenFilters && cleanText(state.openIncomingId)) {
      const openedItem = allItems.find(
        (item) =>
          String(cleanText(item && item.id) || "") ===
          String(state.openIncomingId),
      );
      if (openedItem && isIncomingHidden(openedItem)) {
        state.openIncomingId = null;
      }
    }
    const defenseTroopsModel =
      renderOptions.defenseTroopsModel ||
      (state.troopsDefense &&
      Array.isArray(state.troopsDefense.villages) &&
      state.troopsDefense.villages.length
        ? state.troopsDefense
        : state.troops);
    const defenseAssessment = buildIncomingDefenseAssessmentMap({
      incomings: renderOptions.defenseIncomings || state.incomings,
      troops: defenseTroopsModel,
      supportIncomings:
        renderOptions.defenseSupportIncomings !== undefined
          ? renderOptions.defenseSupportIncomings
          : state.supportIncomings,
      overviewCommands:
        renderOptions.defenseOverviewCommands !== undefined
          ? renderOptions.defenseOverviewCommands
          : state.overviewCommandsDump,
    });
    const formatIntRu = (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return "0";
      return Math.round(n).toLocaleString("ru-RU");
    };
    const getTribeOperationTypeLabel = (item) => {
      const source = String(
        [
          cleanText(item && item.commandType) || "",
          cleanText(item && item.kindText) || "",
          cleanText(item && item.commandLabel) || "",
        ].join(" "),
      ).toLowerCase();
      if (/(?:return|возврат|обратно)/i.test(source)) return "возврат";
      if (/(?:support|подкреп|поддерж|def|задеф|slice|срез)/i.test(source))
        return "подкреп";
      if (/(?:attack|атака|перехват|intercept)/i.test(source)) return "атака";
      return "приказ";
    };
    const renderSquadUnitsChips = (unitsRaw) => {
      const units = normalizeUnitsMap(unitsRaw);
      const keys = getSortedUnitKeys(units);
      if (!keys.length) return "";
      return keys
        .map((unit) => {
          const count = Math.max(0, toInt(units[unit]) || 0);
          if (!count) return "";
          const iconSrc = getUnitIconFallback(unit);
          const iconHtml = iconSrc
            ? `<img class="smm-unit-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(unit)}">`
            : "";
          return `<span class="smm-unit-chip">${iconHtml}${escapeHtml(String(count))}</span>`;
        })
        .filter(Boolean)
        .join("");
    };
    const renderCoordLinkHtml = (coordRaw, villageIdRaw) => {
      const coordText = cleanText(coordRaw) || "?";
      const href = buildVillageInfoUrlByCoordOrId(coordText, villageIdRaw);
      if (!href) return escapeHtml(coordText);
      return `<a class="smm-route-link" href="${escapeHtml(
        href,
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(coordText)}</a>`;
    };
    const extractVillageNameFromTarget = (value) => {
      const text = cleanText(value);
      if (!text) return null;
      const stripped = text
        .replace(/\(\s*\d{1,3}\|\d{1,3}\s*\)\s*K\d{1,3}\b/gi, "")
        .replace(/\(\s*\d{1,3}\|\d{1,3}\s*\)/g, "")
        .replace(/\bK\d{1,3}\b/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
      if (!stripped) return null;
      const parsed = parseCoord(stripped);
      if (parsed && parsed.key === normalizeCoordKey(stripped)) return null;
      return stripped;
    };
    const pickVillageLabel = (currentRaw, nextRaw, coordKeyRaw) => {
      const current = cleanText(currentRaw);
      const next = cleanText(nextRaw);
      if (!next) return current;
      if (!current) return next;
      const coordKey = cleanText(coordKeyRaw);
      const currentName = extractVillageNameFromTarget(current);
      const nextName = extractVillageNameFromTarget(next);
      if (!currentName && nextName) return next;
      if (currentName && !nextName) return current;
      if (coordKey) {
        const currentCoordOnly =
          normalizeCoordKey(current) === coordKey && !currentName;
        const nextCoordOnly = normalizeCoordKey(next) === coordKey && !nextName;
        if (currentCoordOnly && !nextCoordOnly) return next;
        if (nextCoordOnly && !currentCoordOnly) return current;
      }
      return current.length >= next.length ? current : next;
    };
    const villageLabelByCoord = new Map();
    const rememberVillageLabel = (coordRaw, labelRaw) => {
      const coordKey = normalizeCoordKey(coordRaw || labelRaw);
      const label = cleanText(labelRaw) || cleanText(coordRaw);
      if (!coordKey || !label) return;
      const current = villageLabelByCoord.get(coordKey) || null;
      villageLabelByCoord.set(
        coordKey,
        pickVillageLabel(current, label, coordKey),
      );
    };
    const rememberVillageLabelsFromTroops = (troopsDump) => {
      const villages =
        troopsDump && Array.isArray(troopsDump.villages)
          ? troopsDump.villages
          : [];
      villages.forEach((village) =>
        rememberVillageLabel(
          village && (village.villageCoord || village.villageName),
          village && (village.villageName || village.villageCoord),
        ),
      );
    };
    items.forEach((item) =>
      rememberVillageLabel(
        item && (item.targetCoord || item.target),
        item && item.target,
      ),
    );
    rememberVillageLabelsFromTroops(state.troops);
    rememberVillageLabelsFromTroops(state.troopsDefense);
    const resolveGroupHeader = (group) => {
      const coordKey = cleanText(group && group.coordKey) || null;
      const labelFromCoord = coordKey
        ? cleanText(villageLabelByCoord.get(coordKey))
        : null;
      const bestLabel = pickVillageLabel(
        labelFromCoord,
        group && group.label,
        coordKey || "",
      );
      const name =
        extractVillageNameFromTarget(bestLabel) ||
        extractVillageNameFromTarget(labelFromCoord) ||
        cleanText(bestLabel) ||
        coordKey ||
        "Цель";
      const parsedFromLabel = parseCoord(bestLabel);
      const coord = coordKey || (parsedFromLabel ? parsedFromLabel.key : null);
      return {
        title: cleanText(name) || coord || "Цель",
        coord: coord && coord !== cleanText(name) ? coord : null,
      };
    };
    const getIncomingEtaForSort = (item) =>
      toFiniteEpochMs(
        item && (item.arrivalEpochMs || item.etaEpochMs || item.arrivalMs),
      );
    const groupedItemsMap = new Map();
    const groupedItems = [];
    items.forEach((item, itemIndex) => {
      const coordKey = normalizeCoordKey(
        item && (item.targetCoord || item.target),
      );
      const villageIdKey = cleanText(item && item.targetVillageId);
      const fallbackKey = cleanText(item && item.id) || String(itemIndex);
      const groupKey = coordKey
        ? `coord:${coordKey}`
        : villageIdKey
          ? `village:${villageIdKey}`
          : `incoming:${fallbackKey}`;
      let group = groupedItemsMap.get(groupKey);
      if (!group) {
        group = {
          key: groupKey,
          coordKey: coordKey || null,
          villageId: villageIdKey || null,
          label: null,
          items: [],
        };
        groupedItemsMap.set(groupKey, group);
        groupedItems.push(group);
      }
      if (!group.coordKey && coordKey) group.coordKey = coordKey;
      group.label = pickVillageLabel(
        group.label,
        cleanText(item && item.target) || cleanText(item && item.targetCoord),
        group.coordKey || coordKey || "",
      );
      group.items.push(item);
    });
    groupedItems.forEach((group) => {
      group.items.sort((left, right) => {
        const leftEta = getIncomingEtaForSort(left);
        const rightEta = getIncomingEtaForSort(right);
        if (
          Number.isFinite(leftEta) &&
          Number.isFinite(rightEta) &&
          leftEta !== rightEta
        ) {
          return leftEta - rightEta;
        }
        const leftTimer = Number.isFinite(Number(left && left.timerSeconds))
          ? Number(left.timerSeconds)
          : Number.MAX_SAFE_INTEGER;
        const rightTimer = Number.isFinite(Number(right && right.timerSeconds))
          ? Number(right.timerSeconds)
          : Number.MAX_SAFE_INTEGER;
        if (leftTimer !== rightTimer) return leftTimer - rightTimer;
        return String(cleanText(left && left.id) || "").localeCompare(
          String(cleanText(right && right.id) || ""),
        );
      });
    });
    const visibleGroupedItems = applyHiddenFilters
      ? groupedItems.filter(
          (group) => !isVillageGroupHiddenByKey(buildVillageGroupHideKey(group)),
        )
      : groupedItems;
    let hasOpenPanel = false;

    if (!items.length) {
      stopCountdownTicker();
      const empty = document.createElement("div");
      empty.className = "smm-empty";
      const customEmpty = cleanText(renderOptions.emptyMessage);
      empty.textContent = customEmpty
        ? customEmpty
        : state.hubQueryLoading || state.hubMassLoading
          ? "Входящие атаки не найдены. Данные хаба подгружаются..."
          : "Входящие атаки не найдены или не удалось распарсить страницу.";
      ui.list.appendChild(empty);
      return;
    }
    if (!visibleGroupedItems.length) {
      stopCountdownTicker();
      const empty = document.createElement("div");
      empty.className = "smm-empty";
      empty.textContent =
        "Все карточки деревень скрыты. Используй «Показать все скрытые атаки» в настройках.";
      ui.list.appendChild(empty);
      return;
    }

    const incomingGrid = document.createElement("div");
    incomingGrid.className = "smm-incomings-grid";
    ui.list.appendChild(incomingGrid);

    visibleGroupedItems.forEach((group) => {
      const groupHeader = resolveGroupHeader(group);
      const groupHideKey = buildVillageGroupHideKey(group);
      const hideVillageButtonHtml = allowVillageGroupHide && groupHideKey
        ? `<button type="button" class="smm-plan-btn smm-hide-village-btn" data-hide-village-key="${escapeHtml(
            groupHideKey,
          )}">Скрыть деревню</button>`
        : "";
      const groupCard = document.createElement("section");
      groupCard.className = "smm-village-group";
      groupCard.innerHTML = `<header class="smm-village-group-head"><span class="smm-village-group-title">${escapeHtml(
        groupHeader.title || "Цель",
      )}</span><span class="smm-village-group-head-right">${
        groupHeader.coord
          ? `<span class="smm-village-group-coord">${escapeHtml(groupHeader.coord)}</span>`
          : ""
      }${hideVillageButtonHtml}</span></header>`;
      const groupList = document.createElement("div");
      groupList.className = "smm-village-group-list";
      groupCard.appendChild(groupList);
      incomingGrid.appendChild(groupCard);

      group.items.forEach((item) => {
        const card = document.createElement("article");
        const isHubIncoming = Boolean(item && item.isHubIncoming);
        const isMassIncoming = Boolean(item && item.isHubMass);
        const isTribeIncoming = Boolean(item && item.isTribeIncoming);
        const isTribeAllyCommand = Boolean(item && item.isTribeAllyCommand);
        const isTribeAllyPlanned = Boolean(item && item.isTribeAllyPlanned);
        const isTribeReadOnlyEntry = isTribeAllyCommand || isTribeAllyPlanned;
        const rawTypeKey = getIncomingTypeKey(item);
        const commandTypeKey = cleanText(item && item.commandType);
        const incomingSizeClass = getIncomingSizeClass(item);
        const typeLabelBySizeClass =
          incomingSizeClass === "small"
            ? "attack_small"
            : incomingSizeClass === "medium"
              ? "attack_medium"
              : incomingSizeClass === "large"
                ? "attack_large"
                : null;
        const sizeTypeKey =
          commandTypeKey === "attack_small" ||
          commandTypeKey === "attack_medium" ||
          commandTypeKey === "attack_large"
            ? commandTypeKey
            : typeLabelBySizeClass;
        const typeKey =
          !isHubIncoming && !isMassIncoming
            ? sizeTypeKey || rawTypeKey
            : rawTypeKey;
        const cardClasses = [`smm-item`, `smm-${typeKey || "other"}`];
        if (rawTypeKey && rawTypeKey !== typeKey) {
          cardClasses.push(`smm-${rawTypeKey}`);
        }
        if (isHubIncoming) cardClasses.push("smm-hub-card");
        if (isMassIncoming) cardClasses.push("smm-mass-card");
        if (isTribeIncoming) cardClasses.push("smm-tribe-card");
        if (isTribeAllyCommand) cardClasses.push("smm-tribe-command-card");
        if (isTribeAllyPlanned) cardClasses.push("smm-tribe-planned-card");
        if (item.hasNoble) cardClasses.push("smm-noble", "smm-noble-threat");
        const defenseInfo =
          isHubIncoming || isMassIncoming
            ? null
            : defenseAssessment.get(String(item.id || ""));
        if (defenseInfo && defenseInfo.status === "ok")
          cardClasses.push("smm-def-ok");
        if (defenseInfo && defenseInfo.status === "low")
          cardClasses.push("smm-def-low");
        card.className = cardClasses.join(" ");
        if (defenseInfo) {
          card.title = `Деф-оценка ${defenseInfo.status === "ok" ? "OK" : "LOW"}: ${defenseInfo.availableEquivalent}/${defenseInfo.requiredEquivalent} (в деревне ${defenseInfo.baseEquivalent} + входящие ${defenseInfo.supportEquivalent} + приказы ${defenseInfo.commandEquivalent || 0}) · цель ${item.targetCoord || item.target || "?"} · vid ${item.targetVillageId || "?"}`;
        }

        const attackerNick =
          cleanText(item && (item.attackerNick || item.player)) || null;
        const ownerNick = cleanText(item && item.ownerNick) || null;
        const player = isTribeIncoming
          ? ownerNick && attackerNick && ownerNick !== attackerNick
            ? `${ownerNick}<-${attackerNick}`
            : ownerNick || attackerNick || "Unknown player"
          : item.player || "Unknown player";
        const routeHtml = `${renderCoordLinkHtml(
          item.originCoord || item.origin || "?",
          item.originVillageId,
        )} → ${renderCoordLinkHtml(item.targetCoord || item.target || "?", item.targetVillageId)}`;
        const etaDisplay = buildEtaDisplayData(
          item.arrivalText,
          item.arrivalMs,
        );
        const timer = item.timerText || "n/a";
        const guessed = item.guessedUnit
          ? ` · юнит расчёта: ${getUnitLabel(item.guessedUnit)}`
          : "";
        const tribeSquadText =
          cleanText(item && (item.squadSummaryText || item.squadText)) || null;
        const tribeOperationTypeLabel = getTribeOperationTypeLabel(item);
        const tribeSquadUnitsHtml = isTribeReadOnlyEntry
          ? renderSquadUnitsChips(item && item.squadUnits)
          : "";
        const send = item.guessedSendEpochMs
          ? ` · отправка: ${formatDateTime(item.guessedSendEpochMs)}`
          : "";
        const isLargeThreat = getIncomingThreatType(item) === "attack_large";
        const baseCardUnits = Number(defenseInfo && defenseInfo.baseCardUnits);
        const commandCardUnits = Number(
          defenseInfo && defenseInfo.commandCardUnits,
        );
        const defenseCardUnitsText =
          !isHubIncoming &&
          !isMassIncoming &&
          isLargeThreat &&
          (Number.isFinite(baseCardUnits) || Number.isFinite(commandCardUnits))
            ? ` · в деревне: ${formatIntRu(baseCardUnits || 0)} + в пути(приказы): ${formatIntRu(
                commandCardUnits || 0,
              )} = ${formatIntRu((baseCardUnits || 0) + (commandCardUnits || 0))} (${DEFENSE_CARD_UNITS_HINT})`
            : "";
        const hubMatchedUnitsEq = Math.max(
          0,
          Number(item && item.hubMatchedUnitsEq) || 0,
        );
        const hubThresholdUnitsEq = Math.max(
          0,
          Number(item && item.hubThresholdUnitsEq) || 0,
        );
        const hubCoveragePercent = Number(item && item.hubCoveragePercent);
        const hubPlannedUnitsEq = Math.max(
          0,
          Number(item && item.hubPlannedUnitsEq) || 0,
        );
        const hubPlannedCoveragePercent = Number(
          item && item.hubPlannedCoveragePercent,
        );
        const hubCoverageText = isHubIncoming
          ? `${hubMatchedUnitsEq}/${hubThresholdUnitsEq || "?"}${
              hubThresholdUnitsEq > 0
                ? ` (${formatHubCoveragePercent(hubCoveragePercent)}%)`
                : ""
            }`
          : null;
        const hubPlannedCoverageText = isHubIncoming
          ? `${hubPlannedUnitsEq}/${hubThresholdUnitsEq || "?"}${
              hubThresholdUnitsEq > 0
                ? ` (${formatHubCoveragePercent(hubPlannedCoveragePercent)}%)`
                : ""
            }`
          : null;
        const hubTimingText =
          isHubIncoming && cleanText(item.timingLabel)
            ? ` · окно: ${cleanText(item.timingLabel)}`
            : "";
        const probableSpam = isProbableSpamIncoming(item);
        const massProgressText = isMassIncoming
          ? cleanText(item.massProgressText)
          : null;
        const massPlannedFullOffText = isMassIncoming
          ? cleanText(item.massPlannedFullOffText)
          : null;
        const massPlannedNoblesText = isMassIncoming
          ? cleanText(item.massPlannedNoblesText)
          : null;
        const massTimingText =
          isMassIncoming &&
          cleanText(item.timingLabel) &&
          cleanText(item.timingLabel) !== "—"
            ? ` · последний офф: ${cleanText(item.timingLabel)}`
            : "";
        const fallbackMainTypeLabel =
          rawTypeKey && rawTypeKey !== "noble"
            ? rawTypeKey
            : cleanText(item && item.displayType);
        const typeLabel = isTribeAllyPlanned
          ? "запланировано"
          : isTribeAllyCommand
            ? "сопл. приказ"
            : isMassIncoming
              ? "mass"
              : isHubIncoming
                ? "hub"
                : sizeTypeKey || fallbackMainTypeLabel || null;
        const nobleIconHtml =
          item.hasNoble && item.nobleIcon
            ? `<img class="smm-unit-icon" src="${escapeHtml(item.nobleIcon)}" alt="snob">`
            : "";
        const typeBadges = [];
        if (typeLabel) {
          typeBadges.push(
            `<span class="smm-type smm-type-main">${escapeHtml(typeLabel)}</span>`,
          );
        }
        if (!isHubIncoming && !isMassIncoming && item.hasNoble) {
          typeBadges.push(
            `<span class="smm-type smm-type-noble">${nobleIconHtml}noble</span>`,
          );
        }
        const typeBadgesHtml =
          typeBadges.join("") ||
          `<span class="smm-type smm-type-main">${escapeHtml("unknown")}</span>`;
        const units = Array.isArray(item.detectedUnits)
          ? Array.from(new Set(item.detectedUnits.filter(Boolean)))
          : item.guessedUnit
            ? [item.guessedUnit]
            : [];
        const unitsHtml = units
          .map((unit) => {
            const iconSrc =
              (item.unitIconsByKey && item.unitIconsByKey[unit]) ||
              (unit === "snob" ? item.nobleIcon : null) ||
              getUnitIconFallback(unit);
            const iconHtml = iconSrc
              ? `<img class="smm-unit-icon" src="${escapeHtml(iconSrc)}" alt="${escapeHtml(unit)}">`
              : "";
            return `<span class="smm-unit-chip">${iconHtml}${escapeHtml(getUnitLabel(unit))}</span>`;
          })
          .join("");
        const hubChipHtml = isHubIncoming
          ? `${hubCoverageText ? `<span class="smm-unit-chip smm-hub-chip">приказы ${escapeHtml(hubCoverageText)}</span>` : ""}${
              hubPlannedCoverageText
                ? `<span class="smm-unit-chip smm-hub-chip smm-hub-chip-plan">запланировано ${escapeHtml(
                    hubPlannedCoverageText,
                  )}</span>`
                : ""
            }`
          : "";
        const massChipHtml = isMassIncoming
          ? `${
              massProgressText
                ? `<span class="smm-unit-chip smm-mass-chip">${escapeHtml(massProgressText)}</span>`
                : ""
            }${
              massPlannedFullOffText
                ? `<span class="smm-unit-chip smm-mass-chip-plan">запланировано фуллоффов ${escapeHtml(
                    massPlannedFullOffText,
                  )}</span>`
                : ""
            }${
              massPlannedNoblesText
                ? `<span class="smm-unit-chip smm-mass-chip-plan">запланировано дворян ${escapeHtml(
                    massPlannedNoblesText,
                  )}</span>`
                : ""
            }`
          : "";
        const probableSpamChipHtml = probableSpam
          ? `<span class="smm-unit-chip smm-probable-spam-chip">вер.Спам</span>`
          : "";
        const selectedAction = getPlanAction(item.id);
        const sourceTabAttr =
          state.activeTab === "favorites"
            ? ' data-source-tab="favorites"'
            : "";
        const showFavoriteActionButton = !Boolean(
          item && item.isFavoriteEntry,
        );
        let actionsHtml = "";
        if (isTribeReadOnlyEntry) {
          actionsHtml = "";
        } else if (isMassIncoming) {
          const activeClass = selectedAction === "intercept" ? " active" : "";
          actionsHtml = `<button type="button" class="smm-plan-btn${activeClass}" data-action="intercept" data-incoming-id="${escapeHtml(
            item.id,
          )}"${sourceTabAttr}>Атаковать</button>`;
        } else if (isHubIncoming) {
          const hubAction = normalizePlanAction(
            cleanText(item.actionKey) || "slice",
          );
          const activeClass = selectedAction
            ? selectedAction === hubAction
              ? " active"
              : ""
            : " active";
          const hubActionLabel =
            PLAN_ACTION_LABELS[hubAction] || getPlanActionLabelByKey(hubAction);
          actionsHtml = `<button type="button" class="smm-plan-btn${activeClass}" data-action="${escapeHtml(
            hubAction,
          )}" data-incoming-id="${escapeHtml(
            item.id,
          )}"${sourceTabAttr}>${escapeHtml(hubActionLabel)}</button>`;
        } else {
          actionsHtml =
            PLAN_ACTIONS.map((action) => {
              const activeClass = selectedAction === action ? " active" : "";
              const label = PLAN_ACTION_LABELS[action] || action;
              return `<button type="button" class="smm-plan-btn${activeClass}" data-action="${escapeHtml(
                action,
              )}" data-incoming-id="${escapeHtml(item.id)}"${sourceTabAttr}>${escapeHtml(label)}</button>`;
            }).join("") +
            `<button type="button" class="smm-plan-btn smm-open-hub-btn" data-incoming-id="${escapeHtml(
              item.id,
            )}">В хаб</button>` +
            (showFavoriteActionButton
              ? `<button type="button" class="smm-plan-btn smm-favorite-btn" data-incoming-id="${escapeHtml(
                  item.id,
                )}"${sourceTabAttr}>В избранное</button>`
              : "");
        }
        const canPlan = Boolean(actionsHtml);
        const isOpen =
          String(state.openIncomingId || "") === String(item.id || "");
        const panelHtml = canPlan && isOpen ? renderPlanPanel(item) : "";
        if (canPlan && isOpen) hasOpenPanel = true;
        const hideKey = buildIncomingHideKey(item);
        const canHideIncoming =
          allowIncomingHide &&
          Boolean(hideKey) &&
          !isTribeReadOnlyEntry &&
          !Boolean(item && item.isFavoriteEntry);
        const hideButtonHtml = canHideIncoming
          ? `<button type="button" class="smm-plan-btn smm-hide-incoming-btn" data-hide-key="${escapeHtml(
              hideKey,
            )}" data-incoming-id="${escapeHtml(cleanText(item && item.id) || "")}">Скрыть</button>`
          : "";
        const timeMetaText = isTribeReadOnlyEntry
          ? ` · ${cleanText(tribeOperationTypeLabel)}`
          : isHubIncoming
            ? hubTimingText
            : isMassIncoming
              ? massTimingText
              : `${defenseCardUnitsText}${guessed}${send}`;
        const tribeSquadMetaHtml = isTribeReadOnlyEntry
          ? tribeSquadUnitsHtml
            ? `<div class="smm-meta">${tribeSquadUnitsHtml}</div>`
            : tribeSquadText
              ? `<div class="smm-meta">${escapeHtml(tribeSquadText)}</div>`
              : ""
          : "";
        const favoriteComment = cleanText(item && item.favoriteComment);
        const favoriteCommentHtml = Boolean(item && item.isFavoriteEntry)
          ? `<div class="smm-meta"><strong>Комментарий:</strong> ${escapeHtml(
              favoriteComment || "—",
            )}</div>`
          : "";
        const favoriteDeleteHtml = Boolean(item && item.isFavoriteEntry)
          ? `<button type="button" class="smm-plan-btn smm-favorite-del-btn" data-favorite-id="${escapeHtml(
              cleanText(item && item.id) || "",
            )}">Удалить</button>`
          : "";
        const actionsContainerClass = isTribeReadOnlyEntry
          ? "smm-plan-actions readonly"
          : "smm-plan-actions";

        card.innerHTML = `
<div class="smm-item-head">
  <div class="smm-head-left">
    ${typeBadgesHtml}
    ${unitsHtml}${hubChipHtml}${massChipHtml}${probableSpamChipHtml}
  </div>
  <span class="smm-player">${escapeHtml(player)}</span>
</div>
<div class="smm-route">${routeHtml}</div>
<div class="smm-time"><span class="smm-eta" data-copy-time="${escapeHtml(
          etaDisplay.copy || "",
        )}" title="Клик: скопировать время">${escapeHtml(
          `ETA: ${etaDisplay.display}`,
        )}</span><span class="smm-time-meta"> · через: ${escapeHtml(timer)}${escapeHtml(timeMetaText)}</span></div>
${tribeSquadMetaHtml}
${favoriteCommentHtml}
<div class="${actionsContainerClass}">${actionsHtml}${favoriteDeleteHtml}${hideButtonHtml}</div>
${panelHtml}`;

        groupList.appendChild(card);
      });
    });

    if (hasOpenPanel) {
      initSliceRows(ui.list);
    }

    if (
      hasOpenPanel &&
      ui.list.querySelector(".smm-plan-countdown[data-departure-ms]")
    ) {
      startCountdownTicker();
    } else {
      stopCountdownTicker();
    }
    if (hasOpenPanel) {
      scheduleApplySliceScrollLimits(ui.root || ui.list || document);
    }
  };

  const setStatus = (ui, message) => {
    if (!ui) return;
    ui.status.textContent = message;
  };

  const setProgress = (
    ui,
    { active = false, done = 0, total = 1, label = null } = {},
  ) => {
    if (!ui || !ui.progress || !ui.progressBar || !ui.progressText) return;
    if (!active) {
      ui.progress.hidden = true;
      ui.progressBar.style.width = "0%";
      ui.progressText.textContent = "";
      return;
    }
    const safeTotal = Math.max(1, toInt(total) || 1);
    const safeDone = Math.max(0, Math.min(safeTotal, toInt(done) || 0));
    const percent = Math.max(
      0,
      Math.min(100, Math.round((safeDone / safeTotal) * 100)),
    );
    const statusLabel = cleanText(label) || "обновление";
    ui.progress.hidden = false;
    ui.progressBar.style.width = `${percent}%`;
    ui.progressText.textContent = `${percent}% · ${statusLabel} (${safeDone}/${safeTotal})`;
  };

  const createProgressTracker = (ui, total) => {
    let done = 0;
    const safeTotal = Math.max(1, toInt(total) || 1);
    setProgress(ui, { active: true, done, total: safeTotal, label: "старт" });
    const track = (promise, label) =>
      Promise.resolve(promise).finally(() => {
        done = Math.min(safeTotal, done + 1);
        setProgress(ui, { active: true, done, total: safeTotal, label });
      });
    const finish = () => setProgress(ui, { active: false });
    return { track, finish };
  };

  const toSettledResult = (promise) =>
    Promise.resolve(promise)
      .then((value) => ({ status: "fulfilled", value }))
      .catch((reason) => ({ status: "rejected", reason }));

  const setUpdated = (ui, dateLike) => {
    if (!ui) return;
    ui.updated.textContent = `Обновлено: ${formatDateTime(dateLike)}`;
  };
  const getInfoVillageManualTargetCoord = () => {
    const fromState = cleanText(state.infoVillageTargetCoord);
    if (fromState) return fromState;
    const root = document.querySelector("#content_value") || document.body;
    const fromPage = cleanText(extractInfoVillageTargetCoord(root));
    if (fromPage) {
      state.infoVillageTargetCoord = fromPage;
      return fromPage;
    }
    return null;
  };
  const setInfoVillageManualStatus = (node, message) => {
    if (!node) return;
    const statusNode = node.querySelector(".smm-msg-manual-status");
    if (!statusNode) return;
    statusNode.textContent = cleanText(message) || "";
  };
  const buildInfoVillageManualIncoming = ({
    targetCoord,
    targetTitle,
    etaEpochMs,
    arrivalMs,
  }) => {
    const safeTargetCoord = cleanText(targetCoord);
    const safeEtaEpochMs = Number(etaEpochMs);
    if (!safeTargetCoord || !Number.isFinite(safeEtaEpochMs)) return null;
    const safeArrivalMs = Math.max(0, toInt(arrivalMs) || 0);
    const timerSeconds = Math.max(
      0,
      Math.round((safeEtaEpochMs - getServerNowMs()) / 1000),
    );
    const incomingId = `iv_manual_${hashString(`${safeTargetCoord}|${safeEtaEpochMs}|${safeArrivalMs}`)}`;
    return {
      id: incomingId,
      commandType: "support",
      displayType: "support",
      commandLabel: `manual ${safeTargetCoord}`,
      kindText: null,
      target: cleanText(targetTitle) || safeTargetCoord,
      targetCoord: safeTargetCoord,
      targetVillageId:
        cleanText(
          getUrlParam(location.href, "i") ||
            getUrlParam(location.href, "id") ||
            getUrlParam(location.href, "village"),
        ) || null,
      origin: "manual",
      originCoord: null,
      originVillageId: null,
      player:
        cleanText(safe(() => window.game_data.player.name, null)) || "manual",
      playerId: cleanText(safe(() => window.game_data.player.id, null)) || null,
      distance: null,
      arrivalText: formatArrivalTextFromEpochMs(safeEtaEpochMs),
      arrivalMs: safeArrivalMs,
      arrivalEpochMs: safeEtaEpochMs,
      etaEpochMs: safeEtaEpochMs,
      arrivalEpochSource: "info_village_manual",
      timerText: formatCountdown(timerSeconds),
      timerSeconds,
      guessedUnit: null,
      guessedUnitIcon: null,
      detectedUnits: [],
      unitIconsByKey: {},
    };
  };
  const ensureInfoVillageManualInline = () => {
    const existing = document.querySelector(
      ".smm-msg-manual-inline[data-smm-manual='info_village']",
    );
    if (existing) return existing;

    const targetCoord = getInfoVillageManualTargetCoord() || "?";
    const root = document.querySelector("#content_value") || document.body;
    const targetTitle =
      cleanText(
        safe(
          () =>
            root.querySelector(
              "h2, h3, .box-item h2, .box-item h3, .village-name, #content_value h2, #content_value h3",
            ).textContent,
          null,
        ),
      ) || targetCoord;
    const manual = document.createElement("div");
    manual.className = "smm-msg-manual-inline";
    manual.setAttribute("data-smm-manual", "info_village");
    manual.setAttribute("data-target-coord", targetCoord);
    manual.setAttribute("data-target-title", targetTitle);
    manual.innerHTML = `<span class="smm-msg-inline-hint">${escapeHtml(`? → ${targetCoord}`)}</span><span class="smm-msg-manual-label">Время прибытия:</span><input type="text" class="smm-msg-manual-datetime" placeholder="22.03. в 00:32:46:977 / сегодня 00:32:46:977 / 00:32:46:977" value=""><button type="button" class="smm-msg-manual-btn" data-action="slice">Срез</button><button type="button" class="smm-msg-manual-btn" data-action="intercept">Перехват/атака</button><button type="button" class="smm-msg-manual-btn smm-msg-hub-btn">В хаб</button><button type="button" class="smm-msg-manual-btn smm-msg-favorite-btn">В избранное</button><span class="smm-msg-manual-status">Введи время и выбери действие.</span>`;

    const host =
      document.querySelector("#commands_outgoings") ||
      document.querySelector(
        ".commands-container[data-type='towards_village']",
      ) ||
      root;
    if (!host) return null;
    host.appendChild(manual);
    return manual;
  };
  const clearMessageInlineActionButtons = () => {
    document
      .querySelectorAll(
        ".smm-msg-inline-actions, .smm-msg-inline-panel, #smm-msg-inline-fallback, .smm-msg-manual-inline",
      )
      .forEach((node) => node.remove());
  };
  const renderMessageInlineActionButtons = (anchors) => {
    ensureStyles();
    clearMessageInlineActionButtons();
    if (!isMessagePlanningScreen()) return;
    const rawEntries = Array.isArray(anchors) ? anchors : [];
    const infoVillageMode = isInfoVillagePlanningScreen();
    const infoVillageCommandRows = infoVillageMode
      ? Array.from(
          document.querySelectorAll(
            "#commands_outgoings table tr, .commands-container[data-type='towards_village'] table tr",
          ),
        ).filter((row) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length < 2) return false;
          const arrivalText =
            cleanText(safe(() => cells[1].textContent, null)) || "";
          return /\b\d{1,2}:\d{2}:\d{2}\b/.test(arrivalText);
        })
      : [];
    let entries = rawEntries.filter((entry) => {
      if (!infoVillageMode) return true;
      const host =
        entry &&
        entry.hostElement &&
        entry.hostElement.nodeType === Node.ELEMENT_NODE
          ? entry.hostElement
          : null;
      if (!host) return false;
      if (cleanText(entry && entry.sourceKind) === "info_village_note") {
        return Boolean(host.closest && host.closest(".village-note-body"));
      }
      const container = host.closest
        ? host.closest(
            "#commands_outgoings, .commands-container[data-type='towards_village']",
          )
        : null;
      if (!container) return false;
      const row = host.closest ? host.closest("tr") : null;
      if (!row) return false;
      const hostCell = host.closest("td");
      if (!hostCell || hostCell.closest("tr") !== row) return false;
      const rowCells = Array.from(row.querySelectorAll("td"));
      if (rowCells.length < 2) return false;
      const hostCellIndex = rowCells.indexOf(hostCell);
      if (hostCellIndex !== 1) return false;
      return true;
    });
    if (infoVillageMode && !entries.length) {
      const rows = infoVillageCommandRows;
      const items = getIncomingItems()
        .filter((item) =>
          /info_village/i.test(
            cleanText(item && item.arrivalEpochSource) || "",
          ),
        )
        .slice()
        .sort((a, b) => {
          const av = Number(a && a.arrivalEpochMs);
          const bv = Number(b && b.arrivalEpochMs);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return String((a && a.id) || "").localeCompare(
            String((b && b.id) || ""),
          );
        });
      entries = rows
        .map((row, index) => {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length < 2) return null;
          const item = items[index] || null;
          const incomingId = cleanText(item && item.id);
          if (!incomingId) return null;
          return {
            incomingId,
            hostElement: cells[1],
            sourceNode: null,
            lineOffsetStart: null,
            lineOffsetEnd: null,
            timeToken: cleanText(item && item.arrivalText) || null,
            originCoord: cleanText(item && item.originCoord) || null,
            targetCoord: cleanText(item && item.targetCoord) || null,
            player: cleanText(item && item.player) || null,
            line: cleanText(item && item.commandLabel) || null,
          };
        })
        .filter(Boolean);
    }
    if (!entries.length) {
      if (infoVillageMode && !infoVillageCommandRows.length) {
        ensureInfoVillageManualInline();
      }
      return;
    }
    const unresolved = [];
    const createInlineActionsNode = (entry, incomingId) => {
      const incoming = getIncomingById(incomingId);
      const incomingSigil = selectPreferredPositiveSigilPercent(
        getIncomingSigilPercent(incoming),
        getForumThreadFirstPostSigilPercent(document),
      );
      const actions = document.createElement("span");
      actions.className = "smm-msg-inline-actions";
      if (Number.isFinite(incomingSigil)) {
        actions.setAttribute("data-sigil-percent", String(incomingSigil));
      }
      const hint = [
        entry.originCoord || "?",
        "→",
        entry.targetCoord || "?",
      ].join(" ");
      actions.innerHTML = `<span class="smm-msg-inline-hint">${escapeHtml(
        hint,
      )}</span><button type="button" class="smm-msg-plan-btn" data-action="slice" data-incoming-id="${escapeHtml(
        incomingId,
      )}">Срез</button><button type="button" class="smm-msg-plan-btn" data-action="intercept" data-incoming-id="${escapeHtml(
        incomingId,
      )}">Перехват/атака</button><button type="button" class="smm-msg-plan-btn smm-msg-hub-btn" data-incoming-id="${escapeHtml(
        incomingId,
      )}">В хаб</button><button type="button" class="smm-msg-plan-btn smm-msg-favorite-btn" data-incoming-id="${escapeHtml(
        incomingId,
      )}" data-sigil-percent="${escapeHtml(
        Number.isFinite(incomingSigil) ? String(incomingSigil) : "",
      )}">В избранное</button>`;
      return actions;
    };

    const bySourceNode = new Map();
    entries.forEach((entry) => {
      const sourceNode =
        entry &&
        entry.sourceNode &&
        entry.sourceNode.isConnected &&
        entry.sourceNode.nodeType === Node.TEXT_NODE
          ? entry.sourceNode
          : null;
      if (!sourceNode) return;
      if (!bySourceNode.has(sourceNode)) bySourceNode.set(sourceNode, []);
      bySourceNode.get(sourceNode).push(entry);
    });

    const insertedEntries = new Set();
    bySourceNode.forEach((nodeEntries, sourceNode) => {
      const sorted = (Array.isArray(nodeEntries) ? nodeEntries : [])
        .slice()
        .sort((a, b) => {
          const av = Number(a && a.lineOffsetStart);
          const bv = Number(b && b.lineOffsetStart);
          if (Number.isFinite(av) && Number.isFinite(bv) && av !== bv)
            return av - bv;
          return 0;
        });
      let tailNode = sourceNode;
      let consumed = 0;
      sorted.forEach((entry) => {
        const incomingId = cleanText(entry && entry.incomingId);
        const start = Number(entry && entry.lineOffsetStart);
        const end = Number(entry && entry.lineOffsetEnd);
        if (!incomingId) return;
        if (
          !tailNode ||
          !tailNode.parentNode ||
          tailNode.nodeType !== Node.TEXT_NODE
        ) {
          unresolved.push(entry);
          return;
        }
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
          unresolved.push(entry);
          return;
        }
        const relativeStart = start - consumed;
        const relativeEnd = end - consumed;
        const textLength = String(tailNode.nodeValue || "").length;
        if (
          !Number.isFinite(relativeStart) ||
          !Number.isFinite(relativeEnd) ||
          relativeStart < 0 ||
          relativeEnd < relativeStart ||
          relativeEnd > textLength
        ) {
          unresolved.push(entry);
          return;
        }
        try {
          const afterLineNode = tailNode.splitText(relativeEnd);
          const lineNode = tailNode.splitText(relativeStart);
          const actions = createInlineActionsNode(entry, incomingId);
          afterLineNode.parentNode.insertBefore(actions, afterLineNode);
          insertedEntries.add(entry);
          tailNode = afterLineNode;
          consumed = end;
        } catch (error) {
          unresolved.push(entry);
        }
      });
    });

    entries.forEach((entry) => {
      if (insertedEntries.has(entry)) return;
      const host =
        entry && entry.hostElement && entry.hostElement.isConnected
          ? entry.hostElement
          : null;
      const incomingId = cleanText(entry && entry.incomingId);
      if (!incomingId) return;
      let inserted = false;
      if (host) {
        const actions = createInlineActionsNode(entry, incomingId);
        host.appendChild(actions);
        inserted = true;
      }
      if (!inserted) {
        unresolved.push(entry);
      }
    });

    if (!unresolved.length || infoVillageMode) return;
    const root = document.querySelector("#content_value") || document.body;
    if (!root) return;
    const fallback = document.createElement("div");
    fallback.id = "smm-msg-inline-fallback";
    const rows = unresolved
      .map((entry) => {
        const incomingId = cleanText(entry && entry.incomingId);
        if (!incomingId) return "";
        const incoming = getIncomingById(incomingId);
        const incomingSigil = selectPreferredPositiveSigilPercent(
          getIncomingSigilPercent(incoming),
          getForumThreadFirstPostSigilPercent(document),
        );
        const label = `${entry.originCoord || "?"} → ${entry.targetCoord || "?"} · ${
          entry.timeToken || "ETA"
        }`;
        return `<div class="smm-msg-inline-row"><span class="smm-msg-inline-label">${escapeHtml(
          label,
        )}</span><button type="button" class="smm-msg-plan-btn" data-action="slice" data-incoming-id="${escapeHtml(
          incomingId,
        )}">Срез</button><button type="button" class="smm-msg-plan-btn" data-action="intercept" data-incoming-id="${escapeHtml(
          incomingId,
        )}">Перехват/атака</button><button type="button" class="smm-msg-plan-btn smm-msg-hub-btn" data-incoming-id="${escapeHtml(
          incomingId,
        )}">В хаб</button><button type="button" class="smm-msg-plan-btn smm-msg-favorite-btn" data-incoming-id="${escapeHtml(
          incomingId,
        )}" data-sigil-percent="${escapeHtml(
          Number.isFinite(incomingSigil) ? String(incomingSigil) : "",
        )}">В избранное</button></div>`;
      })
      .filter(Boolean)
      .join("");
    fallback.innerHTML = rows;
    if (rows) {
      root.insertBefore(fallback, root.firstChild);
    }
  };
  const bootstrapMessageInlinePlanning = () => {
    if (!isMessagePlanningScreen()) {
      state.messageMode = false;
      clearMessageInlineActionButtons();
      return;
    }
    ensureMessageStorageLoaded();
    restoreDetectedSigilPercentFromSnapshot();
    state.messageMode = true;
    const payload = parseMessagePlanningPayload(document);
    const fallbackSpeedModel =
      state.speedModel ||
      buildSpeedModel({
        worldSpeed: null,
        unitSpeed: null,
        unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
        source: "message_inline_fallback",
        warning: null,
      });
    state.speedModel = fallbackSpeedModel;
    if (
      payload &&
      payload.dump &&
      Array.isArray(payload.dump.items) &&
      payload.dump.items.length
    ) {
      state.incomings = enrichIncomingsWithSpeed(
        payload.dump,
        fallbackSpeedModel,
      );
    } else {
      state.incomings = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: location.href,
        count: 0,
        items: [],
      };
    }
    if (isInfoVillagePlanningScreen()) {
      const infoVillageTargetCoord =
        cleanText(payload && payload.dump && payload.dump.targetCoord) ||
        cleanText(
          extractInfoVillageTargetCoord(
            document.querySelector("#content_value") || document.body,
          ),
        ) ||
        null;
      state.infoVillageTargetCoord = infoVillageTargetCoord;
    } else {
      state.infoVillageTargetCoord = null;
    }
    const authoritativeMessageSigilPercent =
      getCurrentPageAuthoritativeSigilPercent();
    const messageSigilPercent =
      selectPreferredPositiveSigilPercent(
        authoritativeMessageSigilPercent,
        getForumThreadFirstPostSigilPercent(document),
        detectActiveSigilPercent(),
      ) || 0;
    if (
      Number.isFinite(authoritativeMessageSigilPercent) ||
      messageSigilPercent > 0
    ) {
      state.detectedSigilPercent = messageSigilPercent;
    }
    if (isForumThreadPlanningScreen()) {
      void loadForumThreadFirstPostSigilPercent().then((threadSigilPercent) => {
        if (!Number.isFinite(threadSigilPercent) || threadSigilPercent <= 0) return;
        if (!isForumThreadPlanningScreen()) return;
        if (
          state.incomings &&
          Array.isArray(state.incomings.items) &&
          state.incomings.items.length
        ) {
          state.incomings.items = state.incomings.items.map((item) => {
            if (!item || typeof item !== "object") return item;
            const existingSigil = getIncomingSigilPercent(item);
            if (Number.isFinite(existingSigil) && existingSigil > 0) return item;
            const source = cleanText(item.arrivalEpochSource || item.source || item.id);
            if (!/(?:message|forum|msg_)/i.test(source)) return item;
            return {
              ...item,
              sigilPercent: normalizeSigilPercent(threadSigilPercent),
            };
          });
        }
        runForumAutoFavoriteImport({
          payload: parseMessagePlanningPayload(document),
          phase: "thread_sigil_loaded",
          notifyOnAdd: true,
        });
        rerenderAllMessageInlinePanels("Сигил темы загружен из первого сообщения.");
      });
    }
    renderMessageInlineActionButtons(
      payload && Array.isArray(payload.anchors) ? payload.anchors : [],
    );
    runForumAutoFavoriteImport({
      payload,
      phase: "bootstrap",
      notifyOnAdd: true,
    });
    scheduleForumAutoFavoriteImportRetries();

    const ensureInlineButtons = () => {
      if (!isMessagePlanningScreen()) return;
      const hasButtons = Boolean(
        document.querySelector(
          ".smm-msg-inline-actions, #smm-msg-inline-fallback, .smm-msg-manual-inline",
        ),
      );
      if (hasButtons) return;
      const retryPayload = parseMessagePlanningPayload(document);
      if (
        retryPayload &&
        retryPayload.dump &&
        Array.isArray(retryPayload.dump.items) &&
        retryPayload.dump.items.length
      ) {
        state.incomings = enrichIncomingsWithSpeed(
          retryPayload.dump,
          fallbackSpeedModel,
        );
      }
      renderMessageInlineActionButtons(
        retryPayload && Array.isArray(retryPayload.anchors)
          ? retryPayload.anchors
          : [],
      );
    };

    [220, 650, 1300, 2200].forEach((delayMs) => {
      setTimeout(ensureInlineButtons, delayMs);
    });
    if (
      isInfoVillagePlanningScreen() &&
      typeof MutationObserver !== "undefined"
    ) {
      const observeRoot =
        document.querySelector("#commands_outgoings") ||
        document.querySelector("#content_value") ||
        document.body;
      if (observeRoot) {
        let observerRetryTimerId = null;
        const runObservedInlineEnsure = () => {
          observerRetryTimerId = null;
          const hasButtons = Boolean(
            document.querySelector(
              ".smm-msg-inline-actions, #smm-msg-inline-fallback, .smm-msg-manual-inline",
            ),
          );
          if (hasButtons) {
            observer.disconnect();
            return;
          }
          ensureInlineButtons();
          if (
            document.querySelector(
              ".smm-msg-inline-actions, #smm-msg-inline-fallback, .smm-msg-manual-inline",
            )
          ) {
            observer.disconnect();
          }
        };
        const observer = new MutationObserver(() => {
          if (observerRetryTimerId) return;
          observerRetryTimerId = setTimeout(runObservedInlineEnsure, 80);
        });
        observer.observe(observeRoot, { childList: true, subtree: true });
        setTimeout(() => {
          if (observerRetryTimerId) {
            clearTimeout(observerRetryTimerId);
            observerRetryTimerId = null;
          }
          observer.disconnect();
        }, 12000);
      }
    }
  };
  const ensureMessageStorageLoaded = () => {
    if (state.messageStorageLoaded) return;
    loadUiSettings();
    initVillageGroupState();
    state.planActions = loadPlanActions();
    loadCalcDisabledUnits();
    loadHiddenVillageGroups();
    loadArchivedManeuvers();
    loadScheduledCommands();
    if (!Array.isArray(state.hubEntries)) {
      state.hubEntries = [];
    }
    restoreDetectedSigilPercentFromSnapshot();
    state.messageStorageLoaded = true;
  };
  const buildTroopsModelFromOverviewUnitsDump = (dump, warning = null) => ({
    version: 1,
    fetchedAt:
      cleanText(dump && dump.fetchedAt) ||
      new Date(getServerNowMs()).toISOString(),
    sourceUrl: cleanText(dump && dump.sourceUrl) || null,
    count: Math.max(
      0,
      toInt(
        dump &&
          (dump.villagesCount ||
            (Array.isArray(dump && dump.villages) ? dump.villages.length : 0)),
      ) || 0,
    ),
    units: Array.isArray(dump && dump.units) ? dump.units : [],
    villages: Array.isArray(dump && dump.villages) ? dump.villages : [],
    warning: cleanText(warning),
  });
  const reloadTroopsForSelectedVillageGroup = async () => {
    const selectedGroupId = getSelectedVillageGroupId();
    const selectedGroupLabel = getSelectedVillageGroupLabel();
    const [overviewUnitsDump, overviewUnitsDefenseDump] = await Promise.all([
      fetchOverviewUnitsDump("own_home", selectedGroupId),
      fetchOverviewUnitsDump("all", selectedGroupId),
    ]);

    state.overviewUnitsDump = overviewUnitsDump;
    state.troops = buildTroopsModelFromOverviewUnitsDump(
      overviewUnitsDump,
      null,
    );
    saveJson(STORAGE_KEYS.overviewUnits, overviewUnitsDump);
    saveJson(STORAGE_KEYS.troops, state.troops);

    state.overviewUnitsDefenseDump = overviewUnitsDefenseDump;
    state.troopsDefense = buildTroopsModelFromOverviewUnitsDump(
      overviewUnitsDefenseDump,
      null,
    );
    saveJson(STORAGE_KEYS.overviewUnitsDefense, overviewUnitsDefenseDump);
    saveJson(STORAGE_KEYS.troopsDefense, state.troopsDefense);

    state.snapshot = buildSnapshot({
      speedModel: state.speedModel,
      incomings: state.incomings,
      troops: state.troops,
      overviewCommands: state.overviewCommandsDump,
      detectedSigilPercent: state.detectedSigilPercent,
      sigilSource:
        cleanText(state.snapshot && state.snapshot.sigilSource) ||
        "group_select",
      errors: Array.isArray(state.errors) ? state.errors.slice() : [],
    });
    saveJson(STORAGE_KEYS.snapshot, state.snapshot);

    return {
      groupId: selectedGroupId,
      groupLabel: selectedGroupLabel,
      villagesCount:
        state.troops && Number.isFinite(state.troops.count)
          ? state.troops.count
          : 0,
    };
  };
  const ensureMessageRuntimeDataLoaded = async ({ cacheOnly = false } = {}) => {
    ensureMessageStorageLoaded();
    const speedBefore = state.speedModel;
    if (isUntrustedSpeedModelForPlanning(speedBefore)) {
      try {
        state.speedModel = await loadSpeedModel();
      } catch (error) {
        state.speedModel = buildSpeedModel({
          worldSpeed: null,
          unitSpeed: null,
          unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
          source: "message_runtime_fallback",
          warning: "Speed model failed, fallback used",
          error: cleanText(error && error.message),
        });
      }
      if (DEBUG_VERBOSE_LOGS) {
        console.info(`${LOG_PREFIX} [message-runtime][speed-refresh]`, {
          version: VERSION,
          beforeSource: cleanText(speedBefore && speedBefore.source) || null,
          afterSource: cleanText(state.speedModel && state.speedModel.source) || null,
          worldSpeed: toNumber(state.speedModel && state.speedModel.worldSpeed),
          unitSpeed: toNumber(state.speedModel && state.speedModel.unitSpeed),
        });
      }
    }
    if (
      state.incomings &&
      Array.isArray(state.incomings.items) &&
      state.incomings.items.length
    ) {
      state.incomings = enrichIncomingsWithSpeed(
        state.incomings,
        state.speedModel,
      );
    }

    const hasTroops =
      state.troops &&
      Array.isArray(state.troops.villages) &&
      state.troops.villages.length > 0 &&
      isPayloadFreshByFetchedAt(state.troops, TROOPS_CACHE_TTL_MS);
    if (!hasTroops) {
      const cachedOverviewUnitsRaw = readJson(STORAGE_KEYS.overviewUnits);
      const cachedOverviewUnits = isPayloadFreshByFetchedAt(
        cachedOverviewUnitsRaw,
        TROOPS_CACHE_TTL_MS,
      )
        ? cachedOverviewUnitsRaw
        : null;
      const cachedTroopsRaw = readJson(STORAGE_KEYS.troops);
      const cachedTroops = isPayloadFreshByFetchedAt(
        cachedTroopsRaw,
        TROOPS_CACHE_TTL_MS,
      )
        ? cachedTroopsRaw
        : null;
      if (
        cachedOverviewUnits &&
        Array.isArray(cachedOverviewUnits.villages) &&
        cachedOverviewUnits.villages.length
      ) {
        state.overviewUnitsDump = cachedOverviewUnits;
        state.troops = buildTroopsModelFromOverviewUnitsDump(
          cachedOverviewUnits,
          "cache eager load",
        );
      } else if (
        cachedTroops &&
        Array.isArray(cachedTroops.villages) &&
        cachedTroops.villages.length
      ) {
        state.troops = cachedTroops;
      } else if (!cacheOnly) {
        try {
          const overviewUnitsDump = await fetchOverviewUnitsDump();
          state.overviewUnitsDump = overviewUnitsDump;
          state.troops = buildTroopsModelFromOverviewUnitsDump(
            overviewUnitsDump,
            null,
          );
          saveJson(STORAGE_KEYS.overviewUnits, overviewUnitsDump);
          saveJson(STORAGE_KEYS.troops, state.troops);
        } catch (error) {
          const errorText = cleanText(error && error.message) || "unknown";
          state.troops = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            count: 0,
            units: [],
            villages: [],
            warning: errorText,
          };
        }
      } else {
        state.troops = {
          version: 1,
          fetchedAt: new Date(getServerNowMs()).toISOString(),
          sourceUrl: null,
          count: 0,
          units: [],
          villages: [],
          warning: "cache_only_no_troops",
        };
      }
    }

    const hasDefenseTroops =
      state.troopsDefense &&
      Array.isArray(state.troopsDefense.villages) &&
      state.troopsDefense.villages.length > 0 &&
      isPayloadFreshByFetchedAt(state.troopsDefense, TROOPS_CACHE_TTL_MS);
    if (!hasDefenseTroops) {
      const cachedOverviewUnitsDefenseRaw = readJson(
        STORAGE_KEYS.overviewUnitsDefense,
      );
      const cachedOverviewUnitsDefense = isPayloadFreshByFetchedAt(
        cachedOverviewUnitsDefenseRaw,
        TROOPS_CACHE_TTL_MS,
      )
        ? cachedOverviewUnitsDefenseRaw
        : null;
      const cachedTroopsDefenseRaw = readJson(STORAGE_KEYS.troopsDefense);
      const cachedTroopsDefense = isPayloadFreshByFetchedAt(
        cachedTroopsDefenseRaw,
        TROOPS_CACHE_TTL_MS,
      )
        ? cachedTroopsDefenseRaw
        : null;
      if (
        cachedOverviewUnitsDefense &&
        Array.isArray(cachedOverviewUnitsDefense.villages) &&
        cachedOverviewUnitsDefense.villages.length
      ) {
        state.overviewUnitsDefenseDump = cachedOverviewUnitsDefense;
        state.troopsDefense = buildTroopsModelFromOverviewUnitsDump(
          cachedOverviewUnitsDefense,
          "cache eager load",
        );
      } else if (
        cachedTroopsDefense &&
        Array.isArray(cachedTroopsDefense.villages) &&
        cachedTroopsDefense.villages.length
      ) {
        state.troopsDefense = cachedTroopsDefense;
      } else if (!cacheOnly) {
        try {
          const overviewUnitsDefenseDump = await fetchOverviewUnitsDump("all");
          state.overviewUnitsDefenseDump = overviewUnitsDefenseDump;
          state.troopsDefense = buildTroopsModelFromOverviewUnitsDump(
            overviewUnitsDefenseDump,
            null,
          );
          saveJson(STORAGE_KEYS.overviewUnitsDefense, overviewUnitsDefenseDump);
          saveJson(STORAGE_KEYS.troopsDefense, state.troopsDefense);
        } catch (error) {
          state.troopsDefense = state.troops;
        }
      } else {
        state.troopsDefense = state.troops;
      }
    }

    return Boolean(
      state.speedModel &&
        state.speedModel.effectiveMinutesPerField &&
        state.troops &&
        Array.isArray(state.troops.villages) &&
        state.troops.villages.length,
    );
  };
  const getIncomingById = (incomingIdRaw) => {
    const incomingId = cleanText(incomingIdRaw);
    if (!incomingId) return null;
    const favoriteItems = getFavoriteIncomingItems();
    if (String(incomingId).startsWith("fav_")) {
      const favoriteMatch = favoriteItems.find(
        (item) => String(item && item.id) === String(incomingId),
      );
      if (favoriteMatch) return favoriteMatch;
    }
    const ownItems = getIncomingItems();
    const hubItems = Array.isArray(state.hubQueryIncomings)
      ? state.hubQueryIncomings
      : [];
    const massItems = Array.isArray(state.hubMassIncomings)
      ? state.hubMassIncomings
      : [];
    const tribeItems = Array.isArray(state.hubTribeIncomings)
      ? state.hubTribeIncomings
      : [];
    return (
      ownItems
        .concat(hubItems)
        .concat(massItems)
        .concat(tribeItems)
        .concat(favoriteItems)
        .find((item) => String(item && item.id) === String(incomingId)) || null
    );
  };
  const setMessageInlineButtonsActive = (actionsNode, action) => {
    if (!actionsNode) return;
    actionsNode
      .querySelectorAll(
        ".smm-msg-plan-btn[data-action], .smm-msg-manual-btn[data-action]",
      )
      .forEach((button) => {
        const buttonAction = cleanText(button.getAttribute("data-action"));
        button.classList.toggle("active", buttonAction === action);
      });
  };
  const setMessageInlinePanelStatus = (panelNode, message) => {
    if (!panelNode) return;
    let statusNode = panelNode.querySelector(".smm-msg-inline-status");
    if (!statusNode) {
      statusNode = document.createElement("div");
      statusNode.className = "smm-msg-inline-status";
      panelNode.appendChild(statusNode);
    }
    statusNode.textContent = cleanText(message) || "";
  };
  const isSpotlightInlinePanel = (panelNode) =>
    Boolean(
      panelNode &&
        panelNode.classList &&
        panelNode.classList.contains("smm-spotlight-inline-panel"),
    );
  const getMessageInlinePanelAnchorId = (actionsNode) => {
    if (!actionsNode) return null;
    const existing = cleanText(actionsNode.getAttribute("data-smm-anchor-id"));
    if (existing) return existing;
    const generated = `smm_anchor_${Math.random().toString(36).slice(2, 10)}`;
    actionsNode.setAttribute("data-smm-anchor-id", generated);
    return generated;
  };
  const positionMessageInlinePanel = (panelNode, actionsNode) => {
    if (!panelNode) return;
    if (isSpotlightInlinePanel(panelNode)) {
      panelNode.style.position = "relative";
      panelNode.style.width = "100%";
      panelNode.style.maxWidth = "100%";
      panelNode.style.left = "";
      panelNode.style.top = "";
      panelNode.style.maxHeight = "none";
      return;
    }
    if (!actionsNode || !actionsNode.isConnected) return;
    const viewportPad = 12;
    const minWidth = 980;
    const maxWidth = 1650;
    const availableWidth = Math.max(420, window.innerWidth - viewportPad * 2);
    const panelWidth = Math.max(
      Math.min(maxWidth, availableWidth),
      Math.min(minWidth, availableWidth),
    );

    panelNode.style.position = "absolute";
    panelNode.style.width = `${Math.round(panelWidth)}px`;
    panelNode.style.maxWidth = "none";
    panelNode.style.left = "0px";
    panelNode.style.top = "0px";
    panelNode.style.maxHeight = `${Math.max(260, window.innerHeight - viewportPad * 2)}px`;

    const anchorRect = actionsNode.getBoundingClientRect();
    let left = window.scrollX + anchorRect.left;
    const minLeft = window.scrollX + viewportPad;
    const maxLeft =
      window.scrollX + window.innerWidth - viewportPad - panelWidth;
    left = Math.max(minLeft, Math.min(left, maxLeft));

    let top = window.scrollY + anchorRect.bottom + 6;
    panelNode.style.left = `${Math.round(left)}px`;
    panelNode.style.top = `${Math.round(top)}px`;

    const panelRect = panelNode.getBoundingClientRect();
    const viewportBottom = window.scrollY + window.innerHeight - viewportPad;
    if (top + panelRect.height > viewportBottom) {
      const aboveTop = window.scrollY + anchorRect.top - panelRect.height - 8;
      if (aboveTop >= window.scrollY + viewportPad) {
        top = aboveTop;
      } else {
        top = Math.max(
          window.scrollY + viewportPad,
          viewportBottom - panelRect.height,
        );
      }
      panelNode.style.top = `${Math.round(top)}px`;
    }
  };
  const ensureMessageInlinePanelNode = (actionsNode) => {
    if (!actionsNode) return null;
    const anchorId = getMessageInlinePanelAnchorId(actionsNode);
    if (!anchorId) return null;
    let panelNode = document.querySelector(
      `.smm-msg-inline-panel[data-smm-anchor-id="${anchorId}"]`,
    );
    if (
      !panelNode ||
      !panelNode.classList ||
      !panelNode.classList.contains("smm-msg-inline-panel")
    ) {
      panelNode = document.createElement("div");
      panelNode.className = "smm-msg-inline-panel";
      panelNode.setAttribute("data-smm-anchor-id", anchorId);
      document.body.appendChild(panelNode);
    }
    panelNode.classList.toggle("smm-mobile", isMobileUi());
    positionMessageInlinePanel(panelNode, actionsNode);
    return panelNode;
  };
  const ensureMessageInlinePanelCloseButton = (panelNode) => {
    if (!panelNode || isSpotlightInlinePanel(panelNode)) return null;
    let closeButton = panelNode.querySelector(".smm-msg-inline-close");
    if (!closeButton) {
      closeButton = document.createElement("button");
      closeButton.type = "button";
      closeButton.className = "smm-msg-inline-close";
      closeButton.setAttribute("title", "Скрыть таблицу");
      closeButton.setAttribute("aria-label", "Скрыть таблицу");
      closeButton.textContent = "×";
      panelNode.appendChild(closeButton);
    }
    return closeButton;
  };
  const ensureMessageInlinePanelOpenPlanButton = (panelNode) => {
    if (!panelNode || isSpotlightInlinePanel(panelNode)) return null;
    let openPlanButton = panelNode.querySelector(".smm-msg-inline-open-plan");
    if (!openPlanButton) {
      openPlanButton = document.createElement("button");
      openPlanButton.type = "button";
      openPlanButton.className = "smm-msg-inline-open-plan";
      openPlanButton.setAttribute("title", "Открыть окно плана");
      openPlanButton.textContent = "В план";
      panelNode.appendChild(openPlanButton);
    }
    return openPlanButton;
  };
  const ensureMessageInlinePanelGroupSelect = (panelNode) => {
    if (!panelNode || isSpotlightInlinePanel(panelNode)) return null;
    let groupSelect = panelNode.querySelector(".smm-msg-inline-group-select");
    if (!groupSelect) {
      groupSelect = document.createElement("select");
      groupSelect.className = "smm-msg-inline-group-select";
      groupSelect.setAttribute("title", "Группа деревень");
      groupSelect.setAttribute("data-village-group-select", "1");
      panelNode.appendChild(groupSelect);
    }
    syncVillageGroupSelectNode(groupSelect);
    return groupSelect;
  };
  const enableMessageInlinePanelDrag = (panelNode) => {
    if (!panelNode || panelNode.getAttribute("data-smm-drag-bound") === "1")
      return;
    if (isSpotlightInlinePanel(panelNode)) return;
    panelNode.setAttribute("data-smm-drag-bound", "1");

    const isDragTargetAllowed = (target) => {
      if (!target || target === panelNode) return true;
      if (!(target instanceof Element)) return false;
      if (
        target.closest(
          ".smm-msg-inline-close, .smm-msg-inline-open-plan, .smm-slice-scroll, .smm-slice-table, .smm-go-btn, .smm-schedule-btn, .smm-hub-btn, .smm-unit-toggle, .smm-row-scale, .smm-slice-input, .smm-sigil-input, a, button, input, textarea, select, label",
        )
      ) {
        return false;
      }
      return target.closest(".smm-msg-inline-panel") === panelNode;
    };

    const startDrag = (clientX, clientY) => {
      const rect = panelNode.getBoundingClientRect();
      const startLeft = window.scrollX + rect.left;
      const startTop = window.scrollY + rect.top;
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;
      panelNode.classList.add("smm-dragging");

      const onMove = (moveX, moveY) => {
        const viewportPad = 8;
        const width = rect.width;
        const height = rect.height;
        const minLeft = window.scrollX + viewportPad;
        const maxLeft =
          window.scrollX + window.innerWidth - viewportPad - width;
        const minTop = window.scrollY + viewportPad;
        const maxTop =
          window.scrollY + window.innerHeight - viewportPad - height;
        let nextLeft = window.scrollX + moveX - offsetX;
        let nextTop = window.scrollY + moveY - offsetY;
        nextLeft = Math.max(
          minLeft,
          Math.min(nextLeft, Math.max(minLeft, maxLeft)),
        );
        nextTop = Math.max(minTop, Math.min(nextTop, Math.max(minTop, maxTop)));
        panelNode.style.left = `${Math.round(nextLeft)}px`;
        panelNode.style.top = `${Math.round(nextTop)}px`;
      };

      const handleMouseMove = (event) => {
        onMove(event.clientX, event.clientY);
      };
      const handleMouseUp = () => {
        panelNode.classList.remove("smm-dragging");
        document.removeEventListener("mousemove", handleMouseMove, true);
        document.removeEventListener("mouseup", handleMouseUp, true);
      };
      document.addEventListener("mousemove", handleMouseMove, true);
      document.addEventListener("mouseup", handleMouseUp, true);
      panelNode.style.left = `${Math.round(startLeft)}px`;
      panelNode.style.top = `${Math.round(startTop)}px`;
    };

    panelNode.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (!isDragTargetAllowed(event.target)) return;
      event.preventDefault();
      startDrag(event.clientX, event.clientY);
    });
  };
  const openMainPlanOverlayFromInline = (panelNode) => {
    if (!state.ui) {
      initUi();
    }
    if (!state.ui) {
      if (panelNode)
        setMessageInlinePanelStatus(
          panelNode,
          "Не удалось открыть окно плана.",
        );
      return false;
    }
    state.messageMode = false;
    setActiveTab("plan");
    renderActiveTab(state.ui);
    setStatus(state.ui, "Открыт план.");
    if (panelNode) {
      setMessageInlinePanelStatus(panelNode, "Открыт основной план.");
    }
    return true;
  };
  const renderMessageInlinePlanForButton = async (
    msgButton,
    incomingIdRaw,
    actionRaw,
  ) => {
    const actionsNode =
      msgButton && msgButton.closest
        ? msgButton.closest(
            ".smm-msg-inline-actions, .smm-msg-inline-row, .smm-msg-manual-inline",
          )
        : null;
    const incomingId = cleanText(incomingIdRaw);
    const action = cleanText(actionRaw);
    if (
      !actionsNode ||
      !incomingId ||
      !action ||
      !PLAN_ACTIONS.includes(action)
    )
      return false;

    setMessageInlineButtonsActive(actionsNode, action);
    const panelNode = ensureMessageInlinePanelNode(actionsNode);
    if (!panelNode) return false;
    panelNode.innerHTML = "";
    ensureMessageInlinePanelCloseButton(panelNode);
    ensureMessageInlinePanelOpenPlanButton(panelNode);
    ensureMessageInlinePanelGroupSelect(panelNode);
    enableMessageInlinePanelDrag(panelNode);
    setMessageInlinePanelStatus(panelNode, "Загрузка данных для расчёта...");

    if (!getIncomingById(incomingId)) {
      bootstrapMessageInlinePlanning();
      setMessageInlineButtonsActive(actionsNode, action);
    }
    await ensureVillageGroupsLoaded();
    syncVillageGroupSelectNode(ensureMessageInlinePanelGroupSelect(panelNode));
    const runtimeReady = await ensureMessageRuntimeDataLoaded();
    if (!runtimeReady) {
      setMessageInlinePanelStatus(
        panelNode,
        "Не удалось загрузить войска/скорость для расчёта.",
      );
      return false;
    }

    const incoming = getIncomingById(incomingId);
    if (!incoming) {
      setMessageInlinePanelStatus(
        panelNode,
        "Не удалось найти входящий приказ для этой строки.",
      );
      return false;
    }

    const nearestSigilPercent = detectNearestSigilPercentAboveNode(actionsNode);
    let threadSigilPercent = getForumThreadFirstPostSigilPercent(document);
    if (
      actionUsesSigil(action) &&
      !Number.isFinite(threadSigilPercent) &&
      isForumThreadPlanningScreen()
    ) {
      threadSigilPercent = await loadForumThreadFirstPostSigilPercent();
    }
    const fallbackSigilPercent = getDefaultSigilForAction("slice");
    const messageSigilPercent = selectPreferredPositiveSigilPercent(
      nearestSigilPercent,
      threadSigilPercent,
      fallbackSigilPercent,
    );
    if (Number.isFinite(messageSigilPercent) && messageSigilPercent > 0) {
      state.detectedSigilPercent = normalizeSigilPercent(messageSigilPercent);
      incoming.sigilPercent = normalizeSigilPercent(messageSigilPercent);
    }

    setPlanAction(incomingId, action);
    const actionLabel = PLAN_ACTION_LABELS[action] || action;
    panelNode.innerHTML = renderSlicePlanPanel(incoming, action, actionLabel, {
      sigilPercent:
        Number.isFinite(messageSigilPercent) && messageSigilPercent > 0
        ? messageSigilPercent
        : undefined,
      renderGroupSelectInHeader: false,
    });
    ensureMessageInlinePanelCloseButton(panelNode);
    ensureMessageInlinePanelOpenPlanButton(panelNode);
    ensureMessageInlinePanelGroupSelect(panelNode);
    enableMessageInlinePanelDrag(panelNode);
    positionMessageInlinePanel(panelNode, actionsNode);
    setMessageInlinePanelStatus(
      panelNode,
      `Выбрано: ${actionLabel}. Таблица построена.`,
    );
    initSliceRows(panelNode);
    scheduleApplySliceScrollLimits(panelNode);
    positionMessageInlinePanel(panelNode, actionsNode);
    updateCountdownNodes();
    startCountdownTicker();
    return true;
  };
  const renderSpotlightPlanPanel = async ({
    mountNode,
    incoming,
    incomings = null,
    action = "slice",
    actionLabel = null,
    sigilPercent = undefined,
    statusMessage = null,
  } = {}) => {
    if (!mountNode || !incoming || typeof incoming !== "object") {
      return { ok: false, reason: "invalid_arguments" };
    }

    const panelNode =
      mountNode.classList &&
      mountNode.classList.contains("smm-msg-inline-panel")
        ? mountNode
        : (() => {
            mountNode.innerHTML = "";
            const nextPanel = document.createElement("div");
            mountNode.appendChild(nextPanel);
            return nextPanel;
          })();
    panelNode.className = "smm-msg-inline-panel smm-spotlight-inline-panel";
    panelNode.classList.toggle("smm-mobile", isMobileUi());

    const actionKey = PLAN_ACTIONS.includes(cleanText(action))
      ? cleanText(action)
      : "slice";
    const resolvedActionLabel =
      cleanText(actionLabel) ||
      (actionKey === "slice" ? "Срез/дефф" : "Атака/двор");
    const explicitSigil = toNumber(sigilPercent);
    if (Number.isFinite(explicitSigil)) {
      panelNode.setAttribute(
        "data-smm-explicit-sigil",
        String(normalizeSigilPercent(explicitSigil)),
      );
    } else {
      panelNode.removeAttribute("data-smm-explicit-sigil");
    }
    const normalizedIncomings = (Array.isArray(incomings) ? incomings : [incoming])
      .map((item, index) =>
        normalizeExternalIncoming(item, `spotlight_${index}_${Date.now()}`),
      )
      .filter(Boolean);
    const normalizedIncoming = normalizeExternalIncoming(
      incoming,
      cleanText(incoming && incoming.id) || "spotlight_current",
    );
    if (!normalizedIncoming) {
      panelNode.innerHTML =
        '<section class="smm-plan-panel smm-slice-panel"><div class="smm-plan-empty">Не удалось подготовить приказ для расчёта.</div></section>';
      return { ok: false, reason: "incoming_invalid", panelNode };
    }

    normalizedIncomings.forEach((item) => {
      upsertIncomingItem(item);
    });
    upsertIncomingItem(normalizedIncoming);

    panelNode.setAttribute("data-smm-incoming-id", cleanText(normalizedIncoming.id));
    panelNode.setAttribute("data-smm-panel-action", actionKey);
    panelNode.setAttribute("data-smm-action-label", resolvedActionLabel);
    panelNode.innerHTML =
      '<section class="smm-plan-panel smm-slice-panel"><div class="smm-plan-empty">Загрузка данных для расчёта...</div></section>';

    ensureMessageStorageLoaded();
    ensureMessageActionListenerBound();
    await ensureVillageGroupsLoaded();
    const runtimeReady = await ensureMessageRuntimeDataLoaded();
    if (!runtimeReady) {
      panelNode.innerHTML =
        '<section class="smm-plan-panel smm-slice-panel"><div class="smm-plan-empty">Не удалось загрузить войска/скорость для расчёта.</div></section>';
      return { ok: false, reason: "runtime_unavailable", panelNode };
    }

    const liveIncoming = getIncomingById(normalizedIncoming.id) || normalizedIncoming;
    setPlanAction(liveIncoming.id, actionKey);
    panelNode.innerHTML = renderSlicePlanPanel(
      liveIncoming,
      actionKey,
      resolvedActionLabel,
      {
        sigilPercent: Number.isFinite(explicitSigil)
          ? normalizeSigilPercent(explicitSigil)
          : undefined,
        renderGroupSelectInHeader: true,
      },
    );
    initSliceRows(panelNode);
    scheduleApplySliceScrollLimits(panelNode);
    positionMessageInlinePanel(panelNode, null);
    updateCountdownNodes();
    startCountdownTicker();
    setMessageInlinePanelStatus(
      panelNode,
      cleanText(statusMessage) || `Выбрано: ${resolvedActionLabel}.`,
    );
    return { ok: true, panelNode, incomingId: liveIncoming.id };
  };
  const findMessageInlineActionsNodeByAnchorId = (anchorIdRaw) => {
    const anchorId = cleanText(anchorIdRaw);
    if (!anchorId) return null;
    return (
      Array.from(
        document.querySelectorAll(
          ".smm-msg-inline-actions[data-smm-anchor-id], .smm-msg-inline-row[data-smm-anchor-id], .smm-msg-manual-inline[data-smm-anchor-id]",
        ),
      ).find(
        (node) =>
          cleanText(node.getAttribute("data-smm-anchor-id")) === anchorId,
      ) || null
    );
  };
  const rerenderMessageInlinePanel = (panelNode, options = {}) => {
    if (!panelNode) return false;
    const spotlightPanel = isSpotlightInlinePanel(panelNode);
    const firstRow = panelNode.querySelector(".smm-slice-row");
    const incomingId =
      cleanText(options.incomingId) ||
      cleanText(panelNode.getAttribute("data-smm-incoming-id")) ||
      cleanText(firstRow && firstRow.getAttribute("data-incoming-id"));
    const action =
      cleanText(options.action) ||
      cleanText(panelNode.getAttribute("data-smm-panel-action")) ||
      cleanText(firstRow && firstRow.getAttribute("data-action")) ||
      "slice";
    const fallbackIncoming =
      options &&
      options.fallbackIncoming &&
      typeof options.fallbackIncoming === "object"
        ? options.fallbackIncoming
        : null;
    const incoming = getIncomingById(incomingId) || fallbackIncoming;
    if (!incoming) return false;
    const currentSigilInput = panelNode.querySelector(".smm-sigil-input");
    const currentSigil = toNumber(currentSigilInput && currentSigilInput.value);
    const panelSigil = toNumber(
      cleanText(panelNode.getAttribute("data-smm-explicit-sigil")),
    );
    const actionLabel =
      (spotlightPanel && cleanText(panelNode.getAttribute("data-smm-action-label"))) ||
      PLAN_ACTION_LABELS[action] ||
      action;
    const resolvedSigil = actionUsesSigil(action)
      ? selectPreferredPositiveSigilPercent(
          currentSigil,
          panelSigil,
          getIncomingSigilPercent(incoming),
          getForumThreadFirstPostSigilPercent(document),
        )
      : null;
    if (Number.isFinite(resolvedSigil)) {
      panelNode.setAttribute(
        "data-smm-explicit-sigil",
        String(normalizeSigilPercent(resolvedSigil)),
      );
    } else {
      panelNode.removeAttribute("data-smm-explicit-sigil");
    }
    panelNode.innerHTML = renderSlicePlanPanel(incoming, action, actionLabel, {
      sigilPercent: resolvedSigil,
      renderGroupSelectInHeader: spotlightPanel,
    });
    if (!spotlightPanel) {
      ensureMessageInlinePanelCloseButton(panelNode);
      ensureMessageInlinePanelOpenPlanButton(panelNode);
      ensureMessageInlinePanelGroupSelect(panelNode);
      enableMessageInlinePanelDrag(panelNode);
      const anchorId = cleanText(panelNode.getAttribute("data-smm-anchor-id"));
      const actionsNode = findMessageInlineActionsNodeByAnchorId(anchorId);
      if (actionsNode) {
        if (options.setButtonsActive !== false) {
          setMessageInlineButtonsActive(actionsNode, action);
        }
        positionMessageInlinePanel(panelNode, actionsNode);
      }
      if (actionsNode) {
        positionMessageInlinePanel(panelNode, actionsNode);
      }
    } else {
      panelNode.classList.add("smm-msg-inline-panel", "smm-spotlight-inline-panel");
      panelNode.classList.toggle("smm-mobile", isMobileUi());
      positionMessageInlinePanel(panelNode, null);
    }
    initSliceRows(panelNode);
    scheduleApplySliceScrollLimits(panelNode);
    updateCountdownNodes();
    startCountdownTicker();
    const statusText = cleanText(options.statusMessage);
    if (statusText) {
      setMessageInlinePanelStatus(panelNode, statusText);
    }
    return true;
  };
  const rerenderMessageInlinePanelAfterUnitToggle = (
    panelNode,
    unit,
    isDisabled,
  ) =>
    rerenderMessageInlinePanel(panelNode, {
      statusMessage: `${getUnitLabel(unit)}: ${isDisabled ? "выключен" : "включен"} в расчёте.`,
    });
  const rerenderOverlayAfterUnitToggle = (unit, isDisabled) => {
    if (!state.ui || state.activeTab !== "incomings") return false;
    renderActiveTab(state.ui);
    setStatus(
      state.ui,
      `${getUnitLabel(unit)}: ${isDisabled ? "выключен" : "включен"} в расчёте.`,
    );
    return true;
  };
  const rerenderAllMessageInlinePanels = (statusMessage = null) => {
    const panels = Array.from(
      document.querySelectorAll(".smm-msg-inline-panel"),
    );
    panels.forEach((panelNode) => {
      rerenderMessageInlinePanel(panelNode, {
        statusMessage: statusMessage || undefined,
      });
    });
  };
  const switchVillageGroupAndReloadTroops = async ({
    nextGroupId,
    panelNode = null,
    statusTarget = null,
  } = {}) => {
    const changed = setSelectedVillageGroupId(nextGroupId);
    syncAllVillageGroupSelects(document);
    if (!changed) {
      return {
        changed: false,
        reloaded: false,
        groupId: getSelectedVillageGroupId(),
        groupLabel: getSelectedVillageGroupLabel(),
      };
    }

    const statusPrefix = `Группа «${getSelectedVillageGroupLabel()}»`;
    if (panelNode) {
      setMessageInlinePanelStatus(
        panelNode,
        `${statusPrefix}: загружаю войска...`,
      );
    }
    if (statusTarget) {
      setStatus(statusTarget, `${statusPrefix}: загружаю войска...`);
    }

    if (state.villageGroupReloadPromise) {
      await state.villageGroupReloadPromise.catch(() => null);
    }

    const reloadPromise = reloadTroopsForSelectedVillageGroup();
    state.villageGroupReloadPromise = reloadPromise;
    try {
      const result = await reloadPromise;
      return {
        changed: true,
        reloaded: true,
        groupId: result.groupId,
        groupLabel: result.groupLabel,
        villagesCount: result.villagesCount,
      };
    } finally {
      if (state.villageGroupReloadPromise === reloadPromise) {
        state.villageGroupReloadPromise = null;
      }
    }
  };
  const handleMessageInlineRowAction = async (event) => {
    const panelNode = event.target.closest(".smm-msg-inline-panel");
    if (!panelNode) return false;
    const openPlanButton = event.target.closest(".smm-msg-inline-open-plan");
    if (openPlanButton) {
      event.preventDefault();
      openMainPlanOverlayFromInline(panelNode);
      return true;
    }
    const closeButton = event.target.closest(".smm-msg-inline-close");
    if (closeButton) {
      event.preventDefault();
      const anchorId = cleanText(panelNode.getAttribute("data-smm-anchor-id"));
      panelNode.remove();
      if (anchorId) {
        document
          .querySelectorAll(
            ".smm-msg-inline-actions[data-smm-anchor-id], .smm-msg-inline-row[data-smm-anchor-id], .smm-msg-manual-inline[data-smm-anchor-id]",
          )
          .forEach((node) => {
            if (cleanText(node.getAttribute("data-smm-anchor-id")) !== anchorId)
              return;
            setMessageInlineButtonsActive(node, null);
          });
      }
      updateCountdownNodes();
      return true;
    }

    const unitToggleButton = event.target.closest(
      ".smm-unit-toggle[data-unit-toggle][data-unit]",
    );
    if (unitToggleButton) {
      event.preventDefault();
      const unit = cleanText(unitToggleButton.getAttribute("data-unit"));
      if (!unit) return true;
      const isDisabled = toggleUnitDisabledForCalc(unit);
      rerenderMessageInlinePanelAfterUnitToggle(panelNode, unit, isDisabled);
      return true;
    }

    const scheduleButton = event.target.closest(".smm-schedule-btn");
    if (scheduleButton) {
      event.preventDefault();
      const row = scheduleButton.closest(".smm-slice-row");
      if (!row) return true;
      syncScheduledCommandsFromStorage();
      updateSliceRowState(row);
      const selection = collectSliceRowSelection(row);
      const units = selection.units || {};
      const unitKeys = Object.keys(units);
      const departureMs = Number(
        getSliceRowDisplayedDepartureMs(row, selection.departureMs),
      );
      if (!unitKeys.length || !Number.isFinite(departureMs)) {
        setMessageInlinePanelStatus(
          panelNode,
          "Нельзя запланировать: выбери юниты, которые успевают.",
        );
        return true;
      }

      const fromVillageId = cleanText(row.getAttribute("data-village-id"));
      const fromVillageCoord = cleanText(
        row.getAttribute("data-village-coord"),
      );
      const targetCoord = cleanText(row.getAttribute("data-target-coord"));
      const incomingId = cleanText(row.getAttribute("data-incoming-id"));
      const fallbackIncoming = getIncomingById(incomingId);
      const incomingEtaMs = Number(row.getAttribute("data-eta-ms"));
      const action = cleanText(row.getAttribute("data-action")) || "slice";
      const sigilPercent = actionUsesSigil(action)
        ? selectPreferredPositiveSigilPercent(
            toNumber(row.querySelector(".smm-sigil-input")?.value),
            toNumber(cleanText(row.getAttribute("data-default-sigil"))),
            getIncomingSigilPercent(fallbackIncoming),
            getForumThreadFirstPostSigilPercent(document),
          ) || 0
        : null;
      if (DEBUG_VERBOSE_LOGS) {
        console.info(`${LOG_PREFIX} [plan-schedule][click]`, {
          version: VERSION,
          source: "message_inline",
          fromVillageId,
          fromVillageCoord,
          targetCoord,
          incomingId,
          incomingEtaMs: Number.isFinite(incomingEtaMs)
            ? Math.round(incomingEtaMs)
            : null,
          action,
          departureMs: Number.isFinite(departureMs)
            ? Math.round(departureMs)
            : null,
          sigilPercent,
          units,
        });
      }
      let plannerComment = null;
      if (getUiSetting("plannerCommentEnabled")) {
        const commentResult = await askFavoriteCommentDialog({
          title: "Добавь комментарий:",
        });
        if (!commentResult || commentResult.canceled) {
          setMessageInlinePanelStatus(panelNode, "Планирование отменено.");
          return true;
        }
        plannerComment = cleanText(commentResult.comment) || null;
      }
      const timing = buildTimingPayload({
        action,
        incomingId,
        targetCoord,
        incomingEtaMs,
        units,
      });
      const goUrl = cleanText(
        row.querySelector(".smm-go-btn")?.getAttribute("data-url"),
      );
      const normalized = normalizeScheduledCommand({
        id: createScheduledCommandId(),
        createdAtMs: getServerNowMs(),
        fromVillageId,
        fromVillageCoord,
        targetVillageId:
          cleanText(fallbackIncoming && fallbackIncoming.targetVillageId) || null,
        targetCoord,
        incomingId,
        incomingEtaMs,
        action,
        actionLabel: PLAN_ACTION_LABELS[action] || action,
        timingType: timing.timingType,
        timingLabel: timing.timingLabel,
        timingGapMs: timing.timingGapMs,
        timingStartMs: timing.timingStartMs,
        timingEndMs: timing.timingEndMs,
        timingPointMs: timing.timingPointMs,
        sigilPercent,
        departureMs,
        units,
        comment: plannerComment,
        goUrl,
      });
      if (!normalized) {
        console.warn(`${LOG_PREFIX} [plan-schedule][normalize_failed]`, {
          version: VERSION,
          source: "message_inline",
          fromVillageId,
          fromVillageCoord,
          targetCoord,
          incomingId,
          action,
          departureMs,
          units,
        });
        setMessageInlinePanelStatus(
          panelNode,
          "Не удалось сохранить приказ в план.",
        );
        return true;
      }
      const duplicateAccepted = await confirmLocalScheduledDuplicate(normalized);
      if (!duplicateAccepted) {
        setMessageInlinePanelStatus(
          panelNode,
          "Планирование отменено: на эту цель и окно уже есть отправка.",
        );
        return true;
      }
      const savedCommand = upsertScheduledCommandWithStorageSync(normalized);
      if (!savedCommand) {
        setMessageInlinePanelStatus(
          panelNode,
          "Не удалось сохранить приказ в план.",
        );
        return true;
      }
      state.hubPlanLastFingerprint = buildScheduledCommandsFingerprint(
        state.scheduledCommands,
      );
      const scheduleStatusText = `Запланировано: ${savedCommand.fromVillageCoord || savedCommand.fromVillageId || "?"} → ${
        savedCommand.targetCoord || "?"
      }, юнитов ${unitKeys.length}.${plannerComment ? " Комментарий сохранён." : ""}`;
      const rerendered = safe(
        () =>
          rerenderMessageInlinePanel(panelNode, {
            incomingId,
            action,
            fallbackIncoming,
            statusMessage: scheduleStatusText,
          }),
        false,
      );
      if (!rerendered) {
        setMessageInlinePanelStatus(panelNode, scheduleStatusText);
      }
      if (state.ui) {
        renderActiveTab(state.ui);
      }
      return true;
    }

    const hubButton = event.target.closest(".smm-hub-btn");
    if (hubButton) {
      event.preventDefault();
      const row = hubButton.closest(".smm-slice-row");
      if (!row) return true;
      const selection = collectSliceRowSelection(row);
      const unitKeys = Object.keys(selection.units || {});
      if (!unitKeys.length) {
        setMessageInlinePanelStatus(
          panelNode,
          "Выбери войска, чтобы добавить строку в Хаб.",
        );
        return true;
      }
      const incomingId = cleanText(row.getAttribute("data-incoming-id"));
      const action = cleanText(row.getAttribute("data-action")) || "slice";
      const goUrl = cleanText(
        row.querySelector(".smm-go-btn")?.getAttribute("data-url"),
      );
      state.hubEntries.push({
        incomingId,
        action,
        actionLabel: PLAN_ACTION_LABELS[action] || action,
        villageCoord: cleanText(row.getAttribute("data-village-coord")) || "?",
        targetCoord: cleanText(row.getAttribute("data-target-coord")) || "?",
        units: selection.units,
        departureMs: Number.isFinite(selection.departureMs)
          ? selection.departureMs
          : null,
        goUrl: goUrl || null,
        addedAt: new Date(getServerNowMs()).toISOString(),
      });
      if (state.hubEntries.length > 500) {
        state.hubEntries.splice(0, state.hubEntries.length - 500);
      }
      if (state.ui) {
        renderActiveTab(state.ui);
      }
      setMessageInlinePanelStatus(
        panelNode,
        `Добавлено в Хаб: #${incomingId || "?"}, юнитов ${unitKeys.length}.`,
      );
      return true;
    }

    const goButton = event.target.closest(".smm-go-btn");
    if (goButton) {
      event.preventDefault();
      const row = goButton.closest(".smm-slice-row");
      const windowInfo = buildSliceTimingWindowFromRow(row);
      const debugSnapshot = buildSliceConflictDebugSnapshot(windowInfo);
      let url = cleanText(goButton.getAttribute("data-url"));
      if (!url && row) {
        url = cleanText(resolveSliceRowGoUrl(row));
        if (url) {
          goButton.setAttribute("data-url", url);
        }
      }
      if (!url) {
        setMessageInlinePanelStatus(
          panelNode,
          "Выбери войска, которые успевают, чтобы сформировать приказ.",
        );
        return true;
      }
      const shouldCheckSliceConflicts = Boolean(
        getUiSetting("checkSliceConflicts"),
      );
      const conflictSummary = shouldCheckSliceConflicts
        ? await buildAllySliceConflictSummaryByWindowAsync(windowInfo, {
            source: "go_click_message_inline",
          })
        : null;
      const fullDump = buildSliceConflictFullDebugDump(windowInfo);
      if (typeof window !== "undefined") {
        window.__smmSliceConflictDebugLast = fullDump;
      }
      logSliceConflictDebug("go_click_message_inline", {
        action: cleanText(row && row.getAttribute("data-action")) || null,
        incomingId: cleanText(row && row.getAttribute("data-incoming-id")) || null,
        targetCoord:
          cleanText(row && row.getAttribute("data-target-coord")) || null,
        hasUrl: Boolean(url),
        conflictFound: Boolean(conflictSummary),
        debug: debugSnapshot,
      });
      logSliceConflictDebug("go_click_message_inline_full", fullDump);
      if (conflictSummary) {
        const favoriteId = resolveFavoriteEntryIdByIncomingId(
          cleanText(row && row.getAttribute("data-incoming-id")),
        );
        const decision = await askSliceConflictProceedDialog({
          summary:
            conflictSummary && typeof conflictSummary === "object"
              ? { ...conflictSummary, favoriteId }
              : conflictSummary,
        });
        if (!decision || !decision.accepted) {
          if (decision && decision.favoriteId) {
            if (state.ui && state.activeTab === "favorites") {
              renderActiveTab(state.ui);
            }
            setMessageInlinePanelStatus(
              panelNode,
              decision.favoriteRemoved
                ? "Удалено из избранного. Отправка отменена."
                : "Отправка отменена: запись в избранном не найдена.",
            );
            return true;
          }
          setMessageInlinePanelStatus(
            panelNode,
            "Отправка отменена: в это окно уже идёт срез соплеменников.",
          );
          return true;
        }
      }
      const timingCenter =
        getSliceRowTimingCenterCopyValue(row) ||
        cleanText(goButton.getAttribute("data-copy-time"));
      if (timingCenter) {
        appendTimingCopyHistory({
          timingCenter,
          source: "go_click_message_inline",
          action: cleanText(row && row.getAttribute("data-action")) || null,
          incomingId:
            cleanText(row && row.getAttribute("data-incoming-id")) || null,
          fromVillageCoord:
            cleanText(row && row.getAttribute("data-village-coord")) || null,
          targetCoord:
            cleanText(row && row.getAttribute("data-target-coord")) || null,
          goUrl: url || null,
        });
      }
      const copiedSync = timingCenter
        ? copyTextToClipboardSync(timingCenter)
        : false;
      window.open(url, "_blank", "noopener");
      if (timingCenter) {
        if (copiedSync) {
          setMessageInlinePanelStatus(
            panelNode,
            `Открыта площадь. Центр тайминга скопирован: ${timingCenter}`,
          );
          return true;
        }
        copyTextToClipboard(timingCenter).then((ok) => {
          setMessageInlinePanelStatus(
            panelNode,
            ok
              ? `Открыта площадь. Центр тайминга скопирован: ${timingCenter}`
              : `Открыта площадь. Не удалось скопировать центр тайминга: ${timingCenter}`,
          );
        });
      } else {
        setMessageInlinePanelStatus(
          panelNode,
          "Открыта площадь с подставленными координатами и войсками.",
        );
      }
      return true;
    }

    return false;
  };
  const ensureMessageActionListenerBound = () => {
    const boundVersion = cleanText(
      safe(() => window[MESSAGE_ACTION_LISTENER_VERSION_KEY], null),
    );
    const existingHandler = safe(
      () => window[MESSAGE_ACTION_LISTENER_HANDLER_KEY],
      null,
    );
    if (typeof existingHandler === "function" && boundVersion !== VERSION) {
      document.removeEventListener("click", existingHandler);
      safe(() => {
        window[MESSAGE_ACTION_LISTENER_HANDLER_KEY] = null;
        return true;
      }, false);
    }
    if (
      safe(() => window[MESSAGE_ACTION_LISTENER_BOUND_KEY], false) &&
      boundVersion === VERSION &&
      typeof safe(() => window[MESSAGE_ACTION_LISTENER_HANDLER_KEY], null) ===
        "function"
    ) {
      state.messageActionListenerBound = true;
      return;
    }
    if (state.messageActionListenerBound) return;
    const clickHandler = async (event) => {
      if (await handleMessageInlineRowAction(event)) return;
      const messageHubButton = event.target.closest(".smm-msg-hub-btn");
      if (messageHubButton) {
        event.preventDefault();
        event.stopPropagation();
        const incomingId = cleanText(
          messageHubButton.getAttribute("data-incoming-id"),
        );
        if (!incomingId) {
          const manualNode = messageHubButton.closest(".smm-msg-manual-inline");
          if (manualNode) {
            setInfoVillageManualStatus(
              manualNode,
              "Сначала укажи время и выбери Срез/Перехват/атака.",
            );
          }
          return;
        }
        await sendIncomingTimingToHubQuery({
          incomingId,
          source: "message_buttons",
        });
        return;
      }
      const messageFavoriteButton = event.target.closest(
        ".smm-msg-favorite-btn",
      );
      if (messageFavoriteButton) {
        event.preventDefault();
        event.stopPropagation();
        const incomingId = cleanText(
          messageFavoriteButton.getAttribute("data-incoming-id"),
        );
        if (!incomingId) {
          const manualNode = messageFavoriteButton.closest(".smm-msg-manual-inline");
          if (manualNode) {
            setInfoVillageManualStatus(
              manualNode,
              "Сначала укажи время и выбери Срез/Перехват/атака.",
            );
          } else {
            setStatus(state.ui, "Сначала выбери атаку, затем добавляй в избранное.");
          }
          return;
        }
        const incoming = getIncomingById(incomingId);
        if (!incoming) {
          setStatus(state.ui, "Не удалось найти атаку для избранного.");
          return;
        }
        const commentResult = await askFavoriteCommentDialog({
          title: "Добавить в избранное",
        });
        if (!commentResult || commentResult.canceled) return;
        const comment = commentResult.comment;
        const sigilFromButton = toNumber(
          messageFavoriteButton.getAttribute("data-sigil-percent"),
        );
        const sigilFromActionsNode = toNumber(
          safe(
            () =>
              messageFavoriteButton
                .closest(
                  ".smm-msg-inline-actions, .smm-msg-inline-row, .smm-msg-manual-inline",
                )
                .getAttribute("data-sigil-percent"),
            null,
          ),
        );
        const sigilFromMessage = detectNearestSigilPercentAboveNode(
          messageFavoriteButton.closest(
            ".smm-msg-inline-actions, .smm-msg-inline-row, .smm-msg-manual-inline",
          ) || messageFavoriteButton,
        );
        const sigilFromIncoming = getIncomingSigilPercent(incoming);
        let sigilFromForumThread = getForumThreadFirstPostSigilPercent(document);
        if (!Number.isFinite(sigilFromForumThread) && isForumThreadPlanningScreen()) {
          sigilFromForumThread = await loadForumThreadFirstPostSigilPercent();
        }
        const resolvedSigilForFavorite = selectPreferredPositiveSigilPercent(
          sigilFromButton,
          sigilFromActionsNode,
          sigilFromMessage,
          sigilFromIncoming,
          sigilFromForumThread,
        );
        const result = addIncomingToFavorites({
          incoming,
          comment,
          sigilPercent: Number.isFinite(resolvedSigilForFavorite)
            ? resolvedSigilForFavorite
            : undefined,
        });
        if (!result || !result.ok) {
          setStatus(state.ui, "Не удалось добавить в избранное.");
          return;
        }
        const message = result.updated
          ? "Избранное обновлено."
          : "Добавлено в избранное.";
        const manualNode = messageFavoriteButton.closest(".smm-msg-manual-inline");
        if (manualNode) {
          setInfoVillageManualStatus(manualNode, message);
        } else {
          setStatus(state.ui, message);
        }
        if (state.ui && state.activeTab === "favorites") {
          renderActiveTab(state.ui);
        }
        return;
      }
      const manualButton = event.target.closest(
        ".smm-msg-manual-btn[data-action]",
      );
      if (manualButton) {
        if (!isInfoVillagePlanningScreen()) return;
        event.preventDefault();
        event.stopPropagation();
        const action = cleanText(manualButton.getAttribute("data-action"));
        if (!action || !PLAN_ACTIONS.includes(action)) return;
        const manualNode = manualButton.closest(".smm-msg-manual-inline");
        if (!manualNode) return;
        const input = manualNode.querySelector(".smm-msg-manual-datetime");
        const parsedDate = parseManualDateTimeInputPayload(
          input && input.value,
        );
        if (!parsedDate || !Number.isFinite(parsedDate.etaEpochMs)) {
          setInfoVillageManualStatus(
            manualNode,
            "Неверный формат. Пример: 22.03. в 00:32:46:977 или сегодня 00:32:46:977",
          );
          return;
        }
        const targetCoord =
          cleanText(manualNode.getAttribute("data-target-coord")) ||
          getInfoVillageManualTargetCoord();
        if (!targetCoord) {
          setInfoVillageManualStatus(
            manualNode,
            "Не удалось определить целевую деревню.",
          );
          return;
        }
        const targetTitle =
          cleanText(manualNode.getAttribute("data-target-title")) ||
          targetCoord;
        const manualIncoming = buildInfoVillageManualIncoming({
          targetCoord,
          targetTitle,
          etaEpochMs: parsedDate.etaEpochMs,
          arrivalMs: parsedDate.arrivalMs,
        });
        if (!manualIncoming) {
          setInfoVillageManualStatus(
            manualNode,
            "Не удалось собрать входящий приказ из введённого времени.",
          );
          return;
        }
        upsertIncomingItem(manualIncoming);
          manualNode
            .querySelectorAll(
            ".smm-msg-manual-btn[data-action], .smm-msg-hub-btn, .smm-msg-favorite-btn",
          )
            .forEach((button) =>
              button.setAttribute("data-incoming-id", manualIncoming.id),
            );
        const opened = await renderMessageInlinePlanForButton(
          manualButton,
          manualIncoming.id,
          action,
        );
        if (opened) {
          setInfoVillageManualStatus(
            manualNode,
            `Построено: ${targetCoord} · ${formatTimeWithMs(manualIncoming.etaEpochMs)}`,
          );
        } else {
          setInfoVillageManualStatus(
            manualNode,
            "Не удалось открыть таблицу расчёта.",
          );
        }
        return;
      }
      const msgButton = event.target.closest(
        ".smm-msg-plan-btn[data-action][data-incoming-id]",
      );
      if (!msgButton) return;
      if (!isMessagePlanningScreen()) return;
      event.preventDefault();
      event.stopPropagation();
      const incomingId = cleanText(msgButton.getAttribute("data-incoming-id"));
      const action = cleanText(msgButton.getAttribute("data-action"));
      if (!incomingId || !action || !PLAN_ACTIONS.includes(action)) return;
      await renderMessageInlinePlanForButton(msgButton, incomingId, action);
    };
    document.addEventListener("click", clickHandler);
    document.addEventListener("input", (event) => {
      const panelNode = event.target.closest(".smm-msg-inline-panel");
      if (!panelNode) return;
      const scale = event.target.closest(".smm-row-scale");
      if (scale) {
        const row = scale.closest(".smm-slice-row");
        if (!row) return;
        applyRowScaleToInputs(row);
        updateSliceRowState(row);
        updateCountdownNodes();
        return;
      }
      const input = event.target.closest(".smm-slice-input, .smm-sigil-input");
      if (!input) return;
      const row = input.closest(".smm-slice-row");
      if (!row) return;
      updateSliceRowState(row);
      updateCountdownNodes();
    });
    document.addEventListener("change", (event) => {
      const groupSelect = event.target.closest(
        'select[data-village-group-select="1"]',
      );
      if (!groupSelect) return;
      const panelNode = groupSelect.closest(".smm-msg-inline-panel");
      if (!panelNode) return;
      const nextGroupId = normalizeVillageGroupId(groupSelect.value);
      groupSelect.disabled = true;
      (async () => {
        try {
          const changedResult = await switchVillageGroupAndReloadTroops({
            nextGroupId,
            panelNode,
          });
          if (!changedResult.changed) {
            setMessageInlinePanelStatus(
              panelNode,
              `Группа «${changedResult.groupLabel}» уже выбрана.`,
            );
            syncAllVillageGroupSelects(document);
            return;
          }
          const statusText = `Группа «${changedResult.groupLabel}»: загружено деревень ${changedResult.villagesCount}.`;
          rerenderAllMessageInlinePanels(statusText);
          if (state.ui) {
            renderMeta(state.ui, state.snapshot);
            renderActiveTab(state.ui);
            setStatus(state.ui, statusText);
          }
        } catch (error) {
          const text = cleanText(error && error.message) || "unknown";
          setMessageInlinePanelStatus(
            panelNode,
            `Ошибка загрузки группы: ${text}`,
          );
          if (state.ui) setStatus(state.ui, `Ошибка загрузки группы: ${text}`);
        } finally {
          syncAllVillageGroupSelects(document);
          groupSelect.disabled = false;
          const refreshedSelect = panelNode.querySelector(
            ".smm-msg-inline-group-select",
          );
          if (refreshedSelect) refreshedSelect.disabled = false;
        }
      })();
    });
    state.messageActionListenerBound = true;
    safe(() => {
      window[MESSAGE_ACTION_LISTENER_BOUND_KEY] = true;
      window[MESSAGE_ACTION_LISTENER_VERSION_KEY] = VERSION;
      window[MESSAGE_ACTION_LISTENER_HANDLER_KEY] = clickHandler;
      return true;
    }, false);
  };
  const shouldUseMessageInlineScenario = () => {
    if (!isMessagePlanningScreen()) return false;
    const hadInlineArtifacts = Boolean(
      document.querySelector(
        ".smm-msg-inline-actions, .smm-msg-inline-panel, #smm-msg-inline-fallback, .smm-msg-manual-inline",
      ),
    );
    const previousRuns = Math.max(
      0,
      toInt(safe(() => window[MESSAGE_INLINE_LAUNCH_COUNTER_KEY], 0)) || 0,
    );
    safe(() => {
      window[MESSAGE_INLINE_LAUNCH_COUNTER_KEY] = previousRuns + 1;
      return true;
    }, false);
    if (previousRuns >= 1) return false;
    if (hadInlineArtifacts) return false;
    return true;
  };
  const activateIncomingPlanAction = (
    incomingIdRaw,
    actionRaw,
    sourceLabel = null,
    preferredTabRaw = null,
  ) => {
    const incomingId = cleanText(incomingIdRaw);
    const action = cleanText(actionRaw);
    if (!incomingId || !action || !PLAN_ACTIONS.includes(action)) return false;
    setPlanAction(incomingId, action);
    state.openIncomingId = incomingId;
    const ownItems =
      state.incomings && Array.isArray(state.incomings.items)
        ? state.incomings.items
        : [];
    const hubItems = Array.isArray(state.hubQueryIncomings)
      ? state.hubQueryIncomings
      : [];
    const massItems = Array.isArray(state.hubMassIncomings)
      ? state.hubMassIncomings
      : [];
    const tribeItems = Array.isArray(state.hubTribeIncomings)
      ? state.hubTribeIncomings
      : [];
    const favoriteItems = getFavoriteIncomingItems();
    const preferredTab = cleanText(preferredTabRaw);
    const preferFavoritesLookup =
      preferredTab === "favorites" || state.activeTab === "favorites";
    let selectedIncoming =
      (preferFavoritesLookup
        ? favoriteItems.find(
            (item) => String(item && item.id) === String(incomingId),
          )
        : null) || null;
    if (!selectedIncoming) {
      selectedIncoming =
        ownItems
          .concat(hubItems)
          .concat(massItems)
          .concat(tribeItems)
          .concat(favoriteItems)
          .find((item) => String(item && item.id) === String(incomingId)) ||
        null;
    }
    const isTribeIncoming = tribeItems.some(
      (item) => String(item && item.id) === String(incomingId),
    );
    const nextTab =
      preferredTab && TOP_TABS.includes(preferredTab)
        ? preferredTab
        : isTribeIncoming
          ? "tribe"
          : "incomings";
    setActiveTab(nextTab);
    renderActiveTab(state.ui);
    const optionsCount = selectedIncoming
      ? buildIncomingVillagePlans(selectedIncoming, {
          action,
        }).rows.length
      : 0;
    const sourcePrefix = cleanText(sourceLabel)
      ? `${cleanText(sourceLabel)} · `
      : "";
    setStatus(
      state.ui,
      `${sourcePrefix}Выбрано: ${PLAN_ACTION_LABELS[action]} для #${incomingId} · успевает: ${optionsCount}`,
    );
    return true;
  };

  const persistAll = ({
    speedModel,
    incomings,
    supportIncomings,
    troops,
    troopsDefense,
    snapshot,
  }) => {
    if (speedModel) saveJson(STORAGE_KEYS.speed, speedModel);
    if (incomings) saveJson(STORAGE_KEYS.incomings, incomings);
    if (supportIncomings)
      saveJson(STORAGE_KEYS.incomingsSupports, supportIncomings);
    if (troops) saveJson(STORAGE_KEYS.troops, troops);
    if (troopsDefense) saveJson(STORAGE_KEYS.troopsDefense, troopsDefense);
    if (snapshot) saveJson(STORAGE_KEYS.snapshot, snapshot);
  };

  const hydrateFromCacheAndRender = (ui) => {
    if (!ui) return false;
    const cachedSpeed = readJson(STORAGE_KEYS.speed);
    const fallbackSpeed = buildSpeedModel({
      worldSpeed: null,
      unitSpeed: null,
      unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
      source: "fallback",
      warning: "Speed model fallback",
    });
    state.speedModel =
      cachedSpeed && typeof cachedSpeed === "object"
        ? cachedSpeed
        : state.speedModel || fallbackSpeed;

    const cachedIncomings = readJson(STORAGE_KEYS.incomings);
    if (cachedIncomings && Array.isArray(cachedIncomings.items)) {
      state.incomings = enrichIncomingsWithSpeed(
        cachedIncomings,
        state.speedModel,
      );
    } else if (!state.incomings) {
      state.incomings = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: null,
        count: 0,
        items: [],
      };
    }

    const cachedSupports = readJson(STORAGE_KEYS.incomingsSupports);
    if (cachedSupports && Array.isArray(cachedSupports.items)) {
      state.supportIncomings = enrichIncomingsWithSpeed(
        cachedSupports,
        state.speedModel,
      );
    } else if (!state.supportIncomings) {
      state.supportIncomings = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: null,
        count: 0,
        items: [],
      };
    }

    const cachedTroopsRaw = readJson(STORAGE_KEYS.troops);
    const cachedTroops = isPayloadFreshByFetchedAt(
      cachedTroopsRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedTroopsRaw
      : null;
    if (cachedTroops && Array.isArray(cachedTroops.villages)) {
      state.troops = cachedTroops;
    } else if (
      !state.troops ||
      !isPayloadFreshByFetchedAt(state.troops, TROOPS_CACHE_TTL_MS)
    ) {
      state.troops = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: null,
        count: 0,
        units: [],
        villages: [],
      };
    }

    const cachedTroopsDefenseRaw = readJson(STORAGE_KEYS.troopsDefense);
    const cachedTroopsDefense = isPayloadFreshByFetchedAt(
      cachedTroopsDefenseRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedTroopsDefenseRaw
      : null;
    if (cachedTroopsDefense && Array.isArray(cachedTroopsDefense.villages)) {
      state.troopsDefense = cachedTroopsDefense;
    } else if (
      !state.troopsDefense ||
      !isPayloadFreshByFetchedAt(state.troopsDefense, TROOPS_CACHE_TTL_MS)
    ) {
      state.troopsDefense = state.troops;
    }

    const cachedOverviewCommands = readJson(STORAGE_KEYS.overviewCommands);
    if (cachedOverviewCommands && typeof cachedOverviewCommands === "object") {
      state.overviewCommandsDump = cachedOverviewCommands;
    } else if (!state.overviewCommandsDump) {
      state.overviewCommandsDump = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: null,
        rowsCount: 0,
        rows: [],
        commandsCount: 0,
        units: [],
        byType: { attack: 0, support: 0, return: 0, other: 0 },
        items: [],
      };
    }

    const cachedOverviewUnitsRaw = readJson(STORAGE_KEYS.overviewUnits);
    const cachedOverviewUnits = isPayloadFreshByFetchedAt(
      cachedOverviewUnitsRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedOverviewUnitsRaw
      : null;
    if (cachedOverviewUnits && typeof cachedOverviewUnits === "object") {
      state.overviewUnitsDump = cachedOverviewUnits;
    } else if (
      !state.overviewUnitsDump ||
      !isPayloadFreshByFetchedAt(state.overviewUnitsDump, TROOPS_CACHE_TTL_MS)
    ) {
      state.overviewUnitsDump = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: null,
        rowsCount: 0,
        rows: [],
        villagesCount: 0,
        units: [],
        villages: [],
      };
    }

    const cachedOverviewUnitsDefenseRaw = readJson(
      STORAGE_KEYS.overviewUnitsDefense,
    );
    const cachedOverviewUnitsDefense = isPayloadFreshByFetchedAt(
      cachedOverviewUnitsDefenseRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedOverviewUnitsDefenseRaw
      : null;
    if (
      cachedOverviewUnitsDefense &&
      typeof cachedOverviewUnitsDefense === "object"
    ) {
      state.overviewUnitsDefenseDump = cachedOverviewUnitsDefense;
    } else if (
      !state.overviewUnitsDefenseDump ||
      !isPayloadFreshByFetchedAt(
        state.overviewUnitsDefenseDump,
        TROOPS_CACHE_TTL_MS,
      )
    ) {
      state.overviewUnitsDefenseDump = {
        version: 1,
        fetchedAt: new Date(getServerNowMs()).toISOString(),
        sourceUrl: null,
        rowsCount: 0,
        rows: [],
        villagesCount: 0,
        units: [],
        villages: [],
      };
    }

    const cachedSnapshot = readJson(STORAGE_KEYS.snapshot);
    if (cachedSnapshot && typeof cachedSnapshot === "object") {
      const cachedSigilPercent = getTrustedSnapshotSigilPercent(cachedSnapshot);
      state.snapshot = {
        ...cachedSnapshot,
        sigilPercent: cachedSigilPercent,
        sigilSource:
          cachedSigilPercent > 0
            ? cleanText(cachedSnapshot.sigilSource) || "cache"
            : "cache_stale",
      };
      state.detectedSigilPercent = cachedSigilPercent;
    } else {
      state.snapshot = buildSnapshot({
        speedModel: state.speedModel,
        incomings: state.incomings,
        troops: state.troops,
        overviewCommands: state.overviewCommandsDump,
        detectedSigilPercent: state.detectedSigilPercent,
        sigilSource: "cache",
        errors: [],
      });
    }

    renderMeta(ui, state.snapshot);
    renderActiveTab(ui);
    state.hasPrimaryIncomingsRender = true;
    const updatedAt =
      cleanText(state.snapshot && state.snapshot.generatedAt) ||
      cleanText(state.incomings && state.incomings.fetchedAt) ||
      new Date(getServerNowMs()).toISOString();
    setUpdated(ui, updatedAt);
    setStatus(ui, "Показаны кэшированные данные, идёт обновление...");
    return true;
  };

  const refreshData = async ({ hydrateFromCacheFirst = true } = {}) => {
    if (!state.ui) return;
    if (state.refreshInProgress) {
      setStatus(state.ui, "Обновление уже выполняется, подожди завершения.");
      return;
    }
    state.refreshInProgress = true;
    if (hydrateFromCacheFirst) {
      safe(() => hydrateFromCacheAndRender(state.ui), null);
    }
    await ensureVillageGroupsLoaded();
    syncAllVillageGroupSelects(document);
    syncScheduledCommandsFromStorage();

    setStatus(state.ui, "Загрузка данных через fetch...");
    if (state.ui && state.ui.refreshButton)
      state.ui.refreshButton.disabled = true;
    state.errors = [];
    const warnings = [];
    let maneuverReconcileStats = null;
    let canReconcileWithCommands = false;
    const messageScreen = isMessagePlanningScreen();
    const messageInlineMode = Boolean(messageScreen && state.messageMode);
    const errorText = (reason) =>
      cleanText(
        reason && reason.message ? reason.message : String(reason || ""),
      ) || "unknown";
    const cachedIncomings = readJson(STORAGE_KEYS.incomings);
    const cachedSupports = readJson(STORAGE_KEYS.incomingsSupports);
    const cachedTroopsRaw = readJson(STORAGE_KEYS.troops);
    const cachedTroops = isPayloadFreshByFetchedAt(
      cachedTroopsRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedTroopsRaw
      : null;
    const cachedTroopsDefenseRaw = readJson(STORAGE_KEYS.troopsDefense);
    const cachedTroopsDefense = isPayloadFreshByFetchedAt(
      cachedTroopsDefenseRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedTroopsDefenseRaw
      : null;
    const cachedOverviewCommands = readJson(STORAGE_KEYS.overviewCommands);
    const cachedOverviewUnitsRaw = readJson(STORAGE_KEYS.overviewUnits);
    const cachedOverviewUnits = isPayloadFreshByFetchedAt(
      cachedOverviewUnitsRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedOverviewUnitsRaw
      : null;
    const cachedOverviewUnitsDefenseRaw = readJson(
      STORAGE_KEYS.overviewUnitsDefense,
    );
    const cachedOverviewUnitsDefense = isPayloadFreshByFetchedAt(
      cachedOverviewUnitsDefenseRaw,
      TROOPS_CACHE_TTL_MS,
    )
      ? cachedOverviewUnitsDefenseRaw
      : null;
    // Не перезаписываем storage из возможного пустого state перед refresh:
    // сначала подтягиваем актуальный план из localStorage, иначе резерв может пропасть.
    syncScheduledCommandsFromStorage();
    const progressTracker = createProgressTracker(state.ui, 7);
    try {
      const speedResultPromise = toSettledResult(
        progressTracker.track(loadSpeedModel(), "скорость"),
      );
      const incomingsResultPromise = toSettledResult(
        progressTracker.track(fetchIncomingsAttacks(), "входящие атаки"),
      );
      const supportsResultPromise = toSettledResult(
        progressTracker.track(fetchIncomingsSupports(), "входящие подкрeпы"),
      );
      const tribeSigilResultPromise = toSettledResult(
        progressTracker.track(fetchTribeSigilPercent(), "сигил"),
      );
      const [speedResult, incomingsResult, supportsResult, tribeSigilResult] =
        await Promise.all([
          speedResultPromise,
          incomingsResultPromise,
          supportsResultPromise,
          tribeSigilResultPromise,
        ]);

      // Показываем "Входящие" сразу после их fetch,
      // не ожидая тяжёлых запросов по приказам/войскам/хабу.
      const previewSpeedModel =
        speedResult.status === "fulfilled"
          ? speedResult.value
          : buildSpeedModel({
              worldSpeed: null,
              unitSpeed: null,
              unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
              source: "fallback",
              warning: "Speed model failed, fallback used",
              error: cleanText(speedResult.reason && speedResult.reason.message),
            });
      state.speedModel = previewSpeedModel;
      state.incomings =
        incomingsResult.status === "fulfilled"
          ? enrichIncomingsWithSpeed(incomingsResult.value, previewSpeedModel)
          : cachedIncomings && Array.isArray(cachedIncomings.items)
            ? enrichIncomingsWithSpeed(cachedIncomings, previewSpeedModel)
            : {
                version: 1,
                fetchedAt: new Date(getServerNowMs()).toISOString(),
                sourceUrl: null,
                count: 0,
                items: [],
              };
      state.supportIncomings =
        supportsResult.status === "fulfilled"
          ? enrichIncomingsWithSpeed(supportsResult.value, previewSpeedModel)
          : cachedSupports && Array.isArray(cachedSupports.items)
            ? enrichIncomingsWithSpeed(cachedSupports, previewSpeedModel)
            : {
                version: 1,
                fetchedAt: new Date(getServerNowMs()).toISOString(),
                sourceUrl: null,
                count: 0,
                items: [],
              };
      if (!messageInlineMode && state.ui) {
        const authoritativeLiveSigilPreview =
          getCurrentPageAuthoritativeSigilPercent();
        const liveSigilPreview = Number.isFinite(
          authoritativeLiveSigilPreview,
        )
          ? authoritativeLiveSigilPreview
          : normalizeSigilPercent(detectActiveSigilPercent());
        if (
          Number.isFinite(authoritativeLiveSigilPreview) ||
          liveSigilPreview > 0
        ) {
          state.detectedSigilPercent = liveSigilPreview;
        }
        state.snapshot = buildSnapshot({
          speedModel: state.speedModel,
          incomings: state.incomings,
          troops: state.troops,
          overviewCommands: state.overviewCommandsDump,
          detectedSigilPercent: state.detectedSigilPercent,
          sigilSource: "early_preview",
          errors: state.errors.slice(),
        });
        renderMeta(state.ui, state.snapshot);
        state.hasPrimaryIncomingsRender = true;
        requestIncomingsRerender("refresh_preview_incomings", { force: true });
        setUpdated(state.ui, state.snapshot.generatedAt);
        setStatus(
          state.ui,
          "Входящие обновлены. Догружаю приказы, войска и данные хаба...",
        );
      }

      await sleep(220);
      const overviewCommandsResult = await toSettledResult(
        progressTracker.track(
          fetchOverviewCommandsDump({ groupIdRaw: "0" }),
          "приказы",
        ),
      );
      await sleep(320);
      const overviewUnitsResult = await toSettledResult(
        progressTracker.track(fetchOverviewUnitsDump(), "войска в деревне"),
      );
      await sleep(220);
      const overviewUnitsDefenseResult = await toSettledResult(
        progressTracker.track(fetchOverviewUnitsDump("all"), "войска всего"),
      );

      if (speedResult.status === "fulfilled") {
        state.speedModel = speedResult.value;
      } else {
        state.speedModel = buildSpeedModel({
          worldSpeed: null,
          unitSpeed: null,
          unitBaseMinutes: UNIT_BASE_MINUTES_FALLBACK,
          source: "fallback",
          warning: "Speed model failed, fallback used",
          error: cleanText(speedResult.reason && speedResult.reason.message),
        });
        state.errors.push(
          `speed: ${cleanText(speedResult.reason && speedResult.reason.message)}`,
        );
      }

      if (incomingsResult.status === "fulfilled") {
        state.incomings = enrichIncomingsWithSpeed(
          incomingsResult.value,
          state.speedModel,
        );
      } else {
        if (cachedIncomings && Array.isArray(cachedIncomings.items)) {
          state.incomings = enrichIncomingsWithSpeed(
            cachedIncomings,
            state.speedModel,
          );
          warnings.push(
            `incomings: использован кэш (${errorText(incomingsResult.reason)})`,
          );
        } else {
          state.incomings = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            count: 0,
            items: [],
          };
          state.errors.push(`incomings: ${errorText(incomingsResult.reason)}`);
        }
      }

      if (supportsResult.status === "fulfilled") {
        state.supportIncomings = enrichIncomingsWithSpeed(
          supportsResult.value,
          state.speedModel,
        );
        saveJson(STORAGE_KEYS.incomingsSupports, state.supportIncomings);
      } else {
        if (cachedSupports && Array.isArray(cachedSupports.items)) {
          state.supportIncomings = enrichIncomingsWithSpeed(
            cachedSupports,
            state.speedModel,
          );
          saveJson(STORAGE_KEYS.incomingsSupports, state.supportIncomings);
          warnings.push(
            `supports: использован кэш (${errorText(supportsResult.reason)})`,
          );
        } else {
          state.supportIncomings = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            count: 0,
            items: [],
          };
          saveJson(STORAGE_KEYS.incomingsSupports, state.supportIncomings);
          state.errors.push(`supports: ${errorText(supportsResult.reason)}`);
        }
      }

      if (
        state.supportIncomings &&
        Array.isArray(state.supportIncomings.items) &&
        state.supportIncomings.items.length
      ) {
        try {
          const enrichedSupports =
            await enrichSupportIncomingsWithCommandDetails(
              state.supportIncomings,
              state.speedModel,
            );
          state.supportIncomings = enrichIncomingsWithSpeed(
            enrichedSupports,
            state.speedModel,
          );
          saveJson(STORAGE_KEYS.incomingsSupports, state.supportIncomings);
        } catch (error) {
          warnings.push(`supports_details: ${errorText(error)}`);
        }
      }

      if (overviewUnitsResult.status === "fulfilled") {
        state.troops = {
          version: 1,
          fetchedAt: overviewUnitsResult.value.fetchedAt,
          sourceUrl: overviewUnitsResult.value.sourceUrl,
          count: overviewUnitsResult.value.villagesCount || 0,
          units: overviewUnitsResult.value.units || [],
          villages: overviewUnitsResult.value.villages || [],
          warning: null,
        };
      } else {
        const isHomeTroopsPayload = (payload) => {
          const villages =
            payload && Array.isArray(payload.villages) ? payload.villages : [];
          if (!villages.length) return false;
          const allowed = new Set([
            "in_village_row",
            "home_link_row",
            "own_home_single_row",
            "own_home_row",
          ]);
          const withSource = villages.filter((v) =>
            cleanText(v && v.troopsSource),
          );
          if (!withSource.length) return false;
          return withSource.every((v) =>
            allowed.has(cleanText(v.troopsSource)),
          );
        };

        const cachedOverviewTroopsPayload =
          cachedOverviewUnits &&
          Array.isArray(cachedOverviewUnits.villages) &&
          cachedOverviewUnits.villages.length
            ? {
                version: 1,
                fetchedAt:
                  cachedOverviewUnits.fetchedAt ||
                  new Date(getServerNowMs()).toISOString(),
                sourceUrl: cachedOverviewUnits.sourceUrl || null,
                count:
                  cachedOverviewUnits.villagesCount ||
                  cachedOverviewUnits.villages.length,
                units: cachedOverviewUnits.units || [],
                villages: cachedOverviewUnits.villages || [],
                warning: `cache fallback: ${errorText(overviewUnitsResult.reason)}`,
              }
            : null;
        const fallbackTroops =
          cachedOverviewTroopsPayload &&
          isHomeTroopsPayload(cachedOverviewTroopsPayload)
            ? cachedOverviewTroopsPayload
            : cachedTroops &&
                Array.isArray(cachedTroops.villages) &&
                cachedTroops.villages.length
              ? isHomeTroopsPayload(cachedTroops)
                ? cachedTroops
                : null
              : null;

        if (fallbackTroops) {
          state.troops = fallbackTroops;
          warnings.push(
            `troops: использован кэш (${errorText(overviewUnitsResult.reason)})`,
          );
        } else {
          state.troops = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            count: 0,
            units: [],
            villages: [],
            warning: errorText(overviewUnitsResult.reason),
          };
          state.errors.push(`troops: ${errorText(overviewUnitsResult.reason)}`);
        }
      }

      if (overviewUnitsDefenseResult.status === "fulfilled") {
        state.troopsDefense = {
          version: 1,
          fetchedAt: overviewUnitsDefenseResult.value.fetchedAt,
          sourceUrl: overviewUnitsDefenseResult.value.sourceUrl,
          count: overviewUnitsDefenseResult.value.villagesCount || 0,
          units: overviewUnitsDefenseResult.value.units || [],
          villages: overviewUnitsDefenseResult.value.villages || [],
          warning: null,
        };
        saveJson(STORAGE_KEYS.troopsDefense, state.troopsDefense);
      } else {
        const cachedOverviewDefenseTroopsPayload =
          cachedOverviewUnitsDefense &&
          Array.isArray(cachedOverviewUnitsDefense.villages) &&
          cachedOverviewUnitsDefense.villages.length
            ? {
                version: 1,
                fetchedAt:
                  cachedOverviewUnitsDefense.fetchedAt ||
                  new Date(getServerNowMs()).toISOString(),
                sourceUrl: cachedOverviewUnitsDefense.sourceUrl || null,
                count:
                  cachedOverviewUnitsDefense.villagesCount ||
                  cachedOverviewUnitsDefense.villages.length,
                units: cachedOverviewUnitsDefense.units || [],
                villages: cachedOverviewUnitsDefense.villages || [],
                warning: `cache fallback: ${errorText(overviewUnitsDefenseResult.reason)}`,
              }
            : null;
        const fallbackDefenseTroops =
          cachedOverviewDefenseTroopsPayload ||
          (cachedTroopsDefense &&
          Array.isArray(cachedTroopsDefense.villages) &&
          cachedTroopsDefense.villages.length
            ? cachedTroopsDefense
            : null);

        if (fallbackDefenseTroops) {
          state.troopsDefense = fallbackDefenseTroops;
          warnings.push(
            `troops_defense: использован кэш (${errorText(overviewUnitsDefenseResult.reason)})`,
          );
        } else {
          state.troopsDefense = state.troops;
          warnings.push(
            `troops_defense: fallback к troops (${errorText(overviewUnitsDefenseResult.reason)})`,
          );
        }
      }

      if (overviewCommandsResult.status === "fulfilled") {
        let commandsDump = overviewCommandsResult.value;
        try {
          commandsDump =
            await enrichOverviewCommandsWithRouteDetails(commandsDump);
        } catch (routeError) {
          warnings.push(`overview_commands_route: ${errorText(routeError)}`);
        }
        state.overviewCommandsDump = commandsDump;
        saveJson(STORAGE_KEYS.overviewCommands, state.overviewCommandsDump);
        canReconcileWithCommands = true;
      } else {
        if (
          cachedOverviewCommands &&
          (Array.isArray(cachedOverviewCommands.rows) ||
            Array.isArray(cachedOverviewCommands.items))
        ) {
          state.overviewCommandsDump = {
            ...cachedOverviewCommands,
            cacheFallback: true,
            error: errorText(overviewCommandsResult.reason),
          };
          saveJson(STORAGE_KEYS.overviewCommands, state.overviewCommandsDump);
          warnings.push(
            `overview_commands: использован кэш (${errorText(overviewCommandsResult.reason)})`,
          );
          canReconcileWithCommands = false;
        } else {
          state.overviewCommandsDump = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            screen: "overview_villages",
            mode: "commands",
            rowsCount: 0,
            rows: [],
            commandsCount: 0,
            units: [],
            byType: { attack: 0, support: 0, return: 0, other: 0 },
            items: [],
            warning: null,
            error: errorText(overviewCommandsResult.reason),
          };
          saveJson(STORAGE_KEYS.overviewCommands, state.overviewCommandsDump);
          state.errors.push(
            `overview_commands: ${errorText(overviewCommandsResult.reason)}`,
          );
        }
      }

      if (overviewUnitsResult.status === "fulfilled") {
        state.overviewUnitsDump = overviewUnitsResult.value;
        saveJson(STORAGE_KEYS.overviewUnits, state.overviewUnitsDump);
      } else {
        if (cachedOverviewUnits && Array.isArray(cachedOverviewUnits.rows)) {
          state.overviewUnitsDump = {
            ...cachedOverviewUnits,
            cacheFallback: true,
            error: errorText(overviewUnitsResult.reason),
          };
          saveJson(STORAGE_KEYS.overviewUnits, state.overviewUnitsDump);
        } else {
          state.overviewUnitsDump = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            screen: "overview_villages",
            mode: "units",
            rowsCount: 0,
            rows: [],
            villagesCount: 0,
            units: [],
            villages: [],
            error: errorText(overviewUnitsResult.reason),
          };
          saveJson(STORAGE_KEYS.overviewUnits, state.overviewUnitsDump);
        }
      }

      if (overviewUnitsDefenseResult.status === "fulfilled") {
        state.overviewUnitsDefenseDump = overviewUnitsDefenseResult.value;
        saveJson(
          STORAGE_KEYS.overviewUnitsDefense,
          state.overviewUnitsDefenseDump,
        );
      } else {
        if (
          cachedOverviewUnitsDefense &&
          Array.isArray(cachedOverviewUnitsDefense.rows)
        ) {
          state.overviewUnitsDefenseDump = {
            ...cachedOverviewUnitsDefense,
            cacheFallback: true,
            error: errorText(overviewUnitsDefenseResult.reason),
          };
          saveJson(
            STORAGE_KEYS.overviewUnitsDefense,
            state.overviewUnitsDefenseDump,
          );
        } else {
          state.overviewUnitsDefenseDump = {
            version: 1,
            fetchedAt: new Date(getServerNowMs()).toISOString(),
            sourceUrl: null,
            screen: "overview_villages",
            mode: "units",
            type: "all",
            rowsCount: 0,
            rows: [],
            villagesCount: 0,
            units: [],
            villages: [],
            error: errorText(overviewUnitsDefenseResult.reason),
          };
          saveJson(
            STORAGE_KEYS.overviewUnitsDefense,
            state.overviewUnitsDefenseDump,
          );
        }
      }

      state.messageMode = messageInlineMode;
      if (messageInlineMode) {
        const messagePayload = parseMessagePlanningPayload(document);
        if (
          messagePayload &&
          messagePayload.dump &&
          Array.isArray(messagePayload.dump.items) &&
          messagePayload.dump.items.length
        ) {
          state.incomings = enrichIncomingsWithSpeed(
            messagePayload.dump,
            state.speedModel,
          );
          warnings.push(
            `message_parser: найдено ${messagePayload.dump.items.length} целей из текущей страницы`,
          );
        } else {
          warnings.push("message_parser: цели в текущем сообщении не найдены");
        }
        renderMessageInlineActionButtons(
          messagePayload && Array.isArray(messagePayload.anchors)
            ? messagePayload.anchors
            : [],
        );
        const forumAutoFavoriteResult = runForumAutoFavoriteImport({
          payload: messagePayload,
          phase: "refresh",
          notifyOnAdd: false,
        });
        scheduleForumAutoFavoriteImportRetries();
        if (
          forumAutoFavoriteResult &&
          Number(forumAutoFavoriteResult.added) > 0
        ) {
          warnings.push(
            `forum_auto_favorites: +${forumAutoFavoriteResult.added}`,
          );
        }
      } else if (!messageScreen) {
        clearMessageInlineActionButtons();
      }

      if (canReconcileWithCommands) {
        maneuverReconcileStats = reconcileScheduledCommandsWithOwnCommands(
          state.overviewCommandsDump &&
            Array.isArray(state.overviewCommandsDump.items)
            ? state.overviewCommandsDump.items
            : [],
          getServerNowMs(),
        );
      } else {
        syncScheduledCommandsFromStorage();
      }

      const ownIncomingIds =
        state.incomings && Array.isArray(state.incomings.items)
          ? state.incomings.items.map((item) => String((item && item.id) || ""))
          : [];
      const hubIncomingIds = Array.isArray(state.hubQueryIncomings)
        ? state.hubQueryIncomings.map((item) => String((item && item.id) || ""))
        : [];
      const massIncomingIds = Array.isArray(state.hubMassIncomings)
        ? state.hubMassIncomings.map((item) => String((item && item.id) || ""))
        : [];
      const tribeIncomingIds = Array.isArray(state.hubTribeIncomings)
        ? state.hubTribeIncomings.map((item) => String((item && item.id) || ""))
        : [];
      const knownIncomingIds = new Set(
        ownIncomingIds
          .concat(hubIncomingIds)
          .concat(massIncomingIds)
          .concat(tribeIncomingIds)
          .filter(Boolean),
      );
      if (
        state.openIncomingId &&
        !knownIncomingIds.has(String(state.openIncomingId))
      ) {
        state.openIncomingId = null;
      }

      const localSigilPercent = detectActiveSigilPercent();
      const tribeSigilPercent =
        tribeSigilResult.status === "fulfilled"
          ? toNumber(tribeSigilResult.value.value)
          : null;
      const tribeSigilSource =
        tribeSigilResult.status === "fulfilled"
          ? cleanText(tribeSigilResult.value.source)
          : "";
      const tribeSigilAuthoritative =
        tribeSigilSource === "ally_level.active_friendship" &&
        Number.isFinite(tribeSigilPercent);
      const localSigilAuthoritative = Number.isFinite(
        getCurrentPageAuthoritativeSigilPercent(),
      );
      const snapshotSigil = getTrustedSnapshotSigilPercent(state.snapshot);
      state.detectedSigilPercent = tribeSigilAuthoritative
        ? normalizeSigilPercent(tribeSigilPercent)
        : localSigilAuthoritative
          ? normalizeSigilPercent(localSigilPercent)
          : selectPreferredSigilPercent(
              tribeSigilPercent,
              localSigilPercent,
              toNumber(state.detectedSigilPercent),
              snapshotSigil,
            );
      let sigilSource = "page";
      if (tribeSigilAuthoritative) {
        sigilSource = `tribe:${tribeSigilSource || "unknown"}`;
      } else if (localSigilAuthoritative) {
        sigilSource = "page:ally_level.active_friendship";
      } else if (
        Number.isFinite(tribeSigilPercent) &&
        normalizeSigilPercent(tribeSigilPercent) === state.detectedSigilPercent
      ) {
        sigilSource = `tribe:${tribeSigilSource || "unknown"}`;
      } else if (
        Number.isFinite(localSigilPercent) &&
        normalizeSigilPercent(localSigilPercent) === state.detectedSigilPercent
      ) {
        sigilSource = "page";
      } else if (snapshotSigil > 0) {
        sigilSource = "snapshot";
      }

      state.snapshot = buildSnapshot({
        speedModel: state.speedModel,
        incomings: state.incomings,
        troops: state.troops,
        overviewCommands: state.overviewCommandsDump,
        detectedSigilPercent: state.detectedSigilPercent,
        sigilSource,
        errors: state.errors.slice(),
      });

      persistAll({
        speedModel: state.speedModel,
        incomings: state.messageMode ? null : state.incomings,
        supportIncomings: state.supportIncomings,
        troops: state.troops,
        troopsDefense: state.troopsDefense,
        snapshot: state.snapshot,
      });

      renderMeta(state.ui, state.snapshot);
      if (hasInlinePlanningPanelOpen()) {
        state.pendingActiveTabRerender = true;
      } else {
        renderActiveTab(state.ui);
      }
      state.hasPrimaryIncomingsRender = true;
      const activeHubConnection = normalizeHubConnection(state.hubConnection);
      if (cleanText(activeHubConnection && activeHubConnection.url)) {
        if (!state.hubSyncTimerId && !state.hubSyncInFlight) {
          startHubSyncLoop();
        } else {
          void loadHubQueryIncomingsAsync({ force: true, silent: true });
          void loadHubOwnQueriesAsync({ force: true, silent: true });
          void loadHubMassIncomingsAsync({ force: true, silent: true });
          if (getUiSetting("exchangeTribeAttacks")) {
            void loadHubTribeIncomingsAsync({ force: true, silent: true });
          } else {
            clearHubTribeIncomings();
          }
          if (getUiSetting("loadPlanFromHub")) {
            void loadHubPlanFromHubAsync({ force: true, silent: true });
          }
        }
      } else {
        stopHubSyncLoop();
        clearHubQueryIncomings();
        clearHubOwnQueries();
        clearHubMassIncomings();
        clearHubTribeIncomings();
      }
      setUpdated(state.ui, state.snapshot.generatedAt);
      const maneuverSummary =
        maneuverReconcileStats && maneuverReconcileStats.finalizedCount > 0
          ? ` · манёвры: успешно ${maneuverReconcileStats.successCount}, не в тайминг ${maneuverReconcileStats.timingMissCount}, пропущено ${maneuverReconcileStats.missedCount}`
          : "";

      if (state.errors.length) {
        setStatus(
          state.ui,
          `Готово с ошибками: ${state.errors.join(" | ")}${maneuverSummary}`,
        );
      } else if (warnings.length) {
        setStatus(
          state.ui,
          `Готово: часть данных из кэша · ${warnings.join(" | ")}${maneuverSummary}`,
        );
      } else {
        setStatus(
          state.ui,
          `Готово: данные обновлены и сохранены в localStorage${maneuverSummary}`,
        );
      }
      if (state.ui && state.ui.refreshButton)
        state.ui.refreshButton.disabled = false;

      if (DEBUG_VERBOSE_LOGS) {
        console.log(`${LOG_PREFIX} refresh complete`, {
          speedModel: state.speedModel,
          incomings: state.incomings,
          supportIncomings: state.supportIncomings,
          troops: state.troops,
          troopsDefense: state.troopsDefense,
          snapshot: state.snapshot,
        });
      }
    } catch (error) {
      state.errors.push(`refresh: ${errorText(error)}`);
      setStatus(state.ui, `Ошибка обновления: ${errorText(error)}`);
      console.error(`${LOG_PREFIX} refresh failed`, error);
    } finally {
      state.refreshInProgress = false;
      progressTracker.finish();
      if (state.ui && state.ui.refreshButton)
        state.ui.refreshButton.disabled = false;
      flushDeferredUiRerenders();
    }
  };

  const initUi = () => {
    state.ui = createOverlay();
    applyMobileHeaderActionButtons(state.ui);
    initVillageGroupState();
    loadUiSettings();
    state.planActions = loadPlanActions();
    loadCalcDisabledUnits();
    loadHiddenIncomings();
    loadHiddenVillageGroups();
    loadFavoriteEntries();
    loadArchivedManeuvers();
    loadScheduledCommands();
    state.hubConnection = loadHubConnection();
    state.hubLastSyncAtMs = null;
    state.hubLastSyncError = null;
    state.hubLastSyncStats = null;
    state.hubLastCommandsFetchMs = 0;
    state.hubQueryIncomings = [];
    state.hubQueryThreshold = null;
    state.hubQueryLastLoadedMs = null;
    state.hubQueryLoading = false;
    state.hubQueryError = null;
    state.hubOwnQueries = [];
    state.hubOwnQueriesLastLoadedMs = null;
    state.hubOwnQueriesLoading = false;
    state.hubOwnQueriesError = null;
    state.hubMassIncomings = [];
    state.hubMassLastLoadedMs = null;
    state.hubMassLoading = false;
    state.hubMassError = null;
    state.hubTribeIncomings = [];
    state.hubTribeTroopsRows = [];
    state.hubTribeLastLoadedMs = null;
    state.hubTribeLoading = false;
    state.hubTribeError = null;
    state.hubTribeLastFingerprint = null;
    state.hubTribeSyncError = null;
    state.hubTribeLastSyncAtMs = null;
    state.hubPlanLoading = false;
    state.hubPlanError = null;
    state.hubPlanLastLoadedMs = null;
    state.hubPlanLastFingerprint = null;
    state.hasPrimaryIncomingsRender = false;
    state.refreshInProgress = false;
    state.pendingActiveTabRerender = false;
    state.pendingPlanRerender = false;
    state.pendingHubTabRerender = false;
    state.hubEntries = [];
    state.activeTab = loadActiveTab();
    hydrateFromCacheAndRender(state.ui);

    const closeHubDialog = () => {
      if (!state.ui || !state.ui.hubDialog) return;
      state.ui.hubDialog.hidden = true;
    };
    const openHubDialog = () => {
      if (!state.ui || !state.ui.hubDialog) return;
      state.ui.hubDialog.hidden = false;
      state.ui.hubDialog.setAttribute("data-mode", "connect");
      if (state.ui.hubAddressInput) {
        const current = cleanText(state.ui.hubAddressInput.value);
        const storedUrl = cleanText(
          state.hubConnection && state.hubConnection.url,
        );
        state.ui.hubAddressInput.value = current || storedUrl || "";
        state.ui.hubAddressInput.focus();
        state.ui.hubAddressInput.select();
      }
      setStatus(state.ui, "Хаб: укажи адрес GAS и нажми «Подключиться».");
    };
    const closeSettingsDialog = () => {
      if (!state.ui || !state.ui.settingsDialog) return;
      if (state.ui.settingsForceSigilInput) {
        applyForcedSigilFromInput();
      }
      state.ui.settingsDialog.hidden = true;
    };
    const syncSettingsDialogUi = () => {
      if (!state.ui) return;
      state.uiSettings = normalizeUiSettings(state.uiSettings);
      state.ui.settingsCheckboxes.forEach((checkbox) => {
        const key = cleanText(
          checkbox && checkbox.getAttribute("data-setting-key"),
        );
        if (!key) return;
        checkbox.checked = getUiSetting(key);
      });
      if (state.ui.settingsHubPollInput) {
        const currentSeconds = Math.round(getHubSyncIntervalMs() / 1000);
        state.ui.settingsHubPollInput.value = String(currentSeconds);
      }
      if (state.ui.settingsNearestSliceWindowInput) {
        state.ui.settingsNearestSliceWindowInput.value = String(
          getNearestSliceWindowMinutes(),
        );
      }
      if (state.ui.settingsForceSigilInput) {
        const forcedSigilValue = normalizeUiForcedSigilPercent(
          getUiSetting("forceSigilPercent"),
        );
        state.ui.settingsForceSigilInput.value = Number.isFinite(forcedSigilValue)
          ? String(forcedSigilValue)
          : "";
      }
      const hubConnected = Boolean(
        cleanText(state.hubConnection && state.hubConnection.url),
      );
      const loadPlanCheckbox = state.ui.settingsCheckboxes.find(
        (node) =>
          cleanText(node && node.getAttribute("data-setting-key")) ===
          "loadPlanFromHub",
      );
      if (loadPlanCheckbox) {
        loadPlanCheckbox.disabled = !hubConnected;
        const wrapper = loadPlanCheckbox.closest(
          "[data-setting-wrap='loadPlanFromHub'], .smm-settings-item",
        );
        if (wrapper) {
          wrapper.classList.toggle("disabled", !hubConnected);
        }
      }
      if (state.ui.settingsForceSigilInput) {
        const forceSigilEnabled = Boolean(getUiSetting("forceSigilEnabled"));
        state.ui.settingsForceSigilInput.disabled = !forceSigilEnabled;
        const wrapper = state.ui.settingsForceSigilInput.closest(
          "[data-setting-wrap='forceSigilPercent'], .smm-settings-item",
        );
        if (wrapper) {
          wrapper.classList.toggle("disabled", !forceSigilEnabled);
        }
      }
    };
    const openSettingsDialog = () => {
      if (!state.ui || !state.ui.settingsDialog) return;
      syncSettingsDialogUi();
      state.ui.settingsDialog.hidden = false;
      setStatus(
        state.ui,
        "Настройки: изменения сохраняются в localStorage сразу.",
      );
    };
    const applyHubPollIntervalFromInput = () => {
      if (!state.ui || !state.ui.settingsHubPollInput) return;
      const rawSeconds = Number(state.ui.settingsHubPollInput.value);
      if (!Number.isFinite(rawSeconds)) {
        syncSettingsDialogUi();
        setStatus(state.ui, "Частота опроса должна быть числом.");
        return;
      }
      const changed = setHubSyncIntervalMs(Math.round(rawSeconds * 1000));
      const normalizedSeconds = Math.round(getHubSyncIntervalMs() / 1000);
      state.ui.settingsHubPollInput.value = String(normalizedSeconds);
      if (!changed) return;
      if (cleanText(state.hubConnection && state.hubConnection.url)) {
        startHubSyncLoop();
      }
      setStatus(state.ui, `Частота опроса сервера: ${normalizedSeconds} сек.`);
    };
    const applyNearestSliceWindowFromInput = () => {
      if (!state.ui || !state.ui.settingsNearestSliceWindowInput) return;
      const rawMinutes = Number(state.ui.settingsNearestSliceWindowInput.value);
      if (!Number.isFinite(rawMinutes)) {
        syncSettingsDialogUi();
        setStatus(
          state.ui,
          "Длинна окна для ближайших срезов должна быть числом (минуты).",
        );
        return;
      }
      const changed = setNearestSliceWindowMs(
        Math.round(rawMinutes * 60 * 1000),
      );
      const normalizedMinutes = getNearestSliceWindowMinutes();
      state.ui.settingsNearestSliceWindowInput.value = String(normalizedMinutes);
      if (!changed) return;
      setStatus(
        state.ui,
        `Длинна окна для ближайших срезов: ${normalizedMinutes} мин.`,
      );
    };
    const applyForcedSigilFromInput = () => {
      if (!state.ui || !state.ui.settingsForceSigilInput) return;
      const enabled = Boolean(getUiSetting("forceSigilEnabled"));
      if (!enabled) {
        state.ui.settingsForceSigilInput.value = "";
        setUiForcedSigilPercent(null);
        return;
      }
      const raw = cleanText(state.ui.settingsForceSigilInput.value);
      const normalized = normalizeUiForcedSigilPercent(raw);
      if (!Number.isFinite(normalized)) {
        state.ui.settingsForceSigilInput.value = "";
        setUiForcedSigilPercent(null);
        setStatus(
          state.ui,
          "Принудительный сигил: введи число от 0 до 100, например 17.",
        );
        return;
      }
      const changed = setUiForcedSigilPercent(normalized);
      state.ui.settingsForceSigilInput.value = String(normalized);
      if (changed) {
        setStatus(state.ui, `Принудительный сигил: ${normalized}%.`);
        renderActiveTab(state.ui);
      }
    };

    const closeOverlay = () => {
      closeHubDialog();
      closeSettingsDialog();
      state.nearestDialogState = { open: false, source: null };
      stopCountdownTicker();
      stopHubSyncLoop();
      stopMultiTabPresenceHeartbeat({ removeInstance: true });
      if (state.ui && state.ui.root) {
        state.ui.root.remove();
      }
      state.ui = null;
    };
    const backdrop = state.ui.root.querySelector(".smm-backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeOverlay);
    }
    if (state.ui.closeButton) {
      state.ui.closeButton.addEventListener("click", closeOverlay);
    }
    if (state.ui.refreshButton) {
      state.ui.refreshButton.addEventListener("click", () => {
        void refreshData();
      });
    }
    if (state.ui.settingsButton) {
      state.ui.settingsButton.addEventListener("click", () => {
        openSettingsDialog();
      });
    }
    if (state.ui.settingsDialogCloseButton) {
      state.ui.settingsDialogCloseButton.addEventListener("click", () => {
        closeSettingsDialog();
      });
    }
    if (state.ui.settingsDialog) {
      state.ui.settingsDialog.addEventListener("click", (event) => {
        if (event.target === state.ui.settingsDialog) {
          closeSettingsDialog();
        }
      });
    }
    if (Array.isArray(state.ui.settingsCheckboxes)) {
      state.ui.settingsCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const key = cleanText(
            checkbox && checkbox.getAttribute("data-setting-key"),
          );
          if (!key) return;
          const hubConnected = Boolean(
            cleanText(state.hubConnection && state.hubConnection.url),
          );
          if (key === "loadPlanFromHub" && !hubConnected) {
            checkbox.checked = false;
            syncSettingsDialogUi();
            setStatus(state.ui, "Сначала подключи хаб.");
            return;
          }
          const changed = setUiSetting(key, Boolean(checkbox.checked));
          syncSettingsDialogUi();
          if (!changed) return;
          if (key === "loadPlanFromHub") {
            if (checkbox.checked) {
              setStatus(state.ui, "Загрузка плана из хаба включена.");
              void loadHubPlanFromHubAsync({ force: true, silent: false });
            } else {
              setStatus(state.ui, "Загрузка плана из хаба выключена.");
            }
          } else if (key === "exchangeTribeAttacks") {
            if (!checkbox.checked) {
              clearHubTribeIncomings({ rerender: true });
              setStatus(state.ui, "Обмен племенными атаками выключен.");
            } else {
              if (hubConnected) {
                void loadHubTribeIncomingsAsync({ force: true, silent: false });
              }
              setStatus(state.ui, "Обмен племенными атаками включен.");
            }
          } else if (key === "forceSigilEnabled") {
            if (!checkbox.checked) {
              setUiForcedSigilPercent(null);
              setStatus(state.ui, "Принудительный сигил выключен.");
            } else {
              const currentValue = normalizeUiForcedSigilPercent(
                state.ui &&
                  state.ui.settingsForceSigilInput &&
                  state.ui.settingsForceSigilInput.value,
              );
              if (Number.isFinite(currentValue)) {
                setUiForcedSigilPercent(currentValue);
                setStatus(state.ui, `Принудительный сигил: ${currentValue}%.`);
              } else {
                setStatus(
                  state.ui,
                  "Принудительный сигил включен. Укажи значение в поле справа.",
                );
              }
            }
          } else if (key === "favoritesEnabled") {
            if (!checkbox.checked && state.activeTab === "favorites") {
              setActiveTab("incomings");
            }
            setStatus(
              state.ui,
              checkbox.checked
                ? "Вкладка «Избранное» включена."
                : "Вкладка «Избранное» выключена.",
            );
          } else {
            setStatus(state.ui, "Настройка сохранена.");
          }
          renderActiveTab(state.ui);
        });
      });
    }
    if (state.ui.settingsForceSigilInput) {
      state.ui.settingsForceSigilInput.addEventListener("input", () => {
        // Сохраняем сразу при вводе валидного значения,
        // чтобы переход на другой экран не терял принудительный сигил.
        const enabled = Boolean(getUiSetting("forceSigilEnabled"));
        if (!enabled) return;
        const raw = cleanText(state.ui.settingsForceSigilInput.value);
        const normalized = normalizeUiForcedSigilPercent(raw);
        if (!Number.isFinite(normalized)) return;
        const changed = setUiForcedSigilPercent(normalized);
        if (changed && state.ui && state.ui.settingsForceSigilInput) {
          renderActiveTab(state.ui);
        }
      });
      state.ui.settingsForceSigilInput.addEventListener(
        "change",
        applyForcedSigilFromInput,
      );
      state.ui.settingsForceSigilInput.addEventListener(
        "blur",
        applyForcedSigilFromInput,
      );
      state.ui.settingsForceSigilInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        applyForcedSigilFromInput();
      });
    }
    if (state.ui.settingsHubPollInput) {
      state.ui.settingsHubPollInput.addEventListener(
        "change",
        applyHubPollIntervalFromInput,
      );
      state.ui.settingsHubPollInput.addEventListener(
        "blur",
        applyHubPollIntervalFromInput,
      );
      state.ui.settingsHubPollInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        applyHubPollIntervalFromInput();
      });
    }
    if (state.ui.settingsNearestSliceWindowInput) {
      state.ui.settingsNearestSliceWindowInput.addEventListener(
        "change",
        applyNearestSliceWindowFromInput,
      );
      state.ui.settingsNearestSliceWindowInput.addEventListener(
        "blur",
        applyNearestSliceWindowFromInput,
      );
      state.ui.settingsNearestSliceWindowInput.addEventListener(
        "keydown",
        (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          applyNearestSliceWindowFromInput();
        },
      );
    }
    if (state.ui.resetHiddenIncomingsButton) {
      state.ui.resetHiddenIncomingsButton.addEventListener("click", () => {
        clearAllHiddenIncomings();
        clearAllHiddenVillageGroups();
        setStatus(state.ui, "Скрытые атаки и деревни очищены.");
        renderActiveTab(state.ui);
      });
    }
    if (
      !state.storageSyncListenerBound &&
      typeof window !== "undefined" &&
      window &&
      window.addEventListener
    ) {
      window.addEventListener("storage", (event) => {
        const key = cleanText(event && event.key);
        if (
          key &&
          key !== STORAGE_KEYS.scheduledCommands &&
          key !== STORAGE_KEYS.scheduledCommandsBackup &&
          key !== STORAGE_KEYS.scheduledCommandsSession &&
          key !== STORAGE_KEYS.planActions &&
          key !== STORAGE_KEYS.maneuversArchive &&
          key !== STORAGE_KEYS.uiSettings &&
          key !== STORAGE_KEYS.villageGroupSelection &&
          key !== STORAGE_KEYS.villageGroupOptions &&
          key !== STORAGE_KEYS.hiddenIncomings &&
          key !== STORAGE_KEYS.hiddenVillageGroups &&
          key !== STORAGE_KEYS.favorites
        ) {
          return;
        }
        if (
          key === STORAGE_KEYS.villageGroupSelection ||
          key === STORAGE_KEYS.villageGroupOptions
        ) {
          initVillageGroupState();
          syncAllVillageGroupSelects(document);
        }
        if (key === STORAGE_KEYS.hiddenIncomings) {
          loadHiddenIncomings();
        }
        if (key === STORAGE_KEYS.hiddenVillageGroups) {
          loadHiddenVillageGroups();
        }
        if (key === STORAGE_KEYS.favorites) {
          loadFavoriteEntries();
        }
        if (key === STORAGE_KEYS.uiSettings) {
          loadUiSettings();
          syncSettingsDialogUi();
        }
        state.planActions = loadPlanActions();
        loadArchivedManeuvers();
        syncScheduledCommandsFromStorage();
        if (!state.ui) return;
        if (state.activeTab === "incomings" || state.activeTab === "tribe") {
          requestIncomingsRerender("storage_sync");
          return;
        }
        if (
          state.activeTab === "plan" ||
          state.activeTab === "archive" ||
          state.activeTab === "favorites"
        ) {
          if (state.refreshInProgress) {
            if (state.activeTab === "plan") {
              state.pendingPlanRerender = true;
            }
            return;
          }
          renderActiveTab(state.ui);
        }
      });
      state.storageSyncListenerBound = true;
    }
    if (state.ui.hubDialogCloseButton) {
      state.ui.hubDialogCloseButton.addEventListener("click", () => {
        closeHubDialog();
      });
    }
    if (state.ui.hubDialog) {
      state.ui.hubDialog.addEventListener("click", (event) => {
        if (event.target === state.ui.hubDialog) {
          closeHubDialog();
        }
      });
    }
    if (state.ui.hubDialogConnectButton) {
      state.ui.hubDialogConnectButton.addEventListener("click", () => {
        const address = cleanText(
          state.ui &&
            state.ui.hubAddressInput &&
            state.ui.hubAddressInput.value,
        );
        if (!address) {
          setStatus(state.ui, "Хаб: укажи адрес перед подключением.");
          return;
        }
        saveHubConnection({
          url: address,
          mode: "connect",
          connectedAt: new Date(getServerNowMs()).toISOString(),
        });
        state.hubLastSyncError = null;
        state.hubLastSyncStats = null;
        state.hubLastSyncAtMs = null;
        state.hubLastCommandsFetchMs = 0;
        startHubSyncLoop();
        closeHubDialog();
        syncSettingsDialogUi();
        renderActiveTab(state.ui);
        setStatus(state.ui, `Хаб подключён: ${address}`);
      });
    }

    if (state.ui.tabs) {
      state.ui.tabs.addEventListener("click", (event) => {
        const tabButton = event.target.closest(".smm-tab");
        if (!tabButton) return;
        const tab = cleanText(tabButton.getAttribute("data-tab"));
        if (!tab || !TOP_TABS.includes(tab) || tab === state.activeTab) return;
        setActiveTab(tab);
        renderActiveTab(state.ui);
        setStatus(state.ui, `Вкладка: ${TOP_TAB_LABELS[tab] || tab}`);
      });
    }
    state.ui.root.addEventListener("click", async (event) => {
      const nearestOpenButton = event.target.closest(
        ".smm-nearest-open-btn[data-nearest-source]",
      );
      if (nearestOpenButton) {
        const source =
          cleanText(nearestOpenButton.getAttribute("data-nearest-source")) ||
          "incomings";
        void openNearestSlicesDialog({ source });
        return;
      }

      const nearestCloseButton = event.target.closest(".smm-nearest-close-btn");
      if (nearestCloseButton) {
        closeNearestSlicesDialog();
        setStatus(state.ui, "Ближайшие срезы закрыты.");
        return;
      }

      const nearestBackdrop = event.target.closest(
        ".smm-nearest-dialog-backdrop",
      );
      if (nearestBackdrop && event.target === nearestBackdrop) {
        closeNearestSlicesDialog();
        setStatus(state.ui, "Ближайшие срезы закрыты.");
        return;
      }

      const connectHubButton = event.target.closest(".smm-hub-connect-btn");
      if (connectHubButton) {
        openHubDialog();
        return;
      }

      const leaveHubButton = event.target.closest(".smm-hub-leave-btn");
      if (leaveHubButton) {
        const previousUrl = cleanText(
          state.hubConnection && state.hubConnection.url,
        );
        stopHubSyncLoop();
        clearHubConnection();
        clearHubQueryIncomings();
        clearHubOwnQueries();
        clearHubMassIncomings();
        clearHubTribeIncomings();
        state.hubLastSyncAtMs = null;
        state.hubLastSyncError = null;
        state.hubLastSyncStats = null;
        syncSettingsDialogUi();
        renderActiveTab(state.ui);
        setStatus(
          state.ui,
          previousUrl ? `Отключено от хаба: ${previousUrl}` : "Хаб отключён.",
        );
        return;
      }

      const deleteHubQueryButton = event.target.closest(
        ".smm-hub-query-del-btn[data-row-key]",
      );
      if (deleteHubQueryButton) {
        const rowKey = cleanText(
          deleteHubQueryButton.getAttribute("data-row-key"),
        );
        if (!rowKey) {
          setStatus(
            state.ui,
            "Не удалось определить строку запроса для удаления.",
          );
          return;
        }
        const connection = ensureHubConnectionLoaded();
        const hubUrl = cleanText(connection && connection.url);
        if (!hubUrl) {
          setStatus(state.ui, "Хаб не подключён.");
          return;
        }
        deleteHubQueryButton.disabled = true;
        const previousLabel = deleteHubQueryButton.textContent;
        deleteHubQueryButton.textContent = "Удаляем...";
        (async () => {
          try {
            const response = await deleteHubOwnQuery({
              hubUrl,
              hubId: getHubSyncId(connection),
              nick: getHubSyncNick(),
              rowKey,
            });
            const removed = Number(response && response.removed) || 0;
            if (removed > 0) {
              setStatus(state.ui, "Запрос удалён из хаба.");
              notifyHubStatus("Запрос удалён из хаба.", {
                success: true,
                timeoutMs: 1800,
                skipStatus: true,
              });
            } else {
              setStatus(state.ui, "Запрос не найден или уже удалён.");
            }
            await loadHubOwnQueriesAsync({ force: true, silent: true });
            void loadHubQueryIncomingsAsync({ force: true, silent: true });
          } catch (error) {
            setStatus(
              state.ui,
              `Ошибка удаления запроса: ${formatErrorText(error)}`,
            );
          } finally {
            deleteHubQueryButton.disabled = false;
            deleteHubQueryButton.textContent = previousLabel || "Удалить";
          }
        })();
        return;
      }

      const hideIncomingButton = event.target.closest(
        ".smm-hide-incoming-btn[data-hide-key]",
      );
      if (hideIncomingButton) {
        const hideKey = cleanText(
          hideIncomingButton.getAttribute("data-hide-key"),
        );
        if (!hideKey) {
          setStatus(state.ui, "Не удалось скрыть атаку: отсутствует ключ.");
          return;
        }
        const hidden = hideIncomingByKey(hideKey);
        if (!hidden) {
          setStatus(state.ui, "Атака уже скрыта.");
          return;
        }
        const hiddenIncomingId = cleanText(
          hideIncomingButton.getAttribute("data-incoming-id"),
        );
        if (
          hiddenIncomingId &&
          String(state.openIncomingId || "") === String(hiddenIncomingId)
        ) {
          state.openIncomingId = null;
        }
        setStatus(state.ui, "Атака скрыта.");
        renderActiveTab(state.ui);
        return;
      }
      const hideVillageButton = event.target.closest(
        ".smm-hide-village-btn[data-hide-village-key]",
      );
      if (hideVillageButton) {
        const hideVillageKey = cleanText(
          hideVillageButton.getAttribute("data-hide-village-key"),
        );
        if (!hideVillageKey) {
          setStatus(state.ui, "Не удалось скрыть деревню: отсутствует ключ.");
          return;
        }
        const hidden = hideVillageGroupByKey(hideVillageKey);
        if (!hidden) {
          setStatus(state.ui, "Деревня уже скрыта.");
          return;
        }
        state.openIncomingId = null;
        setStatus(state.ui, "Карточка деревни скрыта.");
        renderActiveTab(state.ui);
        return;
      }

      const unitToggleButton = event.target.closest(
        ".smm-unit-toggle[data-unit-toggle][data-unit]",
      );
      if (unitToggleButton) {
        const unit = cleanText(unitToggleButton.getAttribute("data-unit"));
        if (!unit) return;
        const isDisabled = toggleUnitDisabledForCalc(unit);
        const nearestDialog = event.target.closest(
          ".smm-nearest-dialog-backdrop",
        );
        if (nearestDialog) {
          const source =
            cleanText(nearestDialog.getAttribute("data-nearest-source")) ||
            (state.activeTab === "tribe" ? "tribe" : "incomings");
          void openNearestSlicesDialog({ source }).then((ok) => {
            if (ok) {
              setStatus(
                state.ui,
                `Ближайшие срезы: ${getUnitLabel(unit)} ${
                  isDisabled ? "выключен" : "включен"
                } в расчёте.`,
              );
            } else {
              setStatus(
                state.ui,
                "Не удалось пересчитать окно ближайших срезов.",
              );
            }
          });
          return;
        }
        rerenderOverlayAfterUnitToggle(unit, isDisabled);
        return;
      }

      const etaCopyNode = event.target.closest(".smm-eta[data-copy-time]");
      if (etaCopyNode) {
        const value = cleanText(etaCopyNode.getAttribute("data-copy-time"));
        if (!value) {
          setStatus(state.ui, "Не удалось извлечь время для копирования.");
          return;
        }
        copyTextToClipboard(value).then((ok) => {
          setStatus(
            state.ui,
            ok ? `Скопировано: ${value}` : "Не удалось скопировать время.",
          );
        });
        return;
      }

      const planTimingEditButton = event.target.closest(".smm-plan-timing-edit");
      if (planTimingEditButton) {
        maybeShowMultiTabWarning({ force: true, statusTarget: state.ui });
        const commandId = cleanText(
          planTimingEditButton.getAttribute("data-cmd-id") ||
            planTimingEditButton
              .closest(".smm-plan-cmd-row")
              ?.getAttribute("data-cmd-id"),
        );
        if (!commandId) {
          setStatus(state.ui, "Не удалось определить запись плана.");
          return;
        }
        syncScheduledCommandsFromStorage();
        const command = (
          Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
        )
          .map((item) => normalizeScheduledCommand(item))
          .find(
            (item) =>
              String(cleanText(item && item.id) || "") === String(commandId),
          );
        if (!command) {
          setStatus(state.ui, "Запись плана не найдена.");
          return;
        }
        const timing = safeResolveTimingForScheduledCommand(command);
        const timingResult = await askFavoriteCommentDialog({
          title: "Тайминг приказа:",
          inputLabel: "Тайминг (пусто = авторасчёт)",
          placeholder: "11:53:50:722-11:53:50:822",
          initialValue: cleanText(timing && timing.timingLabel) || "",
        });
        if (!timingResult || timingResult.canceled) {
          return;
        }
        const updatedCommand = updateScheduledCommandTimingById(
          commandId,
          timingResult.comment,
        );
        if (!updatedCommand) {
          setStatus(state.ui, "Не удалось обновить тайминг.");
          return;
        }
        state.hubPlanLastFingerprint = buildScheduledCommandsFingerprint(
          state.scheduledCommands,
        );
        renderActiveTab(state.ui);
        setStatus(
          state.ui,
          cleanText(updatedCommand.timingType) === "manual" &&
            cleanText(updatedCommand.timingLabel)
            ? "Тайминг обновлён."
            : "Тайминг возвращён к авторасчёту.",
        );
        return;
      }

      const timingCopyNode = event.target.closest(
        ".smm-plan-timing-copy[data-copy-time]",
      );
      if (timingCopyNode) {
        const value = cleanText(timingCopyNode.getAttribute("data-copy-time"));
        if (!value) {
          setStatus(state.ui, "Не удалось вычислить центр тайминга.");
          return;
        }
        copyTextToClipboard(value).then((ok) => {
          setStatus(
            state.ui,
            ok
              ? `Скопировано: ${value}`
              : "Не удалось скопировать центр тайминга.",
          );
        });
        return;
      }

      const hubOpenButton = event.target.closest(".smm-hub-open-btn");
      if (hubOpenButton) {
        const url = cleanText(hubOpenButton.getAttribute("data-url"));
        if (!url) {
          setStatus(state.ui, "В хабе нет ссылки для перехода.");
          return;
        }
        window.open(url, "_blank", "noopener");
        setStatus(state.ui, "Открыта площадь по записи из хаба.");
        return;
      }

      const planCommentEditButton = event.target.closest(".smm-plan-comment-edit");
      if (planCommentEditButton) {
        maybeShowMultiTabWarning({ force: true, statusTarget: state.ui });
        const commandId = cleanText(
          planCommentEditButton.getAttribute("data-cmd-id") ||
            planCommentEditButton
              .closest(".smm-plan-cmd-row")
              ?.getAttribute("data-cmd-id"),
        );
        if (!commandId) {
          setStatus(state.ui, "Не удалось определить запись плана.");
          return;
        }
        syncScheduledCommandsFromStorage();
        const command = (
          Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
        )
          .map((item) => normalizeScheduledCommand(item))
          .find(
            (item) =>
              String(cleanText(item && item.id) || "") === String(commandId),
          );
        if (!command) {
          setStatus(state.ui, "Запись плана не найдена.");
          return;
        }
        const commentResult = await askFavoriteCommentDialog({
          title: "Комментарий к приказу:",
          initialValue: cleanText(command.comment) || "",
        });
        if (!commentResult || commentResult.canceled) {
          return;
        }
        const updatedCommand = updateScheduledCommandCommentById(
          commandId,
          commentResult.comment,
        );
        if (!updatedCommand) {
          setStatus(state.ui, "Не удалось обновить комментарий.");
          return;
        }
        state.hubPlanLastFingerprint = buildScheduledCommandsFingerprint(
          state.scheduledCommands,
        );
        renderActiveTab(state.ui);
        setStatus(
          state.ui,
          cleanText(updatedCommand.comment)
            ? "Комментарий обновлён."
            : "Комментарий очищен.",
        );
        return;
      }

      const planGoButton = event.target.closest(".smm-plan-go-btn");
      if (planGoButton) {
        maybeShowMultiTabWarning({ force: true, statusTarget: state.ui });
        const commandId = cleanText(
          planGoButton.getAttribute("data-cmd-id") ||
            planGoButton
              .closest(".smm-plan-cmd-row")
              ?.getAttribute("data-cmd-id"),
        );
        let scheduledCommand = null;
        let url = cleanText(planGoButton.getAttribute("data-url"));
        syncScheduledCommandsFromStorage();
        scheduledCommand = (
          Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
        )
          .map((command) => normalizeScheduledCommand(command))
          .find(
            (command) =>
              command &&
              String(cleanText(command.id) || "") === String(commandId || ""),
          );
        if (scheduledCommand) {
          const freshUrl = cleanText(resolveScheduledCommandGoUrl(scheduledCommand));
          if (freshUrl) {
            url = freshUrl;
            planGoButton.setAttribute("data-url", freshUrl);
          }
        }
        if (!url) {
          setStatus(
            state.ui,
            "Для этого приказа нет корректной ссылки перехода. Обнови данные войск и попробуй снова.",
          );
          return;
        }
        const planWindowInfo =
          buildSliceTimingWindowFromPlanCommand(scheduledCommand);
        const shouldCheckSliceConflicts = Boolean(
          getUiSetting("checkSliceConflicts"),
        );
        const planConflictSummary = shouldCheckSliceConflicts
          ? await buildAllySliceConflictSummaryByWindowAsync(planWindowInfo, {
              source: "go_click_plan",
            })
          : null;
        const fullDump = buildSliceConflictFullDebugDump(planWindowInfo);
        if (typeof window !== "undefined") {
          window.__smmSliceConflictDebugLast = fullDump;
        }
        logSliceConflictDebug("go_click_plan", {
          commandId: commandId || null,
          action: cleanText(scheduledCommand && scheduledCommand.action) || null,
          targetCoord:
            cleanText(scheduledCommand && scheduledCommand.targetCoord) || null,
          hasUrl: Boolean(url),
          conflictFound: Boolean(planConflictSummary),
          debug: buildSliceConflictDebugSnapshot(planWindowInfo),
        });
        logSliceConflictDebug("go_click_plan_full", fullDump);
        if (planConflictSummary) {
          const favoriteId = resolveFavoriteEntryIdByIncomingId(
            cleanText(scheduledCommand && scheduledCommand.incomingId),
          );
          const decision = await askSliceConflictProceedDialog({
            summary:
              planConflictSummary && typeof planConflictSummary === "object"
                ? { ...planConflictSummary, favoriteId }
                : planConflictSummary,
          });
          if (!decision || !decision.accepted) {
            if (decision && decision.favoriteId) {
              if (state.activeTab === "favorites") {
                renderActiveTab(state.ui);
              }
              setStatus(
                state.ui,
                decision.favoriteRemoved
                  ? "Удалено из избранного. Отправка отменена."
                  : "Отправка отменена: запись в избранном не найдена.",
              );
              return;
            }
            setStatus(
              state.ui,
              "Отправка отменена: в это окно уже идёт срез соплеменников.",
            );
            return;
          }
        }
        const freshTiming = scheduledCommand
          ? safeResolveTimingForScheduledCommand(scheduledCommand)
          : null;
        const timingCenter =
          safeComputeTimingCenterCopyValue(freshTiming) ||
          cleanText(planGoButton.getAttribute("data-copy-time"));
        if (timingCenter) {
          planGoButton.setAttribute("data-copy-time", timingCenter);
        }
        if (DEBUG_VERBOSE_LOGS) {
          console.info(`${LOG_PREFIX} [plan-go][fresh-timing]`, {
            version: VERSION,
            commandId: commandId || null,
            timingCenter: timingCenter || null,
            timingType: cleanText(freshTiming && freshTiming.timingType) || null,
            timingLabel: cleanText(freshTiming && freshTiming.timingLabel) || null,
            timingStartMs: toFiniteMs(freshTiming && freshTiming.timingStartMs),
            timingEndMs: toFiniteMs(freshTiming && freshTiming.timingEndMs),
            timingPointMs: toFiniteMs(freshTiming && freshTiming.timingPointMs),
            hasScheduledCommand: Boolean(scheduledCommand),
            hasFreshUrl: Boolean(
              scheduledCommand && resolveScheduledCommandGoUrl(scheduledCommand),
            ),
          });
        }
        if (timingCenter) {
          appendTimingCopyHistory({
            timingCenter,
            source: "go_click_plan",
            action:
              cleanText(scheduledCommand && scheduledCommand.action) || null,
            incomingId:
              cleanText(scheduledCommand && scheduledCommand.incomingId) || null,
            commandId: cleanText(scheduledCommand && scheduledCommand.id) || null,
            fromVillageCoord:
              cleanText(scheduledCommand && scheduledCommand.fromVillageCoord) ||
              null,
            targetCoord:
              cleanText(scheduledCommand && scheduledCommand.targetCoord) || null,
            goUrl: url || null,
          });
        }
        const copiedSync = timingCenter
          ? copyTextToClipboardSync(timingCenter)
          : false;
        const bridgeResult = writeAutoDispatchBridgeForCommand({
          command: scheduledCommand,
          url,
          timingCenter,
        });
        const openUrl =
          bridgeResult && bridgeResult.payload
            ? appendAutoDispatchParamsToUrl(url, bridgeResult.payload)
            : url;
        window.open(openUrl, "_blank", "noopener");
        if (timingCenter) {
          if (copiedSync) {
            setStatus(
              state.ui,
              `Открыта площадь. Центр тайминга скопирован: ${timingCenter}${
                bridgeResult && bridgeResult.ok ? ". Автоотправка подготовлена." : ""
              }`,
            );
            return;
          }
          copyTextToClipboard(timingCenter).then((ok) => {
            setStatus(
              state.ui,
              ok
                ? `Открыта площадь. Центр тайминга скопирован: ${timingCenter}${
                    bridgeResult && bridgeResult.ok
                      ? ". Автоотправка подготовлена."
                      : ""
                  }`
                : `Открыта площадь. Не удалось скопировать центр тайминга: ${timingCenter}`,
            );
          });
          return;
        }
        setStatus(
          state.ui,
          `Открыта площадь по запланированному приказу${
            bridgeResult && bridgeResult.ok ? ". Автоотправка подготовлена." : ""
          }`,
        );
        return;
      }

      const planDeleteButton = event.target.closest(".smm-plan-del-btn");
      if (planDeleteButton) {
        maybeShowMultiTabWarning({ force: true, statusTarget: state.ui });
        const commandId = cleanText(
          planDeleteButton.getAttribute("data-cmd-id"),
        );
        if (!commandId) {
          setStatus(state.ui, "Не удалось определить приказ для удаления.");
          return;
        }
        syncScheduledCommandsFromStorage();
        const before = Array.isArray(state.scheduledCommands)
          ? state.scheduledCommands.length
          : 0;
        state.scheduledCommands = (
          Array.isArray(state.scheduledCommands) ? state.scheduledCommands : []
        ).filter((command) => String(command.id) !== String(commandId));
        saveScheduledCommands("delete");
        renderActiveTab(state.ui);
        const removed = before - state.scheduledCommands.length;
        if (removed <= 0) {
          setStatus(state.ui, "Приказ не найден в плане.");
          return;
        }
        setStatus(state.ui, "Приказ удалён из плана.");

        const connection = ensureHubConnectionLoaded();
        const hubUrl = cleanText(connection && connection.url);
        if (!hubUrl) {
          return;
        }
        (async () => {
          try {
            const response = await deleteHubOwnPlan({
              hubUrl,
              hubId: getHubSyncId(connection),
              nick: getHubSyncNick(),
              planId: commandId,
            });
            const removedHub = Number(response && response.removed) || 0;
            if (removedHub > 0) {
              setStatus(state.ui, "Приказ удалён из плана и хаба.");
            } else {
              setStatus(
                state.ui,
                "Приказ удалён из плана. В хабе запись не найдена.",
              );
            }
            if (getUiSetting("loadPlanFromHub")) {
              void loadHubPlanFromHubAsync({ force: true, silent: true });
            }
          } catch (error) {
            setStatus(
              state.ui,
              `Приказ удалён из плана, но не удалён из хаба: ${formatErrorText(error)}`,
            );
          }
        })();
        return;
      }

      const hubButton = event.target.closest(".smm-hub-btn");
      if (hubButton) {
        const row = hubButton.closest(".smm-slice-row");
        if (!row) return;
        const selection = collectSliceRowSelection(row);
        const unitKeys = Object.keys(selection.units || {});
        if (!unitKeys.length) {
          setStatus(state.ui, "Выбери войска, чтобы добавить строку в Хаб.");
          return;
        }
        const incomingId = cleanText(row.getAttribute("data-incoming-id"));
        const action = cleanText(row.getAttribute("data-action")) || "slice";
        const goUrl = cleanText(
          row.querySelector(".smm-go-btn")?.getAttribute("data-url"),
        );
        state.hubEntries.push({
          incomingId,
          action,
          actionLabel: PLAN_ACTION_LABELS[action] || action,
          villageCoord:
            cleanText(row.getAttribute("data-village-coord")) || "?",
          targetCoord: cleanText(row.getAttribute("data-target-coord")) || "?",
          units: selection.units,
          departureMs: Number.isFinite(selection.departureMs)
            ? selection.departureMs
            : null,
          goUrl: goUrl || null,
          addedAt: new Date(getServerNowMs()).toISOString(),
        });
        if (state.hubEntries.length > 500) {
          state.hubEntries.splice(0, state.hubEntries.length - 500);
        }
        setStatus(
          state.ui,
          `Добавлено в Хаб: #${incomingId || "?"}, юнитов ${unitKeys.length}.`,
        );
        return;
      }

      const scheduleButton = event.target.closest(".smm-schedule-btn");
      if (scheduleButton) {
        event.preventDefault();
        event.stopPropagation();
        maybeShowMultiTabWarning({ force: true, statusTarget: state.ui });
        try {
          const row = scheduleButton.closest(".smm-slice-row");
          if (!row) return;
          syncScheduledCommandsFromStorage();
          updateSliceRowState(row);
          const selection = collectSliceRowSelection(row);
          const units = selection.units || {};
          const unitKeys = Object.keys(units);
          const departureMs = Number(
            getSliceRowDisplayedDepartureMs(row, selection.departureMs),
          );
          if (!unitKeys.length || !Number.isFinite(departureMs)) {
            setStatus(
              state.ui,
              "Нельзя запланировать: выбери юниты, которые успевают.",
            );
            return;
          }

          const fromVillageId = cleanText(row.getAttribute("data-village-id"));
          const fromVillageCoord = cleanText(
            row.getAttribute("data-village-coord"),
          );
          const targetCoord = cleanText(row.getAttribute("data-target-coord"));
          const incomingId = cleanText(row.getAttribute("data-incoming-id"));
          const fallbackIncoming = getIncomingById(incomingId);
          const incomingEtaMs = Number(row.getAttribute("data-eta-ms"));
          const action = cleanText(row.getAttribute("data-action")) || "slice";
          const sigilPercent = actionUsesSigil(action)
            ? selectPreferredPositiveSigilPercent(
                toNumber(row.querySelector(".smm-sigil-input")?.value),
                toNumber(cleanText(row.getAttribute("data-default-sigil"))),
                getIncomingSigilPercent(fallbackIncoming),
                getForumThreadFirstPostSigilPercent(document),
              ) || 0
            : null;
          if (DEBUG_VERBOSE_LOGS) {
            console.info(`${LOG_PREFIX} [plan-schedule][click]`, {
              version: VERSION,
              source: "overlay",
              fromVillageId,
              fromVillageCoord,
              targetCoord,
              incomingId,
              incomingEtaMs: Number.isFinite(incomingEtaMs)
                ? Math.round(incomingEtaMs)
                : null,
              action,
              departureMs: Number.isFinite(departureMs)
                ? Math.round(departureMs)
                : null,
              sigilPercent,
              units,
            });
          }
          let plannerComment = null;
          if (getUiSetting("plannerCommentEnabled")) {
            const commentResult = await askFavoriteCommentDialog({
              title: "Добавь комментарий:",
            });
            if (!commentResult || commentResult.canceled) {
              setStatus(state.ui, "Планирование отменено.");
              return;
            }
            plannerComment = cleanText(commentResult.comment) || null;
          }
          const timing = buildTimingPayload({
            action,
            incomingId,
            targetCoord,
            incomingEtaMs,
            units,
          });
          const goUrl = cleanText(
            row.querySelector(".smm-go-btn")?.getAttribute("data-url"),
          );
          const normalized = normalizeScheduledCommand({
            id: createScheduledCommandId(),
            createdAtMs: getServerNowMs(),
            fromVillageId,
            fromVillageCoord,
            targetVillageId:
              cleanText(fallbackIncoming && fallbackIncoming.targetVillageId) ||
              null,
            targetCoord,
            incomingId,
            incomingEtaMs,
            action,
            actionLabel: PLAN_ACTION_LABELS[action] || action,
            timingType: timing.timingType,
            timingLabel: timing.timingLabel,
            timingGapMs: timing.timingGapMs,
            timingStartMs: timing.timingStartMs,
            timingEndMs: timing.timingEndMs,
            timingPointMs: timing.timingPointMs,
            sigilPercent,
            departureMs,
            units,
            comment: plannerComment,
            goUrl,
          });
          if (!normalized) {
            console.warn(`${LOG_PREFIX} [plan-schedule][normalize_failed]`, {
              version: VERSION,
              source: "overlay",
              fromVillageId,
              fromVillageCoord,
              targetCoord,
              incomingId,
              action,
              departureMs,
              units,
            });
            setStatus(state.ui, "Не удалось сохранить приказ в план.");
            return;
          }

          const duplicateAccepted = await confirmLocalScheduledDuplicate(
            normalized,
          );
          if (!duplicateAccepted) {
            setStatus(
              state.ui,
              "Планирование отменено: на эту цель и окно уже есть отправка.",
            );
            return;
          }
          const savedCommand = upsertScheduledCommandWithStorageSync(normalized);
          if (!savedCommand) {
            setStatus(state.ui, "Не удалось сохранить приказ в план.");
            return;
          }
          state.hubPlanLastFingerprint = buildScheduledCommandsFingerprint(
            state.scheduledCommands,
          );
          const nearestDialog =
            state.ui &&
            state.ui.root &&
            state.ui.root.querySelector(".smm-nearest-dialog-backdrop");
          if (state.ui) {
            if (nearestDialog) {
              const nearestSource =
                cleanText(nearestDialog.getAttribute("data-nearest-source")) ||
                cleanText(
                  state.nearestDialogState && state.nearestDialogState.source,
                ) ||
                "incomings";
              renderActiveTab(state.ui);
              await openNearestSlicesDialog({ source: nearestSource });
            } else {
              renderActiveTab(state.ui);
            }
          }
          setStatus(
            state.ui,
            `Запланировано: ${savedCommand.fromVillageCoord || savedCommand.fromVillageId || "?"} → ${
              savedCommand.targetCoord || "?"
            }, юнитов ${unitKeys.length}.${plannerComment ? " Комментарий сохранён." : ""}`,
          );
          return;
        } catch (error) {
          setStatus(
            state.ui,
            `Ошибка планирования: ${formatErrorText(error)}`,
          );
          safe(() => {
            console.error("[ScriptMM][schedule][nearest]", error);
            return true;
          }, false);
          return;
        }
      }

      const goButton = event.target.closest(".smm-go-btn");
      if (
        goButton &&
        !event.target.closest(".smm-plan-go-btn") &&
        !event.target.closest(".smm-schedule-btn") &&
        !event.target.closest(".smm-hub-btn")
      ) {
        const row = goButton.closest(".smm-slice-row");
        const windowInfo = buildSliceTimingWindowFromRow(row);
        const debugSnapshot = buildSliceConflictDebugSnapshot(windowInfo);
        let url = cleanText(goButton.getAttribute("data-url"));
        if (!url && row) {
          url = cleanText(resolveSliceRowGoUrl(row));
          if (url) {
            goButton.setAttribute("data-url", url);
          }
        }
        if (!url) {
          setStatus(
            state.ui,
            "Выбери войска, которые успевают, чтобы сформировать приказ.",
          );
          return;
        }
        const shouldCheckSliceConflicts = Boolean(
          getUiSetting("checkSliceConflicts"),
        );
        const conflictSummary = shouldCheckSliceConflicts
          ? await buildAllySliceConflictSummaryByWindowAsync(windowInfo, {
              source: "go_click_main_overlay",
            })
          : null;
        const fullDump = buildSliceConflictFullDebugDump(windowInfo);
        if (typeof window !== "undefined") {
          window.__smmSliceConflictDebugLast = fullDump;
        }
        logSliceConflictDebug("go_click_main_overlay", {
          action: cleanText(row && row.getAttribute("data-action")) || null,
          incomingId: cleanText(row && row.getAttribute("data-incoming-id")) || null,
          targetCoord:
            cleanText(row && row.getAttribute("data-target-coord")) || null,
          hasUrl: Boolean(url),
          conflictFound: Boolean(conflictSummary),
          debug: debugSnapshot,
        });
        logSliceConflictDebug("go_click_main_overlay_full", fullDump);
        if (conflictSummary) {
          const favoriteId = resolveFavoriteEntryIdByIncomingId(
            cleanText(row && row.getAttribute("data-incoming-id")),
          );
          const decision = await askSliceConflictProceedDialog({
            summary:
              conflictSummary && typeof conflictSummary === "object"
                ? { ...conflictSummary, favoriteId }
                : conflictSummary,
          });
          if (!decision || !decision.accepted) {
            if (decision && decision.favoriteId) {
              if (state.activeTab === "favorites") {
                renderActiveTab(state.ui);
              }
              setStatus(
                state.ui,
                decision.favoriteRemoved
                  ? "Удалено из избранного. Отправка отменена."
                  : "Отправка отменена: запись в избранном не найдена.",
              );
              return;
            }
            setStatus(
              state.ui,
              "Отправка отменена: в это окно уже идёт срез соплеменников.",
            );
            return;
          }
        }
        const timingCenter =
          getSliceRowTimingCenterCopyValue(row) ||
          cleanText(goButton.getAttribute("data-copy-time"));
        if (timingCenter) {
          appendTimingCopyHistory({
            timingCenter,
            source: "go_click_main_overlay",
            action: cleanText(row && row.getAttribute("data-action")) || null,
            incomingId:
              cleanText(row && row.getAttribute("data-incoming-id")) || null,
            fromVillageCoord:
              cleanText(row && row.getAttribute("data-village-coord")) || null,
            targetCoord:
              cleanText(row && row.getAttribute("data-target-coord")) || null,
            goUrl: url || null,
          });
        }
        const copiedSync = timingCenter
          ? copyTextToClipboardSync(timingCenter)
          : false;
        window.open(url, "_blank", "noopener");
        if (timingCenter) {
          if (copiedSync) {
            setStatus(
              state.ui,
              `Открыта площадь. Центр тайминга скопирован: ${timingCenter}`,
            );
            return;
          }
          copyTextToClipboard(timingCenter).then((ok) => {
            setStatus(
              state.ui,
              ok
                ? `Открыта площадь. Центр тайминга скопирован: ${timingCenter}`
                : `Открыта площадь. Не удалось скопировать центр тайминга: ${timingCenter}`,
            );
          });
        } else {
          setStatus(
            state.ui,
            "Открыта площадь с подставленными координатами и войсками.",
          );
        }
        return;
      }

      const favoriteButton = event.target.closest(
        ".smm-favorite-btn[data-incoming-id]",
      );
      if (favoriteButton) {
        const incomingId = cleanText(
          favoriteButton.getAttribute("data-incoming-id"),
        );
        if (!incomingId) {
          setStatus(state.ui, "Не удалось определить атаку для избранного.");
          return;
        }
        const incoming = getIncomingById(incomingId);
        if (!incoming) {
          setStatus(state.ui, "Атака не найдена.");
          return;
        }
        const commentResult = await askFavoriteCommentDialog({
          title: "Добавить в избранное",
        });
        if (!commentResult || commentResult.canceled) return;
        const comment = commentResult.comment;
        const result = addIncomingToFavorites({
          incoming,
          comment,
          sigilPercent: resolveSigilPercentForAction("slice", incoming),
        });
        if (!result || !result.ok) {
          setStatus(state.ui, "Не удалось добавить в избранное.");
          return;
        }
        if (state.activeTab === "favorites") {
          renderActiveTab(state.ui);
        }
        setStatus(
          state.ui,
          result.updated ? "Избранное обновлено." : "Добавлено в избранное.",
        );
        return;
      }
      const favoriteDeleteButton = event.target.closest(
        ".smm-favorite-del-btn[data-favorite-id]",
      );
      if (favoriteDeleteButton) {
        const favoriteId = cleanText(
          favoriteDeleteButton.getAttribute("data-favorite-id"),
        );
        if (!favoriteId) {
          setStatus(state.ui, "Не удалось определить избранную атаку.");
          return;
        }
        const removed = removeFavoriteEntryById(favoriteId);
        if (!removed) {
          setStatus(state.ui, "Запись в избранном уже удалена.");
          return;
        }
        if (state.activeTab === "favorites") {
          renderActiveTab(state.ui);
        }
        setStatus(state.ui, "Удалено из избранного.");
        return;
      }

      const target = event.target.closest(".smm-plan-btn");
      if (!target) return;
      if (target.classList.contains("smm-open-hub-btn")) {
        const incomingIdForHub = cleanText(
          target.getAttribute("data-incoming-id"),
        );
        void sendIncomingTimingToHubQuery({
          incomingId: incomingIdForHub,
          source: "overlay_buttons",
        });
        return;
      }

      const incomingId = cleanText(target.getAttribute("data-incoming-id"));
      const action = cleanText(target.getAttribute("data-action"));
      const sourceTab =
        cleanText(target.getAttribute("data-source-tab")) ||
        (state.activeTab === "favorites" ? "favorites" : null);
      activateIncomingPlanAction(incomingId, action, null, sourceTab);
    });

    state.ui.root.addEventListener("input", (event) => {
      const tribeSearchInput = event.target.closest(".smm-tribe-search-input");
      if (tribeSearchInput) {
        state.tribeSearchQuery = cleanText(tribeSearchInput.value) || "";
        if (state.activeTab === "tribe") {
          renderTribeTab(state.ui);
        }
        return;
      }
      const tribeFilterToggle = event.target.closest(".smm-tribe-filter-toggle");
      if (tribeFilterToggle) {
        const filterKey = cleanText(
          tribeFilterToggle.getAttribute("data-filter"),
        );
        const checked = Boolean(tribeFilterToggle.checked);
        if (filterKey === "noble") state.tribeFilterNoble = checked;
        if (filterKey === "large") state.tribeFilterLarge = checked;
        if (filterKey === "medium") state.tribeFilterMedium = checked;
        if (state.activeTab === "tribe") {
          renderTribeTab(state.ui);
        }
        return;
      }
      const scale = event.target.closest(".smm-row-scale");
      if (scale) {
        const row = scale.closest(".smm-slice-row");
        if (!row) return;
        applyRowScaleToInputs(row);
        updateSliceRowState(row);
        updateCountdownNodes();
        return;
      }

      const input = event.target.closest(".smm-slice-input, .smm-sigil-input");
      if (!input) return;
      const row = input.closest(".smm-slice-row");
      if (!row) return;
      updateSliceRowState(row);
      updateCountdownNodes();
    });
    state.ui.root.addEventListener("change", (event) => {
      const tribeOwnerSelect = event.target.closest(".smm-tribe-owner-select");
      if (tribeOwnerSelect) {
        const nextOwnerNick =
          normalizeNickKey(tribeOwnerSelect.value) || "all";
        state.tribeOwnerNickFilter = nextOwnerNick;
        if (state.activeTab === "tribe") {
          renderTribeTab(state.ui);
        }
        return;
      }
      const groupSelect = event.target.closest(
        'select[data-village-group-select="1"]',
      );
      if (!groupSelect) return;
      const nextGroupId = normalizeVillageGroupId(groupSelect.value);
      const nearestSource =
        cleanText(groupSelect.getAttribute("data-nearest-source")) ||
        cleanText(
          safe(
            () =>
              groupSelect
                .closest(".smm-nearest-dialog-backdrop")
                .getAttribute("data-nearest-source"),
            null,
          ),
        ) ||
        null;
      groupSelect.disabled = true;
      (async () => {
        try {
          const changedResult = await switchVillageGroupAndReloadTroops({
            nextGroupId,
            statusTarget: state.ui,
          });
          if (!changedResult.changed) {
            setStatus(
              state.ui,
              `Группа «${changedResult.groupLabel}» уже выбрана.`,
            );
            syncAllVillageGroupSelects(document);
            return;
          }
          const statusText = `Группа «${changedResult.groupLabel}»: загружено деревень ${changedResult.villagesCount}.`;
          renderMeta(state.ui, state.snapshot);
          renderActiveTab(state.ui);
          if (nearestSource) {
            await openNearestSlicesDialog({ source: nearestSource });
          }
          setStatus(state.ui, statusText);
          rerenderAllMessageInlinePanels(statusText);
        } catch (error) {
          const text = cleanText(error && error.message) || "unknown";
          setStatus(state.ui, `Ошибка загрузки группы: ${text}`);
        } finally {
          syncAllVillageGroupSelects(document);
          groupSelect.disabled = false;
        }
      })();
    });

    // Старт цикла хаба переносим на этап после первичной загрузки "Входящих"
    // (см. refreshData), чтобы хаб не забивал очередь fetch при старте.
  };

  const messagePlanningScreen = isMessagePlanningScreen();
  const useMessageInlineScenario = shouldUseMessageInlineScenario();
  const externalOnlyMode = Boolean(window.__ScriptMMExternalOnly);
  if (!externalOnlyMode) {
    startMultiTabPresenceHeartbeat();
  }
  ensureMessageActionListenerBound();
  if (!externalOnlyMode) {
    if (messagePlanningScreen && useMessageInlineScenario) {
      bootstrapMessageInlinePlanning();
    } else {
      if (messagePlanningScreen) {
        state.messageMode = false;
        clearMessageInlineActionButtons();
      }
      initUi();
      setTimeout(() => {
        void refreshData();
      }, 0);
    }
  }

  window.ScriptMM = {
    version: VERSION,
    refresh: refreshData,
    storageKeys: STORAGE_KEYS,
    getTimingCopyHistory: () => loadTimingCopyHistory(),
    getMessageParserDebug: () => {
      const payload = parseMessagePlanningPayload(document);
      const dumpItems =
        payload && payload.dump && Array.isArray(payload.dump.items)
          ? payload.dump.items
          : [];
      const anchors =
        payload && Array.isArray(payload.anchors) ? payload.anchors : [];
      return {
        url: location.href,
        isMessagePlanningScreen: isMessagePlanningScreen(),
        itemsCount: dumpItems.length,
        anchorsCount: anchors.length,
        sampleItems: dumpItems.slice(0, 5).map((item) => ({
          id: item && item.id,
          originCoord: item && item.originCoord,
          targetCoord: item && item.targetCoord,
          arrivalText: item && item.arrivalText,
          arrivalMs: item && item.arrivalMs,
        })),
        sampleAnchors: anchors.slice(0, 5).map((anchor) => ({
          incomingId: anchor && anchor.incomingId,
          timeToken: anchor && anchor.timeToken,
          originCoord: anchor && anchor.originCoord,
          targetCoord: anchor && anchor.targetCoord,
          hasSourceNode: Boolean(
            anchor && anchor.sourceNode && anchor.sourceNode.isConnected,
          ),
          hasHost: Boolean(
            anchor && anchor.hostElement && anchor.hostElement.isConnected,
          ),
          line: anchor && anchor.line,
        })),
      };
    },
    getOwnCommands: () => {
      const dump = state.overviewCommandsDump;
      return dump && Array.isArray(dump.items) ? dump.items : [];
    },
    getDefenseDebug: () => {
      const defenseTroopsModel =
        state.troopsDefense &&
        Array.isArray(state.troopsDefense.villages) &&
        state.troopsDefense.villages.length
          ? state.troopsDefense
          : state.troops;
      const map = buildIncomingDefenseAssessmentMap({
        incomings: state.incomings,
        troops: defenseTroopsModel,
        supportIncomings: state.supportIncomings,
        overviewCommands: state.overviewCommandsDump,
      });
      const items =
        state.incomings && Array.isArray(state.incomings.items)
          ? state.incomings.items
          : [];
      return items.map((item) => {
        const id = String((item && item.id) || "");
        return {
          id,
          type: getIncomingTypeKey(item),
          threatType: getIncomingThreatType(item),
          targetCoord: item && item.targetCoord,
          targetVillageId: item && item.targetVillageId,
          player: item && item.player,
          playerId: item && item.playerId,
          assessment: map.get(id) || null,
        };
      });
    },
    getIncomingsEtaDebug: () => {
      const items =
        state.incomings && Array.isArray(state.incomings.items)
          ? state.incomings.items
          : [];
      return items.map((item) => ({
        id: cleanText(item && item.id) || null,
        type:
          cleanText(item && item.displayType) ||
          cleanText(item && item.commandType) ||
          null,
        targetCoord:
          cleanText(item && (item.targetCoord || item.target)) || null,
        arrivalText: cleanText(item && item.arrivalText) || null,
        arrivalMs: Number.isFinite(Number(item && item.arrivalMs))
          ? Number(item.arrivalMs)
          : null,
        timerText: cleanText(item && item.timerText) || null,
        timerSeconds: Number.isFinite(Number(item && item.timerSeconds))
          ? Number(item.timerSeconds)
          : null,
        etaEpochMs: Number.isFinite(toFiniteEpochMs(item && item.etaEpochMs))
          ? toFiniteEpochMs(item.etaEpochMs)
          : null,
        etaIso: Number.isFinite(toFiniteEpochMs(item && item.etaEpochMs))
          ? new Date(toFiniteEpochMs(item.etaEpochMs)).toISOString()
          : null,
        arrivalEpochSource: cleanText(item && item.arrivalEpochSource) || null,
      }));
    },
    getForumAutoFavoritesDebug: () => {
      const uiSettings = normalizeUiSettings(readJson(STORAGE_KEYS.uiSettings));
      const payload = parseMessagePlanningPayload(document);
      const dumpItems =
        payload && payload.dump && Array.isArray(payload.dump.items)
          ? payload.dump.items
          : [];
      const hints = parseForumSliceAutoFavoriteHints(document);
      return {
        url: location.href,
        isForumThreadPlanningScreen: isForumThreadPlanningScreen(),
        favoritesEnabled: Boolean(uiSettings && uiSettings.favoritesEnabled),
        parseDebug: cloneSerializable(state.forumAutoFavoriteParseDebug, null),
        parsedHints: hints.length,
        sampleHints: hints.slice(0, 10),
        parsedIncomingItems: dumpItems.length,
      };
    },
    getState: () => state,
    renderSpotlightPlanPanel,
  };
})();

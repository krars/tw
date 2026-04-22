(() => {
  "use strict";

  const SCRIPT_KEY = "__scriptmmVillageSpotlight";
  const STYLE_ID = "scriptmm-village-spotlight-style";
  const ROOT_ID = "scriptmm-village-spotlight-root";
  const LOAD_ENDPOINT = "/map/village.txt";

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
    loadPromise: null,
    rootEl: null,
    inputEl: null,
    statusEl: null,
    resultEl: null,
    visible: false,
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
    const text = String(value == null ? "" : value).trim();
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
      playerId: Number.isFinite(playerId) && playerId >= 0 ? String(playerId) : "0",
      points: Number.isFinite(points) ? points : 0,
      rank: Number.isFinite(rank) ? rank : 0,
    };
  };

  const setStatus = (text, type = "muted") => {
    if (!state.statusEl) return;
    state.statusEl.textContent = cleanText(text) || "";
    state.statusEl.setAttribute("data-svs-status", cleanText(type) || "muted");
  };

  const renderIdle = () => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML =
      '<div class="svs-empty">Введи координаты в формате <code>454|435</code>.</div>';
  };

  const renderNotFound = (coordKey) => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML = `
      <div class="svs-empty">
        Для <code>${escapeHtml(coordKey)}</code> деревня не найдена.
      </div>
    `;
  };

  const renderInvalid = () => {
    if (!state.resultEl) return;
    state.resultEl.innerHTML =
      '<div class="svs-empty">Нужен формат <code>xxx|yyy</code>.</div>';
  };

  const renderVillage = (village) => {
    if (!state.resultEl || !village) return;
    const ownerText =
      village.playerId === "0" ? "0 (варварская деревня)" : village.playerId;

    state.resultEl.innerHTML = `
      <div class="svs-card">
        <div class="svs-card-title">${escapeHtml(village.name)}</div>
        <div class="svs-card-coord">${escapeHtml(village.coord)}</div>
        <div class="svs-grid">
          <div class="svs-label">ID деревни</div>
          <div class="svs-value">${escapeHtml(village.id)}</div>
          <div class="svs-label">ID игрока</div>
          <div class="svs-value">${escapeHtml(ownerText)}</div>
        </div>
      </div>
    `;
  };

  const updateResult = () => {
    if (!state.inputEl) return;
    const value = cleanText(state.inputEl.value);
    if (!value) {
      renderIdle();
      return;
    }
    const coord = parseCoordInput(value);
    if (!coord) {
      renderInvalid();
      return;
    }
    const village = state.villagesByCoord.get(coord.key);
    if (!village) {
      renderNotFound(coord.key);
      return;
    }
    renderVillage(village);
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${ROOT_ID}{position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Trebuchet MS,Segoe UI,sans-serif}
#${ROOT_ID}[hidden]{display:none}
#${ROOT_ID} .svs-backdrop{position:absolute;inset:0;background:radial-gradient(circle at center,rgba(255,215,146,.18),transparent 28%),rgba(9,12,18,.62);backdrop-filter:blur(5px)}
#${ROOT_ID} .svs-panel{position:relative;width:min(640px,92vw);padding:22px 22px 18px;border:1px solid rgba(236,201,130,.72);border-radius:18px;background:linear-gradient(180deg,rgba(34,27,19,.98) 0%,rgba(21,17,12,.98) 100%);box-shadow:0 26px 90px rgba(0,0,0,.46);color:#f8ecd0}
#${ROOT_ID} .svs-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
#${ROOT_ID} .svs-title{font-size:24px;line-height:1;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#f8d48e}
#${ROOT_ID} .svs-subtitle{margin-top:6px;font-size:12px;line-height:1.35;color:#d6c5a4}
#${ROOT_ID} .svs-close{width:34px;height:34px;border:1px solid rgba(236,201,130,.45);border-radius:10px;background:rgba(255,255,255,.04);color:#f8ecd0;font-size:20px;line-height:1;cursor:pointer}
#${ROOT_ID} .svs-close:hover{background:rgba(255,255,255,.09)}
#${ROOT_ID} .svs-input-wrap{position:relative}
#${ROOT_ID} .svs-input{width:100%;box-sizing:border-box;border:1px solid rgba(236,201,130,.45);border-radius:14px;padding:18px 20px;background:rgba(255,248,231,.06);color:#fff6e5;font-size:28px;line-height:1.1;font-weight:700;letter-spacing:.04em;outline:none}
#${ROOT_ID} .svs-input::placeholder{color:rgba(248,236,208,.34)}
#${ROOT_ID} .svs-input:focus{border-color:#f0c676;box-shadow:0 0 0 3px rgba(240,198,118,.16)}
#${ROOT_ID} .svs-input:disabled{opacity:.6;cursor:wait}
#${ROOT_ID} .svs-status{margin-top:10px;min-height:18px;font-size:12px;line-height:1.35}
#${ROOT_ID} .svs-status[data-svs-status="muted"]{color:#d6c5a4}
#${ROOT_ID} .svs-status[data-svs-status="success"]{color:#9ad58e}
#${ROOT_ID} .svs-status[data-svs-status="error"]{color:#ff9d91}
#${ROOT_ID} .svs-result{margin-top:14px}
#${ROOT_ID} .svs-empty{padding:22px 18px;border:1px dashed rgba(236,201,130,.26);border-radius:14px;background:rgba(255,248,231,.03);font-size:14px;line-height:1.45;color:#d9ccb4;text-align:center}
#${ROOT_ID} .svs-empty code{color:#ffe2a9}
#${ROOT_ID} .svs-card{padding:18px;border:1px solid rgba(236,201,130,.28);border-radius:16px;background:linear-gradient(180deg,rgba(255,248,231,.08) 0%,rgba(255,248,231,.04) 100%)}
#${ROOT_ID} .svs-card-title{font-size:20px;font-weight:800;color:#fff1cf}
#${ROOT_ID} .svs-card-coord{margin-top:4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#d0b88a}
#${ROOT_ID} .svs-grid{display:grid;grid-template-columns:140px 1fr;gap:10px 14px;margin-top:16px}
#${ROOT_ID} .svs-label{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#c8b185}
#${ROOT_ID} .svs-value{font-size:18px;font-weight:800;color:#ffffff}
#${ROOT_ID} .svs-hint{margin-top:14px;font-size:11px;line-height:1.4;color:#ad9a77;text-align:right}
@media (max-width: 640px){
  #${ROOT_ID}{padding:12px}
  #${ROOT_ID} .svs-panel{width:100%;padding:16px 16px 14px;border-radius:16px}
  #${ROOT_ID} .svs-title{font-size:18px}
  #${ROOT_ID} .svs-subtitle{font-size:11px}
  #${ROOT_ID} .svs-input{padding:15px 16px;font-size:22px;border-radius:12px}
  #${ROOT_ID} .svs-grid{grid-template-columns:1fr;gap:4px;margin-top:14px}
  #${ROOT_ID} .svs-value{margin-bottom:8px}
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
            <div class="svs-subtitle">Загружаем <code>${escapeHtml(
              LOAD_ENDPOINT,
            )}</code> и ищем деревню по координатам.</div>
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
      updateResult();
    };

    root.addEventListener("click", state.boundClick);
    state.inputEl.addEventListener("input", state.boundInput);

    document.body.appendChild(root);
    renderIdle();
    setVisible(true);
  };

  const fetchVillages = async () => {
    if (state.villagesByCoord.size > 0) {
      return state.villagesByCoord;
    }
    if (state.loadPromise) {
      return state.loadPromise;
    }

    state.loadPromise = (async () => {
      setStatus(`Загружаю ${LOAD_ENDPOINT} ...`, "muted");
      if (state.inputEl) state.inputEl.disabled = true;

      const response = await fetch(new URL(LOAD_ENDPOINT, location.origin).toString(), {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = String(await response.text());
      const villagesByCoord = new Map();

      text.split(/\r?\n/).forEach((line) => {
        const village = parseVillageLine(line);
        if (!village) return;
        villagesByCoord.set(village.coord, village);
      });

      state.villagesByCoord = villagesByCoord;
      setStatus(`Загружено деревень: ${villagesByCoord.size}`, "success");
      if (state.inputEl) {
        state.inputEl.disabled = false;
        if (state.visible) {
          state.inputEl.focus();
        }
      }
      updateResult();
      return villagesByCoord;
    })()
      .catch((error) => {
        const message = cleanText(error && error.message) || "unknown error";
        setStatus(`Ошибка загрузки: ${message}`, "error");
        if (state.resultEl) {
          state.resultEl.innerHTML = `
            <div class="svs-empty">
              Не удалось загрузить <code>${escapeHtml(LOAD_ENDPOINT)}</code>.
            </div>
          `;
        }
        throw error;
      })
      .finally(() => {
        state.loadPromise = null;
      });

    return state.loadPromise;
  };

  const onGlobalKeydown = (event) => {
    if (!event) return;
    const target = event.target instanceof Element ? event.target : null;
    const isEditable =
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);

    if ((event.ctrlKey || event.metaKey) && String(event.key || "").toLowerCase() === "k") {
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
        updateResult();
      }
    }
  };

  const destroy = () => {
    if (state.rootEl && state.boundClick) {
      state.rootEl.removeEventListener("click", state.boundClick);
    }
    if (state.inputEl && state.boundInput) {
      state.inputEl.removeEventListener("input", state.boundInput);
    }
    if (state.boundKeydown) {
      document.removeEventListener("keydown", state.boundKeydown, true);
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
  void fetchVillages().catch(() => null);

  window[SCRIPT_KEY] = {
    destroy,
    open: () => setVisible(true),
  };
})();

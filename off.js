(async function (TribalWars) {
    const start = Date.now();
    const namespace = 'ScriptMM.Off';
    const script_start_ms = Date.now();
    const server_generated_ms = Number(game_data && game_data.time_generated);

    const RANGE_MIN = -25;
    const RANGE_MAX = 90;
    const DEFAULT_RANGE_FROM = -5;
    const DEFAULT_RANGE_TO = 15;
    const SETTINGS_VERSION = 2;

    const DEFAULT_ACTIVE_UNITS = {
        axe: true,
        light: true,
        ram: true,
        snob: true,
    };

    const UNIT_POP = {
        spear: 1,
        sword: 1,
        archer: 1,
        spy: 2,
        heavy: 4,
        axe: 1,
        light: 4,
        marcher: 5,
        ram: 5,
        catapult: 8,
        knight: 10,
        snob: 100,
        militia: 0,
    };

    const UNIT_LABELS = {
        spear: 'Копейщик',
        sword: 'Мечник',
        axe: 'Топорщик',
        archer: 'Лучник',
        spy: 'Лазутчик',
        light: 'Лёгкая кавалерия',
        marcher: 'Конный лучник',
        heavy: 'Тяжёлая кавалерия',
        ram: 'Таран',
        catapult: 'Катапульта',
        knight: 'Паладин',
        snob: 'Дворянин',
    };

    const STRATEGIES = {
        DEPART_ASC: 'Выход (раньше -> позже)',
        DEPART_DESC: 'Выход (позже -> раньше)',
        DIST_ASC: 'По расстоянию (ближе -> дальше)',
        DIST_DESC: 'По расстоянию (дальше -> ближе)',
        TROOP_DESC: 'По войскам (больше -> меньше)',
    };

    const Helper = {
        clean_text: function (value) {
            return String(value === null || value === undefined ? '' : value).trim();
        },
        to_int: function (value) {
            const n = Number(String(value === null || value === undefined ? '' : value).replace(/\s+/g, '').replace(/[^\d-]/g, ''));
            return Number.isFinite(n) ? Math.trunc(n) : 0;
        },
        escape_html: function (value) {
            return String(value === null || value === undefined ? '' : value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        },
        get_id: function (control_name) {
            return control_name ? `${namespace}.${control_name}` : namespace;
        },
        get_control: function (control_name) {
            const escaped_id = Helper.get_id(control_name).replace(/\./g, '\\.');
            return document.querySelector(`#${escaped_id}`);
        },
        format_hms: function (epoch_ms) {
            const date = new Date(Number(epoch_ms));
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        },
        format_date_ymd: function (epoch_ms) {
            const date = new Date(Number(epoch_ms));
            if (!Number.isFinite(date.getTime())) {
                return Helper.format_date_ymd(Date.now());
            }
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        },
        normalize_date_input_value: function (value, fallback_ms = Date.now()) {
            const raw = Helper.clean_text(value);
            return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : Helper.format_date_ymd(fallback_ms);
        },
        parse_clock_to_sec: function (value, replacement) {
            const raw = Helper.clean_text(value);
            if (!raw) throw `Поле <strong>${replacement}</strong> пустое`;
            const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            if (!match) throw `Поле <strong>${replacement}</strong> имеет неверный формат`;
            const hh = Number(match[1]);
            const mm = Number(match[2]);
            const ss = match[3] === undefined ? 0 : Number(match[3]);
            if (hh > 23 || mm > 59 || ss > 59) {
                throw `Поле <strong>${replacement}</strong> имеет неверный формат`;
            }
            return hh * 3600 + mm * 60 + ss;
        },
        normalize_time_input_value: function (value, fallback_ms = Date.now()) {
            const raw = Helper.clean_text(value);
            if (!raw) return Helper.format_hms(fallback_ms);
            try {
                const sec = Helper.parse_clock_to_sec(raw, 'Время');
                const hh = Math.floor(sec / 3600);
                const mm = Math.floor((sec % 3600) / 60);
                const ss = sec % 60;
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
            } catch (ex) {
                return Helper.format_hms(fallback_ms);
            }
        },
        parse_datetime_from_date_and_time: function (date_value, time_value, replacement, fallback_ms = Date.now()) {
            const safe_date = Helper.normalize_date_input_value(date_value, fallback_ms);
            const safe_time = Helper.normalize_time_input_value(time_value, fallback_ms);
            const match = `${safe_date}T${safe_time}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
            if (!match) throw `Поле <strong>${replacement}</strong> имеет неверный формат`;
            const parsed = new Date(
                Number(match[1]),
                Number(match[2]) - 1,
                Number(match[3]),
                Number(match[4]),
                Number(match[5]),
                Number(match[6] || 0),
                0,
            );
            if (!Number.isFinite(parsed.getTime())) {
                throw `Поле <strong>${replacement}</strong> имеет неверный формат`;
            }
            return parsed.getTime();
        },
        format_distance: function (distance) {
            const safe = Number(distance);
            return Number.isFinite(safe) ? safe.toFixed(2) : '-';
        },
        format_signed_minutes: function (value) {
            const safe = Number(value);
            if (!Number.isFinite(safe)) return '-';
            const sign = safe >= 0 ? '+' : '';
            return `${sign}${safe.toFixed(1)}м`;
        },
        format_duration: function (seconds_raw) {
            const seconds = Math.trunc(Number(seconds_raw));
            if (!Number.isFinite(seconds)) return '-';
            const late = seconds < 0;
            let rest = Math.abs(seconds);
            const hh = Math.floor(rest / 3600);
            rest -= hh * 3600;
            const mm = Math.floor(rest / 60);
            const ss = rest - mm * 60;
            const value = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
            return late ? `-${value}` : value;
        },
        extract_coords_list: function (raw_value, replacement) {
            const source = String(raw_value === null || raw_value === undefined ? '' : raw_value);
            const matches = source.match(/\d{1,3}\|\d{1,3}/g) || [];
            const seen = new Set();
            const coords = [];
            for (const raw_coord of matches) {
                const coord = Helper.clean_text(raw_coord);
                if (seen.has(coord)) continue;
                seen.add(coord);
                const [x, y] = coord.split('|').map(Number);
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                coords.push({ text: coord, x, y });
            }
            if (!coords.length) throw `Поле <strong>${replacement}</strong> пустое`;
            return coords;
        },
        handle_error: function (error) {
            const message = error && error.message ? error.message : String(error || 'unknown');
            if (window.UI && typeof UI.ErrorMessage === 'function') {
                UI.ErrorMessage(message);
            } else {
                alert(message);
            }
            console.error(error);
        },
    };

    const Off = {
        group_id2villages: new Map(),
        group_id2group_name: {},
        settings: {},
        world_info: null,
        off_units: [],
        generated_rows: [],
        countdown_timer_id: null,

        get_server_now_ms: function () {
            if (Number.isFinite(server_generated_ms) && server_generated_ms > 0) {
                return server_generated_ms + (Date.now() - script_start_ms);
            }
            return Date.now();
        },

        clamp_offset: function (value, fallback) {
            const raw = Helper.to_int(value);
            const safe = Number.isFinite(raw) ? raw : fallback;
            return Math.max(RANGE_MIN, Math.min(RANGE_MAX, safe));
        },

        normalize_settings: function (stored) {
            const fallback_arrival_ms = Off.get_server_now_ms() + 20 * 60 * 1000;
            const base = {
                settings_version: SETTINGS_VERSION,
                targets: '',
                group: '-1',
                strategy: 'DEPART_ASC',
                arrival_date: Helper.format_date_ymd(fallback_arrival_ms),
                arrival_time: Helper.format_hms(fallback_arrival_ms),
                offset_from_min: DEFAULT_RANGE_FROM,
                offset_to_min: DEFAULT_RANGE_TO,
                active_units: {},
            };

            const source = stored && typeof stored === 'object' ? stored : {};
            const has_current_defaults = Helper.to_int(source.settings_version) >= SETTINGS_VERSION;
            base.targets = Helper.clean_text(source.targets || '');
            base.group = Helper.clean_text(source.group || base.group) || '-1';
            base.strategy = STRATEGIES[source.strategy] ? source.strategy : base.strategy;
            base.arrival_date = Helper.normalize_date_input_value(source.arrival_date, fallback_arrival_ms);
            base.arrival_time = Helper.normalize_time_input_value(source.arrival_time, fallback_arrival_ms);
            base.offset_from_min = Off.clamp_offset(has_current_defaults ? source.offset_from_min : DEFAULT_RANGE_FROM, DEFAULT_RANGE_FROM);
            base.offset_to_min = Off.clamp_offset(has_current_defaults ? source.offset_to_min : DEFAULT_RANGE_TO, DEFAULT_RANGE_TO);
            if (base.offset_from_min > base.offset_to_min) {
                const tmp = base.offset_from_min;
                base.offset_from_min = base.offset_to_min;
                base.offset_to_min = tmp;
            }

            const stored_units = source.active_units && typeof source.active_units === 'object'
                ? source.active_units
                : {};
            for (const unit_name of Off.off_units) {
                base.active_units[unit_name] = stored_units[unit_name] !== undefined
                    ? !!stored_units[unit_name]
                    : !!DEFAULT_ACTIVE_UNITS[unit_name];
            }
            return base;
        },

        load_settings: function () {
            let stored = null;
            try {
                stored = JSON.parse(localStorage.getItem(namespace));
            } catch (ex) {
                stored = null;
            }
            return Off.normalize_settings(stored);
        },

        save_settings: function () {
            localStorage.setItem(namespace, JSON.stringify(Off.settings));
        },

        init_settings: function () {
            Off.off_units = (game_data.units || [])
                .filter(unit_name => unit_name !== 'militia')
                .filter(unit_name => UNIT_POP[unit_name] !== undefined);
            Off.settings = Off.load_settings();
            Off.save_settings();
        },

        inject_styles: function () {
            const style_id = `${namespace}.styles`;
            if (document.getElementById(style_id)) return;
            const style = document.createElement('style');
            style.id = style_id;
            style.textContent = `
.off-root{position:fixed!important;left:24px;top:72px;width:min(960px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;z-index:350000;box-sizing:border-box;box-shadow:0 10px 28px rgba(0,0,0,.35)}
.off-root.off-dragging{opacity:.96}
.off-root.off-collapsed{width:auto;min-width:230px;max-width:calc(100vw - 16px);max-height:none;overflow:visible}
.off-root .off-drag-handle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 10px;background:#6f4524;color:#fff;font-weight:bold;cursor:move;user-select:none;touch-action:none;position:sticky;top:0;z-index:3;border-bottom:1px solid #3f2714}
.off-root .off-drag-title{white-space:nowrap}
.off-root .off-drag-caption{font-size:11px;font-weight:normal;opacity:.78;white-space:nowrap}
.off-root .off-window-controls{display:flex;align-items:center;gap:4px;margin-left:auto}
.off-root .off-window-control{border:1px solid rgba(255,255,255,.35);background:#8b5a32;color:#fff;border-radius:3px;cursor:pointer;font-weight:bold;line-height:1;padding:4px 7px;margin:0}
.off-root .off-window-control:hover{background:#a26a3b}
.off-root .off-window-close{background:#9b2f24}
.off-root .off-window-close:hover{background:#bd3a2b}
.off-root.off-collapsed .off-drag-caption,.off-root.off-collapsed .off-main-panel,.off-root.off-collapsed .off-output-wrap,.off-root.off-collapsed .off-summary{display:none}
.off-root .off-main-panel{padding:8px}
.off-root .off-label{display:block;font-weight:bold;margin:4px 0}
.off-root .off-targets-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.off-root .off-targets{width:100%;box-sizing:border-box;min-height:74px;resize:vertical;font:12px/1.35 monospace}
.off-root .off-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px}
.off-root .off-field input,.off-root .off-field select{width:100%;box-sizing:border-box}
.off-root .off-time{display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin-top:8px}
.off-root .off-time input[type="date"]{min-width:145px}
.off-root .off-time input[type="time"]{min-width:105px}
.off-root .off-range-block{margin-top:10px;border:1px solid #c2a97d;background:#f7f0df;padding:8px;border-radius:4px}
.off-root .off-range-values{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.off-root .off-range-values input{width:72px}
.off-root .off-range-slider{position:relative;height:28px;margin:6px 4px;--range-left:17.39%;--range-right:34.78%}
.off-root .off-range-track{position:absolute;left:0;right:0;top:13px;height:6px;border-radius:999px;background:linear-gradient(to right,#d4c4a0 0%,#d4c4a0 var(--range-left),#9f7b3e var(--range-left),#9f7b3e var(--range-right),#d4c4a0 var(--range-right),#d4c4a0 100%)}
.off-root .off-range-slider input[type="range"]{position:absolute;left:0;top:4px;width:100%;pointer-events:none;background:transparent;appearance:none;-webkit-appearance:none}
.off-root .off-range-slider input[type="range"]::-webkit-slider-runnable-track{background:transparent;border:0}
.off-root .off-range-slider input[type="range"]::-moz-range-track{background:transparent;border:0}
.off-root .off-range-slider input[type="range"]::-webkit-slider-thumb{pointer-events:auto}
.off-root .off-range-slider input[type="range"]::-moz-range-thumb{pointer-events:auto}
.off-root .off-units{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;padding:6px;border:1px solid #c2a97d;background:#fff8ea}
.off-root .off-unit-toggle{display:inline-flex;align-items:center;gap:4px}
.off-root .off-unit-toggle img{vertical-align:middle}
.off-root .off-actions{display:flex;gap:8px;align-items:center;margin-top:10px}
.off-root .off-output-wrap{margin:5px;height:310px;overflow:auto}
.off-root .off-output-table{width:100%;border-collapse:collapse}
.off-root .off-output-table th,.off-root .off-output-table td{border:1px solid #e2d5bd;padding:3px 4px;text-align:center;vertical-align:middle;font-size:11px}
.off-root .off-output-table th{background:#f0e2c6;position:sticky;top:0;z-index:1}
.off-root .off-output-table .off-target-cell{font-weight:bold;background:#fff7e7}
.off-root .off-output-table input[type="number"]{width:58px;box-sizing:border-box}
.off-root .off-row-scale-wrap{display:flex;align-items:center;gap:4px;min-width:112px}
.off-root .off-row-scale{width:72px}
.off-root .off-muted{color:#b88c4a}
.off-root .off-go-btn{margin:0}
.off-root .off-go-btn:disabled{opacity:.5;cursor:not-allowed}
.off-root .off-summary{padding:0 6px 6px 6px;font-size:12px}
`;
            document.head.append(style);
        },

        load_window_position: function () {
            try {
                const position = JSON.parse(localStorage.getItem(`${namespace}.window_position`));
                if (!position || typeof position !== 'object') return null;
                const left = Number(position.left);
                const top = Number(position.top);
                if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
                return { left, top };
            } catch (ex) {
                return null;
            }
        },

        save_window_position: function (root) {
            if (!root) return;
            const rect = root.getBoundingClientRect();
            try {
                localStorage.setItem(`${namespace}.window_position`, JSON.stringify({
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                }));
            } catch (ex) {
                // Position persistence is optional; a full localStorage should not break the script.
            }
        },

        load_window_collapsed: function () {
            try {
                return localStorage.getItem(`${namespace}.window_collapsed`) === '1';
            } catch (ex) {
                return false;
            }
        },

        save_window_collapsed: function (collapsed) {
            try {
                localStorage.setItem(`${namespace}.window_collapsed`, collapsed ? '1' : '0');
            } catch (ex) {
                // Collapse persistence is optional; a full localStorage should not break the script.
            }
        },

        set_window_collapsed: function (root, collapsed, should_save = true) {
            if (!root) return;
            root.classList.toggle('off-collapsed', !!collapsed);
            const button = Helper.get_control('window_collapse');
            if (button) {
                button.textContent = collapsed ? 'Развернуть' : 'Свернуть';
                button.title = collapsed ? 'Развернуть окно' : 'Свернуть окно';
            }
            requestAnimationFrame(() => {
                Off.apply_window_position(root);
                if (should_save) {
                    Off.save_window_collapsed(!!collapsed);
                    Off.save_window_position(root);
                }
            });
        },

        close_window: function () {
            const root = Helper.get_control();
            if (root) root.remove();
            Off.unbind_external_arrival_picker();
            if (Off.countdown_timer_id) clearInterval(Off.countdown_timer_id);
        },

        clamp_window_position: function (root, position) {
            const margin = 8;
            const rect = root.getBoundingClientRect();
            const width = rect.width || root.offsetWidth || 960;
            const height = Math.min(rect.height || root.offsetHeight || 420, window.innerHeight - margin * 2);
            const max_left = Math.max(margin, window.innerWidth - width - margin);
            const max_top = Math.max(margin, window.innerHeight - height - margin);
            const left = Number(position && position.left);
            const top = Number(position && position.top);
            return {
                left: Math.round(Math.min(Math.max(margin, Number.isFinite(left) ? left : margin), max_left)),
                top: Math.round(Math.min(Math.max(margin, Number.isFinite(top) ? top : 72), max_top)),
            };
        },

        apply_window_position: function (root) {
            if (!root) return;
            const rect = root.getBoundingClientRect();
            const fallback_left = Math.max(8, Math.round((window.innerWidth - (rect.width || root.offsetWidth || 960)) / 2));
            const position = Off.clamp_window_position(root, Off.load_window_position() || {
                left: fallback_left,
                top: 72,
            });
            root.style.left = `${position.left}px`;
            root.style.top = `${position.top}px`;
        },

        bind_window_drag: function (root) {
            const handle = root && root.querySelector('.off-drag-handle');
            if (!handle) return;
            let dragging = false;
            let start_x = 0;
            let start_y = 0;
            let start_left = 0;
            let start_top = 0;

            const on_pointer_move = event => {
                if (!dragging) return;
                event.preventDefault();
                const position = Off.clamp_window_position(root, {
                    left: start_left + event.clientX - start_x,
                    top: start_top + event.clientY - start_y,
                });
                root.style.left = `${position.left}px`;
                root.style.top = `${position.top}px`;
            };

            const on_pointer_up = event => {
                if (!dragging) return;
                dragging = false;
                root.classList.remove('off-dragging');
                document.removeEventListener('pointermove', on_pointer_move);
                document.removeEventListener('pointerup', on_pointer_up);
                try {
                    handle.releasePointerCapture(event.pointerId);
                } catch (ex) {
                    // Some browsers release capture automatically.
                }
                Off.save_window_position(root);
            };

            handle.addEventListener('pointerdown', event => {
                if (event.target.closest('button')) return;
                if (event.button !== undefined && event.button !== 0) return;
                const rect = root.getBoundingClientRect();
                dragging = true;
                start_x = event.clientX;
                start_y = event.clientY;
                start_left = rect.left;
                start_top = rect.top;
                root.classList.add('off-dragging');
                try {
                    handle.setPointerCapture(event.pointerId);
                } catch (ex) {
                    // Pointer capture is a convenience, not a requirement.
                }
                document.addEventListener('pointermove', on_pointer_move);
                document.addEventListener('pointerup', on_pointer_up);
            });

            const collapse_button = Helper.get_control('window_collapse');
            if (collapse_button) {
                collapse_button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    Off.set_window_collapsed(root, !root.classList.contains('off-collapsed'));
                });
            }

            const close_button = Helper.get_control('window_close');
            if (close_button) {
                close_button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    Off.close_window();
                });
            }

            const on_resize = () => {
                if (!document.body.contains(root)) {
                    window.removeEventListener('resize', on_resize);
                    return;
                }
                Off.apply_window_position(root);
                Off.save_window_position(root);
            };
            window.addEventListener('resize', on_resize);
        },

        create_main_panel: function () {
            const panel = document.createElement('div');
            panel.classList.add('vis', 'vis_item', 'off-main-panel');
            panel.style.margin = '5px';

            const targets_id = Helper.get_id('targets');
            const insert_current_target_id = Helper.get_id('insert_current_target');
            const group_id = Helper.get_id('group');
            const strategy_id = Helper.get_id('strategy');
            const arrival_date_id = Helper.get_id('arrival_date');
            const arrival_time_id = Helper.get_id('arrival_time');
            const offset_from_range_id = Helper.get_id('offset_from_range');
            const offset_to_range_id = Helper.get_id('offset_to_range');
            const offset_from_min_id = Helper.get_id('offset_from_min');
            const offset_to_min_id = Helper.get_id('offset_to_min');
            const generate_id = Helper.get_id('generate');

            const unit_toggles = Off.off_units.map(unit_name => {
                const id = Helper.get_id(`unit.${unit_name}`);
                const title = UNIT_LABELS[unit_name] || unit_name;
                return `<label class="off-unit-toggle" title="${Helper.escape_html(title)}">
                    <input id="${id}" type="checkbox" data-unit="${Helper.escape_html(unit_name)}">
                    <img src="${image_base}unit/unit_${unit_name}.png" alt="${Helper.escape_html(unit_name)}">
                </label>`;
            }).join('');

            panel.innerHTML = `
                <div class="off-targets-head">
                    <label class="off-label" for="${targets_id}">Список кор</label>
                    <button id="${insert_current_target_id}" class="btn" type="button">Вставить текущую</button>
                </div>
                <textarea id="${targets_id}" class="off-targets" rows="4" placeholder="444|555\n445|556"></textarea>

                <div class="off-grid">
                    <div class="off-field">
                        <label class="off-label" for="${group_id}">Группа</label>
                        <select id="${group_id}"></select>
                    </div>
                    <div class="off-field">
                        <label class="off-label" for="${strategy_id}">Сортировка</label>
                        <select id="${strategy_id}"></select>
                    </div>
                    <div class="off-field">
                        <label class="off-label" for="${arrival_date_id}">Дата прихода</label>
                        <input id="${arrival_date_id}" type="date">
                    </div>
                    <div class="off-field">
                        <label class="off-label" for="${arrival_time_id}">Время прихода</label>
                        <input id="${arrival_time_id}" type="time" step="1">
                    </div>
                </div>

                <div class="off-range-block">
                    <label class="off-label">Окно выхода относительно текущего времени</label>
                    <div class="off-range-values">
                        <span>от <input id="${offset_from_min_id}" type="number" min="${RANGE_MIN}" max="${RANGE_MAX}" step="1"> мин</span>
                        <span>до <input id="${offset_to_min_id}" type="number" min="${RANGE_MIN}" max="${RANGE_MAX}" step="1"> мин</span>
                    </div>
                    <div class="off-range-slider">
                        <div class="off-range-track"></div>
                        <input id="${offset_from_range_id}" type="range" min="${RANGE_MIN}" max="${RANGE_MAX}" step="1">
                        <input id="${offset_to_range_id}" type="range" min="${RANGE_MIN}" max="${RANGE_MAX}" step="1">
                    </div>
                </div>

                <div class="off-units">${unit_toggles}</div>

                <div class="off-actions">
                    <button id="${generate_id}" class="btn" type="button">Рассчитать</button>
                </div>
            `;

            return panel;
        },

        create_output_panel: function () {
            const panel = document.createElement('div');
            panel.classList.add('vis', 'vis_item', 'off-output-wrap');

            const table = document.createElement('table');
            table.classList.add('off-output-table');

            const head = document.createElement('thead');
            head.id = Helper.get_id('output_head');
            const body = document.createElement('tbody');
            body.id = Helper.get_id('output');

            table.append(head);
            table.append(body);
            panel.append(table);
            return panel;
        },

        create_bottom_panel: function () {
            const panel = document.createElement('div');
            panel.classList.add('vis_item', 'off-summary');
            panel.style.margin = '0 5px 5px 5px';
            const summary = document.createElement('span');
            summary.id = Helper.get_id('summary');
            summary.textContent = 'Сначала нажми «Рассчитать»';
            panel.append(summary);
            return panel;
        },

        create_drag_handle: function () {
            const handle = document.createElement('div');
            handle.classList.add('off-drag-handle');
            handle.innerHTML = `
                <span class="off-drag-title">OFF</span>
                <span class="off-drag-caption">перетащи окно</span>
                <span class="off-window-controls">
                    <button id="${Helper.get_id('window_collapse')}" class="off-window-control" type="button" title="Свернуть окно">Свернуть</button>
                    <button id="${Helper.get_id('window_close')}" class="off-window-control off-window-close" type="button" title="Закрыть">×</button>
                </span>
            `;
            return handle;
        },

        create_gui: function () {
            const root = document.createElement('div');
            root.id = Helper.get_id();
            root.classList.add('vis', 'vis_item', 'off-root');
            root.style.padding = '0';
            root.style.margin = '0';
            root.append(Off.create_drag_handle());
            root.append(Off.create_main_panel());
            root.append(Off.create_output_panel());
            root.append(Off.create_bottom_panel());

            document.body.append(root);
            requestAnimationFrame(() => {
                Off.apply_window_position(root);
                Off.bind_window_drag(root);
                Off.set_window_collapsed(root, Off.load_window_collapsed(), false);
            });
        },

        set_summary: function (text) {
            const summary = Helper.get_control('summary');
            if (summary) summary.textContent = Helper.clean_text(text);
        },

        get_groups_info: async function () {
            const url = TribalWars.buildURL('GET', 'groups', { mode: 'overview', ajax: 'load_group_menu' });
            const response = await fetch(url, { credentials: 'include' });
            const payload = JSON.parse(await response.text());
            payload.result = (payload.result || []).filter(group => group.type !== 'separator');
            payload.result.forEach(group => {
                Off.group_id2group_name[group.group_id] = group.name;
            });
            return payload;
        },

        get_world_info: async function () {
            if (typeof get_world_info === 'function') {
                Off.world_info = await get_world_info({ configs: ['config', 'unit_info'] });
            } else {
                Off.world_info = { unit_info: {} };
            }
        },

        get_unit_speed: function (unit_name) {
            const speed = Number(Off.world_info && Off.world_info.unit_info && Off.world_info.unit_info[unit_name] && Off.world_info.unit_info[unit_name].speed);
            return Number.isFinite(speed) && speed > 0 ? speed : null;
        },

        get_unit_pop: function (unit_name) {
            const pop = Number(UNIT_POP[unit_name]);
            return Number.isFinite(pop) && pop >= 0 ? pop : 1;
        },

        get_villages: async function (group_id) {
            if (Off.group_id2villages.has(group_id)) {
                return Off.group_id2villages.get(group_id);
            }

            const url = TribalWars.buildURL('GET', 'overview_villages', {
                mode: 'units',
                type: 'own_home',
                group: group_id,
                page: -1,
            });
            const request = await fetch(url, { credentials: 'same-origin' });
            const response = await request.text();
            const requested_body = document.createElement('body');
            requested_body.innerHTML = response;
            const units_table = requested_body.querySelector('#units_table');
            if (!units_table) return null;

            const villages = [];
            for (let i = 1; i < units_table.rows.length; i++) {
                const row = units_table.rows[i];
                const units = {};
                const offset = 2;
                for (let j = 0; j < game_data.units.length; j++) {
                    const unit_name = game_data.units[j];
                    units[unit_name] = Helper.to_int(row.cells[offset + j] && row.cells[offset + j].textContent);
                }
                const main_cell = row.cells[0];
                const name = Helper.clean_text(main_cell && main_cell.textContent);
                const coord_match = name.match(/\d{1,3}\|\d{1,3}/);
                if (!coord_match) continue;
                const coords = coord_match[0].split('|').map(Number);
                const link = main_cell.querySelector('[data-id]') || main_cell.querySelector('a[href*="village="]');
                const id = link && link.getAttribute('data-id')
                    ? link.getAttribute('data-id')
                    : link
                        ? new URL(link.href, location.origin).searchParams.get('village')
                        : null;
                if (!id) continue;
                villages.push({ id, name, coords, units });
            }
            Off.group_id2villages.set(group_id, villages);
            return villages;
        },

        build_place_command_url: function ({ from_village_id, target, units }) {
            const village_id = Helper.clean_text(from_village_id);
            if (!village_id || !target || !Object.keys(units || {}).length) return null;
            const url = new URL('/game.php', location.origin);
            const sitter = Helper.clean_text(game_data && game_data.player && game_data.player.sitter);
            if (sitter && sitter !== '0') {
                url.searchParams.set('t', String(game_data.player.id));
            }
            url.searchParams.set('village', village_id);
            url.searchParams.set('screen', 'place');
            url.searchParams.set('from', 'simulator');
            url.searchParams.set('x', String(target.x));
            url.searchParams.set('y', String(target.y));
            Object.keys(units || {}).forEach(unit_name => {
                const count = Math.max(0, Helper.to_int(units[unit_name]));
                if (!count) return;
                url.searchParams.set(`att_${unit_name}`, String(count));
            });
            return url.toString();
        },

        sync_range_controls: function (changed) {
            const from_range = Helper.get_control('offset_from_range');
            const to_range = Helper.get_control('offset_to_range');
            const from_input = Helper.get_control('offset_from_min');
            const to_input = Helper.get_control('offset_to_min');

            let from = Off.clamp_offset(changed === 'from_input' ? from_input.value : from_range.value, DEFAULT_RANGE_FROM);
            let to = Off.clamp_offset(changed === 'to_input' ? to_input.value : to_range.value, DEFAULT_RANGE_TO);

            if (changed && changed.startsWith('from') && from > to) to = from;
            if (changed && changed.startsWith('to') && to < from) from = to;
            if (!changed && from > to) {
                const tmp = from;
                from = to;
                to = tmp;
            }

            if (from_range) from_range.value = String(from);
            if (to_range) to_range.value = String(to);
            if (from_input) from_input.value = String(from);
            if (to_input) to_input.value = String(to);
            const range_slider = document.querySelector(`#${Helper.get_id().replace(/\./g, '\\.')} .off-range-slider`);
            if (range_slider) {
                const span = RANGE_MAX - RANGE_MIN;
                const left = ((from - RANGE_MIN) / span) * 100;
                const right = ((to - RANGE_MIN) / span) * 100;
                range_slider.style.setProperty('--range-left', `${Math.max(0, Math.min(100, left)).toFixed(2)}%`);
                range_slider.style.setProperty('--range-right', `${Math.max(0, Math.min(100, right)).toFixed(2)}%`);
            }
        },

        sync_settings_from_ui: function () {
            Off.sync_range_controls();
            const targets = Helper.get_control('targets');
            const group = Helper.get_control('group');
            const strategy = Helper.get_control('strategy');
            const arrival_date = Helper.get_control('arrival_date');
            const arrival_time = Helper.get_control('arrival_time');
            const from_input = Helper.get_control('offset_from_min');
            const to_input = Helper.get_control('offset_to_min');

            Off.settings.targets = targets ? String(targets.value || '') : '';
            Off.settings.group = group ? String(group.value || '-1') : '-1';
            Off.settings.strategy = strategy && STRATEGIES[strategy.value] ? strategy.value : 'DEPART_ASC';
            Off.settings.arrival_date = Helper.normalize_date_input_value(arrival_date ? arrival_date.value : '', Off.get_server_now_ms());
            Off.settings.arrival_time = Helper.normalize_time_input_value(arrival_time ? arrival_time.value : '', Off.get_server_now_ms());
            Off.settings.offset_from_min = Off.clamp_offset(from_input ? from_input.value : DEFAULT_RANGE_FROM, DEFAULT_RANGE_FROM);
            Off.settings.offset_to_min = Off.clamp_offset(to_input ? to_input.value : DEFAULT_RANGE_TO, DEFAULT_RANGE_TO);
            if (Off.settings.offset_from_min > Off.settings.offset_to_min) {
                const tmp = Off.settings.offset_from_min;
                Off.settings.offset_from_min = Off.settings.offset_to_min;
                Off.settings.offset_to_min = tmp;
            }
            Off.settings.active_units = {};
            for (const unit_name of Off.off_units) {
                const control = Helper.get_control(`unit.${unit_name}`);
                Off.settings.active_units[unit_name] = !!(control && control.checked);
            }
            Off.save_settings();
        },

        apply_settings_to_ui: function () {
            const targets = Helper.get_control('targets');
            const strategy = Helper.get_control('strategy');
            const arrival_date = Helper.get_control('arrival_date');
            const arrival_time = Helper.get_control('arrival_time');
            if (targets) targets.value = Off.settings.targets || '';
            if (strategy) strategy.value = Off.settings.strategy || 'DEPART_ASC';
            if (arrival_date) arrival_date.value = Helper.normalize_date_input_value(Off.settings.arrival_date, Off.get_server_now_ms());
            if (arrival_time) arrival_time.value = Helper.normalize_time_input_value(Off.settings.arrival_time, Off.get_server_now_ms());
            const from_range = Helper.get_control('offset_from_range');
            const to_range = Helper.get_control('offset_to_range');
            const from_input = Helper.get_control('offset_from_min');
            const to_input = Helper.get_control('offset_to_min');
            if (from_range) from_range.value = String(Off.settings.offset_from_min);
            if (to_range) to_range.value = String(Off.settings.offset_to_min);
            if (from_input) from_input.value = String(Off.settings.offset_from_min);
            if (to_input) to_input.value = String(Off.settings.offset_to_min);
            Off.sync_range_controls();
            for (const unit_name of Off.off_units) {
                const control = Helper.get_control(`unit.${unit_name}`);
                if (control) control.checked = !!Off.settings.active_units[unit_name];
            }
        },

        get_active_units: function () {
            return Off.off_units.filter(unit_name => !!Off.settings.active_units[unit_name]);
        },

        get_linked_units_for_anchor: function (anchor_unit, active_units) {
            const active = new Set(active_units || []);
            const chains = {
                snob: ['snob', 'ram', 'light', 'axe'],
                ram: ['ram', 'light', 'axe'],
                axe: ['axe', 'light'],
            };
            const chain = chains[anchor_unit] || [anchor_unit];
            return chain.filter(unit_name => active.has(unit_name));
        },

        collect_user_input: function () {
            Off.sync_settings_from_ui();
            const targets_control = Helper.get_control('targets');
            const group_control = Helper.get_control('group');
            const arrival_date_control = Helper.get_control('arrival_date');
            const arrival_time_control = Helper.get_control('arrival_time');
            const targets = Helper.extract_coords_list(targets_control ? targets_control.value : '', 'Список кор');
            const active_units = Off.get_active_units();
            if (!active_units.length) throw 'Выбери хотя бы один юнит';
            const arrival_ms = Helper.parse_datetime_from_date_and_time(
                arrival_date_control ? arrival_date_control.value : '',
                arrival_time_control ? arrival_time_control.value : '',
                'Время прихода',
                Off.get_server_now_ms(),
            );
            return {
                targets,
                group_id: String(group_control ? group_control.value || '-1' : '-1'),
                strategy: Off.settings.strategy || 'DEPART_ASC',
                arrival_ms,
                offset_from_ms: Off.settings.offset_from_min * 60 * 1000,
                offset_to_ms: Off.settings.offset_to_min * 60 * 1000,
                active_units,
            };
        },

        build_candidate_row: function ({ target, village, user_input }) {
            const distance = Math.hypot(target.x - village.coords[0], target.y - village.coords[1]);
            if (!Number.isFinite(distance) || distance <= 0) return null;

            const now_ms = Off.get_server_now_ms();
            const available_candidates = {};
            for (const unit_name of user_input.active_units) {
                const count = Math.max(0, Helper.to_int(village.units[unit_name]));
                if (!count) continue;
                const speed = Off.get_unit_speed(unit_name);
                if (!Number.isFinite(speed)) continue;
                const travel_ms = distance * speed * 60 * 1000;
                const departure_ms = user_input.arrival_ms - travel_ms;
                const offset_ms = departure_ms - now_ms;
                available_candidates[unit_name] = {
                    max: count,
                    speed,
                    travel_ms,
                    departure_ms,
                    offset_ms,
                    pop: Off.get_unit_pop(unit_name),
                };
            }

            const anchor_units = Object.keys(available_candidates)
                .filter(unit_name =>
                    available_candidates[unit_name].offset_ms >= user_input.offset_from_ms &&
                    available_candidates[unit_name].offset_ms <= user_input.offset_to_ms
                )
                .sort((lhs, rhs) => available_candidates[rhs].travel_ms - available_candidates[lhs].travel_ms);
            if (!anchor_units.length) return null;

            const anchor_unit = anchor_units[0];
            const selected_departure_ms = available_candidates[anchor_unit].departure_ms;
            const row_units = {};
            const linked_units = Off.get_linked_units_for_anchor(anchor_unit, user_input.active_units);
            for (const unit_name of linked_units) {
                const candidate = available_candidates[unit_name];
                if (!candidate) continue;
                if (candidate.departure_ms < selected_departure_ms) continue;
                row_units[unit_name] = candidate;
            }

            if (!Object.keys(row_units).length) return null;

            return {
                target,
                target_coord: target.text,
                village_id: village.id,
                village_name: village.name,
                village_coord: `${village.coords[0]}|${village.coords[1]}`,
                distance,
                arrival_ms: user_input.arrival_ms,
                departure_ms: selected_departure_ms,
                offset_ms: selected_departure_ms - now_ms,
                anchor_unit,
                units: row_units,
                population: Object.keys(row_units).reduce((sum, unit_name) => sum + row_units[unit_name].max * row_units[unit_name].pop, 0),
            };
        },

        sort_rows: function (rows, strategy) {
            const items = [...rows];
            switch (strategy) {
                case 'DEPART_DESC':
                    items.sort((lhs, rhs) => rhs.departure_ms - lhs.departure_ms);
                    break;
                case 'DIST_ASC':
                    items.sort((lhs, rhs) => lhs.distance - rhs.distance);
                    break;
                case 'DIST_DESC':
                    items.sort((lhs, rhs) => rhs.distance - lhs.distance);
                    break;
                case 'TROOP_DESC':
                    items.sort((lhs, rhs) => rhs.population - lhs.population);
                    break;
                case 'DEPART_ASC':
                default:
                    items.sort((lhs, rhs) => lhs.departure_ms - rhs.departure_ms);
                    break;
            }
            return items;
        },

        render_header: function (active_units) {
            const head = Helper.get_control('output_head');
            if (!head) return;
            const tr = document.createElement('tr');
            ['Цель', 'Деревня', 'Дист.', 'Выход', 'До выхода', 'Приход', '%'].forEach(caption => {
                const th = document.createElement('th');
                th.textContent = caption;
                tr.append(th);
            });
            active_units.forEach(unit_name => {
                const th = document.createElement('th');
                const img = document.createElement('img');
                img.src = `${image_base}unit/unit_${unit_name}.png`;
                img.alt = unit_name;
                img.title = UNIT_LABELS[unit_name] || unit_name;
                th.append(img);
                tr.append(th);
            });
            const command = document.createElement('th');
            command.textContent = 'Команда';
            tr.append(command);
            head.innerHTML = '';
            head.append(tr);
        },

        render_rows: function (rows, active_units) {
            Off.generated_rows = rows;
            Off.render_header(active_units);
            const body = Helper.get_control('output');
            if (!body) return;
            body.innerHTML = '';

            rows.forEach((row, index) => {
                const tr = document.createElement('tr');
                tr.classList.add('off-row');
                tr.dataset.rowIndex = String(index);
                tr.dataset.targetX = String(row.target.x);
                tr.dataset.targetY = String(row.target.y);
                tr.dataset.targetCoord = row.target_coord;
                tr.dataset.villageId = row.village_id;
                tr.dataset.arrivalMs = String(Math.round(row.arrival_ms));

                const target_cell = document.createElement('td');
                target_cell.classList.add('off-target-cell');
                target_cell.textContent = row.target_coord;
                tr.append(target_cell);

                const village_cell = document.createElement('td');
                const village_anchor = document.createElement('a');
                village_anchor.href = TribalWars.buildURL('GET', 'info_village', { id: row.village_id });
                village_anchor.textContent = row.village_name;
                village_cell.append(village_anchor);
                tr.append(village_cell);

                const distance_cell = document.createElement('td');
                distance_cell.textContent = Helper.format_distance(row.distance);
                tr.append(distance_cell);

                const depart_cell = document.createElement('td');
                depart_cell.dataset.role = 'depart';
                tr.append(depart_cell);

                const countdown_cell = document.createElement('td');
                countdown_cell.dataset.role = 'countdown';
                tr.append(countdown_cell);

                const arrival_cell = document.createElement('td');
                arrival_cell.textContent = Helper.format_hms(row.arrival_ms);
                tr.append(arrival_cell);

                const percent_cell = document.createElement('td');
                percent_cell.innerHTML = '<span class="off-row-scale-wrap"><input class="off-row-scale" type="range" min="1" max="100" step="1" value="100"><span class="off-row-scale-label">100%</span></span>';
                tr.append(percent_cell);

                active_units.forEach(unit_name => {
                    const cell = document.createElement('td');
                    const state = row.units[unit_name];
                    if (!state) {
                        cell.classList.add('off-muted');
                        cell.textContent = '0';
                    } else {
                        cell.innerHTML = `<input class="off-unit-input" type="number" min="1" step="1" max="${state.max}" value="${state.max}" data-unit="${Helper.escape_html(unit_name)}" data-max="${state.max}" data-travel-ms="${Math.round(state.travel_ms)}">`;
                    }
                    tr.append(cell);
                });

                const command_cell = document.createElement('td');
                command_cell.innerHTML = '<button class="btn off-go-btn" type="button">Площадь</button>';
                tr.append(command_cell);

                body.append(tr);
                Off.update_row_state(tr);
            });

            Off.set_summary(rows.length
                ? `Найдено вариантов: ${rows.length}`
                : 'Подходящих отправок не найдено');
        },

        collect_row_units: function (row) {
            const units = {};
            row.querySelectorAll('.off-unit-input').forEach(input => {
                const unit_name = Helper.clean_text(input.dataset.unit);
                const max = Math.max(0, Helper.to_int(input.dataset.max));
                let count = Math.max(0, Helper.to_int(input.value));
                if (count > max) count = max;
                if (count > 0) {
                    input.value = String(count);
                    units[unit_name] = count;
                } else {
                    input.value = '0';
                }
            });
            return units;
        },

        update_row_state: function (row) {
            if (!row) return;
            const arrival_ms = Number(row.dataset.arrivalMs);
            const inputs = Array.from(row.querySelectorAll('.off-unit-input'));
            let max_travel_ms = null;
            inputs.forEach(input => {
                const max = Math.max(0, Helper.to_int(input.dataset.max));
                let value = Math.max(0, Helper.to_int(input.value));
                if (value > max) value = max;
                if (value <= 0) {
                    input.value = '0';
                    return;
                }
                input.value = String(value);
                const travel_ms = Number(input.dataset.travelMs);
                if (Number.isFinite(travel_ms) && (max_travel_ms === null || travel_ms > max_travel_ms)) {
                    max_travel_ms = travel_ms;
                }
            });

            const depart_cell = row.querySelector('[data-role="depart"]');
            const countdown_cell = row.querySelector('[data-role="countdown"]');
            const button = row.querySelector('.off-go-btn');
            const units = Off.collect_row_units(row);
            const has_units = Object.keys(units).length > 0;
            const departure_ms = Number.isFinite(arrival_ms) && max_travel_ms !== null
                ? arrival_ms - max_travel_ms
                : null;

            if (depart_cell) {
                depart_cell.textContent = Number.isFinite(departure_ms) ? Helper.format_hms(departure_ms) : '-';
            }
            if (countdown_cell) {
                countdown_cell.dataset.departureMs = Number.isFinite(departure_ms) ? String(Math.round(departure_ms)) : '';
                countdown_cell.textContent = Number.isFinite(departure_ms)
                    ? Helper.format_duration((departure_ms - Off.get_server_now_ms()) / 1000)
                    : '-';
            }
            if (button) {
                const url = has_units && Number.isFinite(departure_ms)
                    ? Off.build_place_command_url({
                        from_village_id: row.dataset.villageId,
                        target: {
                            x: Helper.to_int(row.dataset.targetX),
                            y: Helper.to_int(row.dataset.targetY),
                        },
                        units,
                    })
                    : null;
                if (url) {
                    button.disabled = false;
                    button.dataset.url = url;
                } else {
                    button.disabled = true;
                    delete button.dataset.url;
                }
            }
        },

        apply_row_scale: function (row) {
            const slider = row.querySelector('.off-row-scale');
            const label = row.querySelector('.off-row-scale-label');
            if (!slider) return;
            let percent = Helper.to_int(slider.value) || 100;
            percent = Math.max(1, Math.min(100, percent));
            slider.value = String(percent);
            if (label) label.textContent = `${percent}%`;
            row.querySelectorAll('.off-unit-input').forEach(input => {
                const max = Math.max(0, Helper.to_int(input.dataset.max));
                if (max <= 0) {
                    input.value = '0';
                    return;
                }
                input.value = String(Math.max(1, Math.floor(max * percent / 100)));
            });
            Off.update_row_state(row);
        },

        update_countdowns: function () {
            document.querySelectorAll(`#${Helper.get_id('output').replace(/\./g, '\\.')} [data-role="countdown"]`).forEach(node => {
                const departure_ms = Number(node.dataset.departureMs);
                if (!Number.isFinite(departure_ms)) return;
                node.textContent = Helper.format_duration((departure_ms - Off.get_server_now_ms()) / 1000);
            });
        },

        start_countdown: function () {
            if (Off.countdown_timer_id) clearInterval(Off.countdown_timer_id);
            Off.countdown_timer_id = setInterval(Off.update_countdowns, 1000);
            Off.update_countdowns();
        },

        generate_commands: async function () {
            const button = Helper.get_control('generate');
            if (button) button.disabled = true;
            try {
                const user_input = Off.collect_user_input();
                const villages = await Off.get_villages(user_input.group_id);
                if (!villages || !villages.length) throw 'В выбранной группе нет деревень';

                const rows = [];
                for (const target of user_input.targets) {
                    for (const village of villages) {
                        const row = Off.build_candidate_row({ target, village, user_input });
                        if (row) rows.push(row);
                    }
                }

                Off.render_rows(Off.sort_rows(rows, user_input.strategy), user_input.active_units);
                Off.start_countdown();
            } catch (ex) {
                Helper.handle_error(ex);
            } finally {
                if (button) button.disabled = false;
            }
        },

        extract_current_coord: function () {
            const hash = Helper.clean_text(window.location.hash || '');
            const hash_match = hash.match(/(\d{1,3})\s*[;|]\s*(\d{1,3})/);
            if (hash_match) return `${Math.trunc(Number(hash_match[1]))}|${Math.trunc(Number(hash_match[2]))}`;
            const params = new URLSearchParams(window.location.search);
            const screen = Helper.clean_text(params.get('screen') || (game_data && game_data.screen) || '');
            if (screen === 'info_village') {
                const content = document.querySelector('#content_value');
                const match = content && (content.textContent || '').match(/\(\s*(\d{1,3})\|(\d{1,3})\s*\)/);
                if (match) return `${Math.trunc(Number(match[1]))}|${Math.trunc(Number(match[2]))}`;
            }
            return game_data && game_data.village && game_data.village.coord
                ? Helper.clean_text(game_data.village.coord)
                : null;
        },

        parse_arrival_from_text: function (raw_text) {
            const source = Helper.clean_text(String(raw_text === null || raw_text === undefined ? '' : raw_text))
                .replace(/\s+/g, ' ');
            if (!source) return null;

            const now = new Date(Off.get_server_now_ms());
            const month_name_to_number = function (raw_month) {
                const month = Helper.clean_text(raw_month).toLowerCase().replace(/\.$/, '');
                const aliases = [
                    { keys: ['jan', 'january', 'янв', 'январ'], value: 1 },
                    { keys: ['feb', 'february', 'фев', 'феврал'], value: 2 },
                    { keys: ['mar', 'march', 'мар', 'март'], value: 3 },
                    { keys: ['apr', 'april', 'апр', 'апрел'], value: 4 },
                    { keys: ['may', 'мая', 'май'], value: 5 },
                    { keys: ['jun', 'june', 'июн', 'июнь'], value: 6 },
                    { keys: ['jul', 'july', 'июл', 'июль'], value: 7 },
                    { keys: ['aug', 'august', 'авг', 'август'], value: 8 },
                    { keys: ['sep', 'sept', 'september', 'сен', 'сентябр'], value: 9 },
                    { keys: ['oct', 'october', 'окт', 'октябр'], value: 10 },
                    { keys: ['nov', 'november', 'ноя', 'ноябр'], value: 11 },
                    { keys: ['dec', 'december', 'дек', 'декабр'], value: 12 },
                ];
                for (const alias of aliases) {
                    if (alias.keys.some(key => month.startsWith(key))) return alias.value;
                }
                return null;
            };
            const build_datetime = function ({ year, month, day, hour, minute, second = 0, millisecond = 0, can_roll_year = false }) {
                const y = Number(year);
                const m = Number(month);
                const d = Number(day);
                const hh = Number(hour);
                const mm = Number(minute);
                const ss = Number(second);
                const ms = Number(millisecond);
                if (![y, m, d, hh, mm, ss, ms].every(Number.isFinite)) return null;
                if (m < 1 || m > 12 || d < 1 || d > 31 || hh > 23 || mm > 59 || ss > 59 || ms > 999) return null;
                const parsed = new Date(y, m - 1, d, hh, mm, ss, ms);
                if (
                    parsed.getFullYear() !== y ||
                    parsed.getMonth() !== m - 1 ||
                    parsed.getDate() !== d ||
                    parsed.getHours() !== hh ||
                    parsed.getMinutes() !== mm ||
                    parsed.getSeconds() !== ss
                ) {
                    return null;
                }
                if (can_roll_year && parsed.getTime() < now.getTime() - 12 * 60 * 60 * 1000) {
                    const rolled = new Date(y + 1, m - 1, d, hh, mm, ss, ms);
                    if (rolled.getFullYear() === y + 1 && rolled.getMonth() === m - 1 && rolled.getDate() === d) {
                        return rolled.getTime();
                    }
                }
                return parsed.getTime();
            };
            const take_last_match = function (regex) {
                let last = null;
                let match = null;
                regex.lastIndex = 0;
                while ((match = regex.exec(source)) !== null) last = match;
                return last;
            };

            const date_match = take_last_match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\.?\s*(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?/gi);
            if (date_match) {
                const explicit_year = Helper.clean_text(date_match[3] || '');
                const year = explicit_year
                    ? Number(explicit_year.length === 2 ? `20${explicit_year}` : explicit_year)
                    : now.getFullYear();
                const parsed = build_datetime({
                    year,
                    month: date_match[2],
                    day: date_match[1],
                    hour: date_match[4],
                    minute: date_match[5],
                    second: date_match[6] || 0,
                    millisecond: date_match[7] || 0,
                    can_roll_year: !explicit_year,
                });
                if (Number.isFinite(parsed)) return parsed;
            }

            const month_name_match = take_last_match(/([a-zа-яё]{3,12})\.?\s+(\d{1,2})\s*,\s*(\d{4})\s*(?:г\.?)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?/gi);
            if (month_name_match) {
                const month_number = month_name_to_number(month_name_match[1]);
                if (Number.isFinite(month_number)) {
                    const parsed = build_datetime({
                        year: month_name_match[3],
                        month: month_number,
                        day: month_name_match[2],
                        hour: month_name_match[4],
                        minute: month_name_match[5],
                        second: month_name_match[6] || 0,
                        millisecond: month_name_match[7] || 0,
                    });
                    if (Number.isFinite(parsed)) return parsed;
                }
            }

            const relative_match = take_last_match(/(сегодня|today|завтра|tomorrow)\s*(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?/gi);
            if (relative_match) {
                const token = String(relative_match[1] || '').toLowerCase();
                const shift_days = token === 'завтра' || token === 'tomorrow' ? 1 : 0;
                const basis = new Date(now.getFullYear(), now.getMonth(), now.getDate() + shift_days, 0, 0, 0, 0);
                const parsed = build_datetime({
                    year: basis.getFullYear(),
                    month: basis.getMonth() + 1,
                    day: basis.getDate(),
                    hour: relative_match[2],
                    minute: relative_match[3],
                    second: relative_match[4] || 0,
                    millisecond: relative_match[5] || 0,
                });
                if (Number.isFinite(parsed)) return parsed;
            }

            const time_match = take_last_match(/(?:^|\s)(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?(?!\d)/g);
            if (time_match) {
                const parsed = build_datetime({
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                    day: now.getDate(),
                    hour: time_match[1],
                    minute: time_match[2],
                    second: time_match[3] || 0,
                    millisecond: time_match[4] || 0,
                });
                if (Number.isFinite(parsed)) return parsed;
            }

            return null;
        },

        get_arrival_text_from_click_target: function (target) {
            if (!target) return null;
            const copy_node = target.closest('[data-copy-time]');
            if (copy_node) {
                const copied = Helper.clean_text(copy_node.getAttribute('data-copy-time') || '');
                if (copied) return copied;
            }
            const command_row = target.closest('tr.command-row');
            if (command_row && command_row.cells && command_row.cells.length > 1) {
                const text = Helper.clean_text(command_row.cells[1].textContent || '');
                if (text) return text;
            }
            const td = target.closest('td');
            if (td) {
                const text = Helper.clean_text(td.textContent || '');
                if (text) return text;
            }
            return Helper.clean_text(target.textContent || '') || null;
        },

        apply_arrival_from_click: function (arrival_ms) {
            if (!Number.isFinite(arrival_ms)) return false;
            const date_control = Helper.get_control('arrival_date');
            const time_control = Helper.get_control('arrival_time');
            if (date_control) date_control.value = Helper.format_date_ymd(arrival_ms);
            if (time_control) time_control.value = Helper.format_hms(arrival_ms);
            Off.sync_settings_from_ui();
            return true;
        },

        bind_external_arrival_picker: function () {
            const event_namespace = '.ScriptMMOffArrivalPicker';
            jQuery(document).off(`click${event_namespace}`);
            jQuery(document).on(`click${event_namespace}`, event => {
                const root = Helper.get_control();
                if (!root) return;
                const target = event.target && event.target.nodeType === 1
                    ? event.target
                    : event.target && event.target.parentElement
                        ? event.target.parentElement
                        : null;
                if (!target || root.contains(target)) return;
                const clicked_text = Off.get_arrival_text_from_click_target(target);
                const from_copy_attr = !!target.closest('[data-copy-time]');
                if (!from_copy_attr && !/(сегодня|завтра|today|tomorrow|\d{1,2}\.\d{1,2}|[a-zа-яё]{3,12}\.?\s+\d{1,2})/i.test(String(clicked_text || ''))) {
                    return;
                }
                const arrival_ms = Off.parse_arrival_from_text(clicked_text);
                if (!Number.isFinite(arrival_ms)) return;
                if (Off.apply_arrival_from_click(arrival_ms)) {
                    UI.SuccessMessage(`Вставлено время прихода: ${Helper.format_date_ymd(arrival_ms)} ${Helper.format_hms(arrival_ms)}`);
                }
            });
        },

        unbind_external_arrival_picker: function () {
            jQuery(document).off('.ScriptMMOffArrivalPicker');
        },

        set_targets_to_current_coord: function () {
            const coord = Off.extract_current_coord();
            const targets = Helper.get_control('targets');
            if (!coord || !targets) {
                UI.ErrorMessage('Не удалось определить текущую кору');
                return;
            }
            targets.value = coord;
            Off.sync_settings_from_ui();
            UI.SuccessMessage(`Подставлена кора: ${coord}`);
        },

        init_gui: async function () {
            const strategy = Helper.get_control('strategy');
            Object.keys(STRATEGIES).forEach(key => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = STRATEGIES[key];
                strategy.append(option);
            });

            const groups_info = await Off.get_groups_info();
            const group = Helper.get_control('group');
            for (const group_info of groups_info.result) {
                const option = document.createElement('option');
                option.value = group_info.group_id;
                option.textContent = group_info.name;
                group.append(option);
            }
            group.value = Off.settings.group === '-1' ? groups_info.group_id : Off.settings.group;

            await Off.get_world_info();
            Off.apply_settings_to_ui();
            Off.bind_external_arrival_picker();

            ['targets', 'group', 'strategy', 'arrival_date', 'arrival_time'].forEach(control_name => {
                const control = Helper.get_control(control_name);
                if (!control) return;
                control.addEventListener('change', () => Off.sync_settings_from_ui());
                if (control.tagName === 'TEXTAREA' || control.tagName === 'INPUT') {
                    control.addEventListener('input', () => Off.sync_settings_from_ui());
                }
            });

            [
                ['offset_from_range', 'from_range'],
                ['offset_to_range', 'to_range'],
                ['offset_from_min', 'from_input'],
                ['offset_to_min', 'to_input'],
            ].forEach(([control_name, changed]) => {
                const control = Helper.get_control(control_name);
                if (!control) return;
                control.addEventListener('input', () => {
                    Off.sync_range_controls(changed);
                    Off.sync_settings_from_ui();
                });
                control.addEventListener('change', () => {
                    Off.sync_range_controls(changed);
                    Off.sync_settings_from_ui();
                });
            });

            Off.off_units.forEach(unit_name => {
                const control = Helper.get_control(`unit.${unit_name}`);
                if (!control) return;
                control.addEventListener('change', () => Off.sync_settings_from_ui());
            });

            Helper.get_control('insert_current_target').addEventListener('click', () => Off.set_targets_to_current_coord());
            Helper.get_control('generate').addEventListener('click', () => Off.generate_commands());
            Helper.get_control('output').addEventListener('input', event => {
                const row = event.target.closest('.off-row');
                if (!row) return;
                if (event.target.classList.contains('off-row-scale')) {
                    Off.apply_row_scale(row);
                } else if (event.target.classList.contains('off-unit-input')) {
                    Off.update_row_state(row);
                }
            });
            Helper.get_control('output').addEventListener('change', event => {
                const row = event.target.closest('.off-row');
                if (!row) return;
                if (event.target.classList.contains('off-row-scale')) {
                    Off.apply_row_scale(row);
                } else if (event.target.classList.contains('off-unit-input')) {
                    Off.update_row_state(row);
                }
            });
            Helper.get_control('output').addEventListener('click', event => {
                const button = event.target.closest('.off-go-btn');
                if (!button || button.disabled) return;
                const url = Helper.clean_text(button.dataset.url);
                if (!url) return;
                window.open(url, '_blank', 'noopener');
            });
        },

        main: async function () {
            const instance = Helper.get_control();
            if (instance) {
                instance.remove();
                Off.unbind_external_arrival_picker();
                if (Off.countdown_timer_id) clearInterval(Off.countdown_timer_id);
                return;
            }

            Off.init_settings();
            Off.inject_styles();
            Off.create_gui();

            $.ajax({
                url: 'https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskiePlikiMapy.js?_=' + ~~(Date.now() / 9e6),
                dataType: 'script',
                cache: true,
            }).then(() => {
                Off.init_gui().catch(Helper.handle_error);
            });
        },
    };

    try {
        await Off.main();
    } catch (ex) {
        Helper.handle_error(ex);
    }

    console.log(`${namespace} | Elapsed time: ${Date.now() - start} [ms]`);
})(TribalWars);

(async function (TribalWars) {
    const start = Date.now();
    const namespace = 'Hermitowski.Guard';

    const i18n = {
        SETTINGS_SAVED: 'Настройки сохранены',
        SETTINGS_RESETED: 'Настройки сброшены',
        CURRENTLY_SELECTED_GROUP: 'Выбранная группа',
        ERROR_MESSAGE: 'Ошибка: ',
        FORUM_THREAD: 'Тема на форуме',
        FORUM_THREAD_HREF: 'https://forum.plemiona.pl/index.php?threads/hermitowska-obstawa.124587/',
        STRATEGY: {
            TROOP_ASC: 'По войскам (меньше -> больше)',
            TROOP_DESC: 'По войскам (больше -> меньше)',
            DIST_ASC: 'По расстоянию (ближе -> дальше)',
            DIST_DESC: 'По расстоянию (дальше -> ближе)',
            RANDOM: 'Случайный',
        },
        ERROR: {
            BLANK: 'Поле <strong>__1__</strong> пустое',
            NAN: 'Поле <strong>__1__</strong> не является числом',
            NEGATIVE_NUMBER: 'Поле <strong>__1__</strong> отрицательное',
            BAD_FORMAT: 'Поле <strong>__1__</strong> имеет неверный формат',
            MOBILE: 'Мобильная версия не поддерживается',
            NEW_WINDOW_BLOCKED: 'Браузер блокирует открытие новых вкладок',
            EMPTY_DEFF_SELECTION: 'Не удалось подобрать отряд',
            INVALID_VILLAGE_INFO: 'Целевая деревня не найдена: __1__',
            NO_OTHER_SUPPORT_CONFLICT: 'Мир не позволяет слать деф в деревню __1__ (другая семья)',
            EMPTY_GROUP: 'В выбранной группе нет деревень',
            NO_TEMPLATE: 'Не выбран шаблон отряда',
            EMPTY_TARGETS: 'Не найдено ни одной валидной коры',
            BAD_WINDOW: 'Окно времени прибытия заполнено неверно',
            EMPTY_PLAN: 'Подходящих отправок не найдено',
        },
        UNITS: {
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
        },
        LABELS: {
            targets: 'Список кор',
            insert_current_target: 'Вставить коры текущей',
            group: 'Группа',
            strategy: 'Стратегия',
            max_pop_per_village: 'Макс. население с деревни (всего)',
            sigil_percent: 'Сигил (%)',
            arrival_window: 'Окно прибытия (дата+время)',
            arrival_from: 'Прибытие от',
            arrival_to: 'Прибытие до',
            mode_full_deff: 'ВЕСЬ ДЕФФ',
            mode_all_units: 'ВООБЩЕ ВСЕ',
            squad: 'Отряд (шаблон)',
            create_template: 'Создать шаблон',
            edit_template: 'Редактировать',
            remove_template: 'Удалить',
            generate: 'Рассчитать',
            execute: 'Выполнить',
            execute_all: 'Выполнить всё',
            command: 'Команда',
            target: 'Цель',
            village: 'Деревня',
            distance: 'Дист.',
            arrival: 'Прибытие',
            population: 'Население',
            save_settings: 'Сохранить',
            reset_settings: 'Сбросить',
            reserve: 'Резерв',
            template_name: 'Название шаблона',
            template_empty: 'В шаблоне должен быть хотя бы 1 юнит',
            no_templates: 'Нет шаблонов',
            plan_summary_empty: 'Сначала нажми «Рассчитать»',
            plan_summary_ready: 'Готово отправок: __1__ (целей: __2__)',
        },
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

    const Helper = {
        clean_text: function (value) {
            return String(value === null || value === undefined ? '' : value).trim();
        },
        to_int: function (value) {
            const n = Number(String(value === null || value === undefined ? '' : value).replace(/\s+/g, '').replace(/[^\d-]/g, ''));
            return Number.isFinite(n) ? Math.trunc(n) : 0;
        },
        deep_clone: function (value) {
            return JSON.parse(JSON.stringify(value));
        },
        format_hms: function (epoch_ms) {
            const date = new Date(Number(epoch_ms));
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        },
        format_date_ymd: function (epoch_ms) {
            const date = new Date(Number(epoch_ms));
            if (!Number.isFinite(date.getTime())) {
                const fallback = new Date();
                return Helper.format_date_ymd(fallback.getTime());
            }
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        },
        normalize_time_input_value: function (value, fallback_ms = Date.now()) {
            const raw = Helper.clean_text(value);
            if (!raw) return Helper.format_hms(fallback_ms);
            try {
                const sec = Helper.parse_clock_to_sec(raw, 'time');
                const hh = Math.floor(sec / 3600);
                const mm = Math.floor((sec % 3600) / 60);
                const ss = sec % 60;
                return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
            } catch (ex) {
                return Helper.format_hms(fallback_ms);
            }
        },
        normalize_date_input_value: function (value, fallback_ms = Date.now()) {
            const raw = Helper.clean_text(value);
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
            return Helper.format_date_ymd(fallback_ms);
        },
        parse_datetime_from_date_and_time: function (date_value, time_value, replacement, fallback_ms = Date.now()) {
            const safe_date = Helper.normalize_date_input_value(date_value, fallback_ms);
            const safe_time = Helper.normalize_time_input_value(time_value, fallback_ms);
            return Helper.parse_datetime_local(`${safe_date}T${safe_time}`, replacement);
        },
        format_distance: function (distance) {
            const safe = Number(distance);
            return Number.isFinite(safe) ? safe.toFixed(2) : '-';
        },
        beautify_number: function (number) {
            let value = Number(number);
            if (!Number.isFinite(value)) return '0';
            let prefix = ['', 'K', 'M', 'G'];
            for (let i = 0; i < prefix.length; i++) {
                if (value >= 1000) {
                    value /= 1000;
                } else {
                    if (i === 0) return value.toFixed(0);
                    let fraction = 2;
                    if (value >= 10) fraction = 1;
                    if (value >= 100) fraction = 0;
                    return `${value.toFixed(fraction)}${prefix[i]}`;
                }
            }
            return `${value.toFixed(0)}T`;
        },
        parse_clock_to_sec: function (clock_value, replacement) {
            const raw = Helper.clean_text(clock_value);
            if (!raw) {
                throw i18n.ERROR.BLANK.replace('__1__', replacement);
            }
            const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            if (!match) {
                throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
            }
            const hh = Number(match[1]);
            const mm = Number(match[2]);
            const ss = match[3] === undefined ? 0 : Number(match[3]);
            if (hh > 23 || mm > 59 || ss > 59) {
                throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
            }
            return hh * 3600 + mm * 60 + ss;
        },
        format_datetime_local: function (epoch_ms) {
            const date = new Date(Number(epoch_ms));
            if (!Number.isFinite(date.getTime())) {
                const fallback = new Date();
                return Helper.format_datetime_local(fallback.getTime());
            }
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
        },
        parse_datetime_local: function (datetime_value, replacement, options = {}) {
            const raw = Helper.clean_text(datetime_value);
            if (!raw) {
                throw i18n.ERROR.BLANK.replace('__1__', replacement);
            }

            const allow_time_only = !!options.allow_time_only;
            const base_date_ms = Number.isFinite(Number(options.base_date_ms))
                ? Number(options.base_date_ms)
                : Date.now();

            const time_match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
            if (allow_time_only && time_match) {
                const hh = Number(time_match[1]);
                const mm = Number(time_match[2]);
                const ss = time_match[3] === undefined ? 0 : Number(time_match[3]);
                if (hh > 23 || mm > 59 || ss > 59) {
                    throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
                }
                const basis = new Date(base_date_ms);
                return new Date(
                    basis.getFullYear(),
                    basis.getMonth(),
                    basis.getDate(),
                    hh,
                    mm,
                    ss,
                    0,
                ).getTime();
            }

            const normalized = raw.replace(' ', 'T');
            const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
            if (!match) {
                throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
            }

            const year = Number(match[1]);
            const month = Number(match[2]);
            const day = Number(match[3]);
            const hour = Number(match[4]);
            const minute = Number(match[5]);
            const second = match[6] === undefined ? 0 : Number(match[6]);

            if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
                throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
            }

            const parsed = new Date(year, month - 1, day, hour, minute, second, 0);
            if (
                parsed.getFullYear() !== year ||
                parsed.getMonth() !== month - 1 ||
                parsed.getDate() !== day ||
                parsed.getHours() !== hour ||
                parsed.getMinutes() !== minute ||
                parsed.getSeconds() !== second
            ) {
                throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
            }
            return parsed.getTime();
        },
        normalize_datetime_local_value: function (value, fallback_ms = Date.now()) {
            const fallback = Helper.format_datetime_local(fallback_ms);
            const raw = Helper.clean_text(value);
            if (!raw) return fallback;
            try {
                const parsed_ms = Helper.parse_datetime_local(raw, 'datetime', {
                    allow_time_only: true,
                    base_date_ms: fallback_ms,
                });
                return Helper.format_datetime_local(parsed_ms);
            } catch (ex) {
                return fallback;
            }
        },
        assert_non_negative_number: function (input, replacement) {
            const value = input.value;
            if (/^\s*$/.test(String(value))) {
                input.focus();
                throw i18n.ERROR.BLANK.replace('__1__', replacement);
            }
            const numeric_value = Number(value);
            if (isNaN(numeric_value)) {
                input.focus();
                throw i18n.ERROR.NAN.replace('__1__', replacement);
            }
            if (numeric_value < 0) {
                input.focus();
                throw i18n.ERROR.NEGATIVE_NUMBER.replace('__1__', replacement);
            }
        },
        assert_positive_number: function (input, replacement) {
            Helper.assert_non_negative_number(input, replacement);
            if (Number(input.value) <= 0) {
                input.focus();
                throw i18n.ERROR.BAD_FORMAT.replace('__1__', replacement);
            }
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
                const [x, y] = coord.split('|').map(x => Number(x));
                if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
                coords.push({ text: coord, x, y });
            }
            if (!coords.length) {
                throw i18n.ERROR.BLANK.replace('__1__', replacement);
            }
            return coords;
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
        delay: function (ms) {
            const timeout = Math.max(0, Helper.to_int(ms));
            return new Promise(resolve => setTimeout(resolve, timeout));
        },
        handle_error: function (error) {
            if (typeof (error) === 'string') {
                UI.ErrorMessage(error);
                return;
            }
            const gui =
                `<h2>WTF - What a Terrible Failure</h2>
                 <p><strong>${i18n.ERROR_MESSAGE}</strong><br/>
                    <textarea rows='5' cols='42'>${error}\n\n${error.stack}</textarea><br/>
                    <a href='${i18n.FORUM_THREAD_HREF}'>${i18n.FORUM_THREAD}</a>
                 </p>`;
            Dialog.show(namespace, gui);
        },
    };

    const Guard = {
        _village_info: {
            ALLY_ID: 11,
            VILLAGE_ID: 0,
        },
        coords2map_chunk: new Map(),
        group_id2villages: new Map(),
        group_id2group_name: {
            '-1': i18n.CURRENTLY_SELECTED_GROUP,
        },
        strategies: {
            TROOP_DESC: i18n.STRATEGY.TROOP_DESC,
            TROOP_ASC: i18n.STRATEGY.TROOP_ASC,
            DIST_DESC: i18n.STRATEGY.DIST_DESC,
            DIST_ASC: i18n.STRATEGY.DIST_ASC,
            RANDOM: i18n.STRATEGY.RANDOM,
        },
        default_settings: {
            safeguard: {
                spear: 0,
                sword: 0,
                axe: 0,
                archer: 0,
                spy: 0,
                light: 0,
                marcher: 0,
                heavy: 0,
                ram: 0,
                catapult: 0,
                knight: 0,
                snob: 0,
            },
            input: {
                targets: '',
                group: '-1',
                strategy: 'DIST_ASC',
                max_pop_per_village: 500,
                sigil_percent: 0,
                arrival_from_enabled: false,
                arrival_to_enabled: false,
                arrival_from_date: '',
                arrival_from_time: '',
                arrival_to_date: '',
                arrival_to_time: '',
                mode_full_deff: false,
                mode_all_units: false,
            },
            templates: [],
            active_template_id: null,
        },
        deff_units: [],
        settings: {},
        world_info: null,
        generated_plan: [],
        last_group_id: null,
        arrival_pick_next_slot: 'from',

        inject_styles: function () {
            const style_id = `${namespace}.styles`;
            if (document.getElementById(style_id)) return;
            const style = document.createElement('style');
            style.id = style_id;
            style.textContent = `
.guard-root .guard-main-panel{padding:8px}
.guard-root .guard-label{display:block;font-weight:bold;margin:4px 0}
.guard-root .guard-targets-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.guard-root .guard-targets-insert{margin:0}
.guard-root .guard-targets{width:100%;box-sizing:border-box;min-height:86px;resize:vertical;font:12px/1.35 monospace}
.guard-root .guard-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin-top:8px}
.guard-root .guard-field input,.guard-root .guard-field select{width:100%;box-sizing:border-box}
.guard-root .guard-window{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.guard-root .guard-window input[type="date"]{min-width:145px}
.guard-root .guard-window input[type="time"]{min-width:105px}
.guard-root .guard-mode-window{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:8px}
.guard-root .guard-template-block{margin-top:10px;border:1px solid #c2a97d;background:#f7f0df;padding:8px;border-radius:4px}
.guard-root .guard-template-toolbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px}
.guard-root .guard-template-select{flex:1;min-width:220px}
.guard-root .guard-template-preview{display:flex;flex-wrap:wrap;gap:8px;min-height:28px;align-items:center}
.guard-root .guard-template-chip{display:inline-flex;align-items:center;gap:4px;background:#fff8ea;border:1px solid #c7b28a;border-radius:4px;padding:2px 6px;font-size:11px}
.guard-root .guard-actions{display:flex;gap:8px;align-items:center;margin-top:10px}
.guard-root .guard-actions .btn{margin:0}
.guard-root .guard-output-table{width:100%;border-collapse:collapse}
.guard-root .guard-output-table th,.guard-root .guard-output-table td{border:1px solid #e2d5bd;padding:3px 4px;text-align:center;vertical-align:middle;font-size:11px}
.guard-root .guard-output-table th{background:#f0e2c6}
.guard-root .guard-output-table .guard-target-cell{font-weight:bold;background:#fff7e7}
.guard-root .guard-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 6px 6px 6px;font-size:12px}
.guard-root .guard-template-modal-overlay{position:fixed;inset:0;z-index:400000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}
.guard-root .guard-template-modal{background:#f3ead5;border:2px solid #b08b4f;border-radius:10px;width:520px;max-width:95vw;max-height:92vh;overflow:auto;box-shadow:0 12px 30px rgba(0,0,0,.35)}
.guard-root .guard-template-modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #d9c5a0;font-weight:bold}
.guard-root .guard-template-modal-body{padding:12px}
.guard-root .guard-template-modal-close{border:0;background:#e74c3c;color:#fff;width:24px;height:24px;border-radius:4px;cursor:pointer}
.guard-root .guard-template-modal-name{width:100%;box-sizing:border-box;margin-bottom:10px}
.guard-root .guard-template-unit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}
.guard-root .guard-template-unit-row{display:flex;align-items:center;gap:6px;background:#fffbe8;border:1px solid #d4c4a0;border-radius:6px;padding:6px}
.guard-root .guard-template-unit-row input{width:100%;box-sizing:border-box}
`; 
            document.head.append(style);
        },

        normalize_template_units: function (source_units) {
            const units = {};
            const src = source_units && typeof source_units === 'object' ? source_units : {};
            for (const unit_name of Guard.deff_units) {
                const count = Math.max(0, Helper.to_int(src[unit_name]));
                if (count > 0) {
                    units[unit_name] = count;
                }
            }
            return units;
        },

        build_default_template_units: function () {
            const units = {};
            const preferred = ['spear', 'sword', 'heavy', 'archer'];
            for (const unit_name of preferred) {
                if (Guard.deff_units.includes(unit_name)) {
                    units[unit_name] = 1;
                }
            }
            if (!Object.keys(units).length && Guard.deff_units.length) {
                units[Guard.deff_units[0]] = 1;
            }
            return units;
        },

        normalize_settings: function (stored) {
            const base = Helper.deep_clone(Guard.default_settings);
            if (!stored || typeof stored !== 'object') {
                return base;
            }

            if (stored.safeguard && typeof stored.safeguard === 'object') {
                for (const unit_name of Object.keys(base.safeguard)) {
                    if (stored.safeguard[unit_name] === undefined) continue;
                    base.safeguard[unit_name] = Math.max(0, Helper.to_int(stored.safeguard[unit_name]));
                }
            }

            if (stored.input && typeof stored.input === 'object') {
                const input = stored.input;
                const now_ms = Date.now();
                const default_from_ms = now_ms;
                const default_to_ms = now_ms + 60 * 60 * 1000;

                const resolve_datetime_parts = function ({
                    raw_date,
                    raw_time,
                    raw_dt,
                    raw_legacy_time,
                    fallback_ms,
                }) {
                    let resolved_ms = null;

                    const source_dt = Helper.clean_text(raw_dt);
                    if (source_dt) {
                        try {
                            resolved_ms = Helper.parse_datetime_local(source_dt, 'datetime', {
                                allow_time_only: true,
                                base_date_ms: fallback_ms,
                            });
                        } catch (ex) {
                            resolved_ms = null;
                        }
                    }

                    if (!Number.isFinite(resolved_ms)) {
                        const source_date = Helper.clean_text(raw_date);
                        const source_time = Helper.clean_text(raw_time);
                        if (source_date || source_time) {
                            try {
                                resolved_ms = Helper.parse_datetime_from_date_and_time(
                                    source_date || Helper.format_date_ymd(fallback_ms),
                                    source_time || Helper.format_hms(fallback_ms),
                                    'datetime',
                                    fallback_ms,
                                );
                            } catch (ex) {
                                resolved_ms = null;
                            }
                        }
                    }

                    if (!Number.isFinite(resolved_ms)) {
                        const legacy_time = Helper.clean_text(raw_legacy_time);
                        if (legacy_time) {
                            try {
                                resolved_ms = Helper.parse_datetime_from_date_and_time(
                                    Helper.format_date_ymd(fallback_ms),
                                    legacy_time,
                                    'datetime',
                                    fallback_ms,
                                );
                            } catch (ex) {
                                resolved_ms = null;
                            }
                        }
                    }

                    if (!Number.isFinite(resolved_ms)) {
                        resolved_ms = fallback_ms;
                    }

                    return {
                        date: Helper.format_date_ymd(resolved_ms),
                        time: Helper.normalize_time_input_value(Helper.format_hms(resolved_ms), resolved_ms),
                    };
                };

                base.input.targets = Helper.clean_text(input.targets || '');
                base.input.group = Helper.clean_text(input.group || base.input.group) || '-1';
                base.input.strategy = Guard.strategies[input.strategy]
                    ? input.strategy
                    : base.input.strategy;
                base.input.max_pop_per_village = Math.max(1, Helper.to_int(input.max_pop_per_village) || base.input.max_pop_per_village);
                base.input.sigil_percent = Math.max(
                    0,
                    Math.min(
                        50,
                        Helper.to_int(input.sigil_percent !== undefined ? input.sigil_percent : input.sigilPercent),
                    ),
                );
                const legacy_window_enabled = !!input.arrival_window_enabled;
                base.input.arrival_from_enabled = input.arrival_from_enabled !== undefined
                    ? !!input.arrival_from_enabled
                    : legacy_window_enabled;
                base.input.arrival_to_enabled = input.arrival_to_enabled !== undefined
                    ? !!input.arrival_to_enabled
                    : legacy_window_enabled;

                const from_parts = resolve_datetime_parts({
                    raw_date: input.arrival_from_date,
                    raw_time: input.arrival_from_time,
                    raw_dt: input.arrival_from_dt,
                    raw_legacy_time: input.arrival_from,
                    fallback_ms: default_from_ms,
                });
                const to_parts = resolve_datetime_parts({
                    raw_date: input.arrival_to_date,
                    raw_time: input.arrival_to_time,
                    raw_dt: input.arrival_to_dt,
                    raw_legacy_time: input.arrival_to,
                    fallback_ms: default_to_ms,
                });
                base.input.arrival_from_date = from_parts.date;
                base.input.arrival_from_time = from_parts.time;
                base.input.arrival_to_date = to_parts.date;
                base.input.arrival_to_time = to_parts.time;
                base.input.mode_full_deff = !!input.mode_full_deff;
                base.input.mode_all_units = !!input.mode_all_units;
                if (base.input.mode_full_deff && base.input.mode_all_units) {
                    base.input.mode_all_units = false;
                }
            }

            const normalize_now_ms = Date.now();
            base.input.arrival_from_date = Helper.normalize_date_input_value(
                base.input.arrival_from_date,
                normalize_now_ms,
            );
            base.input.arrival_from_time = Helper.normalize_time_input_value(
                base.input.arrival_from_time,
                normalize_now_ms,
            );
            base.input.arrival_to_date = Helper.normalize_date_input_value(
                base.input.arrival_to_date,
                normalize_now_ms + 60 * 60 * 1000,
            );
            base.input.arrival_to_time = Helper.normalize_time_input_value(
                base.input.arrival_to_time,
                normalize_now_ms + 60 * 60 * 1000,
            );
            base.input.sigil_percent = Math.max(
                0,
                Math.min(50, Helper.to_int(base.input.sigil_percent)),
            );
            base.input.mode_full_deff = !!base.input.mode_full_deff;
            base.input.mode_all_units = !!base.input.mode_all_units;
            if (base.input.mode_full_deff && base.input.mode_all_units) {
                base.input.mode_all_units = false;
            }

            const templates = [];
            if (Array.isArray(stored.templates)) {
                for (const raw_template of stored.templates) {
                    if (!raw_template || typeof raw_template !== 'object') continue;
                    const units = Guard.normalize_template_units(raw_template.units);
                    if (!Object.keys(units).length) continue;
                    templates.push({
                        id: Helper.clean_text(raw_template.id) || `tmpl_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        name: Helper.clean_text(raw_template.name) || `Шаблон ${templates.length + 1}`,
                        units,
                    });
                }
            }
            base.templates = templates;

            const active_template_id = Helper.clean_text(stored.active_template_id || '');
            base.active_template_id = active_template_id || null;

            return base;
        },

        ensure_templates: function () {
            if (!Array.isArray(Guard.settings.templates)) {
                Guard.settings.templates = [];
            }
            Guard.settings.templates = Guard.settings.templates
                .map(template => {
                    const units = Guard.normalize_template_units(template && template.units);
                    if (!Object.keys(units).length) return null;
                    return {
                        id: Helper.clean_text(template.id) || `tmpl_${Date.now()}_${Math.random().toString(16).slice(2)}`,
                        name: Helper.clean_text(template.name) || 'Шаблон',
                        units,
                    };
                })
                .filter(Boolean);

            if (!Guard.settings.templates.length) {
                Guard.settings.templates.push({
                    id: `tmpl_default_${Date.now()}`,
                    name: 'Деф шаблон',
                    units: Guard.build_default_template_units(),
                });
            }

            const has_active = Guard.settings.templates.some(t => t.id === Guard.settings.active_template_id);
            if (!has_active) {
                Guard.settings.active_template_id = Guard.settings.templates[0].id;
            }
        },

        get_default_settings: function () {
            let stored_settings = null;
            try {
                stored_settings = JSON.parse(localStorage.getItem(namespace));
            } catch (ex) {
                stored_settings = null;
            }
            return Guard.normalize_settings(stored_settings);
        },

        save_settings: function () {
            Guard.ensure_templates();
            localStorage.setItem(namespace, JSON.stringify(Guard.settings));
        },

        init_settings: function () {
            Guard.deff_units = Object.keys(Guard.default_settings.safeguard)
                .filter(unit_name => game_data.units.includes(unit_name));

            Guard.settings = Guard.get_default_settings();

            const filtered_safeguard = {};
            for (const unit_name of Guard.deff_units) {
                filtered_safeguard[unit_name] = Math.max(0, Helper.to_int(Guard.settings.safeguard[unit_name]));
            }
            Guard.settings.safeguard = filtered_safeguard;
            Guard.ensure_templates();
            Guard.save_settings();
        },

        create_main_panel: function () {
            const panel = document.createElement('div');
            panel.classList.add('vis', 'vis_item', 'guard-main-panel');
            panel.style.margin = '5px';

            const targets_id = Helper.get_id('targets');
            const group_id = Helper.get_id('group');
            const strategy_id = Helper.get_id('strategy');
            const max_pop_id = Helper.get_id('max_pop_per_village');
            const sigil_id = Helper.get_id('sigil_percent');
            const arrival_from_enabled_id = Helper.get_id('is_arrival_from_enabled');
            const arrival_to_enabled_id = Helper.get_id('is_arrival_to_enabled');
            const arrival_from_date_id = Helper.get_id('arrival_from_date');
            const arrival_from_time_id = Helper.get_id('arrival_from_time');
            const arrival_to_date_id = Helper.get_id('arrival_to_date');
            const arrival_to_time_id = Helper.get_id('arrival_to_time');
            const template_select_id = Helper.get_id('template');
            const preview_id = Helper.get_id('template_preview');
            const create_template_id = Helper.get_id('create_template');
            const edit_template_id = Helper.get_id('edit_template');
            const remove_template_id = Helper.get_id('remove_template');
            const generate_id = Helper.get_id('generate');
            const execute_all_id = Helper.get_id('execute_all');
            const settings_id = Helper.get_id('settings');
            const insert_current_target_id = Helper.get_id('insert_current_target');
            const mode_full_deff_id = Helper.get_id('mode_full_deff');
            const mode_all_units_id = Helper.get_id('mode_all_units');

            panel.innerHTML = `
                <div class="guard-targets-head">
                    <label class="guard-label" for="${targets_id}">${i18n.LABELS.targets}</label>
                    <button id="${insert_current_target_id}" class="btn guard-targets-insert" type="button">${i18n.LABELS.insert_current_target}</button>
                </div>
                <textarea id="${targets_id}" class="guard-targets" rows="5" placeholder="444|555\n445|556"></textarea>

                <div class="guard-grid">
                    <div class="guard-field">
                        <label class="guard-label" for="${group_id}">${i18n.LABELS.group}</label>
                        <select id="${group_id}"></select>
                    </div>
                    <div class="guard-field">
                        <label class="guard-label" for="${strategy_id}">${i18n.LABELS.strategy}</label>
                        <select id="${strategy_id}"></select>
                    </div>
                    <div class="guard-field">
                        <label class="guard-label" for="${max_pop_id}">${i18n.LABELS.max_pop_per_village}</label>
                        <input id="${max_pop_id}" type="number" min="1" step="1">
                    </div>
                    <div class="guard-field">
                        <label class="guard-label" for="${sigil_id}">${i18n.LABELS.sigil_percent}</label>
                        <input id="${sigil_id}" type="number" min="0" max="50" step="1">
                    </div>
                </div>

                <div class="guard-window">
                    <label><input id="${arrival_from_enabled_id}" type="checkbox"> ${i18n.LABELS.arrival_from}</label>
                    <input id="${arrival_from_date_id}" type="date">
                    <input id="${arrival_from_time_id}" type="time" step="1">
                    <label><input id="${arrival_to_enabled_id}" type="checkbox"> ${i18n.LABELS.arrival_to}</label>
                    <input id="${arrival_to_date_id}" type="date">
                    <input id="${arrival_to_time_id}" type="time" step="1">
                </div>
                <div class="guard-mode-window">
                    <label><input id="${mode_full_deff_id}" type="checkbox"> ${i18n.LABELS.mode_full_deff}</label>
                    <label><input id="${mode_all_units_id}" type="checkbox"> ${i18n.LABELS.mode_all_units}</label>
                </div>

                <div class="guard-template-block">
                    <label class="guard-label">${i18n.LABELS.squad}</label>
                    <div class="guard-template-toolbar">
                        <select id="${template_select_id}" class="guard-template-select"></select>
                        <button id="${create_template_id}" class="btn" type="button">${i18n.LABELS.create_template}</button>
                        <button id="${edit_template_id}" class="btn" type="button">${i18n.LABELS.edit_template}</button>
                        <button id="${remove_template_id}" class="btn" type="button">${i18n.LABELS.remove_template}</button>
                    </div>
                    <div id="${preview_id}" class="guard-template-preview"></div>
                </div>

                <div class="guard-actions">
                    <button id="${generate_id}" class="btn" type="button">${i18n.LABELS.generate}</button>
                    <button id="${execute_all_id}" class="btn" type="button" disabled>${i18n.LABELS.execute_all}</button>
                    <img id="${settings_id}" src="${image_base}icons/settings.png" alt="settings" style="margin-left:auto;cursor:pointer;" title="Резерв">
                </div>
            `;

            return panel;
        },

        create_output_panel: function () {
            const panel = document.createElement('div');
            panel.classList.add('vis', 'vis_item');
            panel.style.margin = '5px';
            panel.style.height = '280px';
            panel.style.overflowY = 'auto';

            const table = document.createElement('table');
            table.classList.add('guard-output-table');

            const header = document.createElement('thead');
            const header_row = document.createElement('tr');

            const base_headers = [
                i18n.LABELS.target,
                i18n.LABELS.village,
                i18n.LABELS.distance,
                i18n.LABELS.arrival,
                i18n.LABELS.population,
            ];
            for (const caption of base_headers) {
                const th = document.createElement('th');
                th.textContent = caption;
                header_row.append(th);
            }

            for (const unit_name of Guard.deff_units) {
                const th = document.createElement('th');
                const icon = document.createElement('img');
                icon.src = `${image_base}unit/unit_${unit_name}.png`;
                icon.alt = unit_name;
                icon.title = i18n.UNITS[unit_name] || unit_name;
                th.append(icon);
                header_row.append(th);
            }

            const command_header = document.createElement('th');
            command_header.textContent = i18n.LABELS.command;
            header_row.append(command_header);

            header.append(header_row);

            const body = document.createElement('tbody');
            body.id = Helper.get_id('output');

            table.append(header);
            table.append(body);
            panel.append(table);
            return panel;
        },

        create_bottom_panel: function () {
            const panel = document.createElement('div');
            panel.classList.add('vis_item', 'guard-summary');
            panel.style.margin = '0 5px 5px 5px';

            const summary = document.createElement('span');
            summary.id = Helper.get_id('plan_summary');
            summary.textContent = i18n.LABELS.plan_summary_empty;

            panel.append(summary);
            return panel;
        },

        create_gui: function () {
            const root = document.createElement('div');
            root.id = Helper.get_id();
            root.classList.add('vis', 'vis_item', 'guard-root');
            root.style.padding = '0';
            root.style.margin = '0 0 5px 0';
            root.append(Guard.create_main_panel());
            root.append(Guard.create_output_panel());
            root.append(Guard.create_bottom_panel());
            if (typeof mobile !== 'undefined' && mobile) {
                jQuery('#content_value').prepend(root);
            } else {
                document.querySelector('#contentContainer').prepend(root);
            }
        },

        sync_settings_from_ui: function () {
            const targets = Helper.get_control('targets');
            const group = Helper.get_control('group');
            const strategy = Helper.get_control('strategy');
            const max_pop = Helper.get_control('max_pop_per_village');
            const sigil = Helper.get_control('sigil_percent');
            const arrival_from_enabled = Helper.get_control('is_arrival_from_enabled');
            const arrival_to_enabled = Helper.get_control('is_arrival_to_enabled');
            const arrival_from_date = Helper.get_control('arrival_from_date');
            const arrival_from_time = Helper.get_control('arrival_from_time');
            const arrival_to_date = Helper.get_control('arrival_to_date');
            const arrival_to_time = Helper.get_control('arrival_to_time');
            const mode_full_deff = Helper.get_control('mode_full_deff');
            const mode_all_units = Helper.get_control('mode_all_units');
            const template_select = Helper.get_control('template');

            Guard.settings.input.targets = targets ? String(targets.value || '') : '';
            Guard.settings.input.group = group ? String(group.value || '-1') : '-1';
            Guard.settings.input.strategy = strategy ? String(strategy.value || 'DIST_ASC') : 'DIST_ASC';
            Guard.settings.input.max_pop_per_village = Math.max(1, Helper.to_int(max_pop ? max_pop.value : 0) || 1);
            Guard.settings.input.sigil_percent = Math.max(0, Math.min(50, Helper.to_int(sigil ? sigil.value : 0)));
            Guard.settings.input.arrival_from_enabled = !!(arrival_from_enabled && arrival_from_enabled.checked);
            Guard.settings.input.arrival_to_enabled = !!(arrival_to_enabled && arrival_to_enabled.checked);
            Guard.settings.input.arrival_from_date = Helper.normalize_date_input_value(
                arrival_from_date ? arrival_from_date.value : '',
                Date.now(),
            );
            Guard.settings.input.arrival_from_time = Helper.normalize_time_input_value(
                arrival_from_time ? arrival_from_time.value : '',
                Date.now(),
            );
            Guard.settings.input.arrival_to_date = Helper.normalize_date_input_value(
                arrival_to_date ? arrival_to_date.value : '',
                Date.now() + 60 * 60 * 1000,
            );
            Guard.settings.input.arrival_to_time = Helper.normalize_time_input_value(
                arrival_to_time ? arrival_to_time.value : '',
                Date.now() + 60 * 60 * 1000,
            );
            Guard.settings.input.mode_full_deff = !!(mode_full_deff && mode_full_deff.checked);
            Guard.settings.input.mode_all_units = !!(mode_all_units && mode_all_units.checked);
            if (Guard.settings.input.mode_full_deff && Guard.settings.input.mode_all_units) {
                Guard.settings.input.mode_all_units = false;
                if (mode_all_units) mode_all_units.checked = false;
            }

            if (template_select) {
                Guard.settings.active_template_id = Helper.clean_text(template_select.value) || Guard.settings.active_template_id;
            }

            Guard.save_settings();
        },

        apply_settings_to_ui: function () {
            const targets = Helper.get_control('targets');
            const strategy = Helper.get_control('strategy');
            const max_pop = Helper.get_control('max_pop_per_village');
            const sigil = Helper.get_control('sigil_percent');
            const arrival_from_enabled = Helper.get_control('is_arrival_from_enabled');
            const arrival_to_enabled = Helper.get_control('is_arrival_to_enabled');
            const arrival_from_date = Helper.get_control('arrival_from_date');
            const arrival_from_time = Helper.get_control('arrival_from_time');
            const arrival_to_date = Helper.get_control('arrival_to_date');
            const arrival_to_time = Helper.get_control('arrival_to_time');
            const mode_full_deff = Helper.get_control('mode_full_deff');
            const mode_all_units = Helper.get_control('mode_all_units');

            if (targets) {
                targets.value = Guard.settings.input.targets || '';
            }
            if (strategy) {
                strategy.value = Guard.settings.input.strategy;
            }
            if (max_pop) {
                max_pop.value = String(Math.max(1, Helper.to_int(Guard.settings.input.max_pop_per_village) || 1));
            }
            if (sigil) {
                sigil.value = String(Math.max(0, Math.min(50, Helper.to_int(Guard.settings.input.sigil_percent) || 0)));
            }
            if (arrival_from_enabled) {
                arrival_from_enabled.checked = !!Guard.settings.input.arrival_from_enabled;
            }
            if (arrival_to_enabled) {
                arrival_to_enabled.checked = !!Guard.settings.input.arrival_to_enabled;
            }
            if (arrival_from_date) {
                arrival_from_date.value = Helper.normalize_date_input_value(
                    Guard.settings.input.arrival_from_date,
                    Date.now(),
                );
            }
            if (arrival_from_time) {
                arrival_from_time.value = Helper.normalize_time_input_value(
                    Guard.settings.input.arrival_from_time,
                    Date.now(),
                );
            }
            if (arrival_to_date) {
                arrival_to_date.value = Helper.normalize_date_input_value(
                    Guard.settings.input.arrival_to_date,
                    Date.now() + 60 * 60 * 1000,
                );
            }
            if (arrival_to_time) {
                arrival_to_time.value = Helper.normalize_time_input_value(
                    Guard.settings.input.arrival_to_time,
                    Date.now() + 60 * 60 * 1000,
                );
            }
            if (mode_full_deff) {
                mode_full_deff.checked = !!Guard.settings.input.mode_full_deff;
            }
            if (mode_all_units) {
                mode_all_units.checked = !!Guard.settings.input.mode_all_units;
            }
            if (mode_full_deff && mode_all_units && mode_full_deff.checked && mode_all_units.checked) {
                mode_all_units.checked = false;
                Guard.settings.input.mode_all_units = false;
            }
            Guard.toggle_window_controls();
        },

        toggle_window_controls: function () {
            const arrival_from_enabled = !!(Helper.get_control('is_arrival_from_enabled') || {}).checked;
            const arrival_to_enabled = !!(Helper.get_control('is_arrival_to_enabled') || {}).checked;
            const arrival_from_date = Helper.get_control('arrival_from_date');
            const arrival_from_time = Helper.get_control('arrival_from_time');
            const arrival_to_date = Helper.get_control('arrival_to_date');
            const arrival_to_time = Helper.get_control('arrival_to_time');
            const mode_full_deff = Helper.get_control('mode_full_deff');
            const mode_all_units = Helper.get_control('mode_all_units');
            const max_pop = Helper.get_control('max_pop_per_village');
            if (arrival_from_date) arrival_from_date.disabled = !arrival_from_enabled;
            if (arrival_from_time) arrival_from_time.disabled = !arrival_from_enabled;
            if (arrival_to_date) arrival_to_date.disabled = !arrival_to_enabled;
            if (arrival_to_time) arrival_to_time.disabled = !arrival_to_enabled;
            const special_mode = !!(
                (mode_full_deff && mode_full_deff.checked) ||
                (mode_all_units && mode_all_units.checked)
            );
            if (max_pop) {
                max_pop.disabled = special_mode;
                max_pop.title = special_mode
                    ? 'Игнорируется в режиме ВЕСЬ ДЕФФ / ВООБЩЕ ВСЕ'
                    : '';
            }
            if (!(arrival_from_enabled && arrival_to_enabled)) {
                Guard.arrival_pick_next_slot = 'from';
            }
        },

        extract_coord_from_text: function (raw_value) {
            const source = String(raw_value === null || raw_value === undefined ? '' : raw_value);
            const match = source.match(/\d{1,3}\|\d{1,3}/);
            return match ? Helper.clean_text(match[0]) : null;
        },

        extract_coords_from_text_safe: function (raw_value) {
            const source = String(raw_value === null || raw_value === undefined ? '' : raw_value);
            const matches = source.match(/\d{1,3}\|\d{1,3}/g) || [];
            const seen = new Set();
            const coords = [];
            for (const match of matches) {
                const coord = Helper.clean_text(match);
                if (!coord || seen.has(coord)) continue;
                seen.add(coord);
                coords.push(coord);
            }
            return coords;
        },

        extract_coord_by_village_id: function (village_id) {
            const id = Helper.clean_text(village_id).replace(/[^\d]/g, '');
            if (!id) return null;

            const anchor_by_data = document.querySelector(`.village_anchor[data-id="${id}"] a, .village_anchor[data-id="${id}"]`);
            if (anchor_by_data) {
                const coord = Guard.extract_coord_from_text(anchor_by_data.textContent);
                if (coord) return coord;
            }

            const anchors = Array.from(document.querySelectorAll(`a[href*="screen=info_village"][href*="id=${id}"]`));
            for (const anchor of anchors) {
                const coord = Guard.extract_coord_from_text(anchor.textContent);
                if (coord) return coord;
            }

            return null;
        },

        get_current_page_coord: function () {
            const params = new URLSearchParams(window.location.search);
            const raw_screen = Helper.clean_text((game_data && game_data.screen) || params.get('screen') || '');
            const screen = raw_screen.toLowerCase();

            if (screen === 'place') {
                const x_control = document.querySelector('#inputx');
                const y_control = document.querySelector('#inputy');
                const x_raw = Helper.clean_text(x_control ? x_control.value : '');
                const y_raw = Helper.clean_text(y_control ? y_control.value : '');
                const x = Number(x_raw);
                const y = Number(y_raw);
                if (x_raw !== '' && y_raw !== '' && Number.isFinite(x) && Number.isFinite(y)) {
                    return `${Math.trunc(x)}|${Math.trunc(y)}`;
                }

                const target_id = Helper.clean_text(params.get('target') || '');
                const target_coord = Guard.extract_coord_by_village_id(target_id);
                if (target_coord) return target_coord;

                if (
                    game_data &&
                    game_data.village &&
                    Number.isFinite(Number(game_data.village.x)) &&
                    Number.isFinite(Number(game_data.village.y))
                ) {
                    return `${Math.trunc(Number(game_data.village.x))}|${Math.trunc(Number(game_data.village.y))}`;
                }

                const menu_coord = Guard.extract_coord_from_text(
                    (document.querySelector('#menu_row2 b') || {}).textContent || ''
                );
                if (menu_coord) return menu_coord;

                return null;
            }

            if (screen === 'info_village') {
                const info_village_id = Helper.clean_text(params.get('id') || '');
                const info_coord = Guard.extract_coord_by_village_id(info_village_id);
                if (info_coord) return info_coord;
                return null;
            }

            return null;
        },

        set_targets_to_current_coord: function ({ force = false, silent = false } = {}) {
            const targets_control = Helper.get_control('targets');
            if (!targets_control) return false;

            const current_coord = Guard.get_current_page_coord();
            if (!current_coord) {
                if (!silent) {
                    UI.ErrorMessage('Не удалось определить текущую кору на этой странице');
                }
                return false;
            }

            const existing_coords = Guard.extract_coords_from_text_safe(targets_control.value);
            if (!force && existing_coords.length > 1) {
                return false;
            }

            if (!force && existing_coords.length === 1 && existing_coords[0] === current_coord) {
                return false;
            }

            targets_control.value = current_coord;
            Guard.sync_settings_from_ui();
            if (!silent) {
                UI.SuccessMessage(`Подставлена кора: ${current_coord}`);
            }
            return true;
        },

        autofill_targets_from_context_if_needed: function () {
            const targets_control = Helper.get_control('targets');
            if (!targets_control) return;
            const existing_coords = Guard.extract_coords_from_text_safe(targets_control.value);
            if (existing_coords.length <= 1) {
                Guard.set_targets_to_current_coord({ force: true, silent: true });
            }
        },

        parse_arrival_from_text: function (raw_text) {
            const source = Helper.clean_text(String(raw_text === null || raw_text === undefined ? '' : raw_text))
                .replace(/\s+/g, ' ');
            if (!source) return null;

            const now = new Date();
            const build_datetime = function ({ year, month, day, hour, minute, second = 0, millisecond = 0, can_roll_year = false }) {
                const y = Number(year);
                const m = Number(month);
                const d = Number(day);
                const hh = Number(hour);
                const mm = Number(minute);
                const ss = Number(second);
                const ms = Number(millisecond);
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
                    m < 1 || m > 12 ||
                    d < 1 || d > 31 ||
                    hh < 0 || hh > 23 ||
                    mm < 0 || mm > 59 ||
                    ss < 0 || ss > 59 ||
                    ms < 0 || ms > 999
                ) {
                    return null;
                }

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
                    if (
                        rolled.getFullYear() === y + 1 &&
                        rolled.getMonth() === m - 1 &&
                        rolled.getDate() === d
                    ) {
                        return rolled.getTime();
                    }
                }

                return parsed.getTime();
            };

            const take_last_match = function (regex) {
                let last = null;
                let match = null;
                regex.lastIndex = 0;
                while ((match = regex.exec(source)) !== null) {
                    last = match;
                }
                return last;
            };

            const date_match = take_last_match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\.?\s*(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?/gi);
            if (date_match) {
                let year = Number(now.getFullYear());
                const explicit_year = Helper.clean_text(date_match[3] || '');
                if (explicit_year) {
                    year = Number(explicit_year.length === 2 ? `20${explicit_year}` : explicit_year);
                }
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

            const relative_match = take_last_match(/(сегодня|today|завтра|tomorrow)\s*(?:в\s+)?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[.:](\d{1,3}))?/gi);
            if (relative_match) {
                const token = String(relative_match[1] || '').toLowerCase();
                const shift_days = token === 'завтра' || token === 'tomorrow' ? 1 : 0;
                const basis = new Date(
                    now.getFullYear(),
                    now.getMonth(),
                    now.getDate() + shift_days,
                    0,
                    0,
                    0,
                    0,
                );
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

            const raw = Helper.clean_text(target.textContent || '');
            return raw || null;
        },

        apply_arrival_from_click: function (arrival_ms) {
            if (!Number.isFinite(arrival_ms)) return null;

            const from_enabled = !!(Helper.get_control('is_arrival_from_enabled') || {}).checked;
            const to_enabled = !!(Helper.get_control('is_arrival_to_enabled') || {}).checked;
            if (!from_enabled && !to_enabled) {
                return null;
            }

            let slot = null;
            if (from_enabled && to_enabled) {
                slot = Guard.arrival_pick_next_slot === 'to' ? 'to' : 'from';
                Guard.arrival_pick_next_slot = slot === 'from' ? 'to' : 'from';
            } else if (from_enabled) {
                slot = 'from';
                Guard.arrival_pick_next_slot = 'to';
            } else {
                slot = 'to';
                Guard.arrival_pick_next_slot = 'from';
            }

            const date_value = Helper.format_date_ymd(arrival_ms);
            const time_value = Helper.format_hms(arrival_ms);
            if (slot === 'from') {
                const date_control = Helper.get_control('arrival_from_date');
                const time_control = Helper.get_control('arrival_from_time');
                if (date_control) date_control.value = date_value;
                if (time_control) time_control.value = time_value;
            } else if (slot === 'to') {
                const date_control = Helper.get_control('arrival_to_date');
                const time_control = Helper.get_control('arrival_to_time');
                if (date_control) date_control.value = date_value;
                if (time_control) time_control.value = time_value;
            }

            Guard.sync_settings_from_ui();
            return slot;
        },

        bind_external_arrival_picker: function () {
            const event_namespace = '.HermitowskiGuardArrivalPicker';
            jQuery(document).off(`click${event_namespace}`);
            jQuery(document).on(`click${event_namespace}`, event => {
                const root = Helper.get_control();
                if (!root) return;
                const target = event.target && event.target.nodeType === 1
                    ? event.target
                    : event.target && event.target.parentElement
                        ? event.target.parentElement
                        : null;
                if (!target) return;
                if (root.contains(target)) return;

                const from_enabled = !!(Helper.get_control('is_arrival_from_enabled') || {}).checked;
                const to_enabled = !!(Helper.get_control('is_arrival_to_enabled') || {}).checked;
                if (!from_enabled && !to_enabled) return;

                const clicked_text = Guard.get_arrival_text_from_click_target(target);
                const from_copy_attr = !!target.closest('[data-copy-time]');
                if (!from_copy_attr && !/(сегодня|завтра|today|tomorrow|\d{1,2}\.\d{1,2})/i.test(String(clicked_text || ''))) {
                    return;
                }
                const arrival_ms = Guard.parse_arrival_from_text(clicked_text);
                if (!Number.isFinite(arrival_ms)) return;

                const slot = Guard.apply_arrival_from_click(arrival_ms);
                if (slot) {
                    const slot_label = slot === 'from' ? i18n.LABELS.arrival_from : i18n.LABELS.arrival_to;
                    UI.SuccessMessage(`Вставлено в ${slot_label}: ${Helper.format_date_ymd(arrival_ms)} ${Helper.format_hms(arrival_ms)}`);
                }
            });
        },

        unbind_external_arrival_picker: function () {
            const event_namespace = '.HermitowskiGuardArrivalPicker';
            jQuery(document).off(`click${event_namespace}`);
        },

        render_template_controls: function () {
            Guard.ensure_templates();
            const select = Helper.get_control('template');
            if (!select) return;

            select.innerHTML = '';
            for (const template of Guard.settings.templates) {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                select.append(option);
            }

            const has_active = Guard.settings.templates.some(template => template.id === Guard.settings.active_template_id);
            if (!has_active && Guard.settings.templates.length) {
                Guard.settings.active_template_id = Guard.settings.templates[0].id;
            }
            select.value = Guard.settings.active_template_id;

            Guard.render_template_preview();
        },

        render_template_preview: function () {
            const preview = Helper.get_control('template_preview');
            if (!preview) return;

            const template = Guard.get_active_template();
            if (!template) {
                preview.textContent = i18n.LABELS.no_templates;
                return;
            }

            const chips = [];
            for (const unit_name of Guard.deff_units) {
                const count = Math.max(0, Helper.to_int(template.units[unit_name]));
                if (!count) continue;
                chips.push(
                    `<span class="guard-template-chip"><img src="${image_base}unit/unit_${unit_name}.png" alt="${unit_name}" title="${Helper.escape_html(i18n.UNITS[unit_name] || unit_name)}">${count}</span>`
                );
            }

            preview.innerHTML = chips.length ? chips.join('') : i18n.LABELS.template_empty;
        },

        get_active_template: function () {
            Guard.ensure_templates();
            const active_id = Helper.clean_text(Guard.settings.active_template_id || '');
            const template = Guard.settings.templates.find(t => t.id === active_id);
            return template || Guard.settings.templates[0] || null;
        },

        get_groups_info: async function () {
            const url = TribalWars.buildURL('GET', 'groups', { mode: 'overview', ajax: 'load_group_menu' });
            const response = await fetch(url, { credentials: 'include' });
            const payload = JSON.parse(await response.text());
            payload.result = payload.result.filter(group => group.type !== 'separator');
            payload.result.forEach(group => {
                Guard.group_id2group_name[group.group_id] = group.name;
            });
            return payload;
        },

        get_world_info: async function () {
            Guard.world_info = await get_world_info({ configs: ['config', 'unit_info'] });
        },

        fetch_map_chunk: async function (x_chunk, y_chunk) {
            const map_key = `${x_chunk}_${y_chunk}`;
            if (!Guard.coords2map_chunk.has(map_key)) {
                const url_params = new URLSearchParams({ locale: game_data.locale, v: 2, [map_key]: 1 });
                const response = await fetch(`map.php?${url_params}`);
                const map_info = await response.json();
                Guard.coords2map_chunk.set(map_key, map_info);
            }
            return Guard.coords2map_chunk.get(map_key);
        },

        fetch_village_info: async function (coords) {
            const x_chunk = coords[0] - coords[0] % 20;
            const y_chunk = coords[1] - coords[1] % 20;
            const map_info = await Guard.fetch_map_chunk(x_chunk, y_chunk);
            const village_info = (map_info[0].data.villages[coords[0] - x_chunk] || [])[coords[1] - y_chunk];
            return village_info;
        },

        get_villages: async function (group_id) {
            if (Guard.group_id2villages.has(group_id)) {
                return Guard.group_id2villages.get(group_id);
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
            if (!units_table) {
                return null;
            }

            const villages = [];
            for (let i = 1; i < units_table.rows.length; i++) {
                const row = units_table.rows[i];
                const units = {};
                const offset = 2;
                for (let j = 0; j < game_data.units.length; j++) {
                    const unit_name = game_data.units[j];
                    units[unit_name] = Helper.to_int(row.cells[offset + j].textContent);
                }
                const main_cell = row.cells[0];
                const name = Helper.clean_text(main_cell.textContent);
                const coord_match = name.match(/\d{1,3}\|\d{1,3}/);
                if (!coord_match) continue;
                const coords = coord_match[0].split('|').map(x => Number(x));
                const village = {
                    name,
                    coords,
                    id: main_cell.children[0].getAttribute('data-id'),
                    units,
                };
                villages.push(village);
            }

            Guard.group_id2villages.set(group_id, villages);
            return villages;
        },

        get_unit_speed: function (unit_name) {
            const speed = Number(Guard.world_info && Guard.world_info.unit_info && Guard.world_info.unit_info[unit_name] && Guard.world_info.unit_info[unit_name].speed);
            return Number.isFinite(speed) && speed > 0 ? speed : null;
        },

        get_unit_pop: function (unit_name) {
            const pop = Number(UNIT_POP[unit_name]);
            return Number.isFinite(pop) && pop >= 0 ? pop : 1;
        },

        calc_units_population: function (units) {
            let total = 0;
            const source = units && typeof units === 'object' ? units : {};
            for (const unit_name in source) {
                const count = Math.max(0, Helper.to_int(source[unit_name]));
                if (!count) continue;
                total += count * Guard.get_unit_pop(unit_name);
            }
            return total;
        },

        get_village_available_population: function (remaining_units) {
            let total = 0;
            for (const unit_name of Guard.deff_units) {
                const count = Math.max(0, Helper.to_int(remaining_units[unit_name]));
                total += count * Guard.get_unit_pop(unit_name);
            }
            return total;
        },

        build_template_weights: function (template) {
            const weights = {};
            if (template && template.units && typeof template.units === 'object') {
                for (const unit_name of Guard.deff_units) {
                    const weight = Math.max(0, Helper.to_int(template.units[unit_name]));
                    if (weight > 0) {
                        weights[unit_name] = weight;
                    }
                }
            }
            if (!Object.keys(weights).length) {
                for (const unit_name of Guard.deff_units) {
                    weights[unit_name] = 1;
                }
            }
            return weights;
        },

        get_effective_speed_with_sigil: function (base_speed, user_input) {
            const speed = Number(base_speed);
            if (!Number.isFinite(speed) || speed <= 0) return null;
            const sigil_percent = Math.max(0, Math.min(50, Helper.to_int(user_input && user_input.sigil_percent)));
            if (!sigil_percent) return speed;
            return speed / (1 + sigil_percent / 100);
        },

        get_special_mode_units: function (user_input, available) {
            const deff_only_units = ['spear', 'sword', 'archer', 'heavy'];
            const source_units = user_input && user_input.mode_all_units
                ? Guard.deff_units
                : deff_only_units;
            const result = [];
            for (const unit_name of source_units) {
                if (!Guard.deff_units.includes(unit_name)) continue;
                if (Math.max(0, Helper.to_int((available || {})[unit_name])) <= 0) continue;
                if (!Number.isFinite(Guard.get_unit_speed(unit_name))) continue;
                result.push(unit_name);
            }
            return result;
        },

        is_arrival_in_window: function (arrival_ms, user_input) {
            const arrival = Number(arrival_ms);
            if (!Number.isFinite(arrival)) return false;
            if (!user_input || !user_input.arrival_filter_enabled) return true;
            if (user_input.arrival_from_enabled && Number.isFinite(user_input.arrival_from_ms)) {
                if (arrival < user_input.arrival_from_ms) return false;
            }
            if (user_input.arrival_to_enabled && Number.isFinite(user_input.arrival_to_ms)) {
                if (arrival > user_input.arrival_to_ms) return false;
            }
            return true;
        },

        build_population_limited_composition: function (available, weights, population_cap, allowed_units) {
            const entries = (allowed_units || [])
                .map(unit_name => ({
                    unit: unit_name,
                    weight: Math.max(0, Helper.to_int(weights[unit_name])),
                    pop: Guard.get_unit_pop(unit_name),
                    available: Math.max(0, Helper.to_int(available[unit_name])),
                }))
                .filter(entry => entry.weight > 0 && entry.pop > 0 && entry.available > 0);

            if (!entries.length || population_cap <= 0) {
                return {};
            }

            const total_weight = entries.reduce((sum, entry) => sum + entry.weight, 0);
            const composition = {};
            let used_pop = 0;

            for (const entry of entries) {
                const target_pop = Math.floor(population_cap * (entry.weight / total_weight));
                const target_count = Math.floor(target_pop / entry.pop);
                const selected = Math.min(entry.available, target_count);
                if (selected > 0) {
                    composition[entry.unit] = selected;
                    used_pop += selected * entry.pop;
                }
            }

            let remaining_pop = population_cap - used_pop;
            if (remaining_pop <= 0) {
                return composition;
            }

            const fill_order = [...entries].sort((lhs, rhs) => {
                const lhs_score = lhs.weight / lhs.pop;
                const rhs_score = rhs.weight / rhs.pop;
                if (lhs_score !== rhs_score) return rhs_score - lhs_score;
                if (lhs.pop !== rhs.pop) return lhs.pop - rhs.pop;
                return lhs.unit.localeCompare(rhs.unit);
            });

            let progress = true;
            while (progress && remaining_pop > 0) {
                progress = false;
                for (const entry of fill_order) {
                    const current = composition[entry.unit] || 0;
                    if (current >= entry.available) continue;
                    if (remaining_pop < entry.pop) continue;
                    const max_additional = Math.min(entry.available - current, Math.floor(remaining_pop / entry.pop));
                    if (max_additional <= 0) continue;
                    composition[entry.unit] = current + max_additional;
                    remaining_pop -= max_additional * entry.pop;
                    progress = true;
                    if (remaining_pop <= 0) break;
                }
            }

            return composition;
        },

        ensure_required_unit_in_composition: function (composition, required_unit, available, population_cap, weights) {
            const result = Helper.deep_clone(composition || {});
            if (!required_unit) return result;
            if ((result[required_unit] || 0) > 0) return result;
            if (Math.max(0, Helper.to_int(available[required_unit])) <= 0) return null;

            const required_pop = Guard.get_unit_pop(required_unit);
            let current_pop = Guard.calc_units_population(result);

            if (current_pop + required_pop > population_cap) {
                const removable_units = Object.keys(result)
                    .filter(unit_name => unit_name !== required_unit && result[unit_name] > 0)
                    .sort((lhs, rhs) => {
                        const lhs_score = (Math.max(1, Helper.to_int(weights[lhs])) / Guard.get_unit_pop(lhs));
                        const rhs_score = (Math.max(1, Helper.to_int(weights[rhs])) / Guard.get_unit_pop(rhs));
                        if (lhs_score !== rhs_score) return lhs_score - rhs_score;
                        return Guard.get_unit_pop(rhs) - Guard.get_unit_pop(lhs);
                    });

                for (const unit_name of removable_units) {
                    while (result[unit_name] > 0 && current_pop + required_pop > population_cap) {
                        result[unit_name] -= 1;
                        current_pop -= Guard.get_unit_pop(unit_name);
                    }
                    if (result[unit_name] <= 0) {
                        delete result[unit_name];
                    }
                    if (current_pop + required_pop <= population_cap) {
                        break;
                    }
                }
            }

            if (current_pop + required_pop > population_cap) {
                return null;
            }

            result[required_unit] = (result[required_unit] || 0) + 1;
            return result;
        },

        get_composition_slowest_speed: function (composition, options = {}) {
            const force_knight_speed = !!options.force_knight_speed;
            if (force_knight_speed && Math.max(0, Helper.to_int((composition || {}).knight)) > 0) {
                const knight_speed = Guard.get_unit_speed('knight');
                if (Number.isFinite(knight_speed)) {
                    return knight_speed;
                }
            }
            let slowest_speed = null;
            for (const unit_name in composition) {
                const count = Math.max(0, Helper.to_int(composition[unit_name]));
                if (!count) continue;
                const speed = Guard.get_unit_speed(unit_name);
                if (!Number.isFinite(speed)) continue;
                if (slowest_speed === null || speed > slowest_speed) {
                    slowest_speed = speed;
                }
            }
            return slowest_speed;
        },

        pick_special_mode_composition_for_village: function ({ village_state, distance, user_input, now_ms }) {
            const available = village_state.remaining || {};
            const mode_units = Guard.get_special_mode_units(user_input, available);
            if (!mode_units.length) {
                return null;
            }

            const all_counts = {};
            for (const unit_name of mode_units) {
                all_counts[unit_name] = Math.max(0, Helper.to_int(available[unit_name]));
            }

            const force_knight_speed = Math.max(0, Helper.to_int(all_counts.knight)) > 0;
            const build_with_slowest_speed = function (slowest_speed) {
                if (!Number.isFinite(slowest_speed)) return null;

                const composition = {};
                for (const unit_name of mode_units) {
                    const count = Math.max(0, Helper.to_int(available[unit_name]));
                    if (!count) continue;
                    if (!force_knight_speed) {
                        const unit_speed = Guard.get_unit_speed(unit_name);
                        if (!Number.isFinite(unit_speed) || unit_speed > slowest_speed) continue;
                    }
                    composition[unit_name] = count;
                }

                const selected_population = Guard.calc_units_population(composition);
                if (!selected_population) {
                    return null;
                }

                const base_slowest_speed = force_knight_speed
                    ? Guard.get_unit_speed('knight')
                    : Guard.get_composition_slowest_speed(composition);
                if (!Number.isFinite(base_slowest_speed)) {
                    return null;
                }
                const effective_slowest_speed = Guard.get_effective_speed_with_sigil(base_slowest_speed, user_input);
                if (!Number.isFinite(effective_slowest_speed)) {
                    return null;
                }

                const travel_ms = distance * effective_slowest_speed * 60 * 1000;
                const arrival_ms = now_ms + travel_ms;
                if (!Guard.is_arrival_in_window(arrival_ms, user_input)) {
                    return null;
                }

                return {
                    units: composition,
                    population: selected_population,
                    slowest_speed: base_slowest_speed,
                    effective_slowest_speed,
                    travel_ms,
                    arrival_ms,
                };
            };

            if (!user_input.arrival_filter_enabled) {
                const base_slowest = force_knight_speed
                    ? Guard.get_unit_speed('knight')
                    : Guard.get_composition_slowest_speed(all_counts);
                return build_with_slowest_speed(base_slowest);
            }

            if (force_knight_speed) {
                return build_with_slowest_speed(Guard.get_unit_speed('knight'));
            }

            const speed_candidates = mode_units
                .map(unit_name => Guard.get_unit_speed(unit_name))
                .filter(speed => Number.isFinite(speed))
                .sort((lhs, rhs) => rhs - lhs)
                .filter((speed, index, source) => index === 0 || speed !== source[index - 1]);

            for (const slowest_speed of speed_candidates) {
                const picked = build_with_slowest_speed(slowest_speed);
                if (picked) return picked;
            }
            return null;
        },

        pick_composition_for_village: function ({ village_state, distance, user_input, template_weights, now_ms }) {
            if (user_input && user_input.special_mode_enabled) {
                return Guard.pick_special_mode_composition_for_village({
                    village_state,
                    distance,
                    user_input,
                    now_ms,
                });
            }

            const population_cap = Math.min(
                Math.max(1, Helper.to_int(user_input.max_pop_per_village)),
                Math.max(0, Helper.to_int(village_state.remaining_population_budget)),
            );
            if (population_cap <= 0) {
                return null;
            }
            const available = village_state.remaining;

            const allowed_units = Object.keys(template_weights)
                .filter(unit_name => Guard.deff_units.includes(unit_name))
                .filter(unit_name => Math.max(0, Helper.to_int(available[unit_name])) > 0)
                .filter(unit_name => Number.isFinite(Guard.get_unit_speed(unit_name)));

            if (!allowed_units.length) {
                return null;
            }

            const evaluate_candidate = function (required_slowest_unit) {
                const required_speed = required_slowest_unit ? Guard.get_unit_speed(required_slowest_unit) : null;
                const candidate_allowed = required_slowest_unit
                    ? allowed_units.filter(unit_name => {
                        const speed = Guard.get_unit_speed(unit_name);
                        return Number.isFinite(speed) && speed <= required_speed;
                    })
                    : [...allowed_units];

                if (!candidate_allowed.length) {
                    return null;
                }

                const candidate_available = {};
                const candidate_weights = {};
                for (const unit_name of candidate_allowed) {
                    candidate_available[unit_name] = Math.max(0, Helper.to_int(available[unit_name]));
                    candidate_weights[unit_name] = Math.max(1, Helper.to_int(template_weights[unit_name]) || 1);
                }

                let composition = Guard.build_population_limited_composition(
                    candidate_available,
                    candidate_weights,
                    population_cap,
                    candidate_allowed,
                );

                if (required_slowest_unit) {
                    composition = Guard.ensure_required_unit_in_composition(
                        composition,
                        required_slowest_unit,
                        candidate_available,
                        population_cap,
                        candidate_weights,
                    );
                    if (!composition) {
                        return null;
                    }
                }

                const selected_population = Guard.calc_units_population(composition);
                if (!selected_population) {
                    return null;
                }

                const slowest_speed = Guard.get_composition_slowest_speed(composition);
                if (!Number.isFinite(slowest_speed)) {
                    return null;
                }
                const effective_slowest_speed = Guard.get_effective_speed_with_sigil(slowest_speed, user_input);
                if (!Number.isFinite(effective_slowest_speed)) {
                    return null;
                }

                const travel_ms = distance * effective_slowest_speed * 60 * 1000;
                const arrival_ms = now_ms + travel_ms;

                if (!Guard.is_arrival_in_window(arrival_ms, user_input)) {
                    return null;
                }

                return {
                    units: composition,
                    population: selected_population,
                    slowest_speed,
                    effective_slowest_speed,
                    travel_ms,
                    arrival_ms,
                };
            };

            if (!user_input.arrival_filter_enabled) {
                return evaluate_candidate(null);
            }

            const slow_candidates = allowed_units
                .filter(unit_name => Math.max(0, Helper.to_int(available[unit_name])) > 0)
                .map(unit_name => ({ unit: unit_name, speed: Guard.get_unit_speed(unit_name) }))
                .filter(item => Number.isFinite(item.speed))
                .filter(item => {
                    const effective_speed = Guard.get_effective_speed_with_sigil(item.speed, user_input);
                    if (!Number.isFinite(effective_speed)) return false;
                    const arrival_ms = now_ms + distance * effective_speed * 60 * 1000;
                    return Guard.is_arrival_in_window(arrival_ms, user_input);
                })
                .sort((lhs, rhs) => rhs.speed - lhs.speed);

            if (!slow_candidates.length) {
                return null;
            }

            let best = null;
            for (const candidate of slow_candidates) {
                const evaluated = evaluate_candidate(candidate.unit);
                if (!evaluated) continue;
                if (!best || evaluated.population > best.population) {
                    best = evaluated;
                    continue;
                }
                if (evaluated.population === best.population && evaluated.arrival_ms < best.arrival_ms) {
                    best = evaluated;
                }
            }
            return best;
        },

        sort_village_candidates: function (candidates, strategy) {
            const get_sendable_population = function (village_state) {
                const by_units = Guard.get_village_available_population(village_state.remaining);
                const by_budget = Math.max(0, Helper.to_int(village_state.remaining_population_budget));
                return Math.min(by_units, by_budget);
            };
            const items = [...candidates];
            switch (strategy) {
                case 'DIST_ASC':
                    items.sort((lhs, rhs) => lhs.distance - rhs.distance);
                    break;
                case 'DIST_DESC':
                    items.sort((lhs, rhs) => rhs.distance - lhs.distance);
                    break;
                case 'TROOP_ASC':
                    items.sort((lhs, rhs) =>
                        get_sendable_population(lhs.village_state) -
                        get_sendable_population(rhs.village_state)
                    );
                    break;
                case 'TROOP_DESC':
                    items.sort((lhs, rhs) =>
                        get_sendable_population(rhs.village_state) -
                        get_sendable_population(lhs.village_state)
                    );
                    break;
                default:
                    for (let i = items.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        const t = items[i];
                        items[i] = items[j];
                        items[j] = t;
                    }
                    break;
            }
            return items;
        },

        collect_user_input: function () {
            Guard.sync_settings_from_ui();

            const targets_control = Helper.get_control('targets');
            const max_pop_control = Helper.get_control('max_pop_per_village');
            const sigil_control = Helper.get_control('sigil_percent');
            const strategy_control = Helper.get_control('strategy');
            const group_control = Helper.get_control('group');
            const arrival_from_enabled_control = Helper.get_control('is_arrival_from_enabled');
            const arrival_to_enabled_control = Helper.get_control('is_arrival_to_enabled');
            const arrival_from_date_control = Helper.get_control('arrival_from_date');
            const arrival_from_time_control = Helper.get_control('arrival_from_time');
            const arrival_to_date_control = Helper.get_control('arrival_to_date');
            const arrival_to_time_control = Helper.get_control('arrival_to_time');
            const mode_full_deff_control = Helper.get_control('mode_full_deff');
            const mode_all_units_control = Helper.get_control('mode_all_units');

            Helper.assert_positive_number(max_pop_control, i18n.LABELS.max_pop_per_village);

            const targets = Helper.extract_coords_list(
                targets_control.value,
                i18n.LABELS.targets,
            );
            if (!targets.length) {
                throw i18n.ERROR.EMPTY_TARGETS;
            }

            const template = Guard.get_active_template();
            if (!template) {
                throw i18n.ERROR.NO_TEMPLATE;
            }

            const user_input = {
                targets,
                group_id: String(group_control.value || '-1'),
                strategy: String(strategy_control.value || 'DIST_ASC'),
                max_pop_per_village: Math.max(1, Helper.to_int(max_pop_control.value) || 1),
                sigil_percent: Math.max(0, Math.min(50, Helper.to_int(sigil_control ? sigil_control.value : 0))),
                arrival_from_enabled: !!(arrival_from_enabled_control && arrival_from_enabled_control.checked),
                arrival_to_enabled: !!(arrival_to_enabled_control && arrival_to_enabled_control.checked),
                arrival_filter_enabled: false,
                arrival_from_ms: null,
                arrival_to_ms: null,
                template,
                mode_full_deff: !!(mode_full_deff_control && mode_full_deff_control.checked),
                mode_all_units: !!(mode_all_units_control && mode_all_units_control.checked),
                special_mode_enabled: false,
            };
            if (user_input.mode_full_deff && user_input.mode_all_units) {
                user_input.mode_all_units = false;
                if (mode_all_units_control) mode_all_units_control.checked = false;
            }
            user_input.special_mode_enabled = user_input.mode_full_deff || user_input.mode_all_units;

            user_input.arrival_filter_enabled = user_input.arrival_from_enabled || user_input.arrival_to_enabled;

            if (user_input.arrival_from_enabled) {
                user_input.arrival_from_ms = Helper.parse_datetime_from_date_and_time(
                    arrival_from_date_control ? arrival_from_date_control.value : '',
                    arrival_from_time_control ? arrival_from_time_control.value : '',
                    i18n.LABELS.arrival_from,
                    Date.now(),
                );
            }
            if (user_input.arrival_to_enabled) {
                user_input.arrival_to_ms = Helper.parse_datetime_from_date_and_time(
                    arrival_to_date_control ? arrival_to_date_control.value : '',
                    arrival_to_time_control ? arrival_to_time_control.value : '',
                    i18n.LABELS.arrival_to,
                    Date.now() + 60 * 60 * 1000,
                );
            }
            if (
                user_input.arrival_from_enabled &&
                user_input.arrival_to_enabled &&
                Number.isFinite(user_input.arrival_from_ms) &&
                Number.isFinite(user_input.arrival_to_ms) &&
                user_input.arrival_from_ms > user_input.arrival_to_ms
            ) {
                throw i18n.ERROR.BAD_WINDOW;
            }

            return user_input;
        },

        clear_output: function () {
            const output = Helper.get_control('output');
            if (!output) return;
            while (output.firstChild) {
                output.firstChild.remove();
            }
        },

        set_summary: function (text) {
            const summary = Helper.get_control('plan_summary');
            if (summary) {
                summary.textContent = Helper.clean_text(text);
            }
        },

        build_target_payload: function (target_plan) {
            const payload = {
                x: target_plan.x,
                y: target_plan.y,
                target: target_plan.target_id,
                call: {},
                h: game_data.csrf,
            };
            for (const command of target_plan.commands) {
                payload.call[command.village_id] = {};
                for (const unit_name in command.units) {
                    const count = Math.max(0, Helper.to_int(command.units[unit_name]));
                    if (!count) continue;
                    payload.call[command.village_id][unit_name] = count;
                }
                if (!Object.keys(payload.call[command.village_id]).length) {
                    delete payload.call[command.village_id];
                }
            }
            return payload;
        },

        render_plan: function (plan) {
            Guard.generated_plan = Array.isArray(plan) ? plan : [];
            Guard.clear_output();

            const output = Helper.get_control('output');
            if (!output) return;

            let total_commands = 0;
            Guard.generated_plan.forEach(target_plan => {
                total_commands += target_plan.commands.length;
            });

            if (!total_commands) {
                Guard.set_summary(i18n.ERROR.EMPTY_PLAN);
                Guard.update_execute_all_state();
                return;
            }

            Guard.generated_plan.forEach((target_plan, target_index) => {
                const commands = target_plan.commands;
                if (!commands.length) return;

                for (let i = 0; i < commands.length; i++) {
                    const command = commands[i];
                    const row = document.createElement('tr');
                    row.dataset.targetIndex = String(target_index);

                    if (i === 0) {
                        const target_cell = document.createElement('td');
                        target_cell.classList.add('guard-target-cell');
                        target_cell.rowSpan = commands.length;
                        target_cell.textContent = `${target_plan.target_coord}`;
                        row.append(target_cell);
                    }

                    const village_cell = document.createElement('td');
                    const village_anchor = document.createElement('a');
                    village_anchor.href = TribalWars.buildURL('GET', 'info_village', { id: command.village_id });
                    village_anchor.textContent = command.village_name;
                    village_cell.append(village_anchor);
                    row.append(village_cell);

                    const distance_cell = document.createElement('td');
                    distance_cell.textContent = Helper.format_distance(command.distance);
                    row.append(distance_cell);

                    const arrival_cell = document.createElement('td');
                    arrival_cell.textContent = Helper.format_hms(command.arrival_ms);
                    row.append(arrival_cell);

                    const pop_cell = document.createElement('td');
                    pop_cell.textContent = String(command.population);
                    row.append(pop_cell);

                    for (const unit_name of Guard.deff_units) {
                        const unit_cell = document.createElement('td');
                        const count = Math.max(0, Helper.to_int(command.units[unit_name]));
                        unit_cell.textContent = String(count);
                        if (!count) {
                            unit_cell.classList.add('hidden');
                        }
                        row.append(unit_cell);
                    }

                    if (i === 0) {
                        const command_cell = document.createElement('td');
                        command_cell.rowSpan = commands.length;
                        const execute_button = document.createElement('button');
                        execute_button.classList.add('btn', 'guard-execute-target');
                        execute_button.dataset.targetIndex = String(target_index);
                        execute_button.textContent = i18n.LABELS.execute;
                        execute_button.type = 'button';
                        execute_button.style.margin = '0';
                        command_cell.append(execute_button);
                        row.append(command_cell);
                    }

                    output.append(row);
                }
            });

            Guard.set_summary(
                i18n.LABELS.plan_summary_ready
                    .replace('__1__', String(total_commands))
                    .replace('__2__', String(Guard.generated_plan.length))
            );
            Guard.update_execute_all_state();
        },

        update_execute_all_state: function () {
            const execute_all = Helper.get_control('execute_all');
            if (!execute_all) return;
            const has_pending = Guard.generated_plan.some(item => item && !item.executed && item.commands && item.commands.length);
            execute_all.disabled = !has_pending;
        },

        execute_payload: async function (payload) {
            const params = new URLSearchParams();
            params.set('x', String(payload.x));
            params.set('y', String(payload.y));
            params.set('target', String(payload.target));
            params.set('h', String(game_data.csrf));

            for (const village_id in payload.call) {
                const village_units = payload.call[village_id] || {};
                for (const unit_name in village_units) {
                    const count = Math.max(0, Helper.to_int(village_units[unit_name]));
                    if (!count) continue;
                    params.set(`call[${village_id}][${unit_name}]`, String(count));
                }
            }

            const response = await fetch(TribalWars.buildURL('GET', 'place', { mode: 'call', action: 'call' }), {
                method: 'POST',
                body: params.toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
        },

        execute_target: async function (target_index) {
            const index = Helper.to_int(target_index);
            const target_plan = Guard.generated_plan[index];
            if (!target_plan || target_plan.executed) return;

            const button = Helper.get_control('output')
                .querySelector(`button.guard-execute-target[data-target-index="${index}"]`);
            if (button) {
                button.disabled = true;
            }

            try {
                await Guard.execute_payload(target_plan.payload);
                target_plan.executed = true;
                const rows = Helper.get_control('output').querySelectorAll(`tr[data-target-index="${index}"]`);
                rows.forEach(row => row.remove());
                Guard.group_id2villages.delete(Guard.last_group_id);
                UI.SuccessMessage(`Отправлено в ${target_plan.target_coord}`);
            } catch (ex) {
                if (button) button.disabled = false;
                throw ex;
            } finally {
                Guard.update_execute_all_state();
            }
        },

        execute_all: async function () {
            const execute_all_button = Helper.get_control('execute_all');
            if (execute_all_button) {
                execute_all_button.disabled = true;
            }

            let sent_count = 0;
            try {
                for (let i = 0; i < Guard.generated_plan.length; i++) {
                    const target_plan = Guard.generated_plan[i];
                    if (!target_plan || target_plan.executed || !target_plan.commands.length) continue;
                    await Guard.execute_target(i);
                    sent_count += 1;
                    await Helper.delay(250);
                }
                if (sent_count) {
                    UI.SuccessMessage(`Выполнено отправок по целям: ${sent_count}`);
                }
            } catch (ex) {
                Helper.handle_error(ex);
            } finally {
                Guard.update_execute_all_state();
            }
        },

        generate_commands: async function () {
            const generate_button = Helper.get_control('generate');
            if (generate_button) generate_button.disabled = true;

            try {
                const user_input = Guard.collect_user_input();
                Guard.last_group_id = user_input.group_id;

                const target_infos = [];
                for (const target of user_input.targets) {
                    const target_info = await Guard.fetch_village_info([target.x, target.y]);
                    if (!target_info) {
                        throw i18n.ERROR.INVALID_VILLAGE_INFO.replace('__1__', target.text);
                    }

                    if (Number(Guard.world_info.config.ally.no_other_support) !== 0) {
                        if (Number(game_data.player.ally) === 0 ||
                            Number(target_info[Guard._village_info.ALLY_ID]) !== Number(game_data.player.ally)) {
                            throw i18n.ERROR.NO_OTHER_SUPPORT_CONFLICT.replace('__1__', target.text);
                        }
                    }

                    target_infos.push({
                        x: target.x,
                        y: target.y,
                        target_id: target_info[Guard._village_info.VILLAGE_ID],
                        target_coord: target.text,
                    });
                }

                const villages = await Guard.get_villages(user_input.group_id);
                if (!villages || !villages.length) {
                    throw i18n.ERROR.EMPTY_GROUP;
                }

                const village_states = villages.map(village => {
                    const remaining = {};
                    for (const unit_name of Guard.deff_units) {
                        const reserve = Math.max(0, Helper.to_int(Guard.settings.safeguard[unit_name]));
                        const raw_count = Math.max(0, Helper.to_int(village.units[unit_name]));
                        remaining[unit_name] = Math.max(raw_count - reserve, 0);
                    }
                    const available_population = Guard.get_village_available_population(remaining);
                    const budget_limit = user_input.special_mode_enabled
                        ? available_population
                        : Math.max(1, Helper.to_int(user_input.max_pop_per_village));
                    const budget = Math.min(
                        Math.max(0, Helper.to_int(budget_limit)),
                        available_population,
                    );
                    return {
                        id: village.id,
                        name: village.name,
                        coords: village.coords,
                        remaining,
                        remaining_population_budget: budget,
                    };
                });

                const now_ms = Date.now();
                const template_weights = Guard.build_template_weights(user_input.template);
                const plan = [];

                for (const target of target_infos) {
                    const candidate_villages = village_states
                        .map(village_state => {
                            const distance = Math.hypot(target.x - village_state.coords[0], target.y - village_state.coords[1]);
                            return { village_state, distance };
                        })
                        .filter(item =>
                            Number.isFinite(item.distance) &&
                            item.distance > 0 &&
                            Math.max(0, Helper.to_int(item.village_state.remaining_population_budget)) > 0
                        );

                    const sorted_candidates = Guard.sort_village_candidates(candidate_villages, user_input.strategy);
                    const commands = [];

                    for (const candidate of sorted_candidates) {
                        const picked = Guard.pick_composition_for_village({
                            village_state: candidate.village_state,
                            distance: candidate.distance,
                            user_input,
                            template_weights,
                            now_ms,
                        });

                        if (!picked) continue;

                        for (const unit_name in picked.units) {
                            const count = Math.max(0, Helper.to_int(picked.units[unit_name]));
                            candidate.village_state.remaining[unit_name] = Math.max(0, candidate.village_state.remaining[unit_name] - count);
                        }
                        candidate.village_state.remaining_population_budget = Math.max(
                            0,
                            Math.max(0, Helper.to_int(candidate.village_state.remaining_population_budget)) - picked.population,
                        );

                        commands.push({
                            village_id: candidate.village_state.id,
                            village_name: candidate.village_state.name,
                            village_coord: `${candidate.village_state.coords[0]}|${candidate.village_state.coords[1]}`,
                            distance: candidate.distance,
                            arrival_ms: picked.arrival_ms,
                            population: picked.population,
                            units: picked.units,
                        });
                    }

                    if (!commands.length) continue;

                    const target_plan = {
                        x: target.x,
                        y: target.y,
                        target_id: target.target_id,
                        target_coord: target.target_coord,
                        commands,
                        executed: false,
                    };
                    target_plan.payload = Guard.build_target_payload(target_plan);
                    plan.push(target_plan);
                }

                Guard.render_plan(plan);

                if (!plan.length) {
                    UI.ErrorMessage(i18n.ERROR.EMPTY_PLAN);
                }
            } finally {
                if (generate_button) generate_button.disabled = false;
            }
        },

        show_template_modal: function (template_id = null) {
            let template = null;
            if (template_id) {
                template = Guard.settings.templates.find(t => t.id === template_id) || null;
            }

            const dialog_id = Helper.get_id('template_editor');
            const name_id = Helper.get_id('template_editor.name');
            const save_id = Helper.get_id('template_editor.save');

            let html = `<div>`;
            html += `<fieldset><legend>${template ? 'Редактировать шаблон' : 'Новый шаблон'}</legend><table>`;
            html += `<tr>`;
            html += `<td><label for="${name_id}">${i18n.LABELS.template_name}</label></td>`;
            html += `<td><input id="${name_id}" value="${Helper.escape_html(template ? template.name : '')}" placeholder="Деф 1"></td>`;
            html += `</tr>`;
            for (const unit_name of Guard.deff_units) {
                const input_id = Helper.get_id(`template_editor.unit.${unit_name}`);
                const title = i18n.UNITS[unit_name] || unit_name;
                const value = template ? Math.max(0, Helper.to_int(template.units[unit_name])) : 0;
                html += `<tr>`;
                html += `<td><label for="${input_id}" title="${Helper.escape_html(title)}"><img src="${image_base}unit/unit_${unit_name}.png" alt="${unit_name}"></label></td>`;
                html += `<td><input id="${input_id}" type="number" min="0" step="1" value="${value}"></td>`;
                html += `</tr>`;
            }
            html += `</table></fieldset>`;
            html += `<button id="${save_id}" class="btn right">${i18n.LABELS.save_settings}</button>`;
            html += `</div>`;

            Dialog.show(dialog_id, html);

            setTimeout(() => {
                const save_button = Helper.get_control('template_editor.save');
                if (!save_button) return;
                save_button.addEventListener('click', () => {
                    const name_input = Helper.get_control('template_editor.name');
                    const name = Helper.clean_text(name_input ? name_input.value : '') || `Шаблон ${Guard.settings.templates.length + 1}`;
                    const units = {};
                    for (const unit_name of Guard.deff_units) {
                        const input = Helper.get_control(`template_editor.unit.${unit_name}`);
                        const count = Math.max(0, Helper.to_int(input ? input.value : 0));
                        if (count > 0) {
                            units[unit_name] = count;
                        }
                    }

                    if (!Object.keys(units).length) {
                        UI.ErrorMessage(i18n.LABELS.template_empty);
                        return;
                    }

                    if (template) {
                        template.name = name;
                        template.units = units;
                        Guard.settings.active_template_id = template.id;
                    } else {
                        const id = `tmpl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
                        Guard.settings.templates.push({ id, name, units });
                        Guard.settings.active_template_id = id;
                    }

                    Guard.ensure_templates();
                    Guard.save_settings();
                    Guard.render_template_controls();
                    const close_btn = document.querySelector('.popup_box_close');
                    if (close_btn) close_btn.click();
                });
            });
        },

        delete_selected_template: function () {
            const template = Guard.get_active_template();
            if (!template) return;

            if (Guard.settings.templates.length <= 1) {
                UI.ErrorMessage('Нельзя удалить последний шаблон');
                return;
            }

            Guard.settings.templates = Guard.settings.templates.filter(t => t.id !== template.id);
            Guard.ensure_templates();
            Guard.save_settings();
            Guard.render_template_controls();
        },

        edit_settings: function () {
            const save_id = Helper.get_id('save_settings');
            const reset_id = Helper.get_id('reset_settings');

            let html = `<div><fieldset><legend>${i18n.LABELS.reserve}</legend><table>`;
            for (const unit_name of Guard.deff_units) {
                const id = Helper.get_id(`safeguard.${unit_name}`);
                const title = i18n.UNITS[unit_name] || unit_name;
                const value = Math.max(0, Helper.to_int(Guard.settings.safeguard[unit_name]));
                html += '<tr>';
                html += `<td><label for="${id}" title="${Helper.escape_html(title)}"><img src="${image_base}unit/unit_${unit_name}.png" alt="${unit_name}"></label></td>`;
                html += `<td><input id="${id}" value="${value}"></td>`;
                html += '</tr>';
            }
            html += '</table></fieldset>';
            html += `<button id="${reset_id}" class="btn">${i18n.LABELS.reset_settings}</button>`;
            html += `<button id="${save_id}" class="btn right">${i18n.LABELS.save_settings}</button></div>`;

            Dialog.show(Helper.get_id('settings_editor'), html);

            setTimeout(() => {
                const save_button = Helper.get_control('save_settings');
                const reset_button = Helper.get_control('reset_settings');

                save_button.addEventListener('click', () => {
                    try {
                        for (const unit_name of Guard.deff_units) {
                            const input = Helper.get_control(`safeguard.${unit_name}`);
                            Helper.assert_non_negative_number(input, `${i18n.LABELS.reserve} - ${i18n.UNITS[unit_name] || unit_name}`);
                            Guard.settings.safeguard[unit_name] = Math.max(0, Helper.to_int(input.value));
                        }
                        Guard.save_settings();
                        UI.SuccessMessage(i18n.SETTINGS_SAVED);
                        document.querySelector('.popup_box_close').click();
                    } catch (ex) {
                        Helper.handle_error(ex);
                    }
                });

                reset_button.addEventListener('click', () => {
                    for (const unit_name of Guard.deff_units) {
                        Guard.settings.safeguard[unit_name] = Math.max(0, Helper.to_int(Guard.default_settings.safeguard[unit_name]));
                    }
                    Guard.save_settings();
                    UI.SuccessMessage(i18n.SETTINGS_RESETED);
                    document.querySelector('.popup_box_close').click();
                });
            });
        },

        init_gui: async function () {
            const strategy = Helper.get_control('strategy');
            for (const key in Guard.strategies) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = Guard.strategies[key];
                strategy.append(option);
            }

            const groups_info = await Guard.get_groups_info();
            const group = Helper.get_control('group');
            for (const group_info of groups_info.result) {
                const option = document.createElement('option');
                option.value = group_info.group_id;
                option.textContent = group_info.name;
                group.append(option);
            }
            group.value = Guard.settings.input.group === '-1' ? groups_info.group_id : Guard.settings.input.group;

            await Guard.get_world_info();

            Guard.apply_settings_to_ui();
            Guard.autofill_targets_from_context_if_needed();
            Guard.render_template_controls();

            ['is_arrival_from_enabled', 'is_arrival_to_enabled', 'mode_full_deff', 'mode_all_units'].forEach(control_name => {
                const control = Helper.get_control(control_name);
                if (!control) return;
                control.addEventListener('change', () => {
                    if (control_name === 'mode_full_deff' && control.checked) {
                        const all_units_control = Helper.get_control('mode_all_units');
                        if (all_units_control) {
                            all_units_control.checked = false;
                        }
                    } else if (control_name === 'mode_all_units' && control.checked) {
                        const full_deff_control = Helper.get_control('mode_full_deff');
                        if (full_deff_control) {
                            full_deff_control.checked = false;
                        }
                    }
                    Guard.toggle_window_controls();
                    Guard.sync_settings_from_ui();
                });
            });

            ['targets', 'group', 'strategy', 'max_pop_per_village', 'sigil_percent', 'arrival_from_date', 'arrival_from_time', 'arrival_to_date', 'arrival_to_time'].forEach(control_name => {
                const control = Helper.get_control(control_name);
                if (!control) return;
                control.addEventListener('change', () => Guard.sync_settings_from_ui());
                if (control.tagName === 'TEXTAREA' || control.tagName === 'INPUT') {
                    control.addEventListener('input', () => Guard.sync_settings_from_ui());
                }
            });

            Guard.toggle_window_controls();
            Guard.bind_external_arrival_picker();

            const template_select = Helper.get_control('template');
            template_select.addEventListener('change', () => {
                Guard.settings.active_template_id = Helper.clean_text(template_select.value) || Guard.settings.active_template_id;
                Guard.save_settings();
                Guard.render_template_preview();
            });

            Helper.get_control('insert_current_target').addEventListener('click', () => {
                Guard.set_targets_to_current_coord({ force: true, silent: false });
            });

            Helper.get_control('create_template').addEventListener('click', () => {
                Guard.show_template_modal(null);
            });

            Helper.get_control('edit_template').addEventListener('click', () => {
                const active = Guard.get_active_template();
                if (!active) {
                    UI.ErrorMessage(i18n.ERROR.NO_TEMPLATE);
                    return;
                }
                Guard.show_template_modal(active.id);
            });

            Helper.get_control('remove_template').addEventListener('click', () => {
                Guard.delete_selected_template();
            });

            Helper.get_control('generate').addEventListener('click', async () => {
                try {
                    await Guard.generate_commands();
                } catch (ex) {
                    Helper.handle_error(ex);
                }
            });

            Helper.get_control('execute_all').addEventListener('click', async () => {
                await Guard.execute_all();
            });

            Helper.get_control('settings').addEventListener('click', () => {
                try {
                    Guard.edit_settings();
                } catch (ex) {
                    Helper.handle_error(ex);
                }
            });

            Helper.get_control('output').addEventListener('click', async event => {
                const button = event.target.closest('.guard-execute-target');
                if (!button) return;
                const target_index = Helper.to_int(button.dataset.targetIndex);
                try {
                    await Guard.execute_target(target_index);
                } catch (ex) {
                    Helper.handle_error(ex);
                }
            });

            Guard.set_summary(i18n.LABELS.plan_summary_empty);
            Guard.update_execute_all_state();
        },

        main: async function () {
            const instance = Helper.get_control();
            if (instance) {
                instance.remove();
                Guard.unbind_external_arrival_picker();
                return;
            }

            Guard.init_settings();
            Guard.inject_styles();
            Guard.create_gui();

            $.ajax({
                url: 'https://media.innogamescdn.com/com_DS_PL/skrypty/HermitowskiePlikiMapy.js?_=' + ~~(Date.now() / 9e6),
                dataType: 'script',
                cache: true,
            }).then(() => {
                Guard.init_gui().catch(Helper.handle_error);
            });
        },
    };

    try {
        await Guard.main();
    } catch (ex) {
        Helper.handle_error(ex);
    }

    console.log(`${namespace} | Elapsed time: ${Date.now() - start} [ms]`);
})(TribalWars);

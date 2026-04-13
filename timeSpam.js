javascript:(function(){
    'use strict';

    try {
        if (!window.game_data || !window.game_data.units) {
            console.error('[TimeSpam] game_data не найден! Запускай скрипт на странице игры.');
            return;
        }

        console.log('%c⏱ TimeSpam START', 'font-size:14px;font-weight:bold;color:green');

        const STORAGE_KEY = '__timespam_config';
        const POS_KEY = '__timespam_pos';
        const GAS_URL = 'https://script.google.com/macros/s/AKfycbyFoDTg41Htaw1P5et7bJSpLhG1tqxVS5yxM206cVNkj5SroJ5HCenxdEhBDx-PYHAhig/exec';
        const GAS_CB_KEY = '__timespam_gas_cb';
        const CACHE_PREFIX = '__timespam_cache_';
        const PRETIME_FETCH_DELAY_MS = 400;
        const TABS_COUNT = 4;
        const SUPPORT_CYCLE_KEY = '__timespam_support_cycle_v1';

        // Cache utility
        const UNITS_URL_PATTERN = 'mode=units';
        const COMMANDS_URL_PATTERN = 'mode=commands';
        const CACHE_TTL_UNITS = 30 * 1000; // 30 seconds for units page
        const CACHE_TTL_DEFAULT = 5 * 60 * 1000; // 5 minutes for everything else

        function getTTL(key) {
            if (key.includes(COMMANDS_URL_PATTERN)) return 0; // no caching for commands
            return key.includes(UNITS_URL_PATTERN) ? CACHE_TTL_UNITS : CACHE_TTL_DEFAULT;
        }

        function cacheGet(key) {
            if (key.includes(COMMANDS_URL_PATTERN)) return null; // always skip cache for commands
            try {
                const raw = localStorage.getItem(CACHE_PREFIX + key);
                if (!raw) return null;
                const entry = JSON.parse(raw);
                const ttl = getTTL(key);
                if (Date.now() - entry.ts > ttl) {
                    localStorage.removeItem(CACHE_PREFIX + key);
                    return null;
                }
                return entry.data;
            } catch(e) { return null; }
        }

        function cacheSet(key, data) {
            try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch(e) {}
        }

        function cacheClear() {
            try {
                Object.keys(localStorage).forEach(k => {
                    if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k);
                });
            } catch(e) {}
        }
        const UNITS_AVAILABLE = window.game_data.units.filter(u => u !== 'militia');
        const UNITS_CHECKED_BY_DEFAULT = ['ram', 'catapult'];
        const UNIT_NAMES = window.game_data.units;
        const HELP_TEXT = `Скрипт позволяет слать отправки в определённые временные окна, что может быть полезно в нескольких сценариях:

1. Тайм-спам, в масс или не перед массом или постоянно чтобы держать в напряжении. При этом нет необходимости сидеть и ждать отправки по плану.
2. Тайм-подкрепы в масс, не очень приятно когда перехватывают, а сидеть таймить дефф нудно и долго, в скрипт можно вбить коры, нажать на галочку "притаймить за дворами" и кидать дефф в удобное время, если же хозяин атакованной деревни включил племенной сигил, то рядом с его корой можно поставить восклицательный занк и сигил будет учтён.
2.1 Для задефа рекомендуется создать 3+ шаблона, и все активировать, ким, копья, тк, ким на технике, это увеличит на порядок количество вариантов отправок.
3. Деффнуться встречая масс на после первой волны чтобы быть готовым к доборам, если всё племя бросит из 200 дер по 50ким то втч нескольких минут после встречи масса не надо будет в панике строчить гп "срочно опер".
4. Можно сделать под масс или под спам отдельные кор-листы с для кат(если встречающий выводит всё) и для лк(если встречающий держит офф дома без деффа)
5. На случай если идёт наложение манёвров не надо каждый раз копировать коры и перенастривать шаблоны/сигил/временные окна, я сделал 4 вкладки, и для каждого манёвра можно использовать свою, например:
Ситуация --встречный масс. В одной вкладке скрипта мы спамим, в другой разбрасываем каты, в третьей таймим задефф за дворами соплемов, в четвёртой шлём дефф за первой волной встречаемого масса, таким образом нам не надо 25 раз подряд искать разные списки кор для разных целей, рыться в сообщениях, копировать и вставлять одно и то же. Отдельная вкладка под отдельную задачу (вкладки можно переиминовывать если нажать на карандаш)

Хоть немного, но мне кажется что скрипт уберёт рутину и в каких-то ситуация снизит стресс и добавит радости в процесс игры, всем удачи и хорошей игры, GGG`;
        const BASE_EXPORT_UNITS = ['spear', 'sword', 'axe', 'spy', 'light', 'heavy', 'ram', 'catapult', 'snob'];

        const cleanText = (v) => String(v == null ? '' : v).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        const escapeHtml = (v) => String(v == null ? '' : v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        const toInt = (v) => { const n = Number(String(v).replace(/\s+/g, '').replace(/[^\d-]/g, '')); return Number.isFinite(n) ? Math.trunc(n) : 0; };
        const toNumber = (v) => { if (v == null) return null; const n = Number(cleanText(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
        const readXmlText = (root, selectors) => {
            const list = String(selectors || '').split(',').map(x => cleanText(x)).filter(Boolean);
            for (const s of list) { const node = root ? root.querySelector(s) : null; const val = cleanText(node ? node.textContent : ''); if (val) return val; }
            return '';
        };

        function getServerOffsetSec() {
            const raw = Number(window.game_data?.server_utc_diff);
            return Number.isFinite(raw) ? Math.trunc(raw) : 10800;
        }

        function getServerLocalDate(epochMs = getServerTimeMs()) {
            const ms = Number.isFinite(epochMs) ? epochMs : getServerTimeMs();
            return new Date(ms + getServerOffsetSec() * 1000);
        }

        function formatServerDateYmd(epochMs = getServerTimeMs()) {
            const d = getServerLocalDate(epochMs);
            const yyyy = d.getUTCFullYear();
            const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
            const dd = String(d.getUTCDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }

        function normalizeDateYmd(value, fallbackYmd = formatServerDateYmd()) {
            const raw = cleanText(value);
            const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return fallbackYmd;
            const year = toInt(m[1]);
            const month = toInt(m[2]);
            const day = toInt(m[3]);
            if (year < 1970 || month < 1 || month > 12 || day < 1 || day > 31) return fallbackYmd;
            const check = new Date(Date.UTC(year, month - 1, day));
            if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return fallbackYmd;
            return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        }

        function parseDateYmdParts(value) {
            const ymd = normalizeDateYmd(value, '');
            if (!ymd) return null;
            const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!m) return null;
            return {
                year: toInt(m[1]),
                month: toInt(m[2]),
                day: toInt(m[3]),
                ymd
            };
        }

        function getEpochMsForServerDateAtSec(dateYmd, secOfDay = 0) {
            const parts = parseDateYmdParts(dateYmd);
            if (!parts) return null;
            const sec = Math.max(0, Math.floor(Number(secOfDay) || 0));
            const hh = Math.floor(sec / 3600);
            const mm = Math.floor((sec % 3600) / 60);
            const ss = sec % 60;
            const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, hh, mm, ss);
            return utcMs - getServerOffsetSec() * 1000;
        }

        function parseCoord(text) {
            const m = cleanText(text).match(/(\d{1,3})\s*\|\s*(\d{1,3})/);
            return m ? { x: toInt(m[1]), y: toInt(m[2]) } : null;
        }

        function parseCoordsFromLine(lineText) {
            const line = String(lineText || '');
            const matches = [];
            const coordRe = /(\d{1,3})\s*[|lL]\s*(\d{1,3})/g;
            let m;
            while ((m = coordRe.exec(line)) !== null) {
                matches.push({ index: m.index || 0, raw: m[0], x: m[1], y: m[2] });
            }
            if (!matches.length) return [];

            const out = [];
            for (let i = 0; i < matches.length; i++) {
                const cur = matches[i];
                const coord = `${toInt(cur.x)}|${toInt(cur.y)}`;
                const segStart = cur.index + cur.raw.length;
                const segEnd = i + 1 < matches.length ? matches[i + 1].index : line.length;
                const between = line.slice(segStart, segEnd);
                const markerMatch = between.match(/[!&*❗](?=[^!&*❗]*$)/);
                const marker = markerMatch ? markerMatch[0] : '';
                const sigil = marker === '!' || marker === '❗' || marker === '&' || marker === '*';
                const globalSigil = marker === '&' || marker === '*';
                out.push({ coord, sigil, globalSigil, marker });
            }
            return out;
        }

        function parseCoordsFromTextarea(text) {
            const lines = String(text == null ? '' : text).replace(/\u00a0/g, ' ').split(/\r?\n/);
            const out = [];
            lines.forEach(rawLine => {
                const line = String(rawLine || '').trim();
                if (!line) return;
                const parsed = parseCoordsFromLine(line);
                if (!parsed.length) return;
                parsed.forEach(item => out.push(item));
            });
            return out;
        }

        function parseCoordSigilInfo(rawCoordText) {
            const raw = cleanText(rawCoordText || '');
            const markerMatch = raw.match(/[!&*❗]\s*$/);
            const marker = markerMatch ? cleanText(markerMatch[0]).charAt(0) : '';
            const cleanCoordText = marker ? cleanText(raw.slice(0, raw.length - markerMatch[0].length)) : raw;
            const hasSigil = marker === '!' || marker === '❗' || marker === '&' || marker === '*';
            const isGlobal = marker === '&' || marker === '*';
            return { marker, cleanCoordText, hasSigil, isGlobal };
        }

        function getExportUnitsOrder() {
            const used = new Set();
            const out = [];
            BASE_EXPORT_UNITS.forEach(u => {
                if (!UNITS_AVAILABLE.includes(u)) return;
                used.add(u);
                out.push(u);
            });
            UNITS_AVAILABLE.forEach(u => {
                if (used.has(u)) return;
                used.add(u);
                out.push(u);
            });
            return out;
        }

        function formatTemplateUnitsForExport(unitsObj) {
            const units = (unitsObj && typeof unitsObj === 'object') ? unitsObj : {};
            const parts = [];
            getExportUnitsOrder().forEach(u => {
                const cnt = toInt(units[u]);
                if (cnt > 0) parts.push(`${cnt}[unit]${u}[/unit]`);
            });
            Object.keys(units).forEach(u => {
                const cnt = toInt(units[u]);
                if (cnt <= 0 || parts.some(p => p.includes(`[unit]${u}[/unit]`))) return;
                parts.push(`${cnt}[unit]${u}[/unit]`);
            });
            return parts.join(' ');
        }

        function normalizeImportText(rawText) {
            let text = String(rawText || '').replace(/\u00a0/g, ' ').replace(/\r/g, '');
            text = text.replace(/[ \t]+\n/g, '\n');
            text = text.replace(/\n[ \t]+/g, '\n');
            text = text.replace(/[ \t]{2,}/g, ' ');
            text = text.replace(/\n{3,}/g, '\n\n');
            return text.trim();
        }

        function isForumOrMailPage() {
            const href = String(location.href || '');
            return href.includes('screen=forum') || href.includes('screen=mail');
        }

        function extractUnitFromImageSrc(src) {
            const m = String(src || '').match(/unit_([a-z_]+)\.(?:png|webp)/i);
            const unit = cleanText(m ? m[1] : '').toLowerCase();
            return UNITS_AVAILABLE.includes(unit) ? unit : '';
        }

        function buildImportTextFromDocument(doc) {
            try {
                const body = doc && doc.body ? doc.body : null;
                if (!body) return '';
                const clone = body.cloneNode(true);
                clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
                clone.querySelectorAll('img[src*="unit_"]').forEach(img => {
                    const unit = extractUnitFromImageSrc(img.getAttribute('src') || img.src || '');
                    img.replaceWith(doc.createTextNode(unit ? `[unit]${unit}[/unit]` : ''));
                });
                clone.querySelectorAll('br').forEach(br => br.replaceWith(doc.createTextNode('\n')));
                return normalizeImportText(clone.textContent || '');
            } catch(e) {
                return '';
            }
        }

        function findTsImportSegments(text) {
            const raw = String(text || '');
            const marker = '~~~~~~~TS~~~~~~~~';
            const starts = [];
            let pos = raw.indexOf(marker);
            while (pos !== -1) {
                starts.push(pos);
                pos = raw.indexOf(marker, pos + marker.length);
            }
            if (!starts.length) return [];
            const segments = [];
            for (let i = 0; i < starts.length; i++) {
                const from = starts[i];
                const to = i + 1 < starts.length ? starts[i + 1] : raw.length;
                const seg = raw.slice(from, to);
                if (/Коры\s*:/i.test(seg) && /юниты\s*:/i.test(seg) && /Временные\s+окна/i.test(seg)) {
                    segments.push(seg);
                }
            }
            return segments;
        }

        function extractSectionAfterHeading(text, headingRegex, stopRegex = /\n\s*~~~~~~~~~~~~~~~~/i) {
            const src = String(text || '');
            const m = src.match(headingRegex);
            if (!m || m.index == null) return '';
            const from = m.index + m[0].length;
            const rest = src.slice(from);
            if (!stopRegex) return rest;
            const stop = rest.match(stopRegex);
            if (!stop || stop.index == null) return rest;
            return rest.slice(0, stop.index);
        }

        function parseTemplatesFromImportSection(sectionText) {
            const parsedTemplates = [];
            const activeTemplateIndices = [];
            const tplRe = /([+-]?)\s*\(([^()]*)\)/g;
            let m;
            while ((m = tplRe.exec(String(sectionText || ''))) !== null) {
                const body = String(m[2] || '');
                const units = {};
                const unitsRe = /(\d+)\s*\[unit\]([a-z_]+)\[\/unit\]/gi;
                let uMatch;
                while ((uMatch = unitsRe.exec(body)) !== null) {
                    const cnt = Math.max(0, toInt(uMatch[1]));
                    const unit = cleanText(uMatch[2]).toLowerCase();
                    if (cnt <= 0 || !UNITS_AVAILABLE.includes(unit)) continue;
                    units[unit] = cnt;
                }
                if (!Object.keys(units).length) continue;
                const idx = parsedTemplates.length;
                parsedTemplates.push({ name: `Шаблон ${idx + 1}`, units, active: true });
                if (cleanText(m[1]) === '+') activeTemplateIndices.push(idx);
            }
            return { parsedTemplates, activeTemplateIndices };
        }

        function parseCoordsWithSigilFromImportSection(sectionText) {
            const coordMap = new Map(); // coord -> { sigil:boolean, globalMarker:string }
            const src = String(sectionText || '');
            const codeBlocks = [];
            const codeRe = /\[code\]([\s\S]*?)\[\/code\]/gi;
            let codeMatch;
            while ((codeMatch = codeRe.exec(src)) !== null) {
                codeBlocks.push(String(codeMatch[1] || ''));
            }
            const preferredText = codeBlocks.length ? codeBlocks.join('\n') : src;
            const lines = preferredText.split('\n');
            lines.forEach(lineRaw => {
                const line = String(lineRaw || '');
                const parsed = parseCoordsFromLine(line);
                parsed.forEach(item => {
                    const coord = cleanText(item.coord);
                    if (!coord) return;
                    const prev = coordMap.get(coord) || { sigil: false, globalMarker: '' };
                    coordMap.set(coord, {
                        sigil: prev.sigil || !!item.sigil,
                        globalMarker: prev.globalMarker || (item.globalSigil ? item.marker : '')
                    });
                });
            });
            return Array.from(coordMap.entries()).map(([coord, info]) => {
                if (info.globalMarker) return `${coord}${info.globalMarker}`;
                return info.sigil ? `${coord}!` : coord;
            });
        }

        function parseTsImportSegment(segmentText) {
            const segment = String(segmentText || '');
            if (!segment) return null;

            const coordsHeadingPos = segment.search(/Коры\s*:/i);
            const headPart = coordsHeadingPos >= 0 ? segment.slice(0, coordsHeadingPos) : segment.slice(0, 240);
            const tabNameMatch = headPart.match(/\[спам\]\(([^)\n]+)\)/i) || headPart.match(/\(([^)\n]{1,120})\)/);
            const tabName = cleanText(tabNameMatch ? tabNameMatch[1] : '');

            const coordsSection = extractSectionAfterHeading(segment, /Коры\s*:\s*/i);
            const coords = parseCoordsWithSigilFromImportSection(coordsSection);

            const unitsSection = extractSectionAfterHeading(segment, /юниты\s*:\s*/i);
            const selectedUnits = [];
            const selectedSeen = new Set();
            let hasExplicitSelectedUnits = false;
            const unitsRe = /([+-]?)\s*\[unit\]([a-z_]+)\[\/unit\]/gi;
            let uMatch;
            while ((uMatch = unitsRe.exec(unitsSection)) !== null) {
                const sign = cleanText(uMatch[1]);
                const unit = cleanText(uMatch[2]).toLowerCase();
                if (!UNITS_AVAILABLE.includes(unit)) continue;
                if (sign !== '+') continue;
                hasExplicitSelectedUnits = true;
                if (selectedSeen.has(unit)) continue;
                selectedSeen.add(unit);
                selectedUnits.push(unit);
            }

            const templatesSection = extractSectionAfterHeading(segment, /Шаблоны\s*:\s*/i);
            const { parsedTemplates, activeTemplateIndices } = parseTemplatesFromImportSection(templatesSection);

            const maxPvMatch = segment.match(/Макс\s*отпр\s*с\s*деревни\s*:\s*(\d+)/i);
            const maxPerVillage = Math.max(1, toInt(maxPvMatch ? maxPvMatch[1] : 5) || 5);

            const minDurMatch = segment.match(/Минимальная\s+длительность[\s:]*([0-9]{1,3}:[0-9]{2}:[0-9]{2})/i);
            const maxDurMatch = segment.match(/Максимальная\s+длительность[\s:]*([0-9]{1,3}:[0-9]{2}:[0-9]{2})/i);
            const minDurationParsed = cleanText(minDurMatch ? minDurMatch[1] : '') || '00:30:00';
            const maxDurationParsed = cleanText(maxDurMatch ? maxDurMatch[1] : '') || '99:59:59';

            const dateSection = extractSectionAfterHeading(segment, /Дата\s*/i);
            const dateSignMatch = dateSection.match(/(?:^|\n)\s*([+-])\s*(?:\n|$)/);
            const dateValueMatch = dateSection.match(/(?:^|\n)\s*(\d{4}-\d{2}-\d{2})\s*(?:\n|$)/);
            const dateFilterEnabledParsed = dateSignMatch ? dateSignMatch[1] === '+' : false;
            const targetDateYmdParsed = normalizeDateYmd(dateValueMatch ? dateValueMatch[1] : '', formatServerDateYmd());

            const sigilSection = extractSectionAfterHeading(segment, /Сигил\s*/i);
            const sigilSignMatch = sigilSection.match(/(?:^|\n)\s*([+-])\s*(?:\n|$)/);
            const sigilPercentMatch = sigilSection.match(/(?:^|\n)\s*(\d{1,2})\s*(?:\n|$)/);
            const sigilEnabledParsed = sigilSignMatch ? sigilSignMatch[1] === '+' : false;
            const sigilPercentParsed = Math.max(0, Math.min(50, toInt(sigilPercentMatch ? sigilPercentMatch[1] : 0) || 0));

            const nobleSection = extractSectionAfterHeading(segment, /Притайм\s+за\s+дворами\s*/i);
            const nobleSignMatch = nobleSection.match(/(?:^|\n)\s*([+-])\s*(?:\n|$)/);
            const nobleMinutesMatch = nobleSection.match(/(?:^|\n)\s*(\d{1,3})\s*(?:\n|$)/);
            const noblePretimeEnabledParsed = nobleSignMatch ? nobleSignMatch[1] === '+' : false;
            const noblePretimeMinutesParsed = Math.max(1, toInt(nobleMinutesMatch ? nobleMinutesMatch[1] : 3) || 3);

            const windowsSection = extractSectionAfterHeading(segment, /Временные\s+окна\s*/i, null);
            const parsedWindows = [];
            const windowsRe = /Время:\s*от\s*([0-9]{2}:[0-9]{2}:[0-9]{2})\s*[—-]\s*до\s*([0-9]{2}:[0-9]{2}:[0-9]{2})/gi;
            let wMatch;
            while ((wMatch = windowsRe.exec(windowsSection)) !== null) {
                parsedWindows.push({ from: cleanText(wMatch[1]), to: cleanText(wMatch[2]) });
            }

            if (!coords.length && !parsedWindows.length && !parsedTemplates.length) return null;

            return {
                tabName,
                coords,
                selectedUnits: hasExplicitSelectedUnits ? selectedUnits : [...UNITS_CHECKED_BY_DEFAULT],
                parsedTemplates,
                activeTemplateIndices,
                maxPerVillage,
                minDuration: minDurationParsed,
                maxDuration: maxDurationParsed,
                dateFilterEnabled: dateFilterEnabledParsed,
                targetDateYmd: targetDateYmdParsed,
                sigilEnabled: sigilEnabledParsed,
                sigilPercent: sigilPercentParsed,
                noblePretimeEnabled: noblePretimeEnabledParsed,
                noblePretimeWindowMinutes: noblePretimeMinutesParsed,
                timeWindows: parsedWindows
            };
        }

        function parseTsImportPayloads(text) {
            const segments = findTsImportSegments(text);
            const payloads = [];
            segments.forEach((seg, idx) => {
                const payload = parseTsImportSegment(seg);
                if (!payload) return;
                payload._sourceIndex = idx;
                payload._sourceTitle = cleanText(payload.tabName) || `Настройка ${idx + 1}`;
                payloads.push(payload);
            });
            return payloads;
        }

        function parseTsImportPayloadsFromPage() {
            const text = buildImportTextFromDocument(document);
            if (!text) return [];
            return parseTsImportPayloads(text);
        }

        function navigateToSendInSameTab(fullUrl) {
            const url = cleanText(fullUrl);
            if (!url) return;
            setTimeout(() => {
                try {
                    const newTab = window.open(url, '_blank');
                    if (newTab) {
                        try { newTab.focus(); } catch(e) {}
                        setTimeout(() => {
                            try { window.close(); } catch(e) {}
                        }, 180);
                        return;
                    }
                } catch(e) {}
                try { location.href = url; } catch(e) { location.assign(url); }
            }, 320);
        }

        function readSupportCycleState() {
            try {
                const raw = sessionStorage.getItem(SUPPORT_CYCLE_KEY);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                const key = cleanText(parsed?.key);
                const step = cleanText(parsed?.step);
                const ts = Number(parsed?.ts);
                if (!key || !step || !Number.isFinite(ts) || ts <= 0) return null;
                return { key, step, ts };
            } catch(e) {
                return null;
            }
        }

        function saveSupportCycleState(key, step) {
            try {
                sessionStorage.setItem(SUPPORT_CYCLE_KEY, JSON.stringify({
                    key: cleanText(key),
                    step: cleanText(step),
                    ts: Date.now()
                }));
            } catch(e) {}
        }

        function clearSupportCycleState() {
            try { sessionStorage.removeItem(SUPPORT_CYCLE_KEY); } catch(e) {}
        }

        function getSupportPageKey() {
            const params = new URLSearchParams(location.search);
            const screen = cleanText(params.get('screen'));
            const target = cleanText(params.get('target'));
            if (screen !== 'place' || !target) return '';
            const village = cleanText(params.get('village')) || cleanText(window?.game_data?.village?.id) || '';
            return `${location.pathname}|${village}|${target}`;
        }

        function runSupportButtonCycle() {
            const key = getSupportPageKey();
            if (!key) {
                clearSupportCycleState();
                return;
            }
            const btn = document.querySelector('#target_support');
            if (!btn) return;

            const prev = readSupportCycleState();
            const now = Date.now();
            const canClick = !!prev && prev.key === key && prev.step === 'focused' && (now - prev.ts) < 5 * 60 * 1000;

            if (canClick) {
                try { btn.click(); } catch(e) {}
                clearSupportCycleState();
                showNotice('Нажал кнопку Подкрепление', 'success', 2200);
                return;
            }

            try { btn.focus(); } catch(e) {}
            try { btn.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch(e) {}
            saveSupportCycleState(key, 'focused');
            showNotice('Кнопка Подкрепление в фокусе. Повторный запуск нажмёт её.', 'info', 3000);
        }

        function runConfirmEnterShortcut() {
            const params = new URLSearchParams(location.search);
            const screen = cleanText(params.get('screen'));
            const tryMode = cleanText(params.get('try'));
            if (screen !== 'place' || tryMode !== 'confirm') return false;

            const target = document.activeElement || document.body || document.documentElement;
            const fire = (el, type) => {
                if (!el || typeof el.dispatchEvent !== 'function') return;
                try {
                    el.dispatchEvent(new KeyboardEvent(type, {
                        key: 'Enter',
                        code: 'Enter',
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    }));
                } catch(e) {}
            };

            fire(target, 'keydown');
            fire(target, 'keypress');
            fire(target, 'keyup');
            fire(document, 'keydown');
            fire(document, 'keypress');
            fire(document, 'keyup');

            setTimeout(() => {
                const btn = document.querySelector(
                    '#troop_confirm_submit, ' +
                    'input[name="attack"][type="submit"], button[name="attack"], ' +
                    'input[name="support"][type="submit"], button[name="support"], ' +
                    'form[action*="try=confirm"] input[type="submit"], form[action*="try=confirm"] button[type="submit"]'
                );
                if (btn) {
                    try { btn.click(); } catch(e) {}
                }
            }, 80);

            showNotice('Подтверждение: отправлен Enter', 'info', 1800);
            return true;
        }

        let timeWindows = [];
        let windowCounter = 0;
        let $textarea = null;
        let selectedUnits = [...UNITS_CHECKED_BY_DEFAULT];
        let maxPerVillage = 5;
        let minDuration = '00:30:00';
        let maxDuration = '99:59:59';
        let dateFilterEnabled = false;
        let targetDateYmd = formatServerDateYmd();
        let sigilEnabled = false;
        let sigilPercent = 0;
        let noblePretimeEnabled = false;
        let noblePretimeWindowMinutes = 3;
        let noblePretimeWindows = [];
        let noblePretimeRunToken = 0;
        let activeTabIndex = 0;
        let tabStates = [];
        let templates = []; // [{name: 'Rush', units: {ram:5, catapult:3}, active: true}]
        let activeTemplateIds = new Set();

        function getDefaultTabName(idx = 0) {
            return `вкладка ${idx + 1}`;
        }

        function normalizeTemplates(rawTemplates) {
            if (!Array.isArray(rawTemplates)) return [];
            return rawTemplates.map((t, i) => {
                const unitsSrc = (t && typeof t.units === 'object' && t.units) ? t.units : {};
                const units = {};
                Object.entries(unitsSrc).forEach(([u, cntRaw]) => {
                    const cnt = toInt(cntRaw);
                    if (UNITS_AVAILABLE.includes(u) && cnt > 0) units[u] = cnt;
                });
                return {
                    name: cleanText(t?.name) || `Шаблон ${i + 1}`,
                    units,
                    active: t?.active !== false
                };
            }).filter(t => Object.keys(t.units).length > 0);
        }

        function createDefaultTabState(idx = 0) {
            return {
                name: getDefaultTabName(idx),
                coords: [],
                timeWindows: [],
                selectedUnits: [...UNITS_CHECKED_BY_DEFAULT],
                maxPerVillage: 5,
                minDuration: '00:30:00',
                maxDuration: '99:59:59',
                dateFilterEnabled: false,
                targetDateYmd: formatServerDateYmd(),
                sigilEnabled: false,
                sigilPercent: 0,
                noblePretimeEnabled: false,
                noblePretimeWindowMinutes: 3,
                noblePretimeWindows: [],
                groupId: '0',
                templateActiveIndices: []
            };
        }

        function normalizeTemplateActiveIndices(raw, maxLen) {
            const out = [];
            const seen = new Set();
            if (!Array.isArray(raw)) return out;
            raw.forEach(v => {
                const idx = toInt(v);
                if (idx < 0 || idx >= maxLen) return;
                if (seen.has(idx)) return;
                seen.add(idx);
                out.push(idx);
            });
            return out.sort((a, b) => a - b);
        }

        function normalizeTabState(raw, idx, templateCount, oldActiveIds = []) {
            const base = createDefaultTabState(idx);
            if (raw && typeof raw === 'object') {
                const coordsRaw = Array.isArray(raw.coords) ? raw.coords : [];
                const windowsRaw = Array.isArray(raw.timeWindows) ? raw.timeWindows : [];
                const unitsRaw = Array.isArray(raw.selectedUnits) ? raw.selectedUnits : [];
                const pretimeRaw = Array.isArray(raw.noblePretimeWindows) ? raw.noblePretimeWindows : [];

                base.name = cleanText(raw.name) || base.name;
                base.coords = coordsRaw.map(c => cleanText(c)).filter(Boolean);
                base.timeWindows = windowsRaw.map(w => ({
                    from: cleanText(w?.from),
                    to: cleanText(w?.to)
                }));
                base.selectedUnits = unitsRaw.map(u => cleanText(u)).filter(u => UNITS_AVAILABLE.includes(u));
                if (!base.selectedUnits.length) base.selectedUnits = [...UNITS_CHECKED_BY_DEFAULT];
                base.maxPerVillage = Math.max(1, toInt(raw.maxPerVillage) || 5);
                base.minDuration = cleanText(raw.minDuration) || '00:30:00';
                base.maxDuration = cleanText(raw.maxDuration) || '99:59:59';
                base.dateFilterEnabled = !!raw.dateFilterEnabled;
                base.targetDateYmd = normalizeDateYmd(raw.targetDateYmd || raw.targetDate, formatServerDateYmd());
                base.sigilEnabled = !!raw.sigilEnabled;
                base.sigilPercent = Math.max(0, Math.min(50, toInt(raw.sigilPercent) || 0));
                base.noblePretimeEnabled = !!raw.noblePretimeEnabled;
                base.noblePretimeWindowMinutes = Math.max(1, toInt(raw.noblePretimeWindowMinutes) || 3);
                base.noblePretimeWindows = pretimeRaw.map(normalizeNoblePretimeEntry).filter(Boolean);
                base.groupId = cleanText(raw.groupId) || '0';
                if (Array.isArray(raw.templateActiveIndices)) {
                    base.templateActiveIndices = normalizeTemplateActiveIndices(raw.templateActiveIndices, templateCount);
                } else if (idx === 0 && oldActiveIds.length) {
                    base.templateActiveIndices = normalizeTemplateActiveIndices(oldActiveIds, templateCount);
                }
            } else if (idx === 0 && oldActiveIds.length) {
                base.templateActiveIndices = normalizeTemplateActiveIndices(oldActiveIds, templateCount);
            }
            return base;
        }

        function getCurrentTabState() {
            if (!tabStates[activeTabIndex]) {
                tabStates[activeTabIndex] = createDefaultTabState(activeTabIndex);
            }
            return tabStates[activeTabIndex];
        }

        function getTemplateActiveSetForCurrentTab() {
            const tab = getCurrentTabState();
            return new Set(normalizeTemplateActiveIndices(tab.templateActiveIndices, templates.length));
        }

        function isTemplateActiveForCurrentTab(idx) {
            return getTemplateActiveSetForCurrentTab().has(idx);
        }

        function setTemplateActiveForCurrentTab(idx, isActive) {
            const tab = getCurrentTabState();
            const set = new Set(normalizeTemplateActiveIndices(tab.templateActiveIndices, templates.length));
            if (isActive) set.add(idx);
            else set.delete(idx);
            tab.templateActiveIndices = Array.from(set).sort((a, b) => a - b);
            activeTemplateIds = new Set(tab.templateActiveIndices);
        }

        function shiftTemplateIndicesAfterDelete(deletedIdx) {
            const deleted = Math.max(0, toInt(deletedIdx));
            tabStates = tabStates.map((tab, idx) => {
                const normalized = normalizeTabState(tab, idx, templates.length + 1);
                normalized.templateActiveIndices = normalized.templateActiveIndices
                    .filter(i => i !== deleted)
                    .map(i => i > deleted ? i - 1 : i)
                    .filter(i => i >= 0 && i < templates.length);
                return normalized;
            });
            activeTemplateIds = getTemplateActiveSetForCurrentTab();
        }

        function applyTabStateToRuntime(tab) {
            timeWindows = (tab.timeWindows || []).map((w, i) => ({
                _id: i,
                from: cleanText(w?.from),
                to: cleanText(w?.to)
            }));
            windowCounter = timeWindows.length;
            selectedUnits = Array.isArray(tab.selectedUnits) && tab.selectedUnits.length
                ? tab.selectedUnits.filter(u => UNITS_AVAILABLE.includes(u))
                : [...UNITS_CHECKED_BY_DEFAULT];
            maxPerVillage = Math.max(1, toInt(tab.maxPerVillage) || 5);
            minDuration = cleanText(tab.minDuration) || '00:30:00';
            maxDuration = cleanText(tab.maxDuration) || '99:59:59';
            dateFilterEnabled = !!tab.dateFilterEnabled;
            targetDateYmd = normalizeDateYmd(tab.targetDateYmd || tab.targetDate, formatServerDateYmd());
            sigilEnabled = !!tab.sigilEnabled;
            sigilPercent = Math.max(0, Math.min(50, toInt(tab.sigilPercent) || 0));
            noblePretimeEnabled = !!tab.noblePretimeEnabled;
            noblePretimeWindowMinutes = Math.max(1, toInt(tab.noblePretimeWindowMinutes) || 3);
            noblePretimeWindows = (Array.isArray(tab.noblePretimeWindows) ? tab.noblePretimeWindows : [])
                .map(normalizeNoblePretimeEntry)
                .filter(Boolean);
            activeTemplateIds = getTemplateActiveSetForCurrentTab();
        }

        function persistRuntimeToCurrentTab() {
            const tab = getCurrentTabState();
            const rawCoords = parseCoordsFromTextarea($textarea ? $textarea.value : '');
            tab.coords = rawCoords.map(c => {
                if (c.marker === '&' || c.marker === '*') return c.coord + c.marker;
                if (c.sigil) return c.coord + '!';
                return c.coord;
            });
            tab.timeWindows = (timeWindows || []).map(w => ({
                from: cleanText(w?.from),
                to: cleanText(w?.to)
            }));
            tab.selectedUnits = Array.isArray(selectedUnits) ? selectedUnits.filter(u => UNITS_AVAILABLE.includes(u)) : [];
            if (!tab.selectedUnits.length) tab.selectedUnits = [...UNITS_CHECKED_BY_DEFAULT];
            tab.maxPerVillage = Math.max(1, toInt(maxPerVillage) || 5);
            tab.minDuration = cleanText(minDuration) || '00:30:00';
            tab.maxDuration = cleanText(maxDuration) || '99:59:59';
            tab.dateFilterEnabled = !!dateFilterEnabled;
            tab.targetDateYmd = normalizeDateYmd(targetDateYmd, formatServerDateYmd());
            tab.sigilEnabled = !!sigilEnabled;
            tab.sigilPercent = Math.max(0, Math.min(50, toInt(sigilPercent) || 0));
            tab.noblePretimeEnabled = !!noblePretimeEnabled;
            tab.noblePretimeWindowMinutes = Math.max(1, toInt(noblePretimeWindowMinutes) || 3);
            tab.noblePretimeWindows = (Array.isArray(noblePretimeWindows) ? noblePretimeWindows : [])
                .map(normalizeNoblePretimeEntry)
                .filter(Boolean);
            const groupSel = document.getElementById('ts-group');
            if (groupSel) tab.groupId = String(groupSel.value || '0');
            tab.templateActiveIndices = Array.from(getTemplateActiveSetForCurrentTab()).sort((a, b) => a - b);
            tab.name = cleanText(tab.name) || getDefaultTabName(activeTabIndex);
        }

        function applyTemplatesFromConfig(config, rerender = false) {
            templates = normalizeTemplates(config?.templates);
            const oldActiveIds = templates
                .map((t, i) => (t?.active !== false ? i : null))
                .filter(v => v != null);

            const rawTabs = Array.isArray(config?.tabs) ? config.tabs : [];
            const tabs = [];
            for (let i = 0; i < TABS_COUNT; i++) {
                const rawTab = rawTabs[i];
                if (rawTab) {
                    tabs.push(normalizeTabState(rawTab, i, templates.length, oldActiveIds));
                    continue;
                }
                if (i === 0 && config && !rawTabs.length) {
                    const legacy = {
                        name: cleanText(config?.tabName) || getDefaultTabName(i),
                        coords: Array.isArray(config.coords) ? config.coords : [],
                        timeWindows: Array.isArray(config.timeWindows) ? config.timeWindows : [],
                        selectedUnits: Array.isArray(config.selectedUnits) ? config.selectedUnits : [...UNITS_CHECKED_BY_DEFAULT],
                        maxPerVillage: config.maxPerVillage,
                        minDuration: config.minDuration,
                        maxDuration: config.maxDuration,
                        dateFilterEnabled: config.dateFilterEnabled,
                        targetDateYmd: config.targetDateYmd || config.targetDate,
                        sigilEnabled: config.sigilEnabled,
                        sigilPercent: config.sigilPercent,
                        noblePretimeEnabled: config.noblePretimeEnabled,
                        noblePretimeWindowMinutes: config.noblePretimeWindowMinutes,
                        noblePretimeWindows: Array.isArray(config.noblePretimeWindows) ? config.noblePretimeWindows : [],
                        groupId: config.groupId,
                        templateActiveIndices: oldActiveIds
                    };
                    tabs.push(normalizeTabState(legacy, i, templates.length, oldActiveIds));
                } else {
                    tabs.push(normalizeTabState(null, i, templates.length, oldActiveIds));
                }
            }
            tabStates = tabs;
            activeTabIndex = Math.min(TABS_COUNT - 1, Math.max(0, toInt(config?.activeTabIndex)));
            applyTabStateToRuntime(getCurrentTabState());
            if (rerender) {
                renderTabs();
                renderTemplates();
                renderUnitsRow();
            }
        }

        function saveConfig() {
            syncRuntimeFromUI();
            persistRuntimeToCurrentTab();
            const tab = getCurrentTabState();
            const config = {
                activeTabIndex,
                tabs: tabStates.map((t, i) => normalizeTabState(t, i, templates.length)),
                templates,
                // legacy mirrors for backward compatibility
                coords: tab.coords,
                timeWindows: tab.timeWindows,
                selectedUnits: tab.selectedUnits,
                sigilEnabled: tab.sigilEnabled,
                sigilPercent: tab.sigilPercent,
                noblePretimeEnabled: tab.noblePretimeEnabled,
                noblePretimeWindowMinutes: tab.noblePretimeWindowMinutes,
                noblePretimeWindows: tab.noblePretimeWindows,
                maxPerVillage: tab.maxPerVillage,
                minDuration: tab.minDuration,
                maxDuration: tab.maxDuration,
                dateFilterEnabled: tab.dateFilterEnabled,
                targetDateYmd: tab.targetDateYmd,
                groupId: tab.groupId
            };
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch(e) {}
        }

        function loadConfig() {
            try {
                const raw = localStorage.getItem(STORAGE_KEY);
                const parsed = raw ? JSON.parse(raw) : null;
                if (!parsed) {
                    tabStates = Array.from({ length: TABS_COUNT }, (_, i) => createDefaultTabState(i));
                    activeTabIndex = 0;
                    templates = [];
                    activeTemplateIds = new Set();
                    applyTabStateToRuntime(getCurrentTabState());
                    return null;
                }
                applyTemplatesFromConfig(parsed, false);
                const tab = getCurrentTabState();
                return {
                    ...parsed,
                    ...tab,
                    tabs: tabStates,
                    activeTabIndex,
                    templates
                };
            } catch(e) {
                tabStates = Array.from({ length: TABS_COUNT }, (_, i) => createDefaultTabState(i));
                activeTabIndex = 0;
                templates = [];
                activeTemplateIds = new Set();
                applyTabStateToRuntime(getCurrentTabState());
                return null;
            }
        }

        function normalizeNoblePretimeEntry(entry) {
            const coord = cleanText(entry?.coord);
            const from = cleanText(entry?.from);
            const to = cleanText(entry?.to);
            if (!/^\d{1,3}\|\d{1,3}$/.test(coord)) return null;
            if (parseClockToSec(from) == null || parseClockToSec(to) == null) return null;
            const ms = Number(entry?.lastSnobAtMs);
            return {
                coord,
                villageId: cleanText(entry?.villageId),
                from,
                to,
                lastSnobAtMs: Number.isFinite(ms) && ms > 0 ? Math.round(ms) : null
            };
        }

        function setNoblePretimeWindows(entries) {
            const normalized = (Array.isArray(entries) ? entries : [])
                .map(normalizeNoblePretimeEntry)
                .filter(Boolean);
            noblePretimeWindows = normalized;
            const tab = getCurrentTabState();
            tab.noblePretimeWindows = normalized;
        }

        function loadNoblePretimeWindows() {
            const tab = getCurrentTabState();
            noblePretimeWindows = (Array.isArray(tab.noblePretimeWindows) ? tab.noblePretimeWindows : [])
                .map(normalizeNoblePretimeEntry)
                .filter(Boolean);
            return noblePretimeWindows;
        }

        function clearNoblePretimeWindows() {
            noblePretimeWindows = [];
            const tab = getCurrentTabState();
            tab.noblePretimeWindows = [];
        }

        function getNoblePretimeMap() {
            const map = {};
            noblePretimeWindows.forEach(w => { map[w.coord] = w; });
            return map;
        }

        function delay(ms) {
            const waitMs = Math.max(0, toInt(ms));
            return new Promise(resolve => setTimeout(resolve, waitMs));
        }

        function setNoblePretimeProgress(visible, done = 0, total = 0, text = '') {
            const box = document.getElementById('ts-noble-progress');
            const fill = document.getElementById('ts-noble-progress-fill');
            const label = document.getElementById('ts-noble-progress-text');
            if (!box || !fill || !label) return;
            if (!visible) {
                box.style.display = 'none';
                fill.style.width = '0%';
                label.textContent = '';
                return;
            }
            box.style.display = '';
            const safeTotal = Math.max(0, toInt(total));
            const safeDone = Math.max(0, toInt(done));
            const pct = safeTotal > 0 ? Math.min(100, Math.round((safeDone / safeTotal) * 100)) : 0;
            fill.style.width = pct + '%';
            label.textContent = text || (safeTotal > 0 ? `${safeDone}/${safeTotal}` : '');
        }

        function parseLastSnobCommandEndMs(html) {
            const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
            const rows = Array.from(doc.querySelectorAll(
                '#commands_outgoings tr.command-row, ' +
                '#commands_outgoings tr.row_a, #commands_outgoings tr.row_b, #commands_outgoings tr.row_ax, #commands_outgoings tr.row_bx, ' +
                '.commands-container[data-type="towards_village"] tr.command-row, ' +
                '.commands-container[data-type="towards_village"] tr.row_a, .commands-container[data-type="towards_village"] tr.row_b'
            ));

            let latestMs = null;
            const isSnobRow = (row) => {
                const text = cleanText(row?.textContent).toLowerCase();
                if (/(дворян|snob)/i.test(text)) return true;

                const hints = Array.from(row.querySelectorAll('[data-icon-hint], [title]'))
                    .map(el => cleanText(el.getAttribute('data-icon-hint') || el.getAttribute('title') || ''))
                    .join(' ')
                    .toLowerCase();
                if (/(дворян|snob)/i.test(hints)) return true;

                const iconSrc = Array.from(row.querySelectorAll('img[src]'))
                    .map(img => cleanText(img.getAttribute('src') || ''))
                    .join(' ')
                    .toLowerCase();
                return /(?:\/command\/(?:return_)?snob|unit_snob|\/unit\/unit_snob)/i.test(iconSrc);
            };

            rows.forEach(row => {
                if (!isSnobRow(row)) return;
                const timerEl = row.querySelector('.widget-command-timer, .timer_link, .timer');
                const endSec = toInt(timerEl?.getAttribute('data-endtime'));
                if (endSec > 0) {
                    const endMs = endSec * 1000;
                    if (latestMs == null || endMs > latestMs) latestMs = endMs;
                    return;
                }
                const timerText = cleanText(timerEl?.textContent || '');
                const durSec = parseDurationToSec(timerText, -1);
                if (durSec >= 0) {
                    const endMs = getServerTimeMs() + durSec * 1000;
                    if (latestMs == null || endMs > latestMs) latestMs = endMs;
                }
            });

            return latestMs;
        }

        function recalcNoblePretimeRangesBySavedBase() {
            if (!Array.isArray(noblePretimeWindows) || noblePretimeWindows.length === 0) return;
            const minutes = Math.max(1, toInt(noblePretimeWindowMinutes) || 3);
            let changed = false;
            const updated = noblePretimeWindows.map(item => {
                const base = Number(item?.lastSnobAtMs);
                if (!Number.isFinite(base) || base <= 0) return item;
                changed = true;
                return {
                    ...item,
                    from: formatHMS(base),
                    to: formatHMS(base + minutes * 60 * 1000)
                };
            });
            if (changed) setNoblePretimeWindows(updated);
        }

        async function buildNoblePretimeWindowsFromTargets() {
            const runToken = ++noblePretimeRunToken;
            const minutesInput = document.getElementById('ts-noble-minutes');
            noblePretimeWindowMinutes = Math.max(1, toInt(minutesInput?.value) || 3);
            if (minutesInput) minutesInput.value = String(noblePretimeWindowMinutes);

            const rawTargets = parseCoordsFromTextarea($textarea ? $textarea.value : '');
            const uniqueTargets = [];
            const seen = new Set();
            rawTargets.forEach(t => {
                if (!t || !t.coord) return;
                if (seen.has(t.coord)) return;
                seen.add(t.coord);
                uniqueTargets.push({ coord: t.coord });
            });

            if (uniqueTargets.length === 0) {
                setNoblePretimeWindows([]);
                setNoblePretimeProgress(true, 0, 0, 'Нет целевых координат для притайма');
                saveConfig();
                return [];
            }

            setNoblePretimeProgress(true, 0, uniqueTargets.length, 'Подготовка карты деревень...');

            let villageMapText = '';
            try {
                villageMapText = await fetchPageFresh('/map/village.txt');
            } catch(err) {
                console.error('[timeSpam] Ошибка загрузки village.txt:', err);
                setNoblePretimeProgress(true, 0, uniqueTargets.length, 'Ошибка village.txt');
                setNoblePretimeWindows([]);
                saveConfig();
                return [];
            }

            if (runToken !== noblePretimeRunToken) return [];

            const villageIdByCoord = parseVillageMap(villageMapText);
            const total = uniqueTargets.length;
            const entries = [];

            for (let i = 0; i < uniqueTargets.length; i++) {
                if (runToken !== noblePretimeRunToken) return entries;
                const item = uniqueTargets[i];
                const idx = i + 1;
                const villageId = villageIdByCoord.get(item.coord);

                if (!villageId) {
                    setNoblePretimeProgress(true, idx, total, `${idx}/${total}: ${item.coord} — id не найден`);
                    if (idx < total) await delay(PRETIME_FETCH_DELAY_MS);
                    continue;
                }

                setNoblePretimeProgress(true, idx - 1, total, `${idx}/${total}: ${item.coord} — загрузка приказов...`);
                const infoUrl = `/game.php?village=${window.game_data.village.id}&screen=info_village&id=${villageId}#${item.coord.replace('|',';')}`;

                try {
                    const html = await fetchPageFresh(infoUrl);
                    if (runToken !== noblePretimeRunToken) return entries;
                    const lastSnobAtMs = parseLastSnobCommandEndMs(html);
                    if (Number.isFinite(lastSnobAtMs) && lastSnobAtMs > 0) {
                        entries.push({
                            coord: item.coord,
                            villageId: String(villageId),
                            from: formatHMS(lastSnobAtMs),
                            to: formatHMS(lastSnobAtMs + noblePretimeWindowMinutes * 60 * 1000),
                            lastSnobAtMs
                        });
                        setNoblePretimeProgress(true, idx, total, `${idx}/${total}: ${item.coord} — двор найден`);
                    } else {
                        setNoblePretimeProgress(true, idx, total, `${idx}/${total}: ${item.coord} — дворы не найдены`);
                    }
                } catch(err) {
                    console.error(`[timeSpam] Ошибка info_village для ${item.coord}:`, err);
                    setNoblePretimeProgress(true, idx, total, `${idx}/${total}: ${item.coord} — ошибка загрузки`);
                }

                if (idx < total) await delay(PRETIME_FETCH_DELAY_MS);
            }

            if (runToken !== noblePretimeRunToken) return entries;

            setNoblePretimeWindows(entries);
            setNoblePretimeProgress(true, total, total, `Готово: ${entries.length}/${total} кор с притаймом`);
            saveConfig();
            return entries;
        }

        function getUnitIconUrl(unit) {
            const base = String(window.image_base || '/graphic/').replace(/\/$/, '') + '/';
            return `${base}unit/unit_${unit}.webp`;
        }

        function buildUnitsRow() {
            return UNITS_AVAILABLE.map(u =>
                `<label class="ts-unit-label" title="${u}"><img class="ts-unit-icon" src="${getUnitIconUrl(u)}" alt="${u}"><input type="checkbox" class="ts-unit-cb" data-unit="${u}" ${selectedUnits.includes(u) ? 'checked' : ''}></label>`
            ).join('');
        }

        function renderUnitsRow() {
            const c = document.getElementById('ts-units');
            if (c) c.innerHTML = buildUnitsRow();
            const active = hasActiveTemplate();
            if (c) {
                c.style.opacity = active ? '0.4' : '1';
                c.style.pointerEvents = active ? 'none' : 'auto';
            }
        }

        function syncRuntimeFromUI() {
            const windowsBox = document.getElementById('ts-windows');
            if (windowsBox) {
                timeWindows = [];
                let maxId = 0;
                windowsBox.querySelectorAll('.ts-tw').forEach((el, idx) => {
                    const rawId = toInt(el.getAttribute('data-id'));
                    const id = rawId > 0 ? rawId : idx + 1;
                    const from = cleanText(el.querySelector('.ts-tw-from-input')?.value || '');
                    const to = cleanText(el.querySelector('.ts-tw-to-input')?.value || '');
                    timeWindows.push({ _id: id, from, to });
                    if (id > maxId) maxId = id;
                });
                windowCounter = maxId;
            }

            const unitBox = document.getElementById('ts-units');
            if (unitBox) {
                selectedUnits = [];
                unitBox.querySelectorAll('.ts-unit-cb:checked').forEach(cb => {
                    const u = cleanText(cb.dataset.unit);
                    if (UNITS_AVAILABLE.includes(u)) selectedUnits.push(u);
                });
            }

            const maxPvInput = document.getElementById('ts-max-per-village');
            if (maxPvInput) maxPerVillage = Math.max(1, toInt(maxPvInput.value) || 5);

            const minDurInput = document.getElementById('ts-min-duration');
            if (minDurInput) minDuration = cleanText(minDurInput.value) || '00:30:00';

            const maxDurInput = document.getElementById('ts-max-duration');
            if (maxDurInput) maxDuration = cleanText(maxDurInput.value) || '99:59:59';

            const dateCb = document.getElementById('ts-date-cb');
            if (dateCb) dateFilterEnabled = !!dateCb.checked;

            const dateInput = document.getElementById('ts-target-date');
            if (dateInput) targetDateYmd = normalizeDateYmd(dateInput.value, formatServerDateYmd());

            const sigilCb = document.getElementById('ts-sigil-cb');
            if (sigilCb) sigilEnabled = !!sigilCb.checked;

            const sigilPctInput = document.getElementById('ts-sigil-pct');
            if (sigilPctInput) sigilPercent = Math.max(0, Math.min(50, toInt(sigilPctInput.value) || 0));

            const nobleCb = document.getElementById('ts-noble-cb');
            if (nobleCb) noblePretimeEnabled = !!nobleCb.checked;

            const nobleMinsInput = document.getElementById('ts-noble-minutes');
            if (nobleMinsInput) noblePretimeWindowMinutes = Math.max(1, toInt(nobleMinsInput.value) || 3);
        }

        function renderTabs() {
            const container = document.getElementById('ts-tabs');
            if (!container) return;
            container.innerHTML = tabStates.map((tab, idx) => {
                const name = cleanText(tab?.name) || getDefaultTabName(idx);
                const cls = idx === activeTabIndex ? 'ts-tab active' : 'ts-tab';
                return `<div class="${cls}" data-tab-index="${idx}">
                    <span class="ts-tab-title">${escapeHtml(name)}</span>
                    <button type="button" class="ts-tab-rename" data-tab-rename="${idx}" title="Переименовать">✏️</button>
                </div>`;
            }).join('');
        }

        function updateDurationDateUIState() {
            const dateCb = document.getElementById('ts-date-cb');
            const dateInput = document.getElementById('ts-target-date');
            const minDurInput = document.getElementById('ts-min-duration');
            const maxDurInput = document.getElementById('ts-max-duration');
            const durationWrap = document.getElementById('ts-duration-block');
            const useDate = !!dateCb?.checked;

            if (dateInput) dateInput.disabled = !useDate;
            if (minDurInput) minDurInput.disabled = useDate;
            if (maxDurInput) maxDurInput.disabled = useDate;
            if (durationWrap) durationWrap.classList.toggle('ts-disabled-block', useDate);
        }

        function applyActiveTabToUI() {
            const tab = getCurrentTabState();
            applyTabStateToRuntime(tab);

            if ($textarea) $textarea.value = (Array.isArray(tab.coords) ? tab.coords : []).join('\n');

            const maxPvInput = document.getElementById('ts-max-per-village');
            if (maxPvInput) maxPvInput.value = String(maxPerVillage);

            const minDurInput = document.getElementById('ts-min-duration');
            if (minDurInput) minDurInput.value = minDuration;

            const maxDurInput = document.getElementById('ts-max-duration');
            if (maxDurInput) maxDurInput.value = maxDuration;

            const dateCb = document.getElementById('ts-date-cb');
            const dateInput = document.getElementById('ts-target-date');
            if (dateCb) dateCb.checked = !!dateFilterEnabled;
            if (dateInput) dateInput.value = normalizeDateYmd(targetDateYmd, formatServerDateYmd());
            updateDurationDateUIState();

            const sigilCb = document.getElementById('ts-sigil-cb');
            const sigilPctInput = document.getElementById('ts-sigil-pct');
            if (sigilCb) sigilCb.checked = !!sigilEnabled;
            if (sigilPctInput) {
                sigilPctInput.value = String(sigilPercent);
                sigilPctInput.disabled = !sigilEnabled;
            }

            const nobleCb = document.getElementById('ts-noble-cb');
            const nobleMinsInput = document.getElementById('ts-noble-minutes');
            if (nobleCb) nobleCb.checked = !!noblePretimeEnabled;
            if (nobleMinsInput) {
                nobleMinsInput.value = String(noblePretimeWindowMinutes);
                nobleMinsInput.disabled = !noblePretimeEnabled;
            }

            const groupSel = document.getElementById('ts-group');
            if (groupSel) {
                const gid = cleanText(tab.groupId) || '0';
                const has = Array.from(groupSel.options).some(opt => String(opt.value) === String(gid));
                groupSel.value = has ? gid : '0';
            }

            renderTimeWindows();
            renderUnitsRow();
            renderTemplates();
            renderTabs();
            setNoblePretimeProgress(false);
        }

        function renameTab(idx) {
            const safeIdx = Math.min(TABS_COUNT - 1, Math.max(0, toInt(idx)));
            const tab = tabStates[safeIdx] || createDefaultTabState(safeIdx);
            tabStates[safeIdx] = tab;
            const oldName = cleanText(tab.name) || getDefaultTabName(safeIdx);
            const newNameRaw = prompt('Название вкладки', oldName);
            if (newNameRaw == null) return;
            tab.name = cleanText(newNameRaw) || getDefaultTabName(safeIdx);
            renderTabs();
            saveConfig();
        }

        function switchToTab(nextIdx) {
            const safeIdx = Math.min(TABS_COUNT - 1, Math.max(0, toInt(nextIdx)));
            if (safeIdx === activeTabIndex) return;
            syncRuntimeFromUI();
            persistRuntimeToCurrentTab();
            activeTabIndex = safeIdx;
            applyActiveTabToUI();
            saveConfig();
            const groupSel = document.getElementById('ts-group');
            if (groupSel) runWithGroup(groupSel.value || '0');
        }

        function fetchGasData() {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', GAS_URL, true);
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const lines = String(xhr.responseText).split('\n').filter(l => l.trim());
                        const coords = [];
                        const windows = [];
                        lines.forEach(line => {
                            const parts = line.split('\t');
                            if (parts.length >= 2) {
                                coords.push(parts[0].trim());
                                windows.push(parts[1].trim());
                            }
                        });
                        resolve({ coords, windows });
                    } else {
                        reject(new Error('GAS error: ' + xhr.status));
                    }
                };
                xhr.onerror = () => reject(new Error('GAS network error'));
                xhr.send();
            });
        }

        function applyGasData(coords, windows) {
            if ($textarea) {
                // coords are plain strings from GAS, display them
                $textarea.value = coords.join('\n');
                $textarea.readOnly = true;
            }
            // Build time windows: use GAS data where available
            const gasWindows = windows.filter(w => w).map((w, i) => ({ _id: i + 1, from: String(w).split('-')[0] || '', to: String(w).split('-')[1] || '' }));
            if (gasWindows.length > 0) {
                timeWindows = gasWindows;
                windowCounter = gasWindows.length;
            }
            renderTimeWindows();
            document.querySelectorAll('.ts-tw-input').forEach(inp => { inp.readOnly = true; inp.style.opacity = '0.7'; });
            const addBtn = document.getElementById('ts-add-btn');
            if (addBtn) addBtn.style.display = 'none';
        }

        function resetFromStorage() {
            loadConfig();
            applyActiveTabToUI();
            if ($textarea) $textarea.readOnly = false;
            document.querySelectorAll('.ts-tw-input').forEach(inp => { inp.readOnly = false; inp.style.opacity = '1'; });
            const addBtn = document.getElementById('ts-add-btn');
            if (addBtn) addBtn.style.display = '';
        }

        function savePosition(panel) {
            try { localStorage.setItem(POS_KEY, JSON.stringify({ left: panel.offsetLeft, top: panel.offsetTop })); } catch(e) {}
        }

        function loadPosition() {
            try { const raw = localStorage.getItem(POS_KEY); return raw ? JSON.parse(raw) : null; } catch(e) { return null; }
        }

        // ─── Templates ──────────────────────────────────────────
        function renderTemplates() {
            const container = document.getElementById('ts-templates-list');
            console.log(`[renderTemplates] container=${container ? 'ok' : 'null'}, templates.length=${templates.length}, templates=${JSON.stringify(templates)}`);
            if (!container) { console.log('[renderTemplates] container not found, skipping'); return; }
            if (templates.length === 0) {
                container.innerHTML = '<div class="ts-no-templates">Нет шаблонов</div>';
                console.log('[renderTemplates] no templates to render');
                return;
            }
            container.innerHTML = templates.map((t, i) => {
                const units = (t && typeof t.units === 'object' && t.units) ? t.units : {};
                const isActive = isTemplateActiveForCurrentTab(i);
                const unitIcons = UNITS_AVAILABLE
                    .filter(u => toInt(units[u]) > 0)
                    .map(u => `<img class="ts-tmpl-unit-icon" src="${getUnitIconUrl(u)}" title="${u}: ${toInt(units[u])}"><span class="ts-tmpl-unit-num">${toInt(units[u])}</span>`)
                    .join(' ');
                return `<div class="ts-tmpl-row ${isActive ? 'active' : ''}" data-idx="${i}">
                    <span class="ts-tmpl-name">${cleanText(t?.name) || `Шаблон ${i + 1}`}</span>
                    <span class="ts-tmpl-units">${unitIcons || '—'}</span>
                    <label class="ts-tmpl-active-label"><input type="checkbox" class="ts-tmpl-active" data-idx="${i}" ${isActive ? 'checked' : ''}></label>
                    <button class="ts-tmpl-del" data-idx="${i}">✕</button>
                </div>`;
            }).join('');
        }

        function getActiveTemplates() {
            const activeSet = getTemplateActiveSetForCurrentTab();
            return templates.filter((t, i) => activeSet.has(i));
        }

        function hasActiveTemplate() {
            return getTemplateActiveSetForCurrentTab().size > 0;
        }

        function showTemplateModal() {
            if (document.getElementById('ts-tmpl-modal')) return;
            const overlay = document.createElement('div');
            overlay.id = 'ts-tmpl-modal';
            overlay.className = 'ts-tmpl-modal-overlay';
            overlay.innerHTML = `
                <div class="ts-tmpl-modal">
                    <div class="ts-tmpl-modal-head"><span>Новый шаблон</span><button class="ts-tmpl-modal-close">✕</button></div>
                    <div class="ts-tmpl-modal-body">
                        <label class="ts-label">Название</label>
                        <input type="text" id="ts-tmpl-name" class="ts-tmpl-name-input" placeholder="Мой шаблон">
                        <div class="ts-tmpl-units-grid">
                            ${UNITS_AVAILABLE.map(u => `
                                <div class="ts-tmpl-unit-row">
                                    <img class="ts-tmpl-unit-icon" src="${getUnitIconUrl(u)}" title="${u}">
                                    <input type="number" class="ts-tmpl-unit-count" data-unit="${u}" value="0" min="0" placeholder="0">
                                </div>
                            `).join('')}
                        </div>
                        <button class="ts-tmpl-save" id="ts-tmpl-save">Сохранить</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            overlay.querySelector('.ts-tmpl-modal-close').onclick = () => overlay.remove();
            overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

            document.getElementById('ts-tmpl-save').onclick = () => {
                const name = document.getElementById('ts-tmpl-name').value.trim() || `Шаблон ${templates.length + 1}`;
                const units = {};
                overlay.querySelectorAll('.ts-tmpl-unit-count').forEach(inp => {
                    const u = inp.dataset.unit;
                    const v = parseInt(inp.value, 10) || 0;
                    if (v > 0) units[u] = v;
                });
                if (Object.keys(units).length === 0) {
                    showNotice('Укажите хотя бы один юнит', 'warn', 2600);
                    return;
                }
                console.log(`[tmpl save] Creating: ${name}, units=${JSON.stringify(units)}`);
                templates.push({ name, units, active: true });
                setTemplateActiveForCurrentTab(templates.length - 1, true);
                console.log(`[tmpl save] templates now: ${JSON.stringify(templates)}`);
                overlay.remove();
                renderTemplates();
                renderUnitsRow();
                saveConfig();
            };
        }

        function closeNearestWindow() {
            const modal = document.getElementById('ts-nearest-modal');
            if (modal) modal.remove();
        }

        function showNearestWindow(nearestRows) {
            closeNearestWindow();
            const rows = Array.isArray(nearestRows) ? nearestRows : [];
            const first = rows.length ? rows[0] : null;
            const overlay = document.createElement('div');
            overlay.id = 'ts-nearest-modal';
            overlay.className = 'ts-nearest-modal-overlay';

            const summary = first
                ? `Отправок сейчас нет. Ближайшая отправка через <b>${escapeHtml(formatDuration(first.waitSec * 1000))}</b> (в <b>${escapeHtml(first.sendTime)}</b>).`
                : 'Подходящих отправок не найдено.';

            const tableHtml = rows.length
                ? `<div class="ts-nearest-table-wrap">
                        <table class="ts-nearest-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Через</th>
                                    <th>Отправка</th>
                                    <th>Деревня</th>
                                    <th>Цель</th>
                                    <th>Тип</th>
                                    <th>Полет</th>
                                    <th>Прибытие</th>
                                    <th>Окно</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.map((r, idx) => `
                                    <tr>
                                        <td>${idx + 1}</td>
                                        <td>${escapeHtml(formatDuration(r.waitSec * 1000))}</td>
                                        <td>${escapeHtml(r.sendTime)}</td>
                                        <td>${escapeHtml(`${r.villageId} (${r.villageCoord})`)}</td>
                                        <td>${escapeHtml(r.targetCoord)}</td>
                                        <td>${escapeHtml(r.unit)}</td>
                                        <td>${escapeHtml(r.travelTime)}</td>
                                        <td>${escapeHtml(r.arrivalTime)}</td>
                                        <td>${escapeHtml(r.windowLabel)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`
                : '<div class="ts-nearest-empty">Нет кандидатов для ближайшей отправки. Проверьте цели, окна, фильтры длительности и дату.</div>';

            overlay.innerHTML = `
                <div class="ts-nearest-modal">
                    <div class="ts-nearest-head">
                        <span>Ближайшие отправки</span>
                        <button class="ts-nearest-close" type="button">✕</button>
                    </div>
                    <div class="ts-nearest-body">
                        <div class="ts-nearest-summary">${summary}</div>
                        ${tableHtml}
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            overlay.querySelector('.ts-nearest-close').onclick = () => closeNearestWindow();
            overlay.onclick = (e) => { if (e.target === overlay) closeNearestWindow(); };
        }

        function closeHelpWindow() {
            const modal = document.getElementById('ts-help-modal');
            if (modal) modal.remove();
        }

        function showHelpWindow() {
            closeHelpWindow();
            const overlay = document.createElement('div');
            overlay.id = 'ts-help-modal';
            overlay.className = 'ts-help-modal-overlay';
            overlay.innerHTML = `
                <div class="ts-help-modal">
                    <div class="ts-help-head">
                        <span>Инструкция</span>
                        <button class="ts-help-close" type="button">✕</button>
                    </div>
                    <div class="ts-help-body"></div>
                </div>`;
            const body = overlay.querySelector('.ts-help-body');
            if (body) body.textContent = HELP_TEXT;
            document.body.appendChild(overlay);

            overlay.querySelector('.ts-help-close').onclick = () => closeHelpWindow();
            overlay.onclick = (e) => { if (e.target === overlay) closeHelpWindow(); };
        }

        function getNoticeContainer() {
            let box = document.getElementById('ts-notice-box');
            if (box) return box;
            box = document.createElement('div');
            box.id = 'ts-notice-box';
            box.className = 'ts-notice-box';
            document.body.appendChild(box);
            return box;
        }

        function showNotice(message, kind = 'info', ttlMs = 3200) {
            const box = getNoticeContainer();
            const toast = document.createElement('div');
            toast.className = `ts-notice ts-notice-${cleanText(kind) || 'info'}`;
            toast.textContent = cleanText(message) || 'Готово';
            box.appendChild(toast);
            requestAnimationFrame(() => { toast.classList.add('show'); });

            const close = () => {
                toast.classList.remove('show');
                setTimeout(() => { if (toast.parentNode) toast.remove(); }, 180);
            };
            const wait = Math.max(1200, toInt(ttlMs) || 3200);
            const timer = setTimeout(close, wait);
            toast.addEventListener('click', () => {
                clearTimeout(timer);
                close();
            });
        }

        function closeExportTextWindow() {
            const modal = document.getElementById('ts-export-fallback-modal');
            if (modal) modal.remove();
        }

        function showExportTextWindow(text) {
            closeExportTextWindow();
            const overlay = document.createElement('div');
            overlay.id = 'ts-export-fallback-modal';
            overlay.className = 'ts-export-fallback-overlay';
            overlay.innerHTML = `
                <div class="ts-export-fallback-modal">
                    <div class="ts-export-fallback-head">
                        <span>Экспорт (ручное копирование)</span>
                        <button class="ts-export-fallback-close" type="button">✕</button>
                    </div>
                    <div class="ts-export-fallback-body">
                        <textarea class="ts-export-fallback-text" readonly></textarea>
                    </div>
                </div>`;
            const ta = overlay.querySelector('.ts-export-fallback-text');
            if (ta) ta.value = String(text || '');
            document.body.appendChild(overlay);

            overlay.querySelector('.ts-export-fallback-close').onclick = () => closeExportTextWindow();
            overlay.onclick = (e) => { if (e.target === overlay) closeExportTextWindow(); };
            if (ta) {
                ta.focus();
                ta.select();
            }
        }

        function applyImportPayloadToTab(targetTabIndex, payload) {
            const safeTabIndex = Math.min(TABS_COUNT - 1, Math.max(0, toInt(targetTabIndex)));
            if (!payload || typeof payload !== 'object') return false;

            if (!Array.isArray(tabStates) || tabStates.length !== TABS_COUNT) {
                tabStates = Array.from({ length: TABS_COUNT }, (_, i) => createDefaultTabState(i));
            }

            if (Array.isArray(payload.parsedTemplates) && payload.parsedTemplates.length > 0) {
                templates = normalizeTemplates(payload.parsedTemplates);
                tabStates = Array.from({ length: TABS_COUNT }, (_, i) => normalizeTabState(tabStates[i], i, templates.length));
                tabStates.forEach(tab => { tab.templateActiveIndices = []; });
            }

            const tab = normalizeTabState(tabStates[safeTabIndex], safeTabIndex, templates.length);
            if (cleanText(payload.tabName)) tab.name = cleanText(payload.tabName);
            tab.coords = (Array.isArray(payload.coords) ? payload.coords : [])
                .map(c => cleanText(c))
                .filter(Boolean);
            tab.timeWindows = (Array.isArray(payload.timeWindows) ? payload.timeWindows : [])
                .map(w => ({ from: cleanText(w?.from), to: cleanText(w?.to) }))
                .filter(w => parseClockToSec(w.from) != null && parseClockToSec(w.to) != null);
            tab.selectedUnits = (Array.isArray(payload.selectedUnits) ? payload.selectedUnits : [])
                .map(u => cleanText(u).toLowerCase())
                .filter(u => UNITS_AVAILABLE.includes(u));
            if (!tab.selectedUnits.length) tab.selectedUnits = [...UNITS_CHECKED_BY_DEFAULT];
            tab.maxPerVillage = Math.max(1, toInt(payload.maxPerVillage) || tab.maxPerVillage || 5);
            tab.minDuration = cleanText(payload.minDuration) || tab.minDuration || '00:30:00';
            tab.maxDuration = cleanText(payload.maxDuration) || tab.maxDuration || '99:59:59';
            tab.dateFilterEnabled = !!payload.dateFilterEnabled;
            tab.targetDateYmd = normalizeDateYmd(payload.targetDateYmd || payload.targetDate, tab.targetDateYmd || formatServerDateYmd());
            tab.sigilEnabled = !!payload.sigilEnabled;
            tab.sigilPercent = Math.max(0, Math.min(50, toInt(payload.sigilPercent) || 0));
            tab.noblePretimeEnabled = !!payload.noblePretimeEnabled;
            tab.noblePretimeWindowMinutes = Math.max(1, toInt(payload.noblePretimeWindowMinutes) || 3);
            tab.noblePretimeWindows = [];
            tab.templateActiveIndices = normalizeTemplateActiveIndices(payload.activeTemplateIndices, templates.length);

            tabStates[safeTabIndex] = tab;
            activeTabIndex = safeTabIndex;
            applyTabStateToRuntime(tab);
            activeTemplateIds = getTemplateActiveSetForCurrentTab();
            if (document.getElementById('ts-panel')) {
                applyActiveTabToUI();
            }
            return true;
        }

        function closeImportWindow() {
            const modal = document.getElementById('ts-import-modal');
            if (modal) modal.remove();
        }

        function showImportWindow(payloads) {
            const list = Array.isArray(payloads) ? payloads.filter(Boolean) : [];
            if (!list.length) return;
            closeImportWindow();
            const overlay = document.createElement('div');
            overlay.id = 'ts-import-modal';
            overlay.className = 'ts-import-modal-overlay';
            overlay.innerHTML = `
                <div class="ts-import-modal">
                    <div class="ts-import-head">
                        <span>Импорт настроек TS</span>
                        <button class="ts-import-close" type="button">✕</button>
                    </div>
                    <div class="ts-import-body">
                        <div class="ts-import-label">Найдено настроек: ${list.length}</div>
                        <div id="ts-import-list" class="ts-import-list"></div>
                    </div>
                </div>`;
            document.body.appendChild(overlay);

            const listBox = overlay.querySelector('#ts-import-list');
            if (listBox) {
                list.forEach((payload, srcIdx) => {
                    const row = document.createElement('div');
                    row.className = 'ts-import-row';
                    row.innerHTML = `
                        <div class="ts-import-row-title">${srcIdx + 1}. ${escapeHtml(cleanText(payload._sourceTitle) || `Настройка ${srcIdx + 1}`)}</div>
                        <div class="ts-import-row-controls">
                            <select class="ts-select ts-import-tab-select-row" data-src-idx="${srcIdx}"></select>
                            <button class="ts-import-btn ts-import-btn-row" type="button" data-src-idx="${srcIdx}">Импорт</button>
                        </div>`;
                    const sel = row.querySelector('.ts-import-tab-select-row');
                    if (sel) {
                        tabStates.forEach((tab, tabIdx) => {
                            const opt = document.createElement('option');
                            opt.value = String(tabIdx);
                            opt.textContent = cleanText(tab?.name) || getDefaultTabName(tabIdx);
                            sel.appendChild(opt);
                        });
                        sel.value = String(activeTabIndex);
                    }
                    listBox.appendChild(row);
                });
            }

            listBox?.addEventListener('click', (e) => {
                const btn = e.target.closest('.ts-import-btn-row');
                if (!btn) return;
                const srcIdx = toInt(btn.dataset.srcIdx);
                const payload = list[srcIdx];
                if (!payload) return;
                const sel = listBox.querySelector(`.ts-import-tab-select-row[data-src-idx="${srcIdx}"]`);
                const tabIdx = toInt(sel ? sel.value : activeTabIndex);
                const ok = applyImportPayloadToTab(tabIdx, payload);
                if (!ok) return;
                saveConfig();
                showNotice(`Импортировано во вкладку ${tabIdx + 1}`, 'success', 2800);
            });

            overlay.querySelector('.ts-import-close').onclick = () => closeImportWindow();
            overlay.onclick = (e) => { if (e.target === overlay) closeImportWindow(); };
        }

        async function copyTextToClipboard(text) {
            const value = String(text || '');
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(value);
                return;
            }
            const ta = document.createElement('textarea');
            ta.value = value;
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            const copied = document.execCommand('copy');
            ta.remove();
            if (!copied) throw new Error('copy failed');
        }

        function buildCurrentTabExportText() {
            syncRuntimeFromUI();
            persistRuntimeToCurrentTab();
            const tab = getCurrentTabState();
            const tabName = cleanText(tab.name) || getDefaultTabName(activeTabIndex);
            const coords = (Array.isArray(tab.coords) ? tab.coords : []).map(c => cleanText(c)).filter(Boolean);
            const windows = (Array.isArray(tab.timeWindows) ? tab.timeWindows : [])
                .map(w => ({ from: cleanText(w?.from), to: cleanText(w?.to) }))
                .filter(w => w.from && w.to);
            const coordsText = coords.length ? `[code]\n${coords.join('\n')}\n[/code]` : '-';

            const activeSet = getTemplateActiveSetForCurrentTab();
            const hasActiveTemplates = activeSet.size > 0;
            const unitsLine = getExportUnitsOrder().map(u => {
                const mark = (!hasActiveTemplates && tab.selectedUnits.includes(u)) ? '+' : '';
                return `${mark}[unit]${u}[/unit]`;
            }).join(' ');

            const templatesLine = templates.length
                ? templates.map((t, idx) => {
                    const mark = activeSet.has(idx) ? '+' : '';
                    const unitsText = formatTemplateUnitsForExport(t?.units);
                    return `${mark}(${unitsText || '—'})`;
                }).join(' ')
                : '-';

            const windowsText = windows.length
                ? windows.map(w => `Время: от ${w.from} — до ${w.to}`).join('\n\n\n')
                : '-';

            return [
                `[spoiler=${tabName}]`,
                '~~~~~~~TS~~~~~~~~',
                `(${tabName})`,
                '',
                'Коры:',
                coordsText,
                '',
                '~~~~~~~~~~~~~~~~',
                '',
                `юниты: ${unitsLine}`,
                '',
                '~~~~~~~~~~~~~~~~',
                'Шаблоны:',
                templatesLine,
                '',
                '~~~~~~~~~~~~~~~~',
                '',
                `Макс отпр с деревни: ${Math.max(1, toInt(tab.maxPerVillage) || 5)}`,
                '',
                '~~~~~~~~~~~~~~~~',
                '',
                'Минимальная длительность',
                cleanText(tab.minDuration) || '00:30:00',
                'Максимальная длительность',
                cleanText(tab.maxDuration) || '99:59:59',
                '',
                '~~~~~~~~~~~~~~~~',
                'Дата',
                tab.dateFilterEnabled ? '+' : '-',
                normalizeDateYmd(tab.targetDateYmd, formatServerDateYmd()),
                '',
                '~~~~~~~~~~~~~~~~',
                'Сигил',
                tab.sigilEnabled ? '+' : '-',
                String(Math.max(0, Math.min(50, toInt(tab.sigilPercent) || 0))),
                '',
                '~~~~~~~~~~~~~~~~',
                'Притайм за дворами',
                tab.noblePretimeEnabled ? '+' : '-',
                String(Math.max(1, toInt(tab.noblePretimeWindowMinutes) || 3)),
                '',
                '~~~~~~~~~~~~~~~~',
                'Временные окна',
                '',
                windowsText,
                '',
                '~~~~~~~~~~~~~~~~',
                '[/spoiler]'
            ].join('\n');
        }

        async function exportCurrentTabToClipboard() {
            const payload = buildCurrentTabExportText();
            try {
                await copyTextToClipboard(payload);
                showNotice('Экспорт текущей вкладки скопирован в буфер обмена', 'success', 2600);
            } catch(err) {
                console.error('[TimeSpam] export copy error:', err);
                showNotice('Автокопирование не удалось, открыл окно для ручного копирования', 'warn', 3600);
                showExportTextWindow(payload);
            }
        }

        // ─── Time window UI ─────────────────────────────────────
        function buildTimeWindowHTML(id, fromVal, toVal) {
            const pad = (v) => {
                const parts = cleanText(v).split(':').map(s => s.padStart(2, '0'));
                while (parts.length < 3) parts.push('00');
                const hh = Math.min(23, Math.max(0, toInt(parts[0]) || 0));
                const mm = Math.min(59, Math.max(0, toInt(parts[1]) || 0));
                const ss = Math.min(59, Math.max(0, toInt(parts[2]) || 0));
                return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
            };
            return `<div class="ts-tw" data-id="${id}"><span class="ts-tw-label">Время:</span><span>от</span><input class="ts-tw-input ts-tw-from-input" type="time" step="1" value="${pad(fromVal)}"><span class="ts-tw-sep">—</span><span>до</span><input class="ts-tw-input ts-tw-to-input" type="time" step="1" value="${pad(toVal)}"><button class="ts-tw-remove" data-id="${id}" title="Удалить">✕</button></div>`;
        }

        function renderTimeWindows() {
            const container = document.getElementById('ts-windows');
            container.innerHTML = '';
            timeWindows.forEach(w => {
                container.insertAdjacentHTML('beforeend', buildTimeWindowHTML(w._id, w.from, w.to));
            });
            const btn = document.getElementById('ts-add-btn');
            if (btn) btn.style.display = timeWindows.length >= 10 ? 'none' : '';
        }

        function makeDraggable(panel) {
            const head = panel.querySelector('.ts-head');
            let dragging = false, startX, startY, startLeft, startTop;
            head.style.cursor = 'grab';
            const onStart = (e) => {
                if (e.target.closest('.ts-head-actions')) return;
                dragging = true; head.style.cursor = 'grabbing';
                const cx = e.touches ? e.touches[0].clientX : e.clientX;
                const cy = e.touches ? e.touches[0].clientY : e.clientY;
                startX = cx; startY = cy; startLeft = panel.offsetLeft; startTop = panel.offsetTop;
                e.preventDefault();
            };
            const onMove = (e) => {
                if (!dragging) return;
                const cx = e.touches ? e.touches[0].clientX : e.clientX;
                const cy = e.touches ? e.touches[0].clientY : e.clientY;
                panel.style.left = Math.max(0, startLeft + cx - startX) + 'px';
                panel.style.top = Math.max(0, startTop + cy - startY) + 'px';
                panel.style.transform = 'none';
                e.preventDefault();
            };
            const onEnd = () => { if (dragging) { dragging = false; head.style.cursor = 'grab'; savePosition(panel); } };
            head.addEventListener('mousedown', onStart);
            head.addEventListener('touchstart', onStart, { passive: false });
            document.addEventListener('mousemove', onMove);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('mouseup', onEnd);
            document.addEventListener('touchend', onEnd);
        }

        function injectStyles() {
            if (document.getElementById('ts-style')) return;
            const style = document.createElement('style');
            style.id = 'ts-style';
            style.textContent = `
                #ts-panel { position:absolute; z-index:999999; width:560px; max-width:calc(100vw - 12px); background:#f3ead5; border:2px solid #b08b4f; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.35); color:#3a2a16; font:13px/1.4 Verdana,Arial,sans-serif; }
                .ts-head { background:#b08b4f; color:#fff; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; font-size:15px; font-weight:bold; border-radius:10px 10px 0 0; user-select:none; }
                .ts-drag-handle { flex:1; }
                .ts-head-actions { display:flex; align-items:center; gap:6px; flex-shrink:0; }
                .ts-help-btn { background:#4a4a4a; color:#fff; border:none; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:14px; line-height:1; font-weight:bold; }
                .ts-help-btn:hover { background:#5a5a5a; }
                .ts-close { background:#c0392b; color:#fff; border:none; border-radius:50%; width:26px; height:26px; cursor:pointer; font-size:14px; line-height:1; flex-shrink:0; }
                .ts-close:hover { background:#e74c3c; }
                .ts-body { padding:14px; }
                .ts-tabs { display:flex; flex-wrap:nowrap; gap:6px; margin-bottom:10px; }
                .ts-tab { border:1px solid #b08b4f; background:#f0e2bf; color:#5b4528; border-radius:6px; padding:4px 8px; font:12px Verdana,Arial,sans-serif; cursor:pointer; display:flex; align-items:center; gap:6px; flex:1 1 0; min-width:0; justify-content:space-between; }
                .ts-tab:hover { background:#e8d4a6; }
                .ts-tab.active { background:#d9b46f; color:#fff; border-color:#9a7439; font-weight:bold; }
                .ts-tab-title { pointer-events:none; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .ts-tab-rename { border:1px solid #b08b4f; background:#fff6de; border-radius:4px; padding:0 4px; line-height:18px; height:20px; cursor:pointer; font-size:12px; }
                .ts-tab.active .ts-tab-rename { border-color:#9a7439; }
                .ts-gas-label { display:block; margin-bottom:8px; font-size:13px; font-weight:bold; cursor:pointer; }
                .ts-label { font-weight:bold; font-size:13px; }
                .ts-coords { width:100%; box-sizing:border-box; font:13px/1.4 monospace; border:1px solid #b08b4f; border-radius:6px; padding:8px; resize:vertical; background:#fffbe8; }
                .ts-hr { border:none; border-top:1px solid #d4c4a0; margin:12px 0; }
                .ts-units { display:flex; flex-wrap:wrap; gap:8px; background:#fffbe8; border-radius:6px; border:1px solid #d4c4a0; padding:8px; }
                .ts-unit-label { display:flex; align-items:center; gap:3px; cursor:pointer; font-size:12px; }
                .ts-unit-icon { width:20px; height:20px; display:block; }
                .ts-unit-cb { margin:0; cursor:pointer; }
                .ts-number-input { width:80px; padding:6px 8px; border:1px solid #b08b4f; border-radius:4px; font:13px monospace; background:#fffbe8; }
                .ts-select { width:100%; padding:6px 8px; border:1px solid #b08b4f; border-radius:4px; font:13px; background:#fffbe8; cursor:pointer; }
                .ts-time-input { padding:4px 6px; border:1px solid #b08b4f; border-radius:4px; font:12px monospace; background:#fffbe8; }
                .ts-dur-input { padding:4px 6px; border:1px solid #b08b4f; border-radius:4px; font:12px monospace; background:#fffbe8; width:100px; }
                .ts-duration-block.ts-disabled-block { opacity:.55; }
                .ts-date-block { display:flex; flex-direction:column; gap:6px; }
                .ts-date-label { font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; }
                .ts-date-input { width:170px; padding:4px 6px; border:1px solid #b08b4f; border-radius:4px; font:12px monospace; background:#fffbe8; }
                .ts-sigil-block { display:flex; flex-direction:column; gap:4px; }
                .ts-sigil-label { font-size:13px; font-weight:bold; cursor:pointer; }
                .ts-sigil-hint { font-size:11px; color:#7a6a50; }
                .ts-sigil-hint code { background:#f0e6cc; padding:1px 4px; border-radius:3px; font:11px monospace; }
                .ts-sigil-input { width:80px; padding:4px 6px; border:1px solid #b08b4f; border-radius:4px; font:12px monospace; background:#fffbe8; }
                .ts-noble-block { display:flex; flex-direction:column; gap:6px; }
                .ts-noble-label { font-size:13px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; }
                .ts-noble-row { display:flex; align-items:center; gap:8px; }
                .ts-noble-row span { font-size:12px; color:#6c5b44; }
                .ts-noble-min-input { width:72px; padding:4px 6px; border:1px solid #b08b4f; border-radius:4px; font:12px monospace; background:#fffbe8; }
                .ts-noble-progress { display:none; background:#f5ecd7; border:1px solid #d4c4a0; border-radius:6px; padding:6px; }
                .ts-noble-progress-track { height:8px; border-radius:999px; background:#e2d3b4; overflow:hidden; }
                .ts-noble-progress-fill { width:0%; height:100%; background:#27ae60; transition:width .2s linear; }
                .ts-noble-progress-text { margin-top:5px; font-size:11px; color:#5f4d37; }
                .ts-templates-block { }
                .ts-templates-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
                .ts-tmpl-add-btn { padding:4px 10px; background:#e67e22; color:#fff; border:none; border-radius:4px; cursor:pointer; font-size:12px; font-weight:bold; }
                .ts-tmpl-add-btn:hover { background:#d35400; }
                .ts-templates-list { max-height:180px; overflow-y:auto; }
                .ts-no-templates { font-size:11px; color:#999; padding:4px 0; }
                .ts-tmpl-row { display:flex; align-items:center; gap:6px; padding:5px 8px; margin-bottom:3px; background:#fffbe8; border:1px solid #d4c4a0; border-radius:4px; font-size:12px; }
                .ts-tmpl-row.active { border-color:#e67e22; background:#fff5e6; }
                .ts-tmpl-name { font-weight:bold; min-width:60px; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .ts-tmpl-units { flex:1; display:flex; flex-wrap:wrap; gap:3px; align-items:center; }
                .ts-tmpl-unit-icon { width:18px; height:18px; }
                .ts-tmpl-unit-num { font-size:11px; color:#555; margin-right:4px; }
                .ts-tmpl-active-label { flex-shrink:0; }
                .ts-tmpl-del { flex-shrink:0; background:#e74c3c; color:#fff; border:none; border-radius:3px; width:20px; height:20px; cursor:pointer; font-size:12px; }
                /* Template modal */
                .ts-tmpl-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:1000000; display:flex; align-items:center; justify-content:center; }
                .ts-tmpl-modal { background:#f3ead5; border:2px solid #b08b4f; border-radius:10px; width:500px; max-width:95vw; max-height:90vh; overflow-y:auto; box-shadow:0 10px 30px rgba(0,0,0,.4); }
                .ts-tmpl-modal-head { background:#b08b4f; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; border-radius:8px 8px 0 0; }
                .ts-tmpl-modal-close { background:#c0392b; color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:13px; }
                .ts-tmpl-modal-body { padding:14px; }
                .ts-tmpl-name-input { width:100%; padding:6px 8px; border:1px solid #b08b4f; border-radius:4px; font:13px; background:#fffbe8; margin-bottom:10px; box-sizing:border-box; }
                .ts-tmpl-units-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
                .ts-tmpl-unit-row { display:flex; align-items:center; gap:4px; background:#fffbe8; padding:4px 6px; border-radius:4px; border:1px solid #d4c4a0; }
                .ts-tmpl-unit-row input { width:50px; border:1px solid #b08b4f; border-radius:3px; text-align:center; font:12px monospace; background:#fff; padding:2px; }
                .ts-tmpl-save { display:block; width:100%; padding:10px; background:#27ae60; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:bold; }
                .ts-tmpl-save:hover { background:#2ecc71; }
                .ts-nearest-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000001; display:flex; align-items:center; justify-content:center; }
                .ts-nearest-modal { width:min(1200px, calc(100vw - 24px)); max-height:calc(100vh - 24px); background:#f3ead5; border:2px solid #b08b4f; border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.45); display:flex; flex-direction:column; overflow:hidden; }
                .ts-nearest-head { background:#b08b4f; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; }
                .ts-nearest-close { background:#c0392b; color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:13px; line-height:1; }
                .ts-nearest-body { padding:10px 12px 12px; overflow:auto; }
                .ts-nearest-summary { margin-bottom:8px; font-size:13px; color:#3a2a16; }
                .ts-nearest-table-wrap { overflow:auto; border:1px solid #d4c4a0; border-radius:8px; background:#fffbe8; }
                .ts-nearest-table { width:100%; border-collapse:collapse; font-size:12px; min-width:940px; }
                .ts-nearest-table th, .ts-nearest-table td { border-bottom:1px solid #e5d6b6; padding:6px 8px; text-align:left; white-space:nowrap; }
                .ts-nearest-table th { position:sticky; top:0; background:#f0e2bf; z-index:1; }
                .ts-nearest-empty { font-size:13px; color:#6a5840; padding:10px 2px; }
                .ts-help-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000002; display:flex; align-items:center; justify-content:center; }
                .ts-help-modal { width:min(900px, calc(100vw - 24px)); max-height:calc(100vh - 24px); background:#f3ead5; border:2px solid #b08b4f; border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.45); display:flex; flex-direction:column; overflow:hidden; }
                .ts-help-head { background:#b08b4f; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; }
                .ts-help-close { background:#c0392b; color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:13px; line-height:1; }
                .ts-help-body { padding:12px 14px; overflow:auto; font-size:13px; line-height:1.45; color:#3a2a16; white-space:pre-wrap; background:#fffbe8; }
                #ts-windows { margin-bottom:8px; }
                .ts-tw { display:flex; align-items:center; gap:6px; margin-bottom:6px; background:#fffbe8; padding:6px 8px; border-radius:6px; border:1px solid #d4c4a0; }
                .ts-tw-label { font-weight:bold; font-size:12px; white-space:nowrap; }
                .ts-tw-input { padding:4px 6px; border:1px solid #b08b4f; border-radius:4px; text-align:center; font:12px monospace; }
                .ts-tw-sep { color:#888; }
                .ts-tw-remove { background:#e74c3c; color:#fff; border:none; border-radius:4px; width:22px; height:22px; cursor:pointer; font-size:13px; margin-left:auto; flex-shrink:0; }
                .ts-tw-remove:hover { background:#c0392b; }
                .ts-add-btn { display:block; width:100%; padding:8px; background:#27ae60; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; }
                .ts-add-btn:hover { background:#2ecc71; }
                .ts-save-btn { display:block; width:100%; padding:10px; background:#2980b9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:14px; font-weight:bold; }
                .ts-save-btn:hover { background:#3498db; }
                .ts-export-btn { display:block; width:100%; margin-top:8px; padding:9px; background:#6c757d; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; }
                .ts-export-btn:hover { background:#5d666e; }
                .ts-import-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000003; display:flex; align-items:center; justify-content:center; }
                .ts-import-modal { width:min(460px, calc(100vw - 24px)); background:#f3ead5; border:2px solid #b08b4f; border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.45); overflow:hidden; }
                .ts-import-head { background:#b08b4f; color:#fff; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; font-weight:bold; }
                .ts-import-close { background:#c0392b; color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:13px; line-height:1; }
                .ts-import-body { padding:12px 14px 14px; }
                .ts-import-label { font-size:13px; font-weight:bold; margin-bottom:6px; }
                .ts-import-btn { margin-top:10px; width:100%; padding:9px; background:#2980b9; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:bold; }
                .ts-import-btn:hover { background:#3498db; }
                .ts-import-list { max-height:50vh; overflow:auto; display:flex; flex-direction:column; gap:8px; }
                .ts-import-row { background:#fffbe8; border:1px solid #d4c4a0; border-radius:8px; padding:8px; }
                .ts-import-row-title { font-size:12px; font-weight:bold; color:#5f4d37; margin-bottom:6px; }
                .ts-import-row-controls { display:flex; gap:8px; align-items:center; }
                .ts-import-tab-select-row { flex:1; min-width:0; }
                .ts-import-btn-row { margin-top:0; width:auto; min-width:96px; }
                .ts-notice-box { position:fixed; right:12px; top:12px; z-index:1000005; display:flex; flex-direction:column; gap:8px; pointer-events:none; }
                .ts-notice { min-width:240px; max-width:min(520px, calc(100vw - 24px)); background:#2f3b46; color:#fff; border-radius:8px; padding:10px 12px; box-shadow:0 10px 24px rgba(0,0,0,.35); font-size:12px; line-height:1.35; opacity:0; transform:translateY(-6px); transition:opacity .16s ease, transform .16s ease; pointer-events:auto; cursor:pointer; }
                .ts-notice.show { opacity:1; transform:translateY(0); }
                .ts-notice-success { background:#2e7d32; }
                .ts-notice-warn { background:#a66700; }
                .ts-notice-error { background:#a62929; }
                .ts-export-fallback-overlay { position:fixed; inset:0; background:rgba(0,0,0,.45); z-index:1000006; display:flex; align-items:center; justify-content:center; }
                .ts-export-fallback-modal { width:min(900px, calc(100vw - 24px)); max-height:calc(100vh - 24px); background:#f3ead5; border:2px solid #b08b4f; border-radius:12px; box-shadow:0 14px 34px rgba(0,0,0,.45); overflow:hidden; display:flex; flex-direction:column; }
                .ts-export-fallback-head { background:#b08b4f; color:#fff; padding:10px 14px; display:flex; justify-content:space-between; align-items:center; font-weight:bold; }
                .ts-export-fallback-close { background:#c0392b; color:#fff; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer; font-size:13px; line-height:1; }
                .ts-export-fallback-body { padding:12px; overflow:auto; }
                .ts-export-fallback-text { width:100%; min-height:300px; resize:vertical; border:1px solid #b08b4f; border-radius:6px; background:#fffbe8; color:#3a2a16; font:12px/1.4 monospace; padding:10px; box-sizing:border-box; }
            `;
            document.head.appendChild(style);
        }

        function fetchXml(url) {
            const cacheKey = 'xml:' + url.replace(/[?&]village=\d+/g, '');
            const cached = cacheGet(cacheKey);
            if (cached) {
                console.log(`[cache] HIT: ${cacheKey}`);
                return Promise.resolve(new DOMParser().parseFromString(cached, 'text/xml'));
            }
            console.log(`[cache] MISS: ${cacheKey}`);
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const text = xhr.responseText;
                        cacheSet(cacheKey, text);
                        resolve(xhr.responseXML || new DOMParser().parseFromString(text, 'text/xml'));
                    } else {
                        reject(new Error(url + ' ' + xhr.status));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error: ' + url));
                xhr.send();
            });
        }

        async function loadWorldSettings() {
            const [configXml, unitXml] = await Promise.all([fetchXml('/interface.php?func=get_config'), fetchXml('/interface.php?func=get_unit_info')]);
            const worldSpeed = toNumber(readXmlText(configXml, 'config>speed, speed'));
            const unitSpeed = toNumber(readXmlText(configXml, 'config>unit_speed, unit_speed'));
            
            console.log(`%c[debug] worldSpeed=${worldSpeed}, unitSpeed=${unitSpeed}`, 'color:cyan');
            
            const speedFactor = (Number.isFinite(worldSpeed) && Number.isFinite(unitSpeed)) ? worldSpeed * unitSpeed : null;
            console.log(`%c[debug] speedFactor (worldSpeed * unitSpeed) = ${speedFactor}`, 'color:cyan');
            
            const unitSpeedBase = {};
            Array.from(unitXml.querySelectorAll('config>*')).forEach(node => {
                const key = cleanText(node?.nodeName).toLowerCase();
                const speed = toNumber(readXmlText(node, 'speed'));
                if (Number.isFinite(speed) && speed > 0) unitSpeedBase[key] = speed;
            });
            console.log(`%c[debug] unitSpeedBase from API: ${JSON.stringify(unitSpeedBase)}`, 'color:cyan');
            
            const unitSpeedEffective = {};
            // API уже возвращает эффективные скорости (base / speedFactor)
            // Не делим повторно!
            Object.entries(unitSpeedBase).forEach(([unit, base]) => {
                unitSpeedEffective[unit] = base;
            });
            console.log(`%c[debug] unitSpeedEffective (прямое значение из API): ${JSON.stringify(unitSpeedEffective)}`, 'color:cyan');
            
            return { worldSpeed, unitSpeed, speedFactor, unitSpeedBase, unitSpeedEffective };
        }

        function fetchPage(url) {
            const cacheKey = url.replace(/[?&]village=\d+/g, '');
            const ttl = getTTL(cacheKey);

            // Commands page: never cache
            if (ttl === 0) {
                console.log(`[cache] SKIP (always fresh): ${cacheKey}`);
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('GET', url, true);
                    xhr.onload = () => xhr.status === 200 ? resolve(xhr.responseText) : reject(new Error(url + ' ' + xhr.status));
                    xhr.onerror = () => reject(new Error('Network error: ' + url));
                    xhr.send();
                });
            }

            const cached = cacheGet(cacheKey);
            if (cached) {
                console.log(`[cache] HIT (${(ttl/1000)}s): ${cacheKey}`);
                return Promise.resolve(cached);
            }
            console.log(`[cache] MISS (${(ttl/1000)}s): ${cacheKey}`);
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        cacheSet(cacheKey, xhr.responseText);
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(url + ' ' + xhr.status));
                    }
                };
                xhr.onerror = () => reject(new Error('Network error: ' + url));
                xhr.send();
            });
        }

        function fetchPageFresh(url) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.onload = () => {
                    if (xhr.status === 200) resolve(xhr.responseText);
                    else reject(new Error(url + ' ' + xhr.status));
                };
                xhr.onerror = () => reject(new Error('Network error: ' + url));
                xhr.send();
            });
        }

        function parseUnitsPage(html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const result = {};
            doc.querySelectorAll('#units_table tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 4) return;
                if (cleanText(cells[1]?.textContent) !== 'свои') return;
                const firstCell = cells[0];
                const quickeditEl = firstCell.querySelector('.quickedit-vn');
                if (!quickeditEl) return;
                const villageId = quickeditEl.getAttribute('data-id');
                const labelEl = firstCell.querySelector('.quickedit-label');
                const coord = labelEl ? parseCoord(labelEl.textContent) : null;
                const units = {};
                row.querySelectorAll('td.unit-item').forEach((cell, i) => {
                    if (i < UNIT_NAMES.length) units[UNIT_NAMES[i]] = parseInt(cell.textContent.trim(), 10) || 0;
                });
                result[villageId] = { units, coord };
            });
            return result;
        }

        function parseProdPage(html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const result = {};
            const isMobile = doc.body && doc.body.classList.contains('mds');

            if (isMobile) {
                // Mobile: points are in <h4 class="points-header"> after quickedit-vn
                doc.querySelectorAll('.points-header').forEach(h4 => {
                    const quickeditEl = h4.querySelector('.quickedit-vn');
                    if (!quickeditEl) return;
                    const villageId = quickeditEl.getAttribute('data-id');
                    // Get all span direct children, skip quickedit-vn
                    const allSpans = h4.children;
                    let pointsSpan = null;
                    for (let i = 0; i < allSpans.length; i++) {
                        if (allSpans[i].tagName === 'SPAN' && !allSpans[i].classList.contains('quickedit-vn')) {
                            pointsSpan = allSpans[i];
                        }
                    }
                    if (!pointsSpan) return;
                    const pointsText = pointsSpan.textContent
                        .replace(/\./g, '')
                        .replace(/[\s\u00a0]/g, '');
                    result[villageId] = { points: parseInt(pointsText, 10) || 0 };
                });
            } else {
                // Desktop: production table
                doc.querySelectorAll('#production_table tbody tr').forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length < 3) return;
                    const quickeditEl = row.querySelector('.quickedit-vn');
                    if (!quickeditEl) return;
                    const villageId = quickeditEl.getAttribute('data-id');
                    const pointsHtml = cells[2].innerHTML
                        .replace(/<span class="grey">\.<\/span>/g, '')
                        .replace(/<[^>]+>/g, '')
                        .replace(/[.\s]/g, '');
                    result[villageId] = { points: parseInt(pointsHtml, 10) || 0 };
                });
            }
            return result;
        }

        function getServerTimeMs() {
            if (window.Timing && typeof Timing.getCurrentServerTime === 'function') {
                return Timing.getCurrentServerTime();
            }
            const diff = Date.now() - window.game_data.time_generated;
            return window.game_data.time_generated + diff;
        }

        function formatHMS(epochMs) {
            // Format epoch ms as HH:MM:SS time of day
            const dayStart = getDayStartMs(epochMs);
            const secSinceMidnight = Math.floor((epochMs - dayStart) / 1000);
            const hh = Math.floor(secSinceMidnight / 3600);
            const mm = Math.floor((secSinceMidnight % 3600) / 60);
            const ss = secSinceMidnight % 60;
            return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        }

        function formatDuration(ms) {
            // Format duration in ms as HH:MM:SS
            const totalSec = Math.max(0, Math.round(ms / 1000));
            const hh = Math.floor(totalSec / 3600);
            const mm = Math.floor((totalSec % 3600) / 60);
            const ss = totalSec % 60;
            return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        }

        function parseClockToSec(value) {
            const raw = cleanText(value);
            if (!raw) return null;
            const parts = raw.split(':').map(x => toInt(x));
            if (parts.length < 2 || parts.length > 3) return null;
            const hh = parts[0];
            const mm = parts[1];
            const ss = parts.length === 3 ? parts[2] : 0;
            if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
            return hh * 3600 + mm * 60 + ss;
        }

        function parseDurationToSec(value, fallbackSec = 0) {
            const raw = cleanText(value);
            if (!raw) return fallbackSec;
            const parts = raw.split(':').map(x => toInt(x));
            if (parts.length < 1 || parts.length > 3) return fallbackSec;
            if (parts.some(p => !Number.isFinite(p) || p < 0)) return fallbackSec;
            let hh = 0, mm = 0, ss = 0;
            if (parts.length === 1) {
                hh = parts[0];
            } else if (parts.length === 2) {
                hh = parts[0];
                mm = parts[1];
            } else {
                hh = parts[0];
                mm = parts[1];
                ss = parts[2];
            }
            return hh * 3600 + mm * 60 + ss;
        }

        function getDayStartMs(epochMs) {
            const d = new Date(epochMs);
            return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        }

        function getServerSecondsSinceMidnightFromMs(epochMs) {
            const d = getServerLocalDate(epochMs);
            return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
        }

        function getNowSecondsSinceMidnight() {
            return getServerSecondsSinceMidnightFromMs(getServerTimeMs());
        }

        function formatServerDateTime(epochMs) {
            return `${formatServerDateYmd(epochMs)} ${formatHMS(epochMs)}`;
        }

        // (sendSec + travelSec) % 86400 → check against windows
        function findMatchingWindow(nowMs, travelMs, windows, targetDate = '') {
            const nowSec = getServerSecondsSinceMidnightFromMs(nowMs);
            const travelSec = Math.floor(travelMs / 1000);
            const arrivalSec = (nowSec + travelSec) % 86400;
            const arrivalMs = nowMs + travelMs;
            const targetDateYmd = normalizeDateYmd(targetDate, '');
            if (targetDateYmd && formatServerDateYmd(arrivalMs) !== targetDateYmd) {
                return null;
            }

            const nowH = Math.floor(nowSec / 3600);
            const nowM = Math.floor((nowSec % 3600) / 60);
            const travH = Math.floor(travelSec / 3600);
            const travM = Math.floor((travelSec % 3600) / 60);
            const arrH = Math.floor(arrivalSec / 3600);
            const arrM = Math.floor((arrivalSec % 3600) / 60);

            console.log(`[window] ${String(nowH).padStart(2,'0')}:${String(nowM).padStart(2,'0')} + ${travH}h${travM}m = ${String(arrH).padStart(2,'0')}:${String(arrM).padStart(2,'0')} | nowSec=${nowSec} travelSec=${travelSec} arrivalSec=${arrivalSec}`);

            for (const w of windows) {
                const fromSec = parseClockToSec(w?.from);
                const toSec = parseClockToSec(w?.to);
                if (fromSec == null || toSec == null) continue;

                let matched = false;
                if (toSec >= fromSec) {
                    matched = arrivalSec >= fromSec && arrivalSec <= toSec;
                } else {
                    matched = arrivalSec >= fromSec || arrivalSec <= toSec;
                }
                if (matched) {
                    return {
                        label: `${w.from}–${w.to}`,
                        arrivalSec,
                        arrivalMs
                    };
                }
            }
            return null;
        }

        function computeDistance(a, b) {
            if (!a || !b) return null;
            const dx = Math.abs(b.x - a.x);
            const dy = Math.abs(b.y - a.y);
            return Math.sqrt(dx * dx + dy * dy);
        }

        // ─── spam army calculation ─────────────────────────────
        const POP_COST = {
            spear: 1, sword: 1, axe: 1,
            spy: 2, light: 4, heavy: 6,
            ram: 5, catapult: 8,
            knight: 10, snob: 100,
            archer: 1, marcher: 1, militia: 0
        };

        // Speed order: slowest → fastest (by field travel time)
        const SPEED_TIERS = [
            ['snob'],
            ['ram', 'catapult'],
            ['sword'],
            ['spear', 'axe'],
            ['heavy'],
            ['light', 'knight'],
            ['spy'],
        ];

        // Get all units that are at least as fast as `unit`
        function getFasterUnits(unit) {
            const allowed = [];
            let found = false;
            for (const tier of SPEED_TIERS) {
                if (tier.includes(unit)) found = true;
                if (found) allowed.push(...tier);
            }
            return allowed;
        }

        function computeSpamArmy(villageUnits, points, allowedUnits, requiredUnit = null) {
            const targetPop = Math.max(1, Math.ceil(points * 0.01));
            const mustInclude = cleanText(requiredUnit).toLowerCase();
            console.log(`[army] points=${points}, targetPop=${targetPop}, allowedUnits=${JSON.stringify(allowedUnits)}, requiredUnit=${mustInclude || '-'}`);
            const composition = {};
            let usedPop = 0;
            const finalize = () => {
                if (mustInclude) {
                    const haveInVillage = villageUnits[mustInclude] || 0;
                    if (haveInVillage <= 0) {
                        return { composition: {}, totalPop: 0 };
                    }
                    if ((composition[mustInclude] || 0) <= 0) {
                        composition[mustInclude] = 1;
                    }
                }
                let finalPop = 0;
                Object.entries(composition).forEach(([u, c]) => { finalPop += c * (POP_COST[u] || 1); });
                return { composition, totalPop: finalPop };
            };

            const available = allowedUnits.filter(u => (villageUnits[u] || 0) > 0);
            if (available.length === 0) {
                console.log(`[army] no available units, villageUnits=${JSON.stringify(allowedUnits.map(u => `${u}:${villageUnits[u]||0}`))}`);
                return { composition, totalPop: 0 };
            }
            if (mustInclude && !available.includes(mustInclude)) {
                return { composition, totalPop: 0 };
            }

            // 1 ram + 1 catapult max (only if they're in allowed units)
            if (available.includes('ram') && (villageUnits.ram || 0) > 0 && !composition.ram) {
                composition.ram = 1;
                usedPop += POP_COST.ram;
            }
            if (available.includes('catapult') && (villageUnits.catapult || 0) > 0 && !composition.catapult) {
                composition.catapult = 1;
                usedPop += POP_COST.catapult;
            }

            const remainingPop = targetPop - usedPop;
            if (remainingPop <= 0) return finalize();

            // Proportional distribution among non-special units
            const nonSpecial = available.filter(u => u !== 'ram' && u !== 'catapult');
            const weights = {};
            let totalWeight = 0;
            nonSpecial.forEach(u => {
                const cnt = villageUnits[u] || 0;
                if (cnt > 0) {
                    weights[u] = cnt * (POP_COST[u] || 1);
                    totalWeight += weights[u];
                }
            });
            if (totalWeight === 0) {
                // If no non-special units, try to fill remaining with whatever is available
                for (const u of available) {
                    if (composition[u]) continue;
                    const cost = POP_COST[u] || 1;
                    const cnt = villageUnits[u] || 0;
                    const canAdd = Math.min(Math.floor(remainingPop / cost), cnt);
                    if (canAdd > 0) {
                        composition[u] = canAdd;
                        usedPop += canAdd * cost;
                    }
                }
                return finalize();
            }

            const rawCounts = {};
            nonSpecial.forEach(u => {
                if (!weights[u]) return;
                const popShare = remainingPop * weights[u] / totalWeight;
                rawCounts[u] = popShare / (POP_COST[u] || 1);
                composition[u] = Math.max(0, Math.floor(rawCounts[u]));
            });

            // Distribute leftover pop by highest fractional part
            let currentPop = usedPop;
            nonSpecial.forEach(u => {
                if (composition[u]) currentPop += composition[u] * (POP_COST[u] || 1);
            });
            let leftover = remainingPop - (currentPop - usedPop);
            if (leftover > 0) {
                const sorted = nonSpecial
                    .filter(u => rawCounts[u] && composition[u] < (villageUnits[u] || 0))
                    .sort((a, b) => (rawCounts[b] % 1) - (rawCounts[a] % 1));
                for (const u of sorted) {
                    if (leftover <= 0) break;
                    const cost = POP_COST[u] || 1;
                    while (leftover >= cost && composition[u] < (villageUnits[u] || 0)) {
                        composition[u]++;
                        leftover -= cost;
                    }
                }
            }

            return finalize();
        }

        function formatArmy(comp) {
            return Object.entries(comp).filter(([, c]) => c > 0).map(([u, c]) => `${u}: ${c}`).join(', ') || '—';
        }

        function parseCommandsPage(html) {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const commands = [];
            doc.querySelectorAll('#commands_table tr').forEach(row => {
                if (row.querySelector('th')) return;
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) return;

                const labelEl = cells[0].querySelector('.quickedit-label');
                const labelText = labelEl ? labelEl.textContent : '';
                const targetCoord = parseCoord(labelText);
                if (!targetCoord) return;

                const srcLink = cells[1].querySelector('a[href*="info_village"]');
                if (!srcLink) return;
                const srcHref = srcLink.getAttribute('href') || srcLink.href;
                const srcMatch = srcHref.match(/[?&]id=(\d+)/);
                if (!srcMatch) return;
                const villageId = srcMatch[1];

                const timeText = cells[2].textContent;
                const timeMatch = timeText.match(/(\d{2}):(\d{2}):(\d{2})/);
                if (!timeMatch) return;
                const arrivalSec = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseInt(timeMatch[3]);

                commands.push({ villageId, targetKey: `${targetCoord.x}|${targetCoord.y}`, arrivalSec });
            });
            return commands;
        }

        // Parse /map/village.txt → Map<"x|y", villageId>
        function parseVillageMap(text) {
            const map = new Map();
            String(text || '').split(/\r?\n/).forEach(line => {
                const cols = line.split(',');
                if (cols.length < 4) return;
                const id = cols[0].trim();
                const x = parseInt(cols[2].trim(), 10);
                const y = parseInt(cols[3].trim(), 10);
                if (id && !isNaN(x) && !isNaN(y)) {
                    map.set(`${x}|${y}`, id);
                }
            });
            return map;
        }

        function startMainLogic() {
            const config = loadConfig();
            const targetCoords = config?.coords || [];
            const winList = config?.timeWindows || [];
            const savedUnits = config?.selectedUnits || null;

            if (savedUnits) selectedUnits = savedUnits;

            console.log('%c=== Saved Config ===', 'font-size:14px;font-weight:bold');
            console.log('Target coords:', targetCoords);
            console.log('Time windows:', winList);
            console.log('Selected units:', selectedUnits);

            const unitsUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=units&type=complete&group=0&page=-1&type=complete`;
            const prodUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=prod&group=0&page=-1&`;

            const commandsUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=commands&type=all&group=0&page=-1&&type=all`;
            const villageMapUrl = '/map/village.txt';

            Promise.all([fetchPage(unitsUrl), fetchPage(prodUrl), fetchPage(commandsUrl), fetchPage(villageMapUrl), loadWorldSettings()])
                .then(([unitsHtml, prodHtml, commandsHtml, villageMapText, settings]) => {
                    const unitsData = parseUnitsPage(unitsHtml);
                    const prodData = parseProdPage(prodHtml);
                    const existingCommands = parseCommandsPage(commandsHtml);
                    const villageIdByCoord = parseVillageMap(villageMapText);
                    console.log('%c=== Existing Commands ===', 'font-size:12px;font-weight:bold;color:orange');
                    console.log(`Found ${existingCommands.length} outgoing commands, ${villageIdByCoord.size} villages loaded`);

                    // Build a set of (villageId, targetKey) pairs that are already scheduled
                    // Also count how many attacks per village
                    const scheduledSet = new Set();
                    const villageAttackCount = {};
                    existingCommands.forEach(cmd => {
                        scheduledSet.add(`${cmd.villageId}_${cmd.targetKey}`);
                        villageAttackCount[cmd.villageId] = (villageAttackCount[cmd.villageId] || 0) + 1;
                    });

                    const allVillageIds = new Set([...Object.keys(unitsData), ...Object.keys(prodData)]);
                    const mergedData = [];
                    allVillageIds.forEach(id => {
                        const entry = { id };
                        if (prodData[id]) entry.points = prodData[id].points;
                        if (unitsData[id]) {
                            const { coord, units } = unitsData[id];
                            if (coord) entry.coord = `${coord.x}|${coord.y}`;
                            Object.assign(entry, units);
                        }
                        mergedData.push(entry);
                    });
                    console.log('%c=== Village Data ===', 'font-size:14px;font-weight:bold');
                    console.table(mergedData);

                    console.log('%c=== World Settings ===', 'font-size:14px;font-weight:bold');
                    console.log('World Speed:  ', settings.worldSpeed);
                    console.log('Unit Speed:   ', settings.unitSpeed);
                    console.log('Speed Factor: ', settings.speedFactor);
                    console.log('%c=== Unit Speeds (hours per field) ===', 'font-size:14px;font-weight:bold');
                    console.table(Object.entries(settings.unitSpeedEffective).map(([u, h]) => ({ unit: u, hours: Number(h).toFixed(4) })));

                    if (!targetCoords.length || (!selectedUnits.length && !getActiveTemplates().length) || !winList.length) {
                        console.log('%c[timeSpam] Нет целей, юнитов или окон. Пропускаю расчёт.', 'color:orange');
                        return;
                    }

                    const nowMs = getServerTimeMs();
                    const globalSigilAll = targetCoords.some(c => parseCoordSigilInfo(c).isGlobal);
                    const targets = targetCoords.map(c => {
                        const str = typeof c === 'string' ? c.trim() : '';
                        const info = parseCoordSigilInfo(str);
                        const hasSigil = globalSigilAll || info.hasSigil;
                        const cleanCoord = info.cleanCoordText;
                        const coord = parseCoord(cleanCoord);
                        return coord ? { ...coord, sigil: hasSigil } : null;
                    }).filter(Boolean);
                    if (!targets.length) { console.log('[timeSpam] Нет валидных целевых координат.'); return; }

                    const results = [];
                    // Pre-compute army for each village + unit combination
                    const villageArmyCache = {}; // "villageId_unit" -> army
                    // Track how many attacks we've scheduled per village (start with existing commands)
                    const scheduledCount = {};
                    Object.entries(villageAttackCount).forEach(([vid, cnt]) => { scheduledCount[vid] = cnt; });

                    allVillageIds.forEach(villageId => {
                        const ud = unitsData[villageId];
                        if (!ud || !ud.coord || !ud.units) return;
                        const pts = prodData[villageId] ? prodData[villageId].points : 0;

                        // For each selected unit that exists in this village
                        selectedUnits.forEach(unit => {
                            if ((ud.units[unit] || 0) <= 0) return;
                            const faster = getFasterUnits(unit);
                            const key = `${villageId}_${unit}`;
                            villageArmyCache[key] = computeSpamArmy(ud.units, pts, faster, unit);
                        });
                    });

                    allVillageIds.forEach(villageId => {
                        const ud = unitsData[villageId];
                        if (!ud || !ud.coord || !ud.units) return;

                        targets.forEach(target => {
                            const dist = computeDistance(ud.coord, target);
                            if (!dist || dist <= 0) return;
                            const targetKey = `${target.x}|${target.y}`;

                            // Determine what to iterate: templates or units
                            const activeTmpls = getActiveTemplates();
                            const useTemplates = activeTmpls.length > 0;
                            if (villageId === Object.keys(unitsData)[0]) {
                                console.log(`%c[templates debug] useTemplates=${useTemplates}, activeTmpls=${JSON.stringify(activeTmpls)}`, 'color:yellow');
                            }

                            const processTask = (taskType, taskData, taskName) => {
                                let hpf, armyComp, armyPop, armyText;

                                if (taskType === 'template') {
                                    if (villageId === Object.keys(unitsData)[0]) {
                                        console.log(`%c[template] processing: ${taskName}, units=${JSON.stringify(taskData.units)}`, 'color:magenta');
                                    }
                                    // Template: use slowest unit for time
                                    let slowestHpf = 0;
                                    for (const u of Object.keys(taskData.units)) {
                                        const uHpf = settings.unitSpeedEffective[u] || 0;
                                        if (uHpf > slowestHpf) slowestHpf = uHpf;
                                    }
                                    if (slowestHpf <= 0) {
                                        if (villageId === Object.keys(unitsData)[0]) console.log(`[template] slowestHpf=0, skip`);
                                        return;
                                    }
                                    hpf = slowestHpf;
                                    // Check if village has enough units for template
                                    for (const [u, cnt] of Object.entries(taskData.units)) {
                                        if ((ud.units[u] || 0) < cnt) {
                                            if (villageId === Object.keys(unitsData)[0]) console.log(`[template] not enough ${u}: need ${cnt}, have ${ud.units[u]||0}`);
                                            return;
                                        }
                                    }
                                    armyComp = taskData.units;
                                    armyPop = 0;
                                    for (const [u, c] of Object.entries(armyComp)) {
                                        armyPop += c * (POP_COST[u] || 1);
                                    }
                                    armyText = formatArmy(armyComp);
                                    if (villageId === Object.keys(unitsData)[0]) console.log(`[template] armyComp=${JSON.stringify(armyComp)}, armyText=${armyText}`);
                                } else {
                                    // Single unit
                                    hpf = taskData;
                                    if (!Number.isFinite(hpf) || hpf <= 0) return;
                                    const armyKey = `${villageId}_${taskName}`;
                                    const army = villageArmyCache[armyKey];
                                    if (!army || army.totalPop === 0) return;
                                    armyComp = army.composition;
                                    armyPop = army.totalPop;
                                    armyText = formatArmy(armyComp);
                                }

                                // Skip if village already has max attacks scheduled
                                const currentCount = scheduledCount[villageId] || 0;
                                if (currentCount >= maxPerVillage) return;

                                // Apply sigil bonus
                                let effectiveHpf = hpf;
                                if (sigilEnabled && target.sigil && sigilPercent > 0) {
                                    effectiveHpf = hpf / (1 + sigilPercent / 100);
                                }

                                const travelMs = dist * effectiveHpf * 60 * 1000;
                                const arrivalMs = nowMs + travelMs;
                                const matched = findMatchingWindow(nowMs, travelMs, winList);
                                if (!matched) return;

                                const scheduleKey = `${villageId}_${targetKey}`;
                                if (scheduledSet.has(scheduleKey)) return;

                                const nowSec = getNowSecondsSinceMidnight();
                                const travelSec = Math.floor(travelMs / 1000);
                                const arrivalSec = (nowSec + travelSec) % 86400;
                                const arrivalTimeStr = `${String(Math.floor(arrivalSec / 3600)).padStart(2,'0')}:${String(Math.floor((arrivalSec % 3600) / 60)).padStart(2,'0')}:${String(arrivalSec % 60).padStart(2,'0')}`;

                                const parts = [];
                                parts.push(`village=${villageId}`);
                                parts.push('screen=place');
                                parts.push('from=simulator');
                                parts.push(`x=${target.x}`);
                                parts.push(`y=${target.y}`);
                                Object.entries(armyComp).forEach(([u, c]) => {
                                    if (c > 0) parts.push(`att_${u}=${c}`);
                                });
                                const targetVillageId = villageIdByCoord.get(targetKey);
                                if (targetVillageId) parts.push(`target=${targetVillageId}`);
                                const sendUrl = `${parts.join('&')}`;

                                const travelSecCheck = travelMs / 1000;
                                const minParts = minDuration.split(':').map(Number);
                                const maxParts = maxDuration.split(':').map(Number);
                                const minSec = minParts[0] * 3600 + minParts[1] * 60 + minParts[2];
                                const maxSec = maxParts[0] * 3600 + maxParts[1] * 60 + maxParts[2];
                                if (travelSecCheck < minSec || travelSecCheck > maxSec) return;

                                results.push({
                                    villageId, villageCoord: `${ud.coord.x}|${ud.coord.y}`,
                                    targetCoord: targetKey, unit: taskName, distance: Number(dist).toFixed(2),
                                    travelTime: formatDuration(travelMs), sendTime: formatHMS(nowMs),
                                    arrivalTime: arrivalTimeStr, windowLabel: matched.label,
                                    army: armyText, armyPop: armyPop,
                                    sendUrl
                                });
                                scheduledCount[villageId] = (scheduledCount[villageId] || 0) + 1;
                            };

                            if (useTemplates) {
                                activeTmpls.forEach(tmpl => {
                                    processTask('template', tmpl, tmpl.name);
                                });
                            } else {
                                selectedUnits.forEach(unit => {
                                    const hpf = settings.unitSpeedEffective[unit];
                                    processTask('unit', hpf, unit);
                                });
                            }
                        });
                    });

                    console.log('%c=== TIMING RESULTS ===', 'font-size:16px;font-weight:bold;color:green');

                    // Output army compositions per village+unit
                    console.log('%c=== SPAM ARMIES ===', 'font-size:14px;font-weight:bold;color:cyan');
                    Object.entries(villageArmyCache).forEach(([key, army]) => {
                        const [vid, unit] = key.split('_');
                        const ud = unitsData[vid];
                        if (ud) {
                            console.log(`  ${vid} (${ud.coord.x}|${ud.coord.y}) → ${unit}: ${army.totalPop} жит. [${formatArmy(army.composition)}]`);
                        }
                    });

                    if (!results.length) {
                        // Calculate wait time for next possible departure
                        let minWaitSec = Infinity;
                        const nowSec = getNowSecondsSinceMidnight();
                        const activeTmpls = getActiveTemplates();
                        const useTemplates = activeTmpls.length > 0;

                        allVillageIds.forEach(villageId => {
                            const ud = unitsData[villageId];
                            if (!ud || !ud.coord || !ud.units) return;
                            targets.forEach(target => {
                                const dist = computeDistance(ud.coord, target);
                                if (!dist || dist <= 0) return;
                                if (useTemplates) {
                                    activeTmpls.forEach(tmpl => {
                                        for (const [u, cnt] of Object.entries(tmpl.units)) {
                                            if ((ud.units[u] || 0) < cnt) return;
                                        }
                                        let slowestHpf = 0;
                                        for (const u of Object.keys(tmpl.units)) {
                                            const uHpf = settings.unitSpeedEffective[u] || 0;
                                            if (uHpf > slowestHpf) slowestHpf = uHpf;
                                        }
                                        if (slowestHpf <= 0) return;
                                        let effHpf = slowestHpf;
                                        if (sigilEnabled && target.sigil && sigilPercent > 0) effHpf = slowestHpf / (1 + sigilPercent / 100);
                                        const travelSec = dist * effHpf * 60;
                                        winList.forEach(w => {
                                            const fp = cleanText(w.from).split(':').map(Number);
                                            if (fp.length < 3) return;
                                            const wFromSec = fp[0]*3600 + fp[1]*60 + fp[2];
                                            let depSec = (wFromSec - travelSec) % 86400;
                                            if (depSec < 0) depSec += 86400;
                                            let wait = (depSec - nowSec + 86400) % 86400;
                                            if (wait < minWaitSec) minWaitSec = wait;
                                        });
                                    });
                                } else {
                                    selectedUnits.forEach(unit => {
                                        let hpf = settings.unitSpeedEffective[unit];
                                        if (!Number.isFinite(hpf) || hpf <= 0) return;
                                        if (sigilEnabled && target.sigil && sigilPercent > 0) hpf = hpf / (1 + sigilPercent / 100);
                                        const travelSec = dist * hpf * 60;
                                        winList.forEach(w => {
                                            const fp = cleanText(w.from).split(':').map(Number);
                                            if (fp.length < 3) return;
                                            const wFromSec = fp[0]*3600 + fp[1]*60 + fp[2];
                                            let depSec = (wFromSec - travelSec) % 86400;
                                            if (depSec < 0) depSec += 86400;
                                            let wait = (depSec - nowSec + 86400) % 86400;
                                            if (wait < minWaitSec) minWaitSec = wait;
                                        });
                                    });
                                }
                            });
                        });

                        if (minWaitSec !== Infinity) {
                            const h = Math.floor(minWaitSec / 3600);
                            const m = Math.floor((minWaitSec % 3600) / 60);
                            console.log(`%c>>> Отправок сейчас нет. Ближайшая отправка в указанное окно примерно через ${h}ч ${m}мин`, 'font-size:14px;font-weight:bold;color:orange');
                        } else {
                            console.log('Нет совпадений. Проверь данные.');
                        }
                    } else {
                        // Deduplicate URLs: one per village+target (use slowest unit's army)
                        const seen = new Set();
                        const uniqueResults = [];
                        // Sort by speed: slower units first (they have larger hpf)
                        const sortedResults = [...results].sort((a, b) => {
                            const hpfA = Object.entries(settings.unitSpeedEffective).find(([u]) => u === a.unit)?.[1] || 0;
                            const hpfB = Object.entries(settings.unitSpeedEffective).find(([u]) => u === b.unit)?.[1] || 0;
                            return hpfB - hpfA; // slower first
                        });
                        sortedResults.forEach(r => {
                            const key = `${r.villageId}_${r.targetCoord}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                uniqueResults.push(r);
                            }
                        });

                        console.log('%c=== SEND LINKS ===', 'font-size:16px;font-weight:bold;color:magenta');
                        uniqueResults.forEach((r, idx) => {
                            const fullUrl = location.origin + location.pathname + '?' + r.sendUrl;
                            console.log(`%c${r.villageId} (${r.villageCoord}) => ${r.targetCoord}`, 'font-weight:bold');
                            console.log(`  ${fullUrl}`);
                        });

                        // Auto-navigate to the first link
                        if (uniqueResults.length > 0) {
                            const r = uniqueResults[0];
                            const currentParams = new URLSearchParams(location.search);
                            const sameVillage = currentParams.get('village') === r.villageId;
                            const sameScreen = currentParams.get('screen') === 'place';
                            const sameTargetX = currentParams.get('x') === r.targetCoord.split('|')[0];
                            const sameTargetY = currentParams.get('y') === r.targetCoord.split('|')[1];

                            if (sameVillage && sameScreen && sameTargetX && sameTargetY) {
                                console.log(`%c>>> Уже на нужной странице! Оставлено ${uniqueResults.length} отправок в очереди`, 'font-size:14px;font-weight:bold;color:green');
                            } else {
                                const fullUrl = `${location.origin}${location.pathname}?${r.sendUrl}`;
                                console.log(`%c>>> Отправлено ${uniqueResults.length} ссылок, переходим в этой вкладке: ${fullUrl}`, 'font-size:14px;font-weight:bold;color:red');
                                navigateToSendInSameTab(fullUrl);
                            }
                        } else {
                            console.log('%c>>> Нет доступных отправок', 'font-size:14px;font-weight:bold;color:orange');
                        }

                        console.log('%c=== TIMING DETAILS ===', 'font-size:16px;font-weight:bold;color:green');
                        results.forEach(r => {
                            console.log(`%c${r.villageId} (${r.villageCoord}) => ${r.targetCoord} [${r.unit}]`, 'font-weight:bold');
                            console.log(`  Армия: ${r.army} (${r.armyPop} жит.)`);
                            console.log(`  Дистанция: ${r.distance} | Полёт: ${r.travelTime}`);
                            console.log(`  Отправка: ${r.sendTime} | Прибытие: ${r.arrivalTime} | Окно: ${r.windowLabel}`);
                        });
                        console.log(`\nВсего: ${results.length} вариантов, ${uniqueResults.length} ссылок`);
                        console.table(results);
                    }
                })
                .catch(err => console.error('[timeSpam] Error:', err));
        }

        function extractGroupId(raw) {
            const value = cleanText(raw);
            if (!value) return null;
            const fromUrl = value.match(/[?&]group=(\d+)/i);
            if (fromUrl) return fromUrl[1];
            if (/^\d+$/.test(value)) return String(toInt(value));
            return null;
        }

        function dedupeGroups(groups) {
            const out = [];
            const seen = new Set();
            groups.forEach(g => {
                const id = cleanText(g?.id);
                const name = cleanText(g?.name).replace(/^\[|\]$/g, '');
                if (id === '') return;
                if (!name) return;
                if (seen.has(id)) return;
                seen.add(id);
                out.push({ id, name });
            });
            return out;
        }

        function parseGroupsFromDocument(doc) {
            if (!doc) return [];
            const groups = [];
            const pushGroup = (id, name) => {
                const gid = cleanText(id);
                const gname = cleanText(name).replace(/^\[|\]$/g, '');
                if (gid === '' || !gname) return;
                groups.push({ id: gid, name: gname });
            };

            // Desktop links
            const desktopLinks = doc.querySelectorAll('.group-menu-item, .vis_item a[href*="group="], a[href*="group="]');
            desktopLinks.forEach(a => {
                const href = a.getAttribute('href') || a.href || '';
                const groupId = extractGroupId(href);
                if (groupId != null) pushGroup(groupId, a.textContent);
            });

            // Mobile select options
            const selects = Array.from(doc.querySelectorAll('select'));
            selects.forEach(sel => {
                const marker = `${sel.getAttribute('name') || ''} ${sel.id || ''} ${sel.className || ''}`.toLowerCase();
                const options = Array.from(sel.querySelectorAll('option'));
                const hasGroupValue = options.some(opt => /[?&]group=\d+/i.test(String(opt.getAttribute('value') || '')));
                const likelyGroupSelect = marker.includes('group') || hasGroupValue;
                if (!likelyGroupSelect) return;

                options.forEach(opt => {
                    const text = cleanText(opt.textContent);
                    if (!text) return;
                    const value = opt.getAttribute('value') || '';
                    const groupId = extractGroupId(value);
                    if (groupId != null) {
                        pushGroup(groupId, text);
                        return;
                    }
                    if (/^(all|все)$/i.test(text)) {
                        pushGroup('0', text);
                    }
                });
            });

            // Mobile fallback: some templates keep group IDs as plain numeric values in an unlabeled select.
            if (groups.length === 0) {
                selects.forEach(sel => {
                    const options = Array.from(sel.querySelectorAll('option'));
                    if (options.length < 2) return;
                    options.forEach(opt => {
                        const text = cleanText(opt.textContent);
                        if (!text) return;
                        const value = opt.getAttribute('value') || '';
                        const groupId = extractGroupId(value);
                        if (groupId != null) pushGroup(groupId, text);
                    });
                });
            }

            return dedupeGroups(groups);
        }

        // Fetch groups from the server
        function fetchGroups() {
            return new Promise((resolve) => {
                const groupsUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=units&group=0&page=-1&type=complete`;
                const xhr = new XMLHttpRequest();
                xhr.open('GET', groupsUrl, true);
                xhr.onload = () => {
                    if (xhr.status !== 200) {
                        resolve([]);
                        return;
                    }
                    const doc = new DOMParser().parseFromString(xhr.responseText, 'text/html');
                    resolve(parseGroupsFromDocument(doc));
                };
                xhr.onerror = () => resolve([]);
                xhr.send();
            });
        }

        // Parse groups from the current page
        function parseGroups() {
            return parseGroupsFromDocument(document);
        }

        // Re-fetch data with selected group and re-run calculations
        function runWithGroup(groupId) {
            const groupSel = document.getElementById('ts-group');
            const selectedGroup = cleanText(groupId) || cleanText(groupSel?.value) || cleanText(getCurrentTabState().groupId) || '0';
            if (groupSel) groupSel.value = selectedGroup;
            syncRuntimeFromUI();
            const tab = getCurrentTabState();
            tab.groupId = selectedGroup;
            persistRuntimeToCurrentTab();
            saveConfig();
            loadNoblePretimeWindows();

            const targetCoords = Array.isArray(tab.coords) ? tab.coords : [];
            const winList = Array.isArray(tab.timeWindows) ? tab.timeWindows : [];
            const targetDate = normalizeDateYmd(tab.targetDateYmd, formatServerDateYmd());
            const useDateFilter = !!tab.dateFilterEnabled;

            console.log('%c=== Saved Config ===', 'font-size:14px;font-weight:bold');
            console.log('Target coords:', targetCoords);
            console.log('Time windows:', winList);
            console.log('Selected units:', selectedUnits);
            console.log('Max per village:', maxPerVillage);
            console.log('Min duration:', minDuration);
            console.log('Date filter:', useDateFilter ? `ON (${targetDate})` : 'OFF');
            console.log('Noble pretime enabled:', noblePretimeEnabled, 'entries:', noblePretimeWindows.length, 'windowMin:', noblePretimeWindowMinutes);

            console.log(`%c[templates] loaded: ${templates.length}, active: ${getActiveTemplates().length}`, 'color:cyan');

            const unitsUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=units&type=complete&group=${selectedGroup}&page=-1&type=complete`;
            const prodUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=prod&group=${selectedGroup}&page=-1&`;
            const commandsUrl = `/game.php?village=${window.game_data.village.id}&screen=overview_villages&mode=commands&type=all&group=${selectedGroup}&page=-1&&type=all`;
            const villageMapUrl = '/map/village.txt';

            Promise.all([fetchPage(unitsUrl), fetchPage(prodUrl), fetchPage(commandsUrl), fetchPage(villageMapUrl), loadWorldSettings()])
                .then(([unitsHtml, prodHtml, commandsHtml, villageMapText, settings]) => {
                    const unitsData = parseUnitsPage(unitsHtml);
                    const prodData = parseProdPage(prodHtml);
                    const existingCommands = parseCommandsPage(commandsHtml);
                    const villageIdByCoord = parseVillageMap(villageMapText);
                    console.log(`%c=== Group ${selectedGroup}: Found ${Object.keys(unitsData).length} villages ===`, 'font-size:12px;font-weight:bold;color:orange');

                    const scheduledSet = new Set();
                    const villageAttackCount = {};
                    existingCommands.forEach(cmd => {
                        scheduledSet.add(`${cmd.villageId}_${cmd.targetKey}`);
                        villageAttackCount[cmd.villageId] = (villageAttackCount[cmd.villageId] || 0) + 1;
                    });

                    const allVillageIds = new Set([...Object.keys(unitsData), ...Object.keys(prodData)]);
                    const mergedData = [];
                    allVillageIds.forEach(id => {
                        const entry = { id };
                        if (prodData[id]) entry.points = prodData[id].points;
                        if (unitsData[id]) {
                            const { coord, units } = unitsData[id];
                            if (coord) entry.coord = `${coord.x}|${coord.y}`;
                            Object.assign(entry, units);
                        }
                        mergedData.push(entry);
                    });
                    console.log('%c=== Village Data ===', 'font-size:14px;font-weight:bold');
                    console.table(mergedData);

                    console.log('%c=== World Settings ===', 'font-size:14px;font-weight:bold');
                    console.log('World Speed:  ', settings.worldSpeed);
                    console.log('Unit Speed:   ', settings.unitSpeed);
                    console.log('Speed Factor: ', settings.speedFactor);
                    console.log('%c=== Unit Speeds (minutes per field) ===', 'font-size:14px;font-weight:bold');
                    console.table(Object.entries(settings.unitSpeedEffective).map(([u, h]) => ({ unit: u, minutes: Number(h).toFixed(4) })));

                    const hasAnyWindows = noblePretimeEnabled ? noblePretimeWindows.length > 0 : winList.length > 0;
                    if (!targetCoords.length || (!selectedUnits.length && !getActiveTemplates().length) || !hasAnyWindows) {
                        console.log('%c[timeSpam] Нет целей, юнитов или окон.', 'color:orange');
                        closeNearestWindow();
                        return;
                    }

                    const nowMs = getServerTimeMs();
                    const noblePretimeMap = noblePretimeEnabled ? getNoblePretimeMap() : {};
                    const globalSigilAll = targetCoords.some(c => parseCoordSigilInfo(c).isGlobal);
                    const targets = targetCoords.map(c => {
                        const str = typeof c === 'string' ? c.trim() : '';
                        const info = parseCoordSigilInfo(str);
                        const hasSigil = globalSigilAll || info.hasSigil;
                        const cleanCoord = info.cleanCoordText;
                        const coord = parseCoord(cleanCoord);
                        if (!coord) return null;
                        const targetObj = { ...coord, sigil: hasSigil, coordKey: cleanCoord };
                        if (noblePretimeEnabled) {
                            const entry = noblePretimeMap[cleanCoord];
                            if (!entry || parseClockToSec(entry.from) == null || parseClockToSec(entry.to) == null) return null;
                            targetObj.windows = [{ from: entry.from, to: entry.to }];
                        }
                        return targetObj;
                    }).filter(Boolean);
                    if (!targets.length) { console.log('[timeSpam] Нет валидных целевых координат.'); closeNearestWindow(); return; }

                    const results = [];
                    const villageArmyCache = {};
                    const scheduledCount = {};
                    Object.entries(villageAttackCount).forEach(([vid, cnt]) => { scheduledCount[vid] = cnt; });
                    const minTravelSec = useDateFilter ? 0 : parseDurationToSec(minDuration, 0);
                    const maxTravelSec = useDateFilter ? Number.POSITIVE_INFINITY : parseDurationToSec(maxDuration, 99 * 3600 + 59 * 60 + 59);

                    allVillageIds.forEach(villageId => {
                        const ud = unitsData[villageId];
                        if (!ud || !ud.coord || !ud.units) return;
                        const pts = prodData[villageId] ? prodData[villageId].points : 0;
                        selectedUnits.forEach(unit => {
                            if ((ud.units[unit] || 0) <= 0) return;
                            const faster = getFasterUnits(unit);
                            const key = `${villageId}_${unit}`;
                            villageArmyCache[key] = computeSpamArmy(ud.units, pts, faster, unit);
                        });
                    });

                    allVillageIds.forEach(villageId => {
                        const ud = unitsData[villageId];
                        if (!ud || !ud.coord || !ud.units) return;
                        targets.forEach(target => {
                            const dist = computeDistance(ud.coord, target);
                            if (!dist || dist <= 0) return;
                            const targetKey = `${target.x}|${target.y}`;

                            const activeTmpls = getActiveTemplates();
                            const useTemplates = activeTmpls.length > 0;

                            const processTask = (taskType, taskData, taskName) => {
                                let hpf, armyComp, armyPop, armyText;
                                if (taskType === 'template') {
                                    let slowestHpf = 0;
                                    for (const u of Object.keys(taskData.units)) {
                                        const uHpf = settings.unitSpeedEffective[u] || 0;
                                        if (uHpf > slowestHpf) slowestHpf = uHpf;
                                    }
                                    if (slowestHpf <= 0) return;
                                    hpf = slowestHpf;
                                    for (const [u, cnt] of Object.entries(taskData.units)) {
                                        if ((ud.units[u] || 0) < cnt) return;
                                    }
                                    armyComp = taskData.units;
                                    armyPop = 0;
                                    for (const [u, c] of Object.entries(armyComp)) {
                                        armyPop += c * (POP_COST[u] || 1);
                                    }
                                    armyText = formatArmy(armyComp);
                                } else {
                                    hpf = taskData;
                                    if (!Number.isFinite(hpf) || hpf <= 0) return;
                                    const armyKey = `${villageId}_${taskName}`;
                                    const army = villageArmyCache[armyKey];
                                    if (!army || army.totalPop === 0) return;
                                    armyComp = army.composition;
                                    armyPop = army.totalPop;
                                    armyText = formatArmy(armyComp);
                                }
                                const currentCount = scheduledCount[villageId] || 0;
                                if (currentCount >= maxPerVillage) return;
                                let effectiveHpf = hpf;
                                if (sigilEnabled && target.sigil && sigilPercent > 0) {
                                    effectiveHpf = hpf / (1 + sigilPercent / 100);
                                }
                                const travelMs = dist * effectiveHpf * 60 * 1000;
                                const arrivalMs = nowMs + travelMs;
                                const windowsForTarget = (target.windows && target.windows.length) ? target.windows : winList;
                                const matched = findMatchingWindow(nowMs, travelMs, windowsForTarget, useDateFilter ? targetDate : '');
                                if (!matched) return;
                                const scheduleKey = `${villageId}_${targetKey}`;
                                if (scheduledSet.has(scheduleKey)) return;
                                const nowSec = getServerSecondsSinceMidnightFromMs(nowMs);
                                const travelSec = Math.floor(travelMs / 1000);
                                const arrivalSec = (nowSec + travelSec) % 86400;
                                const arrivalTimeStr = `${String(Math.floor(arrivalSec / 3600)).padStart(2,'0')}:${String(Math.floor((arrivalSec % 3600) / 60)).padStart(2,'0')}:${String(arrivalSec % 60).padStart(2,'0')}`;
                                const parts = [];
                                parts.push(`village=${villageId}`);
                                parts.push('screen=place');
                                parts.push('from=simulator');
                                parts.push(`x=${target.x}`);
                                parts.push(`y=${target.y}`);
                                Object.entries(armyComp).forEach(([u, c]) => { if (c > 0) parts.push(`att_${u}=${c}`); });
                                const targetVillageId = villageIdByCoord.get(targetKey);
                                if (targetVillageId) parts.push(`target=${targetVillageId}`);
                                const sendUrl = `${parts.join('&')}`;
                                const travelSecCheck = travelMs / 1000;
                                if (!useDateFilter && (travelSecCheck < minTravelSec || travelSecCheck > maxTravelSec)) return;
                                const arrivalLabel = useDateFilter ? `${formatServerDateYmd(arrivalMs)} ${arrivalTimeStr}` : arrivalTimeStr;
                                results.push({ villageId, villageCoord:`${ud.coord.x}|${ud.coord.y}`, targetCoord:targetKey, unit:taskName, distance:Number(dist).toFixed(2), travelTime:formatDuration(travelMs), sendTime:formatHMS(nowMs), arrivalTime:arrivalLabel, windowLabel:matched.label, army:armyText, armyPop, sendUrl });
                                scheduledCount[villageId] = (scheduledCount[villageId]||0)+1;
                            };

                            if (useTemplates) {
                                activeTmpls.forEach(tmpl => processTask('template', tmpl, tmpl.name));
                            } else {
                                selectedUnits.forEach(unit => processTask('unit', settings.unitSpeedEffective[unit], unit));
                            }
                        });
                    });

                    console.log('%c=== TIMING RESULTS ===', 'font-size:16px;font-weight:bold;color:green');
                    if (!results.length) {
                        const nearestCandidates = [];
                        const formatSecOfDay = (sec) => {
                            let s = Math.floor(sec);
                            s = ((s % 86400) + 86400) % 86400;
                            const hh = Math.floor(s / 3600);
                            const mm = Math.floor((s % 3600) / 60);
                            const ss = s % 60;
                            return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
                        };
                        const nowSecFromMs = getServerSecondsSinceMidnightFromMs(nowMs);
                        const activeTmpls = getActiveTemplates();
                        const useTemplates = activeTmpls.length > 0;

                        allVillageIds.forEach(villageId => {
                            const ud = unitsData[villageId];
                            if (!ud || !ud.coord || !ud.units) return;
                            targets.forEach(target => {
                                const dist = computeDistance(ud.coord, target);
                                if (!dist || dist <= 0) return;
                                const targetKey = `${target.x}|${target.y}`;

                                const collectFutureByTask = (taskType, taskData, taskName) => {
                                    let hpf;
                                    if (taskType === 'template') {
                                        for (const [u, cnt] of Object.entries(taskData.units)) {
                                            if ((ud.units[u] || 0) < cnt) return;
                                        }
                                        let slowestHpf = 0;
                                        for (const u of Object.keys(taskData.units)) {
                                            const uHpf = settings.unitSpeedEffective[u] || 0;
                                            if (uHpf > slowestHpf) slowestHpf = uHpf;
                                        }
                                        if (slowestHpf <= 0) return;
                                        hpf = slowestHpf;
                                    } else {
                                        hpf = settings.unitSpeedEffective[taskName];
                                        if (!Number.isFinite(hpf) || hpf <= 0) return;
                                        const armyKey = `${villageId}_${taskName}`;
                                        const army = villageArmyCache[armyKey];
                                        if (!army || army.totalPop === 0) return;
                                    }

                                    const currentCount = scheduledCount[villageId] || 0;
                                    if (currentCount >= maxPerVillage) return;

                                    const scheduleKey = `${villageId}_${targetKey}`;
                                    if (scheduledSet.has(scheduleKey)) return;

                                    let effectiveHpf = hpf;
                                    if (sigilEnabled && target.sigil && sigilPercent > 0) {
                                        effectiveHpf = hpf / (1 + sigilPercent / 100);
                                    }

                                    const travelSec = dist * effectiveHpf * 60;
                                    if (!useDateFilter && (travelSec < minTravelSec || travelSec > maxTravelSec)) return;

                                    const windowsForTarget = (target.windows && target.windows.length) ? target.windows : winList;
                                    windowsForTarget.forEach(w => {
                                        const wFromSec = parseClockToSec(w?.from);
                                        if (wFromSec == null) return;
                                        let sendAtMs = null;
                                        let waitSec = null;
                                        if (useDateFilter) {
                                            const arrivalAtMs = getEpochMsForServerDateAtSec(targetDate, wFromSec);
                                            if (!Number.isFinite(arrivalAtMs)) return;
                                            sendAtMs = arrivalAtMs - Math.round(travelSec * 1000);
                                            waitSec = (sendAtMs - nowMs) / 1000;
                                            if (waitSec < 0) return;
                                        } else {
                                            let depSec = (wFromSec - travelSec) % 86400;
                                            if (depSec < 0) depSec += 86400;
                                            waitSec = (depSec - nowSecFromMs + 86400) % 86400;
                                            sendAtMs = nowMs + Math.round(waitSec * 1000);
                                        }
                                        const fromLabel = cleanText(w?.from) || formatSecOfDay(wFromSec);
                                        const toLabel = cleanText(w?.to) || fromLabel;
                                        nearestCandidates.push({
                                            waitSec,
                                            sendAtMs,
                                            sendTime: useDateFilter ? formatServerDateTime(sendAtMs) : formatHMS(sendAtMs),
                                            villageId,
                                            villageCoord: `${ud.coord.x}|${ud.coord.y}`,
                                            targetCoord: targetKey,
                                            unit: taskName,
                                            travelTime: formatDuration(travelSec * 1000),
                                            arrivalTime: useDateFilter ? `${targetDate} ${formatSecOfDay(wFromSec)}` : formatSecOfDay(wFromSec),
                                            windowLabel: `${fromLabel}–${toLabel}`
                                        });
                                    });
                                };

                                if (useTemplates) {
                                    activeTmpls.forEach(tmpl => collectFutureByTask('template', tmpl, tmpl.name));
                                } else {
                                    selectedUnits.forEach(unit => collectFutureByTask('unit', null, unit));
                                }
                            });
                        });

                        if (nearestCandidates.length > 0) {
                            nearestCandidates.sort((a, b) => a.waitSec - b.waitSec);
                            const nearest30 = nearestCandidates.slice(0, 30);
                            showNearestWindow(nearest30);
                        } else {
                            showNearestWindow([]);
                        }
                    } else {
                        closeNearestWindow();
                        const seen = new Set();
                        const uniqueResults = [];
                        const sortedResults = [...results].sort((a, b) => {
                            const hpfA = Object.entries(settings.unitSpeedEffective).find(([u]) => u === a.unit)?.[1] || 0;
                            const hpfB = Object.entries(settings.unitSpeedEffective).find(([u]) => u === b.unit)?.[1] || 0;
                            return hpfB - hpfA;
                        });
                        sortedResults.forEach(r => {
                            const key = `${r.villageId}_${r.targetCoord}`;
                            if (!seen.has(key)) { seen.add(key); uniqueResults.push(r); }
                        });

                        uniqueResults.forEach(r => {
                            const fullUrl = location.origin + location.pathname + '?' + r.sendUrl;
                            console.log(`%c${r.villageId} (${r.villageCoord}) => ${r.targetCoord}`, 'font-weight:bold');
                            console.log(`  ${fullUrl}`);
                        });

                        if (uniqueResults.length > 0) {
                            const r = uniqueResults[0];
                            const currentParams = new URLSearchParams(location.search);
                            const sameVillage = currentParams.get('village') === r.villageId;
                            const sameScreen = currentParams.get('screen') === 'place';
                            const sameTargetX = currentParams.get('x') === r.targetCoord.split('|')[0];
                            const sameTargetY = currentParams.get('y') === r.targetCoord.split('|')[1];
                            if (sameVillage && sameScreen && sameTargetX && sameTargetY) {
                                console.log(`%c>>> Уже на нужной странице! Оставлено ${uniqueResults.length} отправок`, 'font-size:14px;font-weight:bold;color:green');
                            } else {
                                const fullUrl = `${location.origin}${location.pathname}?${r.sendUrl}`;
                                console.log(`%c>>> ${uniqueResults.length} ссылок, переходим в этой вкладке: ${fullUrl}`, 'font-size:14px;font-weight:bold;color:red');
                                navigateToSendInSameTab(fullUrl);
                            }
                        } else {
                            console.log('%c>>> Нет доступных отправок', 'font-size:14px;font-weight:bold;color:orange');
                        }

                        console.log(`\nВсего: ${results.length} вариантов, ${uniqueResults.length} ссылок`);
                        console.table(results);
                    }
                })
                .catch(err => console.error('[timeSpam] Error:', err));
        }

        function createPanel() {
            if (runConfirmEnterShortcut()) return;
            runSupportButtonCycle();
            if (document.getElementById('ts-panel')) return;
            loadConfig();
            if (isForumOrMailPage()) {
                const importPayloads = parseTsImportPayloadsFromPage();
                if (importPayloads.length > 0) {
                    showImportWindow(importPayloads);
                    return;
                }
            }
            const savedPos = loadPosition();
            const container = document.getElementById('ds_body') || document.body;
            const panel = document.createElement('div');
            panel.id = 'ts-panel';
            panel.style.position = 'absolute';
            if (savedPos) {
                panel.style.left = savedPos.left + 'px';
                panel.style.top = savedPos.top + 'px';
            } else {
                panel.style.left = '4px';
                panel.style.top = '4px';
            }
            panel.style.transform = 'none';
            panel.innerHTML = `
                <div class="ts-head">
                    <span class="ts-drag-handle">⏱ TimeSpam</span>
                    <div class="ts-head-actions">
                        <button class="ts-help-btn" id="ts-help-btn" type="button" title="Инструкция">?</button>
                        <button class="ts-close" id="ts-close-btn" type="button">✕</button>
                    </div>
                </div>
                <div class="ts-body">
                    <div id="ts-tabs" class="ts-tabs"></div>
                    <label class="ts-gas-label" style="display:none"><input type="checkbox" id="ts-gas-cb"> Грузить данные с GAS</label>
                    <label class="ts-label">Группа</label>
                    <select id="ts-group" class="ts-select"></select>
                    <hr class="ts-hr">
                    <label class="ts-label">Целевые координаты</label>
                    <textarea id="ts-coords" class="ts-coords" rows="6" placeholder="Пример: 444|555&#10;445|556"></textarea>
                    <hr class="ts-hr">
                    <div class="ts-label">Юниты</div>
                    <div id="ts-units" class="ts-units"></div>
                    <hr class="ts-hr">
                    <div class="ts-templates-block">
                        <div class="ts-templates-head"><span class="ts-label">Шаблоны</span><button class="ts-tmpl-add-btn" id="ts-tmpl-add-btn">+ Создать шаблон</button></div>
                        <div id="ts-templates-list" class="ts-templates-list"></div>
                    </div>
                    <hr class="ts-hr">
                    <div class="ts-label">Макс спама с деревни</div>
                    <input type="number" id="ts-max-per-village" class="ts-number-input" value="5" min="1" max="50">
                    <hr class="ts-hr">
                    <div id="ts-duration-block" class="ts-duration-block">
                        <div class="ts-label">Минимальная длительность</div>
                        <input type="text" id="ts-min-duration" class="ts-dur-input" placeholder="00:30:00" value="00:30:00">
                        <div class="ts-label" style="margin-top:6px">Максимальная длительность</div>
                        <input type="text" id="ts-max-duration" class="ts-dur-input" placeholder="99:59:59" value="99:59:59">
                    </div>
                    <hr class="ts-hr">
                    <div class="ts-date-block">
                        <label class="ts-date-label"><input type="checkbox" id="ts-date-cb"> Дата</label>
                        <input type="date" id="ts-target-date" class="ts-date-input" value="${formatServerDateYmd()}" disabled>
                    </div>
                    <hr class="ts-hr">
                    <div class="ts-sigil-block">
                        <label class="ts-sigil-label"><input type="checkbox" id="ts-sigil-cb"> Сигил</label>
                        <span class="ts-sigil-hint">Для одной коры: <b>!</b> (<code>444|555!</code>). Для всех кор сразу: <b>&amp;</b> или <b>*</b> в конце любой строки.</span>
                        <input type="number" id="ts-sigil-pct" class="ts-sigil-input" placeholder="%" value="0" min="0" max="50" disabled>
                    </div>
                    <hr class="ts-hr">
                    <div class="ts-noble-block">
                        <label class="ts-noble-label"><input type="checkbox" id="ts-noble-cb"> Притайм за дворами</label>
                        <div class="ts-noble-row">
                            <span>Окно (мин)</span>
                            <input type="number" id="ts-noble-minutes" class="ts-noble-min-input" value="3" min="1" max="120">
                        </div>
                        <div id="ts-noble-progress" class="ts-noble-progress">
                            <div class="ts-noble-progress-track"><div id="ts-noble-progress-fill" class="ts-noble-progress-fill"></div></div>
                            <div id="ts-noble-progress-text" class="ts-noble-progress-text"></div>
                        </div>
                    </div>
                    <hr class="ts-hr">
                    <div class="ts-label">Временные окна</div>
                    <div id="ts-windows"></div>
                    <button class="ts-add-btn" id="ts-add-btn">+ Добавить временное окно</button>
                    <hr class="ts-hr">
                    <button class="ts-save-btn" id="ts-save-btn">💾 Сохранить</button>
                    <button class="ts-export-btn" id="ts-export-btn" type="button">Экспорт</button>
                </div>`;
            container.appendChild(panel);
            makeDraggable(panel);
            $textarea = document.getElementById('ts-coords');
            applyActiveTabToUI();
            setNoblePretimeProgress(false);

            document.getElementById('ts-help-btn').onclick = () => { showHelpWindow(); };
            document.getElementById('ts-close-btn').onclick = () => {
                noblePretimeRunToken++;
                setNoblePretimeProgress(false);
                closeNearestWindow();
                closeHelpWindow();
                closeImportWindow();
                closeExportTextWindow();
                panel.remove();
            };
            document.getElementById('ts-add-btn').onclick = () => {
                windowCounter++;
                timeWindows.push({ _id: windowCounter, from: '', to: '' });
                renderTimeWindows();
                saveConfig();
            };
            document.getElementById('ts-tmpl-add-btn').onclick = () => { showTemplateModal(); };
            document.getElementById('ts-export-btn').onclick = async () => { await exportCurrentTabToClipboard(); };
            document.getElementById('ts-save-btn').onclick = () => {
                syncRuntimeFromUI();
                if (!noblePretimeEnabled) {
                    noblePretimeRunToken++;
                    clearNoblePretimeWindows();
                    setNoblePretimeProgress(false);
                }
                saveConfig();
                savePosition(panel);
                noblePretimeRunToken++;
                setNoblePretimeProgress(false);
                panel.remove();
            };
            document.getElementById('ts-windows').addEventListener('click', e => {
                if (e.target.classList.contains('ts-tw-remove')) {
                    timeWindows = timeWindows.filter(w => String(w._id) !== String(e.target.dataset.id));
                    renderTimeWindows();
                    saveConfig();
                }
            });

            // Template list event delegation
            document.getElementById('ts-templates-list').addEventListener('click', e => {
                const delBtn = e.target.closest('.ts-tmpl-del');
                const activeCb = e.target.closest('.ts-tmpl-active');
                if (!delBtn && !activeCb) return;
                const idx = toInt((delBtn || activeCb)?.dataset.idx);
                if (isNaN(idx) || !templates[idx]) return;
                if (delBtn) {
                    templates.splice(idx, 1);
                    shiftTemplateIndicesAfterDelete(idx);
                    renderTemplates();
                    renderUnitsRow();
                    saveConfig();
                } else if (activeCb) {
                    setTemplateActiveForCurrentTab(idx, !!activeCb.checked);
                    renderTemplates();
                    renderUnitsRow();
                    saveConfig();
                }
            });

            document.getElementById('ts-tabs').addEventListener('click', e => {
                const renameBtn = e.target.closest('.ts-tab-rename');
                if (renameBtn) {
                    const idx = toInt(renameBtn.dataset.tabRename);
                    renameTab(idx);
                    return;
                }
                const btn = e.target.closest('.ts-tab');
                if (!btn) return;
                const idx = toInt(btn.dataset.tabIndex);
                switchToTab(idx);
            });

            // GAS checkbox handler
            document.getElementById('ts-gas-cb').addEventListener('change', function() {
                try { localStorage.setItem(GAS_CB_KEY, JSON.stringify(this.checked)); } catch(e) {}
                if (this.checked) {
                    // Show loading state
                    const coordsEl = document.getElementById('ts-coords');
                    const gasLabel = document.querySelector('.ts-gas-label');
                    if (coordsEl) { coordsEl.value = 'Загрузка...'; coordsEl.readOnly = true; }
                    if (gasLabel) gasLabel.style.opacity = '0.5';
                    
                    fetchGasData().then(data => {
                        if (gasLabel) gasLabel.style.opacity = '1';
                        applyGasData(data.coords, data.windows);
                    }).catch(err => {
                        console.error('[TimeSpam] GAS error:', err);
                        showNotice('Ошибка загрузки данных с GAS: ' + err.message, 'error', 4200);
                        this.checked = false;
                        try { localStorage.setItem(GAS_CB_KEY, 'false'); } catch(e) {}
                        if (gasLabel) gasLabel.style.opacity = '1';
                        resetFromStorage();
                    });
                } else {
                    resetFromStorage();
                }
            });

            // Restore checkbox state
            const gasCb = document.getElementById('ts-gas-cb');
            try {
                const savedState = JSON.parse(localStorage.getItem(GAS_CB_KEY));
                if (savedState === false) gasCb.checked = false;
            } catch(e) {}

            const sigilCb = document.getElementById('ts-sigil-cb');
            const sigilPct = document.getElementById('ts-sigil-pct');
            const nobleCb = document.getElementById('ts-noble-cb');
            const nobleMins = document.getElementById('ts-noble-minutes');
            const dateCb = document.getElementById('ts-date-cb');
            const dateInput = document.getElementById('ts-target-date');

            sigilCb.addEventListener('change', function() {
                sigilEnabled = !!this.checked;
                sigilPct.disabled = !sigilEnabled;
                if (!sigilEnabled) {
                    sigilPercent = 0;
                    sigilPct.value = '0';
                }
                saveConfig();
                const gSel = document.getElementById('ts-group');
                if (gSel) runWithGroup(gSel.value || '0');
            });

            if (dateCb) {
                dateCb.addEventListener('change', function() {
                    dateFilterEnabled = !!this.checked;
                    updateDurationDateUIState();
                    if (dateFilterEnabled && dateInput) {
                        dateInput.value = normalizeDateYmd(dateInput.value, formatServerDateYmd());
                    }
                    if (dateInput) targetDateYmd = normalizeDateYmd(dateInput.value, formatServerDateYmd());
                    saveConfig();
                    const gSel = document.getElementById('ts-group');
                    if (gSel) runWithGroup(gSel.value || '0');
                });
            }

            if (dateInput) {
                dateInput.addEventListener('change', function() {
                    const normalized = normalizeDateYmd(this.value, formatServerDateYmd());
                    this.value = normalized;
                    targetDateYmd = normalized;
                    saveConfig();
                    const gSel = document.getElementById('ts-group');
                    if (gSel) runWithGroup(gSel.value || '0');
                });
            }

            if (nobleCb) {
                nobleCb.addEventListener('change', async function() {
                    noblePretimeEnabled = !!this.checked;
                    if (nobleMins) nobleMins.disabled = !noblePretimeEnabled;
                    if (!noblePretimeEnabled) {
                        noblePretimeRunToken++;
                        clearNoblePretimeWindows();
                        setNoblePretimeProgress(false);
                        saveConfig();
                        const gSel = document.getElementById('ts-group');
                        if (gSel) runWithGroup(gSel.value || '0');
                        return;
                    }

                    saveConfig();
                    const entries = await buildNoblePretimeWindowsFromTargets();
                    if (noblePretimeEnabled && entries.length === 0) {
                        setNoblePretimeProgress(true, 0, 0, 'Не найдено дворов по целевым корам');
                    }
                    const gSel = document.getElementById('ts-group');
                    if (gSel) runWithGroup(gSel.value || '0');
                });
            }
            if (nobleMins) {
                nobleMins.addEventListener('change', function() {
                    noblePretimeWindowMinutes = Math.max(1, toInt(this.value) || 3);
                    this.value = String(noblePretimeWindowMinutes);
                    if (noblePretimeEnabled) {
                        recalcNoblePretimeRangesBySavedBase();
                    }
                    saveConfig();
                    const gSel = document.getElementById('ts-group');
                    if (gSel) runWithGroup(gSel.value || '0');
                });
            }

            // Load GAS data on start if checkbox is checked
            if (gasCb && gasCb.checked) {
                const coordsEl = document.getElementById('ts-coords');
                const gasLabel = document.querySelector('.ts-gas-label');
                if (coordsEl) { coordsEl.value = 'Загрузка...'; coordsEl.readOnly = true; }
                if (gasLabel) gasLabel.style.opacity = '0.5';
                
                fetchGasData().then(data => {
                    if (gasLabel) gasLabel.style.opacity = '1';
                    applyGasData(data.coords, data.windows);
                }).catch(err => {
                    console.error('[TimeSpam] GAS error:', err);
                    if (gasLabel) gasLabel.style.opacity = '1';
                    gasCb.checked = false;
                    try { localStorage.setItem(GAS_CB_KEY, 'false'); } catch(e) {}
                    resetFromStorage();
                });
            }

            // Populate group selector (async fetch)
            const groupSelect = document.getElementById('ts-group');
            const allOpt = document.createElement('option');
            allOpt.value = '0';
            allOpt.textContent = 'Все';
            groupSelect.appendChild(allOpt);

            groupSelect.addEventListener('change', function() {
                const tab = getCurrentTabState();
                tab.groupId = String(this.value || '0');
                saveConfig();
                runWithGroup(this.value || '0');
            });

            const applyGroupsToSelect = (groupsList) => {
                while (groupSelect.options.length > 1) groupSelect.remove(1);
                groupsList.forEach(g => {
                    if (String(g.id) === '0') return;
                    const opt = document.createElement('option');
                    opt.value = String(g.id);
                    opt.textContent = String(g.name);
                    groupSelect.appendChild(opt);
                });

                const tabGroup = cleanText(getCurrentTabState().groupId) || '0';
                const currentGroup = cleanText(new URLSearchParams(location.search).get('group')) || '0';
                const initialGroup = tabGroup !== '0' ? tabGroup : currentGroup;
                const hasInitial = Array.from(groupSelect.options).some(opt => String(opt.value) === String(initialGroup));
                groupSelect.value = hasInitial ? initialGroup : '0';
                getCurrentTabState().groupId = String(groupSelect.value || '0');
                saveConfig();
                runWithGroup(groupSelect.value || '0');
            };

            fetchGroups().then(groups => {
                const fetchedGroups = Array.isArray(groups) ? groups : [];
                const localGroups = parseGroups();
                const finalGroups = fetchedGroups.length ? fetchedGroups : localGroups;
                applyGroupsToSelect(finalGroups);
            }).catch(err => {
                console.error('[timeSpam] Group fetch error:', err);
                const localGroups = parseGroups();
                applyGroupsToSelect(localGroups);
            });
        }

        injectStyles();
        createPanel();
        console.log('%c✅ TimeSpam запущен, панель создана', 'color:green;font-weight:bold');

    } catch(err) {
        console.error('[TimeSpam FATAL]', err);
    }
})();

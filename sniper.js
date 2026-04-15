(function () {
'use strict';

function parseSavedTimeMeta() {
    var raw = localStorage.getItem('saveTimeFCl');
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

var saveMeta = parseSavedTimeMeta();
if (saveMeta && Number(saveMeta.lastActiv) + 1000 * 60 * 19 < Date.now()) {
    localStorage.removeItem('saveTime1');
}

if (localStorage.getItem('typeTimer') === 'interval') {
    var routeText = $('#date_arrival').closest('tr').prev('tr').find('td:eq(1)').text();
    var routeArray = routeText.match(/\d+/g) || ['0', '0', '0'];

    var outNormDate = new Date();
    var nowRef = new Date();
    outNormDate.setHours(
        nowRef.getHours() + Number(routeArray[0]),
        nowRef.getMinutes() + Number(routeArray[1]),
        nowRef.getSeconds() + Number(routeArray[2]) + 17,
        nowRef.getMilliseconds()
    );

    var normDt = outNormDate.getFullYear() + '.' + outNormDate.getMonth() + '.' + outNormDate.getDate();
    var normTime = outNormDate.getHours() + ':' + outNormDate.getMinutes() + ':' + outNormDate.getSeconds() + ':' + outNormDate.getMilliseconds();

    var offset = localStorage.getItem('t_offset') || '-120';

    var srcHTML = '' +
        '<tr><td>Время атаки:</td><td id="backTime"></td></tr>' +
        '<tr><td>Обратный отсчет:</td><td id="dsmBT"></td></tr>' +
        '<tr id="dsmPlannedTime"><th colspan="2">Подготовка</th></tr>' +
        '<tr>' +
        '<td><input type="button" id="btnStartInterval" value="Старт" class="btn" onclick="setIntStart()" style="margin:3px"></td>' +
        '<td>' +
        '<input type="text" id="depdate" value="' + normDt + '" onchange="supDepTime()" size="9" maxlength="10" style="margin-left:18px">' +
        '<input type="text" id="deptime" value="' + normTime + '" onchange="supDepTime()" size="12" maxlength="12" style="margin-left:8px">' +
        '<a class="btn" href="#" onclick="pasteIntervalClipboard();return false;" style="margin-left:6px;">Из буфера</a>' +
        '<span id="clipStatus" style="margin-left:6px;font-size:11px;"></span>' +
        '</td>' +
        '</tr>' +
        '<tr><td>Смещение:</td><td><input type="text" id="offset" value="' + offset + '" onchange="fixTime()" size="2" maxlength="5" style="margin-left:18px"><span style="margin-left:0.25em;">миллисек.</span></td></tr>' +
        '<tr><th colspan="2">Прочее</th></tr>';

    $(srcHTML).insertAfter($('#date_arrival').closest('tr'));

    var travelText = $('#date_arrival').closest('tr').prev('tr').find('td:eq(1)').text();
    var travel = travelText.match(/\d+/g) || ['0', '0', '0'];

    var sTInt = null;
    var autoStartGuard = false;
    var autoClipboardPermissionDenied = false;
    var autoClipboardBusy = false;
    var lastAutoClipboardValue = null;

    function normalizeTimeParts(parts) {
        var hh = Number(parts[0] || 0);
        var mm = Number(parts[1] || 0);
        var ss = Number(parts[2] || 0);
        var mss = Number(parts[3] || 0);

        if (mss >= 1000) {
            ss += Math.floor(mss / 1000);
            mss = mss % 1000;
        }
        if (ss >= 60) {
            mm += Math.floor(ss / 60);
            ss = ss % 60;
        }
        if (mm >= 60) {
            hh += Math.floor(mm / 60);
            mm = mm % 60;
        }
        hh = ((hh % 24) + 24) % 24;

        return [hh, mm, ss, mss];
    }

    window.setIntStart = function () {
        if (sTInt) {
            clearInterval(sTInt);
        }
        sTInt = setInterval(window.start, 10);
    };

    window.supDepTime = function () {
        var supDate = new Date();
        var inputTime = document.getElementById('deptime');
        var inputDate = document.getElementById('depdate');

        var timeMatch = (inputTime && inputTime.value.match(/\d+/g)) || ['0', '0', '0', '0'];
        var dateMatch = (inputDate && inputDate.value.match(/\d+/g)) || [
            String(supDate.getFullYear()),
            String(supDate.getMonth()),
            String(supDate.getDate())
        ];

        dateMatch.length = 3;
        timeMatch.length = 4;

        supDate.setFullYear(Number(dateMatch[0]), Number(dateMatch[1]), Number(dateMatch[2]));

        var normalized = normalizeTimeParts(timeMatch);
        supDate.setHours(normalized[0], normalized[1], normalized[2], normalized[3]);

        return supDate;
    };

    window.fixTime = function () {
        var fixed = window.supDepTime();
        var slip = Number(document.getElementById('offset').value || 0);
        fixed.setMilliseconds(fixed.getMilliseconds() + slip);
        localStorage.setItem('t_offset', String(slip));
        return fixed;
    };

    window.tCoSt = function () {
        var timeStart = window.fixTime();
        var fixed = window.fixTime();

        timeStart.setHours(
            fixed.getHours() - Number(travel[0] || 0),
            fixed.getMinutes() - Number(travel[1] || 0),
            fixed.getSeconds() - Number(travel[2] || 0),
            fixed.getMilliseconds()
        );

        $('#backTime').html(
            timeStart.getMonth() +
            '.' +
            timeStart.getDate() +
            ' _ _ _ ' +
            timeStart.getHours() +
            ':' +
            timeStart.getMinutes() +
            ':' +
            timeStart.getSeconds() +
            '.' +
            timeStart.getMilliseconds()
        );

        var secLeft = Math.round((timeStart.getTime() - Date.now()) / 1000);
        $('#dsmBT').html('<span style="' + (secLeft < 5 ? 'color:red;font-weight:bold;' : '') + '">' + secLeft + ' сек.</span>');

        return timeStart;
    };

    window.start = function () {
        if (window.tCoSt().getTime() <= Date.now()) {
            clearInterval(sTInt);
            sTInt = null;
            $('#troop_confirm_submit').click();
        }
    };

    function runIntervalAutoStartCheck() {
        var msLeft = window.tCoSt().getTime() - Date.now();
        if (!autoStartGuard && msLeft > 0 && msLeft < 1500) {
            autoStartGuard = true;
            window.setIntStart();
        }
        if (msLeft <= 0 || msLeft > 5000) {
            autoStartGuard = false;
        }
    }

    function setClipStatus(text, color) {
        var statusEl = document.getElementById('clipStatus');
        if (!statusEl) {
            return;
        }
        statusEl.textContent = text || '';
        statusEl.style.color = color || '#2e4e1f';
    }

    function parseClipboardTime(text) {
        var m = (text || '').trim().match(/^([01]?\d|2[0-3]):([0-5]?\d):([0-5]?\d):(\d{1,3})$/);
        if (!m) {
            return null;
        }

        var hh = m[1].padStart(2, '0');
        var mm = m[2].padStart(2, '0');
        var ss = m[3].padStart(2, '0');
        var ms = m[4].padStart(3, '0');
        return hh + ':' + mm + ':' + ss + ':' + ms;
    }

    function applyParsedClipboardTime(text, showStatus) {
        var val = parseClipboardTime(text);
        if (!val) {
            if (showStatus) {
                setClipStatus('Формат не hh:mm:ss:ms', '#9a3c00');
            }
            return false;
        }

        $('#deptime').val(val);
        window.supDepTime();
        window.tCoSt();
        if (showStatus) {
            setClipStatus('Вставлено: ' + val, '#2e4e1f');
        }
        return true;
    }

    function readClipboardViaExecCommand() {
        try {
            if (typeof document.execCommand !== 'function') {
                return null;
            }
            var ta = document.createElement('textarea');
            ta.setAttribute('readonly', 'readonly');
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            ta.style.top = '-9999px';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            var ok = document.execCommand('paste');
            var value = (ta.value || '').trim();
            ta.remove();
            if (!ok && !value) {
                return null;
            }
            return value || null;
        } catch (e) {
            return null;
        }
    }

    function armManualPasteCapture() {
        setClipStatus('Нажми Ctrl+V (Cmd+V) для вставки', '#9a3c00');

        var done = false;
        function cleanup() {
            if (done) {
                return;
            }
            done = true;
            document.removeEventListener('paste', onPasteCapture, true);
        }

        function onPasteCapture(event) {
            var cd = event.clipboardData || window.clipboardData;
            if (!cd) {
                cleanup();
                return;
            }
            if (applyParsedClipboardTime(cd.getData('text'), true)) {
                event.preventDefault();
            }
            cleanup();
        }

        document.addEventListener('paste', onPasteCapture, true);
        setTimeout(cleanup, 8000);
    }

    function tryReadClipboard(showStatus, onFail) {
        if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function' || !window.isSecureContext) {
            if (showStatus) {
                setClipStatus('Буфер недоступен, вставь Ctrl+V', '#9a3c00');
            }
            if (typeof onFail === 'function') {
                onFail();
            }
            return;
        }

        function readNow() {
            navigator.clipboard.readText().then(function (text) {
                var ok = applyParsedClipboardTime(text, showStatus);
                if (!ok && typeof onFail === 'function') {
                    onFail();
                }
            }).catch(function () {
                if (showStatus) {
                    setClipStatus('Нет доступа к буферу, нажми Ctrl+V', '#9a3c00');
                }
                if (typeof onFail === 'function') {
                    onFail();
                }
            });
        }

        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            navigator.permissions.query({ name: 'clipboard-read' }).then(function (perm) {
                if (perm && perm.state === 'denied') {
                    if (showStatus) {
                        setClipStatus('Разрешение заблокировано, используй Ctrl+V', '#9a3c00');
                    }
                    if (typeof onFail === 'function') {
                        onFail();
                    }
                    return;
                }
                readNow();
            }).catch(function () {
                readNow();
            });
            return;
        }

        readNow();
    }

    function tryAutoClipboardInsert() {
        if (autoClipboardBusy || autoClipboardPermissionDenied) {
            return;
        }
        if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function' || !window.isSecureContext) {
            return;
        }

        autoClipboardBusy = true;

        function finish() {
            autoClipboardBusy = false;
        }

        function readAndApply() {
            navigator.clipboard.readText().then(function (text) {
                var normalized = parseClipboardTime(text);
                if (!normalized) {
                    finish();
                    return;
                }

                if (normalized === lastAutoClipboardValue || normalized === String($('#deptime').val() || '')) {
                    lastAutoClipboardValue = normalized;
                    finish();
                    return;
                }

                if (applyParsedClipboardTime(normalized, false)) {
                    lastAutoClipboardValue = normalized;
                    setClipStatus('Авто: ' + normalized, '#2e4e1f');
                }
                finish();
            }).catch(function () {
                finish();
            });
        }

        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            navigator.permissions.query({ name: 'clipboard-read' }).then(function (perm) {
                if (perm && perm.state === 'denied') {
                    autoClipboardPermissionDenied = true;
                    finish();
                    return;
                }
                if (perm && perm.state !== 'granted') {
                    finish();
                    return;
                }
                readAndApply();
            }).catch(function () {
                readAndApply();
            });
            return;
        }

        readAndApply();
    }

    window.pasteIntervalClipboard = function () {
        tryReadClipboard(true, function () {
            var txt = readClipboardViaExecCommand();
            if (txt && applyParsedClipboardTime(txt, true)) {
                return;
            }
            armManualPasteCapture();
        });
    };

    function setupPasteFallback() {
        var deptimeInput = document.getElementById('deptime');

        if (deptimeInput) {
            deptimeInput.addEventListener('paste', function (event) {
                var cd = event.clipboardData || window.clipboardData;
                if (!cd) {
                    return;
                }
                if (applyParsedClipboardTime(cd.getData('text'), true)) {
                    event.preventDefault();
                }
            });
        }

        document.addEventListener('paste', function (event) {
            var target = event.target;
            if (target && target.id === 'deptime') {
                return;
            }

            var cd = event.clipboardData || window.clipboardData;
            if (!cd) {
                return;
            }

            applyParsedClipboardTime(cd.getData('text'), true);
        });
    }

    setupPasteFallback();
    setInterval(tryAutoClipboardInsert, 1000);
    window.addEventListener('focus', tryAutoClipboardInsert);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            tryAutoClipboardInsert();
        }
    });
    setClipStatus('Автовставка включена; если не сработало — Ctrl+V', '#4a4a4a');
    setInterval(window.tCoSt, 400);
    setInterval(runIntervalAutoStartCheck, 1000);
} else {
    $(
        '<div id="TimeBlock">' +
            '<div id="newSnipe">' +
                '<b>&#9201;&#65039;Время: </b><input type="text" id="wtpd" size="12" autofocus>' +
                '<a class="btn" href="#" onclick="equ()"> Таймить</a><br><br>' +
                '<a class="btn" href="#" onclick="resetTime()"> Сбросить время</a>' +
                '<a class="btn" href="#" onclick="addMc()"> +50мс</a>' +
                '<a class="btn" href="#" onclick="subMc()">-50мс</a>' +
            '</div>' +
            '<div id="timer"><br>?</div>' +
            '<div id="kbc"><b>Зазор:</b> <input id="cTime" size="3" value="50"> <br><p><a href="#" class="btn" onclick="startFCancel()">Срезать отменой</a></p></div>' +
        '</div>' +
        '<style>' +
            '#timer{width:60px;background:#1bc1556b;float:left;z-index:120;height:60px;border-radius:46%;margin-left:-14px;margin-top:-9px;text-align:center;}' +
            '#TimeBlock{float:inline-start;width:90%;}' +
            '#kbc{height:70px;width:147px;float:left;background:burlywood;margin-left:-34px;padding:13px;margin-top:13px;border-radius:50px 45px 42px 42px / 100px 30px 42px 30px;text-align:end;}' +
            '#newSnipe{float:left;padding:14px 5px 2px 10px;border:4px solid #fff5daba;margin:-3px 4px 19px;border-radius:25px 25px 50px 50px / 25px 30px 113px 30px;width:250px;height:79px;}' +
        '</style>'
    ).prependTo($('#content_value')[0]);

    function getTimeArrival() {
        return $('#date_arrival')[0].innerText.match(/\d+/g);
    }

    function _getTimeArrival() {
        return $('#wtpd')[0].value.match(/\d+/g);
    }

    window.searchbyword = function (word, offset) {
        var cells = document.getElementsByTagName('td');
        var n;
        for (n = cells.length - 1; n >= 0 && cells[n].textContent !== word; n--) {}
        return document.getElementsByTagName('td')[n + offset];
    };

    function even(n) {
        return !(n % 2);
    }

    function fixTime(strDate) {
        var numDate = strDate.match(/\d+/g);
        var ho = Number(numDate[0]) < 24 ? Number(numDate[0]) : Number(numDate[0]) - 24;
        var min = Number(numDate[1]) < 60 ? Number(numDate[1]) : Number(numDate[1]) - 60;
        var sec = Number(numDate[2]) < 60 ? Number(numDate[2]) : Number(numDate[2]) - 60;

        if (Number(numDate[2] >= 60)) {
            min++;
        }
        if (Number(numDate[1] >= 60)) {
            ho++;
        }
        if (sec < 0) {
            sec += 60 - sec;
            min--;
        }
        if (min < 0) {
            min += 60 - min;
            ho--;
        }

        return ho + ':' + min + ':' + sec + (numDate[3] ? ':' + numDate[3] : '');
    }

    function counting() {
        return fixTime(
            getTimeArrival()[0] + ':' + getTimeArrival()[1] + ':' + (Number(11 + Number(getTimeArrival()[2]))) + ':' + 500
        );
    }

    var duration = window.searchbyword('Длительность:', 1).innerText.match(/\d+/g);
    var standartDate = fixTime(getTimeArrival()[0] + ':' + getTimeArrival()[1] + ':' + (Number(14 + Number(getTimeArrival()[2]))) + ':' + 500);
    var saveTime = localStorage.getItem('saveTime1') || standartDate;

    $('#wtpd').val(saveTime || standartDate);

    window.equ = function () {
        var timerId = setInterval(function () {
            if (
                Number(getTimeArrival()[0]) === Number(_getTimeArrival()[0]) &&
                Number(getTimeArrival()[1]) === Number(_getTimeArrival()[1]) &&
                Number(getTimeArrival()[2]) === Number(_getTimeArrival()[2])
            ) {
                clearInterval(timerId);
                setTimeout(function () {
                    $('#troop_confirm_submit')[0].click();
                }, Number(_getTimeArrival()[3]) - 30);
            }
        }, 30);
    };

    window.subMc = function () {
        $('#wtpd').val($('#wtpd').val().replace(/\d+$/gm, Number($('#wtpd').val().match(/\d+$/gm)[0]) - 50));
    };

    window.addMc = function () {
        $('#wtpd').val($('#wtpd').val().replace(/\d+$/gm, Number($('#wtpd').val().match(/\d+$/gm)[0]) + 50));
    };

    window.resetTime = function () {
        $('#wtpd').val(counting());
    };

    window.startFCancel = function () {
        var snobDate = new Date(null);
        var newValueDate = new Date(null);
        var startDate = new Date(null);
        var durationDate = new Date(null);
        var _cancelData = new Date(null);
        var cancelData = new Date(null);

        snobDate.setHours.apply(snobDate, $('#wtpd').val().match(/\d+/g));

        if (even(Number(_getTimeArrival()[2]) + Number(duration[2]))) {
            $('#wtpd').val(fixTime(
                getTimeArrival()[0] + ':' + getTimeArrival()[1] + ':' +
                (even(Number(getTimeArrival()[2])) ? Number(getTimeArrival()[2]) + 2 : Number(getTimeArrival()[2]) + 3) + ':' +
                (Number(_getTimeArrival()[3]) - Number($('#cTime').val()))
            ));
        } else {
            $('#wtpd').val(fixTime(
                getTimeArrival()[0] + ':' + getTimeArrival()[1] + ':' +
                (even(Number(getTimeArrival()[2])) ? Number(getTimeArrival()[2]) + 3 : Number(getTimeArrival()[2]) + 2) + ':' +
                (Number(_getTimeArrival()[3]) - Number($('#cTime').val()))
            ));
        }

        newValueDate.setHours.apply(newValueDate, $('#wtpd').val().match(/\d+/g));
        durationDate.setHours.apply(durationDate, duration);

        startDate.setMilliseconds((newValueDate - durationDate) - 3600000 * 3);
        var halfTime = (snobDate - startDate) / 2;
        _cancelData.setMilliseconds(halfTime);
        cancelData.setMilliseconds(_cancelData.getTime() + startDate.getTime() + 3600000 * 3);

        $('#attack_name').val('Отменить в ' + cancelData.toISOString().substr(11, 8));
        window.equ();
    };

    var _dft = new Date(null);
    var __dft = new Date(null);

    function dft() {
        _dft.setHours.apply(_dft, _getTimeArrival());
        __dft.setHours.apply(__dft, getTimeArrival());
        if ((_dft - __dft) / 1000 <= 2 && (_dft - __dft) / 1000 > 0) {
            clearInterval(window.autoTimer);
            window.equ();
        }
        return (_dft - __dft) / 1000;
    }

    window.autoTimer = setInterval(function () {
        $('#timer')[0].innerText = '\n' + Math.floor(dft());
    }, 500);

    window.time2sec = function (arr) {
        return arr[0] * 3600 + arr[1] * 60 + arr[2];
    };

    window.even = even;
    window.fixTime = fixTime;
    window.counting = counting;
}

$('#contentContainer').prepend(
    '<br>&#128396;&#65039;<input type="radio" name="typeTime" value="new">' +
    '<br>&#9202;&#65039;<input type="radio" name="typeTime" value="interval"><br>'
);

$('input[name=typeTime]').change(function () {
    var value = $('input[name=typeTime]:checked').val();
    localStorage.setItem('typeTimer', value);
    location.reload();
});

if (localStorage.getItem('typeTimer')) {
    $('input[name=typeTime][value="' + localStorage.getItem('typeTimer') + '"]').prop('checked', true);
}

})();

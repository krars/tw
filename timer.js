var millisReference,
	changeMillis,
	lastChange,
	timerInterval,
	startupInterval,
	windowLampInterval,
	lastArrival,
	targetWindowStartInput,
	targetWindowEndInput,
	targetVillageHref,
	targetFrameWrapper,
	targetFrameEl,
	floatingLampEl,
	autoEnterTriggeredWindowKey = '',
	lastAutoEnterDebug = 'idle',
	uiResizeBound = false,
	frameResizeBound = false,
	first = true,
	changed = false,
	worldNr = game_data.world;

var CANVAS_SIZE = 150,
	CANVAS_CENTER = 75,
	CANVAS_RADIUS = 58,
	ARC_RADIUS = 50,
	CIRCLE_OFFSET = -Math.PI / 2;

var WINDOW_LAMP_ON = '#2fc44f',
	WINDOW_LAMP_PRE = '#f0c419',
	WINDOW_LAMP_OFF = '#4d4d4d',
	TARGET_WINDOW_DEFAULT_SHIFT_MS = 15000,
	TARGET_WINDOW_DEFAULT_SPAN_MS = 100,
	TARGET_WINDOW_CENTER_HALF_SPAN_MS = 50,
	TARGET_WINDOW_CLIPBOARD_MAX_AHEAD_MS = 5 * 60 * 1000,
	DAY_MS = 24 * 60 * 60 * 1000,
	WINDOW_LAMP_PRESTART_MS = 30,
	WINDOW_LAMP_POLL_MS = 5,
	AUTO_ENTER_PLAYER_NAME = '4ikatiladaum',
	AUTO_ENTER_GRACE_MS = 1200,
	MOBILE_BREAKPOINT = 760;

if(game_data.screen != 'place'){
	alert("This script must be run from the rally point.\nRunning during command execution will add millisecond assist.\nRunning after command excecution will show you by how many milliseconds you missed the target.");
}
else if(window.location.href.split('try=').length == 2){
	addTimer();
}
else{
	if(localStorage.missMillis == undefined){}
	else{alert(localStorage.missMillis);}
}

$("#ds_body").before(`<div style="position: absolute; z-index: 50; width: `+ window.innerWidth + `px; height:`+ window.innerHeight + `px;pointer-events: none"></div>`);

function setCanvasMetrics(size){
	CANVAS_SIZE = size;
	CANVAS_CENTER = Math.round(size / 2);
	CANVAS_RADIUS = Math.round(size * 0.3867);
	ARC_RADIUS = Math.round(size * 0.3334);
}

function isCompactLayout(){
	return window.innerWidth <= MOBILE_BREAKPOINT;
}

function applyResponsiveLayout(){
	var compact = isCompactLayout(),
		targetSize = compact ? 118 : 150,
		canvas = $('#millis_canvas')[0],
		dialWrap = $('#millis_dial_wrap')[0],
		canvasWrap = $('#millis_canvas_wrap')[0],
		second = $('#second_display')[0],
		lamp = $('#window_lamp')[0],
		floatingLamp = $('#window_lamp_floating')[0],
		submitBtn = $('#troop_confirm_submit')[0],
		practiceBtn = $('#practice_button')[0],
		viewBtn = $('#view_target_button')[0];

	if(CANVAS_SIZE !== targetSize){
		setCanvasMetrics(targetSize);
	}

	if(canvas){
		canvas.width = CANVAS_SIZE;
		canvas.height = CANVAS_SIZE;
		canvas.style.width = CANVAS_SIZE + 'px';
		canvas.style.height = CANVAS_SIZE + 'px';
		drawDial(canvas.getContext('2d'));
	}
	if(dialWrap){
		dialWrap.style.width = CANVAS_SIZE + 'px';
		dialWrap.style.height = CANVAS_SIZE + 'px';
	}
	if(canvasWrap){
		canvasWrap.style.minWidth = CANVAS_SIZE + 'px';
	}

	if(second){
		second.style.left = '50%';
		second.style.top = '50%';
		second.style.transform = 'translate(-50%, -52%)';
		second.style.fontSize = compact ? '22px' : '28px';
	}

	if(lamp){
		lamp.style.width = compact ? '16px' : '18px';
		lamp.style.height = compact ? '16px' : '18px';
		lamp.style.top = compact ? '3px' : '6px';
		lamp.style.left = compact ? '3px' : '6px';
		lamp.style.right = 'auto';
		lamp.style.border = '2px solid #2a2a2a';
		lamp.style.zIndex = '30';
		lamp.style.display = 'block';
	}
	if(floatingLamp){
		floatingLamp.style.display = compact ? 'block' : 'none';
	}

	if(practiceBtn){
		practiceBtn.style.width = compact ? '64px' : '80px';
		practiceBtn.style.fontSize = compact ? '12px' : '';
		practiceBtn.style.padding = compact ? '2px 4px' : '';
	}

	if(targetWindowStartInput){
		targetWindowStartInput.style.width = compact ? '86px' : '118px';
		targetWindowStartInput.style.fontSize = compact ? '12px' : '';
	}
	if(targetWindowEndInput){
		targetWindowEndInput.style.width = compact ? '86px' : '118px';
		targetWindowEndInput.style.fontSize = compact ? '12px' : '';
	}

		if(viewBtn){
			viewBtn.style.display = 'inline-block';
		viewBtn.style.width = 'auto';
		viewBtn.style.margin = compact ? '0 0 0 12px' : '0 0 0 18px';
		viewBtn.style.whiteSpace = 'nowrap';
		viewBtn.style.fontSize = compact ? '12px' : '';
		viewBtn.style.padding = compact ? '4px 8px' : '';
		viewBtn.style.verticalAlign = 'middle';
	}
	if(submitBtn){
		submitBtn.style.whiteSpace = 'nowrap';
		submitBtn.style.margin = '0';
		submitBtn.style.fontSize = compact ? '13px' : '';
		submitBtn.style.padding = compact ? '4px 10px' : '';
		submitBtn.style.setProperty('width', 'auto', 'important');
		submitBtn.style.display = 'inline-block';
		submitBtn.style.verticalAlign = 'middle';
	}

	updateTargetFrameLayout();
}

function timer(){
	var arrival = $(".relative_time")[0].innerHTML,
		d = new Date(),
		now = d.getTime();

	updateWindowLamp();

	if(lastArrival != arrival && changed == false){
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
		changed = true;
	}
	if((now - changeMillis >= Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value)) && (changed == true)){
		changed = false;
		resetTimer(arrival, false);
		return;
	}
	if(now - 5 > lastChange){
		startCanvas(lastChange - millisReference, now - millisReference);
		lastChange = now;
	}
	else{
		return;
	}
}

function resetTimer(arrival, start){
	clearInterval(timerInterval);
	lastArrival = arrival;
	var d = new Date();
	millisReference = d.getTime();
	lastChange = d.getTime();
	first = true;
	if(start){
		startupInterval = setInterval(startupTimer, 2);
	}
	else{
		var c = document.getElementById("millis_canvas"),
			ctx = c.getContext("2d");
		ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
		drawDial(ctx);
		timerInterval = setInterval(timer, 2);
	}
}

function startupTimer(){
	var arrival = $(".relative_time")[0].innerHTML,
		d = new Date(),
		now = d.getTime();

	updateWindowLamp();

	if(lastArrival != arrival && changed == false){
		changed = true;
		$("#second_display")[0].innerHTML = arrival.split(":")[2];
		changeMillis = now;
	}
	if((now - changeMillis >= Number($("#hit_input")[0].value) + Number($("#offset_input")[0].value)) && (changed == true)){
		clearInterval(startupInterval);
		resetTimer(arrival, false);
		return;	
	}
}

function addTimer(){
	try{
		var tableBody = $('#date_arrival').parent().parent()[0],
			lastRow = tableBody.children[tableBody.children.length-1],
			cname = [worldNr+'_hitMs', worldNr+'_offsetMs'];
		tableBody.children[0].children[0].setAttribute('colspan', Number($('[colspan]', tableBody).attr('colspan')[0])+4);
		insertTargetWindowRow(tableBody);
		targetVillageHref = getTargetVillageHref(tableBody);
		addViewTargetButton();

		// Create canvas:
		var canvasTd = document.createElement('TD'),
			canvasTdStyle = document.createAttribute('style'),
			dialWrap = document.createElement('DIV'),
			dialWrapId = document.createAttribute('id'),
			dialWrapStyle = document.createAttribute('style'),
			canvasCanvas = document.createElement('CANVAS'),
			canvasRowspan = document.createAttribute('rowspan'),
			canvasColspan = document.createAttribute('colspan'),
			canvasId = document.createAttribute('id'),
			canvasWidth = document.createAttribute('width'),
			canvasHeight = document.createAttribute('height'),
			canvasStyle = document.createAttribute('style'),
			secondDisplay = document.createElement('H2'),
			secondStyle = document.createAttribute('style'),
			secondId = document.createAttribute('id'),
			windowLamp = document.createElement('DIV'),
			windowLampId = document.createAttribute('id'),
			windowLampStyle = document.createAttribute('style'),
			windowLampTitle = document.createAttribute('title');
		canvasRowspan.value = tableBody.children.length-2;
		canvasColspan.value = 4;
		canvasTd.id = 'millis_canvas_wrap';
		dialWrapId.value = 'millis_dial_wrap';
		dialWrapStyle.value = 'position:relative;width:'+CANVAS_SIZE+'px;height:'+CANVAS_SIZE+'px;margin:0 auto;';
		canvasId.value = 'millis_canvas';
		canvasWidth.value = String(CANVAS_SIZE);
		canvasHeight.value = String(CANVAS_SIZE);
		canvasStyle.value = 'height:'+CANVAS_SIZE+'px;width:'+CANVAS_SIZE+'px;display:block';
		canvasTdStyle.value = 'position:relative;overflow:visible;min-width:'+CANVAS_SIZE+'px;';
		canvasTd.setAttributeNode(canvasRowspan);
		canvasTd.setAttributeNode(canvasColspan);
		canvasTd.setAttributeNode(canvasTdStyle);
		dialWrap.setAttributeNode(dialWrapId);
		dialWrap.setAttributeNode(dialWrapStyle);
		canvasCanvas.setAttributeNode(canvasId);
		canvasCanvas.setAttributeNode(canvasWidth);
		canvasCanvas.setAttributeNode(canvasHeight);
		canvasCanvas.setAttributeNode(canvasStyle);
		secondStyle.value = 'position:absolute;left:50%;top:50%;transform:translate(-50%, -52%);margin:0;font-size:28px;line-height:1;';
		secondId.value = 'second_display';
		secondDisplay.setAttributeNode(secondId);
		secondDisplay.setAttributeNode(secondStyle);
		windowLampId.value = 'window_lamp';
		windowLampStyle.value = 'position:absolute;top:6px;left:6px;width:18px;height:18px;border:2px solid #2a2a2a;border-radius:50%;background:'+WINDOW_LAMP_OFF+';box-shadow:0 0 3px rgba(0,0,0,0.9);z-index:30;display:block;';
		windowLampTitle.value = 'Индикатор целевого окна';
		windowLamp.setAttributeNode(windowLampId);
		windowLamp.setAttributeNode(windowLampStyle);
		windowLamp.setAttributeNode(windowLampTitle);
		dialWrap.appendChild(canvasCanvas);
		dialWrap.appendChild(secondDisplay);
		dialWrap.appendChild(windowLamp);
		canvasTd.appendChild(dialWrap);

		// Create practice button:
		var pbTd = document.createElement('TD'),
			pbTdStyle = document.createAttribute('style'),
			pbButton = document.createElement('BUTTON'),
			pbType = document.createAttribute('type'),
			pbValue = document.createAttribute('value'),
			pbOnclick = document.createAttribute('onclick'),
			pbId = document.createAttribute('id'),
			pbClass = document.createAttribute('class'),
			pbStyle = document.createAttribute('style');
		pbTdStyle.value = 'width:60px';
		pbTd.setAttributeNode(pbTdStyle);
		pbType.value = 'button';
		pbValue.value = 'Try';
		pbOnclick.value = 'practiceFunction()';
		pbId.value = 'practice_button';
		pbClass.value = 'btn btn-recruit';
		pbStyle.value = 'width:80px;';
		pbButton.setAttributeNode(pbType);
		pbButton.setAttributeNode(pbValue);
		pbButton.setAttributeNode(pbId);
		pbButton.setAttributeNode(pbOnclick);
		pbButton.setAttributeNode(pbClass);
		pbButton.setAttributeNode(pbStyle);
		pbButton.innerHTML = 'Try';
		pbTd.appendChild(pbButton);

		// Create hittime input
		var hitTd = document.createElement('TD'),
			hitText = document.createElement('SPAN'),
			hitInput = document.createElement('INPUT'),
			hitType = document.createAttribute('type'),
			hitInputStyle = document.createAttribute('style'),
			hitStyle = document.createAttribute('style'),
			hitTitle = document.createAttribute('title'),
			hitValue = document.createAttribute('value'),
			hitOnchange = document.createAttribute('onchange'),
			hitId = document.createAttribute('id');
		hitType.value = 'text';
		hitId.value = 'hit_input';
		hitTitle.value = 'Millisecond to hit';
		hitOnchange.value = 'setCookies()';
		var hitDefault = getCookie(cname[0]);
		if(hitDefault == ""){hitDefault = 0;}
		hitValue.value = hitDefault;
		hitInput.setAttributeNode(hitType);
		hitInput.setAttributeNode(hitId);
		hitInput.setAttributeNode(hitTitle);
		hitInput.setAttributeNode(hitValue);
		hitInput.setAttributeNode(hitOnchange);
		hitInputStyle.value = 'width:30px';
		hitStyle.value = 'width:106px';
		hitInput.setAttributeNode(hitInputStyle);
		hitTd.setAttributeNode(hitStyle);
		hitText.innerHTML = 'Hit(ms):';
		hitTd.appendChild(hitText);
		hitTd.appendChild(hitInput);

		// Create offset input
		var offsetTd = document.createElement('TD'),
			offsetText = document.createElement('SPAN'),
			offsetInput = document.createElement('INPUT'),
			offsetType = document.createAttribute('type'),
			offsetInputStyle = document.createAttribute('style'),
			offsetStyle = document.createAttribute('style'),
			offsetTitle = document.createAttribute('title'),
			offsetValue = document.createAttribute('value'),
			offsetOnchange = document.createAttribute('onchange'),
			offsetId = document.createAttribute('id');
		offsetType.value = 'text';
		offsetId.value = 'offset_input';
		offsetTitle.value = 'Remove lag and synchronize local time with TW-time';
		offsetOnchange.value = 'setCookies()';
		var offsetDefault = getCookie(cname[1]);
		if(offsetDefault == ""){offsetDefault = 0;}
		offsetValue.value = offsetDefault;
		offsetInput.setAttributeNode(offsetType);
		offsetInput.setAttributeNode(offsetId);
		offsetInput.setAttributeNode(offsetTitle);
		offsetInput.setAttributeNode(offsetValue);
		offsetInput.setAttributeNode(offsetOnchange);
		offsetInputStyle.value = 'width:30px';
		offsetStyle.value = 'width:106px';
		offsetInput.setAttributeNode(offsetInputStyle);
		offsetTd.setAttributeNode(offsetStyle);
		offsetText.innerHTML = 'Offset:';
		offsetTd.appendChild(offsetText);
		offsetTd.appendChild(offsetInput);

		// Create misstime display:
		var missTd = document.createElement('TD'),
			missSpan = document.createElement('SPAN'),
			missStyle = document.createAttribute('style'),
			missId = document.createAttribute('id');
		missId.value = 'miss_display';
		missStyle.value = 'width:35px';
		missSpan.setAttributeNode(missId);
		missTd.setAttributeNode(missStyle);
		missSpan.innerHTML = '0';
		missTd.appendChild(missSpan);

		$('.village_anchor').parent().parent()[0].appendChild(canvasTd);
		lastRow.appendChild(pbTd);
		lastRow.appendChild(hitTd);
		lastRow.appendChild(offsetTd);
		lastRow.appendChild(missTd);
		$('#ds_body')[0].setAttribute('onsubmit', 'practiceFunction()');
		ensureFloatingLamp();
		applyResponsiveLayout();
		if(!uiResizeBound){
			window.addEventListener('resize', applyResponsiveLayout);
			uiResizeBound = true;
		}
		if(windowLampInterval){
			clearInterval(windowLampInterval);
		}
		windowLampInterval = setInterval(updateWindowLamp, WINDOW_LAMP_POLL_MS);
		updateWindowLamp();
		resetTimer($(".relative_time")[0].innerHTML, true);
	}
	catch(err){
		console.log('Cound not find table...\n'+err);
	}
}

function practiceFunction(){
	var d = new Date(),
		now = d.getTime(),
		missMillis,
		buttonText = ['Try', 'Reset'],
		buttonDOM = $('#practice_button')[0];

	if(buttonDOM.innerHTML == buttonText[0]){
		clearInterval(timerInterval);
		buttonDOM.innerHTML = buttonText[1];
		if(now - millisReference > 500){
			missMillis = '-'+String(1000 - (now - millisReference));
		}
		else{
			missMillis = '+'+String(now - millisReference);
		}
		localStorage.missMillis = missMillis;
		$("#miss_display")[0].innerHTML = missMillis;
	}
	else{
		buttonDOM.innerHTML = buttonText[0];
		resetTimer($(".relative_time")[0].innerHTML, true);
	}
}

function drawDial(ctx){
	var i,
		ms,
		angle,
		cosA,
		sinA,
		isMajor,
		inner,
		outer,
		label;

	ctx.save();
	ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

	ctx.beginPath();
	ctx.arc(CANVAS_CENTER, CANVAS_CENTER, CANVAS_RADIUS, 0, Math.PI * 2);
	ctx.strokeStyle = '#8a8a8a';
	ctx.lineWidth = 1;
	ctx.stroke();

	for(i = 0; i < 100; i++){
		ms = i * 10;
		angle = CIRCLE_OFFSET + (ms / 1000) * Math.PI * 2;
		cosA = Math.cos(angle);
		sinA = Math.sin(angle);
		isMajor = (ms % 50 === 0);
		inner = isMajor ? CANVAS_RADIUS - 9 : CANVAS_RADIUS - 5;
		outer = CANVAS_RADIUS;

		ctx.beginPath();
		ctx.moveTo(CANVAS_CENTER + inner * cosA, CANVAS_CENTER + inner * sinA);
		ctx.lineTo(CANVAS_CENTER + outer * cosA, CANVAS_CENTER + outer * sinA);
		ctx.strokeStyle = isMajor ? '#303030' : '#7e7e7e';
		ctx.lineWidth = isMajor ? 1.3 : 0.8;
		ctx.stroke();
	}

	ctx.fillStyle = '#303030';
	ctx.font = '10px Arial';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for(label = 0; label < 1000; label += 100){
		angle = CIRCLE_OFFSET + (label / 1000) * Math.PI * 2;
		ctx.fillText(String(label), CANVAS_CENTER + (CANVAS_RADIUS - 16) * Math.cos(angle), CANVAS_CENTER + (CANVAS_RADIUS - 16) * Math.sin(angle));
	}

	ctx.restore();
}

function findInfoRow(tableBody, labelRegex){
	var i,
		row,
		labelCell,
		label;

	for(i = 0; i < tableBody.children.length; i++){
		row = tableBody.children[i];
		if(!row || !row.children || row.children.length < 2){
			continue;
		}
		labelCell = row.children[0];
		label = labelCell.textContent.replace(/\s+/g, ' ').trim();
		if(labelRegex.test(label)){
			return row;
		}
	}
	return null;
}

function getCurrentReferenceTimeMs(){
	var timingApi,
		methods,
		i,
		serverNow;
	try{
		if(typeof Timing !== 'undefined' && Timing){
			timingApi = Timing;
			methods = ['getCorrectedServerTime', 'getCurrentServerTime', 'getServerTime'];
			for(i = 0; i < methods.length; i++){
				if(typeof timingApi[methods[i]] !== 'function'){
					continue;
				}
				serverNow = Number(timingApi[methods[i]]());
				if(!isNaN(serverNow) && isFinite(serverNow) && serverNow > 0){
					return serverNow;
				}
			}
		}
	}
	catch(e){}
	return Date.now();
}

function parseDurationToMs(text){
	var parts = String(text || '').match(/\d+/g),
		nums;
	if(!parts || !parts.length){
		return NaN;
	}
	nums = parts.map(function(v){ return Number(v); });
	if(nums.length === 3){
		return ((nums[0] * 60 + nums[1]) * 60 + nums[2]) * 1000;
	}
	if(nums.length === 4){
		return ((((nums[0] * 24 + nums[1]) * 60 + nums[2]) * 60) + nums[3]) * 1000;
	}
	if(nums.length === 2){
		return (nums[0] * 60 + nums[1]) * 1000;
	}
	return NaN;
}

function pad2(n){
	return String(n).padStart(2, '0');
}

function pad3(n){
	return String(n).padStart(3, '0');
}

function normalizeMsOfDay(value){
	var normalized = Number(value) % DAY_MS;
	if(normalized < 0){
		normalized += DAY_MS;
	}
	return normalized;
}

function formatTargetWindowTime(msOfDay){
	var normalized = normalizeMsOfDay(Math.round(msOfDay)),
		hours = Math.floor(normalized / 3600000),
		minutes,
		seconds,
		millis;

	normalized -= hours * 3600000;
	minutes = Math.floor(normalized / 60000);
	normalized -= minutes * 60000;
	seconds = Math.floor(normalized / 1000);
	millis = normalized - seconds * 1000;

	return pad2(hours) + ':' + pad2(minutes) + ':' + pad2(seconds) + ':' + pad3(millis);
}

function getCurrentServerClockMsOfDay(){
	var serverTimeEl = document.getElementById('serverTime'),
		match = serverTimeEl ? String(serverTimeEl.textContent || '').match(/(\d{1,2}):(\d{1,2}):(\d{1,2})/) : null,
		serverNowMs = Number(getCurrentReferenceTimeMs()),
		millis,
		d;

	if(!isFinite(serverNowMs)){
		serverNowMs = Date.now();
	}
	serverNowMs = Math.floor(serverNowMs);
	millis = normalizeMsOfDay(serverNowMs) % 1000;
	if(!isFinite(millis)){
		millis = 0;
	}

	if(match){
		return normalizeMsOfDay(
			Number(match[1]) * 3600000 +
			Number(match[2]) * 60000 +
			Number(match[3]) * 1000 +
			millis
		);
	}

	d = new Date(serverNowMs);
	return normalizeMsOfDay(
		d.getHours() * 3600000 +
		d.getMinutes() * 60000 +
		d.getSeconds() * 1000 +
		d.getMilliseconds()
	);
}

function parseTimeOfDayInput(rawValue){
	var value = String(rawValue || '').trim(),
		match,
		hours,
		minutes,
		seconds,
		millis;

	if(!value){
		return NaN;
	}

	match = value.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:[:.](\d{1,3}))?$/);
	if(!match){
		match = value.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:[:.](\d{1,3}))?$/);
	}
	if(!match){
		return NaN;
	}

	hours = Number(match[1]);
	minutes = Number(match[2]);
	seconds = Number(match[3] || 0);
	millis = Number(match[4] || 0);

	if(
		hours < 0 || hours > 23 ||
		minutes < 0 || minutes > 59 ||
		seconds < 0 || seconds > 59 ||
		millis < 0 || millis > 999
	){
		return NaN;
	}

	return hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;
}

function getCommandDurationMs(){
	var rel = $('#date_arrival .relative_time')[0] || $('.relative_time')[0],
		durationAttr = rel ? Number(rel.getAttribute('data-duration')) : NaN,
		tableBody = $('#date_arrival').closest('tbody')[0],
		durationRow,
		durationText,
		durationMs;

	if(!isNaN(durationAttr) && isFinite(durationAttr) && durationAttr >= 0){
		return Math.round(durationAttr * 1000);
	}

	if(tableBody){
		durationRow = findInfoRow(tableBody, /длительн|duration/i);
		durationText = durationRow && durationRow.children && durationRow.children[1] ? durationRow.children[1].textContent : '';
		durationMs = parseDurationToMs(durationText);
		if(!isNaN(durationMs) && isFinite(durationMs) && durationMs >= 0){
			return durationMs;
		}
	}

	return 0;
}

function getPredictedArrivalMsOfDay(){
	return normalizeMsOfDay(Math.floor(getCurrentReferenceTimeMs() + getCommandDurationMs()));
}

function isTimeInWindow(nowMsOfDay, startMsOfDay, endMsOfDay){
	if(isNaN(nowMsOfDay) || isNaN(startMsOfDay) || isNaN(endMsOfDay)){
		return false;
	}
	if(startMsOfDay <= endMsOfDay){
		return nowMsOfDay >= startMsOfDay && nowMsOfDay <= endMsOfDay;
	}
	return nowMsOfDay >= startMsOfDay || nowMsOfDay <= endMsOfDay;
}

function isTimeInPreWindow(nowMsOfDay, startMsOfDay){
	var preStartMsOfDay;
	if(isNaN(nowMsOfDay) || isNaN(startMsOfDay)){
		return false;
	}
	preStartMsOfDay = normalizeMsOfDay(startMsOfDay - WINDOW_LAMP_PRESTART_MS);
	if(preStartMsOfDay <= startMsOfDay){
		return nowMsOfDay >= preStartMsOfDay && nowMsOfDay < startMsOfDay;
	}
	return nowMsOfDay >= preStartMsOfDay || nowMsOfDay < startMsOfDay;
}

function triggerEnterPress(){
	var submitBtn = $('#troop_confirm_submit')[0],
		formEl = submitBtn && submitBtn.form ? submitBtn.form : $('#command-data-form')[0],
		target = document.activeElement && document.activeElement !== document.body ? document.activeElement : submitBtn,
		events = ['keydown', 'keypress', 'keyup'],
		i,
		eventObj,
		submitted = false;

	if(!target){
		target = document.body;
	}
	try{
		if(submitBtn && typeof submitBtn.focus === 'function'){
			submitBtn.focus();
			target = submitBtn;
		}
	}
	catch(e){}

	for(i = 0; i < events.length; i++){
		eventObj = new KeyboardEvent(events[i], {
			key: 'Enter',
			code: 'Enter',
			keyCode: 13,
			which: 13,
			bubbles: true,
			cancelable: true
		});
		try{ target.dispatchEvent(eventObj); } catch(e){}
		try{ document.dispatchEvent(eventObj); } catch(e){}
	}

	// Prefer real form submission path.
	try{
		if(formEl && typeof formEl.requestSubmit === 'function' && submitBtn && !submitBtn.disabled){
			formEl.requestSubmit(submitBtn);
			submitted = true;
		}
	}
	catch(e){}

	// Fallback: synthetic keyboard events can be ignored by browsers as untrusted.
	try{
		if(!submitted && submitBtn && !submitBtn.disabled){
			submitBtn.click();
			submitted = true;
		}
	}
	catch(e){}

	try{
		if(!submitted && formEl && typeof formEl.submit === 'function'){
			formEl.submit();
			submitted = true;
		}
	}
	catch(e){}

	return submitted;
}

function maybeAutoEnterAtHalfWindow(startMsOfDay, endMsOfDay, etaMsOfDay){
	var playerName = game_data && game_data.player ? String(game_data.player.name || '').trim().toLowerCase() : '',
		windowKey,
		windowSpanMs,
		elapsedFromStartMs,
		passedHalf;

	if(playerName !== String(AUTO_ENTER_PLAYER_NAME).trim().toLowerCase()){
		lastAutoEnterDebug = 'player-mismatch:' + playerName;
		return;
	}
	if(isNaN(startMsOfDay) || isNaN(endMsOfDay) || isNaN(etaMsOfDay)){
		lastAutoEnterDebug = 'invalid-window';
		return;
	}

	windowKey = String(startMsOfDay) + '|' + String(endMsOfDay);
	if(autoEnterTriggeredWindowKey && autoEnterTriggeredWindowKey !== windowKey){
		autoEnterTriggeredWindowKey = '';
	}
	if(autoEnterTriggeredWindowKey === windowKey){
		lastAutoEnterDebug = 'already-fired';
		return;
	}

	windowSpanMs = normalizeMsOfDay(endMsOfDay - startMsOfDay);
	if(windowSpanMs <= 0){
		lastAutoEnterDebug = 'bad-span';
		return;
	}

	elapsedFromStartMs = normalizeMsOfDay(etaMsOfDay - startMsOfDay);
	passedHalf = elapsedFromStartMs >= Math.floor(windowSpanMs / 2) && elapsedFromStartMs <= (windowSpanMs + AUTO_ENTER_GRACE_MS);
	if(!passedHalf){
		lastAutoEnterDebug = 'wait-half:' + elapsedFromStartMs + '/' + windowSpanMs;
		return;
	}

	if(triggerEnterPress()){
		lastAutoEnterDebug = 'fired';
		autoEnterTriggeredWindowKey = windowKey;
	}
	else{
		lastAutoEnterDebug = 'submit-failed';
		console.log('[timer.js] auto-enter trigger attempted but submit did not confirm');
	}
}

function buildDefaultWindowValues(tableBody){
	var predictedArrivalMsOfDay = getPredictedArrivalMsOfDay(),
		startMsOfDay,
		endMsOfDay;

	startMsOfDay = normalizeMsOfDay(predictedArrivalMsOfDay + TARGET_WINDOW_DEFAULT_SHIFT_MS);
	endMsOfDay = normalizeMsOfDay(startMsOfDay + TARGET_WINDOW_DEFAULT_SPAN_MS);

	return {
		start: formatTargetWindowTime(startMsOfDay),
		end: formatTargetWindowTime(endMsOfDay),
		startMsOfDay: startMsOfDay,
		endMsOfDay: endMsOfDay
	};
}

function parseClipboardCenterTime(rawValue){
	var match = String(rawValue || '').trim().match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,3})$/),
		hours,
		minutes,
		seconds,
		millis,
		msOfDay;

	if(!match){
		return null;
	}

	hours = Number(match[1]);
	minutes = Number(match[2]);
	seconds = Number(match[3]);
	millis = Number(match[4]);

	if(
		hours < 0 || hours > 23 ||
		minutes < 0 || minutes > 59 ||
		seconds < 0 || seconds > 59 ||
		millis < 0 || millis > 999
	){
		return null;
	}

	msOfDay = hours * 3600000 + minutes * 60000 + seconds * 1000 + millis;

	return {
		hours: hours,
		minutes: minutes,
		seconds: seconds,
		millis: millis,
		msOfDay: msOfDay
	};
}

function buildWindowValuesFromCenterMs(centerMsOfDay){
	var startMsOfDay = normalizeMsOfDay(centerMsOfDay - TARGET_WINDOW_CENTER_HALF_SPAN_MS),
		endMsOfDay = normalizeMsOfDay(centerMsOfDay + TARGET_WINDOW_CENTER_HALF_SPAN_MS);
	return {
		startMsOfDay: startMsOfDay,
		endMsOfDay: endMsOfDay,
		start: formatTargetWindowTime(startMsOfDay),
		end: formatTargetWindowTime(endMsOfDay)
	};
}

function tryApplyClipboardCenterWindow(startInput, endInput){
	function runRead(){
		navigator.clipboard.readText().then(function(clipboardText){
			var parsed = parseClipboardCenterTime(clipboardText),
				nowMsOfDay,
				deltaForwardMs,
				windowValues;

			if(!parsed){
				return;
			}

			nowMsOfDay = getCurrentServerClockMsOfDay();
			deltaForwardMs = normalizeMsOfDay(parsed.msOfDay - nowMsOfDay);
			if(deltaForwardMs > TARGET_WINDOW_CLIPBOARD_MAX_AHEAD_MS){
				return;
			}

			windowValues = buildWindowValuesFromCenterMs(parsed.msOfDay);
			startInput.value = windowValues.start;
			endInput.value = windowValues.end;
			updateWindowLamp();
		}).catch(function(){});
	}

	if(!startInput || !endInput){
		return;
	}
	if(!navigator.clipboard || typeof navigator.clipboard.readText !== 'function'){
		return;
	}

	if(navigator.permissions && typeof navigator.permissions.query === 'function'){
		navigator.permissions.query({name: 'clipboard-read'}).then(function(status){
			if(status && status.state === 'denied'){
				return;
			}
			runRead();
		}).catch(function(){
			runRead();
		});
		return;
	}

	runRead();
}

function insertTargetWindowRow(tableBody){
	var defaultValues;
	if($('#target_window_row').length){
		targetWindowStartInput = $('#target_window_start')[0];
		targetWindowEndInput = $('#target_window_end')[0];
		defaultValues = buildDefaultWindowValues(tableBody);
		if(targetWindowStartInput){
			targetWindowStartInput.value = defaultValues.start;
		}
		if(targetWindowEndInput){
			targetWindowEndInput.value = defaultValues.end;
		}
		tryApplyClipboardCenterWindow(targetWindowStartInput, targetWindowEndInput);
		applyResponsiveLayout();
		return;
	}

	var arrivalRow = $('#date_arrival').closest('tr')[0],
		durationRow = findInfoRow(tableBody, /длительн|duration/i),
		windowRow = document.createElement('TR'),
		labelTd = document.createElement('TD'),
		valueTd = document.createElement('TD'),
		startInput = document.createElement('INPUT'),
		endInput = document.createElement('INPUT'),
		separator = document.createElement('SPAN'),
		defaultValues = buildDefaultWindowValues(tableBody);

	windowRow.id = 'target_window_row';
	labelTd.innerHTML = 'Целевое время:';

	startInput.type = 'text';
	startInput.id = 'target_window_start';
	startInput.style.width = '118px';
	startInput.title = 'Формат: чч:мм:сс:мс';
	startInput.value = defaultValues.start;

	separator.innerHTML = ' — ';
	separator.style.margin = '0 4px';

	endInput.type = 'text';
	endInput.id = 'target_window_end';
	endInput.style.width = '118px';
	endInput.title = 'Формат: чч:мм:сс:мс';
	endInput.value = defaultValues.end;

	startInput.addEventListener('change', saveTargetWindowInputs);
	endInput.addEventListener('change', saveTargetWindowInputs);

	valueTd.appendChild(startInput);
	valueTd.appendChild(separator);
	valueTd.appendChild(endInput);
	windowRow.appendChild(labelTd);
	windowRow.appendChild(valueTd);

	if(arrivalRow && arrivalRow.parentNode === tableBody){
		tableBody.insertBefore(windowRow, arrivalRow);
	}
	else if(durationRow && durationRow.nextSibling){
		tableBody.insertBefore(windowRow, durationRow.nextSibling);
	}
	else{
		tableBody.appendChild(windowRow);
	}

	targetWindowStartInput = startInput;
	targetWindowEndInput = endInput;
	tryApplyClipboardCenterWindow(targetWindowStartInput, targetWindowEndInput);
	applyResponsiveLayout();
}

function saveTargetWindowInputs(){
	autoEnterTriggeredWindowKey = '';
	updateWindowLamp();
}

function parseTargetWindowValue(rawValue){
	return parseTimeOfDayInput(rawValue);
}

function updateWindowLamp(){
	var lamp = $('#window_lamp')[0],
		floatingLamp = $('#window_lamp_floating')[0],
		nowMsOfDay = getCurrentServerClockMsOfDay(),
		predictedArrivalMsOfDay = getPredictedArrivalMsOfDay(),
		startMsOfDay = parseTargetWindowValue(targetWindowStartInput ? targetWindowStartInput.value : ''),
		endMsOfDay = parseTargetWindowValue(targetWindowEndInput ? targetWindowEndInput.value : ''),
		isWindowValid,
		isPredictedInWindow,
		isActive,
		isPreActive,
		lamps = [],
		i,
		debugTitle;

	if(lamp){
		lamps.push(lamp);
	}
	if(floatingLamp){
		lamps.push(floatingLamp);
	}
	if(!lamps.length){
		return;
	}

	isWindowValid = !isNaN(startMsOfDay) && !isNaN(endMsOfDay);
	isPredictedInWindow = isWindowValid && isTimeInWindow(predictedArrivalMsOfDay, startMsOfDay, endMsOfDay);
	isActive = isPredictedInWindow;
	isPreActive = !isActive && isWindowValid && isTimeInPreWindow(predictedArrivalMsOfDay, startMsOfDay);
	if(isWindowValid){
		maybeAutoEnterAtHalfWindow(startMsOfDay, endMsOfDay, predictedArrivalMsOfDay);
	}
	debugTitle = 'now:' + formatTargetWindowTime(nowMsOfDay) +
		' | eta:' + formatTargetWindowTime(predictedArrivalMsOfDay) +
		' | start:' + (isNaN(startMsOfDay) ? 'NaN' : formatTargetWindowTime(startMsOfDay)) +
		' | end:' + (isNaN(endMsOfDay) ? 'NaN' : formatTargetWindowTime(endMsOfDay)) +
		' | inEta:' + (isPredictedInWindow ? '1' : '0') +
		' | auto:' + lastAutoEnterDebug +
		' | state:' + (isActive ? 'green' : (isPreActive ? 'yellow' : 'off'));
	for(i = 0; i < lamps.length; i++){
		lamps[i].title = debugTitle;
		if(isActive){
			lamps[i].style.background = WINDOW_LAMP_ON;
			lamps[i].style.boxShadow = '0 0 8px '+WINDOW_LAMP_ON+', 0 0 2px rgba(0,0,0,0.8)';
		}
		else if(isPreActive){
			lamps[i].style.background = WINDOW_LAMP_PRE;
			lamps[i].style.boxShadow = '0 0 8px '+WINDOW_LAMP_PRE+', 0 0 2px rgba(0,0,0,0.8)';
		}
		else{
			lamps[i].style.background = WINDOW_LAMP_OFF;
			lamps[i].style.boxShadow = '0 0 2px rgba(0,0,0,0.8)';
		}
	}
}

function toAbsoluteUrl(href){
	if(!href){
		return '';
	}
	if(/^https?:\/\//i.test(href)){
		return href;
	}
	if(href.charAt(0) === '/'){
		return window.location.origin + href;
	}
	return window.location.origin + '/' + href;
}

function getTargetVillageHref(tableBody){
	if(!tableBody || !tableBody.children){
		return '';
	}
	var destinationRow = findInfoRow(tableBody, /пункт назначения|target/i),
		link = destinationRow ? destinationRow.querySelector('a[href]') : null;

	if(!link){
		link = $('#command-data-form .village_anchor a[href]').first()[0];
	}
	if(!link){
		return '';
	}
	return toAbsoluteUrl(link.getAttribute('href'));
}

function updateTargetFrameLayout(){
	var viewportWidth,
		viewportHeight,
		compact,
		desktopHeight,
		compactHeight;

	if(!targetFrameWrapper){
		return;
	}

	viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
	viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
	compact = viewportWidth <= MOBILE_BREAKPOINT;

	if(compact){
		compactHeight = Math.floor(viewportHeight * 0.82);
		if(compactHeight > viewportHeight - 16){
			compactHeight = viewportHeight - 16;
		}
		if(compactHeight < 120){
			compactHeight = 120;
		}
		targetFrameWrapper.style.top = '8px';
		targetFrameWrapper.style.left = '6px';
		targetFrameWrapper.style.right = '6px';
		targetFrameWrapper.style.width = 'auto';
		targetFrameWrapper.style.height = compactHeight + 'px';
	}
	else{
		desktopHeight = Math.max(320, Math.min(420, viewportHeight - 90));
		targetFrameWrapper.style.top = '70px';
		targetFrameWrapper.style.left = '';
		targetFrameWrapper.style.right = '20px';
		targetFrameWrapper.style.width = '520px';
		targetFrameWrapper.style.height = desktopHeight + 'px';
	}
}

function ensureFloatingLamp(){
	if(document.getElementById('window_lamp_floating')){
		floatingLampEl = document.getElementById('window_lamp_floating');
		return;
	}
	floatingLampEl = document.createElement('DIV');
	floatingLampEl.id = 'window_lamp_floating';
	floatingLampEl.title = 'Индикатор целевого окна';
	floatingLampEl.style.position = 'fixed';
	floatingLampEl.style.left = '8px';
	floatingLampEl.style.bottom = '10px';
	floatingLampEl.style.width = '20px';
	floatingLampEl.style.height = '20px';
	floatingLampEl.style.border = '2px solid #2a2a2a';
	floatingLampEl.style.borderRadius = '50%';
	floatingLampEl.style.background = WINDOW_LAMP_OFF;
	floatingLampEl.style.boxShadow = '0 0 3px rgba(0,0,0,0.9)';
	floatingLampEl.style.zIndex = '12000';
	floatingLampEl.style.display = 'none';
	document.body.appendChild(floatingLampEl);
}

function scrollTargetFrameToThirtyPercent(){
	var frameWin,
		frameDoc,
		docEl,
		body,
		scrollHeight,
		targetTop;
	try{
		if(!targetFrameEl || !targetFrameEl.contentWindow){
			return;
		}
		frameWin = targetFrameEl.contentWindow;
		frameDoc = frameWin.document;
		docEl = frameDoc.documentElement;
		body = frameDoc.body;
		scrollHeight = Math.max(docEl ? docEl.scrollHeight : 0, body ? body.scrollHeight : 0);
		targetTop = Math.round(scrollHeight * 0.3);
		frameWin.scrollTo(0, targetTop);
	}
	catch(e){}
}

function createTargetFrame(){
	var frameHead,
		frameTitle,
		closeBtn;

	targetFrameWrapper = document.createElement('DIV');
	targetFrameWrapper.id = 'target_view_frame';
	targetFrameWrapper.style.position = 'fixed';
	targetFrameWrapper.style.top = '70px';
	targetFrameWrapper.style.right = '20px';
	targetFrameWrapper.style.width = '520px';
	targetFrameWrapper.style.height = '420px';
	targetFrameWrapper.style.background = '#f8efd9';
	targetFrameWrapper.style.border = '2px solid #9b7b4b';
	targetFrameWrapper.style.zIndex = '9999';
	targetFrameWrapper.style.boxShadow = '0 2px 10px rgba(0,0,0,0.35)';
	targetFrameWrapper.style.display = 'none';

	frameHead = document.createElement('DIV');
	frameHead.style.display = 'flex';
	frameHead.style.justifyContent = 'space-between';
	frameHead.style.alignItems = 'center';
	frameHead.style.padding = '6px 8px';
	frameHead.style.background = '#dcc69a';
	frameHead.style.borderBottom = '1px solid #9b7b4b';

	frameTitle = document.createElement('SPAN');
	frameTitle.innerHTML = 'Целевая деревня';
	frameTitle.style.fontWeight = 'bold';

	closeBtn = document.createElement('BUTTON');
	closeBtn.type = 'button';
	closeBtn.className = 'btn';
	closeBtn.style.padding = '2px 8px';
	closeBtn.innerHTML = 'Закрыть';
	closeBtn.addEventListener('click', function(){
		targetFrameWrapper.style.display = 'none';
	});

	frameHead.appendChild(frameTitle);
	frameHead.appendChild(closeBtn);

	targetFrameEl = document.createElement('IFRAME');
	targetFrameEl.style.width = '100%';
	targetFrameEl.style.height = 'calc(100% - 38px)';
	targetFrameEl.style.border = '0';
	targetFrameEl.src = 'about:blank';
	targetFrameEl.addEventListener('load', function(){
		setTimeout(scrollTargetFrameToThirtyPercent, 60);
	});

	targetFrameWrapper.appendChild(frameHead);
	targetFrameWrapper.appendChild(targetFrameEl);
	document.body.appendChild(targetFrameWrapper);
	updateTargetFrameLayout();
	if(!frameResizeBound){
		window.addEventListener('resize', updateTargetFrameLayout);
		frameResizeBound = true;
	}
}

function openTargetFrame(){
	var href = targetVillageHref,
		infoTable = $('#date_arrival').closest('table')[0],
		fallbackBody = infoTable && infoTable.tBodies && infoTable.tBodies.length ? infoTable.tBodies[0] : null;
	if(!href){
		href = getTargetVillageHref(fallbackBody);
		targetVillageHref = href;
	}
	if(!href){
		alert('Не удалось определить ссылку на целевую деревню.');
		return;
	}
	if(!targetFrameWrapper){
		createTargetFrame();
	}
	updateTargetFrameLayout();
	targetFrameEl.src = href;
	targetFrameWrapper.style.display = 'block';
}

function addViewTargetButton(){
	var submitBtn = $('#troop_confirm_submit')[0],
		viewBtn;

	if(!submitBtn || $('#view_target_button').length){
		return;
	}

	viewBtn = document.createElement('BUTTON');
	viewBtn.type = 'button';
	viewBtn.id = 'view_target_button';
	viewBtn.className = 'btn';
	viewBtn.style.marginLeft = '0';
	viewBtn.innerHTML = 'Смотреть цель';
	viewBtn.addEventListener('click', openTargetFrame);

	submitBtn.parentNode.insertBefore(viewBtn, submitBtn.nextSibling);

	applyResponsiveLayout();
}

function startCanvas(lastMillis, currentMillis){
	var c = document.getElementById("millis_canvas"),
		ctx = c.getContext("2d"),
		startMs = lastMillis % 1000,
		endMs = currentMillis % 1000,
		startAngle,
		endAngle;

	if(first){
		first = false;
		drawDial(ctx);
		startMs = 0;
	}

	if(endMs < startMs){
		drawDial(ctx);
	}

	startAngle = CIRCLE_OFFSET + (startMs / 1000) * Math.PI * 2;
	endAngle = CIRCLE_OFFSET + (endMs / 1000) * Math.PI * 2;

	ctx.beginPath();
	ctx.arc(CANVAS_CENTER, CANVAS_CENTER, ARC_RADIUS, startAngle, endAngle);
	ctx.strokeStyle = '#d01f1f';
	ctx.lineWidth = 2;
	ctx.stroke();
}

function setCookies(){
    var d = new Date();
    d.setTime(d.getTime() + (31*6*24*60*60*1000));
    var expires = 'expires='+ d.toUTCString();

	var cname = [worldNr+'_hitMs', worldNr+'_offsetMs'],
		cvalue = [$("#hit_input")[0].value, $("#offset_input")[0].value];

    document.cookie = cname[0]+'='+cvalue[0]+';'+expires+';';
	document.cookie = cname[1]+'='+cvalue[1]+';'+expires+';';
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1);
        if (c.indexOf(name) === 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}


let idNow = TribalWars.getGameData().village.id;
let orders = [];

if (location.search.includes('screen=info_village')) {
	let elemForm = $('#withdraw_selected_units_village_info')[0];
	let trCol = Array.from(elemForm.children[1].lastChild.children);
	let counter=0;
	trCol.forEach((tr, i) => {
		if (tr.children[0].innerHTML.includes('<a ')) {
			let td = Array.from(tr.children);
			let order = {
				vill_id: elemForm.innerHTML.match(/\d+/g)[0],
				hh: elemForm.innerHTML.match(/[\d+|a|b|c|d|f|e]{8}(?=">)/g)[0],
				unitName: [],
				unitAmt: [],
			};
			td.forEach(e => {
				if (e.id !== '') {
					order.unitName.push(e.id);
					order.unitAmt.push(e.innerText);
				}
			})
			order.num = tr.children[tr.children.length - 1].children[0].getAttribute('data-away-id');
			order.home = tr.children[tr.children.length - 1].children[0].getAttribute('name');
			orders.push(order);
			counter++;
			crBtn = $('<a class="btn" onclick="goHome(' + counter + ')">Отослать всех <br> раздельно<a>');
			crBtn.appendTo(tr);
		}
	});
}

else if(location.search.includes('screen=place&mode=units')){
	let trA = Array.from($('form').children().children().children());
	trA.splice(0, 3)
	//console.log(trA);
	let counter=0;
	trA.forEach((tr, i) => {
		if (tr.children[0].innerHTML.includes('<a ')&&!(tr.children[0].innerHTML.includes('Деревня'))) {
			let td = Array.from(tr.children);
			//console.log(td);
			let order = {
				hh: villageDock.saveLink.match(/=([\d|a|b|c|d|f|e]+){8}/g)[0].replace(/[=|"]/g,''),//document.querySelector("#content_value > form:nth-child(14) > input").value,
				unitName: [],
				unitAmt: [],
			};
			td.forEach(e => {
				if (e.id !== '') {
					//console.log(e.childNodes);
					order.unitName.push(e.id);
					order.unitAmt.push(e.innerText);
				}
			})
			order.num = tr.children[tr.children.length - 1].children[0].getAttribute('data-away-id');
			orders.push(order);
			counter++;
			crBtn = $('<a class="btn" onclick="goHomeAtHome(' + counter + ')">Отослать всех <br> раздельно<a>');
			crBtn.appendTo(tr);
		}

	})
} else{ alert('чёто не то');
}



goHome =function(i) {
	let minN = [];
	let minA = [];
	i -=1;
	let uri = '/game.php?village=' + idNow + '&screen=place&&action=withdraw_selected_units_village_info&mode=units';
	for (let ind = 0; ind < orders[i].unitName.length; ind++) {
		if (orders[i].unitAmt[ind] !== "0") {
			minA.push(orders[i].unitAmt[ind])
			minN.push(orders[i].unitName[ind])
		}
	}
	if (minN.indexOf('knight') !== -1) {
		let postBody = 'h=' + orders[i].hh + '&village_id=' + orders[i].vill_id + '&&' + orders[i].home + '=on';
		for (let b = 0; b < minN.length; b++) {
			postBody += '&&withdraw_unit[' + orders[i].num + '][units][' + minN[b] + ']=' + minA[b];
		}
		fetch(uri, {
			method: 'POST',
			body: postBody,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		}).then(() => {
			if (c === minA.length - 1) {
				location.reload();
			}
		})
	} else {
		for (let c = 0; c < minA.length; c++) {
			setTimeout(function () {
				let postBody = 'h=' + orders[i].hh + '&village_id=' + orders[i].vill_id + '&&' + orders[i].home + '=on&&withdraw_unit[' + orders[i].num + '][units][' + minN[c] + ']=' + minA[c];
				fetch(uri, {
					method: 'POST',
					body: postBody,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}).then(() => {
					if (c === minA.length - 1) {
						location.reload();
					}
				})

			}, c * 330)
		}
	}
}
goHomeAtHome = function(i) {
	let minN = [];
	let minA = [];
	i -= 1;
	let uri = '/game.php?village=' + idNow + '&screen=place&&action=withdraw_selected_unit_counts&mode=units';
              //game.php?village=4297&screen=place&&action=withdraw_selected_unit_counts&mode=units
	for (let ind = 0; ind < orders[i].unitName.length; ind++) {
		if (orders[i].unitAmt[ind] !== "0") {
			minA.push(orders[i].unitAmt[ind])
			minN.push(orders[i].unitName[ind])
		}
	}
	if (minN.indexOf('knight') !== -1) {
		let postBody = 'h=' + orders[i].hh;
		for (let b = 0; b < minN.length; b++) {
			postBody += '&&withdraw_unit[' + orders[i].num + '][units][' + minN[b] + ']=' + minA[b];
		}
		fetch(uri, {
			method: 'POST',
			body: postBody,
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		}).then(() => {
			if (c === minA.length - 1) {
				location.reload();
			}
		})
	} else {
		for (let c = 0; c < minA.length; c++) {
			setTimeout(function () {
				let postBody = 'h=' + orders[i].hh + '&&withdraw_unit[' + orders[i].num + '][' + minN[c] + ']=' + minA[c];
				fetch(uri, {
					method: 'POST',
					body: postBody,
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded'
					}
				}).then(() => {
					if (c === minA.length - 1) {
						location.reload();
					}
				})

			}, c * 330)
		}
	}
}

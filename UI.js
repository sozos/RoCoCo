var worker = new Worker('STS.js');
worker.addEventListener('message', function(e) {
	var data = e.data;
	switch(data.cmd) {
		case 'soln':
			updateUI(data.arg);
			break;
		case 'partial':
			partial(data.arg);
			break;
		case 'completed':
			completed(data.arg);
			break;
		case 'debug':
			alert(data.arg);
			break;
	}
}, false);

var teamID = 0;
var venueID = 0;
var numTeams = 0;
var numVenues = 0;
var numRounds = 0;
var teamNameArr = [];
var venueNameArr = [];
var RGTArr = [];
var RGVArr = [];
var state;
var hlCell = null; // highlighted cell

document.onclick = function(e) {
	if (hlCell !== null) {
		removeColours();
	}
}

function addTeam() {
	teamID++;
	numTeams++;
	numRounds = numTeams % 2 === 0 ? numTeams - 1: numTeams;

	//Code
	var name = 'Team ' + teamID;
	teamNameArr[numTeams] = name;
	addRGTArr();
	addRGVArr();
	//initScheTable();

	//HTML
	var input = $('<input type="text"/>').attr({
											id:			'team' + numTeams,
											value:		name,
											onchange:	'updateTeamName(' + numTeams + ')'
										});
	var del =	$('<a>').attr({
							class:		'button delete',
							onclick:	'delTeam(' + numTeams + ')'
						}).text(' ')
	$('#team').append(del).append(input);		

	if (numVenues === 0 || numVenues < Math.floor(numTeams / 2)) {
		addVenue();
	} else {
		runSTS();
	}
}

function delTeam(num) {
	numTeams--;
	//var oldNumRounds = numRounds;
	numRounds = numTeams % 2 === 0 ? numTeams - 1: numTeams;
	var index = num - 1;

	//Code
	teamNameArr.splice(num,  1);
	delRGTArr(num);
	//initScheTable();
	
	//HTML
	// remove
	$('#team a:eq(' + num + ')').remove();
	$('#team' + num).remove();
	
	// update
	$('#team a').each(function(i) {
		if (i !== 0) { $(this).attr('onclick', 'delTeam(' + i + ')'); }
	});
	$('#team input').each(function(i) {
		$(this).attr({
					'id': 'team' + (i + 1),
					'onchange': 'updateTeamName(' + (i + 1) + ')'
		});
	});
	runSTS();
}

function addVenue() {
	numVenues++;
	venueID++;
	var name = 'Venue ' + venueID;
	
	//HTML
	var input = $('<input type="text"/>').attr({
											id:			'venue' + numVenues,
											value:		name,
											onchange:	'updateVenueName(' + numVenues + ')'
										});
	var del =	$('<a>').attr({
							class:		'button delete',
							onclick:	'delVenue(' + numVenues + ')'
						}).text(' ')
	$('#venue').append(del).append(input);

	//Code
	venueNameArr[numVenues] = name;
	if (numVenues !== 1) { addRGVArr(); }
	
	runSTS();
}

function delVenue(num) {
	numVenues--;
	//var oldNumRounds = numRounds;
	//numRounds = numTeams % 2 === 0 ? numTeams - 1: numTeams;
	var index = num - 1;

	//Code
	venueNameArr.splice(num,  1);
	delRGVArr(num);
	//initScheTable();
	
	//HTML
	// remove
	$('#venue a:eq(' + num + ')').remove();
	$('#venue' + num).remove();
	
	// update
	$('#venue a').each(function(i) {
		if (i !== 0) { $(this).attr('onclick', 'delVenue(' + i + ')'); }
	});
	$('#venue input').each(function(i) {
		$(this).attr({
					'id': 'venue' + (i + 1),
					'onchange': 'updateVenueName(' + (i + 1) + ')'
		});
	});
	
	runSTS();
}

// update Team vs Round table
function updateUI(S) {
	initScheTable();
	
	for (var type in S) {
		for (var varname in S[type]) {
			var cell = document.getElementById([varname]);
			if (type === 'O') {
				var team = teamNameArr[S[type][varname]];
				cell.innerText = team === undefined ? 'Bye' : team;
			} else if (type === 'V') {
				var venue = venueNameArr[S[type][varname]];
				cell.innerText = venue === undefined ? 'Bye' : venue;
			}
		}
	}
	initConstraints();
}

function updateSlider(num) {
	var slider = document.getElementById('slider');
	if (num !== 0) {
		slider.min = 1;
		slider.max = num;
		if (num === 1) {
			//getSpace(1);
			drag(1);
		}
	} else {
		slider.min = 0;
		slider.max = 0;
		slider.value = 0;
	}
	var numSoln = document.getElementById('numSoln');
	numSoln.innerText = num;
}

function play() {
	worker.postMessage({'cmd': 'run', 'arg': 10});
	$('#playpause').attr({
		class:		'button pause',
		onclick:	'pause()'
	});
}

function pause() {
	$('#playpause').attr({
		class:		'button play',
		onclick:	'play()'
	});
}

// partial solutions
function partial(num) {
	updateSlider(num);
	if ($('#playpause').hasClass('pause')) {
		worker.postMessage({'cmd': 'run', 'arg': 10});
	}
}

// completed solutions
function completed(num) {
	updateSlider(num);
	$('#playpause').attr('class', 'button complete').removeAttr('onclick');
}

// show red green
function showRG(r, t) {	
	if (hlCell !== null) {
		removeColours();
	}
	var cell = document.getElementById('R' + r + 'T' + t);
	hlCell = cell;
	//cell.border = 10;
	cell.setAttribute('class', 'select');
	for (var o = 1; o <= numTeams; o++) {
		var team = document.getElementById('team' + o);		
		if (o === t) {
			team.style.backgroundColor = '#808080';
		} else {
			if (RGTArr[r][t][o] === 0) { // Red
				team.style.backgroundColor = '#FF0000';
			} else if (RGTArr[r][t][o] === 1) { // Green
				team.style.backgroundColor = '#00FF00';
			}
			team.setAttribute('onclick', 'invertRGT(' + r + ', ' + t + ', ' + o + ')');
		}
	}
	for (var v = 1; v <= numVenues; v++) {
		var venue = document.getElementById('venue' + v);		
		if (RGVArr[r][t][v] === 0) { // Red
			venue.style.backgroundColor = '#FF0000';
		} else if (RGVArr[r][t][v] === 1) { // Green
			venue.style.backgroundColor = '#00FF00';
		}
		venue.setAttribute('onclick', 'invertRGV(' + r + ', ' + t + ', ' + v + ')');
	}
	window.event.cancelBubble = true;
}

function removeColours() {
	for (var t = 1; t <= numTeams; t++) {
		var elem = document.getElementById('team' + t);
		elem.style.backgroundColor = '';
		elem.onclick = null;
	}	
	for (var v = 1; v <= numVenues; v++) {
		var elem = document.getElementById('venue' + v);
		elem.style.backgroundColor = '';
		elem.onclick = null;
	}
	//hlCell.border = 1;
	hlCell.setAttribute('class', '');
	hlCell = null;
}

function addRGTArr() {
	for (var r = 1; r <= numRounds; r++) {
		if(RGTArr[r] === undefined) { RGTArr[r] = []; }
		for (var t = 1; t <= numTeams; t++) {
			if(RGTArr[r][t] === undefined) { RGTArr[r][t] = []; }
			for (var o = 1; o <= numTeams; o++) {
				if (RGTArr[r][t][o] === undefined) {
					if(t === o) { RGTArr[r][t][o] = 0;}
					else { RGTArr[r][t][o] = 1; }
				}
			}
		}
	}
}

function delRGTArr(num) {
	var oldNumTeams = numTeams + 1;
	var newRGTArr = [];
	for (var r = 1; r <= numRounds; r++) {
		newRGTArr[r] = [];
		var tCount = 1;
		for (var t = 1; t <= oldNumTeams; t++) {
			if (t === num) { continue; }
			newRGTArr[r][tCount] = [];
			var oCount = 1;
			for (var o = 1; o <= oldNumTeams; o++) {
				if (o === num) { continue; }
				newRGTArr[r][tCount][oCount] = RGTArr[r][t][o];
				oCount++;
			}
			tCount++;
		}
	}
	RGTArr = newRGTArr;
}

// add red green venue array
function addRGVArr() {
	for (var r = 1; r <= numRounds; r++) {
	if(RGVArr[r] === undefined) { RGVArr[r] = []; }
		for (var t = 1; t <= numTeams; t++) {
			if(RGVArr[r][t] === undefined) { RGVArr[r][t] = []; }
			for (var v = 1; v <= numVenues; v++) {
				if (RGVArr[r][t][v] === undefined) {
					RGVArr[r][t][v] = 1;
				}
			}
		}
	}
}

// delete red green venue array
function delRGVArr(num) {
	var oldNumVenues = numVenues + 1;
	var newRGVArr = [];
	for (var r = 1; r <= numRounds; r++) {
		newRGVArr[r] = [];
		for (var t = 1; t <= numTeams; t++) {
			newRGVArr[r][t] = [];
			var vCount = 1;
			for (var v = 1; v <= oldNumVenues; v++) {
				if (v === num) { continue; }
				newRGVArr[r][t][vCount] = RGVArr[r][t][v];
				vCount++;
			}
		}
	}
	RGVArr = newRGVArr;
}

// Build Team vs Round table
function initScheTable() {
	var table = document.getElementById('scheTable');
	table.innerHTML = '<thead></thread><tbody></tbody>';
	var headerRow = $('#scheTable >thead').append('<tr>').children();
	for (var i = 0; i <= numRounds; i++) {
		headerRow.append('<th>');
		if (i !== 0) { headerRow.children('th:last').text('Round ' + i); }
	}
	
	table = table.tBodies[0];
	table.insertRow(-1);
	
	for (var t = 1; t <= numTeams; t++) {
		table.insertRow(-1);
		for (var r = table.rows[t].cells.length; r <= numRounds; r++) {
			var cell = table.rows[t].insertCell(-1);
			if(cell.innerText === '') {
				if (r === 0 && t === 0) { /* Do nothing */ }				
				else if (t === 0) {	cell.innerText = 'Round ' + r; }
				else if (r === 0) {	cell.innerText = teamNameArr[t]; }
				else {					
					var varname = 'R' + r + 'T' + t;
					var table2 = document.createElement('table');
					table2.id = varname;
					//table2.border = 1;
					table2.R = r;
					table2.T = t;
					table2.setAttribute('onclick', 'showRG(R, T)');
					cell.appendChild(table2);
					var row = table2.insertRow(-1);
					cell = row.insertCell(-1);
					cell.style.minWidth = 50;
					cell.id = varname + 'O';
					cell = row.insertCell(-1);
					cell.id = varname + 'V';
					constraints(r, t);
				}
			}
		}
	}
	var testWidth = $('#scheTable').css('width');
	$('#slider').css('width', testWidth);
}

// parse red green team array to send to STS.js
function parseRGTArr() {
	var arr = {};
	for (var r = 1; r <= numRounds; r++) {
		for (var t = 1; t <= numTeams; t++) {
			for (var o = 1; o <=numTeams; o++) {
				if(RGTArr[r][t][o] === 0) {
					if(arr['R' + r + 'T' + t + 'O'] === undefined) {
						arr['R' + r + 'T' + t + 'O'] = [];
					}
					arr['R' + r + 'T' + t + 'O'].push(o);
				}
			}
		}
	}
	return arr;
}

// parse red green venue array to send to STS.js
function parseRGVArr() {
	var arr = {};
	for (var r = 1; r <= numRounds; r++) {
		for (var t = 1; t <= numTeams; t++) {
			for (var v = 1; v <=numVenues; v++) {
				if(RGVArr[r][t][v] === 0) {
					if(arr['R' + r + 'T' + t + 'V'] === undefined) {
						arr['R' + r + 'T' + t + 'V'] = [];
					}
					arr['R' + r + 'T' + t + 'V'].push(v);
				}
			}
		}
	}
	return arr;
}

function drag(num) {
	var curSoln = document.getElementById('curSoln');
	curSoln.value = num
	worker.postMessage({'cmd': 'grab_results', 'arg': (num - 1)});
}

// invert red green team
function invertRGT(r, t, o) {
	var table = document.getElementById('R' + r + 'T' + t);
	var elem = document.getElementById('team' + o);
	var color = elem.style.backgroundColor;
	if (color === 'rgb(0, 255, 0)') { // If Green
		elem.style.backgroundColor = '#FF0000';
		RGTArr[r][t][o] = 0;
	} else if (color === 'rgb(255, 0, 0)') { // If Red
		elem.style.backgroundColor = '#00FF00';
		RGTArr[r][t][o] = 1;
	}
	constraints(r, t);
	runSTS();
	window.event.cancelBubble = true;
}

// invert red green venue
function invertRGV(r, t, v) {
	var table = document.getElementById('R' + r + 'T' + t);
	
	var elem = document.getElementById('venue' + v);
	var color = elem.style.backgroundColor;
	if (color === 'rgb(0, 255, 0)') { // If Green
		elem.style.backgroundColor = '#FF0000';
		RGVArr[r][t][v] = 0;
	} else if (color === 'rgb(255, 0, 0)') { // If Red
		elem.style.backgroundColor = '#00FF00';
		RGVArr[r][t][v] = 1;
	}
	constraints(r, t);
	runSTS();
	window.event.cancelBubble = true;
}

function constraints(r, t) {
	var table = document.getElementById('R' + r + 'T' + t);
	var team = table.rows[0].cells[0];
	var venue = table.rows[0].cells[1];
	var text;
	
	var tCount = 0;
	for (var o = 1; o <= numTeams; o++) {
		if (RGTArr[r][t][o] === 0) {
			tCount++;
		}
	}
	var vCount = 0;
	for (var v = 1; v <= numVenues; v++) {
		if (RGVArr[r][t][v] === 0) {
			vCount++;
		}
	}
	
	if (tCount > 1) {
		if (numTeams === tCount) {
			team.style.backgroundColor = '#FF0000';
		} else {
			team.style.backgroundColor = '#00FFFF';
		}
	} else {
		team.style.backgroundColor = '';
	}
	if (numTeams - tCount === 1) {
		text = team.innerText;
		if (text !== 'Bye') {
			team.innerHTML = '<b>' + text + '</b>';
		}
	}
	if (vCount > 0) {
		if (numVenues === vCount) {
			venue.style.backgroundColor = '#FF0000';
		} else {
			venue.style.backgroundColor = '#00FFFF';
		}
	} else {		
		venue.style.backgroundColor = '';
	}
	if (numVenues - vCount === 1) {
		text = venue.innerText;
		if (text !== 'Bye') {
			venue.innerHTML = '<b>' + text + '</b>';
		}
	}
}

function runSTS() {	
	$('#playpause').attr({
		class:		'button play',
		onclick:	'play()'
	});
	
	var table = document.getElementById('scheTable');
	//table.innerHTML = '';
	
	//temp
	var UI_Obj = {};
	UI_Obj.numTeams = numTeams;
	UI_Obj.numVenues = numVenues;
	UI_Obj.constraintTArr = parseRGTArr();
	UI_Obj.constraintVArr = parseRGVArr();
	worker.postMessage({'cmd': 'generate_first_soln',
						'arg': UI_Obj});
}

function updateTeamName(t) {
	teamNameArr[t] = $('#team input:eq('+ (t - 1) + ')').val();
	var slider = document.getElementById('slider');
	drag(slider.value);
}

function updateVenueName(v) {
	venueNameArr[v] = $('#venue input:eq('+ (v - 1) + ')').val();
	var slider = document.getElementById('slider');
	drag(slider.value);
}

function initConstraints() {
	for (var r = 1; r <= numRounds; r++) {
		for (var t = 1; t <= numTeams; t++) {
			constraints(r, t);
		}
	}
}

function jump(elem) {
	var num = elem.value;
	var slider = document.getElementById('slider');
	slider.value = num;
	drag(num);
}

function first() {
	$('#slider').attr('value', 1);
	drag(1);
}

function prev() {
	var slider = document.getElementById('slider');
	if(parseInt(slider.value) > parseInt(slider.min)) {
		drag(--slider.value);
	}
}

function next() {
	var slider = document.getElementById('slider');
	if(parseInt(slider.value) < parseInt(slider.max)) {
		drag(++slider.value);
	}
}

function last() {
	var max = $('#slider').attr('max');
	$('#slider').attr('value', max);
	drag(max);
}
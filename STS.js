// Import FD.js library
importScripts('fd.js');

// Event Listener
addEventListener('message', function(e) {
	var data = e.data;
	switch(data.cmd) {
	case 'generate_first_soln':
		STS_Engine.update_data(data.arg);
		STS_Engine.generate_first_soln(); // just generate one solution
		break;
	case 'run':
		STS_Engine.generate_solns(data.arg); // data.arg = number of iterations before stopping
		break;
    case 'grab_results':
		postMessage({'cmd': 'soln',
					 'arg': STS_Engine.return_soln(data.arg)});
        break;
	}
}, false);

// STS ENGINE
var STS_Engine = (function() {
	// The Object "pointer"
	var that = {};
	
	// Internal variables
	var state = ''; // a string value ('generate_first' | 'running' | 'paused' | 'completed')
	var spaceStack = []; // To store unexplored spaces
	var solnArr = []; // To store completed spaces
	var varnameArray = [];

	// External variables
	var numTeams = 0; // (from UI)
	var numVenues = 0; // (from UI)
	var numRounds = 0; // (Derived from numTeams)
	var constraintTArr = []; // (from UI)
	var constraintVArr = [];

	// Calculation functions
	function initSpace() {
		var total = numRounds * numTeams + 
					numRounds * numTeams + 
					0.5 * numRounds * numTeams * numTeams + 
					numRounds * numTeams +
					numRounds * numTeams +
					numRounds * numTeams;
		postMessage({'cmd': 'totalProg', 'arg': total});
		
		// Wipe everything to a clean slate
		spaceStack = [];
		solnArr = [];
     
		var r, t; // rounds and teams to be used in for loops
		var arr = []; // used to make rounds and teams distinct
		
		// Create new space
		var S = new FD.space();
     
		// Setting up R_T_O & R_T_V variables
		// Create the "sub-arrays" in the array and "push" the variables into the array
		for (r = 1; r <= numRounds; r++) {
			varnameArray[r] = [];
			for (t = 1; t <= numTeams; t++) {
				varnameArray[r][t] = 'R' + r + 'T' + t;
			}
		}
     
		// Declaring each variable into S
		for (r = 1; r <= numRounds; r++) {
			for (t = 1; t <= numTeams; t++) {
				S.decl(varnameArray[r][t]+'O', [[1 - (numTeams % 2), numTeams]]); // 0 for "bye"
				S.decl(varnameArray[r][t]+'V', [[0, numVenues]]); // 0 for "bye" venues
			}
		}

		// Adding initial constraints
		for (r = 1; r <= numRounds; r++) {
			arr = [];
				for (t = 1; t <= numTeams; t++) {
				//Teams cannot play themselves
				S.neq(varnameArray[r][t]+'O', S.const(t));

				//Team i vs Team j iff Team j vs Team i
				for (var o = t + 1; o <= numTeams; o++) {
					var tempVar = S.temp([[0, 1]]);
					S.reified('eq', [varnameArray[r][t]+'O', S.const(o)], tempVar); // Team plays opponent
					S.reified('eq', [varnameArray[r][o]+'O', S.const(t)], tempVar); // Opponent plays team
					S.reified('eq', [varnameArray[r][t]+'V', varnameArray[r][o]+'V'], tempVar); // Team and opponents play at same venue
           
					var tempVar2 = S.temp([[0, 1]]); // When you get a "bye", your venue is "0"
					S.reified('eq', [varnameArray[r][t]+'O', S.const(0)], tempVar2);
					S.reified('eq', [varnameArray[r][t]+'V', S.const(0)], tempVar2);
       
					var tempVar3 = S.temp([[0, 1]]); // When you don't get a "bye", your venue is 1~numVenues
					S.reified('neq', [varnameArray[r][t]+'O', S.const(0)], tempVar3);
					S.reified('neq', [varnameArray[r][t]+'V', S.const(0)], tempVar3);
				}
				arr.push(varnameArray[r][t]+'O');
			}
			//Each round, teams are distinct
			S.distinct(arr);
		}
     
		for (t = 1; t <= numTeams; t++) {
			arr = [];
			for (r = 1; r <= numRounds; r++) {
				arr.push(varnameArray[r][t]+'O');
			}
			//Each team play against distinct teams
			S.distinct(arr);
		}

		// constraint team array
		for (var varname in constraintTArr) {
			for (var index in constraintTArr[varname]) {
				S.neq(varname, S.const(constraintTArr[varname][index]));
			}
		}
		
		// constraint venue array
		for (var varname in constraintVArr) {
			for (var index in constraintVArr[varname]) {
				S.neq(varname, S.const(constraintVArr[varname][index]));
			}
		}

		try {
			S.propagate(); // Potential point of failure
			
			// Add space to spaceStack
			spaceStack.push(S);

			// Run soln_generator
			soln_generator(1);
		} catch (e) {
			// Do nothing so that solnArr is empty when requested by UI
			// alert('Constraints too strict');
			postMessage({'cmd': 'partial', 'arg': STS_Engine.return_solnArrLen()});
		}
	}
	
	function soln_generator(num_times) {
		for (var i = 0; i < num_times; i++) {
			if (spaceStack.length === 0) { // No more unexplored spaces
				postMessage({'cmd': 'completed', 'arg': STS_Engine.return_solnArrLen()}); // To tell UI generator is done
				break;
			} else {
				naive_brancher();
			}
			if (solnArr.length === 0) {
				i--;
			}
		}
		postMessage({'cmd': 'partial', 'arg': STS_Engine.return_solnArrLen()}); // To tell UI its partially done generating
	}
	
	function naive_brancher() {
		var curSpace = spaceStack.pop(); // soln_generator already guarantees that spaceStack is not empty
		var varName;
		var newSpace;
		var i;
     
		if (curSpace.is_solved()) {
			// Weed out spaces where non-zero venue values are not 0 or 2
			if (zeroortwo(curSpace)) {
				solnArr.push(curSpace);	// THIS IS TAKING UP ALL THE MEMORY
			} else {} // Nothing to do here.
		} else {
			varName = firstNonConstVar(curSpace);
			for (i = curSpace.vars[varName].min(); i <= curSpace.vars[varName].max(); i++) {
				try {
					newSpace = curSpace.clone();
					newSpace.eq(varName, newSpace.const(i));
					newSpace.propagate();
					spaceStack.push(newSpace);
				} catch(e) {};
			}
		}
	}

	// Interaction functions
	that.set_state_to_running = function() {
		state = 'running';
	};
	
	that.set_state_to_paused = function() {
		state = 'paused';
	};
	
	that.update_data = function(UI_Obj) {
		// Grab data
		numTeams = UI_Obj.numTeams;
		numVenues = UI_Obj.numVenues;
		constraintTArr = UI_Obj.constraintTArr;
		constraintVArr = UI_Obj.constraintVArr;
		
		// Update numRounds
		numRounds = numTeams % 2 === 0 ? numTeams - 1: numTeams;
		// If even numTeams, 1 less round than numTeams
		// If odd numTeams, then we have same number (due to 1 round where you play no one - "bye")
		// This works too: numRounds = numTeams - (1 - numTeams%2);
	};
	
	that.generate_first_soln = function() {
		initSpace();
		//soln_generator(1);
	};
	
	that.generate_solns = function(num) {
		soln_generator(num);
	};
	
	that.return_soln = function(index) {
		return parseSoln(index);
	};
	
	that.return_state = function() {
		return state;
	};
	
	that.return_solnArrLen = function() {
		return solnArr.length;
	}

	// Helper functions
	function firstNonConstVar(Space) {
	    for (var varName in Space.vars) {
			if (Space.vars[varName].size() !== 1) {
				return varName;
			}
		}
		throw "Space is solved."; // Shouldn't reach here
	}
	
	function zeroortwo(Space) {
		var i,r;
		//var numVenues = venuenameArray.length;
		// Initialise vArr to all 0
		var vArr = new Array(numVenues+1); // Additional "slot" for venue 0
		for (i = 0; i < vArr.length; i++) {
			vArr[i] = [];
			for (r = 1; r <= numRounds; r++) {
				vArr[i][r] = 0;
			}
		}

		// Populating vArr with the number of time each venue is used
		for (i in Space.vars) {
			if (i[0] === 'R' && i[2] === 'T' && i[4] === 'V') { // filters out venue vars
				if (Space.vars[i].min() !== Space.vars[i].max()) { // ignore cases where venues are not determined yet
					return false;
				}
				vArr[Space.vars[i].min()][i[1]]++; // .min() or .max() will give the same output since there's only 1 fixed value
			} else { // Do nothing
			}
		}
		
		// Checks that every venue in vArr is never used or used by only 2 teams
		for (i = 1; i <= numVenues; i++) {// Ignore venue 0 (that's for "bye"s)
			for (r = 1; r <= numRounds; r++) {
				if (vArr[i][r] !== 0 && vArr[i][r] !== 2) {
				return false;
				}
			}
		}

		return true;
	}
	
	function parseSoln(index) {
		var S = solnArr[index];
		var S2 = {'O': [], 'V': []};
		for (var r = 1; r <= numRounds; r++) {
			for (var t = 1; t <= numTeams; t++) {
				var varname = varnameArray[r][t];
				S2.O[varname + 'O'] = S.vars[varname + 'O'].dom[0][0];
				S2.V[varname + 'V'] = S.vars[varname + 'V'].dom[0][0];
			}
		}
		return S2;
	}
	
	return that;
}) ();

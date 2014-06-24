var textShown = false;
var showingHelp = false;
$(document).ready(function(){
	scaleCanvas();
	$('#startBtn').on('touchstart mousedown', function(){
		init();
		setTimeout(function(){
			document.body.addEventListener('mousedown', function(e) {
				handleClickTap(e.clientX);
			}, false);

			document.body.addEventListener('touchstart', function(e) {
				handleClickTap(e.changedTouches[0].clientX);
			}, false);
		}, 1);
	});
});

$(window).resize(scaleCanvas);
$(window).unload(function() {
	localStorage.setItem("saveState", exportSaveState());
});

function scaleCanvas() {
	canvas.width = $(window).width();
	canvas.height = $(window).height();

	if (canvas.height > canvas.width) {
		settings.scale = (canvas.width/800) * settings.baseScale;
	} else {
		settings.scale = (canvas.height/800) * settings.baseScale;
	}

	trueCanvas = {
		width:canvas.width,
		height:canvas.height
	};

	if (window.devicePixelRatio) {
		//from https://gist.github.com/joubertnel/870190
		var cw = $("#canvas").attr('width');
		var ch = $("#canvas").attr('height');
	
		$("#canvas").attr('width', cw * window.devicePixelRatio);
		$("#canvas").attr('height', ch * window.devicePixelRatio);
		$("#canvas").css('width', cw);
		$("#canvas").css('height', ch);

		trueCanvas = {
			width:cw,
			height:ch
		};

		ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
	}
}

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');
var count = 0;
var trueCanvas = {width:canvas.width,height:canvas.height};

window.requestAnimFrame = (function() {
	return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function(callback) {
		window.setTimeout(callback, 1000 / framerate);
	};
})();

$('#clickToExit').bind('click', toggleDevTools);

function toggleDevTools() {
	$('#devtools').toggle();
}

var settings;

if(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
	settings = {
		startDist:227,
		creationDt:40,
		baseScale:1.4,
		scale:1,
		prevScale:1,
		baseHexWidth:87,
		hexWidth:87,
		baseBlockHeight:20,
		blockHeight:20,
		rows:6,
		speedModifier:0.7,
		creationSpeedModifier:0.7,
				comboMultiplier: 240
	};
} else {
	settings = {
		baseScale:1,
		startDist:340,
		creationDt:9,
		scale:1,
		prevScale:1,
		hexWidth:65,
		baseHexWidth:87,
		baseBlockHeight:20,
		blockHeight:15,
		rows:8,
		speedModifier:0.8,
		creationSpeedModifier:0.6,
		comboMultiplier:240
	};
}

var framerate = 60;
var history = {};
var score = 0;
var isGameOver = 3;
var scoreAdditionCoeff = 1;
var prevScore = 0;
var numHighScores = 3;
var spaceModifier = 1;

var highscores = [0, 0, 0];
if(localStorage.getItem('highscores'))
	highscores = localStorage.getItem('highscores').split(',').map(Number);

localStorage.setItem('highscores', highscores);

var blocks = [];
var MainClock;

var gdx = 0;
var gdy = 0;

var lastGen;
var prevTimeScored;
var nextGen;
var spawnLane = 0;
var importing = 0;
var importedHistory;
var startTime;

var gameState;
setStartScreen();

function init() {
	$('#pauseBtn').hide();
	$('#startBtn').hide();
	var saveState = localStorage.getItem("saveState") || "{}";
	saveState = JSONfn.parse(saveState);
	document.getElementById("canvas").className = "";
	history = {};
	importedHistory = undefined;
	importing = 0;
	isGameOver = 2;
	score = saveState.score || 0;
	prevScore = 0;
	spawnLane = 0;
	op = 0;
	scoreOpacity = 0;
	gameState = -2;
	if(saveState.clock !== undefined) gameState = 1;

	count = 0;
	var i;
	var block;
	if(saveState.blocks) {
		for(i=0; i<saveState.blocks.length; i++) {
			block = saveState.blocks[i];
			blocks.push(block);
		}
		console.log(blocks);
	}
	else {
		blocks = [];
	}

	gdx = saveState.gdx || 0;
	gdy = saveState.gdy || 0;
	comboMultiplier = saveState.comboMultiplier || 0;

	MainClock = saveState.clock || new Clock(settings.hexWidth);

	scaleCanvas();
	settings.blockHeight = settings.baseBlockHeight * settings.scale;
	settings.hexWidth = settings.baseHexWidth * settings.scale;
	MainClock.sideLength = settings.hexWidth;

	for(i=0; i<MainClock.blocks.length; i++) {
		MainClock.blocks[i].height = settings.blockHeight;
		for(var j=0; j<MainClock.blocks[i].length; j++) {
			block = MainClock.blocks[i][j];
			block.distFromHex = 2 * MainClock.sideLength / Math.sqrt(3) + (j-1) * block.height - 5 * settings.scale;
			block.settled = 0;
		}
	}

	MainClock.y = -100;

	startTime = Date.now();
	waveone = saveState.wavegen || new waveGen(MainClock,Date.now(),[1,1,0],[1,1],[1,1]);
	
	MainClock.texts = []; //clear texts
	hideText();
}

function addNewBlock(blocklane, color, iter, distFromHex, settled) { //last two are optional parameters
	iter *= settings.speedModifier;
	if (!history[count]) {
		history[count] = {};
	}

	history[count].block = {
		blocklane:blocklane,
		color:color,
		iter:iter
	};

	if (distFromHex) {
		history[count].distFromHex = distFromHex;
	}
	if (settled) {
		blockHist[count].settled = settled;
	}
	blocks.push(new Block(blocklane, color, iter, distFromHex, settled));
}

function importHistory(j) {
	if (!j) {
		try {
			var ih = JSON.parse(prompt("Import JSON"));
			if (ih) {
				init();
				importing = 1;
				importedHistory = ih;
			}
		}
		catch (e) {
			alert("Error importing JSON");
		}
	} else {
		init();
		importing = 1;
		importedHistory = j;
	}
}

function exportHistory() {
	$('#devtoolsText').html(JSON.stringify(history));
	toggleDevTools();
}

function stepInitialLoad() {
	var dy = getStepDY(Date.now() - startTime, 0, (100 + trueCanvas.height/2), 1300);
	if (Date.now() - startTime > 1300) {
		MainClock.dy = 0;
		MainClock.y = (trueCanvas.height/2);
		if (Date.now() - startTime - 500 > 1300) {
			$('#pauseBtn').show();
			gameState = 1;
		}
	} else {
		MainClock.dy = dy;
	}
}

function setStartScreen() {
	debugger;
	init();
	$('#startBtn').show();
	if (!isStateSaved()) {
		importHistory(introJSON);
	} else {
		importing = 0;
	}
	gameState = 0;
}

//t: current time, b: begInnIng value, c: change In value, d: duration
function getStepDY(t, b, c, d) {
	if ((t/=d) < (1/2.75)) {
		return c*(7.5625*t*t) + b;
	} else if (t < (2/2.75)) {
		return c*(7.5625*(t-=(1.5/2.75))*t + 0.75) + b;
	} else if (t < (2.5/2.75)) {
		return c*(7.5625*(t-=(2.25/2.75))*t + 0.9375) + b;
	} else {
		return c*(7.5625*(t-=(2.625/2.75))*t + 0.984375) + b;
	}
}

function animLoop() {
	if (gameState == 1) { //game play
		requestAnimFrame(animLoop);
		update();
		render();
		if (checkGameOver()) {
			gameState = 2;
			clearSaveState();
		}
	}
	else if (gameState === 0) { //start screen
		requestAnimFrame(animLoop);
		if (importing) {
			update();
		}
		render();
		debugger;
	}
	else if (gameState == -2) { //initialization screen just before starting
		requestAnimFrame(animLoop);
		settings.hexWidth = settings.baseHexWidth * settings.scale;
		settings.blockHeight = settings.baseBlockHeight * settings.scale;
		stepInitialLoad();
		render();
	}
	else if (gameState == -1) { //pause
		requestAnimFrame(animLoop);
		render();
	}
	else if (gameState == 2) { //end screen
		requestAnimFrame(animLoop);
		update();
		render();
		gameOverDisplay();
		highscores = localStorage.getItem('highscores').split(',').map(Number);
		for (var i = 0; i < numHighScores; i++) {
			if (highscores[i] < score) {
				for (var j = numHighScores - 1; j > i; j--) {
					highscores[j] = highscores[j - 1];
				}
				highscores[i] = score;
				break;
			}
		}

		localStorage.setItem('highscores', highscores);
	}
	else {
		setStartScreen();
	}
}

requestAnimFrame(animLoop);
function isInfringing(clock){
	for(var i=0;i<clock.sides;i++){
		var subTotal=0;
		for (var j=0;j<clock.blocks[i].length;j++){
			subTotal+=clock.blocks[i][j].deleted ;
		}
		if (clock.blocks[i].length- subTotal>settings.rows){
			return true;
		}
	}
	return false;
}

function checkGameOver() {
	for (var i = 0; i < MainClock.sides; i++) {
		if (isInfringing(MainClock)) {
			return true;
		}
	}
	return false;
}

window.onblur = function (e) {
	if (gameState==1) {
		pause();
	}
};
function showHelp(){
	pause(false,true);
	if(document.getElementById("helpScreen").style.display=="none" || document.getElementById("helpScreen").style.display === ""){
		document.getElementById("helpScreen").style.display = "block";
	}
	else if(document.getElementById("helpScreen").style.display=="block" ){
		document.getElementById("helpScreen").style.display = "none";
		
	}
	showingHelp = !showingHelp;
}

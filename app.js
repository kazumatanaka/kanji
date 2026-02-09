// --- グローバル変数 ---
let selectedGrade = 4;
let currentQuestions = [];
let currentIndex = 0;
let currentMode = ''; // 'read' or 'write'
let mistakes = JSON.parse(localStorage.getItem('kanjiMistakes')) || {};

// ストローク記録用（手書き認識用）
let strokeTrace = []; 
let currentStroke = []; 
let lastTime = 0;

// --- 音声生成 (AudioContext) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1100, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start();
        osc.stop(now + 0.4);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start();
        osc.stop(now + 0.3);
    }
}

// --- 初期化 & メニュー ---
window.onload = () => {
    updateStats();
    setupCanvas();
};

function updateStats() {
    document.getElementById('total-count').innerText = localStorage.getItem('totalPlays') || 0;
    document.getElementById('mistake-count').innerText = Object.keys(mistakes).length;
    document.getElementById('mistake-btn').disabled = Object.keys(mistakes).length === 0;
}

function showMenuGrade() {
    switchScreen('menu-grade');
    updateStats();
}

function selectGrade(grade) {
    selectedGrade = grade;
    switchScreen('menu-mode');
}

function startMistakeMode() {
    // 苦手モードは読み書き混在または選択させるが、今回はシンプルに混在でスタート
    const ids = Object.keys(mistakes).map(Number);
    currentQuestions = questionData.filter(q => ids.includes(q.id))
        .sort(() => Math.random() - 0.5);
    
    if (currentQuestions.length === 0) return;
    startSession('mistake');
}

function startGame(mode) {
    currentMode = mode;
    // 学年とモードでフィルタ
    currentQuestions = questionData.filter(q => q.grade === selectedGrade && q.type === mode)
        .sort(() => Math.random() - 0.5);
    
    if (currentQuestions.length === 0) {
        alert("該当する問題がありません。");
        return;
    }
    startSession(mode);
}

function startSession(modeLabel) {
    currentIndex = 0;
    switchScreen('game-screen');
    loadQuestion();
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// --- 問題表示 ---
function loadQuestion() {
    const q = currentQuestions[currentIndex];
    const total = currentQuestions.length;
    
    document.getElementById('grade-display').innerText = `小${q.grade} (${q.type === 'read' ? '読み' : '書き'})`;
    document.getElementById('progress-display').innerText = `${currentIndex + 1} / ${total}`;
    
    // HTMLとして挿入（赤字反映のため）
    document.getElementById('q-text').innerHTML = q.q;
    document.getElementById('result-overlay').style.display = 'none';
    
    if (q.type === 'read') {
        document.getElementById('q-type').innerText = '【読み】 赤い文字の読みを答えよう';
        document.getElementById('reading-ui').style.display = 'flex';
        document.getElementById('writing-ui').style.display = 'none';
        document.getElementById('recognized-text').innerText = "";
    } else {
        document.getElementById('q-type').innerText = '【書き】 カタカナの部分を漢字で書こう';
        document.getElementById('reading-ui').style.display = 'none';
        document.getElementById('writing-ui').style.display = 'flex';
        clearCanvas();
    }
}

// --- 1. 音声認識 (読み) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('recognized-text').innerText = `認識: ${transcript}`;
        checkAnswer(transcript);
    };
    recognition.onspeechend = () => {
        recognition.stop();
        document.getElementById('mic-btn').classList.remove('recording');
    };
}

document.getElementById('mic-btn').addEventListener('click', () => {
    if (!SpeechRecognition) return alert("Chromeなど音声認識対応ブラウザを使用してください");
    document.getElementById('mic-status').innerText = "聞いています...";
    recognition.start();
});

// --- 2. Canvas & API手書き認識 (書き) ---
let canvas, ctx;
let isDrawing = false;

function setupCanvas() {
    canvas = document.getElementById('write-canvas');
    ctx = canvas.getContext('2d');
    
    const dpr = window.devicePixelRatio || 1;
    // CSSサイズに合わせてCanvasバッファサイズ調整
    canvas.width = 300 * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#333';

    // イベント設定
    canvas.addEventListener('touchstart', startDraw, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    canvas.addEventListener('touchend', endDraw);
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    currentStroke = [[], [], []]; // X, Y, Time
    lastTime = Date.now();
    
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    
    // 最初の点
    addPoint(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    
    addPoint(pos.x, pos.y);
}

function endDraw() {
    if (isDrawing) {
        isDrawing = false;
        strokeTrace.push(currentStroke); // ストローク完了時に追加
    }
}

function addPoint(x, y) {
    const t = Date.now() - lastTime;
    currentStroke[0].push(x);
    currentStroke[1].push(y);
    currentStroke[2].push(t);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
    strokeTrace = []; // 履歴もクリア
    document.getElementById('api-status').innerText = "";
}

// Google Input Tools APIへリクエスト
async function checkWriting() {
    if (strokeTrace.length === 0) {
        alert("文字を書いてください");
        return;
    }

    document.getElementById('api-status').innerText = "判定中...";

    // API用データ作成
    // format: [x_array, y_array, t_array] per stroke
    // API requires: "ink": [[x,y,t], [x,y,t]...] 
    // ※今回はGoogle Input Tools形式に合わせる
    
    const requestBody = {
        app_version: 0.4,
        api_level: "537.36",
        device: window.navigator.userAgent,
        input_type: 0,
        options: "enable_pre_space",
        requests: [{
            writing_guide: { writing_area_width: 300, writing_area_height: 300 },
            pre_context: "",
            max_num_results: 10,
            max_completions: 0,
            language: "ja",
            ink: strokeTrace 
        }]
    };

    try {
        const response = await fetch('https://www.google.com/inputtools/request?ime=handwriting&app=mobilesearch&cs=1&oe=UTF-8', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        
        if (data[0] === "SUCCESS") {
            // data[1][0][1] に候補の配列が入っている
            const candidates = data[1][0][1];
            console.log("AI認識候補:", candidates);
            
            // 候補の中に正解があるかチェック
            const q = currentQuestions[currentIndex];
            const isCorrect = candidates.includes(q.a);
            
            checkAnswer(isCorrect ? q.a : candidates[0]); // 正解なら正解文字を、不正解ならAIが一番近いと思った文字を渡す
        } else {
            throw new Error("Recognition failed");
        }

    } catch (e) {
        console.error(e);
        document.getElementById('api-status').innerText = "通信エラー: 手書き判定できませんでした";
        // エラー時は自己採点へフォールバックも可能だが、今回はアラートのみ
    }
}


// --- 共通判定ロジック ---
function checkAnswer(userInput) {
    const q = currentQuestions[currentIndex];
    const cleanUser = userInput.replace(/\s+/g, '');
    const cleanAns = q.a.replace(/\s+/g, '');
    
    // 正誤判定
    const isCorrect = (cleanUser === cleanAns);

    // 画面表示
    const overlay = document.getElementById('result-overlay');
    const mark = document.getElementById('judge-mark');
    const ans = document.getElementById('ans-text');
    const userDisplay = document.getElementById('user-answer-display');

    overlay.style.display = 'flex';
    ans.innerText = q.a;
    userDisplay.innerText = `あなたの回答: ${userInput}`;

    if (isCorrect) {
        mark.innerText = '〇';
        mark.style.color = '#2ECC71';
        playSound('correct');
        // 苦手リストから削除
        if (mistakes[q.id]) {
            delete mistakes[q.id];
            localStorage.setItem('kanjiMistakes', JSON.stringify(mistakes));
        }
    } else {
        mark.innerText = '✕';
        mark.style.color = '#E74C3C';
        playSound('wrong');
        // 間違いリスト追加
        mistakes[q.id] = (mistakes[q.id] || 0) + 1;
        localStorage.setItem('kanjiMistakes', JSON.stringify(mistakes));
    }

    // 学習回数更新
    let currentPlays = Number(localStorage.getItem('totalPlays')) || 0;
    localStorage.setItem('totalPlays', currentPlays + 1);
}

function nextQuestion() {
    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        loadQuestion();
    } else {
        alert("学習終了！トップへ戻ります");
        showMenuGrade();
    }
}

function resetData() {
    if(confirm("学習データを全て消去しますか？")) {
        localStorage.clear();
        mistakes = {};
        updateStats();
    }
}
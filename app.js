// --- グローバル変数 ---
let currentQuestions = [];
let currentIndex = 0;
let currentMode = ''; // 'normal' or 'mistake'
let mistakes = JSON.parse(localStorage.getItem('kanjiMistakes')) || {}; // { id: count }

// --- 音声生成 (AudioContext) ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'correct') {
        // ピンポン（高音2回）
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1); // -> high
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
    } else {
        // ブブー（低音のこぎり波）
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(100, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

// --- 初期化 & メニュー ---
window.onload = () => {
    updateStats();
    setupCanvas();
};

function updateStats() {
    const total = Object.values(mistakes).reduce((a, b) => a + b, 0); // ここは単純な合計ではなく苦手数ですが簡易表示
    document.getElementById('total-count').innerText = localStorage.getItem('totalPlays') || 0;
    document.getElementById('mistake-count').innerText = Object.keys(mistakes).length;
    
    // 苦手がなければボタンを薄く
    document.getElementById('mistake-btn').disabled = Object.keys(mistakes).length === 0;
}

function showMenu() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('menu-screen').classList.add('active');
    updateStats();
}

function startGame(grade) {
    currentMode = 'normal';
    // 学年でフィルタリングし、ランダムシャッフル
    currentQuestions = questionData.filter(q => q.grade === grade)
        .sort(() => Math.random() - 0.5);
    
    if (currentQuestions.length === 0) {
        alert("問題がありません");
        return;
    }
    
    startSession();
}

function startMistakeMode() {
    currentMode = 'mistake';
    const ids = Object.keys(mistakes).map(Number);
    currentQuestions = questionData.filter(q => ids.includes(q.id))
        .sort(() => Math.random() - 0.5);
        
    startSession();
}

function startSession() {
    currentIndex = 0;
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('game-screen').classList.add('active');
    loadQuestion();
}

// --- 問題表示 ---
function loadQuestion() {
    const q = currentQuestions[currentIndex];
    const total = currentQuestions.length;
    
    document.getElementById('grade-display').innerText = currentMode === 'mistake' ? '苦手克服' : `小${q.grade}`;
    document.getElementById('progress-display').innerText = `${currentIndex + 1} / ${total}`;
    
    document.getElementById('q-text').innerText = q.q;
    document.getElementById('result-overlay').style.display = 'none';
    
    // UI切り替え
    if (q.type === 'read') {
        document.getElementById('q-type').innerText = '【読み】 声に出して答えよう';
        document.getElementById('reading-ui').style.display = 'flex';
        document.getElementById('writing-ui').style.display = 'none';
        document.getElementById('mic-status').innerText = "マイクボタンを押して回答";
        document.getElementById('recognized-text').innerText = "";
    } else {
        document.getElementById('q-type').innerText = '【書き】 枠の中に指で書こう';
        document.getElementById('reading-ui').style.display = 'none';
        document.getElementById('writing-ui').style.display = 'flex';
        clearCanvas();
    }
}

// --- 音声認識 (読み問題) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        document.getElementById('recognized-text').innerText = `認識: ${transcript}`;
        checkReading(transcript);
    };

    recognition.onspeechend = () => {
        recognition.stop();
        document.getElementById('mic-btn').classList.remove('recording');
    };
    
    recognition.onerror = (event) => {
        document.getElementById('mic-status').innerText = "エラー: " + event.error;
    };
}

document.getElementById('mic-btn').addEventListener('click', () => {
    if (!SpeechRecognition) {
        alert("このブラウザは音声認識に対応していません(Chrome推奨)");
        return;
    }
    document.getElementById('mic-status').innerText = "聞いています...";
    recognition.start();
});

function checkReading(input) {
    const q = currentQuestions[currentIndex];
    // ひらがなに変換して比較（簡易的）や、完全一致
    // 実際にはひらがな化ライブラリを入れると良いが、ここでは入力＝正解(ひらがな)と比較
    if (input.replace(/\s+/g, '') === q.a.replace(/\s+/g, '')) {
        processResult(true);
    } else {
        // 不正解の場合は即座にNGにせず、ユーザーに確認させるフローもアリだが、
        // 今回はシンプルに判定画面へ
        processResult(false, input);
    }
}

// --- Canvas 手書き (書き問題) ---
let canvas, ctx;
let isDrawing = false;

function setupCanvas() {
    canvas = document.getElementById('write-canvas');
    ctx = canvas.getContext('2d');
    
    // 高解像度対応
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#333';

    // タッチイベント
    canvas.addEventListener('touchstart', startDraw, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    canvas.addEventListener('touchend', endDraw);
    // マウスイベント（PCデバッグ用）
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
}

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function startDraw(e) {
    e.preventDefault();
    isDrawing = true;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
}

function endDraw() {
    isDrawing = false;
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);
}

function checkWriting() {
    // 書き取りは自己採点モードへ移行
    const q = currentQuestions[currentIndex];
    showResultScreen('self-check', q.a);
}


// --- 判定と結果処理 ---
function showResultScreen(status, answerText) {
    const overlay = document.getElementById('result-overlay');
    const mark = document.getElementById('judge-mark');
    const ans = document.getElementById('ans-text');
    const selfJudge = document.getElementById('self-judge-btns');
    const nextBtn = document.getElementById('next-btn');

    overlay.style.display = 'flex';
    ans.innerText = answerText;

    if (status === 'self-check') {
        mark.innerText = '？';
        mark.style.color = '#F5A623';
        selfJudge.style.display = 'block';
        nextBtn.style.display = 'none';
    } else {
        selfJudge.style.display = 'none';
        nextBtn.style.display = 'block';
        
        if (status === true) {
            mark.innerText = '〇';
            mark.style.color = '#2ECC71';
            playSound('correct');
        } else {
            mark.innerText = '✕';
            mark.style.color = '#E74C3C';
            playSound('wrong');
        }
    }
}

function processResult(isCorrect, userInput = null) {
    const q = currentQuestions[currentIndex];
    
    // 書き取りの自己採点からの呼び出し、または読みの判定後
    if (document.getElementById('self-judge-btns').style.display === 'block') {
        // 自己採点モードだった場合、判定画面を更新
        showResultScreen(isCorrect, q.a);
    } else if (q.type === 'read') {
        // 読みの場合の初期表示
         showResultScreen(isCorrect, q.a);
    }

    // データの保存
    let currentPlays = Number(localStorage.getItem('totalPlays')) || 0;
    localStorage.setItem('totalPlays', currentPlays + 1);

    if (!isCorrect) {
        // 間違いリストに追加
        mistakes[q.id] = (mistakes[q.id] || 0) + 1;
    } else {
        // 正解かつ苦手モードなら、苦手リストから削除（あるいはカウント減らす）
        if (currentMode === 'mistake' && mistakes[q.id]) {
            delete mistakes[q.id];
        }
    }
    localStorage.setItem('kanjiMistakes', JSON.stringify(mistakes));
}

function nextQuestion() {
    currentIndex++;
    if (currentIndex < currentQuestions.length) {
        loadQuestion();
    } else {
        alert("学習終了！お疲れ様でした。");
        showMenu();
    }
}

function resetData() {
    if(confirm("学習データを全て消去しますか？")) {
        localStorage.clear();
        mistakes = {};
        updateStats();
    }
}
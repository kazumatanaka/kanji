let currentMode = ''; 
let currentQuestion = null;
let combo = 0;
let strokes = [];
let currentStroke = [];
let history = JSON.parse(localStorage.getItem('kanjiHistory') || '{}');

// --- 音生成 ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(isCorrect) {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.connect(g); g.connect(audioCtx.destination);
    if (isCorrect) {
        osc.frequency.setValueAtTime(523, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(146, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    }
    osc.start(); osc.stop(audioCtx.currentTime + 0.5);
}

// --- 手書き描画ロジック ---
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b';

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
}

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const p = getPos(e);
    currentStroke = [[p.x], [p.y]];
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
});
canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y); ctx.stroke();
    currentStroke[0].push(p.x); currentStroke[1].push(p.y);
});
canvas.addEventListener('touchend', () => { strokes.push(currentStroke); });

function clearCanvas() {
    ctx.clearRect(0, 0, 300, 300);
    strokes = [];
}

// --- アプリ制御 ---
function startApp(mode) {
    currentMode = mode;
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // 表示の初期化
    document.getElementById('write-zone').classList.toggle('hidden', mode === 'read');
    document.getElementById('read-zone').classList.toggle('hidden', mode !== 'read');
    
    nextQuestion();
}

function backToMenu() { location.reload(); }

function nextQuestion() {
    clearCanvas();
    document.getElementById('feedback-overlay').classList.add('hidden');
    document.getElementById('next-btn').classList.add('hidden');
    
    const grade = document.getElementById('grade-select').value;
    
    // モードと学年でフィルタリング
    let pool = questions.filter(q => {
        const gradeMatch = (grade === 'all' || q.grade == grade);
        // 苦手克服モード以外は、練習中のモード(read/write)と一致するものだけを出す
        const modeMatch = (currentMode === 'review') ? (history[q.id]?.p > 0) : (q.mode === currentMode);
        return gradeMatch && modeMatch;
    });
    
    if (pool.length === 0) {
        alert("対象の問題が見つかりません。メニューに戻ります。");
        backToMenu();
        return;
    }
    
    // 苦手問題の重み付け抽選
    let weighted = [];
    pool.forEach(q => {
        let weight = (history[q.id]?.p || 0) + 1;
        for(let i=0; i<weight; i++) weighted.push(q);
    });
    
    currentQuestion = weighted[Math.floor(Math.random() * weighted.length)];
    document.getElementById('hint-text').innerText = currentQuestion.hint;
    document.getElementById('question-text').innerText = currentQuestion.kanji;
}

// --- 判定ロジック ---
async function checkHandwriting() {
    if (strokes.length === 0) return;
    try {
        const res = await fetch('https://www.google.com.tw/inputtools/request?ime=handwriting&app=mobilesearch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                options: "enable_pre_space",
                requests: [{ writing_guide: { width: 300, height: 300 }, ink: strokes, language: "ja" }]
            })
        });
        const data = await res.json();
        const candidates = data[1][0][1];
        processResult(candidates.includes(currentQuestion.answer));
    } catch (e) { alert("判定エラー"); }
}

function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("音声認識非対応ブラウザです"); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'ja-JP';
    document.getElementById('mic-status').innerText = "🎙 聴いています...";
    rec.onresult = (e) => {
        const val = e.results[0][0].transcript;
        document.getElementById('mic-status').innerText = `「${val}」を判定中...`;
        // 音声認識結果が「漢字」になっても「正解」または「出題時の漢字」と一致すればOK
        processResult(val === currentQuestion.answer || val === currentQuestion.kanji);
    };
    rec.start();
}

function processResult(isCorrect) {
    const overlay = document.getElementById('feedback-overlay');
    overlay.classList.remove('hidden');
    
    if (isCorrect) {
        playSound(true);
        combo++;
        overlay.innerText = "正解！";
        overlay.className = "correct";
        updateHistory(currentQuestion.id, true);
        setTimeout(nextQuestion, 1000);
    } else {
        playSound(false);
        combo = 0;
        overlay.innerText = `正解は「${currentQuestion.answer}」`;
        overlay.className = "wrong";
        updateHistory(currentQuestion.id, false);
        document.getElementById('next-btn').classList.remove('hidden');
    }
    document.getElementById('combo-display').innerText = `${combo} COMBO`;
}

function updateHistory(id, isCorrect) {
    if (!history[id]) history[id] = { p: 0 };
    history[id].p = isCorrect ? Math.max(0, history[id].p - 1) : history[id].p + 3;
    localStorage.setItem('kanjiHistory', JSON.stringify(history));
}
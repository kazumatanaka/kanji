/*
  targetタグの使い方:
  読み問題の場合、読み仮名を答えさせたい漢字を <span class="target-char">漢字</span> で囲んでください。
*/

const questionData = [
    // --- 小4レベル ---
    { id: 1, grade: 4, type: 'read', q: '<span class="target-char">不老</span>長寿', a: 'ふろう' },
    { id: 2, grade: 4, type: 'read', q: '意気<span class="target-char">投合</span>', a: 'とうごう' },
    { id: 3, grade: 4, type: 'write', q: 'カンレイ前線', a: '寒冷' },
    { id: 4, grade: 4, type: 'write', q: '牛の乳をシボる', a: '搾' },

    // --- 小5レベル ---
    { id: 5, grade: 5, type: 'read', q: '<span class="target-char">典型的</span>な例', a: 'てんけいてき' },
    { id: 6, grade: 5, type: 'read', q: '<span class="target-char">清潔</span>な服', a: 'せいけつ' },
    { id: 7, grade: 5, type: 'write', q: 'ソウゴウ的に判断する', a: '総合' },
    { id: 8, grade: 5, type: 'write', q: 'エキタイ燃料', a: '液体' },

    // --- 小6・受験レベル ---
    { id: 9, grade: 6, type: 'read', q: '<span class="target-char">権謀術数</span>', a: 'けんぼうじゅっすう' },
    { id: 10, grade: 6, type: 'read', q: '<span class="target-char">生返事</span>をする', a: 'なまへんじ' },
    { id: 11, grade: 6, type: 'write', q: 'ハイセツ物を処理する', a: '排泄' },
    { id: 12, grade: 6, type: 'write', q: 'カンケツセンが吹き出す', a: '間欠泉' },
];
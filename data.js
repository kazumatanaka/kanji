/*
  type: 'read' (読み) or 'write' (書き)
  q: 問題文 (書きの場合は、漢字にする部分をひらがなにするか、文脈で提示)
  a: 正解 (読みはひらがな、書きは漢字)
  grade: 学年
*/

const questionData = [
    // --- 小4レベル ---
    { id: 1, grade: 4, type: 'read', q: '不老長寿', a: 'ふろうちょうじゅ' },
    { id: 2, grade: 4, type: 'read', q: '意気投合', a: 'いきとうごう' },
    { id: 3, grade: 4, type: 'write', q: 'カンレイ前線', a: '寒冷' },
    { id: 4, grade: 4, type: 'write', q: '牛の乳をシボる', a: '搾' },

    // --- 小5レベル ---
    { id: 5, grade: 5, type: 'read', q: '典型的な例', a: 'てんけい' },
    { id: 6, grade: 5, type: 'read', q: '清潔な服', a: 'せいけつ' },
    { id: 7, grade: 5, type: 'write', q: 'ソウゴウ的に判断する', a: '総合' },
    { id: 8, grade: 5, type: 'write', q: 'エキタイ燃料', a: '液体' },

    // --- 小6・受験レベル ---
    { id: 9, grade: 6, type: 'read', q: '権謀術数', a: 'けんぼうじゅっすう' },
    { id: 10, grade: 6, type: 'read', q: '生返事をする', a: 'なまへんじ' }, // 訓読み注意
    { id: 11, grade: 6, type: 'write', q: 'ハイセツ物を処理する', a: '排泄' },
    { id: 12, grade: 6, type: 'write', q: 'カンケツセンが吹き出す', a: '間欠泉' },
];
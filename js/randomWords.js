const randomWordsKey = "firework_random_words";

// 从 URL 中获取参数
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}
// 从 localStorage 加载祝福语
function loadRandomWords() {
    let storedWords = localStorage.getItem(randomWordsKey);

    let result = storedWords ? JSON.parse(storedWords) : ["新年快乐", "恭喜发财"];
    // 处理 URL 参数 q
    const q = getQueryParam("q");

    if (q) {
        const newWords = q.split(/[,，]/).map((word) => word.trim());
        result = [];
        newWords.forEach((word) => {
            if (word && !result.includes(word)) {
                result.push(word);
            }
        });
    }
    return result;
}

// 保存祝福语到 localStorage
function saveRandomWords(words) {
    localStorage.setItem(randomWordsKey, JSON.stringify(words));
}

// 初始化祝福语
let randomWords = loadRandomWords();

// 更新祝福语
function updateRandomWords(newWord) {
    if (newWord && !randomWords.includes(newWord)) {
        randomWords.push(newWord);
        saveRandomWords(randomWords);
        alert("文字烟花添加成功！");
    }
}

// 获取所有祝福语
function getAllRandomWords() {
    return randomWords;
}

// 重置应用程序
function resetApplication() {
    localStorage.clear();
    alert("设置项已重置！");
}

// 添加事件监听器到重置按钮
document.querySelector(".setting-reset").addEventListener("click", resetApplication);

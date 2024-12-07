// 简单的日志函数
function log(message) {
    console.log('TTS Extension:', message);
}

// 语音合成对象
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;

// 创建 TTS 按钮
function createTTSButton(articleId) {
    const button = document.createElement('button');
    button.className = 'tts-button';
    button.title = 'Text to Speech';
    button.dataset.articleId = articleId;
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>
        </svg>`;
    return button;
}

// 为文章添加 TTS 按钮
function addTTSButtonToArticle(article) {
    const header = article.querySelector('.flux_header');
    if (!header) return;

    const button = createTTSButton(article.getAttribute('id'));
    header.appendChild(button);
}

// 停止当前播放的语音
function stopSpeaking() {
    if (currentUtterance) {
        speechSynthesis.cancel();
        currentUtterance = null;
    }
}

// 开始朗读文本
function startSpeaking(text, button) {
    // 如果已经在播放，就停止
    if (currentUtterance) {
        stopSpeaking();
        // 如果点击的是当前正在播放的按钮，就不要重新开始播放
        if (button.classList.contains('playing')) {
            button.classList.remove('playing');
            return;
        }
    }

    // 创建新的语音实例
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 从按钮的 data 属性获取配置
    utterance.lang = button.dataset.ttsLang || 'zh-CN';
    utterance.rate = parseFloat(button.dataset.ttsRate) || 1.0;
    utterance.pitch = parseFloat(button.dataset.ttsPitch) || 1.0;
    utterance.volume = parseFloat(button.dataset.ttsVolume) || 1.0;

    // 监听语音结束事件
    utterance.onend = () => {
        button.classList.remove('playing');
        currentUtterance = null;
        log('Speech finished');
    };

    // 监听语音错误事件
    utterance.onerror = (event) => {
        button.classList.remove('playing');
        currentUtterance = null;
        log('Speech error:', event.error);
    };

    // 开始播放
    currentUtterance = utterance;
    button.classList.add('playing');
    speechSynthesis.speak(utterance);
}

// 初始化函数
function initializeTTS() {
    // 检查浏览器是否支持语音合成
    if (!speechSynthesis) {
        log('Error: Speech synthesis not supported');
        return;
    }

    // 确保通知元素存在
    const notification = document.getElementById('notification');
    if (!notification) {
        log('Error: Notification element not found');
        return;
    }

    // 确保关闭按钮存在
    const closeButton = notification.querySelector('a.close');
    if (!closeButton) {
        log('Error: Close button not found');
        return;
    }

    // 为现有文章添加 TTS 按钮
    document.querySelectorAll('.flux').forEach(addTTSButtonToArticle);

    // 监听新文章的加载
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.classList && node.classList.contains('flux')) {
                    addTTSButtonToArticle(node);
                }
            });
        });
    });

    // 观察文章列表的变化
    const stream = document.getElementById('stream');
    if (stream) {
        observer.observe(stream, { childList: true });
    }

    // 添加按钮点击事件处理
    document.addEventListener('click', (event) => {
        const button = event.target.closest('.tts-button');
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();

        // 获取文章内容
        const article = button.closest('.flux');
        if (!article) {
            log('Error: Article element not found');
            return;
        }

        // 移除其他按钮的播放状态
        document.querySelectorAll('.tts-button.playing').forEach(btn => {
            if (btn !== button) {
                btn.classList.remove('playing');
                stopSpeaking();
            }
        });

        // 获取文章文本内容
        const content = article.querySelector('.content');
        if (!content) {
            log('Error: Content element not found');
            return;
        }

        // 获取纯文本内容（移除 HTML 标签）
        const text = content.innerText.trim();
        
        // 开始朗读
        startSpeaking(text, button);
    });

    log('TTS Extension initialized successfully');
}

// 记录脚本加载
log('Script loaded');
log('Document readyState: ' + document.readyState);

// 等待 FreshRSS 主初始化完成
const initInterval = setInterval(() => {
    if (document.readyState === 'complete' && document.getElementById('notification')) {
        clearInterval(initInterval);
        // 给 FreshRSS 一点时间完成其他初始化
        setTimeout(() => {
            log('Starting TTS initialization');
            initializeTTS();
        }, 1000);
    }
}, 100);

// 错误处理
window.addEventListener('error', (event) => {
    log('Error occurred: ' + event.message);
    log('Error source: ' + event.filename);
    log('Error line: ' + event.lineno);
});

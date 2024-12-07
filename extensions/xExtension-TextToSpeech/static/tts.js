// 日志函数
function log(...args) {
    console.log('TTS Extension:', ...args);
}

// 语音合成对象
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let baiduToken = null;

// 获取百度访问令牌
async function getBaiduToken(apiKey, secretKey) {
    try {
        const url = new URL('./index.php', window.location.href);
        url.searchParams.set('c', 'TextToSpeech');
        url.searchParams.set('a', 'baiduToken');
        url.searchParams.set('api_key', apiKey);
        url.searchParams.set('secret_key', secretKey);
        
        log('请求百度访问令牌, URL:', url.toString());
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            const errorText = await response.text();
            log('获取令牌失败:', errorText);
            throw new Error(`获取令牌失败: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        log('获取令牌响应:', JSON.stringify(data, null, 2));
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        if (!data.access_token) {
            throw new Error('响应中没有访问令牌');
        }
        
        log('成功获取访问令牌');
        return data.access_token;
    } catch (error) {
        log('获取百度访问令牌失败:', error);
        throw error;
    }
}

// 使用百度语音合成
async function speakBaidu(text, button) {
    try {
        const apiKey = button.getAttribute('data-tts-api-key');
        const secretKey = button.getAttribute('data-tts-secret-key');
        
        log('API配置:', { apiKey: !!apiKey, secretKey: !!secretKey });
        
        if (!apiKey || !secretKey) {
            throw new Error('未配置百度语音API密钥');
        }

        const token = await getBaiduToken(apiKey, secretKey);
        
        const url = new URL('./index.php', window.location.href);
        url.searchParams.set('c', 'TextToSpeech');
        url.searchParams.set('a', 'baiduSynthesize');
        url.searchParams.set('token', token);
        url.searchParams.set('text', text);
        
        log('请求语音合成, URL:', url.toString());
        const response = await fetch(url.toString());
        
        if (!response.ok) {
            const errorText = await response.text();
            log('语音合成失败:', errorText);
            throw new Error(`语音合成失败: ${response.status} - ${errorText}`);
        }
        
        const contentType = response.headers.get('content-type');
        log('响应内容类型:', contentType);
        
        if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            log('语音合成返回错误:', errorData);
            throw new Error(errorData.error || '语音合成失败');
        }

        const audioBlob = await response.blob();
        log('获取到音频数据，大小:', audioBlob.size, '字节');
        
        if (audioBlob.size === 0) {
            throw new Error('获取到的音频数据为空');
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        currentUtterance = audio;
        button.classList.add('playing');
        
        audio.onended = () => {
            button.classList.remove('playing');
            URL.revokeObjectURL(audioUrl);
            currentUtterance = null;
            log('音频播放完成');
        };
        
        audio.onerror = (e) => {
            const error = e.target.error;
            log('音频播放失败:', error ? error.message : '未知错误');
            button.classList.remove('playing');
            URL.revokeObjectURL(audioUrl);
            currentUtterance = null;
        };
        
        log('开始播放音频...');
        await audio.play();
    } catch (error) {
        log('百度语音合成错误:', error);
        button.classList.remove('playing');
        throw error;
    }
}

// 使用浏览器原生语音合成
function speakBrowser(text, button) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 验证并设置语音参数，使用默认值作为后备
    utterance.lang = button.getAttribute('data-tts-lang') || 'zh-CN';
    
    // 速率范围：0.1 到 10
    const rate = parseFloat(button.getAttribute('data-tts-rate'));
    utterance.rate = (!isNaN(rate) && isFinite(rate)) ? Math.max(0.1, Math.min(10, rate)) : 1.0;
    
    // 音调范围：0 到 2
    const pitch = parseFloat(button.getAttribute('data-tts-pitch'));
    utterance.pitch = (!isNaN(pitch) && isFinite(pitch)) ? Math.max(0, Math.min(2, pitch)) : 1.0;
    
    // 音量范围：0 到 1
    const volume = parseFloat(button.getAttribute('data-tts-volume'));
    utterance.volume = (!isNaN(volume) && isFinite(volume)) ? Math.max(0, Math.min(1, volume)) : 1.0;

    utterance.onend = () => {
        button.classList.remove('playing');
        currentUtterance = null;
    };

    utterance.onerror = (event) => {
        button.classList.remove('playing');
        currentUtterance = null;
        log('语音合成错误:', event.error);
    };

    currentUtterance = utterance;
    button.classList.add('playing');
    speechSynthesis.speak(utterance);
}

// 开始朗读文本
async function startSpeaking(text, button) {
    // 如果已经在播放，就停止
    if (currentUtterance) {
        stopSpeaking();
        // 如果点击的是当前正在播放的按钮，就不要重新开始播放
        if (button.classList.contains('playing')) {
            button.classList.remove('playing');
            return;
        }
    }

    // 移除其他按钮的播放状态
    document.querySelectorAll('.tts-button.playing').forEach(btn => {
        if (btn !== button) {
            btn.classList.remove('playing');
        }
    });

    // 根据选择的服务进行语音合成
    const service = button.getAttribute('data-tts-service');
    log('使用语音服务:', service);
    log('按钮属性:', {
        service: button.getAttribute('data-tts-service'),
        lang: button.getAttribute('data-tts-lang'),
        rate: button.getAttribute('data-tts-rate'),
        pitch: button.getAttribute('data-tts-pitch'),
        volume: button.getAttribute('data-tts-volume')
    });
    
    if (service === 'baidu') {
        await speakBaidu(text, button);
    } else {
        speakBrowser(text, button);
    }
}

// 停止当前播放的语音
function stopSpeaking() {
    if (currentUtterance) {
        speechSynthesis.cancel();
        currentUtterance = null;
    }
}

// 创建 TTS 按钮
function createTTSButton(articleId) {
    const button = document.createElement('button');
    button.className = 'tts-button';
    button.title = 'Text to Speech';
    button.setAttribute('data-article-id', articleId);
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

// 初始化函数
function initializeTTS() {
    // 检查浏览器是否支持语音合成
    if (!speechSynthesis) {
        log('Error: Speech synthesis not supported');
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

        // 获取文章文本内容
        const content = article.querySelector('.content');
        if (!content) {
            log('Error: Content element not found');
            return;
        }

        // 获取纯文本内容（移除 HTML 标签）
        const text = content.innerText.trim();
        
        // 开始朗读
        startSpeaking(text, button).catch((error) => {
            log('TTS处理错误:', error);
            alert('语音合成失败: ' + error.message);
        });
    });

    log('TTS Extension initialized successfully');
}

// 记录脚本加载
log('TTS Extension script loaded');
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

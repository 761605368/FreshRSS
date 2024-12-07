// 日志函数
function log(...args) {
    console.log('TTS Extension:', ...args);
}

// 当前播放的音频
let currentUtterance = null;
let speechSynthesis = window.speechSynthesis;

// 获取配置
function getConfig() {
    const configElement = document.getElementById('tts-config');
    if (!configElement) {
        log('未找到配置元素');
        return {};
    }
    
    try {
        const config = JSON.parse(configElement.textContent);
        log('成功解析配置:', config);
        return config;
    } catch (error) {
        log('解析配置失败:', error);
        log('配置内容:', configElement.textContent);
        return {};
    }
}

// 初始化TTS功能
function initTTS() {
    log('Starting TTS initialization');
    
    // 检查是否已经初始化
    if (document.querySelector('.tts-button')) {
        log('TTS buttons already initialized');
        return;
    }
    
    // 获取配置
    const config = getConfig();
    log('TTS配置:', config);
    
    // 获取所有按钮占位符
    const titlePlaceholders = document.querySelectorAll('.tts-button-placeholder.title');
    const contentPlaceholders = document.querySelectorAll('.tts-button-placeholder.content');
    
    log('找到标题占位符:', titlePlaceholders.length);
    log('找到内容占位符:', contentPlaceholders.length);
    
    // 为标题添加TTS按钮
    titlePlaceholders.forEach(placeholder => {
        const titleElement = placeholder.nextElementSibling;
        if (titleElement) {
            log('Adding button to title:', titleElement.textContent);
            const titleButton = createTTSButton();
            setButtonAttributes(titleButton, config);
            placeholder.replaceWith(titleButton);
            
            titleButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTTSButtonClick(titleButton, titleElement);
            });
        }
    });
    
    // 为内容添加TTS按钮
    contentPlaceholders.forEach(placeholder => {
        const contentElement = placeholder.nextElementSibling;
        if (contentElement) {
            log('Adding button to content');
            const contentButton = createTTSButton();
            setButtonAttributes(contentButton, config);
            placeholder.replaceWith(contentButton);
            
            contentButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleTTSButtonClick(contentButton, contentElement);
            });
        }
    });
    
    log('TTS Extension initialized successfully');
}

// 设置按钮属性
function setButtonAttributes(button, config) {
    // 设置TTS服务
    button.setAttribute('data-tts-service', config.service || 'browser');
    
    // 如果是百度服务，设置API密钥
    if (config.service === 'baidu' && config.baiduApiKey && config.baiduSecretKey) {
        button.setAttribute('data-tts-api-key', config.baiduApiKey);
        button.setAttribute('data-tts-secret-key', config.baiduSecretKey);
    }
    
    // 设置语音参数
    button.setAttribute('data-tts-lang', config.lang || 'zh-CN');
    button.setAttribute('data-tts-rate', config.rate || '1');
    button.setAttribute('data-tts-pitch', config.pitch || '1');
    button.setAttribute('data-tts-volume', config.volume || '1');
}

// 创建TTS按钮
function createTTSButton() {
    const button = document.createElement('button');
    button.className = 'tts-button';
    button.setAttribute('title', 'Text to Speech');
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>`;
    return button;
}

// 处理TTS按钮点击
async function handleTTSButtonClick(button, element) {
    try {
        if (button.classList.contains('playing')) {
            stopSpeaking();
            return;
        }
        
        // 获取文章内容
        let text;
        const article = element.closest('article');
        if (!article) {
            log('找不到文章元素');
            return;
        }

        // 如果是标题按钮，获取标题文本
        if (button.closest('.title')) {
            const titleElement = article.querySelector('h1');
            text = titleElement ? titleElement.textContent.trim() : '';
        } else {
            // 如果是内容按钮，获取文章主体内容
            const contentElement = article.querySelector('.content');
            text = contentElement ? contentElement.textContent.trim() : '';
        }
        
        if (!text) {
            log('内容为空');
            return;
        }
        
        log('文本长度:', text.length);
        await startSpeaking(text, button);
    } catch (error) {
        log('TTS处理错误:', error);
        alert('语音合成失败: ' + error.message);
    }
}

// 停止当前播放
function stopSpeaking() {
    if (currentUtterance) {
        if (currentUtterance instanceof Audio) {
            currentUtterance.pause();
            currentUtterance.currentTime = 0;
        } else {
            speechSynthesis.cancel();
        }
        currentUtterance = null;
        
        document.querySelectorAll('.tts-button.playing').forEach(button => {
            button.classList.remove('playing');
        });
    }
}

// 开始语音播放
async function startSpeaking(text, button) {
    if (currentUtterance) {
        stopSpeaking();
    }
    
    const service = button.getAttribute('data-tts-service');
    log('使用语音服务:', service);
    
    if (service === 'baidu') {
        await speakBaidu(text, button);
    } else {
        speakBrowser(text, button);
    }
}

// 使用浏览器原生语音合成
function speakBrowser(text, button) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // 设置语音参数
    utterance.lang = button.getAttribute('data-tts-lang') || 'zh-CN';
    utterance.rate = parseFloat(button.getAttribute('data-tts-rate')) || 1;
    utterance.pitch = parseFloat(button.getAttribute('data-tts-pitch')) || 1;
    utterance.volume = parseFloat(button.getAttribute('data-tts-volume')) || 1;
    
    utterance.onend = () => {
        button.classList.remove('playing');
        currentUtterance = null;
        log('浏览器TTS播放完成');
    };
    
    utterance.onerror = (event) => {
        log('浏览器TTS错误:', event.error);
        button.classList.remove('playing');
        currentUtterance = null;
    };
    
    currentUtterance = utterance;
    button.classList.add('playing');
    speechSynthesis.speak(utterance);
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
        const audio = new Audio();
        
        audio.preload = 'auto';
        
        // Set up event handlers before setting the source
        audio.onloadedmetadata = () => {
            log('音频时长:', audio.duration, '秒');
        };

        audio.ontimeupdate = () => {
            log('当前播放时间:', audio.currentTime, '秒');
        };

        audio.oncanplaythrough = async () => {
            try {
                currentUtterance = audio;
                button.classList.add('playing');
                log('音频加载完成，开始播放...');
                await audio.play();
            } catch (error) {
                log('播放音频失败:', error);
                button.classList.remove('playing');
                URL.revokeObjectURL(audioUrl);
                currentUtterance = null;
            }
        };
        
        audio.onended = () => {
            const playbackTime = audio.currentTime;
            log(`百度TTS播放完成，播放时长: ${playbackTime} 秒`);
            button.classList.remove('playing');
            URL.revokeObjectURL(audioUrl);
            currentUtterance = null;
        };
        
        audio.onerror = (e) => {
            const error = e.target.error;
            log('百度TTS播放失败:', error ? error.message : '未知错误');
            button.classList.remove('playing');
            URL.revokeObjectURL(audioUrl);
            currentUtterance = null;
        };
        
        log('加载音频...');
        audio.src = audioUrl;
    } catch (error) {
        log('百度语音合成错误:', error);
        button.classList.remove('playing');
        throw error;
    }
}

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

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    log('Document readyState:', document.readyState);
    document.addEventListener('DOMContentLoaded', initTTS);
} else {
    log('Document readyState:', document.readyState);
    initTTS();
}

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
		const fluxElement = element.closest('.flux');
        if (!fluxElement) {
            log('找不到文章');
            return;
        }

		const contentElement = fluxElement.querySelector('.content');
		text = contentElement ? contentElement.textContent.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fa5，。！；：、？]+/g, '')
			.replace(/\s+/g, ' ')	: '';

        if (!text) {
            log('内容为空');
            return;
        }

        log('文本长度:', text.length);
        log('文本:', text);
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

// 百度语音合成
async function speakBaidu(text, button) {
    try {
        const apiKey = button.getAttribute('data-tts-api-key');
        const secretKey = button.getAttribute('data-tts-secret-key');
        const lang = button.getAttribute('data-tts-lang');

        log('API配置:', { apiKey: !!apiKey, secretKey: !!secretKey });

        if (!apiKey || !secretKey) {
            throw new Error('未配置百度语音API密钥');
        }

        const token = await getBaiduToken(apiKey, secretKey);

        const url = new URL('./index.php', window.location.href);
        url.searchParams.set('c', 'TextToSpeech');
        url.searchParams.set('a', 'baiduSynthesize');

        const formData = new FormData();
        formData.append('text', text);
        formData.append('token', token);
        formData.append('lang', lang);
        formData.append('_csrf', window.context.csrf);  // 添加CSRF令牌

        log('请求语音合成, URL:', url.toString());
        const response = await fetch(url.toString(), {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            log('语音合成失败:', errorText);
            throw new Error(errorText);
        }

        const blob = await response.blob();
        if (blob.size === 0) {
            throw new Error('返回的音频数据为空');
        }

        log('成功获取音频数据，大小:', blob.size, 'bytes');
        const audio = new Audio(URL.createObjectURL(blob));
        audio.preload = 'auto';

        // Set up event handlers before setting the source
        audio.onloadedmetadata = () => {
            log('音频时长:', audio.duration, '秒');
        };

        audio.ontimeupdate = () => {
            log('当前播放时间:', audio.currentTime, '秒');
        };

        audio.oncanplaythrough = async () => {
            log('音频已加载，开始播放');
            button.classList.add('playing');
            try {
                await audio.play();
            } catch (error) {
                log('播放失败:', error);
                button.classList.remove('playing');
                URL.revokeObjectURL(blob);
                currentUtterance = null;
            }
        };

        audio.onended = () => {
            const playbackTime = audio.currentTime;
            log(`百度TTS播放完成，播放时长: ${playbackTime} 秒`);
            button.classList.remove('playing');
            URL.revokeObjectURL(blob);
            currentUtterance = null;
        };

        audio.onerror = (e) => {
            const error = e.target.error;
            log('百度TTS播放失败:', error ? error.message : '未知错误');
            button.classList.remove('playing');
            URL.revokeObjectURL(blob);
            currentUtterance = null;
        };

        log('加载音频...');
        audio.src = URL.createObjectURL(blob);
        currentUtterance = audio;
    } catch (error) {
        log('百度TTS错误:', error);
        button.classList.remove('playing');
        alert(error.message);
    }
}

// 获取百度访问令牌
async function getBaiduToken(apiKey, secretKey) {
    try {
        const url = new URL('./index.php', window.location.href);
        url.searchParams.set('c', 'TextToSpeech');
        url.searchParams.set('a', 'baiduToken');

        const formData = new FormData();
        formData.append('api_key', apiKey);
        formData.append('secret_key', secretKey);
        formData.append('_csrf', window.context.csrf);  // 添加CSRF令牌

        log('请求百度访问令牌, URL:', url.toString());
        log('API Key:', apiKey.substring(0, 4) + '...');

        const response = await fetch(url.toString(), {
            method: 'POST',
            body: formData
        });

        const responseText = await response.text();
        log('原始响应:', responseText);

        if (!response.ok) {
            throw new Error(`HTTP错误: ${response.status} - ${responseText}`);
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            log('解析JSON失败:', e);
            throw new Error('服务器响应格式错误: ' + responseText);
        }

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
        throw new Error('获取访问令牌失败: ' + error.message);
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

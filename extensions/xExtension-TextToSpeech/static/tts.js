// 日志函数
function log(...args) {
    console.log('TTS Extension:', ...args);
}

// 当前播放的音频
let currentUtterance = null;
let currentAudio = null;  // 添加全局变量来存储当前音频对象
let currentButton = null;  // 添加全局变量来存储当前播放按钮
let speechSynthesis = window.speechSynthesis;

// 缓存数据库
const DB_NAME = 'TTSCache';
const STORE_NAME = 'audioCache';
let db;

// 初始化数据库
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('taskId', 'taskId', { unique: false });
            }
        };
    });
}

// 生成文本的哈希值
function generateHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

// 下载音频并缓存
async function downloadAndCacheAudio(url, hash) {
    try {
        log('开始下载音频:', url);
        await saveToCache(hash, null, {
            url: url
        });
        return url;
    } catch (error) {
        log('下载音频失败:', error);
        throw error;
    }
}

// 创建代理音频URL
function createProxyUrl(url) {
    const proxyUrl = new URL('./index.php', window.location.href);
    proxyUrl.searchParams.set('c', 'TextToSpeech');
    proxyUrl.searchParams.set('a', 'playAudio');
    proxyUrl.searchParams.set('url', url);
    return proxyUrl.toString();
}

// 创建音频播放器
function createAudioPlayer(url) {
    const audio = new Audio();
    const proxyUrl = createProxyUrl(url);
    log('使用代理URL播放:', proxyUrl);
    audio.src = proxyUrl;
    return audio;
}

// 保存音频到缓存
async function saveToCache(hash, taskId, audioInfo) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({
            hash,
            taskId,
            audioInfo,
            timestamp: Date.now()
        });

        request.onsuccess = () => {
            log('音频信息已缓存, hash:', hash);
            resolve();
        };
        request.onerror = (error) => {
            log('缓存音频信息失败:', error);
            reject(request.error);
        };
    });
}

// 从缓存获取音频
async function getFromCache(hash) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(hash);

        request.onsuccess = () => {
            const result = request.result;
            if (result && result.audioInfo) {
                log('从缓存获取到音频信息, hash:', hash);
                resolve(result);
            } else {
                log('缓存中没有找到音频信息, hash:', hash);
                resolve(null);
            }
        };
        request.onerror = (error) => {
            log('获取缓存失败:', error);
            reject(request.error);
        };
    });
}

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
async function initTTS() {
    log('Starting TTS initialization');

    // 检查是否已经初始化
    if (document.querySelector('.tts-button')) {
        log('TTS buttons already initialized');
        return;
    }

    // 获取配置
    const config = getConfig();
    log('TTS配置:', config);

    // 初始化TTS按钮
    initTTSButtons();
}

// 初始化TTS按钮
function initTTSButtons() {
    log('Starting TTS initialization');
    const config = getConfig();
    if (!config) {
        log('无法获取TTS配置');
        return;
    }
    log('TTS配置:', config);

    // 处理标题占位符
    const titlePlaceholders = document.querySelectorAll('.tts-button-placeholder.title');
    log('找到标题占位符:', titlePlaceholders.length);

    titlePlaceholders.forEach(placeholder => {
        const titleElement = placeholder.closest('.flux').querySelector('.title a');
        if (titleElement) {
            const titleButton = document.createElement('button');
            titleButton.className = 'tts-button';
            titleButton.dataset.text = titleElement.textContent.trim();
            setButtonAttributes(titleButton, config);
            placeholder.replaceWith(titleButton);

            titleButton.addEventListener('click', handleTTSButtonClick);
        }
    });

    // 处理内容占位符
    const contentPlaceholders = document.querySelectorAll('.tts-button-placeholder.content');
    log('找到内容占位符:', contentPlaceholders.length);

    contentPlaceholders.forEach(placeholder => {
        const contentElement = placeholder.closest('.flux').querySelector('.content');
        log('Adding button to content');
        if (contentElement) {
            const contentButton = document.createElement('button');
            contentButton.className = 'tts-button';
            contentButton.dataset.text = contentElement.textContent.trim();
            setButtonAttributes(contentButton, config);
            placeholder.replaceWith(contentButton);

            contentButton.addEventListener('click', handleTTSButtonClick);
        }
    });

    log('TTS Extension initialized successfully');
}

// 设置按钮属性
function setButtonAttributes(button, config) {
    button.setAttribute('title', '朗读文本');
    button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>`;
    
    // 设置TTS配置属性
    button.setAttribute('data-tts-rate', config.rate || '1');
    button.setAttribute('data-tts-pitch', config.pitch || '1');
    button.setAttribute('data-tts-volume', config.volume || '1');
    button.setAttribute('data-tts-lang', config.lang || 'zh-CN');
    button.setAttribute('data-tts-service', config.service || 'baidu');
}

// 处理TTS按钮点击
async function handleTTSButtonClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget;
    log('按钮点击 - 当前状态:', currentAudio ? (currentAudio.paused ? '已暂停' : '正在播放') : '无音频');
    
    try {
        // 如果当前有音频在播放或暂停
        if (currentAudio && currentButton) {
            // 如果点击的是当前按钮
            if (button === currentButton) {
                log('点击当前按钮 - 音频状态:', currentAudio.paused ? '已暂停' : '正在播放');
                if (currentAudio.paused) {
                    // 如果是暂停状态，恢复播放
                    log('当前音频已暂停，尝试恢复播放');
                    await resumeSpeaking();
                } else {
                    // 如果正在播放，暂停
                    log('当前音频正在播放，尝试暂停');
                    pauseSpeaking();
                }
                return;
            } else {
                // 如果点击的是其他按钮，停止当前播放
                log('点击了新按钮，停止当前播放');
                stopSpeaking();
            }
        }

        // 只有在没有当前音频，或者点击了新按钮时才开始新的播放
        const text = button.dataset.text;
        if (!text) {
            throw new Error('没有找到要朗读的文本');
        }

        log('准备朗读文本:', text.substring(0, 50) + '...');
        // 开始新的播放
        currentButton = button;
        await startSpeaking(text, button);

    } catch (error) {
        log('TTS处理错误:', error);
        stopSpeaking();
        button.setAttribute('title', '朗读失败: ' + error.message);
    }
}

// 暂停播放
function pauseSpeaking() {
    log('尝试暂停播放');
    if (currentAudio && currentButton) {
        if (!currentAudio.paused) {
            currentAudio.pause();
            currentButton.classList.remove('playing');
            currentButton.setAttribute('title', '继续播放');
            log('已暂停播放');
        } else {
            log('音频已经是暂停状态');
        }
    } else {
        log('没有可暂停的音频');
    }
}

// 恢复播放
async function resumeSpeaking() {
    log('尝试恢复播放');
    if (currentAudio && currentButton) {
        if (currentAudio.paused) {
            try {
                await currentAudio.play();
                currentButton.classList.add('playing');
                currentButton.setAttribute('title', '点击暂停');
                log('已恢复播放');
            } catch (error) {
                log('恢复播放失败:', error);
                stopSpeaking();
            }
        } else {
            log('音频已经在播放中');
        }
    } else {
        log('没有可恢复的音频');
    }
}

// 停止播放
function stopSpeaking() {
    log('尝试停止播放');
    if (currentAudio) {
        try {
            currentAudio.pause();
            currentAudio.currentTime = 0;  // 重置播放位置
            currentAudio.onloadedmetadata = null;
            currentAudio.oncanplaythrough = null;
            currentAudio.onended = null;
            currentAudio.onerror = null;
            currentAudio.onpause = null;
            currentAudio.onplay = null;
            currentAudio.src = '';
            currentAudio.remove();
            currentAudio = null;
            log('已清理音频对象');
        } catch (error) {
            log('清理音频对象时出错:', error);
        }
    }

    if (currentButton) {
        currentButton.classList.remove('loading', 'playing');
        currentButton.setAttribute('title', '朗读文本');
        currentButton = null;
        log('已重置按钮状态');
    }
}

// 从URL播放音频
async function playAudioFromUrl(audioUrl, button) {
    try {
        const proxyUrl = createProxyUrl(audioUrl);
        log('使用代理URL播放:', proxyUrl);
        
        const audio = new Audio();
        setupAudioEvents(audio, button);
        
        // 设置音频源并开始加载
        audio.src = proxyUrl;
        currentAudio = audio;  // 设置当前音频
        
        // 等待音频加载完成
        await new Promise((resolve, reject) => {
            audio.addEventListener('error', reject);
            audio.addEventListener('canplaythrough', resolve, { once: true });
        });
        
    } catch (error) {
        log('播放音频失败:', error);
        stopSpeaking();
        throw error;
    }
}

// 设置音频事件
function setupAudioEvents(audio, button) {
    audio.preload = 'auto';

    let playStarted = false;  // 添加标志来防止重复播放

    audio.onloadedmetadata = () => {
        if (audio === currentAudio) {
            log('音频时长:', audio.duration, '秒');
        }
    };

    audio.oncanplaythrough = async () => {
        if (!playStarted && audio === currentAudio) {  // 只有当这个audio是当前的audio时才播放
            log('音频已加载，开始播放');
            button.classList.remove('loading');
            button.classList.add('playing');
            button.setAttribute('title', '点击暂停');
            playStarted = true;
            try {
                await audio.play();
            } catch (error) {
                log('播放失败:', error);
                stopSpeaking();
            }
        }
    };

    audio.onended = () => {
        if (audio === currentAudio) {  // 只处理当前音频的事件
            log('播放完成');
            stopSpeaking();
        }
    };

    audio.onerror = (e) => {
        if (audio === currentAudio) {  // 只处理当前音频的事件
            const error = e.target.error;
            log('播放错误:', error ? error.message : '未知错误');
            stopSpeaking();
        }
    };

    audio.onpause = () => {
        if (audio === currentAudio && !audio.ended) {  // 只处理当前音频的非结束暂停事件
            log('音频已暂停，当前时间:', audio.currentTime);
            button.classList.remove('playing');
            button.setAttribute('title', '继续播放');
        }
    };

    audio.onplay = () => {
        if (audio === currentAudio) {  // 只处理当前音频的事件
            log('音频开始/继续播放，当前时间:', audio.currentTime);
            button.classList.add('playing');
            button.setAttribute('title', '点击暂停');
        } else {
            // 如果不是当前音频，立即暂停
            log('非当前音频尝试播放，已阻止');
            audio.pause();
        }
    };
}

// 开始语音播放
async function startSpeaking(text, button) {
    try {
        // 确保停止之前的播放
        stopSpeaking();
        
        const config = getConfig();
        if (!config) {
            throw new Error('无法获取TTS配置');
        }

        log('使用语音服务:', config.service);
        
        if (config.service === 'baidu') {
            button.classList.add('loading');
            currentButton = button;  // 立即设置当前按钮
            const hash = generateHash(text);
            
            // 尝试从缓存获取
            const cachedAudio = await getFromCache(hash);
            if (cachedAudio) {
                log('从缓存获取到音频信息, hash:', hash);
                log('使用缓存的音频');
                await playAudioFromUrl(cachedAudio.audioInfo.url, button);
                return;
            }

            // 如果缓存中没有，则请求新的音频
            const audioUrl = await requestBaiduTTS(text);
            if (!audioUrl) {
                throw new Error('获取音频URL失败');
            }

            // 缓存音频信息
            await cacheAudio(hash, audioUrl);
            
            // 播放音频
            await playAudioFromUrl(audioUrl, button);
        } else {
            throw new Error('不支持的语音服务');
        }
    } catch (error) {
        log('语音合成错误:', error);
        stopSpeaking();
        throw error;
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
    document.addEventListener('DOMContentLoaded', async () => {
        await initDatabase();
        initTTS();
    });
} else {
    log('Document readyState:', document.readyState);
    initDatabase().then(() => initTTS());
}

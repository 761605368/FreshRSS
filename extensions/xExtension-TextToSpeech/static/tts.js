// 日志函数
function log(...args) {
    console.log('TTS Extension:', ...args);
}

// 当前播放的音频
let currentUtterance = null;
let currentAudio = null;  // 添加全局变量来存储当前音频对象
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

// 保存音频到缓存
async function saveToCache(hash, taskId, audioUrl) {  
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({
            hash,
            taskId,
            audioUrl,  
            timestamp: Date.now()
        });

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
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
            if (result && result.audioUrl) {  
                resolve(result);
            } else {
                resolve(null);
            }
        };
        request.onerror = () => reject(request.error);
    });
}

// 下载音频并缓存
async function downloadAndCacheAudio(url, hash) {
    await saveToCache(hash, null, url);
    return url;
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
        // 如果正在播放，则停止
        if (button.classList.contains('playing')) {
            stopSpeaking();
            return;
        }

        // 如果其他按钮正在播放，先停止它
        const playingButton = document.querySelector('.tts-button.playing');
        if (playingButton && playingButton !== button) {
            stopSpeaking();
        }

        // 获取文章内容
        let text;
		const fluxElement = element.closest('.flux');
        if (!fluxElement) {
            log('找不到文章');
            return;
        }

		const contentElement = fluxElement.querySelector('.content');
		text = contentElement ? contentElement.textContent.trim()	: '';

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
        speechSynthesis.cancel();
        currentUtterance = null;
    }
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;  // 重置播放位置
        currentAudio = null;
    }

    // 重置所有播放按钮的状态
    document.querySelectorAll('.tts-button.playing').forEach(button => {
        button.classList.remove('playing', 'loading');
        button.setAttribute('title', '朗读文本');
    });
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
        const config = getConfig();
        if (!config || !config.baiduApiKey || !config.baiduSecretKey) {
            throw new Error('请先配置百度API密钥');
        }

        // 检查缓存
        const hash = generateHash(text);
        const cached = await getFromCache(hash);
        
        if (cached && cached.audioUrl) {
            log('使用缓存的音频');
            const audio = new Audio();
            currentAudio = audio;
            setupAudioEvents(audio, button, cached.audioUrl);
            return;
        }

        button.classList.add('loading');
        button.setAttribute('title', '正在获取访问令牌...');

        // 获取访问令牌
        const token = await getBaiduToken(config.baiduApiKey, config.baiduSecretKey);
        if (!token) {
            throw new Error('获取访问令牌失败');
        }

        // 如果有缓存的任务ID，直接使用
        let taskId = cached?.taskId;
        
        if (!taskId) {
            // 创建合成任务
            button.setAttribute('title', '正在创建合成任务...');
            
            const createTaskUrl = new URL('./index.php', window.location.href);
            createTaskUrl.searchParams.set('c', 'TextToSpeech');
            createTaskUrl.searchParams.set('a', 'createTask');

            const createTaskData = new FormData();
            createTaskData.append('text', text);
            createTaskData.append('token', token);
            createTaskData.append('voice', config.voice || 0);
            createTaskData.append('_csrf', window.context.csrf);

            log('创建合成任务, URL:', createTaskUrl.toString());

            const createResponse = await fetch(createTaskUrl.toString(), {
                method: 'POST',
                body: createTaskData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!createResponse.ok) {
                const errorText = await createResponse.text();
                log('创建任务失败:', errorText);
                throw new Error('创建任务失败: ' + errorText);
            }

            const createResult = await createResponse.json();
            if (createResult.error) {
                throw new Error(createResult.error);
            }
            if (!createResult.task_id) {
                throw new Error('未获取到任务ID');
            }

            taskId = createResult.task_id;
            // 保存任务ID到缓存
            await saveToCache(hash, taskId, null);
        }

        log('获取到任务ID:', taskId);
        button.setAttribute('title', '正在合成音频...');

        // 轮询任务状态
        let retryCount = 0;
        const maxRetries = 30; // 最多等待30次，每次3秒

        while (retryCount < maxRetries) {
            const queryTaskUrl = new URL('./index.php', window.location.href);
            queryTaskUrl.searchParams.set('c', 'TextToSpeech');
            queryTaskUrl.searchParams.set('a', 'queryTask');

            const queryTaskData = new FormData();
            queryTaskData.append('token', token);
            queryTaskData.append('task_ids', taskId);
            queryTaskData.append('_csrf', window.context.csrf);

            log('查询任务状态, task_ids:', taskId);
            const queryResponse = await fetch(queryTaskUrl.toString(), {
                method: 'POST',
                body: queryTaskData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (!queryResponse.ok) {
                const errorText = await queryResponse.text();
                log('查询任务失败:', errorText);
                throw new Error('查询任务失败: ' + errorText);
            }

            const queryResult = await queryResponse.json();
            if (queryResult.error) {
                throw new Error(queryResult.error);
            }
            if (!queryResult.tasks_info) {
                throw new Error('响应中没有任务信息');
            }

            const taskInfo = queryResult.tasks_info[0];

            if (!taskInfo) {
                throw new Error('未找到任务信息');
            }

            log('任务状态:', taskInfo.task_status);

            if (taskInfo.task_status === 'Success') {
                const audioUrl = taskInfo.task_result?.speech_url;
                if (!audioUrl) {
                    throw new Error('未找到音频URL');
                }

                log('获取到音频URL:', audioUrl);  

                // 下载并缓存音频
                const audioBlob = await downloadAndCacheAudio(audioUrl, hash);
                
                // 创建音频对象并播放
                const audio = new Audio();
                currentAudio = audio;
                setupAudioEvents(audio, button, audioBlob);
                return;

            } else if (taskInfo.task_status === 'Failed') {
                throw new Error('合成任务失败: ' + (taskInfo.task_result?.err_msg || '未知错误'));
            }

            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        throw new Error('等待任务完成超时');

    } catch (error) {
        log('语音合成错误:', error);
        button.classList.remove('loading', 'playing');
        button.setAttribute('title', '语音合成失败: ' + error.message);
        throw error;
    }
}

// 设置音频事件
function setupAudioEvents(audio, button, audioUrl) {
    audio.preload = 'auto';

    audio.onloadedmetadata = () => {
        log('音频时长:', audio.duration, '秒');
    };

    audio.oncanplaythrough = async () => {
        log('音频已加载，开始播放');
        button.classList.remove('loading');
        button.classList.add('playing');
        try {
            await audio.play();
        } catch (error) {
            log('播放失败:', error);
            button.classList.remove('playing');
            currentAudio = null;
        }
    };

    audio.onended = () => {
        log('播放完成');
        button.classList.remove('playing');
        currentAudio = null;
        button.setAttribute('title', '朗读文本');
    };

    audio.onerror = (e) => {
        const error = e.target.error;
        log('播放错误:', error ? error.message : '未知错误');
        button.classList.remove('loading', 'playing');
        currentAudio = null;
        button.setAttribute('title', '朗读文本');
    };

    audio.src = audioUrl;
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

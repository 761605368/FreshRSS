// 日志函数
function log(...args) {
    console.log('TTS Extension:', ...args);
}

// 当前播放的音频
let currentUtterance = null;
let speechSynthesis = window.speechSynthesis;

// IndexedDB配置
const DB_NAME = 'TTSCache';
const STORE_NAME = 'audioCache';
let db = null;

// 初始化数据库
async function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);

        request.onerror = () => {
            log('数据库打开失败:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            log('数据库打开成功');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'hash' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('size', 'size', { unique: false });
                log('创建数据库存储空间');
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
    return Math.abs(hash).toString();
}

// 从缓存获取音频
async function getFromCache(hash) {
    if (!db) {
        log('数据库未初始化');
        return null;
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(hash);

        request.onsuccess = () => {
            const result = request.result;
            if (result && result.audioBlob) {
                log('从缓存获取到音频, hash:', hash);
                resolve(result);
            } else {
                log('缓存中未找到音频, hash:', hash);
                resolve(null);
            }
        };

        request.onerror = () => {
            log('读取缓存失败:', request.error);
            reject(request.error);
        };
    });
}

// 保存音频到缓存
async function saveToCache(hash, audioBlob) {
    if (!db) {
        log('数据库未初始化');
        return;
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // 清理旧缓存
        cleanOldCache().catch(error => log('清理旧缓存失败:', error));

        const request = store.put({
            hash: hash,
            audioBlob: audioBlob,
            timestamp: Date.now(),
            size: audioBlob.size
        });

        request.onsuccess = () => {
            log('音频已缓存, hash:', hash);
            resolve();
        };

        request.onerror = () => {
            log('缓存音频失败:', request.error);
            reject(request.error);
        };
    });
}

// 清理旧缓存
async function cleanOldCache() {
    const config = getConfig();
    const MAX_CACHE_SIZE = (config.cacheSize || 500) * 1024 * 1024; // 默认100MB
    const MAX_CACHE_AGE = (config.cacheDays || 365) * 24 * 60 * 60 * 1000; // 默认7天

    if (!db) return;

    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.openCursor();

    let totalSize = 0;
    const now = Date.now();
    const itemsToDelete = [];

    return new Promise((resolve, reject) => {
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                totalSize += cursor.value.size || 0;

                // 检查是否过期或总大小超限
                if (now - cursor.value.timestamp > MAX_CACHE_AGE || totalSize > MAX_CACHE_SIZE) {
                    itemsToDelete.push(cursor.value.hash);
                }
                cursor.continue();
            } else {
                // 删除过期或超限的缓存
                itemsToDelete.forEach(hash => {
                    store.delete(hash);
                });
                if (itemsToDelete.length > 0) {
                    log('清理了', itemsToDelete.length, '个缓存项');
                    log('缓存配置: ', {
                        最大缓存天数: config.cacheDays,
                        最大缓存大小: config.cacheSize + 'MB'
                    });
                }
                resolve();
            }
        };

        request.onerror = () => {
            log('清理缓存失败:', request.error);
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
	let config;
	try {
		config = JSON.parse(configElement.textContent);
		const userConfig = JSON.parse(localStorage.getItem('ttsConfig'));
		Object.assign(config, userConfig);
	} catch (error) {
		log('解析配置失败:', error);
	}

    log('成功解析配置:', config);
    return config;
}

// 保存配置
function saveConfig(config) {
    try {
        localStorage.setItem('ttsConfig', JSON.stringify(config));
        log('配置已保存');
    } catch (error) {
        log('保存配置失败:', error);
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
    const config = await getConfig();
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
        button.setAttribute('data-tts-voice', config.voice);
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
        // Check if audio is currently playing
        if (currentUtterance instanceof Audio) {
            const currentButton = document.querySelector('.tts-button.playing');

            // If clicking the same button that's currently playing
            if (currentButton === button) {
                if (currentUtterance.paused) {
                    // Resume playback
                    await currentUtterance.play();
                    button.classList.add('playing');
                    return;
                } else {
                    // Pause playback
                    currentUtterance.pause();
                    button.classList.remove('playing');
                    return;
                }
            } else {
                // Clicking a different button - stop current and play new
                stopSpeaking();
            }
        } else if (button.classList.contains('playing')) {
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
        text = contentElement ? contentElement.textContent.trim() : '';

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
            currentUtterance.src = ''; // Clear the source
            currentUtterance.load(); // Force reload to clear buffer
            currentUtterance.onended = null;
            currentUtterance.onpause = null;
            currentUtterance.onplay = null;
            currentUtterance.onerror = null;
        } else {
            speechSynthesis.cancel();
        }
        currentUtterance = null;

        // Remove playing class from all buttons
        document.querySelectorAll('.tts-button.playing').forEach(button => {
            button.classList.remove('playing', 'loading');
            button.setAttribute('title', '朗读文本');
        });
    }
}

// 开始语音播放
async function startSpeaking(text, button) {
    log('开始语音播放');

    // 确保停止之前的播放
    stopSpeaking();

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
		button.classList.remove('playing');
		if (autoPlayEnabled) {
			// 查找下一个可播放的文章
			log('查找下一个可播放的文章');
			const articles = Array.from(document.querySelectorAll('.flux'));
			const currentArticle = button.closest('.flux');
			const currentIndex = articles.indexOf(currentArticle);

			if (currentIndex >= 0 && currentIndex < articles.length - 1) {
				const nextArticle = articles[currentIndex + 1];
				const nextButton = nextArticle.querySelector('.tts-button');
				if (nextButton) {
					setTimeout(() => {
						nextButton.click();
					}, 1000); // 1秒后播放下一篇
				}
			}
		}
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
        const voice = parseInt(button.getAttribute('data-tts-voice') || '5118');

        log('API配置:', { apiKey: !!apiKey, secretKey: !!secretKey, voice });

        if (!apiKey || !secretKey) {
            throw new Error('未配置百度语音API密钥');
        }

        // 生成文本的哈希值
        const hash = generateHash(text);

        // 尝试从缓存获取
        const cachedAudio = await getFromCache(hash);
        if (cachedAudio) {
            log('使用缓存的音频');
            const audioUrl = URL.createObjectURL(cachedAudio.audioBlob);
            await playAudio(audioUrl, button, true);
            return;
        }

        button.classList.add('loading');
        button.setAttribute('title', '正在创建合成任务...');

        // 获取访问令牌
        const token = await getBaiduToken(apiKey, secretKey);
        if (!token) {
            throw new Error('获取访问令牌失败');
        }

        // 创建合成任务
        const createTaskUrl = new URL('./index.php', window.location.href);
        createTaskUrl.searchParams.set('c', 'TextToSpeech');
        createTaskUrl.searchParams.set('a', 'createTask');

        const createTaskData = new FormData();
        createTaskData.append('text', text);
        createTaskData.append('token', token);
        createTaskData.append('voice', voice);
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

        const taskId = createResult.task_id;
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

                // 下载音频数据并缓存
                log('下载音频数据');
				// 创建合成任务
				const downloadAudioDataUrl = new URL('./index.php', window.location.href);
				downloadAudioDataUrl.searchParams.set('c', 'TextToSpeech');
				downloadAudioDataUrl.searchParams.set('a', 'downloadAudio');

				const downloadAudioData = new FormData();
				downloadAudioData.append('url', audioUrl);
				downloadAudioData.append('_csrf', window.context.csrf);

				const audioResponse = await fetch(downloadAudioDataUrl.toString(), {
					method: 'POST',
					body: downloadAudioData,
					headers: {
						'X-Requested-With': 'XMLHttpRequest'
					}
				});
                if (!audioResponse.ok) {
                    throw new Error('下载音频失败');
                }

                const audioBlob = await audioResponse.blob();
                log('音频大小:', audioBlob.size, 'bytes');

                // 缓存音频数据
                await saveToCache(hash, audioBlob);

                // 创建本地URL并播放
                const localUrl = URL.createObjectURL(audioBlob);
                await playAudio(localUrl, button, true);
                return;
            } else if (taskInfo.task_status === 'Failed') {
                throw new Error('合成任务失败: ' + (taskInfo.task_result?.err_msg || '未知错误'));
            }

            // 等待3秒后重试
            await new Promise(resolve => setTimeout(resolve, 3000));
            retryCount++;
            button.setAttribute('title', `正在合成音频...${retryCount}/${maxRetries}`);
        }

        throw new Error('合成超时');

    } catch (error) {
        log('百度TTS错误:', error);
        button.classList.remove('loading', 'playing');
        button.setAttribute('title', '朗读文本');
        throw error;
    }
}

// 播放音频
async function playAudio(url, button, isObjectUrl = false) {
    try {
        const audio = new Audio();

        audio.addEventListener('ended', () => {
            button.classList.remove('playing');
            if (autoPlayEnabled) {
                // 查找下一个可播放的文章
				log('查找下一个可播放的文章');
                const articles = Array.from(document.querySelectorAll('.flux'));
                const currentArticle = button.closest('.flux');
                const currentIndex = articles.indexOf(currentArticle);

                if (currentIndex >= 0 && currentIndex < articles.length - 1) {
                    const nextArticle = articles[currentIndex + 1];
                    const nextButton = nextArticle.querySelector('.tts-button');
                    if (nextButton) {
                        setTimeout(() => {
                            nextButton.click();
                        }, 1000); // 1秒后播放下一篇
                    }
                }
            }
        });

        // 清理之前的音频对象
        if (currentUtterance instanceof Audio) {
            stopSpeaking();
        }

        // 设置新的音频对象
        currentUtterance = audio;

        const cleanup = () => {
            if (isObjectUrl) {
                URL.revokeObjectURL(url);
            }
        };

        audio.onloadedmetadata = () => {
            log('音频时长:', audio.duration, '秒');
        };

        audio.oncanplaythrough = async () => {
            if (audio !== currentUtterance) {
                cleanup();
                log('音频已被替换，取消播放');
                return;
            }
            log('音频已加载，开始播放');
            button.classList.remove('loading');
            button.classList.add('playing');
            try {
                await audio.play();
                resolve();
            } catch (error) {
                log('播放失败:', error);
                cleanup();
                button.classList.remove('playing', 'loading');
                currentUtterance = null;
                button.setAttribute('title', '播放失败: ' + error.message);
                reject(error);
            }
        };

        audio.onended = () => {
            if (audio === currentUtterance) {
                log('播放完成');
                cleanup();
                button.classList.remove('playing');
                currentUtterance = null;
                button.setAttribute('title', '朗读文本');
            }
        };

        audio.onpause = () => {
            if (audio === currentUtterance && !audio.ended) {
                log('音频已暂停');
                button.classList.remove('playing');
                button.setAttribute('title', '继续播放');
            }
        };

        audio.onplay = () => {
            if (audio === currentUtterance) {
                log('音频开始/继续播放');
                button.classList.add('playing');
                button.setAttribute('title', '点击暂停');
            } else {
                log('检测到旧音频播放，停止');
                cleanup();
                audio.pause();
                audio.currentTime = 0;
            }
        };

        audio.onerror = (e) => {
            if (audio === currentUtterance) {
                const error = e.target.error;
                log('播放错误:', error ? error.message : '未知错误');
                cleanup();
                button.classList.remove('loading', 'playing');
                currentUtterance = null;
                button.setAttribute('title', '播放失败: ' + (error ? error.message : '未知错误'));
                reject(error);
            }
        };

        audio.src = url;
    } catch (error) {
        log('播放错误:', error);
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

// 全局变量
let autoPlayEnabled = false;
let shutdownTimer = null;
let shutdownMinutes = 0;

// 创建TTS控制面板
function createTTSControls() {
    const controls = document.createElement('div');
    controls.className = 'tts-controls';
    controls.style.position = 'fixed';
    controls.style.bottom = '20px';
    controls.style.right = '20px';
    controls.style.padding = '10px';
    controls.style.background = 'white';
    controls.style.border = '1px solid #ccc';
    controls.style.borderRadius = '5px';
    controls.style.zIndex = '1000';

    const autoPlayCheckbox = document.createElement('input');
    autoPlayCheckbox.type = 'checkbox';
    autoPlayCheckbox.id = 'tts-autoplay';
    const autoPlayLabel = document.createElement('label');
    autoPlayLabel.htmlFor = 'tts-autoplay';
    autoPlayLabel.textContent = '自动播放下一篇';

    const timerInput = document.createElement('input');
    timerInput.type = 'number';
    timerInput.min = '0';
    timerInput.style.width = '60px';
    timerInput.placeholder = '分钟';

    const timerButton = document.createElement('button');
    timerButton.textContent = '设置定时关闭';
    timerButton.style.marginLeft = '5px';

    const timerDisplay = document.createElement('div');
    timerDisplay.style.marginTop = '5px';

    controls.appendChild(autoPlayCheckbox);
    controls.appendChild(autoPlayLabel);
    controls.appendChild(document.createElement('br'));
    controls.appendChild(timerInput);
    controls.appendChild(timerButton);
    controls.appendChild(timerDisplay);

    document.body.appendChild(controls);

    // 事件处理
    autoPlayCheckbox.addEventListener('change', (e) => {
        autoPlayEnabled = e.target.checked;
        saveConfig({ ...getConfig(), autoPlay: autoPlayEnabled });
    });

    timerButton.addEventListener('click', () => {
        const minutes = parseInt(timerInput.value);
        if (minutes > 0) {
            setShutdownTimer(minutes, timerDisplay);
        } else {
            clearShutdownTimer();
        }
        timerInput.value = '';
    });

    return controls;
}

// 设置定时关闭
function setShutdownTimer(minutes, display) {
    clearShutdownTimer();
    shutdownMinutes = minutes;
    const endTime = Date.now() + minutes * 60 * 1000;

    function updateDisplay() {
        const remaining = Math.max(0, endTime - Date.now());
        const remainingMinutes = Math.floor(remaining / 60000);
        const remainingSeconds = Math.floor((remaining % 60000) / 1000);
        display.textContent = `将在 ${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')} 后关闭`;

        if (remaining <= 0) {
            stopSpeaking();
            autoPlayEnabled = false;
            display.textContent = '';
            document.getElementById('tts-autoplay').checked = false;
            saveConfig({ ...getConfig(), autoPlay: false });
        }
    }

    shutdownTimer = setInterval(updateDisplay, 1000);
    updateDisplay();
}

// 清除定时器
function clearShutdownTimer() {
    if (shutdownTimer) {
        clearInterval(shutdownTimer);
        shutdownTimer = null;
    }
}

// 在页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await initDatabase();
            await initTTS();
            createTTSControls();
        } catch (error) {
            log('初始化失败:', error);
        }
    });
} else {
    initDatabase().then(() => {
        initTTS();
        createTTSControls();
    }).catch(error => {
        log('初始化失败:', error);
    });
}

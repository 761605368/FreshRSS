class ArticleReader {
    constructor() {
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.activeButton = null;
        this.currentArticleId = null;
    }

    showNotification(message, type = 'info') {
        const notificationElement = document.getElementById('notification');
        if (!notificationElement) return;

        const msgElement = notificationElement.querySelector('.msg');
        if (!msgElement) return;

        // 设置消息和类型
        msgElement.textContent = message;
        notificationElement.className = 'notification ' + (type === 'error' ? 'bad' : 'good');
        
        // 显示通知
        notificationElement.style.display = 'block';
        
        // 3秒后隐藏
        setTimeout(() => {
            notificationElement.className = 'notification closed';
        }, 3000);
    }

    readArticle(articleElement, articleId) {
        try {
            // 如果正在阅读同一篇文章，则停止
            if (this.currentArticleId === articleId) {
                this.stop();
                return;
            }

            // 如果正在阅读其他文章，先停止
            if (this.currentUtterance) {
                this.stop();
            }

            // 获取文章内容
            const text = this.extractTextContent(articleElement);
            if (!text) {
                this.showNotification('No content to read', 'error');
                return;
            }

            // 创建新的语音合成任务
            const utterance = new SpeechSynthesisUtterance(text);
            
            // 设置语音完成回调
            utterance.onend = () => {
                this.resetState();
                this.showNotification('Finished reading');
            };

            utterance.onerror = (event) => {
                this.resetState();
                this.showNotification('Error reading article: ' + event.error, 'error');
            };

            // 更新状态
            this.currentUtterance = utterance;
            this.activeButton = articleElement.querySelector('.tts-button');
            this.currentArticleId = articleId;
            
            // 添加激活状态样式
            if (this.activeButton) {
                this.activeButton.classList.add('active');
            }

            // 开始阅读
            this.synth.speak(utterance);
            this.showNotification('Started reading');
        } catch (error) {
            console.error('Error in readArticle:', error);
            this.showNotification('Error: ' + error.message, 'error');
            this.resetState();
        }
    }

    stop() {
        if (this.currentUtterance) {
            this.synth.cancel();
            this.resetState();
            this.showNotification('Stopped reading');
        }
    }

    resetState() {
        if (this.activeButton) {
            this.activeButton.classList.remove('active');
        }
        this.currentUtterance = null;
        this.activeButton = null;
        this.currentArticleId = null;
    }

    extractTextContent(articleElement) {
        if (!articleElement) return '';

        // 获取文章内容元素
        const contentElement = articleElement.querySelector('.content');
        if (!contentElement) return '';

        // 创建内容副本以进行清理
        const tempDiv = contentElement.cloneNode(true);

        // 移除不需要的元素
        const removeSelectors = [
            'script',
            'style',
            'iframe',
            '.tts-button',
            '.author',
            '.date'
        ];

        removeSelectors.forEach(selector => {
            tempDiv.querySelectorAll(selector).forEach(el => el.remove());
        });

        // 获取清理后的文本
        return tempDiv.textContent.trim()
            .replace(/\s+/g, ' ')  // 将多个空白字符替换为单个空格
            .replace(/\n+/g, ' '); // 将换行符替换为空格
    }
}

// 初始化函数
function initializeArticleReader() {
    // 确保页面已经加载完成
    if (document.readyState !== 'complete') {
        window.addEventListener('load', initializeArticleReader);
        return;
    }

    // 确保 FreshRSS 的主要功能已经初始化
    if (!window.context || !document.querySelector('#stream')) {
        setTimeout(initializeArticleReader, 100);
        return;
    }

    try {
        if (!window.articleReader) {
            window.articleReader = new ArticleReader();
            console.log('TTS: ArticleReader initialized successfully');
        }
    } catch (error) {
        console.error('TTS: Failed to initialize ArticleReader:', error);
        setTimeout(initializeArticleReader, 100);
    }
}

// 等待 tts_context 准备就绪
if (window.tts_context) {
    initializeArticleReader();
} else {
    window.addEventListener('ttsContextReady', initializeArticleReader);
}

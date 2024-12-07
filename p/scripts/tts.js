// Text-to-speech functionality for FreshRSS
'use strict';

class ArticleReader {
    constructor() {
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.isReading = false;
        this.lastText = null;
        this.lastPosition = 0;
        this.currentArticleId = null;
        this.speakerIcon = `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
        </svg>`;
        this.muteIcon = `<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="22" y1="2" x2="2" y2="22"></line>
        </svg>`;
    }

    readArticle(articleContent, articleId) {
        // 如果正在阅读，则暂停
        if (this.isReading) {
            this.stop();
            return;
        }

        const text = this.extractTextContent(articleContent);

        // 如果是同一篇文章，且有上次的位置
        if (articleId === this.currentArticleId && this.lastText === text && this.lastPosition > 0) {
            // 从上次位置继续阅读
            const remainingText = text.substring(this.lastPosition);
            this.startReading(remainingText, text, articleId);
        } else {
            // 新文章从头开始阅读
            this.lastPosition = 0;
            this.lastText = text;
            this.currentArticleId = articleId;
            this.startReading(text, text, articleId);
        }
    }

    startReading(textToRead, fullText, articleId) {
        const utterance = new SpeechSynthesisUtterance(textToRead);

        utterance.onboundary = (event) => {
            // 更新当前位置
            if (event.name === 'word') {
                this.lastPosition = this.lastPosition + event.charIndex;
            }
        };

        utterance.onend = () => {
            // 如果读完了整篇文章，重置位置
            if (this.lastPosition >= fullText.length) {
                this.lastPosition = 0;
                this.lastText = null;
                this.currentArticleId = null;
            }
            this.isReading = false;
            this.currentUtterance = null;
            this.updateReadButton();
        };

        utterance.onerror = (event) => {
            console.error('TTS Error:', event.error);
            this.isReading = false;
            this.currentUtterance = null;
            this.updateReadButton();
        };

        this.currentUtterance = utterance;
        this.isReading = true;
        this.updateReadButton();
        this.synth.speak(utterance);
    }

    stop() {
        if (this.isReading) {
            this.synth.cancel();
            this.isReading = false;
            this.currentUtterance = null;
            this.updateReadButton();
        }
    }

    extractTextContent(articleContent) {
        // Create a temporary div to parse HTML content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = articleContent;

        // Remove script tags
        const scripts = tempDiv.getElementsByTagName('script');
        while (scripts[0]) {
            scripts[0].parentNode.removeChild(scripts[0]);
        }

        // Get text content
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    updateReadButton() {
        // 更新工具栏按钮
        const button = document.querySelector('#read-aloud-button');
        if (button) {
            button.classList.toggle('active', this.isReading);
            button.title = this.isReading ? 'Stop reading' : 'Read article aloud';
            button.innerHTML = this.isReading ? this.muteIcon : this.speakerIcon;
        }

        // 更新所有文章标题中的按钮
        document.querySelectorAll('.article-read-button').forEach(button => {
            const article = button.closest('.flux');
            const isCurrentArticle = article && article.querySelector('.content') === this.currentContent;
            
            button.classList.toggle('active', this.isReading && isCurrentArticle);
            button.title = this.isReading && isCurrentArticle ? 'Stop reading' : 'Read article aloud';
            button.innerHTML = this.isReading && isCurrentArticle ? this.muteIcon : this.speakerIcon;
        });
    }
}

// Initialize the article reader
let articleReader = null;

function init_tts() {
    if (!window.speechSynthesis) {
        console.log('Text-to-speech is not supported in this browser');
        return;
    }

    articleReader = new ArticleReader();

    // Add read-aloud button to the toolbar
    const toolbar = document.querySelector('.nav_menu');
    if (toolbar) {
        // Create a group div for the button
        const group = document.createElement('div');
        group.className = 'group';
        
        const readButton = document.createElement('button');
        readButton.id = 'read-aloud-button';
        readButton.className = 'btn';
        readButton.innerHTML = articleReader.speakerIcon;
        readButton.title = 'Read article aloud';
        
        group.appendChild(readButton);
        toolbar.appendChild(group);

        readButton.addEventListener('click', (e) => {
            e.preventDefault();
            const currentArticle = document.querySelector('.flux.current');
            if (currentArticle) {
                const content = currentArticle.querySelector('.content');
                if (content) {
                    articleReader.readArticle(content.innerHTML, currentArticle.id);
                }
            }
        });
    }

    // Add read buttons after article titles
    function addReadButtonToArticle(article) {
        const title = article.querySelector('h1.title');
        if (title && !title.querySelector('.article-read-button')) {
            const button = document.createElement('button');
            button.className = 'article-read-button btn';
            button.innerHTML = articleReader.speakerIcon;
            button.title = 'Read this article aloud';
            button.style.marginLeft = '0.5em';
            button.style.verticalAlign = 'middle';
            
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const content = article.querySelector('.content');
                if (content) {
                    articleReader.readArticle(content.innerHTML, article.id);
                }
            });
            
            title.appendChild(button);
        }
    }

    // Add read buttons to existing articles
    document.querySelectorAll('.flux').forEach(addReadButtonToArticle);

    // Watch for new articles being added
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.classList && node.classList.contains('flux')) {
                    addReadButtonToArticle(node);
                }
            });
        });
    });

    const streamNode = document.getElementById('stream');
    if (streamNode) {
        observer.observe(streamNode, { childList: true, subtree: true });
    }
}

// Initialize TTS when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init_tts);
} else {
    init_tts();
}

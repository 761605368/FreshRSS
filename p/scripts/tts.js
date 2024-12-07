// Text-to-speech functionality for FreshRSS
'use strict';

class ArticleReader {
    constructor() {
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.isReading = false;
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

    readArticle(articleContent) {
        if (this.isReading) {
            this.stop();
            return;
        }

        const text = this.extractTextContent(articleContent);
        const utterance = new SpeechSynthesisUtterance(text);

        utterance.onend = () => {
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
        const button = document.querySelector('#read-aloud-button');
        if (button) {
            button.classList.toggle('active', this.isReading);
            button.title = this.isReading ? 'Stop reading' : 'Read article aloud';
            button.innerHTML = this.isReading ? this.muteIcon : this.speakerIcon;
        }
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
                    articleReader.readArticle(content.innerHTML);
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
                    articleReader.readArticle(content.innerHTML);
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

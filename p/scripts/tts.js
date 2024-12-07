// Text-to-speech functionality for FreshRSS
'use strict';

class ArticleReader {
    constructor() {
        this.synth = window.speechSynthesis;
        this.currentUtterance = null;
        this.isReading = false;
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
            button.innerHTML = this.isReading ? '🔊 Stop' : '🔊 Read';
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
    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
        const readButton = document.createElement('button');
        readButton.id = 'read-aloud-button';
        readButton.className = 'read-aloud';
        readButton.innerHTML = '🔊 Read';
        readButton.title = 'Read article aloud';
        
        readButton.addEventListener('click', (e) => {
            e.preventDefault();
            const activeArticle = document.querySelector('.flux.current');
            if (activeArticle) {
                const articleText = activeArticle.querySelector('.flux_content .text');
                if (articleText) {
                    articleReader.readArticle(articleText.innerHTML);
                }
            }
        });

        toolbar.appendChild(readButton);
    }
}

// Initialize TTS when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init_tts);
} else {
    init_tts();
}

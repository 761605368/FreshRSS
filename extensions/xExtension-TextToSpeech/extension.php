<?php

class TextToSpeechExtension extends Minz_Extension {
    public function init(): void {
        $this->registerTranslates();

        // 加载 CSS
        Minz_View::appendStyle($this->getFileUrl('tts.css', 'css'));
        
        // 注册初始化变量
        $this->registerHook('javascript_vars', array($this, 'addJavaScript'));
        
        // 添加按钮
        $this->registerHook('entry_before_display', array($this, 'addTtsButton'));
        
        // 加载主脚本
        Minz_View::appendScript($this->getFileUrl('tts.js', 'js'));
    }
    
    public function addJavaScript(): void {
        // 添加初始化标记，这样我们的脚本就知道何时可以开始初始化
        $context = array(
            'tts_enabled' => true,
            'init_time' => time(),
        );
        echo 'window.tts_context = ' . json_encode($context) . ";\n";
        echo 'window.dispatchEvent(new Event("ttsContextReady"));';
    }
    
    public function addTtsButton($entry) {
        $entry->content .= '<button class="tts-button" onclick="if(window.articleReader){window.articleReader.readArticle(this.parentElement, \'' . $entry->id() . '\')}">';
        $entry->content .= '<svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
        $entry->content .= '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>';
        $entry->content .= '<path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
        $entry->content .= '<path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>';
        $entry->content .= '</svg>';
        $entry->content .= '</button>';
        return $entry;
    }
}

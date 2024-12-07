<?php

class TextToSpeechExtension extends Minz_Extension {
    public function init(): void {
        $this->registerTranslates();
        
        // 注册钩子，在文章显示前添加 TTS 按钮
        $this->registerHook('entry_before_display', array($this, 'addTtsButton'));

        // 添加 JavaScript 和 CSS 文件
        Minz_View::appendScript($this->getFileUrl('tts.js', 'js'));
        Minz_View::appendStyle($this->getFileUrl('tts.css', 'css'));
    }
    
    public function handleConfigureAction() {
        if (Minz_Request::isPost()) {
            // 保存配置
            FreshRSS_Context::$user_conf->tts_rate = Minz_Request::param('tts_rate', 1.0);
            FreshRSS_Context::$user_conf->tts_pitch = Minz_Request::param('tts_pitch', 1.0);
            FreshRSS_Context::$user_conf->tts_volume = Minz_Request::param('tts_volume', 1.0);
            FreshRSS_Context::$user_conf->tts_lang = Minz_Request::param('tts_lang', 'zh-CN');
            FreshRSS_Context::$user_conf->save();
        }
    }
    
    public function addTtsButton($entry) {
        // 获取配置
        $tts_rate = FreshRSS_Context::$user_conf->tts_rate ?? 1.0;
        $tts_pitch = FreshRSS_Context::$user_conf->tts_pitch ?? 1.0;
        $tts_volume = FreshRSS_Context::$user_conf->tts_volume ?? 1.0;
        $tts_lang = FreshRSS_Context::$user_conf->tts_lang ?? 'zh-CN';
        
        // 在文章内容前添加 TTS 按钮，并传入配置
        $entry->_content(
            '<button class="tts-button" ' .
            'data-article-id="' . $entry->id() . '" ' .
            'data-tts-rate="' . $tts_rate . '" ' .
            'data-tts-pitch="' . $tts_pitch . '" ' .
            'data-tts-volume="' . $tts_volume . '" ' .
            'data-tts-lang="' . $tts_lang . '" ' .
            'title="Text to Speech">' .
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">' .
            '<path d="M14,3.23V5.29C16.89,6.15 19,8.83 19,12C19,15.17 16.89,17.84 14,18.7V20.77C18,19.86 21,16.28 21,12C21,7.72 18,4.14 14,3.23M16.5,12C16.5,10.23 15.5,8.71 14,7.97V16C15.5,15.29 16.5,13.76 16.5,12M3,9V15H7L12,20V4L7,9H3Z"/>' .
            '</svg>' .
            '</button>' .
            $entry->content()
        );
        return $entry;
    }
}

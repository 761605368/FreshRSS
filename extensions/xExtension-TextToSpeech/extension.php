<?php

class TextToSpeechExtension extends Minz_Extension {
    protected array $csp_policies = [
        'default-src' => '*',
    ];

    public function init(): void {
        $this->registerTranslates();

        // 注册钩子，在文章显示前添加 TTS 按钮
        $this->registerHook('entry_before_display', array($this, 'addTtsButton'));
        $this->registerHook('nav_reading_modes', array($this, 'addTTSConfig'));

        // 注册控制器
        $this->registerController('TextToSpeech');

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
            FreshRSS_Context::$user_conf->tts_service = Minz_Request::param('tts_service', 'browser');
            FreshRSS_Context::$user_conf->tts_api_key = Minz_Request::param('tts_api_key', '');
            FreshRSS_Context::$user_conf->tts_secret_key = Minz_Request::param('tts_secret_key', '');
            // 添加缓存配置
            FreshRSS_Context::$user_conf->tts_cache_days = Minz_Request::param('tts_cache_days', 365);
            FreshRSS_Context::$user_conf->tts_cache_size = Minz_Request::param('tts_cache_size', 500);

            FreshRSS_Context::$user_conf->save();
        }
    }

    public function addTTSConfig() {
        // 获取配置
        $tts_rate = FreshRSS_Context::$user_conf->tts_rate ?? 1.0;
        $tts_pitch = FreshRSS_Context::$user_conf->tts_pitch ?? 1.0;
        $tts_volume = FreshRSS_Context::$user_conf->tts_volume ?? 1.0;
        $tts_lang = FreshRSS_Context::$user_conf->tts_lang ?? 'zh-CN';
        $tts_service = FreshRSS_Context::$user_conf->tts_service ?? 'browser';
        $tts_api_key = FreshRSS_Context::$user_conf->tts_api_key ?? '';
        $tts_secret_key = FreshRSS_Context::$user_conf->tts_secret_key ?? '';
        // 添加缓存配置
        $tts_cache_days = FreshRSS_Context::$user_conf->tts_cache_days ?? 365;
        $tts_cache_size = FreshRSS_Context::$user_conf->tts_cache_size ?? 500;
        $tts_voice = FreshRSS_Context::$user_conf->tts_voice ?? 5118;

        // 创建配置 JavaScript 对象
        $config = array(
            'rate' => floatval($tts_rate),
            'pitch' => floatval($tts_pitch),
            'volume' => floatval($tts_volume),
            'lang' => strval($tts_lang),
            'service' => strval($tts_service),
            'baiduApiKey' => strval($tts_api_key),
            'baiduSecretKey' => strval($tts_secret_key),
            // 添加缓存配置
            'cacheDays' => intval($tts_cache_days),
            'cacheSize' => intval($tts_cache_size),
			'voice' => intval($tts_voice)
        );

        // 将配置写入页面，确保 JSON 格式正确
        $json_config = json_encode($config, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
        echo '<script id="tts-config" type="application/json">' . $json_config . '</script>';
    }

    public function addTtsButton($entry) {
        // 在这里添加按钮的占位符 div，JavaScript 会找到这些 div 并添加按钮
        $title_button_placeholder = '<div class="tts-button-placeholder title"></div>';
        $content_button_placeholder = '<div class="tts-button-placeholder content"></div>';

        // 在标题和内容前添加占位符
        $entry->_title($title_button_placeholder . $entry->title());
        $entry->_content($content_button_placeholder . $entry->content());

        return $entry;
    }

    public function amendCsp(array &$csp): void {
        // Add blob: to media-src directive
        if (isset($csp['media-src'])) {
            $csp['media-src'] .= " blob:";
        } else {
            $csp['media-src'] = "'self' blob:";
        }
    }
}

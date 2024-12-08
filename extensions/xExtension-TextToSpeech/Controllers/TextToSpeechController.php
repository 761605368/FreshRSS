<?php

class FreshExtension_TextToSpeech_Controller extends Minz_ActionController {
    public function __construct() {
        parent::__construct();
        // 添加允许blob URL的Content Security Policy
        header("Content-Security-Policy: default-src 'self'; media-src 'self' blob: *;");
    }

    public function baiduTokenAction() {
        $this->view->_layout(false);
        header('Content-Type: application/json');

        try {
            // 验证CSRF令牌
            $csrf = Minz_Request::param('_csrf');
            if (!FreshRSS_Auth::csrfToken($csrf)) {
                throw new Exception('Invalid CSRF token');
            }

            // 获取API凭据
            $api_key = Minz_Request::param('api_key');
            $secret_key = Minz_Request::param('secret_key');

            Minz_Log::debug('TTS: Received token request with API key: ' . substr($api_key, 0, 4) . '...');

            if (!$api_key || !$secret_key) {
                throw new Exception('Missing API credentials');
            }

            $url = "https://aip.baidubce.com/oauth/2.0/token";
            $params = array(
                'grant_type' => 'client_credentials',
                'client_id' => $api_key,
                'client_secret' => $secret_key
            );

            Minz_Log::debug('TTS: Requesting Baidu token with params: ' . json_encode($params));

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 10);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                throw new Exception('cURL error: ' . $error);
            }

            Minz_Log::debug('TTS: Baidu token response: ' . $response);
            Minz_Log::debug('TTS: Baidu token HTTP code: ' . $httpCode);

            if ($httpCode !== 200) {
                throw new Exception('HTTP error: ' . $httpCode . ', Response: ' . $response);
            }

            $data = json_decode($response, true);
            if (!$data || !isset($data['access_token'])) {
                throw new Exception('Invalid response format: ' . $response);
            }

            echo $response;

        } catch (Exception $e) {
            Minz_Log::error('TTS: Token error: ' . $e->getMessage());
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function baiduSynthesizeAction() {
        $this->view->_layout(false);

        try {
            // 验证CSRF令牌
            $csrf = Minz_Request::param('_csrf');
            if (!FreshRSS_Auth::csrfToken($csrf)) {
                throw new Exception('Invalid CSRF token');
            }

            $text = Minz_Request::param('text');
            $token = Minz_Request::param('token');
            $lang = Minz_Request::param('lang', 'zh'); // 默认中文

            if (!$text || !$token) {
                throw new Exception('Missing required parameters');
            }

            // 设置API请求参数
            $url = "https://tsn.baidu.com/text2audio";
            $params = array(
                'tex' => urlencode($text),
                'tok' => $token,
                'cuid' => 'freshrss',
                'ctp' => 1,
                'lan' => $lang,
                'spd' => 5,    // 语速，取值0-15，默认为5中语速
                'pit' => 5,    // 音调，取值0-15，默认为5中语调
                'vol' => 5,    // 音量，取值0-15，默认为5中音量
                'per' => 0,    // 发音人选择, 0为女声，1为男声，3为情感合成-度逍遥，4为情感合成-度丫丫
                'aue' => 6     // 3为mp3格式(默认)； 4为pcm-16k；5为pcm-8k；6为wav；下载确保百分百正确才可以使用
            );

            Minz_Log::debug('TTS: Requesting Baidu synthesis with params: ' . json_encode($params));

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HEADER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $headers = substr($response, 0, $headerSize);
            $body = substr($response, $headerSize);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                throw new Exception('cURL error: ' . $error);
            }

            // 检查是否返回错误信息
            if (strpos($contentType, 'application/json') !== false) {
                $result = json_decode($body, true);
                if (isset($result['error_code'])) {
                    throw new Exception('Baidu API error: ' . $result['error_msg']);
                }
            }

            // 设置响应头
            header('Content-Type: audio/wav');
            header('Content-Length: ' . strlen($body));
            echo $body;

        } catch (Exception $e) {
            Minz_Log::error('TTS error: ' . $e->getMessage());
            header('HTTP/1.1 500 Internal Server Error');
            header('Content-Type: application/json');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function createTaskAction() {
        $this->view->_layout(false);
        header('Content-Type: application/json');

        try {
            // 验证CSRF令牌
            $csrf = Minz_Request::param('_csrf');
            if (!FreshRSS_Auth::csrfToken($csrf)) {
                throw new Exception('Invalid CSRF token');
            }

            $text = Minz_Request::param('text');
            $token = Minz_Request::param('token');
            $voice = intval(Minz_Request::param('voice', 0));
            $format = Minz_Request::param('format', 'mp3-16k');

            Minz_Log::debug('TTS: Received parameters - text length: ' . strlen($text) . ', token: ' . substr($token, 0, 10) . '...');

            if (!$text || !$token) {
                throw new Exception('Missing required parameters');
            }

            // 将文本分段，每段不超过一定长度
            $textSegments = $this->splitText($text);
            Minz_Log::debug('TTS: Split text into ' . count($textSegments) . ' segments');

            if (empty($textSegments)) {
                throw new Exception('No valid text segments to synthesize');
            }

            // 设置API请求参数
            $url = "https://aip.baidubce.com/rpc/2.0/tts/v1/create";
            $params = array(
                'text' => $textSegments,
                'format' => $format,
                'voice' => $voice,
                'lang' => 'zh',  // 固定值zh
                'speed' => intval(Minz_Request::param('speed', 5)),
                'pitch' => intval(Minz_Request::param('pitch', 5)),
                'volume' => intval(Minz_Request::param('volume', 5)),
                'enable_subtitle' => 1
            );

            Minz_Log::debug('TTS: Creating task with params: ' . json_encode($params));

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url . '?access_token=' . $token);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            Minz_Log::debug('TTS: API response code: ' . $httpCode);
            if ($response) {
                Minz_Log::debug('TTS: API response: ' . $response);
            }

            if ($error) {
                throw new Exception('cURL error: ' . $error);
            }

            if ($httpCode !== 200) {
                throw new Exception('HTTP error: ' . $httpCode . ', Response: ' . $response);
            }

            $result = json_decode($response, true);
            if (!$result) {
                throw new Exception('Invalid JSON response: ' . $response);
            }

            if (isset($result['error_code'])) {
                throw new Exception('Baidu API error ' . $result['error_code'] . ': ' . ($result['error_msg'] ?? 'Unknown error'));
            }

            echo $response;

        } catch (Exception $e) {
            Minz_Log::error('TTS error: ' . $e->getMessage());
            header('HTTP/1.1 500 Internal Server Error');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function queryTaskAction() {
        $this->view->_layout(false);
        header('Content-Type: application/json');

        try {
            // 验证CSRF令牌
            $csrf = Minz_Request::param('_csrf');
            if (!FreshRSS_Auth::csrfToken($csrf)) {
                throw new Exception('Invalid CSRF token');
            }

            $token = Minz_Request::param('token');
            $taskIds = Minz_Request::param('task_ids');

            if (!$token || !$taskIds) {
                throw new Exception('Missing required parameters');
            }

            Minz_Log::debug('TTS: Query task - token: ' . substr($token, 0, 10) . '..., task_ids: ' . $taskIds);

            // 将task_ids转换为数组格式
            $taskIdsList = [$taskIds];  // 直接将单个task_id放入数组

            $url = "https://aip.baidubce.com/rpc/2.0/tts/v1/query";
            $params = array('task_ids' => $taskIdsList);

            Minz_Log::debug('TTS: Query task params: ' . json_encode($params));

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url . '?access_token=' . $token);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($params));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            Minz_Log::debug('TTS: Query task response code: ' . $httpCode);
            if ($response) {
                Minz_Log::debug('TTS: Query task response: ' . $response);
            }

            if ($error) {
                throw new Exception('cURL error: ' . $error);
            }

            if ($httpCode !== 200) {
                throw new Exception('HTTP error: ' . $httpCode . ', Response: ' . $response);
            }

            $result = json_decode($response, true);
            if (!$result) {
                throw new Exception('Invalid JSON response: ' . $response);
            }

            if (isset($result['error_code'])) {
                throw new Exception('Baidu API error ' . $result['error_code'] . ': ' . ($result['error_msg'] ?? 'Unknown error'));
            }

            echo $response;

        } catch (Exception $e) {
            Minz_Log::error('TTS error: ' . $e->getMessage());
            header('HTTP/1.1 500 Internal Server Error');
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    public function playAudioAction() {
        $this->view->_layout(false);
        
        $url = Minz_Request::param('url');
        if (!$url) {
            header('HTTP/1.1 400 Bad Request');
            die('Missing URL parameter');
        }

        // 验证URL是否来自百度
        if (!preg_match('/^http:\/\/aipe-speech\.bj\.bcebos\.com\//', $url)) {
            header('HTTP/1.1 403 Forbidden');
            die('Invalid audio URL');
        }

        // 获取音频内容
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        $audio = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            header('HTTP/1.1 502 Bad Gateway');
            die('Failed to fetch audio');
        }

        // 设置响应头
        header('Content-Type: audio/mpeg');
        header('Content-Length: ' . strlen($audio));
        header('Accept-Ranges: bytes');
        header('Cache-Control: public, max-age=31536000');
        
        // 输出音频数据
        echo $audio;
        exit;
    }

    private function splitText($text) {
        // 清理和预处理文本
        $text = trim($text);
        if (empty($text)) {
            return array();
        }

        // 将文本按句号分段，每段不超过2000字
        $segments = array();
        $sentences = preg_split('/(?<=[。！？.!?])/u', $text, -1, PREG_SPLIT_NO_EMPTY);
        
        $currentSegment = '';
        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if (empty($sentence)) continue;
            
            if (mb_strlen($currentSegment . $sentence, 'UTF-8') > 2000) {
                if (!empty($currentSegment)) {
                    $segments[] = $currentSegment;
                }
                // 如果单个句子超过2000字，需要进一步分割
                if (mb_strlen($sentence, 'UTF-8') > 2000) {
                    $subSegments = mb_str_split($sentence, 1500, 'UTF-8');
                    foreach ($subSegments as $subSegment) {
                        $segments[] = $subSegment;
                    }
                } else {
                    $currentSegment = $sentence;
                }
            } else {
                $currentSegment .= ($currentSegment ? ' ' : '') . $sentence;
            }
        }
        
        if (!empty($currentSegment)) {
            $segments[] = $currentSegment;
        }

        Minz_Log::debug('TTS: Text segmentation - Original length: ' . mb_strlen($text, 'UTF-8') . 
                       ', Segments: ' . count($segments));
        
        return $segments;
    }
}

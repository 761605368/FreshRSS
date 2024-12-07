<?php

class FreshExtension_TextToSpeech_Controller extends Minz_ActionController {
    public function baiduTokenAction() {
        $this->view->_layout(false);
        header('Content-Type: application/json');
        
        $api_key = Minz_Request::param('api_key');
        $secret_key = Minz_Request::param('secret_key');
        
        if (!$api_key || !$secret_key) {
            Minz_Log::error('TTS: Missing API credentials');
            http_response_code(400);
            echo json_encode(['error' => 'Missing API credentials']);
            return;
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
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);  // 禁用SSL验证，仅用于测试
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);  // 设置超时时间
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);
        
        if ($error) {
            Minz_Log::error('TTS: Baidu token request failed: ' . $error);
            http_response_code(500);
            echo json_encode(['error' => 'Failed to get token: ' . $error]);
            return;
        }
        
        Minz_Log::debug('TTS: Baidu token response: ' . $response);
        Minz_Log::debug('TTS: Baidu token HTTP code: ' . $httpCode);
        
        if ($httpCode !== 200) {
            http_response_code($httpCode);
            echo json_encode(['error' => 'Failed to get token']);
            return;
        }
        
        echo $response;
    }
    
    public function baiduSynthesizeAction() {
        $this->view->_layout(false);
        
        $text = Minz_Request::param('text');
        $token = Minz_Request::param('token');
        
        if (!$text || !$token) {
            Minz_Log::error('TTS: Missing text or token');
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Missing required parameters']);
            return;
        }
        
        $url = "https://tsn.baidu.com/text2audio";
        $params = array(
            'tex' => urlencode($text),
            'tok' => $token,
            'cuid' => 'freshrss',
            'ctp' => 1,
            'lan' => 'zh',
            'spd' => 4,  // 语速，取值0-15，默认为5中语速
            'pit' => 5,  // 音调，取值0-15，默认为5中语调
            'vol' => 7,  // 音量，取值0-15，默认为5中音量
            'per' => 0,  // 发音人选择, 0为女声，1为男声，3为情感合成-度逍遥，4为情感合成-度丫丫
            'aue' => 3   // 3为mp3格式(默认)； 4为pcm-16k；5为pcm-8k；6为wav
        );
        
        Minz_Log::debug('TTS: Requesting Baidu synthesis with params: ' . json_encode($params));
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);  // 禁用SSL验证，仅用于测试
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);  // 设置超时时间
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        $error = curl_error($ch);
        $responseSize = strlen($response);
        curl_close($ch);
        
        Minz_Log::debug('TTS: Baidu synthesis response size: ' . $responseSize . ' bytes');
        Minz_Log::debug('TTS: Baidu synthesis HTTP code: ' . $httpCode);
        Minz_Log::debug('TTS: Baidu synthesis content type: ' . $contentType);
        
        if ($error) {
            Minz_Log::error('TTS: Baidu synthesis request failed: ' . $error);
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['error' => 'Failed to get audio: ' . $error]);
            return;
        }
        
        if ($httpCode !== 200) {
            Minz_Log::error('TTS: Baidu synthesis failed with HTTP code: ' . $httpCode);
            header('Content-Type: application/json');
            http_response_code($httpCode);
            echo json_encode(['error' => 'Failed to get audio']);
            return;
        }
        
        if (strpos($contentType, 'application/json') !== false) {
            Minz_Log::error('TTS: Baidu synthesis returned error: ' . $response);
            header('Content-Type: application/json');
            http_response_code(400);
            echo $response;
            return;
        }
        
        if ($responseSize === 0) {
            Minz_Log::error('TTS: Baidu synthesis returned empty response');
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['error' => 'Empty response from server']);
            return;
        }
        
        header('Content-Type: audio/mp3');
        header('Content-Length: ' . $responseSize);
        echo $response;
    }
}

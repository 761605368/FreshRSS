<?php

class FreshExtension_TextToSpeech_Controller extends Minz_ActionController {
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
            $lang = Minz_Request::param('lang', 'zh');

            if (!$text || !$token) {
                throw new Exception('Missing required parameters');
            }

            // 确保文本长度不超过限制
            $text = mb_substr($text, 0, 2048);

            // 将语言代码转换为百度API支持的格式
            $langMap = [
                'zh-CN' => 'zh',
                'en-US' => 'en',
                'ja-JP' => 'jp'
            ];
            $lang = $langMap[$lang] ?? 'zh';

            Minz_Log::debug('TTS: Synthesizing text with length: ' . strlen($text) . ', language: ' . $lang);

            $url = "https://tsn.baidu.com/text2audio";
            $params = array(
                'tex' => urlencode($text),  // 确保文本被正确编码
                'tok' => $token,
                'cuid' => 'freshrss',
                'ctp' => 1,
                'lan' => $lang,
                'spd' => 5,
                'pit' => 5,
                'vol' => 5,
                'per' => 0,
                'aue' => 3  // 使用MP3格式
            );

            Minz_Log::debug('TTS: Request params: ' . json_encode($params));

            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($params));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                'Content-Type: application/x-www-form-urlencoded'
            ));

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                throw new Exception('cURL error: ' . $error);
            }

            Minz_Log::debug('TTS: Synthesis response code: ' . $httpCode . ', content type: ' . $contentType);

            if ($httpCode !== 200) {
                throw new Exception('HTTP error: ' . $httpCode);
            }

            // 检查是否返回了错误信息
            if (strpos($contentType, 'application/json') !== false) {
                $errorData = json_decode($response, true);
                if (isset($errorData['err_msg'])) {
                    throw new Exception('Baidu API error: ' . $errorData['err_msg']);
                }
                throw new Exception('Invalid response: ' . $response);
            }

            // 检查是否返回了音频数据
            if (strpos($contentType, 'audio/') === false && strpos($contentType, 'application/octet-stream') === false) {
                throw new Exception('Invalid content type: ' . $contentType);
            }

            header('Content-Type: audio/mp3');
            header('Content-Length: ' . strlen($response));
            echo $response;

        } catch (Exception $e) {
            Minz_Log::error('TTS: Synthesis error: ' . $e->getMessage());
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}

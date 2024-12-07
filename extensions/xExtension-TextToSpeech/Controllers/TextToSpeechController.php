<?php

class FreshExtension_TextToSpeech_Controller extends Minz_ActionController {
    public function baiduTokenAction() {
        $this->view->_layout(false);
        header('Content-Type: application/json');
        
        $api_key = Minz_Request::param('api_key');
        $secret_key = Minz_Request::param('secret_key');
        
        if (!$api_key || !$secret_key) {
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
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            http_response_code(400);
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
            'spd' => 5,
            'pit' => 5,
            'vol' => 5,
            'per' => 0,
            'aue' => 3
        );
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url . '?' . http_build_query($params));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            header('Content-Type: application/json');
            http_response_code(400);
            echo json_encode(['error' => 'Failed to get audio']);
            return;
        }
        
        header('Content-Type: audio/mp3');
        echo $response;
    }
}

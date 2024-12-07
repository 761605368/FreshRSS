<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

// 获取请求参数
$action = $_GET['action'] ?? '';
$api_key = $_GET['api_key'] ?? '';
$secret_key = $_GET['secret_key'] ?? '';
$text = $_GET['text'] ?? '';
$token = $_GET['token'] ?? '';

function getToken($api_key, $secret_key) {
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
        return json_encode(['error' => 'Failed to get token', 'http_code' => $httpCode]);
    }
    
    return $response;
}

function textToSpeech($text, $token) {
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
        return json_encode(['error' => 'Failed to get audio', 'http_code' => $httpCode]);
    }
    
    header('Content-Type: audio/mp3');
    return $response;
}

try {
    if ($action === 'token') {
        echo getToken($api_key, $secret_key);
    } elseif ($action === 'tts') {
        echo textToSpeech($text, $token);
    } else {
        echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}

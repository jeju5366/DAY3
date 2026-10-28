# Gemini API 테스트 - Windows PowerShell
# 한글 UTF-8 처리 포함

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# 키는 파일에 직접 쓰지 않고, 미리 설정해 둔 환경변수를 사용 (없으면 입력창으로 물어봄)
if (-not $env:GEMINI_API_KEY) {
    $env:GEMINI_API_KEY = Read-Host "Gemini API 키 입력"
}

$model = "gemini-3.5-flash-lite"

$body = @{
    contents = @(
        @{
            parts = @(
                @{
                    text = "안녕하세요. Gemini API 테스트입니다. 한 문장으로 답해주세요."
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10

# PowerShell 5.1에서도 한글이 깨지지 않도록 UTF-8 바이트로 전송
$bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)

try {
    $response = Invoke-RestMethod `
        -Uri "https://generativelanguage.googleapis.com/v1beta/models/$model`:generateContent" `
        -Method Post `
        -Headers @{
            "x-goog-api-key" = $env:GEMINI_API_KEY
        } `
        -ContentType "application/json; charset=utf-8" `
        -Body $bodyBytes

    Write-Host "`n=== Gemini API 응답 성공 ==="
    Write-Host "모델: $model"
    Write-Host $response.candidates[0].content.parts[0].text
}
catch {
    Write-Host "`n=== Gemini API 오류 ==="
    if ($_.ErrorDetails.Message) {
        $_.ErrorDetails.Message
    } else {
        $_.Exception.Message
    }
}

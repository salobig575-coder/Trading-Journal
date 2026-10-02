param(
    [int]$Port = 8420
)

$root = Split-Path -Parent $PSScriptRoot
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".ico"  = "image/x-icon"
}

$fullRoot = [System.IO.Path]::GetFullPath($root)

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response
            $response.KeepAlive = $false

            $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($path -eq "/") { $path = "/index.html" }
            $filePath = Join-Path $root ($path.TrimStart("/"))
            $fullFile = [System.IO.Path]::GetFullPath($filePath)

            if ($fullFile.StartsWith($fullRoot) -and (Test-Path $fullFile -PathType Leaf)) {
                $ext = [System.IO.Path]::GetExtension($fullFile).ToLower()
                $contentType = $mime[$ext]
                if (-not $contentType) { $contentType = "application/octet-stream" }
                $bytes = [System.IO.File]::ReadAllBytes($fullFile)
                $response.ContentType = $contentType
                $response.StatusCode = 200
                $response.SendChunked = $true
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $notFound = [System.Text.Encoding]::UTF8.GetBytes("Not found")
                $response.StatusCode = 404
                $response.SendChunked = $true
                $response.OutputStream.Write($notFound, 0, $notFound.Length)
            }
        } catch {
            Write-Host "Request error: $_"
        } finally {
            try { $context.Response.OutputStream.Close() } catch {}
        }
    }
} finally {
    $listener.Stop()
}

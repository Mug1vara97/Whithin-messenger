# Sets MSVC env (vcvars64) then runs the given command.
# Prefers a toolchain that actually has msvcrt.lib (VS 2022 Build Tools),
# because newer VS may ship cl/link without the CRT libs.

$ErrorActionPreference = "Stop"

function Find-VcVars64 {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\18\Community\VC\Auxiliary\Build\vcvars64.bat"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }

    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (Test-Path $vswhere) {
        $install = & $vswhere -latest -products * `
            -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
            -property installationPath 2>$null | Select-Object -First 1
        if ($install) {
            $bat = Join-Path $install "VC\Auxiliary\Build\vcvars64.bat"
            if (Test-Path $bat) { return $bat }
        }
    }
    return $null
}

function Import-VcVars([string]$VcVarsBat) {
    $output = & cmd.exe /c "`"$VcVarsBat`" >nul 2>&1 && set"
    foreach ($line in $output) {
        if ($line -match "^(.*?)=(.*)$") {
            Set-Item -Path "Env:$($matches[1])" -Value $matches[2]
        }
    }
}

$vcvars = Find-VcVars64
if (-not $vcvars) {
    Write-Error "Не найден vcvars64.bat. Установи Visual Studio Build Tools с workload «Desktop development with C++»."
}

Write-Host "Using VC env: $vcvars"
Import-VcVars $vcvars

if (-not $env:LIB -or $env:LIB -notmatch "MSVC") {
    Write-Error "После vcvars LIB не содержит MSVC. Проверь установку C++ build tools."
}

$msvcrt = ($env:LIB -split ";") | ForEach-Object {
    Join-Path $_ "msvcrt.lib"
} | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $msvcrt) {
    Write-Error @"
msvcrt.lib не найден в LIB.
У VS 18 Community часто нет CRT libs — поставь «MSVC v143» / Windows SDK
через Visual Studio Installer или используй VS 2022 Build Tools.
"@
}

Write-Host "Found CRT: $msvcrt"

# vcvars replaces PATH and often drops ~/.cargo/bin — put it back.
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path (Join-Path $cargoBin "cargo.exe")) {
    if (($env:PATH -split ";") -notcontains $cargoBin) {
        $env:PATH = "$cargoBin;$env:PATH"
    }
}

if ($args.Count -eq 0) {
    Write-Error "Нужна команда, например: .\scripts\with-msvc.ps1 npm run dev:remote"
}

& $args[0] $args[1..($args.Count - 1)]
exit $LASTEXITCODE

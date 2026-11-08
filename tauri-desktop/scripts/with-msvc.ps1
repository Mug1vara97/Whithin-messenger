# Sets MSVC env then runs the given command.
# Prefer a complete VS 2022 Build Tools toolchain (msvcrt.lib under lib\x64).
# Fall back to a manually assembled env when vcvars is broken by a parallel VS install
# (e.g. VS 18 Community without vcvarsall.bat polluting VCINSTALLDIR).

$ErrorActionPreference = "Stop"

function Find-MsvcRoot {
    $roots = @(
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\VC\Tools\MSVC",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\VC\Tools\MSVC",
        "${env:ProgramFiles}\Microsoft Visual Studio\18\Community\VC\Tools\MSVC"
    )
    foreach ($root in $roots) {
        if (-not (Test-Path $root)) { continue }
        $versions = Get-ChildItem $root -Directory | Sort-Object Name -Descending
        foreach ($ver in $versions) {
            $cl = Join-Path $ver.FullName "bin\Hostx64\x64\cl.exe"
            $crt = Join-Path $ver.FullName "lib\x64\msvcrt.lib"
            if ((Test-Path $cl) -and (Test-Path $crt)) {
                return $ver.FullName
            }
        }
    }
    return $null
}

function Find-WindowsSdk {
    $kitsRoot = "${env:ProgramFiles(x86)}\Windows Kits\10"
    $includeRoot = Join-Path $kitsRoot "Include"
    if (-not (Test-Path $includeRoot)) { return $null }

    $versions = Get-ChildItem $includeRoot -Directory |
        Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
        Sort-Object { [version]$_.Name } -Descending

    foreach ($ver in $versions) {
        $ucrtInc = Join-Path $ver.FullName "ucrt"
        $umInc = Join-Path $ver.FullName "um"
        $ucrtLib = Join-Path $kitsRoot "Lib\$($ver.Name)\ucrt\x64"
        $umLib = Join-Path $kitsRoot "Lib\$($ver.Name)\um\x64"
        $bin = Join-Path $kitsRoot "bin\$($ver.Name)\x64"
        if ((Test-Path (Join-Path $ucrtInc "corecrt.h")) -and
            (Test-Path (Join-Path $ucrtLib "libucrt.lib")) -and
            (Test-Path (Join-Path $umLib "kernel32.lib"))) {
            return [pscustomobject]@{
                Version = $ver.Name
                IncludeUcrt = $ucrtInc
                IncludeUm = $umInc
                IncludeShared = (Join-Path $ver.FullName "shared")
                LibUcrt = $ucrtLib
                LibUm = $umLib
                Bin = $bin
            }
        }
    }
    return $null
}

function Import-ManualMsvcEnv {
    $msvc = Find-MsvcRoot
    if (-not $msvc) {
        Write-Error "Не найден MSVC с cl.exe + lib\x64\msvcrt.lib. Установи VS 2022 Build Tools (Desktop development with C++)."
    }

    $sdk = Find-WindowsSdk
    if (-not $sdk) {
        Write-Error "Не найден Windows 10/11 SDK (ucrt/um). Установи Windows SDK через Visual Studio Installer."
    }

    $msvcBin = Join-Path $msvc "bin\Hostx64\x64"
    $msvcLib = Join-Path $msvc "lib\x64"
    $msvcInc = Join-Path $msvc "include"

    $env:PATH = "$msvcBin;$($sdk.Bin);$env:PATH"
    $env:INCLUDE = "$msvcInc;$($sdk.IncludeUcrt);$($sdk.IncludeUm);$($sdk.IncludeShared)"
    $env:LIB = "$msvcLib;$($sdk.LibUcrt);$($sdk.LibUm)"
    $env:LIBPATH = $msvcLib

    Write-Host "Using manual MSVC env: $msvc"
    Write-Host "Using Windows SDK: $($sdk.Version)"
}

function Test-MsvcEnvReady {
    if (-not $env:LIB -or $env:LIB -notmatch "MSVC") { return $false }
    $cl = Get-Command cl.exe -ErrorAction SilentlyContinue
    if (-not $cl) { return $false }
    $msvcrt = ($env:LIB -split ";") | ForEach-Object {
        Join-Path $_ "msvcrt.lib"
    } | Where-Object { Test-Path $_ } | Select-Object -First 1
    return [bool]$msvcrt
}

function Find-VcVars64 {
    $candidates = @(
        "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat",
        "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvars64.bat"
    )
    foreach ($path in $candidates) {
        if (Test-Path $path) { return $path }
    }
    return $null
}

function Import-VcVars([string]$VcVarsBat) {
    $temp = Join-Path $env:TEMP ("whithin-vcvars-" + [guid]::NewGuid().ToString("n") + ".bat")
    @"
@echo off
set VSCMD_SKIP_SENDTELEMETRY=1
call "$VcVarsBat" >nul 2>&1
set
"@ | Set-Content -Path $temp -Encoding ASCII
    try {
        $output = & cmd.exe /c "`"$temp`""
        foreach ($line in $output) {
            if ($line -match "^(.*?)=(.*)$") {
                $name = $matches[1]
                $value = $matches[2]
                if ($name -match '^(PATH|INCLUDE|LIB|LIBPATH|WindowsSDK|VC|VS|UniversalCRT|NETFXSDK)') {
                    Set-Item -Path "Env:$name" -Value $value
                }
            }
        }
    } finally {
        Remove-Item $temp -Force -ErrorAction SilentlyContinue
    }
}

# Prefer manual env: side-by-side VS 18 breaks vcvars (empty VCToolsInstallDir) and can
# also pollute PATH enough to crash npm.ps1 when spawning the build.
Write-Host "Setting manual MSVC env (vcvars unreliable with VS 18 side-by-side)."
Import-ManualMsvcEnv

if (-not (Test-MsvcEnvReady)) {
    Write-Error "MSVC env still incomplete after fallback. Check Build Tools + Windows SDK install."
}

$msvcrt = ($env:LIB -split ";") | ForEach-Object {
    Join-Path $_ "msvcrt.lib"
} | Where-Object { Test-Path $_ } | Select-Object -First 1
Write-Host "Found CRT: $msvcrt"

# Ensure cargo stays on PATH even if vcvars rewrote it.
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path (Join-Path $cargoBin "cargo.exe")) {
    if (($env:PATH -split ";") -notcontains $cargoBin) {
        $env:PATH = "$cargoBin;$env:PATH"
    }
}

if ($args.Count -eq 0) {
    Write-Error "Нужна команда, например: .\scripts\with-msvc.ps1 npm run build:raw"
}

# Run via cmd so npm.cmd is used (npm.ps1 breaks on some MSVC PATH shapes).
$quoted = foreach ($arg in $args) {
    if ($arg -match '[\s"]') {
        '"' + ($arg -replace '"', '\"') + '"'
    } else {
        $arg
    }
}
$commandLine = [string]::Join(' ', $quoted)
Write-Host "Running: $commandLine"
cmd.exe /c $commandLine
exit $LASTEXITCODE

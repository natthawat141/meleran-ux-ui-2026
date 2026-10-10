param(
    [string]$EnvFile = (Join-Path $PSScriptRoot '../.env'),
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$entries = @{}
if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) {
    throw 'Environment file missing. Copy .env.example to .env first.'
}

$lineNumber = 0
foreach ($line in (Get-Content -LiteralPath $EnvFile -Encoding UTF8)) {
    $lineNumber++
    if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
    if ($line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
        throw "Invalid environment syntax at line $lineNumber. Expected KEY=value."
    }
    $key = $Matches[1]
    $value = $Matches[2].Trim()
    if ($entries.ContainsKey($key)) { throw "Duplicate environment key at line $lineNumber." }
    if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    $entries[$key] = $value
}

if ($CheckOnly) {
    Write-Output "Environment syntax valid ($($entries.Count) keys); values are not displayed."
    return
}

$previousValues = @{}
try {
    foreach ($key in $entries.Keys) {
        $previousValues[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
        # Blank placeholders do not override externally supplied credentials.
        if ($entries[$key] -ne '') { [Environment]::SetEnvironmentVariable($key, $entries[$key], 'Process') }
    }
    & dotnet run --project (Join-Path $repoRoot 'src/Melearn.Api') --no-launch-profile
    if ($LASTEXITCODE -ne 0) { throw "dotnet run failed with exit code $LASTEXITCODE." }
} finally {
    foreach ($key in $previousValues.Keys) {
        [Environment]::SetEnvironmentVariable($key, $previousValues[$key], 'Process')
    }
}

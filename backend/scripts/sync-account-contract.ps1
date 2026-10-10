param([string]$CanonicalPath = (Join-Path $PSScriptRoot '../../docs/api-contract/openapi.json'), [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$canonicalText = (Get-Content -LiteralPath $CanonicalPath -Raw).Replace("`r`n", "`n")
$spec = $canonicalText | ConvertFrom-Json -AsHashtable
$schemas = [ordered]@{}
$pending = [System.Collections.Generic.Queue[string]]::new()
foreach ($name in @('AdminUserPage', 'AdminUserDetailDto', 'InstructorPage', 'AssignInstructorResponse', 'CurrentUser', 'ErrorEnvelope')) { $pending.Enqueue($name) }
while ($pending.Count -gt 0) {
    $name = $pending.Dequeue()
    if ($schemas.Contains($name)) { continue }
    $schema = $spec.components.schemas[$name]
    if ($null -eq $schema) { throw "Missing canonical schema: $name" }
    $schemas[$name] = $schema
    foreach ($match in [regex]::Matches(($schema | ConvertTo-Json -Depth 100), '#/components/schemas/([^"\s]+)')) {
        $pending.Enqueue($match.Groups[1].Value)
    }
}
$operations = [ordered]@{}
foreach ($path in @('/admin/users', '/admin/users/{id}', '/admin/instructors', '/admin/users/{id}/instructor')) {
    $method = if ($path.EndsWith('/instructor')) { 'post' } else { 'get' }
    $operation = $spec.paths[$path][$method]
    $operations["$method $path"] = [ordered]@{
        parameters = $operation.parameters
        success_schema = $operation.responses['200'].content['application/json'].schema
    }
}
$fixture = [ordered]@{
    source = 'docs/api-contract/openapi.json (canonical shared repository)'
    source_normalized_sha256 = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([System.Text.Encoding]::UTF8.GetBytes($canonicalText)))
    operations = $operations
    schemas = $schemas
}
$destination = Join-Path $PSScriptRoot '../tests/Melearn.IntegrationTests/Fixtures/account-management-contract.json'
$content = (($fixture | ConvertTo-Json -Depth 100) + "`n").Replace("`r`n", "`n")
if ($CheckOnly) {
    if (!(Test-Path -LiteralPath $destination) -or (Get-Content -LiteralPath $destination -Raw).Replace("`r`n", "`n") -cne $content) {
        throw 'Account contract fixture differs from canonical. Review the change before regenerating.'
    }
    Write-Output 'Account contract fixture matches canonical.'
} else {
    New-Item -ItemType Directory -Path (Split-Path $destination) -Force | Out-Null
    $content | Set-Content -LiteralPath $destination -Encoding utf8NoBOM -NoNewline
}

param(
    [string]$Project = 'melearn-tutor',
    [string]$Region = 'asia-southeast3',
    [string]$ApiBaseUrl = '/api/v1',
    [switch]$MockPreview
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    if ((git status --porcelain).Length -gt 0) { throw 'Deploy from a clean, committed checkout.' }
    $imageTag = git rev-parse --short=12 HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve source revision.' }
    $billing = gcloud billing projects describe $Project --format='value(billingEnabled)' --quiet
    if ($LASTEXITCODE -ne 0 -or $billing -ne 'True') {
        throw 'Project billing must be linked by the owner before deployment. This script never links billing.'
    }
    gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project=$Project --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Enabling deployment APIs failed.' }

    $repository = 'melearn-frontend'
    $existing = gcloud artifacts repositories list --project=$Project --location=$Region --format='value(name)' --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect Artifact Registry.' }
    if (-not ($existing | Where-Object { $_ -eq $repository -or $_ -match "/repositories/$repository$" })) {
        gcloud artifacts repositories create $repository --repository-format=docker --location=$Region --project=$Project --quiet
        if ($LASTEXITCODE -ne 0) { throw 'Creating image repository failed.' }
    }
    $buildConfig = if ($MockPreview) { 'containers/cloudbuild.mock.yaml' } else { 'containers/cloudbuild.yaml' }
    $ignoreFile = if ($MockPreview) { '.gcloudignore.mock' } else { '.gcloudignore' }
    $substitutions = if ($MockPreview) { "_TAG=$imageTag,_REGION=$Region" } else { "_TAG=$imageTag,_REGION=$Region,_REPOSITORY=$repository,_API_BASE_URL=$ApiBaseUrl" }
    gcloud builds submit . --config=$buildConfig --ignore-file=$ignoreFile --project=$Project --region=$Region "--substitutions=$substitutions" --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cloud Build failed; services were not updated.' }

    # Static containers use an identity with no project roles, separate from the build identity.
    $runtimeAccount = "melearn-frontend-runtime@$Project.iam.gserviceaccount.com"
    $accounts = gcloud iam service-accounts list --project=$Project --format='value(email)' --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect runtime service accounts.' }
    if ($runtimeAccount -notin $accounts) {
        gcloud iam service-accounts create melearn-frontend-runtime --display-name='Melearn frontend static runtime' --project=$Project --quiet
        if ($LASTEXITCODE -ne 0) { throw 'Creating runtime identity failed.' }
    }
    foreach ($app in @('web', 'admin')) {
        $image = "$Region-docker.pkg.dev/$Project/$repository/${app}:$imageTag"
        $runtimeArgs = @()
        if ($MockPreview -and $app -eq 'admin') {
            $mockUpstream = gcloud run services describe melearn-web --project=$Project --region=$Region --format='value(status.url)' --quiet
            if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve shared Web mock service.' }
            $runtimeArgs = @("--set-env-vars=MOCK_UPSTREAM=$mockUpstream")
        }
        gcloud run deploy "melearn-$app" --image=$image --service-account=$runtimeAccount --project=$Project --region=$Region --port=8080 --cpu=1 --memory=256Mi --execution-environment=gen1 --concurrency=80 --min=0 --max=1 --min-instances=0 --max-instances=1 --cpu-throttling --no-cpu-boost --allow-unauthenticated @runtimeArgs --quiet
        if ($LASTEXITCODE -ne 0) { throw "Deployment failed for $app." }
        $serviceUrl = gcloud run services describe "melearn-$app" --project=$Project --region=$Region --format='value(status.url)' --quiet
        if ($LASTEXITCODE -ne 0) { throw "Cannot resolve $app service URL." }
        Write-Output "$app : $serviceUrl (source $imageTag)"
    }
    # New service URLs can take several minutes to propagate after Ready=True.
    foreach ($app in @('web', 'admin')) {
        $serviceUrl = gcloud run services describe "melearn-$app" --project=$Project --region=$Region --format='value(status.url)' --quiet
        if ($LASTEXITCODE -ne 0) { throw "Cannot resolve $app health URL." }
        $healthy = $false
        for ($attempt = 1; $attempt -le 30; $attempt++) {
            try {
                $health = Invoke-WebRequest -Uri "$serviceUrl/health" -UseBasicParsing -TimeoutSec 30
                $healthy = $health.StatusCode -eq 200 -and $health.Content.Trim() -eq 'ok'
            } catch { $healthy = $false }
            if ($healthy) { break }
            if ($attempt -lt 30) {
                Write-Output "Waiting for $app URL propagation ($attempt/30)."
                Start-Sleep -Seconds 10
            }
        }
        if (-not $healthy) { throw "Health check failed for $app after URL propagation retries." }
        Write-Output "$app health: ok"
    }
} finally { Pop-Location }

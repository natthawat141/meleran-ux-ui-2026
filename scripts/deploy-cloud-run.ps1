param(
    [string]$Project = 'melearn-tutor',
    [string]$Region = 'asia-southeast3',
    [string]$ApiBaseUrl = '/api/v1'
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
    gcloud builds submit . --config=containers/cloudbuild.yaml --ignore-file=.gcloudignore --project=$Project --region=$Region "--substitutions=_TAG=$imageTag,_REGION=$Region,_REPOSITORY=$repository,_API_BASE_URL=$ApiBaseUrl" --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Cloud Build failed; services were not updated.' }

    foreach ($app in @('web', 'admin')) {
        $image = "$Region-docker.pkg.dev/$Project/$repository/${app}:$imageTag"
        gcloud run deploy "melearn-$app" --image=$image --project=$Project --region=$Region --port=8080 --cpu=1 --memory=256Mi --execution-environment=gen1 --concurrency=80 --min=0 --max=1 --min-instances=0 --max-instances=1 --cpu-throttling --no-cpu-boost --allow-unauthenticated --quiet
        if ($LASTEXITCODE -ne 0) { throw "Deployment failed for $app." }
        $serviceUrl = gcloud run services describe "melearn-$app" --project=$Project --region=$Region --format='value(status.url)' --quiet
        if ($LASTEXITCODE -ne 0) { throw "Cannot resolve $app service URL." }
        $health = Invoke-WebRequest -Uri "$serviceUrl/healthz" -UseBasicParsing -TimeoutSec 60
        if ($health.StatusCode -ne 200 -or $health.Content.Trim() -ne 'ok') { throw "Health check failed for $app." }
        Write-Output "$app : $serviceUrl (source $imageTag)"
    }
} finally { Pop-Location }

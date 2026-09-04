param (
    [string]$projectId = "acg-gateway-2026",
    [string]$region = "asia-south1",
    [string]$service = "acg"
)

Write-Host "==> Target Project: $projectId" -ForegroundColor Cyan
Write-Host "==> Checking Google Cloud Billing Status..." -ForegroundColor Cyan
$billingInfo = gcloud beta billing projects describe $projectId --format="json" 2>$null | ConvertFrom-Json
if (-not $billingInfo.billingEnabled) {
    Write-Host "❌ Billing is NOT enabled for $projectId." -ForegroundColor Red
    Write-Host "Please link an active billing account at: https://console.cloud.google.com/billing/linkedaccount?project=$projectId" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Billing enabled: $($billingInfo.billingAccountName)" -ForegroundColor Green

Write-Host "==> Enabling required GCP APIs on $projectId..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com --project=$projectId
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to enable APIs." -ForegroundColor Red
    exit 1
}

Write-Host "==> Deploying to Google Cloud Run (Single Instance SQLite Reference)..." -ForegroundColor Cyan
$deployCmd = @(
    "run", "deploy", $service,
    "--source", ".",
    "--project", $projectId,
    "--region", $region,
    "--port", "3000",
    "--allow-unauthenticated",
    "--min-instances", "0",
    "--max-instances", "1",
    "--cpu", "1",
    "--memory", "512Mi",
    "--set-env-vars", "NODE_ENV=production,PORT=3000,HOST=0.0.0.0,DATABASE_PATH=/app/data/acg_gateway.db",
    "--format", "value(status.url)"
)

$runUrl = & gcloud @deployCmd
if (-not $runUrl) {
    Write-Host "❌ Deployment failed." -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
Write-Host "Live Service URL: $runUrl" -ForegroundColor Cyan

Write-Host "`n==> Running Live 23-Point GCP Verification Suite against $runUrl..." -ForegroundColor Cyan
npm run verify:gcp $runUrl

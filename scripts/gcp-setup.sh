#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# LaunchPromptly — GCP Infrastructure Setup
#
# Prerequisites:
#   1. gcloud CLI installed and authenticated: https://cloud.google.com/sdk/docs/install
#   2. A GCP project with billing enabled
#   3. You are a project Owner or Editor
#
# Usage:
#   export GCP_PROJECT_ID="your-project-id"
#   export GCP_REGION="us-west1"           # optional, defaults to us-west1
#   export DB_PASSWORD="strong-password"    # Cloud SQL password
#   bash scripts/gcp-setup.sh
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GCP_REGION:-us-west1}"
DB_PASSWORD="${DB_PASSWORD:?Set DB_PASSWORD for Cloud SQL}"

DB_INSTANCE="launchpromptly-db"
DB_NAME="launchpromptly"
DB_USER="launchpromptly"
REPO_NAME="launchpromptly"
API_SERVICE="launchpromptly-api"
WEB_SERVICE="launchpromptly-web"
MIGRATE_JOB="launchpromptly-migrate"

echo "═══════════════════════════════════════════════════════════"
echo "  LaunchPromptly — GCP Setup"
echo "  Project:  $PROJECT_ID"
echo "  Region:   $REGION"
echo "═══════════════════════════════════════════════════════════"

# ── 1. Set project ──────────────────────────────────────────────────────────
echo ""
echo "▸ Setting active project..."
gcloud config set project "$PROJECT_ID"

# ── 2. Enable required APIs ─────────────────────────────────────────────────
echo "▸ Enabling GCP APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# ── 3. Create Artifact Registry ─────────────────────────────────────────────
echo "▸ Creating Artifact Registry repository..."
if ! gcloud artifacts repositories describe "$REPO_NAME" \
  --location="$REGION" --project="$PROJECT_ID" &>/dev/null; then
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION" \
    --description="LaunchPromptly container images" \
    --project="$PROJECT_ID"
  echo "  ✓ Repository created"
else
  echo "  ✓ Repository already exists"
fi

# ── 4. Create Cloud SQL instance ────────────────────────────────────────────
echo "▸ Creating Cloud SQL PostgreSQL instance..."
if ! gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" &>/dev/null; then
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_16 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-auto-increase \
    --storage-size=10GB \
    --project="$PROJECT_ID"

  gcloud sql users set-password postgres \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD" \
    --project="$PROJECT_ID"

  gcloud sql users create "$DB_USER" \
    --instance="$DB_INSTANCE" \
    --password="$DB_PASSWORD" \
    --project="$PROJECT_ID"

  gcloud sql databases create "$DB_NAME" \
    --instance="$DB_INSTANCE" \
    --project="$PROJECT_ID"

  echo "  ✓ Cloud SQL instance created"
else
  echo "  ✓ Cloud SQL instance already exists"
fi

# Get the Cloud SQL connection name
DB_CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE" \
  --project="$PROJECT_ID" --format='value(connectionName)')
echo "  Connection: $DB_CONNECTION_NAME"

# ── 5. Create secrets ───────────────────────────────────────────────────────
echo "▸ Creating secrets in Secret Manager..."

create_secret() {
  local name="$1"
  local value="$2"
  if ! gcloud secrets describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    printf '%s' "$value" | gcloud secrets create "$name" \
      --data-file=- --project="$PROJECT_ID"
    echo "  ✓ Created secret: $name"
  else
    echo "  ✓ Secret already exists: $name"
  fi
}

# Generate random secrets for production
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${DB_CONNECTION_NAME}"

create_secret "lp-database-url" "$DATABASE_URL"
create_secret "lp-jwt-secret" "$JWT_SECRET"
create_secret "lp-encryption-key" "$ENCRYPTION_KEY"

# ── 6. Grant Cloud Run access to secrets ────────────────────────────────────
echo "▸ Granting Cloud Run service account access to secrets..."
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

for secret in lp-database-url lp-jwt-secret lp-encryption-key; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project="$PROJECT_ID" --quiet
done
echo "  ✓ IAM bindings set"

# ── 7. Grant Cloud Build permissions ────────────────────────────────────────
echo "▸ Granting Cloud Build permissions..."
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/run.admin" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/iam.serviceAccountUser" --quiet

echo "  ✓ Cloud Build permissions set"

# ── 8. Deploy API to Cloud Run ──────────────────────────────────────────────
echo "▸ Deploying API service to Cloud Run..."
API_URL_VAR="https://${API_SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"

gcloud run deploy "$API_SERVICE" \
  --image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/api:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --add-cloudsql-instances="$DB_CONNECTION_NAME" \
  --set-secrets="DATABASE_URL=lp-database-url:latest,JWT_SECRET=lp-jwt-secret:latest,ENCRYPTION_KEY=lp-encryption-key:latest" \
  --set-env-vars="NODE_ENV=production,API_PORT=3001" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "  ⚠ API image not pushed yet — run 'gcloud builds submit' first"

# ── 9. Create migration job ────────────────────────────────────────────────
echo "▸ Creating Cloud Run migration job..."
gcloud run jobs create "$MIGRATE_JOB" \
  --image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/api:latest" \
  --region="$REGION" \
  --add-cloudsql-instances="$DB_CONNECTION_NAME" \
  --set-secrets="DATABASE_URL=lp-database-url:latest" \
  --command="npx" \
  --args="prisma,migrate,deploy,--schema=../../prisma/schema.prisma" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "  ⚠ Migration job creation deferred — push images first"

# ── 10. Get API URL ─────────────────────────────────────────────────────────
API_URL=$(gcloud run services describe "$API_SERVICE" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)' 2>/dev/null || echo "pending")

# ── 11. Deploy Web to Cloud Run ─────────────────────────────────────────────
echo "▸ Deploying Web service to Cloud Run..."
gcloud run deploy "$WEB_SERVICE" \
  --image="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/web:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --set-env-vars="NODE_ENV=production" \
  --project="$PROJECT_ID" \
  --quiet 2>/dev/null || echo "  ⚠ Web image not pushed yet — run 'gcloud builds submit' first"

# ── Summary ─────────────────────────────────────────────────────────────────
WEB_URL=$(gcloud run services describe "$WEB_SERVICE" \
  --region="$REGION" --project="$PROJECT_ID" \
  --format='value(status.url)' 2>/dev/null || echo "pending")

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Cloud SQL:   $DB_CONNECTION_NAME"
echo "  API URL:     $API_URL"
echo "  Web URL:     $WEB_URL"
echo ""
echo "  Next steps:"
echo "  1. Build & push images:"
echo "     gcloud builds submit --config=cloudbuild.yaml \\"
echo "       --substitutions=_REGION=$REGION,_API_URL=$API_URL"
echo ""
echo "  2. Run migrations:"
echo "     gcloud run jobs execute $MIGRATE_JOB --region=$REGION"
echo ""
echo "  3. Update CORS_ORIGIN on API service:"
echo "     gcloud run services update $API_SERVICE \\"
echo "       --region=$REGION --update-env-vars=CORS_ORIGIN=$WEB_URL,APP_URL=$WEB_URL"
echo ""
echo "  4. (Optional) Set up Cloud Build trigger for CI/CD:"
echo "     gcloud builds triggers create github \\"
echo "       --repo-name=launchpromptly --repo-owner=YOUR_ORG \\"
echo "       --branch-pattern='^main$' --build-config=cloudbuild.yaml \\"
echo "       --substitutions=_REGION=$REGION"
echo ""

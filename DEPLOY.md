# Deploying LaunchPromptly

## Quick Deploy with Docker Compose (VPS / Self-hosted)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with production values (generate secrets, set DATABASE_URL, etc.)

# 2. Start everything
docker compose up -d

# App will be at http://localhost:3000
# API will be at http://localhost:3001
```

---

## Deploy to Google Cloud (Cloud Run + Cloud SQL)

### Prerequisites

```bash
# Install gcloud CLI
brew install --cask google-cloud-sdk

# Login & set project
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 1. Create Cloud SQL PostgreSQL instance

```bash
# Create instance (db-f1-micro = ~$9/mo, good for starting)
gcloud sql instances create launchpromptly-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-west1 \
  --storage-size=10GB \
  --storage-auto-increase

# Set password
gcloud sql users set-password postgres \
  --instance=launchpromptly-db \
  --password=YOUR_DB_PASSWORD

# Create database
gcloud sql databases create launchpromptly --instance=launchpromptly-db
```

### 2. Create Artifact Registry repository

```bash
gcloud artifacts repositories create launchpromptly \
  --repository-format=docker \
  --location=us-west1
```

### 3. Store secrets in Secret Manager

```bash
# Generate secrets
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Store them
echo -n "$JWT_SECRET" | gcloud secrets create jwt-secret --data-file=-
echo -n "$ENCRYPTION_KEY" | gcloud secrets create encryption-key --data-file=-
echo -n "YOUR_ANTHROPIC_KEY" | gcloud secrets create anthropic-api-key --data-file=-
```

### 4. Build and push Docker images

```bash
REGION=us-west1
PROJECT_ID=$(gcloud config get-value project)
REGISTRY=$REGION-docker.pkg.dev/$PROJECT_ID/launchpromptly

# Build & push API
docker build -f apps/api/Dockerfile -t $REGISTRY/api:latest .
docker push $REGISTRY/api:latest

# Build & push Web (inject API URL at build time)
API_URL=https://launchpromptly-api-HASH-uw.a.run.app  # You'll get this after deploying API
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=$API_URL \
  -t $REGISTRY/web:latest .
docker push $REGISTRY/web:latest
```

### 5. Deploy API to Cloud Run

```bash
INSTANCE_CONNECTION=$(gcloud sql instances describe launchpromptly-db --format='value(connectionName)')

gcloud run deploy launchpromptly-api \
  --image=$REGISTRY/api:latest \
  --region=us-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3001 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=5 \
  --add-cloudsql-instances=$INSTANCE_CONNECTION \
  --set-env-vars="API_PORT=3001" \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@/launchpromptly?host=/cloudsql/$INSTANCE_CONNECTION" \
  --set-secrets="JWT_SECRET=jwt-secret:latest,ENCRYPTION_KEY=encryption-key:latest,ANTHROPIC_API_KEY=anthropic-api-key:latest" \
  --set-env-vars="CORS_ORIGIN=https://launchpromptly-web-HASH-uw.a.run.app" \
  --set-env-vars="APP_URL=https://launchpromptly-web-HASH-uw.a.run.app"
```

### 6. Run database migrations

```bash
# Get the API service URL
API_URL=$(gcloud run services describe launchpromptly-api --region=us-west1 --format='value(status.url)')

# Run migrations via Cloud Run job (one-off)
gcloud run jobs create launchpromptly-migrate \
  --image=$REGISTRY/api:latest \
  --region=us-west1 \
  --add-cloudsql-instances=$INSTANCE_CONNECTION \
  --set-env-vars="DATABASE_URL=postgresql://postgres:YOUR_DB_PASSWORD@/launchpromptly?host=/cloudsql/$INSTANCE_CONNECTION" \
  --command="npx" \
  --args="prisma,migrate,deploy,--schema=../../prisma/schema.prisma" \
  --execute-now
```

### 7. Deploy Web to Cloud Run

```bash
# Get API URL from step 5
API_URL=$(gcloud run services describe launchpromptly-api --region=us-west1 --format='value(status.url)')

# Rebuild web with correct API URL
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=$API_URL \
  -t $REGISTRY/web:latest .
docker push $REGISTRY/web:latest

gcloud run deploy launchpromptly-web \
  --image=$REGISTRY/web:latest \
  --region=us-west1 \
  --platform=managed \
  --allow-unauthenticated \
  --port=3000 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3

# Update API's CORS_ORIGIN with the actual web URL
WEB_URL=$(gcloud run services describe launchpromptly-web --region=us-west1 --format='value(status.url)')
gcloud run services update launchpromptly-api \
  --region=us-west1 \
  --set-env-vars="CORS_ORIGIN=$WEB_URL,APP_URL=$WEB_URL"
```

### 8. (Optional) Map custom domain

```bash
gcloud run domain-mappings create \
  --service=launchpromptly-web \
  --domain=launchpromptly.dev \
  --region=us-west1

gcloud run domain-mappings create \
  --service=launchpromptly-api \
  --domain=api.launchpromptly.dev \
  --region=us-west1
```

---

## CI/CD with Cloud Build

The included `cloudbuild.yaml` automates builds and deploys on every push to `main`.

### Setup

```bash
# Grant Cloud Build permissions
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format='value(projectNumber)')

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
  --role=roles/run.admin

gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member=serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com \
  --role=roles/iam.serviceAccountUser

# Connect repo and create trigger
gcloud builds triggers create github \
  --repo-name=launchpromptly \
  --repo-owner=YOUR_GITHUB_USERNAME \
  --branch-pattern="^main$" \
  --build-config=cloudbuild.yaml
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | 64-char hex secret for JWT signing |
| `ENCRYPTION_KEY` | Yes | 64-char hex secret for AES-256-GCM encryption |
| `API_PORT` | No | API server port (default: 3001) |
| `CORS_ORIGIN` | Yes | Allowed CORS origins (comma-separated) |
| `APP_URL` | Yes | Frontend URL (used in invitation emails) |
| `NEXT_PUBLIC_API_URL` | Yes | API URL for the frontend |
| `ANTHROPIC_API_KEY` | No | Enables bundled LLM credits for evals/playground |
| `LS_STORE_ID` | No | Lemon Squeezy store slug |
| `LS_WEBHOOK_SECRET` | No | Lemon Squeezy webhook secret |
| `LS_VARIANT_PRO` | No | Lemon Squeezy variant ID for Pro plan |
| `LS_VARIANT_TEAM` | No | Lemon Squeezy variant ID for Team plan |

## Cost Estimate

| Service | Spec | Monthly |
|---------|------|---------|
| Cloud Run (API) | 1 vCPU, 512MB, min 0 | ~$0 (free tier) |
| Cloud Run (Web) | 1 vCPU, 256MB, min 0 | ~$0 (free tier) |
| Cloud SQL | db-f1-micro, 10GB | ~$9 |
| Artifact Registry | Docker images | ~$0.10 |
| **Total** | | **~$10/mo** |

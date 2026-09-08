# Monopoly Network Edition: Version 2 Cloud Deployment Guide

This guide details how to deploy the Monopoly multiplayer game on **Google Cloud Platform (GCP)** or **Amazon Web Services (AWS)** so you and your friends can play across the internet from anywhere without being on the same local Wi-Fi.

---

## 1. Google Cloud Platform (GCP) Deployment

### Option A: Google Cloud Run (Recommended - Serverless & Cost Effective)
Google Cloud Run natively supports WebSockets and automatically provisions HTTPS/WSS certificates.

1. **Build and push image to Google Artifact Registry**:
   ```bash
   # Set your project ID
   gcloud config set project YOUR_GCP_PROJECT_ID

   # Build container using Cloud Build
   gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/monopoly-game:latest
   ```

2. **Deploy to Cloud Run with Session Affinity and Volume Mount**:
   ```bash
   gcloud run deploy monopoly-game \
     --image gcr.io/YOUR_GCP_PROJECT_ID/monopoly-game:latest \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --port 3000 \
     --session-affinity \
     --timeout 3600
   ```
   > **Note on Persistence**: For multi-day persistent state on Cloud Run, attach a Google Cloud Storage volume or Cloud Filestore volume to `/app/server/storage/rooms` using Cloud Run volume mounts.

---

## 2. Amazon Web Services (AWS) Deployment

### Option A: AWS App Runner
1. Push the Docker image to Amazon Elastic Container Registry (ECR).
2. Create an App Runner service:
   - Source: Container image.
   - Port: `3000`.
   - Protocol: HTTP (App Runner terminates SSL automatically and routes WebSockets).

### Option B: AWS Elastic Beanstalk / Lightsail (Easiest Full Persistence)
1. **AWS Lightsail Container Service**:
   - Create a Lightsail container service ($7/month).
   - Upload the container image via AWS CLI:
     ```bash
     aws lightsail push-container-image --service-name monopoly --label latest --image monopoly-game:latest
     ```
   - Lightsail provides an instant public HTTPS domain with full WebSocket support and persistent local disk.

---

## 3. Environment Configuration

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port the Node.js server listens on |
| `HOST` | `0.0.0.0` | Bind address (0.0.0.0 binds to all interfaces) |
| `NODE_ENV` | `production` | Production optimizations |

---

## 4. Game State Persistence Across Restarts
Game rooms are automatically snapshotted after every move in `server/storage/rooms/<roomId>.json`. When running in cloud containers, mount this directory to persistent block storage (EBS on AWS, Persistent Disk on GCP) to ensure all active games are preserved across container updates or scaling events.

#!/bin/bash

echo "=========================================="
echo " Deploying MLP & Solar to Cloud Run"
echo "=========================================="

# 1. Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "Error: Google Cloud CLI (gcloud) is not installed."
    echo "Please install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 2. Get active project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No Google Cloud project configured."
    echo "Please run: gcloud auth login && gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "Current GCP Project: $PROJECT_ID"
echo ""

# 3. Prompt for App Credentials
echo "Let's set up the password protection for your app."
echo "These are the credentials you will use to log in when you open the URL."
read -p "Username (e.g., peter): " AUTH_USER
read -s -p "Password: " AUTH_PASS
echo ""
echo ""

if [ -z "$AUTH_USER" ] || [ -z "$AUTH_PASS" ]; then
    echo "Error: Username and Password cannot be empty."
    exit 1
fi

# 4. Deploy to Cloud Run
SERVICE_NAME="mlp-solar-app"
REGION="europe-north1" # Hamina, Finland (fastest for you)

echo "Deploying container from source to Cloud Run..."
echo "This might take a few minutes as Google builds the Docker container in the cloud."

gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --port=8080 \
    --set-env-vars="AUTH_USERNAME=$AUTH_USER,AUTH_PASSWORD=$AUTH_PASS"

echo ""
echo "=========================================="
echo " Deployment Complete!"
echo "=========================================="
echo "You can now visit the URL provided above."
echo "Use the Username and Password you just entered to log in."

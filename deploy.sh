#!/bin/bash

# --- Configuration Section ---
# Replace with your actual Discord Webhook URL
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1483957616442081413/jzpwwv-JkxR-IAgf4uJLez0406cx5_60-JVtrvodTaxEmTICpGfrLsVPVLD-bjz5zq0_"
# Define your project name for identification in Discord notifications
PROJECT_NAME="BUU-Exchange-app" 
# -----------------------------

# Exit immediately if any command exits with a non-zero status (error)
set -e

# Function to send embedded messages to Discord using a Webhook
# Parameters: $1 = Decimal Color, $2 = Title, $3 = Description
send_discord_msg() {
    local color="$1"
    local title="$2"
    local desc="$3"
    
    curl -H "Content-Type: application/json" \
         -X POST \
         -d '{
            "embeds": [{
                "title": "'"$title"'",
                "description": "'"$desc"'",
                "color": '"$color"'
            }]
         }' "$DISCORD_WEBHOOK"
}

# Error Handling: Execute this trap if any command fails (ERR signal)
trap 'send_discord_msg 16711680 "❌ Deployment Failed!" "Project: '"$PROJECT_NAME"'\nStep: An error occurred during deployment. Check Proxmox logs for details."' ERR

# Notification: Notify Discord that the deployment has started
echo "🚀 Starting Deployment Process..."
send_discord_msg 3447003 "⏳ Deployment Started" "Starting update for '"$PROJECT_NAME"' on Proxmox..."

# Step 1: Stop and remove existing containers, networks, and images defined in the compose file
echo "🛑 Step 1: Stopping current containers..."
docker compose down

# Step 2: Fetch the latest version of the code from the remote repository
echo "📥 Step 2: Pulling latest code..."
git pull origin main

# Step 3: Build or rebuild services defined in the docker-compose file
echo "🏗️  Step 3: Building Docker images..."
docker compose build

# Step 4: Create and start containers in detached mode
echo "🚢 Step 4: Starting new containers..."
docker compose up -d

# Step 5: Cleaning up unused Docker data..."
echo "🧹 Step 5: Cleaning up unused Docker data..."
docker image prune -f
docker builder prune -f --filter "until=24h"

# Step 6: Final success notification
echo "🎉 Deployment Completed!"
send_discord_msg 65280 "✅ Deployment Successful!" "Project: '"$PROJECT_NAME"'\nStatus: Everything is up and running successfully on Proxmox lxc container!"
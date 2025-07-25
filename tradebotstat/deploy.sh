#!/bin/bash

# Digital Ocean Deployment Script

echo "🚀 Deploying Crypto Trading Bot to Digital Ocean..."

# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Clone repository (replace with your repo)
git clone https://github.com/yourusername/crypto-telegram-bot.git
cd crypto-telegram-bot

# Setup environment
cp .env.example .env
echo "⚠️  Please edit .env file with your credentials"
nano .env

# Build and start
docker-compose up -d

echo "✅ Bot deployed successfully!"
echo "📊 Check logs: docker-compose logs -f"
echo "🔄 Restart: docker-compose restart"
echo "🛑 Stop: docker-compose down"

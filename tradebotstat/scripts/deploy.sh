#!/bin/bash

echo "🚀 INJ Trading Bot Deployment Başlatılıyor..."

# Sistem güncellemeleri
sudo apt update && sudo apt upgrade -y

# Node.js ve npm yükle
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker yükle
sudo apt-get install -y docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER

# Proje klasörü oluştur
mkdir -p /opt/inj-trading-bot
cd /opt/inj-trading-bot

# Git clone (eğer repository varsa)
# git clone <your-repo-url> .

# Dependencies yükle
npm install

# PM2 yükle (process manager)
sudo npm install -g pm2

# Logs klasörü oluştur
mkdir -p logs

# .env dosyasını düzenle
echo "⚠️  .env dosyasını düzenlemeyi unutmayın!"
echo "📝 Gerekli API anahtarları:"
echo "   - TELEGRAM_BOT_TOKEN"
echo "   - TELEGRAM_CHAT_ID"
echo "   - BINANCE_API_KEY"
echo "   - BINANCE_API_SECRET"
echo "   - NEWS_API_KEY"

# PM2 ile başlat
pm2 start src/index.js --name "inj-trading-bot"
pm2 startup
pm2 save

echo "✅ Deployment tamamlandı!"
echo "📊 Bot durumunu kontrol etmek için: pm2 status"
echo "📋 Logları görmek için: pm2 logs inj-trading-bot"

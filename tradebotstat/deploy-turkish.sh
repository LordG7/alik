#!/bin/bash

echo "🇹🇷 Türkçe Crypto Trading Bot Kurulumu"
echo "======================================"

# Mevcut botu durdur
pm2 stop crypto-bot 2>/dev/null
pkill -f bot.js 2>/dev/null

# Yedek oluştur
if [ -f "bot.js" ]; then
    cp bot.js bot-english.js.backup
    echo "✅ İngilizce bot yedeklendi"
fi

# Türkçe bot dosyasını kopyala
cp bot-turkish.js bot.js
echo "✅ Türkçe bot aktif edildi"

# Botu yeniden başlat
if command -v pm2 &> /dev/null; then
    pm2 start bot.js --name crypto-bot
    echo "🚀 Türkçe bot PM2 ile başlatıldı"
else
    nohup node bot.js > bot.log 2>&1 &
    echo "🚀 Türkçe bot doğrudan başlatıldı"
fi

echo ""
echo "🎯 Türkçe Komutlar:"
echo "• /simdi - Anlık piyasa analizi"
echo "• /durum - Bot durumu"
echo "• /pozisyonlar - Aktif pozisyonlar"
echo ""
echo "✅ Türkçe arayüz aktif!"

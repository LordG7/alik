#!/bin/bash

echo "🌍 Dil Değiştirici"
echo "=================="

if [ "$1" = "tr" ] || [ "$1" = "turkish" ]; then
    echo "🇹🇷 Türkçe'ye geçiliyor..."
    pm2 stop crypto-bot 2>/dev/null
    cp bot-turkish.js bot.js
    pm2 start bot.js --name crypto-bot
    echo "✅ Türkçe aktif!"
    
elif [ "$1" = "en" ] || [ "$1" = "english" ]; then
    echo "🇺🇸 İngilizce'ye geçiliyor..."
    pm2 stop crypto-bot 2>/dev/null
    if [ -f "bot-english.js.backup" ]; then
        cp bot-english.js.backup bot.js
    else
        echo "❌ İngilizce yedek bulunamadı"
        exit 1
    fi
    pm2 start bot.js --name crypto-bot
    echo "✅ İngilizce aktif!"
    
else
    echo "Kullanım: ./switch-language.sh [tr|en]"
    echo "Örnek: ./switch-language.sh tr"
fi

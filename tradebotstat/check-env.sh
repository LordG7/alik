#!/bin/bash

echo "🔍 Environment Variables Kontrolü"
echo "=================================="

# .env dosyası var mı kontrol et
if [ ! -f .env ]; then
    echo "❌ .env dosyası bulunamadı!"
    echo "💡 .env dosyası oluşturuluyor..."
    
    cat > .env << 'EOF'
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=8154469425:AAEaXl28iuRUaguDj4E9CmDmI2p7jGoAJ3U
TELEGRAM_CHAT_ID=6540447361

# Binance API Configuration (Read-Only)
BINANCE_API_KEY=yOyEdpmBsRdiBuEI8DJssxnqcl5atYpPRs8xqtedj8dtlSsNsoYKIp7hQjVmOidr
BINANCE_API_SECRET=j5m9N3Czq7VAp56VjbP0vDFYCXOSoM8kwzX9Gej7Ule69AkLcbkYRbGzl2iHM0DC

# News API Configuration
NEWS_API_KEY=https://cryptonews-api.com/api/v1/category?section=general&items=10&token=ld3suy9jpotu2jyyjxqmiysfo7pgu5sltygaparg

# Fear & Greed Index API
FEAR_GREED_API=https://api.alternative.me/fng/

# Bot Configuration
NODE_ENV=production
TZ=Asia/Baku
EOF
    
    chmod 600 .env
    echo "✅ .env dosyası oluşturuldu"
else
    echo "✅ .env dosyası mevcut"
fi

echo ""
echo "📋 Environment Variables:"
echo "========================"

# .env dosyasını oku ve göster (güvenlik için token'ları kısalt)
if [ -f .env ]; then
    while IFS= read -r line; do
        if [[ $line == *"="* ]] && [[ $line != "#"* ]]; then
            key=$(echo $line | cut -d'=' -f1)
            value=$(echo $line | cut -d'=' -f2-)
            
            # Token'ları güvenlik için kısalt
            if [[ $key == *"TOKEN"* ]] || [[ $key == *"SECRET"* ]] || [[ $key == *"KEY"* ]]; then
                if [ ${#value} -gt 20 ]; then
                    short_value="${value:0:10}...${value: -5}"
                else
                    short_value="$value"
                fi
                echo "$key=$short_value"
            else
                echo "$key=$value"
            fi
        fi
    done < .env
fi

echo ""
echo "🧪 Node.js Environment Test:"
echo "============================"

# Node.js ile environment variables test et
node -e "
require('dotenv').config();
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'SET (' + process.env.TELEGRAM_BOT_TOKEN.substring(0,10) + '...)' : 'NOT SET');
console.log('TELEGRAM_CHAT_ID:', process.env.TELEGRAM_CHAT_ID || 'NOT SET');
console.log('BINANCE_API_KEY:', process.env.BINANCE_API_KEY ? 'SET (' + process.env.BINANCE_API_KEY.substring(0,10) + '...)' : 'NOT SET');
console.log('BINANCE_API_SECRET:', process.env.BINANCE_API_SECRET ? 'SET (' + process.env.BINANCE_API_SECRET.substring(0,10) + '...)' : 'NOT SET');
"

echo ""
echo "🔧 Dosya İzinleri:"
echo "=================="
ls -la .env

echo ""
echo "📁 Çalışma Dizini:"
echo "=================="
pwd
ls -la | grep -E "\.(js|json|env)$"

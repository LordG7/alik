#!/bin/bash

# Bu script SADECE root kullanıcısı ile çalıştırılmalıdır
# Normal kullanıcı oluşturur ve gerekli yetkileri verir

if [[ $EUID -ne 0 ]]; then
   echo "❌ Bu script root kullanıcısı ile çalıştırılmalıdır!"
   echo "💡 Çalıştırma: sudo ./root-setup.sh"
   exit 1
fi

echo "🔧 INJ Trading Bot - Root Setup"
echo "==============================="

# Create trading user if not exists
if ! id "trader" &>/dev/null; then
    echo "👤 'trader' kullanıcısı oluşturuluyor..."
    adduser --disabled-password --gecos "" trader
    echo "trader:TradingBot2025!" | chpasswd
    echo "✅ Kullanıcı oluşturuldu: trader"
else
    echo "✅ 'trader' kullanıcısı zaten mevcut"
fi

# Add to sudo group
echo "🔐 Sudo yetkisi veriliyor..."
usermod -aG sudo trader

# Create project directory and set permissions
echo "📁 Proje dizini hazırlanıyor..."
mkdir -p /opt/inj-trading-bot
chown -R trader:trader /opt/inj-trading-bot

# Copy deployment script to user directory
echo "📋 Deployment scripti kopyalanıyor..."
cp deploy.sh /home/trader/
chown trader:trader /home/trader/deploy.sh
chmod +x /home/trader/deploy.sh

echo ""
echo "✅ Root setup tamamlandı!"
echo ""
echo "📋 Sonraki adımlar:"
echo "   1. Kullanıcı değiştir: su - trader"
echo "   2. Deployment çalıştır: ./deploy.sh"
echo ""
echo "🔑 Trader kullanıcı bilgileri:"
echo "   Kullanıcı: trader"
echo "   Şifre: TradingBot2025!"
echo ""

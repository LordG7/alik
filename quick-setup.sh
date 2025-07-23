#!/bin/bash

# Hızlı kurulum scripti - Tüm adımları otomatik yapar

echo "⚡ INJ Trading Bot - Hızlı Kurulum"
echo "=================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "🔧 Root kullanıcısı tespit edildi, normal kullanıcı oluşturuluyor..."
    
    # Create trader user
    if ! id "trader" &>/dev/null; then
        adduser --disabled-password --gecos "" trader
        echo "trader:TradingBot2025!" | chpasswd
        usermod -aG sudo trader
        echo "✅ 'trader' kullanıcısı oluşturuldu"
    fi
    
    # Create project directory
    mkdir -p /opt/inj-trading-bot
    chown -R trader:trader /opt/inj-trading-bot
    
    # Copy script to trader home
    cp deploy.sh /home/trader/ 2>/dev/null || echo "deploy.sh bulunamadı"
    chown trader:trader /home/trader/deploy.sh 2>/dev/null
    chmod +x /home/trader/deploy.sh 2>/dev/null
    
    echo ""
    echo "🔄 Normal kullanıcıya geçiliyor ve deployment başlatılıyor..."
    echo ""
    
    # Switch to trader user and run deployment
    su - trader -c "cd /home/trader && ./deploy.sh"
    
else
    echo "👤 Normal kullanıcı tespit edildi: $USER"
    
    # Check sudo privileges
    if ! sudo -n true 2>/dev/null; then
        echo "❌ Sudo yetkisi yok! Root ile şu komutu çalıştırın:"
        echo "   usermod -aG sudo $USER"
        exit 1
    fi
    
    echo "✅ Sudo yetkisi mevcut, deployment başlatılıyor..."
    ./deploy.sh
fi

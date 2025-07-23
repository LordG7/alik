#!/bin/bash

# INJ Trading Bot - User Setup and Run Script
# Bu script normal kullanıcı ile çalıştırılmalıdır

echo "🔧 INJ Trading Bot - Kullanıcı Kurulumu"
echo "======================================="

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ Bu script root kullanıcısı ile çalıştırılmamalıdır!"
   echo "💡 Çözüm:"
   echo "   1. Normal kullanıcı oluşturun: adduser trader"
   echo "   2. Sudo yetkisi verin: usermod -aG sudo trader"
   echo "   3. Kullanıcı değiştirin: su - trader"
   echo "   4. Scripti tekrar çalıştırın: ./deploy.sh"
   exit 1
fi

# Check if user has sudo privileges
if ! sudo -n true 2>/dev/null; then
    echo "⚠️  Bu kullanıcının sudo yetkisi yok!"
    echo "💡 Root kullanıcısı ile şu komutu çalıştırın:"
    echo "   usermod -aG sudo $USER"
    echo "   Sonra logout/login yapın ve tekrar deneyin."
    exit 1
fi

echo "✅ Kullanıcı kontrolü başarılı: $USER"
echo "🚀 Ana deployment scripti çalıştırılıyor..."

# Run the main deployment script
./deploy.sh

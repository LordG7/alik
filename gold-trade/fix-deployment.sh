#!/bin/bash

echo "🔧 Fixing GOLD Scalping Bot deployment..."

# Stop the service first
sudo systemctl stop gold-scalping-bot

# Remove old installation
sudo rm -rf /opt/gold-scalping-bot

# Run the complete setup
chmod +x setup-bot.sh
./setup-bot.sh

echo ""
echo "✅ Fix completed!"
echo ""
echo "📝 Now edit your credentials:"
echo "sudo nano /opt/gold-scalping-bot/.env"
echo ""
echo "Then start the bot:"
echo "sudo systemctl start gold-scalping-bot"

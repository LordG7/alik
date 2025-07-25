#!/bin/bash

echo "📋 Manual Setup Guide for Crypto Trading Bot"
echo "============================================="

# Create all necessary files
echo "Creating bot files..."

# You'll need to copy your bot files here
echo "Please copy the following files to your project directory:"
echo "- bot.js (main bot file)"
echo "- indicators.js (technical analysis)"
echo "- exchange.js (exchange integration)"
echo "- risk-manager.js (risk management)"
echo "- pairs-manager.js (pairs management)"
echo "- error-handler.js (error handling)"

# Install dependencies
echo "Installing Node.js dependencies..."
npm install

# Setup PM2
echo "Setting up PM2 process manager..."
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'crypto-bot',
    script: 'bot.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}
EOF

echo "✅ Manual setup completed!"
echo ""
echo "🚀 To start the bot:"
echo "pm2 start ecosystem.config.js"
echo ""
echo "📊 To monitor:"
echo "pm2 monit"
echo ""
echo "📋 To view logs:"
echo "pm2 logs crypto-bot"

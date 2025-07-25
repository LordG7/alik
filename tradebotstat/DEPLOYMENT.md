# Deployment Guide for Digital Ocean

## Quick Setup

1. **Run the fixed deployment script:**
\`\`\`bash
chmod +x deploy-fixed.sh
./deploy-fixed.sh
\`\`\`

2. **Copy your bot files to the project directory:**
\`\`\`bash
# Copy all your .js files to the crypto-telegram-bot directory
cp bot.js crypto-telegram-bot/
cp indicators.js crypto-telegram-bot/
cp exchange.js crypto-telegram-bot/
cp risk-manager.js crypto-telegram-bot/
cp pairs-manager.js crypto-telegram-bot/
cp error-handler.js crypto-telegram-bot/
\`\`\`

3. **Configure environment:**
\`\`\`bash
cd crypto-telegram-bot
nano .env
\`\`\`

4. **Start the bot:**
\`\`\`bash
./start-bot.sh
\`\`\`

## Alternative Methods

### Method 1: PM2 (Recommended)
\`\`\`bash
# Install dependencies
npm install

# Start with PM2
pm2 start bot.js --name crypto-bot

# Save PM2 configuration
pm2 save
pm2 startup
\`\`\`

### Method 2: Docker
\`\`\`bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
\`\`\`

### Method 3: Systemd Service
\`\`\`bash
# Copy service file
sudo cp crypto-bot.service /etc/systemd/system/

# Enable and start
sudo systemctl enable crypto-bot
sudo systemctl start crypto-bot

# Check status
sudo systemctl status crypto-bot
\`\`\`

## Troubleshooting

### Docker Issues
\`\`\`bash
# Start Docker daemon
sudo systemctl start docker

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
\`\`\`

### Permission Issues
\`\`\`bash
# Fix file permissions
chmod +x *.sh
sudo chown -R $USER:$USER .
\`\`\`

### Port Issues
\`\`\`bash
# Check if port is in use
sudo netstat -tulpn | grep :3000

# Kill process using port
sudo kill -9 $(sudo lsof -t -i:3000)
\`\`\`

## Monitoring

### PM2 Monitoring
\`\`\`bash
pm2 status          # Check status
pm2 logs crypto-bot # View logs
pm2 monit          # Real-time monitoring
pm2 restart crypto-bot # Restart bot
\`\`\`

### Docker Monitoring
\`\`\`bash
docker-compose logs -f     # Follow logs
docker-compose ps          # Check containers
docker-compose restart     # Restart services
\`\`\`

## Security

1. **Firewall Setup:**
\`\`\`bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
\`\`\`

2. **Environment Security:**
\`\`\`bash
chmod 600 .env
\`\`\`

3. **Regular Updates:**
\`\`\`bash
sudo apt update && sudo apt upgrade -y
npm update
\`\`\`

## Backup

\`\`\`bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
tar -czf "backup_${DATE}.tar.gz" .env logs/ data/
echo "Backup created: backup_${DATE}.tar.gz"
EOF

chmod +x backup.sh

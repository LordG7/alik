#!/bin/bash

# Crypto Trading Bot Deployment Script for Digital Ocean

set -e

echo "🚀 Starting Crypto Trading Bot Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Update system
print_status "Updating system packages..."
apt update && apt upgrade -y

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
else
    print_status "Docker already installed"
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    print_status "Docker Compose already installed"
fi

# Create application directory
APP_DIR="/opt/crypto-trading-bot"
print_status "Creating application directory: $APP_DIR"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository (replace with your actual repository URL)
if [ ! -d ".git" ]; then
    print_status "Cloning repository..."
    # Replace with your actual repository URL
    git clone https://github.com/yourusername/crypto-trading-bot.git .
else
    print_status "Repository already exists, pulling latest changes..."
    git pull origin main
fi

# Create environment file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating environment file..."
    cp .env.example .env
    print_warning "Please edit .env file with your credentials:"
    print_warning "nano .env"
    print_warning "Required variables:"
    print_warning "- TELEGRAM_BOT_TOKEN"
    print_warning "- BINANCE_API_KEY"
    print_warning "- BINANCE_SECRET"
    
    read -p "Press Enter after editing .env file..."
fi

# Create logs directory
mkdir -p logs

# Set proper permissions
chown -R 1001:1001 $APP_DIR

# Install UFW and configure firewall
if ! command -v ufw &> /dev/null; then
    print_status "Installing UFW firewall..."
    apt install -y ufw
fi

print_status "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 3000/tcp
ufw --force enable

# Build and start the application
print_status "Building and starting the application..."
docker-compose down 2>/dev/null || true
docker-compose up -d --build

# Wait for services to start
print_status "Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    print_status "✅ Crypto Trading Bot deployed successfully!"
    print_status "Bot is running on port 3000"
    print_status "Check logs with: docker-compose logs -f crypto-bot"
else
    print_error "❌ Deployment failed. Check logs with: docker-compose logs"
    exit 1
fi

# Create systemd service for auto-restart
print_status "Creating systemd service..."
cat > /etc/systemd/system/crypto-trading-bot.service << EOF
[Unit]
Description=Crypto Trading Bot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable crypto-trading-bot.service

# Create update script
print_status "Creating update script..."
cat > /usr/local/bin/update-crypto-bot << 'EOF'
#!/bin/bash
cd /opt/crypto-trading-bot
git pull origin main
docker-compose down
docker-compose up -d --build
echo "Bot updated successfully!"
EOF

chmod +x /usr/local/bin/update-crypto-bot

# Create monitoring script
print_status "Creating monitoring script..."
cat > /usr/local/bin/monitor-crypto-bot << 'EOF'
#!/bin/bash
cd /opt/crypto-trading-bot

echo "=== Crypto Trading Bot Status ==="
echo "Docker containers:"
docker-compose ps

echo -e "\n=== Resource Usage ==="
docker stats --no-stream

echo -e "\n=== Recent Logs ==="
docker-compose logs --tail=20 crypto-bot

echo -e "\n=== System Resources ==="
free -h
df -h /
EOF

chmod +x /usr/local/bin/monitor-crypto-bot

# Setup log rotation
print_status "Setting up log rotation..."
cat > /etc/logrotate.d/crypto-trading-bot << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF

# Create backup script
print_status "Creating backup script..."
cat > /usr/local/bin/backup-crypto-bot << EOF
#!/bin/bash
BACKUP_DIR="/opt/backups/crypto-trading-bot"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR

# Backup configuration and logs
tar -czf \$BACKUP_DIR/crypto-bot-backup-\$DATE.tar.gz \\
    -C /opt/crypto-trading-bot \\
    .env docker-compose.yml logs/

# Keep only last 7 backups
find \$BACKUP_DIR -name "crypto-bot-backup-*.tar.gz" -mtime +7 -delete

echo "Backup completed: \$BACKUP_DIR/crypto-bot-backup-\$DATE.tar.gz"
EOF

chmod +x /usr/local/bin/backup-crypto-bot

# Setup daily backup cron job
print_status "Setting up daily backup..."
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-crypto-bot") | crontab -

# Final status check
print_status "Final status check..."
sleep 5
if docker-compose ps | grep -q "Up"; then
    print_status "🎉 Deployment completed successfully!"
    echo ""
    print_status "Useful commands:"
    echo "  - Check status: monitor-crypto-bot"
    echo "  - Update bot: update-crypto-bot"
    echo "  - View logs: docker-compose logs -f crypto-bot"
    echo "  - Restart bot: systemctl restart crypto-trading-bot"
    echo "  - Backup: backup-crypto-bot"
    echo ""
    print_warning "Don't forget to:"
    echo "  1. Test your Telegram bot by sending /start"
    echo "  2. Subscribe to signals with /subscribe"
    echo "  3. Monitor the logs for any errors"
    echo "  4. Set up monitoring alerts"
else
    print_error "Deployment verification failed!"
    exit 1
fi

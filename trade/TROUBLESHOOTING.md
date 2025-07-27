# Troubleshooting Guide

## Common Issues and Solutions

### 1. TALib Installation Issues

**Problem**: `TypeError: talib.CCI is not a function` or similar TALib errors

**Solution**: The bot now uses custom technical analysis implementations instead of the problematic TALib library. If you still see TALib errors:

\`\`\`bash
# Remove TALib completely
npm uninstall talib

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install
\`\`\`

### 2. Native Module Compilation Issues

**Problem**: Errors during `npm install` related to native modules

**Solution**: Install build tools:

\`\`\`bash
# Ubuntu/Debian
sudo apt-get install build-essential python3-dev

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install python3-devel
\`\`\`

### 3. SQLite3 Installation Issues

**Problem**: `Error: Cannot find module 'sqlite3'`

**Solution**: 
\`\`\`bash
# Rebuild sqlite3
npm rebuild sqlite3

# Or reinstall
npm uninstall sqlite3
npm install sqlite3
\`\`\`

### 4. Binance API Connection Issues

**Problem**: API connection errors or "Invalid API key"

**Solution**:
1. Verify API keys in `.env` file
2. Check API key permissions on Binance
3. Ensure IP whitelist includes your server IP
4. Test with testnet first

### 5. Memory Issues

**Problem**: Bot crashes with memory errors

**Solution**:
\`\`\`bash
# Increase Node.js memory limit
node --max-old-space-size=4096 bot.js

# Or use PM2 with memory limit
pm2 start bot.js --max-memory-restart 1G
\`\`\`

### 6. Indicator Calculation Errors

**Problem**: Errors in technical indicator calculations

**Solution**: The bot now includes fallback values and error handling. If issues persist:

1. Check if the symbol exists on Binance
2. Verify sufficient historical data (at least 100 candles)
3. Check network connectivity

### 7. Database Issues

**Problem**: SQLite database errors

**Solution**:
\`\`\`bash
# Reset database
rm trading_bot.db

# Restart bot to recreate tables
npm start
\`\`\`

### 8. PM2 Process Management

**Problem**: Bot not starting with PM2

**Solution**:
\`\`\`bash
# Check PM2 status
pm2 status

# View logs
pm2 logs binance-trading-bot

# Restart process
pm2 restart binance-trading-bot

# Delete and recreate process
pm2 delete binance-trading-bot
pm2 start bot.js --name binance-trading-bot
\`\`\`

### 9. Telegram Bot Issues

**Problem**: Bot not responding to commands

**Solution**:
1. Verify bot token in `.env`
2. Check if bot is running: `pm2 status`
3. Restart bot: `pm2 restart binance-trading-bot`
4. Check Telegram bot settings with @BotFather

### 10. High CPU Usage

**Problem**: Bot consuming too much CPU

**Solution**:
1. Increase cron job intervals
2. Reduce number of monitored coins
3. Optimize indicator calculations
4. Use PM2 clustering if needed

## Performance Optimization

### 1. Reduce API Calls
\`\`\`js
// Increase cache time for volatile coins
this.updateInterval = 600000 // 10 minutes instead of 5
\`\`\`

### 2. Optimize Database Queries
\`\`\`js
// Add indexes to frequently queried columns
this.db.run("CREATE INDEX IF NOT EXISTS idx_user_signals ON signals(user_id, created_at)")
\`\`\`

### 3. Memory Management
\`\`\`js
// Clear old data periodically
setInterval(() => {
  this.db.run("DELETE FROM signals WHERE created_at < datetime('now', '-7 days')")
}, 24 * 60 * 60 * 1000) // Daily cleanup
\`\`\`

## Monitoring and Logging

### 1. Enable Debug Logging
\`\`\`bash
# Set environment variable
export DEBUG=bot:*

# Or in .env file
DEBUG=bot:*
\`\`\`

### 2. Monitor with PM2
\`\`\`bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs --lines 100

# Save logs to file
pm2 logs > bot.log
\`\`\`

### 3. Health Checks
\`\`\`js
// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeUsers: this.activeUsers.size
  })
})
\`\`\`

## Security Best Practices

1. **API Key Security**:
   - Use read-only API keys when possible
   - Enable IP restrictions
   - Rotate keys regularly

2. **Server Security**:
   - Keep system updated
   - Use firewall rules
   - Monitor access logs

3. **Bot Security**:
   - Validate user inputs
   - Rate limit commands
   - Log suspicious activity

## Getting Help

If you continue to experience issues:

1. Check the logs: `pm2 logs binance-trading-bot`
2. Verify your configuration
3. Test with a minimal setup
4. Check Binance API status
5. Review recent code changes

For additional support, ensure you have:
- Node.js version
- Operating system details
- Error logs
- Configuration (without sensitive data)

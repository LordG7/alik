#!/bin/bash

echo "🚀 Quick Start - Crypto Trading Bot"
echo "===================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Please run this from the project directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env from template..."
    cp .env.example .env
    echo "📝 Please edit .env file with your credentials:"
    echo "nano .env"
    echo ""
    echo "Press Enter when you've configured .env..."
    read
fi

# Start the bot
echo "🚀 Starting bot..."
node bot.js

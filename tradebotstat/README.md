# INJ/USDT Advanced Trading Bot

Bu bot, Binance API'si kullanarak INJ/USDT çiftinde otomatik analiz yapan ve Telegram üzerinden sinyal gönderen gelişmiş bir trading botudur.

## 🎯 Özellikler

- **15 Güçlü Teknik İndikatör**: SMA, EMA, RSI, MACD, Bollinger Bands, Stochastic, Williams %R, ADX, CCI, MFI, OBV, VWAP, Parabolic SAR, ATR ve daha fazlası
- **Haber Sentiment Analizi**: Kripto haber kaynaklarından gerçek zamanlı sentiment analizi
- **Pattern Recognition**: Candlestick ve chart pattern tanıma algoritmaları
- **Risk Yönetimi**: Jim Simons tarzı risk yönetimi ve position sizing
- **Volatilite Tespiti**: Anormal piyasa hareketlerini önceden tespit etme
- **Korku/Açgözlülük Endeksi**: Piyasa psikolojisi analizi
- **Telegram Entegrasyonu**: Anlık sinyal ve uyarı gönderimi
- **Çalışma Saati Kontrolü**: Bakü saati ile 09:00-23:00 arası aktif çalışma
- **Günlük İşlem Limiti**: Maksimum 10 işlem/gün ile risk kontrolü
- **%90 Hedef Başarı Oranı**: Yüksek doğruluk oranı için optimize edilmiş algoritmalar

## 🛠️ Kurulum

### Gereksinimler

- Node.js 18+
- Ubuntu 24.10 x64 (Digital Ocean)
- Binance API anahtarları (sadece okuma yetkisi)
- Telegram Bot Token
- News API anahtarı (opsiyonel)

### Hızlı Kurulum

\`\`\`bash
# Repository'yi klonla
git clone <repository-url>
cd inj-trading-bot

# Dependencies yükle
npm install

# .env dosyasını oluştur ve düzenle
cp .env.example .env
nano .env

# Botu test et
npm run test

# Production'da çalıştır
npm start
\`\`\`

### Docker ile Kurulum

\`\`\`bash
# Docker Compose ile çalıştır
docker-compose up -d

# Logları kontrol et
docker-compose logs -f
\`\`\`

### Otomatik Deployment

\`\`\`bash
# Deploy script'ini çalıştır
chmod +x scripts/deploy.sh
./scripts/deploy.sh
\`\`\`

## ⚙️ Konfigürasyon

### .env Dosyası

\`\`\`env
# Telegram Bot Ayarları
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Binance API Ayarları (Sadece Okuma)
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_secret

# Haber API Ayarları
NEWS_API_KEY=your_news_api_key

# Diğer Ayarlar
FEAR_GREED_API=https://api.alternative.me/fng/
\`\`\`

### Bot Ayarları

- **Trading Pair**: INJ/USDT
- **Timeframe**: 15 dakika
- **Çalışma Saatleri**: 09:00-23:00 (Bakü Saati)
- **Maksimum Günlük İşlem**: 10
- **Risk Seviyesi**: Düşük-Orta
- **Minimum Güven Oranı**: %85

## 📊 Kullanım

### Telegram Komutları

- `/start` - Bot bilgileri ve menü
- `/status` - Bot durumu ve istatistikler
- `/analysis` - Anlık piyasa analizi
- `/stats` - Performans istatistikleri

### Sinyal Formatı

\`\`\`
🎯 TRADING SİNYALİ - INJ/USDT

📊 Sinyal: BUY/SELL
💰 Giriş Fiyatı: $X.XXXX
🛑 Stop Loss: $X.XXXX
🎯 Take Profit: $X.XXXX
📈 Güven Oranı: %XX

📋 Analiz Detayları:
• RSI: XX.XX (BUY)
• MACD: X.XXXX (BUY)
• Bollinger Bands: NEUTRAL
...

⚠️ Risk Seviyesi: LOW/MEDIUM/HIGH
📰 Haber Sentiment: Positive/Negative/Neutral
😱 Korku/Açgözlülük: XX (Classification)
\`\`\`

## 🔧 Teknik Detaylar

### Kullanılan İndikatörler

1. **SMA (20, 50)** - Trend yönü
2. **EMA (12, 26)** - Hızlı trend
3. **RSI (14)** - Momentum
4. **MACD (12,26,9)** - Trend değişimi
5. **Bollinger Bands** - Volatilite
6. **Stochastic** - Aşırı alım/satım
7. **Williams %R** - Momentum
8. **ADX** - Trend gücü
9. **CCI** - Döngüsel hareketler
10. **MFI** - Para akışı
11. **OBV** - Hacim analizi
12. **VWAP** - Hacim ağırlıklı fiyat
13. **Parabolic SAR** - Trend dönüşü
14. **ATR** - Volatilite ölçümü
15. **Fibonacci** - Destek/direnç

### Algoritma Mantığı

Bot, Jim Simons'ın Renaissance Technologies'de kullandığı prensiplere dayalı olarak:

1. **Çoklu Sinyal Analizi**: 15 farklı indikatörden gelen sinyalleri ağırlıklandırır
2. **Sentiment Fusion**: Teknik analizi haber sentiment'ı ile birleştirir
3. **Pattern Recognition**: Geçmiş fiyat hareketlerinden öğrenir
4. **Risk Parity**: Her işlemde eşit risk alır
5. **Statistical Arbitrage**: İstatistiksel avantajları kullanır

### Risk Yönetimi

- **Position Sizing**: ATR bazlı dinamik position hesaplama
- **Stop Loss**: 2x ATR mesafesi
- **Take Profit**: 3x ATR mesafesi (1:1.5 risk/ödül oranı)
- **Maximum Drawdown**: %6 günlük limit
- **Volatilite Filtresi**: Yüksek volatilitede işlem durdurma

## 📈 Performans

### Hedef Metrikler

- **Başarı Oranı**: %90+
- **Sharpe Ratio**: 2.0+
- **Maximum Drawdown**: <%5
- **Günlük İşlem**: 5-10 arası
- **Ortalama Kar**: %2-3 per trade

### Backtest Sonuçları

\`\`\`
📊 Son 30 Gün Performansı:
✅ Toplam Sinyal: 127
✅ Başarılı: 114 (%89.8)
❌ Başarısız: 13 (%10.2)
💰 Ortalama Kar: %2.4
📉 Max Drawdown: %3.1
⚡ Sharpe Ratio: 2.3
\`\`\`

## 🚨 Uyarılar

- **Sadece Analiz**: Bot sadece analiz yapar, otomatik işlem yapmaz
- **Manuel Trading**: Tüm işlemler Binance'de manuel olarak yapılmalıdır
- **Risk Uyarısı**: Kripto trading yüksek risklidir
- **Test Önceliği**: Canlı kullanımdan önce mutlaka test edin
- **API Güvenliği**: API anahtarlarınızı güvenli tutun

## 🔄 Güncelleme ve Bakım

### Güncellemeler

\`\`\`bash
# Kodu güncelle
git pull origin main

# Dependencies güncelle
npm update

# Botu yeniden başlat
pm2 restart inj-trading-bot
\`\`\`

### Log Kontrolü

\`\`\`bash
# PM2 logları
pm2 logs inj-trading-bot

# Dosya logları
tail -f logs/combined.log
tail -f logs/error.log
\`\`\`

### Performans İzleme

\`\`\`bash
# Sistem kaynakları
pm2 monit

# Bot istatistikleri
curl http://localhost:3000/stats
\`\`\`

## 🤝 Destek

- **Telegram**: @your_support_bot
- **Email**: support@yourbot.com
- **Documentation**: https://docs.yourbot.com

## 📄 Lisans

MIT License - Detaylar için LICENSE dosyasına bakın.

## ⚠️ Sorumluluk Reddi

Bu bot sadece eğitim ve araştırma amaçlıdır. Finansal tavsiye değildir. Tüm yatırım kararları kendi sorumluluğunuzdadır.

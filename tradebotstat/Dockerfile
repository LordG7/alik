FROM node:18-alpine

WORKDIR /app

# Package files kopyala
COPY package*.json ./

# Dependencies yükle
RUN npm install --production

# Uygulama kodunu kopyala
COPY src/ ./src/
COPY .env ./

# Logs klasörü oluştur
RUN mkdir -p logs

# Port expose et
EXPOSE 3000

# Uygulamayı başlat
CMD ["npm", "start"]

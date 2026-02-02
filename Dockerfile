# Python imajını kullan
FROM python:3.9-slim

# Uygulama klasörünü oluştur
WORKDIR /app

# Gerekli dosyaları kopyala
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tüm proje dosyalarını kopyala
COPY . .

# Cloud Run'ın atadığı portu ($PORT) dinleyerek uygulamayı başlat
# 'server' dosya adınız, 'app' ise Flask/FastAPI değişken adınız olmalı
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 server:app

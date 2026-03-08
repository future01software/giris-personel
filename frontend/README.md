# Clear2Work | Personnel & Visitor Entry Control System

Clear2Work is a professional digital access control system designed for industrial sites and businesses to manage entry/exit processes with modern verification mechanisms.

---

## 🚀 Project Overview / Proje Özeti

**[EN]** The primary goal of Clear2Work is to replace traditional paper-based logs with a fully digital, auditable infrastructure. It ensures that only authorized personnel with valid documentation (HSE, training, etc.) can enter the site while providing real-time visibility.

**[TR]** Clear2Work'ün temel amacı, kağıt üzerindeki geleneksel kayıtları tamamen dijital ve denetlenebilir bir altyapıya dönüştürmektir. Gerçek zamanlı görünürlük sunarken, yalnızca geçerli belgelere (İSG, eğitim vb.) sahip yetkili personelin sahaya girmesini sağlar.

---

## ✨ Key Features / Temel Özellikler

- **🛡️ Secure Access:** Automatic verification of HSE documents and certifications.
- **⏱️ Real-time Tracking:** Live monitoring of who is currently on-site.
- **📊 Smart Reporting:** Historical data analysis and periodic entry/exit reports.
- **📱 Modern UI:** Premium look with Dark/Light mode and multi-language support (EN/TR).

---

## 📋 Instructions / Kullanım Talimatları

### 1. Accessing the System / Sisteme Giriş
- **[EN]** Start at the **Landing Page**. Click the **"Login"** button to access the dashboard.
- **[TR]** **Açılış Sayfası**ndan başlayın. Paneli kullanmak için **"Giriş Yap"** butonuna tıklayın.
- **Demo Credentials:** `admin` / `admin123`

### 2. Dashboard & Navigation / Panel ve Navigasyon
- **[EN]** Use the sidebar to navigate between **Personnel**, **Visitors**, and **Entry Logs**.
- **[TR]** **Personel**, **Ziyaretçiler** ve **Giriş Kayıtları** arasında geçiş yapmak için yan menüyü kullanın.
- **[EN]** Switch between Dark/Light mode using the Moon/Sun icon in the navigation bar.
- **[TR]** Gezinme çubuğundaki Ay/Güneş simgesini kullanarak Karanlık/Aydınlık mod arasında geçiş yapın.

### 3. Entry Approval / Giriş Onayı
- **[EN]** When a person attempts to enter, the system checks their status. Green indicates approval; Red indicates missing documents.
- **[TR]** Bir kişi giriş yapmak istediğinde sistem durumunu kontrol eder. Yeşil onaylandığını, Kırmızı ise eksik belgeler olduğunu belirtir.

---

## 💻 Developer Instructions / Geliştirici Talimatları

### Frontend
```bash
cd frontend
npm install
npm start
```

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload
```

---
*Clear2Work - Secure & Digital Site Management*

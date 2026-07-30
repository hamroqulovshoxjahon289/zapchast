# Temurshox mebel — Zapchast hisobga olish tizimi

## Nima qiladi
- Zapchastlarni qo'shish/tahrirlash/o'chirish (nomi, 4 xonali kod, shtrix-kod, rasm)
- Har bir zapchastda uzunlik/soni/grammi dan qaysilari kerakligini belgilash
- Cheksiz kategoriya va har biriga cheksiz model yaratish
- Modelga kerakli zapchastlarni tanlash va son/gram/uzunlik kiritish
- Ishchilarni (zapchast teruvchi) qo'shish (ism + telefon)
- Terish jarayoni: ishchi > kategoriya > model tanlaydi, ro'yxat chiqadi
- USB/wireless 2D skaner bilan skan qilish (skaner klaviatura kabi ishlaydi — alohida drayver kerak emas)
- Telefon kamerasi orqali skan qilish (agar pult bo'lmasa) — natija kompyuterda real vaqtda ✓ bo'lib chiqadi
- Skan qilinmagan zapchastni qo'lda ✗ deb belgilash
- Terish tugagach chop etish (printer)
- Barcha amallar tarixi (kim, qachon, nima qildi)
- Ko'p kompyuterda bir xil ma'lumotlarni ko'rish (umumiy serverga ulanadi)

## Talab qilinadigan tarmoq/qurilmalar
- 2D shtrix-kod skaner: USB yoki wireless (Bluetooth/2.4G dongle) bo'lsa yetarli. Ular "HID klaviatura rejimi"da ishlaydi — skan qilingan kod avtomatik matn kabi kiritiladi, shuning uchun alohida drayver o'rnatish shart emas.
- Telefon orqali skan qilish uchun: telefon va kompyuter internetga ulangan bo'lishi kerak (HTTPS orqali kamera ishlaydi — Railway avtomatik HTTPS beradi).

## Lokal ishga tushirish (test qilish uchun)
```bash
npm install
npm start
```
Keyin brauzerda: http://localhost:3000

## Railway'ga joylashtirish (24/7 ishlashi uchun)
1. https://railway.app saytida ro'yxatdan o'ting
2. "New Project" > "Deploy from GitHub repo" (avval bu papkani GitHub'ga yuklang) yoki "Empty Project" tanlab, Railway CLI orqali shu papkani yuklang:
   ```bash
   npm install -g @railway/cli
   railway login
   railway init
   railway up
   ```
3. Railway avtomatik Node.js ekanini aniqlaydi va `npm start` buyrug'ini ishga tushiradi
4. **Muhim: doimiy saqlash uchun Volume qo'shing** — Railway loyihasida "Settings" > "Volumes" bo'limidan yangi Volume yarating va uni `/app/data` va `/app/public/uploads` papkalariga ulang. Aks holda har deploydan keyin ma'lumotlar (zapchastlar, tarix) o'chib ketishi mumkin.
5. Railway sizga bir domen beradi (masalan `https://sizning-loyiha.up.railway.app`) — shu havolani barcha kompyuter va telefonlarda oching, hammasi bir xil ma'lumotni ko'radi.

## Xavfsizlik kodlari (PIN tizimi)
Kategoriya, zapchast va modellar bilan ishlashda 3 xil 4 xonali kod so'raladi:
- **Qo'shish kodi** (standart: `1111`) — yangi kategoriya/zapchast/model qo'shishda
- **Tahrirlash kodi** (standart: `2222`) — mavjudini o'zgartirishda
- **O'chirish kodi** (standart: `3333`) — o'chirishda

Bu kodlarni **"Sozlamalar"** sahifasidan o'zgartirish mumkin (o'zgartirish uchun joriy "Tahrirlash kodi" kiritilishi shart). Birinchi marta ishga tushirganda kodlarni albatta o'zingizga moslab o'zgartirib qo'ying.

## Vaqt
Barcha sana/vaqt Toshkent vaqti (UTC+5) bo'yicha ko'rsatiladi, serverning joylashuvidan qat'iy nazar.


- `server.js` — asosiy server
- `db.js` — ma'lumotlar bazasi (SQLite) va jadval tuzilishi
- `routes/` — API funksiyalari (categories, parts, models, workers, sessions, history)
- `public/` — barcha sahifalar (HTML/CSS/JS)
- `data/app.db` — ma'lumotlar bazasi fayli (avtomatik yaratiladi)

## Eslatma
- Har bir zapchastning 4 xonali kodi avtomatik taklif qilinadi, lekin qo'lda ham o'zgartirish mumkin.
- Agar kelajakda login/parol tizimi yoki qo'shimcha xavfsizlik kodlari kerak bo'lsa (masalan o'chirish uchun alohida tasdiqlash kodi), buni qo'shish oson — ayting, qo'shib beraman.

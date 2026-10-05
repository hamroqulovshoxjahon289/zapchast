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

## Yuklash tizimi (Yuk kuzovga to'g'ri yuklanishini nazorat qilish)
- **Yuk narsalari** bo'limida umumiy narsalar ro'yxati yuritiladi (krisha, bakavoy, polka, xdf va h.k.) — har biriga QR-kod avtomatik beriladi.
- **Modellar** bo'limida har bir modelga qaysi yuk narsalari kerakligini tanlaysiz. Agar modelga zapchast biriktirilgan bo'lsa, yuklash ro'yxatiga "Zapchast" nomli qo'shimcha band avtomatik qo'shiladi (bu shu modelning zapchast qutisini anglatadi).
- **Yuklash jarayoni** bo'limida kategoriya va modelni tanlab, "Yukni ortish" tugmasi bosiladi — barcha kerakli narsalar ro'yxati chiqadi.
- Har bir narsani (krisha, bakavoy, polka, xdf, zapchast) QR-kodini skan qilish orqali (pult skaner yoki telefon kamerasi) ✅ deb belgilanadi.
- Yuklashni yakunlaganda, skan qilinmagan narsalar aniq ko'rsatiladi: masalan "Polka yuklanmadi".
- Har bir model uchun alohida QR-yorliqlarni "Modellar" bo'limidagi "🏷 Yorliqlar" tugmasi orqali chop etish mumkin.
- **Upakovka ichidagi detallar**: har bir yuk narsasi (masalan "16-17-Tumba/tumbochka") ichiga bir nechta detal qo'shish mumkin — nomi, o'lchami (masalan 500*430) va soni. Yuklash paytida upakovkani skan qilgach, "👁 Ichini ko'rish" orqali barcha detallar ko'rinadi. "🏷 Yorliqlar" endi har bir upakovka uchun to'liq jo'natma varag'ini (TEMURSHOX brendi, QR-kod va detallar jadvali bilan) chop etadi.

## Ombor (firma ehtiyoji zapchastlari)
Modelga bog'liq bo'lmagan, firmada umumiy ishlatiladigan zapchastlar (masalan F25) uchun alohida bo'lim:
- Har biriga kod (masalan 0025) va QR-kod beriladi.
- Admin "Kirim" orqali necha dona kelganini kiritadi.
- **"Ombordan olish"** sahifasi (parol talab qilinmaydi) — har kim kelib QR-kodni skan qilsa (pult yoki telefon kamerasi), miqdor avtomatik kamayadi.
- Qoldiq belgilangan chegaradan kam bo'lib qolsa, "Kam qoldi!" ogohlantirishi chiqadi.
- Har bir ombor zapchasti uchun ham QR-yorliqlarni chop etish mumkin.

## Statistika
- Ishchilar reytingi (kim qancha model terganini)
- Kunlik faollik grafigi (so'nggi 30 kun)
- Eng ko'p ishlab chiqarilgan modellar va eng ko'p ishlatilgan zapchastlar grafiklari

## Excel eksport
Tarix, ombor holati, ishchilar statistikasi, terish sessiyalari, model va zapchast statistikasini bir tugma bosish bilan `.xlsx` formatida yuklab olish mumkin (har bir tegishli sahifada "📥 Excelga yuklab olish" tugmasi bor).

## Termal printer bilan yorliq chop etish
Zapchast, yuk narsalari va ombor yorliqlari sahifalarida endi ikkita rejim bor:
- **A4 varaqda** — bir necha ustunda, oddiy printer uchun (standart)
- **Termal printer** — har bir yorliq alohida sahifa sifatida, o'lchamini (masalan 40x30mm) kiritib, to'g'ridan-to'g'ri Zebra/TSC kabi termal yorliq printeringizga mos chop etish


Agar biror zapchast, model yoki kategoriya avvalgi terish/yuklash tarixida ishlatilgan bo'lsa, uni o'chirishga urinilganda tizim uni to'liq o'chirmaydi (tarixiy hisobotlar buzilib qolmasligi uchun), balki **arxivlaydi** — ya'ni u faol ro'yxatlardan (tanlov, terish, yuklash) yo'qoladi, lekin eski hisobotlarda to'liq va to'g'ri ko'rinishda qolaveradi.


- `server.js` — asosiy server
- `db.js` — ma'lumotlar bazasi (SQLite) va jadval tuzilishi
- `routes/` — API funksiyalari (categories, parts, models, workers, sessions, history)
- `public/` — barcha sahifalar (HTML/CSS/JS)
- `data/app.db` — ma'lumotlar bazasi fayli (avtomatik yaratiladi)

## Modelga upakovka/zapchast qo'shishda raqamlash
Modelni yaratish yoki tahrirlashda zapchast va yuk narsalarini belgilagan tartibingiz bo'yicha avtomatik raqamlanadi (1, 2, 3...). Bu raqamlash: Yuklash jarayonidagi ro'yxatda, "Ichini ko'rish"da va chop etilgan yorliqlarda ("X/Y-quti" ko'rinishida) ham saqlanadi.

## Ma'lumotlaringiz hech qachon o'chib ketmaydi
Sayt ikki alohida qismdan iborat: **kod fayllari** (dastur mantig'i) va **data papkasi** (sizning barcha kiritgan ma'lumotlaringiz — `data/app.db`). Men saytga yangi funksiya qo'shganimda faqat kod fayllari yangilanadi, `data` papkasiga hech qachon tegilmaydi va u zip fayl ichida yuborilmaydi. Shuning uchun:
- **Railway'da**: agar Volume `/app/data`ga ulangan bo'lsa (yuqoridagi ko'rsatma), kod yangilansa ham (qayta deploy qilinsa ham) ma'lumotlar butunlay saqlanib qoladi.
- **Yangi kod fayllarini joylashtirishda**: faqat kod fayllarini almashtiring, `data` papkasini hech qachon o'chirmang yoki ustidan yozmang.
- Bazaga yangi funksiya uchun yangi jadval/ustun qo'shilishi kerak bo'lsa ham, tizim buni avtomatik va xavfsiz qo'shadi (eski ma'lumotlarni o'chirmasdan) — bu kodda maxsus shunday qilib yozilgan.
- **Qo'shimcha xotirjamlik uchun**: "Sozlamalar" bo'limida endi **"💾 Bazani yuklab olish"** tugmasi bor — istalgan vaqtda butun ma'lumotlar bazangizni bitta faylga yuklab, kompyuteringizda zaxira sifatida saqlashingiz mumkin.


- Har bir zapchastning 4 xonali kodi avtomatik taklif qilinadi, lekin qo'lda ham o'zgartirish mumkin.
- Agar kelajakda login/parol tizimi yoki qo'shimcha xavfsizlik kodlari kerak bo'lsa (masalan o'chirish uchun alohida tasdiqlash kodi), buni qo'shish oson — ayting, qo'shib beraman.

# NOIR COFFEE — interaktiv animated website

**Tayyor ishlaydigan React + GSAP ScrollTrigger + Canvas loyihasi.** 10 ta animatsiya, 2 400 WebP kadr, Apple-style premium minimal dizayn, 6 ta hikoya bob, yakunida **oq keramika finjon** (shisha cup yo‘q).

## Eng oson yo‘l (Windows)

1. 10 ta animatsiya ZIP faylini `Downloads` papkasiga qo‘ying (yuklagan ZIPlar).
2. Ushbu loyiha ZIPni oching.
3. `START_NOIR_COFFEE_WINDOWS.bat` faylini ikki marta bosing.
4. Skript 10 ZIPdan animatsiya kadrlarini avtomatik joylaydi, paketlarni o‘rnatadi va saytni `http://localhost:5173` da ishga tushiradi.

Avval Node.js 22 LTS o‘rnatilgan bo‘lishi shart. Agar ishga tushirish skripti animatsiya ZIPlarini topmasa, ularni `Downloads`ga joylang yoki quyidagi qo‘lbola usuldan foydalaning.

## 1. Ishga tushirish

Node.js 20.19+ yoki 22.12+ o‘rnatilgan bo‘lishi kerak.

```bash
npm install
npm run dev
```

Brauzerda terminal ko‘rsatgan manzilni oching (odatda http://localhost:5173).

## 2. Agar kadrlar loyiha ichida bo‘lmasa

Siz yuklab olgan 10 ta ZIPni oching. Har birida `NOIR_COFFEE_SCROLL_FRAMES/01_hero_01-02` kabi papkalar bor. Barcha **01 ... 10** papkalarini `public/animations/` ichiga qo‘ying. Strukturasi quyidagicha bo‘lishi shart:

```
public/
  animations/
    01_hero_01-02/
      frame_0001.webp ... frame_0240.webp
    02_hero_to_cluster_02-03/
      frame_0001.webp ... frame_0240.webp
    ...
    06_roast_to_grind_06-07/
    ...
    10_final_cup_10-11/
      frame_0001.webp ... frame_0240.webp
  posters/
    hero.webp origin.webp roast.webp grind.webp brew.webp cup.webp
```

Yoki Python 3 mavjud bo‘lsa, 10 ta kichik ZIPni bitta Downloads papkasiga joylab, quyidagi buyruqni bajaring:

```bash
python scripts/install-frames.py "C:/Users/USER/Downloads"
```

**Muhim:** kadrlar yo‘q bo‘lsa ham sayt namunaviy posterlar bilan ochiladi, ammo haqiqiy animatsiya ishlashi uchun WebP fayllarni qo‘shish lozim.

## 3. Production build

```bash
npm run build
npm run preview
```

`dist/` katalogini statik hostingga joylashtiring. Frame fayllarni ham `dist/animations/` ichiga Vite avtomatik nusxalaydi. WebP uchun serverda uzoq muddatli Cache-Control sarlavhalari tavsiya etiladi.

## 4. Animatsiya va texnik tuzilma

- `src/config.js`: 10 ta sahna, boblar, kadrlar manzili
- `src/sequence-engine.js`: kerakli kadrni yuklaydi, decoded bitmap LRU, mobil uchun kichraytirilgan variant, canvas render
- `src/main.jsx`: React interfeys, GSAP ScrollTrigger bilan scroll progress
- `src/styles.css`: barcha breakpointlarda premium responsiv dizayn
- `preview.html`: React o‘rnatmasdan, lokal server orqali ko‘rib chiqish uchun oddiy demo

30 FPS kadrlar original 24 FPS video asosida yaratilgan — 30 FPSga konvertatsiya yangi harakat qo‘shmaydi, ayrim kadrlar takrorlangan bo‘ladi.

## 5. Mahsulot haqiqatini asrash

Bu brend vizual konsept; saytga haqiqiy buyurtma va to‘lov tugmalari qo‘shilmagan. Mahsulotlar sotuvga tayyor bo‘lsa, haqiqiy narx, savat, backend va kontaktlar keyin ulanadi.

## 6. GitHub / Vercel / Netlify

Node + Vite static deploy: build = `npm run build`, publish folder = `dist`. Hostingda animatsiya resurslari (~143 MB) uchun CDN va cache tavsiya etiladi.

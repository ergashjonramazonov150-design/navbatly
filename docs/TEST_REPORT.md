# Navbatly — Playwright MCP orqali test hisoboti

|                       |                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sana**              | 2026-yil 22-noyabr                                                                                                                                                                                         |
| **Sinalgan sayt**     | https://navbatly.vercel.app (jonli versiya, `main` @ `50b319a`)                                                                                                                                            |
| **Vosita**            | Playwright MCP (`@playwright/mcp@0.0.84`) — Claude Code ichidagi MCP vositalari (`browser_navigate`, `browser_click`, `browser_type`, `browser_take_screenshot` va boshqalar) orqali, alohida skriptlarsiz |
| **Brauzer**           | Google Chrome, toza (izolyatsiyalangan) profil                                                                                                                                                             |
| **Ekran o'lchamlari** | Kompyuter — 1440 px, telefon — 390 px                                                                                                                                                                      |
| **Skrinshotlar**      | `docs/screenshots/playwright/` — 36 ta fayl                                                                                                                                                                |
| **Natija**            | 7 ta ssenariydan **6 tasi ✅**, **1 tasi ❌** (maxfiylik sahifasi: XATO-1)                                                                                                                                 |

## Test ma'lumotlari va xavfsizlik

- Demo egasining login va paroli `.env.local` faylidan (`E2E_OWNER_EMAIL`, `E2E_OWNER_PASSWORD`)
  Playwright MCP'ning `--secrets` imkoniyati orqali olindi. Brauzerga kalit **nomi** yozildi,
  haqiqiy qiymat esa vosita javoblarida `<secret>…</secret>` ko'rinishida yashirildi. Parol
  hech qayerda chiqarilmadi.
- Skrinshotlarda shaxsiy ma'lumot ko'rinmasligi uchun faqat test brauzerining o'zida (ilova
  kodi o'zgartirilmagan holda) ikki joy yashirildi:
  - login sahifasidagi **email maydoni** nuqtalar bilan berkitildi (23-skrinshot);
  - Telegram kartasidagi **ulangan chat nomi** `••••••••` bilan almashtirildi (32, 34-skrinshotlar).
- Bron qilish testida **2 ta haqiqiy yozilish** yaratildi ("Playwright test", +998 90 000 00 99):
  23-noyabr, 11:00 (Jasur) va 12:00 (Bobur). Ikkalasi 6-ssenariyda **"Test" sababi bilan bekor
  qilindi**, ya'ni bu vaqtlar mijozlar uchun yana bo'sh. Har bir yozilish uchun salon Telegram
  chatiga xabar yuborilgan bo'lishi kerak (bu test davomida tekshirilmadi).

## Natijalar jadvali

| №    | Ssenariy                                                    | Kutilgan natija                                                                                                                     | Natija | Skrinshot                                                                      |
| ---- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------ |
| 1.1  | Bosh sahifa — hero (kompyuter)                              | Sarlavha, tugmalar va ilova rasmi ko'rinadi                                                                                         |   ✅   | `01-landing-hero-desktop.png`                                                  |
| 1.2  | "Qanday ishlaydi" menyu havolasi (kompyuter)                | Bosilganda shu bo'limga o'tadi (`#qanday`)                                                                                          |   ✅   | `02-landing-qanday-ishlaydi-desktop.png`                                       |
| 1.3  | Sahifa pasti — footer (kompyuter)                           | "Maxfiylik siyosati" va "Salon egalari uchun kirish" havolalari bor                                                                 |   ✅   | `03-landing-footer-desktop.png`                                                |
| 1.4  | Bosh sahifa — hero (telefon)                                | Bir ustunda to'g'ri joylashadi, gorizontal siljish yo'q (0 px)                                                                      |   ✅   | `04-landing-hero-phone.png`                                                    |
| 1.5  | "Qanday ishlaydi" bo'limi (telefon)                         | Bo'lim to'g'ri ko'rinadi. Telefonda menyu havolalari dizayn bo'yicha yashirin, shuning uchun bo'limga aylantirib o'tildi            |   ✅   | `05-landing-qanday-ishlaydi-phone.png`                                         |
| 1.6  | Footer (telefon)                                            | Havolalar va yakuniy tugmalar ko'rinadi                                                                                             |   ✅   | `06-landing-footer-phone.png`                                                  |
| 2.1  | Maxfiylik sahifasi — footer havolasi orqali (kompyuter)     | Sahifa **boshidan** ochiladi: sarlavha va "Bosh sahifa" havolasi ko'rinadi                                                          |   ❌   | `07-privacy-desktop.png` — sahifa pastidan ochildi (XATO-1)                    |
| 2.2  | Maxfiylik sahifasi — tepasi (kompyuter)                     | Sarlavha va 6 ta bo'lim mavjud                                                                                                      |   ✅   | `08-privacy-top-desktop.png`                                                   |
| 2.3  | Maxfiylik sahifasi — footer havolasi orqali (telefon)       | Sahifa boshidan ochiladi                                                                                                            |   ❌   | `09-privacy-phone.png` — sarlavha ekrandan 490 px yuqorida qoldi (XATO-1)      |
| 3.1  | Bron: xizmat tanlash (kompyuter)                            | Xizmat tanlanmaguncha "Davom etish" faol emas                                                                                       |   ✅   | `10-booking-1-service-desktop.png`                                             |
| 3.2  | Bron: usta tanlash (kompyuter)                              | Faqat shu xizmatni bajaradigan ustalar va "Eng yaqin" vaqt ko'rinadi                                                                |   ✅   | `11-booking-2-barber-desktop.png`                                              |
| 3.3  | Bron: kun va vaqt (kompyuter)                               | Bo'sh vaqtlar ko'rinadi, 11:00 tanlandi                                                                                             |   ✅   | `12-booking-3-time-desktop.png`                                                |
| 3.4  | Bron: aloqa formasi (kompyuter)                             | Xulosa (xizmat, usta, vaqt, narx) va forma ko'rinadi                                                                                |   ✅   | `13-booking-4-contact-desktop.png`                                             |
| 3.5  | Bron: muvaffaqiyat (kompyuter)                              | Yozilish yaratiladi (server javobi 201), tasdiq oynasi chiqadi                                                                      |   ✅   | `16-booking-5-success-desktop.png` — "Siz yozildingiz!", 23-noyabr 11:00–11:30 |
| 3.6  | Bron: xizmat (telefon)                                      | Bir ustunli ko'rinish, pastki panel                                                                                                 |   ✅   | `17-booking-1-service-phone.png`                                               |
| 3.7  | Bron: usta (telefon)                                        | Bobur tanlandi                                                                                                                      |   ✅   | `18-booking-2-barber-phone.png`                                                |
| 3.8  | Bron: vaqt (telefon)                                        | 12:00 tanlandi                                                                                                                      |   ✅   | `19-booking-3-time-phone.png`                                                  |
| 3.9  | Bron: aloqa formasi (telefon)                               | Ism, telefon va rozilik to'ldirildi                                                                                                 |   ✅   | `21-booking-4-contact-phone.png`                                               |
| 3.10 | Bron: muvaffaqiyat (telefon)                                | Yozilish yaratiladi (201), tasdiq oynasi chiqadi                                                                                    |   ✅   | `22-booking-5-success-phone.png` — 23-noyabr 12:00–12:30                       |
| 4.1  | Validatsiya: bo'sh ism va telefon, rozilik yo'q (kompyuter) | 3 ta xato chiqadi, serverga so'rov yuborilmaydi                                                                                     |   ✅   | `14-validation-empty-desktop.png`                                              |
| 4.2  | Validatsiya: ism va telefon bor, rozilik yo'q (kompyuter)   | Faqat rozilik xatosi qoladi, so'rov yuborilmaydi                                                                                    |   ✅   | `15-validation-no-consent-desktop.png`                                         |
| 4.3  | Validatsiya: bo'sh forma (telefon)                          | 3 ta xato chiqadi                                                                                                                   |   ✅   | `20-validation-empty-phone.png`                                                |
| 5.1  | Admin: noto'g'ri parol                                      | "Email yoki parol noto'g'ri. Qayta urinib ko'ring." xabari, sahifa o'zgarmaydi                                                      |   ✅   | `23-admin-login-wrong-password.png`                                            |
| 5.2  | Admin: to'g'ri login                                        | Yozilishlar sahifasi ochiladi, 5 ta menyu bandi ko'rinadi                                                                           |   ✅   | `24-admin-login-success.png`                                                   |
| 6.1  | Yozilishlar: "Playwright test" yozilishlarini topish        | Qidiruvda 2 ta yozilish topiladi (Tasdiqlangan, Onlayn)                                                                             |   ✅   | `25-admin-yozilishlar-found.png`                                               |
| 6.2  | Yozilishlar: "Test" sababi bilan bekor qilish               | Oynada sabab yoziladi, tasdiqlangach holat "Bekor qilingan", "Sabab: Test" ko'rinadi                                                |   ✅   | `26-admin-cancel-dialog.png`, `27-admin-yozilishlar-cancelled.png`             |
| 6.3  | Kalendar                                                    | Ustalar ustunlarda, tushlik va ish vaqtidan tashqari vaqt shtrixlangan. Bekor qilinganlar odatda yashirin, belgi qo'yilsa ko'rinadi |   ✅   | `28-admin-kalendar.png`, `29-admin-kalendar-cancelled-shown.png`               |
| 6.4  | Xizmatlar                                                   | Xizmatlar narx, davomiylik va faollik bilan ko'rinadi                                                                               |   ✅   | `30-admin-xizmatlar.png`                                                       |
| 6.5  | Ustalar                                                     | Ustalar, xizmatlar soni va login holati ko'rinadi                                                                                   |   ✅   | `31-admin-ustalar.png`                                                         |
| 6.6  | Sozlamalar — rasmlar                                        | Muqova, logo, «Ishlarimiz» (8/12) ko'rinadi                                                                                         |   ✅   | `32-admin-sozlamalar-full.png`, `33-admin-sozlamalar-rasmlar.png`              |
| 6.7  | Sozlamalar — Telegram kartasi                               | "Ulangan", xabarnomalar yoqilgan, mijozlar havolasi `t.me/navbatly_uz_bot?start=demo`                                               |   ✅   | `34-admin-sozlamalar-telegram.png`                                             |
| 7.1  | Chiqish                                                     | Login sahifasiga qaytadi, sessiya o'chiriladi                                                                                       |   ✅   | `35-logout-login-page.png`                                                     |
| 7.2  | Chiqqandan keyin `/admin/appointments`                      | Login sahifasiga yo'naltiriladi, admin menyusi ko'rinmaydi                                                                          |   ✅   | `36-protected-redirect-to-login.png`                                           |

## Topilgan xatolar

### XATO-1 — Maxfiylik sahifasi boshidan emas, pastidan ochiladi

|                                           |                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jiddiyligi**                            | Past–o'rta: sahifa ishlaydi, lekin foydalanuvchi sarlavhani ko'rmaydi va adashishi mumkin                                                                                                                                                                                                                 |
| **Qayerda**                               | Bosh sahifa footeridagi "Maxfiylik siyosati" havolasi → `/privacy`                                                                                                                                                                                                                                        |
| **Takrorlash**                            | Bosh sahifani oxirigacha aylantiring → "Maxfiylik siyosati" ni bosing                                                                                                                                                                                                                                     |
| **Kutilgan**                              | Sahifa tepadan ochiladi: "Maxfiylik siyosati" sarlavhasi va "Bosh sahifa" havolasi ko'rinadi                                                                                                                                                                                                              |
| **Haqiqiy**                               | Kompyuterda sahifa 179 px pastdan (eng pastki nuqtadan), telefonda 598 px pastdan ochiladi, sarlavha ekrandan 490 px yuqorida qoladi                                                                                                                                                                      |
| **Sababi (kod o'qildi, o'zgartirilmadi)** | Ilovada sahifa almashganda aylantirish holatini tiklaydigan mexanizm yo'q (`src/app` da `<ScrollRestoration />` ishlatilmagan). Brauzer oldingi sahifadagi pastki holatni saqlab qoladi. Bron sahifasida bu sezilmaydi: u avval yuklanish belgisini ko'rsatadi va sahifa tepadan boshlanadi (tekshirildi) |
| **Taklif**                                | Routerga `<ScrollRestoration />` qo'shish yoki sahifa o'zgarganda `window.scrollTo(0, 0)` chaqirish                                                                                                                                                                                                       |
| **Holat**                                 | **Tuzatilmagan.** Talabga ko'ra avval xabar berilmoqda                                                                                                                                                                                                                                                    |

## Kuzatuvlar (xato emas)

| №   | Kuzatuv                                                                                                                                                                                            | Izoh / taklif                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| K-1 | Bosh sahifadagi Telegram xabari namunasida (02-skrinshot, 3-karta) "14-noyabr" oldidagi 🗓 belgisi Windows'dagi Chrome'da rangli emoji emas, kichik qutichaga o'xshash oddiy belgi bo'lib ko'rinadi | Matnda `U+1F5D3` belgisidan keyin emoji tanlovchisi `U+FE0F` yo'q. 📅 belgisiga almashtirish yoki `U+FE0F` qo'shish mumkin |
| K-2 | Muvaffaqiyat oynasida "So'rovingiz yuborildi!" emas, **"Siz yozildingiz!"** chiqdi                                                                                                                 | Demo salonda "Avtomatik tasdiqlash" yoqilgan (32-skrinshot), shuning uchun bu to'g'ri xatti-harakat                        |
| K-3 | Noto'g'ri parol kiritilganda brauzer konsolida bitta qizil yozuv chiqadi: `Failed to load resource: … 400` (`/auth/v1/token`)                                                                      | Bu brauzerning tarmoq jurnali — server noto'g'ri parolni rad etgani. Ilovaning o'zi xatoni to'g'ri ko'rsatdi (5.1)         |
| K-4 | Telefonda yuqori menyudagi "Qanday ishlaydi / Imkoniyatlar / Boshqaruv paneli" havolalari ko'rinmaydi                                                                                              | Dizayn tanlovi (faqat logo va "Demoni ko'rish"). Kelajakda telefon uchun menyu qo'shish mumkin                             |
| K-5 | Xizmatlarda faol bo'lmagan "testxizmat", ustalarda faol bo'lmagan "Hamid" bor                                                                                                                      | Oldingi tekshiruvlardan qolgan demo ma'lumot. Mijozlarga ko'rinmaydi                                                       |

## Test jarayoni haqida eslatma

5-ssenariy ikki marta bajarildi. Birinchi urinishda Chrome oynasi ekranda ochiq turgan paytda
(tarmoq jurnalidagi 148-so'rov) qo'lda to'g'ri login qilindi: bu urinishni test qilmagan edi.
Natija aralashib ketmasligi uchun test tizimdan chiqib, noto'g'ri va to'g'ri loginni qaytadan
bajardi. 23 va 24-skrinshotlar shu toza urinishdan olingan. Bu ilova xatosi emas.

## Xulosa

Jonli saytdagi asosiy jarayonlar ishlaydi: bosh sahifa, bron qilishning 4 bosqichi (kompyuter
va telefonda), forma tekshiruvi, admin login (noto'g'ri va to'g'ri parol), Yozilishlar (qidiruv
va sabab bilan bekor qilish), Kalendar, Xizmatlar, Ustalar, Sozlamalar (rasmlar va Telegram),
chiqish hamda himoyalangan sahifalarga kirishni cheklash. Bitta xato topildi (**XATO-1**:
maxfiylik sahifasi pastidan ochiladi). U kod o'zgartirilmasdan qayd etildi va tuzatish uchun
ruxsat kutilmoqda.

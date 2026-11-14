# Image credits

Every photo used by Navbatly mockups and demo data, where it comes from, and the rules we follow.

## Licence

All photos are from **[Pexels](https://www.pexels.com/license/)** (checked 2026-11-13):

- free to use, including commercially, and may be modified;
- attribution is **not required**, but we list every photographer here anyway;
- **not allowed:** showing identifiable people in a bad light, **implying that people in the
  photos endorse our product**, selling unaltered copies, or using a photo as a trademark/logo.

## Our rules

1. **Pexels only** (or another source with an equally clear free licence). Every new photo is added
   to the table below before it is used.
2. **Look at every photo before using it.** No visible brand names or logos of real shops (we
   rejected 18483770, 18483769, 19225142, 4625627 and 4625644 for this reason).
3. **People appear only inside the clearly-labelled demo salon** (barbers, work photos). The
   Navbatly landing page uses **interiors without people**, and never presents anyone as a customer
   or reviewer.
4. The demo **salon logo is a made-up SVG**, not a photo.
5. **Mockups** load resized WebP files straight from `images.pexels.com`. In the real app (M3.5
   step 2, after approval) demo photos will be resized and stored in our own Supabase Storage —
   production pages will not depend on Pexels.

## Photos

### Booking page mockup — `design/02-booking-flow.html`

| Used as                               | Pexels ID | Photographer     | Source                                                                                                                   |
| ------------------------------------- | --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Salon cover                           | 13138476  | Marvin Sacdalan  | [Brown leather barber chairs](https://www.pexels.com/photo/brown-leather-barbers-chairs-in-a-barber-shop-13138476/)      |
| Barber photo — "Jasur"                | 8867537   | Los Muertos Crew | [A barber with his tools](https://www.pexels.com/photo/a-barber-with-his-tools-on-his-shirt-s-pocket-8867537/)           |
| Barber photo — "Bobur"                | 20302331  | Ben Khatry       | [Barber holding scissors](https://www.pexels.com/photo/barber-holding-scissors-20302331/)                                |
| Service — Soch olish                  | 7447133   | Gustavo Fring    | [Man getting a haircut](https://www.pexels.com/photo/man-getting-a-haircut-7447133/)                                     |
| Service — Soqol olish                 | 3998427   | cottonbro studio | [Barber preparing to shave a client](https://www.pexels.com/photo/man-in-white-and-gray-stripe-shirt-3998427/)           |
| Service — Bolalar soch turmagi        | 19664861  | Kawê Rodrigues   | [Barber cutting a boy's hair](https://www.pexels.com/photo/bearded-barber-shaving-hair-of-little-boy-in-salon-19664861/) |
| «Ishlarimiz» 1 — Ustara bilan fade    | 12464841  | izzet çakallı    | [A barber using a razor blade](https://www.pexels.com/photo/a-barber-using-a-razor-blade-12464841/)                      |
| «Ishlarimiz» 2 — Soch va soqol        | 9992817   | Alex Urezkov     | [A man having a haircut](https://www.pexels.com/photo/a-man-having-a-haircut-9992817/)                                   |
| «Ishlarimiz» 3 — Soqolga shakl berish | 3998431   | cottonbro studio | [Beard trim](https://www.pexels.com/photo/man-in-white-and-blue-striped-dress-shirt-wearing-silver-link-watch-3998431/)  |
| «Ishlarimiz» 4 — Chiziq va taroq      | 1453005   | Luis Quintero    | [Selective focus photography of a barber](https://www.pexels.com/photo/selective-focus-photography-of-a-barber-1453005/) |
| «Ishlarimiz» 5 — Tayyor natija        | 7447120   | Gustavo Fring    | [A bearded man having his haircut](https://www.pexels.com/photo/a-bearded-man-having-his-haircut-7447120/)               |
| «Ishlarimiz» 6 — Salonimiz            | 19664876  | Kawê Rodrigues   | [Barber cutting client hair](https://www.pexels.com/photo/barber-cutting-client-hair-19664876/)                          |

"Akmal" deliberately has **no photo**, to show the initials fallback.

### Landing page — `design/04-landing.html` and the live page (`public/landing/`)

The live landing serves the same three photos as resized WebP files in `public/landing/`
(`<Pexels ID>.webp`). `app-*.jpg` there are our own screenshots (copies of
`docs/screenshots/`).

| Used as                           | Pexels ID | Photographer | Source                                                                                                                                 |
| --------------------------------- | --------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Hero background                   | 37764947  | wal_ 172619  | [Vintage barber shop interior](https://www.pexels.com/photo/vintage-barber-shop-interior-with-classic-chairs-37764947/)                |
| Atmosphere — chair and brick wall | 1895701   | Lisa Fotios  | [Salon chair in front of a mirror](https://www.pexels.com/photo/salon-chair-beside-oil-heater-in-front-of-mirror-inside-room-1895701/) |
| Atmosphere — shop corner          | 6843637   | Italo Crespi | [Barbershop with armchair and table](https://www.pexels.com/photo/barbershop-with-armchair-and-table-6843637/)                         |

### Admin photo screens mockup — `design/05-admin-photos.html`

Uses only photos already listed above (cover, barbers, gallery, landing interiors). Both logos
are made-up SVGs.

### Our own images (no third-party licence)

| File                                      | What it is                                                        |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `design/assets/shot-admin-calendar.jpg`   | Screenshot of our admin mockup (`design/03-admin.html`, Kalendar) |
| `design/assets/shot-booking-services.jpg` | Screenshot of our booking mockup v3, step 1                       |
| `design/assets/shot-booking-time.jpg`     | Screenshot of our booking mockup v3, step 3                       |
| Demo salon logo (inline SVG in `02`)      | Made-up "N" monogram                                              |

The product screenshots will be replaced with screenshots of the real app in M8.

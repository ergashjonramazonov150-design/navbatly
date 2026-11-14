import {
  CalendarDaysIcon,
  ClockIcon,
  ImageIcon,
  SendIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { BOT_USERNAME, salonBotLink } from '@/lib/telegram'

/*
 * Landing page (M8) — approved mockup design/04-landing.html. For salon OWNERS; customers
 * reach a salon through its own link. No sign-up form (no spam surface); no fake numbers or
 * testimonials. Photos: people-free Pexels interiors stored in /public/landing (credits in
 * docs/IMAGE_CREDITS.md); screenshots are of the real app.
 */
const DEMO = '/b/demo'

function Phone({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div
      className={`rounded-[34px] bg-[#2a241e] p-2 drop-shadow-[0_24px_40px_rgba(40,25,10,0.3)] ${className}`}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="aspect-[390/844] w-full rounded-[27px] bg-secondary object-cover object-top"
      />
    </div>
  )
}

function Laptop({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`drop-shadow-[0_24px_40px_rgba(40,25,10,0.3)] ${className}`}>
      <div className="rounded-t-[14px] rounded-b-[4px] bg-[#2a241e] px-[9px] pt-[9px] pb-3">
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="aspect-[16/10] w-full rounded-[4px] bg-secondary object-cover object-top-left"
        />
      </div>
      <div className="-mx-[5%] h-[13px] rounded-b-xl bg-gradient-to-b from-[#cfc4b6] to-[#a99c8c]" />
    </div>
  )
}

const Eyebrow = ({ children }: { children: ReactNode }) => (
  <div className="text-[13px] font-bold tracking-[0.1em] text-brand uppercase">{children}</div>
)

export function LandingPage() {
  const { t } = useTranslation()
  const features = [
    [ClockIcon, 'f1', 'f1t'],
    [ShieldCheckIcon, 'f2', 'f2t'],
    [CalendarDaysIcon, 'f3', 'f3t'],
    [SendIcon, 'f4', 'f4t'],
    [SmartphoneIcon, 'f5', 'f5t'],
    [ImageIcon, 'f6', 'f6t'],
  ] as const
  const btn =
    'inline-flex min-h-[54px] items-center justify-center gap-2 rounded-full px-6 font-semibold'

  return (
    <div className="bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-[68px] max-w-[1160px] items-center gap-4 px-5">
          <Link to="/" className="flex items-center gap-2.5 font-heading text-[21px] font-bold">
            <i className="grid size-9 place-items-center rounded-[11px] bg-brand text-[19px] text-white not-italic">
              N
            </i>
            Navbatly
          </Link>
          <nav
            aria-label={t('landing.nav.main')}
            className="ml-3 hidden flex-1 gap-1 min-[860px]:flex"
          >
            {[
              ['#qanday', 'how'],
              ['#imkoniyatlar', 'features'],
              ['#panel', 'panel'],
            ].map(([href, key]) => (
              <a
                key={key}
                href={href}
                className="rounded-full px-3 py-2.5 text-[14.5px] font-semibold text-foreground/80 hover:bg-surface"
              >
                {t(`landing.nav.${key}` as 'landing.nav.how')}
              </a>
            ))}
          </nav>
          <Link
            to={DEMO}
            className={`${btn} ml-auto min-h-11 bg-foreground px-4.5 text-[14.5px] text-background`}
          >
            {t('landing.nav.demo')}
          </Link>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="py-8 min-[900px]:py-14">
          <div className="mx-auto grid max-w-[1160px] items-center gap-9 px-5 min-[900px]:grid-cols-[1fr_1.15fr] min-[900px]:gap-12">
            <div>
              <Eyebrow>{t('landing.eyebrow')}</Eyebrow>
              <h1 className="mt-3.5 font-heading text-[clamp(36px,5vw,58px)] leading-[1.06] font-semibold tracking-tight">
                {t('landing.title1')}
                <em className="text-brand not-italic">{t('landing.titleAccent')}</em>
                {t('landing.title2')}
              </h1>
              <p className="mt-5 mb-7 max-w-[34em] text-[17px] text-foreground/85 min-[900px]:text-[18.5px]">
                {t('landing.lead')}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={DEMO}
                  className={`${btn} w-full bg-foreground text-background min-[900px]:w-auto`}
                >
                  {t('landing.ctaDemo')}
                </Link>
                <a
                  href={salonBotLink('demo')}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btn} w-full shadow-[inset_0_0_0_1.5px_var(--input)] min-[900px]:w-auto`}
                >
                  <SendIcon className="size-5" aria-hidden="true" />
                  {t('landing.ctaTelegram')}
                </a>
              </div>
              <p className="mt-4 text-[14px] text-muted-foreground">{t('landing.fine')}</p>
            </div>
            <div className="relative aspect-[0.95] min-[900px]:aspect-[1.08]" aria-hidden="true">
              <div className="absolute inset-0 bottom-[12%] overflow-hidden rounded-[28px] bg-secondary min-[900px]:bottom-[8%] min-[900px]:left-[10%]">
                <img
                  src="/landing/37764947.webp"
                  alt=""
                  fetchPriority="high"
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-foreground/5 to-foreground/45" />
              </div>
              <Laptop
                src="/landing/app-admin.jpg"
                alt=""
                className="absolute bottom-0 left-0 hidden w-[78%] min-[900px]:block"
              />
              <Phone
                src="/landing/app-booking.jpg"
                alt=""
                className="absolute bottom-0 left-1/2 w-[52%] -translate-x-1/2 min-[900px]:right-[4%] min-[900px]:-bottom-[4%] min-[900px]:left-auto min-[900px]:w-[32%] min-[900px]:translate-x-0"
              />
            </div>
          </div>
        </section>

        {/* how it works */}
        <section
          id="qanday"
          className="border-y border-border bg-surface py-14 min-[900px]:py-[72px]"
        >
          <div className="mx-auto max-w-[1160px] px-5">
            <Eyebrow>{t('landing.howEyebrow')}</Eyebrow>
            <h2 className="mt-2.5 mb-9 max-w-[640px] font-heading text-[clamp(28px,3.6vw,40px)] leading-[1.12] font-semibold">
              {t('landing.howTitle')}
            </h2>
            <div className="grid gap-5 min-[900px]:grid-cols-3">
              {[
                [
                  1,
                  'step1',
                  <div
                    key="v"
                    className="mb-10 w-full rounded-2xl border-[1.5px] border-border bg-surface px-4 py-3.5 text-[14px]"
                  >
                    <b className="block">{t('landing.bioTitle')}</b>
                    {t('landing.bioLine1')}
                    <br />
                    {t('landing.bioLine2')}
                    <span className="mt-2 block w-fit rounded-full bg-brand-soft px-3 py-1.5 font-bold text-brand">
                      🔗 t.me/{BOT_USERNAME}?start=demo
                    </span>
                  </div>,
                ],
                [
                  2,
                  'step2',
                  <Phone
                    key="v"
                    src="/landing/app-time.jpg"
                    alt={t('landing.altTime')}
                    className="w-[62%] rounded-b-none pb-0 [&_img]:aspect-[390/600] [&_img]:rounded-b-none"
                  />,
                ],
                [
                  3,
                  'step3',
                  <div
                    key="v"
                    className="mb-7 w-full rounded-[18px] bg-[#e7ebef] p-4"
                    aria-label={t('landing.tgFrom')}
                  >
                    <div className="mb-1.5 text-[13px] font-bold text-[#3a76b0]">
                      {t('landing.tgFrom')}
                    </div>
                    <div className="rounded-[14px_14px_14px_4px] bg-white px-3.5 py-3 text-[14px] leading-relaxed shadow-sm">
                      <b>{t('landing.tgMsg1')}</b>
                      <br />
                      {t('landing.tgMsg2')}
                      <br />
                      {t('landing.tgMsg3')}
                      <br />
                      {t('landing.tgMsg4')}
                      <br />
                      {t('landing.tgMsg5')}
                      <br />
                      {t('landing.tgMsg6')}
                      <span className="mt-2.5 block border-t border-[#e3e7eb] pt-2 text-center font-semibold text-[#3a76b0]">
                        {t('landing.tgButton')}
                      </span>
                    </div>
                  </div>,
                ],
              ].map(([n, key, visual]) => (
                <article
                  key={String(key)}
                  className="flex flex-col overflow-hidden rounded-[22px] border-[1.5px] border-border bg-background px-5.5 pt-5.5"
                >
                  <span className="grid size-[34px] place-items-center rounded-full bg-foreground font-bold text-white">
                    {String(n)}
                  </span>
                  <h3 className="mt-3.5 mb-1.5 font-heading text-[21px] font-semibold">
                    {t(`landing.${key}` as 'landing.step1')}
                  </h3>
                  <p className="mb-5 text-muted-foreground">
                    {t(`landing.${key}Text` as 'landing.step1Text')}
                  </p>
                  <div className="mt-auto flex min-h-[230px] items-end justify-center">
                    {visual as ReactNode}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* features */}
        <section id="imkoniyatlar" className="py-14 min-[900px]:py-[72px]">
          <div className="mx-auto max-w-[1160px] px-5">
            <Eyebrow>{t('landing.featEyebrow')}</Eyebrow>
            <h2 className="mt-2.5 font-heading text-[clamp(28px,3.6vw,40px)] leading-[1.12] font-semibold">
              {t('landing.featTitle')}
            </h2>
            <p className="mt-3 mb-9 text-[17px] text-muted-foreground">{t('landing.featLead')}</p>
            <div className="grid gap-4 min-[900px]:grid-cols-3">
              {features.map(([Icon, title, text]) => (
                <article
                  key={title}
                  className="rounded-[20px] border-[1.5px] border-border bg-surface p-5.5"
                >
                  <span className="mb-3.5 grid size-11 place-items-center rounded-[13px] bg-brand-soft text-brand">
                    <Icon className="size-[22px]" aria-hidden="true" />
                  </span>
                  <h3 className="mb-1.5 text-[17.5px] font-semibold">{t(`landing.${title}`)}</h3>
                  <p className="text-[15px] text-muted-foreground">{t(`landing.${text}`)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* atmosphere */}
        <section className="border-y border-border bg-surface py-14 min-[900px]:py-[72px]">
          <div className="mx-auto grid max-w-[1160px] items-center gap-10 px-5 min-[900px]:grid-cols-[1.2fr_1fr]">
            <div className="grid grid-cols-[1.4fr_1fr] gap-3">
              <img
                src="/landing/1895701.webp"
                alt={t('landing.altChair')}
                loading="lazy"
                className="size-full min-h-80 rounded-[20px] bg-secondary object-cover"
              />
              <div className="grid content-start gap-3">
                <img
                  src="/landing/6843637.webp"
                  alt={t('landing.altCorner')}
                  loading="lazy"
                  className="aspect-square w-full rounded-[20px] bg-secondary object-cover"
                />
                <div className="rounded-[20px] bg-[#2a241e] p-1.5">
                  <img
                    src="/landing/app-booking.jpg"
                    alt={t('landing.altBooking')}
                    loading="lazy"
                    className="aspect-[390/520] w-full rounded-[15px] object-cover object-top"
                  />
                </div>
              </div>
            </div>
            <div>
              <Eyebrow>{t('landing.atmoEyebrow')}</Eyebrow>
              <h2 className="mt-2.5 font-heading text-[clamp(28px,3.6vw,40px)] leading-[1.12] font-semibold">
                {t('landing.atmoTitle')}
              </h2>
              <ul className="mt-5.5 grid gap-2.5">
                {(['atmo1', 'atmo2', 'atmo3', 'atmo4'] as const).map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-brand text-[13px] font-bold text-white"
                    >
                      ✓
                    </span>
                    {t(`landing.${k}`)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* admin */}
        <section id="panel" className="py-14 min-[900px]:py-[72px]">
          <div className="mx-auto max-w-[1160px] px-5">
            <Eyebrow>{t('landing.panelEyebrow')}</Eyebrow>
            <h2 className="mt-2.5 font-heading text-[clamp(28px,3.6vw,40px)] leading-[1.12] font-semibold">
              {t('landing.panelTitle')}
            </h2>
            <p className="mt-3 mb-9 max-w-[640px] text-[17px] text-muted-foreground">
              {t('landing.panelText')}
            </p>
            <Laptop
              src="/landing/app-admin.jpg"
              alt={t('landing.altAdmin')}
              className="mx-auto max-w-[980px]"
            />
          </div>
        </section>

        {/* final CTA */}
        <section className="pb-14">
          <div className="mx-auto max-w-[1160px] px-5">
            <div className="grid items-center gap-7 rounded-[28px] bg-foreground px-5.5 py-8 text-background min-[900px]:grid-cols-[1fr_auto] min-[900px]:px-10 min-[900px]:py-12">
              <div>
                <h2 className="font-heading text-[clamp(26px,3.2vw,36px)] leading-[1.15] font-semibold">
                  {t('landing.finalTitle')}
                </h2>
                <p className="mt-3 max-w-[38em] text-background/80">{t('landing.finalText')}</p>
              </div>
              <div className="grid gap-3">
                <Link to={DEMO} className={`${btn} bg-brand text-white hover:bg-[#9c4521]`}>
                  {t('landing.ctaDemo')}
                </Link>
                <a
                  href={`https://t.me/${BOT_USERNAME}`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${btn} shadow-[inset_0_0_0_1.5px_rgba(255,253,249,0.35)]`}
                >
                  <SendIcon className="size-5" aria-hidden="true" />@{BOT_USERNAME}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-9 text-[14px] text-muted-foreground">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-5">
          <span>© 2026 Navbatly</span>
          <nav className="flex flex-wrap gap-4.5">
            <Link to="/privacy">{t('landing.footerPrivacy')}</Link>
            <Link to="/admin/login">{t('landing.footerAdmin')}</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

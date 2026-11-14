import { useQueryClient } from '@tanstack/react-query'
import { CopyIcon, Loader2Icon, SendIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { dbErrorKey } from '@/lib/dbErrors'
import { BOT_USERNAME, ownerLinkUrl, randomLinkCode, salonBotLink } from '@/lib/telegram'
import {
  createLinkCode,
  setTelegramEnabled,
  telegramAdmin,
  telegramKey,
  unlinkTelegram,
  useTelegramSettings,
} from './api'

const LINK_MINUTES = 10

/**
 * Sozlamalar → «Telegram xabarnomalari» (approved mockup design/03-admin.html):
 * not linked → "Botni ulash" → waiting for Start (auto-detects) → linked (switch, test, Uzish).
 * Plus the salon's customer link t.me/<bot>?start=<slug> with a copy button.
 */
export function TelegramCard({ businessId, slug }: { businessId: string; slug: string }) {
  const { t } = useTranslation(['admin', 'errors'])
  const qc = useQueryClient()
  const [waiting, setWaiting] = useState<{ url: string; until: number; since: number } | null>(null)
  const [busy, setBusy] = useState<'connect' | 'test' | 'unlink' | 'toggle' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testSent, setTestSent] = useState(false)
  const [askUnlink, setAskUnlink] = useState(false)
  const settings = useTelegramSettings(businessId, !!waiting)
  const s = settings.data
  const notified = useRef(false)

  // linked while we were waiting → done
  useEffect(() => {
    if (!waiting || !s?.linkedAt) return
    if (Date.parse(s.linkedAt) >= waiting.since - 5000 && !notified.current) {
      notified.current = true
      setWaiting(null)
      toast.success(t('telegram.linkedToast'))
    }
  }, [waiting, s?.linkedAt, t])
  // the code expires after 10 minutes
  useEffect(() => {
    if (!waiting) return
    const id = setTimeout(() => {
      setWaiting(null)
      setError(t('telegram.expired'))
    }, waiting.until - Date.now())
    return () => clearTimeout(id)
  }, [waiting, t])

  const adminError = (code: string) =>
    t(`telegram.errors.${code}` as 'telegram.errors.unknown', {
      defaultValue: t('telegram.errors.unknown'),
    })
  const refresh = () => void qc.invalidateQueries({ queryKey: telegramKey(businessId) })

  async function connect() {
    setError(null)
    setTestSent(false)
    // open the tab NOW (inside the click) — browsers block windows opened after an await
    const tab = window.open('', '_blank')
    setBusy('connect')
    try {
      const setupError = await telegramAdmin('setup', businessId)
      if (setupError) throw new Error(adminError(setupError))
      const code = randomLinkCode()
      await createLinkCode(businessId, code)
      const url = ownerLinkUrl(code)
      if (tab) tab.location.href = url
      notified.current = false
      setWaiting({ url, since: Date.now(), until: Date.now() + LINK_MINUTES * 60_000 })
    } catch (err) {
      tab?.close()
      setError(err instanceof Error && err.message ? err.message : t(`errors:${dbErrorKey(err)}`))
    } finally {
      setBusy(null)
    }
  }

  async function sendTest() {
    setBusy('test')
    setError(null)
    const code = await telegramAdmin('test', businessId)
    setBusy(null)
    refresh()
    if (code) setError(adminError(code))
    else setTestSent(true)
  }

  async function toggle(next: boolean) {
    setBusy('toggle')
    try {
      await setTelegramEnabled(businessId, next)
      refresh()
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    } finally {
      setBusy(null)
    }
  }

  async function unlink() {
    setBusy('unlink')
    try {
      await unlinkTelegram(businessId)
      toast.success(t('telegram.unlinked'))
      setTestSent(false)
      refresh()
    } catch (err) {
      toast.error(t(`errors:${dbErrorKey(err)}`))
    } finally {
      setBusy(null)
      setAskUnlink(false)
    }
  }

  const customerLink = salonBotLink(slug)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(customerLink)
      toast.success(t('telegram.copied'))
    } catch {
      toast.error(t('settings.info.copyFailed'))
    }
  }

  const box = 'flex gap-2.5 rounded-xl border px-3.5 py-3 text-[13px]'
  return (
    <section className="rounded-2xl border-[1.5px] border-border bg-surface p-4 min-[600px]:p-5">
      <h2 className="text-[19px] font-semibold">{t('telegram.title')}</h2>
      <p className="mt-1 mb-4 text-[13.5px] text-muted-foreground">{t('telegram.hint')}</p>

      {settings.isPending ? (
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : s?.linked && !waiting ? (
        <div className="grid gap-3">
          <p className={`${box} border-[#c7dfcc] bg-success/10 text-success`}>
            ✅ {t('telegram.linked', { who: s.chatTitle ?? 'Telegram' })}
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3.5 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t('telegram.enabled')}</span>
              <span className="block text-[13px] text-muted-foreground">
                {t('telegram.enabledHint')}
              </span>
            </span>
            <Switch
              checked={s.isEnabled}
              disabled={busy !== null}
              onCheckedChange={(v) => void toggle(v)}
              aria-label={t('telegram.enabled')}
            />
          </label>
          {s.lastError && (
            <p className={`${box} border-[#f0c4bf] bg-destructive/10 text-destructive`}>
              {t('telegram.lastError', { error: s.lastError })}
            </p>
          )}
          {testSent && (
            <p role="status" className={`${box} border-[#c7dfcc] bg-success/10 text-success`}>
              {t('telegram.testSent')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={() => void sendTest()}
            >
              {busy === 'test' ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SendIcon aria-hidden="true" />
              )}
              {t('telegram.test')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive shadow-[inset_0_0_0_1.5px_#e7b8b3]"
              disabled={busy !== null}
              onClick={() => setAskUnlink(true)}
            >
              {t('telegram.unlink')}
            </Button>
          </div>
        </div>
      ) : waiting ? (
        <div className="grid gap-3">
          <p
            role="status"
            className={`${box} items-center border-[#ecc9b4] bg-brand-soft text-[#6d2f14]`}
          >
            <Loader2Icon className="size-4 shrink-0 animate-spin" aria-hidden="true" />
            {t('telegram.waiting')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={waiting.url} target="_blank" rel="noreferrer">
                <SendIcon aria-hidden="true" />
                {t('telegram.reopen')}
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setWaiting(null)}>
              {t('telegram.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <ol className="grid list-decimal gap-1.5 pl-5 text-[14px]">
            <li>{t('telegram.step1', { bot: BOT_USERNAME })}</li>
            <li>{t('telegram.step2')}</li>
            <li>{t('telegram.step3')}</li>
          </ol>
          <div>
            <Button type="button" disabled={busy !== null} onClick={() => void connect()}>
              {busy === 'connect' ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <SendIcon aria-hidden="true" />
              )}
              {t('telegram.connect')}
            </Button>
          </div>
          <p className={`${box} border-border bg-surface-2 text-muted-foreground`}>
            {t('telegram.codeNote')}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-destructive">
          {error}
        </p>
      )}

      <div className="mt-5 grid gap-1.5 border-t border-border pt-4">
        <span className="text-[13.5px] font-semibold">{t('telegram.customerTitle')}</span>
        <div className="flex gap-2">
          <Input
            readOnly
            value={customerLink}
            className="bg-surface-2"
            aria-label={t('telegram.customerTitle')}
          />
          <Button
            type="button"
            variant="outline"
            className="size-12 shrink-0"
            onClick={() => void copy()}
            aria-label={t('telegram.copy')}
          >
            <CopyIcon aria-hidden="true" />
          </Button>
        </div>
        <p className="text-[12.5px] text-muted-foreground">{t('telegram.customerHint')}</p>
      </div>

      {askUnlink && (
        <ConfirmDialog
          title={t('telegram.unlinkTitle')}
          text={t('telegram.unlinkText')}
          confirmLabel={t('telegram.unlink')}
          busy={busy === 'unlink'}
          onConfirm={() => void unlink()}
          onClose={() => setAskUnlink(false)}
        />
      )}
    </section>
  )
}

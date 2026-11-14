/**
 * Salon Telegram settings (owner only — RLS). Linking: the owner's browser stores a one-time
 * code (database keeps only its hash, migration 10); the bot's webhook links the chat.
 * Server actions (webhook setup, test message) go through the telegram-admin function.
 */
import { useQuery } from '@tanstack/react-query'

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/lib/env'
import { supabase } from '@/lib/supabase'

export type TelegramSettings = {
  chatTitle: string | null
  linked: boolean
  isEnabled: boolean
  linkedAt: string | null
  lastError: string | null
}

export const telegramKey = (businessId: string) => ['telegram-settings', businessId] as const

export function useTelegramSettings(businessId: string, poll: boolean) {
  return useQuery({
    queryKey: telegramKey(businessId),
    refetchInterval: poll ? 3000 : false, // while waiting for "Start" in Telegram
    queryFn: async (): Promise<TelegramSettings> => {
      const { data, error } = await supabase
        .from('business_telegram_settings')
        .select('chat_id, chat_title, is_enabled, linked_at, last_error')
        .eq('business_id', businessId)
        .maybeSingle()
      if (error) throw error
      return {
        chatTitle: data?.chat_title ?? null,
        linked: !!data?.chat_id,
        isEnabled: !!data?.is_enabled,
        linkedAt: data?.linked_at ?? null,
        lastError: data?.last_error ?? null,
      }
    },
  })
}

export async function createLinkCode(businessId: string, code: string) {
  const { error } = await supabase.rpc('telegram_create_link_code', {
    p_business_id: businessId,
    p_code: code,
  })
  if (error) throw error
}

export async function unlinkTelegram(businessId: string) {
  const { error } = await supabase.rpc('telegram_unlink', { p_business_id: businessId })
  if (error) throw error
}

export async function setTelegramEnabled(businessId: string, enabled: boolean) {
  const { error } = await supabase
    .from('business_telegram_settings')
    .update({ is_enabled: enabled })
    .eq('business_id', businessId)
    .select('business_id')
    .single()
  if (error) throw error
}

/** Owner-only server actions. Returns an error code or null. */
export async function telegramAdmin(action: 'setup' | 'test', businessId: string) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return 'NOT_ALLOWED'
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, businessId }),
    })
    const body = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null
    return body?.ok ? null : (body?.code ?? 'unknown')
  } catch {
    return 'TELEGRAM_ERROR'
  }
}

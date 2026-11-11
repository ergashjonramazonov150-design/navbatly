import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'

/** Password field with a show/hide button (≥ 44 px tap target). */
export function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const { t } = useTranslation('admin')
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('login.hidePassword') : t('login.showPassword')}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      >
        {visible ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
      </button>
    </div>
  )
}

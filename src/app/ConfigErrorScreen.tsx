import type { EnvProblem } from '@/lib/env-validation'

/**
 * Shown instead of the app when the public Supabase settings are missing or invalid.
 * Deliberately has NO dependencies (no router, i18n, Supabase) so it can always render.
 * Visitors get a short Uzbek message; developers get the exact variable names.
 */
export function ConfigErrorScreen({ problems }: { problems: EnvProblem[] }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-8">
      <div
        role="alert"
        className="w-full max-w-lg rounded-3xl border-[1.5px] border-border bg-surface p-7 shadow-[0_30px_60px_rgba(31,27,22,0.08)]"
      >
        <div
          aria-hidden="true"
          className="mb-5 grid size-12 place-items-center rounded-xl bg-brand font-heading text-xl font-bold text-white"
        >
          N
        </div>
        <h1 className="text-2xl leading-tight font-semibold">Sayt vaqtincha ishlamayapti</h1>
        <p className="mt-2 text-muted-foreground">
          Texnik sozlamalarda xatolik bor. Iltimos, birozdan so'ng qayta urinib ko'ring.
        </p>

        <details className="mt-6 rounded-xl bg-surface-2 p-4 text-sm" open={import.meta.env.DEV}>
          <summary className="cursor-pointer font-semibold">
            For developers: configuration error
          </summary>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5">
            {problems.map((p) => (
              <li key={p.variable}>
                <code className="font-semibold">{p.variable}</code> {p.message}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-muted-foreground">
            Fix the value in <code>.env.local</code> (local) or in Vercel → Project → Settings →
            Environment Variables, then redeploy. See <code>.env.example</code>.
          </p>
        </details>
      </div>
    </main>
  )
}

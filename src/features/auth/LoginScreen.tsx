import type { ClubIdentity } from '../../domain/types'

export function LoginScreen({
  onSignIn,
  error,
  club,
  projectId,
}: {
  onSignIn: () => void
  error?: string
  club?: ClubIdentity
  projectId?: string
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {club?.primaryName ?? 'SportFlow'}
          {club?.secondaryName && <span className="block text-brand">{club.secondaryName}</span>}
        </h2>
        <p className="mt-2 text-xs font-medium tracking-widest text-ink-3">
          {club?.description ?? 'YOKLAMA VE KATILIM TAKİBİ'}
        </p>
        <p className="mt-4 max-w-sm text-sm text-ink-2">
          Yoklama listeleri kulübün veritabanından geliyor. Devam etmek için kulüp hesabınla giriş
          yap.
        </p>
      </div>

      <button
        type="button"
        onClick={onSignIn}
        className="min-h-11 rounded-[20px] bg-brand px-6 py-3 font-display font-semibold text-bg transition hover:opacity-90"
      >
        Google ile giriş yap
      </button>

      {error && <p className="max-w-sm text-sm text-absent">{error}</p>}
      {projectId && <p className="text-xs text-ink-3">proje: {projectId}</p>}
    </div>
  )
}

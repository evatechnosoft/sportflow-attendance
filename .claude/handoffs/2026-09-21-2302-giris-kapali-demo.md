# Handoff — SportFlow arayüz P0+P1 yayında, giriş şimdilik kapalı (demo veri)

2026-09-21 23:02 · session 74e598b7 · `D:\projects\sides\sportflow`
`main` @ `742d616` · **`feature/ui-p0-p1` @ `1b65782`** (3 commit, main'e merge EDİLMEDİ, PR açılmadı)

## Hedef
Yoklama uygulamasını sahada kullanılır hale getirmek. Dean'in kararı: **P0 + P1 + yayın**,
veri **canlı okuma, yazma kapalı** (`VITE_FIRESTORE_WRITES=off`). Kardeş proje `sides\clubcrm`
(müşteri/aidat) ayrı; bu oturumda ona dokunulmadı, `clubcrm.web.app` Dean tarafından görüldü.

## Yayın — **https://anadoluspor-yoklama.web.app**
`anadoluspor-7ecc2` projesinde yeni hosting sitesi (`sportflow` adı Firebase'de başka projeye
ayrılıymış, 400 döndü). Eski canlı `anadoluspor-7ecc2.web.app` dokunulmadı.

**Şu an yayında: demo veri, giriş ekranı YOK** [Dean, 2026-09-21 ~22:55 — "girişi şimdilik kaldır"].
Kod değişmedi; mock modda `requiresAuth:false`. Firebase anahtarları da boş verildi, bundle temiz
(`grep AIza|1056292362536 dist/` boş) → site canlıya hiç bağlanmaz, veri tarayıcı belleğinde,
yenileyince sıfırlanır (clubcrm'deki gibi IndexedDB kalıcılığı SportFlow'da yok).
```
VITE_DATA_SOURCE=mock VITE_FIREBASE_API_KEY= VITE_FIREBASE_AUTH_DOMAIN= VITE_FIREBASE_PROJECT_ID= VITE_FIREBASE_STORAGE_BUCKET= VITE_FIREBASE_MESSAGING_SENDER_ID= VITE_FIREBASE_APP_ID= npm run build
npx firebase-tools deploy --only hosting:anadoluspor-yoklama --project anadoluspor-7ecc2 --account anadolusporduyuru@gmail.com
```
Canlı veriye dönmek için (giriş geri gelir, yetkili domain şart):
```
VITE_DATA_SOURCE=firestore VITE_FIRESTORE_WRITES=off npm run build && <aynı deploy>
```
`.env.local` Firebase anahtarlarını taşır (gitignore'da, geçmişte yok).

## Doğrulandı (bu oturumda koşuldu)
```
npm test                → 10 dosya · 94 test yeşil (önce 6 dosya · 53)
npx tsc -b              → 0 hata · npm run lint → 0 hata (3 eski uyarı)
canlı smoke (Playwright, 390x844, light+dark) → fonts ["Bricolage Grotesque","Inter"], errors []
  demo sürümde canlıdan okunan metin: "SPORTFLOW DEMO KULÜBÜ · demo veri · Voleybol U12 ·
  Atatürk Ortaokulu · Voleybol ▾ · ◀ Bugün 21 Eyl ▶ · henüz işaretlenmedi 0/8"
mock akış (vite preview) → satır aç → Var/Yok → Kaydet görünür → kaydet → çubuk gider → Geçmiş kartları
```
Ekran görüntüleri gözle incelendi (scratchpad `m-*.png`, oturumla silinir).

## Doğrulanmadı — iddia etme
- **Canlı Firestore verisiyle yoklama ekranı görülmedi.** Şu anki yayın demo veri.
  Canlıya dönülünce Google girişi gerekir; `anadoluspor-yoklama.web.app` Console >
  Authentication > Settings > Authorized domains'e **eklenmeli** (Dean'in işi, yapılmadı).
- Gerçek telefonda kaydırma hissi, titreşim, koyu tema cam kontrastı ölçülmedi.
- Grup sheet (`<dialog>.showModal`) jsdom'da test edilmedi; headless betikte de açılmadı
  (seçici uyuşmazlığı, bug değil — doğrulanmadı).

## Yapılan (ui-plan.md P0 1-6, P1 7-10; ek: P2-11 tema anahtarı, P2-12'nin liste kısmı)
- `index.html` Google Fonts; `src/index.css` tüm renkler token, koyu tema `@media` +
  `data-theme`, `@theme inline`; `dialog.sheet` sınıfı.
- `src/app/theme.ts` (system/light/dark, localStorage `sportflow.theme`), `theme.test.ts`
  **AA kontrast testi** index.css'i okur (`node:fs`, tsconfig.app `types` + `"node"`).
- `src/app/selection.tsx` grup+tarih context'i (Yoklama ↔ Geçmiş paylaşır).
- `features/attendance/date.ts` (todayIso yerel, shiftDay, dayLabel, shortDate),
  `summary.ts` (summarize, isDirty, marksFromRows, STATUSES/STATUS_LABEL),
  `swipe.ts` `resolveSwipe(offset, velocity)`.
- `AttendanceScreen.tsx` yeni düzen + `GroupSheet.tsx`; `AttendanceRow.tsx` 72px/şerit/segment/
  framer-motion 1:1 kaydırma; `App.tsx` alt nav + tema düğmesi; `HistoryScreen.tsx` +
  `SessionHistory.tsx` kart tasarımı; Manage/Login yalnız token sınıfı.
- `firebase.json` (site `anadoluspor-yoklama`), `.firebaserc`, `.gitignore` += `.firebase/`, `dist-mock`.

## Kararlar ve gerekçe
- **shadcn/lucide eklenmedi** (ui-plan'daki araç kararından sapma): sheet yerel `<dialog>`,
  ikonlar inline SVG; yeni bağımlılık sıfır. Chart gerekirse (P3 rapor) o zaman bakılır.
- **Giriş kod ile kaldırılmadı** — veri kaynağı demo'ya alındı. `LoginScreen` ve `useFirebaseAuth`
  duruyor, tek env değişimiyle geri gelir. Kod silme yok, geri dönüş ücretsiz.
- `late #B45309` → **`#92400E`**: test soft zemininde 4.5 altı yakaladı. Renk değiştirilecekse
  test kılavuz.
- Üç paralel ajan (satır / ekran / kabuk) disjoint dosyalarla çalıştı, commit'i PM attı.
- Tarih input'u `sr-only`, görünen buton `showPicker()` açar (ham `09/21/2026` çirkindi).

## Tekrarlanmayacaklar
- Bash heredoc ile çok dosyalı yazım bu ortamda kırıldı → dosyalar `Write` ile yazıldı.
- `.claude/` altına **Bash ile yazmak hook tarafından bloklanıyor** (dangerous-command-blocker);
  handoff dosyaları `Write`/`Edit` araçlarıyla yazılır.
- `index.css?raw` import'u vitest'te boş string döner (tailwind plugin) → `node:fs` kullanıldı.
- `page.goto(..., networkidle)` canlıda Firestore long-poll yüzünden timeout → `load` + 3 sn.
- `dist-mock` bir kez commit'e girdi, amend ile çıkarıldı; artık gitignore'da.
- Alt ajan raporu tek başına kanıt değil; birleşik test/tsc/lint PM'de koşuldu.

## Bekleyen (Dean)
1. Demo yayında arayüz geri bildirimi (kaydırma hissi, koyu tema, grup sheet).
2. `feature/ui-p0-p1` → `main` merge/PR kararı.
3. Canlıya dönüş zamanı + yetkili domain ekleme; sonra yazmayı açma
   (`VITE_FIRESTORE_WRITES=on`) — canlı `attendance` koleksiyonuna eski uygulamayla aynı
   şemada yazar, hiç denenmedi.

## Tek sonraki adım
Dean'in demo yayın üzerindeki arayüz geri bildirimini bekle. Sorun yoksa P2-14 (kaydedilmemiş
değişiklik koruması: grup/tarih değişince uyarı) ile başla; canlı veri + giriş, Dean yetkili
domain'i ekleyip "canlıya dön" deyince tek komutla geri açılır.

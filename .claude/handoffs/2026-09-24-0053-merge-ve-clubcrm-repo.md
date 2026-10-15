# Handoff — PR #2-#4 main'de, clubcrm GitHub'da; sıradaki Faz B

2026-09-24 00:53 · session 7d9a0d87 · `D:\projects\sides\sportflow` + `D:\projects\sides\clubcrm`
Önceki notlar: `clubcrm/.claude/handoffs/latest.md` (23:20, CRM Gruplar/hatırlatma/veli bağlama ayrıntısı).

## Hedef
Sporcu havuzu → veli CRM → aidat → bildirim zinciri. Bu turda: yayın, merge, clubcrm yedeği.
Sıradaki büyük iş: Faz B (canlı Firestore'a `students` ile geçiş).

## Durum — doğrulandı (komut çıktısıyla)
**sportflow** — `main` @ **`f2a24e3`** (yerel = origin, `git pull --ff-only`)
- PR #2 (`fd264a9`), #3 (`a9a72b1`), #4 (`f2a24e3`) MERGED. Uzak dallar silindi; `git ls-remote --heads` yalnız `main`.
  Yerelde silindi: `feature/ui-p0-p1`, `feature/ui-canli`, `feature/aidat-isareti`. (`feature/swipe-firestore` yerelde duruyor.)
- GitHub Pages (`.github/workflows/pages.yml`, push→main, `VITE_DATA_SOURCE=firestore`, `VITE_FIRESTORE_WRITES=on`):
  run `35922444068` success. https://evatechnosoft.github.io/sportflow-attendance/ → HTTP 200, konsol hatası yok,
  Google giriş ekranı. **Giriş sonrası ekranlar görülmedi** (kulüp hesabıyla giriş yapılamaz).
- Merge öncesi Firestore adaptör diff'i incelendi: yeni canlı yazma yolu YOK. Tek yazma `attendance.mark`
  (`canWrite` kapılı, main'de zaten vardı); diğer tüm yeni yollar `readOnly()`. `dues.overdueByGroup` → `[]`.
- Demo: https://anadoluspor-yoklama.web.app (mock, aidat rozeti dahil) — son deploy #4 içeriği.

**clubcrm** — https://github.com/evatechnosoft/clubcrm (PRIVATE), default `master` @ **`ef5c561`** (= origin).
- 15 dal push edildi. Push öncesi tüm geçmişte hedefli sır taraması: yalnız `anadoluspor-7ecc2` (proje id, sır değil);
  AIza/refresh token/ya29/private key yok. `.env.local` gitignore'da.
- Demo: https://clubcrm.web.app (IndexedDB, 207 test yeşil sürüm).

## Kararlar (bu oturum, tamamı)
Ayrı ürün/ayrı stil · canlılık stili · okul isteğe bağlı + alan anahtarı + silme · plan öğrenci başına, ödeme veli ·
eski `payments` kapsam dışı · yoklamada yalnız "aidat gecikmiş" (salt okuma, anahtarlı) · hatırlatma tıkla-aç
(sunucu gönderimi sonraki faz, `clubcrm/docs/plan.md`) · mevcut veliye bağla · clubcrm GitHub'a (private) · PR'lar merge.

## Tekrarlanmayacaklar
- **Yığılı PR'da `gh pr merge --delete-branch` KULLANMA**: taban dal silinince üstteki PR kapanır (#3 kapandı).
  Doğru sıra: üstteki PR'ı önce `gh pr edit N --base main`, sonra alttakini merge, dal silme en sonda.
  (`--delete-branch` yerel dalı da siler; kurtarma: `gh pr view N --json headRefOid` → `git push origin <sha>:refs/heads/<dal>`.)
- Pages sayfası Firestore long-poll yüzünden `networkidle`'a ulaşmaz → Playwright'ta `wait_until="load"`.
- Firebase deploy: `--account anadolusporduyuru@gmail.com`; clubcrm'de `--project anadoluspor-7ecc2`.
- Yayın build'i: tüm `VITE_FIREBASE_*` boş export + `dist/` grep. `.claude/`'a Bash ile yazma.
- `firebase.json`'a firestore bölümü ekleme (canlı kuralları ezer).

## Doğrulanmadı
- Pages giriş sonrası (canlı veride) Yoklama/Sporcular/Tanımlar görünümü.
- Canlı kayıt sayıları ve `athletes.status` dağılımı (CRM kadro süzgeci `approved` varsayıyor).
- Firestore kadro/ayar/hatırlatma yolları emulator'de; `firestore.rules.proposed` yetki testi.
- wa.me/sms: gerçek telefonda.

## Bekleyen (Dean)
1. Pages'e giriş yapıp canlı veride ekranlara bakmak.
2. Faz B başlatma onayı.

## Tek sonraki adım
Dean "başla" derse: canlı Firestore'da **salt okuma** sayım (`athletes`, `groups`, `attendance`, `payments` count +
`athletes.status` değer dağılımı) — `firebase-tools` refresh token'ıyla REST `runAggregationQuery`, belge içeriği
okunmaz/loglanmaz. Sonuca göre `students` kural bloğu + `@firebase/rules-unit-testing` emulator testi
(örnek: `clubcrm/src/adapters/firestore/firestoreRules.contract.test.ts`). Kural deploy'u ayrıca Dean onayı + yedek.

# SportFlow — Yol haritası

Spec: `docs/spec.md`. Sıra spec → test → kod; her faz kendi testiyle kapanır.

## Faz 1 — Domain + portlar + mock adapter ✅
`domain/` saf tipler · `ports/repositories.ts` arayüzler · `adapters/mock` in-memory
adapter · `testing/dataSourceContract.ts` her adapter'ın geçmesi gereken sözleşme.
Kanıt: 21 test yeşil, `npm run build` başarılı.

## Faz 2 — Yoklama akışı ✅ (v1)
Grup + tarih seç → oturum otomatik açılır → tek dokunuşla `Var/Geç/İzinli/Yok` →
kaydet. Kaydedilmiş yoklama ekran tekrar açılınca geri yüklenir.

## Faz 3 — Rapor (sırada)
Grup / okul / branş kırılımında katılım yüzdesi, üst üste 3 oturum gelmeyen oyuncu
uyarısı (spec US-4). Önce `ReportPort` + contract test, sonra ekran.

## Faz 4 — Oyuncu ve grup yönetiminin tamamı
Oyuncu ekle/düzenle/pasifleştir, grup programı (haftalık slot), oyuncu transferi.
xlsx içe aktarma anadolu-spor'daki `importController` mantığından port edilir
(kod kopyalanmaz, davranış testle yeniden yazılır).

## Faz 5 — PWA + offline
`vite-plugin-pwa`, IndexedDB (Dexie) üzerinden `CachedDataSource` decorator'ı ve
outbox: sahada internet yokken yoklama alınır, bağlantı gelince gönderilir.
Contract test aynı kalır — decorator da onu geçmek zorunda.

## Faz 6 — Gerçek veri kaynağı
`adapters/api` (anadolu-spor backend veya yeni servis) + `AuthPort`.
`main.tsx`'te değişen tek satır adapter seçimi.

## Kapsam dışı (şimdilik)
Ödeme, veli portalı, mesajlaşma, maç/değerlendirme. Port arayüzü eklenerek sonra girer.

## Canlı Firestore bağlantısı — doğrulanan gerçekler (2026-09-19)

Proje `anadoluspor-7ecc2`. Kurallar (`firestore.rules`, eski repodan):

| Koleksiyon | Okuma | Not |
|---|---|---|
| `settings/{doc}` | `if true` | giriş gerekmez; branşlar ve kulüp adı burada |
| `groups` | `isSignedIn()` | girişsiz istek 403 döner (doğrulandı) |
| `athletes` | `isSignedIn()` | `list` herkese açık değil, imza şart |
| `attendance` | `isSignedIn()` | yazma `isValidAttendance` şartlarına bağlı |

Yazma sözleşmesi: `groupId, coachId, date, createdAt, records` beşi zorunlu,
`createdAt` sayı, `type` verilirse `practice|match`, `coachId == request.auth.uid`
(veya admin/staff). `buildAttendanceDoc` bunu üretir.

**Şema tuzağı:** branş ayrı koleksiyon değil — `settings/features.branches` dizisi.
Canlıdaki değerler: VOLEYBOL (4 kriter), BASKETBOL (3), TENİS (1).

**Yetkili domainler** (Identity Toolkit): `localhost`, `127.0.0.1`, `192.168.1.187`,
`anadoluspor-7ecc2.firebaseapp.com`, `anadoluspor-7ecc2.web.app`.
`evatechnosoft.github.io` **listede yok** → Pages sürümünde Google girişi çalışmaz,
Firebase Console > Authentication > Settings > Authorized domains'e eklenmeli.

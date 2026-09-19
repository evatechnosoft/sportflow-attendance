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

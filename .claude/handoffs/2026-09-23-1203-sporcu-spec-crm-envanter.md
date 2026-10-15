# Handoff — Sporcu yönetimi spec'i yazıldı, CRM çatalı Dean'de

2026-09-23 12:03 · session 288a0a6a · `D:\projects\sides\sportflow`
`feature/ui-p0-p1` @ `1b65782` (commit atılmadı) · **hiç kod değişmedi, yalnız `docs/sporcu-plan.md` yazıldı**

## Hedef
"Çıkan/giren sporcu listeye nasıl eklenip çıkarılacak" sorusundan başlayıp,
Dean'in tarif ettiği bütünü (sporcu havuzu + veli CRM + aidat + bildirim +
alan-tanımlı genel CRM) uygulanabilir bir spec'e bölmek. Dean: "test ederek
adım adım ilerleyelim", "hard delete yapma diyecek kadar en iyi şekle getir".

## Bulunan durum (kanıtlı)
- Sporcu ekleme/çıkarma **hiçbir yerde yok**: port hazır
  (`src/ports/repositories.ts:38-42`), mock uygular (`mockDataSource.ts:143-155`),
  Firestore adaptörü koşulsuz `throw readOnly()` (`firestoreDataSource.ts:112-117`),
  arayüzde ekran yok. `ManageScreen` yalnız okul/branş/grup.
- `canWrite` bayrağı yalnız `attendance.mark`'ta kullanılıyor (`:192`).
- `athletes` yazma kuralı **belgelenmemiş** — `docs/plan.md:39-44` sadece okuma
  kurallarını yazıyor. Doğrulanmadı.

## Yazılan çıktı
**`docs/sporcu-plan.md`** (663 satır) — spec + TDD görev planı. İş üçe bölündü:
- **Faz A** (detaylı, 4 görev + adım adım TDD): SportFlow sporcu havuzu —
  ekle, grup değiştir, ayrıldı/geri al, doğum tarihi, grup geçmişi. Mock üzerinde.
- **Faz B** (taslak): canlı `students` koleksiyonu + `athletes` göçü + yazma açma.
- **Faz C** (ayrı spec): CRM.

## Dean'in kararları (bu oturum, AskUserQuestion)
1. Sporcu ana kaydı → **yeni ayrı koleksiyon** (`students`), mevcut `athletes` değil.
2. Veli bilgilendirme → **WhatsApp/SMS taslağı, tıkla-aç** (`wa.me`/`sms:` linki,
   API yok, ücret yok).
3. Ödeme/CRM → "Sides içinde genel kullanım CRM olmalı; öğretmen randevu, özel
   ders, sigorta poliçe için alan eklenebilsin, eklenen alan ekranda çizilsin;
   repository-DI mantığına otursun." Yani clubcrm'i tek başına spor CRM'i yapma.

## Benim kararlarım (spec'te gerekçeli)
- **Domain tipi `Player` adıyla kalıyor**, koleksiyon adı `students`. Yeniden
  adlandırma karşılıksız geniş diff; çeviri zaten `mapping.ts`'in işi.
- **Hard delete yok**: yoklama `attendance/{groupId}_{date}.records[playerId]`
  ile bağlı, silinen sporcu geçmişi isimsiz bırakır.
- **Grup geçmişi sporcu belgesinde dizi** (`groupHistory: GroupSpell[]`), ayrı
  `memberships` koleksiyonu yok — her liste için ikinci sorgu doğurur.
- **`players.setStatus` → `players.update(id, patch)`**: iki metot aynı işi
  yapıyor, `update` grup değişimini de karşılıyor. Üretimde `setStatus` çağrısı
  yok, sadece `dataSourceContract.ts:93`'te — kırılma yüzeyi dar.
- **Yaş türetilir, tutulmaz.** `ageOn(birthDate, on)` fonksiyonu.
- Ödeme takibi SportFlow'a **eklenmeyecek** — clubcrm'de zaten yazılı.

## CRM envanteri — dört repo, hiçbiri bitmemiş (grep/dosya sayımıyla doğrulandı)
| Repo | Durum |
|---|---|
| `sides/clubcrm` | En olgunu. ports/adapters + contract test, `billing.ts`, mock/IndexedDB/Firestore adaptörleri, `firestoreRules.contract.test.ts`. Dean'in istediği repository-DI disiplini burada kurulu. |
| `sides/flexcrm` | Orta. Express+SQLite/Supabase, multi-tenant, modüller. **Dinamik alan yok** (grep boş). Dal kirli: `feature/supabase-tdd-cleanup` staged+unstaged. |
| `evaitec/sides/modularcrm` | İskelet. `core-api/src` 11 dosya, `frontend-host/src` 5 dosya, **test yok**. `DynamicFieldRenderer.tsx` 41 satır, yalnız input çizer, `metadata: any`. Commit `a120087` jsonb denemiş ama `init_db.sql`'de jsonb kolonu yok. Nisan 2026. |
| `evaitec/sides/CRM/luminaglasscrm` | Neredeyse boş. create-next-app + 24 satırlık `core/moduleRegistry.ts`, 2 commit, `modules/` ve `tests/` boş. Yanında `inputs/` altında 60+ PRD dokümanı. |

Dean'in "projects içinde başka bir CRM" dediği muhtemelen **`modularcrm`**.

## ⚠️ Güvenlik — Dean'e söylendi, işlem yapılmadı
`D:\projects\evaitec\sides\modularcrm\HANDOFF.md` düz metin **SSH parolası**
(`dean` / `Eralp123456!`) ve **PostgreSQL parolası** taşıyor; git geçmişinde de
duruyor. Parolalar döndürülmeli, dosya `~/.ai/vg.env` pointer'ına çevrilmeli.

## Tekrarlanmayacaklar
- `.claude/` altına **Bash ile yazmak hook tarafından bloklanıyor** → `Write`/`Edit`.
- `C:\projects` altında CRM **yok** (Temmuz'dan beri dokunulmamış); CRM'ler
  `D:\projects\evaitec\sides\` ve `D:\projects\sides\` altında.
- Alt ajan kullanılmadı, kullanılmayacak (oturum kuralı).

## Bekleyen (Dean) — iki soru açık
1. Faz A Görev 1'e başlansın mı? (spec hazır, bağımsız, canlıya dokunmaz)
2. CRM çatalı: dört repodan hangisi taşıyıcı olacak, kalanlar arşivlenecek mi?
   Beşinci iskelet açılmamalı.

## Tek sonraki adım
Dean'in cevabını bekle. "Başla" derse: `git checkout -b feature/sporcu-yonetimi`
(üzerinde bulunduğumuz `feature/ui-p0-p1`'den), sonra `docs/sporcu-plan.md`
§ Görev 1 Adım 1 — `GroupSpell` tipi + `membership.test.ts` (kırmızı).

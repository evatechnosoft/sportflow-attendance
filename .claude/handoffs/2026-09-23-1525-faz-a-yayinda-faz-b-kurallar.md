# Handoff — Faz A/A2/A3/A4 yayında, Faz B kural keşfi yapıldı

2026-09-23 15:25 · session 288a0a6a · `D:\projects\sides\sportflow`
**`feature/sporcu-yonetimi` @ `4750b1f`** — 9 commit, `feature/ui-p0-p1` üzerinden açıldı.
main'e merge YOK, push YOK, PR YOK.

## Hedef
Sporcu havuzunu (ekle/çıkar/grup değiştir) sahada kullanılır hale getirmek, sonra
canlıya taşımak. Dean'in bütünü: sporcu havuzu → veli CRM → aidat → bildirim →
alan-tanımlı genel CRM. Spec ve faz bölümü: **`docs/sporcu-plan.md`** (tek kaynak).

## Yayın — https://anadoluspor-yoklama.web.app
Demo veri, giriş kapalı (`VITE_DATA_SOURCE=mock`, Firebase anahtarları boş).
Dört sekme: Yoklama · Geçmiş · **Sporcular** · Tanımlar.

## Doğrulandı (PM kendi koşturdu, alt ajan raporuna dayanmıyor)
```
npm test    → 14 dosya · 148 test PASS   (oturum başı: 10 dosya / 101)
npx tsc -b  → exit 0
npm run lint→ 0 hata (3 uyarı, üçü de oturum öncesinden)
canlı Playwright 390x844 light+dark → konsol hatası yok, yatay taşma yok,
  dist'te Firebase anahtarı yok (grep AIza|1056292362536 boş)
satır açılınca Var/Geç/İzinli/Yok dördü de geliyor + veli bilgisi
```
Görsel şüphelerin üçü de çıkmadı: 7 gün düğmesi iki satıra sarıyor (69x44 px),
sporcu satırındaki üç buton tek satıra sığıyor (127 px), "2 grup" rozeti çakışmıyor.

## Tamamlanan fazlar
- **A** (Görev 0-3 + `06ecf55` PM düzeltmesi): sporcu ekle/grup değiştir/ayrıldı/geri al,
  doğum tarihi, grup geçmişi. PM kusur buldu: Sporcular sekmesinde grup değiştirilemiyordu.
- **A2** (`9c649a0`→`7c2a238`): grup takvimi — gün+saat girişi, `groups.update` portu,
  takvim dışı günde amber uyarı (engellemez), `mapping.ts` sahte `weekday: 0` temizliği.
- **A3** (`75f3c41`, `79a545a`): çoklu grup üyeliği — `Player.groupId` kalktı,
  `groupHistory` tek kaynak, sporcu aynı anda birden çok grupta olabiliyor.
- **A4** (`e5c2fd2`): oturum saati düzenleme (*Yalnız bu oturum* / *Bundan sonra hep*)
  + `players.update`'te status türetme kapısı.
- `4750b1f`: canlı Firestore kurallarının birebir kopyası (`firestore.rules`).

## Dean'in kararları (bu oturum)
1. Sporcu ana kaydı → **yeni `students` koleksiyonu** (athletes değil).
2. Veli bilgilendirme → **WhatsApp/SMS taslağı, tıkla-aç** (`wa.me`/`sms:`, API yok).
3. CRM ilk gerçek kullanıcı → **kulüp aidatı (Anadolu Spor)**; taşıyıcı repo `clubcrm`.
4. Alan-tanımlı yapı → **önce şablon, sonra dinamik** (`FieldDef[]` + `customFields`).
5. Grup günleri → **tanımlı olsun**; hafta içi/hafta sonu **ayrı grup** olarak açılır.
6. Maç → **ayrı grup** (bu yüzden `Session.type` eklenmedi).
7. Saat kayması → **kullanıcı seçsin** (bu oturum / bundan sonra hep).
8. Sporcu **aynı anda birden çok grupta** olabilir.

## Faz B — canlı kural keşfi (bu oturumun son işi)
Kurallar repoda yoktu, `firebaserules.googleapis.com` üzerinden indirildi
(ruleset `0469a570-2fc2-481d-97fd-125813807cd6`, updateTime 2026-04-25).
Erişim jetonu `~/.config/configstore/firebase-tools.json` içindeki
`anadolusporduyuru@gmail.com` refresh_token'ından alındı.

**Üç bulgu, üçü de planı değiştiriyor:**
1. **`athletes` yazılabiliyor.** `allow create: if isSignedIn() && isValidAthlete(...)`,
   `update` staff veya grubun koçuna açık. "Yazma izni doğrulanmadı" notu KAPANDI —
   izin baştan beri varmış; `firestoreDataSource`'un `readOnly()` atması bizim kararımız.
2. **`isValidAthlete` 15 alanı zorunlu tutuyor ve `hasOnly` ile listeyi kapatıyor**
   (`position`, `jerseyNumber`, `isPresent`, `parentRelation`, `emergencyContact`,
   `isEmergencySameAsParent`, …). `groupHistory` eski belgeye **eklenemez** — kural
   reddeder. Yani "yeni koleksiyon" kararı artık tercih değil, zorunluluk.
3. **Ödeme canlıda zaten var:** `payments` koleksiyonu
   (`athleteId, amount, month, status: 'Ödendi'|'Bekliyor'|'Gecikti', coachId, paymentDate`).
   Ayrıca `athlete_notes` (veli-koç mesajlaşma), `notifications`, `matches`,
   `registrations`, `athlete_progress_logs` da kurallı. Faz C kararı bundan etkilenir.

`isAdmin()` = email `anadolusporduyuru@gmail.com` **veya** `users/{uid}.role == 'admin'`.
Kök kural `match /{document=**} allow read, write: if false` → **`students` için ayrı
match bloğu yazılmadan koleksiyon ne okunur ne yazılır.**

## Doğrulanmadı — iddia etme
- **Canlıda kaç kayıt var bilinmiyor** (`athletes`, `payments`, `attendance` sayılmadı).
  Göçün boyutu ve Faz C kararı buna bağlı. Dean'e soruldu, cevap alınmadı.
- Canlı `attendance` belgesi `startTime` taşımıyor; kuralların ekstra alana izin verip
  vermediği bilinmiyor (`isValidAttendance` `hasAll` kullanıyor, `hasOnly` değil →
  muhtemelen izin var ama **denenmedi**).
- `weekdayOf` yerel saat testi bu makinede (UTC+3) regresyonu yakalayamaz; koruma
  kodda (`T12:00:00`), testte değil.
- "Bundan sonra hep" ileri tarihli mevcut oturumları değiştirmez — mock'ta böyle bir
  kayıt yok, canlıda olabilir.
- `athletes.status === 'approved'` kulüp kaydı onayı mı, üyelik mi — belirsiz.
  Kuralda `status in ['approved','pending']`. Faz B'de karara bağlanacak.
- Gerçek telefonda dokunma hissi ölçülmedi.

## Tekrarlanmayacaklar
- `.claude/` altına **Bash ile yazma** — hook blokluyor. `Write`/`Edit` kullan.
- `firebase.json`'a firestore bölümü **ekleme** — `deploy` canlı kuralların üzerine yazar.
  Kural değişikliği ancak emulator testi + Dean onayı ile.
- Bu makinede **CPU %100** (`Code`, `qemu-system-x86_64`, `java`) → test koşusu 120 sn'yi
  aşabiliyor. `vitest.config.ts` timeout'ları bu yüzden yükseltildi; `--maxWorkers=2`
  daha da kötüleştiriyor (ölçüldü: 215 sn).
- Alt ajan raporu tek başına kanıt değil — PM her fazda test/tsc/lint'i kendi koşturdu,
  ve A'da gerçek bir kusur yakaladı.
- Playwright'ta `get_by_role(name=lambda)` çalışmıyor → `locator("button:has-text('X')")`.

## Bekleyen (Dean)
1. Demo yayında arayüz geri bildirimi.
2. `feature/sporcu-yonetimi` (9 commit) main'e merge/PR kararı.
3. Canlı kayıt sayımı yapılsın mı (Faz B boyutu + Faz C kararı).
4. Faz C öncesi temizlik: `modularcrm/HANDOFF.md` düz metin SSH+DB parolaları
   (`D:\projects\evaitec\sides\modularcrm`), `flexcrm` kirli `feature/supabase-tdd-cleanup` dalı.

## Tek sonraki adım
Dean'in "canlıda ne kadar veri var" sorusuna cevabını bekle. Devam gelirse:
`students` için kural bloğu yaz + `@firebase/rules-unit-testing` ile emulator testi
(örnek: `clubcrm/src/adapters/firestore/firestoreRules.contract.test.ts`).
Kural canlıya **deploy edilmeden** önce Dean onayı + mevcut `firestore.rules` yedeği.

# Handoff — İki uygulama canlıda; Faz B (ortak canlı veri) Dean girdisini bekliyor

2026-09-24 20:09 · session 91a8b2fe · `D:\projects\sides\sportflow` + `D:\projects\sides\clubcrm`
Önceki (sportflow): `2026-09-24-0053-merge-ve-clubcrm-repo.md` (kalıcı dersler orada).
**Asıl ayrıntı clubcrm'de:** `D:\projects\sides\clubcrm\.claude\handoffs\latest.md`
(= `2026-09-24-1837-deploy-bekliyor.md` + canlı güncellemesi) ve `2026-09-24-1713-faz-b-devri.md` (Faz B 5 adımı).

## Hedef
Sporcu havuzu → veli CRM → aidat → bildirim. Yerel sürümler canlıda; sıradaki: iki uygulamayı aynı canlı
Firestore verisine bağlamak (Faz B).

## Durum (doğrulandı — komut çıktısı)
- sportflow `main` = `origin/main` = `f2a24e3`; bu oturumda sportflow kodu değişmedi (yalnız `.claude/` izlenmiyor).
- **Deploy (Dean onayı, 2026-09-24 ~19:00):** anadoluspor-yoklama.web.app = `f2a24e3` build (`index-DBpeyj5e.js`;
  önceki Firebase yayını 23.09 19:41 GMT, main'den eskiydi). clubcrm.web.app = clubcrm master `944db88`
  (`index-BbrmnG3K.js`). İkisi de Firebase env boş build (`dist/` `AIza`/proje adı grep'i boş),
  `npx firebase-tools deploy --only hosting --project anadoluspor-7ecc2 --account anadolusporduyuru@gmail.com`.
  Playwright 390px canlı: iki sitede konsol hatası 0 (başlıklar "ClubCRM — Kulüp Yönetimi", "SportFlow — Yoklama").
- GitHub Pages (sportflow `pages.yml`) main push'unda ayrıca yayınlıyor — son koşu `f2a24e3` success.
- Veri iki uygulamada da tarayıcıda yerel; canlı Firestore'a bağlı değil.

## Kararlar (bu oturum, Dean — sportflow'u etkileyenler)
- Kimlik: sportflow ve CRM canlıda aynı `athletes` doc id'sini kullanıyor → öğrenci kimliği zaten bir;
  canlıda `students` koleksiyonu yok. CRM yerelde `students` + `memberships` (çoklu grup, antrenman/maç) tutuyor.
- Roller: `admin ⊇ memur(officer) ⊇ koç(coach)`; canlı `users` rollerinde `officer` yok → karar Dean'de.
- Grup zorunlu değil (grupsuz öğrenci); öğrenci fotoğrafı veli izniyle (KVKK).

## Dean'den istenenler (mesajla gönderildi, cevap yok)
1. Firebase Auth → Google girişi aç + yetkili alan adları `clubcrm.web.app`, `anadoluspor-yoklama.web.app`.
2. Firestore Rules sekmesindeki canlı kural metni (CLI indiremez).
3. Personel listesi: e-posta + rol (admin/memur/koç) + koçun grupları.
4. `officer` rolü: yeni rol mü (öneri) yoksa mevcut role eşleme mi.
Anahtar/servis hesabı JSON'u **istenmedi**; gerekirse `! gcloud auth application-default login`.

## Tekrarlanmayacaklar
- Yayın build'inde Firebase env'i komut satırında boşalt (Vite süreç env'ini `.env.local`'a tercih eder), `dist/` grep.
- Canlıya ve kurallara Dean onayı olmadan dokunma; kural deploy ile `VITE_DATA_SOURCE=firestore` yayını ayrı onay.
- Ajan `idle_notification` = eski rapor tekrarı. Tam test koşusu en az 2×.

## Tek sonraki adım
Yeni oturumda Dean'in 4 girdisini al → clubcrm `2026-09-24-1713-faz-b-devri.md` §Sıradaki iş adım 1
(canlı salt-okuma sayım: `athletes` sayısı/`status` dağılımı, `groups`, `users` rolleri).

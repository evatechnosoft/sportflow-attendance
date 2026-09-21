# SportFlow — Arayüz yenileme planı

**Durum (2026-09-21):** P0 ve P1 tamamlandı (`feature/ui-p0-p1`), yayın **https://anadoluspor-yoklama.web.app**
(canlı okuma, `VITE_FIRESTORE_WRITES=off`). `sportflow` site adı Firebase'de başka projeye ayrılıydı.
Araç kararından sapma: shadcn/lucide **eklenmedi** — sheet yerel `<dialog>`, ikonlar inline SVG, yeni bağımlılık sıfır.
AA kontrast `src/app/theme.test.ts` ile kilitli; plandaki `late #B45309` soft zemininde 4.5 altı çıktı → `#92400E`.
Google girişi için `anadoluspor-yoklama.web.app` Authentication > Authorized domains'e **eklenmeli** (Console, elle).
Sırada: P2 (14 kaydedilmemiş değişiklik koruması öncelikli), sonra yazmayı açma kararı.
**Teşhis:** Bu bir saha aracı değil, mobil genişliğe sıkıştırılmış bir CRUD paneli.
Tüm ekran üç primitiften kurulu (`rounded-2xl bg-white p-4 shadow-sm` + gri `text-sm`
etiket + yeşil buton); asıl iş olan "10 kişiye hızla durum ver" eylemi ekranın ortasında
sıradan bir satır olarak duruyor.

## Kanıtlanmış kusurlar

Etki sırasına göre, hepsi dosya/satır referanslı:

1. **Fontlar hiç yüklenmiyor.** `index.css` Inter + Poppins tanımlıyor ama `index.html`
   ve CSS'te tek `<link>` / `@font-face` / `@import` yok (grep ile doğrulandı) →
   Android'de Roboto, iOS'ta SF Pro. Yavanlığın birinci sebebi.
2. **Kaydırma hissedilmiyor.** `AttendanceRow.tsx:50-61` — `dragConstraints {left:0,right:0}`
   + `dragElastic 0.35`: parmak 56px gider, kart ~20px kıpırdar, sonra zıplar.
   `info.velocity.x` hiç kullanılmıyor.
3. **Kaydet butonu sticky değil** (`AttendanceScreen.tsx:159`), 20 kişilik grupta ekran
   dışında kalıyor. "Kaydedildi." mesajı hiç sönmüyor → sonradan işaret değiştirilince
   yalancı güven veriyor.
4. **Dokunma hedefleri 44px altında** — durum butonları `px-3 py-1.5` ≈ 32px, üstelik
   `flex-wrap` ile alt satıra sarıyor. Üst sekmeler ~30px ve ekranın en uzak köşesinde.
5. **Durum renkleri WCAG AA'dan geçmiyor** — `#ffa500` beyaz üstünde 2.1:1; turuncu ile
   kırmızı hızlı bakışta karışıyor.
6. **En nadir değişen kontroller tepede.** Grup %90 aynı, tarih %90 bugün; ikisi de ilk
   ekranı işgal eden bir form kartında (`:94-130`).
7. **İpucu okları jestin tersi.** Sol kenarda `← Var` yazıyor ama sağa kaydırmak "var".
8. **Kaydedilmemiş değişiklik koruması yok** — grup/tarih değişince işaretler sessizce gider.
9. **Tarih UTC'den hesaplanıyor** (`:9` `toISOString().slice(0,10)`) → TR'de 00:00–03:00
   arası bir önceki günü açar. `toLocaleDateString('en-CA')` ile çözülür.
10. **Geçmiş şeridi rozet salatası** (`V3 G1 İ0 Y2`), `title` mobilde çalışmaz, sıfırlar gürültü.
11. Özet şeridi işaretleme başlamadan **"%0 katılım"** diyor; doğru başlangıç "henüz
    işaretlenmedi". Hata mesajı ham `Error.message` basıyor.

## Elimizdeki hazır kaynaklar (yeniden çizmeye gerek yok)

- **`volleyball-club-platform/stitch_export/`** — 16 ekranın gerçek HTML'i + PNG'si.
  Yoklama ekranı: `stitch_spor_kul_b_y_netimi\yoklama_ekran\code.html` (273 satır, M3
  token seti). Düzeni: seans kartı + CHANGE, **ikiz PRESENT/ABSENT sayacı**, avatar + ad
  + toggle satırı (arkada dev yarı saydam forma numarası), tam genişlik "SAVE ATTENDANCE",
  4'lü alt nav. İkinci varyant: `yoklama_ve_deme_uyar_lar_pwa\code.html`.
  Ayrıca değerlendirme slider ekranı ve koyu tema takım ekranı hazır.
- **`DESIGN_SYSTEM.md`** (aynı proje) — 8px grid, tipografi ölçeği, kart/input/odak
  değerleri, WCAG AA tablosu. Yapıyı al, teal paleti alma.
- **Eski `SportFlow` repo klonu** — `src/config/ui-config.ts` (`UIConfig` tipi: tema modu,
  accent, blur/blob anahtarları, layout, dashboard varyantı) ve
  `src/components/ui/TimeDialPicker.tsx` (nişli saat seçici) doğrudan taşınabilir.
  Kendi "SportFlow Modern" token kuşağı: bg `#06090f`, glass `rgba(255,255,255,.03/.06)`,
  text `#f1f5f9 / #8b9ec2 / #4a5a7a`, accent `#f97316` + `#3b82f6`, blur 16, radius 20.
  ⚠️ Aynı dosyadaki ~60 satırlık `:root.light` `!important` yaması **devralınmayacak** —
  token-first yazınca o sorun hiç doğmaz.
- **evaglass tasarım sistemi** — marka-nötr `base` bloğu: space ölçeği, `screenPad
  bottom:128` (alt nav payı), radius card 26 / field 16 / pill 100, buttonH 52, tapMin 44,
  motion eğrileri `cubic-bezier(.22,1,.36,1)`, stagger 110ms, blur chip/card/nav 14/22/26.
  Aurora'nın teal-indigo-magenta üçlüsü alınmaz, disiplini alınır (tek accent, emoji ikon yok).

## Araç kararı — yeni bağımlılık eklemiyoruz

| Karar | Gerekçe |
|---|---|
| **shadcn/ui** (MIT, 124k★; Temmuz 2026'dan beri Base UI varsayılan, Tailwind v4 + OKLCH) | Kopyala-yapıştır, npm bağımlılığı değil. Kurulum: `npx shadcn@latest init` + `add button card avatar badge tabs sheet sonner chart` |
| **lucide-react** (ISC) | shadcn varsayılanı, ticari kullanım serbest |
| **motion** (MIT) — zaten var | Swipe'ı 40 satırda kendimiz yazıyoruz. ⚠️ motion.dev'in resmi swipe-actions örneği **Motion+ ücretli paketinde**, kaynağı kullanılmayacak |
| Grafik: shadcn `chart` (Recharts sarmalayıcı, MIT ~136 KB) | Tremor'a (Apache-2.0) gerek yok, tek bağımlılık az |
| **Elenenler** | Park UI (Panda CSS — yığın çakışması), Radix Themes (kendi CSS'i), Flowbite (iyi bloklar $299 Pro), `react-swipeable-list` (2 yıl güncellenmemiş), HeroUI v3 (lisansı doğrulanmadı, ekosistem yeni) |
| Hazır "attendance starter" | **Yok.** GitHub `sports-management` topic'inde en büyük repo 4 yıldız; fork temizlemek sıfırdan yazmaktan pahalı |

## Hedef düzen

```
┌────────────────────────────────────┐
│ ● 9-10 Grubu · Voleybol        ▾   │ 56px · başlık = grup seçici (sheet)
│   Cumartesi 20 Eylül               │
├────────────────────────────────────┤
│  ◀   BUGÜN   ▶        ● 3 kayıtlı  │ ±1 gün, takvim ikincil
├────────────────────────────────────┤
│  ████████████░░░░░░  8/10          │ yığılmış renkli ilerleme
│  6 var · 2 geç · 1 izinli · 1 yok  │ (boşken "%0" DEĞİL)
├────────────────────────────────────┤
│ ┃ AY  Ada Yılmaz            ●   ›  │ 72px satır, 40px baş-harf rozeti
│ ┃ MK  Mina Kaya                 ›  │ sol 4px şerit = durum rengi
├────────────────────────────────────┤
│  ╔══════════════════════════════╗  │ STICKY, yalnız değişiklik varken
│  ║  Kaydet · 8 işaret           ║  │
├────────────────────────────────────┤
│  ▣ Yoklama   ▦ Geçmiş  ⚙ Tanımlar │ alt nav (üst sekme değil)
└────────────────────────────────────┘
```

Kart anatomisi: dört durum butonu kart yüzeyinden kalkar; karta dokununca 44px yüksekliğinde
tam genişlik segment olarak açılır. `SessionHistory` ana ekrandan çıkıp kendi sekmesine gider.

**Kaydırma nasıl hissetmeli:** kart parmağı 1:1 takip etsin (elastik yalnız eşik ötesinde
0.2) · arkadaki eylem ikonu `useTransform(x,[0,56],[0.6,1])` ile büyüsün, oklar doğru yöne
dönsün · eşik geçilince ikon spring ile `1→1.25→1`, zemin tam renge boyansın,
`navigator.vibrate(10)` · bırakınca zıplamasın, 150ms spring ile yerleşsin ·
`info.velocity.x` hesaba katılsın · 4 sn "Ada → Var · Geri al" toast'ı.

## Görsel yön — karar: iki tema birden [Dean, 2026-09-19]

Tek yön seçilmedi; **açık ve koyu iki tam tema** yazılıyor, kullanıcı seçiyor.

**Açık tema** — nötr ve sakin, sahada güneş altında okunur:
zemin `#F4F5F3`, yüzey `#FFFFFF`, ikincil yüzey `#EDEFEA`, çizgi `#DCDFD8`,
mürekkep `#16181C` / `#5A6068` / `#8A9098`, marka lacivert `#1B2A4A`,
durumlar beyazla ≥4.5:1 → `present #0E7A3C`, `late #B45309`, `excused #475569`,
`absent #B91C1C`, zeminleri `#DCF2E4` / `#FBEBD9` / `#E6E9ED` / `#FAE0E0`.

**Koyu tema** — SportFlow'un kendi sportif dili, ölçülü cam:
zemin `#0F1113`, yüzey `#17191C`, ikincil `#212429`, çizgi `#2C3036`,
mürekkep `#ECEEF0` / `#A2A8B0` / `#6E757D`, marka `#7FA0E0`,
durumlar `present #34C77B`, `late #E8A33D`, `excused #97A1AE`, `absent #F0645F`,
zeminleri `#132B1F` / `#2E2113` / … Cam yalnız **katmanlı** öğede (yapışkan alt bar,
yüzen kart) — liste kartlarının tamamına uygulanmaz, metin kontrastı gerçek telefonda
ölçülür.

Kurallar:
- Her renk `:root` içinde tam olarak bir kez tanımlanır; koyu değerler
  `@media (prefers-color-scheme: dark)` ve `:root[data-theme="dark"]` bloklarında
  **yalnız token olarak** ezilir. Bileşenlerde ham hex yok.
- Varsayılan = sistem tercihi. Üçüncü durum olarak elle seçim (`data-theme` açık/koyu)
  saklanır — `ui-config.ts` deseni (`theme.mode: light|dark|system`) devralınır.
- Tipografi iki temada ortak: display Bricolage Grotesque (ya da Lexend), gövde Geist
  (ya da Inter). Ölçek 28/24/20/16/14/12, lh 1.2 ve 1.5, etiketler uppercase `0.05em`.
- Durum renkleri iki temada da AA'dan geçmek zorunda; kontrast ölçümü P0'ın kapanış şartı.

## Uygulama sırası

**P0 — bir oturumda biter, görünür fark büyük**
1. Fontları gerçekten yükle (`index.html`'e Google Fonts `<link>`, `font-display: swap`)
2. Token setini `@theme`'e yaz — **açık + koyu ikisi birden**, durum renkleri AA'dan geçsin;
   tema anahtarı (sistem / açık / koyu) ve `data-theme` kalıcılığı aynı adımda
3. Kaydet butonunu sticky yap, yalnız değişiklik varken göster; "Kaydedildi." 3 sn sonra sönsün
4. Dokunma hedeflerini 44px'e çıkar, satırı 72px yap
5. UTC tarih hatasını düzelt (`toLocaleDateString('en-CA')`)
6. Kaydırma fiziğini düzelt (1:1 takip, velocity, spring yerleşme, doğru yön okları, titreşim)

**P1 — düzen**
7. Alt navigasyon (Yoklama / Geçmiş / Tanımlar), üst sekmeler kalkar
8. Grup seçici başlığa taşınır, sheet olarak açılır; tarih ±1 gün + takvim ikincil
9. Yığılmış ilerleme çubuğu + durum dağılımı; "%0" yerine "henüz işaretlenmedi"
10. Satır anatomisi: baş-harf rozeti, sol durum şeridi, dokununca açılan segment

**P2 — derinlik**
11. Koyu/açık tema anahtarı (`ui-config.ts` deseni devralınır)
12. Geçmiş sekmesi: takvim görünümü + oturum kartları (rozet salatası yerine)
13. Boş durumlar eyleme bağlanır ("Grup ekle" butonu), hata mesajları insanileşir
14. Kaydedilmemiş değişiklik koruması (grup/tarih değişiminde uyarı)

**P3 — sonraki tur**
15. Rapor ekranı (okul/branş/grup kırılımı, katılım eğrisi — shadcn `chart`)
16. Değerlendirme slider'ları (stitch ekranından), hafta içi/hafta sonu program ayrımı

Her adım kendi testiyle kapanır; mevcut 53 test yeşil kalmalı, `npm run build` ve Pages
dağıtımı her fazın sonunda doğrulanır.

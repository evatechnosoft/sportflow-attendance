# SportFlow — Spec v1 (mock)

Kulübün okul bazlı antrenman yoklaması. v1 kapsamı **yoklama zinciri**; ödeme,
veli portalı, mesajlaşma kapsam dışı (port arayüzleriyle sonra eklenir).

## Aktörler

- **Koç** — kendi gruplarının oturumlarında yoklama alır.
- **Yönetici** — okul / branş / grup / oyuncu tanımlar, kulüp geneli rapor görür.

v1'de kimlik doğrulama yok; rol seçimi mock. Auth, `AuthPort` arkasında faz 6.

## Domain

```
School  1─n  Group  n─1  Branch
Group   1─n  Player
Group   1─n  Session      (tek antrenman oturumu, tarih + saat)
Session 1─n  Attendance   (oyuncu başına tek kayıt)
```

Okul ayrı varlıktır (anadolu-spor'da `Player.schoolName` düz string'ti — rapor
kırılımı ve grup ataması için yetmiyor).

Bir grup tek branşa ve tek okula bağlıdır. Aynı okulda aynı branştan birden çok
grup olabilir (yaş/seviye).

## Kullanıcı hikâyeleri ve kabul kriterleri

### US-1 Yoklama alma
Koç bir grubun bugünkü oturumunu açar, listedeki her oyuncuya tek dokunuşla
durum verir, kaydeder.

- Oturum açıldığında grubun **aktif** oyuncuları listelenir, varsayılan durum yok.
- Durumlar: `present`, `absent`, `late`, `excused`.
- Aynı oturum + oyuncu için ikinci kayıt **üzerine yazar**, ikinci satır açmaz.
- Kaydedilmemiş oturum tekrar açıldığında önceki işaretler geri gelir.
- Oturumu olmayan gün için yoklama alınamaz (önce oturum oluşturulur).

### US-2 Okul / branş / grup tanımlama
- Branş adı ve slug kulüp genelinde tekildir.
- Okul adı tekildir.
- Grup, var olan bir okul ve var olan bir branşa bağlanmadan oluşturulamaz.
- İçinde oyuncusu olan grup silinemez.

### US-3 Oyuncu kaydı
- Oyuncu bir gruba atanır; grubun okulu oyuncunun okulu sayılır.
- Pasif (`inactive`) oyuncu yoklama listesinde çıkmaz, geçmiş kayıtları durur.

### US-4 Rapor
- Grup bazında dönem içi katılım yüzdesi.
- Okul bazında ve branş bazında kırılım.
- Üst üste 3 oturum gelmeyen oyuncu işaretlenir.

## Mimari kuralı

UI hiçbir zaman somut veri kaynağını görmez. Her varlık için bir port
(`ports/`), v1'de tek adapter (`adapters/mock`), sonra `adapters/api`.
Her port için **contract test** yazılır; her adapter aynı testi geçmek
zorundadır — mock yeşilse API adapter'ı bağlandığında fark anında görünür.

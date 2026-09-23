# Sporcu yönetimi — spec + uygulama planı

> 2026-09-23 · Dean kararları bu belgede tarihli köşeli parantezle işaretli.
> Yürütme: her görev TDD (kırmızı → yeşil → commit). Uygulayan ajan `superpowers:executing-plans`
> ya da `subagent-driven-development` ile ilerler.

## Neden bu belge

Bugün uygulamada sporcu ekleme/çıkarma **hiç yok**: port hazır
(`src/ports/repositories.ts:38-42`), mock uygular (`mockDataSource.ts:143-155`),
Firestore adaptörü koşulsuz reddeder (`firestoreDataSource.ts:112-117`),
arayüzde hiçbir ekran yoktur. Çıkan/giren sporcu şu an yalnız eski uygulamadan
veya Firebase Console'dan yönetilebiliyor.

---

## Kapsam kesimi — üç ayrı iş

Dean'in tarif ettiği bütün (sporcu havuzu + veli CRM + ödeme + bildirim +
alan-tanımlı genel CRM) tek spec'e sığmaz ve sığdırılmamalı: üç ayrı ürün, üç
ayrı risk profili. Bölüm:

| Faz | İş | Nerede | Durum |
|---|---|---|---|
| **A** | Sporcu havuzu: ekle · grup değiştir · ayrıldı/geri al · doğum tarihi · grup geçmişi | `sportflow` | **bu belge** |
| **B** | Canlı `students` koleksiyonu + `athletes` göçü + yazma açma | `sportflow` | taslak, § Faz B |
| **C** | Veli CRM · aidat · ödedi/ödemedi süzme · WhatsApp bilgilendirme · alan-tanımlı genel CRM | dört aday repo | ayrı spec, § Faz C notları |

Faz A tek başına çalışır ve tek başına test edilir. B ve C ona bağlıdır, tersi değil.

### Faz C'nin bugünkü gerçeği (kanıt)

Dean'in tarif ettiği "genel kullanım, alan eklenebilir, eklenen alan ekranda
çizilir" CRM **dört kez başlanmış, hiçbiri bitmemiş**. Beşincisini açmadan önce
tablo:

| Proje | Amaç | Gerçek durum (dosya sayımı / grep ile doğrulandı) |
|---|---|---|
| `sides/clubcrm` | Spor kulübü: veli, aidat, ödeme, tahsilat takvimi | **En olgunu.** domain/ports/adapters + contract test, `billing.ts`, mock + IndexedDB + Firestore adaptörleri, `firestoreRules.contract.test.ts`. Dean'in istediği repository/DI disiplini burada zaten kurulu. |
| `sides/flexcrm` | Sigorta + HVAC, multi-tenant | Orta. React 18 + Express + SQLite/Supabase, modüller (Customer/Insurance/Claim/HVAC), Cmd+K arama, Drive entegrasyonu. **Dinamik alan yok** (grep boş). Dal kirli: `feature/supabase-tdd-cleanup` staged+unstaged. |
| `evaitec/sides/modularcrm` | Modüler CRM, jsonb dinamik alan, RabbitMQ, module federation | **İskelet.** `core-api/src` 11 dosya, `frontend-host/src` 5 dosya, **test yok**. `DynamicFieldRenderer.tsx` 41 satır — yalnız input çizer, alan tanımlama ekranı ve kaydetme yolu yok, `metadata: any` (strict typing kuralı ihlali). Commit `a120087` jsonb modülünü denemiş ama `init_db.sql`'deki `customers` tablosunda jsonb kolonu yok. Son commit Nisan 2026. |
| `evaitec/sides/CRM/luminaglasscrm` | Next.js modüler CRM | **Neredeyse boş.** `create-next-app` + 24 satırlık `core/moduleRegistry.ts`, 2 commit, `modules/` ve `tests/` klasörleri boş. Buna karşılık `inputs/` altında 60+ PRD/task dokümanı — plan koddan kat kat ağır. |

Çıkarım: eksik olan fikir değil, **bitirme**. Dinamik alan fikrinin en ileri
hâli `modularcrm`'in jsonb denemesi (41 satır), en sağlam mimari `clubcrm`'in
ports/adapters + contract test disiplini. Faz C bu ikisini birleştirmelidir;
beşinci bir iskelet açmamalıdır.

**Güvenlik — acil:** `evaitec/sides/modularcrm/HANDOFF.md` düz metin SSH
parolası ve PostgreSQL parolası taşıyor. Repo geçmişinde de duruyor. Faz C'ye
girmeden önce temizlenmeli (parolalar döndürülmeli, dosya `~/.ai/vg.env`
pointer'ına çevrilmeli).

Ayrıca ödeme tarafı `clubcrm`'de **zaten yazılmış**: `Customer` (veli, telefon,
e-posta, `playerIds`), `FeePlan`/`Installment`/`Payment`, `domain/billing.ts`
(ödedi / kısmi / gecikti kayıtta tutulmaz, türetilir), `CollectionSchedule`
ekranı. Yoklamaya yalnız `AttendanceReadPort` ile salt-okunur bakar
(`clubcrm/src/ports/repositories.ts:56-62`). Ödeme takibini SportFlow'a
eklemek bu katmanı ikinci kez yazmak olur — yapılmayacak.

Stack çatallanması: `sportflow`/`clubcrm` Firestore + ports/adapters,
`flexcrm` Express + SQLite, `modularcrm` Express + PostgreSQL + RabbitMQ,
`luminaglasscrm` Next.js. Faz C'nin ilk kararı bu çatalın hangi tarafta
birleşeceğidir — Faz A bu karardan bağımsızdır.

---

## Faz A — Spec

### Kararlar

- **Sporcu ana kaydı yeni koleksiyonda** [Dean, 2026-09-23]. Canlıdaki
  `athletes` kirli (mükerrer grup kayıtları, `"Grup - Ad Soyad"` biçimli isimler,
  eksik alanlar — `mapping.ts:43-60` bunları temizlemek için var). Yeni
  koleksiyon adı: **`students`**.
- **Domain tipi `Player` adıyla kalır.** Yeniden adlandırma tüm dosyalara yayılan
  diff üretir, karşılığı yok. Koleksiyon adı ile domain adı arasındaki çeviri
  zaten `adapters/firestore/mapping.ts`'in işi.
- **Hard delete yok.** Yoklama kayıtları `playerId`'ye bağlı
  (`attendance/{groupId}_{date}.records[playerId]`); sporcu silinirse geçmiş
  yoklama isimsiz kalır. "Ayrıldı" = `status: 'inactive'`.
- **Grup geçmişi sporcu belgesinin içinde dizi.** Ayrı `memberships`
  koleksiyonu açılmaz: bir sporcu ömrü boyunca birkaç kez grup değiştirir, ayrı
  koleksiyon her liste için ikinci sorgu demektir.
- **Yaş/kategori türetilir, tutulmaz.** `birthDate` kayıtta; U12/U14 etiketi
  hesaplanır. İki yerde tutulan veri er geç çelişir.
- Faz A **mock üzerinde** geliştirilir ve demo yayında denenir. Canlı yazma
  kapalı kalır (`VITE_FIRESTORE_WRITES=off`).

### Domain

```ts
/** Bir sporcunun bir gruptaki dönemi. Açık dönem: leftOn yok. */
export interface GroupSpell {
  groupId: Id
  /** ISO date, YYYY-MM-DD */
  joinedOn: string
  /** ISO date; yoksa sporcu bu grupta hâlâ aktif. */
  leftOn?: string
}

export interface Player {
  // … mevcut alanlar
  /** Geçmişten bugüne, joinedOn'a göre artan. Son kayıt güncel dönemdir. */
  groupHistory: GroupSpell[]
}
```

`Player.groupId` ve `Player.status` **kalır** — güncel durumu okumak için
her yerde diziyi taramak gerekmesin. `groupHistory` ikisinin denetim izidir;
türetme fonksiyonları ikisinin tutarlılığını garanti eder.

### Kurallar (kabul kriterleri)

1. Yeni sporcu bir gruba eklenir → `groupHistory` tek açık dönemle başlar
   (`joinedOn` = bugün, `leftOn` yok), `status: 'active'`.
2. Grup değişiminde açık dönem `leftOn` = değişim tarihi ile kapanır, yeni
   grup için yeni açık dönem açılır. Aynı gün iki değişim olursa aynı gün
   kapanıp açılır (sıfır günlük dönem kaydı kalır, silinmez).
3. Zaten bulunduğu gruba taşıma çağrısı **hiçbir şey değiştirmez** (yeni dönem
   açmaz, hata da fırlatmaz).
4. "Ayrıldı" → `status: 'inactive'`, açık dönem `leftOn` ile kapanır. Sporcu
   yoklama listesinden düşer, geçmiş yoklamalarda görünmeye devam eder.
5. "Geri al" → `status: 'active'`, **seçilen grup** için yeni açık dönem açılır
   (eski dönem geri açılmaz; geri dönüş yeni bir dönemdir).
6. Pasif sporcu `listByGroup` varsayılanında çıkmaz, `includeInactive: true`
   ile çıkar — mevcut davranış korunur.
7. Doğum tarihi opsiyoneldir; girilirse `YYYY-MM-DD`, gelecekte olamaz.
8. Bir gruba ait sporcusu olan grup silinemez — mevcut kural
   (`mockDataSource.ts:126`), pasif sporcu da sayılır.

### Ekran — "Sporcular" sekmesi

Alt navigasyona dördüncü sekme. `ManageScreen` (okul/branş/grup) tanım ekranı
olarak kalır; sporcu günlük iş olduğu için ayrı sekmeye çıkar.

```
┌─────────────────────────────┐
│ Voleybol U12 ▾      14 aktif│   ← grup seçici (GroupSheet yeniden kullanılır)
├─────────────────────────────┤
│ + Sporcu ekle               │   ← açılır form: ad, soyad, doğum tarihi
├─────────────────────────────┤
│ Ada Yıldız        2013  ⋯   │   ← ⋯ → Grubu değiştir · Ayrıldı
│ Can Erdoğan       2014  ⋯   │
│ …                           │
├─────────────────────────────┤
│ ▸ Ayrılanlar (3)            │   ← katlanır; her satırda "Geri al"
└─────────────────────────────┘
```

- Grup seçici `features/attendance/GroupSheet.tsx` ve `useGroupOptions.ts`
  yeniden kullanılır; ikinci seçici yazılmaz.
- Seçim `app/selection.tsx` context'inden gelir — Yoklama ekranında seçili grup
  Sporcular sekmesinde de seçilidir.
- Satır yüksekliği ve token'lar `AttendanceRow` ile aynı; yeni tasarım dili yok.
- Yıkıcı olmayan ama geri çevrilmesi iş olan iki eylem (grup değiştir, ayrıldı)
  `<dialog>` onayı ister — `dialog.sheet` sınıfı mevcut (`index.css`).

---

## Faz A — Dosya yapısı

| Dosya | Sorumluluk |
|---|---|
| `src/domain/types.ts` (değişir) | `GroupSpell` tipi, `Player.groupHistory` |
| `src/features/students/membership.ts` (yeni) | Saf fonksiyonlar: dönem açma/kapama, güncel grup, yaş. Bağımlılıksız. |
| `src/features/students/membership.test.ts` (yeni) | Yukarıdakinin testi |
| `src/ports/repositories.ts` (değişir) | `PlayerRepository.update(id, patch)`; `setStatus` kaldırılır |
| `src/adapters/mock/mockDataSource.ts` (değişir) | `update` uygulaması, `create`'te `groupHistory` |
| `src/adapters/firestore/firestoreDataSource.ts` (değişir) | `update` → `readOnly()` (Faz B'ye kadar) |
| `src/testing/dataSourceContract.ts` (değişir) | Yeni kuralların contract testi |
| `src/features/students/StudentsScreen.tsx` (yeni) | Ekran |
| `src/features/students/StudentsScreen.test.tsx` (yeni) | Ekran testi |
| `src/App.tsx` (değişir) | Dördüncü sekme + ikon |
| `src/adapters/mock/seed.ts` (değişir) | Demo veride `groupHistory` ve birkaç ayrılmış sporcu |

`setStatus` → `update` değişimi bilinçli: iki metot aynı işi yapar, `update`
grup değişimini de karşılar. DRY. Çağrı yeri bugün yalnız contract test'te
(`dataSourceContract.ts:93`) — üretim kodunda kullanılmıyor, kırılma yüzeyi dar.

---

## Faz A — Görevler

Her görev sonunda `npm test` tamamı yeşil olmadan commit yok.
Dal: `feature/sporcu-yonetimi`, `feature/ui-p0-p1` üzerinden açılır (o dal
henüz main'e merge edilmedi).

---

### Görev 0: Dal aç

- [ ] **Adım 1: Dalı aç**

```bash
cd /d/projects/sides/sportflow
git checkout feature/ui-p0-p1
git checkout -b feature/sporcu-yonetimi
git status -sb
```

Beklenen: `## feature/sporcu-yonetimi`, çalışma alanı temiz.

---

### Görev 1: Üyelik dönemi — saf mantık

**Dosyalar:**
- Oluştur: `src/features/students/membership.ts`
- Oluştur: `src/features/students/membership.test.ts`
- Değiştir: `src/domain/types.ts`

- [ ] **Adım 1: Tipi ekle**

`src/domain/types.ts` içine, `Player` tanımının üstüne:

```ts
/** Bir sporcunun bir gruptaki dönemi. Açık dönem: leftOn yok. */
export interface GroupSpell {
  groupId: Id
  /** ISO date, YYYY-MM-DD */
  joinedOn: string
  /** ISO date; yoksa sporcu bu grupta hâlâ aktif. */
  leftOn?: string
}
```

`Player` arayüzüne son alan olarak:

```ts
  /** Geçmişten bugüne, joinedOn'a göre artan. Son kayıt güncel dönemdir. */
  groupHistory: GroupSpell[]
```

- [ ] **Adım 2: Kırmızı test yaz**

`src/features/students/membership.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Player } from '../../domain/types'
import { ageOn, changeGroup, currentSpell, leaveGroup, rejoinGroup, startSpell } from './membership'

const player = (overrides: Partial<Player> = {}): Player => ({
  id: 'p1',
  firstName: 'Ada',
  lastName: 'Yıldız',
  groupId: 'g1',
  status: 'active',
  groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }],
  ...overrides,
})

describe('üyelik dönemleri', () => {
  it('yeni sporcu tek açık dönemle başlar', () => {
    expect(startSpell('g1', '2026-09-23')).toEqual([{ groupId: 'g1', joinedOn: '2026-09-23' }])
  })

  it('grup değişimi açık dönemi kapatır ve yenisini açar', () => {
    const moved = changeGroup(player(), 'g2', '2026-09-23')
    expect(moved.groupId).toBe('g2')
    expect(moved.groupHistory).toEqual([
      { groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-23' },
      { groupId: 'g2', joinedOn: '2026-09-23' },
    ])
  })

  it('aynı gruba taşıma hiçbir şey değiştirmez', () => {
    const before = player()
    expect(changeGroup(before, 'g1', '2026-09-23')).toEqual(before)
  })

  it('ayrılma açık dönemi kapatır ve durumu pasife çeker', () => {
    const left = leaveGroup(player(), '2026-09-23')
    expect(left.status).toBe('inactive')
    expect(left.groupHistory.at(-1)).toEqual({
      groupId: 'g1',
      joinedOn: '2026-09-01',
      leftOn: '2026-09-23',
    })
  })

  it('geri dönüş eski dönemi açmaz, yeni dönem açar', () => {
    const back = rejoinGroup(leaveGroup(player(), '2026-09-23'), 'g2', '2026-10-01')
    expect(back.status).toBe('active')
    expect(back.groupId).toBe('g2')
    expect(back.groupHistory).toHaveLength(2)
    expect(back.groupHistory.at(-1)).toEqual({ groupId: 'g2', joinedOn: '2026-10-01' })
  })

  it('currentSpell yalnız açık dönemi döner', () => {
    expect(currentSpell(player())?.groupId).toBe('g1')
    expect(currentSpell(leaveGroup(player(), '2026-09-23'))).toBeNull()
  })

  it('yaş doğum gününden önce bir eksiktir', () => {
    expect(ageOn('2013-12-31', '2026-09-23')).toBe(12)
    expect(ageOn('2013-01-01', '2026-09-23')).toBe(13)
    expect(ageOn(undefined, '2026-09-23')).toBeNull()
  })
})
```

- [ ] **Adım 3: Testin kırmızı olduğunu gör**

```bash
npm test -- membership
```

Beklenen: FAIL — `Failed to resolve import "./membership"`.

- [ ] **Adım 4: Uygulamayı yaz**

`src/features/students/membership.ts`:

```ts
import type { GroupSpell, Id, Player } from '../../domain/types'

/** Yeni sporcunun ilk dönemi. */
export function startSpell(groupId: Id, on: string): GroupSpell[] {
  return [{ groupId, joinedOn: on }]
}

/** Kapanmamış dönem; sporcu ayrılmışsa null. */
export function currentSpell(player: Player): GroupSpell | null {
  const last = player.groupHistory.at(-1)
  return last && !last.leftOn ? last : null
}

const closeOpen = (history: GroupSpell[], on: string): GroupSpell[] => {
  const last = history.at(-1)
  if (!last || last.leftOn) return history
  return [...history.slice(0, -1), { ...last, leftOn: on }]
}

/** Aynı gruba taşıma no-op'tur: sahte dönem kaydı üretmez. */
export function changeGroup(player: Player, groupId: Id, on: string): Player {
  if (currentSpell(player)?.groupId === groupId) return player
  return {
    ...player,
    groupId,
    groupHistory: [...closeOpen(player.groupHistory, on), { groupId, joinedOn: on }],
  }
}

export function leaveGroup(player: Player, on: string): Player {
  return { ...player, status: 'inactive', groupHistory: closeOpen(player.groupHistory, on) }
}

/** Geri dönüş yeni bir dönemdir — eski dönem geri açılmaz. */
export function rejoinGroup(player: Player, groupId: Id, on: string): Player {
  return {
    ...player,
    status: 'active',
    groupId,
    groupHistory: [...closeOpen(player.groupHistory, on), { groupId, joinedOn: on }],
  }
}

/** Doğum günü geçmediyse bir eksik. Ay/gün karşılaştırması string ile yeterli. */
export function ageOn(birthDate: string | undefined, on: string): number | null {
  if (!birthDate) return null
  const years = Number(on.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return on.slice(5) < birthDate.slice(5) ? years - 1 : years
}
```

- [ ] **Adım 5: Yeşil olduğunu gör**

```bash
npm test -- membership && npx tsc -b
```

Beklenen: 7 test PASS, tsc 0 hata. `Player.groupHistory` zorunlu alan olduğu
için `mockDataSource` / `seed` / `mapping` tarafında tip hataları çıkacak —
bunlar Görev 2'de kapanır; bu adımda yalnız `membership` testinin yeşil
olması ve hataların **beklenen dosyalarda** olması aranır.

- [ ] **Adım 6: Commit**

```bash
git add src/domain/types.ts src/features/students/membership.ts src/features/students/membership.test.ts
git commit -m "feat(sporcu): grup dönemi mantığı — değişim, ayrılma, geri dönüş, yaş"
```

---

### Görev 2: Port ve mock adaptör

**Dosyalar:**
- Değiştir: `src/ports/repositories.ts:38-42`
- Değiştir: `src/adapters/mock/mockDataSource.ts:133-155`
- Değiştir: `src/adapters/firestore/firestoreDataSource.ts:112-117`
- Değiştir: `src/adapters/firestore/mapping.ts` (`toPlayer`)
- Değiştir: `src/adapters/mock/seed.ts`
- Değiştir: `src/testing/dataSourceContract.ts`

- [ ] **Adım 1: Contract testine yeni kuralları yaz (kırmızı)**

`src/testing/dataSourceContract.ts` içinde `US-3` bloğunda, satır 90'daki
`pasif oyuncu…` testinin `setStatus` çağrısını `update` ile değiştir ve
aşağıdaki üç testi ekle:

```ts
      it('yeni sporcu tek açık dönemle doğar', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        expect(player.groupHistory).toHaveLength(1)
        expect(player.groupHistory[0]).toMatchObject({ groupId: group.id })
        expect(player.groupHistory[0].leftOn).toBeUndefined()
      })

      it('grup değişimi yeni grubun listesinde görünür, eskisinde görünmez', async () => {
        const group = await seedGroup()
        const other = await db.groups.create({
          name: 'Voleybol U14',
          schoolId: group.schoolId,
          branchId: group.branchId,
          schedule: [],
        })
        const player = await seedPlayer(group.id)
        await db.players.update(player.id, {
          groupId: other.id,
          groupHistory: [
            { groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' },
            { groupId: other.id, joinedOn: '2026-09-23' },
          ],
        })
        expect(await db.players.listByGroup(group.id)).toHaveLength(0)
        expect(await db.players.listByGroup(other.id)).toHaveLength(1)
      })

      it('olmayan sporcu güncellenemez', async () => {
        await expect(db.players.update('yok', { status: 'inactive' })).rejects.toMatchObject({
          code: 'not_found',
        })
      })
```

`seedPlayer` yardımcısını (satır 31-32) `groupHistory` verecek biçimde güncelle:

```ts
    const seedPlayer = async (groupId: Id, firstName = 'Can') =>
      db.players.create({
        firstName,
        lastName: 'Erdoğan',
        groupId,
        status: 'active',
        groupHistory: [{ groupId, joinedOn: '2026-09-01' }],
      })
```

- [ ] **Adım 2: Kırmızı gör**

```bash
npm test
```

Beklenen: FAIL — `db.players.update is not a function`.

- [ ] **Adım 3: Portu değiştir**

`src/ports/repositories.ts`, `PlayerRepository`:

```ts
export interface PlayerRepository {
  listByGroup(groupId: Id, options?: { includeInactive?: boolean }): Promise<Player[]>
  create(input: Omit<Player, 'id'>): Promise<Player>
  /** Durum, grup ve dönem geçmişi tek kapıdan güncellenir. */
  update(id: Id, patch: Partial<Omit<Player, 'id'>>): Promise<Player>
}
```

- [ ] **Adım 4: Mock adaptörü uygula**

`src/adapters/mock/mockDataSource.ts`, `players` bloğunda `setStatus`'ü sil,
yerine:

```ts
      async update(id, patch) {
        const row = players.find((candidate) => candidate.id === id)
        if (!row) throw notFound('Oyuncu', id)
        if (patch.groupId) requireGroup(patch.groupId)
        Object.assign(row, patch)
        return { ...row }
      },
```

- [ ] **Adım 5: Firestore adaptörünü hizala**

`src/adapters/firestore/firestoreDataSource.ts`, `players` bloğunda
`setStatus`'ü `update` olarak yeniden adlandır — gövde `throw readOnly()`
kalır (canlı yazma Faz B'de açılır).

`src/adapters/firestore/mapping.ts`, `toPlayer` dönüşüne ekle:

```ts
    // Eski şemada dönem geçmişi yok; okunan kayıt tek açık dönem sayılır.
    groupHistory: [{ groupId: raw.groupId ?? '', joinedOn: '' }],
```

- [ ] **Adım 6: Demo veriyi güncelle**

`src/adapters/mock/seed.ts` içindeki her `Player` kaydına `groupHistory` ekle.
En az bir sporcu **ayrılmış** olsun (`status: 'inactive'`, son dönem `leftOn`
dolu) ve en az bir sporcunun **iki dönemi** olsun — ekran katlanır listeyi ve
geçmişi boş göstermesin.

- [ ] **Adım 7: Yeşil gör**

```bash
npm test && npx tsc -b && npm run lint
```

Beklenen: tüm test dosyaları PASS, tsc 0 hata, lint 0 hata.

- [ ] **Adım 8: Commit**

```bash
git add -A
git commit -m "feat(sporcu): players.update portu, mock uygulaması ve contract testleri"
```

---

### Görev 3: Sporcular ekranı

**Dosyalar:**
- Oluştur: `src/features/students/StudentsScreen.tsx`
- Oluştur: `src/features/students/StudentsScreen.test.tsx`
- Değiştir: `src/App.tsx:13-17` (sekme) ve `TabIcon`

- [ ] **Adım 1: Ekran testini yaz (kırmızı)**

`src/features/students/StudentsScreen.test.tsx` — mevcut
`AttendanceScreen.test.tsx`'in kurulum desenini (QueryClientProvider +
DataSourceProvider + SelectionProvider sarmalayıcıları) birebir kopyala,
sonra dört senaryo:

```ts
it('grubun aktif sporcularını listeler, ayrılanları katlanır bölümde tutar')
it('ad ve soyad ile yeni sporcu ekler, liste anında büyür')
it('grup değiştirince sporcu listeden düşer')
it('ayrıldı işaretlenince sporcu Ayrılanlar bölümüne geçer')
```

Her senaryo `createMockDataSource(seed)` ile beslenir; ağ yok.

- [ ] **Adım 2: Kırmızı gör**

```bash
npm test -- StudentsScreen
```

Beklenen: FAIL — dosya bulunamadı / bileşen tanımsız.

- [ ] **Adım 3: Ekranı yaz**

Kurallar:
- Grup seçimi `useSelection()` (`src/app/selection.tsx`) üzerinden; grup
  değiştirici olarak `GroupSheet` yeniden kullanılır.
- Veri `useQuery({ queryKey: ['players', groupId, 'all'], queryFn: () =>
  db.players.listByGroup(groupId, { includeInactive: true }) })`; aktif/pasif
  ayrımı bellekte yapılır, ikinci sorgu açılmaz.
- Mutasyonlar `useMutation` + `queryClient.invalidateQueries({ queryKey: ['players'] })`.
- Grup değiştir / ayrıldı → `membership.ts` fonksiyonlarını çağır, dönen
  `Player`'ın değişen alanlarını `db.players.update`'e ver. Dönem mantığı
  ekranda **tekrarlanmaz**.
- Bugünün tarihi `features/attendance/date.ts` → `todayIso()`; `new Date()`
  doğrudan çağrılmaz (yerel saat tuzağı orada çözülmüş).
- Hata gösterimi `ManageScreen`'deki `DomainError` deseniyle aynı.
- Yeni renk/ölçü token'ı icat edilmez; `index.css`'teki mevcutlar kullanılır.

- [ ] **Adım 4: Yeşil gör**

```bash
npm test -- StudentsScreen
```

Beklenen: 4 test PASS.

- [ ] **Adım 5: Sekmeyi bağla**

`src/App.tsx`: `TABS` dizisine `{ id: 'students', label: 'Sporcular' }`
(Geçmiş ile Tanımlar arasına), gövdeye `{tab === 'students' && <StudentsScreen />}`,
`TabIcon`'a `students` için inline SVG (kişi ikonu — yeni bağımlılık yok).

- [ ] **Adım 6: Tam doğrulama**

```bash
npm test && npx tsc -b && npm run lint
```

Beklenen: tüm testler PASS, tsc 0, lint 0 hata.

- [ ] **Adım 7: Commit**

```bash
git add -A
git commit -m "feat(sporcu): Sporcular ekranı — ekle, grup değiştir, ayrıldı, geri al"
```

---

### Görev 4: Demo yayında gözle doğrulama

- [ ] **Adım 1: Mock derle ve yerelde aç**

```bash
VITE_DATA_SOURCE=mock npm run build && npm run preview
```

- [ ] **Adım 2: Elle geç**

Telefon genişliğinde (390×844), açık ve koyu temada sırayla:
sporcu ekle → listede gör → grubunu değiştir → eski grupta yok, yenide var →
ayrıldı işaretle → Ayrılanlar altında → geri al → tekrar listede.

- [ ] **Adım 3: Demo yayını tazele**

```bash
VITE_DATA_SOURCE=mock VITE_FIREBASE_API_KEY= VITE_FIREBASE_AUTH_DOMAIN= VITE_FIREBASE_PROJECT_ID= VITE_FIREBASE_STORAGE_BUCKET= VITE_FIREBASE_MESSAGING_SENDER_ID= VITE_FIREBASE_APP_ID= npm run build
grep -r "AIza\|1056292362536" dist/ ; echo "boş olmalı"
npx firebase-tools deploy --only hosting:anadoluspor-yoklama --project anadoluspor-7ecc2 --account anadolusporduyuru@gmail.com
```

- [ ] **Adım 4: Dean'e ver, geri bildirim bekle**

Faz A burada durur. Canlı yazma açılmadan Faz B'ye geçilmez.

---

## Faz B — Canlı `students` (taslak, henüz spec değil)

Faz A onaylanmadan detaylandırılmaz. Bugünden bilinenler:

- **Firestore kuralları doğrulanmadı.** `docs/plan.md:39-44` yalnız okuma
  kurallarını belgeliyor; `athletes` yazma sözleşmesi yok, `students`
  koleksiyonu hiç yok. Kök kural `match /{document=**} { allow read: if false }`
  olduğu için **yeni koleksiyon kural yazılmadan hem okunamaz hem yazılamaz.**
  İlk iş: `firestore.rules` içine `students` bloğu + `@firebase/rules-unit-testing`
  ile kural contract testi (`clubcrm/src/adapters/firestore/firestoreRules.contract.test.ts`
  bunun için hazır bir örnek).
- **Göç tek yönlü ve geri alınamaz** → Dean onayı şart, yedek şart.
  `athletes` → `students`: `fullName` ayrıştırma ve `"Grup - "` öneki temizliği
  `mapping.ts:43-60`'ta zaten çözülmüş, göç betiği onu yeniden kullanır.
  Eski uygulama `athletes`'i okumaya devam eder → bir süre **iki koleksiyon
  birlikte yaşar**; hangisinin yazma sahibi olduğu tek cümleyle yazılmalı.
- `VITE_FIRESTORE_WRITES=on` açılmadan önce yoklama yazma yolu da canlıda hiç
  denenmedi (handoff, 2026-09-21) — ikisi aynı anda açılmaz.

## Faz C — CRM (ayrı spec)

Faz A/B'den bağımsız olarak, sırasıyla karara bağlanacak:

1. Hangi repo taşıyıcı olacak — dört adaydan biri seçilir, kalanlar arşivlenir. Beşinci iskelet açılmaz.
2. Alan-tanımlı şema (kullanıcı alan ekler, ekran kendini çizer) — sıfırdan iş,
   ports/adapters disiplinine oturtulacak. Tek başına bir spec.
3. Veli bilgilendirme kanalı: **WhatsApp/SMS taslağı, tıkla-aç** [Dean, 2026-09-23]
   — `wa.me/<telefon>?text=<mesaj>` ve `sms:` linkleri; API, ücret, sunucu yok.
   SportFlow tarafında karşılığı sadece `guardianPhone` alanının dolu tutulması.
4. Ödeme/aidat `clubcrm`'de kalır; `playerId` bağı Faz B sonrası `students`
   belgelerine işaret eder.

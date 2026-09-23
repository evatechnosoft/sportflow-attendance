import { beforeEach, describe, expect, it } from 'vitest'
import type { DataSource } from '../ports/repositories'
import type { Group, Id } from '../domain/types'

/**
 * Her DataSource adapter'ı (mock, api, ...) bu sözleşmeyi geçmek zorundadır.
 * Spec: docs/spec.md § Kullanıcı hikâyeleri
 */
export function runDataSourceContract(name: string, makeDataSource: () => DataSource) {
  describe(`${name} — DataSource contract`, () => {
    let db: DataSource

    beforeEach(() => {
      db = makeDataSource()
    })

    let seedCount = 0
    const seedGroup = async (overrides: Partial<Omit<Group, 'id'>> = {}) => {
      const suffix = ++seedCount
      const school = await db.schools.create({ name: `Atatürk Ortaokulu ${suffix}` })
      const branch = await db.branches.create({ name: `Voleybol ${suffix}`, slug: `voleybol-${suffix}` })
      return db.groups.create({
        name: 'U14 Kız',
        schoolId: school.id,
        branchId: branch.id,
        schedule: [{ weekday: 2, startTime: '17:00', durationMinutes: 90 }],
        ...overrides,
      })
    }

    const seedPlayer = async (groupId: Id, firstName = 'Can') =>
      db.players.create({
        firstName,
        lastName: 'Erdoğan',
        status: 'active',
        groupHistory: [{ groupId, joinedOn: '2026-09-01' }],
      })

    describe('US-2 okul / branş / grup', () => {
      it('okul adı tekildir', async () => {
        await db.schools.create({ name: 'Atatürk Ortaokulu' })
        await expect(db.schools.create({ name: 'Atatürk Ortaokulu' })).rejects.toMatchObject({
          code: 'duplicate',
        })
      })

      it('branş slug tekildir', async () => {
        await db.branches.create({ name: 'Voleybol', slug: 'voleybol' })
        await expect(db.branches.create({ name: 'Voleybol B', slug: 'voleybol' })).rejects.toMatchObject({
          code: 'duplicate',
        })
      })

      it('olmayan okula grup açılamaz', async () => {
        const branch = await db.branches.create({ name: 'Basketbol', slug: 'basketbol' })
        await expect(
          db.groups.create({ name: 'U12', schoolId: 'yok', branchId: branch.id, schedule: [] }),
        ).rejects.toMatchObject({ code: 'not_found' })
      })

      it('olmayan branşa grup açılamaz', async () => {
        const school = await db.schools.create({ name: 'Cumhuriyet İÖO' })
        await expect(
          db.groups.create({ name: 'U12', schoolId: school.id, branchId: 'yok', schedule: [] }),
        ).rejects.toMatchObject({ code: 'not_found' })
      })

      it('grup okula ve branşa göre filtrelenir', async () => {
        const group = await seedGroup()
        expect(await db.groups.list({ schoolId: group.schoolId })).toHaveLength(1)
        expect(await db.groups.list({ schoolId: 'baska-okul' })).toHaveLength(0)
        expect(await db.groups.list({ branchId: group.branchId })).toHaveLength(1)
      })

      it('oyuncusu olan grup silinemez', async () => {
        const group = await seedGroup()
        await seedPlayer(group.id)
        await expect(db.groups.remove(group.id)).rejects.toMatchObject({ code: 'in_use' })
      })

      it('grubun antrenman günleri güncellenir', async () => {
        const group = await seedGroup()
        const updated = await db.groups.update(group.id, {
          schedule: [
            { weekday: 2, startTime: '17:00', durationMinutes: 90 },
            { weekday: 6, startTime: '10:00', durationMinutes: 60 },
          ],
        })
        expect(updated.schedule).toHaveLength(2)
        expect((await db.groups.list())[0].schedule).toHaveLength(2)
      })

      it('1-7 dışındaki gün kabul edilmez', async () => {
        const group = await seedGroup()
        await expect(
          db.groups.update(group.id, {
            schedule: [{ weekday: 0, startTime: '17:00', durationMinutes: 90 }],
          }),
        ).rejects.toMatchObject({ code: 'invalid' })
        await expect(
          db.groups.update(group.id, {
            schedule: [{ weekday: 8, startTime: '17:00', durationMinutes: 90 }],
          }),
        ).rejects.toMatchObject({ code: 'invalid' })
      })

      it('aynı gün ve saat için iki slot açılamaz', async () => {
        const group = await seedGroup()
        await expect(
          db.groups.update(group.id, {
            schedule: [
              { weekday: 2, startTime: '17:00', durationMinutes: 90 },
              { weekday: 2, startTime: '17:00', durationMinutes: 60 },
            ],
          }),
        ).rejects.toMatchObject({ code: 'duplicate' })
      })

      it('boş takvim geçerlidir', async () => {
        const group = await seedGroup()
        expect((await db.groups.update(group.id, { schedule: [] })).schedule).toEqual([])
      })

      it('olmayan grup güncellenemez', async () => {
        await expect(db.groups.update('yok', { schedule: [] })).rejects.toMatchObject({
          code: 'not_found',
        })
      })

      it('boş grup silinir', async () => {
        const group = await seedGroup()
        await db.groups.remove(group.id)
        expect(await db.groups.list()).toHaveLength(0)
      })
    })

    describe('A5 isteğe bağlı okul ve silme', () => {
      it('okulsuz grup açılır', async () => {
        const branch = await db.branches.create({ name: 'Hentbol', slug: 'hentbol' })
        const group = await db.groups.create({ name: 'U10', branchId: branch.id, schedule: [] })
        expect(group.schoolId).toBeUndefined()
        expect((await db.groups.list())[0].schoolId).toBeUndefined()
      })

      it('okul silinince onu kullanan grupların okulu temizlenir', async () => {
        const group = await seedGroup()
        await db.schools.remove(group.schoolId!)
        expect(await db.schools.list()).toHaveLength(0)
        const [after] = await db.groups.list()
        expect(after.id).toBe(group.id)
        expect(after.schoolId).toBeUndefined()
      })

      it('grup kullanan branş silinmez, kaç grubun kullandığı söylenir', async () => {
        const group = await seedGroup()
        await db.groups.create({ name: 'U16', branchId: group.branchId, schedule: [] })
        await expect(db.branches.remove(group.branchId)).rejects.toMatchObject({
          code: 'in_use',
          message: '2 grup bu branşı kullanıyor',
        })
        expect(await db.branches.list()).toHaveLength(1)
      })

      it('kullanılmayan branş silinir', async () => {
        const branch = await db.branches.create({ name: 'Tenis', slug: 'tenis' })
        await db.branches.remove(branch.id)
        expect(await db.branches.list()).toHaveLength(0)
      })
    })

    describe('US-3 oyuncu', () => {
      it('olmayan gruba oyuncu eklenemez', async () => {
        await expect(
          db.players.create({
            firstName: 'Ada',
            lastName: 'Yıldız',
            status: 'active',
            groupHistory: [{ groupId: 'yok', joinedOn: '2026-09-01' }],
          }),
        ).rejects.toMatchObject({ code: 'not_found' })
      })

      it('pasif oyuncu varsayılan listede çıkmaz, includeInactive ile çıkar', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        await db.players.update(player.id, {
          status: 'inactive',
          groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' }],
        })
        expect(await db.players.listByGroup(group.id)).toHaveLength(0)
        expect(await db.players.listByGroup(group.id, { includeInactive: true })).toHaveLength(1)
      })

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
          groupHistory: [
            { groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' },
            { groupId: other.id, joinedOn: '2026-09-23' },
          ],
        })
        expect(await db.players.listByGroup(group.id)).toHaveLength(0)
        expect(await db.players.listByGroup(other.id)).toHaveLength(1)
      })

      it('aynı sporcu iki grupta birden listelenir', async () => {
        const group = await seedGroup()
        const squad = await db.groups.create({
          name: 'U12 Maç Kadrosu',
          schoolId: group.schoolId,
          branchId: group.branchId,
          schedule: [],
        })
        const player = await seedPlayer(group.id)
        await db.players.update(player.id, {
          groupHistory: [
            { groupId: group.id, joinedOn: '2026-09-01' },
            { groupId: squad.id, joinedOn: '2026-09-23' },
          ],
        })
        expect(await db.players.listByGroup(group.id)).toHaveLength(1)
        expect(await db.players.listByGroup(squad.id)).toHaveLength(1)
      })

      it('kapanmış dönem yalnız includeInactive ile görünür', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        await db.players.update(player.id, {
          status: 'inactive',
          groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' }],
        })
        expect(await db.players.listByGroup(group.id)).toHaveLength(0)
        expect(await db.players.listByGroup(group.id, { includeInactive: true })).toHaveLength(1)
      })

      it('son açık dönem kapanınca status türetilir — patch active dese bile', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        const updated = await db.players.update(player.id, {
          status: 'active',
          groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' }],
        })
        expect(updated.status).toBe('inactive')
      })

      it('yeni açık dönem açılınca status yeniden active olur', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        await db.players.update(player.id, {
          status: 'inactive',
          groupHistory: [{ groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' }],
        })
        const back = await db.players.update(player.id, {
          status: 'inactive',
          groupHistory: [
            { groupId: group.id, joinedOn: '2026-09-01', leftOn: '2026-09-23' },
            { groupId: group.id, joinedOn: '2026-10-01' },
          ],
        })
        expect(back.status).toBe('active')
      })

      it('olmayan sporcu güncellenemez', async () => {
        await expect(db.players.update('yok', { status: 'inactive' })).rejects.toMatchObject({
          code: 'not_found',
        })
      })
    })

    describe('kulüp kimliği', () => {
      it('boş olmayan bir kulüp adı döner', async () => {
        const identity = await db.settings.clubIdentity()
        expect(identity.primaryName.trim().length).toBeGreaterThan(0)
      })
    })

    describe('A5 alan anahtarı', () => {
      it('okul alanı varsayılan açıktır', async () => {
        expect((await db.settings.get()).fields.school).toBe(true)
      })

      it('okul alanı kapatılır ve kalıcıdır', async () => {
        const updated = await db.settings.update({ fields: { school: false } })
        expect(updated.fields.school).toBe(false)
        expect((await db.settings.get()).fields.school).toBe(false)
      })
    })

    describe('US-1 yoklama', () => {
      it('aynı grup + tarih için ikinci oturum açılmaz', async () => {
        const group = await seedGroup()
        const first = await db.sessions.ensure(group.id, '2026-09-21', '17:00')
        const second = await db.sessions.ensure(group.id, '2026-09-21')
        expect(second.id).toBe(first.id)
        expect(await db.sessions.listByGroup(group.id)).toHaveLength(1)
      })

      it('oturumun saati güncellenir', async () => {
        const group = await seedGroup()
        const session = await db.sessions.ensure(group.id, '2026-09-21', '17:00')
        const updated = await db.sessions.update(session.id, { startTime: '18:30' })
        expect(updated.startTime).toBe('18:30')
        expect((await db.sessions.listByGroup(group.id))[0].startTime).toBe('18:30')
      })

      it('olmayan oturumun saati güncellenemez', async () => {
        await expect(db.sessions.update('yok', { startTime: '18:30' })).rejects.toMatchObject({
          code: 'not_found',
        })
      })

      it('olmayan gruba oturum açılamaz', async () => {
        await expect(db.sessions.ensure('yok', '2026-09-21')).rejects.toMatchObject({
          code: 'not_found',
        })
      })

      it('işaretlenen durumlar oturum tekrar açılınca geri gelir', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        const session = await db.sessions.ensure(group.id, '2026-09-21')
        await db.attendance.mark(session.id, [{ playerId: player.id, status: 'late', note: 'servis' }])

        const saved = await db.attendance.listBySession(session.id)
        expect(saved).toHaveLength(1)
        expect(saved[0]).toMatchObject({ playerId: player.id, status: 'late', note: 'servis' })
      })

      it('aynı oyuncu ikinci kez işaretlenince üzerine yazar', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        const session = await db.sessions.ensure(group.id, '2026-09-21')
        await db.attendance.mark(session.id, [{ playerId: player.id, status: 'absent' }])
        await db.attendance.mark(session.id, [{ playerId: player.id, status: 'present' }])

        const saved = await db.attendance.listBySession(session.id)
        expect(saved).toHaveLength(1)
        expect(saved[0].status).toBe('present')
      })

      it('gruba ait olmayan oyuncu o oturumda işaretlenemez', async () => {
        const group = await seedGroup()
        const other = await seedGroup({ name: 'U16 Erkek' })
        const stranger = await seedPlayer(other.id, 'Deniz')
        const session = await db.sessions.ensure(group.id, '2026-09-21')
        await expect(
          db.attendance.mark(session.id, [{ playerId: stranger.id, status: 'present' }]),
        ).rejects.toMatchObject({ code: 'not_found' })
      })

      it('kaydedilen oturum grubun geçmişinde özetiyle görünür', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        const other = await seedPlayer(group.id, 'Ada')
        const session = await db.sessions.ensure(group.id, '2026-09-21')
        await db.attendance.mark(session.id, [
          { playerId: player.id, status: 'present' },
          { playerId: other.id, status: 'absent' },
        ])

        const history = await db.attendance.historyByGroup(group.id)
        expect(history).toHaveLength(1)
        expect(history[0]).toMatchObject({ date: '2026-09-21', total: 2 })
        expect(history[0].counts.present).toBe(1)
        expect(history[0].counts.absent).toBe(1)
      })

      it('geçmiş oturum yeniden işaretlenince özet güncellenir', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        const session = await db.sessions.ensure(group.id, '2026-09-14')
        await db.attendance.mark(session.id, [{ playerId: player.id, status: 'absent' }])
        await db.attendance.mark(session.id, [{ playerId: player.id, status: 'late' }])

        const [summary] = await db.attendance.historyByGroup(group.id)
        expect(summary.counts.absent).toBe(0)
        expect(summary.counts.late).toBe(1)
      })

      it('geçmiş yeniden eskiye sıralanır', async () => {
        const group = await seedGroup()
        const player = await seedPlayer(group.id)
        for (const date of ['2026-09-07', '2026-09-21', '2026-09-14']) {
          const session = await db.sessions.ensure(group.id, date)
          await db.attendance.mark(session.id, [{ playerId: player.id, status: 'present' }])
        }
        const history = await db.attendance.historyByGroup(group.id)
        expect(history.map((row) => row.date)).toEqual(['2026-09-21', '2026-09-14', '2026-09-07'])
      })

      it('olmayan oturuma yoklama yazılamaz', async () => {
        await expect(db.attendance.mark('yok', [])).rejects.toMatchObject({ code: 'not_found' })
      })
    })
  })
}

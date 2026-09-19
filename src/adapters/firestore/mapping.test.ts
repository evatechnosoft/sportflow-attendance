import { describe, expect, it } from 'vitest'
import {
  UNASSIGNED_SCHOOL,
  fromAttendanceStatus,
  sessionDocId,
  toAttendanceStatus,
  dedupeGroups,
  groupDisplayName,
  toBranches,
  toGroup,
  toPlayer,
  buildAttendanceDoc,
} from './mapping'

describe('durum çevirisi', () => {
  it('Türkçe durumları domain durumuna çevirir', () => {
    expect(toAttendanceStatus('Geldi')).toBe('present')
    expect(toAttendanceStatus('Gelmedi')).toBe('absent')
    expect(toAttendanceStatus('Geç')).toBe('late')
    expect(toAttendanceStatus('İzinli')).toBe('excused')
  })

  it('Belirsiz ve tanınmayan değer kayıt sayılmaz', () => {
    expect(toAttendanceStatus('Belirsiz')).toBeNull()
    expect(toAttendanceStatus(undefined)).toBeNull()
    expect(toAttendanceStatus(42)).toBeNull()
  })

  it('çeviri çift yönlü tutarlıdır', () => {
    for (const status of ['present', 'absent', 'late', 'excused'] as const) {
      expect(toAttendanceStatus(fromAttendanceStatus(status))).toBe(status)
    }
  })
})

describe('toPlayer', () => {
  it('fullName ad ve soyada bölünür', () => {
    const player = toPlayer('a1', { fullName: 'Can Erdoğan', groupId: 'g1', status: 'approved' })
    expect(player).toMatchObject({ firstName: 'Can', lastName: 'Erdoğan', status: 'active' })
  })

  it('çok parçalı isimde son parça soyadıdır', () => {
    const player = toPlayer('a2', { fullName: 'Ayşe Nur Yıldız', groupId: 'g1' })
    expect(player.firstName).toBe('Ayşe Nur')
    expect(player.lastName).toBe('Yıldız')
  })

  it('"Grup - Ad Soyad" önekini atar', () => {
    const player = toPlayer('a3', { fullName: 'U14 Kız - Deniz Kaya', groupId: 'g1' })
    expect(player.firstName).toBe('Deniz')
    expect(player.lastName).toBe('Kaya')
  })

  it('approved dışındaki sporcu pasiftir', () => {
    expect(toPlayer('a4', { fullName: 'X Y', status: 'archived' }).status).toBe('inactive')
    expect(toPlayer('a5', { fullName: 'X Y', status: 'pending' }).status).toBe('inactive')
  })

  it('birthYear tarihe çevrilir, yoksa boş kalır', () => {
    expect(toPlayer('a6', { fullName: 'X Y', birthYear: 2012 }).birthDate).toBe('2012-01-01')
    expect(toPlayer('a7', { fullName: 'X Y' }).birthDate).toBeUndefined()
  })
})

describe('toGroup', () => {
  it('okulu olmayan eski grup "atanmamış okul"a düşer', () => {
    expect(toGroup('g1', { name: 'U14' }).schoolId).toBe(UNASSIGNED_SCHOOL)
  })

  it('okul alanı varsa korunur', () => {
    expect(toGroup('g1', { name: 'U14', schoolId: 's1' }).schoolId).toBe('s1')
  })
})

describe('sessionDocId', () => {
  it('eski uygulamanın belge kimliği biçimini üretir', () => {
    expect(sessionDocId('g1', '2026-09-21')).toBe('g1_2026-09-21')
  })
})

describe('toBranches', () => {
  it('branşları settings belgesinden okur', () => {
    const branches = toBranches({ branches: [{ id: 'volleyball', name: 'Voleybol' }] })
    expect(branches).toEqual([{ id: 'volleyball', name: 'Voleybol', slug: 'volleyball' }])
  })

  it('settings yoksa boş liste döner', () => {
    expect(toBranches(undefined)).toEqual([])
  })
})

describe('buildAttendanceDoc', () => {
  const doc = buildAttendanceDoc({
    groupId: 'g1',
    date: '2026-09-21',
    coachId: 'uid-1',
    records: { a1: { status: 'Geldi', notes: '' } },
  })

  it('kuralların zorunlu tuttuğu beş alanı taşır', () => {
    for (const key of ['groupId', 'coachId', 'date', 'createdAt', 'records']) {
      expect(doc).toHaveProperty(key)
    }
  })

  it('createdAt sayıdır ve type izinli değerdir', () => {
    expect(typeof doc.createdAt).toBe('number')
    expect(['practice', 'match']).toContain(doc.type)
  })
})

describe('dedupeGroups', () => {
  const make = (id: string, name: string, startTime?: string) =>
    toGroup(id, { name, branchId: 'volleyball', startTime })

  it('aynı ad/branş/saat üçlüsü bir kez görünür', () => {
    const groups = dedupeGroups([
      make('g1', 'Mini Kız A', '09:00'),
      make('g2', 'Mini Kız A', '09:00'),
      make('g3', 'Mini Kız B', '10:00'),
    ])
    expect(groups.map((group) => group.id)).toEqual(['g1', 'g3'])
  })

  it('saati farklı olan aynı ad ayrı gruptur', () => {
    const groups = dedupeGroups([make('g1', 'Midi Kız A', '11:00'), make('g2', 'Midi Kız A', '16:00')])
    expect(groups).toHaveLength(2)
  })
})

describe('groupDisplayName', () => {
  it('adı boş grup saatiyle anılır', () => {
    expect(groupDisplayName('', '09:00')).toBe('09:00 grubu')
    expect(groupDisplayName(undefined, undefined)).toBe('(isimsiz grup)')
  })

  it('adı olan grubun adı korunur', () => {
    expect(groupDisplayName('Yıldız Kız A', '17:00')).toBe('Yıldız Kız A')
  })
})

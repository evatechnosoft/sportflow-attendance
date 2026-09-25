import { describe, expect, it } from 'vitest'
import {
  buildAttendanceDoc,
  chunks,
  diffMemberships,
  isOverdue,
  parseSessionId,
  primaryGuardianId,
  recordsOf,
  sessionDocId,
  toAttendanceStatus,
  toGroup,
  toPlayer,
  toStudentGender,
  type MembershipDoc,
} from './mapping'

describe('toAttendanceStatus', () => {
  it('İngilizce durumlar aynen geçer', () => {
    for (const status of ['present', 'absent', 'late', 'excused'] as const) {
      expect(toAttendanceStatus(status)).toBe(status)
    }
  })

  it('tanınmayan değer kayıt sayılmaz', () => {
    expect(toAttendanceStatus('Geldi')).toBeNull()
    expect(toAttendanceStatus(undefined)).toBeNull()
    expect(toAttendanceStatus(42)).toBeNull()
  })
})

describe('toGroup', () => {
  it('CRM grubunda ek alanlar yoksa branş boş, takvim boş gelir', () => {
    expect(toGroup('g1', { name: 'U14', kind: 'training' })).toEqual({
      id: 'g1',
      name: 'U14',
      branchId: '',
      schoolId: undefined,
      coachName: undefined,
      schedule: [],
    })
  })

  it('yoklamanın ek alanları korunur', () => {
    const schedule = [{ weekday: 2, startTime: '17:00', durationMinutes: 90 }]
    const group = toGroup('g1', { name: 'U14', branchId: 'b1', schoolId: 's1', coachName: 'Ali', schedule })
    expect(group).toMatchObject({ branchId: 'b1', schoolId: 's1', coachName: 'Ali', schedule })
  })
})

const membership = (overrides: Partial<MembershipDoc>): MembershipDoc => ({
  id: 'm1',
  studentId: 's1',
  groupId: 'g1',
  joinedOn: '2026-09-01',
  ...overrides,
})

describe('toPlayer', () => {
  it('öğrenci + üyelikler + veli sporcuya çevrilir', () => {
    const player = toPlayer(
      's1',
      { firstName: 'Can', lastName: 'Erdoğan', status: 'active', gender: 'male', birthDate: '2012-05-01' },
      [membership({})],
      { fullName: 'Ayşe Erdoğan', phone: '0555' },
    )
    expect(player).toEqual({
      id: 's1',
      firstName: 'Can',
      lastName: 'Erdoğan',
      birthDate: '2012-05-01',
      gender: 'male',
      status: 'active',
      guardianName: 'Ayşe Erdoğan',
      guardianPhone: '0555',
      groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }],
    })
  })

  it('active dışındaki durum pasiftir', () => {
    expect(toPlayer('s1', { status: 'inactive' }, []).status).toBe('inactive')
    expect(toPlayer('s1', {}, []).status).toBe('inactive')
  })

  it('dönem geçmişi yalnız o öğrencinin üyelikleri, joinedOn artan', () => {
    const player = toPlayer('s1', { status: 'active' }, [
      membership({ id: 'm2', groupId: 'g2', joinedOn: '2026-09-20' }),
      membership({ id: 'm1', groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-20' }),
      membership({ id: 'm3', studentId: 's2', groupId: 'g3' }),
    ])
    expect(player.groupHistory).toEqual([
      { groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-20' },
      { groupId: 'g2', joinedOn: '2026-09-20' },
    ])
  })
})

describe('toStudentGender', () => {
  it("CRM'de olmayan 'other' yazılmaz", () => {
    expect(toStudentGender('female')).toBe('female')
    expect(toStudentGender('other')).toBeUndefined()
  })
})

describe('primaryGuardianId', () => {
  it('rank 1 veli önce gelir', () => {
    const rows = [
      { studentId: 's1', customerId: 'c2', rank: 2 },
      { studentId: 's1', customerId: 'c1', rank: 1 },
      { studentId: 's2', customerId: 'c3', rank: 1 },
    ]
    expect(primaryGuardianId(rows, 's1')).toBe('c1')
    expect(primaryGuardianId(rows, 's9')).toBeUndefined()
  })
})

describe('diffMemberships', () => {
  it('grup değişimi: eski açık üyelik kapanır, yeni gruba üyelik açılır', () => {
    const diff = diffMemberships(
      [membership({ id: 'm1', groupId: 'g1' })],
      [
        { groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-23' },
        { groupId: 'g2', joinedOn: '2026-09-23' },
      ],
      '2026-09-25',
    )
    expect(diff).toEqual({
      close: [{ id: 'm1', leftOn: '2026-09-23' }],
      open: [{ groupId: 'g2', joinedOn: '2026-09-23' }],
    })
  })

  it('değişmeyen geçmiş yazma üretmez', () => {
    const diff = diffMemberships(
      [membership({ id: 'm1', groupId: 'g1' })],
      [{ groupId: 'g1', joinedOn: '2026-09-01' }],
      '2026-09-25',
    )
    expect(diff).toEqual({ close: [], open: [] })
  })

  it('kapanış tarihi yoksa bugün yazılır, kapalı üyelik yeniden açılır', () => {
    expect(diffMemberships([membership({ id: 'm1' })], [], '2026-09-25').close).toEqual([
      { id: 'm1', leftOn: '2026-09-25' },
    ])
    const reopened = diffMemberships(
      [membership({ id: 'm1', leftOn: '2026-09-10' })],
      [
        { groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-10' },
        { groupId: 'g1', joinedOn: '' },
      ],
      '2026-09-25',
    )
    expect(reopened).toEqual({ close: [], open: [{ groupId: 'g1', joinedOn: '2026-09-25' }] })
  })
})

describe('oturum kimliği', () => {
  it('attendance/{groupId}_{date} biçimi gidip gelir', () => {
    expect(sessionDocId('g1', '2026-09-21')).toBe('g1_2026-09-21')
    expect(parseSessionId('grp_a_2026-09-21')).toEqual({ groupId: 'grp_a', date: '2026-09-21' })
  })

  it('biçimsiz kimlik reddedilir', () => {
    expect(parseSessionId('yok')).toBeNull()
    expect(parseSessionId('_2026-09-21')).toBeNull()
    expect(parseSessionId('g1_bugun')).toBeNull()
  })
})

describe('buildAttendanceDoc', () => {
  const doc = buildAttendanceDoc({
    groupId: 'g1',
    date: '2026-09-21',
    takenBy: 'koc@example.com',
    marks: [
      { playerId: 'a1', status: 'present' },
      { playerId: 'a2', status: 'late', note: 'servis' },
    ],
    now: '2026-09-21T17:05:00.000Z',
  })

  it('kuralların istediği alanları taşır', () => {
    expect(doc).toMatchObject({
      groupId: 'g1',
      date: '2026-09-21',
      takenBy: 'koc@example.com',
      updatedAt: '2026-09-21T17:05:00.000Z',
    })
  })

  it('records öğrenci kimliğiyle anahtarlı; not yalnız varsa yazılır', () => {
    expect(doc.records).toEqual({
      a1: { status: 'present', markedAt: '2026-09-21T17:05:00.000Z' },
      a2: { status: 'late', note: 'servis', markedAt: '2026-09-21T17:05:00.000Z' },
    })
  })

  it('yazılan records geri okunur', () => {
    expect(recordsOf(doc.records).map((row) => row.record.status)).toEqual(['present', 'late'])
  })
})

describe('recordsOf', () => {
  it('tanınmayan durum ve bozuk kayıt atlanır', () => {
    const rows = recordsOf({ a1: { status: 'Geldi' }, a2: null, a3: { status: 'absent' } })
    expect(rows).toEqual([{ playerId: 'a3', record: { status: 'absent', markedAt: '' } }])
  })

  it('records yoksa boş', () => {
    expect(recordsOf(undefined)).toEqual([])
  })
})

describe('isOverdue', () => {
  const row = { planId: 'p1', dueDate: '2026-09-01', amount: 100_00, paidAmount: 0 }

  it('vadesi geçmiş ve eksik ödenmiş taksit gecikmiştir', () => {
    expect(isOverdue(row, '2026-09-25')).toBe(true)
    expect(isOverdue({ ...row, paidAmount: 50_00 }, '2026-09-25')).toBe(true)
  })

  it('bugün vadeli ya da tam ödenmiş taksit gecikmiş değildir', () => {
    expect(isOverdue(row, '2026-09-01')).toBe(false)
    expect(isOverdue({ ...row, paidAmount: 100_00 }, '2026-09-25')).toBe(false)
  })
})

describe('chunks', () => {
  it("Firestore 'in' sınırı için 30'luk parçalar", () => {
    const parts = chunks(Array.from({ length: 61 }, (_, index) => index))
    expect(parts.map((part) => part.length)).toEqual([30, 30, 1])
    expect(chunks([])).toEqual([])
  })
})

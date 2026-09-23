import { describe, expect, it } from 'vitest'
import { runDataSourceContract } from '../../testing/dataSourceContract'
import { createMockDataSource } from './mockDataSource'

runDataSourceContract('MockDataSource', () => createMockDataSource())

describe('MockDataSource — aidat', () => {
  it('seed içindeki gecikmiş sporcuyu yalnız aktif olduğu grupta döndürür', async () => {
    const db = createMockDataSource({
      branches: [{ id: 'b1', name: 'Voleybol', slug: 'voleybol' }],
      groups: [
        { id: 'g1', name: 'U12', branchId: 'b1', schedule: [] },
        { id: 'g2', name: 'U14', branchId: 'b1', schedule: [] },
      ],
      players: [
        { id: 'p1', firstName: 'Ada', lastName: 'Y', status: 'active', groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }] },
        { id: 'p2', firstName: 'Can', lastName: 'E', status: 'active', groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }] },
        {
          id: 'p3',
          firstName: 'Deniz',
          lastName: 'A',
          status: 'inactive',
          groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01', leftOn: '2026-09-15' }],
        },
      ],
      overdue: ['p1', 'p3'],
    })
    expect(await db.dues.overdueByGroup('g1')).toEqual(['p1'])
    expect(await db.dues.overdueByGroup('g2')).toEqual([])
  })
})

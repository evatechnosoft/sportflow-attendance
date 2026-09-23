import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttendanceRow } from './AttendanceRow'
import type { Player } from '../../domain/types'

const player: Player = {
  id: 'p1',
  firstName: 'Ada',
  lastName: 'Yıldız',
  status: 'active',
  groupHistory: [{ groupId: 'g1', joinedOn: '2026-09-01' }],
}

describe('AttendanceRow', () => {
  // vitest globals kapalı → RTL otomatik temizlik kaydolmuyor.
  afterEach(cleanup)

  it('durum butonları yalnız karta dokununca açılır', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <ul>
        <AttendanceRow player={player} onChange={vi.fn()} />
      </ul>,
    )

    expect(screen.queryByRole('button', { name: 'Geç' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Ada Yıldız' }))
    for (const label of ['Var', 'Geç', 'İzinli', 'Yok']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
  })

  it('segment butonu onChange çağırır', async () => {
    const user = userEvent.setup({ delay: null })
    const onChange = vi.fn()
    render(
      <ul>
        <AttendanceRow player={player} onChange={onChange} />
      </ul>,
    )

    await user.click(screen.getByRole('button', { name: 'Ada Yıldız' }))
    await user.click(screen.getByRole('button', { name: 'Geç' }))
    expect(onChange).toHaveBeenCalledWith('late')
  })

  it('işaretli durum aria-pressed ile bildirilir', async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <ul>
        <AttendanceRow player={player} status="present" onChange={vi.fn()} />
      </ul>,
    )

    await user.click(screen.getByRole('button', { name: 'Ada Yıldız' }))
    expect(screen.getByRole('button', { name: 'Var' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Yok' }).getAttribute('aria-pressed')).toBe('false')
  })
})

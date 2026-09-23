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

import type { GroupSpell, Id, Player } from '../../domain/types'

/** Yeni sporcunun ilk dönemi. */
export function startSpell(groupId: Id, on: string): GroupSpell[] {
  return [{ groupId, joinedOn: on }]
}

/** Sporcunun o anda açık olan tüm dönemleri. */
export function openSpells(player: Player): GroupSpell[] {
  return player.groupHistory.filter((spell) => !spell.leftOn)
}

/** Sporcu bu grupta şu an var mı. */
export function isInGroup(player: Player, groupId: Id): boolean {
  return openSpells(player).some((spell) => spell.groupId === groupId)
}

/** Açık dönemi olan sporcu aktif, kalmayan pasiftir. */
const withStatus = (player: Player, groupHistory: GroupSpell[]): Player => ({
  ...player,
  status: groupHistory.some((spell) => !spell.leftOn) ? 'active' : 'inactive',
  groupHistory,
})

/** Gruba ekler. Zaten açık dönemi varsa hiçbir şey değişmez. */
export function joinGroup(player: Player, groupId: Id, on: string): Player {
  if (isInGroup(player, groupId)) return player
  return withStatus(player, [...player.groupHistory, { groupId, joinedOn: on }])
}

/** Yalnız o grubun dönemini kapatır. Başka açık dönem kalmazsa status inactive olur. */
export function leaveGroup(player: Player, groupId: Id, on: string): Player {
  if (!isInGroup(player, groupId)) return player
  return withStatus(
    player,
    player.groupHistory.map((spell) =>
      spell.groupId === groupId && !spell.leftOn ? { ...spell, leftOn: on } : spell,
    ),
  )
}

/** Bir gruptan diğerine taşır: kaynağı kapatır, hedefi açar. Diğer üyelikler durur. */
export function changeGroup(player: Player, fromGroupId: Id, toGroupId: Id, on: string): Player {
  return joinGroup(leaveGroup(player, fromGroupId, on), toGroupId, on)
}

/** Doğum günü geçmediyse bir eksik. Ay/gün karşılaştırması string ile yeterli. */
export function ageOn(birthDate: string | undefined, on: string): number | null {
  if (!birthDate) return null
  const years = Number(on.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return on.slice(5) < birthDate.slice(5) ? years - 1 : years
}

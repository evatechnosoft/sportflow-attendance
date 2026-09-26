import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore'

// Kept identical in clubcrm and sportflow (src/announcements/announcements.ts).

/** Gruba kısa duyuru: "antrenman ertelendi", "cumartesi maçımız var". */
export interface Announcement {
  id: string
  groupIds: string[]
  text: string
  /** ISO datetime */
  createdAt: string
  /** Yazanın e-postası (küçük harf); düzenleme/silme yetkisi. */
  createdBy: string
  createdByName: string
}

export const ANNOUNCEMENT_MAX = 500

export interface AnnouncementSource {
  listByGroup(groupId: string): Promise<Announcement[]>
  create(input: { groupIds: string[]; text: string }): Promise<Announcement>
  update(id: string, text: string): Promise<void>
  remove(id: string): Promise<void>
}

export function validateAnnouncement(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return 'Duyuru boş olamaz.'
  if (trimmed.length > ANNOUNCEMENT_MAX) return `Duyuru en fazla ${ANNOUNCEMENT_MAX} karakter.`
  return null
}

/** Yeni önce. */
export const byNewest = (a: Announcement, b: Announcement) => b.createdAt.localeCompare(a.createdAt)

/** WhatsApp paylaşımı: numarasız bağlantı sohbet/grup seçtirir (kulübün veli grubu). */
export const whatsappShare = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

/** Tek SMS, birden çok alıcı (Android/iOS mesaj uygulaması virgülle ayrılmış listeyi açar). */
export function smsToMany(phones: string[], text: string): string | null {
  const numbers = [...new Set(phones.map((phone) => phone.replace(/[^\d+]/g, '')).filter((phone) => phone.length >= 10))]
  if (numbers.length === 0) return null
  return `sms:${numbers.join(',')}?body=${encodeURIComponent(text)}`
}

/** Çevrimdışıyken yazma kuyruğa düşer; beklemek bağlantıya kadar asılı kalır. */
async function commit(write: Promise<unknown>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    write.catch((error: unknown) => console.error('Duyuru yazılamadı', error))
    return
  }
  await write
}

/** Firestore: kural koça yalnız kendi gruplarına yazdırır; okuma grup eşitliğiyle. */
export function createFirestoreAnnouncements(db: Firestore, who: () => { email: string; name: string } | null): AnnouncementSource {
  const author = () => {
    const current = who()
    if (!current) throw new Error('Duyuru için giriş gerekiyor.')
    return current
  }
  return {
    async listByGroup(groupId) {
      const snapshot = await getDocs(query(collection(db, 'announcements'), where('groupIds', 'array-contains', groupId)))
      return snapshot.docs.map((row) => ({ ...(row.data() as Omit<Announcement, 'id'>), id: row.id })).sort(byNewest)
    },
    async create({ groupIds, text }) {
      const invalid = validateAnnouncement(text)
      if (invalid) throw new Error(invalid)
      const { email, name } = author()
      const data = {
        groupIds,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        createdBy: email.toLowerCase(),
        createdByName: name,
      }
      const ref = doc(collection(db, 'announcements'))
      await commit(setDoc(ref, data))
      return { ...data, id: ref.id }
    },
    async update(id, text) {
      const invalid = validateAnnouncement(text)
      if (invalid) throw new Error(invalid)
      await commit(updateDoc(doc(db, 'announcements', id), { text: text.trim() }))
    },
    async remove(id) {
      await commit(deleteDoc(doc(db, 'announcements', id)))
    },
  }
}

export class DomainError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

export const notFound = (entity: string, id: string) =>
  new DomainError('not_found', `${entity} bulunamadı: ${id}`)

export const duplicate = (entity: string, field: string, value: string) =>
  new DomainError('duplicate', `${entity} için ${field} zaten kullanılıyor: ${value}`)

export const inUse = (entity: string, id: string) =>
  new DomainError('in_use', `${entity} kullanımda olduğu için silinemez: ${id}`)

export const SERVICE_OPTIONS = [
  { key: 'refreshments', label: 'مرطبات',     price: 50  },
  { key: 'projector',    label: 'بروجيكتور',  price: 100 },
  { key: 'recording',    label: 'تسجيل',      price: 150 },
] as const

export type ServiceKey = (typeof SERVICE_OPTIONS)[number]['key']

export const SERVICE_PRICES: Record<string, number> = Object.fromEntries(
  SERVICE_OPTIONS.map((s) => [s.key, s.price])
)

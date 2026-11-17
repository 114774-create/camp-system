export const isValidPin = (s: string | undefined | null): s is string => /^\d{4}$/.test(s ?? '')
/** 產生 4 碼教師點名 PIN（使用 crypto 亂數） */
export function generatePin(): string {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return String(a[0] % 10000).padStart(4, '0')
}

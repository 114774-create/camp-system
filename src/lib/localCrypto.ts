/** 本機 fallback 用 SHA-256（非 bcrypt；正式環境走 DB pgcrypto） */

export async function sha256Hex(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 本機示範用後台密碼的 SHA-256 摘要。
 * 明文不出現在前端原始碼；摘要對應學年度西元四碼預設值。
 */
export const LOCAL_ADMIN_PASSWORD_SHA256 =
  '158a323a7ba44870f23d96f1516dd70aa48e9a72db4ebb026b0a89e212a208ab'

export async function matchesLocalHash(plain: string, hash: string): Promise<boolean> {
  return (await sha256Hex(plain)) === hash
}

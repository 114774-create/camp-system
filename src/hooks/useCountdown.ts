import { useEffect, useMemo, useState } from 'react'
import { computeCountdown, CountdownState, parseTaipeiMs } from '../lib/time'

/**
 * 每秒更新的「現在」（epoch 毫秒，絕對時間點，與時區無關）。
 * 分頁切回前景時立即校正（背景分頁的計時器會被瀏覽器降速）。
 */
export function useNow(enabled = true, intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, intervalMs)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [enabled, intervalMs])
  return now
}

/**
 * 倒數到 target（ISO 字串／Date／epoch；沒有時區的字串視為台北時間）。
 * 每次都用「目標 − Date.now()」重新計算，不累加，所以不會產生誤差。
 * 傳入 sharedNow 可與同頁其他元件共用同一個時鐘，避免邊界瞬間各算各的。
 */
export function useCountdown(target: string | Date | number | null | undefined, sharedNow?: number): CountdownState {
  const own = useNow(sharedNow === undefined)
  const now = sharedNow ?? own
  const targetMs = useMemo(() => {
    if (target === null || target === undefined) return null
    if (typeof target === 'number') return target
    if (target instanceof Date) return target.getTime()
    return parseTaipeiMs(target)
  }, [target])
  return computeCountdown(targetMs, now)
}

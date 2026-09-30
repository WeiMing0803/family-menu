const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 取服务端日期字符串的年月日部分，避免 new Date() 按时区偏移到前一天。 */
function parseDay(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '')
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

export function shortDate(value: string): string {
  return value ? value.slice(0, 10).replace(/-/g, '/') : ''
}

/** 2026-09-30 → 9月30日 周三 */
export function dayLabel(value: string): string {
  const date = parseDay(value)
  return date ? `${date.getMonth() + 1}月${date.getDate()}日 周${WEEKDAYS[date.getDay()]}` : ''
}

/** 相对手机当天：今天 / 昨天 / 空字符串 */
export function relativeDay(value: string): string {
  const date = parseDay(value)
  if (!date) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000)
  return diff === 0 ? '今天' : diff === 1 ? '昨天' : ''
}

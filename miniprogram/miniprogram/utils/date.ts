export function shortDate(value: string): string {
  return value ? value.slice(0, 10).replace(/-/g, '/') : ''
}

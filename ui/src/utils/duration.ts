// Parses Go duration strings (e.g. "1s", "500ms", "1m30s", "2h") to milliseconds.
export function parseGoDuration(s: string): number {
  if (!s || s === '0') return 0
  let total = 0
  const re = /(\d+(?:\.\d+)?)(h|m(?!s)|s|ms|us|ns)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(s)) !== null) {
    const n = parseFloat(match[1])
    switch (match[2]) {
      case 'h':  total += n * 3_600_000; break
      case 'm':  total += n * 60_000; break
      case 's':  total += n * 1_000; break
      case 'ms': total += n; break
      case 'us': total += n / 1_000; break
      case 'ns': total += n / 1_000_000; break
    }
  }
  return total
}

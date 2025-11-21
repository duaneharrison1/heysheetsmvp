export class RequestTimer {
  private marks: Map<string, number> = new Map()

  start(id: string, label: string): void {
    const key = `${id}-${label}`
    const timestamp = performance.now()
    this.marks.set(key, timestamp)

    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(`${key}-start`)
    }
  }

  end(id: string, label: string): number {
    const key = `${id}-${label}`
    const start = this.marks.get(key)

    if (!start) {
      console.warn(`Timer not started for ${key}`)
      return 0
    }

    if (typeof performance !== 'undefined' && performance.mark && performance.measure) {
      performance.mark(`${key}-end`)
      try {
        performance.measure(`🤖 ${label}`, `${key}-start`, `${key}-end`)
      } catch (e) {
        // Silently fail if marks don't exist
      }
    }

    const duration = performance.now() - start
    this.marks.delete(key)

    return duration
  }

  getElapsed(id: string, label: string): number {
    const key = `${id}-${label}`
    const start = this.marks.get(key)
    return start ? performance.now() - start : 0
  }
}

export const requestTimer = new RequestTimer()

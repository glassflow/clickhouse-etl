import classnames from 'classnames'

export function cn(...inputs: classnames.ArgumentArray) {
  return classnames(inputs)
}

export function parseStoredEvent(event: any) {
  try {
    return JSON.parse(event)
  } catch (error) {
    console.error('Error parsing stored event:', error)
    return null
  }
}

export function parseForCodeEditor(data: any): string {
  if (!data) return ''

  try {
    // If it's already a string, try to parse it as JSON to validate and then stringify it nicely
    if (typeof data === 'string') {
      // Try to parse it as JSON
      const parsed = JSON.parse(data)
      return JSON.stringify(parsed, null, 2)
    }

    // If it's an object, stringify it
    return JSON.stringify(data, null, 2)
  } catch (error) {
    console.error('Error parsing data for code editor:', error)
    // If parsing fails, return the original data as a string
    return typeof data === 'string' ? data : String(data)
  }
}

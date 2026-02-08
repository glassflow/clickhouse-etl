import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView; Radix Select (and others) use it
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {}
}

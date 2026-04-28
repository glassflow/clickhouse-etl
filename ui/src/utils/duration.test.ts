import { parseGoDuration } from './duration'

test.each([
  ['0',        0],
  ['1s',       1000],
  ['500ms',    500],
  ['1m30s',    90_000],
  ['2h',       7_200_000],
  ['1h30m10s', 5_410_000],
  ['100us',    0.1],
  ['',         0],
])('parseGoDuration(%s) === %d', (input, expected) => {
  expect(parseGoDuration(input)).toBeCloseTo(expected, 1)
})

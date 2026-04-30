import { render } from '@testing-library/react'
import { LineChart, Line, XAxis, YAxis } from 'recharts'
import { describe, expect, it } from 'vitest'

describe('recharts smoke', () => {
  it('renders a LineChart with synthetic data', () => {
    const data = Array.from({ length: 10 }, (_, i) => ({ t: i, v: i * 2 }))

    const { container } = render(
      <LineChart width={400} height={200} data={data}>
        <XAxis dataKey="t" />
        <YAxis />
        <Line type="monotone" dataKey="v" stroke="#e89159" />
      </LineChart>,
    )

    expect(container.querySelector('svg')).toBeTruthy()
  })
})

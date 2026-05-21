import { computeStatus } from '../src/lib/status';

describe('computeStatus', () => {
  const cases: Array<[number, ReturnType<typeof computeStatus>]> = [
    [0, 'On Track'],
    [50, 'On Track'],
    [79.99, 'On Track'],
    [80, 'Warning'],
    [95, 'Warning'],
    [100, 'Warning'],
    [100.01, 'Exceeded'],
    [150, 'Exceeded']
  ];

  it.each(cases)('returns %s for %s%%', (pct, expected) => {
    expect(computeStatus(pct)).toBe(expected);
  });

  it('treats NaN as On Track (no usage data)', () => {
    expect(computeStatus(NaN)).toBe('On Track');
  });
});

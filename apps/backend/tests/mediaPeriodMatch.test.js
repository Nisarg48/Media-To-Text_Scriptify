const { mediaInPeriodMatch, resolvePeriodBounds } = require('../utils/mediaPeriodMatch');

describe('resolvePeriodBounds', () => {
  it('uses explicit ISO range when valid', () => {
    const { start, end } = resolvePeriodBounds('2025-01-10T00:00:00.000Z', '2025-01-20T00:00:00.000Z');
    expect(start.toISOString()).toBe('2025-01-10T00:00:00.000Z');
    expect(end.toISOString()).toBe('2025-01-20T00:00:00.000Z');
  });

  it('falls back to UTC month when params invalid', () => {
    const { start, end } = resolvePeriodBounds('bad', 'also-bad');
    expect(start.getUTCDate()).toBe(1);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('uses first value when Express passes repeated keys as array', () => {
    const { start, end } = resolvePeriodBounds(
      ['2025-02-01T00:00:00.000Z', 'ignored'],
      '2025-02-10T00:00:00.000Z'
    );
    expect(start.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2025-02-10T00:00:00.000Z');
  });
});

describe('mediaInPeriodMatch', () => {
  const start = new Date('2025-03-01T00:00:00.000Z');
  const end = new Date('2025-04-01T00:00:00.000Z');
  const m = mediaInPeriodMatch(start, end);

  it('structures period match for completed and non-completed', () => {
    expect(m.$or).toHaveLength(2);
    expect(m.$or[1].status).toEqual({ $ne: 'COMPLETED' });
    expect(m.$or[1].createdAt).toEqual({ $gte: start, $lt: end });
  });
});

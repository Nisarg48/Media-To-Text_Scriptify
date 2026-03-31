/**
 * Dashboard / analytics period filter: completed items by completedAt (fallback legacy: updatedAt);
 * non-completed by createdAt.
 * @param {Date} start inclusive
 * @param {Date} end exclusive
 */
function mediaInPeriodMatch(start, end) {
    return {
        $or: [
            {
                status: 'COMPLETED',
                $or: [
                    { completedAt: { $gte: start, $lt: end } },
                    {
                        $and: [
                            {
                                $or: [
                                    { completedAt: null },
                                    { completedAt: { $exists: false } },
                                ],
                            },
                            { updatedAt: { $gte: start, $lt: end } },
                            { createdAt: { $gte: start, $lt: end } },
                        ],
                    },
                ],
            },
            {
                status: { $ne: 'COMPLETED' },
                createdAt: { $gte: start, $lt: end },
            },
        ],
    };
}

/** Express often gives string[] if a key is repeated; take first usable value. */
function firstQueryValue(val) {
    if (val == null) return undefined;
    const s = Array.isArray(val) ? val[0] : val;
    if (typeof s !== 'string') return undefined;
    const t = s.trim();
    return t.length ? t : undefined;
}

/**
 * @param {string|string[]|undefined} periodStart ISO string
 * @param {string|string[]|undefined} periodEnd ISO string
 * @returns {{ start: Date, end: Date }}
 */
function resolvePeriodBounds(periodStart, periodEnd) {
    const ps = firstQueryValue(periodStart);
    const pe = firstQueryValue(periodEnd);
    if (ps && pe) {
        const start = new Date(ps);
        const end = new Date(pe);
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && start < end) {
            return { start, end };
        }
    }
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
}

module.exports = { mediaInPeriodMatch, resolvePeriodBounds, firstQueryValue };

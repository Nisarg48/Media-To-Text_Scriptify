const mongoose = require('mongoose');
const {
    mediaInPeriodMatch,
    resolvePeriodBounds,
    firstQueryValue,
} = require('./mediaPeriodMatch');

/**
 * Dashboard / analytics / media list: consistent match for periodScope.
 * - periodScope=all — no date filter (only user + not deleted).
 * - periodScope=range — requires valid periodStart & periodEnd (ISO), else 422.
 * - periodScope absent — legacy: UTC calendar month via resolvePeriodBounds.
 *
 * @returns {{ error: null, match: object, periodEcho: { start: string, end: string } | null } | { error: { status: number, msg: string } }}
 */
function buildDashboardMediaMatch(query, userId) {
    const uid = mongoose.Types.ObjectId.createFromHexString(String(userId));

    const userUndeleted = {
        mediaUploadedBy: uid,
        $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    };

    const scopeRaw = firstQueryValue(query.periodScope);

    if (scopeRaw === 'all') {
        return {
            error: null,
            match: { $and: [userUndeleted] },
            periodEcho: null,
        };
    }

    if (scopeRaw === 'range') {
        const ps = firstQueryValue(query.periodStart);
        const pe = firstQueryValue(query.periodEnd);
        if (!ps || !pe) {
            return {
                error: {
                    status: 422,
                    msg: 'periodScope=range requires periodStart and periodEnd query parameters.',
                },
            };
        }
        const start = new Date(ps);
        const end = new Date(pe);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
            return {
                error: {
                    status: 422,
                    msg: 'Invalid periodStart or periodEnd (expect ISO dates with start before end).',
                },
            };
        }
        return {
            error: null,
            match: {
                $and: [userUndeleted, mediaInPeriodMatch(start, end)],
            },
            periodEcho: { start: start.toISOString(), end: end.toISOString() },
        };
    }

    const { start, end } = resolvePeriodBounds(query.periodStart, query.periodEnd);
    return {
        error: null,
        match: {
            $and: [userUndeleted, mediaInPeriodMatch(start, end)],
        },
        periodEcho: { start: start.toISOString(), end: end.toISOString() },
    };
}

module.exports = { buildDashboardMediaMatch };

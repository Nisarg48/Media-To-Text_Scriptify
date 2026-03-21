/**
 * Pure helpers for SRT / VTT / plain text export from segment arrays.
 */

/** Seconds to SRT timestamp 00:00:03,320 */
const formatSrtTime = (seconds) => {
    const totalMs = Math.max(0, Math.round(Number(seconds) * 1000 || 0));
    const hh = String(Math.floor(totalMs / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((totalMs % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0');
    const ms = String(totalMs % 1000).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
};

/** Seconds to WebVTT timestamp 00:00:03.320 */
const formatVttTime = (seconds) => {
    const totalMs = Math.max(0, Math.round(Number(seconds) * 1000 || 0));
    const hh = String(Math.floor(totalMs / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((totalMs % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, '0');
    const frac = String(totalMs % 1000).padStart(3, '0');
    return `${hh}:${mm}:${ss}.${frac}`;
};

const segmentsToSrt = (segments) => {
    if (!segments?.length) return '';
    let out = '';
    segments.forEach((segment, index) => {
        out += `${index + 1}\n`;
        out += `${formatSrtTime(segment.start)} --> ${formatSrtTime(segment.end)}\n`;
        out += `${String(segment.text ?? '').trim()}\n\n`;
    });
    return out;
};

const segmentsToVtt = (segments) => {
    let out = 'WEBVTT\n\n';
    if (!segments?.length) return out;
    segments.forEach((segment, index) => {
        out += `${index + 1}\n`;
        out += `${formatVttTime(segment.start)} --> ${formatVttTime(segment.end)}\n`;
        out += `${String(segment.text ?? '').trim()}\n\n`;
    });
    return out;
};

const segmentsToTxt = (segments) => {
    if (!segments?.length) return '';
    return segments.map((s) => String(s.text ?? '').trim()).filter(Boolean).join('\n\n');
};

module.exports = {
    formatSrtTime,
    formatVttTime,
    segmentsToSrt,
    segmentsToVtt,
    segmentsToTxt,
};

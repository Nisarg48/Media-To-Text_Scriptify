const { test } = require('node:test');
const assert = require('node:assert');
const { segmentsToSrt, segmentsToVtt, segmentsToTxt, formatSrtTime } = require('../utils/subtitleFormats');

test('formatSrtTime handles fractional seconds', () => {
    assert.strictEqual(formatSrtTime(3.32), '00:00:03,320');
});

test('segmentsToSrt builds numbered cues', () => {
    const s = segmentsToSrt([
        { start: 0, end: 1, text: 'Hello' },
        { start: 1, end: 2, text: 'World' },
    ]);
    assert.ok(s.includes('1\n'));
    assert.ok(s.includes('Hello'));
    assert.ok(s.includes('2\n'));
    assert.ok(s.includes('World'));
});

test('segmentsToVtt starts with WEBVTT', () => {
    const v = segmentsToVtt([{ start: 0, end: 1, text: 'Hi' }]);
    assert.ok(v.startsWith('WEBVTT'));
    assert.ok(v.includes('Hi'));
});

test('segmentsToTxt joins with blank lines', () => {
    const t = segmentsToTxt([
        { text: 'A' },
        { text: 'B' },
    ]);
    assert.strictEqual(t, 'A\n\nB');
});

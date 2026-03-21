import { describe, it, expect } from 'vitest';
import { getFriendlyErrorMessage } from '../utils/friendlyError';

describe('getFriendlyErrorMessage', () => {
  it('returns the default message for null input', () => {
    const msg = getFriendlyErrorMessage(null);
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(0);
  });

  it('returns the default message for non-string input', () => {
    const msg = getFriendlyErrorMessage(42);
    expect(msg).toBe(getFriendlyErrorMessage(null));
  });

  it('matches connection reset errors', () => {
    const msg = getFriendlyErrorMessage('Connection reset by peer');
    expect(msg).toMatch(/connection was interrupted/i);
  });

  it('matches timeout errors', () => {
    const msg = getFriendlyErrorMessage('Request timed out after 30s');
    expect(msg).toMatch(/took too long/i);
  });

  it('matches out of memory errors', () => {
    const msg = getFriendlyErrorMessage('out of memory (OOM killed)');
    expect(msg).toMatch(/out of memory/i);
  });

  it('matches whisper / transcription errors', () => {
    const msg = getFriendlyErrorMessage('whisper failed to load model');
    expect(msg).toMatch(/transcription failed/i);
  });

  it('matches gemini / translation errors', () => {
    const msg = getFriendlyErrorMessage('gemini api 429 quota exceeded');
    expect(msg).toMatch(/translation failed/i);
  });

  it('matches storage errors', () => {
    const msg = getFriendlyErrorMessage('minio bucket not found');
    expect(msg).toMatch(/storage error/i);
  });

  it('matches network errors', () => {
    const msg = getFriendlyErrorMessage('ECONNREFUSED 127.0.0.1:5672');
    expect(msg).toMatch(/network error/i);
  });

  it('returns default for an unrecognised error', () => {
    const msg = getFriendlyErrorMessage('completely unknown error 12345');
    expect(msg).toMatch(/something went wrong/i);
  });
});

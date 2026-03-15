/**
 * Maps technical error messages from the worker/backend to user-friendly text.
 */
const ERROR_PATTERNS = [
  {
    test: /connection reset|ConnectionResetError|Connection reset by peer|Stream connection lost|Channel is closed/i,
    message: 'The connection was interrupted. Your transcript may still have been created—refresh the page to check.',
  },
  {
    test: /timeout|timed out/i,
    message: 'The request took too long. Please try again.',
  },
  {
    test: /out of memory|OOM|memory error/i,
    message: 'Processing ran out of memory. Try a shorter file or try again later.',
  },
  {
    test: /whisper|transcri/i,
    message: 'Transcription failed. Check that the file has clear audio and try again.',
  },
  {
    test: /gemini|translation|translate|expecting|json decode/i,
    message: 'Translation failed. You can try again or use a different target language.',
  },
  {
    test: /minio|s3|storage|upload/i,
    message: 'Storage error. Please try again in a moment.',
  },
  {
    test: /network|fetch|ECONNREFUSED|ENOTFOUND/i,
    message: 'A network error occurred. Check your connection and try again.',
  },
];

const DEFAULT_MESSAGE = 'Something went wrong during processing. Please try again. If it keeps failing, try a different file or contact support.';

export function getFriendlyErrorMessage(technicalMessage) {
  if (!technicalMessage || typeof technicalMessage !== 'string') return DEFAULT_MESSAGE;
  const trimmed = technicalMessage.trim();
  for (const { test, message } of ERROR_PATTERNS) {
    if (test.test(trimmed)) return message;
  }
  return DEFAULT_MESSAGE;
}

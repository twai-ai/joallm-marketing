export class TimeoutError extends Error {
  readonly code = 'TIMEOUT';

  constructor(message = 'Request timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

export function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof TimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      ((error as { name?: string }).name === 'TimeoutError' ||
        (error as { code?: string }).code === 'TIMEOUT'))
  );
}

export function isTransientNetworkError(error: unknown): boolean {
  if (isTimeoutError(error)) return true;
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  if (error.name === 'TypeError' && /failed to fetch|networkerror|load failed/.test(message)) {
    return true;
  }
  return /timed out|network|failed to fetch|load failed/.test(message);
}

/**
 * fetch wrapper that aborts after timeoutMs so slow networks fail fast
 * instead of hanging indefinitely.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  const onExternalAbort = () => controller.abort();
  if (init.signal) {
    if (init.signal.aborted) {
      window.clearTimeout(timeoutId);
      throw new DOMException('Aborted', 'AbortError');
    }
    init.signal.addEventListener('abort', onExternalAbort);
  }

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      if (init.signal?.aborted) {
        throw error;
      }
      throw new TimeoutError(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    init.signal?.removeEventListener('abort', onExternalAbort);
  }
}

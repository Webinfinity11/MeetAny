export const READ_TIMEOUT_MS = 12_000;

// Bound reads through response-body consumption as well as the initial fetch.
// Mutations deliberately retain their existing behavior; do not retry writes.
export async function withReadTimeout(read, timeout = READ_TIMEOUT_MS) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(() => read(controller.signal)),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error('Read timed out');
          error.code = 'TIMEOUT';
          controller.abort();
          reject(error);
        }, timeout);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

/**
 * In-process keepalive pinger.
 *
 * Render's free tier suspends a web service after 15 minutes with no
 * inbound HTTP traffic. Hitting our own public URL on a timer counts as
 * inbound traffic and resets the idle timer, so the service stays warm
 * as long as it is running.
 *
 * Render injects RENDER_EXTERNAL_URL automatically. Locally and in tests
 * the variable is unset and the pinger is a no-op.
 */

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const REQUEST_TIMEOUT_MS = 30 * 1000;

export function startKeepalive(): void {
  const baseUrl = process.env.RENDER_EXTERNAL_URL ?? process.env.KEEPALIVE_URL;
  if (!baseUrl) {
    // eslint-disable-next-line no-console
    console.log('[keepalive] disabled (no RENDER_EXTERNAL_URL set)');
    return;
  }

  const intervalMs = Number(process.env.KEEPALIVE_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  const target = `${baseUrl.replace(/\/$/, '')}/health`;

  const ping = async (): Promise<void> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(target, { signal: controller.signal });
      // eslint-disable-next-line no-console
      console.log(`[keepalive] ${res.status} ${target}`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[keepalive] failed:', (err as Error).message);
    } finally {
      clearTimeout(timer);
    }
  };

  // eslint-disable-next-line no-console
  console.log(`[keepalive] enabled, pinging ${target} every ${Math.round(intervalMs / 1000)}s`);
  const handle = setInterval(ping, intervalMs);
  // Don't keep the event loop alive purely for the timer.
  if (typeof handle.unref === 'function') handle.unref();
}

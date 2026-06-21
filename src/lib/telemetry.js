/* Telemetry seam — the single place app errors/events are reported.

   Today it logs to the console (same visibility as before), but every swallowed
   failure in storage / sync / auth now flows through here, so wiring a real
   backend (Sentry, Crashlytics, a logging endpoint) is a one-function change
   instead of hunting down scattered console.warns.

   `scope` groups the source ('storage' | 'sync' | 'auth' | …); `meta` carries
   structured context (op, key, userId, …) — never secrets/tokens. */
export function reportError(scope, error, meta) {
  const message = error && error.message ? error.message : error;
  // eslint-disable-next-line no-console
  console.warn(`[${scope}]`, message, meta || '');
  // TODO(production): forward to crash/error reporting, e.g.
  //   Sentry.captureException(error, { tags: { scope }, extra: meta });
}

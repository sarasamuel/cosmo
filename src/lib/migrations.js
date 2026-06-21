/* Versioned migrations for the persisted domain state.
   ---------------------------------------------------------------------------
   The on-device blob (KEY_DATA) AND every cloud snapshot carry a `v` (data
   version). On load we run any migrations from the stored version up to
   DATA_VERSION, so a shape change is an explicit, ordered transform instead of
   a scatter of `?? default` guards — and a backup written by an OLD app version
   is upgraded when a NEW version restores it.

   To evolve the shape:
     1. bump DATA_VERSION
     2. add MIGRATIONS[newVersion] = (data) => transformedData
   Each step takes the data at version N-1 and returns it at version N. Keep
   steps pure and defensive (inputs may be partial/corrupt). */

export const DATA_VERSION = 1;

const MIGRATIONS = {
  // v0 (pre-versioning) → v1: codify the fields added since first release so an
  // older blob loads with a complete, current shape rather than relying on
  // read-site guards. Non-destructive — only fills what's missing.
  1: (d) => {
    const out = { ...d };
    if (!out.planHistory || typeof out.planHistory !== 'object') out.planHistory = {};
    if (out.relax && out.relax.tracked == null) {
      out.relax = { ...out.relax, tracked: (out.relax.desired || 0) > 0 };
    }
    return out;
  },
};

// Version stamped on the data, defaulting to 0 for legacy/pre-versioning blobs.
function versionOf(obj) {
  return obj && Number.isFinite(obj.v) ? obj.v : 0;
}

export function needsMigration(obj) {
  return versionOf(obj) < DATA_VERSION;
}

// Apply every migration from the data's version up to DATA_VERSION, returning a
// new object stamped at the current version. Pass-through for non-objects.
export function migrateData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  let data = obj;
  for (let v = versionOf(obj) + 1; v <= DATA_VERSION; v += 1) {
    const step = MIGRATIONS[v];
    if (step) data = step(data);
  }
  return { ...data, v: DATA_VERSION };
}

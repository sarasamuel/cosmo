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

export const DATA_VERSION = 3;

// Deterministic id for a legacy session from its content, so the SAME session
// gets the SAME sid on every device — letting the cross-device merge dedupe it
// (incoming cloud snapshots are migrated before merging). djb2 over the content
// tuple, plus the ts, keeps collisions vanishingly unlikely.
function sidFor(s) {
  const str = `${s.id}|${s.ts}|${s.mins}|${s.label || ''}`;
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `s_${(h >>> 0).toString(36)}_${Number(s.ts || 0).toString(36)}`;
}

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
  // v1 → v2: backfill a stable `sid` on every session that predates session ids,
  // so the multi-device session merge keys on the id instead of a content tuple.
  2: (d) => {
    if (!Array.isArray(d.sessions)) return d;
    return { ...d, sessions: d.sessions.map((s) => (s && s.sid == null ? { ...s, sid: sidFor(s) } : s)) };
  },
  // v2 → v3: the journal layer (user notes + milestones) arrives — ensure the
  // array exists so the feed reads cleanly on older blobs.
  3: (d) => (Array.isArray(d.journal) ? d : { ...d, journal: [] }),
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

// stepsmatch/backend/jobs/tokenSweeper.js
// Token Sweeper (Step 6a)
// - Löscht alte, invalide Tokens (invalid=true ODER lastError∈{DeviceNotRegistered,replaced-by-new-token}) älter als N Tage
// - Optional: markiert sehr alte, nie gesehene Tokens als disabled
// - Exponiert start/stop, wird in server.js gemountet (Step 6b)

import PushToken from '../models/PushToken.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Konfiguration via ENV (Defaults konservativ)
const SWEEP_INTERVAL_MS = Math.max(5 * 60 * 1000, Number(process.env.TOKEN_SWEEPER_INTERVAL_MS || 10 * 60 * 1000)); // min 5m
const INVALID_MAX_AGE_DAYS = Math.max(1, Number(process.env.TOKEN_SWEEPER_INVALID_MAX_AGE_DAYS || 7)); // 7 Tage
const DISABLE_NEVER_SEEN_DAYS = Number(process.env.TOKEN_SWEEPER_DISABLE_NEVER_SEEN_DAYS || 30); // 30 Tage
const DRY_RUN = String(process.env.TOKEN_SWEEPER_DRY_RUN || '').toLowerCase() === 'true';

let _timer = null;
let _running = false;

function nowIso() { return new Date().toISOString(); }

function buildInvalidSelector(cutoff) {
  // Kandidaten zum Löschen:
  //  - invalid === true
  //  - ODER lastError ∈ { DeviceNotRegistered, replaced-by-new-token }
  //  - UND updatedAt/lastSeenAt < cutoff (alt genug)
  return {
    $and: [
      {
        $or: [
          { valid: false },
          { lastError: { $in: ['DeviceNotRegistered', 'replaced-by-new-token'] } },
        ],
      },
      {
        $or: [
          { updatedAt: { $lt: cutoff } },
          { lastSeenAt: { $lt: cutoff } },
          { createdAt: { $lt: cutoff } },
        ],
      },
    ],
  };
}

async function sweepOnce() {
  const startedAt = Date.now();
  const cutoffInvalid = new Date(Date.now() - INVALID_MAX_AGE_DAYS * ONE_DAY_MS);

  // 1) Alte invalide Tokens löschen
  const invalidSelector = buildInvalidSelector(cutoffInvalid);

  let toDelete = 0;
  try {
    toDelete = await PushToken.countDocuments(invalidSelector);
  } catch {}

  let delRes = { acknowledged: true, deletedCount: 0 };
  if (!DRY_RUN && toDelete > 0) {
    try {
      delRes = await PushToken.deleteMany(invalidSelector);
    } catch (e) {
      console.warn('[tokenSweeper] deleteMany error:', e?.message || e);
    }
  }

  // 2) Sehr alte „nie gesehene“ Tokens deaktivieren (optional)
  //    Bedingung: lastSeenAt fehlt ODER sehr alt; und valid==true → disabled=true setzen
  let disableRes = { acknowledged: true, modifiedCount: 0 };
  if (DISABLE_NEVER_SEEN_DAYS > 0) {
    const cutoffNeverSeen = new Date(Date.now() - DISABLE_NEVER_SEEN_DAYS * ONE_DAY_MS);
    const disableSelector = {
      valid: true,
      disabled: { $ne: true },
      $or: [
        { lastSeenAt: { $exists: false } },
        { lastSeenAt: { $lt: cutoffNeverSeen } },
      ],
    };
    if (!DRY_RUN) {
      try {
        disableRes = await PushToken.updateMany(disableSelector, {
          $set: { disabled: true, lastError: 'auto-disabled-never-seen', updatedAt: new Date() },
        });
      } catch (e) {
        console.warn('[tokenSweeper] disable-old error:', e?.message || e);
      }
    }
  }

  const tookMs = Date.now() - startedAt;
  console.log(
    `[tokenSweeper] ${nowIso()} ran in ${tookMs}ms ::` +
      ` invalidCutoff=${cutoffInvalid.toISOString()}` +
      ` dryRun=${DRY_RUN}` +
      ` deleted=${delRes.deletedCount || 0}` +
      ` disabled=${disableRes.modifiedCount || 0}`
  );

  return {
    deleted: delRes.deletedCount || 0,
    disabled: disableRes.modifiedCount || 0,
    tookMs,
  };
}

export function startTokenSweeper() {
  if (_running) return;
  _running = true;

  // sofort einmal starten (non-blocking), danach im Intervall
  sweepOnce().catch(() => {});

  _timer = setInterval(() => {
    sweepOnce().catch((e) => console.warn('[tokenSweeper] sweep error', e?.message || e));
  }, SWEEP_INTERVAL_MS);

  // Node sollte wegen Intervall nicht am Exit gehindert werden, falls gewünscht:
  try { _timer.unref?.(); } catch {}

  console.log(
    `[tokenSweeper] started interval=${SWEEP_INTERVAL_MS}ms` +
      ` invalidMaxAgeDays=${INVALID_MAX_AGE_DAYS}` +
      ` disableNeverSeenDays=${DISABLE_NEVER_SEEN_DAYS}` +
      ` dryRun=${DRY_RUN}`
  );
}

export function stopTokenSweeper() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  _running = false;
  console.log('[tokenSweeper] stopped');
}

export default {
  startTokenSweeper,
  stopTokenSweeper,
};

/**
 * The bookkeeping every persisted record carries so two copies of the data can
 * be reconciled: `updatedAt` says which side of a merge is newer, `deletedAt`
 * says a record was deleted rather than never seen.
 *
 * Nothing but the JSON import reads these today. They are here now because they
 * cannot be added later: records written without them have no way to say when
 * they last changed, so every device would tie on every merge, and a hard
 * delete on one device would be indistinguishable from a record the other
 * device simply had not received yet -- deleted tasks would come back.
 */
export interface SyncMeta {
  /** ISO instant of the last change to this record. */
  updatedAt: string;
  /** ISO instant this record was deleted, or null while it is present. */
  deletedAt: string | null;
}

export interface SyncRecord extends SyncMeta {
  id: string;
}

/**
 * The stamp given to records saved before these fields existed: older than any
 * real edit, so a genuine change on another device always wins the merge.
 */
export const EPOCH_ISO = new Date(0).toISOString();

/**
 * How long a tombstone is kept before the record is dropped for good. It has to
 * outlive the longest plausible gap between two devices syncing, or the deleted
 * record returns from the one that was away.
 */
export const TOMBSTONE_RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

export function nowIso(): string {
  return new Date().toISOString();
}

function isIsoInstant(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** The `SyncMeta` half of a stored record, for the `toX()` validators. */
export function toSyncMeta(value: Partial<SyncMeta> | undefined): SyncMeta {
  return {
    updatedAt: isIsoInstant(value?.updatedAt) ? value.updatedAt : EPOCH_ISO,
    deletedAt: isIsoInstant(value?.deletedAt) ? value.deletedAt : null,
  };
}

export function isPresent(record: SyncMeta): boolean {
  return record.deletedAt === null;
}

/** Applies a change and stamps it, so a later merge can order the two sides. */
export function touch<T extends SyncMeta>(record: T, changes: Partial<T>): T {
  return { ...record, ...changes, updatedAt: nowIso() };
}

/** Replaces a record with a tombstone, keeping its id so the delete travels. */
export function tombstone<T extends SyncRecord>(record: T): T {
  const deletedAt = nowIso();
  return { ...record, deletedAt, updatedAt: deletedAt };
}

/**
 * Last-write-wins by id. The local order is kept and unknown incoming records
 * are appended, so importing a backup never reshuffles the list. Records that
 * cannot be ordered -- equal stamps, or an unparseable one -- keep the local
 * copy rather than churning.
 *
 * This is the whole merge rule, and the same function a sync layer would call
 * on the response from a server.
 */
export function mergeById<T extends SyncRecord>(mine: T[], theirs: T[]): T[] {
  const incoming = new Map(theirs.map((record) => [record.id, record]));

  const merged = mine.map((record) => {
    const other = incoming.get(record.id);
    if (!other) return record;

    incoming.delete(record.id);
    return Date.parse(other.updatedAt) > Date.parse(record.updatedAt)
      ? other
      : record;
  });

  return [...merged, ...incoming.values()];
}

/** Drops tombstones old enough that no device can still be unaware of them. */
export function purgeTombstones<T extends SyncMeta>(
  records: T[],
  now = Date.now(),
): T[] {
  const cutoff = now - TOMBSTONE_RETENTION_DAYS * DAY_MS;

  const kept = records.filter((record) => {
    if (record.deletedAt === null) return true;

    const deleted = Date.parse(record.deletedAt);
    return Number.isNaN(deleted) || deleted > cutoff;
  });

  return kept.length === records.length ? records : kept;
}

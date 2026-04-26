export interface NoteCurrencySnapshot {
  createdAt?: string | null;
  updatedAt?: string | null;
  timestamp?: string | null;
  localRevision?: number | null;
}

export function normalizeLocalRevision(value: number | null | undefined) {
  return Number.isFinite(value) && value !== null && value !== undefined
    ? Math.max(0, Math.trunc(value))
    : 0;
}

function getCurrencyTimestamp(snapshot: NoteCurrencySnapshot) {
  return snapshot.timestamp ?? snapshot.updatedAt ?? snapshot.createdAt ?? null;
}

function compareTimestampValues(
  leftTimestamp: string | null | undefined,
  rightTimestamp: string | null | undefined
) {
  if (!leftTimestamp || !rightTimestamp) {
    return 0;
  }

  const leftTime = new Date(leftTimestamp).getTime();
  const rightTime = new Date(rightTimestamp).getTime();
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return Math.sign(leftTime - rightTime);
  }

  if (leftTimestamp === rightTimestamp) {
    return 0;
  }

  return leftTimestamp < rightTimestamp ? -1 : 1;
}

export function compareNoteCurrency(
  left: NoteCurrencySnapshot,
  right: NoteCurrencySnapshot
) {
  const timestampComparison = compareTimestampValues(
    getCurrencyTimestamp(left),
    getCurrencyTimestamp(right)
  );
  if (timestampComparison !== 0) {
    return timestampComparison;
  }

  return Math.sign(
    normalizeLocalRevision(left.localRevision) - normalizeLocalRevision(right.localRevision)
  );
}

export function isNoteCurrencyOlder(
  left: NoteCurrencySnapshot,
  right: NoteCurrencySnapshot
) {
  return compareNoteCurrency(left, right) < 0;
}

export function isNoteCurrencyAtLeastAsCurrent(
  left: NoteCurrencySnapshot,
  right: NoteCurrencySnapshot
) {
  return compareNoteCurrency(left, right) >= 0;
}

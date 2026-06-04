type SharedPostChangeField = 'author_user_id' | 'audience_user_ids';

function getSharedPostChangeEventType(payload: unknown) {
  if (typeof payload !== 'object' || !payload || !('eventType' in payload)) {
    return null;
  }

  const eventType = (payload as { eventType?: unknown }).eventType;
  return typeof eventType === 'string' ? eventType.toUpperCase() : null;
}

function getSharedPostChangeField(payload: unknown, field: SharedPostChangeField) {
  if (typeof payload !== 'object' || !payload) {
    return null;
  }

  const eventPayload = payload as {
    new?: Record<string, unknown> | null;
    old?: Record<string, unknown> | null;
  };

  if (eventPayload.new && field in eventPayload.new) {
    return eventPayload.new[field] ?? null;
  }

  if (eventPayload.old && field in eventPayload.old) {
    return eventPayload.old[field] ?? null;
  }

  return null;
}

function getSharedPostChangeFields(payload: unknown, field: SharedPostChangeField) {
  if (typeof payload !== 'object' || !payload) {
    return [];
  }

  const eventPayload = payload as {
    new?: Record<string, unknown> | null;
    old?: Record<string, unknown> | null;
  };
  const values: unknown[] = [];

  if (eventPayload.new && field in eventPayload.new) {
    values.push(eventPayload.new[field] ?? null);
  }

  if (eventPayload.old && field in eventPayload.old) {
    values.push(eventPayload.old[field] ?? null);
  }

  if (values.length === 0) {
    const fallbackValue = getSharedPostChangeField(payload, field);
    if (fallbackValue !== null) {
      values.push(fallbackValue);
    }
  }

  return values;
}

export function shouldRefreshForSharedPostChange(payload: unknown, userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    return false;
  }

  const authorUserIds = getSharedPostChangeFields(payload, 'author_user_id');
  if (authorUserIds.some((value) => typeof value === 'string' && value.trim() === normalizedUserId)) {
    return true;
  }

  const audienceUserIdsValues = getSharedPostChangeFields(payload, 'audience_user_ids');
  for (const audienceUserIds of audienceUserIdsValues) {
    if (
      Array.isArray(audienceUserIds) &&
      audienceUserIds.some((value) => typeof value === 'string' && value.trim() === normalizedUserId)
    ) {
      return true;
    }
  }

  if (
    getSharedPostChangeEventType(payload) === 'DELETE' &&
    authorUserIds.length === 0 &&
    audienceUserIdsValues.length === 0
  ) {
    return true;
  }

  return false;
}

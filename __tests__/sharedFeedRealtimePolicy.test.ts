import { shouldRefreshForSharedPostChange } from '../services/sharedFeed/realtimePolicy';

describe('shared feed realtime policy', () => {
  it('refreshes for authored shared post changes', () => {
    expect(
      shouldRefreshForSharedPostChange(
        {
          new: {
            author_user_id: ' user-1 ',
            audience_user_ids: ['user-2'],
          },
        },
        'user-1'
      )
    ).toBe(true);
  });

  it('refreshes for audience membership changes on either side of the payload', () => {
    expect(
      shouldRefreshForSharedPostChange(
        {
          old: {
            author_user_id: 'user-2',
            audience_user_ids: ['user-1'],
          },
          new: {
            author_user_id: 'user-2',
            audience_user_ids: ['user-3'],
          },
        },
        'user-1'
      )
    ).toBe(true);
  });

  it('ignores unrelated shared post changes', () => {
    expect(
      shouldRefreshForSharedPostChange(
        {
          new: {
            author_user_id: 'user-2',
            audience_user_ids: ['user-3'],
          },
        },
        'user-1'
      )
    ).toBe(false);
  });

  it('refreshes for unclassifiable deletes when old rows are not replicated', () => {
    expect(
      shouldRefreshForSharedPostChange(
        {
          eventType: 'DELETE',
          old: {
            id: 'shared-post-1',
          },
        },
        'user-1'
      )
    ).toBe(true);
  });

  it('does not refresh for unrelated deletes when old audience data is available', () => {
    expect(
      shouldRefreshForSharedPostChange(
        {
          eventType: 'DELETE',
          old: {
            author_user_id: 'user-2',
            audience_user_ids: ['user-3'],
          },
        },
        'user-1'
      )
    ).toBe(false);
  });

  it('ignores malformed payloads and blank users', () => {
    expect(shouldRefreshForSharedPostChange(null, 'user-1')).toBe(false);
    expect(
      shouldRefreshForSharedPostChange(
        {
          eventType: 'DELETE',
        },
        '   '
      )
    ).toBe(false);
  });
});

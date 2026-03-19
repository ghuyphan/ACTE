import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('firestore rules hardening', () => {
  const rules = readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8');

  it('keeps private user docs owner-only and exposes a separate public profile path', () => {
    expect(rules).toContain('match /publicUserProfiles/{userId}');
    expect(rules).toContain('allow get: if signedIn();');
    expect(rules).toContain('match /users/{userId}');
    expect(rules).toContain('allow get: if isSelf(userId);');
  });

  it('requires all shared post audience members to be validated as friends', () => {
    expect(rules).toContain('function sharedPostAudienceIsValid(audience)');
    expect(rules).toContain("exists(/databases/$(database)/documents/users/$(request.auth.uid)/friends/$(audience[index]))");
    expect(rules).toContain('sharedPostAudienceIsValid(request.resource.data.audienceUserIds)');
  });

  it('enforces invite tokens for friend links and room joins', () => {
    expect(rules).toContain('friendInviteDoc(inviteId).data.token == inviteToken');
    expect(rules).toContain('request.resource.data.createdByInviteToken is string');
    expect(rules).toContain('function roomInviteTokenMatches(roomId, inviteId, inviteToken)');
    expect(rules).toContain('request.resource.data.joinedViaInviteToken is string');
  });
});

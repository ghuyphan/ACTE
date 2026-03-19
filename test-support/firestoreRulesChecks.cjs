const { assertFails, assertSucceeds, initializeTestEnvironment } = require('@firebase/rules-unit-testing');
const { readFileSync } = require('fs');
const { resolve } = require('path');

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'test-shared-posts',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });

  try {
    await testEnv.clearFirestore();

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.collection('users').doc('alice').set({
        displayName: 'Alice',
        noteCount: 3,
        lastSyncedAt: '2026-03-19T08:00:00.000Z',
      });
      await db.collection('users').doc('alice').collection('friends').doc('bob').set({
        userId: 'bob',
        displayNameSnapshot: 'Bob',
        photoURLSnapshot: null,
        friendedAt: '2026-03-19T08:00:00.000Z',
        lastSharedAt: null,
        createdByInviteId: 'invite-1',
        createdByInviteToken: 'token-1',
      });
      await db.collection('rooms').doc('room-1').set({
        name: 'Trips',
        ownerId: 'owner-1',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-19T09:00:00.000Z',
        lastPostAt: null,
      });
      await db.collection('rooms').doc('room-1').collection('members').doc('owner-1').set({
        roomId: 'room-1',
        userId: 'owner-1',
        role: 'owner',
        displayNameSnapshot: 'Owner',
        photoURLSnapshot: null,
        joinedAt: '2026-03-19T09:00:00.000Z',
        lastReadAt: '2026-03-19T09:00:00.000Z',
        joinedViaInviteId: null,
        joinedViaInviteToken: null,
      });
      await db.collection('rooms').doc('room-1').collection('invites').doc('invite-1').set({
        roomId: 'room-1',
        token: 'room-secret',
        createdBy: 'owner-1',
        createdAt: '2026-03-19T09:01:00.000Z',
        expiresAt: null,
        revokedAt: null,
      });
      await db.collection('friendInvites').doc('invite-1').set({
        inviterUid: 'alice',
        inviterDisplayNameSnapshot: 'Alice',
        inviterPhotoURLSnapshot: null,
        token: 'friend-secret',
        createdAt: '2026-03-19T10:00:00.000Z',
        revokedAt: null,
        acceptedByUid: null,
        acceptedAt: null,
        expiresAt: null,
      });
    });

    const bobDb = testEnv.authenticatedContext('bob', { email: 'bob@example.com' }).firestore();
    const aliceDb = testEnv.authenticatedContext('alice', { email: 'alice@example.com' }).firestore();

    await assertFails(bobDb.collection('users').doc('alice').get());
    await assertSucceeds(aliceDb.collection('users').doc('alice').get());

    const validPost = {
      authorUid: 'alice',
      authorDisplayName: 'Alice',
      authorPhotoURLSnapshot: null,
      audienceUserIds: ['alice', 'bob'],
      type: 'text',
      text: 'hello bob',
      photoRemoteBase64: null,
      placeName: null,
      sourceNoteId: null,
      createdAt: '2026-03-19T08:05:00.000Z',
      updatedAt: null,
    };

    await assertSucceeds(aliceDb.collection('sharedPosts').doc('post-valid').set(validPost));
    await assertFails(
      aliceDb.collection('sharedPosts').doc('post-invalid').set({
        ...validPost,
        audienceUserIds: ['alice', 'bob', 'mallory'],
      })
    );

    const memberDb = testEnv.authenticatedContext('member-1', { email: 'member@example.com' }).firestore();
    const membershipDoc = memberDb.collection('rooms').doc('room-1').collection('members').doc('member-1');
    const baseMembership = {
      roomId: 'room-1',
      userId: 'member-1',
      role: 'member',
      displayNameSnapshot: 'Member',
      photoURLSnapshot: null,
      joinedAt: '2026-03-19T09:02:00.000Z',
      lastReadAt: '2026-03-19T09:02:00.000Z',
      joinedViaInviteId: 'invite-1',
    };

    await assertFails(
      membershipDoc.set({
        ...baseMembership,
        joinedViaInviteToken: 'wrong-token',
      })
    );
    await assertSucceeds(
      membershipDoc.set({
        ...baseMembership,
        joinedViaInviteToken: 'room-secret',
      })
    );

    const friendDoc = bobDb.collection('users').doc('bob').collection('friends').doc('alice');
    const baseLink = {
      userId: 'alice',
      displayNameSnapshot: 'Alice',
      photoURLSnapshot: null,
      friendedAt: '2026-03-19T10:01:00.000Z',
      lastSharedAt: null,
      createdByInviteId: 'invite-1',
    };

    await assertFails(
      friendDoc.set({
        ...baseLink,
        createdByInviteToken: 'wrong-token',
      })
    );
    await assertSucceeds(
      friendDoc.set({
        ...baseLink,
        createdByInviteToken: 'friend-secret',
      })
    );
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

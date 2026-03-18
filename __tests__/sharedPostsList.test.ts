import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let testEnv: any;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'test-shared-posts',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

it('should allow listing sharedPosts if in audience', async () => {
  const alice = testEnv.authenticatedContext('alice', { email: 'alice@example.com' });
  
  // Create a post by Alice, shared with Bob
  await testEnv.withSecurityRulesDisabled(async (context: any) => {
    const db = context.firestore();
    await db.collection('sharedPosts').doc('post1').set({
      authorUid: 'alice',
      audienceUserIds: ['alice', 'bob'],
      type: 'text',
      text: 'hello',
      createdAt: new Date().toISOString(),
    });
    // Set up friendship so exists() succeeds
    await db.collection('users').doc('bob').collection('friends').doc('alice').set({
      userId: 'alice'
    });
  });

  const bob = testEnv.authenticatedContext('bob', { email: 'bob@example.com' });
  const bobDb = bob.firestore();
  
  // Bob queries feed
  const query = bobDb.collection('sharedPosts')
    .where('audienceUserIds', 'array-contains', 'bob')
    .where('authorUid', 'in', ['alice']);
    
  await assertSucceeds(query.get());
});

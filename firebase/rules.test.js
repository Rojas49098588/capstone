import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'

const here = dirname(fileURLToPath(import.meta.url))
let env

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-studium',
    firestore: { rules: readFileSync(resolve(here, 'firestore.rules'), 'utf8') },
  })
})
afterAll(async () => {
  await env?.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

const as = (uid) => env.authenticatedContext(uid).firestore()

describe('firestore rules', () => {
  it('a user reads and writes only their own user doc and events', async () => {
    const alice = as('alice')
    const bob = as('bob')
    await assertSucceeds(setDoc(doc(alice, 'users/alice'), { savedBy: 'a' }))
    await assertSucceeds(setDoc(doc(alice, 'users/alice/events/e1'), { event: {} }))
    await assertSucceeds(getDoc(doc(alice, 'users/alice')))
    await assertFails(getDoc(doc(bob, 'users/alice')))
    await assertFails(setDoc(doc(bob, 'users/alice'), { savedBy: 'b' }))
    await assertFails(getDoc(doc(bob, 'users/alice/events/e1')))
    await assertFails(setDoc(doc(bob, 'users/alice/events/e1'), { event: {} }))
  })

  it('purchases under a user are read by that user only and written by nobody (server code only)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice/purchases/p1'), { item: 'x' })
    })
    const alice = as('alice')
    await assertSucceeds(getDoc(doc(alice, 'users/alice/purchases/p1')))
    await assertFails(getDoc(doc(as('bob'), 'users/alice/purchases/p1')))
    await assertFails(setDoc(doc(alice, 'users/alice/purchases/p2'), { item: 'free' }))
    await assertFails(setDoc(doc(alice, 'users/alice/purchases/p1'), { item: 'changed' }))
    await assertFails(deleteDoc(doc(alice, 'users/alice/purchases/p1')))
  })

  it('a user can write nothing under their user doc outside events', async () => {
    const alice = as('alice')
    await assertFails(setDoc(doc(alice, 'users/alice/other/x'), { a: 1 }))
    await assertFails(setDoc(doc(alice, 'users/alice/events/e1/deeper/x'), { a: 1 }))
  })

  it('only a member deletes a project', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects/alice_p1'), { members: ['alice'], owner: 'alice' })
    })
    await assertFails(deleteDoc(doc(as('bob'), 'projects/alice_p1')))
    await assertSucceeds(deleteDoc(doc(as('alice'), 'projects/alice_p1')))
  })

  it('a project is created only with yourself as owner and only member', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'projects/alice_p1'), { members: ['alice'], owner: 'alice' }))
    await assertFails(
      setDoc(doc(as('bob'), 'projects/bob_p2'), { members: ['alice', 'bob'], owner: 'bob' }),
    )
    await assertFails(setDoc(doc(as('bob'), 'projects/bob_p3'), { members: ['alice'], owner: 'alice' }))
  })

  it("a project's document id must start with its creator's uid and an underscore", async () => {
    const bob = as('bob')
    await assertSucceeds(setDoc(doc(bob, 'projects/bob_webDev'), { members: ['bob'], owner: 'bob' }))
    await assertFails(setDoc(doc(bob, 'projects/webDev'), { members: ['bob'], owner: 'bob' }))
    await assertFails(setDoc(doc(bob, 'projects/alice_webDev'), { members: ['bob'], owner: 'bob' }))
    await assertFails(setDoc(doc(bob, 'projects/bobby_webDev'), { members: ['bob'], owner: 'bob' }))
  })

  it('only members read or write a project and its subcollections', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects/alice_p1'), { members: ['alice'], owner: 'alice' })
    })
    const alice = as('alice')
    const bob = as('bob')
    for (const path of ['projects/alice_p1', 'projects/alice_p1/tasks/t1', 'projects/alice_p1/events/e1']) {
      const data = path === 'projects/alice_p1' ? { members: ['alice'], owner: 'alice', x: 1 } : { x: 1 }
      await assertFails(getDoc(doc(bob, path)))
      await assertFails(setDoc(doc(bob, path), data))
      await assertSucceeds(setDoc(doc(alice, path), data))
      await assertSucceeds(getDoc(doc(alice, path)))
    }
  })

  it("members and owner can't be changed by an update", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects/alice_p1'), { members: ['alice'], owner: 'alice' })
    })
    const alice = as('alice')
    await assertFails(setDoc(doc(alice, 'projects/alice_p1'), { members: ['alice', 'bob'], owner: 'alice' }))
    await assertFails(setDoc(doc(alice, 'projects/alice_p1'), { members: ['alice'], owner: 'bob' }))
  })

  it('signed-out requests are denied everywhere', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users/alice'), { a: 1 })
      await setDoc(doc(db, 'projects/alice_p1'), { members: ['alice'], owner: 'alice' })
      await setDoc(doc(db, 'projects/alice_p1/tasks/t1'), { a: 1 })
    })
    const anon = env.unauthenticatedContext().firestore()
    for (const path of ['users/alice', 'projects/alice_p1', 'projects/alice_p1/tasks/t1']) {
      await assertFails(getDoc(doc(anon, path)))
      await assertFails(setDoc(doc(anon, path), { members: [], owner: 'x' }))
    }
  })
})

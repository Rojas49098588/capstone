import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc } from 'firebase/firestore'

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

  it('a project is created only with yourself as owner and only member', async () => {
    await assertSucceeds(setDoc(doc(as('alice'), 'projects/p1'), { members: ['alice'], owner: 'alice' }))
    await assertFails(
      setDoc(doc(as('bob'), 'projects/p2'), { members: ['alice', 'bob'], owner: 'bob' }),
    )
    await assertFails(setDoc(doc(as('bob'), 'projects/p3'), { members: ['alice'], owner: 'alice' }))
  })

  it('only members read or write a project and its subcollections', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects/p1'), { members: ['alice'], owner: 'alice' })
    })
    const alice = as('alice')
    const bob = as('bob')
    for (const path of ['projects/p1', 'projects/p1/tasks/t1', 'projects/p1/events/e1']) {
      const data = path === 'projects/p1' ? { members: ['alice'], owner: 'alice', x: 1 } : { x: 1 }
      await assertFails(getDoc(doc(bob, path)))
      await assertFails(setDoc(doc(bob, path), data))
      await assertSucceeds(setDoc(doc(alice, path), data))
      await assertSucceeds(getDoc(doc(alice, path)))
    }
  })

  it("members and owner can't be changed by an update", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'projects/p1'), { members: ['alice'], owner: 'alice' })
    })
    const alice = as('alice')
    await assertFails(setDoc(doc(alice, 'projects/p1'), { members: ['alice', 'bob'], owner: 'alice' }))
    await assertFails(setDoc(doc(alice, 'projects/p1'), { members: ['alice'], owner: 'bob' }))
  })

  it('signed-out requests are denied everywhere', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'users/alice'), { a: 1 })
      await setDoc(doc(db, 'projects/p1'), { members: ['alice'], owner: 'alice' })
      await setDoc(doc(db, 'projects/p1/tasks/t1'), { a: 1 })
    })
    const anon = env.unauthenticatedContext().firestore()
    for (const path of ['users/alice', 'projects/p1', 'projects/p1/tasks/t1']) {
      await assertFails(getDoc(doc(anon, path)))
      await assertFails(setDoc(doc(anon, path), { members: [], owner: 'x' }))
    }
  })
})

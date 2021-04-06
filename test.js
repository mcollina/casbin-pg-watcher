'use strict'

const { newEnforcer } = require('casbin')
const { newAdapter } = require('casbin-pg-adapter').default
const { newWatcher } = require('.')

const { join } = require('path')
const { test } = require('tap')
const { promisify } = require('util')
const sleep = promisify(setTimeout)

const connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres'

async function build (t, migrate) {
  const [adapter, watcher] = await Promise.all([
    newAdapter({
      connectionString,
      migrate
    }),
    newWatcher({
      connectionString
    })
  ])

  t.tearDown(adapter.close.bind(adapter))
  t.tearDown(watcher.close.bind(watcher))

  if (migrate) {
    await adapter.repo.clearPolicies()
  }

  const enforcer = await newEnforcer(join(__dirname, 'examples', 'model.conf'), adapter)
  enforcer.setWatcher(watcher)
  // my own property for tests
  enforcer.watcher = watcher
  return enforcer
}

async function pair (t) {
  const enforcers = [await build(t, true), await build(t, false)]
  await Promise.all(enforcers.map((e) => e.loadPolicy()))
  return enforcers
}

test('works!', async (t) => {
  const [enforcer1, enforcer2] = await pair(t)

  await enforcer1.addPolicy('admin', 'domain1', 'data1', 'read')
  await enforcer1.addPolicy('admin', 'domain2', 'data2', 'read')
  await enforcer1.addPolicy('admin', 'domain2', 'data2', 'write')
  await enforcer1.addGroupingPolicy('alice', 'admin', 'domain1')

  await sleep(500)

  t.is(await enforcer2.enforce('alice', 'domain1', 'data1', 'read'), true)
  t.is(await enforcer2.enforce('bob', 'domain2', 'data2', 'read'), false)

  await enforcer2.addGroupingPolicy('bob', 'admin', 'domain2')

  await sleep(500)

  t.is(await enforcer1.enforce('bob', 'domain2', 'data2', 'read'), true)
})

test('shutdown properly', async (t) => {
  // enforcer2 is ignored
  const [enforcer1] = await pair(t)

  await enforcer1.addPolicy('admin', 'domain1', 'data1', 'read')
  await enforcer1.addPolicy('admin', 'domain2', 'data2', 'read')
  await enforcer1.addPolicy('admin', 'domain2', 'data2', 'write')
  await enforcer1.addGroupingPolicy('alice', 'admin', 'domain1')

  t.is(await enforcer1.enforce('alice', 'domain1', 'data1', 'read'), true)
})

test('tracks closed properly', async (t) => {
  const watcher = await newWatcher({
    connectionString
  })
  t.is(watcher.closed, false)

  watcher.close()
  t.is(watcher.closed, true)
})

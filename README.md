# casbin-pg-watcher

A [casbin](https://github.com/casbin/node-casbin) watcher built on top of PosgreSQL NOTIFY.
A watcher have all other enforcer reload whenever a change to the policy happens.

## Example

```js
'use strict'

const { newEnforcer } = require('casbin')
const { newAdapter } = require('casbin-pg-adapter').default
const { newWatcher } = require('.')

const { join } = require('path')
const { promisify } = require('util')
const sleep = promisify(setTimeout)

const connectionString = 'postgresql://postgres:postgres@localhost:5432/postgres'

async function build (migrate) {
  const [adapter, watcher] = await Promise.all([
    newAdapter({
      connectionString,
      migrate
    }),
    newWatcher({
      connectionString
    })
  ])

  if (migrate) {
    await adapter.repo.clearPolicies()
  }

  const enforcer = await newEnforcer(join(__dirname, 'examples', 'model.conf'), adapter)
  enforcer.setWatcher(watcher)
  // my own property for tests
  enforcer.watcher = watcher
  return enforcer
}

async function pair () {
  const enforcers = [await build(true), await build(false)]
  await Promise.all(enforcers.map((e) => e.loadPolicy()))
  return enforcers
}

async function run () => {
  const [enforcer1, enforcer2] = await pair()

  await enforcer1.addPolicy('admin', 'domain1', 'data1', 'read')
  await enforcer1.addPolicy('admin', 'domain2', 'data2', 'read')
  await enforcer1.addPolicy('admin', 'domain2', 'data2', 'write')
  await enforcer1.addGroupingPolicy('alice', 'admin', 'domain1')

  await sleep(500)

  console.log(await enforcer2.enforce('alice', 'domain1', 'data1', 'read'))
  console.log(await enforcer2.enforce('bob', 'domain2', 'data2', 'read'))

  await enforcer2.addGroupingPolicy('bob', 'admin', 'domain2')

  await sleep(500)

  console.log(await enforcer1.enforce('bob', 'domain2', 'data2', 'read'))
})
```

## License

MIT

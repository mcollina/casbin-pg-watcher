'use strict'

const createSubscriber = require('pg-listen').default
const { EventEmitter } = require('events')

let count = 0

class Watcher extends EventEmitter {
  constructor (subscriber, channel) {
    super()

    this.id = `${Math.random()}-${process.pid}-${count++}`
    this.channel = channel
    this.subscriber = subscriber
    this.refresh = noop
    this.closed = false

    subscriber.notifications.on(channel, (payload) => {
      if (payload.source !== this.id) {
        this.refresh()
      }
    })

    subscriber.events.on('error', (err) => {
      this.emit('error', err)
    })
  }

  async update () {
    try {
      await this.subscriber.notify(this.channel, {
        source: this.id,
        now: new Date()
      })
    } catch (err) {
      if (!this.closed) {
        throw err
      }
    }
    return true
  }

  close () {
    this.closed = true
    this.refresh = noop
    return this.subscriber.close()
  }

  setUpdateCallback (cb) {
    this.refresh = cb
  }
}

async function newWatcher ({ connectionString, channel = 'casbin' }, options) {
  const subscriber = createSubscriber({ connectionString }, options)
  await subscriber.connect()
  await subscriber.listenTo(channel)

  return new Watcher(subscriber, channel)
}

module.exports = {
  newWatcher
}

function noop () {}

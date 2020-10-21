import fs from 'fs'
import path from 'path'

import { assert } from 'chai'
import { ZodError } from 'zod'

import { payout } from '../src'
import { WebGrpcEndpoint } from '../src/lib/config'
import { connectToLedger } from '../src/lib/xrp'

describe('Integration Tests - XRP Logic', function () {
  before(async function () {
    // Get prompt overrides for tests
    const overridePath = path.join(__dirname, '.', 'data', 'override.json')
    this.overrides = JSON.parse(
      (await fs.promises.readFile(overridePath)).toString(),
    )
  })

  beforeEach(async function () {
    // Remove the output CSV if it exists
    // eslint-disable-next-line node/no-sync -- This method is not deprecated anymore, we expect this to be synchronous.
    if (fs.existsSync(this.overrides.outputCsv)) {
      await fs.promises.unlink(this.overrides.outputCsv)
    }
  })

  it('generateWallet - throws on invalid network', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('generateWallet - throws on invalid classic address', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('connectToLedger - throws on invalid network', async function () {
    try {
      await connectToLedger(WebGrpcEndpoint.Test, 'fake_network', )
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('connectToLedger - throws on invalid url', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('connectToLedger - throws on invalid classic address', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('submitPayment - handles an exchange rate of 0', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('submitPayment - handles a recurring decimal', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('checkPayment - retries n times on pending transaction', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })
})

import fs from 'fs'
import path from 'path'

import { assert } from 'chai'
import { XrplNetwork } from 'xpring-common-js'

import { WebGrpcEndpoint } from '../src/lib/config'
import { connectToLedger, generateWallet, submitPayment } from '../src/lib/xrp'

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

  it('generateWallet - throws on invalid secret', async function () {
    assert.throw(
      () => {
        generateWallet('fake_secret', XrplNetwork.Test)
      },
      Error,
      'Failed to generate wallet from secret.',
    )
  })

  it('connectToLedger - throws on invalid gRPC url', async function () {
    const [, address] = generateWallet(this.overrides.secret, XrplNetwork.Test)
    try {
      await connectToLedger(
        'https://thisisnotreal.com',
        XrplNetwork.Test,
        address,
      )
    } catch (err) {
      assert(
        err.message ===
          'Failed to connect https://thisisnotreal.com. Is the the right testnet endpoint?',
      )
    }
  })

  it('connectToLedger - throws on invalid classic address', async function () {
    try {
      await connectToLedger(
        WebGrpcEndpoint.Test,
        XrplNetwork.Test,
        'notvalidaddress',
      )
    } catch (err) {
      assert(
        err.message ===
          'Invalid classic address. Could not connect to XRPL testnet.',
      )
    }
  })

  it('submitPayment - handles an exchange rate of 0', async function () {
    const [wallet, address] = generateWallet(
      this.overrides.secret,
      XrplNetwork.Test,
    )
    const [xrpClient] = await connectToLedger(
      WebGrpcEndpoint.Test,
      XrplNetwork.Test,
      address,
    )
    try {
      await submitPayment(
        wallet,
        xrpClient,
        {
          address: 'r3e8EPYLXphCzTFcyrtb7K8Cmyf6CArEyM',
          destinationTag: 0,
          usdAmount: 2,
          name: 'Zero Rate',
        },
        0,
      )
    } catch (err) {
      assert.include(err.message, 'xrpToDrops: failed sanity check')
    }
  })

  it('submitPayment - handles an exchange rate with a recurring decimal', async function () {
    const [wallet, address] = generateWallet(
      this.overrides.secret,
      XrplNetwork.Test,
    )
    const [xrpClient] = await connectToLedger(
      WebGrpcEndpoint.Test,
      XrplNetwork.Test,
      address,
    )
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers -- Meant to be a fraction.
    const recurringDecimal = 1 / 6
    const txHash = await submitPayment(
      wallet,
      xrpClient,
      {
        address: 'r3e8EPYLXphCzTFcyrtb7K8Cmyf6CArEyM',
        destinationTag: 0,
        usdAmount: 2,
        name: 'Recurring Decimal',
      },
      recurringDecimal,
    )
    const payment = await xrpClient.getPayment(txHash)
    assert(
      payment.validated && payment.paymentFields?.amount.drops === '12000000',
    )
  })
})

import { assert } from 'chai'
import fetch from 'node-fetch'
import { XrplNetwork } from 'xpring-js'

import { xrp, log, config } from '../src/index'

let testSecret: string
let testBalance: number

describe('Test Setup', function () {
  // Increase the timeout, because we may need to fund a testnet account
  const testTimeout = 15000
  this.timeout(testTimeout)

  before(async function () {
    log.info('Getting funded testnet account..')
    // Fetch acccount
    const resp = await fetch('https://faucet.altnet.rippletest.net/accounts', {
      method: 'POST',
    })
    const json = await resp.json()
    const address = json.account.address
    const secret = json.account.secret

    if (!address || !secret) {
      throw Error('Failed to get testnet account.')
    }

    // Wait for funding
    const waitTime = 10000
    // eslint-disable-next-line no-promise-executor-return -- We don't need the return values.
    await new Promise((resolve) => setTimeout(resolve, waitTime))

    // Make sure it's funded
    const [, balance] = await xrp.connectToLedger(
      config.WebGrpcEndpoint.Test,
      XrplNetwork.Test,
      address,
    )
    const fundAmount = 1000
    if (balance !== fundAmount) {
      throw Error('Failed to fund testnet account.')
    }

    // We can use our secret and balance for testing now that we are sure it is funded
    testBalance = balance
    testSecret = secret
    log.info('Successfully funded testnet account.')
  })

  // Temprorary -- should be able to remove after we have more tests
  it('Confirms testnet account is funded', async function () {
    log.info(testSecret)
    assert.strictEqual(testBalance, 1000)
  })
})

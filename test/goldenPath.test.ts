import fs from 'fs'
import path from 'path'

import { assert } from 'chai'
import { TransactionStatus } from 'xpring-js'

import { io, payout } from '../src'
import { txOutputSchema } from '../src/lib/schema'

import inputArray from './data/input'
import { getTestnetAccount } from './global.test'

// eslint-disable-next-line mocha/no-skipped-tests -- skip for now.
describe.skip('Integration Tests -- Golden Path', function () {
  before(async function () {
    // Get prompt overrides for tests
    const overridePath = path.join(__dirname, '.', 'data', 'override.json')
    this.overrides = JSON.parse(
      (await fs.promises.readFile(overridePath)).toString(),
    )

    const [secret, balance, xrpNetworkClient] = await getTestnetAccount(this)

    // Set the funded testnet account secret
    // Keep the balance and network client for tests
    this.testBalance = balance
    this.xrpNetworkClient = xrpNetworkClient
    this.overrides.secret = secret
  })

  beforeEach(async function () {
    // Remove the output CSV if it exists
    // eslint-disable-next-line node/no-sync -- This method is not deprecated anymore, we expect this to be synchronous.
    if (fs.existsSync(this.overrides.outputCsv)) {
      await fs.promises.unlink(this.overrides.outputCsv)
    }
  })

  it('Successfully completes the batch payout with valid inputs', async function () {
    // Increase the timeout because this is a long test
    const timeout = 30000
    this.timeout(timeout)

    // Run the batch payout script
    await payout(this.overrides)

    // Confirm the output CSV matches the schema and remove the output file
    const validatedOutput = await io.parseFromCsvToArray(
      fs.createReadStream(this.overrides.outputCsv),
      txOutputSchema,
    )

    // Confirm the output values are what we expect
    // And that all transactions were successful
    const pendingStatuses = validatedOutput.map(async (output, index) => {
      const txHash = output.transactionHash
      assert.deepStrictEqual(output, {
        ...inputArray[index],
        usdToXrpRate: this.overrides.usdToXrpRate,
        transactionHash: txHash,
      })
      return this.xrpNetworkClient.getPaymentStatus(txHash)
    })
    const resolvedStatuses = await Promise.all(pendingStatuses)
    resolvedStatuses.map((status) => {
      return assert(status === TransactionStatus.Succeeded)
    })
  })
})

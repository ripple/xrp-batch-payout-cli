import fs from 'fs'
import path from 'path'

import { assert } from 'chai'
import { TransactionMetadata } from 'xrpl'

import { io, payout } from '../src'
import { txOutputSchema } from '../src/lib/schema'

import inputArray from './data/input'
import { getTestnetAccount } from './global.test'

describe('Integration Tests -- Golden Path', function () {
  before(async function () {
    // Get prompt overrides for tests
    const overridePath = path.join(__dirname, '.', 'data', 'override.json')
    this.overrides = JSON.parse(
      (await fs.promises.readFile(overridePath)).toString(),
    )

    const [secret, balance, client] = await getTestnetAccount(this)

    // Set the funded testnet account secret
    // Keep the balance and network client for tests
    this.testBalance = balance
    this.client = client
    this.overrides.secret = secret
  })

  beforeEach(async function () {
    // Remove the output CSV if it exists
    if (fs.existsSync(this.overrides.outputCsv)) {
      await fs.promises.unlink(this.overrides.outputCsv)
    }
  })

  it('Successfully completes the batch payout with valid inputs', async function () {
    // Increase the timeout because this is a long test
    const timeout = 60000
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
    validatedOutput.map(async (output, index) => {
      const txHash = output.transactionHash
      assert.deepStrictEqual(output, {
        ...inputArray[index],
        usdToXrpRate: this.overrides.usdToXrpRate,
        transactionHash: txHash,
      })
      const txResponse = await this.client.request({
        command: 'tx',
        transaction: txHash,
      })
      assert(txResponse.result.validated)
      assert.equal(
        (txResponse.result.meta as TransactionMetadata).TransactionResult,
        'tesSUCCESS',
      )
    })
  })
})

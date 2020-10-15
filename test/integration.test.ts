import fs from 'fs'

import { assert } from 'chai'
import { TransactionStatus } from 'xpring-js'

import { io, payout } from '../src'
import { txOutputSchema } from '../src/lib/schema'

import inputArray from './data/input'

describe('Integration Tests', function () {
  it('Golden path - successfully completes the batch payout with valid inputs', async function () {
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
    await fs.promises.unlink(this.overrides.outputCsv)

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

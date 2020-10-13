/* eslint-disable max-lines-per-function -- This function is intended to be a script. */
/* eslint-disable no-await-in-loop -- Sequentially await inside of the for-loop for reliable send, so we disable this rule. */
// XRP payout script
import fs from 'fs'

import { questions, retryLimit } from '../lib/config'
import {
  parseFromCsvToArray,
  parseFromObjectToCsv,
  parseFromPromptToObject,
} from '../lib/io'
import log from '../lib/log'
import {
  TxInput,
  txInputSchema,
  senderInputSchema,
  SenderInput,
  txOutputSchema,
} from '../lib/schema'
import {
  connectToLedger,
  generateWallet,
  submitPayment,
  checkPayment,
} from '../lib/xrp'

/**
 * Run the XRP payout script.
 *
 * @param override - Override prompt inputs. Useful for testing and debugging.
 */
export default async function payout(override?: unknown): Promise<void> {
  try {
    // Prompt user to configure XRP payout and validate user input
    const senderInput = await parseFromPromptToObject<SenderInput>(
      questions,
      senderInputSchema,
      override,
    )

    // Cancel if user did not confirm payout
    if (!senderInput.confirmed) {
      throw Error('XRP payout stopped.')
    }

    // Parse and validate input CSV to get XRP transaction inputs
    const txInputReadStream = fs.createReadStream(senderInput.inputCsv)
    const txInputs = await parseFromCsvToArray<TxInput>(
      txInputReadStream,
      txInputSchema,
    )

    // Generate XRP wallet from secret
    const [wallet, classicAddress] = generateWallet(
      senderInput.secret,
      senderInput.network,
    )

    // Connect to XRPL
    const xrpNetworkClient = await connectToLedger(
      senderInput.grpcUrl,
      senderInput.network,
      classicAddress,
    )

    // Send XRP to accounts specified in txInputs
    // Use plain for-loop to make execution sequential because the Xpring SDK
    // cannot batch transactions (does not adjust the sequence number)
    const txOutputWriteStream = fs.createWriteStream(senderInput.outputCsv)
    for (const [index, txInput] of txInputs.entries()) {
      const txHash = await submitPayment(
        wallet,
        xrpNetworkClient,
        txInput,
        senderInput.usdToXrpRate,
      )
      // Reliable send - guarantee success or throw an error.
      // Don't continue unless we have the guarantee
      // that the payment is successful
      await checkPayment(xrpNetworkClient, txHash, retryLimit, 0)

      // Transform transaction input to output
      const txOutput = {
        ...txInput,
        transactionHash: txHash,
        usdToXrpRate: senderInput.usdToXrpRate,
      }

      // Write transaction output to CSV, only use headers on first input
      parseFromObjectToCsv(
        txOutputWriteStream,
        txOutputSchema,
        txOutput,
        index === 0,
      )

      log.info('XRP payout complete.')
    }
  } catch (err) {
    log.error(err)
  }
}

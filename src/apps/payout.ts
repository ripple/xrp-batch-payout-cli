/* eslint-disable max-lines-per-function -- This file is intended to be a
script or an 'app', so we moved all of the logging to here, which makes this
function long, but not particularly complex. */
// XRP payout script
import fs from 'fs'

import { questions, retryLimit } from '../lib/config'
import { parseFromCsvToArray, parseFromPromptToObject } from '../lib/io'
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
  reliableBatchPayment,
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
    log.info(`Parsing data from ${senderInput.inputCsv}..`)
    const txInputReadStream = fs.createReadStream(senderInput.inputCsv)
    const txInputs = await parseFromCsvToArray<TxInput>(
      txInputReadStream,
      txInputSchema,
    )
    log.info(`Parsed and validated ${txInputs.length} entries.`)

    // Generate XRP wallet from secret
    log.info(`Generating ${senderInput.network} wallet from secret..`)
    const [wallet, classicAddress] = generateWallet(
      senderInput.secret,
      senderInput.network,
    )
    log.info('Generated wallet from secret.')
    log.info(`  -> Sender XRPL X-Address: ${wallet.getAddress()}`)
    log.info(`  -> Sender XRPL Classic address: ${classicAddress}`)

    // Connect to XRPL
    log.info(`Connecting to XRPL ${senderInput.network}..`)
    const [xrpNetworkClient, balance] = await connectToLedger(
      senderInput.grpcUrl,
      senderInput.network,
      classicAddress,
    )
    log.info(`Connected to XRPL ${senderInput.network}.`)
    log.info(`  -> RippleD node web gRPC endpoint: ${senderInput.grpcUrl}`)
    log.info(`  -> ${classicAddress} balance: ${balance} XRP`)

    // Reliably send XRP to accounts specified in transaction inputs
    const txOutputWriteStream = fs.createWriteStream(senderInput.outputCsv)
    await reliableBatchPayment(
      txInputs,
      txOutputWriteStream,
      txOutputSchema,
      wallet,
      xrpNetworkClient,
      senderInput.usdToXrpRate,
      retryLimit,
    )
    log.info(
      `Batch payout complete succeeded. Reliably sent ${txInputs.length} XRP payments.`,
    )
  } catch (err) {
    log.error(err)
  }
}

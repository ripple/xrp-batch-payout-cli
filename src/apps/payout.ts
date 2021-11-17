/* eslint-disable max-lines-per-function -- This file is intended to be a
script or an 'app', so we moved all of the logging to here, which makes this
function long, but not particularly complex. */
// XRP payout script
import fs from 'fs'

import {Wallet, Client} from 'xrpl'
import { ZodError } from 'zod'

import { questions } from '../lib/config'
import { parseFromCsvToArray, parseFromPromptToObject } from '../lib/io'
import log, { green, black, red } from '../lib/log'
import {
  TxInput,
  txInputSchema,
  senderInputSchema,
  SenderInput,
  txOutputSchema,
} from '../lib/schema'
import reliableBatchPayment from '../lib/xrp'

/**
 * Run the XRP payout script.
 *
 * @param override - Override prompt inputs. Useful for testing and debugging.
 * @throws Re-throws error after logging.
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
      throw Error(red('XRP batch payout stopped.'))
    }

    log.info('Starting XRP batch payout..')

    // Parse and validate input CSV to get XRP transaction inputs
    log.info('')
    log.info(`Parsing data from ${senderInput.inputCsv}..`)
    const txInputReadStream = fs.createReadStream(senderInput.inputCsv)
    const txInputs = await parseFromCsvToArray<TxInput>(
      txInputReadStream,
      txInputSchema,
    )
    log.info(green(`Parsed and validated ${txInputs.length} entries.`))

    // Generate XRP wallet from secret
    log.info('')
    log.info(`Generating ${senderInput.network} wallet from secret..`)

    const wallet = Wallet.fromSecret(senderInput.secret)
    log.info(green('Generated wallet from secret.'))
    log.info(black(`  -> Sender XRPL X-Address: ${wallet.getXAddress()}`))
    log.info(black(`  -> Sender XRPL Classic address: ${wallet.classicAddress}`))

    // Connect to XRPL
    log.info('')
    log.info(`Connecting to XRPL ${senderInput.network}..`)
    
    log.info(green(`Connected to XRPL ${senderInput.network}.`))
    log.info(
      black(`  -> RippleD node web gRPC endpoint: ${senderInput.grpcUrl}`),
    )

    const client = new Client(senderInput.grpcUrl)
    await client.connect()
    log.info(green('Connected'))
    
    const balance = await client.getXrpBalance(wallet.classicAddress)
    log.info(black(`  -> ${wallet.classicAddress} balance: ${balance} XRP`))

    // Reliably send XRP to accounts specified in transaction inputs
    const txOutputWriteStream = fs.createWriteStream(senderInput.outputCsv)
    await reliableBatchPayment(
      txInputs,
      txOutputWriteStream,
      txOutputSchema,
      wallet,
      client,
      senderInput.usdToXrpRate,
    )

    log.info('')
    log.info(
      green(
        `Batch payout complete succeeded. Reliably sent ${txInputs.length} XRP payments.`,
      ),
    )
    await client.disconnect();

  } catch (err) {
    if (err instanceof ZodError) {
      log.error(err.errors)
    } else {
      log.error(err)
    }
    throw err
  }
}

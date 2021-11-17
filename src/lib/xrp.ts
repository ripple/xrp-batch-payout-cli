/* eslint-disable @typescript-eslint/naming-convention -- Payment object expects fields as they are. */
/* eslint-disable max-lines-per-function -- Triggered by log statements, so we ignore this. */
/* eslint-disable no-await-in-loop -- We want sequential execution when submitting the XRP payments in reliableBatchPayment. */
// XRP logic - connect to XRPL and reliably send a payment
import fs from 'fs'

import { Wallet, Client, Payment, xrpToDrops} from 'xrpl'
import * as z from 'zod'

import { parseFromObjectToCsv } from './io'
import log, { green, black } from './log'
import { TxInput, TxOutput } from './schema'

/**
 * Reliably send a batch of XRP payments from an array of transaction inputs.
 * If any payment fails, exit. As payments succeed, write the output to a CSV.
 * This guarantees that if any payment fails, we will still have a log of
 * succeeded payments (and of course if all payments succeed we will have a
 * log as well).
 *
 * @param txInputs - An array of validated transaction inputs to send payments.
 * @param txOutputWriteStream - The write stream.
 * @param txOutputSchema - The output schema.
 * @param senderWallet - The sender wallet.
 * @param xrpClient - The XRP network client.
 * @param usdToXrpRate - The price of XRP in USD.
 */
// eslint-disable-next-line max-params -- Keep regular parameters for a simpler type signature.
async function reliableBatchPayment(
  txInputs: TxInput[],
  txOutputWriteStream: fs.WriteStream,
  txOutputSchema: z.Schema<TxOutput>,
  senderWallet: Wallet,
  xrpClient: Client,
  usdToXrpRate: number,
): Promise<void> {
  for (const [index, txInput] of txInputs.entries()) {
    // Submit payment
    log.info('')
    log.info(
      `Submitting ${index + 1} / ${txInputs.length} payment transactions..`,
    )
    log.info(black(`  -> Name: ${txInput.name}`))
    log.info(black(`  -> Receiver classic address: ${txInput.address}`))
    log.info(black(`  -> Destination tag: ${txInput.destinationTag ?? 'null'}`))
    // const xrpPrecision = 6
    log.info(
      black(
        `  -> Amount: ${xrpToDrops(txInput.usdAmount / usdToXrpRate)} XRP valued at $${txInput.usdAmount}`,
      ),
    )

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: senderWallet.classicAddress,
      Amount: xrpToDrops(txInput.usdAmount / usdToXrpRate),
      Destination: txInput.address,
    }
    if(txInput.destinationTag){
      paymentTx.DestinationTag = txInput.destinationTag;
    }
    const response = await xrpClient.submitAndWait(
      paymentTx, 
      {wallet: senderWallet}
    )

    log.info(
      green('Transaction successfully validated. Your money has been sent.'),
    )
    log.info(black(`  -> Tx hash: ${response.result.hash}`))

    // Transform transaction input to output
    const txOutput = {
      ...txInput,
      transactionHash: response.result.hash,
      usdToXrpRate,
    }

    // Write transaction output to CSV, only use headers on first input
    const csvData = parseFromObjectToCsv(
      txOutputWriteStream,
      txOutputSchema,
      txOutput,
      index === 0,
    )
    log.info(`Wrote entry to ${txOutputWriteStream.path as string}.`)
    log.debug(black(`  -> ${csvData}`))
    log.info(green('Transaction successfully validated and recorded.'))
  }
}

export default reliableBatchPayment
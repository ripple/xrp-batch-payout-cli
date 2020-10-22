/* eslint-disable import/max-dependencies -- We are 1 over here, and a refactor doesn't make sense. */
/* eslint-disable max-statements -- Triggered by log statements, so we ignore this. */
/* eslint-disable max-lines-per-function -- Triggered by log statements, so we ignore this. */
/* eslint-disable no-await-in-loop -- We want sequential execution when submitting the XRP payments in reliableBatchPayment. */
// XRP logic - connect to XRPL and reliably send a payment
import fs from 'fs'

import { WalletFactory } from 'xpring-common-js'
import {
  XrpClient,
  XrplNetwork,
  XrpUtils,
  Wallet,
  TransactionStatus,
} from 'xpring-js'
import { XrpErrorType } from 'xpring-js/build/XRP'
import * as z from 'zod'

import { retryLimit } from './config'
import { parseFromObjectToCsv } from './io'
import log, { green, black } from './log'
import { TxInput, TxOutput } from './schema'

/**
 * Connect to the XRPL network.
 *
 * @param grpcUrl - The web gRPC endpoint of the rippleD node.
 * @param network - The XRPL network (devnet/testnet/mainnet).
 * @param classicAddress - The sender's XRP classic address.
 *
 * @throws Re-throws more informative errors connection failure.
 * @returns A decorated XRPL network client along with the provided address'
 * balance.
 */
export async function connectToLedger(
  grpcUrl: string,
  network: XrplNetwork,
  classicAddress: string,
): Promise<[XrpClient, number]> {
  let xrpClient: XrpClient
  let balance: number
  try {
    // `true` uses the web gRPC endpoint, which is currently more reliable
    xrpClient = new XrpClient(grpcUrl, network, true)
    const xAddress = XrpUtils.encodeXAddress(classicAddress, 0) as string
    // Get balance in XRP - network call validates that we are connected to the ledger
    balance = parseFloat(
      XrpUtils.dropsToXrp((await xrpClient.getBalance(xAddress)).valueOf()),
    )
  } catch (err) {
    // Rethrow xpring-js errors in favor of something more helpful
    if (err.errorType === XrpErrorType.XAddressRequired) {
      throw Error(
        `Invalid classic address. Could not connect to XRPL ${network}.`,
      )
    } else if (err.message === 'Http response at 400 or 500 level') {
      throw Error(
        `Failed to connect ${grpcUrl}. Is the the right ${network} endpoint?`,
      )
    } else {
      throw err
    }
  }

  return [xrpClient, balance]
}

/**
 * Generate a seed wallet from an XRPL secret.
 *
 * @param secret - XRPL secret.
 * @param network - XRPL network (devnet/testnet/mainnet).
 *
 * @returns XRPL seed wallet and classic address.
 * @throws Error if wallet and addresses cannot be generated properly.
 */
export function generateWallet(
  secret: string,
  network: XrplNetwork,
): [Wallet, string] {
  const wallet = new WalletFactory(network).walletFromSeed(secret)
  // Casting allowed because we validate afterwards
  const xAddress = wallet?.getAddress() as string
  const classicAddress = XrpUtils.decodeXAddress(xAddress)?.address as string

  // Validate wallet generated successfully
  if (
    !wallet ||
    !XrpUtils.isValidXAddress(xAddress) ||
    !XrpUtils.isValidClassicAddress(classicAddress)
  ) {
    throw Error('Failed to generate wallet from secret.')
  }

  // Xpring-JS recommends using WalletFactory to generate addresses
  // but the Wallet object returned is incompatible with the Wallet
  // object that is expected by XrplClient.send()
  // So we cast to the appropriate object
  return [(wallet as unknown) as Wallet, classicAddress]
}

/**
 * Submit an XRP payment transaction to the ledger.
 *
 * @param senderWallet - Sender's XRP wallet.
 * @param xrpClient - XRPL network client.
 * @param receiverAccount - Receiver account object.
 * @param usdToXrpRate - USD to XRP exchange rate.
 *
 * @returns Tx hash if payment was submitted.
 * @throws If the transaction fails.
 */
export async function submitPayment(
  senderWallet: Wallet,
  xrpClient: XrpClient,
  receiverAccount: TxInput,
  usdToXrpRate: number,
): Promise<string> {
  // Set up payment
  const {
    address: destinationClassicAddress,
    destinationTag,
    usdAmount,
  } = receiverAccount
  const destinationXAddress = XrpUtils.encodeXAddress(
    destinationClassicAddress,
    destinationTag ?? undefined,
  ) as string
  const xrpDestinationAmount = usdAmount / usdToXrpRate
  const dropDestinationAmount = XrpUtils.xrpToDrops(xrpDestinationAmount)

  // Submit payment
  const txHash = await xrpClient.send(
    dropDestinationAmount,
    destinationXAddress,
    senderWallet,
  )

  return txHash
}

/**
 * Check payment for success. Re-tries pending transactions until failure limit.
 * Throws an error on unresolved pending txs or tx failures.
 *
 * @param xrpClient - XRPL network client.
 * @param txHash - XRPL transaction hash.
 * @param numRetries - Number of times to retry on a pending tx. Defaults to 3.
 * @param index - Index for recursion, should stay at default of 0.
 *
 * @returns True on success. False should never be returned - this would
 * indicate that there has been a change to transactions statuses on XRPL.
 * @throws Error if transaction failed or is unknown.
 */
export async function checkPayment(
  xrpClient: XrpClient,
  txHash: string,
  numRetries: number,
  index = 0,
): Promise<boolean> {
  log.info(
    `Checking that tx has been validated.. (${
      index + 1
    } / ${numRetries} retries)`,
  )
  const txStatus = await xrpClient.getPaymentStatus(txHash)
  if (txStatus === TransactionStatus.Succeeded) {
    return true
  }
  if (txStatus === TransactionStatus.Pending) {
    if (index + 1 >= numRetries) {
      throw Error(
        `Retry limit of ${numRetries} reached. Transaction still pending.`,
      )
    }
    const newIndex = index + 1
    await checkPayment(xrpClient, txHash, newIndex, retryLimit)
  } else if (
    txStatus === TransactionStatus.Failed ||
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Choosing to be verbose about status.
    txStatus === TransactionStatus.Unknown
  ) {
    throw Error('Transaction failed.')
  }

  return false
}

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
 * @param numRetries - The amount of times to retry a pending payment.
 */
// eslint-disable-next-line max-params -- Keep regular parameters for a simpler type signature.
export async function reliableBatchPayment(
  txInputs: TxInput[],
  txOutputWriteStream: fs.WriteStream,
  txOutputSchema: z.Schema<TxOutput>,
  senderWallet: Wallet,
  xrpClient: XrpClient,
  usdToXrpRate: number,
  numRetries: number,
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
    log.info(
      black(
        `  -> Amount: ${txInput.usdAmount / usdToXrpRate} XRP valued at $${
          txInput.usdAmount
        }`,
      ),
    )
    const txHash = await submitPayment(
      senderWallet,
      xrpClient,
      txInput,
      usdToXrpRate,
    )
    log.info('Submitted payment transaction.')
    log.info(black(`  -> Tx hash: ${txHash}`))

    // Only continue if the payment was successful, otherwise throw an error
    await checkPayment(xrpClient, txHash, numRetries)
    log.info(
      green('Transaction successfully validated. Your money has been sent.'),
    )
    log.info(black(`  -> Tx hash: ${txHash}`))

    // Transform transaction input to output
    const txOutput = {
      ...txInput,
      transactionHash: txHash,
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

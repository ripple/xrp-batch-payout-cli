/* eslint-disable import/max-dependencies -- Need 1 more dependency in this file, and a refactor is unnecessary. */
import fs from 'fs'

// XRP logic - connect to XRPL and reliably send a payment
import { WalletFactory } from 'xpring-common-js'
import xrpUtils from 'xpring-common-js/build/src/XRP/xrp-utils'
import {
  XrpClient,
  XrplNetwork,
  XrpUtils,
  Wallet,
  TransactionStatus,
} from 'xpring-js'
import * as z from 'zod'

import { retryLimit } from './config'
import { parseFromObjectToCsv } from './io'
import log from './log'
import { TxInput, TxOutput } from './schema'

/**
 * Connect to the XRPL network.
 *
 * @param grpcUrl - The web gRPC endpoint of the rippleD node.
 * @param network - The XRPL network (devnet/testnet/mainnet).
 * @param classicAddress - The sender's XRP classic address.
 *
 * @returns A decorated XRPL network client.
 */
export async function connectToLedger(
  grpcUrl: string,
  network: XrplNetwork,
  classicAddress: string,
): Promise<XrpClient> {
  log.info(`Connecting to the XRPL ${network}..`)
  // `true` uses the web gRPC endpoint, which is currently more reliable
  const xrpClient = new XrpClient(grpcUrl, network, true)
  const xAddress = xrpUtils.encodeXAddress(classicAddress, 0) as string
  // Get balance in XRP - network call validates that we are connected to the ledger
  const balance = XrpUtils.dropsToXrp(
    (await xrpClient.getBalance(xAddress)).valueOf(),
  )
  log.info(`Connected to the XRPL ${network}.`)
  log.info(`  -> RippleD node web gRPC endpoint: ${grpcUrl}`)
  log.info(`  -> Sender address (${classicAddress}) balance: ${balance} XRP`)

  return xrpClient
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
  log.info(`Generating ${network} wallet from secret..`)
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

  log.info('Generated wallet from secret.')
  log.info(`  -> Sender XRPL X-Address: ${xAddress}`)
  log.info(`  -> Sender XRPL Classic address: ${classicAddress}`)

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
    name,
  } = receiverAccount
  const destinationXAddress = XrpUtils.encodeXAddress(
    destinationClassicAddress,
    destinationTag ?? undefined,
  ) as string
  const xrpDestinationAmount = usdAmount / usdToXrpRate
  const dropDestinationAmount = XrpUtils.xrpToDrops(xrpDestinationAmount)

  // Submit payment
  log.info('Submitting payment transaction..')
  log.info(`  -> Name: ${name}`)
  log.info(`  -> Classic address: ${destinationClassicAddress}`)
  log.info(`  -> Destination tag: ${destinationClassicAddress}`)
  log.info(`  -> Amount: ${xrpDestinationAmount} XRP valued at $${usdAmount}`)
  const txHash = await xrpClient.send(
    dropDestinationAmount,
    destinationXAddress,
    senderWallet,
  )
  log.info('Submitted payment transaction.')
  log.info(`  -> Tx hash: ${txHash}`)

  return txHash
}

/**
 * Check payment for success. Re-tries pending transactions until failure limit.
 * Throws an error on unresolved pending txs or tx failures.
 *
 * @param xrpClient - XRPL network client.
 * @param txHash - XRPL transaction hash.
 * @param numRetries - Number of times to retry on a pending tx. Default is 3.
 * @param index - Index for recursion, should stay at default of 0.
 *
 * @returns XRPL transaction hash.
 * @throws Error if transaction failed or is unknown.
 */
export async function checkPayment(
  xrpClient: XrpClient,
  txHash: string,
  numRetries = retryLimit,
  index = 0,
): Promise<void> {
  log.info(
    `Checking that tx has been validated.. (${
      index + 1
    }/${numRetries} retries)`,
  )
  const txStatus = await xrpClient.getPaymentStatus(txHash)
  if (txStatus === TransactionStatus.Succeeded) {
    log.info('Transaction successfully validated. Your money has been sent.')
    log.info(`  -> Tx hash: ${txHash}`)
  } else if (txStatus === TransactionStatus.Pending) {
    if (index >= numRetries) {
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
}

/**
 * Reliably send a batch of XRP payments from an array of transaction inputs.
 * If any payment fails, exit. As payments succeed, write the output to a CSV.
 * This guarantees that if any payment fails, we will still have a log of
 * succeeded payments (and of course if all payments succeed we will have a
 * log as well).
 *
 * @param txInputs - An array of validated transaction inputs to send payments.
 * @param txOutputWriteStream - The write stream .
 * @param txOutputSchema - The output schema.
 * @param senderWallet - The sender wallet.
 * @param xrpClient - The XRP network client.
 * @param usdToXrpRate - The price of XRP in USD.
 */
// eslint-disable-next-line max-params -- Keep regular parameters for a simpler type signature.
export async function reliableBatchPayment(
  txInputs: TxInput[],
  txOutputWriteStream: fs.WriteStream,
  txOutputSchema: z.Schema<TxOutput>,
  senderWallet: Wallet,
  xrpClient: XrpClient,
  usdToXrpRate: number,
): Promise<void> {
  for (const [index, txInput] of txInputs.entries()) {
    // eslint-disable-next-line no-await-in-loop -- We want sequential execution in this loop.
    const txHash = await submitPayment(
      senderWallet,
      xrpClient,
      txInput,
      usdToXrpRate,
    )
    // Reliable send - guarantee success or throw an error.
    // Don't continue unless we have the guarantee
    // that the payment is successful
    // eslint-disable-next-line no-await-in-loop -- We want sequential execution in this loop.
    await checkPayment(xrpClient, txHash, retryLimit, 0)

    // Transform transaction input to output
    const txOutput = {
      ...txInput,
      transactionHash: txHash,
      usdToXrpRate,
    }

    // Write transaction output to CSV, only use headers on first input
    parseFromObjectToCsv(
      txOutputWriteStream,
      txOutputSchema,
      txOutput,
      index === 0,
    )
  }

  log.info(
    `Batch payout complete succeeded. Reliably sent ${txInputs.length} XRP payments.`,
  )
}

#!/usr/bin/env node

const fs = require('fs')
const { payout } = require('../build/src/index')
const { program } = require('commander')
const package = require('../package.json')

// Example prompt override object for help output
const exampleOverrides = {
  // The input CSV path. Should point to a file that contains the receiver's
  // XRP details.
  inputCsv: "input.csv",
  // The output CSV path. Will be generated after xrp-batch-payout-cli is complete.
  outputCsv: "output.csv",
  // The XRPL network. Either 'testnet' or 'mainnet'.
  network: "mainnet",
  // The web gRPC endpoint for the rippleD node.
  grpcUrl: "https://envoy.main.xrp.xpring.io",
  // The max fee to allow for a transaction (this is a ceiling, not the actual
  // fee consumed in most cases).
  maxFee: 0.01,
  // The price of 1 XRP in USD. The exchange rate at which to execute the
  // dollar denominated transactions in the input CSV.
  usdToXrpRate: 0.25,
  // The XRP wallet seed. Used to generate the local wallet to sign
  // transactions (the wallet and seed only exist ephemerally in memory
  // while running the payout).
  secret: "shBfYr5iEzQWJkCraTESe2FeiPo4e",
  // Confirmation prompt output. Indicates whether to start or cancel
  // the payout.
  confirmed: true
}

// Basic CLI usage for node script + accept user input
program
  .name(package.name)
  .version(package.version)
  .option('-f, --file <path>', 'JSON file that contains prompt overrides')
  .on('--help', () => {
    console.log('')
    console.log('Prompt overrides help:')
    console.log('  inputCsv - The input CSV path. Should point to a file that contains the receiver\'s XRP details.')
    console.log('  outputCsv - The output CSV path. Will be generated after xrp-batch-payout-cli is complete.')
    console.log('  network - The XRPL network. Either \'testnet\' or \'mainnet\'.')
    console.log('  grpcUrl - The web gRPC endpoint for the rippleD node.')
    console.log('  usdToXrpRate - The price of 1 XRP in USD.')
    console.log('  secret - The XRP wallet seed. Used to generate an ephemeral wallet to locally sign transactions.')
    console.log('  confirmed - The confirmation status. Indicates whether to start or cancel the payout.')
    console.log('')
    console.log('Example prompt overrides object:')
    console.log(JSON.stringify(exampleOverrides, null, 2))
  })
  .parse(process.argv)

// Get overrides if the file path is set
let overrides
if (fs.existsSync(program.file)) {
  overrides = JSON.parse((fs.readFileSync(program.file)).toString())
}

// Start XRP payout
payout(overrides)

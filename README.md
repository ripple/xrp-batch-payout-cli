# xrp-batch-payout

A library and command-line tool for batched, reliable payouts with XRP.

## Getting Started

### NPM (recommended)

1. `npm install xrp-batch-payout -g` (as a command-line tool)
1. OR `npm install xrp-batch-payout` (as a library for an existing project)
1. `xrp-batch-payout` (run command-line tool)

### Git (for development)

1. `git clone https://github.com/ripple/xrp-batch-payout.git`
2. `cd xrp-batch-payout`
3. `npm install`
4. `npm run build`
5. `node bin/index.js` (run command-line tool)

## Usage

### As a Command-Line Tool

```
Usage: xrp-batch-payout [options]

Options:
  -V, --version      output the version number
  -f, --file <path>  JSON file that contains prompt overrides
  -h, --help         display help for command

Prompt overrides help:
  inputCsv - The input CSV path. Should point to a file that contains the receiver's XRP details.
  outputCsv - The output CSV path. Will be generated after xrp-batch-payout is complete.
  network - The XRPL network. Either 'testnet' or 'mainnet'.
  grpcUrl - The web gRPC endpoint for the rippleD node.
  usdToXrpRate - The price of 1 XRP in USD.
  secret - The XRP wallet seed. Used to generate an ephemeral wallet to locally sign transactions.
  confirmed - The confirmation status. Indicates whether to start or cancel the payout.

Example prompt overrides object:
{
  "inputCsv": "input.csv",
  "outputCsv": "output.csv",
  "network": "mainnet",
  "grpcUrl": "https://envoy.main.xrp.xpring.io",
  "maxFee": 0.01,
  "usdToXrpRate": 0.25,
  "secret": "shBfYr5iEzQWJkCraTESe2FeiPo4e",
  "confirmed": true
}
```

### As a Library

This repo is also a library/npm module that gives you access to:

- Generic primitives for reading/parsing/validating I/O from a command-line prompt or file
- Generic primitives for sending reliable XRP payments, and batch payments
- Well defined schemas for validation (can easily add your own for custom use cases)

All of these functions are exported via `src/index.ts`, and accessible in via Javascript or Typescript.

## Features

- Guaranteed success for each payment, or application exits, so there can be no non-sequential partial successes
  - If a payment succeeds (both validated by the ledger and successful), the payment is recorded to the output file, and the batch payout continues
  - If a payment fails, the application exits, and the output for that payment is not recorded to the output file
  - If a payment is pending, the application retries and if it cannot guarantee success it exits, and the payment is not recorded to the output file
- Strict validation on files and user input
  - Minimizes chances of payment failure due to validation error by failing fast

## Documentation

To see library/code documentation, run the following from within the `xrp-batch-payout` repo:

1. `npm run generateDocs`
2. Open `docs/index.html` in a browser.

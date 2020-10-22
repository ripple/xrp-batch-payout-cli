# xrp-batch-payout

A library and command-line tool for batched, reliable payouts with XRP.

## Installation
<!-- Add NPM instructions once we open source. -->
### Git
1. `git clone https://github.com/ripple/xrp-batch-payout.git`
2. `cd xrp-batch-utils`
3. `npm install`
4. `npm run build`

## Usage
<!-- Add NPM instructions once we open source. -->
### As a Command-Line Tool
To run the command line tool:
1. `cd xrp-batch-payout`
2. `node bin/index.js`
```
Usage: node bin/index.js [options]

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
  "inputCsv": "./input.csv",
  "outputCsv": "./output.csv",
  "network": "mainnet",
  "grpcUrl": "https://envoy.main.xrp.xpring.io",
  "maxFee": 0.01,
  "usdToXrpRate": 0.25,
  "secret": "shBfYr5iEzQWJkCraTESe2FeiPo4e",
  "confirmed": true
}
```

### As a Library
This repo is also a library that gives you access to:
- Generic primitives for reading/parsing/validating I/O from a command-line prompt or file
- Generic primitives for sending reliable XRP payments, and batch payments
- Well defined schemas for validation (can easily add your own for custom use cases)

## Documentation
To see documentation, run the following from within the `xrp-batch-payout` repo:
1. `npm run generateDocs`
2. Open `docs/index.html` in a browser.

#!/usr/bin/env node

const fs = require('fs')
const { payout } = require('../build/src/index')
const { program } = require('commander')
const package = require('../package.json')

// Example prompt override object for help output
const exampleOverrides = {
  inputCsv: "./input.csv",
  outputCsv: "./output.csv",
  network: "mainnet",
  grpcUrl: "https://envoy.main.xrp.xpring.io",
  maxFee: 0.01,
  usdToXrpRate: 0.25,
  secret: "shBfYr5iEzQWJkCraTESe2FeiPo4e",
  confirmed: true
}

// Basic CLI usage for node script + accept user input
program
  .name(package.name)
  .version(package.version)
  .option('-f, --file <path>', 'JSON file that contains prompt overrides')
  .on('--help', () => {
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

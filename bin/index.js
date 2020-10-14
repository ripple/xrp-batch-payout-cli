#!/usr/bin/env node

const fs = require('fs')
const { payout } = require('../build/src/index')
const { program } = require('commander')
const package = require('../package.json')

// Basic CLI usage for node script + accept user input
program
  .name(package.name)
  .version(package.version)
  .option('-f, --file <path>', 'JSON file that contains prompt overrides')
  .parse(process.argv)

// Get overrides if the file path is set
let overrides
if (fs.existsSync(program.file)) {
  overrides = JSON.parse(fs.readFileSync(program.file))
}

// Start XRP payout
payout(overrides)

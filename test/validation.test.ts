import fs from 'fs'
import path from 'path'

import { assert } from 'chai'
import { ZodError } from 'zod'

import { payout } from '../src'

// The main focus of these tests is malformatted CSV input, as
// we don't want a successful payments run to be triggered, but malformatted
// output to be generated
describe('Integration Tests - Input Validation', function () {
  before(async function () {
    // Get prompt overrides for tests
    const overridePath = path.join(__dirname, '.', 'data', 'override.json')
    this.overrides = JSON.parse(
      (await fs.promises.readFile(overridePath)).toString(),
    )
  })

  beforeEach(async function () {
    // Remove the output CSV if it exists
    // eslint-disable-next-line node/no-sync -- This method is not deprecated anymore, we expect this to be synchronous.
    if (fs.existsSync(this.overrides.outputCsv)) {
      await fs.promises.unlink(this.overrides.outputCsv)
    }
  })

  it('Throws on an input CSV that does not exist', async function () {
    this.overrides.inputCsv = './file_does_not_exist'
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'inputCsv')
    }
  })

  it('Throws on an input CSV containing a malformatted classic address', async function () {
    const inputCsvPath = path.join(
      __dirname,
      '.',
      'data',
      'malformatted',
      'bad_address.csv',
    )
    this.overrides.inputCsv = inputCsvPath
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'address')
    }
  })

  it('Throws on an input CSV with a missing name', async function () {
    const inputCsvPath = path.join(
      __dirname,
      '.',
      'data',
      'malformatted',
      'missing_name.csv',
    )
    this.overrides.inputCsv = inputCsvPath
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'name')
    }
  })

  it('Throws on an input CSV with a bad destination tag', async function () {
    const inputCsvPath = path.join(
      __dirname,
      '.',
      'data',
      'malformatted',
      'bad_tag.csv',
    )
    this.overrides.inputCsv = inputCsvPath
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].path[0] === 'destinationTag')
    }
  })

  it('Throws on input CSV with malformatted headers', async function () {
    const inputCsvPath = path.join(
      __dirname,
      '.',
      'data',
      'malformatted',
      'bad_header.csv',
    )
    this.overrides.inputCsv = inputCsvPath
    try {
      await payout(this.overrides)
    } catch (err) {
      assert(err instanceof ZodError)
      assert(err.errors[0].code === 'unrecognized_keys')
      assert(err.errors[0].keys[0] === 'destinationTg')
      assert(err.errors[1].path[0] === 'destinationTag')
    }
  })
})

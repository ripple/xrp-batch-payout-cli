// I/O logic - user prompts, validation, read/write CSV
import fs from 'fs'

import { parse, unparse, ParseResult } from 'papaparse'
import prompts from 'prompts'
import * as z from 'zod'

import log from './log'
import { validateObjects } from './schema'

/**
 * Parse CSV to an array of objects and validate against a schema.
 *
 * @param stream - A read stream.
 * @param schema - The schema to validate the parsed CSV input array.
 *
 * @returns An array of objects where CSV headers are the keys
 * and rows entries are the fields.
 * @throws If there are parsing or validation errors.
 */
export async function parseFromCsvToArray<T>(
  stream: fs.ReadStream,
  schema: z.Schema<T>,
): Promise<T[]> {
  log.info(`Parsing data from ${stream.path as string}..`)
  const result: ParseResult<T> = await new Promise((complete, error) => {
    parse(stream, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete,
      error,
    })
  })

  // Check for parsing errors
  if (result.errors.length > 0 || result.meta.aborted) {
    throw Error(`Failed to parse: ${JSON.stringify(result.errors)}`)
  }

  // Validate parsed output against schema
  const validatedOutput = validateObjects(result.data, schema)
  log.info(`Parsed and validated ${validatedOutput.length} entries.`)

  return validatedOutput
}

/**
 * Prompt the user with a set of questions on the command-line, validate the
 * user inputs against a schema, and return the answers.
 *
 * @param questions - Array of questions of the format accepted by `prompts`.
 * @param schema - The answer schema to validate user answers.
 * @param preAnswers - Pre-determined answers to override questions.
 *
 * @returns Object containing user-inputted answers to questions.
 * @throws Error if answers cannot be parsed against the schema.
 */
export async function parseFromPromptToObject<T>(
  questions: prompts.PromptObject[],
  schema: z.Schema<T>,
  preAnswers?: unknown,
): Promise<T> {
  // If the user supplies pre-answers, parse them against a schema to
  // check for valid inputs and override to avoid prompt questions
  if (preAnswers) {
    prompts.override(schema.parse(preAnswers))
  }
  // If user answers prompt questions, parse them against a schema
  // to check for valid inputs
  const answers = schema.parse(await prompts(questions))

  return answers
}

/**
 * Parse and validate an object against a schema and write to CSV.
 *
 * @param stream - A CSV write stream.
 * @param schema - The schema to validate the input data against.
 * @param data - The input object to validate and write to CSV.
 * @param header - A boolean indicating whether we want to keep headers.
 *
 * @returns Csv output.
 * @throws Throws on failure to write csv data.
 */
export function parseFromObjectToCsv<T>(
  stream: fs.WriteStream,
  schema: z.Schema<T>,
  data: unknown,
  header: boolean,
): string {
  // Validate data before writing to CSV
  const parsedData = schema.parse(data)
  const csvData = unparse([parsedData] as never[], {
    header,
  })

  // PapaParse doesn't add a newline or carriage return to the last line
  // Since we writing one line at a time, we need add the character ourselves
  if (!stream.write(`${csvData}\r\n`)) {
    throw Error(`Failed to write ${csvData} to ${stream.path as string}.`)
  }
  log.info(`Wrote ${csvData} to ${stream.path as string}.`)

  return csvData
}

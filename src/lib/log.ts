// Logger - less verbose for CLI UX
import chalk from 'chalk'
import { Logger } from 'tslog'

const log: Logger = new Logger({
  displayFunctionName: false,
  displayFilePath: 'hidden',
  displayDateTime: false,
  displayLogLevel: true,
})

export const red = chalk.bold.red
export const green = chalk.bold.green
export const black = chalk.bold.black

export default log

// Logger - less verbose for CLI UX
import { Logger } from 'tslog'

const log: Logger = new Logger({
  displayFunctionName: false,
  displayFilePath: 'hidden',
  displayDateTime: false,
  displayLogLevel: true,
})

export default log

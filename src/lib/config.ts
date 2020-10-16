// Application configuration - defaults are recommended
import prompts from 'prompts'
import { XrplNetwork } from 'xpring-js'

// Web gRPC rippleD node endpoints hosted by RippleX
export enum WebGrpcEndpoint {
  Main = 'https://envoy.main.xrp.xpring.io',
  Test = 'https://envoy.test.xrp.xpring.io',
}

// Retry limit for reliable send
export const retryLimit = 3

// An array of questions as accepted by `prompts` to prompt the
// user for necessary input
export const questions: prompts.PromptObject[] = [
  {
    type: 'text',
    name: 'inputCsv',
    message: 'Path to input CSV?',
    initial: './input.csv',
  },
  {
    type: 'text',
    name: 'outputCsv',
    message: 'Path to generate output CSV?',
    initial: './output.csv',
  },
  {
    type: 'select',
    name: 'network',
    message: 'XRPL network?',
    choices: [
      { title: 'Mainnet', value: XrplNetwork.Main },
      { title: 'Testnet', value: XrplNetwork.Test },
    ],
    initial: 0,
  },
  {
    type: 'text',
    name: 'grpcUrl',
    message: 'Web gRPC URL of the rippleD node?',
    initial: WebGrpcEndpoint.Main,
  },
  {
    type: 'number',
    float: true,
    name: 'maxFee',
    message: 'Max fee per transaction (in XRP)?',
    initial: 0.01,
  },
  {
    type: 'number',
    float: true,
    name: 'usdToXrpRate',
    message: 'USD to XRP rate (price of 1 XRP in USD)?',
  },
  {
    type: 'password',
    name: 'secret',
    message: 'Sending XRPL account secret?',
  },
  {
    type: 'confirm',
    name: 'confirmed',
    message: 'Proceed with the XRP payments?',
  },
]

import fs from 'node:fs'

export interface SwishConfig {
  baseUrl: string
  certPath: string
  keyPath: string
  caPath?: string
  payeeAlias: string
  callbackUrl: string
}

export function loadSwishConfig(): SwishConfig {
  const config: SwishConfig = {
    baseUrl: process.env.SWISH_BASE_URL ?? 'https://cpc.getswish.net',
    certPath: process.env.SWISH_CERT_PATH ?? './ssl/public.pem',
    keyPath: process.env.SWISH_KEY_PATH ?? './ssl/private.key',
    caPath: process.env.SWISH_CA_PATH ?? undefined,
    payeeAlias: process.env.SWISH_PAYEE_ALIAS ?? '1236166490',
    callbackUrl:
      process.env.SWISH_CALLBACK_URL ??
      'https://smultron.zwc.se/v1/swish/callback',
  }

  validateConfig(config)
  return config
}

function validateConfig(config: SwishConfig): void {
  const required: Array<[keyof SwishConfig, string]> = [
    ['baseUrl', 'SWISH_BASE_URL'],
    ['certPath', 'SWISH_CERT_PATH'],
    ['keyPath', 'SWISH_KEY_PATH'],
    ['payeeAlias', 'SWISH_PAYEE_ALIAS'],
    ['callbackUrl', 'SWISH_CALLBACK_URL'],
  ]

  for (const [key, envName] of required) {
    if (!config[key]) {
      throw new Error(
        `Missing Swish config: ${key}. Set ${envName} environment variable.`,
      )
    }
  }

  const fileChecks: Array<[string, string]> = [
    [config.certPath, 'Certificate'],
    [config.keyPath, 'Private key'],
  ]
  if (config.caPath) {
    fileChecks.push([config.caPath, 'CA certificate'])
  }

  for (const [path, label] of fileChecks) {
    if (!fs.existsSync(path)) {
      throw new Error(`${label} file not found at "${path}".`)
    }
  }
}

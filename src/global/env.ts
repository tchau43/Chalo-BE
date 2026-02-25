type BaseType = string | boolean | number | undefined | null

function formatEnv<T extends BaseType = string>(envKey: string, defaultValue: T, callback?: (value: string) => T) {
  const value: string | undefined = process.env[envKey]
  if (typeof (value) === 'undefined') {
    return defaultValue
  }
  if (!callback) {
    return value as unknown as T
  }
  return callback(value)
}

export function env(envKey: string, defaultValue: string = '') {
  return formatEnv(envKey, defaultValue)
}

export function envString(envKey: string, defaultValue: string = '') {
  return formatEnv<string>(envKey, defaultValue)
}

export function envNumber(envKey: string, defaultValue: number = 0) {
  return formatEnv<number>(envKey, defaultValue, (value) => {
    const number = Number(value)
    if (Number.isNaN(number)){
      throw new Error(`${envKey} environment variable is not a number`)
    }
    return number
  })
}

export function envBoolean(envKey: string, defaultValue: boolean = false) {
  return formatEnv<boolean>(envKey, defaultValue, (value) => {
    try {
      return Boolean(JSON.parse(value))
    } catch {
      throw new Error(`${envKey} environment variable is not a boolean`)
    }
  })
}
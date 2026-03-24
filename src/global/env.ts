export type BaseType = string | number | boolean | undefined | null

function formatVal<T extends BaseType = string>(envKey: string, defaultVal: T, callback?: (value: string) => T) {
  const value: string | undefined = process.env[envKey]

  if (value === undefined) {
    return defaultVal
  }

  if (!callback) {
    return value as unknown as T
  }
  return callback(value)
}

export function env(envKey: string, defaultVal: string = "") {
  return formatVal(envKey, defaultVal)
}

export function envString(envKey: string, defaultVal: string = "") {
  return formatVal<string>(envKey, defaultVal)
}

export function envNumber(envKey: string, defaultVal: number = 0) {
  return formatVal<number>(envKey, defaultVal, (value) => {
    if (value.trim() === "") {
      throw new Error(`${envKey} do not have value`)
    }
    const num = Number(value)
    if (Number.isNaN(num)) {
      throw new Error(`${envKey} is not a number`)
    }
    return num
  })
}

export function envBoolean(envKey: string, defaultVal: boolean = false) {
  return formatVal<boolean>(envKey, defaultVal, (value) => {
    if (value.trim() === "") {
      throw new Error(`${envKey} do not have value`)
    }
    try {
      return Boolean(JSON.parse(value))
    } catch {
      throw new Error(`${envKey} is not a boolean`)
    }
  })
}

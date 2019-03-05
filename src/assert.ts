export function assertString(arg: any, msg = 'Should be string'): string {
  if (typeof arg !== 'string') {
    throw new TypeError(`${msg}: ${arg}`);
  }
  return arg;
}

export function assertNonNullable<T>(arg: T, msg = 'Should not be nullable'): NonNullable<T> {
  if (arg == null) {
    throw new TypeError(`${msg}: ${arg}`);
  }
  return arg as NonNullable<T>;
}

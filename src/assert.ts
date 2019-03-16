export function assertString(arg: any, msg = 'Should be string'): string {
  if (typeof arg !== 'string') {
    throw new TypeError(`${msg}: ${arg}`);
  }
  return arg;
}

export function assertNumber(arg: any, msg = 'Should be number'): number {
  if (typeof arg !== 'number') {
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

/**
 * Assert current Node version is greator than or equal to `minMajorVer`.
 *
 * @param ver like `v10.1.2`
 * @param minMajorVer
 */
export function assertNodeVersionGte(ver: string, minMajorVer: number): void {
  const [, majorVer = null] = /^v?(\d+)\./.exec(ver) || [];
  if (Number(majorVer) < minMajorVer) {
    console.error(
      `Error: duck requires Node v${minMajorVer} or higer, but the current version is ${ver}`
    );
    process.exit(1);
  }
}

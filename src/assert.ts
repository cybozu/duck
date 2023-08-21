export function assertString(arg: unknown, msg = "Should be string"): string {
  if (typeof arg !== "string") {
    throw new TypeError(`${msg}: ${arg}`);
  }
  return arg;
}

export function assertNumber(arg: unknown, msg = "Should be number"): number {
  if (typeof arg !== "number") {
    throw new TypeError(`${msg}: ${arg}`);
  }
  return arg;
}

export function assertNonNullable<T>(
  arg: T,
  msg = "Should not be nullable",
): NonNullable<T> {
  if (arg == null) {
    throw new TypeError(`${msg}: ${arg}`);
  }
  return arg as NonNullable<T>;
}

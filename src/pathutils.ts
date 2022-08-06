import path from "path";

/**
 * Normalize a file path to an absolute path.
 * @throws if the property is not a string type.
 */
export function toAbsPath<T>(
  config: T,
  baseDir: string,
  key: PickKeysByValue<Required<T>, string>
) {
  const value = config[key];
  if (typeof value === "string") {
    // "as any": TypeScript can not handle conditional type
    config[key] = path.resolve(baseDir, value) as any;
  } else if (value !== undefined) {
    throw new TypeError(`${String(key)} must be string`);
  }
}

/**
 * Normalize an array of a file path to absolute paths.
 * If the property is undefined, put an empty array.
 * @throws if the property is not an array type.
 */
export function toAbsPathArray<T>(
  config: T,
  baseDir: string,
  key: PickKeysByValue<Required<T>, string[] | readonly string[]>
) {
  config[key] ||= [] as any;
  const values = config[key];
  if (Array.isArray(values)) {
    // "as any": TypeScript can not handle conditional type
    config[key] = values.map((value) => path.resolve(baseDir, value)) as any;
  } else if (values !== undefined) {
    throw new TypeError(`${String(key)} must be string array`);
  }
}
/**
 * @example
 * type Props = {name: string; age: number; visible: boolean};
 * // Keys: 'name' | 'age'
 * type Keys = PickKeysByValue<Props, string | number>;
 */
type PickKeysByValue<T, ValueType> = {
  [Key in keyof T]: T[Key] extends ValueType ? Key : never;
}[keyof T];

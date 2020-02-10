/**
 * Types for zet
 */
declare namespace Zet {
  export function intersection<T>(...sets: Array<Set<T>>): Set<T>;
}
export = Zet;

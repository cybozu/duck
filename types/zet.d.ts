/**
 * Types for zet
 */
declare namespace Zet {
  export function intersection<T>(...sets: Array<Set<T>>): Set<T>;
}
// actually native ESM files are provided
export default Zet;

/**
 * Checks if an object is a plain object (not null, array, or date)
 */
export const isPlainObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj) && !(obj instanceof Date);
};

/**
 * Deep clones an object
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Checks if two objects are deeply equal
 */
export const deepEqual = (a: unknown, b: unknown): boolean => {
  return JSON.stringify(a) === JSON.stringify(b);
}; 

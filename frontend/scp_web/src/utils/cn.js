/**
 * Utility to combine class names cleanly
 * @param  {...any} inputs 
 * @returns {string}
 */
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}

export default cn;

/**
 * Classname Joiner Utility
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

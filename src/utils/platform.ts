const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window;

export function clickVerb(): string {
  return isTouch ? 'Toca' : 'Haz clic';
}

export function tapVerb(): string {
  return isTouch ? 'toca' : 'haz clic';
}

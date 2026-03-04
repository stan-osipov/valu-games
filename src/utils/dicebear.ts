export function getDiceBearUrl(seed: string, size = 80): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

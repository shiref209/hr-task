export function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0];
  const last = words[words.length - 1];
  if (!first || !last) return '';
  return (words.length === 1 ? first[0] : first[0] + last[0]).toUpperCase();
}

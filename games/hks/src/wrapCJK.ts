/** Wrap CJK by the existing approximate character budget without splitting
 * numbers from their decimal part or common displayed units. Explicit LF line
 * breaks and every input character are retained. An indivisible token wider
 * than the budget occupies one overwide line, so tiny widths cannot loop. */
export function wrapCJK(text: string, fontSize: string, maxWidth: number): string {
  const charWidth = parseInt(fontSize, 10);
  if (!Number.isFinite(charWidth) || charWidth <= 0 || !Number.isFinite(maxWidth)) return text;
  const limit = Math.floor(maxWidth / charWidth);
  if (limit <= 0) return text;
  return text.split('\n').map(line => {
    const tokens = line.match(/[+-]?\d+(?:\.\d+)?(?:[\t ]*(?:HP|px|ms|s|%|秒|次|米|点))?|[\s\S]/gu) ?? [];
    const lines: string[] = [];
    let current = '', count = 0;
    for (const token of tokens) {
      const length = Array.from(token).length;
      if (current && count + length > limit) { lines.push(current); current = ''; count = 0; }
      current += token; count += length;
    }
    if (current || !lines.length) lines.push(current);
    return lines.join('\n');
  }).join('\n');
}

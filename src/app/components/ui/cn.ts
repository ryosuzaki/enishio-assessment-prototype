/** クラス名の連結。条件で落としたいものは `false` や `undefined` を渡す。 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

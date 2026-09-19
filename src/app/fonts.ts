import { IBM_Plex_Sans_JP, IBM_Plex_Mono } from "next/font/google";

/**
 * 書体（`[D-102]`）。
 *
 * **システムフォント任せをやめた理由。**Windows では游ゴシックへ落ち、`font-semibold` を
 * ブラウザが合成ボールドで太らせるため見出しの輪郭が潰れる。ウェイトを実際に持つ書体を
 * 指定して初めて、400 と 500 と 600 の差が階層として読める。
 *
 * IBM Plex を選ぶのは、計測機器とデータ系プロダクトの系譜にある書体であり、和文・欧文・
 * 等幅が同じ設計思想で揃うため。**Inter は避けた**——無難だが、AI が既定で選ぶ書体として
 * 名指しされる程度には見飽きられている。
 *
 * `next/font` はビルド時に取得して自己ホストするため、実行時にネットワークを必要としない
 * （社内デモやオフライン環境で欠落しない）。
 */
export const sansJp = IBM_Plex_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-sans-jp",
  fallback: [
    "-apple-system",
    "BlinkMacSystemFont",
    "Hiragino Kaku Gothic ProN",
    "Yu Gothic UI",
    "Meiryo",
    "sans-serif",
  ],
});

export const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono-plex",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

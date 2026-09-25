import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 画面左下の開発インジケータを出さない。スクリーンショットと画面録画に写り込み、
  // 公開する画面が作りかけに見えるため。コンパイル・実行時エラーの表示は残る。
  devIndicators: false,
};

export default nextConfig;

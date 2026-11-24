import type { ReactNode } from "react";

export const metadata = { title: "X bot", robots: { index: false, follow: false } };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 640,
          margin: "0 auto",
          padding: "24px 16px",
          lineHeight: 1.5,
        }}
      >
        {children}
      </body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Flybridge Founders Week & AGM",
  description:
    "October 14–16, 2026 at The William Vale, Williamsburg, Brooklyn. Register, build your schedule, and get event updates.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Archivo+Expanded:wght@700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        />
        <link rel="icon" href="/logo.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}

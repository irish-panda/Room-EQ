import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { PwaProvider } from "./components/PwaProvider";
import "./globals.css";

const title = "Room EQ Assistant — Room audio analysis";
const description =
  "Measure repeatable room-response trends with browser audio, then get conservative EQ and placement guidance.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#101715",
};

export async function generateMetadata(): Promise<Metadata> {
  const incomingHeaders = await headers();
  const host =
    incomingHeaders.get("x-forwarded-host") ??
    incomingHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    incomingHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;

  return {
    title,
    description,
    applicationName: "Room EQ Assistant",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Room EQ",
      statusBarStyle: "black-translucent",
    },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      shortcut: "/icon.svg",
      apple: [
        {
          url: "/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: imageUrl, width: 1792, height: 896, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}

import { AuthProvider } from "@/components/session-provider";
import "./globals.css";
import {Figtree} from 'next/font/google';
import type { Metadata } from "next";
import { Toaster } from "@/components/ui/toast";

const figtree = Figtree({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Optimus | AI agent workspace",
  description: "Build focused AI agents and put meaningful work in motion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0 }} className={figtree.className}>
        <AuthProvider>{children}</AuthProvider>
        <Toaster/>
      </body>
    </html>
  );
}

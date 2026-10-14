import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";

export const metadata: Metadata = {
  title: "YouTube Clone",
  description: "A YouTube clone built with Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ThemeProvider>
            <Navbar />
            <main className="pt-14 sm:pt-14 md:pl-56">{children}</main>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

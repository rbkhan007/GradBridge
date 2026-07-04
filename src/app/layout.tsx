import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GradBridge — Autonomous AI Agent for CS Graduates",
    template: "%s | GradBridge",
  },
  description:
    "GradBridge is an autonomous AI agent that helps fresh CSE/Software Engineering graduates plan, build, debug, optimize, and grow their careers — with RAG context, safe diffs, and persistent memory.",
  keywords: [
    "GradBridge",
    "AI agent",
    "coding assistant",
    "CS graduates",
    "career mentor",
    "RAG",
    "Next.js",
    "TypeScript",
    "software engineering",
    "interview prep",
    "system design",
  ],
  authors: [{ name: "GradBridge" }],
  creator: "GradBridge",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "GradBridge — Autonomous AI Agent for CS Graduates",
    description:
      "Plan, build, debug, optimize, and grow — one autonomous agent for fresh graduates.",
    siteName: "GradBridge",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "GradBridge — Autonomous AI Agent for CS Graduates",
    description:
      "Plan, build, debug, optimize, and grow — one autonomous agent for fresh graduates.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8faf8" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1a12" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          {children}
          <SonnerToaster richColors closeButton position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

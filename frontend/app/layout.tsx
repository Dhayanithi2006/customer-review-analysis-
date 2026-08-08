import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "@/components/shared/ToastContainer";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "RoadmapAI — From Customer Voice to Business Growth Decisions",
  description:
    "Turn customer feedback into the problems your business should fix first. Analyze impact, prioritize, act, and measure closed-loop results.",
  keywords: ["product roadmap", "customer feedback", "AI product management", "B2B SaaS"],
  openGraph: {
    title: "RoadmapAI",
    description: "From Customer Voice to Business Growth Decisions.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        {children}
        <ToastContainer />
      </body>
    </html>
  );
}

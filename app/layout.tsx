import type { Metadata, Viewport } from "next"
import { Montserrat, Nunito_Sans } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
})
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-sans" })

export const metadata: Metadata = {
  title: "IjtemaCerts — Atfal Certificate Printer",
  description:
    "Place, preview and print participation certificates for the Regional Ijtema & IVC 2026, Majlis Atfal-ul Ahmadiyya, Oyo Ilaqa.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1a0d" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        nunitoSans.variable,
        montserrat.variable,
        "font-sans"
      )}
    >
      <body>
        <ThemeProvider>
          {children}
          {/* Bottom-right keeps toasts clear of the page controls they report
              on (the print scope buttons sit at the top of the content). On
              mobile Sonner spans the width, so it is lifted above the fixed
              tab bar. */}
          <Toaster
            position="bottom-right"
            mobileOffset={{ bottom: "5.5rem" }}
            richColors
            closeButton
          />
        </ThemeProvider>
      </body>
    </html>
  )
}

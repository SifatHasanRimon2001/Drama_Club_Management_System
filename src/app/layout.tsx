import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/lib/theme";
import { RealtimeProvider } from "@/lib/client/socket";
import { SessionProvider } from "@/lib/client/session";

export const metadata: Metadata = {
  title: {
    default: "BRAC University Drama Club",
    template: "%s — BRAC University Drama Club",
  },
  description:
    "Centralized platform for managing BRAC University Drama Club operations, members, productions, and events.",
};

/**
 * Applies the persisted theme before first paint so there is no flash of the
 * wrong palette. Runs synchronously in <head>, ahead of any React hydration.
 *
 * The product is dark-first: with no stored preference we resolve to dark
 * rather than following the OS, so a first-time visitor always meets the
 * intended identity. An explicit choice — including "system" — is honoured.
 *
 * It also drops the `no-js` class, which is what keeps scroll-reveal content
 * visible when JavaScript never runs.
 */
function ThemeBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{var h=document.documentElement;h.classList.remove('no-js');var t=localStorage.getItem('dcms-theme');var d=!t||t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);h.classList.toggle('dark',d);h.style.colorScheme=d?'dark':'light';}catch(e){}`,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="no-js h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeBootstrap />
      </head>
      <body className="min-h-full bg-canvas text-ink">
        <ThemeProvider>
          <SessionProvider>
            <ToastProvider>
              <RealtimeProvider>{children}</RealtimeProvider>
            </ToastProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

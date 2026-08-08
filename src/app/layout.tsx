import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/lib/theme";
import { RealtimeProvider } from "@/lib/client/socket";

export const metadata: Metadata = {
  title: {
    default: "BRAC University Drama Club",
    template: "%s — BRAC University Drama Club",
  },
  description:
    "Centralized platform for managing BRAC University Drama Club operations, members, productions, and events.",
};

function ThemeBootstrap() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{var t=localStorage.getItem('dcms-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);var h=document.documentElement;if(d){h.classList.add('dark')}h.style.colorScheme=d?'dark':'light';}catch(e){}`,
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeBootstrap />
      </head>
      <body className="min-h-full bg-canvas text-ink dark:bg-[#0b1220] dark:text-slate-100">
        <ThemeProvider>
          <ToastProvider>
            <RealtimeProvider>{children}</RealtimeProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
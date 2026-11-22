import type { Metadata, Viewport } from "next";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import "@fontsource/forum/400.css";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: { default: "Lotfy Bronze — CastFlow MES", template: "%s · Lotfy Bronze" },
  description: "Lotfy Bronze ERP: casting work orders, routing, workshop execution, quality, inventory and overtime.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111320" },
  ],
};

// Applied before paint: the theme chosen on this browser (else the device's), and the sidebar kept open or not.
const INIT = `(function(){var d=document.documentElement,m=window.matchMedia?matchMedia("(prefers-color-scheme: dark)"):null;function g(k){try{return localStorage.getItem(k)}catch(e){return null}}function a(){var t=g("theme");d.classList.toggle("dark",t==="dark"||(t!=="light"&&!!m&&m.matches))}a();if(m&&m.addEventListener)m.addEventListener("change",a);if(g("side")==="pinned")d.classList.add("side-pinned")})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: INIT }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

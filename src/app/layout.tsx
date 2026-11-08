import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { loadToyota } from "@/lib/toyota/load";
import { PersonaProvider } from "@/components/PersonaProvider";
import { BankProvider } from "@/components/nova/BankProvider";
import { Shell } from "@/components/nova/Shell";
import { SIDEBAR_INIT_SCRIPT } from "@/lib/nav";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OneFlow · One Financial World",
  description: "Your whole financial picture and your next best move. The code computes, the AI explains, the bank executes.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Apply the saved theme (Settings → Theme) and sidebar rail width before first paint. */
const THEME_INIT = `try{var t=localStorage.getItem("nova:theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
const HEAD_INIT = THEME_INIT + SIDEBAR_INIT_SCRIPT;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = loadToyota();
  const personas = t.customers.map((c) => ({
    id: c.customer_id,
    name: c.first_name,
    age: c.age,
    says: t.situations.find((s) => s.customer_id === c.customer_id)?.customer_says ?? "",
  }));
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: HEAD_INIT }} /></head>
      <body>
        <PersonaProvider personas={personas}>
          <BankProvider>
            <Shell>{children}</Shell>
          </BankProvider>
        </PersonaProvider>
      </body>
    </html>
  );
}

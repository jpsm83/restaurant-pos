import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import HeaderNav from "@/components/HeaderNav";
import AuthProviders from "@/context/AuthProvider"; // this provider will wrap all the aplication given children access to the session

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Restaurant POS system",
  description: "Take control of your restaurant with our POS system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <AuthProviders>
          <nav className="h-16 shadow-md">
            <HeaderNav />
          </nav>
          {children}
        </AuthProviders>
      </body>
    </html>
  );
}

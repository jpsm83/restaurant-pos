import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@auth0/nextjs-auth0/client"; // Ensure this path is correct

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
      <body className={inter.className}>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}

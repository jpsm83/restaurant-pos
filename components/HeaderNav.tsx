"use client"

import Link from "next/link";
import { HeaderDrawer } from "./HeaderDrawer";
import { Bell } from "lucide-react";
import { Button } from "./ui/button";
import { signOut, signIn, useSession } from "next-auth/react"; // signIn, signOut, useSession, getSession, getCsrfToken, getProviders
import { redirect } from "next/navigation";

function HeaderNav() {
    // that is how you can use the session object on the client component  (check app/admin/page.tsx for how to get session object on the client component)
    const { data: session, status } = useSession({
      required: false,
      onUnauthenticated() {
        redirect("/");
      },
    });
  
    if (status === "loading") {
      return <div>Loading...</div>;
    }
  const trainningColumns = [
    {
      columnTitle: "Metrics",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Analitcs",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Menu",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Suppliers",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
  ];

  const featuresColumns = [
    {
      columnTitle: "Metrics",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Analitcs",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Menu",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Suppliers",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
  ];

  const aboutColumns = [
    {
      columnTitle: "Metrics",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Analitcs",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Menu",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
    {
      columnTitle: "Suppliers",
      columnItems: ["Class1", "Class2", "Class3", "Class4"],
    },
  ];

  return (
    <header className="bg-yellow-400 h-16 flex justify-between align-middle">
      <div className="flex items-center ml-5">
        <Link href="/">
          <h3>IMPERIUM</h3>
        </Link>
      </div>
      <div className="flex items-center gap-8">
        <HeaderDrawer
          title="Trainning"
          description="Get ready to take control"
          subtitleDescription="Video links on how to handle the application"
          columns={trainningColumns}
        />
        <HeaderDrawer
          title="Features"
          description="Unleash the full power of the application"
          subtitleDescription="Video links on how to handle the application"
          columns={featuresColumns}
        />
        <HeaderDrawer
          title="About"
          description="Our values, history and mission"
          subtitleDescription="Video links on how to handle the application"
          columns={aboutColumns}
        />
      </div>

      <div className="flex gap-5 mr-3 items-center">
        {session ? (
          <div className="flex items-center space-x-5">
            <Link href="/notifications">
              <Bell className="h-4 w-4" />
            </Link>
            <div className="hidden sm:block text-xs">
              <p className="text-yellow-800">{session.user?.name}</p>
              <p className="font-bold text-gray-800">{session.user?.name}</p>
            </div>
            <Button onClick={() => signOut()}>Logout</Button>
          </div>
        ) : (
          <div className="flex gap-8 mr-5">
            <Button>Register</Button>
            <Button onClick={() => signIn()}>Login</Button>
          </div>
        )}
      </div>
    </header>
  );
}

export default HeaderNav;

import {
  useUser,
  ClerkLoaded,
  UserButton,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useUserStore } from "@/app/store/store";
import { Button } from "./ui/button";
import { HeaderDrawer } from "./HeaderDrawer";

function Header() {
  const { user } = useUser();

  const setUserData = useUserStore((state) => state.setUserData);
  const resetUserData = useUserStore((state) => state.resetUserData);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/employees/email/${user.primaryEmailAddress.emailAddress}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        setUserData(data.employeeName, data.businessId); // Update the Zustand store
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    if (user) {
      fetchUser();
    } else {
      resetUserData(); // Reset the Zustand store when the user logs out
    }
  }, [user, setUserData, resetUserData]);

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
      <ClerkLoaded>
        <div className="flex gap-5 mr-3 items-center">
          {user ? (
            <div className="flex items-center space-x-5">
              <Link href="/notifications">
                <Bell className="h-4 w-4" />
              </Link>
              <UserButton />
              <div className="hidden sm:block text-xs">
                <p className="text-yellow-800">
                  {user.primaryEmailAddress.emailAddress}
                </p>
                <p className="font-bold text-gray-800">{user.fullName}</p>
              </div>
            </div>
          ) : (
            <div className="flex gap-8 mr-5">
              <Button asChild>
                <SignUpButton mode="modal">Register</SignUpButton>
              </Button>
              <SignInButton mode="modal">Login</SignInButton>
            </div>
          )}
        </div>
      </ClerkLoaded>
    </header>
  );
}

export default Header;

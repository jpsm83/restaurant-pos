import { useUser, ClerkLoaded, UserButton, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useUserStore } from "@/app/store/store";

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

  return (
    <header className="bg-yellow-400 h-16 flex justify-between align-middle">
        <div className="flex items-center ml-3">
          <Link href="/">
            <h3>IMPERIUM</h3>
          </Link>
        </div>
        <ClerkLoaded>
          <div className="flex gap-5 mr-3">
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
              <SignInButton mode="modal" />
            )}
          </div>
        </ClerkLoaded>
    </header>
  );
}

export default Header;
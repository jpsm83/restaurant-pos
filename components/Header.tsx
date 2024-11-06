"use client";

import { useUser, ClerkLoaded, UserButton, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import {
  Bell,
  ListCollapse,
  Building2,
  UsersRound,
  Share2,
  Soup,
  MapPin,
  ClipboardMinus,
  ChefHat,
  FileDigit,
  Printer,
  Monitor,
  LayoutList,
  CalendarCheck2,
  ShoppingCart,
  CircleDollarSign,
  Utensils,
  Coffee,
  BookOpenText,
  CalendarDays,
  Sun,
  SquareChartGantt,
} from "lucide-react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  //   MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useEffect, useState } from "react";

function Header({ sendDataToParent }) {
  const [userData, setUserData] = useState(null);
  const { user } = useUser();

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
        setUserData(data);
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    };

    if (user) {
      fetchUser();
    }
  }, [user]);

  useEffect(() => {
    if (userData && userData.businessId) {
      sendDataToParent(userData.businessId);
    }
  }, [userData, sendDataToParent]);

  return (
    <header className="bg-yellow-400">
      <div className="flex justify-between align-middle p-3">
        <div>
          <Link href="/">
            <h3>IMPERIUM</h3>
          </Link>
        </div>
        <ClerkLoaded>
          <div className="flex gap-5">
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
      </div>
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Business
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Link
                href="/business-details"
                className="flex items-center gap-2"
              >
                <ListCollapse className="h-4 w-4" />
                Details
              </Link>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem>
              <Link href="/default-metrics" className="flex items-center gap-2">
                <FileDigit className="h-4 w-4" />
                Default Metrics
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/sales-points" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Sales Points
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/printers" className="flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Printers
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/screens" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Screens
              </Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="flex items-center gap-2">
            <ChefHat className="h-4 w-4" />
            Employees
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Link href="/employees-list" className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                List
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/schedules" className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4" />
                Schedules
              </Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Suppliers
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Link href="/suppliers-list" className="flex items-center gap-2">
                <LayoutList className="h-4 w-4" />
                List
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/purchases" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Purchases
              </Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="flex items-center gap-2">
            <Soup className="h-4 w-4" />
            Sales Products
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Link
                href="/sales-products-list"
                className="flex items-center gap-2"
              >
                <LayoutList className="h-4 w-4" />
                List
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/promotions" className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" />
                Promotions
              </Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Floor
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Link href="/sales-instances" className="flex items-center gap-2">
                <Utensils className="h-4 w-4" />
                Sales Instances
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/orders" className="flex items-center gap-2">
                <Coffee className="h-4 w-4" />
                Orders
              </Link>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem>
              <Link href="/reservations" className="flex items-center gap-2">
                <BookOpenText className="h-4 w-4" />
                Reservations
              </Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="flex items-center gap-2">
            <ClipboardMinus className="h-4 w-4" />
            Reports
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem>
              <Link href="/daily-reports" className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                Daily Reports
              </Link>
            </MenubarItem>
            <MenubarItem>
              <Link href="/monthly-reports" className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Monthly Reports
              </Link>
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem>
              <Link href="/inventory" className="flex items-center gap-2">
                <SquareChartGantt className="h-4 w-4" />
                Inventory
              </Link>
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger>
            <Link href="/customers" className="flex items-center gap-2">
              <UsersRound className="h-4 w-4" />
              Customers
            </Link>
          </MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    </header>
  );
}

export default Header;

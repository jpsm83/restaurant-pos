import { useUser, ClerkLoaded, UserButton, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { HomeIcon } from "@radix-ui/react-icons";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  //   MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";

function Header() {
  const { user } = useUser();

  console.log(user);

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
                <Link href="/">
                  <HomeIcon className="h-4 w-4" />
                </Link>
                <UserButton />
                <div className="hidden sm:block text-xs">
                  <p className="text-yellow-800">Welcome Back</p>
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
          <MenubarTrigger>Business
          </MenubarTrigger>
          <MenubarContent>
            <MenubarItem><Link href="/businessDetails">Details</Link></MenubarItem>
            <MenubarItem>Metrics</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Employees</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>All</MenubarItem>
            <MenubarSeparator />
            <MenubarItem>Front</MenubarItem>
            <MenubarItem>Back</MenubarItem>
            <MenubarItem>Admin</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example1</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example2</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example3</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example4</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example5</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example6</MenubarTrigger>
        </MenubarMenu>
        <MenubarMenu>
          <MenubarTrigger>Example7</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    </header>
  );
}

export default Header;

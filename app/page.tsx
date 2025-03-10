import Image from "next/image";
import Link from "next/link";
import { options } from "./api/auth/[...nextauth]/options";
import { getServerSession } from "next-auth";

export default async function HomePage() {
  const session = await getServerSession(options);

  return (
    <main className="flex flex-col items-center justify-center flex-grow">
      {session ? (
        <div className="text-center">
          <p className="font-bold">Signed in as {session.user?.email}</p>
        </div>
      ) : (
        <p className="font-bold">Not signed in</p>
      )}{" "}
      <h1 className="text-6xl font-extrabold uppercase text-yellow-700 ">
        Imperium
      </h1>
      <h1 className="text-4xl font-extrabold uppercase text-yellow-700 ">
        Take control
      </h1>
      <Image
        src={"/imperium.png"}
        width={500}
        height={500}
        alt="Picture of the author"
      />
      <Link href="/admin">Admin</Link>
    </main>
  );
}

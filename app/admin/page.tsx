import { getServerSession } from "next-auth";
import { options } from "../api/auth/[...nextauth]/options";
import { redirect } from "next/navigation";

const AdminPage = async () => {
  // that is how you get session object on the server component (check component/HeaderNav.tsx for how to get session object on the server component)
  const session = await getServerSession(options);

  if (!session) {
    redirect("/api/auth/signin?callbackUrl=/auth/post-login");
  }

  return (
    <div>
      <h1>Admin page</h1>
      <p>{session?.user?.email}</p>
    </div>
  );
};

export default AdminPage;

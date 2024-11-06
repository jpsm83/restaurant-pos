"use client"

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import Header from "@/components/Header";
import { BusinessContainer } from "@/components/BusinessContainer";

const Home = () => {
  const [userData, setUserData] = useState(null);
  const { user } = useUser();

  useEffect(() => {
    if (!user || !user.primaryEmailAddress) return;

    const fetchUser = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/employees/email/${user.primaryEmailAddress.emailAddress}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setUserData(data);
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    fetchUser();
  }, [user]);

  return (
    <>
      <Header />
      {userData && userData.length > 0 && (
        <BusinessContainer businessId={userData[0].businessId} />
      )}
      <div>
        <Image
          src="/hrc.png"
          width={500}
          height={500}
          alt="Picture of the author"
        />
      </div>
    </>
  );
};

export default Home;

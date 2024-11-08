"use client";

import Header from "@/components/Header";
import { BusinessContainer } from "@/components/BusinessContainer";
import { useUserStore } from "../store/store";
import Image from "next/image";

const Home = () => {
  const businessId = useUserStore((state) => state.businessId);

  return (
    <>
      <Header />
      {businessId ? (
        <BusinessContainer />
      ) : (
        <div className="min-h-[calc(100vh-64px)] flex justify-center items-center">
          <Image
            src="/imperium.png"
            width={500}
            height={500}
            alt="Picture of the author"
          />
        </div>
      )}
    </>
  );
};

export default Home;

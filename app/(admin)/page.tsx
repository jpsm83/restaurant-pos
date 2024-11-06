"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { BusinessContainer } from "@/components/BusinessContainer";

const Home = () => {
  const [businessId, setBusinessId] = useState(null);

  const setBusinessIdFromChild = async (businessId: string) => {
    setBusinessId(businessId);
  };

  return (
    <>
      <Header sendDataToParent={setBusinessIdFromChild} />
      {businessId && (
        <BusinessContainer businessId={businessId} />
      )}
    </>
  );
};

export default Home;

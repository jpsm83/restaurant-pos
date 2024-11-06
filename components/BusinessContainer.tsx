"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export const BusinessContainer = ({ businessId }) => {
  const [businessData, setBusinessData] = useState(null);

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/business/${businessId}`,
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
        setBusinessData(data);
      } catch (error) {
        console.error("Error fetching business:", error);
      }
    };

    if (businessId) {
      fetchBusiness();
    }
  }, [businessId]);

  return (
    <div className="flex items-center justify-center h-screen">
      <Image
        src={businessData?.imageUrl || "/hrc.png"}
        width={500}
        height={500}
        alt="Picture of the author"
      />
    </div>
  );
};

import { useUserStore } from "@/app/store/store";
import Image from "next/image";
import { useEffect, useState } from "react";
import { BusinessNavigation } from "./BusinessNavigation";

export const BusinessContainer = () => {
  const [businessData, setBusinessData] = useState(null);

  const businessId = useUserStore((state) => state.businessId);

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
    <div>
      <BusinessNavigation />
      <div className="min-h-[calc(100vh-104px)] flex justify-center items-center">
      <Image
        src={businessData?.imageUrl || "/imperium.png"}
        width={500}
        height={500}
        alt="Picture of the author"
      />
    </div>
    </div>
  );
};

"use client"

import { useEffect, useState } from "react";

export const BusinessContainer = (businessId) => {
    const [businessData, setBusinessData] = useState(null);

    useEffect(() => {
      const fetchBusiness = async () => {
          if(businessId){
            try {
              const response = await fetch(
                `http://localhost:3000/api/business/${businessId}`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                }
              );
        
              if(!response.ok){
                throw new Error(`HTTP error! status: ${response.status}`)
              }
              
              const data = response.json();
              setBusinessData(data)
            } catch (error) {
              console.error('Error fetching business:', error);
            }
          }
        }
      
        fetchBusiness();
    
    }, [])
    
    
    console.log(businessData)
  return (
    <div>BusinessContainer</div>
  )
}

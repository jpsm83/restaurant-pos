import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formSchema } from "./formSchema";

export const useBusinessProfileForm = () => {
  return useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tradeName: "",
      legalName: "",
      email: "",
      password: "",
      phoneNumber: "",
      taxNumber: "",
      currencyTrade: "",
      subscription: "",
      address: {
        country: "",
        state: "",
        city: "",
        street: "",
        buildingNumber: "",
        postCode: "",
        region: "",
        additionalDetails: "",
        coordinates: [0, 0],
      },
      contactPerson: "",
    },
  });
};

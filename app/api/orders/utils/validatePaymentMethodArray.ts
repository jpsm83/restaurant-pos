import { IPaymentMethod } from "@/app/lib/interface/IPaymentMethod";
import {
  paymentMethods,
  cardTypes,
  cryptoTypes,
  otherPaymentTypes,
} from "@/app/lib/enums";

export const validatePaymentMethodArray = (paymentMethod: IPaymentMethod[]) => {
  // example of a payment method object
  // paymentMethod = [
  //   {
  //     paymentMethodType: "Cash",
  //     methodBranch: "Cash",
  //     methodSalesTotal: 100,
  //   },
  //   {
  //     paymentMethodType: "Card",
  //     methodBranch: "Visa",
  //     methodSalesTotal: 150,
  //   },
  //   {
  //     paymentMethodType: "Crypto",
  //     methodBranch: "Bitcoin",
  //     methodSalesTotal: 200,
  //   },
  //   {
  //     paymentMethodType: "Other",
  //     methodBranch: "Paypal",
  //     methodSalesTotal: 50,
  //   },
  // ];

  if (!Array.isArray(paymentMethod) || paymentMethod.length === 0) {
    return "Payment method has to be an array!";
  }

  for (let payment of paymentMethod) {
    if (
      !payment.paymentMethodType ||
      !payment.methodBranch ||
      payment.methodSalesTotal === undefined
    ) {
      return "Payment is missing method type, branch, or sales total!";
    }

    if (!paymentMethods.includes(payment.paymentMethodType)) {
      return `Invalid payment method type: ${payment.paymentMethodType}`;
    }

    switch (payment.paymentMethodType) {
      case "Card":
        if (!cardTypes.includes(payment.methodBranch)) {
          return `Invalid card type: ${payment.methodBranch}`;
        }
        break;
      case "Crypto":
        if (!cryptoTypes.includes(payment.methodBranch)) {
          return `Invalid crypto type: ${payment.methodBranch}`;
        }
        break;
      case "Other":
        if (!otherPaymentTypes.includes(payment.methodBranch)) {
          return `Invalid other payment type: ${payment.methodBranch}`;
        }
        break;
      case "Cash":
        if (payment.methodBranch !== "Cash") {
          return "Invalid cash branch!";
        }
        break;
      default:
        return `Unknown payment method type: ${payment.paymentMethodType}`;
    }

    if (
      typeof payment.methodSalesTotal !== "number" ||
      payment.methodSalesTotal < 0
    ) {
      return "Invalid sales total!";
    }
  }

  return true;
};

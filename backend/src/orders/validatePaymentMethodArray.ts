/**
 * Post-parse payment-method guard: the array must be non-empty, every line must
 * carry a known method type/branch pair and a non-negative sales total. It
 * accepts the client-settable payment DTO shape (`paymentMethodItemSchema`), not
 * the full mongodb `IPaymentMethod` document, so callers pass DTO data without
 * bridging casts.
 */
import * as enums from "domain/enums";

const { paymentMethodsEnums, creditCardEnums, cryptoEnums, otherPaymentEnums } = enums;

type PaymentMethodInput = {
  paymentMethodType?: string;
  methodBranch?: string;
  methodSalesTotal?: number;
};

const validatePaymentMethodArray = (
  paymentMethod: readonly PaymentMethodInput[]
): true | string => {
  if (!Array.isArray(paymentMethod) || paymentMethod.length === 0) {
    return "Payment method has to be an array!";
  }

  for (const payment of paymentMethod) {
    if (
      !payment.paymentMethodType ||
      !payment.methodBranch ||
      payment.methodSalesTotal === undefined
    ) {
      return "Payment is missing method type, branch, or sales total!";
    }

    if (!(paymentMethodsEnums as readonly string[]).includes(payment.paymentMethodType)) {
      return `Invalid payment method type: ${payment.paymentMethodType}`;
    }

    switch (payment.paymentMethodType) {
      case "Card":
        if (!(creditCardEnums as readonly string[]).includes(payment.methodBranch)) {
          return `Invalid card type: ${payment.methodBranch}`;
        }
        break;
      case "Crypto":
        if (!(cryptoEnums as readonly string[]).includes(payment.methodBranch)) {
          return `Invalid crypto type: ${payment.methodBranch}`;
        }
        break;
      case "Other":
        if (!(otherPaymentEnums as readonly string[]).includes(payment.methodBranch)) {
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

export default validatePaymentMethodArray;

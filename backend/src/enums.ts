// Copied from `lib/enums.js` (legacy Next.js backend logic).
// Keep in sync during migration; later we can consolidate into `packages/` if needed.

export const mainCategoriesEnums = [
  "Food",
  "Set Menu",
  "Beverage",
  "Merchandise",
  "Cleaning",
  "Office",
  "Furniture",
  "Disposable",
  "Services",
  "Equipment",
  "Other",
] as const;

export const paymentMethodsEnums = ["Cash", "Card", "Crypto", "Other"] as const;

export const currenctyEnums = ["USD", "EUR", "CHF", "AUD", "CAD", "GBP", "JPY"] as const;

export const creditCardEnums = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "Diners Club",
  "Maestro",
] as const;

export const cryptoEnums = [
  "Bitcoin",
  "Ethereum",
  "Litecoin",
  "Ripple",
  "Cardano",
  "Polkadot",
  "Dogecoin",
] as const;

export const otherPaymentEnums = [
  "Voucher",
  "Paypal",
  "Venmo",
  "Apple Pay",
  "Google Pay",
  "Samsung Pay",
] as const;

export const purchaseUnitEnums = [
  "Unit",
  "Dozen",
  "Case",
  "Slice",
  "Portion",
  "Piece",
  "Packet",
  "Bag",
  "Block",
  "Box",
  "Can",
  "Jar",
  "Bunch",
  "Bundle",
  "Roll",
  "Bottle",
  "Container",
  "Crate",
  "Gallon",
] as const;

export const printerStatusEnums = ["Online", "Offline", "Out of paper", "Error"] as const;

export const locationEnums = ["Table", "Room", "Seat", "Bar", "Counter", "Spot", "Other"] as const;

export const salesPointTypeEnums = [
  "table",
  "room",
  "bar",
  "seat",
  "counter",
  "spot",
  "delivery",
  "other",
] as const;

export const notificationEnums = ["Warning", "Emergency", "Info", "Message", "Promotion", "Birthday", "Event"] as const;

export const salesInstanceStatusEnums = ["Occupied", "Reserved", "Bill", "Closed"] as const;

export const reservationStatusEnums = [
  "Pending",
  "Confirmed",
  "Arrived",
  "Seated",
  "Cancelled",
  "NoShow",
  "Completed",
] as const;

export const subscriptionEnums = ["Free", "Basic", "Premium", "Enterprise"] as const;

export const idEnums = ["National ID", "Passport", "Driving License"] as const;

export const userRolesEnums = [
  "Owner",
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
  "Operator",
  "Employee",
  "Cashier",
  "Floor Staff",
  "Bartender",
  "Barista",
  "Waiter",
  "Head Chef",
  "Sous Chef",
  "Line Cooks",
  "Kitchen Porter",
  "Cleaner",
  "Security",
  "Host",
  "Runner",
  "Supervisor",
  "Entertainer",
  "Other",
] as const;

export const orderStatusEnums = ["Sent", "Done", "Dont Make", "Hold", "Delivered"] as const;

export const billingStatusEnums = ["Open", "Paid", "Void", "Cancel", "Invitation"] as const;

export const measurementUnitEnums = [
  "unit",
  "mg",
  "g",
  "kg",
  "oz",
  "lb",
  "ml",
  "l",
  "kl",
  "tsp",
  "Tbs",
  "fl-oz",
  "cup",
  "pnt",
  "qt",
  "gal",
] as const;

export const allergensEnums = [
  "Gluten",
  "Crustaceans",
  "Eggs",
  "Fish",
  "Peanuts",
  "Soybeans",
  "Milk",
  "Nuts",
  "Celery",
  "Mustard",
  "Sesame",
  "Sulphur dioxide",
  "Lupin",
  "Molluscs",
] as const;

export const budgetImpactEnums = ["Very Low", "Low", "Medium", "High", "Very High"] as const;

export const inventoryScheduleEnums = ["daily", "weekly", "monthly"] as const;

export const foodSubCategoryEnums = [
  "Add-ons",
  "Appetizer",
  "Bake",
  "Bread",
  "Burgers",
  "Condiments",
  "Dairy",
  "Dessert",
  "Entrée",
  "Fish",
  "Fruits",
  "Gluten-Free",
  "Gluten-free",
  "Grains",
  "Herbs & Spices",
  "Main",
  "Meat",
  "Oils & Vinegars",
  "Others",
  "Pasta",
  "Pastries",
  "Pizza",
  "Prepared Meals",
  "Salad",
  "Sandwiches",
  "Sauces",
  "Seafood",
  "Set menu",
  "Snack",
  "Snacks",
  "Starter",
  "Vegetables",
  "Other",
] as const;

export const beverageSubCategoryEnums = [
  "Beer",
  "Brandy",
  "Champagne",
  "Cocktail",
  "Coffee",
  "Cognac",
  "Energy Drinks",
  "Gin",
  "Juices",
  "Liqueur",
  "Milk",
  "Non-Alcoholic Beer",
  "Non-Alcoholic Wine",
  "Others",
  "Red Wine",
  "Rose Wine",
  "Rum",
  "Soft Drinks",
  "Sparkling Wine",
  "Tea",
  "Tequila",
  "Vodka",
  "Water",
  "Whiskey",
  "White Wine",
] as const;

export const merchandiseSubCategoryEnums = [
  "Clothing",
  "Accessories",
  "Toys & Games",
  "Health & Beauty",
  "Souvenirs",
  "Others",
] as const;

export const othersSubcategoryEnums = ["Cleaning", "Office", "Furniture", "Disposable", "Services", "Equipment", "Other"] as const;

export const weekDaysEnums = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const employeePayFrequencyEnums = ["Hourly", "Daily", "Weekly", "Monthly"] as const;


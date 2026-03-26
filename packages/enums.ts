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
] as string[];

export const paymentMethodsEnums = ["Cash", "Card", "Crypto", "Other"] as string[];

export const currenctyEnums = ["USD", "EUR", "CHF", "AUD", "CAD", "GBP", "JPY"] as string[];

export const creditCardEnums = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "Diners Club",
  "Maestro",
] as string[];

export const cryptoEnums = [
  "Bitcoin",
  "Ethereum",
  "Litecoin",
  "Ripple",
  "Cardano",
  "Polkadot",
  "Dogecoin",
] as string[];

export const otherPaymentEnums = [
  "Voucher",
  "Paypal",
  "Venmo",
  "Apple Pay",
  "Google Pay",
  "Samsung Pay",
] as string[];

export const allPaymentMethodsEnums = [...creditCardEnums, ...cryptoEnums, ...otherPaymentEnums] as string[];

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
] as string[];

export const printerStatusEnums = ["Online", "Offline", "Out of paper", "Error"] as string[];

export const locationEnums = ["Table", "Room", "Seat", "Bar", "Counter", "Spot", "Other"] as string[];

/** Valid salesPointType values; includes "delivery" for virtual delivery sales points. */
export const salesPointTypeEnums = [
  "table",
  "room",
  "bar",
  "seat",
  "counter",
  "spot",
  "delivery",
  "other",
] as string[];

export const notificationEnums = ["Warning", "Emergency", "Info", "Message", "Promotion", "Birthday", "Event"] as string[];

export const salesInstanceStatusEnums = ["Occupied", "Reserved", "Bill", "Closed"] as string[];

export const reservationStatusEnums = [
  "Pending",
  "Confirmed",
  "Arrived",
  "Seated",
  "Cancelled",
  "NoShow",
  "Completed",
] as string[];

export const subscriptionEnums = ["Free", "Basic", "Premium", "Enterprise"] as string[];

export const idEnums = ["National ID", "Passport", "Driving License"] as string[];

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
] as string[];

export const managementRolesEnums = [
  "Owner",
  "General Manager",
  "Manager",
  "Assistant Manager",
  "MoD",
  "Admin",
  "Supervisor",
] as string[];

export const orderStatusEnums = ["Sent", "Done", "Dont Make", "Hold", "Delivered"] as string[];
// once it has been started, it can't be cancel
// "Dont Make" means it has been done before it been requested, it cannot be cancel

export const billingStatusEnums = ["Open", "Paid", "Void", "Cancel", "Invitation"] as string[];
// OPEN - order is open and can be paid
// PAID - order is paid and can't be changed
// VOID - order been done but is voided by manager, good been lost and business will not be paid, ex: client left without paying, good was badly done and have to be remake, mistake was made
// CANCEL - good been order but has not been done and is cancel by manager, there is no lost for the business, ex: employee order by mistake and cancel it before it is done
// INVITATION - order is an invitation, no payment is required, ex: business is offering a free meal to a client

// metric abreveations for the convert-units library
export const measurementUnitEnums = [
  "unit", // This is not on convert-units library - this is just to recognize the unit as a single item
  "mg", // Milligram
  "g", // Gram
  "kg", // Kilogram
  "oz", // Ounce
  "lb", // Pound
  "ml", // Milliliter
  "l", // Liter
  "kl", // Kiloliter
  "tsp", // Teaspoon
  "Tbs", // Tablespoon
  "fl-oz", // Fluid Ounce
  "cup", // Cup
  "pnt", // Pint
  "qt", // Quart
  "gal", // Gallon
] as string[];

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
] as string[];

export const budgetImpactEnums = ["Very Low", "Low", "Medium", "High", "Very High"] as string[];

export const inventoryScheduleEnums = ["daily", "weekly", "monthly"] as string[];

// not in use
// employee can be free to create those subcategories as they wish
export const foodSubCategoryEnums = [
  "Add-ons", // for example, extra cheese, extra bacon, etc.
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
] as string[];

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
] as string[];

export const merchandiseSubCategoryEnums = [
  "Clothing",
  "Accessories",
  "Toys & Games",
  "Health & Beauty",
  "Souvenirs",
  "Others",
] as string[];

export const othersSubcategoryEnums = ["Cleaning", "Office", "Furniture", "Disposable", "Services", "Equipment", "Other"] as string[];

export const weekDaysEnums = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as string[];

export const employeePayFrequencyEnums = ["Hourly", "Daily", "Weekly", "Monthly"] as string[];

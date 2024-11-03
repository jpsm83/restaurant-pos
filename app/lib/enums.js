export const mainCategories = [
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
];

export const paymentMethods = ["Cash", "Card", "Crypto", "Other"];

export const cardTypes = [
  "Visa",
  "Mastercard",
  "American Express",
  "Discover",
  "Diners Club",
  "Maestro",
];

export const cryptoTypes = [
  "Bitcoin",
  "Ethereum",
  "Litecoin",
  "Ripple",
  "Cardano",
  "Polkadot",
  "Dogecoin",
];

export const otherPaymentTypes = [
  "Voucher",
  "Paypal",
  "Venmo",
  "Apple Pay",
  "Google Pay",
  "Samsung Pay",
];

export const purchaseUnit = [
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
];

export const printerStatus = ["Online", "Offline", "Out of paper", "Error"];

export const locationTypes = [
  "Table",
  "Room",
  "Seat",
  "Bar",
  "Counter",
  "Spot",
  "Other",
];

export const notificationTypes = ["Warning", "Emergency", "Info", "Message", "Promotion", "Birthday", "Event"];

export const salesInstanceStatus = ["Occupied", "Reserved", "Bill", "Closed"];

export const subscription = ["Free", "Basic", "Premium", "Enterprise"];

export const idTypes = ["National ID", "Passport", "Driving License"];

export const employeeRoles = [
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
  "Client",
  "Other",
];

export const orderStatus = ["Sent", "Done", "Dont Make", "Hold", "Delivered"];
// once it has been started, it can't be cancel
// "Dont Make" means it has been done before it been requested, it cannot be cancel

export const billingStatus = ["Open", "Paid", "Void", "Cancel", "Invitation"];
// OPEN - order is open and can be paid
// PAID - order is paid and can't be changed
// VOID - order been done but is voided by manager, good been lost and business will not be paid, ex: client left without paying, good was badly done and have to be remake, mistake was made
// CANCEL - good been order but has not been done and is cancel by manager, there is no lost for the business, ex: employee order by mistake and cancel it before it is done
// INVITATION - order is an invitation, no payment is required, ex: business is offering a free meal to a client

// metric abreveations for the convert-units library
export const measurementUnit = [
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
];

export const allergens = [
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
];

export const budgetImpact = ["Very Low", "Low", "Medium", "High", "Very High"];

export const inventorySchedule = ["daily", "weekly", "monthly"];

// not in use
// employee can be free to create those subcategories as they wish
export const foodSubCategory = [
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
];

export const beverageSubCategory = [
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
];

export const merchandiseSubCategory = [
  "Clothing",
  "Accessories",
  "Toys & Games",
  "Health & Beauty",
  "Souvenirs",
  "Others",
];

export const othersSubcategory = [
  "Cleaning",
  "Office",
  "Furniture",
  "Disposable",
  "Services",
  "Equipment",
  "Other",
];

export const weekDays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Kept apart from intake.ts so the client can offer the same list the server
// accepts, without pulling the database in with it.

/** Everything that counts toward a day, in the order they are offered. */
export const DRINKS = [
    { value: "water", label: "Water" },
    { value: "sparkling", label: "Sparkling" },
    { value: "tea", label: "Tea" },
    { value: "coffee", label: "Coffee" },
    { value: "juice", label: "Juice" },
    { value: "other", label: "Other" }
] as const;

export const ALLOWED_DRINKS = new Set<string>(DRINKS.map((drink) => drink.value));

export const DRINK_LABELS = new Map<string, string>(DRINKS.map((drink) => [drink.value, drink.label]));

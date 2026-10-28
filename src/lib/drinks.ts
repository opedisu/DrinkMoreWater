// Kept apart from intake.ts so the client can offer the same list the server
// accepts, without pulling the database in with it.

/**
 * What a drink counts for, against the goal.
 *
 * These are a behavioural choice, not a physiological one, and it is worth
 * being honest about which. Measured retention (Maughan et al., 2016, the
 * Beverage Hydration Index) puts tea, coffee and juice statistically level
 * with water; only milk and rehydration solution score meaningfully higher.
 * "Coffee dehydrates you" does not survive measurement at ordinary doses.
 *
 * They are discounted here so that an afternoon of coffee does not read as a
 * day of water, which is the behaviour the app exists to encourage. Retune
 * the numbers freely: this table is the only place they live, and both the
 * SQL and the interface are derived from it.
 */
export const DRINKS = [
    { value: "water", label: "Water", hydration: 1 },
    { value: "sparkling", label: "Sparkling", hydration: 1 },
    { value: "tea", label: "Tea", hydration: 0.95 },
    { value: "coffee", label: "Coffee", hydration: 0.85 },
    { value: "juice", label: "Juice", hydration: 0.85 },
    { value: "other", label: "Other", hydration: 0.75 }
] as const;

export const ALLOWED_DRINKS = new Set<string>(DRINKS.map((drink) => drink.value));

export const DRINK_LABELS = new Map<string, string>(DRINKS.map((drink) => [drink.value, drink.label]));

const HYDRATION = new Map<string, number>(DRINKS.map((drink) => [drink.value, drink.hydration]));

/** Anything unrecognised counts in full, matching the SQL's ELSE branch. */
export function hydrationOf(drink: string): number {
    return HYDRATION.get(drink) ?? 1;
}

/** The millilitres a drink counts for, rounded the way Postgres rounds it. */
export function hydratingMl(amountMl: number, drink: string): number {
    return Math.round(amountMl * hydrationOf(drink));
}

/**
 * The same sum, in SQL. Every total that is measured against a goal uses
 * this, so the server and the interface cannot drift apart.
 *
 * Built from the constants above and never from input, so there is nothing
 * here to inject. Raw volume is still the right measure for the
 * drinking-too-much check, which deliberately does not use it.
 */
export const HYDRATING_ML_SQL = `(amount_ml * CASE drink ${DRINKS.map(
    (drink) => `WHEN '${drink.value}' THEN ${drink.hydration}`
).join(" ")} ELSE 1 END)`;

/** COALESCE(ROUND(SUM(...)), 0) over the expression above. */
export const HYDRATING_SUM_SQL = `COALESCE(ROUND(SUM(${HYDRATING_ML_SQL})), 0)`;

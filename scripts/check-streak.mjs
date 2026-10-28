#!/usr/bin/env node
/* Checks the streak rules. Run with `npm run check`. */

import assert from "node:assert/strict";
import { GRACE_INTERVAL_DAYS, graceAvailable, streakAfterGoal, streakSurvives } from "../src/lib/streak.ts";

// An unbroken run.
assert.deepEqual(streakAfterGoal(5, 1, null), { streak: 6, repaired: false });

// One missed day, never repaired before: forgiven, and today still counts once.
assert.deepEqual(streakAfterGoal(5, 2, null), { streak: 6, repaired: true });

// One missed day, but a repair was used too recently.
assert.deepEqual(streakAfterGoal(5, 2, GRACE_INTERVAL_DAYS - 1), { streak: 1, repaired: false });

// One missed day, with the repair available again.
assert.deepEqual(streakAfterGoal(5, 2, GRACE_INTERVAL_DAYS), { streak: 6, repaired: true });

// Two missed days is past saving, however long since the last repair.
assert.deepEqual(streakAfterGoal(5, 3, null), { streak: 1, repaired: false });
assert.deepEqual(streakAfterGoal(5, 9, 99), { streak: 1, repaired: false });

// A first ever goal, and a clock that has moved backwards.
assert.deepEqual(streakAfterGoal(0, 1, null), { streak: 1, repaired: false });
assert.deepEqual(streakAfterGoal(5, 0, null), { streak: 1, repaired: false });

// Survival on read matches: alive through a repairable gap, dead past it.
assert.equal(streakSurvives(1, null), true);
assert.equal(streakSurvives(2, null), true);
assert.equal(streakSurvives(2, 3), false);
assert.equal(streakSurvives(3, null), false);

// A gap of zero or less is the same day, or a zone change; never a break.
assert.equal(streakSurvives(0, null), true);
assert.equal(streakSurvives(-1, null), true);

assert.equal(graceAvailable(null), true);
assert.equal(graceAvailable(0), false);
assert.equal(graceAvailable(GRACE_INTERVAL_DAYS), true);

console.log("streak rules: ok");

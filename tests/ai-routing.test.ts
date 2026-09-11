import assert from "node:assert/strict";
import test from "node:test";
import { routeSpecialists, specialistHasData } from "../lib/ai/router";

test("today routes to planning", () => assert.deepEqual(routeSpecialists("What should I do today?", "decide"), ["planner"]));
test("falling health score uses health history", () => assert.deepEqual(routeSpecialists("Why is my Health Score falling?", "decide"), ["health", "progress"]));
test("purchase affordability stays in finance", () => assert.deepEqual(routeSpecialists("Can I afford a $1,000 purchase?", "decide"), ["finance"]));
test("overall score adds the relevant weak domain", () => assert.deepEqual(routeSpecialists("Why did my overall score fall?", "decide", {scoreOpportunity:"fitness"}), ["progress", "health"]));
test("missed workout timing crosses planning, health, and history", () => assert.deepEqual(routeSpecialists("Why am I missing workouts on busy days?", "decide"), ["planner", "health", "progress"]));
test("finance refuses analysis when no finance data is connected",()=>assert.equal(specialistHasData("finance",{finance:false,health:true,workout:true,nutrition:true}),false));

import assert from "node:assert/strict";
import { test } from "node:test";
import { attribution, validateSignup } from "../lib/website/attribution";
test("normalizes email, validates required fields, and leaves research optional", () => {
  assert.deepEqual(validateSignup({name:"  Beta Test ",email:" YOU@example.COM "}),{name:"Beta Test",email:"you@example.com",improvement_goal:null,willingness_to_pay:null});
  for (const willingness_to_pay of ["yes","maybe","no"]) assert.equal(validateSignup({name:"Test",email:"test@example.com",willingness_to_pay}).willingness_to_pay,willingness_to_pay);
  for (const input of [{name:"",email:"test@example.com"},{name:"Test",email:"invalid"},{name:"Test",email:"test@example.com",improvement_goal:"x".repeat(1001)},{name:"Test",email:"test@example.com",willingness_to_pay:"paid"}]) assert.throws(()=>validateSignup(input));
});
test("captures explicit and inferred sources without storing referrer paths or query parameters", () => {
  assert.equal(attribution({}).source,"direct");
  assert.equal(attribution({utm_source:"instagram",utm_medium:"social",utm_campaign:"private_beta"}).source,"instagram");
  assert.equal(attribution({referral_source:"https://l.instagram.com/?secret=private"}).source,"instagram");
  assert.equal(attribution({referral_source:"https://www.tiktok.com/path"}).source,"tiktok");
  assert.equal(attribution({referral_source:"https://example.org/private?email=private"}).referral_source,"example.org");
  assert.equal(attribution({referral_source:"https://example.org/private"}).source,"referral");
  assert.equal(attribution({utm_source:"partner",referral_source:"https://instagram.com"}).source,"other");
  assert.equal(attribution({referral_source:"https://projectyouplus.com/#beta"}).source,"direct");
  assert.equal(attribution({utm_source:"instagram",utm_campaign:"x".repeat(500)}).utm_campaign?.length,120);
});

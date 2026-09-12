import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canViewWebsite, conversionRate, websiteDays } from '../lib/website/overview-types';
import { serializeStructuredData, websiteStructuredData, WEBSITE_URL } from '../lib/website/seo';
test('website data is restricted to active owner/admin roles at the access gate',()=>{
  assert.equal(canViewWebsite('owner'),true); assert.equal(canViewWebsite('admin'),true);
  for(const role of ['analyst','support','member','', 'OWNER']) assert.equal(canViewWebsite(role),false);
});
test('analytics ranges and conversion distinguish no traffic from zero conversion',()=>{
  assert.equal(websiteDays('7'),7);assert.equal(websiteDays(90),90);
  for(const value of [null,undefined,0,999,'all','7abc'])assert.equal(websiteDays(value),30);
  assert.equal(conversionRate(0,0),'—');assert.equal(conversionRate(0,8),'0.0%');assert.equal(conversionRate(1,8),'12.5%');
});
test('structured data preserves the canonical brand and safely serializes script content',()=>{
  assert.equal(websiteStructuredData['@graph'].find(item=>item['@type']==='WebSite')?.url,WEBSITE_URL);
  const json=serializeStructuredData({description:'</script><script>alert(1)</script>'});assert.ok(!json.includes('<'));assert.deepEqual(JSON.parse(json),{description:'</script><script>alert(1)</script>'});
});

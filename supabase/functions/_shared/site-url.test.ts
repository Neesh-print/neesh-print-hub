import { isAllowedSiteOrigin, resolveEmailSiteUrl } from './site-url.ts'

const assertEquals = (a: unknown, b: unknown) => { if (a !== b) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`) }

Deno.test('allows Neesh origins and localhost only', () => {
  assertEquals(isAllowedSiteOrigin('https://neesh.art'), true)
  assertEquals(isAllowedSiteOrigin('https://app.neesh.art/some/path'), true)
  assertEquals(isAllowedSiteOrigin('http://localhost:8080'), true)
  assertEquals(isAllowedSiteOrigin('http://neesh.art'), false)
  assertEquals(isAllowedSiteOrigin('https://neesh.art.evil.com'), false)
  assertEquals(isAllowedSiteOrigin('https://evil.com'), false)
  assertEquals(isAllowedSiteOrigin('javascript:alert(1)'), false)
  assertEquals(isAllowedSiteOrigin('not a url'), false)
})

Deno.test('falls back to SITE_URL, then production', () => {
  assertEquals(resolveEmailSiteUrl('https://app.neesh.art/x', null), 'https://app.neesh.art')
  assertEquals(resolveEmailSiteUrl('https://evil.com', 'https://www.neesh.art'), 'https://www.neesh.art')
  assertEquals(resolveEmailSiteUrl('https://evil.com', 'http://192.168.1.4:8081'), 'https://neesh.art')
  assertEquals(resolveEmailSiteUrl('https://evil.com', 'http://localhost:8081'), 'https://neesh.art')
  assertEquals(resolveEmailSiteUrl('http://localhost:8080', 'https://www.neesh.art'), 'http://localhost:8080')
  assertEquals(resolveEmailSiteUrl(undefined, null), 'https://neesh.art')
})

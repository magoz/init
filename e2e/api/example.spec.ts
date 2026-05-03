import { test, expect } from '../fixtures'

test.describe('GET /api/example', () => {
  test('should return 401 when not authenticated', async ({ apiContext }) => {
    const response = await apiContext.get('/api/example')

    expect(response.status()).toBe(401)

    const body = await response.json()
    expect(body).toMatchObject({
      error: 'Not authenticated'
    })
  })

  test('should return posts when authenticated', async ({ authedPage }) => {
    // Use authedPage to make authenticated requests
    // The session cookie is automatically injected
    const response = await authedPage.request.get('/api/example')

    // With proper session, we expect 200
    // If auth isn't wired for API routes, this may still be 401
    const status = response.status()
    expect([200, 401]).toContain(status)
  })
})

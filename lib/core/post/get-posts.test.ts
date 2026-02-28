import { describe, expect, it } from '@effect/vitest'
import { Effect, Duration, Fiber } from 'effect'
import * as TestClock from 'effect/testing/TestClock'

/**
 * Demonstrates @effect/vitest test variants
 *
 * These are minimal examples showing when to use each variant.
 * For mock services, see test-3 (layer sharing).
 * For error testing, see test-6 (Effect.result, Effect.exit).
 *
 * v4 changes:
 * - it.effect now provides Scope (it.scoped merged into it.effect)
 * - it.live provides Scope too (it.scopedLive merged into it.live)
 * - TestClock moved to effect/testing/TestClock
 * - Effect.fork → Effect.forkChild
 */

describe('it.effect test variants', () => {
  /**
   * it.effect - Use for most tests (provides TestClock + Scope)
   *
   * TestClock lets you control time without real delays.
   * Time doesn't advance unless you call TestClock.adjust().
   * In v4, it.effect also provides Scope (no separate it.scoped needed).
   */
  it.effect('processes delayed operation instantly with TestClock', () =>
    Effect.gen(function* () {
      // Fork an effect that sleeps for 5 minutes
      const fiber = yield* Effect.forkChild(
        Effect.sleep(Duration.minutes(5)).pipe(Effect.map(() => 'done'))
      )

      // Advance the TestClock - no real waiting!
      yield* TestClock.adjust(Duration.minutes(5))

      // Fiber completes instantly
      const result = yield* Fiber.join(fiber)
      expect(result).toBe('done')
    })
  )

  /**
   * it.live - Use when you need real time or external IO
   *
   * Unlike it.effect, this actually waits for real time to pass.
   * In v4, it.live also provides Scope (no separate it.scopedLive needed).
   */
  it.live('waits for real time to pass', () =>
    Effect.gen(function* () {
      const start = Date.now()

      // This actually waits 50ms
      yield* Effect.sleep(Duration.millis(50))

      const elapsed = Date.now() - start
      expect(elapsed).toBeGreaterThanOrEqual(45) // Allow some tolerance
    })
  )

  /**
   * Resource cleanup with it.effect
   *
   * In v4, it.effect provides Scope automatically.
   * acquireRelease resources are cleaned up when the test scope closes.
   */
  it.effect('manages resources with automatic cleanup', () =>
    Effect.gen(function* () {
      const cleanups: string[] = []

      // Create a resource that tracks cleanup
      const resource = yield* Effect.acquireRelease(
        Effect.succeed({ id: 'test-resource', status: 'active' }),
        r =>
          Effect.sync(() => {
            cleanups.push(`cleaned-${r.id}`)
          })
      )

      expect(resource.status).toBe('active')
      expect(cleanups).toHaveLength(0)

      // Cleanup happens automatically after test completes
      // (cleanups.length will be 1 after test finishes)
    })
  )

  /**
   * Real time with resource cleanup using it.live
   *
   * In v4, it.live provides Scope automatically.
   */
  it.live('real time with resource cleanup', () =>
    Effect.gen(function* () {
      const start = Date.now()
      const cleanups: string[] = []

      const resource = yield* Effect.acquireRelease(Effect.succeed({ timestamp: start }), () =>
        Effect.sync(() => {
          cleanups.push('cleaned')
        })
      )

      // Actually waits 10ms
      yield* Effect.sleep(Duration.millis(10))

      const elapsed = Date.now() - resource.timestamp
      expect(elapsed).toBeGreaterThanOrEqual(9)
      expect(cleanups).toHaveLength(0) // Cleanup happens after test
    })
  )
})

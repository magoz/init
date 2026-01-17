import { Data } from 'effect'

export class BetterAuthApiError extends Data.TaggedError('BetterAuthApiError')<{
  error: unknown
}> {}

export class BetterAuthConfigError extends Data.TaggedError('BetterAuthConfigError')<{
  message: string
}> {}

export class BetterAuthSessionError extends Data.TaggedError('BetterAuthSessionError')<{
  message: string
}> {}

export class UnauthenticatedError extends Data.TaggedError('UnauthenticatedError')<{
  message: string
}> {}

export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  message: string
}> {}

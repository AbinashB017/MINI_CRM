import { Request, Response, NextFunction, RequestHandler } from 'express'

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<unknown>

/**
 * Wraps an async Express handler so thrown errors are passed to next()
 * instead of crashing the process. Use on every async route handler.
 */
export function asyncHandler(fn: AsyncFn): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

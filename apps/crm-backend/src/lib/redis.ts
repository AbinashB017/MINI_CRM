/**
 * Redis connection options for BullMQ.
 *
 * BullMQ v5 bundles its own internal ioredis, so passing a shared ioredis
 * instance causes a type conflict between the two ioredis versions.
 * Solution: always pass a plain connection OPTIONS object — BullMQ creates
 * its own ioredis client internally.
 *
 * Upstash requires TLS (rediss://) and the following BullMQ-required options:
 *   - maxRetriesPerRequest: null  (BullMQ requirement)
 *   - enableOfflineQueue: false   (BullMQ requirement)
 */

function parseRedisUrl(url: string) {
  // rediss://default:<token>@<host>:<port>
  const u = new URL(url)
  return {
    host:     u.hostname,
    port:     parseInt(u.port || '6379', 10),
    username: u.username || 'default',
    password: decodeURIComponent(u.password),
    tls:      url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  }
}

const REDIS_URL = process.env.UPSTASH_REDIS_URL

if (!REDIS_URL) {
  throw new Error('UPSTASH_REDIS_URL is not set in environment variables')
}

const parsed = parseRedisUrl(REDIS_URL)

/**
 * Plain connection options — pass this directly to BullMQ Queue / Worker.
 * BullMQ will construct its own ioredis instance from these options.
 */
export const bullMQConnection = {
  host:                  parsed.host,
  port:                  parsed.port,
  username:              parsed.username,
  password:              parsed.password,
  tls:                   parsed.tls,
  maxRetriesPerRequest:  null,   // required by BullMQ
  enableOfflineQueue:    false,  // required by BullMQ
} as const

export default bullMQConnection

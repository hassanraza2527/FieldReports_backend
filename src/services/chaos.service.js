const { z } = require('zod');

/**
 * In-memory failure-injection settings. Reset on every server restart (on purpose).
 *
 *  latencyMs         delay every /api/reports request
 *  hangRate          0..1  never answer (client must time out)
 *  dropRate          0..1  kill the connection BEFORE doing any work
 *  errorRate         0..1  answer with errorStatus BEFORE doing any work
 *  errorStatus       status used by errorRate (5xx/408/429 = retryable, 4xx = permanent)
 *  loseResponseRate  0..1  do the work, then kill the connection instead of answering
 *  rejectUploads     true  => every image PUT answers 422
 */
const DEFAULTS = Object.freeze({
  latencyMs: 0,
  hangRate: 0,
  dropRate: 0,
  errorRate: 0,
  errorStatus: 503,
  loseResponseRate: 0,
  rejectUploads: false,
});

const rate = z.number().min(0).max(1);

const patchSchema = z
  .object({
    latencyMs: z.number().int().min(0).max(120000),
    hangRate: rate,
    dropRate: rate,
    errorRate: rate,
    errorStatus: z.number().int().min(400).max(599),
    loseResponseRate: rate,
    rejectUploads: z.boolean(),
    reset: z.boolean(),
  })
  .partial()
  .strict();

let state = { ...DEFAULTS };

const get = () => ({ ...state });

function apply(patch) {
  if (patch.reset) {
    state = { ...DEFAULTS };
    return get();
  }
  const { reset, ...values } = patch;
  state = { ...state, ...values };
  return get();
}

module.exports = { DEFAULTS, patchSchema, get, apply };

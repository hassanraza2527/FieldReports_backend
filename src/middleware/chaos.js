const chaos = require('../services/chaos.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const roll = (probability) => probability > 0 && Math.random() < probability;

/**
 * Failure injection for /api/reports/*. Runs BEFORE auth so it behaves like a bad network.
 * Settings are changed through /api/admin/chaos.
 */
module.exports = async function chaosMiddleware(req, res, next) {
  try {
    const c = chaos.get();

    if (roll(c.hangRate)) {
      console.log(`[chaos] hang      ${req.method} ${req.originalUrl}`);
      return; // never answer, never call next()
    }

    if (c.latencyMs > 0) await sleep(c.latencyMs);

    if (roll(c.dropRate)) {
      console.log(`[chaos] drop      ${req.method} ${req.originalUrl}`);
      return req.socket.destroy();
    }

    if (roll(c.errorRate)) {
      console.log(`[chaos] ${c.errorStatus}       ${req.method} ${req.originalUrl}`);
      return res.status(c.errorStatus).json({
        error: { code: 'CHAOS', message: `Injected failure (${c.errorStatus})` },
      });
    }

    const isImageUpload = req.method === 'PUT' && /\/images\//.test(req.path);
    if (c.rejectUploads && isImageUpload) {
      console.log(`[chaos] reject    ${req.method} ${req.originalUrl}`);
      return res.status(422).json({
        error: { code: 'CHAOS_UPLOAD_REFUSED', message: 'Uploads are being refused' },
      });
    }

    if (roll(c.loseResponseRate)) {
      // Let the request run to completion, then throw the response away.
      console.log(`[chaos] lose-resp ${req.method} ${req.originalUrl}`);
      res.end = () => {
        req.socket.destroy();
        return res;
      };
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

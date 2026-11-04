module.exports = function requestLogger(req, res, next) {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)`);
  });
  res.on('close', () => {
    if (!res.writableFinished) console.log(`${req.method} ${req.originalUrl} -> ABORTED`);
  });
  next();
};

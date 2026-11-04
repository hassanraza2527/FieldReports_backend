const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
app.use(requestLogger);
app.use(express.json({ limit: '100kb' })); // JSON only; image routes use their own raw parser

app.use(routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

const { z } = require('zod');

const email = z.string().trim().toLowerCase().email().max(254);

const register = {
  body: z.object({
    email,
    password: z.string().min(8, 'at least 8 characters').max(72, 'at most 72 characters'),
    name: z.string().trim().min(1).max(100),
  }),
};

const login = {
  body: z.object({
    email,
    password: z.string().min(1).max(72),
  }),
};

module.exports = { register, login };

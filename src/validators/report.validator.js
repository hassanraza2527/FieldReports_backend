const { z } = require('zod');

const reportParams = z.object({ reportId: z.string().uuid() });
const imageParams = z.object({ reportId: z.string().uuid(), imageId: z.string().uuid() });

const upsert = {
  params: reportParams,
  body: z.object({
    description: z.string().trim().min(1, 'description is required').max(2000),
    imageIds: z
      .array(z.string().uuid())
      .min(1, 'at least 1 image is required')
      .max(5, 'at most 5 images are allowed')
      .refine((ids) => new Set(ids).size === ids.length, 'imageIds must be unique'),
  }),
};

const byReport = { params: reportParams };
const byImage = { params: imageParams };

const list = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().datetime({ offset: true }).optional(),
  }),
};

module.exports = { upsert, byReport, byImage, list };

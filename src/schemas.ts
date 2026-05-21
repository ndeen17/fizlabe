import { z } from 'zod';

export const CreateCategoryLimit = z.object({
  name: z.string().trim().min(1).max(80),
  limitAmount: z.number().positive(),
  period: z.literal('monthly').optional().default('monthly')
});
export type CreateCategoryLimitInput = z.infer<typeof CreateCategoryLimit>;

export const CreateActivity = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(200),
  occurredAt: z.string().datetime().optional()
});
export type CreateActivityInput = z.infer<typeof CreateActivity>;

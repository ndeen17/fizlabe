import { z } from 'zod';

export const CreateCategoryLimit = z.object({
  name: z.string().trim().min(1).max(80),
  limitAmount: z.number().positive(),
  period: z.literal('monthly').optional().default('monthly')
});
export type CreateCategoryLimitInput = z.infer<typeof CreateCategoryLimit>;

export const UpdateCategoryLimit = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    limitAmount: z.number().positive().optional()
  })
  .refine((v) => v.name !== undefined || v.limitAmount !== undefined, {
    message: 'At least one of name or limitAmount is required'
  });
export type UpdateCategoryLimitInput = z.infer<typeof UpdateCategoryLimit>;

export const CreateActivity = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive(),
  description: z.string().trim().min(1).max(200),
  occurredAt: z.string().datetime().optional()
});
export type CreateActivityInput = z.infer<typeof CreateActivity>;

export const UpdateActivity = z
  .object({
    categoryId: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    description: z.string().trim().min(1).max(200).optional(),
    occurredAt: z.string().datetime().optional()
  })
  .refine(
    (v) =>
      v.categoryId !== undefined ||
      v.amount !== undefined ||
      v.description !== undefined ||
      v.occurredAt !== undefined,
    { message: 'At least one field is required' }
  );
export type UpdateActivityInput = z.infer<typeof UpdateActivity>;

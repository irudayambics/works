import { z } from 'zod';

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; errors: ValidationIssue[] };

export function validate<Schema extends z.ZodTypeAny>(
  schema: Schema,
  input: unknown
): ValidationResult<z.infer<Schema>> {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '',
        message: issue.message,
      })),
    };
  }

  return { ok: true, data: result.data };
}

export const todoSchemas = {
  create: z.object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
    description: z
      .string()
      .max(2000, 'Description is too long')
      .transform((value) => value.trim())
      .optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    dueAt: z.string().trim().min(1).optional(),
  }),
  update: z
    .object({
      title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long').optional(),
      description: z
        .union([
          z
            .string()
            .max(2000, 'Description is too long')
            .transform((value) => value.trim()),
          z.null(),
        ])
        .optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      dueAt: z.union([z.string().trim().min(1), z.null()]).optional(),
      completed: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: 'No fields to update',
      path: [],
    }),
  listQuery: z.object({
    cursor: z.string().optional(),
    limit: z
      .string()
      .transform((value) => Number.parseInt(value, 10))
      .refine((value) => Number.isInteger(value) && value >= 1 && value <= 100, {
        message: 'Limit must be between 1 and 100',
      })
      .optional(),
    includeCompleted: z.enum(['true', 'false']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
  }),
};

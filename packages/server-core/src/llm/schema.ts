import { z } from 'zod';

export const structuredModifyOutputSchema = z.object({
  after: z.string().min(1),
  explanation: z.string().optional(),
  confidence: z.number().min(0).max(1).optional()
});

export type StructuredModifyOutput = z.infer<typeof structuredModifyOutputSchema>;

export const structuredModifyOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['after'],
  properties: {
    after: { type: 'string' },
    explanation: { type: 'string' },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  }
} as const;

export const multiFilePlanOutputSchema = z.object({
  files: z.array(
    z.object({
      filePath: z.string().min(1),
      instruction: z.string().min(1),
      reason: z.string().optional()
    })
  ).default([])
});

export const multiFilePlanOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['filePath', 'instruction'],
        properties: {
          filePath: { type: 'string' },
          instruction: { type: 'string' },
          reason: { type: 'string' }
        }
      }
    }
  }
} as const;

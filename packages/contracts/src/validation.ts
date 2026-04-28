import { z } from 'zod';

// ── Pagination schemas ───────────────────────────────────────────────

export const PaginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    q: z.string().optional(),
});

export const CursorPaginationSchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().optional(),
    q: z.string().optional(),
});

export const IdParamSchema = z.object({
    id: z.string().min(1, 'ID is required'),
});

// ── Inferred types ───────────────────────────────────────────────────

export type PaginationParams = z.infer<typeof PaginationSchema>;
export type CursorPaginationParams = z.infer<typeof CursorPaginationSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;

// ── Pagination metadata ──────────────────────────────────────────────

export interface PaginationMeta {
    total?: number;
    limit: number;
    offset?: number;
    hasMore?: boolean;
    nextCursor?: string;
    prevCursor?: string;
}

import type { AppError } from '../errors';

export type Result<T, E = AppError | Error> = { ok: true; data: T } | { ok: false; error: E };

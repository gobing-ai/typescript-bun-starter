import type { DbClient } from './adapter';

export abstract class BaseDao {
    protected constructor(protected readonly db: DbClient) {}

    protected now(): number {
        return Date.now();
    }
}

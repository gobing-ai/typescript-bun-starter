import { describe, expect, test } from 'bun:test';
import * as core from '../src/index';

describe('@starter/core barrel (index.ts)', () => {
    test('exports database primitives', () => {
        expect(core.createDbAdapter).toBeDefined();
        expect(core.BaseDao).toBeDefined();
        expect(core.EntityDao).toBeDefined();
        expect(core.QueueJobDao).toBeDefined();
        expect(core.applyMigrations).toBeDefined();
    });

    test('exports database client helpers', () => {
        expect(core.getDb).toBeDefined();
        expect(core.getDefaultAdapter).toBeDefined();
        expect(core._resetAdapter).toBeDefined();
    });

    test('exports column helpers', () => {
        expect(core.standardColumns).toBeDefined();
        expect(core.standardColumnsWithSoftDelete).toBeDefined();
        expect(core.buildStandardColumns).toBeDefined();
        expect(core.buildStandardColumnsWithSoftDelete).toBeDefined();
        expect(core.nowTimestamp).toBeDefined();
    });

    test('exports error classes', () => {
        expect(core.AppError).toBeDefined();
        expect(core.ValidationError).toBeDefined();
        expect(core.NotFoundError).toBeDefined();
        expect(core.ConflictError).toBeDefined();
        expect(core.InternalError).toBeDefined();
        expect(core.isAppError).toBeDefined();
    });

    test('exports API response helpers', () => {
        expect(core.successResponse).toBeDefined();
        expect(core.errorResponse).toBeDefined();
        expect(core.badRequestResponse).toBeDefined();
        expect(core.notFoundResponse).toBeDefined();
    });

    test('exports telemetry', () => {
        expect(core.traceAsync).toBeDefined();
        expect(core.initTelemetry).toBeDefined();
        expect(core.shutdownTelemetry).toBeDefined();
        expect(core.initMetrics).toBeDefined();
        expect(core.shutdownMetrics).toBeDefined();
    });

    test('exports logger', () => {
        expect(core.logger).toBeDefined();
    });

    test('exports config', () => {
        expect(core.CORE_CONFIG).toBeDefined();
        expect(core.CORE_CONFIG.defaultDbPath).toBe('data/app.db');
    });

    test('exports job queue', () => {
        expect(core.DBJobQueue).toBeDefined();
        expect(core.DBQueueConsumer).toBeDefined();
    });

    test('exports scheduler', () => {
        expect(core.initScheduler).toBeDefined();
        expect(core.NoOpSchedulerAdapter).toBeDefined();
    });

    test('exports date helpers', () => {
        expect(core.nowMs).toBeDefined();
        expect(core.fromMs).toBeDefined();
        expect(core.toMs).toBeDefined();
    });

    test('exports access helpers', () => {
        expect(core.getRoles).toBeDefined();
        expect(core.hasRole).toBeDefined();
    });

    test('exports output helpers', () => {
        expect(core.echo).toBeDefined();
        expect(core.echoError).toBeDefined();
    });
});

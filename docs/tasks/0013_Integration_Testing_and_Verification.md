---
name: Integration Testing and Verification
description: Integration Testing and Verification
status: Done
created_at: 2026-04-16T21:02:00.419Z
updated_at: 2026-04-16T21:02:00.419Z
folder: docs/tasks
type: task
preset: "standard"
impl_progress:
  planning: done
  design: done
  implementation: done
  review: done
  testing: done
---
## Parent Task

- [Parent Task 0006: Scaffold CLI Commands](./0006_Scaffold_CLI_Commands.md)

## Requirements

### End-to-End Tests

Create comprehensive integration tests that verify the full workflow:

```typescript
// apps/cli/tests/commands/scaffold-integration.test.ts

describe('Scaffold Integration', () => {
    const testProject = createTempProject();

    afterEach(() => {
        testProject.cleanup();
    });

    describe('tbs scaffold init', () => {
        it('should initialize project with new identity', async () => {
            const result = await testProject.run('tbs scaffold init --name test-project --scope @test --dry-run');
            expect(result.exitCode).toBe(0);
            expect(result.stdout).toContain('preview');
        });

        it('should update all identity fields', async () => {
            await testProject.run('tbs scaffold init --name my-app --scope @myorg');
            const contract = testProject.readJson('contracts/project-contracts.json');
            expect(contract.projectIdentity.projectSlug).toBe('my-app');
            expect(contract.projectIdentity.rootPackageName).toBe('@myorg/typescript-bun-starter');
        });
    });

    describe('tbs scaffold add/remove', () => {
        it('should add and remove webapp feature', async () => {
            // Add
            await testProject.run('tbs scaffold add webapp');
            expect(testProject.exists('apps/web/src/pages/index.astro')).toBe(true);

            // Remove
            await testProject.run('tbs scaffold remove webapp');
            expect(testProject.exists('apps/web/src/pages/index.astro')).toBe(false);
        });
    });

    > **Note:** The `skills` CRUD domain is built-in and always installed — no add/remove test needed.

    describe('tbs scaffold validate', () => {
        it('should pass validation on clean project', async () => {
            const result = await testProject.run('tbs scaffold validate');
            expect(result.exitCode).toBe(0);
        });
    });
});
```

### Test Scenarios

1. **Init Flow**
   - [ ] Init with all args
   - [ ] Init with --dry-run
   - [ ] Init with missing required args
   - [ ] Init with invalid scope
   - [ ] Init updates all text files

2. **Add/Remove Flow**
   - [ ] Add each optional feature (cli, server, webapp)
   - [ ] Remove each optional feature (cli, server, webapp)
   - [ ] Add already-installed feature (error)
   - [ ] Remove not-installed feature (error)
   - [ ] Add/remove with --dry-run

> **Note:** The `skills` CRUD domain is built-in and always installed — not part of add/remove flow.

3. **Validate Flow**
   - [ ] Validate clean project (pass)
   - [ ] Validate with missing workspace (error)
   - [ ] Validate with --fix
   - [ ] Validate with --json

4. **List Flow**
   - [ ] List shows correct status
   - [ ] List --json is valid

### Verification

Run full test suite:

```bash
bun run test
bun run check  # lint, typecheck, coverage
```

### Acceptance Criteria

1. [ ] All integration tests pass
2. [ ] `bun run check` passes
3. [ ] Coverage > 80% for scaffold commands
4. [ ] No regressions in existing tests

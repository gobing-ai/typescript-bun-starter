# Skills Template

This directory should contain the template files for the skills domain.

To populate, run:
```bash
bun run generate:scaffold-templates
```

Or manually place the baseline skills files here preserving the directory structure:
- `packages/core/src/schemas/skill.ts`
- `packages/core/src/services/skill-service.ts`
- `apps/cli/src/commands/skill-create.ts`
- `apps/cli/src/commands/skill-delete.ts`
- `apps/cli/src/commands/skill-get.ts`
- `apps/cli/src/commands/skill-list.ts`
- `apps/server/src/routes/skills.ts`

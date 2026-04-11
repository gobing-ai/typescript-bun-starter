import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { Skill } from "@project/core";
import { SkillService, skillInsertSchema, skillSelectSchema, skillUpdateSchema } from "@project/core";

const app = new OpenAPIHono();
const service = new SkillService();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ParamsSchema = z.object({
  id: z.string().openapi({ param: { name: "id", in: "path" }, example: "abc-123" }),
});

const ErrorSchema = z.object({ error: z.string() });

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const listRoute = createRoute({
  method: "get",
  path: "/skills",
  tags: ["Skills"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(skillSelectSchema) }),
        },
      },
      description: "List all skills",
    },
    500: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Internal server error",
    },
  },
});

const getRoute = createRoute({
  method: "get",
  path: "/skills/{id}",
  tags: ["Skills"],
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: skillSelectSchema }),
        },
      },
      description: "Get a skill by ID",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Skill not found",
    },
  },
});

const postRoute = createRoute({
  method: "post",
  path: "/skills",
  tags: ["Skills"],
  request: {
    body: {
      content: { "application/json": { schema: skillInsertSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ data: skillSelectSchema }),
        },
      },
      description: "Skill created",
    },
    400: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Validation error",
    },
  },
});

const patchRoute = createRoute({
  method: "patch",
  path: "/skills/{id}",
  tags: ["Skills"],
  request: {
    params: ParamsSchema,
    body: {
      content: { "application/json": { schema: skillUpdateSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: skillSelectSchema }),
        },
      },
      description: "Skill updated",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Skill not found",
    },
  },
});

const deleteRoute = createRoute({
  method: "delete",
  path: "/skills/{id}",
  tags: ["Skills"],
  request: {
    params: ParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.null() }),
        },
      },
      description: "Skill deleted",
    },
    404: {
      content: { "application/json": { schema: ErrorSchema } },
      description: "Skill not found",
    },
  },
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

app.openapi(listRoute, async (c) => {
  const result = await service.list();
  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }
  return c.json({ data: result.data }, 200);
});

app.openapi(getRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await service.getById(id);
  if (!result.ok) {
    return c.json({ error: result.error.message }, 404);
  }
  return c.json({ data: result.data }, 200);
});

app.openapi(postRoute, async (c) => {
  const input = c.req.valid("json");
  const result = await service.create(input);
  if (!result.ok) {
    return c.json({ error: result.error.message }, 400);
  }
  return c.json({ data: result.data as Skill }, 201);
});

app.openapi(patchRoute, async (c) => {
  const { id } = c.req.valid("param");
  const input = c.req.valid("json");
  const result = await service.update(id, input);
  if (!result.ok) {
    return c.json({ error: result.error.message }, 404);
  }
  return c.json({ data: result.data }, 200);
});

app.openapi(deleteRoute, async (c) => {
  const { id } = c.req.valid("param");
  const result = await service.delete(id);
  if (!result.ok) {
    return c.json({ error: result.error.message }, 404);
  }
  return c.json({ data: null }, 200);
});

export default app;

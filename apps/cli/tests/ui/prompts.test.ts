import { describe, expect, test } from "bun:test";
import {
  createPromptClient,
  getPromptClient,
  type PromptClient,
  setPromptClientForTest,
} from "../../src/ui/prompts";

describe("createPromptClient", () => {
  test("trims required text responses", async () => {
    const prompts = createPromptClient(async () => "  skill-name  ");
    await expect(prompts.promptText("Skill name")).resolves.toBe("skill-name");
  });

  test("returns null for blank optional text responses", async () => {
    const prompts = createPromptClient(async () => "   ");
    await expect(prompts.promptText("Description", { optional: true })).resolves.toBeNull();
  });

  test("returns empty string for blank required responses", async () => {
    const prompts = createPromptClient(async () => "   ");
    await expect(prompts.promptText("Skill name")).resolves.toBe("");
  });

  test("accepts yes/ y confirmation values", async () => {
    const yesPrompts = createPromptClient(async () => "yes");
    const shortYesPrompts = createPromptClient(async () => "Y");

    await expect(yesPrompts.confirm("Delete?")).resolves.toBe(true);
    await expect(shortYesPrompts.confirm("Delete?")).resolves.toBe(true);
  });

  test("treats other confirmation values as false", async () => {
    const prompts = createPromptClient(async () => "no");
    await expect(prompts.confirm("Delete?")).resolves.toBe(false);
  });
});

describe("prompt client overrides", () => {
  test("setPromptClientForTest swaps the active client", async () => {
    const mockClient: PromptClient = {
      async promptText() {
        return "mocked";
      },
      async confirm() {
        return true;
      },
    };

    setPromptClientForTest(mockClient);

    const active = getPromptClient();
    await expect(active.promptText("Skill name")).resolves.toBe("mocked");
    await expect(active.confirm("Delete?")).resolves.toBe(true);

    setPromptClientForTest();
  });
});

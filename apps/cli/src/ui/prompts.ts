import { askWithReadline } from './readline';

export interface PromptClient {
    promptText(message: string, options?: { optional?: boolean }): Promise<string | null>;
    confirm(message: string): Promise<boolean>;
}

type AskQuestion = (question: string) => Promise<string>;

export function createPromptClient(askQuestion: AskQuestion): PromptClient {
    return {
        async promptText(message, options) {
            const suffix = options?.optional ? ' (optional)' : '';
            const answer = await askQuestion(`${message}${suffix}: `);
            const trimmed = answer.trim();

            if (trimmed.length === 0) {
                return options?.optional ? null : '';
            }

            return trimmed;
        },

        async confirm(message) {
            const answer = await askQuestion(`${message} [y/N]: `);
            const normalized = answer.trim().toLowerCase();
            return normalized === 'y' || normalized === 'yes';
        },
    };
}

const defaultPromptClient = createPromptClient(askWithReadline);

let promptClient: PromptClient = defaultPromptClient;

export function getPromptClient(): PromptClient {
    return promptClient;
}

export function setPromptClientForTest(client?: PromptClient): void {
    promptClient = client ?? defaultPromptClient;
}

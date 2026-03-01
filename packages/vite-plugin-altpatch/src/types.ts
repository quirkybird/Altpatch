export type AltPatchPluginOptions = {
  projectRoot?: string;
  apiPrefix?: string;
  enableInDevOnly?: boolean;
  mockModify?: boolean;
  locator?: {
    enabled?: boolean;
    env?: string;
    dataAttribute?: string;
  };
  llm?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    timeoutMs?: number;
    maxTokens?: number;
  };
};

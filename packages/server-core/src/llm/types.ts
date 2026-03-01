export type LlmProviderConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxTokens?: number;
};

export type LlmEngineErrorCode = 'CONFIG_ERROR' | 'UPSTREAM_ERROR' | 'PARSE_ERROR' | 'SCOPE_ERROR';

export type LlmEngineErrorDetails = {
  requestMethod?: string;
  requestUrl?: string;
  status?: number;
  responseBodyPreview?: string;
  timeoutMs?: number;
};

export class LlmEngineError extends Error {
  code: LlmEngineErrorCode;
  details?: LlmEngineErrorDetails;

  constructor(code: LlmEngineErrorCode, message: string, details?: LlmEngineErrorDetails) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = 'LlmEngineError';
  }
}

export function isLlmEngineError(error: unknown): error is LlmEngineError {
  return error instanceof LlmEngineError;
}

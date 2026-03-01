export type ModifyRequest = {
  filePath: string;
  instruction: string;
  relatedFiles?: Array<{ filePath: string; content: string }>;
  scopeMode?: 'local-preferred' | 'strict-local' | 'full-file';
  selection?: { start: number; end: number };
  location?: { line: number; column: number; framework?: string };
  anchor?: { line: number; column: number };
  contextWindow?: { beforeLines: number; afterLines: number };
};

export type MultiFilePlanItem = {
  filePath: string;
  instruction: string;
  reason?: string;
};

export type ModifyResponse = {
  patch: string;
  before: string;
  after: string;
  diff: Array<{ type: 'add' | 'del' | 'ctx'; content: string }>;
  explanation?: string;
  confidence?: number;
  modelTraceId?: string;
};

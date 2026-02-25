export type ModifyRequest = {
  filePath: string;
  instruction: string;
  selection?: { start: number; end: number };
  location?: { line: number; column: number; framework?: string };
  contextWindow?: { beforeLines: number; afterLines: number };
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

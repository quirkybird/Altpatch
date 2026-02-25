export type ModifyRequest = {
  filePath: string;
  instruction: string;
  location?: { line: number; column: number; framework?: string };
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

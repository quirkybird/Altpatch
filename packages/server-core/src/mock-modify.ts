import type { ModifyRequest, ModifyResponse } from './types';
import { buildDiff } from './diff';

export function modifyWithMockLLM(source: string, request: ModifyRequest): ModifyResponse {
  const note = `\n/* AltPatch suggestion: ${request.instruction} */\n`;
  const after = source + note;
  const result = buildDiff(request.filePath, source, after);
  return {
    patch: result.patch,
    before: source,
    after,
    diff: result.diff,
    explanation: '当前为最小可运行版本：使用 mock 引擎追加注释模拟补丁。',
    confidence: 0.72,
    modelTraceId: `mock-${Date.now()}`
  };
}

import { parse } from '@babel/parser';

export type SyntaxValidationResult =
  | { ok: true; parser: string }
  | { ok: false; parser: string; reason: string };

function extensionOf(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('.');
  return idx < 0 ? '' : normalized.slice(idx).toLowerCase();
}

function validateByBabel(content: string, plugins: Array<'typescript' | 'jsx'>, parserName: string): SyntaxValidationResult {
  try {
    parse(content, {
      sourceType: 'module',
      plugins,
      errorRecovery: false
    });
    return { ok: true, parser: parserName };
  } catch (error) {
    return { ok: false, parser: parserName, reason: String(error) };
  }
}

function validateByJson(content: string): SyntaxValidationResult {
  try {
    JSON.parse(content);
    return { ok: true, parser: 'json' };
  } catch (error) {
    return { ok: false, parser: 'json', reason: String(error) };
  }
}

function validateByBalance(content: string): SyntaxValidationResult {
  const stack: string[] = [];
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;

  const openers: Record<string, string> = { '(': ')', '{': '}', '[': ']' };
  const closers = new Set(Object.values(openers));

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];

    if (inSingle || inDouble || inTemplate) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (inSingle && ch === '\'') inSingle = false;
      if (inDouble && ch === '"') inDouble = false;
      if (inTemplate && ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '\'') {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    if (ch in openers) {
      stack.push(openers[ch]);
      continue;
    }
    if (closers.has(ch)) {
      const expected = stack.pop();
      if (expected !== ch) {
        return { ok: false, parser: 'balance', reason: `Bracket mismatch at index ${i}: expected ${expected ?? 'none'}, got ${ch}` };
      }
    }
  }

  if (inSingle || inDouble || inTemplate) {
    return { ok: false, parser: 'balance', reason: 'Unclosed string literal detected.' };
  }
  if (stack.length > 0) {
    return { ok: false, parser: 'balance', reason: `Unclosed bracket(s): ${stack.join(' ')}` };
  }

  return { ok: true, parser: 'balance' };
}

export function validateSyntax(filePath: string, content: string): SyntaxValidationResult {
  const ext = extensionOf(filePath);
  if (ext === '.ts') return validateByBabel(content, ['typescript'], 'babel-typescript');
  if (ext === '.tsx') return validateByBabel(content, ['typescript', 'jsx'], 'babel-tsx');
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return validateByBabel(content, ['jsx'], 'babel-jsx');
  if (ext === '.json') return validateByJson(content);
  return validateByBalance(content);
}

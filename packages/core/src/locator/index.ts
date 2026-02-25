import type { SourceLocation } from '../protocol/messages';
import { locateReact } from './react';
import { locateVue } from './vue';
import { locateSvelte } from './svelte';

export type LocatorAdapter = {
  name: string;
  locate(target: Element): SourceLocation | null;
};

let locatorAdapter: LocatorAdapter | null = null;

export function setLocatorAdapter(adapter: LocatorAdapter | null): void {
  locatorAdapter = adapter;
}

export function getLocatorAdapter(): LocatorAdapter | null {
  return locatorAdapter;
}

export function resolveSourceLocation(target: Element): SourceLocation | null {
  if (locatorAdapter) {
    const resolved = locatorAdapter.locate(target);
    if (resolved) {
      return resolved;
    }
  }
  return locateReact(target) ?? locateVue(target) ?? locateSvelte(target) ?? null;
}

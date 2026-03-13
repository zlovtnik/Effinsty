import type { HTMLInputAttributes } from 'svelte/elements';

export type State = 'idle' | 'loading' | 'success' | 'error';
export type FieldName = 'tenantId' | 'username' | 'password';

export interface LoginLibraryItem {
  name: string;
  href: string;
  summary: string;
}

export type LoginPrinciple = string;

export interface LoginFieldConfig {
  key: FieldName;
  id: string;
  name: string;
  label: string;
  type: 'text' | 'password';
  autocomplete: HTMLInputAttributes['autocomplete'];
}

export interface LoginFieldView extends LoginFieldConfig {
  value: string;
  error: string;
  errorId: string;
  delayIndex: number;
}

export interface LoginAlertView {
  message: string;
  details: string[];
  correlationId: string;
}

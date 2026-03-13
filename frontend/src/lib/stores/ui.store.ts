import { writable } from 'svelte/store';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface UIState {
  notifications: Notification[];
}

export const uiStore = writable<UIState>({
  notifications: [],
});

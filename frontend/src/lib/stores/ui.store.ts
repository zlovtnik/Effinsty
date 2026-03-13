import { writable } from 'svelte/store';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  tone: 'danger' | 'primary';
}

export interface UIState {
  notifications: Notification[];
  confirmModal: ConfirmModalState;
}

const DEFAULT_CONFIRM_MODAL: ConfirmModalState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  tone: 'primary',
};

function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

type ConfirmResolver = ((value: boolean) => void) | null;
let pendingConfirmResolver: ConfirmResolver = null;

function createUiStore() {
  const { subscribe, set, update } = writable<UIState>({
    notifications: [],
    confirmModal: DEFAULT_CONFIRM_MODAL,
  });

  return {
    subscribe,
    enqueueNotification: (type: Notification['type'], message: string) => {
      const notification: Notification = {
        id: createId(),
        type,
        message,
      };

      update((state) => ({
        ...state,
        notifications: [...state.notifications, notification],
      }));

      return notification.id;
    },
    dismissNotification: (id: string) =>
      update((state) => ({
        ...state,
        notifications: state.notifications.filter((item) => item.id !== id),
      })),
    clearNotifications: () =>
      update((state) => ({
        ...state,
        notifications: [],
      })),
    requestConfirmation: (options: {
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      tone?: ConfirmModalState['tone'];
    }): Promise<boolean> => {
      if (pendingConfirmResolver) {
        pendingConfirmResolver(false);
      }

      update((state) => ({
        ...state,
        confirmModal: {
          isOpen: true,
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel ?? 'Confirm',
          cancelLabel: options.cancelLabel ?? 'Cancel',
          tone: options.tone ?? 'primary',
        },
      }));

      return new Promise<boolean>((resolve) => {
        pendingConfirmResolver = resolve;
      });
    },
    resolveConfirmation: (confirmed: boolean) => {
      if (pendingConfirmResolver) {
        pendingConfirmResolver(confirmed);
        pendingConfirmResolver = null;
      }

      update((state) => ({
        ...state,
        confirmModal: DEFAULT_CONFIRM_MODAL,
      }));
    },
    reset: () => {
      if (pendingConfirmResolver) {
        pendingConfirmResolver(false);
        pendingConfirmResolver = null;
      }

      set({
        notifications: [],
        confirmModal: DEFAULT_CONFIRM_MODAL,
      });
    },
  };
}

export const uiStore = createUiStore();

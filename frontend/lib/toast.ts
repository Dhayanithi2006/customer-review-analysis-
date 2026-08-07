type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;

class ToastStore {
  private toasts: ToastMessage[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((l) => l([...this.toasts]));
  }

  show(type: ToastType, title: string, message?: string, duration = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    const toast: ToastMessage = { id, type, title, message, duration };
    this.toasts.push(toast);
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }
  }

  remove(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  success(title: string, message?: string) {
    this.show("success", title, message);
  }

  error(title: string, message?: string) {
    this.show("error", title, message, 6000);
  }

  info(title: string, message?: string) {
    this.show("info", title, message);
  }
}

export const toast = new ToastStore();

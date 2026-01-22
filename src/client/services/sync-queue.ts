import { SYNC_RETRY_DELAYS_MS } from '../../shared/constants/index';

export type SyncOperationType = 'create' | 'update' | 'delete';
export type SyncEntity = 'task' | 'comment' | 'workspace';

export interface SyncOperation {
  id: string;
  type: SyncOperationType;
  entity: SyncEntity;
  entityId: string;
  workspaceId: string;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
}

const STORAGE_KEY = 'taskchute-sync-queue';

class SyncQueue {
  private queue: SyncOperation[] = [];
  private isProcessing = false;
  private onlineHandler: () => void;
  private offlineHandler: () => void;

  constructor() {
    this.loadFromStorage();
    this.onlineHandler = () => {
      void this.processQueue();
    };
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this.offlineHandler = () => {};

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineHandler);
      window.addEventListener('offline', this.offlineHandler);
    }
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored) as SyncOperation[];
      }
    } catch (error) {
      console.error('Failed to load sync queue from storage:', error);
      this.queue = [];
    }
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('Failed to save sync queue to storage:', error);
    }
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  add(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): string {
    const id = this.generateId();
    const newOperation: SyncOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };

    // Deduplicate: remove any pending operations for the same entity
    this.queue = this.queue.filter(
      (op) => !(op.entity === operation.entity && op.entityId === operation.entityId && op.status === 'pending')
    );

    this.queue.push(newOperation);
    this.saveToStorage();

    // Try to process immediately if online
    if (navigator.onLine) {
      void this.processQueue();
    }

    return id;
  }

  remove(id: string): void {
    this.queue = this.queue.filter((op) => op.id !== id);
    this.saveToStorage();
  }

  getAll(): SyncOperation[] {
    return [...this.queue];
  }

  getPending(): SyncOperation[] {
    return this.queue.filter((op) => op.status === 'pending');
  }

  getFailed(): SyncOperation[] {
    return this.queue.filter((op) => op.status === 'failed');
  }

  clear(): void {
    this.queue = [];
    this.saveToStorage();
  }

  clearFailed(): void {
    this.queue = this.queue.filter((op) => op.status !== 'failed');
    this.saveToStorage();
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || !navigator.onLine) return;

    this.isProcessing = true;

    try {
      const pendingOperations = this.getPending();

      for (const operation of pendingOperations) {
        await this.processOperation(operation);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async processOperation(operation: SyncOperation): Promise<void> {
    // Mark as syncing
    const index = this.queue.findIndex((op) => op.id === operation.id);
    if (index === -1) return;

    this.queue[index] = { ...operation, status: 'syncing' };
    this.saveToStorage();

    try {
      await this.executeOperation(operation);

      // Remove successful operation
      this.queue = this.queue.filter((op) => op.id !== operation.id);
      this.saveToStorage();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const retryCount = operation.retryCount + 1;

      if (retryCount < SYNC_RETRY_DELAYS_MS.length) {
        // Schedule retry
        this.queue[index] = {
          ...operation,
          status: 'pending',
          retryCount,
          error: errorMessage,
        };
        this.saveToStorage();

        // Wait and retry
        await this.delay(SYNC_RETRY_DELAYS_MS[retryCount]);
        await this.processOperation(this.queue[index]);
      } else {
        // Mark as failed after max retries
        this.queue[index] = {
          ...operation,
          status: 'failed',
          retryCount,
          error: errorMessage,
        };
        this.saveToStorage();
      }
    }
  }

  private async executeOperation(operation: SyncOperation): Promise<void> {
    const { type, entity, entityId, workspaceId, payload } = operation;
    const baseUrl = '';

    let url: string;
    let method: string;
    let body: string | undefined;

    switch (entity) {
      case 'task':
        switch (type) {
          case 'create':
            url = `${baseUrl}/api/workspaces/${workspaceId}/tasks`;
            method = 'POST';
            body = JSON.stringify(payload);
            break;
          case 'update':
            url = `${baseUrl}/api/workspaces/${workspaceId}/tasks/${entityId}`;
            method = 'PATCH';
            body = JSON.stringify(payload);
            break;
          case 'delete':
            url = `${baseUrl}/api/workspaces/${workspaceId}/tasks/${entityId}`;
            method = 'DELETE';
            break;
          default:
            throw new Error(`Unknown operation type: ${type as string}`);
        }
        break;
      case 'comment':
        switch (type) {
          case 'create':
            url = `${baseUrl}/api/tasks/${entityId}/comments`;
            method = 'POST';
            body = JSON.stringify(payload);
            break;
          case 'update':
            url = `${baseUrl}/api/comments/${entityId}`;
            method = 'PATCH';
            body = JSON.stringify(payload);
            break;
          case 'delete':
            url = `${baseUrl}/api/comments/${entityId}`;
            method = 'DELETE';
            break;
          default:
            throw new Error(`Unknown operation type: ${type as string}`);
        }
        break;
      default:
        throw new Error(`Unknown entity type: ${entity as string}`);
    }

    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'include',
      body,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(errorData.error?.message ?? `HTTP ${response.status}`);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineHandler);
      window.removeEventListener('offline', this.offlineHandler);
    }
  }
}

// Singleton instance
export const syncQueue = new SyncQueue();

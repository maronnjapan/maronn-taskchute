import { describe, it, expect } from 'vitest';
import { createTaskSchema, updateTaskSchema } from '../index';

describe('createTaskSchema', () => {
  describe('estimatedMinutes', () => {
    it('正常な値の場合はバリデーションを通過する', () => {
      const result = createTaskSchema.safeParse({
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: 30,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedMinutes).toBe(30);
      }
    });

    it('undefinedの場合はバリデーションを通過する', () => {
      const result = createTaskSchema.safeParse({
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: undefined,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedMinutes).toBeUndefined();
      }
    });

    it('NaNの場合はundefinedに変換される', () => {
      const result = createTaskSchema.safeParse({
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: NaN,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedMinutes).toBeUndefined();
      }
    });

    it('見積時間なしでタスクを作成できる', () => {
      const result = createTaskSchema.safeParse({
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
      });
      expect(result.success).toBe(true);
    });

    it('負の値の場合はエラーを返す', () => {
      const result = createTaskSchema.safeParse({
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: -1,
      });
      expect(result.success).toBe(false);
    });

    it('1440分を超える場合はエラーを返す', () => {
      const result = createTaskSchema.safeParse({
        title: 'テストタスク',
        scheduledDate: '2024-01-15',
        estimatedMinutes: 1441,
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('updateTaskSchema', () => {
  describe('estimatedMinutes', () => {
    it('正常な値の場合はバリデーションを通過する', () => {
      const result = updateTaskSchema.safeParse({
        estimatedMinutes: 60,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedMinutes).toBe(60);
      }
    });

    it('nullの場合はバリデーションを通過する', () => {
      const result = updateTaskSchema.safeParse({
        estimatedMinutes: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedMinutes).toBeNull();
      }
    });

    it('undefinedの場合はバリデーションを通過する', () => {
      const result = updateTaskSchema.safeParse({
        estimatedMinutes: undefined,
      });
      expect(result.success).toBe(true);
    });

    it('NaNの場合はundefinedに変換される', () => {
      const result = updateTaskSchema.safeParse({
        estimatedMinutes: NaN,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.estimatedMinutes).toBeUndefined();
      }
    });
  });

  describe('actualMinutes', () => {
    it('NaNの場合はundefinedに変換される', () => {
      const result = updateTaskSchema.safeParse({
        actualMinutes: NaN,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actualMinutes).toBeUndefined();
      }
    });

    it('nullの場合はバリデーションを通過する', () => {
      const result = updateTaskSchema.safeParse({
        actualMinutes: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.actualMinutes).toBeNull();
      }
    });
  });
});

import { describe, it, expect } from 'vitest';

/**
 * タスクタイトルのバリデーション
 */
export function validateTaskTitle(title: string): { valid: boolean; error?: string } {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: 'タイトルは必須です' };
  }
  
  if (title.length > 200) {
    return { valid: false, error: 'タイトルは200文字以内で入力してください' };
  }
  
  return { valid: true };
}

/**
 * 見積もり時間のバリデーション
 */
export function validateEstimatedMinutes(minutes: number | undefined): { valid: boolean; error?: string } {
  if (minutes === undefined) {
    return { valid: true };
  }
  
  if (minutes < 0) {
    return { valid: false, error: '見積もり時間は0以上の値を入力してください' };
  }
  
  if (minutes > 1440) {
    return { valid: false, error: '見積もり時間は24時間（1440分）以内で入力してください' };
  }
  
  return { valid: true };
}

/**
 * 日付形式のバリデーション
 */
export function validateScheduledDate(date: string): { valid: boolean; error?: string } {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  
  if (!dateRegex.test(date)) {
    return { valid: false, error: '日付はYYYY-MM-DD形式で入力してください' };
  }
  
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: '有効な日付を入力してください' };
  }
  
  return { valid: true };
}

describe('validateTaskTitle', () => {
  it('正常なタイトルはバリデーションを通過する', () => {
    const result = validateTaskTitle('タスクのタイトル');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('空文字の場合はエラーを返す', () => {
    const result = validateTaskTitle('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('タイトルは必須です');
  });

  it('空白のみの場合はエラーを返す', () => {
    const result = validateTaskTitle('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('タイトルは必須です');
  });

  it('201文字以上の場合はエラーを返す', () => {
    const longTitle = 'あ'.repeat(201);
    const result = validateTaskTitle(longTitle);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('タイトルは200文字以内で入力してください');
  });

  it('200文字ちょうどの場合はバリデーションを通過する', () => {
    const title = 'あ'.repeat(200);
    const result = validateTaskTitle(title);
    expect(result.valid).toBe(true);
  });
});

describe('validateEstimatedMinutes', () => {
  it('undefined の場合はバリデーションを通過する', () => {
    const result = validateEstimatedMinutes(undefined);
    expect(result.valid).toBe(true);
  });

  it('正常な値の場合はバリデーションを通過する', () => {
    expect(validateEstimatedMinutes(30).valid).toBe(true);
    expect(validateEstimatedMinutes(60).valid).toBe(true);
    expect(validateEstimatedMinutes(120).valid).toBe(true);
  });

  it('0の場合はバリデーションを通過する', () => {
    const result = validateEstimatedMinutes(0);
    expect(result.valid).toBe(true);
  });

  it('負の値の場合はエラーを返す', () => {
    const result = validateEstimatedMinutes(-1);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('見積もり時間は0以上の値を入力してください');
  });

  it('1440分（24時間）を超える場合はエラーを返す', () => {
    const result = validateEstimatedMinutes(1441);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('見積もり時間は24時間（1440分）以内で入力してください');
  });

  it('1440分ちょうどの場合はバリデーションを通過する', () => {
    const result = validateEstimatedMinutes(1440);
    expect(result.valid).toBe(true);
  });
});

describe('validateScheduledDate', () => {
  it('正常な日付形式の場合はバリデーションを通過する', () => {
    const result = validateScheduledDate('2024-01-15');
    expect(result.valid).toBe(true);
  });

  it('不正な形式の場合はエラーを返す', () => {
    expect(validateScheduledDate('2024/01/15').valid).toBe(false);
    expect(validateScheduledDate('24-01-15').valid).toBe(false);
    expect(validateScheduledDate('2024-1-15').valid).toBe(false);
  });

  it('存在しない日付の場合はエラーを返す', () => {
    const result = validateScheduledDate('2024-13-01');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('有効な日付を入力してください');
  });

  it('うるう年の2月29日は有効', () => {
    const result = validateScheduledDate('2024-02-29');
    expect(result.valid).toBe(true);
  });

  it('うるう年でない2月29日は無効', () => {
    const result = validateScheduledDate('2023-02-29');
    expect(result.valid).toBe(false);
  });
});

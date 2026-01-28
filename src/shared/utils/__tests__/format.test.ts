import { describe, it, expect } from 'vitest';
import { getDateUnixRange } from '../index';

/**
 * 日付フォーマット関数
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 分を時間表記に変換
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (hours === 0) {
    return `${mins}分`;
  }
  if (mins === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${mins}分`;
}

describe('formatDate', () => {
  it('日付をYYYY-MM-DD形式でフォーマットできる', () => {
    const date = new Date('2024-01-15T12:30:00Z');
    const result = formatDate(date);
    expect(result).toBe('2024-01-15');
  });

  it('月と日が1桁の場合もゼロパディングされる', () => {
    const date = new Date('2024-01-05T00:00:00Z');
    const result = formatDate(date);
    expect(result).toBe('2024-01-05');
  });
});

describe('formatMinutes', () => {
  it('60分未満の場合は「〇分」と表示される', () => {
    expect(formatMinutes(30)).toBe('30分');
    expect(formatMinutes(45)).toBe('45分');
  });

  it('60分ちょうどの場合は「1時間」と表示される', () => {
    expect(formatMinutes(60)).toBe('1時間');
  });

  it('60分以上の場合は「〇時間〇分」と表示される', () => {
    expect(formatMinutes(90)).toBe('1時間30分');
    expect(formatMinutes(125)).toBe('2時間5分');
  });

  it('120分の場合は「2時間」と表示される', () => {
    expect(formatMinutes(120)).toBe('2時間');
  });

  it('0分の場合は「0分」と表示される', () => {
    expect(formatMinutes(0)).toBe('0分');
  });
});

describe('getDateUnixRange', () => {
  it('日付文字列からUTCの開始・終了タイムスタンプを返す', () => {
    const { start, end } = getDateUnixRange('2024-01-15');

    // 2024-01-15 00:00:00 UTC
    expect(start).toBe(Math.floor(new Date('2024-01-15T00:00:00Z').getTime() / 1000));
    // 2024-01-15 23:59:59 UTC
    expect(end).toBe(Math.floor(new Date('2024-01-15T23:59:59Z').getTime() / 1000));
  });

  it('start は end より小さい', () => {
    const { start, end } = getDateUnixRange('2024-06-30');
    expect(start).toBeLessThan(end);
  });

  it('異なる日付で異なる範囲を返す', () => {
    const day1 = getDateUnixRange('2024-01-15');
    const day2 = getDateUnixRange('2024-01-16');

    expect(day2.start).toBeGreaterThan(day1.end);
  });
});

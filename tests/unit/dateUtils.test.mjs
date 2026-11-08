import assert from 'node:assert';
import test from 'node:test';
import { todayLocalISO, getJakartaDayInfo } from '../../frontend/scp_web/src/utils/dateUtils.js';

test('todayLocalISO correctly formats early morning 00:30 WIB without UTC rollback', () => {
  // 2026-11-08 00:30 WIB is 2026-11-07 17:30 UTC
  const earlyMorningWIB = new Date('2026-11-07T17:30:00Z');
  const result = todayLocalISO(earlyMorningWIB);
  assert.strictEqual(result, '2026-11-08', 'Harus 2026-11-08, bukan 2026-11-07!');

  // 2026-11-08 06:59 WIB is 2026-11-07 23:59 UTC
  const justBefore7amWIB = new Date('2026-11-07T23:59:00Z');
  assert.strictEqual(todayLocalISO(justBefore7amWIB), '2026-11-08');

  // Day info test
  const dayInfo = getJakartaDayInfo(earlyMorningWIB);
  assert.strictEqual(dayInfo.dayOfWeek, 7, 'Harus hari Minggu (7)');
  assert.strictEqual(dayInfo.dayName, 'Minggu');
});

test('todayLocalISO returns today date in Asia/Jakarta by default', () => {
  const result = todayLocalISO();
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

import assert from 'node:assert';
import test from 'node:test';
import { calculateSessionStatus } from '../../frontend/scp_web/src/utils/sessionStatusHelper.js';

test('calculateSessionStatus returns upcoming (Segera) before start_time', () => {
  const schedule = {
    id: 1,
    period_number: 1,
    duration_periods: 2,
    resolved_times: { start_time: '07:15:00', end_time: '08:35:00' },
    journal_status: 'not_started',
  };

  // Jam 06:45 WIB (sebelum 07:15)
  const result = calculateSessionStatus(schedule, '06:45');
  assert.strictEqual(result.status, 'upcoming');
  assert.strictEqual(result.label, 'Segera');
  assert.strictEqual(result.badgeVariant, 'neutral');
  assert.strictEqual(result.canOpen, false);
  assert.match(result.description, /dimulai pukul 07:15 WIB/i);
});

test('calculateSessionStatus returns ready (Mulai Jurnal) during session time', () => {
  const schedule = {
    id: 1,
    period_number: 1,
    duration_periods: 2,
    resolved_times: { start_time: '07:15:00', end_time: '08:35:00' },
    journal_status: 'not_started',
  };

  // Jam 07:30 WIB (dalam rentang 07:15 - 08:35)
  const result = calculateSessionStatus(schedule, '07:30');
  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(result.label, 'Mulai Jurnal');
  assert.strictEqual(result.badgeVariant, 'primary');
  assert.strictEqual(result.canOpen, true);
});

test('calculateSessionStatus returns ready (Mulai Jurnal) during 30-min tolerance period', () => {
  const schedule = {
    id: 1,
    period_number: 1,
    duration_periods: 2,
    resolved_times: { start_time: '07:15:00', end_time: '08:35:00' },
    journal_status: 'not_started',
  };

  // Jam 08:50 WIB (sesi selesai 08:35, toleransi s/d 09:05 WIB)
  const result = calculateSessionStatus(schedule, '08:50', 30);
  assert.strictEqual(result.status, 'ready');
  assert.strictEqual(result.canOpen, true);
  assert.strictEqual(result.deadlineTime, '09:05');
});

test('calculateSessionStatus returns expired (Sesi Telah Berakhir) past tolerance limit', () => {
  const schedule = {
    id: 1,
    period_number: 1,
    duration_periods: 2,
    resolved_times: { start_time: '07:15:00', end_time: '08:35:00' },
    journal_status: 'not_started',
  };

  // Jam 09:10 WIB (melewati batas toleransi 09:05 WIB)
  const result = calculateSessionStatus(schedule, '09:10', 30);
  assert.strictEqual(result.status, 'expired');
  assert.strictEqual(result.label, 'Sesi Telah Berakhir');
  assert.strictEqual(result.badgeVariant, 'error');
  assert.strictEqual(result.canOpen, false);
});

test('calculateSessionStatus returns completed (Selesai) when journal is completed regardless of time', () => {
  const schedule = {
    id: 1,
    period_number: 1,
    duration_periods: 2,
    resolved_times: { start_time: '07:15:00', end_time: '08:35:00' },
    journal_status: 'completed',
  };

  // Jam 14:00 WIB (sore hari)
  const result = calculateSessionStatus(schedule, '14:00');
  assert.strictEqual(result.status, 'completed');
  assert.strictEqual(result.label, 'Selesai Disimpan');
  assert.strictEqual(result.badgeVariant, 'success');
  assert.strictEqual(result.canOpen, true);
});

test('calculateSessionStatus handles teaching exemptions from academic calendar', () => {
  const schedule = {
    id: 2,
    period_number: 3,
    duration_periods: 2,
    is_teaching_exempted: true,
    exemption_reason: 'Asesmen Sumatif Akhir Jenjang',
    journal_status: 'exempted',
  };

  const result = calculateSessionStatus(schedule, '09:00');
  assert.strictEqual(result.status, 'exempted');
  assert.strictEqual(result.badgeVariant, 'warning');
  assert.strictEqual(result.canOpen, false);
  assert.strictEqual(result.description, 'Asesmen Sumatif Akhir Jenjang');
});

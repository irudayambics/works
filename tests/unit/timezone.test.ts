import assert from 'node:assert/strict';
import test from 'node:test';
import { DateTime } from 'luxon';

import {
  formatSingaporeDate,
  fromUtcIso,
  nowSg,
  parseSg,
  SG_TZ,
  toSg,
  toUtcIso,
} from '@/lib/timezone';

test('parseSg handles ISO and fallback formats', () => {
  const iso = parseSg('2025-05-01T09:30:00');
  assert.equal(iso.zoneName, SG_TZ);
  assert.equal(iso.hour, 9);

  const fallback = parseSg('2025-05-01T09:30');
  assert.equal(fallback.zoneName, SG_TZ);
  assert.equal(fallback.minute, 30);
});

test('toUtcIso roundtrips through fromUtcIso preserving Singapore wall time', () => {
  const original = DateTime.fromISO('2025-01-10T18:15:00', { zone: SG_TZ });
  const iso = toUtcIso(original);
  const roundtrip = fromUtcIso(iso).setZone(SG_TZ);
  assert.equal(roundtrip.toFormat("yyyy-LL-dd'T'HH:mm"), original.toFormat("yyyy-LL-dd'T'HH:mm"));
});

test('toSg and formatSingaporeDate respect Singapore timezone', () => {
  const utcDate = new Date('2025-01-01T00:00:00Z');
  const sgDate = toSg(utcDate);
  assert.equal(sgDate.zoneName, SG_TZ);

  const formatted = formatSingaporeDate(sgDate, { hour: '2-digit', minute: '2-digit' });
  assert.match(formatted, /\d{2}:\d{2}/);
});

test('nowSg returns a DateTime within the Singapore timezone', () => {
  const now = nowSg();
  assert.equal(now.zoneName, SG_TZ);
});

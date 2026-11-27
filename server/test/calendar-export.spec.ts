import { serializeCalendar } from '../src/modules/appointments/calendar-export';

it('writes a standards-compatible appointment with UTC instants and folded Unicode text', () => {
  const name = 'Ședință, text; continuare\\\n' + 'ĂâȘ'.repeat(28);
  const event = {
    id: 'example-event', startTime: new Date('2027-03-28T10:00:00+03:00'),
    endTime: new Date('2027-03-28T11:00:00+03:00'), updatedAt: new Date('2027-03-27T12:00:00Z'),
    service: { name }, specialist: { firstName: 'Ana' },
  };
  const output = serializeCalendar([event]);
  expect(output).toContain('UID:example-event@beautystudio.local\r\n');
  expect(output).toContain('DTSTART:20270328T070000Z\r\nDTEND:20270328T080000Z\r\n');
  for (const line of output.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  expect(output.replace(/\r\n /g, '')).toContain('SUMMARY:Ședință\\, text\\; continuare\\\\\\n' + 'ĂâȘ'.repeat(28));
});

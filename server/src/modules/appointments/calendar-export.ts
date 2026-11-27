type CalendarEvent = { id: string; startTime: Date; endTime: Date; updatedAt: Date;
  service: { name: string }; specialist: { firstName: string } };

const stamp = (value: Date) => value.toISOString().replace(/[-:]|\.\d{3}/g, '');
const text = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|[\r\n]/g, '\\n')
  .replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

function fold(line: string) {
  let result = '';
  let bytes = 0;
  for (const character of line) {
    const length = Buffer.byteLength(character);
    if (bytes + length > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += character;
    bytes += length;
  }
  return result;
}

export function serializeCalendar(events: CalendarEvent[]) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Beauty Studio//Personal//RO', 'CALSCALE:GREGORIAN'];
  for (const event of events) {
    lines.push('BEGIN:VEVENT', `UID:${event.id}@beautystudio.local`, `DTSTAMP:${stamp(event.updatedAt)}`,
      `DTSTART:${stamp(event.startTime)}`, `DTEND:${stamp(event.endTime)}`,
      `SUMMARY:${text(`${event.service.name} · ${event.specialist.firstName}`)}`, 'END:VEVENT');
  }
  return [...lines, 'END:VCALENDAR', ''].map(fold).join('\r\n');
}

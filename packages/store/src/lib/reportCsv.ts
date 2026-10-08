export function csvText(rows: (string | number)[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    // Keep numbers numeric; neutralize spreadsheet formulas in external strings.
    const safe = typeof value === 'string' && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : String(value);
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const url = URL.createObjectURL(new Blob([csvText(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

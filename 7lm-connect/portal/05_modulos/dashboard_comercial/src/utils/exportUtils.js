/**
 * Exports an array of objects to an Excel (.xlsx) file.
 * @param {Array<Object>} data The array of objects to export.
 * @param {string} filename The name of the file without extension.
 * @param {string} sheetName The name of the sheet.
 */
export const exportToExcel = async (data, filename = 'export', sheetName = 'Sheet 1') => {
  if (!data || data.length === 0) {
    console.warn('No data to export to Excel.');
    return;
  }

  try {
    const { default: XlsxPopulate } = await import('xlsx-populate');
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);
    sheet.name(sheetName);

    // Add headers
    const headers = Object.keys(data[0]);
    headers.forEach((header, colIndex) => {
      sheet.cell(1, colIndex + 1).value(header);
    });

    // Add data rows
    data.forEach((row, rowIndex) => {
      headers.forEach((header, colIndex) => {
        sheet.cell(rowIndex + 2, colIndex + 1).value(row[header]);
      });
    });

    // Write file
    const blob = await workbook.outputAsync();
    const link = document.createElement('a');
    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));

    link.href = url;
    link.download = `${filename}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Error exporting to Excel:', err);
  }
};

/**
 * Exports an array of objects to a CSV (.csv) file.
 * @param {Array<Object>} data The array of objects to export.
 * @param {string} filename The name of the file without extension.
 */
export const exportToCSV = (data, filename = 'export') => {
  if (!data || data.length === 0) {
    console.warn('No data to export to CSV.');
    return;
  }

  // Extract headers
  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add headers row
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + row[header]).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

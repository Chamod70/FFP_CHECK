export const parseTSV = (tsvText) => {
  if (!tsvText || !tsvText.trim()) return [];
  const lines = tsvText.split(/\r?\n/);
  return lines.map(line => line.split('\t'));
};

export const arrayToTSV = (data) => {
  if (!data || data.length === 0) return '';
  return data.map(row => row.join('\t')).join('\n');
};

const FIELD_BY_HEADER = {
  tema: 'name',
  descricao: 'description',
  questoes: 'questions',
  observacoes: 'observations',
  'data pedido': 'requestedAt',
  horas: 'hoursEstimate',
  'data conclusao': 'completionNotes',
  estado: 'phaseRaw',
};

const PHASE_KEYWORDS = [
  {
    phase: 'in_production',
    keywords: ['producao', 'concluido', 'concluida', 'finalizado', 'finalizada', 'implementado', 'implementada'],
  },
  {
    phase: 'in_development',
    keywords: ['desenvolvimento', 'em curso', 'em progresso', 'a decorrer'],
  },
  {
    phase: 'in_search',
    keywords: ['pesquisa', 'analise', 'levantamento', 'em estudo'],
  },
  {
    phase: 'waiting_list',
    keywords: ['fila de espera', 'pendente', 'aguarda', 'backlog', 'por iniciar'],
  },
];

// Real spreadsheets exported from other tools often don't have the header
// row as the very first row (a report title, a merged banner, or a blank
// spacer row above it is common), so the import scans this many rows
// looking for one that contains a recognizable "Tema" column instead of
// assuming row 1.
export const MAX_HEADER_SCAN_ROWS = 10;

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Header cells in the wild often carry decoration a data cell never would:
// a required-field marker ("Tema*", "Tema:") or a parenthetical hint
// ("Tema (obrigatório)"). Stripped here, and only here, so it doesn't affect
// how actual cell values are read elsewhere.
function normalizeHeaderCandidate(header) {
  return normalizeText(header)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[:*]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function fieldForHeader(header) {
  return FIELD_BY_HEADER[normalizeHeaderCandidate(header)] || null;
}

export function mapPhase(raw) {
  const normalized = normalizeText(raw);
  if (!normalized) return null;
  for (const { phase, keywords } of PHASE_KEYWORDS) {
    if (keywords.some((kw) => normalized.includes(kw))) return phase;
  }
  return null;
}

export function cellText(value) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((run) => run.text).join('');
    }
    if ('text' in value) return String(value.text);
    if ('result' in value) return value.result === null || value.result === undefined ? '' : String(value.result);
    // Formula error cells (#REF!, #N/A, ...) or any other object shape we
    // don't recognize: treat as blank rather than risk stringifying to the
    // literal text "[object Object]" into a saved field.
    return '';
  }
  return String(value).trim();
}

// Scans the first `MAX_HEADER_SCAN_ROWS` rows for one that maps a column to
// "name" (the "Tema" column), rather than assuming the header is always row
// 1. Returns null if no such row is found.
export function findHeaderRow(worksheet) {
  const maxRow = Math.min(MAX_HEADER_SCAN_ROWS, worksheet.rowCount);
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const columnField = {};
    row.eachCell((cell, colNumber) => {
      const field = fieldForHeader(cellText(cell.value));
      if (field) columnField[colNumber] = field;
    });
    if (Object.values(columnField).includes('name')) {
      return { headerRowNumber: rowNumber, columnField };
    }
  }
  return null;
}

export function parseFlexibleDate(value) {
  const text = String(value ?? '').trim();

  // Already ISO (YYYY-MM-DD) — this is exactly what cellText() produces for
  // a real Excel cell formatted as a Date, which is the common case in
  // spreadsheets exported from other systems, not the DD-MM-YYYY text below.
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, , month, day] = isoMatch;
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
    return text;
  }

  const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const dd = day.padStart(2, '0');
  const mm = month.padStart(2, '0');
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${year}-${mm}-${dd}`;
}

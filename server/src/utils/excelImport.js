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

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function fieldForHeader(header) {
  return FIELD_BY_HEADER[normalizeText(header)] || null;
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
    if ('result' in value) return value.result === null ? '' : String(value.result);
  }
  return String(value).trim();
}

export function parseFlexibleDate(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const dd = day.padStart(2, '0');
  const mm = month.padStart(2, '0');
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return `${year}-${mm}-${dd}`;
}

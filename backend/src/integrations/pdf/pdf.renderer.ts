import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import { ExternalServiceError } from '../../errors';

export const PDF_PAGE = {
  WIDTH: 595,
  HEIGHT: 842,
  MARGIN: 48,
  HEADER: 32,
  FOOTER: 32,
} as const;

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  createdAt?: string;
  keywords?: string[];
}

export interface PdfHeaderFooter {
  text?: string;
  timestamp?: boolean;
  pageNumbers?: boolean;
}

export type PdfBlock =
  | { type: 'heading'; text: string; level?: 1 | 2 }
  | { type: 'paragraph'; text: string }
  | { type: 'facts'; title?: string; entries: Array<{ key: string; value: string }> }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { type: 'chart'; title?: string; labels: string[]; values: number[] }
  | { type: 'narrative'; title?: string; text: string; disclaimer?: string }
  | { type: 'spacer'; height?: number };

export interface PdfDocumentSpec {
  title: string;
  subtitle?: string;
  metadata?: PdfMetadata;
  header?: PdfHeaderFooter;
  footer?: PdfHeaderFooter;
  blocks: PdfBlock[];
}

const COLORS = {
  text: rgb(0.1, 0.12, 0.16),
  muted: rgb(0.35, 0.38, 0.42),
  line: rgb(0.78, 0.8, 0.84),
  headerBg: rgb(0.95, 0.96, 0.98),
  narrativeBg: rgb(0.97, 0.94, 0.88),
  narrativeBorder: rgb(0.72, 0.55, 0.22),
  bar: rgb(0.18, 0.4, 0.72),
};

const AI_DISCLAIMER = 'AI-generated narrative - not verified source data';

export async function renderPdfDocument(spec: PdfDocumentSpec): Promise<Buffer> {
  try {
    return await drawDocument(spec);
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError('PDF renderer failed', {
      provider: 'pdf',
      cause: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export function simplePdfSpec(input: {
  title: string;
  sections?: Array<{ heading?: string; lines: string[] }>;
}): PdfDocumentSpec {
  const blocks: PdfBlock[] = [{ type: 'heading', text: input.title, level: 1 }];
  for (const section of input.sections ?? []) {
    if (section.heading) {
      blocks.push({ type: 'heading', text: section.heading, level: 2 });
    }
    for (const line of section.lines) {
      blocks.push({ type: 'paragraph', text: line });
    }
    blocks.push({ type: 'spacer', height: 8 });
  }

  return {
    title: input.title,
    metadata: { title: input.title, createdAt: new Date().toISOString() },
    header: { timestamp: true },
    footer: { pageNumbers: true },
    blocks,
  };
}

async function drawDocument(spec: PdfDocumentSpec): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  applyMetadata(pdf, spec);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const layout = new Layout(pdf, font, bold, spec);

  for (const block of spec.blocks) {
    layout.drawBlock(block);
  }

  layout.stampChrome();
  return Buffer.from(await pdf.save());
}

function applyMetadata(pdf: PDFDocument, spec: PdfDocumentSpec): void {
  const createdAt = spec.metadata?.createdAt ? new Date(spec.metadata.createdAt) : new Date();
  pdf.setTitle(spec.metadata?.title ?? spec.title);
  pdf.setCreator('DealFlow360');
  pdf.setProducer('DealFlow360 PDF renderer');
  if (!Number.isNaN(createdAt.getTime())) {
    pdf.setCreationDate(createdAt);
    pdf.setModificationDate(createdAt);
  }
  if (spec.metadata?.author) {
    pdf.setAuthor(spec.metadata.author);
  }
  if (spec.metadata?.subject) {
    pdf.setSubject(spec.metadata.subject);
  }
  if (spec.metadata?.keywords?.length) {
    pdf.setKeywords(spec.metadata.keywords);
  }
}

class Layout {
  private page: PDFPage;
  private y: number;
  private readonly contentWidth: number;
  private readonly contentTop: number;
  private readonly contentBottom: number;
  private readonly generatedAt: string;

  constructor(
    private readonly pdf: PDFDocument,
    private readonly font: PDFFont,
    private readonly bold: PDFFont,
    private readonly spec: PdfDocumentSpec,
  ) {
    this.contentWidth = PDF_PAGE.WIDTH - PDF_PAGE.MARGIN * 2;
    this.contentTop = PDF_PAGE.HEIGHT - PDF_PAGE.MARGIN - PDF_PAGE.HEADER;
    this.contentBottom = PDF_PAGE.MARGIN + PDF_PAGE.FOOTER;
    this.generatedAt = formatTimestamp(spec.metadata?.createdAt);
    this.page = this.pdf.addPage([PDF_PAGE.WIDTH, PDF_PAGE.HEIGHT]);
    this.y = this.contentTop;
  }

  drawBlock(block: PdfBlock): void {
    switch (block.type) {
      case 'heading':
        this.ensureSpace(block.level === 2 ? 22 : 28);
        this.drawWrapped(block.text, block.level === 2 ? 13 : 18, this.bold, COLORS.text);
        this.y -= 6;
        return;
      case 'paragraph':
        this.drawWrapped(block.text, 11, this.font, COLORS.text);
        this.y -= 4;
        return;
      case 'facts':
        this.drawFacts(block);
        return;
      case 'table':
        this.drawTable(block);
        return;
      case 'chart':
        this.drawChart(block);
        return;
      case 'narrative':
        this.drawNarrative(block);
        return;
      case 'spacer':
        this.y -= block.height ?? 12;
        return;
      default:
        return;
    }
  }

  stampChrome(): void {
    const pages = this.pdf.getPages();
    const total = pages.length;
    const generated = this.spec.header?.timestamp !== false || this.spec.footer?.timestamp ? this.generatedAt : '';

    pages.forEach((page, index) => {
      const pageNumber = `${index + 1} / ${total}`;
      this.drawHeader(page, generated);
      this.drawFooter(page, pageNumber, generated);
    });
  }

  private drawHeader(page: PDFPage, generated: string): void {
    const header = this.spec.header;
    const title = header?.text ?? this.spec.title;
    const y = PDF_PAGE.HEIGHT - PDF_PAGE.MARGIN - 12;
    page.drawText(clip(title, this.font, 9, this.contentWidth - 140), {
      x: PDF_PAGE.MARGIN,
      y,
      size: 9,
      font: this.font,
      color: COLORS.muted,
    });
    if (header?.timestamp !== false && generated) {
      page.drawText(generated, {
        x: PDF_PAGE.WIDTH - PDF_PAGE.MARGIN - this.font.widthOfTextAtSize(generated, 8),
        y,
        size: 8,
        font: this.font,
        color: COLORS.muted,
      });
    }
    page.drawLine({
      start: { x: PDF_PAGE.MARGIN, y: y - 8 },
      end: { x: PDF_PAGE.WIDTH - PDF_PAGE.MARGIN, y: y - 8 },
      thickness: 0.6,
      color: COLORS.line,
    });
  }

  private drawFooter(page: PDFPage, pageNumber: string, generated: string): void {
    const footer = this.spec.footer;
    const y = PDF_PAGE.MARGIN + 10;
    page.drawLine({
      start: { x: PDF_PAGE.MARGIN, y: y + 14 },
      end: { x: PDF_PAGE.WIDTH - PDF_PAGE.MARGIN, y: y + 14 },
      thickness: 0.6,
      color: COLORS.line,
    });
    const left = footer?.text ?? (footer?.timestamp ? generated : '');
    if (left) {
      page.drawText(clip(left, this.font, 8, this.contentWidth - 80), {
        x: PDF_PAGE.MARGIN,
        y,
        size: 8,
        font: this.font,
        color: COLORS.muted,
      });
    }
    if (footer?.pageNumbers !== false) {
      page.drawText(pageNumber, {
        x: PDF_PAGE.WIDTH - PDF_PAGE.MARGIN - this.font.widthOfTextAtSize(pageNumber, 8),
        y,
        size: 8,
        font: this.font,
        color: COLORS.muted,
      });
    }
  }

  private drawFacts(block: Extract<PdfBlock, { type: 'facts' }>): void {
    if (block.title) {
      this.ensureSpace(20);
      this.drawWrapped(block.title, 12, this.bold, COLORS.text);
      this.y -= 2;
    }
    if (block.entries.length === 0) {
      this.drawWrapped('No source facts provided.', 11, this.font, COLORS.muted);
      return;
    }
    for (const entry of block.entries) {
      this.ensureSpace(16);
      const key = `${entry.key}: `;
      const keyWidth = this.bold.widthOfTextAtSize(key, 11);
      this.page.drawText(clip(key, this.bold, 11, this.contentWidth * 0.4), {
        x: PDF_PAGE.MARGIN,
        y: this.y,
        size: 11,
        font: this.bold,
        color: COLORS.text,
      });
      const valueMax = this.contentWidth - Math.min(keyWidth, this.contentWidth * 0.4) - 8;
      const valueLines = wrap(entry.value, this.font, 11, Math.max(80, valueMax));
      this.page.drawText(valueLines[0] ?? '', {
        x: PDF_PAGE.MARGIN + Math.min(keyWidth, this.contentWidth * 0.4),
        y: this.y,
        size: 11,
        font: this.font,
        color: COLORS.text,
      });
      this.y -= 14;
      for (const extra of valueLines.slice(1)) {
        this.ensureSpace(14);
        this.page.drawText(extra, {
          x: PDF_PAGE.MARGIN + 12,
          y: this.y,
          size: 11,
          font: this.font,
          color: COLORS.text,
        });
        this.y -= 14;
      }
    }
    this.y -= 6;
  }

  private drawTable(block: Extract<PdfBlock, { type: 'table' }>): void {
    if (block.title) {
      this.ensureSpace(20);
      this.drawWrapped(block.title, 12, this.bold, COLORS.text);
      this.y -= 2;
    }
    const columns = block.columns.length > 0 ? block.columns : ['Value'];
    const colWidth = this.contentWidth / columns.length;
    this.drawTableRow(columns, colWidth, true);
    if (block.rows.length === 0) {
      this.drawTableRow(columns.map(() => '—'), colWidth, false);
      this.y -= 6;
      return;
    }
    for (const row of block.rows) {
      const cells = columns.map((_, index) => row[index] ?? '');
      this.drawTableRow(cells, colWidth, false);
    }
    this.y -= 8;
  }

  private drawTableRow(cells: string[], colWidth: number, header: boolean): void {
    const font = header ? this.bold : this.font;
    const wrapped = cells.map((cell) => wrap(cell, font, 9, colWidth - 8));
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
    const rowHeight = lineCount * 12 + 8;
    this.ensureSpace(rowHeight);
    if (header) {
      this.page.drawRectangle({
        x: PDF_PAGE.MARGIN,
        y: this.y - rowHeight + 10,
        width: this.contentWidth,
        height: rowHeight,
        color: COLORS.headerBg,
      });
    }
    this.page.drawRectangle({
      x: PDF_PAGE.MARGIN,
      y: this.y - rowHeight + 10,
      width: this.contentWidth,
      height: rowHeight,
      borderColor: COLORS.line,
      borderWidth: 0.5,
    });
    cells.forEach((_, index) => {
      if (index === 0) {
        return;
      }
      const x = PDF_PAGE.MARGIN + colWidth * index;
      this.page.drawLine({
        start: { x, y: this.y + 10 },
        end: { x, y: this.y - rowHeight + 10 },
        thickness: 0.4,
        color: COLORS.line,
      });
    });
    wrapped.forEach((lines, index) => {
      let textY = this.y;
      for (const line of lines) {
        this.page.drawText(line, {
          x: PDF_PAGE.MARGIN + colWidth * index + 4,
          y: textY,
          size: 9,
          font,
          color: COLORS.text,
        });
        textY -= 12;
      }
    });
    this.y -= rowHeight;
  }

  private drawChart(block: Extract<PdfBlock, { type: 'chart' }>): void {
    const height = 140;
    const labels = block.labels.slice(0, block.values.length);
    const values = block.values.map((value) => (Number.isFinite(value) ? value : 0));
    if (block.title) {
      this.ensureSpace(20);
      this.drawWrapped(block.title, 12, this.bold, COLORS.text);
      this.y -= 2;
    }
    this.ensureSpace(height + 24);
    const axisY = this.y - height;
    const maxValue = Math.max(1, ...values.map((value) => Math.abs(value)));
    const count = Math.max(1, values.length);
    const slot = this.contentWidth / count;
    const barWidth = Math.min(36, slot * 0.6);

    this.page.drawLine({
      start: { x: PDF_PAGE.MARGIN, y: axisY },
      end: { x: PDF_PAGE.MARGIN + this.contentWidth, y: axisY },
      thickness: 0.8,
      color: COLORS.line,
    });

    values.forEach((value, index) => {
      const barHeight = (Math.max(0, value) / maxValue) * (height - 16);
      const x = PDF_PAGE.MARGIN + slot * index + (slot - barWidth) / 2;
      this.page.drawRectangle({
        x,
        y: axisY,
        width: barWidth,
        height: Math.max(1, barHeight),
        color: COLORS.bar,
      });
      const label = clip(labels[index] ?? String(index + 1), this.font, 8, slot - 4);
      this.page.drawText(label, {
        x: x + Math.max(0, (barWidth - this.font.widthOfTextAtSize(label, 8)) / 2),
        y: axisY - 12,
        size: 8,
        font: this.font,
        color: COLORS.muted,
      });
    });
    this.y = axisY - 22;
  }

  private drawNarrative(block: Extract<PdfBlock, { type: 'narrative' }>): void {
    const disclaimer = block.disclaimer ?? AI_DISCLAIMER;
    const title = block.title ?? 'AI-generated narrative';
    const lines = [
      ...wrap(title, this.bold, 11, this.contentWidth - 20).map((text) => ({ text, size: 11, font: this.bold, color: COLORS.text })),
      ...wrap(disclaimer, this.font, 8, this.contentWidth - 20).map((text) => ({ text, size: 8, font: this.font, color: COLORS.muted })),
      ...wrap(block.text, this.font, 11, this.contentWidth - 20).map((text) => ({ text, size: 11, font: this.font, color: COLORS.text })),
    ];
    const padding = 10;
    let index = 0;
    while (index < lines.length) {
      const remaining = this.y - this.contentBottom;
      const fit = Math.max(1, Math.floor((remaining - padding * 2) / 14));
      const chunk = lines.slice(index, index + fit);
      const boxHeight = chunk.length * 14 + padding * 2;
      this.ensureSpace(boxHeight);
      this.page.drawRectangle({
        x: PDF_PAGE.MARGIN,
        y: this.y - boxHeight + 12,
        width: this.contentWidth,
        height: boxHeight,
        color: COLORS.narrativeBg,
        borderColor: COLORS.narrativeBorder,
        borderWidth: 1,
      });
      let textY = this.y;
      for (const line of chunk) {
        this.page.drawText(line.text, {
          x: PDF_PAGE.MARGIN + 10,
          y: textY,
          size: line.size,
          font: line.font,
          color: line.color,
        });
        textY -= 14;
      }
      this.y -= boxHeight + 4;
      index += chunk.length;
    }
  }

  private drawWrapped(
    text: string,
    size: number,
    font: PDFFont,
    color: ReturnType<typeof rgb>,
    x = PDF_PAGE.MARGIN,
    width = this.contentWidth,
  ): void {
    const lines = wrap(text, font, size, width);
    for (const line of lines) {
      this.ensureSpace(size + 6);
      this.page.drawText(line, { x, y: this.y, size, font, color });
      this.y -= size + 6;
    }
  }

  private ensureSpace(needed: number): void {
    if (this.y - needed < this.contentBottom) {
      this.page = this.pdf.addPage([PDF_PAGE.WIDTH, PDF_PAGE.HEIGHT]);
      this.y = this.contentTop;
    }
  }
}

export function wrap(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const normalized = sanitizePdfText(text);
  if (!normalized) {
    return [''];
  }
  const words = normalized.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    for (const piece of splitLongToken(word, font, size, maxWidth)) {
      const next = current ? `${current} ${piece}` : piece;
      if (font.widthOfTextAtSize(next, size) > maxWidth && current) {
        lines.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function splitLongToken(
  token: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  if (font.widthOfTextAtSize(token, size) <= maxWidth) {
    return [token];
  }
  const pieces: string[] = [];
  let current = '';
  for (const char of token) {
    const next = current + char;
    if (current && font.widthOfTextAtSize(next, size) > maxWidth) {
      pieces.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) {
    pieces.push(current);
  }
  return pieces.length > 0 ? pieces : [token];
}

function clip(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string {
  const value = sanitizePdfText(text);
  if (font.widthOfTextAtSize(value, size) <= maxWidth) {
    return value;
  }
  const ellipsis = '...';
  let clipped = value;
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}${ellipsis}`, size) > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped}${ellipsis}`;
}

const WINANSI_REPLACEMENTS: Record<string, string> = {
  '\u00A0': ' ',
  '\u2018': "'",
  '\u2019': "'",
  '\u201A': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u201E': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2212': '-',
  '\u2026': '...',
};

export function sanitizePdfText(value: string): string {
  let output = '';
  for (const char of value) {
    const mapped = WINANSI_REPLACEMENTS[char];
    if (mapped !== undefined) {
      output += mapped;
      continue;
    }
    const code = char.charCodeAt(0);
    if (code === 9 || code === 10 || code === 13) {
      output += ' ';
      continue;
    }
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255) || code === 0x20ac) {
      output += char;
      continue;
    }
    output += '?';
  }
  return output.replace(/[ \t\f\v]+/g, ' ').trim();
}

function formatTimestamp(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

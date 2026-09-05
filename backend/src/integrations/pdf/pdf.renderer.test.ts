import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { renderPdfDocument, sanitizePdfText } from './pdf.renderer';

function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  let match = streamPattern.exec(raw);
  while (match) {
    const payload = Buffer.from(match[1] ?? '', 'latin1');
    try {
      chunks.push(inflateSync(payload).toString('latin1'));
    } catch {
      try {
        chunks.push(inflateSync(payload.subarray(2)).toString('latin1'));
      } catch {
        chunks.push(payload.toString('latin1'));
      }
    }
    match = streamPattern.exec(raw);
  }
  return decodePdfHex(chunks.join('\n'));
}

function decodePdfHex(source: string): string {
  return source.replace(/<([0-9A-Fa-f]+)>/g, (_match, hex: string) => {
    const pairs = hex.match(/.{1,2}/g) ?? [];
    return pairs.map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join('');
  });
}

describe('renderPdfDocument', () => {
  it('draws headers, tables, page numbers, and a bar chart', async () => {
    const bytes = await renderPdfDocument({
      title: 'Analytics pack',
      metadata: { author: 'starter-kit', createdAt: '2026-08-29T00:00:00.000Z' },
      header: { text: 'Header line', timestamp: true },
      footer: { text: 'Footer line', pageNumbers: true },
      blocks: [
        { type: 'heading', text: 'Analytics pack', level: 1 },
        { type: 'facts', title: 'Verified source data', entries: [{ key: 'count', value: '4' }] },
        {
          type: 'table',
          title: 'Rows',
          columns: ['Name', 'Value'],
          rows: [
            ['Alpha', '1'],
            ['Beta', '2'],
          ],
        },
        { type: 'chart', title: 'Trend', labels: ['A', 'B'], values: [2, 5] },
        {
          type: 'narrative',
          text: 'The model wrote this paragraph.',
        },
      ],
    });

    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    const text = pdfText(bytes);
    expect(text).toContain('Analytics pack');
    expect(text).toContain('Header line');
    expect(text).toContain('Footer line');
    expect(text).toContain('Alpha');
    expect(text).toContain('1 / 1');
    expect(text).toContain('AI-generated');
  });

  it('keeps WinAnsi Latin text and replaces unsupported scripts', async () => {
    expect(sanitizePdfText('Café résumé — “quoted” … 你好')).toBe('Café résumé - "quoted" ... ??');

    const bytes = await renderPdfDocument({
      title: 'Café résumé',
      header: { timestamp: false },
      footer: { pageNumbers: true },
      blocks: [{ type: 'heading', text: 'Café résumé', level: 1 }],
    });
    expect(pdfText(bytes)).toContain('Café résumé');
  });
});

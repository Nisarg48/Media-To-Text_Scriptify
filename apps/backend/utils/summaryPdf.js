const PDFDocument = require('pdfkit');
const { marked } = require('marked');

/**
 * Flatten marked inline tokens into styled segments for PDFKit.
 */
function flattenInline(tokens, styles = {}) {
    const out = [];
    for (const t of tokens || []) {
        if (t.type === 'text') {
            if (t.tokens && t.tokens.length) {
                out.push(...flattenInline(t.tokens, styles));
            } else if (t.text != null) {
                out.push({ ...styles, text: String(t.text) });
            }
        } else if (t.type === 'strong') {
            out.push(...flattenInline(t.tokens, { ...styles, bold: true }));
        } else if (t.type === 'em') {
            out.push(...flattenInline(t.tokens, { ...styles, italic: true }));
        } else if (t.type === 'codespan') {
            out.push({ ...styles, code: true, text: String(t.text) });
        } else if (t.type === 'link') {
            const inner = flattenInline(t.tokens, styles);
            inner.forEach((x) => out.push({ ...x, href: t.href }));
        } else if (t.type === 'del') {
            out.push(...flattenInline(t.tokens, { ...styles, strike: true }));
        } else if (t.type === 'br') {
            out.push({ ...styles, text: '\n' });
        }
    }
    return out;
}

function pdfSafe(s) {
    return String(s)
        .normalize('NFKC')
        .replace(/\0/g, '')
        .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function contentWidth(doc) {
    const m = doc.page.margins || { left: 50, right: 50 };
    return doc.page.width - m.left - m.right;
}

/**
 * Render styled segments as one flowing paragraph (bold / italic / code like the web view).
 */
function renderSegments(doc, segments, options = {}) {
    const { baseFontSize = 11, indent = 0 } = options;
    const w = contentWidth(doc) - indent;

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const continued = i < segments.length - 1;
        let line = pdfSafe(seg.text || '');
        if (seg.href) line += ` (${seg.href})`;

        let font = 'Helvetica';
        if (seg.code) font = 'Courier';
        else if (seg.bold && seg.italic) font = 'Helvetica-BoldOblique';
        else if (seg.bold) font = 'Helvetica-Bold';
        else if (seg.italic) font = 'Helvetica-Oblique';

        const fs = seg.code ? Math.max(baseFontSize - 1, 8) : baseFontSize;
        doc.font(font).fontSize(fs).fillColor(seg.code ? '#0f172a' : '#111827');

        try {
            doc.text(line, {
                width: w,
                indent,
                continued,
                lineGap: 2,
                align: 'left',
            });
        } catch {
            doc.font('Helvetica').text(line.replace(/[^\x20-\x7E\n]/g, '?'), {
                width: w,
                indent,
                continued,
                lineGap: 2,
            });
        }
    }
    doc.font('Helvetica').fontSize(baseFontSize).fillColor('#111827');
}

function renderParagraph(doc, token, options = {}) {
    const segments = flattenInline(token.tokens);
    if (segments.length === 0 && token.text) {
        renderSegments(doc, [{ text: token.text }], options);
    } else {
        renderSegments(doc, segments, options);
    }
}

function renderList(doc, listToken, depth = 0) {
    const baseIndent = depth * 16;
    listToken.items.forEach((item, idx) => {
        const segments = flattenInline(item.tokens);
        const prefix = listToken.ordered ? `${idx + 1}. ` : '• ';
        const merged = segments.length ? [...segments] : [{ text: '' }];
        merged[0] = { ...merged[0], text: prefix + (merged[0].text || '') };

        renderSegments(doc, merged, { indent: baseIndent, baseFontSize: 11 });
        doc.moveDown(0.12);

        const nested = (item.tokens || []).filter((x) => x.type === 'list');
        nested.forEach((nl) => renderList(doc, nl, depth + 1));
    });
}

function renderBlockTokens(doc, tokens) {
    for (const token of tokens || []) {
        switch (token.type) {
            case 'space':
                break;
            case 'heading': {
                const size = Math.max(17 - token.depth * 1.5, 11);
                doc.moveDown(0.12);
                doc.font('Helvetica-Bold').fontSize(size).fillColor('#0f172a');
                const segments = flattenInline(token.tokens);
                if (segments.length) {
                    renderSegments(doc, segments, { baseFontSize: size, indent: 0 });
                } else {
                    doc.text(pdfSafe(token.text || ''), { width: contentWidth(doc) });
                }
                doc.moveDown(0.35);
                doc.font('Helvetica').fontSize(11).fillColor('#111827');
                break;
            }
            case 'paragraph':
                renderParagraph(doc, token);
                doc.moveDown(0.3);
                break;
            case 'blockquote': {
                doc.save();
                doc.fillColor('#334155');
                renderBlockTokens(doc, token.tokens || []);
                doc.restore();
                doc.fillColor('#111827');
                doc.moveDown(0.2);
                break;
            }
            case 'code': {
                doc.font('Courier').fontSize(9).fillColor('#0f172a');
                doc.text(pdfSafe(token.text || ''), {
                    width: contentWidth(doc) - 12,
                    indent: 12,
                });
                doc.font('Helvetica').fontSize(11).fillColor('#111827');
                doc.moveDown(0.4);
                break;
            }
            case 'list':
                renderList(doc, token, 0);
                doc.moveDown(0.15);
                break;
            case 'table': {
                const header = token.header || [];
                const rows = token.rows || [];
                doc.font('Helvetica-Bold').fontSize(9);
                const hline = header.map((c) => pdfSafe(c.text || '').slice(0, 36)).join('  |  ');
                doc.text(hline, { width: contentWidth(doc) });
                doc.font('Helvetica').fontSize(9);
                rows.forEach((row) => {
                    const line = row.map((c) => pdfSafe(c.text || '').slice(0, 36)).join('  |  ');
                    doc.text(line, { width: contentWidth(doc) });
                });
                doc.font('Helvetica').fontSize(11);
                doc.moveDown(0.3);
                break;
            }
            case 'hr':
                doc.moveDown(0.25);
                break;
            default:
                if (token.raw) {
                    doc.font('Helvetica').fontSize(11).text(pdfSafe(token.raw), { width: contentWidth(doc) });
                    doc.moveDown(0.2);
                }
                break;
        }
    }
}

/**
 * @param {{ mediaTitle: string, summaryMarkdown: string }} opts
 */
function buildSummaryPdfBuffer(opts) {
    const { mediaTitle, summaryMarkdown } = opts;
    const title = pdfSafe(mediaTitle || 'Media');
    const md = String(summaryMarkdown || '');

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            info: {
                Title: `${title.replace(/[^\x20-\x7E]/g, '?').slice(0, 200)} - Summary`,
                Author: 'Scriptify',
            },
        });
        const chunks = [];
        doc.on('data', (c) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        doc.fontSize(18).font('Helvetica-Bold').fillColor('#111827');
        doc.text(title, { align: 'center', width: contentWidth(doc) });
        doc.moveDown(0.6);

        doc.fontSize(11).font('Helvetica').fillColor('#6b7280');
        doc.text('Summary', { align: 'center', width: contentWidth(doc) });
        doc.moveDown(0.75);

        doc.fillColor('#111827').font('Helvetica').fontSize(11);

        try {
            // Match webpage: react-markdown + remark-gfm (no single-line hard breaks unless MD has two spaces / blank line)
            const blockTokens = marked.lexer(md, { gfm: true, breaks: false });
            renderBlockTokens(doc, blockTokens);
        } catch (e) {
            console.error('summaryPdf render error:', e);
            doc.font('Helvetica').text(pdfSafe(md), { width: contentWidth(doc) });
        }

        doc.end();
    });
}

function summaryAttachmentFilename(mediaFilename) {
    const name = String(mediaFilename || 'media');
    const stem = name.replace(/\.[^.]+$/, '') || 'media';
    const safe = stem.replace(/[^\w\s.-]+/g, '_').replace(/\s+/g, '_').slice(0, 100);
    return `summary_${safe}.pdf`;
}

module.exports = { buildSummaryPdfBuffer, summaryAttachmentFilename };

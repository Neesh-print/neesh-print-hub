import type { ReactNode } from 'react';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import type { LegalDoc } from './legalContent';

/**
 * Minimal, dependency-free markdown renderer for the legal documents.
 * Supports exactly what those documents use: # / ## headings, paragraphs
 * (with intra-paragraph line breaks), "- " bulleted lists, **bold**, and
 * [text](url) links. Anything fancier should be added deliberately.
 */

const renderInline = (text: string, keyPrefix: string) => {
  const nodes: ReactNode[] = [];
  // Split on bold and links while keeping delimiters
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern);
  parts.forEach((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return;
    if (part.startsWith('**') && part.endsWith('**')) {
      nodes.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else {
      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const external = /^https?:\/\//.test(link[2]);
        nodes.push(
          <a
            key={key}
            href={link[2]}
            className="underline underline-offset-2 hover:text-accent"
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {link[1]}
          </a>
        );
      } else {
        nodes.push(part);
      }
    }
  });
  return nodes;
};

const renderParagraphLines = (block: string, keyPrefix: string) => {
  const lines = block.split('\n');
  return lines.map((line, i) => (
    <span key={`${keyPrefix}-l${i}`}>
      {renderInline(line, `${keyPrefix}-l${i}`)}
      {i < lines.length - 1 && <br />}
    </span>
  ));
};

const renderMarkdown = (markdown: string) => {
  const blocks = markdown
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block, i) => {
    const key = `b${i}`;
    if (block.startsWith('# ')) {
      return (
        <h1 key={key} className="font-display text-3xl md:text-4xl font-bold text-foreground mb-2">
          {renderInline(block.slice(2), key)}
        </h1>
      );
    }
    if (block.startsWith('## ')) {
      return (
        <h2 key={key} className="font-display text-xl md:text-2xl font-semibold text-foreground mt-10 mb-3">
          {renderInline(block.slice(3), key)}
        </h2>
      );
    }
    if (block.split('\n').every((l) => l.startsWith('- '))) {
      return (
        <ul key={key} className="list-disc pl-6 space-y-2 text-body text-muted-foreground mb-4">
          {block.split('\n').map((item, j) => (
            <li key={`${key}-i${j}`}>{renderInline(item.slice(2), `${key}-i${j}`)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={key} className="text-body text-muted-foreground leading-relaxed mb-4">
        {renderParagraphLines(block, key)}
      </p>
    );
  });
};

export const LegalPage = ({ doc }: { doc: LegalDoc }) => {
  return (
    <MarketingLayout>
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <article className="max-w-3xl mx-auto">{renderMarkdown(doc.markdown)}</article>
        </div>
      </section>
    </MarketingLayout>
  );
};

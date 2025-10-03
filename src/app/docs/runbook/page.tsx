import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Reads the runbook content from the canonical markdown file at build time.
 * This ensures the content is always up-to-date without duplication.
 */
function getRunbookContent() {
  const runbookPath = path.join(process.cwd(), 'docs', 'RUNBOOK.md');
  return fs.readFileSync(runbookPath, 'utf8');
}

export default function RunbookPage() {
  const runbookContent = getRunbookContent();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8 text-foreground">L2 DASH Runbook</h1>
      <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-secondary prose-pre:text-secondary-foreground">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {runbookContent}
        </ReactMarkdown>
      </div>
    </div>
  );
}

import React from 'react';

/**
 * Simple markdown parser for basic formatting
 * Handles: **bold**, line breaks (\n\n), and horizontal rules (---)
 */
export function parseMarkdown(text: string): React.ReactNode {
  // Split by double newlines to preserve paragraph breaks
  const lines = text.split('\n');

  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for horizontal rule
    if (line.trim() === '---') {
      elements.push(
        <hr key={`hr-${i}`} className="my-3 border-t border-border" />
      );
      continue;
    }

    // Parse inline elements (bold)
    const parsedLine = parseInlineMarkdown(line);

    // Add line with proper spacing
    if (line.trim() === '') {
      // Empty line - add spacing
      elements.push(<br key={`br-${i}`} />);
    } else {
      elements.push(
        <span key={`line-${i}`} className="block">
          {parsedLine}
        </span>
      );
    }
  }

  return <div className="space-y-0">{elements}</div>;
}

/**
 * Parse inline markdown elements (bold)
 */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;

  // Match **bold** text
  const boldRegex = /\*\*([^*]+)\*\*/g;
  let match;

  while ((match = boldRegex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    // Add bold text
    elements.push(
      <strong key={`bold-${match.index}`} className="font-semibold">
        {match[1]}
      </strong>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? elements : [text];
}

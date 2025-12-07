import React from 'react';

/**
 * Parse markdown-like syntax and return formatted React components
 * Supports:
 * - **bold text**
 * - *italic text*
 * - • bullet points
 * - Line breaks (preserved)
 * - Links: [text](url)
 */
export const parseMarkdown = (text: string): React.ReactNode => {
  if (!text) return '';

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIndex) => {
    if (!line.trim()) {
      elements.push(<br key={`br-${lineIndex}`} />);
      return;
    }

    // Parse inline elements within the line
    const parsedLine = parseInline(line);
    elements.push(
      <div key={`line-${lineIndex}`} className="block">
        {parsedLine}
      </div>
    );
  });

  return elements;
};

/**
 * Parse inline markdown elements in a line
 */
const parseInline = (text: string): React.ReactNode => {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let index = 0;

  // Regex patterns for inline elements
  const patterns = [
    {
      name: 'link',
      regex: /\[([^\]]+)\]\(([^)]+)\)/,
      render: (match: RegExpExecArray) => (
        <a
          key={`link-${index}`}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {match[1]}
        </a>
      ),
    },
    {
      name: 'bold',
      regex: /\*\*([^*]+)\*\*/,
      render: (match: RegExpExecArray) => (
        <strong key={`bold-${index}`} className="font-semibold">
          {match[1]}
        </strong>
      ),
    },
    {
      name: 'italic',
      regex: /\*([^*]+)\*/,
      render: (match: RegExpExecArray) => (
        <em key={`italic-${index}`} className="italic">
          {match[1]}
        </em>
      ),
    },
  ];

  while (remaining.length > 0) {
    let matched = false;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);

      if (match && match.index === 0) {
        // Found a match at the start
        elements.push(pattern.render(match));
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }

      if (match) {
        // Found a match, but not at the start
        elements.push(remaining.slice(0, match.index));
        elements.push(pattern.render(match));
        remaining = remaining.slice(match.index + match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // No pattern matched, consume one character
      elements.push(remaining[0]);
      remaining = remaining.slice(1);
    }
    index++;
  }

  return elements.length === 0 ? text : elements;
};

/**
 * Format list items (lines starting with •, -, or *)
 */
export const formatList = (text: string): React.ReactNode[] => {
  const lines = text.split('\n');
  return lines
    .filter((line) => line.trim())
    .map((line, index) => {
      const isBullet = /^[•\-*]\s/.test(line.trim());
      const content = isBullet ? line.trim().slice(2) : line.trim();

      if (isBullet) {
        return (
          <li key={index} className="ml-4 list-disc">
            {parseInline(content)}
          </li>
        );
      }

      return (
        <p key={index} className="mb-2">
          {parseInline(content)}
        </p>
      );
    });
};

/**
 * Smart formatting that detects structure and applies appropriate styles
 */
export const formatBotMessage = (text: string): React.ReactNode => {
  if (!text) return '';

  // Check if the text contains bullet points
  const hasBullets = /^[•\-*]\s/m.test(text);

  if (hasBullets) {
    const items = formatList(text);
    return <ul className="space-y-1">{items}</ul>;
  }

  // Otherwise, parse as regular markdown with inline formatting
  return parseMarkdown(text);
};

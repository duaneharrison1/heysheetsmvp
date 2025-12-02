import { ServiceRecord, ProductRecord } from '../_shared/types.ts';

// ============================================================================
// TWO-STAGE SEMANTIC MATCHING
// ============================================================================

interface MatchedItem {
  item: ServiceRecord | ProductRecord;
  score: number;
  reasoning: string;
}

/**
 * Two-stage semantic matching: LLM semantic understanding (60%) + Code business rules (40%)
 */
export async function semanticMatch(
  query: string,
  items: (ServiceRecord | ProductRecord)[],
  itemType: 'service' | 'product',
  openrouterApiKey: string
): Promise<MatchedItem[]> {
  if (!query || items.length === 0) {
    return items.map(item => ({
      item,
      score: 100,
      reasoning: 'No filter applied'
    }));
  }

  // Stage 1: LLM Semantic Matching (60% weight)
  const llmScores = await getLLMScores(query, items, itemType, openrouterApiKey);

  // Stage 2: Code-based Business Rules (40% weight)
  const codeScores = getCodeScores(query, items);

  // Combine scores
  const matchedItems: MatchedItem[] = items.map((item, index) => {
    const llmScore = llmScores[index] || 0;
    const codeScore = codeScores[index] || 0;
    const finalScore = (llmScore * 0.6) + (codeScore * 0.4);

    return {
      item,
      score: finalScore,
      reasoning: `LLM: ${llmScore}/100, Code: ${codeScore}/100`
    };
  });

  // Sort by score descending and return top matches
  return matchedItems
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Return top 10 matches
}

/**
 * LLM-based semantic scoring
 */
async function getLLMScores(
  query: string,
  items: (ServiceRecord | ProductRecord)[],
  itemType: 'service' | 'product',
  apiKey: string
): Promise<number[]> {
  const itemDescriptions = items.map((item, index) => {
    if (itemType === 'service') {
      const service = item as ServiceRecord;
      return `${index}. Name: "${service.serviceName}", Category: "${service.category || 'N/A'}", Tags: "${service.tags || 'N/A'}", Description: "${service.description || 'N/A'}"`;
    } else {
      const product = item as ProductRecord;
      return `${index}. Name: "${product.name}", Category: "${product.category || 'N/A'}", Tags: "${product.tags || 'N/A'}", Description: "${product.description || 'N/A'}"`;
    }
  }).join('\n');

  const prompt = `Match the user query to relevant ${itemType}s using semantic similarity.

User query: "${query}"

Available ${itemType}s:
${itemDescriptions}

MATCHING RULES:
- Semantic similarity: "sake" matches "sake bottle building"
- Synonyms: "beginner" = "intro" = "starter" = "first time"
- Partial matches OK: "pottery" matches "hand building pottery"
- Consider: name (highest weight), tags, category, description
- Ignore exact word order

Return a JSON array of scores (0-100) for each ${itemType}, in order:
{"scores": [95, 20, 85, 10, ...]}

Be generous with matches but prioritize the most relevant.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3.5-haiku', // Faster, cheaper model for matching
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
        // Disable reasoning to save tokens and time
        reasoning: { enabled: false },
      })
    });

    if (!response.ok) {
      console.error('[SemanticMatcher] LLM scoring failed, using fallback');
      return items.map(() => 50); // Neutral scores as fallback
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      // Strip JavaScript-style comments that LLM might add
      const cleanJson = jsonMatch[0]
        .replace(/\/\/[^\n]*/g, '')  // Remove // comments
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove /* */ comments
        .replace(/,\s*}/g, '}')  // Fix trailing commas
        .replace(/,\s*]/g, ']');  // Fix trailing commas in arrays

      const parsed = JSON.parse(cleanJson);
      return parsed.scores || items.map(() => 50);
    }

    return items.map(() => 50); // Fallback
  } catch (error) {
    console.error('[SemanticMatcher] Error:', error);
    return items.map(() => 50); // Fallback
  }
}

/**
 * Code-based scoring (exact matches, keywords)
 */
function getCodeScores(
  query: string,
  items: (ServiceRecord | ProductRecord)[]
): number[] {
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/);

  return items.map(item => {
    let score = 0;
    const name = ('serviceName' in item ? item.serviceName : item.name).toLowerCase();
    const category = (item.category || '').toLowerCase();
    const tags = (item.tags || '').toLowerCase().split(',');
    const description = (item.description || '').toLowerCase();

    // Exact name match: +40 points
    if (name === queryLower) score += 40;

    // Name contains query: +30 points
    else if (name.includes(queryLower)) score += 30;

    // Each query token in name: +10 points
    queryTokens.forEach(token => {
      if (token.length > 2 && name.includes(token)) score += 10;
    });

    // Category match: +20 points
    if (category && category.includes(queryLower)) score += 20;

    // Tag match: +15 points per tag
    tags.forEach((tag: string) => {
      if (tag.trim() && queryTokens.some(token => tag.includes(token))) {
        score += 15;
      }
    });

    // Description contains query: +10 points
    if (description.includes(queryLower)) score += 10;

    return Math.min(score, 100); // Cap at 100
  });
}

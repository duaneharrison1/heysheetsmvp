// Shared types for chat-completion
export type Message = { role: string; content: string };

export interface Classification {
  intent: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  params: Record<string, any>;
  functionToCall?: string | null;
}

/**
 * AI Actions Library
 * Light utility functions for handling AI chat feedback (like, dislike, regenerate).
 * Feedback is stored in Supabase for review and improvements.
 */

import { supabase } from '@/lib/supabase';

// ============================================================================
// Types
// ============================================================================

export type FeedbackType = 'like' | 'dislike';

export interface FeedbackPayload {
  storeId: string;
  storeUrl?: string;
  messageId: string;
  messageContent: string;
  feedbackType: FeedbackType;
  conversationHistory: Array<{ role: string; content: string }>;
}

export interface RegeneratePayload {
  storeId: string;
  messageId: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

// ============================================================================
// Feedback Functions
// ============================================================================

/**
 * Submit feedback (like/dislike) for a message to Supabase.
 * Fires and forgets - doesn't block UI.
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<boolean> {
  try {
    const { error } = await supabase.from('chat_feedback').insert({
      store_id: payload.storeId,
      store_url: payload.storeUrl || window.location.href,
      message_id: payload.messageId,
      message_content: payload.messageContent,
      feedback_type: payload.feedbackType,
      conversation_history: payload.conversationHistory,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[ai-actions] Failed to submit feedback:', error.message);
      return false;
    }

    console.log(`[ai-actions] Feedback submitted: ${payload.feedbackType}`);
    return true;
  } catch (err) {
    console.error('[ai-actions] Error submitting feedback:', err);
    return false;
  }
}

/**
 * Like a message - convenience wrapper.
 */
export function likeMessage(
  storeId: string,
  messageId: string,
  messageContent: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<boolean> {
  return submitFeedback({
    storeId,
    messageId,
    messageContent,
    feedbackType: 'like',
    conversationHistory,
  });
}

/**
 * Dislike a message - convenience wrapper.
 */
export function dislikeMessage(
  storeId: string,
  messageId: string,
  messageContent: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<boolean> {
  return submitFeedback({
    storeId,
    messageId,
    messageContent,
    feedbackType: 'dislike',
    conversationHistory,
  });
}

// ============================================================================
// Regenerate Function
// ============================================================================

/**
 * Trigger a regenerate request.
 * Returns a callback that can be used by the parent component.
 * The actual regeneration logic should be handled by the chat component.
 */
export function createRegenerateHandler(
  onRegenerate: (payload: RegeneratePayload) => void
) {
  return (
    storeId: string,
    messageId: string,
    conversationHistory: Array<{ role: string; content: string }>
  ) => {
    onRegenerate({ storeId, messageId, conversationHistory });
  };
}

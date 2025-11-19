/**
 * Google Sheets configuration constants
 */
export const GOOGLE_SHEETS = {
  /**
   * Service account email that users must share their sheets with
   * Users grant this account "Editor" access to enable the integration
   */
  SERVICE_ACCOUNT_EMAIL: 'heysheets-backend@heysheets-mvp.iam.gserviceaccount.com',

  /**
   * Template Google Sheet URL with /copy suffix for easy duplication
   * Users click this to create their own copy of the template
   *
   * ⚠️ ACTION REQUIRED: Update this URL to point to your own template sheet
   */
  TEMPLATE_URL: 'https://docs.google.com/spreadsheets/d/1-damJAZ5oHaZ5L-qXVH95Jwa1PHr2lEjxboH7mt_GWQ/copy',
} as const;

/**
 * Build Google Sheets edit URL from sheet ID
 * @param sheetId - 44-character Google Sheets ID
 * @returns Full edit URL
 */
export function buildSheetsEditUrl(sheetId: string): string {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
}

/**
 * Extract sheet ID from various Google Sheets URL formats
 * Supports:
 * - Full URL: https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 * - With hash: https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 * - Just ID: SHEET_ID (44 characters)
 *
 * @param input - URL or ID
 * @returns Extracted 44-character sheet ID or null if invalid
 */
export function extractSheetId(input: string): string | null {
  if (!input) return null;

  const trimmed = input.trim();

  // If it's already a 44-char sheet ID, return it
  if (/^[a-zA-Z0-9_-]{44}$/.test(trimmed)) {
    return trimmed;
  }

  // Extract from URL
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{44})/);
  return match ? match[1] : null;
}

import { useLanguage, getLanguageName } from '@/hooks/useLanguage';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Globe } from 'lucide-react';

/**
 * Language switcher component
 * Allows users to change their preferred language
 * 
 * Displays supported languages with their native names
 */
export function LanguageSwitcher() {
  const { language, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-muted-foreground" />
      <Select value={language} onValueChange={changeLanguage}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {supportedLanguages.map((lang) => (
            <SelectItem key={lang} value={lang}>
              {getLanguageName(lang as any)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Compact language switcher (for limited space)
 * Shows only language flags/codes
 */
export function LanguageSwitcherCompact() {
  const { language, changeLanguage, supportedLanguages } = useLanguage();

  const langCodes: Record<string, string> = {
    en: '🇬🇧 EN',
    'zh-HK': '🇭🇰 HK',
    'zh-TW': '🇹🇼 TW',
    ja: '🇯🇵 JP'
  };

  return (
    <div className="flex gap-2">
      {supportedLanguages.map((lang) => (
        <button
          key={lang}
          onClick={() => changeLanguage(lang)}
          className={`px-2 py-1 rounded text-sm font-medium transition ${
            language === lang
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          title={getLanguageName(lang as any)}
        >
          {langCodes[lang]}
        </button>
      ))}
    </div>
  );
}

/**
 * Dropdown language switcher (for headers/navbars)
 */
export function LanguageSwitcherDropdown() {
  const { language, changeLanguage, supportedLanguages } = useLanguage();

  return (
    <select
      value={language}
      onChange={(e) => changeLanguage(e.target.value)}
      className="px-3 py-1 rounded border border-input bg-background text-sm"
      aria-label="Select language"
    >
      {supportedLanguages.map((lang) => (
        <option key={lang} value={lang}>
          {getLanguageName(lang as any)}
        </option>
      ))}
    </select>
  );
}

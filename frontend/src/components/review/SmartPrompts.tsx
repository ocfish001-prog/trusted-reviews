'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

// Category-specific prompts
const PROMPT_MAP: Record<string, string[]> = {
  restaurant: [
    'What did you order?',
    'What was the vibe?',
    'Would you recommend it to a friend?',
  ],
  café: [
    'What did you order?',
    'What was the vibe?',
    'Would you recommend it to a friend?',
  ],
  cafe: [
    'What did you order?',
    'What was the vibe?',
    'Would you recommend it to a friend?',
  ],
  coffee: [
    'How was the coffee?',
    'Good for working?',
    'How were the wait times?',
  ],
  bar: [
    'What did you drink?',
    "What's the crowd like?",
    'Good for a date?',
  ],
};

const DEFAULT_PROMPTS = [
  'What was your experience?',
  'Any standout moments?',
  'Who would love this place?',
];

function getPrompts(category?: string): string[] {
  if (!category) return DEFAULT_PROMPTS;
  const key = category.toLowerCase().trim();
  return PROMPT_MAP[key] ?? DEFAULT_PROMPTS;
}

interface SmartPromptsProps {
  category?: string;
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  onFreeformToggle: () => void;
}

export default function SmartPrompts({
  category,
  answers,
  onChange,
  onFreeformToggle,
}: SmartPromptsProps) {
  const prompts = getPrompts(category);

  const handleChange = (prompt: string, value: string) => {
    onChange({ ...answers, [prompt]: value });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">
          Guided prompts
        </p>
        <button
          type="button"
          onClick={onFreeformToggle}
          className="text-xs text-amber-600 hover:text-amber-700 font-medium underline underline-offset-2 min-h-[44px] flex items-center"
        >
          Switch to freeform
        </button>
      </div>

      <div className="space-y-3">
        {prompts.map((prompt) => (
          <PromptBubble
            key={prompt}
            prompt={prompt}
            value={answers[prompt] ?? ''}
            onChange={(v) => handleChange(prompt, v)}
          />
        ))}
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        All prompts are optional — skip any you don&apos;t want to answer
      </p>
    </div>
  );
}

interface PromptBubbleProps {
  prompt: string;
  value: string;
  onChange: (v: string) => void;
}

function PromptBubble({ prompt, value, onChange }: PromptBubbleProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="space-y-1.5">
      {/* The "question" bubble — looks like an incoming chat message */}
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[10px]">💬</span>
        </div>
        <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-slate-700 font-medium max-w-[85%]">
          {prompt}
        </div>
      </div>

      {/* The "reply" input — floats right like an outgoing message */}
      <div className="flex justify-end">
        <div
          className={cn(
            'relative w-[88%] rounded-2xl rounded-tr-sm transition-all',
            focused ? 'ring-2 ring-amber-400' : 'ring-1 ring-slate-200',
            'bg-white'
          )}
        >
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Type your answer... (optional)"
            rows={2}
            className="w-full px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none resize-none rounded-2xl"
          />
        </div>
      </div>
    </div>
  );
}

// Helper: combine prompt answers into a review body string
export function combinePromptAnswers(
  category: string | undefined,
  answers: Record<string, string>
): string {
  const prompts = getPrompts(category);
  const parts: string[] = [];

  for (const prompt of prompts) {
    const answer = answers[prompt]?.trim();
    if (answer) {
      parts.push(`${prompt}\n${answer}`);
    }
  }

  return parts.join('\n\n');
}

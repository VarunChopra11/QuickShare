import React, { useRef, useEffect } from 'react';

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export const CodeInput: React.FC<CodeInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  autoFocus = false,
}) => {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const digits = (value + '      ').slice(0, 6).split('');

  const handleChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Extract only digits
    const cleaned = val.replace(/\D/g, '');

    if (!cleaned) {
      // Empty input (e.g. backspace handled)
      const newDigits = [...digits];
      newDigits[index] = ' ';
      onChange(newDigits.join('').trim());
      return;
    }

    if (cleaned.length === 1) {
      const newDigits = [...digits];
      newDigits[index] = cleaned;
      const combined = newDigits.join('').replace(/\s+$/, '');
      onChange(combined);

      // Advance to next input
      if (index < 5 && inputRefs.current[index + 1]) {
        inputRefs.current[index + 1]?.focus();
      } else if (index === 5 && combined.length === 6 && onSubmit) {
        // Trigger retrieve automatically if 6 digits filled
        onSubmit();
      }
    } else {
      // Multiple digits pasted into single box
      handlePasteDigits(cleaned);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!digits[index] || digits[index] === ' ') {
        if (index > 0 && inputRefs.current[index - 1]) {
          inputRefs.current[index - 1]?.focus();
          const newDigits = [...digits];
          newDigits[index - 1] = ' ';
          onChange(newDigits.join('').trim());
        }
      } else {
        const newDigits = [...digits];
        newDigits[index] = ' ';
        onChange(newDigits.join('').trim());
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter' && value.length === 6 && onSubmit) {
      onSubmit();
    }
  };

  const handlePasteDigits = (pasted: string) => {
    const numbersOnly = pasted.replace(/\D/g, '').slice(0, 6);
    if (numbersOnly.length > 0) {
      onChange(numbersOnly);
      const focusIndex = Math.min(numbersOnly.length, 5);
      inputRefs.current[focusIndex]?.focus();
      if (numbersOnly.length === 6 && onSubmit) {
        onSubmit();
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    handlePasteDigits(pastedData);
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 my-2">
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const char = digits[index] === ' ' ? '' : digits[index];
        const isMiddle = index === 2;

        return (
          <React.Fragment key={index}>
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={char}
              disabled={disabled}
              onChange={(e) => handleChange(index, e)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              aria-label={`Digit ${index + 1}`}
              className={`w-11 h-14 sm:w-14 sm:h-16 text-center text-2xl sm:text-3xl font-extrabold font-mono rounded-xl border bg-white dark:bg-zinc-900 transition-all duration-150 outline-none
                ${
                  char
                    ? 'border-emerald-500/80 dark:border-emerald-500 text-zinc-900 dark:text-white shadow-sm ring-1 ring-emerald-500/30'
                    : 'border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
                }
                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:focus:ring-emerald-500/20
                disabled:opacity-50 disabled:cursor-not-allowed`}
            />
            {isMiddle && (
              <span className="text-zinc-300 dark:text-zinc-700 font-bold select-none text-xl">
                –
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

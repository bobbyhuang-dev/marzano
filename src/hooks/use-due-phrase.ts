import { useCallback, useState } from "react";

import { type DuePhraseMatch, parseDuePhrase, removeDuePhrase } from "@/lib/due-phrase";

interface DuePhraseState {
  title: string;
  dueAt: string | null;
  /** The words in the title the due date was read from; null when it was picked. */
  phrase: DuePhraseMatch | null;
  /**
   * Words the reader has overruled by picking a date themselves. They stay in
   * the name, plain, until a different date phrase replaces them.
   */
  ignored: string | null;
}

export interface DuePhraseField {
  title: string;
  dueAt: string | null;
  phrase: DuePhraseMatch | null;
  /** The title as it will be saved: the recognised phrase taken out. */
  cleanTitle: string;
  setTitle: (title: string) => void;
  /** A date chosen by hand, which wins over anything typed. */
  setDueAt: (dueAt: string | null) => void;
  /** Start again, from an existing task's values or from nothing. */
  reset: (title?: string, dueAt?: string | null) => void;
}

function initial(title: string, dueAt: string | null): DuePhraseState {
  // A name that arrives with a date in it already ("Read 'Tomorrow'") keeps
  // it as words: the task's due date was decided when it was written.
  return { title, dueAt, phrase: null, ignored: parseDuePhrase(title)?.text ?? null };
}

/**
 * A task-name field that reads its due date out of what is typed, and the
 * rules for when a typed date and a picked one disagree. The title and the
 * due date live together here because one changes the other: deleting the
 * phrase takes its date with it, and picking a date by hand releases the
 * phrase back into being ordinary words.
 */
export function useDuePhrase(
  initialTitle = "",
  initialDueAt: string | null = null,
): DuePhraseField {
  const [state, setState] = useState(() => initial(initialTitle, initialDueAt));

  const setTitle = useCallback((title: string) => {
    setState((current) => {
      const match = parseDuePhrase(title);
      if (match && match.text === current.ignored) {
        return { ...current, title, phrase: null };
      }
      if (match) {
        return { title, dueAt: match.dueAt, phrase: match, ignored: null };
      }
      // With the phrase gone its date goes too; a picked date stays.
      return {
        ...current,
        title,
        dueAt: current.phrase ? null : current.dueAt,
        phrase: null,
      };
    });
  }, []);

  const setDueAt = useCallback((dueAt: string | null) => {
    setState((current) => ({
      ...current,
      dueAt,
      phrase: null,
      ignored: current.phrase ? current.phrase.text : current.ignored,
    }));
  }, []);

  const reset = useCallback((title = "", dueAt: string | null = null) => {
    setState(initial(title, dueAt));
  }, []);

  return {
    title: state.title,
    dueAt: state.dueAt,
    phrase: state.phrase,
    cleanTitle: state.phrase
      ? removeDuePhrase(state.title, state.phrase)
      : state.title.trim(),
    setTitle,
    setDueAt,
    reset,
  };
}

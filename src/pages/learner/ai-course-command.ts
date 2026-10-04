export interface CourseCommand {
  start: number;
  end: number;
  query: string;
}

// Only a slash at the start of a line is a command; fractions and URLs stay text.
export function findCourseCommand(draft: string, caret: number): CourseCommand | null {
  if (caret < 0 || caret > draft.length) return null;
  const lineStart = draft.lastIndexOf('\n', caret - 1) + 1;
  const match = draft.slice(lineStart, caret).match(/^\s*\/([^\n/]*)$/);
  if (!match) return null;
  return {
    start: lineStart + draft.slice(lineStart, caret).indexOf('/'),
    end: caret,
    query: match[1].trim().toLocaleLowerCase(),
  };
}

export function removeCourseCommand(draft: string, command: CourseCommand) {
  return draft.slice(0, command.start) + draft.slice(command.end);
}

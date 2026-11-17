/** Student-facing count text, with the singular for one answer. */
export function answersSaved(count: number): string {
  return `${count} ${count === 1 ? "answer" : "answers"} saved`;
}

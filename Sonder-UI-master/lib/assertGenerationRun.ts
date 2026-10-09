import type { GenerationRun } from "@/fixtures/content/generation-run";

/**
 * Dev-time guard for a scripted generation run (Feature 16a), mirroring
 * `assertScenarioPosteriors`: a malformed fixture is a build error, not a
 * runtime edge case. Throws in development, no-op in production.
 */
export function assertGenerationRun(run: GenerationRun): void {
  if (process.env.NODE_ENV === "production") return;

  const [min, max] = run.target;
  if (run.finalBatch.length < min || run.finalBatch.length > max) {
    throw new Error(
      `[generation run ${run.id}] finalBatch has ${run.finalBatch.length} items, expected within [${min}, ${max}]`,
    );
  }

  let previousKept = 0;
  run.rounds.forEach((round) => {
    if (round.scored.length !== round.drafted) {
      throw new Error(
        `[generation run ${run.id}] round ${round.round}: drafted ${round.drafted} but scored ${round.scored.length} candidates`,
      );
    }

    round.scored.forEach((c) => {
      if (c.passed && c.score < run.passMark) {
        throw new Error(
          `[generation run ${run.id}] round ${round.round}: "${c.stub}" passed with score ${c.score}, below the pass mark ${run.passMark}`,
        );
      }
      if (!c.passed && !c.rejectReason) {
        throw new Error(
          `[generation run ${run.id}] round ${round.round}: "${c.stub}" was rejected without a reason`,
        );
      }
    });

    if (round.keptTotal < previousKept) {
      throw new Error(
        `[generation run ${run.id}] round ${round.round}: keptTotal ${round.keptTotal} is lower than the previous round's ${previousKept}`,
      );
    }
    previousKept = round.keptTotal;
  });

  const lastRound = run.rounds[run.rounds.length - 1];
  if (lastRound.keptTotal !== run.finalBatch.length) {
    throw new Error(
      `[generation run ${run.id}] final round's keptTotal (${lastRound.keptTotal}) does not match finalBatch length (${run.finalBatch.length})`,
    );
  }

  run.finalBatch.forEach((q) => {
    if (!q.engineAnswer) {
      throw new Error(`[generation run ${run.id}] "${q.id}" has no engineAnswer`);
    }
    if (q.options.length === 0) {
      throw new Error(`[generation run ${run.id}] "${q.id}" has no options`);
    }
    const correctOptions = q.options.filter((o) => o.correct);
    if (correctOptions.length !== 1) {
      throw new Error(
        `[generation run ${run.id}] "${q.id}" has ${correctOptions.length} correct options, expected exactly 1`,
      );
    }
    if (correctOptions[0].text !== q.engineAnswer) {
      throw new Error(
        `[generation run ${run.id}] "${q.id}": engineAnswer "${q.engineAnswer}" does not match the correct option "${correctOptions[0].text}"`,
      );
    }
  });
}

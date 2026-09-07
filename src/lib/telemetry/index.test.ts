import { beforeEach, describe, expect, it, vi } from "vitest";

// prisma is mocked so that the "validation succeeds and reaches the DB call"
// paths can be exercised without a real PostgreSQL connection. The pure
// validation-error paths below never touch this mock at all: recordRating /
// recordScoreFeedback / recordPreliminaryJudgement all throw synchronously
// before calling prisma.
vi.mock("../db", () => ({
  prisma: {
    rating: { create: vi.fn().mockResolvedValue({ rating_id: "rating-1" }) },
    scoreFeedback: { create: vi.fn().mockResolvedValue({ feedback_id: "feedback-1" }) },
    learnerPreliminaryJudgement: {
      create: vi.fn().mockResolvedValue({ judgement_id: "judgement-1" }),
    },
  },
}));

import { prisma } from "../db";
import {
  recordPreliminaryJudgement,
  recordRating,
  recordScoreFeedback,
  type RecordPreliminaryJudgementParams,
  type RecordRatingParams,
  type RecordScoreFeedbackParams,
} from "./index";

function baseRatingParams(overrides: Partial<RecordRatingParams> = {}): RecordRatingParams {
  return {
    sessionId: "session-1",
    learnerId: "learner-1",
    sessionSeq: 1,
    stepId: "step-1",
    axisId: "axis_4",
    ratingCategory: 3,
    raterType: "llm",
    raterId: "rater-1",
    scorerModelVersion: "claude-opus-5/extract-v1/score-v1",
    stimulusRef: "stimulus-ref-1",
    stimulusType: "generated",
    stimulusFeatures: {},
    ...overrides,
  };
}

function baseFeedbackParams(
  overrides: Partial<RecordScoreFeedbackParams> = {}
): RecordScoreFeedbackParams {
  return {
    ratingId: "rating-1",
    sessionId: "session-1",
    actorRole: "learner",
    disagreementDirection: "too_high",
    freeTextReason: "根拠が不十分だと思う",
    scorerModelVersion: "claude-opus-5/extract-v1/score-v1",
    ...overrides,
  };
}

function baseJudgementParams(
  overrides: Partial<RecordPreliminaryJudgementParams> = {}
): RecordPreliminaryJudgementParams {
  return {
    sessionId: "session-1",
    stepId: "step-1",
    action: "approve",
    justification: "要件と照合して問題ないと判断した",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordRating", () => {
  it("throws when stimulusType is 'anchor' but anchorId is missing", async () => {
    await expect(
      recordRating(
        baseRatingParams({ stimulusType: "anchor", anchorId: undefined, anchorStatus: "operational" })
      )
    ).rejects.toThrow(/anchor_id and anchor_status are mandatory/);
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it("throws when stimulusType is 'anchor' but anchorStatus is missing", async () => {
    await expect(
      recordRating(
        baseRatingParams({ stimulusType: "anchor", anchorId: "anchor-1", anchorStatus: undefined })
      )
    ).rejects.toThrow(/anchor_id and anchor_status are mandatory/);
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it("throws when ratingCategory is below 0", async () => {
    await expect(recordRating(baseRatingParams({ ratingCategory: -1 }))).rejects.toThrow(
      /rating_category must be between 0 and 5/
    );
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it("throws when ratingCategory is above 5", async () => {
    await expect(recordRating(baseRatingParams({ ratingCategory: 6 }))).rejects.toThrow(
      /rating_category must be between 0 and 5/
    );
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it("throws when ratingCategory is null and raterType is not 'pending_human'", async () => {
    await expect(
      recordRating(baseRatingParams({ ratingCategory: null, raterType: "llm" }))
    ).rejects.toThrow(/rating_category may only be null when rater_type is 'pending_human'/);
    expect(prisma.rating.create).not.toHaveBeenCalled();
  });

  it("allows ratingCategory to be null when raterType is 'pending_human'", async () => {
    await expect(
      recordRating(baseRatingParams({ ratingCategory: null, raterType: "pending_human" }))
    ).resolves.toEqual({ rating_id: "rating-1" });
    expect(prisma.rating.create).toHaveBeenCalledTimes(1);
  });

  it("succeeds and reaches prisma.rating.create for valid non-anchor params", async () => {
    await expect(recordRating(baseRatingParams())).resolves.toEqual({ rating_id: "rating-1" });
    expect(prisma.rating.create).toHaveBeenCalledTimes(1);
  });

  it("succeeds for valid anchor params with anchorId and anchorStatus set", async () => {
    await expect(
      recordRating(
        baseRatingParams({ stimulusType: "anchor", anchorId: "anchor-1", anchorStatus: "operational" })
      )
    ).resolves.toEqual({ rating_id: "rating-1" });
    expect(prisma.rating.create).toHaveBeenCalledTimes(1);
  });
});

describe("recordScoreFeedback", () => {
  it("throws when freeTextReason is an empty string", async () => {
    await expect(
      recordScoreFeedback(baseFeedbackParams({ freeTextReason: "" }))
    ).rejects.toThrow(/free_text_reason is mandatory/);
    expect(prisma.scoreFeedback.create).not.toHaveBeenCalled();
  });

  it("throws when freeTextReason is only whitespace", async () => {
    await expect(
      recordScoreFeedback(baseFeedbackParams({ freeTextReason: "   " }))
    ).rejects.toThrow(/free_text_reason is mandatory/);
    expect(prisma.scoreFeedback.create).not.toHaveBeenCalled();
  });

  it("throws when disagreementDirection is not one of the allowed 4 values", async () => {
    await expect(
      recordScoreFeedback(
        baseFeedbackParams({ disagreementDirection: "not_a_real_direction" as never })
      )
    ).rejects.toThrow(/disagreement_direction must be one of/);
    expect(prisma.scoreFeedback.create).not.toHaveBeenCalled();
  });

  it("throws when actorRole is not an allowed value", async () => {
    await expect(
      recordScoreFeedback(baseFeedbackParams({ actorRole: "admin" as never }))
    ).rejects.toThrow(/actor_role must be one of/);
    expect(prisma.scoreFeedback.create).not.toHaveBeenCalled();
  });

  it("succeeds and reaches prisma.scoreFeedback.create for valid params", async () => {
    await expect(recordScoreFeedback(baseFeedbackParams())).resolves.toEqual({
      feedback_id: "feedback-1",
    });
    expect(prisma.scoreFeedback.create).toHaveBeenCalledTimes(1);
  });
});

describe("recordPreliminaryJudgement", () => {
  it("throws when justification is an empty string", async () => {
    await expect(
      recordPreliminaryJudgement(baseJudgementParams({ justification: "" }))
    ).rejects.toThrow(/justification is mandatory/);
    expect(prisma.learnerPreliminaryJudgement.create).not.toHaveBeenCalled();
  });

  it("throws when justification is only whitespace", async () => {
    await expect(
      recordPreliminaryJudgement(baseJudgementParams({ justification: "   " }))
    ).rejects.toThrow(/justification is mandatory/);
    expect(prisma.learnerPreliminaryJudgement.create).not.toHaveBeenCalled();
  });



  it("throws when action is neither 'approve' nor 'remand'", async () => {
    await expect(
      recordPreliminaryJudgement(baseJudgementParams({ action: "reject" as never }))
    ).rejects.toThrow(/action must be 'approve' or 'remand'/);
    expect(prisma.learnerPreliminaryJudgement.create).not.toHaveBeenCalled();
  });

  it("succeeds and reaches prisma.learnerPreliminaryJudgement.create for valid 'approve' params", async () => {
    await expect(recordPreliminaryJudgement(baseJudgementParams())).resolves.toEqual({
      judgement_id: "judgement-1",
    });
    expect(prisma.learnerPreliminaryJudgement.create).toHaveBeenCalledTimes(1);
  });

  it("succeeds for valid 'remand' params", async () => {
    await expect(
      recordPreliminaryJudgement(baseJudgementParams({ action: "remand" }))
    ).resolves.toEqual({ judgement_id: "judgement-1" });
    expect(prisma.learnerPreliminaryJudgement.create).toHaveBeenCalledTimes(1);
  });
});

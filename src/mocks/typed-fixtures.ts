import analytics from './analytics.json';
import assignments from './assignments.json';
import type { Assignment, ComparisonSet, Enrollment, Question, Quiz, QuizAttempt, User } from '../types';

// JSON imports retain their inferred structure. Only string discriminants need
// narrowing; check their actual values rather than asserting the entire fixture.
function fixtureLiteral<const T extends string>(value: string, allowed: readonly T[]): T {
  const match = allowed.find((candidate) => candidate === value);
  if (match === undefined) throw new Error(`Unsupported mock fixture value: ${value}`);
  return match;
}

export const fixtureUsers: User[] = analytics.users.map((user) => ({
  ...user,
  role: fixtureLiteral(user.role, ['learner', 'instructor', 'admin']),
  status: fixtureLiteral(user.status, ['active', 'suspended', 'pending', 'invited']),
}));

export const fixtureQuizzes: Quiz[] = analytics.quizzes.map((quiz) => ({
  ...quiz,
  assessmentStage: fixtureLiteral(quiz.assessmentStage, ['pre_test', 'practice', 'post_test']),
  questions: quiz.questions.map((question): Question => {
    if (question.type === 'choice') {
      if (question.options === undefined || question.answer === undefined) {
        throw new Error(`Incomplete mock choice question: ${question.id}`);
      }
      return { ...question, type: 'choice', options: question.options, answer: question.answer };
    }
    const { responseMode, ...essay } = question;
    return {
      ...essay,
      type: fixtureLiteral(question.type, ['essay']),
      ...(responseMode !== undefined && {
        responseMode: fixtureLiteral(responseMode, ['text', 'image', 'either']),
      }),
    };
  }),
}));

export const fixtureAttempts: QuizAttempt[] = analytics.attempts.map((attempt) => ({
  ...attempt,
  essayStatus: fixtureLiteral(attempt.essayStatus, ['none', 'pending', 'graded']),
  status: fixtureLiteral(attempt.status, ['in_progress', 'draft', 'submitted']),
}));

export const fixtureAssignments: Assignment[] = assignments.assignments.map((assignment) => ({
  ...assignment,
  stage: fixtureLiteral(assignment.stage, ['pre_test', 'practice', 'post_test']),
  assigneeType: fixtureLiteral(assignment.assigneeType, ['all_enrolled', 'specific']),
}));

export const fixtureEnrollments: Enrollment[] = analytics.enrollments;
export const fixtureComparisonSets: ComparisonSet[] = analytics.comparisonSets;

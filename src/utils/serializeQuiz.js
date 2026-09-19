// Strip isCorrect from quiz options unless the viewer is an admin — an
// intern (or anonymous visitor) should never receive the answer key in a
// response. Safe to call with null/undefined (e.g. a module with no quiz).
function serializeQuiz(quiz, viewerRole) {
  if (!quiz) return quiz;
  return {
    ...quiz,
    questions: quiz.questions.map((q) => ({
      ...q,
      options: q.options.map((o) =>
        viewerRole === 'ADMIN' ? o : { id: o.id, text: o.text, order: o.order }
      ),
    })),
  };
}

module.exports = { serializeQuiz };
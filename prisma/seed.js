const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Orbit LMS database...');

  await prisma.quizAttempt.deleteMany();
  await prisma.materialCompletion.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.quizOption.deleteMany();
  await prisma.quizQuestion.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.material.deleteMany();
  await prisma.module.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // --- USERS -----------------------------------------------------------
  const mentor = await prisma.user.create({
    data: { firstName: 'Reza', lastName: 'Ardiansyah', email: 'mentor@orbit.com', passwordHash, role: 'ADMIN', department: 'Engineering' },
  });
  const jane = await prisma.user.create({
    data: { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@orbit.com', passwordHash, role: 'INTERN', department: 'Engineering' },
  });
  const budi = await prisma.user.create({
    data: { firstName: 'Budi', lastName: 'Tanuwijaya', email: 'budi.t@orbit.com', passwordHash, role: 'INTERN', department: 'Product & Design' },
  });
  const nadia = await prisma.user.create({
    data: { firstName: 'Nadia', lastName: 'Amelia', email: 'nadia.a@orbit.com', passwordHash, role: 'INTERN', department: 'Marketing' },
  });
  const farhan = await prisma.user.create({
    data: { firstName: 'Farhan', lastName: 'Hidayat', email: 'farhan.h@orbit.com', passwordHash, role: 'INTERN', department: 'Engineering' },
  });

  // --- COURSE 1: Company Culture & Core Values --------------------------
  const cultureCourse = await prisma.course.create({
    data: { title: 'Company Culture & Core Values', category: 'General Onboarding', description: 'An introduction to how the company works and what it values.' },
  });
  const cultureModule = await prisma.module.create({
    data: { courseId: cultureCourse.id, title: 'Introduction to Company Culture', order: 0 },
  });
  const cultureMaterials = await Promise.all([
    prisma.material.create({ data: { moduleId: cultureModule.id, title: 'Welcome to Orbit', type: 'DOCUMENT', url: '/uploads/welcome-to-orbit.pdf', order: 0 } }),
    prisma.material.create({ data: { moduleId: cultureModule.id, title: 'Our Core Values', type: 'VIDEO_LINK', url: 'https://example.com/videos/core-values', order: 1 } }),
  ]);
  const cultureQuiz = await prisma.quiz.create({ data: { moduleId: cultureModule.id, title: 'Mini Quiz: Company Culture Basics' } });
  const cultureQ1 = await prisma.quizQuestion.create({ data: { quizId: cultureQuiz.id, text: 'What should you do if you are unsure about a company policy?', order: 0 } });
  await prisma.quizOption.createMany({
    data: [
      { questionId: cultureQ1.id, text: 'Ask your mentor', isCorrect: true, order: 0 },
      { questionId: cultureQ1.id, text: 'Guess and move on', isCorrect: false, order: 1 },
      { questionId: cultureQ1.id, text: 'Ignore it', isCorrect: false, order: 2 },
      { questionId: cultureQ1.id, text: 'Wait until next quarter', isCorrect: false, order: 3 },
    ],
  });

  // --- COURSE 2: Developer Environment Setup & Workflow -----------------
  const devCourse = await prisma.course.create({
    data: { title: 'Developer Environment Setup & Workflow', category: 'Tech & Tools', description: 'Get your local environment, tools, and version control workflow ready.' },
  });

  const ideModule = await prisma.module.create({ data: { courseId: devCourse.id, title: 'IDE & Editor Setup', order: 0 } });
  await prisma.material.createMany({
    data: [
      { moduleId: ideModule.id, title: 'Installing your code editor', type: 'DOCUMENT', url: '/uploads/editor-setup.pdf', order: 0 },
      { moduleId: ideModule.id, title: 'Essential extensions & shortcuts', type: 'DOCUMENT', url: '/uploads/editor-extensions.pdf', order: 1 },
    ],
  });
  const ideQuiz = await prisma.quiz.create({ data: { moduleId: ideModule.id, title: 'Mini Quiz: Editor Setup' } });
  const ideQ1 = await prisma.quizQuestion.create({ data: { quizId: ideQuiz.id, text: 'What is a benefit of using extensions in your editor?', order: 0 } });
  await prisma.quizOption.createMany({
    data: [
      { questionId: ideQ1.id, text: 'Faster, more consistent workflows', isCorrect: true, order: 0 },
      { questionId: ideQ1.id, text: 'Slower startup time only', isCorrect: false, order: 1 },
      { questionId: ideQ1.id, text: 'No effect on your workflow', isCorrect: false, order: 2 },
      { questionId: ideQ1.id, text: 'They are required to save files', isCorrect: false, order: 3 },
    ],
  });

  const vcsModule = await prisma.module.create({ data: { courseId: devCourse.id, title: 'Version Control Basics', order: 1 } });
  await prisma.material.createMany({
    data: [
      { moduleId: vcsModule.id, title: 'Git fundamentals', type: 'DOCUMENT', url: '/uploads/git-fundamentals.pdf', order: 0 },
      { moduleId: vcsModule.id, title: 'Branching & pull requests', type: 'VIDEO_LINK', url: 'https://example.com/videos/branching-prs', order: 1 },
    ],
  });
  const vcsQuiz = await prisma.quiz.create({ data: { moduleId: vcsModule.id, title: 'Mini Quiz: Git & Version Control' } });
  const vcsQ1 = await prisma.quizQuestion.create({ data: { quizId: vcsQuiz.id, text: 'What is the purpose of a pull request?', order: 0 } });
  await prisma.quizOption.createMany({
    data: [
      { questionId: vcsQ1.id, text: 'To propose and review code changes before merging', isCorrect: true, order: 0 },
      { questionId: vcsQ1.id, text: 'To delete a branch permanently', isCorrect: false, order: 1 },
      { questionId: vcsQ1.id, text: 'To back up your local files', isCorrect: false, order: 2 },
      { questionId: vcsQ1.id, text: 'To install dependencies', isCorrect: false, order: 3 },
    ],
  });

  const serverModule = await prisma.module.create({ data: { courseId: devCourse.id, title: 'Local Dev Server Setup', order: 2 } });
  await prisma.material.create({ data: { moduleId: serverModule.id, title: 'Running the project locally', type: 'DOCUMENT', url: '/uploads/local-dev-server-guide.pdf', order: 0 } });
  const serverQuiz = await prisma.quiz.create({ data: { moduleId: serverModule.id, title: 'Mini Quiz: Local Dev Server' } });
  const serverQ1 = await prisma.quizQuestion.create({ data: { quizId: serverQuiz.id, text: 'What command is commonly used to start a local development server for a Node.js project?', order: 0 } });
  await prisma.quizOption.createMany({
    data: [
      { questionId: serverQ1.id, text: 'npm start', isCorrect: true, order: 0 },
      { questionId: serverQ1.id, text: 'npm deploy', isCorrect: false, order: 1 },
      { questionId: serverQ1.id, text: 'npm publish', isCorrect: false, order: 2 },
      { questionId: serverQ1.id, text: 'npm archive', isCorrect: false, order: 3 },
    ],
  });

  const debugModule = await prisma.module.create({ data: { courseId: devCourse.id, title: 'Debugging Tools', order: 3, published: false } });
  await prisma.material.create({ data: { moduleId: debugModule.id, title: 'Browser & editor debugging tools', type: 'DOCUMENT', url: '/uploads/debugging-tools.pdf', order: 0 } });
  await prisma.quiz.create({ data: { moduleId: debugModule.id, title: 'Mini Quiz: Debugging Tools' } });

  // --- COURSE 3: Workplace Policies & Code of Conduct -------------------
  const policyCourse = await prisma.course.create({
    data: { title: 'Workplace Policies & Code of Conduct', category: 'HR & Compliance', description: 'Understand workplace expectations, conduct, and HR policies.' },
  });
  const hrModule = await prisma.module.create({ data: { courseId: policyCourse.id, title: 'HR Policies & Compliance', order: 0 } });
  await prisma.material.create({ data: { moduleId: hrModule.id, title: 'Workplace Conduct Guide', type: 'DOCUMENT', url: '/uploads/workplace-conduct-guide.pdf', order: 0 } });
  const hrQuiz = await prisma.quiz.create({ data: { moduleId: hrModule.id, title: 'Mini Quiz: Code of Conduct' } });
  const hrQ1 = await prisma.quizQuestion.create({ data: { quizId: hrQuiz.id, text: 'Who should you report a workplace concern to?', order: 0 } });
  await prisma.quizOption.createMany({
    data: [
      { questionId: hrQ1.id, text: 'Your mentor or HR', isCorrect: true, order: 0 },
      { questionId: hrQ1.id, text: 'A coworker at random', isCorrect: false, order: 1 },
      { questionId: hrQ1.id, text: 'No one, it will resolve itself', isCorrect: false, order: 2 },
      { questionId: hrQ1.id, text: 'Social media', isCorrect: false, order: 3 },
    ],
  });

  // --- ENROLLMENTS -------------------------------------------------------
  await prisma.enrollment.createMany({
    data: [
      { userId: jane.id, courseId: cultureCourse.id },
      { userId: jane.id, courseId: devCourse.id },
      { userId: jane.id, courseId: policyCourse.id },
      { userId: budi.id, courseId: cultureCourse.id },
      { userId: budi.id, courseId: devCourse.id },
      { userId: nadia.id, courseId: cultureCourse.id },
      { userId: nadia.id, courseId: policyCourse.id },
      { userId: farhan.id, courseId: devCourse.id },
    ],
  });

  // --- PROGRESS: Jane is mid-way through the culture course -------------
  await prisma.materialCompletion.createMany({
    data: [
      { userId: jane.id, materialId: cultureMaterials[0].id },
      { userId: jane.id, materialId: cultureMaterials[1].id },
    ],
  });
  await prisma.quizAttempt.create({
    data: { userId: jane.id, quizId: cultureQuiz.id, score: 1, totalQuestions: 1, passed: true },
  });

  console.log('Seed complete.');
  console.log('  Users: mentor@orbit.com / jane.smith@orbit.com / budi.t@orbit.com / nadia.a@orbit.com / farhan.h@orbit.com');
  console.log('  Password for all seeded users: password123');
  console.log('  Courses: 3, each with modules, materials, and a mini quiz');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

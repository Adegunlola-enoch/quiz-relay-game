import type { Category, Question } from './types.js';

type SeedQuestion = Omit<Question, 'id'>;

export const CATEGORIES: Category[] = ['General Knowledge', 'Science & Nature', 'Entertainment', 'Sports', 'History', 'Geography'];

const QUESTIONS: SeedQuestion[] = [
  { category: 'General Knowledge', prompt: 'Which planet is known as the Red Planet?', answers: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correctIndex: 1 },
  { category: 'General Knowledge', prompt: 'What is the largest ocean on Earth?', answers: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
  { category: 'General Knowledge', prompt: 'Which instrument has 88 keys?', answers: ['Violin', 'Piano', 'Trumpet', 'Flute'], correctIndex: 1 },
  { category: 'Science & Nature', prompt: 'What gas do plants absorb from the atmosphere?', answers: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], correctIndex: 2 },
  { category: 'Science & Nature', prompt: 'How many bones does a typical adult human body have?', answers: ['106', '206', '306', '406'], correctIndex: 1 },
  { category: 'Science & Nature', prompt: 'What is H₂O commonly called?', answers: ['Salt', 'Water', 'Hydrogen', 'Oxygen'], correctIndex: 1 },
  { category: 'Entertainment', prompt: 'Which medium is traditionally made of 24 frames per second?', answers: ['Film', 'Radio', 'Novel', 'Podcast'], correctIndex: 0 },
  { category: 'Entertainment', prompt: 'What is the name for a movie sequel released before the original story?', answers: ['Remake', 'Prequel', 'Reboot', 'Spin-off'], correctIndex: 1 },
  { category: 'Entertainment', prompt: 'Which role directs the creative vision of a film?', answers: ['Producer', 'Director', 'Editor', 'Composer'], correctIndex: 1 },
  { category: 'Sports', prompt: 'How many players from one team are on a football pitch during play?', answers: ['9', '10', '11', '12'], correctIndex: 2 },
  { category: 'Sports', prompt: 'In tennis, what word means a score of zero?', answers: ['Nil', 'Love', 'Blank', 'Duck'], correctIndex: 1 },
  { category: 'Sports', prompt: 'Which sport uses a shuttlecock?', answers: ['Squash', 'Badminton', 'Table tennis', 'Cricket'], correctIndex: 1 },
  { category: 'History', prompt: 'The Great Pyramid of Giza is in which country?', answers: ['Greece', 'Egypt', 'Mexico', 'Italy'], correctIndex: 1 },
  { category: 'History', prompt: 'Which ancient civilization built Machu Picchu?', answers: ['Roman', 'Maya', 'Inca', 'Viking'], correctIndex: 2 },
  { category: 'History', prompt: 'The printing press is most associated with Johannes…?', answers: ['Kepler', 'Gutenberg', 'Bach', 'Galileo'], correctIndex: 1 },
  { category: 'Geography', prompt: 'What is the capital city of Japan?', answers: ['Kyoto', 'Osaka', 'Tokyo', 'Sapporo'], correctIndex: 2 },
  { category: 'Geography', prompt: 'Which continent has the most countries?', answers: ['Asia', 'Europe', 'Africa', 'South America'], correctIndex: 2 },
  { category: 'Geography', prompt: 'Which river flows through Paris?', answers: ['Thames', 'Danube', 'Seine', 'Rhine'], correctIndex: 2 }
];

export function categoryChoices(): Category[] {
  return [...CATEGORIES].sort(() => Math.random() - 0.5).slice(0, 3);
}

export function nextQuestion(category: Category, used: string[]): Question {
  const candidates = QUESTIONS
    .map((question, index) => ({ question, id: `local-${index}` }))
    .filter(({ question, id }) => question.category === category && !used.includes(id));
  const pool = candidates.length ? candidates : QUESTIONS.map((question, index) => ({ question, id: `local-${index}` })).filter(({ question }) => question.category === category);
  const picked = pool[Math.floor(Math.random() * pool.length)];
  return { ...picked.question, id: picked.id, answers: [...picked.question.answers] };
}

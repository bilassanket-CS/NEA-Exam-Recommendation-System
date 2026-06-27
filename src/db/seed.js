// src/db/seed.js
// Seeds a database with OCR-style Computer Science topics and questions, plus a
// demo student. Used by the server on first run and by tests.

export const TOPICS = [
  "Data Structures",
  "Algorithms",
  "Boolean Logic",
  "Networks",
  "Databases & SQL",
  "Programming Concepts",
];

// Each question: topic (name), prompt, options, answer, difficulty (Elo), marks.
export const QUESTIONS = [
  // Data Structures
  { topic: "Data Structures", prompt: "Which structure follows First-In First-Out (FIFO)?", options: ["Stack", "Queue", "Binary tree", "Hash table"], answer: "Queue", difficulty: 1100, marks: 1 },
  { topic: "Data Structures", prompt: "Which structure follows Last-In First-Out (LIFO)?", options: ["Queue", "Stack", "Linked list", "Graph"], answer: "Stack", difficulty: 1100, marks: 1 },
  { topic: "Data Structures", prompt: "A node with pointers to left and right children describes a:", options: ["Binary tree", "Circular queue", "Hash table", "Array"], answer: "Binary tree", difficulty: 1250, marks: 1 },
  { topic: "Data Structures", prompt: "What is the worst-case time complexity of searching an unsorted array of n items?", options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"], answer: "O(n)", difficulty: 1300, marks: 1 },

  // Algorithms
  { topic: "Algorithms", prompt: "Which algorithm finds the shortest path on a weighted graph with non-negative edges?", options: ["Bubble sort", "Dijkstra", "Linear search", "Binary search"], answer: "Dijkstra", difficulty: 1350, marks: 1 },
  { topic: "Algorithms", prompt: "Binary search requires the data to be:", options: ["Sorted", "Unsorted", "In a stack", "Hashed"], answer: "Sorted", difficulty: 1150, marks: 1 },
  { topic: "Algorithms", prompt: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], answer: "O(log n)", difficulty: 1300, marks: 1 },
  { topic: "Algorithms", prompt: "Merge sort has an average time complexity of:", options: ["O(n)", "O(n^2)", "O(n log n)", "O(log n)"], answer: "O(n log n)", difficulty: 1400, marks: 1 },

  // Boolean Logic
  { topic: "Boolean Logic", prompt: "What is the result of TRUE AND FALSE?", options: ["TRUE", "FALSE", "NULL", "1"], answer: "FALSE", difficulty: 1000, marks: 1 },
  { topic: "Boolean Logic", prompt: "Which gate outputs TRUE only when both inputs differ?", options: ["AND", "OR", "XOR", "NAND"], answer: "XOR", difficulty: 1250, marks: 1 },
  { topic: "Boolean Logic", prompt: "NOT (TRUE OR FALSE) evaluates to:", options: ["TRUE", "FALSE", "Error", "1"], answer: "FALSE", difficulty: 1200, marks: 1 },

  // Networks
  { topic: "Networks", prompt: "Which device connects multiple networks and routes packets between them?", options: ["Switch", "Router", "Hub", "Repeater"], answer: "Router", difficulty: 1150, marks: 1 },
  { topic: "Networks", prompt: "What does TCP guarantee that UDP does not?", options: ["Speed", "Reliable, ordered delivery", "Encryption", "Lower latency"], answer: "Reliable, ordered delivery", difficulty: 1350, marks: 1 },
  { topic: "Networks", prompt: "An IPv4 address is how many bits?", options: ["16", "32", "64", "128"], answer: "32", difficulty: 1200, marks: 1 },

  // Databases & SQL
  { topic: "Databases & SQL", prompt: "Which SQL clause filters rows?", options: ["ORDER BY", "WHERE", "GROUP BY", "JOIN"], answer: "WHERE", difficulty: 1100, marks: 1 },
  { topic: "Databases & SQL", prompt: "A field that uniquely identifies each record is the:", options: ["Foreign key", "Primary key", "Index", "Attribute"], answer: "Primary key", difficulty: 1150, marks: 1 },
  { topic: "Databases & SQL", prompt: "Which SQL keyword combines rows from two tables on a matching column?", options: ["MERGE", "JOIN", "UNION", "LINK"], answer: "JOIN", difficulty: 1300, marks: 1 },

  // Programming Concepts
  { topic: "Programming Concepts", prompt: "A subroutine that returns a value is called a:", options: ["Procedure", "Function", "Loop", "Variable"], answer: "Function", difficulty: 1050, marks: 1 },
  { topic: "Programming Concepts", prompt: "Which programming construct repeats code a fixed number of times?", options: ["IF statement", "WHILE loop", "FOR loop", "Switch"], answer: "FOR loop", difficulty: 1100, marks: 1 },
  { topic: "Programming Concepts", prompt: "Hiding internal data behind methods is known as:", options: ["Inheritance", "Encapsulation", "Polymorphism", "Recursion"], answer: "Encapsulation", difficulty: 1350, marks: 1 },
];

/** Seed topics + questions (+ optional demo student) into a Database instance. */
export function seed(database, { withStudent = true } = {}) {
  const topicIds = new Map();
  for (const name of TOPICS) topicIds.set(name, database.addTopic(name));
  for (const q of QUESTIONS) {
    database.addQuestion({
      topicId: topicIds.get(q.topic),
      prompt: q.prompt,
      options: q.options,
      answer: q.answer,
      difficulty: q.difficulty,
      marks: q.marks,
    });
  }
  let studentId = null;
  if (withStudent) studentId = database.addStudent("Demo Student");
  return { topicIds, studentId };
}

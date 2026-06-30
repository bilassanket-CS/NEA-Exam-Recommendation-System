// src/db/seed.js
// Seeds OCR-style Computer Science topics and questions (objective + written),
// plus demo accounts for each role. Used by the server on first run and by tests.

export const TOPICS = [
  "Data Structures", "Algorithms", "Boolean Logic",
  "Networks", "Databases & SQL", "Programming Concepts",
];

// Objective (auto-marked) and written (self-marked) questions.
export const QUESTIONS = [
  { topic: "Data Structures", sub: "Queues", prompt: "Which structure follows First-In First-Out (FIFO)?", options: ["Stack", "Queue", "Binary tree", "Hash table"], answer: "Queue", difficulty: 1100 },
  { topic: "Data Structures", sub: "Stacks", prompt: "Which structure follows Last-In First-Out (LIFO)?", options: ["Queue", "Stack", "Linked list", "Graph"], answer: "Stack", difficulty: 1100 },
  { topic: "Data Structures", sub: "Trees", prompt: "A node with pointers to left and right children describes a:", options: ["Binary tree", "Circular queue", "Hash table", "Array"], answer: "Binary tree", difficulty: 1250 },
  { topic: "Data Structures", sub: "Complexity", prompt: "Worst-case time complexity of searching an unsorted array of n items?", options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"], answer: "O(n)", difficulty: 1300 },

  { topic: "Algorithms", sub: "Graphs", prompt: "Which algorithm finds the shortest path on a weighted graph with non-negative edges?", options: ["Bubble sort", "Dijkstra", "Linear search", "Binary search"], answer: "Dijkstra", difficulty: 1350 },
  { topic: "Algorithms", sub: "Searching", prompt: "Binary search requires the data to be:", options: ["Sorted", "Unsorted", "In a stack", "Hashed"], answer: "Sorted", difficulty: 1150 },
  { topic: "Algorithms", sub: "Complexity", prompt: "What is the time complexity of binary search?", options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"], answer: "O(log n)", difficulty: 1300 },
  { topic: "Algorithms", sub: "Sorting", prompt: "Merge sort has an average time complexity of:", options: ["O(n)", "O(n^2)", "O(n log n)", "O(log n)"], answer: "O(n log n)", difficulty: 1400 },

  { topic: "Boolean Logic", sub: "Gates", prompt: "What is the result of TRUE AND FALSE?", options: ["TRUE", "FALSE", "NULL", "1"], answer: "FALSE", difficulty: 1000 },
  { topic: "Boolean Logic", sub: "Gates", prompt: "Which gate outputs TRUE only when both inputs differ?", options: ["AND", "OR", "XOR", "NAND"], answer: "XOR", difficulty: 1250 },
  { topic: "Boolean Logic", sub: "Expressions", prompt: "NOT (TRUE OR FALSE) evaluates to:", options: ["TRUE", "FALSE", "Error", "1"], answer: "FALSE", difficulty: 1200 },

  { topic: "Networks", sub: "Hardware", prompt: "Which device routes packets between multiple networks?", options: ["Switch", "Router", "Hub", "Repeater"], answer: "Router", difficulty: 1150 },
  { topic: "Networks", sub: "Protocols", prompt: "What does TCP guarantee that UDP does not?", options: ["Speed", "Reliable, ordered delivery", "Encryption", "Lower latency"], answer: "Reliable, ordered delivery", difficulty: 1350 },
  { topic: "Networks", sub: "Addressing", prompt: "An IPv4 address is how many bits?", options: ["16", "32", "64", "128"], answer: "32", difficulty: 1200 },

  { topic: "Databases & SQL", sub: "Queries", prompt: "Which SQL clause filters rows?", options: ["ORDER BY", "WHERE", "GROUP BY", "JOIN"], answer: "WHERE", difficulty: 1100 },
  { topic: "Databases & SQL", sub: "Keys", prompt: "A field that uniquely identifies each record is the:", options: ["Foreign key", "Primary key", "Index", "Attribute"], answer: "Primary key", difficulty: 1150 },
  { topic: "Databases & SQL", sub: "Joins", prompt: "Which SQL keyword combines rows from two tables on a matching column?", options: ["MERGE", "JOIN", "UNION", "LINK"], answer: "JOIN", difficulty: 1300 },

  { topic: "Programming Concepts", sub: "Subroutines", prompt: "A subroutine that returns a value is called a:", options: ["Procedure", "Function", "Loop", "Variable"], answer: "Function", difficulty: 1050 },
  { topic: "Programming Concepts", sub: "Iteration", prompt: "Which construct repeats code a fixed number of times?", options: ["IF statement", "WHILE loop", "FOR loop", "Switch"], answer: "FOR loop", difficulty: 1100 },
  { topic: "Programming Concepts", sub: "OOP", prompt: "Hiding internal data behind methods is known as:", options: ["Inheritance", "Encapsulation", "Polymorphism", "Recursion"], answer: "Encapsulation", difficulty: 1350 },

  // Written / extended-answer questions (self-marked against a mark scheme)
  { topic: "Data Structures", sub: "Stacks vs Queues", type: "written", prompt: "Explain the difference between a stack and a queue, giving one use of each. (2 marks)", marks: 2, difficulty: 1300,
    markScheme: "1 mark: a stack is LIFO and a queue is FIFO. 1 mark: a valid use of each, e.g. stack for undo/call stack, queue for print/job scheduling." },
  { topic: "Algorithms", sub: "Big-O", type: "written", prompt: "State the time complexity of linear search and of binary search, and explain why binary search is faster on large sorted data. (3 marks)", marks: 3, difficulty: 1400,
    markScheme: "1 mark: linear search O(n). 1 mark: binary search O(log n). 1 mark: binary search halves the search space each step, so it needs far fewer comparisons as n grows." },
  { topic: "Databases & SQL", sub: "Normalisation", type: "written", prompt: "Describe one benefit of using a primary key in a relational table. (1 mark)", marks: 1, difficulty: 1250,
    markScheme: "1 mark: uniquely identifies each record / prevents duplicate rows / allows other tables to reference it via a foreign key." },
];

export const DEMO_USERS = [
  { name: "Demo Student", email: "student@example.com", password: "student123", role: "student" },
  { name: "Demo Teacher", email: "teacher@example.com", password: "teacher123", role: "teacher" },
  { name: "Demo Admin",   email: "admin@example.com",   password: "admin123",   role: "admin" },
];

export function seed(database, { withUsers = true } = {}) {
  const topicIds = new Map();
  for (const name of TOPICS) topicIds.set(name, database.addTopic(name));
  for (const q of QUESTIONS) {
    database.addQuestion({
      topicId: topicIds.get(q.topic), subTopic: q.sub, type: q.type || "objective",
      prompt: q.prompt, options: q.options || [], answer: q.answer || "",
      markScheme: q.markScheme || null, difficulty: q.difficulty || 1200, marks: q.marks || 1,
    });
  }
  const users = {};
  let studentId = null;
  if (withUsers) {
    for (const u of DEMO_USERS) {
      const id = database.addUser(u);
      users[u.role] = id;
      if (u.role === "student") studentId = id;
    }
  }
  return { topicIds, users, studentId };
}

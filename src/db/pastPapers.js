// src/db/pastPapers.js
// A small corpus of real excerpts transcribed from genuine, publicly-downloadable
// OCR H446 (Computer Science A Level) mark schemes, covering the app's existing
// topics. Transcribed once by hand during development — NOT parsed live at
// runtime (no PDF-parsing dependency), consistent with the project's
// zero-external-dependencies design. src/engine/retrieval.js builds a TF-IDF
// search index over this array at startup.

export const PAST_PAPER_EXCERPTS = [
  {
    topic: "Data Structures",
    excerptText: "A queue is FIFO (First-In First-Out); a stack is LIFO (Last-In First-Out). "
      + "A stack uses one pointer (to the top); a queue uses two pointers (head and tail). "
      + "In a stack, data is pushed/popped from the top. In a queue, data is enqueued onto the "
      + "back and dequeued from the front.",
    sourceTitle: "OCR H446/01 Computer Systems — Mark Scheme, June 2023, Q2(c)(i)",
    sourceUrl: "https://www.ocr.org.uk/Images/703953-mark-scheme-computer-systems.pdf",
    paperCode: "H446/01", series: "June 2023",
  },
  {
    topic: "Algorithms",
    excerptText: "Merge sort has a space complexity of O(n) rather than O(1)/constant. Merge sort "
      + "is always O(n log2 n), whereas the best case for bubble sort is O(n).",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q7",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
  {
    topic: "Boolean Logic",
    excerptText: "NOT (A OR B) XOR C. The first marking point requires brackets — 'NOT A OR B' on "
      + "its own is incorrect. The expression can be written in a different order (e.g. "
      + "C XOR NOT (B OR A)) as long as it is logically equivalent.",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q6(a)(i)",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
  {
    topic: "Boolean Logic",
    excerptText: "A half adder has two outputs from inputs A and B: the sum S = A XOR B, and the "
      + "carry C = A AND B. Truth table: A=0,B=0 gives S=0,C=0; A=0,B=1 gives S=1,C=0; A=1,B=0 "
      + "gives S=1,C=0; A=1,B=1 gives S=0,C=1. Two half adders can be joined together with an OR "
      + "gate to form a full adder; four full adders can be used to add two four-bit numbers.",
    sourceTitle: "OCR H446/01 Computer Systems — Mark Scheme, Autumn 2021, Q5",
    sourceUrl: "https://www.ocr.org.uk/Images/666849-mark-scheme-computer-systems.pdf",
    paperCode: "H446/01", series: "Autumn 2021",
  },
  {
    topic: "Databases & SQL",
    excerptText: "The SELECT keyword chooses which fields to return, and the FROM keyword "
      + "specifies the table(s) being queried. Tables can be joined using the JOIN (or INNER "
      + "JOIN) keyword, or equivalently a WHERE clause comparing the shared key fields between "
      + "the two tables. Fields should be qualified with their table name where the same field "
      + "name exists in more than one table. A WHERE clause can also filter rows to show only "
      + "records matching a particular condition.",
    sourceTitle: "OCR H446/01 Computer Systems — Mark Scheme, June 2022",
    sourceUrl: "https://www.ocr.org.uk/Images/676943-mark-scheme-computer-systems.pdf",
    paperCode: "H446/01", series: "June 2022",
  },
  {
    topic: "Databases & SQL",
    excerptText: "A relational database stores data in multiple different tables, linked "
      + "together using relationships created by primary and foreign keys — the primary key of "
      + "one table can be used as a foreign key in another to create a one-to-many relationship. "
      + "Benefits: less duplication/redundant data, which can reduce file size; the database is "
      + "easier to manage and expand; searching may be faster, since not every table needs to be "
      + "searched; it can be more secure, as different tables can have different access levels.",
    sourceTitle: "OCR H446/01 Computer Systems — Mark Scheme, June 2024",
    sourceUrl: "https://www.ocr.org.uk/Images/726741-mark-scheme-computer-systems.pdf",
    paperCode: "H446/01", series: "June 2024",
  },
  {
    topic: "Programming Concepts",
    excerptText: "One piece of code (a subroutine) can be used many times, in multiple places, "
      + "which makes code more efficient — there is no need to write the same code multiple "
      + "times. This takes less time to plan, design and code the program; makes errors easier "
      + "to detect and fix, since fixing it once corrects every place it is used; and makes the "
      + "program easier to maintain.",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q4(c)",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
  {
    topic: "Networks",
    excerptText: "Router: connects networks together, assigns IP addresses to devices, and "
      + "examines data packets and forwards them between networks. Switch: connects multiple "
      + "wired devices on the same network and forwards data to the intended recipient based "
      + "on its MAC address. Hub: receives a signal and broadcasts it to every connected device, "
      + "with no filtering. Repeater: receives a signal and retransmits it to extend the range "
      + "of a network. Gateway: connects different types of network and translates protocols "
      + "between them. Bridge: connects different segments of the same network.",
    sourceTitle: "OCR H446/01 Computer Systems — Mark Scheme, June 2024, Q6(d)",
    sourceUrl: "https://www.ocr.org.uk/Images/726741-mark-scheme-computer-systems.pdf",
    paperCode: "H446/01", series: "June 2024",
  },
  {
    topic: "Networks",
    excerptText: "One mark per protocol correctly identified, e.g.: HTTP (Hypertext Transfer "
      + "Protocol), HTTPS (HTTP Secure), TCP (Transmission Control Protocol), IP (Internet "
      + "Protocol), UDP (User Datagram Protocol), FTP (File Transfer Protocol), DHCP (Dynamic "
      + "Host Configuration Protocol), SMTP (Simple Mail Transfer Protocol), POP (Post Office "
      + "Protocol), IMAP (Internet Message Access Protocol).",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q1(d)(iii)",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
  {
    topic: "Databases & SQL",
    excerptText: "One mark each, up to a maximum of 2, e.g.: connect to the database; access "
      + "usernames in the file/database; check the username against the file/database; hash the "
      + "password; access the password/hash in the file/database; check the entered/hashed "
      + "password against the stored value; output the result.",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q8(b)",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
  {
    topic: "Programming Concepts",
    excerptText: "One mark each, up to a maximum of 3: each recursive call creates a new copy of "
      + "the values; there is a base case / condition that stops the recursive calls; there may "
      + "be more than one base case.",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q5(a)",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
  {
    topic: "Programming Concepts",
    excerptText: "One mark each, up to a maximum of 4: inheritance can be used to extend existing "
      + "classes; classes can be modified or extended; it limits how attributes are changed, via "
      + "methods; this is better for code organisation as part of a class's members.",
    sourceTitle: "OCR H446/02 Algorithms and Programming — Mark Scheme, June 2023, Q9(e)",
    sourceUrl: "https://www.ocr.org.uk/Images/703954-mark-scheme-algorithms-and-programming.pdf",
    paperCode: "H446/02", series: "June 2023",
  },
];

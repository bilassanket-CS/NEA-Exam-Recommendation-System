import { createServer } from "./src/server.js";

const port = process.env.PORT || 3000;

const server = createServer();

server.listen(port, () => {
  console.log(`Exam Recommender started on port ${port}`);
});
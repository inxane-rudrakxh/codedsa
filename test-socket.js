const { io } = require("socket.io-client");
const socket = io("http://localhost:4000");

socket.on("connect", () => {
  console.log("Connected");
  socket.emit("execute", {
    code: "#include <iostream>\nint main() { std::cout << \"Hello Interactive World\\n\"; return 0; }",
    language: "cpp"
  });
});

socket.on("output", (data) => {
  console.log("OUTPUT:", data);
});

socket.on("finished", () => {
  console.log("Finished");
  process.exit(0);
});

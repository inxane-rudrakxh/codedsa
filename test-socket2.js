const { io } = require("socket.io-client");
const socket = io("http://localhost:4000");

socket.on("connect", () => {
  console.log("Connected");
  socket.emit("execute", {
    code: "#include <iostream>\nint main() { int x; std::cout << \"Enter x:\"; std::cin >> x; std::cout << \"\\nYou entered: \" << x << \"\\n\"; return 0; }",
    language: "cpp"
  });
});

socket.on("output", (data) => {
  process.stdout.write(data);
  if (data.includes("Enter x:")) {
    console.log("Sending input 42...");
    socket.emit("input", "42\r");
  }
});

socket.on("finished", () => {
  console.log("\nFinished");
  process.exit(0);
});

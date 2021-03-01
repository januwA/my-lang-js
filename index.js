const readline = require("readline");
const basic = require("./basic");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const waitForUserInput = function () {
  rl.question("", (text) => {
    try {
      const tokens = basic('<stdin>', text);
      console.log(tokens.map((it) => it.toString()).join(" "));
    } catch (error) {
      console.log(error.toString());
    }
    waitForUserInput();
  });
};

waitForUserInput();

// const tokens = basic("1+1");
// for (const t of tokens) {
//   console.log(t.toString());
// }

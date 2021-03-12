const readline = require("readline");
const basic = require("./basic");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const waitForUserInput = function () {
  rl.question("", (text) => {
    try {
      const r = basic("<stdin>", text);
      console.log(r.toString());
    } catch (error) {
      console.log(error.toString());
    }
    waitForUserInput();
  });
};

waitForUserInput();

// basic("<stdin>", "1+2*3");

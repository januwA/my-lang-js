const readline = require("readline");
const basic = require("./basic");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const waitForUserInput = function () {
  rl.question("", (text) => {
    try {
      const rtRes = basic("<stdin>", text);
      console.log(rtRes.value);
    } catch (error) {
      console.log(error.toString());
    }
    waitForUserInput();
  });
};

waitForUserInput();

// basic("<stdin>", "var a = 1");

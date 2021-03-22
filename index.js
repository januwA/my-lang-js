const readline = require("readline");
const basic = require("./basic");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const waitForUserInput = function () {
  rl.question("", (text) => {
    try {
      const result = basic("<stdin>", text);
      if (result) console.log(result.value);
    } catch (error) {
      console.log(error.toString());
    }
    waitForUserInput();
  });
};

waitForUserInput();

// basic("<stdin>", "if 1==1 then 2");

// basic("<stdin>", `var n = 1 for i = 0 to 10 then var n = n + i`);

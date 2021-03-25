import * as readline from "readline";
import * as basic from "./basic";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const waitForUserInput = function () {
  rl.question("basic> ", (text) => {
    try {
      const result = basic.run("<stdin>", text);
      if (result) console.log(result.toString());
    } catch (error) {
      console.log(error.toString());
    }
    waitForUserInput();
  });
};

waitForUserInput();

// basic("<stdin>", "if 1==1 then 2");

// basic("<stdin>", `var n = 1 for i = 0 to 10 then var n = n + i`);

// basic.run("<stdin>", "isList(1)");

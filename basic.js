const DIGITS = "0123456789.";

const TT_INT = "INT";
const TT_FLOAT = "FLOAT";
const TT_PLUS = "PLUS"; // +
const TT_MINUS = "MINUS"; // -
const TT_MUL = "MUL"; // *
const TT_DIV = "DIV"; // /
const TT_LPAREN = "LPAREN"; // (
const TT_RPAREN = "RPAREN"; // )

class Position {
  constructor(index, row, col, fileName, fileText) {
    this.index = index;
    this.row = row;
    this.col = col;
    this.fileName = fileName;
    this.fileText = fileText;
  }

  advance(char) {
    this.index++;
    this.col++;
    if (char === "\n") {
      this.col = 0;
      this.row++;
    }
  }

  copy() {
    return new Position(
      this.index,
      this.row,
      this.col,
      this.fileName,
      this.fileText
    );
  }
}

class Error {
  constructor(name, posStart, posEnd, details) {
    this.posStart = posStart;
    this.posEnd = posEnd;
    this.name = name;
    this.details = details;
  }

  toString() {
    return `${this.name}: '${this.details}'\nFile: '${this.posStart.fileName}' index(${this.posStart.index}), row(${this.posStart.row}), col(${this.posStart.col})`;
  }
}

class IllegalCharError extends Error {
  constructor(posStart, posEnd, details) {
    super("Illegal CharError", posStart, posEnd, details);
  }
}

class Token {
  constructor(type, value) {
    this.type = type;
    this.value = value;
  }

  toString() {
    return this.value !== undefined
      ? `${this.type}:${this.value}`
      : `${this.type}`;
  }
}

class Lexer {
  constructor(fileName, text) {
    this.fileName = fileName;
    this.text = text;
    this.pos = new Position(-1, 0, -1, fileName, text);
    this.curChar = null;
    this.advance();
  }

  advance() {
    this.pos.advance(this.curChar);
    if (this.pos.index < this.text.length) {
      this.curChar = this.text[this.pos.index];
    } else {
      this.curChar = null;
    }
  }

  makeTokens() {
    const tokens = [];

    while (this.curChar !== null) {
      if (DIGITS.includes(this.curChar)) {
        tokens.push(this.makeNumber());
        continue;
      }
      switch (this.curChar) {
        case " ":
        case "\t":
          this.advance();
          break;
        case "+":
          tokens.push(new Token(TT_PLUS));
          this.advance();
          break;

        case "-":
          tokens.push(new Token(TT_MINUS));
          this.advance();
          break;

        case "*":
          tokens.push(new Token(TT_MUL));
          this.advance();
          break;

        case "/":
          tokens.push(new Token(TT_DIV));
          this.advance();
          break;

        case "(":
          tokens.push(new Token(TT_LPAREN));
          this.advance();
          break;

        case ")":
          tokens.push(new Token(TT_RPAREN));
          this.advance();
          break;

        default:
          const posStart = this.pos.copy();
          const c = this.curChar;
          this.advance();
          throw new IllegalCharError(posStart, this.pos, c);
      }
    }

    return tokens;
  }

  makeNumber() {
    let numStr = "";
    let isDot = false;
    while (this.curChar !== null && DIGITS.includes(this.curChar)) {
      if (this.curChar === ".") {
        if (isDot === true) break; // error
        isDot = true;
        numStr += ".";
      } else {
        numStr += this.curChar;
      }

      this.advance();
    }

    if (isDot) return new Token(TT_FLOAT, Number(numStr));
    else return new Token(TT_INT, Number(numStr));
  }
}

module.exports = function run(fileName, text) {
  return new Lexer(fileName, text).makeTokens();
};

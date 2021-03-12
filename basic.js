const stringsWithArrows = require("./strings-with-arrows");

const DIGITS = "0123456789.";

const TT_INT = "INT";
const TT_FLOAT = "FLOAT";
const TT_PLUS = "PLUS"; // +
const TT_MINUS = "MINUS"; // -
const TT_MUL = "MUL"; // *
const TT_DIV = "DIV"; // /
const TT_LPAREN = "LPAREN"; // (
const TT_RPAREN = "RPAREN"; // )
const TT_EOF = "EOF";

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
  constructor(name, posStart, posEnd, message) {
    this.posStart = posStart;
    this.posEnd = posEnd;
    this.name = name;
    this.message = message;
  }

  toString() {
    let err = `${this.name}: '${this.message}'\n`;
    err += `File: '${this.posStart.fileName}' index(${this.posStart.index}), row(${this.posStart.row}), col(${this.posStart.col})\n\n`;
    err += stringsWithArrows(
      this.posStart.fileText,
      this.posStart,
      this.posEnd
    );
    err += "\n";
    return err;
  }
}

class IllegalCharError extends Error {
  constructor(posStart, posEnd, message) {
    super("Illegal CharError", posStart, posEnd, message);
  }
}

class InvalidSyntaxError extends Error {
  constructor(posStart, posEnd, message) {
    super("Invalid Syntax", posStart, posEnd, message);
  }
}

class Token {
  constructor(type, value, posStart, posEnd) {
    this.type = type;
    this.value = value;
    if (posStart) {
      this.posStart = posStart.copy();
      this.posEnd = posStart.copy();
      this.posEnd.advance();
    }

    if (posEnd) {
      this.posEnd = posEnd;
    }
  }

  toString() {
    return this.value !== undefined && this.value !== null
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
          tokens.push(new Token(TT_PLUS, null, this.pos));
          this.advance();
          break;

        case "-":
          tokens.push(new Token(TT_MINUS, null, this.pos));
          this.advance();
          break;

        case "*":
          tokens.push(new Token(TT_MUL, null, this.pos));
          this.advance();
          break;

        case "/":
          tokens.push(new Token(TT_DIV, null, this.pos));
          this.advance();
          break;

        case "(":
          tokens.push(new Token(TT_LPAREN, null, this.pos));
          this.advance();
          break;

        case ")":
          tokens.push(new Token(TT_RPAREN, null, this.pos));
          this.advance();
          break;

        default:
          const posStart = this.pos.copy();
          const c = this.curChar;
          this.advance();
          throw new IllegalCharError(posStart, this.pos, c);
      }
    }

    tokens.push(new Token(TT_EOF, null, this.pos));
    return tokens;
  }

  makeNumber() {
    let numStr = "";
    let isDot = false;
    const posStart = this.pos.copy();

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

    if (isDot) return new Token(TT_FLOAT, Number(numStr), posStart, this.pos);
    else return new Token(TT_INT, Number(numStr), posStart, this.pos);
  }
}

// 数字节点
class NumberNode {
  constructor(token) {
    this.token = token;
  }

  toString() {
    return this.token.toString();
  }
}

class UnaryOpNode {
  constructor(token, node) {
    this.token = token;
    this.node = node;
  }

  toString() {
    return `${this.token.toString()}, ${this.node.toString()}`;
  }
}

// 运算节点
class BinOpNode {
  constructor(leftNode, token, rightNode) {
    this.leftNode = leftNode;
    this.token = token;
    this.rightNode = rightNode;
  }

  toString() {
    return `(${this.leftNode.toString()}, ${this.token.toString()}, ${this.rightNode.toString()})`;
  }
}

class ParseRusult {
  constructor() {
    this.error = null;
    this.node = null;
  }

  hasError() {
    return !!this.error;
  }

  register(res) {
    if (res instanceof ParseRusult) {
      if (res.error) this.error = res.error;
      return res.node;
    } else {
      return res;
    }
  }

  success(node) {
    this.node = node;
    return this;
  }

  failure(error) {
    this.error = error;
    return this;
  }
}

// 解析Lexer
class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = -1;
    this.curToken = null;
    this.advance();
  }

  advance() {
    this.index++;
    if (this.index < this.tokens.length) {
      this.curToken = this.tokens[this.index];
    } else {
      return this.curToken;
    }
  }

  parse() {
    const res = this.expr();
    if (!res.error && this.curToken.type !== TT_EOF) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected +, -, *, /`
        )
      );
    }
    return res;
  }

  factor() {
    const res = new ParseRusult();
    const token = this.curToken;

    if (token.type === TT_PLUS || token.type === TT_MINUS) {
      // +1 or -1
      res.register(this.advance());
      const _factor = res.register(this.factor());
      if (res.error) return res;
      else return res.success(new UnaryOpNode(token, _factor));
    } else if (token.type === TT_INT || token.type === TT_FLOAT) {
      // 1 or 1.2
      res.register(this.advance());
      return res.success(new NumberNode(token));
    } else if (token.type === TT_LPAREN) {
      // (1)
      res.register(this.advance());
      const _expr = res.register(this.expr());
      if (res.hasError()) return res;
      if (this.curToken.type === TT_RPAREN) {
        res.register(this.advance());
        return res.success(_expr);
      } else {
        return res.failure(
          new InvalidSyntaxError(
            `Expected ')'`,
            this.curToken.posStart,
            this.curToken.posEnd
          )
        );
      }
    } else {
      return res.failure(
        new InvalidSyntaxError(
          token.posStart,
          token.posEnd,
          `Expected int or float`
        )
      );
    }
  }

  term() {
    return this.binOp(this.factor.bind(this), [TT_MUL, TT_DIV]);
  }

  expr() {
    return this.binOp(this.term.bind(this), [TT_PLUS, TT_MINUS]);
  }

  binOp(handle, ops) {
    const res = new ParseRusult();
    let leftNode = res.register(handle()); // number节点
    if (res.error) return res;

    while (ops.includes(this.curToken.type)) {
      // 运算符号节点
      const token = this.curToken;
      res.register(this.advance());
      const rightNode = res.register(handle()); // number节点
      if (res.error) return res;

      // 递归
      leftNode = new BinOpNode(leftNode, token, rightNode);
    }
    return res.success(leftNode);
  }
}

module.exports = function run(fileName, text) {
  const lexer = new Lexer(fileName, text);
  const tokens = lexer.makeTokens();

  const parser = new Parser(tokens);
  const res = parser.parse();
  if (res.error) {
    throw res.error;
  }
  return res.node;
};

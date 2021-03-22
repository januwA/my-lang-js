const stringsWithArrows = require("./strings-with-arrows");

const DIGITS = /[^0-9\.]/;
const LETTERS = /[^a-zA-Z0-9_]/;

const TT_INT = "INT";
const TT_FLOAT = "FLOAT";
const TT_IDENTIFIER = "IDENTIFIER";
const TT_KEYWORD = "KEYWORD";
const TT_PLUS = "PLUS"; // +
const TT_MINUS = "MINUS"; // -
const TT_MUL = "MUL"; // *
const TT_DIV = "DIV"; // /
const TT_POW = "POW"; // **
const TT_EQ = "EQ";
const TT_LPAREN = "LPAREN"; // (
const TT_RPAREN = "RPAREN"; // )
const TT_EE = "EE"; // ==
const TT_NE = "NE"; // !=
const TT_LT = "LT"; // <
const TT_GT = "GT"; // >
const TT_LTE = "LTE"; // <=
const TT_GTE = "GTE"; // >=
const TT_COMMA = "COMMA"; // ,
const TT_ARROW = "ARROW"; // ->
const TT_EOF = "EOF";
const KEYWORDS = [
  "var",
  "&&",
  "||",
  "!",
  "if",
  "then",
  "elif",
  "else",
  "for",
  "to",
  "step",
  "while",
  "fun",
];

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
    err += `\tFile: '${this.posStart.fileName}' row(${this.posStart.row}), col(${this.posStart.col})\n\n`;
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

class RTError extends Error {
  constructor(posStart, posEnd, message, context) {
    super("Runtime Error", posStart, posEnd, message);
    this.context = context;
  }

  toString() {
    let err = "";
    err += this.generateTraceback();
    err += `${this.name}: '${this.message}'\n`;
    err += stringsWithArrows(
      this.posStart.fileText,
      this.posStart,
      this.posEnd
    );
    err += "\n";
    return err;
  }

  generateTraceback() {
    let err = "";
    err += "Traceback (most recent call last):\n";
    let pos = this.posStart;
    let ctx = this.context;

    while (ctx) {
      err += `\tFile: '${pos.fileName}' row(${pos.row}), col(${pos.col}), in ${ctx.contextName}\n`;
      pos = ctx.parentEntryPos;
      ctx = ctx.parent;
    }
    return err;
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

  matches(type, value) {
    return this.type == type && this.value == value;
  }

  toString() {
    return this.value !== undefined && this.value !== null
      ? `${this.type}:${this.value}`
      : `${this.type}`;
  }
}

/**
 * 词法分析器
 * 只做词法分析和检测错误的符号,生成tokens
 * 不做语法检查
 */
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
      if (!DIGITS.test(this.curChar)) {
        tokens.push(this.makeNumber());
        continue;
      }

      if (!LETTERS.test(this.curChar)) {
        tokens.push(this.makeIdentifier());
        continue;
      }

      switch (this.curChar) {
        case " ":
        case "\t":
        case "\n":
          this.advance();
          break;
        case "+":
          tokens.push(new Token(TT_PLUS, null, this.pos));
          this.advance();
          break;

        case "-":
          tokens.push(this.makeMinusOrArrow());
          break;

        case "*":
          tokens.push(this.makeMulOrPow());
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

        case ",":
          tokens.push(new Token(TT_COMMA, null, this.pos));
          this.advance();
          break;
        case "!":
          tokens.push(this.makeNotEquals());
          break;
        case "=":
          tokens.push(this.makeEquals());
          break;
        case ">":
          tokens.push(this.makeGreaterThan());
          break;
        case "<":
          tokens.push(this.makeLessThan());
          break;
        case "&":
          tokens.push(this.makeAnd());
          break;
        case "|":
          tokens.push(this.makeOr());
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

  // - or ->
  makeMinusOrArrow() {
    const posStart = this.pos.copy();
    let tokenType = TT_MINUS;
    this.advance();

    if (this.curChar === ">") {
      this.advance();
      tokenType = TT_ARROW;
    }

    return new Token(tokenType, null, posStart, this.pos);
  }

  // * or **
  makeMulOrPow() {
    const posStart = this.pos.copy();
    let tokenType = TT_MUL;
    this.advance();

    if (this.curChar === "*") {
      this.advance();
      tokenType = TT_POW;
    }

    return new Token(tokenType, null, posStart, this.pos);
  }

  makeNumber() {
    let numStr = "";
    let isDot = false;
    const posStart = this.pos.copy();

    while (this.curChar !== null && !DIGITS.test(this.curChar)) {
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

  makeIdentifier() {
    let idStr = "";
    const posStart = this.pos.copy();
    while (this.curChar !== null && !LETTERS.test(this.curChar)) {
      idStr += this.curChar;
      this.advance();
    }
    let tokenType = TT_IDENTIFIER;
    if (KEYWORDS.includes(idStr)) tokenType = TT_KEYWORD;
    return new Token(tokenType, idStr, posStart, this.pos);
  }

  makeAnd() {
    const posStart = this.pos.copy();
    this.advance();

    if (this.curChar === "&") {
      this.advance();
      return new Token(TT_KEYWORD, "&&", posStart, this.pos);
    } else {
      // bits not
      // return new Token(TT_KEYWORD, "|", posStart, this.pos);
    }
  }

  makeOr() {
    const posStart = this.pos.copy();
    this.advance();

    if (this.curChar === "|") {
      this.advance();
      return new Token(TT_KEYWORD, "||", posStart, this.pos);
    } else {
      // bits or
      // return new Token(TT_KEYWORD, "|", posStart, this.pos);
    }
  }

  makeNotEquals() {
    const posStart = this.pos.copy();
    this.advance();

    if (this.curChar === "=") {
      this.advance();
      return new Token(TT_NE, null, posStart, this.pos);
    } else {
      // not
      return new Token(TT_KEYWORD, "!", posStart, this.pos);
    }
  }

  makeEquals() {
    const posStart = this.pos.copy();
    let tokenType = TT_EQ;
    this.advance();

    if (this.curChar === "=") {
      this.advance();
      tokenType = TT_EE;
    }
    return new Token(tokenType, null, posStart, this.pos);
  }

  makeLessThan() {
    const posStart = this.pos.copy();
    let tokenType = TT_LT;
    this.advance();

    if (this.curChar === "=") {
      this.advance();
      tokenType = TT_LTE;
    }
    return new Token(tokenType, null, posStart, this.pos);
  }

  makeGreaterThan() {
    const posStart = this.pos.copy();
    let tokenType = TT_GT;
    this.advance();

    if (this.curChar === "=") {
      this.advance();
      tokenType = TT_GTE;
    }
    return new Token(tokenType, null, posStart, this.pos);
  }
}

class Node {
  constructor(opt) {
    this.posStart = opt.posStart;
    this.posEnd = opt.posEnd;
  }
}

// 数字节点
class NumberNode extends Node {
  constructor(token) {
    super({
      posStart: token.posStart,
      posEnd: token.posEnd,
    });
    this.token = token;
  }

  toString() {
    return this.token.toString();
  }
}

// 使用变量
class VarAccessNode extends Node {
  constructor(varNameToken) {
    super({
      posStart: varNameToken.posStart,
      posEnd: varNameToken.posEnd,
    });
    this.varNameToken = varNameToken;
  }
}

// 分配变量
class VarAssignNode extends Node {
  constructor(varNameToken, valueNode) {
    super({
      posStart: varNameToken.posStart,
      posEnd: valueNode.posEnd,
    });
    this.varNameToken = varNameToken;
    this.valueNode = valueNode;
  }
}

class UnaryOpNode extends Node {
  constructor(token, node) {
    super({
      posStart: token.posStart,
      posEnd: node.posEnd,
    });
    this.token = token;
    this.node = node;
  }

  toString() {
    return `${this.token.toString()}, ${this.node.toString()}`;
  }
}

class IfNode extends Node {
  constructor(cases, elseCase) {
    super({
      posStart: ases[0][0].posStart,
      posEnd: elseCase ? elseCase.posEnd : cases[cases.length - 1][0].posEnd,
    });
    this.cases = cases;
    this.elseCase = elseCase;
  }
}

class ForNode extends Node {
  constructor(varNameToken, startNode, endNode, stepNode, bodyNode) {
    super({
      posStart: varNameToken.posStart,
      posEnd: bodyNode.posEnd,
    });
    this.varNameToken = varNameToken;
    this.startNode = startNode;
    this.endNode = endNode;
    this.stepNode = stepNode;
    this.bodyNode = bodyNode;
  }
}

// 定义函数
class FuncDefNode extends Node {
  constructor(varNameToken, argNameTokens, bodyNode) {
    super({
      posStart: varNameToken
        ? varNameToken.posStart
        : argNameTokens.length
        ? argNameTokens[0].posStart
        : bodyNode.posStart,
      posEnd: bodyNode.posEnd,
    });
    this.varNameToken = varNameToken;
    this.argNameTokens = argNameTokens;
    this.bodyNode = bodyNode;
  }
}

// 调用函数
class CallNode extends Node {
  constructor(nodeToCall, argNodes) {
    super({
      posStart: nodeToCall.posStart,
      posEnd: argNodes.length
        ? argNodes[argNodes.length - 1].posEnd
        : nodeToCall.posEnd,
    });
    this.nodeToCall = nodeToCall;
    this.argNodes = argNodes;
  }
}

class WhileNode extends Node {
  constructor(conditionNode, bodyNode) {
    super({
      posStart: conditionNode.posStart,
      posEnd: bodyNode.posEnd,
    });
    this.conditionNode = conditionNode;
    this.bodyNode = bodyNode;
  }
}

// 运算节点
class BinOpNode extends Node {
  constructor(leftNode, token, rightNode) {
    super({
      posStart: leftNode.posStart,
      posEnd: rightNode.posEnd,
    });
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
    this.advanceCount = 0;
  }

  hasError() {
    return !!this.error;
  }

  registerAdvancement() {
    this.advanceCount++;
  }

  register(res) {
    this.advanceCount += res.advanceCount;
    if (res.hasError()) this.error = res.error;
    return res.node;
  }

  success(node) {
    this.node = node;
    return this;
  }

  failure(error) {
    if (!this.hasError() || this.advanceCount === 0) {
      this.error = error;
    }
    return this;
  }
}

/**
 * ## 解析器
 * 解析tokens生成node AST，并进行语法检查
 */
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
    if (!res.hasError() && this.curToken.type !== TT_EOF) {
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

  ifExpr() {
    const res = new ParseRusult();
    const cases = [];
    let elseCase = null;

    if (!this.curToken.matches(TT_KEYWORD, "if")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'if'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const condition = res.register(this.expr());
    if (res.hasError()) return res;

    if (!this.curToken.matches(TT_KEYWORD, "then")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'then'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const _expr = res.register(this.expr());
    if (res.hasError()) return res;
    cases.push([condition, _expr]);

    while (this.curToken.matches(TT_KEYWORD, "elif")) {
      res.registerAdvancement();
      this.advance();

      const condition = res.register(this.expr());
      if (res.hasError()) return res;

      if (!this.curToken.matches(TT_KEYWORD, "then")) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            `Expected 'then'`
          )
        );
      }

      res.registerAdvancement();
      this.advance();

      const _expr = res.register(this.expr());
      if (res.hasError()) return res;
      cases.push([condition, _expr]);
    }

    if (this.curToken.matches(TT_KEYWORD, "else")) {
      res.registerAdvancement();
      this.advance();

      elseCase = res.register(this.expr());
      if (res.hasError()) return res;
    }

    return res.success(new IfNode(cases, elseCase));
  }

  forExpr() {
    const res = new ParseRusult();

    if (!this.curToken.matches(TT_KEYWORD, "for")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'for'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    if (this.curToken.type !== TT_IDENTIFIER) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected identifier`
        )
      );
    }

    const varNameToken = this.curToken;
    res.registerAdvancement();
    this.advance();

    if (this.curToken.type !== TT_EQ) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected '='`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const startNode = res.register(this.expr());
    if (res.hasError()) return res;

    if (!this.curToken.matches(TT_KEYWORD, "to")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'to'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const endNode = res.register(this.expr());
    if (res.hasError()) return res;

    let stepNode = null;
    if (this.curToken.matches(TT_KEYWORD, "step")) {
      res.registerAdvancement();
      this.advance();
      stepNode = res.register(this.expr());
      if (res.hasError()) return res;
    }

    if (!this.curToken.matches(TT_KEYWORD, "then")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'then'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const bodyNode = res.register(this.expr());
    if (res.hasError()) return res;

    return res.success(
      new ForNode(varNameToken, startNode, endNode, stepNode, bodyNode)
    );
  }

  whileExpr() {
    const res = new ParseRusult();
    if (!this.curToken.matches(TT_KEYWORD, "while")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'while'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const conditionNode = res.register(this.expr());
    if (res.hasError()) return res;

    if (!this.curToken.matches(TT_KEYWORD, "then")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'then'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const bodyNode = res.register(this.expr());
    if (res.hasError()) return res;

    return res.success(new WhileNode(conditionNode, bodyNode));
  }

  funDef() {
    const res = new ParseRusult();
    if (!this.curToken.matches(TT_KEYWORD, "fun")) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'fun'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    let varNameToken = null;
    if (this.curToken.type === TT_IDENTIFIER) {
      varNameToken = this.curToken;
      res.registerAdvancement();
      this.advance();
      if (this.curToken.type !== TT_LPAREN) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            `Expected '('`
          )
        );
      }
    } else {
      if (this.curToken.type !== TT_LPAREN) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            `Expected identifier or '('`
          )
        );
      }
    }

    res.registerAdvancement();
    this.advance();

    const argNameTokens = [];
    if (this.curToken.type === TT_IDENTIFIER) {
      argNameTokens.push(this.curToken);
      res.registerAdvancement();
      this.advance();

      while (this.curToken.type === TT_COMMA) {
        res.registerAdvancement();
        this.advance();

        if (this.curToken.type !== TT_IDENTIFIER) {
          return res.failure(
            new InvalidSyntaxError(
              this.curToken.posStart,
              this.curToken.posEnd,
              `Expected identifier`
            )
          );
        }
        argNameTokens.push(this.curToken);
        res.registerAdvancement();
        this.advance();
      }

      if (this.curToken.type !== TT_RPAREN) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            `Expected ',' or ')'`
          )
        );
      }
    } else {
      if (this.curToken.type !== TT_RPAREN) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            `Expected identifier or ')'`
          )
        );
      }
    }

    res.registerAdvancement();
    this.advance();

    if (this.curToken.type !== TT_ARROW) {
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected '->'`
        )
      );
    }

    res.registerAdvancement();
    this.advance();

    const nodeToReturn = res.register(this.expr());
    if (res.hasError()) return res;

    return res.success(
      new FuncDefNode(varNameToken, argNameTokens, nodeToReturn)
    );
  }

  call() {
    const res = new ParseRusult();
    const _atom = res.register(this.atom());
    if (res.hasError()) return res;

    if (this.curToken.type === TT_LPAREN) {
      res.registerAdvancement();
      this.advance();

      const argNodes = [];
      if (this.curToken.type === TT_RPAREN) {
        res.registerAdvancement();
        this.advance();
      } else {
        argNodes.push(res.register(this.expr()));
        if (res.hasError()) {
          return res.failure(
            new InvalidSyntaxError(
              this.curToken.posStart,
              this.curToken.posEnd,
              `Expected ')', 'var', 'if', 'for', 'while', 'fun', int, float, identifier, '+', '-', '(' or '!'`
            )
          );
        }

        while (this.curToken.type === TT_COMMA) {
          res.registerAdvancement();
          this.advance();

          argNodes.push(res.register(this.expr()));
          if (res.hasError()) {
            return res.failure(
              new InvalidSyntaxError(
                this.curToken.posStart,
                this.curToken.posEnd,
                `Expected ',' or ')'`
              )
            );
          }
          res.registerAdvancement();
          this.advance();
        }
      }

      return res.success(new CallNode(_atom, argNodes));
    }

    return res.success(_atom);
  }

  atom() {
    const res = new ParseRusult();
    const token = this.curToken;

    if (token.type === TT_INT || token.type === TT_FLOAT) {
      // 1 or 1.2
      res.registerAdvancement();
      this.advance();
      return res.success(new NumberNode(token));
    } else if (token.type === TT_IDENTIFIER) {
      // a + b
      res.registerAdvancement();
      this.advance();
      return res.success(new VarAccessNode(token));
    } else if (token.type === TT_LPAREN) {
      // (1)
      res.registerAdvancement();
      this.advance();
      const _expr = res.register(this.expr());
      if (res.hasError()) return res;
      if (this.curToken.type === TT_RPAREN) {
        res.registerAdvancement();
        this.advance();
        return res.success(_expr);
      } else {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            `Expected ')'`
          )
        );
      }
    } else if (token.matches(TT_KEYWORD, "if")) {
      const _ifExpr = res.register(this.ifExpr());
      if (res.hasError()) return res;
      return res.success(_ifExpr);
    } else if (token.matches(TT_KEYWORD, "for")) {
      const _forExpr = res.register(this.forExpr());
      if (res.hasError()) return res;
      return res.success(_forExpr);
    } else if (token.matches(TT_KEYWORD, "while")) {
      const _whileExpr = res.register(this.whileExpr());
      if (res.hasError()) return res;
      return res.success(_whileExpr);
    } else if (token.matches(TT_KEYWORD, "fun")) {
      const _funDef = res.register(this.funDef());
      if (res.hasError()) return res;
      return res.success(_funDef);
    } else {
      return res.failure(
        new InvalidSyntaxError(
          token.posStart,
          token.posEnd,
          `Expected int, float, identifier, '+', '-', '(', 'if', 'for', 'while', 'fun'`
        )
      );
    }
  }

  power() {
    return this.binOp(this.call.bind(this), [TT_POW], this.factor.bind(this));
  }

  factor() {
    const res = new ParseRusult();
    const token = this.curToken;

    if (token.type === TT_PLUS || token.type === TT_MINUS) {
      // +1 or -1
      res.registerAdvancement();
      this.advance();
      const _factor = res.register(this.factor());
      if (res.hasError()) return res;
      else return res.success(new UnaryOpNode(token, _factor));
    }

    return this.power();
  }

  term() {
    return this.binOp(this.factor.bind(this), [TT_MUL, TT_DIV]);
  }

  arithExpr() {
    return this.binOp(this.term.bind(this), [TT_PLUS, TT_MINUS]);
  }

  compExpr() {
    const res = new ParseRusult();
    let node;
    if (this.curToken.matches(TT_KEYWORD, "!")) {
      const opToken = this.curToken;
      res.registerAdvancement();
      this.advance();
      node = res.register(this.compExpr());
      if (res.hasError()) return res;
      return res.success(new UnaryOpNode(opToken, node));
    }

    node = res.register(
      this.binOp(this.arithExpr.bind(this), [
        TT_EE,
        TT_NE,
        TT_LT,
        TT_GT,
        TT_LTE,
        TT_GTE,
      ])
    );

    if (res.hasError())
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected int, float, identifier, '+', '-', '(', '!'`
        )
      );

    return res.success(node);
  }

  expr() {
    const res = new ParseRusult();
    if (this.curToken.matches(TT_KEYWORD, "var")) {
      // var a = 1
      res.registerAdvancement();
      this.advance();
      if (this.curToken.type !== TT_IDENTIFIER) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            "Expected identifier"
          )
        );
      }

      const varName = this.curToken;
      res.registerAdvancement();
      this.advance();

      if (this.curToken.type !== TT_EQ) {
        return res.failure(
          new InvalidSyntaxError(
            this.curToken.posStart,
            this.curToken.posEnd,
            "Expected '='"
          )
        );
      }

      res.registerAdvancement();
      this.advance();
      const valueNode = res.register(this.expr()); // value
      if (res.hasError()) return res;
      return res.success(new VarAssignNode(varName, valueNode));
    }

    const node = res.register(
      this.binOp(this.compExpr.bind(this), [
        `${TT_KEYWORD}:&&`,
        `${TT_KEYWORD}:||`,
      ])
    );
    if (res.hasError())
      return res.failure(
        new InvalidSyntaxError(
          this.curToken.posStart,
          this.curToken.posEnd,
          `Expected 'var', 'if', 'for', 'while', 'fun', int, float, identifier, '+', '-' or '('`
        )
      );
    return res.success(node);
  }

  binOp(handle_a, ops, handle_b = null) {
    if (!handle_b) handle_b = handle_a;

    const res = new ParseRusult();
    let leftNode = res.register(handle_a()); // number节点
    if (res.hasError()) return res;

    while (
      ops.includes(this.curToken.type) ||
      ops.includes(`${this.curToken.type}:${this.curToken.value}`)
    ) {
      const token = this.curToken;
      res.registerAdvancement();
      this.advance();
      const rightNode = res.register(handle_b()); // number节点
      if (res.hasError()) return res;

      // 递归
      leftNode = new BinOpNode(leftNode, token, rightNode);
    }
    return res.success(leftNode);
  }
}

class RTResult {
  constructor() {
    this.error = null;
    this.value = null;
  }

  hasError() {
    return !!this.error;
  }

  register(res) {
    if (res instanceof RTResult) {
      if (res.hasError()) this.error = res.error;
      return res.value;
    } else {
      return res;
    }
  }

  success(value) {
    this.value = value;
    return this;
  }

  failure(error) {
    this.error = error;
    return this;
  }
}

class Value {
  constructor() {
    this.setPos();
    this.setContext();
  }

  setPos(posStart, posEnd) {
    this.posStart = posStart;
    this.posEnd = posEnd;
    return this;
  }

  setContext(context) {
    this.context = context;
    return this;
  }

  illegalOperation(other = null) {
    if (!other) other = this;
    return new RTError(
      this.posStart,
      this.posEnd,
      `Illegal operation`,
      this.context
    );
  }

  add(other) {
    return this.illegalOperation(other);
  }

  sub(other) {
    return this.illegalOperation(other);
  }

  mul(other) {
    return this.illegalOperation(other);
  }
  div(other) {
    return this.illegalOperation(other);
  }

  pow(other) {
    return this.illegalOperation(other);
  }

  cmpEq(other) {
    return this.illegalOperation(other);
  }

  cmpNe(other) {
    return this.illegalOperation(other);
  }

  cmpLt(other) {
    return this.illegalOperation(other);
  }

  cmpGt(other) {
    return this.illegalOperation(other);
  }

  cmpLte(other) {
    return this.illegalOperation(other);
  }

  cmpGte(other) {
    return this.illegalOperation(other);
  }

  and(other) {
    return this.illegalOperation(other);
  }

  or(other) {
    return this.illegalOperation(other);
  }

  not() {
    return this.illegalOperation(other);
  }

  execute(args) {
    return new RTResult().failure(this.illegalOperation());
  }

  copy() {
    throw "No copy method defined";
  }

  isTrue() {
    return false;
  }
}

class NumberValue extends Value {
  constructor(value) {
    super();
    this.value = value;
  }

  add(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value + other.value).setContext(this.context);
    } else {
      this.illegalOperation(other);
    }
  }

  sub(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value - other.value).setContext(this.context);
    } else {
      this.illegalOperation(other);
    }
  }
  mul(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value * other.value).setContext(this.context);
    } else {
      this.illegalOperation(other);
    }
  }
  div(other) {
    if (other instanceof NumberValue) {
      if (other.value === 0) {
        throw new RTError(
          other.posStart,
          other.posEnd,
          "Division by zero",
          this.context
        );
      }
      return new NumberValue(this.value / other.value).setContext(this.context);
    } else {
      this.illegalOperation(other);
    }
  }
  pow(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value ** other.value).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  cmpEq(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value === other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  cmpNe(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value !== other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  cmpLt(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value < other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  cmpGt(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value > other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  cmpLte(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value <= other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  cmpGte(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value >= other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  and(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value && other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  or(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value || other.value)).setContext(
        this.context
      );
    } else {
      this.illegalOperation(other);
    }
  }

  not() {
    return new NumberValue(Number(!this.value)).setContext(this.context);
  }

  isTrue() {
    return Boolean(this.value);
  }

  copy() {
    const result = new NumberValue(this.value);
    result.setPos(this.posStart, this.posEnd);
    result.setContext(this.context);
    return result;
  }

  toString() {
    return this.value.toString();
  }
}

class FunctionValue extends Value {
  constructor(name, bodyNode, argNames) {
    super();
    this.name = name || "<anonymous>";
    this.bodyNode = bodyNode;
    this.argNames = argNames;
  }

  exceute(args) {
    const res = new RTResult();

    // 每次函数运行都是新的上下文
    const interpreter = new Interpreter();
    const newContext = new Context(this.name, this.context, this.posStart);
    newContext.symbolTable = new SymbolTable(this.context.symbolTable);

    if (args.length > this.argNames.length) {
      return res.failure(
        new RTError(
          this.posStart,
          this.posEnd,
          `${args.length} - ${this.argNames.length} too many args passed into '${this.name}'`,
          self.context
        )
      );
    }

    if (args.length < this.argNames.length) {
      return res.failure(
        new RTError(
          this.posStart,
          this.posEnd,
          `${args.length} - ${this.argNames.length} too few args passed into '${this.name}'`,
          self.context
        )
      );
    }

    for (let i = 0; i < args.length; i++) {
      const argName = this.argNames[i];
      const argValue = args[i];
      argValue.setContext(newContext);
      newContext.symbolTable.set(argName, argValue);
    }

    const value = res.register(interpreter.visit(this.bodyNode, newContext));
    if (res.hasError()) return res;
    return res.success(value);
  }

  copy() {
    const result = new FunctionValue(this.name, this.bodyNode, this.argNames);
    result.setContext(this.context);
    result.setPos(this.posStart, this.posEnd);
    return result;
  }

  toString() {
    return `ƒ ${this.name}(${this.argNames.join(",")}){}`;
  }
}

// 保存当前程序的上下文
class Context {
  constructor(contextName, parent, parentEntryPos) {
    this.contextName = contextName;
    this.parent = parent;
    this.parentEntryPos = parentEntryPos;
    this.symbolTable = null;
  }
}

// 储存所有变量
class SymbolTable {
  constructor(parent = null) {
    this.symbols = {};
    this.parent = parent; // parent context symbol table
  }

  get(name) {
    const value = this.symbols[name] ?? null;
    if (value === null && this.parent) {
      return this.parent.get(name);
    }
    return value;
  }

  set(name, value) {
    this.symbols[name] = value;
  }

  del(name) {
    delete this.symbols[name];
  }
}

/**
 * 解释器
 * 解释Parser输出的AST
 */
class Interpreter {
  constructor() {}

  // 解析node AST
  visit(node, context) {
    if (node instanceof NumberNode) {
      return this.visitNumberNode(node, context);
    } else if (node instanceof BinOpNode) {
      return this.visitBinOpNode(node, context);
    } else if (node instanceof UnaryOpNode) {
      return this.visitUnaryOpNode(node, context);
    } else if (node instanceof VarAccessNode) {
      return this.visitVarAccessNode(node, context);
    } else if (node instanceof VarAssignNode) {
      return this.visitVarAssignNode(node, context);
    } else if (node instanceof IfNode) {
      return this.visitIfNode(node, context);
    } else if (node instanceof ForNode) {
      return this.visitForNode(node, context);
    } else if (node instanceof WhileNode) {
      return this.visitWhileNode(node, context);
    } else if (node instanceof FuncDefNode) {
      return this.visitFuncDefNode(node, context);
    } else if (node instanceof CallNode) {
      return this.visitCallNode(node, context);
    } else {
      // error
    }
  }

  // 函数定义
  visitFuncDefNode(node, context) {
    const res = new RTResult();
    const funcName = node.varNameToken ? node.varNameToken.value : null;
    const bodyNode = node.bodyNode;
    const argNames = node.argNameTokens.map((t) => t.value);
    const funcValue = new FunctionValue(funcName, bodyNode, argNames);
    funcValue.setContext(context);
    funcValue.setPos(node.posStart, node.posEnd);

    if (node.varNameToken) {
      context.symbolTable.set(funcName, funcValue);
    }

    return res.success(funcValue);
  }

  // 调用函数
  visitCallNode(node, context) {
    const res = new RTResult();
    const args = [];
    let valueToCall = res.register(this.visit(node.nodeToCall, context));
    if (res.hasError()) return res;
    valueToCall = valueToCall.copy().setPos(node.posStart, node.posEnd);

    for (const argNode of node.argNodes) {
      args.push(res.register(this.visit(argNode, context)));
      if (res.hasError()) return res;
    }

    const returnValue = res.register(valueToCall.exceute(args));
    if (res.hasError()) return res;
    return res.success(returnValue);
  }

  visitWhileNode(node, context) {
    const res = new RTResult();
    while (true) {
      const condition = res.register(this.visit(node.conditionNode, context));
      if (res.hasError()) return res;
      if (!condition.isTrue()) break;

      res.register(this.visit(node.bodyNode, context));
      if (res.hasError()) return res;
    }

    return res.success(null);
  }

  visitForNode(node, context) {
    const res = new RTResult();
    const startValue = res.register(this.visit(node.startNode, context));
    if (res.hasError()) return res;

    const endValue = res.register(this.visit(node.endNode, context));
    if (res.hasError()) return res;

    let stepValue = new NumberValue(1);
    if (node.stepNode) {
      stepValue = res.register(this.visit(node.stepNode, context));
      if (res.hasError()) return res;
    }

    let i = startValue.value;
    let condition = null;
    if (stepValue.value >= 0) {
      condition = () => i < endValue.value;
    } else {
      condition = () => i > endValue.value;
    }

    while (condition()) {
      context.symbolTable.set(node.varNameToken.value, new NumberValue(i));
      i += stepValue.value;

      res.register(this.visit(node.bodyNode, context));
      if (res.hasError()) return res;
    }

    return res.success(null);
  }

  visitIfNode(node, context) {
    const res = new RTResult();

    for (const [condition, _expr] of node.cases) {
      const conditionValue = res.register(this.visit(condition, context));
      if (res.hasError()) return res;

      if (conditionValue.isTrue()) {
        const exprValue = res.register(this.visit(_expr, context));
        if (res.hasError()) return res;
        return res.success(exprValue);
      }
    }

    if (node.elseCase) {
      const elseValue = res.register(this.visit(node.elseCase, context));
      if (res.hasError()) return res;
      return res.success(elseValue);
    }

    return res.success(null);
  }

  // 访问变量
  visitVarAccessNode(node, context) {
    const res = new RTResult();
    const varName = node.varNameToken.value;
    let value = context.symbolTable.get(varName);
    if (value === null) {
      return res.failure(
        new RTError(
          node.posStart,
          node.posEnd,
          `"${varName}" is not defined`,
          context
        )
      );
    }

    // 修复错误消息定位
    // var a = 0
    // 10 / a
    value = value.copy().setPos(node.posStart, node.posEnd);
    return res.success(value);
  }

  // 定义变量
  visitVarAssignNode(node, context) {
    const res = new RTResult();
    const varName = node.varNameToken.value;
    const value = res.register(this.visit(node.valueNode, context)); // 获取value
    if (res.hasError()) return res;
    context.symbolTable.set(varName, value);
    return res.success(value);
  }

  visitNumberNode(node, context) {
    return new RTResult().success(
      new NumberValue(node.token.value)
        .setContext(context)
        .setPos(node.posStart, node.posEnd)
    );
  }
  visitBinOpNode(node, context) {
    const res = new RTResult();
    const left = res.register(this.visit(node.leftNode, context));
    if (res.hasError()) return res;

    const right = res.register(this.visit(node.rightNode, context));
    if (res.hasError()) return res;

    let result;
    switch (node.token.type) {
      case TT_PLUS:
        result = left.add(right);
        break;
      case TT_MINUS:
        result = left.sub(right);
        break;
      case TT_MUL:
        result = left.mul(right);
        break;
      case TT_DIV:
        try {
          result = left.div(right);
        } catch (error) {
          res.failure(error);
          return res;
        }
        break;
      case TT_POW:
        result = left.pow(right);
        break;
      case TT_EE:
        result = left.cmpEq(right);
        break;
      case TT_NE:
        result = left.cmpNe(right);
        break;
      case TT_LT:
        result = left.cmpLt(right);
        break;
      case TT_GT:
        result = left.cmpGt(right);
        break;
      case TT_LTE:
        result = left.cmpLte(right);
        break;
      case TT_GTE:
        result = left.cmpGte(right);
        break;
      case TT_KEYWORD:
        if (node.token.matches(TT_KEYWORD, "&&")) {
          result = left.and(right);
        } else if (node.token.matches(TT_KEYWORD, "||")) {
          result = left.or(right);
        }
        break;
    }
    return res.success(result.setPos(node.posStart, node.posEnd));
  }
  visitUnaryOpNode(node, context) {
    const res = new RTResult();
    let numberValue = res.register(this.visit(node.node, context));
    if (res.hasError()) return res;

    if (node.token.type == TT_MINUS) {
      numberValue = numberValue.mul(new NumberValue(-1));
    } else if (node.token.matches(TT_KEYWORD, "!")) {
      numberValue = numberValue.not();
    }

    return res.success(numberValue.setPos(node.posStart, node.posEnd));
  }
}

const globalSymbolTable = new SymbolTable();
globalSymbolTable.set("null", new NumberValue(0));
globalSymbolTable.set("true", new NumberValue(1));
globalSymbolTable.set("false", new NumberValue(0));

module.exports = function run(fileName, text) {
  // Generate tokens
  const lexer = new Lexer(fileName, text);
  const tokens = lexer.makeTokens();
  // console.log(tokens.map((it) => it.toString()));

  // generate AST
  const parser = new Parser(tokens);
  const res = parser.parse();
  if (res.hasError()) throw res.error;

  // run progra
  const interpreter = new Interpreter();
  const context = new Context("<program>");
  context.symbolTable = globalSymbolTable;
  const rtRes = interpreter.visit(res.node, context);

  if (rtRes.hasError()) throw rtRes.error;
  return rtRes.value;
};

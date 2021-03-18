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
const TT_EOF = "EOF";
const KEYWORDS = ["var", "&&", "||", "!", "if", "then", "elif", "else"];

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
 * ## 词法分析器
 * 只做词法分析和检测错误的符号
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
          tokens.push(this.makeMultiplication());
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

  makeMultiplication() {
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

class Node {}

// 数字节点
class NumberNode extends Node {
  constructor(token) {
    super();
    this.token = token;
    this.posStart = token.posStart;
    this.posEnd = token.posEnd;
  }

  toString() {
    return this.token.toString();
  }
}
class VarAccessNode extends Node {
  constructor(varNameToken) {
    super();
    this.varNameToken = varNameToken;
    this.posStart = varNameToken.posStart;
    this.posEnd = varNameToken.posEnd;
  }
}
class VarAssignNode extends Node {
  constructor(varNameToken, valueNode) {
    super();
    this.varNameToken = varNameToken;
    this.valueNode = valueNode;
    this.posStart = varNameToken.posStart;
    this.posEnd = valueNode.posEnd;
  }
}

class UnaryOpNode extends Node {
  constructor(token, node) {
    super();
    this.token = token;
    this.node = node;

    this.posStart = token.posStart;
    this.posEnd = node.posEnd;
  }

  toString() {
    return `${this.token.toString()}, ${this.node.toString()}`;
  }
}

class IfNode extends Node {
  constructor(cases, elseCase) {
    super();
    this.cases = cases;
    this.elseCase = elseCase;
    this.posStart = cases[0][0].posStart;
    this.posEnd = elseCase
      ? elseCase.posEnd
      : cases[cases.length - 1][0].posEnd;
  }
}

// 运算节点
class BinOpNode extends Node {
  constructor(leftNode, token, rightNode) {
    super();
    this.leftNode = leftNode;
    this.token = token;
    this.rightNode = rightNode;

    this.posStart = leftNode.posStart;
    this.posEnd = rightNode.posEnd;
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
 * 解析Lexer，并进行语法检查
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
    } else {
      return res.failure(
        new InvalidSyntaxError(
          token.posStart,
          token.posEnd,
          `Expected int, float, identifier, '+', '-' or '('`
        )
      );
    }
  }

  power() {
    return this.binOp(this.atom.bind(this), [TT_POW], this.factor.bind(this));
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
          `Expected 'var', int, float, identifier, '+', '-' or '('`
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

class NumberValue {
  constructor(value) {
    this.value = value;
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

  add(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value + other.value).setContext(this.context);
    }
  }

  sub(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value - other.value).setContext(this.context);
    }
  }
  mul(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value * other.value).setContext(this.context);
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
    }
  }
  pow(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(this.value ** other.value).setContext(
        this.context
      );
    }
  }

  cmpEq(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value === other.value)).setContext(
        this.context
      );
    }
  }

  cmpNe(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value !== other.value)).setContext(
        this.context
      );
    }
  }

  cmpLt(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value < other.value)).setContext(
        this.context
      );
    }
  }

  cmpGt(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value > other.value)).setContext(
        this.context
      );
    }
  }

  cmpLte(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value <= other.value)).setContext(
        this.context
      );
    }
  }

  cmpGte(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value >= other.value)).setContext(
        this.context
      );
    }
  }

  and(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value && other.value)).setContext(
        this.context
      );
    }
  }

  or(other) {
    if (other instanceof NumberValue) {
      return new NumberValue(Number(this.value || other.value)).setContext(
        this.context
      );
    }
  }

  not() {
    return new NumberValue(Number(!this.value)).setContext(this.context);
  }

  isTrue() {
    return Boolean(this.value);
  }

  toString() {
    return this.value.toString();
  }

  copy() {
    const result = new NumberValue(this.value);
    result.setPos(this.posStart, this.posEnd);
    result.setContext(this.context);
    return result;
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
  constructor() {
    this.symbols = {};
    this.parent = null; // parent context symbol table
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

// 解释器,解释Parser
class Interpreter {
  constructor() {}

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
    } else {
      // error
    }
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

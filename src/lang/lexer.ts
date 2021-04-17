import { isSpace, isDigit, isAlpha, findGroupEnd } from './utils';
import { Token, TokenType, REVERSED_KEYWORDS } from './tokens';


export class Lexer {
  text: string;
  pos: number;
  _isID = false; // solve dict pairs setup and prop value setup, cause number|string: value and id: value
  current_char?: string;

  constructor(text: string) {
    this.text = text;
    this.pos = 0;
    this.current_char = this.text[this.pos];
  }

  error(msg = 'Invalid charater'): never {
    throw Error(msg);
  }

  advance(step = 1): void {
    this.pos += step;
    this.current_char = this.pos > this.text.length - 1 ? undefined : this.text[this.pos];
  }

  peek(): string | undefined {
    if (this.pos + 1 < this.text.length) {
      return this.text[this.pos + 1];
    }
  }

  skip_whitespace(): void {
    while (this.current_char !== undefined && isSpace(this.current_char)) {
      this.advance();
    }
  }

  string(char: '\'' | '"' | '`'): Token {
    let result = '';
    let prev = '';
    while(this.current_char !== undefined && (this.current_char !== char || prev === '\\')) {
      result += this.current_char;
      prev = this.current_char;
      this.advance();
    }
    if (result) this.advance(); // right quote
    if (char === '`') {
      return new Token(TokenType.TEMPLATE, result);
    }
    this._isID = false;
    return new Token(TokenType.STRING, result);
  }

  keyword(): Token {
    // handle reversed keywords
    let result = '';
    while (this.current_char !== undefined && isAlpha(this.current_char)) {
      result += this.current_char;
      this.advance();
    }
    if (result in REVERSED_KEYWORDS) {
      const token = REVERSED_KEYWORDS[result];
      if (result === 'js') {
        this.skip_whitespace();
        this.advance();
        const end = findGroupEnd(this.text, this.pos);
        token.value = this.text.slice(this.pos, end);
        this.pos = end + 1;
        this.current_char = this.text[end + 1];
      }
      return token;
    }
    this.error();
  }

  numeric(): Token {
    let result = '';
    while (this.current_char !== undefined && isDigit(this.current_char)) {
      // int
      result += this.current_char;
      this.advance();
    }
    if (this.current_char === '.') {
      // float
      result += '.';
      this.advance();
      while (this.current_char !== undefined && isDigit(this.current_char)) {
        result += this.current_char;
        this.advance();
      }
    }
    // size
    const next = this.text.slice(this.pos,);
    if (next.startsWith('rem')) {
      this.advance(3);
      return new Token(TokenType.REM, +result);
    }
    if (next.startsWith('px')) {
      this.advance(2);
      return new Token(TokenType.PIXEL, +result);
    }
    if (next.startsWith('em')) {
      this.advance(2);
      return new Token(TokenType.EM, +result);
    }
    if (next.startsWith('%')) {
      this.advance();
      return new Token(TokenType.PERCENTAGE, +result);
    }
    if (next.startsWith('s')) {
      this.advance();
      return new Token(TokenType.SECOND, +result);
    }
    if (next.startsWith('deg')) {
      this.advance(3);
      return new Token(TokenType.DEGREE, +result);
    }
    this._isID = false;
    return new Token(TokenType.NUMBER, +result);
  }

  color(): Token {
    let result = '';
    while (this.current_char !== undefined && isAlpha(this.current_char)) {
      result += this.current_char;
      this.advance();
    }
    return new Token(TokenType.COLOR, '#' + result);
  }

  id(): Token {
    let result = '';
    while (this.current_char !== undefined && isAlpha(this.current_char)) {
      result += this.current_char;
      this.advance();
    }
    this._isID = true;
    return new Token(TokenType.ID, result);
  }

  property(): Token {
    let result = '';
    let prev = '';
    while (this.current_char !== undefined && (this.current_char !== ';' || prev === '\\')) {
      result += this.current_char;
      prev = this.current_char;
      this.advance();
    }
    return new Token(/\${.*}/.test(result)? TokenType.TEMPLATE : TokenType.STRING, result);
  }

  unknown(): Token {
    let result = '';
    let prev = '';
    while (this.current_char !== undefined && (this.current_char !== '{' || prev === '\\')) {
      result += this.current_char;
      prev = this.current_char;
      this.advance();
    }
    this._isID = true;
    return new Token(TokenType.ID, result.trimEnd());
  }

  peek_next_token(count = 1): Token {
    const pos = this.pos;
    const char = this.current_char;
    let token = this.get_next_token();
    while (count > 1) {
      token = this.get_next_token();
      count--;
    }
    this.pos = pos;
    this.current_char = char;
    return token;
  }

  get_next_token(): Token {
    while (this.current_char !== undefined) {
      if (isSpace(this.current_char)) {
        this.skip_whitespace();
        continue;
      }

      if (isDigit(this.current_char)) {
        return this.numeric();
      }

      if (isAlpha(this.current_char)) {
        return this.id();
      }

      switch (this.current_char) {
      case '@':
        this.advance();
        return this.keyword();
      case '$':
        this.advance();
        return new Token(TokenType.DOLLAR, '$');
      case '=':
        this.advance();
        return new Token(TokenType.ASSIGN, '=');
      case ':':
        this.advance();
        if (!this._isID) return new Token(TokenType.COLON, ':'); // dict pairs assign
        this.skip_whitespace(); // prop assign
        return this.property();
      case ';':
        this.advance();
        return new Token(TokenType.SEMI, ';');
      case '\'':
        this.advance();
        return this.string('\'');
      case '"':
        this.advance();
        return this.string('"');
      case '`':
        this.advance();
        return this.string('`');
      case '#':
        this.advance();
        return this.color();
      case '{':
        this.advance();
        return new Token(TokenType.LCURLY, '{');
      case '}':
        this.advance();
        return new Token(TokenType.RCURLY, '}');
      case '+':
        this.advance();
        return new Token(TokenType.PLUS, '+');
      case '-':
        this.advance();
        return new Token(TokenType.MINUS, '-');
      case '*':
        this.advance();
        return new Token(TokenType.MUL, '*');
      case '/':
        this.advance();
        return new Token(TokenType.DIV, '/');
      case '(':
        this.advance();
        return new Token(TokenType.LPAREN, '(');
      case ')':
        this.advance();
        return new Token(TokenType.RPAREN, ')');
      case '[':
        this.advance();
        return new Token(TokenType.LSQUARE, '[');
      case ']':
        this.advance();
        return new Token(TokenType.RSQUARE, ']');
      case ',':
        this.advance();
        return new Token(TokenType.COMMA, ',');
      default:
        return this.unknown();
      }
    }
    return new Token(TokenType.EOF, undefined);
  }
}

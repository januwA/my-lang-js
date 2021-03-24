export class Position {
  constructor(
    public index: number,
    public row: number,
    public col: number,
    public fileName: string,
    public fileText: string
  ) {}

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

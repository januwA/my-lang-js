module.exports = function stringsWithArrows(text, posStart, posEnd) {
  let result = "";
  const lines = text.split("\n");
  result += lines[posStart.row];
  result += "\n";
  result +=
    " ".padStart(posStart.col) + `^`.repeat(posEnd.col - posStart.col);
  return result;
};

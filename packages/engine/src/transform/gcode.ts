// Custom g-code / notes: PrusaSlicer stores these on one line with literal
// escape sequences ("\n", "\t", '\"'). Orca JSON wants real characters.
// Mirrors String::Escape::unbackslash used by the reference converter.

export function unbackslash(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c !== "\\") {
      out += c;
      continue;
    }
    const next = s[i + 1];
    switch (next) {
      case "n":
        out += "\n";
        i++;
        break;
      case "t":
        out += "\t";
        i++;
        break;
      case "r":
        out += "\r";
        i++;
        break;
      case '"':
        out += '"';
        i++;
        break;
      case "\\":
        out += "\\";
        i++;
        break;
      case undefined:
        out += "\\";
        break;
      default:
        out += next; // drop the backslash, keep the char
        i++;
    }
  }
  return out;
}

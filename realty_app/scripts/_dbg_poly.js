// quick test for parsing
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = "E:/github/application/realty/realty_app";
const csvText = readFileSync(resolve(ROOT, "static/seed/district_polygon.csv"), "utf8");
console.log("total chars:", csvText.length);
console.log("first 100 chars:", JSON.stringify(csvText.slice(0, 100)));

// Try parsing
import { parseCSV, rowsToObjects } from "../src/local/csv.ts";  // Wait, .ts won't work via node ESM directly. Let me read the parser file.
// Actually just check first row's polygons_json field
const lines = csvText.split("\r\n");
console.log("lines count:", lines.length);
console.log("first data line chars:", lines[1].length);
console.log("first data line ends with:", JSON.stringify(lines[1].slice(-50)));

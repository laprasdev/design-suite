// Prints the findings schema on one line, for the reviewer's --json-schema in .github/workflows/review.yml.
import { findingsSchema } from './findings.ts';

console.log(JSON.stringify(findingsSchema));

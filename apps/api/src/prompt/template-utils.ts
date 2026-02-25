const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

/**
 * Extract unique variable names from a prompt template.
 * Matches `{{variableName}}` patterns.
 */
export function extractTemplateVariables(content: string): string[] {
  const vars = new Set<string>();
  let match;
  while ((match = VARIABLE_PATTERN.exec(content)) !== null) {
    vars.add(match[1]);
  }
  return [...vars];
}

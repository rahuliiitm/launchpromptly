import { extractTemplateVariables } from './template-utils';

describe('extractTemplateVariables', () => {
  it('should extract simple variables', () => {
    const result = extractTemplateVariables('Hello {{name}}, welcome to {{company}}!');
    expect(result).toEqual(['name', 'company']);
  });

  it('should return empty array for no variables', () => {
    const result = extractTemplateVariables('Hello world, no variables here.');
    expect(result).toEqual([]);
  });

  it('should deduplicate repeated variables', () => {
    const result = extractTemplateVariables('{{name}} said hi to {{name}}');
    expect(result).toEqual(['name']);
  });

  it('should handle variables with underscores and numbers', () => {
    const result = extractTemplateVariables('{{user_name}} has {{item_count2}} items');
    expect(result).toEqual(['user_name', 'item_count2']);
  });

  it('should not match single braces or malformed patterns', () => {
    const result = extractTemplateVariables('{name} and {{ spaces }} and {{}}');
    expect(result).toEqual([]);
  });

  it('should handle multiline templates', () => {
    const template = `You are a {{role}} assistant.
Your task is to help with {{topic}}.
The user's name is {{user_name}}.`;
    const result = extractTemplateVariables(template);
    expect(result).toEqual(['role', 'topic', 'user_name']);
  });

  it('should handle adjacent variables', () => {
    const result = extractTemplateVariables('{{first}}{{last}}');
    expect(result).toEqual(['first', 'last']);
  });

  it('should handle empty string', () => {
    const result = extractTemplateVariables('');
    expect(result).toEqual([]);
  });
});

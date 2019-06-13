import {CompileErrorCase, ErrorReason} from '../report';

export function formatTextReport({entryConfigPath, command, items}: ErrorReason): string {
  return `# Compile Errors in ${entryConfigPath}:

${command}

${items
  .map(item => (item.level === 'info' ? item.description : formatErrorCase(item)))
  .join('\n\n')}`;
}

function formatErrorCase(item: CompileErrorCase): string {
  const {source, line, column, level, key, description, context} = item;
  return `${source}:${line}:${column} ${level.toUpperCase()} - [${key}] ${description}${
    context ? `\n${context}` : ''
  }`;
}

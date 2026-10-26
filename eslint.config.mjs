import js from '@eslint/js';
import ts from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default [
  { ignores: ['node_modules/**', 'dist/**', 'output/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: {console:'readonly',process:'readonly'} } },
  { files: ['**/*.ts','**/*.tsx'], plugins: { 'react-hooks': hooks }, rules: {
    'react-hooks/rules-of-hooks':'error', 'react-hooks/exhaustive-deps':'warn',
    'no-empty':['error',{allowEmptyCatch:true}],
    '@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]
  } }
];

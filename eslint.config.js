import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefreshPlugin from 'eslint-plugin-react-refresh';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      '*.config.ts',
      'wrangler.toml',
      'coverage/**',
      'playwright-report/**',
    ],
  },

  // Base JavaScript/TypeScript configuration
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // Global settings for all files
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript best practices
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-implicit-coercion': 'error',
    },
  },

  // React-specific configuration
  {
    files: ['src/client/**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
      'react-refresh': reactRefreshPlugin,
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React best practices
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // React Refresh (Vite HMR)
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // React-specific rules
      'react/prop-types': 'off', // TypeScript handles this
      'react/jsx-boolean-value': ['error', 'never'],
      'react/self-closing-comp': 'error',
      'react/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never' },
      ],

      // CRITICAL: useEffect/useLayoutEffect are PROHIBITED per CLAUDE.md
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              importNames: ['useEffect', 'useLayoutEffect'],
              message:
                'useEffect/useLayoutEffectは禁止です。代替手段を使用してください:\n' +
                '- データフェッチ: TanStack Query (useQuery, useMutation)\n' +
                '- 外部ストア同期: useSyncExternalStore\n' +
                '- イベントリスナー: カスタムフック + useSyncExternalStore\n' +
                '- DOM操作: ref + イベントハンドラ\n' +
                '詳細: CLAUDE.md参照',
            },
          ],
        },
      ],

      // Disable exhaustive-deps since we're not using useEffect
      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // Server-specific configuration (Hono)
  {
    files: ['src/server/**/*.ts'],
    rules: {
      // Hono handlers often have unused parameters (context)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_|^c$',
          varsIgnorePattern: '^_',
        },
      ],
      // Allow console in server-side code
      'no-console': 'off',
    },
  },

  // Test files configuration
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      // Allow any types in tests
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Allow non-null assertions in tests
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);

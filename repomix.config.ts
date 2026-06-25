import type { RepomixConfig } from "repomix";

const config: RepomixConfig = {
  output: {
    filePath: "repomix-outputs/repomix-output.xml",
    style: "xml",
    removeComments: false,
    removeEmptyLines: false,
    topFilesLength: 10,
    showLineNumbers: true,
  },
  ignore: {
    useGitignore: true,
    useDefaultPatterns: true,
    customPatterns: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "dist/**",
      "build/**",
      "repomix-output.*",
      "repomix-outputs/**",
      "messages/**",
      "**/*.test.ts",
      "supabase/migrations/**",
      "supabase/tests/**"
    ],
  },
};


export default config;

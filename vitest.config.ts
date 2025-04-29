import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    sequence: {
      concurrent: false
    },
    fileParallelism : false // disables worker threads, fully serial execution
  }
});
  

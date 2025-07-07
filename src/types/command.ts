export interface CommandModule {
  data: any;
  execute: (interaction: any) => Promise<void>;
} 
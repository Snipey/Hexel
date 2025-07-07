export interface InteractionModule {
  data: any;
  execute: (interaction: any) => Promise<void>;
} 
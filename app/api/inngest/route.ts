import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { executeRoutine, routineScheduler, vmDesktopIdleScheduler } from '@/lib/inngest/functions';

// Create an API route that serves Inngest functions
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    routineScheduler,
    vmDesktopIdleScheduler,
    executeRoutine,
  ],
});

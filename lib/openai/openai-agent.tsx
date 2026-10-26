import {Agent, assistant, run, user} from "@openai/agents";
import "./ai-client"
import { agentResponseSchema } from "./agent-response-schema";
import { createVmDesktopFallbackTool, executeVmDesktopTask, type VmTaskOutcome } from "./vm-desktop-agent";

export type Message = {
    role: "user" | "assistant" | "agent";
    content: string;
}

function hasExplicitVmDesktopIntent(task: string) {
    const explicitDesktopRequest = /\b(use|open|resume|activate|launch|start)\b.{0,30}\b(vm|desktop|browser|chrome)\b/i.test(task);
    const browserResearchRequest = /\b(browse|open|visit|go to|navigate to|read|check|look up|search|find|research|summari[sz]e|fetch)\b.{0,100}\b(browser|website|webpage|web search|online|news|headlines|google news|hacker news)\b/i.test(task);
    const currentInformationRequest = /\b(latest|current|today|right now|breaking|real[- ]time)\b/i.test(task)
        && /\b(news|weather|stocks?|prices?|headlines?|events?|scores?)\b/i.test(task);
    return explicitDesktopRequest || browserResearchRequest || currentInformationRequest;
}

function formatVmOutcome(outcome: VmTaskOutcome) {
    const details = outcome.details.map((detail) => `- ${detail}`).join("\n");
    return [outcome.summary, details, outcome.userAction].filter(Boolean).join("\n\n");
}

export const createAgent = (name: string, instructions: string, tools: any[] = [] ) => {
    return new Agent({
        name : name,
        instructions : instructions,
        tools: [...tools],
        model: "gpt-5-mini",
        outputType:agentResponseSchema
    })
}

export const executeAgentChat = async( name : string, instructions : string, messages : Message[], tools:any[]=[],
    availableTools:Array<{
        slug: string,
        name: string,
        description: string
    }>,
    timeZone = "UTC",
    connectedToolSlugs: string[] = [],
    knownRoutines: Array<{ id: string; name: string; goal: string }> = [],
    vmContext?: { agentId: string; userEmail: string },
) => {
    const currentUserMessage = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
    if (vmContext && hasExplicitVmDesktopIntent(currentUserMessage)) {
      const vmTask = await executeVmDesktopTask(vmContext.agentId, vmContext.userEmail, currentUserMessage);
      return {
        type: "message" as const,
        message: formatVmOutcome(vmTask),
        questions: [],
        routine: null,
        routineAction: null,
        suggestedTools: [],
        connectedTools: [],
        vmTask,
      };
    }

    const formattedInstructions = buildAgentInstructions(
      name,
      instructions,
      availableTools,
      timeZone,
    connectedToolSlugs,
    knownRoutines,
    );
    const vmFallback = vmContext ? createVmDesktopFallbackTool(vmContext.agentId, vmContext.userEmail) : null;
    const agent = createAgent(name, formattedInstructions, [
      ...tools,
      ...(vmFallback ? [vmFallback.tool] : []),
    ]);
    const history = messages.map((msg) => msg.role === "assistant" || msg.role === "agent" ? assistant(msg.content) : user(msg.content));

    const result = await run(agent,history);
    const response = result.finalOutput;
    const vmOutcome: VmTaskOutcome | null = vmFallback?.getOutcome() ?? null;
    if (response && vmOutcome) {
      response.vmTask = vmOutcome;
      if (vmOutcome.status === "needs_user_login") {
        response.message = `${response.message}\n\n${vmOutcome.userAction ?? "Please open this agent's Preview tab, click Open/Resume VM Desktop, sign in yourself, then ask me to continue."}`;
      } else if (vmOutcome.status === "blocked") {
        response.message = `${response.message}\n\n${vmOutcome.summary}`;
      }
    }
    return response;
}

/** Executes a saved routine directly; tool calls happen inside the agent run. */
export const executeRoutineAgent = async (
  name: string, agentInstructions: string, routineName: string, routineGoal: string,
  routineInstructions: string, tools: any[] = [], timezone = "UTC",
  vmContext?: { agentId: string; userEmail: string },
) => {
  const task = `${routineGoal}\n${routineInstructions}`;
  if (vmContext && hasExplicitVmDesktopIntent(task)) {
    const vmTask = await executeVmDesktopTask(vmContext.agentId, vmContext.userEmail, task);
    return { output: formatVmOutcome(vmTask), vmTask };
  }

  const vmFallback = vmContext ? createVmDesktopFallbackTool(vmContext.agentId, vmContext.userEmail) : null;
  const agent = new Agent({
    name: `${name} routine executor`,
    instructions: `Execute the saved routine "${routineName}" exactly once.\n\nAgent instructions:\n${agentInstructions}\n\nRoutine goal:\n${routineGoal}\n\nRoutine instructions:\n${routineInstructions}\n\nTimezone: ${timezone}\n\nUse available connected tools first. For read-only current website research that connected tools cannot perform, use the persistent VM desktop fallback. If it reports that user login is required, clearly ask the user to sign in in this agent's Preview tab and continue the routine later. Do not create or propose another schedule. Return a concise, accurate summary.`,
    tools: [...tools, ...(vmFallback ? [vmFallback.tool] : [])],
    model: "gpt-5-mini",
  });
  const result = await run(agent, `Run the routine "${routineName}" now.`);
  return {
    output: result.finalOutput ?? "The routine completed without a summary.",
    vmTask: vmFallback?.getOutcome() ?? null,
  };
}

export const buildAgentInstructions = (
  agentName: string,
  customInstructions: string,
  availableTools: Array<{
    slug: string;
    name: string;
    description: string;
  }>,
  timezone: string,
  connectedToolSlugs: string[] = [],
  knownRoutines: Array<{ id: string; name: string; goal: string }> = []
) =>
  `
You are ${agentName}.
${customInstructions}

User timezone: ${timezone}

Available tools catalog:
${availableTools
  .map((tool) => `- ${tool.slug}: ${tool.name} - ${tool.description}`)
  .join("\n")}

Connected toolkits for this agent:
${connectedToolSlugs.length ? connectedToolSlugs.map((slug) => `- ${slug}`).join("\n") : "None"}

Saved routines:
${knownRoutines.length ? knownRoutines.map((routine) => `- ${routine.id}: ${routine.name} — ${routine.goal}`).join("\n") : "None"}

Behavior Rules:
1. When a requested action can be performed by a connected toolkit and its function tool is available, execute that tool. After execution, return type="message" with the result. Do not suggest reconnecting a connected toolkit.
2. For read-only current website research or website content that connected tools cannot access, call run_vm_desktop_task and summarize its verified result. If it reports that a login is needed, tell the user to sign in themselves in the agent's Preview tab, then ask you to continue. Never ask for credentials in chat.
3. Return type="tool_connection" only if the requested action requires an external app for which you do NOT have an active function tool and the VM desktop is not an appropriate read-only fallback. Explain why the tool is needed in "message" and include the tool slug and reason in "suggestedTools".
4. Return type="clarification" if routine information is missing.
5. Return type="routine" for scheduled or repeated work.
6. If the user asks to connect a toolkit that is already listed under Connected toolkits, return type="message", confirm it is connected, and include that toolkit in "connectedTools". This lets the user manage or disconnect it from the chat.
7. If the user asks to run a saved routine now, return type="routine_run" and set "routineAction" to its exact ID from Saved routines. If they do not identify exactly one routine, return type="clarification" and ask which routine to run. Never run more than one routine in a response.

Response shape requirements:
- Always include "questions", "suggestedTools", and "connectedTools" as arrays (use [] when not applicable).
- Always include "routine" (use null unless type is "routine").
- Always include "routineAction" (use null unless type is "routine_run").
- For type="routine", list each required tool and its reason in "routine.tools".
- For type="routine", use an ISO date ("YYYY-MM-DD") for "schedule.startDate", a 24-hour time ("HH:mm") for "schedule.time", and a valid IANA timezone for "schedule.timezone". These values are used to calculate the routine's next run.
- For type="tool_connection", list each required tool and its reason in "suggestedTools".
- Use "connectedTools" only to surface an already-connected toolkit for management; do not use it for unconnected tools.

Never claim a tool is connected if you cannot execute it directly.
Suggest only tool slugs from the Available tools catalog.
`.trim();

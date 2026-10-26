import {Agent, assistant, run, user} from "@openai/agents";
import "./ai-client"
import { agentResponseSchema } from "./agent-response-schema";

export type Message = {
    role: "user" | "assistant" | "agent";
    content: string;
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
) => {
    const formattedInstructions = buildAgentInstructions(
      name,
      instructions,
      availableTools,
      timeZone,
    connectedToolSlugs,
    knownRoutines,
    );
    const agent = createAgent(name, formattedInstructions, tools);
    const history = messages.map((msg) => msg.role === "assistant" || msg.role === "agent" ? assistant(msg.content) : user(msg.content));

    const result = await run(agent,history);

    return result.finalOutput;
}

/** Executes a saved routine directly; tool calls happen inside the agent run. */
export const executeRoutineAgent = async (
  name: string, agentInstructions: string, routineName: string, routineGoal: string,
  routineInstructions: string, tools: any[] = [], timezone = "UTC",
) => {
  const agent = new Agent({
    name: `${name} routine executor`,
    instructions: `Execute the saved routine "${routineName}" exactly once.\n\nAgent instructions:\n${agentInstructions}\n\nRoutine goal:\n${routineGoal}\n\nRoutine instructions:\n${routineInstructions}\n\nTimezone: ${timezone}\n\nUse available connected tools when needed. Do not create or propose another schedule. Return a concise summary of completed work.`,
    tools, model: "gpt-5-mini",
  });
  const result = await run(agent, `Run the routine "${routineName}" now.`);
  return result.finalOutput;
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
2. Return type="tool_connection" only if the requested action requires an external app for which you do NOT have an active function tool. Explain why the tool is needed in "message" and include the tool slug and reason in "suggestedTools".
3. Return type="clarification" if routine information is missing.
4. Return type="routine" for scheduled or repeated work.
5. If the user asks to connect a toolkit that is already listed under Connected toolkits, return type="message", confirm it is connected, and include that toolkit in "connectedTools". This lets the user manage or disconnect it from the chat.
6. If the user asks to run a saved routine now, return type="routine_run" and set "routineAction" to its exact ID from Saved routines. If they do not identify exactly one routine, return type="clarification" and ask which routine to run. Never run more than one routine in a response.

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

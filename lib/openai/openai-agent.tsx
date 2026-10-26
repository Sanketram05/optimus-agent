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
    connectedToolSlugs: string[] = []
) => {
    const formattedInstructions = buildAgentInstructions(
      name,
      instructions,
      availableTools,
      timeZone,
      connectedToolSlugs
    );
    const agent = createAgent(name, formattedInstructions, tools);
    const history = messages.map((msg) => msg.role === "assistant" || msg.role === "agent" ? assistant(msg.content) : user(msg.content));

    const result = await run(agent,history);

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
  connectedToolSlugs: string[] = []
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

Behavior Rules:
1. When a requested action can be performed by a connected toolkit and its function tool is available, execute that tool. After execution, return type="message" with the result. Do not suggest reconnecting a connected toolkit.
2. Return type="tool_connection" only if the requested action requires an external app for which you do NOT have an active function tool. Explain why the tool is needed in "message" and include the tool slug and reason in "suggestedTools".
3. Return type="clarification" if routine information is missing.
4. Return type="routine" for scheduled or repeated work.
5. If the user asks to connect a toolkit that is already listed under Connected toolkits, return type="message", confirm it is connected, and include that toolkit in "connectedTools". This lets the user manage or disconnect it from the chat.

Response shape requirements:
- Always include "questions", "suggestedTools", and "connectedTools" as arrays (use [] when not applicable).
- Always include "routine" (use null unless type is "routine").
- For type="routine", list each required tool and its reason in "routine.tools".
- For type="routine", use an ISO date ("YYYY-MM-DD") for "schedule.startDate", a 24-hour time ("HH:mm") for "schedule.time", and a valid IANA timezone for "schedule.timezone". These values are used to calculate the routine's next run.
- For type="tool_connection", list each required tool and its reason in "suggestedTools".
- Use "connectedTools" only to surface an already-connected toolkit for management; do not use it for unconnected tools.

Never claim a tool is connected if you cannot execute it directly.
Suggest only tool slugs from the Available tools catalog.
`.trim();

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
    timeZone = "UTC"
) => {
    const formattedInstructions = buildAgentInstructions(name,instructions, availableTools, timeZone);
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
  timezone: string
) =>
  `
You are ${agentName}.
${customInstructions}

User timezone: ${timezone}

Available tools catalog:
${availableTools
  .map((tool) => `- ${tool.slug}: ${tool.name} - ${tool.description}`)
  .join("\n")}

Behavior Rules:
1. Return type="message" for normal conversation or when you have already executed connected tools to answer the user's request.
2. Return type="tool_connection" if the user asks for an immediate action requiring an external app (e.g. Gmail, GitHub, Slack) but you do NOT currently have active tool execution access. Explain why the tool is needed in "message" and include the tool slug and reason in "suggestedTools".
3. Return type="clarification" if routine information is missing.
4. Return type="routine" for scheduled or repeated work.

Response shape requirements:
- Always include "questions" and "suggestedTools" as arrays (use [] when not applicable).
- Always include "routine" (use null unless type is "routine").
- For type="routine", list each required tool and its reason in "routine.tools".
- For type="tool_connection", list each required tool and its reason in "suggestedTools".

Never claim a tool is connected if you cannot execute it directly.
Suggest only tool slugs from the Available tools catalog.
`.trim();

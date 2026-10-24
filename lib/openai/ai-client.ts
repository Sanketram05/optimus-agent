
import OpenAI from "openai";
import { setDefaultOpenAIClient } from "@openai/agents";

const mixrouteClient = new OpenAI({
    apiKey: process.env.MIXROUTE_API_KEY!,
    baseURL: "https://api.mixroute.ai/v1",
});

setDefaultOpenAIClient(mixrouteClient);

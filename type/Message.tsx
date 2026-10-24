export type MessageType = {
    id: string,
    role: "user"|"assistant"|"agent",
    content: string,
    time: string,
}
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import axios from "axios"


function CreateAgent() {
  const router = useRouter()

  const [avatarSeed, setAvatarSeed] = useState("optimus-agent");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setAvatarSeed(crypto.randomUUID());
  }, []);

  function shuffleAvatar() {
    const seed = crypto.randomUUID();
    setAvatarSeed(seed);
  }

  const OnClickCreateAgent = async(e:any) => {
    e.preventDefault();
    setIsLoading(true);

    try{
      const avatarImage = `https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${avatarSeed}`;

      const newAgentId = crypto.randomUUID();
      const result = await axios.post('/api/agent', {
        name: name,
        description: description,
        agentImage: avatarImage,
        agentId: newAgentId,
      });

      console.log(result.data);
      router.push(`/workspace/${newAgentId}`);
      setIsLoading(false);

    } catch (error) {
      console.error("Error creating agent:", error);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-background px-5 py-4 sm:px-8 sm:py-5 lg:px-12">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-4">
          <h1 className="text-xl font-semibold tracking-tight">Create New Agent</h1>
          <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">
            Set up your AI agent by choosing an avatar, name, and description. You can configure its tools and behavior later.
          </p>
        </header>

        <form
          className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="flex flex-col items-center border-b border-border pb-4">
            <div className={`flex size-16 items-center justify-center overflow-hidden rounded-2xl bg-linear-to-br`}>
              <img
                src={`https://api.dicebear.com/10.x/gaze/svg?tags=animation&seed=${avatarSeed}`}
                alt="Selected Optimus agent avatar"
                width={100}
                height={100}
                className="size-full object-cover"
                
              />
            </div>
            <p className="mt-2 text-sm font-medium">Agent avatar</p>
            <Button type="button" variant="outline" size="sm" className="mt-1.5 gap-2" onClick={shuffleAvatar}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Shuffle Image
            </Button>
          </div>

          <div className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <label htmlFor="agent-name" className="text-sm font-medium">
                Agent Name
              </label>
              <Input id="agent-name" name="agent-name" placeholder="e.g. Research Assistant" className="h-9" required
              onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-4">
                <label htmlFor="agent-description" className="text-sm font-medium">
                  Agent Description
                </label>
                <span className="text-xs text-muted-foreground">Optional</span>
              </div>
              <Textarea
                id="agent-description"
                name="agent-description"
                placeholder="Describe what this agent will help you with..."
                className="min-h-16 resize-y"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="h-9 sm:min-w-24" onClick={() => router.push("/workspace")}>
              Cancel
            </Button>
            <Button type="submit" className="h-9 sm:min-w-32" onClick={OnClickCreateAgent}
            disabled={isLoading}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
              Create Agent
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateAgent

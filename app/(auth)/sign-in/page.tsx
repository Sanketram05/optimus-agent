import { Suspense } from "react"
import { AuthScreen } from "@/components/custom/auth/AuthScreen"

export default function SignInPage() {
  return <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-[#fbfbff] text-sm text-zinc-500">Loading...</main>}><AuthScreen mode="sign-in" /></Suspense>
}

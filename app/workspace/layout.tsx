import AppSidebar from "@/components/custom/workspace/AppSidebar"

function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}

export default WorkspaceLayout

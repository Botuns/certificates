import { MobileNav } from "@/components/shell/mobile-nav"
import { Sidebar } from "@/components/shell/sidebar"
import { StoreBoot } from "@/components/shell/store-boot"
import { Topbar } from "@/components/shell/topbar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <StoreBoot />
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        {/* pb-20 clears the mobile tab bar; lg drops it. */}
        <main className="flex-1 px-4 pt-5 pb-24 sm:px-6 lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}

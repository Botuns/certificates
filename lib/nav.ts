import {
  Certificate01Icon,
  DashboardCircleIcon,
  PrinterIcon,
  Settings01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

export type NavItem = {
  href: string
  label: string
  icon: typeof DashboardCircleIcon
  short: string
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: DashboardCircleIcon, short: "Home" },
  {
    href: "/editor",
    label: "Editor",
    icon: Certificate01Icon,
    short: "Editor",
  },
  { href: "/roster", label: "Roster", icon: UserGroupIcon, short: "Roster" },
  { href: "/print", label: "Print", icon: PrinterIcon, short: "Print" },
]

export const SETTINGS_ITEM: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings01Icon,
  short: "Settings",
}

export const EVENT = {
  title: "Regional Ijtema & IVC 2026",
  org: "Majlis Atfal-ul Ahmadiyya, Oyo Ilaqa",
  dates: "24 – 26 August 2026",
} as const

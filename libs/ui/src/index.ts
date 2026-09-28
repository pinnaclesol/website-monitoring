// Note: the stylesheet (src/styles/globals.css) is CSS, not a JS export —
// consumers import it directly by path. See libs/ui/README.md.

export { cn } from './lib/cn';

export { Button, buttonVariants } from './components/ui/Button';
export type { ButtonProps } from './components/ui/Button';

export { Badge, badgeVariants } from './components/ui/Badge';
export type { BadgeProps } from './components/ui/Badge';

export { Input } from './components/ui/Input';
export type { InputProps } from './components/ui/Input';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from './components/ui/Card';

export { LoginForm } from './components/LoginForm';
export type { LoginFormProps } from './components/LoginForm';

export { Toggle } from './components/ui/Toggle';
export type { ToggleProps } from './components/ui/Toggle';

export { Modal } from './components/ui/Modal';
export type { ModalProps } from './components/ui/Modal';

export { EmptyState } from './components/ui/EmptyState';
export type { EmptyStateProps } from './components/ui/EmptyState';

export { Tooltip } from './components/ui/Tooltip';
export type { TooltipProps } from './components/ui/Tooltip';

export { ImageUpload } from './components/ui/ImageUpload';
export type { ImageUploadProps } from './components/ui/ImageUpload';

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from './components/ui/Select';

export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/Tabs';

export {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from './components/ui/Dropdown';
export type {
  DropdownProps,
  DropdownTriggerProps,
  DropdownContentProps,
  DropdownItemProps,
} from './components/ui/Dropdown';

export { HistoryBars } from './components/HistoryBars';
export type { HistoryBarsProps, HistoryStatus } from './components/HistoryBars';

export { ConfirmDialog } from './components/ConfirmDialog';
export type { ConfirmDialogProps } from './components/ConfirmDialog';

export { Toast, ToastIcon } from './components/Toast';
export type { ToastProps, ToastData, ToastType } from './components/Toast';

export { ToastProvider, ToastContext } from './components/ToastProvider';
export type { ToastInput, ToastContextValue } from './components/ToastProvider';

export { useToast } from './components/use-toast';

export { StatCard } from './components/StatCard';
export type { StatCardProps, StatCardAccent } from './components/StatCard';

export { IncidentBanner } from './components/IncidentBanner';
export type { IncidentBannerProps } from './components/IncidentBanner';

export {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
  SidebarFooter,
} from './components/Sidebar';
export type { SidebarHeaderProps, SidebarNavItemProps } from './components/Sidebar';

export { Topbar, Breadcrumb } from './components/Topbar';
export type { TopbarProps, BreadcrumbProps } from './components/Topbar';

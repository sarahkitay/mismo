import { forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { 
  MessageSquare, 
  AlertCircle, 
  Search, 
  UserPlus, 
  HeartPulse, 
  CalendarCheck, 
  Megaphone, 
  TrendingUp, 
  CheckCircle, 
  Mail, 
  Clock, 
  ChevronRight,
  Users,
  FileText,
  BarChart3,
  Activity,
  Settings,
  Bell,
  Home,
  Briefcase,
  BookOpen,
  AlertTriangle,
  XCircle,
  Check,
  Plus,
  Filter,
  MoreHorizontal,
  Phone,
  Smartphone,
  Send,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  Edit,
  Eye,
  Lock,
  Unlock,
  Menu,
  X,
  LogOut,
  User,
  Building2,
  Calendar,
  Flag,
  HelpCircle,
  Info,
  SearchX,
  Inbox,
  CheckSquare,
  Timer,
  Target,
  Zap,
  Layers,
  PieChart,
  LineChart,
  Database,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function createSymbolIcon(BaseIcon: LucideIcon): LucideIcon {
  const WrappedIcon = forwardRef<SVGSVGElement, LucideProps>(({ className, strokeWidth, ...props }, ref) => (
    <BaseIcon
      ref={ref}
      strokeWidth={strokeWidth ?? 1.9}
      className={cn('mismo-symbol', className)}
      {...props}
    />
  ));

  WrappedIcon.displayName = `MismoSymbol(${BaseIcon.displayName ?? BaseIcon.name ?? 'Icon'})`;
  return WrappedIcon as unknown as LucideIcon;
}

const rawIcons = {
  // Navigation
  home: Home,
  dashboard: BarChart3,
  reports: FileText,
  investigations: Search,
  employees: Users,
  prompts: MessageSquare,
  campaigns: Megaphone,
  analytics: LineChart,
  activity: Activity,
  systemHealth: Scale,
  settings: Settings,
  resources: BookOpen,
  bookOpen: BookOpen,
  
  // Actions
  add: Plus,
  edit: Edit,
  delete: Trash2,
  view: Eye,
  eye: Eye,
  filter: Filter,
  search: Search,
  more: MoreHorizontal,
  send: Send,
  download: Download,
  upload: Upload,
  refresh: RefreshCw,
  
  // Navigation arrows
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  chevronRight: ChevronRight,
  
  // Status
  check: Check,
  checkCircle: CheckCircle,
  checkSquare: CheckSquare,
  xCircle: XCircle,
  alertCircle: AlertCircle,
  alertTriangle: AlertTriangle,
  info: Info,
  help: HelpCircle,
  
  // Communication
  mail: Mail,
  bell: Bell,
  message: MessageSquare,
  phone: Phone,
  smartphone: Smartphone,
  
  // User
  user: User,
  users: Users,
  userPlus: UserPlus,
  logout: LogOut,
  lock: Lock,
  unlock: Unlock,
  
  // Business
  building: Building2,
  briefcase: Briefcase,
  flag: Flag,
  target: Target,
  zap: Zap,
  layers: Layers,
  
  // Health/Metrics
  heartPulse: HeartPulse,
  trendingUp: TrendingUp,
  barChart: BarChart3,
  pieChart: PieChart,
  lineChart: LineChart,
  
  // Time
  clock: Clock,
  calendar: Calendar,
  calendarCheck: CalendarCheck,
  timer: Timer,
  
  // Other
  menu: Menu,
  close: X,
  shield: Scale,
  balance: Scale,
  inbox: Inbox,
  searchX: SearchX,
  megaphone: Megaphone,
  database: Database,
};

export const Icons = Object.fromEntries(
  Object.entries(rawIcons).map(([name, Icon]) => [name, createSymbolIcon(Icon as LucideIcon)])
) as { [K in keyof typeof rawIcons]: LucideIcon };

export type IconName = keyof typeof Icons;
